import { describe, expect, it } from 'vitest';
import type { SearchDocument } from '../../lib/search/types';
import { SearchEngine } from './engine';

const document: SearchDocument = {
	id: 'demo',
	title: 'Astro 搜索架构',
	description: '模块化博客搜索',
	excerpt: '文章摘要',
	tags: ['Astro'],
	categories: ['工程'],
	url: '/blog/demo/',
	blocks: [
		{ id: 'search-intro', type: 'paragraph', text: '这是文章开头。' },
		{ id: 'search-late', type: 'heading', text: '数学公式与全文后半段' },
		{ id: 'search-code', type: 'code', text: "const uniqueCodeToken = 'searchable';" },
	],
};

describe('SearchEngine', () => {
	it('finds content outside the default excerpt and creates a block target', () => {
		const [hit] = new SearchEngine([document]).search('数学公式');
		expect(hit?.target?.blockId).toBe('search-late');
		expect(hit?.snippet.text).toContain('数学公式');
		expect(hit?.href).toContain('block=search-late');
	});

	it('indexes code blocks', () => {
		const [hit] = new SearchEngine([document]).search('uniqueCodeToken');
		expect(hit?.target?.blockId).toBe('search-code');
	});

	it('keeps metadata-only matches at the article top', () => {
		const [hit] = new SearchEngine([document]).search('工程');
		expect(hit?.target).toBeUndefined();
		expect(hit?.href).not.toContain('block=');
	});
});
