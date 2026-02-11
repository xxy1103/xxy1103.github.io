function setupAboutParallax() {
	const statsCard = document.getElementById('stats-card');
	const mainContent = document.getElementById('main-content');
	const isCoarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
	const maxRise = isCoarsePointer ? 64 : 140;

	if (!statsCard || !mainContent) return;

	statsCard.style.opacity = '1';
	statsCard.style.transform = 'translateY(0)';

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

	const mainContentAny = mainContent as HTMLElement & { __aboutParallaxHandler?: () => void };
	if (mainContentAny.__aboutParallaxHandler) {
		mainContent.removeEventListener('scroll', mainContentAny.__aboutParallaxHandler);
	}

	mainContentAny.__aboutParallaxHandler = onScroll;
	updateParallax();
	mainContent.addEventListener('scroll', onScroll, { passive: true });
}

export function initAboutPage() {
	setupAboutParallax();
}
