import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_VIEW } from '../config';
import { DOCKED_MAX_HEIGHT } from '../ui/Sheet';

export const NO_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };

// The map camera and the moves the screen makes with it. Every returned callback is stable, so the memoised layers do not re-render when the screen does.
export const useMapCamera = ({ mapReady, region, rotateTilt }) => {
	const insets = useSafeAreaInsets();
	const { height: windowHeight } = useWindowDimensions();
	const cameraRef = useRef(null);

	// The camera jumps to the default view when the user narrows the map to Poland; widening to all nodes keeps the current view.
	// The launch view (the saved one, else the region's default) is the Camera's initialViewState, so the first run only records the region.
	const previousRegion = useRef(null);
	useEffect(() => {
		if (!mapReady) return;

		const previous = previousRegion.current;
		previousRegion.current = region;
		if (!previous || previous === region || region === 'all') return;

		const view = DEFAULT_VIEW[region];
		cameraRef.current?.flyTo({ center: view.center, zoom: view.zoom, padding: NO_PADDING, duration: 800 });
	}, [mapReady, region]);

	useEffect(() => {
		if (!rotateTilt) cameraRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 300 });
	}, [rotateTilt]);

	// The node panel covers the bottom half of the screen, so the camera is padded to keep the node in the visible part of the map.
	const nodePadding = useMemo(() => ({ top: 0, left: 0, right: 0, bottom: windowHeight * DOCKED_MAX_HEIGHT }), [windowHeight]);
	const flyToNode = useCallback(node => cameraRef.current?.flyTo({ center: [node.lon, node.lat], zoom: 14, padding: nodePadding, duration: 800 }), [nodePadding]);
	const easeToNode = useCallback(node => cameraRef.current?.easeTo({ center: [node.lon, node.lat], padding: nodePadding, duration: 400 }), [nodePadding]);
	const flyToView = useCallback(({ center, zoom }) => cameraRef.current?.flyTo({ center, zoom, padding: NO_PADDING, duration: 800 }), []);
	const fitTo = useCallback(bounds => cameraRef.current?.fitBounds(bounds, { padding: { top: insets.top + 130, bottom: 360, left: 40, right: 40 }, duration: 600 }), [insets.top]);
	const compassPosition = useMemo(() => ({ top: insets.top + 140, right: 12 }), [insets.top]);

	return { cameraRef, flyToNode, easeToNode, flyToView, fitTo, compassPosition };
};
