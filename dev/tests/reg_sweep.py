import asyncio, datetime
from playwright.async_api import async_playwright
SP='/tmp/claude-0/-home-claude/8bb1afb4-4fdc-5006-8c41-4baddc11f2f2/scratchpad'
fut=(datetime.date.today()+datetime.timedelta(days=4)).isoformat()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':360,'height':740},has_touch=True,is_mobile=True); await ctx.add_init_script("try{localStorage.setItem('csLocalOnly','true')}catch(e){}")
        await ctx.route('https://fonts.googleapis.com/**',lambda r:r.abort()); await ctx.route('https://fonts.gstatic.com/**',lambda r:r.abort())
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
        pg.on('console',lambda m: m.type=='error' and 'Failed to load resource' not in m.text and errs.append('CONSOLE '+m.text))
        await pg.goto('http://localhost:8774/'); await pg.wait_for_timeout(600)
        await pg.evaluate("indexedDB.deleteDatabase('crochetStudioPDFs')"); await pg.reload(); await pg.wait_for_timeout(800)
        # first-run screens
        for js in ["view('home')","view('products')","view('materials')","view('patterns')","view('markets')","view('reports')","go('settings')","go('settingsAccount')","go('settingsPricing')","go('settingsTax')","go('settingsBackup')","newProduct()","newMaterial()","newMarket()"]:
            await pg.evaluate(js); await pg.wait_for_timeout(120)
        # overflow check (horizontal scroll) on every screen with data
        await pg.evaluate(f"""()=>{{data.productCategories=[{{id:'c1',name:'Plushies'}}];
          data.materials.push({{id:'y1',categoryId:'cat_yarn',name:'Bernat Blanket Extra Long Name Yarn',colour:'Lilac Dreams Variegated',weight:300,unit:'g',price:12,store:'Michaels',trackStock:true,stock:600}},{{id:'s1',categoryId:'cat_stuffing',name:'Polyfill',weight:500,unit:'g',price:10}});
          data.products.push({{id:'p1',name:'Extra Large Crochet Highland Cow With Flowers',price:45,stock:3,hours:4,categoryId:'',materials:[{{materialId:'y1',amount:200}},{{materialId:'s1',amount:80}}]}},{{id:'p2',name:'Bee',price:8,stock:10,hours:.5,categoryId:'c1',materials:[]}});
          data.markets.push({{id:'k1',name:'Barrie Waterfront Holiday Craft Market',location:'Spirit Catcher Park, Barrie, Ontario',cost:60,target:500,days:[{{date:'{fut}',start:'09:00',end:'16:00'}}],date:'{fut}',items:{{p1:2,p2:6}},todos:[{{id:'t1',text:'Charge card reader',done:false}}],notes:'x'}});save();}}""")
        screens=[("home","view('home')"),("products","view('products');toggleFolder('c1')"),("pdetail","detail('p1')"),("pform","editProduct('p1')"),("materials","view('materials');toggleMatGroup(0)"),("mform","editMaterial('y1')"),("markets","view('markets')"),("mdetail","openMarket('k1')"),("minfo","go('marketInfo')"),("todo","openTodo('k1')"),("reports","view('reports')"),("settings","go('settings')"),("tax","go('settingsTax')"),("acct","go('settingsAccount')")]
        for n,js in screens:
            await pg.evaluate(js); await pg.wait_for_timeout(200)
            ov=await pg.evaluate("[document.documentElement.scrollWidth,innerWidth]")
            if ov[0]>ov[1]: errs.append(f'OVERFLOW {n} {ov}')
            await pg.screenshot(path=f'{SP}/sw_{n}.png')
        for js in ["openCategoryModal()","openMatCategoryModal('cat_yarn')","openUnitsModal()","openAddToCategory('p1')","openQuickMaterial('cat_yarn')"]:
            await pg.evaluate("view('products')"); await pg.evaluate(js); await pg.wait_for_timeout(150)
            ov=await pg.evaluate("[document.documentElement.scrollWidth,innerWidth]")
            if ov[0]>ov[1]: errs.append(f'OVERFLOW modal {js} {ov}')
            await pg.evaluate("closeOverlays()")
        # labels linked?
        await pg.evaluate("newProduct()"); await pg.wait_for_timeout(200)
        unl=await pg.evaluate("[...document.querySelectorAll('label')].filter(l=>!l.htmlFor&&!l.querySelector('input,select,textarea')).map(l=>l.textContent.trim()).filter(Boolean)")
        print('unlinked labels on product form:',unl)
        # save batching works & persists
        await pg.evaluate("for(let i=0;i<20;i++)quickAdd('p2')"); await pg.wait_for_timeout(50); await pg.reload(); await pg.wait_for_timeout(900)
        print('batched saves persisted after quick reload:', await pg.evaluate("product('p2').stock"))
        print('ISSUES:',errs or 'none'); await b.close()
asyncio.run(main())
