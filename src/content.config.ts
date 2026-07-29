import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { blogFrontmatterSchema } from './lib/content/frontmatter-schema';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// ulbo Article Manager contract: strict fields with conditional draft validation.
	schema: blogFrontmatterSchema,
});

export const collections = { blog };
