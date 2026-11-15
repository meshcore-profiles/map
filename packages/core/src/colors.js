// Colours shared by the website (JS parts) and the mobile app. CSS keeps its own variables (public/css/global.css).
export const PALETTE = {
	blue: '#4dabf7',
	green: '#2dd881',
	amber: '#f2b134',
	red: '#e01230',
	redBright: '#ff3352',
	violet: '#b197fc',
	textMuted: '#99a1b5',
};

export const STATUS_COLORS = {
	none: '#667b89',
	recent: '#319712',
	stale: '#e4af00',
	old: '#e35e3a',
	extinct: '#787878',
};

export const NODE_TYPE_COLORS = { 1: '#ffffff', 2: PALETTE.blue, 3: PALETTE.amber, 4: PALETTE.violet };

export const NODE_TYPE_ICON_NAMES = { 1: 'client', 2: 'repeater', 3: 'room-server', 4: 'sensor' };
