import { Router } from 'express';
import { LANGUAGES, langPath } from '../../../global/utils/languageResolver.js';
import { createSitemap } from '../../../global/utils/sitemap.js';
import { createRobots } from '../../../global/utils/robots.js';

const router = Router();

router.get('/', (req, res) => res.render('index.ejs'));
if (process.env.NODE_ENV !== 'production') router.get('/test', (req, res) => res.render('test.ejs'));

router.get('/robots.txt', createRobots({ allow: ['/api/v1/nodes', '/api/v1/radio-presets'], disallow: ['/api/'] }));

router.get('/sitemap.xml', createSitemap((domain, req) => {
	const { defaultLanguage } = req.site;
	const href = code => langPath(code, '/', defaultLanguage);
	const alternates = [...LANGUAGES.map(({ code }) => [code, code]), ['x-default', defaultLanguage]]
		.map(([hreflang, code]) => ({ hreflang, href: href(code) }));

	return LANGUAGES.map(({ code }) => ({ loc: href(code), lastmod: req.app.locals.releaseDate, alternates }));
}));

router.get('/manifest.webmanifest', (req, res) => {
	const { site } = res.locals;
	const shortName = site.shortName || site.brandName;

	res.type('application/manifest+json').json({
		name: req.t('meta:title', { brand: shortName }),
		short_name: shortName,
		description: req.t('meta:description', { context: site.region }),
		lang: site.defaultLanguage,
		start_url: '/',
		display: 'standalone',
		background_color: site.themeColor,
		theme_color: site.themeColor,
		icons: [
			{ src: site.icon192, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
			{ src: site.icon512, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
		],
	});
});

export default router;
