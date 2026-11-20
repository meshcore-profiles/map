import test from 'node:test';
import assert from 'node:assert/strict';
import { global, poland } from '../../../apps/web/config/sites.js';
import { appIdentityHeaders, normalizeCertSha1 } from '../src/app-identity.js';
import { buildAndroidIntentUrl, isAndroid, isMapLink } from '../src/app-link.js';
import { BASEMAP_CATEGORIES, basemapFailureReason, CARTO_DARK_NAME, createBasemapCatalog, ESRI_HYBRID_NAME, MAPTILER_HYBRID_NAME, mergeApiKeys, normalizeBasemapSelection, OPENFREEMAP_NAME, OPENSTREETMAP_NAME, resolveBasemap, sanitizeApiKey, sanitizeCustomApiKeys, withBasemapFailure } from '../src/basemaps.js';
import { countByType, nodesInsertedSince, STATS_PERIOD_DAYS } from '../src/nodes.js';
import { SITES, toMaplibreView } from '../src/sites.js';
import { toastDuration } from '../src/toast.js';
import { parseAppVersion } from '../src/version.js';

test('basemap catalog without keys defaults to the keyless OpenStreetMap', () => {
	const catalog = createBasemapCatalog({});
	assert.equal(catalog.defaultName, OPENSTREETMAP_NAME);
	assert.deepEqual(catalog.fallbackChain, [OPENSTREETMAP_NAME, OPENFREEMAP_NAME]);
	assert.equal(catalog.byName(ESRI_HYBRID_NAME), undefined);
	assert.equal(catalog.isMissingKey(ESRI_HYBRID_NAME), true);
	assert.equal(catalog.isMissingKey(OPENSTREETMAP_NAME), false);
	assert.equal(catalog.isMissingKey('Unknown map'), false);

	const esri = catalog.listed.find(item => item.name === ESRI_HYBRID_NAME);
	assert.deepEqual([esri.disabled, esri.reason], [true, 'key']);
	assert.deepEqual(catalog.listed.find(item => item.name === OPENFREEMAP_NAME), { name: OPENFREEMAP_NAME, group: 'vector', category: 'maps', disabled: false, reason: null, isDefault: false });
});

test('the default is the first available map by priority: Esri, CARTO Dark, OpenStreetMap, OpenFreeMap', () => {
	const all = createBasemapCatalog({ esriApiKey: ' abc ', maptilerApiKey: 'm&t', cartoApiKey: 'ct', maptilerHybridMapId: 'id', mapLanguage: 'pl' });
	assert.equal(all.defaultName, ESRI_HYBRID_NAME);
	assert.deepEqual(all.fallbackChain, [ESRI_HYBRID_NAME, CARTO_DARK_NAME, OPENSTREETMAP_NAME, OPENFREEMAP_NAME]);
	assert.match(all.byName(ESRI_HYBRID_NAME).url, /language=pl&token=abc$/);
	assert.match(all.byName(MAPTILER_HYBRID_NAME).url, /maps\/id\/style\.json\?key=m%26t$/);

	assert.equal(createBasemapCatalog({ cartoApiKey: 'abcdefgh' }).defaultName, CARTO_DARK_NAME);
	assert.equal(createBasemapCatalog({ maptilerApiKey: 'abcdefgh' }).defaultName, OPENSTREETMAP_NAME);
	assert.equal(createBasemapCatalog({ esriApiKey: 'abcdefgh', cartoApiKey: 'abcdefgh', cachesTiles: true }).defaultName, CARTO_DARK_NAME);
});

test('a map that fails is replaced by the next one by priority', () => {
	const catalog = createBasemapCatalog({ esriApiKey: 'abcdefgh', cartoApiKey: 'abcdefgh' });
	assert.deepEqual(resolveBasemap({ catalog, selected: null }), { wanted: ESRI_HYBRID_NAME, active: ESRI_HYBRID_NAME, usingFallback: false, followsDefault: true });
	assert.deepEqual(resolveBasemap({ catalog, selected: ESRI_HYBRID_NAME }), { wanted: ESRI_HYBRID_NAME, active: ESRI_HYBRID_NAME, usingFallback: false, followsDefault: false });
	assert.equal(resolveBasemap({ catalog, selected: 'No such map' }).wanted, ESRI_HYBRID_NAME);

	let failures = withBasemapFailure({}, ESRI_HYBRID_NAME, 403);
	assert.deepEqual(resolveBasemap({ catalog, selected: null, failures }), { wanted: ESRI_HYBRID_NAME, active: CARTO_DARK_NAME, usingFallback: true, followsDefault: true });
	assert.equal(withBasemapFailure(failures, ESRI_HYBRID_NAME, 500), failures);

	failures = withBasemapFailure(failures, CARTO_DARK_NAME, 403);
	assert.equal(resolveBasemap({ catalog, selected: null, failures }).active, OPENSTREETMAP_NAME);
	failures = withBasemapFailure(withBasemapFailure(failures, OPENSTREETMAP_NAME, 0), OPENFREEMAP_NAME, 0);
	assert.equal(resolveBasemap({ catalog, selected: null, failures }).active, ESRI_HYBRID_NAME);
});

test('maps are grouped by what they show and an empty selection means no choice', () => {
	const catalog = createBasemapCatalog({ cartoApiKey: 'abcdefgh' });
	const categories = catalog.listed.map(item => item.category);
	assert.deepEqual([...new Set(categories)], BASEMAP_CATEGORIES);
	assert.deepEqual(categories, [...categories].sort((a, b) => BASEMAP_CATEGORIES.indexOf(a) - BASEMAP_CATEGORIES.indexOf(b)));
	assert.deepEqual(catalog.listed.filter(item => item.isDefault).map(item => item.name), [CARTO_DARK_NAME]);

	assert.equal(normalizeBasemapSelection(''), null);
	assert.equal(normalizeBasemapSelection(undefined), null);
	assert.equal(normalizeBasemapSelection(OPENSTREETMAP_NAME), OPENSTREETMAP_NAME);
});

test('a client that caches tiles leaves out the maps whose terms forbid storing them', () => {
	const options = { esriApiKey: 'abcdefgh', maptilerApiKey: 'abcdefgh' };
	assert.ok(createBasemapCatalog(options).byName(ESRI_HYBRID_NAME));

	const cached = createBasemapCatalog({ ...options, cachesTiles: true });
	assert.equal(cached.byName(ESRI_HYBRID_NAME), undefined);
	assert.equal(cached.isMissingKey(ESRI_HYBRID_NAME), false);
	assert.equal(cached.listed.find(item => item.name === ESRI_HYBRID_NAME).reason, 'caching');
	assert.ok(cached.byName(MAPTILER_HYBRID_NAME));
});

test('a failed map is explained by the status of the request that failed', () => {
	assert.equal(basemapFailureReason(403), 'denied');
	assert.equal(basemapFailureReason(498), 'denied');
	assert.equal(basemapFailureReason(429), 'limit');
	assert.equal(basemapFailureReason(503), 'server');
	assert.equal(basemapFailureReason(0), 'network');
	assert.equal(basemapFailureReason(404), 'unknown');
	assert.equal(basemapFailureReason(undefined), 'unknown');
	assert.equal(basemapFailureReason(undefined, { requiresKey: true }), 'keyRejected');
	assert.equal(basemapFailureReason(0, { requiresKey: true }), 'network');
	assert.equal(basemapFailureReason(404, { requiresKey: true }), 'unknown');
});

test('a toast stays longer the more text it has', () => {
	assert.equal(toastDuration('Saved'), 3000);
	assert.ok(toastDuration('x'.repeat(60)) > toastDuration('x'.repeat(30)));
	assert.equal(toastDuration('<b>ab</b>'), toastDuration('ab'));
	assert.equal(toastDuration('x'.repeat(5000)), 15000);
	assert.equal(toastDuration(undefined), 3000);
});

test('app identity headers carry the package and the signing certificate', () => {
	const sha1 = 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD';
	assert.equal(normalizeCertSha1(sha1), 'aabbccddeeff00112233445566778899aabbccdd');
	assert.equal(normalizeCertSha1('aabbccddeeff00112233445566778899aabbccdd'), 'aabbccddeeff00112233445566778899aabbccdd');
	assert.equal(normalizeCertSha1('AA:BB'), null);
	assert.equal(normalizeCertSha1(''), null);

	const ids = { androidPackage: 'com.example.app', androidCertSha1: sha1, iosBundleId: 'com.example.ios' };
	assert.deepEqual(appIdentityHeaders({ platform: 'android', ...ids }), { 'X-Android-Package': 'com.example.app', 'X-Android-Cert': 'aabbccddeeff00112233445566778899aabbccdd' });
	assert.deepEqual(appIdentityHeaders({ platform: 'android', ...ids, androidCertSha1: null }), {});
	assert.deepEqual(appIdentityHeaders({ platform: 'ios', ...ids }), { 'X-Ios-Bundle-Identifier': 'com.example.ios' });
	assert.deepEqual(appIdentityHeaders({ platform: 'web', ...ids }), {});
});

test('the app is offered for shared map links on Android', () => {
	const key = 'a'.repeat(64);
	assert.equal(isAndroid('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130'), true);
	assert.equal(isAndroid('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), false);
	assert.equal(isMapLink(`?node=${key}`), true);
	assert.equal(isMapLink('?lat=50.1&lon=19.9&zoom=9'), true);
	assert.equal(isMapLink(''), false);
	assert.equal(isMapLink('?node=short'), false);

	assert.equal(
		buildAndroidIntentUrl({ host: 'mapa.meshcorepolska.org', pathname: '/en/', search: `?node=${key}`, fallbackUrl: 'https://github.com/x/y/releases' }),
		`intent://mapa.meshcorepolska.org/en/?node=${key}#Intent;scheme=https;package=com.sefinek.meshcoremap;S.browser_fallback_url=https%3A%2F%2Fgithub.com%2Fx%2Fy%2Freleases;end`
	);
	assert.ok(!buildAndroidIntentUrl({ host: 'h', pathname: '/', search: '?a=1#frag' }).includes('frag'));
});

test('the version carries its release date as build metadata', () => {
	assert.deepEqual(parseAppVersion('0.13.0+20261116'), { version: '0.13.0', date: '2026-11-16' });
	assert.deepEqual(parseAppVersion('0.13.0'), { version: '0.13.0', date: null });
	assert.deepEqual(parseAppVersion('1.2.3+20261399'), { version: '1.2.3', date: null });
	assert.deepEqual(parseAppVersion('1.2.3+abc'), { version: '1.2.3', date: null });
	assert.deepEqual(parseAppVersion(undefined), { version: '', date: null });
});

test('own API keys are validated and replace the server ones', () => {
	assert.equal(sanitizeApiKey('  AAPTxy.12-3_4~ '), 'AAPTxy.12-3_4~');
	assert.equal(sanitizeApiKey('short'), null);
	assert.equal(sanitizeApiKey('has space in it'), null);
	assert.equal(sanitizeApiKey('key&token=evil1234'), null);
	assert.equal(sanitizeApiKey(42), null);

	assert.deepEqual(sanitizeCustomApiKeys({ esriApiKey: 'valid-key-1', maptilerApiKey: 'bad key', other: 'valid-key-2' }), { esriApiKey: 'valid-key-1' });
	assert.deepEqual(
		mergeApiKeys({ esriApiKey: 'server-esri', cartoApiKey: 'server-carto' }, { esriApiKey: 'my-own-key', maptilerApiKey: 'x' }),
		{ esriApiKey: 'my-own-key', cartoApiKey: 'server-carto' }
	);
	assert.deepEqual(mergeApiKeys(null, undefined), {});
});

test('a site defines its default view and the server config reuses it', () => {
	assert.deepEqual(toMaplibreView(SITES.pl.defaultView), { center: [19.325, 52.1537], zoom: 6 });

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
