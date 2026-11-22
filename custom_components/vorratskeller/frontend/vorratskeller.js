/*
 * Vorratskeller: Karte und Dashboard-Strategie für Home Assistant.
 *
 * Karte:      type: custom:vorratskeller-card, modus: entnahme | scanner | fehlend | ablaufend | etiketten
 * Dashboard:  strategy: { type: custom:vorratskeller }
 *
 * Ohne Build-Schritt und ohne Fremdcode zur Laufzeit von außen: Scanner-Rückfall (zxing-wasm)
 * und QR-Erzeugung liegen unter ./vendor und werden erst bei Bedarf geladen.
 */

const DOMAIN = "vorratskeller";
const BASE = new URL(".", import.meta.url).pathname.replace(/\/$/, "");
const QR_FACH = "VK:F:";
const QR_PRODUKT = "VK:P:";
const BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "qr_code"];
const SUMMARY = {
  fehlend: "sensor.vorratskeller_fehlende_produkte",
  ablaufend: "sensor.vorratskeller_bald_ablaufend",
  reichweite: "sensor.vorratskeller_reichweite",
  abdeckung: "sensor.vorratskeller_vorratsstand",
};

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

/** Gleiche Kennung wie make_id() in lager.py, damit Regal-QR und Filter zusammenpassen. */
export function makeId(text) {
  let t = String(text ?? "").toLowerCase();
  for (const [a, b] of [["ä", "ae"], ["ö", "oe"], ["ü", "ue"], ["ß", "ss"]]) t = t.split(a).join(b);
  t = t.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return t.slice(0, 60).replace(/-+$/, "") || "produkt";
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n) => num(n).toLocaleString("de-DE", { maximumFractionDigits: 2 });
const datum = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}`;
};
const isoHeute = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
function plusMonate(monate) {
  if (!monate) return "";
  const d = new Date();
  const tag = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + monate);
  const letzter = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(tag, letzter));
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function istVorratEntity(hass, entityId) {
  const reg = hass.entities?.[entityId];
  return reg ? reg.platform === DOMAIN : entityId.startsWith(`sensor.${DOMAIN}_`);
}

/** Alle Produkte aus den Sensoren der Integration. */
export function produkte(hass) {
  const list = [];
  for (const [entityId, st] of Object.entries(hass.states)) {
    const a = st.attributes;
    if (!entityId.startsWith("sensor.") || !a?.produkt_id || !istVorratEntity(hass, entityId)) continue;
    if (st.state === "unavailable") continue;
    list.push({
      entity_id: entityId,
      id: a.produkt_id,
      name: a.produkt_name || a.friendly_name || entityId,
      bestand: num(st.state),
      soll: num(a.soll),
      fehlt: num(a.fehlt),
      gruppe: a.gruppe || "",
      fach: a.fach || "",
      fach_id: makeId(a.fach || "ohne-fach"),
      packung: a.packung || "",
      mhd: a.naechstes_mhd,
      tage: a.tage_bis_mhd,
      haltbarkeit: num(a.haltbarkeit_monate),
      icon: a.icon || "mdi:package-variant-closed",
      barcodes: a.barcodes || [],
      chargen: a.chargen || [],
    });
  }
  return list.sort((x, y) => x.name.localeCompare(y.name, "de"));
}

export function faecher(liste) {
  const map = new Map();
  for (const p of liste) {
    if (!map.has(p.fach_id)) map.set(p.fach_id, { id: p.fach_id, name: p.fach || "Ohne Fach", produkte: [] });
    map.get(p.fach_id).produkte.push(p);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
}

function summaryEntity(hass, key) {
  if (hass.states[SUMMARY[key]]) return SUMMARY[key];
  const found = Object.entries(hass.entities || {}).find(
    ([, e]) => e.platform === DOMAIN && e.translation_key === key,
  );
  return found ? found[0] : SUMMARY[key];
}

async function callService(hass, service, data, withResponse = false) {
  const msg = { type: "call_service", domain: DOMAIN, service, service_data: data };
  if (withResponse) msg.return_response = true;
  const result = await hass.callWS(msg);
  return result?.response;
}

function toast(el, message, action) {
  el.dispatchEvent(
    new CustomEvent("hass-notification", {
      detail: { message, duration: action ? 8000 : 4000, ...(action ? { action } : {}) },
      bubbles: true,
      composed: true,
    }),
  );
}

const fehlerText = (err) => err?.message || err?.error?.message || String(err);

// ---------------------------------------------------------------------------
// Stile
// ---------------------------------------------------------------------------

const STYLE = `
  :host { display: block; }
  ha-card { padding: 12px; overflow: hidden; }
  h2 { font-size: 1.2rem; font-weight: 500; margin: 0 0 8px; }
  .muted { color: var(--secondary-text-color); }
  .chips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; scrollbar-width: none; }
  .chip { flex: none; border: 1px solid var(--divider-color); border-radius: 18px; padding: 6px 14px;
    background: none; color: var(--primary-text-color); font: inherit; cursor: pointer; min-height: 36px; }
  .chip[aria-pressed="true"] { background: var(--primary-color); color: var(--text-primary-color, #fff);
    border-color: var(--primary-color); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .tile { position: relative; display: flex; flex-direction: column; gap: 4px; text-align: left;
    padding: 12px; min-height: 112px; border-radius: var(--ha-card-border-radius, 12px);
    border: 1px solid var(--divider-color); background: var(--secondary-background-color);
    color: var(--primary-text-color); font: inherit; cursor: pointer; touch-action: manipulation;
    transition: transform 80ms ease-out; }
  .tile:active { transform: scale(0.97); }
  .tile:focus-visible, .chip:focus-visible, button:focus-visible { outline: 2px solid var(--primary-color);
    outline-offset: 2px; }
  .tile.leer { opacity: 0.55; }
  .tile.unter { border-color: var(--warning-color, #ffa600); }
  .tile ha-icon { color: var(--state-icon-color, var(--primary-color)); }
  .tile .name { font-weight: 500; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2;
    -webkit-box-orient: vertical; overflow: hidden; padding-right: 36px; }
  .tile .zahl { font-size: 1.4rem; font-variant-numeric: tabular-nums; margin-top: auto; }
  .tile .zahl small { font-size: 0.85rem; color: var(--secondary-text-color); }
  .tile .mhd { font-size: 0.8rem; color: var(--secondary-text-color); }
  .tile .mhd.warn { color: var(--warning-color, #ffa600); }
  .tile .mhd.alt { color: var(--error-color, #db4437); font-weight: 500; }
  .plus { position: absolute; top: 6px; right: 6px; width: 40px; height: 40px; border-radius: 50%;
    border: none; background: var(--card-background-color); color: var(--primary-color);
    display: grid; place-items: center; cursor: pointer; }
  ul.liste { list-style: none; margin: 0; padding: 0; }
  ul.liste li { display: flex; gap: 12px; align-items: center; padding: 8px 0;
    border-bottom: 1px solid var(--divider-color); }
  ul.liste li:last-child { border-bottom: none; }
  ul.liste .grow { flex: 1; min-width: 0; }
  ul.liste .wert { font-variant-numeric: tabular-nums; text-align: right; }
  .alt { color: var(--error-color, #db4437); }
  .warn { color: var(--warning-color, #ffa600); }
  .leer-hinweis { padding: 16px 0; color: var(--secondary-text-color); text-align: center; }
  .video { position: relative; background: #000; border-radius: 12px; overflow: hidden;
    aspect-ratio: 4 / 3; max-height: 50vh; width: 100%; }
  .video video { width: 100%; height: 100%; object-fit: cover; display: block; }
  .video .rahmen { position: absolute; inset: 25% 12%; border: 2px solid rgba(255,255,255,0.8);
    border-radius: 8px; pointer-events: none; }
  .zeile { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 10px; }
  .zeile > label { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem;
    color: var(--secondary-text-color); flex: 1 1 140px; }
  input, select { font: inherit; padding: 10px; border-radius: 8px; border: 1px solid var(--divider-color);
    background: var(--card-background-color); color: var(--primary-text-color); min-height: 44px;
    box-sizing: border-box; width: 100%; }
  button.aktion { font: inherit; font-weight: 500; padding: 10px 18px; min-height: 44px; border-radius: 22px;
    border: 1px solid var(--primary-color); background: var(--primary-color);
    color: var(--text-primary-color, #fff); cursor: pointer; }
  button.aktion.zweit { background: none; color: var(--primary-color); }
  button.aktion:disabled { opacity: 0.5; cursor: default; }
  .panel { margin-top: 12px; padding: 12px; border-radius: 12px; background: var(--secondary-background-color); }
  .panel h3 { margin: 0 0 4px; font-size: 1.1rem; font-weight: 500; }
  .status { margin-top: 8px; min-height: 1.4em; color: var(--secondary-text-color); }
  .etiketten { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
  .etikett { border: 1px dashed var(--divider-color); border-radius: 8px; padding: 8px; text-align: center;
    font-size: 0.85rem; }
  .etikett svg { width: 100%; height: auto; background: #fff; }
  @media (prefers-reduced-motion: reduce) { .tile { transition: none; } .tile:active { transform: none; } }
`;

// ---------------------------------------------------------------------------
// Karte
// ---------------------------------------------------------------------------

class VorratskellerCard extends HTMLElement {
  static getStubConfig() {
    return { modus: "entnahme" };
  }

  static getConfigForm() {
    return {
      schema: [
        {
          name: "modus",
          required: true,
          selector: {
            select: {
              mode: "dropdown",
              options: [
                { value: "entnahme", label: "Entnahme-Kacheln" },
                { value: "scanner", label: "Scanner" },
                { value: "fehlend", label: "Fehlende Produkte" },
                { value: "ablaufend", label: "Bald ablaufend" },
                { value: "etiketten", label: "Regal-Etiketten" },
              ],
            },
          },
        },
        { name: "fach", selector: { text: {} } },
        { name: "titel", selector: { text: {} } },
      ],
      computeLabel: (s) => ({ modus: "Ansicht", fach: "Nur dieses Fach (Kennung)", titel: "Titel" })[s.name],
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._fach = null; // Filter der Entnahme
    this._signatur = "";
    this._busy = false;
  }

  setConfig(config) {
    const modus = config?.modus || "entnahme";
    if (!["entnahme", "scanner", "fehlend", "ablaufend", "etiketten"].includes(modus)) {
      throw new Error(`Unbekannter Modus: ${modus}`);
    }
    this._config = { ...config, modus };
    this._fach = config.fach || null;
    this._signatur = "";
    this._aufbau = false;
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return this._config?.modus === "scanner" ? 8 : 6;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  connectedCallback() {
    if (this._hass) this._render();
  }

  disconnectedCallback() {
    this._scanner?.stop();
  }

  // Nur neu zeichnen, wenn sich Produkte geändert haben
  _signaturVon(liste) {
    const s = liste.map((p) => `${p.id}:${p.bestand}:${p.soll}:${p.mhd}:${p.name}:${p.fach}`).join("|");
    const extra = [SUMMARY.fehlend, SUMMARY.ablaufend].map((e) => this._hass.states[e]?.last_updated).join();
    return `${s}#${extra}`;
  }

  _render() {
    if (!this._config || !this._hass) return;
    const modus = this._config.modus;
    if (!this._aufbau) {
      this.shadowRoot.innerHTML = `<style>${STYLE}</style><ha-card><div id="inhalt"></div></ha-card>`;
      this._inhalt = this.shadowRoot.getElementById("inhalt");
      this._aufbau = true;
      if (modus === "scanner") this._scannerAufbauen();
    }
    const liste = produkte(this._hass);
    const signatur = this._signaturVon(liste);
    if (signatur === this._signatur) return;
    this._signatur = signatur;
    this._liste = liste;
    if (modus === "entnahme") this._renderEntnahme(this._inhalt, liste);
    else if (modus === "fehlend") this._renderFehlend(liste);
    else if (modus === "ablaufend") this._renderAblaufend();
    else if (modus === "etiketten") this._renderEtiketten(liste);
    else if (modus === "scanner") this._scannerAktualisieren();
  }

  _titel(standard) {
    const t = this._config.titel ?? standard;
    return t ? `<h2>${esc(t)}</h2>` : "";
  }

  // --- Entnahme -------------------------------------------------------------

  _renderEntnahme(ziel, liste, { festesFach = null, titel = true } = {}) {
    const alle = faecher(liste);
    const fach = festesFach || this._fach;
    const sichtbar = fach ? liste.filter((p) => p.fach_id === fach) : liste;
    const chips = festesFach
      ? ""
      : `<div class="chips" role="toolbar" aria-label="Fach">
          <button class="chip" data-fach="" aria-pressed="${!fach}">Alle</button>
          ${alle
            .map((f) => `<button class="chip" data-fach="${esc(f.id)}" aria-pressed="${f.id === fach}">${esc(f.name)}</button>`)
            .join("")}
        </div>`;
    const tiles = sichtbar.map((p) => this._tile(p)).join("");
    ziel.innerHTML = `
      ${titel ? this._titel("Entnehmen") : ""}
      ${chips}
      ${sichtbar.length ? `<div class="grid">${tiles}</div>` : `<div class="leer-hinweis">Keine Produkte.</div>`}`;
    ziel.querySelectorAll(".chip").forEach((b) =>
      b.addEventListener("click", () => {
        this._fach = b.dataset.fach || null;
        this._renderEntnahme(ziel, this._liste);
      }),
    );
    ziel.querySelectorAll(".tile").forEach((t) => {
      t.addEventListener("click", (ev) => {
        if (ev.target.closest(".plus")) return;
        this._entnehmen(t.dataset.id);
      });
      t.addEventListener("keydown", (ev) => {
        if ((ev.key === "Enter" || ev.key === " ") && ev.target === t) {
          ev.preventDefault();
          this._entnehmen(t.dataset.id);
        }
      });
    });
    ziel.querySelectorAll(".plus").forEach((b) =>
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._einlagern(b.dataset.id, 1);
      }),
    );
  }

  _tile(p) {
    let mhd = "";
    if (p.mhd) {
      const cls = p.tage < 0 ? "alt" : p.tage <= 30 ? "warn" : "";
      mhd = `<span class="mhd ${cls}">MHD ${esc(datum(p.mhd))}${p.tage < 0 ? " · abgelaufen" : ""}</span>`;
    }
    const cls = [p.bestand <= 0 ? "leer" : "", p.fehlt > 0 ? "unter" : ""].join(" ");
    const soll = p.soll > 0 ? ` <small>/ ${fmt(p.soll)}</small>` : "";
    return `
      <div class="tile ${cls}" role="button" tabindex="0" data-id="${esc(p.id)}"
        aria-label="${esc(p.name)}: ${fmt(p.bestand)} da. Tippen nimmt eine Packung heraus.">
        <ha-icon icon="${esc(p.icon)}"></ha-icon>
        <span class="name">${esc(p.name)}</span>
        <span class="zahl">${fmt(p.bestand)}${soll}</span>
        ${mhd}
        <button class="plus" data-id="${esc(p.id)}" aria-label="${esc(p.name)}: eine Packung einlagern">
          <ha-icon icon="mdi:plus"></ha-icon>
        </button>
      </div>`;
  }

  async _entnehmen(id, menge = 1) {
    const p = this._liste.find((x) => x.id === id);
    if (!p || this._busy) return;
    if (p.bestand < menge) {
      toast(this, `${p.name}: nichts mehr da.`);
      return;
    }
    this._busy = true;
    try {
      const res = await callService(this._hass, "entnehmen", { produkt: id, menge }, true);
      const zurueck = res?.entnommen || [];
      toast(this, `${p.name}: ${fmt(menge)} entnommen, ${fmt(res?.bestand)} übrig.`, {
        text: "Rückgängig",
        action: () => this._rueckgaengig(id, zurueck),
      });
    } catch (err) {
      toast(this, fehlerText(err));
    } finally {
      this._busy = false;
    }
  }

  async _rueckgaengig(id, entnommen) {
    try {
      for (const e of entnommen) {
        const data = { produkt: id, menge: e.menge };
        if (e.mhd) data.mhd = e.mhd;
        await callService(this._hass, "einlagern", data);
      }
    } catch (err) {
      toast(this, fehlerText(err));
    }
  }

  async _einlagern(id, menge, mhd) {
    const p = this._liste.find((x) => x.id === id);
    try {
      const data = { produkt: id, menge };
      if (mhd) data.mhd = mhd;
      const res = await callService(this._hass, "einlagern", data, true);
      toast(this, `${p?.name ?? id}: ${fmt(menge)} eingelagert${res?.mhd ? `, MHD ${datum(res.mhd)}` : ""}.`);
      return res;
    } catch (err) {
      toast(this, fehlerText(err));
      return null;
    }
  }

  // --- Listen ---------------------------------------------------------------

  _renderFehlend(liste) {
    const fehlend = liste.filter((p) => p.fehlt > 0).sort((a, b) => a.fach.localeCompare(b.fach, "de"));
    this._inhalt.innerHTML = `
      ${this._titel("Fehlt bis zum Soll")}
      ${
        fehlend.length
          ? `<ul class="liste">${fehlend
              .map(
                (p) => `<li><ha-icon icon="${esc(p.icon)}"></ha-icon>
                  <span class="grow">${esc(p.name)}<br><span class="muted">${esc(p.fach)}</span></span>
                  <span class="wert">${fmt(p.fehlt)} ${esc(p.packung)}</span></li>`,
              )
              .join("")}</ul>`
          : `<div class="leer-hinweis">Alles im Soll.</div>`
      }`;
  }

  _renderAblaufend() {
    const st = this._hass.states[summaryEntity(this._hass, "ablaufend")];
    const chargen = st?.attributes?.chargen || [];
    const warn = st?.attributes?.warn_tage ?? 30;
    this._inhalt.innerHTML = `
      ${this._titel("Bald verbrauchen")}
      ${
        chargen.length
          ? `<ul class="liste">${chargen
              .map((c) => {
                const cls = c.tage < 0 ? "alt" : "warn";
                const wann = c.tage < 0 ? `seit ${-c.tage} Tagen abgelaufen` : c.tage === 0 ? "heute" : `in ${c.tage} Tagen`;
                return `<li><span class="grow">${esc(c.name)}<br><span class="muted">MHD ${esc(datum(c.mhd))}</span></span>
                  <span class="wert"><span class="${cls}">${esc(wann)}</span><br>${fmt(c.menge)} Pkg.</span></li>`;
              })
              .join("")}</ul>`
          : `<div class="leer-hinweis">In den nächsten ${esc(warn)} Tagen läuft nichts ab.</div>`
      }`;
  }

  // --- Etiketten ------------------------------------------------------------

  async _renderEtiketten(liste) {
    const alle = faecher(liste);
    const { default: qrcode } = await import(`${BASE}/vendor/qrcode.js`);
    const svg = (text) => {
      const qr = qrcode(0, "M");
      qr.addData(text);
      qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    };
    const etiketten = alle
      .map(
        (f) => `<div class="etikett">${svg(QR_FACH + f.id)}<div><strong>${esc(f.name)}</strong></div>
          <div class="muted">${f.produkte.length} Produkte</div></div>`,
      )
      .join("");
    this._inhalt.innerHTML = `
      ${this._titel("Regal-Etiketten")}
      <p class="muted">Ein QR-Code je Fach. Scannen zeigt die Produkte dieses Fachs.</p>
      <div class="etiketten">${etiketten}</div>
      <div class="zeile"><button class="aktion" id="drucken">Drucken</button></div>`;
    this._inhalt.querySelector("#drucken").addEventListener("click", () => {
      const w = window.open("", "_blank");
      if (!w) return toast(this, "Der Browser hat das Druckfenster blockiert.");
      w.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Regal-Etiketten</title>
        <style>body{font-family:sans-serif;margin:10mm}.e{display:inline-block;width:45mm;margin:2mm;padding:2mm;
        border:1px dashed #999;text-align:center;font-size:9pt;vertical-align:top;break-inside:avoid}
        .e svg{width:38mm;height:38mm}</style></head><body>
        ${alle.map((f) => `<div class="e">${svg(QR_FACH + f.id)}<div><b>${esc(f.name)}</b></div></div>`).join("")}
        <script>window.onload=()=>window.print()<\/script></body></html>`);
      w.document.close();
    });
  }

  // --- Scanner --------------------------------------------------------------

  _scannerAufbauen() {
    this._inhalt.innerHTML = `
      ${this._titel("Scanner")}
      <div class="video"><video playsinline muted></video><div class="rahmen"></div></div>
      <div class="zeile">
        <button class="aktion" id="start">Kamera starten</button>
        <label style="flex:2 1 200px">Barcode von Hand
          <input id="manuell" inputmode="numeric" autocomplete="off" placeholder="EAN, z. B. 4006381333931">
        </label>
        <button class="aktion zweit" id="suchen">Suchen</button>
      </div>
      <div class="status" id="status" role="status" aria-live="polite"></div>
      <div id="ergebnis"></div>`;
    const $ = (id) => this._inhalt.querySelector(id);
    this._video = $("video");
    this._status = $("#status");
    this._ergebnis = $("#ergebnis");
    $("#start").addEventListener("click", () => this._kameraUmschalten($("#start")));
    const manuell = $("#manuell");
    const suchen = () => manuell.value.trim() && this._erkannt(manuell.value.trim());
    $("#suchen").addEventListener("click", suchen);
    manuell.addEventListener("keydown", (ev) => ev.key === "Enter" && suchen());
  }

  _scannerAktualisieren() {
    // Offenes Ergebnis mit neuem Bestand auffrischen, ohne Eingaben zu verlieren
    const zahl = this._ergebnis?.querySelector("[data-bestand-von]");
    if (zahl) {
      const p = this._liste.find((x) => x.id === zahl.dataset.bestandVon);
      if (p) zahl.textContent = `${fmt(p.bestand)}${p.soll ? ` von ${fmt(p.soll)}` : ""}`;
    }
    const fachGrid = this._ergebnis?.querySelector("[data-fach-grid]");
    if (fachGrid) this._renderEntnahme(fachGrid, this._liste, { festesFach: fachGrid.dataset.fachGrid, titel: false });
  }

  async _kameraUmschalten(button) {
    if (this._scanner?.aktiv) {
      this._scanner.stop();
      button.textContent = "Kamera starten";
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this._status.textContent =
        "Die Kamera braucht eine verschlüsselte Verbindung (https). Barcode von Hand eingeben.";
      return;
    }
    button.disabled = true;
    try {
      this._scanner = new Scanner(this._video, (code) => this._erkannt(code), (t) => (this._status.textContent = t));
      await this._scanner.start();
      button.textContent = "Kamera stoppen";
    } catch (err) {
      this._status.textContent = `Kamera nicht verfügbar: ${fehlerText(err)}`;
    } finally {
      button.disabled = false;
    }
  }

  async _erkannt(code) {
    this._scanner?.pause(3000);
    navigator.vibrate?.(60);
    if (code.startsWith(QR_FACH)) return this._zeigeFach(code.slice(QR_FACH.length));
    if (code.startsWith(QR_PRODUKT)) {
      const p = this._liste.find((x) => x.id === code.slice(QR_PRODUKT.length));
      return p ? this._zeigeProdukt(p) : (this._status.textContent = "Unbekanntes Produkt-Etikett.");
    }
    if (!/^\d{8}$|^\d{12,14}$/.test(code)) {
      this._status.textContent = `Unbekannter Code: ${code}`;
      return;
    }
    this._status.textContent = `Barcode ${code} …`;
    try {
      const res = await callService(this._hass, "barcode_suchen", { barcode: code }, true);
      if (res.bekannt) {
        this._status.textContent = "";
        this._zeigeProdukt(this._liste.find((x) => x.id === res.produkt.id) || res.produkt);
      } else {
        this._zeigeUnbekannt(code, res.vorschlag);
      }
    } catch (err) {
      this._status.textContent = fehlerText(err);
    }
  }

  _zeigeFach(fachId) {
    const fach = faecher(this._liste).find((f) => f.id === fachId);
    this._status.textContent = "";
    this._ergebnis.innerHTML = `<div class="panel"><h3>${esc(fach?.name ?? fachId)}</h3>
      <p class="muted">Tippen nimmt eine Packung heraus, + lagert eine ein.</p>
      <div data-fach-grid="${esc(fachId)}"></div></div>`;
    this._renderEntnahme(this._ergebnis.querySelector("[data-fach-grid]"), this._liste, {
      festesFach: fachId,
      titel: false,
    });
  }

  _zeigeProdukt(p) {
    const mhd = plusMonate(p.haltbarkeit ?? p.haltbarkeit_monate);
    this._ergebnis.innerHTML = `<div class="panel">
      <h3>${esc(p.name)}</h3>
      <div class="muted">${esc(p.fach)}${p.packung ? ` · ${esc(p.packung)}` : ""}</div>
      <div>Bestand: <strong data-bestand-von="${esc(p.id)}">${fmt(p.bestand)}${p.soll ? ` von ${fmt(p.soll)}` : ""}</strong></div>
      <div class="zeile">
        <label>Menge<input id="menge" type="number" min="1" step="1" value="1" inputmode="numeric"></label>
        <label>MHD (Einlagern)<input id="mhd" type="date" min="${isoHeute()}" value="${esc(mhd)}"></label>
      </div>
      <div class="zeile">
        <button class="aktion" id="rein">Einlagern</button>
        <button class="aktion zweit" id="raus">Entnehmen</button>
        <button class="aktion zweit" id="fertig">Fertig</button>
      </div></div>`;
    const $ = (s) => this._ergebnis.querySelector(s);
    const menge = () => Math.max(0.001, num($("#menge").value) || 1);
    $("#rein").addEventListener("click", async () => {
      await this._einlagern(p.id, menge(), $("#mhd").value || undefined);
    });
    $("#raus").addEventListener("click", () => this._entnehmen(p.id, menge()));
    $("#fertig").addEventListener("click", () => (this._ergebnis.innerHTML = ""));
  }

  _zeigeUnbekannt(code, vorschlag) {
    const gruppen = [...new Set(this._liste.map((p) => p.gruppe))].sort((a, b) => a.localeCompare(b, "de"));
    const ohneCode = this._liste.filter((p) => !p.barcodes.length);
    const andere = this._liste.filter((p) => p.barcodes.length);
    const opt = (p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`;
    const vorschlagText = vorschlag
      ? `Open Food Facts: <strong>${esc(vorschlag.name)}</strong>${vorschlag.marke ? `, ${esc(vorschlag.marke)}` : ""}${vorschlag.menge ? `, ${esc(vorschlag.menge)}` : ""}`
      : "Kein Eintrag bei Open Food Facts.";
    this._status.textContent = "";
    this._ergebnis.innerHTML = `<div class="panel">
      <h3>Unbekannter Barcode ${esc(code)}</h3>
      <div class="muted">${vorschlagText}</div>
      <div class="zeile">
        <label style="flex:3 1 220px">Zu vorhandenem Produkt
          <select id="ziel"><option value="">Produkt wählen …</option>
            <optgroup label="Noch ohne Barcode">${ohneCode.map(opt).join("")}</optgroup>
            <optgroup label="Mit Barcode">${andere.map(opt).join("")}</optgroup>
          </select></label>
        <button class="aktion" id="zuordnen">Zuordnen</button>
      </div>
      <details style="margin-top:12px"><summary>Neues Produkt anlegen</summary>
        <div class="zeile">
          <label style="flex:3 1 220px">Name<input id="name" value="${esc(vorschlag?.name ?? "")}" maxlength="120"></label>
          <label>Gruppe<select id="gruppe">${gruppen.map((g) => `<option value="${esc(makeId(g))}">${esc(g)}</option>`).join("")}</select></label>
        </div>
        <div class="zeile">
          <label>Fach<input id="fach" list="vk-faecher"></label>
          <datalist id="vk-faecher">${faecher(this._liste).map((f) => `<option value="${esc(f.name)}">`).join("")}</datalist>
          <label>Soll (Packungen)<input id="soll" type="number" min="0" step="1" value="0"></label>
          <label>Haltbarkeit (Monate)<input id="haltbar" type="number" min="0" step="1" value="12"></label>
        </div>
        <div class="zeile"><button class="aktion" id="anlegen">Anlegen</button></div>
      </details>
      <div class="zeile"><button class="aktion zweit" id="fertig">Abbrechen</button></div></div>`;
    const $ = (s) => this._ergebnis.querySelector(s);
    $("#fertig").addEventListener("click", () => (this._ergebnis.innerHTML = ""));
    $("#zuordnen").addEventListener("click", async () => {
      const id = $("#ziel").value;
      if (!id) return;
      try {
        await callService(this._hass, "barcode_zuordnen", { barcode: code, produkt: id });
        const p = this._liste.find((x) => x.id === id);
        toast(this, `Barcode gehört jetzt zu ${p?.name ?? id}.`);
        this._zeigeProdukt({ ...p, barcodes: [...(p?.barcodes ?? []), code] });
      } catch (err) {
        toast(this, fehlerText(err));
      }
    });
    $("#anlegen").addEventListener("click", async () => {
      const name = $("#name").value.trim();
      if (!name) return $("#name").focus();
      try {
        const neu = await callService(
          this._hass,
          "produkt_anlegen",
          {
            name,
            barcode: code,
            gruppe: $("#gruppe").value,
            fach: $("#fach").value.trim(),
            soll: num($("#soll").value),
            haltbarkeit_monate: Math.round(num($("#haltbar").value)),
            packung: vorschlag?.menge ? `× ${vorschlag.menge}` : "",
          },
          true,
        );
        toast(this, `${name} angelegt.`);
        this._zeigeProdukt({ ...neu, haltbarkeit: neu.haltbarkeit_monate });
      } catch (err) {
        toast(this, fehlerText(err));
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Kamera und Erkennung
// ---------------------------------------------------------------------------

let detectorPromise = null;

/** BarcodeDetector des Browsers oder, falls nicht vorhanden, zxing-wasm aus ./vendor. */
async function getDetector() {
  detectorPromise ??= (async () => {
    if ("BarcodeDetector" in window) {
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const formats = BARCODE_FORMATS.filter((f) => supported.includes(f));
        if (formats.includes("ean_13")) return { detector: new window.BarcodeDetector({ formats }), art: "Browser" };
      } catch (_err) {
        // weiter mit dem Rückfall
      }
    }
    const mod = await import(`${BASE}/vendor/barcode-detector.js`);
    // WebAssembly vom eigenen Server laden, nicht vom CDN
    mod.prepareZXingModule({
      overrides: { locateFile: (path, prefix) => (path.endsWith(".wasm") ? `${BASE}/vendor/${path}` : prefix + path) },
      fireImmediately: true,
    });
    return { detector: new mod.BarcodeDetector({ formats: BARCODE_FORMATS }), art: "zxing" };
  })();
  return detectorPromise;
}

class Scanner {
  constructor(video, onCode, onStatus) {
    this.video = video;
    this.onCode = onCode;
    this.onStatus = onStatus;
    this.aktiv = false;
    this.pauseBis = 0;
    this.letzter = { code: "", zeit: 0 };
  }

  async start() {
    const { detector, art } = await getDetector();
    this.detector = detector;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    this.aktiv = true;
    this.onStatus(`Kamera läuft (Erkennung: ${art}). Barcode oder Regal-Code in den Rahmen halten.`);
    this._loop();
  }

  pause(ms) {
    this.pauseBis = Date.now() + ms;
  }

  stop() {
    this.aktiv = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
  }

  async _loop() {
    while (this.aktiv) {
      await new Promise((r) => setTimeout(r, 200));
      if (!this.aktiv || Date.now() < this.pauseBis || this.video.readyState < 2) continue;
      try {
        const codes = await this.detector.detect(this.video);
        const code = codes[0]?.rawValue;
        if (!code) continue;
        const jetzt = Date.now();
        if (code === this.letzter.code && jetzt - this.letzter.zeit < 4000) continue;
        this.letzter = { code, zeit: jetzt };
        this.onCode(code);
      } catch (_err) {
        // einzelne Bilder dürfen scheitern
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Dashboard-Strategie
// ---------------------------------------------------------------------------

export function generateDashboard(hass) {
  const liste = produkte(hass);
  const gruppen = new Map();
  for (const p of liste) {
    if (!gruppen.has(p.gruppe)) gruppen.set(p.gruppe, []);
    gruppen.get(p.gruppe).push(p);
  }
  const tile = (entity, extra = {}) => ({ type: "tile", entity, ...extra });
  const s = (key) => summaryEntity(hass, key);

  const uebersicht = {
    title: "Übersicht",
    path: "uebersicht",
    icon: "mdi:warehouse",
    type: "sections",
    max_columns: 3,
    sections: [
      {
        type: "grid",
        cards: [
          { type: "heading", heading: "Vorrat", heading_style: "title" },
          tile(s("abdeckung"), { name: "Vorratsstand" }),
          tile(s("reichweite"), { name: "Reichweite" }),
          tile(s("fehlend"), {
            name: "Unter Soll",
            tap_action: { action: "navigate", navigation_path: "einkauf" },
          }),
          tile(s("ablaufend"), { name: "Bald ablaufend" }),
          {
            type: "history-graph",
            title: "Vorratsstand",
            hours_to_show: 24 * 30,
            entities: [{ entity: s("abdeckung") }],
          },
        ],
      },
      {
        type: "grid",
        cards: [{ type: "custom:vorratskeller-card", modus: "ablaufend" }],
      },
      {
        type: "grid",
        cards: [{ type: "custom:vorratskeller-card", modus: "fehlend" }],
      },
    ],
  };

  const keller = {
    title: "Entnehmen",
    path: "keller",
    icon: "mdi:gesture-tap",
    type: "panel",
    cards: [{ type: "custom:vorratskeller-card", modus: "entnahme" }],
  };

  const scanner = {
    title: "Scanner",
    path: "scanner",
    icon: "mdi:barcode-scan",
    type: "panel",
    cards: [{ type: "custom:vorratskeller-card", modus: "scanner" }],
  };

  const bestand = {
    title: "Bestand",
    path: "bestand",
    icon: "mdi:format-list-bulleted",
    type: "sections",
    max_columns: 4,
    sections: [...gruppen.entries()].map(([name, ps]) => ({
      type: "grid",
      cards: [
        { type: "heading", heading: name, icon: ps[0]?.icon },
        ...ps.map((p) => tile(p.entity_id, { name: p.name })),
      ],
    })),
  };

  const einkauf = {
    title: "Einkauf",
    path: "einkauf",
    icon: "mdi:cart-outline",
    type: "sections",
    max_columns: 2,
    sections: [{ type: "grid", cards: [{ type: "custom:vorratskeller-card", modus: "fehlend" }] }],
  };

  const etiketten = {
    title: "Etiketten",
    path: "etiketten",
    icon: "mdi:qrcode",
    type: "panel",
    cards: [{ type: "custom:vorratskeller-card", modus: "etiketten" }],
  };

  if (!liste.length) {
    return {
      title: "Vorratskeller",
      views: [
        {
          title: "Übersicht",
          cards: [
            {
              type: "markdown",
              content:
                "Keine Produkte gefunden. Ist die Integration **Vorratskeller** eingerichtet?\n\n" +
                "Einstellungen → Geräte & Dienste → Integration hinzufügen → Vorratskeller.",
            },
          ],
        },
      ],
    };
  }
  return { title: "Vorratskeller", views: [uebersicht, keller, scanner, bestand, einkauf, etiketten] };
}

class VorratskellerStrategy extends HTMLElement {
  static async generate(_config, hass) {
    return generateDashboard(hass);
  }

  static noEditor = true;
}

// ---------------------------------------------------------------------------
// Registrierung (mehrfaches Laden ist harmlos)
// ---------------------------------------------------------------------------

// Das HA-Frontend ersetzt window.customElements nach dem Laden zusätzlicher Module durch ein
// Polyfill (scoped custom element registry). Definitionen davor stehen nur in der alten Registry,
// und HA wartet vergeblich auf die Strategie (im Browser geprüft mit HA 2026.10). Daher sofort
// definieren und 30 s lang nachdefinieren, falls die Registry ausgetauscht wurde. Das Polyfill
// verträgt Namen, die nativ schon definiert sind.
const ELEMENTE = [
  ["vorratskeller-card", VorratskellerCard],
  ["ll-strategy-dashboard-vorratskeller", VorratskellerStrategy],
];

function definieren() {
  const reg = window.customElements;
  for (const [name, cls] of ELEMENTE) {
    if (reg.get(name)) continue;
    try {
      reg.define(name, cls);
    } catch (err) {
      console.warn(`Vorratskeller: ${name} nicht definiert`, err);
    }
  }
}

definieren();
if (typeof document !== "undefined" && document.querySelector) {
  let n = 0;
  const timer = setInterval(() => {
    definieren();
    if (++n >= 300) clearInterval(timer);
  }, 100);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "vorratskeller-card")) {
  window.customCards.push({
    type: "vorratskeller-card",
    name: "Vorratskeller",
    description: "Entnahme-Kacheln, Scanner, fehlende und ablaufende Produkte, Regal-Etiketten.",
    preview: false,
  });
}

window.customStrategies = window.customStrategies || [];
if (!window.customStrategies.some((s) => s.type === DOMAIN)) {
  window.customStrategies.push({
    type: DOMAIN,
    strategyType: "dashboard",
    name: "Vorratskeller",
    description: "Lagerbuch des Vorratskellers: Übersicht, Entnahme, Scanner, Bestand, Einkauf, Etiketten.",
  });
}
