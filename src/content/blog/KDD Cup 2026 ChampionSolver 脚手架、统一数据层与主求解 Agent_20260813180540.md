---
title: "KDD Cup 2026 Champion：Solver 脚手架、统一数据层与主求解 Agent"
date: "2026-08-13T18:05:40+08:00"
updated: "2026-08-13T18:24:53+08:00"
description: "当前项目通过两层架构优化求解过程，脚手架与统一数据层确保稳定执行环境，Solver Agent 专注于语义决策，最终生成结构化结果 `prediction.csv`。"
draft: false
categories:
  - "笔记"
tags:
  - "agent"
  - "kddcup"
---

在这世间有一个被称为你的奇迹 让这黑白两色的世界变得五彩斑斓 
<!-- more -->

> 文档性质：当前实现说明、设计拆解与真实任务验证
>
> 代码核对日期：2026-08-12
>
> 适用链路：`doc_prepare → solver scaffold → datasource runtime → Solver Agent`

## 1. 这两层解决什么问题

前置模块已经把视频、文档和结构化表整理成可用证据，但这些证据还没有变成最终答案。当前项目把后续求解拆成两层：

1. 脚手架与统一数据层先建立稳定的执行环境；
2. Solver Agent 再理解题意、选择字段、确定统计口径并补全 SQL。

![从任务材料到主求解 Agent](<image/KDD Cup 2026 ChampionSolver 脚手架、统一数据层与主求解 Agent_20260813180540/overview.svg>)

两层的边界很清楚：基础设施负责“数据如何统一查询、程序如何保存结果”，Solver Agent 负责“题目究竟要查什么”。

| 层次               | 回答的问题                                 | 主要输入                          | 主要产物                         |
| ------------------ | ------------------------------------------ | --------------------------------- | -------------------------------- |
| 脚手架与统一数据层 | 不同格式的数据怎样进入同一个可执行环境？   | `context/`、`task.json`       | `workdir/solver.py`、DuckDB 表 |
| Solver Agent       | 应选哪些表和字段，采用什么行集与统计口径？ | question、Knowledge、视频、表描述 | 写入`solver.py` 的查询逻辑     |

最终答案来自：

```text
Solver Agent 修改 solver.py
        ↓
solver.py 执行 SQL
        ↓
workdir/prediction.csv
```

## 2. `solver.py` 脚手架：先固定不会随题目变化的部分

### 2.1 为什么先生成脚手架

Solver 最终必须交付一份结构正确的 `prediction.csv`。如果让 Agent 从空文件开始编写程序，它不仅要理解题目，还要同时处理数据加载、运行路径、查询环境和结果保存。

这些工程步骤在不同题目之间基本不变，却容易成为失败来源。因此，Champion 方案在 Solver 开始推理前，先为每道题生成一份可执行但尚未完成的程序：

```text
<task>/workdir/solver.py
```

脚手架的核心思想是：**把确定性的执行协议提前固化，只把必须依赖题意判断的部分留给 Agent。**

生成发生在 `doc_prepare` 之后。文档抽取表已经写入 `context/db/`，脚手架第一次扫描数据时就能把它们和原始 CSV、JSON、SQLite 一起纳入查询环境。

### 2.2 脚手架的主要区块

![solver.py 脚手架的固定区块](<image/KDD Cup 2026 ChampionSolver 脚手架、统一数据层与主求解 Agent_20260813180540/scaffold-anatomy.svg>)

生成后的脚本很薄，核心结构如下：

```python
## import区
from tools_v2.datasource_runtime import build_datasource_state, run_sql as _run_sql

##输入输出路径
input_base = Path('./context')
output_base = Path('./workdir')

## 建立统一查询环境
_state = build_datasource_state(Path('.').resolve())

def run_sql(query):
    return _run_sql(_state, query)

## 进行查询区：agent只改这里
result = None

## 保存预测结果
pred_df = result
if pred_df is None:
    print('[solver] 查询尚未实现 (result is None) ...')
else:
    pred_df.to_csv(output_base / 'prediction.csv', index=False)
```

`result=None` 是一种明确的未完成状态：脚本可以正常退出，但不会生成空 CSV。后续能据此返回 `NO OUTPUT`，而不是把空文件误认为答案。

## 3. 统一数据层：让 Agent 面对表，而不是文件

一道任务的上下文同时包含 CSV、JSON、SQLite，以及由文档预处理得到的结构化数据库。如果让 Solver 分别理解每种格式，它不仅要判断“题目要查什么”，还要反复处理文件读取、表名映射和 SQL 方言差异。

Champion 方案在两者之间增加了一层统一数据运行时：

```text
异构文件
   ↓
格式适配与关系化
   ↓
具有稳定名称的 DuckDB 逻辑表
   ↓
统一 SQL 查询
```

这一层的核心思想是：**先消除数据载体的差异，再把语义推理交给 Agent。**

统一完成后，Solver 不再关心数据来自 CSV、JSON 还是 SQLite。它看到的都是可以通过 DuckDB SQL 查询的关系表。

### 3.1 从不同文件到同一种关系表

![CSV、JSON 与 SQLite 的统一注册](<image/KDD Cup 2026 ChampionSolver 脚手架、统一数据层与主求解 Agent_20260813180540/unified-data-layer.svg>)

三类数据使用不同的适配方式，但最终都进入同一个关系查询空间：

| 数据来源 | 适配方式                           | 统一后的形态 |
| -------- | ---------------------------------- | ------------ |
| CSV      | 由 DuckDB 直接读取                 | 逻辑表       |
| JSON     | 将`records` 转成二维表           | 逻辑表       |
| SQLite   | 只读挂载数据库，并映射其中的物理表 | 逻辑表       |

三种路径虽然实现不同，但对上层暴露的是同一种能力：

```sql
SELECT ...
FROM <table>
WHERE ...
GROUP BY ...
```

这意味着格式差异被限制在数据层内部。后续的表探查、关联、过滤和聚合都使用同一种 SQL 语义。

Markdown、PDF 和视频本身不是关系数据，因此不会直接进入这一层。它们需要先在上游提取为结构化表；例如，文档经过 `doc_prepare` 转成 SQLite 后，就可以和原始数据库使用完全相同的查询方式。

### 3.2 用稳定表名建立统一数据空间

仅仅让所有数据“能被 SQL 查询”还不够。Agent 还需要一个稳定、无歧义的名称来引用每张表。

因此，每张数据表都会获得一个 canonical 表名。生成过程遵循确定性规则：

- 保留中文、字母、数字和下划线；
- 将空格、标点和括号等字符替换为下划线；
- 对数字开头的名称增加合法前缀；
- 对同名表增加来源前缀，避免引用歧义。

例如：

```text
Members.csv          → members
2024 Sales.csv       → t_2024_sales
公司名单(最终).csv   → 公司名单_最终_
```

项目还为表保留必要的兼容别名，使 Agent 在表描述、数据探查和最终脚本中能够使用一致的名称。

这里的重点不是重命名本身，而是建立一个稳定映射：

```text
原始数据源 → 唯一逻辑表 → SQL 中的稳定引用
```

只要这条映射保持一致，Agent 就不需要在每次查询时重新判断“这个文件应该叫什么”。

### 3.3 只修复确定性错误，不替 Agent 猜语义

模型生成 SQL 时，容易混入其他数据库的语法。例如，它可能使用 MySQL 的反引号、SQL Server 的方括号，或者在中文列名中多写一个空格。

统一数据层会在执行边界进行两类确定性归一：

1. 将反引号和表示标识符的方括号转换为 DuckDB 使用的双引号；
2. 当一个列名忽略空格后能够唯一对应真实列名时，将其恢复为真实写法。

例如：

```sql
SELECT `在任基金数 (只)` FROM [基金经理]
```

会被归一为：

```sql
SELECT "在任基金数(只)" FROM "基金经理"
```

这种处理有一个重要边界：**它只修复能够被确定判断的形式错误，不进行语义模糊匹配。**

如果一个错误列名没有候选，或者可能对应多个真实列，程序不会擅自改写。字符串内容和 DuckDB 的列表索引也不会被当成列名处理。

因此，这一层承担的是语法适配，而不是业务推理。诸如“哪个字段表示有效用户”“两个表应该如何关联”等问题，仍然由 Solver Agent 判断。

## 4. Solver Agent：在稳定工作台上做语义决策

脚手架和统一数据层准备完成后，主流程为每道题创建一个独立的 Solver Agent：

```python
build_solver_agent(task_dir, model=MODEL)
```

Solver 接管前置模块已经整理好的任务现场。它只围绕一个目标工作：**理解题目要求，把语义口径写成可执行 SQL，并生成 `prediction.csv`。**

![Solver Agent 在主流程中的位置](<image/KDD Cup 2026 ChampionSolver 脚手架、统一数据层与主求解 Agent_20260813180540/solver-orchestration.svg>)

### 4.1 一次 Solver 运行如何展开

Solver 采用单 Agent 的多轮工具调用方式。外层程序只负责启动和验收，具体先查哪张表、何时修改 SQL、失败后回到哪一步，由 Solver 根据当前证据决定。

一次典型运行包含以下步骤：

1. **建立任务认知。** 首轮 Prompt 给出 question、业务知识、视频证据、候选数据表和输出规则。Solver 先判断题目要的是原始记录、实体名单还是聚合结果。
2. **探查并验证数据。** Solver 查看已注册表和 schema，再执行只读 SQL，确认字段含义、筛选结果、重复粒度、Join 基数和预期行数。
3. **形成可执行口径。** 当目标列、过滤条件、去重或聚合规则已经明确后，Solver 读取预生成的 `solver.py`。
4. **写入查询。** Solver 将口径说明和最终 SQL 写入脚本的查询区，不改动数据加载与结果保存协议。
5. **运行并自检。** Solver 执行脚本，查看 `prediction.csv` 的行列数、非空数和样例值。
6. **根据反馈继续或停止。** SQL 报错时回到脚本修改；输出能运行但语义可疑时回到数据探查；只有认为结果已经满足题意时才结束本次 Agent 运行。

![Solver Agent 多轮求解闭环](<image/KDD Cup 2026 ChampionSolver 脚手架、统一数据层与主求解 Agent_20260813180540/solver-react-loop.svg>)

例如，简单题可能查看一次 schema 后直接写 SQL；复杂题可能在数据探查和脚本修改之间往返多次。稳定的是四类动作及其验证闭环，而不是每个工具必须调用一次。当交互变长时，上下文管理会压缩较早过程并保留关键结论，使当前口径和最新工具反馈继续留在求解上下文中。

### 4.2 四个工具如何组成求解闭环

Solver 的行动被收敛为四个专用工具。它们分别对应“查清数据、读取工作台、实现查询、验证产出”，工具返回会进入下一轮上下文，成为 Solver 决定下一步的依据。

| 工具             | 接收什么                                     | 返回什么                                           | 在流程中的作用                                              |
| ---------------- | -------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| `explore_data` | `\\tables`、`\\schema <表名>` 或只读 SQL | 表清单、字段与样例、查询总行数和结果行             | 找候选表，并用真实数据验证字段、过滤、去重、Join 与聚合口径 |
| `read_solver`  | 读取位置和行数                               | 带“行号 + 行 hash”的`solver.py` 内容           | 看清脚手架查询区，并取得安全编辑所需的定位信息              |
| `edit_solver`  | 起止行号、行 hash 和新内容                   | 编辑摘要及修改后附近的新 hash                      | 把口径注释和 SQL 写入唯一允许修改的脚本；语法错误时拒绝落盘 |
| `run_solver`   | 自检开关、展示行数和超时                     | `FAILED`、`NO OUTPUT` 或 `OK`，以及 CSV 自检 | 执行最终脚本，并把运行错误或结果形态反馈给 Solver           |

四个工具之间的反馈闭环：

```text
explore_data：验证“应该怎么算”
        ↓
read_solver / edit_solver：把口径固化为 SQL
        ↓
run_solver：验证“是否执行成功、输出是否像答案”
        ├─ SQL 或脚本错误 → edit_solver 修正
        ├─ 行数、NULL、样例不符合题意 → explore_data 重新核对
        └─ 结果合理 → 结束本次 Agent 运行
```

`explore_data` 与 `solver.py` 共用统一数据运行时，因此探查阶段验证过的表名、列名和 DuckDB SQL 可以直接迁移到最终脚本。`edit_solver` 只修改 `workdir/solver.py`，`run_solver` 也只执行这一个脚本；这种限制把 Agent 的自由度集中在业务查询本身。

### 4.3 首轮 Prompt：Solver 收到三层上下文

![Solver Agent 输入装配](<image/KDD Cup 2026 ChampionSolver 脚手架、统一数据层与主求解 Agent_20260813180540/solver-input-assembly.svg>)

Solver 的 Prompt按“共同求解规则—当前题业务口径—当前题证据”分层装配。确定性规则在所有题目中保持一致，与题目有关的知识和数据则动态注入。让 Solver 先获得稳定的决策准则，再在当前题的证据范围内做语义判断。

#### 4.3.1 三层 Prompt 各自解决什么问题

| 层次                    | 拼接的主要信息                                                                                              | Solver 用它决定什么                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 静态 system instruction | 当前任务目录树、输出协议、三类题型、字段匹配原则、NULL/去重/并列规则、视频证据优先级、DuckDB 规则和工具边界 | 用什么准则解题，结果应以什么形式交付               |
| 任务级 instructions     | `knowledge.md` 全文、视频解读规则、`video_result_agent` 的候选答案、关键帧和置信度                      | 当前题中的概念、字段、单位、阈值和时间口径如何解释 |
| user input              | 视频时间轴、context 数据概览、文档抽取表说明、question 和脚手架提示                                         | 当前题有哪些证据可用，具体要产出什么结果           |

第一层规定求解方法。它要求 Solver 先判断答案的行集粒度，再确定字段、过滤、聚合、去重和 NULL 处理；同时规定最终结果必须由 `solver.py` 生成 `prediction.csv`，自然语言回复不是答案。

第二层提供业务语义。`knowledge.md` 以全文形式注入，用来解释字段含义、指标单位和业务规则。如果存在视频，还会附加视频证据的使用规则，以及前置 Agent 对“视频是否已直接展示答案”的判断。

第三层交付任务现场。context 描述会列出数据表的字段、类型和少量样例，帮助 Solver 定位候选表；它不是完整数据，实际行数、重复分布、Join 基数和过滤结果仍需要后续通过 SQL 探查确认。

#### 4.3.2 动态注入内容示例

Prompt 模板中的 `{...}` 表示按当前任务动态注入的内容。`knowledge.md` 直接注入全文，其余自动生成内容的形态如下。

| 占位符                                                      | 如何生成                                             |
| ----------------------------------------------------------- | ---------------------------------------------------- |
| `{dir_tree}`                                              | 扫描当前任务的目录与文件                             |
| `{video_result_hint}`                                     | `video_result_agent` 对当前视频投票判断后渲染      |
| `{frame_image}` / `{hiccup_layout}` / `{asr_segment}` | 对视频抽帧、识别版面、转写语音并按时间轴对齐         |
| `{context_descriptions}`                                  | 扫描 CSV、JSON 和 SQLite；结合表相关性结果折叠无关表 |
| `{doc_table_hints}`                                       | 根据文档抽取生成的 SQLite 表渲染                     |
| `{question}`                                              | 读取`task.json` 的 `question` 字段               |

`{dir_tree}` 的完整形态大致如下：

```text
./
├── context/
│   ├── csv/
│   │   └── lc_freefloat.csv
│   ├── db/
│   │   └── sub_db.sqlite
│   └── knowledge.md
├── workdir/
│   └── solver.py
└── task.json
```

`{context_descriptions}` 中一张表的描述大致如下：

```text
[CSV] context/csv/lc_exgindustry.csv
  rows: 475    columns: 9
  columns:
  - CompanyCode         type=int   nullable=N  e.g. '44'
  - SecuCode            type=int   nullable=N  e.g. '000021'
  - SecondIndustryName  type=str   nullable=N  e.g. '计算机、通信和其他电子设备制造业'
  sample rows: ...
```

对于被 `table_relevance_agent` 判为无关的表，不再展开全部字段和样例，只保留一条存在性提示。Solver 后续仍可通过 `explore_data` 查询它。

`{video_result_hint}` 大致如下：

```text
- 判定：视频面板已直接显示最终答案，建议采纳后低成本复核。
- 候选答案：[[...], [...]]
- 目标输出列：[...]
- 关键帧：[slide_06, slide_07]
- 置信度：high
- 说明：该结论仅供参考，Solver 拥有最终决定权。
```

`{doc_table_hints}` 大致如下：

```text
- 表 `lc_sharetransfer` ← `doc/lc_sharetransfer.md`
  (rows=128, context/db/lc_sharetransfer.db)
  业务列, primary_key=record_id: secucode, sum_before_tran, pct_before_tran
```

#### 4.3.3 整体 Prompt 模板

忽略底层消息对象和工具 schema 的序列化细节，首次 Prompt 可以抽象为以下模板：

```text
[System instruction：固定求解规则]

你是数据分析 Solver。你的目标是补全 solver.py，
使用 SQL 分析当前任务的数据，并生成 prediction.csv。

当前任务目录：
{dir_tree}

解题要求：
1. 先判断答案是原始记录、实体名单还是聚合统计。
2. 明确目标列、字段语义、过滤条件、时间口径和行集粒度。
3. 字段按单位、周期和业务定义匹配，不得仅凭名称相似替代。
4. 原始记录默认保留重复值和 NULL；实体名单按实体语义判断去重。
5. 视频图像和版面信息优先于 ASR。
6. 最终结果以 prediction.csv 为准。

SQL 与工具边界：
- 使用脚手架提供的 run_sql 执行 DuckDB SQL，不用 pandas 进行表关联。
- 数据探查统一通过 explore_data 完成，只允许只读查询。
- 只能读取和修改 workdir/solver.py，不能任意浏览或改写其他文件。
- 完成查询后运行 solver.py，检查 prediction.csv 的行列数、非空数和样例值。


[Task instructions：当前题业务口径]

knowledge.md：
{knowledge_md}

固定视频解读规则：
1. 图像帧和 hiccup 版面树是主要证据，ASR 只作辅助；两者冲突时以画面为准。
2. 配置面板中的字段、运算符和阈值三元组直接决定 SQL 过滤条件，不得擅自改变运算符。
3. 配置面板中的阈值被遮挡时，从已纳入与未纳入的边界样本帧中复原阈值。
4. ASR 中的数字、字段名和批次号可能识别错误，不应单独作为口径依据。

视频答案预判（可选，仅供参考）：
{video_result_hint}


[User input：当前题证据与任务]

视频证据（可选，按时间轴交错）：
{frame_image}
{hiccup_layout}
{asr_segment}
...

当前数据源概览：
{context_descriptions}

文档抽取表（可选）：
{doc_table_hints}

任务问题：
{question}

solver.py 已生成。请先探查数据并确定口径，
再补全查询逻辑，运行并检查 prediction.csv。
```

### 4.4 Solver 什么时候结束

Solver 没有一个由程序强制检查的“答案已正确”终止条件。它的生命周期分为两层：**模型决定何时结束单次 Agent 对话，外层程序决定是否停止重试。**

#### 4.4.1 单次 `agent.run()` 如何停止

正常情况下，模型每一轮可以继续调用工具，也可以返回普通文本。当模型返回最终文本且不再发起工具调用时，本次 `agent.run()` 正常结束。

```text
模型调用工具 → 框架执行工具 → 结果进入下一轮
模型返回最终文本 → 没有调用工具 → agent.run() 结束
```

Prompt 要求 Solver 在结束前运行 `run_solver` 并检查 CSV，但这是对模型的行为引导，不是框架的强制终止条件。程序没有要求模型必须调用过 `run_solver`，也没有在模型停止前判定 SQL 的业务正确性。因此，模型理论上可以提前停止。

除正常返回外，单次 `agent.run()` 还会因为以下情况结束并被外层视为失败：

- 模型请求、工具执行或 Agent 框架抛出异常；
- 本次 attempt 的模型请求数达到上限，当前上限为 80。

#### 4.4.2 外层何时停止重试

单次 `agent.run()` 结束后，外层程序不解析模型的最终文本，也不检查答案值是否正确。它只检查两个可程序化的条件：

```text
agent.run() 没有抛出异常
并且
workdir/prediction.csv 存在
```

两者同时满足时，外层接受这次 attempt，结束重试循环。这个条件可以概括为：

```text
run_ok AND prediction_file.exists()
```

只要任一条件不满足，外层就认为本次 attempt 未完成。例如：

- 模型正常返回文本，但没有生成 CSV；
- 请求超限或中途异常，即使目录中留下 CSV 也不接受。

开始下一次 attempt 前，外层会恢复最初的 `solver.py` 脚手架，并删除上一轮残留的 `prediction.csv`。这保证下一轮从干净状态开始，也防止旧 CSV 被误当作本轮产出。当前每道题最多运行五次 attempt。

![Solver Agent 的结束、重试与交付](<image/KDD Cup 2026 ChampionSolver 脚手架、统一数据层与主求解 Agent_20260813180540/solver-lifecycle.svg>)

#### 4.4.3 五次失败后的兜底与交付

五次 attempt 都未被接受后，如果当前 `solver.py` 存在但 CSV 仍不存在，外层会再直接执行一次当前脚本作为兜底。这一步不再调用 Agent。

兜底后：

- `prediction.csv` 存在：复制到当前任务的输出目录；
- `prediction.csv` 仍不存在：记录该任务未产出结果。

这个兜底只尽量保证结构化产出，同样不验证业务答案是否正确。

## 5. 真实任务如何落到脚手架中

task_15题目是：

```text
显示300707的出让前持股数量和出让前持股比例
```

真实 Solver 先读取脚手架，再查看 `lc_sharetransfer` schema，最后只替换查询区：

```python
result = run_sql("""
SELECT sum_before_tran, pct_before_tran
FROM lc_sharetransfer
WHERE secucode = '300707'
""")
```

`secucode` 用于定位记录，但题目没有要求输出证券代码，因此结果只保留两个目标列。Solver 将其判断为原始记录题，没有自行增加 `DISTINCT`、NULL 过滤、排序或 LIMIT。

## 6. 一句话总结

当前 Champion 方案先用薄脚手架和共享 DuckDB 运行时固定数据发现、表名、SQL 方言与结果保存，再让按任务创建的 Solver Agent 专注于题型判断、字段语义、过滤、去重和聚合。LLM 负责不确定的业务决策，确定性程序负责数据执行与结构化交付，最终以 `prediction.csv` 而不是自然语言回复作为求解结果。
