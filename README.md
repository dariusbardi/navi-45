# Navi 45

Navigation für den AM-Führerschein (max. 45 km/h) und normale Autos: Routen ohne Autobahn und Kraftfahrstraße, Live-Standort, Ansagen auf Deutsch, Ladestationen für den Opel Rocks-e, Offline-Karte für München.

Läuft als Web-App unter https://dariusbardi.github.io/navi-45/ (auf dem iPhone: Teilen → Zum Home-Bildschirm).

## Aufbau

| Ordner / Datei | Inhalt |
|---|---|
| `src/head.html`, `src/body.html` | Seitenkopf und Bedienelemente |
| `src/style.css` | Aussehen |
| `src/js/01-…20-*.js` | App-Logik, in Ausführungsreihenfolge (Grundlagen, Suche, Karte, Route, Navigation …) |
| `build.js` | setzt alles zu `index.html` zusammen: `node build.js` |
| `index.html` | fertige App (nicht direkt bearbeiten) |
| `sw.js` | Service Worker: schneller Start, Kartenspeicher, Offline-Karte |
| `sprites/` | vorgerenderte 3D-Fahrzeugbilder (36 Blickwinkel) |
| `tools/` | Fahrzeugmodelle und Skript zum Neurendern der Bilder |

Daten: Karte © OpenStreetMap-Mitwirkende / OpenFreeMap, Routen Valhalla (FOSSGIS), Suche Photon (komoot) bzw. Nominatim, Satellit Esri.
