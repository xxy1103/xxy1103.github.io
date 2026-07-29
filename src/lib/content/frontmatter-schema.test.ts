import { describe, expect, it } from 'vitest';
import { blogFrontmatterSchema } from './frontmatter-schema';

const validPost = {
	title: '正式文章',
	date: '2026-07-29T10:00:00+08:00',
	categories: ['工程'],
	tags: ['astro'],
};

describe('blogFrontmatterSchema', () => {
	it('defaults a valid post to draft false and exposes normalized dates', () => {
		const result = blogFrontmatterSchema.parse(validPost);

		expect(result.draft).toBe(false);
		expect(result.pubDate).toBeInstanceOf(Date);
		expect(result.updatedDate).toBeUndefined();
	});

	it('allows a draft to have no category or tags', () => {
		const result = blogFrontmatterSchema.parse({
			title: '空草稿',
			date: '2026-07-29T10:00:00+08:00',
			draft: true,
			categories: [],
			tags: [],
		});

		expect(result.categories).toEqual([]);
		expect(result.tags).toEqual([]);
	});

	it.each([
		[{ ...validPost, categories: [] }, '正式文章必须且只能有一个分类'],
		[{ ...validPost, categories: ['工程', '随笔'] }, '文章最多只能有一个分类'],
		[{ ...validPost, tags: [] }, '正式文章至少需要一个标签'],
		[{ ...validPost, tags: ['astro', 'astro'] }, '标签不能重复'],
	])('rejects invalid publishable metadata', (frontmatter, message) => {
		const result = blogFrontmatterSchema.safeParse(frontmatter);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((issue) => issue.message === message)).toBe(true);
		}
	});

	it('trims text fields and rejects empty taxonomy values', () => {
		const parsed = blogFrontmatterSchema.parse({
			...validPost,
			title: '  标题  ',
			categories: ['  工程  '],
			tags: ['  astro  '],
		});
		expect(parsed.title).toBe('标题');
		expect(parsed.categories).toEqual(['工程']);
		expect(parsed.tags).toEqual(['astro']);

		expect(blogFrontmatterSchema.safeParse({ ...validPost, tags: ['  '] }).success).toBe(false);
	});

	it('rejects legacy and unknown fields', () => {
		const result = blogFrontmatterSchema.safeParse({
			...validPost,
			pubDate: '2026-07-29',
		});

		expect(result.success).toBe(false);
	});
});
