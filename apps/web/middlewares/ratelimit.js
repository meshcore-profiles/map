import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import RedisClient from '../../../global/services/redis.js';
import HttpError from '../utils/httpError.js';

const redisStore = prefix => new RedisStore({ sendCommand: (...args) => RedisClient.sendCommand(args), prefix });

export const global = rateLimit({
	windowMs: 40 * 1000,
	limit: 24,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	store: redisStore('mcprof-map:ratelimit:global:'),
	handler: (req, res) => HttpError(res, 429),
});

const deletionLimitHandler = (req, res) => res.status(429).json({ success: false, status: 429, message: req.t('map:deletion.errors.rateLimited') });

export const nodeDeletionAttempts = rateLimit({
	windowMs: 10 * 60 * 1000,
	limit: 10,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	requestPropertyName: 'nodeDeletionAttemptsLimit',
	store: redisStore('mcprof-map:ratelimit:deletion:attempts:'),
	handler: deletionLimitHandler,
});

export const nodeDeletion = rateLimit({
	windowMs: 24 * 60 * 60 * 1000,
	limit: 3,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	skipFailedRequests: true,
	requestPropertyName: 'nodeDeletionDailyLimit',
	store: redisStore('mcprof-map:ratelimit:deletion:daily:'),
	handler: deletionLimitHandler,
});

const testerSignupLimitHandler = (req, res) => res.status(429).json({ success: false, status: 429, message: req.t('map:testers.errors.rateLimited') });

export const testerSignup = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 5,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	requestPropertyName: 'testerSignupLimit',
	store: redisStore('mcprof-map:ratelimit:testers:'),
	handler: testerSignupLimitHandler,
});

export const nodeProfile = rateLimit({
	windowMs: 60 * 1000,
	limit: 60,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	store: redisStore('mcprof-map:ratelimit:node-profile:'),
	handler: (req, res) => HttpError(res, 429),
});
