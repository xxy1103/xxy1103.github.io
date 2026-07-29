export function filterVisiblePosts<T extends { data: { draft?: boolean } }>(
	posts: T[],
	isProduction: boolean,
): T[] {
	return isProduction ? posts.filter((post) => post.data.draft !== true) : [...posts];
}
