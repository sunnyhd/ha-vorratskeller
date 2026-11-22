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
  assert.deepEqual(dash.views.map((v) => v.path), ["uebersicht", "regal", "3d", "keller", "scanner", "bestand", "einkauf", "etiketten", "panel"]);
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
    ["Overview", "Shelves", "3D", "Take out", "Scanner", "Stock", "Shopping", "Labels", "Panel"],
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

test("Gefäßform aus Packung und Hinweis", () => {
  const f = (name, packung = "", hinweis = "") => mod.form({ name, packung, hinweis });
  assert.equal(f("Mineralwasser", "Kästen"), "kasten");
  assert.equal(f("Thunfisch", "× 150 g", "Dose"), "dose");
  assert.equal(f("Rote Bete", "× 460 g", "Glas"), "glas");
  assert.equal(f("H-Milch", "× 1 l"), "flasche");
  assert.equal(f("Rapsöl", "× 0,5 l"), "flasche");
  assert.equal(f("Haferflocken", "× 500 g"), "packung");
  assert.equal(f("Taschenlampen"), "kiste");
  assert.equal(f("Chopped tomatoes", "× 400 g", "can or jar"), "dose");
  assert.equal(mod.form({ name: "Eier", packung: "Stück", hinweis: "", form: "packung" }), "packung");
  assert.equal(mod.form({ name: "Eier", packung: "Stück", hinweis: "", form: "unsinn" }), "kiste");
});

test("Vorschlag für Titel und Symbol beim Anlegen", () => {
  const Strategy = defined.get("ll-strategy-dashboard-vorratskeller");
  assert.deepEqual(Strategy.getCreateSuggestions({ locale: { language: "de" } }), { title: "Vorratskeller", icon: "mdi:warehouse" });
  assert.deepEqual(Strategy.getCreateSuggestions({ locale: { language: "en" } }), { title: "Pantry", icon: "mdi:warehouse" });
  Strategy.getCreateSuggestions({ locale: { language: "de" } });
});

test("Ohne Bestand kein Verlauf in der Übersicht", () => {
  const leer = { ...hass, states: { ...hass.states } };
  for (const id of ["sensor.vorratskeller_h_milch", "sensor.vorratskeller_eier"]) leer.states[id] = { ...hass.states[id], state: "0" };
  const typen = (d) => d.views[0].sections.flatMap((x) => x.cards.map((c) => c.type));
  assert.ok(!typen(mod.generateDashboard(leer)).includes("history-graph"));
  assert.ok(typen(mod.generateDashboard(hass)).includes("history-graph"));
});

test("3D: Böden, Aufstellung und Plätze", () => {
  assert.equal(mod.bodenIndex(0, 5), 0);
  assert.equal(mod.bodenIndex(2, 5), 1);
  assert.equal(mod.bodenIndex(3, 5), 2);
  assert.equal(mod.bodenIndex(9, 5), 4);
  assert.equal(mod.bodenIndex(4, 3), 2);
  const p = (id, fach, packung = "× 400 g", hinweis = "Dose") =>
    ({ id, name: id, fach, fach_id: mod.makeId(fach), packung, hinweis, bestand: 1, soll: 2, fehlt: 1 });
  const liste = [p("a", "Links, unterster Boden"), p("b", "Links, dritter Boden"), p("c", "Weißes Regal", "", "")];
  const auto = mod.raumAufbau(liste);
  assert.deepEqual(auto.regale.map((r) => r.name), ["Links", "Weißes Regal"]);
  assert.ok(auto.regale[1].x > auto.regale[0].x);
  const cfg = { raum: { breite: 3, tiefe: 4 }, regale: [{ name: "links", x: 0.25, z: 2.55, laenge: 2.4, boeden: 5, drehung: 90 }] };
  const fest = mod.raumAufbau(liste, cfg);
  assert.equal(fest.regale[0].boeden, 5);
  assert.equal(fest.regale[0].drehung, 90);
  const plaetze = mod.platzieren(fest.regale[0]);
  assert.deepEqual(plaetze.map((x) => [x.produkt.id, x.boden]), [["a", 0], ["b", 2]]);
  // viele Produkte werden auf die Regallänge gestaucht
  const viele = Array.from({ length: 40 }, (_, i) => p(`p${i}`, "Rechts, dritter Boden"));
  const r = mod.raumAufbau(viele, { regale: [{ name: "Rechts", x: 1, z: 1, laenge: 1 }] }).regale[0];
  const xs = mod.platzieren(r).map((x) => x.x);
  assert.ok(Math.min(...xs) >= -0.5 && Math.max(...xs) <= 0.5);
});

test("Etiketten: Positionen auf dem Bogen", () => {
  const l = mod.etikettenPositionen("L4776", 3);
  assert.deepEqual(l[0], { seite: 0, x: 4.65, y: 21.6 });
  assert.deepEqual(l[1], { seite: 0, x: 106.25, y: 21.6 });
  assert.deepEqual(l[2], { seite: 0, x: 4.65, y: 63.9 });
  const z = mod.etikettenPositionen("3474", 25, 1);
  assert.equal(z[23].seite, 0);
  assert.equal(z[24].seite, 1);
  assert.deepEqual(z[0], { seite: 0, x: 0, y: 0.5 });
  const ab = mod.etikettenPositionen("L4776", 2, 12);
  assert.deepEqual(ab.map((p) => p.seite), [0, 1]);
});
