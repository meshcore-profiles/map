import { Router } from 'express';
import { LANGUAGES, langPath } from '../../../global/utils/languageResolver.js';

const router = Router();

router.get('/', (req, res) => res.render('index.ejs'));
if (process.env.NODE_ENV !== 'production') router.get('/test', (req, res) => res.render('test.ejs'));

router.get('/robots.txt', (req, res) => {
	res.type('text/plain').send([
		'User-agent: *',
		'Disallow: /api/',
		'Disallow: /cdn-cgi',
		'Disallow: /cdn-cgi/',
		'Disallow: /.well-known',
		'Disallow: /.well-known/',
		'',
		`Sitemap: https://${req.site.domain}/sitemap.xml`,
		'',
	].join('\n'));
});

router.get('/sitemap.xml', (req, res) => {
	const { domain, defaultLanguage } = req.site;
	const lastmod = req.app.locals.releaseDate;
	const href = code => `https://${domain}${langPath(code, '/', defaultLanguage)}`;
	const urls = LANGUAGES.map(({ code }) => `\t<url>
\t\t<loc>${href(code)}</loc>${lastmod ? `\n\t\t<lastmod>${lastmod}</lastmod>` : ''}
\t</url>`).join('\n');

	// The browser's built-in XML viewer needs inline script and style, which the global CSP blocks
	res.removeHeader('Content-Security-Policy');
	res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urls}
</urlset>
`);
});

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
