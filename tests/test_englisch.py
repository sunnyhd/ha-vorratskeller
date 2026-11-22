"""Englische Systemsprache: Checkliste, Einheiten, Bericht und Einkaufsliste auf Englisch."""

from __future__ import annotations

import json

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.vorratskeller.const import DOMAIN, GRUPPEN_ICONS
from custom_components.vorratskeller.lager import make_id
from custom_components.vorratskeller.seed import CHECKLISTE_EN_PATH, CHECKLISTE_PATH
from custom_components.vorratskeller.texte import text


def test_checklisten_gleich_aufgebaut() -> None:
    """Englische Checkliste: gleiche Gruppen, Produkte und Zahlen wie die deutsche."""
    de = json.loads(CHECKLISTE_PATH.read_text(encoding="utf-8"))
    en = json.loads(CHECKLISTE_EN_PATH.read_text(encoding="utf-8"))
    assert len(de) == len(en)
    for g_de, g_en in zip(de, en, strict=True):
        assert g_de[1:3] == g_en[1:3]
        assert len(g_de[4]) == len(g_en[4])
        for p_de, p_en in zip(g_de[4], g_en[4], strict=True):
            assert [p_de[2], p_de[4], p_de[5]] == [p_en[2], p_en[4], p_en[5]]
        assert make_id(g_en[0]) in GRUPPEN_ICONS
        assert make_id(g_de[0]) in GRUPPEN_ICONS
    namen = [p[0] for g in en for p in g[4]]
    assert len({make_id(n) for n in namen}) == len(namen)


@pytest.mark.parametrize("sprache", ["en"])
async def test_englische_erstbefuellung(hass: HomeAssistant, setup_integration) -> None:
    milch = hass.states.get("sensor.vorratskeller_uht_milk")
    assert milch is not None
    assert milch.attributes["produkt_name"] == "UHT milk"
    assert milch.attributes["fach"] == "Right, bottom shelf"
    assert milch.attributes["icon"] == "mdi:cheese"
    fehlend = hass.states.get("sensor.vorratskeller_fehlende_produkte")
    assert fehlend.attributes["unit_of_measurement"] == "products"
    ablaufend = hass.states.get("sensor.vorratskeller_bald_ablaufend")
    assert ablaufend.attributes["unit_of_measurement"] == "batches"


@pytest.mark.parametrize(
    "options",
    [{"notify_dienst": "notify.handy", "wochentag": "sat", "uhrzeit": "10:00:00", "warn_tage": 30}],
)
async def test_englischer_bericht(hass: HomeAssistant, config_entry: MockConfigEntry) -> None:
    calls = async_mock_service(hass, "notify", "handy")
    hass.config.language = "en"
    assert await async_setup_component(hass, "http", {})
    config_entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    await hass.services.async_call(DOMAIN, "bericht_senden", {}, blocking=True)
    assert calls[0].data["title"] == "Pantry: weekly report"
    assert "Below target:" in calls[0].data["message"]


@pytest.mark.parametrize("sprache", ["en"])
async def test_englische_einkaufsliste(hass: HomeAssistant, setup_integration) -> None:
    manager = setup_integration.runtime_data
    assert text(hass, "einkauf_suffix") == " (pantry)"
    assert text(hass, "einkauf_beschreibung", fehlt="3", packung="jars") == "3 jars missing"
    assert manager.lager.produkte["uht-milk"].packung == "× 1 l"
