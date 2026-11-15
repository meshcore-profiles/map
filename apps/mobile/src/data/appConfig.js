import { useEffect, useState } from 'react';
import { pack, unpack } from 'msgpackr';
import { createElevationProviders, fetchElevations, fetchElevationsChunked } from '@meshcore-map/core/elevation-providers';
import { normalizeRadioPresets } from '@meshcore-map/core/presets';
import { API_BASE, SEFINEK_API } from '../config';
import { readJson, writeJson } from '../storage/files';
import { apiFetch } from './http';

const CONFIG_FILE = 'app-config.json';
const PRESETS_FILE = 'radio-presets.json';

const getJson = async path => {
	const res = await apiFetch(`${API_BASE}${path}`);
	if (!res.ok) throw new Error(`${path} returned ${res.status}`);

	return (await res.json()).data;
};

const loadWithCache = async (path, file) => {
	try {
		const data = await getJson(path);
		await writeJson(file, data);
		return data;
	} catch (err) {
		const cached = await readJson(file);
		if (cached) return cached;

		throw err;
	}
};

// Used when the server predates /api/v1/app-config (404) or sends only part of it: the tools stay available instead of silently turning off.
const DEFAULT_CONFIG = { features: { terrain: true, coverage: true }, sefinekApi: SEFINEK_API };

const withDefaults = data => ({ ...DEFAULT_CONFIG, ...data, features: { ...DEFAULT_CONFIG.features, ...data?.features }, sefinekApi: data?.sefinekApi ?? DEFAULT_CONFIG.sefinekApi });

let configPromise = null;

// The saved copy is used at once and refreshed in the background (changed keys apply on the next launch), so the map never waits for the network.
export const loadAppConfig = () => {
	configPromise ??= (async () => {
		const cached = await readJson(CONFIG_FILE);
		const fresh = getJson('/api/v1/app-config').then(async data => {
			await writeJson(CONFIG_FILE, data);
			return data;
		});

		if (cached) {
			fresh.catch(err => console.warn('App config not refreshed:', err.message));
			return withDefaults(cached);
		}

		return withDefaults(await fresh);
	})().catch(err => {
		console.warn('App config unavailable, using built-in defaults:', err.message);
		return DEFAULT_CONFIG;
	});

	return configPromise;
};

let presetsPromise = null;

// Fetched once per session (the node sheet and the coverage tool both need them); a failure is not remembered, so the next call retries.
export const loadRadioPresets = () => {
	presetsPromise ??= loadWithCache('/api/v1/radio-presets', PRESETS_FILE).then(normalizeRadioPresets).catch(err => {
		presetsPromise = null;
		throw err;
	});

	return presetsPromise;
};

export const useAppConfig = () => {
	const [config, setConfig] = useState(null);

	useEffect(() => {
		loadAppConfig().then(setConfig).catch(err => console.error('Failed to load app config:', err));
	}, []);

	return config;
};

export const createProviders = sefinekApi => createElevationProviders({ getSefinekApi: () => sefinekApi, pack, unpack, fetchImpl: apiFetch });

export const getElevations = (sefinekApi, points, source = 'sefinek') => fetchElevations(createProviders(sefinekApi), points, source);

export const getElevationsChunked = (sefinekApi, points, onProgress, source = 'sefinek') => fetchElevationsChunked(createProviders(sefinekApi), points, source, onProgress);
