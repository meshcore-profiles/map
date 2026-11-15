import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineDistance, destinationPoint, parseLatLng, formatDistance, curvatureDrop } from '../src/geo.js';
import { escapeHtml, truncateKey, formatBytes, resolveNodeByQuery, getNameIconLabel } from '../src/node-utils.js';
import { radioValue, createRadioMatcher, updateRadioSelection } from '../src/radio-filter-utils.js';
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
