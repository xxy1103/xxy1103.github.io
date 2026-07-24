import type { ImageMetadata } from 'astro';
import defaultAvatar from '../assets/profile.jpg';

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
  avatar?: string | ImageMetadata;
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
  avatar: defaultAvatar,
  name: 'Your Name',
  title: 'Your Role / Focus',
  bio: 'Write a short self-introduction here. This content is used in About and article schema.',
  location: 'Your City',
  email: 'you@example.com',
  githubProfileUrl: 'https://example.com',
  socials: [
    { key: 'github', label: 'GitHub', url: 'https://example.com' },
    { key: 'x', label: 'X', url: 'https://example.com' },
    { key: 'website', label: 'Website', url: 'https://example.com' },
  ],
};
