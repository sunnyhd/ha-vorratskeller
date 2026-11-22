"""Abfrage bei Open Food Facts. Nach außen geht nur die Barcode-Nummer (KB, 2026-11-22)."""

from __future__ import annotations

import logging
import re
from typing import Any

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_create_clientsession

from .const import OPEN_FOOD_FACTS_FIELDS, OPEN_FOOD_FACTS_URL, USER_AGENT

_LOGGER = logging.getLogger(__name__)

# EAN-8, UPC-A (12), EAN-13, ITF-14/GTIN-14
BARCODE_RE = re.compile(r"^\d{8}$|^\d{12,14}$")
TIMEOUT = aiohttp.ClientTimeout(total=10)


_SESSION_KEY = "vorratskeller_off_session"


def _session(hass: HomeAssistant) -> aiohttp.ClientSession:
    """Eigene Sitzung ohne Cookie-Speicher, damit nichts außer der Nummer mitgeht."""
    if (session := hass.data.get(_SESSION_KEY)) is None:
        session = async_create_clientsession(hass, cookie_jar=aiohttp.DummyCookieJar())
        hass.data[_SESSION_KEY] = session
    return session


def valid_barcode(barcode: str) -> bool:
    """Prüfe Länge und Prüfziffer (GTIN, Modulo 10)."""
    if not BARCODE_RE.match(barcode):
        return False
    digits = [int(c) for c in barcode]
    check = digits.pop()
    total = sum(d * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(digits)))
    return (10 - total % 10) % 10 == check


async def async_lookup(hass: HomeAssistant, barcode: str, version: str) -> dict[str, Any] | None:
    """Frage Name, Marke und Menge ab. ``None``, wenn unbekannt oder nicht erreichbar.

    Ohne Cookies, ohne Kennung des Hauses; nur die Nummer steht in der Adresse.
    """
    if not valid_barcode(barcode):
        return None
    session = _session(hass)
    try:
        async with session.get(
            OPEN_FOOD_FACTS_URL.format(barcode=barcode),
            params={"fields": OPEN_FOOD_FACTS_FIELDS},
            headers={"User-Agent": USER_AGENT.format(version=version)},
            timeout=TIMEOUT,
        ) as resp:
            if resp.status == 404:
                return None
            resp.raise_for_status()
            data = await resp.json(content_type=None)
    except (aiohttp.ClientError, TimeoutError, ValueError) as err:
        _LOGGER.info("Open Food Facts nicht erreichbar: %s", err)
        return None
    if not isinstance(data, dict) or data.get("status") != 1:
        return None
    product = data.get("product") or {}
    name = (product.get("product_name_de") or product.get("product_name") or "").strip()
    if not name:
        return None
    return {
        "name": name,
        "marke": (product.get("brands") or "").split(",")[0].strip(),
        "menge": (product.get("quantity") or "").strip(),
    }
