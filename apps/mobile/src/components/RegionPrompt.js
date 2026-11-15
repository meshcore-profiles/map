import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatBytes } from '@meshcore-map/core/node-utils';
import { API_BASE } from '../config';
import { fetchRegionInfo } from '../data/nodesRepository';
import { useI18n } from '../i18n';
import { useRegionSwitch } from '../state/useRegionSwitch';
import { Button, Hint } from '../ui/controls';
import { Sheet } from '../ui/Sheet';
import { spacing } from '../theme';

// The first-launch choice is mandatory, so dismissing the sheet is a no-op.
const ignore = () => { /* intentionally empty */ };

const styles = StyleSheet.create({
	option: { gap: spacing.xs },
});

// First launch: choose the map scope (worldwide / Poland only) together with the download size.
export const RegionPrompt = ({ visible }) => {
	const { t } = useI18n();
	const switchRegion = useRegionSwitch();
	const [sizes, setSizes] = useState({});

	useEffect(() => {
		if (!visible) return;

		for (const region of ['pl', 'all']) {
			fetchRegionInfo(API_BASE, region)
				.then(({ bytes }) => bytes && setSizes(current => ({ ...current, [region]: formatBytes(bytes) })))
				.catch(() => { /* offline - the size stays unknown */ });
		}
	}, [visible]);

	const sizeLabel = region => sizes[region] ?? t('mobile:region.sizeUnknown');

	return (
		<Sheet visible={visible} title={t('mobile:region.promptTitle')} onClose={ignore}>
			<Hint>{t('mobile:region.promptText')}</Hint>
			<View style={styles.option}>
				<Button label={t('mobile:region.pl')} onPress={() => switchRegion('pl')} />
				<Hint>{t('mobile:region.plDesc', { size: sizeLabel('pl') })}</Hint>
			</View>
			<View style={styles.option}>
				<Button variant="secondary" label={t('mobile:region.all')} onPress={() => switchRegion('all')} />
				<Hint>{t('mobile:region.allDesc', { size: sizeLabel('all') })}</Hint>
			</View>
		</Sheet>
	);
};
