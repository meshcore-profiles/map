import { Linking, StyleSheet, Text } from 'react-native';
import { GITHUB_URL } from '@meshcore-map/core/sites';
import Constants from 'expo-constants';
import { useI18n } from '../i18n';
import { useNodes, useNodesStatus } from '../state/NodesContext';
import { useSettings } from '../state/SettingsContext';
import { useRegionSwitch } from '../state/useRegionSwitch';
import { ELEVATION_SOURCES } from '../storage/settings';
import { Button, Divider, Hint, Option, Section, SegmentedControl, SwitchRow } from '../ui/controls';
import { Sheet } from '../ui/Sheet';
import { colors } from '../theme';

const ELEVATION_KEYS = {
	'sefinek': ['settings:elevationSefinek', 'settings:elevationSefinekDesc'],
	'open-elevation': ['settings:elevationOpenElevation', 'settings:elevationOpenElevationDesc'],
	'open-meteo': ['settings:elevationOpenMeteo', 'settings:elevationOpenMeteoDesc'],
};

const styles = StyleSheet.create({
	value: { color: colors.text, fontSize: 16 },
	version: { textAlign: 'center' },
});

export const SettingsSheet = ({ visible, onClose }) => {
	const { t } = useI18n();
	const { settings, update } = useSettings();
	const { nodes, fetchedAt, refresh } = useNodes();
	const { phase } = useNodesStatus();
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
				<SwitchRow label={t('settings:closeFiltersLabel')} description={t('settings:closeFiltersDesc')} value={settings.closeFiltersOnApply} onValueChange={closeFiltersOnApply => update({ closeFiltersOnApply })} />
			</Section>

			<Section title={t('settings:elevationSourceLabel')} icon="terrain">
				{ELEVATION_SOURCES.map(source => <Option key={source} label={t(ELEVATION_KEYS[source][0])} info={t(ELEVATION_KEYS[source][1])} selected={settings.elevationSource === source} onPress={() => update({ elevationSource: source })} />)}
				<Hint>{t('settings:elevationDesc')}</Hint>
			</Section>

			<Section title={t('settings:coverageStyleLabel')} icon="coverage">
				<SegmentedControl
					value={settings.coverageStyle}
					onChange={coverageStyle => update({ coverageStyle })}
					options={[{ value: 'tiles', label: t('settings:coverageStyleTiles') }, { value: 'lines', label: t('settings:coverageStyleLines') }]}
				/>
				<Hint>{t('settings:coverageStyleDesc')}</Hint>
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
