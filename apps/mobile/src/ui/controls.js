import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useTheme } from '../state/ThemeContext';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';
import { Icon } from './Icon';

const styles = StyleSheet.create({
	button: { minHeight: MIN_TOUCH, borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
	secondary: { backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.border },
	ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderStrong },
	danger: { backgroundColor: colors.red },
	pressed: { opacity: 0.8 },
	disabled: { opacity: 0.45 },
	buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
	ghostText: { color: colors.text },
	chip: { minHeight: 36, paddingHorizontal: spacing.md, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.chip, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
	chipText: { color: colors.text, fontSize: 14 },
	chipTextSelected: { color: '#fff', fontWeight: '700' },
	chipTextOnColor: { color: '#0b0e14', fontWeight: '700' },
	chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
	label: { color: colors.text, fontSize: 14, fontWeight: '600' },
	hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
	field: { gap: spacing.xs },
	input: { minHeight: MIN_TOUCH, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: spacing.md, backgroundColor: colors.bg },
	switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH },
	switchText: { flex: 1, gap: 2 },
	switchLabel: { color: colors.text, fontSize: 15 },
	segmented: { flexDirection: 'row', borderRadius: radius.md, backgroundColor: colors.bg, padding: 3 },
	segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
	segmentText: { color: colors.textMuted, fontWeight: '600' },
	segmentTextSelected: { color: '#fff' },
	stepper: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.sm },
	stepButton: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.sm, backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
	stepText: { color: colors.text, fontSize: 22 },
	stepValue: { color: colors.text, fontSize: 18, fontWeight: '700', minWidth: 36, textAlign: 'center' },
	stat: { flexGrow: 1, flexBasis: '30%', backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.md, gap: 2 },
	statLabel: { color: colors.textMuted, fontSize: 12 },
	statValue: { color: colors.text, fontSize: 16, fontWeight: '700' },
	divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});

export const Button = ({ label, onPress, variant = 'primary', disabled, style, icon }) => {
	const { accent } = useTheme();
	const filled = variant === 'primary' || variant === 'danger';

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityState={{ disabled }}
			style={({ pressed }) => [styles.button, styles[variant], variant === 'primary' && { backgroundColor: accent }, pressed && styles.pressed, disabled && styles.disabled, style]}
		>
			{icon && <Icon name={icon} size={18} color={filled ? '#fff' : colors.text} />}
			<Text style={[styles.buttonText, !filled && styles.ghostText]}>{label}</Text>
		</Pressable>
	);
};

export const Chip = ({ label, selected, onPress, color, icon }) => {
	const { accent } = useTheme();
	const fill = color ?? accent;

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="checkbox"
			accessibilityState={{ checked: selected }}
			style={[styles.chip, selected && { backgroundColor: fill, borderColor: fill }]}
		>
			{icon && <Icon name={icon} size={16} color={selected ? (color ? '#0b0e14' : '#fff') : colors.textMuted} />}
			<Text style={[styles.chipText, selected && (color ? styles.chipTextOnColor : styles.chipTextSelected)]}>{label}</Text>
		</Pressable>
	);
};

export const ChipRow = ({ children }) => <View style={styles.chipRow}>{children}</View>;

export const Label = ({ children }) => <Text style={styles.label}>{children}</Text>;

export const Hint = ({ children }) => <Text style={styles.hint}>{children}</Text>;

export const Field = ({ label, style, ...props }) => (
	<View style={styles.field}>
		{label && <Label>{label}</Label>}
		<TextInput placeholderTextColor={colors.textMuted} autoCorrect={false} autoCapitalize="none" {...props} style={[styles.input, style]} />
	</View>
);

export const SwitchRow = ({ label, value, onValueChange, description }) => {
	const { accent } = useTheme();

	return (
		<View style={styles.switchRow}>
			<View style={styles.switchText}>
				<Text style={styles.switchLabel}>{label}</Text>
				{description && <Hint>{description}</Hint>}
			</View>
			<Switch value={value} onValueChange={onValueChange} trackColor={{ true: accent }} accessibilityLabel={label} />
		</View>
	);
};

export const SegmentedControl = ({ options, value, onChange }) => {
	const { accent } = useTheme();

	return (
		<View style={styles.segmented} accessibilityRole="radiogroup">
			{options.map(option => {
				const selected = option.value === value;

				return (
					<Pressable
						key={option.value}
						onPress={() => onChange(option.value)}
						accessibilityRole="radio"
						accessibilityState={{ selected }}
						style={[styles.segment, selected && { backgroundColor: accent }]}
					>
						<Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
					</Pressable>
				);
			})}
		</View>
	);
};

export const Stepper = ({ value, min, max, onChange, label }) => (
	<View style={styles.stepper} accessibilityLabel={label}>
		<Pressable style={styles.stepButton} onPress={() => onChange(Math.max(min, value - 1))} accessibilityRole="button" accessibilityLabel="-"><Text style={styles.stepText}>-</Text></Pressable>
		<Text style={styles.stepValue}>{value}</Text>
		<Pressable style={styles.stepButton} onPress={() => onChange(Math.min(max, value + 1))} accessibilityRole="button" accessibilityLabel="+"><Text style={styles.stepText}>+</Text></Pressable>
	</View>
);

export const Stat = ({ label, value, tone }) => (
	<View style={styles.stat}>
		<Text style={styles.statLabel}>{label}</Text>
		<Text style={[styles.statValue, tone === 'bad' && { color: colors.redBright }, tone === 'good' && { color: colors.green }]}>{value}</Text>
	</View>
);

export const Divider = () => <View style={styles.divider} />;
