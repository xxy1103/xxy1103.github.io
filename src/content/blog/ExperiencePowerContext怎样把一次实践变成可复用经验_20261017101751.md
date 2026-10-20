---
title: "Experience：PowerContext怎样把一次实践变成可复用经验"
date: "2026-10-17T10:17:51+08:00"
updated: "2026-10-20T16:49:39+08:00"
description: "PowerContext 的 Experience 功能通过整理实践经验，帮助团队记录情境、行动、结果和教训，提升后续任务的参考价值。文章详细介绍了如何创建、审核和复用经验，强调了经验在项目中的重要性和实用性。"
draft: false
categories:
  - "笔记"
tags:
  - "oceanbase"
  - "powercontext"
  - "agent"
---
来年 花也将继续盛开，春日将不厌其烦地反复到来。

<!-- more -->

# Experience：PowerContext 怎样把一次实践变成可复用经验

项目里积累的不只有规则，还有做事的方法和踩过的坑。PowerContext 的 **Experience（经验）** 把一次实践整理为情境、行动、结果和教训，再通过证据、审核和版本保留，让后续任务能够参考。

本文假设你已经了解 Scope、Artifact 和 Memory，用“订单 CSV 导入器的金额精度问题”贯穿讲解。金额规则、任务结果及 ID 均为教学示例；创建、审核和复发处理规则依据当前仓库实现。

## 1. 已经有 Memory，为什么还要保存经验？

假设项目保存了一条 Memory：“金额输入转换使用 Decimal。”后来的 Agent 查到它，就知道该遵循什么规则。

但遇到相似问题时，它还可能需要知道：当时什么操作造成了误差？具体怎样修复？检查了哪些输入？这次是否适用同样的方法？

Experience 把这些信息连起来，帮助后来的人判断**什么情况下可以借鉴什么做法，以及结论有多大把握**。

| 内容         | 在金额案例中的用途                               |
| ------------ | ------------------------------------------------ |
| Memory       | 保存“金额转换使用 Decimal”这条可独立维护的规则 |
| Topic Memory | 整理金额方案的背景、当前约定和相关细节           |
| Experience   | 记录一次精度问题的处理过程、观察结果和可复用判断 |

三种内容可以同时存在，各自支持不同的阅读和使用需求。

## 2. 一份 Experience 的四个部分

Experience 的正文有四个必填字段：

* situation 情景
* action 行动
* outcome 结果
* lesson 经验

![Experience 的情境、行动、结果和经验形成一条推理链，证据支撑观察，结论保留验证范围](image/experience/01-experience-structure.svg)

情境要足够具体，便于判断是否相似；行动写清实际做法；结果保留观察范围；经验说明怎样借鉴。这样，后来的人才能决定是否采用、还要检查什么。

上例只验证了一个输入。如果把 outcome 写成“所有金额输入均正确”，再把 lesson 写成“金额处理已经完全可靠”，就连续扩大了两次结论。

**Outcome 记录这次观察，Lesson 表达由观察支持的可复用判断。** 审核时，要检查证据是否支持 outcome，再检查 outcome 是否足以支持 lesson。

失败尝试也可以形成经验。例如，调整四舍五入方式后，原用例仍然失败。只要证据明确，就能记录这次做法的局限，为后续排查提供参考。尚未运行、跳过或结果未知的检查，也应如实保留其状态。

## 3. 经验的依据放在哪里？

正文说明发生了什么，`lineage` 记录生成这一版经验所依据的精确引用。例如：

- Source A：错误复现材料。
- Source B：修复后的验证结果。
- Memory Citation：项目采用整数分存储的具体条目版本。

Experience 还可以引用其他正式 Artifact Revision。通过这些引用，审核者可以分别核对项目约定、实际行动和验证结果。

引用会固定到相应身份或版本。假设 `experience / exp_01 @ 1` 使用了某条 Memory 的旧版本，后续 Memory 更新后，这份经验仍然保留原有引用。

**有引用意味着可以追溯，还需要检查引用内容是否支持正文。** “执行了测试”的记录，不能直接支撑“测试全部通过”。

## 4. Candidate 是怎样产生的？

**Candidate 是带正文、证据和版本的待审核提案。** 在 Experience 的提案工作流中，先创建 pending Candidate，批准后再提交正式 Artifact。

先区分三件事：**谁准备正文、谁选择材料、任务怎样运行。** 四种入口的分工如下：

| 入口             | 谁准备正文   | 谁选择材料                                         | 怎样运行                 |
| ---------------- | ------------ | -------------------------------------------------- | ------------------------ |
| 直接提交完整内容 | 人或业务程序 | 提交方                                             | 校验后保存 Candidate     |
| 主动请求模型生成 | 模型         | 调用方选择 Source 或 Artifact                      | 请求等待生成结果         |
| Dream            | 模型         | 调用方选择 Memory 条目或 Experience，可补充 Source | 创建后台运行，再查询结果 |
| 后台定时孵化     | 模型         | 程序按游标选择任务结果                             | 后台定时处理             |

下面先讲三个由调用方主动发起的入口，再展开自动孵化的处理过程。

### 直接提交完整内容

人或业务程序已经整理好 situation、action、outcome、lesson 时，可以调用 `propose_experience`，提交完整内容和证据，无需模型。程序校验通过后创建 Candidate。

HTTP 接口是 `POST /v1/experience/propose`，请求体使用 JSON。下面以新建经验提案为例；将 Scope 和 Source ID 替换为已有记录，Source 应属于该 Scope，并包含实际的复现和验证材料：

```http
POST /v1/experience/propose
Content-Type: application/json

{
  "scope_id": "你的 Scope ID",
  "proposal": {
    "situation": "金额文本先转成 float，再换算为整数分，某个输入出现误差。",
    "action": "改为从原始金额文本直接解析 Decimal，再按项目规则转换。",
    "outcome": "原来失败的那个输入得到预期结果。",
    "lesson": "这次结果支持采用 Decimal 修复该问题；仍需其他精度和边界用例验证。"
  },
  "source_refs": [
    {"name": "content", "source_id": "已有任务结果的 Source ID"}
  ],
  "artifact_refs": [],
  "target": null,
  "reason": "保存这次金额精度修复的经验。"
}
```

`proposal` 放完整正文；`source_refs` 和 `artifact_refs` 放证据引用。`target: null` 表示提议创建新经验，`reason` 是可选的提交理由。

成功返回 **HTTP 201** 和新 Candidate，其中 `status` 为 `pending`、`version` 为 `1`、`result_artifact` 为 `null`。保存返回的 `candidate_id` 和 `version`，即可继续读取和审核；此时还没有正式 Experience Revision。

### 主动请求模型生成

调用方选择精确的 Source 或 Artifact 引用，请求模型提炼经验。例如：“根据这次错误复现和修复验证，整理可复用经验。”

HTTP 接口是 `POST /v1/experience/generate`。服务端需要配置并启用 Experience 生成模型；调用方提交证据引用，由模型生成四个正文部分。下面仍以新建经验为例，将 Scope 和 Source ID 替换为已有记录：

```http
POST /v1/experience/generate
Content-Type: application/json

{
  "scope_id": "你的 Scope ID",
  "source_refs": [
    {"name": "content", "source_id": "已有任务结果的 Source ID"}
  ],
  "artifact_refs": [],
  "target": null,
  "reason": "根据金额错误的复现和修复验证，提炼可复用经验。"
}
```

`source_refs` 和 `artifact_refs` 指定模型可用的证据，两个字段都需要提供；`target: null` 表示新建意图。若要更新已有经验，将其精确当前引用同时放入 `target` 和 `artifact_refs`。启用认证时，同样添加 Bearer 请求头。

成功处理返回 **HTTP 200**，通过响应正文区分两种结果：

- `status: pending`：`candidate` 包含新建的待审核提案，保存其 `candidate_id` 和 `version`，继续检查和审核。
- `status: no_op`：`candidate` 为 `null`，模型没有提出值得保存的内容。

### Dream（记忆提炼）：选取已有知识，发起后台提炼

**Dream 也是主动调用模型生成提案的入口。** 它支持选择具体的 Memory 条目或 Experience 作为材料，并把提炼保存为一项可查询的后台运行。

继续看金额案例。如果已经有错误复现和修复验证的 Source，可以使用前面的 `generate_experience`。如果相关事实已经整理成几条 Memory和几个分散的Experience，例如“某输入转换出现误差”和“改用 Decimal 后原用例通过”，希望选中这些具体条目继续提炼，就可以使用 Dream。

两种入口的能力有重叠。选择时主要看：需要引用整份 Artifact 还是具体 Memory 条目。两者都支持明确指定 target，提出对已有经验的更新。

#### 提交：选择精确引用，取得 run_id

服务端需具备 Dream 生成和后台处理能力。常用 HTTP 接口如下，`scope_id` 都放在路径中：

| 操作         | 接口                                         | 用途                                          |
| ------------ | -------------------------------------------- | --------------------------------------------- |
| 提交提炼任务 | `POST /v1/scopes/{scope_id}/dream`         | 发送 JSON 请求，取得包含 run_id 的运行记录    |
| 查询单次任务 | `GET /v1/scopes/{scope_id}/dream/{run_id}` | 查看运行状态、提炼结果及生成的 Candidate 引用 |
| 列出任务     | `GET /v1/scopes/{scope_id}/dream`          | 浏览该 Scope 的 Dream 运行记录                |

通常先 POST 提交，再用返回的 run_id 发起 GET 查询。下面选取一个 Memory 条目；需要多条时可在`memory_citations`中添加多个记录

```http
POST /v1/scopes/你的ScopeID/dream
Content-Type: application/json

{
  "operation": "refine_experience",
  "memory_citations": [
    {
      "memory_ref": {
        "family": "memory",
        "artifact_id": "已有 Memory ID",
        "revision": 3
      },
      "entry_id": "已有条目 ID",
      "entry_version_id": "该条目的精确版本 ID"
    }
  ],
  "idempotency_key": "amount-experience-001"
}
```

`memory_citations` 用于选择具体 Memory 条目，`artifacts` 可选择精确 Experience 引用，`sources` 可补充 Source。至少选择一条 Memory 条目或一份 Experience。上例省略 target，表示提议新建经验。

`idempotency_key` 标识这一次请求。相同 key 和相同输入用于重试时，会返回原运行。开始另一项提炼时使用新的 key。启用认证时，同样需要 Bearer 请求头。

已接受、仍在排队或运行的请求返回 **HTTP 202** 和运行记录，保存其中的 `run_id`。重放已结束的请求返回 HTTP 200；应检查记录中的实际状态。

#### 后台提炼：程序组织证据，模型生成内容

这一步**把你选中的几条知识及其依据放在一起，请模型整理出一条值得复用的经验。**

例如，你选中了“金额转换出现误差”和“改用 Decimal 后原用例通过”两条 Memory。程序取出这些内容和可用的来源材料，模型据此整理出：遇到什么情况、采取什么办法、观察到什么结果、以后可以借鉴什么。

#### 查询：区分运行结果和待审提案

使用刚才保存的 run_id 查询：

```http
GET /v1/scopes/你的ScopeID/dream/返回的run_id
```

先看 `status`，确认运行是否完成或失败；成功完成后，再看 `outcome`：

| outcome            | 含义                                             |
| ------------------ | ------------------------------------------------ |
| `proposed`       | 已创建待审提案，`candidate` 中包含其 ID 和版本 |
| `no_change`      | 没有值得提出的变化，不创建 Candidate             |
| `needs_evidence` | 缺少支撑行动或结果的可用证据，不创建 Candidate   |

整个过程可以这样理解：

![Dream 先以 run_id 跟踪后台提炼，查询成功结果后，有提案时取得 candidate_id 进入审核；无变化或证据不足时不创建提案](image/experience/08-dream-flow.svg)

**run_id 跟踪这次提炼任务，candidate_id 定位生成后等待审核的提案。** 运行成功也可能没有提案；有提案也仍需审核，生成不会自行批准。

### 后台定时孵化

自动孵化从 **Source 日志中的任务结果** 提炼待审经验。调用方不必逐条挑选证据：程序用处理进度找到一批新材料，再让模型判断其中有什么值得复用。

#### 先开启定时处理

服务端需要配置生成模型，并将自动孵化间隔设为正数。如：

```bash
export POWERCONTEXT_SERVER_INFERENCE_GENERATION_MODEL=provider:model-name
export POWERCONTEXT_SERVER_RUNTIME_EXPERIENCE_SCHEDULE_SECONDS=30
```

模型名和 Provider 凭据按实际部署配置。

后台检查各 Scope 的 Source 最新位置与 Experience 处理进度，将有未处理材料的 Scope 安排给 Worker。Worker 再执行下面的孵化流程。

#### 第一步：程序按游标选取一批 Source

Experience 使用自己的 **Cursor（游标）**，记录“已经处理到日志的第几条”，与 Memory、Topic Memory 的处理进度分别保存。

假设当前 Scope 有 25 条 Source，Experience 已处理到第 10 条。为了便于演示，把本次窗口上限设为 5，则读取第 11～15 条：

| 日志位置 | Source 内容                     | 用途                          |
| -------- | ------------------------------- | ----------------------------- |
| 11       | “请排查金额转换误差”          | 普通用户 Prompt               |
| 12       | 复现了一个金额输入的精度错误    | Content，kind 为 task-outcome |
| 13       | 改用 Decimal 后，原失败用例通过 | Content，kind 为 task-outcome |
| 14       | 保存一次 Artifact 写入的内容    | 仅用于 lineage 追溯的内部记录 |
| 15       | “好的，继续”                  | 普通用户 Prompt               |

这段连续范围叫 **Window（窗口）**。窗口上限限制本批原始日志记录数，过滤后交给模型的数量通常更少。

> 当前内置后台 Worker 使用 `POWERCONTEXT_SERVER_RUNTIME_SOURCE_WINDOW_LIMIT`，默认 100；上例的 5 只是教学配置。

#### 第二步：程序过滤，准备模型输入

程序先排除仅用于追溯的内部 Source，再从可用材料中选择 **ContentSource 且 metadata.kind 为 task-outcome** 的记录。因此，上例只有第 12、13 条进入普通孵化模型。

> 这两个条件分别承担不同作用：
>
> - ContentSource：材料以正文文本保存，孵化管线可以读取并交给模型。
> - metadata.kind = task-outcome：采集方声明，这份材料记录的是任务执行结果。

程序为每条证据建立编号与真实 Source 引用的对应关系，输入可简化理解为：

```text
任务：从以下任务结果提炼可复用经验。
保留真实检查状态，每份提案必须注明使用的证据编号。

e1：复现了一个金额输入的精度错误。
e2：从原始文本解析 Decimal 后，原失败用例通过。
```

**普通聊天不会仅凭“看起来像总结”进入孵化。** 采集方需要将任务结果保存成带上述 kind 标记的 Content Source，正文还必须有可提炼的行动和结果。

#### 第三步：模型提出完整经验和依据

模型同时看到这一批任务结果及 `experience.incubate` 操作指令，可以结合多条证据形成经验。上例可能返回：

```text
proposal：
  situation：金额文本经 float 转换后出现精度误差。
  action：改为从原始文本解析 Decimal。
  outcome：原失败输入得到预期结果。
  lesson：这次结果支持该修复方向；仍需其他精度和边界验证。
  [failure]: ...
evidence_ids：[e1, e2]
```

每份输出包含完整四个字段、可选的 failure 块，以及至少一个证据编号。指令要求模型保留失败、跳过、超时和未知状态，并在没有可复用判断时不提出内容。

**普通自动孵化只根据本批任务结果提出新经验，不会自动查找并合并已有经验。** 如果要补充某份已有经验，需要明确指定它为更新目标；失败复发触发的自动复查则按专门规则处理。

#### 第四步：程序校验，把编号还原为引用

这一步是在**检查模型输出能否保存，并把模型引用的证据编号换成系统中真正可追溯的 Source 引用**。

沿用前面的例子，程序把两份任务结果交给模型时，已经保存了对应关系：

```text
e1 → 错误复现的 Source
e2 → 修复验证的 Source
```

模型返回一份经验，并注明 `evidence_ids: [e1, e2]`。程序接下来做三件事：

1. **检查结构。** 提案是否包含 situation、action、outcome、lesson，字段是否符合要求。
2. **核对并转换引用。** 查找 e1、e2 对应的真实 Source 引用，将它们保存为提案依据。如果模型写了不存在的 e9，就拒绝这份输出。
3. **去除完全重复的提案。** 同一次输出中，如果两份提案的正文和所选证据集合都相同，只保留一份。相似但不完全相同的经验，仍可能需要在审核时辨别。

这样保存后的 Candidate 才能通过引用找到原始材料，供审核者核对。

**程序校验能确认“结构合规、引用有效”，但不能仅凭这些确认“结论正确”。** 即使 e1、e2 都真实存在，模型仍可能夸大结果，这部分需要审核。

#### 第五步：程序保存 Candidate，同时推进进度

校验通过后，程序分配 candidate_id，保存 version 为 1、status 为 pending、target 为空的提案，保留真实 Source 引用。使用了自定义孵化 Prompt 时，还会记录对应的精确 Prompt Revision。

**Candidate 写入与 Cursor 推进在同一次数据库事务中完成。** 上例成功后，Cursor 从 10 前进到 15，下一批从第 16 条继续。第 11、14、15 条虽未交给模型，也已经按规则检查过，因此不会卡住进度。

如果没有符合条件的任务结果，或模型成功返回空列表，仍可以推进 Cursor。若模型调用、校验或提交失败，进度不会因这次失败而前进；提交失败时，本次 Candidate 写入也一起回滚。提交时还会检查游标是否被别的工作推进，后台 Worker 是否仍有有效处理资格，避免旧结果抢先覆盖进度。

结果进入审核收件箱，等待检查、修订、批准或拒绝。自动孵化完成后，正式 Experience 尚未创建；待审内容也不会进入 Experience 召回。

同一处理窗口还会运行**失败复发记录与复查规则**，可能额外创建带 target 的更新 Candidate。它与上面模型提炼新经验的路径分开，条件和作用见后面的“失败反复出现”一节。

把这批材料的处理过程连起来看：

![自动孵化按独立游标选取 Source 窗口，过滤任务结果，模型提出完整经验及证据编号，程序校验后原子保存 Candidate 与进度](image/experience/07-automatic-incubation.svg)

## 5. 新建经验还是更新经验，由谁决定？

**入口决定如何准备提案，target 决定批准后创建新经验，还是更新指定经验。** 关键字段是 `target`（更新目标）。

- target 为空：批准后创建新的 Experience 身份及 Revision 1。
- target 为 `experience / exp_01 @ 1`：批准后在同一身份下创建 Revision 2。

![四种入口产生待审核提案；普通孵化使用空 target，其他入口可明确指定 target；批准后分别创建新经验或更新已有经验](image/experience/02-candidate-origins.svg)

例如，我们后来补充了一组边界验证，希望完善原来的金额经验，就把新证据和 `exp_01 @ 1` 一起提交，并明确将它设为 target。目标必须是同 Scope 中可用的当前 Experience Revision，同时包含在 Artifact 证据中。

**引用某份 Experience 作为证据，不会自动把它设为更新目标。** 主动生成、直接提交和 Dream 都通过请求中的 target 表达这个选择。当前普通孵化不会仅凭相似内容自行选择旧经验进行替换。

更新已有经验时，也会创建一份新的 Candidate。新建提案和修改现有 pending Candidate，是两个操作：前者获得新的 candidate_id，后者增加原 Candidate 的 version。

## 6. 提案怎样成为正式版本？

审核时，查看完整 proposal、精确证据、当前 version，以及可选的 target。对于金额案例，先核对实际验证范围，再决定怎样处理：

| 操作 | 结果                                                                                |
| ---- | ----------------------------------------------------------------------------------- |
| 修订 | 提交完整替代 proposal 及其所需证据，追加新的 Candidate Version，仍为 pending        |
| 批准 | 在同一事务中提交正式 Artifact，并将 Candidate 标记为 approved，返回 result_artifact |
| 拒绝 | 记录 decision_reason，状态变为 rejected，不提交正式 Artifact                        |

批准和拒绝都是终态。同一个 Candidate 之后不能再修订、批准或拒绝。批准表示完成了审核决定，经验的适用性仍需在具体任务中判断。

![Candidate Version 和 Artifact Revision 使用独立的版本序列；首次提案第三版获批产生 Experience 第一版，后续新提案再推进正式版本](image/experience/03-review-versions.svg)

## 7. 审核为什么需要两道版本检查？

第一道检查针对**提案本身**。你检查了 Candidate V2，就携带 `expected_version=2` 做决定。如果别人已经改成 V3，请求会报告冲突。应重新读取并审核，不能只替换请求中的数字。

第二道检查针对**准备更新的正式内容**。Candidate 的 target 是 `exp_01 @ 1`，如果另一个提案先让 head 前进到 `exp_01 @ 2`，这份提案的批准也会冲突，并保持 pending。

![批准时分别检查 Candidate 是否仍为审核过的版本，以及 target 是否仍为正式 head；两种冲突需要不同的处理步骤](image/experience/04-approval-conflicts.svg)

**当前实现不允许在同一个 Candidate 的不同版本间更换 target。** 目标过期后，应读取新 head，协调内容，再针对新 head 创建新的 Candidate；旧提案可以拒绝并记录理由。

## 8. 批准以后，Agent 怎样用到经验？

已批准的当前 Experience head 可以参与同一 Scope 的 PreparedContext 召回。是否实际选中，仍取决于问题、组装配置和共享输出预算。

Pending、rejected Candidate 和历史 Experience Revision 不参与这条当前经验召回路径。历史正式版本仍可精确读取，用于核对当时的依据和结论。

后续 Agent 再次处理金额转换时，可以根据经验判断相似性、采用适用做法并运行验证。**正式保存、具备召回资格、被本次请求选中，要分别确认。**

## 9. 同类错误又发生了，怎样让已有经验进入复查？

前面讲的是怎样形成、审核和使用一份经验。接下来还有一个问题：**经验已经存下来了，如果同类错误后来反复出现，谁来提醒我们重新检查它？**

PowerContext 提供了一套复查机制：根据后续任务结果记录同类失败，满足条件时，自动创建一份指向已有经验的更新 Candidate，交给审核者处理。

### 先看一个完整的例子

我们已经保存了金额转换经验 `exp_01 @ 1`，其中写着：“从原始金额文本直接解析 Decimal，避免先经过 float。”

后来，相关任务又报告金额精度错误。系统根据约定的失败线索和证据，将符合规则的结果记为这份经验的一次复发。如果这样的复发多次出现，且满足复查条件，系统就把第 1 版经验送回审核收件箱。

审核者接到提案后，再检查：经验是不是漏写了适用条件？实际执行时是不是没有遵循建议？检查用例是不是不够？根据证据决定是否修改经验。

整个过程可以先记成一句话：

**后续任务报告问题 → 系统记录复发 → 满足条件后提出复查 → 审核者决定怎样处理。**

### 系统需要知道两件事

要完成上面的过程，系统得知道“要跟踪什么”和“后来发生了什么”。这分别由两种记录提供：

| 记录                        | 作用                           | 金额案例中的意思                                                 |
| --------------------------- | ------------------------------ | ---------------------------------------------------------------- |
| Experience 中的 `failure` | 事先说明要跟踪的问题和核对方法 | 关注金额转换精度；再次遇到这个场景时，核对指定的精度检查         |
| 后续任务的 Task Outcome     | 事后记录实际观察和检查结果     | 这次处理了什么输入，出现了什么问题，检查通过还是失败，有什么证据 |

`failure` 是经验里**可选的一部分**。额外填写 failure，才能为这里的失败跟踪提供所需信息。

Task Outcome 就是前文后台孵化读取的任务结果记录。普通孵化可以用它提炼新经验；这里的复查规则则利用其中的结构化结果，检查已有经验对应的问题是否再次发生。这两项处理都可以发生在任务结果的孵化窗口中。

先理解这两个角色就够了，具体字段放在本节末尾对照。

### 怎样记一次复发？什么时候清零？

假设系统正在跟踪 `exp_01 @ 1` 的金额精度问题。后续任务结果可能提供三种情况：

| 情况                                                                 | 系统怎样处理                         |
| -------------------------------------------------------------------- | ------------------------------------ |
| 记录了匹配的失败，证据也满足规则                                     | 记一次“复发”，计数加一             |
| 有充分证据确认这次遇到了相关风险、通过了指定检查，并满足经验关联要求 | 记一次“已避免”，计数清零           |
| 只说“任务完成”，或没有足够证据判断                                 | 无法据此确认已避免，计数不会因此清零 |

为什么“任务完成”还不够？因为这次任务可能只是改了页面样式，根本没有处理金额。即使处理了金额，也可能没有执行精度检查。**只有确实遇到了相关场景，并有符合规则的验证结果，才有依据记为“已避免”。**

例如，按任务结果的固定顺序处理这些观察：

```text
观察：复发 → 复发 → 已避免 → 复发 → 复发 → 复发
计数： 1      2       0       1      2      3
```

这个计数针对同一个经验版本、同一个失败线索。第 1 版的问题留在第 1 版上；后来产生第 2 版时，两个版本分别统计。没有记录或无法判断的任务不会把计数清零。

### 什么时候送去复查？

记录新的复发后，当前实现检查三个条件：

1. **复发计数达到 3 或以上。** 这里的 3 是当前实现采用的阈值。
2. **被跟踪的经验版本仍是当前版本。** 如果经验已经更新，就不能把旧版本的复发直接当成新版本的问题。
3. **failure 中指定复查经验内容。** 对应字段值是 `repair_surface: experience_content`；其他修复位置不会通过这条规则生成经验内容更新提案。

满足这些条件后，系统创建一份更新 Candidate。回到前文的概念，它包含：

| 内容         | 保存什么                                           |
| ------------ | -------------------------------------------------- |
| `target`   | `experience / exp_01 @ 1`，明确要复查哪一版      |
| `proposal` | 原 Experience 的内容，供审核者检查和修订           |
| 依据与理由   | 触发本次复查的任务结果引用，以及重复失败的复查理由 |
| `status`   | `pending`，等待审核                              |

审核者可以结合证据修订提案，再决定批准或拒绝。批准后才会产生新的 Experience Revision。

到这里，复查机制的主线已经完整了：

![同一经验版本与失败线索的复发计数随观察变化，已避免使计数清零；达到阈值且仍为当前版本、修复位置为经验内容时，创建带原正文的待审核更新提案](image/experience/05-recurrence-review.svg)

### 对照实际字段：这些信息怎样记录？

下面两个例子分别展示跟踪规则和任务结果。理解整体流程后，再看这些字段会更容易。

#### failure：写下要跟踪的问题

这个块与 situation、action、outcome、lesson 并列，放在 proposal 内。下面只展示 failure 部分：

```json
{
  "failure": {
    "signature": {
      "recall_cue": "CSV 金额文本转换为整数分",
      "symptom": "转换后的整数分与预期金额不一致。"
    },
    "repair_surface": "experience_content",
    "verification": {
      "condition": "本次任务涉及 CSV 金额文本转换为整数分。",
      "check_subject": "金额转换精度回归检查"
    }
  }
}
```

可以把它读成一段话：

> 跟踪“CSV 金额文本转换为整数分”这个场景中的精度错误。如果需要复查，检查经验正文。要确认后续任务避免了这个问题，需要确认它确实处理了金额转换，并核对“金额转换精度回归检查”的结果。

各字段分别承担这些作用：

| 字段                           | 通俗解释                                                 |
| ------------------------------ | -------------------------------------------------------- |
| `signature.recall_cue`       | 用于匹配的稳定线索，让后续失败能与这份经验对应           |
| `signature.symptom`          | 错误表现，帮助人理解问题；可以省略                       |
| `repair_surface`             | 准备复查哪里；这里的 `experience_content` 表示经验正文 |
| `verification.condition`     | 后续任务必须实际遇到什么场景，才谈得上验证问题是否被避免 |
| `verification.check_subject` | 要核对哪一项检查                                         |

填写这些字段只是定义跟踪规则。检查是否真的执行、结果怎样，要看实际任务记录和证据。

#### Task Outcome：记录后来发生的事

前面已经讲过复发怎样累计。这里补充一个“已避免”的例子，看看系统需要哪些材料才能把计数清零。

假设后续任务再次处理金额转换，原失败用例检查通过。用日常语言描述就是：

> 这次确实涉及金额转换；执行了约定的精度检查，原失败用例通过；检查材料已经保存，任务交接记录也能关联到被跟踪的经验。

完整结构如下，可与上面的 failure 对照阅读：

<details>
<summary>展开 Task Outcome JSON 示例及证据关联说明</summary>

下面是任务结果正文示例。作为这里的处理输入，它保存在 ContentSource 中，并标记 `metadata.kind: task-outcome`。示例中的来源 ID 需要替换成实际存在的记录。

```json
{
  "schema": "powercontext.task-outcome.v1",
  "objective": "验证 CSV 金额文本转换为整数分的精度",
  "status": "succeeded",
  "summary": "使用 Decimal 转换后，原失败用例得到预期结果。",
  "handoff_receipt_ref": {
    "source_type": "content",
    "source_id": "receipt_amount_01"
  },
  "observations": [
    {
      "text": "本次任务涉及 CSV 金额文本转换为整数分。",
      "basis": "verified",
      "evidence": [
        {
          "kind": "source",
          "source_ref": {
            "source_type": "content",
            "source_id": "amount_check_01"
          }
        }
      ]
    }
  ],
  "checks": [
    {
      "name": "金额转换精度回归检查",
      "status": "passed",
      "details": "原失败输入转换后的整数分与预期一致。",
      "basis": "verified",
      "evidence": [
        {
          "kind": "source",
          "source_ref": {
            "source_type": "content",
            "source_id": "amount_check_01"
          }
        }
      ]
    }
  ]
}
```

| 这里的字段                 | 在案例中说明什么                                          |
| -------------------------- | --------------------------------------------------------- |
| `objective`、`summary` | 本次任务的目标和结果，帮助人理解背景                      |
| `observations[].text`    | 确认遇到了 failure 中 `condition` 指定的场景            |
| `checks[].name`          | 对应 failure 中的 `check_subject`，说明核对的是哪项检查 |
| `checks[].status`        | `passed` 表示这项检查通过，是判断“已避免”的条件之一   |
| `basis`、`evidence`    | 标记有证据支持的观察或检查，并给出证据引用                |
| `handoff_receipt_ref`    | 关联任务交接回执，帮助确认本次任务与哪份经验有关          |

这里让观察文本与 condition、检查名称与 check_subject 保持一致，便于程序按规则对应。`amount_check_01` 应保存实际检查材料，能支持“这次涉及金额转换”和“原失败用例通过”。填写 `verified` 必须附带证据引用，证据本身也需要能够被解析和核对。

交接回执用于追溯任务接手时的知识来源。这里的 `receipt_amount_01` 需要指向已接受、精确选择某个 Handoff 版本的有效回执；该 Handoff 版本还需引用被跟踪的 Experience。这样才能建立“这次任务—交接内容—具体经验版本”的关联。

系统会结合这些材料及其他规则判断是否记为“已避免”，包括不能同时存在该问题的匹配复发。单独写 `succeeded`、`passed` 或 `verified`，都不足以完成这个判断。

</details>

**记住主线即可：failure 定义跟踪规则，Task Outcome 提供后续结果，程序据此累计复发并提出复查，审核者决定经验怎样更新。**

## 10. 把全过程串起来

回到金额精度问题：先保存错误复现和实际验证结果，再提出 Candidate。审核时收窄超出证据范围的结论，批准为 `exp_01 @ 1`。后续任务参考这份经验，完成更多验证后，可以明确针对第 1 版提出新的更新 Candidate，再批准为第 2 版。

![从实践证据到待审提案、正式经验、后续使用和新增证据；更新需要明确目标，每次正式提交都经过审核](image/experience/06-experience-lifecycle.svg)



## 延伸阅读

- [创建并审核 Experience](zh/docs/workflows/create-and-review-experience.md)：主动生成、更新和定时孵化。
- [审核 Candidate](zh/docs/workflows/review-candidates.md)：Dream、修订、批准和拒绝的使用方式。
- [Experience 与 Skill 生命周期](zh/docs/workflows/experience-and-skill-lifecycle.md)：证据、审核与正式版本的关系。
- [Experience 内容模型](../src/powercontext/builtin/artifacts/experience/models.py)：四个字段与 failure 结构。
- [自动孵化管线](../src/powercontext/builtin/artifacts/experience/incubation.py)：任务结果过滤、模型输入、输出校验与本批去重。
- [孵化模型指令](../src/powercontext/builtin/artifacts/experience/prompts.py)：提炼要求、检查状态与证据约束。
- [窗口处理与提交](../src/powercontext/builtin/runtime/relational.py)：Cursor、Candidate 事务和失败复查旁路。
- [审核服务](../src/powercontext/builtin/review/service.py)：版本检查、目标约束和批准提交。
- [复发处理](../src/powercontext/builtin/runtime/recurrence.py)：证据匹配、复发计数和更新提案条件。
