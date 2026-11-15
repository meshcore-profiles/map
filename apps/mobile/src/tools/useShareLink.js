import { useCallback } from 'react';
import * as Clipboard from 'expo-clipboard';
import { API_BASE } from '../config';
import { useI18n } from '../i18n';
import { useToast } from '../ui/Toast';

export const useShareLink = () => {
	const { t } = useI18n();
	const showToast = useToast();

	return useCallback(async query => {
		await Clipboard.setStringAsync(`${API_BASE}/?${query}`);
		showToast(t('common:copiedToClipboard'));
	}, [showToast, t]);
};
