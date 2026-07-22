import { createActiveHeadingTracker } from './active-heading';
import {
	createArticleScrollNavigator,
	type ScrollNavigationOptions,
	type ScrollNavigationResult,
} from './scroll-navigator';

export interface ArticleNavigationController {
	navigate(target: HTMLElement, options: ScrollNavigationOptions): Promise<ScrollNavigationResult>;
	cancel(): void;
	destroy(): void;
}

let cleanupCurrentController: (() => void) | null = null;

function decodeHash(hash: string) {
	if (!hash.startsWith('#') || hash.length < 2) return '';
	try {
		return decodeURIComponent(hash.slice(1));
	} catch {
		return hash.slice(1);
	}
}

function preferredBehavior(): ScrollNavigationOptions['behavior'] {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
}

export function setupToc(): ArticleNavigationController | null {
	cleanupCurrentController?.();
	cleanupCurrentController = null;

	const tocRoot = document.getElementById('toc-root');
	const scroller = document.getElementById('main-content');
	const article = document.querySelector<HTMLElement>('article .prose');
	if (!tocRoot || !scroller || !article) return null;

	const headings = Array.from(
		article.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'),
	);
	const tocLinks = Array.from(tocRoot.querySelectorAll<HTMLAnchorElement>('.toc-link'));
	if (headings.length === 0 || tocLinks.length === 0) return null;

	const abortController = new AbortController();
	const { signal } = abortController;
	const linksById = new Map<string, HTMLAnchorElement>();
	for (const link of tocLinks) {
		const id = decodeHash(link.hash);
		if (id) linksById.set(id, link);
	}

	const resolvedTocIdByHeadingId = new Map<string, string>();
	const headingStack: HTMLElement[] = [];
	for (const heading of headings) {
		const depth = Number.parseInt(heading.tagName.slice(1), 10);
		while (headingStack.length > 0) {
			const previousDepth = Number.parseInt(headingStack.at(-1)?.tagName.slice(1) ?? '0', 10);
			if (previousDepth < depth) break;
			headingStack.pop();
		}
		headingStack.push(heading);
		for (let index = headingStack.length - 1; index >= 0; index -= 1) {
			const candidateId = headingStack[index].id;
			if (linksById.has(candidateId)) {
				resolvedTocIdByHeadingId.set(heading.id, candidateId);
				break;
			}
		}
	}

	const header = document.querySelector<HTMLElement>('header');
	const updateHeaderHeight = () => {
		const height = header?.getBoundingClientRect().height || 64;
		document.documentElement.style.setProperty('--header-height', `${Math.round(height)}px`);
	};
	const getBaseOffset = () => {
		const headerHeight = header?.getBoundingClientRect().height || 64;
		const gap = Number.parseFloat(
			getComputedStyle(document.documentElement).getPropertyValue('--anchor-gap'),
		) || 16;
		return headerHeight + gap;
	};
	const getActivationOffset = () => Math.max(
		getBaseOffset(),
		Math.min(Math.round(scroller.clientHeight * 0.36), 360),
	);
	updateHeaderHeight();

	const navigator = createArticleScrollNavigator(scroller, getBaseOffset);
	const tracker = createActiveHeadingTracker({
		headings,
		linksById,
		resolveTocId: (id) => resolvedTocIdByHeadingId.get(id) ?? id,
		scroller,
		tocContainer: document.getElementById('toc'),
		getActivationOffset,
	});
	let navigationSequence = 0;
	let layoutFrame: number | null = null;
	let initialFrame: number | null = null;
	let cleanedUp = false;

	const scheduleLayoutRefresh = () => {
		if (cleanedUp || layoutFrame !== null) return;
		layoutFrame = requestAnimationFrame(() => {
			layoutFrame = null;
			tracker.refreshLayout();
		});
	};

	const controller: ArticleNavigationController = {
		async navigate(target, options) {
			if (cleanedUp) return 'interrupted';
			const sequence = ++navigationSequence;
			const activeId = tracker.resolveIdForTarget(target);
			if (activeId) tracker.lock(activeId);
			const result = await navigator.navigate(target, options);
			if (sequence === navigationSequence && result !== 'superseded') {
				tracker.unlock();
				tracker.refreshLayout();
				tracker.refreshActive();
			}
			return result;
		},
		cancel() {
			navigator.cancel('interrupted');
		},
		destroy() {
			cleanup();
		},
	};

	const navigateToId = (id: string, behavior: ScrollNavigationOptions['behavior']) => {
		const target = document.getElementById(id);
		if (target) void controller.navigate(target, { behavior });
	};

	tocRoot.addEventListener('click', (event) => {
		const link = (event.target as Element).closest<HTMLAnchorElement>('.toc-link');
		if (!link) return;
		const id = decodeHash(link.hash);
		if (!id) return;
		event.preventDefault();
		if (location.hash !== link.hash) history.replaceState({ ...history.state }, '', link.hash);
		navigateToId(id, preferredBehavior());
	}, { signal });

	window.addEventListener('hashchange', () => {
		const id = decodeHash(location.hash);
		if (id) navigateToId(id, preferredBehavior());
	}, { signal });

	const cancelOnUserInput = () => controller.cancel();
	scroller.addEventListener('wheel', cancelOnUserInput, { passive: true, signal });
	scroller.addEventListener('touchstart', cancelOnUserInput, { passive: true, signal });
	scroller.addEventListener('pointerdown', cancelOnUserInput, { passive: true, signal });
	window.addEventListener('keydown', (event) => {
		if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
			controller.cancel();
		}
	}, { signal });

	article.addEventListener('load', scheduleLayoutRefresh, { capture: true, signal });
	window.addEventListener('resize', () => {
		updateHeaderHeight();
		scheduleLayoutRefresh();
	}, { signal });
	const articleObserver = new ResizeObserver(scheduleLayoutRefresh);
	articleObserver.observe(article);
	const headerObserver = header ? new ResizeObserver(() => {
		updateHeaderHeight();
		scheduleLayoutRefresh();
	}) : null;
	headerObserver?.observe(header as HTMLElement);
	void document.fonts?.ready.then(scheduleLayoutRefresh).catch(() => {});

	initialFrame = requestAnimationFrame(() => {
		initialFrame = null;
		if (cleanedUp) return;
		const hasSearchLanding = new URLSearchParams(location.search).has('block');
		const initialId = hasSearchLanding ? '' : decodeHash(location.hash);
		if (initialId) navigateToId(initialId, 'instant');
		else tracker.refreshActive();
	});

	function cleanup() {
		if (cleanedUp) return;
		cleanedUp = true;
		navigationSequence += 1;
		abortController.abort();
		articleObserver.disconnect();
		headerObserver?.disconnect();
		if (layoutFrame !== null) cancelAnimationFrame(layoutFrame);
		if (initialFrame !== null) cancelAnimationFrame(initialFrame);
		navigator.destroy();
		tracker.destroy();
		if (cleanupCurrentController === cleanup) cleanupCurrentController = null;
	}

	document.addEventListener('astro:before-swap', cleanup, { once: true, signal });
	cleanupCurrentController = cleanup;
	return controller;
}
