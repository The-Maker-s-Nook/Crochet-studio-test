// Year-end receipts: save last year's receipt photos as one folder (zip), then clear them off the phone and account.
// Reminders: Jan 1 a note on Home (hide a week at a time), Feb 1 a reminder each time Receipts opens,
// Mar 1 a pink note every day, Apr 1 adding new receipts pauses until the photos are saved and cleared.
// Part of the Crochet Studio app. Files load in the order listed in index.html.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
let yearEndPick = null;
const receiptYear = r => Number(String(r.date).slice(0, 4));

// The oldest earlier year that still has receipt photos in the app (null if none).
function yearEndYear() {
    let y = new Date().getFullYear(), ys = (data.expenses || []).filter(r => r.photo && receiptYear(r) < y).map(receiptYear);
    return ys.length ? Math.min(...ys) : null;
}
// 'jan' | 'feb' | 'mar' | 'apr' (paused), or null when nothing is waiting
function yearEndStage() {
    let y = yearEndYear(), now = new Date();
    if (!y)
        return null;
    if (y < now.getFullYear() - 1)
        return 'apr';
    return ['jan', 'feb', 'mar'][now.getMonth()] || 'apr';
}
function yearEndBlocked() {
    return yearEndStage() === 'apr';
}
async function yearEndBlockedNotice() {
    let y = yearEndYear();
    if (await appConfirm(`Adding new receipts is paused until your ${y} receipt photos are saved off the app and cleared.\n\nEverything else keeps working. It only takes a minute.`, { ok: `Save ${y} receipts`, cancel: 'Not now' }))
        openYearEnd(y);
}
function openYearEnd(y) {
    go('yearEnd', () => {
        yearEndPick = y || yearEndYear() || new Date().getFullYear() - 1;
    });
}
function yearEndHomeNote() {
    let st = yearEndStage(), y = yearEndYear();
    if (!st)
        return '';
    if (st === 'jan' || st === 'feb') {
        if (Date.now() < num(lsGet('csYearEndHide', 0)))
            return '';
        return `<div class="strip">${ic('receipt', 18)}<span class="grow">New year! Save your ${y} receipt photos to your phone or Drive, then clear them from the app.</span><button onclick="openYearEnd(${y})">Save</button><button class="iconbtn sm" aria-label="Hide for a week" title="Hide for a week" onclick="lsSet('csYearEndHide', Date.now() + 7 * 864e5);render()">${ic('x', 16)}</button></div>`;
    }
    if (st === 'mar') {
        let today = new Date().toISOString().slice(0, 10);
        if (lsGet('csYearEndDay', '') === today)
            return '';
        return `<div class="strip pinkstrip">${ic('receipt', 18)}<span class="grow">Your ${y} receipt photos are still in the app. Save and clear them by March 31, or adding new receipts pauses on April 1.</span><button onclick="openYearEnd(${y})">Save</button><button class="iconbtn sm" aria-label="Hide for today" title="Hide for today" onclick="lsSet('csYearEndDay','${today}');render()">${ic('x', 16)}</button></div>`;
    }
    return `<div class="strip pinkstrip">${ic('receipt', 18)}<span class="grow">Adding new receipts is paused until your ${y} receipt photos are saved and cleared. Everything else works as usual.</span><button onclick="openYearEnd(${y})">Save</button></div>`;
}
function yearEndReceiptsNote() {
    let st = yearEndStage(), y = yearEndYear();
    if (!st)
        return '';
    return `<div class="strip ${st === 'mar' || st === 'apr' ? 'pinkstrip' : ''}">${ic('receipt', 18)}<span class="grow">${st === 'apr' ? `New receipts are paused until your ${y} photos are saved and cleared.` : `Save your ${y} receipt photos, then clear them from the app.`}</span><button onclick="openYearEnd(${y})">Save</button></div>`;
}
// From Feb 1: a reminder every time Receipts opens.
function yearEndOnOpenReceipts() {
    let st = yearEndStage(), y = yearEndYear();
    if (!st || st === 'jan')
        return;
    setTimeout(async () => {
        let msg = st === 'apr' ? `Adding new receipts is paused until your ${y} receipt photos are saved off the app and cleared.` : `Your ${y} receipt photos are still in the app.\n\nSave them as one folder to your phone or Drive, then clear them to free up space.${st === 'mar' ? ' Do it by March 31, or adding new receipts pauses on April 1.' : ''}`;
        if (await appConfirm(msg, { ok: `Save ${y} receipts`, cancel: 'Later' }))
            openYearEnd(y);
    }, 250);
}

// ---- File names: "01 January/Yarn/2026-01-05 Michaels $45.20.jpg" ----
function safeFileName(s) {
    return String(s || '').replace(/[\/\\:*?"<>|\x00-\x1F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Receipt';
}
function receiptExt(r, blob) {
    if (r.isPdf || blob?.type === 'application/pdf')
        return 'pdf';
    return /png/.test(blob?.type || '') ? 'png' : /webp/.test(blob?.type || '') ? 'webp' : 'jpg';
}
const receiptFolderName = y => `Crochet Studio receipts ${y}`;
// Path inside the year's folder for each receipt of that year (same names in the zip and in Excel downloads).
function receiptPaths(y) {
    let list = (data.expenses || []).filter(r => receiptYear(r) === y).sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id))), used = new Set(), out = new Map();
    for (let r of list) {
        let m = Number(String(r.date).slice(5, 7)) || 1, base = `${String(m).padStart(2, '0')} ${MONTHS[m - 1]}/${safeFileName(r.category || 'Other')}/${safeFileName(`${r.date} ${r.name} $${num(r.amount).toFixed(2)}`)}`, ext = receiptExt(r), p = `${base}.${ext}`, i = 2;
        while (used.has(p.toLowerCase()))
            p = `${base} (${i++}).${ext}`;
        used.add(p.toLowerCase());
        out.set(r.id, p);
    }
    return out;
}
// What the downloads show in the "Photo file" column
function receiptPhotoCell(r) {
    if (r.photoOff)
        return `${receiptFolderName(receiptYear(r))}/${receiptPaths(receiptYear(r)).get(r.id) || ''} (saved off the app)`;
    if (!r.photo)
        return 'No photo';
    return `${receiptFolderName(receiptYear(r))}/${receiptPaths(receiptYear(r)).get(r.id) || ''}`;
}
async function receiptBlob(r) {
    let pid = photoIdOf(r.photo);
    if (!pid)
        return null;
    let rec = await photoGetLocal(pid).catch(() => null), blob = rec?.blob;
    if (!blob && typeof signedIn === 'function' && signedIn() && navigator.onLine)
        blob = await photoDown(pid).catch(() => null);
    return blob || null;
}
function receiptListSheet(list, title, withFolderPaths) {
    let cur = data.settings.currency || 'CAD';
    return { name: 'Receipts', cols: [12, 26, 18, 22, 12, 13, 11, 13, 30, 56], freeze: 3, rows: [[{ v: title, s: 't' }], [], ['Date', 'Store', 'Category', 'Market', 'Paid with', `Before tax (${cur})`, `Tax (${cur})`, `Total (${cur})`, 'Notes', withFolderPaths ? 'Photo file (in this folder)' : 'Photo file'].map(xh), ...list.map(r => [r.date, r.name, r.category || '', expenseMarketName(r), (RECEIPT_PAY.find(x => x[0] === r.pay) || [, ''])[1], xm(r.pre ?? r.amount), xm(r.tax), xm(r.amount), r.notes || '', withFolderPaths ? withFolderPaths(r) : receiptPhotoCell(r)]), [], [xb('Total'), '', '', '', '', xbm(list.reduce((a, r) => a + num(r.pre ?? r.amount), 0)), xbm(list.reduce((a, r) => a + num(r.tax), 0)), xbm(list.reduce((a, r) => a + num(r.amount), 0))]] };
}
function receiptCatSheet(list) {
    let cur = data.settings.currency || 'CAD', by = new Map();
    for (let r of list) {
        let k = r.category || 'Other', o = by.get(k) || { n: 0, pre: 0, tax: 0, tot: 0, kind: expenseKind(r) };
        o.n++;
        o.pre += num(r.pre ?? r.amount);
        o.tax += num(r.tax);
        o.tot += num(r.amount);
        by.set(k, o);
    }
    let rows = [...by].sort((a, b) => b[1].tot - a[1].tot);
    return { name: 'By category', cols: [24, 11, 15, 12, 15, 44], freeze: 1, rows: [['Category', 'Receipts', `Before tax (${cur})`, `Tax (${cur})`, `Total (${cur})`, 'How it counts in Reports'].map(xh), ...rows.map(([k, o]) => [k, o.n, xm(o.pre), xm(o.tax), xm(o.tot), o.kind === 'material' ? 'Proof only (already in material costs)' : o.kind === 'proof' ? 'Proof only (booth cost comes from the market)' : 'Other expense, taken off profit']), [], [xb('Total'), xb(list.length), xbm(list.reduce((a, r) => a + num(r.pre ?? r.amount), 0)), xbm(list.reduce((a, r) => a + num(r.tax), 0)), xbm(list.reduce((a, r) => a + num(r.amount), 0))]] };
}

// ---- The screen ----
function yearEndScreen() {
    let now = new Date().getFullYear(), years = [...new Set((data.expenses || []).map(receiptYear).filter(Boolean))].sort((a, b) => b - a);
    if (!years.includes(yearEndPick))
        yearEndPick = years.find(y => y < now) || years[0] || now - 1;
    let y = yearEndPick, list = (data.expenses || []).filter(r => receiptYear(r) === y), pics = list.filter(r => r.photo), off = list.filter(r => r.photoOff).length, past = y < now;
    return `${backBtn()}<h2 style="margin-top:12px">Year-end receipts</h2>${years.length > 1 ? `<label for="yeYear" style="margin-top:0">Year</label><select id="yeYear" class="fancy" onchange="yearEndPick=Number(this.value);render()">${years.map(v => `<option value="${v}" ${v === y ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ''}<div class="panel" style="margin-top:12px"><div class="row"><b>${y}</b><span class="muted">${list.length} receipt${list.length === 1 ? '' : 's'} · ${cash(list.reduce((a, r) => a + num(r.amount), 0))}</span></div><p class="muted">${pics.length} photo${pics.length === 1 ? '' : 's'} in the app${off ? ` · ${off} already saved off the app` : ''}.</p></div><div class="panel"><h3>1. Save the folder</h3><p class="muted">Makes one folder, <b>${esc(receiptFolderName(y))}</b>, with a folder for each month and a folder for each category inside it. Every photo is named by date, store and total, like “${y}-03-14 Michaels $45.20.jpg”. It also has <b>Receipts ${y}.xlsx</b>, a list of every receipt with a by-category tab.</p><p class="hint">Save it somewhere safe, like Google Drive, iCloud or your computer. Keep receipts for as long as your tax agency asks (often 6 years).</p><div class="actions"><button onclick="saveYearEndZip(${y})" ${list.length ? '' : 'disabled'}>${ic('download', 16)} Save ${y} receipts</button></div></div>${past ? `<div class="panel"><h3>2. Clear the photos</h3><p class="muted">Removes the ${y} photos from this phone and your account to free up space. The receipt details and totals stay in the app and in Reports. Each one will say “Photo saved off the app”.</p><div class="actions"><button class="danger" onclick="clearYearPhotos(${y})" ${pics.length ? '' : 'disabled'}>Clear ${y} photos</button></div></div>` : `<p class="hint" style="margin:0 6px">You can save this year’s folder any time. Clearing photos is for past years only.</p>`}`;
}
async function saveYearEndZip(y) {
    let list = (data.expenses || []).filter(r => receiptYear(r) === y).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (!list.length)
        return;
    flash('Making your receipts folder…');
    try {
        let paths = receiptPaths(y), root = receiptFolderName(y), files = [], missing = 0, found = new Map();
        for (let r of list) {
            if (!r.photo)
                continue;
            let blob = await receiptBlob(r);
            if (!blob) {
                missing++;
                continue;
            }
            found.set(r.id, true);
            files.push({ name: `${root}/${paths.get(r.id)}`, data: blob });
        }
        let cell = r => found.has(r.id) ? paths.get(r.id) : r.photoOff ? 'Saved off the app earlier' : r.photo ? 'Photo not found on this phone' : 'No photo';
        let book = await makeXlsx([receiptListSheet(list, `${data.settings.businessName ? data.settings.businessName + ' · ' : ''}Receipts ${y}`, cell), receiptCatSheet(list)]);
        files.push({ name: `${root}/Receipts ${y}.xlsx`, data: book });
        let zip = await makeZip(files);
        await saveReportFile(zip, `${root}.zip`);
        lsSet('csYearEndSaved', { ...(lsGet('csYearEndSaved', {}) || {}), [y]: Date.now() });
        if (missing)
            appAlert(`${missing} photo${missing > 1 ? 's' : ''} couldn’t be found on this phone${signedIn() ? ' or in your account' : ''}, so ${missing > 1 ? 'they’re' : 'it’s'} not in the folder. Everything else was saved.`);
    }
    catch (e) {
        console.error(e);
        appAlert('The receipts folder couldn’t be made. Please try again.');
    }
}
async function clearYearPhotos(y) {
    let list = (data.expenses || []).filter(r => receiptYear(r) === y && r.photo);
    if (!list.length)
        return;
    let saved = (lsGet('csYearEndSaved', {}) || {})[y];
    if (!await appConfirm(`Did you save the ${y} receipts folder?\n\n${saved ? `You saved it on ${new Date(saved).toLocaleDateString()}. ` : ''}Clearing removes ${list.length} photo${list.length > 1 ? 's' : ''} from this phone and your account. The receipt details and totals stay.`, { ok: `Yes, clear ${y} photos`, cancel: 'Not yet', danger: true }))
        return;
    for (let r of list) {
        let pid = photoIdOf(r.photo);
        r.photo = '';
        r.photoOff = true;
        if (pid) {
            idbDel('photos', pid).catch(() => {});
            let u = photoUrls.get(pid);
            if (u)
                URL.revokeObjectURL(u);
            photoUrls.delete(pid);
        }
    }
    save();
    render();
    toast(`${y} photos cleared. Receipt details are kept.`);
}
