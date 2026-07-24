import type { MermaidConfig } from 'mermaid';

type MermaidApi = typeof import('mermaid')['default'];

let cleanupCurrentMermaid: (() => void) | null = null;
let mermaidApiPromise: Promise<MermaidApi> | null = null;
let renderGeneration = 0;
let currentFigures: HTMLElement[] = [];
let restoreNativePrintSize: (() => void) | null = null;

// A4 竖向页面在当前打印边距下的正文可用区域（CSS 像素）。
const PRINT_MAX_WIDTH_PX = (178 / 25.4) * 96;
const PRINT_MAX_HEIGHT_PX = (225 / 25.4) * 96;

function loadMermaid() {
	mermaidApiPromise ??= import('mermaid').then(({ default: mermaid }) => mermaid);
	return mermaidApiPromise;
}

function isDarkTheme() {
	return document.documentElement.dataset.theme === 'dark';
}

function getConfig(forceLight = false): MermaidConfig {
	const dark = !forceLight && isDarkTheme();
	return {
		startOnLoad: false,
		securityLevel: 'strict',
		theme: 'base',
		fontFamily: '"Inter", "Noto Sans SC", system-ui, sans-serif',
		themeVariables: dark
			? {
					background: '#161b22',
					primaryColor: '#25324a',
					primaryTextColor: '#f0f6fc',
					primaryBorderColor: '#7aa2f7',
					lineColor: '#8b949e',
					secondaryColor: '#203b36',
					tertiaryColor: '#352f4f',
					clusterBkg: '#1c2128',
					clusterBorder: '#484f58',
					edgeLabelBackground: '#161b22',
					noteBkgColor: '#332d1d',
					noteTextColor: '#f0f6fc',
					noteBorderColor: '#d29922',
				}
			: {
					background: '#ffffff',
					primaryColor: '#edf4ff',
					primaryTextColor: '#24292f',
					primaryBorderColor: '#4f7fcf',
					lineColor: '#57606a',
					secondaryColor: '#e8f6f1',
					tertiaryColor: '#f4edff',
					clusterBkg: '#f6f8fa',
					clusterBorder: '#d0d7de',
					edgeLabelBackground: '#ffffff',
					noteBkgColor: '#fff8c5',
					noteTextColor: '#24292f',
					noteBorderColor: '#d4a72c',
				},
		flowchart: {
			curve: 'basis',
			htmlLabels: false,
			padding: 16,
		},
		sequence: {
			useMaxWidth: true,
			wrap: true,
			diagramMarginX: 24,
			diagramMarginY: 24,
		},
	};
}

function createDiagram(pre: HTMLPreElement, index: number) {
	const source = pre.querySelector('code')?.textContent ?? pre.textContent ?? '';
	const figure = document.createElement('figure');
	figure.className = 'mermaid-diagram';
	figure.dataset.mermaidSource = source;
	figure.dataset.mermaidIndex = String(index);
	figure.setAttribute('aria-label', 'Mermaid diagram');

	const header = document.createElement('figcaption');
	header.className = 'mermaid-diagram__header';
	header.innerHTML = '<span class="mermaid-diagram__status" aria-live="polite">正在渲染…</span>';

	const canvas = document.createElement('div');
	canvas.className = 'mermaid-diagram__canvas';
	figure.append(header, canvas);
	pre.replaceWith(figure);
	return figure;
}

async function renderFigure(mermaid: MermaidApi, figure: HTMLElement, generation: number) {
	const canvas = figure.querySelector<HTMLElement>('.mermaid-diagram__canvas');
	const status = figure.querySelector<HTMLElement>('.mermaid-diagram__status');
	const source = figure.dataset.mermaidSource ?? '';
	if (!canvas || !status) return;

	try {
		const id = `mermaid-${generation}-${figure.dataset.mermaidIndex}`;
		const { svg, bindFunctions } = await mermaid.render(id, source);
		if (generation !== renderGeneration || !figure.isConnected) return;
		canvas.innerHTML = svg;
		bindFunctions?.(canvas);
		const renderedSvg = canvas.querySelector<SVGSVGElement>('svg');
		const viewBox = renderedSvg
			?.getAttribute('viewBox')
			?.trim()
			.split(/[\s,]+/)
			.map(Number);
		const viewBoxWidth = viewBox?.[2] ?? 0;
		const viewBoxHeight = viewBox?.[3] ?? 0;
		const isPortrait = Boolean(
			viewBoxWidth > 0
			&& viewBoxHeight > viewBoxWidth * 1.05,
		);
		figure.classList.toggle('mermaid-diagram--portrait', isPortrait);
		status.textContent = '';
		figure.classList.remove('mermaid-diagram--error');
	} catch (error) {
		if (generation !== renderGeneration || !figure.isConnected) return;
		figure.classList.add('mermaid-diagram--error');
		figure.classList.remove('mermaid-diagram--portrait');
		status.textContent = '图表语法有误';
		canvas.replaceChildren();
		const message = document.createElement('pre');
		message.className = 'mermaid-diagram__error';
		message.textContent = error instanceof Error ? error.message : String(error);
		canvas.append(message);
	}
}

async function renderAll(figures: HTMLElement[], generation: number, forceLight = false) {
	const mermaid = await loadMermaid();
	if (generation !== renderGeneration) return;
	mermaid.initialize(getConfig(forceLight));
	for (const figure of figures) {
		await renderFigure(mermaid, figure, generation);
	}
}

function applyMermaidPrintSizes(figures: HTMLElement[]) {
	for (const figure of figures) {
		const svg = figure.querySelector<SVGSVGElement>('.mermaid-diagram__canvas svg');
		if (!svg) continue;

		const { width, height } = svg.getBoundingClientRect();
		if (width <= 0 || height <= 0) continue;

		const proseWidth = figure.closest<HTMLElement>('.prose')?.getBoundingClientRect().width ?? width;
		const relativeWidth = Math.min(1, width / proseWidth);
		const targetWidth = PRINT_MAX_WIDTH_PX * relativeWidth;
		const targetHeight = targetWidth * (height / width);
		const scale = Math.min(
			1,
			PRINT_MAX_HEIGHT_PX / targetHeight,
		);
		figure.style.setProperty('--mermaid-print-width', `${Math.round(targetWidth * scale)}px`);
		figure.classList.add('mermaid-diagram--print-sized');
	}
}

function preserveMermaidSizeForPrint(figures: HTMLElement[]) {
	const snapshots = figures.map((figure) => ({
		figure,
		width: figure.style.getPropertyValue('--mermaid-print-width'),
		widthPriority: figure.style.getPropertyPriority('--mermaid-print-width'),
		wasPrepared: figure.classList.contains('mermaid-diagram--print-sized'),
	}));

	applyMermaidPrintSizes(figures);

	return () => {
		for (const snapshot of snapshots) {
			if (snapshot.width) {
				snapshot.figure.style.setProperty(
					'--mermaid-print-width',
					snapshot.width,
					snapshot.widthPriority,
				);
			} else {
				snapshot.figure.style.removeProperty('--mermaid-print-width');
			}
			snapshot.figure.classList.toggle('mermaid-diagram--print-sized', snapshot.wasPrepared);
		}
	};
}

window.addEventListener('beforeprint', () => {
	restoreNativePrintSize?.();
	restoreNativePrintSize = preserveMermaidSizeForPrint(currentFigures);
});

window.addEventListener('afterprint', () => {
	restoreNativePrintSize?.();
	restoreNativePrintSize = null;
});

export async function prepareMermaidForPrint() {
	if (currentFigures.length === 0) return async () => {};

	const restorePrintSize = preserveMermaidSizeForPrint(currentFigures);
	if (!isDarkTheme()) return async () => restorePrintSize();

	const printGeneration = ++renderGeneration;
	await renderAll(currentFigures, printGeneration, true);

	return async () => {
		restorePrintSize();
		const restoreGeneration = ++renderGeneration;
		await renderAll(currentFigures, restoreGeneration);
	};
}

export async function setupMermaid() {
	cleanupCurrentMermaid?.();
	cleanupCurrentMermaid = null;
	currentFigures = [];

	const article = document.querySelector<HTMLElement>('article .prose');
	if (!article) return;

	const dataLanguageBlocks = Array.from(
		article.querySelectorAll<HTMLPreElement>('pre[data-language="mermaid"]'),
	);
	const classLanguageBlocks = Array.from(
		article.querySelectorAll<HTMLElement>('pre > code.language-mermaid'),
	)
		.map((code) => code.parentElement)
		.filter((pre): pre is HTMLPreElement => pre instanceof HTMLPreElement);
	const blocks = Array.from(new Set([...dataLanguageBlocks, ...classLanguageBlocks]));
	const figures = blocks.map(createDiagram);
	if (figures.length === 0) return;
	currentFigures = figures;

	let generation = ++renderGeneration;
	await renderAll(figures, generation);
	applyMermaidPrintSizes(figures);

	const observer = new MutationObserver(() => {
		generation = ++renderGeneration;
		void renderAll(figures, generation).then(() => applyMermaidPrintSizes(figures));
	});
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['data-theme'],
	});

	const lifecycleController = new AbortController();
	window.addEventListener('resize', () => applyMermaidPrintSizes(figures), {
		signal: lifecycleController.signal,
	});
	const cleanup = () => {
		observer.disconnect();
		lifecycleController.abort();
		renderGeneration += 1;
		currentFigures = [];
		if (cleanupCurrentMermaid === cleanup) cleanupCurrentMermaid = null;
	};
	document.addEventListener('astro:before-swap', cleanup, {
		once: true,
		signal: lifecycleController.signal,
	});
	cleanupCurrentMermaid = cleanup;
}
