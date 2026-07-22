import { describe, expect, it } from 'vitest';
import type { SearchHit } from '../../lib/search/types';
import { createTagFilterHistoryUpdate, filterTagSearchHits } from './tag-search';

function hit(id: string): SearchHit {
	return {
		document: {
			id,
			title: id,
			description: '',
			excerpt: '',
			tags: [],
			categories: [],
			url: `/blog/${id}/`,
			blocks: [],
		},
		href: `/blog/${id}/`,
		titleRanges: [],
		snippet: { text: '', ranges: [] },
	};
}

describe('filterTagSearchHits', () => {
	it('keeps global relevance order while limiting results to the rendered tag scope', () => {
		const results = filterTagSearchHits([hit('outside'), hit('first'), hit('second')], new Set(['first', 'second']));
		expect(results.map((result) => result.document.id)).toEqual(['first', 'second']);
	});

	it('applies the result limit after scope filtering', () => {
		const results = filterTagSearchHits([hit('outside'), hit('first'), hit('second')], new Set(['first', 'second']), 1);
		expect(results.map((result) => result.document.id)).toEqual(['first']);
	});
});

describe('createTagFilterHistoryUpdate', () => {
	it('preserves Astro and custom history fields while replacing the tag hash', () => {
		const original = { index: 4, scrollX: 0, scrollY: 120, __ulboMainScrollTop: 640 };
		const update = createTagFilterHistoryUpdate(original, 'C#');

		expect(update).toEqual({
			state: original,
			url: '/tags/#C%23',
		});
		expect(update.state).not.toBe(original);
	});

	it('clears the filter without clearing the current history state', () => {
		expect(createTagFilterHistoryUpdate({ index: 2 }, null)).toEqual({
			state: { index: 2 },
			url: '/tags/',
		});
	});
});
