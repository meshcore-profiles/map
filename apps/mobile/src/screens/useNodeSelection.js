import { useCallback, useRef, useState } from 'react';
import { boundsOf } from '../tools/pathFeatures';
import { haptics } from '../ui/haptics';
import { NO_PADDING } from './useMapCamera';

// Which node is open and which set of nodes is shown instead of the filtered map ("Show on map" in the statistics), plus the map's tap handling.
// A tool that picks points registers its handlers with setPicker; while it is set, taps go to it instead of selecting nodes.
export const useNodeSelection = ({ cameraRef, byKey, camera }) => {
	const { flyToNode, easeToNode, fitTo } = camera;
	const sourceRef = useRef(null);
	const pickerRef = useRef(null);
	const [selected, setSelected] = useState(null);
	const [focused, setFocused] = useState(null);

	const clearSelection = useCallback(() => setSelected(null), []);
	const clearFocus = useCallback(() => setFocused(null), []);
	const setPicker = useCallback(handlers => {
		pickerRef.current = handlers;
	}, []);

	const showNode = useCallback(node => {
		setFocused(null);
		setSelected(node);
		flyToNode(node);
	}, [flyToNode]);

	const focusNodes = useCallback(list => {
		if (!list.length) return;

		setFocused(list);
		fitTo(boundsOf(list.map(node => ({ lat: node.lat, lng: node.lon }))));
	}, [fitTo]);

	const handleNodePress = useCallback(async event => {
		const feature = event.nativeEvent.features?.[0];
		if (!feature) return;

		event.stopPropagation?.();
		const { properties } = feature;

		if (properties.cluster) {
			haptics.tap();
			const zoom = await sourceRef.current?.getClusterExpansionZoom(properties.cluster_id);
			const [lng, lat] = feature.geometry.coordinates;
			if (zoom != null) cameraRef.current?.flyTo({ center: [lng, lat], zoom: zoom + 0.5, padding: NO_PADDING, duration: 500 });
			return;
		}

		const node = byKey.get(properties.key);
		if (!node) return;

		if (pickerRef.current?.onNode) {
			pickerRef.current.onNode(node);
			return;
		}

		haptics.tap();
		setSelected(node);
		easeToNode(node);
	}, [byKey, cameraRef, easeToNode]);

	const handleMapPress = useCallback(event => {
		const [lng, lat] = event.nativeEvent.lngLat;
		if (pickerRef.current?.onMap) pickerRef.current.onMap({ lat, lng });
		else setSelected(null);
	}, []);

	return { sourceRef, selected, focused, clearSelection, clearFocus, setPicker, showNode, focusNodes, handleNodePress, handleMapPress };
};
