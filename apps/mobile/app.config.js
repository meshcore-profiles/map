const { execFileSync } = require('node:child_process');

// Expo merges app.json into `config`; this adds what is known only when the app is built: the time and the commit (shown in the settings).
// app.json stays the single static source for the rest, since the web server also reads it (routes/AppLinks.js).
const gitCommit = () => {
	try {
		return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
	} catch {
		return null;
	}
};

module.exports = ({ config }) => ({
	...config,
	extra: { ...config.extra, buildTime: new Date().toISOString(), commit: gitCommit() },
});
