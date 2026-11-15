import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { truncateKey } from '@meshcore-map/core/node-utils';
import { loadNodes } from './src/nodes';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const API_BASE = Constants.expoConfig.extra.apiBase;

const toGeoJson = nodes => ({
	type: 'FeatureCollection',
	features: nodes.map(n => ({
		type: 'Feature',
		geometry: { type: 'Point', coordinates: [n.lon, n.lat] },
		properties: { name: n.adv_name, key: n.public_key, type: n.type },
	})),
});

const styles = StyleSheet.create({
	container: { flex: 1 },
	map: { flex: 1 },
	loading: { position: 'absolute', top: 60, alignSelf: 'center' },
	error: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: '#fff', padding: 8 },
	card: { position: 'absolute', bottom: 32, left: 16, right: 16, backgroundColor: '#fff', padding: 12, borderRadius: 8 },
	cardTitle: { fontWeight: '700', marginBottom: 4 },
});

export default function App() {
	const [nodes, setNodes] = useState(null);
	const [error, setError] = useState(null);
	const [selected, setSelected] = useState(null);

	useEffect(() => {
		loadNodes(API_BASE, 'all').then(setNodes).catch(err => setError(String(err.message || err)));
	}, []);

	const data = useMemo(() => nodes && toGeoJson(nodes), [nodes]);

	return (
		<View style={styles.container}>
			<Map style={styles.map} mapStyle={MAP_STYLE}>
				<Camera initialViewState={{ center: [19.4, 52.1], zoom: 5 }} />
				{data && (
					<GeoJSONSource
						id="nodes"
						data={data}
						cluster
						clusterRadius={50}
						clusterMaxZoom={11}
						onPress={e => {
							const props = e.nativeEvent?.features?.[0]?.properties;
							if (props?.key) setSelected(props);
						}}
					>
						<Layer id="clusters" type="circle" filter={['has', 'point_count']} paint={{ 'circle-color': '#4dabf7', 'circle-radius': 16, 'circle-opacity': 0.8 }} />
						<Layer id="points" type="circle" filter={['!', ['has', 'point_count']]} paint={{ 'circle-color': '#2dd881', 'circle-radius': 6, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }} />
					</GeoJSONSource>
				)}
			</Map>
			{!nodes && !error && <ActivityIndicator style={styles.loading} size="large" />}
			{error && <Text style={styles.error}>{error}</Text>}
			{selected && (
				<View style={styles.card}>
					<Text style={styles.cardTitle}>{selected.name}</Text>
					<Text>{truncateKey(selected.key)}</Text>
				</View>
			)}
			<StatusBar style="auto" />
		</View>
	);
}
