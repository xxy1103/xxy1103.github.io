function setupBackLinkMagnet() {
	const backLink = document.querySelector<HTMLElement>('.back-link');
	const isCoarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

	if (!backLink || isCoarsePointer) return;

	const backLinkAny = backLink as HTMLElement & {
		__magneticMoveHandler?: (event: MouseEvent) => void;
		__magneticLeaveHandler?: () => void;
	};

	if (backLinkAny.__magneticMoveHandler) {
		backLink.removeEventListener('mousemove', backLinkAny.__magneticMoveHandler);
	}
	if (backLinkAny.__magneticLeaveHandler) {
		backLink.removeEventListener('mouseleave', backLinkAny.__magneticLeaveHandler);
	}

	backLinkAny.__magneticMoveHandler = (e: MouseEvent) => {
		const rect = backLink.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		const centerX = rect.width / 2;
		const centerY = rect.height / 2;
		const deltaX = (x - centerX) * 0.4;
		const deltaY = (y - centerY) * 0.4;
		backLink.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
	};

	backLinkAny.__magneticLeaveHandler = () => {
		backLink.style.transform = '';
	};

	backLink.addEventListener('mousemove', backLinkAny.__magneticMoveHandler);
	backLink.addEventListener('mouseleave', backLinkAny.__magneticLeaveHandler);
}

function setupTagParallax() {
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

	const mainContentAny = mainContent as HTMLElement & { __tagParallaxHandler?: () => void };
	if (mainContentAny.__tagParallaxHandler) {
		mainContent.removeEventListener('scroll', mainContentAny.__tagParallaxHandler);
	}

	mainContentAny.__tagParallaxHandler = onScroll;
	updateParallax();
	mainContent.addEventListener('scroll', onScroll, { passive: true });
}

export function initTagDetailPage() {
	setupBackLinkMagnet();
	setupTagParallax();
}
