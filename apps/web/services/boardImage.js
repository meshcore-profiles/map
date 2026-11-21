import RedisClient from '../../../global/services/redis.js';
import { MESHCORE_KEYS } from '../../../global/utils/redisKeys.js';
import { FLASHER_ORIGIN } from '../config/profiles.js';

const REFRESH_MS = 5 * 60 * 1000;
const IMAGE_SRC = /<img[^>]+src=['"](\/img\/[\w.-]+\.svg)['"]/i;
const TYPE_SUFFIX = /\((?:esp32|nrf52|rp2040|noflash)\)/gi;

// Same key as in meshcoreprofiles.com, so a model saved there resolves to the same board
const boardKey = model => String(model ?? '').toLowerCase().replace(TYPE_SUFFIX, '').replace(/[^a-z0-9]/g, '');

let images = new Map();
let loadedAt = 0;
let loading = null;

const load = async () => {
	try {
		const raw = await RedisClient.get(MESHCORE_KEYS.firmwares.data);
		const next = new Map();
		for (const device of JSON.parse(raw || '{}').device || []) {
			const src = IMAGE_SRC.exec(device?.tooltip || '')?.[1];
			if (src && device.name) next.set(boardKey(device.name), `${FLASHER_ORIGIN}${src}`);
		}
		if (next.size) images = next;
	} catch (err) {
		console.error('Cannot refresh the board images, keeping the previous ones:', err.message);
	} finally {
		loadedAt = Date.now();
		loading = null;
	}
};

const getBoardImage = async model => {
	if (!model) return null;
	if (Date.now() - loadedAt > REFRESH_MS) loading ??= load();
	if (!loadedAt || loading) await loading;
	return images.get(boardKey(model)) || null;
};

export default getBoardImage;
