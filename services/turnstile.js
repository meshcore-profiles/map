const axios = require('../global/services/axios.js');

module.exports = async (token, ip, hostname, publicKey) => {
	if (typeof token !== 'string' || !token || token.length > 2048) return false;
	if (!process.env.TURNSTILE_SECRET) return false;
	const developmentTestKey = ['development', 'test'].includes(process.env.NODE_ENV) && process.env.TURNSTILE_SECRET === '1x0000000000000000000000000000000AA';

	try {
		const { data } = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', new URLSearchParams({
			secret: process.env.TURNSTILE_SECRET,
			response: token,
			remoteip: ip,
		}), { timeout: 8000 });

		return data.success === true && (developmentTestKey || (data.hostname === hostname && data.action === 'node-deletion' && data.cdata === publicKey));
	} catch (err) {
		console.error('Turnstile verification failed:', err.message);
		return false;
	}
};
