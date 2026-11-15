import { createBasemapCatalog } from '@meshcore-map/core/basemaps';
import { SITES } from '@meshcore-map/core/sites';

// Raster styles carry no fonts, and the node layers draw text (cluster counts, client initials). Without `glyphs` a single text layer makes the
// whole source render nothing, so the glyph server of OpenFreeMap (which has the "Noto Sans" stacks used in NodeLayer) is attached.
const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

const rasterStyle = ({ url, maxZoom, tileSize = 256, subdomains }) => {
	const template = url.replace('{r}', '');

	return {
		version: 8,
		glyphs: GLYPHS_URL,
		sources: { base: { type: 'raster', tiles: subdomains ? [...subdomains].map(s => template.replace('{s}', s)) : [template], tileSize, maxzoom: maxZoom } },
		layers: [{ id: 'base', type: 'raster', source: 'base' }],
	};
};

// The catalogue (names, URLs, key requirements, default and fallback order) is shared with the website; here each entry only gets a MapLibre style.
// keys: the basemap API keys from /api/v1/app-config (null until it loads, which leaves the maps that need no key).
export const createBasemaps = (keys, region) => {
	const site = SITES[region];
	const catalog = createBasemapCatalog({ ...keys, maptilerHybridMapId: site.maptilerHybridMapId, mapLanguage: site.mapLanguage });
	const all = catalog.basemaps.map(basemap => ({ ...basemap, style: basemap.group === 'tiles' ? rasterStyle(basemap) : basemap.url }));

	return { ...catalog, all, byName: name => all.find(basemap => basemap.name === name) };
};
