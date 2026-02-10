---
title:  "openwrt 软路由设置"

date: 2024-08-28 21:13:56

tags: "openwrt"
---
本教程使用设备：极路由3 （hc5861).

# 打开端口，装breed，刷openwrt

打开极路由端口，装好breed的教程可以参考如下图片：

需要使用的工具：WinSCP、putty。以及对应的breed和openwrt固件。openwtr官方还在维护（2024年）可以从openwrt官方网站下载，[下载地址](https://firmware-selector.openwrt.org/)。breed请自行寻找。

breed装好后，进入方法如下：

1. 拔掉电源，使路由器完全断电
2. 按住reset按钮
3. 插入电源，等待几秒，面板灯光闪烁时松开reset。
4. 电脑网线连接路由器，打开浏览器输入 ` 192.168.1.1`进入breed管理界面。

之后就可以在breed中上传自己电脑中下载好的openwrt固件，选择刷入，等待开机。

# openwrt配置

默认登录账号为：root 密码为：password

登录后界面如下：

![1724851441764](image/openwrt/1724851441764.webp)

博主的极路由通过无线中继联网，以下讲解openwrt无线中继的方法：

1. 首先打开Network中的Wireless选项

   ![1724851565427](image/openwrt/1724851565427.webp)
2. 选择一个点击 `Scan`，极路由第一个为5g频段天线，第二个为2.4g频段。选择要中继的wifi点击 `Join Network`

   ![1724851723827](image/openwrt/1724851723827.webp)
3. 勾选 `Replace wireless configuration`，并且输入wifi密码，最后点击Submit

   ![1724851847730](image/openwrt/1724851847730.webp)
4. 接下来的界面保持默认不变，直接点击 `Save`

   ![1724851888144](image/openwrt/1724851888144.webp)
5. 最后点击 `Save & Apply`。等待路由器连接上wifi。

## openwrt 汉化

1. 打开system中的software

   ![1724852365957](image/openwrt/1724852365957.webp)
2. 点击 `Update lists...` 加载可用的插件，然后在搜索框中输入 `luci-i18n-base-zh-cn`

   ![1724852574204](image/openwrt/1724852574204.webp)
3. 安装即可，安装后刷新页面即为中文。

## openwrt挂载sd卡或u盘

### ext4 文件格式的opw

路由器大部分的硬盘空间极小，极路由3在安装完openwrt后，只有9m的剩余空间可以装插件，可以说是完全不够用，这是我们就需要挂载sd卡或u盘来作为插件或应用的安装空间。

1. 安装 `block-mount`插件

   ![1724852870173](image/openwrt/1724852870173.webp)
2. 重启后可以在 `系统`中找到挂载点，如下勾选功能

   ![1724853903295](image/openwrt/1724853903295.webp)
3. 然后我们在下面找到我们插入的sd卡，点击编辑。

   ![1724853957109](image/openwrt/1724853957109.webp)
4. 选择 `作为根文件系统使用（）`，并且勾选 `已启用`，然后点击保存。

   ![1724854153325](image/openwrt/1724854153325.webp)
   然后我们打开putty，ssh连接极路由，按顺序执行以下指令：

   ```
   mkdir -p /tmp/introot
   mkdir -p /tmp/extroot
   mount --bind / /tmp/introot
   mount /dev/mmcblk0p1 /tmp/extroot 
   tar -C /tmp/introot -cvf - . | tar -C /tmp/extroot -xf -
   umount /tmp/introot
   umount /tmp/extroot
   ```

   最后输入 `reboot`重启系统后扩容即成功。

## openwrt 换源

当执行opkg update 或者opkg install失败时，可以考虑更换软件源。

这里给出openwrt 的官方软件源地址:[官方源](https://downloads.openwrt.org/releases/)

![1724907487942](image/openwrt/1724907487942.webp)

在官方源中找到与自己版本号、处理器架构相同的文件夹，并将网址路径复制下来替换原本的源。

这里再给出阿里源的地址：[阿里源](https://mirrors.aliyun.com/openwrt/releases/)

再执行opkg update既可。

### 报错

1. 博主不知为何，还遇到了一个报错：

   ```
   OpenWrt——Could not lock /var/lock/opkg.lock: Resource temporarily unavailable.
   ```

   在csdn上找到解决办法，亲测有效，但博主不知道原理：

   ```
   echo "nameserver 114.114.114.114">/tmp/resolv.conf
   rm -f /var/lock/opkg.lock
   opkg update
   ```
2. 签名验证失败：
   ![1724907960749](image/openwrt/1724907960749.webp)

   解决办法：移除签名验证，也就是删除opkg.config的

   ```
   option check signature
   ```

## openwrt配置git，ssh，使用github

1. 安装git

   ```
   opkg install git
   ```

   安装完成后配置git

   ```
   git config --global user.name "xxx"
   git config --global user.email "xxx@yyy"
   ```
2. 安装ssh功能

   ```
   opkg install openssh-keygen openssh-client
   ```

   安装这两个包，前者负责生成密钥和公钥，后者负责作为客户端与其它主机连接。

   配置ssh

   ```
   ssh-keygen -t rsa -C "xxx@yyy"
   ```

   等待生成。生成成功后，id_ras和id_rsa.pub 在 `~/.ssh`下，可以通过

   ```
   cat ~/.ssh/id_rsa.pub
   ```

   显示公钥，复制到github即可。
3. 验证ssh是否添加成功

   ```
   ssh -T git@github.com
   ```

   如下显示即为配置成功！
   ![1724911006234](image/openwrt/1724911006234.webp)

## openwrt更新内核

在安装软件时，我们常常遇到内核版本不匹配的情况。尤其是在使用第三方编译好的整合包时，内核往往过于老旧。
下面我们来看看如何更新内核：

1. 下载内核
   首先我们在openwrt官方镜像源[openwrt](https://downloads.openwrt.org/snapshots/targets)中找到自己对应型号的package文件夹，以博主的极路由3为例，最终网址为：

   [Index of /snapshots/targets/ramips/mt7620/packages/ (openwrt.org)](https://downloads.openwrt.org/snapshots/targets/ramips/mt7620/packages/)
2. 按 Ctrl+F 在搜索框中输入kernel

   ![1725028762371](image/openwrt/1725028762371.webp)
3. 下载后通过web上传到openwrt，通过opkg安装

   ```
   opkg install kernel_6.6.47~45bb0fcc798008dbb237353aed14fdee-r1_mipsel_24kc.ipk
   ```

安装完成后虽然web中kernel的版本号没变，但此时再安装对应版本的插件，就会发现可以正常安装了。

注意：kernel 只能升级不能降级
