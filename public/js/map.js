/* global L */
import { unpack } from '../vendor/msgpackr/msgpackr.js';
import { toCanvas as qrToCanvas } from '../vendor/qrcode/qrcode.js';
import * as ntools from './node-utils.js';
import { t, tRaw, plural } from './i18n.js';
import { initModal } from './modal.js';
import { initLegendPanel } from './legend.js';
import { initStatsModal } from './stats.js';
import { initChangelogModal } from './changelog.js';
import { initMeasureTool } from './measure.js';
import { initRouteTool } from './route.js';
import { initTerrainTool } from './terrain.js';
import { showToast, updateToast, showActionToast, dismissToast } from './toast.js';

const apiUrl = region => `/api/v1/nodes?region=${region}`;

const uint8ArrayToHex = uint8arr => {
	const hexOctets = new Array(uint8arr.length);
	for (let i = 0; i < uint8arr.length; ++i) {
		hexOctets[i] = ntools.byteToHex[uint8arr[i]];
	}

	return hexOctets.join('');
};

let presets = [];

const nodeKeys = {
	pk: {
		key: 'public_key',
		convert: val => uint8ArrayToHex(val),
	},
	t: {
		key: 'type',
	},
	n: {
		key: 'adv_name',
	},
	la: {
		key: 'last_advert',
	},
	id: {
		key: 'inserted_date',
	},
	ud: {
		key: 'updated_date',
	},
	p: {
		key: 'params',
	},
	l: {
		key: 'link',
	},
	s: {
		key: 'source',
	},
};

const nodeTypeKeys = { '1': 'client', '2': 'repeater', '3': 'roomServer', '4': 'sensor' };
const typeName = type => t(`map:nodeTypes.${nodeTypeKeys[type]}`);
const contactAddableTypes = [1, 2, 3];
const statusDesc = status => t(`map:updateStatus.${status}`);

const radioParamDesc = {
	'bw': { unit: 'kHz', short: '' },
	'freq': { unit: 'MHz', short: '' },
	'sf': { unit: '', short: 'SF' },
	'cr': { unit: '', short: 'CR' },
};
const radioParamLabel = key => t(`map:radioParams.${key}`);

const statusBadgeClass = {
	'none': 'badge-status-none',
	'recent': 'badge-status-recent',
	'stale': 'badge-status-stale',
	'old': 'badge-status-old',
	'extinct': 'badge-status-extinct',
};

const columnOrder = ['public_key', 'link', 'inserted_date', 'updated_date', 'coords', 'preset', 'params'];
const paramOrder = ['freq', 'bw', 'sf', 'cr'];

const timeAgo = msec => {
	const seconds = Math.floor((Date.now() - msec) / 1000);

	const units = [
		{ key: 'year', limit: 31536000 },
		{ key: 'month', limit: 2592000 },
		{ key: 'day', limit: 86400 },
		{ key: 'hour', limit: 3600 },
		{ key: 'minute', limit: 60 },
		{ key: 'second', limit: 1 },
	];

	for (const unit of units) {
		const count = Math.floor(seconds / unit.limit);

		if (count >= 1) return t('common:timeAgo', { count, unit: plural(count, tRaw(`common:timeUnits.${unit.key}`)) });
	}

	return t('common:justNow');
};

const escapeHtml = html => html.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

const findPreset = params => presets.find(p =>
	params.sf === p.params.sf &&
	params.freq === p.params.freq &&
	params.bw === p.params.bw
) ?? {};

const withCopyButton = (displayHtml, copyValue, btnTitle, textTitle = '') => `
	<span class="copy-cell">
		<span class="copy-cell-text"${textTitle ? ` title="${textTitle}"` : ''}>${displayHtml}</span>
		<button type="button" class="copy-icon-btn" title="${btnTitle}" aria-label="${btnTitle}" data-copy-value="${escapeHtml(copyValue)}">
			<svg class="icon" aria-hidden="true"><use href="/icons/icons.svg#copy"></use></svg>
		</button>
	</span>`;

const columns = {
	coords: {
		label: t('map:columns.coords'),
		value: val => withCopyButton(
			`<a href="https://google.com/maps/place/${val.replace(' ', '')}" class="coords-link" target="_blank" rel="noopener nofollow">${val}</a>`,
			val,
			t('map:copyCoords')
		),
	},
	inserted_date: {
		label: t('map:columns.insertedDate'),
		value: val => {
			const dt = new Date(val);
			return `<time datetime="${val}" title="${ntools.formatDateTime(dt)}">${timeAgo(dt.getTime())}</time>`;
		},
	},
	updated_date: {
		label: t('map:columns.updatedDate'),
		value: val => {
			const dt = new Date(val);
			return `<time datetime="${val}" title="${ntools.formatDateTime(dt)}">${timeAgo(dt.getTime())}</time>`;
		},
	},
	public_key: {
		label: t('map:columns.publicKey'),
		value: val => withCopyButton(
			escapeHtml(ntools.truncateKey(val)),
			val,
			t('map:copyPublicKey'),
			escapeHtml(val)
		),
	},
	preset: {
		label: t('map:columns.preset'),
		value: val => {
			const preset = findPreset(val);
			return preset.params?.freq ? preset.name : t('map:customPreset');
		},
	},
	params: {
		label: t('map:columns.params'),
		value: val => `<span class="param-chips">${paramOrder.filter(key => key in val).map(key => {
			const paramKey = radioParamDesc[key];
			const text = `${paramKey.short}${val[key]}${paramKey.unit}`;
			return `<span class="param-chip" title="${escapeHtml(radioParamLabel(key))}">${escapeHtml(text)}</span>`;
		}).join('')}</span>`,
	},
	link: {
		label: t('map:columns.link'),
		value: uint8arr => `<button type="button" class="copy-link-btn" data-copy-value="meshcore://${uint8ArrayToHex(uint8arr)}">${t('map:copyLinkButton')}</button>`,
	},
};

const svgIconCache = new Map();
const getSvgIcon = (text, color) => {
	const cacheKey = text + '|' + color;
	let icon = svgIconCache.get(cacheKey);
	if (icon) return icon;

	icon = L.divIcon({
		html: `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><ellipse cx="256" cy="256" rx="256" ry="256" fill="${color}"/><text x="256" y="256" dominant-baseline="central" text-anchor="middle" fill="#fff" font-size="150" font-weight="bold" font-family="sans-serif">${text}</text></svg>`,
		className: 'svg-node-icon',
		iconSize: [32, 32],
		iconAnchor: [17, 17],
		popupAnchor: [0, -16],
	});
	svgIconCache.set(cacheKey, icon);
	return icon;
};

const getTable = node => '<table class="node-info"><tbody>' +
	'<tr>' + columnOrder.flatMap(key => node[key] ? [`<td><b>${columns[key].label}</b></td><td>${columns[key].value ? columns[key].value(node[key]) : node[key]}</td>`] : []).join('</tr><tr>') + '</tr>' +
'</tbody></table>';

const getDeletionMailUrl = node => {
	const deletionMailUrl = new URL('mailto:recrof@gmail.com');
	deletionMailUrl.searchParams.append('subject', 'MeshCore Map node deletion request');
	deletionMailUrl.searchParams.append('body', `Please delete my node(s) from MeshCore Map database
MeshCore link(s) or Public key(s):

${node ? node.public_key : ''}

*** IMPORTANT ***
if you have multiple nodes to delete, put them into single email, delimited by newline. public key is enough, you don't need to add name or screenshot of the node.`);

	return deletionMailUrl.toString().replaceAll('+', '%20').replaceAll('\n', '%0A');
};

const discordTimestamp = date => `<t:${Math.floor(date.getTime() / 1000)}:R>`;
const getShareUrl = node => `${location.origin}${location.pathname}?node=${node.public_key}`;

const getNodeInfoText = node => {
	const lines = [`# [${node.adv_name}](${getShareUrl(node)}) (${typeName(node.type)})`, ''];

	lines.push(`- **${t('map:columns.publicKey')}:** \`${node.public_key}\``);
	if (node.status) lines.push(`- **${t('map:infoStatus')}:** ${statusDesc(node.status)}`);
	lines.push(`- **${t('map:columns.insertedDate')}:** ${ntools.formatDateTime(node.insertDate)} (${discordTimestamp(node.insertDate)})`);
	if (node.updatedDate) lines.push(`- **${t('map:columns.updatedDate')}:** ${ntools.formatDateTime(node.updatedDate)} (${discordTimestamp(node.updatedDate)})`);
	lines.push(`- **${t('map:columns.coords')}:** \`${node.coords}\` ([${t('common:mapWord')}](https://google.com/maps/place/${node.coords.replace(' ', '')}))`);

	if (node.params) {
		const preset = findPreset(node.params);
		lines.push(`- **${t('map:columns.preset')}:** ${preset.params?.freq ? preset.name : t('map:customPreset')}`);
		lines.push(`- **${t('settings:title')}:**`);
		for (const key of paramOrder.filter(k => k in node.params)) {
			const paramKey = radioParamDesc[key];
			lines.push(`  - ${radioParamLabel(key)}: ${node.params[key]}${paramKey.unit}`);
		}
	}

	return lines.join('\n');
};

const getNodePopupHTML = node => {
	const userActionUrl = encodeURI(localStorage.getItem('userActionUrl') || '');
	const userActionLabel = localStorage.getItem('userActionLabel') || '';
	const userActionAnchor = userActionUrl ? `<a target="_blank" rel="noopener noreferrer" href="https://${userActionUrl}?nodes=${node.public_key}">${userActionLabel}</a>` : '';
	const contactParams = new URLSearchParams({
		name: node.adv_name,
		public_key: node.public_key,
		type: node.type,
	});
	const qrValue = `meshcore://contact/add?${contactParams.toString()}`;
	const statusClass = statusBadgeClass[node.status] || '';
	const shareUrl = getShareUrl(node);
	const canAddContact = contactAddableTypes.includes(node.type);

	return `
		<div class="node-header">
			<div class="node-qr" data-qr-value="${escapeHtml(qrValue)}"></div>
			<div class="node-header-info">
				<div class="node-title">
					<span class="node-title-text">${escapeHtml(node.adv_name)}</span>
					<button type="button" class="copy-icon-btn" title="${t('map:copyName')}" aria-label="${t('map:copyName')}" data-copy-value="${escapeHtml(node.adv_name)}">
						<svg class="icon" aria-hidden="true"><use href="/icons/icons.svg#copy"></use></svg>
					</button>
				</div>
				<div class="node-badges">
					<span class="badge">${typeName(node.type)}</span>
					${node.status ? `<span class="badge ${statusClass}"><span class="badge-dot"></span>${statusDesc(node.status)}</span>` : ''}
				</div>
			</div>
		</div>
		${getTable(node)}
		<div class="user-actions">
			<div class="user-actions-left">
				<button type="button" class="copy-link-btn" data-copy-value="${escapeHtml(shareUrl)}" title="${escapeHtml(t('map:shareTitle'))}">${t('common:share')}</button>
				<button type="button" class="copy-link-btn" data-copy-value="${escapeHtml(getNodeInfoText(node))}" title="${escapeHtml(t('map:copyInfoTitle'))}">${t('map:copyInfo')}</button>
				${canAddContact ? `<a class="action-link-btn" href="${escapeHtml(qrValue)}" title="${escapeHtml(t('map:addContactTitle'))}" data-meshcore-link>${t('map:addContact')}</a>` : ''}
			</div>
			<div class="user-actions-right">
				<a href="${getDeletionMailUrl(node)}" target="_blank" title="${escapeHtml(t('map:reportDeletionTitle'))}">${t('map:reportDeletion')}</a>
				${userActionAnchor}
			</div>
		</div>`;
};

const getPresets = async signal => {
	if (presets.length) return presets;

	const res = await fetch('https://api.meshcore.nz/api/v1/config', { signal });
	const presetsApi = (await res.json()).config.suggested_radio_settings.entries;

	presets = presetsApi.map(p => ({
		name: p.title,
		desc: p.description,
		params: {
			freq: Number(p.frequency),
			bw: Number(p.bandwidth),
			sf: Number(p.spreading_factor),
			cr: Number(p.coding_rate),
		},
	}));

	presets.unshift({
		name: t('map:allPresetsOption'),
		params: {},
	});

	return presets;
};

const OPENFREEMAP_NAME = 'OpenFreeMap';

const cartoApiKey = window.MAP_CONFIG.cartoApiKey;

const baseMaps = {
	'CartoDB Dark': L.tileLayer(`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`, {
		maxZoom: 20,
		subdomains: 'abcd',
	}),
	'CartoDB Positron': L.tileLayer(`https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`, {
		maxZoom: 20,
		subdomains: 'abcd',
	}),
	'OpenStreetMap': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
	}),
	'Esri Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
		maxZoom: 18,
	}),
	'OpenTopoMap': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
		maxZoom: 17,
		subdomains: 'abc',
	}),
	'CyclOSM': L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
		maxZoom: 20,
		subdomains: 'abc',
	}),
	'Humanitarian OSM': L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
		maxZoom: 20,
		subdomains: 'abc',
	}),
};

const baseMapAttributions = tRaw('map:tilesAttribution');
const baseMapInfo = tRaw('map:baseMapInfo');

const baseMapOrder = ['CartoDB Dark', 'CartoDB Positron', 'OpenStreetMap', 'Esri Satellite', 'OpenTopoMap', 'CyclOSM', 'Humanitarian OSM'];

let showOpenFreeMap = localStorage.getItem('showOpenFreeMap') === '1';
const getBaseMapOrder = () => showOpenFreeMap ? [...baseMapOrder, OPENFREEMAP_NAME] : baseMapOrder;

const storedBaseMap = localStorage.getItem('baseMapSelected');
const baseMapSelected = getBaseMapOrder().includes(storedBaseMap) ? storedBaseMap : baseMapOrder[0];

const urlParams = Object.fromEntries(new URLSearchParams(location.search));
let initialView = window.MAP_CONFIG.defaultView;
if (Number(urlParams.lat) && Number(urlParams.lon) && Number(urlParams.zoom)) {
	initialView = urlParams;
}

const map = window.leafletMap = L.map('map', {
	minZoom: 2,
	maxZoom: 20,
	maxBounds: [
		[-90, -180],
		[90, 200],
	],
	zoomControl: false,
}).setView([initialView.lat, initialView.lon], initialView.zoom);

map.attributionControl.setPrefix(`<a href="https://leafletjs.com" title="${t('map:leafletTitle')}">Leaflet</a>`);
map.attributionControl.setPosition('bottomleft');

map.createPane('highlightPane');
map.getPane('highlightPane').style.zIndex = 620;

const renderQrCode = qrEl => {
	if (!qrEl) return;

	qrEl.innerHTML = '';
	const canvas = document.createElement('canvas');
	qrEl.appendChild(canvas);
	qrToCanvas(canvas, qrEl.dataset.qrValue, {
		width: 256,
		margin: 1,
		color: { dark: '#000', light: '#fff' },
		errorCorrectionLevel: 'M',
	}).catch(err => console.error('Failed to generate QR code:', err));
};

map.on('popupopen', e => {
	requestAnimationFrame(() => {
		const qrEl = e.popup.getElement()?.querySelector('.node-qr');
		if (qrEl?.isConnected) renderQrCode(qrEl);
	});
});

let maplibreLoadPromise = null;
const loadMaplibreGL = () => {
	if (maplibreLoadPromise) return maplibreLoadPromise;

	const stylesheet = document.createElement('link');
	stylesheet.rel = 'stylesheet';
	stylesheet.href = '/vendor/maplibre/maplibre-gl.css';
	document.head.appendChild(stylesheet);

	maplibreLoadPromise = import('/vendor/maplibre/leaflet-maplibre-gl.mjs')
		.catch(err => {
			maplibreLoadPromise = null;
			throw err;
		});

	return maplibreLoadPromise;
};

const getOpenFreeMapLayer = async () => {
	if (!baseMaps[OPENFREEMAP_NAME]) {
		await loadMaplibreGL();
		baseMaps[OPENFREEMAP_NAME] = L.maplibreGL({
			style: 'https://tiles.openfreemap.org/styles/liberty',
			attributionControl: false,
			maxZoom: 20,
		});
	}
	return baseMaps[OPENFREEMAP_NAME];
};

let baseMapRequestId = 0;
let currentBaseMapAttribution = null;
const setBaseMap = async name => {
	const requestId = ++baseMapRequestId;
	const targetLayer = name === OPENFREEMAP_NAME ? await getOpenFreeMapLayer() : baseMaps[name];

	if (requestId !== baseMapRequestId) return;

	for (const layer of Object.values(baseMaps)) {
		if (layer !== targetLayer && map.hasLayer(layer)) map.removeLayer(layer);
	}
	if (!map.hasLayer(targetLayer)) map.addLayer(targetLayer);
	map.setMaxZoom(targetLayer.options.maxZoom);

	if (currentBaseMapAttribution) map.attributionControl.removeAttribution(currentBaseMapAttribution);
	currentBaseMapAttribution = baseMapAttributions[name];
	map.attributionControl.addAttribution(currentBaseMapAttribution);

	localStorage.setItem('baseMapSelected', name);
};

void setBaseMap(baseMapSelected).catch(err => {
	console.error('Failed to set the base map:', err);
	void setBaseMap(baseMapOrder[0]);
});

const nodeTypeIconNames = { 1: 'client', 2: 'repeater', 3: 'room-server', 4: 'sensor' };

const icons = Object.fromEntries(['none', 'recent', 'stale', 'old', 'extinct'].map(color => [color,
	Object.fromEntries([2, 3, 4].map(id => [id, L.divIcon({
		html: `<svg width="32" height="32"><use href="/icons/node-types.svg#${nodeTypeIconNames[id]}"></use></svg>`,
		className: `svg-node-icon update-${color}`,
		iconSize: [32, 32],
		iconAnchor: [17, 17],
		popupAnchor: [0, -16],
	})])),
]));

const highlightIcons = Object.fromEntries(Object.keys(nodeTypeIconNames).map(id => [id, L.divIcon({
	html: `
		<svg width="56" height="56" viewBox="0 0 56 56">
			<circle class="highlight-marker-ping" cx="28" cy="28" r="17"></circle>
			<circle class="highlight-marker-ring" cx="28" cy="28" r="17"></circle>
			<use href="/icons/node-types.svg#${nodeTypeIconNames[id]}" x="12" y="12" width="32" height="32"></use>
		</svg>
	`,
	className: 'svg-node-icon highlight-marker-icon',
	iconSize: [56, 56],
	iconAnchor: [28, 28],
})]));

const langSelect = document.getElementById('lang-select');
langSelect?.addEventListener('change', () => { location.href = langSelect.value; });

const loadingOverlay = document.getElementById('loading-overlay');
const loadingStatus = document.getElementById('loading-status');
const loadingProgressBar = document.getElementById('loading-progress-bar');
const loadingMeta = document.getElementById('loading-meta');
const loadingCancelBtn = document.getElementById('loading-cancel-btn');
const regionWarningOverlay = document.getElementById('region-warning-overlay');
const regionWarningConfirmBtn = document.getElementById('region-warning-confirm');
const regionWarningCancelBtn = document.getElementById('region-warning-cancel');
const regionWarningSizeEl = document.getElementById('region-warning-size');
const contactErrorTextEl = document.getElementById('contact-error-text');
const contactErrorModal = initModal(null, 'contact-error-overlay', { closeOnOutsideClick: true });
const statsCounts = document.getElementById('stats-counts');
const regionToggle = document.getElementById('region-toggle');
const regionToggleLabel = document.getElementById('region-toggle-label');
const basemapToggle = document.getElementById('basemap-toggle');
const basemapMenu = document.getElementById('basemap-menu');
const settingsModal = initModal('settings-toggle', 'settings-overlay');
const closeFiltersOnApplyCheckbox = document.getElementById('setting-close-filters-on-apply');
const showOpenFreeMapCheckbox = document.getElementById('setting-show-openfreemap');
const elevationSourceSelect = document.getElementById('setting-elevation-source');
const legendPanelUi = initLegendPanel();
const searchInline = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const searchResultsEl = document.getElementById('search-results');
const filterToggle = document.getElementById('filter-toggle');
const filterActiveDot = document.getElementById('filter-active-dot');
const filterMenu = document.getElementById('node-filter');
const fromDateInput = document.getElementById('from-date');
const fromInsertDateInput = document.getElementById('from-insert-date');
const clusteringZoomInput = document.getElementById('clustering-zoom');
const freqFilterGroup = document.getElementById('freq-filter-group');
const freqFilterList = document.getElementById('freq-filter-list');
const clearFiltersBtn = document.getElementById('clear-filters-btn');
const applyFiltersBtn = document.getElementById('apply-filters-btn');
const nodeTypeCheckboxes = [...document.querySelectorAll('.node-type-checkbox')];
const legendUpdatedAtEl = document.getElementById('legend-updated-at');
const nodePanelContent = document.getElementById('node-panel-content');
const nodeModalCloseBtn = document.getElementById('node-modal-close');

const vibrate = (duration = 10) => {
	if (navigator.vibrate) navigator.vibrate(duration);
};

document.addEventListener('click', e => {
	if (e.target.closest('button, a, input[type="checkbox"], input[type="radio"], input[type="range"], input[type="date"], #search-results li, #basemap-menu li, #stats-repeater-list li, .modal-overlay')) vibrate();
}, { passive: true });

const storedRegion = localStorage.getItem('regionSelected');

const FILTERS_STORAGE_KEY = 'savedFilters';

const loadSavedFilters = () => {
	try {
		return JSON.parse(localStorage.getItem(FILTERS_STORAGE_KEY)) ?? {};
	} catch {
		return {};
	}
};

const savedFilters = loadSavedFilters();

const state = {
	search: '',
	region: regionToggle && (storedRegion === 'all' || storedRegion === 'pl') ? storedRegion : window.MAP_CONFIG.defaultRegion,
	nodeFilter: savedFilters.nodeFilter ?? ['1', '2', '3', '4'],
	freqFilter: savedFilters.freqFilter ?? [],
	availableFreqs: [],
	hasUnknownFreq: false,
	includeUnknownFreq: savedFilters.includeUnknownFreq ?? true,
	fromDate: savedFilters.fromDate ?? '',
	fromInsertDate: savedFilters.fromInsertDate ?? '',
	clusteringZoom: savedFilters.clusteringZoom ?? 11,
	nodes: [],
	nodesByType: {},
	filteredNodes: [],
};

const saveFiltersToStorage = () => {
	localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({
		nodeFilter: state.nodeFilter,
		freqFilter: state.freqFilter,
		includeUnknownFreq: state.includeUnknownFreq,
		fromDate: state.fromDate,
		fromInsertDate: state.fromInsertDate,
		clusteringZoom: state.clusteringZoom,
	}));
};

nodeTypeCheckboxes.forEach(cb => { cb.checked = state.nodeFilter.includes(cb.value); });
fromDateInput.value = state.fromDate;
fromInsertDateInput.value = state.fromInsertDate;
clusteringZoomInput.value = state.clusteringZoom;

let highlightLayer = null;
let highlightToast = null;

const clearHighlight = () => {
	if (highlightLayer) {
		map.removeLayer(highlightLayer);
		highlightLayer = null;
	}
};

const showNodesHighlight = nodes => {
	clearHighlight();
	if (highlightToast) dismissToast(highlightToast);

	if (!nodes.length) {
		showToast(t('map:noNodesInPeriod'), { status: 'info' });
		return;
	}

	highlightLayer = L.featureGroup(nodes.map(node =>
		L.marker(node.marker.getLatLng(), { icon: highlightIcons[node.type], pane: 'highlightPane' })
			.bindTooltip(escapeHtml(node.adv_name)))).addTo(map);

	map.fitBounds(highlightLayer.getBounds(), { padding: [60, 60], maxZoom: 15 });

	const message = t('map:highlightedNodes', { count: nodes.length, unit: plural(nodes.length, tRaw('map:newNodeUnit')) });
	highlightToast = showActionToast(message, { status: 'info', onClose: clearHighlight });
};

let activePicker = null;
const setPicker = handlers => {
	activePicker = handlers;
	return () => { if (activePicker === handlers) activePicker = null; };
};

const statsModal = initStatsModal({
	getNodes: () => state.nodes,
	getRepeaters: () => state.nodesByType[2] || [],
	escapeHtml,
	timeAgo,
	onFocusNode: node => showNode(node),
	onShowOnMap: nodes => showNodesHighlight(nodes),
});

const changelogModal = initChangelogModal({ escapeHtml, onDismiss: () => legendPanelUi.open() });
const measureTool = initMeasureTool({ map, setPicker, escapeHtml, getNodes: () => state.nodes, showToast });
const routeTool = initRouteTool({ map, getNodes: () => state.nodes, escapeHtml });
let elevationSource = localStorage.getItem('elevationSource') || 'sefinek';
const terrainTool = initTerrainTool({ map, setPicker, getNodes: () => state.nodes, showToast, getElevationSource: () => elevationSource });

const closableTools = [settingsModal, legendPanelUi, statsModal, changelogModal, measureTool, routeTool, terrainTool];
for (const a of closableTools) {
	for (const b of closableTools) {
		if (a !== b) a.toggle.addEventListener('click', () => b.close());
	}
}

document.getElementById('settings-close-btn').addEventListener('click', () => settingsModal.close());
document.getElementById('legend-close-btn').addEventListener('click', () => legendPanelUi.close());
document.getElementById('stats-close-btn').addEventListener('click', () => statsModal.close());
document.getElementById('changelog-close-btn').addEventListener('click', () => changelogModal.dismiss());
document.getElementById('contact-error-close-btn').addEventListener('click', () => contactErrorModal.close());

const markerToNode = new WeakMap();

let markerClusterGroup = L.markerClusterGroup({
	disableClusteringAtZoom: state.clusteringZoom,
	chunkedLoading: true,
});

const MOBILE_NODE_VIEW_BREAKPOINT = 700;
const isMobileNodeView = () => window.innerWidth <= MOBILE_NODE_VIEW_BREAKPOINT;

const ensurePopup = marker => {
	if (marker._popupBound) return;

	const node = markerToNode.get(marker);
	if (node) {
		marker.bindPopup(L.popup({ minWidth: 430, maxWidth: 430, content: () => getNodePopupHTML(node) }));
		marker._popupBound = true;
	}
};

const nodeModal = initModal(null, 'node-overlay');
nodeModalCloseBtn.addEventListener('click', () => nodeModal.close());

const showNodeModal = node => {
	nodePanelContent.innerHTML = getNodePopupHTML(node);
	nodeModal.open();
	renderQrCode(nodePanelContent.querySelector('.node-qr'));
};

const showNodeDetail = node => {
	if (isMobileNodeView()) {
		showNodeModal(node);
	}
	else {
		ensurePopup(node.marker);
		node.marker.openPopup();
	}
};

const attachClusterClickHandler = group => {
	group.on('click', e => {
		const node = markerToNode.get(e.layer);
		if (!node) return;

		vibrate();
		if (activePicker?.onNode) activePicker.onNode(node);
		else showNodeDetail(node);
	});
};

attachClusterClickHandler(markerClusterGroup);

map.on('click', e => {
	if (activePicker?.onMap) activePicker.onMap(e.latlng);
});

const LOADING_PHASES = {
	connect: { from: 0, to: 5 },
	download: { from: 5, to: 55 },
	unpack: { from: 55, to: 60 },
	process: { from: 60, to: 90 },
	presets: { from: 90, to: 100 },
};

const setLoading = loading => {
	loadingOverlay.hidden = !loading;
	if (loading) {
		loadingStatus.textContent = '';
		loadingProgressBar.style.width = '0%';
		loadingMeta.textContent = '';
	}
};

const setLoadingStatus = text => {
	loadingStatus.textContent = text;
};

const setLoadingProgress = (phase, fraction = 1) => {
	const { from, to } = LOADING_PHASES[phase];
	const pct = from + (to - from) * Math.min(1, Math.max(0, fraction));
	loadingProgressBar.style.width = `${pct}%`;
};

const renderDownloadMeta = (receivedBytes, totalBytes, elapsedSec) => {
	const sizeText = totalBytes ? `${ntools.formatBytes(receivedBytes)} / ${ntools.formatBytes(totalBytes)}` : ntools.formatBytes(receivedBytes);
	const speed = elapsedSec > 0 ? receivedBytes / elapsedSec : 0;
	loadingMeta.textContent = `${sizeText} · ${ntools.formatBytes(speed)}/s`;
};

const positionDropdown = (el, anchor = searchInline, { fullWidthOnMobile = true } = {}) => {
	const rect = anchor.getBoundingClientRect();
	el.style.top = `${rect.bottom + 10}px`;

	if (fullWidthOnMobile && window.innerWidth <= 800) {
		el.style.left = '14px';
		el.style.right = '14px';
		el.style.width = 'auto';
	}
	else {
		el.style.left = 'auto';
		el.style.width = '';

		const idealRight = window.innerWidth - rect.right;
		const maxRight = window.innerWidth - el.offsetWidth - 14;
		el.style.right = `${Math.min(idealRight, maxRight)}px`;
	}
};

const refreshMap = ({ clusteringZoom = 0 } = {}) => {
	markerClusterGroup.clearLayers();
	const nodes = state.filteredNodes;

	map.removeLayer(markerClusterGroup);

	if (clusteringZoom) {
		markerClusterGroup = L.markerClusterGroup({
			disableClusteringAtZoom: clusteringZoom,
			chunkedLoading: true,
		});
		attachClusterClickHandler(markerClusterGroup);
	}

	const markers = new Array(nodes.length);
	for (let i = 0; i < nodes.length; i++) {
		markers[i] = nodes[i].marker;
	}
	markerClusterGroup.addLayers(markers);

	map.addLayer(markerClusterGroup);
};

function showNode(node) {
	const zoom = 19;
	const targetLatLng = node.marker.getLatLng();

	if (isMobileNodeView()) {
		map.setView(targetLatLng, zoom, { animate: false });
	}
	else {
		const targetPoint = map.project(targetLatLng, zoom).subtract([0, 140]);
		map.setView(map.unproject(targetPoint, zoom), zoom, { animate: false });
	}

	showNodeDetail(node);
	state.search = '';
	searchInput.value = '';
	renderSearchResults();
}

const highlightString = (source, toHighlight) => {
	const escapedSource = escapeHtml(source);
	const matchIndex = source.toLowerCase().indexOf(toHighlight.toLowerCase());
	const highlight = matchIndex >= 0 ? source.substring(matchIndex, matchIndex + toHighlight.length) : toHighlight;
	return escapedSource.replace(escapeHtml(highlight), `<b>${escapeHtml(highlight)}</b>`);
};

const syncUrlParams = () => {
	const params = {
		lat: map.getCenter().lat.toFixed(4),
		lon: map.getCenter().lng.toFixed(4),
		zoom: map.getZoom(),
	};

	history.replaceState({}, '', `${location.pathname}?${new URLSearchParams(params)}`);
};

const updateRegionToggleUI = () => {
	if (!regionToggle) return;

	const showingAll = state.region === 'all';
	regionToggle.classList.toggle('active', showingAll);
	const regionToggleTitle = showingAll ? t('map:showPolandOnly') : t('map:showAllWorld');
	regionToggle.title = regionToggleTitle;
	regionToggle.setAttribute('aria-label', regionToggleTitle);
	regionToggleLabel.textContent = showingAll ? t('map:allNodesLabel') : t('map:polandOnlyLabel');
};

const updateFiltersActiveUI = () => {
	const active = state.nodes.length !== state.filteredNodes.length;
	filterToggle.classList.toggle('active', active);
	filterActiveDot.hidden = !active;
	clearFiltersBtn.hidden = !active;
};

const renderStats = () => {
	if (!state.nodes.length) {
		statsCounts.innerHTML = '';
		return;
	}

	const nodes = state.filteredNodes;
	let clients = 0, repeaters = 0, roomServers = 0;
	for (const node of nodes) {
		if (node.type === 1) clients++;
		else if (node.type === 2) repeaters++;
		else if (node.type === 3) roomServers++;
	}

	statsCounts.innerHTML = `
		<span class="pointer-help" title="${t('map:totalCountTooltip')}"><span class="stats-total-label">${t('map:totalLabel')}</span><b>${nodes.length}</b></span>&nbsp;|
		<svg class="icon pointer-help"><title>${t('map:clientsCountTooltip')}</title><use href="/icons/icons.svg#user"></use></svg><b>${clients}</b>&nbsp;|
		<svg class="icon icon-filled pointer-help"><title>${t('map:repeatersCountTooltip')}</title><use href="/icons/node-types.svg#repeater-plain"></use></svg><b>${repeaters}</b>&nbsp;|
		<svg class="icon icon-filled pointer-help"><title>${t('map:roomServersCountTooltip')}</title><use href="/icons/node-types.svg#room-server-plain"></use></svg><b>${roomServers}</b>`;

	statsModal.render();
};

let searchResults = [];
let searchActiveIndex = 0;

const setSearchActiveIndex = index => {
	if (!searchResults.length) return;
	searchActiveIndex = Math.max(0, Math.min(index, searchResults.length - 1));
	[...searchResultsEl.children].forEach((li, i) => li.classList.toggle('active', i === searchActiveIndex));
	searchResultsEl.children[searchActiveIndex]?.scrollIntoView({ block: 'nearest' });
};

function renderSearchResults() {
	if (!state.search) {
		searchResultsEl.hidden = true;
		searchResultsEl.innerHTML = '';
		searchResults = [];
		return;
	}

	const nodes = state.filteredNodes;
	searchResults = nodes.filter(
		node => node.adv_name.toLowerCase().includes(state.search.toLowerCase()) || node.public_key.startsWith(state.search)
	).toSorted(
		(a, b) => a.adv_name.localeCompare(b.adv_name)
	).slice(0, 20);

	searchResultsEl.hidden = searchResults.length === 0;
	if (!searchResultsEl.hidden) positionDropdown(searchResultsEl);
	searchResultsEl.innerHTML = searchResults.map(node => `
		<li>
			<svg width="22" height="22"><use href="/icons/node-types.svg#${nodeTypeIconNames[node.type]}-plain"></use></svg>
			<div class="search-text">
				<h6>${highlightString(node.adv_name, state.search)}</h6>
				<div class="search-pkey">${highlightString(ntools.truncateKey(node.public_key), state.search)}</div>
			</div>
		</li>
	`).join('');

	[...searchResultsEl.children].forEach((li, index) => {
		li.addEventListener('click', () => showNode(searchResults[index]));
		li.addEventListener('mouseenter', () => setSearchActiveIndex(index));
	});

	setSearchActiveIndex(0);
}

const runFilterPass = () => {
	const fromDate = new Date(state.fromDate);
	const fromInsertDate = new Date(state.fromInsertDate);
	const byType = state.nodesByType;
	const freqSet = new Set(state.freqFilter.length ? state.freqFilter : state.availableFreqs);

	const result = [];
	for (const type of state.nodeFilter) {
		const typeNodes = byType[type];
		if (!typeNodes) continue;

		for (let i = 0; i < typeNodes.length; i++) {
			const node = typeNodes[i];
			if (node.updatedDate ? node.updatedDate <= fromDate : node.insertDate <= fromDate) continue;
			if (node.insertDate <= fromInsertDate) continue;
			if (node.params?.freq ? !freqSet.has(Math.floor(node.params.freq)) : !state.includeUnknownFreq) continue;
			result.push(node);
		}
	}

	state.filteredNodes = result;
	refreshMap();
	syncUrlParams();
	updateFiltersActiveUI();
	renderSearchResults();
	renderStats();
	saveFiltersToStorage();
};

let filterToast = null;

const applyFilters = ({ silent = false } = {}) => {
	if (silent) {
		runFilterPass();
		return;
	}

	filterToast = filterToast?.isConnected
		? updateToast(filterToast, t('filters:updating'), { duration: 0, status: 'loading' })
		: showToast(t('filters:updating'), { duration: 0, status: 'loading' });

	requestAnimationFrame(() => requestAnimationFrame(() => {
		try {
			runFilterPass();
			updateToast(filterToast, t('filters:updated'), { duration: 1000, status: 'success' });
		} catch (err) {
			console.error('Failed to update data:', err);
			updateToast(filterToast, t('filters:updateFailed'), { status: 'error' });
		}
	}));
};

const onFreqFilterChange = () => {
	state.freqFilter = [...freqFilterList.querySelectorAll('.freq-checkbox:checked')].map(cb => Number(cb.value));
	state.includeUnknownFreq = freqFilterList.querySelector('.freq-unknown-checkbox')?.checked ?? true;
};

const renderFreqFilters = () => {
	const checkedFreqs = state.freqFilter.length ? state.freqFilter : state.availableFreqs;

	freqFilterGroup.hidden = state.availableFreqs.length === 0 && !state.hasUnknownFreq;

	const unknownCheckboxHtml = state.hasUnknownFreq ? `
		<label class="checkbox-label">
			<input type="checkbox" class="freq-unknown-checkbox" ${state.includeUnknownFreq ? 'checked' : ''}>
			${t('filters:unknownFreq')}
		</label>
	` : '';

	freqFilterList.innerHTML = state.availableFreqs.map(freq => `
		<label class="checkbox-label">
			<input type="checkbox" class="freq-checkbox" value="${freq}" ${checkedFreqs.includes(freq) ? 'checked' : ''}>
			${freq} MHz
		</label>
	`).join('') + unknownCheckboxHtml;

	freqFilterList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
		checkbox.addEventListener('change', onFreqFilterChange);
	});
};

const clearFilters = () => {
	state.nodeFilter = ['1', '2', '3', '4'];
	state.freqFilter = [];
	state.includeUnknownFreq = true;
	state.fromDate = '2025-03-01';
	state.fromInsertDate = '2025-03-01';
	state.clusteringZoom = 11;

	nodeTypeCheckboxes.forEach(cb => { cb.checked = true; });
	fromDateInput.value = state.fromDate;
	fromInsertDateInput.value = state.fromInsertDate;
	clusteringZoomInput.value = state.clusteringZoom;
	renderFreqFilters();

	applyFilters();
};

const getDaysEpochMsec = days => days * 24 * 60 * 60 * 1000;

const inflateNode = node => {
	for (const key of Object.keys(node)) {
		if (!nodeKeys[key]) continue;
		const convertFn = nodeKeys[key].convert;
		node[nodeKeys[key].key] = typeof convertFn === 'function' ? convertFn(node[key]) : node[key];

		delete node[key];
	}
};

const nodesCache = {};
let currentDownloadAbort = null;

const renderLegendUpdatedAt = dataUpdatedAt => {
	legendUpdatedAtEl.textContent = dataUpdatedAt ? ntools.formatTime(new Date(dataUpdatedAt)) : '-';
};

const applyDownloadedNodes = cached => {
	state.nodesByType = cached.byType;
	state.nodes = cached.nodes;
	state.availableFreqs = cached.availableFreqs;
	state.hasUnknownFreq = cached.hasUnknownFreq;
	renderFreqFilters();
	renderLegendUpdatedAt(cached.dataUpdatedAt);
};

const downloadNodes = async region => {
	currentDownloadAbort?.abort();

	if (nodesCache[region]) {
		applyDownloadedNodes(nodesCache[region]);
		return;
	}

	const now = Date.now();
	const extinctThreshold = now - getDaysEpochMsec(20);
	const oldThreshold = now - getDaysEpochMsec(10);
	const staleThreshold = now - getDaysEpochMsec(5);

	const getNodeUpdateStatus = node => {
		if (node.source[0] !== 'u') return 'none';
		const updateEpoch = new Date(node.updated_date).getTime();
		if (updateEpoch < extinctThreshold) return 'extinct';
		if (updateEpoch < oldThreshold) return 'old';
		if (updateEpoch < staleThreshold) return 'stale';
		return 'recent';
	};

	const abortController = new AbortController();
	currentDownloadAbort = abortController;

	try {
		setLoading(true);

		setLoadingStatus(t('map:connecting'));
		const nodesReq = await fetch(apiUrl(region), { signal: abortController.signal });

		if (!nodesReq.ok) {
			let message = t('map:serverError', { status: nodesReq.status });
			try {
				const body = await nodesReq.json();
				if (body?.message) message = body.message;
			} catch { /* response body wasn't JSON, keep the generic message */ }

			const apiErr = new Error(message);
			apiErr.isApiError = true;
			throw apiErr;
		}

		const dataUpdatedAt = nodesReq.headers.get('X-Data-Updated');
		const totalBytes = Number(nodesReq.headers.get('Content-Length')) || 0;
		setLoadingProgress('connect');

		setLoadingStatus(t('map:downloading'));
		const reader = nodesReq.body.getReader();
		const chunks = [];
		let receivedBytes = 0;
		const startTime = performance.now();

		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;

			chunks.push(value);
			receivedBytes += value.length;
			setLoadingProgress('download', totalBytes ? receivedBytes / totalBytes : 0);
			renderDownloadMeta(receivedBytes, totalBytes, (performance.now() - startTime) / 1000);
		}

		setLoadingProgress('download');
		loadingMeta.textContent = `${ntools.formatBytes(receivedBytes)} / ${ntools.formatBytes(totalBytes)} · ${t('map:downloadComplete')}`;

		const nodesBuffer = new Uint8Array(receivedBytes);
		let writeOffset = 0;
		for (const chunk of chunks) {
			nodesBuffer.set(chunk, writeOffset);
			writeOffset += chunk.length;
		}

		setLoadingStatus(t('map:unpacking'));
		const nodes = unpack(nodesBuffer);
		setLoadingProgress('unpack');

		const presetsPromise = getPresets(abortController.signal);

		const byType = {};
		const freqSet = new Set();
		let hasUnknownFreq = false;
		const CHUNK_SIZE = 2000;

		for (let offset = 0; offset < nodes.length; offset += CHUNK_SIZE) {
			const end = Math.min(offset + CHUNK_SIZE, nodes.length);

			if (abortController.signal.aborted) throw new DOMException('Cancelled by user', 'AbortError');

			setLoadingStatus(t('map:processingNodes', { end, total: nodes.length }));
			setLoadingProgress('process', end / nodes.length);
			if (offset > 0) await new Promise(r => setTimeout(r, 0));

			for (let i = offset; i < end; i++) {
				const node = nodes[i];
				inflateNode(node);
				const updateStatus = getNodeUpdateStatus(node);

				let icon = icons[updateStatus][node.type.toString()];

				(byType[node.type] ??= []).push(node);

				if (node.type === 1) {
					const label = ntools.getNameIconLabel(node.adv_name);
					const color = ntools.getColourForName(node.adv_name);
					icon = getSvgIcon(label, color);
				}

				const marker = node.marker = L.marker([node.lat, node.lon], { icon, title: node.adv_name });

				node.status = updateStatus;
				node.preset = node.params;
				node.coords = `${node.lat.toFixed(6)}, ${node.lon.toFixed(6)}`;
				node.lastAdvertDate = new Date(node.last_advert);
				node.insertDate = new Date(node.inserted_date);
				node.updatedDate = node.updated_date && new Date(node.updated_date);
				markerToNode.set(marker, node);

				if (node.params?.freq) freqSet.add(Math.floor(node.params.freq));
				else hasUnknownFreq = true;
			}
		}

		if (abortController.signal.aborted) throw new DOMException('Cancelled by user', 'AbortError');

		setLoadingStatus(t('map:fetchingPresets'));
		setLoadingProgress('presets', 0);
		try {
			await presetsPromise;
		} catch (err) {
			if (err.name === 'AbortError') throw err;
			console.error('Failed to fetch radio presets:', err);
		}
		setLoadingProgress('presets');

		setLoadingStatus(t('map:ready'));

		nodesCache[region] = { nodes, byType, availableFreqs: [...freqSet].sort((a, b) => a - b), hasUnknownFreq, dataUpdatedAt };
		applyDownloadedNodes(nodesCache[region]);
	} catch (err) {
		if (err.name !== 'AbortError') {
			const message = err.isApiError ? err.message : t('map:unexpectedLoadError');
			showToast(message, { status: 'error', duration: 6000 });
			console.error(err);
		}
	} finally {
		if (currentDownloadAbort === abortController) {
			currentDownloadAbort = null;
			setLoading(false);
		}
	}
};

const setRegion = async region => {
	if (region === state.region) return;

	const cached = Boolean(nodesCache[region]);
	state.region = region;
	localStorage.setItem('regionSelected', region);
	updateRegionToggleUI();
	await downloadNodes(region);
	applyFilters({ silent: !cached });
};

searchInline.addEventListener('submit', e => e.preventDefault());

searchInput.addEventListener('focus', () => {
	if (localStorage.getItem('shiftSearchHintShown')) return;
	localStorage.setItem('shiftSearchHintShown', '1');
	showToast(t('map:shiftSearchHint'), { duration: 4000, status: 'info' });
}, { once: true });

searchInput.addEventListener('input', () => {
	state.search = searchInput.value;
	renderSearchResults();
});

searchInput.addEventListener('keydown', e => {
	if (e.key === 'Escape') {
		searchResultsEl.hidden = true;
		searchInput.blur();
		return;
	}

	if (searchResultsEl.hidden || !searchResults.length) return;

	if (e.key === 'ArrowDown') {
		e.preventDefault();
		setSearchActiveIndex(searchActiveIndex + 1);
	} else if (e.key === 'ArrowUp') {
		e.preventDefault();
		setSearchActiveIndex(searchActiveIndex - 1);
	} else if (e.key === 'Enter') {
		e.preventDefault();
		showNode(searchResults[searchActiveIndex]);
	}
});

document.addEventListener('keydown', e => {
	if (e.key !== 'Shift') return;

	const active = document.activeElement;
	const isTyping = active && (['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) || active.isContentEditable);
	if (isTyping) return;

	searchInput.focus();
});

filterToggle.addEventListener('click', () => {
	const willShow = filterMenu.hidden;
	filterMenu.hidden = !filterMenu.hidden;
	if (willShow) positionDropdown(filterMenu);
});

nodeTypeCheckboxes.forEach(checkbox => {
	checkbox.addEventListener('change', () => {
		state.nodeFilter = nodeTypeCheckboxes.filter(cb => cb.checked).map(cb => cb.value);
	});
});

fromDateInput.addEventListener('change', () => {
	state.fromDate = fromDateInput.value;
});

fromInsertDateInput.addEventListener('change', () => {
	state.fromInsertDate = fromInsertDateInput.value;
});

clusteringZoomInput.addEventListener('input', () => {
	state.clusteringZoom = Number(clusteringZoomInput.value);
	refreshMap({ clusteringZoom: state.clusteringZoom });
	syncUrlParams();
});

clusteringZoomInput.addEventListener('change', saveFiltersToStorage);

closeFiltersOnApplyCheckbox.checked = localStorage.getItem('closeFiltersOnApply') !== '0';

closeFiltersOnApplyCheckbox.addEventListener('change', () => {
	localStorage.setItem('closeFiltersOnApply', closeFiltersOnApplyCheckbox.checked ? '1' : '0');
});

showOpenFreeMapCheckbox.checked = showOpenFreeMap;

elevationSourceSelect.value = elevationSource;

elevationSourceSelect.addEventListener('change', () => {
	elevationSource = elevationSourceSelect.value;
	localStorage.setItem('elevationSource', elevationSource);
});

applyFiltersBtn.addEventListener('click', () => {
	applyFilters();
	if (closeFiltersOnApplyCheckbox.checked) filterMenu.hidden = true;
});

clearFiltersBtn.addEventListener('click', clearFilters);

loadingCancelBtn.addEventListener('click', () => currentDownloadAbort?.abort());

const confirmRegionWarning = () => new Promise(resolve => {
	function cleanup(confirmed) {
		regionWarningOverlay.hidden = true;
		regionWarningConfirmBtn.removeEventListener('click', onConfirm);
		regionWarningCancelBtn.removeEventListener('click', onCancel);
		regionWarningOverlay.removeEventListener('click', onOverlayClick);
		document.removeEventListener('keydown', onKeydown);
		resolve(confirmed);
	}

	function onConfirm() { cleanup(true); }
	function onCancel() { cleanup(false); }
	function onOverlayClick(e) { if (e.target === regionWarningOverlay) cleanup(false); }
	function onKeydown(e) { if (e.key === 'Escape') cleanup(false); }

	regionWarningConfirmBtn.addEventListener('click', onConfirm);
	regionWarningCancelBtn.addEventListener('click', onCancel);
	regionWarningOverlay.addEventListener('click', onOverlayClick);
	document.addEventListener('keydown', onKeydown);

	regionWarningOverlay.hidden = false;
	regionWarningCancelBtn.focus();
});

const getRegionDataSize = async region => {
	try {
		const res = await fetch(apiUrl(region), { method: 'HEAD' });
		return Number(res.headers.get('Content-Length')) || 0;
	} catch {
		return 0;
	}
};

regionToggle?.addEventListener('click', async () => {
	const targetRegion = state.region === 'all' ? 'pl' : 'all';

	if (targetRegion === 'all' && !nodesCache.all && !localStorage.getItem('regionWarningAcknowledged')) {
		const size = await getRegionDataSize('all');
		regionWarningSizeEl.textContent = size ? t('map:aboutSize', { size: ntools.formatBytes(size) }) : t('map:unknownSize');

		const confirmed = await confirmRegionWarning();
		if (!confirmed) return;

		localStorage.setItem('regionWarningAcknowledged', '1');
	}

	void setRegion(targetRegion);
});

let currentBaseMap = baseMapSelected;

const renderBaseMapToggle = () => {
	basemapToggle.classList.toggle('active', currentBaseMap !== baseMapOrder[0]);
	[...basemapMenu.children].forEach(li => li.classList.toggle('active', li.dataset.basemap === currentBaseMap));
};

const renderBasemapMenu = () => {
	basemapMenu.innerHTML = getBaseMapOrder().map(name => `<li data-basemap="${name}" title="${baseMapInfo[name]}">${name}</li>`).join('');
};

renderBasemapMenu();
renderBaseMapToggle();

showOpenFreeMapCheckbox.addEventListener('change', () => {
	showOpenFreeMap = showOpenFreeMapCheckbox.checked;
	localStorage.setItem('showOpenFreeMap', showOpenFreeMap ? '1' : '0');
	renderBasemapMenu();
	renderBaseMapToggle();
});

basemapMenu.addEventListener('click', e => {
	const li = e.target.closest('li');
	if (!li) return;

	currentBaseMap = li.dataset.basemap;
	renderBaseMapToggle();
	basemapMenu.hidden = true;

	const loadingToast = currentBaseMap === OPENFREEMAP_NAME && !baseMaps[OPENFREEMAP_NAME]
		? showToast(t('map:loadingBasemap'), { duration: 0, status: 'loading' })
		: null;

	setBaseMap(currentBaseMap)
		.then(() => {
			if (loadingToast) updateToast(loadingToast, t('map:basemapLoaded'), { duration: 1000, status: 'success' });
		})
		.catch(err => {
			console.error('Failed to set the base map:', err);
			if (loadingToast) updateToast(loadingToast, t('map:basemapLoadFailed'), { status: 'error' });
			else showToast(t('map:basemapLoadFailed'), { status: 'error' });
		});
});

basemapToggle.addEventListener('click', () => {
	const willShow = basemapMenu.hidden;
	basemapMenu.hidden = !basemapMenu.hidden;
	if (willShow) positionDropdown(basemapMenu, basemapToggle, { fullWidthOnMobile: false });
});

document.addEventListener('click', e => {
	const copyBtn = e.target.closest('.copy-link-btn, .copy-icon-btn');
	if (copyBtn) void navigator.clipboard.writeText(copyBtn.dataset.copyValue).then(() => showToast(t('common:copiedToClipboard')));
});

const showContactError = detail => {
	contactErrorTextEl.textContent = detail ? `${t('map:addContactErrorText')} (${detail})` : t('map:addContactErrorText');
	contactErrorModal.open();
};

document.addEventListener('click', e => {
	const link = e.target.closest('a[data-meshcore-link]');
	if (!link) return;

	e.preventDefault();

	try {
		window.location.href = link.href;
	} catch (err) {
		showContactError(err.message);
		return;
	}

	const launchingToast = showToast(t('map:addContactLaunching'), { duration: 0, status: 'loading' });

	let left = false;
	const timer = setTimeout(() => {
		cleanup();
		dismissToast(launchingToast);
		if (!left) showContactError();
	}, 1000);

	function cleanup() {
		clearTimeout(timer);
		window.removeEventListener('blur', onLeave);
		document.removeEventListener('visibilitychange', onLeave);
	}

	function onLeave() {
		left = true;
		cleanup();
		dismissToast(launchingToast);
	}

	window.addEventListener('blur', onLeave);
	document.addEventListener('visibilitychange', onLeave);
});

document.addEventListener('click', e => {
	if (!filterMenu.hidden && !filterMenu.contains(e.target) && !filterToggle.contains(e.target)) filterMenu.hidden = true;
	if (!searchResultsEl.hidden && !searchResultsEl.contains(e.target) && !searchInline.contains(e.target)) searchResultsEl.hidden = true;
	if (!basemapMenu.hidden && !basemapMenu.contains(e.target) && !basemapToggle.contains(e.target)) basemapMenu.hidden = true;
});

window.addEventListener('resize', () => {
	if (!filterMenu.hidden) positionDropdown(filterMenu);
	if (!searchResultsEl.hidden) positionDropdown(searchResultsEl);
	if (!basemapMenu.hidden) positionDropdown(basemapMenu, basemapToggle, { fullWidthOnMobile: false });
});

map.on('moveend', syncUrlParams);

updateRegionToggleUI();

downloadNodes(state.region).then(() => {
	applyFilters({ silent: true });

	if (urlParams.node) {
		const node = state.nodes.find(n => n.public_key === urlParams.node);
		if (node) showNode(node);
	}

	if (urlParams.measure) {
		const coordPairs = urlParams.measure.split(';').map(pair => {
			const [lat, lng] = pair.split(',').map(Number);
			return { lat, lng };
		}).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));

		if (coordPairs.length) measureTool.loadFromUrlPoints(coordPairs);
	}

	if (urlParams.terrain) {
		const [rawA, rawB] = urlParams.terrain.split(';');
		const [latA, lngA, heightA] = (rawA || '').split(',').map(Number);
		const [latB, lngB, heightB] = (rawB || '').split(',').map(Number);

		if (Number.isFinite(latA) && Number.isFinite(lngA) && Number.isFinite(latB) && Number.isFinite(lngB)) {
			terrainTool.loadFromUrlState({ lat: latA, lng: lngA }, { lat: latB, lng: lngB }, heightA, heightB);
		}
	}
});

window.refreshMap = refreshMap;
