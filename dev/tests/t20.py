from playwright.sync_api import sync_playwright
APP='http://localhost:8774/'
R=[]
def check(n,ok,extra=''):
    R.append((n,bool(ok))); print(('PASS ' if ok else 'FAIL ')+n+(' :: '+str(extra) if extra and not ok else ''))
def dlg(pg):
    e=pg.query_selector('#appDialog'); return e.inner_text() if e else ''
ANDROID='Mozilla/5.0 (Linux; Android 14; SM-S911W) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
SETUP="""async()=>{data.products=[{id:'b',name:'Bunny plush',price:25,stock:5,hours:2,materials:[]},{id:'f',name:'Frog keychain',price:8,stock:5,hours:1,materials:[]}];data.markets=[{id:'mk',name:'Fall Fair',cost:0,days:[{date:'2030-10-10'}],items:{b:2},todos:[]}];data.sales=[];data.orders=[];data.settings.squareEnabled=true;flushSave();await saveQueue}"""
with sync_playwright() as p:
    b=p.chromium.launch()
    c=b.new_context(viewport={'width':390,'height':844},service_workers='block',user_agent=ANDROID)
    c.add_init_script("try{localStorage.setItem('csLocalOnly','true')}catch(e){}")
    app=c.new_page(); errs=[]; app.on('pageerror',lambda e:errs.append(str(e)))
    app.add_init_script("Object.defineProperty(navigator,'standalone',{get:()=>true})")
    app.goto(APP); app.wait_for_timeout(600); app.evaluate(SETUP); app.reload(); app.wait_for_timeout(700)
    # quick sale with square in the installed app
    app.click('button.quicksell'); app.wait_for_timeout(200)
    app.click('button[aria-label="One more Bunny plush"]'); app.click('button[aria-label="One more Bunny plush"]'); app.wait_for_timeout(100)
    app.click('#quickBox button:has-text("Review sale")'); app.wait_for_timeout(150)
    app.click('button.paybtn:has-text("Card")')
    try: app.click('main button:has-text("Charge")',timeout=3000)
    except Exception: pass
    app.wait_for_timeout(300)
    check('app waiting for square', app.evaluate("!!lsGet('csSquarePending',null) && marketSaleMode"))
    # Square returns into a browser tab instead
    tab=c.new_page(); tab.on('pageerror',lambda e:errs.append('TAB '+str(e)))
    tab.goto(APP+'?com.squareup.pos.SERVER_TRANSACTION_ID=SRV1&com.squareup.pos.CLIENT_TRANSACTION_ID=C1'); tab.wait_for_timeout(1200)
    check('tab saved sale', tab.evaluate("data.orders.length")==1)
    check('tab says go back to app', 'close this browser tab and go back to the app' in dlg(tab), dlg(tab))
    tab.screenshot(path='/tmp/claude-0/-home-claude/8bb1afb4-4fdc-5006-8c41-4baddc11f2f2/scratchpad/v16/shots19/5-tab.png')
    app.bring_to_front(); app.wait_for_timeout(800)
    st=app.evaluate("({n:data.orders.length,screen,mode:marketSaleMode,draft:marketSaleDraft,b:product('b').stock,mi:data.markets[0].items})")
    check('app picked up sale from tab', st['n']==1 and st['b']==3, st)
    check('app sale reset to fresh quick sale', st['screen']=='quickSale' and not st['draft'], st)
    check('app trimmed market packing', st['mi'].get('b')==2 or st['mi'].get('b') is None, st)
    check('app toast', 'Card payment approved · $50.00' in app.inner_text('main'))
    check('app no "did it go through" question', 'Did the Square' not in dlg(app))
    # app makes another change; must not wipe the sale
    app.evaluate("product('f').stock=9;save()"); app.wait_for_timeout(400)
    tab.close(); t2=c.new_page(); t2.goto(APP); t2.wait_for_timeout(700)
    check('sale survives later app save', t2.evaluate("data.orders.length")==1 and t2.evaluate("product('f').stock")==9)
    # tab edits -> app updates live
    t2.evaluate("product('b').name='Bunny XL';save()"); t2.wait_for_timeout(300)
    app.bring_to_front(); app.wait_for_timeout(500)
    check('app reloads other-tab edit', app.evaluate("product('b').name")=='Bunny XL')
    # cancel case in tab: app keeps sale open
    app.click('button[aria-label="One more Frog keychain"]'); app.click('#quickBox button:has-text("Review sale")'); app.wait_for_timeout(150)
    app.click('button.paybtn:has-text("Card")')
    try: app.click('main button:has-text("Charge")',timeout=3000)
    except Exception: pass
    app.wait_for_timeout(300)
    t3=c.new_page(); t3.goto(APP+'?com.squareup.pos.ERROR_CODE=com.squareup.pos.ERROR_TRANSACTION_CANCELED'); t3.wait_for_timeout(1000)
    check('tab cancel message mentions app', 'go back to it' in dlg(t3), dlg(t3))
    app.bring_to_front(); app.wait_for_timeout(2200)
    st=app.evaluate("({n:data.orders.length,screen,mode:marketSaleMode,draft:marketSaleDraft})")
    check('app keeps sale open after cancel', st['n']==1 and st['mode'] and st['draft']=={'f':1} and st['screen']=='saleReview', st)
    check('no errors', not errs, errs)
    b.close()
f=[n for n,ok in R if not ok]
print(f'\n{len(R)-len(f)}/{len(R)} passed'); [print('FAILED:',x) for x in f]
