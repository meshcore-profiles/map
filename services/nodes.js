const fs = require('node:fs');
const path = require('node:path');
const { RESP_TYPES } = require('redis');
const { pack, unpack } = require('msgpackr');
const axios = require('./axios.js');
const RedisClient = require('./redis.js');
const { simplifyRing, getBoundingBox, isPointInPolygon } = require('../utils/geo.js');

const UPSTREAM_URL = 'https://map.meshcore.dev/api/v1/nodes?binary=1&short=1';
const REDIS_KEYS = { all: 'mmc:nodes:all', pl: 'mmc:nodes:pl' };
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const RETRY_DELAY_MS = 30 * 1000;
const BORDER_SIMPLIFY_TOLERANCE_DEG = 0.0002; // ~22 m przy szerokości geograficznej Polski

// Pełna granica administracyjna Polski [lon, lat] (źródło: https://nominatim.openstreetmap.org/search?country=poland&polygon_geojson=1&format=geojson&polygon_threshold=0)
const polandBorder = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/poland-border.geojson'), 'utf8'));

// Surowy pierścień ma ~67 tys. punktów - ray-casting po nim dla każdego węzła jest wielokrotnie wolniejszy
// niż po wersji uproszczonej, a różnica w klasyfikacji dotyczy tylko punktów dosłownie na granicy
const POLAND_POLYGON = simplifyRing(polandBorder.features[0].geometry.coordinates[0], BORDER_SIMPLIFY_TOLERANCE_DEG);

// Prostokąt otaczający granicę Polski - szybki wstępny filtr, żeby uniknąć drogiego ray-castingu dla węzłów daleko poza Polską
const POLAND_BBOX = getBoundingBox(POLAND_POLYGON);

const isInPoland = ({ lat, lon }) => {
	if (lat < POLAND_BBOX.latMin || lat > POLAND_BBOX.latMax || lon < POLAND_BBOX.lonMin || lon > POLAND_BBOX.lonMax) return false;
	return isPointInPolygon(lat, lon, POLAND_POLYGON);
};

const REPEATER_TYPE = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
const EXTINCT_AFTER_MS = 20 * DAY_MS;
const OLD_AFTER_MS = 10 * DAY_MS;
const STALE_AFTER_MS = 5 * DAY_MS;
const NODE_TYPE_NAMES = new Map([[1, 'client'], [2, 'repeater'], [3, 'roomServer'], [4, 'sensor']]);

const typedRedisClient = RedisClient.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer });
const warsawDateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' });
const formatWarsawDate = date => warsawDateFormatter.format(date);

// Bufory trzymane w pamięci tego procesu - unika round-tripu do Redisa przy każdym żądaniu do /api/v1/nodes.
// Redis pozostaje jako trwały cache, z którego korzystamy, dopóki proces nie wykona własnego pierwszego odświeżenia (np. tuż po restarcie)
const memoryCache = { all: null, pl: null };
let lastRefreshedAt = null;
const statsCache = { all: null, pl: null };

const refreshNodes = async () => {
	const startedAt = Date.now();
	let allBuffer, plBuffer;

	try {
		const { data } = await axios.get(UPSTREAM_URL, { responseType: 'arraybuffer' });
		allBuffer = Buffer.from(data);
		plBuffer = pack(unpack(allBuffer).filter(isInPoland));
	} catch (err) {
		console.error('[refreshNodes] Failed to fetch nodes from upstream:', err.message || err.stack);
		return false;
	}

	memoryCache.all = allBuffer;
	memoryCache.pl = plBuffer;
	lastRefreshedAt = new Date();
	statsCache.all = null;
	statsCache.pl = null;

	// Redis to trwały cache współdzielony między restartami procesu - jego awaria nie powinna
	// windować odświeżania z upstreamu do rytmu RETRY_DELAY_MS, skoro dane w pamięci już są świeże
	try {
		await Promise.all([
			RedisClient.set(REDIS_KEYS.all, allBuffer),
			RedisClient.set(REDIS_KEYS.pl, plBuffer),
		]);
	} catch (err) {
		console.error('[refreshNodes] Failed to persist cache to Redis:', err.message || err.stack);
	}

	if (process.env.NODE_ENV !== 'production') console.log(`[refreshNodes] Cache refreshed (all: ${allBuffer.byteLength} bytes, pl: ${plBuffer.byteLength} bytes) in ${Date.now() - startedAt}ms`);
	return true;
};

const getCachedNodes = async (region = 'pl') => {
	const key = REDIS_KEYS[region] ? region : 'pl';
	if (memoryCache[key]) return memoryCache[key];

	return typedRedisClient.get(REDIS_KEYS[key]);
};

const getLastRefreshedAt = () => lastRefreshedAt;

const getNodeStatus = node => {
	if (node.s?.[0] !== 'u') return 'none';

	const age = Date.now() - new Date(node.ud).getTime();
	if (age >= EXTINCT_AFTER_MS) return 'extinct';
	if (age >= OLD_AFTER_MS) return 'old';
	if (age >= STALE_AFTER_MS) return 'stale';
	return 'recent';
};

const computeStats = nodes => {
	const typeCounts = new Map();
	const statusCounts = new Map();

	for (const node of nodes) {
		const typeName = NODE_TYPE_NAMES.get(node.t);
		if (typeName) typeCounts.set(typeName, (typeCounts.get(typeName) || 0) + 1);
		if (node.t !== REPEATER_TYPE) continue;

		const status = getNodeStatus(node);
		statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
	}

	const types = { client: 0, repeater: 0, roomServer: 0, sensor: 0, ...Object.fromEntries(typeCounts) };
	const status = { recent: 0, stale: 0, old: 0, extinct: 0, none: 0, ...Object.fromEntries(statusCounts) };

	return { total: types.repeater, active: status.recent, nodes: nodes.length, types, status };
};

const ensureStatsComputed = async region => {
	if (statsCache[region]) return statsCache[region];

	const buffer = await getCachedNodes(region);
	if (!buffer) return null;

	statsCache[region] = computeStats(unpack(buffer));
	return statsCache[region];
};

const getStats = async (region = 'pl') => {
	const computed = await ensureStatsComputed(region);
	if (!computed) return null;

	return { ...computed, lastRefreshedAt: lastRefreshedAt ? lastRefreshedAt.toISOString() : null };
};

const startNodesRefreshJob = () => {
	const tick = async () => {
		const refreshed = await refreshNodes();
		setTimeout(tick, refreshed ? REFRESH_INTERVAL_MS : RETRY_DELAY_MS);
	};

	void tick();
};

module.exports = { refreshNodes, getCachedNodes, getLastRefreshedAt, getStats, formatWarsawDate, startNodesRefreshJob };
