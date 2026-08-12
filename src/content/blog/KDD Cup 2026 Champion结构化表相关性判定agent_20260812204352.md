---
title: "KDD Cup 2026 Champion：结构化表相关性判定agent"
date: "2026-08-12T20:43:52+08:00"
updated: "2026-08-12T20:50:23+08:00"
description: "`table_relevance_agent` 通过分析问题、知识和候选表，判断表的相关性，优化 Solver 的初始提示，确保有效数据的调用，同时降低无关表对模型的干扰。"
draft: false
categories:
  - "笔记"
tags:
  - "agent"
  - "kddcup"
---
予我以心 还你以花 —— 忘れてください

<!-- more -->

> 文档性质：当前实现说明、设计动机与准确性边界
>
> 代码核对日期：2026-08-12
>
> 适用链路：`doc_prepare → scaffold → table_relevance_agent → describe_context_dir → solver`

## 1. 这个 Agent 解决什么问题

一个 task 的 `context/` 中可能同时存在多份 CSV、JSON 和 SQLite 数据库。主 Solver 真正解题时通常只需要少量表，但如果把每张表的列名、类型和样例全部展开到初始 prompt 中，无关表会占用大量 token，也会干扰模型定位目标字段、输出列和必经映射。

`table_relevance_agent` 位于主 Solver 之前，先横向比较题目依据与全部候选表，为每张表判断：

> 完成这道题时，是否确实需要从这张表取数？

它的结果只用于压缩 Solver 初始 prompt：相关表继续展示完整 schema 和样例；无关表只保留一行“表存在、可用 `explore_data` 找回”的提示。所有真实表仍会注册到 DuckDB，也仍会被 `solver.py` 加载。

![结构化表相关性判定总览](<image/KDD Cup 2026 Champion结构化表相关性判定agent_20260812204352/overview.svg>)

这使它更准确地属于“表级 Schema 压缩器”，而不是限制数据访问的路由器。

### 1.1 为什么采用软过滤

表相关性判断存在两种误差，但代价并不相同：

| 情况             | 下游影响                                       | 是否可恢复                 |
| ---------------- | ---------------------------------------------- | -------------------------- |
| 相关表被判为无关 | 初始 prompt 不展开 schema；Solver 需要额外探查 | 可以，表仍在 DuckDB 中     |
| 无关表被判为相关 | 初始 prompt 多保留一段描述                     | 不需要恢复，只是少省 token |

因此当前实现采用“召回优先”：边界拿不准时判相关；平票判相关；模型漏判某表时默认相关；所有调用失败时全部相关。

这与 `doc_relevance_agent` 的过滤性质不同：doc 被跳过后不会进入昂贵的结构化抽取，漏判可能让 Solver 彻底拿不到对应结构化数据；table 被折叠后仍然可查询，漏判主要增加一次找回成本。

## 2. 输入与输出

### 2.1 输入来自哪里

| 输入       | 默认来源                                | 作用                               | 默认限制                    |
| ---------- | --------------------------------------- | ---------------------------------- | --------------------------- |
| Question   | 主流程传入；                            | 确定筛选、计算和输出目标           | 当前无显式字符上限          |
| Knowledge  | 主流程传入；                            | 提供字段语义、单位、业务口径和映射 | 最多 8,000 字符             |
| 视频文本   | `video_input.json`；                  | 补充视频说明的字段、表和筛选口径   | 最多 6,000 字符             |
| 候选表     | `context/` 下的 CSV、JSON、DB、SQLite | 提供可选择的数据源全集             | 每表展示完整列清单和前 2 行 |
| 单元格样例 | 内存 DuckDB 查询结果                    | 帮助判断值的形态和字段用途         | 每格最多 80 字符            |

视频输入没有原始图片，程序复用视频预处理产物，将 ASR 旁白和 hiccup 版面文字还原为纯文本。

![Table Relevance Agent 输入装配](<image/KDD Cup 2026 Champion结构化表相关性判定agent_20260812204352/input-assembly.svg>)

### 2.2 哪些数据源会成为候选表

程序通过 `build_datasource_state(task_dir)` 创建一个内存 DuckDB，并扫描：

```text
context/csv/*.csv
context/*.csv

context/json/*.json
context/*.json

context/db/*.db
context/db/*.sqlite
context/*.db
context/*.sqlite
```

CSV 被注册为 DuckDB view；JSON 先转换成 DataFrame 再注册；SQLite 以只读方式挂载，并按库内物理表逐张注册。每张表得到一个 canonical 名称，相关性模型和投票过程都以这个名称为唯一标识。

来自 `_doc_extracted.db` 的表不会放进候选清单，而是直接进入 `always_keep`：

```python
DOC_EXTRACTED_STEMS = {"_doc_extracted"}
```

这些表已经经过 `doc_relevance_agent → doc_prepare`，再次判断会形成双重过滤。当前设计让它们始终保留详细描述，避免文档数据在完成结构化之后又被折叠。

### 2.3 五轮聚合后返回什么

这里需要区分两种输出：

1. 每轮模型返回的原始判断；
2. 五轮投票聚合后的 `TableRelevanceResult`。

模型单轮输出将在第后续详细介绍。本节重点说明主流程最终收到的聚合结果。

假设当前 task 有三张普通候选表：

```text
company_financials
company_profile
employee_attendance
```

此外，`_doc_extracted.db` 中还有一张文档抽取表：

```text
doc_company_rules
```

五轮投票结束后，`TableRelevanceResult` 可以理解为下面这个对象：

```json
{
  "task_id": "task_15",
  "per_table": {
    "company_financials": true,
    "company_profile": true,
    "employee_attendance": false
  },
  "relevant_tables": [
    "company_financials",
    "company_profile",
    "doc_company_rules"
  ],
  "skipped_tables": [
    "employee_attendance"
  ],
  "always_keep": [
    "doc_company_rules"
  ],
  "skipped_describe_keys": [
    "context/db/hr.db::employee_attendance"
  ],
  "reasons": {
    "company_financials": "该表提供收入和年份字段，是完成筛选计算所需的事实表。",
    "company_profile": "该表提供最终答案要求输出的企业名称，并承担 company_id 到名称的映射。",
    "employee_attendance": "题目不涉及员工考勤，解题过程无需使用该表。"
  },
  "all_tables": [
    "company_financials",
    "company_profile",
    "employee_attendance"
  ],
  "vote_tally": {
    "company_financials": "5/5",
    "company_profile": "4/5",
    "employee_attendance": "1/5"
  },
  "n_rounds_ok": 5,
  "error": ""
}
```

上面的示例表达了这样一次判断：

```text
company_financials
  5 轮中 5 轮判为相关
  → 最终 relevant=true

company_profile
  5 轮中 4 轮判为相关
  → 最终 relevant=true

employee_attendance
  5 轮中只有 1 轮判为相关
  → 最终 relevant=false
  → 生成折叠键 context/db/hr.db::employee_attendance

doc_company_rules
  来自 _doc_extracted.db
  → 不参加投票
  → 直接进入 always_keep
```

各字段可以这样理解：

| 字段                      | 含义                                                     |
| ------------------------- | -------------------------------------------------------- |
| `task_id`               | 当前任务目录名                                           |
| `per_table`             | 普通候选表经过投票后的最终布尔判断                       |
| `all_tables`            | 实际参加模型判断的 canonical 表名，不包含`always_keep` |
| `always_keep`           | 不参加判断、始终保留详细描述的表                         |
| `relevant_tables`       | 下游最终视为相关的完整表集合                             |
| `skipped_tables`        | 判为无关、准备折叠描述的普通表                           |
| `vote_tally`            | 该表收到的`true` 票数与有效票数                        |
| `reasons`               | 从与最终结论一致的模型判断中选出的一条理由               |
| `n_rounds_ok`           | 成功完成并参与聚合的模型轮数                             |
| `error`                 | 正常完成时为空；所有轮失败等情况下记录错误               |
| `skipped_describe_keys` | 交给`describe_context_dir` 的实际折叠键                |

这里尤其要注意三个集合之间的关系：

![TableRelevanceResult 中各表集合的关系](<image/KDD Cup 2026 Champion结构化表相关性判定agent_20260812204352/result-set-relationships.svg>)

最后，主流程真正使用的不是整个结果对象，而是：

```python
collapse_keys = set(trel.skipped_describe_keys)
```

在上面的例子中得到：

```python
{
    "context/db/hr.db::employee_attendance"
}
```

这个集合随后传给 `describe_context_dir`。最终效果是：

| 表                      | Solver 初始 Prompt     | DuckDB 查询权限 |
| ----------------------- | ---------------------- | --------------- |
| `company_financials`  | 展开完整 Schema 和样例 | 可查询          |
| `company_profile`     | 展开完整 Schema 和样例 | 可查询          |
| `doc_company_rules`   | 始终展开完整描述       | 可查询          |
| `employee_attendance` | 只保留一行折叠提示     | 仍然可查询      |

所以，`TableRelevanceResult` 的核心作用不是删除表，而是把逐表投票结果转换成一份供 `describe_context_dir` 使用的 Prompt 折叠清单。

## 3. 一次判断调用如何装配

### 3.1 每张表的预览

对每张普通候选表，程序先执行：

```sql
DESCRIBE "<canonical>"
```

得到完整的列名和 DuckDB 类型，再执行：

```sql
SELECT * FROM "<canonical>" LIMIT 2
```

得到前两行样例。最终表块类似：

```text
### 表: company_financials
  columns (4): company_id:VARCHAR, revenue:DOUBLE, year:BIGINT, status:VARCHAR
  sample1: {'company_id': 'C001', 'revenue': '1200000.0', 'year': '2025', 'status': 'active'}
  sample2: {'company_id': 'C002', 'revenue': '980000.0', 'year': '2025', 'status': 'inactive'}
```

列名和类型行在本模块中没有单独的字符上限；只有样例单元格限制为 80 个字符。若 `DESCRIBE` 失败，表块保留失败占位；若样例查询失败，仍保留 schema。

### 3.2 System instructions 的判断标准

Agent 的固定 instructions 是中文。去掉重复强调后，其等效含义是：

> 先拆解题目的筛选/计算字段和最终输出列，再判断每张表是否提供某项不可替代的输入。直接承载所需字段、提供必经实体映射，或被视频明确点名的表应判为相关；仅仅同领域、字段沾边、可能辅助或也含通用编号的表不应召回。边界拿不准时偏向相关。必须为清单中的每张表返回一条判定，不得新增表名。

判为相关的四类主要情况是：

1. 表提供筛选、分组、计算或聚合所需字段；
2. 表提供最终答案必须呈现的某个输出列，即使它不参与筛选；
3. 表提供题面实体到内部主键、关联对象或目标事实表的必经映射；
4. 视频明确提到或指向该表承载的字段、实体或口径。

Prompt 同时明确排除以下理由：

- 与目标表属于同一数据库或业务领域；
- 可能存在联动、先行指标或背景参考价值；
- 也有一个通用代码字段，因此“也许能 join”；
- 无法排除相关性，但说不出具体解题步骤。

模型在完成逐表判断后，还应反向检查：题目要求的每个输出列和每个筛选指标，是否都有来源表被召回。

### 3.3 User input 的真实结构

所有候选表不是逐表分开调用，而是被放进同一条 User input 中，让模型横向比较：

```text
## task question
{当前题目}

## knowledge
{knowledge.md，最多 8,000 字符；无则写明本任务无 knowledge.md}

## 视频口径 (操作讲解视频的幻灯片+旁白文本)
{可选；旁白 + hiccup 版面文字，最多 6,000 字符}

## 候选表清单 (共 N 张)

### 表: table_a
{完整列清单 + 前两行样例}

### 表: table_b
{完整列清单 + 前两行样例}
```

没有视频时，整个“视频口径”段不会出现。

| 一轮调用中的对象 |        数量 | 含义                         |
| ---------------- | ----------: | ---------------------------- |
| User input       |        1 条 | 包含当前 task 的全部动态材料 |
| 候选表块         |        N 个 | 全部放入同一条 User input    |
| 模型回复         |        1 条 | 返回一个结构化对象           |
| `verdicts`     | 目标为 N 条 | 与全部候选表一一对应         |

### 3.4 模型结构化输出

示例：

```json
{
  "verdicts": [
    {
      "table_name": "company_financials",
      "reason": "该表提供收入、年份和企业主键，是完成筛选计算的直接事实表。",
      "relevant": true
    },
    {
      "table_name": "company_profile",
      "reason": "该表提供题目要求输出的企业名称，并承担 company_id 到名称的映射。",
      "relevant": true
    },
    {
      "table_name": "employee_attendance",
      "reason": "题目不涉及员工考勤，解题任何一步都不需要该表。",
      "relevant": false
    }
  ]
}
```

字段顺序刻意设计为 `table_name → reason → relevant`，让**模型先写依据，再给布尔结论**。

## 4. 多轮投票、结果清洗与安全降级

上一节描述的是一轮模型判断。当前实现默认目标是收集 5 个成功轮次，每轮都收到完全相同的 instructions 和 User input，并重新判断全部候选表。

![并发补齐、逐表投票与安全兜底](<image/KDD Cup 2026 Champion结构化表相关性判定agent_20260812204352/voting-and-fallback.svg>)

### 4.1 第一批并发调用

程序先计算：

```python
n_rounds = max(1, int(vote_rounds))
```

默认 `vote_rounds=5`，因此第一批通过 `asyncio.gather` 并发发出 5 次模型调用。每次调用由 `asyncio.wait_for` 限制为 90 秒。

以下情况使当前轮失败：

- 超过 90 秒；
- 模型请求抛出异常；
- 结构化输出无法被 `TableRelevanceOut` 解析。

失败轮不进入投票。

### 4.2 失败轮次如何补发

如果第一批只有 3 轮成功，程序会再并发补发 2 轮；若仍有失败，就继续补齐。每一批只发送“距离 5 个成功轮还差的数量”。

```text
目标：5 个成功轮

批次 1：发 5 轮 → 成功 3，失败 2
批次 2：补 2 轮 → 成功 1，失败 1
批次 3：补 1 轮 → 成功 1
最终：攒满 5 个成功轮
```

批次数上限是：

```python
max_batches = n_rounds + 2
```

默认最多 7 批。这里是“7 批”，不是固定最多 7 次请求；一批可能包含多个并发请求。达到上限后如果已经有部分成功轮，就使用现有票数聚合。

### 4.3 每轮结果如何清洗

模型输出后，程序只保留 `table_name` 与候选 canonical 名完全一致的 verdict：

```python
verdicts = {
    v.table_name: v
    for v in out.verdicts
    if v.table_name in valid
}
```

因此：

| 模型行为                     | 程序处理                         |
| ---------------------------- | -------------------------------- |
| 新增候选清单外的表名         | 忽略                             |
| 表名拼写、空格或大小写不一致 | 若不能精确命中 canonical，则忽略 |
| 同一轮遗漏某张表             | 该轮对该表不计票                 |
| 同一轮返回重复表名           | 字典构造后保留最后一条           |

Prompt 要求覆盖全部表，但代码不会因为遗漏表而让整轮失败。

### 4.4 逐表多数投票与遗漏处理

聚合不是对“一整轮好不好”投票，而是对每张表独立计算：

```python
yes = 该表 relevant=true 的票数
n_j = 成功轮中实际返回该表的票数
relevant = yes * 2 >= n_j
```

| 有效票           | 最终结果         |
| ---------------- | ---------------- |
| 5 票中 3 票 true | 相关             |
| 5 票中 2 票 true | 无关             |
| 4 票中 2 票 true | 相关，平票偏召回 |
| 2 票中 1 票 true | 相关，平票偏召回 |
| 1 票 true        | 相关             |
| 1 票 false       | 无关             |

最终 `reason` 不是五轮理由的摘要。程序从与最终布尔结论一致的 verdict 中取第一条非空理由；如果没有，再退回该表第一条有效理由。

如果模型调用整体成功，但没有任何成功轮返回某张表，该表没有有效票。程序不会把它判为无关，而是得到：

```text
per_table = true
vote_tally = "0/0(默认相关)"
reason = "所有轮均未判定, 按召回优先默认相关"
```

这与“某一轮遗漏该表”不同：某一轮遗漏只表示该轮对该表弃权；只有所有成功轮都遗漏时，才触发 `0/0` 默认相关。

## 5. 从投票结果到 Solver Prompt

### 5.1 canonical 名如何变成折叠键

模型和投票使用 canonical 表名，但 `describe_context_dir` 遍历的是物理文件。`table_meta` 负责把二者重新接起来。

CSV 或 JSON 一份文件对应一张表，折叠键是相对 task 根目录的文件路径：

```text
context/csv/company_financials.csv
```

SQLite 文件可能包含多张表，因此按库内表逐张折叠：

```text
context/db/business.db::employee_attendance
```

这样同一个 SQLite 中的相关表可以展开，无关表可以折叠，不需要对整个数据库“一刀切”。

### 5.2 折叠前后有什么区别

主入口执行：

```python
collapse_keys = set(trel.skipped_describe_keys)

desc_str = describe_context_dir(
    task_dir,
    "context",
    skip_knowledge=True,
    collapse_keys=collapse_keys,
)
```

![软过滤只改变 Prompt，不改变数据可访问性](<image/KDD Cup 2026 Champion结构化表相关性判定agent_20260812204352/soft-filter-handoff.svg>)

相关表在 Solver 初始 prompt 中继续展示：

```text
文件 / 表名
行数
完整列名与类型
样例值
```

无关 SQLite 表只展示：

```text
── Table: employee_attendance
—— (table_relevance 判为无关, schema 已折叠省 token; 如需可用 explore_data 查询)
```

无关 CSV 或 JSON 也只保留一行折叠提示。因此 Solver 仍知道这份数据存在，不会把“未展开”误认为“文件被删除”。

> 软过滤把错误后果控制为“需要额外探查”，但不能保证 Solver 一定会执行这次探查。

## 6. 一句话总结

`table_relevance_agent` 把 question、Knowledge、可选视频文本以及全部普通结构化表的“完整列清单 + 前两行样例”拼成一条 User input，默认并发收集 5 个成功判断并逐表多数投票；它将无关表转换成 `describe_context_dir` 的折叠键，只压缩 Solver 初始 prompt，不改变 DuckDB 注册、`solver.py` 加载和 SQL 查询能力，并通过平票、遗漏和全失败时默认相关来优先保护召回。
