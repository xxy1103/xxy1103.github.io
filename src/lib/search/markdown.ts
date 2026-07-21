import type { Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { createSearchBlockId, normalizeSearchText } from './text';
import type { SearchBlock, SearchBlockType } from './types';

type SearchableNode = {
	type: string;
	value?: string;
	alt?: string;
	children?: SearchableNode[];
	data?: {
		hProperties?: Record<string, unknown>;
	};
};

const SEARCHABLE_TYPES = new Map<string, SearchBlockType>([
	['heading', 'heading'],
	['paragraph', 'paragraph'],
	['table', 'table'],
	['code', 'code'],
	['math', 'math'],
	['html', 'html'],
]);

function nodeText(node: SearchableNode): string {
	if (node.type === 'image') return node.alt ?? '';
	if (typeof node.value === 'string') {
		return node.type === 'html'
			? node.value
				.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/giu, ' ')
				.replace(/<[^>]+>/gu, ' ')
			: node.value;
	}
	return (node.children ?? []).map(nodeText).join(' ');
}

export function assignSearchBlocks(tree: Root): SearchBlock[] {
	const blocks: SearchBlock[] = [];
	const occurrences = new Map<string, number>();

	visit(tree, (rawNode) => {
		const node = rawNode as SearchableNode;
		const blockType = SEARCHABLE_TYPES.get(node.type);
		if (!blockType) return;

		const text = normalizeSearchText(nodeText(node));
		if (!text) return;
		const hashKey = `${blockType}:${text}`;
		const occurrence = occurrences.get(hashKey) ?? 0;
		occurrences.set(hashKey, occurrence + 1);
		const id = createSearchBlockId(hashKey, occurrence);

		node.data ??= {};
		node.data.hProperties = {
			...(node.data.hProperties ?? {}),
			'data-search-block': id,
		};
		blocks.push({ id, type: blockType, text });
	});

	return blocks;
}

export function parseSearchBlocks(markdown: string): SearchBlock[] {
	const tree = unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkMath)
		.parse(markdown) as Root;
	return assignSearchBlocks(tree);
}
