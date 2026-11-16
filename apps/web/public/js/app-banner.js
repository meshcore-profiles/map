import { buildAndroidIntentUrl, isAndroid, isMapLink } from '/core/app-link.js';
import { GITHUB_URL } from '/core/sites.js';
import { t } from './i18n.js';

const DISMISSED_KEY = 'appBannerDismissedAt';
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

const recentlyDismissed = () => {
	try {
		return Date.now() - Number(localStorage.getItem(DISMISSED_KEY)) < DISMISS_FOR_MS;
	} catch {
		return false;
	}
};

// Offers to open a shared link (a node or a map view) in the app; Android only, and not inside an installed PWA.
export const initAppBanner = () => {
	const standalone = matchMedia('(display-mode: standalone)').matches;
	if (!isAndroid(navigator.userAgent) || standalone || !isMapLink(location.search) || recentlyDismissed()) return;

	const banner = document.createElement('aside');
	banner.id = 'app-banner';
	banner.setAttribute('role', 'region');
	banner.setAttribute('aria-label', t('map:appBanner.title'));

	const text = document.createElement('div');
	text.className = 'app-banner-text';
	const title = document.createElement('strong');
	title.textContent = t('map:appBanner.title');
	const desc = document.createElement('span');
	desc.textContent = t('map:appBanner.text');
	text.append(title, desc);

	const open = document.createElement('a');
	open.className = 'app-banner-open';
	open.textContent = t('map:appBanner.open');
	open.href = buildAndroidIntentUrl({ host: location.host, pathname: location.pathname, search: location.search, fallbackUrl: `${GITHUB_URL}/releases/latest` });

	const dismiss = document.createElement('button');
	dismiss.type = 'button';
	dismiss.className = 'app-banner-dismiss';
	dismiss.textContent = t('map:appBanner.dismiss');
	dismiss.addEventListener('click', () => {
		try {
			localStorage.setItem(DISMISSED_KEY, String(Date.now()));
		} catch { /* storage unavailable */ }
		banner.remove();
	});

	const actions = document.createElement('div');
	actions.className = 'app-banner-actions';
	actions.append(dismiss, open);

	banner.append(text, actions);
	document.body.append(banner);
};
