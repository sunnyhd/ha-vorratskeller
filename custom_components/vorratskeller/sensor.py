"""Sensoren: Bestand je Produkt und Übersicht des Vorrats."""

from __future__ import annotations

from datetime import date
from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.const import PERCENTAGE, UnitOfTime
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import (
    DEFAULT_ICON,
    DOMAIN,
    NAME,
    SIGNAL_PRODUCT_ADDED,
    SIGNAL_PRODUCT_REMOVED,
    SIGNAL_UPDATED,
)
from .manager import VorratskellerConfigEntry, VorratskellerManager

PARALLEL_UPDATES = 0


async def async_setup_entry(
    hass: HomeAssistant,
    entry: VorratskellerConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Lege die Sensoren an."""
    manager = entry.runtime_data
    entities: list[SensorEntity] = [
        FehlendSensor(manager),
        AblaufendSensor(manager),
        ReichweiteSensor(manager),
        AbdeckungSensor(manager),
    ]
    entities.extend(ProduktSensor(manager, pid) for pid in manager.lager.produkte)
    async_add_entities(entities)

    @callback
    def produkt_neu(produkt_id: str) -> None:
        async_add_entities([ProduktSensor(manager, produkt_id)])

    @callback
    def produkt_weg(produkt_id: str) -> None:
        registry = er.async_get(hass)
        if entity_id := registry.async_get_entity_id("sensor", DOMAIN, f"produkt_{produkt_id}"):
            registry.async_remove(entity_id)

    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_PRODUCT_ADDED, produkt_neu))
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_PRODUCT_REMOVED, produkt_weg))


class VorratSensor(SensorEntity):
    """Gemeinsame Basis: ein Gerät „Vorratskeller“, Aktualisierung per Signal."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, manager: VorratskellerManager) -> None:
        self.manager = manager
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, manager.entry.entry_id)},
            name=NAME,
            entry_type=DeviceEntryType.SERVICE,
        )

    async def async_added_to_hass(self) -> None:
        """Bei Änderungen am Lagerbuch neu schreiben."""
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_UPDATED, self._handle_update)
        )

    @callback
    def _handle_update(self) -> None:
        self.async_write_ha_state()

    @property
    def heute(self) -> date:
        """Heutiges Datum."""
        return self.manager.today()


class ProduktSensor(VorratSensor):
    """Bestand eines Produkts in Packungen."""

    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_suggested_display_precision = 0
    _unrecorded_attributes = frozenset({"chargen", "barcodes", "hinweis", "fach", "packung"})

    def __init__(self, manager: VorratskellerManager, produkt_id: str) -> None:
        super().__init__(manager)
        self.produkt_id = produkt_id
        self._attr_unique_id = f"produkt_{produkt_id}"
        # Entitäts-ID aus der Kennung, nicht aus dem Namen: bleibt stabil, wenn der Name sich ändert
        self.entity_id = f"sensor.{DOMAIN}_{produkt_id.replace('-', '_')}"

    @property
    def available(self) -> bool:
        """Nur solange das Produkt existiert."""
        return self.produkt_id in self.manager.lager.produkte

    @property
    def name(self) -> str | None:
        """Name des Produkts."""
        produkt = self.manager.lager.produkte.get(self.produkt_id)
        return produkt.name if produkt else self.produkt_id

    @property
    def icon(self) -> str:
        """Symbol der Gruppe."""
        lager = self.manager.lager
        if (produkt := lager.produkte.get(self.produkt_id)) and (
            gruppe := lager.gruppen.get(produkt.gruppe)
        ):
            return gruppe.icon or DEFAULT_ICON
        return DEFAULT_ICON

    @property
    def native_value(self) -> float | None:
        """Bestand."""
        if not self.available:
            return None
        return self.manager.lager.bestand(self.produkt_id)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Soll, Fehlmenge, MHD und Chargen."""
        lager = self.manager.lager
        produkt = lager.produkte.get(self.produkt_id)
        if produkt is None:
            return {}
        mhd = lager.naechstes_mhd(self.produkt_id)
        gruppe = lager.gruppen.get(produkt.gruppe)
        return {
            "produkt_id": produkt.id,
            "produkt_name": produkt.name,
            "gruppe": gruppe.name if gruppe else produkt.gruppe,
            "fach": produkt.fach,
            "packung": produkt.packung,
            "soll": produkt.soll,
            "fehlt": lager.fehlt(produkt.id),
            "naechstes_mhd": mhd.isoformat() if mhd else None,
            "tage_bis_mhd": (mhd - self.heute).days if mhd else None,
            "haltbarkeit_monate": produkt.haltbarkeit_monate,
            "hinweis": produkt.hinweis,
            "barcodes": list(produkt.barcodes),
            "chargen": [
                {"menge": c.menge, "mhd": c.mhd, "eingelagert": c.eingelagert}
                for c in lager.chargen_von(produkt.id)
            ],
        }


class FehlendSensor(VorratSensor):
    """Anzahl der Produkte unter Soll."""

    _attr_translation_key = "fehlend"
    _attr_icon = "mdi:cart-arrow-down"
    # Einheiten übersetzt HA nur auf Englisch, daher fest auf Deutsch
    _attr_native_unit_of_measurement = "Produkte"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _unrecorded_attributes = frozenset({"produkte"})

    def __init__(self, manager: VorratskellerManager) -> None:
        super().__init__(manager)
        self._attr_unique_id = "fehlend"
        self.entity_id = f"sensor.{DOMAIN}_fehlende_produkte"

    @property
    def native_value(self) -> int:
        """Anzahl."""
        return len(self.manager.lager.fehlende())

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Liste der fehlenden Produkte."""
        return {
            "produkte": [
                {"id": p.id, "name": p.name, "fehlt": fehlt, "packung": p.packung, "fach": p.fach}
                for p, fehlt in self.manager.lager.fehlende()
            ]
        }


class AblaufendSensor(VorratSensor):
    """Anzahl der Chargen, die bald ablaufen oder abgelaufen sind."""

    _attr_translation_key = "ablaufend"
    _attr_icon = "mdi:calendar-alert"
    _attr_native_unit_of_measurement = "Chargen"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _unrecorded_attributes = frozenset({"chargen"})

    def __init__(self, manager: VorratskellerManager) -> None:
        super().__init__(manager)
        self._attr_unique_id = "ablaufend"
        self.entity_id = f"sensor.{DOMAIN}_bald_ablaufend"

    @property
    def native_value(self) -> int:
        """Anzahl."""
        return len(self.manager.lager.ablaufend(self.heute, self.manager.warn_tage))

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Chargen mit Tagen bis zum MHD (negativ: abgelaufen)."""
        lager = self.manager.lager
        chargen = lager.ablaufend(self.heute, self.manager.warn_tage)
        return {
            "warn_tage": self.manager.warn_tage,
            "abgelaufen": sum(1 for _, tage in chargen if tage < 0),
            "chargen": [
                {
                    "produkt_id": c.produkt,
                    "name": lager.produkte[c.produkt].name,
                    "menge": c.menge,
                    "mhd": c.mhd,
                    "tage": tage,
                }
                for c, tage in chargen
            ],
        }


class ReichweiteSensor(VorratSensor):
    """Wie viele Tage der Vorrat reicht, bestimmt durch die knappste Gruppe."""

    _attr_translation_key = "reichweite"
    _attr_icon = "mdi:calendar-clock"
    _attr_device_class = SensorDeviceClass.DURATION
    _attr_native_unit_of_measurement = UnitOfTime.DAYS
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_suggested_display_precision = 1

    def __init__(self, manager: VorratskellerManager) -> None:
        super().__init__(manager)
        self._attr_unique_id = "reichweite"
        self.entity_id = f"sensor.{DOMAIN}_reichweite"

    @property
    def native_value(self) -> float | None:
        """Tage."""
        return self.manager.lager.reichweite()[0]

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Tage je Gruppe und die knappste Gruppe."""
        lager = self.manager.lager
        _, je_gruppe = lager.reichweite()
        namen = {gid: lager.gruppen[gid].name for gid in je_gruppe}
        engpass = min(je_gruppe, key=je_gruppe.__getitem__) if je_gruppe else None
        return {
            "gruppen": {namen[gid]: tage for gid, tage in je_gruppe.items()},
            "engpass": namen[engpass] if engpass else None,
        }


class AbdeckungSensor(VorratSensor):
    """Anteil des Solls, der vorhanden ist."""

    _attr_translation_key = "abdeckung"
    _attr_icon = "mdi:warehouse"
    _attr_native_unit_of_measurement = PERCENTAGE
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_suggested_display_precision = 0

    def __init__(self, manager: VorratskellerManager) -> None:
        super().__init__(manager)
        self._attr_unique_id = "abdeckung"
        self.entity_id = f"sensor.{DOMAIN}_vorratsstand"

    @property
    def native_value(self) -> float | None:
        """Prozent."""
        return self.manager.lager.abdeckung()
