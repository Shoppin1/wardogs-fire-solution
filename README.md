# WARDOGS Feuerleitrechner

Second-Screen-Feuerleitrechner für [WARDOGS](https://store.steampowered.com/app/3453530/WARDOGS/) (BULKHEAD / Team17). Inoffizielles Fan-Tool, reines Werkzeug mit manueller Eingabe. Kein Auslesen von Speicher, kein Overlay, kein OCR, keine Interaktion mit dem Spielprozess.

**Inoffizielles Fan-Tool, nicht verbunden mit BULKHEAD oder Team17.**

## Funktionen

- **Koordinateneingabe** als Hauptmodus: eigene Position + Zielposition (aus dem In-Game-Karten-Readout ablesen), Ergebnis live ohne Button
- **Richtung** als 3-stellige Grad + 8-Punkt-Himmelsrichtung (z.B. `123SE`, wie im Spiel)
- **Distanz** in Metern (Wert für die RNG-Anzeige im Spiel)
- **MILS** (Rohrerhöhung) je Waffe, interpoliert aus Community-Feuertabellen, gerundet auf ganze Mil
- Waffen: **L81-Mörser** und **SPH-2** (Flach/Low und Steil/High getrennt)
- ATM-Eingabemaske: nur Ziffern tippen, Komma wird automatisch gesetzt (1678 → 16,78). Einfügen von `X80,00 Y70,00` füllt beide Felder eines Paares
- "Position fixieren": eigene Position bleibt über Ziele hinweg gespeichert
- "Neues Ziel": leert nur die Zielfelder
- **Swap / Pos. kopieren / Reset**: Positionen tauschen, als `x80,31, y69,29` in die Zwischenablage kopieren (Spiel-Format), alles leeren
- Korrekturen "Zu kurz" / "Zu weit": verschiebt das Ziel entlang der Schusslinie (Standard 10 m L81, 25 m SPH-2, einstellbar)
- **Einschießen**: beobachtete Einschlagskoordinate eingeben, App berechnet die Korrektur (klassisches Bracketing: neues Ziel = Ziel + (Ziel - Einschlag)) und übernimmt es
- **Gespeicherte Ziele**: benannte Ziele, antippbar laden, Rechtsklick löschen, Export/Import als JSON
- **Salvo-Planung**: Zielsequenz aufbauen, je Eintrag Richtung/Distanz zur aktuellen Gun, antippbar
- Verlauf der letzten 5 Ziele als antippbare Chips
- Optional: Kartenansicht (Bakurani, Ozeti, Zestafona) mit Markern, Verbindungslinie und Reichweitenringen, lazy geladen. Kacheln liegen im Repo (8 m/Pixel). App funktioniert vollständig ohne Karte
- **PWA**: installierbar auf Handy/Zweitmonitor, funktioniert offline (Kacheln und Heightmaps werden beim ersten Ansehen gecacht)
- Alles lokal (localStorage), kein Tracking, keine Analytics, kein Backend

## Nutzung

Feld maske: einfach Ziffern eintippen. `1678` zeigt live `0,01` > `0,16` > `1,67` > `16,78`. Werte mit Komma oder Punkt (`16,78`, `16.78`) werden direkt akzeptiert. Spiel-Format `X80,00 Y70,00` in ein Feld eines Paares einfügen füllt beide.

Sobald alle vier Werte gültig sind, erscheinen Richtung, Distanz und MILS. Außerhalb der Tabellengrenzen: Statusmeldung "Zu nah / Zu weit", kein Wert.

Karte (optional): Toggle "Karte anzeigen". Linksklick setzt das Ziel, Rechtsklick die eigene Position, Marker ziehen aktualisiert die Felder.

ΔZ-Anzeige: unabhängig von der Karte. Unter "Karte / Höhen" eine Karte wählen, die Heightmaps liegen im Repo.

## Kartenkacheln

Die Kacheln liegen unter `public/tiles/<karte>/zoom_<z>/<x>_<y>.webp` im Repo, Zoom 0 bis 3. Das sind 2048 px je Kartenkante, also 8 m/Pixel, dieselbe Auflösung wie die Terrain-Heightmaps. Zusammen 255 Kacheln, rund 9,5 MiB. Leaflet skaliert darüber hinaus noch zwei Stufen hoch, tiefer wird nicht nachgeladen.

Nachladen oder tiefer holen:

```bash
python3 scripts/download-tiles.py --max-zoom 3
```

Das volle Upstream-Pyramid geht bis Zoom 7 (32768 px je Kante, 21.845 Kacheln je Karte) und ist zum Bündeln viel zu groß. Die Pyramide deckt den Weltausschnitt X/Y `-0,03 .. 163,81` bzw. `-0,01 .. 163,83` ab (`src/maptiles.ts`).

Wer die volle Tiefe will, braucht einen eigenen Tile-Host mit demselben Layout und setzt ihn beim Build:

```bash
VITE_TILE_BASE=https://dein-tile-host.example npm run build
```

Das öffentliche CDN des Quell-Projekts (`assets.wardogs-artillery.com`) beantwortet Anfragen von fremden Origins mit **HTTP 403** (Hotlink-Schutz) und taugt deshalb nicht als Laufzeit-Host. Kartenbilder sind WARDOGS-Spielassets und nicht MIT-lizenziert, siehe `NOTICE`.

## Datenquelle und Lizenz

Kurzfassung hier, vollständige Aufstellung in `NOTICE`.

- Projekt-Code: MIT, siehe `LICENSE`.
- Feuertabellen: [apollyon-sys/wardogs-calculator](https://github.com/apollyon-sys/wardogs-calculator), Commit `7965b3ee5b3b88a3936ffe13a3ce17e92899d793`, **MIT-Lizenz**, Copyright (c) 2026 Apollyon. Kopie in `data/firing-tables.json`, Schema-Doku in `data/data.schema.md`.
- **Terrain-Heightmaps (`public/terrain/*.png`) sind im Repo gebündelt und NICHT unter MIT.** Sie sind aus den WARDOGS-Landscape-Collision-Daten des Quell-Projekts abgeleitet (auf 8 m/Pixel heruntergerechnet) und damit Spieldaten. Sie speisen nur die ΔZ-Anzeige; es wird ausschließlich die Differenz zweier Punkte angezeigt, nie eine absolute Höhe.
- **Kartenkacheln (`public/tiles/`) sind gebündelt und NICHT unter MIT.** WARDOGS-Spielassets, siehe Abschnitt Kartenkacheln.
- Community-Daten, nicht offiziell. Erster Schuss = Einschießen. Höhenunterschied (ΔZ) wird angezeigt, aber nicht automatisch in MILS verrechnet.

## Entwicklung

```bash
npm install
npm test        # Vitest, alle reinen Funktionen
npm run dev     # Vite Dev-Server
npm run build   # TypeScript-Check + Produktions-Build nach dist/
```

## GitHub Pages Deploy

Repo hat einen Workflow (`.github/workflows/deploy.yml`), der bei Push auf `main` testet, baut und über `actions/deploy-pages` direkt nach GitHub Pages published. Es gibt keinen `gh-pages`-Branch. Aktivierung:

1. Repo-Settings → Pages → Source: **GitHub Actions**
2. Nach dem ersten Workflow-Lauf ist die App unter `https://shoppin1.github.io/wardogs-fire-solution/` erreichbar

Die Kacheln liegen im Repo, es ist nichts weiter zu konfigurieren.

## Feuertabellen nach Game-Patch aktualisieren

Die Tabellen sind Beta-Community-Daten und können sich ändern:

1. Quelle prüfen: `data/weapons.json` im Upstream-Repo (Link oben)
2. Werte in `data/firing-tables.json` übernehmen (Format: `[distanz_m, mils]`, Schema siehe `data/data.schema.md`)
3. `source.commit` und `extracted` auf den neuen Stand setzen
4. `npm test` laufen lassen (Tests prüfen Tabellen-Grenzen und Interpolation)

## Rechtliches

Siehe `NOTICE` für die vollständige Herkunfts- und Lizenzaufstellung aller Fremddaten.

Inoffizielles Fan-Tool für WARDOGS. Nicht verbunden mit, unterstützt von oder autorisiert durch BULKHEAD oder Team17. WARDOGS und verwandte Namen, Marken und Assets gehören ihren jeweiligen Eigentümern. Reines Second-Screen-Werkzeug mit manueller Eingabe, keine Spielprozess-Interaktion (EULA).