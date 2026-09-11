process.loadEnvFile();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const crypto = require('node:crypto');
const { version } = require('./package.json');
const { DOMAIN, NODE_ENV, PORT, SITE_MODE } = process.env;
const isProd = NODE_ENV === 'production';
const siteMode = (SITE_MODE || 'auto').toLowerCase();
const SITES = require('./config/sites.js');

const resolveSite = req => {
	if (siteMode === 'poland') return SITES.poland;
	if (siteMode === 'global') return SITES.global;
	return SITES.HOSTS[req.hostname] || SITES.default;
};

// Node data itself is fetched/cached into Redis by the meshcore-profiles/cronjobs worker;
// this app only reads it (see global/services/nodeCache.js).
require('./global/database/mongoose.js');

// Middleware imports
const timeout = require('./middlewares/timeout.js');
const logger = require('./global/middlewares/morgan.js');
const globalLimiter = require('./middlewares/ratelimit.js');
const language = require('./middlewares/language.js');
const languageNegotiation = require('./middlewares/languageNegotiation.js');
const { detectLanguagePrefix, isLanguageAgnosticPath } = require('./global/utils/languageResolver.js');
const HttpError = require('./utils/httpError.js');

// Create an Express app
const app = express();

// Configure the app
if (isProd) app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.locals.domain = `${process.env.DOMAIN}${isProd ? '' : `:${process.env.PORT}`}`;
app.locals.v = version;

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
	'https://server.arcgisonline.com',
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
	contentSecurityPolicy: {
		useDefaults: false,
		directives: {
			defaultSrc: ['\'self\''],
			baseUri: ['\'self\''],
			objectSrc: ['\'none\''],
			scriptSrc: ['\'self\'', 'https://cdn.sefinek.net', (req, res) => `'nonce-${res.locals.cspNonce}'`],
			scriptSrcAttr: ['\'none\''],
			styleSrc: ['\'self\'', 'https://fonts.googleapis.com', (req, res) => `'nonce-${res.locals.cspNonce}'`],
			fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
			imgSrc: ['\'self\'', 'data:', 'blob:', 'https://meshcorepolska.org', ...TILE_HOSTS],
			connectSrc: ['\'self\'', 'https://meshcorepolska.org', 'https://api.meshcore.nz', 'https://api.open-elevation.com', 'https://api.open-meteo.com', ...(process.env.SEFINEK_API ? [process.env.SEFINEK_API] : []), ...TILE_HOSTS],
			workerSrc: ['\'self\'', 'blob:'],
			childSrc: ['\'self\'', 'blob:'],
			manifestSrc: ['\'self\''],
			frameAncestors: ['\'self\''],
			formAction: ['\'self\''],
		},
	},
}));
app.use(cors({ origin: SAFE_ORIGINS }));
app.use(express.static('public'));
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
app.use(languageNegotiation);
app.use(language);
app.use(logger);
if (isProd) app.use(globalLimiter);
app.use(timeout());


// Routes
const IndexRouter = require('./routes/Index.js');
const APIRouter = require('./routes/Api.js');

app.use(IndexRouter);
app.use('/api/v1', APIRouter);


// Error handling
app.use((req, res) => HttpError(res, 404));
app.use((err, req, res, _next) => HttpError(res, 500, err));


// Start the server
app.listen(PORT, () => process.send ? process.send('ready') : console.log(`Server running at ${DOMAIN}:${PORT}`));
