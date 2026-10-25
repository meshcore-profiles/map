const axios = require('../global/services/axios.js');

module.exports = async (token, ip, hostname, publicKey) => {
	if (typeof token !== 'string' || !token || token.length > 2048) return false;
	if (!process.env.TURNSTILE_SECRET) return false;

	try {
		const { data } = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', new URLSearchParams({
			secret: process.env.TURNSTILE_SECRET,
			response: token,
			remoteip: ip,
		}), { timeout: 8000 });

		if (data.success !== true) {
			console.warn('Turnstile siteverify rejected the token:', data['error-codes']);
			return false;
		}
		const valid = data.hostname === hostname && data.action === 'node-deletion' && data.cdata === publicKey;
		if (!valid) console.warn(`Turnstile token mismatch: hostname=${data.hostname} (expected ${hostname}), action=${data.action}, cdata match=${data.cdata === publicKey}`);
		return valid;
	} catch (err) {
		console.error('Turnstile verification failed:', err.message);
		return false;
	}
};
