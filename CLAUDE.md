# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Interactive map of MeshCore network nodes. Node.js/Express backend + plain-JS frontend (no framework, no bundler) built on Leaflet and (optionally) MapLibre GL. Sources node data from the upstream `map.meshcore.io`.

A single codebase serves **two public sites**, chosen by request host (see `config/sites.js` and the "Multi-site & i18n" section below):
- `mapa.meshcorepolska.org` - Polish version, default region `pl`.
- `map.meshcoreprofiles.com` - global version, default region `all`, default language English.

UI text and code comments in the **frontend** (`public/`) are in Polish. Code comments in the **backend** (`index.js`, `services/`, `routes/`, `middlewares/`, `utils/`, `database/`, `config/`) are in English.

## Commands

- This repo has a git submodule (`global`, see below) - clone with `git clone --recurse-submodules`, or run `git submodule update --init` after a plain clone.
- Run the server: `node .` (entry point is `index.js`, the package is CommonJS)
- Lint: `npx eslint .` (flat config in `eslint.config.mjs`; ignores `public/vendor/**`)
- There are no tests in this repo.
- `npm run m` - updates dependencies via `ncu -u && npm install && npm update` (maintenance only, not for regular development)
- Production runs under PM2 as the `mcmap` process (see `ecosystem.config.js`); `npm run update` pulls, does a production install, and restarts via `pm2 restart mcmap`.
- `global/database/syncIndexes.js` - standalone script run manually (`node global/database/syncIndexes.js`), syncs Mongoose indexes for every model in `global/database/models/` (see "Shared `global` submodule" below) against the actual state in MongoDB.
- Requires running **MongoDB** and **Redis** instances, plus a `.env` file (copy of `.env.example`): `NODE_ENV`, `DOMAIN`, `PORT`, `SEFINEK_API` (base URL of the elevation API, exposed to the frontend), `SITE_MODE` (`auto`/`poland`/`global` - forces a site regardless of host), `MONGODB_URL`, `REDIS_HOST`, `REDIS_PASSWD`, optionally `MAPTILER_API_KEY` and `CARTO_API_KEY` (unlock extra basemaps).

## Architecture

### Backend (Express, CommonJS)

- `index.js` - entry point. Loads `.env` (`process.loadEnvFile()`) and imports `global/database/mongoose.js` (side effect, before the server starts listening). Middleware order: helmet → `express.static('public')` → site resolver (`req.site` from `config/sites.js` based on `req.hostname`) → language-prefix detection in the URL → i18next (`middlewares/language.js`) → language negotiation/redirects (`middlewares/languageNegotiation.js`) → morgan → rate limiter (production only) → timeout. `app.locals` exposes only `domain` and `v` (version from `package.json`) to EJS views - `sefinekApi`/`cartoApiKey`/`maptilerApiKey` are read directly from `process.env` in `views/index.ejs`.
- `config/sites.js` - definitions for the two sites (`poland`, `global`): default region/language, default map view, CSS theme (`public/css/themes/<theme>.css`), branding, `maptilerHybridMapId` (per-site). `HOSTS` maps domain → config; `resolveSite()` in `index.js` picks a site via `SITE_MODE` or by host.
- `routes/Index.js` - renders `views/index.ejs` (the map) and `views/test.ejs` (an icon/toast preview panel, `noindex`, never linked from the UI), and also generates `/robots.txt`, `/sitemap.xml` (one URL per language from `LANGUAGES`) and `/manifest.json` - all dependent on `req.site`.
- `routes/Api.js` - `GET /api/v1/nodes` (binary msgpack node payload, `?region=pl|all`, defaults to `pl`), `GET /api/v1/repeater-stats` (JSON stats, `?region=pl|all` defaults to `pl`, CORS `*`, used by external sites like meshcorepolska.org), and `GET /api/v1/stats/history` (historical daily snapshots from MongoDB, `?region=`, `?days=` capped at 365, CORS `*`).
- This app has no `services/nodes.js` of its own anymore - the whole node-data-reading layer is `global/services/nodeCache.js` (see "Shared `global` submodule" below), shared verbatim with `meshcorepolska.org`. `routes/Api.js` imports `getCachedNodes`, `getLastRefreshedAt`, `getStats`, `formatWarsawDate` straight from there.
- `global/IndexNow.js` - a standalone script, **not** wired into the running server. Run manually, it submits URLs from the sitemap to the IndexNow API in batches; requires a verification file at `public/<random-name>.txt` matching the `FILENAME` constant in this script. Uses `global/services/axios.js`.
- `utils/httpError.js` - a uniform `HttpError(res, status, err)` helper (logs `err` and ends the response with just the status, no body), used both in routes and in the global error/404 handler in `index.js`.
- `middlewares/` - `ratelimit.js` (express-rate-limit, wired only in production), `timeout.js` (express-timeout-handler, 15s).

### Shared `global` submodule

`global/` is a git submodule ([meshcore-profiles/global](https://github.com/meshcore-profiles/global)) shared **verbatim** across every MeshCore backend repo, not just this one. On this machine, the same submodule (independently `git pull`-ed, so possibly at different commits until someone syncs them) is checked out at `global/` inside each of these sibling repos:
- `D:\Projects\meshcore-profiles\map.meshcoreprofiles.com\global` (this repo)
- `D:\Projects\meshcore-profiles\cronjobs\global`
- `D:\Projects\meshcore-profiles\meshcoreprofiles.com\global`
- `D:\Projects\meshcore-profiles\flasher.meshcoreprofiles.com\global`
- `D:\Projects\meshcore\meshcorepolska.org\global`

Files this repo actually requires from `global/`:
- `global/services/redis.js` - shared Redis client (database 8), connected once on import.
- `global/services/axios.js` - shared axios instance with a custom `User-Agent` derived from **this repo's own** `package.json` (resolved via a fixed `../../package.json` from the submodule's location, not the submodule's own) and a 14s timeout; used by `global/IndexNow.js`.
- `global/services/nodeCache.js` - reads the MeshCore node buffers cached in Redis (`nodes:all`/`nodes:pl`/`nodes:updatedAt`, written by `meshcore-profiles/cronjobs`) and exposes `getCachedNodes`, `getLastRefreshedAt`, `getStats` (memoized per region) and `formatWarsawDate` - shared verbatim with `meshcorepolska.org`; this is what `routes/Api.js` imports.
- `global/services/i18n.js` - initializes i18next, loads every `locales/<lang>/*.json` namespace, and detects the request language via a custom detector (`req.forcedLanguage` → `lang` cookie → `req.site.defaultLanguage`).
- `global/utils/languageResolver.js` - the supported languages (`en`, `pl`), `prefixFor`/`langPath`/`detectLanguagePrefix` (each takes a per-site `defaultLanguage` argument, defaulting to the module's own `DEFAULT_LANGUAGE` only when the caller omits it), `negotiatePreferred(cookie, acceptLanguageHeader)` (cookie wins if valid, else the highest-`q` supported language from `Accept-Language`; used by `middlewares/languageNegotiation.js`), and `getLangCookie`.
- `global/utils/nodeStats.js` - `REDIS_KEYS` plus pure node-stats computation (`getNodeStatus`, `computeStats`; node status `recent`/`stale`/`old`/`extinct` derived from the age of `updated_date` against thresholds of 5/10/20 days, only applying to nodes whose `source` starts with `'u'`) - shared verbatim with `cronjobs` and `meshcorepolska.org`.
- `global/middlewares/morgan.js` - shared request logger, wired in `index.js` as `logger` (the uptime-monitoring-bot skip by User-Agent is currently commented out/disabled) - shared verbatim with `meshcorepolska.org`.
- `global/database/mongoose.js` - a single Mongoose connection, connected on import; a connection failure is only logged, it doesn't crash the process.
- `global/database/models/statsDaily.model.js` - the `StatsDaily` model (unique index on `{ region, date }`) for historical stats. Tracked **inside the shared submodule itself** (`git ls-files` inside `global/` shows it), identical across every consuming repo. This app only reads it (`routes/Api.js`'s `/api/v1/stats/history`); the daily snapshot rows are written by `meshcore-profiles/cronjobs` directly (`jobs/nodes-stats-snapshot.js`).
- `global/database/syncIndexes.js` - see Commands above.

### Multi-site & i18n

- `global/utils/languageResolver.js` (see "Shared `global` submodule" above) - builds language-prefixed paths (`langPath`, `detectLanguagePrefix`), each parameterized by the current site's `defaultLanguage` so the two sites don't share a single "default" language. A given site's default language (`config/sites.js`) never gets a URL prefix (e.g. for `poland`, `pl` paths have no prefix while `en` lives under `/en`).
- `global/services/i18n.js` - initializes i18next, loading every JSON namespace from `locales/<lang>/*.json` (namespaces are discovered dynamically from the file list in `locales/pl/`) for each supported language; a custom language detector prioritizes `req.forcedLanguage` → the `lang` cookie → the site's default language.
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
