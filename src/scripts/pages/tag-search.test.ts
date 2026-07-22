import { describe, expect, it } from 'vitest';
import type { SearchHit } from '../../lib/search/types';
import { filterTagSearchHits } from './tag-search';

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
