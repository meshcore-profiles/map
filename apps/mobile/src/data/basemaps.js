import { createBasemapCatalog } from '@meshcore-map/core/basemaps';
import { SITES } from '@meshcore-map/core/sites';

// Raster styles carry no fonts, and the node layers draw text (cluster counts, client initials). Without `glyphs` a single text layer makes the
// whole source render nothing, so the glyph server of OpenFreeMap (which has the "Noto Sans" stacks used in NodeLayer) is attached.
const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

// A template with {r} has "@2x" tiles: they are 512 px, which MapLibre addresses one zoom level lower, so on a phone screen (2-3x density) they stay sharp.
const rasterStyle = ({ url, maxZoom, tileSize = 256, subdomains }, attribution) => {
	const retina = url.includes('{r}');
	const template = url.replace('{r}', retina ? '@2x' : '');
	const tiles = subdomains ? [...subdomains].map(s => template.replace('{s}', s)) : [template];

	return {
		version: 8,
		glyphs: GLYPHS_URL,
		sources: { base: { type: 'raster', tiles, tileSize: retina ? 512 : tileSize, maxzoom: retina ? maxZoom - 1 : maxZoom, attribution } },
		layers: [{ id: 'base', type: 'raster', source: 'base' }],
	};
};

// The catalog (names, URLs, key requirements, default and fallback order) is shared with the website; here each entry only gets a MapLibre style.
// keys: the user's own basemap API keys (none means only the maps that need no key). The native map caches tiles on disk, so maps whose terms forbid storing them (Esri) are left out.
// attributions: credits per map name (the website's "map:tilesAttribution"); the map's attribution button shows them, which the tile providers require.
export const createBasemaps = (keys, region, attributions = {}) => {
	const site = SITES[region];
	const catalog = createBasemapCatalog({ ...keys, maptilerHybridMapId: site.maptilerHybridMapId, mapLanguage: site.mapLanguage, cachesTiles: true });
	const all = catalog.basemaps.map(basemap => ({ ...basemap, style: basemap.group === 'tiles' ? rasterStyle(basemap, attributions[basemap.name]) : basemap.url }));

	return { ...catalog, all, byName: name => all.find(basemap => basemap.name === name) };
};
