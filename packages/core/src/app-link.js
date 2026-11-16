import { parseMapLink } from './links.js';

export const ANDROID_PACKAGE = 'com.sefinek.meshcoremap';

export const isAndroid = userAgent => (/\bAndroid\b/i).test(String(userAgent ?? ''));

// A shared link to a node or to a view of the map (the same ones the app opens) is worth offering the app for; a plain visit is not.
export const isMapLink = search => parseMapLink(String(search ?? '')) !== null;

// Android "intent:" link that opens the app on this page's address, or the fallback (the downloads) when the app is not installed.
// It has to be followed from a tap, so it is meant for an <a href>. The hash is dropped: an intent uses it as its own separator.
export const buildAndroidIntentUrl = ({ host, pathname, search, packageName = ANDROID_PACKAGE, fallbackUrl }) => {
	const target = `${host}${pathname}${search ?? ''}`.split('#')[0];
	const fallback = fallbackUrl ? `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};` : '';
	return `intent://${target}#Intent;scheme=https;package=${packageName};${fallback}end`;
};
