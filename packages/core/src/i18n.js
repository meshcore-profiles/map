const PLACEHOLDER = /\{\{(\w+)}}/g;

// Plural form selection: Polish has three forms, every other language two.
export const pluralForm = (language, count, forms) => {
	if (language === 'pl' && forms.length >= 3) {
		if (count === 1) return forms[0];

		const lastDigit = count % 10;
		const lastTwoDigits = count % 100;
		if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwoDigits >= 12 && lastTwoDigits <= 14)) return forms[1];

		return forms[2];
	}

	return count === 1 ? forms[0] : forms[1];
};

// getBundle returns { namespace: {...} }, getLanguage a language code. Both are called on every lookup, so the language can change at runtime.
export const createI18n = ({ getBundle, getLanguage }) => {
	const resolve = key => {
		const [ns, path] = key.includes(':') ? key.split(':') : ['common', key];
		return path.split('.').reduce((o, k) => o?.[k], getBundle()[ns]);
	};

	const t = (key, vars) => {
		const value = resolve(key);
		if (typeof value !== 'string') return key;

		return vars ? value.replace(PLACEHOLDER, (_, k) => vars[k] ?? '') : value;
	};

	return { t, tRaw: resolve, plural: (count, forms) => pluralForm(getLanguage(), count, forms) };
};
