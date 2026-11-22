"""Laufzeit der Integration: Speicher, Änderungen, Einkaufsliste und Wochenbericht."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from datetime import date, datetime, time
import logging
from typing import Any

from homeassistant.components.todo import TodoListEntityFeature
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import ATTR_ENTITY_ID, ATTR_SUPPORTED_FEATURES
from homeassistant.core import CALLBACK_TYPE, Context, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.debounce import Debouncer
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_track_time_change
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    CONF_EINKAUFSLISTE,
    CONF_NOTIFY,
    CONF_UHRZEIT,
    CONF_WARN_TAGE,
    CONF_WOCHENTAG,
    DEFAULT_UHRZEIT,
    DEFAULT_WARN_TAGE,
    DEFAULT_WOCHENTAG,
    DOMAIN,
    JOURNAL_MAX,
    SIGNAL_PRODUCT_ADDED,
    SIGNAL_PRODUCT_REMOVED,
    SIGNAL_UPDATED,
    STORAGE_KEY,
    STORAGE_MINOR_VERSION,
    STORAGE_VERSION,
    WOCHENTAGE,
)
from .lager import Lager, LagerError, Produkt
from .texte import text

_LOGGER = logging.getLogger(__name__)

type VorratskellerConfigEntry = ConfigEntry[VorratskellerManager]


class VorratskellerManager:
    """Hält das Lagerbuch, speichert Änderungen und löst die Automatik aus."""

    def __init__(self, hass: HomeAssistant, entry: VorratskellerConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.lager = Lager()
        self._store: Store[dict[str, Any]] = Store(
            hass,
            STORAGE_VERSION,
            STORAGE_KEY,
            minor_version=STORAGE_MINOR_VERSION,
            atomic_writes=True,
        )
        self._unsubs: list[CALLBACK_TYPE] = []
        # Abgleiche nacheinander: gleichzeitige Läufe sähen dieselbe Liste und fügten doppelt hinzu
        self._sync_lock = asyncio.Lock()
        self._stopped = False
        self._sync_debouncer = Debouncer(
            hass,
            _LOGGER,
            cooldown=5,
            immediate=False,
            function=self.async_sync_einkaufsliste,
        )

    # --- Optionen ------------------------------------------------------------

    @property
    def warn_tage(self) -> int:
        """Vorlauf für „läuft bald ab“ in Tagen."""
        return int(self.entry.options.get(CONF_WARN_TAGE, DEFAULT_WARN_TAGE))

    # --- Lebenszyklus --------------------------------------------------------

    async def async_load(self, seed: Callable[[], Lager] | None) -> None:
        """Lade das Lagerbuch; beim ersten Start aus der Erstbefüllung."""
        data = await self._store.async_load()
        if data is not None:
            self.lager = Lager.from_dict(data)
        elif seed is not None:
            self.lager = seed()
            await self._store.async_save(self.lager.to_dict())

    async def async_start(self) -> None:
        """Starte Wochenbericht und ersten Abgleich der Einkaufsliste."""
        uhrzeit = time.fromisoformat(self.entry.options.get(CONF_UHRZEIT, DEFAULT_UHRZEIT))
        # Tage bis zum MHD ändern sich um Mitternacht
        self._unsubs.append(
            async_track_time_change(self.hass, self._async_midnight, hour=0, minute=0, second=5)
        )
        if self.entry.options.get(CONF_NOTIFY):
            self._unsubs.append(
                async_track_time_change(
                    self.hass,
                    self._async_weekly,
                    hour=uhrzeit.hour,
                    minute=uhrzeit.minute,
                    second=0,
                )
            )
        if self.entry.options.get(CONF_EINKAUFSLISTE):
            await self._sync_debouncer.async_call()

    async def async_shutdown(self) -> None:
        """Beende Zeitpläne und schreibe ausstehende Änderungen."""
        self._stopped = True
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        self._sync_debouncer.async_shutdown()
        await self._store.async_save(self.lager.to_dict())

    # --- Änderungen ----------------------------------------------------------

    def _now(self) -> datetime:
        return dt_util.now()

    def today(self) -> date:
        """Heutiges Datum in der Zeitzone von Home Assistant."""
        return self._now().date()

    @callback
    def _changed(self) -> None:
        self.lager.trim_journal(JOURNAL_MAX)
        self._store.async_delay_save(self.lager.to_dict, 2)
        async_dispatcher_send(self.hass, SIGNAL_UPDATED)
        if self.entry.options.get(CONF_EINKAUFSLISTE):
            self.hass.async_create_task(self._sync_debouncer.async_call())

    def _run(self, func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        """Führe eine Lager-Änderung aus und übersetze fachliche Fehler."""
        try:
            result = func(*args, jetzt=self._now(), **kwargs)
        except LagerError as err:
            raise ServiceValidationError(
                translation_domain=DOMAIN,
                translation_key=err.key,
                translation_placeholders=err.placeholders,
            ) from err
        self._changed()
        return result

    def resolve_produkt(self, produkt: str | None, barcode: str | None) -> Produkt:
        """Finde das Produkt nach Kennung, Entität oder Barcode."""
        if produkt:
            if produkt.startswith("sensor."):
                entry = er.async_get(self.hass).async_get(produkt)
                if entry and entry.platform == DOMAIN and entry.unique_id.startswith("produkt_"):
                    produkt = entry.unique_id.removeprefix("produkt_")
            if found := self.lager.produkte.get(produkt):
                return found
            raise ServiceValidationError(
                translation_domain=DOMAIN,
                translation_key="unknown_product",
                translation_placeholders={"produkt": produkt},
            )
        if barcode:
            if found := self.lager.produkt_fuer_barcode(barcode):
                return found
            raise ServiceValidationError(
                translation_domain=DOMAIN,
                translation_key="unknown_barcode",
                translation_placeholders={"barcode": barcode},
            )
        raise ServiceValidationError(translation_domain=DOMAIN, translation_key="product_required")

    def einlagern(
        self,
        produkt: Produkt,
        menge: float,
        mhd: date | None,
        user_id: str | None,
        *,
        ohne_mhd: bool = False,
    ) -> dict[str, Any]:
        """Lagere ein."""
        charge = self._run(
            self.lager.einlagern, produkt.id, menge, mhd, user_id=user_id, ohne_mhd=ohne_mhd
        )
        return {"produkt": produkt.id, "bestand": self.lager.bestand(produkt.id), "mhd": charge.mhd}

    def entnehmen(self, produkt: Produkt, menge: float, user_id: str | None) -> dict[str, Any]:
        """Entnimm nach FIFO."""
        entnommen = self._run(self.lager.entnehmen, produkt.id, menge, user_id=user_id)
        return {
            "produkt": produkt.id,
            "bestand": self.lager.bestand(produkt.id),
            "entnommen": entnommen,
        }

    def inventur(
        self, produkt: Produkt, menge: float, mhd: date | None, user_id: str | None
    ) -> dict[str, Any]:
        """Setze den gezählten Bestand."""
        differenz = self._run(self.lager.inventur, produkt.id, menge, mhd, user_id=user_id)
        return {
            "produkt": produkt.id,
            "bestand": self.lager.bestand(produkt.id),
            "differenz": differenz,
        }

    def barcode_zuordnen(
        self, barcode: str, produkt: Produkt, user_id: str | None
    ) -> dict[str, Any]:
        """Ordne einen Barcode zu."""
        vorher = self._run(self.lager.barcode_zuordnen, barcode, produkt.id, user_id=user_id)
        return {"produkt": produkt.id, "vorher": vorher}

    def produkt_anlegen(self, daten: dict[str, Any], user_id: str | None) -> Produkt:
        """Lege ein Produkt an."""
        produkt = self._run(self.lager.produkt_anlegen, daten, user_id=user_id)
        async_dispatcher_send(self.hass, SIGNAL_PRODUCT_ADDED, produkt.id)
        return produkt

    def produkt_aendern(
        self, produkt: Produkt, daten: dict[str, Any], user_id: str | None
    ) -> Produkt:
        """Ändere ein Produkt."""
        return self._run(self.lager.produkt_aendern, produkt.id, daten, user_id=user_id)

    def fach_umbenennen(self, alt: str, neu: str, user_id: str | None) -> int:
        """Benenne ein Fach in allen Produkten um."""
        return self._run(self.lager.fach_umbenennen, alt, neu, user_id=user_id)

    def produkt_loeschen(self, produkt: Produkt, user_id: str | None) -> None:
        """Lösche ein Produkt."""
        self._run(self.lager.produkt_loeschen, produkt.id, user_id=user_id)
        async_dispatcher_send(self.hass, SIGNAL_PRODUCT_REMOVED, produkt.id)

    # --- Einkaufsliste -------------------------------------------------------

    async def async_sync_einkaufsliste(self, context: Context | None = None) -> int:
        """Setze fehlende Produkte auf die Einkaufsliste, ohne Dubletten.

        Offene Einträge mit gleichem Text gelten als vorhanden; erledigte nicht,
        damit ein Produkt nach dem Einkauf wieder auf die Liste kommt, wenn es erneut fehlt.
        Läufe sind serialisiert; jeder liest die Liste und den Bestand neu.
        """
        async with self._sync_lock:
            if self._stopped:
                return 0
            return await self._sync_einkaufsliste(context)

    async def _sync_einkaufsliste(self, context: Context | None) -> int:
        entity_id = self.entry.options.get(CONF_EINKAUFSLISTE)
        if not entity_id:
            return 0
        state = self.hass.states.get(entity_id)
        if state is None:
            _LOGGER.warning("Einkaufsliste %s nicht gefunden", entity_id)
            return 0
        fehlende = self.lager.fehlende()
        if not fehlende:
            return 0
        response = await self.hass.services.async_call(
            "todo",
            "get_items",
            {ATTR_ENTITY_ID: entity_id, "status": ["needs_action"]},
            blocking=True,
            return_response=True,
            context=context,
        )
        offen = {
            str(item.get("summary", "")).casefold()
            for item in response.get(entity_id, {}).get("items", [])  # type: ignore[union-attr]
        }
        mit_beschreibung = bool(
            int(state.attributes.get(ATTR_SUPPORTED_FEATURES, 0))
            & TodoListEntityFeature.SET_DESCRIPTION_ON_ITEM
        )
        neu = 0
        for produkt, fehlt in fehlende:
            summary = f"{produkt.name}{text(self.hass, 'einkauf_suffix')}"
            if summary.casefold() in offen:
                continue
            data: dict[str, Any] = {ATTR_ENTITY_ID: entity_id, "item": summary}
            if mit_beschreibung:
                data["description"] = text(
                    self.hass, "einkauf_beschreibung", fehlt=f"{fehlt:g}", packung=produkt.packung
                ).strip()
            await self.hass.services.async_call(
                "todo", "add_item", data, blocking=True, context=context
            )
            offen.add(summary.casefold())
            neu += 1
        return neu

    # --- Wochenbericht -------------------------------------------------------

    def bericht(self) -> tuple[str, str]:
        """Titel und Text der Nachricht: was bald abläuft und was fehlt."""
        heute = self.today()
        zeilen: list[str] = []
        ablaufend = self.lager.ablaufend(heute, self.warn_tage)
        if ablaufend:
            zeilen.append(text(self.hass, "bericht_ablaufend"))
            for charge, tage in ablaufend:
                name = self.lager.produkte[charge.produkt].name
                if tage < 0:
                    wann = text(self.hass, "bericht_abgelaufen", tage=-tage)
                elif tage == 0:
                    wann = text(self.hass, "bericht_heute")
                else:
                    wann = text(self.hass, "bericht_in_tagen", tage=tage)
                zeilen.append(f"• {name}: {charge.menge:g} ({wann})")
        fehlende = self.lager.fehlende()
        if fehlende:
            zeilen.append(text(self.hass, "bericht_unter_soll", anzahl=len(fehlende)))
        if not zeilen:
            zeilen.append(text(self.hass, "bericht_alles_gut"))
        return text(self.hass, "bericht_titel"), "\n".join(zeilen)

    async def async_send_bericht(self, context: Context | None = None) -> None:
        """Sende den Bericht an den eingestellten Dienst."""
        ziel = self.entry.options.get(CONF_NOTIFY)
        if not ziel:
            raise ServiceValidationError(
                translation_domain=DOMAIN, translation_key="no_notify_target"
            )
        title, message = self.bericht()
        domain, _, name = ziel.partition(".")
        if domain == "notify" and self.hass.services.has_service("notify", name):
            await self.hass.services.async_call(
                "notify", name, {"title": title, "message": message}, blocking=True, context=context
            )
        elif self.hass.states.get(ziel) is not None and domain == "notify":
            await self.hass.services.async_call(
                "notify",
                "send_message",
                {ATTR_ENTITY_ID: ziel, "title": title, "message": message},
                blocking=True,
                context=context,
            )
        else:
            raise HomeAssistantError(
                translation_domain=DOMAIN,
                translation_key="notify_target_missing",
                translation_placeholders={"ziel": ziel},
            )

    @callback
    def _async_midnight(self, now: datetime) -> None:
        async_dispatcher_send(self.hass, SIGNAL_UPDATED)

    async def _async_weekly(self, now: datetime) -> None:
        wochentag = self.entry.options.get(CONF_WOCHENTAG, DEFAULT_WOCHENTAG)
        if WOCHENTAGE[now.weekday()] != wochentag:
            return
        try:
            await self.async_send_bericht()
        except HomeAssistantError as err:
            _LOGGER.warning("Wochenbericht nicht gesendet: %s", err)
