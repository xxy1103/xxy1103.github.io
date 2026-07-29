# ulBo Astro Theme

[中文](./README.md) | [English](./README.en.md)

`ulBo` 是一个面向个人博客场景的 Astro 主题模板，强调配置集中、可迁移、可扩展，以及对 SEO/性能的工程化细节优化。

**Astro v6 Ready**：当前版本基于 Astro 6.4.8 构建并完成兼容验证。

在线示例：[https://template.ulna520.top](https://template.ulna520.top)

## 项目简介

- 响应式博客结构：首页、博客归档、标签页、About 页一体化。
- 配置集中在 `src/config/`，适合模板仓库快速改造成个人站点。
- 对“空内容仓库”友好：`src/content/blog/` 可为空，基础页面仍可访问。

## 特性总览

1. 响应式博客布局（`/`、`/blog`、`/tags`、`/about`）

   - 页面级断点与移动端适配：`src/pages/*.astro`、`src/styles/global.css`
   - 移动端导航抽屉：`src/components/Header.astro`
2. 严格文章契约与草稿保护

   - Frontmatter 使用统一的 `title/date/updated/description/draft/categories/tags` 字段
   - 草稿在开发环境中可见并带“草稿”标识，生产构建从所有内容出口排除
   - 分类固定为数组且最多一个；正式文章必须有一个分类和至少一个标签
   - 严格 Schema 与条件校验入口：`src/lib/content/frontmatter-schema.ts`
   - Hexo 图片相对路径兼容（`image/...` -> `/image/...`）：`src/plugins/remark-hexo-images.mjs`
3. 流畅动画设计（Material Design 曲线）

   - 页面过渡使用 View Transitions：`src/components/BaseHead.astro`
   - Material Design 3 动画曲线（Emphasized/Decelerate/Accelerate）用于页面与交互动画：`src/components/BaseHead.astro`、`src/components/SearchModal.astro`
4. SEO 优化（仅列当前代码已实现项）

   - 详见下方“SEO 优化（代码对齐）”章节。
5. KaTeX 数学公式支持

   - Markdown 管线：`remark-math` + `rehype-katex`（`astro.config.mjs`）
   - 按需加载 KaTeX 样式（仅检测到数学内容时加载）：`src/pages/blog/[...slug].astro`、`src/layouts/BlogPost.astro`
6. 内置 WebP 图片压缩流程

   - 图片优化与普通构建相互独立，不会在 `npm run build` 时修改文章或资源文件
   - 使用 `npm run optimize:images:dry-run` 预览，确认后再显式执行 `npm run optimize:images`
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
3. 显式、可预览的图片优化流程

   - `npm run optimize:images:dry-run` 不写入文件
   - `npm run optimize:images` 才生成 WebP 并替换 Markdown 引用
4. 文章首图预加载 + KaTeX 样式按需加载

   - `src/layouts/BlogPost.astro`
5. KaTeX 字体显示策略 patch（`font-display: block` -> `swap`）

   - `astro.config.mjs`
6. 搜索索引懒加载（首次打开搜索框时再请求）

   - `src/scripts/search-modal.client.ts`
7. 主题初始化防闪烁（减少错误主题闪烁）

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

- Node.js 22.12.0 或更高版本
- npm 9.6.5 或更高版本
- 仓库提供 `.nvmrc`，可使用 `nvm use` 切换到项目约定版本

### 2) 从 GitHub Template 创建项目

1. 在 GitHub 打开本仓库，点击 **Use this template**。
2. 创建你自己的新仓库（公开或私有仓库均可）。
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

`src/config/index.ts` 是聚合导出入口，通常无需直接改动。

### 5) 添加博客内容

将文章放到 `src/content/blog/`，支持 `.md` 与 `.mdx`。

示例 Frontmatter：

```md
---
title: "我的第一篇文章"
date: 2026-02-11
updated: 2026-02-12
description: "一段用于 SEO 与列表摘要的描述。"
draft: false
categories: ["教程"]
tags: ["astro", "markdown"]
---

正文内容...
```

说明：

- `title`、`date`、`categories` 和 `tags` 必填；分类与标签必须使用 YAML 数组。
- `draft` 可省略，缺省为 `false`。
- `draft: true` 时允许 `categories: []` 和 `tags: []`。
- 正式文章必须恰好有一个分类、至少一个标签，且标签不得重复。
- `pubDate`、`updatedDate`、字符串形式分类/标签及其他旧字段不再兼容。
- 文章统一使用 `src/config/hero.ts` 中的默认背景，不设置文章级 `heroImage`。

### 6) 图片与 WebP 压缩流程

1. 将图片放在 `public/`（例如 `public/image/...`）。
2. 文章中引用 `.png/.jpg/.jpeg` 图片。
3. 先预览将要发生的转换，不会写入图片或 Markdown：

```bash
npm run optimize:images:dry-run
```

4. 确认结果后，显式执行转换：

```bash
npm run optimize:images
```

`npm run build` 和 `npm run build:astro` 都只构建网站，不会触发图片转换。

可选高级参数（直接执行脚本）：

```bash
node scripts/optimize-blog-images.mjs --max-width 1600 --quality 78
```

使用 `--force` 可忽略参数感知缓存并重新生成；缓存位于 `.astro/`，不会提交到仓库。

### 7) 构建与预览

```bash
npm run build
npm run preview
```

### 8) 部署

推荐使用 Cloudflare Workers Static Assets。仓库已包含 `wrangler.jsonc`，连接 GitHub 仓库后配置：

- 构建命令：`npm run build`
- 部署命令：`npm run deploy`
- 根目录：`/`
- Node.js：`22.12.0`（同时由 `.nvmrc` 固定）

推送到生产分支后，Cloudflare 会自动构建并部署 `dist/`。如需手动部署，可在完成 Cloudflare 登录后运行：

```bash
npm run build
npm run deploy
```

也可以部署到 Cloudflare Pages、Vercel 或 Netlify，构建输出目录均为 `dist/`。

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
- `postDefaultBackground`: 所有文章页共享的默认封面

### `src/content.config.ts`（严格博客 Frontmatter 契约）

必填字段：

- `title`
- `date`
- `categories`（字符串数组，最多一个）
- `tags`（字符串数组）

可选字段：

- `description`
- `updated`
- `draft`（布尔值，缺省为 `false`）

条件校验：

- 草稿允许空分类和空标签，但分类仍不能超过一个。
- 正式文章必须恰好有一个分类和至少一个标签。
- 所有分类、标签及文本字段会去除首尾空格，并拒绝空字符串。
- 重复标签及 Schema 未声明的旧字段会导致内容校验失败。
- 生产环境通过 `getBlogPosts()` 统一排除草稿，覆盖首页、归档、详情路由、标签、搜索索引和 RSS。

## 项目命令

以下命令与 `package.json` 保持一致：

| 命令                          | 说明                                      |
| :---------------------------- | :---------------------------------------- |
| `npm run dev`                 | 启动本地开发服务器                        |
| `npm run build`               | 构建网站，不修改文章或图片资源            |
| `npm run build:astro`         | `astro build` 的显式别名                   |
| `npm run check`               | 执行 `astro check` 类型与模板校验          |
| `npm run preview`             | 预览生产构建产物                          |
| `npm run astro`               | Astro CLI 原生命令入口                    |
| `npm run optimize:images`     | 生成 WebP 并替换博客图片引用              |
| `npm run optimize:images:dry-run` | 预览图片优化结果，不写入任何文件       |

## 重构后的开发约定（2026-02）

- 页面壳层统一使用 `src/layouts/PageShell.astro`（文章详情保持 `BlogPost` 专用布局）。
- 博客内容读取统一从 `src/lib/content/blog.ts` 获取，不再在页面里重复 `getCollection` 逻辑。
- 摘要与 SEO 文本统一使用 `src/lib/content/text.ts`。
- 个人社交链接解析统一使用 `src/lib/profile/social.ts`。
- 页面交互脚本放在 `src/scripts/pages/*`，通过 `src/scripts/pages/registry.ts` 注册。
- 页面关系与依赖图见 `docs/frontend-architecture-map.md`。

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
