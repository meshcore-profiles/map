import { Linking, StyleSheet, Text, View } from 'react-native';
import { GITHUB_URL } from '@meshcore-map/core/sites';
import Constants from 'expo-constants';
import { useI18n } from '../i18n';
import { useNodes } from '../state/NodesContext';
import { useSettings } from '../state/SettingsContext';
import { useTheme } from '../state/ThemeContext';
import { useRegionSwitch } from '../state/useRegionSwitch';
import { Button, Divider, Hint, Label, SegmentedControl } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { colors } from '../theme';

const styles = StyleSheet.create({
	value: { color: colors.text },
	heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

export const SettingsSheet = ({ visible, onClose }) => {
	const { t } = useI18n();
	const { accentBright } = useTheme();
	const { settings, update } = useSettings();
	const { nodes, fetchedAt, phase, refresh } = useNodes();
	const switchRegion = useRegionSwitch();

	return (
		<Sheet visible={visible} title={t('settings:title')} onClose={onClose}>
			<View style={styles.heading}><Icon name="globe" size={18} color={accentBright} /><Label>{t('mobile:region.title')}</Label></View>
			<SegmentedControl
				value={settings.region}
				onChange={switchRegion}
				options={[{ value: 'pl', label: t('map:polandOnlyLabel') }, { value: 'all', label: t('map:allNodesLabel') }]}
			/>
			<Hint>{t('mobile:region.desc')}</Hint>

			<Divider />
			<Label>{t('common:langLabel')}</Label>
			<SegmentedControl
				value={settings.language}
				onChange={language => update({ language })}
				options={[{ value: 'auto', label: t('mobile:settings.languageAuto') }, { value: 'pl', label: 'Polski' }, { value: 'en', label: 'English' }]}
			/>

			<Divider />
			<View style={styles.heading}><Icon name="chart" size={18} color={accentBright} /><Label>{t('mobile:settings.data')}</Label></View>
			<Text style={styles.value}>{fetchedAt ? t('mobile:settings.updated', { time: new Date(fetchedAt).toLocaleString() }) : t('mobile:settings.neverUpdated')}</Text>
			{nodes.length > 0 && <Hint>{t('mobile:settings.nodesCount', { count: nodes.length.toLocaleString() })}</Hint>}
			<Button variant="secondary" label={t('mobile:settings.refresh')} disabled={phase === 'downloading' || phase === 'loading'} onPress={() => refresh({ force: true })} />

			<Divider />
			<Button variant="secondary" icon="github" label={t('common:githubRepoTitle')} onPress={() => Linking.openURL(GITHUB_URL)} />
			<Hint>{t('mobile:settings.version', { version: Constants.expoConfig?.version ?? '' })}</Hint>
		</Sheet>
	);
};
