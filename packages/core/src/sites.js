// Data of the two public sites that the website, its server config (apps/web/config/sites.js) and the mobile app all need.
// Keyed by region: 'pl' is the Polish site, 'all' the global one.
export const GITHUB_URL = 'https://github.com/meshcore-profiles/map';

export const SITES = {
	pl: {
		region: 'pl',
		defaultRegion: 'pl',
		defaultView: { lat: 52.1537, lon: 19.3250, zoom: 7 },
		mapLanguage: 'pl',
		maptilerHybridMapId: '01a04259-c91e-7408-8c84-e27953c48bf2',
		addNodeUrl: 'https://docs.meshcorepolska.org/faq#512-jak-dodac-wezel-do-mapy-meshcore',
		brandName: 'MeshCore Polska',
		brandAccent: 'Polska',
		brandUrl: 'https://meshcorepolska.org',
		logo: 'https://meshcorepolska.org/images/brand/logo-1-80.jpg',
		icon192: 'https://meshcorepolska.org/images/brand/logo-3-192.jpg',
	},
	all: {
		region: 'all',
		defaultRegion: 'all',
		defaultView: { lat: 29.9836, lon: 7.0313, zoom: 3 },
		mapLanguage: 'local',
		maptilerHybridMapId: '01a04275-e76d-714c-a0c9-bcd41ea874cd',
		addNodeUrl: 'https://github.com/meshcore-dev/MeshCore/blob/main/docs/faq.md#512-q-how-do-i-add-a-node-to-the-meshcore-map',
		brandName: 'MeshCore Map',
		brandAccent: '',
		brandUrl: 'https://meshcoreprofiles.com',
		logo: '/images/logo-512.svg',
		icon192: '/images/icon-192.png',
	},
};

// Leaflet counts zoom levels for 256 px tiles and MapLibre for 512 px ones, so the same view is one level lower there.
export const toMaplibreView = ({ lat, lon, zoom }) => ({ center: [lon, lat], zoom: zoom - 1 });
