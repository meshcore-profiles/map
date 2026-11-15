import { bytesToHex } from './node-utils.js';
import { createRadioMatcher, RADIO_FILTER_KEYS, radioValue } from './radio-filter-utils.js';

export const NODE_TYPES = ['1', '2', '3', '4'];
export const NODE_TYPE_KEYS = { 1: 'client', 2: 'repeater', 3: 'roomServer', 4: 'sensor' };
export const CONTACT_ADDABLE_TYPES = [1, 2, 3];
export const NODE_STATUSES = ['none', 'recent', 'stale', 'old', 'extinct'];

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 5;
const OLD_DAYS = 10;
const EXTINCT_DAYS = 20;

// Skrocone klucze z API (msgpack) -> pelne nazwy pol.
const NODE_KEYS = {
	pk: { key: 'public_key', convert: bytesToHex },
	t: { key: 'type' },
	n: { key: 'adv_name' },
	la: { key: 'last_advert' },
	id: { key: 'inserted_date' },
	ud: { key: 'updated_date' },
	p: { key: 'params' },
	l: { key: 'link' },
	s: { key: 'source' },
};

export const inflateNode = node => {
	for (const key of Object.keys(node)) {
		const spec = NODE_KEYS[key];
		if (!spec) continue;

		node[spec.key] = spec.convert ? spec.convert(node[key]) : node[key];
		delete node[key];
	}
};

export const createStatusThresholds = (now = Date.now()) => ({
	stale: now - STALE_DAYS * DAY_MS,
	old: now - OLD_DAYS * DAY_MS,
	extinct: now - EXTINCT_DAYS * DAY_MS,
});

// Status liczy sie tylko dla wezlow z automatycznego zrodla (source zaczyna sie od "u").
export const getNodeUpdateStatus = (node, thresholds) => {
	if (node.source[0] !== 'u') return 'none';

	const updated = new Date(node.updated_date).getTime();
	if (updated < thresholds.extinct) return 'extinct';
	if (updated < thresholds.old) return 'old';
	if (updated < thresholds.stale) return 'stale';
	return 'recent';
};

export const prepareNode = (node, thresholds) => {
	inflateNode(node);

	node.radio = {};
	for (const key of RADIO_FILTER_KEYS) node.radio[key] = radioValue(node.params, key);

	node.status = getNodeUpdateStatus(node, thresholds);
	node.preset = node.params;
	node.coords = `${Number(node.lat.toFixed(6))}, ${Number(node.lon.toFixed(6))}`;
	node.lastAdvertDate = new Date(node.last_advert);
	node.insertDate = new Date(node.inserted_date);
	node.updatedDate = node.updated_date && new Date(node.updated_date);

	return node;
};

export const createNodeIndex = () => ({
	byType: {},
	radioOptions: Object.fromEntries(RADIO_FILTER_KEYS.map(key => [key, new Set()])),
});

export const indexNode = (index, node) => {
	(index.byType[node.type] ??= []).push(node);
	for (const key of RADIO_FILTER_KEYS) index.radioOptions[key].add(node.radio[key]);
};

export const prepareNodes = (rawNodes, now = Date.now()) => {
	const thresholds = createStatusThresholds(now);
	const index = createNodeIndex();

	for (const node of rawNodes) {
		prepareNode(node, thresholds);
		indexNode(index, node);
	}

	return { nodes: rawNodes, ...index };
};

export const createDefaultFilters = () => ({
	nodeFilter: [...NODE_TYPES],
	radioFilters: Object.fromEntries(RADIO_FILTER_KEYS.map(key => [key, null])),
	fromDate: '',
	fromInsertDate: '',
	clusteringZoom: 11,
});

export const collectFilteredNodes = (filters, byType) => {
	const fromDate = new Date(filters.fromDate);
	const fromInsertDate = new Date(filters.fromInsertDate);
	const matchesRadio = createRadioMatcher(filters.radioFilters);

	const result = [];
	for (const type of filters.nodeFilter) {
		const typeNodes = byType[type];
		if (!typeNodes) continue;

		for (const node of typeNodes) {
			if (node.updatedDate ? node.updatedDate <= fromDate : node.insertDate <= fromDate) continue;
			if (node.insertDate <= fromInsertDate) continue;
			if (!matchesRadio(node.radio)) continue;
			result.push(node);
		}
	}

	return result;
};

export const searchNodes = (nodes, query, limit = 20) => {
	const lower = query.toLowerCase();
	if (!lower) return [];

	return nodes
		.filter(node => node.adv_name.toLowerCase().includes(lower) || node.public_key.startsWith(query))
		.toSorted((a, b) => a.adv_name.localeCompare(b.adv_name))
		.slice(0, limit);
};

const TIME_UNITS = [
	{ key: 'year', limit: 31536000 },
	{ key: 'month', limit: 2592000 },
	{ key: 'day', limit: 86400 },
	{ key: 'hour', limit: 3600 },
	{ key: 'minute', limit: 60 },
	{ key: 'second', limit: 1 },
];

// Zwraca { count, unit } albo null gdy mniej niz sekunda - tlumaczenie nalezy do wywolujacego.
export const timeAgoParts = (msec, now = Date.now()) => {
	const seconds = Math.floor((now - msec) / 1000);

	for (const unit of TIME_UNITS) {
		const count = Math.floor(seconds / unit.limit);
		if (count >= 1) return { count, unit: unit.key };
	}

	return null;
};
