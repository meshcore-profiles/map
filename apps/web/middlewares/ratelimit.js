const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const RedisClient = require('../global/services/redis.js');
const HttpError = require('../utils/httpError.js');

const redisStore = prefix => new RedisStore({ sendCommand: (...args) => RedisClient.sendCommand(args), prefix });

exports.global = rateLimit({
	windowMs: 40 * 1000,
	limit: 52,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	store: redisStore('mcprof:ratelimit:map:'),
	handler: (req, res) => HttpError(res, 429),
});

const deletionLimitHandler = (req, res) => res.status(429).json({ success: false, status: 429, message: req.t('map:deletion.errors.rateLimited') });

exports.nodeDeletionAttempts = rateLimit({
	windowMs: 10 * 60 * 1000,
	limit: 10,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	requestPropertyName: 'nodeDeletionAttemptsLimit',
	store: redisStore('mcprof:ratelimit:map:deletion:attempts:'),
	handler: deletionLimitHandler,
});

exports.nodeDeletion = rateLimit({
	windowMs: 24 * 60 * 60 * 1000,
	limit: 3,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	skipFailedRequests: true,
	requestPropertyName: 'nodeDeletionDailyLimit',
	store: redisStore('mcprof:ratelimit:map:deletion:daily:'),
	handler: deletionLimitHandler,
});
