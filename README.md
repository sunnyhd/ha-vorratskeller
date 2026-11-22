<p align="center">
  <img src="custom_components/vorratskeller/brand/icon@2x.png" width="112" alt="">
</p>

<h1 align="center">Vorratskeller für Home Assistant</h1>

<p align="center">
  <b>Was ist da, was fehlt, was läuft bald ab.</b><br>
  Lagerbuch für den Vorratskeller, ganz in Home Assistant: ohne Zusatzserver, ohne Cloud-Konto.
</p>

<p align="center">
  <b>Deutsch</b> · <a href="README.en.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/sunnyhd/ha-vorratskeller/actions/workflows/validate.yml"><img src="https://github.com/sunnyhd/ha-vorratskeller/actions/workflows/validate.yml/badge.svg" alt="Prüfungen"></a>
  <img src="https://img.shields.io/badge/Home%20Assistant-2026.10%2B-18BCF2?logo=homeassistant&logoColor=white" alt="Home Assistant 2026.10+">
  <img src="https://img.shields.io/badge/Marketplace-Integration-41BDF5" alt="Marketplace">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/sunnyhd/ha-vorratskeller" alt="Lizenz MIT"></a>
</p>

![Übersicht des Vorratskeller-Dashboards](docs/bilder/uebersicht.png)

## Was es kann

- 📦 **Lagerbuch mit Chargen:** Jede Einlagerung ist eine Charge mit Mindesthaltbarkeitsdatum (MHD).
  Entnommen wird nach FIFO: was zuerst abläuft, geht zuerst raus.
- 🎯 **Soll je Produkt:** Startet mit einem 14-Tage-Notvorrat nach den Empfehlungen von BLE und BBK,
  umgerechnet auf Personen und Tage. Jedes Soll lässt sich ändern.
- 👆 **Entnehmen mit einem Tipp:** eine Kachel je Produkt, nach Regalfach filterbar, mit „Rückgängig“.
- 📷 **Kamera-Scanner:** EAN-Barcodes auf der Packung und QR-Etiketten am Regal. Unbekannte Barcodes
  schlägt Open Food Facts vor; dorthin geht nur die Nummer.
- 🛒 **Einkaufsliste:** Was unter Soll fällt, landet automatisch auf einer To-do-Liste von Home Assistant.
- 🔔 **Wochenbericht** als Push-Nachricht: was bald abläuft und was fehlt.
- 📊 **Eigenes Dashboard**, das sich selbst aufbaut, wie das Energie-Dashboard.
- 🏷️ **Regal-Etiketten** mit QR-Code zum Ausdrucken.
- 🌐 **Deutsch und Englisch:** Die Oberfläche folgt der Sprache des Benutzers; Produktnamen, Einheiten
  und Nachrichten folgen der Systemsprache von Home Assistant.

<table>
  <tr>
    <td width="62%"><img src="docs/bilder/entnehmen.png" alt="Entnehmen: eine Kachel je Produkt"></td>
    <td><img src="docs/bilder/entnehmen-handy.png" alt="Entnehmen auf dem Handy, dunkles Design"></td>
  </tr>
  <tr>
    <td align="center"><sub>Entnehmen: Bestand / Soll, nächstes MHD, <b>+</b> lagert ein</sub></td>
    <td align="center"><sub>Auf dem Handy, dunkles Design</sub></td>
  </tr>
</table>

![Regal-Ansicht: Fächer als Regal, Produkte als Gläser, Dosen und Flaschen](docs/bilder/regal.png)

![Panel für das Tablet an der Kellertür](docs/bilder/panel.png)

## So greift es ineinander

```mermaid
flowchart LR
  scan["📷 Scanner<br>EAN oder Regal-QR"] --> buch[("Lagerbuch<br>Chargen, MHD, Soll")]
  kachel["👆 Kachel<br>Entnehmen"] --> buch
  dienst["⚙️ Dienste<br>Automationen"] --> buch
  buch --> sens["Sensoren<br>je Produkt + Übersicht"]
  sens --> dash["📊 Dashboard"]
  buch -->|unter Soll| liste["🛒 Einkaufsliste"]
  buch -->|wöchentlich| push["🔔 Push-Nachricht"]
```

## Installation

1. **Repository hinzufügen**
   - Ab Home Assistant 2026.11: *Einstellungen → Marketplace →* Menü oben rechts *→ Add from link*,
     `sunnyhd/ha-vorratskeller` eintragen, Typ *Integration*.
   - Bis 2026.10: *HACS →* Menü *→ Benutzerdefinierte Repositories →*
     `https://github.com/sunnyhd/ha-vorratskeller`, Kategorie *Integration*.
2. **Vorratskeller** installieren und Home Assistant neu starten.
3. *Einstellungen → Geräte & Dienste → Integration hinzufügen →* **Vorratskeller**.
   Checkliste übernehmen, Personen und Tage angeben.
4. **Dashboard:** *Einstellungen → Dashboards → Dashboard hinzufügen →* **Vorratskeller**
   (unter den Community-Dashboards). Titel und Symbol sind vorbelegt, nur noch „Erstellen“. Alternativ ein leeres Dashboard anlegen und im
   Raw-Konfigurationseditor eintragen:

   ```yaml
   strategy:
     type: custom:vorratskeller
   ```

5. **Optionen** der Integration: Einkaufsliste (`todo`-Entität), Ziel der Push-Nachricht
   (z. B. `notify.mobile_app_handy`), Wochentag und Uhrzeit des Berichts, Vorlauf für
   „läuft bald ab“, Open Food Facts an oder aus.

Mindestversion: Home Assistant 2026.10.

## Dashboard

Die Strategie baut das ganze Dashboard aus den Entitäten, ähnlich wie das Energie-Dashboard:

| Ansicht | Inhalt |
|---|---|
| Übersicht | Ring mit Vorratsstand, Reichweite in Tagen, Füllstand je Gruppe, bald ablaufende Chargen, Produkte unter Soll, Verlauf |
| Regal | die Fächer als Regal gezeichnet, jedes Produkt als Glas, Dose, Flasche oder Packung, gefüllt nach Bestand (grün im Soll, orange knapp, rot leer); Tippen nimmt eine Packung heraus |
| Entnehmen | eine Kachel je Produkt, nach Fach filterbar. Tippen nimmt eine Packung heraus (mit „Rückgängig“), **+** lagert eine ein |
| Scanner | Kamera oder Eingabe von Hand: Barcode (EAN) oder Regal-Code |
| Bestand | alle Produkte nach Gruppen |
| Einkauf | was bis zum Soll fehlt |
| Etiketten | ein QR-Code je Fach zum Ausdrucken |
| 3D | der Keller als 3D-Modell, Produkte farbig im Regal; Maße optional in YAML (siehe unten) |
| Panel | für das Tablet an der Kellertür: große Zahlen, was zuerst verbraucht und was eingekauft werden muss, jedes Fach als Feld in der Farbe seines knappsten Produkts; antippen zeigt das Fach |

Die Karte gibt es auch einzeln: `type: custom:vorratskeller-card` mit
`modus: kopf | regal | raum | panel | entnahme | scanner | fehlend | ablaufend | etiketten` und optional `fach: <kennung>`.

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

![Regal-Etiketten mit QR-Code je Fach](docs/bilder/etiketten.png)

### 3D-Ansicht

Die Ansicht **3D** stellt die Regale automatisch nebeneinander an die hintere Wand; Böden und Plätze ergeben
sich aus den Fachnamen („Links, dritter Boden“). Wer die Maße seines Raums kennt, gibt sie in der
Dashboard-Konfiguration an (Raw-Konfigurationseditor), in Metern; `x` nach rechts, `z` von der Tür in den Raum,
`drehung: 90` für Regale an einer Seitenwand, `boeden: 0` für Stapel auf dem Boden:

```yaml
strategy:
  type: custom:vorratskeller
  raum: { breite: 3, tiefe: 4, hoehe: 2.25 }
  regale:
    - { name: Links, x: 0.25, z: 2.55, laenge: 2.4, tiefe: 0.4, hoehe: 2.0, boeden: 5, drehung: 90 }
    - { name: Rechts, x: 2.75, z: 2.95, laenge: 1.6, tiefe: 0.4, hoehe: 2.0, boeden: 5, drehung: 90 }
    - { name: Weißes Regal, x: 2.72, z: 1.45, laenge: 1.0, tiefe: 0.45, hoehe: 1.85, boeden: 4, drehung: 90 }
    - { name: Neben dem linken Regal, x: 0.26, z: 0.75, laenge: 1.2, tiefe: 0.42, boeden: 0, drehung: 90 }
```

Antippen wählt ein Produkt; darunter erscheinen Bestand, MHD und die Knöpfe Entnehmen und Einlagern.
Die 3D-Bibliothek (three.js) liefert die Integration selbst aus und lädt sie erst beim Öffnen der Ansicht.

### Etiketten

Die Ansicht **Etiketten** druckt einen QR-Code je Fach auf Etikettenbögen von Avery Zweckform:

| Bogen | Format | Je Blatt | Wofür |
|---|---|---|---|
| L4776 | 99,1 × 42,3 mm, wetterfeste Folie | 12 | Keller und feuchte Räume (empfohlen) |
| 3474 | 70 × 37 mm, Papier | 24 | trockene Räume |
| Normalpapier | 60 × 60 mm | 12 | zum Ausschneiden |

Gebraucht wird ein Etikett je Fach; die Ansicht zeigt Anzahl, Bögen und freie Felder. Beispiel: 10 Fächer
passen auf einen Bogen L4776, 2 Felder bleiben für spätere Fächer. Hat ein Fach sehr viele Produkte (etwa ein
ganzes Regal unter einem Namen), zeigt ein Scan eine lange Liste; nach Böden aufgeteilte Fächer ergeben kürzere
Listen, brauchen aber mehr Etiketten. L4776 gibt es meist nur zu 20 Bögen (240 Etiketten), das reicht für Jahre;
für den Probedruck genügt Normalpapier.

Die Ränder sind mittig auf A4 gerechnet. Zum Ausrichten zuerst mit „Rahmen mitdrucken“ auf Normalpapier drucken,
gegen den Bogen ins Licht halten und Abweichungen mit dem Versatz in mm ausgleichen. „Beginnen bei Feld“
nutzt angebrochene Bögen. Im Druckdialog Skalierung 100 % und keine Ränder wählen.

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

### Beispiel: Warnung, wenn der Vorrat knapp wird

```yaml
automation:
  - alias: Vorrat reicht keine Woche mehr
    triggers:
      - trigger: numeric_state
        entity_id: sensor.vorratskeller_reichweite
        below: 7
    actions:
      - action: notify.mobile_app_handy
        data:
          title: Vorratskeller
          message: >-
            Der Vorrat reicht noch {{ states('sensor.vorratskeller_reichweite') }} Tage,
            knapp ist {{ state_attr('sensor.vorratskeller_reichweite', 'engpass') }}.
```

## Datenschutz

- Alles bleibt in Home Assistant. Kein Konto, kein eigener Server, keine Telemetrie.
- Nach außen geht nur eine Anfrage an Open Food Facts, und nur wenn ein Barcode unbekannt ist:
  die Barcode-Nummer, ohne Cookies und ohne Kennung des Hauses. In den Optionen abschaltbar.
- Die Barcode-Erkennung im Browser lädt nichts aus dem Netz; alle Bibliotheken liefert die
  Integration selbst aus.

## Daten

Das Lagerbuch liegt in `.storage/vorratskeller` und ist damit in jedem Backup von Home
Assistant enthalten. Beim Entfernen der Integration bleibt es erhalten; beim erneuten
Einrichten wird es wieder geladen.

## Entwicklung

```bash
uv venv --python 3.14 .venv
uv pip install --python .venv/bin/python \
  pytest-homeassistant-custom-component==0.13.375 home-assistant-frontend==20260930.5 ruff
.venv/bin/python -m pytest tests -q
node --test tests/frontend/*.test.mjs
```

Home Assistant lokal: `config/configuration.yaml` anlegen (gitignored), `custom_components`
dorthin verlinken, `.venv/bin/hass -c config`. Fremdbibliotheken unter
`custom_components/vorratskeller/frontend/vendor` baut `scripts/vendor.sh`;
Lizenzen in `frontend/vendor/LICENSES.md`.

## Quellen

- BLE: [Vorratskalkulator](https://www.ernaehrungsvorsorge.de/private-vorsorge/notvorrat/vorratskalkulator/)
  und [Lagerung von Lebensmitteln](https://www.ernaehrungsvorsorge.de/private-vorsorge/empfehlungen-tipps/so-koennen-lebensmittel-gelagert-werden)
- BBK: [Ratgeber und Checkliste](https://www.bbk.bund.de/DE/Warnung-Vorsorge/Vorsorge/Ratgeber-Checkliste/ratgeber-checkliste_node.html)
- Produktdaten: [Open Food Facts](https://world.openfoodfacts.org/) (ODbL)

## Lizenz

MIT, siehe [`LICENSE`](LICENSE). Mitgelieferte Bibliotheken: MIT (barcode-detector, zxing-wasm,
qrcode-generator, three.js) und Apache 2.0 (zxing-cpp).
