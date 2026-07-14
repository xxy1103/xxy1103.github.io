import defaultBackground from '../assets/blog-placeholder-1.webp';

/**
 * Hero copy and background settings for one page.
 */
export interface HeroSectionConfig {
  /**
   * Main hero headline text.
   */
  text: string;
  /**
   * Optional hero subtitle text.
   */
  subtitle?: string;
  /**
   * Hero background image URL.
   */
  backgroundImage: string;
}

/**
 * Centralized hero configuration for all top-level pages and post fallback.
 */
export interface HeroConfig {
  home: HeroSectionConfig;
  blog: HeroSectionConfig;
  tags: HeroSectionConfig;
  about: HeroSectionConfig;
  /**
   * Default hero image for article pages when frontmatter `heroImage` is empty.
   */
  postDefaultBackground: string;
}

export const heroConfig: HeroConfig = {
  home: {
    text: '骐骥一跃 不能十步 驽马十驾 功在不舍',
    subtitle: 'Persistence over speed, mastery through endurance.',
    backgroundImage: defaultBackground.src,
  },
  blog: {
    text: '在代码与算法间，刻下探索的序列',
    subtitle: 'Tracing the logic of curiosity across the digital frontier.',
    backgroundImage: defaultBackground.src,
  },
  tags: {
    text: '兴趣的切片：在不经意间，已连点成线',
    subtitle: 'Unintentional fragments forming a constellation of knowledge.',
    backgroundImage: defaultBackground.src,
  },
  about: {
    text: '一个正在运行的探索进程',
    subtitle: 'An active instance of discovery, fueled by code and passion.',
    backgroundImage: defaultBackground.src,
  },
  postDefaultBackground: defaultBackground.src,
};

