---
title: "PowerContext 数据模型学习笔记"
date: "2026-09-26T19:30:00+08:00"
updated: "2026-09-27T14:46:07+08:00"
description: "从 Scope、Artifact、Entry 到 PreparedContext，理解 PowerContext 的核心数据模型与使用方法。"
draft: false
categories:
  - "笔记"
tags:
  - "powercontext"
  - "agent"
---
<!-- more -->

# PowerContext 数据模型学习笔记

PowerContext 可以先用一句话理解：**把 Agent 工作中值得复用的项目知识，放进有边界、可版本化、可追溯的上下文系统；在下一次 Agent turn 前，再按问题和预算取出一小段材料。**

这篇笔记整理前四篇 Jupyter Notebook 的共同主线，面向已经了解 Agent、RAG 和向量/关键词检索的程序员。重点不在“背接口”，而在建立一套能指导设计和排错的心智模型：

```text
Scope（在哪个项目里）
  └── Artifact（哪一份可复用制品的哪一个版本）
        └── Entry（其中哪一条知识）
              └── PreparedContext（本次请求实际注入的临时视图）
```

![PowerContext 四个核心对象的关系](image/powercontext-data-model_20260926193000/01-model-overview.svg)

## 1. 先建立直觉：它解决了什么问题

普通 RAG 往往把“文档切块 → 建索引 → 召回 → 拼 Prompt”看作一条流水线。这个模型在回答一次问题时够用，但项目型 Agent 还会遇到四个长期问题：

- **知识属于哪个项目？** 两个项目都可能有 `currency` 字段，但含义不同。
- **一条知识后来改过什么？** 当前答案应该用新规则，审计时又要能找回旧规则。
- **一组知识和一条知识是什么关系？** 一次写入可能更新多个条目，但引用时需要指到具体条目。
- **模型本次到底收到了什么？** 不能只看“召回命中”，还要有一个受预算约束的最终输入视图。

PowerContext 用四个对象分别回答这些问题：`Scope` 管边界，`Artifact` 管版本化容器，`Entry` 管可独立维护的知识单元，`PreparedContext` 管一次 Agent turn 的输入。

## 2. Scope：先确定“在哪个工作空间里”

### 2.1 定义

`Scope` 是上下文的隔离边界，通常可以对应一个项目、仓库、客户空间或长期任务。服务端创建 Scope 后返回不透明的 `scope_id`；调用方应该保存并使用这个 ID，而不是根据目录名、仓库名或会话 ID 自己拼一个。

一个 Scope 的核心字段可以这样看：

| 字段                   | 含义                 | 使用提醒                     |
| ---------------------- | -------------------- | ---------------------------- |
| `scope_id`           | 服务端生成的稳定身份 | 用于后续 API 路由和查询      |
| `title`              | 给人看的名称         | 可以改名，不承担唯一身份     |
| `summary`            | 范围说明             | 帮助人和工具识别用途         |
| `parent_scope_id`    | 可选的组织父级       | 表示组织关系，不自动继承知识 |
| `context_references` | 显式引用其他 Scope   | 需要共享时明确声明           |
| `version`            | Scope 元数据版本     | 更新时用于并发控制           |

Scope ID 的作用是**选择数据**，不是认证身份，也不是执行授权。远程部署仍然需要认证和访问控制。

### 2.2 为什么同名关键词不会串台

假设国内订单和海外订单各自有一条 `currency`：

```text
Scope A（国内订单）  currency: CNY，单位为人民币分
Scope B（海外订单）  currency: USD，单位为美分
```

对 A 查询 `currency`，只从 A 的上下文范围召回；对 B 查询同一个词，只看到 B 的约定。查询词相同并不意味着数据会跨 Scope 混合。

![Scope 隔离与显式共享](image/powercontext-data-model_20260926193000/03-scope-isolation.svg)

父子 Scope 也要特别注意：`parent_scope_id` 只描述层级。子 Scope 不会因为挂在父 Scope 下，就自动看到父级 Memory。需要复用时，应通过显式上下文引用和访问权限完成设计。

### 2.3 创建 Scope

前四篇 notebook 使用 Python Client 的 HTTP 类型模型，最小示例是：

```python
from powercontext.http import CreateScopeRequest

scope = await client.create_scope(
    CreateScopeRequest(
        title="订单 CSV 导入器",
        summary="记录导入规则和验证约定",
        idempotency_key="orders-importer-v1",
    )
)
scope_id = scope.scope_id       # 后续请求使用它
```

`idempotency_key` 用来让重复发送同一个创建请求时恢复同一结果，适合网络重试和启动流程。

> `idempotency_key` 由调用方提供，用来识别“这是不是同一次创建操作的重试”

## 3. Artifact：可复用知识的不可变版本快照

### 3.1 它不是“一个文件”

`Artifact` 是一个可复用输出的**不可变 revision**。可以把它想成 Git 提交或数据库快照：

```text
family / artifact_id @ revision
memory / mem_123      @ 3
```

- `family` 表示制品家族；前四篇主要使用 `memory`。
- `artifact_id` 是稳定身份。同一份 Memory 更新后，ID 不变。
- `revision` 是快照版本。每次有效变更创建新版本，旧版本不被改写。
- `content` 保存这一版的完整结构化内容。
- `lineage`（在通用 Artifact 模型中）记录生成该版本所依赖的引用。

“不可变”带来两个直接好处：当前 head 可以持续前进；旧引用仍然能够精确读取当时的内容。

### 3.2 Artifact 和 Entry 的层级

Memory Artifact 是一个版本化容器，里面有多个逻辑 Entry。新增一条知识时，通常会得到：

```text
同一 memory artifact_id
├── Entry E1：金额以整数分存储
└── Entry E2：错误必须保留原始行号
```

再修改 E1：

```text
Artifact revision：1 → 2
Entry identity：E1（不变）
Entry version：V1 → V2（变化）
```

因此，“哪一份制品”由 `memory_ref` 表示，“制品中的哪一条知识”由 `entry_id` 和 `entry_version_id` 进一步锚定。

## 4. Entry：一条可以独立维护、检索和引用的知识

### 4.1 Entry 的字段

Memory Entry 可以抽象成下面的结构：

| 字段                 | 含义                                         |
| -------------------- | -------------------------------------------- |
| `entry_id`         | 逻辑条目的稳定身份                           |
| `entry_version_id` | 这条内容的具体版本身份                       |
| `version`          | 条目自身的递增版本号                         |
| `kind`             | `decision`、`constraint` 等业务分类      |
| `text`             | 可检索的正文                                 |
| `state`            | `active` 或 `inactive`                   |
| `citation`         | 指向 Memory revision 和 Entry 版本的精确引用 |

`kind` 是帮助应用组织内容的标签；真正用于检索和阅读的是 `text`。一条 Entry 应该尽量表达一个可以单独判断、单独修改的事实或规则，而不是把整个项目历史揉成一段大摘要。

### 4.2 写入与检索

显式写入不需要模型：

```python
from powercontext.http import RememberMemoryRequest

saved = await client.remember_memory(
    RememberMemoryRequest(
        scope_id=scope_id,
        kind="decision",
        text="amount: 订单金额以整数分存储；100 表示 1 元。",
        reason="团队确认的金额存储约定",
    )
)
citation = saved.entry.citation
```

随后按主题搜索：

```python
from powercontext.http import SearchMemoryRequest

result = await client.search_memory(
    SearchMemoryRequest(scope_id=scope_id, query="amount", mode="fts")
)
for hit in result.hits:
    print(hit.text, hit.citation)
```

前四篇使用 FTS 主题词来观察行为：`search_memory` 回答“当前有哪些相关条目”，而不是直接返回整份 Artifact。向量或混合检索可以是部署能力，但不改变 Scope、Artifact、Entry 的身份关系。

### 4.3 修订、冲突和停用

修改条目时要把读取时拿到的 `citation` 一起交给服务端：

```python
from powercontext.http import ReviseMemoryEntryRequest

revised = await client.revise_memory_entry(
    ReviseMemoryEntryRequest(
        scope_id=scope_id,
        citation=citation,
        kind="decision",
        text="amount: 订单金额以整数分存储；转换时使用 Decimal。",
        reason="补充输入转换规则",
    )
)
```

服务端会检查 citation 是否仍指向当前可修改版本。如果另一位调用者已经先改过，旧 citation 会触发 `409` 冲突。正确做法是重新读取当前条目，再决定是否合并或覆盖；不要用旧版本静默覆盖新版本。

不再适用的条目使用 `retire_memory_entry`：

```python
from powercontext.http import RetireMemoryEntryRequest

await client.retire_memory_entry(
    RetireMemoryEntryRequest(
        scope_id=scope_id,
        citation=revised.entry.citation,
        reason="项目已改用流式导入",
    )
)
```

停用会让 Entry 退出 active recall，但不会物理删除历史。当前搜索和历史精确读取因此可以回答不同问题：一个回答“现在应该用什么”，另一个回答“当时记录了什么”。

![Entry 与 Artifact 的生命周期](image/powercontext-data-model_20260926193000/02-entry-lifecycle.svg)

## 5. Citation：像书签一样固定一处内容

可以把 `citation` 想成一本书里的书签。书签不是把整页内容再抄一遍，而是记住“哪本书、哪一版、哪一页”；以后书的新版出版了，旧书签仍然能带你回到原来的位置。

Memory citation 也做同样的事。它至少包含三部分：

```text
memory_ref = (family="memory", artifact_id="...", revision=3)  # 哪一份制品的哪一版
entry_id = "..."                                                    # 制品中的哪条知识
entry_version_id = "..."                                           # 这条知识的哪一版
```

只保存一段文本就像只记住书上的一句话：文本可能重复，内容可能被修订，当前版本也可能已经变化。保存 citation，才能准确回答“我当时看到的是哪一版”。

这个书签有三种常见用法：

1. Agent 或应用保存一条知识后，保留服务端返回的 citation。
2. 修改条目时，把最近读到的 citation 一起提交；如果书已经被别人翻到新版本，服务端就能发现旧书签并返回版本冲突。
3. 需要解释、审计或交接时，使用 citation 读取原来的 Artifact revision，而不是误把当前 head 当成当时的内容。

所以可以这样记：

```text
citation：我引用了哪一本“书”的哪一版、哪一页？
lineage：这一本“书”的这一版，是根据哪些材料整理出来的？
```

## 6. PreparedContext：给一次 Agent turn 的临时上下文

### 6.1 为什么还需要一个新对象

搜索命中不是最终 Prompt。应用还要决定：

- 本次问题是什么；
- 要从哪个 Scope 取；
- 最多给模型多少内容；
- 没有命中时如何继续；
- 如何把正文和引用放进消息。

`PreparedContext` 就是这一步的结果。它是临时值，不会因为生成了一次上下文，就自动创建新的长期 Memory。

![PreparedContext 生成流程](image/powercontext-data-model_20260926193000/04-prepared-context-flow.svg)

### 6.2 请求与响应

```python
from powercontext.http import PrepareContextRequest

prepared = await client.prepare_context(
    PrepareContextRequest(
        scope_id=scope_id,
        query="amount 字段应该怎样解析和验证？",
        max_bytes=2500,
    )
)

if prepared.status == "ready":
    context_text = prepared.content
else:  # empty
    context_text = None
```

响应有四个重要部分：

| 字段              | 含义                                 |
| ----------------- | ------------------------------------ |
| `schema`        | PreparedContext 的协议版本           |
| `status`        | `ready` 或 `empty`               |
| `content`       | 可直接注入的文本；空结果时为`null` |
| `content_bytes` | `content` 的 UTF-8 字节数          |

`max_bytes` 限制的是完整输出的 UTF-8 字节数。空间不足时，服务端可能缩短正文或跳过条目；调用方应检查实际字节数并原样使用返回正文。

没有相关历史时，`empty` 是正常业务结果，不代表请求失败：

```text
status = "empty"
content = null
content_bytes = 0
```

### 6.3 放进 Agent 消息的推荐位置

PreparedContext 是历史材料，不是新的系统指令。一个清晰的消息编排是：

```python
messages = [
    {
        "role": "system",
        "content": "你正在协助开发订单导入器。历史材料需要结合当前要求和实时检查使用。",
    },
    {
        "role": "system",
        "content": prepared.content or "本次没有可用的历史材料。",
    },
    {"role": "user", "content": "amount 字段应该怎样解析和验证？"},
]
```

这样做有三个好处：历史与当前问题分层；模型能看到引用和边界；空结果不会被误当成异常而中断 Agent 流程。最终是否使用了材料，还需要观察真实模型请求和输出，不能只凭 `status == "ready"` 推断。

## 7. 一条完整的最小闭环

把四个对象串起来，可以得到下面的应用流程：

```python
# 1. 创建并保存 Scope
scope = await client.create_scope(
    CreateScopeRequest(
        title="订单导入器",
        summary="项目规则",
        idempotency_key="orders-v1",
    )
)

# 2. 在 Scope 内保存一条 Entry（服务端维护 memory Artifact）
saved = await client.remember_memory(
    RememberMemoryRequest(
        scope_id=scope.scope_id,
        kind="constraint",
        text="amount: 金额使用整数分，禁止用二进制浮点数累计。",
        reason="代码评审结论",
    )
)

# 3. 新会话按当前问题准备有界上下文
prepared = await client.prepare_context(
    PrepareContextRequest(
        scope_id=scope.scope_id,
        query="amount",
        max_bytes=2500,
    )
)

# 4. 只有准备成功才把正文放入 Agent 消息；保留 citation 供后续修订\nmessages = []\nif prepared.status == "ready":
    messages.append({"role": "system", "content": prepared.content})
```
