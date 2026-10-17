---
title: "Skill：PowerContext怎样把经验变成可交付的操作方法"
date: "2026-10-17T10:15:24+08:00"
updated: "2026-10-17T10:17:06+08:00"
description: "PowerContext 的 Skill 功能将经验转化为可操作的技能包，提供明确的操作步骤和验证要求，帮助 Agent 在遇到类似问题时高效处理。通过整理和审核，Skill 确保了经验的可复用性和适用性。"
draft: false
categories:
  - "笔记"
tags:
  - "oceanbase"
  - "agent"
---

<!-- more -->

# Skill：PowerContext 怎样把经验变成可交付的操作方法

一份 Experience 记录“遇到了什么、怎样处理、结果如何、有什么教训”。下一次做相似任务时，Agent 还需要知道：从哪里开始，按什么步骤做，做完怎样检查。

PowerContext 的 **Skill（技能）** 把有依据的做法整理成操作说明，通过审核形成正式版本，再以技能包的形式交给 Agent 使用。

本文承接《Experience：PowerContext 怎样把一次实践变成可复用经验》，继续使用“订单 CSV 导入器的金额精度问题”。金额规则、任务记录和 ID 均为教学示例。

## 1. 已经有 Experience，为什么还需要 Skill？

假设我们已经保存了一份经验：金额文本先经过 float，换算为整数分时出现误差；改为从原始文本解析 Decimal 后，原失败输入得到了预期结果。

Experience 帮助后来的人理解这次实践。Skill 则进一步整理出可以采用的操作方法：

1. 找到金额文本进入计算流程的位置。
2. 检查是否先转换成了 float。
3. 如果是，改为从原始文本直接解析 Decimal。
4. 重新运行原失败用例，核对整数分结果。
5. 涉及额外小数位或舍入时，先确认业务规则。

| 内容       | 主要回答什么                         | 金额案例中的用途                   |
| ---------- | ------------------------------------ | ---------------------------------- |
| Experience | 当时怎样处理，观察到了什么？         | 保存修复过程、实际结果和可复用判断 |
| Skill      | 再遇到这个问题，可以怎样操作和检查？ | 提供适用条件、操作步骤和验证要求   |

**整理成 Skill 不会扩大证据的验证范围。** 只验证过一个输入，就不能写成“本方法已经覆盖所有金额场景”。Skill 需要保留原经验的适用条件与尚未验证的部分。

## 2. 一份 Skill 里有什么？

理解内容时，可以先看四项：

| 字段             | 作用                     | 示例                                        |
| ---------------- | ------------------------ | ------------------------------------------- |
| `name`         | 给技能一个稳定名称       | `amount-precision-repair`                 |
| `description`  | 帮助判断什么时候适用     | 处理金额文本转换为整数分时的精度误差        |
| `instructions` | 说明怎样操作、有什么限制 | 检查 float 转换路径，从原始文本解析 Decimal |
| `validation`   | 规定怎样检查操作结果     | 核对原失败用例的整数分结果是否符合预期      |

Description 帮助 Agent 选择技能，instructions 指导具体操作，validation 则规定完成后要检查什么。实际检查是否通过，要看后续任务的执行结果。

![Experience 中的实践依据支持 Skill 的适用描述、操作说明和验证要求；验证要求需要在后续任务中实际执行](image/skill/01-experience-to-skill.svg)

Skill 使用标准技能包。根目录中的 `SKILL.md` 保存名称、描述和说明正文；包中也可以包含脚本、参考资料等配套文件：

```text
amount-precision-repair/
├── SKILL.md
├── scripts/       # 按需提供
└── references/    # 按需提供
```

 在金额案例中，`SKILL.md` 写明适用场景、转换步骤和验证要求；如果还提供检查脚本，就放进 `scripts/`，补充的金额规则说明可以放进 `references/`。

## 3. Skill Candidate 从哪里来？

在提案流程中，可以把创建入口归纳为五类。先看谁提供完整内容，再看是否需要模型：

| 入口         | 调用方提供什么                   | 程序怎样处理                 | 调用模型   |
| ------------ | -------------------------------- | ---------------------------- | ---------- |
| 直接提交     | 完整 Skill 正文与证据引用        | 校验、整理技能包，创建提案   | 否         |
| 上传技能包   | 包含 SKILL.md 的 ZIP             | 检查并保存包，创建提案       | 否         |
| 主动生成     | 选定的证据引用                   | 读取材料，让模型整理操作说明 | 是         |
| Dream 派生   | 选定的 Experience，可补充 Source | 后台组织证据并派生技能       | 是         |
| 外部技能导入 | 已发现技能的精确快照             | 保留原包，或交给模型改编     | 依模式而定 |

![自己准备内容、模型生成与外部技能导入汇入待审核 Candidate；批准后形成正式 Skill，交付是后续步骤](image/skill/02-creation-paths.svg)

**当前内置 Skill 没有像 Experience 那样定时扫描任务结果、自动孵化的流程。** 模型生成和 Dream 都先接收明确请求；Dream 在后台执行已经提交的任务。

### 自己写好，直接提交

接口是 `POST /v1/skill/propose`，请求体使用 JSON。提交方可以是人，也可以是已经整理好内容的业务程序：

```http
POST /v1/skill/propose
Content-Type: application/json

{
  "scope_id": "你的 Scope ID",
  "proposal": {
    "name": "amount-precision-repair",
    "description": "处理金额文本转换为整数分时出现的精度误差。",
    "instructions": "检查金额转换路径。如果先转换为 float，改为从原始文本直接解析 Decimal，再按项目规则转换。运行原失败用例。遇到额外小数位或舍入问题，先确认业务要求。当前证据仅验证了原失败输入。",
    "validation": [
      "核对原失败输入转换后的整数分是否与预期一致。"
    ]
  },
  "source_refs": [],
  "artifact_refs": [
    {"family": "experience", "artifact_id": "exp_01", "revision": 1}
  ],
  "target": null,
  "reason": "把已审核经验整理成可复用操作说明。"
}
```

这里的 `exp_01 @ 1` 必须是当前 Scope 中实际存在、可读取的正式经验。成功返回 HTTP 201 和 pending Candidate；保存 `candidate_id` 与 `version`，继续审核。

### 手里有 ZIP，直接上传

假设你已经在本地写好了 `SKILL.md`，还准备了金额检查脚本。把这些文件打成 ZIP 后，就可以上传给 PowerContext。ZIP 的根目录需要包含 `SKILL.md`，脚本等配套文件按包内目录组织。

上传的过程是：

```text
本地技能文件 → 打成 ZIP → 上传 → 程序检查 → 创建待审核 Candidate
```

接口是 `POST /v1/skill/package/propose`，请求体使用 JSON：

| 参数               | 通俗解释                                                      |
| ------------------ | ------------------------------------------------------------- |
| `scope_id`       | 保存到哪个 Scope                                              |
| `archive_base64` | ZIP 文件内容转换成可放进 JSON 的 Base64 字符串                |
| `reason`         | 可选，说明为什么提交这份技能                                  |
| `target`         | 可选，明确要更新的现有 Skill 精确版本；不提供时创建新技能提案 |

程序检查包结构，规范化打包形式并保存包和上传来源，保留其中的文件内容，不调用模型改写。

成功返回 HTTP 201 和 pending Candidate。此时技能包已经保存，可以读取提案并审核；批准后才形成正式 Skill Revision。

### 技能已经在 Agent 目录里，从那里导入

假设某个 Agent 的技能目录里已经有一项金额处理技能，你希望把它交给 PowerContext 管理。程序可以先发现并读取这项技能，再根据你确认的内容创建提案。

这个目录必须事先配置，并且是 **Server 所在主机能够访问的目录**。例如，Server 所在机器上的项目目录为 `/srv/project`，技能放在：

```text
/srv/project/.agents/skills/
└── amount-precision-repair/
    └── SKILL.md
```

在启动 Server 的环境中设置以下变量，将 path 替换为实际的技能根目录：

```bash
export POWERCONTEXT_SERVER_EXTERNAL_SKILLS='{
  "host_id": "workstation-1",
  "targets": [ # 多个技能目录可放在targets数组中
    {
      "target_id": "codex-project",
      "agent_kind": "codex",
      "installation_scope": "project",
      "path": "/srv/project/.agents/skills",
      "allow_managed_publish": false
    }
  ]
}'
```

| 配置项                    | 怎样填写                                                                         |
| ------------------------- | -------------------------------------------------------------------------------- |
| `host_id`               | 给 Server 所在主机一个稳定标识                                                   |
| `target_id`             | 给这处技能目录一个唯一标识                                                       |
| `agent_kind`            | Agent 类型，可选 codex 或 claude_code                                            |
| `installation_scope`    | 技能目录的用途；此处 project 表示项目级目录，与 PowerContext 的 Scope 是不同概念 |
| `path`                  | 技能根目录的绝对路径；填写 skills 这一层，不是单个技能目录或 SKILL.md            |
| `allow_managed_publish` | 是否允许 Server 向此目录发布受管技能；只做扫描和导入时保持 false 即可            |

客户端连接到这个 Server 后，用已有 Scope 扫描并查看列表：

```bash
export POWERCONTEXT_SCOPE_ID='已有的 Scope ID'
powercontext external-skill scan --scope-id "$POWERCONTEXT_SCOPE_ID"
powercontext external-skill list --scope-id "$POWERCONTEXT_SCOPE_ID"
```

程序检查配置根目录下的直接子目录，识别其中包含可读取 SKILL.md 的技能包。

扫描返回 `external_skill_id` 和 `fingerprint`，分别标识“哪项技能”和“这次发现的文件内容”。通过解析操作读取并核对这份内容后，再调用 `POST /v1/external-skills/import`，请求体使用 JSON：

| 参数                  | 通俗解释                             |
| --------------------- | ------------------------------------ |
| `scope_id`          | 导入到哪个 Scope                     |
| `external_skill_id` | 选择扫描发现的哪项技能               |
| `fingerprint`       | 确认使用的是刚刚查看过的那份文件内容 |
| `mode`              | 选择保留原包，还是请模型改编         |
| `reason`            | 可选，说明为什么导入或改编           |

Fingerprint 可以理解为文件内容的指纹。如果查看之后文件又被修改，程序会发现指纹不一致；需要重新扫描和查看，确认准备导入的内容。

`mode` 决定后续怎样处理：

- `import`：保留捕获的技能包内容，直接创建 pending Candidate，不调用模型。
- `fork`：把捕获的技能作为材料，调用模型整理出一份新的技能提案；如果没有值得生成的内容，也可以返回 `no_op`，不创建 Candidate。

外部导入接口成功返回 HTTP 200。有提案时，结果包含 pending Candidate，接下来读取并审核。扫描和查看只是发现材料，提交导入才会把选定材料保存下来并进入后续处理。

从目录配置到提案审核，完整流程如下。重点看两个分支：文件是否变化，以及选择保留原包还是交给模型改编。

![外部技能导入流程：配置目录、扫描列出技能，提交时核对指纹；文件变化则重新扫描，一致则保存快照。import 保留原包，fork 调用模型，有有效提案时进入审核，无提案时返回 no_op](image/skill/09-external-import.svg)

下面继续展开主动生成和 Dream，看看调用方选定的证据怎样交给模型整理。

## 4. 主动生成：材料怎样变成操作方法？

先选好 `experience / exp_01 @ 1`，再调用 `POST /v1/skill/generate`。服务端需要配置生成模型并启用 Skill 生成能力：

```http
POST /v1/skill/generate
Content-Type: application/json

{
  "scope_id": "你的 Scope ID",
  "origin": "experience",
  "source_refs": [],
  "artifact_refs": [
    {"family": "experience", "artifact_id": "exp_01", "revision": 1}
  ]
}
```

这次不提交 proposal，表达的是：“请根据这份经验，尝试整理一项技能。”

### 第一步：明确材料来源和生成目的

`origin` 区分三种用途：

| Origin         | 材料要求                                                     | 生成目的                       |
| -------------- | ------------------------------------------------------------ | ------------------------------ |
| `experience` | 一个或多个已批准 Experience，可补充 Source；不带 target      | 创建新 Skill                   |
| `source`     | 一个或多个 Source，不引用 Artifact，不带 target              | 根据操作规程等来源创建新 Skill |
| `usage`      | 使用结果 Source，以及位于 Artifact 证据中的精确 Skill target | 更新已有 Skill                 |

### 第二步：程序读取选定记录

引用只是地址，模型需要看到实际内容。程序在当前 Scope 中解析引用，读取 Source 或 Artifact，再给材料标上编号，例如：

```text
材料编号：artifact:experience/exp_01@1
材料内容：这份 Experience 的正文及相关记录
```

当前输入最多 32 项材料，每项最多取前 64,000 个字符，超出时标记截断。

更新已有 Skill 时，程序还会标明哪一项材料就是 target。这样模型能区分“需要更新的技能”和“用于支持更新的新证据”。

### 第三步：模型整理方法，并保留限制

生成指令要求模型提供名称、描述、完整操作说明，以及至少一项可以观察结果的验证要求。

在金额案例中，模型把“当时改成 Decimal 后原输入通过”整理为“检查转换路径、从原始文本解析 Decimal、运行原失败用例”，这个过程生成操作说明。

材料不足以支持可复用方法时，模型可以返回 `proposal: null`。接口相应返回 `status: no_op`、`candidate: null`。

### 第四步：程序检查格式，组织技能包

有提案时，程序校验字段、名称和标准包格式，再将内容组织成 SKILL.md，计算包摘要并保存。

这一步检查“能否作为合法的 Skill 内容保存”。**操作方法是否合理、证据是否充分、是否夸大验证范围，仍需要由审核者核对**。

### 第五步：保存 Candidate 和精确依据

程序创建 pending Candidate，保存完整 proposal、选定的 Source 和 Artifact 引用，以及可选 target。成功响应是 HTTP 200，`status` 为 `pending`，`candidate` 中包含提案身份和版本。

直接生成保留调用方选定的证据集合。审核时，应逐项检查证据是否支持关键步骤；一组可追溯引用本身不能证明整份说明正确。

![选定证据经过读取、模型整理、格式校验和技能包构建，成为 pending Candidate；没有可复用内容时返回 no_op](image/skill/03-model-generation.svg)

## 5. Dream：后台从已有经验派生技能

假设你选中了几份已经审核的金额处理经验，希望把它们整理成一份操作方法，可以提交 Dream 请求。程序先返回运行编号，后台再组织证据、调用模型。

接口是 `POST /v1/scopes/{scope_id}/dream`。Scope ID 放在请求地址中，JSON 请求体里的 operation 选择 `derive_skill`：

```http
POST /v1/scopes/你的实际ScopeID/dream
Content-Type: application/json

{
  "operation": "derive_skill",
  "artifacts": [
    {"family": "experience", "artifact_id": "exp_01", "revision": 1}
  ],
  "idempotency_key": "derive-amount-skill-01"
}
```

Dream 需要服务端启用对应能力。这个操作要求选择已批准的 Experience，可补充 Source；不接受直接 Memory 条目，也不接受更新已有 Skill 的 target。

### 怎样取得提案？

提交请求后保存 `run_id`，通过 `GET /v1/scopes/{scope_id}/dream/{run_id}` 查询结果。运行成功且 `outcome: proposed` 时，结果中的 candidate 引用提供 `candidate_id` 和 `version`，接下来进入审核。

同一个 idempotency_key 搭配相同输入会返回原运行；更改输入却沿用该 key 会冲突。它用于防止重复提交意外创建多次运行。

![Dream 先建立运行，再后台组织证据和生成；只有 proposed 结果提供 Candidate 引用，其他结果保留原因](image/skill/04-dream-flow.svg)

### 与主动生成相比，只是改成后台运行了吗？

如果只看“选择 Experience，生成 Skill 提案”，两条路径完成的是同一类事情。除了等待方式，区别还在于**怎样把证据交给模型，以及怎样保留生成过程的依据**。

假设你选中了两份经验：经验 A 记录“改为 Decimal 后，原用例通过”；经验 B 总结“金额应从原始文本直接解析 Decimal”。它们都来自同一次金额检查。

主动生成会读取你选中的两份记录，将正文及其中已有的信息交给模型。Dream 则进一步解析来源，把“这两份经验共享同一次检查”这层关系整理进输入。这样模型更有条件判断：两份经验可能是同一次结果的不同整理，不能据此当作两次独立验证。

![Dream 保留经验之间的共同来源关系：同一次金额检查支撑经验 A 的修复结果和经验 B 的操作建议，两份经验对应一次验证](image/skill/10-generation-vs-dream.svg)

## 6. 审核通过后，留下什么？

审核 Skill 时，先看适用场景是否明确，再看步骤能否执行、验证能否观察结果，最后沿精确引用核对依据。包里有脚本或参考文件时，也应检查这些实际内容。

Candidate 修订提交完整替代内容，每次追加新的 version。批准时携带自己检查过的 `expected_version`；更新已有 Skill 时，还要确认 target 仍是当前正式版本。

正式版本保存技能包和精确 lineage。假设它依据 `exp_01 @ 1`，后来经验变成 `exp_01 @ 2`，原 Skill 仍然保留第 1 版引用。是否采用新增经验，需要在后续更新中判断。

如果 target 已过期，应读取当前正式版本，协调内容，再创建针对新 target 的提案；同一 Candidate 内不能直接更换 target。

**批准完成的是正式内容的提交。** 接下来还要把所选 Skill Revision 交付到 Agent 能读取的位置。

## 7. 怎样把 Skill 送到 Agent？

先区分三个位置：PowerContext 保存正式版本，Agent 的技能目录保存交付文件，任务上下文中则包含 Agent 本次实际读取的内容。

managed Skill 不进入 Experience 所用的 PreparedContext 召回路径。可以精确读取 Skill，也可以导出或发布标准技能包，供宿主发现和使用。

![导出由客户端写入本机目录，本机受管发布由 Server 写入配置目录，远程分发由 Receiver 下载后写入 Agent 机器](image/skill/05-delivery-options.svg)

### 导出：自己领取一个版本

下面假设 Skill 名称为 amount-precision-repair，Scope 和 Artifact ID 已替换为实际值，客户端也已配置 Server 连接与认证：

```bash
powercontext skill export \
  --target codex \
  --scope-id "$POWERCONTEXT_SCOPE_ID" \
  --revision 1 \
  --destination .agents/skills/amount-precision-repair \
  skill_01
```

客户端读取第 1 版，下载并核对技能包，写入运行这条命令的机器。目标目录名需要与 Skill name 一致；已有目录会被拒绝覆盖。当前支持 Codex 和 Claude Code 目标，目录位置按宿主要求选择。

导出目录是指定版本的副本。以后正式版本前进，文件仍停留在导出时的内容，需要另行处理更新。

### 本机受管发布：记录安装版本，按请求更新

假设 PowerContext Server 和 Agent 在同一台机器上，Agent 从项目的 `.agents/skills` 目录读取技能。你可以请求 Server 把某个已批准的 Skill 版本发布到这个目录。

**每次发布都要明确选择版本和目的地。新版 Skill 获批后，需要再次发起发布，才会更新目录里的文件。** 例如：

1. 请求把 `skill_01 @ 1` 发布到项目技能目录，程序写入文件并记录这次发布。
2. 后来 `skill_01 @ 2` 获批，项目目录里仍然保留第 1 版。
3. 再请求向同一目录发布第 2 版，程序检查本地文件，通过检查后更新。

“受管”指的是程序保存了发布关系：**哪个 Skill 的哪一版，写到了哪个目录，以及当时文件的内容摘要。** 下次更新或撤下时，就能核对目录里的文件是否仍是它上次发布的那一份。

如果文件没有变化，可以按请求更新；如果你手动修改了 SKILL.md，程序会报告本地变化；如果目标目录被其他内容占用，则报告冲突。这样可以避免更新时直接覆盖本地修改或其他技能。

如果 Server 在远程服务器上，这种发布写入的是服务器上的目录。需要交付到你的笔记本时，使用下一节的远程分发。

### 远程分发：管理员维护清单，使用者同步到本机

假设管理员管理着 PowerContext Server，使用者在另一台机器上运行 Agent。管理员希望把几项技能交给使用者，可以先创建一个远程 target，再向它发布指定版本的技能。

**可以把 target 对应的发布记录理解为一份“技能配送清单”。** 例如，管理员为“使用者的订单项目”登记一个 target，然后发布两项技能：

```text
使用者的订单项目（target）
├── 金额转换技能：第 2 版
└── CSV 检查技能：第 1 版
```

清单记录这个目的地应该安装哪些技能、各自是哪一版；技能包本身由 Server 保存。使用者将本机接收程序与这个 target 关联后，就能同步清单中的技能。

![管理员创建 target 并维护其中指定版本的技能交付清单；使用者登记 Receiver，运行同步将清单中的技能安装到本地 Agent 目录](image/skill/11-remote-roles.svg)

**管理员负责维护清单。** 管理员拥有对应 Scope 的管理权限，创建 target 后，通过发布操作指定其中的技能及其版本；需要升级时，再向同一 target 发布新版。

**使用者负责在本机接收。** 使用者安装 PowerContext 客户端，输入登记码并指定本地项目路径，完成 Receiver（接收程序）的登记。Receiver 负责从 Server 查询清单、下载技能包、检查和安装文件，并回报结果。

**同步跟随管理员发布的清单。** 某个 Skill 的新版获批后，管理员需要明确发布新版，接收端下次同步才会尝试更新；本地文件被手动修改时，程序会报告变化或冲突。

## 8. 送达以后，怎样使用和记录结果？

技能文件到达目录后，由 Agent 的宿主发现和加载。名称、描述帮助判断适用性，正文指导操作；脚本或参考资料由任务按需使用。具体选择与执行行为取决于宿主、当前任务和可用工具。

PowerContext 提供 `POST /v1/skill/usage` 接收使用观察。集成程序需要实际观察并提交：

| 使用记录                          | 说明什么                                    |
| --------------------------------- | ------------------------------------------- |
| `skill_ref`、`package_digest` | 用的是哪一版、哪套文件                      |
| `target_id`                     | 发生在哪个目的地                            |
| `selected`                      | 是否被选中                                  |
| `invoked`                       | 是否观察到调用，可为 true、false 或 unknown |
| `validation`                    | 验证通过、失败或未知                        |
| `outcome`                       | 任务成功、失败或未知                        |
| `task_source`                   | 可选的相关任务材料引用                      |

## 9. 有了新反馈，怎样更新或撤下？

### 使用结果推动新的更新提案

假设真实任务暴露了舍入边界问题，并补充了检查材料，可以调用相同的生成接口，选择 `origin: usage`：

```http
POST /v1/skill/generate
Content-Type: application/json

{
  "scope_id": "你的 Scope ID",
  "origin": "usage",
  "source_refs": [
    {"name": "skill-usage", "source_id": "usage_amount_01"}
  ],
  "artifact_refs": [
    {"family": "skill", "artifact_id": "skill_01", "revision": 1}
  ],
  "target": {"family": "skill", "artifact_id": "skill_01", "revision": 1},
  "reason": "根据实际使用反馈，检查并补充适用条件与验证要求。"
}
```

usage Source 必须实际存在；具体检查材料需要时也应加入 source_refs。模型看到当前技能和新证据，尝试给出完整替代内容。记录 usage 本身不会自动触发这次生成。

审核批准后得到 `skill_01 @ 2`，然后再选择需要升级的目的地。新版获批不会自动把已导出目录或所有发布目标切换到新版。

### 本地修改怎样处理？

如果直接修改了 Agent 目录中的 SKILL.md，正式 Skill 内容不会随之改变。受管发布检查可能将它识别为 drifted。

需要保留的修改，应整理成新的完整提案或技能包，经过审核形成正式版本，再协调本地副本并更新。这样才能继续追溯“文件来自哪一版、修改依据是什么”。

## 10. 把全过程串起来

从金额精度经验出发，选择 `exp_01 @ 1`，生成 Skill Candidate，核对操作步骤和验证范围，批准为 `skill_01 @ 1`。随后将第 1 版交付到 Agent，确认安装状态，再观察具体任务中的使用与验证结果。

当新反馈值得改变操作方法时，针对当前 Skill 创建更新提案。批准得到第 2 版后，再明确把哪些目的地升级到第 2 版。

![证据经过生成与审核成为正式 Skill，明确交付后由 Agent 使用；实际使用反馈成为后续更新提案的依据](image/skill/08-skill-lifecycle.svg)

</details>

## 延伸阅读

- [创建与导出 Skill](zh/docs/workflows/create-and-export-skill.md)：生成、审核、读取和导出命令。
- [将 Skill 安装到 Agent](zh/docs/workflows/configure-agent-skill-targets.md)：本地 target 配置与远程接收边界。
- [审核 Candidate](zh/docs/workflows/review-candidates.md)：Dream 运行和审核操作。
- [Skill 内容模型](../src/powercontext/builtin/artifacts/skill/models.py)：内容字段与包引用。
- [生成服务](../src/powercontext/builtin/review/generation.py)：origin 规则、材料读取和提案提交。
- [Skill 生成指令](../src/powercontext/builtin/artifacts/skill/prompts.py)：模型需要保留的操作细节与证据边界。
- [Dream 服务](../src/powercontext/builtin/dream/service.py)：后台运行、证据组织与 Candidate 提交。
- [技能包处理](../src/powercontext/builtin/artifacts/skill/package.py)：SKILL.md 构建、包校验和摘要。
- [本机发布服务](../src/powercontext/builtin/artifacts/skill/publication.py)：受管副本检查、更新和撤下。
- [远程分发服务](../src/powercontext/builtin/artifacts/skill/distribution.py)与 [Receiver](../src/powercontext/client/skill_receiver.py)：交付要求、拉取、安装与回报。
- [Skill 使用记录](../src/powercontext/builtin/sources/skill_usage.py)：实际使用观察的数据结构。
