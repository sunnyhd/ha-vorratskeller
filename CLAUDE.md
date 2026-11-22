# ha-vorratskeller: Lagerverwaltung für den Vorratskeller als Home-Assistant-Integration

Privates Projekt von KB (Haushalt, 4 Personen). Regeln für `~/privat` gelten: `../CLAUDE.md`.

## Was es ist
Eigene Integration für Home Assistant, verteilt über HACS aus einem öffentlichen GitHub-Repo:
Lagerbuch mit Chargen und Mindesthaltbarkeitsdatum, Soll je Produkt (14-Tage-Notvorrat nach BBK/BLE), Entnahme
nach FIFO, Kamera-Scanner (Regal-QR und EAN, Open Food Facts), Einkaufsliste und Push-Nachrichten über Home Assistant,
eigenes Dashboard über eine Dashboard-Strategie wie beim Energie-Dashboard.

## Wo es läuft
Home Assistant OS bei KB zu Hause, von außen über Cloudflare erreichbar. Kellertablet: altes Amazon Fire 10".
Entwicklung und Tests nur lokal auf der Werkbank (Home Assistant im venv), nie gegen die Haus-Installation ohne KB.

## Geschützt
- Öffentliches Repo: keine Fotos aus dem Haus, keine Hausadressen, Hostnamen, Tokens oder Namen der Familie.
  `docs/grundlagen/kellerraum-foto.jpg` bleibt lokal (gitignored).
- Repo auf GitHub anlegen, Push, Releases und Einspielen in die Haus-Installation nur mit Freigabe von KB.
- Open Food Facts: nur die Barcode-Nummer geht nach außen (KB, 2026-11-22).

## Konventionen
Deutsch für Doku, Oberfläche und Commits, Englisch für Code-Bezeichner. Symbole: Material Design Icons wie in HA.
