import { describe, expect, it } from 'vitest';
import { reduceSearchState, type SearchState } from './types';

describe('search state reducer', () => {
	it('keeps the newest query while the index is loading', () => {
		let state: SearchState = { status: 'idle' };
		state = reduceSearchState(state, { type: 'load-start', query: '' });
		state = reduceSearchState(state, { type: 'query-change', query: '数学公式' });
		expect(state).toEqual({ status: 'loading', query: '数学公式' });
	});

	it('preserves a failed query for retry and can reset cleanly', () => {
		const failed = reduceSearchState(
			{ status: 'loading', query: 'Astro' },
			{ type: 'load-error', query: 'Astro', message: '网络错误' },
		);
		expect(failed).toEqual({ status: 'error', query: 'Astro', message: '网络错误' });
		expect(reduceSearchState(failed, { type: 'reset' })).toEqual({ status: 'idle' });
	});
});
