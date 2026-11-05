import { RADIO_FILTER_KEYS } from './radio-filter-utils.js';

const NODE_TYPES = ['1', '2', '3', '4'];
const DEFAULT_CLUSTERING_ZOOM = 11;
const MIN_CLUSTERING_ZOOM = 10;
const MAX_CLUSTERING_ZOOM = 17;
const MAX_LIST_ITEMS = 200;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RADIO_TOKEN_PATTERN = /^(?:\d{1,5}(?:\.\d{1,3})?|unknown|known)$/;
const REGIONS = ['pl', 'all'];

const SHARE_KEYS = ['types', 'updated', 'added', 'cluster', 'region', ...RADIO_FILTER_KEYS];

const parseList = (value, isValid) => {
	const items = String(value).split(',').map(item => item.trim()).filter(isValid);

	return [...new Set(items)].slice(0, MAX_LIST_ITEMS);
};

const parseDate = value => {
	if (!DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) return '';

	return value;
};

// Zapisuje tylko wartości różne od domyślnych, żeby link był krótki
export const buildFilterParams = (state, { includeRegion = false } = {}) => {
	const params = new URLSearchParams();

	if (state.nodeFilter.length !== NODE_TYPES.length) params.set('types', state.nodeFilter.join(','));

	for (const key of RADIO_FILTER_KEYS) {
		const selection = state.radioFilters[key];
		if (selection !== null) params.set(key, selection.join(','));
	}

	if (state.fromDate) params.set('updated', state.fromDate);
	if (state.fromInsertDate) params.set('added', state.fromInsertDate);
	if (state.clusteringZoom !== DEFAULT_CLUSTERING_ZOOM) params.set('cluster', state.clusteringZoom);
	if (includeRegion) params.set('region', state.region);

	return params;
};

// Zwraca null, gdy w URL nie ma żadnego parametru filtrów. Brakujące parametry oznaczają wartość domyślną,
// dzięki czemu link pokazuje dokładnie to, co widział nadawca, a nie to, co odbiorca ma w localStorage.
export const parseSharedFilters = params => {
	if (!SHARE_KEYS.some(key => key in params)) return null;

	const radioFilters = {};
	for (const key of RADIO_FILTER_KEYS) {
		if (key in params) radioFilters[key] = parseList(params[key], item => RADIO_TOKEN_PATTERN.test(item));
	}

	const clusteringZoom = Number(params.cluster);
	const validZoom = Number.isInteger(clusteringZoom)
		&& clusteringZoom >= MIN_CLUSTERING_ZOOM
		&& clusteringZoom <= MAX_CLUSTERING_ZOOM;

	return {
		nodeFilter: 'types' in params ? parseList(params.types, item => NODE_TYPES.includes(item)) : [...NODE_TYPES],
		radioFilters,
		fromDate: parseDate(params.updated ?? ''),
		fromInsertDate: parseDate(params.added ?? ''),
		clusteringZoom: validZoom ? clusteringZoom : DEFAULT_CLUSTERING_ZOOM,
		region: REGIONS.includes(params.region) ? params.region : null,
	};
};
