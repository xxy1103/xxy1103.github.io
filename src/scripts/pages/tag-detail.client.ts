import { setupParallax } from './parallax';
import { initTagSearch } from './tag-search';

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

export function initTagDetailPage() {
	setupBackLinkMagnet();
	setupParallax({ desktopRise: 180, coarsePointerRise: 72 });
	initTagSearch('detail');
}
