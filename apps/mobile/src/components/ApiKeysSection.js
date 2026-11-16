import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { API_KEY_PROVIDERS, sanitizeApiKey } from '@meshcore-map/core/basemaps';
import { useI18n } from '../i18n';
import { useSettings } from '../state/SettingsContext';
import { colors } from '../theme';
import { Button, Field, Hint, Section } from '../ui/controls';
import { haptics } from '../ui/haptics';
import { useToast } from '../ui/Toast';
import { useTheme } from '../state/ThemeContext';

const styles = StyleSheet.create({
	error: { color: colors.redBright },
});

// The app caches tiles on disk, which Esri's terms do not allow, so there is no field for it.
const PROVIDERS = API_KEY_PROVIDERS.filter(provider => !provider.forbidsCaching);

const fromSettings = apiKeys => Object.fromEntries(PROVIDERS.map(({ id }) => [id, apiKeys[id] ?? '']));

// Own keys for the maps that need one. They replace the keys the server hands out (a shared key can run out of its quota) and stay on the device.
export const ApiKeysSection = () => {
	const { t } = useI18n();
	const { accentBright } = useTheme();
	const showToast = useToast();
	const { settings, update } = useSettings();
	const [drafts, setDrafts] = useState(() => fromSettings(settings.apiKeys));
	const [invalid, setInvalid] = useState({});

	// The settings are read asynchronously, so the saved keys arrive after the first render.
	useEffect(() => {
		setDrafts(fromSettings(settings.apiKeys));
	}, [settings.apiKeys]);

	const save = () => {
		const next = {};
		const errors = {};
		for (const { id } of PROVIDERS) {
			const value = drafts[id].trim();
			const key = sanitizeApiKey(value);
			if (key) next[id] = key;
			else if (value) errors[id] = true;
		}

		setInvalid(errors);
		if (Object.keys(errors).length) {
			haptics.error();
			return;
		}

		update({ apiKeys: next });
		haptics.success();
		showToast(t('settings:apiKeysSaved'), { status: 'success' });
	};

	return (
		<Section title={t('settings:apiKeysLabel')}>
			<Hint>{t('settings:apiKeysDesc')}</Hint>
			{PROVIDERS.map(({ id, name, url }) => (
				<Section key={id}>
					<Field
						label={name}
						value={drafts[id]}
						onChangeText={value => setDrafts(current => ({ ...current, [id]: value }))}
						placeholder={t('settings:apiKeysPlaceholder')}
						maxLength={512}
						spellCheck={false}
						autoComplete="off"
						importantForAutofill="no"
					/>
					{invalid[id]
						? <Hint style={styles.error}>{t('settings:apiKeysInvalid')}</Hint>
						: settings.apiKeys[id] && drafts[id].trim() === settings.apiKeys[id] ? <Hint>{t('settings:apiKeysActive')}</Hint> : null}
					<Text style={{ color: accentBright, fontSize: 14 }} onPress={() => Linking.openURL(url)} accessibilityRole="link">{t('settings:apiKeysGet')}</Text>
				</Section>
			))}
			<Button variant="secondary" label={t('settings:apiKeysSave')} onPress={save} />
		</Section>
	);
};
