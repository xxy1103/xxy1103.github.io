import { setupParallax } from './parallax';

function setupScrollReveal() {
	const targets = Array.from(document.querySelectorAll<HTMLElement>('.scroll-reveal'));
	if (targets.length === 0) return;

	const pending = targets.filter((el) => !el.classList.contains('visible'));
	if (pending.length === 0) return;

	if (!('IntersectionObserver' in window)) {
		pending.forEach((el) => {
			el.classList.remove('reveal-pending');
			el.classList.add('visible');
		});
		return;
	}

	const observerOptions = {
		root: null,
		rootMargin: '0px',
		threshold: 0.1,
	};

	pending.forEach((el) => el.classList.add('reveal-pending'));

	const observer = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (entry.isIntersecting) {
				entry.target.classList.remove('reveal-pending');
				entry.target.classList.add('visible');
				observer.unobserve(entry.target);
			}
		}
	}, observerOptions);

	pending.forEach((el) => observer.observe(el));

	// Fallback: avoid permanently hidden items if observer callback is missed.
	window.setTimeout(() => {
		pending.forEach((el) => {
			el.classList.remove('reveal-pending');
			el.classList.add('visible');
		});
		observer.disconnect();
	}, 1200);
}

export function initBlogListPage() {
	setupScrollReveal();
	setupParallax({ desktopRise: 180, coarsePointerRise: 72 });
}

