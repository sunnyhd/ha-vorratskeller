"""Vorratskeller: Lagerbuch mit Chargen, MHD und Soll als Home-Assistant-Integration."""

from __future__ import annotations

from functools import partial
import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration

from .const import (
    CONF_CHECKLISTE,
    CONF_PERSONEN,
    CONF_TAGE,
    DEFAULT_PERSONEN,
    DEFAULT_TAGE,
    DOMAIN,
    FRONTEND_SCRIPT,
    STATIC_URL,
)
from .manager import VorratskellerConfigEntry, VorratskellerManager
from .seed import build_lager, load_checkliste
from .services import async_setup_services

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.SENSOR]
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Dienste und Frontend einmalig registrieren."""
    async_setup_services(hass)
    integration = await async_get_integration(hass, DOMAIN)
    await hass.http.async_register_static_paths(
        [StaticPathConfig(STATIC_URL, str(Path(__file__).parent / "frontend"), cache_headers=False)]
    )
    # Version im Pfad, damit Browser nach einem Update die neue Karte laden
    add_extra_js_url(hass, f"{STATIC_URL}/{FRONTEND_SCRIPT}?v={integration.version}")
    return True


async def async_setup_entry(hass: HomeAssistant, entry: VorratskellerConfigEntry) -> bool:
    """Lagerbuch laden und Plattformen starten."""
    manager = VorratskellerManager(hass, entry)
    seed = None
    if entry.data.get(CONF_CHECKLISTE, True):
        checkliste = await hass.async_add_executor_job(load_checkliste)
        seed = partial(
            build_lager,
            checkliste,
            int(entry.data.get(CONF_PERSONEN, DEFAULT_PERSONEN)),
            int(entry.data.get(CONF_TAGE, DEFAULT_TAGE)),
        )
    await manager.async_load(seed)
    entry.runtime_data = manager
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    await manager.async_start()
    return True


async def async_unload_entry(hass: HomeAssistant, entry: VorratskellerConfigEntry) -> bool:
    """Plattformen entladen und Lagerbuch speichern."""
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        await entry.runtime_data.async_shutdown()
    return unloaded
