import { createI18n } from '/core/i18n.js';

export const { t, tRaw, plural } = createI18n({
	getBundle: () => window.MAP_CONFIG.i18n,
	getLanguage: () => window.MAP_CONFIG.languageCode,
});
