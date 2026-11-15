import { formatDistance, haversineDistance } from '@meshcore-map/core/geo';

const point = (p, color, label) => ({
	type: 'Feature',
	geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
	properties: { kind: 'point', color, label },
});

const LABEL_ONLY = 'label';

// Features for OverlayLayer: labelled points, a polyline and distance labels at segment midpoints.
export const buildPathFeatures = (points, { color, labelFor, segmentLabels = true }) => {
	const features = points.map((p, i) => point(p, color, labelFor(p, i)));
	if (points.length < 2) return features;

	features.push({
		type: 'Feature',
		geometry: { type: 'LineString', coordinates: points.map(p => [p.lng, p.lat]) },
		properties: { kind: 'line', color },
	});

	if (segmentLabels) {
		for (let i = 1; i < points.length; i++) {
			const a = points[i - 1];
			const b = points[i];
			features.push({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [(a.lng + b.lng) / 2, (a.lat + b.lat) / 2] },
				properties: { kind: LABEL_ONLY, color, label: formatDistance(haversineDistance(a, b)) },
			});
		}
	}

	return features;
};

export const boundsOf = points => {
	const lngs = points.map(p => p.lng);
	const lats = points.map(p => p.lat);

	return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
};
