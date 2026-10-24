// Saving on the phone (IndexedDB), pattern file storage, backups and restore
// Part of the Crochet Studio app. Files load in the order listed in index.html.

// PDFs and photos are kept in IndexedDB, separate from small localStorage records.
let dbPromise = new Promise((resolve, reject) => {
    let r = indexedDB.open('crochetStudioPDFs', 3);
    r.onupgradeneeded = () => {
        let db = r.result;
        if (!db.objectStoreNames.contains('pdfs'))
            db.createObjectStore('pdfs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('app'))
            db.createObjectStore('app');
        // Product, material and link photos (js/photos.js)
        if (!db.objectStoreNames.contains('photos'))
            db.createObjectStore('photos');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
});
async function idbGet(store, key) {
    let db = await dbPromise;
    return new Promise((res, rej) => {
        let r = db.transaction(store).objectStore(store).get(key);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    });
}
async function idbSet(store, key, value) {
    let db = await dbPromise;
    return new Promise((res, rej) => {
        let t = db.transaction(store, 'readwrite');
        t.objectStore(store).put(value, key);
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
    });
}
async function idbDel(store, key) {
    let db = await dbPromise;
    return new Promise((res, rej) => {
        let t = db.transaction(store, 'readwrite');
        t.objectStore(store).delete(key);
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
    });
}
async function loadData() {
    let d = await idbGet('app', 'data');
    if (!d) {
        let old = null;
        try {
            old = JSON.parse(localStorage.getItem(KEY));
        }
        catch {
        }
        if (old) {
            await idbSet('app', 'data', old);
            try {
                localStorage.removeItem(KEY);
            }
            catch {
            }
            d = old;
        }
    }
    data = normalizeData(d);
}
let storagePersisted = null;
async function requestPersistentStorage() {
    try {
        if (navigator.storage?.persisted) {
            storagePersisted = await navigator.storage.persisted();
            if (!storagePersisted && navigator.storage.persist)
                storagePersisted = await navigator.storage.persist();
        }
    }
    catch {
    }
}
async function pdfAll() {
    let db = await dbPromise;
    return new Promise((res, rej) => {
        let r = db.transaction('pdfs').objectStore('pdfs').getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    });
}
async function pdfPut(v) {
    let db = await dbPromise;
    return new Promise((res, rej) => {
        let r = db.transaction('pdfs', 'readwrite').objectStore('pdfs').put(v);
        r.onsuccess = () => res();
        r.onerror = () => rej(r.error);
    });
}
async function pdfDelete(pid) {
    let db = await dbPromise;
    return new Promise((res, rej) => {
        let r = db.transaction('pdfs', 'readwrite').objectStore('pdfs').delete(pid);
        r.onsuccess = () => res();
        r.onerror = () => rej(r.error);
    });
}
let pdfCache = [];
async function refreshPdfs() {
    try {
        pdfCache = await pdfAll();
        setTimeout(fillMissingThumbs, 50);
        if (screen === 'patterns')
            render();
        if (screen === 'home' && $('patternCount'))
            $('patternCount').textContent = pdfCache.length;
        if (screen === 'productForm')
            fillPatternOptions();
    }
    catch (e) {
        console.error(e);
    }
}
function blobToDataUrl(b) {
    return new Promise((res, rej) => {
        let r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(b);
    });
}
function dataUrlToBlob(u) {
    let [head, body] = String(u).split(',');
    let mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    let bin = atob(body || ''), a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++)
        a[i] = bin.charCodeAt(i);
    return new Blob([a], { type: mime });
}
function canShareFiles() {
    try {
        return !!(navigator.canShare && navigator.canShare({ files: [new File(['{}'], 't.json', { type: 'application/json' })] }));
    }
    catch {
        return false;
    }
}
async function exportData(share) {
    try {
        let patterns = await pdfAll();
        let stamp = new Date();
        data.lastBackup = stamp.toISOString();
        let backup = { app: 'Crochet Studio', backupVersion: 3, exported: stamp.toISOString(), data, photos: await photosForBackup(), patterns: await Promise.all(patterns.map(async (p) => ({ id: p.id, name: p.name, date: p.date, mime: p.mime, thumb: p.thumb || '', thumbCustom: !!p.thumbCustom, dataUrl: await blobToDataUrl(p.blob) }))) };
        let name = 'crochet-studio-backup-' + stamp.toISOString().slice(0, 10) + '.json';
        let file = new File([JSON.stringify(backup)], name, { type: 'application/json' });
        if (share && canShareFiles()) {
            try {
                await navigator.share({ files: [file], title: 'Crochet Studio backup' });
            }
            catch (e) {
                if (e.name === 'AbortError')
                    return;
                throw e;
            }
        }
        else {
            let a = document.createElement('a'), u = URL.createObjectURL(file);
            a.href = u;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(u), 5000);
        }
        save();
        toast('Backup created.');
    }
    catch (e) {
        console.error(e);
        appAlert('Could not create the backup. ' + (e.message || ''));
    }
}
async function importData(e) {
    let f = e.target.files?.[0];
    e.target.value = '';
    if (!f)
        return;
    let parsed;
    try {
        parsed = JSON.parse(await f.text());
    }
    catch {
        return appAlert('That file is not a Crochet Studio backup.');
    }
    let d = parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
    if (!d || !(Array.isArray(d.products) || Array.isArray(d.materials)))
        return appAlert('That file is not a Crochet Studio backup.');
    let pats = Array.isArray(parsed.patterns) ? parsed.patterns : [];
    let summary = `${(d.products || []).length} products, ${(d.materials || []).length} materials, ${(d.markets || []).length} markets, ${(d.sales || []).length} sales${parsed.patterns ? `, ${pats.length} patterns` : ''}`;
    if (!await appConfirm(`Restore this backup?\n\n${summary}\n\n${signedIn() ? 'This replaces everything in the app and in your account, on all your devices.' : 'This replaces everything currently in the app.'}`))
        return;
    try {
        // Version 3 backups carry photos separately; older ones have them inside the data (moved out on save)
        await restorePhotosFromBackup(parsed.photos);
        data = normalizeData(d);
        externalizePhotos(data);
        await (saveQueue = saveQueue.then(photosWritten).then(() => idbSet('app', 'data', data)));
        if (parsed.patterns) {
            for (let p of await pdfAll())
                await pdfDelete(p.id);
            for (let p of pats)
                if (p && p.dataUrl)
                    await pdfPut({ id: p.id || id(), name: p.name || 'Pattern', date: p.date || new Date().toISOString(), mime: p.mime || 'application/pdf', thumb: p.thumb || '', thumbCustom: !!p.thumbCustom, thumbTried: !!p.thumb, blob: dataUrlToBlob(p.dataUrl) });
        }
        await refreshPdfs();
        markDirty();
        view('home');
        toast('Backup restored.');
    }
    catch (err) {
        console.error(err);
        appAlert('Could not restore the backup. Your phone may be low on storage.');
    }
}
async function resetData() {
    clearTimeout(saveTimer);
    saveTimer = null;
    let cloud = signedIn() && syncMeta.userId === session.user.id;
    if (!await appConfirm(cloud ? 'Delete all products, materials, sales, markets and patterns from this device AND from your account? They will be removed on all your devices. This cannot be undone.' : 'Delete all products, materials, sales, markets and patterns from this device? This cannot be undone.'))
        return;
    if (cloud) {
        if (!navigator.onLine)
            return appAlert('Connect to the internet first, so your account is cleared too.');
        let st = data.settings;
        for (let p of await pdfAll())
            await pdfDelete(p.id);
        data = normalizeData({ settings: st });
        flushSave();
        await saveQueue;
        await syncNow();
        location.reload();
        return;
    }
    await saveQueue;
    await idbDel('app', 'data');
    try {
        localStorage.removeItem(KEY);
    }
    catch {
    }
    for (let p of await pdfAll())
        await pdfDelete(p.id);
    await photoClearLocal();
    location.reload();
}
