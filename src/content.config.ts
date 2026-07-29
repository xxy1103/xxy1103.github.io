import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: () =>
		z.object({
			title: z.string().trim().min(1),
			date: z.coerce.date(),
			updated: z.coerce.date().optional(),
			description: z.string().trim().min(1).optional(),
			categories: z.array(z.string().trim().min(1)).length(1),
			tags: z
				.array(z.string().trim().min(1))
				.min(1)
				.refine((tags) => new Set(tags).size === tags.length, {
					message: 'tags 不能包含重复项',
				}),
		}).transform((data) => ({
			...data,
			// 页面层继续使用既有的标准化字段名。
			pubDate: data.date,
			updatedDate: data.updated,
		})),
});

export const collections = { blog };
