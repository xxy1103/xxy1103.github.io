import { normalizeSearchText } from '../../lib/search/text';
import type { ArticleNavigationController } from '../toc/controller';

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

export function setupSearchLanding(navigation: ArticleNavigationController | null) {
	cleanupCurrentLanding?.();
	cleanupCurrentLanding = null;

	const params = new URLSearchParams(window.location.search);
	const blockId = params.get('block');
	if (!blockId) return;
	const target = findSearchBlock(blockId);
	if (!target || !navigation) return;

	const abortController = new AbortController();
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
	const behavior = prefersReducedMotion() ? 'instant' : 'smooth';
	const startFrame = requestAnimationFrame(() => void navigation.navigate(scrollTarget, { behavior }));
	const markTimer = window.setTimeout(() => removeMarks(marks), 4000);

	const cleanup = () => {
		abortController.abort();
		cancelAnimationFrame(startFrame);
		window.clearTimeout(markTimer);
		removeMarks(marks);
	};
	document.addEventListener('astro:before-swap', cleanup, { once: true, signal: abortController.signal });
	cleanupCurrentLanding = cleanup;
}
