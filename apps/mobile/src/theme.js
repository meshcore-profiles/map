// Values match public/css/global.css (the map's dark theme).
export const colors = {
	bg: '#12151c',
	panel: '#1c2029',
	panelHover: '#262b38',
	border: 'rgba(148, 166, 204, 0.25)',
	text: '#eef1f8',
	textMuted: '#99a1b5',
	green: '#2dd881',
	blue: '#4dabf7',
	amber: '#f2b134',
	red: '#e01230',
	redBright: '#ff3352',
	violet: '#b197fc',
	statusNone: '#667b89',
	statusRecent: '#319712',
	statusStale: '#e4af00',
	statusOld: '#e35e3a',
	statusExtinct: '#787878',
};

export const statusColors = {
	none: colors.statusNone,
	recent: colors.statusRecent,
	stale: colors.statusStale,
	old: colors.statusOld,
	extinct: colors.statusExtinct,
};

export const typeColors = { 1: '#ffffff', 2: colors.blue, 3: colors.amber, 4: colors.violet };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 20 };
export const MIN_TOUCH = 44;
