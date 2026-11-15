import { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { useTheme } from '../state/ThemeContext';
import { DOCKED_EXPANDED_MAX_HEIGHT, DOCKED_MAX_HEIGHT, SheetGrip } from './Sheet';
import { Icon } from './Icon';
import { useKeyboardHeight } from './useKeyboardHeight';
import { useSheetMotion } from './useSheetMotion';
import { colors, MIN_TOUCH, radius, shadow, spacing } from '../theme';

// Handle plus the title row: all that stays visible when the panel is collapsed (the safe-area inset is added on top).
const COLLAPSED_HEIGHT = 12 + MIN_TOUCH + spacing.sm;

const styles = StyleSheet.create({
	root: { position: 'absolute', left: 0, right: 0, bottom: 0 },
	panel: { backgroundColor: colors.panelSolid, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, ...shadow },
	header: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg, gap: spacing.sm },
	title: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700', paddingVertical: spacing.sm },
	close: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
	content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md },
});

// Tool panel docked at the bottom - unlike Sheet it does not block the map, so points can still be picked.
// The handle resizes it between collapsed (just the title, the tool stays active and the map is free), half and almost full height; only the close button ends the tool.
export const ToolPanel = ({ title, icon, onClose, children }) => {
	const { t } = useI18n();
	const { accentBright } = useTheme();
	const insets = useSafeAreaInsets();
	const { height } = useWindowDimensions();
	// With the keyboard open the panel sits on top of it (the keyboard covers the window, it does not resize it) and never grows past the space left above it.
	const keyboard = useKeyboardHeight();
	const bottomInset = keyboard > 0 ? 0 : insets.bottom;
	const available = height - keyboard - insets.top - spacing.lg;
	const { translateY, maxHeight, panHandlers, snapTo } = useSheetMotion({
		visible: true,
		onClose,
		snaps: [COLLAPSED_HEIGHT + bottomInset, Math.min(height * DOCKED_MAX_HEIGHT, available), Math.min(height * DOCKED_EXPANDED_MAX_HEIGHT, available)],
		initialSnap: 1,
		dismissable: false,
	});

	// Typing needs the fields in view: the panel opens fully while the keyboard is up and goes back to half height after it.
	const keyboardShown = keyboard > 0;
	const previousKeyboardShown = useRef(false);
	useEffect(() => {
		if (keyboardShown !== previousKeyboardShown.current) snapTo(keyboardShown ? 2 : 1);
		previousKeyboardShown.current = keyboardShown;
	}, [keyboardShown, snapTo]);

	return (
		// Two nodes: the slide-in (transform) is native-driven, the resize (maxHeight, a layout property) is not, and one Animated node cannot mix drivers.
		<Animated.View style={[styles.root, { bottom: keyboard, transform: [{ translateY }] }]}>
			<Animated.View style={[styles.panel, { paddingBottom: bottomInset, maxHeight }]}>
				<View {...panHandlers}>
					<SheetGrip />
					<View style={styles.header}>
						{icon && <Icon name={icon} size={20} color={accentBright} />}
						<Text style={styles.title} accessibilityRole="header">{title}</Text>
						<Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel={t('close')}>
							<Icon name="close" size={20} color={colors.textMuted} />
						</Pressable>
					</View>
				</View>
				<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
			</Animated.View>
		</Animated.View>
	);
};
