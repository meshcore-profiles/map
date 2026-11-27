import { createSeo } from '../../../global/utils/seo.js';

export default ({ domain, site, languageCode, languages, defaultLanguage, lp, langPath, t, cspNonce }) => {
	const current = languages.find(l => l.code === languageCode) || languages[0];
	const brand = site.shortName || site.brandName;
	const title = t('meta:title', { brand });
	const description = t('meta:description', { context: site.region });
	const appName = t('meta:webAppName', { brand });
	const path = lp('/');
	const alternates = [...languages.map(l => [l.code, l.code]), ['x-default', defaultLanguage]]
		.map(([hreflang, code]) => ({ hreflang, href: `${domain}${langPath(code, '/')}` }));

	return createSeo({
		domain,
		organization: site.organization,
		site: { name: site.brandName, schemaName: appName, languages: languages.map(l => l.htmlLang) },
		language: current.htmlLang,
		locale: current.ogLocale,
		localeAlternates: languages.filter(l => l !== current).map(l => l.ogLocale),
		title,
		description,
		keywords: t('meta:keywords'),
		canonical: path,
		alternates,
		nonce: cspNonce,
		image: { ...site.organization.image, alt: t('meta:ogImageAlt', { brand: site.brandName }) },
		app: { name: appName, description, url: path, requirements: 'Requires JavaScript', currency: site.currency },
	});
};
