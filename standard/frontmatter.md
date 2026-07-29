# ulbo 文章 Frontmatter 标准

> 标准版本：1.1  
> 生效日期：2026-07-29  
> 适用范围：ulbo 主题中的 `.md`、`.mdx` 文章，以及 ulbo Article Manager。

本文档是主题模板的 Frontmatter 规范依据。“必须”“不得”为强制要求，“建议”为不阻止草稿保存的推荐要求。

## 1. 正式文章

```yaml
---
title: "ulbo VS Code 文章管理插件设计"
date: "2026-07-29T14:30:00+08:00"
updated: "2026-07-29T18:00:00+08:00"
description: "介绍 ulbo 文章管理插件的产品设计、工作流程与技术架构。"
draft: false
categories:
  - "项目"
tags:
  - "ulbo"
  - "vscode"
  - "astro"
---
```

`draft` 可省略；省略时等同于 `false`。

## 2. 草稿

```yaml
---
title: "未完成的文章"
date: "2026-07-29T14:30:00+08:00"
draft: true
categories: []
tags: []
---
```

- 新建文章默认写入 `draft: true`。
- 草稿必须保留 `categories` 和 `tags`，但允许空数组。
- 开发环境可以展示草稿，并应显示草稿标识。
- 生产环境必须从首页、归档、详情路由、标签、搜索索引、RSS 和站点地图中排除草稿。
- 准备发布前必须将 `draft` 改为 `false` 并通过正式文章校验。

## 3. 字段顺序

字段必须按以下顺序写入：

1. `title`
2. `date`
3. `updated`
4. `description`
5. `draft`
6. `categories`
7. `tags`

可选字段没有值时必须省略，不得写成空字符串或 `null`。

## 4. 字段约束

| 字段 | 类型 | 必填 | 约束 |
| --- | --- | --- | --- |
| `title` | 字符串 | 是 | 去除首尾空格后不得为空 |
| `date` | 日期字符串 | 是 | 带 `+08:00` 时区的 ISO 8601 格式 |
| `updated` | 日期字符串 | 否 | 与 `date` 格式相同，只在实质更新时写入 |
| `description` | 字符串 | 否 | 去除首尾空格后不得为空，建议 40–160 字 |
| `draft` | 布尔值 | 否 | 缺省为 `false`，不得使用字符串表示 |
| `categories` | 字符串数组 | 是 | 正式文章恰好一个；草稿允许为空 |
| `tags` | 字符串数组 | 是 | 正式文章至少一个；草稿允许为空；不得重复 |

## 5. YAML 排版

- Frontmatter 必须位于文件开头。
- `---` 分隔符必须单独占一行。
- Frontmatter 结束后保留一个空行再写正文。
- 普通字符串统一使用双引号。
- 每级使用两个空格缩进，不使用 Tab。
- 分类和标签使用 YAML 块数组。
- 不使用内联数组。
- 不保留重复字段或重复标签。
- 格式化 Frontmatter 时不得修改正文。

正确：

```yaml
categories:
  - "笔记"
tags:
  - "astro"
  - "vscode"
```

错误：

```yaml
categories: 笔记
tags: ["Astro", "VS Code"]
```

## 6. 日期

```yaml
date: "2026-07-29T14:30:00+08:00"
```

不得省略时区，也不得使用斜杠日期或空格分隔的旧格式。`updated` 不得在每次保存时自动刷新。

## 7. 分类与标签

- 正式文章必须只有一个分类。
- 英文字母标签统一小写。
- 纯英文多词标签使用连字符。
- 中文标签使用简洁、稳定的名词。
- 同一概念使用一个规范名称。
- 相关但语义不同的标签不得自动合并。
- 标签建议 2–4 个；这是推荐要求，不是草稿保存的硬限制。

规范化示例：

| 原始标签 | 规范标签 |
| --- | --- |
| `Astro` | `astro` |
| `CCF` | `ccf` |
| `MySQL` | `mysql` |
| `VS Code` | `vscode` |
| `Front Matter` | `front-matter` |
| `AI使用` | `ai使用` |

`数据库/mysql`、`web开发/前端`、`ai使用/aigc` 表达不同概念，不得自动合并。

## 8. 禁止字段

文章不得写入：

- `pubDate`
- `updatedDate`
- `heroImage`
- `cover`
- `permalink`
- `comments`
- `layout`
- `laout`
- `excerpt`

页面层可以派生 `pubDate = date` 和 `updatedDate = updated`，但不得写回 YAML。

文章不设置 `heroImage`，所有文章页使用主题配置中的 `postDefaultBackground`。

## 9. 新文章模板

```yaml
---
title: "${title}"
date: "${datetime}"
draft: true
categories: []
tags: []
---

<!-- more -->
```

`${datetime}` 必须输出为 `yyyy-MM-ddTHH:mm:ss+08:00`。

## 10. 发布前校验

- `title` 非空。
- `date` 合法且包含 `+08:00`。
- `updated` 存在时格式合法。
- `draft` 存在时是布尔值。
- 正式文章恰好一个分类、至少一个标签。
- 标签没有重复项。
- 不包含禁止字段、重复键或无法解析的 YAML。

`draft: true` 必须阻止准备发布，直到用户确认转为正式文章。缺少 `description`、标签少于 2 个或多于 4 个只产生提醒。

## 11. 仓库命令

只读检查所有文章：

```bash
npm run frontmatter:check
```

显式修复 Frontmatter：

```bash
npm run frontmatter:fix
```

修复工具会验证正文哈希，发现解析错误或正文变化时停止；它不会自动提交或暂存文件。
