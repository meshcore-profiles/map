import { pack, unpack } from '../vendor/msgpackr/msgpackr.js';
import { t } from './i18n.js';

import * as providers from '/core/elevation-providers.js';

export { haversineDistance, interpolate, curvatureDrop, destinationPoint, parseLatLng } from '/core/geo.js';

export const ELEVATION_PROVIDERS = providers.createElevationProviders({ getSefinekApi: () => window.MAP_CONFIG.sefinekApi, pack, unpack });

export const fetchElevations = (points, source) => providers.fetchElevations(ELEVATION_PROVIDERS, points, source);

export const fetchElevationsChunked = (points, source, onProgress) => providers.fetchElevationsChunked(ELEVATION_PROVIDERS, points, source, onProgress);

// terrain.js/coverage.js only actually query the sefinek backend - the other providers are unreliable
// public APIs (batch limits, rate limits), kept selectable only so a future fix can re-enable them.
export const requireSefinekElevationSource = (getElevationSource, showToast) => {
	const source = getElevationSource ? getElevationSource() : 'sefinek';
	if (source === 'sefinek') return true;

	showToast(t('common:elevationSourceUnsupported'), { status: 'error', duration: 6000 });
	return false;
};

export const requireFeature = (name, showToast) => {
	if (window.MAP_CONFIG.features?.[name]) return true;

	showToast(t('common:toolUnavailable'), { status: 'error', duration: 6000 });
	return false;
};
