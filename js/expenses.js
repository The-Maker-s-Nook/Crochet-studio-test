// Extra expenses (gas, displays, fees...): add from a market or from Reports, counted in profit and tax
// Part of the Crochet Studio app. Files load in the order listed in index.html.

const EXPENSE_CATS = ['Gas & travel', 'Displays & booth', 'Fees', 'Other'];
let expenseEditing = null, expenseMarket = null, expenseCat = '';

// Cost counted against profit: before tax, unless "Not claiming tax on materials" is ticked.
function expenseCost(e) {
    return data.settings.notClaimingTax ? num(e.pre) + num(e.tax) : num(e.pre);
}
// Expenses with no market (or whose market was deleted), dated inside a time frame.
function looseExpensesBetween(a, b) {
    return (data.expenses || []).filter(e => {
        if (e.marketId && data.markets.some(m => m.id === e.marketId))
            return false;
        let t = Date.parse(e.date + 'T12:00:00');
        return t >= a && t < b;
    });
}
function expenseMarketName(e) {
    return data.markets.find(m => m.id === e.marketId)?.name || e.fromMarket || '';
}
function expenseRow(e, showMarket) {
    let d = e.date ? new Date(e.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '', bits = [e.category, showMarket ? expenseMarketName(e) || 'No market' : '', d, num(e.tax) ? `incl. ${cash(e.tax)} tax` : ''].filter(Boolean);
    return `<button class="rowbtn exprow" onclick="editExpense('${e.id}')"><div class="row"><span class="grow"><b>${esc(e.name)}</b><span class="muted block">${esc(bits.join(' · '))}</span></span><b>${cash(e.amount)}</b></div></button>`;
}
// Market › Costs: booth cost plus any expenses tied to this market.
function marketCostsPanel(m) {
    let ex = (data.expenses || []).filter(e => e.marketId === m.id).sort((a, b) => String(a.date).localeCompare(String(b.date))), total = num(m.cost) + ex.reduce((a, e) => a + num(e.amount), 0);
    return `<div class="panel costs"><h3>Costs</h3><div class="row"><span>Booth cost</span><b>${cash(m.cost || 0)}</b></div>${ex.map(e => expenseRow(e, false)).join('')}<button class="linkbtn addexp" onclick="newExpense('${m.id}')">+ Add expense</button>${ex.length ? `<div class="row tot"><b>Total costs</b><b>${cash(total)}</b></div>` : ''}</div>`;
}
function newExpense(mid) {
    go('expenseForm', () => {
        expenseEditing = null;
        expenseMarket = mid || null;
        expenseCat = '';
    });
}
function editExpense(eid) {
    let e = (data.expenses || []).find(x => x.id === eid);
    if (!e)
        return;
    go('expenseForm', () => {
        expenseEditing = eid;
        expenseMarket = e.marketId || null;
        expenseCat = e.category || '';
    });
}
function pickExpenseCat(c) {
    expenseCat = expenseCat === c ? '' : c;
    document.querySelectorAll('.expcat').forEach(b => {
        let on = b.dataset.cat === expenseCat;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
    });
}
function expenseTaxLine() {
    let el = $('expTaxLine');
    if (!el)
        return;
    let item = { taxOverride: readTaxOverride('e') }, t = materialTaxInfo(item), amt = num($('expAmount').value), tax = purchaseTax(item, amt);
    el.textContent = t.mode === 'none' ? 'No tax tracked on this expense.' : amt ? `${t.mode === 'add' ? 'Tax added' : 'Tax inside'} at ${num(t.rate)}%: ${cash(tax)}${t.mode === 'add' ? ` · total paid ${cash(amt + tax)}` : ''}` : `Tax: ${t.mode === 'add' ? 'added on top of' : 'included in'} the amount at ${num(t.rate)}%.`;
}
function expenseForm() {
    let e = expenseEditing ? (data.expenses || []).find(x => x.id === expenseEditing) : null, today = new Date().toISOString().slice(0, 10), mk = [...data.markets].sort((a, b) => String(marketSortDate(b)).localeCompare(String(marketSortDate(a)))), mid = expenseMarket;
    return `${backBtn()}<div class="panel" style="margin-top:12px"><h2>${e ? 'Edit expense' : 'Add expense'}</h2><label for="expName">What was it?</label><input id="expName" value="${esc(e?.name || '')}" placeholder="e.g. Gas, table cloth, card reader fee"><div class="grid keep2">
<div><label for="expAmount">Amount ($)</label><input id="expAmount" type="number" min="0" step="0.01" inputmode="decimal" value="${e ? num(e.entered ?? e.amount) : ''}" oninput="expenseTaxLine()"></div><div><label for="expDate">Date</label><input id="expDate" type="date" value="${esc(e?.date || today)}"></div></div>
<div class="labelrow"><span style="font-size:13px;font-weight:700">Category <span class="muted">(optional)</span></span></div><div class="chips">${EXPENSE_CATS.map(c => `<button type="button" class="chipbtn expcat ${expenseCat === c ? 'on' : ''}" data-cat="${esc(c)}" aria-pressed="${expenseCat === c}" onclick="pickExpenseCat('${c.replace(/'/g, "\\'")}')">${esc(c)}</button>`).join('')}</div>
<label for="expMarket">Market <span class="muted">(optional)</span></label><select id="expMarket"><option value="">No market</option>${mk.map(m => `<option value="${m.id}" ${mid === m.id ? 'selected' : ''}>${esc(m.name)}${marketSortDate(m) ? ' · ' + esc(new Date(marketSortDate(m) + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })) : ''}</option>`).join('')}</select>
${taxOverrideField('e', e, 'material', 'expenseTaxLine()')}<p class="hint" id="expTaxLine"></p><div class="actions"><button onclick="saveExpense()">Save expense</button>${e ? `<button class="danger" onclick="deleteExpense('${e.id}')">Delete</button>` : ''}</div></div>`;
}
function saveExpense() {
    let name = normName($('expName').value), v = $('expAmount').value.trim(), amount = Number(v), date = $('expDate').value || new Date().toISOString().slice(0, 10);
    if (!name)
        return needField('expName', 'Enter what the expense was for, e.g. Gas.');
    if (v === '' || !(amount >= 0))
        return needField('expAmount', 'Enter the amount you paid.');
    if (badTaxOverride('e'))
        return needField('eTaxRate', 'Enter a tax rate between 0 and 100, or untick Override tax settings.');
    data.expenses ||= [];
    let e = expenseEditing ? data.expenses.find(x => x.id === expenseEditing) : null;
    if (!e) {
        e = { id: id() };
        data.expenses.push(e);
    }
    Object.assign(e, { name, entered: round2(amount), amount: round2(amount), date, category: expenseCat, marketId: $('expMarket').value || null, taxOverride: readTaxOverride('e') });
    if (e.marketId)
        delete e.fromMarket;
    let t = materialTaxInfo(e), sp = splitPrice(e.amount, t.mode, t.rate);
    e.tax = t.mode === 'none' ? 0 : round2(sp.tax);
    e.pre = round2(t.mode === 'add' ? e.amount : e.amount - e.tax);
    // An amount entered before tax means more was paid in total.
    if (t.mode === 'add')
        e.amount = round2(e.amount + e.tax);
    save();
    goBack();
    toast('Expense saved.');
}
async function deleteExpense(eid) {
    let e = (data.expenses || []).find(x => x.id === eid);
    if (!e || !await appConfirm(`Delete ${e.name} (${cash(e.amount)})?`, { ok: 'Delete', danger: true }))
        return;
    data.expenses = data.expenses.filter(x => x.id !== eid);
    save();
    goBack();
    toast('Expense deleted.');
}
// Reports › Expenses (folded by default)
function expensesReportPanel(f) {
    let ex = [...(f.expenses || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return `<div class="panel"><h3>Expenses</h3>${ex.length ? ex.map(e => expenseRow(e, true)).join('') + `<div class="hint">${data.settings.notClaimingTax ? 'Profit counts these with tax, because you’re not claiming tax on materials.' : 'Profit counts these before tax; the tax shows under Sales tax.'}</div>` : '<p class="muted">No expenses in this time frame.</p>'}<button class="linkbtn addexp" onclick="newExpense(reportMarket !== 'all' && reportMarket !== 'quick' ? reportMarket : null)">+ Add expense</button></div>`;
}
