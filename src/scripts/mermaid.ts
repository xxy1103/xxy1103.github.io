import type { MermaidConfig } from 'mermaid';

type MermaidApi = typeof import('mermaid')['default'];

let cleanupCurrentMermaid: (() => void) | null = null;
let mermaidApiPromise: Promise<MermaidApi> | null = null;
let renderGeneration = 0;

function loadMermaid() {
	mermaidApiPromise ??= import('mermaid').then(({ default: mermaid }) => mermaid);
	return mermaidApiPromise;
}

function isDarkTheme() {
	return document.documentElement.dataset.theme === 'dark';
}

function getConfig(): MermaidConfig {
	const dark = isDarkTheme();
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
	header.innerHTML = `
		<span class="mermaid-diagram__label">
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5 9 3l3 3 3-3 5 2.5v5L12 21 4 10.5v-5Z"/></svg>
			Mermaid
		</span>
		<span class="mermaid-diagram__status" aria-live="polite">正在渲染…</span>`;

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
		status.textContent = '';
		figure.classList.remove('mermaid-diagram--error');
	} catch (error) {
		if (generation !== renderGeneration || !figure.isConnected) return;
		figure.classList.add('mermaid-diagram--error');
		status.textContent = '图表语法有误';
		canvas.replaceChildren();
		const message = document.createElement('pre');
		message.className = 'mermaid-diagram__error';
		message.textContent = error instanceof Error ? error.message : String(error);
		canvas.append(message);
	}
}

async function renderAll(figures: HTMLElement[], generation: number) {
	const mermaid = await loadMermaid();
	if (generation !== renderGeneration) return;
	mermaid.initialize(getConfig());
	for (const figure of figures) {
		await renderFigure(mermaid, figure, generation);
	}
}

export async function setupMermaid() {
	cleanupCurrentMermaid?.();
	cleanupCurrentMermaid = null;

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

	let generation = ++renderGeneration;
	await renderAll(figures, generation);

	const observer = new MutationObserver(() => {
		generation = ++renderGeneration;
		void renderAll(figures, generation);
	});
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['data-theme'],
	});

	const lifecycleController = new AbortController();
	const cleanup = () => {
		observer.disconnect();
		lifecycleController.abort();
		renderGeneration += 1;
		if (cleanupCurrentMermaid === cleanup) cleanupCurrentMermaid = null;
	};
	document.addEventListener('astro:before-swap', cleanup, {
		once: true,
		signal: lifecycleController.signal,
	});
	cleanupCurrentMermaid = cleanup;
}
