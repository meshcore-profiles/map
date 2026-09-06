const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const RedisClient = require('../services/redis.js');
const HttpError = require('../utils/httpError.js');

const globalLimiter = rateLimit({
	windowMs: 40 * 1000,
	limit: 52,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	store: new RedisStore({ sendCommand: (...args) => RedisClient.sendCommand(args), prefix: 'mcprof:ratelimit:map:' }),
	handler: (req, res) => HttpError(res, 429),
});

module.exports = globalLimiter;
