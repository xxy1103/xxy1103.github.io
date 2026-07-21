import { SearchController } from './search/controller';

let controller: SearchController | null = null;
let root: HTMLElement | null = null;

export function setupSearch() {
	const nextRoot = document.getElementById('search-modal');
	if (!nextRoot) return;
	if (controller && root === nextRoot) return;
	controller?.destroy();
	root = nextRoot;
	controller = new SearchController(nextRoot);
}

document.addEventListener('astro:page-load', setupSearch);
setupSearch();
