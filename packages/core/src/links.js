const KEY_PATTERN = /^[0-9a-f]{64}$/i;

const parseQuery = query => Object.fromEntries(query.split('&').filter(Boolean).map(pair => {
	const [name, ...rest] = pair.split('=');
	try {
		return [decodeURIComponent(name), decodeURIComponent(rest.join('=').replace(/\+/g, ' '))];
	} catch {
		return [name, ''];
	}
}));

// What a link to the map asks for: ?node=<public key> (selects a node) or lat/lon/zoom (moves the view). The same parameters the website mirrors into its URL.
// Returns { node } | { view: { lat, lon, zoom } } | null. Accepts https links and custom-scheme links alike.
export const parseMapLink = url => {
	const query = String(url ?? '').split('#')[0].split('?')[1];
	if (!query) return null;

	const params = parseQuery(query);
	if (KEY_PATTERN.test(params.node ?? '')) return { node: params.node.toLowerCase() };

	const lat = Number(params.lat);
	const lon = Number(params.lon);
	if (params.lat && params.lon && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
		const zoom = Number(params.zoom);
		return { view: { lat, lon, zoom: Number.isFinite(zoom) && zoom >= 0 && zoom <= 22 ? zoom : null } };
	}

	return null;
};
