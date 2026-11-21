import getBoardImage from './boardImage.js';
import User from '../../../global/database/models/user.model.js';
import PROFILE_VISIBILITY from '../../../global/utils/profileVisibility.js';

const { PUBLIC, NOINDEX } = PROFILE_VISIBILITY;

const PUBLIC_KEY_REGEX = /^[0-9a-f]{64}$/;
const NOTE_PREVIEW_MAX = 240;
const WEBSITES_MAX = 3;
const PHOTOS_MAX = 5;
const CACHE_TTL = 60 * 1000;
const CACHE_MAX = 500;
const KEYS_TTL = 5 * 60 * 1000;

const PROJECTION = {
	slug: 1,
	username: 1,
	createdAt: 1,
	'verification.status': 1,
	'profile.avatar.path': 1,
	'profile.avatar.colors.dominant': 1,
	'profile.networkSince': 1,
	'profile.location': 1,
	'profile.region': 1,
	companions: 1,
	devices: 1,
	websites: 1,
};

const cache = new Map();

const VISIBLE = {
	'profile.onboarded': true,
	banned: false,
	'profile.visibility': { $in: [PUBLIC, NOINDEX] },
	slug: { $type: 'string' },
};

const isApproved = item => item.public && item.verification?.status === 'approved';

const match = publicKey => ({ publicKey, public: true, 'verification.status': 'approved' });

const cleanModel = model => (model ? model.replace(/\s*\((?:esp32|nrf52|rp2040|noflash)\)/gi, '').trim() || null : null);

const preview = (text, max) => {
	const flat = String(text)
		.replace(/!\[[^\]]*]\([^)]*\)/g, '')
		.replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
		.replace(/^:::.*$/gm, '')
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/[*_~`>]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
};

const build = (user, publicKey, boardImage) => {
	const companion = user.companions.find(c => c.publicKey === publicKey);
	const device = user.devices.find(d => d.publicKey === publicKey);
	const node = companion || device;
	const main = user.companions.find(c => c.main) || user.companions[0];
	const path = companion ? (companion.main ? '' : `/companions/${companion._id}`) : `/devices/${device._id}`;
	const location = user.profile?.location || {};

	return {
		owner: {
			slug: user.slug,
			nick: main?.name || user.username,
			avatar: user.profile?.avatar?.path || null,
			accent: user.profile?.avatar?.colors?.dominant || null,
			city: location.city || null,
			country: location.countryName || null,
			countryIso2: location.countryIso2 || null,
			memberSince: (user.profile?.networkSince || user.createdAt)?.toISOString() || null,
			counts: {
				companions: user.companions.filter(isApproved).length,
				repeaters: user.devices.filter(d => d.kind === 'repeater' && isApproved(d)).length,
				roomServers: user.devices.filter(d => d.kind === 'roomServer' && isApproved(d)).length,
			},
			websites: user.websites.filter(w => w.public && w.verified).slice(0, WEBSITES_MAX).map(w => w.domain),
		},
		node: {
			name: node.name,
			kind: device ? device.kind : 'companion',
			model: cleanModel(node.model),
			boardImage,
			photos: (node.photos || []).slice(0, PHOTOS_MAX).map(({ path: src, width, height }) => ({ path: src, width, height })),
			antenna: node.antenna?.name || null,
			gain: node.antenna?.gain ?? null,
			antennaType: device?.antenna?.type || null,
			heading: device?.antenna?.type === 'dir' ? device.antenna.heading ?? null : null,
			height: device?.antenna?.height ?? null,
			txPower: node.txPower ?? null,
			pathHash: node.pathHash ?? null,
			powerSource: device?.powerSource || null,
			power: device?.power || null,
			solarPanel: device?.powerSource === 'solar' ? device.solarPanel ?? null : null,
			battery: device?.battery ?? null,
			note: node.note ? preview(node.note, NOTE_PREVIEW_MAX) : null,
			path,
		},
	};
};

const find = async publicKey => {
	const user = await User.findOne({
		...VISIBLE,
		$or: [{ companions: { $elemMatch: match(publicKey) } }, { devices: { $elemMatch: match(publicKey) } }],
	}, PROJECTION).lean();

	if (!user) return null;

	const node = user.companions.find(c => c.publicKey === publicKey) || user.devices.find(d => d.publicKey === publicKey);
	return build(user, publicKey, await getBoardImage(node.model));
};

let keys = { value: new Set(), expires: 0 };
let keysLoading = null;

const loadKeys = async () => {
	const users = await User.find({
		...VISIBLE,
		$or: [{ companions: { $elemMatch: { public: true, 'verification.status': 'approved' } } }, { devices: { $elemMatch: { public: true, 'verification.status': 'approved' } } }],
	}, { 'companions.publicKey': 1, 'companions.public': 1, 'companions.verification.status': 1, 'devices.publicKey': 1, 'devices.public': 1, 'devices.verification.status': 1 }).lean();

	const value = new Set();
	for (const user of users) {
		for (const item of [...user.companions, ...user.devices]) {
			if (isApproved(item) && item.publicKey) value.add(item.publicKey);
		}
	}
	return value;
};

// Public keys of all nodes that have an approved profile page; refreshed at most every KEYS_TTL, a failed refresh keeps the previous set
export const getProfileKeys = async () => {
	if (keys.expires > Date.now()) return keys.value;

	keysLoading ??= loadKeys()
		.then(value => {
			keys = { value, expires: Date.now() + KEYS_TTL };
		})
		.catch(err => {
			if (!keys.expires) throw err;
			console.error('Cannot refresh the profile keys, keeping the previous ones:', err.message);
			keys = { ...keys, expires: Date.now() + 30 * 1000 };
		})
		.finally(() => {
			keysLoading = null;
		});

	await keysLoading;
	return keys.value;
};

const getNodeProfile = async rawKey => {
	const publicKey = String(rawKey).toLowerCase();
	if (!PUBLIC_KEY_REGEX.test(publicKey)) return undefined;
	if (!(await getProfileKeys()).has(publicKey)) return null;

	const hit = cache.get(publicKey);
	if (hit && hit.expires > Date.now()) return hit.value;

	const value = await find(publicKey);
	if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
	cache.set(publicKey, { value, expires: Date.now() + CACHE_TTL });
	return value;
};

export default getNodeProfile;
