// ====== Material Design 3 Emphasized Easing ======
    // Asymmetric motion: leading edge is faster, trailing edge follows with overshoot

    // MD3 Emphasized Decelerate: used for the leading edge (arrives first)
    function easeEmphasizedDecel(t: number): number {
        // cubic-bezier(0.05, 0.7, 0.1, 1.0)
        return cubicBezier(0.05, 0.7, 0.1, 1.0, t);
    }

    // MD3 Emphasized Accelerate: used for the trailing edge (departs with momentum)
    function easeEmphasizedAccel(t: number): number {
        // cubic-bezier(0.3, 0.0, 0.8, 0.15)
        return cubicBezier(0.3, 0.0, 0.8, 0.15, t);
    }

    // Spring-like settle for final dot formation
    function easeSpringSettle(t: number): number {
        // Attempt an underdamped spring feel
        const decay = Math.exp(-6 * t);
        return 1 - decay * Math.cos(4 * Math.PI * t);
    }

    // Attempt solving cubic-bezier (De Casteljau / Newton's method approximation)
    function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number, t: number): number {
        // Using Newton's method to find parameter for given t on x-axis
        let guessT = t;
        for (let i = 0; i < 8; i++) {
            const x = sampleCurve(p1x, p2x, guessT) - t;
            if (Math.abs(x) < 1e-6) break;
            const dx = sampleCurveDerivative(p1x, p2x, guessT);
            if (Math.abs(dx) < 1e-6) break;
            guessT -= x / dx;
        }
        return sampleCurve(p1y, p2y, guessT);
    }

    function sampleCurve(p1: number, p2: number, t: number): number {
        return ((1 - 3 * p2 + 3 * p1) * t + (3 * p2 - 6 * p1)) * t * t + 3 * p1 * t;
    }

    function sampleCurveDerivative(p1: number, p2: number, t: number): number {
        return (3 * (1 - 3 * p2 + 3 * p1)) * t * t + (2 * (3 * p2 - 6 * p1)) * t + 3 * p1;
    }

    // ====== Animation runner using rAF ======
    let activeAnimation: number | null = null;
    let resizeHandler: (() => void) | null = null;
    let navResizeObserver: ResizeObserver | null = null;
    let pendingRecalc = false;
    let themeTransitionTimer: number | null = null;
    const MOBILE_BREAKPOINT = 900;

    function isMobileViewport() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    function animateIndicator(
        indicator: HTMLElement,
        fromLeft: number, fromRight: number,
        toLeft: number, toRight: number,
        movingRight: boolean,
        getTargetEdges?: () => { left: number; right: number }
    ) {
        if (activeAnimation) cancelAnimationFrame(activeAnimation);

        const DURATION = 700; // ms total
        const startTime = performance.now();

        // Phase split: leading edge is faster, trailing edge is slower
        // Leading = the edge moving toward the target direction
        // Trailing = the edge that follows behind
        const DOT_SIZE = 4;

        function tick(now: number) {
            const elapsed = now - startTime;
            const rawT = Math.min(elapsed / DURATION, 1);
            const target = getTargetEdges ? getTargetEdges() : { left: toLeft, right: toRight };
            const finalLeft = (target.left + target.right) / 2 - DOT_SIZE / 2;
            const finalRight = finalLeft + DOT_SIZE;

            // Phase 1: Expansion + travel (0 → 0.55)
            // Phase 2: Contraction to dot (0.55 → 1.0)
            let currentLeft: number, currentRight: number, radius: number;

            if (rawT < 0.55) {
                // ---- Phase 1: Expand & slide ----
                const phaseT = rawT / 0.55; // normalize 0→1

                // Leading edge uses decelerate (arrives quickly)
                const leadingProgress = easeEmphasizedDecel(phaseT);
                // Trailing edge uses accelerate (leaves slowly, catches up late)
                const trailingProgress = easeEmphasizedAccel(phaseT);

                if (movingRight) {
                    // Right edge leads, left edge trails
                    currentRight = fromRight + (target.right - fromRight) * leadingProgress;
                    currentLeft = fromLeft + (target.left - fromLeft) * trailingProgress;
                } else {
                    // Left edge leads, right edge trails
                    currentLeft = fromLeft + (target.left - fromLeft) * leadingProgress;
                    currentRight = fromRight + (target.right - fromRight) * trailingProgress;
                }

                // Dynamic border-radius: more rounded at ends, flatter when stretched
                const width = currentRight - currentLeft;
                const maxWidth = movingRight
                    ? Math.abs(target.right - fromLeft)
                    : Math.abs(fromRight - target.left);
                const stretch = Math.min(width / DOT_SIZE, maxWidth / DOT_SIZE);
                radius = Math.max(2, DOT_SIZE / 2 / Math.pow(stretch, 0.3));

            } else {
                // ---- Phase 2: Settle into dot with spring ----
                const phaseT = (rawT - 0.55) / 0.45; // normalize 0→1
                const springT = easeSpringSettle(phaseT);

                // Edges converge from expanded position to final dot
                const expandedLeft = movingRight
                    ? fromLeft + (target.left - fromLeft) * easeEmphasizedAccel(1)
                    : fromLeft + (target.left - fromLeft) * easeEmphasizedDecel(1);
                const expandedRight = movingRight
                    ? fromRight + (target.right - fromRight) * easeEmphasizedDecel(1)
                    : fromRight + (target.right - fromRight) * easeEmphasizedAccel(1);

                currentLeft = expandedLeft + (finalLeft - expandedLeft) * springT;
                currentRight = expandedRight + (finalRight - expandedRight) * springT;

                // Radius returns to circle
                radius = 2 + (DOT_SIZE / 2 - 2) * springT;
            }

            // Apply styles — use left + width for positioning
            const width = Math.max(currentRight - currentLeft, 2);
            indicator.style.left = `${currentLeft}px`;
            indicator.style.width = `${width}px`;
            indicator.style.borderRadius = `${radius}px`;

            if (rawT < 1) {
                activeAnimation = requestAnimationFrame(tick);
            } else {
                // Ensure final state is exact
                indicator.style.left = `${finalLeft}px`;
                indicator.style.width = `${DOT_SIZE}px`;
                indicator.style.borderRadius = `${DOT_SIZE / 2}px`;
                activeAnimation = null;
                if (pendingRecalc) {
                    pendingRecalc = false;
                    scheduleHeaderUpdate();
                }
            }
        }

        activeAnimation = requestAnimationFrame(tick);
    }

    // ====== Header state management ======
    function updateHeaderState() {
        const header = document.querySelector('header');
        const indicator = document.getElementById('nav-indicator') as HTMLElement | null;
        const desktopLinks = document.querySelectorAll('.internal-links a') as NodeListOf<HTMLAnchorElement>;
        const mobileLinks = document.querySelectorAll('.mobile-nav-link') as NodeListOf<HTMLAnchorElement>;
        if (!header) return;

        // --- 1. Update active class based on current URL ---
        const pathname = window.location.pathname.replace(/\/$/, '') || '/';

        const syncActiveState = (links: NodeListOf<HTMLAnchorElement>) => {
            let oldActive: HTMLAnchorElement | null = null;
            let newActive: HTMLAnchorElement | null = null;

            links.forEach((link) => {
                const href = link.getAttribute('href') || '';
                const isActive = href === '/'
                    ? pathname === '/'
                    : pathname === href || pathname.startsWith(href + '/');

                if (link.classList.contains('active') && !isActive) oldActive = link;
                if (isActive) newActive = link;
                link.classList.toggle('active', isActive);
            });

            return { oldActive, newActive };
        };

        const desktopState = syncActiveState(desktopLinks);
        syncActiveState(mobileLinks);

        // --- 2. Animate the indicator (desktop only) ---
        if (!indicator || desktopLinks.length === 0 || isMobileViewport()) {
            if (indicator) indicator.style.opacity = '0';
        } else {
            const { oldActive, newActive } = desktopState;

            if (!newActive) {
                indicator.style.opacity = '0';
            } else {
                indicator.style.opacity = '1';
                const container = indicator.parentElement!;
                const getEdges = (el: HTMLElement) => {
                    const containerRect = container.getBoundingClientRect();
                    const r = el.getBoundingClientRect();
                    const center = r.left + r.width / 2 - containerRect.left;
                    return { left: center - 2, right: center + 2 };
                };

                const targetEdges = getEdges(newActive);
                if (oldActive && oldActive !== newActive) {
                    const oldEdges = getEdges(oldActive);
                    const movingRight = targetEdges.left > oldEdges.left;

                    pendingRecalc = false;
                    animateIndicator(
                        indicator,
                        oldEdges.left,
                        oldEdges.right,
                        targetEdges.left,
                        targetEdges.right,
                        movingRight,
                        () => getEdges(newActive)
                    );
                } else if (activeAnimation) {
                    pendingRecalc = true;
                } else {
                    pendingRecalc = false;
                    indicator.style.left = `${targetEdges.left}px`;
                    indicator.style.width = '4px';
                    indicator.style.borderRadius = '4px';
                }
            }
        }

        // --- 3. Sticky header scroll logic ---
        if (header.classList.contains('transparent')) {
            const mainContent = document.getElementById('main-content');
            if (!mainContent) return;

            const onScroll = () => {
                if (mainContent.scrollTop > 50) {
                    header.classList.add('scrolled');
                } else {
                    header.classList.remove('scrolled');
                }
            };

            onScroll();
            if ((mainContent as any).__scrollHandler) {
                mainContent.removeEventListener('scroll', (mainContent as any).__scrollHandler);
            }

            (mainContent as any).__scrollHandler = onScroll;
            mainContent.addEventListener('scroll', onScroll, { passive: true });
        }
    }

    function scheduleHeaderUpdate() {
        requestAnimationFrame(() => updateHeaderState());
    }

    function parseCssTimeToMs(value: string): number | null {
        const normalized = value.trim();
        if (!normalized) return null;
        const match = normalized.match(/^(-?\d*\.?\d+)(ms|s)$/i);
        if (!match) return null;
        const amount = Number(match[1]);
        if (!Number.isFinite(amount)) return null;
        return match[2].toLowerCase() === 's' ? amount * 1000 : amount;
    }

    function getThemeTransitionDurationMs(html: HTMLElement): number {
        const styles = getComputedStyle(html);
        const variableDuration = styles.getPropertyValue('--theme-color-transition-duration');
        const parsed = parseCssTimeToMs(variableDuration);
        return parsed ?? 400;
    }

    // ====== Theme Toggle ======
    function initThemeToggle() {
        const toggle = document.getElementById('theme-toggle');
        if (!toggle) return;

        // Remove old listener to prevent stacking (due to transition:persist)
        if ((toggle as any).__themeHandler) {
            toggle.removeEventListener('click', (toggle as any).__themeHandler);
        }

        const handler = () => {
            const html = document.documentElement;
            const transitionDuration = Math.max(0, getThemeTransitionDurationMs(html));

            // Enable smooth theme transition on all elements
            html.classList.add('theme-transitioning');

            // Ensure the transition class is applied before switching theme values.
            requestAnimationFrame(() => {
                const current = html.getAttribute('data-theme') || 'light';
                const next = current === 'dark' ? 'light' : 'dark';
                html.setAttribute('data-theme', next);
                localStorage.setItem('theme', next);

                if (themeTransitionTimer !== null) {
                    clearTimeout(themeTransitionTimer);
                }
                const cleanupDelay = transitionDuration <= 0 ? 0 : transitionDuration + 34;
                themeTransitionTimer = window.setTimeout(() => {
                    html.classList.remove('theme-transitioning');
                    themeTransitionTimer = null;
                }, cleanupDelay);
            });
        };

        (toggle as any).__themeHandler = handler;
        toggle.addEventListener('click', handler);
    }

    // ====== Custom Cursor Toggle ======
    function initCursorToggle() {
        const toggle = document.getElementById('cursor-toggle') as HTMLButtonElement | null;
        if (!toggle) return;

        const isEnabled = () => document.documentElement.classList.contains('custom-cursor-enabled');
        const setToggleState = (enabled: boolean) => {
            toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
            toggle.setAttribute('aria-label', enabled ? '关闭自定义光标' : '开启自定义光标');
            toggle.title = enabled ? '关闭自定义光标' : '开启自定义光标';
        };

        setToggleState(isEnabled());

        if ((toggle as any).__cursorHandler) {
            toggle.removeEventListener('click', (toggle as any).__cursorHandler);
        }

        const clickHandler = () => {
            const nextEnabled = !isEnabled();
            const globalSetter = (window as any).setCustomCursorEnabled;

            if (typeof globalSetter === 'function') {
                globalSetter(nextEnabled);
            } else {
                localStorage.setItem('custom-cursor-enabled', String(nextEnabled));
                document.documentElement.classList.toggle('custom-cursor-enabled', nextEnabled);
                document.documentElement.setAttribute('data-custom-cursor', nextEnabled ? 'on' : 'off');
                if (!nextEnabled) {
                    document.documentElement.classList.remove('custom-cursor-active');
                }
                window.dispatchEvent(new CustomEvent('custom-cursor:toggle', { detail: { enabled: nextEnabled } }));
            }

            setToggleState(nextEnabled);
        };

        (toggle as any).__cursorHandler = clickHandler;
        toggle.addEventListener('click', clickHandler);

        const windowAny = window as any;
        if (windowAny.__cursorToggleSyncHandler) {
            window.removeEventListener('custom-cursor:toggle', windowAny.__cursorToggleSyncHandler as EventListener);
        }
        windowAny.__cursorToggleSyncHandler = () => setToggleState(isEnabled());
        window.addEventListener('custom-cursor:toggle', windowAny.__cursorToggleSyncHandler as EventListener);
    }

    // ====== Mobile Menu ======
    function initMobileMenu() {
        const header = document.querySelector('header');
        const menuBtn = document.getElementById('mobile-menu-btn') as HTMLButtonElement | null;
        const overlay = document.getElementById('mobile-nav-overlay');
        const drawer = document.getElementById('mobile-nav-drawer');
        const mobileLinks = document.querySelectorAll('.mobile-nav-link') as NodeListOf<HTMLAnchorElement>;

        if (!header || !menuBtn || !overlay || !drawer) return;

        const openMenu = () => {
            if (!isMobileViewport()) return;
            header.classList.add('mobile-menu-open');
            document.body.classList.add('mobile-menu-open');
            menuBtn.setAttribute('aria-expanded', 'true');
            overlay.setAttribute('aria-hidden', 'false');
            drawer.setAttribute('aria-hidden', 'false');
        };

        const closeMenu = () => {
            header.classList.remove('mobile-menu-open');
            document.body.classList.remove('mobile-menu-open');
            menuBtn.setAttribute('aria-expanded', 'false');
            overlay.setAttribute('aria-hidden', 'true');
            drawer.setAttribute('aria-hidden', 'true');
        };

        const toggleMenu = () => {
            if (header.classList.contains('mobile-menu-open')) {
                closeMenu();
            } else {
                openMenu();
            }
        };

        // Remove old listeners (persist-safe)
        const menuBtnAny = menuBtn as any;
        const overlayAny = overlay as any;
        const windowAny = window as any;
        const docAny = document as any;

        if (menuBtnAny.__menuToggleHandler) {
            menuBtn.removeEventListener('click', menuBtnAny.__menuToggleHandler);
        }
        if (overlayAny.__menuOverlayHandler) {
            overlay.removeEventListener('click', overlayAny.__menuOverlayHandler);
        }
        if (windowAny.__menuResizeHandler) {
            window.removeEventListener('resize', windowAny.__menuResizeHandler);
        }
        if (docAny.__menuKeyHandler) {
            document.removeEventListener('keydown', docAny.__menuKeyHandler);
        }

        menuBtnAny.__menuToggleHandler = toggleMenu;
        overlayAny.__menuOverlayHandler = closeMenu;
        windowAny.__menuResizeHandler = () => {
            if (!isMobileViewport()) {
                closeMenu();
            }
        };
        docAny.__menuKeyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeMenu();
            }
        };

        menuBtn.addEventListener('click', menuBtnAny.__menuToggleHandler);
        overlay.addEventListener('click', overlayAny.__menuOverlayHandler);
        window.addEventListener('resize', windowAny.__menuResizeHandler);
        document.addEventListener('keydown', docAny.__menuKeyHandler);

        mobileLinks.forEach((link) => {
            const linkAny = link as any;
            if (linkAny.__menuLinkHandler) {
                link.removeEventListener('click', linkAny.__menuLinkHandler);
            }
            linkAny.__menuLinkHandler = closeMenu;
            link.addEventListener('click', linkAny.__menuLinkHandler);
        });

        closeMenu();
    }

    const applyHeaderBehaviors = () => {
        initThemeToggle();
        initCursorToggle();
        initMobileMenu();
        updateHeaderState();

        // Recalculate after fonts load to avoid layout shift offsets
        if ('fonts' in document) {
            document.fonts.ready.then(scheduleHeaderUpdate);
        }

        // Recalculate on resize (avoid stacking listeners due to persist)
        if (resizeHandler) {
            window.removeEventListener('resize', resizeHandler);
        }
        resizeHandler = () => scheduleHeaderUpdate();
        window.addEventListener('resize', resizeHandler);

        // Watch nav container size changes (font load, responsive changes)
        const container = document.querySelector('.internal-links');
        if (container && 'ResizeObserver' in window) {
            if (navResizeObserver) {
                navResizeObserver.disconnect();
            }
            navResizeObserver = new ResizeObserver(() => scheduleHeaderUpdate());
            navResizeObserver.observe(container);
        }
    };

    document.addEventListener('astro:page-load', applyHeaderBehaviors);
    applyHeaderBehaviors();
