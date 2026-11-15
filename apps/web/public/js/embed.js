/* global L */
import { t, tRaw, plural } from './i18n.js';
import { escapeHtml } from './pathtools.js';
import { defaultBaseMapName, getNextFallbackBaseMap, getMaplibreBaseMapLayer, maplibreBaseMapOptions, tileBaseMaps, baseMapAttributions } from './basemaps.js';

const TYPE_ICONS = { repeater: 'repeater', roomServer: 'room-server' };
const LABELLED_LIMIT = 8;
const COVER_ZOOM = 11;
const EARTH_RADIUS_KM = 6371.0088;
const lang = window.MAP_CONFIG.languageCode;
const cover = window.MAP_CONFIG.cover;

const points = JSON.parse(document.getElementById('embed-points').textContent);

const toRad = deg => deg * Math.PI / 180;
const distanceKm = (a, b) => {
	const dLat = toRad(b.a - a.a);
	const dLon = toRad(b.o - a.o);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.a)) * Math.cos(toRad(b.a)) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

const decimal = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat(lang, { maximumFractionDigits: 0 });
const formatDistance = km => {
	if (km < 1) return `${whole.format(Math.max(1, Math.round(km * 10) * 100))} m`;
	return `${(km < 10 ? decimal : whole).format(km)} km`;
};

// Minimalne drzewo rozpinające (Prim): n - 1 najkrótszych połączeń bez bałaganu na mapie
const spanningLinks = nodes => {
	if (nodes.length < 2) return [];

	const linked = new Set([0]);
	const links = [];
	while (linked.size < nodes.length) {
		let best = null;
		for (const from of linked) {
			for (let to = 0; to < nodes.length; to++) {
				if (linked.has(to)) continue;
				const km = distanceKm(nodes[from], nodes[to]);
				if (!best || km < best.km) best = { from, to, km };
			}
		}
		linked.add(best.to);
		links.push(best);
	}
	return links;
};

const maxSpanKm = nodes => {
	let max = 0;
	for (let i = 0; i < nodes.length; i++) {
		for (let j = i + 1; j < nodes.length; j++) max = Math.max(max, distanceKm(nodes[i], nodes[j]));
	}
	return max;
};

const map = L.map('map', {
	minZoom: 2,
	maxZoom: 20,
	zoomSnap: 0.25,
	dragging: !L.Browser.mobile,
	scrollWheelZoom: false,
	attributionControl: true,
	zoomControl: false,
	...(cover && { dragging: false, touchZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false }),
}).setView([points[0].a, points[0].o], 12);

// Zoom kółkiem włącza się po kliknięciu w mapę, żeby nie blokować przewijania strony profilu
if (!cover) {
	map.on('focus', () => map.scrollWheelZoom.enable());
	map.on('blur', () => map.scrollWheelZoom.disable());
}
map.attributionControl.setPrefix(false);
// W trybie okładki dolna część jest przyciemniona gradientem strony, więc podziękowania lądują u góry
if (cover) map.attributionControl.setPosition('topleft');
if (!cover) L.control.zoom({ position: 'topright' }).addTo(map);

let attribution = null;
let activeLayer = null;
const useBaseMap = async name => {
	try {
		const layer = maplibreBaseMapOptions[name] ? await getMaplibreBaseMapLayer(name) : tileBaseMaps[name];
		if (activeLayer) map.removeLayer(activeLayer);
		activeLayer = layer;
		map.addLayer(layer);
		map.setMaxZoom(layer.options.maxZoom);

		if (attribution) map.attributionControl.removeAttribution(attribution);
		attribution = layer.options.esriAttribution || baseMapAttributions[name];
		map.attributionControl.addAttribution(attribution);
	} catch (err) {
		console.error(`Base map "${name}" failed:`, err);
		const next = getNextFallbackBaseMap(name);
		if (next) await useBaseMap(next);
	}
};
void useBaseMap(defaultBaseMapName);

const coverIcon = kind => L.divIcon({
	html: `<span class="embed-pulse"></span><svg width="34" height="34"><use href="/icons/node-types.svg#${TYPE_ICONS[kind]}"></use></svg>`,
	className: `svg-node-icon embed-pin embed-pin--${kind}`,
	iconSize: [34, 34],
	iconAnchor: [17, 17],
});

const pinIcon = kind => L.divIcon({
	html: `<svg width="34" height="34"><use href="/icons/node-types.svg#${TYPE_ICONS[kind]}"></use></svg>`,
	className: `svg-node-icon embed-pin embed-pin--${kind}`,
	iconSize: [34, 34],
	iconAnchor: [17, 17],
	popupAnchor: [0, -18],
	tooltipAnchor: [0, 16],
});

const typeLabel = kind => t(`map:nodeTypes.${kind}`);

const formatCoord = value => value.toFixed(5);

const popupHtml = point => `
	<div class="embed-popup">
		<div class="embed-popup__head">
			<svg width="32" height="32" class="embed-pin--${point.t}"><use href="/icons/node-types.svg#${TYPE_ICONS[point.t]}"></use></svg>
			<div class="embed-popup__title">
				<strong>${escapeHtml(point.n)}</strong>
				<span class="embed-badge embed-badge--${point.t}">${escapeHtml(typeLabel(point.t))}</span>
			</div>
		</div>
		<div class="embed-popup__coords">${formatCoord(point.a)}, ${formatCoord(point.o)}</div>
		<a class="embed-popup__link" href="${window.MAP_CONFIG.homeUrl}?node=${point.k}" target="_blank" rel="noopener">${escapeHtml(t('embed:openNode'))}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg></a>
	</div>`;

const labelled = points.length <= LABELLED_LIMIT;
for (const point of points) {
	if (cover) {
		L.marker([point.a, point.o], { icon: coverIcon(point.t), interactive: false, keyboard: false }).addTo(map);
		continue;
	}

	L.marker([point.a, point.o], { icon: pinIcon(point.t), title: point.n, riseOnHover: true })
		.bindTooltip(escapeHtml(point.n), { direction: 'bottom', permanent: labelled, className: 'embed-tip', opacity: 1 })
		.bindPopup(popupHtml(point), { closeButton: false, className: 'embed-popup-wrap', offset: [0, -2], minWidth: 220, maxWidth: 280 })
		.addTo(map);
}

const links = cover ? [] : spanningLinks(points);
for (const { from, to, km } of links) {
	const a = points[from];
	const b = points[to];
	L.polyline([[a.a, a.o], [b.a, b.o]], { color: '#4dabf7', weight: 2, opacity: 0.85, dashArray: '6 6', interactive: false }).addTo(map);
	L.marker([(a.a + b.a) / 2, (a.o + b.o) / 2], {
		icon: L.divIcon({ html: `<span>${formatDistance(km)}</span>`, className: 'embed-distance', iconSize: null }),
		interactive: false,
		keyboard: false,
	}).addTo(map);
}

const count = kind => points.filter(p => p.t === kind).length;
const summary = L.control({ position: 'topleft' });
summary.onAdd = () => {
	const el = L.DomUtil.create('div', 'embed-summary');
	const parts = ['repeater', 'roomServer'].flatMap(kind => {
		const n = count(kind);
		return n ? [`<span class="embed-chip embed-chip--${kind}"><b>${n}</b> ${escapeHtml(plural(n, tRaw('embed:' + kind)))}</span>`] : [];
	});
	if (points.length > 1) parts.push(`<span class="embed-chip">${escapeHtml(t('embed:span'))} <b>${escapeHtml(formatDistance(maxSpanKm(points)))}</b></span>`);
	el.innerHTML = parts.join('');
	return el;
};
if (!cover) summary.addTo(map);

const fit = () => {
	if (cover) {
		map.setView([points[0].a, points[0].o], COVER_ZOOM, { animate: false });
		const { x, y } = map.getSize();
		// Keep the pin in the upper right, clear of the title and key field of the page header
		map.panBy([-x * 0.22, y * 0.12], { animate: false });
		return;
	}
	if (points.length === 1) return map.setView([points[0].a, points[0].o], 13, { animate: false });
	map.fitBounds(L.latLngBounds(points.map(p => [p.a, p.o])), { padding: [56, 56], maxZoom: 14, animate: false });
};
fit();
new ResizeObserver(() => {
	map.invalidateSize({ animate: false });
	fit();
}).observe(document.getElementById('map'));
