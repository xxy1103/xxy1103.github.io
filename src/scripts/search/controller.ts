import { reduceSearchState, type SearchState } from '../../lib/search/types';
import { SearchDialog } from './dialog';
import { SearchEngine } from './engine';
import { SearchIndexRepository } from './repository';
import { SearchView } from './view';

const SEARCH_DEBOUNCE_MS = 100;

export class SearchController {
	private readonly abortController = new AbortController();
	private readonly repository = new SearchIndexRepository();
	private readonly view: SearchView;
	private readonly dialog: SearchDialog;
	private engine: SearchEngine | null = null;
	private state: SearchState = { status: 'idle' };
	private documentCount = 0;
	private selectedIndex = -1;
	private searchTimer: number | null = null;
	private destroyed = false;

	constructor(private readonly root: HTMLElement) {
		this.view = new SearchView(root);
		this.dialog = new SearchDialog(root, this.view.input, () => this.resetAfterClose());
		this.bindEvents();
		this.render();
	}

	open(trigger?: HTMLElement | null) {
		this.dialog.open(trigger);
		if (this.engine) {
			this.runSearch(this.view.input.value.trim());
			return;
		}
		void this.loadIndex();
	}

	destroy() {
		this.destroyed = true;
		this.abortController.abort();
		if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
		this.dialog.destroy();
	}

	private bindEvents() {
		const { signal } = this.abortController;
		this.root.querySelector('#search-close')?.addEventListener('click', () => this.dialog.close(), { signal });
		this.root.querySelector('.search-overlay')?.addEventListener('click', () => this.dialog.close(), { signal });
		this.view.input.addEventListener('input', () => this.handleInput(), { signal });
		this.view.input.addEventListener('keydown', (event) => this.handleInputKeydown(event), { signal });
		this.view.results.addEventListener('click', (event) => {
			if ((event.target as Element).closest('.search-result-item')) this.dialog.close('navigate');
		}, { signal });
		document.addEventListener('click', (event) => {
			const trigger = (event.target as Element).closest<HTMLElement>('#search-btn');
			if (trigger) this.open(trigger);
		}, { signal });
		document.addEventListener('keydown', (event) => this.handleDocumentKeydown(event), { signal });
	}

	private handleInput() {
		const query = this.view.input.value.trim();
		this.state = reduceSearchState(this.state, { type: 'query-change', query });
		this.selectedIndex = -1;
		this.view.input.removeAttribute('aria-activedescendant');
		if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
		this.searchTimer = window.setTimeout(() => this.runSearch(query), SEARCH_DEBOUNCE_MS);
	}

	private handleInputKeydown(event: KeyboardEvent) {
		const links = this.view.getResultLinks();
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			this.selectedIndex = links.length === 0 ? -1 : Math.min(this.selectedIndex + 1, links.length - 1);
			this.view.setActiveResult(this.selectedIndex);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			this.selectedIndex = links.length === 0
				? -1
				: this.selectedIndex < 0 ? links.length - 1 : Math.max(this.selectedIndex - 1, 0);
			this.view.setActiveResult(this.selectedIndex);
		} else if (event.key === 'Enter' && this.selectedIndex >= 0) {
			event.preventDefault();
			links[this.selectedIndex]?.click();
		}
	}

	private handleDocumentKeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			if (this.dialog.isOpen) this.dialog.close();
			else this.open(document.getElementById('search-btn'));
			return;
		}
		if (!this.dialog.isOpen) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			this.dialog.close();
		} else if (event.key === 'Tab') {
			this.dialog.trapTab(event);
		}
	}

	private async loadIndex(retry = false) {
		const query = this.view.input.value.trim();
		this.state = reduceSearchState(this.state, { type: 'load-start', query });
		this.render();
		try {
			const documents = await this.repository.load({ retry });
			if (this.destroyed) return;
			this.documentCount = documents.length;
			this.engine = new SearchEngine(documents);
			const latestQuery = this.view.input.value.trim();
			const hits = latestQuery ? this.engine.search(latestQuery) : [];
			this.state = reduceSearchState(this.state, { type: 'load-success', query: latestQuery, hits });
		} catch (error) {
			if (this.destroyed) return;
			const message = error instanceof Error ? error.message : '搜索索引加载失败';
			this.state = reduceSearchState(this.state, { type: 'load-error', query: this.view.input.value.trim(), message });
		}
		this.selectedIndex = -1;
		this.render();
	}

	private runSearch(query: string) {
		if (!this.engine) {
			if (this.state.status !== 'loading' && this.state.status !== 'error') void this.loadIndex();
			return;
		}
		const hits = query ? this.engine.search(query) : [];
		this.state = reduceSearchState(this.state, { type: 'search-complete', query, hits });
		this.selectedIndex = -1;
		this.render();
	}

	private render() {
		this.view.render(this.state, this.documentCount, () => void this.loadIndex(true));
	}

	private resetAfterClose() {
		this.state = reduceSearchState(this.state, { type: 'reset' });
		this.selectedIndex = -1;
		this.view.reset();
	}
}
