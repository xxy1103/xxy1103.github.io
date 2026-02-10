---
title: termux 备份与恢复
date: 2024-07-07 15:14:41
tags: "termux"
---

## 备份termux
首先获取termux对于手机的储存权限
```
termux-setup-storage
```

建立备份压缩包，此命令会备份Termux外部目录的资料，不包含proot-distro，并将其储存为手机内部空间的"termux-backup.tar.gz"文件。备份时间视Termux占用的空间而定，例如10GB约需要10分钟，生成的压缩包约为5GB。
```
tar -zcf /sdcard/termux-backup.tar.gz -C /data/data/com.termux/files ./home ./usr
```
没有Root权限下，只能用proot-distro backup命令另外备份proot-distro的资料成一个压缩包，需指定proot-distro的代号：
```
proot-distro backup --output /sdcard/debianbackup.tar.gz debian
```

如果有Root权限，以下版本的命令则能连proot-distro内部目录的资料一起备份成单一压缩包，无须再使用proot-distro backup命令。

```
pkg install tsu

sudo tar -zcf /sdcard/termux-backup.tar.gz -C /data/data/com.termux/files ./home ./usr
```

## 还原Termux备份

重装termux 后，还原termux备份不需要root权限。

同样先获取储存权限：
```
termux-setup-storage
```
假设备份位于手机更目录下（/sdcard/termux-back.tar.gz）
```
tar -zxf /sdcard/termux-backup.tar.gz -C /data/data/com.termux/files --recursive-unlink --preserve-permissions
```
执行此操作后当前termux的内容将被覆盖

恢复proot-distro容器:
```
proot-distro restore /sdcard/debianbackup.tar.gz
```

输入`exit`退出termux 后再重新打开app就ok了

[Termux回复包&备份教程](https://www.bilibili.com/read/cv21412692/)

