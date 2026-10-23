// Starts the app: global event listeners, after-render hooks, loading data, offline support
// Part of the Crochet Studio app. Files load in the order listed in index.html.

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
    toast('Crochet Studio installed.');
});
addEventListener('popstate', () => {
    if (skipPop) {
        skipPop = false;
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
    if (screen === 'reports')
        foldReports();
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
const originalRender = render;
render = function () {
    document.body.dataset.screen = screen;
    originalRender();
    try {
        v23AfterRender();
    }
    catch (e) {
        console.warn(e);
    }
    if (screen === 'materialForm')
        setMaterialFormDefaults();
    if (screen === 'productForm') {
        let p = product(editing);
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
        appAlert('Could not open saved data on this device. Try closing and reopening the app.');
    }
    dataLoaded = true;
    delete data.settings.theme;
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
    setTimeout(checkSquarePending, 1500);
    requestPersistentStorage().then(() => {
        if (screen === 'settingsBackup')
            render();
    });
})();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || $('updateBar'))
            return;
        document.body.insertAdjacentHTML('beforeend', '<div id="updateBar">New version ready<button onclick="location.reload()">Refresh</button></div>');
    });
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker not registered', e)));
}
