---
title: "APEX-SQL：Schema Linking 的规划、探索与全局细化"
date: "2026-08-23T16:22:35+08:00"
updated: "2026-08-23T16:35:05+08:00"
description: "APEX-SQL 的 Schema Linking 通过抽象逻辑计划和高召回策略，解决了从复杂数据库中提取相关表和字段的问题，确保生成的 SQL 能准确反映业务需求。"
draft: false
categories:
  - "笔记"
tags:
  - "agent"
---

来年 花也将继续盛开，春日将不厌其烦地反复到来。

<!-- more -->

> 文档性质：当前实现说明、算法拆解与真实任务贯穿示例
>
> 代码核对日期：2026-08-16
>
> 适用链路：`Evidence Linking → Schema Linking → Macro Plan → SQL Generation / Reward Selection`

## 1. Schema Linking 解决什么问题

Text-to-SQL 的第一道难题通常不是 SQL 语法，而是先在大型数据库中回答三个问题：题目涉及哪些表、需要哪些列、这些表能否连成一条可执行的关系路径。

如果直接把完整 Schema 交给 SQL Agent，它既要理解问题，又要同时排除大量无关字段；一旦漏掉时间列、主外键或桥接表，后面的 SQL 即使语法正确也无法得到正确答案。APEX-SQL 因此把 Schema Linking 独立成一个带数据库探索能力的阶段：**先形成逻辑需求，再用高召回裁剪缩小范围，通过真实 SQL 验证表的语义，最后从全局补齐连接缺口。**

![Schema Linking 在 APEX-SQL 中的位置](<image/APEX-SQLSchema Linking 的规划、探索与全局细化_20260823162235/overview.svg>)

| 阶段             | 回答的问题                                 | 主要输入                                      | 主要产物                               |
| ---------------- | ------------------------------------------ | --------------------------------------------- | -------------------------------------- |
| Evidence Linking | 外部文档中哪些知识能解释题目和字段？       | question、documents                           | `evidence`                           |
| Schema Linking   | 哪些表和列足以支撑问题，连接路径是否完整？ | question、evidence、完整 Schema、可查询数据库 | `refined_schema`、逐表判断、逻辑计划 |
| 后续求解         | 如何根据已识别的语义生成并选择 SQL？       | logical plan、tips、数据库、候选 SQL          | 最终 SQL 与结果 CSV                    |

Schema Linking 的最终目标不是追求“字段越少越好”，而是在压缩上下文的同时保持足够高的召回率。它输出的是围绕当前问题形成的关系子图：节点是相关表，边由主键、外键或可验证的同名连接列构成。

```text
完整数据库 Schema
        ↓
面向当前问题的高召回关系子图
        ↓
可支持过滤、连接、聚合和输出的字段集合
```

## 2. 整体算法：先缩小搜索空间，再从局部走向全局

主入口是 `SchemaLinking.run_schema_linking()`。一次任务按以下顺序展开：

1. 加载完整 Schema，并将相同字段结构的表分组；
2. 只依据问题生成抽象逻辑计划；
3. 用负向裁剪与正向选择缩小候选 Schema；
4. 对候选表建立一次全局语义理解；
5. 逐表生成探索 SQL，用真实执行结果判断相关性；
6. 汇总局部判断形成第一版 Schema，再对未选择字段执行增量缺口恢复；
7. 规范化表列名称，保守补充潜在连接键并保存结果。

![Schema Linking 的完整算法流水线](<image/APEX-SQLSchema Linking 的规划、探索与全局细化_20260823162235/pipeline.svg>)

这套算法包含两个层次的循环：

- **逐表探索循环**：针对单表最多探索两轮，解决“这张表实际上存了什么、是否有用”；
- **全局细化循环**：默认最多两轮，解决“所有已选字段合在一起是否完整、是否可连接”。

前者从数据内容中获得局部证据，后者从关系图角度修复局部判断的盲区。

## 3. 逻辑计划与高召回裁剪

### 3.1 先规划逻辑，不提前绑定字段

`_generate_logical_plan()` 首先只读取用户问题，不向模型展示具体表名和列名。模型需要把问题拆成过滤、连接、聚合、排序和返回结果等抽象动作。

这样设计是为了建立一个稳定的中间层：题目说的是业务语言，Schema 提供的是物理字段，逻辑计划先明确两者之间需要哪些功能角色。

```text
“找出 2017 年交易收入最高的流量来源，并计算其月度最高值与最低值之差”
        ↓
1. 限定 2017 年记录
2. 按流量来源汇总全年交易收入
3. 选择全年总收入最高的来源
4. 对该来源按月汇总交易收入
5. 计算月度最大值与最小值之差，并换算为百万
```

代码会以**较高温度**独立生成两份草稿，再以较低温度合并成 Master Logical Plan。多样采样负责降低遗漏风险，合并负责消除重复并形成稳定后续输入。

逻辑计划：

```json
{
  "logical_plan": "1. Filter sessions to 2017...\n2. Aggregate revenue by traffic source..."
}
```

### 3.2 Schema 分组与动态分批

Spider2 的完整 Schema 往往不能一次放进模型上下文。尤其是按日期、年份、地区或版本拆分的数据库，可能包含大量字段结构完全相同、只有物理表名不同的表。例如：

```text
ga_sessions_2016 ─┐
ga_sessions_2017 ─┼─ 字段集合相同 → 归入同一个结构组
ga_sessions_2018 ─┘
```

代码先用 `merge_similar_tables()` 对完整 Schema 建立结构分组。这里的“相同结构”只比较表的**字段名集合**：字段名排序后完全一致的物理表会进入同一组。

分组的目的只是让同构表作为一个完整 Schema 块进入后续 Prompt，避免反复组织相同的字段结构。

表名差异仍然会完整保留，模型也必须分别判断每个物理表。因为 `ga_sessions_2016` 与 `ga_sessions_2017` 虽然字段相同，但题目要求的年份可能决定只有其中一张表相关。

完成结构分组后，程序不会按照“每批固定多少张表”切分 Schema，而是按照 Prompt 的实际 Token 数动态装入批次：

```text
结构组 1 ─┐
结构组 2 ─┼─ 逐组加入当前批次，并重新计算完整 Prompt 的 Token 数
结构组 3 ─┘
             ↓
       达到约 8K～12K Token
             ↓
       提交当前批次，开始下一批
```

每次估算的不是 Schema 文本本身，而是包含用户问题、Master Logical Plan、Evidence、任务指令和当前 Schema 块在内的**完整裁剪 Prompt**。

8K～12K Token 是目标区间，不是要求每批必须精确落在其中：不足 8K 时程序继续加入下一个结构组；进入 8K～12K 后提交当前批次；若加入下一组会超过 12K，则先提交已经积累的内容。若单个结构组本身已经超过上限，它仍会作为独立批次处理，不会为了满足 Token 上限把同一结构组拆散。

### 3.3 双视角裁剪：删除要保守，保留要宽松

完整 Spider2 Schema 可能包含大量年份分表和业务无关字段。`_prune_schema_negative()` 不直接要求模型给出唯一正确字段集，而是同时提出两个互补问题：

- 负向裁剪：哪些表或列可以确定 100% 无关？
- 正向选择：哪些表或列明确可能参与过滤、连接、聚合或输出？

![负向裁剪与正向选择如何合并](<image/APEX-SQLSchema Linking 的规划、探索与全局细化_20260823162235/dual-pruning.svg>)

每个 Schema 批次分别采样两次。合并时采用不对称策略：

```text
最终删除候选 ≈ 多次负向判断的交集
最终保留候选 ≈ 多次正向判断的并集
正向选择可以覆盖负向删除
```

这种策略服务于 Schema Linking 的核心目标——**高召回**。误留几个字段只会增加后续探索成本，误删一个关键外键却可能让正确 SQL 永远无法构造。

裁剪阶段还有三层保护：

1. 名称或描述中含 `id`、`code`、`name`、`type` 的辨识字段倾向于保留；
2. 只要正向选择明确选中，字段即使进入删除候选仍会留下；
3. 当候选列仍超过 2000 个时，切换到更激进的“主要保留正向命中项”策略。

一次批次的输出形态如下：

```json
{
  "obviously_irrelevant_tables": ["unrelated_table"],
  "obviously_irrelevant_columns": [
    {"table": "ga_sessions_2017", "columns": ["socialEngagementType"]}
  ]
}
```

与之对应的正向输出是：

```json
{
  "relevant_tables": [],
  "relevant_columns": [
    {
      "table": "ga_sessions_2017",
      "columns": ["date", "totals.totalTransactionRevenue", "trafficSource.source"]
    }
  ]
}
```

> 经过双向裁切后，后续流程中我们只保留裁切过后保留的表，被判定为完全无关的表不在进入后续流程。我们将后续保留的表称为**候选表**。

## 4. 从 Schema 描述走向真实数据

### 4.1 一次全局语义初始化

裁剪只回答“哪些内容不能轻易删除”，还没有解释各张表在当前问题中的职责。`summarize_tables()` 因此把问题、Master Logical Plan、Evidence 和**候选 Schema** 一次性交给模型，建立查询级的数据库认知。

它重点识别四类角色：

| 角色              | 作用                         | 容易出现的误区                   |
| ----------------- | ---------------------------- | -------------------------------- |
| Target Table      | 提供最终输出字段             | 只看到答案列，忽略其上游筛选来源 |
| Filtering Table   | 提供时间、状态、类别等条件   | 名称相关但真实取值不匹配         |
| Bridge Table      | 通过键连接两个实体           | 表中没有业务文本，最容易被删掉   |
| Calculation Table | 提供求和、平均、最大值等数值 | 未确认行粒度，聚合后发生重复计算 |

语义初始化输出示例：

```json
{
  "query_specific_content_analysis": "需要先按 traffic source 汇总 2017 年全年交易收入，再对胜出来源按月聚合。收入字段以 10^6 为缩放单位。",
  "table_functions": {
    "ga_sessions_2017": "同时提供日期、流量来源和会话级交易收入，是过滤、分组和聚合的核心表。"
  }
}
```

* query_specific_content_analysis：这是一个字符串，用来描述当前问题与整个数据库结构之间的总体对应关系。
* table_functions：这是一个对象，是表名 → 该表在当前问题中的功能说明

这一步只运行一次。它不是最终选择，而是为后续每张表提供“预期角色”，让探索围绕假设展开。

### 4.2 逐表探索：用 SQL 验证语义，而不是只猜名称

`explore_and_link_table()` 为**每张候选表**(经过双向裁切后保留的所有表)建立独立模型会话和 SQL 环境。模型先看到字段、描述、相似表组、题目、Evidence 和预期角色，然后生成 3～8 条 Snowflake 探索 SQL。

![逐表探索与相关性判断闭环](<image/APEX-SQLSchema Linking 的规划、探索与全局细化_20260823162235/table-exploration.svg>)

探索围绕四类证据展开：

1. **语义对齐**：查看 DISTINCT 值，确认字段真实含义能否支撑题目条件；
2. **粒度与范围**：确认一行代表会话、订单还是明细，避免错误聚合；
3. **连接能力**：检查主外键是否有值，桥接关系是否实际可用；
4. **数据质量**：检查关键字段的 NULL 情况和可用范围。

针对贯穿示例，模型可能提出：

```sql
-- 检查目标年份、来源和收入字段是否有有效数据
SELECT
  SUBSTR(date, 1, 6) AS month,
  trafficSource.source AS source,
  COUNT(*) AS sessions,
  COUNT(totals.totalTransactionRevenue) AS revenue_rows,
  SUM(totals.totalTransactionRevenue) AS revenue
FROM ga_sessions_2017
GROUP BY 1, 2
ORDER BY revenue DESC
LIMIT 20;
```

执行结果会进入同一会话。若证据仍不充分，模型可以进行第二轮探索(最多两轮)；证据充分时输出 `[COMPLETE]`。因此这一环节不是固定 SQL 模板，而是一个小型闭环：

```text
提出表角色假设 → 设计查询 → 执行 → 观察数据 → 补查或结束
```

### 4.3 把“逻辑理由”和“执行观察”分开

探索结束后，模型为单表输出结构化判断：

```json
{
  "table_full_name": "<数据库中的精确完整表名>",
  "relevant": true,
  "relevant_columns": [
    {
      "column_name": "date",
      "relevance_reason": "将会话限定到 2017 年并形成月份分组",
      "observations": "样例值采用 YYYYMMDD 格式"
    },
    {
      "column_name": "totals.totalTransactionRevenue",
      "relevance_reason": "计算全年和月度交易收入",
      "observations": "Evidence 说明数值按 10^6 缩放"
    },
    {
      "column_name": "trafficSource.source",
      "relevance_reason": "按流量来源分组并返回最高来源",
      "observations": "字段表示搜索引擎、来源域名或 utm_source"
    }
  ],
  "table_summary": "提供会话日期、流量来源和交易收入的核心事实表",
  "exploration_log": ["...实际执行的 SQL 与结果..."]
}
```

`relevance_reason` 解释“为什么需要”，`observations` 记录“实际看到什么”。这一区分让后续全局细化既能利用逻辑角色，也能追溯数据证据。

逐表探索完成后，裁剪范围内的每张候选表都会获得一个初步判断：

```text
relevant=true  → 在 Round 0 Prompt 中显示为 [MARKED RELEVANT]
relevant=false → 在 Round 0 Prompt 中显示为 [MARKED IRRELEVANT]
```

`MARKED` 表示“逐表探索给出的初步标记”，不是最终 Schema 结论。双视角裁剪决定全局细化能看到的候选范围，全局语义初始化提供表角色参考，逐表探索才产生这组相关性标记；后续全局细化可以保留、忽略或修正这些判断。

## 5. 全局细化：把局部相关表组成完整关系图

全局细化不是第三次独立选表，而是把逐表探索得到的局部判断组装成第一版 Schema，再检查这份 Schema 是否缺少连接键、桥接表或其他必要字段。两个外层轮次职责相近，但前后关系明确：**Round 0 负责初始组装，Round 1 只负责增量补漏。**

```text
Round 0：从候选表和逐表判断中组装第一版 Schema
Round 1：沿着第一版 Schema 检查缺口，只补充，不删除
最终结果：Round 0 ∪ Round 1
```

![Round 0 与 Round 1 各自包含内部验证循环](<image/APEX-SQLSchema Linking 的规划、探索与全局细化_20260823162235/global-refinement-two-rounds-with-inner-loops.svg>)

### 5.1 全局细化收到什么

```text
原始完整 Schema
    ↓ 双视角裁剪
filtered_tables_dict
    ↓ 逐表探索
table_judgments
    ↓ 全局细化
refined_schema
```

| 输入                     | 含义                                                               |
| ------------------------ | ------------------------------------------------------------------ |
| `filtered_tables_dict` | 双视角裁剪后仍保留的全部候选表列，也是全局细化可恢复内容的最大范围 |
| `table_judgments`      | 逐表探索产生的`relevant`、相关字段、逻辑理由和数据观察           |
| `summarization_result` | 全局语义初始化预测的 Target、Filter、Bridge 等表角色               |
| `question / evidence`  | 约束全局选择始终围绕原始任务和外部知识                             |

### 5.2 Round 0：组装第一版 Schema

Round 0 会看到 `filtered_tables_dict` 中的所有候选表，以及逐表探索生成的 `[MARKED RELEVANT]`、`[MARKED IRRELEVANT]`、相关字段和观察证据。它从全局重新检查最终输出、过滤、聚合、分组和表间连接，形成第一版 `refined_schema`。

这里需要区分“看到的范围”和“输出的范围”：

```text
Round 0 Prompt：看到裁剪后的所有候选表
Round 0 refined_schema：通常只包含最终 SQL 需要的表列子集

Round0 Schema ⊆ 裁剪后候选 Schema ⊆ 原始完整 Schema
```

`[MARKED RELEVANT]` 只是逐表判断，不会自动进入结果；`[MARKED IRRELEVANT]` 也不是永久删除。如果全局视角发现某张表是连接两个实体所必需的 Bridge Table，仍可把它加入第一版 Schema。

```json
{
  "refined_schema": {
    "<完整表名>": {
      "relevant_columns": [
        {"column_name": "date", "relevance_reason": "Filtering and monthly grouping"},
        {"column_name": "trafficSource.source", "relevance_reason": "Grouping and direct result"},
        {"column_name": "totals.totalTransactionRevenue", "relevance_reason": "Aggregation"}
      ]
    }
  },
  "exploration_queries": [],
  "status": "[CONFIRM]"
}
```

Round 0 不是固定只调用一次模型。第一次调用先生成第一版 `refined_schema`；如果同时输出 `exploration_queries`，程序会执行跨表 SQL，并把结果反馈给同一个模型会话，再进行第二次调用以更新 Schema。当前每个外层 Round 内最多进行两次有效模型调用；模型输出 `[CONFIRM]` 或不再提供查询时可以提前结束 Round 0 内部循环。随后外层仍会进入 Round 1。

### 5.3 Round 1：对第一版结果做增量补漏

Round 0 完成后，程序把已选字段记录到 `confirmed_columns_set`。Round 1 不重新执行逐表探索，而是把候选字段分成两组：

```text
Currently Confirmed Columns
= Round 0 已经加入累计结果的字段

Remaining Candidate Columns
= filtered_tables_dict 中的字段 - Round 0 已确认字段
```

这两组不是“相关表与无关表”，也不是 `[MARKED RELEVANT]` 与 `[MARKED IRRELEVANT]`，而是“上一轮已经选择的字段”和“尚未选择但仍有资格恢复的字段”。Round 1 重点检查：

- 已确认字段能否形成连通关系图；
- 是否缺失主键、外键或桥接表；
- 是否还有同样合理的替代字段或替代连接路径；
- 是否把一个含糊实体过早绑定成单一类型。

例如，Round 0 可能已经选出：

```text
sales.amount
sales.region_id
employee.full_name
```

但这三列无法从 `sales` 连接到 `employee`。Round 1 会从 Remaining Candidates 中恢复：

```text
region_manager.region_id
region_manager.employee_id
employee.employee_id
```

于是得到 `sales → region_manager → employee` 的完整路径。新增字段被并入累计结果，Round 1 不会删除 Round 0 已经选择的字段：

```text
final_refined_schema = Round 0 选择 ∪ Round 1 补充
```

当前实现固定执行两个外层轮次。Round 1 没有新增字段时会记录“已收敛”，即使有新增字段，外层循环也会在 Round 1 后自然结束。

Round 1 同样不是固定只调用一次模型。第一次调用基于 Confirmed 与 Remaining Candidates 形成补漏结果；如果模型仍需要验证某个 Join 或候选键，可以输出 `exploration_queries`。程序执行后把结果反馈给同一会话，再调用模型更新 Round 1 的 `refined_schema`。它与 Round 0 使用相同的提前结束条件和最多两次有效调用上限。

### 5.4 确定性后处理：保守补充潜在连接键

每次全局细化后，程序还会扫描裁剪后的候选表：如果某列与已选字段同名但尚未入选，就把它视为潜在**外键候选**。只有外键候选少于 20 个时才统一加入，避免 `id` 等通用名称造成 Schema 爆炸。

自动加入的字段带有固定说明：

```json
{
  "column_name": "region_id",
  "relevance_reason": "Auto-preserved: Shares name with a selected column (potential Foreign Key).",
  "observations": "Automatically added for graph connectivity."
}
```

这一步不调用模型，作用是为连接完整性提供最后一道保守保护。

## 6. Round 1 结束后的完整输出

Round 1 完成增量补漏后，程序将 Round 0 与 Round 1 选中的字段合并，得到最终 `refined_schema`。一次任务写入结果文件的完整结构如下：

```json
{
  "sf_bq009": {
    "question_id": "sf_bq009",
    "question": "找出 2017 年交易收入最高的流量来源，并计算其月度最高值与最低值之差。",
    "db_id": "GA360",
    "evidence": "totals.totalTransactionRevenue 以 10^6 为缩放单位。",
    "result": {
      "refined_schema": {
        "GA360.GA_SESSIONS_2017": {
          "relevant_columns": [
            {
              "column_name": "date",
              "relevance_reason": "用于限定 2017 年数据，并提取月份进行月度分组。"
            },
            {
              "column_name": "trafficSource.source",
              "relevance_reason": "用于按流量来源汇总收入，并返回全年收入最高的来源。"
            },
            {
              "column_name": "totals.totalTransactionRevenue",
              "relevance_reason": "用于计算各来源的全年交易收入以及胜出来源的月度收入差值。"
            }
          ]
        }
      },
      "table_judgments": {
        "GA360.GA_SESSIONS_2017": {
          "table_full_name": "GA360.GA_SESSIONS_2017",
          "relevant": true,
          "relevant_columns": [
            {
              "column_name": "date",
              "relevance_reason": "支持年份过滤和月份分组。",
              "observations": "样例值采用 YYYYMMDD 格式。"
            },
            {
              "column_name": "trafficSource.source",
              "relevance_reason": "支持按流量来源分组。",
              "observations": "实际值包含搜索引擎、来源域名和直接访问标记。"
            },
            {
              "column_name": "totals.totalTransactionRevenue",
              "relevance_reason": "支持全年和月度交易收入聚合。",
              "observations": "字段存在非空收入记录，可以执行 SUM 聚合。"
            }
          ],
          "table_summary": "提供会话日期、流量来源和交易收入，是当前问题的核心事实表。",
          "exploration_log": [
            {
              "sql": "SELECT SUBSTR(date, 1, 6) AS month, trafficSource.source AS source, SUM(totals.totalTransactionRevenue) AS revenue FROM GA360.GA_SESSIONS_2017 GROUP BY 1, 2 ORDER BY revenue DESC LIMIT 20",
              "res": "month | source | revenue\n201712 | google | 123456789"
            }
          ]
        }
      },
      "similar_table_groups": {
        "['date', 'totals.totalTransactionRevenue', 'trafficSource.source']": [
          "GA360.GA_SESSIONS_2017"
        ]
      }
    }
  }
}
```

这份输出中只有三类算法结果：

- `refined_schema`：Round 0 与 Round 1 合并后的最终表列集合，是 Schema Linking 的最终答案；
- `table_judgments`：第 4.2 节逐表探索时形成的局部判断、字段观察和 SQL 执行记录；
- `similar_table_groups`：裁剪后仍保留的相同字段结构表组。

需要注意，`table_judgments` 记录的是逐表探索阶段的判断，并不会在 Round 1 后重新改写。因此判断最终选择了哪些表和列时，应以 `refined_schema` 为准。

## 7. 一句话总结

APEX-SQL 的 Schema Linking 先用抽象计划定义问题需要哪些功能，再以“负向交集、正向并集”的高召回策略缩小 Schema；随后通过逐表 SQL 探索把名称猜测变成数据证据，并在全局细化中补齐主外键、桥接表和替代路径。模型负责不确定的语义判断，确定性程序负责分组、执行、缓存、格式校验和连接键保护，最终得到一份能支撑后续 SQL 求解的查询级关系子图。
