import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { buildRayPoints, computeCoverage, computeLinkBudgetRangeM, computeSamplesPerRay, MAX_RANGE_M, RESOLUTIONS } from '@meshcore-map/core/coverage';
import { destinationPoint, formatDistance } from '@meshcore-map/core/geo';
import { getElevationsChunked, loadRadioPresets } from '../data/appConfig';
import { useI18n } from '../i18n';
import { Button, Chip, ChipRow, ChipScroll, Field, Heading, Hint, Stat } from '../ui/controls';
import { ToolPanel } from '../ui/ToolPanel';
import { colors, spacing } from '../theme';
import { coverageTileFeatures } from './coverageTiles';
import { boundsOf } from './pathFeatures';
import { PointField } from './PointField';
import { describePoint, pointFromText } from './points';
import { useMapPicker } from './useMapPicker';
import { useShareLink } from './useShareLink';

const styles = StyleSheet.create({
	grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
	gridField: { flexGrow: 1, flexBasis: '45%' },
	actions: { flexDirection: 'row', gap: spacing.sm },
	action: { flex: 1 },
	stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
	section: { color: colors.text, fontWeight: '700' },
	error: { color: colors.redBright },
});

const COLOR_OPTICAL = colors.blue;
const COLOR_FRESNEL = colors.green;
const BANDWIDTHS = [7.8, 10.4, 15.6, 20.8, 31.25, 41.7, 62.5, 125, 250, 500];
const RESOLUTION_LABELS = { fast: 'coverage:resolutionFast', standard: 'coverage:resolutionStandard', high: 'coverage:resolutionHigh' };
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
	properties: { kind: 'point', color: colors.amber, label: origin.label ?? '' },
});

// Dashed circle at the link budget range, drawn only when the budget (not the 30 km cap) limits the coverage.
const budgetRing = (origin, rangeM) => ({
	type: 'Feature',
	geometry: { type: 'LineString', coordinates: Array.from({ length: 73 }, (_, i) => destinationPoint(origin, (i % 72) * 5, rangeM)).map(p => [p.lng, p.lat]) },
	properties: { kind: 'line', color: colors.textMuted, width: 1.5 },
});

const rangeStats = (ranges, capM) => ({ max: Math.max(...ranges), avg: avg(ranges), min: Math.min(...ranges), clear: ranges.filter(r => r >= capM - 1).length });

export const CoverageTool = ({ ctx }) => {
	const { t } = useI18n();
	const { nodes, config, elevationSource, coverageStyle, defaultRadio, setOverlay, setPicker, fitTo, onClose } = ctx;
	const [origin, setOrigin] = useState(null);
	const [text, setText] = useState('');
	const [picking, setPicking] = useState(false);
	const [form, setForm] = useState(DEFAULTS);
	const [presets, setPresets] = useState([]);
	const [busy, setBusy] = useState(false);
	const [progress, setProgress] = useState(null);
	const [error, setError] = useState(null);
	const [summary, setSummary] = useState(null);
	const share = useShareLink();

	const setField = key => value => setForm(current => ({ ...current, [key]: value }));

	// The site's default preset (like the website) applies once the list arrives.
	useEffect(() => {
		loadRadioPresets().then(list => {
			setPresets(list);
			const preset = list.find(item => item.name === defaultRadio && item.params.freq);
			if (preset) setForm(current => ({ ...current, freq: String(preset.params.freq), sf: String(preset.params.sf), bw: String(preset.params.bw) }));
		}).catch(err => console.error('Failed to load radio presets:', err));
	}, [defaultRadio]);

	// A picked node brings its own radio settings, as on the website.
	const applyPoint = point => {
		setOrigin(point);
		setText(describePoint(point));
		if (point.radio?.freq) setForm(current => ({ ...current, freq: String(point.radio.freq), sf: String(point.radio.sf ?? current.sf), bw: String(point.radio.bw ?? current.bw) }));
	};

	useMapPicker(setPicker, picking, point => {
		applyPoint(point);
		setPicking(false);
	});

	useEffect(() => () => setOverlay(null), [setOverlay]);

	const syncFromText = () => {
		const point = pointFromText(text, nodes);
		if (point) applyPoint(point);
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
			const elevations = await getElevationsChunked(config.sefinekApi, allPoints, (current, total) => total > 1 && setProgress({ current, total }), elevationSource);
			const rays = computeCoverage({ origin, elevations, bearings, samplesPerRay, searchRangeM, txHeight, rxHeight, freqMHz, margin, linkBudgetRangeM });

			const opticalRing = rays.map(r => r.opticalPoint);
			const fresnelRing = rays.map(r => r.fresnelPoint);
			const tiles = coverageStyle === 'tiles';
			const layer = tiles
				? coverageTileFeatures({ origin, rayResults: rays, capM: searchRangeM, linkBudgetRangeM })
				: [polygon(opticalRing, COLOR_OPTICAL, 0.18), polygon(fresnelRing, COLOR_FRESNEL, 0.32)];
			setOverlay([...layer, ...(linkBudgetRangeM < MAX_RANGE_M ? [budgetRing(origin, linkBudgetRangeM)] : []), originFeature(origin)]);
			fitTo(boundsOf(opticalRing));

			setSummary({
				budget: linkBudgetRangeM,
				tiles,
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
		<ToolPanel icon="coverage" title={t('coverage:title')} onClose={onClose}>
			{unavailable ? <Hint>{t('common:toolUnavailable')}</Hint> : (
				<>
					{!origin && <Hint>{t('coverage:desc')}</Hint>}
					<PointField
						value={text}
						placeholder={t('coverage:nodeNamePlaceholder')}
						picking={picking}
						pickLabel={t('coverage:pickOnMap')}
						onChangeText={setText}
						onEndEditing={syncFromText}
						onTogglePick={() => setPicking(current => !current)}
					/>
					{presets.length > 0 && (
						<>
							<Heading>{t('coverage:preset')}</Heading>
							<ChipScroll>
								{presets.filter(p => p.params.freq).map(p => (
									<Chip key={p.name} label={p.name} selected={Number(form.freq) === p.params.freq && Number(form.sf) === p.params.sf && Number(form.bw) === p.params.bw} onPress={() => applyPreset(p)} />
								))}
							</ChipScroll>
						</>
					)}
					<View style={styles.grid}>
						{numberField('txHeight', t('coverage:txHeight'))}
						{numberField('rxHeight', t('coverage:rxHeight'))}
						{numberField('freq', t('coverage:frequency'))}
						{numberField('sf', t('coverage:spreadingFactor'))}
						{numberField('erp', t('coverage:erp'))}
						{numberField('margin', t('coverage:terrainMargin'))}
					</View>
					<Hint>{t('coverage:linkBudgetRange', { range: formatDistance(budget) })}</Hint>
					<Heading>{t('coverage:bandwidth')}</Heading>
					<ChipScroll>
						{BANDWIDTHS.map(bw => <Chip key={bw} label={String(bw)} selected={Number(form.bw) === bw} onPress={() => setField('bw')(String(bw))} />)}
					</ChipScroll>
					<Heading>{t('coverage:resolution')}</Heading>
					<ChipRow>
						{Object.keys(RESOLUTION_LABELS).map(key => <Chip key={key} label={t(RESOLUTION_LABELS[key])} selected={form.resolution === key} onPress={() => setField('resolution')(key)} />)}
					</ChipRow>
					<Hint>{t('coverage:estimate', { points: estimate })}</Hint>
					{error && <Text style={styles.error}>{error}</Text>}
					<View style={styles.actions}>
						<Button style={styles.action} label={busy ? (progress ? t('coverage:fetchingElevationProgress', progress) : t('coverage:fetchingElevation')) : t('coverage:compute')} disabled={busy} onPress={compute} />
						{summary && origin && <Button style={styles.action} variant="secondary" icon="link" label={t('common:share')} onPress={() => share(`coverage=${[origin.lat.toFixed(5), origin.lng.toFixed(5), form.txHeight, form.rxHeight, form.freq, form.resolution, form.margin, form.erp, form.sf, form.bw].join(',')}`)} />}
						<Button style={styles.action} variant="ghost" label={t('common:clear')} onPress={reset} />
					</View>
					{summary && (
						<>
							{summary.tiles && <Hint>{t('coverage:legendChance')}</Hint>}
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
