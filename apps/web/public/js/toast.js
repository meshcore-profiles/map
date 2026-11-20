import { toastDuration } from '/core/toast.js';
import { t } from './i18n.js';

const getContainer = () => document.getElementById('toast-container');

export const dismissToast = el => {
	clearTimeout(el.dismissTimer);
	el.classList.remove('toast-visible');
	el.addEventListener('transitionend', () => el.remove(), { once: true });
};

const createCloseButton = el => {
	const btn = document.createElement('button');
	btn.type = 'button';
	btn.className = 'toast-close-btn';
	btn.setAttribute('aria-label', t('common:close'));
	btn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="/icons/icons.svg#close"></use></svg>';
	btn.addEventListener('click', () => {
		dismissToast(el);
		el.onClose?.();
	});
	return btn;
};

// Every toast except "loading" (which the code dismisses itself) can be closed by hand.
const renderToastContent = (el, message, status) => {
	el.className = `toast toast-${status}`;
	el.innerHTML = status === 'loading'
		? `<span class="toast-icon toast-icon-loading"><span class="toast-spinner"></span></span><span>${message}</span>`
		: `<span class="toast-icon"><svg class="icon" aria-hidden="true"><use href="/icons/toast-icons.svg#${status}"></use></svg></span><span>${message}</span>`;

	if (status === 'loading') return;
	el.classList.add('toast-closable');
	el.appendChild(createCloseButton(el));
};

const scheduleDismiss = (el, duration) => {
	clearTimeout(el.dismissTimer);
	el.dismissTimer = setTimeout(() => dismissToast(el), duration);
};

// The timer stops while the pointer or focus is on the toast, so a long message can be read and the close button reached.
const PAUSE_RESUME_MS = 2000;
const bindPause = el => {
	const pause = () => clearTimeout(el.dismissTimer);
	const resume = () => {
		if (el.autoDismiss) scheduleDismiss(el, PAUSE_RESUME_MS);
	};
	el.addEventListener('mouseenter', pause);
	el.addEventListener('mouseleave', resume);
	el.addEventListener('focusin', pause);
	el.addEventListener('focusout', resume);
};

// Without "duration" the time follows the length of the message; 0 keeps the toast until it is updated or dismissed (loading).
export const showToast = (message, { duration = toastDuration(message), status = 'success' } = {}) => {
	const el = document.createElement('div');
	el.setAttribute('role', status === 'error' ? 'alert' : 'status');
	el.autoDismiss = Boolean(duration);
	renderToastContent(el, message, status);
	bindPause(el);

	getContainer().appendChild(el);
	requestAnimationFrame(() => el.classList.add('toast-visible'));

	if (duration) scheduleDismiss(el, duration);
	return el;
};

export const updateToast = (el, message, { duration = toastDuration(message), status = 'success' } = {}) => {
	if (!el?.isConnected) return showToast(message, { duration, status });

	clearTimeout(el.dismissTimer);
	el.autoDismiss = Boolean(duration);
	renderToastContent(el, message, status);
	el.classList.add('toast-visible');
	if (duration) scheduleDismiss(el, duration);
	return el;
};

// A toast that stays until the user closes it.
export const showActionToast = (message, { status = 'info', onClose } = {}) => {
	const el = showToast(message, { duration: 0, status });
	el.onClose = onClose;
	return el;
};
