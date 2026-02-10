---
title: termux服务自启动
date: 2024-07-04 22:35:56
tags: "termux"
---
## 首先安装termux-services服务，用于管理自启动服务
`pkg install termux-services -y`

## 以sshd服务为例
`sv-enable sshd` sshd服务设为自启动
`sv-disable sshd` 取消sshd自启动
`sv down sshd` 停止sshd服务，并使本次Termux运行期间sshd自启动服务失效
`sv up sshd` 启动sshd服务
`sv status sshd` 查看sshd服务运行状态
`sv start sshd` 临时启动sshd，但不设置为自启动状态，相当于ssh命令
`pkill ssh`   杀死sshd服务，但如果自启动为生效状态，sshd服务会立即重启

## 自己编写启动脚本

1. `cd /data/data/com.termux/files/usr/var/service` 目录
2. `mkdir <name>`
3. `cd <name>` 
4. `vim run` 建立脚本，内容如下（注意名字为run）
```
#!/data/data/com.termux/files/usr/bin/bash

cd ~/storage/hexo

hexo server
```

5. `chmod +x run` 保存并执行
6. `sv-enable <name>` 将自己编辑的服务设为自启动


参考文献：[Termux设置——服务自启动](https://superigbt.github.io/2023/01/13/termux/termux-service/)

