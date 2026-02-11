function setupHomeParallax() {
	const statsCard = document.getElementById('stats-card');
	const heroHeader = document.querySelector('.hero-header') as HTMLElement | null;
	const mainContent = document.getElementById('main-content');
	const isCoarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
	const maxRise = isCoarsePointer ? 48 : 100;

	if (statsCard) {
		statsCard.style.opacity = '1';
		statsCard.style.transform = 'translateY(0)';
	}

	if (!statsCard || !heroHeader || !mainContent) return;

	let ticking = false;
	const updateParallax = () => {
		const heroBottom = heroHeader.offsetTop + heroHeader.offsetHeight;
		const scrollY = mainContent.scrollTop;
		const scrollStart = heroBottom - window.innerHeight;

		if (scrollY > scrollStart) {
			const progress = Math.min((scrollY - scrollStart) / (window.innerHeight * 0.5), 1);
			const rise = progress * maxRise;
			statsCard.style.transform = `translateY(-${rise}px)`;
		} else {
			statsCard.style.transform = 'translateY(0)';
		}
	};

	const onScroll = () => {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(() => {
			updateParallax();
			ticking = false;
		});
	};

	const mainContentAny = mainContent as HTMLElement & { __homeParallaxHandler?: () => void };
	if (mainContentAny.__homeParallaxHandler) {
		mainContent.removeEventListener('scroll', mainContentAny.__homeParallaxHandler);
	}

	mainContentAny.__homeParallaxHandler = onScroll;
	updateParallax();
	mainContent.addEventListener('scroll', onScroll, { passive: true });
}

function setupCountUp() {
	const statValues = document.querySelectorAll('.stat-value');
	if (statValues.length === 0) return;

	const countUpObserver = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;

				const target = entry.target as HTMLElement;
				const originalText = target.innerText;
				const match = originalText.match(/([\d.]+)(.*)/);
				if (!match) continue;

				const numberPart = Number.parseFloat(match[1]);
				const suffix = match[2];
				const isFloat = match[1].includes('.');

				const duration = 1500;
				const startTime = performance.now();

				const update = (currentTime: number) => {
					const elapsed = currentTime - startTime;
					const progress = Math.min(elapsed / duration, 1);
					const ease = 1 - Math.pow(1 - progress, 3);
					const current = numberPart * ease;
					const formatted = isFloat ? current.toFixed(2) : Math.floor(current).toString();
					target.innerText = formatted + suffix;

					if (progress < 1) {
						requestAnimationFrame(update);
					} else {
						target.innerText = originalText;
					}
				};

				requestAnimationFrame(update);
				countUpObserver.unobserve(target);
			}
		},
		{ threshold: 0.5 },
	);

	for (const el of statValues) countUpObserver.observe(el);
}

function setupPostsStagger() {
	const postsList = document.querySelector('.home-posts-list');
	if (!postsList) return;

	const postsObserver = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					postsList.classList.add('visible');
					postsObserver.unobserve(entry.target);
				}
			}
		},
		{ threshold: 0.1 },
	);

	postsObserver.observe(postsList);
}

export function initHomePage() {
	setupHomeParallax();
	setupCountUp();
	setupPostsStagger();
}

