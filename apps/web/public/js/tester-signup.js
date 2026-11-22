import { t } from './i18n.js';
import { initModal } from './modal.js';
import { showToast } from './toast.js';
import { loadTurnstile } from './turnstile.js';

const DISMISSED_KEY = 'testerBannerDismissedAt';
const SIGNED_UP_KEY = 'testerSignedUp';
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

const readStorage = key => {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
};

const writeStorage = (key, value) => {
	try {
		localStorage.setItem(key, value);
	} catch { /* storage unavailable */ }
};

// Closed-test sign-up for the Android app (Polish site only): a dismissible banner that opens a dialog with an e-mail form.
export const initTesterSignup = () => {
	const el = name => document.getElementById(`tester-${name}`);
	const form = el('form');
	if (!form || !window.MAP_CONFIG.testerSignupUrl) return;

	const overlay = el('overlay');
	const email = el('email');
	const consent = el('consent');
	const captcha = el('captcha');
	const status = el('status');
	const submit = el('submit');
	const done = el('done');
	let opener;
	let widgetId;
	let request;
	let generation = 0;
	const lightbox = el('lightbox');
	const lightboxImage = lightbox.querySelector('img');
	let lastShot;

	const setStatus = message => {
		status.textContent = message;
		status.hidden = !message;
	};

	const clearChallenge = () => {
		generation++;
		request?.abort();
		request = null;
		if (widgetId != null) window.turnstile?.remove(widgetId);
		widgetId = null;
		captcha.replaceChildren();
		captcha.hidden = true;
	};

	const closeLightbox = () => {
		if (lightbox.hidden) return;
		lightbox.hidden = true;
		lightboxImage.removeAttribute('src');
		lastShot?.focus();
	};

	const modal = initModal(null, 'tester-overlay', {
		onDismiss: () => {
			closeLightbox();
			clearChallenge();
			submit.disabled = false;
			setStatus('');
			const banner = document.getElementById('tester-banner');
			if (banner) banner.style.display = '';
			if (opener?.isConnected) opener.focus();
		},
	});

	const showError = (key, message) => {
		clearChallenge();
		submit.disabled = false;
		setStatus('');
		showToast(message || t(`map:testers.errors.${key}`), { status: 'error' });
	};

	const send = async (token, attempt) => {
		if (attempt !== generation || request) return;
		request = new AbortController();
		setStatus(t('map:testers.sending'));
		try {
			const response = await fetch(window.MAP_CONFIG.testerSignupUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify({ email: email.value.trim(), consent: true, token, language: window.MAP_CONFIG.languageCode }),
				signal: request.signal,
			});
			const data = await response.json().catch(() => ({}));
			if (attempt !== generation) return;
			if (!response.ok || !data.success) {
				showError('request', typeof data.message === 'string' ? data.message : null);
				return;
			}

			writeStorage(SIGNED_UP_KEY, '1');
			document.getElementById('tester-banner')?.remove();
			clearChallenge();
			el('fields').hidden = true;
			submit.hidden = true;
			setStatus(t('map:testers.success'));
			done.hidden = false;
			done.focus();
		} catch (err) {
			if (attempt === generation && err.name !== 'AbortError') showError('request');
		} finally {
			if (attempt === generation) request = null;
		}
	};

	const startChallenge = async () => {
		clearChallenge();
		const attempt = generation;
		submit.disabled = true;
		if (!window.MAP_CONFIG.turnstileSitekey) {
			showError('unavailable');
			return;
		}

		captcha.hidden = false;
		try {
			await loadTurnstile();
			if (attempt !== generation) return;
			widgetId = window.turnstile.render(captcha, {
				sitekey: window.MAP_CONFIG.turnstileSitekey,
				action: 'tester-signup',
				language: window.MAP_CONFIG.languageCode,
				theme: 'dark',
				size: captcha.clientWidth < 300 ? 'compact' : 'normal',
				callback: token => void send(token, attempt),
				'error-callback': () => { if (attempt === generation) showError('captcha'); },
				'expired-callback': () => { if (attempt === generation) showError('expired'); },
				'timeout-callback': () => { if (attempt === generation) showError('expired'); },
			});
		} catch {
			if (attempt === generation) showError('load');
		}
	};

	form.addEventListener('submit', event => {
		event.preventDefault();
		if (submit.disabled) return;
		const emailOk = email.value.trim() && email.checkValidity();
		if (!emailOk || !consent.checked) {
			showToast(t('map:testers.errors.invalidRequest'), { status: 'warning' });
			(emailOk ? consent : email).focus();
			return;
		}
		void startChallenge();
	});

	el('close').addEventListener('click', modal.dismiss);
	done.addEventListener('click', modal.dismiss);
	for (const shot of overlay.querySelectorAll('.tester-shot')) {
		shot.addEventListener('click', () => {
			lastShot = shot;
			lightboxImage.src = shot.dataset.full;
			lightbox.hidden = false;
			lightbox.focus();
		});
	}
	lightbox.addEventListener('click', closeLightbox);

	overlay.addEventListener('keydown', event => {
		if (!lightbox.hidden) {
			event.preventDefault();
			if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
				event.stopPropagation();
				closeLightbox();
			}
			return;
		}
		if (event.key !== 'Tab') return;
		const focusable = [...overlay.querySelectorAll('button, input, a[href], iframe')].filter(element => !element.hidden && !element.disabled && !element.closest('[hidden]'));
		const first = focusable[0];
		const last = focusable.at(-1);
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	});

	if (readStorage(SIGNED_UP_KEY) || Date.now() - Number(readStorage(DISMISSED_KEY)) < DISMISS_FOR_MS) return;

	const banner = document.createElement('aside');
	banner.id = 'tester-banner';
	banner.setAttribute('role', 'region');
	banner.setAttribute('aria-label', t('map:testers.banner.title'));

	const text = document.createElement('div');
	text.className = 'app-banner-text';
	const title = document.createElement('strong');
	title.textContent = t('map:testers.banner.title');
	const desc = document.createElement('span');
	desc.textContent = t('map:testers.banner.text');
	text.append(title, desc);

	const join = document.createElement('button');
	join.type = 'button';
	join.className = 'app-banner-open';
	join.textContent = t('map:testers.banner.join');
	join.addEventListener('click', () => {
		opener = join;
		banner.style.display = 'none';
		modal.open();
		email.focus();
	});

	const dismiss = document.createElement('button');
	dismiss.type = 'button';
	dismiss.className = 'app-banner-dismiss';
	dismiss.textContent = t('map:testers.banner.dismiss');
	dismiss.addEventListener('click', () => {
		writeStorage(DISMISSED_KEY, String(Date.now()));
		banner.remove();
	});

	const actions = document.createElement('div');
	actions.className = 'app-banner-actions';
	actions.append(dismiss, join);

	banner.append(text, actions);
	document.body.append(banner);
};
