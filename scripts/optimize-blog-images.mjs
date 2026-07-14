#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT_DIR = process.cwd();
const CONTENT_DIR = path.join(ROOT_DIR, 'src', 'content', 'blog');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const CACHE_PATH = path.join(ROOT_DIR, '.astro', 'image-optimizer-cache.json');
const CACHE_VERSION = 1;
const DEFAULT_MAX_WIDTH = 1600;
const DEFAULT_QUALITY = 78;

function parseArgs(argv) {
	const args = argv.slice(2);
	const files = [];
	let maxWidth = DEFAULT_MAX_WIDTH;
	let quality = DEFAULT_QUALITY;
	let dryRun = false;
	let force = false;
	let help = false;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === '--max-width' && args[index + 1]) {
			maxWidth = Number.parseInt(args[index + 1], 10);
			index += 1;
			continue;
		}
		if (arg === '--quality' && args[index + 1]) {
			quality = Number.parseInt(args[index + 1], 10);
			index += 1;
			continue;
		}
		if (arg === '--dry-run') {
			dryRun = true;
			continue;
		}
		if (arg === '--force') {
			force = true;
			continue;
		}
		if (arg === '--help' || arg === '-h') {
			help = true;
			continue;
		}
		if (arg.startsWith('--')) {
			throw new Error(`Unknown option: ${arg}`);
		}
		files.push(arg);
	}

	return {
		files,
		maxWidth: Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : DEFAULT_MAX_WIDTH,
		quality:
			Number.isFinite(quality) && quality >= 1 && quality <= 100 ? quality : DEFAULT_QUALITY,
		dryRun,
		force,
		help,
	};
}

function printHelp() {
	console.log(`Usage: node scripts/optimize-blog-images.mjs [files...] [options]

Options:
  --max-width <pixels>  Maximum output width (default: ${DEFAULT_MAX_WIDTH})
  --quality <1-100>     WebP quality (default: ${DEFAULT_QUALITY})
  --dry-run             Preview conversions and Markdown changes without writing
  --force               Regenerate WebP files even when the cache is current
  -h, --help            Show this help`);
}

async function fileExists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function walkMarkdownFiles(directory) {
	if (!(await fileExists(directory))) return [];
	const entries = await fs.readdir(directory, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walkMarkdownFiles(fullPath)));
		} else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
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

function isConvertibleImageUrl(url) {
	if (!url || /^(?:https?:)?\/\//i.test(url) || url.startsWith('data:')) return false;
	return /\.(png|jpe?g)$/i.test(splitAssetUrl(url).pathname);
}

function toPosixPath(filePath) {
	return filePath.split(path.sep).join('/');
}

function isInsideDirectory(parent, candidate) {
	const relative = path.relative(parent, candidate);
	return Boolean(relative) && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

async function resolvePublicFileFromUrl(url) {
	const { pathname } = splitAssetUrl(url);
	let decodedPath;
	try {
		decodedPath = decodeURIComponent(pathname);
	} catch {
		return null;
	}

	const relativeUrl = decodedPath.replace(/^[/\\]+/, '');
	const absolutePath = path.resolve(PUBLIC_DIR, relativeUrl);
	if (!isInsideDirectory(PUBLIC_DIR, absolutePath) || !(await fileExists(absolutePath))) return null;

	return { filePath: absolutePath, resolvedUrl: url };
}

function toWebpUrl(url) {
	const { pathname, suffix } = splitAssetUrl(url);
	return `${pathname.replace(/\.(png|jpe?g)$/i, '.webp')}${suffix}`;
}

async function findSiblingSourceCollision(inputPath) {
	const directory = path.dirname(inputPath);
	const inputName = path.basename(inputPath).toLowerCase();
	const stem = path.basename(inputPath, path.extname(inputPath)).toLowerCase();
	const entries = await fs.readdir(directory, { withFileTypes: true });
	return entries.find((entry) => {
		if (!entry.isFile() || entry.name.toLowerCase() === inputName) return false;
		return path.basename(entry.name, path.extname(entry.name)).toLowerCase() === stem
			&& /^\.(png|jpe?g)$/i.test(path.extname(entry.name));
	})?.name ?? null;
}

async function loadCache() {
	try {
		const parsed = JSON.parse(await fs.readFile(CACHE_PATH, 'utf8'));
		if (parsed.version === CACHE_VERSION && parsed.entries && typeof parsed.entries === 'object') {
			return parsed;
		}
	} catch (error) {
		if (error?.code !== 'ENOENT') console.warn('[image-optimizer] Ignoring an invalid cache file.');
	}
	return { version: CACHE_VERSION, entries: {} };
}

async function saveCache(cache) {
	await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
	await fs.writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

function createCacheEntry(inputStat, outputPath, options) {
	return {
		inputBytes: inputStat.size,
		inputMtimeMs: inputStat.mtimeMs,
		maxWidth: options.maxWidth,
		quality: options.quality,
		output: toPosixPath(path.relative(PUBLIC_DIR, outputPath)),
	};
}

function cacheMatches(entry, expected) {
	return entry
		&& entry.inputBytes === expected.inputBytes
		&& entry.inputMtimeMs === expected.inputMtimeMs
		&& entry.maxWidth === expected.maxWidth
		&& entry.quality === expected.quality
		&& entry.output === expected.output;
}

function imagePipeline(inputPath, options) {
	return sharp(inputPath)
		.rotate()
		.resize({ width: options.maxWidth, withoutEnlargement: true })
		.webp({ quality: options.quality, effort: 5 });
}

async function optimizeToWebp(inputPath, outputPath, options, cachedEntry) {
	const inputStat = await fs.stat(inputPath);
	const expectedCacheEntry = createCacheEntry(inputStat, outputPath, options);
	const outputExists = await fileExists(outputPath);
	const cached = !options.force && outputExists && cacheMatches(cachedEntry, expectedCacheEntry);

	if (cached) {
		const outputStat = await fs.stat(outputPath);
		return {
			generated: false,
			planned: false,
			cached: true,
			inputBytes: inputStat.size,
			outputBytes: outputStat.size,
			cacheEntry: expectedCacheEntry,
		};
	}

	if (options.dryRun) {
		const outputBuffer = await imagePipeline(inputPath, options).toBuffer();
		return {
			generated: false,
			planned: true,
			cached: false,
			inputBytes: inputStat.size,
			outputBytes: outputBuffer.length,
			cacheEntry: expectedCacheEntry,
		};
	}

	await fs.mkdir(path.dirname(outputPath), { recursive: true });
	await imagePipeline(inputPath, options).toFile(outputPath);
	const outputStat = await fs.stat(outputPath);
	return {
		generated: true,
		planned: false,
		cached: false,
		inputBytes: inputStat.size,
		outputBytes: outputStat.size,
		cacheEntry: expectedCacheEntry,
	};
}

function formatBytes(bytes) {
	if (!Number.isFinite(bytes)) return '0 B';
	if (bytes < 1024) return `${bytes} B`;
	const kibibytes = bytes / 1024;
	if (kibibytes < 1024) return `${kibibytes.toFixed(1)} KiB`;
	return `${(kibibytes / 1024).toFixed(2)} MiB`;
}

async function getTargetFiles(cliFiles) {
	if (cliFiles.length === 0) return walkMarkdownFiles(CONTENT_DIR);
	const files = [];
	for (const candidate of cliFiles) {
		const resolved = path.resolve(ROOT_DIR, candidate);
		if (!(await fileExists(resolved))) continue;
		const stat = await fs.stat(resolved);
		if (stat.isDirectory()) files.push(...(await walkMarkdownFiles(resolved)));
		else if (stat.isFile() && /\.(md|mdx)$/i.test(resolved)) files.push(resolved);
	}
	return files;
}

async function main() {
	const options = parseArgs(process.argv);
	if (options.help) {
		printHelp();
		return;
	}

	const files = await getTargetFiles(options.files);
	if (files.length === 0) {
		console.log('No Markdown files found.');
		return;
	}

	const cache = await loadCache();
	const conversionCache = new Map();
	const outputOwners = new Map();
	let cacheChanged = false;
	let updatedMarkdownFiles = 0;
	let updatedReferences = 0;
	let convertedImages = 0;
	let plannedImages = 0;
	let cachedImages = 0;
	let skippedMissingImages = 0;
	let skippedOutputCollisions = 0;
	let skippedUnmanagedOutputs = 0;
	let totalInputBytes = 0;
	let totalOutputBytes = 0;

	for (const filePath of files) {
		const original = await fs.readFile(filePath, 'utf8');
		const urls = collectImageUrls(original).filter(isConvertibleImageUrl);
		if (urls.length === 0) continue;

		let content = original;
		const replacedInFile = new Map();
		for (const url of urls) {
			const resolved = await resolvePublicFileFromUrl(url);
			if (!resolved) {
				skippedMissingImages += 1;
				continue;
			}

			const inputPath = resolved.filePath;
			const outputPath = inputPath.replace(/\.(png|jpe?g)$/i, '.webp');
			const siblingCollision = await findSiblingSourceCollision(inputPath);
			if (siblingCollision) {
				skippedOutputCollisions += 1;
				console.warn(`Skipped ambiguous source pair: ${path.relative(ROOT_DIR, inputPath)} conflicts with ${siblingCollision}`);
				continue;
			}
			const outputKey = path.resolve(outputPath).toLowerCase();
			const existingOwner = outputOwners.get(outputKey);
			if (existingOwner && existingOwner !== path.resolve(inputPath).toLowerCase()) {
				skippedOutputCollisions += 1;
				console.warn(`Skipped output collision: ${path.relative(ROOT_DIR, inputPath)} -> ${path.relative(ROOT_DIR, outputPath)}`);
				continue;
			}
			outputOwners.set(outputKey, path.resolve(inputPath).toLowerCase());

			const inputKey = toPosixPath(path.relative(PUBLIC_DIR, inputPath));
			if (!options.force && await fileExists(outputPath) && !cache.entries[inputKey]) {
				skippedUnmanagedOutputs += 1;
				console.warn(`Skipped unmanaged output (use --force to replace): ${path.relative(ROOT_DIR, outputPath)}`);
				continue;
			}
			const conversionKey = `${inputKey}::${options.maxWidth}::${options.quality}::${options.force}`;
			let result = conversionCache.get(conversionKey);
			let isNewConversion = false;
			if (!result) {
				result = await optimizeToWebp(inputPath, outputPath, options, cache.entries[inputKey]);
				conversionCache.set(conversionKey, result);
				isNewConversion = true;
			}

			if (isNewConversion) {
				totalInputBytes += result.inputBytes;
				totalOutputBytes += result.outputBytes;
				if (result.generated) convertedImages += 1;
				if (result.planned) plannedImages += 1;
				if (result.cached) cachedImages += 1;
				if (!options.dryRun && !cacheMatches(cache.entries[inputKey], result.cacheEntry)) {
					cache.entries[inputKey] = result.cacheEntry;
					cacheChanged = true;
				}
			}
			replacedInFile.set(url, toWebpUrl(resolved.resolvedUrl));
		}

		for (const [from, to] of replacedInFile) {
			if (content.includes(from)) {
				content = content.split(from).join(to);
				updatedReferences += 1;
			}
		}
		if (content !== original) {
			updatedMarkdownFiles += 1;
			if (options.dryRun) {
				console.log(`Would update: ${path.relative(ROOT_DIR, filePath)}`);
			} else {
				await fs.writeFile(filePath, content, 'utf8');
				console.log(`Updated: ${path.relative(ROOT_DIR, filePath)}`);
			}
		}
	}

	if (!options.dryRun && cacheChanged) await saveCache(cache);
	const savedBytes = Math.max(0, totalInputBytes - totalOutputBytes);
	console.log(`\nImage optimization summary${options.dryRun ? ' (dry run)' : ''}`);
	console.log(`- Markdown files ${options.dryRun ? 'that would change' : 'updated'}: ${updatedMarkdownFiles}`);
	console.log(`- References ${options.dryRun ? 'that would change' : 'replaced'}: ${updatedReferences}`);
	console.log(`- WebP files generated: ${convertedImages}`);
	console.log(`- WebP files that would be generated: ${plannedImages}`);
	console.log(`- Cache hits: ${cachedImages}`);
	console.log(`- Missing image refs skipped: ${skippedMissingImages}`);
	console.log(`- Output collisions skipped: ${skippedOutputCollisions}`);
	console.log(`- Unmanaged existing WebP files skipped: ${skippedUnmanagedOutputs}`);
	console.log(`- Original bytes (aggregated): ${formatBytes(totalInputBytes)}`);
	console.log(`- WebP bytes (aggregated): ${formatBytes(totalOutputBytes)}`);
	console.log(`- Estimated savings: ${formatBytes(savedBytes)}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
