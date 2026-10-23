// Markets: list, details, dates, address search, packing inventory, to-do list, completing a market
// Part of the Crochet Studio app. Files load in the order listed in index.html.

function packedFor(pid) {
    return data.markets.filter(m => !m.completed).reduce((a, m) => a + num(m.items?.[pid]), 0);
}
function marketSortDate(m) {
    return m.days?.[0]?.date || m.date || '';
}
function todoStatus(m) {
    let t = m.todos || [];
    if (!t.length)
        return null;
    let left = t.filter(x => !x.done).length;
    return left ? { done: false, text: `${left} to-do${left > 1 ? 's' : ''} left` } : { done: true, text: 'Checklist complete ✓' };
}
function todoPill(m) {
    let st = todoStatus(m);
    return st ? `<span class="pill ${st.done ? 'ok' : ''}">${esc(st.text)}</span>` : '';
}
function todoLine(m) {
    let st = todoStatus(m);
    return `<button class="todo-line ${st ? (st.done ? 'ok' : '') : 'none'}" onclick="openTodo('${m.id}')"><span>${ic('check', 16)} ${esc(st ? st.text : 'To-do list & notes')}</span><span aria-hidden="true">›</span></button>`;
}
function marketDateLine(m) {
    return esc((m.days?.[0] ? formatMarketDay(m.days[0]) : m.date) || 'Date not set') + (m.days?.length > 1 ? ` (+${m.days.length - 1} more day${m.days.length > 2 ? 's' : ''})` : '');
}
function markets() {
    let open = data.markets.filter(m => !m.completed).sort((a, b) => (marketSortDate(a) || '9999').localeCompare(marketSortDate(b) || '9999')), done = data.markets.filter(m => m.completed).sort((a, b) => marketSortDate(b).localeCompare(marketSortDate(a)));
    const card = m => `<div class="panel"><div class="row" style="align-items:flex-start"><b style="font-family:var(--display);font-weight:400;font-size:19px">${esc(m.name)}</b><div class="pillcol">${m.completed ? '<span class="pill ok">Completed ✓</span>' : todoPill(m)}</div></div><div class="muted">${marketDateLine(m)}</div><div class="actions"><button class="alt small" onclick="openMarket('${m.id}')">Open market →</button>${m.completed ? '' : `<button class="alt small" onclick="openTodo('${m.id}')">To-do list</button>`}</div></div>`;
    return `<div class="row"><h2>Markets & Sales</h2><button onclick="newMarket()">+ Market</button></div>${open.map(card).join('') || '<div class="panel muted">No upcoming markets. Tap + Market to plan one.</div>'}${done.length ? `<h3 style="margin-top:22px">Completed markets</h3>${done.map(card).join('')}` : ''}<div class="panel"><h3>Recent sales</h3>${data.sales.slice().reverse().slice(0, 15).map(s => `<div class="entry">${esc(product(s.productId)?.name || 'Deleted product')} × ${s.qty} · ${cash(lineRev(s))}<div class="muted">${new Date(s.date).toLocaleDateString()} · ${esc(data.markets.find(m => m.id === s.marketId)?.name || (s.fromMarket ? s.fromMarket + ' (deleted)' : 'Quick sale'))}</div></div>`).join('') || '<div class="muted">No sales recorded.</div>'}</div>`;
}
const TODO_SUGGESTIONS = ['Pack float / change', 'Charge card reader', 'Price tags & signs', 'Table & tablecloth', 'Display stands', 'Shopping bags', 'Business cards', 'Snacks & water'];
function curMarket() {
    return data.markets.find(x => x.id === marketSelected);
}
function marketTodo() {
    let m = curMarket();
    if (!m)
        return '<p>Market not found.</p>';
    m.todos ||= [];
    let t = m.todos, done = t.filter(x => x.done).length, pct = t.length ? Math.round(done / t.length * 100) : 0, have = new Set(t.map(x => x.text.toLowerCase())), sugg = TODO_SUGGESTIONS.filter(x => !have.has(x.toLowerCase()));
    return `${backBtn()}<div class="panel" style="margin-top:12px"><h2 style="margin-bottom:2px">To-do list</h2><div class="muted">${esc(m.name)} · ${marketDateLine(m)}</div>${t.length ? `<div class="row" style="font-size:13px;font-weight:700;margin:14px 0 6px"><span>${done === t.length ? 'Checklist complete ✓' : `${done} of ${t.length} done`}</span><span>${pct}%</span></div><div class="bar"><div style="width:${pct}%"></div></div>` : ''}<div class="todo-list">${t.map(x => `<div class="todo ${x.done ? 'done' : ''}"><label><input type="checkbox" ${x.done ? 'checked' : ''} onchange="toggleTodo('${x.id}')"><span>${esc(x.text)}</span></label><button class="iconbtn sm" aria-label="Delete ${esc(x.text)}" onclick="deleteTodo('${x.id}')">${ic('x', 16)}</button></div>`).join('') || '<p class="muted" style="margin:14px 0 4px">Nothing on the list yet.</p>'}</div><label for="todoText">Add a to-do</label><div class="row"><input id="todoText" placeholder="e.g. Pick up extra bags" enterkeyhint="done" onkeydown="if(event.key==='Enter'){event.preventDefault();addTodo()}"><button onclick="addTodo()">Add</button></div>${sugg.length ? `<div class="hint" style="margin-top:14px;font-weight:700">Quick add</div><div class="actions" style="margin-top:6px">${sugg.map(x => `<button class="alt small" onclick="addTodo(${esc(JSON.stringify(x))})">+ ${esc(x)}</button>`).join('')}</div>` : ''}${done ? `<div class="actions"><button class="danger small" onclick="clearDoneTodos()">Clear checked items</button></div>` : ''}</div><div class="panel"><h3><label for="todoNotes" style="font:inherit;color:inherit;margin:0">Notes</label></h3><textarea id="todoNotes" rows="7" placeholder="Parking, load-in time, contact person, what sold well last time…" oninput="saveTodoNotes(this.value)">${esc(m.notes || '')}</textarea><div class="hint" id="notesSaved">Notes save automatically.</div></div>`;
}
function addTodo(text) {
    let m = curMarket();
    if (!m)
        return;
    let typed = text === undefined;
    text = normName(typed ? $('todoText')?.value : text);
    if (!text) {
        $('todoText')?.focus();
        return;
    }
    m.todos ||= [];
    m.todos.push({ id: id(), text, done: false });
    save();
    render();
}
function toggleTodo(tid) {
    let t = curMarket()?.todos?.find(x => x.id === tid);
    if (!t)
        return;
    t.done = !t.done;
    save();
    render();
}
function deleteTodo(tid) {
    let m = curMarket();
    if (!m)
        return;
    m.todos = (m.todos || []).filter(x => x.id !== tid);
    save();
    render();
}
async function clearDoneTodos() {
    let m = curMarket();
    if (!m || !await appConfirm('Remove all checked items from this list?'))
        return;
    m.todos = (m.todos || []).filter(x => !x.done);
    save();
    render();
}
let notesTimer = null;
function saveTodoNotes(v) {
    let m = curMarket();
    if (!m)
        return;
    m.notes = v;
    let h = $('notesSaved');
    if (h)
        h.textContent = 'Saving…';
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => {
        save();
        let h = $('notesSaved');
        if (h)
            h.textContent = 'Saved ✓';
    }, 500);
}
// Totals for some markets, plus extra no-market sales and expenses. Profit is before tax.
function marketFigures(ms, extra = [], looseExp = []) {
    let ids = new Set(ms.map(m => m.id)), sales = data.sales.filter(x => ids.has(x.marketId)).concat(extra), expenses = (data.expenses || []).filter(e => e.marketId && ids.has(e.marketId)).concat(looseExp), other = round2(expenses.reduce((a, e) => a + expenseCost(e), 0));
    let full = round2(sales.reduce((a, x) => a + lineFull(x), 0)), revenue = round2(sales.reduce((a, x) => a + lineRev(x), 0)), materials = sales.reduce((a, x) => a + num(x.qty) * num(x.estimatedMaterialCost), 0), qty = sales.reduce((a, x) => a + num(x.qty), 0), booth = ms.reduce((a, m) => a + num(m.cost), 0);
    return { revenue, full, discounts: round2(full - revenue), materials, qty, booth, expenses, other, profit: revenue - materials - booth - other, sales };
}
function completedPanel(m) {
    let f = marketFigures([m]);
    return `<div class="panel done-panel"><div class="row"><h3 style="margin:0">Market completed ✓</h3><button class="alt small" onclick="reopenMarket('${m.id}')">Reopen</button></div><div class="muted" style="margin:6px 0 12px">Completed ${new Date(m.completedAt || Date.now()).toLocaleDateString()} · included in Reports</div><div class="grid keep2"><div><div class="muted">Sales</div><div class="stat">${cash(f.revenue)}</div></div><div><div class="muted">Items sold</div><div class="stat">${f.qty}</div></div><div><div class="muted">${f.expenses.length ? 'Booth + expenses' : 'Booth cost'}</div><div class="stat">${cash(f.booth + f.other)}</div></div><div><div class="muted">Profit</div><div class="stat ${f.profit < 0 ? 'bad' : 'good'}">${signedCash(f.profit)}</div></div></div></div>`;
}
function finishPanel(m) {
    let left = Object.values(m.items || {}).reduce((a, q) => a + num(q), 0);
    return `<div class="panel"><h3>Finished with this market?</h3><p class="muted">Marking it completed adds its sales, booth cost and expenses to your Reports${left ? ` and puts the ${left} unsold item${left > 1 ? 's' : ''} back into your available stock for other markets` : ''}.</p><button class="aqua" onclick="completeMarket('${m.id}')">${ic('check', 18)} Mark market as completed</button></div>`;
}
async function completeMarket(mid) {
    let m = data.markets.find(x => x.id === mid);
    if (!m)
        return;
    let left = Object.values(m.items || {}).reduce((a, q) => a + num(q), 0);
    if (!await appConfirm(`Mark ${m.name} as completed?\n\nIts sales, booth cost and expenses will be added to Reports.${left ? `\n${left} unsold item${left > 1 ? 's' : ''} will go back to your available stock.` : ''}`))
        return;
    m.completed = true;
    m.completedAt = new Date().toISOString();
    m.packedAtCompletion = { ...(m.items || {}) };
    m.items = {};
    marketSaleMode = false;
    marketSaleDraft = {};
    save();
    render();
    scrollTo(0, 0);
    toast(`${m.name} completed and added to Reports.`);
}
async function reopenMarket(mid) {
    let m = data.markets.find(x => x.id === mid);
    if (!m)
        return;
    if (!await appConfirm(`Reopen ${m.name}?\n\nIt will be left out of Reports until you complete it again.`))
        return;
    m.completed = false;
    delete m.completedAt;
    m.items ||= {};
    let back = 0;
    for (let [pid, q] of Object.entries(m.packedAtCompletion || {})) {
        let n = Math.min(num(q), availableFor(pid));
        if (n > 0) {
            m.items[pid] = num(m.items[pid]) + n;
            back += n;
        }
    }
    delete m.packedAtCompletion;
    save();
    render();
    toast(back ? `Market reopened. ${back} item${back > 1 ? 's' : ''} packed again.` : 'Market reopened.');
}
function marketForm() {
    return `${backBtn()}<div class="panel" style="margin-top:12px"><h2>New market</h2><label>Market name</label><input id="marketName" placeholder="Fall Craft Fair">${addressField('marketLocation', '')}<label>Market / booth cost ($)</label><input id="marketCost" type="number" min="0" step="0.01" value="0"><h3 style="margin-top:20px">Market dates & times</h3><div id="marketDays">${marketDayRow()}</div><button class="alt small" onclick="addMarketDay()">+ Add another day</button><label>Inventory value target ($)</label><input id="marketTarget" type="number" min="0" step="1" value="0"><div class="hint">Target is the retail value of items you want to bring.</div><div class="actions"><button onclick="saveMarket()">Save market</button></div></div>`;
}
function readMarketDays() {
    return [...document.querySelectorAll('.market-day')].map(e => ({ date: e.querySelector('.dayDate').value, start: e.querySelector('.dayStart').value, end: e.querySelector('.dayEnd').value })).filter(d => d.date);
}
function addressField(fid, value) {
    return `<label>Location / address</label><div class="addr"><input id="${fid}" autocomplete="off" placeholder="Start typing a venue or address" value="${esc(value)}" oninput="addressInput(this)" onblur="setTimeout(()=>hideAddr('${fid}'),250)"><div class="addr-list hidden" id="${fid}List"></div></div>`;
}
let addrTimer = null, addrSeq = 0, geoBiasPromise = null;
function getGeoBias() {
    if (!geoBiasPromise)
        geoBiasPromise = new Promise(res => {
            if (!navigator.geolocation)
                return res(null);
            navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude.toFixed(3), lon: p.coords.longitude.toFixed(3) }), () => res(null), { timeout: 8000, maximumAge: 864e5, enableHighAccuracy: false });
        });
    return geoBiasPromise;
}
function addressInput(el) {
    clearTimeout(addrTimer);
    let q = el.value.trim();
    if (q.length < 3)
        return hideAddr(el.id);
    addrTimer = setTimeout(() => fetchAddr(el.id, q), 350);
}
function formatPlace(f) {
    let p = f.properties || {}, street = [p.housenumber, p.street].filter(Boolean).join(' '), city = p.city || p.town || p.village || p.district || p.county;
    let parts = [p.name && p.name !== street ? p.name : '', street, city, p.state, p.postcode].filter(Boolean);
    return [...new Set(parts)].join(', ');
}
async function fetchAddr(fid, q) {
    let seq = ++addrSeq;
    let bias = await getGeoBias();
    if (seq !== addrSeq)
        return;
    let u = 'https://photon.komoot.io/api/?limit=6&lang=en&q=' + encodeURIComponent(q) + (bias ? `&lat=${bias.lat}&lon=${bias.lon}` : '');
    try {
        let r = await fetch(u);
        if (!r.ok)
            throw new Error(r.status);
        let j = await r.json();
        if (seq !== addrSeq)
            return;
        let items = [...new Set((j.features || []).map(formatPlace).filter(Boolean))].slice(0, 5), list = $(fid + 'List');
        if (!list)
            return;
        if (!items.length)
            return hideAddr(fid);
        list.innerHTML = items.map(t => `<button type="button" onmousedown="event.preventDefault()" onclick="pickAddr('${fid}',this.textContent)">${esc(t)}</button>`).join('') + '<div class="addr-credit">Suggestions from OpenStreetMap</div>';
        list.classList.remove('hidden');
    }
    catch (e) {
        hideAddr(fid);
    }
}
function pickAddr(fid, text) {
    let e = $(fid);
    if (e)
        e.value = text;
    hideAddr(fid);
}
function hideAddr(fid) {
    $(fid + 'List')?.classList.add('hidden');
}
function saveMarket() {
    let name = $('marketName').value.trim(), target = Number($('marketTarget').value), cost = Number($('marketCost').value);
    if (!name)
        return appAlert('Enter a market name.');
    if (!Number.isFinite(cost) || cost < 0)
        return appAlert('Enter a valid market cost.');
    if (!Number.isFinite(target) || target < 0)
        return appAlert('Enter a valid target amount.');
    let days = readMarketDays(), mid = id();
    data.markets.push({ id: mid, name, location: $('marketLocation').value.trim(), cost, days, date: days[0]?.date || '', target, items: {} });
    save();
    openMarket(mid, true);
    toast('Market created.');
}
let marketAddOpen = false, marketAddSearch = '', marketAddQty = {};
function formatMarketDay(d) {
    if (!d.date)
        return '';
    let date = new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const t = v => v ? new Date('2000-01-01T' + v).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
    return date + (d.start || d.end ? ' · ' + (t(d.start) || 'Time TBD') + ' – ' + (t(d.end) || 'Time TBD') : ' · Times not set');
}
function marketDetail() {
    let m = data.markets.find(x => x.id === marketSelected);
    if (!m)
        return '<p>Market not found.</p>';
    m.items ||= {};
    let allocated = Object.entries(m.items).reduce((a, [pid, q]) => a + num(q) * num(product(pid)?.price), 0), allValue = data.products.reduce((a, p) => a + num(p.stock) * num(p.price), 0), sold = data.sales.filter(s => s.marketId === m.id).reduce((a, s) => a + lineRev(s), 0);
    let days = m.days?.length ? m.days : (m.date ? [{ date: m.date, start: '', end: '' }] : []);
    let draftCount = Object.values(marketSaleDraft).reduce((a, q) => a + q, 0), draftValue = Object.entries(marketSaleDraft).reduce((a, [pid, q]) => a + q * num(product(pid)?.price), 0);
    return `${backBtn()}<div class="panel" style="margin-top:12px"><div class="row" style="align-items:flex-start"><h2>${esc(m.name)}</h2><button class="alt" onclick="go('marketInfo')">Details</button></div>${m.completed ? '<span class="pill ok">Completed ✓</span>' : ''}<div class="muted" style="margin:8px 0">${days.length ? days.map(d => `<div style="margin:4px 0">📅 ${esc(formatMarketDay(d))}</div>`).join('') : '📅 Dates and times not set'}</div>${todoLine(m)}<div class="row" style="align-items:center;justify-content:flex-start;gap:8px"><span>📍 ${esc(m.location || 'Address not set')}</span>${m.location ? `<button class="alt small" onclick="marketDirectionsSaved()">Directions ↗</button>` : ''}</div>${m.completed ? '' : `<label>Inventory value target ($)</label><input id="targetEdit" type="number" min="0" step="1" value="${num(m.target)}" onchange="setMarketTarget(this.value)">${num(m.target) ? `<div class="row" style="font-size:13px;font-weight:700;margin:12px 0 6px"><span>Packed ${cash(allocated)} of ${cash(m.target)}</span><span>${Math.min(100, Math.round(allocated / num(m.target) * 100))}%</span></div><div class="bar"><div style="width:${Math.min(100, Math.round(allocated / num(m.target) * 100))}%"></div></div>` : ''}<div class="grid keep2" style="margin-top:12px"><div><div class="muted">Assigned to this market</div><div class="stat">${cash(allocated)}</div></div><div><div class="muted">Remaining to target</div><div class="stat">${cash(Math.max(0, num(m.target) - allocated))}</div></div><div><div class="muted">All finished stock value</div><div class="stat">${cash(allValue)}</div></div><div><div class="muted">Sales at this market</div><div class="stat">${cash(sold)}</div></div></div><p class="hint">Market inventory is reserved for planning. Sales reduce stock only after you tap Complete sale.</p>`}</div>${salesLinkPanel(m)}${marketCostsPanel(m)}${m.completed ? completedPanel(m) : `<div class="panel"><div class="actions" style="margin-top:0"><button onclick="showMarketAdd()">${marketAddOpen ? 'Close' : '+ Add inventory'}</button><button class="alt" onclick="includeAllInventory()">Include all available</button></div><div id="marketAdd" class="${marketAddOpen ? '' : 'hidden'}"><div class="addbar"><span id="addCount" class="muted" aria-live="polite">${addCountText()}</span><button onclick="addSelectedToMarket()">Add all selected</button></div><label for="marketSearch">Find a product</label><input id="marketSearch" placeholder="Search products" value="${esc(marketAddSearch)}" oninput="marketAddSearch=this.value;$('pickList').innerHTML=marketPickRows()"><div class="picklist addlist" id="pickList">${marketPickRows()}</div></div></div>`}<div class="panel"><div class="row"><h3>Market inventory</h3>${m.completed ? '' : `<button class="${marketSaleMode ? 'danger' : 'aqua'} small" onclick="toggleMarketSale()">${marketSaleMode ? 'Cancel sale' : 'Start a sale'}</button>`}</div>${marketSaleMode ? `<p class="hint">Tap + next to each product sold (− to undo). Nothing is deducted until you complete the sale.</p>` : ''}${mktSearchBox(m)}<div id="mktItems">${marketItemRows(m)}</div>${marketSaleMode ? salePanel() : ''}</div>${m.completed ? '' : finishPanel(m)}`;
}
function marketDirectionsSaved() {
    let m = data.markets.find(x => x.id === marketSelected);
    if (!m?.location)
        return;
    window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(m.location), '_blank', 'noopener');
}
function adjustMarketSale(pid, delta) {
    let m = data.markets.find(x => x.id === marketSelected), limit = Math.min(num(m.items?.[pid]), num(product(pid)?.stock)), next = (marketSaleDraft[pid] || 0) + delta;
    if (next < 0 || next > limit)
        return;
    if (next)
        marketSaleDraft[pid] = next;
    else
        delete marketSaleDraft[pid];
    render();
}
function marketInfo() {
    let m = data.markets.find(x => x.id === marketSelected);
    if (!m)
        return '<p>Market not found.</p>';
    let days = m.days?.length ? m.days : [{ date: m.date || '', start: '', end: '' }];
    return `${backBtn()}<div class="panel"><h2>Market details</h2><label>Market name</label><input id="infoName" value="${esc(m.name)}">${addressField('infoLocation', m.location || '')}<div class="actions"><button class="alt small" onclick="marketDirections()">📍 Directions (choose maps app)</button></div><label>Market cost ($)</label><input id="infoCost" type="number" min="0" step="0.01" value="${num(m.cost)}"><h3 style="margin-top:20px">Market dates & times</h3><div id="marketDays">${days.map(d => marketDayRow(d)).join('')}</div><button class="alt small" onclick="addMarketDay()">+ Add another day</button><div class="actions"><button onclick="saveMarketInfo()">Save details</button></div></div><div class="panel"><h3>Cancelled or not happening?</h3><p class="muted" style="margin-top:0">If it moved, change the dates above. If it's not happening, delete it. Packed items go back to your stock, and any sales stay in Reports.</p><div class="actions"><button class="danger" onclick="deleteMarket()">Delete market</button></div></div>`;
}
function marketDayRow(d = {}) {
    return `<div class="entry market-day"><label>Date</label><input type="date" class="dayDate" value="${esc(d.date || '')}"><div class="two"><div><label>Start time</label><input type="time" class="dayStart" value="${esc(d.start || '')}"></div><div><label>End time</label><input type="time" class="dayEnd" value="${esc(d.end || '')}"></div></div><button class="danger small" onclick="this.closest('.market-day').remove()">Remove day</button></div>`;
}
function addMarketDay() {
    $('marketDays').insertAdjacentHTML('beforeend', marketDayRow());
}
function saveMarketInfo() {
    let m = data.markets.find(x => x.id === marketSelected), name = $('infoName').value.trim(), cost = Number($('infoCost').value);
    if (!name || !Number.isFinite(cost) || cost < 0)
        return appAlert('Enter a market name and a valid cost.');
    let days = readMarketDays();
    m.name = name;
    m.location = $('infoLocation').value.trim();
    m.cost = cost;
    m.days = days;
    m.date = days[0]?.date || '';
    save();
    goBack();
    toast('Market details saved.');
}
function marketDirections() {
    let location = $('infoLocation')?.value.trim();
    if (!location)
        return appAlert('Enter a market address first.');
    window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(location), '_blank', 'noopener');
}
function setMarketTarget(value) {
    let n = Number(value);
    if (!Number.isFinite(n) || n < 0)
        return appAlert('Enter a valid target amount.');
    data.markets.find(m => m.id === marketSelected).target = n;
    save();
    render();
}
function showMarketAdd() {
    marketAddOpen = !marketAddOpen;
    render();
}
function availableFor(pid) {
    let alloc = data.markets.reduce((a, m) => a + num(m.items?.[pid]), 0);
    return Math.max(0, num(product(pid)?.stock) - alloc);
}
// Add inventory: pick amounts for any number of products, then add them all at once.
function marketPickRows() {
    let q = marketAddSearch.toLowerCase().trim(), list = data.products.filter(p => !q || [p.name, p.variation].some(x => String(x || '').toLowerCase().includes(q)));
    return list.map(p => {
        let av = availableFor(p.id), n = Math.min(marketAddQty[p.id] || 0, av);
        return `<div class="addrow ${n ? 'on' : ''}"><div class="grow"><b>${esc(p.name)}${p.variation ? ' — ' + esc(p.variation) : ''}</b><div class="muted">${av} available</div></div><button type="button" class="alt small" aria-label="One less ${esc(p.name)}" ${n ? '' : 'disabled'} onclick="stepAddQty('${p.id}',-1)">−</button><b class="addqty">${n}</b><button type="button" class="alt small" aria-label="One more ${esc(p.name)}" ${n < av ? '' : 'disabled'} onclick="stepAddQty('${p.id}',1)">+</button><button type="button" class="alt small" ${av && n < av ? '' : 'disabled'} onclick="setAddQty('${p.id}',availableFor('${p.id}'))">All</button></div>`;
    }).join('') || '<p class="muted">No matching products.</p>';
}
function addCountText() {
    let n = Object.values(marketAddQty).reduce((a, q) => a + q, 0), k = Object.values(marketAddQty).filter(q => q > 0).length;
    return n ? `<b>${n}</b> item${n > 1 ? 's' : ''} selected · ${k} product${k > 1 ? 's' : ''}` : 'Nothing selected yet';
}
function setAddQty(pid, q) {
    q = Math.max(0, Math.min(Math.floor(q), availableFor(pid)));
    if (q)
        marketAddQty[pid] = q;
    else
        delete marketAddQty[pid];
    $('pickList').innerHTML = marketPickRows();
    $('addCount').innerHTML = addCountText();
}
function stepAddQty(pid, d) {
    setAddQty(pid, (marketAddQty[pid] || 0) + d);
}
function addSelectedToMarket() {
    let m = data.markets.find(x => x.id === marketSelected), adds = Object.entries(marketAddQty).map(([pid, q]) => [product(pid), Math.min(q, availableFor(pid))]).filter(([p, q]) => p && q > 0);
    if (!adds.length)
        return appAlert('Tap + or All next to the products you want to bring.');
    m.items ||= {};
    for (let [p, q] of adds)
        m.items[p.id] = num(m.items[p.id]) + q;
    let n = adds.reduce((a, [, q]) => a + q, 0);
    marketAddQty = {};
    marketAddSearch = '';
    marketAddOpen = false;
    save();
    render();
    toast(`${n} item${n > 1 ? 's' : ''} added to ${m.name}.`);
}
async function includeAllInventory() {
    let m = data.markets.find(x => x.id === marketSelected);
    let adds = data.products.map(p => [p, availableFor(p.id)]).filter(([p, a]) => a > 0);
    if (!adds.length)
        return appAlert('All finished inventory is already assigned to markets.');
    let count = adds.reduce((a, [p, q]) => a + q, 0), value = adds.reduce((a, [p, q]) => a + q * num(p.price), 0);
    if (!await appConfirm(`Add all available inventory to this market?\n\n${count} item(s) across ${adds.length} product(s), worth ${cash(value)}.`))
        return;
    m.items ||= {};
    for (let [p, q] of adds)
        m.items[p.id] = num(m.items[p.id]) + q;
    save();
    render();
    toast(`${count} item(s) added to ${m.name}.`);
}
function changeMarketItem(pid, delta) {
    let m = data.markets.find(x => x.id === marketSelected);
    if (delta > 0) {
        let allocated = data.markets.reduce((a, market) => a + num(market.items?.[pid]), 0);
        if (allocated >= num(product(pid)?.stock))
            return appAlert('No additional unassigned stock available.');
    }
    m.items[pid] = Math.max(0, num(m.items[pid]) + delta);
    if (!m.items[pid])
        delete m.items[pid];
    save();
    render();
}
function marketTime(m) {
    let d = m.days?.[0]?.date || m.date;
    if (d)
        return new Date(d + 'T12:00:00').getTime();
    if (m.completedAt)
        return new Date(m.completedAt).getTime();
    let t = data.sales.filter(x => x.marketId === m.id).map(x => new Date(x.date).getTime());
    return t.length ? Math.min(...t) : null;
}
function completedBetween(start, end) {
    return data.markets.filter(m => {
        if (!m.completed)
            return false;
        let t = marketTime(m);
        return t !== null && t >= start && t < end;
    });
}
function trimAllocations(pid) {
    let p = product(pid);
    if (!p)
        return;
    let open = data.markets.filter(m => !m.completed && num(m.items?.[pid]) > 0), over = open.reduce((a, m) => a + num(m.items[pid]), 0) - num(p.stock);
    if (over <= 0)
        return;
    open.sort((a, b) => (marketTime(b) || 0) - (marketTime(a) || 0));
    for (let m of open) {
        if (over <= 0)
            break;
        let take = Math.min(over, num(m.items[pid]));
        m.items[pid] -= take;
        over -= take;
        if (!m.items[pid])
            delete m.items[pid];
    }
}
// ---- Delete a market ----
async function deleteMarket() {
    let m = data.markets.find(x => x.id === marketSelected);
    if (!m)
        return;
    let packed = Object.values(m.items || {}).reduce((a, q) => a + num(q), 0), sales = data.sales.filter(s => s.marketId === m.id), amt = sales.reduce((a, s) => a + lineRev(s), 0), n = new Set(sales.map(s => s.orderId || s.id)).size;
    let msg = (m.completed ? '' : packed ? `The ${packed} item${packed === 1 ? '' : 's'} packed for it go back to your available stock.` : 'Nothing is packed for it yet.') + (n ? `\n\nIt has ${n} sale${n === 1 ? '' : 's'} (${cash(amt)}) recorded. They'll stay in Reports as sales with no market, so your totals don't change.` : '') + '\n\nThis can’t be undone.';
    if (!await appDialog({ title: `Delete ${m.name}?`, message: msg.trim(), ok: 'Delete market', cancel: 'Cancel', danger: true }))
        return;
    for (let s of sales) {
        s.marketId = null;
        s.fromMarket = m.name;
    }
    for (let o of data.orders || [])
        if (o.marketId === m.id) {
            o.marketId = null;
            o.fromMarket = m.name;
        }
    for (let e of data.expenses || [])
        if (e.marketId === m.id) {
            e.marketId = null;
            e.fromMarket = m.name + ' (deleted)';
        }
    data.markets = data.markets.filter(x => x.id !== m.id);
    if (marketSaleMode && saleKind !== 'quick') {
        marketSaleMode = false;
        marketSaleDraft = {};
    }
    save();
    view('markets');
    toast(`${m.name} deleted.`);
}
