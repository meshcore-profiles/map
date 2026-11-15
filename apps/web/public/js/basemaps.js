/* global L */
import { createBasemapCatalog, DEFAULT_BASEMAP_SELECTION, ESRI_HYBRID_NAME } from '/core/basemaps.js';
import { t, tRaw } from './i18n.js';
import { escapeHtml } from './pathtools.js';

const mapLanguage = window.MAP_CONFIG.mapLanguage || 'local';
const ESRI_ROADS_MIN_ZOOM = 12;

// Names, URLs, default and fallback order are shared with the mobile app (packages/core/src/basemaps.js).
const catalog = createBasemapCatalog({
	esriApiKey: window.MAP_CONFIG.esriApiKey,
	cartoApiKey: window.MAP_CONFIG.cartoApiKey,
	maptilerApiKey: window.MAP_CONFIG.maptilerApiKey,
	maptilerHybridMapId: window.MAP_CONFIG.maptilerHybridMapId,
	mapLanguage,
});
const { defaultName: defaultBaseMapName, nextFallback: getNextFallbackBaseMap, resolve: resolveBaseMapName, isMissingKey: isBaseMapMissingKey } = catalog;

const maplibreBaseMapOptions = Object.fromEntries(catalog.basemaps
	.filter(basemap => basemap.group === 'vector')
	.map(basemap => [basemap.name, { style: basemap.url, maxZoom: basemap.maxZoom }]));

const createTileLayer = ({ url, maxZoom, subdomains, tileSize }) => L.tileLayer(url, {
	maxZoom,
	referrerPolicy: 'strict-origin-when-cross-origin',
	...(subdomains ? { subdomains } : {}),
	...(tileSize === 512 ? { tileSize, zoomOffset: -1, minZoom: 1 } : {}),
});

const tileBaseMaps = Object.fromEntries(catalog.basemaps
	.filter(basemap => basemap.group === 'tiles')
	.map(basemap => [basemap.name, createTileLayer(basemap)]));
const maplibreBaseMaps = {};
const maplibreBaseMapPromises = {};

const baseMapAttributions = tRaw('map:tilesAttribution');
const baseMapInfo = tRaw('map:baseMapInfo');

const getBaseMapGroups = () => [
	{ label: t('map:tileBaseMaps'), names: Object.keys(tileBaseMaps) },
	{ label: t('map:vectorBaseMaps'), names: Object.keys(maplibreBaseMapOptions) },
].filter(group => group.names.length);
const getBaseMapNames = () => getBaseMapGroups().flatMap(group => group.names);

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
	isBaseMapMissingKey,
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
