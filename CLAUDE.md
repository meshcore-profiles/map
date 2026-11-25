# CLAUDE.md

Interactive map of MeshCore network nodes. Node.js/Express backend (ESM) + plain-JS frontend (ES modules, no framework, no bundler) on Leaflet and optionally MapLibre GL. Node data comes from upstream `map.meshcore.io`, cached in Redis by `meshcore-profiles/cronjobs`.

One codebase serves **two public sites**, chosen by request host (`config/sites.js`):
- `mapa.meshcorepolska.org` - Polish, default region `pl`.
- `map.meshcoreprofiles.com` - global, default region `all`, default language English.

Comments are in English everywhere (backend, `public/`, `packages/core`, `apps/mobile`); older Polish comments in `apps/web/public` stay until the code around them is touched. UI text is i18n-ed (see below).

`apps/mobile` is an Expo (React Native, plain JS) app on MapLibre Native. It reuses `@meshcore-map/core` and the web API (`/api/v1/nodes?region=pl|all`, `/api/v1/radio-presets`, `/api/v1/app-config`). It needs a dev build because Expo Go does not include MapLibre Native. From the repo root, `npm run mobile:export` verifies Android bundling in Metro. Mobile code lives under `src/`, with settings and nodes in `state/`, the offline msgpack cache and app config in `data/`, and map screens, components, tools, UI primitives and translations in their respective directories.
- Error reporting (`src/bugsnag.js`, `@bugsnag/expo`) requires a key, the user's consent (`settings.errorReporting`) and the production release stage. The error callback limits app fields to version, release stage and type, and device fields to OS, runtime versions, manufacturer and model. It clears breadcrumbs, user identity and device metadata. Automatic session tracking is disabled.
- Translations: the same repo-root `locales/{pl,en}` feed the app and the server-side i18next (`global/services/i18n.js`). `mobile.json` holds the app-only strings, `appChangelog.json` the app's changelog (the site uses `changelog.json`); the app's version is in `apps/mobile/app.json`.
- The first launch asks for the map scope (`settings.region`: `all` or `pl`, same split as the two sites). It also picks the theme (`pl` red, `all` indigo): accents live in `packages/core/src/themes.js` (a test keeps them equal to `apps/web/public/css/themes/*.css`) and are read with `useTheme()`; shared colors are in `packages/core/src/colors.js`, so do not hardcode hex values in JS.
- Styles go above the components (`no-use-before-define`). `src/ui/iconData.js` is generated: run `npm run icons` in `apps/mobile` after changing `apps/web/public/icons/*.svg`; marker badges (`assets/nodes/*.png`, `src/components/nodeImages.js`) come from `npm run badges` (resvg).

## Commands

- Clone with `--recurse-submodules` (or `git submodule update --init`); `global/` (repo root) is a submodule.
- The monorepo uses npm workspaces and requires Node.js 26 or later for the web backend. Unqualified web paths below are relative to `apps/web`. `apps/`, `packages/`, `global/`, `locales/` and `tools/` are relative to the repo root. `packages/core` contains shared plain-ESM logic without DOM or Leaflet dependencies. The browser imports it as `/core/<file>.js`. The `public/js/{node-utils,pathtools,elevation}.js` modules re-export it, and Node.js and the mobile app use `@meshcore-map/core/*`.
- The web release version (`x.y.z+YYYYMMDD`) lives in the root `package.json`. From the root, use `npm test` for core tests, `node --test packages/core/test/core.test.js` for one test file and `npm run lint` for ESLint. The root `eslint.config.mjs` ignores `apps/web/public/vendor/**`, `node_modules` and `apps/mobile/.expo/**`.
- The web start command is `npm start` from the root or `node .` in `apps/web`. Verify against the existing local instance. Ask for its port if unknown.
- Production uses PM2 process `mcmap` with `cwd` set to `apps/web` in the root `ecosystem.config.js`. `npm run update` pulls `origin/main`, initializes the submodule, installs production dependencies for both `apps/web` and `packages/core`, then restarts `mcmap`. `npm run m` is for dependency maintenance.
- `node global/database/syncIndexes.js` - manual script, syncs Mongoose indexes of all models in `global/database/models/`.
- Needs MongoDB, Redis and a `.env` (copy `.env.example`; every variable is documented there). Notable: `SITE_MODE` (`auto`/`poland`/`global`) forces a site regardless of host; the keys `ESRI_API_KEY`, `MAPTILER_API_KEY`, `CARTO_API_KEY` unlock basemaps; the app gets only its own `MAPTILER_API_KEY_MOBILE` and `CARTO_API_KEY_MOBILE` from `/api/v1/app-config` (no fallback to the site's referrer-restricted keys, no Esri: its terms forbid storing data, the native map caches tiles), which the user's own keys (`settings.apiKeys`) replace; a key restricted to the site's domains is refused on localhost, so development needs a key of its own; `TURNSTILE_*` enables node deletion (feature is off without them).

## Backend

- `index.js` runs the CSP nonce middleware, Helmet and CORS, serves static assets from `public/` and `/core`, mounts App Links, resolves `req.site`, detects the language prefix, applies the embed language override, then runs language negotiation, i18next, morgan, the production-only global rate limiter and timeouts before mounting the main routes. `index.js` and the root `tools/*.js` load `loadEnv.js` first, before imports that read environment variables. It resolves `.env` relative to the repo root. `global/database/mongoose.js` starts the MongoDB connection on import.
- `config/sites.js` adds web-specific language, theme, domain and icons to the shared settings imported from `@meshcore-map/core/sites`. The web and mobile app also share the basemap catalog, fallback order, `formatTimeAgo` and statistics helpers from `packages/core`. `config/features.js` controls terrain and coverage for both clients, via `MAP_CONFIG.features` on the web and `/api/v1/app-config` on mobile.
- `routes/Api.js`: `GET /api/v1/nodes` (binary msgpack, `?region=pl|all`, default `pl`), `/repeater-stats` (JSON, CORS `*`, used by meshcorepolska.org), `/radio-presets` (Redis `meshcore:radioPresets:data`, filled by `cronjobs/jobs/radio-presets.js`; 503 if missing; the frontend never calls the upstream API directly), `/stats/history` (MongoDB daily snapshots, `?days=` capped at 365, `days=all` max 5000 rows).
- `GET /api/v1/app-config` returns the feature switches, elevation API URL, Bugsnag key and mobile basemap keys.
- The owner card uses `/api/v1/node-profile-keys` and `/api/v1/node-profile/:publicKey`. `services/nodeProfile.js` caches the key set for 5 minutes and includes approved public nodes on `public` or `noindex` profiles. A key absent from the set returns 404 without an individual MongoDB lookup. `services/boardImage.js` resolves the board image. Both endpoints share the `nodeProfile` limiter.
- `routes/NodeDeletion.js`: `POST /api/v1/node-deletion` needs `ownerConfirmed`, a 64-hex `publicKey` and a Turnstile token (verified in `services/turnstile.js`: hostname, action `node-deletion`, `cdata` = public key; 503 without keys). Returns a `mailto:` link (built by `buildDeletionMailUrl` in `packages/core/src/deletion.js`, which the app calls directly without the captcha; recipient `DELETION_EMAIL`, also re-checked in `public/js/node-deletion.js`). Limiters `nodeDeletionAttempts` (10/10 min) and `nodeDeletion` (3 successful/day) in `middlewares/ratelimit.js`; responses are `no-store`.
- `routes/Index.js` renders the map and generates `robots.txt`, `sitemap.xml` (one URL per language) and `manifest.webmanifest` from `req.site`. `/test` (icon/toast preview) exists only outside production.
- `routes/AppLinks.js` serves Android App Links at `/.well-known/assetlinks.json` for both hosts before site and language handling. The package name and release fingerprint (`extra.androidCertSha256`) come from `apps/mobile/app.json`. `ANDROID_PLAY_CERT_SHA256` accepts additional Play App Signing fingerprints separated by commas.
- `routes/Embed.js` renders `/embed` from the validated node list in the `data` query parameter. `lang` can select the language. `EMBED_PARENTS` controls which origins may frame it and defaults to `https://meshcoreprofiles.com`.
- Both sites link to the Telemavix GPS closed alpha signup on sefinek.net. `tools/export-testers.js` and `tools/notify-testers.js` work with existing MeshCore Map registrations. Sending mail requires `--send` and explicit user authorization.
- `utils/httpError.js`: `HttpError(res, status, err)` logs and ends with just the status, no body; used by routes and the global error/404 handler.
- Node reading layer is `global/services/nodeCache.js` (no local `services/nodes.js`).

## Shared `global` submodule

`global/` ([meshcore-profiles/global](https://github.com/meshcore-profiles/global)) is shared **verbatim** by every MeshCore backend repo (`cronjobs`, `meshcoreprofiles.com`, `flasher.meshcoreprofiles.com`, `meshcorepolska.org`, this one), possibly at different commits. A change there affects all of them, so treat it as a shared library. Read the code before assuming behavior. What this repo uses:
- `services/redis.js` (Redis db 8), `services/axios.js` (User-Agent from **this repo's** `package.json`), `services/nodeCache.js` (nodes cached in Redis by `cronjobs`; `getCachedNodes`, `getLastRefreshedAt`, `getStats`, `formatWarsawDate`).
- `services/i18n.js` and `utils/languageResolver.js` (languages `en`, `pl`; language-prefixed paths per site default; negotiation from cookie and `Accept-Language`).
- `utils/nodeStats.js` exports `MESHCORE_KEYS.nodes` from `utils/redisKeys.js` as `REDIS_KEYS`. It computes repeater status from the age of `ud` with 5/10/20-day thresholds for nodes whose compact source field `s` starts with `u`. Logging middleware is in `middlewares/morgan.js`.
- `database/mongoose.js` (connection failure is only logged), `database/models/statsDaily.model.js` (written by `cronjobs`, read here).
- `IndexNow.js` is a manual script that reads `public/` relative to the working directory. It discovers exactly one verification file whose name before `.txt` matches its contents.

## Multi-site and i18n

- A site's default language never gets a URL prefix (for `poland`, `pl` has none and `en` lives under `/en`; for `global` the reverse).
- Translations live in the repo-root `locales/{pl,en}/*.json`, one namespace per file; both languages must keep identical file lists and keys. `middlewares/language.js` exposes `t`, `langPath`/`lp` and `i18nBundle` to views; the bundle reaches the frontend via `window.MAP_CONFIG.i18n`.
- `middlewares/languageNegotiation.js` handles `?setlang=` and redirects to the prefixed URL; skipped for `/api/**`, `robots.txt`, `sitemap.xml`, `manifest.webmanifest`. It must run before `language.js`.
- CSS: `public/css/global.css`, `components/`, `map/`, per-site `themes/`. Load order matters and lives in `views/partials/stylesheets.ejs`; register new files there.

## Frontend

- Entry: `public/js/map.js` (`<script type="module">` in `views/index.ejs`), loaded after the global `leaflet.js` and `leaflet.markercluster.js`. `leaflet-esm.js` re-exports the global `L`. MapLibre GL is lazy-loaded from `public/vendor/maplibre/` only when a vector basemap is used.
- `views/index.ejs` injects `window.MAP_CONFIG` (region, view, API URLs, map keys, language, i18n bundle) before any module runs.
- `/api/v1/nodes` sends the cached msgpack buffer. The browser reads the response body in chunks to display download progress in bytes, then decodes it with vendored `msgpackr`.
- Modules in `public/js/` expose `init*` factories that bind DOM elements by ID (must match `views/index.ejs`) and return a small controller. Shared primitives: `pathtools.js` (measure, route), `elevation.js` (terrain, coverage), `modal.js`, `toast.js`, `i18n.js` (`t`/`tRaw`/`plural`).
- Owner card (`public/js/owner-card.js`, `lightbox.js`): `showNodeDetail` in `map.js` waits up to 600 ms for the profile (`loadOwner`) before opening the popup, so `getNodePopupHTML` renders the card inline via `peekOwner` and the popup opens once at its final width; without the data in time, `hydrateOwnerCard` shows a skeleton and fills it in. The default Leaflet click-to-open is removed in `ensurePopup`, only `showNodeDetail` opens popups. `touch-hints.js` shows the `title` of `.owner-tag`/`.param-chip` as a toast on tap (hover-less devices).
- Tools that pick a point on the map share one picker slot (`setPicker` in `map.js`); only one tool can listen at a time.
- State (`state` in `map.js`) drives filtering, is persisted in `localStorage`, and the view, selected node and tool state are mirrored into the URL query via `history.replaceState` (`?node=<public_key>`, `lat`/`lon`/`zoom`).
- Basemaps: raster ones in `tileBaseMaps`, vector ones (OpenFreeMap, Esri, MapTiler) in `maplibreBaseMapOptions`. Keys: Esri Hybrid needs `ESRI_API_KEY`, MapTiler `MAPTILER_API_KEY`, CartoDB `CARTO_API_KEY`. The default is the first available map of `PRIORITY_ORDER` in `packages/core/src/basemaps.js`: Esri Hybrid, CartoDB Dark, OpenStreetMap (keyless), OpenFreeMap (keyless, last); a map that fails is replaced by the next one. The app has no Esri (its terms forbid storing data, which the tile cache does). MapTiler stays opt-in (free plan is non-commercial; CARTO's free tier has a monthly cap).
- Basemap choice: stored on its own (`baseMapSelected` in localStorage, `settings.basemap` in the app; null = follow the default). A failing map only changes what is shown for the session: `resolveBasemap` and `withBasemapFailure` (`packages/core/src/basemaps.js`) give the wanted and the shown map, `public/js/basemap-manager.js` (web) and `screens/useBasemap.js` (app) apply them; on the web a choice is saved only after the map has loaded. The list is grouped by `category` (maps, satellite), with default, unavailable and key-locked maps marked, and a toast tells when a saved choice is no longer available.
- Own keys: a visitor can enter Esri/MapTiler/CARTO keys in the settings panel (`public/js/api-keys.js`, `localStorage.customApiKeys`; `settings.apiKeys` in the app); they replace the server's keys (`mergeApiKeys` in `packages/core/src/basemaps.js`).
- Gotchas: marker clustering is rebuilt from scratch when the clustering zoom threshold changes (that option is immutable). Desktop node popups use a custom `nodePopupPane` outside `mapPane` (z-index 1001, above `#stats-bar` 1000 and below `#fab-stack` 1002) synced via `syncPopupPane`; popups have `autoPan: false` and `panPopupIntoView` handles panning; `.node-qr` has a fixed size to keep popup height stable.
- `terrain.js` and `coverage.js` fetch elevations from a swappable provider (`sefinek` via `SEFINEK_API`, `open-elevation`, `open-meteo`).

## Vendored dependencies

`public/vendor/README.md` lists the exact version and source of every vendored library and the procedure for swapping source maps. Never hand-edit `public/vendor/**`; replace files wholesale following that procedure.

## Style (enforced by `eslint.config.mjs`)

Tabs, single quotes, semicolons, `eqeqeq` (except against `null`), no `var`, prefer `const`, enforced arrow-parens and arrow-body-style, `no-use-before-define` for variables (functions exempt). `public/**/*.js` additionally gets `no-redeclare`, browser globals and ES module source type.
