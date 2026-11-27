import '../../loadEnv.js';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import crypto from 'node:crypto';
import path from 'node:path';
// The version lives in the root package.json only (the shared global/ code reads it too).
import pkg from '../../package.json' with { type: 'json' };
import { parseAppVersion } from '@meshcore-map/core/version';

import MongooseConnection from '../../global/database/mongoose.js';
import RedisClient from '../../global/services/redis.js';
import timeout from './middlewares/timeout.js';
import logger from '../../global/middlewares/morgan.js';
import * as limiter from './middlewares/ratelimit.js';
import language from './middlewares/language.js';
import languageNegotiation from './middlewares/languageNegotiation.js';
import { detectLanguagePrefix, isLanguageAgnosticPath } from '../../global/utils/languageResolver.js';
import { SUPPORTED } from '../../global/services/i18n.js';
import HttpError from './utils/httpError.js';
import features from './config/features.js';
import { PROFILES_ORIGIN, FLASHER_ORIGIN } from './config/profiles.js';
import AppLinksRouter from './routes/AppLinks.js';
import * as SITES from './config/sites.js';
import IndexRouter from './routes/Index.js';
import APIRouter from './routes/Api.js';
import NodeDeletionRouter from './routes/NodeDeletion.js';
import EmbedRouter from './routes/Embed.js';

const { version } = pkg;
const { DOMAIN, NODE_ENV, PORT, SITE_MODE } = process.env;
const isProd = NODE_ENV === 'production';
const siteMode = (SITE_MODE || 'auto').toLowerCase();

const resolveSite = req => {
	if (siteMode === 'poland') return SITES.poland;
	if (siteMode === 'global') return SITES.global;
	return SITES.HOSTS[req.hostname] || SITES.default;
};

// Create an Express app
const app = express();

// Configure the app
if (isProd) app.set('trust proxy', 1);
// Absolute paths, so the start directory does not matter (`node .` from the repo root works like `npm start`).
app.set('views', path.join(import.meta.dirname, 'views'));
app.set('view engine', 'ejs');
app.locals.domain = `${process.env.DOMAIN}${isProd ? '' : `:${process.env.PORT}`}`;
// package.json holds "x.y.z+YYYYMMDD": the version and the release date are shown separately.
const release = parseAppVersion(version);
app.locals.v = release.version;
app.locals.releaseDate = release.date;
app.locals.features = features;

// Safe origins allowed to read this app's resources cross-origin (e.g. the flasher app loading static JS)
const SAFE_ORIGINS = [
	'https://flasher.meshcorepolska.org',
	...(isProd ? [] : ['http://127.0.0.1:4101', 'http://localhost:4101']),
];

// External hosts the frontend actually loads resources from (tiles, elevation lookups, etc.)
const TILE_HOSTS = [
	'https://tile.openstreetmap.org',
	'https://*.tile.opentopomap.org',
	'https://*.tile-cyclosm.openstreetmap.fr',
	'https://*.tile.openstreetmap.fr',
	'https://ibasemaps-api.arcgis.com',
	'https://basemapstyles-api.arcgis.com',
	'https://basemaps-api.arcgis.com',
	'https://cdn.arcgis.com',
	'https://*.basemaps.cartocdn.com',
	'https://api.maptiler.com',
	'https://tiles.openfreemap.org',
];

// Generate a per-request CSP nonce for the inline <script>/<style> tags in views/*.ejs
app.use((req, res, next) => {
	res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
	next();
});

// Use middlewares
app.use(helmet({
	crossOriginResourcePolicy: false,
	referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
	contentSecurityPolicy: {
		useDefaults: false,
		directives: {
			defaultSrc: ['\'self\''],
			baseUri: ['\'self\''],
			objectSrc: ['\'none\''],
			scriptSrc: ['\'self\'', 'https://cdn.sefinek.net', 'https://challenges.cloudflare.com', (req, res) => `'nonce-${res.locals.cspNonce}'`],
			scriptSrcAttr: ['\'none\''],
			styleSrc: ['\'self\'', 'https://fonts.googleapis.com', (req, res) => `'nonce-${res.locals.cspNonce}'`],
			fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
			imgSrc: ['\'self\'', 'data:', 'blob:', 'https://meshcorepolska.org', PROFILES_ORIGIN, FLASHER_ORIGIN, ...TILE_HOSTS],
			connectSrc: ['\'self\'', 'https://challenges.cloudflare.com', 'https://meshcorepolska.org', 'https://api.open-elevation.com', 'https://api.open-meteo.com', ...(process.env.SEFINEK_API ? [process.env.SEFINEK_API] : []), ...TILE_HOSTS],
			workerSrc: ['\'self\'', 'blob:'],
			childSrc: ['\'self\'', 'blob:'],
			frameSrc: ['\'self\'', 'blob:', 'https://challenges.cloudflare.com'],
			manifestSrc: ['\'self\''],
			frameAncestors: ['\'self\''],
			formAction: ['\'self\''],
		},
	},
}));
app.use(cors({ origin: SAFE_ORIGINS }));
app.use(express.static(path.join(import.meta.dirname, 'public')));
app.use('/core', express.static(path.join(import.meta.dirname, '../../packages/core/src')));
app.use(AppLinksRouter);
app.use((req, res, next) => {
	req.site = resolveSite(req);
	next();
});
app.use((req, res, next) => {
	if (isLanguageAgnosticPath(req.path)) return next();

	const detected = detectLanguagePrefix(req.url, req.site.defaultLanguage);
	if (detected) {
		req.forcedLanguage = detected.language;
		req.url = detected.url;
	}
	next();
});
// The embedded map is framed by another site, so its language comes from ?lang= instead of a URL prefix or negotiation
app.use((req, res, next) => {
	if (req.path === '/embed' && SUPPORTED.includes(req.query.lang)) req.forcedLanguage = req.query.lang;
	next();
});
app.use(languageNegotiation);
app.use(language);
app.use(logger);
if (isProd) app.use(limiter.global);
app.use(timeout());


// Routes
app.use(IndexRouter);
app.use(EmbedRouter);
app.use('/api/v1', APIRouter);
app.use('/api/v1', NodeDeletionRouter);


// Error handling
app.use((req, res) => HttpError(res, 404));
app.use((err, req, res, _next) => HttpError(res, err.status >= 400 && err.status < 600 ? err.status : 500, err));


// Start the server
const server = app.listen(PORT, () => process.send ? process.send('ready') : console.log(`Server running at ${DOMAIN}:${PORT}`));

// Let in-flight requests finish before closing the database and Redis connections (PM2 sends SIGINT on restart)
let shuttingDown = false;
const shutdown = signal => {
	if (shuttingDown) return;
	shuttingDown = true;
	console.log(`${signal} received, shutting down...`);

	setTimeout(() => process.exit(1), 5000).unref();

	server.close(async () => {
		await Promise.allSettled([MongooseConnection.close(), RedisClient.quit()]);
		process.exit(0);
	});
	server.closeIdleConnections();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
