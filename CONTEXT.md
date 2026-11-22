# CONTEXT: ha-vorratskeller

## Ziel
Lagerbuch für den Vorratskeller (4 Personen, 14 Tage, im Alltag aufbrauchbar, gesund), ganz in Home Assistant:
was ist da, was fehlt, was läuft ab, Nachkauf auf die HA-Einkaufsliste, Push-Nachrichten.

## Entscheidungen
- KB, 2026-11-22: eigene App statt Grocy, eingebunden in HA, Dashboard wie das Energie-Dashboard (Strategie),
  öffentliches GitHub-Repo, Open-Food-Facts-Abfrage ja, Push und Einkaufsliste über HA.
- Claude, 2026-11-22 (Architektur): Custom Integration (Domain `vorratskeller`) mit Speicher in HA (`.storage`),
  Services, Entitäten, mitgelieferter Karte (Scanner, Entnahme) und Dashboard-Strategie
  (`custom:vorratskeller`); Verteilung über HACS aus eigenem Repo `ha-vorratskeller`, nicht über `ha-addons`
  (Supervisor-Repo; HACS richtet Updates nach den Releases des ganzen Repos).
- Grocy-Variante ist verworfen; die Unterlagen liegen nur lokal in `docs/grundlagen/grocy-variante-*` (gitignored, KB 2026-11-22).

## Fachliche Grundlage (Quellen)
- Mengen: BLE-Vorratskalkulator, Tageswerte je Person (2.200 kcal), 14 Tage × 4 Personen; BBK empfiehlt 10 Tage.
  Produkte, Soll, Fach, Haltbarkeit: `docs/grundlagen/produkte-checkliste.json`
  (Gruppe, Ziel, Einheit, Regal, Items `[Produkt, Hinweis, Anzahl, Packung, Menge, MHD-Monate]`).
- Checkliste und 3D-Modell des Kellers: `docs/grundlagen/vorratskammer-14-tage.html`, `vorratskeller-3d.html`
- Raum 3 × 4 m, Stahlregal links 2,4 m und rechts 1,6 m (je 5 Böden, 40 cm tief), weißes Regal 1 m (4 Fächer);
  Wasser in 13 Mehrweg-Glaskästen neben dem linken Regal.

## Aufbau (Version 1, Stand 2026-11-22, Branch `v1-integration`)
- `custom_components/vorratskeller/`: `lager.py` (Fachlogik ohne HA: Produkte, Chargen, FIFO, Inventur,
  Reichweite, Journal), `seed.py` (Erstbefüllung aus `data/checkliste.json`, Soll auf Personen/Tage umgerechnet),
  `manager.py` (Store `.storage/vorratskeller`, Einkaufsliste, Wochenbericht, Mitternachts-Aktualisierung),
  `services.py` (10 Dienste), `sensor.py` (je Produkt + 4 Sammelsensoren), `config_flow.py`, `openfoodfacts.py`.
- `frontend/vorratskeller.js`: Karte `custom:vorratskeller-card` (entnahme, scanner, fehlend, ablaufend, etiketten)
  und Strategie `custom:vorratskeller` (6 Ansichten), ohne Build. `frontend/vendor/`: barcode-detector/zxing-wasm
  und qrcode-generator, lokal ausgeliefert (`scripts/vendor.sh`, Lizenzen in `LICENSES.md`).
- Tests: `tests/` (pytest-homeassistant-custom-component 0.13.375 = HA 2026.10.4), `tests/frontend/` (node --test).
  CI: `.github/workflows/validate.yml` (hassfest, HACS, ruff, pytest, node).
- Lokales HA: `config/` (gitignored, 127.0.0.1:18123, trusted_networks nur localhost), `.venv/bin/hass -c config`.

## Erkenntnisse (für spätere Änderungen)
- HA-Frontend tauscht `window.customElements` gegen ein Polyfill, nachdem `add_extra_js_url`-Module geladen sind;
  die Karte definiert ihre Elemente daher 30 s lang nach (im Browser belegt, sonst Timeout der Strategie).
- Einheiten übersetzt HA nur auf Englisch; Sammelsensoren haben feste deutsche Einheiten.
- `todo.get_items` ohne `status` liefert alle Einträge; für die Dublettenprüfung `needs_action` mitgeben.
- HA 2026.x übernimmt `http:` aus YAML einmalig als 5-Minuten-Probe in `.storage/http`; ohne Bestätigung im UI
  fällt es auf den Standard 0.0.0.0:8123 zurück. Lokal daher `stable` in `config/.storage/http` auf
  127.0.0.1:18123 gesetzt (am 22.11. lief die Dev-Instanz ca. 10:16–10:25 auf 0.0.0.0:8123, mit Anmeldung,
  keine fremden Zugriffe im Log).
- Dienste: schreibende nicht für Nur-Lesen-Konten, `produkt_loeschen` nur für Admins; Automationen dürfen alles.

## Geprüft
pytest 38 grün, node 5 grün, ruff sauber. Codex-Review (11 Befunde: Rechte, inf/nan, Kamera-Abbruch,
Scan überschreibt Eingaben, leeres Dashboard, Rundung, Rückgängig, Teiländerung, parallele Abgleiche, Cookies,
Kachel-Bedienung) eingearbeitet, je mit Test wo möglich. Im echten HA 2026.10.4 lokal: Config Flow, Optionen, Einkaufsliste
(39 fehlende → 39 Einträge, keine Dubletten), Dashboard per Strategie mit allen Ansichten, Entnahme-Kachel mit
Rückgängig, Fach-Filter, Scanner von Hand (Regal-Code, unbekannter Barcode → Zuordnen → Einlagern),
zxing-Rückfall erkennt QR, WASM vom eigenen Server, keine Anfragen nach außen außer Open Food Facts.

## Offen
- Repo öffentlich auf GitHub (KB, 2026-11-22), Lizenz MIT, 3D-Modell öffentlich. PR #1 `v1-integration` → `main`:
  Merge mit Freigabe KB; HACS-Lizenzprüfung wird erst nach dem Merge grün (GitHub erkennt die Lizenz nur auf `main`).
- KB, später (2026-11-22 vertagt): Gerät an der Kellertür. a) altes Fire nur für Entnahme-Kacheln, b) eigenes
  ELC SMT101 privat gekauft, c) Pilot-Panel der Firma (abgeraten: Firmengerät; Raum-Panel-App ist Firmencode mit
  Kamera aus). Vorschlag: Wandgerät nur Entnahme, Scannen beim Einräumen mit den Handys (Rückkamera, https).
  Auf Android ohne Google-Dienste fehlt `BarcodeDetector` evtl., dann zxing-Rückfall; am Gerät ungeprüft.
- KB: Kellertablet-Benutzer in HA mit „nur lokal anmelden“ (HA über Cloudflare erreichbar).
- Nicht geprüft: Dialog „Neues Dashboard“ → Community-Dashboards (Bildschirm im Test nicht verfügbar;
  Dashboard per gleicher WebSocket-API angelegt), Druck der Etiketten, Kamera am echten Gerät.
- Später möglich: To-do-Liste „bald verbrauchen“, Diagnose-Download, Produkt-QR-Etiketten.
