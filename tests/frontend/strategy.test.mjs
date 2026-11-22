// Tests der Strategie und der Hilfen ohne Browser: node --test tests/frontend/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

// Minimale Browser-Umgebung für den Import
globalThis.window = globalThis;
globalThis.HTMLElement = class {};
const defined = new Map();
globalThis.customElements = { get: (n) => defined.get(n), define: (n, c) => defined.set(n, c) };

const mod = await import("../../custom_components/vorratskeller/frontend/vorratskeller.js");

const sensor = (id, attrs, state = "0") => ({ state, attributes: { produkt_id: id, ...attrs } });
const hass = {
  entities: {
    "sensor.vorratskeller_h_milch": { platform: "vorratskeller" },
    "sensor.vorratskeller_eier": { platform: "vorratskeller" },
    "sensor.fremd": { platform: "anderes" },
  },
  states: {
    "sensor.vorratskeller_h_milch": sensor("h-milch", {
      produkt_name: "H-Milch", gruppe: "Milch, Milchprodukte", fach: "Rechts, unterster Boden",
      soll: 13, fehlt: 10, icon: "mdi:cheese",
    }, "3"),
    "sensor.vorratskeller_eier": sensor("eier", {
      produkt_name: "Eier", gruppe: "Fisch, Fleisch, Eier", fach: "Links, dritter Boden", soll: 20, fehlt: 0,
    }, "20"),
    "sensor.fremd": sensor("x", { produkt_name: "Fremd" }),
    "sensor.vorratskeller_fehlende_produkte": { state: "1", attributes: {} },
  },
};

test("Produkte nur aus der eigenen Integration", () => {
  const liste = mod.produkte(hass);
  assert.deepEqual(liste.map((p) => p.id), ["eier", "h-milch"]);
  assert.equal(liste[1].bestand, 3);
  assert.equal(liste[1].fach_id, "rechts-unterster-boden");
});

test("Fächer gruppieren", () => {
  const f = mod.faecher(mod.produkte(hass));
  assert.deepEqual(f.map((x) => x.id), ["links-dritter-boden", "rechts-unterster-boden"]);
});

test("Dashboard enthält alle Ansichten und Karten", async () => {
  const Strategy = defined.get("ll-strategy-dashboard-vorratskeller");
  const dash = await Strategy.generate({}, hass);
  assert.deepEqual(dash.views.map((v) => v.path), ["uebersicht", "keller", "scanner", "bestand", "einkauf", "etiketten"]);
  const bestand = dash.views.find((v) => v.path === "bestand");
  assert.equal(bestand.sections.length, 2);
  assert.equal(bestand.sections[0].cards[0].heading, "Fisch, Fleisch, Eier");
  assert.equal(bestand.sections[1].cards[1].entity, "sensor.vorratskeller_h_milch");
  assert.ok(defined.get("vorratskeller-card"));
  assert.ok(window.customStrategies.some((s) => s.type === "vorratskeller" && s.strategyType === "dashboard"));
  assert.ok(window.customCards.some((c) => c.type === "vorratskeller-card"));
});

test("Leeres Dashboard mit Hinweis", async () => {
  const dash = mod.generateDashboard({ states: {}, entities: {} });
  assert.equal(dash.views.length, 1);
  assert.match(dash.views[0].cards[0].content, /Integration/);
});

test("makeId wie make_id in Python", () => {
  const namen = ["Getränke", "Für den Raum", "Rechts, zweiter und dritter Boden, in Eimern", "Weißes Regal", "!!!",
    "Hausapotheke (BBK)", "x".repeat(70)];
  const py = execFileSync(".venv/bin/python", ["-c",
    "import json,sys;from custom_components.vorratskeller.lager import make_id;" +
    "print(json.dumps([make_id(n) for n in json.loads(sys.argv[1])]))", JSON.stringify(namen)]).toString();
  assert.deepEqual(namen.map(mod.makeId), JSON.parse(py));
});
