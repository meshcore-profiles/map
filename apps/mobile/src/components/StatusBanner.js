import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { useNodes } from '../state/NodesContext';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';

const styles = StyleSheet.create({
	banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH, backgroundColor: colors.panel, borderRadius: radius.md, paddingHorizontal: spacing.lg, elevation: 4 },
	text: { flex: 1, color: colors.text, fontSize: 14 },
	action: { color: colors.blue, fontWeight: '700', paddingVertical: spacing.sm },
	bar: { height: 3, borderRadius: 2, backgroundColor: colors.blue },
});

// Download progress, an initial-load error, or a notice that the cached copy is shown because refreshing failed.
export const StatusBanner = () => {
	const { t } = useI18n();
	const { phase, progress, error, refresh, nodes } = useNodes();

	if (phase === 'loading' || phase === 'downloading') {
		const percent = Math.round(progress * 100);
		return (
			<View style={styles.banner} accessibilityLiveRegion="polite">
				<ActivityIndicator color={colors.blue} />
				<View style={{ flex: 1, gap: spacing.xs }}>
					<Text style={styles.text}>{phase === 'loading' ? t('mobile:loading.reading') : t('mobile:loading.downloading', { percent })}</Text>
					{phase === 'downloading' && <View style={[styles.bar, { width: `${percent}%` }]} />}
				</View>
			</View>
		);
	}

	if (!error) return null;

	return (
		<View style={styles.banner} accessibilityLiveRegion="polite">
			<Text style={styles.text}>{nodes.length ? t('mobile:offline.usingCache') : t('mobile:loading.failed')}</Text>
			<Pressable onPress={() => refresh({ force: true })} accessibilityRole="button" hitSlop={8}>
				<Text style={styles.action}>{t('mobile:loading.retry')}</Text>
			</Pressable>
		</View>
	);
};
