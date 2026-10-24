// Phone app (Android / iPhone store versions): small adjustments so the web app works inside the app wrapper.
// Part of the Crochet Studio app. Files load in the order listed in index.html.
// On the website none of this runs: IS_APP is false there.

const IS_APP = !!(window.Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform());
function appPlugin(name) {
    return window.Capacitor?.Plugins?.[name];
}
function blobToBase64(blob) {
    return new Promise((ok, fail) => {
        let r = new FileReader();
        r.onload = () => ok(String(r.result).split(',')[1] || '');
        r.onerror = () => fail(r.error);
        r.readAsDataURL(blob);
    });
}
// Saves a file to the app's cache and opens the phone's share sheet (Save to Drive, Files, email...).
async function appShareFile(blob, name, title) {
    let fs = appPlugin('Filesystem'), sh = appPlugin('Share');
    if (!fs || !sh)
        throw new Error('Sharing is not available in this version of the app.');
    let safe = String(name || 'file').replace(/[^\w.\- ]+/g, '_'), w = await fs.writeFile({ path: safe, data: await blobToBase64(blob), directory: 'CACHE' });
    try {
        await sh.share({ title: title || safe, files: [w.uri] });
    }
    catch (e) {
        // Closing the share sheet without picking anything is not an error.
        if (!/cancel/i.test(String(e?.message || e)))
            throw e;
    }
}
// Web links open in the phone's browser, or straight in the YouTube / Instagram app when installed.
async function appOpenUrl(url) {
    let al = appPlugin('AppLauncher');
    try {
        if (al)
            return await al.openUrl({ url });
    }
    catch (e) {
        console.warn('Open link', e);
    }
    let b = appPlugin('Browser');
    if (b)
        return b.open({ url });
}
async function appOpenBlobUrl(u, name) {
    let blob = await (await fetch(u)).blob();
    return appShareFile(blob, name || viewerItem?.name || 'pattern', 'Open with');
}
if (IS_APP) {
    document.documentElement.classList.add('in-app');
    // Downloads (backups, reports) and new-tab links
    document.addEventListener('click', e => {
        let a = e.target.closest?.('a[href]');
        if (!a)
            return;
        let href = a.getAttribute('href') || '';
        if (a.hasAttribute('download') && /^(blob|data):/.test(href)) {
            e.preventDefault();
            fetch(href).then(r => r.blob()).then(b => appShareFile(b, a.getAttribute('download'))).catch(err => appAlert('Couldn’t save the file: ' + (err?.message || err)));
        }
        else if (/^https?:/i.test(href) && (a.target === '_blank' || new URL(href, location.href).host !== location.host)) {
            e.preventDefault();
            appOpenUrl(a.href);
        }
        else if (/^blob:/.test(href) && a.target === '_blank') {
            e.preventDefault();
            appOpenBlobUrl(href).catch(err => appAlert('Couldn’t open the file: ' + (err?.message || err)));
        }
    }, true);
    const webOpen = window.open.bind(window);
    window.open = function (url, target, features) {
        let u = String(url || '');
        if (/^https?:/i.test(u)) {
            appOpenUrl(u);
            return {};
        }
        if (/^blob:/.test(u)) {
            appOpenBlobUrl(u).catch(err => appAlert('Couldn’t open the file: ' + (err?.message || err)));
            return {};
        }
        return webOpen(url, target, features);
    };
    // Share sheet for files: the app version supports it even where the phone's web view doesn't.
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => !!(data && (data.files?.length || data.url || data.text)) });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
        if (data?.files?.length) {
            for (let f of data.files)
                await appShareFile(f, f.name, data.title);
            return;
        }
        let sh = appPlugin('Share');
        if (sh)
            return sh.share({ title: data?.title, text: data?.text, url: data?.url });
    } });
}
