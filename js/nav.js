// Moving between screens: bottom menu, back button, drawing the current screen
// Part of the Crochet Studio app. Files load in the order listed in index.html.

const navItems = [['home', 'home', 'Home'], ['products', 'products', 'Products'], ['materials', 'materials', 'Materials'], ['patterns', 'patterns', 'Patterns'], ['markets', 'markets', 'Markets'], ['reports', 'reports', 'Reports']];
function render() {
    if (loadFailed) {
        // Saved data couldn't be opened: say so plainly instead of showing an empty app (nothing is saved meanwhile)
        $('nav').innerHTML = '';
        if (loadFailed === 'storage') {
            $('app').innerHTML = `<div class="panel" style="margin-top:16px"><h2>This browser won’t let the app save</h2><p>Crochet Studio keeps your work on this device, but the browser is blocking it, so nothing you add would be kept.</p><ol class="steps"><li>Turn off private or incognito browsing.</li><li>Or allow this site to store data (browser settings › Site settings › Cookies and site data).</li><li>Then open Crochet Studio again.</li></ol><div class="actions"><button class="grow" onclick="location.reload()">Try again</button></div></div>`;
            return;
        }
        $('app').innerHTML = `<div class="panel" style="margin-top:16px"><h2>Your data couldn’t be opened</h2><p>The app couldn’t read what’s saved on this device. Nothing has been changed or deleted, and nothing will be saved until it opens properly.</p><ol class="steps"><li>Tap <b>Try again</b>.</li><li>Still stuck? Close the app fully (swipe it away) and open it again.</li><li>If it keeps happening, tap <b>Send feedback</b> so we can help.</li></ol><div class="actions"><button class="grow" onclick="location.reload()">Try again</button><button class="alt grow" onclick="location.href='mailto:support@themakersnook.ca?subject=' + encodeURIComponent('Crochet Studio: data could not be opened')">Send feedback</button></div></div>`;
        return;
    }
    let nav = $('nav');
    let at = activeTab();
    nav.innerHTML = navItems.map(([s, i, n]) => `<button class="${at === s ? 'active' : ''}" ${at === s ? 'aria-current="page"' : ''} onclick="view('${s}')">${ic(i)}${n}</button>`).join('');
    let a = $('app');
    a.innerHTML = (notice ? `<div id="notice" class="notice">${esc(notice)}</div>` : '') + ({ home: home, products: products, materials: materials, patterns: patterns, markets: markets, reports: reports, settings: settings, reminders: reminders, settingsFinances: settingsFinances, expenseForm: expenseForm, receipts: receipts, receiptDetail: receiptDetail, yearEnd: yearEndScreen, productForm: productForm, productDetail: productDetail, materialForm: materialForm, marketForm: marketForm, marketDetail: marketDetail, marketInfo: marketInfo, marketTodo: marketTodo, settingsPricing: settingsPricing, settingsBackup: settingsBackup, settingsAccount: settingsAccount, settingsTax: settingsTax, settingsPayments: settingsPayments, settingsImport: settingsImport, settingsRegion: settingsRegion, settingsGuides: settingsGuides, tutorials: tutorials, plans: plans, setupGuide: setupGuide, setupDoneScreen: setupDoneScreen, reportDownload: reportDownload, tagAdd: tagAdd, importReview: importReview, importDone: importDone, settingsFeedback: settingsFeedback, quickSale: quickSale, saleReview: saleReview, marketSales: marketSales, saleEdit: saleEdit, authWelcome: authWelcome, authSignup: authSignup, authSignin: authSignin, authForgot: authForgot, authVerify: authVerify, authNewPassword: authNewPassword, authSetup: authSetup, authSync: authSync, authLinkDone: authLinkDone }[screen] || home)();
    updateReminderBadge();
}
// ===== Navigation: back returns to wherever you came from =====
// skipPop: view() is rewinding browser history; pendingPushes: screens opened before that rewind finished
let navStack = [], skipPop = false, pendingPushes = 0, appBack = false; // appBack: the app itself stepped back (not the back button)
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
    // If view() is still rewinding history, add this entry once the rewind lands (else the rewind overshoots and leaves the app)
    if (skipPop)
        pendingPushes++;
    else
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
    // Still rewinding from view(): this screen was never added to the browser history, so step back here directly
    if (skipPop && pendingPushes > 0) {
        pendingPushes--;
        return restoreNav(navStack.pop());
    }
    appBack = true;
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
    // Leaving Materials or Products folds their open groups back up
    if (s !== screen || s !== 'materials')
        matGroupOpen.clear();
    if (s !== screen || s !== 'products')
        productFolderOpen.clear();
    if (navStack.length) {
        // Only rewind the entries really in the browser history (not ones still waiting for an earlier rewind)
        let n = navStack.length - pendingPushes;
        navStack = [];
        pendingPushes = 0;
        if (n > 0 && !skipPop) {
            skipPop = true;
            try {
                history.go(-n);
            }
            catch {
                skipPop = false;
            }
        }
    }
    screen = s;
    editing = null;
    selected = null;
    if (s !== 'products')
        productSelectMode = false;
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
    return ({ home: 'Home', products: 'Products', materials: 'Materials', patterns: 'Patterns', markets: 'Markets', reports: 'Reports', settings: 'Settings', marketInfo: 'Market details', marketTodo: 'To-do list', productForm: 'Product', materialForm: 'Material', marketForm: 'New market', reminders: 'Reminders', settingsFinances: 'Finances', expenseForm: 'Receipt', receipts: 'Receipts', receiptDetail: 'Receipt', yearEnd: 'Year-end receipts', settingsPricing: 'Pricing defaults', settingsBackup: 'Backup', settingsAccount: 'Account', settingsTax: 'Tax', settingsPayments: 'Payments', settingsImport: 'Import', settingsRegion: 'Country & currency', settingsGuides: 'What’s new', tutorials: 'Tutorials', plans: 'Plans', setupGuide: 'Setup guide', reportDownload: 'Download', tagAdd: 'Add products', importReview: 'Check import', importDone: 'Import', settingsFeedback: 'Feedback', quickSale: 'Quick sale', saleReview: 'Review sale', marketSales: 'Sales', saleEdit: 'Sale' })[st.screen] || 'Back';
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
