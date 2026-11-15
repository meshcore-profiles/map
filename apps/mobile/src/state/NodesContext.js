import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collectFilteredNodes } from '@meshcore-map/core/nodes';
import { API_BASE, NODES_REFRESH_AFTER_MS } from '../config';
import { downloadRegion, readCachedRegion } from '../data/nodesRepository';
import { useSettings } from './SettingsContext';

const NodesContext = createContext(null);
const NodesStatusContext = createContext(null);

const EMPTY = { nodes: [], byType: {}, radioOptions: {}, fetchedAt: null };

// Phases: 'idle' | 'loading' (reading the cache) | 'downloading' | 'ready' | 'error'.
// The data and the status live in separate contexts: the download progress ticks many times, and only the status banner has to follow them.
export const NodesProvider = ({ children }) => {
	const { settings, ready } = useSettings();
	const { region } = settings;
	const [data, setData] = useState(EMPTY);
	const [phase, setPhase] = useState('idle');
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState(null);
	const abortRef = useRef(null);

	const refresh = useCallback(async ({ force = false } = {}) => {
		if (!region) return;

		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		setError(null);
		setPhase('loading');
		const cached = await readCachedRegion(region);
		if (controller.signal.aborted) return;
		// Without a cached copy the previous region's nodes stay on the map until the download finishes (or fails), instead of flashing an empty map.
		if (cached) {
			setData(cached);
			setPhase('ready');
		}

		const fresh = cached && Date.now() - cached.fetchedAt < NODES_REFRESH_AFTER_MS;
		if (fresh && !force) return;

		setPhase(cached ? 'ready' : 'downloading');
		setProgress(0);
		try {
			const downloaded = await downloadRegion(API_BASE, region, {
				signal: controller.signal,
				// Whole percents only: identical values bail out of the state update, so a large download does not re-render once per chunk.
				onProgress: ({ bytesWritten, totalBytes }) => totalBytes > 0 && setProgress(Math.round(bytesWritten / totalBytes * 100)),
			});
			if (controller.signal.aborted) return;
			setData(downloaded);
			setPhase('ready');
		} catch (err) {
			if (controller.signal.aborted) return;
			console.error('Failed to download nodes:', err);
			setError(err);
			if (!cached) setData(EMPTY);
			setPhase(cached ? 'ready' : 'error');
		}
	}, [region]);

	// Stops a running download; without a cached copy the status banner then offers a retry.
	const cancel = useCallback(() => {
		abortRef.current?.abort();
		setProgress(0);
		setError(Object.assign(new Error('Download cancelled'), { cancelled: true }));
		setPhase(current => current === 'downloading' ? 'error' : 'ready');
	}, []);

	useEffect(() => {
		if (!ready) return undefined;

		void refresh();
		return () => abortRef.current?.abort();
	}, [ready, refresh]);

	// Only the filters that decide which nodes match are a dependency: changing the clustering zoom must not rebuild the whole node list.
	const { nodeFilter, radioFilters, fromDate, fromInsertDate } = settings.filters;
	const filterKey = JSON.stringify([nodeFilter, radioFilters, fromDate, fromInsertDate]);
	const filtered = useMemo(() => collectFilteredNodes({ nodeFilter, radioFilters, fromDate, fromInsertDate }, data.byType), [filterKey, data.byType]);

	const value = useMemo(() => ({ ...data, filtered, refresh, cancel }), [data, filtered, refresh, cancel]);
	const status = useMemo(() => ({ phase, progress, error }), [phase, progress, error]);

	return (
		<NodesContext.Provider value={value}>
			<NodesStatusContext.Provider value={status}>{children}</NodesStatusContext.Provider>
		</NodesContext.Provider>
	);
};

export const useNodes = () => useContext(NodesContext);

export const useNodesStatus = () => useContext(NodesStatusContext);
