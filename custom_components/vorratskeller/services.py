"""Dienste der Integration Vorratskeller."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
import math
from typing import Any

from homeassistant.auth.const import GROUP_ID_READ_ONLY
from homeassistant.core import (
    HomeAssistant,
    ServiceCall,
    ServiceResponse,
    SupportsResponse,
    callback,
)
from homeassistant.exceptions import ServiceValidationError, Unauthorized, UnknownUser
from homeassistant.helpers import config_validation as cv
from homeassistant.loader import async_get_integration
import voluptuous as vol

from .const import (
    ATTR_ALT,
    ATTR_BARCODE,
    ATTR_FACH,
    ATTR_FORM,
    ATTR_GRUPPE,
    ATTR_HALTBARKEIT,
    ATTR_HINWEIS,
    ATTR_MENGE,
    ATTR_MHD,
    ATTR_NAME,
    ATTR_NEU,
    ATTR_OHNE_MHD,
    ATTR_ORT,
    ATTR_PACKUNG,
    ATTR_PACKUNGSMENGE,
    ATTR_PRODUKT,
    ATTR_SOLL,
    CONF_OPEN_FOOD_FACTS,
    DOMAIN,
    FORMEN,
    SERVICE_BARCODE_SUCHEN,
    SERVICE_BARCODE_ZUORDNEN,
    SERVICE_BERICHT_SENDEN,
    SERVICE_EINKAUFSLISTE_ABGLEICHEN,
    SERVICE_EINLAGERN,
    SERVICE_ENTNEHMEN,
    SERVICE_FACH_UMBENENNEN,
    SERVICE_INVENTUR,
    SERVICE_PRODUKT_AENDERN,
    SERVICE_PRODUKT_ANLEGEN,
    SERVICE_PRODUKT_LOESCHEN,
)
from .lager import Produkt
from .manager import VorratskellerManager
from .openfoodfacts import async_lookup, valid_barcode


def _barcode(value: Any) -> str:
    value = str(value).strip()
    if not valid_barcode(value):
        raise vol.Invalid("invalid barcode")
    return value


def _endlich(value: Any) -> float:
    number = float(value)
    if not math.isfinite(number):
        raise vol.Invalid("number must be finite")
    return number


def _zahl(minimum: float, maximum: float) -> vol.All:
    """Endliche Zahl im Bereich (nan und inf würden gespeichert als null)."""
    return vol.All(_endlich, vol.Range(min=minimum, max=maximum))


BARCODE = vol.All(cv.string, _barcode)
MENGE = _zahl(0.001, 100000)

PRODUKT_REF = {
    vol.Optional(ATTR_PRODUKT): cv.string,
    vol.Optional(ATTR_BARCODE): BARCODE,
}

SCHEMA_EINLAGERN = vol.Schema(
    {
        **PRODUKT_REF,
        vol.Optional(ATTR_MENGE, default=1): MENGE,
        vol.Optional(ATTR_MHD): cv.date,
        vol.Optional(ATTR_OHNE_MHD, default=False): cv.boolean,
    }
)
SCHEMA_ENTNEHMEN = vol.Schema({**PRODUKT_REF, vol.Optional(ATTR_MENGE, default=1): MENGE})
SCHEMA_INVENTUR = vol.Schema(
    {
        **PRODUKT_REF,
        vol.Required(ATTR_MENGE): _zahl(0, 100000),
        vol.Optional(ATTR_MHD): cv.date,
    }
)
SCHEMA_BARCODE_ZUORDNEN = vol.Schema(
    {vol.Required(ATTR_BARCODE): BARCODE, vol.Required(ATTR_PRODUKT): cv.string}
)
SCHEMA_BARCODE_SUCHEN = vol.Schema({vol.Required(ATTR_BARCODE): BARCODE})

PRODUKT_FELDER = {
    vol.Optional(ATTR_GRUPPE): cv.string,
    vol.Optional(ATTR_FACH): cv.string,
    vol.Optional(ATTR_PACKUNG): cv.string,
    vol.Optional(ATTR_PACKUNGSMENGE): _zahl(0, 10000),
    vol.Optional(ATTR_SOLL): _zahl(0, 100000),
    vol.Optional(ATTR_HALTBARKEIT): vol.All(vol.Coerce(int), vol.Range(min=0, max=600)),
    vol.Optional(ATTR_HINWEIS): cv.string,
    vol.Optional(ATTR_FORM): vol.In(FORMEN),
    vol.Optional(ATTR_ORT): vol.All(cv.string, vol.Length(max=60)),
}
SCHEMA_PRODUKT_ANLEGEN = vol.Schema(
    {
        vol.Required(ATTR_NAME): vol.All(cv.string, vol.Length(min=1, max=120)),
        vol.Optional(ATTR_BARCODE): BARCODE,
        **PRODUKT_FELDER,
    }
)
SCHEMA_PRODUKT_AENDERN = vol.Schema(
    {
        vol.Required(ATTR_PRODUKT): cv.string,
        vol.Optional(ATTR_NAME): vol.All(cv.string, vol.Length(min=1, max=120)),
        **PRODUKT_FELDER,
    }
)
SCHEMA_PRODUKT_LOESCHEN = vol.Schema({vol.Required(ATTR_PRODUKT): cv.string})
SCHEMA_FACH_UMBENENNEN = vol.Schema(
    {
        vol.Required(ATTR_ALT): cv.string,
        vol.Required(ATTR_NEU): vol.All(cv.string, vol.Length(min=1, max=120)),
        vol.Optional(ATTR_ORT): cv.string,
    }
)


def _manager(hass: HomeAssistant) -> VorratskellerManager:
    entries = hass.config_entries.async_loaded_entries(DOMAIN)
    if not entries:
        raise ServiceValidationError(translation_domain=DOMAIN, translation_key="not_loaded")
    return entries[0].runtime_data


Handler = Callable[[ServiceCall], Awaitable[ServiceResponse]]


def _recht(hass: HomeAssistant, handler: Handler, *, admin: bool = False) -> Handler:
    """Schreibende Dienste nicht für Nur-Lesen-Konten; Löschen nur für Admins.

    Aufrufe ohne Benutzer (Automationen, Skripte) sind erlaubt.
    """

    async def pruefen(call: ServiceCall) -> ServiceResponse:
        if (user_id := call.context.user_id) is not None:
            user = await hass.auth.async_get_user(user_id)
            if user is None:
                raise UnknownUser(context=call.context, user_id=user_id)
            if (admin and not user.is_admin) or any(
                g.id == GROUP_ID_READ_ONLY for g in user.groups
            ):
                raise Unauthorized(context=call.context, user_id=user_id)
        return await handler(call)

    return pruefen


def produkt_info(manager: VorratskellerManager, produkt: Produkt) -> dict[str, Any]:
    """Produkt mit Bestand für Antworten der Dienste."""
    lager = manager.lager
    mhd = lager.naechstes_mhd(produkt.id)
    return {
        "id": produkt.id,
        "name": produkt.name,
        "gruppe": produkt.gruppe,
        "fach": produkt.fach,
        "packung": produkt.packung,
        "soll": produkt.soll,
        "bestand": lager.bestand(produkt.id),
        "naechstes_mhd": mhd.isoformat() if mhd else None,
        "haltbarkeit_monate": produkt.haltbarkeit_monate,
        "barcodes": list(produkt.barcodes),
        "form": produkt.form,
        "ort": produkt.ort,
    }


@callback
def async_setup_services(hass: HomeAssistant) -> None:
    """Registriere die Dienste."""

    def ref(manager: VorratskellerManager, call: ServiceCall) -> Produkt:
        return manager.resolve_produkt(call.data.get(ATTR_PRODUKT), call.data.get(ATTR_BARCODE))

    async def einlagern(call: ServiceCall) -> ServiceResponse:
        manager = _manager(hass)
        return manager.einlagern(
            ref(manager, call),
            call.data[ATTR_MENGE],
            call.data.get(ATTR_MHD),
            call.context.user_id,
            ohne_mhd=call.data[ATTR_OHNE_MHD],
        )

    async def entnehmen(call: ServiceCall) -> ServiceResponse:
        manager = _manager(hass)
        return manager.entnehmen(ref(manager, call), call.data[ATTR_MENGE], call.context.user_id)

    async def inventur(call: ServiceCall) -> ServiceResponse:
        manager = _manager(hass)
        return manager.inventur(
            ref(manager, call), call.data[ATTR_MENGE], call.data.get(ATTR_MHD), call.context.user_id
        )

    async def barcode_zuordnen(call: ServiceCall) -> ServiceResponse:
        manager = _manager(hass)
        produkt = manager.resolve_produkt(call.data[ATTR_PRODUKT], None)
        return manager.barcode_zuordnen(call.data[ATTR_BARCODE], produkt, call.context.user_id)

    async def barcode_suchen(call: ServiceCall) -> ServiceResponse:
        manager = _manager(hass)
        barcode = call.data[ATTR_BARCODE]
        if produkt := manager.lager.produkt_fuer_barcode(barcode):
            return {"bekannt": True, "produkt": produkt_info(manager, produkt), "vorschlag": None}
        vorschlag = None
        if manager.entry.options.get(CONF_OPEN_FOOD_FACTS, True):
            integration = await async_get_integration(hass, DOMAIN)
            vorschlag = await async_lookup(hass, barcode, str(integration.version))
        return {"bekannt": False, "produkt": None, "vorschlag": vorschlag}

    async def produkt_anlegen(call: ServiceCall) -> ServiceResponse:
        manager = _manager(hass)
        daten = dict(call.data)
        if daten.get(ATTR_FORM) == "auto":
            daten[ATTR_FORM] = ""
        if barcode := daten.pop(ATTR_BARCODE, None):
            daten["barcodes"] = [barcode]
        produkt = manager.produkt_anlegen(daten, call.context.user_id)
        return produkt_info(manager, produkt)

    async def produkt_aendern(call: ServiceCall) -> ServiceResponse:
        manager = _manager(hass)
        daten = dict(call.data)
        if daten.get(ATTR_FORM) == "auto":
            daten[ATTR_FORM] = ""
        produkt = manager.resolve_produkt(daten.pop(ATTR_PRODUKT), None)
        produkt = manager.produkt_aendern(produkt, daten, call.context.user_id)
        return produkt_info(manager, produkt)

    async def produkt_loeschen(call: ServiceCall) -> None:
        manager = _manager(hass)
        produkt = manager.resolve_produkt(call.data[ATTR_PRODUKT], None)
        manager.produkt_loeschen(produkt, call.context.user_id)

    async def fach_umbenennen(call: ServiceCall) -> ServiceResponse:
        anzahl = _manager(hass).fach_umbenennen(
            call.data[ATTR_ALT], call.data[ATTR_NEU], call.data.get(ATTR_ORT), call.context.user_id
        )
        return {"produkte": anzahl}

    async def bericht_senden(call: ServiceCall) -> None:
        await _manager(hass).async_send_bericht(call.context)

    async def einkaufsliste_abgleichen(call: ServiceCall) -> ServiceResponse:
        return {"neu": await _manager(hass).async_sync_einkaufsliste(call.context)}

    register = hass.services.async_register
    register(
        DOMAIN,
        SERVICE_EINLAGERN,
        _recht(hass, einlagern),
        SCHEMA_EINLAGERN,
        SupportsResponse.OPTIONAL,
    )
    register(
        DOMAIN,
        SERVICE_ENTNEHMEN,
        _recht(hass, entnehmen),
        SCHEMA_ENTNEHMEN,
        SupportsResponse.OPTIONAL,
    )
    register(
        DOMAIN, SERVICE_INVENTUR, _recht(hass, inventur), SCHEMA_INVENTUR, SupportsResponse.OPTIONAL
    )
    register(
        DOMAIN,
        SERVICE_BARCODE_ZUORDNEN,
        _recht(hass, barcode_zuordnen),
        SCHEMA_BARCODE_ZUORDNEN,
        SupportsResponse.OPTIONAL,
    )
    register(
        DOMAIN, SERVICE_BARCODE_SUCHEN, barcode_suchen, SCHEMA_BARCODE_SUCHEN, SupportsResponse.ONLY
    )
    register(
        DOMAIN,
        SERVICE_PRODUKT_ANLEGEN,
        _recht(hass, produkt_anlegen),
        SCHEMA_PRODUKT_ANLEGEN,
        SupportsResponse.OPTIONAL,
    )
    register(
        DOMAIN,
        SERVICE_PRODUKT_AENDERN,
        _recht(hass, produkt_aendern),
        SCHEMA_PRODUKT_AENDERN,
        SupportsResponse.OPTIONAL,
    )
    register(
        DOMAIN,
        SERVICE_PRODUKT_LOESCHEN,
        _recht(hass, produkt_loeschen, admin=True),
        SCHEMA_PRODUKT_LOESCHEN,
    )
    register(
        DOMAIN,
        SERVICE_FACH_UMBENENNEN,
        _recht(hass, fach_umbenennen),
        SCHEMA_FACH_UMBENENNEN,
        SupportsResponse.OPTIONAL,
    )
    register(DOMAIN, SERVICE_BERICHT_SENDEN, _recht(hass, bericht_senden), vol.Schema({}))
    register(
        DOMAIN,
        SERVICE_EINKAUFSLISTE_ABGLEICHEN,
        _recht(hass, einkaufsliste_abgleichen),
        vol.Schema({}),
        SupportsResponse.OPTIONAL,
    )
