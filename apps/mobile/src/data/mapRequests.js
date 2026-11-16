import { TransformRequestManager } from '@maplibre/maplibre-react-native';
import { appIdentityHeaders } from '@meshcore-map/core/app-identity';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ANDROID_CERT_SHA1, API_BASE } from '../config';
import { USER_AGENT } from './http';

const MAP_HOSTS = String.raw`^https://([^/]+\.)?(maptiler\.com|cartocdn\.com|openfreemap\.org|openstreetmap\.(org|fr)|opentopomap\.org)/`;

const CARTO_HOSTS = String.raw`^https://([^/]+\.)?cartocdn\.com/`;

let installed = false;

// The map servers answer 403 to MapLibre Native's default requests: the API keys are restricted to the site's origin (the website sends it as the Referer)
// and the community tile servers (OpenStreetMap and others) require a User-Agent that identifies the app.
export const installMapRequestHeaders = () => {
	if (installed) return;

	installed = true;
	TransformRequestManager.addHeader({ id: 'map-user-agent', name: 'User-Agent', value: USER_AGENT, match: MAP_HOSTS });
	TransformRequestManager.addHeader({ id: 'map-referer', name: 'Referer', value: `${API_BASE}/`, match: MAP_HOSTS });

	// A CARTO key can be restricted to this app: the tile server then expects the app's identity, which a request from the native map does not carry by itself.
	const identity = appIdentityHeaders({
		platform: Platform.OS,
		androidPackage: Constants.expoConfig?.android?.package,
		androidCertSha1: ANDROID_CERT_SHA1,
		iosBundleId: Constants.expoConfig?.ios?.bundleIdentifier,
	});
	for (const [name, value] of Object.entries(identity)) TransformRequestManager.addHeader({ id: `carto-${name.toLowerCase()}`, name, value, match: CARTO_HOSTS });
};
