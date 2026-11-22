/*
 * Vorratskeller: Karte und Dashboard-Strategie für Home Assistant.
 *
 * Karte:      type: custom:vorratskeller-card, modus: kopf | regal | panel | entnahme | scanner | fehlend | ablaufend | etiketten
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
    titel_dashboard: "Vorratskeller",
    start_titel: "Noch nichts eingelagert.",
    start_text: "Die Soll-Mengen für {n} Produkte sind angelegt. Jetzt erfassen, was schon im Keller steht.",
    start_schritt_1: "Unter Entnehmen bei jedem Produkt mit + die vorhandenen Packungen einlagern.",
    start_schritt_2: "Oder im Scanner den Barcode scannen und Menge und MHD eingeben.",
    start_schritt_3: "Danach zeigt die Übersicht, wie lange der Vorrat reicht und was fehlt.",
    start_einlagern: "Bestand erfassen",
    start_scanner: "Scanner öffnen",
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
    view_regal: "Regal",
    modus_kopf: "Übersicht mit Kennzahlen",
    modus_regal: "Regal-Ansicht",
    titel_regal: "Regal",
    regal_hinweis: "Tippen nimmt eine Packung heraus.",
    tage_reicht: "Tage reicht der Vorrat",
    reicht_nicht: "Reichweite noch unbekannt",
    engpass: "Am knappsten: {gruppe}",
    n_unter_soll: "{n} unter Soll",
    n_ablaufend: "{n} bald ablaufend",
    gruppen: "Gruppen",
    status_ok: "im Soll",
    status_knapp: "knapp",
    status_leer: "leer",
    status_frei: "ohne Soll",
    satz_reicht: "Der Vorrat reicht {tage}.",
    n_tage: "{n} Tage",
    produkte_fehlen: "Produkte fehlen",
    bald_verbrauchen: "bald verbrauchen",
    zuerst_verbrauchen: "Zuerst verbrauchen",
    einkaufen: "Einkaufen",
    nichts_laeuft_ab_kurz: "Nichts läuft bald ab.",
    n_leer: "{n} leer",
    n_knapp: "{n} knapp",
    alles_da: "alles da",
    zurueck: "Zurück",
    view_panel: "Panel",
    modus_panel: "Wandpanel",
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
    titel_dashboard: "Pantry",
    start_titel: "Nothing stored yet.",
    start_text: "Targets for {n} products are set up. Now record what is already in your pantry.",
    start_schritt_1: "Under Take out, press + on each product for every pack you have.",
    start_schritt_2: "Or scan the barcode in the Scanner and enter quantity and best-before date.",
    start_schritt_3: "Afterwards the overview shows how long supplies last and what is missing.",
    start_einlagern: "Record stock",
    start_scanner: "Open scanner",
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
    view_regal: "Shelves",
    modus_kopf: "Overview with key figures",
    modus_regal: "Shelf view",
    titel_regal: "Shelves",
    regal_hinweis: "Tap takes out one pack.",
    tage_reicht: "days of supply",
    reicht_nicht: "Days of supply not known yet",
    engpass: "Scarcest: {gruppe}",
    n_unter_soll: "{n} below target",
    n_ablaufend: "{n} expiring soon",
    gruppen: "Groups",
    status_ok: "at target",
    status_knapp: "low",
    status_leer: "empty",
    status_frei: "no target",
    satz_reicht: "Supplies last {tage}.",
    n_tage: "{n} days",
    produkte_fehlen: "products missing",
    bald_verbrauchen: "use soon",
    zuerst_verbrauchen: "Use first",
    einkaufen: "Shopping",
    nichts_laeuft_ab_kurz: "Nothing expires soon.",
    n_leer: "{n} empty",
    n_knapp: "{n} low",
    alles_da: "all there",
    zurueck: "Back",
    view_panel: "Panel",
    modus_panel: "Wall panel",
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
      hinweis: a.hinweis || "",
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

// Ordnungswörter der Böden, oben zuerst (deutsch und englisch)
const BODEN_RANG = [
  ["oberster", 9], ["top", 9], ["sechster", 6], ["sixth", 6], ["fünfter", 5], ["fifth", 5],
  ["vierter", 4], ["fourth", 4], ["dritter", 3], ["third", 3], ["zweiter", 2], ["second", 2],
  ["erster", 1], ["first", 1], ["unterster", 0], ["bottom", 0],
];

/** Regal und Boden aus dem Fachnamen: „Links, dritter Boden“ → Regal „Links“, Rang 3. */
export function regalUndBoden(fachName) {
  const name = String(fachName || "");
  const komma = name.indexOf(",");
  const regal = komma > 0 ? name.slice(0, komma).trim() : name.trim();
  const boden = komma > 0 ? name.slice(komma + 1).trim() : "";
  const klein = name.toLowerCase();
  let rang = -1;
  for (const [wort, wert] of BODEN_RANG) {
    if (new RegExp(`(^|[^a-zäöüß])${wort}([^a-zäöüß]|$)`).test(klein)) rang = Math.max(rang, wert);
  }
  return { regal, boden, rang };
}

/** Regale mit ihren Böden (oben zuerst) aus der Produktliste. */
export function regale(liste) {
  const map = new Map();
  for (const f of faecher(liste)) {
    const { regal, boden, rang } = regalUndBoden(f.name);
    if (!map.has(regal)) map.set(regal, { name: regal, boeden: [] });
    map.get(regal).boeden.push({ ...f, boden, rang });
  }
  for (const r of map.values()) r.boeden.sort((a, b) => b.rang - a.rang || a.name.localeCompare(b.name, LOCALE));
  return [...map.values()];
}

/** Zustand eines Produkts für Farbe und Text. */
export function zustand(p) {
  if (p.soll <= 0) return "frei";
  if (p.bestand <= 0) return "leer";
  if (p.fehlt > 0) return "knapp";
  return "ok";
}

/** Farbstufe eines Anteils 0..1. */
const stufe = (f) => (f >= 0.9 ? "s-ok" : f >= 0.5 ? "s-knapp" : "s-leer");

/** Form des Gefäßes aus Packung, Hinweis und Gruppe: glas, dose, flasche, kasten, packung, kiste. */
export function form(p) {
  const text = `${p.packung} ${p.hinweis} ${p.name}`.toLowerCase();
  if (/kasten|kästen|crate/.test(text)) return "kasten";
  if (/\bdose\b|\bcan\b|konserve|canned/.test(text)) return "dose";
  if (/glas|gläser|\bjar|tube/.test(text)) return "glas";
  if (/flasche|bottle|\d\s*l\b|× ?[\d,.]+ ?l\b/.test(text)) return "flasche";
  if (/× ?[\d,.]+ ?k?g\b|packung|pack\b|tafel|bars?\b/.test(text)) return "packung";
  return "kiste";
}

/** SVG eines Gefäßes, gefüllt zu f (0..1); Farbe über --c. */
function gefaessSvg(art, f, id) {
  const fuell = (x, y, b, h, r) =>
    `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${b}" height="${h}" rx="${r}"/></clipPath>
     <rect class="inhalt" clip-path="url(#${id})" x="${x}" y="${(y + h * (1 - f)).toFixed(1)}" width="${b}" height="${(h * f).toFixed(1)}"/>`;
  const svg = (inhalt) => `<svg width="48" height="64" viewBox="0 0 48 64" aria-hidden="true">${inhalt}</svg>`;
  switch (art) {
    case "glas":
      return svg(`<rect class="deckel" x="13" y="6" width="22" height="8" rx="2"/>
        <rect class="huelle" x="9" y="13" width="30" height="48" rx="8"/>${fuell(10.5, 14.5, 27, 45, 7)}`);
    case "dose":
      return svg(`<rect class="huelle" x="9" y="12" width="30" height="49" rx="4"/>${fuell(10.5, 13.5, 27, 46, 3)}
        <rect class="deckel" x="9" y="21" width="30" height="2.5" opacity=".6"/><rect class="deckel" x="9" y="49" width="30" height="2.5" opacity=".6"/>`);
    case "flasche":
      return svg(`<rect class="deckel" x="20" y="1" width="8" height="6" rx="1.5"/>
        <path class="huelle" d="M19 7h10v8c0 3 6 5 6 11v32a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4V26c0-6 6-8 6-11z"/>
        ${fuell(14.5, 16, 19, 44.5, 4)}`);
    case "kasten":
      return svg(`<rect class="huelle" x="3" y="22" width="42" height="39" rx="4"/>${fuell(4.5, 23.5, 39, 36, 3)}
        <rect class="deckel" x="10" y="12" width="5" height="12" rx="2"/><rect class="deckel" x="21.5" y="12" width="5" height="12" rx="2"/>
        <rect class="deckel" x="33" y="12" width="5" height="12" rx="2"/>`);
    case "packung":
      return svg(`<path class="huelle" d="M10 14l4-6h20l4 6v45a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2z"/>${fuell(11.5, 15, 25, 44.5, 1)}`);
    default:
      return svg(`<rect class="huelle" x="4" y="24" width="40" height="37" rx="5"/>${fuell(5.5, 25.5, 37, 34, 4)}
        <rect class="deckel" x="16" y="18" width="16" height="7" rx="3" opacity=".7"/>`);
  }
}

function navigiere(ziel) {
  // relativ zur aktuellen Dashboard-Ansicht, wie navigation_path in HA
  const pfad = ziel.startsWith("/") ? ziel : location.pathname.replace(/[^/]*$/, ziel);
  history.pushState(null, "", pfad);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
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
  .s-ok { --c: var(--success-color, #43a047); }
  .s-knapp { --c: var(--warning-color, #ffa600); }
  .s-leer { --c: var(--error-color, #db4437); }
  .s-frei { --c: var(--disabled-text-color, #9e9e9e); }
  /* Kopf: Satz, Ring, Zähler */
  .kopf { display: flex; gap: 18px; align-items: center; }
  .ring { position: relative; width: 104px; height: 104px; flex: none; }
  .ring svg { width: 100%; height: 100%; transform: rotate(-90deg); display: block; }
  .ring .spur, .miniring .spur { stroke: var(--divider-color); }
  .ring .wert, .miniring .wert { stroke: var(--c); stroke-linecap: round;
    transition: stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1); }
  .ring .mitte { position: absolute; inset: 0; display: grid; place-content: center; font-size: 1.5rem;
    font-weight: 600; font-variant-numeric: tabular-nums; }
  .satz { font-size: 1.6rem; font-weight: 600; line-height: 1.2; text-wrap: balance; }
  .satz em { font-style: normal; color: var(--c); }
  .unter-satz { margin-top: 6px; color: var(--secondary-text-color); text-wrap: pretty; }
  .stats { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .stat { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 6px 14px;
    border-radius: 20px; border: 1px solid var(--divider-color); background: none; font: inherit;
    color: var(--primary-text-color); }
  button.stat { cursor: pointer; }
  .stat ha-icon { --mdc-icon-size: 20px; color: var(--c); }
  .gruppen { margin-top: 18px; display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
  .gruppe { display: flex; gap: 10px; align-items: center; min-width: 0; }
  .miniring { width: 40px; height: 40px; flex: none; transform: rotate(-90deg); }
  .gruppe .gtext { min-width: 0; }
  .gruppe .gname { font-size: 0.9rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gruppe .gwert { font-size: 0.8rem; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
  @media (max-width: 420px) { .kopf { flex-direction: column; align-items: flex-start; } .satz { font-size: 1.35rem; } }
  .start { display: flex; gap: 18px; align-items: flex-start; }
  .start > ha-icon { --mdc-icon-size: 56px; color: var(--primary-color); flex: none; margin-top: 4px; }
  .schritte { margin: 12px 0 4px; padding-left: 20px; display: grid; gap: 6px; }
  @media (max-width: 420px) { .start { flex-direction: column; } }
  /* Regal gezeichnet */
  .regale { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 18px; }
  .regal h3 { margin: 0 0 8px; font-size: 1.05rem; font-weight: 500; }
  .gestell { border-left: 8px solid var(--regal-pfosten); border-right: 8px solid var(--regal-pfosten);
    border-radius: 6px; background: var(--regal-rueck); padding: 6px 10px 0; }
  .gestell { --regal-pfosten: color-mix(in srgb, var(--secondary-text-color) 55%, transparent);
    --regal-rueck: var(--secondary-background-color); }
  .boden-name { font-size: 0.75rem; color: var(--secondary-text-color); margin: 4px 0 2px; }
  .fachreihe { display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: flex-end; }
  .brett { height: 8px; margin: 0 -10px 6px; background: var(--regal-pfosten); border-radius: 2px; }
  .gefaess { width: 78px; padding: 4px 2px 2px; border: none; background: none; color: var(--primary-text-color);
    font: inherit; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px;
    border-radius: 10px; touch-action: manipulation; transition: transform 80ms ease-out; }
  .gefaess:active { transform: scale(0.95); }
  .gefaess svg { display: block; }
  .gefaess .huelle { fill: var(--card-background-color); stroke: var(--c); stroke-width: 2.5; }
  .gefaess .inhalt { fill: var(--c); opacity: 0.8; }
  .gefaess .deckel { fill: var(--c); }
  .gefaess .dname { font-size: 0.7rem; line-height: 1.15; text-align: center; display: -webkit-box;
    -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: 100%; hyphens: auto;
    overflow-wrap: anywhere; min-height: 1.6em; }
  .gefaess .dzahl { font-size: 0.8rem; font-weight: 600; font-variant-numeric: tabular-nums; }
  .gefaess .dzahl small { font-weight: 400; color: var(--secondary-text-color); }
  .gefaess.alt-mhd .dzahl::after { content: ""; display: inline-block; width: 7px; height: 7px; border-radius: 50%;
    background: var(--error-color, #db4437); margin-left: 4px; vertical-align: 1px; }
  .legende { display: flex; gap: 14px; flex-wrap: wrap; font-size: 0.8rem; color: var(--secondary-text-color);
    margin: 0 0 8px; }
  .legende span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 3px;
    background: var(--c); margin-right: 6px; vertical-align: -1px; }
  /* Wandpanel */
  .gross3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .gross3 > * { border-radius: 14px; padding: 14px; background: var(--secondary-background-color); border: none;
    border-top: 4px solid var(--c); font: inherit; color: var(--primary-text-color); text-align: left; }
  .gross3 .n { font-size: 2.8rem; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; }
  .gross3 .t { font-size: 0.9rem; color: var(--secondary-text-color); margin-top: 6px; }
  .tun { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; margin-top: 10px; }
  .tun section { border-radius: 14px; padding: 12px 14px; background: var(--secondary-background-color); }
  .tun h3 { margin: 0 0 4px; font-size: 1rem; font-weight: 600; }
  .eintrag { display: flex; justify-content: space-between; gap: 8px; padding: 10px 0;
    border-top: 1px solid var(--divider-color); font-size: 0.95rem; }
  .eintrag span:last-child { color: var(--c); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin-top: 10px; }
  .feld { position: relative; overflow: hidden; border-radius: 12px; padding: 12px; min-height: 76px;
    border: 1px solid var(--c); background: var(--card-background-color); color: var(--primary-text-color);
    font: inherit; text-align: left; cursor: pointer; display: flex; flex-direction: column;
    justify-content: space-between; gap: 6px; touch-action: manipulation; transition: transform 80ms ease-out; }
  .feld::before { content: ""; position: absolute; inset: 0; background: var(--c); opacity: 0.16; }
  .feld > * { position: relative; }
  .feld:active { transform: scale(0.97); }
  .feld b { font-weight: 600; }
  .feld .leise { font-size: 0.8rem; color: var(--secondary-text-color); }
  @media (prefers-reduced-motion: reduce) {
    .tile, .gefaess, .feld { transition: none; }
    .tile:active, .gefaess:active, .feld:active { transform: none; }
    .ring .wert, .miniring .wert { transition-duration: 1ms; }
  }
`;

// ---------------------------------------------------------------------------
// Karte
// ---------------------------------------------------------------------------

const MODI = ["entnahme", "scanner", "fehlend", "ablaufend", "etiketten", "kopf", "regal", "panel"];

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
                { value: "kopf", label: t("modus_kopf", {}, lang) },
                { value: "regal", label: t("modus_regal", {}, lang) },
                { value: "panel", label: t("modus_panel", {}, lang) },
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
    if (!MODI.includes(modus)) {
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
    const extra = ["fehlend", "ablaufend", "reichweite", "abdeckung"]
      .map((k) => this._hass.states[summaryEntity(this._hass, k)]?.last_updated)
      .join();
    return `${s}#${extra}`;
  }

  _render() {
    if (!this._config || !this._hass) return;
    const modus = this._config.modus;
    if (!this._aufbau) {
      this.shadowRoot.innerHTML = `<style>${STYLE}</style><ha-card lang="${esc(LOCALE)}"><div id="inhalt"></div></ha-card>`;
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
    else if (modus === "kopf") this._renderKopf(liste);
    else if (modus === "regal") this._renderRegal(liste);
    else if (modus === "panel") this._renderPanel(liste);
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

  // --- Kopf: Satz, Ring, Gruppen ------------------------------------------

  _kennzahlen() {
    const st = (k) => this._hass.states[summaryEntity(this._hass, k)];
    const reichweite = st("reichweite");
    return {
      prozent: num(st("abdeckung")?.state),
      tage: Number(reichweite?.state),
      engpass: reichweite?.attributes?.engpass,
      fehlend: num(st("fehlend")?.state),
      ablaufend: num(st("ablaufend")?.state),
      chargen: st("ablaufend")?.attributes?.chargen || [],
    };
  }

  _renderKopf(liste) {
    if (!liste.some((p) => p.bestand > 0)) return this._renderStart(liste);
    const k = this._kennzahlen();
    const ringKlasse = stufe(k.prozent / 100);
    const tageKlasse = !Number.isFinite(k.tage) ? "s-frei" : k.tage >= 14 ? "s-ok" : k.tage >= 7 ? "s-knapp" : "s-leer";
    const U = 2 * Math.PI * 50;
    const u = 2 * Math.PI * 15;
    const gruppen = new Map();
    for (const p of liste) {
      if (p.soll <= 0) continue;
      const g = gruppen.get(p.gruppe) ?? { name: p.gruppe, soll: 0, da: 0 };
      g.soll += p.soll;
      g.da += Math.min(p.soll, p.bestand);
      gruppen.set(p.gruppe, g);
    }
    const zeilen = [...gruppen.values()]
      .map((g) => ({ ...g, f: g.soll ? g.da / g.soll : 0 }))
      .sort((a, b) => a.f - b.f)
      .map(
        (g) => `<div class="gruppe ${stufe(g.f)}">
          <svg class="miniring" viewBox="0 0 40 40" aria-hidden="true">
            <circle class="spur" cx="20" cy="20" r="15" fill="none" stroke-width="6"></circle>
            <circle class="wert" cx="20" cy="20" r="15" fill="none" stroke-width="6" stroke-dasharray="${u.toFixed(1)}"
              stroke-dashoffset="${(u * (1 - g.f)).toFixed(1)}"></circle></svg>
          <div class="gtext"><div class="gname">${esc(g.name)}</div>
            <div class="gwert">${fmt(Math.round(g.f * 100))} %</div></div></div>`,
      )
      .join("");
    const satz = Number.isFinite(k.tage)
      ? t("satz_reicht", { tage: `<em>${esc(t("n_tage", { n: fmt(Math.floor(k.tage)) }))}</em>` })
      : esc(t("reicht_nicht"));
    this._inhalt.innerHTML = `
      <div class="kopf">
        <div class="ring ${ringKlasse}" role="img" aria-label="${esc(t("vorratsstand"))}: ${fmt(Math.round(k.prozent))} %">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="spur" cx="60" cy="60" r="50" fill="none" stroke-width="14"></circle>
            <circle class="wert" cx="60" cy="60" r="50" fill="none" stroke-width="14" stroke-dasharray="${U.toFixed(1)}"
              stroke-dashoffset="${(U * (1 - Math.min(k.prozent, 100) / 100)).toFixed(1)}"></circle></svg>
          <div class="mitte">${fmt(Math.round(k.prozent))} %</div>
        </div>
        <div>
          <div class="satz ${tageKlasse}">${satz}</div>
          ${k.engpass ? `<div class="unter-satz">${esc(t("engpass", { gruppe: k.engpass }))}</div>` : ""}
          <div class="stats">
            <button class="stat ${k.fehlend ? "s-knapp" : "s-ok"}" data-nav="einkauf">
              <ha-icon icon="mdi:cart-arrow-down"></ha-icon>${esc(t("n_unter_soll", { n: fmt(k.fehlend) }))}</button>
            <span class="stat ${k.ablaufend ? "s-leer" : "s-ok"}">
              <ha-icon icon="mdi:calendar-alert"></ha-icon>${esc(t("n_ablaufend", { n: fmt(k.ablaufend) }))}</span>
          </div>
        </div>
      </div>
      ${zeilen ? `<div class="gruppen" aria-label="${esc(t("gruppen"))}">${zeilen}</div>` : ""}`;
    this._inhalt.querySelector("[data-nav]")?.addEventListener("click", (ev) => navigiere(ev.currentTarget.dataset.nav));
  }

  // Noch nichts eingelagert: Anleitung statt lauter Nullen
  _renderStart(liste) {
    const mitSoll = liste.filter((p) => p.soll > 0).length;
    this._inhalt.innerHTML = `
      <div class="start">
        <ha-icon icon="mdi:warehouse"></ha-icon>
        <div>
          <div class="satz">${esc(t("start_titel"))}</div>
          <p class="unter-satz">${esc(t("start_text", { n: fmt(mitSoll) }))}</p>
          <ol class="schritte">
            <li>${esc(t("start_schritt_1"))}</li>
            <li>${esc(t("start_schritt_2"))}</li>
            <li>${esc(t("start_schritt_3"))}</li>
          </ol>
          <div class="zeile">
            <button class="aktion" data-nav="keller">${esc(t("start_einlagern"))}</button>
            <button class="aktion zweit" data-nav="scanner">${esc(t("start_scanner"))}</button>
          </div>
        </div>
      </div>`;
    this._inhalt.querySelectorAll("[data-nav]").forEach((b) =>
      b.addEventListener("click", () => navigiere(b.dataset.nav)),
    );
  }

  // --- Regal, gezeichnet ----------------------------------------------------

  _gefaess(p, nr) {
    const z = zustand(p);
    const f = p.soll > 0 ? Math.min(1, p.bestand / p.soll) : p.bestand > 0 ? 1 : 0;
    const alt = p.mhd && p.tage < 0 ? " alt-mhd" : "";
    const label = t("kachel_label", {
      name: p.name,
      bestand: fmt(p.bestand),
      soll: p.soll ? t("kachel_soll", { soll: fmt(p.soll) }) : "",
    });
    return `<button class="gefaess s-${z}${alt}" data-id="${esc(p.id)}" title="${esc(p.name)}" aria-label="${esc(label)}">
      ${gefaessSvg(form(p), f, `vk${nr}`)}
      <span class="dname">${esc(p.name)}</span>
      <span class="dzahl">${fmt(p.bestand)}${p.soll ? `<small>/${fmt(p.soll)}</small>` : ""}</span>
    </button>`;
  }

  _renderRegal(liste, ziel = this._inhalt, { nurFach = null, titel = true } = {}) {
    let nr = 0;
    const alle = regale(nurFach ? liste.filter((p) => p.fach_id === nurFach) : liste);
    const html = alle
      .map(
        (r) => `<section class="regal">${nurFach ? "" : `<h3>${esc(r.name)}</h3>`}<div class="gestell">
          ${r.boeden
            .map(
              (b) => `${b.boden ? `<div class="boden-name">${esc(b.boden)}</div>` : ""}
                <div class="fachreihe">${b.produkte.map((p) => this._gefaess(p, nr++)).join("")}</div>
                <div class="brett"></div>`,
            )
            .join("")}</div></section>`,
      )
      .join("");
    const fokus = this.shadowRoot.activeElement?.dataset?.id;
    ziel.innerHTML = `
      ${titel ? this._titel(t("titel_regal")) : ""}
      ${titel ? `<div class="legende">
        <span class="s-ok">${esc(t("status_ok"))}</span><span class="s-knapp">${esc(t("status_knapp"))}</span>
        <span class="s-leer">${esc(t("status_leer"))}</span><span class="s-frei">${esc(t("status_frei"))}</span>
        <span class="muted">${esc(t("regal_hinweis"))}</span>
      </div>` : ""}
      ${alle.length ? `<div class="regale">${html}</div>` : `<div class="leer-hinweis">${esc(t("keine_produkte"))}</div>`}`;
    ziel.querySelectorAll(".gefaess").forEach((b) => b.addEventListener("click", () => this._entnehmen(b.dataset.id)));
    if (fokus) ziel.querySelector(`.gefaess[data-id="${CSS.escape(fokus)}"]`)?.focus();
  }

  // --- Wandpanel ------------------------------------------------------------

  _renderPanel(liste) {
    if (this._panelFach) {
      // Ein Fach offen: dessen Produkte gezeichnet, darunter zurück
      const fach = faecher(liste).find((f) => f.id === this._panelFach);
      this._inhalt.innerHTML = `<h2>${esc(fach?.name ?? "")}</h2><div id="fachinhalt"></div>
        <div class="zeile"><button class="aktion zweit" id="zurueck">${esc(t("zurueck"))}</button></div>`;
      this._renderRegal(liste, this._inhalt.querySelector("#fachinhalt"), { nurFach: this._panelFach, titel: false });
      this._inhalt.querySelector("#zurueck").addEventListener("click", () => {
        this._panelFach = null;
        this._signatur = "";
        this._render();
      });
      return;
    }
    const k = this._kennzahlen();
    const tageKlasse = !Number.isFinite(k.tage) ? "s-frei" : k.tage >= 14 ? "s-ok" : k.tage >= 7 ? "s-knapp" : "s-leer";
    const verbrauchen = k.chargen
      .slice(0, 5)
      .map((c) => {
        const wann = c.tage < 0 ? t("abgelaufen_kurz") : c.tage === 0 ? t("heute") : t("in_tagen", { tage: c.tage });
        return `<div class="eintrag ${c.tage < 0 ? "s-leer" : "s-knapp"}"><span>${esc(c.name)}</span><span>${esc(wann)}</span></div>`;
      })
      .join("");
    const einkaufen = liste
      .filter((p) => p.fehlt > 0)
      .sort((a, b) => b.fehlt / (b.soll || 1) - a.fehlt / (a.soll || 1))
      .slice(0, 5)
      .map((p) => `<div class="eintrag s-knapp"><span>${esc(p.name)}</span><span>${esc(`${fmt(p.fehlt)} ${p.packung}`.trim())}</span></div>`)
      .join("");
    const rang = { leer: 3, knapp: 2, ok: 1, frei: 0 };
    const felder = regale(liste)
      .flatMap((r) => r.boeden.map((b) => ({ ...b, regal: r.name })))
      .map((b) => {
        const z = b.produkte.map(zustand);
        const schlecht = z.reduce((a, x) => (rang[x] > rang[a] ? x : a), "frei");
        const leer = z.filter((x) => x === "leer").length;
        const knapp = z.filter((x) => x === "knapp").length;
        const text = leer ? t("n_leer", { n: leer }) : knapp ? t("n_knapp", { n: knapp }) : t("alles_da");
        return `<button class="feld s-${schlecht}" data-fach="${esc(b.id)}">
          <div><b>${esc(b.regal)}</b>${b.boden ? `<div class="leise">${esc(b.boden)}</div>` : ""}</div><span>${esc(text)}</span></button>`;
      })
      .join("");
    this._inhalt.innerHTML = `
      <div class="gross3">
        <div class="${tageKlasse}"><div class="n">${Number.isFinite(k.tage) ? fmt(Math.floor(k.tage)) : "–"}</div>
          <div class="t">${esc(t("tage_reicht"))}</div></div>
        <button class="${k.fehlend ? "s-knapp" : "s-ok"}" data-nav="einkauf" style="cursor:pointer">
          <div class="n">${fmt(k.fehlend)}</div><div class="t">${esc(t("produkte_fehlen"))}</div></button>
        <div class="${k.ablaufend ? "s-leer" : "s-ok"}"><div class="n">${fmt(k.ablaufend)}</div>
          <div class="t">${esc(t("bald_verbrauchen"))}</div></div>
      </div>
      <div class="tun">
        <section><h3>${esc(t("zuerst_verbrauchen"))}</h3>${verbrauchen || `<div class="muted">${esc(t("nichts_laeuft_ab_kurz"))}</div>`}</section>
        <section><h3>${esc(t("einkaufen"))}</h3>${einkaufen || `<div class="muted">${esc(t("alles_im_soll"))}</div>`}</section>
      </div>
      <div class="raster">${felder}</div>`;
    this._inhalt.querySelector("[data-nav]")?.addEventListener("click", (ev) => navigiere(ev.currentTarget.dataset.nav));
    this._inhalt.querySelectorAll(".feld").forEach((b) =>
      b.addEventListener("click", () => {
        this._panelFach = b.dataset.fach;
        this._signatur = "";
        this._render();
      }),
    );
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
        column_span: 2,
        cards: [
          { type: "heading", heading: t("vorrat"), heading_style: "title" },
          { type: "custom:vorratskeller-card", modus: "kopf", grid_options: { columns: "full" } },
        ],
      },
      {
        type: "grid",
        cards: [{ type: "custom:vorratskeller-card", modus: "ablaufend", grid_options: { columns: "full" } }],
      },
      // Verlauf erst, wenn etwas eingelagert ist (vorher nur eine Linie auf 0)
      ...(liste.some((p) => p.bestand > 0) ? [{
        type: "grid",
        column_span: 2,
        cards: [
          {
            type: "history-graph",
            title: t("vorratsstand"),
            hours_to_show: 24 * 30,
            entities: [{ entity: s("abdeckung") }],
            grid_options: { columns: "full" },
          },
        ],
      }] : []),
      {
        type: "grid",
        cards: [{ type: "custom:vorratskeller-card", modus: "fehlend", grid_options: { columns: "full" } }],
      },
    ],
  };

  const regal = {
    title: t("view_regal"),
    path: "regal",
    icon: "mdi:bookshelf",
    type: "panel",
    cards: [{ type: "custom:vorratskeller-card", modus: "regal" }],
  };

  const panel = {
    title: t("view_panel"),
    path: "panel",
    icon: "mdi:tablet-dashboard",
    type: "panel",
    cards: [{ type: "custom:vorratskeller-card", modus: "panel" }],
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
  return { title: t("name"), views: [uebersicht, regal, keller, scanner, bestand, einkauf, etiketten, panel] };
}

class VorratskellerStrategy extends HTMLElement {
  static async generate(_config, hass) {
    return generateDashboard(hass);
  }

  /** Vorschlag für Titel und Symbol im Dialog „Neues Dashboard“ (HA-Frontend ab 2026.10). */
  static getCreateSuggestions(hass) {
    setzeSprache(hass);
    return { title: t("titel_dashboard"), icon: "mdi:warehouse" };
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

// Vorschaubild im Dialog „Dashboard hinzufügen“. HA zeigt Bilder nur bei eigenen Dashboards; die Karte
// (dashboard-card) hat aber eine Eigenschaft img. Wir setzen sie, sobald der Dialog unsere Karte zeichnet.
// Ändert HA den Dialog, fehlt nur das Bild (im HA-Frontend 2026.10 und 2026.11 geprüft).
function vorschauEinsetzen() {
  const dunkel = document.querySelector("home-assistant")?.hass?.themes?.darkMode;
  const bild = `${BASE}/vorschau-${dunkel ? "dunkel" : "hell"}.svg`;
  const suche = (wurzel) => {
    for (const el of wurzel.querySelectorAll("*")) {
      if (el.localName === "dashboard-card" && el.strategy === `custom:${DOMAIN}` && el.img !== bild) {
        el.img = bild;
        el.alt = t("name", {}, sprachBasis());
      }
      if (el.shadowRoot) suche(el.shadowRoot);
    }
  };
  try {
    suche(document);
  } catch (_err) {
    // ohne Bild weiter
  }
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
      // Der Dialog liest die Beschreibung beim Zeichnen; danach das Bild einsetzen
      if (typeof document !== "undefined") for (const ms of [0, 150, 600]) setTimeout(vorschauEinsetzen, ms);
      return t("beschreibung_dashboard", {}, sprachBasis());
    },
  });
}
