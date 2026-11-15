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

// Shortened keys from the API (msgpack) -> full field names.
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

// Status only applies to nodes from an automatic source (source starts with "u").
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

const yieldToEventLoop = () => new Promise(resolve => setTimeout(resolve, 0));

// Same result as prepareNodes, but hands the thread back every chunkSize nodes so a UI thread sharing it stays responsive.
export const prepareNodesAsync = async (rawNodes, { now = Date.now(), chunkSize = 2000, yieldTurn = yieldToEventLoop } = {}) => {
	const thresholds = createStatusThresholds(now);
	const index = createNodeIndex();

	for (let i = 0; i < rawNodes.length; i++) {
		prepareNode(rawNodes[i], thresholds);
		indexNode(index, rawNodes[i]);
		if ((i + 1) % chunkSize === 0) await yieldTurn();
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

const nameCollator = new Intl.Collator();

// The first `limit` matches in name order. Keeps a small sorted window instead of sorting every match (a one-letter query hits most of the map).
export const searchNodes = (nodes, query, limit = 20) => {
	const lower = query.toLowerCase();
	if (!lower || limit < 1) return [];

	const top = [];
	for (const node of nodes) {
		if (!node.adv_name.toLowerCase().includes(lower) && !node.public_key.startsWith(query)) continue;
		if (top.length === limit && nameCollator.compare(node.adv_name, top[limit - 1].adv_name) >= 0) continue;

		let index = top.length;
		while (index > 0 && nameCollator.compare(node.adv_name, top[index - 1].adv_name) < 0) index--;
		top.splice(index, 0, node);
		if (top.length > limit) top.pop();
	}

	return top;
};

const TIME_UNITS = [
	{ key: 'year', limit: 31536000 },
	{ key: 'month', limit: 2592000 },
	{ key: 'day', limit: 86400 },
	{ key: 'hour', limit: 3600 },
	{ key: 'minute', limit: 60 },
	{ key: 'second', limit: 1 },
];

// Returns { count, unit } or null when under a second; translating it is up to the caller.
export const timeAgoParts = (msec, now = Date.now()) => {
	const seconds = Math.floor((now - msec) / 1000);

	for (const unit of TIME_UNITS) {
		const count = Math.floor(seconds / unit.limit);
		if (count >= 1) return { count, unit: unit.key };
	}

	return null;
};

// "3 hours ago"; i18n is { t, tRaw, plural } from the caller (the website and the app each have their own).
export const formatTimeAgo = (msec, { t, tRaw, plural }) => {
	const ago = timeAgoParts(msec);
	if (!ago) return t('common:justNow');

	return t('common:timeAgo', { count: ago.count, unit: plural(ago.count, tRaw(`common:timeUnits.${ago.unit}`)) });
};

export const MS_PER_DAY = 86400000;

// Periods of the "new nodes" statistics (24h, 7d, 30d), in days.
export const STATS_PERIOD_DAYS = { '24h': 1, '7d': 7, '30d': 30 };

export const nodesInsertedSince = (nodes, days, now = Date.now()) => {
	const threshold = now - days * MS_PER_DAY;
	return nodes.filter(node => node.insertDate.getTime() > threshold);
};

export const countByType = nodes => {
	let clients = 0, repeaters = 0, roomServers = 0;
	for (const node of nodes) {
		if (node.type === 1) clients++;
		else if (node.type === 2) repeaters++;
		else if (node.type === 3) roomServers++;
	}

	return { clients, repeaters, roomServers };
};
