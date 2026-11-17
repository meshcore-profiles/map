import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { colors, pill, shadow, TOP_BAR_HEIGHT } from '../theme';
import { Icon } from '../ui/Icon';
import { Touchable } from '../ui/Touchable';

const styles = StyleSheet.create({
	banner: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
	pill: { ...pill, maxWidth: '100%', ...shadow },
	text: { flexShrink: 1, color: colors.text, fontSize: 14, fontWeight: '500' },
});

// Tells that only a chosen set of nodes is shown ("Show on map" in the statistics); a tap brings the filtered map back.
export const FocusBanner = ({ count, onClose }) => {
	const { t, tRaw, plural } = useI18n();
	const insets = useSafeAreaInsets();

	return (
		<View pointerEvents="box-none" style={[styles.banner, { top: insets.top + TOP_BAR_HEIGHT }]}>
			<Touchable style={styles.pill} onPress={onClose} accessibilityLabel={t('common:close')}>
				<Text style={styles.text}>{t('map:highlightedNodes', { count, unit: plural(count, tRaw('map:newNodeUnit')) })}</Text>
				<Icon name="close" size={18} color={colors.textMuted} />
			</Touchable>
		</View>
	);
};
