from playwright.sync_api import sync_playwright
APP='http://localhost:8774/'
issues=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for w in (360,412,768):
        c=b.new_context(viewport={'width':w,'height':760},service_workers='block')
        c.add_init_script("try{localStorage.setItem('csLocalOnly','true');localStorage.setItem('csSeenVersion','23')}catch(e){}")
        pg=c.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto(APP); pg.wait_for_timeout(800)
        pg.evaluate("data.productCategories=[{id:'c1',name:'Plushies'}];data.products=[{id:'b',name:'Bunny plush with a very long name indeed',price:28,stock:6,hours:1,materials:[],tagIds:['c1']}];data.markets=[{id:'m',name:'Fall',days:[{date:'2030-01-01'}],items:{},todos:[]}];marketSelected='m';productFolderOpen.add('c1');save();0")
        for scr in ['home','products','reports','settings','settingsRegion','settingsGuides','reportDownload','marketInfo','settingsFeedback','settingsPayments']:
            pg.evaluate(f"view('{scr}')" if scr in ('home','products','reports','settings') else f"go('{scr}')"); pg.wait_for_timeout(250)
            sw=pg.evaluate("document.documentElement.scrollWidth")
            if sw>w: issues.append((w,scr,sw))
        pg.evaluate("openTagAdd('c1')"); pg.wait_for_timeout(200)
        if pg.evaluate("document.documentElement.scrollWidth")>w: issues.append((w,'tagAdd'))
        if errs: issues.append((w,errs))
        c.close()
    b.close()
print('ISSUES',issues)
