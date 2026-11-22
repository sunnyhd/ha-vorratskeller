"""Erstbefüllung aus der Checkliste (14-Tage-Vorrat für 4 Personen nach BLE und BBK).

Format von ``data/checkliste.json``: Liste von Gruppen
``[Gruppe, Ziel, Einheit, Regal, Items]``,
Items ``[Produkt, Hinweis, Anzahl, Packung, Menge, MHD-Monate]``.
``Ziel`` und ``Menge`` gelten für 4 Personen und 14 Tage in ``Einheit`` (kg oder l).
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from .const import CHECKLISTE_PERSONEN, CHECKLISTE_TAGE, GRUPPEN_ICONS
from .lager import Gruppe, Lager, Produkt, make_id

CHECKLISTE_PATH = Path(__file__).parent / "data" / "checkliste.json"


def load_checkliste() -> list[list[Any]]:
    """Lies die Checkliste (blockierend, im Executor aufrufen)."""
    return json.loads(CHECKLISTE_PATH.read_text(encoding="utf-8"))


def build_lager(checkliste: list[list[Any]], personen: int, tage: int) -> Lager:
    """Baue das Lagerbuch aus der Checkliste.

    Soll und Ziel der Lebensmittelgruppen (Ziel > 0) werden auf Personen und Tage
    umgerechnet und auf ganze Packungen aufgerundet; Ausstattung bleibt wie gelistet.
    """
    faktor_personen = personen / CHECKLISTE_PERSONEN
    faktor_soll = faktor_personen * tage / CHECKLISTE_TAGE
    lager = Lager()
    for gruppe_name, ziel, einheit, regal, items in checkliste:
        gruppe_id = make_id(gruppe_name)
        lager.gruppen[gruppe_id] = Gruppe(
            id=gruppe_id,
            name=gruppe_name,
            ziel=round(float(ziel) * faktor_personen, 3),
            einheit=einheit,
            tage=CHECKLISTE_TAGE,
            icon=GRUPPEN_ICONS.get(gruppe_id),
        )
        lebensmittel = float(ziel) > 0
        for name, hinweis, anzahl, packung, menge, mhd_monate in items:
            anzahl = float(anzahl)
            soll = anzahl
            if lebensmittel and anzahl > 0:
                soll = float(math.ceil(anzahl * faktor_soll - 1e-9))
            produkt_id = make_id(name)
            n = 2
            while produkt_id in lager.produkte:
                produkt_id = f"{make_id(name)}-{n}"
                n += 1
            lager.produkte[produkt_id] = Produkt(
                id=produkt_id,
                name=name,
                gruppe=gruppe_id,
                fach=regal,
                packung=packung,
                packungsmenge=round(float(menge) / anzahl, 4) if anzahl > 0 else 0.0,
                soll=soll,
                haltbarkeit_monate=int(mhd_monate),
                hinweis=hinweis,
            )
    return lager
