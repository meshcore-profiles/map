process.loadEnvFile();
require('./mongoose.js');

const mongoose = require('mongoose');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
	try {
		const modelsPath = path.join(__dirname, 'models');
		const files = await fs.readdir(modelsPath, { recursive: true });

		files
			.filter(file => file.endsWith('.js'))
			.forEach(file => require(path.join(modelsPath, file)));

		for (const [name, model] of Object.entries(mongoose.models)) {
			const { toDrop, toCreate } = await model.diffIndexes();

			if (!toDrop.length && !toCreate.length) {
				continue;
			}

			console.log(`\n${name}`);

			if (toDrop.length) {
				console.log('Indexes to drop:');
				console.log(toDrop);
			}

			if (toCreate.length) {
				console.log('Indexes to create:');
				console.log(toCreate);
			}

			await model.syncIndexes();

			console.log(`Synced indexes for: ${name}`);
		}
	} catch (err) {
		console.error(err);
		process.exitCode = 1;
	} finally {
		await mongoose.disconnect();
	}
})();