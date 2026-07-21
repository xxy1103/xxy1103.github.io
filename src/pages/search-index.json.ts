import { getBlogPosts } from '../lib/content/blog';
import { createSearchIndex } from '../lib/search/indexer';

export async function GET() {
    const posts = await getBlogPosts();

	const searchIndex = createSearchIndex(posts);

	return new Response(JSON.stringify(searchIndex), {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'public, max-age=3600',
		},
	});
}
