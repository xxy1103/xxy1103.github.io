export type ScrollNavigationResult = 'completed' | 'interrupted' | 'superseded';

export interface ScrollNavigationOptions {
	behavior: 'instant' | 'smooth';
}

export interface ArticleScrollNavigator {
	navigate(target: HTMLElement, options: ScrollNavigationOptions): Promise<ScrollNavigationResult>;
	cancel(reason?: Exclude<ScrollNavigationResult, 'completed'>): void;
	destroy(): void;
}

interface NavigationSession {
	target: HTMLElement;
	resolve: (result: ScrollNavigationResult) => void;
	settleTimer: ReturnType<typeof setTimeout> | null;
}

const POSITION_TOLERANCE = 3;
const SCROLL_SETTLE_DELAY = 120;

export function getDesiredScrollTop(
	scroller: Pick<HTMLElement, 'clientHeight' | 'scrollHeight' | 'scrollTop' | 'getBoundingClientRect'>,
	target: Pick<HTMLElement, 'getBoundingClientRect'>,
	offset: number,
) {
	const targetTop = scroller.scrollTop
		+ target.getBoundingClientRect().top
		- scroller.getBoundingClientRect().top
		- offset;
	const maximum = Math.max(scroller.scrollHeight - scroller.clientHeight, 0);
	return Math.min(Math.max(targetTop, 0), maximum);
}

export function createArticleScrollNavigator(
	scroller: HTMLElement,
	getOffset: () => number,
): ArticleScrollNavigator {
	let session: NavigationSession | null = null;
	let destroyed = false;

	const clearSettleTimer = (current: NavigationSession) => {
		if (current.settleTimer !== null) clearTimeout(current.settleTimer);
		current.settleTimer = null;
	};

	const finish = () => {
		const current = session;
		if (!current) return;

		clearSettleTimer(current);
		const desiredTop = getDesiredScrollTop(scroller, current.target, getOffset());
		if (Math.abs(desiredTop - scroller.scrollTop) > POSITION_TOLERANCE) {
			scroller.scrollTo({ top: desiredTop, behavior: 'instant' });
		}

		session = null;
		current.resolve('completed');
	};

	const scheduleSettleCheck = () => {
		if (!session) return;
		clearSettleTimer(session);
		session.settleTimer = setTimeout(finish, SCROLL_SETTLE_DELAY);
	};

	const onScroll = () => scheduleSettleCheck();
	const onScrollEnd = () => finish();
	scroller.addEventListener('scroll', onScroll, { passive: true });
	scroller.addEventListener('scrollend', onScrollEnd);

	const cancel = (reason: Exclude<ScrollNavigationResult, 'completed'> = 'interrupted') => {
		const current = session;
		if (!current) return;

		clearSettleTimer(current);
		session = null;
		// Setting the current position explicitly is the browser-supported way to
		// stop an in-flight native smooth scroll without starting another animation.
		scroller.scrollTo({ top: scroller.scrollTop, behavior: 'instant' });
		current.resolve(reason);
	};

	return {
		navigate(target, options) {
			if (destroyed) return Promise.resolve('interrupted');
			cancel('superseded');

			const desiredTop = getDesiredScrollTop(scroller, target, getOffset());
			if (options.behavior === 'instant' || Math.abs(desiredTop - scroller.scrollTop) <= POSITION_TOLERANCE) {
				if (Math.abs(desiredTop - scroller.scrollTop) > POSITION_TOLERANCE) {
					scroller.scrollTo({ top: desiredTop, behavior: 'instant' });
				}
				return Promise.resolve('completed');
			}

			return new Promise<ScrollNavigationResult>((resolve) => {
				session = { target, resolve, settleTimer: null };
				scroller.scrollTo({ top: desiredTop, behavior: 'smooth' });
				// Browsers with `scrollend` finish through that event. This fallback is
				// driven by the absence of further scroll events, not an assumed duration.
				scheduleSettleCheck();
			});
		},
		cancel,
		destroy() {
			if (destroyed) return;
			destroyed = true;
			cancel('interrupted');
			scroller.removeEventListener('scroll', onScroll);
			scroller.removeEventListener('scrollend', onScrollEnd);
		},
	};
}
