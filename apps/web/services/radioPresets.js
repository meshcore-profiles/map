import RedisClient from '../../../global/services/redis.js';

const CACHE_KEY = 'radioPresets:data';

export default async () => {
	const raw = await RedisClient.get(CACHE_KEY);
	return raw ? JSON.parse(raw) : [];
};
