import '../loadEnv.js';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => arg.startsWith('-'))) {
	const help = args.length === 1 && args[0] === '--help';
	console[help ? 'log' : 'error']('Usage: node scripts/export-testers.js [output.csv]');
	process.exit(help ? 0 : 1);
}

const outputPath = args.length ? path.resolve(args[0]) : path.join(import.meta.dirname, 'testers.csv');


import connection from '../global/database/mongoose.js';
import TesterSignup from '../apps/web/models/testerSignup.model.js';

const main = async () => {
	await connection.asPromise();

	const recipients = await TesterSignup.find({}).select('email -_id').sort({ email: 1 }).lean();
	const emails = [...new Set(recipients.map(({ email }) => {
		if (typeof email !== 'string' || !email.trim() || (/[\s,;"\uFEFF]/u).test(email)) {
			throw new Error('Invalid email in TesterSignup. Export aborted without writing the CSV.');
		}
		return email.toLowerCase();
	}))];

	await writeFile(outputPath, emails.length ? `${emails.join('\r\n')}\r\n` : '', 'utf8');
	console.log(`Exported ${emails.length} email addresses to ${outputPath}`);
};

main()
	.catch(err => {
		console.error(err.message);
		process.exitCode = 1;
	})
	.finally(() => connection.close());
