import { getBlogPosts } from '../lib/content/blog';
import { extractExcerpt } from '../lib/content/text';

export async function GET() {
    const posts = await getBlogPosts();

    const searchIndex = posts.map((post) => {
        const categories = Array.isArray(post.data.categories)
            ? post.data.categories
            : post.data.categories
                ? [post.data.categories]
                : [];

        return {
            id: post.id,
            title: post.data.title,
            excerpt: extractExcerpt(post.body || '', 200),
            tags: post.data.tags || [],
            categories,
            url: `/blog/${post.id}/`
        };
    });

    return new Response(JSON.stringify(searchIndex), {
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600'
        }
    });
}
