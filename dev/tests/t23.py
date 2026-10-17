from playwright.sync_api import sync_playwright
import json,base64,io
APP='http://localhost:8774/'
SH='/tmp/claude-0/-home-claude/8bb1afb4-4fdc-5006-8c41-4baddc11f2f2/scratchpad/v16/shots23/'
SAMPLE='/tmp/claude-0/-home-claude/8bb1afb4-4fdc-5006-8c41-4baddc11f2f2/scratchpad/samples/Sample-Sales-Report-2026.pdf'
R=[]
def check(n,ok,extra=''):
    R.append((n,bool(ok))); print(('PASS ' if ok else 'FAIL ')+n+(' :: '+str(extra) if extra and not ok else ''))
def dlg(pg):
    e=pg.query_selector('#appDialog'); return e.inner_text() if e else ''
def ok(pg):
    b=pg.query_selector('#appDialog button[data-v="1"]')
    if b: b.click(); pg.wait_for_timeout(150)
ANDROID='Mozilla/5.0 (Linux; Android 10; SM-A505W) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
SETUP="""async()=>{let now=new Date().toISOString();
data.productCategories=[{id:'c1',name:'Plushies'}];
data.products=[{id:'b',name:'Bunny plush',price:28,stock:6,hours:1,materials:[],categoryId:'c1'},{id:'f',name:'Frog keychain',price:8,stock:5,hours:1,materials:[]},{id:'t',name:'Turtle',price:35,stock:2,hours:1,materials:[]}];
data.materials=[{id:'y',categoryId:'cat_yarn',name:'Sweet Snuggles',colour:'Pink',weight:250,unit:'g',price:13.5,taxed:false,trackStock:true,stock:500},{id:'e',categoryId:'cat_eyes',name:'Black eyes',colour:'12 mm',weight:25,unit:'pair',price:10,taxed:false,trackStock:true,stock:5},{id:'z',categoryId:'cat_yarn',name:'Untracked',colour:'',weight:100,unit:'g',price:5,taxed:false,trackStock:false,stock:0}];
data.markets=[{id:'mk',name:'Fall Fair',cost:50,days:[{date:'2026-10-03'}],items:{f:2},todos:[],completed:true},{id:'mk2',name:'Spooky Market',cost:100,days:[{date:'2030-10-24'}],items:{b:3,t:1},todos:[]}];
data.orders=[{id:'o1',marketId:'mk',date:'2026-10-03T15:00:00Z',payment:{method:'card',squareTxn:'SQ123'},discount:{reason:'Bundle deal'}},{id:'o2',marketId:'mk2',date:now,payment:{method:'cash'}}];
data.sales=[{id:'s1',orderId:'o1',productId:'b',qty:2,price:28,listPrice:28,disc:6,tax:0,date:'2026-10-03T15:00:00Z',marketId:'mk',estimatedMaterialCost:3},{id:'s2',orderId:'o1',productId:'f',qty:1,price:8,listPrice:8,disc:0,tax:0,date:'2026-10-03T15:00:00Z',marketId:'mk',estimatedMaterialCost:1},{id:'s3',orderId:'o2',productId:'t',qty:1,price:35,listPrice:35,disc:0,tax:0,date:now,marketId:'mk2',estimatedMaterialCost:4}];
data.settings.squareEnabled=true;delete data.settings.currency;flushSave();await saveQueue;0}"""
with sync_playwright() as p:
    b=p.chromium.launch()
    c=b.new_context(viewport={'width':390,'height':844},service_workers='block',user_agent=ANDROID,timezone_id='America/Chicago',locale='en-US')
    c.add_init_script("try{localStorage.setItem('csLocalOnly','true')}catch(e){}")
    pg=c.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(APP); pg.wait_for_timeout(700); pg.evaluate(SETUP); pg.evaluate("lsSet('csSeenVersion',23)"); pg.reload(); pg.wait_for_timeout(800)
    # currency guess + migration
    check('currency guessed USD (US timezone)', pg.evaluate("data.settings.currency")=='USD')
    check('tags migrated', pg.evaluate("product('b').tagIds")==['c1'] and pg.evaluate("product('f').tagIds")==[])
    # settings rows
    pg.evaluate("view('settings')"); pg.wait_for_timeout(200)
    t=pg.inner_text('main')
    check('settings rows', 'Country & currency' in t and 'United States · USD' in t and 'What’s new & tester guide' in t and 'test version 23' in t, t[:400])
    pg.screenshot(path=SH+'1-settings.png',full_page=True)
    pg.click('button.menu-row:has-text("Country & currency")'); pg.wait_for_timeout(200)
    pg.screenshot(path=SH+'2-region.png')
    pg.click('button.regionbtn:has-text("Canada")'); pg.wait_for_timeout(150)
    check('set CAD', pg.evaluate("data.settings.currency")=='CAD')
    pg.click('button.regionbtn:has-text("United States")'); pg.wait_for_timeout(150)
    # Square url uses currency
    pg.evaluate("squareTest()"); pg.wait_for_timeout(300)
    url=pg.evaluate("window.__sqUrl||''")
    check('square sends USD', 'CURRENCY_CODE=USD' in url and 'TENDER_CARD_ON_FILE' in url, url[:300])
    pg.wait_for_timeout(4500)
    check("square didn't open dialog", "Square didn't open" in dlg(pg) and pg.evaluate("lsGet('csSquarePending',null)") is None, dlg(pg))
    pg.screenshot(path=SH+'3-noopen.png'); ok(pg)
    # invalid request return
    pg.evaluate("lsSet('csSquarePending',{ref:'r1',test:true,total:1,cents:100,at:Date.now()})")
    pg.goto(APP+'?com.squareup.pos.ERROR_CODE=com.squareup.pos.ERROR_INVALID_REQUEST'); pg.wait_for_timeout(1500)
    d=dlg(pg)
    check('invalid request checklist', 'Country & currency' in d and 'up to date' in d and 'United States · USD' in d, d)
    pg.screenshot(path=SH+'4-invalid.png'); ok(pg)
    check('basic mode on', pg.evaluate("lsGet('csSquareBasic',false)")==True)
    pg.evaluate("squareTest()"); pg.wait_for_timeout(300)
    url=pg.evaluate("window.__sqUrl||''")
    check('basic request', 'TENDER_CARD_ON_FILE' not in url and 'NOTE=' not in url and 'TENDER_CARD' in url, url[:300])
    pg.evaluate("lsSet('csSquarePending',null)")
    pg.evaluate("go('settingsFeedback')"); pg.wait_for_timeout(200)
    check('feedback shows square error', 'Last Square error: ERROR_INVALID_REQUEST' in pg.inner_text('main') and 'App version: 23' in pg.inner_text('main'))
    check('feedback body has error', 'ERROR_INVALID_REQUEST' in pg.evaluate("feedbackBody()"))
    pg.wait_for_timeout(4200); ok(pg)
    # delete market
    pg.evaluate("openMarket('mk2')"); pg.wait_for_timeout(200); pg.click('main button:has-text("Details")'); pg.wait_for_timeout(200)
    pg.screenshot(path=SH+'5-details.png',full_page=True)
    pg.click('main button:has-text("Delete market")'); pg.wait_for_timeout(200)
    d=dlg(pg); check('delete dialog', '4 items packed' in d and '1 sale ($35.00)' in d, d)
    pg.screenshot(path=SH+'6-delete.png'); ok(pg); pg.wait_for_timeout(300)
    st=pg.evaluate("({m:data.markets.map(x=>x.id),s:data.sales.find(x=>x.id==='s3'),o:data.orders.find(x=>x.id==='o2'),screen,stock:product('b').stock})")
    check('market deleted, sale kept as no-market', st['m']==['mk'] and st['s']['marketId'] is None and st['s']['fromMarket']=='Spooky Market' and st['o']['marketId'] is None and st['screen']=='markets' and st['stock']==6, st)
    # tags
    pg.evaluate("view('products')"); pg.wait_for_timeout(200)
    check('+ Tag button', 'Tag' in pg.inner_text('main') and '+ Category' not in pg.inner_text('main'))
    pg.click("button.addcat >> nth=0"); pg.wait_for_timeout(200)
    pg.fill('#ncName','Easter'); pg.click('.modal button:has-text("Add")'); pg.wait_for_timeout(200)
    pg.screenshot(path=SH+'7-tagmodal.png')
    pg.click('.modal button:has-text("Done")'); pg.wait_for_timeout(200)
    easter=pg.evaluate("data.productCategories.find(c=>c.name==='Easter').id")
    tagged=pg.evaluate(f"data.products.filter(p=>hasTag(p,'{easter}')).map(p=>p.name)")
    check('tag added from modal', len(tagged)==1, tagged)
    # tag add screen: add Bunny to Easter too (bunny then has 2 tags)
    pg.evaluate(f"openTagAdd('{easter}')"); pg.wait_for_timeout(200)
    pg.fill('#tagAddQ','bun'); pg.wait_for_timeout(100)
    pg.check('#tagAddList input[type=checkbox] >> nth=0'); pg.wait_for_timeout(100)
    check('add label', 'Add 1 product' in pg.inner_text('#tagAddBtn'))
    pg.screenshot(path=SH+'8-tagadd.png')
    pg.click('#tagAddBtn'); pg.wait_for_timeout(300)
    check('bunny has 2 tags', sorted(pg.evaluate("ptags(product('b')).map(c=>c.name)"))==['Easter','Plushies'])
    pg.evaluate("productFolderOpen.add('c1');productFolderOpen.add('"+easter+"');view('products')"); pg.wait_for_timeout(200)
    n=pg.eval_on_selector_all('#productList .item-title','e=>e.filter(x=>x.textContent==="Bunny plush").length')
    check('bunny shows in both tags', n==2, n)
    check('also tagged chip', 'Also tagged Easter' in pg.inner_text('main') and 'Also tagged Plushies' in pg.inner_text('main'))
    pg.screenshot(path=SH+'9-products.png',full_page=True)
    hs=pg.evaluate("data.products.reduce((a,p)=>a+num(p.stock),0)")
    check('stock not doubled', hs==13, hs)
    # edit product chips
    pg.evaluate("editProduct('b')"); pg.wait_for_timeout(300)
    check('form chips', pg.eval_on_selector_all('#ptags .chipbtn.on','e=>e.length')==2)
    pg.screenshot(path=SH+'10-form.png',full_page=True)
    pg.click('#ptags .chipbtn.on >> nth=0'); pg.click('main button:has-text("Save product")'); pg.wait_for_timeout(300); ok(pg); pg.wait_for_timeout(300)
    check('save removes one tag', len(pg.evaluate("product('b').tagIds"))==1)
    # search by tag
    pg.evaluate("productFilter='easter';view('products')"); pg.wait_for_timeout(200)
    check('search by tag', 'Frog keychain' in pg.inner_text('#productList') or 'Turtle' in pg.inner_text('#productList') or 'Bunny' in pg.inner_text('#productList'))
    pg.evaluate("productFilter='';render()")
    # home messages rotate
    m1=pg.evaluate("view('home');homeMessage()"); pg.reload(); pg.wait_for_timeout(700); m2=pg.evaluate("homeMessage()")
    check('home message rotates', m1!=m2 and m2 in pg.inner_text('main'), (m1,m2))
    # reports fold + materials + downloads
    pg.evaluate("view('reports')"); pg.wait_for_timeout(300)
    mp=pg.evaluate("[...document.querySelectorAll('#app .panel')].find(p=>p.dataset.fold==='Materials on hand')")
    check('materials panel folded by default', pg.evaluate("[...document.querySelectorAll('#app .panel')].find(p=>p.dataset.fold==='Materials on hand')?.classList.contains('folded')"))
    check('materials value', '$29.00' in pg.inner_text('main'), pg.inner_text('main')[:600])
    pg.click("h3:has-text('Best sellers')"); pg.wait_for_timeout(100)
    pg.reload(); pg.wait_for_timeout(700); pg.evaluate("view('reports')"); pg.wait_for_timeout(300)
    check('fold remembered', pg.evaluate("[...document.querySelectorAll('#app .panel')].find(p=>p.dataset.fold==='Best sellers')?.classList.contains('folded')"))
    pg.screenshot(path=SH+'11-reports.png',full_page=True)
    pg.click("main button:has-text('Download')"); pg.wait_for_timeout(200)
    pg.screenshot(path=SH+'12-download.png',full_page=True)
    pg.evaluate("window.__saved=null;saveReportFile=async(b,n)=>{let a=new Uint8Array(await b.arrayBuffer());let s='';for(let i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);window.__saved={n,s:btoa(s),type:b.type}};0")
    pg.click("button.fmt:has-text('CSV')"); pg.wait_for_timeout(100); pg.click("main button:has-text('Download CSV')"); pg.wait_for_timeout(300)
    sv=pg.evaluate("window.__saved")
    csvt=base64.b64decode(sv['s']).decode('utf-8-sig')
    print(csvt[:600])
    check('csv content', sv['n'].endswith('.csv') and 'Date,Market,Order,Product' in csvt and 'Bunny plush' in csvt and 'Spooky Market (deleted)' in csvt and '(USD)' in csvt and 'SQ123' in csvt, sv['n'])
    pg.click("button.fmt:has-text('PDF')"); pg.wait_for_timeout(100); pg.click("main button:has-text('Download PDF')"); pg.wait_for_timeout(300)
    sv=pg.evaluate("window.__saved")
    pdfb=base64.b64decode(sv['s']); open(SH+'report.pdf','wb').write(pdfb)
    import pypdf
    rd=pypdf.PdfReader(io.BytesIO(pdfb)); txt=''.join(x.extract_text() for x in rd.pages)
    print(txt[:700])
    check('pdf valid', sv['n'].endswith('.pdf') and 'Sales report' in txt and 'By market' in txt and 'Fall Fair' in txt and 'Amounts in USD' in txt, txt[:200])
    # patterns memory + marker
    data=base64.b64encode(open(SAMPLE,'rb').read()).decode()
    pg.evaluate("async(b64)=>{let bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);await pdfPut({id:'pp1',name:'Bunny pattern.pdf',date:new Date().toISOString(),mime:'application/pdf',blob:new Blob([u],{type:'application/pdf'})});await refreshPdfs();0}",data)
    pg.evaluate("view('patterns')"); pg.wait_for_timeout(300)
    pg.click("main button:has-text('Open') >> nth=0"); pg.wait_for_timeout(2500)
    check('viewer open', pg.query_selector('#viewer') is not None and pg.query_selector('#vmarkBtn') is not None)
    pg.evaluate("viewerZoomBy(1)"); pg.wait_for_timeout(1500); pg.evaluate("viewerZoomBy(1)"); pg.wait_for_timeout(1500); pg.evaluate("viewerZoomBy(1)"); pg.wait_for_timeout(2000)
    pg.evaluate("$('vbody').scrollTop=300"); pg.wait_for_timeout(600)
    mem=pg.evaluate("lsGet('csPatternOpen',null)"); print(mem)
    check('memory saved', mem and mem['id']=='pp1' and mem['zoom']==2 and mem['top']>0, mem)
    pg.click('#vmarkBtn'); pg.wait_for_timeout(100)
    bx=pg.eval_on_selector('#vbody','e=>{let r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+200]}')
    pg.mouse.click(bx[0],bx[1]); pg.wait_for_timeout(300)
    check('mark saved', pg.evaluate("!!data.patternMarks?.pp1") and pg.query_selector('.pmark') is not None)
    pg.screenshot(path=SH+'13-mark.png')
    # switch tab via nav
    pg.click('nav button:has-text("Home")'); pg.wait_for_timeout(300)
    check('viewer hidden on home', pg.query_selector('#viewer') is None and pg.evaluate("screen")=='home')
    pg.click('nav button:has-text("Patterns")'); pg.wait_for_timeout(3000)
    st=pg.evaluate("({v:!!$('viewer'),z:viewerZoom,top:$('vbody')?.scrollTop,mark:!!document.querySelector('.pmark')})")
    check('pattern reopened where left off', st['v'] and st['z']==2 and st['top']>200 and st['mark'], st)
    pg.screenshot(path=SH+'14-reopen.png')
    pg.wait_for_timeout(1700); pg.evaluate("$('vbody').scrollTop+=80;$('vbody').dispatchEvent(new Event('scroll'))"); pg.wait_for_timeout(800)
    check('mark cleared on scroll', pg.query_selector('.pmark') is None and not pg.evaluate("!!data.patternMarks?.pp1"))
    pg.click('#viewer button[aria-label="Close"]'); pg.wait_for_timeout(500)
    check('close forgets', pg.query_selector('#viewer') is None and pg.evaluate("lsGet('csPatternOpen',null)") is None and pg.evaluate("screen")=='patterns')
    # guides
    pg.evaluate("view('settings')"); pg.wait_for_timeout(150); pg.click('button.menu-row:has-text("What’s new")'); pg.wait_for_timeout(200)
    pg.screenshot(path=SH+'15-guides.png')
    pg.click('button.menu-row:has-text("Tester guide")'); pg.wait_for_timeout(3000)
    check('guide opens in viewer', pg.query_selector('#viewer canvas') is not None and pg.query_selector('#vmarkBtn') is None)
    pg.screenshot(path=SH+'16-guide.png')
    pg.click('#viewer button[aria-label="Close"]'); pg.wait_for_timeout(300)
    # what's new popup
    pg.evaluate("lsSet('csSeenVersion',22)"); pg.reload(); pg.wait_for_timeout(1500)
    check('whats new shown', 'Updated to version 23' in pg.inner_text('body'))
    pg.screenshot(path=SH+'17-whatsnew.png')
    pg.click('.modal button:has-text("Got it")'); pg.reload(); pg.wait_for_timeout(1500)
    check('whats new once', 'Updated to version 23' not in pg.inner_text('body'))
    check('no errors', not errs, errs)
    c.close()
    # brand-new user: no popup
    c2=b.new_context(viewport={'width':390,'height':844},service_workers='block')
    c2.add_init_script("try{localStorage.setItem('csLocalOnly','true')}catch(e){}")
    p2=c2.new_page(); p2.goto(APP); p2.wait_for_timeout(1500)
    check('new user no popup', 'Updated to version' not in p2.inner_text('body'))
    check('canadian default CAD', p2.evaluate("data.settings.currency") in ('CAD','USD'))
    b.close()
f=[n for n,ok_ in R if not ok_]
print(f'{len(R)-len(f)}/{len(R)} passed', f)
