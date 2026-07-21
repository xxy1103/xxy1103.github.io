import type {
	TransitionBeforePreparationEvent,
	TransitionBeforeSwapEvent,
} from 'astro:transitions/client';

type NavigationFeedbackWindow = Window & {
	__ulboNavigationFeedbackReady?: boolean;
};

const LOADING_STATE = 'loading';
const FINISHING_STATE = 'finishing';
const FINISH_DURATION = 260;

export function setupNavigationFeedback() {
	const runtimeWindow = window as NavigationFeedbackWindow;
	if (runtimeWindow.__ulboNavigationFeedbackReady) return;
	runtimeWindow.__ulboNavigationFeedbackReady = true;

	let pendingLink: HTMLAnchorElement | null = null;
	let finishTimer: number | null = null;

	const clearPendingLink = () => {
		pendingLink?.removeAttribute('data-navigation-pending');
		pendingLink?.removeAttribute('aria-busy');
		pendingLink = null;
	};

	const beginNavigation = (event: TransitionBeforePreparationEvent) => {
		if (finishTimer !== null) {
			window.clearTimeout(finishTimer);
			finishTimer = null;
		}

		clearPendingLink();
		document.documentElement.dataset.navigationState = LOADING_STATE;

		const source = event.sourceElement;
		const anchor = source instanceof Element ? source.closest<HTMLAnchorElement>('a') : null;
		if (!anchor) return;

		pendingLink = anchor;
		pendingLink.dataset.navigationPending = 'true';
		pendingLink.setAttribute('aria-busy', 'true');
	};

	const carryLoadingState = (event: TransitionBeforeSwapEvent) => {
		event.newDocument.documentElement.dataset.navigationState = LOADING_STATE;
	};

	const finishNavigation = () => {
		clearPendingLink();

		if (document.documentElement.dataset.navigationState !== LOADING_STATE) return;
		document.documentElement.dataset.navigationState = FINISHING_STATE;

		finishTimer = window.setTimeout(() => {
			delete document.documentElement.dataset.navigationState;
			finishTimer = null;
		}, FINISH_DURATION);
	};

	document.addEventListener('astro:before-preparation', beginNavigation as EventListener);
	document.addEventListener('astro:before-swap', carryLoadingState as EventListener);
	document.addEventListener('astro:page-load', finishNavigation);
}
