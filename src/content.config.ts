import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	// 兼容 Hexo 和 Astro 两种规范
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			// Hexo 使用 date，Astro 使用 pubDate，两者都支持
			date: z.coerce.date().optional(),
			pubDate: z.coerce.date().optional(),
			// description 在 Hexo 中是可选的
			description: z.string().optional(),
			updatedDate: z.coerce.date().optional(),
			// Hexo 的 updated 字段
			updated: z.coerce.date().optional(),
			heroImage: image().optional(),
			// Hexo 特有字段
			categories: z.union([z.string(), z.array(z.string())]).optional(),
			tags: z.union([z.string(), z.array(z.string())]).optional(),
			// Hexo 其他常见字段
			permalink: z.string().optional(),
			comments: z.boolean().optional(),
			layout: z.string().optional(),
			excerpt: z.string().optional(),
		}).transform((data) => ({
			...data,
			// 统一处理日期：优先使用 pubDate，否则使用 date
			pubDate: data.pubDate ?? data.date ?? new Date(),
			// 统一处理更新日期
			updatedDate: data.updatedDate ?? data.updated,
			// 确保 categories 和 tags 总是数组
			categories: data.categories 
				? (Array.isArray(data.categories) ? data.categories : [data.categories])
				: [],
			tags: data.tags
				? (Array.isArray(data.tags) ? data.tags : [data.tags])
				: [],
		})),
});

export const collections = { blog };
