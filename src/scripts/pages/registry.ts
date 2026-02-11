import { initAboutPage } from './about.client';
import { initBlogListPage } from './blog-list.client';
import { initHomePage } from './home.client';
import { initTagDetailPage } from './tag-detail.client';
import { initTagsIndexPage } from './tags-index.client';

export type PageEnhancementId = 'home' | 'about' | 'blog-list' | 'tags-index' | 'tag-detail';
type PageEnhancementHandler = () => void;

const handlers: Record<PageEnhancementId, PageEnhancementHandler> = {
	home: initHomePage,
	about: initAboutPage,
	'blog-list': initBlogListPage,
	'tags-index': initTagsIndexPage,
	'tag-detail': initTagDetailPage,
};

type MainContentHandlerKey =
	| '__homeParallaxHandler'
	| '__blogParallaxHandler'
	| '__tagsIndexParallaxHandler'
	| '__tagParallaxHandler'
	| '__aboutParallaxHandler';

type MainContentWithHandlers = HTMLElement & Partial<Record<MainContentHandlerKey, () => void>>;

const mainContentHandlerKeys: MainContentHandlerKey[] = [
	'__homeParallaxHandler',
	'__blogParallaxHandler',
	'__tagsIndexParallaxHandler',
	'__tagParallaxHandler',
	'__aboutParallaxHandler',
];

function cleanupMainContentHandlers() {
	const mainContent = document.getElementById('main-content') as MainContentWithHandlers | null;
	if (!mainContent) return;

	for (const key of mainContentHandlerKeys) {
		const handler = mainContent[key];
		if (!handler) continue;
		mainContent.removeEventListener('scroll', handler);
		delete mainContent[key];
	}
}

function getCurrentPageId(): PageEnhancementId | undefined {
	const pageId = document.body.dataset.pageId;
	if (!pageId) return undefined;
	if (pageId in handlers) {
		return pageId as PageEnhancementId;
	}
	return undefined;
}

export function runCurrentPageEnhancements() {
	cleanupMainContentHandlers();
	const pageId = getCurrentPageId();
	if (!pageId) return;
	handlers[pageId]();
}
