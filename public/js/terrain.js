import { t } from './i18n.js';
import { initModal } from './modal.js';
import { createPathLayer, findNodeNearLatLng, formatDistance, loadJson, resolveNodeByQuery } from './pathtools.js';
import { curvatureDrop, ELEVATION_PROVIDERS, fetchElevations, haversineDistance, interpolate, parseLatLng } from './elevation.js';

const SAMPLE_COUNT = 48;

const getCssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const COLOR_TERRAIN = '#99a1b5';
const COLOR_BORDER = 'rgba(148, 166, 204, 0.25)';
const COLOR_TEXT = '#eef1f8';
const COLOR_TEXT_MUTED = '#99a1b5';
const COLOR_GREEN = '#2dd881';
const COLOR_RED_BRIGHT = getCssVar('--red-bright', '#ff3352');
const COLOR_RED = getCssVar('--red', '#e01230');
const COLOR_BLUE = '#4dabf7';

const buildChartSvg = ({ samples, distances, total, elevA, elevB, obstructed }) => {
	const width = 640, height = 220;
	const padL = 34, padR = 14, padT = 16, padB = 30;
	const plotW = width - padL - padR;
	const plotH = height - padT - padB;

	const minElev = Math.min(...samples, elevA, elevB);
	const maxElev = Math.max(...samples, elevA, elevB);
	const span = Math.max(maxElev - minElev, 1);
	const yPad = span * 0.12;
	const lo = minElev - yPad, hi = maxElev + yPad;

	const x = d => padL + (d / total) * plotW;
	const y = e => padT + plotH - ((e - lo) / (hi - lo)) * plotH;

	const terrainPoints = samples.map((e, i) => `${x(distances[i]).toFixed(1)},${y(e).toFixed(1)}`).join(' ');
	const terrainArea = `${x(0).toFixed(1)},${(padT + plotH).toFixed(1)} ${terrainPoints} ${x(total).toFixed(1)},${(padT + plotH).toFixed(1)}`;

	const sightColor = obstructed ? COLOR_RED_BRIGHT : COLOR_GREEN;

	const obstructionDots = samples.map((e, i) => {
		const d = distances[i];
		const sightAt = elevA + (elevB - elevA) * (d / total);
		const drop = curvatureDrop(d, total);
		if ((e - drop) <= sightAt) return '';
		return `<circle cx="${x(d).toFixed(1)}" cy="${y(e).toFixed(1)}" r="3.2" fill="${COLOR_RED_BRIGHT}" />`;
	}).join('');

	const gridLines = [0, 0.25, 0.5, 0.75, 1].map(frac => {
		const e = lo + (hi - lo) * frac;
		const yy = y(e).toFixed(1);
		return `<line x1="${padL}" y1="${yy}" x2="${padL + plotW}" y2="${yy}" stroke="${COLOR_BORDER}" stroke-width="1"/>` +
			`<text x="2" y="${Number(yy) + 4}" text-anchor="start" font-size="13" fill="${COLOR_TEXT_MUTED}" font-family="monospace">${Math.round(e)}</text>`;
	}).join('');

	return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${t('terrain:chartAriaLabel')}">
		${gridLines}
		<polygon points="${terrainArea}" fill="${COLOR_TERRAIN}" fill-opacity="0.18" stroke="${COLOR_TERRAIN}" stroke-width="1.5"/>
		<line x1="${x(0).toFixed(1)}" y1="${y(elevA).toFixed(1)}" x2="${x(total).toFixed(1)}" y2="${y(elevB).toFixed(1)}" stroke="${sightColor}" stroke-width="2.2" stroke-dasharray="5 4"/>
		${obstructionDots}
		<circle cx="${x(0).toFixed(1)}" cy="${y(elevA).toFixed(1)}" r="4.5" fill="${COLOR_BLUE}"/>
		<circle cx="${x(total).toFixed(1)}" cy="${y(elevB).toFixed(1)}" r="4.5" fill="${COLOR_RED}"/>
		<text x="${x(0).toFixed(1)}" y="${height - 6}" font-size="14" font-weight="700" fill="${COLOR_TEXT}" font-family="monospace">A</text>
		<text x="${x(total).toFixed(1)}" y="${height - 6}" font-size="14" font-weight="700" fill="${COLOR_TEXT}" font-family="monospace" text-anchor="end">B</text>
	</svg>`;
};

const STORAGE_KEY = 'terrainToolState';
const HEIGHTS_STORAGE_KEY = 'terrainToolHeights';

export const initTerrainTool = ({ map, setPicker, getNodes, showToast, getElevationSource }) => {
	const modal = initModal('terrain-toggle', 'terrain-overlay');
	const titleEl = document.getElementById('terrain-title');
	const closeBtn = document.getElementById('terrain-close-btn');
	const inputA = document.getElementById('terrain-point-a-input');
	const inputB = document.getElementById('terrain-point-b-input');
	const pickBtnA = document.getElementById('terrain-pick-a-btn');
	const pickBtnB = document.getElementById('terrain-pick-b-btn');
	const heightAInput = document.getElementById('terrain-height-a');
	const heightBInput = document.getElementById('terrain-height-b');
	const analyzeBtn = document.getElementById('terrain-analyze-btn');
	const shareBtn = document.getElementById('terrain-share-btn');
	const clearBtn = document.getElementById('terrain-clear-btn');
	const resultEl = document.getElementById('terrain-result');

	const preview = createPathLayer({ map, color: '#f2b134' });
	preview.hide();

	const points = { a: null, b: null };
	let clearPicker = null;
	let pickingFor = null;

	new MutationObserver(() => {
		if (modal.overlay.hidden) {
			if (!pickingFor) preview.hide();
		} else {
			preview.show();

			const source = getElevationSource ? getElevationSource() : 'sefinek';
			titleEl.textContent = t('terrain:titleWithSource', { source: (ELEVATION_PROVIDERS[source] || ELEVATION_PROVIDERS.sefinek).label });
		}
	}).observe(modal.overlay, { attributes: true, attributeFilter: ['hidden'] });

	const inputs = { a: inputA, b: inputB };
	const pickBtns = { a: pickBtnA, b: pickBtnB };

	const syncPreview = () => {
		const pts = [];
		if (points.a) pts.push({ lat: points.a.lat, lng: points.a.lng, label: 'A' });
		if (points.b) pts.push({ lat: points.b.lat, lng: points.b.lng, label: 'B' });
		preview.setPoints(pts);
	};

	const updateShareButton = () => {
		shareBtn.hidden = !points.a || !points.b;
	};

	const stopPicking = () => {
		if (pickingFor) pickBtns[pickingFor].classList.remove('active');
		pickingFor = null;
		clearPicker?.();
		clearPicker = null;
		map.getContainer().classList.remove('pick-cursor');
	};

	const setPoint = (key, point) => {
		points[key] = point;
		inputs[key].value = point.label || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
		syncPreview();
		updateShareButton();
	};

	const startPicking = key => {
		if (pickingFor === key) {
			stopPicking();
			modal.open();
			return;
		}

		stopPicking();
		pickingFor = key;
		pickBtns[key].classList.add('active');
		map.getContainer().classList.add('pick-cursor');

		modal.close();
		modal.toggle.classList.add('active');

		clearPicker = setPicker({
			onMap: latlng => {
				setPoint(key, { lat: latlng.lat, lng: latlng.lng, label: null });
				stopPicking();
				modal.open();
			},
			onNode: node => {
				setPoint(key, { lat: node.lat, lng: node.lon, label: node.adv_name });
				stopPicking();
				modal.open();
			},
		});
	};

	pickBtnA.addEventListener('click', () => startPicking('a'));
	pickBtnB.addEventListener('click', () => startPicking('b'));

	const syncFromInput = key => {
		const text = inputs[key].value;
		const coords = parseLatLng(text);
		if (coords) {
			points[key] = { ...coords, label: null };
			syncPreview();
			updateShareButton();
			return;
		}

		const node = resolveNodeByQuery(text, getNodes());
		if (node) {
			points[key] = { lat: node.lat, lng: node.lon, label: node.adv_name };
			syncPreview();
			updateShareButton();
		}
	};

	inputA.addEventListener('input', () => syncFromInput('a'));
	inputB.addEventListener('input', () => syncFromInput('b'));

	// Once the user is done typing, normalize the field to the matched node's canonical name
	// instead of leaving whatever partial text they typed to find it.
	inputA.addEventListener('change', () => {
		if (points.a?.label) inputA.value = points.a.label;
	});
	inputB.addEventListener('change', () => {
		if (points.b?.label) inputB.value = points.b.label;
	});

	const saveHeights = () => {
		localStorage.setItem(HEIGHTS_STORAGE_KEY, JSON.stringify({ heightA: heightAInput.value, heightB: heightBInput.value }));
	};

	const restoreHeights = () => {
		const saved = loadJson(HEIGHTS_STORAGE_KEY);
		if (!saved) return;

		if (saved.heightA) heightAInput.value = saved.heightA;
		if (saved.heightB) heightBInput.value = saved.heightB;
	};

	heightAInput.addEventListener('change', saveHeights);
	heightBInput.addEventListener('change', saveHeights);
	restoreHeights();

	const reset = () => {
		stopPicking();
		points.a = null;
		points.b = null;
		inputA.value = '';
		inputB.value = '';
		preview.clear();
		resultEl.hidden = true;
		resultEl.innerHTML = '';
		localStorage.removeItem(STORAGE_KEY);
		updateShareButton();
	};

	clearBtn.addEventListener('click', reset);

	const saveState = () => {
		if (!points.a && !points.b) {
			localStorage.removeItem(STORAGE_KEY);
			return;
		}

		localStorage.setItem(STORAGE_KEY, JSON.stringify({ a: points.a, b: points.b }));
	};

	const restoreState = () => {
		const saved = loadJson(STORAGE_KEY);
		if (!saved) return;

		if (saved.a) setPoint('a', saved.a);
		if (saved.b) setPoint('b', saved.b);
	};

	restoreState();
	updateShareButton();

	analyzeBtn.addEventListener('click', async () => {
		if (!points.a || !points.b) {
			showToast(t('terrain:selectBothPoints'), { status: 'error' });
			return;
		}

		const heightA = Number(heightAInput.value) || 0;
		const heightB = Number(heightBInput.value) || 0;
		const total = haversineDistance(points.a, points.b);
		if (total < 10) {
			showToast(t('terrain:pointsTooClose'), { status: 'error' });
			return;
		}

		analyzeBtn.disabled = true;
		const loadingToast = showToast(t('terrain:fetchingElevation'), { duration: 0, status: 'loading' });

		try {
			const samplePoints = new Array(SAMPLE_COUNT).fill(0).map((_, i) => interpolate(points.a, points.b, i / (SAMPLE_COUNT - 1)));
			const source = getElevationSource ? getElevationSource() : 'sefinek';
			const elevations = await fetchElevations(samplePoints, source);
			const distances = samplePoints.map(p => haversineDistance(points.a, p));

			const elevA = elevations[0] + heightA;
			const elevB = elevations[elevations.length - 1] + heightB;

			let obstructed = false;
			let worstClearance = Infinity;
			for (let i = 1; i < elevations.length - 1; i++) {
				const sightAt = elevA + (elevB - elevA) * (distances[i] / total);
				const drop = curvatureDrop(distances[i], total);
				const clearance = sightAt - (elevations[i] - drop);
				if (clearance < worstClearance) worstClearance = clearance;
				if (clearance < 0) obstructed = true;
			}

			const chartSvg = buildChartSvg({ samples: elevations, distances, total, elevA, elevB, obstructed });

			resultEl.innerHTML = `
				<div class="terrain-result-summary">
					<div class="terrain-result-chip">
						<span class="terrain-result-chip-label">${t('terrain:distance')}</span>
						<span class="terrain-result-chip-value">${formatDistance(total)}</span>
					</div>
					<div class="terrain-result-chip">
						<span class="terrain-result-chip-label">${t('terrain:opticalVisibility')}</span>
						<span class="terrain-result-chip-value ${obstructed ? 'status-blocked' : 'status-ok'}">${obstructed ? t('terrain:blocked') : t('terrain:lineOfSightClear')}</span>
					</div>
					<div class="terrain-result-chip">
						<span class="terrain-result-chip-label">${t('terrain:smallestClearance')}</span>
						<span class="terrain-result-chip-value">${Math.round(worstClearance)} m</span>
					</div>
				</div>
				<div class="terrain-chart-wrap">${chartSvg}</div>
			`;
			resultEl.hidden = false;

			loadingToast.remove();
		} catch (err) {
			console.error('Failed to run terrain analysis:', err);
			loadingToast.remove();
			showToast(t('terrain:fetchElevationFailed'), { status: 'error', duration: 5000 });
		} finally {
			analyzeBtn.disabled = false;
		}
	});

	const closeAndSave = () => {
		stopPicking();
		saveState();
		modal.close();
	};

	closeBtn.addEventListener('click', closeAndSave);

	shareBtn.addEventListener('click', () => {
		if (!points.a || !points.b) return;

		const url = `${location.origin}${location.pathname}?terrain=${points.a.lat.toFixed(5)},${points.a.lng.toFixed(5)},${heightAInput.value};${points.b.lat.toFixed(5)},${points.b.lng.toFixed(5)},${heightBInput.value}`;
		void navigator.clipboard.writeText(url).then(() => showToast(t('common:copiedToClipboard')));
	});

	const resolveUrlPoint = point => {
		const nodes = getNodes ? getNodes() : [];
		const match = findNodeNearLatLng(nodes, point.lat, point.lng);
		return match ? { lat: point.lat, lng: point.lng, label: match.adv_name } : { lat: point.lat, lng: point.lng, label: null };
	};

	const loadFromUrlState = (pointA, pointB, heightA, heightB) => {
		setPoint('a', resolveUrlPoint(pointA));
		setPoint('b', resolveUrlPoint(pointB));
		if (heightA) heightAInput.value = heightA;
		if (heightB) heightBInput.value = heightB;
		modal.open();
		map.fitBounds([[pointA.lat, pointA.lng], [pointB.lat, pointB.lng]], { padding: [60, 60] });
	};

	return { ...modal, close: closeAndSave, loadFromUrlState };
};
