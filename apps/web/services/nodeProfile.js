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

const isApproved = item => item.public && item.verification?.status === 'approved';

const match = publicKey => ({ publicKey, public: true, 'verification.status': 'approved' });

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
			model: node.model || null,
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
		'profile.onboarded': true,
		banned: false,
		'profile.visibility': { $in: [PUBLIC, NOINDEX] },
		slug: { $type: 'string' },
		$or: [{ companions: { $elemMatch: match(publicKey) } }, { devices: { $elemMatch: match(publicKey) } }],
	}, PROJECTION).lean();

	if (!user) return null;

	const node = user.companions.find(c => c.publicKey === publicKey) || user.devices.find(d => d.publicKey === publicKey);
	return build(user, publicKey, await getBoardImage(node.model));
};

const getNodeProfile = async rawKey => {
	const publicKey = String(rawKey).toLowerCase();
	if (!PUBLIC_KEY_REGEX.test(publicKey)) return undefined;

	const hit = cache.get(publicKey);
	if (hit && hit.expires > Date.now()) return hit.value;

	const value = await find(publicKey);
	if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
	cache.set(publicKey, { value, expires: Date.now() + CACHE_TTL });
	return value;
};

export default getNodeProfile;
