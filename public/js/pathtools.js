/* global L */
import { t } from './i18n.js';

export const formatDistance = meters => meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;

export const escapeHtml = html => html.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

export const loadJson = key => {
	try {
		return JSON.parse(localStorage.getItem(key));
	} catch {
		return null;
	}
};

export const resolveNodeByQuery = (query, nodes) => {
	const lower = query.trim().toLowerCase();
	if (!lower) return null;

	return nodes.find(n => n.adv_name.toLowerCase() === lower)
		|| nodes.find(n => n.public_key.toLowerCase().startsWith(lower))
		|| nodes.find(n => n.adv_name.toLowerCase().includes(lower))
		|| null;
};

const URL_POINT_MATCH_TOLERANCE = 0.0001;

export const findNodeNearLatLng = (nodes, lat, lng) =>
	nodes.find(n => Math.abs(n.lat - lat) < URL_POINT_MATCH_TOLERANCE && Math.abs(n.lon - lng) < URL_POINT_MATCH_TOLERANCE) || null;

const readyPanes = new Set();
export const ensurePane = (map, name, zIndex) => {
	if (readyPanes.has(name)) return;
	map.createPane(name).style.zIndex = zIndex;
	readyPanes.add(name);
};

const ensurePathPane = map => ensurePane(map, 'pathToolsPane', 650);

export const createPathLayer = ({ map, color = '#4dabf7' }) => {
	ensurePathPane(map);
	const group = L.layerGroup().addTo(map);
	let points = [];

	const getSegments = () => {
		const segments = [];
		for (let i = 1; i < points.length; i++) {
			const a = L.latLng(points[i - 1].lat, points[i - 1].lng);
			const b = L.latLng(points[i].lat, points[i].lng);
			segments.push({ from: points[i - 1], to: points[i], distance: a.distanceTo(b) });
		}
		return segments;
	};

	const render = () => {
		group.clearLayers();
		if (!points.length) return;

		points.forEach((pt, i) => {
			L.circleMarker([pt.lat, pt.lng], {
				pane: 'pathToolsPane',
				radius: 9,
				color,
				weight: 3,
				fillColor: color,
				fillOpacity: 0.85,
			}).bindTooltip(pt.label ? escapeHtml(pt.label) : t('common:pointFallback', { n: i + 1 })).addTo(group);
		});

		if (points.length < 2) return;

		L.polyline(points.map(p => [p.lat, p.lng]), { pane: 'pathToolsPane', color, weight: 3, dashArray: '6 6' }).addTo(group);

		for (const { from, to, distance } of getSegments()) {
			const mid = L.latLng((from.lat + to.lat) / 2, (from.lng + to.lng) / 2);

			L.marker(mid, {
				pane: 'pathToolsPane',
				icon: L.divIcon({ className: 'segment-label', html: formatDistance(distance), iconSize: null }),
				interactive: false,
			}).addTo(group);
		}
	};

	const clear = () => {
		points = [];
		render();
	};

	const setPoints = newPoints => {
		points = newPoints;
		render();
	};

	const addPoint = point => {
		points.push(point);
		render();
	};

	const removeLastPoint = () => {
		points.pop();
		render();
	};

	const getTotalDistance = (segments = getSegments()) => segments.reduce((sum, s) => sum + s.distance, 0);

	const fitBounds = () => {
		if (points.length > 1) map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lng])), { padding: [60, 60] });
		else if (points.length === 1) map.setView([points[0].lat, points[0].lng], Math.max(map.getZoom(), 13));
	};

	const hide = () => {
		if (map.hasLayer(group)) map.removeLayer(group);
	};

	const show = () => {
		if (!map.hasLayer(group)) map.addLayer(group);
	};

	return {
		clear,
		setPoints,
		addPoint,
		removeLastPoint,
		getPoints: () => points,
		getSegments,
		getTotalDistance,
		fitBounds,
		hide,
		show,
		remove: () => map.removeLayer(group),
	};
};
