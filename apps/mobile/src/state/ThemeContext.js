import { createContext, useContext } from 'react';
import { DEFAULT_THEME, getTheme, THEMES } from '@meshcore-map/core/themes';
import { useSettings } from './SettingsContext';

const ThemeContext = createContext(THEMES[DEFAULT_THEME]);

export const ThemeProvider = ({ children }) => {
	const { settings } = useSettings();

	return <ThemeContext.Provider value={getTheme(settings.region)}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
