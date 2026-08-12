---
title: "KDD Cup 2026 Champion：Video Result Agent 设计说明"
date: "2026-08-12T14:40:21+08:00"
updated: "2026-08-12T14:48:07+08:00"
description: "`video_result_agent` 是视频答案预判器，通过三步判断视频是否展示完整答案，确保结果的准确性和可靠性，最终由 Solver 决定是否采纳建议。"
draft: false
categories:
  - "笔记"
tags:
  - "kddcup"
  - "agent"
---
这些平淡的日常也很幸福 只要是和你一起度过的话 ——ねえ、ちゃんと聞いてる?

<!-- more -->

> 文档性质：当前实现说明与使用指南
> 代码核对日期：2026-08-11
> 适用范围：`src/data_agent_baseline/agents_v2/video_result_agent.py` 及其在 `zz_agent_v2.py` 中的调用链

## 技术摘要

`video_result_agent` 是主 Solver 之前的一个视频答案预判器。它不负责写 SQL，也不直接生成 `prediction.csv`，而是回答两个更窄的问题：

1. 视频面板是否已经直接展示了题目需要的完整答案？
2. 如果展示了，Solver 应直接采用、采用后复核，还是回结构化数据重算？

为降低一次判断承担过多任务带来的波动，它把工作拆成三步：

```text
EXTRACT：从视频中读候选答案
   ↓
ALIGN：与结构化列和单位对齐
   ↓
DECIDE：给出采用、复核或重算建议
```

主流程默认**并发**运行 5 轮，再用多数票汇总。汇总结果只作为建议注入 Solver；最终是否采纳仍由 Solver 决定。

![Video Result Agent 总览](<image/KDD Cup 2026 ChampionVideo Result Agent 设计说明_20260812144021/overview.svg>)

## 它位于整条解题链的哪里

视频首先经过确定性的输入准备：

1. 从 `context/video/briefing.mp4` 中抽取稳定幻灯片帧。
2. 用 ASR 生成带时间戳的旁白。
3. 为帧生成 Hiccup 版面树，补充小字、表格和数值信息。
4. 按时间轴组织成“帧图 → 版面树 → 对应旁白”的多模态输入。
5. `video_result_agent` 读取这些材料并给出建议。
6. Solver 同时看到原视频材料和该建议，自行完成最终求解。

因此，它不是视频预处理器，也不是最终解题 Agent，而是二者之间的判断层。

## 接受哪些输入

单轮入口为 `run_video_result_async`，投票入口为 `run_video_result_voted`。输入既可以由调用方直接传入，也可以根据 `task_dir` 自动装配。

| 输入               | 默认来源                                          | 用途                             |
| ------------------ | ------------------------------------------------- | -------------------------------- |
| `question`       | `task.json`                                     | 确定题目要哪些字段、行和统计粒度 |
| `video_parts`    | `workdir/_video_frames/video_input.json`        | 帧图、Hiccup 版面树和 ASR 旁白   |
| `knowledge_md`   | `context/knowledge.md`                          | 核对字段含义、单位和业务口径     |
| `schema_preview` | `context/csv`、`context/json`、`context/db` | 对齐真实输出列，判断能否回表复核 |
| `model`          | `build_model()`                                 | 执行三步结构化判断的推理模型     |

这里有三个重要边界：

- schema 预览明确不读取 `context/doc`。
- `knowledge.md` 默认最多读取 12,000 字符，schema 预览默认最多 14,000 字符。

![输入如何被组织](<image/KDD Cup 2026 ChampionVideo Result Agent 设计说明_20260812144021/input-assembly.svg>)

## 三步 Agent 如何工作

### Step 1：EXTRACT——视频里有没有完整答案

第一步只看题目与视频多模态内容，输出 `VideoClaim`。

它会先判断题目要的是单值、名单还是分组结果，再通览所有帧，识别当前生效的筛选范围、周期、单位和分组维度。若名称与数值分布在不同页面，可以按排名、行号或 ID 跨帧拼接，但每个单元格都必须能指向来源帧。

同时必须排除常见干扰：旧批次、邻近指标、单一对象高亮、未应用的字段、单位陷阱，以及被旁白明确说明“仅供参考”的内容。

中文等效 Prompt：

> 你是视频答案抽取 Agent。请判断视频是否在与题目一致的作用域下直接展示了完整最终答案。先理解题目需要的字段与粒度，再通览全部帧并识别配置、结果、名单、参考页和干扰页。允许按排名、行号或 ID 跨帧拼接，但每个值都必须有明确来源。若只看到规则、阈值、部分答案，或无法确认作用域，请判定“未直接展示”，不要猜测。严格输出结构化结果。

输出示意：

```json
{
  "has_displayed_answer": true,
  "claimed_values": [["华东", "128.6"], ["华南", "117.4"]],
  "source_frames": ["幻灯片 #7", "幻灯片 #8"],
  "distractor_notes": "幻灯片 #3 是上一统计周期，已排除"
}
```

若 `has_displayed_answer=false`，本轮会立即返回 `RECOMPUTE`，不再执行后两步。

### Step 2：ALIGN——对应哪些列，单位是否一致

只有第一步确认视频展示了答案，第二步才会运行。它读取候选值、`knowledge.md` 和结构化 schema，输出 `AnswerShape`。

中文等效 Prompt：

> 你是答案对齐 Agent。请把视频候选答案对应到题目要求和结构化数据中的真实输出列，并检查单位与格式是否一致。若视频和数据使用不同单位，请在能够可靠换算时给出归一化结果。不要重新判断视频有没有答案，只做字段、单位和格式对齐。严格输出结构化结果。

输出示意：

```json
{
  "target_columns": ["region_name", "revenue_100m"],
  "unit_consistent": true,
  "normalized_values": [["华东", "128.6"], ["华南", "117.4"]],
  "note": "视频和目标字段均以亿元表示"
}
```

第二步失败不会终止整轮：系统会保留第一步原值，继续进入决策步骤。

### Step 3：DECIDE——采用、复核还是重算

第三步读取前两步结果与最多 6,000 字符的 schema 预览，输出 `Decision`。

中文等效 Prompt：

> 你是视频答案决策 Agent。根据题目、视频候选答案、诱饵说明、目标列、单位对齐结果和结构化 schema，在 `ADOPT`、`ADOPT_AND_VERIFY`、`RECOMPUTE` 中选择一个，并给出置信度和一句理由。视频完整明确展示答案且口径一致时可直接采用；名单较长或仍有轻微不确定时采用后复核；仅有规则、答案残缺或单位无法可靠处理时必须重算。

三种决策的含义是：

| 决策                 | 含义                                 | Solver 接下来怎么做      |
| -------------------- | ------------------------------------ | ------------------------ |
| `ADOPT`            | 视频已给出完整、明确且口径一致的答案 | 可以直接使用候选值       |
| `ADOPT_AND_VERIFY` | 视频答案基本可信，但值得低成本复核   | 先采纳，再用 SQL 对照    |
| `RECOMPUTE`        | 视频只给规则、答案不完整或口径不可靠 | 按视频规则回结构化表计算 |

![三步判断与分支](<image/KDD Cup 2026 ChampionVideo Result Agent 设计说明_20260812144021/three-step-decision.svg>)

## 为什么还要运行 5 轮投票

单轮模型在边界题上可能出现波动，因此主流程将 `VIDEO_RESULT_VOTE_ROUNDS` 设为 5，并发执行五次完整判断。

聚合规则偏保守：

1. 只有超过半数成功轮认为视频直接展示答案，最终才认定 `has_displayed_answer=true`；平票按 false 处理。
2. 若未过半，最终直接给出 `RECOMPUTE`。
3. 若已过半，只在判定为 true 的轮次中对 `decision` 取众数。
4. 候选值、目标列、来源帧等详细内容，取第一个与最终决策一致的代表轮次。
5. 最终置信度取支持该决策的轮次均值。

![五轮投票与 Solver 交接](<image/KDD Cup 2026 ChampionVideo Result Agent 设计说明_20260812144021/vote-and-handoff.svg>)

## 两个容易理解的样例

### 样例一：排行榜已经完整展示

题目要求输出销售额前两名地区及销售额。视频中：

- 幻灯片 #6 显示当前统计周期与单位“亿元”；
- 幻灯片 #7 显示排名和地区名称；
- 幻灯片 #8 按相同排名显示销售额；
- 幻灯片 #3 是上一周期排行榜。

Step 1 会按排名跨帧拼出两行，并把幻灯片 #3 记为诱饵。Step 2 将两列对齐到 `region_name` 和 `revenue_100m`。由于答案是多行且跨帧拼接，Step 3 更可能建议 `ADOPT_AND_VERIFY`。

### 样例二：视频只给筛选门槛

题目要求找出满足“资产规模大于 100 亿元且成立满 5 年”的公司。视频只展示了筛选配置，没有展示最终公司名单。

这时 Step 1 必须输出：

```json
{
  "has_displayed_answer": false,
  "claimed_values": [],
  "source_frames": [],
  "distractor_notes": "视频展示的是筛选条件，不是筛选后的结果名单"
}
```

系统随即返回 `RECOMPUTE`。Solver 应把视频门槛转换为查询条件，在结构化数据中计算最终名单。

## 最终输出与 Solver 如何消费

汇总结果使用 `VideoResultResult` 表示：

```json
{
  "task_id": "task_x",
  "has_video": true,
  "has_displayed_answer": true,
  "decision": "ADOPT_AND_VERIFY",
  "confidence": 0.84,
  "claimed_values": [["华东", "128.6"], ["华南", "117.4"]],
  "normalized_values": [["华东", "128.6"], ["华南", "117.4"]],
  "target_columns": ["region_name", "revenue_100m"],
  "source_frames": ["幻灯片 #7", "幻灯片 #8"],
  "distractor_notes": "已排除上一统计周期",
  "reason": "视频完整展示两行结果，建议结构化复核",
  "error": ""
}
```

主流程将它渲染成一段 `video_result_hint`，追加到 Solver instruction。注入候选答案时优先使用 Step 1 的 `claimed_values`，因为它最接近视频原始读数；单位归一和最终采用权仍交给 Solver。

这意味着：

- `video_result_agent` 的输出不是 Ground Truth；
- `ADOPT` 也不是强制终止 Solver；
- Solver 仍可检查原始帧、Hiccup、旁白和结构化数据；
- 最终 `prediction.csv` 始终由 Solver 生成。

## 日志、降级与可排查性

每个任务会写出：

```text
logs/<task_id>/video_result/
├── vote0.json
├── vote1.json
├── vote2.json
├── vote3.json
├── vote4.json
└── result.json
```

单轮日志保存三个步骤的结构化输出和消息轨迹；图片二进制会被替换为占位符，避免日志被 Base64 撑大。`result.json` 额外记录每轮是否发现答案、决策、置信度和候选行数，便于快速查看投票分布。

主要降级行为如下：

| 情况             | 行为                                              |
| ---------------- | ------------------------------------------------- |
| 没有视频         | 返回`has_video=false`，不向 Solver 注入有效建议 |
| 视频未完成预处理 | 返回错误，主流程跳过该建议                        |
| Step 1 失败      | 本轮失败并保存错误日志                            |
| Step 2 失败      | 使用 Step 1 原值继续决策                          |
| Step 3 失败      | 保守返回`ADOPT_AND_VERIFY`，置信度为 0.3        |
| 多轮未过半       | 汇总为`RECOMPUTE`                               |

任何 `video_result_agent` 异常都不会阻塞主解题流程。

## 结论

`video_result_agent` 的设计重点不是替 Solver 抢先回答，而是把“视频中看起来像答案的内容是否真的可以抄”变成一个独立、结构化、可投票、可审计的判断过程。

它用三步拆分控制复杂度，用多数票降低边界波动，再把最终决定权留给 Solver。这样既能利用视频已经展示的结果，也能避免把配置、旧批次或单位陷阱误当成答案。
