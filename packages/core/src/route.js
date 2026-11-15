import { haversineDistance } from './geo.js';
import { resolveNodeByQuery } from './node-utils.js';

export const splitRouteTokens = raw => raw.split(/[\n,>]+/).map(token => token.trim()).filter(Boolean);

// Turns route text ("A > 3dae > bf83e1") into points and segments. Unresolved tokens keep node: null.
export const buildRoute = (raw, nodes) => {
	const tokens = splitRouteTokens(raw).map(token => ({ raw: token, node: resolveNodeByQuery(token, nodes) }));
	const points = tokens.filter(token => token.node).map(token => ({ lat: token.node.lat, lng: token.node.lon, label: token.node.adv_name }));
	const segments = points.slice(1).map((to, i) => ({ from: points[i], to, distance: haversineDistance(points[i], to) }));

	return { tokens, points, segments, total: segments.reduce((sum, s) => sum + s.distance, 0) };
};
