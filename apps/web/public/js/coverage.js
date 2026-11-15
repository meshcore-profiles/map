/* global L */
import { t } from './i18n.js';
import { initModal } from './modal.js';
import { ensurePane, escapeHtml, formatDistance, findNodeNearLatLng, loadJson, resolveNodeByQuery } from './pathtools.js';
import { destinationPoint, ELEVATION_PROVIDERS, fetchElevationsChunked, parseLatLng, requireFeature, requireSefinekElevationSource } from './elevation.js';
import { buildCoverageGrid, buildRayPoints, computeCoverage, computeLinkBudgetRangeM, computeSamplesPerRay, GRID_SHADES, gridAlpha, MAX_RANGE_M, RESOLUTIONS } from '/core/coverage.js';
import { truncateKey } from './node-utils.js';
import { NODE_TYPE_ICON_NAMES, PALETTE } from '/core/colors.js';
import { updateToast } from './toast.js';

const COLOR_OPTICAL = PALETTE.blue;
const COLOR_FRESNEL = PALETTE.green;
const COLOR_ORIGIN = PALETTE.amber;
const COLOR_BUDGET = PALETTE.textMuted;
const COLOR_BLOCKED = PALETTE.red;

const GRID_CELL_TARGET_M = 90;
const GRID_MAX_CELLS = 560;

const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

const STORAGE_KEY = 'coverageToolState';

export const initCoverageTool = ({ map, setPicker, getNodes, showToast, getElevationSource, getLayerStyle, getPresets }) => {
	const modal = initModal('coverage-toggle', 'coverage-overlay');
	const titleEl = document.getElementById('coverage-title');
	const closeBtn = document.getElementById('coverage-close-btn');
	const pointInput = document.getElementById('coverage-point-input');
	const pointIconEl = document.getElementById('coverage-point-icon');
	const pointIconUse = document.getElementById('coverage-point-icon-use');
	const pickBtn = document.getElementById('coverage-pick-btn');
	const presetSelect = document.getElementById('coverage-preset');
	const txHeightInput = document.getElementById('coverage-tx-height');
	const rxHeightInput = document.getElementById('coverage-rx-height');
	const freqInput = document.getElementById('coverage-freq');
	const resolutionSelect = document.getElementById('coverage-resolution');
	const marginInput = document.getElementById('coverage-terrain-margin');
	const erpInput = document.getElementById('coverage-erp');
	const sfInput = document.getElementById('coverage-sf');
	const bwInput = document.getElementById('coverage-bw');
	const estimateEl = document.getElementById('coverage-estimate');
	const computeBtn = document.getElementById('coverage-compute-btn');
	const shareBtn = document.getElementById('coverage-share-btn');
	const clearBtn = document.getElementById('coverage-clear-btn');
	const resultEl = document.getElementById('coverage-result');

	let origin = null;
	let coverageGroup = null;
	let lastRender = null;
	let legendControl = null;
	let clearPicker = null;
	let picking = false;
	let presetEntries = [];
	let presetsLoaded = false;
	let populatingPromise = null;

	const applyPreset = entry => {
		freqInput.value = entry.params.freq;
		sfInput.value = entry.params.sf;
		if ([...bwInput.options].some(o => Number(o.value) === entry.params.bw)) bwInput.value = entry.params.bw;
	};

	// Reentrant: a second call while the first is in flight awaits the same population instead of duplicating the <option> elements
	const populatePresets = () => {
		if (presetsLoaded) return Promise.resolve();
		if (populatingPromise) return populatingPromise;

		populatingPromise = getPresets()
			.then(entries => {
				presetEntries = entries.filter(entry => entry.params?.freq);
				presetEntries.forEach((entry, i) => {
					const option = document.createElement('option');
					option.value = String(i);
					option.textContent = `${entry.name} · ${entry.params.freq} MHz · SF${entry.params.sf} · BW${entry.params.bw}`;
					presetSelect.appendChild(option);
				});

				const defaultIndex = presetEntries.findIndex(entry => entry.name === window.MAP_CONFIG.defaultRadio);
				if (defaultIndex !== -1 && !presetSelect.value) {
					presetSelect.value = String(defaultIndex);
					// Only when nothing else (saved state, shared link) already filled the fields in first.
					if (!freqInput.value) applyPreset(presetEntries[defaultIndex]);
				}

				presetsLoaded = true;
			})
			.catch(err => {
				console.error('Failed to load radio presets:', err);
				presetSelect.disabled = true;
			})
			.finally(() => {
				populatingPromise = null;
			});

		return populatingPromise;
	};

	const isAvailable = () => requireFeature('coverage', showToast) && requireSefinekElevationSource(getElevationSource, showToast);

	new MutationObserver(() => {
		if (!modal.overlay.hidden) {
			if (!isAvailable()) {
				modal.close();
				return;
			}

			titleEl.textContent = t('coverage:titleWithSource', { source: ELEVATION_PROVIDERS.sefinek.label });
			populatePresets();
		}
	}).observe(modal.overlay, { attributes: true, attributeFilter: ['hidden'] });

	const ensureCoverageLayer = () => {
		if (coverageGroup) return coverageGroup;
		ensurePane(map, 'coveragePane', 640);
		coverageGroup = L.layerGroup().addTo(map);
		return coverageGroup;
	};

	const removeLayer = () => {
		if (coverageGroup) {
			map.removeLayer(coverageGroup);
			coverageGroup = null;
		}
		if (legendControl) {
			map.removeControl(legendControl);
			legendControl = null;
		}
	};

	// Rebuilt on every render: the ERP circle item depends on the current linkBudgetRangeM vs MAX_RANGE_M
	const ensureLegend = (showBudget, tiles) => {
		if (!legendControl) {
			legendControl = L.control({ position: 'bottomleft' });
			legendControl.onAdd = () => {
				const div = L.DomUtil.create('div', 'coverage-legend');
				L.DomEvent.disableClickPropagation(div);
				return div;
			};
			legendControl.addTo(map);
		}

		legendControl.getContainer().innerHTML = `
			${tiles ? `
				<div class="coverage-legend-item"><span class="coverage-legend-swatch coverage-legend-gradient"></span>${t('coverage:legendChance')}</div>
			` : `
				<div class="coverage-legend-item"><span class="coverage-legend-swatch coverage-legend-optical"></span>${t('coverage:opticalCriterion')}</div>
				<div class="coverage-legend-item"><span class="coverage-legend-swatch coverage-legend-fresnel"></span>${t('coverage:fresnelCriterion')}</div>
			`}
			${showBudget ? `<div class="coverage-legend-item"><span class="coverage-legend-swatch coverage-legend-budget"></span>${t('coverage:linkBudgetCriterion')}</div>` : ''}
		`;
	};

	const updateShareButton = () => {
		shareBtn.hidden = !origin || resultEl.hidden;
	};

	const saveState = () => {
		if (!origin) {
			localStorage.removeItem(STORAGE_KEY);
			return;
		}

		localStorage.setItem(STORAGE_KEY, JSON.stringify({
			origin,
			txHeight: txHeightInput.value,
			rxHeight: rxHeightInput.value,
			freq: freqInput.value,
			resolution: resolutionSelect.value,
			terrainMargin: marginInput.value,
			erp: erpInput.value,
			sf: sfInput.value,
			bw: bwInput.value,
		}));
	};

	const updatePointIcon = type => {
		const iconName = NODE_TYPE_ICON_NAMES[type];
		pointIconEl.hidden = !iconName;
		if (iconName) pointIconUse.setAttribute('href', `/icons/node-types.svg#${iconName}-plain`);
	};

	const applyOrigin = point => {
		origin = { lat: point.lat, lng: point.lng, label: point.label || null, type: point.type ?? null, key: point.key || null };
		if (point.freq) freqInput.value = point.freq;
		if (point.sf) sfInput.value = point.sf;
		if (point.bw) bwInput.value = point.bw;
		updatePointIcon(point.type);
		updateShareButton();
		saveState();
	};

	const formatPointLabel = point => {
		if (!point.label) return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
		return point.key ? `${point.label} (${truncateKey(point.key, 6)})` : point.label;
	};

	const setOriginFromPick = point => {
		applyOrigin(point);
		pointInput.value = formatPointLabel(point);
	};

	const stopPicking = () => {
		if (!picking) return;
		picking = false;
		pickBtn.classList.remove('active');
		clearPicker?.();
		clearPicker = null;
		map.getContainer().classList.remove('pick-cursor');
	};

	const startPicking = () => {
		if (picking) {
			stopPicking();
			modal.open();
			return;
		}

		stopPicking();
		picking = true;
		pickBtn.classList.add('active');
		map.getContainer().classList.add('pick-cursor');

		modal.close();
		modal.toggle.classList.add('active');

		clearPicker = setPicker({
			onMap: latlng => {
				setOriginFromPick({ lat: latlng.lat, lng: latlng.lng, label: null });
				stopPicking();
				modal.open();
			},
			onNode: node => {
				setOriginFromPick({ lat: node.lat, lng: node.lon, label: node.adv_name, key: node.public_key, type: node.type, freq: node.params?.freq, sf: node.params?.sf, bw: node.params?.bw });
				stopPicking();
				modal.open();
			},
		});
	};

	pickBtn.addEventListener('click', startPicking);

	const syncFromInput = () => {
		const text = pointInput.value;
		const coords = parseLatLng(text);
		if (coords) {
			applyOrigin({ ...coords, label: null });
			return;
		}

		const node = resolveNodeByQuery(text, getNodes());
		if (node) applyOrigin({ lat: node.lat, lng: node.lon, label: node.adv_name, key: node.public_key, type: node.type, freq: node.params?.freq, sf: node.params?.sf, bw: node.params?.bw });
	};

	pointInput.addEventListener('input', syncFromInput);

	pointInput.addEventListener('change', () => {
		if (origin?.label) pointInput.value = formatPointLabel(origin);
	});

	const updateEstimate = () => {
		const bearings = RESOLUTIONS[resolutionSelect.value] || RESOLUTIONS.high;
		const budgetM = computeLinkBudgetRangeM(Number(erpInput.value) || 0, Number(freqInput.value) || 869, Number(sfInput.value) || 9, Number(bwInput.value) || 250);
		const samples = computeSamplesPerRay(Math.min(MAX_RANGE_M, budgetM), bearings);
		const totalPoints = bearings * samples + 1;
		estimateEl.textContent = t('coverage:estimate', { points: totalPoints });
	};

	[resolutionSelect, freqInput, erpInput, sfInput, bwInput].forEach(el => el.addEventListener('change', updateEstimate));
	updateEstimate();

	[txHeightInput, rxHeightInput, freqInput, marginInput, erpInput, sfInput, bwInput].forEach(el => el.addEventListener('change', saveState));
	resolutionSelect.addEventListener('change', saveState);

	presetSelect.addEventListener('change', () => {
		const entry = presetEntries[Number(presetSelect.value)];
		if (!entry) return;

		applyPreset(entry);
		updateEstimate();
		saveState();
	});

	[freqInput, sfInput, bwInput].forEach(el => el.addEventListener('change', () => {
		presetSelect.value = '';
	}));

	// One pixel per cell; the overlay is drawn with pixelated scaling so every cell shows as a square.
	const buildGridImage = (rayResults, capM, linkBudgetRangeM) => {
		const { cells, items } = buildCoverageGrid({ rayResults, capM, linkBudgetRangeM, cellTargetM: GRID_CELL_TARGET_M, maxCells: GRID_MAX_CELLS });

		const canvas = document.createElement('canvas');
		canvas.width = cells;
		canvas.height = cells;
		const ctx = canvas.getContext('2d');

		for (const { px, py, level } of items) {
			ctx.globalAlpha = gridAlpha(level);
			ctx.fillStyle = GRID_SHADES[level];
			ctx.fillRect(px, py, 1, 1);
		}

		return canvas.toDataURL();
	};

	const drawTiles = (group, rayResults, searchCapM, linkBudgetRangeM) => {
		const gridBounds = L.latLngBounds(
			[destinationPoint(origin, 180, searchCapM).lat, destinationPoint(origin, 270, searchCapM).lng],
			[destinationPoint(origin, 0, searchCapM).lat, destinationPoint(origin, 90, searchCapM).lng]
		);

		L.imageOverlay(buildGridImage(rayResults, searchCapM, linkBudgetRangeM), gridBounds, {
			pane: 'coveragePane',
			interactive: false,
			className: 'coverage-grid',
		}).addTo(group);
	};

	const drawLines = (group, rayResults, searchCapM) => {
		const opticalPoints = rayResults.map(r => r.opticalPoint);
		const fresnelPoints = rayResults.map(r => r.fresnelPoint);

		L.polygon(opticalPoints.map(p => [p.lat, p.lng]), {
			pane: 'coveragePane',
			color: COLOR_OPTICAL,
			weight: 1.5,
			dashArray: '6 6',
			fillOpacity: 0.04,
		}).bindTooltip(t('coverage:opticalCriterion')).addTo(group);

		L.polygon(fresnelPoints.map(p => [p.lat, p.lng]), {
			pane: 'coveragePane',
			color: COLOR_FRESNEL,
			weight: 2,
			fillOpacity: 0.22,
		}).bindTooltip(t('coverage:fresnelCriterion')).addTo(group);

		for (const r of rayResults) {
			const clear = r.opticalRange >= searchCapM - 1;
			const color = clear ? COLOR_FRESNEL : COLOR_BLOCKED;

			L.circleMarker([r.fresnelPoint.lat, r.fresnelPoint.lng], {
				pane: 'coveragePane',
				radius: 3,
				color,
				weight: 1,
				fillColor: color,
				fillOpacity: 0.9,
			}).bindTooltip(t(clear ? 'coverage:rayTooltipClear' : 'coverage:rayTooltip', {
				bearing: Math.round(r.bearingDeg),
				optical: formatDistance(r.opticalRange),
				fresnel: formatDistance(r.fresnelRange),
			})).addTo(group);
		}
	};

	const renderLayer = (rayResults, linkBudgetRangeM, fit = true) => {
		lastRender = { rayResults, linkBudgetRangeM };

		const group = ensureCoverageLayer();
		group.clearLayers();

		const searchCapM = Math.min(MAX_RANGE_M, linkBudgetRangeM);
		const tiles = getLayerStyle() === 'tiles';
		(tiles ? drawTiles : drawLines)(group, rayResults, searchCapM, linkBudgetRangeM);

		const budgetLimits = linkBudgetRangeM < MAX_RANGE_M;
		if (budgetLimits) {
			L.circle([origin.lat, origin.lng], {
				pane: 'coveragePane',
				radius: linkBudgetRangeM,
				color: COLOR_BUDGET,
				weight: 1.5,
				dashArray: '2 6',
				fill: false,
			}).bindTooltip(t('coverage:linkBudgetRange', { range: formatDistance(linkBudgetRangeM) })).addTo(group);
		}

		L.circleMarker([origin.lat, origin.lng], {
			pane: 'coveragePane',
			radius: 7,
			color: COLOR_ORIGIN,
			weight: 3,
			fillColor: COLOR_ORIGIN,
			fillOpacity: 0.9,
		}).bindTooltip(origin.label ? escapeHtml(origin.label) : t('coverage:originFallback')).addTo(group);

		ensureLegend(budgetLimits, tiles);
		if (fit) {
			const bounds = L.latLngBounds(rayResults.map(r => [r.opticalPoint.lat, r.opticalPoint.lng]));
			bounds.extend([origin.lat, origin.lng]);
			map.fitBounds(bounds, { padding: [60, 60] });
		}
	};

	const refreshLayer = () => {
		if (lastRender) renderLayer(lastRender.rayResults, lastRender.linkBudgetRangeM, false);
	};

	const renderSummary = (opticalRanges, fresnelRanges, linkBudgetRangeM) => {
		const searchCapM = Math.min(MAX_RANGE_M, linkBudgetRangeM);

		const group = (label, kind, ranges) => `
			<div class="coverage-result-group">
				<div class="coverage-result-group-title coverage-result-group-title-${kind}">${label}</div>
				<div class="terrain-result-summary">
					<div class="terrain-result-chip">
						<span class="terrain-result-chip-label">${t('coverage:maxRangeLabel')}</span>
						<span class="terrain-result-chip-value">${formatDistance(Math.max(...ranges))}</span>
					</div>
					<div class="terrain-result-chip">
						<span class="terrain-result-chip-label">${t('coverage:avgRangeLabel')}</span>
						<span class="terrain-result-chip-value">${formatDistance(avg(ranges))}</span>
					</div>
					<div class="terrain-result-chip">
						<span class="terrain-result-chip-label">${t('coverage:minRangeLabel')}</span>
						<span class="terrain-result-chip-value">${formatDistance(Math.min(...ranges))}</span>
					</div>
					<div class="terrain-result-chip">
						<span class="terrain-result-chip-label">${t('coverage:clearDirectionsLabel')}</span>
						<span class="terrain-result-chip-value">${ranges.filter(r => r >= searchCapM - 1).length}/${ranges.length}</span>
					</div>
				</div>
			</div>
		`;

		resultEl.innerHTML = `
			<p class="setting-desc tool-modal-desc">${t('coverage:linkBudgetRange', { range: formatDistance(linkBudgetRangeM) })}</p>
			<div class="coverage-result-summary">
				${group(t('coverage:opticalCriterion'), 'optical', opticalRanges)}
				${group(t('coverage:fresnelCriterion'), 'fresnel', fresnelRanges)}
			</div>
		`;
		resultEl.hidden = false;
	};

	computeBtn.addEventListener('click', async () => {
		if (!origin) {
			showToast(t('coverage:selectPoint'), { status: 'error' });
			return;
		}

		if (!isAvailable()) return;

		const freqMHz = Number(freqInput.value);
		if (!freqMHz || freqMHz <= 0) {
			showToast(t('coverage:invalidFrequency'), { status: 'error' });
			return;
		}

		const txHeight = Number(txHeightInput.value) || 0;
		const rxHeight = Number(rxHeightInput.value) || 0;
		const margin = Number(marginInput.value) || 0;
		const erpDbm = Number(erpInput.value) || 0;
		const sf = Number(sfInput.value) || 9;
		const bwKHz = Number(bwInput.value) || 250;
		const linkBudgetRangeM = computeLinkBudgetRangeM(erpDbm, freqMHz, sf, bwKHz);

		const bearings = RESOLUTIONS[resolutionSelect.value] || RESOLUTIONS.high;
		const searchRangeM = Math.min(MAX_RANGE_M, linkBudgetRangeM);
		const samplesPerRay = computeSamplesPerRay(searchRangeM, bearings);

		computeBtn.disabled = true;
		const loadingToast = showToast(t('coverage:fetchingElevation'), { duration: 0, status: 'loading' });

		try {
			const allPoints = [origin, ...buildRayPoints(origin, bearings, samplesPerRay, searchRangeM)];
			const elevations = await fetchElevationsChunked(allPoints, 'sefinek', (current, total) => {
				if (total > 1) updateToast(loadingToast, t('coverage:fetchingElevationProgress', { current, total }), { duration: 0, status: 'loading' });
			});

			const rayResults = computeCoverage({ origin, elevations, bearings, samplesPerRay, searchRangeM, txHeight, rxHeight, freqMHz, margin, linkBudgetRangeM });
			const opticalRanges = rayResults.map(r => r.opticalRange);
			const fresnelRanges = rayResults.map(r => r.fresnelRange);

			renderLayer(rayResults, linkBudgetRangeM);
			renderSummary(opticalRanges, fresnelRanges, linkBudgetRangeM);
			updateShareButton();

			loadingToast.remove();
		} catch (err) {
			console.error('Failed to compute coverage:', err);
			loadingToast.remove();
			showToast(t('coverage:fetchElevationFailed'), { status: 'error', duration: 5000 });
		} finally {
			computeBtn.disabled = false;
		}
	});

	const reset = () => {
		stopPicking();
		origin = null;
		pointInput.value = '';
		updatePointIcon(null);
		removeLayer();
		lastRender = null;
		resultEl.hidden = true;
		resultEl.innerHTML = '';
		localStorage.removeItem(STORAGE_KEY);
		updateShareButton();
	};

	clearBtn.addEventListener('click', reset);

	const closeAndSave = () => {
		stopPicking();
		saveState();
		modal.close();
	};

	closeBtn.addEventListener('click', closeAndSave);

	shareBtn.addEventListener('click', () => {
		if (!origin) return;

		const params = [
			origin.lat.toFixed(5), origin.lng.toFixed(5),
			txHeightInput.value, rxHeightInput.value, freqInput.value,
			resolutionSelect.value, marginInput.value,
			erpInput.value, sfInput.value, bwInput.value,
		].join(',');

		const url = `${location.origin}${location.pathname}?coverage=${params}`;
		void navigator.clipboard.writeText(url).then(() => showToast(t('common:copiedToClipboard')));
	});

	const restoreState = () => {
		const saved = loadJson(STORAGE_KEY);
		if (!saved?.origin) return;

		setOriginFromPick(saved.origin);
		if (saved.txHeight) txHeightInput.value = saved.txHeight;
		if (saved.rxHeight) rxHeightInput.value = saved.rxHeight;
		if (saved.freq) freqInput.value = saved.freq;
		if (saved.resolution) resolutionSelect.value = saved.resolution;
		if (saved.terrainMargin) marginInput.value = saved.terrainMargin;
		if (saved.erp) erpInput.value = saved.erp;
		if (saved.sf) sfInput.value = saved.sf;
		if (saved.bw) bwInput.value = saved.bw;
		updateEstimate();
	};

	restoreState();
	updateShareButton();

	const resolveUrlPoint = (lat, lng) => {
		const nodes = getNodes ? getNodes() : [];
		const match = findNodeNearLatLng(nodes, lat, lng);
		return { lat, lng, label: match ? match.adv_name : null, key: match?.public_key, type: match?.type, freq: match?.params?.freq, sf: match?.params?.sf, bw: match?.params?.bw };
	};

	const loadFromUrlState = (lat, lng, txHeight, rxHeight, freq, resolution, terrainMargin, erp, sf, bw) => {
		setOriginFromPick(resolveUrlPoint(lat, lng));
		if (Number.isFinite(txHeight)) txHeightInput.value = txHeight;
		if (Number.isFinite(rxHeight)) rxHeightInput.value = rxHeight;
		if (Number.isFinite(freq)) freqInput.value = freq;
		if (resolution && RESOLUTIONS[resolution]) resolutionSelect.value = resolution;
		if (Number.isFinite(terrainMargin)) marginInput.value = terrainMargin;
		if (Number.isFinite(erp)) erpInput.value = erp;
		if (Number.isFinite(sf)) sfInput.value = sf;
		if (Number.isFinite(bw)) bwInput.value = bw;
		updateEstimate();
		modal.open();
		map.setView([lat, lng], 12);
	};

	return { ...modal, close: closeAndSave, loadFromUrlState, refreshLayer };
};
