import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatTimeAgo, nodesInsertedSince, STATS_PERIOD_DAYS } from '@meshcore-map/core/nodes';
import { useI18n } from '../i18n';
import { useTheme } from '../state/ThemeContext';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';
import { Button, Chip, ChipRow } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';

const MAX_LISTED = 200;

const styles = StyleSheet.create({
	chips: { flexDirection: 'row', gap: spacing.sm },
	chip: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.chip },
	chipLabel: { color: colors.textMuted, fontFamily: 'monospace', fontSize: 14, textTransform: 'uppercase' },
	chipValue: { fontSize: 20, fontWeight: '700' },
	row: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
	rowText: { flex: 1 },
	name: { color: colors.text, fontSize: 15 },
	ago: { color: colors.textMuted, fontSize: 12 },
	empty: { color: colors.textMuted, paddingVertical: spacing.md },
});

// New nodes and repeaters in a period, like the website's statistics modal (without the custom date range).
export const StatsSheet = ({ visible, onClose, nodes, repeaters, onSelectNode, onShowOnMap }) => {
	const { t, tRaw, plural } = useI18n();
	const { accentBright } = useTheme();
	const [period, setPeriod] = useState('24h');

	const counts = useMemo(() => (visible ? Object.fromEntries(Object.entries(STATS_PERIOD_DAYS).map(([key, days]) => [key, nodesInsertedSince(nodes, days).length])) : {}), [visible, nodes]);
	const recent = useMemo(() => {
		if (!visible) return [];

		return nodesInsertedSince(repeaters, STATS_PERIOD_DAYS[period]).sort((a, b) => b.insertDate - a.insertDate);
	}, [visible, repeaters, period]);

	const ago = date => formatTimeAgo(date.getTime(), { t, tRaw, plural });

	return (
		<Sheet visible={visible} title={t('stats:title')} onClose={onClose} footer={<Button variant="secondary" label={t('stats:showOnMap')} disabled={!recent.length} onPress={() => onShowOnMap(recent)} />}>
			<View style={styles.chips}>
				{Object.keys(STATS_PERIOD_DAYS).map(key => (
					<View key={key} style={styles.chip}>
						<Text style={styles.chipLabel}>{key}</Text>
						<Text style={[styles.chipValue, { color: accentBright }]}>{counts[key] ?? 0}</Text>
					</View>
				))}
			</View>
			<ChipRow>
				{Object.keys(STATS_PERIOD_DAYS).map(key => <Chip key={key} label={key} selected={period === key} onPress={() => setPeriod(key)} />)}
			</ChipRow>
			{recent.length === 0 && <Text style={styles.empty}>{t('stats:noRepeatersInPeriod')}</Text>}
			{recent.slice(0, MAX_LISTED).map(node => (
				<Pressable key={node.public_key} style={styles.row} onPress={() => onSelectNode(node)} accessibilityRole="button">
					<Icon name="repeater-plain" size={26} color={colors.textMuted} />
					<View style={styles.rowText}>
						<Text style={styles.name} numberOfLines={1}>{node.adv_name}</Text>
						<Text style={styles.ago}>{ago(node.insertDate)}</Text>
					</View>
				</Pressable>
			))}
		</Sheet>
	);
};
