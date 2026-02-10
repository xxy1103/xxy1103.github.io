const MORE_MARKER = '<!-- more -->';

function trimToLength(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	const sliced = text.slice(0, Math.max(0, maxLength - 1)).trimEnd();
	return `${sliced}…`;
}

function stripMarkdownAndHtml(text: string): string {
	return text
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/`{1,3}[^`]*`{1,3}/g, ' ')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/\*([^*]+)\*/g, '$1')
		.replace(/__([^_]+)__/g, '$1')
		.replace(/_([^_]+)_/g, '$1')
		.replace(/~~([^~]+)~~/g, '$1')
		.replace(/^\s*[-*+]\s+/gm, '')
		.replace(/^\s*>\s?/gm, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function extractSeoDescription(body: string, maxLength = 160): string {
	const source = body || '';
	const moreIndex = source.indexOf(MORE_MARKER);
	const beforeMore = moreIndex >= 0 ? source.slice(0, moreIndex) : source;
	const cleaned = stripMarkdownAndHtml(beforeMore);
	if (!cleaned) return '';
	return trimToLength(cleaned, maxLength);
}
