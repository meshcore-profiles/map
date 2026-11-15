import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useInsets } from '../hooks/useInsets';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';
import { useI18n } from '../i18n';

const styles = StyleSheet.create({
	root: { flex: 1, justifyContent: 'flex-end' },
	backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
	sheet: { maxHeight: '88%', backgroundColor: colors.panel, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
	handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: spacing.sm },
	header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
	title: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '700' },
	close: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
	closeText: { color: colors.textMuted, fontSize: 18 },
	content: { padding: spacing.lg, gap: spacing.md },
	footer: { padding: spacing.lg, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});

// Bottom sheet in a native Modal - dismissed by tapping the backdrop or the Back button.
export const Sheet = ({ visible, title, onClose, children, footer }) => {
	const { t } = useI18n();
	const insets = useInsets();

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
			<KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
				<Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('close')} />
				<View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
					<View style={styles.handle} />
					<View style={styles.header}>
						<Text style={styles.title} numberOfLines={2} accessibilityRole="header">{title}</Text>
						<Pressable onPress={onClose} style={styles.close} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('close')}>
							<Text style={styles.closeText}>✕</Text>
						</Pressable>
					</View>
					<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
					{footer && <View style={styles.footer}>{footer}</View>}
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
};
