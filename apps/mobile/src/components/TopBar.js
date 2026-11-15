import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GITHUB_URL, SITES } from '@meshcore-map/core/sites';
import { API_BASE } from '../config';
import { apiHeaders } from '../data/http';
import { useI18n } from '../i18n';
import { useSettings } from '../state/SettingsContext';
import { useTheme } from '../state/ThemeContext';
import { useRegionSwitch } from '../state/useRegionSwitch';
import { colors, MIN_TOUCH, radius, shadow, spacing } from '../theme';
import { Icon } from '../ui/Icon';

const LOGO = 34;

const styles = StyleSheet.create({
	brandBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.sm, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, ...shadow },
	logo: { width: LOGO, height: LOGO, borderRadius: 8 },
	brandName: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '500' },
	button: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
	pills: { gap: spacing.sm, paddingTop: spacing.sm, paddingRight: spacing.sm },
	pill: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel },
	pillText: { color: colors.text, fontSize: 14, fontWeight: '600' },
});

const Pill = ({ icon, label, onPress, accent, accessibilityLabel }) => {
	const { accentBright } = useTheme();

	return (
		<Pressable onPress={onPress} style={({ pressed }) => [styles.pill, accent && { borderColor: accentBright }, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}>
			{icon && <Icon name={icon} size={18} color={accent ? accentBright : colors.text} />}
			{label ? <Text style={styles.pillText}>{label}</Text> : null}
		</Pressable>
	);
};

// Brand row and quick actions, like the website's header (#stats-bar): logo, statistics, region, map layer, language, GitHub.
export const TopBar = ({ onStats, onBasemap, children }) => {
	const { t, language } = useI18n();
	const { accentBright } = useTheme();
	const { settings, update } = useSettings();
	const switchRegion = useRegionSwitch();
	const site = SITES[settings.region ?? 'all'];
	const logo = site.icon192.startsWith('/') ? `${API_BASE}${site.icon192}` : site.icon192;
	const pl = settings.region === 'pl';

	return (
		<View>
			<View style={styles.brandBar}>
				<Image source={{ uri: logo, headers: apiHeaders() }} style={styles.logo} accessibilityIgnoresInvertColors />
				<Text style={styles.brandName} numberOfLines={1}>
					{site.brandAccent ? site.brandName.slice(0, -site.brandAccent.length) : site.brandName}{site.brandAccent ? <Text style={{ color: accentBright, fontWeight: '700' }}>{site.brandAccent}</Text> : null}
				</Text>
				<Pressable style={styles.button} onPress={onStats} accessibilityRole="button" accessibilityLabel={t('stats:toggleTitle')}>
					<Icon name="chart" size={22} color={colors.text} />
				</Pressable>
			</View>
			{children}
			<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills} keyboardShouldPersistTaps="handled">
				<Pill icon="globe" label={pl ? t('map:polandOnlyLabel') : t('map:allNodesLabel')} accessibilityLabel={t(pl ? 'map:showAllWorld' : 'map:showPolandOnly')} onPress={() => switchRegion(pl ? 'all' : 'pl')} accent />
				<Pill icon="layers" label={t('map:changeMapLabel')} accessibilityLabel={t('map:basemapToggleTitle')} onPress={onBasemap} />
				<Pill label={language === 'pl' ? 'Polski' : 'English'} accessibilityLabel={t('common:langLabel')} onPress={() => update({ language: language === 'pl' ? 'en' : 'pl' })} />
				<Pill icon="github" accessibilityLabel={t('common:githubRepoTitle')} onPress={() => Linking.openURL(GITHUB_URL)} />
			</ScrollView>
		</View>
	);
};
