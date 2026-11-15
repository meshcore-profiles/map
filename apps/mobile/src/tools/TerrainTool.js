import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDistance, haversineDistance, parseLatLng } from '@meshcore-map/core/geo';
import { analyzeLineOfSight, clearanceAt, sampleLine } from '@meshcore-map/core/los';
import { resolveNodeByQuery } from '@meshcore-map/core/node-utils';
import { getElevations } from '../data/appConfig';
import { useI18n } from '../i18n';
import { Button, Field, Hint, Stat } from '../ui/controls';
import { ToolPanel } from '../ui/ToolPanel';
import { colors, radius, spacing } from '../theme';
import { boundsOf, buildPathFeatures } from './pathFeatures';

const SAMPLE_COUNT = 48;
const CHART_HEIGHT = 110;
const COLOR = '#f2b134';

const styles = StyleSheet.create({
	pointRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
	pointField: { flex: 1 },
	pickButton: { minWidth: 96 },
	heights: { flexDirection: 'row', gap: spacing.sm },
	heightField: { flex: 1 },
	actions: { flexDirection: 'row', gap: spacing.sm },
	action: { flex: 1 },
	stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
	chart: { height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 1, backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.xs },
	bar: { flex: 1, minHeight: 2 },
	legend: { flexDirection: 'row', justifyContent: 'space-between' },
	legendText: { color: colors.textMuted, fontWeight: '700' },
	error: { color: colors.redBright },
});

const ElevationProfile = ({ result }) => {
	const { elevations, distances, total, elevA, elevB } = result;
	const lo = Math.min(...elevations, elevA, elevB);
	const hi = Math.max(...elevations, elevA, elevB);
	const span = Math.max(hi - lo, 1);

	return (
		<View style={styles.chart} accessibilityRole="image">
			{elevations.map((elevation, i) => {
				const blocked = clearanceAt({ elevation, d: distances[i], total, elevA, elevB }) < 0;
				return <View key={i} style={[styles.bar, { height: ((elevation - lo) / span) * (CHART_HEIGHT - 8) + 2, backgroundColor: blocked ? colors.redBright : colors.textMuted }]} />;
			})}
		</View>
	);
};

export const TerrainTool = ({ ctx }) => {
	const { t } = useI18n();
	const { nodes, config, setOverlay, setPicker, fitTo, onClose } = ctx;
	const [points, setPoints] = useState({ a: null, b: null });
	const [texts, setTexts] = useState({ a: '', b: '' });
	const [heights, setHeights] = useState({ a: '2', b: '2' });
	const [picking, setPicking] = useState(null);
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState(null);
	const [error, setError] = useState(null);

	const setPoint = (key, point) => {
		setPoints(current => ({ ...current, [key]: point }));
		setTexts(current => ({ ...current, [key]: point.label ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` }));
		setResult(null);
	};

	useEffect(() => {
		if (!picking) {
			setPicker(null);
			return;
		}

		const done = point => {
			setPoint(picking, point);
			setPicking(current => current === 'a' ? 'b' : null);
		};
		setPicker({
			onMap: ({ lat, lng }) => done({ lat, lng, label: null }),
			onNode: node => done({ lat: node.lat, lng: node.lon, label: node.adv_name }),
		});
	}, [picking, setPicker]);

	useEffect(() => () => {
		setPicker(null);
		setOverlay(null);
	}, [setOverlay, setPicker]);

	useEffect(() => {
		const list = [points.a && { ...points.a, label: 'A' }, points.b && { ...points.b, label: 'B' }].filter(Boolean);
		setOverlay(buildPathFeatures(list, { color: COLOR, labelFor: p => p.label, segmentLabels: false }));
	}, [points, setOverlay]);

	const syncFromText = key => {
		const text = texts[key];
		const coords = parseLatLng(text);
		if (coords) return setPoint(key, { ...coords, label: null });

		const node = resolveNodeByQuery(text, nodes);
		if (node) setPoint(key, { lat: node.lat, lng: node.lon, label: node.adv_name });
	};

	const analyze = async () => {
		if (!points.a || !points.b) return setError(t('terrain:selectBothPoints'));
		if (haversineDistance(points.a, points.b) < 10) return setError(t('terrain:pointsTooClose'));

		setBusy(true);
		setError(null);
		try {
			const samplePoints = sampleLine(points.a, points.b, SAMPLE_COUNT);
			const elevations = await getElevations(config.sefinekApi, samplePoints);
			const analysis = analyzeLineOfSight({ pointA: points.a, samplePoints, elevations, heightA: Number(heights.a) || 0, heightB: Number(heights.b) || 0 });
			setResult({ ...analysis, elevations });
			fitTo(boundsOf([points.a, points.b]));
		} catch (err) {
			console.error('Terrain analysis failed:', err);
			setError(t('terrain:fetchElevationFailed'));
		} finally {
			setBusy(false);
		}
	};

	const reset = () => {
		setPicking(null);
		setPoints({ a: null, b: null });
		setTexts({ a: '', b: '' });
		setResult(null);
		setError(null);
	};

	const renderPoint = key => (
		<View style={styles.pointRow}>
			<View style={styles.pointField}>
				<Field label={key.toUpperCase()} value={texts[key]} onChangeText={text => setTexts(current => ({ ...current, [key]: text }))} onEndEditing={() => syncFromText(key)} placeholder={t('terrain:nodeNamePlaceholder')} />
			</View>
			<Button style={styles.pickButton} variant={picking === key ? 'primary' : 'secondary'} label={picking === key ? t('mobile:tools.picking') : t('terrain:pickOnMap')} onPress={() => setPicking(picking === key ? null : key)} />
		</View>
	);

	const unavailable = !config?.features?.terrain || !config?.sefinekApi;
	const summary = useMemo(() => result && {
		distance: formatDistance(result.total),
		clear: !result.obstructed,
		clearance: `${Math.round(result.worstClearance)} m`,
	}, [result]);

	return (
		<ToolPanel title={t('terrain:title')} onClose={onClose}>
			{unavailable ? <Hint>{t('common:toolUnavailable')}</Hint> : (
				<>
					<Hint>{t('terrain:desc')}</Hint>
					{renderPoint('a')}
					{renderPoint('b')}
					<View style={styles.heights}>
						<View style={styles.heightField}><Field label={t('terrain:antennaHeightA')} value={heights.a} onChangeText={text => setHeights(current => ({ ...current, a: text }))} keyboardType="numeric" /></View>
						<View style={styles.heightField}><Field label={t('terrain:antennaHeightB')} value={heights.b} onChangeText={text => setHeights(current => ({ ...current, b: text }))} keyboardType="numeric" /></View>
					</View>
					{error && <Text style={styles.error}>{error}</Text>}
					<View style={styles.actions}>
						<Button style={styles.action} label={busy ? t('terrain:fetchingElevation') : t('terrain:analyze')} disabled={busy} onPress={analyze} />
						<Button style={styles.action} variant="ghost" label={t('common:clear')} onPress={reset} />
					</View>
					{summary && (
						<>
							<View style={styles.stats}>
								<Stat label={t('terrain:distance')} value={summary.distance} />
								<Stat label={t('terrain:opticalVisibility')} value={summary.clear ? t('terrain:lineOfSightClear') : t('terrain:blocked')} tone={summary.clear ? 'good' : 'bad'} />
								<Stat label={t('terrain:smallestClearance')} value={summary.clearance} />
							</View>
							<ElevationProfile result={result} />
							<View style={styles.legend}>
								<Text style={styles.legendText}>A</Text>
								<Text style={styles.legendText}>B</Text>
							</View>
						</>
					)}
				</>
			)}
		</ToolPanel>
	);
};
