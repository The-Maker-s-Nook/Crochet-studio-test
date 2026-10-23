// All money maths in one place: labour, suggested prices, tax, rounding, material unit cost, sale totals and discounts
// Part of the Crochet Studio app. Files load in the order listed in index.html.

function labourCost(p) {
    return num(p.hours) * num(data.settings.hourly);
}
function labourInfo(p) {
    let method = p.method || data.settings.method;
    if (method === 'multiply')
        return { label: 'Labour', text: 'not used with multiplier pricing' };
    return { label: `Labour (${num(p.hours)} h × ${cash(data.settings.hourly)}/hr)`, text: cash(labourCost(p)) };
}
function suggest(p) {
    let m = recipeCost(p), s = data.settings, method = p.method || s.method, raw = method === 'multiply' ? m * num(p.multiplier || s.multiplier) : method === 'markup' ? m * (1 + num(p.markup || s.markup) / 100) + num(p.hours) * num(s.hourly) : m + num(p.hours) * num(s.hourly);
    // Prices are worked out before tax. If this product's price already includes tax, add it so the amount kept stays the same.
    let t = productTaxInfo(p);
    if (t.mode === 'included')
        raw *= 1 + t.rate / 100;
    return s.rounding === 'up5' ? Math.ceil(raw / 5) * 5 : s.rounding === 'up1' ? Math.ceil(raw) : Math.round(raw);
}
// ===== Tax =====
// Product tax:  'add' = tax added at checkout · 'included' = tax already inside the sale price · 'none' = no tax
// Material tax: 'includes' = prices entered include tax · 'add' = prices entered are before tax · 'none' = no tax
const PRODUCT_TAX = [['add', 'Add tax to sale price'], ['included', 'Tax already included in sale price'], ['none', 'Neither']];
const MATERIAL_TAX = [['includes', 'Inputted pricing includes tax'], ['add', 'Add tax to inputted pricing'], ['none', 'Neither']];
function taxRate() {
    return num(data.settings.taxRate);
}
function round2(v) {
    return Math.round(v * 100) / 100;
}
// Tax on an amount at a rate in % (default: the main tax rate), rounded to the cent. Used everywhere tax is worked out.
function taxOn(amount, rate = taxRate()) {
    return round2(amount * rate / 100);
}
// The tax inside an amount that already includes tax.
function taxInside(amount, rate = taxRate()) {
    return round2(amount - amount / (1 + rate / 100));
}
// Which tax option and rate an item uses: its own override if ticked, otherwise the main setting.
function itemTax(item, kind) {
    let o = item?.taxOverride;
    if (o?.on)
        return { mode: o.mode || 'none', rate: num(o.rate), override: true };
    return { mode: (kind === 'product' ? data.settings.productTax : data.settings.materialTax) || 'none', rate: taxRate(), override: false };
}
const productTaxInfo = p => itemTax(p, 'product');
const materialTaxInfo = m => itemTax(m, 'material');
function productTaxed(p) {
    return productTaxInfo(p).mode !== 'none';
}
// Split an entered price into the part before tax and the tax, for a given option and rate.
function splitPrice(amount, mode, rate) {
    amount = num(amount);
    if (mode === 'add')
        return { pre: amount, tax: amount * rate / 100 };
    if (mode === 'includes' || mode === 'included') {
        let pre = amount / (1 + rate / 100);
        return { pre, tax: amount - pre };
    }
    return { pre: amount, tax: 0 };
}
function recipeCost(p) {
    return (p.materials || []).reduce((a, x) => {
        let m = material(x.materialId);
        return a + num(x.amount) * matUnitCost(m);
    }, 0);
}
// Cost of one unit of a material for pricing: before tax, unless "Not claiming tax on materials" is ticked.
function matUnitCost(m) {
    if (!m)
        return 0;
    let t = materialTaxInfo(m), sp = splitPrice(num(m.price) / Math.max(.001, num(m.weight)), t.mode, t.rate);
    return data.settings.notClaimingTax ? sp.pre + sp.tax : sp.pre;
}
// Tax paid when buying materials (or an expense) at an entered price.
function purchaseTax(item, amount) {
    let t = materialTaxInfo(item);
    return t.mode === 'none' ? 0 : round2(splitPrice(amount, t.mode, t.rate).tax);
}
function taxExample() {
    let s = data.settings, r = taxRate(), mode = s.materialTax || 'none', sp = splitPrice(12.99, mode, r), use = s.notClaimingTax ? sp.pre + sp.tax : sp.pre;
    let rows = mode === 'none' ? '<div class="row"><span>No tax tracked</span><span></span></div>' : mode === 'add' ? `<div class="row"><span>+ ${num(r)}% tax</span><span>${cash(sp.tax)}</span></div>` : `<div class="row"><span>Tax inside (${num(r)}%)</span><span>${cash(sp.tax)}</span></div><div class="row"><span>Before tax</span><span>${cash(sp.pre)}</span></div>`;
    return `<div class="taxex"><div class="muted" style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em">Example: one skein entered as $12.99</div>${rows}<div class="row tot"><span>Cost used in pricing</span><span>${cash(use)}</span></div></div>`;
}
const signedCash = v => (v < 0 ? '−' : '') + cash(Math.abs(v));
// Sale lines. For tax-included lines, "full" and "revenue" leave out the tax inside the price, so profit is always before tax.
const lineGross = x => round2(num(x.qty) * num(x.price) - num(x.disc));
const lineFull = x => x.taxIncluded ? round2(num(x.qty) * num(x.listPrice ?? x.price) / (1 + num(x.taxRate) / 100)) : num(x.qty) * num(x.listPrice ?? x.price);
const lineRev = x => x.taxIncluded ? round2(lineGross(x) - num(x.tax)) : round2(num(x.qty) * num(x.price) - num(x.disc));
function discountAmount(sub, d) {
    if (!d)
        return 0;
    let v = num(d.value), a = d.type === 'pct' ? sub * Math.min(v, 100) / 100 : d.type === 'amt' ? v : d.type === 'total' ? sub - v : 0;
    return round2(Math.max(0, Math.min(sub, a)));
}
function allocate(lines, disc) {
    let sub = lines.reduce((a, l) => a + l.qty * l.price, 0), left = disc;
    lines.forEach((l, i) => {
        let base = l.qty * l.price, share = i === lines.length - 1 ? left : round2(sub ? disc * base / sub : 0);
        l.disc = round2(Math.max(0, Math.min(share, base)));
        left = round2(left - l.disc);
    });
}
function computeOrder(draft, adj) {
    let lines = Object.entries(draft || {}).filter(([, q]) => q > 0).map(([pid, q]) => {
        let p = product(pid), list = num(p?.price), o = adj.prices[pid], t = productTaxInfo(p);
        return { pid, p, name: p?.name || 'Item', qty: q, list, price: o ? num(o.price) : list, reason: o?.reason || '', taxed: t.mode !== 'none', taxIncluded: t.mode === 'included', taxRate: t.rate };
    });
    let sub = round2(lines.reduce((a, l) => a + l.qty * l.price, 0)), disc = discountAmount(sub, adj.discount);
    allocate(lines, disc);
    lineTaxes(lines);
    return orderTotals(lines, sub, disc);
}
// Work out each line's tax: added on top, or the part already inside the price.
function lineTaxes(lines) {
    for (let l of lines) {
        let gross = l.qty * l.price - l.disc;
        l.tax = !l.taxed ? 0 : l.taxIncluded ? taxInside(gross, l.taxRate) : taxOn(gross, l.taxRate);
    }
}
function orderTotals(lines, sub, disc) {
    let added = round2(lines.reduce((a, l) => a + (l.taxIncluded ? 0 : l.tax), 0)), inside = round2(lines.reduce((a, l) => a + (l.taxIncluded ? l.tax : 0), 0)), rates = [...new Set(lines.filter(l => l.tax).map(l => num(l.taxRate)))];
    return { lines, full: round2(lines.reduce((a, l) => a + l.qty * l.list, 0)), sub, disc, tax: round2(added + inside), taxAdded: added, taxInside: inside, taxRates: rates, total: round2(sub - disc + added), items: lines.reduce((a, l) => a + l.qty, 0) };
}
