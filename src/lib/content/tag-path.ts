/**
 * Build a tag URL that matches Astro's static route generator.
 *
 * Astro normalizes route params and escapes only characters that would change
 * the URL structure. Encoding the entire tag with encodeURIComponent() causes
 * values such as `c++` to point at `/tags/c%2B%2B/`, while Astro generates the
 * static route at `/tags/c++/`.
 */
export function getTagPath(tag: string): string {
	const routeParam = tag.normalize().replaceAll('#', '%23').replaceAll('?', '%3F');
	return `/tags/${routeParam}/`;
}
