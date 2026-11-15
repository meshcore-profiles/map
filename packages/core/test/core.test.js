import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineDistance, destinationPoint, parseLatLng, formatDistance, curvatureDrop } from '../src/geo.js';
import { escapeHtml, truncateKey, formatBytes, resolveNodeByQuery, getNameIconLabel } from '../src/node-utils.js';
import { radioValue, createRadioMatcher, updateRadioSelection } from '../src/radio-filter-utils.js';
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
