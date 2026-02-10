# ulBo Astro Theme

`ulBo` is an Astro blog theme with centralized configuration, optional build-time image optimization, and safe zero-content behavior.

Demo: `https://blog.ulna520.top`

## 快速开始 (Quick Start)

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Preview:

```bash
npm run preview
```

## 作为模板使用 (Use As Template)

1. Click **Use this template** on GitHub, or fork this repository.
2. Update all values in `src/config/`.
3. Add your posts in `src/content/blog/`.
4. Deploy with GitHub Pages / Vercel / Netlify.

## 配置入口总览 (Configuration Overview)

All user-facing configuration is in `src/config/`.

| File | Purpose | Main Consumers |
| :-- | :-- | :-- |
| `src/config/site.ts` | 站点级配置：`siteUrl`、`siteTitle`、`siteDescription`、`locale`、`headerGithubRepoUrl` | `BaseHead`、`Header`、`rss.xml.js`、`astro.config.mjs` |
| `src/config/profile.ts` | 个人信息：`name`、`title`、`bio`、`location`、`email`、`githubProfileUrl`、`socials` | `about` 页面、文章作者 schema、`Footer` |
| `src/config/hero.ts` | Hero 文案与背景图：`home/blog/tags/about` + `postDefaultBackground` | 首页、博客列表页、标签页、About 页、文章页默认背景 |
| `src/config/features.mjs` | 功能开关：`enableCustomCursorByDefault`、`enableImageOptimizationOnBuild` | `BaseHead`、`scripts/build-with-config.mjs` |
| `src/config/index.ts` | 前端统一导出入口 | 页面/组件从一个入口导入配置 |

### 1) 站点配置 `src/config/site.ts`

- `siteUrl`: 生产环境域名（canonical / sitemap / feed 基础 URL）。
- `siteTitle`: 站点标题（头部左侧、SEO 标题拼接）。
- `siteDescription`: 默认描述（首页与 RSS）。
- `locale`: 语言区域（如 `zh-CN`）。
- `headerGithubRepoUrl`: 顶栏右侧仓库链接（与个人 GitHub 分离）。

### 2) 个人信息 `src/config/profile.ts`

- `name` / `title` / `bio`: About 主要内容，且用于文章作者结构化数据。
- `location` / `email`: About 元信息。
- `githubProfileUrl`: 个人 GitHub 首页（与 `headerGithubRepoUrl` 独立）。
- `socials`: About 与 Footer 社交链接来源。

### 3) Hero 配置 `src/config/hero.ts`

- `home`: 首页 Hero 文案与背景图。
- `blog`: 博客列表页 Hero 文案与背景图。
- `tags`: 标签页 Hero 文案与背景图。
- `about`: About 页 Hero 文案与背景图。
- `postDefaultBackground`: 文章页未设置 `heroImage` 时的默认背景图。

### 4) 功能开关 `src/config/features.mjs`

- `enableCustomCursorByDefault`: 自定义光标默认开关（用户仍可前端手动切换）。
- `enableImageOptimizationOnBuild`: 构建时是否默认先执行图片优化脚本。

## 构建行为 (Build Behavior)

`npm run build` runs `scripts/build-with-config.mjs`:

1. Read `enableImageOptimizationOnBuild` from `src/config/features.mjs`.
2. If `true`, run `npm run optimize:images`.
3. Run `npm run build:astro` (`astro build`).

If you want to skip image optimization by default, set:

```js
// src/config/features.mjs
export const enableImageOptimizationOnBuild = false;
```

## 零内容模式 (Zero-Content Ready)

This theme supports running with empty content:

- `src/content/blog/` can be empty.
- `public/` can be empty.
- `/`, `/blog`, `/tags`, `/about` remain accessible.
- List pages show empty-state text instead of crashing on pagination or array operations.

## 项目命令 (Commands)

| Command | Description |
| :-- | :-- |
| `npm run dev` | Start local dev server |
| `npm run build` | Build with feature flags (`build-with-config`) |
| `npm run build:astro` | Raw Astro build only |
| `npm run optimize:images` | Convert referenced blog images to WebP |
| `npm run preview` | Preview production build |
| `npm run astro -- --help` | Astro CLI help |

## 开源协作 (Open Source)

- Contribution guide: `CONTRIBUTING.md`
- Code of Conduct: `CODE_OF_CONDUCT.md`
- Security policy: `SECURITY.md`
- Issue templates: `.github/ISSUE_TEMPLATE/`
- Release notes: `docs/releases/v0.1.0.md`

## 许可证 (License)

MIT

## Credit

Based on the Astro starter blog and inspired by [Bear Blog](https://github.com/HermanMartinus/bearblog/).
