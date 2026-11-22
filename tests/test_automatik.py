"""Einkaufsliste, Wochenbericht und Einrichtung."""

from __future__ import annotations

from freezegun.api import FrozenDateTimeFactory
from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import ServiceValidationError
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed,
    async_mock_service,
)

from custom_components.vorratskeller.const import DOMAIN

pytestmark = pytest.mark.freeze_time("2026-11-21 08:00:00+00:00")  # Samstag


@pytest.fixture
async def einkaufsliste(hass: HomeAssistant, tmp_path) -> str:
    """Einkaufsliste der Integration shopping_list (todo.shopping_list).

    Eigenes Konfigurationsverzeichnis, weil shopping_list seine Datei dort ablegt.
    """
    hass.config.config_dir = str(tmp_path)
    entry = MockConfigEntry(domain="shopping_list")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return "todo.shopping_list"


async def items(hass: HomeAssistant, entity_id: str, status: list[str] | None = None) -> list[dict]:
    data = {"entity_id": entity_id}
    if status:
        data["status"] = status
    resp = await hass.services.async_call(
        "todo", "get_items", data, blocking=True, return_response=True
    )
    return resp[entity_id]["items"]


@pytest.mark.parametrize("options", [{"einkaufsliste": "todo.shopping_list"}])
async def test_einkaufsliste_without_duplicates(
    hass: HomeAssistant,
    einkaufsliste: str,
    setup_integration: MockConfigEntry,
    freezer: FrozenDateTimeFactory,
) -> None:
    manager = setup_integration.runtime_data
    freezer.tick(6)
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    erwartet = len(manager.lager.fehlende())
    liste = await items(hass, einkaufsliste)
    assert len(liste) == erwartet
    assert "H-Milch (Vorrat)" in {i["summary"] for i in liste}

    # zweiter Abgleich: keine Dubletten
    resp = await hass.services.async_call(
        DOMAIN, "einkaufsliste_abgleichen", {}, blocking=True, return_response=True
    )
    assert resp == {"neu": 0}
    assert len(await items(hass, einkaufsliste)) == erwartet

    # Milch gekauft: Eintrag abhaken, Bestand auf Soll
    await hass.services.async_call(
        "todo",
        "update_item",
        {"entity_id": einkaufsliste, "item": "H-Milch (Vorrat)", "status": "completed"},
        blocking=True,
    )
    await hass.services.async_call(
        DOMAIN, "einlagern", {"produkt": "h-milch", "menge": 13}, blocking=True
    )
    freezer.tick(6)
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    offen = await items(hass, einkaufsliste, ["needs_action"])
    assert "H-Milch (Vorrat)" not in {i["summary"] for i in offen}

    # wieder entnommen: kommt erneut auf die Liste, obwohl ein erledigter Eintrag existiert
    await hass.services.async_call(
        DOMAIN, "entnehmen", {"produkt": "h-milch", "menge": 1}, blocking=True
    )
    freezer.tick(6)
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    offen = await items(hass, einkaufsliste, ["needs_action"])
    assert [i["summary"] for i in offen].count("H-Milch (Vorrat)") == 1


@pytest.mark.parametrize(
    "options",
    [{"notify_dienst": "notify.handy", "wochentag": "sat", "uhrzeit": "10:00:00", "warn_tage": 30}],
)
async def test_wochenbericht(
    hass: HomeAssistant, freezer: FrozenDateTimeFactory, config_entry: MockConfigEntry
) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    await hass.config.async_set_time_zone("Europe/Berlin")
    assert await async_setup_component(hass, "http", {})
    config_entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    await hass.services.async_call(
        DOMAIN, "einlagern", {"produkt": "h-milch", "menge": 2, "mhd": "2026-11-30"}, blocking=True
    )

    freezer.move_to("2026-11-21 09:00:00+00:00")  # Samstag 10:00 in Berlin
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert len(calls) == 1
    assert calls[0].data["title"] == "Vorratskeller: Wochenbericht"
    assert "• H-Milch: 2 (in 9 Tagen)" in calls[0].data["message"]
    assert "Unter Soll:" in calls[0].data["message"]

    freezer.move_to("2026-11-22 09:00:00+00:00")  # Sonntag: nichts
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert len(calls) == 1

    await hass.services.async_call(DOMAIN, "bericht_senden", {}, blocking=True)
    assert len(calls) == 2


async def test_bericht_without_target(
    hass: HomeAssistant, setup_integration: MockConfigEntry
) -> None:
    with pytest.raises(ServiceValidationError) as err:
        await hass.services.async_call(DOMAIN, "bericht_senden", {}, blocking=True)
    assert err.value.translation_key == "no_notify_target"


async def test_config_flow_and_options(hass: HomeAssistant) -> None:
    assert await async_setup_component(hass, "http", {})
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"checkliste": True, "personen": 2, "tage": 10}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    entry = result["result"]
    assert entry.data == {"checkliste": True, "personen": 2, "tage": 10}
    await hass.async_block_till_done()
    assert hass.states.get("sensor.vorratskeller_h_milch").attributes["soll"] == 5

    # nur ein Eintrag erlaubt
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "single_instance_allowed"

    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        {
            "notify_dienst": "notify.handy",
            "wochentag": "fri",
            "uhrzeit": "18:30:00",
            "warn_tage": 14,
            "open_food_facts": False,
        },
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert entry.options["warn_tage"] == 14
    assert hass.states.get("sensor.vorratskeller_bald_ablaufend").attributes["warn_tage"] == 14


async def test_ohne_checkliste(hass: HomeAssistant) -> None:
    assert await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={"checkliste": False}, options={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.runtime_data.lager.produkte == {}
    assert hass.states.get("sensor.vorratskeller_reichweite").state == "unknown"


@pytest.mark.parametrize("options", [{"einkaufsliste": "todo.shopping_list"}])
async def test_einkaufsliste_parallel_ohne_dubletten(
    hass: HomeAssistant, einkaufsliste: str, setup_integration: MockConfigEntry
) -> None:
    import asyncio

    manager = setup_integration.runtime_data
    await asyncio.gather(*(manager.async_sync_einkaufsliste() for _ in range(3)))
    liste = await items(hass, einkaufsliste)
    summaries = [i["summary"] for i in liste]
    assert len(summaries) == len(set(summaries)) == len(manager.lager.fehlende())
