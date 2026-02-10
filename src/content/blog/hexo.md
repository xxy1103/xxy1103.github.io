---
title: hexo搭建
date: 2024-07-03 23:14:41
tags: "hexo"
---
由于我将hexo搭建在闲置手机上，环境是安卓10+安卓终端termux，以下为过程记录：  
### termux 安装 nodejs

`apt install nodejs`

安装完成后通过`node -v`和`node -v`检测是否安装成功与安装版本

### 安装git

hexo的安装依赖git，所以安装hexo之前，需要先安装git
`pkg install git -y` 安装git，其中 -y是一个参数，表示过程中的所有选择均选择yes

### 安装Hexo

阅读Hexo官方文档，通过 `npm install -g hexo-cli`安装Hexo

### 运行Hexo

在运行hexo之前，需要先通过
`mkdir <name>`
来创建一个hexo服务运行的文件夹
然后通过
`cd <name>`
打开文件夹
执行
`npm install`
最后可以通过
`hexo server`
来运行hexo。
至于hexo配置文件编写参考[hexo官方文档](https://hexo.io/zh-cn/docs/configuration)

### 关于Front-matter

Front-matter是每个markdown文件开头的一段标记参数，形如：
```
---
title: hexo搭建
参数2:
参数3:
---
```

[hexo的Front-matter参考](https://hexo.io/zh-cn/docs/front-matter)

我还安装了主题；[主题的Front-matter参考](https://kyori.xyz/2021/07/081100.html)