# Mapa MeshCore 🗺️
Interaktywna mapa węzłów sieci MeshCore. Jeden kod obsługuje dwie publiczne witryny, w zależności od domeny, pod którą działa (patrz [config/sites.js](config/sites.js)):

- **mapa.meshcorepolska.org** - wersja polska, domyślnie pokazuje wyłącznie węzły z Polski.
- **map.meshcoreprofiles.com** - wersja globalna (MeshCore Map), domyślnie pokazuje węzły z całego świata, interfejs domyślnie po angielsku.

Projekt składa się z frontendu (HTML, CSS, ESM) oraz backendu (Node.js CJS).
Backend pobiera dane o węzłach z publicznego API `map.meshcore.io` i przechowuje je w pamięci procesu oraz w Redis, a codzienne migawki statystyk sieci zapisuje w MongoDB.

## Czym się wyróżnia?
- Zaimplementowane i18n (dostępny język polski oraz angielski)
- Możliwość przełączania między węzłami z Polski i całego świata.
- Udostępnianie wybranego węzła lub kontaktu za pomocą bezpośredniego linku.
- Kopiowanie danych węzłów i kontaktów do schowka.
- Domyślny region i język zależą od witryny, pod jaką działa strona - polska (`pl`/`pl`) albo globalna (`all`/`en`).
- Dane przesyłane w kompaktowym formacie MessagePack; przy domyślnym widoku dla wersji polskiej pobierane są tylko węzły z Polski.
- Wyszukiwanie węzłów po nazwie i kluczu publicznym, z przyjemną obsługą klawiatury.
- Możliwość dodania kontaktu bezpośrednio z mapy do aplikacji MeshCore
- Wybór wielu podkładów mapy, w tym wektorowych (MapTiler Hybrid, OpenFreeMap) i rastrowych (OpenStreetMap, Esri Hybrid, CartoDB, OpenTopoMap, itd.).

## Plany
Serwis `meshcoreprofiles.com` obsługuje już globalną mapę węzłów pod adresem `map.meshcoreprofiles.com`. W planach pozostaje integracja z profilami użytkowników:

- Użytkownicy, którzy wprowadzą dane o companionie lub RPT, otrzymają własny profil.
- Wybrane informacje z profili będą widoczne bezpośrednio na mapie, dzięki czemu będzie można łatwo sprawdzić, do kogo należy dany węzeł.
- Właściciele repeaterów będą mogli przesyłać ich zdjęcia, które następnie zostaną publicznie wyświetlone w serwisie.

Testowa wersja konfiguratora jest obecnie dostępna wyłącznie dla użytkowników serwera [Discord MeshCore Polska](https://meshcorepolska.org/discord) (komenda `/konfigurator` od `Sefi#6347`). [Zobacz przykładowy profil](https://beta.sefinek.net/meshcore-pl/kontakty/6a43efd454feb8be5679e0a6).

## Wymagania
- Node.js >=20.19.0
- MongoDB
- Redis
- Dostęp do internetu w celu pobierania danych źródłowych

## Instalacja
```bash
git clone https://github.com/meshcore-profiles/map.git mapa.meshcorepolska.org
cd mapa.meshcorepolska.org
npm install
cp .env.example .env
```

Następnie uzupełnij dane dostępowe do MongoDB (`MONGODB_URL`) oraz Redis (`REDIS_HOST`, `REDIS_PASSWD`) w utworzonym pliku `.env`.
Zmienna `SITE_MODE` pozwala wymusić wersję polską (`poland`) lub globalną (`global`) niezależnie od domeny - domyślnie (`auto`) wybierana jest na podstawie hosta żądania.

Uruchom serwer poleceniem:
```bash
node .
```

Mapa będzie dostępna domyślnie pod adresem `http://127.0.0.1:8080`.

## API
Backend udostępnia dane w formacie MessagePack pod adresem:

```text
GET /api/v1/nodes
```

Domyślnie zwracane są węzły znajdujące się w Polsce. Parametr `region=all` pozwala pobrać wszystkie dostępne węzły:

```text
GET /api/v1/nodes?region=all
```

## Uznania
Projekt powstał na bazie [map.meshcore.io](https://github.com/meshcore-dev/map.meshcore.io) autorstwa [recrof](https://github.com/recrof) (Rastislav Vysoký).

## Licencja
Z uwagi na to, że [meshcore-dev/map.meshcore.io](https://github.com/meshcore-dev/map.meshcore.io) jest na licencji MIT, także ten projekt jest dostępny na tej samej licencji. Szczegóły znajdują się w pliku [LICENSE](LICENSE).
