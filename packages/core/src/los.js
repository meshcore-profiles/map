import { curvatureDrop, haversineDistance, interpolate } from './geo.js';

export const sampleLine = (a, b, count) => Array.from({ length: count }, (_, i) => interpolate(a, b, i / (count - 1)));

export const sightLineAt = (elevA, elevB, d, total) => elevA + (elevB - elevA) * (d / total);

// Positive value = line of sight clears the terrain (with Earth curvature correction).
export const clearanceAt = ({ elevation, d, total, elevA, elevB }) => sightLineAt(elevA, elevB, d, total) - (elevation - curvatureDrop(d, total));

export const analyzeLineOfSight = ({ pointA, samplePoints, elevations, heightA = 0, heightB = 0 }) => {
	const total = haversineDistance(pointA, samplePoints[samplePoints.length - 1]);
	const distances = samplePoints.map(p => haversineDistance(pointA, p));
	const elevA = elevations[0] + heightA;
	const elevB = elevations[elevations.length - 1] + heightB;

	let obstructed = false;
	let worstClearance = Infinity;
	for (let i = 1; i < elevations.length - 1; i++) {
		const clearance = clearanceAt({ elevation: elevations[i], d: distances[i], total, elevA, elevB });
		if (clearance < worstClearance) worstClearance = clearance;
		if (clearance < 0) obstructed = true;
	}

	return { total, distances, elevA, elevB, obstructed, worstClearance };
};
