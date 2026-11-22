"""Blueprint für Push-Nachrichten: lädt in HA und sendet die erwartete Nachricht."""

from __future__ import annotations

from pathlib import Path
import shutil

from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed,
    async_mock_service,
)

from custom_components.vorratskeller.const import DOMAIN

QUELLE = Path(__file__).parent.parent / "blueprints" / "automation" / "vorratskeller"


async def _automation(hass: HomeAssistant, **eingaben: object) -> None:
    ziel = Path(hass.config.path("blueprints/automation/vorratskeller"))
    ziel.mkdir(parents=True, exist_ok=True)
    shutil.copy(QUELLE / "push_vorrat.yaml", ziel / "push_vorrat.yaml")
    assert await async_setup_component(
        hass,
        "automation",
        {
            "automation": {
                "id": "push",
                "use_blueprint": {
                    "path": "vorratskeller/push_vorrat.yaml",
                    "input": {"empfaenger": ["notify.handy"], "uhrzeit": "18:00:00", **eingaben},
                },
            }
        },
    )
    await hass.async_block_till_done()
    # Blueprint geladen: sonst gäbe es keine Automation (Fehler stünden im Log)
    assert hass.states.async_entity_ids("automation"), "Blueprint nicht geladen"


@pytest.mark.parametrize("expected_lingering_timers", [True])
async def test_blueprint_meldet_ablauf(
    hass: HomeAssistant, freezer: FrozenDateTimeFactory, config_entry: MockConfigEntry
) -> None:
    hass.config.language = "de"
    await hass.config.async_set_time_zone("UTC")
    freezer.move_to("2026-11-21 12:00:00+00:00")
    calls = async_mock_service(hass, "notify", "send_message")
    assert await async_setup_component(hass, "http", {})
    config_entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    await hass.services.async_call(
        DOMAIN, "einlagern", {"produkt": "h-milch", "menge": 2, "mhd": "2026-11-24"}, blocking=True
    )
    await _automation(hass, fehlende_melden=True)

    freezer.move_to("2026-11-21 18:00:00+00:00")
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert len(calls) == 1
    msg = calls[0].data["message"]
    assert "• H-Milch: 2 (in 3 Tagen)" in msg
    assert "Unter Soll (" in msg
    assert calls[0].data["entity_id"] == ["notify.handy"]


@pytest.mark.parametrize("expected_lingering_timers", [True])
async def test_blueprint_schweigt_ohne_meldung(
    hass: HomeAssistant, freezer: FrozenDateTimeFactory, config_entry: MockConfigEntry
) -> None:
    hass.config.language = "de"
    await hass.config.async_set_time_zone("UTC")
    freezer.move_to("2026-11-21 12:00:00+00:00")
    calls = async_mock_service(hass, "notify", "send_message")
    assert await async_setup_component(hass, "http", {})
    config_entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    await _automation(hass, wochentage=["sat"])
    freezer.move_to("2026-11-21 18:00:00+00:00")  # Samstag, nichts läuft ab
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert calls == []
