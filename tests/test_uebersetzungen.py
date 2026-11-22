"""Prüfungen, die sonst erst hassfest in CI meldet: Übersetzungen und services.yaml."""

from __future__ import annotations

import json
from pathlib import Path
import re

import yaml

BASIS = Path(__file__).parent.parent / "custom_components" / "vorratskeller"
SCHLUESSEL = re.compile(r"^(?![-_])[a-z0-9-_]+(?<![-_])$")


def _schluessel(daten: object, pfad: str = "") -> list[str]:
    if not isinstance(daten, dict):
        return []
    fehler = [f"{pfad}.{k}" for k in daten if not SCHLUESSEL.match(k)]
    for k, v in daten.items():
        fehler += _schluessel(v, f"{pfad}.{k}")
    return fehler


def test_schluessel_gueltig() -> None:
    """Schlüssel wie hassfest: [a-z0-9-_]+, nicht leer, ohne - oder _ am Rand."""
    for datei in (BASIS / "translations").glob("*.json"):
        assert _schluessel(json.loads(datei.read_text(encoding="utf-8"))) == [], datei.name


def test_sprachen_gleich() -> None:
    def flach(d: object, p: str = "") -> set[str]:
        if not isinstance(d, dict):
            return {p}
        return set().union(*(flach(v, f"{p}.{k}") for k, v in d.items()))

    de = json.loads((BASIS / "translations" / "de.json").read_text(encoding="utf-8"))
    en = json.loads((BASIS / "translations" / "en.json").read_text(encoding="utf-8"))
    assert flach(de) == flach(en)


def test_dienste_uebersetzt() -> None:
    """Jeder Dienst und jedes Feld aus services.yaml ist übersetzt, jede Auswahl hat Optionen."""
    dienste = yaml.safe_load((BASIS / "services.yaml").read_text(encoding="utf-8"))
    for sprache in ("de", "en"):
        t = json.loads((BASIS / "translations" / f"{sprache}.json").read_text(encoding="utf-8"))
        for name, dienst in dienste.items():
            assert name in t["services"], (sprache, name)
            for feld, spec in (dienst or {}).get("fields", {}).items():
                assert feld in t["services"][name]["fields"], (sprache, name, feld)
                auswahl = (spec.get("selector") or {}).get("select") or {}
                if key := auswahl.get("translation_key"):
                    optionen = t["selector"][key]["options"]
                    assert set(auswahl["options"]) <= set(optionen), (sprache, key)
