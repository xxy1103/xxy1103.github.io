/*
 * Code block structure is created synchronously so article geometry is stable
 * before anchor navigation starts. Copy interaction is handled by delegation.
 */

let cleanupCurrentCodeBlocks: (() => void) | null = null;

function getLanguage(pre: HTMLPreElement) {
	if (pre.classList.contains('astro-code')) return pre.getAttribute('data-language') || 'code';
	const languageClass = Array.from(pre.querySelector('code')?.classList ?? [])
		.find((className) => className.startsWith('language-'));
	return languageClass?.replace('language-', '') || 'code';
}

function enhanceBlock(pre: HTMLPreElement) {
	if (pre.dataset.codeBlockEnhanced === 'true' || pre.closest('.code-block-wrapper')) return;
	if (getLanguage(pre).toLowerCase() === 'mermaid') return;
	const codeContent = pre.querySelector('code')?.textContent || pre.textContent || '';
	const lines = codeContent.replace(/\n$/, '').split('\n');

	const wrapper = document.createElement('div');
	wrapper.className = 'code-block-wrapper';
	const toolbar = document.createElement('div');
	toolbar.className = 'code-toolbar';
	const language = document.createElement('span');
	language.className = 'code-lang';
	language.textContent = getLanguage(pre).toUpperCase();
	const copyButton = document.createElement('button');
	copyButton.type = 'button';
	copyButton.className = 'code-copy-btn';
	copyButton.title = '复制代码';
	copyButton.setAttribute('aria-label', '复制代码');
	copyButton.innerHTML = `
		<svg class="icon-copy" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
			<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
		</svg>
		<svg class="icon-check" style="display:none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<polyline points="20 6 9 17 4 12"></polyline>
		</svg>`;
	toolbar.append(language, copyButton);

	const codeBody = document.createElement('div');
	codeBody.className = 'code-body';
	const lineNumbers = document.createElement('div');
	lineNumbers.className = 'line-numbers';
	lineNumbers.setAttribute('aria-hidden', 'true');
	const lineFragment = document.createDocumentFragment();
	for (let line = 1; line <= lines.length; line += 1) {
		const number = document.createElement('span');
		number.textContent = String(line);
		lineFragment.append(number);
	}
	lineNumbers.append(lineFragment);

	pre.parentNode?.insertBefore(wrapper, pre);
	codeBody.append(lineNumbers, pre);
	wrapper.append(toolbar, codeBody);
	pre.dataset.codeBlockEnhanced = 'true';
}

export function setupCodeBlocks() {
	cleanupCurrentCodeBlocks?.();
	cleanupCurrentCodeBlocks = null;

	const article = document.querySelector<HTMLElement>('article .prose');
	if (!article) return;
	const astroBlocks = Array.from(article.querySelectorAll<HTMLPreElement>('pre.astro-code'));
	const genericBlocks = Array.from(article.querySelectorAll<HTMLElement>('pre > code'))
		.map((code) => code.parentElement)
		.filter((pre): pre is HTMLPreElement => pre instanceof HTMLPreElement && !pre.classList.contains('astro-code'));
	for (const block of new Set([...astroBlocks, ...genericBlocks])) enhanceBlock(block);

	const resetTimers = new Map<HTMLButtonElement, number>();
	const lifecycleController = new AbortController();
	const onClick = async (event: Event) => {
		const button = (event.target as Element).closest<HTMLButtonElement>('.code-copy-btn');
		if (!button || !article.contains(button)) return;
		const code = button.closest('.code-block-wrapper')?.querySelector('pre code');
		if (!code) return;
		try {
			await navigator.clipboard.writeText(code.textContent ?? '');
			button.classList.add('copied');
			const copyIcon = button.querySelector<HTMLElement>('.icon-copy');
			const checkIcon = button.querySelector<HTMLElement>('.icon-check');
			if (copyIcon) copyIcon.style.display = 'none';
			if (checkIcon) checkIcon.style.display = 'block';
			const previousTimer = resetTimers.get(button);
			if (previousTimer !== undefined) window.clearTimeout(previousTimer);
			const timer = window.setTimeout(() => {
				resetTimers.delete(button);
				button.classList.remove('copied');
				if (copyIcon) copyIcon.style.display = 'block';
				if (checkIcon) checkIcon.style.display = 'none';
			}, 2000);
			resetTimers.set(button, timer);
		} catch (error) {
			console.error('Failed to copy:', error);
		}
	};
	article.addEventListener('click', onClick);

	let cleanedUp = false;
	const cleanup = () => {
		if (cleanedUp) return;
		cleanedUp = true;
		article.removeEventListener('click', onClick);
		lifecycleController.abort();
		for (const timer of resetTimers.values()) window.clearTimeout(timer);
		resetTimers.clear();
		if (cleanupCurrentCodeBlocks === cleanup) cleanupCurrentCodeBlocks = null;
	};
	document.addEventListener('astro:before-swap', cleanup, { once: true, signal: lifecycleController.signal });
	cleanupCurrentCodeBlocks = cleanup;
}
