import { Router } from 'express';
import { getCachedNodes, getLastRefreshedAt, getStats, formatWarsawDate } from '../../../global/services/nodeCache.js';
import getRadioPresets from '../services/radioPresets.js';
import features from '../config/features.js';
import { PROFILES_URL } from '../config/profiles.js';
import HttpError from '../utils/httpError.js';
import getNodeProfile from '../services/nodeProfile.js';
import { nodeProfile as nodeProfileLimiter } from '../middlewares/ratelimit.js';
import StatsDaily from '../../../global/database/models/statsDaily.model.js';

const router = Router();

const MAX_HISTORY_DAYS = 365;
const DEFAULT_HISTORY_DAYS = 90;
const MAX_HISTORY_ROWS = 5000;

const getRegion = req => req.query.region === 'all' ? 'all' : 'pl';

const handle = fn => async (req, res) => {
	try {
		await fn(req, res);
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, status: 500, message: req.t('error:internalServerError') });
	}
};

router.get('/nodes', handle(async (req, res) => {
	const [nodes, lastRefreshedAt] = await Promise.all([getCachedNodes(getRegion(req)), getLastRefreshedAt()]);
	if (!nodes) return res.status(503).json({ success: false, status: 503, message: req.t('error:nodesNotAvailable') });

	res.set('Content-Type', 'application/octet-stream');
	res.set('Cache-Control', 'no-store');

	if (lastRefreshedAt) res.set('X-Data-Updated', lastRefreshedAt.toISOString());

	res.send(nodes);
}));

// Basemap keys for the mobile app: its own keys (*_MOBILE, created for the app without the website's referrer restriction), never the site's.
// Esri is left out on purpose: its terms forbid storing its map data, and the native map caches tiles on disk.
const getBasemapConfig = () => ({
	cartoApiKey: process.env.CARTO_API_KEY_MOBILE || null,
	maptilerApiKey: process.env.MAPTILER_API_KEY_MOBILE || null,
});

// Config for the mobile client (the same data the site gets in window.MAP_CONFIG).
router.get('/app-config', (req, res) => {
	res.set('Cache-Control', 'public, max-age=300');
	res.json({ success: true, status: 200, message: 'OK', data: { features, sefinekApi: process.env.SEFINEK_API || null, bugsnagApiKey: process.env.BUGSNAG_API_KEY || null, basemaps: getBasemapConfig() } });
});

router.get('/node-profile/:publicKey', nodeProfileLimiter, handle(async (req, res) => {
	const profile = await getNodeProfile(req.params.publicKey);
	if (profile === undefined) return HttpError(res, 400);

	res.set('Cache-Control', 'public, max-age=60');
	if (!profile) return res.status(404).json({ success: false, status: 404, message: 'Not found' });

	res.json({ success: true, status: 200, message: 'OK', data: { ...profile, profileUrl: PROFILES_URL } });
}));

router.get('/radio-presets', handle(async (req, res) => {
	const presets = await getRadioPresets();
	if (!presets.length) return res.status(503).json({ success: false, status: 503, message: req.t('error:radioPresetsNotAvailable') });

	res.set('Cache-Control', 'public, max-age=300');
	res.json({ success: true, status: 200, message: 'OK', data: presets });
}));

router.get('/repeater-stats', handle(async (req, res) => {
	res.set('Access-Control-Allow-Origin', '*');

	const stats = await getStats(getRegion(req));
	if (!stats) return res.status(503).json({ success: false, status: 503, message: req.t('error:nodesNotAvailable') });

	res.set('Cache-Control', 'public, max-age=60');
	res.json({ success: true, status: 200, message: 'OK', data: stats });
}));

router.get('/stats/history', handle(async (req, res) => {
	res.set('Access-Control-Allow-Origin', '*');

	const query = { region: getRegion(req) };

	if (req.query.days !== 'all') {
		const days = Math.min(Math.max(parseInt(req.query.days, 10) || DEFAULT_HISTORY_DAYS, 1), MAX_HISTORY_DAYS);

		const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
		query.date = { $gte: formatWarsawDate(cutoff) };
	}

	const history = await StatsDaily.find(query, '-_id -region')
		.sort({ date: 1 })
		.limit(MAX_HISTORY_ROWS)
		.lean();

	res.set('Cache-Control', 'public, max-age=300');
	res.json({ success: true, status: 200, message: 'OK', data: history });
}));

export default router;
