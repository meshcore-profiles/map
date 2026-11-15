import { createDefaultFilters } from '@meshcore-map/core/nodes';
import { readJson, writeJson } from './files';

const FILE = 'settings.json';

export const createDefaultSettings = () => ({
	region: null,
	language: 'auto',
	filters: createDefaultFilters(),
});

// Fills in fields missing after an app update and drops invalid values.
const sanitize = saved => {
	const defaults = createDefaultSettings();
	const filters = { ...defaults.filters, ...saved?.filters };

	return {
		region: saved?.region === 'all' || saved?.region === 'pl' ? saved.region : null,
		language: ['auto', 'pl', 'en'].includes(saved?.language) ? saved.language : 'auto',
		filters: {
			...filters,
			radioFilters: { ...defaults.filters.radioFilters, ...filters.radioFilters },
			clusteringZoom: Number.isInteger(filters.clusteringZoom) ? Math.min(17, Math.max(10, filters.clusteringZoom)) : 11,
		},
	};
};

export const loadSettings = async () => sanitize(await readJson(FILE));

export const saveSettings = settings => writeJson(FILE, settings);
