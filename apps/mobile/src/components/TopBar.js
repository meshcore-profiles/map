import { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createDefaultFilters } from '@meshcore-map/core/nodes';
import { useI18n } from '../i18n';
import { useTheme } from '../state/ThemeContext';
import { colors, MIN_TOUCH, spacing } from '../theme';
import { Icon } from '../ui/Icon';
import { BrandLogo } from './BrandLogo';
import { QuickChips } from './QuickChips';
import { SearchBar } from './SearchBar';

const styles = StyleSheet.create({
	root: { position: 'absolute', left: spacing.md, right: spacing.md },
	button: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
	activeDot: { position: 'absolute', top: 9, right: 9, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: colors.panelSolid },
});

const filtersActive = filters => {
	const defaults = createDefaultFilters();

	return filters.nodeFilter.length !== defaults.nodeFilter.length
		|| Boolean(filters.fromDate)
		|| Boolean(filters.fromInsertDate)
		|| Object.values(filters.radioFilters).some(selection => selection !== null);
};

export const TopBar = memo(({ nodes, filters, onSelectNode, onOpenSheet }) => {
	const { t } = useI18n();
	const { accentBright } = useTheme();
	const insets = useSafeAreaInsets();
	const filtersOn = useMemo(() => filtersActive(filters), [filters]);
	const openFilters = useCallback(() => onOpenSheet('filters'), [onOpenSheet]);
	const openSettings = useCallback(() => onOpenSheet('settings'), [onOpenSheet]);
	const openStats = useCallback(() => onOpenSheet('stats'), [onOpenSheet]);

	return (
		<View style={[styles.root, { top: insets.top + spacing.sm }]}>
			<SearchBar nodes={nodes} onSelect={onSelectNode} leading={<BrandLogo />}>
				<Pressable style={styles.button} onPress={openFilters} accessibilityRole="button" accessibilityLabel={t('filters:toggleTitle')}>
					<Icon name="filter" size={22} color={filtersOn ? accentBright : colors.text} />
					{filtersOn && <View style={[styles.activeDot, { backgroundColor: accentBright }]} />}
				</Pressable>
				<Pressable style={styles.button} onPress={openSettings} accessibilityRole="button" accessibilityLabel={t('settings:title')}>
					<Icon name="settings" size={22} color={colors.text} />
				</Pressable>
			</SearchBar>
			<QuickChips nodes={nodes} onStats={openStats} />
		</View>
	);
});
