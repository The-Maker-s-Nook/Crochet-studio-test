// ===== v23: tester feedback fixes and new features =====
ICONS.globe='<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>';

// ---- Country & currency ----
function guessCurrency(){
  try{let tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'',lang=navigator.language||'';
    if(/^America\/(Toronto|Montreal|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Moncton|Whitehorse|Yellowknife|Iqaluit|Glace_Bay|Goose_Bay|Swift_Current|Dawson_Creek|Fort_Nelson|Creston|Rankin_Inlet|Resolute|Cambridge_Bay|Inuvik|Atikokan|Blanc-Sablon|Nipigon|Thunder_Bay|Rainy_River|Dawson|Pangnirtung)$/.test(tz)||/-CA$/i.test(lang))return 'CAD';
    if(/^(America|Pacific\/Honolulu)/.test(tz)||/-US$/i.test(lang))return 'USD'}catch{}
  return 'CAD';
}
const currencyName=()=>data.settings.currency==='USD'?'United States · USD':'Canada · CAD';
function settingsRegion(){let c=data.settings.currency||'CAD';return `${backBtn()}<h2 style="margin-top:12px">Country &amp; currency</h2><div class="panel"><div class="regiongrid">${[['CAD','Canada','CAD $'],['USD','United States','USD $']].map(([v,n,s])=>`<button class="regionbtn ${c===v?'on':''}" aria-pressed="${c===v}" onclick="setCurrency('${v}')"><b>${n}</b><span>${s}</span></button>`).join('')}</div><p class="hint">The whole app uses this currency, and Square charges in it. It must match your Square account's country, or Square says “invalid request”.</p></div><div class="panel muted">Prices aren't converted, only labelled. Set your sales tax rate in Settings › Tax${c==='USD'?' (in the US it depends on your state)':''}.</div>`}
function setCurrency(v){data.settings.currency=v;lsSet('csSquareBasic',false);save();render();toast(v==='USD'?'Currency set to US dollars.':'Currency set to Canadian dollars.')}

// ---- Delete a market ----
async function deleteMarket(){
  let m=data.markets.find(x=>x.id===marketSelected);if(!m)return;
  let packed=Object.values(m.items||{}).reduce((a,q)=>a+num(q),0),sales=data.sales.filter(s=>s.marketId===m.id),amt=sales.reduce((a,s)=>a+lineRev(s),0),n=new Set(sales.map(s=>s.orderId||s.id)).size;
  let msg=(m.completed?'':packed?`The ${packed} item${packed===1?'':'s'} packed for it go back to your available stock.`:'Nothing is packed for it yet.')+(n?`\n\nIt has ${n} sale${n===1?'':'s'} (${cash(amt)}) recorded. They'll stay in Reports as sales with no market, so your totals don't change.`:'')+'\n\nThis can’t be undone.';
  if(!await appDialog({title:`Delete ${m.name}?`,message:msg.trim(),ok:'Delete market',cancel:'Cancel',danger:true}))return;
  for(let s of sales){s.marketId=null;s.fromMarket=m.name}
  for(let o of data.orders||[])if(o.marketId===m.id){o.marketId=null;o.fromMarket=m.name}
  data.markets=data.markets.filter(x=>x.id!==m.id);
  if(marketSaleMode&&saleKind!=='quick'){marketSaleMode=false;marketSaleDraft={}}
  save();view('markets');toast(`${m.name} deleted.`);
}

// ---- Tags (product categories can now be several per product) ----
let productTagDraft=[];
function ptagIds(p){let t=Array.isArray(p?.tagIds)?p.tagIds:(p?.categoryId?[p.categoryId]:[]);return t.filter(x=>pcat(x))}
function ptags(p){return ptagIds(p).map(pcat).sort(byName)}
function hasTag(p,cid){return ptagIds(p).includes(cid)}
function setTags(p,ids){p.tagIds=[...new Set(ids)].filter(x=>pcat(x));p.categoryId=p.tagIds[0]||''}
function productMatches(p,q){q=String(q||'').toLowerCase().trim();if(!q)return true;return [p.name,p.variation,...ptags(p).map(c=>c.name)].some(x=>String(x||'').toLowerCase().includes(q))}
function productCard(p,inTag){
  let others=inTag?ptags(p).filter(c=>c.id!==inTag):[];
  return `<div class="panel item">${photoSlot(p.photo||'',"",'product',p.id,p.name)}<div class="grow"><div class="row titlerow"><div class="item-title">${esc(p.name)}</div>${ptagIds(p).length?'':`<button class="alt small addcat" onclick="openAddToCategory('${p.id}')">${ic('tag',14)} Add tag</button>`}</div><div class="muted">${cash(p.price)} · ${num(p.stock)} in stock</div>${others.length?`<span class="chip tagchip">Also tagged ${others.map(c=>esc(c.name)).join(', ')}</span>`:''}<div class="actions"><button class="alt small" onclick="quickRemove('${p.id}')" aria-label="Remove one ${esc(p.name)} from stock">−1</button><button class="small" onclick="quickAdd('${p.id}')" aria-label="Add one ${esc(p.name)} to stock">+1</button><button class="alt small" onclick="detail('${p.id}')">Open / adjust</button></div></div></div>`;
}
function productRows(){
  let q=productFilter,match=p=>productMatches(p,q),loose=sortProducts(data.products.filter(p=>!ptagIds(p).length&&match(p))),cats=data.productCategories.slice().sort(byName),folders='';
  for(let c of cats){let items=sortProducts(data.products.filter(p=>hasTag(p,c.id)&&match(p)));if(q.trim()&&!items.length&&!c.name.toLowerCase().includes(q.toLowerCase().trim()))continue;let open=(q.trim()&&items.length)||productFolderOpen.has(c.id);
    folders+=`<div class="folder ${open?'open':''}"><button class="folder-head" onclick="toggleFolder('${c.id}')" aria-expanded="${!!open}">${ic('tag',22)}<span class="grow"><b>${esc(c.name)}</b><span class="muted">${items.length} product${items.length===1?'':'s'}</span></span><span class="chev" aria-hidden="true">›</span></button>${open?`<div class="folder-body">${items.length?`<div class="cardgrid">${items.map(p=>productCard(p,c.id)).join('')}</div>`:'<p class="muted" style="margin:4px 4px 10px">No products with this tag yet.</p>'}<div class="actions" style="margin:4px 0 2px"><button class="small" onclick="openTagAdd('${c.id}')">+ Add products</button><button class="alt small" onclick="newProduct('${c.id}')">+ New product here</button><button class="alt small" onclick="openCategoryModal('${c.id}')">Rename / delete</button></div></div>`:''}</div>`}
  if(!loose.length&&!folders)return '<div class="panel muted">'+(q.trim()?'No products match your search.':'No products yet. Tap + Product to add your first one.')+'</div>';
  return (loose.length?`<div class="cardgrid">${loose.map(p=>productCard(p)).join('')}</div>`:'')+(folders?(loose.length?'<div class="section-label">Tags</div>':'')+folders:'');
}
function tagModalHtml(pid){let pr=product(pid),cats=data.productCategories.slice().sort(byName),on=new Set(ptagIds(pr));return `<div class="row"><h2 style="margin:0">Tags</h2>${closeX()}</div><p class="muted">${esc(pr.name)} · pick any</p>${cats.map(c=>`<button class="rowbtn" aria-pressed="${on.has(c.id)}" onclick="toggleProductTag('${pid}','${c.id}')"><div class="row"><b>${on.has(c.id)?'✓ ':''}${esc(c.name)}</b><span class="muted">${data.products.filter(x=>hasTag(x,c.id)).length}</span></div></button>`).join('')||'<p class="muted">No tags yet.</p>'}<label for="ncName">${cats.length?'Or create a new tag':'Create a tag'}</label><div class="row"><input id="ncName" placeholder="e.g. Plushies, Easter" autocapitalize="words" onkeydown="if(event.key==='Enter')createAndAssign('${pid}')"><button onclick="createAndAssign('${pid}')">Add</button></div><div class="actions"><button onclick="closeModal();render()">Done</button></div>`}
function openAddToCategory(pid){if(!product(pid))return;openModal(tagModalHtml(pid))}
function toggleProductTag(pid,cid){let pr=product(pid);if(!pr)return;let ids=ptagIds(pr);setTags(pr,ids.includes(cid)?ids.filter(x=>x!==cid):[...ids,cid]);save();openModal(tagModalHtml(pid))}
function setProductCategory(pid,cid){let pr=product(pid);if(!pr||!pcat(cid))return;setTags(pr,[...ptagIds(pr),cid]);save();closeModal();render();flash(`${pr.name} tagged ${pcat(cid).name}.`)}
function createAndAssign(pid){let nm=normName($('ncName').value);if(!nm)return needField('ncName','Enter a name for the new tag.');let c=data.productCategories.find(x=>x.name.toLowerCase()===nm.toLowerCase());if(!c){c={id:id(),name:nm};data.productCategories.push(c)}let pr=product(pid);if(pr)setTags(pr,[...ptagIds(pr),c.id]);save();openModal(tagModalHtml(pid))}
function openCategoryModal(cid){let c=pcat(cid);openModal(`<div class="row"><h2 style="margin:0">${c?'Edit':'New'} tag</h2>${closeX()}</div><label for="pcName">Tag name</label><input id="pcName" value="${esc(c?.name||'')}" placeholder="e.g. Plushies, Easter, Keychains" onkeydown="if(event.key==='Enter')savePCategory('${c?.id||''}')"><div class="actions"><button onclick="savePCategory('${c?.id||''}')">Save</button>${c?`<button class="danger" onclick="deletePCategory('${c.id}')">Delete tag</button>`:''}</div>${c?'<p class="hint">Deleting a tag keeps its products. It’s just removed from them.</p>':'<p class="hint">A product can have more than one tag. It shows under each one, but it’s still one product with one stock count.</p>'}`);setTimeout(()=>{if(!c)$('pcName')?.focus()},60)}
function savePCategory(cid){let nm=normName($('pcName').value);if(!nm)return appAlert('Enter a tag name.');let dup=data.productCategories.find(c=>c.id!==cid&&c.name.toLowerCase()===nm.toLowerCase());if(dup)return appAlert(`You already have a “${dup.name}” tag.`);let c=pcat(cid);if(c)c.name=nm;else{c={id:id(),name:nm};data.productCategories.push(c);productFolderOpen.add(c.id)}save();closeModal();render();flash(`Tag “${nm}” saved.`)}
async function deletePCategory(cid){let c=pcat(cid);if(!c)return;let n=data.products.filter(p=>hasTag(p,cid)).length;if(!await appConfirm(`Delete the “${c.name}” tag?${n?`\n\nIts ${n} product${n>1?'s':''} will stay, just without this tag.`:''}`))return;for(let p of data.products)if(hasTag(p,cid))setTags(p,ptagIds(p).filter(x=>x!==cid));data.productCategories=data.productCategories.filter(x=>x.id!==cid);save();closeModal();render();flash('Tag deleted.')}
function tagPicker(){return `<div id="ptags" class="chips">${tagChips()}</div><div id="ptagNewRow" class="row hidden" style="margin-top:8px"><input id="ptagNew" placeholder="New tag name" aria-label="New tag name" autocapitalize="words" onkeydown="if(event.key==='Enter'){event.preventDefault();addDraftTag()}"><button type="button" onclick="addDraftTag()">Add</button></div>`}
function tagChips(){let cats=data.productCategories.slice().sort(byName);return cats.map(c=>{let on=productTagDraft.includes(c.id);return `<button type="button" class="chipbtn ${on?'on':''}" aria-pressed="${on}" onclick="toggleDraftTag('${c.id}')">${on?'✓ ':''}${esc(c.name)}</button>`}).join('')+`<button type="button" class="chipbtn newtag" onclick="$('ptagNewRow').classList.remove('hidden');$('ptagNew').focus()">+ New tag</button>`}
function toggleDraftTag(cid){productTagDraft=productTagDraft.includes(cid)?productTagDraft.filter(x=>x!==cid):[...productTagDraft,cid];$('ptags').innerHTML=tagChips()}
function addDraftTag(){let nm=normName($('ptagNew').value);if(!nm)return needField('ptagNew','Enter a name for the new tag.');let c=data.productCategories.find(x=>x.name.toLowerCase()===nm.toLowerCase());if(!c){c={id:id(),name:nm};data.productCategories.push(c);save()}if(!productTagDraft.includes(c.id))productTagDraft.push(c.id);$('ptagNew').value='';$('ptagNewRow').classList.add('hidden');$('ptags').innerHTML=tagChips()}
// Add existing products to a tag
let tagAddId=null,tagAddPicked=new Set(),tagAddSearch='';
function openTagAdd(cid){go('tagAdd',()=>{tagAddId=cid;tagAddPicked=new Set();tagAddSearch=''})}
function tagAdd(){let c=pcat(tagAddId);if(!c)return `${backBtn()}<p class="muted">Tag not found.</p>`;return `${backBtn()}<h2 style="margin-top:12px">Add products to ${esc(c.name)}</h2><p class="muted" style="margin-top:-6px;font-weight:600">Tick the products to tag ${esc(c.name)}. They keep any other tags they have.</p><input id="tagAddQ" placeholder="Search your products" aria-label="Search your products" value="${esc(tagAddSearch)}" oninput="tagAddSearch=this.value;$('tagAddList').innerHTML=tagAddRows()"><div id="tagAddList" class="panel" style="margin-top:12px;padding:6px 10px">${tagAddRows()}</div><div class="actions"><button id="tagAddBtn" onclick="applyTagAdd()">${tagAddLabel()}</button></div>`}
function tagAddRows(){let list=data.products.filter(p=>productMatches(p,tagAddSearch)).sort((a,b)=>(a.name+' '+(a.variation||'')).localeCompare(b.name+' '+(b.variation||''),undefined,{numeric:true,sensitivity:'base'}));if(!list.length)return '<p class="muted">No products match.</p>';return list.map(p=>{let here=hasTag(p,tagAddId),on=here||tagAddPicked.has(p.id),others=ptags(p).filter(c=>c.id!==tagAddId).map(c=>c.name);return `<label class="tagrow ${here?'here':''}"><input type="checkbox" ${on?'checked':''} ${here?'disabled':''} onchange="tagAddToggle('${p.id}',this.checked)">${thumb(p.photo||'','width:44px;height:44px')}<span class="grow"><b>${esc(p.name)}${p.variation?' · '+esc(p.variation):''}</b><span class="muted">${here?'Already tagged '+esc(pcat(tagAddId).name):(others.length?'Tagged '+esc(others.join(', ')):'No tags')} · ${num(p.stock)} in stock</span></span></label>`}).join('')}
function tagAddToggle(pid,on){on?tagAddPicked.add(pid):tagAddPicked.delete(pid);$('tagAddBtn').textContent=tagAddLabel()}
function tagAddLabel(){let n=tagAddPicked.size;return n?`Add ${n} product${n===1?'':'s'}`:'Tick products to add'}
function applyTagAdd(){let c=pcat(tagAddId);if(!c)return;if(!tagAddPicked.size)return appAlert('Tick at least one product first.');let n=0;for(let pid of tagAddPicked){let p=product(pid);if(p&&!hasTag(p,c.id)){setTags(p,[...ptagIds(p),c.id]);n++}}productFolderOpen.add(c.id);save();goBack();toast(`${n} product${n===1?'':'s'} tagged ${c.name}.`)}

// ---- Home messages ----
const HOME_MSGS=['Ready to make something cute today?','Every stitch counts. You’ve got this!','Market season is here. Time to pack?','Don’t forget to snap photos of new makes.','Check your yarn before the next big project.','Small business, big heart.','Hydrate, stretch, then crochet.','Your next best seller is on the hook.','Tip: back up your data in Settings.','Thanks for supporting handmade!'];
let homeMsgIdx=null;
function homeMessage(){if(homeMsgIdx===null){let i=Number(lsGet('csMsgIdx',-1));homeMsgIdx=((Number.isFinite(i)?i:-1)+1)%HOME_MSGS.length;lsSet('csMsgIdx',homeMsgIdx)}return esc(HOME_MSGS[homeMsgIdx])}

// ---- Pattern viewer: stays open, "I stopped here" marker ----
let patArm=false,patMarkAt=0,patAfterBusy=false;
async function openPattern(pid,opts={}){
  let p=pdfCache.find(x=>x.id===pid);if(!p){await refreshPdfs();p=pdfCache.find(x=>x.id===pid)}
  if(!p){lsSet('csPatternOpen',null);if(!opts.silent)appAlert('Pattern not found.');return}
  let mem=lsGet('csPatternOpen',null),keep=opts.restore&&mem?.id===pid;
  openViewerItem(p,{pattern:true,zoom:keep?mem.zoom:1});
  lsSet('csPatternOpen',{id:pid,zoom:viewerZoom,top:keep?num(mem.top):0,restored:!!keep});
}
function openViewerItem(p,o={}){
  removeViewer();viewerItem=p;viewerZoom=o.zoom&&ZOOMS.includes(o.zoom)?o.zoom:1;viewerPdf=null;viewerUrl=URL.createObjectURL(p.blob);patArm=false;
  let ov=document.createElement('div');ov.id='viewer';if(o.pattern)ov.dataset.pattern=p.id;
  ov.innerHTML=`<div class="vbar"><b>${esc(p.name)}</b>${o.pattern?`<button class="small vmarkbtn" id="vmarkBtn" aria-pressed="false" onclick="armPatternMark()">${ic('tag',15)} Mark</button>`:''}<button class="alt small" onclick="viewerZoomBy(-1)" aria-label="Zoom out">−</button><span id="vzoom">100%</span><button class="alt small" onclick="viewerZoomBy(1)" aria-label="Zoom in">+</button><button class="small" onclick="closeViewer()" aria-label="Close">✕</button></div>${o.pattern?'<div id="vtip" class="vtip hidden"></div>':''}<div id="vbody"><div class="vmsg muted">Opening…</div></div>`;
  document.body.appendChild(ov);document.body.classList.add('viewing');document.body.style.overflow='hidden';try{history.pushState({viewer:1},'')}catch{}
  if(o.pattern){let b=$('vbody');b.addEventListener('scroll',onPatScroll,{passive:true});b.addEventListener('pointerdown',onPatTouch)}
  renderViewer();
}
const _rv23=renderViewer;renderViewer=async function(){await _rv23();afterViewerRender()};
const _rmv23=removeViewer;removeViewer=function(){_rmv23();document.body.classList.remove('viewing')};
const _close23=closeViewer;closeViewer=function(){lsSet('csPatternOpen',null);_close23()};
const _zoom23=viewerZoomBy;viewerZoomBy=function(d){let b=$('vbody'),pid=$('viewer')?.dataset.pattern;if(pid&&b){let m=lsGet('csPatternOpen',null)||{id:pid};m.top=b.scrollHeight?b.scrollTop/b.scrollHeight:0;lsSet('csPatternOpen',m)}_zoom23(d);if(pid){let m=lsGet('csPatternOpen',null);if(m){m.zoom=viewerZoom;lsSet('csPatternOpen',m)}}};
function patVtip(t,ms){let e=$('vtip');if(!e)return;clearTimeout(patVtip.t);if(!t){e.classList.add('hidden');return}e.textContent=t;e.classList.remove('hidden');if(ms)patVtip.t=setTimeout(()=>e.classList.add('hidden'),ms)}
function afterViewerRender(){
  let v=$('viewer'),b=$('vbody'),pid=v?.dataset.pattern;if(!pid||!b)return;
  let img=b.querySelector('img');if(img&&!img.complete){img.onload=()=>afterViewerRender();return}
  let mem=lsGet('csPatternOpen',null),mark=data.patternMarks?.[pid];
  if(mem?.id===pid&&num(mem.top)>0)b.scrollTop=num(mem.top)*b.scrollHeight;
  else if(mark)b.scrollTop=Math.max(0,mark.y*b.scrollHeight-140);
  drawPatMark();
  if(mem?.restored){mem.restored=false;lsSet('csPatternOpen',mem);patVtip('Opened where you left off',3500)}
}
function drawPatMark(){let b=$('vbody'),pid=$('viewer')?.dataset.pattern;if(!b||!pid)return;b.querySelector('.pmark')?.remove();let m=data.patternMarks?.[pid];if(!m)return;let e=document.createElement('div');e.className='pmark';e.innerHTML='<span class="pdot"></span><span class="plabel">You stopped here</span>';e.style.top=(m.y*b.scrollHeight-14)+'px';e.style.left=Math.max(4,m.x*b.scrollWidth-14)+'px';b.appendChild(e);patMarkAt=Date.now()}
function clearPatMark(){let b=$('vbody'),pid=$('viewer')?.dataset.pattern;let e=b?.querySelector('.pmark');if(!e)return;e.classList.add('fade');setTimeout(()=>e.remove(),600);if(pid&&data.patternMarks?.[pid]){delete data.patternMarks[pid];save()}}
function armPatternMark(){patArm=!patArm;let btn=$('vmarkBtn');if(btn){btn.setAttribute('aria-pressed',String(patArm));btn.classList.toggle('on',patArm)}patVtip(patArm?'Tap the spot where you stopped':'',0)}
function onPatTouch(e){
  let b=$('vbody'),pid=$('viewer')?.dataset.pattern;if(!b||!pid)return;
  if(patArm){let r=b.getBoundingClientRect(),x=(e.clientX-r.left+b.scrollLeft)/Math.max(1,b.scrollWidth),y=(e.clientY-r.top+b.scrollTop)/Math.max(1,b.scrollHeight);data.patternMarks={...(data.patternMarks||{}),[pid]:{x,y,at:new Date().toISOString()}};save();patArm=false;let btn=$('vmarkBtn');if(btn){btn.setAttribute('aria-pressed','false');btn.classList.remove('on')}drawPatMark();patVtip('Spot marked. It’ll be here next time.',2500);e.preventDefault();return}
  if(b.querySelector('.pmark')&&Date.now()-patMarkAt>1500)clearPatMark();
}
function onPatScroll(){
  let b=$('vbody'),pid=$('viewer')?.dataset.pattern;if(!b||!pid)return;
  clearTimeout(onPatScroll.t);onPatScroll.t=setTimeout(()=>{let m=lsGet('csPatternOpen',null);if(m?.id===pid){m.top=b.scrollHeight?b.scrollTop/b.scrollHeight:0;m.zoom=viewerZoom;lsSet('csPatternOpen',m)}},300);
  if(b.querySelector('.pmark')&&Date.now()-patMarkAt>1500)clearPatMark();
}
const _view23=view;view=function(s){let v=$('viewer');if(v){if(s==='patterns'&&v.dataset.pattern)return;removeViewer()}return _view23(s)};

// ---- What's new + guides ----
const GUIDES={whats:{file:'guides/whats-new-23.pdf',name:'What’s new in version 23'},guide:{file:'guides/tester-guide.pdf',name:'Crochet Studio Tester Guide'}};
async function openGuide(k){let g=GUIDES[k];if(!g)return;try{let r=await fetch(g.file,{cache:'no-cache'}).catch(()=>fetch(g.file));if(!r.ok)throw new Error(r.status);let blob=await r.blob();openViewerItem({id:'guide-'+k,name:g.name,mime:'application/pdf',blob})}catch(e){appAlert('The guide couldn’t be opened. Connect to the internet and try again.')}}
function settingsGuides(){return `${backBtn()}<h2 style="margin-top:12px">What's new &amp; tester guide</h2><div class="panel menu">${guideRow('whats','What’s new in version '+APP_VERSION,'Fixes from your feedback and new features','New')}${guideRow('guide','Tester guide','Install, accounts, Square, import, what to test','Updated')}</div><div class="panel"><h3>What changed in the guide</h3><ul class="tips"><li>Choosing your country &amp; currency</li><li>Square: which app you need, and the US fix</li><li>Tags instead of categories</li><li>Spreadsheet import: download your Google Sheet first</li></ul></div><p class="hint" style="margin:0 6px">Opens in the app’s PDF viewer.</p>`}
function guideRow(k,t,sub,badge){return `<button class="menu-row" onclick="openGuide('${k}')"><span class="tic gold" style="font-size:10px;font-weight:800">PDF</span><span class="grow"><b>${esc(t)} <span class="pill beta" style="font-size:11px;padding:2px 8px">${badge}</span></b><span class="muted">${esc(sub)}</span></span><span class="chev" aria-hidden="true">›</span></button>`}
let whatsNewShown=false;
function maybeWhatsNew(){
  if(whatsNewShown||screen!=='home'||!dataLoaded)return;
  let seen=lsGet('csSeenVersion',null);if(seen===APP_VERSION)return;
  whatsNewShown=true;lsSet('csSeenVersion',APP_VERSION);
  let existing=seen!==null||data.products.length||data.materials.length||data.markets.length||signedIn();if(!existing)return;
  setTimeout(()=>{if($('appDialog')||document.querySelector('.modal'))return;openModal(`<span class="pill ok">Updated to version ${APP_VERSION}</span><h2 style="margin:10px 0 8px">What's new</h2><ul class="tips"><li>Delete a market that's cancelled</li><li>Tags: a product can have more than one</li><li>Reports: fold sections, material value, download as PDF or CSV</li><li>Patterns stay open, with an “I stopped here” marker</li><li>Choose your country &amp; currency (fixes Square for US accounts)</li></ul><div class="tip" style="margin-top:12px">The Tester guide was updated too. Find both any time in Settings › What's new &amp; tester guide.</div><div class="actions"><button onclick="closeModal();openGuide('whats')">Read the full update notes</button><button class="alt" onclick="closeModal()">Got it</button></div>`)},600);
}

// ---- Reports: fold sections, material value, downloads ----
function foldReports(){
  let saved=lsGet('csRepFold',{})||{};
  document.querySelectorAll('#app .panel').forEach(p=>{
    if(p.dataset.fold)return;let h=p.querySelector(':scope > h3')||p.querySelector(':scope > .row > h3');if(!h)return;
    let head=h.parentElement===p?h:h.parentElement,key=h.textContent.trim();p.dataset.fold=key;head.classList.add('foldhead');
    h.setAttribute('role','button');h.tabIndex=0;h.insertAdjacentHTML('beforeend','<span class="foldchev" aria-hidden="true">⌄</span>');
    let folded=key in saved?saved[key]:key==='Materials on hand';
    const set=f=>{p.classList.toggle('folded',f);h.setAttribute('aria-expanded',String(!f))};set(folded);
    const toggle=()=>{folded=!folded;set(folded);let s=lsGet('csRepFold',{})||{};s[key]=folded;lsSet('csRepFold',s)};
    h.addEventListener('click',toggle);h.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}});
  });
}
function materialValueData(){let rows={},total=0,tracked=0;for(let m of data.materials){if(!m.trackStock)continue;tracked++;let v=Math.max(0,num(m.stock))*matUnitCost(m),c=mcat(m.categoryId)?.name||'Other';rows[c]=(rows[c]||0)+v;total+=v}return {rows:Object.entries(rows).map(([n,v])=>[n,round2(v)]).sort((a,b)=>b[1]-a[1]),total:round2(total),tracked}}
function materialValuePanel(){let d=materialValueData();return `<div class="panel"><div class="row"><h3 style="margin:0">Materials on hand</h3><b>${cash(d.total)}</b></div><div style="margin-top:10px">${d.rows.map(([n,v])=>`<div class="row entry" style="margin:6px 0"><span>${esc(n)}</span><b>${cash(v)}</b></div>`).join('')}<p class="hint">${d.tracked?`What's left of ${d.tracked} material${d.tracked===1?'':'s'} with “Track remaining stock” on. Not affected by the time frame above.`:'Turn on “Track remaining stock” for a material (Materials › Edit) to count it here.'}</p></div></div>`}
function reportSelection(){
  let opts=reportRanges();if(!opts.some(o=>o[0]===reportRange))reportRange='all';
  let [a,b]=rangeBounds(reportRange),inRange=completedBetween(a,b).sort((x,y)=>(marketTime(y)||0)-(marketTime(x)||0)),qs=quickBetween(a,b);
  if(reportMarket!=='all'&&!(reportMarket==='quick'&&qs.length)&&!inRange.some(m=>m.id===reportMarket))reportMarket='all';
  let sel=reportMarket==='all'?inRange:reportMarket==='quick'?[]:inRange.filter(m=>m.id===reportMarket),useQ=reportMarket==='all'||reportMarket==='quick',f=marketFigures(sel,useQ?qs:[]);
  let rangeLabel=(opts.find(o=>o[0]===reportRange)||[,''])[1],marketLabel=reportMarket==='all'?'All markets':reportMarket==='quick'?'Quick sales, no market':(inRange.find(m=>m.id===reportMarket)?.name||'');
  return {opts,a,b,inRange,qs,sel,useQ,f,rangeLabel:reportRange==='all'?'All time':rangeLabel,marketLabel};
}
let dlFmt='pdf';
function reportDownload(){let r=reportSelection();return `${backBtn()}<h2 style="margin-top:12px">Download a report</h2><div class="panel"><label for="dlRange" style="margin-top:0">Time frame</label><select id="dlRange" onchange="reportRange=this.value;reportMarket='all';render()">${r.opts.map(([v,l])=>`<option value="${v}" ${reportRange===v?'selected':''}>${v==='all'?'All time':l}</option>`).join('')}</select><label for="dlMarket">Market</label><select id="dlMarket" onchange="reportMarket=this.value;render()"><option value="all">All markets in this time frame (${r.inRange.length})</option>${r.inRange.map(m=>`<option value="${m.id}" ${reportMarket===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}${r.qs.length?`<option value="quick" ${reportMarket==='quick'?'selected':''}>Quick sales, no market</option>`:''}</select><p class="hint">The same sales as Reports: completed markets and quick sales.</p></div><div class="panel"><h3>File type</h3><div class="fmtgrid"><button class="fmt ${dlFmt==='pdf'?'on':''}" aria-pressed="${dlFmt==='pdf'}" onclick="dlFmt='pdf';render()"><b>PDF</b><span>A tidy summary for printing or your records</span></button><button class="fmt ${dlFmt==='csv'?'on':''}" aria-pressed="${dlFmt==='csv'}" onclick="dlFmt='csv';render()"><b>CSV spreadsheet</b><span>Every item sold as a row. Opens in Excel or Google Sheets</span></button></div></div><div class="actions"><button onclick="downloadReport()">${ic('download',18)} Download ${dlFmt.toUpperCase()}</button></div><p class="hint" style="margin:0 6px">Saves the file, or opens the share menu so you can save, email or print it.</p>`}
function reportFileName(r,ext){let slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');return `crochet-studio-report_${slug(r.rangeLabel)}${r.marketLabel!=='All markets'?'_'+slug(r.marketLabel):''}.${ext}`}
async function saveReportFile(blob,name){
  let file=null;try{file=new File([blob],name,{type:blob.type})}catch{}
  let touch=matchMedia('(pointer:coarse)').matches;
  if(touch&&file&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:name});return}catch(e){if(e?.name==='AbortError')return}}
  let url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('Report downloaded.');
}
function reportLines(r){
  return r.f.sales.slice().sort((x,y)=>String(y.date).localeCompare(String(x.date))).map(s=>{
    let o=s.orderId?(data.orders||[]).find(z=>z.id===s.orderId):null,p=product(s.productId),pc=num(s.qty)*(num(s.listPrice??s.price)-num(s.price)),disc=round2(num(s.disc)+(pc>0.004?pc:0));
    let reasons=[];if(num(s.disc)>0)reasons.push(o?.discount?.reason||'Discount');if(pc>0.004)reasons.push(s.priceReason||'Price change');
    return {date:String(s.date||'').slice(0,10),market:data.markets.find(m=>m.id===s.marketId)?.name||(s.fromMarket?s.fromMarket+' (deleted)':'Quick sale'),order:String(s.orderId||s.id||'').slice(-6).toUpperCase(),product:p?.name||'Deleted product',variation:p?.variation||'',tags:p?ptags(p).map(c=>c.name).join('; '):'',qty:num(s.qty),list:num(s.listPrice??s.price),sold:num(s.price),disc,reason:reasons.join('; '),tax:round2(num(s.tax)),total:round2(lineRev(s)),pay:o?.payment?.method?payLabel(o.payment.method):'',sq:o?.payment?.squareTxn||''};
  });
}
function reportCsv(r){
  let cur=data.settings.currency||'CAD',head=['Date','Market','Order','Product','Variation','Tags','Qty',`List price (${cur})`,`Sold at (${cur})`,`Discount (${cur})`,'Discount reason',`Tax (${cur})`,`Line total before tax (${cur})`,'Payment','Square receipt'];
  const q=v=>{v=String(v??'');return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v},f2=n=>Number(n).toFixed(2);
  let rows=reportLines(r).map(l=>[l.date,l.market,l.order,l.product,l.variation,l.tags,l.qty,f2(l.list),f2(l.sold),f2(l.disc),l.reason,f2(l.tax),f2(l.total),l.pay,l.sq]);
  return '﻿'+[head,...rows].map(r=>r.map(q).join(',')).join('\r\n')+'\r\n';
}
async function downloadReport(){
  let r=reportSelection();if(!r.f.sales.length&&!await appConfirm('There are no sales in this time frame. Download an empty report anyway?'))return;
  try{
    if(dlFmt==='csv')await saveReportFile(new Blob([reportCsv(r)],{type:'text/csv'}),reportFileName(r,'csv'));
    else await saveReportFile(new Blob([reportPdf(r)],{type:'application/pdf'}),reportFileName(r,'pdf'));
  }catch(e){console.error(e);appAlert('The report couldn’t be made. Please try again.')}
}
// A small PDF writer (Helvetica, no extra files needed)
function pdfEnc(s){let map={'−':'-','–':'\x96','—':'\x97','‘':'\x91','’':'\x92','“':'\x93','”':'\x94','•':'\x95','…':'\x85','·':'\xb7','€':'\x80','›':'\x9b','‹':'\x8b'},o='';for(let ch of String(s)){if(map[ch]!==undefined)o+=map[ch];else{let c=ch.charCodeAt(0);o+=c<256&&c>=32?ch:'?'}}return o}
function pdfW(s,font,size){let t=0,w=PDFW[font];for(let i=0;i<s.length;i++){let c=s.charCodeAt(i);t+=w[c-32]??556}return t*size/1000}
function reportPdf(r){
  const W=612,H=792,M=44,BOT=56;let pages=[],ops=[],y=H-M;
  const hex=h=>{h=h.replace('#','');return [0,2,4].map(i=>(parseInt(h.substr(i,2),16)/255).toFixed(3)).join(' ')};
  const INK='#2E1F47',INK2='#5B4782',SOFT='#EDE6FA',BOX='#F7F3FF',LAV='#C9B5EE';
  const txt=(x,yy,s,size=10,bold=false,color=INK,align='left')=>{s=pdfEnc(s);let f=bold?'F2':'F1',w=pdfW(s,f,size);if(align==='right')x-=w;else if(align==='center')x-=w/2;ops.push(`BT /${f} ${size} Tf ${hex(color)} rg ${x.toFixed(2)} ${yy.toFixed(2)} Td (${s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')}) Tj ET`)};
  const rect=(x,yy,w,h,color)=>ops.push(`${hex(color)} rg ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  const line=(x1,y1,x2,y2,color,lw=0.8)=>ops.push(`${hex(color)} RG ${lw} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  const newPage=()=>{pages.push(ops);ops=[];y=H-M};
  const need=h=>{if(y-h<BOT)newPage()};
  const fit=(s,f,size,max)=>{s=pdfEnc(s);if(pdfW(s,f,size)<=max)return s;while(s.length>1&&pdfW(s+'...',f,size)>max)s=s.slice(0,-1);return s+'...'};
  const table=(title,cols,rows,opt={})=>{
    let w=W-2*M,rh=17;need(40+Math.min(rows.length,3)*rh);txt(M,y-14,title,13,true);y-=24;
    const head=()=>{rect(M,y-rh,w,rh,SOFT);let x=M;cols.forEach(c=>{let cw=c.w*w;if(c.r)txt(x+cw-5,y-12,c.t,8.5,true,INK,'right');else txt(x+5,y-12,c.t,8.5,true);x+=cw});y-=rh};head();
    rows.forEach((row,k)=>{if(y-rh<BOT){newPage();head()}let b=opt.boldLast&&k===rows.length-1,x=M;cols.forEach((c,j)=>{let cw=c.w*w,v=fit(row[j]??'',b?'F2':'F1',9,cw-10);if(c.r)txt(x+cw-5,y-12,v,9,b,INK,'right');else txt(x+5,y-12,v,9,b);x+=cw});line(M,y-rh,M+w,y-rh,SOFT);y-=rh});
    y-=16;
  };
  let f=r.f,cur=data.settings.currency||'CAD',now=new Date();
  // Header
  txt(M,y-14,'Crochet Studio',11,true,'#6B5596');txt(M,y-40,'Sales report',24,true);txt(M,y-58,`${r.rangeLabel} · ${r.marketLabel}`,10.5,true,INK2);
  if(data.settings.userName)txt(W-M,y-14,data.settings.userName,11,true,INK,'right');
  txt(W-M,y-30,'Made '+now.toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'numeric'}),9,false,INK2,'right');txt(W-M,y-43,'Amounts in '+cur,9,false,INK2,'right');
  y-=70;line(M,y,W-M,y,LAV,2.5);y-=14;
  let boxes=[['Sales (after discounts)',cash(f.revenue)],['Profit',signedCash(f.profit)],['Items sold',String(f.qty)],['Discounts given',cash(f.discounts||0)]],bw=(W-2*M-24)/4;
  boxes.forEach(([l,v],i)=>{let x=M+i*(bw+8);rect(x,y-50,bw,50,BOX);txt(x+8,y-16,l,8,true,INK2);txt(x+8,y-39,v,15,true)});y-=64;
  txt(M,y,`Profit = sales after discounts (${cash(f.revenue)}) - material costs (${cash(f.materials)}) - booth costs (${cash(f.booth)}), before tax.`,8.5,false,INK2);y-=26;
  // By market
  let mrows=r.sel.map(m=>{let x=marketFigures([m]),t=marketTime(m);return [m.name,t?new Date(t).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'}):'',String(x.qty),cash(x.revenue),cash(x.materials),cash(x.booth),signedCash(x.profit)]});
  if(r.useQ&&r.qs.length){let x=marketFigures([],r.qs);mrows.push(['Quick sales (no market)','',String(x.qty),cash(x.revenue),cash(x.materials),cash(0),signedCash(x.profit)])}
  if(mrows.length){if(mrows.length>1)mrows.push(['Total','',String(f.qty),cash(f.revenue),cash(f.materials),cash(f.booth),signedCash(f.profit)]);table('By market',[{t:'Market',w:.31},{t:'Date',w:.15},{t:'Items',w:.07,r:1},{t:'Sales',w:.12,r:1},{t:'Materials',w:.12,r:1},{t:'Booth',w:.1,r:1},{t:'Profit',w:.13,r:1}],mrows,{boldLast:mrows.length>1})}
  // Best sellers
  let by={};for(let s of f.sales){let k=s.productId;by[k]=by[k]||{q:0,v:0};by[k].q+=num(s.qty);by[k].v+=lineRev(s)}
  let best=Object.entries(by).sort((a,b)=>b[1].q-a[1].q).slice(0,10).map(([pid,v])=>{let p=product(pid);return [p?(p.name+(p.variation?' · '+p.variation:'')):'Deleted product',String(v.q),cash(v.v)]});
  if(best.length)table('Best sellers',[{t:'Product',w:.6},{t:'Sold',w:.15,r:1},{t:'Sales',w:.25,r:1}],best);
  // Payments
  let orders=new Map();for(let s of f.sales){let k=s.orderId||s.id;if(!orders.has(k)){let o=s.orderId?(data.orders||[]).find(z=>z.id===s.orderId):null;orders.set(k,{m:o?.payment?.method||'',t:0})}orders.get(k).t+=lineRev(s)+num(s.tax)}
  let pays={};for(let o of orders.values()){let k=o.m;pays[k]=pays[k]||{n:0,t:0};pays[k].n++;pays[k].t+=o.t}
  let prow=Object.entries(pays).sort((a,b)=>b[1].t-a[1].t).map(([k,v])=>[payLabel(k),String(v.n),cash(v.t)]);
  if(prow.length)table('How customers paid (including tax)',[{t:'Method',w:.6},{t:'Sales',w:.15,r:1},{t:'Amount',w:.25,r:1}],prow);
  // Discounts
  if(num(f.discounts)>0.004){let rs={};for(let s of f.sales){let o=s.orderId?(data.orders||[]).find(z=>z.id===s.orderId):null;if(num(s.disc)>0){let k=o?.discount?.reason||'Discount';rs[k]=(rs[k]||0)+num(s.disc)}let pd=num(s.qty)*(num(s.listPrice??s.price)-num(s.price));if(pd>0.004){let k=s.priceReason||'Price change';rs[k]=(rs[k]||0)+pd}}
    table('Discounts',[{t:'',w:.7},{t:'Amount',w:.3,r:1}],[['At full price',cash(f.full)],...Object.entries(rs).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,'-'+cash(v)]),['After discounts',cash(f.revenue)]],{boldLast:true})}
  // Materials on hand
  let md=materialValueData();if(md.tracked)table('Materials on hand (today)',[{t:'Category',w:.7},{t:'Value',w:.3,r:1}],[...md.rows.map(([n,v])=>[n,cash(v)]),['Total',cash(md.total)]],{boldLast:true});
  // Tax
  let inR=d=>{let t=Date.parse(d);return t>=r.a&&t<r.b},coll=f.sales.reduce((a,s)=>a+num(s.tax),0),paid=(data.purchases||[]).filter(x=>inR(x.date)).reduce((a,x)=>a+num(x.tax),0);
  need(50);txt(M,y-14,'Sales tax',13,true);y-=32;txt(M,y,`Collected: ${cash(coll)}      Paid on materials: ${cash(paid)}      Difference: ${signedCash(coll-paid)}`,9.5);y-=20;
  if(!f.sales.length){need(30);txt(M,y-10,'No sales in this time frame.',10,false,INK2);y-=24}
  pages.push(ops);
  // Footers + assemble
  let n=pages.length,objs=[],kids=[];
  pages.forEach((p,i)=>{p.push(`${hex(SOFT)} RG 0.8 w ${M} 40 m ${W-M} 40 l S`);let foot=pdfEnc('Made with Crochet Studio. A guide only, not tax advice.'),pg=`Page ${i+1} of ${n}`;p.push(`BT /F1 7.5 Tf ${hex(INK2)} rg ${M} 28 Td (${foot}) Tj ET`);p.push(`BT /F1 7.5 Tf ${hex(INK2)} rg ${(W-M-pdfW(pg,'F1',7.5)).toFixed(2)} 28 Td (${pg}) Tj ET`)});
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');objs.push(null);
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  pages.forEach(p=>{let content=p.join('\n'),ci=objs.length+2;objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${ci} 0 R >>`);kids.push(`${objs.length} 0 R`);objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)});
  objs[1]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${n} >>`;
  let out='%PDF-1.4\n%\xe2\xe3\xcf\xd3\n',offs=[];objs.forEach((o,i)=>{offs.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`});
  let xref=out.length;out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offs.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objs.length+1} /Root 1 0 R /Info << /Title (${pdfEnc('Crochet Studio sales report')}) /Producer (Crochet Studio) >> >>\nstartxref\n${xref}\n%%EOF`;
  let bytes=new Uint8Array(out.length);for(let i=0;i<out.length;i++)bytes[i]=out.charCodeAt(i)&255;return bytes;
}
addEventListener('popstate',()=>{if($('viewer')?.dataset.pattern)lsSet('csPatternOpen',null)},true);
function v23AfterRender(){
  if(screen==='reports')foldReports();
  if(screen==='home')maybeWhatsNew();
  if(screen==='patterns'&&!$('viewer')){let mem=lsGet('csPatternOpen',null);if(mem&&pdfCache.some(p=>p.id===mem.id))openPattern(mem.id,{restore:true,silent:true})}
}
