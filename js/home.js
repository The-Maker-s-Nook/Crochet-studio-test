// Home screen, quick stock buttons, backup reminder, install card, rotating messages
// Part of the Crochet Studio app. Files load in the order listed in index.html.

function upcomingMarket() {
    let today = new Date().toISOString().slice(0, 10), best = null;
    for (let m of data.markets) {
        if (m.completed)
            continue;
        let days = (m.days?.length ? m.days : (m.date ? [{ date: m.date }] : [])).filter(d => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
        if (days[0] && (!best || days[0].date < best.day.date))
            best = { m, day: days[0] };
    }
    return best;
}
function home() {
    let stock = data.products.reduce((a, p) => a + num(p.stock), 0), value = data.products.reduce((a, p) => a + num(p.stock) * num(p.price), 0), now = new Date(), monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime(), profit = marketFigures(completedBetween(monthStart, new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()), quickBetween(monthStart, new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()), looseExpensesBetween(monthStart, new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime())).profit, hr = now.getHours(), greet = (hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') + (data.settings.userName ? ', ' + esc(data.settings.userName) : '') + '!';
    let nm = upcomingMarket(), next;
    if (nm) {
        let m = nm.m, alloc = Object.entries(m.items || {}).reduce((a, [pid, q]) => a + num(q) * num(product(pid)?.price), 0), t = num(m.target), pct = t ? Math.min(100, Math.round(alloc / t * 100)) : 0, daysAway = Math.round((new Date(nm.day.date + 'T12:00:00') - new Date(now.toISOString().slice(0, 10) + 'T12:00:00')) / 864e5), when = daysAway === 0 ? 'today' : daysAway === 1 ? 'tomorrow' : `in ${daysAway} days`;
        next = `<div class="row" style="align-items:flex-start"><div class="eyebrow" style="padding-top:4px">Next market · ${when}</div><div class="pillcol">${num(m.cost) ? `<span class="pill">${cash(m.cost)} booth</span>` : ''}${todoPill(m)}</div></div><div style="font-family:var(--display);font-size:22px;margin:6px 0 2px">${esc(m.name)}</div><div class="muted" style="font-size:14px;font-weight:600">${esc(formatMarketDay(nm.day))}${m.location ? ' · ' + esc(m.location.split(',').slice(0, 2).join(',')) : ''}</div>${t ? `<div class="row" style="font-size:13px;font-weight:700;margin:12px 0 6px"><span>Packed ${cash(alloc)} of ${cash(t)} goal</span><span>${pct}%</span></div><div class="bar"><div style="width:${pct}%"></div></div>` : `<div class="hint">Packed so far: ${cash(alloc)}</div>`}<div class="actions"><button class="aqua" onclick="openMarket('${m.id}')">Open market</button><button class="alt" onclick="openTodo('${m.id}')">${ic('check', 17)} To-do list</button></div>`;
    }
    else
        next = `<div class="eyebrow">Next market</div><div style="font-family:var(--display);font-size:20px;margin:6px 0">No markets coming up</div><div class="muted">Plan one to start packing inventory.</div><div class="actions"><button class="aqua" onclick="newMarket()">+ Plan a market</button></div>`;
    let empty = !data.products.length && !data.materials.length;
    return `<div class="hero"><div class="date">${now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div><div class="greet">${greet}<br>${homeMessage()}</div></div><div class="panel nextcard">${next}</div><div class="grid keep2 tiles" style="margin-bottom:14px"><div class="panel tile"><span class="tic pink">${ic('heart', 18)}</span><div class="muted">Finished items</div><div class="stat">${stock}</div></div><div class="panel tile"><span class="tic aqua">${ic('tag', 18)}</span><div class="muted">Stock value</div><div class="stat">${cash(value).replace('.00', '')}</div></div><div class="panel tile"><span class="tic lav">${ic('trend', 18)}</span><div class="muted">Profit this month</div><div class="stat ${profit < 0 ? 'bad' : ''}">${signedCash(profit).replace('.00', '')}</div></div><div class="panel tile" onclick="view('patterns')" style="cursor:pointer"><span class="tic gold">${ic('book', 18)}</span><div class="muted">Patterns</div><div class="stat" id="patternCount">…</div></div></div><div class="quick"><button onclick="newProduct()">+ New product</button><button class="outline" onclick="newMaterial()">+ New material</button></div><button class="aqua quicksell" onclick="startQuickSale()">${ic('tag', 18)} Quick sale</button>${taxRateReminder()}${backupReminder()}${installCard()}${empty ? `<div class="panel"><h3>Getting started</h3><p class="muted">1. Add your yarn and supplies. 2. Create a product with materials, time and a photo. 3. Plan a market and pack inventory. 4. Import patterns and link them to products.</p><p class="hint">${signedIn() ? 'Your data is saved in your account and synced to your other devices.' : 'Your data is saved on this device only. Create a free account in Settings › Account to keep it safe in the cloud, or back it up regularly.'}</p></div>` : ''}`;
}
function quickAdd(pid) {
    adjust(pid, 1, 'production');
}
function quickRemove(pid) {
    let p = product(pid);
    if (!p)
        return;
    if (num(p.stock) < 1)
        return toast(`${p.name} is already at 0.`);
    adjust(pid, -1, 'correction');
}
// New US setups start without a rate (it depends on the state and city), so ask for one.
function taxRateReminder() {
    let s = data.settings;
    if (!(s.taxRate === null || s.taxRate === undefined || s.taxRate === '') || (s.productTax === 'none' && s.materialTax === 'none'))
        return '';
    return `<div class="strip">${ic('percent', 18)}<span class="grow">Add your sales tax rate so prices and reports work out tax correctly.</span><button onclick="go('settingsTax')">Set rate</button></div>`;
}
function backupReminder() {
    if (signedIn())
        return '';
    let hasData = data.products.length || data.materials.length;
    if (!hasData)
        return '';
    let last = data.lastBackup ? new Date(data.lastBackup) : null, days = last ? (Date.now() - last) / 864e5 : Infinity;
    if (days < 14)
        return '';
    return `<div class="strip">${ic('clock', 18)}<span class="grow">${last ? `Last backup ${Math.floor(days)} days ago` : 'No backup yet'}</span><button onclick="go('settingsBackup')">Back up</button></div>`;
}
let installPromptEvent = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function installCard() {
    if (isStandalone())
        return '';
    if (installPromptEvent)
        return `<div class="panel"><h3>Install the app</h3><p class="muted">Add Crochet Studio to your home screen so it opens like a normal app and works without internet.</p><button onclick="installApp()">Install</button></div>`;
    if (isIOS() && location.protocol.startsWith('http'))
        return `<div class="panel"><h3>Install on ${/ipad/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iPad' : 'iPhone'}</h3><p class="muted">In Safari, tap the Share button (square with an arrow), then <b>Add to Home Screen</b>. The app will open full screen and work without internet.</p></div>`;
    return '';
}
async function installApp() {
    if (!installPromptEvent)
        return;
    installPromptEvent.prompt();
    try {
        await installPromptEvent.userChoice;
    }
    catch {
    }
    installPromptEvent = null;
    render();
}
// ---- Home messages ----
const HOME_MSGS = ['Ready to make something cute today?', 'Every stitch counts. You’ve got this!', 'Market season is here. Time to pack?', 'Don’t forget to snap photos of new makes.', 'Check your yarn before the next big project.', 'Small business, big heart.', 'Hydrate, stretch, then crochet.', 'Your next best seller is on the hook.', 'Tip: back up your data in Settings.', 'Thanks for supporting handmade!'];
let homeMsgIdx = null;
function homeMessage() {
    if (homeMsgIdx === null) {
        let i = Number(lsGet('csMsgIdx', -1));
        homeMsgIdx = ((Number.isFinite(i) ? i : -1) + 1) % HOME_MSGS.length;
        lsSet('csMsgIdx', homeMsgIdx);
    }
    return esc(HOME_MSGS[homeMsgIdx]);
}
