// Shared screen pieces: pop-ups, notices, search-as-you-type boxes, photos, help buttons, labels
// Part of the Crochet Studio app. Files load in the order listed in index.html.

function thumb(src, style = '') {
    return src ? `<img class="thumb" src="${src}" alt="" style="${style}">` : `<div class="thumb thumb-empty" style="${style}" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M6 7c4 2 6 6 6 13M18 7c-4 2-6 6-6 13M4.5 12h15"/></svg></div>`;
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
    let html = o.items.map((it, i) => `<button type="button" role="option" onmousedown="event.preventDefault()" onclick="comboPick('${fid}',${i})">${it.photo ? `<img src="${it.photo}" alt="">` : ''}<span class="grow"><span class="combo-main">${esc(it.label)}</span>${it.sub ? `<span class="combo-sub">${esc(it.sub)}</span>` : ''}</span></button>`).join('');
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
    return `<div class="photo-grid">${pics.map((src, i) => `<div class="photo-card"><img src="${src}" alt="Photo ${i + 1}"><div class="actions"><button type="button" class="alt small" onclick="coverPhoto('${kind}',${i})">${i === 0 ? 'Cover ✓' : 'Make cover'}</button><button type="button" class="danger small" onclick="removePhoto('${kind}',${i})">Delete</button></div></div>`).join('')}</div>`;
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
function resizePhoto(file, done, max = 480) {
    if (!file)
        return;
    let reader = new FileReader();
    reader.onload = () => {
        let img = new Image();
        img.onload = () => {
            let c = document.createElement('canvas'), scale = Math.min(1, max / Math.max(img.width, img.height));
            c.width = Math.max(1, Math.round(img.width * scale));
            c.height = Math.max(1, Math.round(img.height * scale));
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            done(c.toDataURL('image/jpeg', .65));
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
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
    let i = $('slotPhotoInput');
    if (!i) {
        i = document.createElement('input');
        i.type = 'file';
        i.accept = 'image/*';
        i.id = 'slotPhotoInput';
        i.className = 'hidden';
        i.addEventListener('change', slotPhotoChosen);
        document.body.appendChild(i);
    }
    i.value = '';
    i.click();
}
function slotPhotoChosen(e) {
    let f = e.target.files?.[0], t = photoTarget;
    photoTarget = null;
    if (!f || !t)
        return;
    if (f.type && !f.type.startsWith('image/'))
        return appAlert('Choose a photo (JPG or PNG).');
    resizePhoto(f, src => {
        let list = t.kind === 'product' ? [product(t.id)] : t.kind === 'group' ? (matGroupInfo[Number(t.id)]?.items || []).filter(m => !(m.photo || m.photos?.length)) : [material(t.id)];
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
    deduct: ['Automatic material deduction', 'When this is on, adding finished stock to a product (+1, or + Add quantity) also takes the materials it uses out of your material stock.\n\nExample: a Small bee uses 40 g of yarn, 80 g of stuffing and 1 pair of eyes. Add 2 Small bees and 80 g of yarn, 160 g of stuffing and 2 pairs of eyes are taken out.\n\nOnly materials with “Track remaining stock” turned on are changed.'],
    mult: ['Default material multiplier', 'Only used when the pricing method is Materials × multiplier.\n\nThe suggested price is your material cost times this number. Example: $5 of materials × 3 = $15. Labour isn’t added with this method.'],
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
