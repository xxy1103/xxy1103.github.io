#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const write = args.includes('--write');
const check = args.includes('--check');
const rootArg = args.find((arg) => !arg.startsWith('--'));

const blogRoot = path.resolve(rootArg ?? process.cwd());
const contentRoot = path.join(blogRoot, 'src', 'content', 'blog');
const requireFromBlog = createRequire(path.join(blogRoot, 'package.json'));
const { parseDocument } = requireFromBlog('yaml');

const report = {
	mode: write ? 'write' : check ? 'check' : 'dry-run',
	blogRoot,
	totalFiles: 0,
	changedFiles: [],
	missingCategories: [],
	placeholderTags: [],
	multipleCategories: [],
	tagRenames: new Map(),
	droppedFields: new Map(),
	errors: [],
	bodyHashMismatches: [],
};

async function walk(directory) {
	const entries = await fs.readdir(directory, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		if (entry.name === 'image') continue;
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walk(fullPath)));
		} else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
			files.push(fullPath);
		}
	}

	return files;
}

function hash(value) {
	return createHash('sha256').update(value).digest('hex');
}

function findFrontmatter(source, filePath) {
	const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
	const delimiter = /^---[ \t]*(?:\r?\n|$)/gm;
	const opening = delimiter.exec(text);

	if (!opening || text.slice(0, opening.index).trim() !== '') {
		throw new Error(`${filePath}: missing opening Frontmatter delimiter`);
	}

	const closing = delimiter.exec(text);
	if (!closing) {
		throw new Error(`${filePath}: missing closing Frontmatter delimiter`);
	}

	return {
		yaml: text.slice(opening.index + opening[0].length, closing.index),
		body: text.slice(closing.index + closing[0].length).replace(/^(?:\r?\n)*/, ''),
		eol: text.includes('\r\n') ? '\r\n' : '\n',
	};
}

function normalizeDate(value, field, filePath) {
	if (value instanceof Date && !Number.isNaN(value.valueOf())) {
		const shifted = new Date(value.valueOf() + 8 * 60 * 60 * 1000);
		return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}+08:00`;
	}

	const raw = String(value ?? '').trim();
	const match = raw.match(
		/^(\d{4})-(\d{1,3})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?(?:([+-]\d{2}:\d{2}|Z))?$/,
	);

	if (!match) {
		throw new Error(`${filePath}: invalid ${field} value "${raw}"`);
	}

	const [, yearText, monthText, dayText, hourText = '0', minuteText = '0', secondText = '0', zone] =
		match;
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	const hour = Number(hourText);
	const minute = Number(minuteText);
	const second = Number(secondText);
	const probe = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

	if (
		month < 1 ||
		month > 12 ||
		day < 1 ||
		probe.getUTCFullYear() !== year ||
		probe.getUTCMonth() + 1 !== month ||
		probe.getUTCDate() !== day ||
		hour < 0 ||
		hour > 23 ||
		minute < 0 ||
		minute > 59 ||
		second < 0 ||
		second > 59
	) {
		throw new Error(`${filePath}: invalid ${field} value "${raw}"`);
	}

	if (!zone) {
		return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+08:00`;
	}

	let sourceOffsetMinutes = 0;
	if (zone !== 'Z') {
		const sign = zone.startsWith('-') ? -1 : 1;
		const [zoneHour, zoneMinute] = zone.slice(1).split(':').map(Number);
		sourceOffsetMinutes = sign * (zoneHour * 60 + zoneMinute);
	}

	const instant = Date.UTC(year, month - 1, day, hour, minute, second) - sourceOffsetMinutes * 60_000;
	const shanghai = new Date(instant + 8 * 60 * 60 * 1000);
	return `${shanghai.getUTCFullYear()}-${pad(shanghai.getUTCMonth() + 1)}-${pad(shanghai.getUTCDate())}T${pad(shanghai.getUTCHours())}:${pad(shanghai.getUTCMinutes())}:${pad(shanghai.getUTCSeconds())}+08:00`;
}

function pad(value) {
	return String(value).padStart(2, '0');
}

function asStringList(value, field, filePath) {
	if (value === undefined || value === null) return [];
	const values = Array.isArray(value) ? value : [value];

	return values.map((item) => {
		if (typeof item !== 'string' && typeof item !== 'number') {
			throw new Error(`${filePath}: ${field} contains a non-string value`);
		}
		return String(item).trim();
	}).filter(Boolean);
}

function normalizeTag(tag) {
	const lowered = tag.replace(/[A-Z]/g, (character) => character.toLowerCase());
	return /^[\x00-\x7F]+$/.test(lowered) ? lowered.replace(/\s+/g, '-') : lowered.replace(/\s+/g, ' ');
}

function unique(values) {
	return [...new Set(values)];
}

function countMap(map, key) {
	map.set(key, (map.get(key) ?? 0) + 1);
}

function quote(value) {
	return JSON.stringify(String(value));
}

function serialize(data, eol) {
	const lines = ['---', `title: ${quote(data.title)}`, `date: ${quote(data.date)}`];

	if (data.updated) lines.push(`updated: ${quote(data.updated)}`);
	if (data.description) lines.push(`description: ${quote(data.description)}`);
	if (data.draft !== undefined) lines.push(`draft: ${data.draft}`);

	lines.push('categories:');
	for (const category of data.categories) lines.push(`  - ${quote(category)}`);

	lines.push('tags:');
	for (const tag of data.tags) lines.push(`  - ${quote(tag)}`);

	lines.push('---', '');
	return lines.join(eol);
}

function normalizeDocument(parsed, relativePath) {
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error(`${relativePath}: Frontmatter must be a YAML object`);
	}

	const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
	if (!title) throw new Error(`${relativePath}: title is missing or empty`);

	const dateSource = parsed.date ?? parsed.pubDate;
	if (dateSource === undefined) throw new Error(`${relativePath}: date is missing`);
	if (parsed.date !== undefined && parsed.pubDate !== undefined) {
		const date = normalizeDate(parsed.date, 'date', relativePath);
		const pubDate = normalizeDate(parsed.pubDate, 'pubDate', relativePath);
		if (date !== pubDate) throw new Error(`${relativePath}: date and pubDate conflict`);
	}

	const updatedSource = parsed.updated ?? parsed.updatedDate;
	if (parsed.updated !== undefined && parsed.updatedDate !== undefined) {
		const updated = normalizeDate(parsed.updated, 'updated', relativePath);
		const updatedDate = normalizeDate(parsed.updatedDate, 'updatedDate', relativePath);
		if (updated !== updatedDate) throw new Error(`${relativePath}: updated and updatedDate conflict`);
	}

	if (parsed.draft !== undefined && typeof parsed.draft !== 'boolean') {
		throw new Error(`${relativePath}: draft must be a boolean`);
	}
	const draft = parsed.draft;

	let categories = unique(asStringList(parsed.categories, 'categories', relativePath));
	if (categories.length === 0 && draft !== true) {
		categories = ['未分类'];
		report.missingCategories.push(relativePath);
	}
	if (categories.length > 1) report.multipleCategories.push({ file: relativePath, categories });

	const originalTags = unique(asStringList(parsed.tags, 'tags', relativePath));
	let tags = unique(originalTags.map(normalizeTag));
	if (tags.length === 0 && draft !== true) {
		tags = ['待整理'];
		report.placeholderTags.push(relativePath);
	}
	for (let index = 0; index < originalTags.length; index += 1) {
		const normalized = normalizeTag(originalTags[index]);
		if (originalTags[index] !== normalized) {
			countMap(report.tagRenames, `${originalTags[index]} -> ${normalized}`);
		}
	}

	const allowedFields = new Set([
		'title',
		'date',
		'pubDate',
		'updated',
		'updatedDate',
		'description',
		'draft',
		'categories',
		'tags',
	]);
	for (const field of Object.keys(parsed)) {
		if (!allowedFields.has(field)) countMap(report.droppedFields, field);
	}

	const description =
		typeof parsed.description === 'string' && parsed.description.trim()
			? parsed.description.trim()
			: undefined;
	return {
		title,
		date: normalizeDate(dateSource, 'date', relativePath),
		updated:
			updatedSource === undefined ? undefined : normalizeDate(updatedSource, 'updated', relativePath),
		description,
		draft,
		categories,
		tags,
	};
}

const files = (await walk(contentRoot)).sort((a, b) => a.localeCompare(b, 'zh-CN'));
report.totalFiles = files.length;

for (const filePath of files) {
	const relativePath = path.relative(blogRoot, filePath).replaceAll('\\', '/');

	try {
		const source = await fs.readFile(filePath, 'utf8');
		const frontmatter = findFrontmatter(source, relativePath);
		const document = parseDocument(frontmatter.yaml, {
			prettyErrors: true,
			uniqueKeys: true,
		});

		if (document.errors.length > 0) {
			throw new Error(`${relativePath}: ${document.errors.map((error) => error.message).join('; ')}`);
		}

		const normalized = normalizeDocument(document.toJS(), relativePath);
		const nextSource =
			serialize(normalized, frontmatter.eol) + frontmatter.eol + frontmatter.body;
		const currentBodyHash = hash(frontmatter.body);
		const nextBody = findFrontmatter(nextSource, relativePath).body;

		if (hash(nextBody) !== currentBodyHash) {
			report.bodyHashMismatches.push(relativePath);
			throw new Error(`${relativePath}: body hash changed`);
		}

		if (source.replace(/^\uFEFF/, '') !== nextSource) {
			report.changedFiles.push(relativePath);
			if (write) await fs.writeFile(filePath, nextSource, 'utf8');
		}
	} catch (error) {
		report.errors.push(error instanceof Error ? error.message : String(error));
	}
}

const printable = {
	...report,
	tagRenames: Object.fromEntries([...report.tagRenames].sort()),
	droppedFields: Object.fromEntries([...report.droppedFields].sort()),
};

console.log(JSON.stringify(printable, null, 2));

if (
	report.errors.length > 0 ||
	report.bodyHashMismatches.length > 0 ||
	(check && report.changedFiles.length > 0)
) {
	process.exitCode = 1;
}
