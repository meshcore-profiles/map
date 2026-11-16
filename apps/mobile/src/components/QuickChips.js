import { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
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

const Chip = ({ icon, label, onPress, accessibilityLabel, accent }) => {
	const { accentBright } = useTheme();

	return (
		<Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} style={({ pressed }) => [styles.chip, accent && { borderColor: accentBright }, pressed && { opacity: 0.8 }]}>
			{icon && <Icon name={icon} size={16} color={accent ? accentBright : colors.text} />}
			<Text style={styles.text}>{label}</Text>
		</Pressable>
	);
};

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
					<Chip icon={NODE_TYPE_ICONS[2]} label={format(counts.repeaters)} accessibilityLabel={t('map:repeatersCountTooltip')} onPress={onStats} />
					<Chip icon={NODE_TYPE_ICONS[1]} label={format(counts.clients)} accessibilityLabel={t('map:clientsCountTooltip')} onPress={onStats} />
					<Chip icon={NODE_TYPE_ICONS[3]} label={format(counts.roomServers)} accessibilityLabel={t('map:roomServersCountTooltip')} onPress={onStats} />
				</>
			)}
		</ScrollView>
	);
});
