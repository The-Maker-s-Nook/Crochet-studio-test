// Basics used everywhere: saved-data format, app state, small helpers, saving, icons, app constants
// Part of the Crochet Studio app. Files load in the order listed in index.html.

const KEY = 'crochetStudioPrototypeV1';
const DEFAULT_SETTINGS = { hourly: 15, method: 'labour', multiplier: 3, markup: 50, rounding: 'nearest', autoDeduct: false, taxRate: 13, taxOnPurchases: true, taxOnSales: false, taxInCosts: true };
function migrateData(d, fresh) {
    const n = v => Math.max(0, Number(v) || 0);
    if (!Array.isArray(d.units) || !d.units.length)
        d.units = [{ id: 'g', name: 'grams', short: 'g', builtin: true }, { id: 'pair', name: 'pairs', short: 'pairs', builtin: true }, { id: 'piece', name: 'pieces', short: 'pcs', builtin: true }];
    if (!Array.isArray(d.materialCategories) || !d.materialCategories.length)
        d.materialCategories = [{ id: 'cat_yarn', name: 'Yarn', unit: 'g', onProducts: true }, { id: 'cat_eyes', name: 'Eyes', unit: 'pair', onProducts: true }, { id: 'cat_stuffing', name: 'Stuffing', unit: 'g', onProducts: true, defaultMaterialId: d.settings?.defaultStuffing || '' }, { id: 'cat_other', name: 'Other', unit: 'piece', onProducts: false }];
    const legacy = { 'Yarn': 'cat_yarn', 'Safety eyes': 'cat_eyes', 'Felt eyes': 'cat_eyes', 'Stuffing': 'cat_stuffing', 'Other': 'cat_other' };
    for (let m of d.materials) {
        if (!m.categoryId || !d.materialCategories.some(c => c.id === m.categoryId))
            m.categoryId = d.materialCategories.some(c => c.id === legacy[m.category]) ? legacy[m.category] : d.materialCategories[d.materialCategories.length - 1].id;
        if (!m.unit)
            m.unit = 'piece';
        if (!d.units.some(u => u.id === m.unit))
            d.units.push({ id: m.unit, name: m.unit, short: m.unit });
    }
    for (let p of d.products) {
        if (!Array.isArray(p.materials)) {
            p.materials = [...(p.yarns || []).map(x => ({ materialId: x.materialId, amount: n(x.grams) })), ...(p.extras || []).map(x => ({ materialId: x.materialId, amount: n(x.amount) }))];
            delete p.yarns;
            delete p.extras;
        }
    }
    if (!Array.isArray(d.productCategories))
        d.productCategories = [];
    if (!Array.isArray(d.purchases))
        d.purchases = [];
    if (!Array.isArray(d.orders))
        d.orders = [];
    if (!Array.isArray(d.expenses))
        d.expenses = [];
    if (!Array.isArray(d.reminders))
        d.reminders = [];
    if (!d.settings.currency)
        d.settings.currency = guessCurrency();
    // Version 24 tax options. New setups: add tax to sales, material prices before tax. Older data keeps how it worked.
    const st = d.settings;
    if (!st.productTax)
        st.productTax = fresh || st.taxOnSales || d.products.some(p => p.taxed === true) ? 'add' : 'none';
    if (!st.materialTax)
        st.materialTax = fresh || st.taxOnPurchases !== false ? 'add' : 'includes';
    if (st.notClaimingTax === undefined)
        st.notClaimingTax = fresh ? false : st.taxInCosts !== false;
    for (let x of [...d.products, ...d.materials])
        delete x.taxed;
    // US rates differ by state and city, so a new US setup starts with no rate and asks for one.
    if (fresh && st.currency === 'USD')
        st.taxRate = null;
    for (let p of d.products)
        if (!Array.isArray(p.tagIds))
            p.tagIds = p.categoryId ? [p.categoryId] : [];
    // Version 24: one sale format. Sales from before version 18 had no order; give each one its own order.
    const r2 = v => Math.round(v * 100) / 100, newId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
    for (let s of d.sales) {
        if (s.orderId && d.orders.some(o => o.id === s.orderId))
            continue;
        if (s.listPrice == null)
            s.listPrice = n(s.price);
        if (s.disc == null)
            s.disc = 0;
        if (s.taxed == null)
            s.taxed = n(s.tax) > 0;
        let sub = r2(n(s.qty) * n(s.price)), tax = r2(n(s.tax));
        s.orderId = s.orderId || newId();
        d.orders.push({ id: s.orderId, marketId: s.marketId || null, date: s.date, full: r2(n(s.qty) * n(s.listPrice)), subtotal: sub, discount: null, tax, total: r2(sub + tax), payment: { method: '' } });
    }
    return d;
}
function normalizeData(d) {
    d = d && typeof d === 'object' ? d : {};
    for (const k of ['materials', 'products', 'sales', 'markets'])
        if (!Array.isArray(d[k]))
            d[k] = [];
    let fresh = !d.settings || !Object.keys(d.settings).length;
    d.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}) };
    migrateData(d, fresh);
    return d;
}
let data = normalizeData(null);
let dataLoaded = false;
try {
    localStorage.removeItem('crochetStudioTheme');
}
catch {
}
let materialPhoto = '', quickMaterialCategory = null, quickMaterialPhoto = '';
let marketSaleMode = false, marketSaleDraft = {};
let marketSelected = null, materialCategory = "Yarn", materialSearch = "", productPhotos = [], materialPhotos = [], quickPhotos = [];
let screen = 'home', editing = null, selected = null, productYarns = [], photo = '', activePattern = null, notice = '', inventoryInputs = {}, productFilter = '';
const $ = id => document.getElementById(id);
const id = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const num = v => Math.max(0, Number(v) || 0);
const cash = v => '$' + num(v).toFixed(2);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let saveQueue = Promise.resolve(), saveErrorShown = false, saveTimer = null;
const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 0);
    return true;
};
function flushSave() {
    clearTimeout(saveTimer);
    saveTimer = null;
    saveQueue = saveQueue.then(() => idbSet('app', 'data', data)).then(() => {
        saveErrorShown = false;
    }).catch(e => {
        console.error(e);
        if (!saveErrorShown) {
            saveErrorShown = true;
            appAlert('Could not save on this device. Your phone may be low on storage. Free up some space, then try again.');
        }
    });
    return saveQueue;
}
function toast(t) {
    notice = t;
    render();
    setTimeout(() => {
        if (notice === t) {
            notice = '';
            let e = $('notice');
            if (e)
                e.remove();
        }
    }, 4000);
}
const material = id => data.materials.find(x => x.id === id);
const product = id => data.products.find(x => x.id === id);
// ---- Country & currency ----
function guessCurrency() {
    try {
        let tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '', lang = navigator.language || '';
        if (/^America\/(Toronto|Montreal|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Moncton|Whitehorse|Yellowknife|Iqaluit|Glace_Bay|Goose_Bay|Swift_Current|Dawson_Creek|Fort_Nelson|Creston|Rankin_Inlet|Resolute|Cambridge_Bay|Inuvik|Atikokan|Blanc-Sablon|Nipigon|Thunder_Bay|Rainy_River|Dawson|Pangnirtung)$/.test(tz) || /-CA$/i.test(lang))
            return 'CAD';
        if (/^(America|Pacific\/Honolulu)/.test(tz) || /-US$/i.test(lang))
            return 'USD';
    }
    catch {
    }
    return 'CAD';
}
const ICONS = { "percent": "<path d=\"M19 5 5 19\"/><circle cx=\"7\" cy=\"7\" r=\"2.5\"/><circle cx=\"17\" cy=\"17\" r=\"2.5\"/>", "user": "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21a8 8 0 0 1 16 0\"/>", "download": "<path d=\"M12 3v12M7 10l5 5 5-5M5 21h14\"/>", "mail": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"m3 7 9 6 9-6\"/>", "lock": "<rect x=\"4\" y=\"11\" width=\"16\" height=\"10\" rx=\"2\"/><path d=\"M8 11V7a4 4 0 0 1 8 0v4\"/>", "star": "<path d=\"m12 3 2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z\"/>", "sync": "<path d=\"M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4\"/>", "logout": "<path d=\"M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3\"/>", "folder": "<path d=\"M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/>", "check": "<path d=\"M20 6 9 17l-5-5\"/>", "x": "<path d=\"M18 6 6 18M6 6l12 12\"/>", "camera": "<path d=\"M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z\"/><circle cx=\"12\" cy=\"13\" r=\"4\"/>", "home": "<path d=\"M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z\"/>", "products": "<path d=\"M21 8 12 3 3 8v8l9 5 9-5z\"/><path d=\"M3 8l9 5 9-5M12 13v8\"/>", "materials": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M6 7c4 2 6 6 6 13M18 7c-4 2-6 6-6 13M4.5 12h15\"/>", "patterns": "<path d=\"M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z\"/><path d=\"M14 3v6h6M8 13h8M8 17h5\"/>", "markets": "<path d=\"M3 9h18l-1.5-5h-15z\"/><path d=\"M5 9v11h14V9M10 20v-6h4v6\"/>", "reports": "<path d=\"M4 20V10M10 20V4M16 20v-7M22 20H2\"/>", "heart": "<path d=\"M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z\"/>", "tag": "<path d=\"M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z\"/><circle cx=\"7\" cy=\"7\" r=\"1.5\"/>", "trend": "<path d=\"M3 17l6-6 4 4 8-8\"/><path d=\"M14 7h7v7\"/>", "book": "<path d=\"M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z\"/><path d=\"M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5\"/>", "clock": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>", "gear": "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z\"/>" };
Object.assign(ICONS, { back: '<path d="M15 5l-7 7 7 7"/>', cloud: '<path d="M7 18a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 9a4 4 0 0 1 0 9z"/>', upload: '<path d="M7 18a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 9a4 4 0 0 1 0 9"/><path d="M12 12v8M9 15l3-3 3 3"/>' });
Object.assign(ICONS, { card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>', pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>' });
// ===== v23: tester feedback fixes and new features =====
ICONS.globe = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>';
const ic = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`;
const lsGet = (k, d) => {
    try {
        let v = localStorage.getItem(k);
        return v ? JSON.parse(v) : d;
    }
    catch {
        return d;
    }
};
const lsSet = (k, v) => {
    try {
        v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v));
    }
    catch {
    }
};
function normName(v) {
    return String(v ?? '').trim().replace(/\s+/g, ' ');
}
function byName(a, b) {
    return a.name.localeCompare(b.name);
}
// ===== v21: spreadsheet import (beta), feedback, pattern limit =====
const APP_VERSION = 24, PATTERN_LIMIT = 5, FEEDBACK_EMAIL = 'support@themakersnook.ca';
