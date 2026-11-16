const VIEW_KEY = 'lastView';
const MAP_LANGUAGE_KEY = 'mapLanguage';
export const MAP_LANGUAGES = ['local', 'pl', 'en'];

// Keys restored by "Reset settings" (filters and tool data stay).
export const SETTING_KEYS = ['closeFiltersOnApply', 'elevationSource', 'coverageStyle', 'customApiKeys', 'baseMapSelected', 'haptics', 'rememberView', 'showScale', MAP_LANGUAGE_KEY, VIEW_KEY];

const read = key => {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
};

const write = (key, value) => {
	try {
		localStorage.setItem(key, value);
	} catch { /* storage unavailable */ }
};

export const readFlag = (key, fallback) => {
	const value = read(key);
	return value === null ? fallback : value === '1';
};

export const writeFlag = (key, value) => write(key, value ? '1' : '0');

export const readSavedView = () => {
	try {
		const view = JSON.parse(read(VIEW_KEY));
		const valid = Number.isFinite(view?.lat) && Number.isFinite(view?.lon) && Number.isFinite(view?.zoom) && Math.abs(view.lat) <= 90 && Math.abs(view.lon) <= 200 && view.zoom >= 2 && view.zoom <= 20;
		return valid ? view : null;
	} catch {
		return null;
	}
};

export const saveView = (center, zoom) => write(VIEW_KEY, JSON.stringify({ lat: Number(center.lat.toFixed(5)), lon: Number(center.lng.toFixed(5)), zoom }));

// null = the site's default language
export const readMapLanguage = () => {
	const value = read(MAP_LANGUAGE_KEY);
	return MAP_LANGUAGES.includes(value) ? value : null;
};

// Vector maps build their styles at startup, so the page reloads after a language change.
export const initMapLanguageSetting = select => {
	select.value = readMapLanguage() ?? 'auto';
	select.addEventListener('change', () => {
		try {
			if (select.value === 'auto') localStorage.removeItem(MAP_LANGUAGE_KEY);
			else localStorage.setItem(MAP_LANGUAGE_KEY, select.value);
		} catch { /* storage unavailable */ }
		location.reload();
	});
};
