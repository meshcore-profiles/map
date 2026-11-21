import express from 'express';
import * as limiter from '../middlewares/ratelimit.js';
import verifyTurnstile from '../services/turnstile.js';
import { buildDeletionMailUrl } from '@meshcore-map/core/deletion';

const router = express.Router();

router.use('/node-deletion', (req, res, next) => {
	res.set('Cache-Control', 'no-store');
	next();
});

router.post('/node-deletion', limiter.nodeDeletionAttempts, limiter.nodeDeletion, express.json({ limit: '4kb' }), async (req, res) => {
	if (!process.env.TURNSTILE_SITEKEY || !process.env.TURNSTILE_SECRET) {
		return res.status(503).json({ success: false, status: 503, message: req.t('map:deletion.errors.unavailable') });
	}

	const { publicKey, ownerConfirmed, token, language } = req.body || {};
	if (ownerConfirmed !== true || typeof publicKey !== 'string' || !(/^[a-f0-9]{64}$/i).test(publicKey)) {
		return res.status(400).json({ success: false, status: 400, message: req.t('map:deletion.errors.invalidRequest') });
	}

	if (!(await verifyTurnstile(token, req.ip, req.hostname, { action: 'node-deletion', cdata: publicKey }))) {
		return res.status(400).json({ success: false, status: 400, message: req.t('map:deletion.errors.captcha') });
	}

	const t = key => req.t(key, { lng: ['pl', 'en'].includes(language) ? language : req.language });
	res.json({ success: true, status: 200, message: 'OK', data: { mailto: buildDeletionMailUrl(publicKey, t, req.site.domain) } });
});

router.use('/node-deletion', (err, req, res, _next) => {
	const status = [400, 413].includes(err.status) ? err.status : 500;
	if (status === 500) console.error(err);

	res.status(status).json({
		success: false,
		status,
		message: req.t(status === 500 ? 'error:internalServerError' : 'map:deletion.errors.invalidRequest'),
	});
});

export default router;
