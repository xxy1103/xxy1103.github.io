import { describe, expect, it } from 'vitest';
import { getBlogPageParam, getBlogPagePath, getBlogPageUrls } from './blog-page-path';

describe('blog page paths', () => {
	it('keeps the first page at the blog root', () => {
		expect(getBlogPagePath(1)).toBe('/blog/');
		expect(getBlogPageParam(1)).toBeUndefined();
	});

	it('places later pages below the page namespace', () => {
		expect(getBlogPagePath(2)).toBe('/blog/page/2/');
		expect(getBlogPageParam(2)).toBe('page/2');
		expect(getBlogPagePath(2)).not.toBe('/blog/2/');
	});

	it('builds current, previous, and next URLs at every boundary', () => {
		expect(getBlogPageUrls(1, 3)).toEqual({
			current: '/blog/',
			prev: undefined,
			next: '/blog/page/2/',
		});
		expect(getBlogPageUrls(2, 3)).toEqual({
			current: '/blog/page/2/',
			prev: '/blog/',
			next: '/blog/page/3/',
		});
		expect(getBlogPageUrls(3, 3)).toEqual({
			current: '/blog/page/3/',
			prev: '/blog/page/2/',
			next: undefined,
		});
	});

	it('rejects invalid page ranges', () => {
		expect(() => getBlogPagePath(0)).toThrow(RangeError);
		expect(() => getBlogPageUrls(3, 2)).toThrow(RangeError);
	});
});
