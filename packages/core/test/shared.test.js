import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createBasemapCatalog, DEFAULT_BASEMAP_SELECTION, ESRI_HYBRID_NAME, MAPTILER_HYBRID_NAME, OPENSTREETMAP_NAME } from '../src/basemaps.js';
import { countByType, nodesInsertedSince, STATS_PERIOD_DAYS } from '../src/nodes.js';
import { SITES, toMaplibreView } from '../src/sites.js';

test('basemap catalogue without keys offers only the free maps', () => {
	const catalog = createBasemapCatalog({});
	assert.equal(catalog.defaultName, OPENSTREETMAP_NAME);
	assert.deepEqual(catalog.fallbackChain, [OPENSTREETMAP_NAME]);
	assert.equal(catalog.byName(ESRI_HYBRID_NAME), undefined);
	assert.equal(catalog.isMissingKey(ESRI_HYBRID_NAME), true);
	assert.equal(catalog.isMissingKey(OPENSTREETMAP_NAME), false);
	assert.equal(catalog.isMissingKey('Unknown map'), false);
});

test('basemap catalogue with keys prefers Esri, then MapTiler, and chains the fallbacks', () => {
	const catalog = createBasemapCatalog({ esriApiKey: ' abc ', maptilerApiKey: 'mt', cartoApiKey: 'ct', maptilerHybridMapId: 'id', mapLanguage: 'pl' });
	assert.equal(catalog.defaultName, ESRI_HYBRID_NAME);
	assert.equal(catalog.resolve(DEFAULT_BASEMAP_SELECTION), ESRI_HYBRID_NAME);
	assert.equal(catalog.nextFallback(ESRI_HYBRID_NAME), MAPTILER_HYBRID_NAME);
	assert.equal(catalog.nextFallback(OPENSTREETMAP_NAME), undefined);
	assert.match(catalog.byName(ESRI_HYBRID_NAME).url, /language=pl&token=abc$/);
	assert.match(catalog.byName(MAPTILER_HYBRID_NAME).url, /maps\/id\/style\.json\?key=mt$/);
});

test('a site defines its default view and the server config reuses it', () => {
	assert.deepEqual(toMaplibreView(SITES.pl.defaultView), { center: [19.325, 52.1537], zoom: 6 });

	const { poland, global } = createRequire(import.meta.url)('../../../apps/web/config/sites.js');
	assert.deepEqual(poland.defaultView, SITES.pl.defaultView);
	assert.equal(global.brandNameHtml, SITES.all.brandName);
	assert.equal(poland.brandNameHtml, 'MeshCore <strong>Polska</strong>');
});

test('statistics helpers count nodes by type and by insert date', () => {
	const now = Date.now();
	const node = (type, daysAgo) => ({ type, insertDate: new Date(now - daysAgo * 86400000) });
	const nodes = [node(1, 0.5), node(2, 3), node(2, 20), node(3, 40), node(4, 1)];

	assert.deepEqual(countByType(nodes), { clients: 1, repeaters: 2, roomServers: 1 });
	assert.equal(nodesInsertedSince(nodes, STATS_PERIOD_DAYS['24h'], now).length, 1);
	assert.equal(nodesInsertedSince(nodes, STATS_PERIOD_DAYS['7d'], now).length, 3);
	assert.equal(nodesInsertedSince(nodes, STATS_PERIOD_DAYS['30d'], now).length, 4);
});
