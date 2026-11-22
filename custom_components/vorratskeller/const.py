"""Konstanten der Integration Vorratskeller."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "vorratskeller"
NAME: Final = "Vorratskeller"

STORAGE_KEY: Final = DOMAIN
STORAGE_VERSION: Final = 1
STORAGE_MINOR_VERSION: Final = 1

# Statische Dateien der Karte und der Dashboard-Strategie
STATIC_URL: Final = "/vorratskeller_static"
FRONTEND_SCRIPT: Final = "vorratskeller.js"

# Daten der Einrichtung (nur beim ersten Anlegen benutzt)
CONF_CHECKLISTE: Final = "checkliste"
CONF_PERSONEN: Final = "personen"
CONF_TAGE: Final = "tage"

# Optionen
CONF_EINKAUFSLISTE: Final = "einkaufsliste"
CONF_NOTIFY: Final = "notify_dienst"
CONF_WOCHENTAG: Final = "wochentag"
CONF_UHRZEIT: Final = "uhrzeit"
CONF_WARN_TAGE: Final = "warn_tage"
CONF_OPEN_FOOD_FACTS: Final = "open_food_facts"

DEFAULT_PERSONEN: Final = 4
DEFAULT_TAGE: Final = 14
DEFAULT_WARN_TAGE: Final = 30
DEFAULT_WOCHENTAG: Final = "sat"
DEFAULT_UHRZEIT: Final = "10:00:00"
WOCHENTAGE: Final = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

# Grundlage der Checkliste: 4 Personen, 14 Tage
CHECKLISTE_PERSONEN: Final = 4
CHECKLISTE_TAGE: Final = 14

# Kennzeichen der Einträge auf der Einkaufsliste
EINKAUF_SUFFIX: Final = " (Vorrat)"

# Höchstzahl der Journaleinträge im Speicher
JOURNAL_MAX: Final = 2000

# Signale
SIGNAL_UPDATED: Final = f"{DOMAIN}_updated"
SIGNAL_PRODUCT_ADDED: Final = f"{DOMAIN}_product_added"
SIGNAL_PRODUCT_REMOVED: Final = f"{DOMAIN}_product_removed"

# Dienste
SERVICE_EINLAGERN: Final = "einlagern"
SERVICE_ENTNEHMEN: Final = "entnehmen"
SERVICE_INVENTUR: Final = "inventur"
SERVICE_BARCODE_ZUORDNEN: Final = "barcode_zuordnen"
SERVICE_BARCODE_SUCHEN: Final = "barcode_suchen"
SERVICE_PRODUKT_ANLEGEN: Final = "produkt_anlegen"
SERVICE_PRODUKT_AENDERN: Final = "produkt_aendern"
SERVICE_PRODUKT_LOESCHEN: Final = "produkt_loeschen"
SERVICE_BERICHT_SENDEN: Final = "bericht_senden"
SERVICE_EINKAUFSLISTE_ABGLEICHEN: Final = "einkaufsliste_abgleichen"

ATTR_PRODUKT: Final = "produkt"
ATTR_BARCODE: Final = "barcode"
ATTR_MENGE: Final = "menge"
ATTR_MHD: Final = "mhd"
ATTR_OHNE_MHD: Final = "ohne_mhd"
ATTR_NAME: Final = "name"
ATTR_GRUPPE: Final = "gruppe"
ATTR_FACH: Final = "fach"
ATTR_PACKUNG: Final = "packung"
ATTR_PACKUNGSMENGE: Final = "packungsmenge"
ATTR_SOLL: Final = "soll"
ATTR_HALTBARKEIT: Final = "haltbarkeit_monate"
ATTR_HINWEIS: Final = "hinweis"

OPEN_FOOD_FACTS_URL: Final = "https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
OPEN_FOOD_FACTS_FIELDS: Final = "product_name,product_name_de,brands,quantity"
USER_AGENT: Final = (
    "HomeAssistant-Vorratskeller/{version} (https://github.com/sunnyhd/ha-vorratskeller)"
)

# Symbole je Gruppe (Material Design Icons wie in HA)
GRUPPEN_ICONS: Final = {
    "getraenke": "mdi:bottle-wine-outline",
    "getreide-kartoffeln-nudeln-reis": "mdi:barley",
    "gemuese-huelsenfruechte": "mdi:carrot",
    "obst-nuesse": "mdi:food-apple-outline",
    "milch-milchprodukte": "mdi:cheese",
    "fisch-fleisch-eier": "mdi:fish",
    "fette-oele": "mdi:bottle-tonic-outline",
    "sonstiges": "mdi:shaker-outline",
    "hygiene": "mdi:paper-roll-outline",
    "hausapotheke-bbk": "mdi:medical-bag",
    "strom-licht-kochen-bbk": "mdi:flashlight",
    "fuer-den-raum": "mdi:toolbox-outline",
}
DEFAULT_ICON: Final = "mdi:package-variant-closed"
