/* global L */
import { unpack } from '../vendor/msgpackr/msgpackr.js';
import { toCanvas as qrToCanvas } from '../vendor/qrcode/qrcode.js';
import * as ntools from './node-utils.js';
import { collectFilteredNodes as collectFilteredNodesCore, createNodeIndex, countByType, createStatusThresholds, indexNode, prepareNode, searchNodes } from '/core/nodes.js';
import { t, tRaw, plural } from './i18n.js';
import { initApiKeySettings } from './api-keys.js';
import { initModal } from './modal.js';
import { initAppBanner } from './app-banner.js';
import { initDataSettings } from './settings-data.js';
import { initSettingsTabs } from './settings-tabs.js';
import { initMapLanguageSetting, readFlag, readSavedView, saveView, writeFlag } from './preferences.js';
import { initNodeDeletionDialog } from './node-deletion.js';
import { initTesterSignup } from './tester-signup.js';
import { initRadioFilters } from './radio-filters.js';
import { NODE_TYPE_ICON_NAMES } from '/core/colors.js';
import { loadRadioFilters } from '/core/radio-filter-utils.js';
import { buildFilterParams, parseSharedFilters } from '/core/filter-share.js';
import { initLegendPanel } from './legend.js';
import { initStatsModal } from './stats.js';
import { initChangelogModal } from './changelog.js';
import { initMeasureTool } from './measure.js';
import { initRouteTool } from './route.js';
import { initTerrainTool } from './terrain.js';
import { initCoverageTool } from './coverage.js';
import { getNodePopupHTML, getShareUrl, timeAgo } from './node-popup.js';
import { getPresets } from './radio-presets.js';
import { escapeHtml } from './pathtools.js';
import { initBasemapManager } from './basemap-manager.js';
import { showToast, updateToast, showActionToast, dismissToast } from './toast.js';
import { COPY_FEEDBACK_MS } from '/core/toast.js';

const apiUrl = region => `/api/v1/nodes?region=${region}`;

const svgIconCache = new Map();
const getSvgIcon = (text, color) => {
	const cacheKey = text + '|' + color;
	let icon = svgIconCache.get(cacheKey);
	if (icon) return icon;

	icon = L.divIcon({
		html: ntools.clientIconSvg(text, color),
		className: 'svg-node-icon',
		iconSize: [32, 32],
		iconAnchor: [17, 17],
		popupAnchor: [0, -16],
	});
	svgIconCache.set(cacheKey, icon);
	return icon;
};



const urlParams = Object.fromEntries(new URLSearchParams(location.search));
let initialView = window.MAP_CONFIG.defaultView;
let rememberView = readFlag('rememberView', false);
if (Number(urlParams.lat) && Number(urlParams.lon) && Number(urlParams.zoom)) {
	initialView = urlParams;
} else if (rememberView) {
	// A link with a position wins; otherwise the map returns to where it was left.
	initialView = readSavedView() ?? initialView;
}

const map = window.leafletMap = L.map('map', {
	minZoom: 2,
	maxZoom: 20,
	zoomSnap: 0.25,
	maxBounds: [
		[-90, -180],
		[90, 200],
	],
	zoomControl: false,
}).setView([initialView.lat, initialView.lon], initialView.zoom);

map.attributionControl.setPrefix(false);
map.attributionControl.setPosition('bottomleft');
L.DomEvent.disableScrollPropagation(map.attributionControl.getContainer());

// Popups live outside the map pane (which is its own stacking context) so they can sit above the fixed stats bar; the pane mirrors the map pane's offset
const popupPane = map.createPane('nodePopupPane', map.getContainer());
popupPane.style.zIndex = 1001;
const syncPopupPane = () => L.DomUtil.setPosition(popupPane, L.DomUtil.getPosition(map.getPane('mapPane')));
map.on('move viewreset zoom', syncPopupPane);
map.on('zoomanim', () => popupPane.classList.add('leaflet-zoom-anim'));
map.on('zoomend', () => popupPane.classList.remove('leaflet-zoom-anim'));

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

const statsBar = document.getElementById('stats-bar');
const POPUP_VIEW_PADDING = 10;

// Leaflet's autoPan runs once on open and ignores the fixed stats bar, so the popup is panned into view manually after layout
const panPopupIntoView = popup => {
	const el = popup.getElement();
	if (!el?.isConnected) return;

	const rect = el.getBoundingClientRect();
	const mapRect = map.getContainer().getBoundingClientRect();
	const minTop = statsBar.getBoundingClientRect().bottom + POPUP_VIEW_PADDING;
	const maxBottom = mapRect.bottom - POPUP_VIEW_PADDING;
	const maxRight = mapRect.right - POPUP_VIEW_PADDING;
	const minLeft = mapRect.left + POPUP_VIEW_PADDING;

	let dx = 0;
	let dy = 0;
	if (rect.right > maxRight) dx = rect.right - maxRight;
	if (rect.left - dx < minLeft) dx = rect.left - minLeft;
	if (rect.bottom > maxBottom) dy = rect.bottom - maxBottom;
	if (rect.top - dy < minTop) dy = rect.top - minTop;

	if (dx || dy) map.panBy([dx, dy]);
};

map.on('popupopen', e => {
	requestAnimationFrame(() => {
		const qrEl = e.popup.getElement()?.querySelector('.node-qr');
		if (qrEl?.isConnected) renderQrCode(qrEl);
		panPopupIntoView(e.popup);
	});
});


const icons = Object.fromEntries(['none', 'recent', 'stale', 'old', 'extinct'].map(color => [color,
	Object.fromEntries([2, 3, 4].map(id => [id, L.divIcon({
		html: `<svg width="32" height="32"><use href="/icons/node-types.svg#${NODE_TYPE_ICON_NAMES[id]}"></use></svg>`,
		className: `svg-node-icon update-${color}`,
		iconSize: [32, 32],
		iconAnchor: [17, 17],
		popupAnchor: [0, -16],
	})])),
]));

const langToggle = document.getElementById('lang-toggle');
const langMenu = document.getElementById('lang-menu');

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
initNodeDeletionDialog();
initTesterSignup();
const statsCounts = document.getElementById('stats-counts');
const regionToggle = document.getElementById('region-toggle');
const regionToggleLabel = document.getElementById('region-toggle-label');
const basemapToggle = document.getElementById('basemap-toggle');
const basemapMenu = document.getElementById('basemap-menu');
const settingsModal = initModal('settings-toggle', 'settings-overlay');
const closeFiltersOnApplyCheckbox = document.getElementById('setting-close-filters-on-apply');
const elevationSourceSelect = document.getElementById('setting-elevation-source');
const elevationSourceDesc = document.getElementById('setting-elevation-desc');
const coverageStyleSelect = document.getElementById('setting-coverage-style');
if (window.MAP_CONFIG.features?.appBanner) initAppBanner();
const settingsTabs = initSettingsTabs(document.getElementById('settings-tabs'));
initBasemapManager({
	map,
	toggle: basemapToggle,
	menu: basemapMenu,
	onOpenKeys: () => {
		settingsModal.open();
		settingsTabs.selectById('maps');
	},
});
initApiKeySettings({ container: document.getElementById('setting-api-keys'), saveButton: document.getElementById('setting-api-keys-save') });
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
const clusteringZoomValue = document.getElementById('clustering-zoom-value');
const filtersSummary = document.getElementById('filters-summary');
const filtersShareBtn = document.getElementById('filters-share');
const clearFiltersBtn = document.getElementById('clear-filters-btn');
const restoreFiltersBtn = document.getElementById('restore-filters-btn');
const applyFiltersBtn = document.getElementById('apply-filters-btn');
const nodeTypeCheckboxes = [...document.querySelectorAll('.node-type-checkbox')];
const legendUpdatedAtEl = document.getElementById('legend-updated-at');
const nodePanelContent = document.getElementById('node-panel-content');
const nodeModalCloseBtn = document.getElementById('node-modal-close');

let hapticsEnabled = readFlag('haptics', true);
const vibrate = (duration = 10) => {
	if (hapticsEnabled && navigator.vibrate) navigator.vibrate(duration);
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

const sharedFilters = parseSharedFilters(urlParams);
let filtersFromLink = sharedFilters !== null;
const initialFilters = sharedFilters ?? loadSavedFilters();
const initialRegion = sharedFilters?.region ?? storedRegion;

const state = {
	search: '',
	region: regionToggle && (initialRegion === 'all' || initialRegion === 'pl') ? initialRegion : window.MAP_CONFIG.defaultRegion,
	nodeFilter: initialFilters.nodeFilter ?? ['1', '2', '3', '4'],
	radioFilters: loadRadioFilters(initialFilters),
	fromDate: initialFilters.fromDate ?? '',
	fromInsertDate: initialFilters.fromInsertDate ?? '',
	clusteringZoom: initialFilters.clusteringZoom ?? 11,
	nodes: [],
	nodesByType: {},
	filteredNodes: [],
};

const saveFiltersToStorage = () => {
	if (filtersFromLink) return;

	localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({
		nodeFilter: state.nodeFilter,
		radioFilters: state.radioFilters,
		fromDate: state.fromDate,
		fromInsertDate: state.fromInsertDate,
		clusteringZoom: state.clusteringZoom,
	}));
};

function updateClusteringSlider() {
	const value = Number(clusteringZoomInput.value);
	const min = Number(clusteringZoomInput.min);
	const max = Number(clusteringZoomInput.max);
	const progress = (value - min) / (max - min) * 100;

	clusteringZoomValue.value = value;
	clusteringZoomInput.style.setProperty('--range-progress', `${progress}%`);
}

nodeTypeCheckboxes.forEach(cb => { cb.checked = state.nodeFilter.includes(cb.value); });
fromDateInput.value = state.fromDate;
fromInsertDateInput.value = state.fromInsertDate;
clusteringZoomInput.value = state.clusteringZoom;
updateClusteringSlider();

let markerClusterGroup = L.markerClusterGroup({
	disableClusteringAtZoom: state.clusteringZoom,
	chunkedLoading: true,
});

// A shown set of nodes replaces the whole map (the rest is hidden); clearing it brings the filtered nodes back.
let focusedNodes = null;
let highlightToast = null;

const clearHighlight = () => {
	if (!focusedNodes) return;

	focusedNodes = null;
	refreshMap();
};

const showNodesHighlight = (nodes, message, onClose = clearHighlight) => {
	if (highlightToast) dismissToast(highlightToast);

	if (!nodes.length) {
		clearHighlight();
		showToast(t('map:noNodesInPeriod'), { status: 'info' });
		return;
	}

	focusedNodes = nodes;
	refreshMap();
	map.fitBounds(L.latLngBounds(nodes.map(node => node.marker.getLatLng())), { padding: [60, 60], maxZoom: 15 });

	message ??= t('map:highlightedNodes', { count: nodes.length, unit: plural(nodes.length, tRaw('map:newNodeUnit')) });
	highlightToast = showActionToast(message, { status: 'info', onClose });
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

// The changelog is reached from the legend and from the version in the settings; closing it returns to where it was opened from.
const reopenLegend = () => legendPanelUi.open();
let afterChangelog = reopenLegend;
const changelogModal = initChangelogModal({
	onDismiss: () => {
		const back = afterChangelog;
		afterChangelog = reopenLegend;
		back();
	},
});
document.getElementById('settings-version').addEventListener('click', () => {
	afterChangelog = () => settingsModal.open();
	settingsModal.close();
	changelogModal.open();
});
const measureTool = initMeasureTool({ map, setPicker, escapeHtml, getNodes: () => state.nodes, showToast });
const routeTool = initRouteTool({ map, getNodes: () => state.nodes, escapeHtml });
let elevationSource = localStorage.getItem('elevationSource') || 'sefinek';
const terrainTool = initTerrainTool({ map, setPicker, getNodes: () => state.nodes, showToast, getElevationSource: () => elevationSource });
const COVERAGE_STYLES = ['tiles', 'lines'];
const savedCoverageStyle = localStorage.getItem('coverageStyle');
let coverageStyle = COVERAGE_STYLES.includes(savedCoverageStyle) ? savedCoverageStyle : 'tiles';
const coverageTool = initCoverageTool({ map, setPicker, getNodes: () => state.nodes, showToast, getElevationSource: () => elevationSource, getLayerStyle: () => coverageStyle, getPresets });

const closableTools = [settingsModal, legendPanelUi, statsModal, changelogModal, measureTool, routeTool, terrainTool, coverageTool];
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

const MOBILE_NODE_VIEW_BREAKPOINT = 700;
const isMobileNodeView = () => window.innerWidth <= MOBILE_NODE_VIEW_BREAKPOINT;

const buildViewQuery = ({ withFilters }) => {
	const center = map.getCenter();
	const query = new URLSearchParams({
		lat: center.lat.toFixed(4),
		lon: center.lng.toFixed(4),
		zoom: map.getZoom(),
	});

	if (withFilters) {
		for (const [key, value] of buildFilterParams(state, { includeRegion: Boolean(regionToggle) })) query.set(key, value);
	}

	return query.toString().replaceAll('%2C', ',');
};

const syncUrlParams = () => {
	history.replaceState({}, '', `${location.pathname}?${buildViewQuery({ withFilters: filtersFromLink })}`);
};

const ensurePopup = marker => {
	if (marker._popupBound) return;

	const node = markerToNode.get(marker);
	if (node) {
		marker.bindPopup(L.popup({ minWidth: 430, maxWidth: 430, autoPan: false, pane: 'nodePopupPane', content: () => getNodePopupHTML(node) }));
		marker._popupBound = true;
	}
};

const nodeModal = initModal(null, 'node-overlay', { onDismiss: syncUrlParams });
nodeModalCloseBtn.addEventListener('click', () => {
	nodeModal.close();
	syncUrlParams();
});

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

	history.replaceState({}, '', getShareUrl(node));
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
map.on('popupclose', syncUrlParams);

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

	if (el === filterMenu) {
		const availableHeight = window.innerHeight - rect.bottom - 24;
		el.style.maxHeight = `${Math.max(0, Math.min(780, availableHeight))}px`;
	}

	if (el === searchResultsEl) {
		el.style.left = `${rect.left}px`;
		el.style.right = 'auto';
		el.style.width = `${rect.width}px`;
		el.style.maxWidth = 'none';
	}
	else if (fullWidthOnMobile && el !== filterMenu && window.innerWidth <= 800) {
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

function refreshMap() {
	markerClusterGroup.clearLayers();
	const nodes = focusedNodes ?? state.filteredNodes;

	map.removeLayer(markerClusterGroup);

	if (markerClusterGroup.options.disableClusteringAtZoom !== state.clusteringZoom) {
		markerClusterGroup = L.markerClusterGroup({
			disableClusteringAtZoom: state.clusteringZoom,
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
}

function showNode(node) {
	if (focusedNodes) {
		clearHighlight();
		if (highlightToast) dismissToast(highlightToast);
	}

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
	return escapedSource.replace(escapeHtml(highlight), match => `<b>${match}</b>`);
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
};

const renderStats = () => {
	if (!state.nodes.length) {
		statsCounts.innerHTML = '';
		return;
	}

	const nodes = state.filteredNodes;
	const { clients, repeaters, roomServers } = countByType(nodes);

	statsCounts.innerHTML = `
		<span class="pointer-help" title="${t('map:totalCountTooltip')}"><span class="stats-total-label">${t('map:totalLabel')}</span><b>${nodes.length}</b></span>&nbsp;|
		<svg class="icon icon-filled pointer-help"><title>${t('map:clientsCountTooltip')}</title><use href="/icons/node-types.svg#client-plain"></use></svg><b>${clients}</b>&nbsp;|
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

	searchResults = searchNodes(state.filteredNodes, state.search);

	searchResultsEl.hidden = searchResults.length === 0;
	if (!searchResultsEl.hidden) positionDropdown(searchResultsEl);
	searchResultsEl.innerHTML = searchResults.map(node => `
		<li>
			<svg width="22" height="22"><use href="/icons/node-types.svg#${NODE_TYPE_ICON_NAMES[node.type]}-plain"></use></svg>
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

let previewKeys = null;

const collectFilteredNodes = () => previewKeys
	? state.nodes.filter(node => previewKeys.has(node.public_key))
	: collectFilteredNodesCore(state, state.nodesByType);

const numberFormat = new Intl.NumberFormat(window.MAP_CONFIG.languageCode);
let summaryTimer = 0;

const updateFilterButtons = () => {
	const pristine = buildFilterParams(state).size === 0;
	filtersShareBtn.disabled = pristine;
	clearFiltersBtn.disabled = pristine;
};

const renderFilterSummary = matching => {
	const total = state.nodes.length;

	updateFilterButtons();
	filtersSummary.hidden = total === 0;
	filtersSummary.textContent = t('filters:summary', { matching: numberFormat.format(matching), total: numberFormat.format(total) });
};

const scheduleFilterSummary = () => {
	clearTimeout(summaryTimer);
	summaryTimer = setTimeout(() => renderFilterSummary(collectFilteredNodes().length), 120);
};

const runFilterPass = () => {
	clearTimeout(summaryTimer);

	state.filteredNodes = collectFilteredNodes();
	renderFilterSummary(state.filteredNodes.length);
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
			updateToast(filterToast, t('filters:updated'), { status: 'success' });
		} catch (err) {
			console.error('Failed to update data:', err);
			updateToast(filterToast, t('filters:updateFailed'), { status: 'error' });
		}
	}));
};

const radioFilters = initRadioFilters(state, { onChange: scheduleFilterSummary });

const applyFilterSettings = settings => {
	state.nodeFilter = settings.nodeFilter ?? ['1', '2', '3', '4'];
	state.radioFilters = loadRadioFilters(settings);
	state.fromDate = settings.fromDate ?? '';
	state.fromInsertDate = settings.fromInsertDate ?? '';
	state.clusteringZoom = settings.clusteringZoom ?? 11;

	nodeTypeCheckboxes.forEach(cb => { cb.checked = state.nodeFilter.includes(cb.value); });
	fromDateInput.value = state.fromDate;
	fromInsertDateInput.value = state.fromInsertDate;
	clusteringZoomInput.value = state.clusteringZoom;
	updateClusteringSlider();
	document.getElementById('freq-filter-search').value = '';
	radioFilters.render();
};

const clearFilters = () => {
	applyFilterSettings({});
	applyFilters();
};

const nodesCache = {};
let currentDownloadAbort = null;

const renderLegendUpdatedAt = dataUpdatedAt => {
	legendUpdatedAtEl.textContent = dataUpdatedAt ? ntools.formatTime(new Date(dataUpdatedAt)) : '-';
};

const applyDownloadedNodes = cached => {
	state.nodesByType = cached.byType;
	state.nodes = cached.nodes;
	radioFilters.render(cached.radioOptions);
	renderLegendUpdatedAt(cached.dataUpdatedAt);
};

const downloadNodes = async region => {
	currentDownloadAbort?.abort();

	if (nodesCache[region]) {
		applyDownloadedNodes(nodesCache[region]);
		return true;
	}

	const thresholds = createStatusThresholds();

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
		loadingMeta.textContent = `${totalBytes ? `${ntools.formatBytes(receivedBytes)} / ${ntools.formatBytes(totalBytes)}` : ntools.formatBytes(receivedBytes)} · ${t('map:downloadComplete')}`;

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

		const index = createNodeIndex();
		const CHUNK_SIZE = 2000;

		for (let offset = 0; offset < nodes.length; offset += CHUNK_SIZE) {
			const end = Math.min(offset + CHUNK_SIZE, nodes.length);

			if (abortController.signal.aborted) throw new DOMException('Canceled by user', 'AbortError');

			setLoadingStatus(t('map:processingNodes', { end, total: nodes.length }));
			setLoadingProgress('process', end / nodes.length);
			if (offset > 0) await new Promise(r => setTimeout(r, 0));

			for (let i = offset; i < end; i++) {
				const node = nodes[i];
				prepareNode(node, thresholds);
				indexNode(index, node);

				let icon = icons[node.status][node.type.toString()];

				if (node.type === 1) {
					const label = ntools.getNameIconLabel(node.adv_name);
					const color = ntools.getColourForName(node.adv_name);
					icon = getSvgIcon(label, color);
				}

				const marker = node.marker = L.marker([node.lat, node.lon], { icon, title: node.adv_name });

				markerToNode.set(marker, node);
			}
		}

		if (abortController.signal.aborted) throw new DOMException('Canceled by user', 'AbortError');

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

		nodesCache[region] = { nodes, byType: index.byType, radioOptions: index.radioOptions, dataUpdatedAt };
		applyDownloadedNodes(nodesCache[region]);
		return true;
	} catch (err) {
		if (err.name !== 'AbortError') {
			const message = err.isApiError ? err.message : t('map:unexpectedLoadError');
			showToast(message, { status: 'error' });
			console.error(err);
		}
		return false;
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
	if (!await downloadNodes(region)) return;

	state.region = region;
	localStorage.setItem('regionSelected', region);
	updateRegionToggleUI();
	applyFilters({ silent: !cached });
};

searchInline.addEventListener('submit', e => e.preventDefault());

searchInput.addEventListener('focus', () => {
	if (localStorage.getItem('shiftSearchHintShown')) return;
	localStorage.setItem('shiftSearchHintShown', '1');
	showToast(t('map:shiftSearchHint'), { status: 'info' });
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

const closeFilters = () => {
	filterMenu.hidden = true;
	filterToggle.setAttribute('aria-expanded', 'false');
};

filterToggle.addEventListener('click', () => {
	if (!filterMenu.hidden) {
		closeFilters();
		return;
	}

	filterMenu.hidden = false;
	filterToggle.setAttribute('aria-expanded', 'true');
	positionDropdown(filterMenu);
});

document.getElementById('filters-close').addEventListener('click', () => {
	closeFilters();
	filterToggle.focus();
});

filterMenu.addEventListener('keydown', e => {
	if (e.key !== 'Escape') return;

	closeFilters();
	filterToggle.focus();
});

nodeTypeCheckboxes.forEach(checkbox => {
	checkbox.addEventListener('change', () => {
		state.nodeFilter = nodeTypeCheckboxes.filter(cb => cb.checked).map(cb => cb.value);
		scheduleFilterSummary();
	});
});

fromDateInput.addEventListener('change', () => {
	state.fromDate = fromDateInput.value;
	scheduleFilterSummary();
});

fromInsertDateInput.addEventListener('change', () => {
	state.fromInsertDate = fromInsertDateInput.value;
	scheduleFilterSummary();
});

filtersShareBtn.addEventListener('click', () => {
	navigator.clipboard.writeText(`${location.origin}${location.pathname}?${buildViewQuery({ withFilters: true })}`).then(
		() => showToast(t('filters:linkCopied')),
		() => showToast(t('filters:linkCopyFailed'), { status: 'error' })
	);
});

clusteringZoomInput.addEventListener('input', () => {
	state.clusteringZoom = Number(clusteringZoomInput.value);
	updateClusteringSlider();
	updateFilterButtons();
});

clusteringZoomInput.addEventListener('change', () => {
	refreshMap();
	syncUrlParams();
	saveFiltersToStorage();
});

closeFiltersOnApplyCheckbox.checked = localStorage.getItem('closeFiltersOnApply') !== '0';

closeFiltersOnApplyCheckbox.addEventListener('change', () => {
	localStorage.setItem('closeFiltersOnApply', closeFiltersOnApplyCheckbox.checked ? '1' : '0');
});

const ELEVATION_SOURCE_DESC_KEYS = {
	sefinek: 'settings:elevationSefinekDesc',
	'open-elevation': 'settings:elevationOpenElevationDesc',
	'open-meteo': 'settings:elevationOpenMeteoDesc',
};

const updateElevationSourceDesc = () => {
	const sourceDescKey = ELEVATION_SOURCE_DESC_KEYS[elevationSource];
	elevationSourceDesc.textContent = sourceDescKey ? `${t('settings:elevationDesc')}\n${t(sourceDescKey)}` : t('settings:elevationDesc');
};

elevationSourceSelect.value = elevationSource;
updateElevationSourceDesc();

elevationSourceSelect.addEventListener('change', () => {
	elevationSource = elevationSourceSelect.value;
	localStorage.setItem('elevationSource', elevationSource);
	updateElevationSourceDesc();
});

const scaleControl = L.control.scale({ imperial: false, position: 'bottomleft' });

// A checkbox stored as a flag in localStorage; onChange also receives the initial value.
const bindFlagSetting = (id, key, fallback, onChange) => {
	const input = document.getElementById(id);
	input.checked = readFlag(key, fallback);
	onChange(input.checked);
	input.addEventListener('change', () => {
		writeFlag(key, input.checked);
		onChange(input.checked);
	});
};

bindFlagSetting('setting-show-scale', 'showScale', false, enabled => enabled ? scaleControl.addTo(map) : scaleControl.remove());
bindFlagSetting('setting-show-add-button', 'showAddButton', true, enabled => {
	document.getElementById('fab-primary').hidden = !enabled;
});
bindFlagSetting('setting-remember-view', 'rememberView', false, enabled => {
	rememberView = enabled;
	if (enabled) saveView(map.getCenter(), map.getZoom());
});
bindFlagSetting('setting-haptics', 'haptics', true, enabled => {
	hapticsEnabled = enabled;
});
if (!navigator.vibrate) document.getElementById('setting-haptics-row').hidden = true;

initMapLanguageSetting(document.getElementById('setting-map-language'));
initDataSettings({
	tab: document.getElementById('settings-tab-data'),
	usage: document.getElementById('setting-storage-usage'),
	resetButton: document.getElementById('setting-reset'),
	clearButton: document.getElementById('setting-clear-data'),
});

coverageStyleSelect.value = coverageStyle;
coverageStyleSelect.addEventListener('change', () => {
	coverageStyle = coverageStyleSelect.value;
	localStorage.setItem('coverageStyle', coverageStyle);
	coverageTool.refreshLayer();
});

applyFiltersBtn.addEventListener('click', () => {
	applyFilters();
	if (closeFiltersOnApplyCheckbox.checked) closeFilters();
});

clearFiltersBtn.addEventListener('click', clearFilters);

restoreFiltersBtn.hidden = !filtersFromLink;

restoreFiltersBtn.addEventListener('click', async () => {
	filtersFromLink = false;
	restoreFiltersBtn.hidden = true;
	applyFilterSettings(loadSavedFilters());

	const savedRegion = localStorage.getItem('regionSelected');
	const region = regionToggle && (savedRegion === 'all' || savedRegion === 'pl') ? savedRegion : window.MAP_CONFIG.defaultRegion;

	if (region === state.region) applyFilters();
	else await setRegion(region);
});

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

basemapToggle.addEventListener('click', () => {
	const willShow = basemapMenu.hidden;
	basemapMenu.hidden = !basemapMenu.hidden;
	if (willShow) positionDropdown(basemapMenu, basemapToggle, { fullWidthOnMobile: false });
});

const closeLanguageMenu = () => {
	if (!langMenu) return;
	langMenu.hidden = true;
	langToggle.setAttribute('aria-expanded', 'false');
};

langToggle?.addEventListener('click', () => {
	langMenu.hidden = !langMenu.hidden;
	langToggle.setAttribute('aria-expanded', String(!langMenu.hidden));
	if (!langMenu.hidden) positionDropdown(langMenu, langToggle, { fullWidthOnMobile: false });
});

langMenu?.addEventListener('keydown', e => {
	if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
		e.preventDefault();
		const links = [...langMenu.querySelectorAll('a')];
		const index = links.indexOf(document.activeElement);
		links[(index + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length].focus();
	}
	if (e.key !== 'Escape') return;
	closeLanguageMenu();
	langToggle.focus();
});

langToggle?.addEventListener('keydown', e => {
	if (e.key === 'Escape') closeLanguageMenu();
	if (e.key !== 'ArrowDown') return;
	e.preventDefault();
	if (langMenu.hidden) langToggle.click();
	langMenu.querySelector('a').focus();
});

// An icon button shows a check mark for a moment after copying, then goes back to the copy icon.
const markCopied = button => {
	const use = button.querySelector('use');
	if (!use) return;

	clearTimeout(button.copiedTimer);
	use.setAttribute('href', '/icons/icons.svg#check');
	button.classList.add('copied');
	button.copiedTimer = setTimeout(() => {
		use.setAttribute('href', '/icons/icons.svg#copy');
		button.classList.remove('copied');
	}, COPY_FEEDBACK_MS);
};

document.addEventListener('click', e => {
	const copyBtn = e.target.closest('.copy-link-btn, .copy-icon-btn');
	if (copyBtn) {
		void navigator.clipboard.writeText(copyBtn.dataset.copyValue).then(() => {
			showToast(t('common:copiedToClipboard'));
			markCopied(copyBtn);
		});
	}
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
	if (!filterMenu.hidden && !filterMenu.contains(e.target) && !filterToggle.contains(e.target)) closeFilters();
	if (!searchResultsEl.hidden && !searchResultsEl.contains(e.target) && !searchInline.contains(e.target)) searchResultsEl.hidden = true;
	if (!basemapMenu.hidden && !basemapMenu.contains(e.target) && !basemapToggle.contains(e.target)) basemapMenu.hidden = true;
	if (langMenu && !langMenu.hidden && !langMenu.contains(e.target) && !langToggle.contains(e.target)) closeLanguageMenu();
});

document.addEventListener('focusin', e => {
	if (langMenu && !langMenu.hidden && !langMenu.contains(e.target) && !langToggle.contains(e.target)) closeLanguageMenu();
});

window.addEventListener('resize', () => {
	if (!filterMenu.hidden) positionDropdown(filterMenu);
	if (!searchResultsEl.hidden) positionDropdown(searchResultsEl);
	if (!basemapMenu.hidden) positionDropdown(basemapMenu, basemapToggle, { fullWidthOnMobile: false });
	if (langMenu && !langMenu.hidden) positionDropdown(langMenu, langToggle, { fullWidthOnMobile: false });
});

map.on('moveend', syncUrlParams);
map.on('moveend', () => {
	if (rememberView) saveView(map.getCenter(), map.getZoom());
});

updateRegionToggleUI();

downloadNodes(state.region).then(() => {
	applyFilters({ silent: true });

	if (sharedFilters) showToast(t('filters:sharedApplied'), { status: 'info' });

	if (urlParams.node) {
		const node = state.nodes.find(n => n.public_key === urlParams.node);
		if (node) showNode(node);
	}

	if (urlParams.nodes) {
		previewKeys = new Set(urlParams.nodes.split(',').slice(0, 24));
		runFilterPass();

		const nodes = state.filteredNodes.filter(n => n.marker);
		if (nodes.length) {
			const owner = (urlParams.profile || '').trim().slice(0, 64);
			const message = owner
				? t('map:previewProfileNodes', { owner: escapeHtml(owner), count: nodes.length })
				: t('map:previewNodes', { count: nodes.length });
			showNodesHighlight(nodes, message, () => {
				previewKeys = null;
				clearHighlight();
				applyFilters();
			});
		} else {
			previewKeys = null;
			runFilterPass();
		}
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

	if (urlParams.coverage) {
		const parts = urlParams.coverage.split(',');
		const [lat, lng, txHeight, rxHeight, freq, resolution, terrainMargin, erp, sf, bw] = parts;
		const parsedLat = Number(lat), parsedLng = Number(lng);

		if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
			coverageTool.loadFromUrlState(
				parsedLat, parsedLng, Number(txHeight), Number(rxHeight), Number(freq),
				resolution, Number(terrainMargin), Number(erp), Number(sf), Number(bw)
			);
		}
	}
});

window.refreshMap = refreshMap;
