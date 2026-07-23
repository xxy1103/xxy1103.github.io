import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createRateLimitedSaver,
	getMainScrollTop,
	normalizeMainScrollTop,
	withMainScrollTop,
} from './scroll-restoration';

describe('main scroll history state', () => {
	it('keeps existing Astro history fields when saving a position', () => {
		expect(withMainScrollTop({ index: 4, scrollX: 0, scrollY: 0 }, 842.6)).toEqual({
			index: 4,
			scrollX: 0,
			scrollY: 0,
			__ulboMainScrollTop: 843,
		});
	});

	it('reads only a finite non-negative saved position', () => {
		expect(getMainScrollTop({ __ulboMainScrollTop: 318 })).toBe(318);
		expect(getMainScrollTop({ __ulboMainScrollTop: Number.NaN })).toBe(0);
		expect(getMainScrollTop(null)).toBe(0);
	});

	it('clamps and rounds scroll positions before saving', () => {
		expect(normalizeMainScrollTop(-20)).toBe(0);
		expect(normalizeMainScrollTop(12.7)).toBe(13);
	});
});

describe('rate-limited history saving', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('coalesces rapid scroll saves and keeps a trailing save', () => {
		vi.useFakeTimers();
		let now = 1_000;
		let saves = 0;
		const saver = createRateLimitedSaver(() => {
			saves += 1;
		}, 500, () => now);

		saver.schedule();
		expect(saves).toBe(1);

		now += 100;
		saver.schedule();
		saver.schedule();
		expect(saves).toBe(1);

		now += 400;
		vi.advanceTimersByTime(400);
		expect(saves).toBe(2);
	});

	it('cancels a pending save before history traversal', () => {
		vi.useFakeTimers();
		let now = 1_000;
		let saves = 0;
		const saver = createRateLimitedSaver(() => {
			saves += 1;
		}, 500, () => now);

		saver.schedule();
		now += 100;
		saver.schedule();
		saver.cancel();
		now += 500;
		vi.advanceTimersByTime(500);
		expect(saves).toBe(1);
	});
});
