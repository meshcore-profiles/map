import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';
import { formatDistance, haversineDistance } from '@meshcore-map/core/geo';
import { analyzeLineOfSight, clearanceAt, sampleLine } from '@meshcore-map/core/los';
import { getElevations } from '../data/appConfig';
import { useI18n } from '../i18n';
import { Button, Field, Hint, Stat } from '../ui/controls';
import { ToolPanel } from '../ui/ToolPanel';
import { colors, radius, spacing } from '../theme';
import { boundsOf, buildPathFeatures } from './pathFeatures';
import { PointField } from './PointField';
import { describePoint, pointFromText } from './points';
import { useMapPicker } from './useMapPicker';
import { useShareLink } from './useShareLink';

const SAMPLE_COUNT = 48;
const CHART_WIDTH = 320;
const CHART_HEIGHT = 120;
const CHART_PAD = 8;
const COLOR = colors.amber;

const styles = StyleSheet.create({
	heights: { flexDirection: 'row', gap: spacing.sm },
	heightField: { flex: 1 },
	actions: { flexDirection: 'row', gap: spacing.sm },
	action: { flex: 1 },
	stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
	chart: { backgroundColor: colors.bg, borderRadius: radius.sm, overflow: 'hidden' },
	legend: { flexDirection: 'row', justifyContent: 'space-between' },
	legendText: { color: colors.textMuted, fontWeight: '700' },
	error: { color: colors.redBright },
});

const ElevationProfile = ({ result }) => {
	const { elevations, distances, total, elevA, elevB } = result;
	const lo = Math.min(...elevations, elevA, elevB);
	const hi = Math.max(...elevations, elevA, elevB);
	const span = Math.max(hi - lo, 1);
	const plotW = CHART_WIDTH - 2 * CHART_PAD;
	const plotH = CHART_HEIGHT - 2 * CHART_PAD;
	const x = d => CHART_PAD + (d / total) * plotW;
	const y = e => CHART_PAD + plotH - ((e - lo) / span) * plotH;

	const terrain = elevations.map((e, i) => `${x(distances[i]).toFixed(1)},${y(e).toFixed(1)}`).join(' ');
	const area = `${x(0)},${CHART_PAD + plotH} ${terrain} ${x(total)},${CHART_PAD + plotH}`;
	const blocked = result.obstructed;

	return (
		<View style={styles.chart} accessibilityRole="image">
			<Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
				<Polygon points={area} fill={colors.textMuted} fillOpacity={0.2} stroke={colors.textMuted} strokeWidth={1.5} />
				<Line x1={x(0)} y1={y(elevA)} x2={x(total)} y2={y(elevB)} stroke={blocked ? colors.redBright : colors.green} strokeWidth={2} strokeDasharray="5 4" />
				{elevations.map((elevation, i) => clearanceAt({ elevation, d: distances[i], total, elevA, elevB }) < 0 && (
					<Circle key={i} cx={x(distances[i])} cy={y(elevation)} r={3} fill={colors.redBright} />
				))}
				<Circle cx={x(0)} cy={y(elevA)} r={4.5} fill={colors.blue} />
				<Circle cx={x(total)} cy={y(elevB)} r={4.5} fill={colors.red} />
			</Svg>
		</View>
	);
};

export const TerrainTool = ({ ctx }) => {
	const { t } = useI18n();
	const { nodes, config, elevationSource, setOverlay, setPicker, fitTo, onClose } = ctx;
	const [points, setPoints] = useState({ a: null, b: null });
	const [texts, setTexts] = useState({ a: '', b: '' });
	const [heights, setHeights] = useState({ a: '7', b: '2' });
	const [picking, setPicking] = useState(null);
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState(null);
	const [error, setError] = useState(null);
	const share = useShareLink();

	const setPoint = (key, point) => {
		setPoints(current => ({ ...current, [key]: point }));
		setTexts(current => ({ ...current, [key]: describePoint(point) }));
		setResult(null);
	};

	// Picking A moves on to B, picking B ends the selection.
	useMapPicker(setPicker, picking !== null, point => {
		setPoint(picking, point);
		setPicking(current => current === 'a' ? 'b' : null);
	});

	useEffect(() => () => setOverlay(null), [setOverlay]);

	useEffect(() => {
		const list = [points.a && { ...points.a, label: 'A' }, points.b && { ...points.b, label: 'B' }].filter(Boolean);
		setOverlay(buildPathFeatures(list, { color: COLOR, labelFor: p => p.label, segmentLabels: false }));
	}, [points, setOverlay]);

	const syncFromText = key => {
		const point = pointFromText(texts[key], nodes);
		if (point) setPoint(key, point);
	};

	const analyze = async () => {
		if (!points.a || !points.b) return setError(t('terrain:selectBothPoints'));
		if (haversineDistance(points.a, points.b) < 10) return setError(t('terrain:pointsTooClose'));

		setBusy(true);
		setError(null);
		try {
			const samplePoints = sampleLine(points.a, points.b, SAMPLE_COUNT);
			const elevations = await getElevations(config.sefinekApi, samplePoints, elevationSource);
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
		<PointField
			label={key.toUpperCase()}
			value={texts[key]}
			placeholder={t('terrain:nodeNamePlaceholder')}
			picking={picking === key}
			pickLabel={t('terrain:pickOnMap')}
			onChangeText={text => setTexts(current => ({ ...current, [key]: text }))}
			onEndEditing={() => syncFromText(key)}
			onTogglePick={() => setPicking(picking === key ? null : key)}
		/>
	);

	const unavailable = !config?.features?.terrain || !config?.sefinekApi;
	const summary = useMemo(() => result && {
		distance: formatDistance(result.total),
		clear: !result.obstructed,
		clearance: `${Math.round(result.worstClearance)} m`,
	}, [result]);

	return (
		<ToolPanel icon="terrain" title={t('terrain:title')} onClose={onClose}>
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
						<Button style={styles.action} variant="secondary" icon="link" label={t('common:share')} disabled={!points.a || !points.b} onPress={() => share(`terrain=${points.a.lat.toFixed(5)},${points.a.lng.toFixed(5)},${heights.a};${points.b.lat.toFixed(5)},${points.b.lng.toFixed(5)},${heights.b}`)} />
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
