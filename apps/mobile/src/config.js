import Constants from 'expo-constants';
import { SITES, toMaplibreView } from '@meshcore-map/core/sites';

const extra = Constants.expoConfig?.extra ?? {};

export const API_BASE = extra.apiBase;
export const SEFINEK_API = extra.sefinekApi ?? null;
// SHA-1 of the release signing certificate (public); CARTO checks it for a key restricted to mobile apps.
export const ANDROID_CERT_SHA1 = extra.androidCertSha1 ?? null;
export const NODES_REFRESH_AFTER_MS = 15 * 60 * 1000;
export const DEFAULT_VIEW = Object.fromEntries(Object.entries(SITES).map(([region, site]) => [region, toMaplibreView(site.defaultView)]));
