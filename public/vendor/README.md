# Zależności frontendu

| Katalog         | Biblioteka            | Wersja | Strona projektu                                                           |
|-----------------|-----------------------|--------|---------------------------------------------------------------------------|
| `leaflet`       | Leaflet               | 1.9.4  | [Leaflet](https://github.com/Leaflet/Leaflet)                             |
| `markercluster` | Leaflet.markercluster | 1.5.3  | [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) |
| `maplibre`      | MapLibre GL JS        | 6.6.0  | [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js)              |
| `maplibre`      | MapLibre GL Leaflet   | 0.1.4  | [MapLibre GL Leaflet](https://github.com/maplibre/maplibre-gl-leaflet)    |
| `msgpackr`      | msgpackr              | 2.1.0  | [msgpackr](https://github.com/kriszyp/msgpackr)                           |
| `qrcode`        | qrcode                | 1.5.4  | [qrcode](https://github.com/soldair/node-qrcode)                          |

## Bezpośrednie źródła plików

### Leaflet 1.9.4

- [leaflet.js](https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js) - główna biblioteka mapy.
- [leaflet.js.map](https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js.map) - mapa źródłowa JavaScript.
- [leaflet.css](https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css) - podstawowe style mapy i kontrolek.

### Leaflet.markercluster 1.5.3

- [leaflet.markercluster.js](https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js) - grupowanie pobliskich markerów.
- [leaflet.markercluster.js.map](https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js.map) - mapa źródłowa JavaScript.
- [MarkerCluster.css](https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.css) - układ i animacje klastrów.
- [MarkerCluster.Default.css](https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css) - domyślny wygląd klastrów.

### MapLibre GL JS 6.6.0

- [maplibre-gl.mjs](https://cdn.jsdelivr.net/npm/maplibre-gl@6.6.0/dist/maplibre-gl.mjs) - główny moduł renderera map wektorowych.
- [maplibre-gl-shared.mjs](https://cdn.jsdelivr.net/npm/maplibre-gl@6.6.0/dist/maplibre-gl-shared.mjs) - kod współdzielony przez moduł główny i worker.
- [maplibre-gl-worker.mjs](https://cdn.jsdelivr.net/npm/maplibre-gl@6.6.0/dist/maplibre-gl-worker.mjs) - przetwarzanie danych mapy poza głównym wątkiem.
- [maplibre-gl.css](https://cdn.jsdelivr.net/npm/maplibre-gl@6.6.0/dist/maplibre-gl.css) - style mapy i kontrolek MapLibre.
- [maplibre-gl.mjs.map](https://cdn.jsdelivr.net/npm/maplibre-gl@6.6.0/dist/maplibre-gl.mjs.map) - mapa źródłowa modułu głównego.
- [maplibre-gl-shared.mjs.map](https://cdn.jsdelivr.net/npm/maplibre-gl@6.6.0/dist/maplibre-gl-shared.mjs.map) - mapa źródłowa kodu współdzielonego.
- [maplibre-gl-worker.mjs.map](https://cdn.jsdelivr.net/npm/maplibre-gl@6.6.0/dist/maplibre-gl-worker.mjs.map) - mapa źródłowa workera.

### MapLibre GL Leaflet 0.1.4

- [leaflet-maplibre-gl.mjs](https://cdn.jsdelivr.net/npm/@maplibre/maplibre-gl-leaflet@0.1.4/dist/leaflet-maplibre-gl.mjs) - warstwa łącząca MapLibre GL z Leaflet.

### msgpackr 2.1.0

- [msgpackr.js](https://cdn.jsdelivr.net/npm/msgpackr@2.1.0/+esm) - dekodowanie danych MessagePack w przeglądarce.
- [msgpackr.js.map](https://cdn.jsdelivr.net/sm/be1fb368de3084f2d6bbef8f85519ecf7c92c079862de480f4f87f2b19b2e909.map) - mapa źródłowa wygenerowanego bundla.

jsDelivr generuje dla bundla mapę źródłową pod skrótem `/sm/...`, który może zmienić się między wydaniami. Po pobraniu nowej wersji mapę należy zapisać jako `msgpackr.js.map` i zmienić końcowy `sourceMappingURL` w `msgpackr.js` na nazwę lokalnego pliku.

### qrcode 1.5.4

- [qrcode.js](https://esm.sh/qrcode@1.5.4?bundle) - generowanie kodów QR na elemencie `canvas`.
