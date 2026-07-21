import type { Root } from 'mdast';
import { assignSearchBlocks } from '../lib/search/markdown';

export default function remarkSearchBlocks() {
	return (tree: Root) => {
		assignSearchBlocks(tree);
	};
}
