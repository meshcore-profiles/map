// Base map catalog shared by the website (Leaflet) and the mobile app (MapLibre Native): names, URLs, key requirements, default and fallback order.
// Each renderer turns the plain descriptors into its own layer type.
// What a map shows, which is how the maps are grouped for the user (not how they are rendered): street and terrain maps are one group.
export const BASEMAP_CATEGORIES = ['maps', 'satellite'];

export const normalizeBasemapSelection = value => (typeof value === 'string' && value ? value : null);

// Providers whose maps need a key. A visitor can enter their own (website: localStorage, app: settings); it replaces the one the server hands out,
// so a shared key that ran out of quota, or one the visitor's plan does not cover, does not lock the map.
export const API_KEY_PROVIDERS = [
	{ id: 'esriApiKey', name: 'Esri', url: 'https://location.arcgis.com', forbidsCaching: true },
	{ id: 'maptilerApiKey', name: 'MapTiler', url: 'https://cloud.maptiler.com/account/keys' },
	{ id: 'cartoApiKey', name: 'CARTO', url: 'https://carto.com/basemaps/apikey' },
];

// Why a map failed, from the HTTP status of the failing request: 0 is a request that never got an answer (offline, timeout), undefined a failure
// without any status (e.g. the native map or a tile layer only says "failed"). Used to pick the explanation shown to the user.
// requiresKey: a map with an API key whose failure carries no status is most likely a rejected or exhausted key, so it is said so.
export const basemapFailureReason = (status, { requiresKey = false } = {}) => {
	if (status === 0) return 'network';
	if (status === 429) return 'limit';
	if ([401, 403, 498, 499].includes(status)) return 'denied';
	if (status >= 500) return 'server';
	return status === undefined && requiresKey ? 'keyRejected' : 'unknown';
};

// Keys end up in URLs, so only the characters providers actually issue are accepted.
const API_KEY_PATTERN = /^[\w.~-]{8,512}$/;

export const sanitizeApiKey = value => {
	const key = typeof value === 'string' ? value.trim() : '';
	return API_KEY_PATTERN.test(key) ? key : null;
};

export const sanitizeCustomApiKeys = raw => Object.fromEntries(API_KEY_PROVIDERS
	.map(({ id }) => [id, sanitizeApiKey(raw?.[id])])
	.filter(([, key]) => key));

// The visitor's own keys win over the server's.
export const mergeApiKeys = (serverKeys, customKeys) => ({ ...serverKeys, ...sanitizeCustomApiKeys(customKeys) });

export const ESRI_HYBRID_NAME = 'Esri Hybrid';
export const MAPTILER_HYBRID_NAME = 'MapTiler Hybrid';
export const MAPTILER_OUTDOOR_NAME = 'MapTiler Outdoor';
export const CARTO_DARK_NAME = 'CartoDB Dark';
export const CARTO_POSITRON_NAME = 'CartoDB Positron';
export const OPENSTREETMAP_NAME = 'OpenStreetMap';
export const OPENFREEMAP_NAME = 'OpenFreeMap';

// group 'tiles': raster tiles (tileSize 512 means "@2x" tiles addressed one zoom level lower), group 'vector': a style document URL.
// "forbidsCaching": the provider's terms do not allow storing its map data, so a client that caches tiles on disk (the app) leaves the map out.
// "requires" names the key in the catalog options that has to be present. {r} is the optional retina suffix of Leaflet.
const DEFINITIONS = [
	{ name: CARTO_DARK_NAME, category: 'maps', group: 'tiles', requires: 'cartoApiKey', maxZoom: 20, subdomains: 'abcd', url: ({ cartoApiKey }) => `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoApiKey)}` },
	{ name: CARTO_POSITRON_NAME, category: 'maps', group: 'tiles', requires: 'cartoApiKey', maxZoom: 20, subdomains: 'abcd', url: ({ cartoApiKey }) => `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoApiKey)}` },
	{ name: OPENSTREETMAP_NAME, category: 'maps', group: 'tiles', maxZoom: 19, url: () => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
	{ name: 'OpenTopoMap', category: 'maps', group: 'tiles', maxZoom: 17, subdomains: 'abc', url: () => 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png' },
	{ name: MAPTILER_OUTDOOR_NAME, category: 'maps', group: 'tiles', requires: 'maptilerApiKey', maxZoom: 20, tileSize: 512, url: ({ maptilerApiKey }) => `https://api.maptiler.com/maps/outdoor-v4/{z}/{x}/{y}.jpg?key=${encodeURIComponent(maptilerApiKey)}` },
	{ name: 'CyclOSM', category: 'maps', group: 'tiles', maxZoom: 20, subdomains: 'abc', url: () => 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png' },
	{ name: 'Humanitarian OSM', category: 'maps', group: 'tiles', maxZoom: 20, subdomains: 'abc', url: () => 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png' },
	{ name: ESRI_HYBRID_NAME, category: 'satellite', group: 'vector', requires: 'esriApiKey', forbidsCaching: true, maxZoom: 18, url: ({ esriApiKey, mapLanguage }) => `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/imagery?language=${encodeURIComponent(mapLanguage)}&token=${encodeURIComponent(esriApiKey)}` },
	{ name: MAPTILER_HYBRID_NAME, category: 'satellite', group: 'vector', requires: 'maptilerApiKey', maxZoom: 20, url: ({ maptilerHybridMapId, maptilerApiKey }) => `https://api.maptiler.com/maps/${maptilerHybridMapId}/style.json?key=${encodeURIComponent(maptilerApiKey)}` },
	{ name: OPENFREEMAP_NAME, category: 'maps', group: 'vector', maxZoom: 20, url: () => 'https://tiles.openfreemap.org/styles/liberty' },
];

// The order of preference: the first available map is the default, and a map that fails is replaced by the next one. The keyed maps come first and
// the keyless ones last (OpenStreetMap: allowed for interactive viewing with an identifying User-Agent; OpenFreeMap: free, no key, apps allowed),
// so a rejected key or an exhausted quota never leaves the map empty.
const PRIORITY_ORDER = [ESRI_HYBRID_NAME, MAPTILER_HYBRID_NAME, CARTO_DARK_NAME, OPENSTREETMAP_NAME, OPENFREEMAP_NAME];

// options: { esriApiKey, cartoApiKey, maptilerApiKey, maptilerHybridMapId, mapLanguage, cachesTiles }. Maps whose key is missing are left out of "basemaps",
// and so are those that forbid caching when the client caches tiles (cachesTiles).
export const createBasemapCatalog = (options = {}) => {
	const keys = {
		...options,
		esriApiKey: options.esriApiKey?.trim() || null,
		mapLanguage: options.mapLanguage || 'local',
	};

	const isExcluded = definition => Boolean(options.cachesTiles && definition.forbidsCaching);
	const isAvailable = definition => !isExcluded(definition) && (!definition.requires || Boolean(keys[definition.requires]));
	const basemaps = DEFINITIONS.filter(isAvailable).map(definition => ({ ...definition, url: definition.url(keys) }));
	const names = new Set(basemaps.map(basemap => basemap.name));

	const fallbackChain = PRIORITY_ORDER.filter(name => names.has(name));
	const defaultName = fallbackChain[0];

	// Every known map, the unavailable ones included, so a UI can list them as disabled instead of hiding them, grouped by category.
	// reason: 'key' (no API key) or 'caching' (left out by the client).
	const listed = DEFINITIONS.map(definition => ({
		name: definition.name,
		group: definition.group,
		category: definition.category,
		disabled: !isAvailable(definition),
		reason: isExcluded(definition) ? 'caching' : isAvailable(definition) ? null : 'key',
		isDefault: definition.name === defaultName,
	})).sort((a, b) => BASEMAP_CATEGORIES.indexOf(a.category) - BASEMAP_CATEGORIES.indexOf(b.category));

	return {
		basemaps,
		listed,
		defaultName,
		fallbackChain,
		byName: name => basemaps.find(basemap => basemap.name === name),
		// A known map that exists only with an API key the server did not provide.
		isMissingKey: name => DEFINITIONS.some(definition => definition.name === name && !isExcluded(definition) && !isAvailable(definition)),
	};
};

// Which map is wanted (the user's choice, else the default), which one is shown, and whether that is a fallback because the wanted one failed.
// followsDefault: the user has not pinned a map of their own. failures: { [mapName]: { status } } for the maps that failed to load in this session.
export const resolveBasemap = ({ catalog, selected, failures = {} }) => {
	const followsDefault = !(selected && catalog.byName(selected));
	const wanted = followsDefault ? catalog.defaultName : selected;
	const failed = name => Object.hasOwn(failures, name);
	const active = failed(wanted) ? catalog.fallbackChain.find(name => !failed(name)) ?? wanted : wanted;

	return { wanted, active, usingFallback: active !== wanted, followsDefault };
};

// Records a failure once; the same object comes back when the map is already known to have failed, which tells the caller there is nothing new to react to.
export const withBasemapFailure = (failures, name, status) => Object.hasOwn(failures, name) ? failures : { ...failures, [name]: { status } };
