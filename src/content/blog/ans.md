---
title: 计算机系统基础第三次作业
date: 2024-11-4 10:25:44
categories: 作业
tags: 计算机系统基础
---
# 3.58

![1730709979145](image/ans/1730709979145.webp)

首先我们给每一行先添加注释，看看这些汇编代码的作用：

```
decode2:
    subq %rdx, %rsi  //将%rsi-=%rdx
    imulq %rsi, %rdi //%rdi *= %rsi;
    movq %rsi, %rax  //%rax = %rsi
    salq $63, %rax   //%rax 左移63位
    sarq $63, %rax   //%rax右移63位
    xorq %rdi, %rax  //%rax 与$rdi做异或
    ret		     //返回函数
```

所以我们再写出c代码如下：

```c
    long decode2(long x, long y, long z)
    {
        y -= z;          // y = y - z
        x *= y;          // x = x * y
        long result = y; // result = y
        result <<= 63;   // result = result << 63
        result >>= 63;   // result = result >> 63
        result ^= x;     // result = result ^ x
        return result;   // return result
    }
```

# 3.60

![1730710000931](image/ans/1730710000931.webp)

```
loop:
    movl %esi, %ecx  ; 将n的值复制到ecx
    movl $1, %edx    ; 将1赋值给edx（作为mask的初始值）
    movl $0, %eax    ; 将0赋值给eax（作为result的初始值）
    jmp   .L2 
.L3:
    movq %rdi, %r8  ; 将x的值复制到r8
    andq %rdx, %r8  ; 将x与mask进行按位与操作，结果存入r8
    orq  %r8, %rax  ; 将r8的值与result进行按位或操作，结果存入rax
    salq %cl, %edx  ; 将mask左移ecx位（即n位）
.L2:
    testq %rdx, %rdx ; 测试mask是否为0
    jne .L3         ; 如果不为0，则跳转回.L3
    rep; ret        ; 循环结束，返回
```

A): `%rdi`存储x，`%esi`存储n，`%eax`存储result，`%edx`存储mask。

B): result = 0 ,mask = 1。

C): `testq %rdx, %rdx` mask != 0是进入循环的条件

D): `salq %cl, %edx ` 每次将mask左移n位

E): x 与 mask 按位与后的结果和result 进行按位或运算，最终结果赋给result。

F):

补全c代码如下：

```c

longloop(longx,intn) {

    long result =0;

    long mask;

    for (mask =1; mask !=0; mask = mask << n) {

        result = result | (x & mask);

    }

    return result;

}

```
