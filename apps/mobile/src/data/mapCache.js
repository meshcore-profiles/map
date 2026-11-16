import { OfflineManager } from '@maplibre/maplibre-react-native';

// The native map keeps the tiles it has shown in an HTTP cache that honors the providers' cache headers, like a browser does, so places already
// seen stay available offline. The default (50 MB) fills quickly with satellite imagery, hence the larger limit. Tile packs are deliberately not downloaded:
// the providers' terms (OpenStreetMap, Esri, MapTiler and others) forbid bulk downloading, and the website lets the browser cache the same way.
const AMBIENT_CACHE_BYTES = 150 * 1024 * 1024;

export const configureMapCache = () => OfflineManager.setMaximumAmbientCacheSize(AMBIENT_CACHE_BYTES).catch(err => console.warn('Map cache size not set:', err.message));
