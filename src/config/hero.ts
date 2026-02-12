import homeBackground from '../assets/blog-placeholder-1.jpg';
import blogBackground from '../assets/blog-placeholder-1.jpg';
import tagsBackground from '../assets/blog-placeholder-1.jpg';
import aboutBackground from '../assets/blog-placeholder-1.jpg';
import postBackground from '../assets/blog-placeholder-5.jpg';

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
    text: 'Build your ideas, one post at a time.',
    subtitle: 'A clean Astro theme with centralized configuration.',
    backgroundImage: homeBackground.src,
  },
  blog: {
    text: 'All Posts',
    subtitle: 'Browse your writing archive.',
    backgroundImage: blogBackground.src,
  },
  tags: {
    text: 'Tags',
    subtitle: 'Explore topics by category and tag.',
    backgroundImage: tagsBackground.src,
  },
  about: {
    text: 'About',
    subtitle: 'Introduce yourself and your work.',
    backgroundImage: aboutBackground.src,
  },
  postDefaultBackground: postBackground.src,
};
