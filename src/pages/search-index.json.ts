import { getCollection } from 'astro:content';
import { existsSync } from 'node:fs';

export async function GET() {
    const posts = (await getCollection('blog')).filter((post) =>
        post.filePath ? existsSync(post.filePath) : false
    );

    const searchIndex = posts.map((post) => {
        // 获取摘要
        const body = post.body || '';
        const moreIndex = body.indexOf('<!-- more -->');
        const excerpt = moreIndex > 0
            ? body.substring(0, moreIndex).trim()
            : body.substring(0, 300).trim();

        // 清理 markdown 语法
        const cleanExcerpt = excerpt
            .replace(/^#+\s+/gm, '')
            .replace(/\*\*/g, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/`[^`]+`/g, '')
            .replace(/\n/g, ' ')
            .trim();

        return {
            id: post.id,
            title: post.data.title,
            excerpt: cleanExcerpt.substring(0, 200),
            tags: post.data.tags || [],
            categories: post.data.categories || '',
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
