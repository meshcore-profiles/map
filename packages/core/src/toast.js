// How long a toast stays: a reading time that grows with the text, so a short "Saved" does not linger and a sentence with an explanation can be read.
const BASE_MS = 2000;
const PER_CHAR_MS = 60;
const MIN_MS = 3000;
const MAX_MS = 15000;

export const toastDuration = message => {
	const length = String(message ?? '').replace(/<[^>]*>/g, '').trim().length;
	return Math.min(Math.max(BASE_MS + length * PER_CHAR_MS, MIN_MS), MAX_MS);
};
