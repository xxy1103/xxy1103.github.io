# Frontend Architecture Map

## Dependency Graph
- `src/pages/index.astro` -> `src/layouts/PageShell.astro` -> `src/components/{Header,Footer,SearchModal,BaseHead}.astro`
- `src/pages/about.astro` -> `src/layouts/PageShell.astro` -> `src/components/{Header,Footer,SearchModal,BaseHead,HeroHeader}.astro`
- `src/pages/blog/[...page].astro` -> `src/layouts/PageShell.astro` -> `src/components/{Header,Footer,SearchModal,BaseHead,HeroHeader}.astro`
- `src/pages/tags/index.astro` -> `src/layouts/PageShell.astro` -> `src/components/{Header,Footer,SearchModal,BaseHead,HeroHeader}.astro`
- `src/pages/tags/[tag].astro` -> `src/layouts/PageShell.astro` -> `src/components/{Header,Footer,SearchModal,BaseHead,HeroHeader}.astro`
- `src/pages/blog/[...slug].astro` -> `src/layouts/BlogPost.astro` -> `src/components/{Header,Footer,SearchModal,BaseHead,HeroHeader}.astro`

## Shared Data Layer
- `src/lib/content/blog.ts`
  - `getBlogPosts()`
  - `getPostsByTag()`
  - `getTagStats()`
  - `sortPostsByDateDesc()`
- `src/lib/content/text.ts`
  - `stripMarkdownAndHtml()`
  - `extractExcerpt()`
  - `extractSeoDescription()`
- `src/lib/profile/social.ts`
  - `getRenderableSocials()`
  - `resolveSocialUrl()`
  - `buildSameAsLinks()`

## Shared View Components
- `src/components/ContentCard.astro`
- `src/components/SectionHeader.astro`
- `src/components/PostMeta.astro`
- `src/components/PostListItem.astro`

## Client Runtime Layer
- `src/scripts/pages/registry.ts`: centralized page enhancement lifecycle.
- `src/scripts/pages/home.client.ts`: home stats animation + parallax + post stagger.
- `src/scripts/pages/blog-list.client.ts`: list reveal + parallax.
- `src/scripts/pages/tags-index.client.ts`: tag magnetic + parallax.
- `src/scripts/pages/tag-detail.client.ts`: back-link magnetic + parallax.
- `src/scripts/{header.client.ts,search-modal.client.ts,toc.ts,code-block.ts,lightbox.ts,custom-cursor.client.ts}`: global/site-level features.

## Removed Duplication Targets
- Repeated blog content loading now centralized in `src/lib/content/blog.ts`.
- Repeated excerpt/description extraction now centralized in `src/lib/content/text.ts`.
- Repeated social URL and sameAs derivation now centralized in `src/lib/profile/social.ts`.
- Repeated page shell (`BaseHead + Header + Footer + SearchModal + main-content`) now centralized in `src/layouts/PageShell.astro`.

## Next Maintenance Rules
- New page should use `src/layouts/PageShell.astro` unless the page is a dedicated content layout.
- New blog/tag data reads should go through `src/lib/content/blog.ts`.
- New excerpt/summary logic should go through `src/lib/content/text.ts`.
- New social rendering logic should go through `src/lib/profile/social.ts`.
- New page interactions should be in `src/scripts/pages/*` and registered via `runPageEnhancements()`.

