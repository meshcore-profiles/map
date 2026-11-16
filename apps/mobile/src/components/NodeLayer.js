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

// GeoJSON feature built once per node, so changing filters does not recompute labels, colors and coordinates.
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

// MapLibre Native's own point_count_abbreviated prints fractions such as "40.877000k", so the abbreviation is built here: 999, 1.2K, 41K, 1.5M.
const COUNT = ['get', 'point_count'];
const tenths = divisor => ['/', ['round', ['/', COUNT, divisor / 10]], 10];
const CLUSTER_COUNT_LABEL = ['case',
	['>=', COUNT, 1000000], ['concat', ['to-string', tenths(1000000)], 'M'],
	['>=', COUNT, 10000], ['concat', ['to-string', ['round', ['/', COUNT, 1000]]], 'K'],
	['>=', COUNT, 1000], ['concat', ['to-string', tenths(1000)], 'K'],
	['to-string', COUNT],
];

const CLUSTER_LABEL_LAYOUT = {
	'text-field': CLUSTER_COUNT_LABEL,
	'text-font': ['Noto Sans Bold'],
	'text-size': 13,
	'text-allow-overlap': true,
};

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
