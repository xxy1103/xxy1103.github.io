import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchIndexRepository } from './repository';

afterEach(() => vi.unstubAllGlobals());

describe('SearchIndexRepository', () => {
	it('shares an in-flight request and accepts an empty index', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		const repository = new SearchIndexRepository('/index.json');
		const [left, right] = await Promise.all([repository.load(), repository.load()]);
		expect(left).toEqual([]);
		expect(right).toEqual([]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('reports invalid payloads and retries successfully', async () => {
		const validDocument = {
			id: 'demo', title: 'Demo', description: '', excerpt: '', tags: [], categories: [],
			url: '/blog/demo/', blocks: [],
		};
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(new Response('{}', { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify([validDocument]), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		const repository = new SearchIndexRepository('/index.json');
		await expect(repository.load()).rejects.toThrow('搜索索引格式无效');
		await expect(repository.load({ retry: true })).resolves.toEqual([validDocument]);
	});
});
