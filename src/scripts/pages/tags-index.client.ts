import { setupParallax } from './parallax';
import { initTagSearch } from './tag-search';

function setupMagneticTags() {
	const tags = document.querySelectorAll<HTMLElement>('.tag');
	const isCoarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
	if (isCoarsePointer) return;

	tags.forEach((tag) => {
		const tagAny = tag as HTMLElement & {
			__magneticMoveHandler?: (event: MouseEvent) => void;
			__magneticLeaveHandler?: () => void;
		};

		if (tagAny.__magneticMoveHandler) {
			tag.removeEventListener('mousemove', tagAny.__magneticMoveHandler);
		}
		if (tagAny.__magneticLeaveHandler) {
			tag.removeEventListener('mouseleave', tagAny.__magneticLeaveHandler);
		}

		tagAny.__magneticMoveHandler = (e: MouseEvent) => {
			const rect = tag.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			const centerX = rect.width / 2;
			const centerY = rect.height / 2;
			const deltaX = (x - centerX) * 0.3;
			const deltaY = (y - centerY) * 0.3;
			tag.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.05)`;
		};

		tagAny.__magneticLeaveHandler = () => {
			tag.style.transform = '';
		};

		tag.addEventListener('mousemove', tagAny.__magneticMoveHandler);
		tag.addEventListener('mouseleave', tagAny.__magneticLeaveHandler);
	});
}

export function initTagsIndexPage() {
	setupMagneticTags();
	setupParallax({ desktopRise: 180, coarsePointerRise: 72 });
	initTagSearch('index');
}
