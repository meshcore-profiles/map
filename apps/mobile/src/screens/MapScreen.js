import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Camera, Map as MapView } from '@maplibre/maplibre-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_BASEMAP_SELECTION } from '@meshcore-map/core/basemaps';
import { SITES } from '@meshcore-map/core/sites';
import { createDefaultFilters } from '@meshcore-map/core/nodes';
import { FiltersSheet } from '../components/FiltersSheet';
import { NodeLayer } from '../components/NodeLayer';
import { NodeSheet } from '../components/NodeSheet';
import { OverlayLayer } from '../components/OverlayLayer';
import { RegionPrompt } from '../components/RegionPrompt';
import { SearchBar } from '../components/SearchBar';
import { SettingsSheet } from '../components/SettingsSheet';
import { BrandButton } from '../components/BrandButton';
import { BasemapSheet } from '../components/BasemapSheet';
import { QuickChips } from '../components/QuickChips';
import { StatsSheet } from '../components/StatsSheet';
import { boundsOf } from '../tools/pathFeatures';
import { StatusBanner } from '../components/StatusBanner';
import { DEFAULT_VIEW } from '../config';
import { useAppConfig } from '../data/appConfig';
import { createBasemaps } from '../data/basemaps';
import { useI18n } from '../i18n';
import { useNodes } from '../state/NodesContext';
import { useSettings } from '../state/SettingsContext';
import { CoverageTool } from '../tools/CoverageTool';
import { MeasureTool } from '../tools/MeasureTool';
import { RouteTool } from '../tools/RouteTool';
import { TerrainTool } from '../tools/TerrainTool';
import { Fab, FAB_SIZE } from '../ui/Fab';
import { useToast } from '../ui/Toast';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../ui/Icon';
import { colors, MIN_TOUCH, spacing } from '../theme';

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	map: { flex: 1 },
	topBar: { position: 'absolute', left: spacing.md, right: spacing.md },
	barButton: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
	activeDot: { position: 'absolute', top: 9, right: 9, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: colors.panelSolid },
	fabStack: { position: 'absolute', right: spacing.md, alignItems: 'center', gap: spacing.sm },
	bottom: { position: 'absolute', left: spacing.md },
});

const TOOL_FABS = [
	{ id: 'terrain', icon: 'terrain', title: 'terrain:toggleTitle' },
	{ id: 'coverage', icon: 'coverage', title: 'coverage:toggleTitle' },
	{ id: 'route', icon: 'route', title: 'route:toggleTitle' },
	{ id: 'measure', icon: 'ruler', title: 'measure:toggleTitle' },
];

const TOOLS = { measure: MeasureTool, route: RouteTool, terrain: TerrainTool, coverage: CoverageTool };

const filtersActive = filters => {
	const defaults = createDefaultFilters();
	return filters.nodeFilter.length !== defaults.nodeFilter.length
		|| Boolean(filters.fromDate)
		|| Boolean(filters.fromInsertDate)
		|| Object.values(filters.radioFilters).some(selection => selection !== null);
};

export const MapScreen = () => {
	const { t } = useI18n();
	const showToast = useToast();
	const insets = useSafeAreaInsets();
	const { settings, ready, update } = useSettings();
	const { accentBright } = useTheme();
	const filtersOn = useMemo(() => filtersActive(settings.filters), [settings.filters]);
	const { nodes, byType, radioOptions, filtered } = useNodes();
	const config = useAppConfig();

	const cameraRef = useRef(null);
	const sourceRef = useRef(null);
	const pickerRef = useRef(null);
	const [selected, setSelected] = useState(null);
	const [sheet, setSheet] = useState(null);
	const [toolId, setToolId] = useState(null);
	const [toolsOpen, setToolsOpen] = useState(false);
	const [overlay, setOverlay] = useState(null);

	const basemaps = useMemo(() => createBasemaps(config?.basemaps, settings.region ?? 'all'), [config, settings.region]);
	const [fallbackName, setFallbackName] = useState(null);
	const selectedName = basemaps.resolve(settings.basemap);
	const available = basemaps.byName(selectedName) ? selectedName : basemaps.defaultName;
	const activeName = fallbackName && basemaps.byName(fallbackName) ? fallbackName : available;
	const activeBasemap = basemaps.byName(activeName);
	// The style object is rebuilt whenever the app config arrives; comparing its serialised form keeps the map from reloading an identical style.
	const styleKey = typeof activeBasemap.style === 'string' ? activeBasemap.style : JSON.stringify(activeBasemap.style);
	const mapStyle = useMemo(() => activeBasemap.style, [styleKey]);
	// A style load clears every source and layer added on top, so the layers are mounted again once it finished.
	const [styleEpoch, setStyleEpoch] = useState(0);

	useEffect(() => {
		setFallbackName(null);
	}, [settings.basemap, settings.region]);

	useEffect(() => {
		if (config && basemaps.isMissingKey(settings.basemap)) {
			showToast(t('map:basemapMissingApiKey', { name: settings.basemap }), { status: 'error', duration: 6000 });
			update({ basemap: DEFAULT_BASEMAP_SELECTION });
		}
	}, [config, basemaps, settings.basemap, showToast, t, update]);

	const handleBasemapFailed = useCallback(() => {
		const next = basemaps.nextFallback(activeName);
		if (!next) return;

		showToast(t('map:basemapFallback', { failed: activeName, fallback: next }), { status: 'error', duration: 6000 });
		setFallbackName(next);
	}, [basemaps, activeName, showToast, t]);

	const repeaters = useMemo(() => byType[2] ?? [], [byType]);
	const byKey = useMemo(() => new Map(nodes.map(node => [node.public_key, node])), [nodes]);

	useEffect(() => {
		if (!settings.region) return;

		const view = DEFAULT_VIEW[settings.region];
		cameraRef.current?.flyTo({ center: view.center, zoom: view.zoom, duration: 800 });
	}, [settings.region]);

	const flyToNode = useCallback(node => cameraRef.current?.flyTo({ center: [node.lon, node.lat], zoom: 14, duration: 800 }), []);

	const fitTo = useCallback(bounds => cameraRef.current?.fitBounds(bounds, { padding: { top: insets.top + 130, bottom: 360, left: 40, right: 40 }, duration: 600 }), [insets.top]);


	const showRepeaters = useCallback(list => {
		setSheet(null);
		if (list.length) fitTo(boundsOf(list.map(node => ({ lat: node.lat, lng: node.lon }))));
	}, [fitTo]);

	const setPicker = useCallback(handlers => {
		pickerRef.current = handlers;
	}, []);

	const showNode = useCallback(node => {
		setSelected(node);
		flyToNode(node);
	}, [flyToNode]);

	const handleNodePress = async event => {
		const feature = event.nativeEvent.features?.[0];
		if (!feature) return;

		event.stopPropagation?.();
		const { properties } = feature;

		if (properties.cluster) {
			const zoom = await sourceRef.current?.getClusterExpansionZoom(properties.cluster_id);
			const [lng, lat] = feature.geometry.coordinates;
			if (zoom != null) cameraRef.current?.flyTo({ center: [lng, lat], zoom: zoom + 0.5, duration: 500 });
			return;
		}

		const node = byKey.get(properties.key);
		if (!node) return;

		if (pickerRef.current?.onNode) pickerRef.current.onNode(node);
		else setSelected(node);
	};

	const handleMapPress = event => {
		const [lng, lat] = event.nativeEvent.lngLat;
		if (pickerRef.current?.onMap) pickerRef.current.onMap({ lat, lng });
		else setSelected(null);
	};

	const closeTool = useCallback(() => setToolId(null), []);

	const openTool = id => {
		setSelected(null);
		setToolsOpen(false);
		setToolId(id);
	};

	const toolContext = useMemo(() => ({ nodes, config, setOverlay, setPicker, fitTo, onClose: closeTool }), [nodes, config, setPicker, fitTo, closeTool]);
	const ActiveTool = toolId ? TOOLS[toolId] : null;

	const view = DEFAULT_VIEW[settings.region ?? 'all'];

	return (
		<View style={styles.root}>
			<MapView style={styles.map} mapStyle={mapStyle} onDidFinishLoadingStyle={() => setStyleEpoch(epoch => epoch + 1)} onPress={handleMapPress} onDidFailLoadingMap={handleBasemapFailed}>
				<Camera ref={cameraRef} initialViewState={{ center: view.center, zoom: view.zoom }} />
				<NodeLayer key={`nodes-${styleEpoch}`} nodes={filtered} selected={selected} clusteringZoom={settings.filters.clusteringZoom} sourceRef={sourceRef} onPress={handleNodePress} />
				{overlay && <OverlayLayer key={`overlay-${styleEpoch}`} features={overlay} />}
			</MapView>

			<View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
				<SearchBar nodes={filtered} onSelect={showNode} leading={<BrandButton onPress={() => setSheet('settings')} />}>
					<Pressable style={styles.barButton} onPress={() => setSheet('filters')} accessibilityRole="button" accessibilityLabel={t('filters:toggleTitle')}>
						<Icon name="filter" size={22} color={filtersOn ? accentBright : colors.text} />
						{filtersOn && <View style={[styles.activeDot, { backgroundColor: accentBright }]} />}
					</Pressable>
				</SearchBar>
				<QuickChips nodes={filtered} onStats={() => setSheet('stats')} />
			</View>

			{!ActiveTool && (
				<>
					<View style={[styles.fabStack, { bottom: insets.bottom + spacing.md }]}>
						{toolsOpen && TOOL_FABS.filter(tool => config?.features?.[tool.id] !== false).map(tool => (
							<Fab key={tool.id} icon={tool.icon} label={t(tool.title)} onPress={() => openTool(tool.id)} />
						))}
						<Fab icon={toolsOpen ? 'close' : 'ruler'} label={t('mobile:tools.title')} onPress={() => setToolsOpen(open => !open)} />
						<Fab icon="layers" label={t('map:basemapToggleTitle')} onPress={() => setSheet('basemap')} />
						<Fab primary icon="plus" label={t('map:addNodeTitle')} onPress={() => Linking.openURL(SITES[settings.region ?? 'all'].addNodeUrl)} />
					</View>
					<View style={[styles.bottom, { bottom: insets.bottom + spacing.md, right: spacing.md * 2 + FAB_SIZE }]}>
						<StatusBanner />
					</View>
				</>
			)}

			{ActiveTool && <ActiveTool ctx={toolContext} />}

			<NodeSheet node={selected && !toolId ? selected : null} onClose={() => setSelected(null)} />

			{sheet === 'filters' && (
				<FiltersSheet
					visible
					filters={settings.filters}
					byType={byType}
					radioOptions={radioOptions}
					total={nodes.length}
					onApply={filters => {
						update({ filters });
						setSheet(null);
					}}
					onClose={() => setSheet(null)}
				/>
			)}
			<StatsSheet visible={sheet === 'stats'} onClose={() => setSheet(null)} nodes={nodes} repeaters={repeaters} onSelectNode={node => { setSheet(null); showNode(node); }} onShowOnMap={showRepeaters} />
			<BasemapSheet visible={sheet === 'basemap'} onClose={() => setSheet(null)} basemaps={basemaps} selection={settings.basemap} onSelect={name => { update({ basemap: name }); setSheet(null); }} />
			<SettingsSheet visible={sheet === 'settings'} onClose={() => setSheet(null)} />
			<RegionPrompt visible={ready && !settings.region} />
		</View>
	);
};
