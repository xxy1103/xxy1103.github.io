import type { TransitionBeforePreparationEvent } from 'astro:transitions/client';

const SCROLLER_ID = 'main-content';
const SCROLL_STATE_KEY = '__ulboMainScrollTop';

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

export function setupMainScrollRestoration() {
	const runtimeWindow = window as ScrollRestorationWindow;
	if (runtimeWindow.__ulboMainScrollRestorationReady) return;
	runtimeWindow.__ulboMainScrollRestorationReady = true;

	let activeScroller: HTMLElement | null = null;
	let saveFrame: number | null = null;
	let pendingRestoreTop: number | null = getMainScrollTop(history.state);

	const saveCurrentPosition = () => {
		if (saveFrame !== null) {
			window.cancelAnimationFrame(saveFrame);
			saveFrame = null;
		}

		const scroller = document.getElementById(SCROLLER_ID);
		if (!scroller) return;
		history.replaceState(withMainScrollTop(history.state, scroller.scrollTop), '');
	};

	const scheduleSave = () => {
		if (saveFrame !== null) return;
		saveFrame = window.requestAnimationFrame(saveCurrentPosition);
	};

	const bindScroller = () => {
		const nextScroller = document.getElementById(SCROLLER_ID);
		if (nextScroller === activeScroller) return;

		activeScroller?.removeEventListener('scroll', scheduleSave);
		activeScroller = nextScroller;
		activeScroller?.addEventListener('scroll', scheduleSave, { passive: true });
	};

	const restorePendingPosition = () => {
		if (pendingRestoreTop === null) return;
		bindScroller();
		if (activeScroller) activeScroller.scrollTop = pendingRestoreTop;
	};

	const handleNavigationStart = (event: TransitionBeforePreparationEvent) => {
		if (event.navigationType === 'traverse') {
			pendingRestoreTop = getMainScrollTop(history.state);
			return;
		}

		saveCurrentPosition();
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
		pendingRestoreTop = getMainScrollTop(history.state);
		restorePendingPosition();
		window.requestAnimationFrame(() => {
			restorePendingPosition();
			pendingRestoreTop = null;
		});
	};

	document.addEventListener('click', saveCurrentPosition, { capture: true });
	document.addEventListener('astro:before-preparation', handleNavigationStart as EventListener);
	document.addEventListener('astro:after-swap', handleAfterSwap);
	document.addEventListener('astro:page-load', handlePageLoad);
	window.addEventListener('pagehide', saveCurrentPosition);
	window.addEventListener('pageshow', handlePageShow);

	bindScroller();
	restorePendingPosition();
}
