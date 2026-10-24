// Photos for products, materials and pattern links.
// Part of the Crochet Studio app. Files load in the order listed in index.html.
//
// Each photo is an image file of its own: on the phone in IndexedDB (store "photos"), and with an account
// in Supabase Storage at user-files/<user id>/photos/<photo id>. The app data only holds a short reference,
// "ph:<photo id>", so saving on the phone and syncing to the account stay small and fast.
// Older data kept photos as long "data:image/..." text inside products; those are moved out automatically
// the next time the data is saved (see externalizePhotos, called from flushSave).

const PHOTO_REF = 'ph:';
const PHOTO_BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
let photoUrls = new Map(),      // photo id -> object URL for showing it
    photoRefOf = new Map(),     // data URL -> reference already made for it this session (no duplicates)
    photoUnsaved = new Map(),   // photo id -> image not yet written to the phone (written before the data is saved)
    photoLoading = new Set(),   // photo ids being fetched
    photoMissing = new Set(),   // photo ids that couldn't be found anywhere
    photoRedraw = null;

function isPhotoRef(v) {
    return typeof v === 'string' && v.startsWith(PHOTO_REF);
}
function photoIdOf(ref) {
    return isPhotoRef(ref) ? ref.slice(PHOTO_REF.length) : null;
}
// What an <img src> should use for a stored photo value (reference, or older data URL).
function photoUrl(v) {
    if (!v)
        return '';
    if (!isPhotoRef(v))
        return v;
    let pid = photoIdOf(v), u = photoUrls.get(pid);
    if (u)
        return u;
    fetchPhoto(pid);
    return PHOTO_BLANK;
}

// ---- On the phone (IndexedDB "photos" store) ----
async function photoGetLocal(pid) {
    return idbGet('photos', pid);
}
async function photoPutLocal(pid, blob) {
    return idbSet('photos', pid, { id: pid, blob, mime: blob.type || 'image/jpeg', at: Date.now() });
}
async function photoAllLocal() {
    let db = await dbPromise;
    return new Promise((res, rej) => {
        let r = db.transaction('photos').objectStore('photos').getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror = () => rej(r.error);
    });
}
async function photoClearLocal() {
    let db = await dbPromise;
    await new Promise((res, rej) => {
        let t = db.transaction('photos', 'readwrite');
        t.objectStore('photos').clear();
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
    });
    photoUrls.forEach(u => URL.revokeObjectURL(u));
    photoUrls.clear();
}
function photoRemember(pid, blob) {
    let old = photoUrls.get(pid);
    if (old)
        URL.revokeObjectURL(old);
    photoUrls.set(pid, URL.createObjectURL(blob));
    photoMissing.delete(pid);
}
// Load every photo on the phone before the first screen is drawn, so nothing flickers.
async function loadPhotoCache() {
    try {
        for (let r of await photoAllLocal())
            if (r?.blob)
                photoRemember(r.id, r.blob);
    }
    catch (e) {
        console.warn('Photos', e);
    }
}
// A photo that isn't on this phone yet (made on another device): fetch it from the account.
async function fetchPhoto(pid) {
    if (!pid || photoLoading.has(pid) || photoMissing.has(pid))
        return;
    photoLoading.add(pid);
    try {
        let r = await photoGetLocal(pid), blob = r?.blob;
        if (!blob && typeof signedIn === 'function' && signedIn() && navigator.onLine) {
            blob = await photoDown(pid);
            await photoPutLocal(pid, blob);
            (syncMeta.photos ||= {})[pid] = 1;
            saveSyncMeta();
        }
        if (blob) {
            photoRemember(pid, blob);
            clearTimeout(photoRedraw);
            photoRedraw = setTimeout(() => typeof softRender === 'function' ? softRender() : render(), 120);
        }
        else
            photoMissing.add(pid);
    }
    catch (e) {
        console.warn('Photo', pid, e);
        photoMissing.add(pid);
        setTimeout(() => photoMissing.delete(pid), 60000);
    }
    finally {
        photoLoading.delete(pid);
    }
}

// ---- Turning photos into references ----
// A photo given as a data URL (from the camera, the gallery, an old backup or older saved data)
// becomes its own file and a short reference. Runs right away; flushSave writes the file to the phone before it saves
// the app data, so the data never points at a photo that isn't stored. If writing fails (phone full), the data
// isn't saved either and both are tried again on the next save.
function photoRefFor(dataUrl) {
    let ref = photoRefOf.get(dataUrl);
    if (ref)
        return ref;
    let pid = id(), blob = dataUrlToBlob(dataUrl);
    photoRemember(pid, blob);
    photoUnsaved.set(pid, blob);
    ref = PHOTO_REF + pid;
    photoRefOf.set(dataUrl, ref);
    return ref;
}
function photoOwners(d) {
    return [...(d?.products || []), ...(d?.materials || []), ...(d?.patternLinks || [])];
}
function externalizePhotos(d) {
    let changed = false, fix = v => {
        if (typeof v === 'string' && v.startsWith('data:image')) {
            changed = true;
            return photoRefFor(v);
        }
        return v;
    };
    for (let o of photoOwners(d)) {
        if (!o)
            continue;
        if (o.photo)
            o.photo = fix(o.photo);
        if (Array.isArray(o.photos))
            o.photos = o.photos.map(fix);
    }
    return changed;
}
async function photosWritten() {
    for (let [pid, blob] of [...photoUnsaved]) {
        await photoPutLocal(pid, blob);
        photoUnsaved.delete(pid);
    }
}
// Every photo id the app data still uses.
function photoIdsInUse(d = data) {
    let ids = new Set();
    for (let o of photoOwners(d))
        for (let v of [o?.photo, ...(Array.isArray(o?.photos) ? o.photos : [])]) {
            let pid = photoIdOf(v);
            if (pid)
                ids.add(pid);
        }
    return ids;
}

// ---- Backups: the backup file still holds the photos themselves ----
// (blobToDataUrl and dataUrlToBlob live in storage.js)
async function photosForBackup(d = data) {
    let out = {};
    for (let pid of photoIdsInUse(d)) {
        let r = await photoGetLocal(pid).catch(() => null), blob = r?.blob;
        if (!blob && typeof signedIn === 'function' && signedIn() && navigator.onLine)
            blob = await photoDown(pid).catch(() => null);
        if (blob)
            out[pid] = await blobToDataUrl(blob);
    }
    return out;
}
async function restorePhotosFromBackup(photos) {
    for (let [pid, dataUrl] of Object.entries(photos || {}))
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image')) {
            let blob = dataUrlToBlob(dataUrl);
            await photoPutLocal(pid, blob);
            photoRemember(pid, blob);
            if (syncMeta?.photos)
                delete syncMeta.photos[pid];
        }
}

// ---- Account (Supabase Storage); used by the sync code in sync.js ----
const photoPath = pid => `${session.user.id}/photos/${encodeURIComponent(pid)}`;
async function photoUp(pid, blob) {
    await sbFetch(`/storage/v1/object/${SB_BUCKET}/${photoPath(pid)}`, { method: 'POST', headers: { 'Content-Type': blob.type || 'image/jpeg', 'x-upsert': 'true' }, body: blob });
}
async function photoDown(pid) {
    let r = await sbFetch(`/storage/v1/object/authenticated/${SB_BUCKET}/${photoPath(pid)}`, { raw: true });
    return await r.blob();
}
async function photoListCloud() {
    let r = await sbFetch(`/storage/v1/object/list/${SB_BUCKET}`, { method: 'POST', body: { prefix: session.user.id + '/photos/', limit: 10000, offset: 0 } });
    return (r || []).filter(o => o.name).map(o => `${session.user.id}/photos/${o.name}`);
}
// Upload photos the account doesn't have yet (each photo only once), and tidy up ones no longer used.
async function pushPhotos() {
    syncMeta.photos ||= {};
    let used = photoIdsInUse();
    for (let r of await photoAllLocal()) {
        if (!r?.blob || syncMeta.photos[r.id] || !used.has(r.id))
            continue;
        try {
            await photoUp(r.id, r.blob);
            syncMeta.photos[r.id] = 1;
        }
        catch (e) {
            if (e.code === 'network' || e.status === 401 || e.status >= 500)
                throw e;
            console.warn('Photo upload skipped', r.id, e);
            syncMeta.photos[r.id] = 'skip';
        }
        saveSyncMeta();
    }
}
async function cleanupPhotos() {
    // Photos removed from every product, material and link: delete them from the account and this phone.
    syncMeta.photos ||= {};
    let used = photoIdsInUse(), gone = Object.keys(syncMeta.photos).filter(pid => !used.has(pid));
    if (gone.length) {
        await fileDel(gone.map(photoPath));
        gone.forEach(pid => delete syncMeta.photos[pid]);
        saveSyncMeta();
    }
    await cleanupLocalPhotos();
}
// On this phone: remove photo files nothing has used for a day (also for people without an account).
async function cleanupLocalPhotos() {
    let used = photoIdsInUse(), drafts = photoUrlsInDrafts();
    for (let r of await photoAllLocal().catch(() => []))
        if (!used.has(r.id) && !drafts.has(r.id) && !photoUnsaved.has(r.id) && Date.now() - (r.at || 0) > 864e5) {
            await idbDel('photos', r.id).catch(() => {});
            let u = photoUrls.get(r.id);
            if (u)
                URL.revokeObjectURL(u);
            photoUrls.delete(r.id);
        }
}
// Photos in a form that hasn't been saved yet must not be tidied away.
function photoUrlsInDrafts() {
    let s = new Set();
    for (let v of [...(typeof productPhotos !== 'undefined' ? productPhotos : []), ...(typeof materialPhotos !== 'undefined' ? materialPhotos : []), ...(typeof quickPhotos !== 'undefined' ? quickPhotos : [])]) {
        let pid = photoIdOf(v);
        if (pid)
            s.add(pid);
    }
    return s;
}
// After pulling the account's data: fetch photos this phone doesn't have, so they work offline at a market.
async function fetchMissingPhotos() {
    syncMeta.photos ||= {};
    for (let pid of photoIdsInUse()) {
        if (photoUrls.has(pid))
            continue;
        try {
            let blob = await photoDown(pid);
            await photoPutLocal(pid, blob);
            photoRemember(pid, blob);
            syncMeta.photos[pid] = 1;
        }
        catch (e) {
            if (e.code === 'network')
                break;
            console.warn('Photo download', pid, e);
        }
    }
    saveSyncMeta();
}
