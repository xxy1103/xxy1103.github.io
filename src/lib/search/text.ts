import type { SearchRange, SearchSnippet } from './types';

const SEARCH_TARGET_LIMIT = 120;

export function normalizeSearchText(value: string): string {
	return value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

export function hashSearchText(value: string): string {
	let hash = 0x811c9dc5;
	for (const character of normalizeSearchText(value)) {
		hash ^= character.codePointAt(0) ?? 0;
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(36);
}

export function createSearchBlockId(text: string, occurrence: number): string {
	const suffix = occurrence > 0 ? `-${occurrence + 1}` : '';
	return `search-${hashSearchText(text)}${suffix}`;
}

export function mergeSearchRanges(ranges: readonly SearchRange[] = []): SearchRange[] {
	const sorted = ranges
		.map(([start, end]) => [start, end] as SearchRange)
		.sort((left, right) => left[0] - right[0]);
	const merged: SearchRange[] = [];

	for (const range of sorted) {
		const previous = merged.at(-1);
		if (!previous || range[0] > previous[1] + 1) {
			merged.push(range);
			continue;
		}
		merged[merged.length - 1] = [previous[0], Math.max(previous[1], range[1])];
	}
	return merged;
}

export function createSearchSnippet(
	text: string,
	ranges: readonly SearchRange[],
	maxLength = 200,
): SearchSnippet {
	const merged = mergeSearchRanges(ranges);
	if (text.length <= maxLength || merged.length === 0) {
		return { text, ranges: merged };
	}

	const firstMatch = merged[0];
	const desiredStart = Math.max(0, firstMatch[0] - Math.floor(maxLength * 0.3));
	const start = Math.min(desiredStart, Math.max(0, text.length - maxLength));
	const end = Math.min(text.length, start + maxLength);
	const prefix = start > 0 ? '…' : '';
	const suffix = end < text.length ? '…' : '';
	const snippetRanges = merged
		.filter(([rangeStart, rangeEnd]) => rangeEnd >= start && rangeStart < end)
		.map(([rangeStart, rangeEnd]) => [
			Math.max(rangeStart, start) - start + prefix.length,
			Math.min(rangeEnd, end - 1) - start + prefix.length,
		] as SearchRange);

	return {
		text: `${prefix}${text.slice(start, end)}${suffix}`,
		ranges: snippetRanges,
	};
}

export function createSearchTargetText(
	text: string,
	ranges: readonly SearchRange[],
	limit = SEARCH_TARGET_LIMIT,
): string {
	const merged = mergeSearchRanges(ranges);
	if (merged.length === 0) return '';
	const [start, end] = merged[0];
	const length = Math.min(limit, Math.max(end - start + 1, 1));
	return normalizeSearchText(text.slice(start, start + length));
}

export function createSearchResultHref(
	pathname: string,
	query: string,
	target?: { blockId: string; text: string },
): string {
	const url = new URL(pathname, 'https://search.local');
	url.searchParams.set('search', query);
	if (target?.blockId && target.text) {
		url.searchParams.set('block', target.blockId);
		url.searchParams.set('match', target.text.slice(0, SEARCH_TARGET_LIMIT));
	}
	return `${url.pathname}${url.search}`;
}
