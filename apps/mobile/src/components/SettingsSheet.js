import { StyleSheet, Text } from 'react-native';
import { GITHUB_URL } from '@meshcore-map/core/sites';
import Constants from 'expo-constants';
import { BUILD } from '../config';
import { useAppConfig } from '../data/appConfig';
import { useI18n } from '../i18n';
import { ApiKeysSection } from './ApiKeysSection';
import { useNodes, useNodesStatus } from '../state/NodesContext';
import { useSettings } from '../state/SettingsContext';
import { useRegionSwitch } from '../state/useRegionSwitch';
import { ELEVATION_SOURCES } from '../storage/settings';
import { Button } from '../ui/Button';
import { SegmentedControl, SwitchRow } from '../ui/Choice';
import { Dropdown } from '../ui/Dropdown';
import { Hint, Label } from '../ui/Field';
import { Divider, Section } from '../ui/Section';
import { Sheet } from '../ui/Sheet';
import { openLink } from '../ui/openLink';
import { colors } from '../theme';

const ELEVATION_KEYS = {
	'sefinek': ['settings:elevationSefinek', 'settings:elevationSefinekDesc'],
	'open-elevation': ['settings:elevationOpenElevation', 'settings:elevationOpenElevationDesc'],
	'open-meteo': ['settings:elevationOpenMeteo', 'settings:elevationOpenMeteoDesc'],
};

const pad = value => String(value).padStart(2, '0');
const formatBuildTime = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

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
	const config = useAppConfig();

	return (
		<Sheet visible={visible} title={t('settings:title')} onClose={onClose}>
			<Section title={t('mobile:region.title')}>
				<SegmentedControl
					value={settings.region}
					onChange={switchRegion}
					options={[{ value: 'pl', label: t('map:polandOnlyLabel') }, { value: 'all', label: t('map:allNodesLabel') }]}
				/>
				<Hint>{t('mobile:region.desc')}</Hint>
			</Section>

			<Section>
				<SwitchRow label={t('mobile:settings.rotateTilt')} description={t('mobile:settings.rotateTiltDesc')} value={settings.rotateTilt} onValueChange={rotateTilt => update({ rotateTilt })} />
				<SwitchRow label={t('mobile:settings.haptics')} description={t('mobile:settings.hapticsDesc')} value={settings.haptics} onValueChange={haptics => update({ haptics })} />
				<SwitchRow label={t('settings:showAddButtonLabel')} description={t('settings:showAddButtonDesc')} value={settings.showAddButton} onValueChange={showAddButton => update({ showAddButton })} />
				<SwitchRow label={t('settings:closeFiltersLabel')} description={t('settings:closeFiltersDesc')} value={settings.closeFiltersOnApply} onValueChange={closeFiltersOnApply => update({ closeFiltersOnApply })} />
			</Section>

			<Divider />
			<Section title={t('common:langLabel')}>
				<SegmentedControl
					value={settings.language}
					onChange={language => update({ language })}
					options={[{ value: 'auto', label: t('mobile:settings.languageAuto') }, { value: 'pl', label: 'Polski' }, { value: 'en', label: 'English' }]}
				/>
			</Section>

			<Divider />
			<Section title={t('settings:tabTools')}>
				<Label>{t('settings:elevationSourceLabel')}</Label>
				<Dropdown
					options={ELEVATION_SOURCES.map(source => ({ value: source, label: t(ELEVATION_KEYS[source][0]) }))}
					value={settings.elevationSource}
					onChange={elevationSource => update({ elevationSource })}
					accessibilityLabel={t('settings:elevationSourceLabel')}
				/>
				<Hint>{t(ELEVATION_KEYS[settings.elevationSource][1])}</Hint>
				<Label>{t('settings:coverageStyleLabel')}</Label>
				<SegmentedControl
					value={settings.coverageStyle}
					onChange={coverageStyle => update({ coverageStyle })}
					options={[{ value: 'tiles', label: t('settings:coverageStyleTiles') }, { value: 'lines', label: t('settings:coverageStyleLines') }]}
				/>
				<Hint>{t('settings:coverageStyleDesc')}</Hint>
			</Section>

			<Divider />
			<ApiKeysSection />

			<Divider />
			<Section title={t('mobile:settings.data')}>
				<Text style={styles.value}>{fetchedAt ? t('mobile:settings.updated', { time: new Date(fetchedAt).toLocaleString() }) : t('mobile:settings.neverUpdated')}</Text>
				{nodes.length > 0 && <Hint>{t('mobile:settings.nodesCount', { count: nodes.length.toLocaleString() })}</Hint>}
				<Button variant="secondary" label={t('mobile:settings.refresh')} disabled={phase === 'downloading' || phase === 'loading'} onPress={() => refresh({ force: true })} />
			</Section>

			{config?.bugsnagApiKey && (
				<>
					<Divider />
					<Section>
						<SwitchRow label={t('mobile:settings.errorReporting')} description={t('mobile:settings.errorReportingDesc')} value={settings.errorReporting} onValueChange={errorReporting => update({ errorReporting })} />
					</Section>
				</>
			)}

			<Divider />
			<Button variant="secondary" icon="github" label={t('common:githubRepoTitle')} onPress={() => openLink(GITHUB_URL)} />
			<Hint style={styles.version}>{t('mobile:settings.version', { version: Constants.expoConfig?.version ?? '' })}</Hint>
			{BUILD.time && <Hint style={styles.version}>{t('mobile:settings.build', { time: formatBuildTime(BUILD.time), commit: BUILD.commit ?? '?' })}</Hint>}
		</Sheet>
	);
};
