import { MS_PER_DAY, STATS_PERIOD_DAYS, nodesInsertedSince } from '/core/nodes.js';
import { t } from './i18n.js';
import { initModal } from './modal.js';

const LIST_CHUNK = 40;

export const initStatsModal = ({ getNodes, getRepeaters, escapeHtml, timeAgo, onFocusNode, onShowOnMap }) => {
	const modal = initModal('stats-toggle', 'stats-overlay');
	const chipEls = {
		'24h': document.getElementById('stats-chip-24h'),
		'7d': document.getElementById('stats-chip-7d'),
		'30d': document.getElementById('stats-chip-30d'),
	};
	const periodButtons = [...document.querySelectorAll('.stats-period-btn')];
	const listEl = document.getElementById('stats-repeater-list');
	const periodGroupEl = document.getElementById('stats-period-group');
	const rangeInputsEl = document.getElementById('stats-range-inputs');
	const rangeBackBtn = document.getElementById('stats-range-back-btn');
	const rangeFromEl = document.getElementById('stats-range-from');
	const rangeToEl = document.getElementById('stats-range-to');
	const showOnMapBtn = document.getElementById('stats-show-on-map-btn');

	rangeToEl.value = new Date().toLocaleDateString('sv-SE');

	let activePeriod = '24h';
	let currentRepeaters = [];
	let renderedCount = 0;

	const getActiveRange = () => {
		if (activePeriod !== 'custom') return { from: Date.now() - STATS_PERIOD_DAYS[activePeriod] * MS_PER_DAY, to: Date.now() };

		const from = rangeFromEl.value ? new Date(`${rangeFromEl.value}T00:00:00`).getTime() : -Infinity;
		const to = rangeToEl.value ? new Date(`${rangeToEl.value}T23:59:59.999`).getTime() : Date.now();
		return { from, to };
	};

	// Rows are added in chunks as the list is scrolled, so a long period does not create hundreds of DOM nodes at once.
	const renderChunk = () => {
		if (renderedCount >= currentRepeaters.length) return;

		const end = Math.min(renderedCount + LIST_CHUNK, currentRepeaters.length);
		let html = '';
		for (let i = renderedCount; i < end; i++) {
			const node = currentRepeaters[i];
			html += `<li data-index="${i}"><svg width="28" height="28"><use href="/icons/node-types.svg#repeater-plain"></use></svg><div class="stats-repeater-text"><h6>${escapeHtml(node.adv_name)}</h6><span>${timeAgo(node.insertDate.getTime())}</span></div></li>`;
		}

		listEl.insertAdjacentHTML('beforeend', html);
		renderedCount = end;
	};

	const renderList = () => {
		const { from, to } = getActiveRange();
		const repeaters = getRepeaters()
			.filter(node => node.insertDate.getTime() > from && node.insertDate.getTime() <= to)
			.toSorted((a, b) => b.insertDate.getTime() - a.insertDate.getTime());

		currentRepeaters = repeaters;
		showOnMapBtn.disabled = repeaters.length === 0;
		renderedCount = 0;
		listEl.scrollTop = 0;

		if (!repeaters.length) {
			listEl.innerHTML = `<li class="stats-repeater-empty">${t('stats:noRepeatersInPeriod')}</li>`;
			return;
		}

		listEl.replaceChildren();
		renderChunk();
	};

	listEl.addEventListener('scroll', () => {
		if (listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 200) renderChunk();
	}, { passive: true });

	listEl.addEventListener('click', e => {
		const node = currentRepeaters[e.target.closest('li[data-index]')?.dataset.index];
		if (!node) return;

		modal.close();
		onFocusNode(node);
	});

	const render = () => {
		const nodes = getNodes();
		for (const [period, el] of Object.entries(chipEls)) {
			el.textContent = nodesInsertedSince(nodes, STATS_PERIOD_DAYS[period]).length;
		}
		renderList();
	};

	periodButtons.forEach(btn => {
		btn.addEventListener('click', () => {
			activePeriod = btn.dataset.period;
			periodButtons.forEach(b => b.classList.toggle('active', b === btn));
			if (activePeriod === 'custom') {
				periodGroupEl.hidden = true;
				rangeInputsEl.hidden = false;
			}
			renderList();
		});
	});

	rangeBackBtn.addEventListener('click', () => {
		activePeriod = '24h';
		periodButtons.forEach(b => b.classList.toggle('active', b.dataset.period === '24h'));
		periodGroupEl.hidden = false;
		rangeInputsEl.hidden = true;
		renderList();
	});

	rangeFromEl.addEventListener('change', renderList);
	rangeToEl.addEventListener('change', renderList);

	showOnMapBtn.addEventListener('click', () => {
		modal.close();
		onShowOnMap(currentRepeaters);
	});

	return { ...modal, render };
};
