/* global L */
import { createBasemapCatalog, ESRI_HYBRID_NAME, mergeApiKeys } from '/core/basemaps.js';
import { loadCustomApiKeys } from './api-keys.js';
import { readMapLanguage } from './preferences.js';
import { t, tRaw } from './i18n.js';
import { escapeHtml } from './pathtools.js';

// Language of the labels on the vector maps: the visitor's choice, else the site's.
const mapLanguage = readMapLanguage() || window.MAP_CONFIG.mapLanguage || 'local';
const ESRI_ROADS_MIN_ZOOM = 12;

// Names, URLs, default and fallback order are shared with the mobile app (packages/core/src/basemaps.js). Keys the visitor entered replace the server's.
const catalog = createBasemapCatalog({
	...mergeApiKeys({
		esriApiKey: window.MAP_CONFIG.esriApiKey,
		cartoApiKey: window.MAP_CONFIG.cartoApiKey,
		maptilerApiKey: window.MAP_CONFIG.maptilerApiKey,
	}, loadCustomApiKeys()),
	maptilerHybridMapId: window.MAP_CONFIG.maptilerHybridMapId,
	mapLanguage,
});
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

// The error carries the HTTP status (0 = no answer), which the fallback toast turns into an explanation.
const fetchStyleJson = async url => {
	let response;
	try {
		response = await fetch(url);
	} catch {
		throw Object.assign(new Error('Map style request failed (no connection)'), { status: 0 });
	}
	if (!response.ok) throw Object.assign(new Error(`Map style request failed (${response.status})`), { status: response.status });

	const style = await response.json();
	// Esri answers an invalid or exhausted token with an error object (its code is the HTTP-like status), not always with an error status.
	if (style?.error?.code) throw Object.assign(new Error(`Map style request failed (${style.error.code})`), { status: Number(style.error.code) });
	return style;
};

const loadEsriStyle = async url => {
	const style = await fetchStyleJson(url);
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
				options.style = localizeMapStyle(await fetchStyleJson(options.style), mapLanguage);
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
	catalog,
	maplibreBaseMapOptions,
	tileBaseMaps,
	maplibreBaseMaps,
	baseMapAttributions,
	baseMapInfo,
	getMaplibreBaseMapLayer
};
