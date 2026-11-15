import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { useNodes, useNodesStatus } from '../state/NodesContext';
import { useTheme } from '../state/ThemeContext';
import { colors, MIN_TOUCH, radius, shadow, spacing } from '../theme';
import { useToast } from '../ui/Toast';

const styles = StyleSheet.create({
	banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, ...shadow },
	content: { flex: 1, gap: spacing.xs },
	text: { flex: 1, color: colors.text, fontSize: 14 },
	action: { fontWeight: '700', paddingVertical: spacing.sm },
	bar: { height: 3, borderRadius: 2 },
});

// Download progress, an initial-load error, or a notice that the cached copy is shown because refreshing failed.
export const StatusBanner = () => {
	const { t } = useI18n();
	const { accent, accentBright } = useTheme();
	const { refresh, nodes } = useNodes();
	const { phase, progress: percent, error } = useNodesStatus();
	const showToast = useToast();
	const usingCache = Boolean(error) && nodes.length > 0;

	useEffect(() => {
		if (usingCache) showToast(t('mobile:offline.usingCache'), { status: 'error', duration: 6000 });
	}, [usingCache, showToast, t]);

	if (phase === 'loading' || phase === 'downloading') {
		return (
			<View style={styles.banner} accessibilityLiveRegion="polite">
				<ActivityIndicator color={accentBright} />
				<View style={styles.content}>
					<Text style={styles.text}>{phase === 'loading' ? t('mobile:loading.reading') : t('mobile:loading.downloading', { percent })}</Text>
					{phase === 'downloading' && <View style={[styles.bar, { width: `${percent}%`, backgroundColor: accent }]} />}
				</View>
			</View>
		);
	}

	if (!error || usingCache) return null;

	return (
		<View style={styles.banner} accessibilityLiveRegion="polite">
			<Text style={styles.text}>{t('mobile:loading.failed')}</Text>
			<Pressable onPress={() => refresh({ force: true })} accessibilityRole="button" hitSlop={8}>
				<Text style={[styles.action, { color: accentBright }]}>{t('mobile:loading.retry')}</Text>
			</Pressable>
		</View>
	);
};
