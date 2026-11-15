const router = require('express').Router();
const HttpError = require('../utils/httpError.js');

const MAX_NODES = 24;
const MAX_NAME_LENGTH = 64;
const KEY_PATTERN = /^[0-9a-f]{64}$/;
const KINDS = new Set(['repeater', 'roomServer']);
const isProd = process.env.NODE_ENV === 'production';

const ALLOWED_PARENTS = (process.env.EMBED_PARENTS || '')
	.split(',')
	.map(origin => origin.trim())
	.filter(Boolean);
if (!ALLOWED_PARENTS.length) ALLOWED_PARENTS.push('https://meshcoreprofiles.com');

// The embedding site decides which nodes are public and passes them in; this page only validates and draws them
const parsePoints = raw => {
	if (typeof raw !== 'string' || raw.length > 16384) return [];

	let list;
	try {
		list = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
	} catch {
		return [];
	}
	if (!Array.isArray(list)) return [];

	const seen = new Set();
	const points = [];
	for (const item of list) {
		const k = typeof item?.k === 'string' ? item.k.toLowerCase() : '';
		if (!KEY_PATTERN.test(k) || seen.has(k) || !KINDS.has(item.t)) continue;
		if (!Number.isFinite(item.a) || !Number.isFinite(item.o) || Math.abs(item.a) > 90 || Math.abs(item.o) > 180) continue;
		if (typeof item.n !== 'string' || !item.n.trim()) continue;

		seen.add(k);
		points.push({ k, n: item.n.trim().slice(0, MAX_NAME_LENGTH), t: item.t, a: item.a, o: item.o });
		if (points.length >= MAX_NODES) break;
	}
	return points;
};

// helmet pins frame-ancestors to 'self' app-wide; only this page may be framed, and only by the profiles site
const allowFraming = res => {
	res.removeHeader('X-Frame-Options');
	const csp = res.getHeader('Content-Security-Policy');
	if (typeof csp === 'string') res.setHeader('Content-Security-Policy', csp.replace(/frame-ancestors [^;]*/, `frame-ancestors ${ALLOWED_PARENTS.join(' ')}`));
};

router.get('/embed', (req, res) => {
	const points = parsePoints(req.query.data);
	if (!points.length) return HttpError(res, 400);

	allowFraming(res);
	res.set('Cache-Control', isProd ? 'public, max-age=60' : 'no-store');
	res.set('X-Robots-Tag', 'noindex');
	res.render('embed.ejs', { points, cover: req.query.view === 'cover' });
});

module.exports = router;
