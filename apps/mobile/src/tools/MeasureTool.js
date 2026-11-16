import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDistance, haversineDistance } from '@meshcore-map/core/geo';
import { truncateKey } from '@meshcore-map/core/node-utils';
import { useI18n } from '../i18n';
import { Button, Chip, ChipScroll, Heading, Hint } from '../ui/controls';
import { ToolPanel } from '../ui/ToolPanel';
import { colors, spacing } from '../theme';
import { buildPathFeatures } from './pathFeatures';
import { useMapPicker } from './useMapPicker';
import { useShareLink } from './useShareLink';

const styles = StyleSheet.create({
	total: { color: colors.text, fontSize: 24, fontWeight: '700' },
	row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
	rowText: { color: colors.text, flexShrink: 1 },
	rowValue: { color: colors.textMuted },
	actions: { flexDirection: 'row', gap: spacing.sm },
	action: { flex: 1, paddingHorizontal: spacing.sm },
});

const COLOR = colors.blue;
// How a node's point is labelled: its name, or the first 1-3 bytes of its public key (as in repeater path hashes), or a short key.
const LABEL_MODES = ['name', '1', '2', '3', 'mid'];
const LABEL_MODE_KEYS = { name: 'name', 1: 'bytes1', 2: 'bytes2', 3: 'bytes3', mid: 'mid' };

export const MeasureTool = ({ ctx }) => {
	const { t } = useI18n();
	const { setOverlay, setPicker, onClose } = ctx;
	const [points, setPoints] = useState([]);
	const [labelMode, setLabelMode] = useState('name');
	const share = useShareLink();

	useMapPicker(setPicker, true, point => setPoints(current => [...current, point]));

	useEffect(() => () => setOverlay(null), [setOverlay]);

	const labelOf = (point, index) => {
		if (labelMode === 'mid' && point.key) return truncateKey(point.key, 6);
		if (labelMode !== 'name' && point.key) return point.key.slice(0, Number(labelMode) * 2);

		return point.label ?? t('common:pointFallback', { n: index + 1 });
	};

	useEffect(() => {
		setOverlay(buildPathFeatures(points, { color: COLOR, labelFor: (p, i) => String(labelOf(p, i)) }));
	}, [points, labelMode, setOverlay, t]);

	const segments = useMemo(() => points.slice(1).map((to, i) => ({ from: points[i], to, distance: haversineDistance(points[i], to) })), [points]);
	const total = segments.reduce((sum, s) => sum + s.distance, 0);
	const nameOf = (p, i) => labelMode === 'name' && !p.label && p.key ? truncateKey(p.key) : labelOf(p, i);

	return (
		<ToolPanel icon="ruler" title={t('measure:title')} onClose={onClose}>
			{points.length === 0 && <Hint>{t('measure:hint')}</Hint>}
			{points.length === 1 && <Hint>{t('measure:selectSecondPoint')}</Hint>}
			{points.length > 1 && <Text style={styles.total}>{formatDistance(total)}</Text>}
			{segments.map((s, i) => (
				<View key={i} style={styles.row}>
					<Text style={styles.rowText} numberOfLines={1}>{nameOf(s.from, i)} → {nameOf(s.to, i + 1)}</Text>
					<Text style={styles.rowValue}>{formatDistance(s.distance)}</Text>
				</View>
			))}
			{points.length > 0 && (
				<>
					<Heading>{t('measure:labelsHeading')}</Heading>
					<ChipScroll>
						{LABEL_MODES.map(mode => <Chip key={mode} label={t(`measure:labelModes.${LABEL_MODE_KEYS[mode]}`)} selected={labelMode === mode} onPress={() => setLabelMode(mode)} />)}
					</ChipScroll>
				</>
			)}
			<View style={styles.actions}>
				<Button style={styles.action} variant="secondary" label={t('measure:undo')} disabled={points.length === 0} onPress={() => setPoints(current => current.slice(0, -1))} />
				<Button style={styles.action} variant="ghost" label={t('common:clear')} disabled={points.length === 0} onPress={() => setPoints([])} />
				<Button style={styles.action} variant="secondary" label={t('common:share')} disabled={points.length === 0} onPress={() => share(`measure=${points.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';')}`)} />
			</View>
		</ToolPanel>
	);
};
