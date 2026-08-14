import { visit } from 'unist-util-visit';

/**
 * Wrap Markdown tables in a block scroll container while preserving native
 * table semantics. The column count is exposed for lightweight mobile hints.
 */
export function rehypeResponsiveTables() {
	return (tree) => {
		const tables = [];

		visit(tree, 'element', (node, index, parent) => {
			if (node.tagName !== 'table' || typeof index !== 'number' || !parent?.children) return;
			tables.push({ node, index, parent });
		});

		for (const { node, index, parent } of tables.reverse()) {
			const columnCount = getColumnCount(node);
			const wideTable = columnCount >= 4;

			parent.children[index] = {
				type: 'element',
				tagName: 'div',
				properties: {
					className: ['table-shell', ...(wideTable ? ['table-shell--wide'] : [])],
					dataColumns: columnCount,
				},
				children: [
					{
						type: 'element',
						tagName: 'div',
						properties: {
							className: ['table-scroll'],
							tabIndex: 0,
							role: 'region',
							ariaLabel: '可横向滚动的数据表格',
						},
						children: [node],
					},
				],
			};
		}
	};
}

function getColumnCount(table) {
	let maximum = 0;
	visit(table, 'element', (node) => {
		if (node.tagName !== 'tr') return;
		const count = (node.children ?? []).filter(
			(child) => child.type === 'element' && (child.tagName === 'th' || child.tagName === 'td'),
		).length;
		maximum = Math.max(maximum, count);
	});
	return maximum;
}

export default rehypeResponsiveTables;
