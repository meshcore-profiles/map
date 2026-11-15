import { Linking, StyleSheet, Text } from 'react-native';
import { GITHUB_URL } from '@meshcore-map/core/sites';
import Constants from 'expo-constants';
import { useI18n } from '../i18n';
import { useNodes } from '../state/NodesContext';
import { useSettings } from '../state/SettingsContext';
import { useRegionSwitch } from '../state/useRegionSwitch';
import { Button, Divider, Hint, Section, SegmentedControl, SwitchRow } from '../ui/controls';
import { Sheet } from '../ui/Sheet';
import { colors } from '../theme';

const styles = StyleSheet.create({
	value: { color: colors.text, fontSize: 16 },
	version: { textAlign: 'center' },
});

export const SettingsSheet = ({ visible, onClose }) => {
	const { t } = useI18n();
	const { settings, update } = useSettings();
	const { nodes, fetchedAt, phase, refresh } = useNodes();
	const switchRegion = useRegionSwitch();

	return (
		<Sheet visible={visible} title={t('settings:title')} onClose={onClose}>
			<Section title={t('mobile:region.title')} icon="globe">
				<SegmentedControl
					value={settings.region}
					onChange={switchRegion}
					options={[{ value: 'pl', label: t('map:polandOnlyLabel') }, { value: 'all', label: t('map:allNodesLabel') }]}
				/>
				<Hint>{t('mobile:region.desc')}</Hint>
				<Divider />
				<SwitchRow label={t('mobile:settings.rotateTilt')} description={t('mobile:settings.rotateTiltDesc')} value={settings.rotateTilt} onValueChange={rotateTilt => update({ rotateTilt })} />
			</Section>

			<Section title={t('common:langLabel')} icon="info">
				<SegmentedControl
					value={settings.language}
					onChange={language => update({ language })}
					options={[{ value: 'auto', label: t('mobile:settings.languageAuto') }, { value: 'pl', label: 'Polski' }, { value: 'en', label: 'English' }]}
				/>
			</Section>

			<Section title={t('mobile:settings.data')} icon="chart">
				<Text style={styles.value}>{fetchedAt ? t('mobile:settings.updated', { time: new Date(fetchedAt).toLocaleString() }) : t('mobile:settings.neverUpdated')}</Text>
				{nodes.length > 0 && <Hint>{t('mobile:settings.nodesCount', { count: nodes.length.toLocaleString() })}</Hint>}
				<Button variant="secondary" label={t('mobile:settings.refresh')} disabled={phase === 'downloading' || phase === 'loading'} onPress={() => refresh({ force: true })} />
			</Section>

			<Button variant="secondary" icon="github" label={t('common:githubRepoTitle')} onPress={() => Linking.openURL(GITHUB_URL)} />
			<Hint style={styles.version}>{t('mobile:settings.version', { version: Constants.expoConfig?.version ?? '' })}</Hint>
		</Sheet>
	);
};
