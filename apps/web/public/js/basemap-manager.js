import { BASEMAP_CATEGORIES, basemapFailureReason, normalizeBasemapSelection, resolveBasemap, withBasemapFailure } from '/core/basemaps.js';
import { baseMapAttributions, baseMapInfo, catalog, getMaplibreBaseMapLayer, maplibreBaseMapOptions, maplibreBaseMaps, tileBaseMaps } from './basemaps.js';
import { t } from './i18n.js';
import { escapeHtml } from './pathtools.js';
import { showToast, updateToast } from './toast.js';

const STORAGE_KEY = 'baseMapSelected';
const LOAD_TIMEOUT_MS = 20000;

const readStored = () => {
	try {
		return normalizeBasemapSelection(localStorage.getItem(STORAGE_KEY));
	} catch {
		return null;
	}
};

// null stands for "follow the default", which is stored as no value, so the visitor gets a new default if it ever changes.
const writeStored = name => {
	try {
		if (name === null) localStorage.removeItem(STORAGE_KEY);
		else localStorage.setItem(STORAGE_KEY, name);
	} catch { /* storage unavailable */ }
};

// Without a status from the layer, a lost connection is told apart from a rejected key by the browser's own state.
const failureStatus = err => err?.status ?? (navigator.onLine ? undefined : 0);

const failureReason = (name, status) => t(`map:basemapFailure.${basemapFailureReason(status, { requiresKey: Boolean(catalog.byName(name)?.requires) })}`, { status });

// Resolves when the layer has loaded; rejects with the HTTP status of the failing request when the layer reports one (0 = no answer).
const waitForLoad = (layer, name) => new Promise((resolve, reject) => {
	const listeners = [];
	const timer = setTimeout(() => fail(0), LOAD_TIMEOUT_MS);

	function finish(error) {
		clearTimeout(timer);
		for (const [target, event, handler] of listeners) target.off(event, handler);
		if (error) reject(error);
		else resolve();
	}

	function fail(status) {
		finish(Object.assign(new Error(`Base map "${name}" failed to load`), { status }));
	}

	const listen = (target, event, handler) => {
		listeners.push([target, event, handler]);
		target.on(event, handler);
	};

	listen(layer, 'remove', () => fail());

	if (maplibreBaseMapOptions[name]) {
		const glMap = layer.getMaplibreMap();
		if (!glMap) return fail();
		if (glMap.loaded()) return finish();

		listen(glMap, 'load', () => finish());
		listen(glMap, 'error', event => fail(event?.error?.status));
		return undefined;
	}

	const tileLayers = layer.getLayers ? layer.getLayers() : [layer];
	let pending = tileLayers.length;
	if (pending === 0) return finish();

	for (const tileLayer of tileLayers) {
		listen(tileLayer, 'tileerror', () => fail());
		listen(tileLayer, 'load', () => {
			pending -= 1;
			if (pending === 0) finish();
		});
	}
	return undefined;
});

// Owns the base map: which one is wanted (the visitor's choice, else the default), which one is shown, what failed and how the list explains it.
export const initBasemapManager = ({ map, toggle, menu, onOpenKeys }) => {
	let selected = readStored();
	let failures = {};
	let requestId = 0;
	let attribution = null;

	const state = () => resolveBasemap({ catalog, selected, failures });

	const showLayer = async (name, id) => {
		const layer = maplibreBaseMapOptions[name] ? await getMaplibreBaseMapLayer(name) : tileBaseMaps[name];
		if (id !== requestId) return false;

		for (const other of [...Object.values(tileBaseMaps), ...Object.values(maplibreBaseMaps)]) {
			if (other !== layer && map.hasLayer(other)) map.removeLayer(other);
		}

		const wasOnMap = map.hasLayer(layer);
		if (!wasOnMap) map.addLayer(layer);
		map.setMaxZoom(layer.options.maxZoom);

		if (attribution) map.attributionControl.removeAttribution(attribution);
		attribution = layer.options.esriAttribution || baseMapAttributions[name];
		map.attributionControl.addAttribution(attribution);

		if (!wasOnMap) {
			try {
				await waitForLoad(layer, name);
			} catch (err) {
				if (id === requestId) throw err;
			}
		}
		return id === requestId;
	};

	// A failure is announced once per browser session (and map), not on every page load; choosing the map again resets it.
	const announcedKey = name => `basemapFailureAnnounced:${name}`;

	const wasAnnounced = name => {
		try {
			return sessionStorage.getItem(announcedKey(name)) === '1';
		} catch {
			return false;
		}
	};

	const setAnnounced = (name, value) => {
		try {
			if (value) sessionStorage.setItem(announcedKey(name), '1');
			else sessionStorage.removeItem(announcedKey(name));
		} catch { /* storage unavailable */ }
	};

	const announceFailure = (name, status, toast) => {
		if (wasAnnounced(name)) {
			if (toast) toast.remove();
			return;
		}
		setAnnounced(name, true);

		const { active } = state();
		const message = active === name
			? t('map:basemapAllFailed', { reason: failureReason(name, status) })
			: t('map:basemapFallback', { failed: name, reason: failureReason(name, status), fallback: active });

		if (toast) updateToast(toast, message, { status: 'error' });
		else showToast(message, { status: 'error' });
	};

	// Shows the active map; one that fails is recorded and the next is tried, so the visitor always ends up with a working map.
	// Resolves with the map that ended up shown, or null when a newer request took over.
	const apply = async ({ toast = null } = {}) => {
		const id = ++requestId;
		let failed = false;

		for (;;) {
			const { active } = state();
			render();

			try {
				if (!await showLayer(active, id)) return null;

				if (toast && !failed) updateToast(toast, t('map:basemapLoaded'), { status: 'success' });
				return active;
			} catch (err) {
				if (id !== requestId) return null;

				const status = failureStatus(err);
				console.error(`Base map "${active}" failed to load:`, err);

				const next = withBasemapFailure(failures, active, status);
				if (next === failures) return null;

				failures = next;
				failed = true;
				announceFailure(active, status, toast);
			}
		}
	};

	// Choosing a map also retries it if it failed earlier. null follows the default and is saved at once (it pins nothing);
	// a map of one's own is saved only once it has actually loaded.
	const choose = async name => {
		const target = name ?? catalog.defaultName;
		selected = name;
		setAnnounced(target, false);
		failures = Object.fromEntries(Object.entries(failures).filter(([failed]) => failed !== target));
		if (name === null) writeStored(null);

		const toast = maplibreBaseMapOptions[target] && !maplibreBaseMaps[target] ? showToast(t('map:loadingBasemap'), { duration: 0, status: 'loading' }) : null;
		const shown = await apply({ toast });
		if (name !== null && shown === name) writeStored(name);
	};

	// Raster tiles are ready-made images, a vector map is drawn by the device: the difference shows in sharpness, weight and WebGL support.
	const typeBadge = group => `<small class="basemap-badge basemap-badge-type" title="${escapeHtml(t(`map:basemapTypeInfo.${group}`))}">${escapeHtml(t(`map:basemapTypes.${group}`))}</small>`;

	// The first entry: no choice of one's own, so whichever map is the default now (it can change, e.g. once a key works).
	const defaultEntryHtml = () => {
		const { followsDefault } = state();
		// What the default comes to right now, after the fallbacks: the name in the parentheses is the map it would show.
		const { active: name } = resolveBasemap({ catalog, selected: null, failures });
		const selectedNow = followsDefault;

		return `<li role="option" data-action="default" class="${['basemap-option', selectedNow ? 'active' : ''].join(' ').trim()}" aria-selected="${selectedNow}" title="${escapeHtml(baseMapInfo[name] ?? '')}"><span>${escapeHtml(t('map:defaultBasemap'))} <span class="basemap-default-name">(${escapeHtml(name)})</span></span><span class="basemap-badges">${typeBadge(catalog.listed.find(item => item.name === name).group)}</span></li>`;
	};

	const itemHtml = ({ name, disabled, group }) => {
		const label = escapeHtml(name);
		if (disabled) {
			return `<li class="locked" role="option" aria-disabled="true" data-action="keys" title="${escapeHtml(t('map:basemapNeedsKey'))}"><span>${label}</span><span class="basemap-badges"><small class="basemap-badge">${escapeHtml(t('map:basemapNeedsKeyShort'))}</small>${typeBadge(group)}</span></li>`;
		}

		// The highlight is the visitor's selection (the default has its own entry above); a replacement shown because the selection failed is only marked.
		const { wanted, active, usingFallback, followsDefault } = state();
		const current = !followsDefault && name === wanted;
		const failed = Object.hasOwn(failures, name);
		const shown = usingFallback && name === active;
		const badges = `${failed ? `<small class="basemap-badge basemap-badge-warn">${escapeHtml(t('map:basemapUnavailable'))}</small>` : ''}${shown ? `<small class="basemap-badge basemap-badge-shown">${escapeHtml(t('map:basemapShown'))}</small>` : ''}${typeBadge(group)}`;

		return `<li role="option" data-basemap="${label}" class="${['basemap-option', current ? 'active' : '', failed ? 'unavailable' : ''].join(' ').trim()}" aria-selected="${current}" title="${escapeHtml(baseMapInfo[name] ?? '')}"><span>${label}</span><span class="basemap-badges">${badges}</span></li>`;
	};

	function render() {
		const { wanted, active, usingFallback } = state();

		const status = usingFallback
			? `<li class="basemap-status" role="status">${escapeHtml(t('map:basemapUsing', { active, failed: wanted, reason: failureReason(wanted, failures[wanted]?.status) }))}</li>`
			: '';

		const groups = BASEMAP_CATEGORIES.map(category => {
			const items = catalog.listed.filter(item => item.category === category);
			return items.length ? `<li class="basemap-category" role="presentation">${escapeHtml(t(`map:basemapCategories.${category}`))}</li>${items.map(itemHtml).join('')}` : '';
		});

		menu.setAttribute('role', 'listbox');
		menu.innerHTML = status + defaultEntryHtml() + groups.join('');
		toggle.classList.toggle('warn', usingFallback);
		toggle.title = usingFallback ? t('map:basemapUsing', { active, failed: wanted, reason: failureReason(wanted, failures[wanted]?.status) }) : t('map:basemapToggleTitle');
	}

	menu.addEventListener('click', event => {
		const row = event.target.closest('[data-action], li[data-basemap]');
		if (!row) return;

		menu.hidden = true;
		if (row.dataset.action === 'keys') onOpenKeys();
		else void choose(row.dataset.action === 'default' ? null : row.dataset.basemap);
	});

	// A saved map whose key is gone is dropped (with a note), instead of failing on every visit.
	if (selected && catalog.isMissingKey(selected)) {
		showToast(t('map:basemapMissingApiKey', { name: selected }), { status: 'info' });
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch { /* storage unavailable */ }
		selected = null;
	}

	void apply();
};
