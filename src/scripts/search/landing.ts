import { normalizeSearchText } from '../../lib/search/text';
import { createScrollAnchor, type ScrollAnchorController } from '../toc/scroll-anchor';

interface CharacterLocation {
	node: Text;
	start: number;
	end: number;
}

interface NormalizedTextMap {
	text: string;
	locations: CharacterLocation[];
}

let cleanupCurrentLanding: (() => void) | null = null;

function isIgnoredTextNode(node: Text): boolean {
	const parent = node.parentElement;
	return Boolean(parent?.closest('script, style, button, .code-toolbar, .line-numbers, .last-updated-on'));
}

function collectTextNodes(root: HTMLElement): Text[] {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const nodes: Text[] = [];
	let current = walker.nextNode();
	while (current) {
		const text = current as Text;
		if (text.data && !isIgnoredTextNode(text)) nodes.push(text);
		current = walker.nextNode();
	}
	return nodes;
}

function appendNormalizedCharacter(
	output: string[],
	locations: CharacterLocation[],
	character: string,
	location: CharacterLocation,
) {
	if (/\s/u.test(character)) {
		if (output.length === 0 || output.at(-1) === ' ') return;
		output.push(' ');
		locations.push(location);
		return;
	}
	output.push(character.toLocaleLowerCase());
	locations.push(location);
}

function createNormalizedTextMap(nodes: Text[]): NormalizedTextMap {
	const output: string[] = [];
	const locations: CharacterLocation[] = [];
	for (const node of nodes) {
		for (let offset = 0; offset < node.data.length;) {
			const codePoint = node.data.codePointAt(offset);
			if (codePoint === undefined) break;
			const sourceCharacter = String.fromCodePoint(codePoint);
			const end = offset + sourceCharacter.length;
			for (const normalizedCharacter of sourceCharacter.normalize('NFKC')) {
				appendNormalizedCharacter(output, locations, normalizedCharacter, { node, start: offset, end });
			}
			offset = end;
		}
	}
	return { text: output.join(''), locations };
}

function highlightRange(map: NormalizedTextMap, start: number, length: number): HTMLElement[] {
	const selected = map.locations.slice(start, start + length);
	const groups = new Map<Text, { start: number; end: number }>();
	for (const location of selected) {
		const group = groups.get(location.node);
		if (group) {
			group.start = Math.min(group.start, location.start);
			group.end = Math.max(group.end, location.end);
		} else {
			groups.set(location.node, { start: location.start, end: location.end });
		}
	}

	const marks: HTMLElement[] = [];
	for (const [node, range] of Array.from(groups.entries()).reverse()) {
		if (!node.isConnected || range.start === range.end) continue;
		const selection = document.createRange();
		selection.setStart(node, range.start);
		selection.setEnd(node, range.end);
		const mark = document.createElement('mark');
		mark.className = 'search-landing-highlight';
		selection.surroundContents(mark);
		marks.push(mark);
	}
	return marks.reverse();
}

function findSearchBlock(id: string): HTMLElement | null {
	return Array.from(document.querySelectorAll<HTMLElement>('[data-search-block]'))
		.find((element) => element.dataset.searchBlock === id) ?? null;
}

function removeMarks(marks: HTMLElement[]) {
	for (const mark of marks) {
		if (!mark.parentNode) continue;
		const parent = mark.parentNode;
		mark.replaceWith(document.createTextNode(mark.textContent ?? ''));
		parent.normalize();
	}
}

function prefersReducedMotion() {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function setupSearchLanding() {
	cleanupCurrentLanding?.();
	cleanupCurrentLanding = null;

	const params = new URLSearchParams(window.location.search);
	const blockId = params.get('block');
	if (!blockId) return;
	const target = findSearchBlock(blockId);
	const scroller = document.getElementById('main-content');
	if (!target || !scroller) return;

	const abortController = new AbortController();
	const header = document.querySelector<HTMLElement>('header');
	const getOffset = () => {
		const headerHeight = header?.getBoundingClientRect().height || 64;
		const gap = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--anchor-gap')) || 16;
		return headerHeight + gap;
	};
	const anchor: ScrollAnchorController = createScrollAnchor(scroller, getOffset);
	const map = createNormalizedTextMap(collectTextNodes(target));
	const candidates = [params.get('match'), params.get('search')]
		.map((value) => normalizeSearchText(value ?? '').toLocaleLowerCase())
		.filter(Boolean);
	let matchStart = -1;
	let matchedText = '';
	for (const candidate of candidates) {
		matchStart = map.text.indexOf(candidate);
		if (matchStart >= 0) {
			matchedText = candidate;
			break;
		}
	}
	const marks = matchStart >= 0 ? highlightRange(map, matchStart, matchedText.length) : [];
	const scrollTarget = marks[0] ?? target;
	const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
	// Astro restores the route scroll position immediately after the page-load lifecycle.
	// Start after that restoration, then let the anchor controller correct late layout shifts.
	const startTimer = window.setTimeout(() => {
		requestAnimationFrame(() => anchor.scrollTo(scrollTarget, behavior));
	}, 80);

	const observer = new ResizeObserver(() => anchor.notifyLayoutChange());
	observer.observe(target);
	void document.fonts?.ready.then(() => anchor.notifyLayoutChange()).catch(() => {});
	const markTimer = window.setTimeout(() => removeMarks(marks), 4000);

	const cleanup = () => {
		abortController.abort();
		window.clearTimeout(startTimer);
		window.clearTimeout(markTimer);
		observer.disconnect();
		anchor.destroy();
		removeMarks(marks);
	};
	document.addEventListener('astro:before-swap', cleanup, { once: true, signal: abortController.signal });
	cleanupCurrentLanding = cleanup;
}
