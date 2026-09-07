import { t } from './i18n.js';

const getContainer = () => document.getElementById('toast-container');

const renderToastContent = (el, message, status) => {
	el.className = `toast toast-${status}`;
	el.innerHTML = status === 'loading'
		? `<span class="toast-icon toast-icon-loading"><span class="toast-spinner"></span></span><span>${message}</span>`
		: `<span class="toast-icon"><svg class="icon" aria-hidden="true"><use href="/icons/toast-icons.svg#${status}"></use></svg></span><span>${message}</span>`;
};

export const dismissToast = el => {
	clearTimeout(el.dismissTimer);
	el.classList.remove('toast-visible');
	el.addEventListener('transitionend', () => el.remove(), { once: true });
};

const scheduleDismiss = (el, duration) => {
	clearTimeout(el.dismissTimer);
	el.dismissTimer = setTimeout(() => dismissToast(el), duration);
};

export const showToast = (message, { duration = 3000, status = 'success' } = {}) => {
	const el = document.createElement('div');
	renderToastContent(el, message, status);

	getContainer().appendChild(el);
	requestAnimationFrame(() => el.classList.add('toast-visible'));

	if (duration) scheduleDismiss(el, duration);
	return el;
};

export const updateToast = (el, message, { duration = 3000, status = 'success' } = {}) => {
	if (!el?.isConnected) return showToast(message, { duration, status });

	clearTimeout(el.dismissTimer);
	renderToastContent(el, message, status);
	el.classList.add('toast-visible');
	if (duration) scheduleDismiss(el, duration);
	return el;
};

export const showActionToast = (message, { status = 'info', onClose } = {}) => {
	const el = document.createElement('div');
	renderToastContent(el, message, status);
	el.classList.add('toast-closable');

	const closeBtn = document.createElement('button');
	closeBtn.type = 'button';
	closeBtn.className = 'toast-close-btn';
	closeBtn.setAttribute('aria-label', t('common:close'));
	closeBtn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="/icons/icons.svg#close"></use></svg>';
	closeBtn.addEventListener('click', () => {
		dismissToast(el);
		onClose?.();
	});
	el.appendChild(closeBtn);

	getContainer().appendChild(el);
	requestAnimationFrame(() => el.classList.add('toast-visible'));
	return el;
};
