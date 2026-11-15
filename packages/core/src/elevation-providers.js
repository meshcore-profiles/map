const DEFAULT_CHUNK_SIZE = 100;

const fetchFromLookupApi = (fetchImpl, url, points) => fetchImpl(url, {
	method: 'POST',
	headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
	body: JSON.stringify({ locations: points.map(p => ({ latitude: p.lat, longitude: p.lng })) }),
});

// The platform supplies getSefinekApi (backend address), pack/unpack (msgpackr) and optionally fetch.
// Our own backend (unlike the third-party providers below) accepts a single msgpack-encoded
// request for the whole batch, so maxBatchSize only bounds it via the server's own hard cap.
export const createElevationProviders = ({ getSefinekApi, pack, unpack, fetchImpl = (...args) => fetch(...args) }) => ({
	sefinek: {
		label: 'Sefinek API',
		maxBatchSize: 20000, // matches the server's MAX_LOCATIONS_MSGPACK - always fits a whole coverage batch in one request
		fetch: async points => {
			const base = getSefinekApi();
			if (!base) throw new Error('Sefinek API address is not configured.');

			const body = pack({ locations: points.map(p => ({ latitude: p.lat, longitude: p.lng })) });
			const res = await fetchImpl(`${base}/api/v2/elevation`, {
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
			const res = await fetchFromLookupApi(fetchImpl, 'https://api.open-elevation.com/api/v1/lookup', points);
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
			const res = await fetchImpl(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
			if (!res.ok) throw new Error(`Open-Meteo returned error ${res.status}`);

			const data = await res.json();
			return data.elevation;
		},
	},
});

export const fetchElevations = (providers, points, source) => (providers[source] || providers.sefinek).fetch(points);

export const fetchElevationsChunked = async (providers, points, source, onProgress) => {
	const provider = providers[source] || providers.sefinek;
	const chunkSize = provider.maxBatchSize || DEFAULT_CHUNK_SIZE;
	const chunkCount = Math.ceil(points.length / chunkSize);
	const elevations = new Array(points.length);

	for (let c = 0; c < chunkCount; c++) {
		const start = c * chunkSize;
		const end = Math.min(start + chunkSize, points.length);
		onProgress?.(c + 1, chunkCount);
		const chunk = await provider.fetch(points.slice(start, end));
		for (let k = 0; k < chunk.length; k++) elevations[start + k] = chunk[k];
	}

	return elevations;
};
