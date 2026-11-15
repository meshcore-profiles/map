import { t } from './i18n.js';
import { createPathLayer, findNodeNearLatLng, formatDistance, loadJson } from './pathtools.js';
import { truncateKey } from './node-utils.js';

const STORAGE_KEY = 'measureToolPoints';
const LABEL_MODE_STORAGE_KEY = 'measureLabelMode';
const POINT_HIT_RADIUS_PX = 14;

const LABEL_MODES = ['name', '1', '2', '3', 'mid'];
const LABEL_MODE_TEXT = {
	name: t('measure:labelModes.name'),
	1: t('measure:labelModes.bytes1'),
	2: t('measure:labelModes.bytes2'),
	3: t('measure:labelModes.bytes3'),
	mid: t('measure:labelModes.mid'),
};

const loadSavedPoints = () => {
	const raw = loadJson(STORAGE_KEY);
	return Array.isArray(raw) ? raw : [];
};

export const initMeasureTool = ({ map, setPicker, escapeHtml, getNodes, showToast }) => {
	const toggle = document.getElementById('measure-toggle');
	const panel = document.getElementById('measure-panel');
	const closeBtn = document.getElementById('measure-close-btn');
	const listEl = document.getElementById('measure-list');
	const totalEl = document.getElementById('measure-total');
	const undoBtn = document.getElementById('measure-undo-btn');
	const clearBtn = document.getElementById('measure-clear-btn');
	const labelModeBtn = document.getElementById('measure-label-mode-btn');
	const shareBtn = document.getElementById('measure-share-btn');

	const path = createPathLayer({ map, color: '#4dabf7' });
	let active = false;
	let clearPicker = null;
	const savedLabelMode = localStorage.getItem(LABEL_MODE_STORAGE_KEY);
	let labelMode = savedLabelMode === 'bytes' ? '2' : LABEL_MODES.includes(savedLabelMode) ? savedLabelMode : 'name';
	let shareUrl = '';

	const getPointLabel = (point, fallback) => {
		if (labelMode === 'mid' && point.nodeKey) return truncateKey(point.nodeKey, 6);
		if (labelMode !== 'name' && point.nodeKey) return point.nodeKey.slice(0, Number(labelMode) * 2);
		return point.label || fallback;
	};

	const renderList = () => {
		const segments = path.getSegments();
		const points = path.getPoints();

		if (segments.length) {
			listEl.innerHTML = segments.map((s, i) => `
				<li>
					<span>${i + 1}. ${escapeHtml(getPointLabel(s.from, t('common:pointFallback', { n: i + 1 })))} → ${escapeHtml(getPointLabel(s.to, t('common:pointFallback', { n: i + 2 })))}</span>
					<b>${formatDistance(s.distance)}</b>
				</li>
			`).join('');
		} else if (points.length === 1) {
			listEl.innerHTML = `<li class="tool-panel-empty">${t('measure:selectSecondPoint')}</li>`;
		} else {
			listEl.innerHTML = `<li class="tool-panel-empty">${t('measure:noPointsSelected')}</li>`;
		}

		totalEl.textContent = formatDistance(path.getTotalDistance(segments));
		undoBtn.hidden = points.length === 0;
		shareBtn.hidden = points.length === 0;

		if (points.length) {
			const coords = points.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';');
			shareUrl = `${location.origin}${location.pathname}?measure=${coords}`;
		}
	};

	const savePoints = () => {
		const points = path.getPoints();
		if (points.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(points));
		else localStorage.removeItem(STORAGE_KEY);
	};

	const addPoint = (lat, lng, label, nodeKey = null) => {
		path.addPoint({ lat, lng, label, nodeKey });
		renderList();
	};

	const findPointNear = (lat, lng) => {
		const clickPx = map.latLngToContainerPoint([lat, lng]);
		return path.getPoints().findIndex(p => clickPx.distanceTo(map.latLngToContainerPoint([p.lat, p.lng])) <= POINT_HIT_RADIUS_PX);
	};

	const toggleOrAddPoint = (lat, lng, label, nodeKey = null) => {
		const existingIndex = findPointNear(lat, lng);

		if (existingIndex !== -1) {
			path.setPoints(path.getPoints().filter((_, i) => i !== existingIndex));
			renderList();
		} else {
			addPoint(lat, lng, label, nodeKey);
		}
	};

	const setActive = value => {
		active = value;
		toggle.classList.toggle('active', active);
		panel.hidden = !active;
		map.getContainer().classList.toggle('measure-cursor', active);

		if (active) {
			path.show();
			clearPicker = setPicker({
				onMap: latlng => toggleOrAddPoint(latlng.lat, latlng.lng, null),
				onNode: node => toggleOrAddPoint(node.lat, node.lon, node.adv_name, node.public_key),
			});
		} else {
			clearPicker?.();
			clearPicker = null;
			savePoints();
			path.hide();
		}
	};

	toggle.addEventListener('click', () => setActive(!active));
	closeBtn.addEventListener('click', () => setActive(false));

	undoBtn.addEventListener('click', () => {
		path.removeLastPoint();
		renderList();
	});

	clearBtn.addEventListener('click', () => {
		path.clear();
		renderList();
	});

	labelModeBtn.addEventListener('click', () => {
		labelMode = LABEL_MODES[(LABEL_MODES.indexOf(labelMode) + 1) % LABEL_MODES.length];
		labelModeBtn.textContent = LABEL_MODE_TEXT[labelMode];
		localStorage.setItem(LABEL_MODE_STORAGE_KEY, labelMode);
		renderList();
	});

	shareBtn.addEventListener('click', () => {
		if (shareUrl) void navigator.clipboard.writeText(shareUrl).then(() => showToast(t('common:copiedToClipboard')));
	});

	labelModeBtn.textContent = LABEL_MODE_TEXT[labelMode];

	const savedPoints = loadSavedPoints();
	if (savedPoints.length) path.setPoints(savedPoints);
	path.hide();

	renderList();

	const loadFromUrlPoints = coordPairs => {
		const nodes = getNodes ? getNodes() : [];
		const pts = coordPairs.map(({ lat, lng }) => {
			const match = findNodeNearLatLng(nodes, lat, lng);
			return match ? { lat, lng, label: match.adv_name, nodeKey: match.public_key } : { lat, lng, label: null, nodeKey: null };
		});

		path.setPoints(pts);
		setActive(true);
		renderList();
		path.fitBounds();
	};

	return {
		toggle,
		close: () => setActive(false),
		loadFromUrlPoints,
	};
};
