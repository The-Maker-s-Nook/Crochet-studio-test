// Stripe Tap to Pay (TEST, phone app only: lives on the app-wrap branch).
// Part of the Crochet Studio app. Loads after settings.js / checkout.js and adds a third choice for card payments:
// Settings › Finances › Payments › "Take card payments with: None / Square / Stripe".
// With Stripe chosen, checkout's Card button becomes "Charge $X with Tap to Pay" (the customer taps their card or phone on the back of this phone).
// Everything sensitive happens on the server (supabase/functions/stripe): the Stripe secret key, the 1% app fee for free-plan users,
// and checking with Stripe that a payment really went through before the sale is saved.
// On the website (or if the Stripe plugin is missing) nothing here changes the app.

const STRIPE_DEVICE = IS_APP && !!appPlugin('StripeTerminal');
let stripeInfo = lsGet('csStripeInfo', null), stripeLoading = false, stripeBusy = false, stripeErr = '';
let stripeTerm = { ready: false, connected: false, init: null, listeners: false };
const stripeChosen = () => data.settings?.cardProvider === 'stripe';
const stripeOn = () => STRIPE_DEVICE && stripeChosen();
const stripeReal = () => !!lsGet('csStripeRealTap', false);

function stripeApi(action, body = {}) {
    if (!signedIn())
        return Promise.reject(new Error('Sign in to your Crochet Studio account first (Settings › Account). Stripe payments are linked to your account.'));
    return sbFetch('/functions/v1/stripe', { method: 'POST', body: { action, ...body } });
}
function stripeMsg(e) {
    let m = String(e?.message || e || '');
    if (m === 'offline')
        return 'No internet connection. Tap to Pay needs the internet to reach Stripe.';
    return m || 'Something went wrong with Stripe.';
}
async function stripeRefresh(quiet) {
    if (!signedIn())
        return null;
    stripeLoading = true;
    try {
        stripeInfo = await stripeApi('status');
        lsSet('csStripeInfo', stripeInfo);
        stripeErr = '';
    }
    catch (e) {
        stripeErr = stripeMsg(e);
        if (!quiet)
            throw e;
    }
    finally {
        stripeLoading = false;
    }
    return stripeInfo;
}

// ---------- Settings › Finances › Payments ----------
function setCardProvider(p) {
    data.settings.cardProvider = p;
    data.settings.squareEnabled = p === 'square';
    save();
    if (p === 'stripe' && signedIn())
        stripeRefresh(true).then(render);
    render();
}
function providerPicker() {
    let cur = stripeChosen() ? 'stripe' : data.settings.squareEnabled ? 'square' : 'none';
    let opt = (v, n, s) => `<button class="regionbtn ${cur === v ? 'on' : ''}" aria-pressed="${cur === v}" onclick="setCardProvider('${v}')"><b>${n}</b><span>${s}</span></button>`;
    return `<div class="panel"><div class="eyebrow">Take card payments with</div><div class="regiongrid" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:10px">${opt('none', 'None', 'Record only')}${opt('square', 'Square', 'Square app')}${opt('stripe', 'Stripe', 'Tap to Pay')}</div><p class="hint">${cur === 'none' ? 'Card sales are recorded at checkout. Take the payment on your own reader.' : cur === 'square' ? 'Card opens the Square Point of Sale app with the total ready.' : 'Card becomes Tap to Pay: the customer taps their card or phone on the back of this phone.'}</p></div>`;
}
function stripeStatusPill(i) {
    if (!i?.connected)
        return '<span class="pill">Not connected</span>';
    if (!i.ready)
        return '<span class="pill">Finish setup</span>';
    return '<span class="pill ok">Ready</span>';
}
function stripePanel() {
    if (!signedIn())
        return `<div class="panel"><h3>Stripe</h3><p class="hint">Stripe payments are linked to your Crochet Studio account, so sign in first.</p><button onclick="go('settingsAccount')">Sign in</button></div>`;
    let i = stripeInfo;
    if (!i && !stripeLoading && !stripeErr)
        stripeRefresh(true).then(render);
    if (!i)
        return `<div class="panel"><h3>Stripe</h3><p class="muted">${stripeErr ? esc(stripeErr) : 'Checking your Stripe setup…'}</p>${stripeErr ? `<button class="alt" onclick="stripeErr='';stripeRefresh(true).then(render);render()">Try again</button>` : ''}</div>`;
    let fee = i.paid ? '<b>Paid plan:</b> no app fee. You pay only Stripe’s normal card fee.' : `<b>Free plan:</b> a ${i.feePct}% app fee is added to each card sale, on top of Stripe’s normal card fee. The paid plan has no app fee.`;
    let acct = !i.connected
        ? `<p class="hint">Stripe opens its own sign-up in your browser. You’ll add your business details and the bank account where your sales are paid out. Your money goes straight to you.</p><button onclick="stripeConnect()">${ic('card', 18)} Connect Stripe</button>`
        : !i.ready
            ? `<p class="hint">${i.submitted ? 'Stripe is still checking your details. This can take a few minutes.' : 'Your Stripe sign-up isn’t finished yet.'}</p><div class="actions"><button onclick="stripeConnect()">${i.submitted ? 'Open Stripe setup' : 'Continue setup'}</button><button class="alt" onclick="stripeRecheck()">${ic('sync', 16)} Check again</button></div>`
            : `<div class="row" style="margin-top:6px"><span class="muted">Selling address</span><span>${i.address ? esc([i.address.city, i.address.state].filter(Boolean).join(', ')) : 'Not set'}</span></div><div class="linkrow"><button class="linkbtn" onclick="stripeAddressForm()">${i.address ? 'Change address' : '+ Add your selling address'}</button></div><button class="alt" style="margin-top:8px" onclick="stripeTest()">${ic('card', 18)} Test Tap to Pay with $1.00</button>`;
    let sandbox = i.sandbox ? `<div class="panel" style="background:var(--tg-bg)"><h3>Test mode <span class="pill beta">Stripe sandbox</span></h3><p class="hint">No real money moves. Fake details are fine in the Stripe sign-up (use 000-000 for codes, test bank 000123456789).</p><label class="check"><input type="checkbox" ${i.testPlan === 'paid' ? 'checked' : ''} onchange="stripeTestPlan(this.checked)"> Pretend I’m on the paid plan (no 1% fee)</label><label class="check"><input type="checkbox" ${stripeReal() ? 'checked' : ''} onchange="lsSet('csStripeRealTap',this.checked);appAlert('Close and reopen the app for this to take effect.')"> Use the phone’s real tap reader</label><p class="hint">Off: Stripe’s simulated tap (approves instantly, no card needed). On: the real NFC reader, which in test mode needs a Stripe physical test card.</p></div>` : '';
    return `<div class="panel"><div class="row"><h3 style="margin:0">Stripe</h3>${stripeStatusPill(i)}</div>${acct}<p class="hint" style="margin-top:10px">${fee}</p><p class="hint">Refunds: open the payment in your Stripe Dashboard. Deleting a sale in the app doesn’t refund the card.</p></div>${sandbox}`;
}
const settingsPaymentsSquare = settingsPayments;
settingsPayments = function () {
    if (!STRIPE_DEVICE)
        return settingsPaymentsSquare();
    if (stripeChosen())
        return `${backBtn()}<h2 style="margin-top:12px">Payments</h2>${providerPicker()}${stripePanel()}<div class="panel muted">Cash, card on your own reader and e-transfer can always be recorded at checkout.</div>`;
    // Square / None: the existing screen, with the on/off box swapped for the picker
    let h = settingsPaymentsSquare();
    return h.replace(/<div class="panel"><label class="check" style="margin-top:0"><input type="checkbox" id="sqOn"[\s\S]*?<\/p><\/div>/, providerPicker());
};
const settingsFinancesBase = settingsFinances;
settingsFinances = function () {
    let h = settingsFinancesBase();
    return stripeOn() ? h.replace('Cash, card and e-transfer', 'Stripe Tap to Pay on (test)') : h;
};
async function stripeConnect() {
    try {
        flash('Opening Stripe…');
        let r = await stripeApi('onboard', { country: sqCurrency() === 'USD' ? 'US' : 'CA', name: data.settings.businessName || data.settings.userName || '' });
        await stripeRefresh(true);
        render();
        await appOpenUrl(r.url);
        setTimeout(() => appAlert('Finish the sign-up in Stripe, then come back here. Your status updates when you return.', 'Stripe sign-up'), 600);
    }
    catch (e) {
        appAlert(stripeMsg(e), 'Stripe');
    }
}
async function stripeRecheck() {
    try {
        await stripeRefresh();
        render();
        flash(stripeInfo?.ready ? 'Stripe is ready.' : 'Stripe isn’t ready yet.');
    }
    catch (e) {
        appAlert(stripeMsg(e), 'Stripe');
    }
}
async function stripeTestPlan(paid) {
    try {
        await stripeApi('test_plan', { plan: paid ? 'paid' : 'free' });
        await stripeRefresh();
        render();
    }
    catch (e) {
        appAlert(stripeMsg(e), 'Stripe');
        render();
    }
}
// Coming back from Stripe's sign-up in the browser: update the status
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && stripeOn() && signedIn() && stripeInfo && !stripeInfo.ready && !stripeBusy)
        stripeRefresh(true).then(() => {
            if (screen === 'settingsPayments')
                render();
        });
});

// ---------- Selling address (Stripe needs one for Tap to Pay) ----------
function stripeAddressForm(note) {
    let a = stripeInfo?.address || data.settings.stripeAddress || {}, us = (stripeInfo?.country || (sqCurrency() === 'USD' ? 'US' : 'CA')) === 'US';
    openModal(`<div class="row"><h3 style="margin:0">Selling address</h3>${closeX()}</div>${note ? `<p style="font-weight:700;margin:6px 0">${esc(note)}</p>` : ''}<p class="hint">Stripe needs an address for Tap to Pay payments, like your home base. It isn’t shown to customers.</p><label for="saLine">Street address</label><input id="saLine" value="${esc(a.line1 || '')}" autocomplete="address-line1"><label for="saCity">City</label><input id="saCity" value="${esc(a.city || '')}" autocomplete="address-level2"><div class="row" style="gap:10px;align-items:flex-end"><div class="grow"><label for="saState">${us ? 'State (2 letters)' : 'Province (2 letters)'}</label><input id="saState" maxlength="2" value="${esc(a.state || '')}" placeholder="${us ? 'NY' : 'ON'}" style="text-transform:uppercase"></div><div class="grow"><label for="saPost">${us ? 'ZIP code' : 'Postal code'}</label><input id="saPost" value="${esc(a.postal_code || '')}" autocomplete="postal-code" style="text-transform:uppercase"></div></div><button class="btn-wide" style="margin-top:14px" onclick="stripeSaveAddress()">Save address</button>`);
}
async function stripeSaveAddress() {
    let address = { line1: $('saLine').value, city: $('saCity').value, state: $('saState').value, postal_code: $('saPost').value };
    try {
        await stripeApi('location', { address, name: data.settings.businessName || data.settings.userName || 'Markets' });
        data.settings.stripeAddress = address;
        save();
        // A new address means a new Stripe location: reconnect the tap reader next time
        if (stripeTerm.connected) {
            try {
                await appPlugin('StripeTerminal').disconnectReader();
            }
            catch {
            }
            stripeTerm.connected = false;
        }
        await stripeRefresh(true);
        closeModal();
        render();
        flash('Address saved.');
    }
    catch (e) {
        appAlert(stripeMsg(e), 'Selling address');
    }
}

// ---------- Tap to Pay reader (Stripe Terminal plugin) ----------
function stripeTerminalInit() {
    let T = appPlugin('StripeTerminal');
    if (!stripeTerm.listeners) {
        stripeTerm.listeners = true;
        // The phone asks for a connection token whenever it needs one; the server makes it on the user's own Stripe account
        T.addListener('terminalRequestedConnectionToken', async () => {
            try {
                let r = await stripeApi('token');
                await T.setConnectionToken({ token: r.secret });
            }
            catch (e) {
                console.warn('Stripe token', e);
                try {
                    await T.setConnectionToken({ token: '' });
                }
                catch {
                }
            }
        });
        T.addListener('terminalDisconnectedReader', () => stripeTerm.connected = false);
    }
    if (!stripeTerm.init)
        stripeTerm.init = T.initialize({ isTest: !stripeReal() }).then(() => stripeTerm.ready = true).catch(e => {
            stripeTerm.init = null;
            throw e;
        });
    return stripeTerm.init;
}
function stripeDiscover(T, locationId) {
    // discoverReaders reports readers through an event; resolve on the first one
    return new Promise((ok, fail) => {
        let done = false, h = null, t = setTimeout(() => finish(null, new Error('Tap to Pay didn’t start on this phone. Check that NFC is turned on (Settings › Connections › NFC).')), 25000);
        function finish(readers, err) {
            if (done)
                return;
            done = true;
            clearTimeout(t);
            h?.remove?.();
            err ? fail(err) : ok(readers);
        }
        // On the phone, addListener may hand back the handle directly instead of a promise
        Promise.resolve(T.addListener('terminalDiscoveredReaders', ({ readers }) => finish(readers))).then(x => {
            h = x;
            if (done)
                x.remove();
        });
        Promise.resolve(T.discoverReaders({ type: 'tap-to-pay', locationId }, (res, err) => err ? finish(null, err) : res?.readers?.length && finish(res.readers))).then(res => res?.readers?.length && finish(res.readers)).catch(e => finish(null, e));
    });
}
async function stripeReader() {
    let T = appPlugin('StripeTerminal');
    await stripeTerminalInit();
    if (stripeTerm.connected) {
        try {
            let r = await T.getConnectedReader();
            if (r?.reader)
                return T;
        }
        catch {
        }
        stripeTerm.connected = false;
    }
    let tok = await stripeApi('token');
    if (!tok.location)
        throw new Error('Add your selling address first.');
    let readers = await stripeDiscover(T, tok.location);
    if (!readers?.length)
        throw new Error('This phone can’t do Tap to Pay. It needs NFC and Android 11 or newer.');
    await T.connectReader({ reader: readers[0], locationId: tok.location, merchantDisplayName: data.settings.businessName || 'Crochet Studio', autoReconnectOnUnexpectedDisconnect: true });
    stripeTerm.connected = true;
    return T;
}
function stripeFriendly(e) {
    let m = stripeMsg(e), low = m.toLowerCase();
    if (/cancel/.test(low))
        return '';
    if (/nfc/.test(low) && /disabled|off|enable/.test(low))
        return 'Turn on NFC in your phone’s settings (Settings › Connections › NFC), then try again.';
    if (/insecure|debug|developer|rooted|attestation|integrity/.test(low))
        return `Stripe blocked the real tap reader on this test build (${m}). Turn off “Use the phone’s real tap reader” in Settings › Finances › Payments to use the simulated tap, or ask Claude for a release-type test build.`;
    if (/location|permission/.test(low))
        return 'Tap to Pay needs location permission (Stripe requires it to protect payments). Allow it when the phone asks, or in the phone’s app settings.';
    if (/declin/.test(low))
        return 'The card was declined. The sale is still open. Try another card or payment method.';
    return m;
}

// ---------- Taking a payment ----------
function stripeTapModal(total, msg) {
    openModal(`<div style="text-align:center;padding:6px 4px"><div style="font-size:30px;font-weight:900;margin:4px 0 10px">${cash(total)}</div><div style="margin:0 auto 12px;width:64px;height:64px;border-radius:50%;background:var(--lav-soft);display:flex;align-items:center;justify-content:center">${ic('card', 30)}</div><p id="stripeTapMsg" style="font-weight:800;margin:0 0 6px">${esc(msg)}</p><p class="hint" id="stripeTapHint">${stripeReal() ? 'The customer holds their card or phone flat against the back of this phone.' : 'Test mode: Stripe’s simulated tap approves on its own.'}</p><button class="alt btn-wide" id="stripeCancelBtn" onclick="stripeCancelTap()">Cancel</button></div>`);
    // Tapping outside shouldn't close it mid-payment
    let o = $('modal');
    o?.replaceWith(o.cloneNode(true));
}
function stripeTapStep(msg, hint, canCancel = true) {
    let m = $('stripeTapMsg'), h = $('stripeTapHint'), b = $('stripeCancelBtn');
    if (m)
        m.textContent = msg;
    if (h && hint !== undefined)
        h.textContent = hint;
    if (b)
        b.style.display = canCancel ? '' : 'none';
}
let stripeCancelled = false, stripePiId = '';
async function stripeCancelTap() {
    stripeCancelled = true;
    stripeTapStep('Cancelling…', '', false);
    try {
        await appPlugin('StripeTerminal').cancelCollectPaymentMethod();
    }
    catch {
    }
}
// Runs one payment. Returns { id, fee, brand, last4, amount } once Stripe confirms it, or null if cancelled.
async function stripeCollect(total, description, ref, test) {
    let cents = Math.round(total * 100);
    if (cents < 50) {
        await appAlert('Tap to Pay needs a total of at least $0.50.');
        return null;
    }
    let i = await stripeRefresh();
    if (!i?.ready) {
        await appAlert('Finish your Stripe setup first (Settings › Finances › Payments).', 'Stripe');
        return null;
    }
    if (!i.location) {
        stripeAddressForm('One-time step: add your selling address, then tap Charge again.');
        return null;
    }
    stripeBusy = true;
    stripeCancelled = false;
    stripePiId = '';
    stripeTapModal(total, 'Getting Tap to Pay ready…');
    try {
        let T = await stripeReader();
        if (stripeCancelled)
            return null;
        let pi = await stripeApi('charge', { amount: cents, description, ref, test });
        stripePiId = pi.id;
        stripeTapStep('Ready: tap the card on the back of the phone', undefined, true);
        await T.collectPaymentMethod({ paymentIntent: pi.client_secret });
        if (stripeCancelled)
            throw new Error('cancelled');
        stripeTapStep('Processing…', 'Keep the app open.', false);
        await T.confirmPaymentIntent();
        let c = await stripeApi('confirm', { id: pi.id });
        if (c.status !== 'succeeded')
            throw new Error(`Stripe didn’t approve the payment (${c.status}).`);
        stripePiId = '';
        return { id: pi.id, amount: c.amount / 100, fee: (c.fee || 0) / 100, stripeFee: c.stripeFee == null ? null : c.stripeFee / 100, brand: c.brand, last4: c.last4, currency: c.currency };
    }
    catch (e) {
        if (stripePiId)
            stripeApi('cancel', { id: stripePiId }).catch(() => {
            });
        let m = stripeCancelled ? '' : stripeFriendly(e);
        closeModal();
        if (m)
            await appAlert(m + (test ? '' : '\n\nThe sale is still open.'), 'Tap to Pay');
        return null;
    }
    finally {
        stripeBusy = false;
        closeModal();
    }
}
async function stripeTest() {
    let r = await stripeCollect(1, 'Crochet Studio test payment', 'test', true);
    if (r)
        appAlert(`Tap to Pay worked! ${r.brand ? `${r.brand.toUpperCase()} •••• ${r.last4}. ` : ''}App fee: ${cash(r.fee)}.${stripeInfo?.sandbox ? ' This was a test payment, no real money.' : ' Refund the $1.00 in your Stripe Dashboard.'}`, 'Stripe is connected');
}
async function stripeCharge() {
    if (stripeBusy)
        return;
    let mid = saleKind === 'quick' ? null : marketSelected, m = mid ? data.markets.find(x => x.id === mid) : null, o = computeOrder(marketSaleDraft, saleAdj);
    if ((mid && !m) || !o.items)
        return;
    if (stockProblem(mid, marketSaleDraft))
        return appAlert('Stock has changed since this sale started. Please check the items and try again.');
    // Keep this sale as it is while the customer taps
    let draft = JSON.parse(JSON.stringify(marketSaleDraft)), adj = JSON.parse(JSON.stringify(saleAdj)), kind = saleKind;
    let r = await stripeCollect(o.total, (m ? m.name + ': ' : '') + o.lines.map(l => `${l.name} × ${l.qty}`).join(', '), id(), false);
    if (!r)
        return;
    let oid = finalizeOrder(mid, draft, adj, { method: 'card', via: 'stripe', stripePi: r.id, appFee: r.fee, stripeFee: r.stripeFee, cardBrand: r.brand || '', cardLast4: r.last4 || '', test: !!stripeInfo?.sandbox }, true);
    if (!oid)
        return appAlert(`The ${cash(o.total)} payment went through, but the sale couldn’t be saved. Please add it by hand.`);
    saleKind = kind;
    afterSale(o.total);
    if (r.fee)
        setTimeout(() => toast(`Card approved · app fee ${cash(r.fee)}`), 600);
}
const completeSaleBase = completeSale;
completeSale = function () {
    if (payTmp.method === 'card' && stripeOn())
        return stripeCharge();
    return completeSaleBase();
};
const saleReviewBase = saleReview;
saleReview = function () {
    let h = saleReviewBase();
    if (!stripeOn())
        return h;
    h = h.replace(/(onclick="payTmp\.method='card';payTmp\.touched=true;render\(\)">[\s\S]*?)(<\/button>)/, '$1<span class="sqtag">Tap to Pay</span>$2');
    if (payTmp.method !== 'card')
        return h;
    let o = computeOrder(marketSaleDraft, saleAdj), fee = stripeInfo && !stripeInfo.paid ? round2(o.total * (stripeInfo.feePct || 0) / 100) : 0;
    let hint = `<p class="hint">Tap to Pay: the customer taps their card or phone on the back of this phone. The sale saves once Stripe approves it.${fee ? ` App fee on the free plan: ${cash(fee)}.` : ''}</p>`;
    return h.replace(/<p class="hint">Records a card payment taken on your own reader\.[\s\S]*?<\/p>/, hint).replace(/<button class="btn-wide" onclick="completeSale\(\)">[\s\S]*?<\/button>$/, `<button class="btn-wide" onclick="completeSale()">${ic('card', 18)} Charge ${cash(o.total)} with Tap to Pay</button>`);
};

// ---------- Saved sales paid with Stripe ----------
function stripeOrder(key) {
    let o = data.orders.find(x => x.id === key);
    return o?.payment?.via === 'stripe' ? o : null;
}
const saleEditBase = saleEdit;
saleEdit = function () {
    let h = saleEditBase(), o = stripeOrder(selected);
    if (!o)
        return h;
    let p = o.payment, card = p.cardBrand ? `${esc(p.cardBrand.toUpperCase())} •••• ${esc(p.cardLast4 || '')}` : 'Card';
    let paid = `<div class="eyebrow">Paid by</div><p class="muted" style="margin:6px 0 0">${card} · Tap to Pay (Stripe${p.test ? ', test' : ''})</p><p class="muted" style="margin:4px 0 0">Fees taken from your payout: Stripe ${p.stripeFee == null ? 'not recorded' : cash(p.stripeFee)} · app fee ${cash(num(p.appFee))}</p><p class="hint">Changing the price or discount here doesn't change what Stripe charged. Refund any difference in your Stripe Dashboard.</p></div>`;
    return h.replace(/<div class="eyebrow">Paid by<\/div><div class="paygrid">[\s\S]*?<\/div><\/div>/, paid);
};
const setPayMethodBase = setPayMethod;
setPayMethod = function (key, k) {
    if (stripeOrder(key))
        return appAlert('This sale was paid with Tap to Pay, so its payment method can’t be changed.');
    return setPayMethodBase(key, k);
};
const deleteSaleBase = deleteSale;
deleteSale = async function (key) {
    if (stripeOrder(key) && !await appConfirm('This sale was paid with Tap to Pay. Deleting it here doesn’t refund the card. Refund it in your Stripe Dashboard.\n\nContinue?', { ok: 'Continue' }))
        return;
    return deleteSaleBase(key);
};

// Card fees in Reports (taken off profit, PDF and Excel) are in markets.js (cardFeesOf), reports.js and report-files.js.
