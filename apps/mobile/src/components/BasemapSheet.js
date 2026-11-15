import { StyleSheet, View } from 'react-native';
import { DEFAULT_BASEMAP_SELECTION } from '@meshcore-map/core/basemaps';
import { useI18n } from '../i18n';
import { spacing } from '../theme';
import { Heading, Option } from '../ui/controls';
import { Sheet } from '../ui/Sheet';

const styles = StyleSheet.create({
	group: { gap: spacing.sm },
});

const GROUP_LABELS = { tiles: 'map:tileBaseMaps', vector: 'map:vectorBaseMaps' };

export const BasemapSheet = ({ visible, onClose, basemaps, selection, onSelect }) => {
	const { t, tRaw } = useI18n();
	const info = tRaw('map:baseMapInfo');

	// Only the chosen map shows its description; a list where every entry explains itself would be a wall of text.
	const option = (value, name, description) => <Option key={value} label={name} info={selection === value ? description : undefined} selected={selection === value} onPress={() => onSelect(value)} />;

	return (
		<Sheet visible={visible} title={t('map:basemapToggleTitle')} onClose={onClose}>
			{option(DEFAULT_BASEMAP_SELECTION, t('map:defaultBasemap'), info?.[basemaps.defaultName])}
			{['tiles', 'vector'].map(group => {
				const items = basemaps.all.filter(basemap => basemap.group === group);
				if (!items.length) return null;

				return (
					<View key={group} style={styles.group}>
						<Heading>{t(GROUP_LABELS[group])}</Heading>
						{items.map(basemap => option(basemap.name, basemap.name, info?.[basemap.name]))}
					</View>
				);
			})}
		</Sheet>
	);
};
