import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const API_BASE = extra.apiBase;
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export const REGIONS = ['pl', 'all'];
export const NODES_REFRESH_AFTER_MS = 15 * 60 * 1000;
export const DEFAULT_VIEW = { all: { center: [7.03, 29.98], zoom: 2.2 }, pl: { center: [19.325, 52.1537], zoom: 5.4 } };
