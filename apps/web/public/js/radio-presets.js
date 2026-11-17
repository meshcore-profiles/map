import { normalizeRadioPresets } from '/core/presets.js';
import { radioValue } from '/core/radio-filter-utils.js';
import { t } from './i18n.js';

let presets = [];

const findPreset = params => presets.find(p =>
	params.sf === p.params.sf &&
	params.freq === p.params.freq &&
	params.bw === p.params.bw
) ?? {};

export const getPresetLabel = params => {
	if (!['freq', 'sf', 'bw'].every(key => radioValue(params, key) !== 'unknown')) return t('map:noRadioData');
	return findPreset(params).name || t('map:customPreset');
};

export const getPresets = async signal => {
	if (presets.length) return presets;

	const res = await fetch('/api/v1/radio-presets', { signal });
	if (!res.ok) throw new Error(`Radio presets request failed (${res.status})`);

	presets = normalizeRadioPresets((await res.json()).data);

	presets.unshift({
		name: t('map:allPresetsOption'),
		params: {},
	});

	return presets;
};
