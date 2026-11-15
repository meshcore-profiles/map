export const byteToHex = new Array(256).fill(0).map((_, i) => i.toString(16).padStart(2, '0'));

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

export const getNameIconLabel = name => {
	if (typeof name !== 'string' || name.length === 0) return '';

	const match = name.match(/\p{Emoji_Presentation}/u);
	if (!match) {
		name = name.trim();
		const segments = name.split(' ');
		if (segments.length === 1) return name.charAt(0);
		return `${segments.at(0)[0]}${segments.at(-1)[0]}`;
	}

	return match[0];
};

export const formatDateTime = date => date.toLocaleString(navigator.languages || navigator.language);

export const formatTime = date => date.toLocaleTimeString(navigator.languages || navigator.language);

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
