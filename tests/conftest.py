"""Gemeinsame Fixtures."""

from __future__ import annotations

from datetime import datetime

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.vorratskeller.const import (
    CONF_CHECKLISTE,
    CONF_OPEN_FOOD_FACTS,
    CONF_PERSONEN,
    CONF_TAGE,
    CONF_UHRZEIT,
    CONF_WARN_TAGE,
    CONF_WOCHENTAG,
    DOMAIN,
)

JETZT = datetime(2026, 11, 22, 12, 0, 0)


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations: None) -> None:
    """Custom Integrations in allen Tests laden."""


@pytest.fixture
def options() -> dict:
    """Optionen des Eintrags; Tests können sie überschreiben."""
    return {
        CONF_WARN_TAGE: 30,
        CONF_WOCHENTAG: "sat",
        CONF_UHRZEIT: "10:00:00",
        CONF_OPEN_FOOD_FACTS: True,
    }


@pytest.fixture
def config_entry(options: dict) -> MockConfigEntry:
    """Eintrag mit Erstbefüllung für 4 Personen und 14 Tage."""
    return MockConfigEntry(
        domain=DOMAIN,
        title="Vorratskeller",
        data={CONF_CHECKLISTE: True, CONF_PERSONEN: 4, CONF_TAGE: 14},
        options=options,
    )


@pytest.fixture
async def setup_integration(hass: HomeAssistant, config_entry: MockConfigEntry) -> MockConfigEntry:
    """Integration einrichten."""
    await hass.config.async_set_time_zone("Europe/Berlin")
    assert await async_setup_component(hass, "http", {})
    config_entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    return config_entry
