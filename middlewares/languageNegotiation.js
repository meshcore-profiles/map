const { langPath, negotiatePreferred, getLangCookie, AVAILABLE_LANGUAGES, isLanguageAgnosticPath } = require('../global/utils/languageResolver.js');

const isProd = process.env.NODE_ENV === 'production';
const LANG_COOKIE_OPTIONS = { maxAge: 31536000000, httpOnly: true, sameSite: 'lax', secure: isProd, path: '/' };

const languageNegotiation = (req, res, next) => {
	if (req.method !== 'GET' || isLanguageAgnosticPath(req.path)) return next();

	const defaultLanguage = req.site.defaultLanguage;

	const setLang = req.query.setlang;
	if (setLang) {
		const valid = AVAILABLE_LANGUAGES.has(setLang);
		if (valid) res.cookie('lang', setLang, LANG_COOKIE_OPTIONS);

		const rest = { ...req.query };
		delete rest.setlang;
		const query = new URLSearchParams(rest).toString();
		const target = langPath(valid ? setLang : (req.forcedLanguage || defaultLanguage), req.path, defaultLanguage);
		return res.redirect(302, query ? `${target}?${query}` : target);
	}

	if (req.forcedLanguage) return next();
	if (req.site.languageSwitcher === 'none') return next();

	res.vary('Accept-Language');
	res.vary('Cookie');

	const cookie = getLangCookie(req);
	const accept = req.headers['accept-language'];
	if (!cookie && !accept) return next();

	const preferred = negotiatePreferred(cookie, accept);
	if (preferred && preferred !== defaultLanguage) return res.redirect(302, langPath(preferred, req.url, defaultLanguage));

	next();
};

module.exports = languageNegotiation;
module.exports.LANG_COOKIE_OPTIONS = LANG_COOKIE_OPTIONS;
