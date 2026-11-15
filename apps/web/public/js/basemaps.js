/* global L */
import { t, tRaw } from './i18n.js';
import { escapeHtml } from './pathtools.js';

const MAPTILER_HYBRID_NAME = 'MapTiler Hybrid';
const MAPTILER_OUTDOOR_NAME = 'MapTiler Outdoor';
const CARTO_DARK_NAME = 'CartoDB Dark';
const CARTO_POSITRON_NAME = 'CartoDB Positron';
const OPENFREEMAP_NAME = 'OpenFreeMap';
const ESRI_HYBRID_NAME = 'Esri Hybrid';
const ESRI_ROADS_MIN_ZOOM = 12;
const mapLanguage = window.MAP_CONFIG.mapLanguage || 'local';

const esriApiKey = window.MAP_CONFIG.esriApiKey?.trim();
const esriToken = encodeURIComponent(esriApiKey || '');
const cartoApiKey = window.MAP_CONFIG.cartoApiKey;
const maptilerApiKey = window.MAP_CONFIG.maptilerApiKey;
const maptilerAvailable = Boolean(maptilerApiKey);

const basemapFallbackChain = [
	...(esriApiKey ? [ESRI_HYBRID_NAME] : []),
	...(maptilerAvailable ? [MAPTILER_HYBRID_NAME] : []),
	...(cartoApiKey ? [CARTO_DARK_NAME] : []),
	'OpenStreetMap',
];
const getNextFallbackBaseMap = failedName => {
	const index = basemapFallbackChain.indexOf(failedName);
	return index === -1 ? basemapFallbackChain[0] : basemapFallbackChain[index + 1];
};

const maplibreBaseMapOptions = {
	...(esriApiKey ? {
		[ESRI_HYBRID_NAME]: {
			style: `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/imagery?language=${encodeURIComponent(mapLanguage)}&token=${esriToken}`,
			maxZoom: 18,
		},
	} : {}),
	...(maptilerAvailable ? {
		[MAPTILER_HYBRID_NAME]: {
			style: `https://api.maptiler.com/maps/${window.MAP_CONFIG.maptilerHybridMapId}/style.json?key=${maptilerApiKey}`,
			maxZoom: 20,
		},
	} : {}),
	[OPENFREEMAP_NAME]: {
		style: 'https://tiles.openfreemap.org/styles/liberty',
		maxZoom: 20,
	},
};
const createMapTilerRasterLayer = mapId => L.tileLayer(`https://api.maptiler.com/maps/${mapId}/{z}/{x}/{y}.jpg?key=${maptilerApiKey}`, {
	tileSize: 512,
	zoomOffset: -1,
	minZoom: 1,
	maxZoom: 20,
	referrerPolicy: 'strict-origin-when-cross-origin',
});

const tileBaseMaps = {
	...(cartoApiKey ? {
		[CARTO_DARK_NAME]: L.tileLayer(`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`, {
			maxZoom: 20,
			subdomains: 'abcd',
			referrerPolicy: 'strict-origin-when-cross-origin',
		}),
		[CARTO_POSITRON_NAME]: L.tileLayer(`https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`, {
			maxZoom: 20,
			subdomains: 'abcd',
			referrerPolicy: 'strict-origin-when-cross-origin',
		}),
	} : {}),
	'OpenStreetMap': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		referrerPolicy: 'strict-origin-when-cross-origin',
	}),
	'OpenTopoMap': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
		maxZoom: 17,
		subdomains: 'abc',
	}),
	...(maptilerAvailable ? { [MAPTILER_OUTDOOR_NAME]: createMapTilerRasterLayer('outdoor-v4') } : {}),
	'CyclOSM': L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
		maxZoom: 20,
		subdomains: 'abc',
	}),
	'Humanitarian OSM': L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
		maxZoom: 20,
		subdomains: 'abc',
	}),
};
const maplibreBaseMaps = {};
const maplibreBaseMapPromises = {};

const baseMapAttributions = tRaw('map:tilesAttribution');
const baseMapInfo = tRaw('map:baseMapInfo');

const getBaseMapGroups = () => [
	{ label: t('map:tileBaseMaps'), names: Object.keys(tileBaseMaps) },
	{ label: t('map:vectorBaseMaps'), names: Object.keys(maplibreBaseMapOptions) },
].filter(group => group.names.length);
const getBaseMapNames = () => getBaseMapGroups().flatMap(group => group.names);
const defaultBaseMapName = esriApiKey ? ESRI_HYBRID_NAME : maptilerAvailable ? MAPTILER_HYBRID_NAME : 'OpenStreetMap';
const DEFAULT_BASEMAP_SELECTION = 'Default';
const resolveBaseMapName = name => name === DEFAULT_BASEMAP_SELECTION ? defaultBaseMapName : name;

let maplibreLoadPromise = null;
const loadMaplibreGL = () => {
	if (maplibreLoadPromise) return maplibreLoadPromise;

	if (!document.getElementById('maplibre-stylesheet')) {
		const stylesheet = document.createElement('link');
		stylesheet.id = 'maplibre-stylesheet';
		stylesheet.rel = 'stylesheet';
		stylesheet.href = '/vendor/maplibre/maplibre-gl.css';
		document.head.appendChild(stylesheet);
	}

	maplibreLoadPromise = import('/vendor/maplibre/leaflet-maplibre-gl.mjs')
		.catch(err => {
			maplibreLoadPromise = null;
			throw err;
		});

	return maplibreLoadPromise;
};

const loadEsriStyle = async url => {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Esri style request failed (${response.status})`);
	const style = await response.json();
	if (!Array.isArray(style.layers) || !style.sources) throw new Error('Invalid Esri basemap style');

	for (const layer of style.layers) {
		if ((/^Road(?:[ /]|$)|^Exit$/).test(layer['source-layer'] || '')) {
			layer.minzoom = Math.max(layer.minzoom || 0, ESRI_ROADS_MIN_ZOOM - 1);
		}
	}
	for (const source of Object.values(style.sources)) {
		if (source.tiles?.length) delete source.url;
		delete source.copyrightText;
	}
	return style;
};

const localizeMapStyle = (style, language) => {
	if (!Array.isArray(style.layers)) throw new Error('Invalid map style');
	const translate = expression => {
		if (!Array.isArray(expression) || expression[0] === 'literal') return expression;
		if (expression[0] === 'get' && (/^name(?::[\w-]+|_[\w-]+)?$/).test(expression[1])) {
			return ['coalesce', ['get', `name:${language}`], ['get', `name_${language}`], expression];
		}
		return expression.map(translate);
	};
	for (const layer of style.layers) {
		const field = layer.layout?.['text-field'];
		if (!field) continue;
		if (typeof field === 'string' && (/\{name(?::[\w-]+|_[\w-]+)?\}/).test(field)) {
			layer.layout['text-field'] = ['coalesce', ['get', `name:${language}`], ['get', `name_${language}`], ['get', 'name'], ''];
		} else if (Array.isArray(field)) {
			layer.layout['text-field'] = translate(field);
		}
	}
	return style;
};

const getMaplibreBaseMapLayer = async name => {
	if (maplibreBaseMaps[name]) return maplibreBaseMaps[name];
	if (!maplibreBaseMapPromises[name]) {
		maplibreBaseMapPromises[name] = (async () => {
			await loadMaplibreGL();
			const options = { ...maplibreBaseMapOptions[name] };
			if (name === ESRI_HYBRID_NAME) {
				options.style = await loadEsriStyle(options.style);
				const sources = [...new Set(Object.values(options.style.sources).map(source => source.attribution).filter(Boolean))];
				options.esriAttribution = 'Powered by <a href="https://www.esri.com/">Esri</a> | ' +
					`<details class="map-attribution-details"><summary>${escapeHtml(t('map:attributionSources'))}</summary>` +
					`<div class="map-attribution-sources">${sources.map(escapeHtml).join('<br>')}</div></details>`;
			} else if (mapLanguage !== 'local') {
				const response = await fetch(options.style);
				if (!response.ok) throw new Error(`Map style request failed (${response.status})`);
				options.style = localizeMapStyle(await response.json(), mapLanguage);
			}
			const layer = L.maplibreGL({ attributionControl: false, ...options });
			maplibreBaseMaps[name] = layer;
			return layer;
		})().finally(() => {
			delete maplibreBaseMapPromises[name];
		});
	}
	return maplibreBaseMapPromises[name];
};

export {
	MAPTILER_HYBRID_NAME,
	MAPTILER_OUTDOOR_NAME,
	CARTO_DARK_NAME,
	CARTO_POSITRON_NAME,
	ESRI_HYBRID_NAME,
	esriApiKey,
	cartoApiKey,
	maptilerAvailable,
	getNextFallbackBaseMap,
	maplibreBaseMapOptions,
	tileBaseMaps,
	maplibreBaseMaps,
	baseMapAttributions,
	baseMapInfo,
	getBaseMapGroups,
	getBaseMapNames,
	defaultBaseMapName,
	DEFAULT_BASEMAP_SELECTION,
	resolveBaseMapName,
	getMaplibreBaseMapLayer
};
