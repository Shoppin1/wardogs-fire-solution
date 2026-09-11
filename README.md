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
- Optional: Kartenansicht (Bakurani, Ozeti, Zestafona) mit Markern, Verbindungslinie und Reichweitenringen, lazyl geladen. App funktioniert vollständig ohne Karte
- **PWA**: installierbar auf Handy/Zweitmonitor, App-Shell funktioniert offline (Karte braucht Netz)
- Alles lokal (localStorage), kein Tracking, keine Analytics, kein Backend

## Nutzung

Feld maske: einfach Ziffern eintippen. `1678` zeigt live `0,01` > `0,16` > `1,67` > `16,78`. Werte mit Komma oder Punkt (`16,78`, `16.78`) werden direkt akzeptiert. Spiel-Format `X80,00 Y70,00` in ein Feld eines Paares einfügen füllt beide.

Sobald alle vier Werte gültig sind, erscheinen Richtung, Distanz und MILS. Außerhalb der Tabellengrenzen: Statusmeldung "Zu nah / Zu weit", kein Wert.

Karte (optional): Toggle "Karte anzeigen". Linksklick setzt das Ziel, Rechtsklick die eigene Position, Marker ziehen aktualisiert die Felder. Karten-Tiles werden remote geladen (siehe Lizenzen).

## Datenquelle und Lizenz

- Feuertabellen: [apollyon-sys/wardogs-calculator](https://github.com/apollyon-sys/wardogs-calculator), Commit `7965b3ee5b3b88a3936ffe13a3ce17e92899d793`, **MIT-Lizenz**, Copyright (c) 2026 Apollyon. Kopie in `data/firing-tables.json`, Schema-Doku in `data/data.schema.md`.
- Projekt-Code: MIT, siehe `LICENSE`.
- **WARDOGS-Spielassets (Kartenbilder) sind NICHT unter MIT.** Die Kartenansicht lädt Tiles vom Asset-CDN des Quell-Repos (`assets.wardogs-artillery.com`). Es werden keine Kartenassets in diesem Repo gebündelt. Ohne erreichbares CDN blendet die App den Karten-Toggle automatisch aus, alles andere funktioniert weiter.
- Community-Daten, nicht offiziell. Erster Schuss = Einschießen. Höhenunterschied zwischen Geschütz und Ziel wird nicht berücksichtigt.

## Entwicklung

```bash
npm install
npm test        # Vitest, alle reinen Funktionen
npm run dev     # Vite Dev-Server
npm run build   # TypeScript-Check + Produktions-Build nach dist/
```

## GitHub Pages Deploy

Repo hat einen Workflow (`.github/workflows/deploy.yml`), der bei Push auf `main` testet, baut und nach `gh-pages` published. Aktivierung:

1. Repo-Settings → Pages → Source: **Deploy from a branch** → Branch `gh-pages`, Ordner `/ (root)`
2. Nach dem ersten Workflow-Lauf ist die App unter `https://shoppin1.github.io/wardogs-fire-solution/` erreichbar

Ohne Kartenassets: einfach deployen, der Toggle bleibt ausgeblendet, solange das CDN nicht erreichbar ist. Wer die Karten offline bündeln will, muss die Assets selbst hosten und in `src/main.ts` (`MAPS`) die Tile-URLs anpassen, und beachten, dass die Kartenbilder nicht MIT-lizenziert sind.

## Feuertabellen nach Game-Patch aktualisieren

Die Tabellen sind Beta-Community-Daten und können sich ändern:

1. Quelle prüfen: `data/weapons.json` im Upstream-Repo (Link oben)
2. Werte in `data/firing-tables.json` übernehmen (Format: `[distanz_m, mils]`, Schema siehe `data/data.schema.md`)
3. `source.commit` und `extracted` auf den neuen Stand setzen
4. `npm test` laufen lassen (Tests prüfen Tabellen-Grenzen und Interpolation)

## Rechtliches

Inoffizielles Fan-Tool für WARDOGS. Nicht verbunden mit, unterstützt von oder autorisiert durch BULKHEAD oder Team17. WARDOGS und verwandte Namen, Marken und Assets gehören ihren jeweiligen Eigentümern. Reines Second-Screen-Werkzeug mit manueller Eingabe, keine Spielprozess-Interaktion (EULA).