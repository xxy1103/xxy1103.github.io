---
title: "LongCat Sparse Attention：从稀疏选择到高效执行"
date: "2026-11-05T17:37:45+08:00"
draft: false
categories:
  - "学习笔记"
tags:
  - "深度学习"
  - "LLM"
  - "稀疏注意力"
  - "LongCat"
---
# LongCat Sparse Attention：从稀疏选择到高效执行

## 引言：选得少，为什么仍然慢？

在 DeepSeek Sparse Attention（DSA）中，每个 Attention 层依次完成两步：Lightning Indexer 先对因果前缀中的历史位置打分，选出当前 Query 对应的 Top-$K$ 位置；核心 Sparse Attention 随后只读取这些位置的 KV 表示并计算注意力。

![DSA 的单层执行流程：Indexer 对历史位置打分并选择 Top-K，Sparse Attention 按索引读取 KV；两处标记分别表示索引开销和离散 KV 访问瓶颈](/image/LongCatSparseAttention_20261105_173745/01-dsa-bottlenecks.svg)

*图 1：DSA 的执行流程与两个效率瓶颈。橙色标记表示全前缀打分、Top-K 选择及逐层重复索引；红色标记表示离散 KV 读取和反向梯度写回。根据论文 Section 2.2–2.3 绘制，位置与数量仅作示意。*

LongCat Sparse Attention（LSA）为此引入三个互补机制：**SI 改善访问连续性，CLI 跨层复用索引结果，HI 先筛 Page 再选 Token**。下面先看它们如何组成一次完整执行。

## 第 1 章：LSA 的整体结构

LSA 保留了 DSA“先选位置、再计算 Attention”的基本流程，在其中加入三个互补机制。先沿着下图看它们各自处在什么位置。

![LSA 整体结构：SI 组合固定区域和动态位置，HI 优化动态位置的选择，CLI 让后续层复用位置集合](/image/LongCatSparseAttention_20261105_173745/02-lsa-execution.svg)

*图 2：LSA 的选择与计算关系。HI 在长上下文推理中按需启用；下方两层共享位置集合，层间前向仍按顺序执行。*

首先，**SI 将参与 Attention 的位置分成固定区域和动态区域**：序列开头的 Sink 与最近的滑动窗口直接保留，其他相关位置由 Indexer 检索。两部分合起来，构成当前 Query 最终访问的位置集合。

在动态检索这条路径上，**HI 将一次大范围的 Token 选择改为先粗后细的两级选择**：先筛出候选 Page，再从候选页中选择 Token。它改变的是 Indexer 内部的搜索方式，最终交给 Attention 的仍然是一组 Token 位置。

位置选好后，**CLI 让相邻层复用同一次选择结果**。负责运行 Indexer 的层称为 Owner Layer，复用结果的层称为 Reuse Layer。两层各自使用本层的 Query 和 KV 计算 Attention，共享的只是访问位置。

这三个机制分别作用于访问集合的结构、动态检索过程和层间索引复用。下面先从 SI 展开，理解固定区域与动态检索如何配合。

## 第 2 章：SI——把选择模式变成硬件友好的访问结构

SI（Streaming-Aware Indexing）把一部分原本需要动态选择的位置，改为直接保留的固定区域。这样做既需要注意力分布上的依据，也需要相应的算子实现，才能将位置上的连续性转化为执行收益。

### 2.1 为什么固定保留 Sink 和局部窗口？

作者在使用完整 Attention 的 LongCat-Flash-Lite（69B-A3B）上，分析了 20 个长度为 8192 的 InfBench-QA 样本。模型共包含 28 个 Attention 层，统计时将每个 Query 的可见位置分为三类：开头 16 个 Sink Token、最近 1024 个 Window Token，以及其余中间区域。

![完整 Attention 模型中，Sink、SWA 与中间区域的 Attention Mass 分布](/image/LongCatSparseAttention_20261105_173745/figure-02-attention-mass.png)

*图 3：原论文 Figure 2，第 8 页。左图按 Query 位置分段、对各层取平均；右图按层统计最后 2048 个 Query。深蓝为 Sink，浅蓝为滑动窗口，橙色为中间区域。*

左图中，当 Query 位置超过约 5K 后，Sink 与 Window 合计覆盖的权重比例稳定在约 83%；右图显示，虽然各层分布不同，在最后 2048 个 Query 上，这两个区域跨层平均覆盖约 **83.1% 的 Attention Mass**。

> Attention Mass 是落在指定区域内的注意力权重之和，不是这些区域占了 83.1% 的 Token。

这一观察为固定预算提供了依据：既然开头与最近位置具有稳定的重要性，就可以直接为它们预留名额，将剩余名额交给动态检索。中间区域的平均权重较低，仍可能包含回答问题所必需的远距离信息，因此 SI 保留了动态部分。

论文默认总预算为 2048，各部分分配如下：

| 区域           | 选择方式                              | Token 预算 |
| -------------- | ------------------------------------- | ---------: |
| Sink           | 保留序列开头的位置                    |         16 |
| Sliding Window | 保留当前 Query 附近最近的位置         |       1024 |
| Dynamic Sparse | 从其余可见历史中按 Indexer Score 选择 |       1008 |

固定区域合计 1040 个位置，约占总预算的一半。这个比例来自论文的质量与效率权衡，并非由 83.1% 的权重覆盖率直接推算而来；不同预算比例的消融在实验章节比较。

用集合表示，对位置为 $t$ 的 Query，最终选择为：

$$
S_t=S_{\mathrm{sink}}\cup S_{\mathrm{swa}}\cup S_{\mathrm{sparse}}.
$$

动态集合则从固定区域以外的可见位置中产生：

$$
S_{\mathrm{sparse}}=
\operatorname{TopKIndices}_{K_{\mathrm{sparse}}}
\left(\{I_{t,s}:1\le s\le t,\ s\notin S_{\mathrm{sink}}\cup S_{\mathrm{swa}}\}\right).
$$

其中 $I_{t,s}$ 是 Indexer 对位置 $s$ 的打分，$K_{\mathrm{sparse}}=1008$。例如 Query 位于第 5000 个 Token 时，固定区域为第 1～16 个位置和第 3977～5000 个位置，动态部分从两者之间的历史检索。上述预算划分适用于历史较长的情况。序列开头只保留实际存在的位置，Sink 与窗口重叠的部分只计算一次，无需凑满 2048 个 Token。

### 2.2 混合注意力算子 HFA：两类访问分别计算

固定区域确定后，Window 对应一个连续的 KV 区间，动态 Token 仍可能分散在长历史各处。如果将两者统一当作离散索引处理，就无法充分利用窗口的规则结构。作者因此为 SI 设计了混合稀疏注意力算子 **HFA（Hybrid Sparse Attention）**：SI 决定访问哪些位置，HFA 负责高效计算这些位置上的 Attention。它将核心计算拆成连续窗口注意力（SWA）分支与动态稀疏 Flash Attention（SFA，Sparse Flash Attention）分支，分发到不同的非阻塞硬件 Stream 上重叠执行，再合并结果。

![SI 的固定与动态预算，以及 HFA 的连续窗口和动态稀疏执行分支](/image/LongCatSparseAttention_20261105_173745/03-si-budget-and-hfa.svg)

*图 4：上半部分展示 SI 的位置划分与真实预算；下半部分沿用论文 Section 4.1.1 的简化口径，省略 16 个 Sink Token，突出两条主要分支。完整算法仍保留 Sink，图中区域宽度不表示 Token 数量比例。*

SWA 分支连续读取窗口内的 KV，SFA 分支按索引读取动态 KV。

两个分支分别完成 Attention 后，需要把各自的输出合并。这里，每个分支的输出已经是**区域内的 Softmax 权重对 Value 加权求和得到的向量**。但各分支都只在自己的区域内归一化，无法从输出本身判断它在整体中应该占多少比重，因此不能直接把两个输出相加。

解决方法是：**每个分支计算局部输出时，同时保留该区域的未归一化权重总量；合并时，按这些总量对局部输出加权平均。** 例如，窗口区域与动态区域的权重总量之比为 3∶1，最终结果就是窗口输出的 75% 加上动态输出的 25%。

这个关系可以直接由 Softmax 定义得到。设两个互不重叠的区域为 $A$、$B$，$z_s$ 是 Attention Logit，$v_s$ 是 Value。区域 $A$ 的权重总量和局部输出为：

$$
Z_A=\sum_{s\in A}e^{z_s},
\qquad
O_A=\sum_{s\in A}\frac{e^{z_s}}{Z_A}v_s.
$$

区域 $B$ 同理。将两个区域合起来计算时，权重总量为 $Z_A+Z_B$，因此：

$$
O_{A\cup B}
=\frac{Z_A}{Z_A+Z_B}O_A
+\frac{Z_B}{Z_A+Z_B}O_B.
$$

HFA 通过 Online Softmax 保存数值稳定的等价统计，完成上述加权合并。因此，两个分支可以分开执行，合并后仍等价于在**同一组选中 Token**上统一计算 Attention。

连续窗口对反向传播也有帮助。假设不同 Query 都选中了历史中的同一个 Token，它们会分别对该位置的 Key 和 Value 产生梯度贡献，最终需要累加到同一地址。动态稀疏分支通过离散索引执行这类写回，容易出现多个处理单元争用相同地址的情况。SI 将约一半预算交给规则的窗口分支，缩小了动态分支需要处理的离散 Gather / Scatter 范围，从而降低相应写冲突压力；梯度累加本身仍然存在。

因此，SI 的主要作用是为核心 Attention 提供更规则的访问结构。排除固定区域也会略微缩小 Indexer 的评分范围，但长历史仍需检索，逐层重复索引也仍然存在。下一章的 CLI 将沿着层间复用这一方向继续降低索引成本。

## 第 3 章：CLI——共享位置选择，为何还需要跨层监督？

SI 改善了选中 KV 的访问结构，但每层仍然要运行 Indexer。CLI（Cross-Layer Indexing）进一步利用相邻层之间的相似性：让一个 Indexer 选出的位置，供组内多个层使用。关键是这组位置既要适合负责选择的层，也要适合复用它的层。

### 3.1 一次选择，两层各自计算 Attention

论文默认将连续两层组成一组，即组大小 $N=2$。Owner Layer 运行 Indexer，为当前 Query 选出位置集合；到下一 Reuse Layer 时，对应 Query 直接使用这组位置，省去一次索引。下一组则由新的 Owner Layer 重新选择。

![CLI 的 Owner Indexer 输出位置集合，相邻两层使用各自 Query 和 KV 计算 Attention，并通过跨层监督训练共享 Indexer](/image/LongCatSparseAttention_20261105_173745/04-cli-owner-reuse.svg)

*图 5：默认两层一组的 CLI。上方箭头传递位置集合，左右两层之间的箭头表示正常的层间前向顺序。下方概括训练监督的变化，具体计算图在训练章节展开。*

例如，Owner 选中了第 8000 个 Token，Reuse 也会访问第 8000 个 Token，但读取的是下一层自己的 KV。它会根据本层 Query 重新计算注意力权重，因此两层的输出并不相同。

按这个分组方式，Indexer 的调用次数从每层一次变成每组一次；$N=2$ 时调用次数减半。

### 3.2 集合只重叠一部分，为什么仍可能保留重要信息？

作者在**完整 Attention** 的 LongCat-Flash-Lite（69B-A3B）上分析跨层重要位置。实验使用 20 个总长度为 8192 的 InfBench-QA 样本，统计各序列最后 2048 个 Query，即第 6145～8192 个位置；每个 Query 仍只关注自己的因果前缀。图注说明，各层根据完整 Attention 分布独立选取 Top-$K$，再比较选择结果。

![跨层 Top-K 集合重叠率、复用集合的 Attention Mass 覆盖率，以及二者随层间距离的变化](/image/LongCatSparseAttention_20261105_173745/figure-03-cross-layer-overlap.png)

*图 6：原论文 Figure 3，第 9 页。左图比较位置集合的重叠率；中图表示较早层的集合覆盖了较晚层多少注意力权重，纵轴为来源层、横轴为目标层。右图横轴为层间距离，蓝线表示平均集合重叠率，红线表示平均权重覆盖率，阴影为对应距离下各层对的最小值至最大值。*

图中比较了两个不同问题：

| 指标                    | 它在问什么？                                       | 相邻层平均结果 |
| ----------------------- | -------------------------------------------------- | -------------: |
| Top-$K$ Overlap       | 两层各自选出的 $K$ 个位置，有多少相同？          |          57.4% |
| Attention Mass Coverage | 使用前一层选出的位置，能覆盖后一层多少注意力权重？ |          93.2% |

两者不矛盾：**位置是否相同，与这些位置承载多少权重，是两回事。** 假设两层各选 4 个位置，只有 2 个相同，集合重叠率就是 50%；但如果这两个共同位置承载了目标层 90% 的注意力权重，复用来源层的集合就已经能覆盖至少 90% 的权重。不同的那些位置可能只占较小比重。

用符号表达，设同一个 Query 在来源层 $i$ 和目标层 $j$ 的 Top-$K$ 集合分别为 $S^{(i)}$、$S^{(j)}$，则：

$$
\operatorname{Overlap}(i,j)=\frac{|S^{(i)}\cap S^{(j)}|}{K},
\qquad
\operatorname{Coverage}(i\to j)=\sum_{s\in S^{(i)}}\alpha_s^{(j)}.
$$

这里 $\alpha_s^{(j)}$ 是目标层在位置 $s$ 上的完整 Attention 权重，按 Head 平均。

右图还显示，层间距离增大时，平均覆盖率整体下降，部分层对的覆盖率更低。因此，这项观察支持从相邻层开始复用，并不保证任意距离都适合共享。

### 3.3 从“只服务本层”到“同时服务组内各层”

即使相邻层具有较高覆盖率，也不能直接删除下一层的 Indexer。原来的 Indexer 只受本层 Attention 分布监督，训练目标没有要求它保留下一层需要的位置。那些在本层权重较小、在下一层却很重要的位置，就可能被漏掉。

CLI 的做法是扩大监督范围：**同一个 Owner Indexer，同时学习组内各层的 Attention 分布。** 两层一组时，它既要服务自己，也要服务下一层。训练目标是由两个层各自提供监督，而不是先强迫两个层采用相同的 Attention 权重。

因此，CLI 包含配套的两项变化：执行时每组只运行一次 Indexer，训练时让这个 Indexer 接受组内多个层的监督。监督如何产生、损失如何计算，以及哪些参数被更新，在训练章节统一展开；共享深度和有无蒸馏的消融则放到实验章节。

CLI 减少了跨层重复索引，但 Owner 的单次索引仍然要处理长历史。下一章的 HI 将继续缩小这一次精细选择所面对的候选范围。

## 第 4 章：HI——先缩小候选，再做精细选择

CLI 减少了 Indexer 的调用次数，但每次调用仍要在很长的历史中寻找重要位置。HI（Hierarchical Indexing）的直觉是：**先用较低成本判断哪些区域值得看，再在这些区域里逐个挑 Token。** 对应的两级选择分别是 Page 粗筛和 Token 精筛，最终输出仍然是 SI 所需的动态位置集合。

### 4.1 先看两级选择如何缩小范围

以可见前缀达到 1M Token 的一个 Query 为例。按每页 128 个 Token 划分，历史共有 8192 个 Page。HI 先选出其中 1024 个候选 Page，将精细搜索范围缩小到最多约 128K Token，再从中选出 1008 个动态位置。这些位置与固定 Sink、Window 合并，才是最后参与 Attention 的集合。

![HI 从 Sub-block 代表 Key 生成 Page 分数，召回候选页，再以原始 Token Key 精筛动态位置](/image/LongCatSparseAttention_20261105_173745/05-hi-coarse-to-fine.svg)

*图 7：HI 的粗筛与精筛。示例按 1M = 1024×1024 个可见位置计算；候选页提供中间搜索范围，最终只输出动态预算对应的位置。固定区域由 SI 保留，不依赖粗筛召回。*

这几个参数分别控制不同层级：

| 参数或数量                       | 论文默认配置 | 控制什么                            |
| -------------------------------- | -----------: | ----------------------------------- |
| Page 大小 $P$                  |    128 Token | 每次粗筛选择的区域大小              |
| Sub-block 大小 $B$             |      8 Token | 多少个 Indexer Key 合成一个代表 Key |
| 候选页数 $M$                   |    1024 Page | 粗筛后保留多大的精细搜索范围        |
| 动态预算 $K_{\mathrm{sparse}}$ |   1008 Token | 最终交给 Attention 的动态位置数     |

粗筛仍需查看全历史的概要，并没有完全跳过长历史。

### 4.2 Page 怎么打分，Token 又怎么精筛？

**粗筛需要的是一个便宜的区域概要。** 论文没有把整个 Page 压成一个向量，而是将每页再切成 Sub-block：默认一个 Page 有 128 个 Token，每 8 个为一组，共 16 组。每组的 Indexer Key 逐维取平均，得到一个代表 Key，可以预先计算并缓存。

这里平均的是用于索引打分的 Key。后面精筛和 Attention 仍然需要原始表示。

对某个 Page，Indexer Query 分别与这 16 个代表 Key 打分，经过 ReLU 后求和，得到每个 Indexer Head 对该页的评分；再按原 Indexer 的 Head 权重合并，得到一个 Page Score。不同 Page 比较这个分数，保留最高的 $M$ 页。

用符号表示，第 $n$ 个 Sub-block 的代表 Key 为：

$$
\bar{k}_n=\frac{1}{B}\sum_{s\in\mathrm{subblock}_n}k_s^I.
$$

其中上标 $I$ 表示 Indexer 使用的表示。对位置 $t$ 的 Query，第 $p$ 页的分数为：

$$
I_{t,p}^{\mathrm{page}}
=\sum_{h=1}^{H^I}w_{t,h}^I
\sum_{n\in\mathrm{page}_p}
\operatorname{ReLU}\!\left(q_{t,h}^I\cdot\bar{k}_n\right).
$$

这里 $H^I$ 是 Indexer Head 数，$q_{t,h}^I$ 是第 $h$ 个 Head 的 Query，$w_{t,h}^I$ 是对应的加权系数。公式从内向外读即可：**Query 与代表 Key 点积 → ReLU → 累加页内各组 → 按 Head 加权合并。** Query 和 Head 权重都来自已有 Indexer，不需要另训一个 Page 评分器。

例如，只看一个 Head、一个包含两组的小 Page：若 Query 与两个代表 Key 的点积为 2 和 −1，经过 ReLU 后为 2 和 0，这一 Head 的页内累加结果就是 2。

**精筛则回到原来的 Token 级打分，只把范围限制在候选页里。** 每个候选 Token 使用自己的原始 Indexer Key：

$$
I_{t,s}=\sum_{h=1}^{H^I}w_{t,h}^I
\operatorname{ReLU}\!\left(q_{t,h}^I\cdot k_s^I\right).
$$

这与粗筛的区别很直观：粗筛看一组 Key 的均值，精筛看每个 Token 自己的 Key。最后按分数选择动态预算对应的位置，结合 SI 时排除固定区域，并始终遵守因果可见范围。

这里的精筛仍然精确计算候选 Token 的原始 Indexer Score，但候选范围是近似筛出来的。若重要 Token 所在的 Page 在第一轮被丢弃，第二轮就没有机会选中它。Sub-block 均值与 Token 逐个评分之间也没有保证 Top-K 不变的关系，所以 **HI 不能理解为原始索引结果的无损重排**。

### 4.3 省在哪里，为什么不能一直开启？

论文在其硬件实现中观察到，Top-K 选择比评分本身更容易成为瓶颈：评分能利用高吞吐的矩阵计算单元，选择则更多依赖向量处理单元。因此，**HI 的成本分析重点是缩小每轮 Top-K 面对的集合。**

对一个可见前缀长度为 $L$ 的 Query，原来的选择处理约 $L$ 个位置；HI 先在约 $L/P$ 个 Page 中选页，再在最多 $MP$ 个 Token 中精筛。沿用论文的选择成本模型：

$$
O(L)\quad\longrightarrow\quad O\!\left(\frac{L}{P}+MP\right).
$$

例如前面的 1M 前缀，选择规模从约 104 万个 Token，变成约 8192 个 Page 加 13 万个候选 Token。但这只是两轮选择的规模估算，不是完整 Indexer 延迟的公式：代表 Key 维护、粗筛评分与候选收集也有成本。

> 在langcat最终的实际架构中：模型的靠近输入端的4层没有开启HI。第6章会通过实验说明为什么。

HI 不新增可训练参数，也不要求额外微调；它利用已有 Indexer 的参数，改变推理时的搜索流程。这样，SI、CLI、HI 分别改变了访问结构、索引调用次数与单次搜索范围。接下来回到训练：SI 的固定预算与 CLI 的跨层复用，如何通过监督让 Indexer 学会适应？

## 第 5 章：如何训练——让 Indexer 学会为多个层选位置

Indexer 的任务是预测哪些位置重要，而主模型的 Attention 权重恰好提供了这种信息。训练时，可以让主模型先算出注意力分布，再用它监督 Indexer：**主模型负责学习如何预测下一个 Token，Indexer 则学习如何找出主模型需要的位置。** CLI 进一步要求 Owner Indexer 同时学习组内各层的需求。

### 5.1 先学会选择，再让主模型适应稀疏计算

论文沿用 DSA 的两阶段训练，从已有的完整 Attention 模型开始。

**第一阶段是 Dense Warm-up。** 主模型仍执行完整 Attention，参数保持冻结。各层产生的 Attention 权重充当教师，只有 Indexer 参数更新。这时核心 Attention 尚未依赖 Indexer 的选择结果，可以先让 Indexer 学会识别重要位置，而不影响原模型的计算。

![Dense Warm-up 中冻结主模型，以完整因果 Attention 产生两层教师分布，共同监督唯一更新的 Owner Indexer](/image/LongCatSparseAttention_20261105_173745/07-dense-warmup.svg)

*图 8：两层一组的 Dense Warm-up。主模型在完整因果前缀上计算 Attention，Indexer 在同一范围预测位置分布，并接受组内两层的蒸馏监督；选择结果暂不限制主模型的 Attention 范围。*

**第二阶段是 Sparse Training。** Attention 改为在 SI 的固定区域与动态位置并集上计算，主模型与 Indexer 都继续训练，但更新依据不同：主模型用下一 Token 预测损失学习，Indexer 用注意力分布的蒸馏损失学习。

| 阶段            | Attention 计算范围 | 教师分布来自哪里                | 参数如何更新                             |
| --------------- | ------------------ | ------------------------------- | ---------------------------------------- |
| Dense Warm-up   | 完整因果前缀       | 各层完整 Attention 权重         | 冻结主模型，只更新 Indexer               |
| Sparse Training | 选中集合 $S_t$   | 各层选中集合上的 Attention 权重 | 预测损失更新主模型，蒸馏损失更新 Indexer |

例如两层一组时，稀疏训练先由 Owner Indexer 为位置 $t$ 产生分数并选出动态位置，加上固定区域形成 $S_t$；Owner 和 Reuse 两层依次使用各自的 Query、KV 完成 Attention，再分别提供本层的教师分布。共享 Indexer 接受这两份监督，而主模型继续通过最终的 Token 预测学习。

![LSA 稀疏训练中，主模型产生各层教师分布，共享 Indexer 接受跨层监督；预测损失与蒸馏损失分别更新对应参数](/image/LongCatSparseAttention_20261105_173745/06-indexer-training.svg)

*图 9：两层一组的稀疏训练。教师分布作为固定目标参与蒸馏，Indexer 输入也与主模型计算图分离。图底部单列位置选择路径，避免将离散 Top-K 画成可微监督通路。依据论文 Section 2.2、3.1–3.2 绘制。*

### 5.2 Indexer 怎么学：比较哪些位置，接受哪些层的监督？

Indexer 的学习目标，是让自己对位置重要性的判断接近主模型的 Attention 分布。对同一个 Query，主模型的 Attention 权重作为教师分布 $p$，Indexer 的分数经过 Softmax 得到预测分布 $r$。

例如，对三个位置，教师分布为 $p=[0.7,0.2,0.1]$，Indexer 预测为 $r=[0.3,0.3,0.4]$。主模型最关注第一个位置，Indexer 却把较多权重分给了第三个位置。训练就要调整 Indexer 的评分，让 $r$ 接近 $p$。

两份分布通过 KL 散度比较：

$$
D_{\mathrm{KL}}(p\|r)
=\sum_{s\in U}p_s\log\frac{p_s}{r_s}.
$$

其中 $U$ 是本次比较的位置集合，$p_s$、$r_s$ 是两份分布在位置 $s$ 上的权重。教师分布由该层各 Attention Head 的权重相加、再归一化得到；Indexer 则在同一集合 $U$ 上对评分做 Softmax。教师认为重要、而 Indexer 分配权重不足的位置，会推动评分调整。教师作为固定目标，不由这项损失更新。

**SI 在第二阶段改变选中集合的构成。** 第一阶段仍执行完整因果 Attention，Indexer 在全部可见位置上接受监督，SI 的固定预算不限制这一阶段的计算。第二阶段才使用 SI，将选中集合构造成固定区域与动态位置的并集：

$$
U=S_t
=S_{\mathrm{sink}}\cup S_{\mathrm{swa}}\cup S_{\mathrm{sparse}}.
$$

从完整前缀切换到选中集合，本来就是 DSA 两阶段训练的变化；SI 进一步规定哪些位置直接保留、哪些位置动态检索。训练监督仍覆盖整个集合，因此 Sink 和 Window 虽然不用竞争动态名额，也要参与蒸馏。它们承载了较多注意力权重，保留这些信息能让 Indexer 学习整个选中集合的注意力结构。此时教师来自实际执行的 Sparse Attention。

**CLI 在两个阶段都让组内各层提供监督。** 原来每个 Indexer 只学习本层的 Attention 分布；默认两层一组时，Owner Indexer 的同一份预测 $r_t$，需要分别与两层各自的教师分布比较，再将损失相加：

$$
\mathcal L_{\mathrm{CLI}}
=\sum_t\left[
D_{\mathrm{KL}}\!\left(p_t^{(l)}\|r_t\right)
+
D_{\mathrm{KL}}\!\left(p_t^{(l+1)}\|r_t\right)
\right].
$$

这里 $t$ 是 Query 位置，$l$ 是 Owner 层，$l+1$ 是 Reuse 层。两层各自提供答案，共同训练同一个 Indexer，使其选择尽量兼顾两层的需求。预热时，两份答案来自完整 Attention；稀疏训练时，则来自两层在同一选中集合上各自计算的 Attention。

HI 不新增训练目标，只在推理时使用已经学好的 Indexer 参数改变搜索流程。接下来通过关键实验，检验这些设计的效率收益与质量代价。

## 第 6 章：关键实验——实际收益与设计取舍

先看 LSA 能否带来端到端加速，再追问这些收益依赖哪些设计、需要付出什么质量代价。以下图表与数字均来自论文，本文未复现实验。

### 6.1 LSA 是否真正加速？

最直接的结果来自 LongCat-Flash-Lite（69B-A3B）的端到端推理。作者以 DSA 为基线，所有测试长度启用 SI 与 CLI，至少 256K 的 Prefill 再启用 HI。

![LSA 相对 DSA 的端到端 Prefill 与 Decode 延迟及加速比](/image/LongCatSparseAttention_20261105_173745/figure-05-inference-speedup.png)

*图 10：原论文 Figure 5，第 14 页。横轴为序列长度，灰色为 DSA，绿色为 LSA；左图为首 Token 延迟 TTFT（毫秒，对数坐标），右图为逐 Token 输出延迟 TPOT（毫秒）。橙色标注为 DSA 延迟除以 LSA 延迟。*

**Prefill 加速为 1.42–3.60×，Decode 为 1.25–1.40×。** Prefill 中，历史越长，跨层复用与层次筛选减少的索引工作越多，收益随之增大。Decode 在 128K 达到最高加速比，256K 后略有回落：作者此时切换到 KV Cache Partition，将历史 KV 分散到多个设备，单设备面对的索引范围缩小，LSA 相对 DSA 的优势也收窄。该 Decode 部署没有启用 HI。

这些端到端收益是怎样产生的？先把索引开销拿开，只比较 SI 对核心 Attention 的影响。作者保持总预算为 2048，以全部动态访问的稀疏算子 SFA（Sparse Flash Attention）为基线，测试 SI 配套的混合算子 HFA（Hybrid Sparse Attention），即第 2 章中将连续窗口与动态稀疏区域分开计算、再合并输出的实现。训练算子测试采用 BF16、batch size = 1、Query 长度 8192；为简化测量，HFA 使用 1024 Window + 1024 Sparse，省略 Sink，与完整算法的 16 + 1024 + 1008 区分。

![核心 Attention 训练算子的前向与反向延迟完整对照](/image/LongCatSparseAttention_20261105_173745/table-02-training-kernel.png)

*原论文 Table 2，第 12 页。单位为毫秒；Fwd、Bwd 分别表示前向与反向，speedup 为 SFA 延迟除以 HFA 延迟。该测试不含 Indexer，论文将硬件称为 AI accelerator，未给出具体型号。*

HFA 在各长度都加速了核心算子。例如 1024K 时，前向从 36.80 ms 降到 19.27 ms，反向从 354.48 ms 降到 220.12 ms。连续窗口带来的收益同时体现在读取和梯度写回中。

但把 Indexer 加回来，情况就不同了。下面的推理测试同时报告核心 Attention 和包含索引开销的完整层延迟，尚未启用 CLI、HI。

![推理时核心 Attention 与包含 Indexer 的完整层延迟](/image/LongCatSparseAttention_20261105_173745/table-03-inference-layer.png)

*原论文 Table 3，第 12 页。BF16、总预算 2048；Prefill 使用 batch = 1、Query 长度 2048，Decode 使用 batch = 4、Query 长度 1。核心算子比较 SFA 与 HFA，完整层比较 SFA + Lightning Indexer 与 HFA + Streaming-Aware Indexer。*

看最右侧 1024K 一列：Prefill 的核心算子快了 1.69×，完整层却只有约 1.02×；Decode 对应为 1.26× 与约 1.04×。**SI 确实改善了 Attention，但长历史的索引成本会吞掉大部分整层收益。** 这正是端到端方案还需要 CLI、HI 的原因。

训练阶段也有收益，只是此时 HI 不参与。作者将 SI 与 CLI 组合，与 DSA 比较单 Attention 层的前向、反向及总延迟：

![LSA 与 DSA 的单 Attention 层训练延迟](/image/LongCatSparseAttention_20261105_173745/figure-04-training-speedup.png)

*原论文 Figure 4，第 13 页。灰色为 DSA，绿色为 LSA；三图依次是前向、反向、总延迟，均包含 Kernel 和 CP（上下文并行）通信。32K、64K、128K、256K、1024K 对应的 CP 数分别为 4、8、16、32、128。*

**总加速在 32K 为 1.53×，1024K 为 1.61×**。连续窗口改善了前后向执行，CLI 进一步减少前向的重复索引；论文实现中，CLI 没有同步省去反向的索引计算。因此，图中给出的是单层训练收益，不能直接作为完整模型训练吞吐的倍数。

### 6.2 为什么采用一半固定预算、两层共享？

效率提高后，还需要确认哪些优化幅度能维持质量。作者在 LongCat-Flash-Lite（69B-A3B）上进行预算与共享深度消融，变体在 128K 上下文阶段训练，随后检查损失和长距离检索能力。

先看 SI。作者保持总预算不变，将 Sink 与 Window 的固定预算占比从 0% 增至 100%；0% 是全部动态选择，100% 则完全不留动态名额。

![固定预算比例对训练损失、验证损失与检索准确率的影响](/image/LongCatSparseAttention_20261105_173745/figure-06-si-ablation.png)

*原论文 Figure 6，第 16 页。左图：相对 Dense MLA 的训练损失差，横轴为训练进度；中图：128K 上下文验证损失；右图：不同上下文长度的 NIAH 行检索准确率。损失越低越好，准确率越高越好；图例中的百分比为固定预算占比。*

**固定预算在 0%–50% 时，整体曲线接近。提高到 75% 后，训练损失依然接近，但 128K 检索准确率从 50% 固定配置的约 94% 降到约 84%，下降约 10 个百分点。**这是右图的近似读数，说明普通训练损失未必能暴露长距离检索退化。100% 固定配置则在左、中图已表现出明显更高的损失，右图没有提供它的检索分数。

作者再对选定的 50% 固定配置做 SFT，并用 HELMET 检查多类长上下文任务：

![SI 消融模型在 SFT 后的 HELMET 分项结果](/image/LongCatSparseAttention_20261105_173745/table-09-si-quality.png)

*原论文 Table 9，第 16 页。比较 Dense MLA、全部动态选择的 LI 与 50% 固定预算的 SI；各行是相应 Chat 模型。*

平均分分别为 55.88、56.10、56.59，支持在这组设置中保留约一半固定预算。结合前面的检索曲线，作者选择的是“尽可能扩大规则窗口，同时保留足够动态名额”，并不是按 83.1% 的 Attention Mass 覆盖率直接分配预算。

CLI 的问题相似：共享越多层，索引次数越少，但一个 Indexer 也需要兼顾更多层的需求。作者比较独立索引、两层共享、四层共享，并额外测试四层共享时将预算从 2K 增至 4K。

![共享深度与跨层蒸馏对训练、验证和检索表现的影响](/image/LongCatSparseAttention_20261105_173745/figure-07-cli-ablation.png)

*原论文 Figure 7，第 17 页，Base 模型消融。三图依次为训练损失差、128K 验证损失、NIAH 检索准确率。N 表示共享组大小；右图还包含两层共享但没有跨层蒸馏的变体。*

右图 128K 处，**两层共享并蒸馏的检索准确率为 96%，四层共享降到 82%；**将四层共享的预算加倍，也未恢复中图的验证表现。更值得注意的是，取消跨层蒸馏、直接两层复用时，准确率只有 70%。该变体由训练好的独立 Indexer 模型在推理时移除部分 Indexer 构造，没有额外重训，因此检验的是“已有层间相似性是否足以支持直接复用”。结果表明，跨层监督不可简单省略。

选定两层共享后，作者同样检查 SFT 后的 HELMET：

![CLI 两层共享配置在 SFT 后的 HELMET 分项结果](/image/LongCatSparseAttention_20261105_173745/table-10-cli-quality.png)

*原论文 Table 10，第 17 页。比较 Dense MLA、独立 Indexer 的 LI（N=1）与 CLI（N=2）；它与上面的 Base 模型检索测试属于不同评测阶段。*

三者平均分为 55.88、56.10、55.78，总体接近。这组证据共同支持默认 N=2：用跨层蒸馏支撑一次索引服务两层，同时避免更大共享范围带来的明显质量退化。

### 6.3 HI 的加速值得付出多少近似代价？

HI 先增加一轮粗筛，再缩小精筛范围，能否省时取决于历史长度。作者固定 BF16、Query 长度 2048，并采用 P=128、B=8、M=1024，对比普通全范围 Indexer 与两阶段 HI。

![HI 各阶段延迟与普通全范围 Indexer 的比较](/image/LongCatSparseAttention_20261105_173745/table-04-hi-latency.png)

*原论文 Table 4，第 12 页。单位为毫秒，HI Total 为两阶段总延迟，Flat LI 为普通 Indexer；speedup = Flat LI / HI Total，小于 1 表示 HI 更慢。*

128K 时，普通索引用时 23.977 ms，HI 反而需要 30.226 ms：候选预算已经接近全部历史，粗筛仍增加了成本。到 256K，HI 开始取得 1.47× 加速；1024K 达到 4.11×。表中第二阶段在 128K 之后维持 27.769 ms，也直观体现了候选范围被限制在最多约 128K 的作用。这是论文将 HI 用于至少 256K Prefill 的依据，4.11× 仅指 Indexer 加速。

**然而，缩小范围意味着可能漏掉重要位置。作者进一步检查哪些层更需要保留完整搜索，在 NIAH 128K 上比较不同关闭 HI 的位置：**

![HI 在不同层关闭时的检索准确率](/image/LongCatSparseAttention_20261105_173745/table-12-hi-layer-selection.png)

*原论文 Table 12，第 19 页。使用 Mean Pooling、B=8、M=256 页，即约 32K 候选 Token；这是一组质量敏感性消融，不同于前面的默认性能配置，也不代表最终在 128K 启用 HI。*

所有 Indexer 都使用 HI 时得分为 84；对最前面四个关闭 HI，升至 92，而关闭“最前面两个 + 最后两个”仍是 84。**相同数量的保护放在浅层更有效，因此论文最终让前四个 Indexer 保留完整可检索前缀上的 Token 级选择。它们仍然执行 Indexer 和稀疏 Attention，只跳过 Page 粗筛；“四个”是这组实验支持的配置选择。**

在采用质量控制配置后，最终模型还有多少误差？作者在同一个 LongCat-Flash-Lite-Sparse 发布模型上切换 HI 开关，报告了完整的 ATLAS 长上下文评测：

![发布模型开启和关闭 HI 的 ATLAS 长上下文评测](/image/LongCatSparseAttention_20261105_173745/table-15-hi-quality.png)

*原论文 Table 15，第 21 页。两列分别为同一发布模型关闭与开启 HI，各基准按自身长度设置汇总，不能与前面的固定长度算子测试合并解释。*

MRCR 从 44.66 变为 44.47，变化较小；LongCodeQA 从 62.30 降至 59.37，下降 2.93 分，表明代码理解可能更受粗筛误差影响。LongBench-v2 则从 52.50 变为 53.64。**整体上，HI 的代价因任务而异，不能称为严格无损，也不能将个别分数上升理解成能力增强。**

### 6.4 最终模型是否保持整体能力？

前面的消融解释了配置选择，主体实验则检查将这些设计组合起来后的能力。作者在两个规模上比较 Attention 方案，先看 HELMET 的长上下文任务：

![两个规模模型的 HELMET 分项与平均分](/image/LongCatSparseAttention_20261105_173745/table-07-helmet.png)

*原论文 Table 7，第 15 页。69B-A3B Chat 模型比较 Dense MLA、DSA、LSA；560B-A27B Thinking 模型只比较 MLA 与 LSA。各任务类别的分数为所属基准的平均值。*

69B 模型的平均分为 MLA 58.50、DSA 58.60、LSA 59.02，说明组合后的 LSA 在这组测试中保持了接近基线的整体表现。560B 模型的 LSA 平均分更高，但作者指出其中 Re-rank 的提升受到输出长度和截断影响，不能全部归为注意力机制带来的能力增强。这里的主体实验也不同于前面单独训练的 SI、CLI 消融，不跨表比较平均分。

再看通用知识、数学推理与代码能力：

![两个规模模型的通用知识、推理和代码能力对照](/image/LongCatSparseAttention_20261105_173745/table-08-general-quality.png)

*原论文 Table 8，第 16 页。左侧为 69B 模型的 MLA、DSA、LSA，右侧为 560B 模型的 MLA 与 LSA；同一任务在同一规模内比较。*

各方案在不同任务上各有高低，没有一个配置持续领先。因而这组结果支持的结论是：**LSA 在提高执行效率的同时，整体能力接近原有基线**，而不是每项任务严格无损或能力普遍增强。发布模型还更新了训练语料，其相对旧 Dense 模型的增益，也不能全部归因于 Attention 替换。

