import { memo, useMemo } from 'react';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { getColourForName } from '@meshcore-map/core/node-utils';
import { colors, statusColors, typeColors } from '../theme';

const featureCache = new WeakMap();

// GeoJSON feature built once per node, so changing filters does not recompute colours and coordinates.
const toFeature = node => {
	let feature = featureCache.get(node);
	if (!feature) {
		feature = {
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [node.lon, node.lat] },
			properties: {
				key: node.public_key,
				type: node.type,
				status: node.status,
				color: node.type === 1 ? getColourForName(node.adv_name) : statusColors[node.status],
			},
		};
		featureCache.set(node, feature);
	}

	return feature;
};

const byType = (values, fallback) => ['match', ['get', 'type'], 1, values[1], 2, values[2], 3, values[3], 4, values[4], fallback];

const CLUSTER_PAINT = {
	'circle-color': colors.blue,
	'circle-opacity': 0.85,
	'circle-radius': ['step', ['get', 'point_count'], 16, 50, 20, 500, 26],
	'circle-stroke-width': 2,
	'circle-stroke-color': '#fff',
};

const CLUSTER_LABEL_LAYOUT = {
	'text-field': ['get', 'point_count_abbreviated'],
	'text-font': ['Noto Sans Regular'],
	'text-size': 13,
	'text-allow-overlap': true,
};

const POINT_PAINT = {
	'circle-color': ['get', 'color'],
	'circle-radius': byType({ 1: 6, 2: 8, 3: 8, 4: 7 }, 7),
	'circle-stroke-width': 2,
	'circle-stroke-color': byType(typeColors, '#fff'),
	'circle-opacity': ['case', ['==', ['get', 'status'], 'extinct'], 0.55, 1],
};

const HIGHLIGHT_PAINT = {
	'circle-color': 'rgba(0, 0, 0, 0)',
	'circle-radius': 17,
	'circle-stroke-width': 3,
	'circle-stroke-color': colors.green,
};

// Clustering is disabled from zoom clusteringZoom upwards (like disableClusteringAtZoom on the web).
export const NodeLayer = memo(({ nodes, selected, clusteringZoom, sourceRef, onPress }) => {
	const data = useMemo(() => ({ type: 'FeatureCollection', features: nodes.map(toFeature) }), [nodes]);
	const highlight = useMemo(() => ({ type: 'FeatureCollection', features: selected ? [toFeature(selected)] : [] }), [selected]);

	return (
		<>
			<GeoJSONSource id="nodes" ref={sourceRef} data={data} cluster clusterRadius={50} clusterMaxZoom={clusteringZoom - 1} onPress={onPress}>
				<Layer id="node-clusters" type="circle" filter={['has', 'point_count']} paint={CLUSTER_PAINT} />
				<Layer id="node-cluster-count" type="symbol" filter={['has', 'point_count']} layout={CLUSTER_LABEL_LAYOUT} paint={{ 'text-color': '#fff' }} />
				<Layer id="node-points" type="circle" filter={['!', ['has', 'point_count']]} paint={POINT_PAINT} />
			</GeoJSONSource>
			<GeoJSONSource id="node-selected" data={highlight}>
				<Layer id="node-selected-ring" type="circle" paint={HIGHLIGHT_PAINT} />
			</GeoJSONSource>
		</>
	);
});
