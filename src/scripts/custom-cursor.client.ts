type HoverMode =
    | 'idle'
    | 'basic'
    | 'special-nav'
    | 'special-email'
    | 'special-media'
    | 'special-avatar';

type SpecialKind = 'nav' | 'email' | 'media' | 'avatar';
type SpecialMode = Exclude<HoverMode, 'idle' | 'basic'>;

interface CursorState {
    mouseX: number;
    mouseY: number;
    cursorX: number;
    cursorY: number;
    isVisible: boolean;
    wrapper: HTMLElement | null;
    inner: HTMLElement | null;
    mode: HoverMode;
    specialKind: SpecialKind | null;
    isClicking: boolean;
    velX: number;
    velY: number;
    scaleX: number;
    scaleY: number;
    angle: number;
    clickScale: number;
    targetX?: number;
    targetY?: number;
    activeElement: Element | null;
    activeRect: DOMRect | null;
    specialLockUntil: number;
    recoverUntil: number;
    targetWidth: number;
    targetHeight: number;
    displayWidth: number;
    displayHeight: number;
    lastRectSampleAt: number;
    lastInteractionAt: number;
    lastWrapperX: number;
    lastWrapperY: number;
    lastInnerTransform: string;
    cleanup: () => void;
}

const RECT_SAMPLE_INTERVAL_MS = 120;
const SPECIAL_LOCK_MS = 160;
const SPECIAL_RECOVER_MS = 120;
const SPECIAL_SIZE_EASING = 0.24;
const SPECIAL_POSITION_EASING = 0.18;
const DEFAULT_POSITION_EASING = 0.12;
const IDLE_KEEP_ALIVE_MS = 140;

const clamp = (value: number, min: number, max: number) => {
    return Math.min(max, Math.max(min, value));
};

const round3 = (value: number) => Math.round(value * 1000) / 1000;

const isSpecialMode = (mode: HoverMode): mode is SpecialMode => {
    return mode.startsWith('special-');
};

const modeFromSpecialKind = (kind: SpecialKind): SpecialMode => {
    return `special-${kind}` as SpecialMode;
};

const applyModeClass = (wrapper: HTMLElement, mode: HoverMode) => {
    wrapper.classList.remove('hovering', 'hovering-nav', 'hovering-email', 'hovering-media', 'hovering-avatar');
    if (mode === 'basic') {
        wrapper.classList.add('hovering');
        return;
    }
    if (mode === 'special-nav') {
        wrapper.classList.add('hovering-nav');
        return;
    }
    if (mode === 'special-email') {
        wrapper.classList.add('hovering-email');
        return;
    }
    if (mode === 'special-media') {
        wrapper.classList.add('hovering-media');
        return;
    }
    if (mode === 'special-avatar') {
        wrapper.classList.add('hovering-avatar');
    }
};

const setCursorTargetSize = (wrapper: HTMLElement, width: number, height: number) => {
    const roundedWidth = Math.max(0, Math.round(width));
    const roundedHeight = Math.max(0, Math.round(height));
    const widthToken = String(roundedWidth);
    const heightToken = String(roundedHeight);

    if (wrapper.dataset.cursorTargetWidth !== widthToken) {
        wrapper.style.setProperty('--cursor-target-width', `${roundedWidth}px`);
        wrapper.dataset.cursorTargetWidth = widthToken;
    }
    if (wrapper.dataset.cursorTargetHeight !== heightToken) {
        wrapper.style.setProperty('--cursor-target-height', `${roundedHeight}px`);
        wrapper.dataset.cursorTargetHeight = heightToken;
    }
};

const computeSpecialSize = (kind: SpecialKind, rect: DOMRect) => {
    if (kind === 'media') {
        return { width: rect.width, height: rect.height };
    }
    if (kind === 'avatar') {
        const size = Math.max(rect.width, rect.height) + 12;
        return { width: size, height: size };
    }
    if (kind === 'email') {
        return { width: rect.width + 20, height: rect.height + 10 };
    }
    return { width: rect.width + 30, height: rect.height + 15 };
};

const updateSpecialTarget = (state: CursorState, rect: DOMRect) => {
    const width = Math.max(rect.width, 1);
    const height = Math.max(rect.height, 1);
    const nx = clamp((state.mouseX - rect.left) / width, 0, 1);
    const ny = clamp((state.mouseY - rect.top) / height, 0, 1);

    const anchorX = rect.left + width * nx;
    const anchorY = rect.top + height * ny;
    const centerX = rect.left + width / 2;
    const centerY = rect.top + height / 2;

    state.targetX = anchorX * 0.88 + centerX * 0.12;
    state.targetY = anchorY * 0.88 + centerY * 0.12;
};

const setMode = (state: CursorState, mode: HoverMode) => {
    if (state.mode === mode) return;
    state.mode = mode;
    if (state.wrapper) {
        applyModeClass(state.wrapper, mode);
    }
};

const enterSpecialMode = (
    state: CursorState,
    kind: SpecialKind,
    element: Element,
    rect: DOMRect,
    now: number,
) => {
    const wasSpecial = isSpecialMode(state.mode);
    const size = computeSpecialSize(kind, rect);

    state.specialKind = kind;
    state.activeElement = element;
    state.activeRect = rect;
    state.specialLockUntil = now + SPECIAL_LOCK_MS;
    state.recoverUntil = 0;
    state.lastRectSampleAt = now;
    state.targetWidth = size.width;
    state.targetHeight = size.height;

    if (!wasSpecial) {
        state.displayWidth = size.width;
        state.displayHeight = size.height;
    }

    state.angle = 0;
    state.scaleX = 1;
    state.scaleY = 1;

    setMode(state, modeFromSpecialKind(kind));
    updateSpecialTarget(state, rect);

    if (state.wrapper) {
        setCursorTargetSize(state.wrapper, state.displayWidth, state.displayHeight);
    }
};

const exitSpecialMode = (state: CursorState, nextMode: 'idle' | 'basic', now: number) => {
    state.specialKind = null;
    state.activeElement = null;
    state.activeRect = null;
    state.specialLockUntil = 0;
    state.targetX = undefined;
    state.targetY = undefined;
    state.recoverUntil = now + SPECIAL_RECOVER_MS;
    setMode(state, nextMode);
};

const updateSpecialMode = (state: CursorState, now: number) => {
    if (!isSpecialMode(state.mode) || !state.specialKind || !state.activeElement || !state.wrapper) {
        return false;
    }

    if (!state.activeRect || now - state.lastRectSampleAt >= RECT_SAMPLE_INTERVAL_MS) {
        state.activeRect = state.activeElement.getBoundingClientRect();
        state.lastRectSampleAt = now;
    }

    const rect = state.activeRect;
    if (!rect) return false;

    const padX = state.specialKind === 'media' ? 28 : 22;
    const padY = state.specialKind === 'media' ? 28 : 20;
    const isOver =
        state.mouseX >= rect.left - padX &&
        state.mouseX <= rect.right + padX &&
        state.mouseY >= rect.top - padY &&
        state.mouseY <= rect.bottom + padY;

    if (!isOver && now > state.specialLockUntil) {
        return false;
    }

    const size = computeSpecialSize(state.specialKind, rect);
    state.targetWidth = size.width;
    state.targetHeight = size.height;

    state.displayWidth += (state.targetWidth - state.displayWidth) * SPECIAL_SIZE_EASING;
    state.displayHeight += (state.targetHeight - state.displayHeight) * SPECIAL_SIZE_EASING;

    if (Math.abs(state.targetWidth - state.displayWidth) < 0.25) {
        state.displayWidth = state.targetWidth;
    }
    if (Math.abs(state.targetHeight - state.displayHeight) < 0.25) {
        state.displayHeight = state.targetHeight;
    }

    setCursorTargetSize(state.wrapper, state.displayWidth, state.displayHeight);
    updateSpecialTarget(state, rect);
    return true;
};

const isAndroid = /Android/i.test(navigator.userAgent);
if (isAndroid) {
    document.documentElement.classList.add('is-android');
}

const isCoarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
const isCustomCursorEnabled = () => document.documentElement.classList.contains('custom-cursor-enabled');
let scheduleCursorLoop: (() => void) | null = null;
let stopCursorLoop: (() => void) | null = null;

if (isCustomCursorEnabled() && !isAndroid && !isCoarsePointer && !(window as any).cursorState) {
    const now = performance.now();
    const state: CursorState = {
        mouseX: -100,
        mouseY: -100,
        cursorX: -100,
        cursorY: -100,
        isVisible: false,
        wrapper: null,
        inner: null,
        mode: 'idle',
        specialKind: null,
        isClicking: false,
        velX: 0,
        velY: 0,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        clickScale: 1,
        targetX: undefined,
        targetY: undefined,
        activeElement: null,
        activeRect: null,
        specialLockUntil: 0,
        recoverUntil: 0,
        targetWidth: 40,
        targetHeight: 40,
        displayWidth: 40,
        displayHeight: 40,
        lastRectSampleAt: 0,
        lastInteractionAt: now,
        lastWrapperX: Number.NaN,
        lastWrapperY: Number.NaN,
        lastInnerTransform: '',
        cleanup: () => {},
    };
    (window as any).cursorState = state;

    let rafId: number | null = null;

    const queueNextFrame = () => {
        rafId = window.requestAnimationFrame(loop);
    };

    const stopLoop = () => {
        if (rafId !== null) {
            window.cancelAnimationFrame(rafId);
            rafId = null;
        }
    };

    const startLoop = () => {
        if (rafId !== null) return;
        queueNextFrame();
    };

    stopCursorLoop = stopLoop;
    scheduleCursorLoop = startLoop;

    const loop = () => {
        rafId = null;

        if (!state.wrapper || !state.inner || !isCustomCursorEnabled() || !state.isVisible) {
            return;
        }

        const nowLoop = performance.now();

        if (isSpecialMode(state.mode) && !updateSpecialMode(state, nowLoop)) {
            state.cleanup();
        }

        const specialActive = isSpecialMode(state.mode);
        const targetX = specialActive && state.targetX !== undefined ? state.targetX : state.mouseX;
        const targetY = specialActive && state.targetY !== undefined ? state.targetY : state.mouseY;
        const easing = specialActive ? SPECIAL_POSITION_EASING : DEFAULT_POSITION_EASING;

        const nextX = state.cursorX + (targetX - state.cursorX) * easing;
        const nextY = state.cursorY + (targetY - state.cursorY) * easing;

        const vx = nextX - state.cursorX;
        const vy = nextY - state.cursorY;
        const pullX = targetX - state.cursorX;
        const pullY = targetY - state.cursorY;
        const velocity = Math.sqrt(pullX * pullX + pullY * pullY) * easing;

        state.velX = vx;
        state.velY = vy;
        state.cursorX = nextX;
        state.cursorY = nextY;

        const roundedX = Math.round(state.cursorX * 100) / 100;
        const roundedY = Math.round(state.cursorY * 100) / 100;
        if (roundedX !== state.lastWrapperX || roundedY !== state.lastWrapperY) {
            state.wrapper.style.transform = `translate3d(${roundedX}px, ${roundedY}px, 0)`;
            state.lastWrapperX = roundedX;
            state.lastWrapperY = roundedY;
        }

        const targetClickScale = state.isClicking ? 0.84 : 1;
        state.clickScale += (targetClickScale - state.clickScale) * 0.22;

        let nextInnerTransform = '';
        if (specialActive) {
            const baseScale = state.mode === 'special-media' ? 1.02 : 1;
            const specialScale = round3(baseScale * state.clickScale);
            nextInnerTransform = `translate(-50%, -50%) scale(${specialScale})`;
        } else {
            const suppressLiquid = nowLoop < state.recoverUntil;

            if (state.mode === 'basic' && !suppressLiquid) {
                const maxDeformation = 1.6;
                let stretch = 1 + velocity * 0.02;
                if (stretch > maxDeformation) stretch = maxDeformation;

                state.scaleX += (stretch - state.scaleX) * 0.15;
                state.scaleY += (1 / stretch - state.scaleY) * 0.15;

                if (velocity > 0.5) {
                    state.angle = Math.atan2(vy, vx) * (180 / Math.PI);
                }

                const angle = Math.round(state.angle * 10) / 10;
                const scaleX = round3(state.scaleX * state.clickScale);
                const scaleY = round3(state.scaleY * state.clickScale);
                nextInnerTransform = `translate(-50%, -50%) rotate(${angle}deg) scale(${scaleX}, ${scaleY})`;
            } else {
                state.angle += (0 - state.angle) * 0.2;
                state.scaleX += (1 - state.scaleX) * 0.2;
                state.scaleY += (1 - state.scaleY) * 0.2;
                const idleScale = round3(state.clickScale);
                nextInnerTransform = `translate(-50%, -50%) scale(${idleScale})`;
            }
        }

        if (nextInnerTransform !== state.lastInnerTransform) {
            state.inner.style.transform = nextInnerTransform;
            state.lastInnerTransform = nextInnerTransform;
        }

        const positionSettled = Math.abs(targetX - state.cursorX) < 0.08 && Math.abs(targetY - state.cursorY) < 0.08;
        const clickSettled = Math.abs(targetClickScale - state.clickScale) < 0.01;
        const liquidSettled =
            state.mode !== 'basic' ||
            nowLoop < state.recoverUntil ||
            (Math.abs(state.scaleX - 1) < 0.02 && Math.abs(state.scaleY - 1) < 0.02 && Math.abs(state.angle) < 0.6);

        const keepAnimating =
            !positionSettled ||
            !clickSettled ||
            !liquidSettled ||
            state.mode !== 'idle' ||
            state.isClicking ||
            nowLoop - state.lastInteractionAt < IDLE_KEEP_ALIVE_MS;

        if (keepAnimating) {
            queueNextFrame();
        }
    };

    document.addEventListener(
        'pointermove',
        (e) => {
            const s = (window as any).cursorState as CursorState | undefined;
            if (!s) return;
            s.mouseX = e.clientX;
            s.mouseY = e.clientY;
            s.lastInteractionAt = performance.now();

            if (!isCustomCursorEnabled()) {
                return;
            }

            if (!s.isVisible && s.wrapper) {
                s.isVisible = true;
                s.wrapper.dataset.visible = 'true';
                document.documentElement.classList.add('custom-cursor-active');
                s.cursorX = s.mouseX;
                s.cursorY = s.mouseY;
            }
            startLoop();
        },
        { passive: true },
    );

    document.addEventListener(
        'pointerdown',
        () => {
            const s = (window as any).cursorState as CursorState | undefined;
            if (!s) return;
            s.isClicking = true;
            s.lastInteractionAt = performance.now();
            if (s.wrapper) s.wrapper.classList.add('clicking');
            if (s.isVisible && isCustomCursorEnabled()) {
                startLoop();
            }
        },
        { passive: true },
    );

    document.addEventListener(
        'pointerup',
        () => {
            const s = (window as any).cursorState as CursorState | undefined;
            if (!s) return;
            s.isClicking = false;
            s.lastInteractionAt = performance.now();
            if (s.wrapper) s.wrapper.classList.remove('clicking');
            if (s.isVisible && isCustomCursorEnabled()) {
                startLoop();
            }
        },
        { passive: true },
    );
}

function setupCursorPageLoadState() {
    const wrapper = document.getElementById('custom-cursor-wrapper');
    const inner = document.getElementById('custom-cursor-inner');
    const state = (window as any).cursorState as CursorState | undefined;
    const enabled = isCustomCursorEnabled();

    if (wrapper && inner && state) {
        if (wrapper.parentElement !== document.body) {
            document.body.appendChild(wrapper);
        }
        state.wrapper = wrapper;
        state.inner = inner;
    }

    if (!enabled) {
        stopCursorLoop?.();
        document.documentElement.classList.remove('custom-cursor-active');
        if (wrapper) {
            wrapper.removeAttribute('data-visible');
            wrapper.style.display = 'none';
        }
        return;
    }

    if (wrapper) {
        wrapper.style.removeProperty('display');
    }

    if (isAndroid) {
        stopCursorLoop?.();
        document.documentElement.classList.add('is-android');
        document.documentElement.classList.remove('custom-cursor-active');
        if (wrapper) {
            wrapper.removeAttribute('data-visible');
            wrapper.style.display = 'none';
        }
        return;
    }

    if (isCoarsePointer) {
        stopCursorLoop?.();
        document.documentElement.classList.remove('custom-cursor-active');
        if (wrapper) {
            wrapper.removeAttribute('data-visible');
        }
        return;
    }

    if (!state || !wrapper || !inner) {
        return;
    }

    state.mode = 'idle';
    state.specialKind = null;
    state.isClicking = false;
    state.clickScale = 1;
    state.scaleX = 1;
    state.scaleY = 1;
    state.angle = 0;
    state.targetX = undefined;
    state.targetY = undefined;
    state.activeElement = null;
    state.activeRect = null;
    state.specialLockUntil = 0;
    state.recoverUntil = 0;
    state.targetWidth = 40;
    state.targetHeight = 40;
    state.displayWidth = 40;
    state.displayHeight = 40;
    state.lastRectSampleAt = 0;
    state.lastInteractionAt = performance.now();
    state.lastInnerTransform = 'translate(-50%, -50%) scale(1)';

    applyModeClass(wrapper, 'idle');
    wrapper.classList.remove('clicking');
    inner.style.transform = state.lastInnerTransform;
    setCursorTargetSize(wrapper, state.displayWidth, state.displayHeight);

    if (state.isVisible) {
        wrapper.dataset.visible = 'true';
        document.documentElement.classList.add('custom-cursor-active');
        scheduleCursorLoop?.();
    } else {
        stopCursorLoop?.();
        document.documentElement.classList.remove('custom-cursor-active');
    }

    const navSelectors =
        '.internal-links a, .tag, .social-link, .search-btn, .cursor-toggle-btn, .theme-toggle-btn, .pagination a, header h2 a, .header-actions a, .post-title a, .blog-link, .meta-item, .post-tags .tag, .post-tags span, .post-tags a, .toc-link, .code-copy-btn, .prose a';
    const avatarSelectors = '.avatar, .avatar-placeholder';
    const emailSelectors = 'a[href^="mailto:"], .meta-chip[href^="mailto:"]';
    const mediaSelectors = 'img, .content-card img, .project-card, .avatar, .hero-image';
    const basicSelectors = 'a, button, input, textarea, select, [role="button"]';

    let currentHoverTarget: Element | null = null;

    const cleanupHover = (nextMode: 'idle' | 'basic' = 'idle') => {
        const now = performance.now();
        if (isSpecialMode(state.mode)) {
            exitSpecialMode(state, nextMode, now);
        } else {
            setMode(state, nextMode);
            if (nextMode === 'idle') {
                state.recoverUntil = Math.max(state.recoverUntil, now + SPECIAL_RECOVER_MS);
            }
        }

        state.specialKind = null;
        state.activeElement = null;
        state.activeRect = null;
        state.specialLockUntil = 0;
        state.targetX = undefined;
        state.targetY = undefined;
        state.lastInteractionAt = now;

        if (nextMode !== 'basic') {
            currentHoverTarget = null;
        }

        scheduleCursorLoop?.();
    };

    const activateSpecial = (kind: SpecialKind, element: Element) => {
        const now = performance.now();
        const nextMode = modeFromSpecialKind(kind);

        if (currentHoverTarget === element && state.mode === nextMode) {
            state.lastInteractionAt = now;
            scheduleCursorLoop?.();
            return;
        }

        const rect = element.getBoundingClientRect();
        enterSpecialMode(state, kind, element, rect, now);
        currentHoverTarget = element;
        state.lastInteractionAt = now;
        scheduleCursorLoop?.();
    };

    const activateBasic = (element: Element) => {
        const now = performance.now();

        if (currentHoverTarget === element && state.mode === 'basic') {
            state.lastInteractionAt = now;
            scheduleCursorLoop?.();
            return;
        }

        if (isSpecialMode(state.mode)) {
            exitSpecialMode(state, 'basic', now);
        } else {
            setMode(state, 'basic');
        }

        state.specialKind = null;
        state.activeElement = null;
        state.activeRect = null;
        state.specialLockUntil = 0;
        state.targetX = undefined;
        state.targetY = undefined;
        currentHoverTarget = element;
        state.lastInteractionAt = now;
        scheduleCursorLoop?.();
    };

    state.cleanup = () => cleanupHover('idle');

    const handleMouseOver = (e: Event) => {
        if (!state.wrapper) return;
        const target = e.target as Element | null;
        if (!target) return;
        state.lastInteractionAt = performance.now();

        const emailEl = target.closest(emailSelectors);
        if (emailEl) {
            activateSpecial('email', emailEl);
            return;
        }

        const navEl = target.closest(navSelectors);
        if (navEl) {
            activateSpecial('nav', navEl);
            return;
        }

        const avatarEl = target.closest(avatarSelectors);
        if (avatarEl) {
            activateSpecial('avatar', avatarEl);
            return;
        }

        const mediaEl = target.closest(mediaSelectors);
        if (mediaEl) {
            activateBasic(mediaEl);
            return;
        }

        const basicEl = target.closest(basicSelectors);
        if (basicEl) {
            activateBasic(basicEl);
            return;
        }

        if (currentHoverTarget) {
            cleanupHover('idle');
        }
    };

    const d = document as any;
    if (d.__cursorHoverHandler) {
        document.removeEventListener('mouseover', d.__cursorHoverHandler);
    }
    d.__cursorHoverHandler = handleMouseOver;
    document.addEventListener('mouseover', handleMouseOver);
}

document.addEventListener('astro:page-load', setupCursorPageLoadState);
setupCursorPageLoadState();

window.addEventListener('custom-cursor:toggle', (event) => {
    const customEvent = event as CustomEvent<{ enabled?: boolean }>;
    const enabled = Boolean(customEvent.detail?.enabled);
    const wrapper = document.getElementById('custom-cursor-wrapper');
    const inner = document.getElementById('custom-cursor-inner');
    const state = (window as any).cursorState as CursorState | undefined;

    if (wrapper && inner && state) {
        if (wrapper.parentElement !== document.body) {
            document.body.appendChild(wrapper);
        }
        state.wrapper = wrapper;
        state.inner = inner;
    }

    if (!enabled) {
        stopCursorLoop?.();
        document.documentElement.classList.remove('custom-cursor-active');
        if (wrapper) {
            wrapper.removeAttribute('data-visible');
            wrapper.style.display = 'none';
            applyModeClass(wrapper, 'idle');
            wrapper.classList.remove('clicking');
        }
        if (state) {
            state.isVisible = false;
            state.mode = 'idle';
            state.specialKind = null;
            state.isClicking = false;
            state.targetX = undefined;
            state.targetY = undefined;
            state.activeElement = null;
            state.activeRect = null;
            state.specialLockUntil = 0;
            state.recoverUntil = 0;
            state.lastInteractionAt = performance.now();
        }
        return;
    }

    if (wrapper) {
        wrapper.style.removeProperty('display');
        applyModeClass(wrapper, 'idle');
    }

    if (state && wrapper) {
        const hasPointerPosition = state.mouseX >= 0 && state.mouseY >= 0;
        state.mode = 'idle';
        state.specialKind = null;
        state.activeElement = null;
        state.activeRect = null;
        state.specialLockUntil = 0;
        state.recoverUntil = performance.now() + SPECIAL_RECOVER_MS;
        state.targetX = undefined;
        state.targetY = undefined;

        if (hasPointerPosition) {
            state.cursorX = state.mouseX;
            state.cursorY = state.mouseY;
            state.isVisible = true;
            const roundedX = Math.round(state.cursorX * 100) / 100;
            const roundedY = Math.round(state.cursorY * 100) / 100;
            wrapper.style.transform = `translate3d(${roundedX}px, ${roundedY}px, 0)`;
            state.lastWrapperX = roundedX;
            state.lastWrapperY = roundedY;
            wrapper.dataset.visible = 'true';
            document.documentElement.classList.add('custom-cursor-active');
            state.lastInteractionAt = performance.now();
            scheduleCursorLoop?.();
        } else {
            stopCursorLoop?.();
            state.isVisible = false;
            wrapper.removeAttribute('data-visible');
            document.documentElement.classList.remove('custom-cursor-active');
        }
    }
});
