import { buildAndroidIntentUrl, isAndroid, isMapLink } from '/core/app-link.js';
import { GITHUB_URL } from '/core/sites.js';
import { t } from './i18n.js';

const MCMAP_DISMISSED_KEY = 'appBannerDismissedAt';
const MCMAP_DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;
const TELEMAVIX_DISMISSED_KEY = 'telemavixBannerDismissedAt';

const readDismissedAt = key => {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
};

const saveDismissedAt = key => {
	try {
		localStorage.setItem(key, String(Date.now()));
	} catch { /* storage unavailable */ }
};

// Offers to open a shared link (a node or a map view) in the app; Android only, and not inside an installed PWA.
export const initMeshCoreMapBanner = () => {
	const standalone = matchMedia('(display-mode: standalone)').matches;
	if (!isAndroid(navigator.userAgent) || standalone || !isMapLink(location.search)) return;

	const dismissedAt = readDismissedAt(MCMAP_DISMISSED_KEY);
	if (dismissedAt !== null && Date.now() - Number(dismissedAt) < MCMAP_DISMISS_FOR_MS) return;

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
		saveDismissedAt(MCMAP_DISMISSED_KEY);
		banner.remove();
	});

	const actions = document.createElement('div');
	actions.className = 'app-banner-actions';
	actions.append(dismiss, open);

	banner.append(text, actions);
	document.body.append(banner);
};

export const initTelemavixBanner = () => {
	const banner = document.getElementById('telemavix-banner');
	if (!banner || document.getElementById('app-banner')) return;
	if (readDismissedAt(TELEMAVIX_DISMISSED_KEY) !== null) return;

	const dismiss = () => {
		saveDismissedAt(TELEMAVIX_DISMISSED_KEY);
		banner.hidden = true;
	};

	banner.querySelector('.app-banner-dismiss').addEventListener('click', dismiss);
	banner.querySelector('.app-banner-open').addEventListener('click', dismiss);
	banner.hidden = false;
};
