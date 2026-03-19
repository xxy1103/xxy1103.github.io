/*
 * Table of Contents Logic
 * Handles smooth scrolling and active state highlighting
 */

export function setupToc() {
    const tocRoot = document.getElementById('toc-root');
    if (!tocRoot) return;

    const articleRoot =
        (document.querySelector('article .prose') as HTMLElement | null) ||
        (document.querySelector('article') as HTMLElement | null) ||
        document.body;
    const tocLinks = Array.from(document.querySelectorAll('.toc-link')) as HTMLAnchorElement[];
    const headings = Array.from(
        articleRoot.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')
    ) as HTMLElement[];
    const mainContent = document.getElementById('main-content') as HTMLElement | null;
    const tocContainer = document.getElementById('toc') as HTMLElement | null;
    if (tocLinks.length === 0 || headings.length === 0) return;

    const linkById = new Map<string, HTMLAnchorElement>();
    tocLinks.forEach((link) => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
            linkById.set(decodeURIComponent(href.slice(1)), link);
        }
    });

    const resolvedTocIdByHeadingId = new Map<string, string>();
    const headingStack: HTMLElement[] = [];
    headings.forEach((heading) => {
        const currentDepth = Number.parseInt(heading.tagName.slice(1), 10);
        while (headingStack.length > 0) {
            const lastHeading = headingStack[headingStack.length - 1];
            const lastDepth = Number.parseInt(lastHeading.tagName.slice(1), 10);
            if (lastDepth < currentDepth) break;
            headingStack.pop();
        }

        headingStack.push(heading);

        for (let i = headingStack.length - 1; i >= 0; i -= 1) {
            const candidateId = headingStack[i].id;
            if (linkById.has(candidateId)) {
                resolvedTocIdByHeadingId.set(heading.id, candidateId);
                break;
            }
        }
    });

    let lastActiveId = '';
    let lastActiveLink: HTMLAnchorElement | null = null;
    let expandedItems = new Set<HTMLElement>();
    let recalcScheduled = false;
    let recalcTimer: number | null = null;
    const INITIAL_RECALC_DELAY = 350;
    const DEFAULT_HEADER_HEIGHT = 64;
    const TOC_SCROLL_EXTRA_OFFSET = 16;
    const ACTIVE_VIEWPORT_RATIO = 0.36;
    const MAX_ACTIVE_OFFSET = 360;
    let isUserScrolling = false; // 追踪用户是否在进行主动滚动
    let scrollCheckTimer: number | null = null; // 用于检测滚动完成的定时器
    let lastScrollTop = 0; // 上一次的滚动位置

    const getScrollTop = () => {
        if (mainContent) return mainContent.scrollTop;
        return window.scrollY || document.documentElement.scrollTop || 0;
    };

    const isAtScrollEnd = () => {
        if (mainContent) {
            return mainContent.scrollHeight - mainContent.clientHeight - mainContent.scrollTop <= 1;
        }

        const scrollElement = document.documentElement;
        return scrollElement.scrollHeight - window.innerHeight - getScrollTop() <= 1;
    };

    const getContainerTop = () => {
        if (mainContent) return mainContent.getBoundingClientRect().top;
        return 0;
    };

    const getViewportHeight = () => {
        if (mainContent) return mainContent.clientHeight;
        return window.innerHeight || document.documentElement.clientHeight || 0;
    };

    const getHeaderHeight = () => {
        const header = document.querySelector('header');
        if (header instanceof HTMLElement) {
            return header.getBoundingClientRect().height;
        }
        return DEFAULT_HEADER_HEIGHT;
    };

    const getBaseHeadingOffset = () => {
        return Math.max(getHeaderHeight() + TOC_SCROLL_EXTRA_OFFSET - getContainerTop(), 0);
    };

    const getActiveHeadingOffset = () => {
        const baseOffset = getBaseHeadingOffset();
        const viewportOffset = Math.min(
            Math.round(getViewportHeight() * ACTIVE_VIEWPORT_RATIO),
            MAX_ACTIVE_OFFSET
        );

        return Math.max(baseOffset, viewportOffset);
    };

    function scheduleRecalc(delay = 120) {
        if (recalcTimer) {
            window.clearTimeout(recalcTimer);
        }
        recalcTimer = window.setTimeout(() => {
            recalcTimer = null;
            if (recalcScheduled) return;
            recalcScheduled = true;
            requestAnimationFrame(() => {
                recalcScheduled = false;
                updateActiveHeading();
            });
        }, delay);
    }

    function setActiveHeading(currentSlug: string) {
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

    function updateActiveHeading() {
        if (headings.length === 0) return;

        const containerTop = getContainerTop();
        const activationOffset = getActiveHeadingOffset();
        let currentSlug = '';

        for (const heading of headings) {
            const headingTop = heading.getBoundingClientRect().top - containerTop;
            if (headingTop <= activationOffset) {
                currentSlug = heading.id;
                continue;
            }
            break;
        }

        if (isAtScrollEnd()) {
            currentSlug = headings[headings.length - 1]?.id || currentSlug;
        }

        setActiveHeading(resolvedTocIdByHeadingId.get(currentSlug) || currentSlug);
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
        const targetId = decodeURIComponent(href.slice(1));
        const target = document.getElementById(targetId);
        if (!target) return;

        const containerTop = getContainerTop();
        const targetRect = target.getBoundingClientRect();
        const offsetPosition = Math.max(
            targetRect.top - containerTop + getScrollTop() - getBaseHeadingOffset(),
            0
        );

        // 标记正在滚动，防止 scroll 事件处理器在滚动期间频繁更新活跃状态
        isUserScrolling = true;
        lastScrollTop = getScrollTop();
        setActiveHeading(resolvedTocIdByHeadingId.get(targetId) || targetId);

        // 清除之前的检查定时器
        if (scrollCheckTimer) {
            window.clearTimeout(scrollCheckTimer);
        }

        if (mainContent) {
            mainContent.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        } else {
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }

        // 设置滚动完成检测：当 100ms 内位置没有变化时，认为滚动完成
        const checkScroll = () => {
            const currentScrollTop = getScrollTop();
            if (Math.abs(currentScrollTop - lastScrollTop) < 1) {
                // 滚动已稳定，解除标记并更新活跃状态
                isUserScrolling = false;
                updateActiveHeading();
                scrollCheckTimer = null;
            } else {
                // 滚动还在继续，继续检查
                lastScrollTop = currentScrollTop;
                scrollCheckTimer = window.setTimeout(checkScroll, 100);
            }
        };

        // 最少等待 200ms 再开始检查（确保平滑滚动已经开始）
        scrollCheckTimer = window.setTimeout(checkScroll, 200);

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
        // 在用户点击 TOC 进行滚动期间，跳过处理以避免多重滚动冲突
        if (isUserScrolling) {
            return;
        }

        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
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

    if (windowAny.__tocArticleResizeObserver) {
        windowAny.__tocArticleResizeObserver.disconnect();
    }
    if ('ResizeObserver' in window) {
        windowAny.__tocArticleResizeObserver = new ResizeObserver(() => scheduleRecalc(0));
        windowAny.__tocArticleResizeObserver.observe(articleRoot);
    }

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
