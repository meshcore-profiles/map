const { CronJob } = require('cron');
const { getStats, formatWarsawDate } = require('./nodes.js');
const StatsDaily = require('../database/models/statsDaily.model.js');

const REGIONS = ['pl', 'all'];
const DAY_MS = 24 * 60 * 60 * 1000;

const takeDailySnapshots = async () => {
	const date = formatWarsawDate(new Date(Date.now() - DAY_MS));

	for (const region of REGIONS) {
		try {
			const stats = await getStats(region);
			if (!stats) {
				console.error(`[takeDailySnapshots] No cached nodes for region "${region}", skipping snapshot`);
				continue;
			}

			const { total, active, nodes, types, status } = stats;

			await StatsDaily.updateOne(
				{ region, date },
				{ $set: { total, active, nodes, types, status } },
				{ upsert: true }
			);

			console.log(`[takeDailySnapshots] Snapshot saved for region "${region}" (${date}): total=${total}, nodes=${nodes}, roomServer=${types.roomServer}, client=${types.client}`);
		} catch (err) {
			console.error(`[takeDailySnapshots] Failed to take daily snapshot for region "${region}":`, err.message || err.stack);
		}
	}
};

new CronJob('0 0 * * *', takeDailySnapshots, null, true, 'Europe/Warsaw');
void takeDailySnapshots();
