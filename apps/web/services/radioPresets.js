const RedisClient = require('../global/services/redis.js');

const CACHE_KEY = 'radioPresets:data';

module.exports = async () => {
	const raw = await RedisClient.get(CACHE_KEY);
	return raw ? JSON.parse(raw) : [];
};
