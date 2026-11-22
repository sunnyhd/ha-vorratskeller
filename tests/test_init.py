"""Integration in Home Assistant: Einrichtung, Dienste, Sensoren, Speicher."""

from __future__ import annotations

from typing import Any

from freezegun.api import FrozenDateTimeFactory
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import entity_registry as er
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed
from pytest_homeassistant_custom_component.typing import ClientSessionGenerator
import voluptuous as vol

from custom_components.vorratskeller.const import DOMAIN
from custom_components.vorratskeller.seed import load_checkliste

MILCH = "sensor.vorratskeller_h_milch"

pytestmark = pytest.mark.freeze_time("2026-11-22 11:00:00+00:00")


async def call(
    hass: HomeAssistant, service: str, data: dict[str, Any], response: bool = True
) -> Any:
    return await hass.services.async_call(
        DOMAIN, service, data, blocking=True, return_response=response
    )


async def test_setup_seeds_products_and_sensors(
    hass: HomeAssistant, setup_integration: MockConfigEntry, entity_registry: er.EntityRegistry
) -> None:
    assert setup_integration.state is ConfigEntryState.LOADED
    n_items = sum(len(g[4]) for g in load_checkliste())
    entries = er.async_entries_for_config_entry(entity_registry, setup_integration.entry_id)
    assert len(entries) == n_items + 4

    state = hass.states.get(MILCH)
    assert state is not None
    assert state.state == "0.0"
    assert state.attributes["soll"] == 13
    assert state.attributes["fehlt"] == 13
    assert state.attributes["friendly_name"] == "Vorratskeller H-Milch"

    assert hass.states.get("sensor.vorratskeller_fehlende_produkte").state == str(
        len(setup_integration.runtime_data.lager.fehlende())
    )
    assert hass.states.get("sensor.vorratskeller_vorratsstand").state == "0.0"
    assert hass.states.get("sensor.vorratskeller_reichweite").state == "0.0"


async def test_einlagern_entnehmen_fifo(
    hass: HomeAssistant, setup_integration: MockConfigEntry
) -> None:
    await call(hass, "einlagern", {"produkt": "h-milch", "menge": 4, "mhd": "2027-01-10"})
    resp = await call(hass, "einlagern", {"produkt": MILCH, "menge": 2, "mhd": "2026-12-01"})
    assert resp == {"produkt": "h-milch", "bestand": 6, "mhd": "2026-12-01"}
    state = hass.states.get(MILCH)
    assert state.state == "6.0"
    assert state.attributes["naechstes_mhd"] == "2026-12-01"
    assert state.attributes["tage_bis_mhd"] == 9

    resp = await call(hass, "entnehmen", {"produkt": "h-milch", "menge": 3})
    assert resp["entnommen"] == [
        {"menge": 2, "mhd": "2026-12-01"},
        {"menge": 1, "mhd": "2027-01-10"},
    ]
    assert hass.states.get(MILCH).state == "3.0"

    ablaufend = hass.states.get("sensor.vorratskeller_bald_ablaufend")
    assert ablaufend.state == "0"

    with pytest.raises(ServiceValidationError) as err:
        await call(hass, "entnehmen", {"produkt": "h-milch", "menge": 5})
    assert err.value.translation_key == "not_enough_stock"
    assert hass.states.get(MILCH).state == "3.0"


async def test_errors(hass: HomeAssistant, setup_integration: MockConfigEntry) -> None:
    with pytest.raises(ServiceValidationError) as err:
        await call(hass, "einlagern", {"produkt": "gibtsnicht"})
    assert err.value.translation_key == "unknown_product"
    with pytest.raises(ServiceValidationError) as err:
        await call(hass, "einlagern", {})
    assert err.value.translation_key == "product_required"
    with pytest.raises(ServiceValidationError) as err:
        await call(hass, "einlagern", {"barcode": "4006040000006"})
    assert err.value.translation_key == "unknown_barcode"
    # ungültige Prüfziffer
    with pytest.raises(Exception, match="barcode"):
        await call(hass, "einlagern", {"barcode": "4006040000001"})


async def test_barcode_flow(hass: HomeAssistant, setup_integration: MockConfigEntry) -> None:
    await call(hass, "barcode_zuordnen", {"barcode": "4006040000006", "produkt": "h-milch"}, False)
    resp = await call(hass, "barcode_suchen", {"barcode": "4006040000006"})
    assert resp["bekannt"] is True
    assert resp["produkt"]["id"] == "h-milch"
    await call(hass, "einlagern", {"barcode": "4006040000006", "menge": 2})
    assert hass.states.get(MILCH).state == "2.0"
    assert hass.states.get(MILCH).attributes["barcodes"] == ["4006040000006"]


async def test_barcode_suchen_open_food_facts(
    hass: HomeAssistant, setup_integration: MockConfigEntry, aioclient_mock
) -> None:
    aioclient_mock.get(
        "https://world.openfoodfacts.org/api/v2/product/4000417025005.json",
        json={
            "status": 1,
            "product": {
                "product_name_de": "Bio-Haferflocken",
                "brands": "Marke A, B",
                "quantity": "500 g",
            },
        },
    )
    resp = await call(hass, "barcode_suchen", {"barcode": "4000417025005"})
    assert resp == {
        "bekannt": False,
        "produkt": None,
        "vorschlag": {"name": "Bio-Haferflocken", "marke": "Marke A", "menge": "500 g"},
    }
    # Nur die Nummer geht nach außen: keine weiteren Parameter als die Feldliste, keine Cookies
    assert aioclient_mock.call_count == 1
    _method, url, data, headers = aioclient_mock.mock_calls[0]
    assert str(url).startswith("https://world.openfoodfacts.org/api/v2/product/4000417025005.json")
    assert data is None
    assert set(url.query) == {"fields"}
    assert headers["User-Agent"].startswith("HomeAssistant-Vorratskeller/")

    aioclient_mock.clear_requests()
    aioclient_mock.get(
        "https://world.openfoodfacts.org/api/v2/product/4006040000006.json", status=404
    )
    resp = await call(hass, "barcode_suchen", {"barcode": "4006040000006"})
    assert resp["vorschlag"] is None


@pytest.mark.parametrize("options", [{"open_food_facts": False}])
async def test_barcode_suchen_without_open_food_facts(
    hass: HomeAssistant, setup_integration: MockConfigEntry, aioclient_mock
) -> None:
    resp = await call(hass, "barcode_suchen", {"barcode": "4000417025005"})
    assert resp["vorschlag"] is None
    assert aioclient_mock.call_count == 0


async def test_produkt_anlegen_aendern_loeschen(
    hass: HomeAssistant, setup_integration: MockConfigEntry, entity_registry: er.EntityRegistry
) -> None:
    resp = await call(
        hass,
        "produkt_anlegen",
        {
            "name": "Erdnussbutter",
            "gruppe": "obst-nuesse",
            "soll": 2,
            "packung": "× 350 g",
            "packungsmenge": 0.35,
            "haltbarkeit_monate": 12,
            "barcode": "4000417025005",
        },
    )
    assert resp["id"] == "erdnussbutter"
    await hass.async_block_till_done()
    state = hass.states.get("sensor.vorratskeller_erdnussbutter")
    assert state is not None
    assert state.attributes["icon"] == "mdi:food-apple-outline"

    await call(
        hass, "produkt_aendern", {"produkt": "erdnussbutter", "name": "Erdnussmus", "soll": 3}
    )
    await hass.async_block_till_done()
    state = hass.states.get("sensor.vorratskeller_erdnussbutter")
    assert state.attributes["friendly_name"] == "Vorratskeller Erdnussmus"
    assert state.attributes["soll"] == 3

    await call(hass, "produkt_loeschen", {"produkt": "erdnussbutter"}, False)
    await hass.async_block_till_done()
    assert entity_registry.async_get("sensor.vorratskeller_erdnussbutter") is None
    assert hass.states.get("sensor.vorratskeller_erdnussbutter") is None


async def test_inventur_and_persistence(
    hass: HomeAssistant, setup_integration: MockConfigEntry, hass_storage: dict
) -> None:
    resp = await call(hass, "inventur", {"produkt": "h-milch", "menge": 5})
    assert resp == {"produkt": "h-milch", "bestand": 5, "differenz": 5}
    await hass.config_entries.async_reload(setup_integration.entry_id)
    await hass.async_block_till_done()
    assert hass.states.get(MILCH).state == "5.0"
    saved = hass_storage[DOMAIN]["data"]
    assert saved["chargen"][0]["produkt"] == "h-milch"
    assert saved["journal"][-1]["aktion"] == "inventur"


async def test_daily_update_of_expiry(
    hass: HomeAssistant, setup_integration: MockConfigEntry, freezer: FrozenDateTimeFactory
) -> None:
    await call(hass, "einlagern", {"produkt": "h-milch", "menge": 1, "mhd": "2026-12-30"})
    assert hass.states.get("sensor.vorratskeller_bald_ablaufend").state == "0"
    freezer.move_to("2026-12-01 23:00:10+00:00")  # 00:00:10 in Berlin
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert hass.states.get("sensor.vorratskeller_bald_ablaufend").state == "1"
    assert hass.states.get(MILCH).attributes["tage_bis_mhd"] == 28


async def test_frontend_served(
    hass: HomeAssistant, setup_integration: MockConfigEntry, hass_client: ClientSessionGenerator
) -> None:
    client = await hass_client()
    resp = await client.get("/vorratskeller_static/vorratskeller.js")
    assert resp.status == 200


async def test_keine_unendlichen_zahlen(
    hass: HomeAssistant, setup_integration: MockConfigEntry
) -> None:
    for wert in ("inf", "nan", "-inf"):
        with pytest.raises(vol.Invalid):
            await call(hass, "produkt_aendern", {"produkt": "h-milch", "soll": wert})
        with pytest.raises(vol.Invalid):
            await call(hass, "einlagern", {"produkt": "h-milch", "menge": wert})
    assert hass.states.get(MILCH).attributes["soll"] == 13


async def test_rechte(hass: HomeAssistant, setup_integration: MockConfigEntry) -> None:
    from homeassistant.auth.const import GROUP_ID_READ_ONLY, GROUP_ID_USER
    from homeassistant.core import Context
    from homeassistant.exceptions import Unauthorized

    owner = await hass.auth.async_create_user("Eigentümer", group_ids=[GROUP_ID_USER])
    nutzer = await hass.auth.async_create_user("Kellertablet", group_ids=[GROUP_ID_USER])
    assert owner.is_owner
    assert not nutzer.is_admin
    leser = await hass.auth.async_create_user("Leser", group_ids=[GROUP_ID_READ_ONLY])

    async def als(user, service, data):
        return await hass.services.async_call(
            DOMAIN, service, data, blocking=True, context=Context(user_id=user.id)
        )

    # Kellertablet (ohne Admin): ein- und auslagern ja, löschen nein
    await als(nutzer, "einlagern", {"produkt": "h-milch"})
    await als(nutzer, "entnehmen", {"produkt": "h-milch"})
    with pytest.raises(Unauthorized):
        await als(nutzer, "produkt_loeschen", {"produkt": "h-milch"})
    # Nur-Lesen: nichts Schreibendes
    with pytest.raises(Unauthorized):
        await als(leser, "einlagern", {"produkt": "h-milch"})
    with pytest.raises(Unauthorized):
        await als(leser, "produkt_loeschen", {"produkt": "h-milch"})
    assert "h-milch" in setup_integration.runtime_data.lager.produkte


async def test_rueckgaengig_ohne_mhd(
    hass: HomeAssistant, setup_integration: MockConfigEntry
) -> None:
    resp = await call(hass, "einlagern", {"produkt": "h-milch", "ohne_mhd": True})
    assert resp["mhd"] is None
