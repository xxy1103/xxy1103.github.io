/*
 * Table of Contents Logic
 * Handles smooth scrolling and active state highlighting
 */

export function setupToc() {
    const tocRoot = document.getElementById('toc-root');
    if (!tocRoot) return;

    const tocLinks = Array.from(document.querySelectorAll('.toc-link')) as HTMLAnchorElement[];
    const headings = Array.from(
        document.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')
    ) as HTMLElement[];
    const mainContent = document.getElementById('main-content') as HTMLElement | null;
    const tocContainer = document.getElementById('toc') as HTMLElement | null;
    if (tocLinks.length === 0 || headings.length === 0) return;

    const linkById = new Map<string, HTMLAnchorElement>();
    tocLinks.forEach((link) => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
            linkById.set(href.slice(1), link);
        }
    });

    type HeadingPos = { id: string; top: number };
    let headingPositions: HeadingPos[] = [];
    let positionsReady = false;
    let lastActiveId = '';
    let lastActiveLink: HTMLAnchorElement | null = null;
    let expandedItems = new Set<HTMLElement>();
    let recalcScheduled = false;
    let recalcTimer: number | null = null;
    const RECALC_IDLE_TIMEOUT = 800;
    const INITIAL_RECALC_DELAY = 350;

    const getScrollTop = () => {
        if (mainContent) return mainContent.scrollTop;
        return window.scrollY || document.documentElement.scrollTop || 0;
    };

    function computeHeadingPositions() {
        const scrollTop = getScrollTop();
        const containerTop = mainContent ? mainContent.getBoundingClientRect().top : 0;
        headingPositions = headings.map((h) => {
            const rect = h.getBoundingClientRect();
            return {
                id: h.id,
                top: rect.top - containerTop + scrollTop
            };
        });
        positionsReady = true;
    }

    function scheduleRecalc(delay = 120) {
        if (recalcTimer) {
            window.clearTimeout(recalcTimer);
        }
        recalcTimer = window.setTimeout(() => {
            recalcTimer = null;
            if (recalcScheduled) return;
            recalcScheduled = true;
            const run = () => {
                recalcScheduled = false;
                computeHeadingPositions();
                updateActiveHeading();
            };
            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(run, { timeout: RECALC_IDLE_TIMEOUT });
            } else {
                requestAnimationFrame(run);
            }
        }, delay);
    }

    function findActiveId(targetOffset: number) {
        let lo = 0;
        let hi = headingPositions.length - 1;
        let res = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (headingPositions[mid].top <= targetOffset) {
                res = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return res >= 0 ? headingPositions[res].id : '';
    }

    function updateActiveHeading() {
        if (!positionsReady || headingPositions.length === 0) return;

        const offset = 120;
        const targetOffset = getScrollTop() + offset;
        const currentSlug = findActiveId(targetOffset);

        if (currentSlug === lastActiveId) return;
        lastActiveId = currentSlug;

        if (lastActiveLink) {
            lastActiveLink.classList.remove('active');
            lastActiveLink = null;
        }

        if (!currentSlug) {
            expandedItems.forEach((item) => item.classList.remove('expanded'));
            expandedItems.clear();
            return;
        }

        const activeLink = linkById.get(currentSlug) || null;
        if (!activeLink) return;

        activeLink.classList.add('active');
        lastActiveLink = activeLink;

        const newExpanded = new Set<HTMLElement>();
        let parent = activeLink.closest('.toc-item') as HTMLElement | null;
        while (parent) {
            newExpanded.add(parent);
            const parentList = parent.parentElement;
            if (parentList && parentList.classList.contains('toc-children')) {
                parent = parentList.closest('.toc-item');
            } else {
                break;
            }
        }

        expandedItems.forEach((item) => {
            if (!newExpanded.has(item)) item.classList.remove('expanded');
        });
        newExpanded.forEach((item) => {
            if (!expandedItems.has(item)) item.classList.add('expanded');
        });
        expandedItems = newExpanded;

        if (tocContainer) {
            const containerRect = tocContainer.getBoundingClientRect();
            const linkRect = activeLink.getBoundingClientRect();
            const padding = 8;
            if (linkRect.top < containerRect.top + padding || linkRect.bottom > containerRect.bottom - padding) {
                activeLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }

    // 1. Smooth Scrolling
    const tocRootAny = tocRoot as any;
    if (tocRootAny.__tocClickHandler) {
        tocRoot.removeEventListener('click', tocRootAny.__tocClickHandler);
    }
    tocRootAny.__tocClickHandler = (e: Event) => {
        const link = (e.target as Element).closest('.toc-link');
        if (!link) return;
        e.preventDefault();
        const href = link.getAttribute('href');
        if (!href) return;
        const target = document.querySelector(href);
        if (!target) return;

        const headerOffset = 80;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + (mainContent?.scrollTop || 0) - headerOffset;

        mainContent?.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });

        history.pushState(null, '', href);
    };
    tocRoot.addEventListener('click', tocRootAny.__tocClickHandler);

    // Initial compute + check (defer to avoid blocking entrance animation)
    scheduleRecalc(INITIAL_RECALC_DELAY);

    // Recalc triggers
    const scrollTarget = mainContent || window;
    const scrollTargetAny = scrollTarget as any;
    if (scrollTargetAny.__tocScrollHandler) {
        scrollTarget.removeEventListener('scroll', scrollTargetAny.__tocScrollHandler);
    }
    let ticking = false;
    scrollTargetAny.__tocScrollHandler = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            if (!positionsReady) {
                scheduleRecalc(0);
                ticking = false;
                return;
            }
            updateActiveHeading();
            ticking = false;
        });
    };
    scrollTarget.addEventListener('scroll', scrollTargetAny.__tocScrollHandler, { passive: true });

    const windowAny = window as any;
    if (windowAny.__tocResizeHandler) {
        window.removeEventListener('resize', windowAny.__tocResizeHandler);
    }
    windowAny.__tocResizeHandler = () => scheduleRecalc();
    window.addEventListener('resize', windowAny.__tocResizeHandler);

    if ('fonts' in document) {
        document.fonts.ready.then(() => scheduleRecalc()).catch(() => {});
    }

    if (mainContent) {
        const mainContentAny = mainContent as any;
        if (mainContentAny.__tocLoadHandler) {
            mainContent.removeEventListener('load', mainContentAny.__tocLoadHandler, true);
        }
        mainContentAny.__tocLoadHandler = () => scheduleRecalc();
        mainContent.addEventListener('load', mainContentAny.__tocLoadHandler, true);
    }

    const docAny = document as any;
    if (docAny.__tocRecalcHandler) {
        document.removeEventListener('toc:recalc', docAny.__tocRecalcHandler);
    }
    docAny.__tocRecalcHandler = () => scheduleRecalc();
    document.addEventListener('toc:recalc', docAny.__tocRecalcHandler);
}
