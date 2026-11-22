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
// Sprache: Deutsch bei "de", sonst Englisch (Spracheinstellung des Benutzers in HA)
// ---------------------------------------------------------------------------

const TEXTE = {
  de: {
    name: "Vorratskeller",
    beschreibung_dashboard: "Lagerbuch des Vorratskellers: Übersicht, Entnahme, Scanner, Bestand, Einkauf, Etiketten.",
    beschreibung_karte: "Entnahme-Kacheln, Scanner, fehlende und ablaufende Produkte, Regal-Etiketten.",
    modus_entnahme: "Entnahme-Kacheln",
    modus_scanner: "Scanner",
    modus_fehlend: "Fehlende Produkte",
    modus_ablaufend: "Bald ablaufend",
    modus_etiketten: "Regal-Etiketten",
    feld_modus: "Ansicht",
    feld_fach: "Nur dieses Fach (Kennung)",
    feld_titel: "Titel",
    unbekannter_modus: "Unbekannter Modus: {modus}",
    fach: "Fach",
    ohne_fach: "Ohne Fach",
    alle: "Alle",
    titel_entnehmen: "Entnehmen",
    titel_fehlend: "Fehlt bis zum Soll",
    titel_ablaufend: "Bald verbrauchen",
    titel_etiketten: "Regal-Etiketten",
    titel_scanner: "Scanner",
    keine_produkte: "Keine Produkte.",
    mhd: "MHD {datum}",
    abgelaufen_kurz: "abgelaufen",
    kachel_label: "{name}: {bestand} da{soll}. Eine Packung entnehmen.",
    kachel_soll: ", Soll {soll}",
    plus_label: "{name}: eine Packung einlagern",
    nichts_da: "{name}: nichts mehr da.",
    entnommen: "{name}: {menge} entnommen, {rest} übrig.",
    rueckgaengig: "Rückgängig",
    eingelagert: "{name}: {menge} eingelagert{mhd}.",
    eingelagert_mhd: ", MHD {datum}",
    alles_im_soll: "Alles im Soll.",
    abgelaufen_seit: "seit {tage} Tagen abgelaufen",
    heute: "heute",
    in_tagen: "in {tage} Tagen",
    packungen: "{menge} Pkg.",
    nichts_laeuft_ab: "In den nächsten {tage} Tagen läuft nichts ab.",
    n_produkte: "{n} Produkte",
    etiketten_hinweis: "Ein QR-Code je Fach. Scannen zeigt die Produkte dieses Fachs.",
    drucken: "Drucken",
    druck_blockiert: "Der Browser hat das Druckfenster blockiert.",
    kamera_starten: "Kamera starten",
    kamera_stoppen: "Kamera stoppen",
    barcode_hand: "Barcode von Hand",
    barcode_beispiel: "EAN, z. B. 4006381333931",
    suchen: "Suchen",
    kamera_https: "Die Kamera braucht eine verschlüsselte Verbindung (https). Barcode von Hand eingeben.",
    kamera_fehlt: "Kamera nicht verfügbar: {fehler}",
    kamera_laeuft: "Kamera läuft (Erkennung: {art}). Barcode oder Regal-Code in den Rahmen halten.",
    etikett_unbekannt: "Unbekanntes Produkt-Etikett.",
    code_unbekannt: "Unbekannter Code: {code}",
    barcode_sucht: "Barcode {code} …",
    von: "{bestand} von {soll}",
    fach_hinweis: "Tippen nimmt eine Packung heraus, + lagert eine ein.",
    weiter_scannen: "Weiter scannen",
    bestand: "Bestand:",
    menge: "Menge",
    mhd_einlagern: "MHD (Einlagern)",
    einlagern: "Einlagern",
    entnehmen: "Entnehmen",
    fertig: "Fertig",
    off_kein_eintrag: "Kein Eintrag bei Open Food Facts.",
    barcode_unbekannt: "Unbekannter Barcode {code}",
    zu_produkt: "Zu vorhandenem Produkt",
    produkt_waehlen: "Produkt wählen …",
    ohne_barcode: "Noch ohne Barcode",
    mit_barcode: "Mit Barcode",
    zuordnen: "Zuordnen",
    neues_produkt: "Neues Produkt anlegen",
    feld_name: "Name",
    gruppe: "Gruppe",
    soll_packungen: "Soll (Packungen)",
    haltbarkeit: "Haltbarkeit (Monate)",
    anlegen: "Anlegen",
    abbrechen: "Abbrechen",
    zugeordnet: "Barcode gehört jetzt zu {name}.",
    angelegt: "{name} angelegt.",
    view_uebersicht: "Übersicht",
    view_entnehmen: "Entnehmen",
    view_scanner: "Scanner",
    view_bestand: "Bestand",
    view_einkauf: "Einkauf",
    view_etiketten: "Etiketten",
    vorrat: "Vorrat",
    vorratsstand: "Vorratsstand",
    reichweite: "Reichweite",
    unter_soll: "Unter Soll",
    bald_ablaufend: "Bald ablaufend",
    leer_hinweis:
      "Noch keine Produkte. Im **Scanner** einen Barcode scannen oder eingeben und " +
      "„Neues Produkt anlegen“ wählen.\n\nFehlt die Integration: Einstellungen → " +
      "Geräte & Dienste → Integration hinzufügen → Vorratskeller.",
  },
  en: {
    name: "Pantry (Vorratskeller)",
    beschreibung_dashboard: "Pantry inventory: overview, take out, scanner, stock, shopping, labels.",
    beschreibung_karte: "Take-out tiles, scanner, missing and expiring products, shelf labels.",
    modus_entnahme: "Take-out tiles",
    modus_scanner: "Scanner",
    modus_fehlend: "Missing products",
    modus_ablaufend: "Expiring soon",
    modus_etiketten: "Shelf labels",
    feld_modus: "View",
    feld_fach: "Only this shelf (ID)",
    feld_titel: "Title",
    unbekannter_modus: "Unknown mode: {modus}",
    fach: "Shelf",
    ohne_fach: "No shelf",
    alle: "All",
    titel_entnehmen: "Take out",
    titel_fehlend: "Missing to reach target",
    titel_ablaufend: "Use soon",
    titel_etiketten: "Shelf labels",
    titel_scanner: "Scanner",
    keine_produkte: "No products.",
    mhd: "BB {datum}",
    abgelaufen_kurz: "expired",
    kachel_label: "{name}: {bestand} in stock{soll}. Take out one pack.",
    kachel_soll: ", target {soll}",
    plus_label: "{name}: store one pack",
    nichts_da: "{name}: none left.",
    entnommen: "{name}: took out {menge}, {rest} left.",
    rueckgaengig: "Undo",
    eingelagert: "{name}: stored {menge}{mhd}.",
    eingelagert_mhd: ", best before {datum}",
    alles_im_soll: "Everything at target.",
    abgelaufen_seit: "expired {tage} days ago",
    heute: "today",
    in_tagen: "in {tage} days",
    packungen: "{menge} packs",
    nichts_laeuft_ab: "Nothing expires in the next {tage} days.",
    n_produkte: "{n} products",
    etiketten_hinweis: "One QR code per shelf. Scanning it shows the products on that shelf.",
    drucken: "Print",
    druck_blockiert: "The browser blocked the print window.",
    kamera_starten: "Start camera",
    kamera_stoppen: "Stop camera",
    barcode_hand: "Enter barcode",
    barcode_beispiel: "EAN, e.g. 4006381333931",
    suchen: "Search",
    kamera_https: "The camera needs an encrypted connection (https). Enter the barcode by hand.",
    kamera_fehlt: "Camera not available: {fehler}",
    kamera_laeuft: "Camera running (detection: {art}). Hold a barcode or shelf code inside the frame.",
    etikett_unbekannt: "Unknown product label.",
    code_unbekannt: "Unknown code: {code}",
    barcode_sucht: "Barcode {code} …",
    von: "{bestand} of {soll}",
    fach_hinweis: "Tap takes out one pack, + stores one.",
    weiter_scannen: "Keep scanning",
    bestand: "In stock:",
    menge: "Quantity",
    mhd_einlagern: "Best before (when storing)",
    einlagern: "Store",
    entnehmen: "Take out",
    fertig: "Done",
    off_kein_eintrag: "No entry on Open Food Facts.",
    barcode_unbekannt: "Unknown barcode {code}",
    zu_produkt: "Assign to existing product",
    produkt_waehlen: "Choose product …",
    ohne_barcode: "No barcode yet",
    mit_barcode: "With barcode",
    zuordnen: "Assign",
    neues_produkt: "Create new product",
    feld_name: "Name",
    gruppe: "Group",
    soll_packungen: "Target (packs)",
    haltbarkeit: "Shelf life (months)",
    anlegen: "Create",
    abbrechen: "Cancel",
    zugeordnet: "Barcode now belongs to {name}.",
    angelegt: "{name} created.",
    view_uebersicht: "Overview",
    view_entnehmen: "Take out",
    view_scanner: "Scanner",
    view_bestand: "Stock",
    view_einkauf: "Shopping",
    view_etiketten: "Labels",
    vorrat: "Pantry",
    vorratsstand: "Stock level",
    reichweite: "Days of supply",
    unter_soll: "Below target",
    bald_ablaufend: "Expiring soon",
    leer_hinweis:
      "No products yet. In the **Scanner**, scan or enter a barcode and choose " +
      "“Create new product”.\n\nIntegration missing? Settings → Devices & services → " +
      "Add integration → Vorratskeller.",
  },
};

// Sprache und Gebietsschema; gesetzt aus hass (Karte, Strategie), vorher aus <html lang>
let LOCALE = "de";
const sprachBasis = () =>
  (typeof document !== "undefined" && document.documentElement?.lang) ||
  (typeof navigator !== "undefined" && navigator.language) ||
  "de";
const spracheVon = (locale) => (String(locale).toLowerCase().startsWith("de") ? "de" : "en");

/** Sprache aus hass übernehmen (Spracheinstellung des Benutzers). */
export function setzeSprache(hass) {
  LOCALE = hass?.locale?.language || hass?.language || sprachBasis();
}

/** Text in der aktuellen Sprache, {platzhalter} gefüllt. */
export function t(key, werte = {}, locale = LOCALE) {
  const satz = TEXTE[spracheVon(locale)][key] ?? TEXTE.de[key] ?? key;
  return satz.replace(/\{(\w+)\}/g, (_, k) => String(werte[k] ?? ""));
}

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
const fmt = (n) => num(n).toLocaleString(LOCALE, { maximumFractionDigits: 2 });
const datum = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "2-digit" });
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
  return list.sort((x, y) => x.name.localeCompare(y.name, LOCALE));
}

export function faecher(liste) {
  const map = new Map();
  for (const p of liste) {
    if (!map.has(p.fach_id)) map.set(p.fach_id, { id: p.fach_id, name: p.fach || t("ohne_fach"), produkte: [] });
    map.get(p.fach_id).produkte.push(p);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, LOCALE));
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
  .zelle { position: relative; display: flex; }
  .tile { flex: 1; width: 100%; display: flex; flex-direction: column; gap: 4px; text-align: left;
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
    const lang = sprachBasis();
    return {
      schema: [
        {
          name: "modus",
          required: true,
          selector: {
            select: {
              mode: "dropdown",
              options: [
                { value: "entnahme", label: t("modus_entnahme", {}, lang) },
                { value: "scanner", label: t("modus_scanner", {}, lang) },
                { value: "fehlend", label: t("modus_fehlend", {}, lang) },
                { value: "ablaufend", label: t("modus_ablaufend", {}, lang) },
                { value: "etiketten", label: t("modus_etiketten", {}, lang) },
              ],
            },
          },
        },
        { name: "fach", selector: { text: {} } },
        { name: "titel", selector: { text: {} } },
      ],
      computeLabel: (s) => t({ modus: "feld_modus", fach: "feld_fach", titel: "feld_titel" }[s.name], {}, lang),
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
      throw new Error(t("unbekannter_modus", { modus }));
    }
    this._config = { ...config, modus };
    this._fach = config.fach || null;
    this._signatur = "";
    this._aufbau = false;
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const vorher = LOCALE;
    setzeSprache(hass);
    if (vorher !== LOCALE) {
      // Sprache gewechselt: alles neu aufbauen
      this._aufbau = false;
      this._signatur = "";
    }
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
    // Kamera freigeben; beim erneuten Einhängen (Ansichtswechsel) neu aufbauen
    this._scanner?.stop();
    this._scanner = null;
    this._aufbau = false;
    this._signatur = "";
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
      : `<div class="chips" role="toolbar" aria-label="${esc(t("fach"))}">
          <button class="chip" data-fach="" aria-pressed="${!fach}">${esc(t("alle"))}</button>
          ${alle
            .map((f) => `<button class="chip" data-fach="${esc(f.id)}" aria-pressed="${f.id === fach}">${esc(f.name)}</button>`)
            .join("")}
        </div>`;
    const tiles = sichtbar.map((p) => this._tile(p)).join("");
    // Fokus über das Neuzeichnen hinweg erhalten (Tastatur, Schalter-Bedienung)
    const fokus = this.shadowRoot.activeElement;
    const fokusSel = fokus?.dataset?.id
      ? `.${fokus.classList.contains("plus") ? "plus" : "tile"}[data-id="${CSS.escape(fokus.dataset.id)}"]`
      : fokus?.classList?.contains("chip")
        ? `.chip[data-fach="${CSS.escape(fokus.dataset.fach ?? "")}"]`
        : null;
    ziel.innerHTML = `
      ${titel ? this._titel(t("titel_entnehmen")) : ""}
      ${chips}
      ${sichtbar.length ? `<div class="grid">${tiles}</div>` : `<div class="leer-hinweis">${esc(t("keine_produkte"))}</div>`}`;
    ziel.querySelectorAll(".chip").forEach((b) =>
      b.addEventListener("click", () => {
        this._fach = b.dataset.fach || null;
        this._renderEntnahme(ziel, this._liste);
      }),
    );
    ziel.querySelectorAll(".tile").forEach((t) =>
      t.addEventListener("click", () => this._entnehmen(t.dataset.id)),
    );
    ziel.querySelectorAll(".plus").forEach((b) =>
      b.addEventListener("click", () => this._einlagern(b.dataset.id, 1)),
    );
    if (fokusSel) ziel.querySelector(fokusSel)?.focus();
  }

  _tile(p) {
    let mhd = "";
    if (p.mhd) {
      const cls = p.tage < 0 ? "alt" : p.tage <= 30 ? "warn" : "";
      mhd = `<span class="mhd ${cls}">${esc(t("mhd", { datum: datum(p.mhd) }))}${p.tage < 0 ? ` · ${esc(t("abgelaufen_kurz"))}` : ""}</span>`;
    }
    const cls = [p.bestand <= 0 ? "leer" : "", p.fehlt > 0 ? "unter" : ""].join(" ");
    const soll = p.soll > 0 ? ` <small>/ ${fmt(p.soll)}</small>` : "";
    return `
      <div class="zelle">
        <button class="tile ${cls}" data-id="${esc(p.id)}"
          aria-label="${esc(t("kachel_label", { name: p.name, bestand: fmt(p.bestand), soll: p.soll ? t("kachel_soll", { soll: fmt(p.soll) }) : "" }))}">
          <ha-icon icon="${esc(p.icon)}"></ha-icon>
          <span class="name">${esc(p.name)}</span>
          <span class="zahl">${fmt(p.bestand)}${soll}</span>
          ${mhd}
        </button>
        <button class="plus" data-id="${esc(p.id)}" aria-label="${esc(t("plus_label", { name: p.name }))}">
          <ha-icon icon="mdi:plus"></ha-icon>
        </button>
      </div>`;
  }

  async _entnehmen(id, menge = 1) {
    const p = this._liste.find((x) => x.id === id);
    if (!p || this._busy) return;
    if (p.bestand < menge) {
      toast(this, t("nichts_da", { name: p.name }));
      return;
    }
    this._busy = true;
    try {
      const res = await callService(this._hass, "entnehmen", { produkt: id, menge }, true);
      const zurueck = res?.entnommen || [];
      toast(this, t("entnommen", { name: p.name, menge: fmt(menge), rest: fmt(res?.bestand) }), {
        text: t("rueckgaengig"),
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
        else data.ohne_mhd = true;
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
      toast(
        this,
        t("eingelagert", {
          name: p?.name ?? id,
          menge: fmt(menge),
          mhd: res?.mhd ? t("eingelagert_mhd", { datum: datum(res.mhd) }) : "",
        }),
      );
      return res;
    } catch (err) {
      toast(this, fehlerText(err));
      return null;
    }
  }

  // --- Listen ---------------------------------------------------------------

  _renderFehlend(liste) {
    const fehlend = liste.filter((p) => p.fehlt > 0).sort((a, b) => a.fach.localeCompare(b.fach, LOCALE));
    this._inhalt.innerHTML = `
      ${this._titel(t("titel_fehlend"))}
      ${
        fehlend.length
          ? `<ul class="liste">${fehlend
              .map(
                (p) => `<li><ha-icon icon="${esc(p.icon)}"></ha-icon>
                  <span class="grow">${esc(p.name)}<br><span class="muted">${esc(p.fach)}</span></span>
                  <span class="wert">${fmt(p.fehlt)} ${esc(p.packung)}</span></li>`,
              )
              .join("")}</ul>`
          : `<div class="leer-hinweis">${esc(t("alles_im_soll"))}</div>`
      }`;
  }

  _renderAblaufend() {
    const st = this._hass.states[summaryEntity(this._hass, "ablaufend")];
    const chargen = st?.attributes?.chargen || [];
    const warn = st?.attributes?.warn_tage ?? 30;
    this._inhalt.innerHTML = `
      ${this._titel(t("titel_ablaufend"))}
      ${
        chargen.length
          ? `<ul class="liste">${chargen
              .map((c) => {
                const cls = c.tage < 0 ? "alt" : "warn";
                const wann = c.tage < 0 ? t("abgelaufen_seit", { tage: -c.tage }) : c.tage === 0 ? t("heute") : t("in_tagen", { tage: c.tage });
                return `<li><span class="grow">${esc(c.name)}<br><span class="muted">${esc(t("mhd", { datum: datum(c.mhd) }))}</span></span>
                  <span class="wert"><span class="${cls}">${esc(wann)}</span><br>${esc(t("packungen", { menge: fmt(c.menge) }))}</span></li>`;
              })
              .join("")}</ul>`
          : `<div class="leer-hinweis">${esc(t("nichts_laeuft_ab", { tage: warn }))}</div>`
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
          <div class="muted">${esc(t("n_produkte", { n: f.produkte.length }))}</div></div>`,
      )
      .join("");
    this._inhalt.innerHTML = `
      ${this._titel(t("titel_etiketten"))}
      <p class="muted">${esc(t("etiketten_hinweis"))}</p>
      <div class="etiketten">${etiketten}</div>
      <div class="zeile"><button class="aktion" id="drucken">${esc(t("drucken"))}</button></div>`;
    this._inhalt.querySelector("#drucken").addEventListener("click", () => {
      const w = window.open("", "_blank");
      if (!w) return toast(this, t("druck_blockiert"));
      w.document.write(`<!doctype html><html lang="${esc(LOCALE)}"><head><meta charset="utf-8"><title>${esc(t("titel_etiketten"))}</title>
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
      ${this._titel(t("titel_scanner"))}
      <div class="video"><video playsinline muted></video><div class="rahmen"></div></div>
      <div class="zeile">
        <button class="aktion" id="start">${esc(t("kamera_starten"))}</button>
        <label style="flex:2 1 200px">${esc(t("barcode_hand"))}
          <input id="manuell" inputmode="numeric" autocomplete="off" placeholder="${esc(t("barcode_beispiel"))}">
        </label>
        <button class="aktion zweit" id="suchen">${esc(t("suchen"))}</button>
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
      if (p) zahl.textContent = p.soll ? t("von", { bestand: fmt(p.bestand), soll: fmt(p.soll) }) : fmt(p.bestand);
    }
    const fachGrid = this._ergebnis?.querySelector("[data-fach-grid]");
    if (fachGrid) this._renderEntnahme(fachGrid, this._liste, { festesFach: fachGrid.dataset.fachGrid, titel: false });
  }

  async _kameraUmschalten(button) {
    if (this._scanner && !this._scanner.gestoppt) {
      this._scanner.stop();
      this._scanner = null;
      button.textContent = t("kamera_starten");
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this._status.textContent = t("kamera_https");
      return;
    }
    button.disabled = true;
    try {
      this._scanner = new Scanner(this._video, (code) => this._erkannt(code), (t) => (this._status.textContent = t));
      await this._scanner.start();
      button.textContent = t("kamera_stoppen");
    } catch (err) {
      this._status.textContent = t("kamera_fehlt", { fehler: fehlerText(err) });
    } finally {
      button.disabled = false;
    }
  }

  _ergebnisSchliessen() {
    this._ergebnis.innerHTML = "";
    if (this._scanner) this._scanner.gesperrt = false;
  }

  async _erkannt(code) {
    // Solange ein Ergebnis offen ist, nichts Neues erkennen: es würde Eingaben überschreiben
    if (this._scanner) this._scanner.gesperrt = true;
    navigator.vibrate?.(60);
    if (code.startsWith(QR_FACH)) return this._zeigeFach(code.slice(QR_FACH.length));
    if (code.startsWith(QR_PRODUKT)) {
      const p = this._liste.find((x) => x.id === code.slice(QR_PRODUKT.length));
      if (p) return this._zeigeProdukt(p);
      this._status.textContent = t("etikett_unbekannt");
      return this._ergebnisSchliessen();
    }
    if (!/^\d{8}$|^\d{12,14}$/.test(code)) {
      this._status.textContent = t("code_unbekannt", { code });
      return this._ergebnisSchliessen();
    }
    this._status.textContent = t("barcode_sucht", { code });
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
      this._ergebnisSchliessen();
    }
  }

  _zeigeFach(fachId) {
    const fach = faecher(this._liste).find((f) => f.id === fachId);
    this._status.textContent = "";
    this._ergebnis.innerHTML = `<div class="panel"><h3>${esc(fach?.name ?? fachId)}</h3>
      <p class="muted">${esc(t("fach_hinweis"))}</p>
      <div data-fach-grid="${esc(fachId)}"></div>
      <div class="zeile"><button class="aktion zweit" id="fertig">${esc(t("weiter_scannen"))}</button></div></div>`;
    this._ergebnis.querySelector("#fertig").addEventListener("click", () => this._ergebnisSchliessen());
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
      <div>${esc(t("bestand"))} <strong data-bestand-von="${esc(p.id)}">${esc(p.soll ? t("von", { bestand: fmt(p.bestand), soll: fmt(p.soll) }) : fmt(p.bestand))}</strong></div>
      <div class="zeile">
        <label>${esc(t("menge"))}<input id="menge" type="number" min="1" step="1" value="1" inputmode="numeric"></label>
        <label>${esc(t("mhd_einlagern"))}<input id="mhd" type="date" min="${isoHeute()}" value="${esc(mhd)}"></label>
      </div>
      <div class="zeile">
        <button class="aktion" id="rein">${esc(t("einlagern"))}</button>
        <button class="aktion zweit" id="raus">${esc(t("entnehmen"))}</button>
        <button class="aktion zweit" id="fertig">${esc(t("fertig"))}</button>
      </div></div>`;
    const $ = (s) => this._ergebnis.querySelector(s);
    const menge = () => Math.max(0.001, num($("#menge").value) || 1);
    $("#rein").addEventListener("click", async () => {
      await this._einlagern(p.id, menge(), $("#mhd").value || undefined);
    });
    $("#raus").addEventListener("click", () => this._entnehmen(p.id, menge()));
    $("#fertig").addEventListener("click", () => this._ergebnisSchliessen());
  }

  _zeigeUnbekannt(code, vorschlag) {
    const gruppen = [...new Set(this._liste.map((p) => p.gruppe))].sort((a, b) => a.localeCompare(b, LOCALE));
    const ohneCode = this._liste.filter((p) => !p.barcodes.length);
    const andere = this._liste.filter((p) => p.barcodes.length);
    const opt = (p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`;
    const vorschlagText = vorschlag
      ? `Open Food Facts: <strong>${esc(vorschlag.name)}</strong>${vorschlag.marke ? `, ${esc(vorschlag.marke)}` : ""}${vorschlag.menge ? `, ${esc(vorschlag.menge)}` : ""}`
      : esc(t("off_kein_eintrag"));
    this._status.textContent = "";
    this._ergebnis.innerHTML = `<div class="panel">
      <h3>${esc(t("barcode_unbekannt", { code }))}</h3>
      <div class="muted">${vorschlagText}</div>
      <div class="zeile">
        <label style="flex:3 1 220px">${esc(t("zu_produkt"))}
          <select id="ziel"><option value="">${esc(t("produkt_waehlen"))}</option>
            <optgroup label="${esc(t("ohne_barcode"))}">${ohneCode.map(opt).join("")}</optgroup>
            <optgroup label="${esc(t("mit_barcode"))}">${andere.map(opt).join("")}</optgroup>
          </select></label>
        <button class="aktion" id="zuordnen">${esc(t("zuordnen"))}</button>
      </div>
      <details style="margin-top:12px"><summary>${esc(t("neues_produkt"))}</summary>
        <div class="zeile">
          <label style="flex:3 1 220px">${esc(t("feld_name"))}<input id="name" value="${esc(vorschlag?.name ?? "")}" maxlength="120"></label>
          <label>${esc(t("gruppe"))}<select id="gruppe">${gruppen.map((g) => `<option value="${esc(makeId(g))}">${esc(g)}</option>`).join("")}</select></label>
        </div>
        <div class="zeile">
          <label>${esc(t("fach"))}<input id="fach" list="vk-faecher"></label>
          <datalist id="vk-faecher">${faecher(this._liste).map((f) => `<option value="${esc(f.name)}">`).join("")}</datalist>
          <label>${esc(t("soll_packungen"))}<input id="soll" type="number" min="0" step="1" value="0"></label>
          <label>${esc(t("haltbarkeit"))}<input id="haltbar" type="number" min="0" step="1" value="12"></label>
        </div>
        <div class="zeile"><button class="aktion" id="anlegen">${esc(t("anlegen"))}</button></div>
      </details>
      <div class="zeile"><button class="aktion zweit" id="fertig">${esc(t("abbrechen"))}</button></div></div>`;
    const $ = (s) => this._ergebnis.querySelector(s);
    $("#fertig").addEventListener("click", () => this._ergebnisSchliessen());
    $("#zuordnen").addEventListener("click", async () => {
      const id = $("#ziel").value;
      if (!id) return;
      try {
        await callService(this._hass, "barcode_zuordnen", { barcode: code, produkt: id });
        const p = this._liste.find((x) => x.id === id);
        toast(this, t("zugeordnet", { name: p?.name ?? id }));
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
        toast(this, t("angelegt", { name }));
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
    this.gestoppt = false;
    this.gesperrt = false;
    this.pauseBis = 0;
    this.letzter = { code: "", zeit: 0 };
  }

  async start() {
    const { detector, art } = await getDetector();
    this.detector = detector;
    if (this.gestoppt) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    // Karte während der Berechtigungsabfrage verlassen: Kamera sofort wieder freigeben
    if (this.gestoppt) return this.stop();
    try {
      this.video.srcObject = this.stream;
      await this.video.play();
    } catch (err) {
      this.stop();
      throw err;
    }
    if (this.gestoppt) return this.stop();
    this.aktiv = true;
    this.onStatus(t("kamera_laeuft", { art }));
    this._loop();
  }

  pause(ms) {
    this.pauseBis = Date.now() + ms;
  }

  stop() {
    this.gestoppt = true;
    this.aktiv = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
  }

  async _loop() {
    while (this.aktiv) {
      await new Promise((r) => setTimeout(r, 200));
      if (!this.aktiv || this.gesperrt || Date.now() < this.pauseBis || this.video.readyState < 2) {
        continue;
      }
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
  setzeSprache(hass);
  const liste = produkte(hass);
  const gruppen = new Map();
  for (const p of liste) {
    if (!gruppen.has(p.gruppe)) gruppen.set(p.gruppe, []);
    gruppen.get(p.gruppe).push(p);
  }
  const tile = (entity, extra = {}) => ({ type: "tile", entity, ...extra });
  const s = (key) => summaryEntity(hass, key);

  const uebersicht = {
    title: t("view_uebersicht"),
    path: "uebersicht",
    icon: "mdi:warehouse",
    type: "sections",
    max_columns: 3,
    sections: [
      {
        type: "grid",
        cards: [
          { type: "heading", heading: t("vorrat"), heading_style: "title" },
          tile(s("abdeckung"), { name: t("vorratsstand") }),
          tile(s("reichweite"), { name: t("reichweite") }),
          tile(s("fehlend"), {
            name: t("unter_soll"),
            tap_action: { action: "navigate", navigation_path: "einkauf" },
          }),
          tile(s("ablaufend"), { name: t("bald_ablaufend") }),
          {
            type: "history-graph",
            title: t("vorratsstand"),
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
    title: t("view_entnehmen"),
    path: "keller",
    icon: "mdi:gesture-tap",
    type: "panel",
    cards: [{ type: "custom:vorratskeller-card", modus: "entnahme" }],
  };

  const scanner = {
    title: t("view_scanner"),
    path: "scanner",
    icon: "mdi:barcode-scan",
    type: "panel",
    cards: [{ type: "custom:vorratskeller-card", modus: "scanner" }],
  };

  const bestand = {
    title: t("view_bestand"),
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
    title: t("view_einkauf"),
    path: "einkauf",
    icon: "mdi:cart-outline",
    type: "sections",
    max_columns: 2,
    sections: [{ type: "grid", cards: [{ type: "custom:vorratskeller-card", modus: "fehlend" }] }],
  };

  const etiketten = {
    title: t("view_etiketten"),
    path: "etiketten",
    icon: "mdi:qrcode",
    type: "panel",
    cards: [{ type: "custom:vorratskeller-card", modus: "etiketten" }],
  };

  if (!liste.length) {
    // Ohne Produkte: Hinweis und Scanner, damit sich das erste Produkt per Barcode anlegen lässt
    return {
      title: t("name"),
      views: [
        {
          title: t("view_uebersicht"),
          path: "uebersicht",
          icon: "mdi:warehouse",
          cards: [
            {
              type: "markdown",
              content: t("leer_hinweis"),
            },
          ],
        },
        scanner,
      ],
    };
  }
  return { title: t("name"), views: [uebersicht, keller, scanner, bestand, einkauf, etiketten] };
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
    get name() {
      return t("name", {}, sprachBasis());
    },
    get description() {
      return t("beschreibung_karte", {}, sprachBasis());
    },
    preview: false,
  });
}

window.customStrategies = window.customStrategies || [];
if (!window.customStrategies.some((s) => s.type === DOMAIN)) {
  window.customStrategies.push({
    type: DOMAIN,
    strategyType: "dashboard",
    get name() {
      return t("name", {}, sprachBasis());
    },
    get description() {
      return t("beschreibung_dashboard", {}, sprachBasis());
    },
  });
}
