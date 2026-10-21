const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { test, mock } = require('node:test');
const vm = require('node:vm');

const publicKey = '6574f4c4845511a77044ba12907d23541993f6671af13b1cb94cf3e89c081f14';
const hostname = 'mapa.meshcorepolska.org';

const loadModule = (file, stubs, env = {}) => {
	const filename = resolve(__dirname, '..', file);
	const localRequire = createRequire(filename);
	const module = { exports: {} };
	vm.runInNewContext(readFileSync(filename, 'utf8'), {
		require: name => Object.hasOwn(stubs, name) ? stubs[name] : localRequire(name),
		module,
		exports: module.exports,
		URLSearchParams,
		process: { env },
		console: { error: mock.fn() },
	}, { filename });
	return module.exports;
};

const loadVerifier = (post, secret = 'test-secret', nodeEnv = 'production') => loadModule('services/turnstile.js', {
	'../global/services/axios.js': { post },
}, { TURNSTILE_SECRET: secret, NODE_ENV: nodeEnv });

test('Turnstile rejects absent, malformed and oversized tokens without a network call', async () => {
	let calls = 0;
	const verify = loadVerifier(async () => { calls++; });
	for (const token of [undefined, null, {}, 12, '', 'a'.repeat(2049)]) {
		assert.equal(await verify(token, '127.0.0.1', hostname, publicKey), false);
	}
	assert.equal(calls, 0);
});

test('Turnstile requires a configured secret', async () => {
	const verify = loadVerifier(() => assert.fail('Unexpected network call'), '');
	assert.equal(await verify('token', '127.0.0.1', hostname, publicKey), false);
});

test('Whitespace tokens are rejected by Siteverify without being trimmed', async () => {
	let calls = 0;
	const verify = loadVerifier(async (url, body) => {
		calls++;
		assert.equal(body.get('response'), ' ');
		return { data: { success: false } };
	});
	assert.equal(await verify(' ', '127.0.0.1', hostname, publicKey), false);
	assert.equal(calls, 1);
});

test('Development and test environments accept successful Siteverify responses with dummy metadata', async () => {
	for (const nodeEnv of ['development', 'test']) {
		let calls = 0;
		const verify = loadVerifier(async () => {
			calls++;
			return { data: { success: true, hostname: 'localhost', action: 'test', cdata: 'test-data' } };
		}, '1x0000000000000000000000000000000AA', nodeEnv);
		assert.equal(await verify('XXXX.DUMMY.TOKEN.XXXX', '127.0.0.1', '127.0.0.1', publicKey), true);
		assert.equal(calls, 1);
	}
});

test('Dummy metadata is rejected in production and with non-test secrets', async () => {
	for (const [secret, nodeEnv] of [
		['1x0000000000000000000000000000000AA', 'production'],
		['1x0000000000000000000000000000000AA', ''],
		['real-secret', 'development'],
	]) {
		const verify = loadVerifier(async () => ({ data: { success: true, hostname: 'localhost', action: 'test', cdata: 'test-data' } }), secret, nodeEnv);
		assert.equal(await verify('XXXX.DUMMY.TOKEN.XXXX', '127.0.0.1', '127.0.0.1', publicKey), false);
	}
});

test('Development test keys still require successful Siteverify validation', async () => {
	const verify = loadVerifier(async () => ({ data: { success: false, 'error-codes': ['invalid-input-response'] } }), '1x0000000000000000000000000000000AA', 'development');
	assert.equal(await verify('invalid-token', '127.0.0.1', '127.0.0.1', publicKey), false);
});

test('Turnstile validates the hostname, action and node binding', async () => {
	const valid = { success: true, hostname, action: 'node-deletion', cdata: publicKey };
	for (const override of [{ success: false }, { hostname: 'other.example' }, { action: 'contact' }, { cdata: 'b'.repeat(64) }]) {
		const verify = loadVerifier(async () => ({ data: { ...valid, ...override } }));
		assert.equal(await verify('token', '127.0.0.1', hostname, publicKey), false);
	}
	const verify = loadVerifier(async (url, body, config) => {
		assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
		assert.equal(body.get('secret'), 'test-secret');
		assert.equal(body.get('response'), 'token');
		assert.equal(body.get('remoteip'), '127.0.0.1');
		assert.equal(config.timeout, 8000);
		return { data: valid };
	});
	assert.equal(await verify('token', '127.0.0.1', hostname, publicKey), true);
});

test('Turnstile fails closed on network errors', async () => {
	const verify = loadVerifier(async () => { throw new Error('timeout'); });
	assert.equal(await verify('token', '127.0.0.1', hostname, publicKey), false);
});

const loadRouter = (verify, env = { TURNSTILE_SITEKEY: 'sitekey', TURNSTILE_SECRET: 'secret' }) => loadModule('routes/NodeDeletion.js', {
	'../middlewares/ratelimit.js': {
		nodeDeletionAttempts: (req, res, next) => next(),
		nodeDeletion: (req, res, next) => next(),
	},
	'../services/turnstile.js': verify,
}, env);

const loadHandler = (verify, env) => {
	const router = loadRouter(verify, env);
	const route = router.stack.find(layer => layer.route?.path === '/node-deletion').route;
	assert.equal(route.methods.post, true);
	return route.stack.at(-1).handle;
};

const invoke = async (handler, body, request = {}) => {
	const res = {
		statusCode: 200,
		set() { return this; },
		status(code) { this.statusCode = code; return this; },
		json(data) { this.body = data; return this; },
	};
	await handler({ body, ip: '127.0.0.1', hostname, site: require('../config/sites.js').poland, t: key => key, ...request }, res);
	assert.equal(res.body.status, res.statusCode);
	assert.equal(typeof res.body.success, 'boolean');
	assert.equal(typeof res.body.message, 'string');
	assert.equal(res.body.error, undefined);
	return res;
};

test('Deletion requests require explicit ownership confirmation and a full public key', async () => {
	const handler = loadHandler(() => assert.fail('Verification should not run'));
	for (const body of [undefined, {}, { publicKey }, { publicKey, ownerConfirmed: 'true' }, { publicKey: '123', ownerConfirmed: true }, { publicKey: {}, ownerConfirmed: true }]) {
		const res = await invoke(handler, body);
		assert.equal(res.statusCode, 400);
		assert.equal(res.body.success, false);
		assert.equal(res.body.message, 'map:deletion.errors.invalidRequest');
		assert.equal(res.body.data, undefined);
	}
});

test('Deletion requests fail closed when Turnstile is not configured', async () => {
	const handler = loadHandler(() => assert.fail('Verification should not run'), {});
	const res = await invoke(handler, { publicKey, ownerConfirmed: true, token: 'token' });
	assert.equal(res.statusCode, 503);
	assert.equal(res.body.success, false);
	assert.equal(res.body.message, 'map:deletion.errors.unavailable');
	assert.equal(res.body.data, undefined);
});

test('Deletion requests do not expose the email link after a failed challenge', async () => {
	const res = await invoke(loadHandler(async () => false), { publicKey, ownerConfirmed: true, token: 'token' });
	assert.equal(res.statusCode, 400);
	assert.equal(res.body.success, false);
	assert.equal(res.body.message, 'map:deletion.errors.captcha');
	assert.equal(res.body.data, undefined);
});

test('Successful verification produces an email for the selected node', async () => {
	const handler = loadHandler(async (...args) => {
		assert.deepEqual(args, ['token', '127.0.0.1', hostname, publicKey]);
		return true;
	});
	const res = await invoke(handler, { publicKey, ownerConfirmed: true, token: 'token' });
	assert.equal(res.statusCode, 200);
	assert.equal(res.body.success, true);
	assert.equal(res.body.message, 'OK');
	const mail = new URL(res.body.data.mailto);
	assert.equal(mail.pathname, 'recrof@gmail.com');
	assert.equal(mail.searchParams.get('subject'), 'MeshCore Map node deletion request');
	assert.ok(mail.searchParams.get('body').includes(`MeshCore link(s) or public key(s):\n${publicKey}\n\n`));
	assert.ok(mail.searchParams.get('body').includes('map:deletion.mail.ownershipConfirmation'));
});

test('Deletion email instructions follow the page language with a request-language fallback', async () => {
	const i18next = require('i18next').createInstance();
	await i18next.init({
		resources: {
			pl: { map: require('../locales/pl/map.json') },
			en: { map: require('../locales/en/map.json') },
		},
		fallbackLng: 'en',
	});
	for (const requestLanguage of ['pl', 'en']) {
		for (const language of ['pl', 'en', undefined, 'unsupported']) {
			const expected = ['pl', 'en'].includes(language) ? language : requestLanguage;
			const res = await invoke(loadHandler(async () => true), { publicKey, ownerConfirmed: true, token: 'token', language }, {
				language: requestLanguage,
				t: i18next.t.bind(i18next),
			});
			const mail = new URL(res.body.data.mailto);
			assert.equal(mail.searchParams.get('subject'), 'MeshCore Map node deletion request');
			const body = mail.searchParams.get('body');
			const englishConfirmation = 'I confirm that I own all nodes listed above and request their removal from the MeshCore Map database. I have checked the public keys or MeshCore links and confirm that this request covers only the nodes I intend to remove.';
			const confirmation = expected === 'pl'
				? `${englishConfirmation}\n\nPotwierdzam, że jestem właścicielem wszystkich węzłów wymienionych powyżej i proszę o ich usunięcie z bazy MeshCore Map. Sprawdziłem podane klucze publiczne lub linki MeshCore i potwierdzam, że zgłoszenie obejmuje wyłącznie węzły, które chcę usunąć.`
				: englishConfirmation;
			assert.ok(body.startsWith(`Please delete my node(s) from MeshCore Map database.\n\nMeshCore link(s) or public key(s):\n${publicKey}\n\n${confirmation.replace(/\n+/g, '\n').toUpperCase()}\n\n`));
			assert.ok(body.includes(i18next.t('map:deletion.mail.instructions', { lng: expected })));
			assert.ok(body.includes(expected === 'pl' ? 'INSTRUKCJE PRZED WYSŁANIEM' : 'INSTRUCTIONS BEFORE SENDING'));
		}
	}
});

test('Deletion emails identify the configured source site independently of language', async () => {
	const sites = require('../config/sites.js');
	for (const site of [sites.poland, sites.global]) {
		for (const language of ['pl', 'en']) {
			const res = await invoke(loadHandler(async () => true), { publicKey, ownerConfirmed: true, token: 'token', language }, { site });
			const body = new URL(res.body.data.mailto).searchParams.get('body');
			assert.ok(body.endsWith(`\n\n// This request was prepared via https://${site.domain}.`));
		}
	}
});

test('Rate limiting returns the API response format', async () => {
	const limits = loadModule('middlewares/ratelimit.js', {
		'express-rate-limit': options => options,
		'rate-limit-redis': { RedisStore: class {} },
		'../global/services/redis.js': {},
	});
	const res = await invoke(limits.nodeDeletion.handler);
	assert.equal(res.statusCode, 429);
	assert.equal(res.body.success, false);
	assert.equal(res.body.message, 'map:deletion.errors.rateLimited');
});

test('Parsing and unexpected errors return the API response format', async () => {
	const router = loadRouter(() => assert.fail('Verification should not run'));
	const handler = router.stack.find(layer => layer.handle.length === 4).handle;
	for (const status of [400, 413, 500]) {
		const res = await invoke((req, response) => handler({ status }, req, response, () => assert.fail('Error should be handled')));
		assert.equal(res.statusCode, status);
		assert.equal(res.body.success, false);
		assert.equal(res.body.message, status === 500 ? 'error:internalServerError' : 'map:deletion.errors.invalidRequest');
	}
});

test('Failed requests preserve the daily quota while repeated attempts are limited', async context => {
	const { EventEmitter } = require('node:events');
	const { MemoryStore } = require('express-rate-limit');
	const stores = [];
	const limits = loadModule('middlewares/ratelimit.js', {
		'rate-limit-redis': { RedisStore: class {
			constructor() {
				const store = new MemoryStore();
				stores.push(store);
				return store;
			}
		} },
		'../global/services/redis.js': {},
	});
	context.after(() => stores.forEach(store => store.shutdown()));
	const attempt = async (ip, status) => {
		const req = {
			ip,
			headers: {},
			app: { get: () => false },
			originalUrl: '/api/v1/node-deletion',
			t: key => key,
		};
		const res = Object.assign(new EventEmitter(), {
			statusCode: 200,
			headers: {},
			setHeader(name, value) { this.headers[name] = value; },
			getHeader(name) { return this.headers[name]; },
			status(code) { this.statusCode = code; return this; },
			json() {
				this.writableEnded = true;
				this.emit('finish');
				return this;
			},
		});
		let allowed = false;
		await limits.nodeDeletionAttempts(req, res, err => {
			assert.ifError(err);
			allowed = true;
		});
		if (allowed) {
			await limits.nodeDeletion(req, res, err => {
				assert.ifError(err);
				res.status(status).json();
			});
		}
		await new Promise(resolve => setImmediate(resolve));
		return res;
	};
	for (const status of [400, 413, 500, 503]) {
		assert.equal((await attempt('192.0.2.1', status)).statusCode, status);
	}
	for (let i = 0; i < 3; i++) assert.equal((await attempt('192.0.2.1', 200)).statusCode, 200);
	const dailyBlocked = await attempt('192.0.2.1', 200);
	assert.equal(dailyBlocked.statusCode, 429);
	assert.ok(dailyBlocked.headers['Retry-After'] > 0);
	for (let i = 0; i < 10; i++) assert.equal((await attempt('192.0.2.2', 400)).statusCode, 400);
	assert.equal((await attempt('192.0.2.2', 200)).statusCode, 429);
});

test('Language-prefixed API paths localize errors before the request body is parsed', async () => {
	const { detectLanguagePrefix } = require('../global/utils/languageResolver.js');
	const { i18next } = require('../global/services/i18n.js');
	const detected = detectLanguagePrefix('/pl/api/v1/node-deletion', 'en');
	assert.equal(detected.url, '/api/v1/node-deletion');
	const request = { language: detected.language, t: i18next.getFixedT(detected.language) };
	const invalid = await invoke(loadHandler(async () => false), {}, request);
	assert.equal(invalid.body.message, require('../locales/pl/map.json').deletion.errors.invalidRequest);
	const unavailable = await invoke(loadHandler(async () => false, {}), undefined, request);
	assert.equal(unavailable.body.message, require('../locales/pl/map.json').deletion.errors.unavailable);
	const router = loadRouter(async () => false);
	const handler = router.stack.find(layer => layer.handle.length === 4).handle;
	const malformed = await invoke((req, res) => handler({ status: 400 }, req, res, () => assert.fail('Error should be handled')), undefined, request);
	assert.equal(malformed.body.message, require('../locales/pl/map.json').deletion.errors.invalidRequest);
});

test('Both site templates render in both languages without exposing the Turnstile secret', async context => {
	const ejs = require('ejs');
	const i18next = require('i18next').createInstance();
	const sites = require('../config/sites.js');
	const { LANGUAGES, langPath } = require('../global/utils/languageResolver.js');
	const previousSitekey = process.env.TURNSTILE_SITEKEY;
	const previousSecret = process.env.TURNSTILE_SECRET;
	context.after(() => {
		if (previousSitekey === undefined) delete process.env.TURNSTILE_SITEKEY;
		else process.env.TURNSTILE_SITEKEY = previousSitekey;
		if (previousSecret === undefined) delete process.env.TURNSTILE_SECRET;
		else process.env.TURNSTILE_SECRET = previousSecret;
	});
	process.env.TURNSTILE_SITEKEY = 'public-sitekey';
	process.env.TURNSTILE_SECRET = 'secret-must-never-appear-in-html';
	const resources = {};
	for (const code of ['pl', 'en']) {
		resources[code] = {};
		for (const name of readdirSync(resolve(__dirname, '..', 'locales', code))) {
			if (name.endsWith('.json')) resources[code][name.slice(0, -5)] = JSON.parse(readFileSync(resolve(__dirname, '..', 'locales', code, name), 'utf8'));
		}
	}
	await i18next.init({ resources, fallbackLng: 'en', interpolation: { escapeValue: false } });
	for (const site of [sites.poland, sites.global]) {
		for (const code of ['pl', 'en']) {
			const html = await ejs.renderFile(resolve(__dirname, '..', 'views/index.ejs'), {
				site,
				languages: LANGUAGES,
				languageCode: code,
				defaultLanguage: site.defaultLanguage,
				langPath: (lang, path) => langPath(lang, path, site.defaultLanguage),
				lp: path => langPath(code, path, site.defaultLanguage),
				t: i18next.getFixedT(code),
				i18nBundle: resources[code],
				domain: `https://${site.domain}`,
				cspNonce: 'test-nonce',
				v: 'test',
			});
			assert.ok(html.includes('id="node-deletion-overlay" hidden'));
			assert.ok(html.includes(resources[code].map.deletion.yes));
			assert.ok(html.includes('turnstileSitekey: "public-sitekey"'));
			assert.ok(html.includes(`nodeDeletionUrl: "${langPath(code, '/api/v1/node-deletion', site.defaultLanguage)}"`));
			assert.ok(!html.includes(process.env.TURNSTILE_SECRET));
			const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
			assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs');
		}
	}
	assert.deepEqual(Object.keys(resources.pl.map.deletion.errors), Object.keys(resources.en.map.deletion.errors));
});

const loadScriptLoader = () => {
	const scripts = [];
	const timers = new Set();
	const window = {};
	const module = { exports: {} };
	const filename = resolve(__dirname, '..', 'public/js/node-deletion.js');
	const source = readFileSync(filename, 'utf8').split('export const initNodeDeletionDialog')[0].replace(/^import .*;\r?\n/gm, '');
	vm.runInNewContext(`${source}\nmodule.exports = loadTurnstile;`, {
		module,
		window,
		document: {
			createElement: () => ({ remove() { this.removed = true; } }),
			head: { append: script => scripts.push(script) },
		},
		setTimeout: callback => { timers.add(callback); return callback; },
		clearTimeout: callback => timers.delete(callback),
	}, { filename });
	return { load: module.exports, scripts, timers, window };
};

test('The async script loader waits for load and never calls turnstile.ready', async () => {
	const { load, scripts, timers, window } = loadScriptLoader();
	const pending = load();
	window.turnstile = { render: mock.fn(), ready() { assert.fail('ready is incompatible with async loading'); } };
	assert.equal(load(), pending);
	assert.equal(scripts.length, 1);
	assert.equal(scripts[0].async, true);
	let settled = false;
	pending.then(() => { settled = true; });
	await Promise.resolve();
	assert.equal(settled, false);
	scripts[0].onload();
	await pending;
	assert.equal(settled, true);
	assert.equal(timers.size, 0);
	await load();
	assert.equal(scripts.length, 1);
});

test('A failed async script load can be retried', async () => {
	const { load, scripts, timers, window } = loadScriptLoader();
	const pending = load();
	scripts[0].onerror();
	await assert.rejects(pending, /Turnstile failed to load/);
	assert.equal(scripts[0].removed, true);
	assert.equal(timers.size, 0);
	const retry = load();
	assert.equal(scripts.length, 2);
	window.turnstile = { render: mock.fn() };
	scripts[1].onload();
	await retry;
	assert.equal(timers.size, 0);
});

test('An async script load times out and removes the failed script', async () => {
	const { load, scripts, timers } = loadScriptLoader();
	const pending = load();
	[...timers][0]();
	await assert.rejects(pending, /Turnstile failed to load/);
	assert.equal(scripts[0].removed, true);
	assert.equal(timers.size, 0);
});
