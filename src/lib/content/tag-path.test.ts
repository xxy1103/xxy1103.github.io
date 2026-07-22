import { describe, expect, it } from 'vitest';
import { getTagPath } from './tag-path';

describe('getTagPath', () => {
	it.each([
		['C#', '/tags/C%23/'],
		['what?', '/tags/what%3F/'],
		['c++', '/tags/c++/'],
		['中文', '/tags/中文/'],
		['café', '/tags/café/'],
	])('builds the static tag route for %s', (tag, expected) => {
		expect(getTagPath(tag)).toBe(expected);
	});
});
