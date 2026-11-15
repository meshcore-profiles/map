const router = require('express').Router();
const { getCachedNodes, getLastRefreshedAt, getStats, formatWarsawDate } = require('../../../global/services/nodeCache.js');
const getRadioPresets = require('../services/radioPresets.js');
const features = require('../config/features.js');
const StatsDaily = require('../../../global/database/models/statsDaily.model.js');

const MAX_HISTORY_DAYS = 365;
const DEFAULT_HISTORY_DAYS = 90;
const MAX_HISTORY_ROWS = 5000;

router.get('/nodes', async (req, res) => {
	try {
		const region = req.query.region === 'all' ? 'all' : 'pl';
		const [nodes, lastRefreshedAt] = await Promise.all([getCachedNodes(region), getLastRefreshedAt()]);
		if (!nodes) return res.status(503).json({ success: false, status: 503, message: req.t('error:nodesNotAvailable') });

		res.set('Content-Type', 'application/octet-stream');
		res.set('Cache-Control', 'no-store');

		if (lastRefreshedAt) res.set('X-Data-Updated', lastRefreshedAt.toISOString());

		res.send(nodes);
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, status: 500, message: req.t('error:internalServerError') });
	}
});

// Basemap keys for the mobile app. The site's keys are restricted to its origin, so the app gets its own (*_MOBILE) and falls back to the site's ones.
const getBasemapConfig = () => ({
	esriApiKey: process.env.ESRI_API_KEY_MOBILE || process.env.ESRI_API_KEY || null,
	cartoApiKey: process.env.CARTO_API_KEY_MOBILE || process.env.CARTO_API_KEY || null,
	maptilerApiKey: process.env.MAPTILER_API_KEY_MOBILE || process.env.MAPTILER_API_KEY || null,
});

// Konfiguracja dla klienta mobilnego (to samo, co strona dostaje we window.MAP_CONFIG).
router.get('/app-config', (req, res) => {
	res.set('Cache-Control', 'public, max-age=300');
	res.json({ success: true, status: 200, message: 'OK', data: { features, sefinekApi: process.env.SEFINEK_API || null, basemaps: getBasemapConfig() } });
});

router.get('/radio-presets', async (req, res) => {
	try {
		const presets = await getRadioPresets();
		if (!presets.length) return res.status(503).json({ success: false, status: 503, message: req.t('error:radioPresetsNotAvailable') });

		res.set('Cache-Control', 'public, max-age=300');
		res.json({ success: true, status: 200, message: 'OK', data: presets });
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, status: 500, message: req.t('error:internalServerError') });
	}
});

router.get('/repeater-stats', async (req, res) => {
	res.set('Access-Control-Allow-Origin', '*');

	try {
		const region = req.query.region === 'all' ? 'all' : 'pl';
		const stats = await getStats(region);
		if (!stats) return res.status(503).json({ success: false, status: 503, message: req.t('error:nodesNotAvailable') });

		res.set('Cache-Control', 'public, max-age=60');
		res.json({ success: true, status: 200, message: 'OK', data: stats });
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, status: 500, message: req.t('error:internalServerError') });
	}
});

router.get('/stats/history', async (req, res) => {
	res.set('Access-Control-Allow-Origin', '*');

	try {
		const region = req.query.region === 'all' ? 'all' : 'pl';
		const query = { region };

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
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, status: 500, message: req.t('error:internalServerError') });
	}
});

module.exports = router;
