import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, Map as MapView } from '@maplibre/maplibre-react-native';
import { SITES } from '@meshcore-map/core/sites';
import { BasemapSheet } from '../components/BasemapSheet';
import { FiltersSheet } from '../components/FiltersSheet';
import { FocusBanner } from '../components/FocusBanner';
import { LegendSheet } from '../components/LegendSheet';
import { MapAttribution } from '../components/MapAttribution';
import { MapControls } from '../components/MapControls';
import { useClientGlyphs } from '../components/clientGlyphs';
import { NodeLayer } from '../components/NodeLayer';
import { NodeSheet } from '../components/NodeSheet';
import { OverlayLayer } from '../components/OverlayLayer';
import { SettingsSheet } from '../components/SettingsSheet';
import { StatsSheet } from '../components/StatsSheet';
import { TopBar } from '../components/TopBar';
import { DEFAULT_VIEW } from '../config';
import { useAppConfig } from '../data/appConfig';
import { configureMapCache } from '../data/mapCache';
import { syncBugsnag } from '../bugsnag';
import { useNodes } from '../state/NodesContext';
import { useMapLink } from '../state/useMapLink';
import { useSettings } from '../state/SettingsContext';
import { CoverageTool } from '../tools/CoverageTool';
import { MeasureTool } from '../tools/MeasureTool';
import { RouteTool } from '../tools/RouteTool';
import { TerrainTool } from '../tools/TerrainTool';
import { colors } from '../theme';
import { useBasemap } from './useBasemap';
import { useMapCamera } from './useMapCamera';
import { useNodeSelection } from './useNodeSelection';
import { usePanels } from './usePanels';
import { useSavedCamera } from './useSavedCamera';
import { useStyleEpoch } from './useStyleEpoch';

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	map: { flex: 1 },
	// The native map is light until its style loads; this keeps the dark app background in the meantime.
	curtain: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg },
});

const TOOLS = { measure: MeasureTool, route: RouteTool, terrain: TerrainTool, coverage: CoverageTool };

export const MapScreen = () => {
	const { settings, ready, update } = useSettings();
	const { nodes, byType, radioOptions, filtered } = useNodes();
	const config = useAppConfig();
	const { region } = settings;

	const { basemaps, mapStyle, attribution, handleStyleFailed, selectBasemap: chooseBasemap, basemapView } = useBasemap({ config, settings, update });
	const { styleEpoch, handleStyleLoaded } = useStyleEpoch(mapStyle);
	const { savedCamera, handleRegionDidChange } = useSavedCamera();
	// The map waits for the app config (it carries the basemap keys) and for a style that is known to load, so it never starts on an empty or the wrong one.
	const mapReady = ready && savedCamera !== undefined && config !== null && mapStyle !== null;

	const camera = useMapCamera({ mapReady, region, rotateTilt: settings.rotateTilt });
	const { cameraRef, flyToView, fitTo, compassPosition } = camera;

	const repeaters = useMemo(() => byType[2] ?? [], [byType]);
	const byKey = useMemo(() => new Map(nodes.map(node => [node.public_key, node])), [nodes]);

	const { sourceRef, selected, focused, clearSelection, clearFocus, setPicker, showNode, focusNodes, handleNodePress, handleMapPress } = useNodeSelection({ cameraRef, byKey, camera });
	const { sheet, openSheet, closeSheet, openBasemapSheet, openLegendSheet, toolId, openTool, closeTool, toolsOpen, toggleTools } = usePanels({ onToolOpen: clearSelection });
	const [overlay, setOverlay] = useState(null);
	const glyphs = useClientGlyphs(focused ?? filtered);

	useMapLink({ ready: mapReady, byKey, onNode: showNode, onView: flyToView });

	useEffect(() => {
		configureMapCache();
	}, []);

	useEffect(() => {
		if (ready && config) syncBugsnag(config.bugsnagApiKey, settings.errorReporting);
	}, [ready, config, settings.errorReporting]);

	const showRepeaters = useCallback(list => {
		closeSheet();
		focusNodes(list);
	}, [closeSheet, focusNodes]);

	const selectNodeFromStats = useCallback(node => {
		closeSheet();
		showNode(node);
	}, [closeSheet, showNode]);

	const applyFilters = useCallback(filters => {
		update({ filters });
		if (settings.closeFiltersOnApply) closeSheet();
	}, [update, settings.closeFiltersOnApply, closeSheet]);

	const selectBasemap = useCallback(name => {
		chooseBasemap(name);
		closeSheet();
	}, [chooseBasemap, closeSheet]);

	const toolContext = useMemo(() => ({ nodes, config, elevationSource: settings.elevationSource, coverageStyle: settings.coverageStyle, defaultRadio: SITES[region].defaultRadio, setOverlay, setPicker, fitTo, onClose: closeTool }), [nodes, config, settings.elevationSource, settings.coverageStyle, region, setOverlay, setPicker, fitTo, closeTool]);
	const ActiveTool = toolId ? TOOLS[toolId] : null;
	const view = DEFAULT_VIEW[region];

	return (
		<View style={styles.root}>
			{mapReady && (
				<MapView style={styles.map} mapStyle={mapStyle} logo={false} attribution={false} compass={settings.rotateTilt} compassPosition={compassPosition} onDidFinishLoadingStyle={handleStyleLoaded} touchRotate={settings.rotateTilt} touchPitch={settings.rotateTilt} onPress={handleMapPress} onRegionDidChange={handleRegionDidChange} onDidFailLoadingMap={handleStyleFailed}>
					<Camera ref={cameraRef} initialViewState={savedCamera ?? { center: view.center, zoom: view.zoom }} />
					{styleEpoch > 0 && <NodeLayer key={`nodes-${styleEpoch}`} scope={styleEpoch} nodes={focused ?? filtered} glyphImages={glyphs.images} selected={selected} clusteringZoom={settings.filters.clusteringZoom} sourceRef={sourceRef} onPress={handleNodePress} />}
					{styleEpoch > 0 && overlay && <OverlayLayer key={`overlay-${styleEpoch}`} scope={styleEpoch} features={overlay} />}
				</MapView>
			)}
			{glyphs.rasterizer}
			{mapReady && styleEpoch === 0 && <View pointerEvents="none" style={styles.curtain} />}
			{mapReady && <MapAttribution html={attribution} />}

			{focused && <FocusBanner count={focused.length} onClose={clearFocus} />}

			<TopBar nodes={filtered} filters={settings.filters} onSelectNode={showNode} onOpenSheet={openSheet} />

			{!ActiveTool && !selected && (
				<MapControls region={region} showAddButton={settings.showAddButton} features={config?.features} toolsOpen={toolsOpen} onToggleTools={toggleTools} onOpenTool={openTool} onOpenBasemap={openBasemapSheet} onOpenLegend={openLegendSheet} />
			)}

			{ActiveTool && <ActiveTool ctx={toolContext} />}

			<NodeSheet node={selected && !toolId ? selected : null} onClose={clearSelection} />

			{sheet === 'filters' && (
				<FiltersSheet visible filters={settings.filters} byType={byType} radioOptions={radioOptions} total={nodes.length} onApply={applyFilters} onClose={closeSheet} />
			)}
			<StatsSheet visible={sheet === 'stats'} onClose={closeSheet} nodes={nodes} repeaters={repeaters} onSelectNode={selectNodeFromStats} onShowOnMap={showRepeaters} />
			<BasemapSheet visible={sheet === 'basemap'} onClose={closeSheet} basemaps={basemaps} view={basemapView} onSelect={selectBasemap} />
			<LegendSheet visible={sheet === 'legend'} onClose={closeSheet} />
			<SettingsSheet visible={sheet === 'settings'} onClose={closeSheet} />
		</View>
	);
};
