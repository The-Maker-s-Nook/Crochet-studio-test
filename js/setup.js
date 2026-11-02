// First-time setup: a short, skippable survey before the tutorial (name and business, country, craft, pricing, stock, tax).
// Part of the Crochet Studio app. Files load in the order listed in index.html.
// Who sees it: a brand-new app with no data (no account), or a brand-new account right after sign-up with nothing in it.
// People who already have data (testers, anyone signing in to an existing account, a restored backup) never see it:
// their setup is marked done automatically. Settings › Setup guide reopens it with the current settings filled in;
// nothing changes unless they tap Finish.

let setupStep = 0, setupDraft = null, setupRerun = false;
const SETUP_STEPS = ['you', 'region', 'craft', 'pricing', 'stock', 'tax'];
const FIBRE_CATS = [['Yarn', 'grams', 'skein'], ['Eyes', 'pairs', 'pack'], ['Stuffing', 'grams', 'bag'], ['Other', 'pieces', 'pack']];

const hasOwnData = () => !!(data.products.length || data.materials.length || data.markets.length || data.sales.length || (data.expenses || []).length);
// True when the setup survey should be offered now
function setupNeeded() {
    let s = data.settings;
    if (s.setupDone)
        return false;
    if (hasOwnData()) {
        // Existing users (testers, restored backups, accounts with data): never ask, and remember that
        s.setupDone = true;
        save();
        return false;
    }
    // Signed in: only for a brand-new account just made on this phone (sign-up flow), never while an existing account's data is still arriving
    if (signedIn())
        return !!lsGet('csSetupPending', false);
    return true;
}
// A brand-new account: offer the survey after the "You're in" screen
const setupFinishSignupBase = finishSetup;
finishSetup = async function (mode) {
    let r = await setupFinishSignupBase.apply(this, arguments);
    if (signedIn() && !hasOwnData())
        lsSet('csSetupPending', true);
    return r;
};

function setupDraftFrom(s) {
    return { userName: s.userName || '', businessName: s.businessName || '', currency: s.currency || guessCurrency(), craft: 'fibre', hourly: s.hourly, method: s.method || 'labour', multiplier: s.multiplier, markup: s.markup, rounding: s.rounding || 'nearest', materialStock: s.materialStock || 'auto', taxRate: s.taxRate === null || s.taxRate === undefined ? '' : s.taxRate, productTax: s.productTax || 'add', materialTax: s.materialTax || 'includes', notClaimingTax: !!s.notClaimingTax };
}
function openSetupGuide(rerun) {
    setupRerun = !!rerun;
    setupStep = 0;
    setupDraft = setupDraftFrom(data.settings);
    if (rerun)
        go('setupGuide');
    else {
        navStack = [];
        view('setupGuide');
    }
}
// Keep what's typed on the current step before moving or redrawing
function setupKeep() {
    let d = setupDraft, v = id => $(id)?.value;
    if (!d)
        return;
    if ($('suName'))
        d.userName = normName(v('suName'));
    if ($('suBiz'))
        d.businessName = normName(v('suBiz'));
    if ($('suHourly'))
        d.hourly = num(v('suHourly'));
    if ($('suMult'))
        d.multiplier = num(v('suMult'));
    if ($('suMarkup'))
        d.markup = num(v('suMarkup'));
    if ($('suRate'))
        d.taxRate = v('suRate').trim();
    if ($('suNotClaim'))
        d.notClaimingTax = $('suNotClaim').checked;
}
function setupPick(key, val) {
    setupKeep();
    setupDraft[key] = val;
    render();
}
function setupNav(d) {
    setupKeep();
    if (d > 0 && SETUP_STEPS[setupStep] === 'tax' && setupDraft.taxRate !== '' && !(Number(setupDraft.taxRate) >= 0 && Number(setupDraft.taxRate) <= 100))
        return needField('suRate', 'Enter your sales tax rate between 0 and 100, or leave it empty for now.');
    setupStep += d;
    if (setupStep < 0)
        setupStep = 0;
    if (setupStep >= SETUP_STEPS.length)
        return setupFinish();
    render();
    scrollTo(0, 0);
}
// Write the choices into the settings (first run and Finish)
function setupApply() {
    let d = setupDraft, s = data.settings;
    Object.assign(s, { userName: d.userName, businessName: d.businessName, currency: d.currency, hourly: num(d.hourly), method: d.method, multiplier: num(d.multiplier), markup: num(d.markup), rounding: d.rounding, materialStock: d.materialStock, productTax: d.productTax, materialTax: d.materialTax, notClaimingTax: d.notClaimingTax });
    if (d.taxRate !== '')
        s.taxRate = Number(d.taxRate);
    // Starting categories only for an app with no materials yet; existing categories are never touched
    if (d.craft === 'none' && !data.materials.length)
        data.materialCategories = data.materialCategories.filter(c => c.id === 'cat_other');
}
function setupFinish() {
    setupApply();
    setupDone();
    if (setupRerun) {
        goBack();
        toast('Settings saved.');
        return;
    }
    navStack = [];
    view('setupDoneScreen');
}
function setupDone() {
    data.settings.setupDone = true;
    lsSet('csSetupPending', false);
    save();
}
// Skip: on first run keep what's been filled in so far; when re-running from Settings, change nothing
async function setupSkip() {
    if (setupRerun) {
        setupDraft = null;
        return goBack();
    }
    setupKeep();
    setupApply();
    setupDone();
    navStack = [];
    view('home');
}

// ---------- Screens ----------
function setupOpt(key, val, title, sub, extra = '') {
    let on = setupDraft[key] === val;
    return `<button class="setopt ${on ? 'on' : ''}" aria-pressed="${on}" onclick="setupPick('${key}','${val}')"><span class="setradio"></span><span class="grow"><b>${esc(title)}</b>${sub ? `<span class="muted">${esc(sub)}</span>` : ''}${extra}</span></button>`;
}
function setupHead(title, sub) {
    let n = SETUP_STEPS.length, i = setupStep + 1;
    return `<div class="setuphead"><div class="row"><span class="eyebrow">Step ${i} of ${n}</span><button class="linkbtn" onclick="setupSkip()">${setupRerun ? 'Close' : 'Skip setup'}</button></div><div class="setbar">${SETUP_STEPS.map((_, k) => `<i class="${k < i ? 'on' : ''}"></i>`).join('')}</div><h2>${title}</h2><p class="muted">${sub}</p></div>`;
}
function setupBtns(last) {
    return `<div class="setupbtns">${setupStep ? '<button class="alt" onclick="setupNav(-1)">Back</button>' : ''}<button onclick="setupNav(1)">${last ? 'Finish' : 'Next'}</button></div>`;
}
function setupGuide() {
    if (!setupDraft)
        setupDraft = setupDraftFrom(data.settings);
    let d = setupDraft, k = SETUP_STEPS[setupStep], cur = currencyName();
    if (k === 'you')
        return `${setupHead(setupRerun ? 'Your setup' : 'Let’s set up your shop', setupRerun ? 'Your current settings are filled in. Nothing changes unless you tap Finish.' : 'A few quick questions so prices and tax are right from day one. About two minutes.')}
<div class="panel"><label for="suName" style="margin-top:0">What should we call you?</label><input id="suName" value="${esc(d.userName)}" autocomplete="given-name" autocapitalize="words" placeholder="Your name"><div class="hint">Used for your greeting on the Home screen.</div><label for="suBiz">Business name <span class="muted">(optional)</span></label><input id="suBiz" value="${esc(d.businessName)}" autocapitalize="words" placeholder="Your business name"><div class="hint">Shown on your reports and downloads.</div></div>
${setupRerun ? '' : `<div class="panel"><div class="row" style="gap:12px;align-items:center"><span class="tic lav">${ic('folder', 18)}</span><span class="grow"><b>Have a backup file?</b><span class="muted block">From another phone or before reinstalling.</span></span><button class="alt small" onclick="$('setupImport').click()">Restore</button></div><input class="hidden" id="setupImport" type="file" accept=".json,application/json" onchange="importData(event)"></div>`}${setupBtns()}`;
    if (k === 'region')
        return `${setupHead('Where do you sell?', 'This sets your currency, and card payments charge in it.')}<div class="regiongrid">${[['CAD', 'Canada', 'CAD $'], ['USD', 'United States', 'USD $']].map(([v, n, s]) => `<button class="regionbtn ${d.currency === v ? 'on' : ''}" aria-pressed="${d.currency === v}" onclick="setupPick('currency','${v}')"><b>${n}</b><span>${s}</span></button>`).join('')}</div><p class="hint" style="margin:10px 4px 0">${setupRerun ? `Now: ${esc(cur)}.` : 'We guessed from your phone’s settings.'}</p>${setupBtns()}`;
    if (k === 'craft') {
        let locked = data.materials.length > 0;
        return `${setupHead('What do you make?', 'We’ll start your materials with categories that suit your craft.')}${locked ? `<div class="panel muted">You already have materials, so your categories stay exactly as they are. Change them any time on the Materials page.</div>` : `${setupOpt('craft', 'fibre', 'Fibre arts', 'Crochet, knitting and more')}<div class="setopt soon" aria-disabled="true"><span class="setradio"></span><span class="grow"><b>More crafts coming soon</b></span></div>${setupOpt('craft', 'none', 'None, I’ll make my own', 'Start with just Other and add your own categories')}
<div class="panel"><div class="eyebrow">Your starting categories</div>${(d.craft === 'none' ? [['Other', 'pieces', 'pack']] : FIBRE_CATS).map(([n, u, w]) => `<div class="kv"><span><b>${n}</b></span><span class="muted">${u} · by the ${w}</span></div>`).join('')}<p class="hint">Rename, add or remove categories any time on the Materials page.</p></div>`}${setupBtns()}`;
    }
    if (k === 'pricing')
        return `${setupHead('How do you price?', 'Used for suggested prices. You can change it for any product.')}
<div class="panel"><label for="suHourly" style="margin-top:0">What do you pay yourself per hour? ($)</label><input id="suHourly" type="number" min="0" step="any" inputmode="decimal" value="${esc(d.hourly ?? '')}"></div>
<div class="panel"><div class="eyebrow">Pricing method</div>${setupOpt('method', 'labour', 'Materials + hourly labour', 'Supplies plus your time. Most makers start here.')}${setupOpt('method', 'multiply', 'Materials × multiplier', 'Material cost times a number, like × 3.', d.method === 'multiply' ? `<span class="setinline" onclick="event.stopPropagation()"><label for="suMult">Multiplier</label><input id="suMult" type="number" min="0" step="any" inputmode="decimal" value="${esc(d.multiplier ?? '')}"></span>` : '')}${setupOpt('method', 'markup', 'Materials with markup + labour', 'Supplies plus a % markup, plus your time.', d.method === 'markup' ? `<span class="setinline" onclick="event.stopPropagation()"><label for="suMarkup">Markup (%)</label><input id="suMarkup" type="number" min="0" step="any" inputmode="decimal" value="${esc(d.markup ?? '')}"></span>` : '')}</div>
<div class="panel"><div class="eyebrow">Round suggested prices</div><div class="setchips">${[['nearest', 'Nearest $1'], ['up1', 'Up to $1'], ['up5', 'Up to $5']].map(([v, l]) => `<button class="${d.rounding === v ? '' : 'alt'} small" aria-pressed="${d.rounding === v}" onclick="setupPick('rounding','${v}')">${l}</button>`).join('')}</div></div>${setupBtns()}`;
    if (k === 'stock')
        return `${setupHead('Keep count of your supplies?', 'Choose how much the app tracks what’s left on your shelf.')}${setupOpt('materialStock', 'pricing', 'Pricing only', 'Supplies are only used to work out prices. No counting.')}${setupOpt('materialStock', 'manual', 'Pricing and manual stock', 'See what’s left, and tap −1 or +1 yourself when you use or buy a pack.')}${setupOpt('materialStock', 'auto', 'Pricing and automatic stock', 'When you add finished items, the supplies they use come off your stock for you.', '<span class="pill ok" style="align-self:flex-start;margin-top:4px">Recommended</span>')}<p class="hint" style="margin:4px">Any single material can be set differently later on its Edit screen.</p>${setupBtns()}`;
    // tax
    return `${setupHead('Sales tax', 'Not collecting tax yet? Pick “Neither” and set it up later.')}
<div class="panel"><label for="suRate" style="margin-top:0">Your sales tax rate (%)</label><input id="suRate" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${esc(d.taxRate)}" placeholder="e.g. 13"><div class="hint">Your total rate, as a percent.</div></div>
<div class="panel"><div class="eyebrow">On your sales</div>${setupOpt('productTax', 'add', 'Add tax to my prices', '$20 + tax')}${setupOpt('productTax', 'included', 'Tax is already in my prices', '$20 total')}${setupOpt('productTax', 'none', 'Neither, I don’t charge tax', '')}</div>
<div class="panel"><div class="eyebrow">When you enter what you paid for supplies</div>${setupOpt('materialTax', 'includes', 'I’ll enter the price with tax', '')}${setupOpt('materialTax', 'add', 'I’ll enter the price before tax', '')}${setupOpt('materialTax', 'none', 'Neither, no tax on supplies', '')}<label class="check"><input type="checkbox" id="suNotClaim" ${d.notClaimingTax ? 'checked' : ''}> I’m not claiming tax back on supplies and expenses</label></div>
<p class="hint" style="margin:0 4px 6px">These are your defaults. Any single product, material or expense can override them on its own Edit screen.</p>${setupBtns(true)}`;
}
function setupDoneScreen() {
    let s = data.settings, meth = { labour: `Materials + ${cash(s.hourly)}/hr`, multiply: `Materials × ${num(s.multiplier)}`, markup: `Materials + ${num(s.markup)}% + labour` }[s.method] || '', stock = { pricing: 'Pricing only', manual: 'Manual', auto: 'Automatic' }[s.materialStock] || '', tax = s.taxRate === null || s.taxRate === undefined || s.taxRate === '' ? 'Not set yet' : `${num(s.taxRate)}%, ${{ add: 'added to prices', included: 'included in prices', none: 'not charged' }[s.productTax] || ''}`;
    let row = (l, v) => v ? `<div class="kv"><span class="muted">${l}</span><b>${esc(v)}</b></div>` : '';
    lsSet('csTutOffered', true);
    return `<div class="setupdone"><span class="tic aqua big-tic">${ic('check', 26)}</span><h2>You’re all set${s.userName ? ', ' + esc(s.userName) : ''}!</h2><p class="muted">Here’s what we set up. Change any of it in Settings.</p></div>
<div class="panel">${row('Business', s.businessName)}${row('Currency', currencyName())}${row('Pricing', meth)}${row('Supply stock', stock)}${row('Sales tax', tax)}</div>
<div class="panel"><div class="row" style="gap:12px;align-items:center;justify-content:flex-start"><span class="tic lav">${ic('help', 18)}</span><span class="grow"><b>New here?</b><span class="muted block">Take a quick tour of each page. About a minute per page, and you can skip any of it.</span></span></div></div>
<div class="stack"><button class="btn-wide" onclick="view('home');setTimeout(startTour,250)">Show me around</button><button class="alt btn-wide" onclick="view('home');setTimeout(()=>go('tutorials'),200)">Pick a page to learn</button><button class="linkbtn" onclick="view('home')">Not now, go to Home</button></div>`;
}

// Offer it the first time Home shows, before the tutorial prompt
const setupRenderBase = render;
render = function () {
    if (screen === 'home' && dataLoaded && setupNeeded()) {
        openSetupGuide(false);
        return;
    }
    return setupRenderBase.apply(this, arguments);
};
