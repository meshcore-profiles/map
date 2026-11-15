import { useEffect, useState } from 'react';
import { pack, unpack } from 'msgpackr';
import { createElevationProviders, fetchElevations, fetchElevationsChunked } from '@meshcore-map/core/elevation-providers';
import { normalizeRadioPresets } from '@meshcore-map/core/presets';
import { API_BASE } from '../config';
import { readJson, writeJson } from '../storage/files';

const CONFIG_FILE = 'app-config.json';
const PRESETS_FILE = 'radio-presets.json';

const getJson = async path => {
	const res = await fetch(`${API_BASE}${path}`);
	if (!res.ok) throw new Error(`${path} returned ${res.status}`);

	return (await res.json()).data;
};

// From the network, falling back to the last saved copy when offline.
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

let configPromise = null;

export const loadAppConfig = () => {
	configPromise ??= loadWithCache('/api/v1/app-config', CONFIG_FILE).catch(err => {
		configPromise = null;
		throw err;
	});

	return configPromise;
};

export const loadRadioPresets = async () => normalizeRadioPresets(await loadWithCache('/api/v1/radio-presets', PRESETS_FILE));

export const useAppConfig = () => {
	const [config, setConfig] = useState(null);

	useEffect(() => {
		loadAppConfig().then(setConfig).catch(err => console.error('Failed to load app config:', err));
	}, []);

	return config;
};

export const createProviders = sefinekApi => createElevationProviders({ getSefinekApi: () => sefinekApi, pack, unpack });

export const getElevations = (sefinekApi, points) => fetchElevations(createProviders(sefinekApi), points, 'sefinek');

export const getElevationsChunked = (sefinekApi, points, onProgress) => fetchElevationsChunked(createProviders(sefinekApi), points, 'sefinek', onProgress);
