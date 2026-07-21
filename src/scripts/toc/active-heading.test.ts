import { describe, expect, it } from 'vitest';
import { findActiveHeadingIndex } from './active-heading';

describe('findActiveHeadingIndex', () => {
	it('returns the last heading at or above the activation threshold', () => {
		const positions = [120, 480, 900, 1420];
		expect(findActiveHeadingIndex(positions, 100)).toBe(-1);
		expect(findActiveHeadingIndex(positions, 120)).toBe(0);
		expect(findActiveHeadingIndex(positions, 899)).toBe(1);
		expect(findActiveHeadingIndex(positions, 2000)).toBe(3);
	});

	it('handles empty and single-heading articles', () => {
		expect(findActiveHeadingIndex([], 500)).toBe(-1);
		expect(findActiveHeadingIndex([200], 199)).toBe(-1);
		expect(findActiveHeadingIndex([200], 200)).toBe(0);
	});
});
