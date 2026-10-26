// Shared screen pieces: pop-ups, notices, search-as-you-type boxes, photos, help buttons, labels
// Part of the Crochet Studio app. Files load in the order listed in index.html.

function thumb(src, style = '') {
    return src ? `<img class="thumb" src="${photoUrl(src)}" alt="" style="${style}">` : `<div class="thumb thumb-empty" style="${style}" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M6 7c4 2 6 6 6 13M18 7c-4 2-6 6-6 13M4.5 12h15"/></svg></div>`;
}
const combos = {};
function comboField(o) {
    combos[o.id] = o;
    return `<div class="combo"><input id="${o.id}" autocomplete="off" ${o.autocap ? 'autocapitalize="words"' : ''} placeholder="${esc(o.placeholder || '')}" value="${esc(o.value || '')}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${o.id}List" oninput="comboOpen('${o.id}')" onfocus="comboOpen('${o.id}')" onkeydown="comboKey(event,'${o.id}')" onblur="comboBlur('${o.id}')"><div class="combo-list hidden" id="${o.id}List" role="listbox"></div></div>`;
}
function comboMatches(o, q) {
    let ql = q.toLowerCase(), words = ql.split(/\s+/).filter(Boolean);
    let hits = o.source().filter(it => {
        let hay = (it.label + ' ' + (it.search || '')).toLowerCase();
        return words.every(w => hay.includes(w));
    });
    hits.sort((a, b) => (a.label.toLowerCase().startsWith(ql) ? 0 : 1) - (b.label.toLowerCase().startsWith(ql) ? 0 : 1) || a.label.localeCompare(b.label));
    return hits.slice(0, 8);
}
function comboOpen(fid) {
    let o = combos[fid], inp = $(fid), list = $(fid + 'List');
    if (!o || !inp || !list)
        return;
    let q = inp.value.trim();
    if (o.currentLabel && q && q === o.currentLabel())
        q = '';
    o.items = comboMatches(o, q);
    let exact = o.items.some(it => it.label.toLowerCase() === q.toLowerCase());
    let html = o.items.map((it, i) => `<button type="button" role="option" onmousedown="event.preventDefault()" onclick="comboPick('${fid}',${i})">${it.photo ? `<img src="${photoUrl(it.photo)}" alt="">` : ''}<span class="grow"><span class="combo-main">${esc(it.label)}</span>${it.sub ? `<span class="combo-sub">${esc(it.sub)}</span>` : ''}</span></button>`).join('');
    if (o.onNew && q && !exact)
        html += `<button type="button" class="combo-new" onmousedown="event.preventDefault()" onclick="comboNew('${fid}')">+ Add “${esc(q)}” as new</button>`;
    if (!html && o.emptyText && document.activeElement === inp)
        html = `<div class="combo-empty">${esc(o.emptyText)}</div>`;
    list.innerHTML = html;
    list.classList.toggle('hidden', !html);
    inp.setAttribute('aria-expanded', String(!!html));
}
function comboPick(fid, i) {
    let o = combos[fid], it = o?.items?.[i];
    if (!it)
        return;
    $(fid).value = it.value ?? it.label;
    comboClose(fid);
    o.onPick?.(it);
}
function comboNew(fid) {
    let o = combos[fid], q = $(fid).value.trim();
    comboClose(fid);
    o?.onNew?.(q);
}
function comboClose(fid) {
    $(fid + 'List')?.classList.add('hidden');
    $(fid)?.setAttribute('aria-expanded', 'false');
}
function comboBlur(fid) {
    setTimeout(() => {
        comboClose(fid);
        let o = combos[fid], inp = $(fid);
        if (o?.onCommit && inp && document.activeElement !== inp)
            o.onCommit(inp.value.trim());
    }, 180);
}
function comboKey(e, fid) {
    if (e.key === 'Escape')
        return comboClose(fid);
    if (e.key === 'Enter') {
        let list = $(fid + 'List'), o = combos[fid];
        if (list && !list.classList.contains('hidden') && o?.items?.length) {
            e.preventDefault();
            comboPick(fid, 0);
        }
    }
}
function photoGallery(kind) {
    let pics = kind === 'product' ? productPhotos : kind === 'material' ? materialPhotos : quickPhotos;
    return `<div class="photo-grid">${pics.map((src, i) => `<div class="photo-card"><img src="${photoUrl(src)}" alt="Photo ${i + 1}"><div class="actions"><button type="button" class="alt small" onclick="coverPhoto('${kind}',${i})">${i === 0 ? 'Cover ✓' : 'Make cover'}</button><button type="button" class="danger small" onclick="removePhoto('${kind}',${i})">Delete</button></div></div>`).join('')}</div>`;
}
function photoArray(kind) {
    return kind === 'product' ? productPhotos : kind === 'material' ? materialPhotos : quickPhotos;
}
function refreshPhotos(kind) {
    let e = $(kind === 'product' ? 'photoPreview' : kind === 'material' ? 'materialPhotoPreview' : 'quickPhotoPreview');
    if (e)
        e.innerHTML = photoGallery(kind);
}
function coverPhoto(kind, i) {
    let a = photoArray(kind);
    a.unshift(a.splice(i, 1)[0]);
    refreshPhotos(kind);
}
function removePhoto(kind, i) {
    photoArray(kind).splice(i, 1);
    refreshPhotos(kind);
}
function stepNumber(field, delta) {
    let e = $(field);
    e.value = Math.max(0, Math.floor(num(e.value) + delta));
}
// ---- Photo compression: every photo is shrunk to the size it's shown at and saved as a small JPEG ----
// max = longest side in pixels; budget = most bytes a photo may take (quality steps down, then size, until it fits).
const PHOTO_BUDGET = { 480: 70e3, 600: 90e3, 1400: 320e3, 2400: 900e3 };
async function compressImage(file, max = 480, budget) {
    budget ||= PHOTO_BUDGET[max] || max * max * .35;
    let img;
    try {
        img = await createImageBitmap(file, { imageOrientation: 'from-image' });
    }
    catch {
        img = await new Promise((res, rej) => {
            let i = new Image(), u = URL.createObjectURL(file);
            i.onload = () => {
                URL.revokeObjectURL(u);
                res(i);
            };
            i.onerror = () => {
                URL.revokeObjectURL(u);
                rej(new Error('This photo couldn’t be opened. Try a JPG or PNG.'));
            };
            i.src = u;
        });
    }
    let w0 = img.width, h0 = img.height, scale = Math.min(1, max / Math.max(w0, h0)), blob = null;
    for (let round = 0; round < 4; round++) {
        let c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w0 * scale));
        c.height = Math.max(1, Math.round(h0 * scale));
        let g = c.getContext('2d');
        g.fillStyle = '#fff'; // see-through PNGs get a white background instead of black
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        for (let q of [.82, .72, .62, .52]) {
            blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
            if (blob && blob.size <= budget)
                break;
        }
        c.width = c.height = 0;
        if (blob && blob.size <= budget)
            break;
        scale *= .8;
    }
    img.close?.();
    return blob;
}
function resizePhoto(file, done, max = 480) {
    if (!file)
        return;
    compressImage(file, max).then(b => b && blobToDataUrl(b)).then(u => u && done(u)).catch(e => appAlert(e?.message || 'This photo couldn’t be added.'));
}
// ===== Styled pop-ups (replace the phone's plain alert / confirm boxes) =====
let dlgDone = null;
function appDialog({ title = '', message = '', ok = 'OK', cancel = null, danger = false }) {
    return new Promise(res => {
        dlgDone?.(false);
        let o = document.createElement('div');
        o.id = 'appDialog';
        o.className = 'modal dialog';
        o.innerHTML = `<div class="panel modal-card dialog-card" role="${cancel ? 'alertdialog' : 'dialog'}" aria-modal="true" aria-describedby="dlgMsg">${title ? `<h3>${esc(title)}</h3>` : ''}<p id="dlgMsg" class="dlg-msg">${esc(message)}</p><div class="actions dlg-actions">${cancel ? `<button class="alt" data-v="0">${esc(cancel)}</button>` : ''}<button class="${danger ? 'dangerfill' : ''}" data-v="1">${esc(ok)}</button></div></div>`;
        const key = e => {
            if (e.key === 'Escape') {
                e.preventDefault();
                finish(false);
            }
        };
        const finish = v => {
            if (dlgDone !== finish)
                return;
            dlgDone = null;
            document.removeEventListener('keydown', key, true);
            o.remove();
            res(v);
        };
        dlgDone = finish;
        o.addEventListener('click', e => {
            let b = e.target.closest('button[data-v]');
            if (b)
                finish(b.dataset.v === '1');
            else if (e.target === o && cancel)
                finish(false);
        });
        document.addEventListener('keydown', key, true);
        document.body.appendChild(o);
        setTimeout(() => o.querySelector('button[data-v="1"]')?.focus(), 30);
    });
}
// A pop-up with several choices. buttons: [[value, label, class]]. Resolves to the value (null if closed).
function appChoice(message, buttons, title = '') {
    return new Promise(res => {
        dlgDone?.(false);
        let o = document.createElement('div');
        o.id = 'appDialog';
        o.className = 'modal dialog';
        o.innerHTML = `<div class="panel modal-card dialog-card" role="alertdialog" aria-modal="true" aria-describedby="dlgMsg">${title ? `<h3>${esc(title)}</h3>` : ''}<p id="dlgMsg" class="dlg-msg">${esc(message)}</p><div class="actions dlg-actions">${buttons.map(([v, l, c]) => `<button class="${c || ''}" data-c="${esc(v)}">${esc(l)}</button>`).join('')}</div></div>`;
        const key = e => {
            if (e.key === 'Escape') {
                e.preventDefault();
                finish(null);
            }
        };
        const finish = v => {
            if (dlgDone !== finish)
                return;
            dlgDone = null;
            document.removeEventListener('keydown', key, true);
            o.remove();
            res(v);
        };
        dlgDone = finish;
        o.addEventListener('click', e => {
            let b = e.target.closest('button[data-c]');
            if (b)
                finish(b.dataset.c);
            else if (e.target === o)
                finish(null);
        });
        document.addEventListener('keydown', key, true);
        document.body.appendChild(o);
        setTimeout(() => o.querySelector('.dlg-actions button:last-child')?.focus(), 30);
    });
}
function needField(fid, msg) {
    let e = $(fid);
    if (e) {
        e.classList.add('invalid');
        e.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => e.classList.remove('invalid'), 5000);
    }
    return appAlert(msg).then(() => e?.focus());
}
function appAlert(message, title) {
    return appDialog({ message: String(message ?? ''), title: title || '', ok: 'OK' });
}
function appConfirm(message, opts = {}) {
    let m = String(message ?? ''), first = m.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, ''), ok = opts.ok || ({ delete: 'Delete', remove: 'Remove', reopen: 'Reopen', restore: 'Restore', mark: 'Mark completed' }[first]) || 'Yes', danger = opts.danger ?? ['delete', 'remove'].includes(first);
    return appDialog({ message: m, ok, cancel: opts.cancel || 'Cancel', danger });
}
// ===== Small UI helpers =====
let flashTimer = null;
function flash(t) {
    notice = t;
    let e = $('notice');
    if (!e) {
        $('app').insertAdjacentHTML('afterbegin', '<div id="notice" class="notice" role="status"></div>');
        e = $('notice');
    }
    e.textContent = t;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
        if (notice === t) {
            notice = '';
            $('notice')?.remove();
        }
    }, 3500);
}
function openModal(html) {
    closeModal();
    let o = document.createElement('div');
    o.id = 'modal';
    o.className = 'modal';
    o.innerHTML = `<div class="panel modal-card" role="dialog" aria-modal="true">${html}</div>`;
    o.addEventListener('mousedown', e => {
        if (e.target === o)
            closeModal();
    });
    document.body.appendChild(o);
}
function closeModal() {
    $('modal')?.remove();
}
function closeX() {
    return `<button class="iconbtn" aria-label="Close" onclick="closeModal()">${ic('x', 18)}</button>`;
}
function linkLabels(root) {
    for (let l of (root || document).querySelectorAll('label:not([for])')) {
        if (l.querySelector('input,select,textarea'))
            continue;
        let n = l.nextElementSibling;
        if (n && !/^(INPUT|SELECT|TEXTAREA)$/.test(n.tagName))
            n = n.querySelector?.('input:not([type=hidden]),select,textarea');
        if (n && n.id)
            l.htmlFor = n.id;
    }
}
// ===== v22: tap empty photo squares, product sort, help buttons, logo goes Home =====
let photoTarget = null;
function photoSlot(src, style, kind, id, label, small) {
    if (src)
        return thumb(src, style);
    const act = `pickPhotoFor('${kind}','${id}')`;
    return `<span role="button" tabindex="0" class="thumb thumb-empty thumb-add${small ? ' tiny' : ''}" style="${style}" aria-label="Add a photo of ${esc(label)}" title="Add a photo" onclick="event.stopPropagation();${act}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();${act}}">${ic('camera', small ? 18 : 22)}${small ? '' : '<small>Add photo</small>'}</span>`;
}
function pickPhotoFor(kind, id) {
    photoTarget = { kind, id };
    photoMenu(slotPhotoChosen);
}
function slotPhotoChosen(e) {
    let f = e.target.files?.[0], t = photoTarget;
    photoTarget = null;
    if (!f || !t)
        return;
    if (f.type && !f.type.startsWith('image/'))
        return appAlert('Choose a photo (JPG or PNG).');
    resizePhoto(f, src => {
        let list = t.kind === 'product' ? [product(t.id)] : t.kind === 'link' ? [patternLink(t.id)] : t.kind === 'group' ? (matGroupInfo[Number(t.id)]?.items || []).filter(m => !(m.photo || m.photos?.length)) : [material(t.id)];
        list = list.filter(Boolean);
        if (!list.length)
            return;
        for (let o of list) {
            o.photos = [src, ...(o.photos || [])];
            o.photo = src;
        }
        save();
        softRender();
        toast('Photo added.');
    }, t.kind === 'product' ? 600 : 480);
}
const HELP = {
    stockModes: ['Material stock', 'Pricing only: materials are only used to work out your suggested prices. No stock is counted.\n\nPricing and manual stock: each material shows how much is left, with −1 and +1 buttons. One tap is one full skein, bag or pack. You keep it up to date yourself.\n\nPricing and automatic stock: the same, and adding finished products (+1, or + Add quantity) also takes the materials they use out of your stock.\n\nExample: a Small bee uses 40 g of yarn, 80 g of stuffing and 1 pair of eyes. Add 2 Small bees and 80 g of yarn, 160 g of stuffing and 2 pairs of eyes are taken out.'],
    stockOverride: ['Override stock setting', 'Tick this to give just this material its own stock setting, for example to count your yarn but not your stuffing.'],
    mult: ['Default material multiplier', 'Only used when the pricing method is Materials × multiplier.\n\nThe suggested price is your material cost times this number. Example: $5 of materials × 3 = $15. Labour isn’t added with this method.'],
    productTax: ['Product tax', 'Choose how sales tax works on the prices you sell at.\n\nAdd tax to sale price: your price is before tax. Tax is added at checkout. A $4.00 item at 10% charges $4.40.\n\nTax already included in sale price: your price already has tax in it. Checkout charges your price and shows the tax inside it. A $4.40 item at 10% shows $4.00 + $0.40 tax = $4.40.\n\nNeither: no tax is added or tracked on your sales. Choose this if you don’t charge sales tax. Reports won’t show sales tax collected.'],
    materialTax: ['Material & expense tax', 'Choose how tax works on the prices you enter for materials and expenses (gas, displays, fees...). Any material or expense can use its own setting with Override tax settings.\n\nInputted pricing includes tax: the prices you typed in already have tax in them (like a receipt total). The app works out the tax part for you.\n\nAdd tax to inputted pricing: the prices you typed in are before tax (like a shelf price). The app adds tax on top.\n\nNeither: you don’t pay tax on materials and expenses, or you don’t want to track it. Reports won’t show tax paid on them.\n\nSuggested prices and markup use your material cost before tax, so you’re never charging markup on tax.'],
    notClaiming: ['Not claiming tax on materials and expenses', 'Tick this if you can’t get back the tax you pay on materials and expenses (for example, you’re not registered to collect sales tax, or you don’t claim it at tax time).\n\nWhen ticked, the tax you paid counts as part of your costs: material costs (so suggested prices and markup cover it) and expenses (so profit counts it). When unticked, the app treats that tax as money you’ll get back and leaves it out of your costs.\n\nEither way, Reports still show how much tax you paid on materials and expenses.'],
    taxOverride: ['Override tax settings', 'Tick this to give just this item its own tax option and rate, for example tax-free yarn, something bought in another province or state, or a product you price differently.\n\nWhatever you choose here is used for this item only. Changing the main Tax settings later won’t change it.'],
    markup: ['Default markup', 'Only used when the pricing method is Materials with markup + labour.\n\nThe suggested price is your material cost plus this percentage, plus your hourly labour. Example: $5 of materials with a 50% markup = $7.50, then labour is added.']
};
function showHelp(k) {
    let h = HELP[k];
    if (h)
        appDialog({ title: h[0], message: h[1], ok: 'Got it' });
}
function helpBtn(k) {
    return `<button type="button" class="helpq" aria-label="What is this?" onclick="event.preventDefault();event.stopPropagation();showHelp('${k}')">?</button>`;
}

// ---- Per-item tax override (products, materials, expenses) ----
function taxOverrideField(prefix, item, kind, onchange = '') {
    let o = item?.taxOverride, on = !!o?.on, opts = kind === 'product' ? PRODUCT_TAX : MATERIAL_TAX, main = kind === 'product' ? data.settings.productTax : data.settings.materialTax, mainLabel = (opts.find(x => x[0] === main) || opts[opts.length - 1])[1];
    return `<div class="taxov"><div class="labelrow" style="margin:0"><label class="check" style="margin:0"><input type="checkbox" id="${prefix}TaxOn" ${on ? 'checked' : ''} onchange="$('${prefix}TaxBox').classList.toggle('hidden',!this.checked);$('${prefix}TaxHint').classList.toggle('hidden',this.checked);${onchange}"> Override tax settings</label>${helpBtn('taxOverride')}</div><div id="${prefix}TaxHint" class="hint ${on ? 'hidden' : ''}" style="margin-top:4px">Following your Tax settings: ${esc(mainLabel)}${main === 'none' ? '' : ` · ${num(taxRate())}%`}</div><div id="${prefix}TaxBox" class="grid2 ${on ? '' : 'hidden'}"><div><label for="${prefix}TaxMode">Tax option</label>${taxSelect(prefix + 'TaxMode', opts, on ? o.mode : main, onchange ? `onchange="${onchange}"` : '')}</div><div><label for="${prefix}TaxRate">Rate (%)</label><input id="${prefix}TaxRate" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${on ? num(o.rate) : num(taxRate())}" ${onchange ? `oninput="${onchange}"` : ''}></div></div></div>`;
}
// What the override boxes say now (null = follow the main settings).
function readTaxOverride(prefix) {
    if (!$(prefix + 'TaxOn')?.checked)
        return null;
    return { on: true, mode: $(prefix + 'TaxMode').value, rate: num($(prefix + 'TaxRate').value) };
}
function badTaxOverride(prefix) {
    if (!$(prefix + 'TaxOn')?.checked)
        return false;
    let v = $(prefix + 'TaxRate').value.trim(), r = Number(v);
    return v === '' || !(r >= 0 && r <= 100);
}
// ---- Add a photo: our own menu (newer Android otherwise jumps straight to the gallery) ----
let photoMenuDone = null;
function photoMenu(onFiles, multiple = false) {
    photoMenuDone = { onFiles, multiple };
    openModal(`<div class="row"><h2 style="margin:0">Add a photo</h2>${closeX()}</div><div class="photomenu"><button class="alt" onclick="photoFrom('camera')">${ic('camera', 20)} Take photo</button><button class="alt" onclick="photoFrom('gallery')">${ic('folder', 20)} Choose from gallery</button><button class="alt" onclick="photoFrom('files')">${ic('download', 20)} Browse files</button></div>`);
}
// keepJob: used from inside another box (e.g. Edit link) so that box stays open
function photoFrom(src, keepJob) {
    let job = keepJob || photoMenuDone;
    if (!keepJob)
        closeModal();
    if (!job)
        return;
    let i = document.createElement('input');
    i.type = 'file';
    i.className = 'hidden';
    i.multiple = job.multiple && src !== 'camera';
    // Camera: opens the camera. Gallery: photos only. Files: any file, so the phone shows its file browser; non-images are skipped.
    if (src === 'camera') {
        i.accept = 'image/*';
        i.setAttribute('capture', 'environment');
    }
    else if (src === 'gallery')
        i.accept = 'image/*';
    i.addEventListener('change', () => {
        let files = [...(i.files || [])], pics = files.filter(f => (f.type || '').startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(f.name));
        i.remove();
        if (files.length && !pics.length)
            return appAlert('That file isn’t a photo. Choose a JPG, PNG or other image file.');
        if (pics.length)
            job.onFiles({ target: { files: pics, value: '' } });
    });
    document.body.appendChild(i);
    i.click();
}

// ---- Swipe a card left to show Delete; tapping Delete is the confirmation ----
ICONS.trash = '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/>';
const SWIPE_W = 96;
let swipeNow = null;
function swipeWrap(card, delAction, label) {
    return `<div class="swipe"><button type="button" class="swipedel" tabindex="-1" aria-label="Delete ${esc(label)}" onclick="${delAction}">${ic('trash', 18)} Delete</button>${card}</div>`;
}
function closeSwipes(except) {
    document.querySelectorAll('.swipe.open').forEach(s => {
        if (s === except)
            return;
        s.classList.remove('open');
        let c = s.querySelector(':scope > .panel');
        if (c)
            c.style.transform = '';
    });
}
function swipeDown(e) {
    if (e.target.closest?.('.swipedel'))
        return;
    let card = e.target.closest?.('.swipe > .panel');
    if (!card || e.button > 0 || e.target.closest('input,select,textarea'))
        return closeSwipes();
    let wrap = card.parentElement;
    closeSwipes(wrap);
    swipeNow = { card, wrap, id: e.pointerId, x0: e.clientX, y0: e.clientY, base: wrap.classList.contains('open') ? -SWIPE_W : 0, drag: false, off: 0 };
}
function swipeMove(e) {
    let s = swipeNow;
    if (!s || e.pointerId !== s.id)
        return;
    let dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    if (!s.drag) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx))
            return (swipeNow = null);
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2)
            return;
        s.drag = true;
        s.card.style.transition = 'none';
        try {
            s.card.setPointerCapture(e.pointerId);
        }
        catch {
        }
    }
    s.off = Math.max(-SWIPE_W - 30, Math.min(0, s.base + dx));
    s.card.style.transform = `translateX(${s.off}px)`;
}
function swipeUp(e) {
    let s = swipeNow;
    swipeNow = null;
    if (!s || e.pointerId !== s.id)
        return;
    s.card.style.transition = '';
    if (s.drag) {
        let open = s.off < -SWIPE_W / 2;
        s.wrap.classList.toggle('open', open);
        s.card.style.transform = open ? `translateX(${-SWIPE_W}px)` : '';
        s.card.dataset.swiped = String(Date.now());
    }
    else if (s.base) {
        // A tap on an open card closes it instead of pressing its buttons.
        s.wrap.classList.remove('open');
        s.card.style.transform = '';
        s.card.dataset.swiped = String(Date.now());
    }
}
function swipeClick(e) {
    let card = e.target.closest?.('.swipe > .panel');
    if (card && Date.now() - Number(card.dataset.swiped || 0) < 400) {
        e.preventDefault();
        e.stopPropagation();
    }
}

ICONS.chevr = '<path d="m9 6 6 6-6 6"/>';
// ---- App-styled drop-downs: <select class="fancy"> opens a sheet in the app's look instead of the phone's system list ----
let fancySel = null;
const CHEV = '<svg class="selchev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
function fancyTitle(sel) {
    let lab = sel.id && document.querySelector(`label[for="${sel.id}"]`);
    return (lab?.textContent || sel.getAttribute('aria-label') || 'Choose').replace(/\s*\(optional\)\s*/i, '').trim();
}
function syncFancy(sel) {
    let b = sel.nextElementSibling;
    if (!b?.classList.contains('selbtn'))
        return;
    let o = sel.options[sel.selectedIndex], txt = o ? o.textContent : '', th = o?.dataset.thumb || '';
    if (b.dataset.txt === txt + '|' + th.length)
        return;
    b.dataset.txt = txt + '|' + th.length;
    b.innerHTML = `${th ? `<img class="selthumb" src="${th}" alt="">` : ''}<span class="sellabel">${esc(txt)}</span>${CHEV}`;
    b.setAttribute('aria-label', fancyTitle(sel) + ': ' + txt);
}
function enhanceSelect(sel) {
    if (sel.dataset.fancy)
        return syncFancy(sel);
    sel.dataset.fancy = '1';
    let b = document.createElement('button');
    b.type = 'button';
    b.className = 'selbtn';
    b.setAttribute('aria-haspopup', 'dialog');
    b.style.cssText = sel.style.cssText;
    b.addEventListener('click', () => openFancy(sel));
    sel.after(b);
    sel.classList.add('selhide');
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');
    syncFancy(sel);
}
function openFancy(sel) {
    fancySel = sel;
    let i = -1, row = o => {
        i++;
        let on = i === sel.selectedIndex, th = o.dataset.thumb;
        return `<button type="button" class="selopt ${on ? 'on' : ''}" ${o.disabled ? 'disabled' : ''} aria-pressed="${on}" onclick="pickFancy(${i})">${th !== undefined ? (th ? `<img class="selthumb" src="${th}" alt="">` : '<span class="selthumb none" aria-hidden="true"></span>') : ''}<span class="grow">${esc(o.textContent)}</span>${on ? ic('check', 18) : ''}</button>`;
    };
    let body = [...sel.children].map(c => c.tagName === 'OPTGROUP' ? `<div class="selgroup">${esc(c.label)}</div>${[...c.children].map(row).join('')}` : row(c)).join('');
    openModal(`<div class="row"><h2 style="margin:0">${esc(fancyTitle(sel))}</h2>${closeX()}</div><div class="sellist">${body}</div>`);
    setTimeout(() => document.querySelector('.sellist .selopt.on')?.scrollIntoView({ block: 'center' }), 30);
}
function pickFancy(i) {
    let sel = fancySel;
    fancySel = null;
    closeModal();
    if (!sel || !sel.isConnected)
        return;
    if (sel.selectedIndex !== i) {
        sel.selectedIndex = i;
        syncFancy(sel);
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
}
// ---- "More to see" hint on rows that scroll sideways (material categories) ----
function updateScrollHint(el) {
    let w = el.parentElement;
    if (!w?.classList.contains('tabwrap'))
        return;
    w.classList.toggle('more-right', el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    w.classList.toggle('more-left', el.scrollLeft > 4);
}
function enhanceScrollRow(el) {
    if (!el.dataset.hint) {
        el.dataset.hint = '1';
        el.addEventListener('scroll', () => updateScrollHint(el), { passive: true });
        el.querySelector('button:not(.alt)')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    updateScrollHint(el);
}
// A sideways-scrolling row of buttons with arrows on both ends when there's more to see.
function tabRow(inner, label = 'categories') {
    return `<div class="tabwrap"><div class="tabs">${inner}</div><button type="button" class="morearrow left" aria-label="Show earlier ${label}" onclick="scrollTabsMore(this,-1)">${ic('back', 16)}</button><button type="button" class="morearrow right" aria-label="Show more ${label}" onclick="scrollTabsMore(this,1)">${ic('chevr', 16)}</button></div>`;
}
// Moves along at most three buttons per tap, so long lists don't skip past anything.
function scrollTabsMore(btn, dir = 1) {
    let t = btn.parentElement?.querySelector('.tabs');
    if (!t)
        return;
    let bs = [...t.querySelectorAll('button')], pad = 50, view = t.clientWidth, x = t.scrollLeft, target;
    if (dir > 0) {
        let i = bs.findIndex(b => b.offsetLeft + b.offsetWidth > x + view - pad);
        if (i < 0)
            return;
        let last = bs[Math.min(i + 2, bs.length - 1)];
        target = last.offsetLeft + last.offsetWidth - view + pad;
    }
    else {
        let j = -1;
        bs.forEach((b, k) => {
            if (b.offsetLeft < x + pad)
                j = k;
        });
        if (j < 0)
            return;
        target = bs[Math.max(j - 2, 0)].offsetLeft - pad;
    }
    t.scrollTo({ left: Math.max(0, Math.min(target, t.scrollWidth - view)), behavior: 'smooth' });
}
function enhanceUi() {
    document.querySelectorAll('select.fancy').forEach(enhanceSelect);
    document.querySelectorAll('.tabwrap > .tabs').forEach(enhanceScrollRow);
}
let enhanceQueued = false;
new MutationObserver(() => {
    if (enhanceQueued)
        return;
    enhanceQueued = true;
    requestAnimationFrame(() => {
        enhanceQueued = false;
        enhanceUi();
    });
}).observe(document.body, { childList: true, subtree: true });
addEventListener('resize', () => document.querySelectorAll('.tabwrap > .tabs').forEach(updateScrollHint));
