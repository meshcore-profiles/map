export const RADIO_FILTER_KEYS = ['freq', 'sf', 'cr', 'bw'];

const UNKNOWN = 'unknown';

export const radioValue = (params, key) => {
	const value = Number(params?.[key]);
	if (!Number.isFinite(value) || value <= 0) return UNKNOWN;

	return String(key === 'freq' ? Math.floor(value) : value);
};

export const loadRadioFilters = saved => Object.fromEntries(RADIO_FILTER_KEYS.map(key => {
	const selection = saved.radioFilters?.[key];

	return [key, Array.isArray(selection) ? selection.map(String) : null];
}));

export const isRadioValueSelected = (selection, value) => selection === null || selection.includes(value);

export const updateRadioSelection = (selection, availableValues, value, checked) => {
	const selected = new Set(selection ?? availableValues);

	if (checked) selected.add(value);
	else selected.delete(value);

	if (availableValues.size > 0 && [...availableValues].every(available => selected.has(available))) return null;

	return [...selected];
};

export const createRadioMatcher = filters => {
	const selections = RADIO_FILTER_KEYS
		.filter(key => filters[key] !== null)
		.map(key => [key, new Set(filters[key])]);

	return radio => selections.every(([key, values]) => values.has(radio[key]));
};
