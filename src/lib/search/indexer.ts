import type { BlogPost } from '../content/blog';
import { extractExcerpt } from '../content/text';
import { parseSearchBlocks } from './markdown';
import type { SearchDocument } from './types';

export function createSearchDocument(post: BlogPost): SearchDocument {
	const body = post.body ?? '';
	const excerpt = extractExcerpt(body, 200);
	return {
		id: post.id,
		title: post.data.title,
		description: post.data.description?.trim() || excerpt,
		excerpt,
		tags: post.data.tags,
		categories: post.data.categories,
		url: `/blog/${post.id}/`,
		blocks: parseSearchBlocks(body),
	};
}

export function createSearchIndex(posts: BlogPost[]): SearchDocument[] {
	return posts.map(createSearchDocument);
}
