// Starts the app: global event listeners, after-render hooks, loading data, offline support
// Part of The Makers Nook app. Files load in the order listed in index.html.

addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && saveTimer)
        flushSave();
});
addEventListener('pagehide', () => {
    if (saveTimer)
        flushSave();
});
addEventListener('popstate', e => {
    if ($('viewer')) {
        removeViewer();
        e.stopImmediatePropagation();
    }
});
addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installPromptEvent = e;
    if (screen === 'home' || screen === 'settings' || screen === 'authWelcome')
        render();
});
addEventListener('appinstalled', () => {
    installPromptEvent = null;
    toast('The Makers Nook installed.');
});
addEventListener('popstate', () => {
    let byApp = appBack;
    appBack = false;
    if (skipPop) {
        skipPop = false;
        for (; pendingPushes > 0; pendingPushes--)
            try {
                history.pushState({ cs: navStack.length - pendingPushes + 1 }, '');
            }
            catch {
            }
        return;
    }
    // A pop-up is open: the back button closes it and the screen underneath stays put
    if (!byApp && closeTopOverlay()) {
        try {
            history.pushState({ cs: navStack.length }, '');
        }
        catch {
        }
        return;
    }
    // Leaving a form with unsaved changes: stay, and ask first
    if (!byApp && formDirty && FORM_SCREENS.includes(screen)) {
        try {
            history.pushState({ cs: navStack.length }, '');
        }
        catch {
        }
        leaveForm(() => history.back());
        return;
    }
    let st = navStack.pop();
    if (st)
        restoreNav(st);
});
document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing)
        return;
    let t = e.target;
    if (!t || t.tagName !== 'INPUT' || ['checkbox', 'radio', 'button', 'submit', 'file', 'range'].includes(t.type))
        return;
    setTimeout(() => {
        if (document.activeElement === t)
            t.blur();
    }, 0);
});
new MutationObserver(() => {
    for (let i of document.querySelectorAll('input:not([enterkeyhint])'))
        i.setAttribute('enterkeyhint', 'done');
}).observe(document.body, { childList: true, subtree: true });
new MutationObserver(() => linkLabels()).observe(document.body, { childList: true, subtree: true });
addEventListener('online', () => syncNow());
addEventListener('offline', () => setSync('offline'));
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' || syncMeta.dirty)
        syncNow();
});
setInterval(() => {
    if (document.visibilityState === 'visible')
        syncNow();
}, 120000);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible')
        setTimeout(checkSquarePending, 1500);
});
addEventListener('storage', e => {
    if (e.key === 'csStamp' && e.newValue && e.newValue !== myStamp)
        reloadFromOtherTab();
});
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        let st = lsGet('csStamp', '');
        if (st && myStamp && st !== myStamp)
            reloadFromOtherTab();
    }
});
addEventListener('popstate', () => {
    if ($('viewer')?.dataset.pattern)
        lsSet('csPatternOpen', null);
}, true);
function v23AfterRender() {
    if (screen === 'home')
        maybeWhatsNew();
    if (screen === 'patterns' && !$('viewer')) {
        let mem = lsGet('csPatternOpen', null);
        if (mem && pdfCache.some(p => p.id === mem.id))
            openPattern(mem.id, { restore: true, silent: true });
    }
}
// Swipe-to-delete on product and material cards
document.addEventListener('pointerdown', swipeDown, { passive: true });
document.addEventListener('pointermove', swipeMove, { passive: true });
document.addEventListener('pointerup', swipeUp);
document.addEventListener('pointercancel', () => { if (swipeNow) { swipeNow.card.style.transition = ''; swipeNow.card.style.transform = swipeNow.base ? `translateX(${-SWIPE_W}px)` : ''; swipeNow = null; } });
document.addEventListener('click', swipeClick, true);
// ---- A sale in progress survives the app being closed or refreshed (nothing is charged until Complete sale) ----
let saleDraftReady = false;
function keepSaleDraft() {
    if (!saleDraftReady)
        return;
    let on = marketSaleMode && Object.values(marketSaleDraft || {}).some(q => q > 0);
    lsSet('csSaleDraft', on ? { at: Date.now(), kind: saleKind, marketId: marketSelected, draft: marketSaleDraft, adj: saleAdj, pay: payTmp } : null);
}
function restoreSaleDraft() {
    let sd = lsGet('csSaleDraft', null);
    saleDraftReady = true;
    if (!sd || screen !== 'home' || lsGet('csSquarePending', null) || Date.now() - sd.at > 12 * 3600e3)
        return lsSet('csSaleDraft', null);
    let draft = Object.fromEntries(Object.entries(sd.draft || {}).filter(([pid, q]) => q > 0 && product(pid)));
    if (!Object.keys(draft).length)
        return lsSet('csSaleDraft', null);
    if (sd.kind === 'quick')
        startQuickSale();
    else {
        let m = data.markets.find(x => x.id === sd.marketId && !x.completed);
        if (!m)
            return lsSet('csSaleDraft', null);
        view('markets');
        openMarket(m.id);
        saleKind = 'market';
        marketSaleMode = true;
    }
    marketSaleDraft = draft;
    saleAdj = sd.adj || { prices: {}, discount: null };
    payTmp = sd.pay || { method: 'cash', given: '' };
    render();
    flash('Your unfinished sale is back where you left it.');
}
// ---- "Discard changes?" when leaving a form with edits that aren't saved ----
const FORM_SCREENS = ['productForm', 'materialForm', 'marketForm', 'marketInfo', 'expenseForm'];
const markFormDirty = e => {
    // Only real typing and tapping counts (the app itself also updates fields while drawing a form)
    // Typed fields count on 'input'; their late 'change' (when the field loses focus, maybe after Save) doesn't
    if (e.type === 'change' && !(e.target?.tagName === 'SELECT' || ['checkbox', 'radio'].includes(e.target?.type)))
        return;
    if (e.isTrusted && FORM_SCREENS.includes(screen) && e.target?.closest?.('#app') && !e.target.closest('.searchbox'))
        formDirty = true;
};
document.addEventListener('input', markFormDirty, true);
document.addEventListener('change', markFormDirty, true);
function leaveForm(then) {
    appConfirm('Discard your changes?\n\nWhat you changed on this screen hasn’t been saved.', { ok: 'Discard', cancel: 'Keep editing', danger: true }).then(y => {
        if (y) {
            formDirty = false;
            then();
        }
    });
}
const goBackPlain = goBack, viewPlain = view, goPlain = go;
goBack = function () {
    if (formDirty && FORM_SCREENS.includes(screen))
        return leaveForm(goBackPlain);
    formDirty = false;
    return goBackPlain();
};
view = function (s) {
    if (formDirty && FORM_SCREENS.includes(screen) && s !== screen)
        return leaveForm(() => viewPlain(s));
    formDirty = false;
    return viewPlain(s);
};
go = function (...a) {
    formDirty = false;
    return goPlain(...a);
};
const originalRender = render;
render = function () {
    document.body.dataset.screen = screen;
    originalRender();
    if (loadFailed)
        return;
    keepSaleDraft();
    try {
        v23AfterRender();
    }
    catch (e) {
        console.warn(e);
    }
    if (screen === 'materialForm')
        setMaterialFormDefaults();
    if (screen === 'productForm') {
        let p = product(editing) || (!editing && product(productCopyOf));
        $('pmethod').value = p?.method || data.settings.method;
        fillPatternOptions();
        updatePrice();
    }
    if (screen === 'settingsPricing') {
        $('smethod').value = data.settings.method;
        $('srounding').value = data.settings.rounding;
    }
    if (screen === 'home' && $('patternCount'))
        $('patternCount').textContent = pdfCache.length;
};
(async () => {
    $('app').innerHTML = '<p class="muted">Loading…</p>';
    try {
        await loadData();
    }
    catch (e) {
        console.error(e);
        // render() shows a plain message instead of an empty app. 'storage' = the browser won't let the app save at all
        loadFailed = await dbPromise.then(() => true, () => 'storage');
    }
    dataLoaded = true;
    delete data.settings.theme;
    // Photos: show them straight away, and move any still stored inside the data out to their own files (js/photos.js)
    await loadPhotoCache();
    if (externalizePhotos(data))
        flushSave();
    setTimeout(() => cleanupLocalPhotos().catch(() => {}), 20000);
    await refreshPdfs();
    try {
        await authBoot();
    }
    catch (e) {
        console.warn(e);
    }
    try {
        await handleSquareReturn();
    }
    catch (e) {
        console.warn(e);
    }
    myStamp = lsGet('csStamp', '');
    render();
    restoreSaleDraft();
    // The app always opens on Home. A pattern that was open comes back when you tap Patterns (v23AfterRender).
    setTimeout(checkSquarePending, 1500);
    requestPersistentStorage().then(() => {
        if (screen === 'settingsBackup')
            render();
    });
})();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const hadController = !!navigator.serviceWorker.controller;
    const openedAt = Date.now();
    let touched = false;
    addEventListener('pointerdown', () => touched = true, { once: true, capture: true });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || $('updateBar'))
            return;
        // A newer version finished downloading. Just opened and not used yet: switch to it straight away.
        // Otherwise offer it, so nothing being typed is interrupted.
        if (!touched && Date.now() - openedAt < 15000 && !marketSaleMode && !formDirty)
            return location.reload();
        document.body.insertAdjacentHTML('beforeend', '<div id="updateBar">New version ready<button onclick="location.reload()">Refresh</button></div>');
    });
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker not registered', e)));
    // Check for a newer version every time the app comes to the front, not only when the phone decides to
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine)
            navigator.serviceWorker.getRegistration().then(r => r?.update()).catch(() => {});
    });
}
