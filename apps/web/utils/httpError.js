import fs from 'node:fs';
import path from 'node:path';
import ejs from 'ejs';

// Compiled up front and rendered synchronously: the timeout middleware disables res.send once its handler returns
const renderPage = ejs.compile(fs.readFileSync(path.join(import.meta.dirname, '../views/error.ejs'), 'utf8'));

const wantsPage = ({ req, locals }) => locals.t && !req.originalUrl.startsWith('/api/') && req.accepts(['json', 'html']) === 'html';

export default (res, status, err) => {
	if (err) console.error(err);
	if (res.headersSent) return res.end();

	res.status(status);
	if (!wantsPage(res)) return res.end();

	res.set('Cache-Control', 'no-store').type('html').send(renderPage({ ...res.app.locals, ...res.locals, status }));
};
