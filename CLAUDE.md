# CLAUDE.md

Map of MeshCore network nodes. Node.js/Express backend (ESM), plain-JS frontend (ES modules, no framework or bundler) on Leaflet and MapLibre GL, and an Expo app. Node data comes from `map.meshcore.io`, cached in Redis by `meshcore-profiles/cronjobs`.

One codebase serves two sites, chosen by request host (`apps/web/config/sites.js`, shared settings in `packages/core/src/sites.js`):
- `mapa.meshcorepolska.org` - Polish, default region `pl`.
- `map.meshcoreprofiles.com` - global, default region `all`, default language English.

Write comments in English; translate older Polish ones in `apps/web/public` when touching the code around them.

## Layout and commands

- npm workspaces, Node.js 26+. Web paths below are relative to `apps/web`; `apps/`, `packages/`, `global/`, `locales/` and `tools/` are relative to the repo root.
- `packages/core` is shared plain-ESM logic without DOM or Leaflet dependencies. The browser imports it as `/core/<file>.js`, Node.js and the app as `@meshcore-map/core/*`.
- From the root: `npm test` (core tests), `npm run lint`, `npm run mobile:export` (verifies Android bundling).
- The web release version (`x.y.z+YYYYMMDD`) lives in the root `package.json`, the app's in `apps/mobile/app.json`.
- `.env` sits in the repo root and is documented in `.env.example`. Scripts reading environment variables import `loadEnv.js` first.
- Production: PM2 process `mcmap` (`ecosystem.config.js`), deployed with `npm run update`.
- `tools/notify-testers.js` sends mail only with `--send`, which needs explicit user authorization.

## `global` submodule

Shared verbatim by every MeshCore backend repo (`cronjobs`, `meshcoreprofiles.com`, `flasher.meshcoreprofiles.com`, `meshcorepolska.org`, this one), possibly at different commits, so treat changes there as changes to a shared library. Its `services/axios.js` takes the User-Agent from this repo's `package.json`.

## Backend

- Middleware order in `index.js` matters: site resolution and the language prefix come before `languageNegotiation`, which must run before `language`.
- SEO is shared by all MeshCore sites and lives in `global`: `utils/seo.js` (`createSeo`, `ORGANIZATIONS`: the only place for organization data and JSON-LD), `views/seo-head.ejs` (the only set of title/meta/canonical/OG/Twitter/JSON-LD tags), `utils/sitemap.js`, `utils/robots.js`, `middlewares/noindex.js` (all of `/api`), plus the `middlewares/timeout.js` and `middlewares/rateLimit.js` factories. Never rebuild any of this locally. Here `apps/web/utils/seo.js` only adapts view locals. `robots.txt` (`routes/Index.js`) allows crawlers only the endpoints needed to render the map (`/api/v1/nodes`, `/api/v1/radio-presets`); a new endpoint required at startup needs its own `allow` entry.
- The frontend never calls the upstream radio presets API directly; `/api/v1/radio-presets` reads what `cronjobs` stores in Redis.
- `/api/v1/repeater-stats` has CORS `*` and is used by meshcorepolska.org.
- The app builds the node deletion `mailto:` itself (`packages/core/src/deletion.js`), without the Turnstile captcha used on the web. The recipient is re-checked in `public/js/node-deletion.js`.
- The app gets only `MAPTILER_API_KEY_MOBILE` and `CARTO_API_KEY_MOBILE` from `/api/v1/app-config`, with no fallback to the site's referrer-restricted keys. A domain-restricted key is refused on localhost.
- `config/features.js` toggles features for both web and app.

## i18n and CSS

- A site's default language has no URL prefix (`poland`: `en` lives under `/en`; `global`: `pl` under `/pl`).
- `locales/{pl,en}/*.json` feed the web and the app; both languages must keep identical files and keys. `mobile.json` and `appChangelog.json` are app-only, `changelog.json` is the site's.
- Register new CSS files in `views/partials/stylesheets.ejs`; load order matters.

## Frontend

- Entry: `public/js/map.js`. `views/index.ejs` injects `window.MAP_CONFIG`. `public/js/` modules expose `init*` factories that bind elements by ID.
- Only `showNodeDetail` in `map.js` opens node popups (`ensurePopup` removes Leaflet's click-to-open). It briefly waits for the owner profile so the popup opens at its final width.
- Tools that pick a point on the map share one picker slot (`setPicker` in `map.js`).
- Marker clustering is rebuilt from scratch when the clustering zoom threshold changes (the option is immutable).
- Desktop node popups use a custom `nodePopupPane` outside `mapPane`, between `#stats-bar` and `#fab-stack`, synced by `syncPopupPane`. Popups have `autoPan: false` (`panPopupIntoView` pans), and `.node-qr` has a fixed size to keep popup height stable.
- Basemaps are defined in `packages/core/src/basemaps.js` (`PRIORITY_ORDER` sets the default and fallback). A failing map changes only what is shown in the session; the web saves a choice only after the map loads. The app has no Esri because its terms forbid the tile caching. The MapTiler Hybrid style IDs are per site in `packages/core/src/sites.js` and are bundled into app builds.
- Never hand-edit `public/vendor/**`; replace files following `public/vendor/README.md`.

## Mobile app

- Needs a dev build (Expo Go lacks MapLibre Native).
- Do not hardcode colors: use `useTheme()` (`packages/core/src/themes.js`, kept equal to `apps/web/public/css/themes/*.css` by a test) and `packages/core/src/colors.js`.
- Styles go above the components (`no-use-before-define`).
- Generated files: after changing `apps/web/public/icons/*.svg` run `npm run icons` (`src/ui/iconData.js`); marker badges come from `npm run badges`.
- Privacy invariant: error reporting (`src/bugsnag.js`) requires user consent and production, and strips user, device identity and breadcrumbs. Keep it that way.
