---
title: "用 Triton 写 GPU Kernel：从 Vector Add、Softmax 到 MatMul"
date: "2026-11-01T11:57:08+08:00"
updated: "2026-11-03T23:11:23+08:00"
draft: false
categories:
  - "学习笔记"
tags:
  - "深度学习"
  - "gpu"
  - "triton"
---
须知少时凌云志，曾许人间第一流
<!-- more -->

# 用 Triton 写 GPU Kernel：从 Vector Add、Softmax 到 MatMul

> 上一篇《从模型计算到 GPU 执行》讲的是 GPU 怎样执行一个 Kernel。这一篇开始自己动手写 Kernel。
>
> 全文用三个 Kernel 串起来：Vector Add、Softmax 和 MatMul，难度逐级上升。读完之后，你应该能看懂一份完整的 Triton MatMul Kernel，并知道每一行代码在让 GPU 做什么。

## 开篇：Triton 在哪一层

上一篇把一次计算从模型一路拆到了硬件：算子描述要做什么计算，Kernel 规定 GPU 怎样做，硬件提供 SM、CUDA Core、Tensor Core 和多级存储。那时我们只是在读 Kernel，这一篇开始自己写。

写 Kernel 最常用的工具是 CUDA C++。用 CUDA 写，需要直接安排每一个线程：线程编号怎样换算成数据下标，线程之间什么时候同步，哪些数据放进 Shared Memory。Triton 换了一种描述方式。它是一种面向 GPU Kernel 的编程语言和编译器，语法接近 Python。**在 Triton 里，我们描述的是“一块数据怎样计算”；这块数据怎样分给线程、放进哪些寄存器、生成哪些指令，由 Triton 编译器决定。**

![Triton 在调用链中的位置，以及本文三个 Kernel 的路线](/image/用Triton写GPUKernel_20261101_115708/01-triton-stack-and-roadmap.svg)

PyTorch 程序准备好张量，调用我们写的 Triton Kernel；Triton 编译器把 Kernel 编译成 GPU 指令；GPU 硬件负责执行。

要提前说明的是，Triton 降低的是编写难度，不会自动让算子变快。数据怎样分块、访存是否连续、片上数据能否复用，仍然要我们自己设计。

# 第 1 章：第一个 Kernel——Vector Add

我们从最简单的计算开始：

```text
C = A + B
```

例如 A = [1, 2, 3, 4]，B = [5, 6, 7, 8]，结果 C = [6, 8, 10, 12]。在 PyTorch 里写一行 `C = A + B` 就够了，PyTorch 会调用它内置的加法 Kernel。这一章我们自己写这个 Kernel，亲手规定 GPU 怎样完成这次加法。

加法本身没有难度，所以我们可以把注意力全部放在 Triton 的执行方式上：代码怎样被启动，每一份代码怎样找到自己的数据，又怎样把结果写回去。

## 1.1 一份代码，很多个 Program

先看 Triton 和普通 Python 最不一样的地方。

普通 Python 函数调用一次，函数体就执行一次。Triton Kernel 启动一次，会创建很多个 **Program Instance（程序实例，下文简称 Program）**，每个 Program 都把同一份 Kernel 代码完整执行一遍。启动多少个 Program，由启动时给出的 **Grid** 决定。

既然所有 Program 运行的是同一份代码，它们怎样分工？靠编号。每个 Program 运行时可以用 `tl.program_id(axis=0)` 查到自己的编号 `pid`，再根据编号去处理不同的数据。

![一份 Kernel 代码按 Grid 启动为多个 Program，每个 Program 用 pid 找到自己的数据段](/image/用Triton写GPUKernel_20261101_115708/02-one-kernel-many-programs.svg)

以 1000 个元素、每个 Program 处理 256 个元素为例，需要

```text
ceil(1000 / 256) = 4
```

个 Program。Program 0 处理第 0～255 个元素，Program 1 处理第 256～511 个，Program 2 处理第 512～767 个，Program 3 处理剩下的第 768～999 个。

所以写 Triton Kernel 时，我们写的是**单个 Program 的工作**：拿到自己的编号，算出自己负责哪一段数据，把数据读进来，计算，再写回去。一共要多少个 Program，由启动 Kernel 时的 Grid 决定。

如果启动了 4 个 Program，不代表它们一定同时运行。GPU 会把 Program 调度到空闲的 SM 上，Program 很多时候会分批执行。所以写代码时不能假设 Program 之间有固定的执行顺序。

## 1.2 完整代码

先把完整代码放在这里，后面几节再逐段解释。代码分两部分：带 `@triton.jit` 的 `add_kernel` 是 Kernel，运行在 GPU 上；下面的 `add` 是普通 Python 函数，运行在 CPU 上，负责准备输出张量、计算 Grid 并启动 Kernel。

```python
import torch
import triton
import triton.language as tl


@triton.jit
def add_kernel(
    x_ptr,                       # 输入 x 的起始地址
    y_ptr,                       # 输入 y 的起始地址
    output_ptr,                  # 输出的起始地址
    N,                           # 元素总数
    BLOCK_SIZE: tl.constexpr,    # 每个 Program 处理的元素个数
):
    # 1. 我是第几个 Program？
    pid = tl.program_id(axis=0)

    # 2. 我负责哪些位置？
    offsets = pid * BLOCK_SIZE + tl.arange(0, BLOCK_SIZE)

    # 3. 哪些位置没有越界？
    mask = offsets < N

    # 4. 从显存读取数据
    x = tl.load(x_ptr + offsets, mask=mask, other=0)
    y = tl.load(y_ptr + offsets, mask=mask, other=0)

    # 5. 计算
    result = x + y

    # 6. 把结果写回显存
    tl.store(output_ptr + offsets, result, mask=mask)


def add(x: torch.Tensor, y: torch.Tensor) -> torch.Tensor:
    output = torch.empty_like(x)
    N = output.numel()
    BLOCK_SIZE = 256
    grid = (triton.cdiv(N, BLOCK_SIZE),)    # 向上取整：需要几个 Program
    add_kernel[grid](x, y, output, N, BLOCK_SIZE=BLOCK_SIZE, num_warps=4)
    return output


if __name__ == "__main__":
    torch.manual_seed(0)
    x = torch.rand(1000, device="cuda")
    y = torch.rand(1000, device="cuda")
    out = add(x, y)
    print("最大误差:", (out - (x + y)).abs().max().item())
```

启动 Kernel 的写法是 `add_kernel[grid](...)`：方括号里给 Grid，圆括号里给参数。这里的 `grid = (4,)` 是一个一维元组，表示启动 4 个 Program，编号依次是 0、1、2、3。传进去的 `x`、`y`、`output` 是 PyTorch 张量，Triton 会自动取出它们在显存中的起始地址，所以在 Kernel 里它们以 `x_ptr` 这样的指针出现。

`@triton.jit` 表示这个函数是 Triton Kernel。第一次调用时，Triton 会把它**即时编译**（JIT，Just-In-Time）成 GPU 代码并缓存起来；之后用相同的参数类型和常量再次调用，会直接复用编译结果。参数里 `BLOCK_SIZE: tl.constexpr` 的意思是，BLOCK_SIZE 在编译时就要确定，编译器会针对这个具体数值生成代码。

还要注意，Kernel 函数虽然长得像 Python，但不是普通的 Python 函数。函数体里只能使用 Triton 支持的语法和 `tl.*` 操作，不能随意调用 Python 库，也不能把它当成普通函数直接调用。

Kernel 的六个步骤可以归成一条主线：

```text
确定位置（pid、offsets、mask）→ Load → Compute → Store
```

后面的 Softmax 和 MatMul 也遵循这条主线，变化的只是“确定位置”和“Compute”这两步。

## 1.3 `offsets` 和指针：找到并搬运自己的数据

### 用一个张量表示一批位置

Kernel 的第二步是算出当前 Program 负责哪些位置：

```python
offsets = pid * BLOCK_SIZE + tl.arange(0, BLOCK_SIZE)
```

`tl.arange(0, BLOCK_SIZE)` 生成一个从 0 到 BLOCK_SIZE − 1 的整数张量。BLOCK_SIZE = 256 时，它是 `[0, 1, 2, ..., 255]`。

`pid * BLOCK_SIZE` 是当前 Program 负责区段的起点。把起点加到这个张量上，就得到当前 Program 负责的全部位置。以 Program 1 为例：

```text
pid * BLOCK_SIZE    = 1 × 256 = 256
tl.arange(0, 256)   = [0, 1, 2, ..., 255]
offsets             = [256, 257, 258, ..., 511]
```

`tl.arange(0, 256)`只是创建了一个包含 256 个整数的张量，这个张量属于当前 Program。后面对 `offsets` 的加法、比较和读取，都是对整个张量一次性进行的运算，写法和 PyTorch 的张量运算一样。

### 指针加偏移：`tl.load` 和 `tl.store`

有了位置，就可以去显存里读数据：

```python
x = tl.load(x_ptr + offsets, mask=mask, other=0)
```

`x_ptr` 是张量 x 在显存中的起始地址。指针加上一个偏移张量，得到的是一组地址：`x_ptr + offsets` 指向 x 的第 256～511 个元素。`tl.load` 按这组地址把数据读进来，得到一个同样有 256 个元素的张量。`mask` 和 `other` 两个参数在下一节解释。

偏移的单位是元素个数，不是字节。x 是 FP32 张量时，每个元素占 4 字节，`x_ptr + 256` 实际指向起始地址之后 1024 字节的位置。**这一步换算由 Triton 根据指针的数据类型自动完成。**

计算完成后，`tl.store` 按同样的方式把结果写回：

```python
tl.store(output_ptr + offsets, result, mask=mask)
```

![一个 Program 用同一组 offsets 读取 x 和 y 的同一段，相加后写回 output 的同一段](/image/用Triton写GPUKernel_20261101_115708/03-pointer-offsets-load-store.svg)

x、y、output 三个张量各自从不同的起始地址开始，但当前 Program 用同一组 `offsets` 访问它们，所以读到的是 x 和 y 的同一段，结果也写到 output 的同一段。所有 Program 都完成之后，output 的每一段都被写满，整个加法就完成了。

`tl.load` 读的是全局显存中的地址。这次读取实际命中 L1、L2 还是要访问显存，由硬件缓存决定，Kernel 代码里不需要关心。

## 1.4 `mask`：最后一块不够长怎么办

回到 1000 个元素、BLOCK_SIZE = 256 的例子。Program 3 的 `offsets` 是 `[768, 769, ..., 1023]`，但数组只有 1000 个元素，最后一个有效下标是 999。如果按这 256 个地址全部去读写，后 24 个位置会越过数组的末尾，读到不属于 x 的数据，甚至把结果写到别的张量上。

Kernel 的第三步就是为了处理这种情况：

```python
mask = offsets < N
```

`mask` 是一个和 `offsets` 等长的布尔张量。对 Program 3 来说，前 232 个位置是 True，后 24 个位置是 False。

![1000 个元素分给 4 个 Program，Program 3 的后 24 个位置被 mask 屏蔽](/image/用Triton写GPUKernel_20261101_115708/04-work-split-and-mask.svg)

把 `mask` 传给 `tl.load` 和 `tl.store` 之后：

- `tl.load` 只读取 mask 为 True 的位置；mask 为 False 的位置不访问显存，直接填入 `other` 指定的值，这里是 0。
- `tl.store` 只写入 mask 为 True 的位置，越界位置不写。

这样一来，Program 3 里的张量仍然是 256 个元素，代码的写法和其他 Program 完全一样，只是后 24 个位置不参与真正的读写。前三个 Program 的 `mask` 全是 True，不受影响。

对 Vector Add 来说，`other` 填什么都可以，因为这些位置的结果不会被写回。

你可能会联想到 Attention 里的 Causal Mask。两者都是用条件屏蔽一部分位置，但作用不同：这里的 `mask` 防止访问数组之外的地址；Causal Mask 禁止 Query 看到它之后的 Token，被屏蔽的位置在数组之内，只是不参与注意力计算。

## 1.5 分清几个相似的概念

到这里，本章已经出现了 Grid、Program、BLOCK_SIZE、num_warps，再加上上一篇的 Thread Block、Warp 和 SM，名字相近的概念有七个。最容易混的是 BLOCK_SIZE 和 Thread Block：两个名字里都有 Block，含义却完全不同。下面用本章的例子（N = 1000，grid = (4,)，BLOCK_SIZE = 256，num_warps = 4）把它们放到一张图里。

![从 Grid 到 SM：Grid 启动 4 个 Program；一个 Program 用 BLOCK_SIZE 描述数据量，用 num_warps 描述线程数，编译成一个 Thread Block；Thread Block 被分配到 SM 上执行](/image/用Triton写GPUKernel_20261101_115708/05-concept-hierarchy.svg)

从上往下看这张图：

1. **Grid 决定启动多少个 Program。** 这里是 4 个，它们运行同一份代码，只有 `pid` 不同。
2. **一个 Program 有两组互相独立的参数。** BLOCK_SIZE = 256 描述数据，表示这个 Program 要处理 256 个元素，也就是 `offsets` 的长度。num_warps = 4 描述执行资源，表示这个 Program 用 4 个 Warp，也就是 4 × 32 = 128 个线程。256 个元素交给 128 个线程，平均每个线程处理 2 个，具体哪个线程处理哪些元素由编译器决定。在 NVIDIA GPU 上，这 128 个线程组成一个 CUDA Thread Block，所以**一个 Program 通常对应一个 Thread Block。**
3. **Thread Block 被分配到 SM 上执行。** 一个 SM 可以同时驻留多个 Thread Block，Block 很多时会分批执行。所以这次启动共有 4 × 128 = 512 个线程，但不能认为这 512 个线程在同一时刻一起运行。

| 概念         | 是什么                                      | 本例              | 属于                   |
| ------------ | ------------------------------------------- | ----------------- | ---------------------- |
| Grid         | 一次 Kernel 启动中全部 Program 的组织方式   | `(4,)`          | 软件                   |
| Program      | 运行 Kernel 代码的一个实例                  | 4 个              | 软件（Triton）         |
| BLOCK_SIZE   | 一个 Program 处理的元素个数                 | 256               | 软件（我们定义的常量） |
| num_warps    | 一个 Program 使用的 Warp 数                 | 4                 | 软件（编译选项）       |
| Thread Block | 一组线程，一个 Program 编译后通常对应一个   | 128 个线程        | 软件（CUDA）           |
| Warp         | 32 个线程组成的一组，GPU 以它为单位调度指令 | 每个 Program 4 个 | 硬件调度单位           |
| SM           | 执行 Thread Block 的计算单元                | 取决于 GPU        | 硬件                   |

num_warps 也不是越大越好，线程多了，每个 SM 上能同时驻留的 Program 可能变少，合适的值要靠实际测试选出来。

这也是 Triton 和 CUDA 的分界线。用 CUDA 时，元素怎样分给线程要自己写；用 Triton 时，我们只描述到 Program 和数据块这一层，线程交给编译器安排。

## 本章小结

这一章用 Vector Add 走完了一个 Triton Kernel 的全过程：

```text
CPU 端启动 Kernel：add_kernel[grid](...)
        ↓
Grid 创建多个 Program，每个 Program 运行同一份代码
        ↓
每个 Program 用 pid 算出 offsets 和 mask
        ↓
Load → Compute → Store
```

需要记住三点：

1. **Kernel 代码描述的是单个 Program 的工作**，Grid 决定这份代码被实例化多少次，`tl.program_id` 让每个 Program 处理不同的数据。
2. **一个 Program 通过“指针 + 偏移张量”找到自己的数据**，用 `tl.load` 读取、`tl.store` 写回，用 `mask` 屏蔽越界位置。
3. **BLOCK_SIZE 是一个 Program 处理的逻辑元素个数，不是线程数。** 线程数由 num_warps 决定，元素怎样分给线程由编译器决定。

Vector Add 里，每个元素的计算互不相关，元素 0 的结果不需要知道元素 1 是多少。下一章的 Softmax 打破了这一点：每个输出都依赖整行数据的最大值和总和。我们会看到，一个 Program 怎样在内部把一行数据汇总起来。

# 第 2 章：第二个 Kernel——Softmax，从逐元素到归约

Softmax 是 Attention 里必不可少的一步。在

$$
\mathrm{Attention}(Q, K, V) = \mathrm{softmax}\left(\frac{QK^{\top}}{\sqrt{d}}\right) V
$$

中，$QK^{\top} / \sqrt{d}$ 得到的是注意力分数，Softmax 把每一行分数变成一组非负、加起来等于 1 的权重。它的定义是：

$$
\mathrm{Softmax}(x)_i = \frac{e^{x_i}}{\sum_j e^{x_j}}
$$

这一章用 Triton 实现按行的 Softmax。和 Vector Add 相比，代码只多了几行，但多出来的这几行引出了 GPU 编程里一类新的计算：归约。

## 2.1 Softmax 里有一步要“看全行”

先用 `x = [1, 2, 3]` 手算一遍。Softmax 分三步：

| 步骤                        | 计算                                | 结果                         |
| --------------------------- | ----------------------------------- | ---------------------------- |
| ① Exp：每个元素取指数      | `[e¹, e², e³]`                 | `[2.718, 7.389, 20.086]`   |
| ② Sum：把指数结果加起来    | `2.718 + 7.389 + 20.086`          | `30.193`                   |
| ③ Divide：每个元素除以总和 | `[2.718, 7.389, 20.086] / 30.193` | `[0.0900, 0.2447, 0.6652]` |

三步的性质不一样。Exp 和 Divide 跟 Vector Add 一样，每个位置各算各的，第 0 个元素取指数时，不需要知道第 1 个元素是多少。Sum 不行，它必须把这一行所有元素的结果汇总到一起。而且 Divide 要等 Sum 算完才能开始，因为每个位置都要除以同一个总和。

![逐元素运算与归约的对比：Vector Add 各位置独立，Softmax 的 Sum 把全行汇聚成一个数再广播回去](/image/用Triton写GPUKernel_20261101_115708/06-elementwise-vs-reduction.svg)

像 Sum 这样，把多个元素按某种运算汇总成更少元素的操作，叫作 **Reduction（归约）**。求和、求最大值、求最小值都是归约。从形状上看，对一个长度为 4 的向量求和，形状从 `[4]` 变成一个标量：

```python
x = torch.tensor([1.0, 2.0, 3.0, 4.0])
x.sum()   # 10.0
x.max()   # 4.0
```

归约让 Softmax 比 Vector Add 难写。在 Vector Add 里，每个线程处理自己的元素，线程之间不需要交换任何数据。做归约时，分散在不同线程里的数据必须汇集到一起，线程之间要交换中间结果，并等待彼此完成。

## 2.2 GPU 上的并行归约

一个线程从头加到尾当然能求和，但这样其他线程都在闲着。GPU 通常用**树形归约**：先两两相加，再把结果两两相加，一轮轮减半。

以 8 个数求和为例：

```text
第 1 轮：[1, 2, 3, 4, 5, 6, 7, 8] → [3, 7, 11, 15]
第 2 轮：[3, 7, 11, 15]           → [10, 26]
第 3 轮：[10, 26]                 → [36]
```

![8 个数的树形归约：每轮两两相加，3 轮得到总和](/image/用Triton写GPUKernel_20261101_115708/07-tree-reduction.svg)

一个线程顺序累加需要 7 步；树形归约每一轮内的加法可以同时进行，只需要 3 轮。数据量为 n 时，轮数大约是 log₂n，1024 个数只要 10 轮。

在 NVIDIA GPU 上，同一个 Warp 内的线程可以用 Warp Shuffle 指令直接交换寄存器里的数据；跨 Warp 汇总时，通常要借助 Shared Memory，并在线程之间同步。用 CUDA 写归约时，这些步骤都要自己写，容易出错。

Triton 把这些细节都交给编译器。在 Kernel 里只需要写一行：

```python
total = tl.sum(x, axis=0)     # 求和
maximum = tl.max(x, axis=0)   # 求最大值
```

`x` 是当前 Program 里的一个一维张量，`axis=0` 表示沿着这唯一的维度归约，结果是一个标量。编译器会根据数据在线程间的分布，生成相应的 Warp 内交换、Shared Memory 读写和同步指令。图中的树形结构只用来说明归约为什么能并行，不代表 Triton 实际生成的指令顺序。

## 2.3 数值稳定性：为什么先减最大值

按定义直接计算 Softmax 有一个隐患。假设一行分数是

```text
x = [1000, 1001, 1002]
```

直接计算 `e¹⁰⁰⁰` 会溢出。FP32 能表示的最大值约为 3.4 × 10³⁸，对应的指数上限是 `ln(3.4 × 10³⁸) ≈ 88.7`，指数超过 88.7 就会变成 `inf`。于是分子和分母都是 `inf`，`inf / inf` 的结果是 `NaN`。FP16 的范围更小，指数超过 11 左右就会溢出。

解决办法来自 Softmax 的一个性质：**给所有元素减去同一个常数 c，结果不变。**

$$
\frac{e^{x_i - c}}{\sum_j e^{x_j - c}}
= \frac{e^{x_i} \cdot e^{-c}}{\left(\sum_j e^{x_j}\right) \cdot e^{-c}}
= \frac{e^{x_i}}{\sum_j e^{x_j}}
$$

分子和分母同时乘了 $e^{-c}$，约掉之后就是原式。**通常取 $c = \max(x)$：**

```text
[1000, 1001, 1002] − 1002 = [−2, −1, 0]
```

减完之后，最大的元素变成 0，其余都是负数，所有指数值都落在 (0, 1] 之间，不会再上溢。分母中至少有一项等于 `e⁰ = 1`，所以分母不会小于 1，除法也是安全的。`[−2, −1, 0]` 的 Softmax 结果是 `[0.0900, 0.2447, 0.6652]`，和 `[1, 2, 3]` 的结果完全相同，因为两者也只差一个常数。

于是，实际使用的 Softmax 有五步：

```text
Max → Subtract → Exp → Sum → Divide
```

其中 **Max 和 Sum 是归约**，Subtract、Exp、Divide 是逐元素运算。一行数据要做两次归约，这就是 Softmax 和 Vector Add 最主要的区别。

## 2.4 任务划分：一个 Program 负责一行

Prefill阶段Attention 里的分数是一个矩阵，Softmax 要对每一行分别计算。所以这次的输入是一个二维矩阵 `X: [M, N]`，有 M 行，每行 N 个元素，输出 Y 的形状相同：

```text
Y[i, :] = Softmax(X[i, :])
```

这叫 **Row-wise Softmax（按行 Softmax）**。每一行的计算互不相关，第 0 行的最大值和总和与第 1 行无关。所以最自然的分工是：**一个 Program 负责一整行**。M 行就启动 M 个 Program，Grid = `(M,)`。

这和第 1 章的分工方式不同。Vector Add 按固定长度 BLOCK_SIZE 把向量切成几段，Program 的数量由元素总数决定；Softmax 按行分工，Program 的数量就是行数。

接下来，每个 Program 要找到自己那一行在显存中的位置。矩阵在显存里按行连续存放，第 0 行之后紧接着第 1 行。每行有 N 个元素，所以第 `row_idx` 行从偏移 `row_idx * N` 开始：

```python
row_idx = tl.program_id(0)
col_offsets = tl.arange(0, BLOCK_SIZE)
offsets = row_idx * N + col_offsets
```

BLOCK_SIZE 也要重新考虑。一个 Program 要一次性装下一整行，BLOCK_SIZE 必须不小于 N。另外，`tl.arange` 要求长度是 2 的幂，所以 BLOCK_SIZE 取不小于 N 的最小 2 的幂。N = 5 时取 8，每个 Program 有 8 个位置，其中 5 个有效，后 3 个和第 1 章一样用 mask 屏蔽。

![一个 4 行 5 列的矩阵：每行由一个 Program 负责，补成 8 格；4 行在显存中首尾相接，第 row_idx 行从 row_idx × N 开始](/image/用Triton写GPUKernel_20261101_115708/08-softmax-row-per-program.svg)

## 2.5 完整代码与逐行跟踪

下面是完整的代码。这是教学用的简化版：假设输入是 GPU 上按行连续存储的二维 FP32 张量，每行长度适中。

```python
import torch
import triton
import triton.language as tl


@triton.jit
def softmax_kernel(
    x_ptr,
    y_ptr,
    N,                           # 每行的元素个数
    BLOCK_SIZE: tl.constexpr,    # 不小于 N 的最小 2 的幂
):
    # 1. 我负责第几行？
    row_idx = tl.program_id(0)

    # 2. 这一行的元素在显存中的位置
    col_offsets = tl.arange(0, BLOCK_SIZE)
    offsets = row_idx * N + col_offsets
    mask = col_offsets < N

    # 3. 读取一整行，越界位置填 -inf
    x = tl.load(x_ptr + offsets, mask=mask, other=-float("inf"))

    # 4. 第一次归约：求最大值，再减去它
    x_max = tl.max(x, axis=0)
    x = x - x_max

    # 5. 逐元素取指数
    numerator = tl.exp(x)

    # 6. 第二次归约：求和
    denominator = tl.sum(numerator, axis=0)

    # 7. 逐元素相除，写回结果
    y = numerator / denominator
    tl.store(y_ptr + offsets, y, mask=mask)


def softmax(x: torch.Tensor) -> torch.Tensor:
    M, N = x.shape
    y = torch.empty_like(x)
    BLOCK_SIZE = triton.next_power_of_2(N)
    grid = (M,)                  # 一个 Program 负责一行
    softmax_kernel[grid](x, y, N, BLOCK_SIZE=BLOCK_SIZE)
    return y


if __name__ == "__main__":
    torch.manual_seed(0)
    x = torch.randn(128, 1000, device="cuda")
    y = softmax(x)
    print("最大误差:", (y - torch.softmax(x, dim=1)).abs().max().item())
```

这份代码基于 [Triton 官方 Fused Softmax 教程](https://triton-lang.org/main/getting-started/tutorials/02-fused-softmax.html) 的核心计算，省略了官方版本中让一个 Program 循环处理多行的调度方式，以及根据 GPU 资源计算 Program 数量的部分。

还要注意，一个 Program 要把整行数据放在片上，也就是 GPU 芯片内部的存储里，这里主要是寄存器。行很长时（例如几万个元素），寄存器放不下，编译器只能把多出来的数据暂存到显存，速度会明显下降，这种写法就不再适用。

下面用 `[1, 2, 3, 4, 5]` 这一行跟踪一遍。BLOCK_SIZE = 8，后 3 个位置填 `-inf`，Kernel 读入的张量是：

```text
x = [1, 2, 3, 4, 5, -inf, -inf, -inf]
```

| 代码                                        | 类型   | 结果                                                  |
| ------------------------------------------- | ------ | ----------------------------------------------------- |
| `x_max = tl.max(x, axis=0)`               | 归约   | `5`                                                 |
| `x = x - x_max`                           | 逐元素 | `[-4, -3, -2, -1, 0, -inf, -inf, -inf]`             |
| `numerator = tl.exp(x)`                   | 逐元素 | `[0.0183, 0.0498, 0.1353, 0.3679, 1, 0, 0, 0]`      |
| `denominator = tl.sum(numerator, axis=0)` | 归约   | `1.5713`                                            |
| `y = numerator / denominator`             | 逐元素 | `[0.0117, 0.0317, 0.0861, 0.2341, 0.6364, 0, 0, 0]` |

最后 `tl.store` 只写回前 5 个有效位置。`x - x_max` 和 `numerator / denominator` 是一个张量和一个标量运算，标量会自动广播到每个位置，写法和 PyTorch 一样。

## 2.6 `other=-inf`：填充值也要让计算保持正确

第 1 章说过，Vector Add 的填充值填什么都行，因为越界位置的结果不会写回。Softmax 不一样：越界位置虽然不写回，却会参与 `tl.max` 和 `tl.sum`。填充值必须满足两个条件：

1. 不能影响最大值，也就是它要比任何有效元素都小。
2. 不能影响总和，也就是它取指数之后要等于 0。

`-inf` 正好同时满足：任何有限数都比它大，而 `e^(-inf) = 0`。

如果仍然用 0 填充，对于含有正数的行，0 不会成为最大值，但它取指数后变成 `e^(0 - max)`，大于 0，会让分母变大，结果仍然是错的。对于全是负数的行，问题更明显。以 `[-3, -2, -5, -1, -4]` 为例：

![同一行用 0 和用 -inf 填充的对比：0 填充让最大值变成 0、分母多出 3，-inf 填充得到正确结果](/image/用Triton写GPUKernel_20261101_115708/09-padding-neg-inf.svg)

## 2.7 Kernel Fusion：数学运算没变，少的是数据搬运

同样的计算，也可以用 PyTorch 逐步写出来：

```python
x_max = x.max(dim=1, keepdim=True).values
z = x - x_max
e = torch.exp(z)
s = e.sum(dim=1, keepdim=True)
y = e / s
```

这五行在 PyTorch 的默认执行方式下，每一行都会启动一个独立的 Kernel。前一个 Kernel 的结果要先写回显存，成为中间张量，下一个 Kernel 再把它从显存里读出来。`z` 和 `e` 都是和 x 一样大的张量，要在显存里写一遍、再读一遍。

我们的 Triton Kernel 把五步放在了同一个 Kernel 里。一个 Program 把整行读进片上之后，Max、Subtract、Exp、Sum、Divide 都在寄存器里完成，中间结果不写回显存，最后只把输出写回一次。理想情况下：

```text
读一次输入 → 片上完成全部计算 → 写一次输出
```

这种把多个计算步骤合进一个 Kernel 的做法，叫作 **Kernel Fusion（算子融合）**。

![逐步执行与融合执行的数据流对比：五个独立 Kernel 之间反复读写显存，融合后只有一次读和一次写](/image/用Triton写GPUKernel_20261101_115708/10-kernel-fusion-dataflow.svg)

要注意，融合没有减少数学运算。指数还是要算 M × N 次，加法、除法的次数也没变。减少的是两样东西：

* 一是显存读写，中间张量不必写回再读出；
* 二是 Kernel 启动的次数，五次变成一次。

上一篇讲过，Softmax 这类每个数据只做几次运算的算子，瓶颈通常在显存带宽，而不在计算。所以减少数据搬运，往往就能直接提升速度。

不过，这不代表我们写的 Kernel 一定比 `torch.softmax` 快。`torch.softmax` 本身就是一个优化过的融合实现，并不会按上面五行那样逐步执行。我们的版本只是演示融合的思路，和它比快慢，要在具体的形状、数据类型和 GPU 上实际测试。

## 本章小结

这一章的 Softmax Kernel 可以归结为一条流水线：

```text
Load（填 -inf）→ Max → Subtract → Exp → Sum → Divide → Store
```

需要记住四点：

1. **Max 和 Sum 是归约**，需要汇总整行的数据；Subtract、Exp、Divide 是逐元素运算。在 Triton 里，归约只需要写 `tl.max`、`tl.sum`，线程间的数据交换由编译器生成。
2. **先减最大值**不改变 Softmax 的结果，但能避免指数溢出。
3. **填充值要和后续计算配合。** 有归约时，被 mask 屏蔽的位置也参与计算，Softmax 要用 `-inf` 填充。
4. **Kernel Fusion 不减少计算量，减少的是中间结果的显存读写和 Kernel 启动次数。**

到这里，一个 Program 负责的数据已经从一段向量变成了一整行，但它在内部的计算仍然是一维的。下一章进入 MatMul：一个 Program 要负责输出矩阵中的一个二维小块，而且算出这个小块，需要沿着另一个维度分好几轮读数据。

# 第 3 章：MatMul 怎样分工——先切输出，再沿 K 累加

矩阵乘法（MatMul）是 Attention 的主要计算量所在：`QKᵀ` 是一次矩阵乘法，Softmax 之后乘 V 又是一次。这一章和下一章一起完成一个 Triton MatMul Kernel。

MatMul 比前两个 Kernel 多了两个难点。一是任务怎样切分：输出是二维的，一个输出元素还要用到 A 的一整行和 B 的一整列。二是代码怎样取数：二维的小块要从一维的显存里取出来。这一章只解决第一个问题，全程用小矩阵手算，不写 Triton 代码。下一章再处理地址和代码。

## 3.1 一个输出元素从哪里来：M、N、K

先回顾矩阵乘法的规则。以两个 2×2 矩阵为例：

$$
A=\begin{bmatrix}1&2\\3&4\end{bmatrix},\quad
B=\begin{bmatrix}5&6\\7&8\end{bmatrix},\quad
C=AB=\begin{bmatrix}19&22\\43&50\end{bmatrix}
$$

**C 中的一个元素，等于 A 的一行和 B 的一列逐对相乘再求和。** 例如左上角的 19，用的是 A 的第 0 行和 B 的第 0 列：

```text
C[0, 0] = 1 × 5 + 2 × 7 = 19
```

推广到一般情况，矩阵乘法的形状写成：

$$
A_{M\times K}\times B_{K\times N}=C_{M\times N}
$$

三个字母分别描述一件事：

- **M** 是 A 的行数，也是 C 的行数。
- **N** 是 B 的列数，也是 C 的列数。
- **K** 是 A 的列数，也是 B 的行数。它不出现在 C 的形状里，表示算 C 的每个元素时要累加多少组乘积。

![矩阵乘法的 M、N、K：C 的一个元素由 A 的一行和 B 的一列沿 K 方向逐对相乘求和](/image/用Triton写GPUKernel_20261101_115708/11-matmul-mnk.svg)

例如 A 是 `[3, 4]`，B 是 `[4, 2]`，那么 C 是 `[3, 2]`，一共 6 个元素。K = 4，所以每个元素要累加 4 组乘积：

$$
C_{0,0}=A_{0,0}B_{0,0}+A_{0,1}B_{1,0}+A_{0,2}B_{2,0}+A_{0,3}B_{3,0}
$$

M、N 决定输出有多大，K 决定每个输出要算多久。后面的分工也沿着这条线展开：按 M、N 把输出切开分给不同的 Program，再在每个 Program 内部沿 K 方向分批计算。

## 3.2 按输出 C 切 Tile：BLOCK_M、BLOCK_N 和二维 Grid

前两章的分工都是先确定一个 Program 负责多少输出：Vector Add 是一段，Softmax 是一行。MatMul 也一样，从输出 C 开始切。

最直接的做法是一个 Program 只算 C 中的一个元素。但这样 A 的同一行会被同一行的每个输出元素重复读取，B 的同一列也是这样，矩阵一大，重复读取的数据量会很可观。所以 Triton MatMul 通常让**一个 Program 负责 C 中的一个小矩阵块**，这个块叫作 **Tile**。块的行数记作 BLOCK_M，列数记作 BLOCK_N。

用一个 4×4 的例子来看。A 和 B 都是 4×4：

$$
A=\begin{bmatrix}1&2&3&4\\5&6&7&8\\9&10&11&12\\13&14&15&16\end{bmatrix},\quad
B=\begin{bmatrix}1&0&1&0\\0&1&0&1\\2&0&1&0\\0&2&0&1\end{bmatrix},\quad
C=\begin{bmatrix}7&10&4&6\\19&22&12&14\\31&34&20&22\\43&46&28&30\end{bmatrix}
$$

取 BLOCK_M = BLOCK_N = 2，C 被切成 4 个 2×2 的 Tile。行方向有 4 ÷ 2 = 2 块，列方向也有 2 块，所以 Grid 是二维的：

```text
Grid = (M / BLOCK_M, N / BLOCK_N) = (2, 2)，共 4 个 Program
```

每个 Program 有两个编号：`pid_m` 表示它在行方向是第几块，`pid_n` 表示列方向是第几块。Program (0, 0) 负责 C 的第 0～1 行、第 0～1 列，也就是左上角的 `[[7, 10], [19, 22]]`。

![4×4 的 C 被切成 4 个 2×2 Tile，Program (0,0) 需要 A 的前两行和 B 的前两列](/image/用Triton写GPUKernel_20261101_115708/12-output-tiling-grid.svg)

要算出这个 Tile，Program (0, 0) 需要 A 的第 0～1 行和 B 的第 0～1 列：

$$
\underbrace{\begin{bmatrix}1&2&3&4\\5&6&7&8\end{bmatrix}}_{A\text{ 的前两行},\ [2,4]}
\times
\underbrace{\begin{bmatrix}1&0\\0&1\\2&0\\0&2\end{bmatrix}}_{B\text{ 的前两列},\ [4,2]}
=
\underbrace{\begin{bmatrix}7&10\\19&22\end{bmatrix}}_{C\text{ Tile},\ [2,2]}
$$

这样，A 的第 0 行读进来一次，就同时用于 C 的第 0 行的两个元素；B 的第 0 列读进来一次，也同时用于 C 第 0 列的两个元素。**Tile 越大，每个读进来的数据被复用的次数越多。**这正是上一篇讲过的 Tiling。

有两点要注意。第一，**Program 的数量只由输出 C 的形状决定**，和 A、B 一共有多少个元素无关。第二，矩阵尺寸不一定能被 Tile 整除。例如 C 是 `[96, 80]`，Tile 是 32×32，那么

$$
\text{Grid}=\left(\left\lceil\frac{96}{32}\right\rceil,\left\lceil\frac{80}{32}\right\rceil\right)=(3,3)
$$

共 9 个 Program。最右边一列 Tile 只覆盖第 64～79 列，只有 16 列有效，多出来的部分和前两章一样用 mask 处理，下一章再细讲。

二维 Grid 只是一种组织方式，不是硬件的要求。Triton 官方的 MatMul 教程就用一维 Grid，再把一维编号换算成二维的 Tile 坐标。本文用二维 Grid，是因为它和 Tile 的位置一一对应，最容易理解。

## 3.3 BLOCK_K：一个 Program 内部为什么还要循环

Program (0, 0) 已经知道自己要算 `[2, 4] × [4, 2]`。这里 K = 4 很小，一次算完也没问题。但实际的 K 可能是 4096，把 A 的 BLOCK_M 行和 B 的 BLOCK_N 列整段读进来，片上存储放不下。所以 Program 会把 K 方向也切开，每次只读一段，长度记作 **BLOCK_K**。

取 BLOCK_K = 2，K = 4 就分成两轮：

- **第 1 轮（k = 0, 1）**：取 A 前两行的第 0、1 列，B 前两列的第 0、1 行。
- **第 2 轮（k = 2, 3）**：取 A 前两行的第 2、3 列，B 前两列的第 2、3 行。

每一轮算一个 2×2 的小矩阵乘法，结果加到一个累加器 `acc` 里：

$$
\text{第 1 轮：}\begin{bmatrix}1&2\\5&6\end{bmatrix}\begin{bmatrix}1&0\\0&1\end{bmatrix}=\begin{bmatrix}1&2\\5&6\end{bmatrix},\qquad
\text{第 2 轮：}\begin{bmatrix}3&4\\7&8\end{bmatrix}\begin{bmatrix}2&0\\0&2\end{bmatrix}=\begin{bmatrix}6&8\\14&16\end{bmatrix}
$$

$$
acc=\begin{bmatrix}1&2\\5&6\end{bmatrix}+\begin{bmatrix}6&8\\14&16\end{bmatrix}=\begin{bmatrix}7&10\\19&22\end{bmatrix}
$$

两轮加起来，正好是 C 左上角的 Tile。

![Program (0,0) 沿 K 方向分两轮计算：每轮取 A 的两列和 B 的两行做小矩阵乘法，结果累加到 acc](/image/用Triton写GPUKernel_20261101_115708/13-k-loop-accumulate.svg)

为什么分段算再相加，结果不变？因为 C 的每个元素本来就是沿 K 方向的求和，把 K 个乘积分成几组分别求和再相加，总和不变。写成分块的形式就是：

$$
C_{\text{tile}}=A_0B_0+A_1B_1
$$

其中 `A₀`、`A₁` 是 A 的那两行在 K 方向上的前后两段，`B₀`、`B₁` 是 B 的那两列在 K 方向上的前后两段。

用普通 Python 和 PyTorch 把 Program (0, 0) 的工作写出来，就是下面的循环。这还不是 GPU Kernel，但下一章的 Triton 代码就是照着这个骨架写的：

```python
# Program (0, 0) 的工作：计算 C[0:2, 0:2]
BLOCK_M = BLOCK_N = BLOCK_K = 2
acc = torch.zeros(BLOCK_M, BLOCK_N)
for k in range(0, K, BLOCK_K):       # k = 0, 2
    a = A[0:2, k:k + BLOCK_K]        # A 的前两行，本轮的两列
    b = B[k:k + BLOCK_K, 0:2]        # B 的前两列，本轮的两行
    acc += a @ b                     # 小矩阵乘法，结果累加
C[0:2, 0:2] = acc
```

把这段代码套上 `pid_m`、`pid_n` 两层循环跑完 4 个 Program，得到的 C 和 `A @ B` 完全一致。

这里有一个容易误解的地方：**BLOCK_K 只决定每个 Program 内部循环几轮，不改变 Program 的数量。** K 方向切成两段，是同一个 Program 循环两次。

## 3.4 两层分工合在一起

到这里，MatMul 的工作分成了两层：

- **第一层是 Grid**：按 BLOCK_M、BLOCK_N 把输出 C 切成 Tile，每个 Program 负责一个 Tile。这一层决定有多少个 Program。
- **第二层是 K 循环**：每个 Program 在内部沿 K 方向分批读取 A、B 的小块，相乘后累加到 `acc`。这一层决定每个 Program 要循环几轮。

| 量           | 公式                                  | 决定什么                    |
| ------------ | ------------------------------------- | --------------------------- |
| Grid_M       | $\lceil M / \text{BLOCK\_M} \rceil$ | 行方向的 Program 数         |
| Grid_N       | $\lceil N / \text{BLOCK\_N} \rceil$ | 列方向的 Program 数         |
| Iterations_K | $\lceil K / \text{BLOCK\_K} \rceil$ | 每个 Program 内部的循环轮数 |

用一个稍大的例子把两层放在一起：A 是 `[8, 6]`，B 是 `[6, 8]`，三个 BLOCK 都取 2。

- C 是 `[8, 8]`，Grid = (8/2, 8/2) = (4, 4)，共 **16 个 Program**。
- K = 6，每个 Program 循环 6/2 = **3 轮**，第 1 轮用 k = 0、1，第 2 轮用 k = 2、3，第 3 轮用 k = 4、5。
- 合起来一共执行 16 × 3 = 48 次小矩阵乘法，但 Program 仍然是 16 个。

可以把它想成一个拼图任务。C 是整张拼图，Grid 把它分给 16 个工人，每人负责一块；每个工人要分 3 次去取材料，才能拼完自己那一块。工人还是 16 个，不会因为每人要取 3 次材料就变成 48 个。

## 本章小结

这一章没有写 Triton 代码，只确定了 MatMul Kernel 的分工方式：

```text
按 BLOCK_M × BLOCK_N 把 C 切成 Tile → Grid 为每个 Tile 启动一个 Program
        ↓
每个 Program：acc = 0
        ↓
沿 K 方向循环：取 A 的一小块和 B 的一小块，acc += a @ b
        ↓
把 acc 写回 C 的对应 Tile
```

需要记住三点：

1. **M、N 决定输出的大小，K 决定每个输出元素要累加多少组乘积。**
2. **Grid 按输出 C 切分。** BLOCK_M、BLOCK_N 决定一个 Program 负责多大的 Tile，从而决定有多少个 Program。
3. **BLOCK_K 决定 Program 内部的循环轮数。** 每轮做一次小矩阵乘法并累加到 `acc`，改变 BLOCK_K 不改变 Program 的数量。

上面那段 Python 骨架里，`A[0:2, k:k+2]` 这样的切片写起来很简单，但 Triton Kernel 拿到的只是 A 在显存中的起始地址。下一章要解决的就是：一个 Program 怎样根据自己的 `pid_m`、`pid_n` 和当前的 K 轮次，算出这些小块在一维显存中的地址，再用 `tl.load`、`tl.dot`、`tl.store` 完成计算。

# 第 4 章：MatMul 代码怎样取数和累加

上一章用 PyTorch 切片写出了 MatMul 的骨架：

```python
a = A[0:2, k:k + BLOCK_K]
b = B[k:k + BLOCK_K, 0:2]
acc += a @ b
```

到了 Triton Kernel 里，Kernel 拿到的 `A_ptr` 只是 A 在显存中的起始地址。要取出一个二维小块，必须先算出这个小块里每个元素的地址。这一章先把地址算清楚，再把骨架里的三行换成 `tl.load`、`tl.dot` 和 `tl.store`，最后拼成一份完整的 Kernel。

## 4.1 二维矩阵在显存里是一维的

我们眼里的 A 是一个 4×4 的表格，但在显存里，它是一串连续的数字。按行连续存储（Row-major）时，第 0 行放完接着放第 1 行，和第 2 章 Softmax 的矩阵一样：

```text
A = [[ 1,  2,  3,  4],
     [ 5,  6,  7,  8],          显存：1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16
     [ 9, 10, 11, 12],          偏移：0 1 2 3 4 5 6 7 8  9 10 11 12 13 14 15
     [13, 14, 15, 16]]
```

要找 `A[1, 2] = 7`，先跳过第 0 行的 4 个元素，再往后数 2 个：偏移是 1 × 4 + 2 = 6。一般地，A 的形状是 `[M, K]`，每行有 K 个元素；B 的形状是 `[K, N]`，每行有 N 个元素：

$$
\text{offset}_A(i,j)=i\times K+j,\qquad \text{offset}_B(i,j)=i\times N+j
$$

偏移的单位仍然是元素，**换算成字节由 Triton 完成。**

## 4.2 `rows`、`cols`、`ks`：三组下标各管什么

第三章的骨架用切片取数：`A[0:2, k:k+2]` 表示取 A 的第 0、1 行和本轮的两列。Kernel 里没有切片，要把“取哪几行、哪几列”写成下标张量，再代入 4.1 节的地址公式。

一个 Program 需要三组下标：

- `rows`：负责 C 的哪几行，也是从 A 里取哪几行；
- `cols`：负责 C 的哪几列，也是从 B 里取哪几列；
- `ks`：这一轮用 K 方向的哪一段，它在 A 里是列，在 B 里是行。

`rows` 和 `cols` 由 Program 的编号算出，整个循环中不变：

```python
pid_m = tl.program_id(0)
pid_n = tl.program_id(1)
rows = pid_m * BLOCK_M + tl.arange(0, BLOCK_M)   # 负责 C 的哪些行
cols = pid_n * BLOCK_N + tl.arange(0, BLOCK_N)   # 负责 C 的哪些列
```

以 Program (1, 0) 为例，BLOCK_M = BLOCK_N = 2：`rows = 1 × 2 + [0, 1] = [2, 3]`，`cols = 0 × 2 + [0, 1] = [0, 1]`。

`ks` 由 K 循环的轮次算出，每轮后移一段：

```python
ks = step * BLOCK_K + tl.arange(0, BLOCK_K)      # 这一轮用 K 方向的哪几个位置
```

K = 4、BLOCK_K = 2 时，第 1 轮（step = 0）`ks = [0, 1]`，第 2 轮（step = 1）`ks = [2, 3]`。

三组下标都是“行号”或“列号”，区别只在于它们拿去选哪个矩阵的行、哪个矩阵的列。下图在每个矩阵的左边标行号、上边标列号，被选中的号码涂上对应的颜色：

![rows、cols、ks 各选中哪里：Program (1,0) 第 1 轮，A 中第 2、3 行与第 0、1 列交出蓝块，B 中第 0、1 行与第 0、1 列交出绿块，C 中第 2、3 行与第 0、1 列是要写的黄块](/image/用Triton写GPUKernel_20261101_115708/14-rows-cols-ks.svg)

`rows` 和 `cols` 只由 Program 的编号决定，整个 K 循环里都不变，所以黄块的位置一直不变。只有 `ks` 随轮次后移：第 2 轮 `ks = [2, 3]`，A 的蓝块右移两列，B 的绿块下移两行。和第 1 章的 `offsets` 一样，这三组都是元素的下标，不是线程编号。

## 4.3 `[:, None]` 和 `[None, :]`：一次生成整块地址

有了行号和列号，还要把它们组合成一个二维的地址表。以 Program (1, 0) 第 1 轮读 A 为例，`rows = [2, 3]`、`ks = [0, 1]`，要读的是 `A[2,0]`、`A[2,1]`、`A[3,0]`、`A[3,1]` 四个元素。Triton 的写法是：

```python
a_offsets = rows[:, None] * K + ks[None, :]
```

`[:, None]` 和 `[None, :]` 作用是给一维张量增加一个长度为 1 的维度：

- `rows[:, None]` 把形状 `[2]` 变成 `[2, 1]`，也就是竖着放的一列：`[[2], [3]]`。
- `ks[None, :]` 把形状 `[2]` 变成 `[1, 2]`，也就是横着放的一行：`[[0, 1]]`。

一列和一行相加时，会按**广播**（Broadcasting）规则扩展成 `[2, 2]`：列向量沿横向复制，行向量沿纵向复制，再逐元素相加。代入 K = 4：

$$
\begin{bmatrix}2\\3\end{bmatrix}\times4+\begin{bmatrix}0&1\end{bmatrix}
=\begin{bmatrix}8\\12\end{bmatrix}+\begin{bmatrix}0&1\end{bmatrix}
=\begin{bmatrix}8&8\\12&12\end{bmatrix}+\begin{bmatrix}0&1\\0&1\end{bmatrix}
=\begin{bmatrix}8&9\\12&13\end{bmatrix}
$$

`rows[:, None] * K` 算出每一行的起点，`ks[None, :]` 给出行内的列号，相加就得到小块里每个元素的偏移。8、9、12、13 对应的正好是 A 中的 9、10、13、14。

![二维下标到一维地址：上半部分把 4×4 矩阵 A 按行展开成一维数组；下半部分把 rows 竖放、ks 横放，广播相加得到 2×2 的偏移表，指回一维数组中的 4 个元素](/image/用Triton写GPUKernel_20261101_115708/15-row-major-and-broadcast-offsets.svg)

B 的地址用同样的方法，只是 B 的行由 `ks` 决定、列由 `cols` 决定，每行有 N 个元素：

```python
b_offsets = ks[:, None] * N + cols[None, :]
```

## 4.4 `tl.load` → `tl.dot` → `tl.store`

地址有了，剩下的就是把骨架里的三行换成 Triton 操作。以 Program (0, 0) 为例，`rows = cols = [0, 1]`。

**准备累加器。** 循环开始前，先创建一个全 0 的小矩阵：

```python
acc = tl.zeros((BLOCK_M, BLOCK_N), dtype=tl.float32)
```

`acc` 存的是“到目前为止的部分和”。K 方向没算完之前，结果还不完整，所以不能直接写进 C，要先在 `acc` 里攒着。它只存在于这个 Program 的片上存储里，不占显存。

**读取两个小块。** 第 1 轮 `ks = [0, 1]`，按上一节的公式：

```text
a_offsets = [[0, 1], [4, 5]]   →   a = tl.load(A_ptr + a_offsets) = [[1, 2], [5, 6]]
b_offsets = [[0, 1], [4, 5]]   →   b = tl.load(B_ptr + b_offsets) = [[1, 0], [0, 1]]
```

**相乘并累加。**

```python
acc = tl.dot(a, b, acc)
```

`tl.dot(a, b, acc)` 的含义是 `acc ← acc + a @ b`，这里的 `@` 是矩阵乘法。

**写回结果。** 循环结束后，用 C 的地址表把 `acc` 写回：

```python
c_offsets = rows[:, None] * N + cols[None, :]
tl.store(C_ptr + c_offsets, acc)
```

![Program (0,0) 的完整执行流：两轮中 A 的读取块右移、B 的读取块下移，C 的目标块不变；acc 两次更新后 tl.store 写回](/image/用Triton写GPUKernel_20261101_115708/16-matmul-program-walkthrough.svg)

其他三个 Program 运行的是同一份代码，只是 `rows`、`cols` 不同，所以读取 A 的不同行、B 的不同列，写回 C 的不同位置。四个 Program 都完成后，整个 C 就算好了。

## 4.5 完整代码

把前面几节拼起来，就是完整的 MatMul Kernel。和教学例子相比，这份代码加上了边界 mask，块尺寸改成 32×32，数据类型用 FP16 输入、FP32 累加，这些改动在下一节解释。

```python
import torch
import triton
import triton.language as tl


@triton.jit
def matmul_kernel(
    A_ptr, B_ptr, C_ptr,
    M, N, K,
    BLOCK_M: tl.constexpr,
    BLOCK_N: tl.constexpr,
    BLOCK_K: tl.constexpr,
):
    # ① 我是哪个 Program？
    pid_m = tl.program_id(0)
    pid_n = tl.program_id(1)

    # ② 我负责 C 的哪些行、哪些列？
    rows = pid_m * BLOCK_M + tl.arange(0, BLOCK_M)
    cols = pid_n * BLOCK_N + tl.arange(0, BLOCK_N)

    # ③ 准备累加器
    acc = tl.zeros((BLOCK_M, BLOCK_N), dtype=tl.float32)

    # ④ 沿 K 方向循环
    for step in range(0, tl.cdiv(K, BLOCK_K)):
        ks = step * BLOCK_K + tl.arange(0, BLOCK_K)

        # 地址：A[rows, ks] 和 B[ks, cols]
        a_offsets = rows[:, None] * K + ks[None, :]
        b_offsets = ks[:, None] * N + cols[None, :]

        # 越界位置不读取，填 0
        a_mask = (rows[:, None] < M) & (ks[None, :] < K)
        b_mask = (ks[:, None] < K) & (cols[None, :] < N)
        a = tl.load(A_ptr + a_offsets, mask=a_mask, other=0.0)
        b = tl.load(B_ptr + b_offsets, mask=b_mask, other=0.0)

        # acc ← acc + a @ b
        acc = tl.dot(a, b, acc)

    # ⑤ 写回 C[rows, cols]
    c_offsets = rows[:, None] * N + cols[None, :]
    c_mask = (rows[:, None] < M) & (cols[None, :] < N)
    tl.store(C_ptr + c_offsets, acc.to(tl.float16), mask=c_mask)


def matmul(a: torch.Tensor, b: torch.Tensor) -> torch.Tensor:
    M, K = a.shape
    K2, N = b.shape
    assert K == K2 and a.is_contiguous() and b.is_contiguous()
    c = torch.empty((M, N), device=a.device, dtype=torch.float16)
    BLOCK_M = BLOCK_N = BLOCK_K = 32
    grid = (triton.cdiv(M, BLOCK_M), triton.cdiv(N, BLOCK_N))   # 二维 Grid
    matmul_kernel[grid](a, b, c, M, N, K,
                        BLOCK_M=BLOCK_M, BLOCK_N=BLOCK_N, BLOCK_K=BLOCK_K)
    return c


if __name__ == "__main__":
    torch.manual_seed(0)
    a = torch.randn(70, 45, device="cuda", dtype=torch.float16)
    b = torch.randn(45, 50, device="cuda", dtype=torch.float16)
    c = matmul(a, b)
    ref = a @ b
    print("最大误差:", (c - ref).abs().max().item())
    print("allclose:", torch.allclose(c, ref, atol=1e-2, rtol=1e-2))
```

Kernel 的五个部分可以和前面几节一一对应：

| 步骤 | 代码                                       | 做什么                    | 讲解位置 |
| ---- | ------------------------------------------ | ------------------------- | -------- |
| ①   | `tl.program_id(0)`、`tl.program_id(1)` | 我是哪个 Program          | 3.2      |
| ②   | `rows`、`cols`                         | 我负责 C 的哪几行、哪几列 | 4.2      |
| ③   | `tl.zeros`                               | 准备累加器                | 4.4      |
| ④   | `ks`                                     | 这一轮用 K 方向的哪一段   | 4.2      |
| ④   | `a_offsets`、`b_offsets`               | 这两块数据在显存的哪里    | 4.3      |
| ④   | `tl.load`                                | 读出 A、B 的小块          | 4.4      |
| ④   | `tl.dot`                                 | 小矩阵乘法并累加          | 4.4      |
| ⑤   | `tl.store`                               | 把 C 的 Tile 写回显存     | 4.4      |

这份代码只支持按行连续存储的矩阵，所以 `matmul` 里先检查了 `is_contiguous()`。[Triton 官方 MatMul 教程](https://triton-lang.org/main/getting-started/tutorials/03-matrix-multiplication.html) 的版本会额外传入每个维度的步长（Stride），以支持转置等不连续的布局，还加入了自动调参和改善缓存命中的 Program 排序。本文省略了这些优化。

## 4.6 从教学例子到真实代码

和 4×4 的教学例子相比，完整代码有四处不同。

**块尺寸。** 讲解时用 2×2 是为了能手算。真实的 `tl.dot` 对块尺寸有要求，每个维度通常不能小于 16，而且要是 2 的幂，所以代码里三个 BLOCK 都取 32。块尺寸太小，也用不上 GPU 的矩阵计算单元。

**边界 mask。** 实际矩阵很少能被块尺寸整除。以代码中的 `A: [70, 45]`、`B: [45, 50]` 为例，三个 BLOCK 都是 32：

- Grid = (⌈70/32⌉, ⌈50/32⌉) = (3, 2)，共 6 个 Program。
- 行方向第 3 块（`pid_m = 2`）覆盖第 64～95 行，但矩阵只有第 0～69 行，后 26 行越界。
- 列方向第 2 块（`pid_n = 1`）覆盖第 32～63 列，后 14 列越界。
- K = 45，循环 ⌈45/32⌉ = 2 轮；第 2 轮的 `ks` 是 32～63，后 19 个位置越界。

所以代码里有三个 mask。`a_mask` 同时检查行和 K 方向，`b_mask` 同时检查 K 方向和列，`c_mask` 在写回时检查行和列。二维 mask 的写法和地址一样，用 `[:, None]` 和 `[None, :]` 广播出来。

越界位置填 `other=0.0`。这和第 2 章的道理相同：被屏蔽的位置也参与了计算，填充值必须不影响结果。矩阵乘法是乘积求和，填 0 后，这些位置的乘积都是 0，对 `acc` 没有贡献。

**精度。** 输入用 FP16，因为 GPU 的矩阵计算单元对 FP16 的吞吐量远高于 FP32。但 K 方向要累加很多次，如果累加也用 FP16，舍入误差会不断积累，所以 `acc` 用 FP32，写回前再用 `acc.to(tl.float16)` 转回 FP16。即便如此，结果和 PyTorch 仍可能因为求和顺序不同而有微小差异，所以验证时用带误差范围的 `torch.allclose`，不要求完全相等。

**`tl.constexpr`。** 三个 BLOCK 参数都标成了 `tl.constexpr`，意思是编译时就要知道它们的值。`tl.arange` 和 `tl.zeros` 的形状必须是编译期常量，编译器也要根据块尺寸安排寄存器和矩阵指令。M、N、K 没有标 constexpr，可以在运行时变化，同一份编译结果能处理不同大小的矩阵。

## 4.7 Tiling 为什么能加速

最后回到一个问题：为什么要这样分块？

先说清楚 Tiling 不改变什么。标准矩阵乘法的乘法和加法次数是固定的，M × N × K 次乘加，怎么分块都一样。Tiling 改变的是数据的读取次数。

如果一个 Program 只算 C 中的一个元素，它要读 A 的一整行和 B 的一整列，共 2K 个数，只用来算出一个结果。换成一个 Program 算一个 BLOCK_M × BLOCK_N 的 Tile：每一轮读入的 A 小块有 BLOCK_M × BLOCK_K 个数，其中每个数会和 B 小块的 BLOCK_N 列分别相乘；B 小块里的每个数也会和 A 小块的 BLOCK_M 行分别相乘。**数据读进片上一次，就被用了很多次。Tile 越大，每读一个数能完成的计算越多，也就是上一篇讲过的 Arithmetic Intensity 越高。**

另外，`tl.dot` 一次处理一整块矩阵乘法，编译器可以把它交给 Tensor Core 这样的矩阵计算单元，而逐元素地算乘加做不到这一点。

但 Tile 也不是越大越好。一个 Program 的 `acc`、A 小块和 B 小块都要放在寄存器和 Shared Memory 里，Tile 越大占用越多。每个 SM 的片上资源是固定的，一个 Program 占得多，SM 上能同时驻留的 Program 就少，GPU 用来掩盖访存延迟的并行度也会下降。块尺寸选多大合适，取决于矩阵形状、数据类型和 GPU 型号，通常要靠实际测试来定，这也是官方教程使用自动调参的原因。

## 本章小结

一个 MatMul Program 的全部工作可以写成：

```text
pid_m, pid_n → rows, cols → acc = 0
        ↓
for 每一轮：ks → a_offsets, b_offsets → tl.load → acc = tl.dot(a, b, acc)
        ↓
c_offsets → tl.store
```

需要记住四点：

1. **二维矩阵在显存中是一维的**，按行存储时 `A[i, j]` 的偏移是 `i × K + j`。
2. **`rows`、`cols` 定位输出 Tile，整个循环中不变；`ks` 每轮后移**，决定这一轮读 A 的哪几列、B 的哪几行。
3. **`[:, None]` 和 `[None, :]` 通过广播一次生成整块地址**，二维 mask 也用同样的写法。
4. **`tl.dot(a, b, acc)` 是块级矩阵乘法加累加**，用 FP32 的 `acc` 攒部分和，K 方向全部算完后才写回 C。

