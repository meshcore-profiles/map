// "0.13.0+20261116": a semver version with the release date as build metadata (YYYYMMDD). Returns { version, date } with the date as YYYY-MM-DD or null.
export const parseAppVersion = raw => {
	const [version, build = ''] = String(raw ?? '').trim().split('+');
	const match = (/^(\d{4})(\d{2})(\d{2})$/).exec(build);
	const valid = match && Number(match[2]) >= 1 && Number(match[2]) <= 12 && Number(match[3]) >= 1 && Number(match[3]) <= 31;

	return { version, date: valid ? `${match[1]}-${match[2]}-${match[3]}` : null };
};
