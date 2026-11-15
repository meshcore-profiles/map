import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { useTheme } from '../state/ThemeContext';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';
import { Label } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { DEFAULT_BASEMAP_SELECTION } from '@meshcore-map/core/basemaps';

const styles = StyleSheet.create({
	row: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.chip },
	rowText: { flex: 1, gap: 2 },
	name: { color: colors.text, fontSize: 15 },
	info: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
});

const GROUP_LABELS = { tiles: 'map:tileBaseMaps', vector: 'map:vectorBaseMaps' };

export const BasemapSheet = ({ visible, onClose, basemaps, selection, onSelect }) => {
	const { t, tRaw } = useI18n();
	const { accent, accentBright } = useTheme();

	const option = (value, name, info) => {
		const active = selection === value;

		return (
			<Pressable key={value} style={[styles.row, active && { borderColor: accentBright, backgroundColor: accent + '33' }]} onPress={() => onSelect(value)} accessibilityRole="button" accessibilityState={{ selected: active }}>
				<View style={styles.rowText}>
					<Text style={styles.name}>{name}</Text>
					{info ? <Text style={styles.info}>{info}</Text> : null}
				</View>
				{active && <Icon name="check" size={20} color={accentBright} />}
			</Pressable>
		);
	};

	return (
		<Sheet visible={visible} title={t('map:basemapToggleTitle')} onClose={onClose}>
			{option(DEFAULT_BASEMAP_SELECTION, t('map:defaultBasemap'), tRaw('map:baseMapInfo')?.[basemaps.defaultName])}
			{['tiles', 'vector'].map(group => {
				const items = basemaps.all.filter(basemap => basemap.group === group);
				if (!items.length) return null;

				return (
					<View key={group} style={{ gap: spacing.sm }}>
						<Label>{t(GROUP_LABELS[group])}</Label>
						{items.map(basemap => option(basemap.name, basemap.name, tRaw('map:baseMapInfo')?.[basemap.name]))}
					</View>
				);
			})}
		</Sheet>
	);
};
