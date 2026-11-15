import { buildCoverageGrid, GRID_SHADES, gridAlpha } from '@meshcore-map/core/coverage';
import { destinationPoint } from '@meshcore-map/core/geo';

// Coarser than on the website (90 m, up to 560 cells): every run of cells becomes a GeoJSON polygon, so the grid has to stay small for the phone.
const CELL_TARGET_M = 250;
const MAX_CELLS = 160;

export const coverageTileFeatures = ({ origin, rayResults, capM, linkBudgetRangeM }) => {
	const { cells, items } = buildCoverageGrid({ rayResults, capM, linkBudgetRangeM, cellTargetM: CELL_TARGET_M, maxCells: MAX_CELLS });
	const north = destinationPoint(origin, 0, capM).lat;
	const south = destinationPoint(origin, 180, capM).lat;
	const west = destinationPoint(origin, 270, capM).lng;
	const east = destinationPoint(origin, 90, capM).lng;
	const lng = px => west + (px / cells) * (east - west);
	const lat = py => north - (py / cells) * (north - south);

	const features = [];
	const flush = run => {
		const ring = [[lng(run.from), lat(run.py)], [lng(run.to + 1), lat(run.py)], [lng(run.to + 1), lat(run.py + 1)], [lng(run.from), lat(run.py + 1)], [lng(run.from), lat(run.py)]];
		features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { kind: 'fill', color: GRID_SHADES[run.level], opacity: gridAlpha(run.level) } });
	};

	let run = null;
	for (const { px, py, level } of items) {
		if (run && run.py === py && run.level === level && run.to === px - 1) {
			run.to = px;
			continue;
		}

		if (run) flush(run);
		run = { py, level, from: px, to: px };
	}
	if (run) flush(run);

	return features;
};
