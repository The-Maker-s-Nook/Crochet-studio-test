// Settings › Import from spreadsheet (.xlsx/.csv): reading, review screen, undo
// Part of the Crochet Studio app. Files load in the order listed in index.html.

let importPlan = null, importBusy = false, importUseWage = true, lastImportResult = null, fbType = 'Something broke';
// ---- File reading: .xlsx (own small reader, no library) and .csv ----
const xmlEls = (n, tag) => Array.from(n.getElementsByTagNameNS('*', tag));
async function unzipEntries(buf, want) {
    let dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--)
        if (dv.getUint32(i, true) === 0x06054b50) {
            eocd = i;
            break;
        }
    if (eocd < 0)
        throw new Error('notzip');
    let count = dv.getUint16(eocd + 10, true), p = dv.getUint32(eocd + 16, true), out = {}, dec = new TextDecoder();
    for (let k = 0; k < count; k++) {
        if (dv.getUint32(p, true) !== 0x02014b50)
            throw new Error('badzip');
        let method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), loc = dv.getUint32(p + 42, true);
        let name = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
        p += 46 + nlen + elen + clen;
        if (!want(name))
            continue;
        let start = loc + 30 + dv.getUint16(loc + 26, true) + dv.getUint16(loc + 28, true), raw = buf.subarray(start, start + csize), bytes;
        if (method === 0)
            bytes = raw;
        else if (method === 8) {
            if (typeof DecompressionStream === 'undefined')
                throw new Error('nodecomp');
            bytes = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
        }
        else
            throw new Error('method');
        out[name] = dec.decode(bytes);
    }
    return out;
}
function colIndex(ref) {
    let m = /^([A-Z]+)/.exec(ref || '');
    if (!m)
        return -1;
    let n = 0;
    for (let ch of m[1])
        n = n * 26 + ch.charCodeAt(0) - 64;
    return n - 1;
}
async function readXlsx(file) {
    let buf = new Uint8Array(await file.arrayBuffer());
    let z = await unzipEntries(buf, n => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/i.test(n));
    const P = t => new DOMParser().parseFromString(t || '<x/>', 'application/xml');
    let shared = z['xl/sharedStrings.xml'] ? xmlEls(P(z['xl/sharedStrings.xml']), 'si').map(si => xmlEls(si, 't').filter(t => !t.closest || !t.parentNode || t.parentNode.localName !== 'rPh').map(t => t.textContent).join('')) : [];
    let rels = {};
    for (let r of xmlEls(P(z['xl/_rels/workbook.xml.rels']), 'Relationship'))
        rels[r.getAttribute('Id')] = r.getAttribute('Target');
    let sheets = [];
    for (let s of xmlEls(P(z['xl/workbook.xml']), 'sheet')) {
        let rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'), t = rels[rid] || '';
        let path = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
        let xml = z[path] || z[Object.keys(z).find(k => k.toLowerCase() === path.toLowerCase())];
        if (!xml)
            continue;
        let rows = [];
        for (let row of xmlEls(P(xml), 'row')) {
            let r = Number(row.getAttribute('r')) - 1;
            if (!(r >= 0))
                r = rows.length;
            for (let c of xmlEls(row, 'c')) {
                let ci = colIndex(c.getAttribute('r')), t = c.getAttribute('t'), v = xmlEls(c, 'v')[0]?.textContent, val;
                if (t === 's')
                    val = shared[Number(v)];
                else if (t === 'inlineStr')
                    val = xmlEls(c, 't').map(x => x.textContent).join('');
                else if (t === 'str' || t === 'e')
                    val = v;
                else if (t === 'b')
                    val = v === '1';
                else
                    val = v === undefined || v === '' ? undefined : Number(v);
                if (val === undefined || val === '' || ci < 0)
                    continue;
                (rows[r] ||= [])[ci] = val;
            }
        }
        sheets.push({ name: s.getAttribute('name') || 'Sheet', rows });
    }
    return sheets;
}
function parseCsv(text) {
    text = text.replace(/^﻿/, '');
    let rows = [], row = [], f = '', q = false, delim = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (let i = 0; i < text.length; i++) {
        let ch = text[i];
        if (q) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    f += '"';
                    i++;
                }
                else
                    q = false;
            }
            else
                f += ch;
        }
        else if (ch === '"')
            q = true;
        else if (ch === delim) {
            row.push(f);
            f = '';
        }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n')
                i++;
            row.push(f);
            rows.push(row);
            row = [];
            f = '';
        }
        else
            f += ch;
    }
    if (f !== '' || row.length) {
        row.push(f);
        rows.push(row);
    }
    return rows.map(r => r.map(v => {
        v = v.trim();
        if (v === '')
            return undefined;
        let n = Number(v.replace(/[$,]/g, ''));
        return /^-?\$?[\d,]*\.?\d+$/.test(v) && isFinite(n) ? n : v;
    }));
}
// ---- Understanding the spreadsheet ----
const hnorm = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const cellText = v => v === undefined || v === null ? '' : String(v).trim().replace(/\s+/g, ' ');
function cellNum(v) {
    if (typeof v === 'number')
        return isFinite(v) ? v : NaN;
    let s = cellText(v).replace(/[$,\s]/g, '');
    if (s === '')
        return NaN;
    return /^-?\d*\.?\d+$/.test(s) ? Number(s) : NaN;
}
function findHeader(rows, test, maxRow = 30) {
    for (let r = 0; r < Math.min(rows.length, maxRow); r++) {
        let row = rows[r] || [];
        for (let c = 0; c < row.length; c++)
            if (test(hnorm(row[c])))
                return r;
    }
    return -1;
}
function mapCols(row, spec) {
    let map = {};
    (row || []).forEach((v, c) => {
        let h = hnorm(v);
        if (!h)
            return;
        for (let [k, f] of Object.entries(spec))
            if (map[k] === undefined && f(h)) {
                map[k] = c;
                break;
            }
    });
    return map;
}
const isAny = (...a) => h => a.includes(h), starts = (...a) => h => a.some(x => h.startsWith(x));
const PRODUCT_COLS = { name: isAny('product', 'products', 'productname', 'item', 'itemname', 'name'), variation: isAny('variation', 'colour', 'color', 'colourway'), yarnG: starts('totalyarnused', 'yarnused', 'gramsofyarn', 'yarngrams', 'yarng'), yarn: isAny('yarn', 'typeofyarn', 'yarntype', 'yarnname'), fill: h => (h.includes('polyfil') || h.includes('stuffing') || h.includes('fiberfill')) && !h.startsWith('cost'), eyes: isAny('eyesused', 'eyes', 'eye', 'safetyeyes', 'typeofeye'), hook: starts('hook'), time: isAny('timetomake', 'time', 'hours', 'timehours', 'maketime'), units: starts('units', 'unit'), price: isAny('saleprice', 'price', 'sellingprice', 'retailprice'), qty: isAny('quantity', 'currentquantity', 'qty', 'stock', 'instock', 'onhand') };
function analyzeSpreadsheet(sheets, fileName) {
    let plan = { file: fileName, yarns: [], eyes: [], stuffing: [], products: [], skipped: [], warnings: [], hourly: null, sheetsUsed: [], dupSheets: 0 };
    const skip = (sheet, row, reason) => plan.skipped.push({ sheet, row, reason });
    const warn = (sheet, row, text) => plan.warnings.push({ sheet, row, text });
    for (let { name: sn, rows } of sheets) {
        // Hourly wage: a row with "Wage", "hr" and a number
        if (plan.hourly === null)
            for (let row of rows) {
                if (!row)
                    continue;
                let hs = row.map(hnorm), wi = hs.indexOf('wage'), hi = hs.indexOf('hr');
                if (wi >= 0 && hi > wi) {
                    let n = row.slice(hi + 1).map(cellNum).find(x => x > 0);
                    if (n > 0) {
                        plan.hourly = Math.round(n * 100) / 100;
                        break;
                    }
                }
            }
        // Yarn and stuffing price list
        let yr = findHeader(rows, h => h === 'typeofyarn');
        if (yr >= 0) {
            let c = mapCols(rows[yr], { name: isAny('typeofyarn'), grams: starts('gramsper', 'grams'), cost: starts('costwithtax', 'cost', 'price'), ship: starts('costofshipping', 'shipping') });
            // "Cost of shipping" also starts with "cost": make sure cost is the first, shipping the second
            if (c.cost !== undefined && hnorm(rows[yr][c.cost]).startsWith('costofshipping')) {
                let alt = (rows[yr] || []).findIndex((v, i) => i !== c.cost && /^(costwithtax|cost|price)/.test(hnorm(v)) && !hnorm(v).startsWith('costofshipping'));
                c.ship = c.cost;
                c.cost = alt >= 0 ? alt : undefined;
            }
            plan.sheetsUsed.push(sn);
            for (let r = yr + 1; r < rows.length; r++) {
                let row = rows[r];
                if (!row)
                    continue;
                let nm = cellText(row[c.name]);
                if (!nm)
                    continue;
                let g = cellNum(row[c.grams]), cost = cellNum(row[c.cost]), ship = cellNum(row[c.ship]);
                if (!(g > 0)) {
                    skip(sn, r + 1, `“${nm}” has no grams per ball`);
                    continue;
                }
                if (!(cost >= 0)) {
                    skip(sn, r + 1, `“${nm}” has no cost`);
                    continue;
                }
                let item = { name: nm, weight: g, unit: 'g', price: Math.round(((cost) + (ship > 0 ? ship : 0)) * 100) / 100, store: '', row: r + 1, sheet: sn };
                (/poly ?fil|fib(er|re) ?fil|stuff/i.test(nm) ? plan.stuffing : plan.yarns).push(item);
            }
        }
        // Eyes price list
        let er = findHeader(rows, h => h === 'typeofeye' || h === 'typeofeyes');
        if (er >= 0) {
            let c = mapCols(rows[er], { name: isAny('typeofeye', 'typeofeyes'), pack: starts('costofpackage', 'packagecost', 'costofpack'), per: starts('eyesperpackage', 'eyesperpack', 'perpackage'), pair: starts('costperpair'), from: starts('boughtfrom', 'store') });
            plan.sheetsUsed.push(sn);
            for (let r = er + 1; r < rows.length; r++) {
                let row = rows[r];
                if (!row)
                    continue;
                let nm = cellText(row[c.name]);
                if (!nm)
                    continue;
                let pack = cellNum(row[c.pack]), per = cellNum(row[c.per]), pair = cellNum(row[c.pair]), item;
                if (pack >= 0 && per >= 2)
                    item = { name: nm, weight: Math.round(per / 2 * 100) / 100, unit: 'pair', price: pack };
                else if (pair >= 0)
                    item = { name: nm, weight: 1, unit: 'pair', price: pair };
                else {
                    skip(sn, r + 1, `“${nm}” has no cost`);
                    continue;
                }
                plan.eyes.push({ ...item, ...splitEye(nm), orig: nm, store: cellText(row[c.from]), row: r + 1, sheet: sn });
            }
        }
        // Product lists
        let pr = findHeader(rows, h => PRODUCT_COLS.name(h));
        if (pr >= 0 && yr < 0 && er < 0) {
            let c = mapCols(rows[pr], PRODUCT_COLS);
            if (c.name === undefined || (c.price === undefined && c.yarnG === undefined && c.time === undefined))
                continue;
            plan.sheetsUsed.push(sn);
            for (let r = pr + 1; r < rows.length; r++) {
                let row = rows[r];
                if (!row)
                    continue;
                let nm = cellText(row[c.name]);
                if (!nm) {
                    if (cellText(row[c.yarn]) || cellText(row[c.price]))
                        skip(sn, r + 1, 'no product name');
                    continue;
                }
                if (/^total/i.test(nm))
                    continue;
                let key = nm.toLowerCase() + '|' + cellText(row[c.variation]).toLowerCase(), seen = plan.products.find(p => p.key === key);
                if (seen) {
                    plan.dupSheets++;
                    continue;
                }
                let rawPrice = row[c.price], price = cellNum(rawPrice), time = cellNum(row[c.time]), unitTxt = hnorm(row[c.units]), qty = cellNum(row[c.qty]);
                let hours = time > 0 ? (unitTxt.startsWith('m') ? time / 60 : time) : 0;
                plan.products.push({ key, sheet: sn, row: r + 1, name: nm, variation: cellText(row[c.variation]), yarn: cellText(row[c.yarn]), yarnG: cellNum(row[c.yarnG]), fillG: cellNum(row[c.fill]), eyes: cellText(row[c.eyes]), hook: cellText(row[c.hook]).replace(/\s*mm$/i, ''), hours: Math.round(hours * 1000) / 1000, price: price >= 0 ? Math.round(price * 100) / 100 : null, priceText: cellText(rawPrice), qty: qty > 0 ? Math.floor(qty) : 0 });
            }
        }
    }
    // De-duplicate price lists
    for (let k of ['yarns', 'eyes', 'stuffing']) {
        let seen = new Set();
        plan[k] = plan[k].filter(x => {
            let n = (x.name + '|' + (x.colour || '')).toLowerCase();
            if (seen.has(n)) {
                skip(x.sheet, x.row, `“${x.orig || x.name}” is listed twice`);
                return false;
            }
            seen.add(n);
            return true;
        });
    }
    resolvePlan(plan);
    return plan;
}
// "10mm glitter eyes" -> {name:'Glitter eyes', colour:'10 mm'}; names with no size stay as they are
function splitEye(raw) {
    let t = cellText(raw), m = /^(\d+(?:\.\d+)?)\s*mm\b\.?\s*(.*)$/i.exec(t) || /^(.*?)\s*(\d+(?:\.\d+)?)\s*mm$/i.exec(t) && (([a, b, c]) => [a, c, b])(/^(.*?)\s*(\d+(?:\.\d+)?)\s*mm$/i.exec(t));
    if (!m || !cellText(m[2]))
        return { name: t, colour: '' };
    let type = cellText(m[2]).replace(/^[-–,:]\s*/, '');
    if (!/eye[sd]?$/i.test(type))
        type += ' eyes';
    return { name: type.charAt(0).toUpperCase() + type.slice(1), colour: m[1] + ' mm' };
}
function importCat(kind) {
    let ids = { yarn: 'cat_yarn', eyes: 'cat_eyes', stuffing: 'cat_stuffing' }, re = { yarn: /yarn/i, eyes: /eye/i, stuffing: /stuff|fill|fibre|fiber/i };
    return data.materialCategories.find(c => c.id === ids[kind]) || data.materialCategories.find(c => re[kind].test(c.name)) || null;
}
function resolvePlan(plan) {
    // Match each price-list item to a material already in the app, or mark it new
    plan.newMaterials = [];
    plan.reused = 0;
    const findExisting = (kind, name, colour = '') => {
        let c = importCat(kind);
        if (!c)
            return null;
        let n = normName(name).toLowerCase(), col = normName(colour).toLowerCase();
        let hits = data.materials.filter(m => m.categoryId === c.id && normName(m.name).toLowerCase() === n);
        if (col)
            return hits.find(m => normName(m.colour).toLowerCase() === col) || null;
        return hits.find(m => !normName(m.colour)) || hits[0] || null;
    };
    plan.lookup = { yarn: {}, eyes: {}, stuffing: {} };
    for (let [kind, list] of [['yarn', plan.yarns], ['eyes', plan.eyes], ['stuffing', plan.stuffing]])
        for (let it of list) {
            let ex = findExisting(kind, it.name, it.colour || ''), key = (it.orig || it.name).toLowerCase();
            if (ex) {
                plan.reused++;
                plan.lookup[kind][key] = { existing: ex.id };
            }
            else {
                let nm = { ...it, kind, tmp: 'm' + plan.newMaterials.length };
                plan.newMaterials.push(nm);
                plan.lookup[kind][key] = { tmp: nm.tmp };
            }
        }
    const find = (kind, name) => {
        if (!name)
            return null;
        let hit = plan.lookup[kind][name.toLowerCase()];
        if (hit)
            return hit;
        let sp = kind === 'eyes' ? splitEye(name) : { name, colour: '' };
        let pn = plan.newMaterials.find(m => m.kind === kind && m.name.toLowerCase() === sp.name.toLowerCase() && (m.colour || '').toLowerCase() === sp.colour.toLowerCase());
        if (pn)
            return { tmp: pn.tmp };
        let ex = findExisting(kind, sp.name, sp.colour) || (sp.colour ? null : findExisting(kind, name));
        return ex ? { existing: ex.id } : null;
    };
    const stuffingRef = () => plan.stuffing.length ? find('stuffing', plan.stuffing[0].name) : (() => {
        let c = importCat('stuffing');
        let d = c && (material(c.defaultMaterialId) || data.materials.find(m => m.categoryId === c.id));
        return d ? { existing: d.id } : null;
    })();
    plan.newProducts = [];
    plan.inApp = 0;
    for (let p of plan.products) {
        if (data.products.some(x => normName(x.name).toLowerCase() === p.name.toLowerCase() && normName(x.variation).toLowerCase() === p.variation.toLowerCase())) {
            plan.inApp++;
            plan.skipped.push({ sheet: p.sheet, row: p.row, reason: `“${p.name}” is already in your app` });
            continue;
        }
        let lines = [], notes = [];
        if (p.yarn && p.yarnG > 0) {
            let r = find('yarn', p.yarn);
            if (r)
                lines.push({ ref: r, amount: p.yarnG });
            else
                notes.push(`yarn “${p.yarn}” isn't in your yarn list, so it was left off`);
        }
        else if (p.yarn && !(p.yarnG > 0))
            notes.push(`no grams of yarn, so the yarn was left off`);
        if (p.fillG > 0) {
            let r = stuffingRef();
            if (r)
                lines.push({ ref: r, amount: p.fillG });
            else
                notes.push('no stuffing in your price list, so stuffing was left off');
        }
        if (p.eyes) {
            let r = find('eyes', p.eyes);
            if (r)
                lines.push({ ref: r, amount: 1 });
            else
                notes.push(`eyes “${p.eyes}” aren't in your eye list, so they were left off`);
        }
        if (p.price === null)
            notes.push(p.priceText ? `price “${p.priceText}” isn't a number, so the suggested price is used` : 'no sale price, so the suggested price is used');
        for (let n of notes)
            plan.warnings.push({ sheet: p.sheet, row: p.row, text: `${p.name}: ${n}` });
        plan.newProducts.push({ ...p, lines });
    }
    plan.wageChange = plan.hourly > 0 && Math.abs(plan.hourly - num(data.settings.hourly)) > 0.004;
}
// ---- Screens ----
function settingsImport() {
    let last = data.lastImport;
    return `${backBtn()}<h2 style="margin-top:12px">Import from spreadsheet</h2><span class="pill beta">Beta · check your items after importing</span>
  <div class="panel" style="margin-top:12px"><h3>Bring in your products and materials</h3><p class="muted" style="margin-top:0">Works with the CrochetWBay pricing spreadsheet: your yarn and eye price lists, wage and product rows. Nothing is added until you check it on the next screen.</p>
  <div class="actions"><button onclick="$('importFile').click()" ${importBusy ? 'disabled' : ''}>${importBusy ? 'Reading…' : 'Choose spreadsheet file'}</button></div>
  <input class="hidden" id="importFile" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onchange="importSheetFile(event)">
  <p class="hint">Excel (.xlsx) or CSV file. Using Google Sheets? Choose File › Download › Microsoft Excel (.xlsx), then pick that file here.</p></div>
  <div class="panel"><h3>Tips for a clean import</h3><ol class="tips"><li>Use the spreadsheet as it came. Renamed columns may not be recognised.</li><li>Rows that can't be read are skipped and listed, so you can add them by hand.</li><li>Products already in the app (same name) are left as they are.</li><li><a href="#" onclick="event.preventDefault();exportData(false)">Download a backup</a> first to be safe.</li></ol></div>
  ${last ? `<div class="panel"><h3>Last import</h3><p class="muted" style="margin-top:0">${esc(last.file || 'Spreadsheet')} · ${new Date(last.at).toLocaleDateString()} · ${last.productIds.length} product${last.productIds.length === 1 ? '' : 's'}, ${last.materialIds.length} material${last.materialIds.length === 1 ? '' : 's'}</p><div class="actions"><button class="danger" onclick="undoImport()">Undo this import</button></div></div>` : ''}`;
}
async function importSheetFile(e) {
    let f = e.target.files?.[0];
    e.target.value = '';
    if (!f)
        return;
    let n = f.name.toLowerCase();
    if (/\.(xls|numbers|ods)$/.test(n))
        return appAlert('This file type can’t be read. Save it as Excel (.xlsx) or CSV first, then try again.');
    if (f.size > 25 * 1024 * 1024)
        return appAlert('That file is too big to import (over 25 MB).');
    importBusy = true;
    render();
    try {
        let sheets = n.endsWith('.csv') || f.type === 'text/csv' ? [{ name: f.name.replace(/\.csv$/i, ''), rows: parseCsv(await f.text()) }] : await readXlsx(f);
        let plan = analyzeSpreadsheet(sheets, f.name);
        importBusy = false;
        if (!plan.newProducts.length && !plan.newMaterials.length) {
            render();
            if (plan.inApp || plan.reused)
                return appAlert('Everything in this spreadsheet is already in your app, so there’s nothing new to add.');
            return appAlert('No products or materials were found in this file. Make sure it’s the pricing spreadsheet (or a sheet with a “Product” column) and try again.');
        }
        importPlan = plan;
        importUseWage = true;
        go('importReview');
    }
    catch (err) {
        importBusy = false;
        render();
        console.warn('Import', err);
        appAlert(err?.message === 'nodecomp' ? 'This browser can’t open Excel files. Update your browser, or save the spreadsheet as CSV and import that.' : 'This file couldn’t be read. Make sure it’s an Excel (.xlsx) or CSV file. If it came from Google Sheets, use File › Download › Microsoft Excel (.xlsx).');
    }
}
function importReview() {
    let p = importPlan;
    if (!p)
        return `${backBtn()}<p class="muted">Choose a file first.</p>`;
    let nm = p.newMaterials, np = p.newProducts, total = nm.length + np.length;
    const rowRef = x => `${esc(x.sheet)}, row ${x.row}`;
    let items = [...np.map(x => `<div class="irow"><span>${esc(x.name)}${x.variation ? ' · ' + esc(x.variation) : ''}</span><span>${x.price === null ? 'Suggested price' : cash(x.price)}${x.qty ? ` · ${x.qty} in stock` : ''}</span></div>`), ...nm.map(x => `<div class="irow"><span>${esc(x.name)}${x.colour ? ' · ' + esc(x.colour) : ''}</span><span>${num(x.weight)} ${x.unit === 'pair' ? 'pairs' : 'g'} · ${cash(x.price)}</span></div>`)];
    let examples = items.slice(0, 5).join('');
    return `${backBtn()}<h2 style="margin-top:12px">Check before adding</h2><div class="muted" style="font-weight:700;margin:-8px 0 12px">${esc(p.file)}</div>
  <div class="grid keep2"><div class="panel" style="margin:0"><div class="muted">New products</div><div class="stat">${np.length}</div></div><div class="panel" style="margin:0"><div class="muted">New materials</div><div class="stat">${nm.length}</div></div></div>
  ${np.length + nm.length ? `<div class="panel" style="margin-top:12px"><h3>A few examples</h3>${examples}${total > 5 ? `<button class="linkbtn" onclick="importShowAll()">See all ${total}</button><div id="importAll" class="hidden">${items.slice(5).join('')}</div>` : ''}</div>` : ''}
  ${p.reused || p.inApp ? `<div class="tip" style="margin-top:12px">${p.inApp ? `${p.inApp} product${p.inApp === 1 ? ' is' : 's are'} already in your app and will be left as ${p.inApp === 1 ? 'it is' : 'they are'}. ` : ''}${p.reused ? `${p.reused} material${p.reused === 1 ? ' is' : 's are'} already saved, so ${p.reused === 1 ? 'it' : 'they'}’ll be reused.` : ''}</div>` : ''}
  ${p.wageChange ? `<div class="panel" style="margin-top:12px"><label class="check" style="margin:0"><input type="checkbox" id="importWage" ${importUseWage ? 'checked' : ''} onchange="importUseWage=this.checked"> Set my hourly wage to ${cash(p.hourly)} (from the spreadsheet; now ${cash(data.settings.hourly)})</label></div>` : ''}
  ${p.warnings.length ? `<div class="tip" style="margin-top:12px"><b>Check after importing (${p.warnings.length})</b>${p.warnings.slice(0, 8).map(w => `<div class="iline">${esc(w.text)}</div>`).join('')}${p.warnings.length > 8 ? `<div class="iline">…and ${p.warnings.length - 8} more</div>` : ''}</div>` : ''}
  ${p.skipped.length ? `<div class="tip warn" style="margin-top:12px"><b>${p.skipped.length} row${p.skipped.length === 1 ? '' : 's'} skipped</b>${p.skipped.slice(0, 8).map(s => `<div class="iline">${rowRef(s)}: ${esc(s.reason)}</div>`).join('')}${p.skipped.length > 8 ? `<div class="iline">…and ${p.skipped.length - 8} more</div>` : ''}</div>` : ''}
  <div class="actions" style="margin-top:16px"><button onclick="applyImport()">Add ${total} item${total === 1 ? '' : 's'}</button><button class="alt" onclick="importPlan=null;goBack()">Cancel</button></div>
  <p class="hint">Prices are brought in as they are in your spreadsheet (yarn cost includes the shipping per ball). Photos aren’t in spreadsheets, so add them after.</p>`;
}
function importShowAll() {
    $('importAll')?.classList.remove('hidden');
    document.querySelector('.linkbtn')?.remove();
}
function applyImport() {
    let p = importPlan;
    if (!p)
        return;
    let rec = { id: id(), at: new Date().toISOString(), file: p.file, productIds: [], materialIds: [], catIds: [], prevHourly: null, newHourly: null };
    const catFor = kind => {
        let c = importCat(kind);
        if (c)
            return c;
        let defs = { yarn: ['Yarn', 'g'], eyes: ['Eyes', 'pair'], stuffing: ['Stuffing', 'g'] }[kind];
        c = { id: 'cat_' + id(), name: defs[0], unit: defs[1], onProducts: true };
        let other = data.materialCategories.findIndex(x => x.id === 'cat_other');
        data.materialCategories.splice(other >= 0 ? other : data.materialCategories.length, 0, c);
        rec.catIds.push(c.id);
        return c;
    };
    let tmpIds = {};
    for (let m of p.newMaterials) {
        let c = catFor(m.kind), mid = id();
        if (!data.units.some(u => u.id === m.unit))
            data.units.push(m.unit === 'pair' ? { id: 'pair', name: 'pairs', short: 'pairs', builtin: true } : { id: 'g', name: 'grams', short: 'g', builtin: true });
        data.materials.push({ id: mid, categoryId: c.id, name: normName(m.name), colour: normName(m.colour || ''), weight: m.weight, unit: m.unit, price: m.price, store: canonStore(m.store || ''), taxOverride: data.settings.materialTax === 'includes' ? null : { on: true, mode: 'includes', rate: taxRate() }, trackStock: false, photo: '', photos: [], stock: 0 });
        tmpIds[m.tmp] = mid;
        rec.materialIds.push(mid);
    }
    if (p.stuffing.length) {
        let c = importCat('stuffing'), r = p.lookup.stuffing[p.stuffing[0].name.toLowerCase()], sid = r?.existing || tmpIds[r?.tmp];
        if (c && sid && !material(c.defaultMaterialId))
            c.defaultMaterialId = sid;
    }
    if (p.wageChange && importUseWage) {
        rec.prevHourly = num(data.settings.hourly);
        rec.newHourly = p.hourly;
        data.settings.hourly = p.hourly;
    }
    let now = new Date().toISOString();
    for (let x of p.newProducts) {
        let pr = { id: id(), name: x.name, variation: x.variation, photo: '', photos: [], hook: x.hook, hours: x.hours, materials: x.lines.map(l => ({ materialId: l.ref.existing || tmpIds[l.ref.tmp], amount: l.amount })).filter(l => l.materialId), categoryId: '', patternId: '', stock: x.qty, batches: [] };
        pr.price = x.price === null ? suggest(pr) : x.price;
        if (x.qty > 0)
            pr.batches.push({ id: id(), qty: x.qty, unitCost: recipeCost(pr), date: now, deducted: false, imported: true });
        data.products.push(pr);
        rec.productIds.push(pr.id);
    }
    data.lastImport = rec;
    save();
    lastImportResult = { products: rec.productIds.length, materials: rec.materialIds.length, skipped: p.skipped.length, warnings: p.warnings.length, wage: rec.newHourly };
    importPlan = null;
    screen = 'importDone';
    render();
    scrollTo(0, 0);
}
function importDone() {
    let r = lastImportResult || { products: 0, materials: 0, skipped: 0, warnings: 0 };
    return `<div class="idone"><div class="okcircle">${ic('check', 36)}</div><h2 style="text-align:center;margin:12px 0 6px">Import complete</h2><p class="muted" style="text-align:center;font-weight:700;margin:0 0 14px">Added ${r.products} product${r.products === 1 ? '' : 's'} and ${r.materials} material${r.materials === 1 ? '' : 's'}.${r.wage ? ` Hourly wage set to ${cash(r.wage)}.` : ''}</p></div>
  <div class="panel"><h3>Before you start selling</h3><ul class="tips"><li>Open a few products and check prices, stock and materials.</li><li>Add photos. Spreadsheets don’t include them.</li>${r.skipped ? `<li>Add the ${r.skipped} skipped row${r.skipped === 1 ? '' : 's'} by hand if you need them.</li>` : ''}${r.warnings ? `<li>Look over the ${r.warnings} item${r.warnings === 1 ? '' : 's'} marked “check after importing”.</li>` : ''}</ul></div>
  ${data.lastImport ? `<div class="tip">Something look wrong? <b>Undo this import</b> removes only what was just added. Anything you already had stays. You can also undo later from Settings › Import from spreadsheet.</div>` : ''}
  <div class="actions" style="margin-top:16px"><button onclick="view('products')">See my products</button>${data.lastImport ? `<button class="danger" onclick="undoImport()">Undo this import</button>` : ''}</div>`;
}
async function undoImport() {
    let rec = data.lastImport;
    if (!rec)
        return;
    let used = pid => data.sales.some(s => s.productId === pid) || (data.orders || []).some(o => (o.lines || []).some(l => l.productId === pid || l.pid === pid)) || data.markets.some(m => num(m.items?.[pid]));
    let keep = rec.productIds.filter(pid => product(pid) && used(pid));
    if (!await appDialog({ title: 'Undo this import?', message: `This removes the products and materials added from ${rec.file || 'the spreadsheet'}${rec.prevHourly !== null ? ' and puts your hourly wage back' : ''}. Anything you had before stays.${keep.length ? `\n\n${keep.length} product${keep.length === 1 ? ' has' : 's have'} sales or market packing since, so ${keep.length === 1 ? 'it' : 'they'}’ll be kept.` : ''}`, ok: 'Undo import', cancel: 'Cancel', danger: true }))
        return;
    let drop = new Set(rec.productIds.filter(pid => !keep.includes(pid)));
    data.products = data.products.filter(p => !drop.has(p.id));
    let inUse = mid => data.products.some(p => (p.materials || []).some(x => x.materialId === mid));
    let mdrop = new Set(rec.materialIds.filter(mid => !inUse(mid)));
    data.materials = data.materials.filter(m => !mdrop.has(m.id));
    for (let c of data.materialCategories)
        if (mdrop.has(c.defaultMaterialId))
            c.defaultMaterialId = '';
    data.materialCategories = data.materialCategories.filter(c => !rec.catIds.includes(c.id) || data.materials.some(m => m.categoryId === c.id));
    if (rec.prevHourly !== null && Math.abs(num(data.settings.hourly) - num(rec.newHourly)) < 0.005)
        data.settings.hourly = rec.prevHourly;
    delete data.lastImport;
    lastImportResult = null;
    save();
    navStack = [];
    screen = 'settings';
    render();
    scrollTo(0, 0);
    toast(`Import undone. Removed ${drop.size} product${drop.size === 1 ? '' : 's'} and ${mdrop.size} material${mdrop.size === 1 ? '' : 's'}.`);
}
