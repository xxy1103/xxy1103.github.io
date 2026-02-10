---
title: 原生安卓wifi去除感叹号

date: 2024-09-10 12:13:56

tags: "android"
---
通过abd输入两条命令：

```
adb shell "settings put global captive_portal_http_url http://connect.rom.miui.com/generate_204" 作者：乱杠青年 https://www.bilibili.com/read/cv16146843/ 出处：bilibili
```

```
adb shell "settings put global captive_portal_https_url https://connect.rom.miui.com/generate_204" 作者：乱杠青年 https://www.bilibili.com/read/cv16146843/ 出处：bilibili
```

依次执行后手机打开飞行模式再关闭飞行模式就可以了！
