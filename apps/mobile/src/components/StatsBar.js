import { memo, useMemo } from 'react';
import { countByType } from '@meshcore-map/core/nodes';
import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { useTheme } from '../state/ThemeContext';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';
import { Icon } from '../ui/Icon';

const styles = StyleSheet.create({
	bar: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', justifyContent: 'space-between', marginTop: spacing.sm, paddingHorizontal: spacing.md, minHeight: MIN_TOUCH - 10, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
	group: { flexDirection: 'row', alignItems: 'center', gap: 5 },
	separator: { color: colors.textMuted, fontSize: 13 },
	value: { fontSize: 13, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.sm },
});

// Counts of the nodes matching the filters, like the website's #stats-counts.
export const StatsBar = memo(({ nodes }) => {
	const { t } = useI18n();
	const { accent } = useTheme();

	const counts = useMemo(() => countByType(nodes), [nodes]);

	if (!nodes.length) return null;

	const value = count => <Text style={[styles.value, { backgroundColor: accent, color: '#fff' }]}>{count}</Text>;

	return (
		<View style={styles.bar}>
			<View style={styles.group} accessibilityLabel={t('map:totalCountTooltip')}>
				{value(nodes.length)}
			</View>
			<Text style={styles.separator}>|</Text>
			<View style={styles.group} accessibilityLabel={t('map:clientsCountTooltip')}>
				<Icon name="user" size={16} color={colors.textMuted} />
				{value(counts.clients)}
			</View>
			<Text style={styles.separator}>|</Text>
			<View style={styles.group} accessibilityLabel={t('map:repeatersCountTooltip')}>
				<Icon name="repeater-plain" size={16} color={colors.textMuted} />
				{value(counts.repeaters)}
			</View>
			<Text style={styles.separator}>|</Text>
			<View style={styles.group} accessibilityLabel={t('map:roomServersCountTooltip')}>
				<Icon name="room-server-plain" size={16} color={colors.textMuted} />
				{value(counts.roomServers)}
			</View>
		</View>
	);
});
