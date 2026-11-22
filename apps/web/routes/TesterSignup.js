import express from 'express';
import emailValidator from '@sefinek/email-validator';
import verifyMx from '@sefinek/email-validator/mx';
import * as limiter from '../middlewares/ratelimit.js';
import verifyTurnstile from '../services/turnstile.js';
import TesterSignup from '../models/testerSignup.model.js';

const router = express.Router();
const MX_OPTIONS = { validateSyntax: false, timeout: 2500, tries: 2, failOpen: true };

router.use('/tester-signup', (req, res, next) => {
	res.set('Cache-Control', 'no-store');
	next();
});

router.post('/tester-signup', limiter.testerSignup, express.json({ limit: '4kb' }), async (req, res) => {
	if (!req.site.testerSignup || !process.env.TURNSTILE_SITEKEY || !process.env.TURNSTILE_SECRET) {
		return res.status(503).json({ success: false, status: 503, message: req.t('map:testers.errors.unavailable') });
	}

	const { email, consent, token, language } = req.body || {};
	const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
	if (consent !== true || normalized.length > 254 || !emailValidator(normalized)) {
		return res.status(400).json({ success: false, status: 400, message: req.t('map:testers.errors.invalidRequest') });
	}

	if (!(await verifyTurnstile(token, req.ip, req.hostname, { action: 'tester-signup' }))) {
		return res.status(400).json({ success: false, status: 400, message: req.t('map:testers.errors.captcha') });
	}

	if (!(await verifyMx(normalized, MX_OPTIONS))) {
		return res.status(400).json({ success: false, status: 400, message: req.t('map:testers.errors.invalidDomain') });
	}

	try {
		await TesterSignup.updateOne(
			{ email: normalized },
			{ $setOnInsert: { email: normalized, language: language === 'en' ? 'en' : 'pl', consentAt: new Date() } },
			{ upsert: true }
		);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ success: false, status: 500, message: req.t('error:internalServerError') });
	}

	res.json({ success: true, status: 200, message: 'OK' });
});

router.use('/tester-signup', (err, req, res, _next) => {
	const status = [400, 413].includes(err.status) ? err.status : 500;
	if (status === 500) console.error(err);

	res.status(status).json({
		success: false,
		status,
		message: req.t(status === 500 ? 'error:internalServerError' : 'map:testers.errors.invalidRequest'),
	});
});

export default router;
