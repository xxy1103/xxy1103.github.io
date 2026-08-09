# ulBo Astro Theme

<p align="center">
  <strong>一个兼顾视觉表达、长文阅读与发布工程的 Astro 个人博客主题。</strong>
</p>

<p align="center">
  <a href="./README.md">中文</a> ·
  <a href="./README.en.md">English</a>
</p>

<p align="center">
  <a href="https://astro.build/"><img alt="Astro 6" src="https://img.shields.io/badge/Astro-6.4.8-BC52EE?logo=astro"></a>
  <a href="https://nodejs.org/"><img alt="Node.js 22+" src="https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white"></a>
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
</p>

<p align="center">
  <a href="https://template.ulna520.top"><strong>在线预览</strong></a> ·
  <a href="https://blog.ulna520.top">真实博客</a> ·
  <a href="https://astro.build/themes/details/ulbo/">Astro 主题商城</a> ·
  <a href="https://github.com/xxy1103/ulbo_vscode">VS Code 文章管理工具</a>
</p>

![ulBo Astro Theme 总览](./docs/images/promo/ulbo-overview.png)

## 为什么选择 ulBo

ulBo 面向希望长期维护个人内容的写作者、开发者和独立创作者。它不只提供一套博客页面，还把阅读体验、内容组织、搜索发现、SEO、图片优化和日常写作流程组合成一套完整方案。

| 方向 | 能力 |
| --- | --- |
| **视觉与动效** | 沉浸式 Hero、响应式布局、明暗主题，以及基于 Astro View Transitions 和 Material Design 3 曲线的页面动效。 |
| **长文阅读** | 固定目录、字数与阅读时长、代码复制、KaTeX 公式、Mermaid 图表、图片灯箱和适合打印的 PDF 导出。 |
| **内容发现** | Fuse.js 模糊搜索、`Cmd/Ctrl + K` 快捷入口、文章归档、标签筛选与分页。 |
| **发布质量** | 严格 Frontmatter、草稿隔离、RSS、Sitemap、Canonical、Open Graph、Twitter Card 和 JSON-LD。 |
| **配置与迁移** | 站点、个人资料和 Hero 内容集中在 `src/config/`；支持 Markdown / MDX 与 Hexo 风格图片路径。 |
| **性能工程** | 图片懒加载、异步解码、按需 KaTeX、延迟搜索索引、预取策略，以及可预览的 WebP 优化流程。 |

## 主题预览

<table>
  <tr>
    <td width="50%"><img src="./docs/images/promo/ulbo-light-dark.png" alt="ulBo 明暗主题"></td>
    <td width="50%"><img src="./docs/images/promo/ulbo-longform.png" alt="ulBo 长文阅读"></td>
  </tr>
  <tr>
    <td align="center"><strong>一致的明暗主题体验</strong></td>
    <td align="center"><strong>为技术长文准备的阅读工具</strong></td>
  </tr>
</table>

![ulBo 搜索、标签、归档与 About 页面](./docs/images/promo/ulbo-content.png)

## 快速开始

点击 GitHub 仓库中的 **Use this template** 创建自己的博客，然后运行：

```bash
npm install
npm run dev
```

默认访问地址为 `http://localhost:4321`。

环境要求：

- Node.js 22.12.0 或更高版本
- npm 9.6.5 或更高版本

## 配置博客

通常只需要修改以下位置：

| 文件 | 用途 |
| --- | --- |
| `src/config/site.ts` | 网站地址、标题、描述、语言和仓库链接 |
| `src/config/profile.ts` | 头像、身份介绍、联系方式和社交链接 |
| `src/config/hero.ts` | 首页、归档、标签、About 和文章默认 Hero |
| `src/content/blog/` | Markdown / MDX 文章 |
| `public/image/` | 文章与页面图片 |

即使 `src/content/blog/` 还是空目录，首页、归档、标签和 About 等核心页面也可以正常构建，适合先完成个性化配置，再开始发布内容。

## 写一篇文章

在 `src/content/blog/` 中新建 `.md` 或 `.mdx` 文件：

```md
---
title: "我的第一篇文章"
date: "2026-08-03T10:00:00+08:00"
description: "介绍如何使用 ulBo 搭建个人博客，包括主题配置、文章写作、本地预览、图片优化与部署流程。"
draft: false
categories:
  - "记录"
tags:
  - "astro"
  - "blog"
---

正文从这里开始。
```

完整字段与校验规则见 [Frontmatter 标准](./standard/frontmatter.md)。

生产构建会统一排除草稿，覆盖首页、归档、详情页、标签、搜索索引和 RSS；开发环境仍可通过草稿标识查看和校对内容。

## 推荐搭配 ulBo Article Manager

[ulBo Article Manager](https://github.com/xxy1103/ulbo_vscode) 是为本主题开发的可选 VS Code 写作工具。它让你在熟悉的 Markdown 编辑器旁完成：

- 新建草稿，搜索、筛选和打开文章；
- 可视化编辑标题、日期、描述、分类、标签和草稿状态；
- 使用 VS Code 语言模型生成文章描述，不可用时回退到本地提取；
- 启动 Astro 开发服务并直接预览当前文章；
- 发布前校验 Frontmatter、标签和正文引用图片；
- 将文章与关联图片精确暂存到 Git；
- 将删除的文章移入系统回收站，保留恢复能力。

主题负责展示与构建，插件负责写作和文章管理。插件不会自动执行 commit、push 或部署，最终发布仍由你控制。

当前版本可从插件仓库安装本地 VSIX，详细说明见 [ulBo Article Manager README](https://github.com/xxy1103/ulbo_vscode#readme)。

## SEO 与性能

当前代码已经实现：

- Canonical、robots、Open Graph、Twitter Card 和 JSON-LD；
- 首页 `WebSite`、About 页 `Person`、文章页 `BlogPosting` 结构化数据；
- RSS、Sitemap，以及归档分页的 `noindex,follow` 与 `rel=prev/next`；
- Markdown 图片懒加载和异步解码；
- 文章 Hero 预加载、KaTeX 样式按需加载；
- 搜索索引首次打开时再获取；
- 防止明暗主题首屏闪烁；
- 独立于普通构建的 WebP 图片优化工具。

`npm run build` 只负责构建，不会修改文章或图片。需要优化图片时，先预览变更，再显式执行：

```bash
npm run optimize:images:dry-run
npm run optimize:images
```

更完整的实现边界和代码位置见 [英文 README](./README.en.md#seo-optimizations-code-aligned)。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本，不修改文章或图片 |
| `npm run preview` | 预览生产构建结果 |
| `npm run check` | 检查 Astro 与 TypeScript |
| `npm test` | 运行测试 |
| `npm run frontmatter:check` | 只读检查文章 Frontmatter |
| `npm run frontmatter:fix` | 规范化 Frontmatter，并验证正文未被改动 |
| `npm run optimize:images:dry-run` | 预览图片优化结果 |
| `npm run optimize:images` | 生成 WebP 并更新文章引用 |

## 部署

项目输出为静态文件，可部署到 Cloudflare Workers / Pages、Vercel、Netlify 或 GitHub Pages。

仓库已包含 Cloudflare Workers Static Assets 配置：

```bash
npm run build
npm run deploy
```

使用其他平台时，将构建命令设为 `npm run build`，输出目录设为 `dist`。

## 项目结构

```text
src/
├─ components/       页面组件
├─ config/           站点、个人资料与 Hero 配置
├─ content/blog/     Markdown / MDX 文章
├─ layouts/          通用页面与文章布局
├─ lib/              内容、搜索和资料处理逻辑
├─ pages/            首页、归档、标签、About、RSS 等路由
├─ plugins/          Markdown / HTML 处理插件
└─ scripts/          搜索、目录、Mermaid、灯箱与页面交互
```

前端模块关系见 [架构地图](./docs/frontend-architecture-map.md)。

## 相关项目

- [ulBo Article Manager](https://github.com/xxy1103/ulbo_vscode)：配套的 VS Code 文章管理工具。
- [xxy1103.github.io](https://github.com/xxy1103/xxy1103.github.io)：使用 ulBo 搭建的真实个人博客。

## 参与贡献

欢迎提交 Issue 和 Pull Request。开始前请阅读 [贡献指南](./CONTRIBUTING.md)、[行为准则](./CODE_OF_CONDUCT.md) 与 [安全策略](./SECURITY.md)。

## 许可证

[MIT](./LICENSE)
