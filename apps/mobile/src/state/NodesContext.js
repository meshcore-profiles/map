import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collectFilteredNodes } from '@meshcore-map/core/nodes';
import { API_BASE, NODES_REFRESH_AFTER_MS } from '../config';
import { downloadRegion, readCachedRegion } from '../data/nodesRepository';
import { useSettings } from './SettingsContext';

const NodesContext = createContext(null);

const EMPTY = { nodes: [], byType: {}, radioOptions: {}, fetchedAt: null };

// Phases: 'idle' | 'loading' (reading the cache) | 'downloading' | 'ready' | 'error'.
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
		if (cached) {
			setData(cached);
			setPhase('ready');
		} else {
			setData(EMPTY);
		}

		const fresh = cached && Date.now() - cached.fetchedAt < NODES_REFRESH_AFTER_MS;
		if (fresh && !force) return;

		setPhase(cached ? 'ready' : 'downloading');
		setProgress(0);
		try {
			const downloaded = await downloadRegion(API_BASE, region, {
				signal: controller.signal,
				onProgress: ({ bytesWritten, totalBytes }) => totalBytes > 0 && setProgress(bytesWritten / totalBytes),
			});
			if (controller.signal.aborted) return;
			setData(downloaded);
			setPhase('ready');
		} catch (err) {
			if (controller.signal.aborted) return;
			console.error('Failed to download nodes:', err);
			setError(err);
			setPhase(cached ? 'ready' : 'error');
		}
	}, [region]);

	useEffect(() => {
		if (!ready) return undefined;

		void refresh();
		return () => abortRef.current?.abort();
	}, [ready, refresh]);

	const filtered = useMemo(() => collectFilteredNodes(settings.filters, data.byType), [settings.filters, data.byType]);
	const value = useMemo(() => ({ ...data, filtered, phase, progress, error, refresh }), [data, filtered, phase, progress, error, refresh]);

	return <NodesContext.Provider value={value}>{children}</NodesContext.Provider>;
};

export const useNodes = () => useContext(NodesContext);
