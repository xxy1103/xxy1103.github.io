import { visit } from 'unist-util-visit';

/**
 * Preserves ordinary source line breaks inside Markdown blockquotes.
 * Authors can write one `>` line per thought without adding trailing spaces.
 */
export function remarkBlockquoteLineBreaks() {
	return (tree) => {
		visit(tree, 'blockquote', (blockquote) => {
			visit(blockquote, 'paragraph', (paragraph) => {
				paragraph.children = paragraph.children.flatMap((child) => {
					if (child.type !== 'text' || !child.value.includes('\n')) return [child];

					return child.value.split('\n').flatMap((line, index) =>
						index === 0
							? [{ type: 'text', value: line }]
							: [{ type: 'break' }, { type: 'text', value: line }],
					);
				});
			});
		});
	};
}

export default remarkBlockquoteLineBreaks;
