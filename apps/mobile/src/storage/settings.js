import { normalizeBasemapSelection, sanitizeCustomApiKeys } from '@meshcore-map/core/basemaps';
import { createDefaultFilters } from '@meshcore-map/core/nodes';
import { regionForLocale } from '@meshcore-map/core/sites';
import { deviceLocale } from '../i18n/deviceLocale';
import { readJson, writeJson } from './files';

const FILE = 'settings.json';

export const ELEVATION_SOURCES = ['sefinek', 'open-elevation', 'open-meteo'];

export const createDefaultSettings = () => ({
	region: regionForLocale(deviceLocale()),
	language: 'auto',
	// The map the user chose; null follows the default.
	basemap: null,
	apiKeys: {},
	rotateTilt: false,
	haptics: true,
	closeFiltersOnApply: true,
	elevationSource: 'sefinek',
	coverageStyle: 'tiles',
	filters: createDefaultFilters(),
});

const sanitize = saved => {
	const defaults = createDefaultSettings();
	const filters = { ...defaults.filters, ...saved?.filters };

	return {
		// First launch (or an unusable value): the scope follows the device region, like each site defaults to its own.
		region: saved?.region === 'all' || saved?.region === 'pl' ? saved.region : defaults.region,
		language: ['auto', 'pl', 'en'].includes(saved?.language) ? saved.language : 'auto',
		basemap: normalizeBasemapSelection(saved?.basemap),
		apiKeys: sanitizeCustomApiKeys(saved?.apiKeys),
		rotateTilt: saved?.rotateTilt === true,
		haptics: saved?.haptics !== false,
		closeFiltersOnApply: saved?.closeFiltersOnApply !== false,
		elevationSource: ELEVATION_SOURCES.includes(saved?.elevationSource) ? saved.elevationSource : 'sefinek',
		coverageStyle: saved?.coverageStyle === 'lines' ? 'lines' : 'tiles',
		filters: {
			...filters,
			radioFilters: { ...defaults.filters.radioFilters, ...filters.radioFilters },
			clusteringZoom: Number.isInteger(filters.clusteringZoom) ? Math.min(17, Math.max(10, filters.clusteringZoom)) : 11,
		},
	};
};

export const loadSettings = async () => sanitize(await readJson(FILE));

export const saveSettings = settings => writeJson(FILE, settings);
