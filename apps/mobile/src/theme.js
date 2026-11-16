import { NODE_TYPE_ICON_NAMES, PALETTE } from '@meshcore-map/core/colors';

// Neutral palette shared by both themes (public/css/global.css). Accent colors depend on the theme: see state/ThemeContext.js.
export const colors = {
	bg: '#12151c',
	panel: 'rgba(26, 29, 38, 0.92)',
	panelSolid: '#1c2029',
	panelHover: '#262b38',
	chip: 'rgba(148, 166, 204, 0.12)',
	border: 'rgba(148, 166, 204, 0.16)',
	borderStrong: 'rgba(148, 166, 204, 0.3)',
	text: '#eef1f8',
	qrDark: '#000000',
	qrLight: '#ffffff',
	...PALETTE,
};

export const NODE_TYPE_ICONS = Object.fromEntries(Object.entries(NODE_TYPE_ICON_NAMES).map(([type, name]) => [type, `${name}-plain`]));

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 20 };
export const MIN_TOUCH = 44;

export const pill = { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingVertical: 10, paddingLeft: 14, paddingRight: 18, borderRadius: 999, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.panelSolid };

export const shadow = { elevation: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } };
