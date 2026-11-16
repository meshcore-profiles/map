const axios = require('../../../global/services/axios.js');
const secret = process.env.TURNSTILE_SECRET;

module.exports = async (token, ip, hostname, { action, cdata }) => {
	if (typeof token !== 'string' || !token || token.length > 2048) return false;
	if (!secret) return false;

	try {
		const { data } = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', new URLSearchParams({
			secret,
			response: token,
			remoteip: ip,
		}), { timeout: 8000 });

		if (data.success !== true) {
			console.warn('Turnstile siteverify rejected the token:', data['error-codes']);
			return false;
		}

		if (data.metadata?.result_with_testing_key === true) return process.env.NODE_ENV !== 'production';

		const valid = data.hostname === hostname && data.action === action && (cdata === undefined || data.cdata === cdata);
		if (!valid) console.warn(`Turnstile token mismatch: hostname=${data.hostname} (expected ${hostname}), action=${data.action} (expected ${action}), cdata match=${cdata === undefined || data.cdata === cdata}`);

		return valid;
	} catch (err) {
		console.error('Turnstile verification failed:', err.message);
		return false;
	}
};
