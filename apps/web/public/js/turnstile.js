let turnstileLoader;

export const loadTurnstile = () => {
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
