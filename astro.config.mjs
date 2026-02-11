// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import remarkHexoImages from './src/plugins/remark-hexo-images.mjs';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeLazyImages from './src/plugins/rehype-lazy-images.mjs';
import { siteUrl } from './src/config/site';

/** @returns {import('vite').Plugin} */
function patchKatexFontDisplayPlugin() {
	return {
		name: 'patch-katex-font-display',
		apply: 'build',
		/** @param {import('rollup').NormalizedOutputOptions} _options @param {Record<string, import('rollup').OutputAsset | import('rollup').OutputChunk>} bundle */
		generateBundle(_options, bundle) {
			let foundKatexCss = false;
			let replacedOccurrences = 0;

			for (const [fileName, output] of Object.entries(bundle)) {
				if (output.type !== 'asset' || !fileName.endsWith('.css')) continue;

				const css =
					typeof output.source === 'string'
						? output.source
						: new TextDecoder().decode(output.source);

				if (!css.includes('font-family:KaTeX_Main')) continue;
				foundKatexCss = true;

				const matches = css.match(/font-display:block/g);
				if (!matches) continue;

				replacedOccurrences += matches.length;
				output.source = css.replaceAll('font-display:block', 'font-display:swap');
			}

			if (foundKatexCss && replacedOccurrences === 0) {
				this.warn(
					'[patch-katex-font-display] Found KaTeX CSS, but no `font-display:block` was replaced. KaTeX upstream CSS format may have changed.',
				);
			}
		},
	};
}

// https://astro.build/config
export default defineConfig({
	site: siteUrl,
	integrations: [
		mdx(),
		sitemap({
			filter: (page) => {
				const pathname = new URL(page).pathname;
				if (pathname === '/tags/' || pathname.startsWith('/tags/')) return false;
				if (/^\/blog\/\d+\/?$/.test(pathname)) return false;
				return true;
			},
		}),
	],
	markdown: {
		// 支持 Hexo 相对图片路径 image/xxx/ 自动转换为 /image/xxx/
		remarkPlugins: [remarkHexoImages, remarkMath],
		// 使用 KaTeX 渲染数学公式，图片懒加载
		rehypePlugins: [rehypeKatex, rehypeLazyImages],
		// 使用双主题支持代码高亮
		shikiConfig: {
			themes: {
				light: 'github-light',
				dark: 'github-dark',
			},
			wrap: true,
		},
	},
	vite: {
		plugins: [patchKatexFontDisplayPlugin()],
	},
});

