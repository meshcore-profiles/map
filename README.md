# MeshCore Map 🗺️
Interactive map of MeshCore network nodes. A single codebase serves two public sites, chosen by the domain it runs under (see [config/sites.js](config/sites.js)):

- [mapa.meshcorepolska.org](https://mapa.meshcorepolska.org) - Polish version, shows only nodes from Poland by default.
- [map.meshcoreprofiles.com](https://map.meshcoreprofiles.com) - global version (MeshCore Map), shows nodes from the whole world by default, interface defaults to English.

The project consists of a frontend (HTML, CSS, ESM) and a backend (Node.js CJS).
The backend fetches node data from the public `map.meshcore.io` API and keeps it in the process memory and in Redis, while daily network stats snapshots are stored in MongoDB.

## Highlights
- i18n implemented (currently available in Polish and English).
- Sharing a selected node or contact via a direct link, and copying their data (name, public key) to the clipboard.
- Instantly adding a client, repeater, or room server as a contact in the MeshCore app.
- Searching nodes by name and public key, with keyboard support.
- Data transferred in a compact MessagePack format; the default view for the Polish version only fetches nodes from Poland.
- A choice of multiple basemaps - raster (OpenStreetMap, Esri Hybrid, OpenTopoMap, CyclOSM, Humanitarian OSM) and vector (OpenFreeMap), plus MapTiler and CartoDB when the relevant API keys are configured.
- Analytical tools: distance measurement, drawing a route between nodes by name or key, terrain analysis (elevation profile and optical line of sight between two points), and a layer showing a node's theoretical radio coverage in every direction.

## Roadmap
The `meshcoreprofiles.com` service already serves the global node map at `map.meshcoreprofiles.com`. Planned next is integration with user profiles:

- Users who submit data about their companion or repeater will get their own profile.
- Selected profile information will be shown directly on the map, making it easy to see who owns a given node.
- Repeater owners will be able to upload photos of their devices, which will then be publicly displayed on the site.

A test version of the configurator is currently available only to members of the [MeshCore Polska Discord](https://meshcorepolska.org/discord) server (the `/konfigurator` command by `Sefi#6347`). [See an example profile](https://beta.sefinek.net/meshcore-pl/kontakty/6a43efd454feb8be5679e0a6).

## Requirements
- Node.js >=20.19.0
- MongoDB
- Redis
- Internet access to fetch source data

## Installation
```bash
git clone https://github.com/meshcore-profiles/map.git mapa.meshcorepolska.org
cd mapa.meshcorepolska.org
npm install
cp .env.example .env
```

Then fill in the MongoDB (`MONGODB_URL`) and Redis (`REDIS_HOST`, `REDIS_PASSWD`) credentials in the created `.env` file.
The `SITE_MODE` variable lets you force the Polish (`poland`) or global (`global`) version regardless of the domain - by default (`auto`) it's chosen based on the request host.

Start the server with:
```bash
node .
```

The map will be available by default at `http://127.0.0.1:8080`.

## API
The backend exposes node data in MessagePack format at:

```text
GET /api/v1/nodes
```

By default, only nodes located in Poland are returned. The `region=all` parameter fetches all available nodes:

```text
GET /api/v1/nodes?region=all
```

## Credits
This project is built on top of [map.meshcore.io](https://github.com/meshcore-dev/map.meshcore.io) by [recrof](https://github.com/recrof) (Rastislav Vysoký).

## License
Since [map.meshcore.io](https://github.com/meshcore-dev/map.meshcore.io) is MIT licensed, this project is available under the same license. See the [LICENSE](LICENSE) file for details.
