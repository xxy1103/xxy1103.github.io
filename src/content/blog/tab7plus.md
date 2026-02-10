---
title: 	"利用termux搭建桌面级生产力工具"
date: 2024-10-10 22:00:56
tags: "termux"
---
# 前期准备

要想在安卓设备上搭建桌面级别的生产力环境需要借助termux终端以及一些外围组件来完成，本教程参考bilibili视频：[【教程】用Termux搭建桌面级生产力环境](https://www.bilibili.com/video/BV15J4m1g7MW/)

首先我们来准备所需要的软件：

1. termux
2. termux-x11
3. VNC  viewer(可选)

需要用到的github仓库：

1. [termux](https://github.com/termux/termux-app)
2. [termux-x11](https://github.com/termux/termux-x11)
3. [mobox](https://github.com/olegos2/mobox)

## 下载安装termux

可以在github仓库中下载或者前往[F-Droid](https://f-droid.org/)下载

## 下载安装termux-x11

在github仓库中下载：

一般的安卓手机/平板下载我圈出来的那个版本，当然具体还是要根据自己的处理器架构来选择。

![1728555963947](image/tab7plus/1728555963947.webp)

# 开始配置环境吧

## 换源

在国内的朋友们如果使用官方镜像源的话可能会速度很慢甚至断连，我们可以使用指令 `termux-change-repo`来通过官方的图形化界面来切换镜像源，回车是确认，空格是选择，方向键用来上下选择。

## 了解apt包管理器

`apt` 是 Debian 及其衍生发行版（如 Ubuntu）中使用的高级包管理工具。它用于安装、更新、删除和管理软件包。以下是一些常用的 `apt` 命令：

1. **更新包列表** ：

   **apt** **update**

   这会从软件源中获取最新的软件包列表。
2. **升级已安装的软件包** ：

   **apt** **upgrade**

   这会升级系统中所有已安装的软件包到最新版本。
3. **安装新软件包** ：

   **apt** **install** <**package_nam**e>

   例如，安装 `curl`：

   **apt** **install** **curl**
4. **删除软件包** ：

   **apt** **remove** <**package_nam**e>

   例如，删除 `curl`：

   **apt** **remove** **curl**
5. 移除指定的软件包并清除其配置文件：

   ```
   apt purge <package_name>
   ```
6. **清理不再需要的软件包** ：

   **apt** **autoremove**

   这会删除系统中不再需要的依赖包。
7. **搜索软件包** ：

   **apt** **search** <**package_nam**e>

   例如，搜索 `curl`：

   **apt** **search** **curl**

`apt` 是一个强大的工具，简化了软件包的管理过程，使得在 Debian 系统上安装和维护软件变得更加容易。

## 安装x11-repo

为了下一步安装xfce4，我们需要先安装x11-repo

1. 先更新apt软件列表

   ```
   apt update
   ```
2. 安装x11-repo

   ```
   apt search x11-repo
   ```

## 安装xfce4

```
apt update
apt install xfce4

```

安装xfce4大约需要1G的空间，下载时间或许很久需要耐心等待。

## 安装x11服务器

```
apt install termux-x11-nightly
```

至此你以及完成了安装最基本的桌面以及显示平台，接下来就是启动它的步骤了。

# 启动桌面环境

1. 开启虚拟服务

   ```
   termux-x11 :0 &>/dev/null &
   ```

   1. 第一个词 `termux-x11`表示我们启动的服务
   2. `：0`表示将启动服务的编号设置为0
   3. `&>/dev/null`表示将输出的信息都重定向到/dev/null，这个特殊文件称为黑洞，即不显示输出信息
   4. 末尾的&可让命令在后台执行而不阻塞终端
2. 设置环境变量

   ```
   export DISPLAY=:0
   ```

   **export** 用于将变量设置导出到当前shell环境子进程中，用法为 `export [变量名]=[值]`

   **DISPLAY**变量用于控制“在哪里绘制和显示图形界面”

   这句的作用是让下一步启动的xfce4知道该把输出的桌面输出到哪里
3. 启动xfce4

   ```
   startxfce4
   ```

> **提示：** 如果遇到CANNOT LINK EXECUTABLE "xfce4-session": library "libexpat.so.1" not found: needed by /data/data/com.termux/files/usr/lib/libfontconfig.so in namespace (default)错误，可尝试使用命令 `apt install libexpat`解决

现在我们打开x11 就能看见桌面了

![1728558686027](image/tab7plus/1728558686027.webp)

如果提示没有文件访问权限就输入命令：

```
termux-setup-storage
```

# 后台保活

## 关于Phantom Processes Killing

在 Android 12 中引入了一个名为**Phantom Processes Killing**(影子进程杀手)的机制，该机制将监视应用程序派生的子进程，并在达到**32个以上子进程**时将其终止，以避免占用过多的CPU资源

Termux中的所有程序都属于Termux的子进程，如果你使用xfce的**任务管理器**(使用 `apt install xfce4-taskmanager`安装)查看进程数，就会发现当进程数大于32时Termux:x11的画面将大概率忽然断开，并且在Termux输出 `Process completed(signal 9)`的信息

> **提示：** 进程之间可以以树形关系表示

## 关闭Phantom Processes Killing

原来的视频里博主的方法并非所有手机都能适用，这里教一种普遍通用的方法，通过adb命令行来关闭

1. 手机打开开发者模式
2. 允许adb调式
3. 连接电脑
4. 电脑在powershell中输入：

   ```
   adb devices
   ```

   ![1728559422308](image/tab7plus/1728559422308.webp)
5. 有设备连接就ok
6. 输入如下两条命令：设置最大子进程为65536

   ![1728559646236](image/tab7plus/1728559646236.webp)

   ```
   adb shell device_config set_sync_disabled_for_tests persistent
   adb shell device_config put activity_manager max_phantom_processes 65536
   ```

   若没有电脑可以参考这份blog：[解决安卓12限制32个线程](https://www.hestudio.net/posts/Solve-32-restrictions-of-Android-12-restrictions.html)

## 关闭系统优化

针对不同手机系统有较大差异，无法一概而论，这里不再展示，总之就是要关闭/减少系统对于termux 的电量优化。

# 启动脚本

为了简化我们的桌面启动流程，可以将所有的代码制作成一个脚本，方法如下：

1. 打开PATH路径

   `cd $PATH`
2. 创建文件

   ```
   nano startx11
   ```
3. 输入以下内容

   ```
   #!/bin/bash

   export DISPLAY=:0
   termux-x11 :0 &>/dev/null &
   sleep 3
   startxfce4 &>/dev/null &
   am start --user 0 -n com.termux.x11/.MainActivity &>/dev/null
   ```
4. 使用 `Ctrl+O`触发保存，确定写入的文件名为 `startx11`按回车继续，然后使用 `Ctrl+X`退出文本编辑器
5. 使用以下命令为脚本添加执行权限

   ```
   chmod +x startx11

   ```

完成以上步骤后，我们就能通过快捷指令 `startx11`来启动我们的桌面。

# 安装linux环境

首先安装proot

```
pkg install proot-distro
```

然后通过指令 `proot-distor list` 查看可以安装的linux 发行版本。

![1731980148644](image/tab7plus/1731980148644.webp)

我们也可以看到下面提示说，通过指令 `proot-distro install <alias>` 来安装指定的linux版本。

这里我选择安装ubuntu：

![1731980254831](image/tab7plus/1731980254831.webp)

安装完成后：

![1731980291293](image/tab7plus/1731980291293.webp)

依然提示我们如何进入ubuntu系统：`proot-distro login ubuntu`

输入之后我们就进入linux 系统啦。
