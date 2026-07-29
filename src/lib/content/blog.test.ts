import { describe, expect, it } from 'vitest';
import { filterVisiblePosts } from './visibility';

const posts = [
	{ id: 'published', data: { draft: false } },
	{ id: 'draft', data: { draft: true } },
	{ id: 'legacy-default', data: {} },
];

describe('filterVisiblePosts', () => {
	it('keeps drafts available in development', () => {
		expect(filterVisiblePosts(posts, false).map((post) => post.id)).toEqual([
			'published',
			'draft',
			'legacy-default',
		]);
	});

	it('removes drafts from production content outputs', () => {
		expect(filterVisiblePosts(posts, true).map((post) => post.id)).toEqual([
			'published',
			'legacy-default',
		]);
	});

	it('does not mutate the source array', () => {
		expect(filterVisiblePosts(posts, false)).not.toBe(posts);
	});
});
