# Firing-Tables-Schema (data/firing-tables.json)

Community-Daten aus `apollyon-sys/wardogs-calculator` (MIT), Commit-Hash siehe `source.commit`.

## Struktur

```
{
  "$schema": "data.schema.md",
  "source": { repo, commit, file, license, copyright, extracted },
  "weapons": [
    {
      "id": "mortar" | "sph2",
      "name": "L81-Mörser" | "SPH-2",
      "minRangeM": int,          // praktische Mindestdistanz (Community-Konsens)
      "maxRangeM": int,          // praktische Maximaldistanz
      "minElevationMil": int,    // kleinster gültiger Mil-Wert der Waffe
      "maxElevationMil": int,    // größter gültiger Mil-Wert der Waffe
      "arcs": [
        {
          "id": "single" | "low" | "high",
          "label": "Standard" | "Flach (Low)" | "Steil (High)",
          "points": [ [distanz_m, mils], ... ]   // aufsteigend nach Mil sortiert
        }
      ]
    }
  ]
}
```

## Punkte-Reihenfolge

- `mortar.single` und `sph2.low`: **aufsteigend nach Distanz** (Mil fällt).
- `sph2.high`: **aufsteigend nach Mil** (Distanz steigt bis 2629, danach konstant 2629 bei weiter steigendem Mil, Minimum bei 735/1400). Reihenfolge wie in der Quelle.

## Interpolation

App interpoliert linear zwischen den zwei benachbarten Punkten und rundet auf ganze Mil. Keine Extrapolation außerhalb `[min, max]` der Punkteliste.

## Nach Game-Patch aktualisieren

1. Quelle prüfen: https://github.com/apollyon-sys/wardogs-calculator/blob/main/data/weapons.json
2. Neue Werte für `ballistics` sowie ggf. `minRangeKm`/`maxRangeKm`/Mil-Grenzen übernehmen.
3. `source.commit` und `extracted` aktualisieren.
4. `npm test` laufen lassen (Interpolation-Tests prüfen Tabellen-Struktur).