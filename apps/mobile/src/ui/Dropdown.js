import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../state/ThemeContext';
import { colors, MIN_TOUCH, radius, shadow, spacing } from '../theme';
import { Chevron } from './Chevron';
import { Icon } from './Icon';
import { Backdrop, OverlayModal } from './Overlay';
import { Touchable } from './Touchable';

const MENU_MAX_HEIGHT = 280;
const MENU_GAP = 4;

const styles = StyleSheet.create({
	head: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
	value: { flex: 1, color: colors.text, fontSize: 15 },
	placeholder: { color: colors.textMuted },
	menu: { position: 'absolute', maxHeight: MENU_MAX_HEIGHT, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.panelSolid, overflow: 'hidden', ...shadow },
	item: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md },
	itemText: { flex: 1, color: colors.text, fontSize: 15 },
});

// A menu that floats over the screen under the field (above it when there is no room below), like a browser's select; it does not push the content.
// Value null shows the placeholder.
export const Dropdown = ({ options, value, onChange, placeholder, accessibilityLabel }) => {
	const { accentBright } = useTheme();
	const insets = useSafeAreaInsets();
	const { height: windowHeight } = useWindowDimensions();
	const headRef = useRef(null);
	const [anchor, setAnchor] = useState(null);
	const selected = options.find(option => option.value === value);

	const open = () => headRef.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
	const close = () => setAnchor(null);

	// The menu is as tall as its rows (up to the cap) and opens on the side with more room.
	const menuStyle = () => {
		const wanted = Math.min(MENU_MAX_HEIGHT, options.length * MIN_TOUCH);
		const below = windowHeight - insets.bottom - (anchor.y + anchor.height) - MENU_GAP - spacing.sm;
		const above = anchor.y - insets.top - MENU_GAP - spacing.sm;
		const base = { left: anchor.x, width: anchor.width };

		if (below >= wanted || below >= above) return { ...base, top: anchor.y + anchor.height + MENU_GAP, maxHeight: Math.min(MENU_MAX_HEIGHT, below) };

		return { ...base, bottom: windowHeight - anchor.y + MENU_GAP, maxHeight: Math.min(MENU_MAX_HEIGHT, above) };
	};

	return (
		<View>
			<Touchable ref={headRef} collapsable={false} style={styles.head} onPress={open} accessibilityLabel={accessibilityLabel} accessibilityState={{ expanded: Boolean(anchor) }}>
				<Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>{selected ? selected.label : placeholder}</Text>
				<Chevron />
			</Touchable>
			<OverlayModal visible={Boolean(anchor)} animationType="fade" onRequestClose={close}>
				<Backdrop dimmed={false} onPress={close} label={accessibilityLabel} />
				{anchor && (
					<ScrollView style={[styles.menu, menuStyle()]} keyboardShouldPersistTaps="handled" accessibilityRole="menu">
						{options.map(option => (
							<Touchable
								key={option.value}
								haptic="select"
								style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.chip }]}
								onPress={() => {
									close();
									onChange(option.value);
								}}
								accessibilityRole="menuitem"
								accessibilityState={{ selected: option.value === value }}
							>
								<Text style={[styles.itemText, option.value === value && { color: accentBright, fontWeight: '600' }]} numberOfLines={2}>{option.label}</Text>
								{option.value === value && <Icon name="check" size={20} color={accentBright} />}
							</Touchable>
						))}
					</ScrollView>
				)}
			</OverlayModal>
		</View>
	);
};
