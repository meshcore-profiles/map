import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createDefaultSettings, loadSettings, saveSettings } from '../storage/settings';
import { setHapticsEnabled } from '../ui/haptics';

const SettingsContext = createContext(null);
const SAVE_DEBOUNCE_MS = 300;

export const SettingsProvider = ({ children }) => {
	const [settings, setSettings] = useState(createDefaultSettings);
	const [ready, setReady] = useState(false);
	const saveTimer = useRef(null);

	useEffect(() => {
		loadSettings().then(setSettings).finally(() => setReady(true));
	}, []);

	useEffect(() => {
		if (!ready) return undefined;

		clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(() => saveSettings(settings).catch(err => console.error('Failed to save settings:', err)), SAVE_DEBOUNCE_MS);

		return () => clearTimeout(saveTimer.current);
	}, [settings, ready]);

	useEffect(() => {
		setHapticsEnabled(settings.haptics);
	}, [settings.haptics]);

	const update = useCallback(patch => setSettings(current => ({ ...current, ...patch })), []);
	const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update]);

	return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => useContext(SettingsContext);
