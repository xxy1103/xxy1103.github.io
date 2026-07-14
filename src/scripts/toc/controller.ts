import { createActiveHeadingTracker } from './active-heading';
import { createScrollAnchor } from './scroll-anchor';

let cleanupCurrentController: (() => void) | null = null;

function decodeHash(hash: string) {
	if (!hash.startsWith('#') || hash.length < 2) return '';
	try {
		return decodeURIComponent(hash.slice(1));
	} catch {
		return hash.slice(1);
	}
}

function prefersReducedMotion() {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function setupToc() {
	cleanupCurrentController?.();
	cleanupCurrentController = null;

	const tocRoot = document.getElementById('toc-root');
	const scroller = document.getElementById('main-content');
	const article = document.querySelector<HTMLElement>('article .prose');
	if (!tocRoot || !scroller || !article) return;

	const headings = Array.from(
		article.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'),
	);
	const tocLinks = Array.from(tocRoot.querySelectorAll<HTMLAnchorElement>('.toc-link'));
	if (headings.length === 0 || tocLinks.length === 0) return;

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
	updateHeaderHeight();

	const anchor = createScrollAnchor(scroller, getBaseOffset);
	const tracker = createActiveHeadingTracker({
		headings,
		linksById,
		resolveTocId: (id) => resolvedTocIdByHeadingId.get(id) ?? id,
		scroller,
		tocContainer: document.getElementById('toc'),
		getBaseOffset,
		signal,
	});

	const navigateToId = (id: string, behavior: ScrollBehavior) => {
		const target = document.getElementById(id);
		if (!target) return;
		tracker.setActive(resolvedTocIdByHeadingId.get(id) ?? id);
		anchor.scrollTo(target, behavior);
	};

	tocRoot.addEventListener('click', (event) => {
		const link = (event.target as Element).closest<HTMLAnchorElement>('.toc-link');
		if (!link) return;
		const id = decodeHash(link.hash);
		if (!id) return;
		event.preventDefault();
		if (location.hash !== link.hash) history.pushState(null, '', link.hash);
		navigateToId(id, prefersReducedMotion() ? 'auto' : 'smooth');
	}, { signal });

	window.addEventListener('hashchange', () => {
		const id = decodeHash(location.hash);
		if (id) navigateToId(id, prefersReducedMotion() ? 'auto' : 'smooth');
	}, { signal });

	const cancelAnchorOnUserInput = () => anchor.cancel();
	scroller.addEventListener('wheel', cancelAnchorOnUserInput, { passive: true, signal });
	scroller.addEventListener('touchstart', cancelAnchorOnUserInput, { passive: true, signal });
	window.addEventListener('keydown', (event) => {
		if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
			anchor.cancel();
		}
	}, { signal });

	const onLayoutChange = () => {
		anchor.notifyLayoutChange();
		tracker.refresh();
	};
	article.addEventListener('load', onLayoutChange, { capture: true, signal });
	window.addEventListener('resize', () => {
		updateHeaderHeight();
		onLayoutChange();
	}, { signal });

	const articleObserver = new ResizeObserver(onLayoutChange);
	articleObserver.observe(article);
	const headerObserver = header ? new ResizeObserver(updateHeaderHeight) : null;
	headerObserver?.observe(header as HTMLElement);

	void document.fonts?.ready.then(onLayoutChange).catch(() => {});
	requestAnimationFrame(() => {
		const initialId = decodeHash(location.hash);
		if (initialId) navigateToId(initialId, 'auto');
		else tracker.refresh();
	});

	const cleanup = () => {
		abortController.abort();
		articleObserver.disconnect();
		headerObserver?.disconnect();
		anchor.destroy();
	};
	document.addEventListener('astro:before-swap', cleanup, { once: true, signal });
	cleanupCurrentController = cleanup;
}
