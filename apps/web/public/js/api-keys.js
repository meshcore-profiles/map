import { API_KEY_PROVIDERS, sanitizeApiKey, sanitizeCustomApiKeys } from '/core/basemaps.js';
import { t } from './i18n.js';

const STORAGE_KEY = 'customApiKeys';

export const loadCustomApiKeys = () => {
	try {
		return sanitizeCustomApiKeys(JSON.parse(localStorage.getItem(STORAGE_KEY)));
	} catch {
		return {};
	}
};

// Own keys replace the server's. Maps build their URLs at startup, so the page reloads after a change.
export const initApiKeySettings = ({ container, saveButton }) => {
	const saved = loadCustomApiKeys();

	const rows = API_KEY_PROVIDERS.map(({ id, name, url }) => {
		const row = document.createElement('div');
		row.className = 'setting-key';

		const label = document.createElement('label');
		label.className = 'setting-key-label';
		label.htmlFor = `setting-key-${id}`;
		label.textContent = name;

		const link = document.createElement('a');
		link.href = url;
		link.target = '_blank';
		link.rel = 'noopener noreferrer';
		link.textContent = t('settings:apiKeysGet');
		label.append(' - ', link);

		const input = document.createElement('input');
		Object.assign(input, { type: 'text', id: `setting-key-${id}`, className: 'date-input', value: saved[id] || '', autocomplete: 'off', spellcheck: false, maxLength: 512 });
		input.setAttribute('aria-describedby', `setting-key-${id}-status`);
		input.placeholder = t('settings:apiKeysPlaceholder');

		const status = document.createElement('p');
		status.id = `setting-key-${id}-status`;
		status.className = 'setting-desc setting-key-status';
		status.textContent = saved[id] ? t('settings:apiKeysActive') : '';

		row.append(label, input, status);
		container.append(row);
		return { id, input, status };
	});

	saveButton.addEventListener('click', () => {
		const next = {};
		let valid = true;

		for (const { id, input, status } of rows) {
			const value = input.value.trim();
			const key = sanitizeApiKey(value);
			const invalid = Boolean(value) && !key;

			input.setAttribute('aria-invalid', String(invalid));
			if (invalid) {
				status.textContent = t('settings:apiKeysInvalid');
				valid = false;
			}
			if (key) next[id] = key;
		}
		if (!valid) return;

		if (Object.keys(next).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
		else localStorage.removeItem(STORAGE_KEY);

		if (JSON.stringify(next) !== JSON.stringify(saved)) location.reload();
	});
};
