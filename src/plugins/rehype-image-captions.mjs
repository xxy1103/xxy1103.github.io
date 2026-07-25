import { visit } from 'unist-util-visit';

/**
 * Turns a standalone Markdown image paragraph into a semantic figure.
 * The image alt text remains available to screen readers and is repeated
 * as the visible caption underneath the image.
 */
export function rehypeImageCaptions() {
	return (tree) => {
		visit(tree, 'element', (node) => {
			if (node.tagName !== 'p' || node.children?.length !== 1) return;

			const [image] = node.children;
			if (image.type !== 'element' || image.tagName !== 'img') return;

			const caption = typeof image.properties?.alt === 'string' ? image.properties.alt.trim() : '';
			if (!caption) return;

			node.tagName = 'figure';
			node.properties = {
				...node.properties,
				className: ['markdown-image'],
			};
			node.children = [
				image,
				{
					type: 'element',
					tagName: 'figcaption',
					properties: {},
					children: [{ type: 'text', value: caption }],
				},
			];
		});
	};
}

export default rehypeImageCaptions;
