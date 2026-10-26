// Reports screen: Overview, Markets, Stock, Expenses & tax tabs. The downloads (PDF and Excel) are in report-files.js.
// Part of the Crochet Studio app. Files load in the order listed in index.html.

let reportRange = 'all', reportMarket = 'all';
function reportRanges() {
    let y = new Date().getFullYear(), opts = [['all', 'All markets'], ['3m', 'Last 3 months'], ['6m', 'Last 6 months'], ['12m', 'Last 12 months']];
    let yrs = data.markets.filter(m => m.completed).map(marketTime).filter(t => t !== null).map(t => new Date(t).getFullYear());
    let first = yrs.length ? Math.min(...yrs) : y;
    for (let yr = y - 1; yr >= first; yr--)
        opts.push(['y' + yr, String(yr)]);
    return opts;
}
function rangeBounds(r) {
    if (r === 'all')
        return [-Infinity, Infinity];
    if (r[0] === 'y') {
        let yr = Number(r.slice(1));
        return [new Date(yr, 0, 1).getTime(), new Date(yr + 1, 0, 1).getTime()];
    }
    let now = new Date(), months = { '3m': 3, '6m': 6, '12m': 12 }[r] || 0;
    return [new Date(now.getFullYear(), now.getMonth() - months, now.getDate()).getTime(), Infinity];
}
function reportSelection() {
    let opts = reportRanges();
    if (!opts.some(o => o[0] === reportRange))
        reportRange = 'all';
    let [a, b] = rangeBounds(reportRange), inRange = completedBetween(a, b).sort((x, y) => (marketTime(y) || 0) - (marketTime(x) || 0)), qs = quickBetween(a, b);
    if (reportMarket !== 'all' && !(reportMarket === 'quick' && qs.length) && !inRange.some(m => m.id === reportMarket))
        reportMarket = 'all';
    let sel = reportMarket === 'all' ? inRange : reportMarket === 'quick' ? [] : inRange.filter(m => m.id === reportMarket), useQ = reportMarket === 'all' || reportMarket === 'quick', f = marketFigures(sel, useQ ? qs : [], useQ ? looseExpensesBetween(a, b) : []);
    let rangeLabel = (opts.find(o => o[0] === reportRange) || [, ''])[1], marketLabel = reportMarket === 'all' ? 'All markets' : reportMarket === 'quick' ? 'Quick sales, no market' : (inRange.find(m => m.id === reportMarket)?.name || '');
    return { opts, a, b, inRange, qs, sel, useQ, f, rangeLabel: reportRange === 'all' ? 'All time' : rangeLabel, marketLabel };
}
function materialValueData() {
    let rows = {}, total = 0, tracked = 0, all = data.materials.length;
    for (let m of data.materials) {
        if (!stockCounts(m) || !stockKnown(m))
            continue;
        tracked++;
        let v = Math.max(0, num(m.stock)) * matUnitCost(m), c = mcat(m.categoryId)?.name || 'Other';
        rows[c] = (rows[c] || 0) + v;
        total += v;
    }
    return { rows: Object.entries(rows).map(([n, v]) => [n, round2(v)]).sort((a, b) => b[1] - a[1]), total: round2(total), tracked, all };
}
// ---- Reports: four tabs (Overview · Markets · Stock · Expenses & tax). Downloads are in report-files.js ----
const REPORT_TABS = [['overview', 'Overview'], ['markets', 'Markets'], ['stock', 'Stock'], ['expenses', 'Expenses & tax']];
let reportTab = lsGet('csRepTab', 'overview') || 'overview', reportShowAllSold = false;
function setReportTab(t, mid) {
    reportTab = t;
    lsSet('csRepTab', t);
    if (mid !== undefined)
        reportMarket = mid;
    render();
    scrollTo(0, 0);
}
const rangeText = r => r.rangeLabel;
function repRangeSelect(r) {
    return `<select id="repRange" class="fancy" aria-label="Time frame" onchange="reportRange=this.value;reportMarket='all';render()">${r.opts.map(([v, l]) => `<option value="${v}" ${reportRange === v ? 'selected' : ''}>${v === 'all' ? 'All time' : l}</option>`).join('')}</select>`;
}
function repMarketSelect(r) {
    const mdate = m => {
        let t = marketTime(m);
        return t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    };
    return `<select id="repMarket" class="fancy" aria-label="Market" onchange="reportMarket=this.value;render()"><option value="all">All markets in this time frame (${r.inRange.length})</option>${r.inRange.map(m => `<option value="${m.id}" ${reportMarket === m.id ? 'selected' : ''}>${esc(m.name)}${mdate(m) ? ' · ' + mdate(m) : ''}</option>`).join('')}${r.qs.length ? `<option value="quick" ${reportMarket === 'quick' ? 'selected' : ''}>Quick sales, no market (${new Set(r.qs.map(x => x.orderId || x.id)).size})</option>` : ''}</select>`;
}
// Markets with sales that aren't marked completed yet (not counted in Reports)
function pendingMarkets() {
    return data.markets.filter(m => !m.completed && data.sales.some(x => x.marketId === m.id));
}
function pendingNote() {
    let p = pendingMarkets();
    if (!p.length)
        return '';
    return `<div class="strip">${ic('flag', 18)}<span class="grow">${p.length === 1 ? `<b>${esc(p[0].name)}</b> has sales but isn’t marked completed yet, so it’s not included here.` : `${p.length} markets have sales but aren’t marked completed yet, so they’re not included here.`}</span><button class="pillbtn" onclick="${p.length === 1 ? `openMarket('${p[0].id}')` : `view('markets')`}">Open</button></div>`;
}
function noMarketsNote() {
    return data.markets.some(m => m.completed) || data.sales.some(s => !s.marketId) ? '' : `<div class="panel"><h3>No completed markets yet</h3><p class="muted">A market shows up here once you mark it as completed. Open a market and tap <b>Mark market as completed</b> when it’s over.</p></div>`;
}
function profitNote(f) {
    return `Profit = sales after discounts − material costs − booth costs${f.other ? ' − other expenses' : ''}, before tax. Your time and payment fees are not included.`;
}
// The whole time frame: every completed market, quick sales and expenses with no market.
function overviewFigures(r) {
    return marketFigures(r.inRange, r.qs, looseExpensesBetween(r.a, r.b));
}
// What sold: per product, with the price (or price range) and a line for the ones sold with a discount.
function soldProducts(sales) {
    let by = new Map();
    for (let s of sales) {
        let k = s.productId, o = by.get(k);
        if (!o)
            by.set(k, o = { pid: k, qty: 0, sales: 0, prices: new Set(), dq: 0, ds: 0, dfull: 0, dunit: new Set() });
        let q = num(s.qty), rev = lineRev(s), full = lineFull(s);
        o.qty += q;
        o.sales += rev;
        o.prices.add(round2(num(s.listPrice ?? s.price)));
        if (full - rev > 0.004 && q) {
            o.dq += q;
            o.ds += rev;
            o.dfull += full;
            o.dunit.add(round2(rev / q));
        }
    }
    return [...by.values()].map(o => {
        let p = product(o.pid), ps = [...o.prices].sort((a, b) => a - b), du = [...o.dunit];
        return { pid: o.pid, name: p ? p.name + (p.variation ? ' · ' + p.variation : '') : 'Deleted product', qty: o.qty, sales: round2(o.sales), price: ps.length > 1 ? `${cash(ps[0])}–${cash(ps[ps.length - 1])}` : cash(ps[0] || 0), disc: o.dq ? { qty: o.dq, sales: round2(o.ds), price: du.length === 1 ? cash(du[0]) : `avg ${cash(o.ds / o.dq)} (−${Math.round((1 - o.ds / o.dfull) * 100)}%)` } : null };
    }).sort((a, b) => b.qty - a.qty || b.sales - a.sales);
}
function flowBar(f) {
    let disc = Math.max(0, round2(f.full - f.revenue)), parts = [['f-disc', disc, 'Discounts'], ['f-mat', f.materials, 'Materials'], ['f-booth', f.booth, 'Booth'], ['f-other', f.other, 'Other expenses'], ['f-prof', Math.max(0, f.profit), 'Profit']].filter(x => x[1] > 0.004), t = parts.reduce((a, x) => a + x[1], 0) || 1;
    return `<div class="flow big" role="img" aria-label="${esc(parts.map(x => `${x[2]} ${cash(x[1])}`).join(', '))}">${parts.map(([c, v]) => `<div class="${c}" style="width:${(v / t * 100).toFixed(1)}%"></div>`).join('')}</div><div class="legend">${parts.map(([c, v, l]) => `<span><i class="${c}"></i>${l} <b>${cash(v)}</b></span>`).join('')}${f.profit < 0 ? `<span>Loss <b class="neg">${signedCash(f.profit)}</b></span>` : ''}</div>`;
}
function soldPanel(f) {
    let list = soldProducts(f.sales);
    if (!list.length)
        return '';
    let max = list[0].qty || 1, show = reportShowAllSold ? list : list.slice(0, 5);
    return `<div class="section-label">What sold</div><div class="panel">${show.map((x, i) => `<div class="rank"><span class="rk">${i + 1}</span><div class="grow"><div class="row"><span>${esc(x.name)}</span><b>${x.qty} sold</b></div><div class="bar"><div style="width:${Math.max(3, Math.round(x.qty / max * 100))}%;background:var(--lav-deep)"></div></div><div class="muted rsub">${x.price} each · ${cash(x.sales)} in sales</div>${x.disc ? `<div class="muted rsub indent">with discounts: ${x.disc.qty} at ${x.disc.price} · ${cash(x.disc.sales)}</div>` : ''}</div></div>`).join('')}${list.length > 5 ? `<button class="seeall" onclick="reportShowAllSold=${!reportShowAllSold};render()">${reportShowAllSold ? 'Show less' : `See all ${list.length} products sold`}</button>` : ''}</div>`;
}
function paymentsPanel(f) {
    let orders = new Map();
    for (let x of f.sales) {
        let k = x.orderId || x.id;
        if (!orders.has(k)) {
            let o = x.orderId ? data.orders.find(z => z.id === x.orderId) : null;
            orders.set(k, { m: o?.payment?.method || '', t: 0 });
        }
        orders.get(k).t += lineRev(x) + num(x.tax);
    }
    let pays = {};
    for (let o of orders.values())
        pays[o.m] = (pays[o.m] || 0) + o.t;
    let keys = [...PAY_METHODS.map(x => x[0]).filter(k => pays[k]), ...(pays[''] ? [''] : [])], tot = keys.reduce((a, k) => a + pays[k], 0) || 1, col = { card: 'var(--lav-deep)', cash: 'var(--aqua-ring)', etransfer: 'var(--pink)', other: 'var(--gold-ink)', '': 'var(--lav-line)' };
    if (!keys.some(k => k))
        return '';
    return `<div class="section-label">How customers paid</div><div class="panel"><div class="flow big" role="img" aria-label="${esc(keys.map(k => payLabel(k) + ' ' + cash(pays[k])).join(', '))}">${keys.map(k => `<div style="width:${(pays[k] / tot * 100).toFixed(1)}%;background:${col[k]}"></div>`).join('')}</div><div class="grid paystats">${keys.map(k => `<div class="paystat"><span class="dot" style="background:${col[k]}"></span><div class="muted">${payLabel(k)}</div><b>${cash(pays[k])}</b><span class="hint" style="margin:0">${Math.round(pays[k] / tot * 100)}%</span></div>`).join('')}</div><p class="hint">Includes tax collected.</p></div>`;
}
function discountsPanel(f) {
    if (!(f.discounts > 0.004))
        return '';
    let byReason = {}, orders = new Set(), dOrders = new Set();
    for (let x of f.sales) {
        let k = x.orderId || x.id, o = x.orderId ? data.orders.find(z => z.id === x.orderId) : null;
        orders.add(k);
        const add = (r, amt) => {
            (byReason[r] ||= { amt: 0, set: new Set() }).amt += amt;
            byReason[r].set.add(k);
            dOrders.add(k);
        };
        if (num(x.disc) > 0)
            add(o?.discount?.reason || 'Discount', num(x.disc));
        let pd = num(x.qty) * (num(x.listPrice ?? x.price) - num(x.price));
        if (pd > 0.004)
            add(x.priceReason || 'Price change', pd);
    }
    let rows = Object.entries(byReason).map(([r, v]) => [r, round2(v.amt), v.set.size]).sort((a, b) => b[1] - a[1]), max = rows[0]?.[1] || 1;
    return `<div class="section-label">Discounts</div><div class="panel"><div class="grid keep2"><div><div class="muted">At full price</div><div class="stat">${cash(f.full)}</div></div><div><div class="muted">Discounts given</div><div class="stat neg">−${cash(f.discounts)}</div><div class="hint">${f.full ? Math.round(f.discounts / f.full * 1000) / 10 : 0}% · ${dOrders.size} of ${orders.size} sale${orders.size === 1 ? '' : 's'}</div></div></div>${rows.length ? `<div class="section-label" style="margin:16px 0 8px">By reason</div>${rows.map(([r, a, c]) => `<div class="reasonrow"><div class="row"><span>${esc(r)}</span><b>${cash(a)} · ${c} sale${c === 1 ? '' : 's'}</b></div><div class="bar"><div style="width:${Math.max(3, Math.round(a / max * 100))}%;background:var(--disc)"></div></div></div>`).join('')}` : ''}</div>`;
}
function marketRowsPanel(r) {
    let rows = r.inRange.map(m => ({ m, f: marketFigures([m]) }));
    if (r.qs.length)
        rows.push({ quick: true, f: marketFigures([], r.qs) });
    if (!rows.length)
        return '';
    let max = Math.max(1, ...rows.map(x => x.f.profit));
    return `<div class="section-label">Market by market</div><div class="panel" style="padding-top:8px">${rows.map(({ m, f, quick }) => `<button class="rowbtn ${quick ? 'quickrow' : ''}" onclick="reportMarket='${quick ? 'quick' : m.id}';render()"><div class="row"><b>${quick ? `${ic('tag', 15)} Quick sales, no market` : esc(m.name)}</b><b class="${f.profit < 0 ? 'neg' : 'pos'}">${signedCash(f.profit)}</b></div><div class="muted">${quick ? `${new Set(r.qs.map(x => x.orderId || x.id)).size} sales · Sales ${cash(f.revenue)} · No booth` : `${marketTime(m) ? new Date(marketTime(m)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' : ''}Sales ${cash(f.revenue)} · Booth ${cash(f.booth)}${f.other ? ` · Expenses ${cash(f.other)}` : ''}`}</div><div class="bar" style="height:6px;margin-top:8px"><div style="width:${Math.max(4, Math.round(Math.max(0, f.profit) / max * 100))}%"></div></div></button>`).join('')}</div>`;
}
function reports() {
    let r = reportSelection();
    if (!REPORT_TABS.some(t => t[0] === reportTab))
        reportTab = 'overview';
    let top = `<div class="row"><h2>Reports</h2><button class="small" onclick="go('reportDownload')">${ic('download', 16)} Download</button></div><div class="sectabs" role="tablist">${REPORT_TABS.map(([k, l]) => `<button role="tab" aria-selected="${reportTab === k}" class="${reportTab === k ? 'on' : ''}" onclick="setReportTab('${k}')">${l}</button>`).join('')}</div>`;
    return top + ({ overview: reportOverview, markets: reportMarkets, stock: reportStock, expenses: reportExpenses }[reportTab])(r);
}
function reportOverview(r) {
    let f = overviewFigures(r), nq = new Set(r.qs.map(x => x.orderId || x.id)).size, chrono = [...r.inRange].sort((a, b) => (marketTime(a) || 0) - (marketTime(b) || 0)).map(m => ({ m, p: marketFigures([m]).profit })), pmax = Math.max(1, ...chrono.map(x => Math.abs(x.p))), best = [...chrono].sort((a, b) => b.p - a.p)[0], top = soldProducts(f.sales)[0], md = materialValueData(), ex = reportExpenseData(r), tx = taxFigures(taxYear);
    return `<div class="filters one"><div><label for="repRange">Time frame</label>${repRangeSelect(r)}</div></div>${pendingNote()}${noMarketsNote()}<div class="panel herocard"><div class="eyebrow">Profit · ${esc(rangeText(r))}</div><div class="big ${f.profit < 0 ? 'neg' : ''}">${signedCash(f.profit)}</div><div class="muted" style="font-weight:700">from ${cash(f.revenue)} in sales across ${r.inRange.length} market${r.inRange.length === 1 ? '' : 's'}${nq ? ` and ${nq} quick sale${nq === 1 ? '' : 's'}` : ''}</div></div><div class="grid keep2 tiles"><div class="panel tile"><span class="tic aqua">${ic('tag', 18)}</span><div class="muted">Sales revenue</div><div class="stat">${cash(f.revenue)}</div></div><div class="panel tile"><span class="tic pink">${ic('heart', 18)}</span><div class="muted">Items sold</div><div class="stat">${f.qty}</div></div><div class="panel tile"><span class="tic lav">${ic('materials', 18)}</span><div class="muted">Material costs</div><div class="stat">${cash(f.materials)}</div></div><div class="panel tile"><span class="tic gold">${ic('markets', 18)}</span><div class="muted">Booth costs</div><div class="stat">${cash(f.booth)}</div></div>${f.other ? `<div class="panel tile wide"><span class="tic lav">${ic('receipt', 18)}</span><div class="muted">Other expenses</div><div class="stat">${cash(f.other)}</div></div>` : ''}</div>${chrono.length ? `<div class="panel"><h3>Profit by market</h3><div class="cols" role="img" aria-label="Profit for each market in date order">${chrono.map(({ m, p }) => `<button class="col" onclick="setReportTab('markets','${m.id}')" title="${esc(m.name)}"><span class="cv ${p < 0 ? 'neg' : ''}">${signedCash(p).replace(/\.\d\d$/, '')}</span><span class="cb"><span class="${p < 0 ? 'negbar' : ''}" style="height:${Math.max(4, Math.round(Math.abs(p) / pmax * 100))}%"></span></span><span class="cl">${marketTime(m) ? new Date(marketTime(m)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</span></button>`).join('')}</div><p class="hint">Tap a bar to open that market.${r.qs.length ? ' Quick sales aren’t shown here because they don’t belong to a market, but they’re in the totals.' : ''}</p></div>` : ''}<div class="grid keep2">${best ? `<button class="panel tile linkcard" onclick="setReportTab('markets','${best.m.id}')"><div class="muted">Best market</div><b>${esc(best.m.name)}</b><span class="${best.p < 0 ? 'neg' : 'pos'}" style="font-weight:800">${signedCash(best.p)}</span></button>` : ''}${top ? `<button class="panel tile linkcard" onclick="setReportTab('markets','all')"><div class="muted">Top seller</div><b>${esc(top.name)}</b><span class="muted" style="font-weight:800">${top.qty} sold</span></button>` : ''}${md.tracked ? `<button class="panel tile linkcard" onclick="setReportTab('stock')"><div class="muted">Materials on hand</div><b>${cash(md.total)}</b><span class="muted">See stock ›</span></button>` : ''}<button class="panel tile linkcard" onclick="setReportTab('expenses')"><div class="muted">Expenses</div><b>${cash(ex.total)}</b><span class="muted">See expenses ›</span></button><button class="panel tile linkcard wide" onclick="setReportTab('expenses')"><div class="muted">Tax difference ${taxYear}</div><b>${signedCash(tx.diff)}</b><span class="muted">See tax ›</span></button></div><p class="hint" style="margin:12px 4px 0">${profitNote(f)}</p>`;
}
function reportMarkets(r) {
    let f = r.f, per = f.qty ? f.revenue / f.qty : 0, label = reportMarket === 'all' ? `${r.inRange.length} market${r.inRange.length === 1 ? '' : 's'}${r.qs.length ? ' + quick sales' : ''}` : r.marketLabel;
    return `<div class="filters"><div><label for="repRange">Time frame</label>${repRangeSelect(r)}</div><div><label for="repMarket">Market</label>${repMarketSelect(r)}</div></div>${pendingNote()}${noMarketsNote()}<div class="panel herocard"><div class="eyebrow">Profit · ${esc(label)} · ${esc(rangeText(r))}</div><div class="big ${f.profit < 0 ? 'neg' : ''}">${signedCash(f.profit)}</div><div class="muted" style="font-weight:700">from ${cash(f.revenue)} in sales${f.discounts > 0.004 ? ` (${cash(f.full)} at full price)` : ''} · ${f.qty} item${f.qty === 1 ? '' : 's'} sold${f.qty ? ` · ${cash(per)} per item` : ''}</div>${f.revenue || f.booth ? flowBar(f) : ''}<details class="info"><summary>How profit is worked out</summary><p class="hint">${profitNote(f)}</p></details></div>${soldPanel(f)}${paymentsPanel(f)}${discountsPanel(f)}${reportMarket === 'all' ? marketRowsPanel(r) : `<button class="alt btn-wide" onclick="reportMarket='all';render()">Show all markets</button>`}`;
}
function reportStock() {
    let md = materialValueData(), stock = data.products.reduce((a, p) => a + num(p.stock), 0), value = data.products.reduce((a, p) => a + num(p.stock) * num(p.price), 0), max = md.rows[0]?.[1] || 1;
    return `${md.tracked ? `<div class="panel herocard"><div class="eyebrow">Materials on hand</div><div class="big ink">${cash(md.total)}</div><div class="muted" style="font-weight:700">Value of yarn and supplies you still have, based on ${md.tracked} material${md.tracked === 1 ? '' : 's'} you’re counting.${md.tracked < md.all ? ' Materials set to Pricing only, or not counted yet, aren’t included.' : ''}</div></div><div class="panel">${md.rows.map(([n, v]) => `<div class="reasonrow"><div class="row"><span>${esc(n)}</span><b>${cash(v)}</b></div><div class="bar"><div style="width:${Math.max(3, Math.round(v / max * 100))}%;background:var(--lav-deep)"></div></div></div>`).join('')}<p class="hint">Today’s amounts. Not affected by the time frame.</p></div>` : `<div class="panel"><h3>Materials on hand</h3><p class="muted">Your materials are set to Pricing only, so there’s no material stock to count. To count it, change Material stock in Settings › Finances › Pricing defaults.</p></div>`}<div class="grid keep2 tiles"><div class="panel tile"><span class="tic pink">${ic('heart', 18)}</span><div class="muted">Finished items</div><div class="stat">${stock}</div></div><div class="panel tile"><span class="tic aqua">${ic('tag', 18)}</span><div class="muted">Stock value</div><div class="stat">${cash(value).replace('.00', '')}</div></div></div><p class="hint" style="margin:12px 4px 0">Finished items and stock value are the same numbers as on Home, at your selling prices.</p>`;
}
// Receipts and expenses dated in the time frame
function reportExpenseData(r) {
    let list = (data.expenses || []).filter(e => {
        let t = Date.parse(e.date + 'T12:00:00');
        return t >= r.a && t < r.b;
    }), by = {};
    for (let e of list) {
        let k = e.category || 'Other';
        by[k] = (by[k] || 0) + num(e.amount);
    }
    return { list, byCat: Object.entries(by).map(([k, v]) => [k, round2(v)]).sort((a, b) => b[1] - a[1]), total: round2(list.reduce((a, e) => a + num(e.amount), 0)), tax: round2(list.reduce((a, e) => a + num(e.tax), 0)), missing: list.filter(e => !e.photo && !e.photoOff).length };
}
function taxFigures(y) {
    const inY = d => new Date(d).getFullYear() === y;
    let coll = data.sales.filter(x => inY(x.date)).reduce((a, x) => a + num(x.tax), 0), paidM = data.purchases.filter(x => inY(x.date)).reduce((a, x) => a + num(x.tax), 0), paidE = (data.expenses || []).filter(x => inY(x.date + 'T12:00:00')).reduce((a, x) => a + expenseTaxPaid(x), 0);
    return { coll: round2(coll), paidM: round2(paidM), paidE: round2(paidE), diff: round2(coll - paidM - paidE) };
}
let taxYear = new Date().getFullYear();
function taxYears() {
    let ys = new Set([new Date().getFullYear()]);
    for (let x of data.purchases)
        ys.add(new Date(x.date).getFullYear());
    for (let x of data.expenses || [])
        ys.add(Number(String(x.date).slice(0, 4)));
    for (let x of data.sales)
        if (num(x.tax))
            ys.add(new Date(x.date).getFullYear());
    return [...ys].filter(Boolean).sort((a, b) => b - a);
}
function taxPanel() {
    let ys = taxYears();
    if (!ys.includes(taxYear))
        taxYear = ys[0];
    let t = taxFigures(taxYear);
    return `<div class="section-label">Sales tax</div><div class="panel"><div class="row"><h3 style="margin:0">Tax for the year</h3><select id="taxYear" class="fancy" style="width:auto;min-width:110px" aria-label="Tax year" onchange="taxYear=Number(this.value);render()">${ys.map(y => `<option value="${y}" ${y === taxYear ? 'selected' : ''}>${y}</option>`).join('')}</select></div><div class="kv" style="margin-top:8px"><span>Tax collected</span><b>${cash(t.coll)}</b></div><div class="kv"><span>Tax paid on materials</span><b>− ${cash(t.paidM)}</b></div><div class="kv"><span>Tax paid on expenses</span><b>− ${cash(t.paidE)}</b></div><div class="kv total"><span>Difference (collected − paid)</span><b class="${t.diff < 0 ? 'neg' : ''}">${signedCash(t.diff)}</b></div><p class="hint">Jan 1 – Dec 31, ${taxYear}. Counts every sale, material purchase and receipt dated in that year, whether or not the market is completed. Yarn and supply receipts aren’t added again here, since that tax is already in tax paid on materials. If you're registered to collect sales tax, the difference is roughly what you'd pay to your tax agency. A guide only; check with an accountant.</p></div>`;
}
function reportExpenses(r) {
    let ex = reportExpenseData(r), max = Math.max(1, ...ex.byCat.map(x => x[1])), f = overviewFigures(r), fromMarkets = round2(f.revenue - f.materials - f.booth), y = yearEndYear();
    return `<div class="filters one"><div><label for="repRange">Time frame</label>${repRangeSelect(r)}</div></div><div class="panel herocard"><div class="eyebrow">Expenses · ${esc(rangeText(r))}</div><div class="big ink">${cash(ex.total)}</div><div class="muted" style="font-weight:700">${ex.list.length} receipt${ex.list.length === 1 ? '' : 's'} · ${cash(ex.tax)} tax paid</div><div class="actions"><button class="small" onclick="snapReceipt()">${ic('camera', 16)} Snap receipt</button><button class="small alt" onclick="openReceipts('all')">View receipts</button></div></div>${ex.byCat.length ? `<div class="section-label">By category</div><div class="panel">${ex.byCat.map(([k, v]) => `<div class="reasonrow"><div class="row"><span>${catPill(k)}</span><b>${cash(v)}</b></div><div class="bar"><div style="width:${Math.max(3, Math.round(v / max * 100))}%;background:var(--lav-deep)"></div></div></div>`).join('')}<p class="hint">Yarn and supply costs already count in Material costs on each sale, and booth fees are already on each market, so neither is taken off again below.</p></div>` : '<div class="panel muted">No receipts in this time frame.</div>'}<div class="section-label">Profit after expenses</div><div class="panel"><div class="kv"><span>Profit from markets and quick sales</span><b>${signedCash(fromMarkets)}</b></div><div class="kv"><span>Other expenses <small>(all but yarn, supplies and booth fees)</small></span><b>− ${cash(f.other)}</b></div><div class="kv total"><span>Profit after expenses</span><b class="${f.profit < 0 ? 'neg' : 'pos'}">${signedCash(f.profit)}</b></div><p class="hint">Amounts before tax, so they line up with how market profit is worked out. Expenses for a market count once that market is completed.</p></div>${ex.missing ? `<button class="rowbtn needphoto" onclick="openReceipts('nophoto')">${ex.missing} receipt${ex.missing > 1 ? 's' : ''} still need${ex.missing > 1 ? '' : 's'} a photo</button>` : ''}${taxPanel()}<button class="rowbtn" onclick="openYearEnd(${y || new Date().getFullYear() - 1})"><div class="row"><b>${ic('download', 16)} Year-end receipts</b><span class="chev" aria-hidden="true">›</span></div><div class="muted">Save a year’s receipt photos as one folder, then clear them from the app.</div></button>`;
}
