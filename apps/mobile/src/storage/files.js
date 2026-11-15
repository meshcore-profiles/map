import { Directory, File, Paths } from 'expo-file-system';

const dir = new Directory(Paths.document, 'meshcore');

export const fileOf = name => {
	if (!dir.exists) dir.create({ intermediates: true });
	return new File(dir, name);
};

export const readJson = async name => {
	const file = fileOf(name);
	if (!file.exists) return null;

	try {
		return JSON.parse(await file.text());
	} catch {
		return null;
	}
};

export const writeJson = async (name, value) => {
	const file = fileOf(name);
	if (!file.exists) file.create();
	await file.write(JSON.stringify(value));
};
