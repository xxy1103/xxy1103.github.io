import { setupParallax } from './parallax';

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
	const postsList = document.querySelector<HTMLElement>('.home-posts-list');
	if (!postsList) return;

	if (postsList.classList.contains('visible')) return;

	postsList.classList.add('home-stagger-ready');
	const reveal = () => postsList.classList.add('visible');

	if (!('IntersectionObserver' in window)) {
		reveal();
		return;
	}

	const postsObserver = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					reveal();
					postsObserver.disconnect();
				}
			}
		},
		{ threshold: 0.1 },
	);

	postsObserver.observe(postsList);

	// Fallback: never keep content hidden when observer timing fails.
	window.setTimeout(() => {
		if (!postsList.classList.contains('visible')) {
			reveal();
			postsObserver.disconnect();
		}
	}, 1200);
}

export function initHomePage() {
	setupParallax({
		desktopRise: 100,
		coarsePointerRise: 48,
		startAtHeroBottom: true,
		revealTarget: true,
	});
	setupCountUp();
	setupPostsStagger();
}

