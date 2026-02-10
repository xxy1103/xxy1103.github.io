---
title: 	"AIGC baseline1 学习"
date: 2024-08-14 15:56:56
tags: "Datawhale"
---

# baseline 分析
首先总体分析baseline代码，这段代码可以分为以下几个部分：
    1. 安装依赖：使用pip命令安装所需的Python库，如simple-aesthetics-predictor、data-juicer、pandas等，并卸载旧版本的pytorch-lightning。
    2. 数据加载与预处理：从MsDataset加载数据集，保存图像并创建带有元数据的JSONL文件。配置data-juicer来筛选图像数据。
    3. 模型推理与数据增强：使用CLIPModel进行图像-文本相似度计算，并通过StableDiffusionPipeline生成二次元图像。
    4. 图像生成与保存：生成多幅二次元图像并保存，通过将这些图像拼接成一个更大的图像进行展示。

这些步骤构成了从数据加载、预处理、模型推理到最终图像生成的完整工作流程。

接下来，我们对于这几个部分的代码逐步分析，拆解来看

## 数据加载与预处理

1. 数据集加载：
```
from modelscope.msdatasets import MsDataset

ds = MsDataset.load(
    'AI-ModelScope/lowres_anime',
    subset_name='default',
    split='train',
    cache_dir="/mnt/workspace/kolors/data"
)
```
这里使用MsDataset从ModelScope加载了一个低分辨率的动漫数据集，并将其存储在指定的缓存目录中。
2. 图像与元数据处理：
```
import json, os
from tqdm import tqdm
os.makedirs("./data/lora_dataset/train", exist_ok=True)
os.makedirs("./data/data-juicer/input", exist_ok=True)
with open("./data/data-juicer/input/metadata.jsonl", "w") as f:
    for data_id, data in enumerate(tqdm(ds)):
        image = data["image"].convert("RGB")
        image.save(f"/mnt/workspace/kolors/data/lora_dataset/train/{data_id}.jpg")
        metadata = {"text": "二次元", "image": [f"/mnt/workspace/kolors/data/lora_dataset/train/{data_id}.jpg"]}
        f.write(json.dumps(metadata))
        f.write("\n")

```
    * 文件夹创建：代码创建了两个文件夹train和input，分别用于保存图像和元数据。
    * 数据处理：遍历数据集中的每个样本，将图像转换为RGB格式，并保存到指定目录。随后，将每个图像的路径与对应的文本描述（这里是固定的“二次元”）打包成一个JSON对象，并写入metadata.jsonl文件。
3. 配置文件生成：
```
data_juicer_config = """
#global parameters
project_name: 'data-process'
dataset_path: './data/data-juicer/input/metadata.jsonl'  # path to your dataset directory or file
np: 4  # number of subprocess to process your dataset

text_keys: 'text'
image_key: 'image'
image_special_token: '<__dj__image>'

export_path: './data/data-juicer/output/result.jsonl'

#process schedule
#a list of several process operators with their arguments
process:
    - image_shape_filter:
        min_width: 1024
        min_height: 1024
        any_or_all: any
    - image_aspect_ratio_filter:
        min_ratio: 0.5
        max_ratio: 2.0
        any_or_all: any
"""
with open("data/data-juicer/data_juicer_config.yaml", "w") as file:
    file.write(data_juicer_config.strip())

```
    * 配置文件生成：生成data_juicer的配置文件，用于数据过滤和处理。配置文件指定了项目名称、数据集路径、文本和图像键值、输出路径以及图像筛选的条件。
4. 数据处理执行：
```
!dj-process --config data/data-juicer/data_juicer_config.yaml
```
使用生成的配置文件执行data-juicer的数据处理流程，最终将符合条件的图像和对应的文本保存在指定的输出文件中。

这部分代码主要完成了数据集的加载、图像预处理、元数据生成以及数据筛选的配置和执行，为后续的模型训练和推理打下了基础。

## 模型推理与数据增强
1. 加载CLIP模型和处理器：
```
from transformers import CLIPProcessor, CLIPModel
import torch

model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

```
    * 加载预训练的CLIPModel和CLIPProcessor用于处理图像和文本数据。

2. 计算图像-文本相似度：
```
image = [Image.open(img_path) for img_path in df["file_name"]]
inputs = processor(text=df["text"].tolist(), image=image, return_tensors="pt", padding=True)

outputs = model(**inputs)
logits_per_image = outputs.logits_per_image
probs = logits_per_image.softmax(dim=1)
```
    * 将文本和图像数据输入到模型中，计算它们之间的相似度得分，并通过softmax获得概率分布。

3. 数据集和数据加载器：
```
from torch.utils.data import Dataset, DataLoader

class CustomDataset(Dataset):
    def __init__(self, df, processor):
        self.texts = df["text"].tolist()
        self.image = [Image.open(img_path) for img_path in df["file_name"]]
        self.processor = processor

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        inputs = self.processor(text=self.texts[idx], image=self.image[idx], return_tensors="pt", padding=True)
        return inputs

dataset = CustomDataset(df, processor)
dataloader = DataLoader(dataset, batch_size=8)

```
    * 定义自定义数据集类CustomDataset，将文本和图像处理成模型的输入格式，并使用DataLoader批量处理数据。

4. 批量推理：
```
for batch in dataloader:
    outputs = model(**batch)
    logits_per_image = outputs.logits_per_image
    probs = logits_per_image.softmax(dim=1)
    print(probs)

```
    * 对批量数据进行推理，并打印图像与文本之间的相似度概率。

## 图像生成与保存
1. 加载Stable Diffusion管道：
```
from diffusers import StableDiffusionPipeline

torch.manual_seed(1)
pipe = StableDiffusionPipeline.from_pretrained("CompVis/stable-diffusion-v-1-4", torch_dtype=torch.float16)
pipe = pipe.to("cuda")

```
    * 加载预训练的StableDiffusionPipeline模型，并将其部署到GPU上以提高推理速度。
2. 生成图像：

```
prompt = "二次元，一个紫色长发小女孩穿着粉色吊带漏肩连衣裙，在练习室练习唱歌，手持话筒"
negative_prompt = "丑陋、变形、嘈杂、模糊、低对比度"
guidance_scale = 4
num_inference_steps = 50

image = pipe(
    prompt=prompt,
    negative_prompt=negative_prompt,
    guidance_scale=guidance_scale,
    num_inference_steps=num_inference_steps,
    height=1024,
    width=1024,
).image[0]

image.save("example_image.png")
image

```

    * 使用给定的提示词prompt和negative_prompt生成图像，并将图像保存为文件。
3. 批量生成不同场景的图像：
```
torch.manual_seed(1)
image = pipe(
    prompt="二次元，日系动漫，演唱会的观众席，人山人海，一个紫色短发小女孩穿着粉色吊带漏肩连衣裙坐在演唱会的观众席，舞台上衣着华丽的歌星们在唱歌",
    negative_prompt="丑陋、变形、嘈杂、模糊、低对比度",
    cfg_scale=4,
    num_inference_steps=50, height=1024, width=1024,
)
image.save("1.jpg")

```
    * 使用不同的提示词生成一系列图像，并保存为多个文件。
4. 拼接图像：
```
import numpy as np
from PIL import Image

image = [np.array(Image.open(f"{i}.jpg")) for i in range(1, 9)]
image = np.concatenate([
    np.concatenate(image[0:2], axis=1),
    np.concatenate(image[2:4], axis=1),
    np.concatenate(image[4:6], axis=1),
    np.concatenate(image[6:8], axis=1),
], axis=0)
image = Image.fromarray(image).resize((1024, 2048))
image

```
    * 将生成的图像按照指定顺序拼接成一个大图，并调整尺寸用于展示。