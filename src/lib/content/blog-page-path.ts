export interface BlogPageUrls {
	current: string;
	prev: string | undefined;
	next: string | undefined;
}

function assertPageNumber(page: number, name: string) {
	if (!Number.isInteger(page) || page < 1) {
		throw new RangeError(`${name} must be a positive integer`);
	}
}

export function getBlogPagePath(page: number): string {
	assertPageNumber(page, 'page');
	return page === 1 ? '/blog/' : `/blog/page/${page}/`;
}

export function getBlogPageParam(page: number): string | undefined {
	assertPageNumber(page, 'page');
	return page === 1 ? undefined : `page/${page}`;
}

export function getBlogPageUrls(currentPage: number, lastPage: number): BlogPageUrls {
	assertPageNumber(currentPage, 'currentPage');
	assertPageNumber(lastPage, 'lastPage');
	if (currentPage > lastPage) throw new RangeError('currentPage cannot exceed lastPage');

	return {
		current: getBlogPagePath(currentPage),
		prev: currentPage > 1 ? getBlogPagePath(currentPage - 1) : undefined,
		next: currentPage < lastPage ? getBlogPagePath(currentPage + 1) : undefined,
	};
}
