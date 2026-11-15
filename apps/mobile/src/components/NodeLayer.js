import { memo, useMemo } from 'react';
import { GeoJSONSource, Images, Layer } from '@maplibre/maplibre-react-native';
import { getColourForName, getNameIconLabel } from '@meshcore-map/core/node-utils';
import { useTheme } from '../state/ThemeContext';
import { NODE_TYPE_ICON_NAMES } from '@meshcore-map/core/colors';
import { NODE_IMAGES } from './nodeImages';

const featureCache = new WeakMap();

// Letters the map's glyph font covers. Anything else (emoji, symbols, other scripts) would draw an empty disc, so it gets the person glyph instead.
const TEXT_LABEL = /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\p{N}]+$/u;
const CLIENT_GLYPH = 'client-glyph';

const clientLabel = name => {
	const label = getNameIconLabel(name);
	return TEXT_LABEL.test(label) ? label : '';
};

// GeoJSON feature built once per node, so changing filters does not recompute labels, colours and coordinates.
const toFeature = node => {
	let feature = featureCache.get(node);
	if (!feature) {
		const isClient = node.type === 1;
		const label = isClient ? clientLabel(node.adv_name) : '';
		feature = {
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [node.lon, node.lat] },
			properties: {
				key: node.public_key,
				type: node.type,
				icon: isClient ? (label ? '' : CLIENT_GLYPH) : `${NODE_TYPE_ICON_NAMES[node.type]}-${node.status}`,
				color: isClient ? getColourForName(node.adv_name) : '',
				label,
			},
		};
		featureCache.set(node, feature);
	}

	return feature;
};

// Same look as the website's marker clusters: translucent halo around a stronger disc, in the theme's accent colour.
const createThemedPaints = ({ accent, accentBright }) => ({
	clusterHalo: {
		'circle-color': accent,
		'circle-opacity': 0.3,
		'circle-radius': ['step', ['get', 'point_count'], 22, 50, 27, 500, 33],
	},
	cluster: {
		'circle-color': accent,
		'circle-opacity': ['step', ['get', 'point_count'], 0.65, 50, 0.78, 500, 0.9],
		'circle-radius': ['step', ['get', 'point_count'], 16, 50, 20, 500, 25],
	},
	highlight: {
		'circle-color': 'rgba(0, 0, 0, 0)',
		'circle-radius': 20,
		'circle-stroke-width': 3,
		'circle-stroke-color': accentBright,
	},
});

const CLUSTERS = ['has', 'point_count'];
const IS_CLIENT = ['==', ['get', 'type'], 1];
const CLIENTS = ['all', ['!', CLUSTERS], IS_CLIENT];
const ICONS = ['all', ['!', CLUSTERS], ['!=', ['get', 'icon'], '']];

const CLUSTER_LABEL_LAYOUT = {
	'text-field': ['get', 'point_count_abbreviated'],
	'text-font': ['Noto Sans Bold'],
	'text-size': 13,
	'text-allow-overlap': true,
};

// Clients: coloured disc (hash of the name) with the name's initial or emoji, like the website.
const CLIENT_PAINT = {
	'circle-color': ['get', 'color'],
	'circle-radius': 13,
};

const CLIENT_LABEL_LAYOUT = {
	'text-field': ['get', 'label'],
	'text-font': ['Noto Sans Bold'],
	'text-size': 14,
	'text-allow-overlap': true,
	'text-ignore-placement': true,
};

const BADGE_LAYOUT = {
	'icon-image': ['get', 'icon'],
	'icon-size': ['case', IS_CLIENT, 0.2, 0.34],
	'icon-allow-overlap': true,
	'icon-ignore-placement': true,
};

const WHITE = { 'text-color': '#fff' };

// Clustering is disabled from zoom clusteringZoom upwards (like disableClusteringAtZoom on the web).
// scope: unique per loaded style, so a freshly mounted copy never shares source or layer ids with the previous one (the native side would drop them together).
export const NodeLayer = memo(({ scope, nodes, selected, clusteringZoom, sourceRef, onPress }) => {
	const theme = useTheme();
	const data = useMemo(() => ({ type: 'FeatureCollection', features: nodes.map(toFeature) }), [nodes]);
	const paints = useMemo(() => createThemedPaints(theme), [theme]);
	const highlight = useMemo(() => ({ type: 'FeatureCollection', features: selected ? [toFeature(selected)] : [] }), [selected]);

	return (
		<>
			<Images images={NODE_IMAGES} />
			<GeoJSONSource id={`nodes-${scope}`} ref={sourceRef} data={data} cluster clusterRadius={50} clusterMaxZoom={clusteringZoom - 1} onPress={onPress}>
				<Layer id={`node-clusters-halo-${scope}`} type="circle" filter={CLUSTERS} paint={paints.clusterHalo} />
				<Layer id={`node-clusters-${scope}`} type="circle" filter={CLUSTERS} paint={paints.cluster} />
				<Layer id={`node-cluster-count-${scope}`} type="symbol" filter={CLUSTERS} layout={CLUSTER_LABEL_LAYOUT} paint={WHITE} />
				<Layer id={`node-clients-${scope}`} type="circle" filter={CLIENTS} paint={CLIENT_PAINT} />
				<Layer id={`node-clients-label-${scope}`} type="symbol" filter={CLIENTS} layout={CLIENT_LABEL_LAYOUT} paint={WHITE} />
				<Layer id={`node-badges-${scope}`} type="symbol" filter={ICONS} layout={BADGE_LAYOUT} />
			</GeoJSONSource>
			<GeoJSONSource id={`node-selected-${scope}`} data={highlight}>
				<Layer id={`node-selected-ring-${scope}`} type="circle" paint={paints.highlight} />
			</GeoJSONSource>
		</>
	);
});
