/*
 * Code Block Enhancements
 * Adds copy button and language label to code blocks
 */

export function setupCodeBlocks() {
    const astroBlocks = Array.from(document.querySelectorAll('pre.astro-code')) as HTMLPreElement[];
    const genericBlocks = Array.from(document.querySelectorAll('pre > code'))
        .map((code) => code.parentElement)
        .filter((pre): pre is HTMLPreElement => !!pre && !pre.classList.contains('astro-code'));

    const codeBlocks = Array.from(new Set([...astroBlocks, ...genericBlocks]));
    if (codeBlocks.length === 0) return;

    const BATCH_SIZE = 8;
    const START_DELAY = 400;
    const IDLE_TIMEOUT = 1200;
    let index = 0;

    const enhanceBlock = (pre: HTMLPreElement) => {
        // Avoid double-wrapping
        if (pre.parentElement?.classList.contains('code-block-wrapper')) return;

        // Get language
        let lang = 'code';
        if (pre.classList.contains('astro-code')) {
            const dataLang = pre.getAttribute('data-language');
            if (dataLang) lang = dataLang;
        } else {
            const codeEl = pre.querySelector('code');
            if (codeEl) {
                const langClass = Array.from(codeEl.classList).find((c) => c.startsWith('language-'));
                if (langClass) lang = langClass.replace('language-', '');
            }
        }

        // Get content
        const codeContent = pre.querySelector('code')?.textContent || pre.textContent || '';

        // Calculate lines (simple splitting)
        const lines = codeContent.split('\n');
        if (lines[lines.length - 1] === '') lines.pop(); // Remove last empty line

        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';

        // Create toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'code-toolbar';

        // Language label
        const langLabel = document.createElement('span');
        langLabel.className = 'code-lang';
        langLabel.textContent = lang.toUpperCase();

        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'code-copy-btn';
        copyBtn.title = '复制代码';
        copyBtn.innerHTML = `
            <svg class="icon-copy" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <svg class="icon-check" style="display:none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;

        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(codeContent);
                copyBtn.classList.add('copied');
                const iconCopy = copyBtn.querySelector('.icon-copy') as HTMLElement;
                const iconCheck = copyBtn.querySelector('.icon-check') as HTMLElement;
                if (iconCopy) iconCopy.style.display = 'none';
                if (iconCheck) iconCheck.style.display = 'block';
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    if (iconCopy) iconCopy.style.display = 'block';
                    if (iconCheck) iconCheck.style.display = 'none';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });

        toolbar.appendChild(langLabel);
        toolbar.appendChild(copyBtn);

        // Code body container
        const codeBody = document.createElement('div');
        codeBody.className = 'code-body';

        // Line numbers
        const lineNumbers = document.createElement('div');
        lineNumbers.className = 'line-numbers';
        let lineNumbersHtml = '';
        for (let i = 1; i <= lines.length; i++) {
            lineNumbersHtml += `<span>${i}</span>`;
        }
        lineNumbers.innerHTML = lineNumbersHtml;

        // Assemble
        if (pre.parentNode) {
            pre.parentNode.insertBefore(wrapper, pre);
        }
        codeBody.appendChild(lineNumbers);
        codeBody.appendChild(pre);

        wrapper.appendChild(toolbar);
        wrapper.appendChild(codeBody);
    };

    const processBatch = () => {
        const end = Math.min(index + BATCH_SIZE, codeBlocks.length);
        for (; index < end; index++) {
            enhanceBlock(codeBlocks[index]);
        }
        if (index < codeBlocks.length) {
            scheduleNext();
        } else {
            document.dispatchEvent(new Event('toc:recalc'));
        }
    };

    const scheduleNext = () => {
        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(processBatch, { timeout: IDLE_TIMEOUT });
        } else {
            setTimeout(processBatch, 0);
        }
    };

    setTimeout(scheduleNext, START_DELAY);
}
