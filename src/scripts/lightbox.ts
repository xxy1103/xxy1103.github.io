/*
 * Lightbox Logic
 * Handles image clicking and modal display
 */

export function setupLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;

    const lightboxImg = lightbox.querySelector('.lightbox-image') as HTMLImageElement;
    const closeBtn = lightbox.querySelector('.lightbox-close');

    if (!lightboxImg || !closeBtn) return;

    const closeLightbox = () => {
        lightbox.classList.remove('active');
        setTimeout(() => {
            lightboxImg.src = ''; // Clear source after transition
        }, 300);
    };

    // Open lightbox (delegated)
    const docAny = document as any;
    if (docAny.__lightboxClickHandler) {
        document.removeEventListener('click', docAny.__lightboxClickHandler);
    }
    docAny.__lightboxClickHandler = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const img = target.closest('.prose img') as HTMLImageElement | null;
        if (!img) return;
        lightboxImg.src = img.src;
        lightbox.classList.add('active');
    };
    document.addEventListener('click', docAny.__lightboxClickHandler);

    // Close on button click
    const closeBtnAny = closeBtn as any;
    if (closeBtnAny.__lightboxCloseHandler) {
        closeBtn.removeEventListener('click', closeBtnAny.__lightboxCloseHandler);
    }
    closeBtnAny.__lightboxCloseHandler = closeLightbox;
    closeBtn.addEventListener('click', closeBtnAny.__lightboxCloseHandler);

    // Close on background click
    const lightboxAny = lightbox as any;
    if (lightboxAny.__lightboxOverlayHandler) {
        lightbox.removeEventListener('click', lightboxAny.__lightboxOverlayHandler);
    }
    lightboxAny.__lightboxOverlayHandler = (e: MouseEvent) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    };
    lightbox.addEventListener('click', lightboxAny.__lightboxOverlayHandler);

    // Close on Escape key
    if (docAny.__lightboxKeyHandler) {
        document.removeEventListener('keydown', docAny.__lightboxKeyHandler);
    }
    docAny.__lightboxKeyHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
            closeLightbox();
        }
    };
    document.addEventListener('keydown', docAny.__lightboxKeyHandler);

    // Hint browser for offscreen images without blocking entrance animation
    const hintImages = () => {
        document.querySelectorAll<HTMLImageElement>('.prose img').forEach((img) => {
            if (!img.loading) img.loading = 'lazy';
            img.decoding = 'async';
        });
    };

    if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(hintImages, { timeout: 1000 });
    } else {
        setTimeout(hintImages, 0);
    }
}
