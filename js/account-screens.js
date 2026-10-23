// Sign-up, sign-in, password and Account settings screens
// Part of the Crochet Studio app. Files load in the order listed in index.html.

const EYE = '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', EYE_OFF = '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>';
function pwField(fid, ac, extra = '') {
    return `<div class="pwbox"><input id="${fid}" type="password" autocomplete="${ac}" ${extra}><button type="button" class="pweye" aria-label="Show password" aria-pressed="false" onclick="togglePw('${fid}',this)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${EYE}</svg></button></div>`;
}
function togglePw(fid, b) {
    let i = $(fid);
    if (!i)
        return;
    let show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    b.setAttribute('aria-pressed', String(show));
    b.querySelector('svg').innerHTML = show ? EYE_OFF : EYE;
}
function welcomeInstall() {
    if (isStandalone() || !location.protocol.startsWith('http'))
        return '';
    if (installPromptEvent)
        return `<div class="panel winstall"><div class="grow"><b>Install the app</b><div class="muted">Add it to your home screen. It opens like a normal app and works without internet.</div></div><button onclick="installApp()">Install</button></div>`;
    if (isIOS())
        return `<div class="panel winstall"><div class="grow"><b>Install on ${/ipad/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iPad' : 'iPhone'}</b><div class="muted">In Safari, tap Share (the square with an arrow), then <b>Add to Home Screen</b>.</div></div></div>`;
    if (/android/i.test(navigator.userAgent))
        return `<div class="panel winstall"><div class="grow"><b>Install the app</b><div class="muted">In Chrome, tap the <b>⋮</b> menu, then <b>Install app</b> or <b>Add to Home screen</b>.</div></div></div>`;
    return '';
}
// ---- Screens ----
function logoSvg() {
    return document.querySelector('header .badge')?.innerHTML || '';
}
function authBack() {
    return `<button class="auth-back" onclick="goBack()" aria-label="Back">${ic('back', 22)}</button>`;
}
function authWelcome() {
    return `<div class="auth"><div class="auth-top center"><span class="auth-logo">${logoSvg()}</span><h1>Crochet Studio</h1><p>Your makes, materials, patterns and market sales, on every device.</p></div><div class="auth-body"><button class="btn-wide btn-white" onclick="soon('Google')">Continue with Google <span class="soon">Soon</span></button><button class="btn-wide btn-dark" onclick="soon('Apple')">Continue with Apple <span class="soon">Soon</span></button><div class="or">or</div><button class="btn-wide" onclick="authFlow={};go('authSignup')">Sign up with email</button><p class="auth-note big-note">Already have an account? <button class="linkbtn" onclick="authFlow={email:lsGet('csLastEmail','')};go('authSignin')">Sign in</button></p><div class="grow"></div><button class="linkbtn" onclick="useLocalOnly()">Continue without an account</button><p class="auth-note">Without an account, everything stays on this device only. You can sign up later in Settings.</p>${welcomeInstall()}</div></div>`;
}
function authSignup() {
    return `<div class="auth"><div class="auth-top">${authBack()}<h1>Create your account</h1><p>Your data will be saved to it, so you can use any device.</p></div><form class="auth-body" novalidate onsubmit="event.preventDefault();doSignup()"><div class="panel"><label for="suEmail">Email</label><input id="suEmail" type="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" value="${esc(authFlow.email || '')}"><label for="suPass" class="gap">Password</label>${pwField('suPass', 'new-password')}<div class="hint small-hint">At least 8 characters</div></div><button class="btn-wide" type="submit">Create account</button><p class="auth-note big-note">Already have an account? <button type="button" class="linkbtn" onclick="authSwap('authSignin')">Sign in</button></p></form></div>`;
}
function authSignin() {
    return `<div class="auth"><div class="auth-top">${authBack()}<h1>Welcome back</h1><p>Sign in to get your things on this device.</p></div><form class="auth-body" novalidate onsubmit="event.preventDefault();doSignin()"><div class="panel"><label for="siEmail">Email</label><input id="siEmail" type="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" value="${esc(authFlow.email || '')}"><label for="siPass" class="gap">Password</label>${pwField('siPass', 'current-password')}<div style="text-align:right"><button type="button" class="linkbtn" onclick="authSwap('authForgot')">Forgot password?</button></div></div><button class="btn-wide" type="submit">Sign in</button><p class="auth-note big-note">New here? <button type="button" class="linkbtn" onclick="authSwap('authSignup')">Create an account</button></p></form></div>`;
}
function authForgot() {
    return `<div class="auth"><div class="auth-top">${authBack()}<h1>Forgot password</h1><p>We'll email you a code to set a new one.</p></div><form class="auth-body" novalidate onsubmit="event.preventDefault();doForgot()"><div class="panel"><label for="fpEmail">Email</label><input id="fpEmail" type="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" value="${esc(authFlow.email || '')}"></div><button class="btn-wide" type="submit">Send code</button></form></div>`;
}
function authVerify() {
    let rec = authFlow.purpose === 'recovery';
    return `<div class="auth"><div class="auth-top">${authBack()}<h1>Check your email</h1><p>We sent an email to <b class="ink">${esc(authFlow.email || 'your email')}</b></p></div><div class="auth-body">${rec ? `<div class="panel"><b class="setup-q">Tap the link in the email</b><p class="muted setup-sub">It opens a page where you choose a new password. Then come back here and sign in with it.</p><div class="stack"><button class="btn-wide" onclick="authSwap('authSignin')">Back to sign in</button></div></div>` : `<div class="panel"><b class="setup-q">1. Tap “Confirm your mail” in the email</b><p class="muted setup-sub">It opens a page that says your email is confirmed.</p><b class="setup-q" style="display:block;margin-top:14px">2. Come back here and tap Continue</b><div class="stack"><button class="btn-wide" onclick="doLinkConfirmed()">Continue</button></div></div>`}<div class="tip">Can't find it? Check your spam or promotions folder, or send a new one. Use the link in the newest email.</div><button type="button" class="linkbtn" onclick="resendCode()">Send a new email</button><details class="panel codebox"><summary>Got a code instead?</summary><form novalidate onsubmit="event.preventDefault();doVerify()"><div class="otp" id="otp">${Array.from({ length: OTP_LEN }, (_, i) => `<input inputmode="numeric" pattern="[0-9]*" autocomplete="${i ? 'off' : 'one-time-code'}" maxlength="${OTP_LEN}" aria-label="Digit ${i + 1}" data-i="${i}" oninput="otpInput(this,event)" onkeydown="otpKey(event,this)">`).join('')}</div><button class="btn-wide" type="submit" style="margin-top:14px">Confirm code</button></form></details></div></div>`;
}
function authLinkDone() {
    let pw = authFlow.done === 'password';
    return `<div class="auth"><div class="auth-top center"><span class="auth-logo">${logoSvg()}</span><h1>${pw ? 'Password saved!' : 'Email confirmed!'}</h1><p>${pw ? 'Go back to the Crochet Studio app and sign in with your new password.' : 'Go back to the Crochet Studio app and tap <b class="ink">Continue</b>.'}</p></div><div class="auth-body"><div class="tip">You can close this page.</div><div class="grow"></div><p class="auth-note">Not using the app on this device? You can sign in here instead.</p><button class="btn-wide alt" onclick="authFlow={email:lsGet('csLastEmail','')};go('authSignin')">Sign in here</button></div></div>`;
}
function authNewPassword() {
    return `<div class="auth"><div class="auth-top"><h1>New password</h1><p>Choose a new password for <b class="ink">${esc(session?.user?.email || authFlow.email || '')}</b></p></div><form class="auth-body" novalidate onsubmit="event.preventDefault();saveNewPassword('nwPass')"><div class="panel"><label for="nwPass">New password</label>${pwField('nwPass', 'new-password')}<div class="hint small-hint">At least 8 characters</div></div><button class="btn-wide" type="submit">Save password</button></form></div>`;
}
function authSetup() {
    let has = hasLocalData(), signup = authFlow.purpose === 'signup';
    return `<div class="auth"><div class="auth-top"><span class="pill ok" style="align-self:flex-start">${signup ? 'Email confirmed' : 'Signed in'}</span><h1>You're in!</h1><p>${has ? "Two quick things and you're ready." : "One quick thing and you're ready."}</p></div><div class="auth-body"><div class="panel"><label for="setName">What should we call you?</label><input id="setName" value="${esc(data.settings.userName || '')}" autocomplete="given-name" autocapitalize="words" placeholder="Your name"><div class="hint small-hint">Used for your greeting on the Home screen.</div></div>${has ? `<div class="panel"><div class="row" style="justify-content:flex-start;align-items:flex-start;gap:12px"><span class="tic aqua big-tic">${ic('upload', 22)}</span><div class="grow"><b class="setup-q">Move this phone's data into your account?</b><div class="muted setup-sub">We found <b class="ink">${esc(localSummary())}</b> on this phone.</div></div></div><div class="stack"><button class="btn-wide" onclick="finishSetup('move')">Yes, move it</button><button class="alt" onclick="finishSetup('fresh')">Start fresh instead</button></div></div>` : `<button class="btn-wide" onclick="finishSetup('move')">Continue</button>`}</div></div>`;
}
function authSync() {
    let v = syncView || { mode: 'down', phase: 'done', i: 0, n: 0 }, up = v.mode === 'up', c = countsOf(), done = v.phase === 'done', err = v.phase === 'error', dataDone = up ? done : (v.phase === 'patterns' || done), nm = data.settings.userName;
    const row = (label, val, state) => `<div class="sync-row"><span class="sdot ${state}" aria-hidden="true">${state === 'ok' ? ic('check', 16) : ''}</span><span class="grow">${label}</span><span class="muted">${val}</span></div>`;
    let patState = done ? 'ok' : err ? 'todo' : (up || v.phase === 'patterns') ? 'wait' : 'todo', dState = dataDone ? 'ok' : err ? 'todo' : (up && v.phase === 'patterns') ? 'todo' : 'wait';
    let rows = row('Products &amp; materials', c.products + c.materials, dState) + row('Markets &amp; sales', `${c.markets} · ${c.sales}`, dState) + row('Photos', c.photos, dState) + `<div>${row('Patterns', done ? v.n : `${v.i} of ${v.n}`, v.n ? patState : (done ? 'ok' : patState))}${!done && !err && v.n ? `<div class="bar sync-bar"><div style="width:${Math.round(v.i / Math.max(1, v.n) * 100)}%"></div></div>` : ''}</div>`;
    let title = up ? 'Saving to your account' : `Welcome back${nm ? ', ' + esc(nm) : ''}`, sub = err ? 'Something interrupted the sync.' : done ? (up ? 'Everything is saved to your account.' : 'Everything is on this device.') : (up ? 'Uploading your things…' : 'Getting your things onto this device…');
    return `<div class="auth"><div class="auth-top center slim"><span class="auth-logo sm">${logoSvg()}</span><h1>${title}</h1><p>${sub}</p></div><div class="auth-body"><div class="panel sync-list">${rows}</div>${err ? `<div class="tip warn">${esc(v.error || '')}</div><button class="btn-wide" onclick="retrySyncView()">Try again</button><button class="alt" onclick="finishAuth()">Continue for now</button>` : `${!done && v.n ? `<div class="tip">You can start using the app now. Patterns keep ${up ? 'uploading' : 'downloading'} in the background.</div>` : ''}<div class="grow"></div><button class="btn-wide" onclick="finishAuth()">Go to Home</button>`}</div></div>`;
}
function settingsAccount() {
    let nm = data.settings.userName || '', initial = (nm.trim()[0] || '').toUpperCase();
    let nameRow = `<label for="aName">Your name</label><div class="row"><input id="aName" value="${esc(nm)}" placeholder="e.g. Baylee" autocomplete="given-name" autocapitalize="words" onkeydown="if(event.key==='Enter')saveAccountName()"><button onclick="saveAccountName()">Save</button></div>`;
    let head = `${backBtn()}<h2 style="margin-top:12px">Account</h2>`;
    if (signedIn())
        return `${head}<div class="panel"><div class="row" style="justify-content:flex-start;gap:14px"><span class="avatar" aria-hidden="true">${initial ? esc(initial) : ic('user', 22)}</span><div class="grow" style="min-width:0"><b style="font-family:var(--display);font-weight:400;font-size:20px">${esc(nm || 'Your name')}</b><div class="muted" style="overflow-wrap:anywhere">${esc(session.user.email || '')}</div></div></div>${nameRow}</div><div class="syncstrip" id="syncStatus" role="status">${syncStripInner()}</div><div class="panel menu"><button class="menu-row" onclick="flash('Subscriptions are coming in a future update.')"><span class="tic lav">${ic('star', 18)}</span><span class="grow"><b>Subscription</b></span><span class="chip">Coming soon</span></button>${menuRow('lock', 'Change password', 'Set a new password for signing in', 'openChangePassword()')}${menuRow('logout', 'Sign out', 'Your data stays safe in your account', 'signOut()')}</div><button class="danger btn-wide" onclick="deleteAccount()">Delete account</button><p class="hint" style="text-align:center;margin:8px 6px 0">Deleting permanently removes your account, data, photos and patterns.</p>`;
    let expired = !!syncMeta.userId;
    return `${head}<div class="panel"><div class="row" style="justify-content:flex-start;gap:14px"><span class="avatar" aria-hidden="true">${initial ? esc(initial) : ic('user', 22)}</span><div><b style="font-family:var(--display);font-weight:400;font-size:20px">${esc(nm || 'Your name')}</b><div class="muted">${expired ? 'Signed out' : 'Not signed in · data on this device only'}</div></div></div>${nameRow}</div><div class="panel"><h3>${expired ? 'Sign in again' : 'Sync across devices'}</h3><p class="muted">${expired ? 'You were signed out. Sign in again to keep your devices in sync. Your data is still on this phone.' : 'Create a free account to keep your products, materials, markets, photos and patterns safe in the cloud and on all your devices.'}</p><div class="actions">${expired ? '' : `<button onclick="authFlow={};go('authSignup')">Create account</button>`}<button class="${expired ? '' : 'alt'}" onclick="authFlow={email:lsGet('csLastEmail','')};go('authSignin')">Sign in</button></div></div>`;
}
