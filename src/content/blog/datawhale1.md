---
title:  "Datawhale AI夏令营 AIGC task3 笔记"


date: 2024-08-17 15:58:56


tags: "Datawhale"
---
# Lora 微调

在人工智能生成内容（AIGC）领域，LoRA（Low-Rank Adaptation）是一种用于高效微调大型语言模型的方法。LoRA 的主要目标是通过引入低秩矩阵来减少微调过程中需要更新的参数数量，从而降低计算和存储成本。

一言以概之，lora是一种针对种概念，任务，场景，单独微调的模型，它可以准确的让大模型针对某一概念拥有充分的理解，从而快速准确的画出我们想要的内容。

接下来我们将一同熟悉一下如何训练一个属于自己的Lora。

这里博主推荐使用b站up主[秋葉aaaki的整合包](https://www.bilibili.com/video/BV1AL411q7Ub/?spm_id_from=333.999.0.0)

## 数据准备

博主是一个二次元，最近非常喜欢败犬女主中的八奈见，这里我就以这个动漫人物为例子 ，来准备数据。

1. 针对一个人物训练，我们需要关于这个人物的照片，总体应该越多越好，但是太多重复的对训练也没有好的效果，我们需要寻找这个人物各种各样，能体现出角色特点的图片。这里博主实测，三十多张，已经能有不错的效果。当然，图片越高清越好。

![1723878849426](image/datawhale1/1723878849426.webp)

2. 这里我们截图得到的数据，分辨率是不相同的，也都不标准，在进行Lora训练时，我们需要把图片裁切为2^n * 2^n, 这里博主采用全都变为512*512来进行训练。本想通过python把所有图片裁切为512 * 512,但是裁切过后画幅都太小，只能显示人物的脸。
   ![1723879129499](image/datawhale1/1723879129499.webp)
   索性最后找到一个免费的[图片处理网站](https://www.iloveimg.com/),成功将所有图片都变为512 * 512 。
3. 我们需要为每张图片生成数据标签，这样大模型才能知道，每张图片中的图像究竟对应着怎样的提示词，我们当然可以人工的为每张图片手写标签，但是那样实在是过于费时费力。好在大佬的lora训练整合包中，自带了一键为图片添加标签的功能。我们打开下载好的sd-rainer

   ![1723879710748](image/datawhale1/1723879710748.webp)

   点击WD 1.4 标签器。

   ![1723880146282](image/datawhale1/1723880146282.webp)
   填好之后点击开始，很快就会帮你为每张图片添加tag。
   ![1723880204939](image/datawhale1/1723880204939.webp)

## 开始训练

   在准备好图片与tag后，我们就可以正式开始训练啦。博主也是新手，

   ![1723880331646](image/datawhale1/1723880331646.webp)

   ![1723880345893](image/datawhale1/1723880345893.webp)

   ![1723880380319](image/datawhale1/1723880380319.webp)简单调好三个参数之后就可以开始训练啦。

   ![1723880515842](image/datawhale1/1723880515842.webp)

   博主的电脑是4060，训练了30分钟左右。

![1723881412746](image/datawhale1/1723881412746.webp)

在output文件夹中，这个文件就是我们训练出来的lora了。我的lora模型链接为：[败北女主队-可图Kolors训练-yanami · 模型库 (modelscope.cn)](https://modelscope.cn/models/ulnaxx/yanami)。最后放几张用我的lora绘画的老八。

![1723881516140](image/datawhale1/1723881516140.webp)

![1723881566237](image/datawhale1/1723881566237.webp)

# 使用comfyui

## 在魔塔中体验comfyui

首先在魔塔中打开gpu实例，在Terminal中输入以下代码

```
git lfs install
git clone https://www.modelscope.cn/datasets/maochase/kolors_test_comfyui.git
mv kolors_test_comfyui/* ./
rm -rf kolors_test_comfyui/
mkdir -p /mnt/workspace/models/lightning_logs/version_0/checkpoints/
mv epoch=0-step=500.ckpt /mnt/workspace/models/lightning_logs/version_0/checkpoints/   
```

![1723886088793](image/datawhale1/1723886088793.webp)

然后将ComfyUI.ipynb中的代码依次执行。

### 体验工作流

将以下文件导入到comfyui中，即可创建好我们提前预设好的工作流。

[文件下载](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/all/IC28b3uc0oOXZXxZZdHcMQUOnQh/?mount_node_token=VcoZdkFijozFv0xogyxc9wb1nDe&mount_point=docx_file)

![1723886562746](image/datawhale1/1723886562746.webp)

导入成功后，点击Queue Prompt即可开始流式生成图片

带lora的工作流

[文件下载](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/all/ONWFblDShoqTMbx6mgmceJTSnWf/?mount_node_token=KkEAde18EoVfITxuwwRcLXEbnCf&mount_point=docx_file)


![1723886546650](image/datawhale1/1723886546650.webp)























