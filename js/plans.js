// Plans screen: what Free and Pro include, and the price.
// Part of The Makers Nook app. Files load in the order listed in index.html.
// Opened from Settings › Account › Subscription and from "See plans" in the tutorials.
// Subscribing comes with the app-store versions (Google Play / App Store billing).

ICONS.crown ||= '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>';
const PRO_PRICE = ''; // price not shown while testing (asking testers what feels fair)
const PLAN_FREE = [
    'Products and materials, with suggested prices',
    '1 market at a time, with packing and a to-do list',
    'Checkout with cash, card or e-transfer',
    'Card payments with Square',
    'Tap to Pay with Stripe (1% app fee on top of Stripe’s fee)',
    'Reports Overview: all time or one year at a time, with downloads',
    'An account that syncs your phones and tablets'
];
const PLAN_PRO = [
    'Everything in Free',
    'Unlimited markets',
    'Reminders: things to make, buy and remember',
    'Pattern library: PDFs, photos and links',
    'Receipts and expenses, including market costs',
    'All reports: Markets, Stock, and Expenses and tax, with more time frames',
    'No app fee on Tap to Pay'
];
function planList(items, pro) {
    return `<ul class="planlist">${items.map((t, i) => `<li class="${pro && i === 0 ? 'muted' : ''}"><span class="plancheck ${pro ? 'pro' : ''}">${ic('check', 13)}</span>${esc(t)}</li>`).join('')}</ul>`;
}
function plans() {
    return `${navStack.length ? backBtn() : ''}<h2 style="margin-top:12px">Plans</h2>
<div class="panel planbanner"><b>Test version:</b> everyone has every Pro feature while we’re testing. Plans start with the Google Play and App Store versions.</div>
<div class="panel plancard"><div class="row"><div><div class="eyebrow">Free</div><div class="planprice">$0</div></div><span class="pill">Always free</span></div>${planList(PLAN_FREE)}</div>
<div class="panel plancard procard"><div class="row"><div><div class="eyebrow">${ic('crown', 14)} Pro</div><div class="planprice">${PRO_PRICE ? `${PRO_PRICE}<span> / month</span>` : '<span class="plantbd">Price to be decided</span>'}</div></div><span class="pill propill">Most features</span></div>${planList(PLAN_PRO, true)}<button class="btn-wide" disabled>Subscribe · coming soon</button><p class="hint" style="text-align:center;margin-bottom:0">Billed through Google Play or the App Store. Cancel any time in your store account.</p></div>
<p class="hint" style="margin:0 6px 14px">If you stop paying for Pro, nothing is deleted. Extra markets, patterns, receipts and reports stay saved and unlock again when you come back.</p>`;
}
