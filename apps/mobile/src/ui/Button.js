import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../state/ThemeContext';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';
import { Icon } from './Icon';
import { Touchable } from './Touchable';

const styles = StyleSheet.create({
	button: { minHeight: MIN_TOUCH, borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
	secondary: { backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.border },
	ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderStrong },
	danger: { backgroundColor: colors.red },
	pressed: { opacity: 0.8 },
	disabled: { opacity: 0.45 },
	text: { color: '#fff', fontWeight: '700', fontSize: 16 },
	ghostText: { color: colors.text },
});

// variant: primary (theme accent), danger, secondary, ghost.
export const Button = ({ label, onPress, variant = 'primary', disabled, style, icon }) => {
	const { accent } = useTheme();
	const filled = variant === 'primary' || variant === 'danger';

	return (
		<Touchable
			onPress={onPress}
			disabled={disabled}
			accessibilityState={{ disabled }}
			style={({ pressed }) => [styles.button, styles[variant], variant === 'primary' && { backgroundColor: accent }, pressed && styles.pressed, disabled && styles.disabled, style]}
		>
			{icon && <Icon name={icon} size={18} color={filled ? '#fff' : colors.text} />}
			<Text style={[styles.text, !filled && styles.ghostText]}>{label}</Text>
		</Touchable>
	);
};
