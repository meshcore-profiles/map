const { SITES, GITHUB_URL } = require('../../../packages/core/src/sites.js');
const { DELETION_EMAIL } = require('../../../packages/core/src/deletion.js');
const DISCORD_URL = 'https://meshcorepolska.org/discord';

// Site data shared with the mobile app lives in packages/core/src/sites.js; this file adds what only the server and the views need.
const withBrand = shared => ({
	...shared,
	githubUrl: GITHUB_URL,
	discordUrl: DISCORD_URL,
	brandNameHtml: shared.brandAccent ? shared.brandName.replace(shared.brandAccent, `<strong>${shared.brandAccent}</strong>`) : shared.brandName,
});

const poland = {
	...withBrand(SITES.pl),
	defaultLanguage: 'pl',
	defaultRadio: 'EU/UK (Narrow)',
	theme: 'poland',
	themeColor: '#95010b',
	languageSwitcher: 'none',
	showRegionToggle: true,
	domain: 'mapa.meshcorepolska.org',
	testerSignup: true,
	deletionEmail: DELETION_EMAIL,
	ogImage: 'https://meshcorepolska.org/images/brand/banner-og.jpg',
	favicon: 'https://meshcorepolska.org/favicon.ico',
	icon512: 'https://meshcorepolska.org/images/brand/logo-3-512.jpg',
	appleIcon: 'https://meshcorepolska.org/images/brand/logo-3-180.jpg',
};

const global = {
	...withBrand(SITES.all),
	defaultLanguage: 'en',
	defaultRadio: 'USA/Canada (Recommended)',
	theme: 'global',
	themeColor: '#4f46e5',
	languageSwitcher: 'dropdown',
	showRegionToggle: false,
	domain: 'map.meshcoreprofiles.com',
	deletionEmail: DELETION_EMAIL,
	crossLinks: { pl: 'https://mapa.meshcorepolska.org' },
	shortName: 'MeshCore',
	ogImage: 'https://meshcoreprofiles.com/images/banner.png',
	favicon: '/favicon.ico',
	faviconSvg: '/favicon.svg',
	icon512: '/images/icon-512.png',
	appleIcon: '/apple-touch-icon.png',
};

const HOSTS = {
	[poland.domain]: poland,
	[global.domain]: global,
};

module.exports = { poland, global, HOSTS, DELETION_EMAIL, default: poland };
