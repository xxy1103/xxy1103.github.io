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

function setupBlogParallax() {
	const statsCard = document.getElementById('stats-card');
	const mainContent = document.getElementById('main-content');
	const isCoarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
	const maxRise = isCoarsePointer ? 72 : 180;

	if (!statsCard || !mainContent) return;

	let ticking = false;
	const updateParallax = () => {
		const scrollY = mainContent.scrollTop;
		const progress = Math.min(scrollY / (window.innerHeight * 0.5), 1);
		const rise = progress * maxRise;
		statsCard.style.transform = `translateY(-${rise}px)`;
	};

	const onScroll = () => {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(() => {
			updateParallax();
			ticking = false;
		});
	};

	const mainContentAny = mainContent as HTMLElement & { __blogParallaxHandler?: () => void };
	if (mainContentAny.__blogParallaxHandler) {
		mainContent.removeEventListener('scroll', mainContentAny.__blogParallaxHandler);
	}

	mainContentAny.__blogParallaxHandler = onScroll;
	updateParallax();
	mainContent.addEventListener('scroll', onScroll, { passive: true });
}

export function initBlogListPage() {
	setupScrollReveal();
	setupBlogParallax();
}

