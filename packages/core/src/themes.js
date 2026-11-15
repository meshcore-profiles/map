// Accent colours of the two sites (the --red* variables in apps/web/public/css/themes/{global,poland}.css; test/themes.test.js keeps them in sync).
export const THEMES = {
	global: {
		accent: '#6366f1',
		accentBright: '#818cf8',
		accentLight: '#c7d2fe',
		accentDark: '#4338ca',
		accentGlow: 'rgba(99, 102, 241, 0.35)',
	},
	poland: {
		accent: '#e01230',
		accentBright: '#ff3352',
		accentLight: '#ff7d92',
		accentDark: '#b30d26',
		accentGlow: 'rgba(224, 18, 48, 0.35)',
	},
};

export const DEFAULT_THEME = 'global';

// The same split as the two sites: the Polish site shows region "pl", the global one "all".
export const THEME_BY_REGION = { pl: 'poland', all: 'global' };

export const getTheme = region => THEMES[THEME_BY_REGION[region] ?? DEFAULT_THEME];
