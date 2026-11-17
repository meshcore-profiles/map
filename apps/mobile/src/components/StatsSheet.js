import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatTimeAgo, nodesInsertedSince, STATS_PERIOD_DAYS } from '@meshcore-map/core/nodes';
import { useI18n } from '../i18n';
import { useTheme } from '../state/ThemeContext';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';
import { Button } from '../ui/Button';
import { Chip, ChipRow } from '../ui/Chip';
import { Field } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';

const LIST_CHUNK = 30;
const DAY_MS = 86400000;

// A day typed as YYYY-MM-DD, or NaN while the text is not a date yet.
const parseDay = text => (/^\d{4}-\d{2}-\d{2}$/).test(text) ? Date.parse(text) : NaN;

const styles = StyleSheet.create({
	chips: { flexDirection: 'row', gap: spacing.sm },
	chip: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.chip },
	chipLabel: { color: colors.textMuted, fontFamily: 'monospace', fontSize: 14 },
	chipValue: { fontSize: 20, fontWeight: '700' },
	row: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
	rowText: { flex: 1 },
	name: { color: colors.text, fontSize: 15 },
	ago: { color: colors.textMuted, fontSize: 13 },
	range: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
	rangeField: { flex: 1 },
	empty: { color: colors.textMuted, paddingVertical: spacing.md },
});

export const StatsSheet = ({ visible, onClose, nodes, repeaters, onSelectNode, onShowOnMap }) => {
	const { t, tRaw, plural } = useI18n();
	const { accentBright } = useTheme();
	const [period, setPeriod] = useState('24h');
	const [range, setRange] = useState({ from: '', to: '' });
	const [shown, setShown] = useState(LIST_CHUNK);

	const counts = useMemo(() => (visible ? Object.fromEntries(Object.entries(STATS_PERIOD_DAYS).map(([key, days]) => [key, nodesInsertedSince(nodes, days).length])) : {}), [visible, nodes]);
	const recent = useMemo(() => {
		if (!visible) return [];

		if (period !== 'custom') return nodesInsertedSince(repeaters, STATS_PERIOD_DAYS[period]).sort((a, b) => b.insertDate - a.insertDate);

		const from = parseDay(range.from);
		const to = parseDay(range.to);
		// The end day counts as a whole day; an unset bound leaves that side open.
		return repeaters
			.filter(node => (Number.isNaN(from) || node.insertDate.getTime() >= from) && (Number.isNaN(to) || node.insertDate.getTime() < to + DAY_MS))
			.sort((a, b) => b.insertDate - a.insertDate);
	}, [visible, repeaters, period, range]);

	// A new period or range starts the list from the top again.
	useEffect(() => setShown(LIST_CHUNK), [period, range, visible]);

	const ago = date => formatTimeAgo(date.getTime(), { t, tRaw, plural });

	return (
		<Sheet visible={visible} title={t('stats:title')} onClose={onClose} footer={<Button variant="secondary" label={t('stats:showOnMap')} disabled={!recent.length} onPress={() => onShowOnMap(recent)} />}>
			<View style={styles.chips}>
				{Object.keys(STATS_PERIOD_DAYS).map(key => (
					<Pressable
						key={key}
						style={[styles.chip, period === key && { borderColor: accentBright, backgroundColor: `${accentBright}22` }]}
						onPress={() => setPeriod(key)}
						accessibilityRole="button"
						accessibilityState={{ selected: period === key }}
					>
						<Text style={styles.chipLabel}>{key}</Text>
						<Text style={[styles.chipValue, { color: accentBright }]}>{(counts[key] ?? 0).toLocaleString()}</Text>
					</Pressable>
				))}
			</View>
			<ChipRow>
				<Chip label={t('stats:range')} selected={period === 'custom'} onPress={() => setPeriod(period === 'custom' ? '24h' : 'custom')} />
			</ChipRow>
			{period === 'custom' && (
				<View style={styles.range}>
					<View style={styles.rangeField}><Field value={range.from} onChangeText={from => setRange(current => ({ ...current, from }))} placeholder="YYYY-MM-DD" maxLength={10} accessibilityLabel={t('stats:fromDateAria')} /></View>
					<View style={styles.rangeField}><Field value={range.to} onChangeText={to => setRange(current => ({ ...current, to }))} placeholder="YYYY-MM-DD" maxLength={10} accessibilityLabel={t('stats:toDateAria')} /></View>
				</View>
			)}
			{recent.length === 0 && <Text style={styles.empty}>{t('stats:noRepeatersInPeriod')}</Text>}
			{recent.slice(0, shown).map(node => (
				<Pressable key={node.public_key} style={styles.row} onPress={() => onSelectNode(node)} accessibilityRole="button">
					<Icon name="repeater-plain" size={26} color={colors.textMuted} />
					<View style={styles.rowText}>
						<Text style={styles.name} numberOfLines={1}>{node.adv_name}</Text>
						<Text style={styles.ago}>{ago(node.insertDate)}</Text>
					</View>
				</Pressable>
			))}
			{recent.length > shown && <Button variant="secondary" label={t('stats:showMore', { count: Math.min(LIST_CHUNK, recent.length - shown) })} onPress={() => setShown(current => current + LIST_CHUNK)} />}
		</Sheet>
	);
};
