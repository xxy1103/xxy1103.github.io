interface ActiveHeadingOptions {
	headings: HTMLElement[];
	linksById: Map<string, HTMLAnchorElement>;
	resolveTocId: (headingId: string) => string;
	scroller: HTMLElement;
	tocContainer: HTMLElement | null;
	getActivationOffset: () => number;
}

export interface ActiveHeadingTracker {
	lock(id: string): void;
	unlock(): void;
	refreshLayout(): void;
	refreshActive(): void;
	resolveIdForTarget(target: HTMLElement): string;
	destroy(): void;
}

export function findActiveHeadingIndex(positions: readonly number[], threshold: number) {
	let low = 0;
	let high = positions.length - 1;
	let match = -1;
	while (low <= high) {
		const middle = Math.floor((low + high) / 2);
		if (positions[middle] <= threshold) {
			match = middle;
			low = middle + 1;
		} else {
			high = middle - 1;
		}
	}
	return match;
}

export function createActiveHeadingTracker({
	headings,
	linksById,
	resolveTocId,
	scroller,
	tocContainer,
	getActivationOffset,
}: ActiveHeadingOptions): ActiveHeadingTracker {
	let activeId = '';
	let activeLink: HTMLAnchorElement | null = null;
	let expandedItems = new Set<HTMLElement>();
	let positions: number[] = [];
	let lockedId: string | null = null;
	let activeFrame: number | null = null;
	let layoutFrame: number | null = null;
	let destroyed = false;

	const ensureLinkVisible = () => {
		if (!activeLink || !tocContainer) return;
		const containerRect = tocContainer.getBoundingClientRect();
		const linkRect = activeLink.getBoundingClientRect();
		const padding = 8;
		if (linkRect.top < containerRect.top + padding) {
			tocContainer.scrollTop -= containerRect.top + padding - linkRect.top;
		} else if (linkRect.bottom > containerRect.bottom - padding) {
			tocContainer.scrollTop += linkRect.bottom - (containerRect.bottom - padding);
		}
	};

	const setActive = (id: string) => {
		if (id === activeId) return;
		activeId = id;
		activeLink?.classList.remove('active');
		activeLink = linksById.get(id) ?? null;

		const nextExpanded = new Set<HTMLElement>();
		if (activeLink) {
			activeLink.classList.add('active');
			let item = activeLink.closest<HTMLElement>('.toc-item');
			while (item) {
				nextExpanded.add(item);
				item = item.parentElement?.classList.contains('toc-children')
					? item.parentElement.closest<HTMLElement>('.toc-item')
					: null;
			}
		}

		for (const item of expandedItems) {
			if (!nextExpanded.has(item)) item.classList.remove('expanded');
		}
		for (const item of nextExpanded) item.classList.add('expanded');
		expandedItems = nextExpanded;
		ensureLinkVisible();
	};

	const updateActive = () => {
		activeFrame = null;
		if (destroyed || lockedId) return;
		const atEnd = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= 1;
		const index = atEnd
			? headings.length - 1
			: findActiveHeadingIndex(positions, scroller.scrollTop + getActivationOffset());
		const headingId = index >= 0 ? headings[index]?.id ?? '' : '';
		setActive(headingId ? resolveTocId(headingId) : '');
	};

	const refreshActive = () => {
		if (destroyed || lockedId || activeFrame !== null) return;
		activeFrame = requestAnimationFrame(updateActive);
	};

	const measureLayout = () => {
		layoutFrame = null;
		if (destroyed) return;
		const containerTop = scroller.getBoundingClientRect().top;
		positions = headings.map((heading) => (
			scroller.scrollTop + heading.getBoundingClientRect().top - containerTop
		));
		refreshActive();
	};

	const refreshLayout = () => {
		if (destroyed || layoutFrame !== null) return;
		layoutFrame = requestAnimationFrame(measureLayout);
	};

	const onScroll = () => refreshActive();
	scroller.addEventListener('scroll', onScroll, { passive: true });
	measureLayout();

	return {
		lock(id) {
			if (destroyed) return;
			lockedId = id;
			setActive(id);
		},
		unlock() {
			if (destroyed) return;
			lockedId = null;
		},
		refreshLayout,
		refreshActive,
		resolveIdForTarget(target) {
			if (destroyed) return '';
			const containerTop = scroller.getBoundingClientRect().top;
			const targetPosition = scroller.scrollTop + target.getBoundingClientRect().top - containerTop;
			const index = findActiveHeadingIndex(positions, targetPosition);
			return index >= 0 ? resolveTocId(headings[index]?.id ?? '') : '';
		},
		destroy() {
			destroyed = true;
			scroller.removeEventListener('scroll', onScroll);
			if (activeFrame !== null) cancelAnimationFrame(activeFrame);
			if (layoutFrame !== null) cancelAnimationFrame(layoutFrame);
		},
	};
}
