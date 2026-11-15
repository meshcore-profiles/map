import { StyleSheet, Text } from 'react-native';
import Constants from 'expo-constants';
import { useI18n } from '../i18n';
import { useNodes } from '../state/NodesContext';
import { useSettings } from '../state/SettingsContext';
import { useRegionSwitch } from '../state/useRegionSwitch';
import { Button, Divider, Hint, Label, SegmentedControl } from '../ui/controls';
import { Sheet } from '../ui/Sheet';
import { colors } from '../theme';

const styles = StyleSheet.create({
	value: { color: colors.text },
});

export const SettingsSheet = ({ visible, onClose }) => {
	const { t } = useI18n();
	const { settings, update } = useSettings();
	const { nodes, fetchedAt, phase, refresh } = useNodes();
	const switchRegion = useRegionSwitch();

	return (
		<Sheet visible={visible} title={t('mobile:settings.title')} onClose={onClose}>
			<Label>{t('mobile:region.title')}</Label>
			<SegmentedControl
				value={settings.region}
				onChange={switchRegion}
				options={[{ value: 'pl', label: t('map:polandOnlyLabel') }, { value: 'all', label: t('map:allNodesLabel') }]}
			/>
			<Hint>{t('mobile:region.desc')}</Hint>

			<Divider />
			<Label>{t('mobile:settings.language')}</Label>
			<SegmentedControl
				value={settings.language}
				onChange={language => update({ language })}
				options={[{ value: 'auto', label: t('mobile:settings.languageAuto') }, { value: 'pl', label: 'Polski' }, { value: 'en', label: 'English' }]}
			/>

			<Divider />
			<Label>{t('mobile:settings.data')}</Label>
			<Text style={styles.value}>{fetchedAt ? t('mobile:settings.updated', { time: new Date(fetchedAt).toLocaleString() }) : t('mobile:settings.neverUpdated')}</Text>
			{nodes.length > 0 && <Hint>{t('mobile:settings.nodesCount', { count: nodes.length.toLocaleString() })}</Hint>}
			<Button variant="secondary" label={t('mobile:settings.refresh')} disabled={phase === 'downloading' || phase === 'loading'} onPress={() => refresh({ force: true })} />

			<Divider />
			<Hint>{t('mobile:settings.version', { version: Constants.expoConfig?.version ?? '' })}</Hint>
		</Sheet>
	);
};
