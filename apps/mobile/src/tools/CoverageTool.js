import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { buildRayPoints, computeCoverage, computeLinkBudgetRangeM, computeSamplesPerRay, MAX_RANGE_M, RESOLUTIONS } from '@meshcore-map/core/coverage';
import { formatDistance, parseLatLng } from '@meshcore-map/core/geo';
import { resolveNodeByQuery } from '@meshcore-map/core/node-utils';
import { getElevationsChunked, loadRadioPresets } from '../data/appConfig';
import { useI18n } from '../i18n';
import { Button, Chip, ChipRow, Field, Hint, Label, SegmentedControl, Stat } from '../ui/controls';
import { ToolPanel } from '../ui/ToolPanel';
import { colors, spacing } from '../theme';
import { boundsOf } from './pathFeatures';

const styles = StyleSheet.create({
	pointRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
	pointField: { flex: 1 },
	pickButton: { minWidth: 96 },
	grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
	gridField: { flexGrow: 1, flexBasis: '45%' },
	actions: { flexDirection: 'row', gap: spacing.sm },
	action: { flex: 1 },
	stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
	section: { color: colors.text, fontWeight: '700' },
	error: { color: colors.redBright },
});

const COLOR_OPTICAL = '#4dabf7';
const COLOR_FRESNEL = '#2dd881';
const DEFAULTS = { txHeight: '7', rxHeight: '2', margin: '7', erp: '27', freq: '869.618', sf: '8', bw: '62.5', resolution: 'high' };

const avg = values => values.reduce((a, b) => a + b, 0) / values.length;

const polygon = (points, color, opacity) => ({
	type: 'Feature',
	geometry: { type: 'Polygon', coordinates: [[...points, points[0]].map(p => [p.lng, p.lat])] },
	properties: { kind: 'fill', color, opacity },
});

const originFeature = origin => ({
	type: 'Feature',
	geometry: { type: 'Point', coordinates: [origin.lng, origin.lat] },
	properties: { kind: 'point', color: '#f2b134', label: origin.label ?? '' },
});

const rangeStats = (ranges, capM) => ({ max: Math.max(...ranges), avg: avg(ranges), min: Math.min(...ranges), clear: ranges.filter(r => r >= capM - 1).length });

export const CoverageTool = ({ ctx }) => {
	const { t } = useI18n();
	const { nodes, config, setOverlay, setPicker, fitTo, onClose } = ctx;
	const [origin, setOrigin] = useState(null);
	const [text, setText] = useState('');
	const [picking, setPicking] = useState(false);
	const [form, setForm] = useState(DEFAULTS);
	const [presets, setPresets] = useState([]);
	const [busy, setBusy] = useState(false);
	const [progress, setProgress] = useState(null);
	const [error, setError] = useState(null);
	const [summary, setSummary] = useState(null);

	const setField = key => value => setForm(current => ({ ...current, [key]: value }));

	useEffect(() => {
		loadRadioPresets().then(list => setPresets(list)).catch(err => console.error('Failed to load radio presets:', err));
	}, []);

	useEffect(() => {
		const apply = point => {
			setOrigin(point);
			setText(point.label ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`);
			setPicking(false);
		};

		setPicker(picking ? { onMap: ({ lat, lng }) => apply({ lat, lng, label: null }), onNode: node => apply({ lat: node.lat, lng: node.lon, label: node.adv_name }) } : null);
	}, [picking, setPicker]);

	useEffect(() => () => {
		setPicker(null);
		setOverlay(null);
	}, [setOverlay, setPicker]);

	const syncFromText = () => {
		const coords = parseLatLng(text);
		if (coords) return setOrigin({ ...coords, label: null });

		const node = resolveNodeByQuery(text, nodes);
		if (node) setOrigin({ lat: node.lat, lng: node.lon, label: node.adv_name });
	};

	const applyPreset = preset => {
		if (!preset.params.freq) return;

		setForm(current => ({ ...current, freq: String(preset.params.freq), sf: String(preset.params.sf), bw: String(preset.params.bw) }));
	};

	const numbers = () => ({
		freqMHz: Number(form.freq),
		txHeight: Number(form.txHeight) || 0,
		rxHeight: Number(form.rxHeight) || 0,
		margin: Number(form.margin) || 0,
		erpDbm: Number(form.erp) || 0,
		sf: Number(form.sf) || 9,
		bwKHz: Number(form.bw) || 250,
	});

	const compute = async () => {
		if (!origin) return setError(t('coverage:selectPoint'));

		const { freqMHz, txHeight, rxHeight, margin, erpDbm, sf, bwKHz } = numbers();
		if (!freqMHz || freqMHz <= 0) return setError(t('coverage:invalidFrequency'));

		const linkBudgetRangeM = computeLinkBudgetRangeM(erpDbm, freqMHz, sf, bwKHz);
		const bearings = RESOLUTIONS[form.resolution] || RESOLUTIONS.high;
		const searchRangeM = Math.min(MAX_RANGE_M, linkBudgetRangeM);
		const samplesPerRay = computeSamplesPerRay(searchRangeM, bearings);

		setBusy(true);
		setError(null);
		setProgress(null);
		try {
			const allPoints = [origin, ...buildRayPoints(origin, bearings, samplesPerRay, searchRangeM)];
			const elevations = await getElevationsChunked(config.sefinekApi, allPoints, (current, total) => total > 1 && setProgress({ current, total }));
			const rays = computeCoverage({ origin, elevations, bearings, samplesPerRay, searchRangeM, txHeight, rxHeight, freqMHz, margin, linkBudgetRangeM });

			const opticalRing = rays.map(r => r.opticalPoint);
			const fresnelRing = rays.map(r => r.fresnelPoint);
			setOverlay([polygon(opticalRing, COLOR_OPTICAL, 0.18), polygon(fresnelRing, COLOR_FRESNEL, 0.32), originFeature(origin)]);
			fitTo(boundsOf(opticalRing));

			setSummary({
				budget: linkBudgetRangeM,
				optical: rangeStats(rays.map(r => r.opticalRange), searchRangeM),
				fresnel: rangeStats(rays.map(r => r.fresnelRange), searchRangeM),
				bearings,
			});
		} catch (err) {
			console.error('Coverage computation failed:', err);
			setError(t('coverage:fetchElevationFailed'));
		} finally {
			setBusy(false);
			setProgress(null);
		}
	};

	const reset = () => {
		setPicking(false);
		setOrigin(null);
		setText('');
		setSummary(null);
		setError(null);
		setOverlay(null);
	};

	const unavailable = !config?.features?.coverage || !config?.sefinekApi;
	const params = numbers();
	const budget = computeLinkBudgetRangeM(params.erpDbm, params.freqMHz || 869, params.sf, params.bwKHz);
	const bearingCount = RESOLUTIONS[form.resolution] ?? RESOLUTIONS.high;
	const estimate = bearingCount * computeSamplesPerRay(Math.min(MAX_RANGE_M, budget), bearingCount) + 1;

	const numberField = (key, label) => (
		<View style={styles.gridField}><Field label={label} value={form[key]} onChangeText={setField(key)} keyboardType="numeric" /></View>
	);

	return (
		<ToolPanel title={t('coverage:title')} onClose={onClose}>
			{unavailable ? <Hint>{t('common:toolUnavailable')}</Hint> : (
				<>
					<Hint>{t('coverage:desc')}</Hint>
					<View style={styles.pointRow}>
						<View style={styles.pointField}>
							<Field value={text} onChangeText={setText} onEndEditing={syncFromText} placeholder={t('coverage:nodeNamePlaceholder')} />
						</View>
						<Button style={styles.pickButton} variant={picking ? 'primary' : 'secondary'} label={picking ? t('mobile:tools.picking') : t('coverage:pickOnMap')} onPress={() => setPicking(current => !current)} />
					</View>
					{presets.length > 0 && (
						<>
							<Label>{t('coverage:preset')}</Label>
							<ChipRow>
								{presets.filter(p => p.params.freq).map(p => (
									<Chip key={p.name} label={p.name} selected={Number(form.freq) === p.params.freq && Number(form.sf) === p.params.sf && Number(form.bw) === p.params.bw} onPress={() => applyPreset(p)} />
								))}
							</ChipRow>
						</>
					)}
					<View style={styles.grid}>
						{numberField('txHeight', t('coverage:txHeight'))}
						{numberField('rxHeight', t('coverage:rxHeight'))}
						{numberField('freq', t('coverage:frequency'))}
						{numberField('bw', t('coverage:bandwidth'))}
						{numberField('sf', t('coverage:spreadingFactor'))}
						{numberField('erp', t('coverage:erp'))}
						{numberField('margin', t('coverage:terrainMargin'))}
					</View>
					<Hint>{t('coverage:linkBudgetRange', { range: formatDistance(budget) })}</Hint>
					<Label>{t('coverage:resolution')}</Label>
					<SegmentedControl
						value={form.resolution}
						onChange={setField('resolution')}
						options={[{ value: 'fast', label: String(RESOLUTIONS.fast) }, { value: 'standard', label: String(RESOLUTIONS.standard) }, { value: 'high', label: String(RESOLUTIONS.high) }]}
					/>
					<Hint>{t('coverage:estimate', { points: estimate })}</Hint>
					{error && <Text style={styles.error}>{error}</Text>}
					<View style={styles.actions}>
						<Button style={styles.action} label={busy ? (progress ? t('coverage:fetchingElevationProgress', progress) : t('coverage:fetchingElevation')) : t('coverage:compute')} disabled={busy} onPress={compute} />
						<Button style={styles.action} variant="ghost" label={t('common:clear')} onPress={reset} />
					</View>
					{summary && (
						<>
							<Text style={styles.section}>{t('coverage:fresnelCriterion')}</Text>
							<View style={styles.stats}>
								<Stat label={t('coverage:maxRangeLabel')} value={formatDistance(summary.fresnel.max)} />
								<Stat label={t('coverage:avgRangeLabel')} value={formatDistance(summary.fresnel.avg)} />
								<Stat label={t('coverage:minRangeLabel')} value={formatDistance(summary.fresnel.min)} />
							</View>
							<Text style={styles.section}>{t('coverage:opticalCriterion')}</Text>
							<View style={styles.stats}>
								<Stat label={t('coverage:maxRangeLabel')} value={formatDistance(summary.optical.max)} />
								<Stat label={t('coverage:avgRangeLabel')} value={formatDistance(summary.optical.avg)} />
								<Stat label={t('coverage:minRangeLabel')} value={formatDistance(summary.optical.min)} />
							</View>
						</>
					)}
				</>
			)}
		</ToolPanel>
	);
};
