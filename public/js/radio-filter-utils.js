export const RADIO_FILTER_KEYS = ['freq', 'sf', 'cr', 'bw'];

const UNKNOWN = 'unknown';
const KNOWN = 'known';

export const radioValue = (params, key) => {
	const value = Number(params?.[key]);
	if (!Number.isFinite(value) || value <= 0) return UNKNOWN;

	return String(key === 'freq' ? Math.floor(value) : value);
};

export const loadRadioFilters = saved => {
	const filters = {};

	for (const key of RADIO_FILTER_KEYS) {
		const selection = saved.radioFilters?.[key];
		filters[key] = Array.isArray(selection) ? selection.map(String) : null;
	}

	// Migracja ze starego formatu (freqFilter + includeUnknownFreq)
	if (!saved.radioFilters) {
		const frequencies = saved.freqFilter;

		if (Array.isArray(frequencies) && frequencies.length) {
			filters.freq = frequencies.map(String);
			if (saved.includeUnknownFreq !== false) filters.freq.push(UNKNOWN);
		} else if (saved.includeUnknownFreq === false) {
			filters.freq = [KNOWN];
		}
	}

	return filters;
};

export const isRadioValueSelected = (selection, value) => selection === null
	|| selection.includes(value)
	|| (selection.includes(KNOWN) && value !== UNKNOWN);

export const updateRadioSelection = (selection, availableValues, value, checked) => {
	const selected = new Set(selection ?? availableValues);

	// 'known' to skrót z migracji: rozwijamy go do konkretnych wartości
	if (selected.delete(KNOWN)) {
		for (const available of availableValues) {
			if (available !== UNKNOWN) selected.add(available);
		}
	}

	if (checked) selected.add(value);
	else selected.delete(value);

	// Pełny wybór to "brak filtra", żeby nowe wartości po odświeżeniu danych nie były domyślnie ukryte
	if (availableValues.size > 0 && [...availableValues].every(available => selected.has(available))) return null;

	return [...selected];
};

export const createRadioMatcher = filters => {
	// Wyłączone filtry (null) pomijamy, żeby nie liczyć nic dla każdego węzła
	const selections = RADIO_FILTER_KEYS
		.filter(key => filters[key] !== null)
		.map(key => [key, new Set(filters[key])]);

	// Przyjmuje wartości wyliczone wcześniej przez radioValue (node.radio), żeby nie liczyć ich przy każdym przebiegu
	return radio => selections.every(([key, values]) => {
		const value = radio[key];

		return values.has(value) || (values.has(KNOWN) && value !== UNKNOWN);
	});
};
