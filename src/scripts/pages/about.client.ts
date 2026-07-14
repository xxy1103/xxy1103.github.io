import { setupParallax } from './parallax';

export function initAboutPage() {
	setupParallax({ desktopRise: 140, coarsePointerRise: 64, revealTarget: true });
}
