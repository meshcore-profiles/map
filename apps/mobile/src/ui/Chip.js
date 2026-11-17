import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../state/ThemeContext';
import { colors, spacing } from '../theme';
import { Icon } from './Icon';
import { Touchable } from './Touchable';

const styles = StyleSheet.create({
	chip: { minHeight: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
	text: { color: colors.textMuted, fontSize: 14 },
	textSelected: { color: colors.text, fontWeight: '600' },
	row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
	scroll: { gap: spacing.sm, paddingRight: spacing.lg },
});

// A toggle chip; color overrides the theme accent (e.g. a node type's color).
export const Chip = ({ label, selected, onPress, color, icon }) => {
	const { accent, accentBright } = useTheme();
	const fill = color ?? accent;

	return (
		<Touchable
			haptic="select"
			onPress={onPress}
			accessibilityRole="checkbox"
			accessibilityState={{ checked: selected }}
			style={[styles.chip, selected && { backgroundColor: `${fill}26`, borderColor: `${fill}99` }]}
		>
			{icon && <Icon name={icon} size={16} color={selected ? (color ?? accentBright) : colors.textMuted} />}
			<Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
		</Touchable>
	);
};

export const ChipScroll = ({ children }) => (
	<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">{children}</ScrollView>
);

export const ChipRow = ({ children }) => <View style={styles.row}>{children}</View>;
