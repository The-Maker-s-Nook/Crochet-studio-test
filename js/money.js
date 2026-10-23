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
    return s.rounding === 'up5' ? Math.ceil(raw / 5) * 5 : s.rounding === 'up1' ? Math.ceil(raw) : Math.round(raw);
}
// ===== Tax =====
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
function productTaxed(p) {
    return p?.taxed ?? data.settings.taxOnSales;
}
function recipeCost(p) {
    return (p.materials || []).reduce((a, x) => {
        let m = material(x.materialId);
        return a + num(x.amount) * matUnitCost(m);
    }, 0);
}
// ---- Include tax in material costs ----
function matUnitCost(m) {
    if (!m)
        return 0;
    let u = num(m.price) / Math.max(.001, num(m.weight));
    return data.settings.taxInCosts && (m.taxed ?? data.settings.taxOnPurchases) ? u * (1 + taxRate() / 100) : u;
}
function taxExample() {
    let r = taxRate(), t = round2(12.99 * r / 100);
    return `<div class="taxex"><div class="muted" style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em">Example: one skein</div><div class="row"><span>Shelf price</span><span>$12.99</span></div><div class="row"><span>+ ${num(r)}% tax</span><span>${cash(t)}</span></div><div class="row tot"><span>Cost used in pricing</span><span>${cash(12.99 + t)}</span></div></div>`;
}
const signedCash = v => (v < 0 ? '−' : '') + cash(Math.abs(v));
const lineFull = x => num(x.qty) * num(x.listPrice ?? x.price);
const lineRev = x => round2(num(x.qty) * num(x.price) - num(x.disc));
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
        let p = product(pid), list = num(p?.price), o = adj.prices[pid];
        return { pid, p, name: p?.name || 'Item', qty: q, list, price: o ? num(o.price) : list, reason: o?.reason || '', taxed: !!productTaxed(p) };
    });
    let sub = round2(lines.reduce((a, l) => a + l.qty * l.price, 0)), disc = discountAmount(sub, adj.discount);
    allocate(lines, disc);
    let tax = 0;
    for (let l of lines) {
        l.tax = l.taxed ? taxOn(l.qty * l.price - l.disc) : 0;
        tax += l.tax;
    }
    return { lines, full: round2(lines.reduce((a, l) => a + l.qty * l.list, 0)), sub, disc, tax: round2(tax), total: round2(sub - disc + tax), items: lines.reduce((a, l) => a + l.qty, 0) };
}
