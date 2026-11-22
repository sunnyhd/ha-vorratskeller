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
- Grocy-Variante ist verworfen, bleibt als Referenz in `docs/grundlagen/grocy-variante-*`.

## Fachliche Grundlage (Quellen)
- Mengen: BLE-Vorratskalkulator, Tageswerte je Person (2.200 kcal), 14 Tage × 4 Personen; BBK empfiehlt 10 Tage.
  Produkte, Soll, Fach, Haltbarkeit: `docs/grundlagen/produkte-checkliste.json`
  (Gruppe, Ziel, Einheit, Regal, Items `[Produkt, Hinweis, Anzahl, Packung, Menge, MHD-Monate]`).
- Checkliste und 3D-Modell des Kellers: `docs/grundlagen/vorratskammer-14-tage.html`, `vorratskeller-3d.html`
  (veröffentlicht: claude.ai/artifact/3WgvR3hecagusgoFYyfo2h und claude.ai/artifact/4RFAwwCXsQwTdwb6KDERpB).
- Raum 3 × 4 m, Stahlregal links 2,4 m und rechts 1,6 m (je 5 Böden, 40 cm tief), weißes Regal 1 m (4 Fächer);
  Wasser in 13 Mehrweg-Glaskästen neben dem linken Regal. Feuchte Rückwand (Hygrometer, Fleck prüfen).

## Geplanter Umfang (Version 1)
1. Datenmodell: Produkte (Name, Gruppe, Fach, Einheit, Soll, Standard-Haltbarkeit, EANs), Chargen (Menge, MHD,
   eingelagert am), Journal. Erstbefüllung aus `produkte-checkliste.json`.
2. Services: `einlagern`, `entnehmen` (FIFO, älteste zuerst), `barcode_zuordnen`, `inventur`.
3. Entitäten: Sensor je Produkt (Bestand, nächstes MHD, Attribut Soll), Sammelsensoren (fehlt, läuft ab, „reicht X Tage“),
   To-do-Liste „Vorrat bald verbrauchen“ optional.
4. Automatik: unter Soll → `todo.add_item` auf konfigurierbare Einkaufsliste (ohne Dubletten); wöchentliche
   Push-Nachricht über konfigurierbaren `notify`-Dienst.
5. Frontend: Karte mit Kamera-Scanner (BarcodeDetector, Rückfall zxing), Entnahme-Kacheln fürs Kellertablet,
   Dashboard-Strategie, die das ganze Dashboard aus den Entitäten baut. Regal-QR-Etiketten zum Drucken.
6. Open Food Facts nur bei unbekanntem EAN, nur die Nummer.

## Prüfen (unabhängiger Beleg)
HA lokal im venv (`pip install homeassistant`) mit der Integration starten; pytest mit
`pytest-homeassistant-custom-component`; `hassfest` und HACS-Validierung als GitHub Action; Abnahme am Kellertablet durch KB.

## Offen
- GitHub-Repo `sunnyhd/ha-vorratskeller` (öffentlich) anlegen: Freigabe KB.
- Fire-Tablet: Modell und Fire-OS-Version (für HA-App „minimal“ per F-Droid/GitHub, mind. Android 6).
- Kellertablet-Benutzer in HA mit „nur lokal anmelden“ (HA über Cloudflare erreichbar).
