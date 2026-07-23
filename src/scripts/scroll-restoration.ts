import type { TransitionBeforePreparationEvent } from 'astro:transitions/client';

const SCROLLER_ID = 'main-content';
const SCROLL_STATE_KEY = '__ulboMainScrollTop';
const HISTORY_SAVE_INTERVAL_MS = 500;

type ScrollRestorationWindow = Window & {
	__ulboMainScrollRestorationReady?: boolean;
};

type HistoryRecord = Record<string, unknown>;

function isHistoryRecord(value: unknown): value is HistoryRecord {
	return typeof value === 'object' && value !== null;
}

export function normalizeMainScrollTop(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
	return Math.max(0, Math.round(value));
}

export function getMainScrollTop(state: unknown): number {
	if (!isHistoryRecord(state)) return 0;
	return normalizeMainScrollTop(state[SCROLL_STATE_KEY]);
}

export function withMainScrollTop(state: unknown, scrollTop: number): HistoryRecord {
	return {
		...(isHistoryRecord(state) ? state : {}),
		[SCROLL_STATE_KEY]: normalizeMainScrollTop(scrollTop),
	};
}

export interface RateLimitedSaver {
	schedule(): void;
	flush(): void;
	cancel(): void;
}

export function createRateLimitedSaver(
	save: () => void,
	intervalMs = HISTORY_SAVE_INTERVAL_MS,
	now = () => Date.now(),
): RateLimitedSaver {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let lastSaveAt = Number.NEGATIVE_INFINITY;

	const cancel = () => {
		if (timer === null) return;
		globalThis.clearTimeout(timer);
		timer = null;
	};

	const run = () => {
		cancel();
		lastSaveAt = now();
		save();
	};

	return {
		schedule() {
			if (timer !== null) return;
			const remaining = intervalMs - (now() - lastSaveAt);
			if (remaining <= 0) {
				run();
				return;
			}
			timer = globalThis.setTimeout(run, remaining);
		},
		flush: run,
		cancel,
	};
}

export function setupMainScrollRestoration() {
	const runtimeWindow = window as ScrollRestorationWindow;
	if (runtimeWindow.__ulboMainScrollRestorationReady) return;
	runtimeWindow.__ulboMainScrollRestorationReady = true;

	let activeScroller: HTMLElement | null = null;
	let pendingRestoreTop: number | null = getMainScrollTop(history.state);

	const persistCurrentPosition = () => {
		const scroller = document.getElementById(SCROLLER_ID);
		if (!scroller) return;
		const scrollTop = normalizeMainScrollTop(scroller.scrollTop);
		if (getMainScrollTop(history.state) === scrollTop) return;
		try {
			history.replaceState(withMainScrollTop(history.state, scrollTop), '');
		} catch (error) {
			if (!(error instanceof DOMException) || error.name !== 'SecurityError') throw error;
		}
	};
	const positionSaver = createRateLimitedSaver(persistCurrentPosition);

	const bindScroller = () => {
		const nextScroller = document.getElementById(SCROLLER_ID);
		if (nextScroller === activeScroller) return;

		activeScroller?.removeEventListener('scroll', positionSaver.schedule);
		activeScroller = nextScroller;
		activeScroller?.addEventListener('scroll', positionSaver.schedule, { passive: true });
	};

	const restorePendingPosition = () => {
		if (pendingRestoreTop === null) return;
		bindScroller();
		if (activeScroller) activeScroller.scrollTop = pendingRestoreTop;
	};

	const handleNavigationStart = (event: TransitionBeforePreparationEvent) => {
		if (event.navigationType === 'traverse') {
			positionSaver.cancel();
			pendingRestoreTop = getMainScrollTop(history.state);
			return;
		}

		positionSaver.flush();
		pendingRestoreTop = 0;
	};

	const handleAfterSwap = () => {
		bindScroller();
		restorePendingPosition();
		window.requestAnimationFrame(restorePendingPosition);
	};

	const handlePageLoad = () => {
		restorePendingPosition();
		pendingRestoreTop = null;
		bindScroller();
	};

	const handlePageShow = () => {
		positionSaver.cancel();
		pendingRestoreTop = getMainScrollTop(history.state);
		restorePendingPosition();
		window.requestAnimationFrame(() => {
			restorePendingPosition();
			pendingRestoreTop = null;
		});
	};

	document.addEventListener('astro:before-preparation', handleNavigationStart as EventListener);
	document.addEventListener('astro:after-swap', handleAfterSwap);
	document.addEventListener('astro:page-load', handlePageLoad);
	window.addEventListener('pagehide', positionSaver.flush);
	window.addEventListener('pageshow', handlePageShow);

	bindScroller();
	restorePendingPosition();
}
