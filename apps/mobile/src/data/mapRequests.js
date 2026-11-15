import { TransformRequestManager } from '@maplibre/maplibre-react-native';
import { API_BASE } from '../config';
import { USER_AGENT } from './http';

const MAP_HOSTS = String.raw`^https://([^/]+\.)?(arcgis\.com|maptiler\.com|cartocdn\.com|openstreetmap\.(org|fr)|opentopomap\.org)/`;

let installed = false;

// The map servers answer 403 to MapLibre Native's default requests: the API keys are restricted to the site's origin (the website sends it as the Referer)
// and the community tile servers (OpenStreetMap and others) require a User-Agent that identifies the app.
export const installMapRequestHeaders = () => {
	if (installed) return;

	installed = true;
	TransformRequestManager.addHeader({ id: 'map-user-agent', name: 'User-Agent', value: USER_AGENT, match: MAP_HOSTS });
	TransformRequestManager.addHeader({ id: 'map-referer', name: 'Referer', value: `${API_BASE}/`, match: MAP_HOSTS });
};
