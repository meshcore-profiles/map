import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { useNodes, useNodesStatus } from '../state/NodesContext';
import { useTheme } from '../state/ThemeContext';
import { colors, pill, shadow, spacing } from '../theme';
import { useToast } from '../ui/Toast';

const styles = StyleSheet.create({
	status: { ...pill, alignSelf: 'flex-start', maxWidth: '100%', overflow: 'hidden', ...shadow },
	text: { flexShrink: 1, color: colors.text, fontSize: 14, fontWeight: '500' },
	action: { fontSize: 14, fontWeight: '700', paddingVertical: spacing.sm },
	bar: { position: 'absolute', left: 0, bottom: 0, height: 3 },
});

export const StatusBanner = () => {
	const { t } = useI18n();
	const { accent, accentBright } = useTheme();
	const { refresh, cancel, nodes } = useNodes();
	const { phase, progress: percent, error } = useNodesStatus();
	const showToast = useToast();
	const usingCache = Boolean(error) && nodes.length > 0;

	useEffect(() => {
		if (usingCache) showToast(t('mobile:offline.usingCache'), { status: 'error', group: 'offline' });
	}, [usingCache, showToast, t]);

	if (phase === 'loading' || phase === 'downloading') {
		const downloading = phase === 'downloading';

		return (
			<View style={styles.status} accessibilityLiveRegion="polite">
				<ActivityIndicator size="small" color={accentBright} />
				<Text style={styles.text} numberOfLines={1}>{downloading ? t('mobile:loading.downloading', { percent }) : t('mobile:loading.reading')}</Text>
				{downloading && (
					<Pressable onPress={cancel} accessibilityRole="button" hitSlop={8}>
						<Text style={[styles.action, { color: accentBright }]}>{t('common:cancel')}</Text>
					</Pressable>
				)}
				{downloading && <View style={[styles.bar, { width: `${percent}%`, backgroundColor: accent }]} />}
			</View>
		);
	}

	if (!error || usingCache) return null;

	return (
		<View style={styles.status} accessibilityLiveRegion="polite">
			<Text style={styles.text} numberOfLines={2}>{error.canceled ? t('mobile:loading.canceled') : t('mobile:loading.failed')}</Text>
			<Pressable onPress={() => refresh({ force: true })} accessibilityRole="button" hitSlop={8}>
				<Text style={[styles.action, { color: accentBright }]}>{t('mobile:loading.retry')}</Text>
			</Pressable>
		</View>
	);
};
