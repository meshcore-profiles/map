import { Image, Pressable, StyleSheet } from 'react-native';
import { SITES } from '@meshcore-map/core/sites';
import { API_BASE } from '../config';
import { apiHeaders } from '../data/http';
import { useI18n } from '../i18n';
import { useSettings } from '../state/SettingsContext';
import { colors, MIN_TOUCH } from '../theme';

const LOGO = 30;

const styles = StyleSheet.create({
	button: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
	logo: { width: LOGO, height: LOGO, borderRadius: LOGO / 2, backgroundColor: colors.chip },
});

// The site's logo in the search bar; opens the settings.
export const BrandButton = ({ onPress }) => {
	const { t } = useI18n();
	const { settings } = useSettings();
	const { icon192, brandName } = SITES[settings.region ?? 'all'];
	const uri = icon192.startsWith('/') ? `${API_BASE}${icon192}` : icon192;

	return (
		<Pressable onPress={onPress} style={styles.button} accessibilityRole="button" accessibilityLabel={`${brandName}: ${t('settings:title')}`}>
			<Image source={{ uri, headers: apiHeaders() }} style={styles.logo} accessibilityIgnoresInvertColors />
		</Pressable>
	);
};
