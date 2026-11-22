"""Texte, die nicht über die Übersetzungen von HA laufen (Nachricht, Einkaufsliste, Einheiten).

Sprache ist die Systemsprache von Home Assistant: Deutsch bei ``de``, sonst Englisch.
"""

from __future__ import annotations

from homeassistant.core import HomeAssistant

TEXTE: dict[str, dict[str, str]] = {
    "de": {
        "einkauf_suffix": " (Vorrat)",
        "einkauf_beschreibung": "Es fehlen {fehlt} {packung}",
        "bericht_titel": "Vorratskeller: Wochenbericht",
        "bericht_ablaufend": "Bald verbrauchen:",
        "bericht_abgelaufen": "seit {tage} Tagen abgelaufen",
        "bericht_heute": "heute",
        "bericht_in_tagen": "in {tage} Tagen",
        "bericht_unter_soll": "Unter Soll: {anzahl} Produkte",
        "bericht_alles_gut": "Alles im Soll, nichts läuft in den nächsten Wochen ab.",
        # Einheiten übersetzt HA nur auf Englisch, daher hier nach Systemsprache
        "einheit_produkte": "Produkte",
        "einheit_chargen": "Chargen",
    },
    "en": {
        "einkauf_suffix": " (pantry)",
        "einkauf_beschreibung": "{fehlt} {packung} missing",
        "bericht_titel": "Pantry: weekly report",
        "bericht_ablaufend": "Use soon:",
        "bericht_abgelaufen": "expired {tage} days ago",
        "bericht_heute": "today",
        "bericht_in_tagen": "in {tage} days",
        "bericht_unter_soll": "Below target: {anzahl} products",
        "bericht_alles_gut": "Everything at target, nothing expires in the coming weeks.",
        "einheit_produkte": "products",
        "einheit_chargen": "batches",
    },
}


def sprache(hass: HomeAssistant) -> str:
    """``de`` oder ``en`` nach der Systemsprache."""
    return "de" if (hass.config.language or "").lower().startswith("de") else "en"


def text(hass: HomeAssistant, key: str, **werte: object) -> str:
    """Text in der Systemsprache, Platzhalter mit ``werte`` gefüllt."""
    return TEXTE[sprache(hass)][key].format(**werte)
