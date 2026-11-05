# CLAUDE.md

Interactive map of MeshCore network nodes. Node.js/Express backend (CommonJS) + plain-JS frontend (ES modules, no framework, no bundler) on Leaflet and optionally MapLibre GL. Node data comes from upstream `map.meshcore.io`, cached in Redis by `meshcore-profiles/cronjobs`.

One codebase serves **two public sites**, chosen by request host (`config/sites.js`):
- `mapa.meshcorepolska.org` - Polish, default region `pl`.
- `map.meshcoreprofiles.com` - global, default region `all`, default language English.

Comment language: **backend** (`index.js`, `services/`, `routes/`, `middlewares/`, `utils/`, `database/`, `config/`) in English, **frontend** (`public/`) in Polish. UI text is i18n-ed (see below).

## Commands

- Clone with `--recurse-submodules` (or `git submodule update --init`); `global/` is a submodule.
- Run: `node .`. Lint: `npx eslint .` (flat config, ignores `public/vendor/**`).
- Prod: PM2 process `mcmap` (`ecosystem.config.js`); `npm run update` pulls, installs and restarts. `npm run m` is dependency maintenance only.
- `node global/database/syncIndexes.js` - manual script, syncs Mongoose indexes of all models in `global/database/models/`.
- Needs MongoDB, Redis and a `.env` (copy `.env.example`; every variable is documented there). Notable: `SITE_MODE` (`auto`/`poland`/`global`) forces a site regardless of host; the keys `ESRI_API_KEY`, `MAPTILER_API_KEY`, `CARTO_API_KEY` unlock basemaps; `TURNSTILE_*` enables node deletion (feature is off without them).

## Backend

- `index.js` middleware order matters: helmet, CORS, `express.static('public')`, site resolver (`req.site`), language-prefix detection, language negotiation/redirects, i18next, morgan, rate limiter (production only), timeout. `.env` is loaded with `process.loadEnvFile()`; `global/database/mongoose.js` is imported for its side effect before listening.
- `config/sites.js` defines both sites (default region/language/view, theme, branding, `maptilerHybridMapId`). `config/features.js` holds on/off switches for the terrain and coverage tools, passed to the frontend as `MAP_CONFIG.features`.
- `routes/Api.js`: `GET /api/v1/nodes` (binary msgpack, `?region=pl|all`, default `pl`), `/repeater-stats` (JSON, CORS `*`, used by meshcorepolska.org), `/radio-presets` (Redis `radioPresets:data`, filled by `cronjobs/jobs/radio-presets.js`; 503 if missing; the frontend never calls the upstream API directly), `/stats/history` (MongoDB daily snapshots, `?days=` capped at 365, `days=all` max 5000 rows).
- `routes/NodeDeletion.js`: `POST /api/v1/node-deletion` needs `ownerConfirmed`, a 64-hex `publicKey` and a Turnstile token (verified in `services/turnstile.js`: hostname, action `node-deletion`, `cdata` = public key; 503 without keys). Returns a `mailto:` link (`utils/nodeDeletionMail.js`, recipient `DELETION_EMAIL` in `config/sites.js`, also re-checked in `public/js/node-deletion.js`). Limiters `nodeDeletionAttempts` (10/10 min) and `nodeDeletion` (3 successful/day) in `middlewares/ratelimit.js`; responses are `no-store`.
- `routes/Index.js` renders the map and generates `robots.txt`, `sitemap.xml` (one URL per language) and `manifest.webmanifest` from `req.site`. `/test` (icon/toast preview) exists only outside production.
- `utils/httpError.js`: `HttpError(res, status, err)` logs and ends with just the status, no body; used by routes and the global error/404 handler.
- Node reading layer is `global/services/nodeCache.js` (no local `services/nodes.js`).

## Shared `global` submodule

`global/` ([meshcore-profiles/global](https://github.com/meshcore-profiles/global)) is shared **verbatim** by every MeshCore backend repo (`cronjobs`, `meshcoreprofiles.com`, `flasher.meshcoreprofiles.com`, `meshcorepolska.org`, this one), possibly at different commits. A change there affects all of them, so treat it as a shared library. Read the code before assuming behavior. What this repo uses:
- `services/redis.js` (Redis db 8), `services/axios.js` (User-Agent from **this repo's** `package.json`), `services/nodeCache.js` (nodes cached in Redis by `cronjobs`; `getCachedNodes`, `getLastRefreshedAt`, `getStats`, `formatWarsawDate`).
- `services/i18n.js` and `utils/languageResolver.js` (languages `en`, `pl`; language-prefixed paths per site default; negotiation from cookie and `Accept-Language`).
- `utils/nodeStats.js` (`REDIS_KEYS`, node status `recent`/`stale`/`old`/`extinct` from `updated_date` age, thresholds 5/10/20 days, only for nodes with `source` starting with `u`), `middlewares/morgan.js`.
- `database/mongoose.js` (connection failure is only logged), `database/models/statsDaily.model.js` (written by `cronjobs`, read here).
- `IndexNow.js` is a manual script, not wired into the server; needs a `public/<random-name>.txt` verification file matching its `FILENAME` constant.

## Multi-site and i18n

- A site's default language never gets a URL prefix (for `poland`, `pl` has none and `en` lives under `/en`; for `global` the reverse).
- Translations live in `locales/{pl,en}/*.json`, one namespace per file; both languages must keep identical file lists and keys. `middlewares/language.js` exposes `t`, `langPath`/`lp` and `i18nBundle` to views; the bundle reaches the frontend via `window.MAP_CONFIG.i18n`.
- `middlewares/languageNegotiation.js` handles `?setlang=` and redirects to the prefixed URL; skipped for `/api/**`, `robots.txt`, `sitemap.xml`, `manifest.webmanifest`. It must run before `language.js`.
- CSS: `public/css/global.css`, `components/`, `map/`, per-site `themes/`. Load order matters and lives in `views/partials/stylesheets.ejs`; register new files there.

## Frontend

- Entry: `public/js/map.js` (`<script type="module">` in `views/index.ejs`), loaded after the global `leaflet.js` and `leaflet.markercluster.js`. `leaflet-esm.js` re-exports the global `L`. MapLibre GL is lazy-loaded from `public/vendor/maplibre/` only when a vector basemap is used.
- `views/index.ejs` injects `window.MAP_CONFIG` (region, view, API URLs, map keys, language, i18n bundle) before any module runs.
- `/api/v1/nodes` is streamed msgpack (vendored `msgpackr`); the UI shows download progress in bytes (`region=all` is large).
- Modules in `public/js/` expose `init*` factories that bind DOM elements by ID (must match `views/index.ejs`) and return a small controller. Shared primitives: `pathtools.js` (measure, route), `elevation.js` (terrain, coverage), `modal.js`, `toast.js`, `i18n.js` (`t`/`tRaw`/`plural`).
- Tools that pick a point on the map share one picker slot (`setPicker` in `map.js`); only one tool can listen at a time.
- State (`state` in `map.js`) drives filtering, is persisted in `localStorage`, and the view, selected node and tool state are mirrored into the URL query via `history.replaceState` (`?node=<public_key>`, `lat`/`lon`/`zoom`).
- Basemaps: raster ones in `tileBaseMaps`, vector ones (OpenFreeMap, Esri, MapTiler) in `maplibreBaseMapOptions`. Esri Hybrid needs `ESRI_API_KEY`, MapTiler needs `MAPTILER_API_KEY`, CartoDB needs `CARTO_API_KEY`. Default is Esri Hybrid, then MapTiler Hybrid, then OpenStreetMap (`defaultBaseMapName`). On load failure `basemapFallbackChain` applies; a toast informs when a saved choice is no longer available.
- Gotchas: marker clustering is rebuilt from scratch when the clustering zoom threshold changes (that option is immutable). Desktop node popups use a custom `nodePopupPane` outside `mapPane` (z-index 1001, above `#stats-bar` 1000 and below `#fab-stack` 1002) synced via `syncPopupPane`; popups have `autoPan: false` and `panPopupIntoView` handles panning; `.node-qr` has a fixed size to keep popup height stable.
- `terrain.js` and `coverage.js` fetch elevations from a swappable provider (`sefinek` via `SEFINEK_API`, `open-elevation`, `open-meteo`).

## Vendored dependencies

`public/vendor/README.md` lists the exact version and source of every vendored library and the procedure for swapping source maps. Never hand-edit `public/vendor/**`; replace files wholesale following that procedure.

## Style (enforced by `eslint.config.mjs`)

Tabs, single quotes, semicolons, `eqeqeq` (except against `null`), no `var`, prefer `const`, enforced arrow-parens and arrow-body-style, `no-use-before-define` for variables (functions exempt). `public/**/*.js` additionally gets `no-redeclare`, browser globals and ES module source type.
