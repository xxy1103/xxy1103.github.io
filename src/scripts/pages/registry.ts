import { initAboutPage } from './about.client';
import { initBlogListPage } from './blog-list.client';
import { initHomePage } from './home.client';
import { initTagDetailPage } from './tag-detail.client';
import { initTagsIndexPage } from './tags-index.client';

type PageEnhancementId = 'home' | 'about' | 'blog-list' | 'tags-index' | 'tag-detail';
type PageEnhancementHandler = () => void;

const handlers: Record<PageEnhancementId, PageEnhancementHandler> = {
	home: initHomePage,
	about: initAboutPage,
	'blog-list': initBlogListPage,
	'tags-index': initTagsIndexPage,
	'tag-detail': initTagDetailPage,
};

interface RegistryWindow extends Window {
	__pageEnhancementRegistry?: Partial<Record<PageEnhancementId, PageEnhancementHandler>>;
}

export function runPageEnhancements(id: PageEnhancementId) {
	const handler = handlers[id];
	const registryWindow = window as RegistryWindow;
	registryWindow.__pageEnhancementRegistry ||= {};

	for (const existing of Object.values(registryWindow.__pageEnhancementRegistry)) {
		if (existing) {
			document.removeEventListener('astro:page-load', existing);
		}
	}

	registryWindow.__pageEnhancementRegistry = { [id]: handler };
	document.addEventListener('astro:page-load', handler);
	handler();
}
