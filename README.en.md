# ulBo Astro Theme

[中文](./README.md) | [English](./README.en.md)

`ulBo` is an Astro blog theme template for personal publishing, focused on centralized configuration, migration friendliness, extensibility, and practical SEO/performance engineering details.

Demo: [https://blog.ulna520.top](https://blog.ulna520.top)

## Overview

- Responsive blog structure with home, archive, tags, and about pages.
- User-facing configuration is centralized in `src/config/`, making template customization fast.
- Zero-content friendly: `src/content/blog/` can be empty while core pages still work.

## Feature Highlights

1. Responsive blog layout (`/`, `/blog`, `/tags`, `/about`)

- Page-level breakpoints and mobile adaptation: `src/pages/*.astro`, `src/styles/global.css`
- Mobile navigation drawer: `src/components/Header.astro`

2. Blog migration support (partial Hexo Frontmatter compatibility)

- Compatible Frontmatter fields: `date/pubDate`, `updated/updatedDate`, `categories`, `tags`, `permalink`, `comments`, `layout`, `excerpt`
- Compatibility and normalization entry: `src/content.config.ts`
- Hexo-style relative image path compatibility (`image/...` -> `/image/...`): `src/plugins/remark-hexo-images.mjs`
- Note: this is partial compatibility, not full Hexo semantic parity. PRs are welcome.

3. Smooth animation design (Material Design curves)

- Page transitions built with View Transitions: `src/components/BaseHead.astro`
- Material Design 3 easing curves (Emphasized/Decelerate/Accelerate) are used for page and interaction transitions: `src/components/BaseHead.astro`, `src/components/SearchModal.astro`

4. SEO optimizations (implemented items only)

- See the "SEO Optimizations (Code-Aligned)" section below.

5. KaTeX math support

- Markdown pipeline: `remark-math` + `rehype-katex` (`astro.config.mjs`)
- KaTeX stylesheet is loaded on demand (only when math content is detected): `src/pages/blog/[...slug].astro`, `src/layouts/BlogPost.astro`

6. Built-in WebP image optimization flow

- `npm run build` uses `scripts/build-with-config.mjs`, reads feature flags, and runs `scripts/optimize-blog-images.mjs` before Astro build when enabled.
- Switch location: `enableImageOptimizationOnBuild` in `src/config/features.mjs`

7. Lighthouse-oriented performance optimizations

- Includes image lazy loading, async decoding, targeted preloading, deferred search index loading, and viewport-external rendering optimizations.
- See the "Lighthouse-Oriented Performance Optimizations (Code-Aligned)" section below.

## SEO Optimizations (Code-Aligned)

Every item below can be directly verified in the current codebase:

1. Canonical, robots, Open Graph, Twitter Card, and JSON-LD injection

- `src/components/BaseHead.astro`

2. Home page `WebSite` structured data

- `src/pages/index.astro`

3. About page `Person` structured data

- `src/pages/about.astro`

4. Article page `BlogPosting` structured data + `article:*` meta

- `src/layouts/BlogPost.astro`

5. Archive pagination SEO strategy: `/blog/2+` is `noindex,follow`, with `rel=prev/next`

- `src/pages/blog/[...page].astro`

6. Sitemap filtering strategy: excludes tag pages and `/blog/2+` archive pages

- `astro.config.mjs`

7. RSS output and description fallback chain (frontmatter description -> extracted body summary -> title)

- `src/pages/rss.xml.js`
- `src/utils/seo.ts`

8. Important scope boundary

- Tag pages are not explicitly set to `noindex` in current code (`/tags` and `/tags/[tag]` do not pass `noindex`), so this README does not claim that behavior.

## Lighthouse-Oriented Performance Optimizations (Code-Aligned)

All items below are traceable in code:

1. Unified Markdown image lazy loading + async decoding

- `src/plugins/rehype-lazy-images.mjs`

2. Build-time WebP conversion + Markdown reference replacement

- `scripts/optimize-blog-images.mjs`

3. Build preprocessing pipeline (toggleable) for `npm run build`

- `scripts/build-with-config.mjs`
- `src/config/features.mjs`

4. Article hero image preload + on-demand KaTeX stylesheet loading

- `src/layouts/BlogPost.astro`

5. KaTeX font display patch (`font-display: block` -> `swap`)

- `astro.config.mjs`

6. Viewport-external image rendering optimization

- `.prose img { content-visibility: auto; }` in `src/components/BaseHead.astro`

7. Lazy fetch of search index (load only when search modal is first opened)

- `src/scripts/search-modal.client.ts`

8. Theme initialization anti-flash logic

- `src/components/BaseHead.astro`

## Quick Start

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

## Use As Template (Detailed Guide)

### 1) Prerequisites

- Node.js and npm installed
- Node 22 is recommended (current CI uses Node 22: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`)

### 2) Create your project from GitHub Template

1. Open this repository on GitHub and click **Use this template**.
2. Create your own new repository (public is recommended if you plan to use GitHub Pages).
3. Clone your new repository locally.

### 3) Initialize locally and run

```bash
npm install
npm run dev
```

Default local URL is typically: `http://localhost:4321`

### 4) Update site configuration

Edit these files first:

- `src/config/site.ts`
- `src/config/profile.ts`
- `src/config/hero.ts`
- `src/config/features.mjs`

`src/config/index.ts` is an export aggregator and usually does not need direct edits.

### 5) Add blog content

Put posts in `src/content/blog/`, with `.md` or `.mdx`.

Sample Frontmatter (Astro + partial Hexo compatibility):

```md
---
title: "My First Post"
date: 2026-02-11
pubDate: 2026-02-11
updated: 2026-02-12
updatedDate: 2026-02-12
description: "A short description used for SEO and list excerpts."
heroImage: "/image/sample-cover.jpg"
categories: ["Astro", "Template"]
tags: ["Blog", "Migration"]
excerpt: "Optional excerpt field"
permalink: "custom-slug"
comments: true
layout: "post"
---

Post body...
```

Notes:

- `title` is required.
- `date/pubDate` is normalized into `pubDate` (`pubDate` takes priority).
- `updated/updatedDate` is normalized into `updatedDate`.
- `categories` and `tags` are normalized into arrays.
- `permalink/comments/layout/excerpt` are currently accepted and preserved, but not all of them are fully consumed in rendering logic.

### 6) Images and WebP optimization flow

1. Put images in `public/` (for example `public/image/...`).
2. Reference `.png/.jpg/.jpeg` images in your posts.
3. On `npm run build`, if `enableImageOptimizationOnBuild = true`, image optimization runs before Astro build.

Run optimization only:

```bash
npm run optimize:images
```

Optional advanced args (run script directly):

```bash
node scripts/optimize-blog-images.mjs --max-width 1600 --quality 78
```

### 7) Build and preview

```bash
npm run build
npm run preview
```

### 8) Deployment

GitHub Pages is recommended first (workflow already included):

- `.github/workflows/deploy.yml`

You can also deploy to:

- Vercel
- Netlify

### 9) Receiving Future Theme Updates (Template Sync)

If your repository was created from GitHub Template, keep the original theme repo as `upstream` and sync regularly.

Initial setup (one-time):

```bash
git remote add upstream https://github.com/xxy1103/ulbo-astro-theme-template.git
git remote -v
```

Regular sync workflow:

```bash
git fetch upstream
git checkout main
git pull origin main
git merge upstream/main
```

Recommended verification after syncing:

```bash
npm install
npm run build
```

If conflicts occur:

1. Prefer keeping your site-specific configuration (for example `src/config/*`).
2. Resolve conflicts, then create a merge commit.
3. If you do not want a full merge, selectively import commits instead:

```bash
git log --oneline upstream/main
git cherry-pick <commit_sha>
```

## Configuration Reference

### `src/config/site.ts` (`SiteConfig`)

- `siteUrl`: production site URL (base URL for canonical/sitemap/RSS)
- `siteTitle`: site title
- `siteDescription`: default description
- `locale`: locale in BCP-47 format (for example `zh-CN`)
- `headerGithubRepoUrl`: repository URL shown in header
- `faviconIco`: global favicon path (served from `public/`)

### `src/config/profile.ts` (`ProfileConfig`, `ProfileSocialLink`)

- `avatar`: optional avatar URL
- `name`: name (about page, structured data, footer)
- `title`: personal title/role
- `bio`: biography
- `location`: optional location
- `email`: optional email
- `githubProfileUrl`: personal GitHub profile URL
- `socials`: social link array
- `socials[].key`: `github | x | email | website`
- `socials[].label`: display label
- `socials[].url`: link URL

### `src/config/hero.ts` (`HeroConfig`, `HeroSectionConfig`)

- `home.text` / `home.subtitle` / `home.backgroundImage`
- `blog.text` / `blog.subtitle` / `blog.backgroundImage`
- `tags.text` / `tags.subtitle` / `tags.backgroundImage`
- `about.text` / `about.subtitle` / `about.backgroundImage`
- `postDefaultBackground`: default article hero image fallback when `heroImage` is not set

### `src/config/features.mjs`

- `enableCustomCursorByDefault`: default custom cursor toggle
- `enableImageOptimizationOnBuild`: whether to run image optimization before build by default

### `src/content.config.ts` (Blog Frontmatter compatibility and normalization)

Required field:

- `title`

Optional fields (including compatibility fields):

- `date`
- `pubDate`
- `description`
- `updatedDate`
- `updated`
- `heroImage`
- `categories` (string or string array)
- `tags` (string or string array)
- `permalink`
- `comments`
- `layout`
- `excerpt`

Normalization rules:

- `pubDate = pubDate ?? date ?? new Date()`
- `updatedDate = updatedDate ?? updated`
- `categories` always normalized to array
- `tags` always normalized to array

## Project Commands

These commands match `package.json` exactly:

| Command                     | Description                                              |
| :-------------------------- | :------------------------------------------------------- |
| `npm run dev`             | Start local development server                           |
| `npm run build`           | Build with feature-flag pipeline (`build-with-config`) |
| `npm run build:astro`     | Run raw `astro build` only                             |
| `npm run check`           | Run `astro check` for type/template validation          |

## Post-refactor Conventions (2026-02)

- Use `src/layouts/PageShell.astro` for standard page shells (post detail remains on `BlogPost` layout).
- Centralize blog content reads in `src/lib/content/blog.ts` instead of repeating `getCollection` logic per page.
- Use `src/lib/content/text.ts` for excerpts and SEO description extraction.
- Use `src/lib/profile/social.ts` for social link normalization and sameAs generation.
- Place page interaction scripts in `src/scripts/pages/*` and register them via `src/scripts/pages/registry.ts`.
- See `docs/frontend-architecture-map.md` for the dependency and page relationship map.
| `npm run preview`         | Preview production output                                |
| `npm run astro`           | Native Astro CLI entry                                   |
| `npm run optimize:images` | Convert blog images to WebP and replace references       |

## Open Source Collaboration

- Contribution guide: `CONTRIBUTING.md`
- Code of Conduct: `CODE_OF_CONDUCT.md`
- Security policy: `SECURITY.md`
- Issue templates: `.github/ISSUE_TEMPLATE/`
- CI workflow: `.github/workflows/ci.yml`
- Deployment workflow: `.github/workflows/deploy.yml`

Issues and PRs are welcome, especially for deeper Hexo migration compatibility, SEO refinements, and performance improvements.

## License

This project is licensed under the MIT License. See `LICENSE`.
