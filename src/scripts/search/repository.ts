import type { SearchBlock, SearchDocument } from '../../lib/search/types';

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isSearchBlock(value: unknown): value is SearchBlock {
	if (!value || typeof value !== 'object') return false;
	const block = value as Partial<SearchBlock>;
	return typeof block.id === 'string' && typeof block.type === 'string' && typeof block.text === 'string';
}

export function isSearchDocument(value: unknown): value is SearchDocument {
	if (!value || typeof value !== 'object') return false;
	const document = value as Partial<SearchDocument>;
	return (
		typeof document.id === 'string' &&
		typeof document.title === 'string' &&
		typeof document.description === 'string' &&
		typeof document.excerpt === 'string' &&
		typeof document.url === 'string' &&
		isStringArray(document.tags) &&
		isStringArray(document.categories) &&
		Array.isArray(document.blocks) &&
		document.blocks.every(isSearchBlock)
	);
}

export class SearchIndexRepository {
	private documents: SearchDocument[] | null = null;
	private pending: Promise<SearchDocument[]> | null = null;

	constructor(private readonly endpoint = '/search-index.json') {}

	load(options: { retry?: boolean } = {}): Promise<SearchDocument[]> {
		if (options.retry) {
			this.documents = null;
			this.pending = null;
		}
		if (this.documents) return Promise.resolve(this.documents);
		if (this.pending) return this.pending;

		this.pending = fetch(this.endpoint, { headers: { Accept: 'application/json' } })
			.then(async (response) => {
				if (!response.ok) throw new Error(`搜索索引加载失败（${response.status}）`);
				const payload: unknown = await response.json();
				if (!Array.isArray(payload) || !payload.every(isSearchDocument)) {
					throw new Error('搜索索引格式无效');
				}
				this.documents = payload;
				return payload;
			})
			.catch((error: unknown) => {
				this.pending = null;
				throw error;
			});
		return this.pending;
	}
}
