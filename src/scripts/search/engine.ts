import Fuse, { type FuseResultMatch } from 'fuse.js';
import {
	createSearchResultHref,
	createSearchSnippet,
	createSearchTargetText,
	mergeSearchRanges,
} from '../../lib/search/text';
import type { SearchDocument, SearchHit, SearchRange, SearchTarget } from '../../lib/search/types';

function matchRanges(match?: FuseResultMatch): SearchRange[] {
	return mergeSearchRanges((match?.indices ?? []).map(([start, end]) => [start, end] as SearchRange));
}

export class SearchEngine {
	private readonly fuse: Fuse<SearchDocument>;

	constructor(documents: SearchDocument[]) {
		this.fuse = new Fuse(documents, {
			keys: [
				{ name: 'title', weight: 3 },
				{ name: 'tags', weight: 2 },
				{ name: 'description', weight: 1.5 },
				{ name: 'categories', weight: 1.25 },
				{ name: 'blocks.text', weight: 1 },
			],
			threshold: 0.3,
			includeMatches: true,
			minMatchCharLength: 2,
			ignoreLocation: true,
		});
	}

	search(query: string, limit = 20): SearchHit[] {
		const normalizedQuery = query.trim();
		if (!normalizedQuery) return [];

		return this.fuse.search(normalizedQuery, { limit }).map((result) => {
			const titleMatch = result.matches?.find((match) => match.key === 'title');
			const blockMatch = result.matches?.find(
				(match) => match.key === 'blocks.text' && typeof match.refIndex === 'number',
			);
			const block = blockMatch ? result.item.blocks[blockMatch.refIndex ?? -1] : undefined;
			const blockRanges = matchRanges(blockMatch);
			const targetText = block ? createSearchTargetText(block.text, blockRanges) : '';
			const target: SearchTarget | undefined = block && targetText
				? { blockId: block.id, text: targetText }
				: undefined;
			const snippet = block
				? createSearchSnippet(block.text, blockRanges)
				: { text: result.item.excerpt, ranges: [] };

			return {
				document: result.item,
				href: createSearchResultHref(result.item.url, normalizedQuery, target),
				titleRanges: matchRanges(titleMatch),
				snippet,
				target,
			};
		});
	}
}
