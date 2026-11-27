import createRateLimit from '../../../global/middlewares/rateLimit.js';
import HttpError from '../utils/httpError.js';

export const global = createRateLimit({ windowMs: 40 * 1000, limit: 24, prefix: 'mcprof-map:ratelimit:global:', handler: (req, res) => HttpError(res, 429) });

const deletionLimitHandler = (req, res) => res.status(429).json({ success: false, status: 429, message: req.t('map:deletion.errors.rateLimited') });

export const nodeDeletionAttempts = createRateLimit({
	windowMs: 10 * 60 * 1000,
	limit: 10,
	requestPropertyName: 'nodeDeletionAttemptsLimit',
	prefix: 'mcprof-map:ratelimit:deletion:attempts:',
	handler: deletionLimitHandler,
});

export const nodeDeletion = createRateLimit({
	windowMs: 24 * 60 * 60 * 1000,
	limit: 3,
	skipFailedRequests: true,
	requestPropertyName: 'nodeDeletionDailyLimit',
	prefix: 'mcprof-map:ratelimit:deletion:daily:',
	handler: deletionLimitHandler,
});

export const nodeProfile = createRateLimit({ windowMs: 60 * 1000, limit: 60, prefix: 'mcprof-map:ratelimit:node-profile:', handler: (req, res) => HttpError(res, 429) });
