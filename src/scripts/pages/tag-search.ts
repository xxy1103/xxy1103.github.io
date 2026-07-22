import type { SearchHit, SearchRange } from '../../lib/search/types';
import { SearchEngine } from '../search/engine';
import { SearchIndexRepository } from '../search/repository';

const SEARCH_DEBOUNCE_MS = 100;
const RESULT_LIMIT = 20;

type SearchMode = 'index' | 'detail';

type HistoryRecord = Record<string, unknown>;

function isHistoryRecord(value: unknown): value is HistoryRecord {
	return typeof value === 'object' && value !== null;
}

export function createTagFilterHistoryUpdate(state: unknown, tag: string | null) {
	return {
		state: { ...(isHistoryRecord(state) ? state : {}) },
		url: tag ? `/tags/#${encodeURIComponent(tag)}` : '/tags/',
	};
}

interface CardState {
	card: HTMLElement;
	id: string;
	tags: string[];
	title: HTMLElement;
	link: HTMLAnchorElement;
	excerpt: HTMLElement | null;
	originalTitle: string;
	originalHref: string;
	originalExcerpt: string;
	hadExcerpt: boolean;
}

function appendHighlightedText(container: HTMLElement, text: string, ranges: readonly SearchRange[] = []) {
	container.replaceChildren();
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

function highlightTagName(pill: HTMLElement, query: string) {
	const tagName = pill.querySelector<HTMLElement>('.tag-name');
	if (!tagName) return;
	const label = tagName.dataset.label ?? tagName.textContent ?? '';
	tagName.dataset.label = label;
	const matchIndex = query ? label.toLowerCase().indexOf(query.toLowerCase()) : -1;
	if (matchIndex < 0) {
		tagName.textContent = label;
		return;
	}
	tagName.replaceChildren(document.createTextNode(label.slice(0, matchIndex)));
	const match = document.createElement('mark');
	match.textContent = label.slice(matchIndex, matchIndex + query.length);
	tagName.append(match, document.createTextNode(label.slice(matchIndex + query.length)));
}

export function filterTagSearchHits(hits: SearchHit[], allowedPostIds: ReadonlySet<string>, limit = RESULT_LIMIT) {
	return hits.filter((hit) => allowedPostIds.has(hit.document.id)).slice(0, limit);
}

export class TagSearchController {
	private readonly abortController = new AbortController();
	private readonly repository = new SearchIndexRepository();
	private readonly input: HTMLInputElement;
	private readonly tagPills: HTMLElement[];
	private readonly cards: CardState[];
	private readonly cardsById: Map<string, CardState>;
	private readonly list: HTMLElement;
	private readonly tagStatus: HTMLElement | null;
	private readonly articleStatus: HTMLElement | null;
	private readonly postsCount: HTMLElement | null;
	private readonly emptyState: HTMLElement | null;
	private readonly emptyMessage: HTMLElement | null;
	private readonly activeTagTitle: HTMLElement | null;
	private readonly originalPostIds: Set<string>;
	private engine: SearchEngine | null = null;
	private activeTag: string | null = null;
	private query = '';
	private timer: number | null = null;

	constructor(private readonly root: Document, private readonly mode: SearchMode) {
		const input = root.querySelector<HTMLInputElement>('#tag-search');
		const list = root.querySelector<HTMLElement>('#posts-list');
		if (!input || !list) throw new Error('标签搜索界面结构不完整');
		this.input = input;
		this.list = list;
		this.tagPills = Array.from(root.querySelectorAll<HTMLElement>('.tag-pill'));
		this.tagStatus = root.querySelector<HTMLElement>('#tag-search-status');
		this.articleStatus = root.querySelector<HTMLElement>('#article-search-status');
		this.postsCount = root.querySelector<HTMLElement>('#active-posts-count');
		this.emptyState = root.querySelector<HTMLElement>('#empty-state');
		this.emptyMessage = root.querySelector<HTMLElement>('#empty-state-message');
		this.activeTagTitle = root.querySelector<HTMLElement>('#active-tag-title');
		this.cards = Array.from(root.querySelectorAll<HTMLElement>('.post-card-wrapper')).flatMap((card) => {
			const id = card.dataset.postId;
			const title = card.querySelector<HTMLElement>('.tag-post-title');
			const link = title?.querySelector<HTMLAnchorElement>('a');
			if (!id || !title || !link) return [];
			const excerpt = card.querySelector<HTMLElement>('.tag-post-excerpt');
			return [{
				card,
				id,
				tags: (card.dataset.tags ?? '').split(',').filter(Boolean),
				title,
				link,
				excerpt,
				originalTitle: title.textContent ?? '',
				originalHref: link.getAttribute('href') ?? '',
				originalExcerpt: excerpt?.textContent ?? '',
				hadExcerpt: Boolean(excerpt),
			}];
		});
		this.cardsById = new Map(this.cards.map((card) => [card.id, card]));
		this.originalPostIds = new Set(this.cards.map((card) => card.id));
		this.activeTag = mode === 'index' ? this.getHashTag() : null;
		this.bindEvents();
		this.syncActiveTagFromHash();
		this.renderInitialCards();
	}

	destroy() {
		this.abortController.abort();
		if (this.timer !== null) window.clearTimeout(this.timer);
	}

	private bindEvents() {
		const { signal } = this.abortController;
		this.input.addEventListener('input', () => this.handleInput(), { signal });
		if (this.mode === 'index') {
			this.tagPills.forEach((pill) => pill.addEventListener('click', (event) => this.handleTagClick(event, pill), { signal }));
			window.addEventListener('hashchange', () => this.syncActiveTagFromHash(), { signal });
		}
	}

	private handleInput() {
		this.query = this.input.value.trim();
		this.renderTagMatches();
		if (this.timer !== null) window.clearTimeout(this.timer);
		if (!this.query) {
			this.renderInitialCards();
			return;
		}
		this.articleStatus && (this.articleStatus.textContent = '正在搜索文章…');
		this.timer = window.setTimeout(() => void this.searchArticles(this.query), SEARCH_DEBOUNCE_MS);
	}

	private async searchArticles(query: string) {
		try {
			if (!this.engine) {
				const documents = await this.repository.load();
				if (query !== this.query) return;
				this.engine = new SearchEngine(documents);
			}
			const hits = filterTagSearchHits(this.engine.search(query, Number.MAX_SAFE_INTEGER), this.getAllowedPostIds());
			if (query !== this.query) return;
			this.renderHits(hits);
		} catch (error) {
			if (query !== this.query) return;
			this.renderSearchError(error);
		}
	}

	private getAllowedPostIds() {
		if (!this.activeTag || this.mode === 'detail') return this.originalPostIds;
		return new Set(this.cards.filter((card) => card.tags.includes(this.activeTag!)).map((card) => card.id));
	}

	private renderHits(hits: SearchHit[]) {
		const hitIds = new Set(hits.map((hit) => hit.document.id));
		this.cards.forEach((card) => {
			card.card.style.display = hitIds.has(card.id) ? 'block' : 'none';
		});
		hits.forEach((hit, index) => {
			const card = this.cardsById.get(hit.document.id);
			if (!card) return;
			this.renderHitCard(card, hit);
			card.card.style.animationDelay = `${index * 0.03}s`;
			this.list.append(card.card);
		});
		this.updateArticleState(hits.length, true);
	}

	private renderHitCard(card: CardState, hit: SearchHit) {
		appendHighlightedText(card.link, hit.document.title, hit.titleRanges);
		card.link.setAttribute('href', hit.href);
		const excerpt = card.excerpt ?? this.createExcerpt(card);
		appendHighlightedText(excerpt, hit.snippet.text, hit.snippet.ranges);
		excerpt.hidden = false;
	}

	private renderInitialCards() {
		const allowedPostIds = this.getAllowedPostIds();
		let visibleCount = 0;
		this.cards.forEach((card) => {
			const visible = allowedPostIds.has(card.id);
			card.card.style.display = visible ? 'block' : 'none';
			if (visible) {
				this.restoreCard(card);
				card.card.style.animationDelay = `${visibleCount++ * 0.03}s`;
				this.list.append(card.card);
			}
		});
		this.updateArticleState(visibleCount, false);
	}

	private restoreCard(card: CardState) {
		card.link.textContent = card.originalTitle;
		card.link.setAttribute('href', card.originalHref);
		if (!card.excerpt) return;
		card.excerpt.textContent = card.originalExcerpt;
		card.excerpt.hidden = !card.hadExcerpt;
	}

	private createExcerpt(card: CardState) {
		const excerpt = this.root.createElement('p');
		excerpt.className = 'tag-post-excerpt';
		card.card.querySelector('.tag-post-meta')?.before(excerpt);
		card.excerpt = excerpt;
		return excerpt;
	}

	private updateArticleState(count: number, isSearch: boolean) {
		if (this.postsCount) this.postsCount.textContent = isSearch ? `找到 ${count} 篇相关文章` : `共 ${count} 篇`;
		if (this.articleStatus) this.articleStatus.textContent = isSearch ? `已按相关度排序` : '';
		if (this.emptyState) this.emptyState.style.display = count === 0 ? 'flex' : 'none';
		if (this.emptyMessage) this.emptyMessage.textContent = isSearch ? '未找到相关文章' : '暂无匹配文章';
	}

	private renderSearchError(error: unknown) {
		this.renderInitialCards();
		const message = error instanceof Error ? error.message : '全文搜索暂不可用';
		if (this.articleStatus) this.articleStatus.textContent = `${message}，请重试`;
	}

	private renderTagMatches() {
		const query = this.query.toLowerCase();
		let visibleCount = 0;
		this.tagPills.forEach((pill) => {
			const matches = !query || (pill.dataset.tag ?? '').toLowerCase().includes(query);
			pill.style.display = matches ? 'inline-flex' : 'none';
			if (matches) visibleCount++;
			highlightTagName(pill, query);
		});
		if (this.tagStatus) this.tagStatus.textContent = query ? (visibleCount ? `匹配 ${visibleCount} 个标签` : '未找到匹配的标签') : '';
	}

	private handleTagClick(event: Event, pill: HTMLElement) {
		event.preventDefault();
		const tag = pill.dataset.tag;
		if (!tag) return;
		this.activeTag = this.activeTag === tag ? null : tag;
		const historyUpdate = createTagFilterHistoryUpdate(window.history.state, this.activeTag);
		window.history.replaceState(historyUpdate.state, '', historyUpdate.url);
		this.syncActiveTagUI();
		if (this.query) void this.searchArticles(this.query);
		else this.renderInitialCards();
	}

	private getHashTag() {
		return window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : null;
	}

	private syncActiveTagFromHash() {
		if (this.mode !== 'index') return;
		const candidate = this.getHashTag();
		this.activeTag = this.tagPills.some((pill) => pill.dataset.tag === candidate) ? candidate : null;
		this.syncActiveTagUI();
		if (this.query) void this.searchArticles(this.query);
		else this.renderInitialCards();
	}

	private syncActiveTagUI() {
		this.tagPills.forEach((pill) => pill.classList.toggle('active-tag', pill.dataset.tag === this.activeTag));
		if (this.activeTagTitle) this.activeTagTitle.textContent = this.activeTag ? `# ${this.activeTag}` : '所有文章';
	}
}

export function initTagSearch(mode: SearchMode) {
	const root = document as Document & { __tagSearchController?: TagSearchController };
	root.__tagSearchController?.destroy();
	if (!root.querySelector('#tag-search') || !root.querySelector('#posts-list')) return;
	root.__tagSearchController = new TagSearchController(root, mode);
}
