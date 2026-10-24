// Accounts and cloud sync with Supabase: sign-in, upload/download, keeping devices and tabs in step
// Part of the Crochet Studio app. Files load in the order listed in index.html.

// ===== Accounts & cloud sync (Supabase) =====
const SB_URL = 'https://jrxapujzegvsjgljzxrp.supabase.co', SB_KEY = 'sb_publishable_AV-UcJTr3h_YDD-lzLlJ7A_7MSUOq9a', SB_BUCKET = 'user-files', OTP_LEN = 6;
let session = lsGet('csSession', null), syncMeta = lsGet('csSync', {}), syncState = 'idle', syncError = '', applyingRemote = false, pushTimer = null, syncBusy = null, syncAgain = false, authFlow = {}, syncView = null, authBusy = false;
const signedIn = () => !!(session && session.user && session.user.id);
const tms = s => s ? Date.parse(s) || 0 : 0;
function saveSyncMeta() {
    lsSet('csSync', syncMeta);
}
class SbError extends Error {
    constructor(m, status, code) {
        super(m);
        this.status = status;
        this.code = code;
    }
}
async function sbFetch(path, { method = 'GET', body, headers = {}, auth = true, raw = false } = {}) {
    let h = { apikey: SB_KEY, ...headers };
    if (auth) {
        await ensureToken();
        if (!session?.access_token)
            throw new SbError('Please sign in again.', 401, 'no_session');
        h.Authorization = 'Bearer ' + session.access_token;
    }
    if (body !== undefined && !(body instanceof Blob)) {
        h['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
    }
    let r;
    try {
        r = await fetch(SB_URL + path, { method, headers: h, body });
    }
    catch (e) {
        throw new SbError('offline', 0, 'network');
    }
    if (!r.ok) {
        let j = {};
        try {
            j = await r.json();
        }
        catch {
        }
        throw new SbError(j.msg || j.message || j.error_description || j.error || ('Error ' + r.status), r.status, String(j.error_code || j.code || j.error || ''));
    }
    if (raw)
        return r;
    let t = await r.text();
    return t ? JSON.parse(t) : null;
}
function setSession(s) {
    if (s && s.access_token) {
        let u = s.user || session?.user || {};
        session = { access_token: s.access_token, refresh_token: s.refresh_token || session?.refresh_token, expires_at: Number(s.expires_at) || Math.floor(Date.now() / 1000) + (Number(s.expires_in) || 3600), user: { id: u.id, email: u.email } };
        if (u.email)
            lsSet('csLastEmail', u.email);
    }
    else
        session = null;
    lsSet('csSession', session);
}
let refreshing = null, lastUserCheck = 0, lostShown = false;
function ensureToken() {
    if (!session || session.expires_at - 90 > Date.now() / 1000)
        return Promise.resolve();
    if (!refreshing)
        refreshing = (async () => {
            try {
                setSession(await sbFetch('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: session.refresh_token } }));
            }
            catch (e) {
                if (e.status >= 400 && e.status < 500) {
                    setSession(null);
                    setTimeout(() => lostAccount('signedout'), 0);
                }
                throw e;
            }
            finally {
                refreshing = null;
            }
        })();
    return refreshing;
}
const authApi = {
    signUp: (email, password) => sbFetch('/auth/v1/signup', { method: 'POST', auth: false, body: { email, password } }),
    verify: (email, token, type) => sbFetch('/auth/v1/verify', { method: 'POST', auth: false, body: { email, token, type } }),
    resend: email => sbFetch('/auth/v1/resend', { method: 'POST', auth: false, body: { type: 'signup', email } }),
    signIn: (email, password) => sbFetch('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email, password } }),
    recover: email => sbFetch('/auth/v1/recover', { method: 'POST', auth: false, body: { email } }),
    updatePassword: password => sbFetch('/auth/v1/user', { method: 'PUT', body: { password } }),
    signOut: () => sbFetch('/auth/v1/logout?scope=local', { method: 'POST' }).catch(() => {
    })
};
function friendlyAuth(e) {
    let m = String(e?.message || ''), c = String(e?.code || ''), st = e?.status || 0;
    if (c === 'network')
        return "Couldn't connect. Check your internet and try again.";
    if (c === 'invalid_credentials' || /invalid login/i.test(m))
        return "That email and password don't match. Try again, or tap Forgot password.";
    if (c === 'otp_expired' || /expired|invalid.*(token|otp|code)|(token|otp).*invalid/i.test(m))
        return 'That code is wrong or has expired. Check the newest email, or tap Send a new code.';
    if (c.includes('rate_limit') || st === 429)
        return 'Too many tries or emails in a short time. Please wait a few minutes and try again.';
    if (c === 'weak_password' || /password should|weak password/i.test(m))
        return 'Choose a stronger password with at least 8 characters.';
    if (c === 'user_already_exists' || c === 'email_exists' || /already (registered|exists)/i.test(m))
        return 'An account with this email already exists. Sign in instead.';
    if (c === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(m))
        return "That email address doesn't look right.";
    if (c === 'no_session')
        return 'You have been signed out. Please sign in again.';
    if (st >= 500)
        return "The cloud service isn't responding right now. Try again in a minute.";
    return m || 'Something went wrong. Please try again.';
}
// ---- Cloud storage ----
const filePath = pid => `${session.user.id}/patterns/${encodeURIComponent(pid)}`;
const patMeta = p => ({ id: p.id, name: p.name, date: p.date, mime: p.mime, thumb: p.thumb || '', thumbCustom: !!p.thumbCustom });
async function cloudGet() {
    let r = await sbFetch(`/rest/v1/app_data?select=data,updated_at&user_id=eq.${session.user.id}`);
    return r && r[0] || null;
}
async function cloudHead() {
    let r = await sbFetch(`/rest/v1/app_data?select=updated_at&user_id=eq.${session.user.id}`);
    return r && r[0] || null;
}
async function cloudPut(payload, at) {
    await sbFetch('/rest/v1/app_data?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { user_id: session.user.id, data: payload, updated_at: at } });
}
async function fileUp(p) {
    await sbFetch(`/storage/v1/object/${SB_BUCKET}/${filePath(p.id)}`, { method: 'POST', headers: { 'Content-Type': p.mime || p.blob.type || 'application/octet-stream', 'x-upsert': 'true' }, body: p.blob });
}
async function fileDown(pid, mime) {
    let r = await sbFetch(`/storage/v1/object/authenticated/${SB_BUCKET}/${filePath(pid)}`, { raw: true });
    let b = await r.blob();
    return mime ? new Blob([b], { type: mime }) : b;
}
async function fileDel(paths) {
    if (paths.length)
        await sbFetch(`/storage/v1/object/${SB_BUCKET}`, { method: 'DELETE', body: { prefixes: paths } });
}
async function fileListAll() {
    let r = await sbFetch(`/storage/v1/object/list/${SB_BUCKET}`, { method: 'POST', body: { prefix: session.user.id + '/patterns/', limit: 1000, offset: 0 } });
    return (r || []).filter(o => o.name).map(o => `${session.user.id}/patterns/${o.name}`);
}
// ---- Change tracking (hooks into saving) ----
const _flushSave = flushSave, _pdfPut = pdfPut, _pdfDelete = pdfDelete;
flushSave = function () {
    let q = _flushSave();
    markDirty();
    return q;
};
pdfPut = async function (v) {
    await _pdfPut(v);
    markDirty();
};
pdfDelete = async function (pid) {
    await _pdfDelete(pid);
    if (!applyingRemote && syncMeta.userId) {
        syncMeta.pats = syncMeta.pats || {};
        if (syncMeta.pats[pid]) {
            (syncMeta.del = syncMeta.del || []).push(pid);
            delete syncMeta.pats[pid];
        }
        saveSyncMeta();
    }
    markDirty();
};
function markDirty() {
    if (applyingRemote || !syncMeta.userId)
        return;
    syncMeta.dirty = true;
    syncMeta.dirtyAt = new Date().toISOString();
    saveSyncMeta();
    schedulePush();
}
function schedulePush(ms = 3000) {
    if (!signedIn())
        return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(syncNow, ms);
}
// ---- Sync engine ----
function syncNow() {
    clearTimeout(pushTimer);
    if (syncBusy) {
        syncAgain = true;
        return syncBusy;
    }
    syncBusy = (async () => {
        try {
            do {
                syncAgain = false;
                await syncOnce();
            } while (syncAgain);
        }
        finally {
            syncBusy = null;
        }
    })();
    return syncBusy;
}
async function syncOnce() {
    if (!signedIn() || syncMeta.userId !== session.user.id)
        return;
    if (!navigator.onLine)
        return setSync('offline');
    setSync('syncing');
    try {
        if (Date.now() - lastUserCheck > 60000) {
            try {
                await sbFetch('/auth/v1/user');
                lastUserCheck = Date.now();
            }
            catch (e) {
                if (e.code === 'user_not_found' || /does not exist|not found/i.test(e.message) || e.status === 404) {
                    setSync('idle');
                    return lostAccount('deleted');
                }
                throw e;
            }
        }
        let head = await cloudHead(), remoteAt = tms(head?.updated_at);
        if (head && remoteAt > tms(syncMeta.lastServerAt) && !(syncMeta.dirty && tms(syncMeta.dirtyAt) > remoteAt))
            await pullApply();
        else if ((syncMeta.retry || []).length)
            await retryDownloads();
        if (syncMeta.dirty)
            await pushAll();
        syncMeta.lastOkAt = Date.now();
        saveSyncMeta();
        setSync('ok');
    }
    catch (e) {
        console.warn('Sync', e);
        setSync(e.code === 'network' ? 'offline' : 'error', friendlyAuth(e));
    }
}
async function pushAll(onProgress) {
    syncMeta.pats = syncMeta.pats || {};
    syncMeta.del = syncMeta.del || [];
    let startedAt = syncMeta.dirtyAt;
    if (syncMeta.del.length) {
        await fileDel(syncMeta.del.map(filePath));
        syncMeta.del = [];
        saveSyncMeta();
    }
    let local = await pdfAll(), up = local.filter(p => !syncMeta.pats[p.id] && p.blob), i = 0;
    onProgress?.(0, up.length);
    for (let p of up) {
        try {
            await fileUp(p);
            syncMeta.pats[p.id] = 1;
        }
        catch (e) {
            if (e.code === 'network' || e.status === 401 || e.status >= 500)
                throw e;
            console.warn('Upload skipped', p.name, e);
            syncMeta.pats[p.id] = 'skip';
            flash(`“${p.name}” is too large to save to your account. It stays on this phone.`);
        }
        saveSyncMeta();
        onProgress?.(++i, up.length);
    }
    // Photos go up once each as files (js/photos.js); the data row only carries their references
    await pushPhotos();
    let at = new Date().toISOString();
    await cloudPut({ ...data, _patterns: local.filter(p => syncMeta.pats[p.id] === 1).map(patMeta) }, at);
    syncMeta.lastServerAt = at;
    if (syncMeta.dirtyAt === startedAt)
        syncMeta.dirty = false;
    saveSyncMeta();
    cleanupPhotos().catch(e => console.warn('Photo cleanup', e));
}
async function pullApply(row, onProgress) {
    row = row || await cloudGet();
    if (!row)
        return;
    let d = { ...(row.data || {}) }, pats = Array.isArray(d._patterns) ? d._patterns : [];
    delete d._patterns;
    syncMeta.pats = syncMeta.pats || {};
    applyingRemote = true;
    try {
        data = normalizeData(d);
        // Data saved by an older version may still hold photos as text: move them out, then send the lighter data back
        let movedPhotos = externalizePhotos(data);
        await (saveQueue = saveQueue.then(photosWritten).then(() => idbSet('app', 'data', data)));
        let local = await pdfAll(), byId = Object.fromEntries(local.map(p => [p.id, p])), cloudIds = new Set(pats.map(p => p.id));
        for (let p of local)
            if (!cloudIds.has(p.id) && syncMeta.pats[p.id] === 1) {
                await _pdfDelete(p.id);
                delete syncMeta.pats[p.id];
            }
        for (let m of pats) {
            let l = byId[m.id];
            if (!l)
                continue;
            syncMeta.pats[m.id] = 1;
            if (l.name !== m.name || (m.thumb && l.thumb !== m.thumb))
                await _pdfPut({ ...l, name: m.name, thumb: m.thumb || l.thumb, thumbCustom: !!m.thumbCustom, thumbTried: true });
        }
        syncMeta.retry = pats.filter(m => !byId[m.id]);
        syncMeta.lastServerAt = row.updated_at;
        syncMeta.dirty = false;
        if (movedPhotos || local.some(p => !cloudIds.has(p.id) && !syncMeta.pats[p.id])) {
            syncMeta.dirty = true;
            syncMeta.dirtyAt = new Date().toISOString();
        }
        saveSyncMeta();
    }
    finally {
        applyingRemote = false;
    }
    await refreshPdfs();
    onProgress?.(0, syncMeta.retry.length);
    await retryDownloads(onProgress);
    // Photos made on another device: bring them to this phone so they show offline too
    await fetchMissingPhotos().catch(e => console.warn('Photos', e));
    softRender();
}
async function retryDownloads(onProgress) {
    let list = syncMeta.retry || [], i = 0;
    for (let m of list.slice()) {
        try {
            let blob = await fileDown(m.id, m.mime);
            applyingRemote = true;
            try {
                await _pdfPut({ id: m.id, name: m.name, date: m.date, mime: m.mime, thumb: m.thumb || '', thumbCustom: !!m.thumbCustom, thumbTried: !!m.thumb, blob });
            }
            finally {
                applyingRemote = false;
            }
            syncMeta.pats[m.id] = 1;
            syncMeta.retry = syncMeta.retry.filter(x => x.id !== m.id);
            saveSyncMeta();
        }
        catch (e) {
            if (e.code === 'network')
                throw e;
            console.warn('Pattern download', m.name, e);
        }
        onProgress?.(++i, list.length);
    }
    if (list.length)
        await refreshPdfs();
}
function isBusyScreen() {
    let a = document.activeElement;
    return /^auth/.test(screen) || ['productForm', 'materialForm', 'marketForm', 'marketInfo', 'marketTodo', 'settingsPricing', 'settingsTax', 'settingsAccount'].includes(screen) || marketSaleMode || !!$('modal') || !!$('appDialog') || !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
}
function softRender() {
    if (isBusyScreen())
        return;
    try {
        render();
    }
    catch (e) {
        console.warn(e);
        view('home');
    }
}
function ago(t) {
    let s = (Date.now() - t) / 1000;
    if (s < 60)
        return 'just now';
    if (s < 3600)
        return Math.floor(s / 60) + ' min ago';
    return new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function syncText() {
    if (!signedIn())
        return '';
    if (syncMeta.userId !== session.user.id)
        return 'Setup not finished';
    if (syncState === 'syncing')
        return 'Syncing…';
    if (syncState === 'offline')
        return 'Offline · changes are saved on this phone and will sync later';
    if (syncState === 'error')
        return "Couldn't reach the cloud · your changes are saved on this phone";
    if (syncMeta.dirty)
        return 'Waiting to sync…';
    return syncMeta.lastOkAt ? 'All synced · ' + ago(syncMeta.lastOkAt) : 'Not synced yet';
}
function syncStripInner() {
    let ready = signedIn() && syncMeta.userId === session.user.id;
    return `${ic(syncState === 'ok' && !syncMeta.dirty ? 'cloud' : 'sync', 20)}<span class="grow">${esc(syncText())}</span>${ready ? (syncState === 'syncing' ? '' : '<button class="small alt" onclick="syncNow()">Sync now</button>') : '<button class="small" onclick="afterAuth()">Finish setup</button>'}`;
}
function setSync(s, msg) {
    syncState = s;
    syncError = msg || '';
    let e = $('syncStatus');
    if (e)
        e.innerHTML = syncStripInner();
}
// ---- Local data helpers ----
function countsOf() {
    let ph = 0;
    for (let x of [...data.products, ...data.materials])
        ph += Array.isArray(x.photos) && x.photos.length ? x.photos.length : (x.photo ? 1 : 0);
    return { products: data.products.length, materials: data.materials.length, markets: data.markets.length, sales: data.sales.length, photos: ph, patterns: pdfCache.length };
}
function hasLocalData() {
    let c = countsOf();
    return !!(c.products || c.materials || c.markets || c.sales || c.patterns);
}
function localSummary() {
    let c = countsOf();
    return [[c.products, 'product'], [c.materials, 'material'], [c.patterns, 'pattern'], [c.markets, 'market']].filter(x => x[0]).map(([n, w]) => `${n} ${w}${n === 1 ? '' : 's'}`).join(', ') || 'some data';
}
async function clearLocal() {
    clearTimeout(saveTimer);
    saveTimer = null;
    clearTimeout(pushTimer);
    await saveQueue;
    applyingRemote = true;
    try {
        await idbDel('app', 'data');
        for (let p of await pdfAll())
            await _pdfDelete(p.id);
        await photoClearLocal();
    }
    finally {
        applyingRemote = false;
    }
}
// ---- Flow ----
async function busy(fn) {
    if (authBusy)
        return;
    authBusy = true;
    document.body.classList.add('busy');
    try {
        await fn();
    }
    catch (e) {
        console.warn(e);
        await appAlert(friendlyAuth(e));
    }
    finally {
        authBusy = false;
        document.body.classList.remove('busy');
    }
}
function authSwap(s) {
    let em = $('suEmail') || $('siEmail') || $('fpEmail');
    if (em)
        authFlow.email = em.value.trim();
    screen = s;
    render();
    scrollTo(0, 0);
}
function useLocalOnly() {
    lsSet('csLocalOnly', true);
    view('home');
}
function soon(n) {
    flash(`${n} sign-in is coming soon. Use email for now.`);
}
async function afterAuth() {
    if (!signedIn())
        return view('authWelcome');
    let uid = session.user.id;
    await refreshPdfs();
    if (syncMeta.userId === uid) {
        lsSet('csLocalOnly', null);
        view('home');
        syncNow();
        return;
    }
    let row;
    try {
        row = await cloudGet();
    }
    catch (e) {
        await appAlert(friendlyAuth(e) + '\n\nYou can finish setting up later in Settings › Account.');
        if (/^auth/.test(screen))
            view('home');
        return;
    }
    if (row) {
        if (hasLocalData()) {
            let useCloud = await appDialog({ title: 'This phone already has data', message: `Your account already has saved data, and this phone has its own (${localSummary()}).\n\nUse your account's data on this phone? The phone's current data will be replaced.`, ok: "Use account's data", cancel: "Keep this phone's" });
            if (!useCloud) {
                if (!await appConfirm("Replace everything saved in your account with this phone's data? This changes it on all your devices.", { ok: 'Replace account data', danger: true }))
                    return afterAuth();
                return startUpload();
            }
        }
        return startDownload(row);
    }
    view('authSetup');
}
async function startUpload() {
    syncMeta = { userId: session.user.id, pats: {}, del: [], dirty: true, dirtyAt: new Date().toISOString() };
    saveSyncMeta();
    lsSet('csLocalOnly', null);
    syncView = { mode: 'up', phase: 'patterns', i: 0, n: pdfCache.length };
    view('authSync');
    await runSyncView(() => pushAll((i, n) => {
        syncView.i = i;
        syncView.n = n;
        drawSync();
    }));
}
async function startDownload(row) {
    applyingRemote = true;
    try {
        for (let p of await pdfAll())
            await _pdfDelete(p.id);
        await photoClearLocal();
    }
    finally {
        applyingRemote = false;
    }
    await refreshPdfs();
    syncMeta = { userId: session.user.id, pats: {}, del: [] };
    saveSyncMeta();
    lsSet('csLocalOnly', null);
    syncView = { mode: 'down', phase: 'data', i: 0, n: (row?.data?._patterns || []).length };
    view('authSync');
    await runSyncView(() => pullApply(row, (i, n) => {
        syncView.phase = 'patterns';
        syncView.i = i;
        syncView.n = n;
        drawSync();
    }));
}
async function runSyncView(fn) {
    try {
        await fn();
        syncView.phase = 'done';
        syncMeta.lastOkAt = Date.now();
        saveSyncMeta();
        setSync('ok');
    }
    catch (e) {
        console.warn(e);
        syncView.phase = 'error';
        syncView.error = friendlyAuth(e);
    }
    drawSync();
}
function retrySyncView() {
    let up = syncView?.mode === 'up';
    syncView = { ...syncView, phase: up ? 'patterns' : 'data', i: 0, error: '' };
    drawSync();
    runSyncView(up ? () => pushAll((i, n) => {
        syncView.i = i;
        syncView.n = n;
        drawSync();
    }) : () => pullApply(null, (i, n) => {
        syncView.phase = 'patterns';
        syncView.i = i;
        syncView.n = n;
        drawSync();
    }));
}
function drawSync() {
    if (screen === 'authSync')
        render();
}
function finishAuth() {
    let nm = data.settings.userName;
    view('home');
    flash(nm ? `You're all set, ${nm}!` : "You're all set!");
}
// ---- Actions ----
async function doSignup() {
    let email = $('suEmail').value.trim().toLowerCase(), pw = $('suPass').value;
    if (!/^\S+@\S+\.\S+$/.test(email))
        return needField('suEmail', 'Enter your email address.');
    if (pw.length < 8)
        return needField('suPass', 'Choose a password with at least 8 characters.');
    if ($('suPass2') && $('suPass2').value !== pw)
        return needField('suPass2', 'The passwords don’t match. Type the same password in both boxes.');
    await busy(async () => {
        let r = await authApi.signUp(email, pw);
        authFlow = { purpose: 'signup', email, pw };
        if (r && r.access_token) {
            setSession(r);
            return afterAuth();
        }
        let u = r?.user || r;
        if (u && Array.isArray(u.identities) && !u.identities.length) {
            await appAlert('An account with this email already exists. Sign in instead.');
            return authSwap('authSignin');
        }
        go('authVerify');
    });
}
async function doSignin() {
    let email = $('siEmail').value.trim().toLowerCase(), pw = $('siPass').value;
    if (!/^\S+@\S+\.\S+$/.test(email))
        return needField('siEmail', 'Enter your email address.');
    if (!pw)
        return needField('siPass', 'Enter your password.');
    await busy(async () => {
        authFlow = { purpose: 'signin', email };
        try {
            setSession(await authApi.signIn(email, pw));
        }
        catch (e) {
            if (e.code === 'email_not_confirmed' || /not confirmed/i.test(e.message)) {
                authFlow.purpose = 'signup';
                authFlow.pw = pw;
                try {
                    await authApi.resend(email);
                }
                catch {
                }
                await appAlert('Please confirm your email first. We just sent you a new email.');
                return go('authVerify');
            }
            throw e;
        }
        await afterAuth();
    });
}
async function doForgot() {
    let email = $('fpEmail').value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email))
        return needField('fpEmail', 'Enter the email address you signed up with.');
    await busy(async () => {
        await authApi.recover(email);
        authFlow = { purpose: 'recovery', email };
        go('authVerify');
    });
}
async function doLinkConfirmed() {
    if (!authFlow.pw) {
        await appAlert('Sign in with your email and password to continue.');
        return authSwap('authSignin');
    }
    await busy(async () => {
        try {
            setSession(await authApi.signIn(authFlow.email, authFlow.pw));
        }
        catch (e) {
            if (e.code === 'email_not_confirmed' || /not confirmed/i.test(e.message))
                return appAlert("Your email isn't confirmed yet. Open the newest email from Crochet Studio and tap the link in it, then try again.");
            throw e;
        }
        delete authFlow.pw;
        await afterAuth();
    });
}
function otpBoxes() {
    return [...document.querySelectorAll('#otp input')];
}
function otpInput(el, e) {
    let boxes = otpBoxes(), v = el.value.replace(/\D/g, '');
    if (e && e.inputType === 'insertText' && v.length === 2)
        v = v.slice(-1);
    if (v.length > 1) {
        let i = +el.dataset.i;
        for (let ch of v) {
            if (i >= boxes.length)
                break;
            boxes[i++].value = ch;
        }
        boxes[Math.min(i, boxes.length - 1)].focus();
    }
    else {
        el.value = v;
        if (v && el.nextElementSibling)
            el.nextElementSibling.focus();
    }
    if (boxes.every(b => b.value))
        doVerify();
}
function otpKey(e, el) {
    if (e.key === 'Backspace' && !el.value && el.previousElementSibling) {
        e.preventDefault();
        el.previousElementSibling.value = '';
        el.previousElementSibling.focus();
    }
}
async function doVerify() {
    let code = otpBoxes().map(b => b.value).join('');
    if (code.length < OTP_LEN)
        return appAlert(`Enter the ${OTP_LEN}-digit code from the email.`);
    await busy(async () => {
        let rec = authFlow.purpose === 'recovery', r;
        try {
            r = await authApi.verify(authFlow.email, code, rec ? 'recovery' : 'email');
        }
        catch (e) {
            if (rec || e.code === 'network')
                throw e;
            try {
                r = await authApi.verify(authFlow.email, code, 'signup');
            }
            catch {
                throw e;
            }
        }
        setSession(r);
        if (rec)
            return view('authNewPassword');
        await afterAuth();
    });
    if (screen === 'authVerify') {
        for (let b of otpBoxes())
            b.value = '';
        otpBoxes()[0]?.focus();
    }
}
async function resendCode() {
    await busy(async () => {
        if (authFlow.purpose === 'recovery')
            await authApi.recover(authFlow.email);
        else
            await authApi.resend(authFlow.email);
        flash('A new email is on its way.');
    });
}
async function saveNewPassword(fid, inModal) {
    let pw = $(fid).value;
    if (pw.length < 8)
        return needField(fid, 'Choose a password with at least 8 characters.');
    if ($(fid + '2') && $(fid + '2').value !== pw)
        return needField(fid + '2', 'The passwords don’t match. Type the same password in both boxes.');
    await busy(async () => {
        await authApi.updatePassword(pw);
        if (inModal) {
            closeModal();
            flash('Password changed.');
        }
        else if (authFlow.viaLink) {
            setSession(null);
            authFlow = { done: 'password' };
            view('authLinkDone');
        }
        else {
            flash('New password saved.');
            await afterAuth();
        }
    });
}
async function finishSetup(mode) {
    let nm = normName($('setName')?.value || '');
    if (mode === 'fresh' && !await appConfirm('Start fresh? The data on this phone will be removed. Download a backup first (Settings › Backup) if you want to keep a copy.', { ok: 'Start fresh', danger: true }))
        return;
    if (nm)
        data.settings.userName = nm;
    if (mode === 'fresh') {
        let s = data.settings;
        applyingRemote = true;
        try {
            for (let p of await pdfAll())
                await _pdfDelete(p.id);
        }
        finally {
            applyingRemote = false;
        }
        data = normalizeData({ settings: s });
        await refreshPdfs();
    }
    await (saveQueue = saveQueue.then(() => idbSet('app', 'data', data)));
    startUpload();
}
function openChangePassword() {
    openModal(`<div class="row"><h2 style="margin:0">Change password</h2>${closeX()}</div><label for="npw">New password</label>${pwField('npw', 'new-password', `onkeydown="if(event.key==='Enter')saveNewPassword('npw',true)"`)}<div class="hint">At least 8 characters</div><label for="npw2">Confirm new password</label>${pwField('npw2', 'new-password', `onkeydown="if(event.key==='Enter')saveNewPassword('npw',true)"`)}<div class="actions"><button onclick="saveNewPassword('npw',true)">Save password</button></div>`);
    setTimeout(() => $('npw')?.focus(), 60);
}
async function signOut() {
    if (syncMeta.dirty && navigator.onLine) {
        flash('Syncing your last changes…');
        await syncNow();
    }
    let unsynced = syncMeta.dirty;
    if (!await appDialog({ title: 'Sign out?', message: (unsynced ? "Some changes haven't synced yet. If you sign out now they will be lost.\n\n" : '') + 'Everything is saved in your account. Signing out removes it from this device; sign in again any time to get it back.', ok: 'Sign out', cancel: 'Cancel', danger: unsynced }))
        return;
    await authApi.signOut();
    await clearLocal();
    setSession(null);
    syncMeta = {};
    saveSyncMeta();
    lsSet('csLocalOnly', null);
    location.reload();
}
async function deleteAccount() {
    if (!await appDialog({ title: 'Delete your account?', message: 'This permanently deletes your account and everything saved in it: products, materials, markets, sales, photos and patterns, on every device.\n\nDownload a backup first (Settings › Backup) if you might want any of it.', ok: 'Delete account', cancel: 'Cancel', danger: true }))
        return;
    if (!navigator.onLine)
        return appAlert('You need an internet connection to delete your account.');
    await busy(async () => {
        flash('Deleting your account…');
        let uid = session.user.id;
        await fileDel(await fileListAll());
        await fileDel(await photoListCloud());
        await sbFetch(`/rest/v1/app_data?user_id=eq.${uid}`, { method: 'DELETE' });
        await sbFetch('/rest/v1/rpc/delete_user', { method: 'POST', body: {} });
        await clearLocal();
        setSession(null);
        syncMeta = {};
        saveSyncMeta();
        lsSet('csLocalOnly', null);
        lsSet('csLastEmail', null);
        await appAlert('Your account and everything in it has been deleted.');
        location.reload();
    });
}
async function authBoot() {
    let h = new URLSearchParams(location.hash.slice(1));
    if (h.get('access_token') || h.get('error_description')) {
        try {
            history.replaceState(null, '', location.pathname + location.search);
        }
        catch {
        }
        if (h.get('error_description'))
            setTimeout(() => appAlert((h.get('error_code') === 'otp_expired' ? 'That email link has expired or was already used. ' : '') + 'Please sign in, or ask for a new code.'), 300);
        else {
            let prevSession = session;
            setSession({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: h.get('expires_in'), expires_at: h.get('expires_at'), user: {} });
            try {
                let u = await sbFetch('/auth/v1/user');
                if (h.get('type') === 'recovery') {
                    session.user = { id: u.id, email: u.email };
                    lsSet('csSession', session);
                    authFlow = { purpose: 'recovery', email: u.email, viaLink: true };
                    screen = 'authNewPassword';
                    return;
                }
                lsSet('csLastEmail', u.email);
                let keep = signedIn() && session.user.id === u.id && syncMeta.userId === u.id;
                if (!keep)
                    setSession(prevSession);
                authFlow = { done: 'email', email: u.email };
                screen = 'authLinkDone';
                return;
            }
            catch (e) {
                console.warn(e);
                setSession(prevSession);
            }
        }
    }
    if (signedIn()) {
        if (syncMeta.userId === session.user.id) {
            syncNow();
            return;
        }
        await afterAuth();
        return;
    }
    if (!syncMeta.userId && !lsGet('csLocalOnly', false))
        screen = 'authWelcome';
}
// ---- Account deleted / signed out elsewhere ----
async function lostAccount(kind) {
    if (lostShown || !syncMeta.userId)
        return;
    lostShown = true;
    clearTimeout(pushTimer);
    let wasDeleted = kind === 'deleted';
    if (wasDeleted)
        setSession(null);
    let remove = await appDialog({ title: wasDeleted ? 'This account was deleted' : "You've been signed out", message: (wasDeleted ? 'It may have been deleted from another device.' : 'Your account may have been deleted on another device, or your sign-in expired.') + " The data on this phone hasn't been touched.\n\nKeep using it on this phone, or remove it?", ok: 'Remove it from this phone', cancel: 'Keep it on this phone', danger: true });
    if (remove && await appConfirm('Remove all products, materials, markets, sales, photos and patterns from this phone? This cannot be undone.', { ok: 'Remove', danger: true })) {
        await clearLocal();
        setSession(null);
        syncMeta = {};
        saveSyncMeta();
        lsSet('csLocalOnly', null);
        location.reload();
        return;
    }
    if (wasDeleted) {
        syncMeta = {};
        saveSyncMeta();
        lsSet('csLocalOnly', true);
    }
    lostShown = false;
    setSync('idle');
    if (/^auth/.test(screen))
        view('home');
    else
        softRender();
    flash(wasDeleted ? "You're now using the app without an account. Your data is on this phone." : 'Your data is on this phone. Sign in again any time in Settings › Account.');
}
// ===== Keep the installed app and browser tabs in step =====
let myStamp = '', lastSquareRef = null, tabReloading = false;
(() => {
    const _fs = flushSave;
    flushSave = function () {
        let q = _fs();
        q.then(() => {
            myStamp = Date.now() + ':' + Math.random().toString(36).slice(2);
            lsSet('csStamp', myStamp);
        });
        return q;
    };
})();
(() => {
    const _pp = pdfPut, _pd = pdfDelete;
    pdfPut = async function (v) {
        await _pp(v);
        myStamp = Date.now() + ':p';
        lsSet('csStamp', myStamp);
    };
    pdfDelete = async function (pid) {
        await _pd(pid);
        myStamp = Date.now() + ':d';
        lsSet('csStamp', myStamp);
    };
})();
async function reloadFromOtherTab() {
    if (tabReloading || !dataLoaded)
        return;
    tabReloading = true;
    try {
        clearTimeout(saveTimer);
        saveTimer = null;
        await saveQueue;
        await loadData();
        await refreshPdfs();
        myStamp = lsGet('csStamp', '');
        if (lastSquareRef && data.orders.some(o => o.payment?.ref === lastSquareRef)) {
            let quick = saleKind === 'quick', o = data.orders.find(o => o.payment.ref === lastSquareRef);
            lastSquareRef = null;
            marketSaleMode = false;
            resetSale();
            closeOverlays();
            navStack = [];
            if (quick)
                screen = 'quickSale';
            else {
                marketSelected = o.marketId || marketSelected;
                screen = 'marketDetail';
            }
            render();
            scrollTo(0, 0);
            toast(`Card payment approved · ${cash(o.total)}. Sale saved.`);
            return;
        }
        if (lastSquareRef && !lsGet('csSquarePending', null)) {
            lastSquareRef = null;
        }
        softRender();
    }
    catch (e) {
        console.warn('Reload from other tab', e);
    }
    finally {
        tabReloading = false;
    }
}
