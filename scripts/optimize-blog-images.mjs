#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT_DIR = process.cwd();
const CONTENT_DIR = path.join(ROOT_DIR, 'src', 'content', 'blog');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DEFAULT_MAX_WIDTH = 1600;
const DEFAULT_QUALITY = 78;

function parseArgs(argv) {
	const args = argv.slice(2);
	const files = [];
	let maxWidth = DEFAULT_MAX_WIDTH;
	let quality = DEFAULT_QUALITY;

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === '--max-width' && args[i + 1]) {
			maxWidth = Number.parseInt(args[i + 1], 10);
			i += 1;
			continue;
		}
		if (arg === '--quality' && args[i + 1]) {
			quality = Number.parseInt(args[i + 1], 10);
			i += 1;
			continue;
		}
		files.push(arg);
	}

	return {
		files,
		maxWidth: Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : DEFAULT_MAX_WIDTH,
		quality:
			Number.isFinite(quality) && quality >= 1 && quality <= 100 ? quality : DEFAULT_QUALITY,
	};
}

async function walkMarkdownFiles(dir) {
	if (!(await fileExists(dir))) {
		return [];
	}
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walkMarkdownFiles(fullPath)));
			continue;
		}
		if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
			files.push(fullPath);
		}
	}

	return files;
}

function extractUrlFromMarkdownImage(raw) {
	const value = raw.trim();
	if (!value) return null;
	if (value.startsWith('<')) {
		const end = value.indexOf('>');
		return end > 1 ? value.slice(1, end) : null;
	}
	const firstWhitespace = value.search(/\s/);
	return firstWhitespace === -1 ? value : value.slice(0, firstWhitespace);
}

function collectImageUrls(content) {
	const urls = new Set();
	const markdownImageRegex = /!\[[^\]]*]\(([^)]+)\)/g;
	const htmlImageRegex = /<img\b[^>]*\bsrc=(["'])([^"']+)\1[^>]*>/gi;

	let match;
	while ((match = markdownImageRegex.exec(content)) !== null) {
		const url = extractUrlFromMarkdownImage(match[1]);
		if (url) urls.add(url);
	}
	while ((match = htmlImageRegex.exec(content)) !== null) {
		const url = match[2]?.trim();
		if (url) urls.add(url);
	}

	return Array.from(urls);
}

function splitAssetUrl(url) {
	const parts = url.match(/^([^?#]+)([?#].*)?$/);
	if (!parts) return { pathname: url, suffix: '' };
	return { pathname: parts[1], suffix: parts[2] ?? '' };
}

function toPosixPath(filePath) {
	return filePath.split(path.sep).join('/');
}

function isConvertibleImageUrl(url) {
	if (!url) return false;
	if (
		url.startsWith('http://') ||
		url.startsWith('https://') ||
		url.startsWith('//') ||
		url.startsWith('data:')
	) {
		return false;
	}
	const { pathname } = splitAssetUrl(url);
	return /\.(png|jpe?g)$/i.test(pathname);
}

async function buildPublicFileNameIndex(rootDir) {
	const index = new Map();
	if (!(await fileExists(rootDir))) {
		return index;
	}
	async function walk(dir) {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				await walk(fullPath);
				continue;
			}
			if (!entry.isFile()) continue;
			const key = entry.name.toLowerCase();
			if (!index.has(key)) index.set(key, []);
			index.get(key).push(fullPath);
		}
	}
	await walk(rootDir);
	return index;
}

async function resolvePublicFileFromUrl(url, fileNameIndex) {
	const { pathname } = splitAssetUrl(url);
	const normalized = pathname.startsWith('/') ? pathname.slice(1) : pathname;
	const absolute = path.resolve(PUBLIC_DIR, normalized);
	if (absolute.startsWith(PUBLIC_DIR) && (await fileExists(absolute))) {
		return {
			filePath: absolute,
			resolvedUrl: normalized,
		};
	}

	const baseName = path.basename(normalized).toLowerCase();
	const candidates = fileNameIndex?.get(baseName) ?? [];
	if (candidates.length !== 1) return null;

	const matchedAbsolute = candidates[0];
	const relativeFromPublic = toPosixPath(path.relative(PUBLIC_DIR, matchedAbsolute));
	if (!relativeFromPublic || relativeFromPublic.startsWith('..')) return null;
	if (!/\.(png|jpe?g)$/i.test(relativeFromPublic)) return null;
	return {
		filePath: matchedAbsolute,
		resolvedUrl: relativeFromPublic,
	};
}

function toWebpUrl(url) {
	const { pathname, suffix } = splitAssetUrl(url);
	const nextPath = pathname.replace(/\.(png|jpe?g)$/i, '.webp');
	return `${nextPath}${suffix}`;
}

async function fileExists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function optimizeToWebp(inputPath, outputPath, options) {
	const inputStat = await fs.stat(inputPath);
	const outputExists = await fileExists(outputPath);
	if (outputExists) {
		const outputStat = await fs.stat(outputPath);
		if (outputStat.mtimeMs >= inputStat.mtimeMs) {
			return {
				generated: false,
				inputBytes: inputStat.size,
				outputBytes: outputStat.size,
			};
		}
	}

	await fs.mkdir(path.dirname(outputPath), { recursive: true });
	await sharp(inputPath)
		.rotate()
		.resize({ width: options.maxWidth, withoutEnlargement: true })
		.webp({ quality: options.quality, effort: 5 })
		.toFile(outputPath);

	const outputStat = await fs.stat(outputPath);
	return {
		generated: true,
		inputBytes: inputStat.size,
		outputBytes: outputStat.size,
	};
}

function formatBytes(bytes) {
	if (!Number.isFinite(bytes)) return '0 B';
	if (bytes < 1024) return `${bytes} B`;
	const kib = bytes / 1024;
	if (kib < 1024) return `${kib.toFixed(1)} KiB`;
	const mib = kib / 1024;
	return `${mib.toFixed(2)} MiB`;
}

async function getTargetFiles(cliFiles) {
	if (cliFiles.length === 0) {
		return walkMarkdownFiles(CONTENT_DIR);
	}

	const files = [];
	for (const candidate of cliFiles) {
		const resolved = path.resolve(ROOT_DIR, candidate);
		if (!(await fileExists(resolved))) continue;
		const stat = await fs.stat(resolved);
		if (stat.isDirectory()) {
			files.push(...(await walkMarkdownFiles(resolved)));
		} else if (stat.isFile() && /\.(md|mdx)$/i.test(resolved)) {
			files.push(resolved);
		}
	}
	return files;
}

async function main() {
	const options = parseArgs(process.argv);
	const files = await getTargetFiles(options.files);
	const publicFileNameIndex = await buildPublicFileNameIndex(PUBLIC_DIR);
	if (files.length === 0) {
		console.log('No markdown files found.');
		return;
	}

	let updatedMarkdownFiles = 0;
	let updatedReferences = 0;
	let convertedImages = 0;
	let skippedMissingImages = 0;
	let totalInputBytes = 0;
	let totalOutputBytes = 0;
	const conversionCache = new Map();

	for (const filePath of files) {
		const original = await fs.readFile(filePath, 'utf8');
		const urls = collectImageUrls(original).filter(isConvertibleImageUrl);
		if (urls.length === 0) continue;

		let content = original;
		const replacedInFile = new Map();

		for (const url of urls) {
			if (replacedInFile.has(url)) continue;
			const resolved = await resolvePublicFileFromUrl(url, publicFileNameIndex);
			const inputPath = resolved?.filePath;
			if (!resolved || !inputPath) {
				skippedMissingImages += 1;
				continue;
			}

			const outputPath = inputPath.replace(/\.(png|jpe?g)$/i, '.webp');
			const cacheKey = `${inputPath}::${outputPath}::${options.maxWidth}::${options.quality}`;
			let result = conversionCache.get(cacheKey);
			if (!result) {
				result = await optimizeToWebp(inputPath, outputPath, options);
				conversionCache.set(cacheKey, result);
			}

			totalInputBytes += result.inputBytes;
			totalOutputBytes += result.outputBytes;
			if (result.generated) convertedImages += 1;

			const webpUrl = toWebpUrl(resolved.resolvedUrl);
			replacedInFile.set(url, webpUrl);
		}

		if (replacedInFile.size === 0) continue;
		for (const [from, to] of replacedInFile.entries()) {
			if (content.includes(from)) {
				content = content.split(from).join(to);
				updatedReferences += 1;
			}
		}

		if (content !== original) {
			await fs.writeFile(filePath, content, 'utf8');
			updatedMarkdownFiles += 1;
			console.log(`Updated: ${path.relative(ROOT_DIR, filePath)}`);
		}
	}

	const savedBytes = Math.max(0, totalInputBytes - totalOutputBytes);
	console.log('');
	console.log('Image optimization summary');
	console.log(`- Markdown files updated: ${updatedMarkdownFiles}`);
	console.log(`- References replaced: ${updatedReferences}`);
	console.log(`- WebP files generated: ${convertedImages}`);
	console.log(`- Missing image refs skipped: ${skippedMissingImages}`);
	console.log(`- Original bytes (aggregated): ${formatBytes(totalInputBytes)}`);
	console.log(`- WebP bytes (aggregated): ${formatBytes(totalOutputBytes)}`);
	console.log(`- Estimated savings: ${formatBytes(savedBytes)}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
