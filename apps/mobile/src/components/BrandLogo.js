import { Image, StyleSheet, View } from 'react-native';
import { SITES } from '@meshcore-map/core/sites';
import { API_BASE } from '../config';
import { apiHeaders } from '../data/http';
import { useSettings } from '../state/SettingsContext';
import { colors, MIN_TOUCH } from '../theme';

const LOGO = 34;

const styles = StyleSheet.create({
	box: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
	logo: { width: LOGO, height: LOGO, borderRadius: 8, backgroundColor: colors.bg },
});

// The site's logo at the start of the search bar.
export const BrandLogo = () => {
	const { settings } = useSettings();
	const { logo, icon192, mobileLogo } = SITES[settings.region ?? 'all'];
	// The header logo, or the PNG icon when that is an SVG (React Native cannot draw SVG images).
	const source = mobileLogo ?? (logo.endsWith('.svg') ? icon192 : logo);
	const uri = source.startsWith('/') ? `${API_BASE}${source}` : source;

	return (
		<View style={styles.box}>
			<Image source={{ uri, headers: apiHeaders() }} style={styles.logo} accessibilityIgnoresInvertColors />
		</View>
	);
};
