# CLAUDE.md

Interactive map of MeshCore network nodes. Node.js/Express backend (CommonJS) + plain-JS frontend (ES modules, no framework, no bundler) on Leaflet and optionally MapLibre GL. Node data comes from upstream `map.meshcore.io`, cached in Redis by `meshcore-profiles/cronjobs`.

One codebase serves **two public sites**, chosen by request host (`config/sites.js`):
- `mapa.meshcorepolska.org` - Polish, default region `pl`.
- `map.meshcoreprofiles.com` - global, default region `all`, default language English.

Comments are in English everywhere (backend, `public/`, `packages/core`, `apps/mobile`); older Polish comments in `apps/web/public` stay until the code around them is touched. UI text is i18n-ed (see below).

`apps/mobile` is an Expo (React Native, plain JS) app on MapLibre Native. It reuses `@meshcore-map/core` and the web API (`/api/v1/nodes?region=pl|all`, `/radio-presets`, `/api/v1/app-config` with the feature switches, the elevation API address and `BUGSNAG_API_KEY`). It needs a dev build (MapLibre is not in Expo Go); `npx expo export --platform android|ios` in `apps/mobile` only verifies that Metro bundles it. Structure: `src/state` (settings, nodes), `src/data` (offline msgpack cache in the document directory, app config), `src/components` (map layers, bottom sheets), `src/tools` (measure, route, terrain, coverage), `src/ui` (primitives), `src/i18n`.
- Error reporting (`src/bugsnag.js`, `@bugsnag/expo`): off without a key, without the user's consent (`settings.errorReporting`) and outside production builds. Only the exception, the app version and a device whitelist (OS, runtimes, manufacturer, model) are sent; sessions, breadcrumbs, user/device id and device metadata are dropped in `onError`. Keep it that way when changing the config.
- Translations: the same repo-root `locales/{pl,en}` feed the app and the server-side i18next (`global/services/i18n.js`). `mobile.json` holds the app-only strings, `appChangelog.json` the app's changelog (the site uses `changelog.json`); the app's version is in `apps/mobile/app.json`.
- The first launch asks for the map scope (`settings.region`: `all` or `pl`, same split as the two sites). It also picks the theme (`pl` red, `all` indigo): accents live in `packages/core/src/themes.js` (a test keeps them equal to `apps/web/public/css/themes/*.css`) and are read with `useTheme()`; shared colors are in `packages/core/src/colors.js`, so do not hardcode hex values in JS.
- Styles go above the components (`no-use-before-define`). `src/ui/iconData.js` is generated: run `npm run icons` in `apps/mobile` after changing `apps/web/public/icons/*.svg`; marker badges (`assets/nodes/*.png`, `src/components/nodeImages.js`) come from `npm run badges` (resvg).
- `npm audit` reports moderate minimatch findings via `@expo/fingerprint` (dev tooling only; `npm ci --omit=dev -w apps/web` on prod does not install it).

## Commands

- Clone with `--recurse-submodules` (or `git submodule update --init`); `global/` (repo root) is a submodule.
- Monorepo (npm workspaces): `apps/web` is the site described below (paths in this file are relative to it, except `global/` and `locales/`, which live in the repo root), `packages/core` is shared plain-ESM logic with no DOM/Leaflet (tests: `npm test`, a single file: `node --test packages/core/test/core.test.js` from the root), served to the browser at `/core/*` (`express.static` in `index.js`) and imported from `public/js` as `/core/<file>.js`; `public/js/{node-utils,pathtools,elevation}.js` re-export from it. The version (`x.y.z+YYYYMMDD`, the date is the release date) lives only in the root `package.json`; `apps/web` and `global/` read it from there. Run: `npm start` (from the root; or `node .` in `apps/web`). Lint: `npm run lint` (flat config in `apps/web`, ignores `public/vendor/**`).
- Prod: PM2 process `mcmap` (`ecosystem.config.js` in the repo root, `cwd` is `apps/web`); root `npm run update` pulls, installs only `apps/web` and restarts. `npm run m` is dependency maintenance only.
- `node global/database/syncIndexes.js` - manual script, syncs Mongoose indexes of all models in `global/database/models/`.
- Needs MongoDB, Redis and a `.env` (copy `.env.example`; every variable is documented there). Notable: `SITE_MODE` (`auto`/`poland`/`global`) forces a site regardless of host; the keys `ESRI_API_KEY`, `MAPTILER_API_KEY`, `CARTO_API_KEY` unlock basemaps; the app gets only its own `MAPTILER_API_KEY_MOBILE` and `CARTO_API_KEY_MOBILE` from `/api/v1/app-config` (no fallback to the site's referrer-restricted keys, no Esri: its terms forbid storing data, the native map caches tiles), which the user's own keys (`settings.apiKeys`) replace; a key restricted to the site's domains is refused on localhost, so development needs a key of its own; `TURNSTILE_*` enables node deletion (feature is off without them).

## Backend

- `index.js` middleware order matters: helmet, CORS, `express.static('public')`, site resolver (`req.site`), language-prefix detection, language negotiation/redirects, i18next, morgan, rate limiter (production only), timeout. `.env` (repo root) is loaded with `process.loadEnvFile()` relative to `index.js`, so the start directory does not matter; `global/database/mongoose.js` is imported for its side effect before listening.
- `config/sites.js` defines both sites: what the mobile app also needs (default view, brand, `mapLanguage`, `maptilerHybridMapId`, GitHub link) comes from `packages/core/src/sites.js` (loaded with `require`, so Node >= 20.19), the rest (language, theme, domain, icons) lives here. Base map catalog, default/fallback order, `formatTimeAgo` and the statistics helpers are also in `packages/core` and used by both the site and the app; do not copy them. `config/features.js` holds on/off switches for the terrain and coverage tools, passed to the frontend as `MAP_CONFIG.features`.
- `routes/Api.js`: `GET /api/v1/nodes` (binary msgpack, `?region=pl|all`, default `pl`), `/repeater-stats` (JSON, CORS `*`, used by meshcorepolska.org), `/radio-presets` (Redis `radioPresets:data`, filled by `cronjobs/jobs/radio-presets.js`; 503 if missing; the frontend never calls the upstream API directly), `/stats/history` (MongoDB daily snapshots, `?days=` capped at 365, `days=all` max 5000 rows).
- `routes/NodeDeletion.js`: `POST /api/v1/node-deletion` needs `ownerConfirmed`, a 64-hex `publicKey` and a Turnstile token (verified in `services/turnstile.js`: hostname, action `node-deletion`, `cdata` = public key; 503 without keys). Returns a `mailto:` link (`utils/nodeDeletionMail.js`, recipient `DELETION_EMAIL` in `config/sites.js`, also re-checked in `public/js/node-deletion.js`). Limiters `nodeDeletionAttempts` (10/10 min) and `nodeDeletion` (3 successful/day) in `middlewares/ratelimit.js`; responses are `no-store`.
- `routes/Index.js` renders the map and generates `robots.txt`, `sitemap.xml` (one URL per language) and `manifest.webmanifest` from `req.site`. `/test` (icon/toast preview) exists only outside production.
- `routes/AppLinks.js`: `/.well-known/assetlinks.json` (Android App Links for both sites), mounted right after `express.static` in `index.js` so it bypasses site and language handling; package name and release key (`extra.androidCertSha256`) come from `apps/mobile/app.json`, `ANDROID_PLAY_CERT_SHA256` adds the Play App Signing key.
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
- Translations live in the repo-root `locales/{pl,en}/*.json`, one namespace per file; both languages must keep identical file lists and keys. `middlewares/language.js` exposes `t`, `langPath`/`lp` and `i18nBundle` to views; the bundle reaches the frontend via `window.MAP_CONFIG.i18n`.
- `middlewares/languageNegotiation.js` handles `?setlang=` and redirects to the prefixed URL; skipped for `/api/**`, `robots.txt`, `sitemap.xml`, `manifest.webmanifest`. It must run before `language.js`.
- CSS: `public/css/global.css`, `components/`, `map/`, per-site `themes/`. Load order matters and lives in `views/partials/stylesheets.ejs`; register new files there.

## Frontend

- Entry: `public/js/map.js` (`<script type="module">` in `views/index.ejs`), loaded after the global `leaflet.js` and `leaflet.markercluster.js`. `leaflet-esm.js` re-exports the global `L`. MapLibre GL is lazy-loaded from `public/vendor/maplibre/` only when a vector basemap is used.
- `views/index.ejs` injects `window.MAP_CONFIG` (region, view, API URLs, map keys, language, i18n bundle) before any module runs.
- `/api/v1/nodes` is streamed msgpack (vendored `msgpackr`); the UI shows download progress in bytes (`region=all` is large).
- Modules in `public/js/` expose `init*` factories that bind DOM elements by ID (must match `views/index.ejs`) and return a small controller. Shared primitives: `pathtools.js` (measure, route), `elevation.js` (terrain, coverage), `modal.js`, `toast.js`, `i18n.js` (`t`/`tRaw`/`plural`).
- Tools that pick a point on the map share one picker slot (`setPicker` in `map.js`); only one tool can listen at a time.
- State (`state` in `map.js`) drives filtering, is persisted in `localStorage`, and the view, selected node and tool state are mirrored into the URL query via `history.replaceState` (`?node=<public_key>`, `lat`/`lon`/`zoom`).
- Basemaps: raster ones in `tileBaseMaps`, vector ones (OpenFreeMap, Esri, MapTiler) in `maplibreBaseMapOptions`. Keys: Esri Hybrid needs `ESRI_API_KEY`, MapTiler `MAPTILER_API_KEY`, CartoDB `CARTO_API_KEY`. The default is the first available map of `PRIORITY_ORDER` in `packages/core/src/basemaps.js`: Esri Hybrid, CartoDB Dark, OpenStreetMap (keyless), OpenFreeMap (keyless, last); a map that fails is replaced by the next one. The app has no Esri (its terms forbid storing data, which the tile cache does). MapTiler stays opt-in (free plan is non-commercial; CARTO's free tier has a monthly cap).
- Basemap choice: stored on its own (`baseMapSelected` in localStorage, `settings.basemap` in the app; null = follow the default, the old literal "Default" is migrated). A failing map only changes what is shown for the session: `resolveBasemap` and `withBasemapFailure` (`packages/core/src/basemaps.js`) give the wanted and the shown map, `public/js/basemap-manager.js` (web) and `screens/useBasemap.js` (app) apply them; on the web a choice is saved only after the map has loaded. The list is grouped by `category` (maps, satellite), with default, unavailable and key-locked maps marked, and a toast tells when a saved choice is no longer available.
- Own keys: a visitor can enter Esri/MapTiler/CARTO keys in the settings panel (`public/js/api-keys.js`, `localStorage.customApiKeys`; `settings.apiKeys` in the app); they replace the server's keys (`mergeApiKeys` in `packages/core/src/basemaps.js`).
- Gotchas: marker clustering is rebuilt from scratch when the clustering zoom threshold changes (that option is immutable). Desktop node popups use a custom `nodePopupPane` outside `mapPane` (z-index 1001, above `#stats-bar` 1000 and below `#fab-stack` 1002) synced via `syncPopupPane`; popups have `autoPan: false` and `panPopupIntoView` handles panning; `.node-qr` has a fixed size to keep popup height stable.
- `terrain.js` and `coverage.js` fetch elevations from a swappable provider (`sefinek` via `SEFINEK_API`, `open-elevation`, `open-meteo`).

## Vendored dependencies

`public/vendor/README.md` lists the exact version and source of every vendored library and the procedure for swapping source maps. Never hand-edit `public/vendor/**`; replace files wholesale following that procedure.

## Style (enforced by `eslint.config.mjs`)

Tabs, single quotes, semicolons, `eqeqeq` (except against `null`), no `var`, prefer `const`, enforced arrow-parens and arrow-body-style, `no-use-before-define` for variables (functions exempt). `public/**/*.js` additionally gets `no-redeclare`, browser globals and ES module source type.
