# Lagerbuch Vorratskeller: Grocy + Home Assistant

So funktioniert es im Alltag:
- **Einräumen:** Handy → Home-Assistant-App → Grocy in der Seitenleiste → „Einkauf“. Dort das QR-Etikett am Fach scannen oder den Barcode auf der Packung, Menge und Haltbarkeitsdatum eintragen.
- **Entnehmen:** Am Tablet an der Kellertür auf den Knopf des Produkts tippen. Jeder Tipp zählt 1 Packung ab.
- **Nachkaufen:** Fällt ein Produkt unter das 14-Tage-Soll, steht es innerhalb von 15 Minuten auf der normalen Einkaufsliste in Home Assistant, mit dem Zusatz „(Vorrat)“.
- **Verbrauchen:** Samstags um 10 Uhr kommt eine Nachricht, was in den nächsten 30 Tagen abläuft.

## Dateien
| Datei | Zweck |
|---|---|
| `grocy_import.py` | legt die 57 Posten der Checkliste in Grocy an, mit Lagerort, Soll und üblicher Haltbarkeit |
| `produkte-checkliste.json` | die Daten dazu, entnommen aus der Checkliste |
| `vorrat.yaml` | Home-Assistant-Paket: Sensor, Knopf-Befehl, zwei Automationen |
| nach dem Import: `etiketten.html` | QR-Etiketten je Produkt zum Ausdrucken |
| nach dem Import: `dashboard-vorrat.yaml` | Tablet-Ansicht mit einem Knopf je Produkt |

## Einrichtung (etwa 1–2 Stunden)

1. **Grocy installieren.** In Home Assistant: Einstellungen → Add-ons → Add-on-Store → „Grocy“.
   - Optionen: `culture: de` und `currency: EUR`. Unter `features` nur `stock`, `shoppinglist` und `recipes` auf `true` lassen.
   - `grocy_ingress_user: familie` eintragen. Alle, die über die Home-Assistant-App kommen, sind dann in Grocy dieser eine Benutzer.
   - Add-on starten und „In Seitenleiste anzeigen“ einschalten.
2. **Benutzer anlegen.** In Grocy einen Benutzer „familie“ anlegen. Den Benutzer „admin“ mit einem neuen Passwort versehen und das Passwort in Bitwarden speichern.
3. **API-Schlüssel erzeugen.** In Grocy: Zahnrad oben rechts → „API-Schlüssel verwalten“ → neuen Schlüssel anlegen.
   - In Home Assistant in `/config/secrets.yaml` eintragen: `grocy_api_key: "…"`.
   - Den Schlüssel zusätzlich in Bitwarden ablegen und sonst nirgends speichern.
4. **Checkliste importieren.** Im Grocy-Add-on unter Netzwerk *vorübergehend* Port 80 auf 9192 legen. Dann auf dem Mac:
   ```
   export GROCY_URL=http://homeassistant.local:9192
   export GROCY_API_KEY=…            # nicht in eine Datei schreiben
   python3 grocy_import.py           # Probelauf
   python3 grocy_import.py --apply   # legt an; ein zweiter Lauf ändert nichts
   ```
   Danach den Port wieder entfernen.
5. **Paket einbinden.** `vorrat.yaml` nach `/config/packages/` legen. In `configuration.yaml` einmalig eintragen:
   ```
   homeassistant:
     packages: !include_dir_named packages
   ```
   Dann unter Entwicklerwerkzeuge → „Konfiguration prüfen“ und Home Assistant neu starten.
   - Beim ersten Start fehlt alles, deshalb kommen alle 57 Posten auf die Einkaufsliste. Das ist die Aufbau-Liste. Die Checkliste empfiehlt, sie auf vier Einkäufe zu verteilen.
6. **Tablet einrichten.** In Home Assistant ein neues Dashboard „Vorratskeller“ anlegen. Über die drei Punkte den Raw-Konfigurationseditor öffnen und den Inhalt von `dashboard-vorrat.yaml` einfügen.
   - Auf dem Fire-Tablet die App „Home Assistant“ aus dem Amazon Appstore installieren. Gibt es sie für das Modell nicht, den Silk-Browser nehmen.
   - Mit einem eigenen Benutzer „kellertablet“ anmelden, ohne Admin-Rechte. Dashboard öffnen, Bildschirm-Timeout lang einstellen, Wandhalterung und Ladekabel anbringen.
7. **Etiketten.** `etiketten.html` bei 100 % ausdrucken, ausschneiden und an die Fächer kleben. Feuchtigkeitsfeste Etiketten oder Laminierfolie nehmen, im Keller ist es feucht.

## Abnahme: woran man sieht, dass es läuft
- [ ] Tablet: Ein Tipp auf „H-Milch“ senkt den Bestand in Grocy um 1. Prüfen unter Grocy → Bestandsübersicht.
- [ ] `sensor.vorrat_status` zeigt die Zahl fehlender Produkte. Prüfen unter Entwicklerwerkzeuge → Zustände.
- [ ] Ein Produkt unter das Soll bringen: Nach höchstens 15 Minuten steht es einmal auf der Einkaufsliste, nicht doppelt.
- [ ] Mit dem Handy über die Home-Assistant-App in Grocy unter „Einkauf“ ein QR-Etikett scannen: Das richtige Produkt erscheint.
- [ ] Automation „Vorrat: Diese Woche verbrauchen“ von Hand ausführen: Die Nachricht kommt auf dem Handy an.

## Noch unbestätigt, beim Einrichten prüfen
- **Interne Adresse:** Home Assistant erreicht das Add-on intern unter `http://a0d7b954-grocy`. Klappt das nicht, Port 80 auf 9192 legen und in `vorrat.yaml` `http://homeassistant.local:9192` eintragen.
- **Kamera-Scanner auf den Handys:** Er braucht eine verschlüsselte Verbindung (https). Über die Cloudflare-Adresse ist das gegeben. Die Home-Assistant-App wechselt im heimischen WLAN aber auf die interne Adresse `http://…`, und dann blockiert der Browser die Kamera. Abhilfe: In der App unter Einstellungen → Companion-App → Server die interne Adresse leer lassen, damit sie immer über https geht. Wenn Cloudflare Access (Zero Trust) vor Home Assistant liegt, prüfen, ob die App damit zurechtkommt.
- **Fire-Tablet:** Ob die Home-Assistant-App für die Fire-OS-Version des alten Tablets angeboten wird, ist offen.
- **Haltbarkeiten:** Die Werte sind übliche Angaben (Monate × 30). Beim Einräumen gilt das Datum auf der Packung.

## Sicherheit (Home Assistant ist über Cloudflare von außen erreichbar)
- Grocy läuft nur über Home Assistant (Ingress) und damit hinter dessen Anmeldung. Den Port des Add-ons nie in den Cloudflare-Tunnel aufnehmen; der Port 9192 für den Import gilt nur im Heimnetz und wird danach wieder entfernt.
- **Benutzer „kellertablet“:** In Home Assistant unter Einstellungen → Personen → Benutzer die Option „Kann sich nur aus dem lokalen Netzwerk anmelden“ einschalten. Wird das Tablet gestohlen, lässt sich seine Anmeldung dann nicht über Cloudflare von außen nutzen. Auch ohne Admin-Rechte kann ein Home-Assistant-Benutzer alle Geräte schalten.
- Auf dem Tablet als Adresse die interne Adresse eintragen (`http://homeassistant.local:8123`), nicht die Cloudflare-Adresse.
- Der API-Schlüssel steht nur in `secrets.yaml` und in Bitwarden.
- Das Tablet hat einen eigenen Benutzer ohne Admin-Rechte.

Grundlage: Grocy v4.7.1 (Quellcode, `grocy.openapi.json`), Grocy-Add-on `hassio-addons/app-grocy` (`config.yaml`, `DOCS.md`), Home-Assistant-Doku zu To-do-Listen (`todo.add_item`, `todo.get_items`).
Getestet: Import gegen einen nachgebauten Grocy-Server, der die Pflichtfelder aus der Grocy-Datenbank prüft, inklusive Wiederholungslauf. YAML-Syntax und alle Vorlagen mit Beispieldaten geprüft. Ein Test gegen eine echte Installation steht noch aus.
