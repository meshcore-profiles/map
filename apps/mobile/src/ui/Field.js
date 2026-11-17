import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';

const styles = StyleSheet.create({
	label: { color: colors.text, fontSize: 16, fontWeight: '600' },
	hint: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
	field: { gap: spacing.xs },
	fieldLabel: { color: colors.textMuted, fontSize: 14 },
	input: { minHeight: MIN_TOUCH, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: spacing.md, backgroundColor: colors.bg },
});

export const Label = ({ children }) => <Text style={styles.label}>{children}</Text>;

export const Hint = ({ children, style }) => <Text style={[styles.hint, style]}>{children}</Text>;

export const Field = ({ label, style, ...props }) => (
	<View style={styles.field}>
		{label && <Text style={styles.fieldLabel}>{label}</Text>}
		<TextInput placeholderTextColor={colors.textMuted} autoCorrect={false} autoCapitalize="none" {...props} style={[styles.input, style]} />
	</View>
);
