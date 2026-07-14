export interface ScrollAnchorController {
	scrollTo(target: HTMLElement, behavior: ScrollBehavior): void;
	notifyLayoutChange(): void;
	cancel(): void;
	destroy(): void;
}

const POSITION_TOLERANCE = 3;
const STABLE_FRAME_COUNT = 3;
const LOCK_DURATION = 2500;

export function createScrollAnchor(
	scroller: HTMLElement,
	getOffset: () => number,
): ScrollAnchorController {
	let target: HTMLElement | null = null;
	let deadline = 0;
	let correctionNotBefore = 0;
	let stableFrames = 0;
	let timer: number | null = null;
	let frame: number | null = null;

	const clearScheduledWork = () => {
		if (timer !== null) window.clearTimeout(timer);
		if (frame !== null) cancelAnimationFrame(frame);
		timer = null;
		frame = null;
	};

	const cancel = () => {
		clearScheduledWork();
		target = null;
		stableFrames = 0;
	};

	const getTargetError = (element: HTMLElement) =>
		element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - getOffset();

	const scheduleCorrection = (delay = 80) => {
		if (!target) return;
		if (timer !== null) window.clearTimeout(timer);
		timer = window.setTimeout(() => {
			timer = null;
			frame = requestAnimationFrame(correctPosition);
		}, delay);
	};

	function correctPosition() {
		frame = null;
		if (!target) return;

		const now = performance.now();
		if (now < correctionNotBefore) {
			scheduleCorrection(correctionNotBefore - now);
			return;
		}

		const error = getTargetError(target);
		if (Math.abs(error) > POSITION_TOLERANCE) {
			scroller.scrollBy({ top: error, behavior: 'auto' });
			stableFrames = 0;
		} else {
			stableFrames += 1;
		}

		if (now >= deadline || stableFrames >= STABLE_FRAME_COUNT) {
			cancel();
			return;
		}

		scheduleCorrection(100);
	}

	return {
		scrollTo(nextTarget, behavior) {
			clearScheduledWork();
			target = nextTarget;
			stableFrames = 0;
			const now = performance.now();
			deadline = now + LOCK_DURATION;
			correctionNotBefore = now + (behavior === 'smooth' ? 450 : 0);

			const top = Math.max(scroller.scrollTop + getTargetError(nextTarget), 0);
			scroller.scrollTo({ top, behavior });
			scheduleCorrection(behavior === 'smooth' ? 450 : 0);
		},
		notifyLayoutChange() {
			if (target) scheduleCorrection();
		},
		cancel,
		destroy: cancel,
	};
}
