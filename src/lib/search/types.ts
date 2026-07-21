export type SearchBlockType =
	| 'heading'
	| 'paragraph'
	| 'table'
	| 'code'
	| 'math'
	| 'html';

export type SearchRange = readonly [start: number, end: number];

export interface SearchBlock {
	id: string;
	type: SearchBlockType;
	text: string;
}

export interface SearchDocument {
	id: string;
	title: string;
	description: string;
	excerpt: string;
	tags: string[];
	categories: string[];
	url: string;
	blocks: SearchBlock[];
}

export interface SearchTarget {
	blockId: string;
	text: string;
}

export interface SearchSnippet {
	text: string;
	ranges: SearchRange[];
}

export interface SearchHit {
	document: SearchDocument;
	href: string;
	titleRanges: SearchRange[];
	snippet: SearchSnippet;
	target?: SearchTarget;
}

export type SearchState =
	| { status: 'idle' }
	| { status: 'loading'; query: string }
	| { status: 'ready'; query: string; hits: SearchHit[] }
	| { status: 'error'; query: string; message: string };

export type SearchStateEvent =
	| { type: 'reset' }
	| { type: 'load-start'; query: string }
	| { type: 'load-success'; query: string; hits: SearchHit[] }
	| { type: 'load-error'; query: string; message: string }
	| { type: 'query-change'; query: string }
	| { type: 'search-complete'; query: string; hits: SearchHit[] };

export function reduceSearchState(_state: SearchState, event: SearchStateEvent): SearchState {
	switch (event.type) {
		case 'reset':
			return { status: 'idle' };
		case 'load-start':
			return { status: 'loading', query: event.query };
		case 'load-success':
		case 'search-complete':
			return { status: 'ready', query: event.query, hits: event.hits };
		case 'load-error':
			return { status: 'error', query: event.query, message: event.message };
		case 'query-change':
			if (_state.status === 'loading') return { status: 'loading', query: event.query };
			if (_state.status === 'error') return { ..._state, query: event.query };
			return { status: 'ready', query: event.query, hits: [] };
	}
}
