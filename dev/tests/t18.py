import os, json
from playwright.sync_api import sync_playwright
APP='http://localhost:8774/'
OUT=os.path.dirname(os.path.abspath(__file__))+'/shots18'; os.makedirs(OUT,exist_ok=True)
R=[]
def check(n,ok,extra=''):
    R.append((n,bool(ok))); print(('PASS ' if ok else 'FAIL ')+n+(' :: '+str(extra) if extra and not ok else ''))
def dlg(pg):
    e=pg.query_selector('#appDialog'); return e.inner_text() if e else ''
def dclick(pg,label): pg.click(f'#appDialog button:has-text("{label}")'); pg.wait_for_timeout(200)
def shot(pg,n): pg.screenshot(path=f'{OUT}/{n}.png')
ANDROID='Mozilla/5.0 (Linux; Android 14; SM-S911W) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
SETUP="""async()=>{data.products=[{id:'b',name:'Bunny plush',price:25,stock:5,hours:2,materials:[]},{id:'r',name:'Bear plush',price:30,stock:3,hours:2,materials:[]},{id:'f',name:'Frog keychain',price:8,stock:5,hours:1,materials:[]}];data.markets=[{id:'mk',name:'Fall Craft Fair',cost:50,days:[{date:'2026-10-10'}],items:{b:3,r:2,f:2},todos:[]}];data.sales=[];data.orders=[];data.settings.taxOnSales=false;flushSave();await saveQueue}"""
def ctx(b,ua=None):
    c=b.new_context(viewport={'width':390,'height':844},service_workers='block',user_agent=ua) if ua else b.new_context(viewport={'width':390,'height':844},service_workers='block')
    c.add_init_script("try{localStorage.setItem('csLocalOnly','true')}catch(e){};Object.defineProperty(navigator,'standalone',{get:()=>true})")
    pg=c.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.errs=errs
    pg.goto(APP); pg.wait_for_timeout(600); pg.evaluate(SETUP); pg.reload(); pg.wait_for_timeout(600)
    return c,pg
def start_sale(pg,items):
    pg.evaluate("openMarket('mk')"); pg.wait_for_timeout(200)
    pg.click('button:has-text("Start a sale")'); pg.wait_for_timeout(150)
    for pid,n in items:
        for _ in range(n): pg.evaluate(f"adjustMarketSale('{pid}',1)")
    pg.wait_for_timeout(150)

with sync_playwright() as p:
    b=p.chromium.launch()
    c,pg=ctx(b)
    start_sale(pg,[('b',2),('r',1)])
    t=pg.inner_text('.salebox')
    check('sale panel subtotal 80', '$80.00' in t and '3 items' in t, t)
    shot(pg,'1-sale')
    # discount: set total 70 bundle
    pg.click('.salebox button:has-text("Discount / deal")'); pg.wait_for_timeout(200)
    check('discount sheet open', 'Discount this sale' in pg.inner_text('#modal'))
    pg.click('#modal button:has-text("Apply discount")'); pg.wait_for_timeout(200)
    check('empty discount blocked', 'Enter the price' in dlg(pg), dlg(pg)); dclick(pg,'OK')
    pg.fill('#discVal','90'); pg.wait_for_timeout(100)
    check('warns if not a discount', 'isn’t a discount' in pg.inner_text('#discPreview'))
    pg.fill('#discVal','70'); pg.click('#modal button:has-text("Bundle deal")'); pg.wait_for_timeout(150)
    check('chip selection keeps value', pg.input_value('#discVal')=='70')
    check('preview shows 12.5%', '12.5% off' in pg.inner_text('#discPreview') and '$70.00' in pg.inner_text('#discPreview'), pg.inner_text('#discPreview'))
    shot(pg,'2-discount')
    pg.click('#modal button:has-text("Apply discount")'); pg.wait_for_timeout(200)
    t=pg.inner_text('.salebox')
    check('panel shows discount and total 70', 'Bundle deal (12.5% off)' in t and '−$10.00' in t and '$70.00' in t, t)
    # % off mode check
    pg.click('.salebox button:has-text("Edit discount")'); pg.wait_for_timeout(150)
    check('edit keeps type/value', pg.input_value('#discVal')=='70')
    pg.click('#modal .seg button:has-text("% off")'); pg.click('#modal button.chipbtn:has-text("10%")'); pg.wait_for_timeout(100)
    check('10% preview', '−$8.00' in pg.inner_text('#discPreview'), pg.inner_text('#discPreview'))
    pg.click('#modal .seg button:has-text("Set total")'); pg.fill('#discVal','70'); pg.click('#modal button.chipbtn:has-text("Bundle deal")'); pg.click('#modal button:has-text("Apply discount")'); pg.wait_for_timeout(150)
    # price change on Bear -> 24 seconds
    pg.click('.salebox button:has-text("Change a price")'); pg.wait_for_timeout(150)
    pg.click('#modal .pick:has-text("Bear plush")'); pg.fill('#pxVal','24'); pg.wait_for_timeout(50)
    check('price preview 20% off', '$6.00 off (20%)' in pg.inner_text('#pxPreview'), pg.inner_text('#pxPreview'))
    pg.click('#modal button.chipbtn:has-text("Seconds / flaw")'); pg.wait_for_timeout(100)
    check('price kept after chip', pg.input_value('#pxVal')=='24')
    shot(pg,'3-price')
    pg.click('#modal button:has-text("Save price")'); pg.wait_for_timeout(150)
    t=pg.inner_text('.salebox')
    check('subtotal after price change 74, total 70', '$74.00' in t and '−$4.00' in t and '$70.00' in t and '1 price changed' in t, t)
    pg.click('.salebox button:has-text("Review sale")'); pg.wait_for_timeout(250)
    t=pg.inner_text('main')
    check('review lists strike price & reason', 'Seconds / flaw · $24.00 each' in t and '$30.00' in t, t)
    pg.fill('#cashGiven','80'); pg.wait_for_timeout(50)
    check('change due 10', 'Change' in pg.inner_text('#changeDue') and '$10.00' in pg.inner_text('#changeDue'))
    shot(pg,'4-review')
    pg.click('main button:has-text("Complete sale")'); pg.wait_for_timeout(600)
    st=pg.evaluate("({screen,orders:data.orders.length,lines:data.sales.length,rev:data.sales.reduce((a,x)=>a+lineRev(x),0),disc:data.sales.reduce((a,x)=>a+num(x.disc),0),b:product('b').stock,r:product('r').stock,mi:data.markets[0].items,pay:data.orders[0]?.payment})")
    check('sale saved as one order with 2 lines', st['orders']==1 and st['lines']==2, st)
    check('revenue 70 and discount allocated 4', abs(st['rev']-70)<0.001 and abs(st['disc']-4)<0.001, st)
    check('stock reduced', st['b']==3 and st['r']==2 and st['mi']=={'b':1,'r':1,'f':2}, st)
    check('payment cash with given', st['pay']=={'method':'cash','cashGiven':80}, st)
    check('back on market screen', st['screen']=='marketDetail', st)
    check('notice shown', 'Sale completed · $70.00' in pg.inner_text('main'))
    check('sale mode closed', not pg.query_selector('.salebox'))
    # second sale plain e-transfer
    start_sale(pg,[('f',2)]); pg.click('.salebox button:has-text("Review sale")'); pg.wait_for_timeout(200)
    pg.click('button.paybtn:has-text("E-transfer")'); pg.click('main button:has-text("Complete sale")'); pg.wait_for_timeout(500)
    # sales list
    check('sales link on market', '2 sales' in pg.inner_text('.saleslink') and '$86.00' in pg.inner_text('.saleslink'), pg.inner_text('.saleslink'))
    pg.click('button.saleslink'); pg.wait_for_timeout(250)
    t=pg.inner_text('main')
    check('sales list tiles', '$96.00' in t and '−$10.00' in t and '$86.00' in t, t)
    check('sales list pills', 'Bundle deal −$4.00' in t and 'Seconds / flaw −$6.00' in t, t)
    shot(pg,'5-saleslist')
    pg.click('button.salerow:has-text("Cash")'); pg.wait_for_timeout(250)
    check('sale edit screen', 'Delete this sale' in pg.inner_text('main'))
    pg.click('button.paybtn:has-text("Card")'); pg.wait_for_timeout(150)
    check('payment changed to card', pg.evaluate("data.orders.find(o=>o.subtotal===74).payment.method")=='card')
    pg.click('main button:has-text("Edit discount")'); pg.wait_for_timeout(150)
    pg.click('#modal button:has-text("Remove discount")'); pg.wait_for_timeout(200)
    o=pg.evaluate("data.orders.find(o=>o.subtotal===74)")
    check('discount removed recomputed total 74', o['total']==74 and o['discount'] is None, o)
    pg.click('main .iconbtn[aria-label^="Change price of Bear"]'); pg.wait_for_timeout(150)
    pg.click('#modal button:has-text("Back to regular price")'); pg.wait_for_timeout(200)
    o=pg.evaluate("data.orders.find(o=>o.payment.method==='card')")
    check('price reset total 80', o['total']==80, o)
    shot(pg,'6-saleedit')
    pg.click('main button:has-text("Delete this sale")'); pg.wait_for_timeout(150)
    dclick(pg,'Delete sale'); pg.wait_for_timeout(500)
    st=pg.evaluate("({screen,orders:data.orders.length,b:product('b').stock,r:product('r').stock,mi:data.markets[0].items})")
    check('deleted sale restores stock & market items', st['orders']==1 and st['b']==5 and st['r']==3 and st['mi'].get('b')==3 and st['mi'].get('r')==2, st)
    check('back to sales list after delete', st['screen']=='marketSales', st)
    # legacy sale converts on edit
    pg.evaluate("data.sales.push({id:'old1',marketId:'mk',productId:'b',qty:1,price:25,tax:0,date:'2026-10-10T15:00:00Z',estimatedMaterialCost:0});save();render()"); pg.wait_for_timeout(150)
    pg.click('button.salerow:has-text("Bunny plush")'); pg.wait_for_timeout(200)
    pg.click('button.paybtn:has-text("Cash")'); pg.wait_for_timeout(150)
    check('legacy sale converted to order', pg.evaluate("!!data.sales.find(x=>x.id==='old1').orderId && data.orders.length===2"))
    # reports
    pg.evaluate("history.back()"); pg.wait_for_timeout(200)
    pg.evaluate("completeMarket('mk');0"); pg.wait_for_timeout(150); dclick(pg,'Mark completed'); pg.wait_for_timeout(200)
    # add discounted sale record to completed market for reports
    pg.evaluate("""(()=>{let oid='o9';data.orders.push({id:oid,marketId:'mk',date:'2026-10-10T16:00:00Z',discount:{type:'pct',value:10,reason:'Repeat customer',amount:5},payment:{method:'card',via:'square',squareTxn:'TX1'}});data.sales.push({id:'s9',orderId:oid,marketId:'mk',productId:'b',qty:2,listPrice:25,price:25,disc:5,tax:0,date:'2026-10-10T16:00:00Z',estimatedMaterialCost:0});save()})()""")
    pg.evaluate("view('reports')"); pg.wait_for_timeout(250)
    t=pg.inner_text('main')
    check('reports discounts panel', 'Discounts given' in t and 'Repeat customer' in t and '−$5.00' in t, t[:900])
    check('reports payments panel', 'How customers paid' in t and 'E-transfer' in t and 'Card' in t, t[:1500])
    check('revenue uses discounts', 'Profit = sales after discounts' in t)
    shot(pg,'7-reports'); pg.evaluate("scrollTo(0,600)"); pg.wait_for_timeout(100); shot(pg,'7b-reports')
    check('no page errors (desktop)', not pg.errs, pg.errs)
    c.close()

    # ===== Square on Android =====
    c,pg=ctx(b,ANDROID)
    pg.evaluate("view('settings')"); pg.wait_for_timeout(150)
    check('settings payments row', 'Payments' in pg.inner_text('main'))
    pg.click('.menu-row:has-text("Payments")'); pg.wait_for_timeout(150)
    pg.check('#sqOn'); pg.wait_for_timeout(150)
    check('square settings tips', 'Test Square with $1.00' in pg.inner_text('main'))
    shot(pg,'8-payments')
    start_sale(pg,[('b',2),('r',1)])
    pg.evaluate("saleAdj.discount={type:'total',value:70,reason:'Bundle deal'};render()")
    pg.click('.salebox button:has-text("Review sale")'); pg.wait_for_timeout(200)
    pg.click('button.paybtn:has-text("Card")'); pg.wait_for_timeout(100)
    check('charge with square button', 'Charge $70.00 with Square' in pg.inner_text('main'))
    shot(pg,'9-square-review')
    pg.route('**/*', lambda r: r.continue_())
    try: pg.click('main button:has-text("Charge")', timeout=3000)
    except Exception as e: print('click note',e)
    pg.wait_for_timeout(400)
    u=pg.evaluate("window.__sqUrl||''")
    check('android intent url', u.startswith('intent:#Intent;action=com.squareup.pos.action.CHARGE;package=com.squareup;') and 'i.com.squareup.pos.TOTAL_AMOUNT=7000' in u and 'CURRENCY_CODE=CAD' in u and 'CLIENT_ID=sq0idp-J4UrXdHeSOnFaEtvwuO2HQ' in u and u.endswith(';end'), u)
    check('callback is site root', 'WEB_CALLBACK_URI='+'http%3A%2F%2Flocalhost%3A8774%2F' in u, u)
    check('pending saved', pg.evaluate("!!lsGet('csSquarePending',null)"))
    check('no sale recorded yet', pg.evaluate("data.orders.length")==0)
    # simulate Square returning success
    pg.goto(APP+'?com.squareup.pos.SERVER_TRANSACTION_ID=SRV123&com.squareup.pos.CLIENT_TRANSACTION_ID=CLI9&com.squareup.pos.REQUEST_METADATA=x'); pg.wait_for_timeout(900)
    st=pg.evaluate("({screen,url:location.search,n:data.orders.length,pay:data.orders[0]?.payment,total:data.orders[0]?.total,pend:lsGet('csSquarePending',null),b:product('b').stock})")
    check('square success saves sale', st['n']==1 and st['pay']['via']=='square' and st['pay']['squareTxn']=='SRV123' and st['total']==70 and st['b']==3, st)
    check('url cleaned & pending cleared', st['url']=='' and st['pend'] is None and st['screen']=='marketDetail', st)
    check('approved toast', 'Card payment approved · $70.00' in pg.inner_text('main'))
    shot(pg,'10-square-done')
    # cancel path
    start_sale(pg,[('f',1)]); pg.click('.salebox button:has-text("Review sale")'); pg.wait_for_timeout(150)
    pg.click('button.paybtn:has-text("Card")')
    try: pg.click('main button:has-text("Charge")', timeout=3000)
    except Exception as e: pass
    pg.wait_for_timeout(300)
    pg.goto(APP+'?com.squareup.pos.ERROR_CODE=com.squareup.pos.ERROR_TRANSACTION_CANCELED&com.squareup.pos.ERROR_DESCRIPTION=cancelled'); pg.wait_for_timeout(1000)
    check('cancel message', 'cancelled' in dlg(pg), dlg(pg)); dclick(pg,'OK')
    st=pg.evaluate("({screen,mode:marketSaleMode,draft:marketSaleDraft,n:data.orders.length,m:payTmp.method})")
    check('cancel restores sale on review', st['screen']=='saleReview' and st['mode'] and st['draft']=={'f':1} and st['n']==1 and st['m']=='card', st)
    # fallback: no callback, user returns -> asks
    try: pg.click('main button:has-text("Charge")', timeout=3000)
    except Exception as e: pass
    pg.wait_for_timeout(200)
    pg.evaluate("(()=>{let p=lsGet('csSquarePending',null);p.at=Date.now()-10000;lsSet('csSquarePending',p);checkSquarePending()})()"); pg.wait_for_timeout(300)
    check('asks if paid', 'Did the Square payment go through?' in dlg(pg), dlg(pg))
    shot(pg,'11-ask')
    dclick(pg,'Yes, it was paid'); pg.wait_for_timeout(400)
    st=pg.evaluate("({n:data.orders.length,pay:data.orders[1]?.payment})")
    check('manual confirm saves', st['n']==2 and st['pay']['confirmedManually'] is True, st)
    # no-app fallback
    start_sale(pg,[('f',1)]); pg.click('.salebox button:has-text("Review sale")'); pg.wait_for_timeout(150); pg.click('button.paybtn:has-text("Card")')
    try: pg.click('main button:has-text("Charge")', timeout=3000)
    except Exception: pass
    pg.wait_for_timeout(200); pg.goto(APP+'?square=noapp'); pg.wait_for_timeout(1000)
    check('no app message', "isn't installed" in dlg(pg), dlg(pg)); dclick(pg,'OK')
    check('no app keeps sale open', pg.evaluate("screen")=='saleReview')
    # test button
    pg.evaluate("view('settings')"); pg.click('.menu-row:has-text("Payments")'); pg.wait_for_timeout(100)
    try: pg.click('main button:has-text("Test Square")', timeout=3000)
    except Exception: pass
    pg.wait_for_timeout(200)
    check('test url 100 cents', 'TOTAL_AMOUNT=100;' in pg.evaluate("window.__sqUrl||''"))
    pg.goto(APP+'?com.squareup.pos.SERVER_TRANSACTION_ID=T1&com.squareup.pos.CLIENT_TRANSACTION_ID=C1'); pg.wait_for_timeout(900)
    check('test success message, no sale', 'Square test worked' in dlg(pg) and pg.evaluate("data.orders.length")==2, dlg(pg))
    check('no page errors (android)', not pg.errs, pg.errs)
    c.close()

    # ===== iPhone =====
    c,pg=ctx(b,IPHONE)
    pg.evaluate("data.settings.squareEnabled=true;save()")
    start_sale(pg,[('b',1)]); pg.click('.salebox button:has-text("Review sale")'); pg.wait_for_timeout(150); pg.click('button.paybtn:has-text("Card")')
    try: pg.click('main button:has-text("Charge")', timeout=3000)
    except Exception: pass
    pg.wait_for_timeout(300)
    u=pg.evaluate("window.__sqUrl||''")
    ok=u.startswith('square-commerce-v1://payment/create?data=')
    j=json.loads(__import__('urllib.parse').parse.unquote(u.split('data=',1)[1])) if ok else {}
    check('ios url & json', ok and j.get('amount_money')=={'amount':2500,'currency_code':'CAD'} and j['options']['clear_default_fees'] is True and j['client_id']=='sq0idp-J4UrXdHeSOnFaEtvwuO2HQ' and j['version']=='1.3', u[:200])
    pg.goto(APP+'?data='+__import__('urllib.parse').parse.quote(json.dumps({'status':'ok','transaction_id':'IOS1','client_transaction_id':'c'}))); pg.wait_for_timeout(900)
    check('ios callback saves', pg.evaluate("data.orders[0]?.payment?.squareTxn")=='IOS1')
    # ios callback in safari w/o pending
    c2=b.new_context(viewport={'width':390,'height':844},service_workers='block',user_agent=IPHONE); c2.add_init_script("try{localStorage.setItem('csLocalOnly','true')}catch(e){}")
    p2=c2.new_page(); p2.goto(APP+'?data='+__import__('urllib.parse').parse.quote(json.dumps({'status':'ok','transaction_id':'IOS2'}))); p2.wait_for_timeout(1200)
    check('safari without pending tells user to go back', 'Go back to the Crochet Studio app' in dlg(p2), dlg(p2))
    check('no page errors (ios)', not pg.errs, pg.errs)
    b.close()
f=[n for n,ok in R if not ok]
print(f'\n{len(R)-len(f)}/{len(R)} passed'); [print('FAILED:',x) for x in f]
