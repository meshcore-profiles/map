const router = require('express').Router();
const { getCachedNodes, getLastRefreshedAt, getStats, formatWarsawDate } = require('../services/nodes.js');
const StatsDaily = require('../database/models/statsDaily.model.js');

const MAX_HISTORY_DAYS = 365;
const DEFAULT_HISTORY_DAYS = 90;

router.get('/nodes', async (req, res) => {
	try {
		const region = req.query.region === 'all' ? 'all' : 'pl';
		const nodes = await getCachedNodes(region);
		if (!nodes) return res.status(503).json({ success: false, status: 503, message: req.t('error:nodesNotAvailable') });

		res.set('Content-Type', 'application/octet-stream');
		res.set('Cache-Control', 'no-store');

		const lastRefreshedAt = getLastRefreshedAt();
		if (lastRefreshedAt) res.set('X-Data-Updated', lastRefreshedAt.toISOString());

		res.send(nodes);
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, status: 500, message: req.t('error:internalServerError') });
	}
});

router.get('/repeater-stats', async (req, res) => {
	res.set('Access-Control-Allow-Origin', '*');

	try {
		const stats = await getStats();
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
			.lean();

		res.set('Cache-Control', 'public, max-age=300');
		res.json({ success: true, status: 200, message: 'OK', data: history });
	} catch (err) {
		console.error(err);
		res.status(500).json({ success: false, status: 500, message: req.t('error:internalServerError') });
	}
});

module.exports = router;
