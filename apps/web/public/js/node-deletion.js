import { t } from './i18n.js';
import { initModal } from './modal.js';

let turnstileLoader;

const loadTurnstile = () => {
	if (turnstileLoader) return turnstileLoader;
	if (window.turnstile?.render) return Promise.resolve();

	turnstileLoader = new Promise((resolve, reject) => {
		const script = document.createElement('script');
		const timer = setTimeout(fail, 15000);
		function fail() {
			clearTimeout(timer);
			script.remove();
			turnstileLoader = null;
			reject(new Error('Turnstile failed to load'));
		}
		script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
		script.async = true;
		script.onerror = fail;
		script.onload = () => {
			if (!window.turnstile?.render) return fail();
			clearTimeout(timer);
			resolve();
		};
		document.head.append(script);
	});
	return turnstileLoader;
};

export const initNodeDeletionDialog = () => {
	const el = name => document.getElementById(`node-deletion-${name}`);
	const overlay = el('overlay');
	const text = el('text');
	const status = el('status');
	const captcha = el('captcha');
	const yes = el('yes');
	const no = el('no');
	const retry = el('retry');
	const email = el('email');
	const done = el('done');
	let publicKey;
	let opener;
	let widgetId;
	let generation = 0;
	let request;

	const clearChallenge = () => {
		generation++;
		request?.abort();
		request = null;
		if (widgetId != null) window.turnstile?.remove(widgetId);
		widgetId = null;
		captcha.replaceChildren();
	};

	const modal = initModal(null, 'node-deletion-overlay', {
		onDismiss: () => {
			clearChallenge();
			email.removeAttribute('href');
			if (opener?.isConnected) opener.focus();
		},
	});

	const setStatus = message => {
		status.textContent = message;
		status.hidden = !message;
	};

	const showError = (key, message) => {
		setStatus(message || t(`map:deletion.errors.${key}`));
		retry.hidden = false;
		retry.focus();
	};

	const verify = async (token, attempt) => {
		if (attempt !== generation || request) return;
		request = new AbortController();
		setStatus(t('map:deletion.verifying'));
		try {
			const response = await fetch(window.MAP_CONFIG.nodeDeletionUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify({ publicKey, ownerConfirmed: true, token, language: window.MAP_CONFIG.languageCode }),
				signal: request.signal,
			});
			if (response.status === 429) {
				if (attempt === generation) showError('rateLimited');
				return;
			}
			const data = await response.json();
			if (attempt !== generation) return;
			if (!response.ok || !data.success) {
				showError('request', typeof data.message === 'string' ? data.message : null);
				return;
			}
			if (!data.data?.mailto?.startsWith(`mailto:${window.MAP_CONFIG.nodeDeletionEmail}?`)) {
				showError('request');
				return;
			}

			clearChallenge();
			captcha.hidden = true;
			retry.hidden = true;
			setStatus('');
			text.textContent = t('map:deletion.ready');
			email.href = data.data.mailto;
			email.hidden = false;
			email.focus();
		} catch (err) {
			if (attempt === generation && err.name !== 'AbortError') showError('request');
		} finally {
			if (attempt === generation) request = null;
		}
	};

	const startChallenge = async () => {
		clearChallenge();
		const attempt = generation;
		yes.hidden = true;
		no.hidden = true;
		retry.hidden = true;
		done.hidden = false;
		text.textContent = t('map:deletion.captchaPrompt');
		el('close').focus();
		if (!window.MAP_CONFIG.turnstileSitekey) {
			setStatus(t('map:deletion.errors.unavailable'));
			return;
		}

		captcha.hidden = false;
		setStatus(t('map:deletion.loading'));
		try {
			await loadTurnstile();
			if (attempt !== generation) return;
			setStatus(t('map:deletion.waiting'));
			widgetId = window.turnstile.render(captcha, {
				sitekey: window.MAP_CONFIG.turnstileSitekey,
				action: 'node-deletion',
				cData: publicKey,
				language: window.MAP_CONFIG.languageCode,
				theme: 'dark',
				size: captcha.clientWidth < 300 ? 'compact' : 'normal',
				callback: token => void verify(token, attempt),
				'error-callback': () => { if (attempt === generation) showError('captcha'); },
				'expired-callback': () => { if (attempt === generation) showError('expired'); },
				'timeout-callback': () => { if (attempt === generation) showError('expired'); },
			});
		} catch {
			if (attempt === generation) showError('load');
		}
	};

	document.addEventListener('click', event => {
		const button = event.target.closest('[data-delete-node]');
		if (!button) return;
		clearChallenge();
		opener = button;
		publicKey = button.dataset.deleteNode;
		el('name').textContent = button.dataset.nodeName;
		el('key').textContent = publicKey;
		text.textContent = t('map:deletion.ownerQuestion');
		setStatus('');
		captcha.hidden = true;
		yes.hidden = false;
		no.hidden = false;
		retry.hidden = true;
		email.hidden = true;
		email.removeAttribute('href');
		done.hidden = true;
		modal.open();
		no.focus();
	});

	yes.addEventListener('click', () => void startChallenge());
	retry.addEventListener('click', () => void startChallenge());
	no.addEventListener('click', () => {
		text.textContent = t('map:deletion.ownerOnly');
		yes.hidden = true;
		no.hidden = true;
		done.hidden = false;
		done.focus();
	});
	el('close').addEventListener('click', modal.dismiss);
	done.addEventListener('click', modal.dismiss);

	overlay.addEventListener('keydown', event => {
		if (event.key === 'Escape') {
			event.stopPropagation();
			modal.dismiss();
		}
		if (event.key !== 'Tab') return;
		const focusable = [...overlay.querySelectorAll('button, a[href], iframe')].filter(element => !element.hidden && !element.closest('[hidden]'));
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
};
