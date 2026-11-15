const bundle = window.MAP_CONFIG.i18n;

const resolve = key => {
	const [ns, path] = key.includes(':') ? key.split(':') : ['common', key];
	return path.split('.').reduce((o, k) => o?.[k], bundle[ns]);
};

export const t = (key, vars) => {
	const value = resolve(key);
	if (typeof value !== 'string') return key;

	return vars ? value.replace(/\{\{(\w+)}}/g, (_, k) => vars[k] ?? '') : value;
};

export const tRaw = key => resolve(key);

export const plural = (count, forms) => {
	if (window.MAP_CONFIG.languageCode === 'pl' && forms.length >= 3) {
		if (count === 1) return forms[0];

		const lastDigit = count % 10;
		const lastTwoDigits = count % 100;
		if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwoDigits >= 12 && lastTwoDigits <= 14)) return forms[1];

		return forms[2];
	}

	return count === 1 ? forms[0] : forms[1];
};
