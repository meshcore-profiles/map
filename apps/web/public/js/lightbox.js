import { t } from './i18n.js';
import { escapeHtml } from './pathtools.js';

let active = null;

const close = () => {
	if (!active) return;

	active.controller.abort();
	active.root.remove();
	active.opener?.focus({ preventScroll: true });
	active = null;
};

const show = index => {
	const { items, root, img, counter } = active;
	active.index = (index + items.length) % items.length;
	img.src = items[active.index];
	counter.textContent = `${active.index + 1} / ${items.length}`;
	root.classList.add('is-loading');
};

const step = delta => {
	if (active && active.items.length > 1) show(active.index + delta);
};

export const openLightbox = (items, index = 0, opener = null) => {
	if (active || !items.length) return;

	const root = document.createElement('div');
	root.className = 'lightbox';
	root.setAttribute('role', 'dialog');
	root.setAttribute('aria-modal', 'true');
	root.classList.toggle('lightbox--single', items.length < 2);
	root.innerHTML = `
		<button type="button" class="lightbox__btn lightbox__close" data-lb="close" aria-label="${escapeHtml(t('common:close'))}"><svg class="icon" aria-hidden="true"><use href="/icons/icons.svg#close"></use></svg></button>
		<button type="button" class="lightbox__btn lightbox__nav lightbox__prev" data-lb="prev" aria-label="${escapeHtml(t('map:ownerCard.prevPhoto'))}"><svg class="icon" aria-hidden="true"><use href="/icons/icons.svg#chevron-left"></use></svg></button>
		<img class="lightbox__img" alt="">
		<button type="button" class="lightbox__btn lightbox__nav lightbox__next" data-lb="next" aria-label="${escapeHtml(t('map:ownerCard.nextPhoto'))}"><svg class="icon" aria-hidden="true"><use href="/icons/icons.svg#chevron-right"></use></svg></button>
		<span class="lightbox__counter"></span>`;

	const controller = new AbortController();
	const { signal } = controller;
	const img = root.querySelector('.lightbox__img');
	img.addEventListener('load', () => root.classList.remove('is-loading'), { signal });
	img.addEventListener('error', () => root.classList.remove('is-loading'), { signal });

	root.addEventListener('click', e => {
		const action = e.target.closest('[data-lb]')?.dataset.lb;
		if (action === 'close' || e.target === root) close();
		else if (action === 'prev') step(-1);
		else if (action === 'next') step(1);
	}, { signal });

	document.addEventListener('keydown', e => {
		if (e.key === 'Escape') close();
		else if (e.key === 'ArrowLeft') step(-1);
		else if (e.key === 'ArrowRight') step(1);
		else return;
		e.stopPropagation();
	}, { signal, capture: true });

	active = { items, index, root, img, counter: root.querySelector('.lightbox__counter'), opener, controller };
	document.body.append(root);
	show(index);
	root.querySelector('.lightbox__close').focus({ preventScroll: true });
};
