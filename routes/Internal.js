const router = require('express').Router();
const crypto = require('crypto');
const { getStats, formatWarsawDate } = require('../services/nodes.js');
const StatsDaily = require('../global/database/models/statsDaily.model.js');

const REGIONS = ['pl', 'all'];
const DAY_MS = 24 * 60 * 60 * 1000;

// Constant-time comparison so response timing can't leak how much of the secret was guessed correctly.
const secretMatches = provided => {
	const expected = process.env.STATS_SNAPSHOT_SECRET;
	if (!expected || !provided) return false;

	const a = Buffer.from(provided);
	const b = Buffer.from(expected);
	return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Triggered externally (by the meshcore-profiles/cronjobs worker, once a day) instead of running
// an in-process CronJob here - keeps scheduling out of this app while the DB write itself stays
// next to the Mongoose connection and the already-computed in-process node stats it needs.
router.post('/stats-snapshot', async (req, res) => {
	if (!secretMatches(req.get('X-Internal-Secret'))) return res.status(403).json({ success: false, status: 403, message: 'Forbidden' });

	const date = formatWarsawDate(new Date(Date.now() - DAY_MS));
	const results = {};

	for (const region of REGIONS) {
		try {
			const stats = await getStats(region);
			if (!stats) {
				results[region] = 'no-data';
				continue;
			}

			const { total, active, nodes, types, status } = stats;
			await StatsDaily.updateOne(
				{ region, date },
				{ $set: { total, active, nodes, types, status } },
				{ upsert: true }
			);

			results[region] = 'ok';
		} catch (err) {
			console.error(`[stats-snapshot] Failed for region "${region}":`, err.message || err);
			results[region] = 'error';
		}
	}

	res.json({ success: true, status: 200, date, results });
});

module.exports = router;
