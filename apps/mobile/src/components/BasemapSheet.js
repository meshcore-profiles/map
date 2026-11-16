import { StyleSheet, View } from 'react-native';
import { BASEMAP_CATEGORIES } from '@meshcore-map/core/basemaps';
import { useI18n } from '../i18n';
import { spacing } from '../theme';
import { Heading, Hint, Option } from '../ui/controls';
import { Sheet } from '../ui/Sheet';

const styles = StyleSheet.create({
	group: { gap: spacing.sm },
});

export const BasemapSheet = ({ visible, onClose, basemaps, view, onSelect }) => {
	const { t, tRaw } = useI18n();
	const info = tRaw('map:baseMapInfo');

	// Each map says what to expect before tapping it: the usage limits, why it cannot be used, or why it failed.
	const describe = item => {
		const type = t(`map:basemapTypes.${item.group}`);
		const shown = view.usingFallback && item.name === view.active ? `${t('map:basemapShown')} · ` : '';
		if (item.disabled) return `${shown}${type} · ${t(item.reason === 'caching' ? 'mobile:basemap.noCache' : 'map:basemapNeedsKey')}`;

		const failure = view.describeFailure(item.name);
		if (failure) return `${shown}${type} · ${t('map:basemapUnavailable')}: ${failure}`;

		return `${shown}${type} · ${info?.[item.name] ?? ''}`;
	};

	// The first entry follows the default, whichever map that is now.
	const defaultItem = basemaps.listed.find(item => item.name === view.defaultResolved);

	return (
		<Sheet visible={visible} title={t('map:basemapToggleTitle')} onClose={onClose}>
			{defaultItem && <Option label={`${t('map:defaultBasemap')} (${defaultItem.name})`} info={describe(defaultItem)} selected={view.followsDefault} onPress={() => onSelect(null)} />}
			{view.usingFallback && <Hint>{t('map:basemapUsing', { active: view.active, failed: view.wanted, reason: view.describeFailure(view.wanted) })}</Hint>}
			{BASEMAP_CATEGORIES.map(category => {
				const items = basemaps.listed.filter(item => item.category === category);
				if (!items.length) return null;

				return (
					<View key={category} style={styles.group}>
						<Heading>{t(`map:basemapCategories.${category}`)}</Heading>
						{items.map(item => <Option key={item.name} label={item.name} info={describe(item)} disabled={item.disabled} selected={!view.followsDefault && item.name === view.wanted} onPress={() => onSelect(item.name)} />)}
					</View>
				);
			})}
		</Sheet>
	);
};
