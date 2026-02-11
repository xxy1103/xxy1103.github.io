import type { ProfileConfig, ProfileSocialLink } from '../../config/profile';

export function resolveSocialUrl(key: string, url: string): string {
	if (key === 'email' && !url.startsWith('mailto:')) {
		return `mailto:${url}`;
	}
	return url;
}

export function getRenderableSocials(socials: ProfileSocialLink[]): ProfileSocialLink[] {
	return socials.filter((item) => item.url.trim().length > 0);
}

export function buildSameAsLinks(profile: Pick<ProfileConfig, 'githubProfileUrl' | 'socials'>): string[] {
	const sameAsSet = new Set<string>();

	if (profile.githubProfileUrl.trim()) {
		sameAsSet.add(profile.githubProfileUrl.trim());
	}

	for (const social of getRenderableSocials(profile.socials)) {
		if (social.key === 'email') continue;
		const url = resolveSocialUrl(social.key, social.url);
		if (/^https?:\/\//.test(url)) {
			sameAsSet.add(url);
		}
	}

	return Array.from(sameAsSet);
}

