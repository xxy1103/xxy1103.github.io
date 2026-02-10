---
title: 使用Clion遇到的问题
date: 2024-09-21 16:44:41
tags: "Clion"
---
# printf()函数语句执行后不打印

首先我们来看一个简单的代码：

```
#include <stdio.h>
#include <stdlib.h>
int main(void) {
    int n; //矩阵的边长
    printf("请输入矩阵的边长n: ");
    scanf("%d",&n);
    printf("请输入%d*%d的矩阵:",n,n);
    return 0;
}
```

正常情况下输出应该如图所示：

![1726907006144](image/Clion/1726907006144.webp)

但是今天在使用Cion时突然变成这样：

![1726907088990](image/Clion/1726907088990.webp)

可以看到，程序的所有输出都被放到了最后，也就是说我们无法在正确的时机看到printf()的内容

解决方法如下：

```
#include <stdio.h>
#include <stdlib.h>
int main(void) {
    int n; //矩阵的边长
    setbuf(stdout,NULL);
    printf("请输入矩阵的边长n: ");
    scanf("%d",&n);
    printf("请输入%d*%d的矩阵:",n,n);
    return 0;
}

```

在main()函数中加入一句：`setbuf(stdout.NULL)`

加入后即可解决问题。

## 原因

标准输出流的模式被设置为有缓冲模式，计算机会先将需要输出的内容缓冲下来，最后再一并输出。

`setbuf(stdout, NULL)` 用于设置标准输出流 `stdout` 为无缓冲模式。具体来说，这意味着每次调用 `printf` 或其他输出函数时，数据会立即输出到控制台，而不是先存储在缓冲区中。

以下是详细步骤：

1. `setbuf` 是一个标准库函数，用于设置流的缓冲模式。
2. `stdout` 是标准输出流，通常指向控制台。
3. `NULL` 参数表示禁用缓冲，即设置为无缓冲模式。




