import { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { NODE_TYPE_COLORS } from '@meshcore-map/core/colors';
import { countByType } from '@meshcore-map/core/nodes';
import { useI18n } from '../i18n';
import { useSettings } from '../state/SettingsContext';
import { useTheme } from '../state/ThemeContext';
import { useRegionSwitch } from '../state/useRegionSwitch';
import { colors, NODE_TYPE_ICONS, shadow, spacing } from '../theme';
import { Icon } from '../ui/Icon';

const styles = StyleSheet.create({
	row: { gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
	chip: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelSolid, ...shadow },
	text: { color: colors.text, fontSize: 14, fontWeight: '600' },
});

const Chip = ({ icon, iconColor, label, onPress, accessibilityLabel, accent }) => {
	const { accentBright } = useTheme();

	return (
		<Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} style={({ pressed }) => [styles.chip, accent && { borderColor: accentBright }, pressed && { opacity: 0.8 }]}>
			<Icon name={icon} size={16} color={iconColor ?? (accent ? accentBright : colors.textMuted)} />
			<Text style={styles.text}>{label}</Text>
		</Pressable>
	);
};

// Quick actions under the search bar, like the chips in modern map apps: the map scope and the node counts (tapping a count opens the statistics).
export const QuickChips = memo(({ nodes, onStats }) => {
	const { t } = useI18n();
	const { settings } = useSettings();
	const switchRegion = useRegionSwitch();
	const counts = useMemo(() => countByType(nodes), [nodes]);
	const pl = settings.region === 'pl';
	const format = value => value.toLocaleString();

	return (
		<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled">
			<Chip icon="globe" accent label={pl ? t('map:polandOnlyLabel') : t('map:allNodesLabel')} accessibilityLabel={t(pl ? 'map:showAllWorld' : 'map:showPolandOnly')} onPress={() => switchRegion(pl ? 'all' : 'pl')} />
			{nodes.length > 0 && (
				<>
					<Chip icon="chart" label={format(nodes.length)} accessibilityLabel={t('map:totalCountTooltip')} onPress={onStats} />
					<Chip icon={NODE_TYPE_ICONS[1]} iconColor={NODE_TYPE_COLORS[1]} label={format(counts.clients)} accessibilityLabel={t('map:clientsCountTooltip')} onPress={onStats} />
					<Chip icon={NODE_TYPE_ICONS[2]} iconColor={NODE_TYPE_COLORS[2]} label={format(counts.repeaters)} accessibilityLabel={t('map:repeatersCountTooltip')} onPress={onStats} />
					<Chip icon={NODE_TYPE_ICONS[3]} iconColor={NODE_TYPE_COLORS[3]} label={format(counts.roomServers)} accessibilityLabel={t('map:roomServersCountTooltip')} onPress={onStats} />
				</>
			)}
		</ScrollView>
	);
});
