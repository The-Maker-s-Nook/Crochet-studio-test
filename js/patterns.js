// Pattern library and the built-in PDF/image viewer, "You stopped here" marker, pattern limit
// Part of the Crochet Studio app. Files load in the order listed in index.html.

function patterns() {
    let list = pdfCache.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return `<div class="row"><h2>Pattern Library</h2></div><div class="panel"><h3>Add pattern</h3>${patternUsage()}<div class="actions"><button onclick="patternPick('patternFile')">Choose file (PDF / JPG / PNG)</button><button class="alt" onclick="patternPick('patternCamera')">📷 Camera</button></div><input class="hidden" id="patternFile" type="file" accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png" onchange="importPdf(event)"><input class="hidden" id="patternCamera" type="file" accept="image/*" capture="environment" onchange="importPdf(event)"><input class="hidden" id="patternPhotoInput" type="file" accept="image/*" onchange="setPatternPhoto(event)"><p class="hint">${signedIn() ? 'Patterns are saved privately to your account.' : 'Patterns stay private on this device.'} A preview photo is made automatically; tap “Photo” to take or choose your own. Only import patterns you have permission to use.</p></div>${list.map(p => `<div class="panel item"><button class="thumbbtn" onclick="openPattern('${p.id}')" aria-label="Open ${esc(p.name)}">${thumb(p.thumb || '', "")}</button><div class="grow"><div class="item-title" style="word-break:break-word">${esc(p.name)}</div><div class="muted">${(p.mime || '').startsWith('image/') ? 'Image' : 'PDF'} · ${new Date(p.date).toLocaleDateString()}</div><div class="actions"><button class="small" onclick="openPattern('${p.id}')">Open</button><button class="alt small" onclick="pickPatternPhoto('${p.id}')">${ic('camera', 15)} Photo</button><button class="danger small" onclick="removePdf('${p.id}')">Delete</button></div></div></div>`).join('') || '<div class="panel muted">No patterns imported yet.</div>'}`;
}
let patternPhotoFor = null;
function pickPatternPhoto(pid) {
    patternPhotoFor = pid;
    let i = $('patternPhotoInput');
    if (!i)
        return;
    i.value = '';
    i.click();
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
let viewerItem = null, viewerUrl = '', viewerPdf = null, viewerZoom = 1, viewerToken = 0, pdfjsLib = null;
const ZOOMS = [.5, .75, 1, 1.25, 1.5, 2, 2.5, 3];
function isImagePattern(p) {
    return (p.mime || '').startsWith('image/') || /\.(jpe?g|png)$/i.test(p.name || '');
}
async function renderViewer() {
    let body = $('vbody'), p = viewerItem;
    if (!body || !p)
        return;
    let token = ++viewerToken;
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
        let dpr = Math.min(window.devicePixelRatio || 1, 3), avail = Math.max(200, body.clientWidth - 16), n = viewerPdf.numPages;
        for (let i = 1; i <= n; i++) {
            let page = await viewerPdf.getPage(i);
            if (token !== viewerToken)
                return;
            let base = page.getViewport({ scale: 1 }), css = avail / base.width * viewerZoom, px = css * dpr;
            if (base.width * base.height * px * px > 16e6)
                px = Math.sqrt(16e6 / (base.width * base.height));
            let vp = page.getViewport({ scale: px }), c = document.createElement('canvas');
            c.width = Math.floor(vp.width);
            c.height = Math.floor(vp.height);
            c.style.width = Math.floor(base.width * css) + 'px';
            c.style.height = Math.floor(base.height * css) + 'px';
            if (n > 1)
                body.insertAdjacentHTML('beforeend', `<div class="vpage">Page ${i} of ${n}</div>`);
            body.appendChild(c);
            await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
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
    await refreshPdfs();
    toast('Pattern deleted.');
}
function fillPatternOptions() {
    let e = $('ppattern');
    if (!e)
        return;
    let p = product(editing);
    e.innerHTML = '<option value="">No pattern</option>' + pdfCache.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('');
    e.value = p?.patternId || '';
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
    let mem = lsGet('csPatternOpen', null), keep = opts.restore && mem?.id === pid;
    openViewerItem(p, { pattern: true, zoom: keep ? mem.zoom : 1 });
    lsSet('csPatternOpen', { id: pid, zoom: viewerZoom, top: keep ? num(mem.top) : 0, restored: !!keep });
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
    }
    renderViewer();
}
const _rv23 = renderViewer;
renderViewer = async function () {
    await _rv23();
    afterViewerRender();
};
const _rmv23 = removeViewer;
removeViewer = function () {
    _rmv23();
    document.body.classList.remove('viewing');
};
const _close23 = closeViewer;
closeViewer = function () {
    lsSet('csPatternOpen', null);
    _close23();
};
const _zoom23 = viewerZoomBy;
viewerZoomBy = function (d) {
    let b = $('vbody'), pid = $('viewer')?.dataset.pattern;
    if (pid && b) {
        let m = lsGet('csPatternOpen', null) || { id: pid };
        m.top = b.scrollHeight ? b.scrollTop / b.scrollHeight : 0;
        lsSet('csPatternOpen', m);
    }
    _zoom23(d);
    if (pid) {
        let m = lsGet('csPatternOpen', null);
        if (m) {
            m.zoom = viewerZoom;
            lsSet('csPatternOpen', m);
        }
    }
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
    let mem = lsGet('csPatternOpen', null), mark = data.patternMarks?.[pid];
    if (mem?.id === pid && num(mem.top) > 0)
        b.scrollTop = num(mem.top) * b.scrollHeight;
    else if (mark)
        b.scrollTop = Math.max(0, mark.y * b.scrollHeight - 140);
    drawPatMark();
    if (mem?.restored) {
        mem.restored = false;
        lsSet('csPatternOpen', mem);
        patVtip('Opened where you left off', 3500);
    }
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
    e.style.top = (m.y * b.scrollHeight - 14) + 'px';
    e.style.left = Math.max(4, m.x * b.scrollWidth - 14) + 'px';
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
        let r = b.getBoundingClientRect(), x = (e.clientX - r.left + b.scrollLeft) / Math.max(1, b.scrollWidth), y = (e.clientY - r.top + b.scrollTop) / Math.max(1, b.scrollHeight);
        data.patternMarks = { ...(data.patternMarks || {}), [pid]: { x, y, at: new Date().toISOString() } };
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
        let m = lsGet('csPatternOpen', null);
        if (m?.id === pid) {
            m.top = b.scrollHeight ? b.scrollTop / b.scrollHeight : 0;
            m.zoom = viewerZoom;
            lsSet('csPatternOpen', m);
        }
    }, 300);
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
