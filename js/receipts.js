// Receipts: the list (Home › Receipts this month, Reports › Expenses & tax), add/edit form, details,
// and the Home "Snap receipt" button and card. Every receipt is an expense in data.expenses
// (how they count in profit and tax is in expenses.js). Photos and PDFs are stored by photos.js.
// Part of the Crochet Studio app. Files load in the order listed in index.html.
//
// A receipt: { id, name (store), date 'YYYY-MM-DD', category, pre (before tax), tax, amount (total paid),
//   pay ('card' | 'cash' | 'etransfer'), marketId, notes, photo ('ph:<id>' or ''), isPdf, fileName,
//   photoOff (true once the photo was saved off the app at year end) }

Object.assign(ICONS, {
    wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12.5h2M3 10h18"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    pdf: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'
});
const RECEIPT_PAY = [['card', 'Card'], ['cash', 'Cash'], ['etransfer', 'E-transfer']];
const CAT_PILL = { Yarn: 'c-yarn', Supplies: 'c-supplies', Packaging: 'c-packaging', 'Booth fees': 'c-booth', Shipping: 'c-shipping', 'Gas & travel': 'c-gas', 'Displays & booth': 'c-booth' };
let receiptRange = 'month', receiptCat = 'all', receiptQ = '', receiptOnly = '', receiptOpen = null, receiptDraft = null;

const receiptsAll = () => (data.expenses || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
const receiptNeedsPhoto = r => !r.photo && !r.photoOff;
const catPill = c => c ? `<span class="cat ${CAT_PILL[c] || 'c-other'}">${esc(c)}</span>` : '';
const rDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
function receiptInRange(r, range = receiptRange) {
    let t = new Date(String(r.date) + 'T12:00:00'), now = new Date();
    if (range === 'month')
        return t.getMonth() === now.getMonth() && t.getFullYear() === now.getFullYear();
    if (range === 'last') {
        let lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return t.getMonth() === lm.getMonth() && t.getFullYear() === lm.getFullYear();
    }
    if (range === 'year')
        return t.getFullYear() === now.getFullYear();
    return true;
}
function receiptThumb(r, size = 56) {
    let st = `width:${size}px;height:${size}px`;
    if (r.photo && r.isPdf)
        return `<span class="thumb rthumb" style="${st}">${ic('pdf', 24)}</span>`;
    if (r.photo)
        return thumb(r.photo, st);
    if (r.photoOff)
        return `<span class="thumb rthumb" style="${st}" title="Photo saved off the app">${ic('receipt', 22)}</span>`;
    // No photo yet: tap the spot to add one
    return `<span role="button" tabindex="0" class="thumb thumb-empty thumb-add tiny" style="${st}" aria-label="Add a photo of the ${esc(r.name)} receipt" onclick="event.stopPropagation();addReceiptPhoto('${r.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();addReceiptPhoto('${r.id}')}">${ic('camera', 20)}</span>`;
}

// ---- Home ----
function homeReceiptButtons() {
    let mo = receiptsAll().filter(r => receiptInRange(r, 'month')), spent = round2(mo.reduce((a, r) => a + num(r.amount), 0)), need = receiptsAll().filter(receiptNeedsPhoto).length;
    return `<div class="quick"><button class="aqua" onclick="startQuickSale()">${ic('tag', 18)} Quick sale</button><button class="alt" onclick="snapReceipt()">${ic('camera', 18)} Snap receipt</button></div><button class="panel rcard" onclick="openReceipts()"><span class="tic gold">${ic('receipt', 18)}</span><span class="grow"><b class="block">Receipts this month</b><span class="muted block">${mo.length} saved · ${cash(spent)} spent${need ? ` · <b class="pinkt">${need} need${need === 1 ? 's' : ''} a photo</b>` : ''}</span></span><span class="chev" aria-hidden="true">›</span></button>`;
}

// ---- Opening ----
function openReceipts(only) {
    go('receipts', () => {
        receiptCat = 'all';
        receiptQ = '';
        receiptOnly = only === 'nophoto' ? 'nophoto' : '';
        receiptRange = only ? 'all' : 'month';
    });
    yearEndOnOpenReceipts();
}
function openReceipt(rid) {
    go('receiptDetail', () => {
        receiptOpen = rid;
    });
}
function newExpense(mid, src) {
    if (yearEndBlocked())
        return yearEndBlockedNotice();
    go('expenseForm', () => {
        receiptDraft = { id: null, name: '', date: new Date().toISOString().slice(0, 10), category: '', pre: '', tax: '', pay: 'card', marketId: mid || null, notes: '', photo: '', isPdf: false, fileName: '' };
    });
    if (src)
        setTimeout(() => receiptPick(src), 60);
}
function snapReceipt() {
    newExpense(null, 'camera');
}
function editExpense(rid) {
    let r = (data.expenses || []).find(x => x.id === rid);
    if (!r)
        return;
    go('expenseForm', () => {
        receiptDraft = { ...r, pre: r.pre ?? r.amount, tax: r.tax ?? 0, pay: r.pay || 'card', notes: r.notes || '' };
    });
}

// ---- List ----
function receiptsFiltered() {
    let q = receiptQ.trim().toLowerCase();
    return receiptsAll().filter(r => receiptInRange(r) && (receiptOnly !== 'nophoto' || receiptNeedsPhoto(r)) && (receiptCat === 'all' || r.category === receiptCat) && (!q || [r.name, r.category, expenseMarketName(r), r.notes, cash(r.amount)].some(x => String(x || '').toLowerCase().includes(q))));
}
function receipts() {
    let list = receiptsAll().filter(r => receiptInRange(r)), spent = round2(list.reduce((a, r) => a + num(r.amount), 0)), tax = round2(list.reduce((a, r) => a + num(r.tax), 0)), need = list.filter(receiptNeedsPhoto).length, label = { month: 'this month', last: 'last month', year: 'this year', all: 'all time' }[receiptRange];
    let used = new Set(receiptsAll().map(r => r.category).filter(Boolean)), cats = expenseCats().filter(c => used.has(c));
    return `${backBtn()}<h2 style="margin-top:12px">Receipts</h2>${yearEndReceiptsNote()}<div class="seg" role="group" aria-label="Time frame" style="margin-bottom:14px">${[['month', 'This month'], ['last', 'Last month'], ['year', 'This year'], ['all', 'All']].map(([v, l]) => `<button class="${receiptRange === v ? 'on' : ''}" aria-pressed="${receiptRange === v}" onclick="receiptRange='${v}';render()">${l}</button>`).join('')}</div><div class="quick"><button onclick="snapReceipt()">${ic('camera', 18)} Snap receipt</button><button class="alt" onclick="newExpense(null,'files')">${ic('upload', 18)} Upload file</button></div><div class="grid keep2 tiles" style="margin-bottom:14px"><div class="panel tile"><span class="tic pink">${ic('wallet', 18)}</span><div class="muted">Spent ${label}</div><div class="stat">${cash(spent)}</div></div><div class="panel tile"><span class="tic aqua">${ic('percent', 18)}</span><div class="muted">Tax paid</div><div class="stat">${cash(tax)}</div></div><div class="panel tile"><span class="tic lav">${ic('receipt', 18)}</span><div class="muted">Receipts</div><div class="stat">${list.length}</div></div><button class="panel tile tilebtn ${receiptOnly === 'nophoto' ? 'on' : ''}" aria-pressed="${receiptOnly === 'nophoto'}" onclick="receiptOnly=receiptOnly==='nophoto'?'':'nophoto';render()"><span class="tic gold">${ic('flag', 18)}</span><span class="muted">Need a photo</span><span class="stat">${need}</span></button></div>${receiptOnly ? `<div class="row entry" style="margin:0 0 12px"><span class="muted" style="font-weight:800">Showing receipts without a photo</span><button class="small alt" onclick="receiptOnly='';render()">Show all</button></div>` : ''}<label for="rq" class="sr">Search receipts and expenses</label><div class="searchbox">${ic('search', 18)}<input id="rq" type="search" placeholder="Search store, category, market or note" value="${esc(receiptQ)}" oninput="receiptQ=this.value;drawReceiptRows()"></div>${cats.length > 1 ? tabRow([['all', 'All'], ...cats.map(c => [c, c])].map(([v, l]) => `<button class="small ${receiptCat === v ? '' : 'alt'}" onclick="receiptCat='${esc(v).replace(/'/g, '&#39;')}';render()">${esc(l)}</button>`).join('')) : ''}<div id="receiptRows">${receiptRows()}</div>`;
}
function drawReceiptRows() {
    let e = $('receiptRows');
    if (e)
        e.innerHTML = receiptRows();
}
function receiptRows() {
    let groups = new Map();
    for (let r of receiptsFiltered()) {
        let k = String(r.date).slice(0, 7);
        if (!groups.has(k))
            groups.set(k, []);
        groups.get(k).push(r);
    }
    if (!groups.size)
        return `<div class="empty"><span class="thumb rthumb" style="margin:0 auto 10px">${ic('receipt', 26)}</span><b>No receipts here yet</b><p class="muted">Try a different time frame or category, or snap your first one.</p></div>`;
    return [...groups].map(([k, rs]) => `<div class="monthhead">${new Date(k + '-15T12:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} · ${cash(rs.reduce((a, r) => a + num(r.amount), 0))}</div>${rs.map(r => `<div class="rc" role="button" tabindex="0" onclick="openReceipt('${r.id}')" onkeydown="if(event.key==='Enter')openReceipt('${r.id}')">${receiptThumb(r)}<span class="grow"><span class="rtitle">${esc(r.name)}</span><span class="meta">${rDate(r.date)} ${catPill(r.category)}${receiptNeedsPhoto(r) ? '<span class="cat review">No photo</span>' : ''}${r.marketId || r.fromMarket ? `<span>${esc(expenseMarketName(r))}</span>` : ''}</span></span><span class="amt">${cash(r.amount)}</span></div>`).join('')}`).join('');
}

// ---- Details ----
function receiptDetail() {
    let r = (data.expenses || []).find(x => x.id === receiptOpen);
    if (!r)
        return `${backBtn()}<div class="panel muted" style="margin-top:12px">This receipt was deleted.</div>`;
    let pic = r.photo ? (r.isPdf ? `<div class="drop"><span class="thumb rthumb" style="width:80px;height:80px">${ic('pdf', 34)}</span><b>${esc(r.fileName || 'Receipt.pdf')}</b><button class="small alt" onclick="openReceiptPdf('${r.id}')">Open PDF</button></div>` : `<img class="rphoto" src="${photoUrl(r.photo)}" alt="Receipt photo, tap to zoom" onclick="viewReceiptPhoto('${r.id}')">`) : r.photoOff ? `<div class="drop"><span class="thumb rthumb">${ic('receipt', 24)}</span><b>Photo saved off the app</b><span class="muted">It’s in the receipts folder you saved at the end of the year.</span></div>` : `<div class="drop"><span class="thumb rthumb">${ic('camera', 24)}</span><b>No photo yet</b><span class="muted">Add one so you have proof for taxes.</span><button class="small" onclick="addReceiptPhoto('${r.id}')">${ic('camera', 16)} Add photo</button></div>`;
    let kind = expenseKind(r);
    return `${backBtn()}<h2 style="margin-top:12px">${esc(r.name)}</h2>${pic}<div class="panel" style="margin-top:14px"><div class="kv"><span>Date</span><b>${rDate(r.date)}</b></div><div class="kv"><span>Category</span><b>${catPill(r.category) || '—'}</b></div><div class="kv"><span>Before tax</span><b>${cash(r.pre ?? r.amount)}</b></div><div class="kv"><span>Tax</span><b>${cash(r.tax)}</b></div><div class="kv"><span>Total</span><b class="kvbig">${cash(r.amount)}</b></div>${r.pay ? `<div class="kv"><span>Paid with</span><b>${esc((RECEIPT_PAY.find(x => x[0] === r.pay) || [, r.pay])[1])}</b></div>` : ''}${r.marketId || r.fromMarket ? `<div class="kv"><span>Market</span><b style="text-align:right">${esc(expenseMarketName(r))}</b></div>` : ''}<p class="hint">${kind === 'material' ? 'Kept as proof. Yarn and supply costs already count in Material costs on each sale, so this isn’t taken off profit again.' : kind === 'proof' ? 'Kept as proof of the booth fee. The booth cost still comes from the market.' : 'Counted in Reports as an Other expense, taken off profit before tax.'}</p></div>${r.notes ? `<div class="panel"><h3>Notes</h3><p style="margin:0;white-space:pre-wrap">${esc(r.notes)}</p></div>` : ''}<div class="actions"><button class="alt grow" onclick="editExpense('${r.id}')">Edit</button><button class="danger grow" onclick="deleteExpense('${r.id}')">Delete</button></div>`;
}
function viewReceiptPhoto(rid) {
    let r = (data.expenses || []).find(x => x.id === rid);
    if (!r?.photo)
        return;
    let v = document.createElement('div');
    v.className = 'rviewer';
    v.setAttribute('role', 'dialog');
    v.setAttribute('aria-label', 'Receipt photo');
    v.innerHTML = `<div class="rvbar"><b>${esc(r.name)} · ${rDate(r.date)}</b><button class="iconbtn" aria-label="Close" onclick="this.closest('.rviewer').remove()">${ic('x', 20)}</button></div><div class="rvimg"><img src="${photoUrl(r.photo)}" alt="Receipt photo" onclick="this.classList.toggle('zoom')"></div><p class="rvhint">Tap the photo to zoom in or out.</p>`;
    document.body.appendChild(v);
    v.querySelector('button').focus();
}
function openReceiptPdf(rid) {
    let r = (data.expenses || []).find(x => x.id === rid), u = r && photoUrl(r.photo);
    if (!u || u === PHOTO_BLANK)
        return appAlert('The PDF is still loading. Try again in a moment.');
    let a = document.createElement('a');
    a.href = u;
    a.target = '_blank';
    a.rel = 'noopener';
    a.download = r.fileName || 'receipt.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
}
// The tappable photo spot on a receipt with no photo
function addReceiptPhoto(rid) {
    photoMenu(e => {
        let f = e.target.files?.[0], r = (data.expenses || []).find(x => x.id === rid);
        if (!f || !r)
            return;
        resizePhoto(f, src => {
            r.photo = src;
            r.isPdf = false;
            save();
            softRender();
            toast('Photo added.');
        }, 1400);
    });
}

// ---- Add / edit ----
function expenseForm() {
    let d = receiptDraft;
    if (!d)
        return `${backBtn()}`;
    let rate = taxRate(), mk = [...data.markets].sort((a, b) => String(marketSortDate(b)).localeCompare(String(marketSortDate(a))));
    return `${backBtn()}<h2 style="margin-top:12px">${d.id ? 'Edit receipt' : 'Add a receipt'}</h2><div class="drop" id="rDrop">${receiptDropInner()}</div><div class="panel" style="margin-top:14px"><label for="rStore" style="margin-top:0">Store or what it was for</label>${comboField({ id: 'rStore', value: d.name, placeholder: 'e.g. Michaels, Canada Post, gas', autocap: true, source: () => receiptStores().map(x => ({ label: x })) })}<label for="rDate">Date</label><input id="rDate" type="date" value="${esc(d.date)}"><div class="labelrow"><span class="lbl">Category</span><button type="button" class="linkbtn" onclick="openReceiptCats()">Edit categories</button></div><div class="chips" id="rCats">${receiptCatChips()}</div><p class="hint" id="rCatHint">${receiptCatHint(d.category)}</p><div class="grid keep2"><div><label for="rPre">Before tax ($)</label><input id="rPre" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" value="${d.pre === '' ? '' : num(d.pre)}" oninput="receiptTotal()"></div><div><label for="rTax">Tax ($)</label><input id="rTax" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" value="${d.tax === '' ? '' : num(d.tax)}" oninput="receiptTotal()"></div></div><div class="actions" style="margin-top:8px">${rate ? `<button type="button" class="small alt" onclick="$('rTax').value=round2(num($('rPre').value)*${num(rate)}/100).toFixed(2);receiptTotal()">Add ${num(rate)}% tax</button>` : ''}<button type="button" class="small alt" onclick="$('rTax').value='0.00';receiptTotal()">No tax</button></div><div class="totalbox"><span class="muted" style="font-weight:800">Total</span><b id="rTotal">${cash(num(d.pre) + num(d.tax))}</b></div><label>Paid with</label><div class="seg" id="rPay">${RECEIPT_PAY.map(([v, l]) => `<button type="button" class="${d.pay === v ? 'on' : ''}" aria-pressed="${d.pay === v}" onclick="receiptDraft.pay='${v}';document.querySelectorAll('#rPay button').forEach(b=>{b.classList.toggle('on',b===this);b.setAttribute('aria-pressed',b===this)})">${l}</button>`).join('')}</div><label for="rMarket">For a market? <span class="muted">(optional)</span></label><select id="rMarket" class="fancy"><option value="">Not for a specific market</option>${mk.map(m => `<option value="${m.id}" ${d.marketId === m.id ? 'selected' : ''}>${esc(m.name)}${marketSortDate(m) ? ' · ' + esc(new Date(marketSortDate(m) + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })) : ''}</option>`).join('')}</select><label for="rNotes">Notes <span class="muted">(optional)</span></label><textarea id="rNotes" rows="2" placeholder="e.g. Yarn for the Christmas gnome order">${esc(d.notes || '')}</textarea></div><div class="actions"><button class="grow" onclick="saveExpense()">${d.id ? 'Save changes' : 'Save receipt'}</button>${d.id ? `<button class="danger" onclick="deleteExpense('${d.id}')">Delete</button>` : ''}</div>`;
}
function receiptDropInner() {
    let d = receiptDraft;
    if (d.photo && d.isPdf)
        return `<span class="thumb rthumb" style="width:80px;height:80px">${ic('pdf', 34)}</span><b>${esc(d.fileName || 'Receipt.pdf')}</b>${receiptPickButtons(true)}`;
    if (d.photo)
        return `<img src="${photoUrl(d.photo)}" alt="Receipt photo">${receiptPickButtons(true)}`;
    if (d.photoOff)
        return `<b>Photo saved off the app</b><span class="muted">It’s in the receipts folder you saved at the end of the year.</span>`;
    return `<span class="thumb rthumb" style="width:64px;height:64px">${ic('camera', 28)}</span><b>Add a photo of the receipt</b><span class="muted">Optional. You can save it now and add the photo later.</span>${receiptPickButtons(false)}`;
}
function receiptPickButtons(has) {
    return `<div class="actions" style="justify-content:center;margin-top:4px"><button type="button" class="small" onclick="receiptPick('camera')">${ic('camera', 16)} ${has ? 'Retake' : 'Take photo'}</button><button type="button" class="small alt" onclick="receiptPick('files')">${ic('upload', 16)} Upload photo or PDF</button>${has ? `<button type="button" class="small danger" onclick="receiptDraft.photo='';receiptDraft.isPdf=false;$('rDrop').innerHTML=receiptDropInner()">Remove</button>` : ''}</div>`;
}
function receiptPick(src) {
    let i = document.createElement('input');
    i.type = 'file';
    i.className = 'hidden';
    i.accept = src === 'camera' ? 'image/*' : 'image/*,application/pdf,.pdf';
    if (src === 'camera')
        i.setAttribute('capture', 'environment');
    i.addEventListener('change', () => {
        let f = i.files?.[0];
        i.remove();
        if (!f || !receiptDraft)
            return;
        if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
            if (f.size > 15e6)
                return appAlert('That PDF is too big (over 15 MB). Try a photo of the receipt instead.');
            receiptDraft.photo = fileRefFor(new Blob([f], { type: 'application/pdf' }));
            receiptDraft.isPdf = true;
            receiptDraft.fileName = f.name;
            $('rDrop').innerHTML = receiptDropInner();
            return;
        }
        if (f.type && !f.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif|gif)$/i.test(f.name))
            return appAlert('Choose a photo or a PDF of the receipt.');
        resizePhoto(f, url => {
            receiptDraft.photo = url;
            receiptDraft.isPdf = false;
            receiptDraft.fileName = '';
            let el = $('rDrop');
            if (el)
                el.innerHTML = receiptDropInner();
        }, 1400);
    });
    document.body.appendChild(i);
    i.click();
}
function receiptStores() {
    let seen = new Map();
    for (let x of [...receiptsAll().map(r => r.name), ...savedStores()]) {
        let k = normName(x).toLowerCase();
        if (k && !seen.has(k))
            seen.set(k, normName(x));
    }
    return [...seen.values()];
}
function receiptCatChips() {
    let cur = receiptDraft?.category || '';
    return expenseCats().map(c => `<button type="button" class="chipbtn ${cur === c ? 'on' : ''}" aria-pressed="${cur === c}" data-cat="${esc(c)}" onclick="pickReceiptCat(this.dataset.cat)">${esc(c)}</button>`).join('') + `<button type="button" class="chipbtn addchip" onclick="addReceiptCat()">+ New category</button>`;
}
function pickReceiptCat(c) {
    receiptDraft.category = receiptDraft.category === c ? '' : c;
    $('rCats').innerHTML = receiptCatChips();
    $('rCatHint').textContent = receiptCatHint(receiptDraft.category);
}
function receiptCatHint(c) {
    let k = expenseKind({ category: c });
    return !c ? 'Pick one so Reports can group your spending.' : k === 'material' ? 'Kept as proof. Yarn and supply costs already count in Material costs on each sale, so this isn’t taken off profit again.' : k === 'proof' ? 'Kept as proof of the booth fee. The booth cost still comes from the market.' : 'Counted as an Other expense, taken off profit before tax.';
}
async function addReceiptCat() {
    openModal(`<div class="row"><h2 style="margin:0">New category</h2>${closeX()}</div><label for="rcName">Category name</label><input id="rcName" placeholder="e.g. Classes, Printing" autocapitalize="words" onkeydown="if(event.key==='Enter')saveReceiptCat()"><p class="hint">New categories count as Other expenses, taken off profit before tax.</p><div class="actions"><button onclick="saveReceiptCat()">Add category</button></div>`);
    setTimeout(() => $('rcName')?.focus(), 60);
}
function saveReceiptCat() {
    let n = normName($('rcName').value);
    if (!n)
        return needField('rcName', 'Enter a category name.');
    let dup = expenseCats().find(c => c.toLowerCase() === n.toLowerCase());
    if (!dup)
        data.expenseCats.push(n);
    save();
    closeModal();
    if (receiptDraft && $('rCats')) {
        receiptDraft.category = '';
        pickReceiptCat(dup || n);
    }
    else if (screen === 'receipts')
        render();
}
function openReceiptCats() {
    let own = data.expenseCats || [];
    openModal(`<div class="row"><h2 style="margin:0">Receipt categories</h2>${closeX()}</div><p class="muted">The built-in categories can’t be removed. Categories you added:</p>${own.length ? own.map((c, i) => `<div class="row entry" style="margin:6px 0"><span>${esc(c)}</span><button class="small danger" onclick="removeReceiptCat(${i})">Remove</button></div>`).join('') : '<p class="hint">None yet.</p>'}<div class="actions"><button onclick="addReceiptCat()">+ New category</button></div>`);
}
async function removeReceiptCat(i) {
    let c = data.expenseCats[i];
    if (!c)
        return;
    let n = (data.expenses || []).filter(e => e.category === c).length;
    if (!await appConfirm(`Remove the category “${c}”?${n ? `\n\n${n} receipt${n > 1 ? 's' : ''} will move to Other.` : ''}`, { ok: 'Remove', danger: true }))
        return;
    data.expenseCats.splice(i, 1);
    for (let e of data.expenses || [])
        if (e.category === c)
            e.category = 'Other';
    if (receiptDraft?.category === c)
        receiptDraft.category = 'Other';
    save();
    if ($('rCats')) {
        $('rCats').innerHTML = receiptCatChips();
        $('rCatHint').textContent = receiptCatHint(receiptDraft.category);
    }
    openReceiptCats();
}
function receiptTotal() {
    let t = $('rTotal');
    if (t)
        t.textContent = cash(num($('rPre').value) + num($('rTax').value));
}
function saveExpense() {
    let d = receiptDraft, name = normName($('rStore').value), pv = $('rPre').value.trim(), tv = $('rTax').value.trim(), date = $('rDate').value || new Date().toISOString().slice(0, 10);
    if (!name)
        return needField('rStore', 'Enter the store, or what the receipt was for.');
    if (pv === '' || !(Number(pv) >= 0))
        return needField('rPre', 'Enter the amount before tax.');
    if (tv !== '' && !(Number(tv) >= 0))
        return needField('rTax', 'Enter the tax on the receipt, or 0.');
    data.expenses ||= [];
    let e = d.id ? data.expenses.find(x => x.id === d.id) : null;
    if (!e) {
        if (yearEndBlocked())
            return yearEndBlockedNotice();
        e = { id: id() };
        data.expenses.push(e);
    }
    let pre = round2(num(pv)), tax = round2(num(tv));
    Object.assign(e, { name, date, category: d.category || '', pre, tax, amount: round2(pre + tax), entered: round2(pre + tax), pay: d.pay || '', marketId: $('rMarket').value || null, notes: $('rNotes').value.trim(), photo: d.photo || '', isPdf: !!d.isPdf, fileName: d.fileName || '' });
    if (d.photo)
        delete e.photoOff;
    delete e.taxOverride;
    if (e.marketId)
        delete e.fromMarket;
    receiptDraft = null;
    save();
    let fromDetail = navStack[navStack.length - 1]?.screen === 'receiptDetail';
    if (fromDetail)
        goBack();
    else {
        // Show the saved receipt in place of the form
        screen = 'receiptDetail';
        receiptOpen = e.id;
        render();
        scrollTo(0, 0);
    }
    toast('Receipt saved.');
}
async function deleteExpense(eid) {
    let e = (data.expenses || []).find(x => x.id === eid);
    if (!e || !await appConfirm(`Delete this receipt (${e.name}, ${cash(e.amount)}) and its photo? This can’t be undone.`, { ok: 'Delete', danger: true }))
        return;
    data.expenses = data.expenses.filter(x => x.id !== eid);
    receiptDraft = null;
    save();
    // Leave the form and the details screen together
    goBackSteps(screen === 'expenseForm' && navStack[navStack.length - 1]?.screen === 'receiptDetail' ? 2 : 1);
    toast('Receipt deleted.');
}
// Go back several screens at once (e.g. from Edit receipt past the deleted receipt's details).
function goBackSteps(n) {
    n = Math.min(n, navStack.length);
    if (!n)
        return view('home');
    navStack.splice(navStack.length - n + 1, n - 1);
    history.go(-n);
}
