---
title: "PowerContext 数据模型入门"
date: "2026-09-26T19:30:00+08:00"
updated: "2026-09-26T22:19:48+08:00"
description: "从 Scope、Source、Artifact、Entry 和 PreparedContext 五个层次理解 PowerContext 的数据模型，并结合 Notebook 说明这些对象如何协作。"
draft: false
categories:
  - "笔记"
tags:
  - "powercontext"
  - "agent"
---
<!-- more -->
# PowerContext 数据模型入门

> 面向已经了解 Agent、Prompt 和 RAG 的程序员。本文先建立 PowerContext 的数据模型，再回到 `examples/jupyter/01_memory_across_sessions.ipynb` 看这些对象如何协作。

## 1. 先用一句话理解 PowerContext

PowerContext 是一个**上下文运行层**：它把项目中的证据和工作判断保存成可复用的上下文制品，在后续 Agent 请求中按需召回。

可以先把它想成一套项目知识库：

- `Scope` 是“哪个项目”或“哪块隔离空间”；
- `Source` 是外部材料和事实证据；
- `Artifact` 是 PowerContext 整理后可以复用的产物；
- `Entry` 是产物中的一条具体内容；
- `PreparedContext` 是为当前一次 Agent 请求挑出的临时材料。

![PowerContext 数据模型总览](image/powercontext-data-model_20260926193000/powercontext-data-model-overview.svg)

## 2. 五个层次：容器、证据、产物、内容、请求

### 2.1 Scope：数据隔离边界

`Scope` 表示一个相互隔离的工作范围。它可以对应一个项目、仓库、团队空间，或其他由应用定义的业务范围。

Notebook 中创建了一个订单 CSV 导入器 Scope：

```python
scope = await client.create_scope(
    CreateScopeRequest(
        title="订单 CSV 导入器 · 01",
        summary="第 01 篇教程的独立合成数据",
        idempotency_key=f"{lab.run_id}:lesson-01",
    )
)
scope_id = scope.scope_id
```

之后的调用都带有 `scope_id`：

```python
await client.remember_memory(..., scope_id=scope_id)
await client.search_memory(..., scope_id=scope_id)
await client.prepare_context(..., scope_id=scope_id)
```

这表示“在这个项目中保存、搜索和准备上下文”。不同 Scope 之间不会因为查询词相同而自动串台。

需要注意：`scope_id` 主要是数据选择和隔离边界，不等同于用户身份，也不是权限令牌。

### 2.2 Source：系统接入的原始证据

`Source` 表示 PowerContext 可以读取的外部材料，例如：

- 项目文档、代码和工单；
- Agent 的执行轨迹、工具结果和 review 记录；
- 用户输入、人工备注和任务结果；
- 外部系统中的事件或观测数据。

Source 是“发生过什么”的证据，原始材料通常仍由外部系统负责保存。PowerContext 可以保存捕获的内容，也可以保存指向外部材料的引用。

**捕获 Source 不会自动变成 Memory。** 应用或配置好的处理流程还需要决定：哪些事实值得长期保存，或者应该生成什么 Artifact。

> 本篇 Notebook 没有创建 Source，而是直接使用 `remember_memory` 保存一条已经由团队确认的约定。这是为了先学习 Memory 的最小闭环。

### 2.3 Artifact：可复用的上下文产物

`Artifact` 是 PowerContext 制作并维护的上下文产物。常见 Artifact family 包括：

- `memory`：长期事实、决定、约束、状态和下一步；
- `experience`：可复用的情境、行动、结果和经验；
- `skill`：可导出给 Agent 使用的操作说明和校验规则；
- `handoff`：任务交接和工作连续性记录；
- `profile`、`prompt`：Scope 背景和 Scope 级配置。

Artifact 不是原始 Source，也不是一次搜索得到的临时结果。它有稳定身份和版本，可以被后续工作读取、引用、审核或继续演进。

在 Notebook 中，默认日常 Memory 本身就是一个 `memory` Artifact：

```text
family      = memory
artifact_id = memory
revision    = 1
```

可以用统一读取接口按身份读取它：

```python
artifact = await client.get_artifact(
    scope_id,
    "memory",
    citation.memory_ref.artifact_id,
)
```

### 2.4 Entry：Artifact 里的具体条目

一个 Memory Artifact 可以包含多条 Memory Entry。例如：

```text
Memory Artifact: memory
├── Entry A: amount 用整数分存储
└── Entry B: 坏行必须返回原始 CSV 行号
```

Notebook 中使用 `remember_memory` 添加 Entry：

```python
saved = await client.remember_memory(
    RememberMemoryRequest(
        scope_id=scope_id,
        kind="decision",
        text="amount: 订单金额以整数分存储；100 表示 1 元，禁止用二进制浮点数累计金额。",
        reason="团队确认的金额存储约定",
    )
)
```

这里要区分两个 ID：

| 标识            | 含义                       |
| --------------- | -------------------------- |
| `artifact_id` | 整份 Memory 制品的稳定身份 |
| `entry_id`    | 制品中某一条 Memory 的身份 |

新增第二条约定后，两个 Entry 的 `entry_id` 不同，但仍属于同一个默认 Memory Artifact。这就是“同一本项目笔记中有多个条目”。

### 2.5 PreparedContext：一次请求的临时视图

`PreparedContext` 是根据本次问题从长期制品中挑选出的、有大小预算的上下文文本。它不是新的 Artifact，也不会自动长期保存。

```python
prepared = await client.prepare_context(
    PrepareContextRequest(
        scope_id=scope_id,
        query="amount",
        max_bytes=2500,
    )
)
```

随后应用可以把它放进模型消息：

```python
messages = [
    {"role": "system", "content": "帮助开发订单导入器。"},
    {"role": "system", "content": prepared.content},
    {"role": "user", "content": "amount 字段应该用什么单位存储？"},
]
```

这个过程类似 RAG，但数据来源和生命周期更明确：

```text
长期 Artifact
    ↓ 按 Scope、问题和预算召回
PreparedContext
    ↓ 加入当前 Agent turn
模型输入
```

本篇只验证上下文已经准备好并放进消息，没有调用真实模型验证模型是否采用它。

## 3. Artifact 为什么需要 Revision

Artifact 的内容不是原地覆盖，而是通过不可变 Revision 演进：

```text
Artifact: memory
  Revision 1  ── amount 约定
  Revision 2  ── amount 约定 + line_number 约定
  Revision 3  ── 修订 amount 约定
```

同一个 `artifact_id` 可以有多个 Revision。精确引用由三部分组成：

```text
family / artifact_id @ revision
```

例如：

```text
memory / memory @ 1
```

旧 Revision 不会因为当前版本前进而消失，因此可以读取“当时实际使用的那一版”。这对审计、Handoff、并发更新和复现很重要。

![Memory Artifact 的版本演进](image/powercontext-data-model_20260926193000/memory-lifecycle.svg)

## 4. Citation：把召回内容精确指回来源

保存 Memory 后，API 会返回 `citation`。它像一张定位卡，至少能回答：

- 这是哪种 Artifact family？
- 属于哪一个 Artifact？
- 使用的是哪个 Revision？
- 具体是哪一条 Entry？
- 具体的 Entry 内容版本是什么？

Notebook 中的引用结构大致如下：

```text
citation
├── memory_ref
│   ├── family: memory
│   ├── artifact_id: memory
│   └── revision: 1
├── entry_id
└── entry_version_id
```

因此，`search_memory` 返回的不是“相似的一段匿名文本”，而是带有精确来源的命中。应用可以据此读取制品、引用历史版本，或在后续修订时指定目标。

## 5. 把 Notebook 的完整流程串起来

这篇示例实际运行的是下面这条数据流：

```text
创建订单导入器 Scope
        ↓
搜索 amount：没有命中
        ↓
remember_memory 保存金额约定
        ↓
Memory Artifact 新增一个 Entry
        ↓
search_memory 找到 Entry
        ↓
prepare_context 组装本次问题的上下文
        ↓
加入模型消息
        ↓
新建 Client 仍能读取
        ↓
Server 重启后按 Artifact 和 Revision 读取
```

它证明的是：

1. 没有知识时，搜索和上下文准备都返回空结果；
2. 已确认的约定可以直接写入默认 Memory；
3. 约定可以被搜索和准备成当前请求的上下文；
4. 新 Client 不依赖旧 Client 的内存变量；
5. Server 重启后，持久化的 Artifact Revision 仍可读取；
6. 新增条目会产生新的 `entry_id`，但可以继续属于同一个 Memory Artifact。

## 6. 用类比快速记忆

| PowerContext 概念   | 直观类比             | 主要问题                              |
| ------------------- | -------------------- | ------------------------------------- |
| `Scope`           | 项目文件夹/工作空间  | 这条知识属于哪个项目？                |
| `Source`          | 原始资料、工单、日志 | 这件事的证据是什么？                  |
| `Artifact`        | 可维护的项目知识文档 | PowerContext 整理出了什么可复用产物？ |
| `Revision`        | 文档的不可变版本     | 当时使用的到底是哪一版？              |
| `Entry`           | 文档中的一条规则     | 具体保存了哪条知识？                  |
| `Citation`        | 带章节和版本的书签   | 这条知识如何精确追溯？                |
| `PreparedContext` | 为当前问题摘出的笔记 | 这次请求需要给 Agent 看什么？         |

## 7. 目前先记住的边界

- Memory 是长期保存的知识；`PreparedContext` 只是一次 Agent turn 的临时值。
- Source 是证据；Artifact 是基于证据整理出的可复用产物。
- Scope 是隔离边界；它不会自动替代身份认证或权限控制。
- 新增或修改内容会形成新的版本；历史版本可以被精确读取。
- 保存了 Memory，不等于模型一定会使用它；还要检查上下文是否进入真实模型输入。
- 本篇使用 FTS 关键词搜索；向量检索、混合检索和真实 Agent 使用会在后续 Notebook 展示。

**一句话总结：** `Scope` 决定知识属于哪里，`Source` 提供事实依据，`Artifact` 保存可复用产物，`Entry` 是产物中的具体内容，`Revision` 保证演进可追溯，`PreparedContext` 则把长期知识裁剪成当前 Agent 请求真正需要的材料。

