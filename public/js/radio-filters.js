import { t } from './i18n.js';
import { RADIO_FILTER_KEYS, isRadioValueSelected, updateRadioSelection } from './radio-filter-utils.js';

const valueLabel = (key, value) => {
	if (value === 'unknown') return t('filters:unknownFreq');
	if (key === 'freq') return `${value} MHz`;
	if (key === 'bw') return `${value} kHz`;
	if (key === 'sf') return `SF ${value}`;

	return `CR ${value}`;
};

const compareValues = (a, b) => {
	if (a === 'unknown') return 1;
	if (b === 'unknown') return -1;

	return Number(a) - Number(b);
};

const createChip = (key, value, checked) => {
	const label = document.createElement('label');
	label.className = 'filter-chip';
	if (value === 'unknown') {
		label.dataset.empty = '';
		label.title = t('filters:unknownHint');
	}

	const input = document.createElement('input');
	input.type = 'checkbox';
	input.value = value;
	input.checked = checked;

	const text = document.createElement('span');
	text.textContent = valueLabel(key, value);

	label.append(input, text);

	return label;
};

export const initRadioFilters = (state, { onChange } = {}) => {
	const groups = RADIO_FILTER_KEYS.map(key => {
		const element = document.getElementById(`${key}-filter-group`);

		return {
			key,
			element,
			list: document.getElementById(`${key}-filter-list`),
			count: element.querySelector('[data-count]'),
			selectAll: element.querySelector('[data-select="all"]'),
			selectNone: element.querySelector('[data-select="none"]'),
		};
	});

	const search = document.getElementById('freq-filter-search');
	const empty = document.getElementById('freq-filter-empty');
	const freqList = groups.find(group => group.key === 'freq').list;

	let options = Object.fromEntries(RADIO_FILTER_KEYS.map(key => [key, new Set()]));

	const updateGroup = group => {
		const values = [...options[group.key]];
		const selection = state.radioFilters[group.key];
		const selected = values.filter(value => isRadioValueSelected(selection, value)).length;

		group.count.textContent = `${selected}/${values.length}`;
		group.selectAll.disabled = selected === values.length;
		group.selectNone.disabled = selected === 0;
	};

	const searchFrequencies = () => {
		const query = search.value.trim().toLowerCase();
		const labels = [...freqList.children];

		for (const label of labels) {
			label.hidden = !label.textContent.toLowerCase().includes(query);
		}

		empty.hidden = labels.some(label => !label.hidden);
	};

	search.addEventListener('input', searchFrequencies);

	for (const group of groups) {
		group.list.addEventListener('change', event => {
			const input = event.target;
			if (!input.matches('input[type="checkbox"]')) return;

			state.radioFilters[group.key] = updateRadioSelection(
				state.radioFilters[group.key], options[group.key], input.value, input.checked
			);
			updateGroup(group);
			onChange?.();
		});

		group.element.querySelectorAll('[data-select]').forEach(button => {
			button.addEventListener('click', () => {
				const all = button.dataset.select === 'all';

				state.radioFilters[group.key] = all ? null : [];
				group.list.querySelectorAll('input').forEach(input => { input.checked = all; });
				updateGroup(group);
				onChange?.();
			});
		});
	}

	const render = (availableOptions = options) => {
		options = availableOptions;

		for (const group of groups) {
			const selection = state.radioFilters[group.key];
			const values = [...options[group.key]].sort(compareValues);

			group.element.hidden = values.length === 0;
			group.list.replaceChildren(...values.map(value => createChip(group.key, value, isRadioValueSelected(selection, value))));
			updateGroup(group);
		}

		searchFrequencies();
	};

	return { render };
};
