// Tutorials: optional, page-by-page lessons that spotlight the real screens
// Part of The Makers Nook app. Files load in the order listed in index.html.
// Open from Settings › Tutorials, the ? button in the header, or the welcome prompt on first open.
// Wording is kept general to all crafts (supplies, packs, makes), not yarn-specific.

ICONS.help = '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.7"/><path d="M12 17.2h.01"/>';
ICONS.crown = '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>';
ICONS.todo = '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17"/>';
ICONS.receipt ||= '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>';

// ===== Plan =====
// Swap this for the real subscription check once Pro is live.
function tutIsPro() {
    return lsGet('csTutPreview', 'free') === 'pro';
}
function setTutPreview(v) {
    lsSet('csTutPreview', v);
    render();
}

// ===== Finding things on screen =====
const tq = s => document.querySelector(s);
const tw = ms => new Promise(r => setTimeout(r, ms));
const shown = e => e && e.getClientRects().length > 0;
function tbtn(text, root) {
    return [...(root || document).querySelectorAll('button')].find(b => shown(b) && b.innerText.replace(/\s+/g, ' ').trim().startsWith(text));
}
function tpanel(text) {
    let t = text.toLowerCase(), list = [...document.querySelectorAll('#app .panel')].filter(p => shown(p) && p.innerText.toLowerCase().includes(t));
    return list.sort((a, b) => a.innerText.length - b.innerText.length)[0];
}
// A form field together with its label
function tfield(inputId) {
    let i = $(inputId);
    if (!i)
        return null;
    let lbl = document.querySelector(`label[for="${inputId}"]`) || (i.previousElementSibling?.tagName === 'LABEL' ? i.previousElementSibling : null);
    return lbl && shown(lbl) ? [lbl, i] : i;
}
// A label and the control(s) right after it
function tlabeled(text) {
    let lbl = [...document.querySelectorAll('#app label')].find(l => shown(l) && l.innerText.trim().startsWith(text));
    if (!lbl)
        return null;
    let out = [lbl], e = lbl.nextElementSibling;
    while (e && out.length < 2 && !['LABEL', 'H2', 'H3', 'H4'].includes(e.tagName)) {
        if (shown(e) && e.getBoundingClientRect().height > 4)
            out.push(e);
        e = e.nextElementSibling;
    }
    return out;
}
function theading(text) {
    return [...document.querySelectorAll('#app h3')].find(h => shown(h) && h.innerText.trim() === text);
}
const tiles = (a, b) => [...document.querySelectorAll('#app .tile')].filter(shown).slice(a, b);
// The market the lessons use: the next one coming up, or any market
function tutMarketId() {
    return (upcomingMarket()?.m || data.markets.find(m => !m.completed) || data.markets[0])?.id;
}
// Screen setup for each step. Each one does nothing if that screen is already showing,
// so Back can re-run it safely to return to the right page.
const tutView = s => () => { if (screen !== s) view(s); };
const tutGo = s => () => { if (screen !== s) go(s); };
const tutForm = (s, open) => () => { if (screen !== s) open(); };
function tutReports(tab) {
    return () => {
        if (screen !== 'reports')
            view('reports');
        if (reportTab !== tab)
            setReportTab(tab);
    };
}
// The market page, with the Add inventory picker open or closed
function tutMarket(addOpen) {
    return () => {
        let mid = tutMarketId();
        if (!mid)
            return;
        if (screen !== 'marketDetail' || marketSelected !== mid || marketSaleMode) {
            tutClearSale();
            openMarket(mid);
        }
        if (marketAddOpen !== !!addOpen) {
            marketAddOpen = !!addOpen;
            marketAddQty = {};
            if (addOpen) {
                let p = data.products.find(p => availableFor(p.id) > 0);
                if (p)
                    marketAddQty[p.id] = Math.min(2, availableFor(p.id));
            }
            render();
        }
    };
}
// The market page in selling mode with one item in the cart
function tutSale() {
    let mid = tutMarketId(), m = data.markets.find(x => x.id === mid);
    if (!m)
        return;
    if (screen !== 'marketDetail' || marketSelected !== mid) {
        tutClearSale();
        openMarket(mid);
    }
    if (!marketSaleMode)
        tbtn('Start a sale')?.click();
    if (!Object.values(marketSaleDraft || {}).some(q => q > 0)) {
        let pid = Object.keys(m.items || {}).find(k => num(m.items[k]) > 0);
        if (pid)
            adjustMarketSale(pid, 1);
    }
}
// Checkout with one item in the cart, to show the payment choices. Done in one go so no in-between screen flashes by.
function tutCheckout() {
    if (screen === 'saleReview')
        return;
    let mid = tutMarketId(), m = data.markets.find(x => x.id === mid);
    if (!m)
        return;
    tutSale();
    tbtn('Review sale')?.click();
}
function tutClearSale() {
    try { resetSale(); } catch { }
    marketSaleMode = false;
    marketSaleDraft = {};
    marketAddOpen = false;
    marketAddQty = {};
}

// ===== Lessons =====
// Step: run (moves to the right screen, may be async), el (what to spotlight), title, body,
// pro (paid feature), limit (what the free plan gets), wait (ms for the screen to settle)
const LESSONS = [
    { id: 'home', page: 'home', icon: 'home', tic: 'lav', title: 'Getting around', sub: 'The Home page, menu and shortcuts', steps: [
        { run: tutView('home'), title: 'Welcome', body: 'This quick lesson shows you where everything lives. Tap Next to move on, or Exit any time.' },
        { el: () => $('nav'), title: 'Your pages', body: 'Each page has a tab along the bottom: products, materials, patterns, markets and reports.' },
        { el: () => tq('.nextcard'), title: 'Your next market', body: 'Home always shows your next market, how much you’ve packed toward your goal, and to-dos still left.' },
        { el: () => tq('.tiles'), title: 'Your numbers at a glance', body: 'Finished items, stock value and this month’s profit update as you make and sell things.' },
        { el: () => tq('.quick'), title: 'Shortcuts', body: 'Add a new product or material straight from Home without changing pages.' },
        { el: () => tbtn('Quick sale'), title: 'Quick sale', body: 'Selling outside a market, like an order from a friend? Ring it up here.' },
        { el: () => $('remBtn'), title: 'Reminders', body: 'The bell holds things to make more of, supplies to buy, and your own notes.', pro: true },
        { el: () => $('tutBtn'), title: 'Help on every page', body: 'Forgot how something works? Tap ? on any page to replay that page’s lesson.' }
    ] },
    { id: 'materials', page: 'materials', icon: 'materials', tic: 'aqua', title: 'Materials', sub: 'Add the supplies you make things from', steps: [
        { run: tutView('materials'), el: () => tbtn('+ Material'), title: 'Start with materials', body: 'Add the supplies you buy. Product costs are worked out from these, so they come first.' },
        { el: () => tq("#app .tabs button[onclick^='materialCatId']")?.parentElement, title: 'Sorted by category', body: 'Tap a category to see just those supplies. Add your own categories with + Category.' },
        { el: () => tq('#app .folder-head'), title: 'Your materials list', body: 'Each material groups its colours and variations. Tap one to open it, edit it or add more stock.' },
        { run: tutForm('materialForm', newMaterial), el: () => tfield('mcat'), title: 'Adding a material', body: 'Pick the category first. It sets the unit it’s measured in, like grams, pieces or pairs.' },
        { el: () => tfield('mname'), title: 'Name and type', body: 'Type the brand or type of supply. Use Variation for the colour, size or scent.' },
        { el: () => [tfield('mweight'), tfield('mprice')].flat(), title: 'What you paid', body: 'Enter how much comes in one pack and the price you paid. The app works out your cost per unit from these.' },
        { el: () => tfield('mpackages'), title: 'How many you bought', body: 'Packs bought adds to your stock, so you can see what’s left on the shelf.' },
        { el: () => tbtn('Save material'), title: 'Save it', body: 'Tap Save material and it’s ready to use in your products.' }
    ] },
    { id: 'products', page: 'products', icon: 'products', tic: 'pink', title: 'Products', sub: 'Make a product and price it', steps: [
        { run: tutView('products'), el: () => tbtn('+ Product'), title: 'Make a product', body: 'Products are the things you sell. Tap + Product to create one.' },
        { el: () => tq('#app .folder-head'), title: 'Grouped by tags', body: 'Tags keep your list tidy, like one for each type of thing you make. A product can have more than one tag.' },
        { run: tutForm('productForm', newProduct), el: () => [tfield('pname'), tfield('pvariation')].flat(), title: 'Name it', body: 'Give it a name and, if you make it in different colours or sizes, a variation.' },
        { el: () => theading('Materials used'), title: 'Materials used', body: 'Pick the supplies it takes and how much of each. This sets your material cost.' },
        { el: () => tfield('phours'), title: 'Time to make', body: 'How long one takes you. It’s used to pay you for your time in the suggested price.' },
        { el: () => tlabeled('Linked pattern'), title: 'Link a pattern', body: 'Pick the pattern you follow for this product, so it’s one tap away when you make more.', pro: true },
        { el: () => tfield('pmethod'), title: 'How it’s priced', body: 'Choose a pricing method. The default is your materials plus an hourly rate you set in Settings.' },
        { el: () => tfield('pprice'), title: 'Your selling price', body: 'The app suggests a price. Tap Use suggested, or type your own.' },
        { el: () => tfield('pinitialStock'), title: 'Finished inventory', body: 'Already have some made? Add them here so you can pack them for markets.' },
        { el: () => tbtn('Save product'), title: 'Save it', body: 'Tap Save product. You can come back and edit it any time.' }
    ] },
    { id: 'patterns', page: 'patterns', icon: 'patterns', tic: 'gold', pro: true, title: 'Patterns', sub: 'Store patterns and link them to products', steps: [
        { run: tutView('patterns'), el: () => tpanel('Add pattern'), title: 'Your pattern library', body: 'Keep your patterns in one place. Add a PDF or photo, snap a page with the camera, or save a link.', pro: true },
        { el: () => tbtn('+ Tag')?.parentElement, title: 'Sort with tags', body: 'Tag patterns however you like and tap a tag to see just those.', pro: true },
        { el: () => tq('#app .panel.muted') || tq('#app .patcard'), title: 'Open a pattern', body: 'Tap a pattern to read it. Zoom in as much as you need, and it opens to the page you left off on. Link a pattern to a product when you make the product.', pro: true }
    ] },
    { id: 'markets', page: 'markets', icon: 'markets', tic: 'gold', title: 'Markets', sub: 'Plan, pack and sell at a market', done: tutClearSale, steps: [
        { run: tutView('markets'), el: () => tbtn('+ Market'), title: 'Add a market', body: 'Create each craft fair or event with its date, place and booth fee.', limit: 'Free plan: 1 market at a time. Pro: unlimited markets.' },
        { el: () => tbtn('Open market')?.closest('.panel'), title: 'Your upcoming markets', body: 'Each market shows its date and to-dos. Open market takes you to packing and selling.' },
        { run: tutMarket(false), el: () => tbtn('Details'), title: 'Market details', body: 'Tap Details to change the dates, times, location or booth fee.' },
        { el: () => tfield('targetEdit'), title: 'Set a packing goal', body: 'Enter how much stock value you want to bring. A bar shows how close you are.' },
        { el: () => tbtn('+ Add inventory'), title: 'Pack inventory', body: 'Tap + Add inventory to choose what’s going to this market.' },
        { run: tutMarket(true), el: () => $('pickList')?.closest('.panel'), title: 'Choose what to bring', body: 'Your finished products show with how many are available. Tap + for each one you’re bringing, or All for everything you have.' },
        { el: () => tbtn('Add all selected'), title: 'Add them all at once', body: 'Tap Add all selected to pack everything you picked.' },
        { run: tutMarket(false), el: () => theading('Market inventory')?.closest('.panel'), title: 'What you’re bringing', body: 'Everything packed for this market. Use − and + to adjust before you go.' },
        { el: () => tbtn('Start a sale'), title: 'Selling at the market', body: 'When a customer’s ready to buy, tap Start a sale.' },
        { run: tutSale, el: () => tbtn('Review sale'), title: 'Build the sale', body: 'Tap + on each item they’re buying. When the cart’s ready, tap Review sale to take payment.' },
        { run: tutCheckout, el: () => tpanel('How are they paying'), title: 'How they’re paying', body: 'Pick cash, card or e-transfer. The sale comes off your market inventory when you complete it.' },
        { el: () => tbtn('Card', tpanel('How are they paying')), title: 'Card payments', body: 'With Stripe, the customer taps their card on your phone and the sale finishes right here. With Square, the app hands the total over to the separate Square app, and you switch back here once it’s paid.', limit: 'Free plan: Square, or Stripe with a 1% app fee on top of Stripe’s processing fee. Pro: no app fee.' },
        { run: () => { if (screen !== 'settingsPayments') { tutClearSale(); go('settingsPayments'); } }, el: () => tpanel('Take card payments with') || tpanel('Square') || tq('#app h2'), title: 'Choose your card reader', body: 'Pick Stripe or Square once in Settings › Finances › Payments. You can change it any time.' },
        { run: tutMarket(false), el: () => tq('.panel.costs'), title: 'Costs and receipts', body: 'Add extra costs for this market, like gas or a receipt photo, so its profit is accurate.', pro: true },
        { el: () => tbtn('Mark market as completed')?.closest('.panel'), title: 'When it’s over', body: 'Mark the market completed. Unsold items go back to your stock and the sales show up in Reports.' }
    ] },
    { id: 'todo', page: 'marketTodo', icon: 'todo', tic: 'lav', title: 'To-do list', sub: 'Get ready for each market', steps: [
        { run: () => { let mid = tutMarketId(); if (mid && screen !== 'marketTodo') openTodo(mid); }, el: () => tq('#app .bar') || tq('#app h2'), title: 'A list for each market', body: 'Every market has its own to-do list. The bar shows how ready you are.' },
        { el: () => tfield('todoText'), title: 'Add a to-do', body: 'Type a task and tap Add.' },
        { el: () => tbtn('+ Pack float')?.parentElement, title: 'Quick add', body: 'Tap one of these to add common market prep in one tap.' },
        { el: () => tq('#app label:has(input[type=checkbox])'), title: 'Tick it off', body: 'Tap a to-do when it’s done. Tap it again if you need to undo.' },
        { el: () => tbtn('Clear checked items'), title: 'Tidy up', body: 'Clear checked items removes everything you’ve finished.' }
    ] },
    { id: 'reminders', page: 'reminders', icon: 'bell', tic: 'pink', pro: true, title: 'Reminders', sub: 'Things to make, buy and remember', steps: [
        { run: tutView('home'), el: () => $('remBtn'), title: 'Your reminders', body: 'Tap the bell from any page. The number shows how many are still open.', pro: true },
        { run: tutGo('reminders'), el: () => tpanel('Make more'), title: 'Make more', body: 'Tap the bell on a product card to add it here when you’re running low.', pro: true },
        { el: () => tpanel('Buy more'), title: 'Buy more', body: 'Tap the bell on a material to build a shopping list. It shows where you bought it.', pro: true },
        { el: () => tpanel('My list'), title: 'Your own notes', body: 'Type anything else you want to remember and tap Add. Tick items off when they’re done.', pro: true }
    ] },
    { id: 'reports', page: 'reports', icon: 'reports', tic: 'aqua', title: 'Reports', sub: 'What each report shows', steps: [
        { run: tutReports('overview'), el: () => tbtn('Overview')?.parentElement, title: 'Four reports', body: 'Overview is your totals. Markets, Stock, and Expenses and tax go into the details.', limit: 'Free plan: Overview. Pro: all four reports.' },
        { el: () => tlabeled('Time frame'), title: 'Pick a time frame', body: 'Look at all time, the last few months, or one year at a time to compare year to year.', limit: 'Free plan: one year at a time and all time.' },
        { el: () => tq('.herocard'), title: 'Profit', body: 'What you actually kept: sales, minus material costs, booth fees, other expenses and card fees.' },
        { el: () => tiles(0, 2), title: 'Sales revenue and items sold', body: 'Revenue is everything customers paid you, before any costs come off.' },
        { el: () => tiles(2, 4), title: 'Your costs', body: 'Material costs are what the supplies in the items you sold cost you. Booth costs are your market fees.' },
        { el: () => tpanel('Total card fees'), title: 'Card fees', body: 'Take Tap to Pay payments? Stripe’s processing fee and the app fee are listed here and taken off your profit, so you can claim them at tax time.' },
        { el: () => tpanel('Profit by market'), title: 'Profit by market', body: 'Compare markets side by side. Tap a bar to see that market’s details.', pro: true },
        { el: () => tbtn('Best market')?.parentElement, title: 'Best market and top seller', body: 'See which market paid off most and which product sells best, so you know what to make more of.', pro: true },
        { run: tutReports('markets'), el: () => tq('#app .filters'), title: 'Markets report', body: 'Pick a time frame and one market, or all of them.', pro: true },
        { el: () => tq('.herocard'), title: 'That market’s profit', body: 'Profit for the markets you picked, with the money in and money out shown in the bar.', pro: true },
        { el: () => [...document.querySelectorAll('#app .panel')].filter(p => shown(p) && !p.classList.contains('herocard') && /\d+ sold/.test(p.innerText)).sort((x, y) => x.innerText.length - y.innerText.length)[0], title: 'What sold', body: 'Every product sold at that market, ranked by how many went home with customers.', pro: true },
        { run: tutReports('stock'), el: () => tq('.herocard'), title: 'Stock report', body: 'What your supplies on hand are worth, split by category.', pro: true },
        { el: () => tiles(0, 2), title: 'Finished stock', body: 'How many finished items you have and what they’d sell for.', pro: true },
        { run: tutReports('expenses'), el: () => tq('.herocard'), title: 'Expenses and tax', body: 'Everything you spent: your receipts, plus card fees from Tap to Pay. Snap a receipt right from here.', pro: true },
        { el: () => tpanel('Tax for the year'), title: 'Tax for the year', body: 'Tax you collected on sales and paid on purchases, by year. Handy for your accountant.', pro: true },
        { run: tutReports('overview'), el: () => tbtn('Download'), title: 'Download your reports', body: 'Save a PDF or Excel copy of your reports, handy at tax time.' }
    ] },
    { id: 'receipts', page: 'receipts', icon: 'receipt', tic: 'pink', pro: true, title: 'Receipts', sub: 'Snap and track what you spend', steps: [
        { run: tutView('home'), el: () => tbtn('Snap receipt'), title: 'Snap a receipt', body: 'Bought supplies or paid for gas? Tap Snap receipt on Home to save it right away.', pro: true },
        { run: tutForm('expenseForm', () => newExpense()), el: () => [tbtn('Take photo'), tbtn('Upload photo')].filter(Boolean), title: 'Add the photo', body: 'Take a photo of the receipt or upload a photo or PDF you already have.', pro: true },
        { el: () => tfield('rStore'), title: 'Where it’s from', body: 'Type the store, or what it was for if there’s no store.', pro: true },
        { el: () => tbtn('Supplies')?.parentElement, title: 'Pick a category', body: 'Categories group your spending in the Expenses report. Add your own with + New category.', pro: true },
        { el: () => [tfield('rPre'), tfield('rTax')].flat(), title: 'Amount and tax', body: 'Enter the amount before tax and the tax. One tap adds your usual tax rate.', pro: true },
        { el: () => tlabeled('For a market'), title: 'Link it to a market', body: 'Pick a market and it comes off that market’s profit, like a booth fee or gas to get there.', pro: true },
        { el: () => tbtn('Save receipt'), title: 'Save it', body: 'Tap Save receipt. It shows up in your Expenses report right away.', pro: true },
        { run: tutGo('receipts'), el: () => tiles(0, 4), title: 'All your receipts', body: 'See what you spent and the tax you paid. Need a photo lists any receipt still missing its picture.', pro: true }
    ] }
];

// ===== Example items =====
// A brand-new app has nothing to point at, so lessons swap in example items while they run.
// The user's own data is set aside (never changed) and comes back the moment the lesson ends.
// Nothing is saved while examples are showing.
let tutReal = null;
function tutNeedsExamples() {
    return !data.products.length || !data.materials.length || !data.markets.some(m => !m.completed) || !data.sales.length;
}
function tutExampleData() {
    const day = n => { let d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    let d = normalizeData(JSON.parse(JSON.stringify({ settings: data.settings })));
    d.productCategories = [{ id: 'ex_t1', name: 'Plushies' }, { id: 'ex_t2', name: 'Bags' }];
    d.materials = [
        { id: 'ex_m1', name: 'Lavender cotton', categoryId: 'cat_yarn', unit: 'g', colour: 'Lavender', weight: 200, price: 6.99, stock: 540, trackStock: true, store: 'Craft store' },
        { id: 'ex_m2', name: 'Soft white cotton', categoryId: 'cat_yarn', unit: 'g', colour: 'White', weight: 100, price: 4.49, stock: 120, trackStock: true, store: 'Craft store' },
        { id: 'ex_m3', name: 'Safety eyes 12mm', categoryId: 'cat_eyes', unit: 'pair', weight: 50, price: 7.5, stock: 38, trackStock: true },
        { id: 'ex_m4', name: 'Polyfill', categoryId: 'cat_stuffing', unit: 'g', weight: 1000, price: 14.99, stock: 1200, trackStock: true }];
    d.products = [
        { id: 'ex_p1', name: 'Mini octopus', price: 15, stock: 12, hours: 1, materials: [{ materialId: 'ex_m1', amount: 40 }, { materialId: 'ex_m3', amount: 1 }, { materialId: 'ex_m4', amount: 20 }], tagIds: ['ex_t1'] },
        { id: 'ex_p2', name: 'Bunny plush', price: 28, stock: 6, hours: 2.5, materials: [{ materialId: 'ex_m2', amount: 90 }, { materialId: 'ex_m3', amount: 1 }, { materialId: 'ex_m4', amount: 60 }], tagIds: ['ex_t1'] },
        { id: 'ex_p3', name: 'Market tote', price: 35, stock: 4, hours: 4, materials: [{ materialId: 'ex_m1', amount: 220 }], tagIds: ['ex_t2'] },
        { id: 'ex_p4', name: 'Bee keychain', price: 8, stock: 20, hours: .5, materials: [{ materialId: 'ex_m2', amount: 8 }, { materialId: 'ex_m4', amount: 4 }], tagIds: ['ex_t1'] }];
    d.markets = [
        { id: 'ex_k1', name: 'Example holiday market', days: [{ date: day(21), start: '10:00', end: '16:00' }], location: 'Your town', cost: 75, target: 600, items: { ex_p1: 8, ex_p2: 4, ex_p4: 12 }, todos: [{ id: 'ex_td1', text: 'Print price tags', done: true }, { id: 'ex_td2', text: 'Pack table cloth and stands', done: false }, { id: 'ex_td3', text: 'Charge card reader', done: false }] },
        { id: 'ex_k0', name: 'Example fall market', days: [{ date: day(-20) }], location: 'Your town', cost: 60, items: {}, todos: [], completed: true, completedAt: day(-20) + 'T22:00:00.000Z' }];
    let at = day(-20) + 'T15:00:00.000Z', sale = (pid, qty, cost) => { let p = d.products.find(x => x.id === pid); return { id: 'ex_s_' + pid, orderId: 'ex_o_' + pid, marketId: 'ex_k0', productId: pid, qty, listPrice: p.price, price: p.price, disc: 0, tax: 0, taxed: false, taxRate: 0, date: at, estimatedMaterialCost: cost }; };
    d.sales = [sale('ex_p1', 9, 2.4), sale('ex_p2', 3, 3.1), sale('ex_p4', 14, .9), sale('ex_p3', 2, 7.7)];
    // One example sale paid by Tap to Pay, so the card fees show in Reports
    d.orders = d.sales.map(s => {
        let total = round2(s.qty * s.price), card = s.productId === 'ex_p2';
        return { id: s.orderId, marketId: 'ex_k0', date: at, full: total, subtotal: total, discount: null, tax: 0, total, payment: card ? { method: 'card', via: 'stripe', stripeFee: round2(total * .027 + .05), appFee: round2(total * .01), cardBrand: 'visa', cardLast4: '4242', test: true } : { method: 'cash' } };
    });
    d.reminders = [{ id: 'ex_r1', kind: 'product', refId: 'ex_p2', done: false, created: day(-5) }, { id: 'ex_r2', kind: 'material', refId: 'ex_m2', done: false, created: day(-4) }, { id: 'ex_r3', kind: 'note', text: 'Restock gift bags', done: false, created: day(-3) }];
    return d;
}
function tutUseExamples() {
    if (tutReal || !tutNeedsExamples())
        return;
    tutReal = data;
    data = tutExampleData();
    render();
}
function tutRestoreData() {
    if (!tutReal)
        return;
    tutClearSale();
    data = tutReal;
    tutReal = null;
}
// While examples are showing, saving does nothing, so they never reach the phone or the cloud
const tutFlushSave = flushSave;
flushSave = function () {
    if (tutReal) {
        clearTimeout(saveTimer);
        saveTimer = null;
        return Promise.resolve();
    }
    return tutFlushSave();
};

// ===== Progress =====
function tutDone() {
    return lsGet('csTutDone', {}) || {};
}
function markTutDone(lid) {
    let d = tutDone();
    d[lid] = true;
    lsSet('csTutDone', d);
}
async function resetTutorials() {
    if (!await appConfirm('Start the lessons over? Your check marks will be cleared.', { ok: 'Start over' }))
        return;
    lsSet('csTutDone', {});
    render();
}

// ===== Tutorials screen (Settings › Tutorials) =====
function tutChip(text, kind) {
    return `<span class="tut-chip ${kind}">${kind === 'pro' ? ic('crown', 12) : ''}${esc(text)}</span>`;
}
function tutorials() {
    let done = tutDone(), pro = tutIsPro(), n = LESSONS.filter(l => done[l.id]).length;
    let rows = LESSONS.map(l => `<button class="menu-row" onclick="startLesson('${l.id}','hub')"><span class="tic ${l.tic}">${ic(l.icon, 18)}</span><span class="grow"><b>${esc(l.title)}${l.pro && !pro ? tutChip('Pro', 'pro') : ''}</b><span class="muted">${esc(l.sub)} · ${l.steps.length} steps</span></span>${done[l.id] ? `<span class="tut-done" aria-label="Done">${ic('check', 16)}</span>` : '<span class="chev" aria-hidden="true">›</span>'}</button>`).join('');
    return `${navStack.length ? backBtn() : ''}<h2 style="margin-top:12px">Tutorials</h2>
<p class="muted" style="margin:-6px 2px 14px">Pick any page to learn it. Each lesson takes about a minute, and you can replay them any time from here or the ${ic('help', 14)} button at the top.</p>
<div class="panel"><div class="row"><span class="eyebrow">Your progress</span><span class="muted">${n} of ${LESSONS.length} done</span></div><div class="bar" style="margin-top:10px"><div style="width:${Math.round(n / LESSONS.length * 100)}%"></div></div>
<div class="actions"><button onclick="startTour()">${n ? 'Continue the full tour' : 'Take the full tour'}</button>${n ? '<button class="alt" onclick="resetTutorials()">Start over</button>' : ''}</div></div>
<div class="panel menu">${rows}</div>
${pro ? '' : `<p class="hint" style="margin:0 6px 14px">${tutChip('Pro', 'pro')} marks features in Pro. You can still go through every lesson to see what’s included.</p>`}
<div class="panel tut-demo"><div class="eyebrow">Test version only</div><p class="muted" style="margin:6px 0 10px">See the tutorials as a Free or a Pro user would. (Everyone has every feature while testing.)</p><div class="tut-seg"><button class="${pro ? 'alt' : ''}" onclick="setTutPreview('free')">Free user</button><button class="${pro ? '' : 'alt'}" onclick="setTutPreview('pro')">Pro user</button></div></div>`;
}

// ===== Running a lesson =====
let tut = null; // { lesson, i, from, back, queue }
// Spotlight position: what's drawn now, and the move in progress between steps
let tutDrawn = null, tutAnim = null;
const TUT_GLIDE = 480, TUT_CLOSE = 220, TUT_OPEN = 320;
function lessonFor(scr) {
    const alias = { marketDetail: 'markets', marketInfo: 'markets', marketForm: 'markets', saleReview: 'markets', productForm: 'products', productDetail: 'products', materialForm: 'materials', expenseForm: 'receipts', receiptDetail: 'receipts' };
    return LESSONS.find(l => l.page === scr) || LESSONS.find(l => l.id === alias[scr]) || null;
}
// ? button in the header: replay this page's lesson, or open the list if this page has none
function tutHelp() {
    if (tut)
        return;
    let l = lessonFor(screen);
    if (l && screen !== 'tutorials')
        startLesson(l.id, 'page');
    else if (screen !== 'tutorials')
        go('tutorials');
}
function startTour() {
    let done = tutDone(), queue = LESSONS.filter(l => !done[l.id]).map(l => l.id);
    if (!queue.length)
        queue = LESSONS.map(l => l.id);
    startLesson(queue.shift(), 'hub', queue);
}
function startLesson(lid, from, queue) {
    let lesson = LESSONS.find(l => l.id === lid);
    if (!lesson)
        return;
    closeOverlays();
    let back = tut?.back ?? screen;
    tut = { lesson, i: 0, from, back, queue: queue || [], runKey: '' };
    tutUseExamples();
    tutBuild();
    tutShow();
}
function tutBuild() {
    if ($('tutLayer'))
        return;
    tutDrawn = null;
    tutAnim = null;
    document.body.insertAdjacentHTML('beforeend', `<div id="tutLayer" aria-live="polite"><div id="tutBlock"></div><div id="tutHole"></div><div id="tutTip" class="fading" role="dialog" aria-modal="true" aria-labelledby="tutTitle"></div></div>`);
    $('tutBlock').onclick = e => e.stopPropagation();
    requestAnimationFrame(tutLoop);
}
// The screen setup a step needs: its own, or the last one before it in the lesson
function tutRunIndex(lesson, i) {
    for (let j = i; j >= 0; j--)
        if (lesson.steps[j].run)
            return j;
    return -1;
}
// Waits until the step's target has stopped moving (page drawn, scroll restored), up to about a second
function tutSettle() {
    return new Promise(res => {
        let last = '', same = 0, n = 0;
        (function f() {
            let t = tutTarget(), r = t ? tutRect(t) : null, key = r ? [r.top, r.left, r.width, r.height].map(Math.round).join() : '';
            same = key === last ? same + 1 : 0;
            last = key;
            if (same >= (key ? 3 : 1) || ++n > 60)
                return res();
            requestAnimationFrame(f);
        })();
    });
}
const tutStale = (t0, i) => tut !== t0 || tut.i !== i;
const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
// Where the page should scroll so the target sits comfortably above the card
function tutScrollFor(t) {
    if (!t)
        return scrollY;
    let first = Array.isArray(t) ? t[0] : t;
    for (let e = first; e && e !== document.body; e = e.parentElement)
        if (getComputedStyle(e).position === 'fixed')
            return scrollY;
    let r = tutRect(t), vh = innerHeight;
    if (r.top >= 90 && r.bottom <= vh - 240)
        return scrollY;
    let y = scrollY + r.top - Math.max(90, Math.min((vh - r.height) / 3, vh - 240 - r.height));
    return Math.round(Math.max(0, Math.min(document.documentElement.scrollHeight - vh, y)));
}
// Runs one spotlight move. to: a fixed spot, or null to follow the step's target.
// scroll: scrolls the page in step with the move, so the target and spotlight arrive together.
function tutAnimate(o) {
    return new Promise(res => { tutAnim = { ...o, start: performance.now(), res }; });
}
async function tutShow() {
    let t0 = tut, { lesson, i } = tut, s = lesson.steps[i], pro = tutIsPro();
    let tip = $('tutTip'), wasShowing = tut.ready && !tip.classList.contains('fading');
    let runIdx = tutRunIndex(lesson, i), runKey = lesson.id + ':' + runIdx;
    // A new screen (or a big layout change) closes the spotlight first and opens it again on the new screen.
    // Steps on the same screen glide from one spot to the next.
    let newScreen = !tutDrawn || tut.runKey !== runKey;
    tut.ready = false;
    tip.classList.add('fading');
    let d = tutDrawn;
    if (wasShowing)
        await tw(180);
    if (newScreen && d && d.w > 4)
        await tutAnimate({ from: d, to: { x: d.x + d.w / 2, y: d.y + d.h / 2, w: 0, h: 0, r: 0 }, dur: TUT_CLOSE });
    if (tutStale(t0, i))
        return;
    let run = lesson.steps[runIdx]?.run;
    if (run && newScreen) {
        try { await run(); } catch (e) { console.warn(e); }
    }
    tut.runKey = runKey;
    await tutSettle();
    if (tutStale(t0, i))
        return;
    let endY = tutScrollFor(tutTarget());
    if (newScreen) {
        if (endY !== scrollY) {
            scrollTo({ top: endY, behavior: 'instant' });
            await nextFrame();
        }
        let g = tutGoal(), from = g ? { x: g.x + g.w / 2, y: g.y + g.h / 2, w: 0, h: 0, r: 0 } : (tutDrawn || tutCenter());
        await tutAnimate({ from, to: null, dur: TUT_OPEN });
    }
    else
        await tutAnimate({ from: tutDrawn, to: null, dur: TUT_GLIDE, scroll: endY !== Math.round(scrollY) ? { from: scrollY, to: endY } : null });
    if (tutStale(t0, i))
        return;
    let locked = s.pro && !pro, last = i === lesson.steps.length - 1, next = last && tut.queue.length ? LESSONS.find(l => l.id === tut.queue[0]) : null;
    tip.className = 'fading' + (locked ? ' locked' : '');
    tip.innerHTML = `${locked ? `<div class="tut-prostrip">${ic('crown', 15)}<span class="grow">Pro feature</span><button class="linkbtn" onclick="tutPlans()">See plans</button></div>` : ''}<div class="tut-body">
<div class="row"><span class="eyebrow">${esc(lesson.title)}</span><span class="muted tut-count">${i + 1} of ${lesson.steps.length}</span></div>${tutReal ? `<div class="tut-example">${ic('star', 12)}Example items · your own data comes back when you exit</div>` : ''}
<div class="bar tut-bar"><div style="width:${Math.round((i + 1) / lesson.steps.length * 100)}%"></div></div>
<h3 id="tutTitle">${esc(s.title)}</h3><p>${esc(s.body)}</p>
${s.limit && !pro ? `<div class="tut-limit">${esc(s.limit)}</div>` : ''}
<div class="row tut-btns"><span class="row" style="gap:14px;justify-content:flex-start"><button class="linkbtn" onclick="tutExit()">Exit</button>${i === 0 && tut.from !== 'hub' ? '<button class="linkbtn" onclick="tutAllLessons()">All lessons</button>' : ''}</span><span class="row" style="gap:8px">${i ? '<button class="alt small" onclick="tutStep(-1)">Back</button>' : ''}<button class="small" onclick="tutStep(1)">${last ? (next ? 'Next: ' + esc(next.title) : 'Done') : 'Next'}</button></span></div></div>`;
    tut.ready = true;
}
function tutTarget() {
    let s = tut?.lesson.steps[tut.i];
    if (!s?.el)
        return null;
    try {
        let t = s.el();
        if (Array.isArray(t))
            t = t.flat().filter(shown);
        return Array.isArray(t) ? (t.length ? t : null) : (shown(t) ? t : null);
    }
    catch {
        return null;
    }
}
function tutRect(t) {
    let rs = (Array.isArray(t) ? t : [t]).map(e => e.getBoundingClientRect());
    let top = Math.min(...rs.map(r => r.top)), left = Math.min(...rs.map(r => r.left)), bottom = Math.max(...rs.map(r => r.bottom)), right = Math.max(...rs.map(r => r.right));
    return { top, left, bottom, right, width: right - left, height: bottom - top };
}
const tutCenter = () => ({ x: innerWidth / 2, y: innerHeight / 2, w: 0, h: 0, r: 0 });
// The spotlight's spot around the current target, or null when the step has nothing to point at
function tutGoal() {
    let t = tutTarget();
    if (!t)
        return null;
    let r = tutRect(t), vw = innerWidth, pad = 8, top = Math.max(4, r.top - pad), left = Math.max(4, r.left - pad);
    return { x: left, y: top, w: Math.min(vw - 8, r.right + pad) - left, h: r.bottom + pad - top, r: 18 };
}
const easeInOut = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
// Every frame: draw the spotlight. While a move runs it eases there (all four sides together, so it travels
// on a straight line); otherwise it sits exactly on its target so scrolling never lags.
function tutLoop() {
    if (!tut || !$('tutLayer'))
        return;
    let hole = $('tutHole'), tip = $('tutTip'), vw = innerWidth, vh = innerHeight, cur;
    if (tutAnim) {
        let a = tutAnim, p = Math.min(1, (performance.now() - a.start) / a.dur);
        if (matchMedia('(prefers-reduced-motion: reduce)').matches)
            p = 1;
        let k = easeInOut(p);
        if (a.scroll)
            scrollTo({ top: a.scroll.from + (a.scroll.to - a.scroll.from) * k, behavior: 'instant' });
        let goal = a.to || tutGoal() || tutCenter(), f = a.from || goal, mix = (x, y) => x + (y - x) * k;
        cur = { x: mix(f.x, goal.x), y: mix(f.y, goal.y), w: mix(f.w, goal.w), h: mix(f.h, goal.h), r: mix(f.r, goal.r) };
        if (p >= 1) {
            tutAnim = null;
            a.res();
        }
    }
    else if (!tut.ready)
        cur = tutDrawn || tutCenter();
    else
        cur = tutGoal() || tutCenter();
    tutDrawn = cur;
    hole.style.transform = `translate(${cur.x}px,${cur.y}px)`;
    hole.style.width = cur.w + 'px';
    hole.style.height = cur.h + 'px';
    hole.style.borderRadius = cur.r + 'px';
    $('tutLayer').classList.toggle('center', cur.w < 4);
    // The card appears once the spotlight has arrived, beside it
    let tw2 = Math.min(360, vw - 24), th = tip.offsetHeight || 200;
    tip.style.width = tw2 + 'px';
    if (tut.ready && !tutAnim) {
        let ty, tx;
        if (cur.w >= 4) {
            let below = vh - (cur.y + cur.h) - 12, above = cur.y - 12;
            ty = below >= th ? cur.y + cur.h + 12 : above >= th ? cur.y - th - 12 : vh - th - 12;
            tx = cur.x + cur.w / 2 - tw2 / 2;
        }
        else {
            ty = (vh - th) / 2;
            tx = (vw - tw2) / 2;
        }
        ty = Math.max(8, Math.min(vh - th - 8, ty));
        tx = Math.max(12, Math.min(vw - tw2 - 12, tx));
        tip.style.transform = `translate(${tx}px,${ty}px)`;
        if (tip.classList.contains('fading')) {
            tip.classList.remove('fading');
            tip.querySelector('.tut-btns button:last-child')?.focus({ preventScroll: true });
        }
    }
    requestAnimationFrame(tutLoop);
}
function tutStep(d) {
    if (!tut || !tut.ready)
        return;
    let n = tut.i + d;
    if (n < 0)
        return;
    if (n >= tut.lesson.steps.length) {
        markTutDone(tut.lesson.id);
        try { tut.lesson.done?.(); } catch { }
        let q = tut.queue;
        if (q.length)
            return startLesson(q.shift(), tut.from, q);
        let name = tut.lesson.title;
        tutEnd();
        toast(`${name} lesson done.`);
        return;
    }
    tut.i = n;
    tutShow();
}
// Exit: back to where the lesson started (the Tutorials list, or the page the ? was tapped on)
function tutExit() {
    tutEnd();
}
// All lessons: leave this lesson and open the Tutorials list
function tutAllLessons() {
    tutEnd();
    if (screen !== 'tutorials')
        setTimeout(() => go('tutorials'), 200);
}
// Leave the lesson: back to the Tutorials list, or the page the ? was tapped on
function tutEnd() {
    let t = tut;
    tut = null;
    $('tutLayer')?.remove();
    if (!t)
        return;
    try { t.lesson.done?.(); } catch { }
    tutRestoreData();
    if (t.from === 'hub') {
        // view() rewinds browser history in the background; wait for that before opening the list again
        view('settings');
        setTimeout(() => go('tutorials'), 200);
    }
    else if (TABS.includes(t.back))
        view(t.back);
    else
        view(activeTab() || 'home');
}
// See plans: leave the lesson and open the Plans screen (js/plans.js); Back returns to where the lesson started
function tutPlans() {
    let t = tut;
    if (!t)
        return go('plans');
    tut = null;
    $('tutLayer')?.remove();
    try { t.lesson.done?.(); } catch { }
    tutRestoreData();
    view(t.from === 'hub' ? 'settings' : (TABS.includes(t.back) ? t.back : (activeTab() || 'home')));
    setTimeout(() => go('plans'), 200);
}
addEventListener('keydown', e => {
    if (!tut)
        return;
    if (e.key === 'Escape')
        tutExit();
    else if (e.key === 'ArrowRight')
        tutStep(1);
    else if (e.key === 'ArrowLeft')
        tutStep(-1);
});

// ===== First open: offer the tutorial once =====
function tutWelcome() {
    if (lsGet('csTutOffered', false) || $('tutWelcome'))
        return;
    lsSet('csTutOffered', true);
    document.body.insertAdjacentHTML('beforeend', `<div class="modal dialog" id="tutWelcome"><div class="modal-card dialog-card panel tut-welcome"><span class="tic lav tut-wicon">${ic('help', 26)}</span><h2>New here?</h2><p class="muted">Take a quick tour of each page. It’s optional, and you can skip any lesson or come back to it later.</p><div class="actions" style="flex-direction:column"><button onclick="$('tutWelcome').remove();startTour()">Show me around</button><button class="alt" onclick="$('tutWelcome').remove();go('tutorials')">Pick a page to learn</button><button class="linkbtn" onclick="$('tutWelcome').remove()">Not now</button></div><p class="hint" style="text-align:center">Find tutorials any time in Settings or the ${ic('help', 13)} button.</p></div></div>`);
}

// Offer it the first time Home shows (after any sign-in screens), once the app has loaded
const tutRenderBase = render;
render = function () {
    let r = tutRenderBase.apply(this, arguments);
    if (screen === 'home' && dataLoaded && !tut && !lsGet('csTutOffered', false) && !setupNeeded())
        setTimeout(() => { if (screen === 'home' && !tut && !$('modal') && !$('appDialog')) tutWelcome(); }, 900);
    return r;
};

// ===== ? button in the header =====
(function addHelpButton() {
    let bar = document.querySelector('header .hdrbtns');
    if (!bar || $('tutBtn'))
        return;
    bar.insertAdjacentHTML('afterbegin', `<button class="iconbtn" id="tutBtn" aria-label="Help for this page" onclick="tutHelp()">${ic('help', 22)}</button>`);
    // Shrink the app name until it fits beside the three buttons, whatever font or phone width
    function fitBrand() {
        let b = document.querySelector('header .brand');
        if (!b || !b.clientWidth)
            return;
        b.style.fontSize = '';
        let size = parseFloat(getComputedStyle(b).fontSize);
        while (b.scrollWidth > b.clientWidth + 1 && size > 15) {
            size -= 1;
            b.style.fontSize = size + 'px';
        }
    }
    fitBrand();
    addEventListener('resize', fitBrand);
    document.fonts?.ready.then(fitBrand);
    document.fonts?.addEventListener?.('loadingdone', fitBrand);
    setTimeout(fitBrand, 1500);
})();
