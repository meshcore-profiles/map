export const escapeHtml = html => html.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

const byteToHex = new Array(256).fill(0).map((_, i) => i.toString(16).padStart(2, '0'));

export const bytesToHex = bytes => {
	const octets = new Array(bytes.length);
	for (let i = 0; i < bytes.length; i++) octets[i] = byteToHex[bytes[i]];

	return octets.join('');
};

const fnv1aHash = str => {
	let hash = 0x811c9dc5n;
	for (let i = 0; i < str.length; i++) {
		hash = BigInt.asIntN(32, hash ^ BigInt(str.charCodeAt(i)));
		hash = BigInt.asIntN(32, hash * 0x01000193n);
	}

	return Number(hash & 0xFFFFFFFFn);
};

export const getColourForName = (name, saturation = 60, lightness = 50) => {
	const hash = fnv1aHash(name);
	return `hsl(${hash % 360}deg, ${saturation}%, ${lightness}%)`;
};

// First code point, not UTF-16 unit: [0] or charAt(0) would cut a surrogate pair in half (e.g. 🛰, 𝗠) and produce invalid JSON/UTF-8.
const firstChar = text => text ? String.fromCodePoint(text.codePointAt(0)) : '';

export const getNameIconLabel = name => {
	if (typeof name !== 'string' || name.length === 0) return '';

	const match = name.match(/\p{Emoji_Presentation}/u);
	if (!match) {
		name = name.trim();
		const segments = name.split(' ');
		if (segments.length === 1) return firstChar(name);
		return `${firstChar(segments.at(0))}${firstChar(segments.at(-1))}`;
	}

	return match[0];
};

// Geometry of a client marker (a colored disc with the label of the node's name), in viewBox units. The site draws it as SVG, the app rasterizes the label with the same numbers.
export const CLIENT_ICON = { size: 512, fontSize: 150, emojiFontSize: 290 };

// A lone emoji gets the whole disc, letters and initials a smaller size so two of them fit.
export const clientIconFontSize = label => (/^\p{Emoji_Presentation}$/u).test(label) ? CLIENT_ICON.emojiFontSize : CLIENT_ICON.fontSize;

export const clientIconSvg = (label, color) => `<svg viewBox="0 0 ${CLIENT_ICON.size} ${CLIENT_ICON.size}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="${CLIENT_ICON.size / 2}" cy="${CLIENT_ICON.size / 2}" rx="${CLIENT_ICON.size / 2}" ry="${CLIENT_ICON.size / 2}" fill="${color}"/><text x="${CLIENT_ICON.size / 2}" y="${CLIENT_ICON.size / 2}" dominant-baseline="central" text-anchor="middle" fill="#fff" font-size="${clientIconFontSize(label)}" font-weight="bold" font-family="sans-serif">${escapeHtml(label)}</text></svg>`;

export const truncateKey = (key, visibleChars = 10) => `${key.slice(0, visibleChars)}...${key.slice(-visibleChars)}`;

export const formatBytes = bytes => {
	if (bytes < 1024) return `${bytes} B`;

	const units = ['KB', 'MB', 'GB'];
	let value = bytes;
	let unitIndex = -1;

	do {
		value /= 1024;
		unitIndex++;
	} while (value >= 1024 && unitIndex < units.length - 1);

	return `${value.toFixed(1)} ${units[unitIndex]}`;
};

export const resolveNodeByQuery = (query, nodes) => {
	const lower = query.trim().toLowerCase();
	if (!lower) return null;

	return nodes.find(n => n.adv_name.toLowerCase() === lower)
		|| nodes.find(n => n.public_key.toLowerCase().startsWith(lower))
		|| nodes.find(n => n.adv_name.toLowerCase().includes(lower))
		|| null;
};

const URL_POINT_MATCH_TOLERANCE = 0.0001;

export const findNodeNearLatLng = (nodes, lat, lng) =>
	nodes.find(n => Math.abs(n.lat - lat) < URL_POINT_MATCH_TOLERANCE && Math.abs(n.lon - lng) < URL_POINT_MATCH_TOLERANCE) || null;
