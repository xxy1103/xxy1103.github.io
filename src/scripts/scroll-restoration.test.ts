import { describe, expect, it } from 'vitest';
import {
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
