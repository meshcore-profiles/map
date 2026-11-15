// Base map catalogue shared by the website (Leaflet) and the mobile app (MapLibre Native): names, URLs, key requirements, default and fallback order.
// Each renderer turns the plain descriptors into its own layer type.
export const DEFAULT_BASEMAP_SELECTION = 'Default';

export const ESRI_HYBRID_NAME = 'Esri Hybrid';
export const MAPTILER_HYBRID_NAME = 'MapTiler Hybrid';
export const MAPTILER_OUTDOOR_NAME = 'MapTiler Outdoor';
export const CARTO_DARK_NAME = 'CartoDB Dark';
export const CARTO_POSITRON_NAME = 'CartoDB Positron';
export const OPENSTREETMAP_NAME = 'OpenStreetMap';
export const OPENFREEMAP_NAME = 'OpenFreeMap';

// group 'tiles': raster tiles (tileSize 512 means "@2x" tiles addressed one zoom level lower), group 'vector': a style document URL.
// "requires" names the key in the catalogue options that has to be present. {r} is the optional retina suffix of Leaflet.
const DEFINITIONS = [
	{ name: CARTO_DARK_NAME, group: 'tiles', requires: 'cartoApiKey', maxZoom: 20, subdomains: 'abcd', url: ({ cartoApiKey }) => `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${cartoApiKey}` },
	{ name: CARTO_POSITRON_NAME, group: 'tiles', requires: 'cartoApiKey', maxZoom: 20, subdomains: 'abcd', url: ({ cartoApiKey }) => `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${cartoApiKey}` },
	{ name: OPENSTREETMAP_NAME, group: 'tiles', maxZoom: 19, url: () => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
	{ name: 'OpenTopoMap', group: 'tiles', maxZoom: 17, subdomains: 'abc', url: () => 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png' },
	{ name: MAPTILER_OUTDOOR_NAME, group: 'tiles', requires: 'maptilerApiKey', maxZoom: 20, tileSize: 512, url: ({ maptilerApiKey }) => `https://api.maptiler.com/maps/outdoor-v4/{z}/{x}/{y}.jpg?key=${maptilerApiKey}` },
	{ name: 'CyclOSM', group: 'tiles', maxZoom: 20, subdomains: 'abc', url: () => 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png' },
	{ name: 'Humanitarian OSM', group: 'tiles', maxZoom: 20, subdomains: 'abc', url: () => 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png' },
	{ name: ESRI_HYBRID_NAME, group: 'vector', requires: 'esriApiKey', maxZoom: 18, url: ({ esriApiKey, mapLanguage }) => `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/imagery?language=${encodeURIComponent(mapLanguage)}&token=${encodeURIComponent(esriApiKey)}` },
	{ name: MAPTILER_HYBRID_NAME, group: 'vector', requires: 'maptilerApiKey', maxZoom: 20, url: ({ maptilerHybridMapId, maptilerApiKey }) => `https://api.maptiler.com/maps/${maptilerHybridMapId}/style.json?key=${maptilerApiKey}` },
	{ name: OPENFREEMAP_NAME, group: 'vector', maxZoom: 20, url: () => 'https://tiles.openfreemap.org/styles/liberty' },
];

const FALLBACK_ORDER = [ESRI_HYBRID_NAME, MAPTILER_HYBRID_NAME, CARTO_DARK_NAME, OPENSTREETMAP_NAME];
const DEFAULT_ORDER = [ESRI_HYBRID_NAME, MAPTILER_HYBRID_NAME, OPENSTREETMAP_NAME];

// options: { esriApiKey, cartoApiKey, maptilerApiKey, maptilerHybridMapId, mapLanguage }. Maps whose key is missing are left out of "basemaps".
export const createBasemapCatalog = (options = {}) => {
	const keys = {
		...options,
		esriApiKey: options.esriApiKey?.trim() || null,
		mapLanguage: options.mapLanguage || 'local',
	};

	const isAvailable = definition => !definition.requires || Boolean(keys[definition.requires]);
	const basemaps = DEFINITIONS.filter(isAvailable).map(definition => ({ ...definition, url: definition.url(keys) }));
	const names = new Set(basemaps.map(basemap => basemap.name));

	const fallbackChain = FALLBACK_ORDER.filter(name => names.has(name));
	const defaultName = DEFAULT_ORDER.find(name => names.has(name));

	return {
		basemaps,
		defaultName,
		fallbackChain,
		byName: name => basemaps.find(basemap => basemap.name === name),
		resolve: selection => selection === DEFAULT_BASEMAP_SELECTION ? defaultName : selection,
		nextFallback: failedName => {
			const index = fallbackChain.indexOf(failedName);
			return index === -1 ? fallbackChain[0] : fallbackChain[index + 1];
		},
		// A known map that exists only with an API key the server did not provide.
		isMissingKey: name => DEFINITIONS.some(definition => definition.name === name && !isAvailable(definition)),
	};
};
