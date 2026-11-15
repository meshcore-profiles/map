import { createContext, useContext, useMemo } from 'react';
import { createI18n } from '@meshcore-map/core/i18n';
import { useSettings } from '../state/SettingsContext';

// Translations shared with the website (apps/web/locales) plus the mobile-only ones (apps/mobile/locales).
import plCommon from '../../../web/locales/pl/common.json';
import plMap from '../../../web/locales/pl/map.json';
import plFilters from '../../../web/locales/pl/filters.json';
import plMeasure from '../../../web/locales/pl/measure.json';
import plRoute from '../../../web/locales/pl/route.json';
import plTerrain from '../../../web/locales/pl/terrain.json';
import plCoverage from '../../../web/locales/pl/coverage.json';
import plMobile from '../../locales/pl/mobile.json';
import enCommon from '../../../web/locales/en/common.json';
import enMap from '../../../web/locales/en/map.json';
import enFilters from '../../../web/locales/en/filters.json';
import enMeasure from '../../../web/locales/en/measure.json';
import enRoute from '../../../web/locales/en/route.json';
import enTerrain from '../../../web/locales/en/terrain.json';
import enCoverage from '../../../web/locales/en/coverage.json';
import enMobile from '../../locales/en/mobile.json';

const BUNDLES = {
	pl: { common: plCommon, map: plMap, filters: plFilters, measure: plMeasure, route: plRoute, terrain: plTerrain, coverage: plCoverage, mobile: plMobile },
	en: { common: enCommon, map: enMap, filters: enFilters, measure: enMeasure, route: enRoute, terrain: enTerrain, coverage: enCoverage, mobile: enMobile },
};

export const resolveLanguage = preference => {
	if (preference === 'pl' || preference === 'en') return preference;

	const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en';
	return locale.toLowerCase().startsWith('pl') ? 'pl' : 'en';
};

const I18nContext = createContext(null);

export const I18nProvider = ({ children }) => {
	const { settings } = useSettings();
	const language = resolveLanguage(settings.language);

	const value = useMemo(() => ({ language, ...createI18n({ getBundle: () => BUNDLES[language], getLanguage: () => language }) }), [language]);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
