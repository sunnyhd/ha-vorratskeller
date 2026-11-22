"""Fachlogik ohne Home Assistant: FIFO, Inventur, Reichweite, Erstbefüllung."""

from __future__ import annotations

from datetime import date, datetime

import pytest

from custom_components.vorratskeller.lager import (
    Gruppe,
    Lager,
    LagerError,
    Produkt,
    add_months,
    make_id,
)
from custom_components.vorratskeller.seed import build_lager, load_checkliste

JETZT = datetime(2026, 11, 22, 12, 0)


@pytest.fixture
def lager() -> Lager:
    lager = Lager()
    lager.gruppen["milch"] = Gruppe(id="milch", name="Milch", ziel=14, einheit="l", tage=14)
    lager.produkte["h-milch"] = Produkt(
        id="h-milch",
        name="H-Milch",
        gruppe="milch",
        packung="× 1 l",
        packungsmenge=1,
        soll=14,
        haltbarkeit_monate=3,
    )
    return lager


def test_make_id() -> None:
    assert make_id("Getränke") == "getraenke"
    assert make_id("Zucker, Salz, Jodsalz") == "zucker-salz-jodsalz"
    assert make_id("Hausapotheke (BBK)") == "hausapotheke-bbk"
    assert make_id("Für den Raum") == "fuer-den-raum"
    assert make_id("!!!") == "produkt"


def test_add_months_clamps_day() -> None:
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert add_months(date(2026, 11, 22), 3) == date(2027, 2, 22)
    assert add_months(date(2024, 2, 29), 12) == date(2025, 2, 28)


def test_einlagern_default_mhd(lager: Lager) -> None:
    charge = lager.einlagern("h-milch", 2, None, jetzt=JETZT)
    assert charge.mhd == "2027-02-22"
    assert lager.bestand("h-milch") == 2
    # gleiches MHD am selben Tag landet in derselben Charge
    lager.einlagern("h-milch", 1, None, jetzt=JETZT)
    assert len(lager.chargen) == 1
    assert lager.chargen[0].menge == 3


def test_entnehmen_fifo_earliest_mhd_first(lager: Lager) -> None:
    lager.einlagern("h-milch", 3, date(2027, 3, 1), jetzt=JETZT)
    lager.einlagern("h-milch", 2, date(2026, 12, 15), jetzt=JETZT)
    lager.einlagern("h-milch", 1, None, jetzt=JETZT)  # Standard-MHD 2027-02-22
    entnommen = lager.entnehmen("h-milch", 3, jetzt=JETZT)
    assert entnommen == [
        {"menge": 2, "mhd": "2026-12-15"},
        {"menge": 1, "mhd": "2027-02-22"},
    ]
    assert lager.bestand("h-milch") == 3
    assert [c.mhd for c in lager.chargen_von("h-milch")] == ["2027-03-01"]


def test_entnehmen_without_mhd_last(lager: Lager) -> None:
    lager.produkte["h-milch"].haltbarkeit_monate = 0
    lager.einlagern("h-milch", 1, None, jetzt=JETZT)
    lager.einlagern("h-milch", 1, date(2030, 1, 1), jetzt=JETZT)
    assert lager.entnehmen("h-milch", 1, jetzt=JETZT) == [{"menge": 1, "mhd": "2030-01-01"}]


def test_entnehmen_not_enough_changes_nothing(lager: Lager) -> None:
    lager.einlagern("h-milch", 1, None, jetzt=JETZT)
    with pytest.raises(LagerError) as err:
        lager.entnehmen("h-milch", 2, jetzt=JETZT)
    assert err.value.key == "not_enough_stock"
    assert err.value.placeholders == {"produkt": "H-Milch", "vorhanden": "1", "menge": "2"}
    assert lager.bestand("h-milch") == 1


def test_fractional_amounts_do_not_drift(lager: Lager) -> None:
    for _ in range(10):
        lager.einlagern("h-milch", 0.1, date(2027, 1, 1), jetzt=JETZT)
    assert lager.bestand("h-milch") == 1
    lager.entnehmen("h-milch", 1, jetzt=JETZT)
    assert lager.chargen == []


def test_inventur_up_and_down(lager: Lager) -> None:
    lager.einlagern("h-milch", 5, date(2027, 1, 1), jetzt=JETZT)
    assert lager.inventur("h-milch", 7, date(2027, 6, 1), jetzt=JETZT) == 2
    assert lager.journal[-1]["aktion"] == "inventur"
    assert lager.inventur("h-milch", 3, None, jetzt=JETZT) == -4
    assert lager.journal[-1] == {
        "zeit": "2026-11-22T12:00:00",
        "aktion": "inventur",
        "produkt": "h-milch",
        "menge": -4,
    }
    # FIFO: zuerst vier der fünf älteren (2027-01-01)
    assert [(c.menge, c.mhd) for c in lager.chargen_von("h-milch")] == [
        (1, "2027-01-01"),
        (2, "2027-06-01"),
    ]
    assert lager.inventur("h-milch", 3, None, jetzt=JETZT) == 0


def test_fehlende_ablaufend_reichweite_abdeckung(lager: Lager) -> None:
    assert lager.reichweite() == (0.0, {"milch": 0.0})
    assert lager.abdeckung() == 0
    lager.einlagern("h-milch", 7, date(2026, 12, 1), jetzt=JETZT)
    assert lager.fehlende()[0][1] == 7
    assert lager.reichweite() == (7.0, {"milch": 7.0})
    assert lager.abdeckung() == 50
    lager.einlagern("h-milch", 20, date(2027, 6, 1), jetzt=JETZT)
    assert lager.fehlende() == []
    assert lager.abdeckung() == 100  # Überbestand zählt nicht über 100 %
    ablaufend = lager.ablaufend(date(2026, 11, 22), 30)
    assert [(c.mhd, tage) for c, tage in ablaufend] == [("2026-12-01", 9)]
    assert [t for _, t in lager.ablaufend(date(2026, 12, 3), 0)] == [-2]


def test_barcode_zuordnen_moves_code(lager: Lager) -> None:
    lager.produkte["hafer"] = Produkt(id="hafer", name="Haferflocken")
    assert lager.barcode_zuordnen("4006040000006", "h-milch", jetzt=JETZT) is None
    assert lager.barcode_zuordnen("4006040000006", "hafer", jetzt=JETZT) == "h-milch"
    assert lager.produkt_fuer_barcode("4006040000006").id == "hafer"
    assert lager.produkte["h-milch"].barcodes == []


def test_produkt_anlegen_unique_id_and_loeschen(lager: Lager) -> None:
    p = lager.produkt_anlegen({"name": "H-Milch", "soll": 2}, jetzt=JETZT)
    assert p.id == "h-milch-2"
    lager.einlagern(p.id, 1, None, jetzt=JETZT)
    lager.produkt_loeschen(p.id, jetzt=JETZT)
    assert p.id not in lager.produkte
    assert all(c.produkt != p.id for c in lager.chargen)
    with pytest.raises(LagerError):
        lager.produkt_anlegen({"name": "  "}, jetzt=JETZT)


def test_roundtrip(lager: Lager) -> None:
    lager.einlagern("h-milch", 2, date(2027, 1, 1), jetzt=JETZT)
    again = Lager.from_dict(lager.to_dict())
    assert again.to_dict() == lager.to_dict()


def test_seed_matches_checklist() -> None:
    checkliste = load_checkliste()
    lager = build_lager(checkliste, 4, 14)
    n_items = sum(len(g[4]) for g in checkliste)
    assert len(lager.produkte) == n_items
    milch = lager.produkte["h-milch"]
    assert (milch.soll, milch.packungsmenge, milch.haltbarkeit_monate) == (13, 1, 3)
    wasser = lager.produkte["mineralwasser-in-mehrweg-glasflaschen"]
    assert wasser.packungsmenge == pytest.approx(8.4)
    assert lager.gruppen["getraenke"].ziel == 112
    assert lager.gruppen["getraenke"].icon == "mdi:bottle-wine-outline"
    # alle Gruppen haben ein Symbol
    assert all(g.icon for g in lager.gruppen.values())
    # Mengen der Checkliste je Gruppe passen zur Packungsmenge × Soll
    for _name, _ziel, _einheit, _regal, items in checkliste:
        for item in items:
            p = next(p for p in lager.produkte.values() if p.name == item[0])
            assert p.packungsmenge * p.soll == pytest.approx(item[4], abs=0.01)


def test_seed_scales_food_only() -> None:
    lager = build_lager(load_checkliste(), 2, 10)
    # 13 × 2/4 × 10/14 = 4,64 → 5 Packungen
    assert lager.produkte["h-milch"].soll == 5
    assert lager.gruppen["milch-milchprodukte"].ziel == 7  # Tagesbedarf halbiert
    # Ausstattung bleibt
    assert lager.produkte["taschenlampen"].soll == 4


def test_valid_barcode_reference_examples() -> None:
    from custom_components.vorratskeller.openfoodfacts import valid_barcode

    # Beispiele aus GS1/Wikipedia: EAN-8, UPC-A, EAN-13
    assert valid_barcode("96385074")
    assert valid_barcode("036000291452")
    assert valid_barcode("4006381333931")
    assert not valid_barcode("4006381333932")
    assert not valid_barcode("12345")
    assert not valid_barcode("VK:F:links-1")


def test_mengen_einheitlich_gerundet(lager: Lager) -> None:
    lager.einlagern("h-milch", 1, date(2027, 1, 1), jetzt=JETZT)
    entnommen = lager.entnehmen("h-milch", 0.0015, jetzt=JETZT)
    # Antwort, Journal und Bestand verbuchen dieselbe gerundete Menge
    assert entnommen == [{"menge": 0.002, "mhd": "2027-01-01"}]
    assert lager.journal[-1]["menge"] == 0.002
    assert lager.bestand("h-milch") == 0.998
    with pytest.raises(LagerError):
        lager.entnehmen("h-milch", 0.0004, jetzt=JETZT)  # rundet auf 0


def test_einlagern_ohne_mhd(lager: Lager) -> None:
    charge = lager.einlagern("h-milch", 1, None, jetzt=JETZT, ohne_mhd=True)
    assert charge.mhd is None


def test_produkt_aendern_atomar(lager: Lager) -> None:
    with pytest.raises(LagerError):
        lager.produkt_aendern("h-milch", {"soll": 99, "name": "   "}, jetzt=JETZT)
    assert lager.produkte["h-milch"].soll == 14
    assert lager.journal == []


def test_laden_repariert_ungueltige_zahlen(lager: Lager) -> None:
    data = lager.to_dict()
    data["produkte"][0]["soll"] = None
    data["produkte"][0]["packungsmenge"] = float("inf")
    again = Lager.from_dict(data)
    assert again.produkte["h-milch"].soll == 0
    assert again.produkte["h-milch"].packungsmenge == 0
    assert again.fehlende() == []


def test_ueberschuss_und_fach_umbenennen_je_ort(lager: Lager) -> None:
    lager.einlagern("h-milch", 16, date(2027, 1, 10), jetzt=JETZT)
    assert lager.ueberschuss(date(2026, 11, 22), 180) == [(lager.produkte["h-milch"], 2, 49)]
    assert lager.ueberschuss(date(2026, 11, 22), 30) == []
    lager.produkte["h-milch"].fach = "Schrank, oben"
    lager.produkte["kaffee"] = Produkt(
        id="kaffee", name="Kaffee", fach="Schrank, oben", ort="Küche"
    )
    assert lager.fach_umbenennen("Schrank, oben", "Schrank, Mitte", ort="Küche", jetzt=JETZT) == 1
    assert lager.produkte["h-milch"].fach == "Schrank, oben"
    assert lager.produkte["kaffee"].fach == "Schrank, Mitte"
    assert lager.fach_umbenennen("Schrank, oben", "Regal", ort="", jetzt=JETZT) == 1
    assert Lager.from_dict(lager.to_dict()).produkte["kaffee"].ort == "Küche"
