export type SearchCloseReason = 'dismiss' | 'navigate';

const EXIT_DURATION_MS = 320;

export class SearchDialog {
	private previousFocus: HTMLElement | null = null;
	private closeTimer: number | null = null;
	private openState = false;

	constructor(
		private readonly root: HTMLElement,
		private readonly input: HTMLInputElement,
		private readonly onClosed: () => void,
	) {}

	get isOpen() {
		return this.openState;
	}

	open(trigger?: HTMLElement | null) {
		if (this.closeTimer !== null) {
			window.clearTimeout(this.closeTimer);
			this.closeTimer = null;
		}
		this.previousFocus = trigger ?? (document.activeElement as HTMLElement | null);
		this.openState = true;
		this.setBackgroundInert(true);
		this.root.classList.remove('closing');
		this.root.classList.add('active');
		this.root.setAttribute('aria-hidden', 'false');
		this.input.setAttribute('aria-expanded', 'true');
		this.input.focus();
	}

	close(reason: SearchCloseReason = 'dismiss') {
		if (!this.openState) return;
		this.openState = false;
		this.root.classList.add('closing');
		this.root.setAttribute('aria-hidden', 'true');
		this.input.setAttribute('aria-expanded', 'false');
		this.setBackgroundInert(false);
		if (reason === 'dismiss') this.previousFocus?.focus();

		if (this.closeTimer !== null) window.clearTimeout(this.closeTimer);
		this.closeTimer = window.setTimeout(() => {
			this.root.classList.remove('active', 'closing');
			this.closeTimer = null;
			this.onClosed();
		}, EXIT_DURATION_MS);
	}

	trapTab(event: KeyboardEvent) {
		const candidates: Array<HTMLElement | null> = [
			this.input,
			this.root.querySelector<HTMLButtonElement>('#search-close'),
			this.root.querySelector<HTMLButtonElement>('[data-search-retry]'),
		];
		const focusable = candidates.filter((element): element is HTMLElement => Boolean(element && !element.hidden));
		if (focusable.length === 0) return;

		const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
		const direction = event.shiftKey ? -1 : 1;
		const nextIndex = currentIndex < 0
			? 0
			: (currentIndex + direction + focusable.length) % focusable.length;
		event.preventDefault();
		focusable[nextIndex]?.focus();
	}

	destroy() {
		if (this.closeTimer !== null) window.clearTimeout(this.closeTimer);
		this.setBackgroundInert(false);
	}

	private setBackgroundInert(inert: boolean) {
		for (const element of [document.querySelector<HTMLElement>('header'), document.getElementById('main-content')]) {
			if (element) element.inert = inert;
		}
	}
}
