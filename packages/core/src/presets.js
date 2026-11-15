// Radio presets from /api/v1/radio-presets -> { name, desc, params }.
export const normalizeRadioPresets = data => data.map(p => ({
	name: p.title,
	desc: p.description,
	params: {
		freq: Number(p.frequency),
		bw: Number(p.bandwidth),
		sf: Number(p.spreadingFactor),
		cr: Number(p.codingRate),
	},
}));
