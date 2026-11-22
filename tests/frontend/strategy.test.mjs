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
  assert.deepEqual(dash.views.map((v) => v.path), ["uebersicht", "regal", "keller", "scanner", "bestand", "einkauf", "etiketten"]);
  const bestand = dash.views.find((v) => v.path === "bestand");
  assert.equal(bestand.sections.length, 2);
  assert.equal(bestand.sections[0].cards[0].heading, "Fisch, Fleisch, Eier");
  assert.equal(bestand.sections[1].cards[1].entity, "sensor.vorratskeller_h_milch");
  assert.ok(defined.get("vorratskeller-card"));
  assert.ok(window.customStrategies.some((s) => s.type === "vorratskeller" && s.strategyType === "dashboard"));
  assert.ok(window.customCards.some((c) => c.type === "vorratskeller-card"));
});

test("Leeres Dashboard mit Hinweis und Scanner", async () => {
  const dash = mod.generateDashboard({ states: {}, entities: {} });
  assert.deepEqual(dash.views.map((v) => v.path), ["uebersicht", "scanner"]);
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

test("Englisch, wenn der Benutzer HA auf Englisch nutzt", async () => {
  const en = { ...hass, locale: { language: "en" } };
  const dash = mod.generateDashboard(en);
  assert.deepEqual(
    dash.views.map((v) => v.title),
    ["Overview", "Shelves", "Take out", "Scanner", "Stock", "Shopping", "Labels"],
  );
  assert.equal(mod.t("in_tagen", { tage: 3 }), "in 3 days");
  const leer = mod.generateDashboard({ states: {}, entities: {}, locale: { language: "en-GB" } });
  assert.match(leer.views[0].cards[0].content, /No products yet/);
  // zurück auf Deutsch
  const de = mod.generateDashboard({ ...hass, locale: { language: "de" } });
  assert.equal(de.views[0].title, "Übersicht");
  assert.equal(mod.t("in_tagen", { tage: 3 }), "in 3 Tagen");
});

test("Regale und Böden aus den Fachnamen, oben zuerst", () => {
  assert.deepEqual(mod.regalUndBoden("Links, dritter Boden"), { regal: "Links", boden: "dritter Boden", rang: 3 });
  assert.equal(mod.regalUndBoden("Right, bottom shelf").rang, 0);
  assert.equal(mod.regalUndBoden("Weißes Regal").regal, "Weißes Regal");
  const p = (id, fach) => ({ id, fach, fach_id: mod.makeId(fach), name: id, bestand: 0, soll: 0, fehlt: 0 });
  const r = mod.regale([p("a", "Links, unterster Boden"), p("b", "Links, oberster Boden"), p("c", "Rechts, zweiter Boden")]);
  assert.deepEqual(r.map((x) => x.name), ["Links", "Rechts"]);
  assert.deepEqual(r[0].boeden.map((b) => b.boden), ["oberster Boden", "unterster Boden"]);
  assert.equal(mod.zustand({ soll: 4, bestand: 0, fehlt: 4 }), "leer");
  assert.equal(mod.zustand({ soll: 4, bestand: 2, fehlt: 2 }), "knapp");
  assert.equal(mod.zustand({ soll: 4, bestand: 4, fehlt: 0 }), "ok");
  assert.equal(mod.zustand({ soll: 0, bestand: 1, fehlt: 0 }), "frei");
});
