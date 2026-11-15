import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Camera, Map as MapView } from '@maplibre/maplibre-react-native';
import { SITES, toMaplibreView } from '@meshcore-map/core/sites';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BasemapSheet } from '../components/BasemapSheet';
import { FiltersSheet } from '../components/FiltersSheet';
import { LegendSheet } from '../components/LegendSheet';
import { MapControls } from '../components/MapControls';
import { NodeLayer } from '../components/NodeLayer';
import { NodeSheet } from '../components/NodeSheet';
import { OverlayLayer } from '../components/OverlayLayer';
import { SettingsSheet } from '../components/SettingsSheet';
import { StatsSheet } from '../components/StatsSheet';
import { TopBar } from '../components/TopBar';
import { DEFAULT_VIEW } from '../config';
import { useAppConfig } from '../data/appConfig';
import { useNodes } from '../state/NodesContext';
import { useMapLink } from '../state/useMapLink';
import { useSettings } from '../state/SettingsContext';
import { CoverageTool } from '../tools/CoverageTool';
import { MeasureTool } from '../tools/MeasureTool';
import { boundsOf } from '../tools/pathFeatures';
import { RouteTool } from '../tools/RouteTool';
import { TerrainTool } from '../tools/TerrainTool';
import { DOCKED_MAX_HEIGHT } from '../ui/Sheet';
import { colors } from '../theme';
import { useBasemap } from './useBasemap';
import { useSavedCamera } from './useSavedCamera';

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	map: { flex: 1 },
});

const NO_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };
const TOOLS = { measure: MeasureTool, route: RouteTool, terrain: TerrainTool, coverage: CoverageTool };

export const MapScreen = () => {
	const insets = useSafeAreaInsets();
	const { height: windowHeight } = useWindowDimensions();
	const { settings, ready, update } = useSettings();
	const { nodes, byType, radioOptions, filtered } = useNodes();
	const config = useAppConfig();
	const { region } = settings;

	const cameraRef = useRef(null);
	const sourceRef = useRef(null);
	const pickerRef = useRef(null);
	const [selected, setSelected] = useState(null);
	const [sheet, setSheet] = useState(null);
	const [toolId, setToolId] = useState(null);
	const [toolsOpen, setToolsOpen] = useState(false);
	const [overlay, setOverlay] = useState(null);
	const [link, setLink] = useState(null);
	// The style that finished loading last and the number of successful loads. The native side drops layers that were queued for a style which never loaded (e.g. 403 before a fallback), so the layers mount only after a style is ready and are rebuilt for each new one.
	const [loadedStyle, setLoadedStyle] = useState({ style: null, epoch: 0 });

	const { basemaps, mapStyle, handleStyleFailed } = useBasemap({ config, settings, update });
	const mapStyleRef = useRef(mapStyle);
	mapStyleRef.current = mapStyle;
	// The layers belong to the style that loaded last. Once the style prop changes they are unmounted in that same render, before the native side swaps styles; removing their images from the new style afterwards only logs warnings.
	const styleEpoch = loadedStyle.style === mapStyle ? loadedStyle.epoch : 0;
	const { savedCamera, handleRegionDidChange } = useSavedCamera();
	const mapReady = ready && savedCamera !== undefined;

	const repeaters = useMemo(() => byType[2] ?? [], [byType]);
	const byKey = useMemo(() => new Map(nodes.map(node => [node.public_key, node])), [nodes]);

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
		if (!settings.rotateTilt) cameraRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 300 });
	}, [settings.rotateTilt]);

	// The node panel covers the bottom half of the screen, so the camera is padded to keep the node in the visible part of the map.
	const nodePadding = useMemo(() => ({ top: 0, left: 0, right: 0, bottom: windowHeight * DOCKED_MAX_HEIGHT }), [windowHeight]);
	const flyToNode = useCallback(node => cameraRef.current?.flyTo({ center: [node.lon, node.lat], zoom: 14, padding: nodePadding, duration: 800 }), [nodePadding]);
	const fitTo = useCallback(bounds => cameraRef.current?.fitBounds(bounds, { padding: { top: insets.top + 130, bottom: 360, left: 40, right: 40 }, duration: 600 }), [insets.top]);

	const closeSheet = useCallback(() => setSheet(null), []);
	const clearSelection = useCallback(() => setSelected(null), []);
	const handleStyleLoaded = useCallback(() => setLoadedStyle(current => ({ style: mapStyleRef.current, epoch: current.epoch + 1 })), []);
	const setPicker = useCallback(handlers => {
		pickerRef.current = handlers;
	}, []);

	const showNode = useCallback(node => {
		setSelected(node);
		flyToNode(node);
	}, [flyToNode]);

	const showRepeaters = useCallback(list => {
		setSheet(null);
		if (list.length) fitTo(boundsOf(list.map(node => ({ lat: node.lat, lng: node.lon }))));
	}, [fitTo]);

	const selectNodeFromStats = useCallback(node => {
		setSheet(null);
		showNode(node);
	}, [showNode]);

	// Stable handlers keep the memoised node layer from re-rendering on unrelated screen updates.
	const handleNodePress = useCallback(async event => {
		const feature = event.nativeEvent.features?.[0];
		if (!feature) return;

		event.stopPropagation?.();
		const { properties } = feature;

		if (properties.cluster) {
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

		setSelected(node);
		cameraRef.current?.easeTo({ center: [node.lon, node.lat], padding: nodePadding, duration: 400 });
	}, [byKey, nodePadding]);

	const handleMapPress = useCallback(event => {
		const [lng, lat] = event.nativeEvent.lngLat;
		if (pickerRef.current?.onMap) pickerRef.current.onMap({ lat, lng });
		else setSelected(null);
	}, []);

	// A link waits until the map is ready and, for a node, until that node is in the loaded data (it may still be downloading).
	useMapLink(setLink);
	useEffect(() => {
		if (!link || !mapReady) return;

		if (link.node) {
			const node = byKey.get(link.node);
			if (!node) return;

			showNode(node);
		} else {
			const { center, zoom } = toMaplibreView({ lat: link.view.lat, lon: link.view.lon, zoom: link.view.zoom ?? 13 });
			cameraRef.current?.flyTo({ center, zoom, padding: NO_PADDING, duration: 800 });
		}

		setLink(null);
	}, [link, mapReady, byKey, showNode]);

	const closeTool = useCallback(() => setToolId(null), []);
	const toggleTools = useCallback(() => setToolsOpen(open => !open), []);
	const openBasemapSheet = useCallback(() => setSheet('basemap'), []);
	const openLegendSheet = useCallback(() => setSheet('legend'), []);

	const openTool = useCallback(id => {
		setSelected(null);
		setToolsOpen(false);
		setToolId(id);
	}, []);

	const applyFilters = useCallback(filters => {
		update({ filters });
		if (settings.closeFiltersOnApply) setSheet(null);
	}, [update, settings.closeFiltersOnApply]);

	const selectBasemap = useCallback(name => {
		update({ basemap: name });
		setSheet(null);
	}, [update]);

	const toolContext = useMemo(() => ({ nodes, config, elevationSource: settings.elevationSource, coverageStyle: settings.coverageStyle, defaultRadio: SITES[region].defaultRadio, setOverlay, setPicker, fitTo, onClose: closeTool }), [nodes, config, settings.elevationSource, settings.coverageStyle, region, setPicker, fitTo, closeTool]);
	const ActiveTool = toolId ? TOOLS[toolId] : null;
	const view = DEFAULT_VIEW[region];

	return (
		<View style={styles.root}>
			{mapReady && (
				<MapView style={styles.map} mapStyle={mapStyle} onDidFinishLoadingStyle={handleStyleLoaded} touchRotate={settings.rotateTilt} touchPitch={settings.rotateTilt} onPress={handleMapPress} onRegionDidChange={handleRegionDidChange} onDidFailLoadingMap={handleStyleFailed}>
					<Camera ref={cameraRef} initialViewState={savedCamera ?? { center: view.center, zoom: view.zoom }} />
					{styleEpoch > 0 && <NodeLayer key={styleEpoch} scope={styleEpoch} nodes={filtered} selected={selected} clusteringZoom={settings.filters.clusteringZoom} sourceRef={sourceRef} onPress={handleNodePress} />}
					{styleEpoch > 0 && overlay && <OverlayLayer key={styleEpoch} scope={styleEpoch} features={overlay} />}
				</MapView>
			)}

			<TopBar nodes={filtered} filters={settings.filters} onSelectNode={showNode} onOpenSheet={setSheet} />

			{!ActiveTool && !selected && (
				<MapControls region={region} features={config?.features} toolsOpen={toolsOpen} onToggleTools={toggleTools} onOpenTool={openTool} onOpenBasemap={openBasemapSheet} onOpenLegend={openLegendSheet} />
			)}

			{ActiveTool && <ActiveTool ctx={toolContext} />}

			<NodeSheet node={selected && !toolId ? selected : null} onClose={clearSelection} />

			{sheet === 'filters' && (
				<FiltersSheet visible filters={settings.filters} byType={byType} radioOptions={radioOptions} total={nodes.length} onApply={applyFilters} onClose={closeSheet} />
			)}
			<StatsSheet visible={sheet === 'stats'} onClose={closeSheet} nodes={nodes} repeaters={repeaters} onSelectNode={selectNodeFromStats} onShowOnMap={showRepeaters} />
			<BasemapSheet visible={sheet === 'basemap'} onClose={closeSheet} basemaps={basemaps} selection={settings.basemap} onSelect={selectBasemap} />
			<LegendSheet visible={sheet === 'legend'} onClose={closeSheet} />
			<SettingsSheet visible={sheet === 'settings'} onClose={closeSheet} />
		</View>
	);
};
