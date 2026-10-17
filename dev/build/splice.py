import sys,re
p='/home/claude/crochet-studio/index.html'
s=open(p).read()
d='/tmp/claude-0/-home-claude/8bb1afb4-4fdc-5006-8c41-4baddc11f2f2/scratchpad/v16/'
js=open(d+'cloud.js').read(); css=open(d+'cloud.css').read()
def rep(old,new,count=1):
    global s
    n=s.count(old)
    assert n==count,(old[:80],n)
    s=s.replace(old,new)
# CSS
rep('</style></head>',css+'</style></head>')
# remove old settingsAccount line
m=re.search(r'\nfunction settingsAccount\(\)\{.*?\n',s); assert m
s=s[:m.start()]+'\n'+s[m.end():]
# render map
rep('settingsTax:settingsTax}[screen]','settingsTax:settingsTax,authWelcome:authWelcome,authSignup:authSignup,authSignin:authSignin,authForgot:authForgot,authVerify:authVerify,authNewPassword:authNewPassword,authSetup:authSetup,authSync:authSync,authLinkDone:authLinkDone}[screen]')
# boot
rep("dataLoaded=true;delete data.settings.theme;render();refreshPdfs();","dataLoaded=true;delete data.settings.theme;await refreshPdfs();try{await authBoot()}catch(e){console.warn(e)}render();")
# settings menu row
rep("""menuRow('user','Account',s.userName?s.userName:'Add your name',"go('settingsAccount')")""","""menuRow('user','Account',signedIn()?session.user.email:(s.userName?s.userName+' · not signed in':'Sign in to sync your devices'),"go('settingsAccount')")""")
# patterns hint
rep('Patterns stay private on this device.',"${signedIn()?'Patterns are saved privately to your account.':'Patterns stay private on this device.'}")
# backup text
rep('<p class="muted">Everything is saved on this device only. A backup file holds',"""<p class="muted">${signedIn()?'Your data is saved in your account and synced to your devices. A backup file is an extra copy you keep yourself. It holds':'Everything is saved on this device only. A backup file holds'}""")
rep("function backupReminder(){let hasData","function backupReminder(){if(signedIn())return '';let hasData")
rep("await refreshPdfs();view('home');toast('Backup restored.')","await refreshPdfs();markDirty();view('home');toast('Backup restored.')")
# resetData
m=re.search(r'async function resetData\(\)\{.*?location\.reload\(\)\}',s); assert m
s=s[:m.start()]+"""async function resetData(){clearTimeout(saveTimer);saveTimer=null;let cloud=signedIn()&&syncMeta.userId===session.user.id;if(!await appConfirm(cloud?'Delete all products, materials, sales, markets and patterns from this device AND from your account? They will be removed on all your devices. This cannot be undone.':'Delete all products, materials, sales, markets and patterns from this device? This cannot be undone.'))return;if(cloud){if(!navigator.onLine)return appAlert('Connect to the internet first, so your account is cleared too.');let st=data.settings;for(let p of await pdfAll())await pdfDelete(p.id);data=normalizeData({settings:st});flushSave();await saveQueue;await syncNow();location.reload();return}await saveQueue;await idbDel('app','data');try{localStorage.removeItem(KEY)}catch{}for(let p of await pdfAll())await pdfDelete(p.id);location.reload()}"""+s[m.end():]

rep('<p class="hint">Your data is saved on this device only. Back it up regularly from Settings.</p>', """<p class="hint">${signedIn()?'Your data is saved in your account and synced to your other devices.':'Your data is saved on this device only. Create a free account in Settings › Account to keep it safe in the cloud, or back it up regularly.'}</p>""")
rep('<p class="hint">Restoring replaces everything currently in the app with the backup.</p>', """<p class="hint">${signedIn()?'Restoring replaces everything in the app, and in your account on all your devices, with the backup.':'Restoring replaces everything currently in the app with the backup.'}</p>""")
rep("This replaces everything currently in the app.`))return;", "${signedIn()?'This replaces everything in the app and in your account, on all your devices.':'This replaces everything currently in the app.'}`))return;")
rep("addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPromptEvent=e;if(screen==='home'||screen==='settings')render()});", "addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPromptEvent=e;if(screen==='home'||screen==='settings'||screen==='authWelcome')render()});")

# insert js before boot line (const originalRender)
rep('const originalRender=render;',js+'\nconst originalRender=render;')

# ===== v18 sales =====
sales_js=open(d+'sales.js').read(); sales_css=open(d+'sales.css').read()
rep('</style></head>',sales_css+'</style></head>')
rep("if(!Array.isArray(d.purchases))d.purchases=[];","if(!Array.isArray(d.purchases))d.purchases=[];if(!Array.isArray(d.orders))d.orders=[];")
import re as _re
m2=_re.search(r"\$\{marketSaleMode\?`<div style=\"margin-top:16px\">.*?Complete sale</button></div></div>`:''\}",s); assert m2
s=s[:m2.start()]+"${marketSaleMode?salePanel():''}"+s[m2.end():]
rep("${marketSaleMode&&count?`<div class=\"muted\">Selling ${count} · ${cash(count*p.price)}</div>`:''}","${marketSaleMode&&count?`<div class=\"muted\">Selling ${count} · ${cash(count*(saleAdj.prices[pid]?num(saleAdj.prices[pid].price):num(p.price)))}${saleAdj.prices[pid]?' (price changed)':''}</div>`:''}")
rep("sold=data.sales.filter(s=>s.marketId===m.id).reduce((a,s)=>a+s.qty*s.price,0)","sold=data.sales.filter(s=>s.marketId===m.id).reduce((a,s)=>a+lineRev(s),0)")
rep("× ${s.qty} · ${cash(s.qty*s.price)}","× ${s.qty} · ${cash(lineRev(s))}")
rep("</div>${m.completed?completedPanel(m):","</div>${salesLinkPanel(m)}${m.completed?completedPanel(m):")
rep("function marketFigures(ms){let ids=new Set(ms.map(m=>m.id)),sales=data.sales.filter(x=>ids.has(x.marketId));let revenue=sales.reduce((a,x)=>a+num(x.qty)*num(x.price),0),","function marketFigures(ms){let ids=new Set(ms.map(m=>m.id)),sales=data.sales.filter(x=>ids.has(x.marketId));let full=round2(sales.reduce((a,x)=>a+lineFull(x),0)),revenue=round2(sales.reduce((a,x)=>a+lineRev(x),0)),")
rep("return {revenue,materials,qty,booth,profit:revenue-materials-booth,sales}}","return {revenue,full,discounts:round2(full-revenue),materials,qty,booth,profit:revenue-materials-booth,sales}}")
rep("${best.length?`<div class=\"panel\"><h3>Best sellers</h3>","${discountReport(f)}${best.length?`<div class=\"panel\"><h3>Best sellers</h3>")
rep("Profit = sales − material costs − booth costs, before tax.","Profit = sales after discounts − material costs − booth costs, before tax.")
rep("settingsTax:settingsTax,authWelcome:authWelcome","settingsTax:settingsTax,settingsPayments:settingsPayments,saleReview:saleReview,marketSales:marketSales,saleEdit:saleEdit,authWelcome:authWelcome")
rep("settingsAccount:'Account',settingsTax:'Tax'})","settingsAccount:'Account',settingsTax:'Tax',settingsPayments:'Payments',saleReview:'Review sale',marketSales:'Sales',saleEdit:'Sale'})")
rep("""${menuRow('download','Backup & restore'""","""${menuRow('card','Payments',squareOn()?'Square card payments on':'Cash, card and e-transfer',"go('settingsPayments')")}${menuRow('download','Backup & restore'""")
rep("try{await authBoot()}catch(e){console.warn(e)}render();","try{await authBoot()}catch(e){console.warn(e)}try{await handleSquareReturn()}catch(e){console.warn(e)}render();setTimeout(checkSquarePending,1500);")
rep('const originalRender=render;',sales_js+'\nconst originalRender=render;')

# ===== v19 search + quick sale =====
quick_js=open(d+'quick.js').read(); quick_css=open(d+'quick.css').read()
rep('</style></head>',quick_css+'</style></head>')
import re as _re2
mm=_re2.search(r"\$\{Object\.entries\(m\.items\)\.map\(\(\[pid,q\]\)=>\{(let p=product\(pid\);if\(!p\)return '';let count=.*?)\}\)\.join\(''\)\|\|\(m\.completed\?'<p class=\"muted\">Unsold items went back to your available stock\.</p>':'<p class=\"muted\">No products assigned yet\.</p>'\)\}",s)
assert mm
body=mm.group(1)
s=s[:mm.start()]+"${mktSearchBox(m)}<div id=\"mktItems\">${marketItemRows(m)}</div>"+s[mm.end():]
quick_js+="\nfunction marketItemRowsRaw(m,keep){return Object.entries(m.items||{}).filter(([pid])=>keep(pid)).map(([pid,q])=>{"+body+"}).join('')}\n"
rep("const setup=()=>{marketSelected=mid;","const setup=()=>{marketSelected=mid;mktSearch='';if(saleKind==='quick'){marketSaleMode=false;saleKind='market'}")
rep("function marketFigures(ms){let ids=new Set(ms.map(m=>m.id)),sales=data.sales.filter(x=>ids.has(x.marketId));","function marketFigures(ms,extra=[]){let ids=new Set(ms.map(m=>m.id)),sales=data.sales.filter(x=>ids.has(x.marketId)).concat(extra);")
rep("if(reportMarket!=='all'&&!inRange.some(m=>m.id===reportMarket))reportMarket='all';let sel=reportMarket==='all'?inRange:inRange.filter(m=>m.id===reportMarket),f=marketFigures(sel),","let qs=quickBetween(a,b);if(reportMarket!=='all'&&!(reportMarket==='quick'&&qs.length)&&!inRange.some(m=>m.id===reportMarket))reportMarket='all';let sel=reportMarket==='all'?inRange:inRange.filter(m=>m.id===reportMarket),f=marketFigures(sel,reportMarket==='all'||reportMarket==='quick'?qs:[]),")
rep("</option>`).join('')}</select></div>${anyDone?'':","</option>`).join('')}${qs.length?`<option value=\"quick\" ${reportMarket==='quick'?'selected':''}>Quick sales, no market (${new Set(qs.map(x=>x.orderId||x.id)).size})</option>`:''}</select></div>${anyDone||qs.length?'':")
rep("profit=marketFigures(completedBetween(monthStart,new Date(now.getFullYear(),now.getMonth()+1,1).getTime())).profit","profit=marketFigures(completedBetween(monthStart,new Date(now.getFullYear(),now.getMonth()+1,1).getTime()),quickBetween(monthStart,new Date(now.getFullYear(),now.getMonth()+1,1).getTime())).profit")
rep("data.markets.find(m=>m.id===s.marketId)?.name||'Other sale'","data.markets.find(m=>m.id===s.marketId)?.name||'Quick sale'")
rep('<div class="quick"><button onclick="newProduct()">+ New product</button><button class="outline" onclick="newMaterial()">+ New material</button></div>','<div class="quick"><button onclick="newProduct()">+ New product</button><button class="outline" onclick="newMaterial()">+ New material</button></div><button class="aqua quicksell" onclick="startQuickSale()">${ic(\'tag\',18)} Quick sale</button>')
rep('toprow" style="margin:-6px 0 12px"><button onclick="newProduct()">+ Product</button>','toprow" style="margin:-6px 0 12px"><button onclick="newProduct()">+ Product</button><button class="aqua" onclick="startQuickSale()">Sell</button>')
rep("settingsPayments:settingsPayments,saleReview:saleReview,","settingsPayments:settingsPayments,quickSale:quickSale,saleReview:saleReview,")
rep("settingsPayments:'Payments',saleReview:'Review sale',","settingsPayments:'Payments',quickSale:'Quick sale',saleReview:'Review sale',")
rep('const originalRender=render;',quick_js+'\nconst originalRender=render;')

# ===== v20 tab sync =====
tab_js=open(d+'tabsync.js').read()
rep('const originalRender=render;',tab_js+'\nconst originalRender=render;')
rep("render();setTimeout(checkSquarePending,1500);","myStamp=lsGet('csStamp','');render();setTimeout(checkSquarePending,1500);")


# ===== v21 import, feedback, pattern limit, tax in costs =====
imp_js=open(d+'import.js').read(); imp_css=open(d+'import.css').read()
rep('</style></head>',imp_css+'</style></head>')
rep("taxOnPurchases:true,taxOnSales:false};","taxOnPurchases:true,taxOnSales:false,taxInCosts:true};")
rep("return a+num(x.amount)*(num(m?.price)/Math.max(.001,num(m?.weight)))},0)}","return a+num(x.amount)*matUnitCost(m)},0)}")
rep('<label class="check"><input type="checkbox" id="tSales"',"""<label class="check"><input type="checkbox" id="tCosts" ${s.taxInCosts?'checked':''}> Include tax in material costs</label><div class="hint">Leave this on if you’re not registered for HST and can’t claim back the tax you pay on supplies. Product costs, suggested prices and profit then use what you actually paid. Turn it off if you claim the tax back. Prices you set yourself don’t change.</div>${taxExample()}<label class="check"><input type="checkbox" id="tSales\"""")
rep("Object.assign(data.settings,{taxRate:r,taxOnPurchases:$('tPurch').checked,taxOnSales:$('tSales').checked})","Object.assign(data.settings,{taxRate:r,taxOnPurchases:$('tPurch').checked,taxOnSales:$('tSales').checked,taxInCosts:$('tCosts').checked})")
rep("""'No backup yet',"go('settingsBackup')")}</div>${installCard()}""","""'No backup yet',"go('settingsBackup')")}${menuRow('download','Import from spreadsheet','Beta · bring in products and materials',"go('settingsImport')")}${menuRow('mail','Send feedback','Report a problem or share an idea',"go('settingsFeedback')")}</div><p class="hint" style="margin:-4px 8px 14px">Crochet Studio test version ${APP_VERSION}</p>${installCard()}""")
rep("settingsPayments:settingsPayments,quickSale:quickSale,","settingsPayments:settingsPayments,settingsImport:settingsImport,importReview:importReview,importDone:importDone,settingsFeedback:settingsFeedback,quickSale:quickSale,")
rep("settingsPayments:'Payments',quickSale:'Quick sale',","settingsPayments:'Payments',settingsImport:'Import',importReview:'Check import',importDone:'Import',settingsFeedback:'Feedback',quickSale:'Quick sale',")
rep("""<h3>Add pattern</h3><div class="actions"><button onclick="$('patternFile').click()">""","""<h3>Add pattern</h3>${patternUsage()}<div class="actions"><button onclick="patternPick('patternFile')">""")
rep("""<button class="alt" onclick="$('patternCamera').click()">""","""<button class="alt" onclick="patternPick('patternCamera')">""")
rep("function importPdf(e){let f=e.target.files?.[0];if(!f)return;","function importPdf(e){let f=e.target.files?.[0];if(!f)return;if(pdfCache.length>=PATTERN_LIMIT){e.target.value='';return patternLimitReached()}")
rep('const originalRender=render;',imp_js+'\nconst originalRender=render;')
open(p,'w').write(s)
print('ok v21',len(s))
rep("— ${x.amount} ${esc(unitShort(m?.unit))}</div>`})","— ${x.amount} ${esc(num(x.amount)===1&&m?.unit==='pair'?'pair':unitShort(m?.unit))}</div>`})")

# ===== v22 =====
v22_js=open(d+'v22.js').read(); v22_css=open(d+'v22.css').read()
rep('</style></head>',v22_css+'</style></head>')
rep("""<div class="panel item">${thumb(p.photo||'',"")}<div class="grow"><div class="row titlerow">""","""<div class="panel item">${photoSlot(p.photo||'',"",'product',p.id,p.name)}<div class="grow"><div class="row titlerow">""")
rep("""<div class="item">${thumb(p.photo||'',"")}<div class="grow"><h2 style="margin:0">""","""<div class="item">${photoSlot(p.photo||'',"",'product',p.id,p.name)}<div class="grow"><h2 style="margin:0">""")
rep("""${thumb(m.photo||m.photos?.[0]||'',"width:52px;height:52px")}""","""${photoSlot(m.photo||m.photos?.[0]||'',"width:52px;height:52px",'material',m.id,materialLabel(m),true)}""")
rep("""${thumb(photo,'width:46px;height:46px')}""","""${photoSlot(photo,'width:46px;height:46px','group',i,g.name,true)}""")
rep("g.items.sort((a,b)=>String(a.colour||'').localeCompare(String(b.colour||'')))","g.items.sort((a,b)=>String(a.colour||'').localeCompare(String(b.colour||''),undefined,{numeric:true,sensitivity:'base'}))")
rep("loose=data.products.filter(p=>!pcat(p.categoryId)&&match(p))","loose=sortProducts(data.products.filter(p=>!pcat(p.categoryId)&&match(p)))")
rep("let items=data.products.filter(p=>p.categoryId===c.id&&match(p));","let items=sortProducts(data.products.filter(p=>p.categoryId===c.id&&match(p)));")
rep("""<input placeholder="Search products" value="${esc(productFilter)}" oninput="productFilter=this.value;document.getElementById('productList').innerHTML=productRows()">""","""<input placeholder="Search products (name, variation, category)" aria-label="Search products" value="${esc(productFilter)}" oninput="productFilter=this.value;document.getElementById('productList').innerHTML=productRows()"><select aria-label="Sort products" style="margin-top:10px" onchange="setProductSort(this.value)">${PROD_SORTS.map(([v,l])=>`<option value="${v}" ${productSort===v?'selected':''}>Sort: ${l}</option>`).join('')}</select>""")
rep("<label>Default material multiplier</label>","<label>Default material multiplier ${helpBtn('mult')}</label>")
rep("<label>Default markup (%)</label>","<label>Default markup (%) ${helpBtn('markup')}</label>")
rep("Automatically deduct tracked materials when finished stock is added</label>","Automatically deduct tracked materials when finished stock is added ${helpBtn('deduct')}</label>")
rep('<header><div class="brand">','<header><div class="brand" role="button" tabindex="0" aria-label="Crochet Studio, go to Home" onclick="brandHome()" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();brandHome()}">')
rep('const originalRender=render;',v22_js+'\nconst originalRender=render;')

# ===== v23 =====
v23_js=open(d+'pdfw.js').read()+open(d+'v23.js').read(); v23_css=open(d+'v23.css').read()
rep('</style></head>',v23_css+'</style></head>')
rep("if(!Array.isArray(d.orders))d.orders=[];","if(!Array.isArray(d.orders))d.orders=[];if(!d.settings.currency)d.settings.currency=guessCurrency();for(let p of d.products)if(!Array.isArray(p.tagIds))p.tagIds=p.categoryId?[p.categoryId]:[];")
rep("<label for=\"pcatQ\">Product category (optional)</label>${categoryPicker(p.categoryId||(!editing?productCatPreset:''))}","<label>Tags (optional, pick any)</label>${tagPicker()}")
rep("categoryId:$('pcat')?.value||''","tagIds:[...productTagDraft],categoryId:productTagDraft[0]||''")
rep("if(p.categoryId)productFolderOpen.add(p.categoryId);","for(let t of p.tagIds||[])productFolderOpen.add(t);")
rep("${pcat(p.categoryId)?`<span class=\"chip\" style=\"display:inline-block;margin-top:6px\">${ic('folder',13)} ${esc(pcat(p.categoryId).name)}</span>`:''}","${ptags(p).map(c=>`<span class=\"chip\" style=\"display:inline-block;margin:6px 4px 0 0\">${ic('tag',13)} ${esc(c.name)}</span>`).join('')}")
rep("onclick=\"openCategoryModal()\">+ Category</button>","onclick=\"openCategoryModal()\">+ Tag</button>")
rep("productCatPreset='';initLines(p)","productCatPreset='';productTagDraft=ptagIds(p);initLines(p)")
rep("productCatPreset=catId||'';initLines(null)","productCatPreset=catId||'';productTagDraft=catId?[catId]:[];initLines(null)")
rep("<br>Ready to make something cute today?</div>","<br>${homeMessage()}</div>")
rep("${taxPanel()}<div class=\"panel muted\">Profit = sales after discounts","${materialValuePanel()}${taxPanel()}<div class=\"panel muted\">Profit = sales after discounts")
rep("return `<h2>Reports</h2><div class=\"panel\"><label for=\"repRange\"","return `<div class=\"row\"><h2>Reports</h2><button class=\"small\" onclick=\"go('reportDownload')\">${ic('download',16)} Download</button></div><div class=\"panel\"><label for=\"repRange\"")
rep("<div class=\"actions\"><button onclick=\"saveMarketInfo()\">Save details</button></div></div>`","<div class=\"actions\"><button onclick=\"saveMarketInfo()\">Save details</button></div></div><div class=\"panel\"><h3>Cancelled or not happening?</h3><p class=\"muted\" style=\"margin-top:0\">If it moved, change the dates above. If it's not happening, delete it. Packed items go back to your stock, and any sales stay in Reports.</p><div class=\"actions\"><button class=\"danger\" onclick=\"deleteMarket()\">Delete market</button></div></div>`")
rep("data.markets.find(m=>m.id===s.marketId)?.name||'Quick sale'","data.markets.find(m=>m.id===s.marketId)?.name||(s.fromMarket?s.fromMarket+' (deleted)':'Quick sale')")
rep("${menuRow('mail','Send feedback','Report a problem or share an idea',\"go('settingsFeedback')\")}","${menuRow('mail','Send feedback','Report a problem or share an idea',\"go('settingsFeedback')\")}${menuRow('book','What’s new & tester guide',`Version ${APP_VERSION} notes · guide updated`,\"go('settingsGuides')\")}")
rep("\"go('settingsAccount')\")}","\"go('settingsAccount')\")}${menuRow('globe','Country & currency',currencyName()+' · also used for Square',\"go('settingsRegion')\")}")
rep("settingsImport:settingsImport,","settingsImport:settingsImport,settingsRegion:settingsRegion,settingsGuides:settingsGuides,reportDownload:reportDownload,tagAdd:tagAdd,")
rep("settingsImport:'Import',","settingsImport:'Import',settingsRegion:'Country & currency',settingsGuides:'What’s new',reportDownload:'Download',tagAdd:'Add products',")
rep("document.body.dataset.screen=screen;originalRender();","document.body.dataset.screen=screen;originalRender();try{v23AfterRender()}catch(e){console.warn(e)}")
rep('Search products (name, variation, category)','Search products (name, variation, tag)')
rep('const originalRender=render;',v23_js+'\nconst originalRender=render;')
open(p,'w').write(s)
print('ok v23',len(s))
