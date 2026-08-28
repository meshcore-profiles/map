# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Interactive map of MeshCore network nodes. Node.js/Express backend + plain-JS frontend (no framework, no bundler) built on Leaflet and (optionally) MapLibre GL. Sources node data from the upstream `map.meshcore.io`.

A single codebase serves **two public sites**, chosen by request host (see `config/sites.js` and the "Multi-site & i18n" section below):
- `mapa.meshcorepolska.org` - Polish version, default region `pl`.
- `map.meshcoreprofiles.com` - global version, default region `all`, default language English.

UI text and code comments in the **frontend** (`public/`) are in Polish. Code comments in the **backend** (`index.js`, `services/`, `routes/`, `middlewares/`, `utils/`, `database/`, `config/`) are in English.

## Commands

- Run the server: `node .` (entry point is `index.js`, the package is CommonJS)
- Lint: `npx eslint .` (flat config in `eslint.config.mjs`; ignores `public/vendor/**`)
- There are no tests in this repo.
- `npm run m` - updates dependencies via `ncu -u && npm install && npm update` (maintenance only, not for regular development)
- Production runs under PM2 as the `mcmap` process (see `ecosystem.config.js`); `npm run update` pulls, does a production install, and restarts via `pm2 restart mcmap`.
- `database/syncIndexes.js` - standalone script run manually (`node database/syncIndexes.js`), syncs Mongoose indexes from every model in `database/models/` against the actual state in MongoDB.
- Requires running **MongoDB** and **Redis** instances, plus a `.env` file (copy of `.env.example`): `NODE_ENV`, `DOMAIN`, `PORT`, `SEFINEK_API` (base URL of the elevation API, exposed to the frontend), `SITE_MODE` (`auto`/`poland`/`global` - forces a site regardless of host), `MONGODB_URL`, `REDIS_HOST`, `REDIS_PASSWD`, optionally `MAPTILER_API_KEY` and `CARTO_API_KEY` (unlock extra basemaps).

## Architecture

### Backend (Express, CommonJS)

- `index.js` - entry point. Loads `.env` (`process.loadEnvFile()`), immediately starts `startNodesRefreshJob()` (`services/nodes.js`) and imports `database/mongoose.js` and `services/statsHistory.js` (side effects, before the server starts listening). Middleware order: helmet → `express.static('public')` → site resolver (`req.site` from `config/sites.js` based on `req.hostname`) → language-prefix detection in the URL → i18next (`middlewares/language.js`) → language negotiation/redirects (`middlewares/languageNegotiation.js`) → morgan → rate limiter (production only) → timeout. `app.locals` exposes only `domain` and `v` (version from `package.json`) to EJS views - `sefinekApi`/`cartoApiKey`/`maptilerApiKey` are read directly from `process.env` in `views/index.ejs`.
- `config/sites.js` - definitions for the two sites (`poland`, `global`): default region/language, default map view, CSS theme (`public/css/themes/<theme>.css`), branding, `maptilerHybridMapId` (per-site). `HOSTS` maps domain → config; `resolveSite()` in `index.js` picks a site via `SITE_MODE` or by host.
- `routes/Index.js` - renders `views/index.ejs` (the map) and `views/test.ejs` (an icon/toast preview panel, `noindex`, never linked from the UI), and also generates `/robots.txt`, `/sitemap.xml` (one URL per language from `LANGUAGES`) and `/manifest.json` - all dependent on `req.site`.
- `routes/Api.js` - `GET /api/v1/nodes` (binary msgpack node payload, `?region=pl|all`, defaults to `pl`), `GET /api/v1/repeater-stats` (JSON stats, CORS `*`, used by external sites like meshcorepolska.org), and `GET /api/v1/stats/history` (historical daily snapshots from MongoDB, `?region=`, `?days=` capped at 365, CORS `*`).
- `services/nodes.js` - the actual node data layer:
  - Fetches the full node set from upstream (`map.meshcore.io`) as binary msgpack, on a cycle (`REFRESH_INTERVAL_MS` = 10 min, retried after 30s on failure).
  - Computes a Poland-only subset via point-in-polygon against a simplified Poland border (simplified with the Douglas-Peucker algorithm from `services/data/poland-border.geojson` at module startup, through `utils/geo.js`), with an upfront bounding-box filter for speed.
  - Keeps both regions (`all`, `pl`) as packed buffers in an in-process memory cache (the source of truth when serving requests) and also persists them to Redis as a durable cache that survives restarts; a Redis outage doesn't affect serving from memory.
  - `getStats()` computes and memoizes repeater/type/status statistics for a given region's node set; the memoized cache is invalidated on every refresh.
  - Node status (`recent`/`stale`/`old`/`extinct`) is derived from the age of `updated_date` against thresholds (5/10/20 days) and only applies to nodes whose `source` starts with `'u'`.
- `services/statsHistory.js` - a cron job (`0 0 * * *`, `Europe/Warsaw` timezone) that saves a daily `getStats()` snapshot to MongoDB (`StatsDaily`) for both regions; also runs once immediately on process startup.
- `database/mongoose.js` - a single Mongoose connection, connected on import; a connection failure is only logged, it doesn't crash the process.
- `database/models/statsDaily.model.js` - the `StatsDaily` model (unique index on `{ region, date }`) for historical stats.
- `services/redis.js` - a single shared Redis client (database 8), connected once on import.
- `services/axios.js` - a shared axios instance with a custom `User-Agent` derived from `package.json`; used by `services/nodes.js` and `services/IndexNow.js`.
- `services/IndexNow.js` - a standalone script, **not** wired into the running server. Run manually, it submits URLs from the sitemap to the IndexNow API in batches; requires a verification file at `public/<random-name>.txt` matching the `FILENAME` constant in this script.
- `utils/geo.js` - general geometry helpers: ring simplification via the Douglas-Peucker algorithm (`simplifyRing`, splits the ring at its farthest point, since Douglas-Peucker only works on open paths) and a point-in-polygon test via ray-casting (`isPointInPolygon`).
- `utils/httpError.js` - a uniform `HttpError(res, status, err)` helper (logs `err` and ends the response with just the status, no body), used both in routes and in the global error/404 handler in `index.js`.
- `middlewares/` - `ratelimit.js` (express-rate-limit, wired only in production), `timeout.js` (express-timeout-handler, 15s), `morgan.js` (request logging; the uptime-monitoring-bot skip by User-Agent is currently commented out/disabled).

### Multi-site & i18n

- `utils/languageResolver.js` - defines the supported languages (`pl`, `en`), builds language-prefixed paths (`langPath`), detects a prefix from the URL (`detectLanguagePrefix`), and parses the `Accept-Language` header and the `lang` cookie. A given site's default language (`config/sites.js`) never gets a URL prefix (e.g. for `poland`, `pl` paths have no prefix while `en` lives under `/en`).
- `services/i18n.js` - initializes i18next, loading every JSON namespace from `locales/<lang>/*.json` (namespaces are discovered dynamically from the file list in `locales/pl/`) for each supported language; a custom language detector prioritizes `req.forcedLanguage` → the `lang` cookie → the site's default language.
- `middlewares/language.js` - wires up i18next-http-middleware and exposes `t`, `languageCode`, `site`, `langPath`/`lp` (helpers for building links with the right prefix), and `i18nBundle` (the full translation bundle for the current language, injected into the frontend via `window.MAP_CONFIG.i18n`) to EJS views, among other things.
- `middlewares/languageNegotiation.js` - handles `?setlang=` (sets the cookie and redirects), and otherwise, absent a forced language, negotiates a preference from the cookie/header and redirects to the prefixed URL if it differs from the current one. Skipped for "language-agnostic" paths (`/api/**`, `/robots.txt`, `/sitemap.xml`, `/manifest.json`).
- Translation namespaces (`locales/{pl,en}/*.json`): `common`, `map`, `settings`, `legend`, `stats`, `changelog`, `measure`, `route`, `terrain`, `filters`, `meta`, `error`.

### Frontend (plain JS, ES modules, no bundler)

- The entry point is `public/js/map.js`, loaded as `<script type="module">` directly from `views/index.ejs`, after the already-loaded vendored `leaflet.js` and `leaflet.markercluster.js` (loaded globally, not as modules - `map.js` declares `/* global L */`; `leaflet-esm.js` is a one-line shim re-exporting the global `L` as an ES module for other files). MapLibre GL and its Leaflet plugin are lazy-loaded on demand from `public/vendor/maplibre/` - only once the user picks, or defaults to, a vector basemap.
- `views/index.ejs` injects server-side config into the page via `window.MAP_CONFIG` (among others: `defaultRegion`, `defaultView`, `sefinekApi`, `cartoApiKey`, `maptilerApiKey`, `maptilerHybridMapId`, `languageCode`, `i18n`), before any module script runs. The `data-theme` attribute on `<html>` and the loaded `css/themes/<site.theme>.css` stylesheet both depend on the active site.
- Node data arrives from `/api/v1/nodes` as a streamed binary msgpack response (decoded client-side with the vendored `msgpackr`); the frontend shows download progress in bytes, since responses can be large, especially for `region=all`.
- Basemaps in `map.js` split into two categories in the switcher: `tileBaseMaps` (raster, loaded directly by Leaflet: OpenStreetMap, Esri Hybrid, OpenTopoMap, CyclOSM, Humanitarian OSM, plus CartoDB Dark/Positron and MapTiler Outdoor when the relevant keys are configured) and `maplibreBaseMapOptions` (vector, via MapLibre GL: OpenFreeMap always, MapTiler Hybrid when `MAPTILER_API_KEY` is configured). The default basemap is MapTiler Hybrid if the key is set, otherwise the first raster one. If the default basemap fails to load, it falls back to Esri Hybrid, and if that also fails, to OpenStreetMap (neither requires an API key). If a user's previously saved choice is no longer available (missing API key), a toast informs them of it.
- Clicking a node (a popup on desktop / a full-screen modal on mobile) updates the URL to the shareable format (`?node=<public_key>`, the same one the "Share" button produces); once the detail view is closed, the URL reverts to the map-view params (`lat`/`lon`/`zoom`). Both directions go through `history.replaceState`, without adding entries to browser history.
- `public/js/map.js` composes functional modules, each exposing an `init*` factory that wires up its own DOM elements (by ID, matching `views/index.ejs`) and returns a small controller object:
  - `i18n.js` - `t()`/`tRaw()`/`plural()` reading from the bundle injected via `window.MAP_CONFIG.i18n`.
  - `modal.js` - generic open/close/dismiss handling for a modal/panel (Escape key, click outside), used by every panel below.
  - `legend.js`, `stats.js`, `changelog.js` - the legend panel, the node-stats modal (with time-range filtering), and the hardcoded changelog list.
  - `pathtools.js` - shared primitives for drawing sequences of points/segments/distances on the map (used by both the measuring tool and the route tool).
  - `measure.js` - the free-form, multi-point distance-measuring tool, built on `pathtools.js`.
  - `route.js` - draws a route between nodes resolved by name/key from text the user types in, built on `pathtools.js`.
  - `terrain.js` - line-of-sight/elevation-profile analysis between two points; fetches elevation samples from a swappable provider (`sefinek` via `SEFINEK_API`, `open-elevation`, or `open-meteo`) and computes obstructions along the path accounting for Earth's curvature.
  - `toast.js` - toast notifications (including dismissible "action" toasts, e.g. after highlighting search results).
  - `node-utils.js` - node-related formatting helpers (byte/hex conversion, date/time formatting, deterministic color/label hashing from a name for client-type node icons).
- Tools that need a point picked on the map share a single "picker" slot registered via `setPicker` in `map.js`, so only one tool at a time can "listen" for clicks on the map/a node.
- Client-side state (`state` in `map.js`) drives filtering (node type, frequency, date thresholds) and is persisted to `localStorage`; the current map view, the selected node, and optionally the active measure/terrain tool state are also reflected in the URL query string so it can be shared.
- Marker clustering rebuilds `L.markerClusterGroup` from scratch whenever the clustering zoom threshold changes (`refreshMap`), because that option isn't mutable on an existing cluster group.

### Vendored dependencies (`public/vendor/`)

`public/vendor/README.md` documents the exact version and direct source (jsDelivr/esm.sh) of every vendored library (Leaflet, Leaflet.markercluster, MapLibre GL JS, MapLibre GL Leaflet, msgpackr, qrcode), including the procedure for swapping the source map on files jsDelivr generates dynamically (the `+esm` bundle, on-the-fly `.min.*` minification). Never hand-edit files under `public/vendor/**` - they're fully excluded from linting and should be replaced wholesale following that procedure.

## Style conventions (from `eslint.config.mjs`)

Tab indentation, single quotes, required semicolons, `eqeqeq` (except against `null`), no `var`, prefer `const`, enforced arrow-parens/arrow-body-style, `no-use-before-define` for variables (functions are exempt thanks to hoisting). Applies to both the backend and `public/**/*.js` (the latter additionally gets `no-redeclare` plus linting with browser globals and ES module source type).
