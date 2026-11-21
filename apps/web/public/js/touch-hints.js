import { showToast, dismissToast } from './toast.js';
import { escapeHtml } from './pathtools.js';

const HINT_SELECTOR = '.owner-tag[title], .param-chip[title]';
const HINT_DURATION_MS = 3500;

let current = null;

export const initTouchHints = () => {
	if (!window.matchMedia('(hover: none)').matches) return;

	document.addEventListener('click', e => {
		const tag = e.target.closest(HINT_SELECTOR);
		if (!tag) return;

		if (current?.isConnected) dismissToast(current);
		current = showToast(`<b>${escapeHtml(tag.textContent.trim())}</b> - ${escapeHtml(tag.title)}`, { status: 'info', duration: HINT_DURATION_MS });
	}, true);
};
