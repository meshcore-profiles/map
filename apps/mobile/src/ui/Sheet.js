import { Animated, BackHandler, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { useSheetMotion } from './useSheetMotion';
import { colors, MIN_TOUCH, radius, shadow, spacing } from '../theme';
import { useI18n } from '../i18n';

// Share of the window height the docked panel may take; the camera padding in MapScreen relies on it.
export const DOCKED_MAX_HEIGHT = 0.5;
export const DOCKED_EXPANDED_MAX_HEIGHT = 0.88;

const styles = StyleSheet.create({
	root: { flex: 1, justifyContent: 'flex-end' },
	backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
	sheet: { backgroundColor: colors.panelSolid, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
	docked: { position: 'absolute', left: 0, right: 0, bottom: 0 },
	dockedSheet: shadow,
	grip: { paddingTop: spacing.sm },
	handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong },
	header: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg, paddingRight: spacing.sm, paddingTop: spacing.sm },
	title: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '700' },
	close: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
	content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: spacing.md },
	footer: { padding: spacing.lg, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});

export const SheetGrip = () => <View style={styles.grip}><View style={styles.handle} /></View>;

const SheetHeader = ({ title, close, panHandlers }) => {
	const { t } = useI18n();

	return (
		<View {...panHandlers}>
			<SheetGrip />
			<View style={styles.header}>
				<Text style={styles.title} numberOfLines={2} accessibilityRole="header">{title}</Text>
				<Pressable onPress={close} style={styles.close} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('close')}>
					<Icon name="close" size={20} color={colors.textMuted} />
				</Pressable>
			</View>
		</View>
	);
};

export const Sheet = ({ visible, title, onClose, children, footer }) => {
	const { t } = useI18n();
	const insets = useSafeAreaInsets();
	const { height } = useWindowDimensions();
	const { translateY, backdropOpacity, panHandlers, close } = useSheetMotion({ visible, onClose });

	return (
		<Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
			<KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
				<Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
					<Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={t('close')} />
				</Animated.View>
				<Animated.View style={[styles.sheet, { maxHeight: height * 0.88, paddingBottom: insets.bottom, transform: [{ translateY }] }]}>
					<SheetHeader title={title} close={close} panHandlers={panHandlers} />
					<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
					{footer && <View style={styles.footer}>{footer}</View>}
				</Animated.View>
			</KeyboardAvoidingView>
		</Modal>
	);
};

export const DockedSheet = ({ title, visible = true, onClose, onExited, children, footer }) => {
	const insets = useSafeAreaInsets();
	const { height } = useWindowDimensions();
	const { translateY, maxHeight, panHandlers, close } = useSheetMotion({ visible, onClose, animateOut: true, onExited, snaps: [height * DOCKED_MAX_HEIGHT, height * DOCKED_EXPANDED_MAX_HEIGHT] });

	useEffect(() => {
		if (!visible) return undefined;

		const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
			close();
			return true;
		});

		return () => subscription.remove();
	}, [visible, close]);

	return (
		// Two nodes: an Animated node cannot mix drivers, and the slide (transform) is native while the resize (maxHeight, a layout property) is not.
		<Animated.View style={[styles.docked, { transform: [{ translateY }] }]}>
			<Animated.View style={[styles.sheet, styles.dockedSheet, { maxHeight, paddingBottom: insets.bottom }]}>
				<SheetHeader title={title} close={close} panHandlers={panHandlers} />
				<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bounces={false}>{children}</ScrollView>
				{footer && <View style={styles.footer}>{footer}</View>}
			</Animated.View>
		</Animated.View>
	);
};
