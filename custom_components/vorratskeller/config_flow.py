"""Einrichtung und Optionen der Integration Vorratskeller."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import (
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlowWithReload,
)
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    BooleanSelector,
    EntitySelector,
    EntitySelectorConfig,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TimeSelector,
)
import voluptuous as vol

from .const import (
    CONF_CHECKLISTE,
    CONF_EINKAUFSLISTE,
    CONF_NOTIFY,
    CONF_OPEN_FOOD_FACTS,
    CONF_PERSONEN,
    CONF_TAGE,
    CONF_UHRZEIT,
    CONF_WARN_TAGE,
    CONF_WOCHENTAG,
    DEFAULT_PERSONEN,
    DEFAULT_TAGE,
    DEFAULT_UHRZEIT,
    DEFAULT_WARN_TAGE,
    DEFAULT_WOCHENTAG,
    DOMAIN,
    NAME,
    WOCHENTAGE,
)
from .manager import VorratskellerConfigEntry


class VorratskellerConfigFlow(ConfigFlow, domain=DOMAIN):
    """Einrichtung: Erstbefüllung aus der Checkliste wählen."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Einziger Schritt."""
        if user_input is not None:
            return self.async_create_entry(
                title=NAME,
                data={
                    CONF_CHECKLISTE: user_input[CONF_CHECKLISTE],
                    CONF_PERSONEN: int(user_input[CONF_PERSONEN]),
                    CONF_TAGE: int(user_input[CONF_TAGE]),
                },
                options={
                    CONF_WARN_TAGE: DEFAULT_WARN_TAGE,
                    CONF_WOCHENTAG: DEFAULT_WOCHENTAG,
                    CONF_UHRZEIT: DEFAULT_UHRZEIT,
                    CONF_OPEN_FOOD_FACTS: True,
                },
            )
        schema = vol.Schema(
            {
                vol.Required(CONF_CHECKLISTE, default=True): BooleanSelector(),
                vol.Required(CONF_PERSONEN, default=DEFAULT_PERSONEN): NumberSelector(
                    NumberSelectorConfig(min=1, max=20, step=1, mode=NumberSelectorMode.BOX)
                ),
                vol.Required(CONF_TAGE, default=DEFAULT_TAGE): NumberSelector(
                    NumberSelectorConfig(min=1, max=90, step=1, mode=NumberSelectorMode.BOX)
                ),
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: VorratskellerConfigEntry) -> VorratskellerOptionsFlow:
        """Optionen."""
        return VorratskellerOptionsFlow()


class VorratskellerOptionsFlow(OptionsFlowWithReload):
    """Einkaufsliste, Push-Nachricht, Vorlauf und Open Food Facts."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Einziger Schritt."""
        if user_input is not None:
            data = dict(user_input)
            data[CONF_WARN_TAGE] = int(data[CONF_WARN_TAGE])
            return self.async_create_entry(data=data)

        options = self.config_entry.options
        notify_ziele = sorted(
            {f"notify.{name}" for name in self.hass.services.async_services_for_domain("notify")}
            - {"notify.send_message", "notify.persistent_notification"}
            | set(self.hass.states.async_entity_ids("notify"))
        )
        schema = vol.Schema(
            {
                vol.Optional(
                    CONF_EINKAUFSLISTE,
                    description={"suggested_value": options.get(CONF_EINKAUFSLISTE)},
                ): EntitySelector(EntitySelectorConfig(domain="todo")),
                vol.Optional(
                    CONF_NOTIFY,
                    description={"suggested_value": options.get(CONF_NOTIFY)},
                ): SelectSelector(
                    SelectSelectorConfig(
                        options=[SelectOptionDict(value=z, label=z) for z in notify_ziele],
                        custom_value=True,
                        mode=SelectSelectorMode.DROPDOWN,
                    )
                ),
                vol.Required(
                    CONF_WOCHENTAG, default=options.get(CONF_WOCHENTAG, DEFAULT_WOCHENTAG)
                ): SelectSelector(
                    SelectSelectorConfig(
                        options=WOCHENTAGE,
                        translation_key="wochentag",
                        mode=SelectSelectorMode.DROPDOWN,
                    )
                ),
                vol.Required(
                    CONF_UHRZEIT, default=options.get(CONF_UHRZEIT, DEFAULT_UHRZEIT)
                ): TimeSelector(),
                vol.Required(
                    CONF_WARN_TAGE, default=options.get(CONF_WARN_TAGE, DEFAULT_WARN_TAGE)
                ): NumberSelector(
                    NumberSelectorConfig(min=1, max=365, step=1, mode=NumberSelectorMode.BOX)
                ),
                vol.Required(
                    CONF_OPEN_FOOD_FACTS, default=options.get(CONF_OPEN_FOOD_FACTS, True)
                ): BooleanSelector(),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
