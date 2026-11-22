"""Lagerbuch: Produkte, Chargen und Journal, ohne Abhängigkeit von Home Assistant.

Mengen zählen in Packungen (Feld ``packung`` beschreibt sie, z. B. "× 500 g").
Entnahme nach FIFO: Charge mit dem frühesten Mindesthaltbarkeitsdatum zuerst,
Chargen ohne MHD zuletzt, bei gleichem MHD die zuerst eingelagerte.
"""

from __future__ import annotations

import calendar
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
import math
import re
from typing import Any
import uuid

# Rundung, damit 0,1 + 0,2 nicht 0,30000000000000004 Packungen ergibt
_EPS = 1e-9


def make_id(text: str) -> str:
    """Bilde eine stabile Kennung aus einem deutschen Namen."""
    text = text.lower()
    for src, dst in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        text = text.replace(src, dst)
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:60].rstrip("-") or "produkt"


def add_months(start: date, months: int) -> date:
    """Addiere Monate; der Tag wird auf das Monatsende begrenzt."""
    month_index = start.month - 1 + months
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    day = min(start.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _finite(value: Any) -> float:
    """Zahl oder 0, falls leer, unendlich oder keine Zahl (ältere oder beschädigte Daten)."""
    try:
        number = float(value)
    except TypeError, ValueError:
        return 0.0
    return number if math.isfinite(number) else 0.0


def _menge(value: float) -> float:
    """Menge auf drei Nachkommastellen; Antwort, Bestand und Journal nutzen denselben Wert."""
    menge = _round(_finite(value))
    if menge <= 0:
        raise LagerError("invalid_amount")
    return menge


def _round(value: float) -> float:
    """Runde auf drei Nachkommastellen und gib ganze Zahlen als float zurück."""
    return round(value + 0.0, 3)


class LagerError(Exception):
    """Fachlicher Fehler, mit Übersetzungsschlüssel für die Oberfläche."""

    def __init__(self, key: str, **placeholders: Any) -> None:
        super().__init__(key)
        self.key = key
        self.placeholders = {k: str(v) for k, v in placeholders.items()}


@dataclass
class Gruppe:
    """Produktgruppe mit Ziel für die Reichweite (z. B. 18,5 kg in 14 Tagen)."""

    id: str
    name: str
    ziel: float = 0.0  # Menge für den ganzen Vorrat in ``einheit``; 0 = keine Reichweite
    einheit: str = ""
    tage: int = 14  # Zeitraum, für den ``ziel`` reicht
    icon: str | None = None


@dataclass
class Produkt:
    """Ein Produkt mit Sollbestand."""

    id: str
    name: str
    gruppe: str = ""
    fach: str = ""
    packung: str = ""
    packungsmenge: float = 0.0  # Menge je Packung in der Einheit der Gruppe (kg, l)
    soll: float = 0.0
    haltbarkeit_monate: int = 0
    hinweis: str = ""
    barcodes: list[str] = field(default_factory=list)
    ort: str = ""  # Lagerort (z. B. Küche); leer = Hauptlager
    form: str = ""  # Gefäß in der Regal-Ansicht; leer = aus Packung und Hinweis ableiten


@dataclass
class Charge:
    """Eingelagerte Menge mit einem MHD."""

    id: str
    produkt: str
    menge: float
    mhd: str | None  # ISO-Datum
    eingelagert: str  # ISO-Datum

    def mhd_date(self) -> date | None:
        """MHD als Datum."""
        return date.fromisoformat(self.mhd) if self.mhd else None


def fifo_key(charge: Charge) -> tuple[bool, str, str, str]:
    """Sortierschlüssel: frühestes MHD zuerst, ohne MHD zuletzt."""
    return (charge.mhd is None, charge.mhd or "", charge.eingelagert, charge.id)


class Lager:
    """Bestand im Speicher. Persistenz übernimmt ``store.VorratStore``."""

    def __init__(self) -> None:
        self.gruppen: dict[str, Gruppe] = {}
        self.produkte: dict[str, Produkt] = {}
        self.chargen: list[Charge] = []
        self.journal: list[dict[str, Any]] = []

    # --- Laden und Speichern -------------------------------------------------

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Lager:
        """Lade aus dem gespeicherten Format."""
        lager = cls()
        for raw in data.get("gruppen", []):
            gruppe = Gruppe(**raw)
            lager.gruppen[gruppe.id] = gruppe
        for raw in data.get("produkte", []):
            produkt = Produkt(**raw)
            for feld in ("packungsmenge", "soll"):
                setattr(produkt, feld, _finite(getattr(produkt, feld)))
            produkt.haltbarkeit_monate = int(_finite(produkt.haltbarkeit_monate))
            lager.produkte[produkt.id] = produkt
        lager.chargen = [Charge(**raw) for raw in data.get("chargen", [])]
        lager.journal = list(data.get("journal", []))
        return lager

    def to_dict(self) -> dict[str, Any]:
        """Gib das gespeicherte Format zurück."""
        return {
            "gruppen": [asdict(g) for g in self.gruppen.values()],
            "produkte": [asdict(p) for p in self.produkte.values()],
            "chargen": [asdict(c) for c in self.chargen],
            "journal": self.journal,
        }

    # --- Abfragen ------------------------------------------------------------

    def produkt(self, produkt_id: str) -> Produkt:
        """Produkt nach Kennung oder Fehler."""
        if (produkt := self.produkte.get(produkt_id)) is None:
            raise LagerError("unknown_product", produkt=produkt_id)
        return produkt

    def produkt_fuer_barcode(self, barcode: str) -> Produkt | None:
        """Produkt, dem der Barcode zugeordnet ist."""
        for produkt in self.produkte.values():
            if barcode in produkt.barcodes:
                return produkt
        return None

    def chargen_von(self, produkt_id: str) -> list[Charge]:
        """Chargen eines Produkts in FIFO-Reihenfolge."""
        return sorted((c for c in self.chargen if c.produkt == produkt_id), key=fifo_key)

    def bestand(self, produkt_id: str) -> float:
        """Bestand in Packungen."""
        return _round(sum(c.menge for c in self.chargen if c.produkt == produkt_id))

    def fehlt(self, produkt_id: str) -> float:
        """Fehlmenge bis zum Soll."""
        produkt = self.produkt(produkt_id)
        return _round(max(0.0, produkt.soll - self.bestand(produkt_id)))

    def naechstes_mhd(self, produkt_id: str) -> date | None:
        """Frühestes MHD der vorhandenen Chargen."""
        for charge in self.chargen_von(produkt_id):
            if charge.mhd:
                return charge.mhd_date()
        return None

    def fehlende(self) -> list[tuple[Produkt, float]]:
        """Produkte unter Soll mit Fehlmenge."""
        result = []
        for produkt in self.produkte.values():
            if produkt.soll > 0 and (fehlt := self.fehlt(produkt.id)) > _EPS:
                result.append((produkt, fehlt))
        return result

    def ueberschuss(self, heute: date, tage: int) -> list[tuple[Produkt, float, int]]:
        """Produkte über Soll mit MHD in höchstens ``tage`` Tagen: zuerst aufbrauchen."""
        result = []
        for produkt in self.produkte.values():
            mehr = self.bestand(produkt.id) - produkt.soll
            mhd = self.naechstes_mhd(produkt.id)
            if produkt.soll > 0 and mehr > _EPS and mhd is not None and (mhd - heute).days <= tage:
                result.append((produkt, _round(mehr), (mhd - heute).days))
        return sorted(result, key=lambda x: x[2])

    def ablaufend(self, heute: date, warn_tage: int) -> list[tuple[Charge, int]]:
        """Chargen, deren MHD in höchstens ``warn_tage`` Tagen erreicht ist (auch abgelaufene)."""
        result = []
        for charge in sorted(self.chargen, key=fifo_key):
            if (mhd := charge.mhd_date()) is None:
                continue
            tage = (mhd - heute).days
            if tage <= warn_tage:
                result.append((charge, tage))
        return result

    def reichweite(self) -> tuple[float | None, dict[str, float]]:
        """Reichweite in Tagen je Gruppe mit Ziel und insgesamt (die knappste Gruppe).

        Gruppe: vorhandene Menge (Packungen × Packungsmenge) ÷ (Ziel ÷ Tage).
        """
        je_gruppe: dict[str, float] = {}
        for gruppe in self.gruppen.values():
            if gruppe.ziel <= 0 or gruppe.tage <= 0:
                continue
            menge = sum(
                self.bestand(p.id) * p.packungsmenge
                for p in self.produkte.values()
                if p.gruppe == gruppe.id
            )
            je_gruppe[gruppe.id] = round(menge / (gruppe.ziel / gruppe.tage), 1)
        if not je_gruppe:
            return None, je_gruppe
        return min(je_gruppe.values()), je_gruppe

    def abdeckung(self) -> float | None:
        """Anteil des Solls in Prozent, Überbestand zählt nicht."""
        soll = vorhanden = 0.0
        for produkt in self.produkte.values():
            if produkt.soll <= 0:
                continue
            soll += produkt.soll
            vorhanden += min(produkt.soll, self.bestand(produkt.id))
        if soll <= 0:
            return None
        return round(100 * vorhanden / soll, 1)

    # --- Änderungen ----------------------------------------------------------

    def _log(
        self,
        aktion: str,
        produkt_id: str | None,
        menge: float | None = None,
        *,
        jetzt: datetime,
        user_id: str | None = None,
        **extra: Any,
    ) -> None:
        entry: dict[str, Any] = {
            "zeit": jetzt.isoformat(timespec="seconds"),
            "aktion": aktion,
            "produkt": produkt_id,
        }
        if menge is not None:
            entry["menge"] = menge
        if user_id:
            entry["user_id"] = user_id
        entry.update({k: v for k, v in extra.items() if v is not None})
        self.journal.append(entry)

    def trim_journal(self, max_entries: int) -> None:
        """Begrenze das Journal auf die jüngsten Einträge."""
        if len(self.journal) > max_entries:
            del self.journal[: len(self.journal) - max_entries]

    def einlagern(
        self,
        produkt_id: str,
        menge: float,
        mhd: date | None,
        *,
        jetzt: datetime,
        user_id: str | None = None,
        ohne_mhd: bool = False,
    ) -> Charge:
        """Lagere ein. Ohne MHD gilt heute + übliche Haltbarkeit, außer ``ohne_mhd``."""
        produkt = self.produkt(produkt_id)
        menge = _menge(menge)
        if mhd is None and not ohne_mhd and produkt.haltbarkeit_monate > 0:
            mhd = add_months(jetzt.date(), produkt.haltbarkeit_monate)
        mhd_iso = mhd.isoformat() if mhd else None
        heute = jetzt.date().isoformat()
        # Gleiches MHD am gleichen Tag: in dieselbe Charge
        for charge in self.chargen:
            if (
                charge.produkt == produkt_id
                and charge.mhd == mhd_iso
                and charge.eingelagert == heute
            ):
                charge.menge = _round(charge.menge + menge)
                break
        else:
            charge = Charge(
                id=uuid.uuid4().hex[:12],
                produkt=produkt_id,
                menge=_round(menge),
                mhd=mhd_iso,
                eingelagert=heute,
            )
            self.chargen.append(charge)
        self._log("einlagern", produkt_id, menge, jetzt=jetzt, user_id=user_id, mhd=mhd_iso)
        return charge

    def entnehmen(
        self,
        produkt_id: str,
        menge: float,
        *,
        jetzt: datetime,
        user_id: str | None = None,
        aktion: str = "entnehmen",
    ) -> list[dict[str, Any]]:
        """Entnimm nach FIFO. Ändert nichts, wenn der Bestand nicht reicht."""
        self.produkt(produkt_id)
        menge = _menge(menge)
        vorhanden = self.bestand(produkt_id)
        if menge > vorhanden + _EPS:
            raise LagerError(
                "not_enough_stock",
                produkt=self.produkte[produkt_id].name,
                vorhanden=f"{vorhanden:g}",
                menge=f"{menge:g}",
            )
        rest = menge
        entnommen: list[dict[str, Any]] = []
        for charge in self.chargen_von(produkt_id):
            if rest <= _EPS:
                break
            nimm = min(charge.menge, rest)
            charge.menge = _round(charge.menge - nimm)
            rest = _round(rest - nimm)
            entnommen.append({"menge": _round(nimm), "mhd": charge.mhd})
        self.chargen = [c for c in self.chargen if c.menge > _EPS]
        self._log(aktion, produkt_id, menge, jetzt=jetzt, user_id=user_id)
        return entnommen

    def inventur(
        self,
        produkt_id: str,
        menge: float,
        mhd: date | None,
        *,
        jetzt: datetime,
        user_id: str | None = None,
    ) -> float:
        """Setze den gezählten Bestand. Gibt die Differenz zurück."""
        if menge < 0:
            raise LagerError("invalid_amount")
        differenz = _round(menge - self.bestand(produkt_id))
        if differenz > _EPS:
            self.einlagern(produkt_id, differenz, mhd, jetzt=jetzt, user_id=user_id)
            self.journal[-1]["aktion"] = "inventur"
        elif differenz < -_EPS:
            self.entnehmen(produkt_id, -differenz, jetzt=jetzt, user_id=user_id, aktion="inventur")
            self.journal[-1]["menge"] = differenz
        return differenz

    def barcode_zuordnen(
        self, barcode: str, produkt_id: str, *, jetzt: datetime, user_id: str | None = None
    ) -> str | None:
        """Ordne einen Barcode zu. Gibt das Produkt zurück, dem er vorher gehörte."""
        produkt = self.produkt(produkt_id)
        vorher = self.produkt_fuer_barcode(barcode)
        if vorher is produkt:
            return None
        if vorher is not None:
            vorher.barcodes.remove(barcode)
        produkt.barcodes.append(barcode)
        self._log("barcode_zuordnen", produkt_id, jetzt=jetzt, user_id=user_id, barcode=barcode)
        return vorher.id if vorher else None

    def produkt_anlegen(
        self, daten: dict[str, Any], *, jetzt: datetime, user_id: str | None = None
    ) -> Produkt:
        """Lege ein Produkt an; die Kennung wird aus dem Namen gebildet."""
        name = str(daten["name"]).strip()
        if not name:
            raise LagerError("invalid_name")
        basis = make_id(name)
        produkt_id, n = basis, 2
        while produkt_id in self.produkte:
            produkt_id, n = f"{basis}-{n}", n + 1
        felder = {k: v for k, v in daten.items() if k in Produkt.__dataclass_fields__}
        felder.pop("id", None)
        felder["name"] = name
        barcodes = [b for b in felder.pop("barcodes", []) if self.produkt_fuer_barcode(b) is None]
        produkt = Produkt(id=produkt_id, barcodes=barcodes, **felder)
        self.produkte[produkt_id] = produkt
        self._log("produkt_anlegen", produkt_id, jetzt=jetzt, user_id=user_id)
        return produkt

    def produkt_aendern(
        self,
        produkt_id: str,
        daten: dict[str, Any],
        *,
        jetzt: datetime,
        user_id: str | None = None,
    ) -> Produkt:
        """Ändere Felder eines Produkts (nicht Kennung und Barcodes)."""
        produkt = self.produkt(produkt_id)
        aenderungen = {
            k: v
            for k, v in daten.items()
            if k not in ("id", "barcodes") and k in Produkt.__dataclass_fields__
        }
        if "name" in aenderungen:
            aenderungen["name"] = str(aenderungen["name"]).strip()
            if not aenderungen["name"]:
                raise LagerError("invalid_name")
        for key, value in aenderungen.items():
            setattr(produkt, key, value)
        self._log("produkt_aendern", produkt_id, jetzt=jetzt, user_id=user_id)
        return produkt

    def fach_umbenennen(
        self,
        alt: str,
        neu: str,
        *,
        ort: str | None = None,
        jetzt: datetime,
        user_id: str | None = None,
    ) -> int:
        """Benenne ein Fach in allen Produkten um (optional nur an einem Lagerort)."""
        alt, neu = str(alt).strip(), str(neu).strip()
        if not neu:
            raise LagerError("invalid_fach")
        treffer = [
            p
            for p in self.produkte.values()
            if p.fach.strip() == alt and (ort is None or p.ort.strip() == ort.strip())
        ]
        if not treffer:
            raise LagerError("unknown_fach", fach=alt)
        for produkt in treffer:
            produkt.fach = neu
        self._log("fach_umbenennen", None, jetzt=jetzt, user_id=user_id, alt=alt, neu=neu)
        return len(treffer)

    def produkt_loeschen(
        self, produkt_id: str, *, jetzt: datetime, user_id: str | None = None
    ) -> None:
        """Lösche ein Produkt mit seinen Chargen."""
        self.produkt(produkt_id)
        del self.produkte[produkt_id]
        self.chargen = [c for c in self.chargen if c.produkt != produkt_id]
        self._log("produkt_loeschen", produkt_id, jetzt=jetzt, user_id=user_id)
