import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';

const styles = StyleSheet.create({
	panel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.panel, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
	header: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg },
	title: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700', paddingVertical: spacing.md },
	close: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
	closeText: { color: colors.textMuted, fontSize: 18 },
	content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md },
});

// Tool panel docked at the bottom - unlike Sheet it does not block the map, so points can still be picked.
export const ToolPanel = ({ title, onClose, children }) => {
	const { t } = useI18n();
	const insets = useSafeAreaInsets();
	const { height } = useWindowDimensions();

	return (
		<View style={[styles.panel, { paddingBottom: insets.bottom, maxHeight: height * 0.5 }]}>
			<View style={styles.header}>
				<Text style={styles.title} accessibilityRole="header">{title}</Text>
				<Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel={t('close')}>
					<Text style={styles.closeText}>✕</Text>
				</Pressable>
			</View>
			<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
		</View>
	);
};
