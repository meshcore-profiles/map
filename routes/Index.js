const router = require('express').Router();
const { LANGUAGES, langPath } = require('../global/utils/languageResolver.js');

router.get('/', (req, res) => res.render('index.ejs'));
router.get('/test', (req, res) => res.render('test.ejs'));

router.get('/robots.txt', (req, res) => {
	res.type('text/plain').send([
		'User-agent: *',
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
	const urls = LANGUAGES.map(({ code }) => `\t<url>
\t\t<loc>https://${req.site.domain}${langPath(code, '/', req.site.defaultLanguage)}</loc>
\t\t<priority>${code === req.site.defaultLanguage ? '1.00' : '0.80'}</priority>
\t</url>`).join('\n');

	res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urls}
</urlset>
`);
});

router.get('/manifest.json', (req, res) => {
	const { site } = res.locals;
	const shortName = site.shortName || site.brandName;

	res.json({
		name: req.t('meta:title', { brand: shortName }),
		short_name: shortName,
		description: req.t('meta:description'),
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

module.exports = router;
