// SHA-1 of an Android signing certificate as providers expect it in "X-Android-Cert": 40 hex digits, written with or without colons.
const SHA1_PATTERN = /^[0-9a-f]{2}(?::?[0-9a-f]{2}){19}$/i;

// Lower-case hex without colons, or null when the value is not a SHA-1 fingerprint.
export const normalizeCertSha1 = value => {
	const text = typeof value === 'string' ? value.trim() : '';
	return SHA1_PATTERN.test(text) ? text.replaceAll(':', '').toLowerCase() : null;
};

// Headers that tie a request to the app, for keys restricted to mobile apps (CARTO): Android sends its package and the signing certificate,
// iOS the bundle identifier. Without a certificate the Android package alone is refused, so nothing is sent then.
export const appIdentityHeaders = ({ platform, androidPackage, androidCertSha1, iosBundleId }) => {
	if (platform === 'android') {
		const cert = normalizeCertSha1(androidCertSha1);
		return androidPackage && cert ? { 'X-Android-Package': androidPackage, 'X-Android-Cert': cert } : {};
	}

	return platform === 'ios' && iosBundleId ? { 'X-Ios-Bundle-Identifier': iosBundleId } : {};
};
