import { afterEach, describe, expect, it, vi } from 'vitest';
import { createArticleScrollNavigator, getDesiredScrollTop } from './scroll-navigator';

class FakeScroller extends EventTarget {
	scrollTop = 0;
	scrollHeight = 2000;
	clientHeight = 600;
	scrollTo = vi.fn((options: ScrollToOptions) => {
		if (options.behavior === 'instant' && typeof options.top === 'number') this.scrollTop = options.top;
	});
	getBoundingClientRect() {
		return { top: 0 } as DOMRect;
	}
}

function createTarget(scroller: FakeScroller, absoluteTop: number) {
	return {
		getBoundingClientRect: () => ({ top: absoluteTop - scroller.scrollTop }) as DOMRect,
	} as HTMLElement;
}

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('getDesiredScrollTop', () => {
	it('applies the header offset and clamps to the scroll range', () => {
		const scroller = new FakeScroller();
		expect(getDesiredScrollTop(scroller as unknown as HTMLElement, createTarget(scroller, 500), 80)).toBe(420);
		expect(getDesiredScrollTop(scroller as unknown as HTMLElement, createTarget(scroller, 1900), 80)).toBe(1400);
	});
});

describe('createArticleScrollNavigator', () => {
	it('uses one native smooth scroll and completes on scrollend', async () => {
		const scroller = new FakeScroller();
		const navigator = createArticleScrollNavigator(scroller as unknown as HTMLElement, () => 80);
		const result = navigator.navigate(createTarget(scroller, 500), { behavior: 'smooth' });

		expect(scroller.scrollTo).toHaveBeenCalledTimes(1);
		expect(scroller.scrollTo).toHaveBeenCalledWith({ top: 420, behavior: 'smooth' });
		scroller.scrollTop = 420;
		scroller.dispatchEvent(new Event('scrollend'));

		await expect(result).resolves.toBe('completed');
		expect(scroller.scrollTo).toHaveBeenCalledTimes(1);
		navigator.destroy();
	});

	it('performs at most one instant correction after scrolling ends', async () => {
		const scroller = new FakeScroller();
		const navigator = createArticleScrollNavigator(scroller as unknown as HTMLElement, () => 80);
		const result = navigator.navigate(createTarget(scroller, 500), { behavior: 'smooth' });

		scroller.scrollTop = 400;
		scroller.dispatchEvent(new Event('scrollend'));

		await expect(result).resolves.toBe('completed');
		expect(scroller.scrollTo).toHaveBeenCalledTimes(2);
		expect(scroller.scrollTo).toHaveBeenLastCalledWith({ top: 420, behavior: 'instant' });
		scroller.dispatchEvent(new Event('scrollend'));
		expect(scroller.scrollTo).toHaveBeenCalledTimes(2);
		navigator.destroy();
	});

	it('supersedes an older navigation and lets the newest one finish', async () => {
		const scroller = new FakeScroller();
		const navigator = createArticleScrollNavigator(scroller as unknown as HTMLElement, () => 80);
		const first = navigator.navigate(createTarget(scroller, 500), { behavior: 'smooth' });
		const second = navigator.navigate(createTarget(scroller, 900), { behavior: 'smooth' });

		await expect(first).resolves.toBe('superseded');
		scroller.scrollTop = 820;
		scroller.dispatchEvent(new Event('scrollend'));
		await expect(second).resolves.toBe('completed');
		navigator.destroy();
	});

	it('stops native scrolling and reports user interruption', async () => {
		const scroller = new FakeScroller();
		const navigator = createArticleScrollNavigator(scroller as unknown as HTMLElement, () => 80);
		const result = navigator.navigate(createTarget(scroller, 500), { behavior: 'smooth' });
		scroller.scrollTop = 140;

		navigator.cancel('interrupted');

		await expect(result).resolves.toBe('interrupted');
		expect(scroller.scrollTo).toHaveBeenLastCalledWith({ top: 140, behavior: 'instant' });
		navigator.destroy();
	});

	it('uses scroll-event quiet time as the scrollend fallback', async () => {
		vi.useFakeTimers();
		const scroller = new FakeScroller();
		const navigator = createArticleScrollNavigator(scroller as unknown as HTMLElement, () => 80);
		const resolved = vi.fn();
		void navigator.navigate(createTarget(scroller, 500), { behavior: 'smooth' }).then(resolved);

		scroller.scrollTop = 200;
		scroller.dispatchEvent(new Event('scroll'));
		await vi.advanceTimersByTimeAsync(100);
		scroller.scrollTop = 420;
		scroller.dispatchEvent(new Event('scroll'));
		await vi.advanceTimersByTimeAsync(119);
		expect(resolved).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(resolved).toHaveBeenCalledWith('completed');
		navigator.destroy();
	});

	it('uses instant behavior without creating a navigation session', async () => {
		const scroller = new FakeScroller();
		const navigator = createArticleScrollNavigator(scroller as unknown as HTMLElement, () => 80);

		await expect(navigator.navigate(createTarget(scroller, 500), { behavior: 'instant' }))
			.resolves.toBe('completed');
		expect(scroller.scrollTo).toHaveBeenCalledOnce();
		expect(scroller.scrollTo).toHaveBeenCalledWith({ top: 420, behavior: 'instant' });
		navigator.destroy();
	});
});
