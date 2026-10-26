// Report downloads: a PDF summary and an Excel workbook for the chosen time frame (everything except photos).
// Part of the Crochet Studio app. Files load in the order listed in index.html.

const PDFW = { F1: [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 761, 556, 556, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 556, 611, 556, 556, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 556, 500, 667, 278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, 556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500], F2: [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 761, 556, 611, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 611, 611, 611, 611, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 611, 500, 667, 278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556] };
let dlFmt = 'pdf';
function reportDownload() {
    let r = reportSelection();
    if (dlFmt === 'csv')
        dlFmt = 'xlsx';
    return `${backBtn()}<h2 style="margin-top:12px">Download a report</h2><div class="panel"><label for="dlRange" style="margin-top:0">Time frame</label><select id="dlRange" class="fancy" onchange="reportRange=this.value;reportMarket='all';render()">${r.opts.map(([v, l]) => `<option value="${v}" ${reportRange === v ? 'selected' : ''}>${v === 'all' ? 'All time' : l}</option>`).join('')}</select><label for="dlMarket">Market</label><select id="dlMarket" class="fancy" onchange="reportMarket=this.value;render()"><option value="all">All markets in this time frame (${r.inRange.length})</option>${r.inRange.map(m => `<option value="${m.id}" ${reportMarket === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}${r.qs.length ? `<option value="quick" ${reportMarket === 'quick' ? 'selected' : ''}>Quick sales, no market</option>` : ''}</select><p class="hint">Everything in Reports for this time frame: sales, markets, what sold, stock, expenses and receipts, and sales tax. Photos aren’t included (use Year-end receipts for those).</p></div><div class="panel"><h3>File type</h3><div class="fmtgrid"><button class="fmt ${dlFmt === 'pdf' ? 'on' : ''}" aria-pressed="${dlFmt === 'pdf'}" onclick="dlFmt='pdf';render()"><b>PDF</b><span>A tidy summary for printing or your records</span></button><button class="fmt ${dlFmt === 'xlsx' ? 'on' : ''}" aria-pressed="${dlFmt === 'xlsx'}" onclick="dlFmt='xlsx';render()"><b>Excel workbook</b><span>Tabs for the summary, every item sold, products, markets, receipts and tax. Opens in Excel or Google Sheets</span></button></div></div><div class="actions"><button onclick="downloadReport()">${ic('download', 18)} Download ${dlFmt === 'pdf' ? 'PDF' : 'Excel'}</button></div><p class="hint" style="margin:0 6px">Saves the file, or opens the share menu so you can save, email or print it.</p>`;
}
function reportFileName(r, ext) {
    let slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `crochet-studio-report_${slug(r.rangeLabel)}${r.marketLabel !== 'All markets' ? '_' + slug(r.marketLabel) : ''}.${ext}`;
}
// Everything both downloads need, worked out once.
function reportPack(r) {
    let f = r.f, inR = d => {
        let t = Date.parse(d);
        return t >= r.a && t < r.b;
    };
    let ex = (reportMarket === 'all' ? reportExpenseData(r).list : f.expenses).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let mk = r.sel.map(m => ({ name: m.name, date: marketTime(m) ? new Date(marketTime(m)).toISOString().slice(0, 10) : '', f: marketFigures([m]) }));
    if (r.useQ && r.qs.length)
        mk.push({ name: 'Quick sales (no market)', date: '', f: marketFigures([], r.qs), quick: true });
    let coll = f.sales.reduce((a, s) => a + num(s.tax), 0), paidM = (data.purchases || []).filter(x => inR(x.date)).reduce((a, x) => a + num(x.tax), 0), paidE = ex.reduce((a, e) => a + expenseTaxPaid(e), 0);
    let byCat = {};
    for (let e of ex) {
        let k = e.category || 'Other';
        byCat[k] ||= { n: 0, total: 0, kind: expenseKind(e) };
        byCat[k].n++;
        byCat[k].total += num(e.amount);
    }
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
        pays[o.m] ||= { n: 0, t: 0 };
        pays[o.m].n++;
        pays[o.m].t += o.t;
    }
    let reasons = {};
    for (let s of f.sales) {
        let o = s.orderId ? (data.orders || []).find(z => z.id === s.orderId) : null, pd = num(s.qty) * (num(s.listPrice ?? s.price) - num(s.price));
        if (num(s.disc) > 0)
            reasons[o?.discount?.reason || 'Discount'] = (reasons[o?.discount?.reason || 'Discount'] || 0) + num(s.disc);
        if (pd > 0.004)
            reasons[s.priceReason || 'Price change'] = (reasons[s.priceReason || 'Price change'] || 0) + pd;
    }
    return { f, ex, mk, sold: soldProducts(f.sales), pays, reasons, byCat, md: materialValueData(), tax: { coll: round2(coll), paidM: round2(paidM), paidE: round2(paidE), diff: round2(coll - paidM - paidE) }, who: normName(data.settings.businessName), cur: data.settings.currency || 'CAD' };
}
async function downloadReport() {
    let r = reportSelection();
    if (!r.f.sales.length && !(data.expenses || []).length && !await appConfirm('There are no sales in this time frame. Download an empty report anyway?'))
        return;
    try {
        if (dlFmt === 'xlsx')
            await saveReportFile(await reportXlsx(r), reportFileName(r, 'xlsx'));
        else
            await saveReportFile(new Blob([reportPdf(r)], { type: 'application/pdf' }), reportFileName(r, 'pdf'));
    }
    catch (e) {
        console.error(e);
        appAlert('The report couldn’t be made. Please try again.');
    }
}
// ---- Excel workbook ----
async function reportXlsx(r) {
    let P = reportPack(r), f = P.f, cur = P.cur, title = `${P.who ? P.who + ' · ' : ''}Sales report · ${r.rangeLabel} · ${r.marketLabel}`;
    let sheets = [];
    sheets.push({ name: 'Summary', cols: [34, 16, 60], rows: [[{ v: title, s: 't' }], [`Made ${new Date().toLocaleDateString('en-CA')} · amounts in ${cur}`], [], ['', xh('Amount')], ['Sales (after discounts)', xm(f.revenue)], ['At full price', xm(f.full)], ['Discounts given', xm(f.discounts)], ['Items sold', f.qty], ['Material costs', xm(f.materials)], ['Booth costs', xm(f.booth)], ['Other expenses', xm(f.other)], [xb('Profit'), xbm(f.profit)], [], ['Tax collected', xm(P.tax.coll)], ['Tax paid on materials', xm(P.tax.paidM)], ['Tax paid on expenses', xm(P.tax.paidE)], [xb('Tax difference (collected − paid)'), xbm(P.tax.diff)], [], [profitNote(f)], ['A guide only, not tax advice.']] });
    sheets.push({ name: 'Sales', cols: [11, 22, 9, 26, 16, 18, 6, 12, 12, 12, 20, 10, 14, 12, 16], freeze: 1, rows: [['Date', 'Market', 'Order', 'Product', 'Variation', 'Tags', 'Qty', `List price (${cur})`, `Sold at (${cur})`, `Discount (${cur})`, 'Discount reason', `Tax (${cur})`, `Line total before tax (${cur})`, 'Payment', 'Square receipt'].map(xh), ...reportLines(r).map(l => [l.date, l.market, l.order, l.product, l.variation, l.tags, l.qty, xm(l.list), xm(l.sold), xm(l.disc), l.reason, xm(l.tax), xm(l.total), l.pay, l.sq])] });
    let pr = [];
    for (let x of P.sold) {
        let p = product(x.pid);
        pr.push([x.name, x.price, x.qty, xm(x.sales), p ? num(p.stock) : '']);
        if (x.disc)
            pr.push(['    with discounts', x.disc.price, x.disc.qty, xm(x.disc.sales), '']);
    }
    sheets.push({ name: 'Products sold', cols: [36, 26, 8, 14, 14], freeze: 1, rows: [['Product', 'Price', 'Sold', `Sales (${cur})`, 'In stock now'].map(xh), ...pr, [], [xb('Total'), '', xb(f.qty), xbm(f.revenue)]] });
    sheets.push({ name: 'Markets', cols: [30, 12, 8, 13, 13, 12, 13, 13], freeze: 1, rows: [['Market', 'Date', 'Items', `Sales (${cur})`, `Materials (${cur})`, `Booth (${cur})`, `Expenses (${cur})`, `Profit (${cur})`].map(xh), ...P.mk.map(m => [m.name, m.date, m.f.qty, xm(m.f.revenue), xm(m.f.materials), xm(m.f.booth), xm(m.f.other), xm(m.f.profit)]), [], [xb('Total'), '', xb(f.qty), xbm(f.revenue), xbm(f.materials), xbm(f.booth), xbm(f.other), xbm(f.profit)]] });
    let es = receiptListSheet(P.ex, `${P.who ? P.who + ' · ' : ''}Expenses & receipts · ${r.rangeLabel}`);
    es.name = 'Expenses & receipts';
    es.rows.push([], ['How each category counts'], ...Object.entries(P.byCat).sort((a, b) => b[1].total - a[1].total).map(([k, o]) => [k, `${o.n} receipt${o.n === 1 ? '' : 's'}`, '', '', '', '', '', xm(o.total), o.kind === 'material' ? 'Proof only (already in material costs)' : o.kind === 'proof' ? 'Proof only (booth cost comes from the market)' : 'Other expense, taken off profit']));
    sheets.push(es);
    sheets.push({ name: 'Sales tax', cols: [44, 16], rows: [[{ v: `Sales tax · ${r.rangeLabel}`, s: 't' }], [], ['Tax collected on sales', xm(P.tax.coll)], ['Tax paid on materials', xm(P.tax.paidM)], ['Tax paid on expenses (not supplies)', xm(P.tax.paidE)], [xb('Difference (collected − paid)'), xbm(P.tax.diff)], [], ['Supply receipts aren’t added again, since that tax is already in tax paid on materials.'], ['A guide only; check with an accountant.']] });
    if (P.md.tracked)
        sheets.push({ name: 'Materials on hand', cols: [30, 16], rows: [[{ v: 'Materials on hand (today)', s: 't' }], [], ['Category', `Value (${cur})`].map(xh), ...P.md.rows.map(([n, v]) => [n, xm(v)]), [xb('Total'), xbm(P.md.total)], [], [`Based on ${P.md.tracked} material${P.md.tracked === 1 ? '' : 's'} you’re counting. Not affected by the time frame.`]] });
    return makeXlsx(sheets);
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
    const INK = '#2E1F47', INK2 = '#5B4782', SOFT = '#EDE6FA', BOX = '#F7F3FF', LAV = '#C9B5EE', GOOD = '#1F7A3D', BAD = '#B42828';
    const money = v => ({ t: signedCash(v), c: v < 0 ? BAD : GOOD });
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
    const section = t => {
        need(60);
        y -= 4;
        rect(M, y - 22, W - 2 * M, 22, LAV);
        txt(M + 8, y - 15.5, t, 12, true);
        y -= 34;
    };
    const note = (t, size = 8.5) => {
        let words = pdfEnc(t).split(' '), lineS = '';
        for (let w of words) {
            if (pdfW(lineS + ' ' + w, 'F1', size) > W - 2 * M) {
                need(14);
                txt(M, y, lineS.trim(), size, false, INK2);
                y -= 12;
                lineS = '';
            }
            lineS += ' ' + w;
        }
        if (lineS.trim()) {
            need(14);
            txt(M, y, lineS.trim(), size, false, INK2);
            y -= 12;
        }
        y -= 6;
    };
    // A cell is text or { t, c (colour), b (bold), i (indent) }
    const table = (title, cols, rows, opt = {}) => {
        let w = W - 2 * M, rh = 17;
        need(40 + Math.min(rows.length, 3) * rh);
        if (title) {
            txt(M, y - 14, title, 11.5, true);
            y -= 24;
        }
        const head = () => {
            if (!cols.some(c => c.t))
                return;
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
        if (!rows.length) {
            txt(M + 5, y - 12, opt.empty || 'Nothing in this time frame.', 9, false, INK2);
            y -= rh;
        }
        rows.forEach((row, k) => {
            if (y - rh < BOT) {
                newPage();
                head();
            }
            let b = opt.boldLast && k === rows.length - 1, x = M;
            cols.forEach((c, j) => {
                let cell = row[j], o = cell && typeof cell === 'object' ? cell : { t: cell ?? '' }, bold = b || o.b, cw = c.w * w, ind = o.i ? 12 : 0, v = fit(o.t ?? '', bold ? 'F2' : 'F1', o.i ? 8.5 : 9, cw - 10 - ind);
                if (c.r)
                    txt(x + cw - 5, y - 12, v, o.i ? 8.5 : 9, bold, o.c || (o.i ? INK2 : INK), 'right');
                else
                    txt(x + 5 + ind, y - 12, v, o.i ? 8.5 : 9, bold, o.c || (o.i ? INK2 : INK));
                x += cw;
            });
            line(M, y - rh, M + w, y - rh, SOFT);
            y -= rh;
        });
        y -= 16;
    };
    let P = reportPack(r), f = P.f, cur = P.cur, now = new Date();
    // Header: business name (or the app name), then the time frame
    txt(M, y - 14, P.who || 'Crochet Studio', 11, true, '#6B5596');
    txt(M, y - 40, 'Sales report', 24, true);
    txt(M, y - 58, `${r.rangeLabel} · ${r.marketLabel}`, 10.5, true, INK2);
    txt(W - M, y - 30, 'Made ' + now.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }), 9, false, INK2, 'right');
    txt(W - M, y - 43, 'Amounts in ' + cur, 9, false, INK2, 'right');
    y -= 70;
    line(M, y, W - M, y, LAV, 2.5);
    y -= 14;
    let boxes = [['Sales (after discounts)', cash(f.revenue)], ['Profit', signedCash(f.profit), f.profit < 0 ? BAD : GOOD], ['Items sold', String(f.qty)], ['Discounts given', cash(f.discounts || 0)]], bw = (W - 2 * M - 24) / 4;
    boxes.forEach(([l, v, c], i) => {
        let x = M + i * (bw + 8);
        rect(x, y - 50, bw, 50, BOX);
        txt(x + 8, y - 16, l, 8, true, INK2);
        txt(x + 8, y - 39, v, 15, true, c || INK);
    });
    y -= 64;
    note(`Profit = sales after discounts (${cash(f.revenue)}) - material costs (${cash(f.materials)}) - booth costs (${cash(f.booth)})${f.other ? ` - other expenses (${cash(f.other)})` : ''}, before tax. Your time and payment fees are not included.`);
    // 1. Overview
    section('Overview');
    let mrows = P.mk.map(m => [m.name, m.date ? new Date(m.date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '', String(m.f.qty), cash(m.f.revenue), cash(m.f.materials), cash(m.f.booth), cash(m.f.other), money(m.f.profit)]);
    if (mrows.length > 1)
        mrows.push([{ t: 'Total', b: 1 }, '', { t: String(f.qty), b: 1 }, { t: cash(f.revenue), b: 1 }, { t: cash(f.materials), b: 1 }, { t: cash(f.booth), b: 1 }, { t: cash(f.other), b: 1 }, { ...money(f.profit), b: 1 }]);
    table('By market', [{ t: 'Market', w: .27 }, { t: 'Date', w: .14 }, { t: 'Items', w: .07, r: 1 }, { t: 'Sales', w: .11, r: 1 }, { t: 'Materials', w: .11, r: 1 }, { t: 'Booth', w: .09, r: 1 }, { t: 'Expenses', w: .1, r: 1 }, { t: 'Profit', w: .11, r: 1 }], mrows, { empty: 'No completed markets or quick sales in this time frame.' });
    let prow = Object.entries(P.pays).sort((a, b) => b[1].t - a[1].t).map(([k, v]) => [payLabel(k), String(v.n), cash(v.t)]);
    if (prow.length)
        table('How customers paid (including tax)', [{ t: 'Method', w: .6 }, { t: 'Sales', w: .15, r: 1 }, { t: 'Amount', w: .25, r: 1 }], prow);
    if (num(f.discounts) > 0.004)
        table('Discounts', [{ t: '', w: .7 }, { t: 'Amount', w: .3, r: 1 }], [['At full price', cash(f.full)], ...Object.entries(P.reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, '-' + cash(v)]), ['After discounts', cash(f.revenue)]], { boldLast: true });
    // 2. What sold and stock
    section('What sold and stock');
    let srows = [];
    for (let x of P.sold) {
        let p = product(x.pid);
        srows.push([x.name, x.price, String(x.qty), cash(x.sales), p ? String(num(p.stock)) : '']);
        if (x.disc)
            srows.push([{ t: 'with discounts', i: 1 }, { t: x.disc.price, i: 1 }, { t: String(x.disc.qty), i: 1 }, { t: cash(x.disc.sales), i: 1 }, '']);
    }
    if (srows.length)
        srows.push([{ t: 'Total', b: 1 }, '', { t: String(f.qty), b: 1 }, { t: cash(f.revenue), b: 1 }, '']);
    table('Products sold', [{ t: 'Product', w: .42 }, { t: 'Price', w: .22, r: 1 }, { t: 'Sold', w: .09, r: 1 }, { t: 'Sales', w: .14, r: 1 }, { t: 'In stock', w: .13, r: 1 }], srows, { empty: 'No sales in this time frame.' });
    if (P.sold.some(x => x.disc))
        note('Price is the price each item was listed at (a range when it changed). "with discounts" shows the ones sold with a discount or bundle deal, at the price after the discount. Order discounts are shared across the items in the order by their price.');
    let stock = data.products.reduce((a, p) => a + num(p.stock), 0), value = data.products.reduce((a, p) => a + num(p.stock) * num(p.price), 0);
    table('Finished stock (today)', [{ t: '', w: .7 }, { t: '', w: .3, r: 1 }], [['Finished items', String(stock)], ['Stock value at your selling prices', cash(value)]]);
    if (P.md.tracked)
        table('Materials on hand (today)', [{ t: 'Category', w: .7 }, { t: 'Value', w: .3, r: 1 }], [...P.md.rows.map(([n, v]) => [n, cash(v)]), ['Total', cash(P.md.total)]], { boldLast: true });
    // 3. Expenses, receipts and sales tax
    section('Expenses, receipts and sales tax');
    let erows = P.ex.map(e => [e.date || '', e.name, e.category || '', expenseMarketName(e) || '', e.photo ? 'Yes' : e.photoOff ? 'Saved off app' : 'No', cash(e.tax), cash(e.amount)]);
    if (erows.length)
        erows.push([{ t: 'Total', b: 1 }, '', '', '', '', { t: cash(P.ex.reduce((a, e) => a + num(e.tax), 0)), b: 1 }, { t: cash(P.ex.reduce((a, e) => a + num(e.amount), 0)), b: 1 }]);
    table('Expenses and receipts', [{ t: 'Date', w: .13 }, { t: 'Store', w: .24 }, { t: 'Category', w: .17 }, { t: 'Market', w: .17 }, { t: 'Photo', w: .1 }, { t: 'Tax', w: .09, r: 1 }, { t: 'Total', w: .1, r: 1 }], erows, { empty: 'No receipts or expenses in this time frame.' });
    let crows = Object.entries(P.byCat).sort((a, b) => b[1].total - a[1].total).map(([k, o]) => [k, String(o.n), o.kind === 'other' ? 'Taken off profit' : o.kind === 'material' ? 'Proof only (in material costs)' : 'Proof only (booth from market)', cash(o.total)]);
    if (crows.length)
        table('By category', [{ t: 'Category', w: .32 }, { t: 'Receipts', w: .12, r: 1 }, { t: 'How it counts', w: .36 }, { t: 'Total', w: .2, r: 1 }], crows);
    table('Profit after expenses', [{ t: '', w: .7 }, { t: '', w: .3, r: 1 }], [['Profit from markets and quick sales', money(round2(f.revenue - f.materials - f.booth))], ['Other expenses (all but supplies and booth fees)', '-' + cash(f.other)], [{ t: 'Profit after expenses', b: 1 }, { ...money(f.profit), b: 1 }]]);
    table('Sales tax', [{ t: '', w: .7 }, { t: '', w: .3, r: 1 }], [['Tax collected on sales', cash(P.tax.coll)], ['Tax paid on materials', '-' + cash(P.tax.paidM)], ['Tax paid on expenses (not supplies)', '-' + cash(P.tax.paidE)], [{ t: 'Difference (collected - paid)', b: 1 }, { t: signedCash(P.tax.diff), b: 1 }]]);
    note('Sales tax counts sales, material purchases and receipts dated in this time frame. A guide only, not tax advice; check with an accountant.');
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

