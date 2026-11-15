import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDistance, haversineDistance } from '@meshcore-map/core/geo';
import { truncateKey } from '@meshcore-map/core/node-utils';
import { useI18n } from '../i18n';
import { Button, Hint } from '../ui/controls';
import { ToolPanel } from '../ui/ToolPanel';
import { colors, spacing } from '../theme';
import { buildPathFeatures } from './pathFeatures';

const styles = StyleSheet.create({
	total: { color: colors.text, fontSize: 24, fontWeight: '700' },
	row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
	rowText: { color: colors.text, flexShrink: 1 },
	rowValue: { color: colors.textMuted },
	actions: { flexDirection: 'row', gap: spacing.sm },
	action: { flex: 1 },
});

const COLOR = '#4dabf7';

export const MeasureTool = ({ ctx }) => {
	const { t } = useI18n();
	const { setOverlay, setPicker, onClose } = ctx;
	const [points, setPoints] = useState([]);

	useEffect(() => {
		const add = point => setPoints(current => [...current, point]);
		setPicker({
			onMap: ({ lat, lng }) => add({ lat, lng, label: null }),
			onNode: node => add({ lat: node.lat, lng: node.lon, label: node.adv_name, key: node.public_key }),
		});

		return () => {
			setPicker(null);
			setOverlay(null);
		};
	}, [setOverlay, setPicker]);

	useEffect(() => {
		setOverlay(buildPathFeatures(points, { color: COLOR, labelFor: (p, i) => String(p.label ?? t('common:pointFallback', { n: i + 1 })) }));
	}, [points, setOverlay, t]);

	const segments = useMemo(() => points.slice(1).map((to, i) => ({ from: points[i], to, distance: haversineDistance(points[i], to) })), [points]);
	const total = segments.reduce((sum, s) => sum + s.distance, 0);
	const nameOf = (p, i) => p.label ?? (p.key ? truncateKey(p.key) : t('common:pointFallback', { n: i + 1 }));

	return (
		<ToolPanel title={t('measure:title')} onClose={onClose}>
			{points.length === 0 && <Hint>{t('measure:hint')}</Hint>}
			{points.length === 1 && <Hint>{t('measure:selectSecondPoint')}</Hint>}
			{points.length > 1 && <Text style={styles.total}>{formatDistance(total)}</Text>}
			{segments.map((s, i) => (
				<View key={i} style={styles.row}>
					<Text style={styles.rowText} numberOfLines={1}>{nameOf(s.from, i)} → {nameOf(s.to, i + 1)}</Text>
					<Text style={styles.rowValue}>{formatDistance(s.distance)}</Text>
				</View>
			))}
			<View style={styles.actions}>
				<Button style={styles.action} variant="secondary" label={t('measure:undo')} disabled={points.length === 0} onPress={() => setPoints(current => current.slice(0, -1))} />
				<Button style={styles.action} variant="ghost" label={t('common:clear')} disabled={points.length === 0} onPress={() => setPoints([])} />
			</View>
		</ToolPanel>
	);
};
