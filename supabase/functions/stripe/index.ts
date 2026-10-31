// Stripe card payments for The Makers Nook / Crochet Studio (phone app only).
// Runs on Supabase (Edge Function). Holds the Stripe secret key, so the app never sees it.
//
// The app calls POST /functions/v1/stripe with the signed-in user's token and { action, ... }.
// Actions:
//   status      - the user's Stripe setup, plan and app fee
//   onboard     - creates the user's own Stripe account (first time) and returns Stripe's sign-up link
//   location    - saves the selling address Stripe needs for Tap to Pay
//   token       - connection token for Tap to Pay (on the user's own Stripe account)
//   charge      - starts a payment; the SERVER decides the amount's app fee (1% free plan, 0% paid plan)
//   confirm     - checks with Stripe that the payment really went through (and captures it) before the app saves the sale
//   cancel      - cancels a payment that didn't finish
//   test_plan   - SANDBOX ONLY: pretend to be on the paid plan, to test the 0% fee
//
// Secrets (set by the GitHub workflow): STRIPE_SECRET_KEY. Supabase provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Which Stripe account belongs to which user is kept in the user's app_metadata, which users can read but not change.

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
const SB_URL = Deno.env.get('SUPABASE_URL') || '';
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const SANDBOX = STRIPE_KEY.startsWith('sk_test_');
const FREE_FEE_PCT = 1; // app fee for free-plan users, percent of each card sale
const RETURN_URL = 'https://crochetstudiotest.netlify.app/?stripe=done';
const REFRESH_URL = 'https://crochetstudiotest.netlify.app/?stripe=again';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class Oops extends Error {
  status: number;
  constructor(msg: string, status = 400) {
    super(msg);
    this.status = status;
  }
}

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// ---- Stripe REST (form-encoded) ----
function form(obj: Record<string, unknown>, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => typeof x === 'object' ? form(x as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[]`, String(x)));
    else if (typeof v === 'object') form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}
async function stripe(method: string, path: string, params?: Record<string, unknown>, account?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${STRIPE_KEY}` };
  if (account) headers['Stripe-Account'] = account;
  let url = 'https://api.stripe.com/v1' + path, body: string | undefined;
  if (params && method === 'GET') url += '?' + form(params).toString();
  else if (params) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = form(params).toString();
  }
  const r = await fetch(url, { method, headers, body });
  const j = await r.json();
  if (!r.ok) {
    console.error('Stripe error', path, j?.error);
    throw new Oops(j?.error?.message || 'Stripe error', 502);
  }
  return j;
}

// ---- Stripe Accounts v2 (JSON). Stripe requires v2 for creating connected accounts on new platforms. ----
const STRIPE_V2_VERSION = '2026-10-28.endive';
async function stripeV2(method: string, path: string, body?: Record<string, unknown>, query = '') {
  const r = await fetch('https://api.stripe.com/v2' + path + (query ? '?' + query : ''), {
    method,
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, 'Stripe-Version': STRIPE_V2_VERSION, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (!r.ok) {
    console.error('Stripe v2 error', path, j?.error);
    throw new Oops(j?.error?.message || 'Stripe error', 502);
  }
  return j;
}
type AcctInfo = { id: string; ready: boolean; submitted: boolean; country: string; currency: string };
// Reads the seller's account (v2), falling back to v1 for any account made the older way.
async function accountInfo(acct: string): Promise<AcctInfo> {
  try {
    const a = await stripeV2('GET', `/core/accounts/${acct}`, undefined, 'include[0]=configuration.merchant&include[1]=identity&include[2]=defaults&include[3]=requirements');
    const st = a?.configuration?.merchant?.capabilities?.card_payments?.status || '';
    const due = (a?.requirements?.entries || []).some((e: Record<string, any>) => ['currently_due', 'past_due'].includes(e?.minimum_deadline?.status));
    return { id: a.id, ready: st === 'active', submitted: st === 'active' || st === 'pending' || !due, country: String(a?.identity?.country || '').toUpperCase(), currency: String(a?.defaults?.currency || '').toLowerCase() };
  } catch (e) {
    // An account made with the older v1 method: read it the old way
    let a;
    try {
      a = await stripe('GET', `/accounts/${acct}`);
    } catch (_) {
      throw e;
    }
    return { id: a.id, ready: !!a.charges_enabled, submitted: !!a.details_submitted, country: a.country || '', currency: a.default_currency || '' };
  }
}

// ---- Supabase user (verified with Supabase, not trusted from the phone) ----
type User = { id: string; email?: string; app_metadata: Record<string, unknown> };
async function getUser(req: Request): Promise<User> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) throw new Oops('Please sign in again.', 401);
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey: SB_SERVICE } });
  if (!r.ok) throw new Oops('Please sign in again.', 401);
  const u = await r.json();
  if (!u?.id) throw new Oops('Please sign in again.', 401);
  return { id: u.id, email: u.email, app_metadata: u.app_metadata || {} };
}
async function saveMeta(user: User, changes: Record<string, unknown>) {
  const app_metadata = { ...user.app_metadata, ...changes };
  const r = await fetch(`${SB_URL}/auth/v1/admin/users/${user.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${SB_SERVICE}`, apikey: SB_SERVICE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_metadata }),
  });
  if (!r.ok) {
    console.error('Saving app_metadata failed', r.status, await r.text());
    throw new Oops('Could not save your Stripe setup. Please try again.', 500);
  }
  user.app_metadata = app_metadata;
}

// Plan: real subscriptions will set app_metadata.plan = 'paid' (store billing, later).
// In the sandbox, test_plan lets the owner test both fee levels.
function isPaid(user: User) {
  return user.app_metadata.plan === 'paid' || (SANDBOX && user.app_metadata.test_plan === 'paid');
}
function appFeeCents(user: User, amount: number) {
  return isPaid(user) ? 0 : Math.round(amount * FREE_FEE_PCT / 100);
}
function acctOf(user: User) {
  const a = user.app_metadata.stripe_account;
  return typeof a === 'string' && a.startsWith('acct_') ? a : '';
}
async function readyAccount(user: User) {
  const acct = acctOf(user);
  if (!acct) throw new Oops('Connect your Stripe account first (Settings › Finances › Payments).');
  const a = await accountInfo(acct);
  if (!a.ready) throw new Oops('Your Stripe account isn’t ready to take payments yet. Finish the Stripe setup in Settings › Finances › Payments.');
  return a;
}
async function ownPayment(user: User, id: unknown) {
  if (typeof id !== 'string' || !id.startsWith('pi_')) throw new Oops('Unknown payment.');
  const acct = acctOf(user);
  if (!acct) throw new Oops('Connect your Stripe account first.');
  const pi = await stripe('GET', `/payment_intents/${id}`, { 'expand[]': 'latest_charge' } as Record<string, unknown>, acct);
  if (pi?.metadata?.user_id !== user.id) throw new Oops('Unknown payment.', 403);
  return { pi, acct };
}
function cardInfo(pi: Record<string, any>) {
  const d = pi?.latest_charge?.payment_method_details || {};
  const c = d.card_present || d.interac_present || d.card || {};
  return { brand: c.brand || '', last4: c.last4 || '' };
}

async function handle(action: string, b: Record<string, any>, user: User) {
  switch (action) {
    case 'status': {
      const acct = acctOf(user);
      let ready = false, submitted = false, country = '', currency = '';
      if (acct) {
        const a = await accountInfo(acct);
        ready = a.ready;
        submitted = a.submitted;
        country = a.country;
        currency = a.currency;
      }
      return {
        sandbox: SANDBOX,
        connected: !!acct,
        ready,
        submitted,
        country,
        currency,
        location: !!user.app_metadata.stripe_location,
        address: user.app_metadata.stripe_address || null,
        paid: isPaid(user),
        feePct: isPaid(user) ? 0 : FREE_FEE_PCT,
        testPlan: SANDBOX ? (user.app_metadata.test_plan || 'free') : undefined,
      };
    }
    case 'onboard': {
      let acct = acctOf(user);
      if (!acct) {
        const us = b.country === 'US';
        // The seller's own Stripe account (Accounts v2): Stripe charges the seller its normal fees,
        // Stripe covers fraud/dispute losses, and the seller gets the full Stripe Dashboard.
        const a = await stripeV2('POST', '/core/accounts', {
          contact_email: user.email,
          display_name: String(b.name || user.email || 'Seller').slice(0, 100),
          dashboard: 'full',
          identity: { country: us ? 'us' : 'ca' },
          configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
          defaults: { currency: us ? 'usd' : 'cad', responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' } },
          metadata: { user_id: user.id, app: 'makers-nook' },
          include: ['configuration.merchant'],
        });
        acct = a.id;
        await saveMeta(user, { stripe_account: acct, stripe_location: null });
      }
      const link = await stripeV2('POST', '/core/account_links', {
        account: acct,
        use_case: { type: 'account_onboarding', account_onboarding: { collection_options: { fields: 'eventually_due' }, return_url: RETURN_URL, refresh_url: REFRESH_URL } },
      });
      return { url: link.url };
    }
    case 'location': {
      const a = await readyAccount(user);
      const ad = b.address || {};
      const clean = (s: unknown, n = 80) => String(s ?? '').trim().slice(0, n);
      const address = { line1: clean(ad.line1), city: clean(ad.city, 60), state: clean(ad.state, 10).toUpperCase(), postal_code: clean(ad.postal_code, 12).toUpperCase(), country: a.country };
      if (!address.line1 || !address.city || !address.state || !address.postal_code) throw new Oops('Please fill in the street, city, province or state and postal code.');
      const loc = await stripe('POST', '/terminal/locations', { display_name: clean(b.name, 60) || 'Markets', address }, a.id);
      await saveMeta(user, { stripe_location: loc.id, stripe_address: address });
      return { ok: true, location: loc.id };
    }
    case 'token': {
      const a = await readyAccount(user);
      const t = await stripe('POST', '/terminal/connection_tokens', {}, a.id);
      return { secret: t.secret, location: user.app_metadata.stripe_location || null };
    }
    case 'charge': {
      const a = await readyAccount(user);
      const amount = Math.round(Number(b.amount));
      if (!Number.isFinite(amount) || amount < 50 || amount > 9_999_999) throw new Oops('The total must be between $0.50 and $99,999.99.');
      const fee = appFeeCents(user, amount);
      const pi = await stripe('POST', '/payment_intents', {
        amount,
        currency: a.currency || (a.country === 'US' ? 'usd' : 'cad'),
        allowed_payment_method_types: ['card_present'], // newer Stripe API: payment_method_types was removed
        capture_method: 'manual', // captured by 'confirm' after the server checks it
        application_fee_amount: fee > 0 ? fee : undefined,
        description: String(b.description || 'Sale').slice(0, 200),
        metadata: { user_id: user.id, ref: String(b.ref || '').slice(0, 60), test: b.test ? 'yes' : 'no' },
      }, a.id);
      return { id: pi.id, client_secret: pi.client_secret, fee, amount, currency: pi.currency };
    }
    case 'confirm': {
      let { pi, acct } = await ownPayment(user, b.id);
      if (pi.status === 'requires_capture') pi = await stripe('POST', `/payment_intents/${pi.id}/capture`, { 'expand[]': 'latest_charge' } as Record<string, unknown>, acct);
      return { status: pi.status, amount: pi.amount, fee: pi.application_fee_amount || 0, currency: pi.currency, ...cardInfo(pi) };
    }
    case 'cancel': {
      const { pi, acct } = await ownPayment(user, b.id);
      if (['requires_payment_method', 'requires_confirmation', 'requires_action', 'requires_capture', 'processing'].includes(pi.status)) {
        try {
          await stripe('POST', `/payment_intents/${pi.id}/cancel`, {}, acct);
        } catch (_) { /* already finished */ }
      }
      return { ok: true };
    }
    case 'test_plan': {
      if (!SANDBOX) throw new Oops('Only available in test mode.', 403);
      await saveMeta(user, { test_plan: b.plan === 'paid' ? 'paid' : 'free' });
      return { ok: true, paid: isPaid(user) };
    }
    default:
      throw new Oops('Unknown action.');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'Use POST.' }, 405);
  try {
    if (!STRIPE_KEY) throw new Oops('Stripe isn’t set up on the server yet.', 500);
    const user = await getUser(req);
    const b = await req.json().catch(() => ({}));
    return reply(await handle(String(b.action || ''), b, user));
  } catch (e) {
    const status = e instanceof Oops ? e.status : 500;
    if (!(e instanceof Oops)) console.error(e);
    return reply({ error: e instanceof Oops ? e.message : 'Something went wrong. Please try again.' }, status);
  }
});
