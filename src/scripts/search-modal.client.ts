import Fuse from 'fuse.js';

    interface SearchItem {
        id: string;
        title: string;
        excerpt: string;
        tags: string[];
        categories: string;
        url: string;
    }

    let fuse: Fuse<SearchItem> | null = null;
    let searchIndex: SearchItem[] = [];
    let focusedIndex = -1;
    const exitDurationMs = 320;
    let closeTimer: number | null = null;
    let searchInitialized = false;
    let openSearchFromOutside: (() => Promise<void>) | null = null;

    // Initialize search on page load
    function setupSearchModal() {
        if (searchInitialized) return;
        const modal = document.getElementById('search-modal');
        const input = document.getElementById('search-input') as HTMLInputElement;
        const results = document.getElementById('search-results');
        const closeBtn = document.getElementById('search-close');
        const searchBtn = document.getElementById('search-btn');
        const overlay = document.querySelector('.search-overlay');

        if (!modal || !input || !results) return;
        searchInitialized = true;

        // Open search
        const openSearch = async () => {
            if (closeTimer !== null) {
                window.clearTimeout(closeTimer);
                closeTimer = null;
            }
            modal.classList.remove('closing');
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            
            // Prevent layout shift by preserving scrollbar space
            // Prevent layout shift by preserving scrollbar space
            // With new layout (fixed header, scrollbar in container), we don't need body padding hacks.
            // But we might want to check the scroll container width? No, header is fixed 100vw.
            
            // Just ensure input focus
            input.focus();
            
            // Load search index on first open
            if (searchIndex.length === 0) {
                try {
                    const res = await fetch('/search-index.json');
                    searchIndex = await res.json();
                    fuse = new Fuse(searchIndex, {
                        keys: [
                            { name: 'title', weight: 2 },
                            { name: 'excerpt', weight: 1 },
                            { name: 'tags', weight: 1.5 },
                            { name: 'categories', weight: 1 }
                        ],
                        threshold: 0.3,
                        includeMatches: true,
                        minMatchCharLength: 2,
                        ignoreLocation: true // Find matches anywhere
                    });
                } catch (e) {
                    console.error('Failed to load search index:', e);
                }
            }
        };
        openSearchFromOutside = openSearch;

        // Close search
        const closeSearch = () => {
            if (!modal.classList.contains('active')) return;
            modal.classList.add('closing');
            modal.setAttribute('aria-hidden', 'true');
            // document.body.style.overflow = ''; // body is always overflow hidden now
            // document.body.style.marginRight = '';
            
            // Reset header padding
            // const header = document.querySelector('header');
            // if (header) {
            //     header.style.paddingRight = '';
            // }
            
            if (closeTimer !== null) {
                window.clearTimeout(closeTimer);
            }
            closeTimer = window.setTimeout(() => {
                modal.classList.remove('active');
                modal.classList.remove('closing');
                input.value = '';
                focusedIndex = -1;
                renderPlaceholder();
                closeTimer = null;
            }, exitDurationMs);
        };

        // Render placeholder
        const renderPlaceholder = () => {
            results.innerHTML = `
                <div class="search-placeholder">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <p>输入关键词开始搜索</p>
                </div>
            `;
        };

        // Render no results
        const renderNoResults = () => {
            results.innerHTML = `
                <div class="search-no-results">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                        <path d="M8 8l6 6"></path>
                        <path d="M14 8l-6 6"></path>
                    </svg>
                    <p>未找到相关文章</p>
                </div>
            `;
        };
        
        // Helper to highlight text based on Fuse matches
        const highlightText = (text: string, matches: readonly Fuse.FuseResultMatch[] = []) => {
            if (!matches || matches.length === 0) return text;
            
            // Merge overlapping indices
            const indices: [number, number][] = [];
            
            // Flatten all matches for this key
            const crudeIndices = matches.flatMap(m => m.indices);
            
            // Sort by start index
            crudeIndices.sort((a, b) => a[0] - b[0]);
            
            let current: [number, number] | null = null;
            for (const [start, end] of crudeIndices) {
                if (!current) {
                    current = [start, end];
                } else if (start <= current[1] + 1) {
                    // Overlap or adjacent
                    current[1] = Math.max(current[1], end);
                } else {
                    indices.push(current);
                    current = [start, end];
                }
            }
            if (current) indices.push(current);
            
            // Build highlighted string
            let result = '';
            let lastIndex = 0;
            
            for (const [start, end] of indices) {
                result += text.substring(lastIndex, start);
                result += `<span class="search-highlight">${text.substring(start, end + 1)}</span>`;
                lastIndex = end + 1;
            }
            result += text.substring(lastIndex);
            return result;
        };

        // Render search results
        const renderResults = (items: Fuse.FuseResult<SearchItem>[]) => {
            if (items.length === 0) {
                renderNoResults();
                return;
            }

            results.innerHTML = items.slice(0, 20).map((result, index) => {
                const item = result.item;
                
                // Process Title Highlighting
                const titleMatches = result.matches?.filter(m => m.key === 'title') || [];
                const highlightedTitle = highlightText(item.title, titleMatches);
                
                // Process Excerpt Highlighting
                let excerptDisplay = item.excerpt;
                const excerptMatches = result.matches?.filter(m => m.key === 'excerpt') || [];
                
                if (excerptMatches.length > 0) {
                    // Find the best window to show context
                    const firstMatch = excerptMatches[0].indices[0][0];
                    const start = Math.max(0, firstMatch - 60);
                    const end = Math.min(item.excerpt.length, start + 200);
                    excerptDisplay = (start > 0 ? '...' : '') + item.excerpt.substring(start, end).trim() + (end < item.excerpt.length ? '...' : '');
                    
                    // Re-calculate highlighting for the windowed excerpt
                    // Note: This is a simplified approach. Ideally we'd map indices back, but re-matching locally is easier for snippets
                    // Since fuse matches against the whole string, we use highlightText which expects raw indices.
                    // Instead, we just highlight the whole text first then slice, but text is potentially long.
                    // Better approach for visualization: Highlight the WHOLE string, then crop around the first highlight.
                    const fullHighlighted = highlightText(item.excerpt, excerptMatches);
                    
                    // Locate first highlight in the modified HTML string is hard. 
                    // Let's stick to highlighting the snippet we cropped, but we need to adjust indices or just regex match the query words (less accurate)
                    // Or keep it simple: Highlight full text then substring? HTML tags make substring hard.
                    
                    // Robust approach: 
                    // 1. Get highlight indices. 
                    // 2. Determine window. 
                    // 3. Generate HTML only for that window.
                    
                    let windowedResult = '';
                    let lastIdx = start;
                    
                    // Filter indices relevant to our window
                    const relevantIndices = excerptMatches
                        .flatMap(m => m.indices)
                        .filter(([s, e]) => e >= start && s < end)
                        .sort((a, b) => a[0] - b[0]);
                        
                    for (const [s, e] of relevantIndices) {
                         const matchStart = Math.max(s, start);
                         const matchEnd = Math.min(e, end - 1); // e is inclusive
                         
                         windowedResult += item.excerpt.substring(lastIdx, matchStart);
                         windowedResult += `<span class="search-highlight">${item.excerpt.substring(matchStart, matchEnd + 1)}</span>`;
                         lastIdx = matchEnd + 1;
                    }
                    windowedResult += item.excerpt.substring(lastIdx, end);
                    excerptDisplay = (start > 0 ? '...' : '') + windowedResult + (end < item.excerpt.length ? '...' : '');
                }

                // Construct fragment URL for scrolling
                // Chrome supports #:~:text=[prefix-,]textStart[,textEnd][,-suffix]
                // We'll just use the first matching word if available for simple highlighting
                let fragment = '';
                if (excerptMatches.length > 0) {
                    const matchStart = excerptMatches[0].indices[0][0];
                    const matchEnd = excerptMatches[0].indices[0][1];
                    const matchText = item.excerpt.substring(matchStart, matchEnd + 1);
                    // Simple URL encoding for the match
                    fragment = `#:~:text=${encodeURIComponent(matchText)}`;
                }

                return `
                    <a href="${item.url}${fragment}" class="search-result-item ${index === focusedIndex ? 'focused' : ''}" data-index="${index}">
                        <div class="search-result-title">${highlightedTitle}</div>
                        <div class="search-result-excerpt">${excerptDisplay}</div>
                    </a>
                `;
            }).join('');
        };

        // Search input handler
        let searchTimeout: NodeJS.Timeout;
        input.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = input.value.trim();
                focusedIndex = -1;
                
                if (!query) {
                    renderPlaceholder();
                    return;
                }

                if (fuse) {
                    const searchResults = fuse.search(query);
                    renderResults(searchResults);
                }
            }, 100);
        });

        // Keyboard navigation
        input.addEventListener('keydown', (e) => {
            const items = results.querySelectorAll('.search-result-item');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                focusedIndex = Math.min(focusedIndex + 1, items.length - 1);
                updateFocus(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                focusedIndex = Math.max(focusedIndex - 1, 0);
                updateFocus(items);
            } else if (e.key === 'Enter' && focusedIndex >= 0) {
                e.preventDefault();
                const focusedItem = items[focusedIndex] as HTMLAnchorElement;
                if (focusedItem) {
                    window.location.href = focusedItem.href;
                }
            } else if (e.key === 'Escape') {
                closeSearch();
            }
        });

        const updateFocus = (items: NodeListOf<Element>) => {
            items.forEach((item, i) => {
                item.classList.toggle('focused', i === focusedIndex);
            });
            if (focusedIndex >= 0 && items[focusedIndex]) {
                items[focusedIndex].scrollIntoView({ block: 'nearest' });
            }
        };

        // Event listeners
        searchBtn?.addEventListener('click', openSearch);
        closeBtn?.addEventListener('click', closeSearch);
        overlay?.addEventListener('click', closeSearch);

        // Global keyboard shortcut: Ctrl/Cmd + K
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                if (modal.classList.contains('active')) {
                    closeSearch();
                } else {
                    openSearch();
                }
            }
        });
    }

    export function initSearchModal() {
        setupSearchModal();
    }

    export function openSearchModal() {
        setupSearchModal();
        if (openSearchFromOutside) {
            void openSearchFromOutside();
        }
    }

    document.addEventListener('astro:page-load', setupSearchModal);
    setupSearchModal();
