# 前端代码治理工作内容报告（2026-02-11）

## 1. 报告目标
- 记录本次前端重构后的项目结构。
- 记录关键页面、布局、组件、脚本、公共库之间的引用关系。
- 记录本次新增/修改/删除内容与验证结果，方便后续维护和交接。

## 2. 本次改动范围总览

### 2.1 新增文件
- `docs/frontend-architecture-map.md`
- `src/layouts/PageShell.astro`
- `src/lib/content/blog.ts`
- `src/lib/content/text.ts`
- `src/lib/profile/social.ts`
- `src/components/ContentCard.astro`
- `src/components/SectionHeader.astro`
- `src/components/PostMeta.astro`
- `src/components/PostListItem.astro`
- `src/scripts/pages/registry.ts`
- `src/scripts/pages/home.client.ts`
- `src/scripts/pages/blog-list.client.ts`
- `src/scripts/pages/tags-index.client.ts`
- `src/scripts/pages/tag-detail.client.ts`

### 2.2 删除文件
- `src/utils/seo.ts`
- `src/assets/blog-placeholder-2.jpg`
- `src/assets/blog-placeholder-3.jpg`
- `src/assets/blog-placeholder-4.jpg`

### 2.3 主要修改文件（核心）
- 页面：`src/pages/index.astro`、`src/pages/about.astro`、`src/pages/blog/[...page].astro`、`src/pages/tags/index.astro`、`src/pages/tags/[tag].astro`、`src/pages/blog/[...slug].astro`
- 布局与组件：`src/layouts/BlogPost.astro`、`src/components/Footer.astro`、`src/components/FormattedDate.astro`、`src/components/SearchModal.astro`、`src/components/Typewriter.astro`
- 脚本：`src/scripts/search-modal.client.ts`、`src/scripts/lightbox.ts`、`src/scripts/toc.ts`、`src/scripts/header.client.ts`
- 样式与工程：`src/styles/global.css`、`package.json`、`package-lock.json`、`astro.config.mjs`、`README.md`、`README.en.md`

## 3. 重构后项目结构（关键目录）

```text
src/
  assets/
    blog-placeholder-1.jpg
    blog-placeholder-5.jpg
    blog-placeholder-about.jpg
  components/
    BaseHead.astro
    Header.astro
    Footer.astro
    SearchModal.astro
    HeroHeader.astro
    FormattedDate.astro
    ContentCard.astro
    SectionHeader.astro
    PostMeta.astro
    PostListItem.astro
    ...
  layouts/
    PageShell.astro
    BlogPost.astro
  lib/
    content/
      blog.ts
      text.ts
    profile/
      social.ts
  pages/
    index.astro
    about.astro
    blog/
      [...page].astro
      [...slug].astro
    tags/
      index.astro
      [tag].astro
    rss.xml.js
    search-index.json.ts
  scripts/
    header.client.ts
    search-modal.client.ts
    custom-cursor.client.ts
    toc.ts
    code-block.ts
    lightbox.ts
    pages/
      registry.ts
      home.client.ts
      blog-list.client.ts
      tags-index.client.ts
      tag-detail.client.ts
  styles/
    global.css
```

## 4. 引用关系（核心）

### 4.1 页面层 -> 本地依赖
- `src/pages/index.astro`
  - `src/layouts/PageShell.astro`
  - `src/components/{HeroHeader,ContentCard,PostListItem,SectionHeader}.astro`
  - `src/lib/content/blog.ts`
  - `src/scripts/pages/registry.ts`
- `src/pages/about.astro`
  - `src/layouts/PageShell.astro`
  - `src/components/{HeroHeader,ContentCard}.astro`
  - `src/lib/profile/social.ts`
- `src/pages/blog/[...page].astro`
  - `src/layouts/PageShell.astro`
  - `src/components/{HeroHeader,ContentCard,PostListItem,SectionHeader}.astro`
  - `src/lib/content/{blog,text}.ts`
  - `src/scripts/pages/registry.ts`
- `src/pages/tags/index.astro`
  - `src/layouts/PageShell.astro`
  - `src/components/{HeroHeader,ContentCard,SectionHeader}.astro`
  - `src/lib/content/blog.ts`
  - `src/scripts/pages/registry.ts`
- `src/pages/tags/[tag].astro`
  - `src/layouts/PageShell.astro`
  - `src/components/{HeroHeader,ContentCard,PostListItem,SectionHeader}.astro`
  - `src/lib/content/{blog,text}.ts`
  - `src/scripts/pages/registry.ts`
- `src/pages/blog/[...slug].astro`
  - `src/layouts/BlogPost.astro`
  - `src/lib/content/blog.ts`
  - `src/lib/content/text.ts`
- `src/pages/rss.xml.js`
  - `src/lib/content/blog.ts`
  - `src/lib/content/text.ts`
- `src/pages/search-index.json.ts`
  - `src/lib/content/blog.ts`
  - `src/lib/content/text.ts`

### 4.2 布局层
- `src/layouts/PageShell.astro`
  - 统一注入：`BaseHead`、`Header`、`Footer`、`SearchModal`
- `src/layouts/BlogPost.astro`
  - 文章详情专用布局
  - 依赖 `BaseHead`、`Header`、`Footer`、`HeroHeader`、`SearchModal`
  - 增强脚本：`toc.ts`、`code-block.ts`、`lightbox.ts`

### 4.3 组件层复用关系
- `PostListItem.astro` -> `PostMeta.astro`
- `PostMeta.astro` -> `FormattedDate.astro`
- `Footer.astro` -> `lib/profile/social.ts`
- `FormattedDate.astro` -> `config.locale`

### 4.4 页面交互脚本引用关系
- `src/scripts/pages/registry.ts` 统一注册并调度：
  - `home.client.ts`
  - `blog-list.client.ts`
  - `tags-index.client.ts`
  - `tag-detail.client.ts`
- 页面只调用 `runPageEnhancements('<page-id>')`，避免分散的重复 `astro:page-load` 管理。

## 5. 数据与职责收敛

### 5.1 内容读取与处理
- `src/lib/content/blog.ts`
  - `getBlogPosts()`
  - `getPostsByTag()`
  - `getTagStats()`
  - `sortPostsByDateDesc()`
- `src/lib/content/text.ts`
  - `stripMarkdownAndHtml()`
  - `extractExcerpt()`
  - `extractSeoDescription()`

### 5.2 个人社交信息处理
- `src/lib/profile/social.ts`
  - `resolveSocialUrl()`
  - `getRenderableSocials()`
  - `buildSameAsLinks()`

## 6. 结构优化成果摘要
- 页面壳层统一为 `PageShell`，减少重复 `BaseHead/Header/Footer/SearchModal/main-content` 结构。
- 多页面重复数据逻辑收敛到 `src/lib`（内容读取、摘要、社交链接）。
- 列表/元信息视图组件化，减少首页、博客、标签页模板重复。
- 页面交互脚本模块化并统一生命周期入口，降低事件重复绑定风险。
- 搜索渲染补充 HTML 转义并统一高亮处理，降低 XSS 风险。
- 全局样式过渡从 `*` 全局常驻切换为 `html.theme-transitioning` 受控触发。

## 7. 工程验证结果
- 执行 `npm run build:astro`：通过。
- 执行 `npm run check`：通过（0 errors）。
- 当前内容库为空时会出现内容警告（`src/content/blog` 无文章），属于预期提示，不阻塞构建。

## 8. 维护约定（落地）
- 新页面优先使用 `src/layouts/PageShell.astro`。
- 新的博客数据读取必须走 `src/lib/content/blog.ts`。
- 摘要与 SEO 文本处理走 `src/lib/content/text.ts`。
- 社交链接处理走 `src/lib/profile/social.ts`。
- 页面交互脚本放 `src/scripts/pages/*` 并通过 `registry.ts` 注册。

## 9. 参考文档
- `docs/frontend-architecture-map.md`

