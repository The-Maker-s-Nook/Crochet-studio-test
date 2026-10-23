// Reports: totals, best sellers, tax panel, discounts, materials on hand, PDF/CSV download
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
function reports() {
    let opts = reportRanges();
    if (!opts.some(o => o[0] === reportRange))
        reportRange = 'all';
    let [a, b] = rangeBounds(reportRange), inRange = completedBetween(a, b).sort((x, y) => (marketTime(y) || 0) - (marketTime(x) || 0));
    let qs = quickBetween(a, b);
    if (reportMarket !== 'all' && !(reportMarket === 'quick' && qs.length) && !inRange.some(m => m.id === reportMarket))
        reportMarket = 'all';
    let sel = reportMarket === 'all' ? inRange : inRange.filter(m => m.id === reportMarket), f = marketFigures(sel, reportMarket === 'all' || reportMarket === 'quick' ? qs : []), anyDone = data.markets.some(m => m.completed), pending = data.markets.filter(m => !m.completed && data.sales.some(x => x.marketId === m.id)).length;
    const mdate = m => {
        let t = marketTime(m);
        return t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    };
    let best = Object.entries(f.sales.reduce((acc, x) => {
        acc[x.productId] = (acc[x.productId] || 0) + num(x.qty);
        return acc;
    }, {})).sort((x, y) => y[1] - x[1]).slice(0, 5);
    let breakdown = reportMarket === 'all' && sel.length ? `<div class="panel"><h3>By market</h3>${sel.map(m => {
        let r = marketFigures([m]);
        return `<button class="rowbtn" onclick="reportMarket='${m.id}';render()"><div class="row"><b>${esc(m.name)}</b><b class="${r.profit < 0 ? 'neg' : 'pos'}">${signedCash(r.profit)}</b></div><div class="muted">${mdate(m)} · Sales ${cash(r.revenue)} · Booth ${cash(r.booth)}</div></button>`;
    }).join('')}</div>` : '';
    return `<div class="row"><h2>Reports</h2><button class="small" onclick="go('reportDownload')">${ic('download', 16)} Download</button></div><div class="panel"><label for="repRange" style="margin-top:0">Time frame</label><select id="repRange" onchange="reportRange=this.value;reportMarket='all';render()">${opts.map(([v, l]) => `<option value="${v}" ${reportRange === v ? 'selected' : ''}>${l}</option>`).join('')}</select><label for="repMarket">Market</label><select id="repMarket" onchange="reportMarket=this.value;render()"><option value="all">All markets in this time frame (${inRange.length})</option>${inRange.map(m => `<option value="${m.id}" ${reportMarket === m.id ? 'selected' : ''}>${esc(m.name)}${mdate(m) ? ' · ' + mdate(m) : ''}</option>`).join('')}${qs.length ? `<option value="quick" ${reportMarket === 'quick' ? 'selected' : ''}>Quick sales, no market (${new Set(qs.map(x => x.orderId || x.id)).size})</option>` : ''}</select></div>${anyDone || qs.length ? '' : `<div class="panel"><h3>No completed markets yet</h3><p class="muted">A market shows up here once you mark it as completed. Open a market and tap <b>Mark market as completed</b> when it’s over.</p></div>`}<div class="grid keep2"><div class="panel"><div class="muted">Sales revenue</div><div class="stat">${cash(f.revenue)}</div></div><div class="panel"><div class="muted">Items sold</div><div class="stat">${f.qty}</div></div><div class="panel"><div class="muted">Material costs</div><div class="stat">${cash(f.materials)}</div></div><div class="panel"><div class="muted">Booth costs</div><div class="stat">${cash(f.booth)}</div></div><div class="panel wide"><div class="muted">Profit${sel.length ? ` · ${sel.length} market${sel.length > 1 ? 's' : ''}` : ''}</div><div class="stat ${f.profit < 0 ? 'bad' : 'good'}">${signedCash(f.profit)}</div></div></div>${discountReport(f)}${best.length ? `<div class="panel"><h3>Best sellers</h3>${best.map(([pid, q]) => `<div class="row entry" style="margin:6px 0"><span>${esc(product(pid)?.name || 'Deleted product')}</span><b>${q} sold</b></div>`).join('')}</div>` : ''}${breakdown}${pending ? `<div class="panel muted">${pending} market${pending > 1 ? 's have sales but aren’t' : ' has sales but isn’t'} marked completed yet, so ${pending > 1 ? 'they’re' : 'it’s'} not included here.</div>` : ''}${materialValuePanel()}${taxPanel()}<div class="panel muted">Profit = sales after discounts − material costs − booth costs, before tax. Your time and payment fees are not included.</div>`;
}
let taxYear = new Date().getFullYear();
function taxYears() {
    let ys = new Set([new Date().getFullYear()]);
    for (let x of data.purchases)
        ys.add(new Date(x.date).getFullYear());
    for (let x of data.sales)
        if (num(x.tax))
            ys.add(new Date(x.date).getFullYear());
    return [...ys].sort((a, b) => b - a);
}
function taxPanel() {
    let ys = taxYears();
    if (!ys.includes(taxYear))
        taxYear = ys[0];
    const inY = d => new Date(d).getFullYear() === taxYear;
    let spent = data.purchases.filter(x => inY(x.date)).reduce((a, x) => a + num(x.tax), 0), coll = data.sales.filter(x => inY(x.date)).reduce((a, x) => a + num(x.tax), 0), diff = coll - spent;
    return `<div class="panel"><div class="row"><h3 style="margin:0">Sales tax</h3><select id="taxYear" style="width:auto;min-width:110px" aria-label="Tax year" onchange="taxYear=Number(this.value);render()">${ys.map(y => `<option value="${y}" ${y === taxYear ? 'selected' : ''}>${y}</option>`).join('')}</select></div><div class="grid keep2" style="margin-top:12px"><div><div class="muted">Tax collected</div><div class="stat">${cash(coll)}</div></div><div><div class="muted">Tax paid on materials</div><div class="stat">${cash(spent)}</div></div><div class="wide"><div class="muted">Difference (collected − paid)</div><div class="stat ${diff < 0 ? 'bad' : ''}">${signedCash(diff)}</div></div></div><p class="hint">Jan 1 – Dec 31, ${taxYear}. Counts every sale and material purchase dated in that year, whether or not the market is completed. If you're registered for HST, the difference is roughly what you'd remit. A guide only; check with an accountant or the CRA.</p></div>`;
}
// ---- Reports ----
function discountReport(f) {
    let byReason = {}, orders = new Map();
    for (let x of f.sales) {
        let k = x.orderId || x.id;
        if (!orders.has(k))
            orders.set(k, { disc: 0, method: '', total: 0 });
        let og = orders.get(k);
        og.total += lineRev(x) + num(x.tax);
        let o = x.orderId ? data.orders.find(z => z.id === x.orderId) : null;
        og.method = o?.payment?.method || '';
        if (num(x.disc) > 0) {
            let r = o?.discount?.reason || 'Discount';
            (byReason[r] = byReason[r] || { amt: 0, set: new Set() });
            byReason[r].amt += num(x.disc);
            byReason[r].set.add(k);
            og.disc += num(x.disc);
        }
        let pd = num(x.qty) * (num(x.listPrice ?? x.price) - num(x.price));
        if (pd > 0.004) {
            let r = x.priceReason || 'Price change';
            (byReason[r] = byReason[r] || { amt: 0, set: new Set() });
            byReason[r].amt += pd;
            byReason[r].set.add(k);
            og.disc += pd;
        }
    }
    let rows = Object.entries(byReason).map(([r, v]) => [r, round2(v.amt), v.set.size]).sort((a, b) => b[1] - a[1]), n = orders.size, dn = [...orders.values()].filter(o => o.disc > 0.004).length, max = rows[0]?.[1] || 1;
    let pays = {};
    for (let o of orders.values()) {
        let k = o.method || '';
        pays[k] = (pays[k] || 0) + o.total;
    }
    let disc = f.discounts > 0.004 ? `<div class="panel"><h3>Discounts</h3><div class="grid keep2"><div><div class="muted">At full price</div><div class="stat">${cash(f.full)}</div></div><div><div class="muted">Discounts given</div><div class="stat neg">−${cash(f.discounts)}</div><div class="hint">${f.full ? Math.round(f.discounts / f.full * 1000) / 10 : 0}% · ${dn} of ${n} sale${n === 1 ? '' : 's'}</div></div></div>${rows.length ? `<div class="section-label" style="margin:16px 0 8px">By reason</div>${rows.map(([r, a, c]) => `<div class="reasonrow"><div class="row"><span>${esc(r)}</span><b>${cash(a)} · ${c} sale${c === 1 ? '' : 's'}</b></div><div class="bar"><div style="width:${Math.max(3, Math.round(a / max * 100))}%;background:var(--pink)"></div></div></div>`).join('')}` : '<p class="hint">No discounts in this time frame.</p>'}</div>` : '';
    let known = Object.keys(pays).filter(k => k);
    let pay = known.length ? `<div class="panel"><h3>How customers paid</h3><div class="grid paystats">${[...PAY_METHODS.map(x => x[0]).filter(k => pays[k]), ...(pays[''] ? [''] : [])].map(k => `<div class="paystat"><div class="muted">${payLabel(k)}</div><b>${cash(pays[k])}</b></div>`).join('')}</div><p class="hint">Includes tax collected.</p></div>` : '';
    return disc + pay;
}
const PDFW = { F1: [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 761, 556, 556, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 556, 611, 556, 556, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 556, 500, 667, 278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, 556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500], F2: [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 761, 556, 611, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 611, 611, 611, 611, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 611, 500, 667, 278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556] };
// ---- Reports: fold sections, material value, downloads ----
function foldReports() {
    let saved = lsGet('csRepFold', {}) || {};
    document.querySelectorAll('#app .panel').forEach(p => {
        if (p.dataset.fold)
            return;
        let h = p.querySelector(':scope > h3') || p.querySelector(':scope > .row > h3');
        if (!h)
            return;
        let head = h.parentElement === p ? h : h.parentElement, key = h.textContent.trim();
        p.dataset.fold = key;
        head.classList.add('foldhead');
        h.setAttribute('role', 'button');
        h.tabIndex = 0;
        h.insertAdjacentHTML('beforeend', '<span class="foldchev" aria-hidden="true">⌄</span>');
        let folded = key in saved ? saved[key] : key === 'Materials on hand';
        const set = f => {
            p.classList.toggle('folded', f);
            h.setAttribute('aria-expanded', String(!f));
        };
        set(folded);
        const toggle = () => {
            folded = !folded;
            set(folded);
            let s = lsGet('csRepFold', {}) || {};
            s[key] = folded;
            lsSet('csRepFold', s);
        };
        h.addEventListener('click', toggle);
        h.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });
    });
}
function materialValueData() {
    let rows = {}, total = 0, tracked = 0;
    for (let m of data.materials) {
        if (!m.trackStock)
            continue;
        tracked++;
        let v = Math.max(0, num(m.stock)) * matUnitCost(m), c = mcat(m.categoryId)?.name || 'Other';
        rows[c] = (rows[c] || 0) + v;
        total += v;
    }
    return { rows: Object.entries(rows).map(([n, v]) => [n, round2(v)]).sort((a, b) => b[1] - a[1]), total: round2(total), tracked };
}
function materialValuePanel() {
    let d = materialValueData();
    return `<div class="panel"><div class="row"><h3 style="margin:0">Materials on hand</h3><b>${cash(d.total)}</b></div><div style="margin-top:10px">${d.rows.map(([n, v]) => `<div class="row entry" style="margin:6px 0"><span>${esc(n)}</span><b>${cash(v)}</b></div>`).join('')}<p class="hint">${d.tracked ? `What's left of ${d.tracked} material${d.tracked === 1 ? '' : 's'} with “Track remaining stock” on. Not affected by the time frame above.` : 'Turn on “Track remaining stock” for a material (Materials › Edit) to count it here.'}</p></div></div>`;
}
function reportSelection() {
    let opts = reportRanges();
    if (!opts.some(o => o[0] === reportRange))
        reportRange = 'all';
    let [a, b] = rangeBounds(reportRange), inRange = completedBetween(a, b).sort((x, y) => (marketTime(y) || 0) - (marketTime(x) || 0)), qs = quickBetween(a, b);
    if (reportMarket !== 'all' && !(reportMarket === 'quick' && qs.length) && !inRange.some(m => m.id === reportMarket))
        reportMarket = 'all';
    let sel = reportMarket === 'all' ? inRange : reportMarket === 'quick' ? [] : inRange.filter(m => m.id === reportMarket), useQ = reportMarket === 'all' || reportMarket === 'quick', f = marketFigures(sel, useQ ? qs : []);
    let rangeLabel = (opts.find(o => o[0] === reportRange) || [, ''])[1], marketLabel = reportMarket === 'all' ? 'All markets' : reportMarket === 'quick' ? 'Quick sales, no market' : (inRange.find(m => m.id === reportMarket)?.name || '');
    return { opts, a, b, inRange, qs, sel, useQ, f, rangeLabel: reportRange === 'all' ? 'All time' : rangeLabel, marketLabel };
}
let dlFmt = 'pdf';
function reportDownload() {
    let r = reportSelection();
    return `${backBtn()}<h2 style="margin-top:12px">Download a report</h2><div class="panel"><label for="dlRange" style="margin-top:0">Time frame</label><select id="dlRange" onchange="reportRange=this.value;reportMarket='all';render()">${r.opts.map(([v, l]) => `<option value="${v}" ${reportRange === v ? 'selected' : ''}>${v === 'all' ? 'All time' : l}</option>`).join('')}</select><label for="dlMarket">Market</label><select id="dlMarket" onchange="reportMarket=this.value;render()"><option value="all">All markets in this time frame (${r.inRange.length})</option>${r.inRange.map(m => `<option value="${m.id}" ${reportMarket === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}${r.qs.length ? `<option value="quick" ${reportMarket === 'quick' ? 'selected' : ''}>Quick sales, no market</option>` : ''}</select><p class="hint">The same sales as Reports: completed markets and quick sales.</p></div><div class="panel"><h3>File type</h3><div class="fmtgrid"><button class="fmt ${dlFmt === 'pdf' ? 'on' : ''}" aria-pressed="${dlFmt === 'pdf'}" onclick="dlFmt='pdf';render()"><b>PDF</b><span>A tidy summary for printing or your records</span></button><button class="fmt ${dlFmt === 'csv' ? 'on' : ''}" aria-pressed="${dlFmt === 'csv'}" onclick="dlFmt='csv';render()"><b>CSV spreadsheet</b><span>Every item sold as a row. Opens in Excel or Google Sheets</span></button></div></div><div class="actions"><button onclick="downloadReport()">${ic('download', 18)} Download ${dlFmt.toUpperCase()}</button></div><p class="hint" style="margin:0 6px">Saves the file, or opens the share menu so you can save, email or print it.</p>`;
}
function reportFileName(r, ext) {
    let slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `crochet-studio-report_${slug(r.rangeLabel)}${r.marketLabel !== 'All markets' ? '_' + slug(r.marketLabel) : ''}.${ext}`;
}
async function saveReportFile(blob, name) {
    let file = null;
    try {
        file = new File([blob], name, { type: blob.type });
    }
    catch {
    }
    let touch = matchMedia('(pointer:coarse)').matches;
    if (touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: name });
            return;
        }
        catch (e) {
            if (e?.name === 'AbortError')
                return;
        }
    }
    let url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast('Report downloaded.');
}
function reportLines(r) {
    return r.f.sales.slice().sort((x, y) => String(y.date).localeCompare(String(x.date))).map(s => {
        let o = s.orderId ? (data.orders || []).find(z => z.id === s.orderId) : null, p = product(s.productId), pc = num(s.qty) * (num(s.listPrice ?? s.price) - num(s.price)), disc = round2(num(s.disc) + (pc > 0.004 ? pc : 0));
        let reasons = [];
        if (num(s.disc) > 0)
            reasons.push(o?.discount?.reason || 'Discount');
        if (pc > 0.004)
            reasons.push(s.priceReason || 'Price change');
        return { date: String(s.date || '').slice(0, 10), market: data.markets.find(m => m.id === s.marketId)?.name || (s.fromMarket ? s.fromMarket + ' (deleted)' : 'Quick sale'), order: String(s.orderId || s.id || '').slice(-6).toUpperCase(), product: p?.name || 'Deleted product', variation: p?.variation || '', tags: p ? ptags(p).map(c => c.name).join('; ') : '', qty: num(s.qty), list: num(s.listPrice ?? s.price), sold: num(s.price), disc, reason: reasons.join('; '), tax: round2(num(s.tax)), total: round2(lineRev(s)), pay: o?.payment?.method ? payLabel(o.payment.method) : '', sq: o?.payment?.squareTxn || '' };
    });
}
function reportCsv(r) {
    let cur = data.settings.currency || 'CAD', head = ['Date', 'Market', 'Order', 'Product', 'Variation', 'Tags', 'Qty', `List price (${cur})`, `Sold at (${cur})`, `Discount (${cur})`, 'Discount reason', `Tax (${cur})`, `Line total before tax (${cur})`, 'Payment', 'Square receipt'];
    const q = v => {
        v = String(v ?? '');
        return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }, f2 = n => Number(n).toFixed(2);
    let rows = reportLines(r).map(l => [l.date, l.market, l.order, l.product, l.variation, l.tags, l.qty, f2(l.list), f2(l.sold), f2(l.disc), l.reason, f2(l.tax), f2(l.total), l.pay, l.sq]);
    return '﻿' + [head, ...rows].map(r => r.map(q).join(',')).join('\r\n') + '\r\n';
}
async function downloadReport() {
    let r = reportSelection();
    if (!r.f.sales.length && !await appConfirm('There are no sales in this time frame. Download an empty report anyway?'))
        return;
    try {
        if (dlFmt === 'csv')
            await saveReportFile(new Blob([reportCsv(r)], { type: 'text/csv' }), reportFileName(r, 'csv'));
        else
            await saveReportFile(new Blob([reportPdf(r)], { type: 'application/pdf' }), reportFileName(r, 'pdf'));
    }
    catch (e) {
        console.error(e);
        appAlert('The report couldn’t be made. Please try again.');
    }
}
// A small PDF writer (Helvetica, no extra files needed)
function pdfEnc(s) {
    let map = { '−': '-', '–': '\x96', '—': '\x97', '‘': '\x91', '’': '\x92', '“': '\x93', '”': '\x94', '•': '\x95', '…': '\x85', '·': '\xb7', '€': '\x80', '›': '\x9b', '‹': '\x8b' }, o = '';
    for (let ch of String(s)) {
        if (map[ch] !== undefined)
            o += map[ch];
        else {
            let c = ch.charCodeAt(0);
            o += c < 256 && c >= 32 ? ch : '?';
        }
    }
    return o;
}
function pdfW(s, font, size) {
    let t = 0, w = PDFW[font];
    for (let i = 0; i < s.length; i++) {
        let c = s.charCodeAt(i);
        t += w[c - 32] ?? 556;
    }
    return t * size / 1000;
}
function reportPdf(r) {
    const W = 612, H = 792, M = 44, BOT = 56;
    let pages = [], ops = [], y = H - M;
    const hex = h => {
        h = h.replace('#', '');
        return [0, 2, 4].map(i => (parseInt(h.substr(i, 2), 16) / 255).toFixed(3)).join(' ');
    };
    const INK = '#2E1F47', INK2 = '#5B4782', SOFT = '#EDE6FA', BOX = '#F7F3FF', LAV = '#C9B5EE';
    const txt = (x, yy, s, size = 10, bold = false, color = INK, align = 'left') => {
        s = pdfEnc(s);
        let f = bold ? 'F2' : 'F1', w = pdfW(s, f, size);
        if (align === 'right')
            x -= w;
        else if (align === 'center')
            x -= w / 2;
        ops.push(`BT /${f} ${size} Tf ${hex(color)} rg ${x.toFixed(2)} ${yy.toFixed(2)} Td (${s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')}) Tj ET`);
    };
    const rect = (x, yy, w, h, color) => ops.push(`${hex(color)} rg ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    const line = (x1, y1, x2, y2, color, lw = 0.8) => ops.push(`${hex(color)} RG ${lw} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
    const newPage = () => {
        pages.push(ops);
        ops = [];
        y = H - M;
    };
    const need = h => {
        if (y - h < BOT)
            newPage();
    };
    const fit = (s, f, size, max) => {
        s = pdfEnc(s);
        if (pdfW(s, f, size) <= max)
            return s;
        while (s.length > 1 && pdfW(s + '...', f, size) > max)
            s = s.slice(0, -1);
        return s + '...';
    };
    const table = (title, cols, rows, opt = {}) => {
        let w = W - 2 * M, rh = 17;
        need(40 + Math.min(rows.length, 3) * rh);
        txt(M, y - 14, title, 13, true);
        y -= 24;
        const head = () => {
            rect(M, y - rh, w, rh, SOFT);
            let x = M;
            cols.forEach(c => {
                let cw = c.w * w;
                if (c.r)
                    txt(x + cw - 5, y - 12, c.t, 8.5, true, INK, 'right');
                else
                    txt(x + 5, y - 12, c.t, 8.5, true);
                x += cw;
            });
            y -= rh;
        };
        head();
        rows.forEach((row, k) => {
            if (y - rh < BOT) {
                newPage();
                head();
            }
            let b = opt.boldLast && k === rows.length - 1, x = M;
            cols.forEach((c, j) => {
                let cw = c.w * w, v = fit(row[j] ?? '', b ? 'F2' : 'F1', 9, cw - 10);
                if (c.r)
                    txt(x + cw - 5, y - 12, v, 9, b, INK, 'right');
                else
                    txt(x + 5, y - 12, v, 9, b);
                x += cw;
            });
            line(M, y - rh, M + w, y - rh, SOFT);
            y -= rh;
        });
        y -= 16;
    };
    let f = r.f, cur = data.settings.currency || 'CAD', now = new Date();
    // Header
    txt(M, y - 14, 'Crochet Studio', 11, true, '#6B5596');
    txt(M, y - 40, 'Sales report', 24, true);
    txt(M, y - 58, `${r.rangeLabel} · ${r.marketLabel}`, 10.5, true, INK2);
    if (data.settings.userName)
        txt(W - M, y - 14, data.settings.userName, 11, true, INK, 'right');
    txt(W - M, y - 30, 'Made ' + now.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }), 9, false, INK2, 'right');
    txt(W - M, y - 43, 'Amounts in ' + cur, 9, false, INK2, 'right');
    y -= 70;
    line(M, y, W - M, y, LAV, 2.5);
    y -= 14;
    let boxes = [['Sales (after discounts)', cash(f.revenue)], ['Profit', signedCash(f.profit)], ['Items sold', String(f.qty)], ['Discounts given', cash(f.discounts || 0)]], bw = (W - 2 * M - 24) / 4;
    boxes.forEach(([l, v], i) => {
        let x = M + i * (bw + 8);
        rect(x, y - 50, bw, 50, BOX);
        txt(x + 8, y - 16, l, 8, true, INK2);
        txt(x + 8, y - 39, v, 15, true);
    });
    y -= 64;
    txt(M, y, `Profit = sales after discounts (${cash(f.revenue)}) - material costs (${cash(f.materials)}) - booth costs (${cash(f.booth)}), before tax.`, 8.5, false, INK2);
    y -= 26;
    // By market
    let mrows = r.sel.map(m => {
        let x = marketFigures([m]), t = marketTime(m);
        return [m.name, t ? new Date(t).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '', String(x.qty), cash(x.revenue), cash(x.materials), cash(x.booth), signedCash(x.profit)];
    });
    if (r.useQ && r.qs.length) {
        let x = marketFigures([], r.qs);
        mrows.push(['Quick sales (no market)', '', String(x.qty), cash(x.revenue), cash(x.materials), cash(0), signedCash(x.profit)]);
    }
    if (mrows.length) {
        if (mrows.length > 1)
            mrows.push(['Total', '', String(f.qty), cash(f.revenue), cash(f.materials), cash(f.booth), signedCash(f.profit)]);
        table('By market', [{ t: 'Market', w: .31 }, { t: 'Date', w: .15 }, { t: 'Items', w: .07, r: 1 }, { t: 'Sales', w: .12, r: 1 }, { t: 'Materials', w: .12, r: 1 }, { t: 'Booth', w: .1, r: 1 }, { t: 'Profit', w: .13, r: 1 }], mrows, { boldLast: mrows.length > 1 });
    }
    // Best sellers
    let by = {};
    for (let s of f.sales) {
        let k = s.productId;
        by[k] = by[k] || { q: 0, v: 0 };
        by[k].q += num(s.qty);
        by[k].v += lineRev(s);
    }
    let best = Object.entries(by).sort((a, b) => b[1].q - a[1].q).slice(0, 10).map(([pid, v]) => {
        let p = product(pid);
        return [p ? (p.name + (p.variation ? ' · ' + p.variation : '')) : 'Deleted product', String(v.q), cash(v.v)];
    });
    if (best.length)
        table('Best sellers', [{ t: 'Product', w: .6 }, { t: 'Sold', w: .15, r: 1 }, { t: 'Sales', w: .25, r: 1 }], best);
    // Payments
    let orders = new Map();
    for (let s of f.sales) {
        let k = s.orderId || s.id;
        if (!orders.has(k)) {
            let o = s.orderId ? (data.orders || []).find(z => z.id === s.orderId) : null;
            orders.set(k, { m: o?.payment?.method || '', t: 0 });
        }
        orders.get(k).t += lineRev(s) + num(s.tax);
    }
    let pays = {};
    for (let o of orders.values()) {
        let k = o.m;
        pays[k] = pays[k] || { n: 0, t: 0 };
        pays[k].n++;
        pays[k].t += o.t;
    }
    let prow = Object.entries(pays).sort((a, b) => b[1].t - a[1].t).map(([k, v]) => [payLabel(k), String(v.n), cash(v.t)]);
    if (prow.length)
        table('How customers paid (including tax)', [{ t: 'Method', w: .6 }, { t: 'Sales', w: .15, r: 1 }, { t: 'Amount', w: .25, r: 1 }], prow);
    // Discounts
    if (num(f.discounts) > 0.004) {
        let rs = {};
        for (let s of f.sales) {
            let o = s.orderId ? (data.orders || []).find(z => z.id === s.orderId) : null;
            if (num(s.disc) > 0) {
                let k = o?.discount?.reason || 'Discount';
                rs[k] = (rs[k] || 0) + num(s.disc);
            }
            let pd = num(s.qty) * (num(s.listPrice ?? s.price) - num(s.price));
            if (pd > 0.004) {
                let k = s.priceReason || 'Price change';
                rs[k] = (rs[k] || 0) + pd;
            }
        }
        table('Discounts', [{ t: '', w: .7 }, { t: 'Amount', w: .3, r: 1 }], [['At full price', cash(f.full)], ...Object.entries(rs).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, '-' + cash(v)]), ['After discounts', cash(f.revenue)]], { boldLast: true });
    }
    // Materials on hand
    let md = materialValueData();
    if (md.tracked)
        table('Materials on hand (today)', [{ t: 'Category', w: .7 }, { t: 'Value', w: .3, r: 1 }], [...md.rows.map(([n, v]) => [n, cash(v)]), ['Total', cash(md.total)]], { boldLast: true });
    // Tax
    let inR = d => {
        let t = Date.parse(d);
        return t >= r.a && t < r.b;
    }, coll = f.sales.reduce((a, s) => a + num(s.tax), 0), paid = (data.purchases || []).filter(x => inR(x.date)).reduce((a, x) => a + num(x.tax), 0);
    need(50);
    txt(M, y - 14, 'Sales tax', 13, true);
    y -= 32;
    txt(M, y, `Collected: ${cash(coll)}      Paid on materials: ${cash(paid)}      Difference: ${signedCash(coll - paid)}`, 9.5);
    y -= 20;
    if (!f.sales.length) {
        need(30);
        txt(M, y - 10, 'No sales in this time frame.', 10, false, INK2);
        y -= 24;
    }
    pages.push(ops);
    // Footers + assemble
    let n = pages.length, objs = [], kids = [];
    pages.forEach((p, i) => {
        p.push(`${hex(SOFT)} RG 0.8 w ${M} 40 m ${W - M} 40 l S`);
        let foot = pdfEnc('Made with Crochet Studio. A guide only, not tax advice.'), pg = `Page ${i + 1} of ${n}`;
        p.push(`BT /F1 7.5 Tf ${hex(INK2)} rg ${M} 28 Td (${foot}) Tj ET`);
        p.push(`BT /F1 7.5 Tf ${hex(INK2)} rg ${(W - M - pdfW(pg, 'F1', 7.5)).toFixed(2)} 28 Td (${pg}) Tj ET`);
    });
    objs.push('<< /Type /Catalog /Pages 2 0 R >>');
    objs.push(null);
    objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    pages.forEach(p => {
        let content = p.join('\n'), ci = objs.length + 2;
        objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${ci} 0 R >>`);
        kids.push(`${objs.length} 0 R`);
        objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    });
    objs[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${n} >>`;
    let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', offs = [];
    objs.forEach((o, i) => {
        offs.push(out.length);
        out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    let xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info << /Title (${pdfEnc('Crochet Studio sales report')}) /Producer (Crochet Studio) >> >>\nstartxref\n${xref}\n%%EOF`;
    let bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++)
        bytes[i] = out.charCodeAt(i) & 255;
    return bytes;
}
