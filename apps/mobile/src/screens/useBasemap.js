import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_BASEMAP_SELECTION, ESRI_HYBRID_NAME } from '@meshcore-map/core/basemaps';
import { API_BASE } from '../config';
import { createBasemaps } from '../data/basemaps';
import { apiFetch } from '../data/http';
import { useI18n } from '../i18n';
import { readJson, writeJson } from '../storage/files';
import { useToast } from '../ui/Toast';

const TOAST_DURATION_MS = 6000;
const STYLE_TIMEOUT_MS = 10000;

// Vector styles are fetched here, not by the native map: a rejected key (403) is then known before the map is mounted, instead of an empty map
// sitting there until the native side reports the failure and the busy JS thread gets to react. The keys are restricted to the site's origin, hence the Referer.
const fetchStyle = async url => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), STYLE_TIMEOUT_MS);

	try {
		const res = await apiFetch(url, { signal: controller.signal, headers: { Referer: `${API_BASE}/` } });
		if (!res.ok) throw Object.assign(new Error(`Style request returned ${res.status}`), { status: res.status });

		return await res.json();
	} finally {
		clearTimeout(timer);
	}
};

// Esri styles carry no credit the map could show, and "Powered by Esri" is required, so the website's text is attached when the style has none.
const withAttribution = (style, text) => {
	const [first] = Object.keys(style.sources ?? {});
	if (!text || !first || Object.values(style.sources).some(source => source.attribution)) return style;

	return { ...style, sources: { ...style.sources, [first]: { ...style.sources[first], attribution: text } } };
};

const styleFile = name => `basemap-style-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;

// The last style that loaded is kept so the app can start offline (the tiles come from the native map cache). Only a network failure falls back to it:
// a refused request (e.g. a revoked key) must not be answered with an old copy.
const loadStyle = async (name, url, attribution) => {
	try {
		const fetchedStyle = await fetchStyle(url);
		const style = name === ESRI_HYBRID_NAME ? withAttribution(fetchedStyle, attribution) : fetchedStyle;
		writeJson(styleFile(name), style).catch(err => console.warn('Basemap style not saved:', err.message));

		return style;
	} catch (err) {
		const saved = err.status ? null : await readJson(styleFile(name));
		if (saved) return saved;

		throw err;
	}
};

// The basemap catalogue, the style of the active map (null until it is ready) and the reaction to a map that fails to load.
export const useBasemap = ({ config, settings, update }) => {
	const { t, tRaw } = useI18n();
	const showToast = useToast();

	const attributions = useMemo(() => tRaw('map:tilesAttribution') ?? {}, [tRaw]);
	const basemaps = useMemo(() => createBasemaps(config?.basemaps, settings.region, attributions), [config, settings.region, attributions]);
	// A map that failed to load is replaced only for this session: saving the fallback would keep the app on it for good, even after the keys are fixed or the network is back.
	const [fallback, setFallback] = useState(null);
	// Names of the maps that already failed this session, so one failure is never counted twice (the native side can report a style more than once).
	const failed = useRef(new Set());
	useEffect(() => {
		failed.current.clear();
		setFallback(null);
	}, [settings.basemap]);

	const selectedName = basemaps.resolve(settings.basemap);
	const chosenName = basemaps.byName(selectedName) ? selectedName : basemaps.defaultName;
	const activeName = fallback && basemaps.byName(fallback) ? fallback : chosenName;
	const activeBasemap = basemaps.byName(activeName);
	const url = typeof activeBasemap.style === 'string' ? activeBasemap.style : null;

	const [fetched, setFetched] = useState({});

	const fail = useCallback(name => {
		if (failed.current.has(name)) return;

		failed.current.add(name);
		const next = basemaps.nextFallback(name);
		if (!next) return;

		showToast(t('map:basemapFallback', { failed: name, fallback: next }), { status: 'error', duration: TOAST_DURATION_MS, group: 'basemap' });
		setFallback(next);
	}, [basemaps, showToast, t]);

	useEffect(() => {
		if (!url || fetched[url]) return undefined;

		let cancelled = false;
		loadStyle(activeName, url, attributions[activeName])
			.then(style => !cancelled && setFetched(current => ({ ...current, [url]: style })))
			.catch(err => {
				if (cancelled) return;

				console.warn(`Basemap "${activeName}" unavailable:`, err.message);
				fail(activeName);
			});

		return () => {
			cancelled = true;
		};
	}, [url, fetched, activeName, attributions, fail]);

	// Raster styles are built locally; comparing the serialised form keeps the map from reloading an identical one when the config arrives.
	const rasterKey = url ? null : JSON.stringify(activeBasemap.style);
	const rasterStyle = useMemo(() => activeBasemap.style, [rasterKey]);
	const mapStyle = url ? fetched[url] ?? null : rasterStyle;

	useEffect(() => {
		if (config && basemaps.isMissingKey(settings.basemap)) {
			showToast(t('map:basemapMissingApiKey', { name: settings.basemap }), { status: 'error', duration: TOAST_DURATION_MS, group: 'basemap' });
			update({ basemap: DEFAULT_BASEMAP_SELECTION });
		}
	}, [config, basemaps, settings.basemap, showToast, t, update]);

	// A tile or glyph request failing later reaches us from the native map.
	const handleStyleFailed = useCallback(() => fail(activeName), [fail, activeName]);

	return { basemaps, mapStyle, attribution: attributions[activeName], handleStyleFailed };
};
