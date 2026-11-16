import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../state/ThemeContext';
import { colors, MIN_TOUCH, radius, shadow, spacing } from '../theme';
import { haptics } from './haptics';
import { Icon } from './Icon';

const styles = StyleSheet.create({
	button: { minHeight: MIN_TOUCH, borderRadius: radius.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
	secondary: { backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.border },
	ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderStrong },
	danger: { backgroundColor: colors.red },
	pressed: { opacity: 0.8 },
	disabled: { opacity: 0.45 },
	buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
	ghostText: { color: colors.text },
	chip: { minHeight: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
	chipText: { color: colors.textMuted, fontSize: 14 },
	chipTextSelected: { color: colors.text, fontWeight: '600' },
	chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
	chipScroll: { gap: spacing.sm, paddingRight: spacing.lg },
	label: { color: colors.text, fontSize: 16, fontWeight: '600' },
	hint: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
	field: { gap: spacing.xs },
	fieldLabel: { color: colors.textMuted, fontSize: 14 },
	input: { minHeight: MIN_TOUCH, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: spacing.md, backgroundColor: colors.bg },
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
	stat: { flexGrow: 1, flexBasis: '30%', backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.md, gap: 2 },
	statLabel: { color: colors.textMuted, fontSize: 14 },
	statValue: { color: colors.text, fontSize: 17, fontWeight: '700' },
	section: { gap: spacing.md },
	heading: { color: colors.textMuted, fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
	collapseHead: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
	collapseTitle: { flex: 1, color: colors.text, fontSize: 16 },
	collapseSummary: { color: colors.textMuted, fontSize: 14 },
	collapseBody: { gap: spacing.md, paddingBottom: spacing.md },
	option: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.chip },
	optionDisabled: { opacity: 0.5 },
	optionText: { flex: 1, gap: 2 },
	optionLabel: { color: colors.text, fontSize: 15 },
	optionInfo: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
	dropdownHead: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
	dropdownValue: { flex: 1, color: colors.text, fontSize: 15 },
	dropdownPlaceholder: { color: colors.textMuted },
	dropdownMenu: { position: 'absolute', maxHeight: 280, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.panelSolid, overflow: 'hidden', ...shadow },
	dropdownItem: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md },
	dropdownItemText: { flex: 1, color: colors.text, fontSize: 15 },
	divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});

export const Button = ({ label, onPress, variant = 'primary', disabled, style, icon }) => {
	const { accent } = useTheme();
	const filled = variant === 'primary' || variant === 'danger';

	return (
		<Pressable
			onPress={event => {
				haptics.tap();
				onPress?.(event);
			}}
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
	const { accent, accentBright } = useTheme();
	const fill = color ?? accent;

	return (
		<Pressable
			onPress={event => {
				haptics.select();
				onPress?.(event);
			}}
			accessibilityRole="checkbox"
			accessibilityState={{ checked: selected }}
			style={[styles.chip, selected && { backgroundColor: `${fill}26`, borderColor: `${fill}99` }]}
		>
			{icon && <Icon name={icon} size={16} color={selected ? (color ?? accentBright) : colors.textMuted} />}
			<Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
		</Pressable>
	);
};

export const ChipScroll = ({ children }) => (
	<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll} keyboardShouldPersistTaps="handled">{children}</ScrollView>
);

export const ChipRow = ({ children }) => <View style={styles.chipRow}>{children}</View>;

export const Label = ({ children }) => <Text style={styles.label}>{children}</Text>;

export const Hint = ({ children, style }) => <Text style={[styles.hint, style]}>{children}</Text>;

export const Field = ({ label, style, ...props }) => (
	<View style={styles.field}>
		{label && <Text style={styles.fieldLabel}>{label}</Text>}
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
					<Pressable
						key={option.value}
						onPress={() => {
							if (!selected) haptics.select();
							onChange(option.value);
						}}
						accessibilityRole="radio"
						accessibilityState={{ selected }}
						style={[styles.segment, selected && { backgroundColor: `${accent}33`, borderColor: accent }]}
					>
						<Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
					</Pressable>
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
			<Pressable style={styles.stepButton} onPress={() => step(Math.max(min, value - 1))} accessibilityRole="button" accessibilityLabel="-"><Text style={styles.stepText}>-</Text></Pressable>
			<Text style={styles.stepValue}>{value}</Text>
			<Pressable style={styles.stepButton} onPress={() => step(Math.min(max, value + 1))} accessibilityRole="button" accessibilityLabel="+"><Text style={styles.stepText}>+</Text></Pressable>
		</View>
	);
};

export const Stat = ({ label, value, tone }) => (
	<View style={styles.stat}>
		<Text style={styles.statLabel}>{label}</Text>
		<Text style={[styles.statValue, tone === 'bad' && { color: colors.redBright }, tone === 'good' && { color: colors.green }]}>{value}</Text>
	</View>
);

export const Option = ({ label, info, selected, disabled, onPress }) => {
	const { accent, accentBright } = useTheme();

	return (
		<Pressable style={[styles.option, selected && { borderColor: accentBright, backgroundColor: `${accent}33` }, disabled && styles.optionDisabled]} disabled={disabled} onPress={() => {
			haptics.select();
			onPress?.();
		}} accessibilityRole="radio" accessibilityState={{ selected, disabled: Boolean(disabled) }}>
			<View style={styles.optionText}>
				<Text style={styles.optionLabel}>{label}</Text>
				{info ? <Text style={styles.optionInfo}>{info}</Text> : null}
			</View>
			{selected && <Icon name="check" size={20} color={accentBright} />}
		</Pressable>
	);
};

// A menu that floats over the screen under the field (above it when there is no room below), like a browser's select; it does not push the content.
// Value null shows the placeholder.
export const Dropdown = ({ options, value, onChange, placeholder, accessibilityLabel }) => {
	const { accentBright } = useTheme();
	const insets = useSafeAreaInsets();
	const { height: windowHeight } = useWindowDimensions();
	const headRef = useRef(null);
	const [anchor, setAnchor] = useState(null);
	const selected = options.find(option => option.value === value);

	const open = () => {
		haptics.tap();
		headRef.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
	};

	const close = () => setAnchor(null);

	// The menu is as tall as its rows (up to the cap) and opens on the side with more room.
	const menuStyle = () => {
		const gap = 4;
		const wanted = Math.min(280, options.length * MIN_TOUCH);
		const below = windowHeight - insets.bottom - (anchor.y + anchor.height) - gap - spacing.sm;
		const above = anchor.y - insets.top - gap - spacing.sm;
		const base = { left: anchor.x, width: anchor.width };

		if (below >= wanted || below >= above) return { ...base, top: anchor.y + anchor.height + gap, maxHeight: Math.min(280, below) };

		return { ...base, bottom: windowHeight - anchor.y + gap, maxHeight: Math.min(280, above) };
	};

	return (
		<View>
			<Pressable ref={headRef} collapsable={false} style={styles.dropdownHead} onPress={open} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ expanded: Boolean(anchor) }}>
				<Text style={[styles.dropdownValue, !selected && styles.dropdownPlaceholder]} numberOfLines={1}>{selected ? selected.label : placeholder}</Text>
				<Svg width={16} height={16} viewBox="0 0 24 24">
					<Path d="M6 9l6 6 6-6" fill="none" stroke={colors.textMuted} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
				</Svg>
			</Pressable>
			<Modal visible={Boolean(anchor)} transparent animationType="fade" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
				<Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={accessibilityLabel} />
				{anchor && (
					<ScrollView style={[styles.dropdownMenu, menuStyle()]} keyboardShouldPersistTaps="handled" accessibilityRole="menu">
						{options.map(option => (
							<Pressable key={option.value} style={({ pressed }) => [styles.dropdownItem, pressed && { backgroundColor: colors.chip }]} onPress={() => {
								haptics.select();
								close();
								onChange(option.value);
							}} accessibilityRole="menuitem" accessibilityState={{ selected: option.value === value }}>
								<Text style={[styles.dropdownItemText, option.value === value && { color: accentBright, fontWeight: '600' }]} numberOfLines={2}>{option.label}</Text>
								{option.value === value && <Icon name="check" size={20} color={accentBright} />}
							</Pressable>
						))}
					</ScrollView>
				)}
			</Modal>
		</View>
	);
};

export const Divider = () => <View style={styles.divider} />;

export const Heading = ({ children }) => <Text style={styles.heading} accessibilityRole="header">{children}</Text>;

export const Section = ({ title, children }) => (
	<View style={styles.section}>
		{title && <Heading>{title}</Heading>}
		{children}
	</View>
);

export const Collapsible = ({ title, summary, children }) => {
	const [open, setOpen] = useState(false);

	return (
		<View>
			<Pressable style={styles.collapseHead} onPress={() => {
				haptics.tap();
				setOpen(current => !current);
			}} accessibilityRole="button" accessibilityState={{ expanded: open }}>
				<Text style={styles.collapseTitle}>{title}</Text>
				<Text style={styles.collapseSummary}>{summary}</Text>
				<Svg width={16} height={16} viewBox="0 0 24 24" style={open ? { transform: [{ rotate: '180deg' }] } : null}>
					<Path d="M6 9l6 6 6-6" fill="none" stroke={colors.textMuted} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
				</Svg>
			</Pressable>
			{open && <View style={styles.collapseBody}>{children}</View>}
		</View>
	);
};
