// Data of the two public sites that the website, its server config (apps/web/config/sites.js) and the mobile app all need.
// Keyed by region: 'pl' is the Polish site, 'all' the global one.
export const GITHUB_URL = 'https://github.com/meshcore-profiles/map';

export const SITES = {
	pl: {
		region: 'pl',
		defaultRegion: 'pl',
		defaultRadio: 'EU/UK (Narrow)',
		defaultView: { lat: 52.1537, lon: 19.3250, zoom: 7 },
		mapLanguage: 'pl',
		maptilerHybridMapId: '01a2184a-c31a-711b-822f-03cdb53ef889',
		addNodeUrl: 'https://docs.meshcorepolska.org/faq#512-jak-dodac-wezel-do-mapy-meshcore',
		brandName: 'MeshCore Polska',
		brandAccent: 'Polska',
		brandUrl: 'https://meshcorepolska.org',
		logo: 'https://meshcorepolska.org/images/brand/logo-1-80.jpg',
		icon192: 'https://meshcorepolska.org/images/brand/logo-3-192.jpg',
		mobileLogo: 'https://meshcorepolska.org/images/logo/android-chrome-192x192.png',
	},
	all: {
		region: 'all',
		defaultRegion: 'all',
		defaultRadio: 'USA/Canada (Recommended)',
		defaultView: { lat: 29.9836, lon: 7.0313, zoom: 3 },
		mapLanguage: 'local',
		maptilerHybridMapId: '01a21852-1709-7f17-bcf2-2ed39e14754b',
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

// Map scope for a device locale tag ("pl-PL", "en_PL", "pl"): Poland for the PL region (or a bare Polish language), the worldwide map otherwise.
// Like the two sites, which each default to one scope; here the device region picks it.
export const regionForLocale = tag => {
	const [language, ...subtags] = String(tag ?? '').split(/[-_]/);
	const extension = subtags.findIndex(subtag => subtag.length === 1);
	const region = (extension === -1 ? subtags : subtags.slice(0, extension)).find(subtag => (/^[A-Za-z]{2}$/).test(subtag));

	if (region) return region.toUpperCase() === 'PL' ? 'pl' : 'all';
	return language.toLowerCase() === 'pl' ? 'pl' : 'all';
};
