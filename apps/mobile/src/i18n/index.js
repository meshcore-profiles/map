import { createContext, useContext, useMemo } from 'react';
import { createI18n } from '@meshcore-map/core/i18n';
import { useSettings } from '../state/SettingsContext';
import { deviceLocale } from './deviceLocale';

// The repo-root locales/ directory is shared with the website (the same files feed the server-side i18next); mobile.json holds the app-only strings.
import plCommon from '../../../../locales/pl/common.json';
import plMap from '../../../../locales/pl/map.json';
import plFilters from '../../../../locales/pl/filters.json';
import plMeasure from '../../../../locales/pl/measure.json';
import plRoute from '../../../../locales/pl/route.json';
import plTerrain from '../../../../locales/pl/terrain.json';
import plCoverage from '../../../../locales/pl/coverage.json';
import plStats from '../../../../locales/pl/stats.json';
import plSettings from '../../../../locales/pl/settings.json';
import plMobile from '../../../../locales/pl/mobile.json';
import plLegend from '../../../../locales/pl/legend.json';
import plAppChangelog from '../../../../locales/pl/appChangelog.json';
import enCommon from '../../../../locales/en/common.json';
import enMap from '../../../../locales/en/map.json';
import enFilters from '../../../../locales/en/filters.json';
import enMeasure from '../../../../locales/en/measure.json';
import enRoute from '../../../../locales/en/route.json';
import enTerrain from '../../../../locales/en/terrain.json';
import enCoverage from '../../../../locales/en/coverage.json';
import enStats from '../../../../locales/en/stats.json';
import enSettings from '../../../../locales/en/settings.json';
import enMobile from '../../../../locales/en/mobile.json';
import enLegend from '../../../../locales/en/legend.json';
import enAppChangelog from '../../../../locales/en/appChangelog.json';

const BUNDLES = {
	pl: { common: plCommon, map: plMap, filters: plFilters, measure: plMeasure, route: plRoute, terrain: plTerrain, coverage: plCoverage, stats: plStats, settings: plSettings, mobile: plMobile, legend: plLegend, appChangelog: plAppChangelog },
	en: { common: enCommon, map: enMap, filters: enFilters, measure: enMeasure, route: enRoute, terrain: enTerrain, coverage: enCoverage, stats: enStats, settings: enSettings, mobile: enMobile, legend: enLegend, appChangelog: enAppChangelog },
};

export const resolveLanguage = preference => {
	if (preference === 'pl' || preference === 'en') return preference;

	return deviceLocale().toLowerCase().startsWith('pl') ? 'pl' : 'en';
};

const I18nContext = createContext(null);

export const I18nProvider = ({ children }) => {
	const { settings } = useSettings();
	const language = resolveLanguage(settings.language);

	const value = useMemo(() => ({ language, ...createI18n({ getBundle: () => BUNDLES[language], getLanguage: () => language }) }), [language]);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
