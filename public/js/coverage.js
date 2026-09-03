/* global L */
import { t } from './i18n.js';
import { initModal } from './modal.js';
import { ensurePane, escapeHtml, formatDistance, findNodeNearLatLng, loadJson, resolveNodeByQuery } from './pathtools.js';
import { curvatureDrop, destinationPoint, ELEVATION_PROVIDERS, fetchElevations, parseLatLng } from './elevation.js';
import { truncateKey } from './node-utils.js';
import { updateToast } from './toast.js';

const SPEED_OF_LIGHT = 299792458;
const FRESNEL_CLEARANCE_FACTOR = 0.6;
const MAX_TOTAL_POINTS = 6000;
const SAMPLE_SPACING_TARGET = 300;
const MIN_SAMPLES_PER_RAY = 20;
const MAX_SAMPLES_PER_RAY = 60;
const DEFAULT_CHUNK_SIZE = 100;

const RESOLUTIONS = { fast: 36, standard: 72, high: 144 };
const NODE_TYPE_ICON_NAMES = { 1: 'client', 2: 'repeater', 3: 'room-server', 4: 'sensor' };

const COLOR_OPTICAL = '#4dabf7';
const COLOR_FRESNEL = '#2dd881';
const COLOR_ORIGIN = '#f2b134';
const COLOR_BUDGET = '#99a1b5';
const COLOR_BLOCKED = '#e01230';

// Approximate LoRa (SX127x/SX126x-class) receiver sensitivity at BW=125kHz, from common
// Semtech datasheet figures. Scaled to other bandwidths via the noise-bandwidth relationship.
// No confirmed SF5 figure (SX126x-only, not in the SX127x table this is based on, and no
// MeshCore preset actually uses it) - falls back to SF6 as the closest known value.
const SENSITIVITY_125K_DBM = { 6: -118, 7: -123, 8: -126, 9: -129, 10: -132, 11: -133, 12: -136 };
const LINK_FADE_MARGIN_DB = 10;

const computeSamplesPerRay = (maxRangeM, bearings) => {
	let samples = Math.min(MAX_SAMPLES_PER_RAY, Math.max(MIN_SAMPLES_PER_RAY, Math.round(maxRangeM / SAMPLE_SPACING_TARGET)));
	if (bearings * samples > MAX_TOTAL_POINTS) samples = Math.max(MIN_SAMPLES_PER_RAY, Math.floor(MAX_TOTAL_POINTS / bearings));
	return samples;
};

// Free-space path loss + LoRa sensitivity budget -> a single max range (same in every
// direction, since it doesn't depend on terrain). The per-bearing terrain range is then
// capped by this, so the shown polygon reflects whichever limit is tighter.
const computeLinkBudgetRangeM = (erpDbm, freqMHz, sf, bwKHz) => {
	const sensitivity125 = SENSITIVITY_125K_DBM[sf] ?? SENSITIVITY_125K_DBM[6];
	const sensitivity = sensitivity125 + 10 * Math.log10((bwKHz * 1000) / 125000);
	const budgetDb = erpDbm - sensitivity - LINK_FADE_MARGIN_DB;
	const rangeKm = 10 ** ((budgetDb - 20 * Math.log10(freqMHz) - 32.44) / 20);
	return Math.max(0, rangeKm * 1000);
};

const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

const STORAGE_KEY = 'coverageToolState';

export const initCoverageTool = ({ map, setPicker, getNodes, showToast, getElevationSource, getPresets }) => {
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
	const maxRangeInput = document.getElementById('coverage-max-range');
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

	// Reentrant-safe: the modal can close and reopen (e.g. mid-pick via "Wskaż na mapie")
	// before the first call resolves, so a second call must await the same in-flight
	// population instead of appending a duplicate set of <option> elements. Shares map.js's
	// own getPresets() (and its cache) instead of fetching api.meshcore.nz a second time.
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

	new MutationObserver(() => {
		if (!modal.overlay.hidden) {
			const source = getElevationSource ? getElevationSource() : 'sefinek';
			titleEl.textContent = t('coverage:titleWithSource', { source: (ELEVATION_PROVIDERS[source] || ELEVATION_PROVIDERS.sefinek).label });
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

	// Rebuilds the legend content on every render (not just once), since whether the ERP
	// circle item applies depends on the current computation (linkBudgetRangeM vs maxRangeM),
	// which can change between one "Oblicz zasięg" click and the next.
	const ensureLegend = showBudget => {
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
			<div class="coverage-legend-item"><span class="coverage-legend-swatch coverage-legend-optical"></span>${t('coverage:opticalCriterion')}</div>
			<div class="coverage-legend-item"><span class="coverage-legend-swatch coverage-legend-fresnel"></span>${t('coverage:fresnelCriterion')}</div>
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
			maxRange: maxRangeInput.value,
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

	// Once the user is done typing, normalize the field to the canonical "name (key)" form
	// (matching what picking on the map or clicking a node produces) instead of leaving
	// whatever partial text they typed to find the match.
	pointInput.addEventListener('change', () => {
		if (origin?.label) pointInput.value = formatPointLabel(origin);
	});

	const updateEstimate = () => {
		const bearings = RESOLUTIONS[resolutionSelect.value] || RESOLUTIONS.standard;
		const maxRangeM = (Number(maxRangeInput.value) || 0) * 1000;
		const samples = computeSamplesPerRay(maxRangeM, bearings);
		const totalPoints = bearings * samples + 1;
		estimateEl.textContent = t('coverage:estimate', { points: totalPoints });
	};

	maxRangeInput.addEventListener('input', updateEstimate);
	resolutionSelect.addEventListener('change', updateEstimate);
	updateEstimate();

	[txHeightInput, rxHeightInput, freqInput, maxRangeInput, marginInput, erpInput, sfInput, bwInput].forEach(el => el.addEventListener('change', saveState));
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

	const renderLayer = (rayResults, maxRangeM, linkBudgetRangeM) => {
		const group = ensureCoverageLayer();
		group.clearLayers();

		const opticalPoints = rayResults.map(r => r.opticalPoint);
		const fresnelPoints = rayResults.map(r => r.fresnelPoint);
		const searchCapM = Math.min(maxRangeM, linkBudgetRangeM);

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

		const budgetLimits = linkBudgetRangeM < maxRangeM;
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

		L.circleMarker([origin.lat, origin.lng], {
			pane: 'coveragePane',
			radius: 7,
			color: COLOR_ORIGIN,
			weight: 3,
			fillColor: COLOR_ORIGIN,
			fillOpacity: 0.9,
		}).bindTooltip(origin.label ? escapeHtml(origin.label) : t('coverage:originFallback')).addTo(group);

		ensureLegend(budgetLimits);
		map.fitBounds(L.latLngBounds(opticalPoints.map(p => [p.lat, p.lng])), { padding: [40, 40] });
	};

	const renderSummary = (opticalRanges, fresnelRanges, maxRangeM, linkBudgetRangeM) => {
		const searchCapM = Math.min(maxRangeM, linkBudgetRangeM);

		const group = (label, color, ranges) => `
			<div class="coverage-result-group">
				<div class="coverage-result-group-title" style="color:${color}">${label}</div>
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
				${group(t('coverage:opticalCriterion'), COLOR_OPTICAL, opticalRanges)}
				${group(t('coverage:fresnelCriterion'), COLOR_FRESNEL, fresnelRanges)}
			</div>
		`;
		resultEl.hidden = false;
	};

	const computeRayRanges = (elevations, base, samplesPerRay, distances, elevA, rxHeight, lambda, margin, linkBudgetRangeM) => {
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

	computeBtn.addEventListener('click', async () => {
		if (!origin) {
			showToast(t('coverage:selectPoint'), { status: 'error' });
			return;
		}

		const freqMHz = Number(freqInput.value);
		if (!freqMHz || freqMHz <= 0) {
			showToast(t('coverage:invalidFrequency'), { status: 'error' });
			return;
		}

		const txHeight = Number(txHeightInput.value) || 0;
		const rxHeight = Number(rxHeightInput.value) || 0;
		const maxRangeM = (Number(maxRangeInput.value) || 0) * 1000;
		if (maxRangeM < 100) {
			showToast(t('coverage:invalidRange'), { status: 'error' });
			return;
		}

		const margin = Number(marginInput.value) || 0;
		const erpDbm = Number(erpInput.value) || 0;
		const sf = Number(sfInput.value) || 9;
		const bwKHz = Number(bwInput.value) || 250;
		const linkBudgetRangeM = computeLinkBudgetRangeM(erpDbm, freqMHz, sf, bwKHz);

		const bearings = RESOLUTIONS[resolutionSelect.value] || RESOLUTIONS.standard;
		const samplesPerRay = computeSamplesPerRay(maxRangeM, bearings);
		const bearingStep = 360 / bearings;

		computeBtn.disabled = true;
		const loadingToast = showToast(t('coverage:fetchingElevation'), { duration: 0, status: 'loading' });

		try {
			const rayPoints = [];
			for (let b = 0; b < bearings; b++) {
				const bearingDeg = b * bearingStep;
				for (let i = 1; i <= samplesPerRay; i++) {
					rayPoints.push(destinationPoint(origin, bearingDeg, (i / samplesPerRay) * maxRangeM));
				}
			}

			const allPoints = [origin, ...rayPoints];
			const elevations = new Array(allPoints.length);
			const source = getElevationSource ? getElevationSource() : 'sefinek';
			const chunkSize = (ELEVATION_PROVIDERS[source] || ELEVATION_PROVIDERS.sefinek).maxBatchSize || DEFAULT_CHUNK_SIZE;
			const chunkCount = Math.ceil(allPoints.length / chunkSize);

			for (let c = 0; c < chunkCount; c++) {
				const start = c * chunkSize;
				const end = Math.min(start + chunkSize, allPoints.length);
				if (chunkCount > 1) updateToast(loadingToast, t('coverage:fetchingElevationProgress', { current: c + 1, total: chunkCount }), { duration: 0, status: 'loading' });
				const chunkElevations = await fetchElevations(allPoints.slice(start, end), source);
				for (let k = 0; k < chunkElevations.length; k++) elevations[start + k] = chunkElevations[k];
			}

			const elevA = elevations[0] + txHeight;
			const lambda = SPEED_OF_LIGHT / (freqMHz * 1e6);

			const distances = new Array(samplesPerRay);
			for (let i = 0; i < samplesPerRay; i++) distances[i] = ((i + 1) / samplesPerRay) * maxRangeM;

			const opticalRanges = [], fresnelRanges = [];
			const rayResults = [];

			for (let b = 0; b < bearings; b++) {
				const bearingDeg = b * bearingStep;
				const base = 1 + b * samplesPerRay;

				const { opticalRange, fresnelRange } = computeRayRanges(elevations, base, samplesPerRay, distances, elevA, rxHeight, lambda, margin, linkBudgetRangeM);

				opticalRanges.push(opticalRange);
				fresnelRanges.push(fresnelRange);
				rayResults.push({
					bearingDeg,
					opticalRange,
					fresnelRange,
					opticalPoint: destinationPoint(origin, bearingDeg, opticalRange),
					fresnelPoint: destinationPoint(origin, bearingDeg, fresnelRange),
				});
			}

			renderLayer(rayResults, maxRangeM, linkBudgetRangeM);
			renderSummary(opticalRanges, fresnelRanges, maxRangeM, linkBudgetRangeM);
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
			maxRangeInput.value, resolutionSelect.value, marginInput.value,
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
		if (saved.maxRange) maxRangeInput.value = saved.maxRange;
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

	const loadFromUrlState = (lat, lng, txHeight, rxHeight, freq, maxRange, resolution, terrainMargin, erp, sf, bw) => {
		setOriginFromPick(resolveUrlPoint(lat, lng));
		if (Number.isFinite(txHeight)) txHeightInput.value = txHeight;
		if (Number.isFinite(rxHeight)) rxHeightInput.value = rxHeight;
		if (Number.isFinite(freq)) freqInput.value = freq;
		if (Number.isFinite(maxRange)) maxRangeInput.value = maxRange;
		if (resolution && RESOLUTIONS[resolution]) resolutionSelect.value = resolution;
		if (Number.isFinite(terrainMargin)) marginInput.value = terrainMargin;
		if (Number.isFinite(erp)) erpInput.value = erp;
		if (Number.isFinite(sf)) sfInput.value = sf;
		if (Number.isFinite(bw)) bwInput.value = bw;
		updateEstimate();
		modal.open();
		map.setView([lat, lng], 12);
	};

	return { ...modal, close: closeAndSave, loadFromUrlState };
};
