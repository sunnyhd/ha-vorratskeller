# Vorratskeller für Home Assistant

Lagerbuch für den Vorratskeller als Integration für Home Assistant: was ist da, was fehlt,
was läuft bald ab. Mit Chargen und Mindesthaltbarkeitsdatum (MHD), Entnahme nach FIFO,
Kamera-Scanner, Regal-Etiketten, Einkaufsliste und Wochenbericht als Push-Nachricht.

Die Erstbefüllung ist ein 14-Tage-Notvorrat für vier Personen nach den Empfehlungen von
BLE (Vorratskalkulator) und BBK; Soll und Ziele werden beim Einrichten auf Personen und Tage
umgerechnet.

## Installation

1. Ab Home Assistant 2026.11: Einstellungen → Marketplace → Menü oben rechts → *Add from link*,
   `sunnyhd/ha-vorratskeller` eintragen, Typ *Integration*.
   Bis 2026.10: HACS → Menü → Benutzerdefinierte Repositories →
   `https://github.com/sunnyhd/ha-vorratskeller`, Kategorie *Integration*.
2. „Vorratskeller“ installieren und Home Assistant neu starten.
3. Einstellungen → Geräte & Dienste → Integration hinzufügen → **Vorratskeller**.
   Checkliste übernehmen, Personen und Tage angeben.
4. Dashboard: Einstellungen → Dashboards → Dashboard hinzufügen → **Vorratskeller**
   (unter den Community-Dashboards). Alternativ ein leeres Dashboard anlegen und im
   Raw-Konfigurationseditor eintragen:

   ```yaml
   strategy:
     type: custom:vorratskeller
   ```

5. Optionen der Integration: Einkaufsliste (`todo`-Entität), Ziel der Push-Nachricht
   (z. B. `notify.mobile_app_handy`), Wochentag und Uhrzeit des Berichts, Vorlauf für
   „läuft bald ab“, Open Food Facts an oder aus.

Mindestversion: Home Assistant 2026.10.

## Dashboard

Die Strategie baut das ganze Dashboard aus den Entitäten, ähnlich wie das Energie-Dashboard:

| Ansicht | Inhalt |
|---|---|
| Übersicht | Vorratsstand, Reichweite, Produkte unter Soll, bald ablaufende Chargen, Verlauf |
| Entnehmen | eine Kachel je Produkt, nach Fach filterbar. Tippen nimmt eine Packung heraus (mit „Rückgängig“), **+** lagert eine ein |
| Scanner | Kamera oder Eingabe von Hand: Barcode (EAN) oder Regal-Code |
| Bestand | alle Produkte nach Gruppen |
| Einkauf | was bis zum Soll fehlt |
| Etiketten | ein QR-Code je Fach zum Ausdrucken |

Die Karte gibt es auch einzeln: `type: custom:vorratskeller-card` mit
`modus: entnahme | scanner | fehlend | ablaufend | etiketten` und optional `fach: <kennung>`.

### Scanner

- Barcode bekannt: Menge und MHD eingeben, einlagern oder entnehmen.
- Barcode unbekannt: einem vorhandenen Produkt zuordnen oder neues Produkt anlegen.
  Den Namensvorschlag holt die Integration bei Open Food Facts; dorthin geht **nur die
  Barcode-Nummer**, ohne Kennung des Hauses. In den Optionen abschaltbar.
- Regal-Code (`VK:F:<fach>`): zeigt die Produkte dieses Fachs als Entnahme-Kacheln.
- Die Kamera braucht eine verschlüsselte Verbindung (https) oder `localhost`.
  Ohne Kamera geht die Eingabe von Hand.
- Erkennung: `BarcodeDetector` des Browsers, sonst zxing-wasm. Die WebAssembly-Datei liefert
  die Integration selbst aus; es wird nichts von einem CDN geladen.

## Entitäten

| Entität | Zustand | Attribute |
|---|---|---|
| `sensor.vorratskeller_<produkt>` | Bestand in Packungen | Soll, Fehlmenge, nächstes MHD, Tage bis MHD, Chargen, Fach, Barcodes |
| `sensor.vorratskeller_fehlende_produkte` | Anzahl unter Soll | Liste mit Fehlmengen |
| `sensor.vorratskeller_bald_ablaufend` | Anzahl Chargen bis zum Vorlauf (auch abgelaufene) | Chargen mit Tagen bis MHD |
| `sensor.vorratskeller_reichweite` | Tage, die der Vorrat reicht (knappste Gruppe) | Tage je Gruppe, Engpass |
| `sensor.vorratskeller_vorratsstand` | Anteil des Solls in % | |

Reichweite je Gruppe = vorhandene Menge (Packungen × Packungsmenge in kg oder l) ÷
(Ziel der Gruppe ÷ 14 Tage). Gezählt werden nur Gruppen mit Ziel (Lebensmittel und Getränke).

## Dienste

| Dienst | Zweck |
|---|---|
| `vorratskeller.einlagern` | Produkt (Kennung, Entität oder Barcode), Menge, MHD. Ohne MHD: heute + übliche Haltbarkeit |
| `vorratskeller.entnehmen` | nach FIFO: früheste MHD zuerst, Chargen ohne MHD zuletzt. Reicht der Bestand nicht, ändert sich nichts |
| `vorratskeller.inventur` | gezählten Bestand setzen |
| `vorratskeller.barcode_zuordnen` | Barcode einem Produkt zuordnen (wird bei einem anderen Produkt entfernt) |
| `vorratskeller.barcode_suchen` | Produkt zum Barcode, sonst Vorschlag von Open Food Facts (Antwort) |
| `vorratskeller.produkt_anlegen` / `produkt_aendern` / `produkt_loeschen` | Stammdaten |
| `vorratskeller.einkaufsliste_abgleichen` | fehlende Produkte auf die Einkaufsliste |
| `vorratskeller.bericht_senden` | Wochenbericht sofort senden |

Alle Änderungen landen mit Zeit und Benutzer im Journal.

## Automatik

- **Einkaufsliste:** Fällt ein Produkt unter Soll, kommt es als „Name (Vorrat)“ auf die
  gewählte Liste. Ein offener Eintrag mit gleichem Text verhindert Dubletten; ist er
  abgehakt und das Produkt fehlt erneut, kommt es wieder auf die Liste.
- **Wochenbericht:** am gewählten Tag zur gewählten Uhrzeit, was bald abläuft und wie viele
  Produkte unter Soll sind.

## Daten

Das Lagerbuch liegt in `.storage/vorratskeller` und ist damit in jedem Backup von Home
Assistant enthalten. Beim Entfernen der Integration bleibt es erhalten; beim erneuten
Einrichten wird es wieder geladen.

## Entwicklung

```bash
uv venv --python 3.14 .venv
uv pip install --python .venv/bin/python pytest-homeassistant-custom-component==0.13.375 ruff
.venv/bin/python -m pytest tests -q
node --test tests/frontend/*.test.mjs
```

Home Assistant lokal: `config/configuration.yaml` anlegen (gitignored), `custom_components`
dorthin verlinken, `.venv/bin/hass -c config`. Fremdbibliotheken unter
`custom_components/vorratskeller/frontend/vendor` baut `scripts/vendor.sh`;
Lizenzen in `frontend/vendor/LICENSES.md`.

## Lizenz

MIT, siehe `LICENSE`. Mitgelieferte Bibliotheken: MIT (barcode-detector, zxing-wasm,
qrcode-generator) und Apache 2.0 (zxing-cpp).
