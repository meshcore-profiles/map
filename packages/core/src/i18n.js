const PLACEHOLDER = /\{\{(\w+)}}/g;

// Wybor formy liczby mnogiej: pl ma trzy formy, reszta dwie.
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

// getBundle zwraca { namespace: {...} }, getLanguage kod jezyka. Oba sa wolane przy kazdym uzyciu, wiec jezyk mozna zmieniac w locie.
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
