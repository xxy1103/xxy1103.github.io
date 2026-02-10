---
title: 通过python控制米家中的智能设备
date: 2024-09-19 20:44:41
tags: "mi"
---
# python安装mijiaAPI库

借助函数库的github的地址：`https://github.com/Do1e/mijia-api` 本教程高度依赖此库完成。

首先让我们安装mijiaAPI库，使用如下指令：

```
pip install mijiaAPI
```

等待安装完成即可。

# 登录米家账号

此库提供两种登录方式，一种是账号密码登录，使用类 `mijiaLogin.login()`函数；一种是扫码登录，使用 `mijiaLogin.QRlogin()`函数。

由于博主没有通过账号密码成功登录，本博客使用QR码登录的方式实现。

可以参考github仓库中的demo文件，新建login.py文件内容如下：

```
import json
import sys
sys.path.extend(['.', '..'])
from mijiaAPI import mijiaLogin

api = mijiaLogin()
auth = api.QRlogin()
with open('jsons/auth.json', 'w') as f:
    json.dump(auth, f, indent=2)
```

运行后产生二维码，使用米家扫描二维码登录即可。

![1726747311848](image/mijia/1726747311848.webp)

如果程序工作目录下没有jsons文件夹，需要提前手动创建。

运行完后就会将你账号登录需要数据写入在auth.json 中，此后无需再扫码登录，只需直接读取auth.json的内容即可。

![1726747393209](image/mijia/1726747393209.webp)

# 获取设别列表

获取设备列表需要 `from mijiaAPI import mijiaAPI` ,在查询设备列表之前，我们先通过上一步获取的auth登录我们的账号。代码如下：

```
with open('jsons/auth.json') as f:
    auth = json.load(f)
api = mijiaAPI(auth)
```

然后就可以通过 `api.get_devices_list()`函数获取我们的米家账号上绑定的设备。demo中给的示例写入文件后可能无法正确显示中文，

我们加一简单的修改，通过编码格式 `utf-8`来写入文件。

```
devices = api.get_devices_list()['list']
with open('test/devices.json', 'w', encoding="utf-8") as f:
    json.dump(devices, f, indent=2, ensure_ascii=False)
```

在devices.json中通过名称查看我们想要修改的设备，其中要注意我们想要修改的设备是第几个设备，学过计算机的都知道，以0为第一个设备开始计数。

# 查看我们设备设置信息

以博主为例，博主想要控制的设备为米家智能插座3

首先我们打开网站：[米家产品库](https://home.miot-spec.com/)

在网站中搜索我们的设备名称
![1726748638840](image/mijia/1726748638840.webp)

点击日期下方的小字**cuco.plug.v3** 查看设备对应功能的siid和piid。

![1726748828516](image/mijia/1726748828516.webp)

以我的这款插座为例，控制开关的siid为2，开关状态的piid为1。

电量消耗的siid为11:

![1726749163394](image/mijia/1726749163394.webp)

其中查询功率的piid为2。

# 远程控制设备

知道设备的信息以及参数之后，我们就可以尝试通过python程序查询设备的信息或者控制设备了。

查询信息函数 `api.get_devices_prop()`

修改参数函数 `api.set_devices_prop()`

参数为json格式，包含设备的did，siid，piid。

可以创建一个类对设备进行操作

以下为示例：

```python
class plug:
    def __init__(self):
        with open('jsons/devices.json', "r",encoding="utf-8") as f: # 读取设备列表
            devices = json.load(f)
        self.did = devices[1]['did'] # 将设备did赋值给变量
        self.name = devices[1]['name']  # 将设备name赋值给变量
        with open('jsons/auth.json') as f:
            auth = json.load(f)
        self.api = mijiaAPI(auth) # 登录小米账号
    def open(self): # 打开插座
        try:
            ret = self.api.set_devices_prop([
                {"did": self.did, "siid": 2, "piid": 1, "value": True},
            ])
            return self.name + "已打开"
        except: 
            return self.name + "打开失败"
    def close(self): # 关闭插座
        try:
            ret = self.api.set_devices_prop([
                {"did": self.did, "siid": 2, "piid": 1, "value": False},
            ])
            return self.name + "已关闭"
        except: 
            return self.name + "关闭失败"
    def status(self): # 查询插座状态
        try:
            ret = self.api.get_devices_prop([
                {"did": self.did, "siid": 11, "piid": 2},
            ])
            return ret[0]['value']
        except: 
            return 0
```






