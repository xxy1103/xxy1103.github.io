import { describe, expect, it } from 'vitest';
import { rehypeResponsiveTables } from './rehype-responsive-tables.mjs';

const cell = (tagName: 'th' | 'td', value: string) => ({
	type: 'element',
	tagName,
	properties: {},
	children: [{ type: 'text', value }],
});

describe('rehypeResponsiveTables', () => {
	it('wraps a wide table in an accessible scroll region', () => {
		const table = {
			type: 'element',
			tagName: 'table',
			properties: {},
			children: [
				{
					type: 'element',
					tagName: 'tr',
					properties: {},
					children: ['a', 'b', 'c', 'd'].map((value) => cell('th', value)),
				},
			],
		};
		const tree = { type: 'root', children: [table] };

		rehypeResponsiveTables()(tree);

		const shell = tree.children[0] as any;
		expect(shell.properties.className).toEqual(['table-shell', 'table-shell--wide']);
		expect(shell.properties.dataColumns).toBe(4);
		expect(shell.children[0].properties).toMatchObject({
			className: ['table-scroll'],
			tabIndex: 0,
			role: 'region',
		});
		expect(shell.children[0].children[0]).toBe(table);
	});
});
