import type { SearchHit, SearchRange, SearchState } from '../../lib/search/types';

type RetryHandler = () => void;

function appendHighlightedText(container: HTMLElement, text: string, ranges: readonly SearchRange[]) {
	let cursor = 0;
	for (const [start, end] of ranges) {
		if (start > cursor) container.append(document.createTextNode(text.slice(cursor, start)));
		const highlight = document.createElement('span');
		highlight.className = 'search-highlight';
		highlight.textContent = text.slice(start, end + 1);
		container.append(highlight);
		cursor = end + 1;
	}
	if (cursor < text.length) container.append(document.createTextNode(text.slice(cursor)));
}

export class SearchView {
	readonly input: HTMLInputElement;
	readonly results: HTMLElement;
	private readonly liveRegion: HTMLElement;
	private readonly templates: Map<string, HTMLTemplateElement>;

	constructor(root: HTMLElement) {
		const input = root.querySelector<HTMLInputElement>('#search-input');
		const results = root.querySelector<HTMLElement>('#search-results');
		const liveRegion = root.querySelector<HTMLElement>('#search-status');
		if (!input || !results || !liveRegion) throw new Error('搜索界面结构不完整');
		this.input = input;
		this.results = results;
		this.liveRegion = liveRegion;
		this.templates = new Map(
			Array.from(root.querySelectorAll<HTMLTemplateElement>('template[data-search-template]')).map(
				(template) => [template.dataset.searchTemplate ?? '', template],
			),
		);
	}

	render(state: SearchState, documentCount: number, onRetry: RetryHandler) {
		if (state.status === 'idle' || (state.status === 'ready' && !state.query)) {
			this.renderTemplate('idle');
			this.announce('输入关键词开始搜索');
			return;
		}
		if (state.status === 'loading') {
			this.renderTemplate('loading');
			this.announce('正在加载搜索索引');
			return;
		}
		if (state.status === 'error') {
			this.renderTemplate('error');
			const message = this.results.querySelector<HTMLElement>('[data-search-error-message]');
			if (message) message.textContent = state.message;
			this.results.querySelector<HTMLButtonElement>('[data-search-retry]')?.addEventListener('click', onRetry, { once: true });
			this.announce(`${state.message}，可以重试`);
			return;
		}
		if (documentCount === 0) {
			this.renderTemplate('empty-index');
			this.announce('暂无可搜索文章');
			return;
		}
		if (state.hits.length === 0) {
			this.renderTemplate('no-results');
			this.announce('未找到相关文章');
			return;
		}

		this.results.replaceChildren(...state.hits.map((hit, index) => this.createResult(hit, index)));
		this.announce(`找到 ${state.hits.length} 篇相关文章`);
	}

	getResultLinks(): HTMLAnchorElement[] {
		return Array.from(this.results.querySelectorAll<HTMLAnchorElement>('.search-result-item'));
	}

	setActiveResult(index: number) {
		const links = this.getResultLinks();
		links.forEach((link, linkIndex) => {
			const active = linkIndex === index;
			link.classList.toggle('focused', active);
			link.setAttribute('aria-selected', String(active));
		});
		const activeLink = links[index];
		this.input.setAttribute('aria-activedescendant', activeLink?.id ?? '');
		activeLink?.scrollIntoView({ block: 'nearest' });
	}

	reset() {
		this.input.value = '';
		this.input.removeAttribute('aria-activedescendant');
		this.renderTemplate('idle');
		this.announce('');
	}

	private renderTemplate(name: string) {
		const template = this.templates.get(name);
		if (!template) throw new Error(`缺少搜索状态模板：${name}`);
		this.results.replaceChildren(template.content.cloneNode(true));
	}

	private createResult(hit: SearchHit, index: number): HTMLAnchorElement {
		const link = document.createElement('a');
		link.id = `search-option-${index}`;
		link.href = hit.href;
		link.className = 'search-result-item';
		link.dataset.index = String(index);
		link.setAttribute('role', 'option');
		link.setAttribute('aria-selected', 'false');
		link.tabIndex = -1;

		const title = document.createElement('div');
		title.className = 'search-result-title';
		appendHighlightedText(title, hit.document.title, hit.titleRanges);
		const excerpt = document.createElement('div');
		excerpt.className = 'search-result-excerpt';
		appendHighlightedText(excerpt, hit.snippet.text, hit.snippet.ranges);
		link.append(title, excerpt);
		return link;
	}

	private announce(message: string) {
		this.liveRegion.textContent = message;
	}
}
