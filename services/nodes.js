const { RESP_TYPES } = require('redis');
const { unpack } = require('msgpackr');
const RedisClient = require('../global/services/redis.js');

const REDIS_KEYS = { all: 'nodes:all', pl: 'nodes:pl', updatedAt: 'nodes:updatedAt' };

const REPEATER_TYPE = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
const EXTINCT_AFTER_MS = 20 * DAY_MS;
const OLD_AFTER_MS = 10 * DAY_MS;
const STALE_AFTER_MS = 5 * DAY_MS;
const NODE_TYPE_NAMES = new Map([[1, 'client'], [2, 'repeater'], [3, 'roomServer'], [4, 'sensor']]);

const typedRedisClient = RedisClient.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer });
const warsawDateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' });
const formatWarsawDate = date => warsawDateFormatter.format(date);

// The node data itself is fetched, filtered and cached into Redis by the meshcore-profiles/cronjobs
// worker (jobs/nodes-refresh.js), on its own schedule - this app only ever reads that cache.
const statsCache = { all: null, pl: null };

const getCachedNodes = (region = 'pl') => {
	const key = REDIS_KEYS[region] ? region : 'pl';
	return typedRedisClient.get(REDIS_KEYS[key]);
};

const getLastRefreshedAt = async () => {
	const value = await RedisClient.get(REDIS_KEYS.updatedAt);
	return value ? new Date(value) : null;
};

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

// Memoized per region, invalidated whenever the cronjobs worker's last refresh timestamp moves on -
// cheaper than recomputing stats from the full node set on every request.
const ensureStatsComputed = async (region, lastRefreshedAt) => {
	const cached = statsCache[region];
	if (cached && cached.refreshedAtMs === (lastRefreshedAt ? lastRefreshedAt.getTime() : null)) return cached.stats;

	const buffer = await getCachedNodes(region);
	if (!buffer) return null;

	const stats = computeStats(unpack(buffer));
	statsCache[region] = { refreshedAtMs: lastRefreshedAt ? lastRefreshedAt.getTime() : null, stats };
	return stats;
};

const getStats = async (region = 'pl') => {
	const lastRefreshedAt = await getLastRefreshedAt();
	const computed = await ensureStatsComputed(region, lastRefreshedAt);
	if (!computed) return null;

	return { ...computed, lastRefreshedAt: lastRefreshedAt ? lastRefreshedAt.toISOString() : null };
};

module.exports = { getCachedNodes, getLastRefreshedAt, getStats, formatWarsawDate };
