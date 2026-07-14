import path from 'node:path';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { visit } from 'unist-util-visit';

const publicDirectory = path.resolve(process.cwd(), 'public');
const metadataCache = new Map();

function getLocalImagePath(src) {
	if (typeof src !== 'string' || !src || /^(?:[a-z]+:)?\/\//i.test(src) || src.startsWith('data:')) {
		return null;
	}

	const pathname = src.split(/[?#]/, 1)[0];
	let decodedPath;
	try {
		decodedPath = decodeURIComponent(pathname);
	} catch {
		return null;
	}

	const relativePath = decodedPath.replace(/^\/+/, '');
	const absolutePath = path.resolve(publicDirectory, relativePath);
	const relativeToPublic = path.relative(publicDirectory, absolutePath);
	if (!relativeToPublic || relativeToPublic.startsWith('..') || path.isAbsolute(relativeToPublic)) {
		return null;
	}

	return absolutePath;
}

async function readImageDimensions(filePath) {
	if (!metadataCache.has(filePath)) {
		metadataCache.set(filePath, (async () => {
			try {
				await fs.access(filePath);
				const { width, height } = await sharp(filePath).metadata();
				return width && height ? { width, height } : null;
			} catch {
				return null;
			}
		})());
	}

	return metadataCache.get(filePath);
}

export function rehypeLazyImages() {
	return async (tree, file) => {
		const images = [];
		visit(tree, 'element', (node) => {
			if (node.tagName === 'img') images.push(node);
		});

		await Promise.all(images.map(async (node, index) => {
			node.properties ||= {};
			node.properties.loading = index === 0 ? 'eager' : 'lazy';
			node.properties.decoding = 'async';
			if (index === 0) node.properties.fetchPriority = 'high';

			if (node.properties.width && node.properties.height) return;
			const imagePath = getLocalImagePath(node.properties.src);
			if (!imagePath) return;

			const dimensions = await readImageDimensions(imagePath);
			if (!dimensions) {
				file.message(`Unable to determine image dimensions for ${node.properties.src}`);
				return;
			}

			node.properties.width = dimensions.width;
			node.properties.height = dimensions.height;
		}));
	};
}

export default rehypeLazyImages;
