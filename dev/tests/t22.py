from playwright.sync_api import sync_playwright
APP='http://localhost:8774/'
X='/tmp/claude-0/-home-claude/8bb1afb4-4fdc-5006-8c41-4baddc11f2f2/scratchpad/xlsx/p.xlsx'
PIC='/tmp/claude-0/-home-claude/8bb1afb4-4fdc-5006-8c41-4baddc11f2f2/scratchpad/xlsx/pic.jpg'
SH='/tmp/claude-0/-home-claude/8bb1afb4-4fdc-5006-8c41-4baddc11f2f2/scratchpad/v16/shots22/'
R=[]
def check(n,ok,extra=''):
    R.append((n,bool(ok))); print(('PASS ' if ok else 'FAIL ')+n+(' :: '+str(extra) if extra and not ok else ''))
def dlg(pg):
    e=pg.query_selector('#appDialog'); return e.inner_text() if e else ''
def pick(pg,click_sel):
    with pg.expect_file_chooser() as fc: pg.click(click_sel)
    fc.value.set_files(PIC); pg.wait_for_timeout(700)
with sync_playwright() as p:
    b=p.chromium.launch()
    c=b.new_context(viewport={'width':390,'height':844},service_workers='block')
    c.add_init_script("try{localStorage.setItem('csLocalOnly','true')}catch(e){}")
    pg=c.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(APP); pg.wait_for_timeout(700)
    pg.evaluate("async()=>{data.products=[];data.materials=[];flushSave();await saveQueue;0}")
    pg.evaluate("view('settings')"); pg.click('button.menu-row:has-text("Import from spreadsheet")'); pg.wait_for_timeout(150)
    pg.set_input_files('#importFile',X); pg.wait_for_timeout(1500)
    pg.screenshot(path=SH+'1-review.png',full_page=True)
    pg.click('main button:has-text("Add ")'); pg.wait_for_timeout(300)
    eyes=pg.evaluate("data.materials.filter(m=>m.categoryId==='cat_eyes').map(m=>[m.name,m.colour])")
    names=sorted(set(n for n,_ in eyes))
    print(names)
    check('eyes grouped into types', len(eyes)==41 and len(names)<20, (len(eyes),len(names)))
    check('glitter sizes', sorted(c for n,c in eyes if n=='Glitter eyes')==sorted(['35 mm','25 mm','16 mm','14 mm','12 mm','10 mm']), [e for e in eyes if 'litter' in e[0]])
    check('felt stays own type', ['Felt',''] in eyes)
    lk=pg.evaluate("(()=>{let p=data.products.find(x=>x.name==='Small bee'),m=p.materials.map(l=>material(l.materialId)).find(m=>m.categoryId==='cat_eyes');return [m.name,m.colour,m.price,m.weight]})()")
    check('small bee linked to 30 mm holographic', lk==['Holographic eyes','30 mm',10.88,8], lk)
    check('cost still matches sheet', abs(pg.evaluate("recipeCost(data.products.find(x=>x.name==='Small bee'))")-4.7109)<0.01)
    # reimport -> nothing new
    pg.evaluate("view('settings')"); pg.click('button.menu-row:has-text("Import from spreadsheet")'); pg.wait_for_timeout(150)
    pg.set_input_files('#importFile',X); pg.wait_for_timeout(1500)
    check('reimport nothing new', 'already in your app' in dlg(pg), dlg(pg)); pg.click('#appDialog button[data-v="1"]')
    # materials eyes view
    pg.evaluate("view('materials');materialCatId='cat_eyes';render()"); pg.wait_for_timeout(200)
    pg.screenshot(path=SH+'2-eyes.png',full_page=True)
    # group photo on Glitter eyes
    idx=pg.evaluate("matGroupInfo.findIndex(g=>g.name==='Glitter eyes')")
    pick(pg,f".folder >> nth={idx} >> .thumb-add")
    st=pg.evaluate("({ph:data.materials.filter(m=>m.name==='Glitter eyes').every(m=>m.photo&&m.photos.length===1),open:matGroupOpen.size})")
    check('group photo added to all sizes, folder not toggled', st['ph'] and st['open']==0, st)
    # variation card photo
    pg.click(".folder-head:has-text('Black eyes')"); pg.wait_for_timeout(200)
    n0=pg.evaluate("data.materials.filter(m=>m.name==='Black eyes'&&m.photo).length")
    pick(pg,".matcard .thumb-add >> nth=0")
    check('single variation photo', pg.evaluate("data.materials.filter(m=>m.name==='Black eyes'&&m.photo).length")==n0+1)
    pg.screenshot(path=SH+'3-eyes-photo.png',full_page=True)
    # product card photo
    pg.evaluate("view('products')"); pg.wait_for_timeout(200)
    pg.screenshot(path=SH+'4-products.png',full_page=True)
    pick(pg,".panel.item:has-text('Turtle') .thumb-add")
    check('product card photo', pg.evaluate("!!data.products.find(x=>x.name==='Turtle').photo") and pg.evaluate("screen")=='products')
    check('card now shows image', pg.query_selector(".panel.item:has-text('Turtle') img.thumb") is not None)
    # detail photo
    pid=pg.evaluate("data.products.find(x=>x.name==='snakes').id")
    pg.evaluate(f"detail('{pid}')"); pg.wait_for_timeout(200)
    pick(pg,"main .thumb-add")
    check('detail photo', pg.evaluate(f"product('{pid}').photos.length")==1 and pg.evaluate("screen")=='productDetail')
    pg.screenshot(path=SH+'5-detail.png')
    # sort
    pg.evaluate("view('products')"); pg.wait_for_timeout(150)
    pg.select_option('select[aria-label="Sort products"]','priceHigh'); pg.wait_for_timeout(100)
    order=pg.eval_on_selector_all('#productList .item-title','e=>e.map(x=>x.textContent)')
    check('sort price high', order==['elephants','snakes','Turtle','Small bee','Baby bee'], order)
    pg.fill('input[aria-label="Search products"]','bee'); pg.wait_for_timeout(100)
    order=pg.eval_on_selector_all('#productList .item-title','e=>e.map(x=>x.textContent)')
    check('search + sort', order==['Small bee','Baby bee'], order)
    pg.reload(); pg.wait_for_timeout(700); pg.evaluate("view('products')"); pg.wait_for_timeout(150)
    check('sort remembered', pg.eval_on_selector('select[aria-label="Sort products"]','e=>e.value')=='priceHigh')
    pg.select_option('select[aria-label="Sort products"]','name')
    order=pg.eval_on_selector_all('#productList .item-title','e=>e.map(x=>x.textContent)')
    check('sort name', order==['Baby bee','elephants','Small bee','snakes','Turtle'], order)
    pg.screenshot(path=SH+'6-sort.png')
    # help
    pg.evaluate("view('settings')"); pg.click('button.menu-row:has-text("Pricing defaults")'); pg.wait_for_timeout(200)
    pg.screenshot(path=SH+'7-pricing.png',full_page=True)
    before=pg.evaluate("$('sdeduct').checked")
    pg.click("label:has-text('Automatically deduct') button.helpq"); pg.wait_for_timeout(150)
    check('deduct help', 'takes the materials it uses out' in dlg(pg) and pg.evaluate("$('sdeduct').checked")==before, dlg(pg))
    pg.screenshot(path=SH+'8-help.png'); pg.click('#appDialog button[data-v="1"]')
    pg.click("label:has-text('multiplier') button.helpq"); pg.wait_for_timeout(100)
    check('mult help', 'Materials × multiplier' in dlg(pg)); pg.click('#appDialog button[data-v="1"]')
    pg.click("label:has-text('markup') button.helpq"); pg.wait_for_timeout(100)
    check('markup help', 'Materials with markup + labour' in dlg(pg)); pg.click('#appDialog button[data-v="1"]')
    # logo
    pg.click('header .brand'); pg.wait_for_timeout(200)
    check('logo goes home', pg.evaluate("screen")=='home' and pg.evaluate("navStack.length")==0)
    pg.evaluate("go('settingsFeedback')"); pg.wait_for_timeout(100)
    check('version 23', 'App version: 23' in pg.inner_text('main'))
    check('no page errors', not errs, errs)
    b.close()
f=[n for n,ok in R if not ok]
print(f'{len(R)-len(f)}/{len(R)} passed', f)
