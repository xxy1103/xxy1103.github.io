/**
 * Site-level settings shared by header, SEO tags, and feed generation.
 */
export interface SiteConfig {
  /**
   * Canonical production URL of this site.
   */
  siteUrl: string;
  /**
   * Global site title used in header and metadata.
   */
  siteTitle: string;
  /**
   * Default site description used by index and RSS metadata.
   */
  siteDescription: string;
  /**
   * BCP-47 locale tag (for example: zh-CN, en-US).
   */
  locale: string;
  /**
   * Repository URL shown in the header action area.
   */
  headerGithubRepoUrl: string;
}

export const siteConfig: SiteConfig = {
  siteUrl: 'https://blog.ulna520.top',
  siteTitle: 'ulBo Astro Theme',
  siteDescription: 'A configurable Astro blog theme with centralized config and zero-content defaults.',
  locale: 'zh-CN',
  headerGithubRepoUrl: 'https://github.com/xxy1103/xxy1103.github.io',
};

export const { siteUrl, siteTitle, siteDescription, locale, headerGithubRepoUrl } = siteConfig;
