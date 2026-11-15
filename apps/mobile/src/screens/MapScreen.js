import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Map as MapView } from '@maplibre/maplibre-react-native';
import { createDefaultFilters } from '@meshcore-map/core/nodes';
import { FiltersSheet } from '../components/FiltersSheet';
import { NodeLayer } from '../components/NodeLayer';
import { NodeSheet } from '../components/NodeSheet';
import { OverlayLayer } from '../components/OverlayLayer';
import { RegionPrompt } from '../components/RegionPrompt';
import { SearchBar } from '../components/SearchBar';
import { SettingsSheet } from '../components/SettingsSheet';
import { StatusBanner } from '../components/StatusBanner';
import { ToolsSheet } from '../components/ToolsSheet';
import { DEFAULT_VIEW, MAP_STYLE } from '../config';
import { useAppConfig } from '../data/appConfig';
import { useInsets } from '../hooks/useInsets';
import { useI18n } from '../i18n';
import { useNodes } from '../state/NodesContext';
import { useSettings } from '../state/SettingsContext';
import { CoverageTool } from '../tools/CoverageTool';
import { MeasureTool } from '../tools/MeasureTool';
import { RouteTool } from '../tools/RouteTool';
import { TerrainTool } from '../tools/TerrainTool';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	map: { flex: 1 },
	topBar: { position: 'absolute', left: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
	roundButton: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.md, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center', elevation: 4 },
	roundButtonText: { color: colors.text, fontSize: 20 },
	pills: { position: 'absolute', right: spacing.md, gap: spacing.sm, alignItems: 'flex-end' },
	pill: { minHeight: MIN_TOUCH, paddingHorizontal: spacing.lg, borderRadius: 22, backgroundColor: colors.panel, justifyContent: 'center', elevation: 4 },
	pillActive: { backgroundColor: colors.blue },
	pillText: { color: colors.text, fontWeight: '600' },
	pillTextActive: { color: '#0b0e14' },
	bottom: { position: 'absolute', left: spacing.md, right: spacing.md },
});

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
	const insets = useInsets();
	const { settings, ready, update } = useSettings();
	const { nodes, byType, radioOptions, filtered } = useNodes();
	const config = useAppConfig();

	const cameraRef = useRef(null);
	const sourceRef = useRef(null);
	const pickerRef = useRef(null);
	const [selected, setSelected] = useState(null);
	const [sheet, setSheet] = useState(null);
	const [toolId, setToolId] = useState(null);
	const [overlay, setOverlay] = useState(null);

	const byKey = useMemo(() => new Map(nodes.map(node => [node.public_key, node])), [nodes]);

	useEffect(() => {
		if (!settings.region) return;

		const view = DEFAULT_VIEW[settings.region];
		cameraRef.current?.flyTo({ center: view.center, zoom: view.zoom, duration: 800 });
	}, [settings.region]);

	const flyToNode = useCallback(node => cameraRef.current?.flyTo({ center: [node.lon, node.lat], zoom: 14, duration: 800 }), []);

	const fitTo = useCallback(bounds => cameraRef.current?.fitBounds(bounds, { padding: { top: insets.top + 80, bottom: 360, left: 40, right: 40 }, duration: 600 }), [insets.top]);

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

	const toolContext = useMemo(() => ({ nodes, config, setOverlay, setPicker, fitTo, onClose: closeTool }), [nodes, config, setPicker, fitTo, closeTool]);
	const ActiveTool = toolId ? TOOLS[toolId] : null;

	const view = DEFAULT_VIEW[settings.region ?? 'all'];

	return (
		<View style={styles.root}>
			<MapView style={styles.map} mapStyle={MAP_STYLE} onPress={handleMapPress}>
				<Camera ref={cameraRef} initialViewState={{ center: view.center, zoom: view.zoom }} />
				<NodeLayer nodes={filtered} selected={selected} clusteringZoom={settings.filters.clusteringZoom} sourceRef={sourceRef} onPress={handleNodePress} />
				{overlay && <OverlayLayer features={overlay} />}
			</MapView>

			<View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
				<SearchBar nodes={filtered} onSelect={showNode} />
				<Pressable style={styles.roundButton} onPress={() => setSheet('settings')} accessibilityRole="button" accessibilityLabel={t('mobile:settings.title')}>
					<Text style={styles.roundButtonText}>⚙</Text>
				</Pressable>
			</View>

			{!ActiveTool && (
				<>
					<View style={[styles.pills, { bottom: insets.bottom + 72 }]}>
						<Pressable style={[styles.pill, filtersActive(settings.filters) && styles.pillActive]} onPress={() => setSheet('filters')} accessibilityRole="button">
							<Text style={[styles.pillText, filtersActive(settings.filters) && styles.pillTextActive]}>{t('filters:title')}</Text>
						</Pressable>
						<Pressable style={styles.pill} onPress={() => setSheet('tools')} accessibilityRole="button">
							<Text style={styles.pillText}>{t('mobile:tools.title')}</Text>
						</Pressable>
					</View>
					<View style={[styles.bottom, { bottom: insets.bottom + spacing.sm }]}>
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
			<SettingsSheet visible={sheet === 'settings'} onClose={() => setSheet(null)} />
			<ToolsSheet
				visible={sheet === 'tools'}
				features={config?.features}
				onSelect={id => {
					setSheet(null);
					setSelected(null);
					setToolId(id);
				}}
				onClose={() => setSheet(null)}
			/>
			<RegionPrompt visible={ready && !settings.region} />
		</View>
	);
};
