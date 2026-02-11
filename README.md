# ulBo Astro Theme

[中文](./README.md) | [English](./README.en.md)

`ulBo` 是一个面向个人博客场景的 Astro 主题模板，强调配置集中、可迁移、可扩展，以及对 SEO/性能的工程化细节优化。

在线示例：[https://blog.ulna520.top](https://blog.ulna520.top)

## 项目简介

- 响应式博客结构：首页、博客归档、标签页、About 页一体化。
- 配置集中在 `src/config/`，适合模板仓库快速改造成个人站点。
- 对“空内容仓库”友好：`src/content/blog/` 可为空，基础页面仍可访问。

## 特性总览

1. 响应式博客布局（`/`、`/blog`、`/tags`、`/about`）

- 页面级断点与移动端适配：`src/pages/*.astro`、`src/styles/global.css`
- 移动端导航抽屉：`src/components/Header.astro`

2. 博客内容迁移（Hexo Frontmatter 部分兼容）

- Frontmatter 兼容字段：`date/pubDate`、`updated/updatedDate`、`categories`、`tags`、`permalink`、`comments`、`layout`、`excerpt`
- 兼容入口与归一化：`src/content.config.ts`
- Hexo 图片相对路径兼容（`image/...` -> `/image/...`）：`src/plugins/remark-hexo-images.mjs`
- 说明：当前是“部分兼容”，不是完整 Hexo 语义迁移，欢迎提交 PR 扩展。

3. 流畅动画设计（Material Design 曲线）

- 页面过渡使用 View Transitions：`src/components/BaseHead.astro`
- Material Design 3 动画曲线（Emphasized/Decelerate/Accelerate）用于页面与交互动画：`src/components/BaseHead.astro`、`src/components/SearchModal.astro`

4. SEO 优化（仅列当前代码已实现项）

- 详见下方“SEO 优化（代码对齐）”章节。

5. KaTeX 数学公式支持

- Markdown 管线：`remark-math` + `rehype-katex`（`astro.config.mjs`）
- 按需加载 KaTeX 样式（仅检测到数学内容时加载）：`src/pages/blog/[...slug].astro`、`src/layouts/BlogPost.astro`

6. 内置 WebP 图片压缩流程

- `npm run build` 默认通过 `scripts/build-with-config.mjs` 读取开关并在构建前执行 `scripts/optimize-blog-images.mjs`
- 开关位置：`src/config/features.mjs` 的 `enableImageOptimizationOnBuild`

7. Lighthouse 导向性能优化

- 图片懒加载、异步解码、按需预加载、延迟加载搜索索引、视口外内容渲染优化等
- 详见下方“Lighthouse 导向性能优化（代码对齐）”章节

## SEO 优化（代码对齐）

以下条目均可从当前仓库代码直接核对：

1. Canonical、robots、Open Graph、Twitter Card、JSON-LD 注入

- `src/components/BaseHead.astro`

2. 首页 `WebSite` 结构化数据

- `src/pages/index.astro`

3. About 页 `Person` 结构化数据

- `src/pages/about.astro`

4. 文章页 `BlogPosting` 结构化数据 + `article:*` 元信息

- `src/layouts/BlogPost.astro`

5. 归档分页 SEO 策略：`/blog/2+` 设为 `noindex,follow`，并输出 `rel=prev/next`

- `src/pages/blog/[...page].astro`

6. sitemap 过滤策略：排除标签页与 `/blog/2+` 分页路径

- `astro.config.mjs`

7. RSS 输出与 description 回退（frontmatter description -> 正文提取 -> title）

- `src/pages/rss.xml.js`
- `src/utils/seo.ts`

8. 重要边界说明

- 当前代码未对标签页显式设置 `noindex`（`/tags` 与 `/tags/[tag]` 页面未传入 `noindex`），README 不做该项声明。

## Lighthouse 导向性能优化（代码对齐）

以下优化项均可在代码中定位：

1. Markdown 图片统一懒加载与异步解码

- `src/plugins/rehype-lazy-images.mjs`

2. 构建期图片转 WebP + Markdown 引用自动替换

- `scripts/optimize-blog-images.mjs`

3. `npm run build` 的构建前预处理链路（可开关）

- `scripts/build-with-config.mjs`
- `src/config/features.mjs`

4. 文章首图预加载 + KaTeX 样式按需加载

- `src/layouts/BlogPost.astro`

5. KaTeX 字体显示策略 patch（`font-display: block` -> `swap`）

- `astro.config.mjs`

6. 视口外图片渲染优化（减少首屏渲染压力）

- `src/components/BaseHead.astro` 中 `.prose img { content-visibility: auto; }`

7. 搜索索引懒加载（首次打开搜索框时再请求）

- `src/scripts/search-modal.client.ts`

8. 主题初始化防闪烁（减少错误主题闪烁）

- `src/components/BaseHead.astro`

## 快速开始

```bash
npm install
npm run dev
```

构建：

```bash
npm run build
```

预览：

```bash
npm run preview
```

## 作为模板使用（详细教程）

### 1) 前置条件

- Node.js 与 npm 已安装
- 建议使用 Node 22（CI 当前使用 Node 22，见 `.github/workflows/ci.yml` 与 `.github/workflows/deploy.yml`）

### 2) 从 GitHub Template 创建项目

1. 在 GitHub 打开本仓库，点击 **Use this template**。
2. 创建你自己的新仓库（建议公开仓库以便后续 GitHub Pages）。
3. 克隆你的新仓库到本地。

### 3) 本地初始化与启动

```bash
npm install
npm run dev
```

默认开发地址通常为：`http://localhost:4321`

### 4) 修改站点配置

优先修改以下文件：

- `src/config/site.ts`
- `src/config/profile.ts`
- `src/config/hero.ts`
- `src/config/features.mjs`

`src/config/index.ts` 是聚合导出入口，通常无需直接改动。

### 5) 添加博客内容

将文章放到 `src/content/blog/`，支持 `.md` 与 `.mdx`。

示例 Frontmatter（兼容 Astro + 部分 Hexo 字段）：

```md
---
title: "我的第一篇文章"
date: 2026-02-11
pubDate: 2026-02-11
updated: 2026-02-12
updatedDate: 2026-02-12
description: "一段用于 SEO 与列表摘要的描述。"
heroImage: "/image/sample-cover.jpg"
categories: ["Astro", "Template"]
tags: ["Blog", "Migration"]
excerpt: "可选摘要字段"
permalink: "custom-slug"
comments: true
layout: "post"
---

正文内容...
```

说明：

- `title` 为必填。
- `date/pubDate` 会归一化为 `pubDate`（优先 `pubDate`）。
- `updated/updatedDate` 会归一化为 `updatedDate`。
- `categories`、`tags` 会归一化为数组。
- `permalink/comments/layout/excerpt` 当前接受并保留，但不代表全部字段都有完整渲染消费逻辑。

### 6) 图片与 WebP 压缩流程

1. 将图片放在 `public/`（例如 `public/image/...`）。
2. 文章中引用 `.png/.jpg/.jpeg` 图片。
3. 执行 `npm run build` 时，若 `enableImageOptimizationOnBuild = true`，会先运行图片优化脚本。

可单独执行：

```bash
npm run optimize:images
```

可选高级参数（直接执行脚本）：

```bash
node scripts/optimize-blog-images.mjs --max-width 1600 --quality 78
```

### 7) 构建与预览

```bash
npm run build
npm run preview
```

### 8) 部署

优先推荐 GitHub Pages（仓库已提供工作流）：

- `.github/workflows/deploy.yml`

你也可以部署到：

- Vercel
- Netlify

## 可配置项总览

### `src/config/site.ts` (`SiteConfig`)

- `siteUrl`: 生产环境站点 URL（canonical、sitemap、RSS 的基础 URL）
- `siteTitle`: 站点标题
- `siteDescription`: 默认描述
- `locale`: 语言区域（BCP-47，例如 `zh-CN`）
- `headerGithubRepoUrl`: 顶栏仓库链接
- `faviconIco`: 全局 favicon 路径（`public/` 下资源）

### `src/config/profile.ts` (`ProfileConfig`, `ProfileSocialLink`)

- `avatar`: 可选头像 URL
- `name`: 名称（About、结构化数据、页脚）
- `title`: 个人标题/角色
- `bio`: 个人简介
- `location`: 可选位置
- `email`: 可选邮箱
- `githubProfileUrl`: 个人 GitHub 地址
- `socials`: 社交链接数组
- `socials[].key`: `github | x | email | website`
- `socials[].label`: 展示名
- `socials[].url`: 链接地址

### `src/config/hero.ts` (`HeroConfig`, `HeroSectionConfig`)

- `home.text` / `home.subtitle` / `home.backgroundImage`
- `blog.text` / `blog.subtitle` / `blog.backgroundImage`
- `tags.text` / `tags.subtitle` / `tags.backgroundImage`
- `about.text` / `about.subtitle` / `about.backgroundImage`
- `postDefaultBackground`: 文章页默认封面（未设置 `heroImage` 时使用）

### `src/config/features.mjs`

- `enableCustomCursorByDefault`: 自定义光标默认开关
- `enableImageOptimizationOnBuild`: 构建前是否默认执行图片优化

### `src/content.config.ts`（博客 Frontmatter 兼容与归一化）

必填字段：

- `title`

可选字段（含兼容项）：

- `date`
- `pubDate`
- `description`
- `updatedDate`
- `updated`
- `heroImage`
- `categories`（字符串或字符串数组）
- `tags`（字符串或字符串数组）
- `permalink`
- `comments`
- `layout`
- `excerpt`

归一化规则：

- `pubDate = pubDate ?? date ?? new Date()`
- `updatedDate = updatedDate ?? updated`
- `categories` 始终转为数组
- `tags` 始终转为数组

## 项目命令

以下命令与 `package.json` 保持一致：

| 命令                        | 说明                                          |
| :-------------------------- | :-------------------------------------------- |
| `npm run dev`             | 启动本地开发服务器                            |
| `npm run build`           | 带特性开关的构建流程（`build-with-config`） |
| `npm run build:astro`     | 仅执行 `astro build`                        |
| `npm run preview`         | 预览生产构建产物                              |
| `npm run astro`           | Astro CLI 原生命令入口                        |
| `npm run optimize:images` | 执行博客图片 WebP 转换与引用替换              |

## 开源协作

- 贡献指南：`CONTRIBUTING.md`
- 行为准则：`CODE_OF_CONDUCT.md`
- 安全策略：`SECURITY.md`
- Issue 模板：`.github/ISSUE_TEMPLATE/`
- CI 工作流：`.github/workflows/ci.yml`
- 部署工作流：`.github/workflows/deploy.yml`

欢迎提交 Issue / PR 来补全 Hexo 迁移兼容、SEO 细节和性能优化方案。

## 许可证

本项目基于 MIT License 开源，详见 `LICENSE`。
