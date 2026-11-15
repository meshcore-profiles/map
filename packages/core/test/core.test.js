import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineDistance, destinationPoint, parseLatLng, formatDistance, curvatureDrop } from '../src/geo.js';
import { escapeHtml, truncateKey, formatBytes, resolveNodeByQuery, getNameIconLabel } from '../src/node-utils.js';
import { radioValue, createRadioMatcher, updateRadioSelection } from '../src/radio-filter-utils.js';
import { createDefaultFilters, collectFilteredNodes, prepareNodes, searchNodes, timeAgoParts } from '../src/nodes.js';
import { createI18n } from '../src/i18n.js';
import { sampleLine, analyzeLineOfSight } from '../src/los.js';
import { buildRayPoints, computeCoverage, computeLinkBudgetRangeM, computeSamplesPerRay } from '../src/coverage.js';
import { createElevationProviders, fetchElevationsChunked } from '../src/elevation-providers.js';
import { buildFilterParams, parseSharedFilters } from '../src/filter-share.js';

test('haversineDistance: Warszawa - Krakow ok. 252 km', () => {
	const d = haversineDistance({ lat: 52.2297, lng: 21.0122 }, { lat: 50.0647, lng: 19.945 });
	assert.ok(Math.abs(d - 252000) < 3000);
});

test('destinationPoint jest odwrotnoscia haversineDistance', () => {
	const origin = { lat: 52, lng: 21 };
	const dest = destinationPoint(origin, 90, 10000);
	assert.ok(Math.abs(haversineDistance(origin, dest) - 10000) < 1);
});

test('parseLatLng', () => {
	assert.deepEqual(parseLatLng(' 52.1 , 21.2 '), { lat: 52.1, lng: 21.2 });
	assert.equal(parseLatLng('91, 10'), null);
	assert.equal(parseLatLng('abc'), null);
});

test('formatDistance / curvatureDrop', () => {
	assert.equal(formatDistance(999.6), '1000 m');
	assert.equal(formatDistance(1500), '1.50 km');
	assert.equal(curvatureDrop(0, 1000), 0);
});

test('node-utils', () => {
	assert.equal(escapeHtml('<a href="x">&\'</a>'), '&#60;a href=&#34;x&#34;&#62;&#38;&#39;&#60;/a&#62;');
	assert.equal(truncateKey('0123456789abcdefghij0123456789', 4), '0123...6789');
	assert.equal(formatBytes(1536), '1.5 KB');
	assert.equal(getNameIconLabel('Foo Bar'), 'FB');
	const nodes = [{ adv_name: 'Alpha', public_key: 'AB12' }, { adv_name: 'Beta', public_key: 'CD34' }];
	assert.equal(resolveNodeByQuery('cd', nodes), nodes[1]);
	assert.equal(resolveNodeByQuery('', nodes), null);
});

test('radio filters', () => {
	assert.equal(radioValue({ freq: 869.618 }, 'freq'), '869');
	assert.equal(radioValue({}, 'sf'), 'unknown');
	const match = createRadioMatcher({ freq: ['869'], sf: null, cr: null, bw: null });
	assert.equal(match({ freq: '869' }), true);
	assert.equal(match({ freq: '868' }), false);
	assert.equal(updateRadioSelection(['a'], new Set(['a', 'b']), 'b', true), null);
});

test('filter-share round trip', () => {
	const state = { nodeFilter: ['1', '2'], radioFilters: { freq: ['869'], sf: null, cr: null, bw: null }, fromDate: '2026-01-02', fromInsertDate: '', clusteringZoom: 12, region: 'all' };
	const params = Object.fromEntries(buildFilterParams(state, { includeRegion: true }));
	const parsed = parseSharedFilters(params);
	assert.deepEqual(parsed.nodeFilter, ['1', '2']);
	assert.deepEqual(parsed.radioFilters, { freq: ['869'] });
	assert.equal(parsed.fromDate, '2026-01-02');
	assert.equal(parsed.clusteringZoom, 12);
	assert.equal(parsed.region, 'all');
});

test('analyzeLineOfSight: plaski teren jest wolny, wzgorze blokuje', () => {
	const a = { lat: 52, lng: 21 };
	const b = { lat: 52, lng: 21.1 };
	const samplePoints = sampleLine(a, b, 11);
	const flat = new Array(11).fill(100);
	const clear = analyzeLineOfSight({ pointA: a, samplePoints, elevations: flat, heightA: 10, heightB: 10 });
	assert.equal(clear.obstructed, false);
	assert.ok(clear.worstClearance > 0);

	const hill = [...flat];
	hill[5] = 400;
	const blocked = analyzeLineOfSight({ pointA: a, samplePoints, elevations: hill, heightA: 10, heightB: 10 });
	assert.equal(blocked.obstructed, true);
	assert.ok(blocked.worstClearance < 0);
});

test('computeCoverage: plaski teren ogranicza tylko budzet lacza', () => {
	const origin = { lat: 52, lng: 21 };
	const bearings = 8;
	const searchRangeM = 10000;
	const samplesPerRay = computeSamplesPerRay(searchRangeM, bearings);
	const points = buildRayPoints(origin, bearings, samplesPerRay, searchRangeM);
	assert.equal(points.length, bearings * samplesPerRay);

	const elevations = new Array(points.length + 1).fill(100);
	const rays = computeCoverage({ origin, elevations, bearings, samplesPerRay, searchRangeM, txHeight: 20, rxHeight: 2, freqMHz: 869, margin: 0, linkBudgetRangeM: 6000 });
	assert.equal(rays.length, bearings);
	for (const r of rays) assert.equal(r.opticalRange, 6000);
});

test('computeLinkBudgetRangeM rosnie z mocą i maleje z SF', () => {
	assert.ok(computeLinkBudgetRangeM(22, 869, 9, 250) > computeLinkBudgetRangeM(14, 869, 9, 250));
	assert.ok(computeLinkBudgetRangeM(22, 869, 12, 250) > computeLinkBudgetRangeM(22, 869, 7, 250));
});

test('createElevationProviders: sefinek odrzuca niepelne dane', async () => {
	const providers = createElevationProviders({
		getSefinekApi: () => 'http://x',
		pack: v => v,
		unpack: () => ({ results: [{ elevation: 1 }, { elevation: null }] }),
		fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }),
	});
	await assert.rejects(() => providers.sefinek.fetch([{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }]), /incomplete/);
});

test('fetchElevationsChunked dzieli na paczki', async () => {
	const calls = [];
	const fetch = async pts => {
		calls.push(pts.length);
		return pts.map((_, i) => i);
	};
	const providers = { sefinek: { maxBatchSize: 2, fetch } };
	const out = await fetchElevationsChunked(providers, [1, 2, 3, 4, 5], 'sefinek');
	assert.deepEqual(calls, [2, 2, 1]);
	assert.equal(out.length, 5);
});

test('prepareNodes: inflate, status, indeksy', () => {
	const now = Date.parse('2026-11-15T12:00:00Z');
	const day = 86400000;
	const iso = offsetDays => new Date(now - offsetDays * day).toISOString();
	const raw = [
		{ pk: new Uint8Array([1, 255]), t: 2, n: 'Repeater A', la: iso(0), id: iso(30), ud: iso(1), p: { freq: 869.618, sf: 8, cr: 5, bw: 62.5 }, s: 'u-auto', lat: 52.1, lon: 21.2 },
		{ pk: new Uint8Array([2, 0]), t: 1, n: 'Klient', la: iso(0), id: iso(3), ud: iso(12), p: {}, s: 'u-auto', lat: 50, lon: 19 },
		{ pk: new Uint8Array([3, 0]), t: 2, n: 'Reczny', la: iso(0), id: iso(3), ud: null, p: {}, s: 'm', lat: 51, lon: 20 },
	];
	const { nodes, byType, radioOptions } = prepareNodes(raw, now);
	assert.equal(nodes[0].public_key, '01ff');
	assert.equal(nodes[0].status, 'recent');
	assert.equal(nodes[1].status, 'old');
	assert.equal(nodes[2].status, 'none');
	assert.equal(byType[2].length, 2);
	assert.ok(radioOptions.freq.has('869') && radioOptions.freq.has('unknown'));

	const filters = createDefaultFilters();
	assert.equal(collectFilteredNodes(filters, byType).length, 3);
	assert.equal(collectFilteredNodes({ ...filters, nodeFilter: ['1'] }, byType).length, 1);
	assert.equal(collectFilteredNodes({ ...filters, radioFilters: { ...filters.radioFilters, freq: ['869'] } }, byType).length, 1);
	assert.equal(collectFilteredNodes({ ...filters, fromInsertDate: iso(10).slice(0, 10) }, byType).length, 2);
	assert.deepEqual(searchNodes(nodes, 'rep').map(n => n.adv_name), ['Repeater A', 'Reczny'].filter(n => n.toLowerCase().includes('rep')));
});

test('timeAgoParts i createI18n', () => {
	assert.deepEqual(timeAgoParts(0, 90 * 1000), { count: 1, unit: 'minute' });
	assert.equal(timeAgoParts(1000, 1500), null);

	const bundle = { common: { timeUnits: { day: ['dzien', 'dni', 'dni'] }, hello: 'Czesc {{name}}' }, map: { a: { b: 'x' } } };
	const { t, plural } = createI18n({ getBundle: () => bundle, getLanguage: () => 'pl' });
	assert.equal(t('hello', { name: 'Ala' }), 'Czesc Ala');
	assert.equal(t('map:a.b'), 'x');
	assert.equal(t('map:missing'), 'map:missing');
	assert.deepEqual([1, 2, 5, 12, 22].map(n => plural(n, ['a', 'b', 'c'])), ['a', 'b', 'c', 'c', 'b']);
});
