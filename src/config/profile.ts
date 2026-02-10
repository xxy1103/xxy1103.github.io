import defaultAvatar from '../assets/avatar.webp';

/**
 * Allowed social entry keys in profile configuration.
 */
export type ProfileSocialKey = 'github' | 'x' | 'email' | 'website';

/**
 * One social link item rendered on `/about`.
 */
export interface ProfileSocialLink {
  key: ProfileSocialKey;
  label: string;
  url: string;
}

/**
 * Personal profile settings used by About page and article author schema.
 */
export interface ProfileConfig {
  /**
   * Optional avatar URL for About page and structured data.
   */
  avatar?: string;
  /**
   * Display name used across the site.
   */
  name: string;
  /**
   * Short headline/title shown on About page.
   */
  title: string;
  /**
   * Short bio text shown on About page and in schema.
   */
  bio: string;
  /**
   * Optional location text.
   */
  location?: string;
  /**
   * Optional contact email.
   */
  email?: string;
  /**
   * Personal GitHub profile URL (separate from repo URL).
   */
  githubProfileUrl: string;
  /**
   * Social links displayed in About page social row.
   */
  socials: ProfileSocialLink[];
}

export const profileConfig: ProfileConfig = {
  avatar: defaultAvatar.src,
  name: 'ulna',
  title: '北邮计算机在读 / 深度学习与工程实践',
  bio: '以兴趣驱动探索，余者皆为馈赠。',
  location: '北京',
  email: 'xianxingyuan520@outlook.com',
  githubProfileUrl: 'https://github.com/xxy1103',
  socials: [
    { key: 'github', label: 'GitHub', url: 'https://github.com/xxy1103' },
    { key: 'x', label: 'X', url: '' },
    { key: 'website', label: 'Website', url: '' },
  ],
};
