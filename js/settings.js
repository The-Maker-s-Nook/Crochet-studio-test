// Settings screens: pricing, tax, backup, payments, country & currency, feedback, guides, What's new
// Part of the Crochet Studio app. Files load in the order listed in index.html.

// Settings › Finances: everything to do with money, in one place.
function settingsFinances() {
    let s = data.settings, meth = { labour: 'Materials + hourly labour', multiply: 'Materials × multiplier', markup: 'Materials with markup + labour' }[s.method] || '', pt = (PRODUCT_TAX.find(x => x[0] === s.productTax) || [, ''])[1], noRate = s.taxRate === null || s.taxRate === undefined || s.taxRate === '';
    return `${backBtn()}<h2 style="margin-top:12px">Finances</h2><div class="panel menu">${menuRow('percent', 'Tax', noRate ? 'Add your sales tax rate' : `${num(s.taxRate)}% · ${pt}`, "go('settingsTax')")}${menuRow('tag', 'Pricing defaults', `${cash(s.hourly)}/hr · ${meth}`, "go('settingsPricing')")}${menuRow('globe', 'Country & currency', currencyName() + ' · also used for Square', "go('settingsRegion')")}${menuRow('card', 'Payments', squareOn() ? 'Square card payments on' : 'Cash, card and e-transfer', "go('settingsPayments')")}</div>`;
}
function menuRow(icon, title, sub, action) {
    return `<button class="menu-row" onclick="${action}"><span class="tic lav">${ic(icon, 18)}</span><span class="grow"><b>${esc(title)}</b><span class="muted">${esc(sub)}</span></span><span class="chev" aria-hidden="true">›</span></button>`;
}
function settings() {
    let s = data.settings, meth = { labour: 'Materials + hourly labour', multiply: 'Materials × multiplier', markup: 'Materials with markup + labour' }[s.method] || '';
    return `${navStack.length ? backBtn() : ''}<h2 style="margin-top:12px">Settings</h2><div class="panel menu">${menuRow('user', 'Account', signedIn() ? session.user.email : (s.userName ? s.userName + ' · not signed in' : 'Sign in to sync your devices'), "go('settingsAccount')")}${menuRow('percent', 'Finances', 'Tax, pricing defaults, currency and payments', "go('settingsFinances')")}${menuRow('download', 'Backup & restore', data.lastBackup ? 'Last backup ' + new Date(data.lastBackup).toLocaleDateString() : 'No backup yet', "go('settingsBackup')")}${menuRow('download', 'Import from spreadsheet', 'Beta · bring in products and materials', "go('settingsImport')")}${menuRow('mail', 'Send feedback', 'Report a problem or share an idea', "go('settingsFeedback')")}${menuRow('book', 'What’s new & tester guide', `Version ${APP_VERSION} notes · guide updated`, "go('settingsGuides')")}</div><p class="hint" style="margin:-4px 8px 14px">Crochet Studio test version ${APP_VERSION}</p>${installCard()}<div class="panel"><h3>Danger zone</h3><button class="danger" onclick="resetData()">Delete all app data</button></div>`;
}
function settingsPricing() {
    let s = data.settings;
    return `${backBtn()}<h2 style="margin-top:12px">Pricing defaults</h2><div class="panel"><label>Hourly labour rate ($)</label><input id="shourly" type="number" min="0" step="any" value="${s.hourly}"><label>Default pricing method</label><select id="smethod"><option value="labour">Materials + hourly labour</option><option value="multiply">Materials × multiplier</option><option value="markup">Materials with markup + labour</option></select><label>Default material multiplier ${helpBtn('mult')}</label><input id="smultiplier" type="number" min="0" step="any" value="${s.multiplier}"><label>Default markup (%) ${helpBtn('markup')}</label><input id="smarkup" type="number" min="0" step="any" value="${s.markup}"><label>Suggested price rounding</label><select id="srounding"><option value="nearest">Nearest $1</option><option value="up1">Round up to $1</option><option value="up5">Round up to $5</option></select><label class="check"><input type="checkbox" id="sdeduct" ${s.autoDeduct ? 'checked' : ''}> Automatically deduct tracked materials when finished stock is added ${helpBtn('deduct')}</label><div class="actions"><button onclick="saveSettings()">Save settings</button></div></div>`;
}
function settingsBackup() {
    return `${backBtn()}<h2 style="margin-top:12px">Backup & restore</h2><div class="panel"><p class="muted">${signedIn() ? 'Your data is saved in your account and synced to your devices. A backup file is an extra copy you keep yourself. It holds' : 'Everything is saved on this device only. A backup file holds'} your products, materials, photos, markets, sales and patterns. Keep a copy somewhere safe, such as Google Drive or email.</p><div class="muted">Last backup: <b>${data.lastBackup ? new Date(data.lastBackup).toLocaleString() : 'never'}</b></div><div class="actions"><button onclick="exportData(false)">⬇ Download backup</button>${canShareFiles() ? '<button class="alt" onclick="exportData(true)">↗ Share backup</button>' : ''}<button class="alt" onclick="$('importFile').click()">⬆ Restore from backup</button></div><input class="hidden" id="importFile" type="file" accept=".json,application/json" onchange="importData(event)"><p class="hint">${signedIn() ? 'Restoring replaces everything in the app, and in your account on all your devices, with the backup.' : 'Restoring replaces everything currently in the app with the backup.'}</p>${storagePersisted === false ? '<p class="hint">Your browser has not promised to keep this data permanently. Installing the app to your home screen usually fixes this. Back up regularly either way.</p>' : ''}</div>`;
}
function saveAccountName() {
    data.settings.userName = normName($('aName').value);
    save();
    render();
    flash(data.settings.userName ? `Hi, ${data.settings.userName}!` : 'Name removed.');
}
function saveSettings() {
    data.settings = { ...data.settings, hourly: num($('shourly').value), method: $('smethod').value, multiplier: num($('smultiplier').value), markup: num($('smarkup').value), rounding: $('srounding').value, autoDeduct: $('sdeduct').checked };
    save();
    goBack();
    toast('Pricing defaults saved.');
}
function taxSelect(fid, opts, value, extra = '') {
    return `<select id="${fid}" ${extra}>${opts.map(([v, l]) => `<option value="${v}" ${value === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
}
function settingsTax() {
    let s = data.settings, noRate = s.taxRate === null || s.taxRate === undefined || s.taxRate === '';
    return `${backBtn()}<h2 style="margin-top:12px">Tax</h2><div class="panel"><label for="tRate" style="margin-top:0">Sales tax rate (%)</label><input id="tRate" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${noRate ? '' : num(s.taxRate)}" placeholder="e.g. 13" oninput="refreshTaxExample()"><div class="hint">Use your local sales tax rate, for example 13% in Ontario, 5% GST in Alberta, or your state and local rate added together in the US.</div>
<div class="labelrow"><label for="tProduct">Product tax</label>${helpBtn('productTax')}</div>${taxSelect('tProduct', PRODUCT_TAX, s.productTax)}
<div class="labelrow"><label for="tMaterial">Material &amp; expense tax</label>${helpBtn('materialTax')}</div>${taxSelect('tMaterial', MATERIAL_TAX, s.materialTax, 'onchange="refreshTaxExample()"')}
<div class="labelrow"><label class="check" style="margin:0"><input type="checkbox" id="tNotClaiming" ${s.notClaimingTax ? 'checked' : ''} onchange="refreshTaxExample()"> Not claiming tax on materials and expenses</label>${helpBtn('notClaiming')}</div>
<div id="taxEx">${taxExample()}</div><p class="hint">You can override these for one product, material or expense on its own screen.</p><div class="actions"><button onclick="saveTaxSettings()">Save</button></div></div><p class="hint" style="margin:0 6px">Tax totals are shown in Reports by calendar year. They're a guide only, not tax advice.</p>`;
}
// Preview the example with the choices on screen, before saving.
function refreshTaxExample() {
    let s = data.settings, keep = { taxRate: s.taxRate, materialTax: s.materialTax, notClaimingTax: s.notClaimingTax };
    Object.assign(s, { taxRate: num($('tRate').value), materialTax: $('tMaterial').value, notClaimingTax: $('tNotClaiming').checked });
    $('taxEx').innerHTML = taxExample();
    Object.assign(s, keep);
}
function saveTaxSettings() {
    let v = $('tRate').value.trim(), r = Number(v);
    if (v === '' || !(r >= 0 && r <= 100))
        return needField('tRate', 'Enter your sales tax rate between 0 and 100. Use 0 if you don’t pay or charge tax.');
    Object.assign(data.settings, { taxRate: r, productTax: $('tProduct').value, materialTax: $('tMaterial').value, notClaimingTax: $('tNotClaiming').checked });
    save();
    goBack();
    toast('Tax settings saved.');
}
function logPurchase(m, packs, price) {
    packs = Number(packs) || 0;
    if (!m || packs <= 0)
        return;
    let pr = num(price ?? m.price), t = materialTaxInfo(m);
    data.purchases.push({ id: id(), materialId: m.id, date: new Date().toISOString(), packs, price: pr, taxed: t.mode !== 'none', mode: t.mode, rate: t.rate, tax: purchaseTax(m, packs * pr), store: m.store || '' });
}
// ---- Settings › Finances › Payments ----
function settingsPayments() {
    let on = squareOn();
    return `${backBtn()}<h2 style="margin-top:12px">Payments</h2><div class="panel"><label class="check" style="margin-top:0"><input type="checkbox" id="sqOn" ${on ? 'checked' : ''} onchange="data.settings.squareEnabled=this.checked;save();render()"> Use Square for card payments</label><p class="hint">When a customer pays by card, Crochet Studio opens the <b>Square Point of Sale</b> app with the total ready. After the payment, Square brings you back and the sale is saved.</p></div>${on ? `<div class="panel"><h3>Before your first sale</h3><ol class="steps"><li>Install <b>Square Point of Sale</b>, sign in to your Square account and choose your location.</li><li>Connect your card reader in the Square app, if you use one.</li><li>If Crochet Studio adds tax to your sales, turn off Square's own sales tax so it isn't charged twice.</li><li>Run a $1.00 test below, then refund it in Square.</li></ol><p class="hint">Payments go to your own Square account and Square's normal card fees apply. Square charges in ${sqCurrency() === 'USD' ? 'US dollars (USD)' : 'Canadian dollars (CAD)'}, your app's currency. Change it in Settings › Finances › Country &amp; currency; it must match your Square account's country. You need the Square Point of Sale app on this device; being signed in to Square in a web browser won't work.</p><button class="alt" onclick="squareTest()">${ic('card', 18)} Test Square with $1.00</button></div>` : ''}<div class="panel muted">Cash, card on your own reader and e-transfer can always be recorded at checkout.</div>`;
}
// ---- Send feedback ----
function deviceInfo() {
    let u = navigator.userAgent, os = /Android/.test(u) ? 'Android' : /iPhone/.test(u) ? 'iPhone' : (/iPad/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1)) ? 'iPad' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'Mac' : /CrOS/.test(u) ? 'Chromebook' : /Linux/.test(u) ? 'Linux' : 'Other';
    let ver = (u.match(/Android ([\d.]+)/) || [])[1] || ((u.match(/OS (\d+)[_.](\d+)/) || []).slice(1, 3).join('.')) || '';
    let br = /SamsungBrowser/.test(u) ? 'Samsung Internet' : /EdgA?\/|Edg\//.test(u) ? 'Edge' : /Firefox|FxiOS/.test(u) ? 'Firefox' : /CriOS|Chrome/.test(u) ? 'Chrome' : /Safari/.test(u) ? 'Safari' : 'Other';
    let installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    return { device: os + (ver ? ' ' + ver : ''), browser: br, installed, size: innerWidth + '×' + innerHeight };
}
function settingsFeedback() {
    let d = deviceInfo(), types = ['Something broke', 'Confusing', 'Idea', 'I love this'];
    return `${backBtn()}<h2 style="margin-top:12px">Send feedback</h2><p class="muted" style="margin-top:-6px;font-weight:600">Thanks for testing! Tell us what broke, what was confusing, or what you wish it did. Screenshots help a lot.</p>
  <div class="panel"><h3>What kind of feedback?</h3><div class="chips">${types.map(t => `<button class="chipbtn ${fbType === t ? 'on' : ''}" onclick="fbType='${t}';softRender()">${t}</button>`).join('')}</div></div>
  <div class="panel"><h3>Added to your email automatically</h3><div class="fbinfo">App version: ${APP_VERSION}<br>Device: ${esc(d.device)} · ${esc(d.browser)}<br>Installed app: ${d.installed ? 'yes' : 'no'}<br>Signed in: ${signedIn() ? 'yes' : 'no'}${esc(sqErrLine()).replace('\n', '<br>')}</div><p class="hint">No products, sales or account details are included. Add screenshots to the email if you can.</p></div>
  <div class="actions"><button onclick="sendFeedback()">${ic('mail', 18)} Open my email app</button></div>
  <p class="muted" style="text-align:center;font-weight:700">Or email us directly: <a href="mailto:${FEEDBACK_EMAIL}">${FEEDBACK_EMAIL}</a><br><button class="linkbtn" onclick="copyFeedbackEmail()">Copy email address</button></p>`;
}
function feedbackBody() {
    let d = deviceInfo();
    return `\n\n(Write your feedback above this line. Screenshots help!)\n\n---\nApp version: ${APP_VERSION}\nDevice: ${d.device} · ${d.browser}\nInstalled app: ${d.installed ? 'yes' : 'no'}\nScreen size: ${d.size}\nSigned in: ${signedIn() ? 'yes' : 'no'}${sqErrLine()}`;
}
function sendFeedback() {
    let url = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Crochet Studio feedback: ' + fbType)}&body=${encodeURIComponent(feedbackBody())}`;
    location.href = url;
    setTimeout(() => {
        if (document.visibilityState === 'visible')
            toast('If no email app opened, tap “Copy email address” and email us from your usual app.');
    }, 1500);
}
async function copyFeedbackEmail() {
    try {
        await navigator.clipboard.writeText(FEEDBACK_EMAIL);
        toast('Email address copied.');
    }
    catch {
        appAlert('Our email address is ' + FEEDBACK_EMAIL);
    }
}
const currencyName = () => data.settings.currency === 'USD' ? 'United States · USD' : 'Canada · CAD';
function settingsRegion() {
    let c = data.settings.currency || 'CAD';
    return `${backBtn()}<h2 style="margin-top:12px">Country &amp; currency</h2><div class="panel"><div class="regiongrid">${[['CAD', 'Canada', 'CAD $'], ['USD', 'United States', 'USD $']].map(([v, n, s]) => `<button class="regionbtn ${c === v ? 'on' : ''}" aria-pressed="${c === v}" onclick="setCurrency('${v}')"><b>${n}</b><span>${s}</span></button>`).join('')}</div><p class="hint">The whole app uses this currency, and Square charges in it. It must match your Square account's country, or Square says “invalid request”.</p></div><div class="panel muted">Prices aren't converted, only labelled. Set your sales tax rate in Settings › Finances › Tax${c === 'USD' ? ' (in the US it depends on your state)' : ''}.</div>`;
}
function setCurrency(v) {
    data.settings.currency = v;
    lsSet('csSquareBasic', false);
    save();
    render();
    toast(v === 'USD' ? 'Currency set to US dollars.' : 'Currency set to Canadian dollars.');
}
// ---- What's new + guides ----
const GUIDES = { whats: { file: 'guides/whats-new-24.pdf', name: 'What’s new in version 24' }, guide: { file: 'guides/tester-guide.pdf', name: 'Crochet Studio Tester Guide' } };
async function openGuide(k) {
    let g = GUIDES[k];
    if (!g)
        return;
    try {
        let r = await fetch(g.file, { cache: 'no-cache' }).catch(() => fetch(g.file));
        if (!r.ok)
            throw new Error(r.status);
        let blob = await r.blob();
        openViewerItem({ id: 'guide-' + k, name: g.name, mime: 'application/pdf', blob });
    }
    catch (e) {
        appAlert('The guide couldn’t be opened. Connect to the internet and try again.');
    }
}
function settingsGuides() {
    return `${backBtn()}<h2 style="margin-top:12px">What's new &amp; tester guide</h2><div class="panel menu">${guideRow('whats', 'What’s new in version ' + APP_VERSION, 'Fixes from your feedback and new features', 'New')}${guideRow('guide', 'Tester guide', 'Install, accounts, Square, import, what to test', 'Updated')}</div><div class="panel"><h3>What changed in the guide</h3><ul class="tips"><li>Settings › Finances and the new tax options</li><li>Tax, expenses and packing for markets</li><li>Adding photos: take, gallery or files</li></ul></div><p class="hint" style="margin:0 6px">Opens in the app’s PDF viewer.</p>`;
}
function guideRow(k, t, sub, badge) {
    return `<button class="menu-row" onclick="openGuide('${k}')"><span class="tic gold" style="font-size:10px;font-weight:800">PDF</span><span class="grow"><b>${esc(t)} <span class="pill beta" style="font-size:11px;padding:2px 8px">${badge}</span></b><span class="muted">${esc(sub)}</span></span><span class="chev" aria-hidden="true">›</span></button>`;
}
let whatsNewShown = false;
function maybeWhatsNew() {
    if (whatsNewShown || screen !== 'home' || !dataLoaded)
        return;
    let seen = lsGet('csSeenVersion', null);
    if (seen === APP_VERSION)
        return;
    whatsNewShown = true;
    lsSet('csSeenVersion', APP_VERSION);
    let existing = seen !== null || data.products.length || data.materials.length || data.markets.length || signedIn();
    if (!existing)
        return;
    setTimeout(() => {
        if ($('appDialog') || document.querySelector('.modal'))
            return;
        openModal(`<span class="pill ok">Updated to version ${APP_VERSION}</span><h2 style="margin:10px 0 8px">What's new</h2><ul class="tips"><li>Simpler tax settings in Settings › Finances (please check them once)</li><li>Extra expenses like gas and displays, counted in profit</li><li>Reminders: tap the bell to remember to make or buy more</li><li>Quicker packing, swipe left to delete, and a fold-up market page</li><li>Pattern links and tags, tappable links in PDFs, and patterns reopen where you left off</li></ul><div class="tip" style="margin-top:12px">The Tester guide was updated too. Find both any time in Settings › What's new &amp; tester guide.</div><div class="actions"><button onclick="closeModal();openGuide('whats')">Read the full update notes</button><button class="alt" onclick="closeModal()">Got it</button></div>`);
    }, 600);
}
