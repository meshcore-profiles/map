import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_BASEMAP_SELECTION } from '@meshcore-map/core/basemaps';
import { API_BASE } from '../config';
import { createBasemaps } from '../data/basemaps';
import { apiFetch } from '../data/http';
import { useI18n } from '../i18n';
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
		if (!res.ok) throw new Error(`Style request returned ${res.status}`);

		return await res.json();
	} finally {
		clearTimeout(timer);
	}
};

// The basemap catalogue, the style of the active map (null until it is ready) and the reaction to a map that fails to load.
export const useBasemap = ({ config, settings, update }) => {
	const { t } = useI18n();
	const showToast = useToast();

	const basemaps = useMemo(() => createBasemaps(config?.basemaps, settings.region), [config, settings.region]);
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
		fetchStyle(url)
			.then(style => !cancelled && setFetched(current => ({ ...current, [url]: style })))
			.catch(err => {
				if (cancelled) return;

				console.warn(`Basemap "${activeName}" unavailable:`, err.message);
				fail(activeName);
			});

		return () => {
			cancelled = true;
		};
	}, [url, fetched, activeName, fail]);

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

	return { basemaps, mapStyle, handleStyleFailed };
};
