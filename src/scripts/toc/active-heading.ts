interface ActiveHeadingOptions {
	headings: HTMLElement[];
	linksById: Map<string, HTMLAnchorElement>;
	resolveTocId: (headingId: string) => string;
	scroller: HTMLElement;
	tocContainer: HTMLElement | null;
	getBaseOffset: () => number;
	signal: AbortSignal;
}

export interface ActiveHeadingTracker {
	refresh(): void;
	setActive(id: string): void;
}

export function createActiveHeadingTracker({
	headings,
	linksById,
	resolveTocId,
	scroller,
	tocContainer,
	getBaseOffset,
	signal,
}: ActiveHeadingOptions): ActiveHeadingTracker {
	let activeId = '';
	let activeLink: HTMLAnchorElement | null = null;
	let expandedItems = new Set<HTMLElement>();
	let frame: number | null = null;

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

		if (activeLink && tocContainer) {
			const containerRect = tocContainer.getBoundingClientRect();
			const linkRect = activeLink.getBoundingClientRect();
			const padding = 8;
			if (linkRect.top < containerRect.top + padding) {
				tocContainer.scrollTop -= containerRect.top + padding - linkRect.top;
			} else if (linkRect.bottom > containerRect.bottom - padding) {
				tocContainer.scrollTop += linkRect.bottom - (containerRect.bottom - padding);
			}
		}
	};

	const update = () => {
		frame = null;
		const containerTop = scroller.getBoundingClientRect().top;
		const activationOffset = Math.max(
			getBaseOffset(),
			Math.min(Math.round(scroller.clientHeight * 0.36), 360),
		);
		let currentId = '';

		for (const heading of headings) {
			if (heading.getBoundingClientRect().top - containerTop <= activationOffset) {
				currentId = heading.id;
			} else {
				break;
			}
		}

		if (scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= 1) {
			currentId = headings.at(-1)?.id ?? currentId;
		}

		setActive(currentId ? resolveTocId(currentId) : '');
	};

	const refresh = () => {
		if (frame !== null) return;
		frame = requestAnimationFrame(update);
	};

	scroller.addEventListener('scroll', refresh, { passive: true, signal });
	signal.addEventListener('abort', () => {
		if (frame !== null) cancelAnimationFrame(frame);
	}, { once: true });

	return { refresh, setActive };
}
