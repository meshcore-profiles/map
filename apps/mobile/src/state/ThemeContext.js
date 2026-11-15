import { createContext, useContext } from 'react';
import { DEFAULT_THEME, getTheme, THEMES } from '@meshcore-map/core/themes';
import { useSettings } from './SettingsContext';

const ThemeContext = createContext(THEMES[DEFAULT_THEME]);

// Accent colours follow the selected map scope, like the two sites (Poland: red, worldwide: indigo).
export const ThemeProvider = ({ children }) => {
	const { settings } = useSettings();

	return <ThemeContext.Provider value={getTheme(settings.region)}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
