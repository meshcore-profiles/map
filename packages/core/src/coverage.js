import { destinationPoint, curvatureDrop } from './geo.js';

export const SPEED_OF_LIGHT = 299792458;
export const FRESNEL_CLEARANCE_FACTOR = 0.6;
export const MAX_RANGE_M = 30000;
export const RESOLUTIONS = { fast: 36, standard: 72, high: 144 };

const MAX_TOTAL_POINTS = 9000;
const SAMPLE_SPACING_TARGET = 300;
const MIN_SAMPLES_PER_RAY = 20;
const MAX_SAMPLES_PER_RAY = 60;

// Approximate LoRa (SX127x/SX126x-class) receiver sensitivity at BW=125kHz, from common
// Semtech datasheet figures. Scaled to other bandwidths via the noise-bandwidth relationship.
// No confirmed SF5 figure (SX126x-only, not in the SX127x table this is based on, and no
// MeshCore preset actually uses it) - falls back to SF6 as the closest known value.
const SENSITIVITY_125K_DBM = { 6: -118, 7: -123, 8: -126, 9: -129, 10: -132, 11: -133, 12: -136 };
const LINK_FADE_MARGIN_DB = 10;

export const computeSamplesPerRay = (rangeM, bearings) => {
	let samples = Math.min(MAX_SAMPLES_PER_RAY, Math.max(MIN_SAMPLES_PER_RAY, Math.round(rangeM / SAMPLE_SPACING_TARGET)));
	if (bearings * samples > MAX_TOTAL_POINTS) samples = Math.max(MIN_SAMPLES_PER_RAY, Math.floor(MAX_TOTAL_POINTS / bearings));
	return samples;
};

// Free-space path loss + LoRa sensitivity budget -> a single max range (same in every
// direction, since it does not depend on terrain). The per-bearing terrain range is then
// capped by this, so the result reflects whichever limit is tighter.
export const computeLinkBudgetRangeM = (erpDbm, freqMHz, sf, bwKHz) => {
	const sensitivity125 = SENSITIVITY_125K_DBM[sf] ?? SENSITIVITY_125K_DBM[6];
	const sensitivity = sensitivity125 + 10 * Math.log10((bwKHz * 1000) / 125000);
	const budgetDb = erpDbm - sensitivity - LINK_FADE_MARGIN_DB;
	const rangeKm = 10 ** ((budgetDb - 20 * Math.log10(freqMHz) - 32.44) / 20);
	return Math.max(0, rangeKm * 1000);
};

export const buildRayPoints = (origin, bearings, samplesPerRay, searchRangeM) => {
	const points = [];
	const step = 360 / bearings;
	for (let b = 0; b < bearings; b++) {
		for (let i = 1; i <= samplesPerRay; i++) points.push(destinationPoint(origin, b * step, (i / samplesPerRay) * searchRangeM));
	}

	return points;
};

export const computeRayRanges = (elevations, base, samplesPerRay, distances, elevA, rxHeight, lambda, margin, linkBudgetRangeM) => {
	let opticalStopped = false, fresnelStopped = false;
	let opticalRange = distances[samplesPerRay - 1];
	let fresnelRange = distances[samplesPerRay - 1];

	for (let i = 0; i < samplesPerRay && (!opticalStopped || !fresnelStopped); i++) {
		const total = distances[i];
		const elevB = elevations[base + i] + rxHeight;

		let opticalOkHere = true, fresnelOkHere = true;
		for (let j = 0; j < i; j++) {
			const dj = distances[j];
			const sightAt = elevA + (elevB - elevA) * (dj / total);
			const drop = curvatureDrop(dj, total);
			const clearance = sightAt - drop - elevations[base + j] + margin;

			if (clearance < 0) {
				opticalOkHere = false;
				fresnelOkHere = false;
				break;
			}

			const required = FRESNEL_CLEARANCE_FACTOR * Math.sqrt(lambda * dj * (total - dj) / total);
			if (clearance < required) fresnelOkHere = false;
		}

		if (!opticalStopped) {
			if (opticalOkHere) { opticalRange = total; }
			else { opticalStopped = true; opticalRange = i > 0 ? distances[i - 1] : 0; }
		}
		if (!fresnelStopped) {
			if (fresnelOkHere) { fresnelRange = total; }
			else { fresnelStopped = true; fresnelRange = i > 0 ? distances[i - 1] : 0; }
		}
	}

	return {
		opticalRange: Math.min(opticalRange, linkBudgetRangeM),
		fresnelRange: Math.min(fresnelRange, linkBudgetRangeM),
	};
};

// elevations[0] is the origin point, followed by the rays (bearings * samplesPerRay) in the order produced by buildRayPoints.
export const computeCoverage = ({ origin, elevations, bearings, samplesPerRay, searchRangeM, txHeight, rxHeight, freqMHz, margin, linkBudgetRangeM }) => {
	const bearingStep = 360 / bearings;
	const elevA = elevations[0] + txHeight;
	const lambda = SPEED_OF_LIGHT / (freqMHz * 1e6);
	const distances = Array.from({ length: samplesPerRay }, (_, i) => ((i + 1) / samplesPerRay) * searchRangeM);

	const rayResults = [];
	for (let b = 0; b < bearings; b++) {
		const { opticalRange, fresnelRange } = computeRayRanges(elevations, 1 + b * samplesPerRay, samplesPerRay, distances, elevA, rxHeight, lambda, margin, linkBudgetRangeM);
		const bearingDeg = b * bearingStep;
		rayResults.push({
			bearingDeg,
			opticalRange,
			fresnelRange,
			opticalPoint: destinationPoint(origin, bearingDeg, opticalRange),
			fresnelPoint: destinationPoint(origin, bearingDeg, fresnelRange),
		});
	}

	return rayResults;
};
