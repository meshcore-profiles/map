const i18nextMiddleware = require('i18next-http-middleware');
const { i18next, resources } = require('../global/services/i18n.js');
const { LANGUAGES, langPath } = require('../global/utils/languageResolver.js');

const isProd = process.env.NODE_ENV === 'production';

const applyLocals = (req, res, next) => {
	const lng = req.language || req.site.defaultLanguage;

	res.set('Content-Language', lng);
	res.locals.t = req.t;
	res.locals.languageCode = lng;
	res.locals.languages = LANGUAGES;
	res.locals.defaultLanguage = req.site.defaultLanguage;
	res.locals.site = req.site;
	res.locals.domain = isProd ? `https://${req.site.domain}` : req.app.locals.domain;
	res.locals.langPath = (lang, to) => langPath(lang, to, req.site.defaultLanguage);
	res.locals.lp = to => langPath(lng, to, req.site.defaultLanguage);
	res.locals.i18nBundle = resources[lng];
	res.locals.currentQuery = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '';

	next();
};

module.exports = [i18nextMiddleware.handle(i18next), applyLocals];
