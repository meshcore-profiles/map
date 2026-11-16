import { t } from './i18n.js';
import { SETTING_KEYS } from './preferences.js';

const CONFIRM_MS = 4000;

const formatSize = bytes => {
	if (bytes < 1024) return `${bytes} B`;
	return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// Approximate size (UTF-16, 2 bytes per character) of the keys and values this site stores.
const storageBytes = () => {
	let total = 0;
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			total += (key.length + (localStorage.getItem(key)?.length ?? 0)) * 2;
		}
	} catch { /* storage unavailable */ }
	return total;
};

const confirmable = (button, action) => {
	const label = button.textContent;
	let timer = null;

	const disarm = () => {
		clearTimeout(timer);
		timer = null;
		button.textContent = label;
		button.classList.remove('armed');
	};

	button.addEventListener('click', () => {
		if (timer) {
			disarm();
			action();
			return;
		}

		button.textContent = t('settings:confirmAgain');
		button.classList.add('armed');
		timer = setTimeout(disarm, CONFIRM_MS);
	});
	button.addEventListener('blur', () => timer && disarm());
};

export const initDataSettings = ({ tab, usage, resetButton, clearButton }) => {
	const refreshUsage = () => {
		usage.textContent = t('settings:storageUsage', { size: formatSize(storageBytes()) });
	};

	refreshUsage();
	tab.addEventListener('click', refreshUsage);

	confirmable(resetButton, () => {
		try {
			for (const key of SETTING_KEYS) localStorage.removeItem(key);
		} catch { /* storage unavailable */ }
		location.reload();
	});

	confirmable(clearButton, () => {
		try {
			localStorage.clear();
		} catch { /* storage unavailable */ }
		location.reload();
	});
};
