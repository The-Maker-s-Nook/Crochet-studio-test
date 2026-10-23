// Moving between screens: bottom menu, back button, drawing the current screen
// Part of the Crochet Studio app. Files load in the order listed in index.html.

const navItems = [['home', 'home', 'Home'], ['products', 'products', 'Products'], ['materials', 'materials', 'Materials'], ['patterns', 'patterns', 'Patterns'], ['markets', 'markets', 'Markets'], ['reports', 'reports', 'Reports']];
function render() {
    let nav = $('nav');
    let at = activeTab();
    nav.innerHTML = navItems.map(([s, i, n]) => `<button class="${at === s ? 'active' : ''}" ${at === s ? 'aria-current="page"' : ''} onclick="view('${s}')">${ic(i)}${n}</button>`).join('');
    let a = $('app');
    a.innerHTML = (notice ? `<div id="notice" class="notice">${esc(notice)}</div>` : '') + ({ home: home, products: products, materials: materials, patterns: patterns, markets: markets, reports: reports, settings: settings, reminders: reminders, settingsFinances: settingsFinances, expenseForm: expenseForm, productForm: productForm, productDetail: productDetail, materialForm: materialForm, marketForm: marketForm, marketDetail: marketDetail, marketInfo: marketInfo, marketTodo: marketTodo, settingsPricing: settingsPricing, settingsBackup: settingsBackup, settingsAccount: settingsAccount, settingsTax: settingsTax, settingsPayments: settingsPayments, settingsImport: settingsImport, settingsRegion: settingsRegion, settingsGuides: settingsGuides, reportDownload: reportDownload, tagAdd: tagAdd, importReview: importReview, importDone: importDone, settingsFeedback: settingsFeedback, quickSale: quickSale, saleReview: saleReview, marketSales: marketSales, saleEdit: saleEdit, authWelcome: authWelcome, authSignup: authSignup, authSignin: authSignin, authForgot: authForgot, authVerify: authVerify, authNewPassword: authNewPassword, authSetup: authSetup, authSync: authSync, authLinkDone: authLinkDone }[screen] || home)();
    updateReminderBadge();
}
// ===== Navigation: back returns to wherever you came from =====
let navStack = [], skipPop = false;
const TABS = ['home', 'products', 'materials', 'patterns', 'markets', 'reports'];
function snap() {
    return { screen, selected, marketSelected, editing, scroll: scrollY };
}
function closeOverlays() {
    dlgDone?.(false);
    closeModal();
    closeQuickMaterial();
}
function go(s, setup) {
    closeOverlays();
    navStack.push(snap());
    try {
        history.pushState({ cs: navStack.length }, '');
    }
    catch {
    }
    setup?.();
    screen = s;
    render();
    scrollTo(0, 0);
}
function goBack() {
    if (!navStack.length)
        return view('home');
    history.back();
}
function restoreNav(st) {
    closeOverlays();
    screen = st.screen;
    selected = st.selected;
    marketSelected = st.marketSelected;
    editing = st.editing;
    marketSaleMode = false;
    marketSaleDraft = {};
    marketAddOpen = false;
    render();
    requestAnimationFrame(() => scrollTo(0, st.scroll || 0));
}
function view(s) {
    closeOverlays();
    if (navStack.length) {
        let n = navStack.length;
        navStack = [];
        skipPop = true;
        try {
            history.go(-n);
        }
        catch {
            skipPop = false;
        }
    }
    screen = s;
    editing = null;
    selected = null;
    render();
    scrollTo(0, 0);
}
function activeTab() {
    return TABS.includes(screen) ? screen : (navStack[0]?.screen || '');
}
function backLabel() {
    let st = navStack[navStack.length - 1];
    if (!st)
        return 'Home';
    if (st.screen === 'productDetail')
        return product(st.selected)?.name || 'Product';
    if (st.screen === 'marketDetail')
        return data.markets.find(m => m.id === st.marketSelected)?.name || 'Market';
    return ({ home: 'Home', products: 'Products', materials: 'Materials', patterns: 'Patterns', markets: 'Markets', reports: 'Reports', settings: 'Settings', marketInfo: 'Market details', marketTodo: 'To-do list', productForm: 'Product', materialForm: 'Material', marketForm: 'New market', reminders: 'Reminders', settingsFinances: 'Finances', expenseForm: 'Expense', settingsPricing: 'Pricing defaults', settingsBackup: 'Backup', settingsAccount: 'Account', settingsTax: 'Tax', settingsPayments: 'Payments', settingsImport: 'Import', settingsRegion: 'Country & currency', settingsGuides: 'What’s new', reportDownload: 'Download', tagAdd: 'Add products', importReview: 'Check import', importDone: 'Import', settingsFeedback: 'Feedback', quickSale: 'Quick sale', saleReview: 'Review sale', marketSales: 'Sales', saleEdit: 'Sale' })[st.screen] || 'Back';
}
function backBtn() {
    return `<button class="alt small" onclick="goBack()">← ${esc(backLabel())}</button>`;
}
function detail(pid) {
    go('productDetail', () => {
        selected = pid;
    });
}
function openMarket(mid, replace) {
    const setup = () => {
        marketSelected = mid;
        mktSearch = '';
        if (saleKind === 'quick') {
            marketSaleMode = false;
            saleKind = 'market';
        }
        marketSaleMode = false;
        marketSaleDraft = {};
        marketAddOpen = false;
        marketAddSearch = '';
        marketAddQty = {};
    };
    if (replace) {
        setup();
        screen = 'marketDetail';
        render();
        scrollTo(0, 0);
    }
    else
        go('marketDetail', setup);
}
function newMarket() {
    go('marketForm', () => {
        editing = null;
    });
}
function openTodo(mid) {
    go('marketTodo', () => {
        marketSelected = mid;
    });
}
function brandHome() {
    if (String(screen).startsWith('auth') || !dataLoaded)
        return;
    view('home');
}
