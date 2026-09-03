import { pack, unpack } from '../vendor/msgpackr/msgpackr.js';

export const EARTH_RADIUS = 6371000;
const EFFECTIVE_EARTH_RADIUS = EARTH_RADIUS * 4 / 3;

export const toRad = deg => deg * Math.PI / 180;
const toDeg = rad => rad * 180 / Math.PI;

export const haversineDistance = (a, b) => {
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
};

export const interpolate = (a, b, frac) => ({ lat: a.lat + (b.lat - a.lat) * frac, lng: a.lng + (b.lng - a.lng) * frac });

export const curvatureDrop = (d, total) => (d * (total - d)) / (2 * EFFECTIVE_EARTH_RADIUS);

export const destinationPoint = (origin, bearingDeg, distance) => {
	const delta = distance / EARTH_RADIUS;
	const theta = toRad(bearingDeg);
	const phi1 = toRad(origin.lat);
	const lambda1 = toRad(origin.lng);

	const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
	const lambda2 = lambda1 + Math.atan2(
		Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
		Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
	);

	return { lat: toDeg(phi2), lng: ((toDeg(lambda2) + 540) % 360) - 180 };
};

export const parseLatLng = text => {
	const match = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
	if (!match) return null;

	const lat = Number(match[1]);
	const lng = Number(match[2]);
	if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

	return { lat, lng };
};

const fetchFromLookupApi = (url, points) => fetch(url, {
	method: 'POST',
	headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
	body: JSON.stringify({ locations: points.map(p => ({ latitude: p.lat, longitude: p.lng })) }),
});

// Our own backend (unlike the third-party providers below) accepts a single msgpack-encoded
// request for the whole batch, so maxBatchSize only bounds it via the server's own hard cap.
export const ELEVATION_PROVIDERS = {
	sefinek: {
		label: 'Sefinek API',
		maxBatchSize: 20000, // matches the server's MAX_LOCATIONS_MSGPACK - always fits coverage.js's whole batch in one request
		fetch: async points => {
			const base = window.MAP_CONFIG.sefinekApi;
			if (!base) throw new Error('Sefinek API address is not configured.');

			const body = pack({ locations: points.map(p => ({ latitude: p.lat, longitude: p.lng })) });
			const res = await fetch(`${base}/api/v2/elevation`, {
				method: 'POST',
				headers: { 'Accept': 'application/msgpack', 'Content-Type': 'application/msgpack' },
				body,
			});
			if (!res.ok) throw new Error(`Sefinek API returned error ${res.status}`);

			const data = unpack(new Uint8Array(await res.arrayBuffer()));
			return data.results.map(r => r.elevation);
		},
	},
	'open-elevation': {
		label: 'Open-Elevation',
		maxBatchSize: 100,
		fetch: async points => {
			const res = await fetchFromLookupApi('https://api.open-elevation.com/api/v1/lookup', points);
			if (!res.ok) throw new Error(`Open-Elevation returned error ${res.status}`);

			const data = await res.json();
			return data.results.map(r => r.elevation);
		},
	},
	'open-meteo': {
		label: 'Open-Meteo',
		maxBatchSize: 200,
		fetch: async points => {
			const lat = points.map(p => p.lat).join(',');
			const lng = points.map(p => p.lng).join(',');
			const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
			if (!res.ok) throw new Error(`Open-Meteo returned error ${res.status}`);

			const data = await res.json();
			return data.elevation;
		},
	},
};

export const fetchElevations = (points, source) => (ELEVATION_PROVIDERS[source] || ELEVATION_PROVIDERS.sefinek).fetch(points);
