// Reminders: products to make more of, materials to buy, and your own checklist (not tied to a market)
// Part of the Crochet Studio app. Files load in the order listed in index.html.

ICONS.bell = '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>';

// Open (not yet ticked) reminder for a product or material, if there is one.
function reminderFor(kind, refId) {
    return (data.reminders || []).find(r => r.kind === kind && r.refId === refId && !r.done);
}
// Reminders whose product or material still exists.
function liveReminders() {
    return (data.reminders || []).filter(r => r.kind === 'note' || (r.kind === 'product' ? product(r.refId) : material(r.refId)));
}
function openReminderCount() {
    return liveReminders().filter(r => !r.done).length;
}
// Bell in the header: shows how many reminders are still open.
function updateReminderBadge() {
    let b = $('remBadge'), n = openReminderCount();
    if (!b)
        return;
    b.textContent = n > 9 ? '9+' : String(n);
    b.classList.toggle('hidden', !n);
    $('remBtn')?.setAttribute('aria-label', n ? `Reminders, ${n} open` : 'Reminders');
}
// corner = true: a small round bell in the card's top-left corner (product cards); 'icon': bell only, colour shows it's on (material rows)
function reminderToggleBtn(kind, refId, label, corner) {
    let on = !!reminderFor(kind, refId), what = kind === 'product' ? 'make more' : 'buy more';
    if (corner === true)
        return `<button class="cornerbell ${on ? 'on' : ''}" aria-pressed="${on}" aria-label="${on ? 'On your reminders' : 'Remind me to ' + what}: ${esc(label)}" title="${on ? 'On your reminders (tap to remove)' : 'Remind me to ' + what}" onclick="event.stopPropagation();toggleReminderFor('${kind}','${refId}')">${ic('bell', 15)}</button>`;
    return `<button class="alt small rembtn ${corner === 'icon' ? 'iconly' : ''} ${on ? 'on' : ''}" aria-pressed="${on}" aria-label="${on ? 'On your reminders' : 'Remind me to ' + what}: ${esc(label)}" title="${on ? 'On your reminders (tap to remove)' : 'Remind me to ' + what}" onclick="event.stopPropagation();toggleReminderFor('${kind}','${refId}')">${ic('bell', 16)}${on && corner !== 'icon' ? ' On reminders' : ''}</button>`;
}
function toggleReminderFor(kind, refId) {
    data.reminders ||= [];
    let r = reminderFor(kind, refId), name = kind === 'product' ? product(refId)?.name : materialLabel(material(refId));
    if (r)
        data.reminders = data.reminders.filter(x => x !== r);
    else
        data.reminders.push({ id: id(), kind, refId, done: false, created: new Date().toISOString() });
    save();
    render();
    flash(r ? `${name} taken off your reminders.` : `${name} added to your reminders: ${kind === 'product' ? 'make more' : 'buy more'}.`);
}
function toggleReminder(rid) {
    let r = (data.reminders || []).find(x => x.id === rid);
    if (!r)
        return;
    r.done = !r.done;
    r.doneAt = r.done ? new Date().toISOString() : undefined;
    save();
    render();
}
function deleteReminder(rid) {
    data.reminders = (data.reminders || []).filter(x => x.id !== rid);
    save();
    render();
}
function addReminderNote() {
    let el = $('remText'), text = normName(el?.value);
    if (!text)
        return el?.focus();
    data.reminders ||= [];
    data.reminders.push({ id: id(), kind: 'note', text, done: false, created: new Date().toISOString() });
    save();
    render();
    $('remText')?.focus();
}
async function clearDoneReminders() {
    if (!await appConfirm('Remove all ticked reminders?'))
        return;
    data.reminders = (data.reminders || []).filter(r => !r.done);
    save();
    render();
}
function reminderRow(r) {
    let title, sub, open;
    if (r.kind === 'product') {
        let p = product(r.refId);
        title = p.name + (p.variation ? ' — ' + p.variation : '');
        sub = `Make more · ${num(p.stock)} in stock`;
        open = `detail('${p.id}')`;
    }
    else if (r.kind === 'material') {
        let m = material(r.refId);
        title = materialLabel(m);
        sub = `Buy more${stockCounts(m) && stockKnown(m) ? ' · ' + stockLine(m) : ''}${m.store ? ' · ' + m.store : ''}`;
        open = `editMaterial('${m.id}')`;
    }
    else {
        title = r.text;
        sub = '';
    }
    return `<div class="remrow ${r.done ? 'done' : ''}"><label class="check grow"><input type="checkbox" ${r.done ? 'checked' : ''} onchange="toggleReminder('${r.id}')"><span><b>${esc(title)}</b>${sub ? `<span class="muted block">${esc(sub)}</span>` : ''}</span></label>${open ? `<button class="alt small" onclick="${open}">Open</button>` : `<button class="iconbtn small" aria-label="Delete ${esc(title)}" onclick="deleteReminder('${r.id}')">${ic('x', 16)}</button>`}</div>`;
}
function reminders() {
    let all = liveReminders(), sec = (kind, title, empty) => {
        let list = all.filter(r => r.kind === kind).sort((a, b) => (a.done - b.done) || String(a.created).localeCompare(String(b.created)));
        return `<div class="panel"><h3>${title}</h3>${list.map(reminderRow).join('') || `<p class="muted">${empty}</p>`}${kind === 'note' ? `<div class="row addnote"><label for="remText" class="sr-only">New reminder</label><input id="remText" placeholder="e.g. Make 3 bees for Grandma" onkeydown="if(event.key==='Enter'){event.preventDefault();addReminderNote()}"><button onclick="addReminderNote()">Add</button></div>` : ''}</div>`;
    }, anyDone = all.some(r => r.done);
    return `<div class="row"><h2>Reminders</h2>${anyDone ? '<button class="alt small" onclick="clearDoneReminders()">Clear ticked</button>' : ''}</div>${sec('product', 'Make more', `Tap the ${ic('bell', 14)} on a product to add it here.`)}${sec('material', 'Buy more', `Tap the ${ic('bell', 14)} on a material to add it here.`)}${sec('note', 'My list', 'Anything else you want to remember, not tied to a market.')}`;
}
