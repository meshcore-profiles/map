import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme } from '../state/ThemeContext';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';
import { Hint } from './Field';
import { haptics } from './haptics';
import { Icon } from './Icon';
import { Touchable } from './Touchable';

const styles = StyleSheet.create({
	switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH },
	switchText: { flex: 1, gap: 4 },
	switchLabel: { color: colors.text, fontSize: 16, fontWeight: '600' },
	segmented: { flexDirection: 'row', borderRadius: radius.md, backgroundColor: colors.bg, padding: 3 },
	segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: 'transparent' },
	segmentText: { color: colors.textMuted, fontWeight: '600', fontSize: 15 },
	segmentTextSelected: { color: colors.text },
	stepper: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.sm },
	stepButton: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.sm, backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
	stepText: { color: colors.text, fontSize: 22 },
	stepValue: { color: colors.text, fontSize: 18, fontWeight: '700', minWidth: 36, textAlign: 'center' },
	option: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.chip },
	optionDisabled: { opacity: 0.5 },
	optionText: { flex: 1, gap: 2 },
	optionLabel: { color: colors.text, fontSize: 15 },
	optionInfo: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
});

export const SwitchRow = ({ label, value, onValueChange, description }) => {
	const { accent } = useTheme();

	return (
		<View style={styles.switchRow}>
			<View style={styles.switchText}>
				<Text style={styles.switchLabel}>{label}</Text>
				{description && <Hint>{description}</Hint>}
			</View>
			<Switch value={value} onValueChange={next => {
				haptics.select();
				onValueChange(next);
			}} trackColor={{ false: colors.borderStrong, true: accent }} thumbColor={value ? '#fff' : colors.textMuted} ios_backgroundColor={colors.borderStrong} accessibilityLabel={label} />
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
					<Touchable
						key={option.value}
						haptic={selected ? null : 'select'}
						onPress={() => onChange(option.value)}
						accessibilityRole="radio"
						accessibilityState={{ selected }}
						style={[styles.segment, selected && { backgroundColor: `${accent}33`, borderColor: accent }]}
					>
						<Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
					</Touchable>
				);
			})}
		</View>
	);
};

export const Stepper = ({ value, min, max, onChange, label }) => {
	const step = next => {
		if (next === value) return;

		haptics.select();
		onChange(next);
	};

	return (
		<View style={styles.stepper} accessibilityLabel={label}>
			<Touchable haptic={null} style={styles.stepButton} onPress={() => step(Math.max(min, value - 1))} accessibilityLabel="-"><Text style={styles.stepText}>-</Text></Touchable>
			<Text style={styles.stepValue}>{value}</Text>
			<Touchable haptic={null} style={styles.stepButton} onPress={() => step(Math.min(max, value + 1))} accessibilityLabel="+"><Text style={styles.stepText}>+</Text></Touchable>
		</View>
	);
};

export const Option = ({ label, info, selected, disabled, onPress }) => {
	const { accent, accentBright } = useTheme();

	return (
		<Touchable
			haptic="select"
			style={[styles.option, selected && { borderColor: accentBright, backgroundColor: `${accent}33` }, disabled && styles.optionDisabled]}
			disabled={disabled}
			onPress={onPress}
			accessibilityRole="radio"
			accessibilityState={{ selected, disabled: Boolean(disabled) }}
		>
			<View style={styles.optionText}>
				<Text style={styles.optionLabel}>{label}</Text>
				{info ? <Text style={styles.optionInfo}>{info}</Text> : null}
			</View>
			{selected && <Icon name="check" size={20} color={accentBright} />}
		</Touchable>
	);
};
