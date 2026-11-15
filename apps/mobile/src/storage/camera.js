import { readJson, writeJson } from './files';

const FILE = 'camera.json';

// Last map position, restored on the next launch (like the website remembers the view). Kept out of the settings context: it changes while panning.
export const loadCamera = async () => {
	const saved = await readJson(FILE);
	const [lng, lat] = Array.isArray(saved?.center) ? saved.center : [];
	const valid = Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90 && Number.isFinite(saved?.zoom) && saved.zoom >= 0 && saved.zoom <= 24;

	return valid ? { center: [lng, lat], zoom: saved.zoom } : null;
};

export const saveCamera = camera => writeJson(FILE, camera);
