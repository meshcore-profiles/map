import { pack, unpack } from '../vendor/msgpackr/msgpackr.js';
import { t } from './i18n.js';

export { haversineDistance, interpolate, curvatureDrop, destinationPoint, parseLatLng } from '/core/geo.js';

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
			const elevations = data.results.map(r => r.elevation);
			// The API answers 200 with null for points it could not resolve; treating them as 0 would fake a flat terrain.
			if (elevations.length !== points.length || !elevations.every(Number.isFinite)) throw new Error('Sefinek API returned incomplete elevation data.');

			return elevations;
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
		maxBatchSize: 100,
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

// terrain.js/coverage.js only actually query the sefinek backend - the other providers are unreliable
// public APIs (batch limits, rate limits), kept selectable only so a future fix can re-enable them.
export const requireSefinekElevationSource = (getElevationSource, showToast) => {
	const source = getElevationSource ? getElevationSource() : 'sefinek';
	if (source === 'sefinek') return true;

	showToast(t('common:elevationSourceUnsupported'), { status: 'error', duration: 6000 });
	return false;
};

export const requireFeature = (name, showToast) => {
	if (window.MAP_CONFIG.features?.[name]) return true;

	showToast(t('common:toolUnavailable'), { status: 'error', duration: 6000 });
	return false;
};
