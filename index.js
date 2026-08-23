process.loadEnvFile();
const express = require('express');
const helmet = require('helmet');
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

// Fetch nodes on boot, then keep the Redis cache warm on an interval
const { startNodesRefreshJob } = require('./services/nodes.js');
startNodesRefreshJob();

require('./database/mongoose.js');
require('./services/statsHistory.js');

// Middleware imports
const timeout = require('./middlewares/timeout.js');
const logger = require('./middlewares/morgan.js');
const globalLimiter = require('./middlewares/ratelimit.js');
const language = require('./middlewares/language.js');
const languageNegotiation = require('./middlewares/languageNegotiation.js');
const { detectLanguagePrefix, isLanguageAgnosticPath } = require('./utils/languageResolver.js');
const HttpError = require('./utils/httpError.js');

// Create an Express app
const app = express();

// Configure the app
if (isProd) app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.locals.domain = `${process.env.DOMAIN}${isProd ? '' : `:${process.env.PORT}`}`;
app.locals.v = version;
app.locals.sefinekApi = process.env.SEFINEK_API;

// Use middlewares
app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));
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
