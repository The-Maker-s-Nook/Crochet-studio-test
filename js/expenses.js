// Expenses and receipts: categories, how each one counts in profit and tax, the market Costs panel.
// The receipt screens (list, add/edit, details) are in receipts.js. Every receipt is an expense in data.expenses.
// Part of the Crochet Studio app. Files load in the order listed in index.html.

const EXPENSE_CATS = ['Yarn', 'Supplies', 'Packaging', 'Booth fees', 'Shipping', 'Tools', 'Marketing', 'Gas & travel', 'Displays & booth', 'Fees & subscriptions', 'Other'];
// Yarn and supplies are already in Material costs on each sale; booth fees are already on each market.
const MATERIAL_EXPENSE_CATS = ['Yarn', 'Supplies'], PROOF_EXPENSE_CATS = ['Booth fees'];
function expenseCats() {
    return [...EXPENSE_CATS, ...(data.expenseCats || []).filter(c => !EXPENSE_CATS.includes(c))];
}
// 'material' (yarn, supplies), 'proof' (booth fees) or 'other' (taken off profit as Other expenses)
function expenseKind(e) {
    return MATERIAL_EXPENSE_CATS.includes(e?.category) ? 'material' : PROOF_EXPENSE_CATS.includes(e?.category) ? 'proof' : 'other';
}
// Cost counted against profit: before tax, unless "Not claiming tax on materials" is ticked.
// Yarn, supply and booth fee receipts are proof only, so they aren't taken off again.
function expenseCost(e) {
    if (expenseKind(e) !== 'other')
        return 0;
    return data.settings.notClaimingTax ? num(e.pre) + num(e.tax) : num(e.pre);
}
// Tax paid on an expense that counts in the Sales tax totals (yarn and supply tax is already in "tax paid on materials").
function expenseTaxPaid(e) {
    return expenseKind(e) === 'material' ? 0 : num(e.tax);
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
    return `<button class="rowbtn exprow" onclick="openReceipt('${e.id}')"><div class="row"><span class="grow"><b>${esc(e.name)}</b><span class="muted block">${esc(bits.join(' · '))}</span></span><b>${cash(e.amount)}</b></div></button>`;
}
// Market › Costs: booth cost plus any expenses tied to this market.
function marketCostsPanel(m) {
    let ex = (data.expenses || []).filter(e => e.marketId === m.id).sort((a, b) => String(a.date).localeCompare(String(b.date))), total = num(m.cost) + ex.filter(e => expenseKind(e) === 'other').reduce((a, e) => a + num(e.amount), 0), proof = ex.some(e => expenseKind(e) !== 'other');
    return `<div class="panel costs"><h3>Costs</h3><div class="row"><span>Booth cost</span><b>${cash(m.cost || 0)}</b></div>${ex.map(e => expenseRow(e, false)).join('')}<button class="linkbtn addexp" onclick="newExpense('${m.id}')">+ Add expense or receipt</button>${ex.length ? `<div class="row tot"><b>Total costs</b><b>${cash(total)}</b></div>` : ''}${proof ? '<p class="hint">Yarn, supply and booth fee receipts are kept as proof. Their cost is already counted, so it isn’t added again.</p>' : ''}</div>`;
}
