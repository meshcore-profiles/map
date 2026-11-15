import { useCallback } from 'react';
import { Alert } from 'react-native';
import { formatBytes } from '@meshcore-map/core/node-utils';
import { API_BASE } from '../config';
import { fetchRegionInfo, hasCachedRegion } from '../data/nodesRepository';
import { useI18n } from '../i18n';
import { useSettings } from './SettingsContext';

// Switches the map scope. Asks for consent before the first (large) worldwide download, like the website.
export const useRegionSwitch = () => {
	const { t } = useI18n();
	const { settings, update } = useSettings();

	return useCallback(async region => {
		if (region === settings.region) return;

		if (region === 'all' && !hasCachedRegion(region)) {
			let size = t('map:unknownSize');
			try {
				const { bytes } = await fetchRegionInfo(API_BASE, region);
				if (bytes) size = t('map:aboutSize', { size: formatBytes(bytes) });
			} catch { /* offline - show the unknown size */ }

			const confirmed = await new Promise(resolve => {
				Alert.alert(
					t('map:regionWarningTitle'),
					t('map:regionWarningText', { size }),
					[
						{ text: t('common:cancel'), style: 'cancel', onPress: () => resolve(false) },
						{ text: t('map:downloadAnyway'), onPress: () => resolve(true) },
					],
					{ cancelable: true, onDismiss: () => resolve(false) }
				);
			});
			if (!confirmed) return;
		}

		update({ region });
	}, [settings.region, update, t]);
};
