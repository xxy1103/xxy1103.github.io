import { initAboutPage } from './about.client';
import { initBlogListPage } from './blog-list.client';
import { initHomePage } from './home.client';
import { initTagDetailPage } from './tag-detail.client';
import { initTagsIndexPage } from './tags-index.client';
import { cleanupParallax } from './parallax';

export type PageEnhancementId = 'home' | 'about' | 'blog-list' | 'tags-index' | 'tag-detail';
type PageEnhancementHandler = () => void;

const handlers: Record<PageEnhancementId, PageEnhancementHandler> = {
	home: initHomePage,
	about: initAboutPage,
	'blog-list': initBlogListPage,
	'tags-index': initTagsIndexPage,
	'tag-detail': initTagDetailPage,
};

function getCurrentPageId(): PageEnhancementId | undefined {
	const pageId = document.body.dataset.pageId;
	if (!pageId) return undefined;
	if (pageId in handlers) {
		return pageId as PageEnhancementId;
	}
	return undefined;
}

export function runCurrentPageEnhancements() {
	cleanupParallax();
	const pageId = getCurrentPageId();
	if (!pageId) return;
	handlers[pageId]();
}
