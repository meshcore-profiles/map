import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { basemapFailureReason, mergeApiKeys, resolveBasemap, withBasemapFailure } from '@meshcore-map/core/basemaps';
import { API_BASE } from '../config';
import { createBasemaps } from '../data/basemaps';
import { apiFetch } from '../data/http';
import { useI18n } from '../i18n';
import { readJson, writeJson } from '../storage/files';
import { useToast } from '../ui/Toast';

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
	} catch (err) {
		// status 0: the request got no answer (offline, timeout); the fallback message explains the failure with it.
		throw err.status ? err : Object.assign(err, { status: 0 });
	} finally {
		clearTimeout(timer);
	}
};

const styleFile = name => `basemap-style-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;

// The last style that loaded is kept so the app can start offline (the tiles come from the native map cache). Only a network failure falls back to it:
// a refused request (e.g. a revoked key) must not be answered with an old copy.
const loadStyle = async (name, url) => {
	try {
		const style = await fetchStyle(url);
		writeJson(styleFile(name), style).catch(err => console.warn('Basemap style not saved:', err.message));

		return style;
	} catch (err) {
		const saved = err.status ? null : await readJson(styleFile(name));
		if (saved) return saved;

		throw err;
	}
};

export const useBasemap = ({ config, settings, update }) => {
	const { t, tRaw } = useI18n();
	const showToast = useToast();

	const attributions = useMemo(() => tRaw('map:tilesAttribution') ?? {}, [tRaw]);
	// The app's own keys from the server, replaced by the ones the user entered.
	const basemaps = useMemo(() => createBasemaps(mergeApiKeys(config?.basemaps, settings.apiKeys), settings.region, attributions), [config, settings.apiKeys, settings.region, attributions]);
	// Maps that failed to load in this session. The wanted map is replaced only for the session: saving the fallback would keep the app on it for good, even after the keys are fixed or the network is back.
	const [failures, setFailures] = useState({});
	// The native side can report one failing style several times, so a failure is recognised against the latest value, not the one of the last render.
	const failuresRef = useRef(failures);
	useEffect(() => {
		failuresRef.current = failures;
	}, [failures]);

	// New keys or a new scope change what can load, so earlier failures no longer apply.
	useEffect(() => {
		failuresRef.current = {};
		setFailures({});
	}, [settings.apiKeys, settings.region]);

	const { wanted, active, usingFallback, followsDefault } = useMemo(() => resolveBasemap({ catalog: basemaps, selected: settings.basemap, failures }), [basemaps, settings.basemap, failures]);
	// What the default comes to right now, after the fallbacks.
	const defaultResolved = useMemo(() => resolveBasemap({ catalog: basemaps, selected: null, failures }).active, [basemaps, failures]);
	const activeBasemap = basemaps.byName(active);
	const url = typeof activeBasemap.style === 'string' ? activeBasemap.style : null;

	const [fetched, setFetched] = useState({});

	const failureText = useCallback((name, status) => t(`map:basemapFailure.${basemapFailureReason(status, { requiresKey: Boolean(basemaps.byName(name)?.requires) })}`, { status }), [basemaps, t]);
	const describeFailure = useCallback(name => failures[name] ? failureText(name, failures[name].status) : null, [failures, failureText]);

	const fail = useCallback((name, status) => {
		const next = withBasemapFailure(failuresRef.current, name, status);
		if (next === failuresRef.current) return;

		failuresRef.current = next;
		setFailures(next);

		const reason = failureText(name, status);
		const { active: fallback } = resolveBasemap({ catalog: basemaps, selected: settings.basemap, failures: next });
		const message = fallback === name ? t('map:basemapAllFailed', { reason }) : t('map:basemapFallback', { failed: name, reason, fallback });
		showToast(message, { status: 'error', group: 'basemap' });
	}, [basemaps, settings.basemap, failureText, showToast, t]);

	// Choosing a map also retries it if it failed earlier. null follows the default, so the user gets a new default if it ever changes.
	const selectBasemap = useCallback(name => {
		const target = name ?? basemaps.defaultName;
		const next = Object.fromEntries(Object.entries(failuresRef.current).filter(([failed]) => failed !== target));
		failuresRef.current = next;
		setFailures(next);
		update({ basemap: name });
	}, [basemaps.defaultName, update]);

	useEffect(() => {
		if (!url || fetched[url]) return undefined;

		let cancelled = false;
		loadStyle(active, url)
			.then(style => !cancelled && setFetched(current => ({ ...current, [url]: style })))
			.catch(err => {
				if (cancelled) return;

				console.warn(`Basemap "${active}" unavailable:`, err.message);
				fail(active, err.status);
			});

		return () => {
			cancelled = true;
		};
	}, [url, fetched, active, fail]);

	// Raster styles are built locally; comparing the serialised form keeps the map from reloading an identical one when the config arrives.
	const rasterKey = url ? null : JSON.stringify(activeBasemap.style);
	const rasterStyle = useMemo(() => activeBasemap.style, [rasterKey]);
	const mapStyle = url ? fetched[url] ?? null : rasterStyle;

	// A saved map whose key is gone is dropped (with a note), instead of failing on every launch.
	useEffect(() => {
		if (config && basemaps.isMissingKey(settings.basemap)) {
			showToast(t('map:basemapMissingApiKey', { name: settings.basemap }), { status: 'error', group: 'basemap' });
			update({ basemap: null });
		}
	}, [config, basemaps, settings.basemap, showToast, t, update]);

	// A tile or glyph request failing later reaches us from the native map, without a status.
	const handleStyleFailed = useCallback(() => fail(active), [fail, active]);

	return { basemaps, mapStyle, attribution: attributions[active], handleStyleFailed, selectBasemap, basemapView: { wanted, active, usingFallback, followsDefault, defaultResolved, describeFailure } };
};
