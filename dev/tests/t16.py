import json, re, time, uuid, datetime, sys, os
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

APP = 'http://localhost:8774/'
SB = 'https://jrxapujzegvsjgljzxrp.supabase.co'
OUT = os.path.dirname(os.path.abspath(__file__)) + '/shots'
os.makedirs(OUT, exist_ok=True)
results = []
def check(name, ok, extra=''):
    results.append((name, bool(ok)))
    print(('PASS ' if ok else 'FAIL ') + name + (' :: ' + str(extra) if extra and not ok else ''))

# ---------------- mock Supabase ----------------
S = {'users': {}, 'otp': {}, 'tokens': {}, 'rows': {}, 'files': {}, 'calls': []}
def now_pg():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()
def to_pg(ts):
    d = datetime.datetime.fromisoformat(ts.replace('Z', '+00:00'))
    return d.isoformat()
def session_for(uid):
    tok = 'tok-' + uuid.uuid4().hex
    S['tokens'][tok] = uid
    u = next(x for x in S['users'].values() if x['id'] == uid)
    return {'access_token': tok, 'refresh_token': 'ref-' + uid, 'expires_in': 3600,
            'expires_at': int(time.time()) + 3600, 'token_type': 'bearer',
            'user': {'id': uid, 'email': u['email']}}
def handler(route, request):
    url = urlparse(request.url); path = url.path; q = parse_qs(url.query)
    m = request.method
    S['calls'].append((m, path))
    hdr = request.headers
    def j(obj, status=200):
        route.fulfill(status=status, content_type='application/json', body=json.dumps(obj) if obj is not None else '')
    def err(status, code, msg):
        j({'code': status, 'error_code': code, 'msg': msg}, status)
    if hdr.get('apikey') != 'sb_publishable_AV-UcJTr3h_YDD-lzLlJ7A_7MSUOq9a':
        return err(401, 'bad_key', 'bad apikey')
    auth = hdr.get('authorization', '')
    uid = S['tokens'].get(auth[7:]) if auth.startswith('Bearer ') else None
    body = None
    try:
        body = json.loads(request.post_data) if request.post_data and 'json' in (hdr.get('content-type') or '') else None
    except Exception:
        body = None
    if S.get('down'):
        return err(503, 'down', 'Service unavailable')
    if path == '/auth/v1/signup':
        e = body['email']
        if e in S['users'] and S['users'][e]['confirmed']:
            return j({'id': str(uuid.uuid4()), 'email': e, 'identities': []})
        S['users'][e] = {'id': str(uuid.uuid4()), 'email': e, 'password': body['password'], 'confirmed': False}
        S['otp'][e] = '123456'
        return j({'id': S['users'][e]['id'], 'email': e, 'identities': [{'id': 'x'}]})
    if path == '/auth/v1/verify':
        e = body['email']
        if S['otp'].get(e) != body['token']:
            return err(403, 'otp_expired', 'Token has expired or is invalid')
        S['otp'].pop(e); S['users'][e]['confirmed'] = True
        return j(session_for(S['users'][e]['id']))
    if path == '/auth/v1/resend':
        S['otp'][body['email']] = '123456'; return j({})
    if path == '/auth/v1/recover':
        if body['email'] in S['users']: S['otp'][body['email']] = '654321'
        return j({})
    if path == '/auth/v1/token':
        gt = q.get('grant_type', [''])[0]
        if gt == 'password':
            u = S['users'].get(body['email'])
            if not u or u['password'] != body['password']:
                return err(400, 'invalid_credentials', 'Invalid login credentials')
            if not u['confirmed']:
                return err(400, 'email_not_confirmed', 'Email not confirmed')
            return j(session_for(u['id']))
        if gt == 'refresh_token':
            r = body['refresh_token'][4:]
            if not any(u['id'] == r for u in S['users'].values()):
                return err(400, 'refresh_token_not_found', 'Invalid Refresh Token')
            return j(session_for(r))
    if path == '/auth/v1/user':
        if not uid: return err(401, 'no_auth', 'no auth')
        u = next((x for x in S['users'].values() if x['id'] == uid), None)
        if not u: return err(403, 'user_not_found', 'User from sub claim in JWT does not exist')
        if m == 'PUT':
            u['password'] = body['password']
        return j({'id': uid, 'email': u['email']})
    if path == '/auth/v1/logout':
        return route.fulfill(status=204, body='')
    if not uid:
        return err(401, 'PGRST301', 'JWT required')
    if path == '/rest/v1/app_data':
        if m == 'GET':
            want = q['user_id'][0][3:]
            row = S['rows'].get(want) if want == uid else None
            if not row: return j([])
            sel = q['select'][0].split(',')
            return j([{k: row[k] for k in sel}])
        if m == 'POST':
            assert body['user_id'] == uid
            S['rows'][uid] = {'data': body['data'], 'updated_at': to_pg(body['updated_at'])}
            return route.fulfill(status=201, body='')
        if m == 'DELETE':
            S['rows'].pop(uid, None); return route.fulfill(status=204, body='')
    if path == '/rest/v1/rpc/delete_user':
        for k, u in list(S['users'].items()):
            if u['id'] == uid: S['users'].pop(k)
        return route.fulfill(status=204, body='')
    pre = '/storage/v1/object/'
    if path.startswith(pre + 'list/user-files'):
        p = body['prefix']
        return j([{'name': k[len(p):]} for k in S['files'] if k.startswith(p)])
    if path.startswith(pre + 'authenticated/user-files/'):
        k = path[len(pre + 'authenticated/user-files/'):]
        if not k.startswith(uid + '/') or k not in S['files']: return err(404, 'not_found', 'Object not found')
        return route.fulfill(status=200, body=S['files'][k][0], headers={'content-type': S['files'][k][1]})
    if path == pre + 'user-files' and m == 'DELETE':
        for k in body['prefixes']:
            if k.startswith(uid + '/'): S['files'].pop(k, None)
        return j([])
    if path.startswith(pre + 'user-files/') and m == 'POST':
        k = path[len(pre + 'user-files/'):]
        if not k.startswith(uid + '/'): return err(403, 'Unauthorized', 'new row violates row-level security policy')
        S['files'][k] = (request.post_data_buffer, hdr.get('content-type'))
        return j({'Key': 'user-files/' + k})
    return err(404, 'nope', 'unhandled ' + m + ' ' + path)

def new_device(browser, offline=False):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
    ctx.route(SB + '/**', handler)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: print('PAGEERROR', e))
    pg.add_init_script("window.__dlgAuto=null;")
    return ctx, pg

def dlg_text(pg):
    el = pg.query_selector('#appDialog')
    return el.inner_text() if el else ''
def dlg_click(pg, label):
    pg.click(f'#appDialog button:has-text("{label}")'); pg.wait_for_timeout(150)
def shot(pg, name):
    pg.screenshot(path=f'{OUT}/{name}.png', full_page=False)
def wait_screen(pg, s, t=6000):
    pg.wait_for_function(f"document.body.dataset.screen==='{s}'", timeout=t)

with sync_playwright() as p:
    b = p.chromium.launch()
    # ===== Device 1: existing tester with local data =====
    c1, d1 = new_device(b)
    d1.goto(APP); d1.wait_for_timeout(600)
    d1.evaluate("""async()=>{data.products.push({id:'p1',name:'Bunny',variation:'Pink',price:25,stock:3,hours:2,materials:[],photo:'data:image/png;base64,iVBORw0KGgo=',photos:['data:image/png;base64,iVBORw0KGgo=']});data.materials.push({id:'m1',categoryId:'cat_yarn',name:'Bernat Blanket',colour:'Pink',weight:300,unit:'g',price:12});data.settings.userName='Baylee';flushSave();await saveQueue;
      await pdfPut({id:'pat1',name:'Bunny pattern.pdf',date:new Date().toISOString(),mime:'application/pdf',blob:new Blob(['%PDF-1.4 bunny'],{type:'application/pdf'}),thumb:'data:image/png;base64,AAA',thumbTried:true});}""")
    d1.reload(); d1.wait_for_timeout(700)
    check('welcome shows for tester without account choice', d1.evaluate("document.body.dataset.screen")=='authWelcome')
    check('header and nav hidden on welcome', not d1.is_visible('header') and not d1.is_visible('nav'))
    shot(d1, '1-welcome')
    d1.click('text=Continue with Google'); d1.wait_for_timeout(200)
    check('google says coming soon', 'coming soon' in (d1.inner_text('#notice') if d1.query_selector('#notice') else ''))
    d1.click('text=Sign up with email'); wait_screen(d1, 'authSignup')
    d1.click('button:has-text("Create account")'); d1.wait_for_timeout(200)
    check('empty email blocked', 'email' in dlg_text(d1).lower()); dlg_click(d1, 'OK')
    d1.fill('#suEmail', 'Baylee@Example.com'); d1.fill('#suPass', 'short')
    d1.click('button:has-text("Create account")'); d1.wait_for_timeout(200)
    check('short password blocked', '8 characters' in dlg_text(d1)); dlg_click(d1, 'OK')
    d1.fill('#suPass', 'yarnlover22')
    d1.click('#suPass + .pweye')
    check('eye shows password', d1.get_attribute('#suPass','type') == 'text' and d1.get_attribute('#suPass + .pweye','aria-label') == 'Hide password')
    shot(d1, '2-signup')
    d1.click('#suPass + .pweye')
    check('eye hides again', d1.get_attribute('#suPass','type') == 'password')
    d1.press('#suPass', 'Enter'); wait_screen(d1, 'authVerify')
    check('verify shows email', 'baylee@example.com' in d1.inner_text('main'))
    shot(d1, '3-verify')
    d1.click('main button:has-text("Continue")'); d1.wait_for_timeout(500)
    check('continue before confirming warns', "isn't confirmed yet" in dlg_text(d1), dlg_text(d1)); dlg_click(d1, 'OK')
    d1.click('summary:has-text("Got a code instead?")')
    boxes = d1.query_selector_all('#otp input')
    check('six code boxes', len(boxes) == 6)
    d1.click('#otp input[data-i="0"]'); d1.keyboard.type('111111'); d1.wait_for_timeout(500)
    check('wrong code message', 'wrong or has expired' in dlg_text(d1), dlg_text(d1)); dlg_click(d1, 'OK')
    # user taps link in email (mock confirms) and returns
    S['users']['baylee@example.com']['confirmed'] = True
    # the link opens the site in a browser tab
    lt = session_for(S['users']['baylee@example.com']['id'])
    cL, dL = new_device(b)
    dL.goto(APP + '#access_token=' + lt['access_token'] + '&refresh_token=x&expires_in=3600&token_type=bearer&type=signup'); dL.wait_for_timeout(900)
    check('link page says email confirmed', dL.evaluate("document.body.dataset.screen") == 'authLinkDone' and 'Email confirmed' in dL.inner_text('main'))
    check('link page not signed in', not dL.evaluate("signedIn()"))
    shot(dL, '3b-linkdone')
    d1.click('main button:has-text("Continue")'); d1.wait_for_timeout(900)
    wait_screen(d1, 'authSetup')
    check('setup scrolled to top', d1.evaluate('scrollY')==0, d1.evaluate('[scrollY,document.activeElement.tagName,document.documentElement.scrollHeight]'))
    t = d1.inner_text('main')
    check('setup shows move question with counts', 'Move this phone' in t and '1 product' in t and '1 pattern' in t, t)
    check('name prefilled', d1.input_value('#setName') == 'Baylee')
    shot(d1, '4-setup')
    d1.click('button:has-text("Yes, move it")'); d1.wait_for_timeout(1200)
    check('sync screen done (upload)', 'Everything is saved to your account' in d1.inner_text('main'), d1.inner_text('main'))
    shot(d1, '5-upload-done')
    uid1 = next(iter(S['rows']), None)
    row = S['rows'].get(uid1)
    check('cloud row has products', row and row['data']['products'][0]['name'] == 'Bunny')
    check('cloud row has pattern meta', row and row['data']['_patterns'][0]['id'] == 'pat1')
    check('pattern file uploaded', any(k.endswith('/patterns/pat1') for k in S['files']))
    d1.click('button:has-text("Go to Home")'); wait_screen(d1, 'home')
    check('home greets', 'Baylee' in d1.inner_text('main'))
    # account screen
    d1.evaluate("go('settings')"); d1.wait_for_timeout(200)
    check('settings shows email', 'baylee@example.com' in d1.inner_text('main'))
    d1.evaluate("go('settingsAccount')"); d1.wait_for_timeout(300)
    t = d1.inner_text('main')
    check('account screen synced status', 'All synced' in t, t)
    check('account screen buttons', all(x in t for x in ['Subscription', 'Change password', 'Sign out', 'Delete account']))
    shot(d1, '6-account')

    # ===== Device 2: new phone signs in =====
    c2, d2 = new_device(b)
    d2.goto(APP); d2.wait_for_timeout(600)
    d2.click('text=Sign in'); wait_screen(d2, 'authSignin')
    d2.fill('#siEmail', 'baylee@example.com'); d2.fill('#siPass', 'wrongpass1')
    d2.click('button:has-text("Sign in")'); d2.wait_for_timeout(400)
    check('wrong password message', "don't match" in dlg_text(d2)); dlg_click(d2, 'OK')
    d2.fill('#siPass', 'yarnlover22'); shot(d2, '7-signin')
    d2.click('main button[type=submit]'); d2.wait_for_timeout(1500)
    t = d2.inner_text('main')
    check('download screen welcome back', 'Welcome back, Baylee' in t and 'Everything is on this device' in t, t)
    shot(d2, '8-download-done')
    d2.click('button:has-text("Go to Home")'); wait_screen(d2, 'home')
    check('device2 has product', d2.evaluate("data.products.map(p=>p.name).join()") == 'Bunny')
    check('device2 has pattern blob', d2.evaluate("(async()=>{let p=(await pdfAll())[0];return p&&p.name+':'+(await p.blob.text())})()") == 'Bunny pattern.pdf:%PDF-1.4 bunny')
    check('device2 photo synced', d2.evaluate("data.products[0].photos.length") == 1)

    # ===== Change on device 2 syncs to device 1 =====
    d2.evaluate("view('products')"); d2.wait_for_timeout(200)
    d2.click('button[aria-label="Add one Bunny to stock"]'); d2.wait_for_timeout(3800)
    check('device2 change pushed', S['rows'][uid1]['data']['products'][0]['stock'] == 4)
    d1.evaluate("view('home')"); d1.evaluate("syncNow()"); d1.wait_for_timeout(800)
    check('device1 pulled change', d1.evaluate("data.products[0].stock") == 4)
    # pattern added on device1 -> device2
    d1.evaluate("""async()=>{await pdfPut({id:'pat2',name:'Bear.pdf',date:new Date().toISOString(),mime:'application/pdf',blob:new Blob(['%PDF bear'],{type:'application/pdf'}),thumb:'',thumbTried:true});await refreshPdfs()}""")
    d1.wait_for_timeout(3800)
    check('new pattern uploaded', any(k.endswith('/patterns/pat2') for k in S['files']))
    d2.evaluate("syncNow()"); d2.wait_for_timeout(900)
    check('device2 got new pattern', d2.evaluate("(async()=>(await pdfAll()).map(p=>p.id).sort().join())()") == 'pat1,pat2')
    # delete pattern on device2 -> device1
    d2.evaluate("(async()=>{await pdfDelete('pat1');await refreshPdfs()})()"); d2.wait_for_timeout(3800)
    check('deleted pattern removed from cloud', not any(k.endswith('/patterns/pat1') for k in S['files']))
    d1.evaluate("syncNow()"); d1.wait_for_timeout(900)
    check('device1 pattern removed', d1.evaluate("(async()=>(await pdfAll()).map(p=>p.id).join())()") == 'pat2')

    # ===== Offline on device 1 =====
    c1.set_offline(True)
    d1.evaluate("go('settingsAccount')"); d1.wait_for_timeout(200)
    d1.evaluate("data.products[0].price=30;save()"); d1.wait_for_timeout(3800)
    t = d1.inner_text('#syncStatus')
    check('offline status shown', 'Offline' in t or 'Waiting' in t, t)
    check('cloud not yet changed', S['rows'][uid1]['data']['products'][0]['price'] == 25)
    c1.set_offline(False); d1.evaluate("dispatchEvent(new Event('online'))"); d1.wait_for_timeout(900)
    check('synced after reconnect', S['rows'][uid1]['data']['products'][0]['price'] == 30)
    check('status back to synced', 'All synced' in d1.inner_text('#syncStatus'), d1.inner_text('#syncStatus'))
    # server down
    S['down'] = True
    d1.evaluate("data.products[0].price=31;save()"); d1.wait_for_timeout(3800)
    check('error status when cloud down', "Couldn't reach" in d1.inner_text('#syncStatus'), d1.inner_text('#syncStatus'))
    S['down'] = False
    d1.evaluate("syncNow()"); d1.wait_for_timeout(800)
    check('recovers after cloud back', S['rows'][uid1]['data']['products'][0]['price'] == 31)

    # ===== reload keeps signed in, no welcome =====
    d1.reload(); d1.wait_for_timeout(900)
    check('reload goes to home signed in', d1.evaluate("document.body.dataset.screen") == 'home' and d1.evaluate("signedIn()"))

    # ===== change password on device 1 =====
    d1.evaluate("go('settingsAccount')"); d1.wait_for_timeout(200)
    d1.click('text=Change password'); d1.fill('#npw', 'newyarn123'); d1.click('button:has-text("Save password")'); d1.wait_for_timeout(500)
    check('password changed on server', S['users']['baylee@example.com']['password'] == 'newyarn123')

    # ===== sign out device 2 =====
    d2.evaluate("go('settingsAccount')"); d2.wait_for_timeout(300)
    d2.click('text=Sign out'); d2.wait_for_timeout(200)
    check('sign out dialog', 'Sign out?' in dlg_text(d2))
    dlg_click(d2, 'Sign out'); d2.wait_for_timeout(1200)
    check('after sign out welcome', d2.evaluate("document.body.dataset.screen") == 'authWelcome')
    check('local data cleared', d2.evaluate("data.products.length") == 0 and d2.evaluate("(async()=>(await pdfAll()).length)()") == 0)
    # forgot password on device 2
    d2.click('text=Sign in'); wait_screen(d2, 'authSignin')
    check('last email prefilled', d2.input_value('#siEmail') == 'baylee@example.com')
    d2.click('text=Forgot password?'); wait_screen(d2, 'authForgot')
    d2.click('button:has-text("Send code")'); wait_screen(d2, 'authVerify')
    check('recovery verify says tap link', 'choose a new password' in d2.inner_text('main'))
    shot(d2, '9a-recovery-verify')
    # link opens in browser tab -> new password page
    rt = session_for(S['users']['baylee@example.com']['id'])
    cR, dR = new_device(b)
    dR.goto(APP + '#access_token=' + rt['access_token'] + '&refresh_token=x&expires_in=3600&type=recovery'); dR.wait_for_timeout(900)
    check('recovery link opens new password', dR.evaluate("document.body.dataset.screen") == 'authNewPassword')
    shot(dR, '9-newpassword')
    dR.fill('#nwPass', 'brandnew99'); dR.click('button:has-text("Save password")'); dR.wait_for_timeout(800)
    check('reset password saved', S['users']['baylee@example.com']['password'] == 'brandnew99')
    check('password saved page', 'Password saved' in dR.inner_text('main') and not dR.evaluate("signedIn()"))
    d2.click('button:has-text("Back to sign in")'); wait_screen(d2, 'authSignin')
    d2.fill('#siPass', 'brandnew99'); d2.click('main button[type=submit]'); d2.wait_for_timeout(1500)
    check('after reset data downloaded', d2.evaluate("data.products.length") == 1, d2.evaluate("document.body.dataset.screen"))
    d2.click('button:has-text("Go to Home")'); wait_screen(d2, 'home')

    # ===== Device 3: local-only tester, then signs into existing account with own data =====
    c3, d3 = new_device(b)
    d3.goto(APP); d3.wait_for_timeout(600)
    d3.click('text=Continue without an account'); wait_screen(d3, 'home')
    d3.reload(); d3.wait_for_timeout(700)
    check('local-only stays on home after reload', d3.evaluate("document.body.dataset.screen") == 'home')
    d3.evaluate("data.products.push({id:'x1',name:'Frog',price:10,stock:1,hours:1,materials:[]});save()"); d3.wait_for_timeout(200)
    d3.evaluate("go('settings')"); d3.wait_for_timeout(200)
    check('settings row says not signed in', 'Sign in to sync' in d3.inner_text('main'))
    d3.evaluate("go('settingsAccount')"); d3.wait_for_timeout(200)
    shot(d3, '10-account-signed-out')
    d3.click('main button:has-text("Sign in")'); wait_screen(d3, 'authSignin')
    d3.fill('#siEmail', 'baylee@example.com'); d3.fill('#siPass', 'brandnew99'); d3.click('main button[type=submit]'); d3.wait_for_timeout(700)
    check('conflict dialog shown', 'already has data' in dlg_text(d3), dlg_text(d3))
    shot(d3, '11-conflict')
    dlg_click(d3, "Use account's data"); d3.wait_for_timeout(1200)
    check('device3 replaced with account data', d3.evaluate("data.products.map(p=>p.name).join()") == 'Bunny')
    d3.click('button:has-text("Go to Home")')

    # ===== Unconfirmed sign-in path =====
    c4, d4 = new_device(b)
    d4.goto(APP); d4.wait_for_timeout(500)
    d4.click('text=Sign up with email'); d4.fill('#suEmail', 'new@example.com'); d4.fill('#suPass', 'password99'); d4.click('button:has-text("Create account")'); wait_screen(d4, 'authVerify')
    d4.click('button[aria-label=Back]'); d4.wait_for_timeout(300)
    d4.evaluate("authSwap('authSignin')"); d4.fill('#siEmail', 'new@example.com'); d4.fill('#siPass', 'password99'); d4.click('main button[type=submit]'); d4.wait_for_timeout(500)
    check('unconfirmed asked to confirm', 'confirm your email' in dlg_text(d4), dlg_text(d4)); dlg_click(d4, 'OK')
    check('went to verify', d4.evaluate("document.body.dataset.screen") == 'authVerify')
    d4.click('summary:has-text("Got a code instead?")')
    d4.fill('#otp input[data-i="0"]', '123456'); d4.wait_for_timeout(900)
    check('empty phone empty account -> setup (no move q)', d4.evaluate("document.body.dataset.screen") == 'authSetup' and 'Move this' not in d4.inner_text('main'))
    d4.fill('#setName', 'Sam'); d4.click('button:has-text("Continue")'); d4.wait_for_timeout(900)
    uid4 = next(u['id'] for u in S['users'].values() if u['email'] == 'new@example.com')
    check('new account row created with name', S['rows'][uid4]['data']['settings']['userName'] == 'Sam')
    # existing email signup
    d4.click('button:has-text("Go to Home")')

    # ===== Delete account (device 1) =====
    d1.evaluate("go('settingsAccount')"); d1.wait_for_timeout(300)
    d1.click('main button:has-text("Delete account")'); d1.wait_for_timeout(200)
    check('delete dialog', 'permanently deletes' in dlg_text(d1))
    dlg_click(d1, 'Delete account'); d1.wait_for_timeout(1000)
    check('deleted message', 'has been deleted' in dlg_text(d1), dlg_text(d1)); dlg_click(d1, 'OK'); d1.wait_for_timeout(1000)
    check('server user removed', 'baylee@example.com' not in S['users'])
    check('server row removed', uid1 not in S['rows'])
    check('server files removed', not any(k.startswith(uid1) for k in S['files']))
    check('device1 back to welcome & empty', d1.evaluate("document.body.dataset.screen") == 'authWelcome' and d1.evaluate("data.products.length") == 0)
    d3.evaluate("view('home');lastUserCheck=0;syncNow();0"); d3.wait_for_timeout(800)
    check('deleted pop-up on other phone', 'This account was deleted' in dlg_text(d3), dlg_text(d3))
    shot(d3, '13-deleted-popup')
    dlg_click(d3, 'Keep it on this phone'); d3.wait_for_timeout(300)
    check('keep: data kept, local-only', d3.evaluate("data.products.length") == 1 and not d3.evaluate("signedIn()") and d3.evaluate("lsGet('csLocalOnly',false)") == True)
    d3.reload(); d3.wait_for_timeout(800)
    check('keep: reload goes home not welcome', d3.evaluate("document.body.dataset.screen") == 'home')
    d2.evaluate("view('home');lastUserCheck=0;syncNow();0"); d2.wait_for_timeout(800)
    check('deleted pop-up on phone 2', 'This account was deleted' in dlg_text(d2))
    dlg_click(d2, 'Remove it from this phone'); d2.wait_for_timeout(200)
    dlg_click(d2, 'Remove'); d2.wait_for_timeout(1200)
    check('remove: back to welcome and empty', d2.evaluate("document.body.dataset.screen") == 'authWelcome' and d2.evaluate("data.products.length") == 0)

    ca = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block', user_agent='Mozilla/5.0 (Linux; Android 14; SM-S911W) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'); ca.route(SB + '/**', handler)
    da = ca.new_page(); da.goto(APP); da.wait_for_timeout(600)
    check('android welcome shows install', 'Install the app' in da.inner_text('main'))
    shot(da, '14-welcome-android')
    ci = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block', user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'); ci.route(SB + '/**', handler)
    di = ci.new_page(); di.goto(APP); di.wait_for_timeout(600)
    check('iphone welcome shows add to home screen', 'Add to Home Screen' in di.inner_text('main'))
    # home getting-started wording
    di.click('text=Continue without an account'); di.wait_for_timeout(300)
    check('home getting started mentions account', 'Create a free account' in di.inner_text('main'))
    # ===== tablet look =====
    c5 = b.new_context(viewport={'width': 1024, 'height': 1366}, service_workers='block'); c5.route(SB + '/**', handler)
    d5 = c5.new_page(); d5.goto(APP); d5.wait_for_timeout(600); shot(d5, '12-tablet-welcome')
    b.close()

fails = [n for n, ok in results if not ok]
print(f'\n{len(results)-len(fails)}/{len(results)} passed')
for f in fails: print('FAILED:', f)
