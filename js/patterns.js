// Pattern library and the built-in PDF/image viewer, "You stopped here" marker, pattern limit
// Part of the Crochet Studio app. Files load in the order listed in index.html.

function patterns() {
    let list = pdfCache.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))), f = patternTagFilter && patternTag(patternTagFilter) ? patternTagFilter : '';
    let has = x => !f || patternTagIds(x.id).includes(f), files = list.filter(has), links = (data.patternLinks || []).filter(has).sort(byName);
    let add = `<div class="panel"><h3>Add pattern</h3>${patternUsage()}<div class="actions"><button onclick="patternPick('patternFile')">Choose file (PDF / JPG / PNG)</button><button class="alt" onclick="patternPick('patternCamera')">📷 Camera</button><button class="alt" onclick="editPatternLink()">+ Link</button></div><input class="hidden" id="patternFile" type="file" accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png" onchange="importPdf(event)"><input class="hidden" id="patternCamera" type="file" accept="image/*" capture="environment" onchange="importPdf(event)"><p class="hint">${signedIn() ? 'Patterns are saved privately to your account.' : 'Patterns stay private on this device.'} A preview photo is made automatically; tap “Photo” to take or choose your own. Use <b>Link</b> to save a pattern that’s online, like an Instagram post (links don’t count toward the limit). Only import patterns you have permission to use.</p></div>`;
    let tags = `<div class="chips pattags" role="group" aria-label="Show patterns with tag"><button type="button" class="chipbtn ${f ? '' : 'on'}" aria-pressed="${!f}" onclick="filterPatternTag('')">All</button>${(data.patternTags || []).slice().sort(byName).map(t => `<button type="button" class="chipbtn ${f === t.id ? 'on' : ''}" aria-pressed="${f === t.id}" onclick="filterPatternTag('${t.id}')">${esc(t.name)}</button>`).join('')}<button type="button" class="chipbtn newtag" onclick="editPatternTag()">+ Tag</button>${f ? `<button type="button" class="linkbtn" onclick="editPatternTag('${f}')">Edit tag</button>` : ''}</div>`;
    let linkPanel = links.length ? `<details class="panel patlinks" ${lsGet('csLinksOpen', false) ? 'open' : ''} ontoggle="lsSet('csLinksOpen', this.open)"><summary><b>Links</b> <span class="muted">${links.length}</span></summary>${links.map(patternLinkRow).join('')}</details>` : '';
    let cards = files.map(p => `<div class="panel item"><button class="thumbbtn" onclick="openPattern('${p.id}')" aria-label="Open ${esc(p.name)}">${thumb(p.thumb || '', "")}</button><div class="grow"><div class="item-title" style="word-break:break-word">${esc(p.name)}</div><div class="muted">${(p.mime || '').startsWith('image/') ? 'Image' : 'PDF'} · ${new Date(p.date).toLocaleDateString()}</div>${patternTagChips(p.id)}<div class="actions"><button class="small" onclick="openPattern('${p.id}')">Open</button><button class="alt small" onclick="pickPatternPhoto('${p.id}')">${ic('camera', 15)} Photo</button><button class="alt small" onclick="renamePattern('${p.id}')">${ic('pencil', 15)} Rename</button><button class="alt small" onclick="patternTagsModal('${p.id}')">${ic('tag', 15)} Tags</button><button class="danger small" onclick="removePdf('${p.id}')">Delete</button></div></div></div>`).join('');
    let empty = !list.length && !(data.patternLinks || []).length ? '<div class="panel muted">No patterns added yet.</div>' : !cards && !linkPanel ? '<div class="panel muted">No patterns with this tag yet. Tap <b>Tags</b> on a pattern or edit a link to add it.</div>' : '';
    return `<div class="row"><h2>Pattern Library</h2></div>${add}${tags}${linkPanel}${cards}${empty}`;
}
let patternPhotoFor = null;
function pickPatternPhoto(pid) {
    patternPhotoFor = pid;
    photoMenu(setPatternPhoto);
}
async function setPatternPhoto(e) {
    let f = e.target.files?.[0], pid = patternPhotoFor;
    if (!f || !pid)
        return;
    let src = await imageThumb(f, 420);
    if (!src)
        return appAlert('Could not read that photo.');
    let p = pdfCache.find(x => x.id === pid);
    if (!p)
        return;
    try {
        await pdfPut({ ...p, thumb: src, thumbCustom: true, thumbTried: true });
        await refreshPdfs();
        toast('Pattern photo saved.');
    }
    catch {
        appAlert('Could not save the photo on this device.');
    }
}
function imageThumb(blob, max = 320) {
    return new Promise(res => {
        let u = URL.createObjectURL(blob), img = new Image();
        img.onload = () => {
            let k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(img.width * k));
            c.height = Math.max(1, Math.round(img.height * k));
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(u);
            res(c.toDataURL('image/jpeg', .72));
        };
        img.onerror = () => {
            URL.revokeObjectURL(u);
            res('');
        };
        img.src = u;
    });
}
async function loadPdfjs() {
    if (!pdfjsLib) {
        pdfjsLib = await import(new URL('lib/pdf.min.js', document.baseURI).href);
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('lib/pdf.worker.min.js', document.baseURI).href;
    }
    return pdfjsLib;
}
async function makePatternThumb(p) {
    try {
        if (isImagePattern(p))
            return await imageThumb(p.blob, 320);
        let lib = await loadPdfjs(), doc = await lib.getDocument({ data: new Uint8Array(await p.blob.arrayBuffer()) }).promise, page = await doc.getPage(1), base = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: 300 / base.width }), c = document.createElement('canvas');
        c.width = Math.ceil(vp.width);
        c.height = Math.ceil(vp.height);
        let ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        let out = c.toDataURL('image/jpeg', .72);
        doc.destroy?.();
        return out;
    }
    catch (e) {
        console.warn('Pattern preview failed', e);
        return '';
    }
}
let thumbing = false;
async function fillMissingThumbs() {
    if (thumbing)
        return;
    let todo = pdfCache.filter(x => !x.thumb && !x.thumbTried);
    if (!todo.length)
        return;
    thumbing = true;
    try {
        for (let p of todo) {
            let t = await makePatternThumb(p);
            await pdfPut({ ...p, thumb: t, thumbTried: true });
        }
    }
    catch (e) {
        console.warn(e);
    }
    finally {
        thumbing = false;
    }
    refreshPdfs();
}
async function importPdf(e) {
    let f = e.target.files?.[0];
    if (!f)
        return;
    if (pdfCache.length >= PATTERN_LIMIT) {
        e.target.value = '';
        return patternLimitReached();
    }
    let name = f.name.toLowerCase(), valid = /\.(pdf|jpg|jpeg|png)$/.test(name) || ['application/pdf', 'image/jpeg', 'image/png'].includes(f.type);
    if (!valid)
        return appAlert('Choose a PDF, JPG or PNG file.');
    try {
        await pdfPut({ id: id(), name: f.name, date: new Date().toISOString(), mime: f.type || (name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'), blob: f });
        await refreshPdfs();
        toast('Pattern imported.');
    }
    catch (err) {
        appAlert('Could not save the pattern on this device. Your browser may have run out of storage or blocked local files. Try a smaller file or another browser.');
    }
}
let viewerPageUrls = [], viewerItem = null, viewerUrl = '', viewerPdf = null, viewerZoom = 1, viewerToken = 0, pdfjsLib = null;
const ZOOMS = [.5, .75, 1, 1.25, 1.5, 2, 2.5, 3];
function isImagePattern(p) {
    // The file type saved at import decides; the name only matters for very old patterns saved without one, so renaming is safe.
    return p.mime ? p.mime.startsWith('image/') : /\.(jpe?g|png)$/i.test(p.name || '');
}
async function renderViewer() {
    let body = $('vbody'), p = viewerItem;
    if (!body || !p)
        return;
    let token = ++viewerToken;
    viewerPageUrls.forEach(u => URL.revokeObjectURL(u));
    viewerPageUrls = [];
    $('vzoom').textContent = Math.round(viewerZoom * 100) + '%';
    if (isImagePattern(p)) {
        body.innerHTML = `<img src="${viewerUrl}" alt="${esc(p.name)}" style="width:${viewerZoom * 100}%">`;
        return;
    }
    try {
        await loadPdfjs();
        if (!viewerPdf)
            viewerPdf = await pdfjsLib.getDocument({ data: new Uint8Array(await p.blob.arrayBuffer()) }).promise;
        if (token !== viewerToken)
            return;
        body.innerHTML = '';
        // Each page is drawn once, then kept as a picture and the drawing area freed. Phones only allow so much
        // drawing memory, and long patterns used to run out, leaving blank pages with only their page numbers.
        let dpr = Math.min(window.devicePixelRatio || 1, 2.5), avail = Math.max(200, body.clientWidth - 16), n = viewerPdf.numPages, maxPx = n > 8 ? 5e6 : 8e6, slots = [];
        // 1) Lay out every page's space first (quick: no drawing yet), so the viewer can jump straight to
        //    where you left off, even on a slow phone with a long pattern.
        for (let i = 1; i <= n; i++) {
            if (n > 1)
                body.insertAdjacentHTML('beforeend', `<div class="vpage">Page ${i} of ${n}</div>`);
            let box = document.createElement('div');
            box.className = 'vpagebox';
            box.dataset.page = i;
            try {
                let page = await viewerPdf.getPage(i);
                if (token !== viewerToken)
                    return;
                let base = page.getViewport({ scale: 1 }), css = avail / base.width * viewerZoom;
                box.style.width = Math.floor(base.width * css) + 'px';
                box.style.height = Math.floor(base.height * css) + 'px';
                slots.push({ i, page, base, css, box });
            }
            catch (pe) {
                console.warn('Pattern page', i, pe);
                box.className = 'vmsg small';
                box.innerHTML = `<p>Page ${i} couldn't be shown here.</p><button class="alt small" onclick="openPatternExternally()">Open in another app</button>`;
            }
            body.appendChild(box);
        }
        // Every page's space is placed: jump back now, and show the "You stopped here" mark
        patRestoreTry(true);
        drawPatMark();
        // 2) Draw the pages, always next the one closest to where you're reading.
        // Each page is drawn once, then kept as a picture and the drawing area freed. Phones only allow so much
        // drawing memory, and long patterns used to run out, leaving blank pages with only their page numbers.
        let todo = new Set(slots.map((x, k) => k));
        while (todo.size) {
            if (token !== viewerToken || !body.isConnected)
                return;
            let here = patPosNow()?.page ?? 0, k = [...todo].reduce((best, x) => Math.abs(slots[x].i - 1 - here) < Math.abs(slots[best].i - 1 - here) ? x : best);
            todo.delete(k);
            let { i, page, base, css, box } = slots[k];
            try {
                let px = css * dpr;
                if (base.width * base.height * px * px > maxPx)
                    px = Math.sqrt(maxPx / (base.width * base.height));
                let vp = page.getViewport({ scale: px }), c = document.createElement('canvas'), w = Math.floor(base.width * css), h = Math.floor(base.height * css);
                c.width = Math.floor(vp.width);
                c.height = Math.floor(vp.height);
                c.style.width = w + 'px';
                c.style.height = h + 'px';
                box.appendChild(c);
                await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
                await addPageLinks(page, box, css);
                page.cleanup();
                if (token !== viewerToken)
                    return;
                let blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
                if (blob) {
                    let img = new Image();
                    img.className = 'vimg';
                    img.alt = `Page ${i}`;
                    img.style.width = w + 'px';
                    img.style.height = h + 'px';
                    img.src = URL.createObjectURL(blob);
                    viewerPageUrls.push(img.src);
                    c.replaceWith(img);
                    c.width = c.height = 0;
                }
                box.classList.add('drawn');
            }
            catch (pe) {
                console.warn('Pattern page', i, pe);
                box.insertAdjacentHTML('beforeend', `<div class="vmsg small"><p>Page ${i} couldn't be shown here.</p><button class="alt small" onclick="openPatternExternally()">Open in another app</button></div>`);
            }
        }
    }
    catch (e) {
        console.error(e);
        if (token === viewerToken)
            body.innerHTML = `<div class="vmsg"><p>This PDF couldn't be shown inside the app.</p><button onclick="openPatternExternally()">Open in another app</button></div>`;
    }
}
function viewerZoomBy(d) {
    let i = ZOOMS.indexOf(viewerZoom);
    i = Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 2 : i) + d));
    if (ZOOMS[i] === viewerZoom)
        return;
    viewerZoom = ZOOMS[i];
    renderViewer();
}
function openPatternExternally() {
    if (!viewerUrl)
        return;
    let w = window.open(viewerUrl, '_blank');
    if (!w) {
        let a = document.createElement('a');
        a.href = viewerUrl;
        a.target = '_blank';
        a.click();
    }
}
function removeViewer() {
    viewerPageUrls.forEach(u => URL.revokeObjectURL(u));
    viewerPageUrls = [];
    viewerToken++;
    $('viewer')?.remove();
    document.body.style.overflow = '';
    if (viewerUrl) {
        let u = viewerUrl;
        setTimeout(() => URL.revokeObjectURL(u), 60000);
    }
    viewerUrl = '';
    viewerItem = null;
    viewerPdf?.destroy?.();
    viewerPdf = null;
}
function closeViewer() {
    if (history.state?.viewer)
        history.back();
    else
        removeViewer();
}
async function removePdf(pid) {
    if (!await appConfirm('Delete this pattern from the library?'))
        return;
    await pdfDelete(pid);
    if (data.patternTagOf?.[pid]) {
        delete data.patternTagOf[pid];
        save();
    }
    await refreshPdfs();
    toast('Pattern deleted.');
}
function fillPatternOptions() {
    let e = $('ppattern');
    if (!e)
        return;
    let p = product(editing);
    let links = (data.patternLinks || []).slice().sort(byName);
    let files = pdfCache.map(x => `<option value="${x.id}" data-thumb="${esc(x.thumb || '')}">${esc(x.name)}</option>`).join(''), linkOpts = links.map(x => `<option value="${x.id}" data-thumb="${esc(photoUrl(x.photo || ''))}">${esc(x.name)}</option>`).join('');
    e.innerHTML = '<option value="">No pattern</option>' + (files && linkOpts ? `<optgroup label="Files">${files}</optgroup><optgroup label="Links">${linkOpts}</optgroup>` : files + linkOpts);
    e.value = p?.patternId || '';
    syncFancy(e);
}
// ---- Pattern limit (test version) ----
async function patternLimitReached() {
    if (pdfCache.length < PATTERN_LIMIT)
        return false;
    await appDialog({ title: `You’ve reached ${PATTERN_LIMIT} patterns`, message: `During testing, each account can keep up to ${PATTERN_LIMIT} patterns so we stay within our free storage. To add a new one, delete one you don’t need.\n\nProducts, materials, markets and photos aren’t limited.`, ok: 'OK' });
    return true;
}
async function patternPick(inputId) {
    if (await patternLimitReached())
        return;
    $(inputId)?.click();
}
function patternUsage() {
    let n = pdfCache.length, pct = Math.min(100, n / PATTERN_LIMIT * 100);
    return `<div class="pusage"><div class="row"><b>${n} of ${PATTERN_LIMIT} patterns used</b><span class="muted">Test version</span></div><div class="pbar"><i style="width:${pct}%" class="${n >= PATTERN_LIMIT ? 'full' : ''}"></i></div></div>`;
}
// ---- Pattern viewer: stays open, "I stopped here" marker ----
let patArm = false, patMarkAt = 0, patAfterBusy = false;
async function openPattern(pid, opts = {}) {
    let p = pdfCache.find(x => x.id === pid);
    if (!p) {
        await refreshPdfs();
        p = pdfCache.find(x => x.id === pid);
    }
    if (!p) {
        lsSet('csPatternOpen', null);
        if (!opts.silent)
            appAlert('Pattern not found.');
        return;
    }
    let pos = patPos(pid);
    openViewerItem(p, { pattern: true, zoom: pos?.zoom || 1 });
    patFirst = true;
    if (pos && pos.page != null && (num(pos.page) > 0 || num(pos.frac) > 0.01))
        patTarget = { page: num(pos.page), frac: num(pos.frac), tip: true };
    else if (pos && pos.page == null && num(pos.top) > 0)
        patTarget = { top: num(pos.top), tip: true }; // saved by an older version
    patRestoring = !!patTarget;
    lsSet('csPatternOpen', { id: pid });
}
function openViewerItem(p, o = {}) {
    removeViewer();
    viewerItem = p;
    viewerZoom = o.zoom && ZOOMS.includes(o.zoom) ? o.zoom : 1;
    viewerPdf = null;
    viewerUrl = URL.createObjectURL(p.blob);
    patArm = false;
    let ov = document.createElement('div');
    ov.id = 'viewer';
    if (o.pattern)
        ov.dataset.pattern = p.id;
    ov.innerHTML = `<div class="vbar"><b>${esc(p.name)}</b>${o.pattern ? `<button class="small vmarkbtn" id="vmarkBtn" aria-pressed="false" onclick="armPatternMark()">${ic('tag', 15)} Mark</button>` : ''}<button class="alt small" onclick="viewerZoomBy(-1)" aria-label="Zoom out">−</button><span id="vzoom">100%</span><button class="alt small" onclick="viewerZoomBy(1)" aria-label="Zoom in">+</button><button class="small" onclick="closeViewer()" aria-label="Close">✕</button></div>${o.pattern ? '<div id="vtip" class="vtip hidden"></div>' : ''}<div id="vbody"><div class="vmsg muted">Opening…</div></div>`;
    document.body.appendChild(ov);
    document.body.classList.add('viewing');
    document.body.style.overflow = 'hidden';
    try {
        history.pushState({ viewer: 1 }, '');
    }
    catch {
    }
    if (o.pattern) {
        let b = $('vbody');
        b.addEventListener('scroll', onPatScroll, { passive: true });
        b.addEventListener('pointerdown', onPatTouch);
        b.addEventListener('touchmove', patUserScroll, { passive: true });
        b.addEventListener('wheel', patUserScroll, { passive: true });
    }
    renderViewer();
}
const _rv23 = renderViewer;
renderViewer = async function () {
    // Only the newest drawing may finish the job: an older one still finishing in the background
    // (pattern closed and reopened quickly) must not cancel the jump back to where you left off.
    let run = _rv23(), mine = viewerToken;
    await run;
    if (mine === viewerToken)
        afterViewerRender();
};
const _rmv23 = removeViewer;
removeViewer = function () {
    if ($('viewer')?.dataset.pattern)
        savePatPos();
    _rmv23();
    patTarget = null;
    patRestoring = false;
    document.body.classList.remove('viewing');
};
const _close23 = closeViewer;
closeViewer = function () {
    savePatPos();
    lsSet('csPatternOpen', null);
    _close23();
};
const _zoom23 = viewerZoomBy;
viewerZoomBy = function (d) {
    // Keep the same spot on the same page when zooming
    let pid = $('viewer')?.dataset.pattern, pos = pid && !patRestoring ? patPosNow() : null, before = viewerZoom;
    if (pos) {
        patTarget = { page: pos.page, frac: pos.frac };
        patRestoring = true;
    }
    _zoom23(d);
    if (viewerZoom === before) {
        if (pos) {
            patTarget = null;
            patRestoring = false;
        }
        return;
    }
    if (pid && pos)
        setPatPos(pid, { page: pos.page, frac: pos.frac, zoom: viewerZoom });
};
function patVtip(t, ms) {
    let e = $('vtip');
    if (!e)
        return;
    clearTimeout(patVtip.t);
    if (!t) {
        e.classList.add('hidden');
        return;
    }
    e.textContent = t;
    e.classList.remove('hidden');
    if (ms)
        patVtip.t = setTimeout(() => e.classList.add('hidden'), ms);
}
function afterViewerRender() {
    let v = $('viewer'), b = $('vbody'), pid = v?.dataset.pattern;
    if (!pid || !b)
        return;
    let img = b.querySelector('img');
    if (img && !img.complete) {
        img.onload = () => afterViewerRender();
        return;
    }
    let mark = data.patternMarks?.[pid], first = patFirst;
    patFirst = false;
    if (patRestoring)
        patRestoreTry(true);
    else if (first && mark && b.scrollTop < 5) {
        let at = patMarkSpot(mark);
        if (at)
            b.scrollTop = Math.max(0, at.top - 140);
    }
    patTarget = null;
    patRestoring = false;
    drawPatMark();
}
function drawPatMark() {
    let b = $('vbody'), pid = $('viewer')?.dataset.pattern;
    if (!b || !pid)
        return;
    b.querySelector('.pmark')?.remove();
    let m = data.patternMarks?.[pid];
    if (!m)
        return;
    let e = document.createElement('div');
    e.className = 'pmark';
    e.innerHTML = '<span class="pdot"></span><span class="plabel">You stopped here</span>';
    let at = patMarkSpot(m);
    if (!at)
        return;
    e.style.top = (at.top - 14) + 'px';
    e.style.left = Math.max(4, at.left - 14) + 'px';
    b.appendChild(e);
    patMarkAt = Date.now();
}
function clearPatMark() {
    let b = $('vbody'), pid = $('viewer')?.dataset.pattern;
    let e = b?.querySelector('.pmark');
    if (!e)
        return;
    e.classList.add('fade');
    setTimeout(() => e.remove(), 600);
    if (pid && data.patternMarks?.[pid]) {
        delete data.patternMarks[pid];
        save();
    }
}
function armPatternMark() {
    patArm = !patArm;
    let btn = $('vmarkBtn');
    if (btn) {
        btn.setAttribute('aria-pressed', String(patArm));
        btn.classList.toggle('on', patArm);
    }
    patVtip(patArm ? 'Tap the spot where you stopped' : '', 0);
}
function onPatTouch(e) {
    let b = $('vbody'), pid = $('viewer')?.dataset.pattern;
    if (!b || !pid)
        return;
    if (patArm) {
        let r = b.getBoundingClientRect(), x = (e.clientX - r.left + b.scrollLeft) / Math.max(1, b.scrollWidth), y = (e.clientY - r.top + b.scrollTop) / Math.max(1, b.scrollHeight), mk = { x, y, at: new Date().toISOString() };
        // Also remember which page and where on it, so the mark stays put at any zoom
        let pages = patPages(), hit = pages.find(pg => { let pr = pg.getBoundingClientRect(); return e.clientY >= pr.top && e.clientY <= pr.bottom; });
        if (hit) {
            let pr = hit.getBoundingClientRect();
            mk.page = pages.indexOf(hit);
            mk.px = Math.max(0, Math.min(1, (e.clientX - pr.left) / Math.max(1, pr.width)));
            mk.py = Math.max(0, Math.min(1, (e.clientY - pr.top) / Math.max(1, pr.height)));
        }
        data.patternMarks = { ...(data.patternMarks || {}), [pid]: mk };
        save();
        patArm = false;
        let btn = $('vmarkBtn');
        if (btn) {
            btn.setAttribute('aria-pressed', 'false');
            btn.classList.remove('on');
        }
        drawPatMark();
        patVtip('Spot marked. It’ll be here next time.', 2500);
        e.preventDefault();
        return;
    }
    if (b.querySelector('.pmark') && Date.now() - patMarkAt > 1500)
        clearPatMark();
}
function onPatScroll() {
    let b = $('vbody'), pid = $('viewer')?.dataset.pattern;
    if (!b || !pid)
        return;
    clearTimeout(onPatScroll.t);
    onPatScroll.t = setTimeout(() => {
        // Ignore the scroll that happens when the viewer closes
        if (!b.isConnected || $('viewer')?.dataset.pattern !== pid)
            return;
        savePatPos();
    }, 250);
    if (b.querySelector('.pmark') && Date.now() - patMarkAt > 1500)
        clearPatMark();
}
const _view23 = view;
view = function (s) {
    let v = $('viewer');
    if (v) {
        if (s === 'patterns' && v.dataset.pattern)
            return;
        removeViewer();
    }
    return _view23(s);
};

// ---- Rename a pattern (the new name syncs to the account like a new photo does) ----
function renamePattern(pid) {
    let p = pdfCache.find(x => x.id === pid);
    if (!p)
        return;
    openModal(`<div class="row"><h2 style="margin:0">Rename pattern</h2>${closeX()}</div><label for="patName">Pattern name</label><input id="patName" value="${esc(p.name)}" maxlength="120" onkeydown="if(event.key==='Enter'){event.preventDefault();savePatternName('${pid}')}"><div class="actions"><button onclick="savePatternName('${pid}')">Save name</button><button class="alt" onclick="closeModal()">Cancel</button></div>`);
    setTimeout(() => { let i = $('patName'); i?.focus(); i?.select(); }, 50);
}
async function savePatternName(pid) {
    let name = normName($('patName')?.value), p = pdfCache.find(x => x.id === pid);
    if (!name)
        return needField('patName', 'Enter a name for this pattern.');
    if (!p)
        return closeModal();
    try {
        await pdfPut({ ...p, name });
        await refreshPdfs();
        closeModal();
        render();
        toast('Pattern renamed.');
    }
    catch {
        appAlert('Could not save the new name on this device.');
    }
}

// ---- Clickable links in PDF patterns (YouTube tutorials, designers' socials, shops) ----
const URL_RX = /(https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+|(?:youtu\.be|youtube\.com|instagram\.com|facebook\.com|tiktok\.com|etsy\.com|ravelry\.com|pinterest\.com)\/[^\s<>"')\]]*)/i;
function safeLink(u) {
    u = String(u || '').trim().replace(/[.,;:!?]+$/, '');
    if (!/^https?:\/\//i.test(u))
        u = 'https://' + u.replace(/^\/+/, '');
    try {
        let x = new URL(u);
        return /^https?:$/.test(x.protocol) ? x.href : '';
    }
    catch {
        return '';
    }
}
async function addPageLinks(page, box, css) {
    try {
        let v = page.getViewport({ scale: css }), boxes = [];
        const add = (href, x1, y1, x2, y2) => {
            href = safeLink(href);
            if (!href)
                return;
            let l = Math.min(x1, x2), t = Math.min(y1, y2), w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
            if (w < 4 || h < 4 || boxes.some(b => Math.abs(b.l - l) < 6 && Math.abs(b.t - t) < 6))
                return;
            boxes.push({ l, t });
            let a = document.createElement('a');
            a.className = 'plink';
            a.href = href;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.title = href;
            a.setAttribute('aria-label', 'Open link: ' + href);
            a.style.cssText = `left:${l}px;top:${t}px;width:${w}px;height:${h}px`;
            a.addEventListener('click', patLinkClick);
            box.appendChild(a);
        };
        // Links the pattern's author added to the PDF
        for (let an of await page.getAnnotations({ intent: 'display' }))
            if (an.subtype === 'Link' && an.url) {
                let [x1, y1] = v.convertToViewportPoint(an.rect[0], an.rect[1]), [x2, y2] = v.convertToViewportPoint(an.rect[2], an.rect[3]);
                add(an.url, x1, y1, x2, y2);
            }
        // Web addresses typed as plain text
        let tc = await page.getTextContent();
        for (let it of tc.items) {
            let m = typeof it.str === 'string' && it.str.match(URL_RX);
            if (!m)
                continue;
            let tx = pdfjsLib.Util.transform(v.transform, it.transform), fh = Math.hypot(tx[2], tx[3]), x = tx[4], y = tx[5] - fh, w = (it.width || 0) * css;
            add(m[0], x, y - 2, x + Math.max(w, 30), y + fh + 3);
        }
    }
    catch (e) {
        console.warn('Pattern links', e);
    }
}
// A tap that just placed the "You stopped here" mark shouldn't also open a link.
function patLinkClick(e) {
    if (patArm || Date.now() - patMarkAt < 700)
        e.preventDefault();
}


// ---- Pattern tags and saved links (e.g. a pattern posted on Instagram) ----
ICONS.link = '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>';
let patternTagFilter = '', linkTagDraft = [], linkPhotoDraft = '';
function patternTag(tid) {
    return (data.patternTags || []).find(t => t.id === tid);
}
function patternTagIds(itemId) {
    return (data.patternTagOf?.[itemId] || []).filter(patternTag);
}
function setPatternTagIds(itemId, ids) {
    data.patternTagOf ||= {};
    ids = [...new Set(ids)].filter(patternTag);
    if (ids.length)
        data.patternTagOf[itemId] = ids;
    else
        delete data.patternTagOf[itemId];
}
function patternTagChips(itemId) {
    let t = patternTagIds(itemId).map(patternTag).sort(byName);
    return t.length ? `<div class="tagline">${t.map(x => `<span class="chip">${esc(x.name)}</span>`).join(' ')}</div>` : '';
}
function filterPatternTag(tid) {
    patternTagFilter = patternTagFilter === tid ? '' : tid;
    render();
}
function patternLink(lid) {
    return (data.patternLinks || []).find(l => l.id === lid);
}
function linkHost(u) {
    try {
        return new URL(u).hostname.replace(/^www\./, '');
    }
    catch {
        return '';
    }
}
function patternLinkRow(l) {
    let href = safeLink(l.url);
    let pic = l.photo ? `<a class="linkpic" href="${esc(href || '#')}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(l.name)}">${thumb(l.photo)}</a>` : photoSlot('', '', 'link', l.id, l.name);
    return `<div class="patlinkrow">${pic}<a class="grow linkopen" href="${esc(href || '#')}" target="_blank" rel="noopener noreferrer"><b>${esc(l.name)}</b><span class="muted block">${esc(linkHost(href) || l.url)}</span>${patternTagChips(l.id)}</a><button class="iconbtn small" aria-label="Edit ${esc(l.name)}" onclick="editPatternLink('${l.id}')">${ic('pencil', 16)}</button></div>`;
}
function openPatternLink(lid) {
    let l = patternLink(lid), href = l && safeLink(l.url);
    if (!href)
        return appAlert('That link couldn’t be opened. Check it under Patterns › Links.');
    window.open(href, '_blank', 'noopener');
}
// Product page: a linked pattern can be a file or a saved link.
function productPatternBtn(p) {
    if (!p.patternId)
        return '';
    if (patternLink(p.patternId))
        return `<a class="btnlink alt" href="${esc(safeLink(patternLink(p.patternId).url) || '#')}" target="_blank" rel="noopener noreferrer">Open pattern link</a>`;
    return `<button class="alt" onclick="openPattern('${p.patternId}')">Open pattern</button>`;
}
function linkTagChipsHtml() {
    let tags = (data.patternTags || []).slice().sort(byName);
    return tags.map(t => `<button type="button" class="chipbtn ${linkTagDraft.includes(t.id) ? 'on' : ''}" aria-pressed="${linkTagDraft.includes(t.id)}" onclick="toggleLinkTag('${t.id}')">${esc(t.name)}</button>`).join('') || '<span class="muted">No pattern tags yet. Make one with + Tag on the Patterns page.</span>';
}
function toggleLinkTag(tid) {
    linkTagDraft = linkTagDraft.includes(tid) ? linkTagDraft.filter(x => x !== tid) : [...linkTagDraft, tid];
    $('linkTags').innerHTML = linkTagChipsHtml();
}
function editPatternLink(lid) {
    let l = lid ? patternLink(lid) : null;
    linkTagDraft = l ? patternTagIds(l.id) : patternTagFilter && patternTag(patternTagFilter) ? [patternTagFilter] : [];
    linkPhotoDraft = l?.photo || '';
    openModal(`<div class="row"><h2 style="margin:0">${l ? 'Edit link' : 'Add a pattern link'}</h2>${closeX()}</div><label for="linkUrl">Link</label><input id="linkUrl" type="url" inputmode="url" autocomplete="off" value="${esc(l?.url || '')}" placeholder="Paste the link, e.g. https://www.instagram.com/p/…"><label for="linkName">Name</label><input id="linkName" maxlength="120" value="${esc(l?.name || '')}" placeholder="e.g. Bumble bee (Instagram)"><label>Photo <span class="muted">(optional)</span></label><div id="linkPhoto">${linkPhotoHtml()}</div><label>Tags <span class="muted">(optional)</span></label><div id="linkTags" class="chips">${linkTagChipsHtml()}</div><div class="actions"><button onclick="savePatternLink(${l ? `'${l.id}'` : ''})">Save link</button>${l ? `<button class="alt" onclick="openPatternLink('${l.id}')">Open</button><button class="danger" onclick="deletePatternLink('${l.id}')">Delete</button>` : `<button class="alt" onclick="closeModal()">Cancel</button>`}</div>`);
    setTimeout(() => $(l ? 'linkName' : 'linkUrl')?.focus(), 50);
}
function savePatternLink(lid) {
    let raw = String($('linkUrl').value || '').trim(), m = raw.match(URL_RX), href = safeLink(m ? m[0] : raw), name = normName($('linkName').value);
    if (!href || !/^https?:\/\/[^\s/]+\.[^\s/]+/.test(href))
        return needField('linkUrl', 'Paste a web link, e.g. https://www.instagram.com/p/…');
    if (!name)
        return needField('linkName', 'Give this link a name, e.g. Bumble bee (Instagram).');
    data.patternLinks ||= [];
    let l = lid ? patternLink(lid) : null;
    if (!l) {
        l = { id: id(), date: new Date().toISOString() };
        data.patternLinks.push(l);
    }
    Object.assign(l, { name, url: href });
    if (linkPhotoDraft) {
        if (l.photo !== linkPhotoDraft) {
            l.photo = linkPhotoDraft;
            l.photos = [linkPhotoDraft];
        }
    }
    else {
        delete l.photo;
        delete l.photos;
    }
    setPatternTagIds(l.id, linkTagDraft);
    save();
    closeModal();
    render();
    toast(lid ? 'Link saved.' : 'Link added to your patterns.');
}
async function deletePatternLink(lid) {
    let l = patternLink(lid);
    if (!l)
        return closeModal();
    let used = data.products.filter(p => p.patternId === lid);
    if (!await appConfirm(`Delete the link “${l.name}”?${used.length ? `\n\n${used.length === 1 ? used[0].name + ' uses' : used.length + ' products use'} it as their pattern; ${used.length === 1 ? 'it' : 'they'} will have no pattern.` : ''}`, { ok: 'Delete', danger: true }))
        return;
    data.patternLinks = data.patternLinks.filter(x => x.id !== lid);
    delete data.patternTagOf?.[lid];
    used.forEach(p => p.patternId = '');
    save();
    closeModal();
    render();
    toast('Link deleted.');
}
// Tags on one pattern file
function patternTagsModal(itemId) {
    let p = pdfCache.find(x => x.id === itemId), on = new Set(patternTagIds(itemId)), tags = (data.patternTags || []).slice().sort(byName);
    openModal(`<div class="row"><h2 style="margin:0">Tags</h2>${closeX()}</div><p class="muted">${esc(p?.name || '')} · pick any</p><div class="chips">${tags.map(t => `<button type="button" class="chipbtn ${on.has(t.id) ? 'on' : ''}" aria-pressed="${on.has(t.id)}" onclick="togglePatternTag('${itemId}','${t.id}')">${esc(t.name)}</button>`).join('') || '<span class="muted">No pattern tags yet.</span>'}</div><div class="row addnote" style="margin-top:12px"><label for="ptNew" class="sr-only">New tag</label><input id="ptNew" placeholder="New tag, e.g. Bees" maxlength="40" onkeydown="if(event.key==='Enter'){event.preventDefault();addPatternTagTo('${itemId}')}"><button onclick="addPatternTagTo('${itemId}')">Add</button></div><div class="actions"><button onclick="closeModal()">Done</button></div>`);
}
function togglePatternTag(itemId, tid) {
    let ids = patternTagIds(itemId);
    setPatternTagIds(itemId, ids.includes(tid) ? ids.filter(x => x !== tid) : [...ids, tid]);
    save();
    render();
    patternTagsModal(itemId);
}
function makePatternTag(name) {
    name = normName(name);
    if (!name)
        return null;
    let dup = (data.patternTags || []).find(t => t.name.toLowerCase() === name.toLowerCase());
    if (dup)
        return dup;
    let t = { id: id(), name };
    data.patternTags.push(t);
    return t;
}
function addPatternTagTo(itemId) {
    let t = makePatternTag($('ptNew')?.value);
    if (!t)
        return needField('ptNew', 'Type a name for the new tag.');
    setPatternTagIds(itemId, [...patternTagIds(itemId), t.id]);
    save();
    render();
    patternTagsModal(itemId);
}
// + Tag (new) or Edit tag (rename / delete) on the Patterns page
function editPatternTag(tid) {
    let t = tid ? patternTag(tid) : null;
    openModal(`<div class="row"><h2 style="margin:0">${t ? 'Edit' : 'New'} pattern tag</h2>${closeX()}</div><label for="ptName">Tag name</label><input id="ptName" maxlength="40" value="${esc(t?.name || '')}" placeholder="e.g. Bees, Amigurumi, Holiday" onkeydown="if(event.key==='Enter'){event.preventDefault();savePatternTag(${t ? `'${t.id}'` : ''})}"><div class="actions"><button onclick="savePatternTag(${t ? `'${t.id}'` : ''})">Save tag</button>${t ? `<button class="danger" onclick="deletePatternTag('${t.id}')">Delete tag</button>` : `<button class="alt" onclick="closeModal()">Cancel</button>`}</div>`);
    setTimeout(() => $('ptName')?.focus(), 50);
}
function savePatternTag(tid) {
    let name = normName($('ptName').value), dup = (data.patternTags || []).find(x => x.name.toLowerCase() === name.toLowerCase() && x.id !== tid);
    if (!name)
        return needField('ptName', 'Enter a tag name.');
    if (dup)
        return needField('ptName', `You already have a “${dup.name}” tag.`);
    if (tid)
        patternTag(tid).name = name;
    else
        data.patternTags.push({ id: id(), name });
    save();
    closeModal();
    render();
    toast(tid ? 'Tag renamed.' : `Tag “${name}” made. Tap Tags on a pattern to add it.`);
}
async function deletePatternTag(tid) {
    let t = patternTag(tid);
    if (!t || !await appConfirm(`Delete the “${t.name}” tag?\n\nYour patterns and links stay, just without this tag.`, { ok: 'Delete', danger: true }))
        return;
    data.patternTags = data.patternTags.filter(x => x.id !== tid);
    for (let k of Object.keys(data.patternTagOf || {}))
        setPatternTagIds(k, data.patternTagOf[k].filter(x => x !== tid));
    if (patternTagFilter === tid)
        patternTagFilter = '';
    save();
    closeModal();
    render();
}
// Photo inside the Add/Edit link box: picked here, saved with Save link
function linkPhotoHtml(menu) {
    let pic = linkPhotoDraft ? thumb(linkPhotoDraft) : `<span role="button" tabindex="0" class="thumb thumb-empty thumb-add" aria-label="Add a photo" onclick="showLinkPhotoMenu()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showLinkPhotoMenu()}">${ic('camera', 22)}<small>Add photo</small></span>`;
    let btns = menu ? `<button type="button" class="alt small" onclick="linkPhotoFrom('camera')">${ic('camera', 15)} Take photo</button><button type="button" class="alt small" onclick="linkPhotoFrom('gallery')">${ic('folder', 15)} Gallery</button><button type="button" class="alt small" onclick="linkPhotoFrom('files')">${ic('download', 15)} Files</button><button type="button" class="linkbtn" onclick="hideLinkPhotoMenu()">Cancel</button>` : `<button type="button" class="alt small" onclick="showLinkPhotoMenu()">${ic('camera', 15)} ${linkPhotoDraft ? 'Change photo' : 'Add photo'}</button>${linkPhotoDraft ? `<button type="button" class="danger small" onclick="removeLinkPhoto()">Remove photo</button>` : ''}`;
    return `<div class="row linkphoto">${pic}<div class="actions grow" style="margin:0">${btns}</div></div>`;
}
function showLinkPhotoMenu() {
    $('linkPhoto').innerHTML = linkPhotoHtml(true);
}
function hideLinkPhotoMenu() {
    $('linkPhoto').innerHTML = linkPhotoHtml();
}
function linkPhotoFrom(src) {
    photoFrom(src, { multiple: false, onFiles: e => {
        let f = e.target.files?.[0];
        if (f)
            resizePhoto(f, pic => {
                linkPhotoDraft = pic;
                if ($('linkPhoto'))
                    hideLinkPhotoMenu();
            }, 480);
    } });
}
function removeLinkPhoto() {
    linkPhotoDraft = '';
    hideLinkPhotoMenu();
}

// ---- Each pattern remembers where you were reading (scroll and zoom), even after closing it or the app ----
function patPos(pid) {
    return lsGet('csPatPos', {})?.[pid] || null;
}
// Saved as the page you were on and how far down that page, so it stays right even while pages are still loading or at another zoom
function setPatPos(pid, v) {
    if (!pid || !v)
        return;
    let all = lsGet('csPatPos', {}) || {};
    all[pid] = { page: Math.max(0, Math.floor(num(v.page))), frac: Math.max(0, Math.min(1, num(v.frac))), zoom: v.zoom || 1, at: Date.now() };
    let keys = Object.keys(all);
    if (keys.length > 60)
        keys.sort((a, b) => all[a].at - all[b].at).slice(0, keys.length - 60).forEach(k => delete all[k]);
    lsSet('csPatPos', all);
}

let patTarget = null, patRestoring = false, patFirst = false;
function patPages() {
    let b = $('vbody');
    if (!b)
        return [];
    let boxes = [...b.querySelectorAll('.vpagebox')];
    return boxes.length ? boxes : [...b.querySelectorAll('img')];
}
function patTopOf(el, b) {
    return el.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop;
}
function patPosNow() {
    let b = $('vbody'), els = patPages();
    if (!b || !els.length)
        return null;
    let y = b.scrollTop + 10, pg = 0;
    for (let i = 0; i < els.length; i++) {
        if (patTopOf(els[i], b) <= y)
            pg = i;
        else
            break;
    }
    let e = els[pg], h = Math.max(1, e.getBoundingClientRect().height);
    return { page: pg, frac: Math.max(0, Math.min(1, (b.scrollTop - patTopOf(e, b)) / h)), zoom: viewerZoom };
}
function savePatPos() {
    let pid = $('viewer')?.dataset.pattern;
    if (!pid || patRestoring)
        return;
    let v = patPosNow();
    if (v)
        setPatPos(pid, v);
}
// Jump back as soon as the right page is on screen, instead of waiting for every page to finish
function patRestoreTry(final) {
    if (!patRestoring || !patTarget)
        return;
    let b = $('vbody'), els = patPages();
    if (!b)
        return;
    let want;
    if (patTarget.top != null) {
        if (!final)
            return;
        want = patTarget.top * b.scrollHeight;
    }
    else {
        if (!final && els.length <= patTarget.page)
            return;
        let e = els[Math.min(patTarget.page, els.length - 1)];
        if (!e)
            return;
        want = Math.max(0, patTopOf(e, b) + patTarget.frac * e.getBoundingClientRect().height);
        if (!final && want > b.scrollHeight - b.clientHeight)
            return; // wait until enough pages below are placed
    }
    b.scrollTop = want;
    let tip = patTarget.tip;
    patTarget = null;
    patRestoring = false;
    if (tip)
        patVtip('Opened where you left off', 3000);
}
function patPageAdded(i) {
    if (!$('viewer')?.dataset.pattern)
        return;
    patRestoreTry(false);
    let m = data.patternMarks?.[$('viewer').dataset.pattern];
    if (m && m.page === i)
        drawPatMark();
}
function patUserScroll() {
    // The person started scrolling themselves: don't jump them somewhere else
    if (patRestoring && patPages().length) {
        patRestoring = false;
        patTarget = null;
    }
}
function patMarkSpot(m) {
    let b = $('vbody');
    if (!b || !m)
        return null;
    if (m.page != null) {
        let e = patPages()[m.page];
        if (!e)
            return null;
        let r = e.getBoundingClientRect(), br = b.getBoundingClientRect();
        return { top: patTopOf(e, b) + num(m.py) * r.height, left: r.left - br.left + b.scrollLeft + num(m.px) * r.width };
    }
    return { top: num(m.y) * b.scrollHeight, left: num(m.x) * b.scrollWidth };
}
addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden')
        savePatPos();
});
addEventListener('pagehide', () => savePatPos());
