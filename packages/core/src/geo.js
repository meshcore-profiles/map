const EARTH_RADIUS = 6371000;
const EFFECTIVE_EARTH_RADIUS = EARTH_RADIUS * 4 / 3;

const toRad = deg => deg * Math.PI / 180;
const toDeg = rad => rad * 180 / Math.PI;

export const haversineDistance = (a, b) => {
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
};

export const interpolate = (a, b, frac) => ({ lat: a.lat + (b.lat - a.lat) * frac, lng: a.lng + (b.lng - a.lng) * frac });

export const curvatureDrop = (d, total) => (d * (total - d)) / (2 * EFFECTIVE_EARTH_RADIUS);

export const destinationPoint = (origin, bearingDeg, distance) => {
	const delta = distance / EARTH_RADIUS;
	const theta = toRad(bearingDeg);
	const phi1 = toRad(origin.lat);
	const lambda1 = toRad(origin.lng);

	const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
	const lambda2 = lambda1 + Math.atan2(
		Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
		Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
	);

	return { lat: toDeg(phi2), lng: ((toDeg(lambda2) + 540) % 360) - 180 };
};

export const parseLatLng = text => {
	const match = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
	if (!match) return null;

	const lat = Number(match[1]);
	const lng = Number(match[2]);
	if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

	return { lat, lng };
};

export const formatDistance = meters => meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
