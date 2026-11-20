import RedisClient from '../../../global/services/redis.js';
import { MESHCORE_KEYS } from '../../../global/utils/redisKeys.js';

const CACHE_KEY = MESHCORE_KEYS.radioPresets.data;

export default async () => {
	const raw = await RedisClient.get(CACHE_KEY);
	return raw ? JSON.parse(raw) : [];
};
