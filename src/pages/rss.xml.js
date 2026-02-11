import rss from '@astrojs/rss';
import { siteDescription, siteTitle } from '../config';
import { getBlogPosts } from '../lib/content/blog';
import { extractSeoDescription } from '../lib/content/text';

export async function GET(context) {
	const posts = await getBlogPosts();
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
