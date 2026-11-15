import { useCallback, useEffect, useMemo, useRef } from 'react';
import { DEFAULT_BASEMAP_SELECTION } from '@meshcore-map/core/basemaps';
import { createBasemaps } from '../data/basemaps';
import { useI18n } from '../i18n';
import { useToast } from '../ui/Toast';

const FAILURE_DEBOUNCE_MS = 400;
const TOAST_DURATION_MS = 6000;

// The basemap catalogue, the style of the active map and the reaction to a style that fails to load.
export const useBasemap = ({ config, settings, update }) => {
	const { t } = useI18n();
	const showToast = useToast();

	const basemaps = useMemo(() => createBasemaps(config?.basemaps, settings.region), [config, settings.region]);
	const selectedName = basemaps.resolve(settings.basemap);
	const activeName = basemaps.byName(selectedName) ? selectedName : basemaps.defaultName;
	const activeBasemap = basemaps.byName(activeName);
	// The style object is rebuilt whenever the app config arrives; comparing its serialised form keeps the map from reloading an identical style.
	const styleKey = typeof activeBasemap.style === 'string' ? activeBasemap.style : JSON.stringify(activeBasemap.style);
	const mapStyle = useMemo(() => activeBasemap.style, [styleKey]);

	useEffect(() => {
		if (config && basemaps.isMissingKey(settings.basemap)) {
			showToast(t('map:basemapMissingApiKey', { name: settings.basemap }), { status: 'error', duration: TOAST_DURATION_MS });
			update({ basemap: DEFAULT_BASEMAP_SELECTION });
		}
	}, [config, basemaps, settings.basemap, showToast, t, update]);

	// Like the website, the fallback becomes the saved choice, so the next launch loads a working map directly instead of failing and showing a toast again.
	// The native side may report one failed style more than once in a row; only the first report counts.
	const lastFailure = useRef(0);
	const handleStyleFailed = useCallback(() => {
		const now = Date.now();
		if (now - lastFailure.current < FAILURE_DEBOUNCE_MS) return;

		lastFailure.current = now;
		const next = basemaps.nextFallback(activeName);
		if (!next) return;

		showToast(t('map:basemapFallback', { failed: activeName, fallback: next }), { status: 'error', duration: TOAST_DURATION_MS });
		update({ basemap: next });
	}, [basemaps, activeName, showToast, t, update]);

	return { basemaps, mapStyle, handleStyleFailed };
};
