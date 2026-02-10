import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { siteDescription, siteTitle } from '../config';
import { extractSeoDescription } from '../utils/seo';
import { existsSync } from 'node:fs';

export async function GET(context) {
	const posts = (await getCollection('blog')).filter((post) =>
		post.filePath ? existsSync(post.filePath) : false
	);
	return rss({
		title: siteTitle,
		description: siteDescription,
		site: context.site,
		items: posts.map((post) => {
			const description =
				post.data.description?.trim() || extractSeoDescription(post.body ?? '') || post.data.title;
			return {
				...post.data,
				description,
				link: `/blog/${post.id}/`,
			};
		}),
	});
}
