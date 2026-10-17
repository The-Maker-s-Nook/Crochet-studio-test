// ===== Sales: discounts, price changes, checkout, Square =====
const SQ_APP_ID='sq0idp-J4UrXdHeSOnFaEtvwuO2HQ';function sqCurrency(){return data.settings.currency==='USD'?'USD':'CAD'}
const DISCOUNT_REASONS=['Bundle deal','Haggled','Friends & family','Repeat customer','Seconds / flaw','Other'];
const PRICE_REASONS=['Haggled','Seconds / flaw','Friends & family','Repeat customer','Other'];
const PAY_METHODS=[['cash','Cash'],['card','Card'],['etransfer','E-transfer'],['other','Other']];
Object.assign(ICONS,{card:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',pencil:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',receipt:'<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>'});
let saleKind='market',saleAdj={prices:{},discount:null},payTmp={method:'cash',given:''},discTmp=null,discCtx='draft',priceTmp=null;
const lineFull=x=>num(x.qty)*num(x.listPrice??x.price);
const lineRev=x=>round2(num(x.qty)*num(x.price)-num(x.disc));
const squareOn=()=>!!data.settings.squareEnabled;
const payLabel=k=>(PAY_METHODS.find(x=>x[0]===k)||[,'Not recorded'])[1];
function discountAmount(sub,d){if(!d)return 0;let v=num(d.value),a=d.type==='pct'?sub*Math.min(v,100)/100:d.type==='amt'?v:d.type==='total'?sub-v:0;return round2(Math.max(0,Math.min(sub,a)))}
function discLabel(d,sub){if(!d)return '';let r=d.reason||'Discount';if(d.type==='pct')return `${r} (${num(d.value)}% off)`;let a=discountAmount(sub,d);return sub&&a?`${r} (${Math.round(a/sub*1000)/10}% off)`:r}
function allocate(lines,disc){let sub=lines.reduce((a,l)=>a+l.qty*l.price,0),left=disc;lines.forEach((l,i)=>{let base=l.qty*l.price,share=i===lines.length-1?left:round2(sub?disc*base/sub:0);l.disc=round2(Math.max(0,Math.min(share,base)));left=round2(left-l.disc)})}
function computeOrder(draft,adj){
  let lines=Object.entries(draft||{}).filter(([,q])=>q>0).map(([pid,q])=>{let p=product(pid),list=num(p?.price),o=adj.prices[pid];return {pid,p,name:p?.name||'Item',qty:q,list,price:o?num(o.price):list,reason:o?.reason||'',taxed:!!productTaxed(p)}});
  let sub=round2(lines.reduce((a,l)=>a+l.qty*l.price,0)),disc=discountAmount(sub,adj.discount);
  allocate(lines,disc);
  let tax=0;for(let l of lines){l.tax=l.taxed?round2((l.qty*l.price-l.disc)*taxRate()/100):0;tax+=l.tax}
  return {lines,full:round2(lines.reduce((a,l)=>a+l.qty*l.list,0)),sub,disc,tax:round2(tax),total:round2(sub-disc+tax),items:lines.reduce((a,l)=>a+l.qty,0)}
}
function resetSale(){marketSaleDraft={};saleAdj={prices:{},discount:null};payTmp={method:'cash',given:''}}
toggleMarketSale=function(){if(saleKind==='quick'&&marketSaleMode&&Object.keys(marketSaleDraft).length){saleKind='market';marketSaleMode=true;resetSale();render();return}saleKind='market';marketSaleMode=!marketSaleMode;resetSale();render()};

// ---- Sale panel on the market screen ----
function salePanel(){
  let o=computeOrder(marketSaleDraft,saleAdj),d=saleAdj.discount,changed=Object.keys(saleAdj.prices).filter(pid=>marketSaleDraft[pid]).length,dis=o.items?'':'disabled';
  return `<div class="salebox"><div class="eyebrow">This sale</div><div class="row"><span>${o.items} item${o.items===1?'':'s'}${changed?` · ${changed} price${changed>1?'s':''} changed`:''}</span><b>${cash(o.sub)}</b></div>${o.disc?`<div class="row discline"><span>${esc(discLabel(d,o.sub))}</span><b>−${cash(o.disc)}</b></div>`:''}${o.tax?`<div class="row"><span>Tax</span><span>${cash(o.tax)}</span></div>`:''}<div class="adjbtns"><button class="dashed" ${dis} onclick="openDiscount()">${ic('tag',18)} ${d?'Edit discount':'Discount / deal'}</button><button class="dashed" ${dis} onclick="openPriceEdit()">${ic('pencil',18)} Change a price</button></div><div class="row totalrow"><b>Total</b><span class="bigtotal">${cash(o.total)}</span></div><button class="btn-wide" ${dis} onclick="openReview()">Review sale</button></div>`
}
function openReview(){if(!computeOrder(marketSaleDraft,saleAdj).items)return appAlert('Tap + on at least one item you sold.');if(squareOn()&&payTmp.method==='cash'&&!payTmp.touched)payTmp.method='cash';go('saleReview')}

// ---- Discount sheet (works for the sale in progress or a saved sale) ----
function ctxSub(ctx){if(ctx==='draft')return computeOrder(marketSaleDraft,saleAdj).sub;return round2(orderLines(ctx).reduce((a,x)=>a+num(x.qty)*num(x.price),0))}
function ctxDiscount(ctx){return ctx==='draft'?saleAdj.discount:data.orders.find(o=>o.id===ctx)?.discount||null}
function openDiscount(ctx='draft'){discCtx=ctx;let cur=ctxDiscount(ctx);discTmp=cur?{type:cur.type,value:String(cur.value),reason:cur.reason||''}:{type:'total',value:'',reason:''};if(discTmp.reason&&!DISCOUNT_REASONS.includes(discTmp.reason)){discTmp.other=discTmp.reason;discTmp.reason='Other'}drawDiscount()}
function drawDiscount(){
  let t=discTmp,sub=ctxSub(discCtx),cur=ctxDiscount(discCtx),lbl={total:'Customer pays ($)',pct:'Percent off (%)',amt:'Amount off ($)'}[t.type];
  openModal(`<div class="row"><h2 style="margin:0">Discount this sale</h2>${closeX()}</div><div class="seg" style="margin-top:12px">${[['total','Set total'],['pct','% off'],['amt','$ off']].map(([k,l])=>`<button class="${t.type===k?'on':''}" onclick="discTmp.type='${k}';discTmp.value='';drawDiscount()">${l}</button>`).join('')}</div><label for="discVal">${lbl}</label><input id="discVal" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(t.value)}" placeholder="${t.type==='total'?'e.g. '+Math.max(0,Math.floor(sub*0.9)):t.type==='pct'?'e.g. 10':'e.g. 5'}" oninput="discTmp.value=this.value;discPreview()">${t.type==='pct'?`<div class="chips">${[10,15,20,25].map(v=>`<button class="chipbtn ${num(t.value)===v&&t.value!==''?'on':''}" onclick="discTmp.value='${v}';drawDiscount()">${v}%</button>`).join('')}</div>`:''}<div class="hint">${t.type==='total'?`Instead of ${cash(sub)}. Great for “3 for $70” deals.`:`Full price ${cash(sub)}.`}</div><label>Reason <span class="hint" style="font-weight:600">(shows in Reports)</span></label><div class="chips">${DISCOUNT_REASONS.map((r,i)=>`<button class="chipbtn ${t.reason===r?'on':''}" aria-pressed="${t.reason===r}" onclick="discTmp.reason=DISCOUNT_REASONS[${i}];drawDiscount()">${esc(r)}</button>`).join('')}</div>${t.reason==='Other'?`<input id="discOther" style="margin-top:8px" placeholder="Describe it (optional)" value="${esc(t.other||'')}" oninput="discTmp.other=this.value">`:''}<div id="discPreview" class="previewbox">${discPreviewHtml()}</div><div class="actions">${cur?'<button class="danger" onclick="applyDiscount(true)">Remove discount</button>':''}<button onclick="applyDiscount()">Apply discount</button></div>`);
  setTimeout(()=>{let e=$('discVal');if(e&&!t.value)e.focus()},60)
}
function discFromTmp(){let t=discTmp;return {type:t.type,value:num(t.value),reason:t.reason==='Other'?(normName(t.other||'')||'Other'):(t.reason||'Discount')}}
function discPreviewHtml(){let sub=ctxSub(discCtx),t=discTmp,d=discFromTmp(),a=t.value===''?0:discountAmount(sub,d),warn=t.value!==''&&((t.type==='total'&&num(t.value)>=sub)||(t.type!=='total'&&a<=0))?'<div class="hint warn-text">That isn’t a discount. Check the number.</div>':(t.type==='pct'&&num(t.value)>100)?'<div class="hint warn-text">Can’t be more than 100%.</div>':'';return `<div class="row"><span>Subtotal</span><span>${cash(sub)}</span></div><div class="row discline"><span>Discount${a&&sub?` (${Math.round(a/sub*1000)/10}% off)`:''}</span><span>−${cash(a)}</span></div><div class="row totalrow"><b>New total</b><span class="bigtotal">${cash(sub-a)}</span></div>${warn}${taxRate()&&data.settings.taxOnSales?'<div class="hint">Tax, if added, is worked out on the new total.</div>':''}`}
function discPreview(){let e=$('discPreview');if(e)e.innerHTML=discPreviewHtml()}
function applyDiscount(remove){
  let d=null;
  if(!remove){let t=discTmp,sub=ctxSub(discCtx);if(t.value===''||!(Number(t.value)>=0))return needField('discVal','Enter the '+(t.type==='total'?'price the customer pays.':t.type==='pct'?'percent off.':'amount off.'));d=discFromTmp();if(t.type==='total'&&d.value>=sub)return needField('discVal',`The new total has to be less than ${cash(sub)}.`);if(t.type==='pct'&&d.value>100)return needField('discVal','Enter a percent between 1 and 100.');if(discountAmount(sub,d)<=0)return needField('discVal','That isn’t a discount. Check the number.')}
  if(discCtx==='draft'){saleAdj.discount=d;closeModal();render();flash(d?'Discount added.':'Discount removed.');return}
  let o=data.orders.find(x=>x.id===discCtx);if(!o)return closeModal();o.discount=d;recomputeOrder(o.id);save();closeModal();render();flash(d?'Discount updated.':'Discount removed.')
}

// ---- Change one item's price ----
function priceItems(ctx){if(ctx==='draft')return computeOrder(marketSaleDraft,saleAdj).lines.map(l=>({key:l.pid,name:l.name,qty:l.qty,list:l.list,price:l.price,reason:l.reason}));return orderLines(ctx).map(x=>({key:x.id,name:product(x.productId)?.name||'Deleted product',qty:num(x.qty),list:num(x.listPrice??x.price),price:num(x.price),reason:x.priceReason||''}))}
function openPriceEdit(ctx='draft',key){let items=priceItems(ctx);if(!items.length)return;let it=items.find(i=>i.key===key)||items[0];priceTmp={ctx,key:it.key,price:String(it.price),reason:it.reason&&!PRICE_REASONS.includes(it.reason)?'Other':it.reason,other:it.reason&&!PRICE_REASONS.includes(it.reason)?it.reason:''};drawPriceEdit()}
function drawPriceEdit(){
  let t=priceTmp,items=priceItems(t.ctx),it=items.find(i=>i.key===t.key)||items[0];
  openModal(`<div class="row"><h2 style="margin:0">Change a price</h2>${closeX()}</div>${items.length>1?`<label>Which item?</label><div class="picklist" style="max-height:none">${items.map(i=>`<button class="pick ${i.key===it.key?'on':''}" onclick="priceTmp.key='${i.key}';priceTmp.price='${i.price}';priceTmp.reason='';priceTmp.other='';drawPriceEdit()"><span class="grow">${esc(i.name)} ×${i.qty}</span><span class="muted">${cash(i.price)} each</span></button>`).join('')}</div>`:`<p class="muted" style="margin:10px 0 0"><b>${esc(it.name)}</b> ×${it.qty}</p>`}<label for="pxVal">Price for this sale (each)</label><input id="pxVal" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(t.price)}" oninput="priceTmp.price=this.value;pxPreview()"><div class="hint" id="pxPreview">${pxPreviewHtml(it)}</div><label>Reason</label><div class="chips">${PRICE_REASONS.map((r,i)=>`<button class="chipbtn ${t.reason===r?'on':''}" aria-pressed="${t.reason===r}" onclick="priceTmp.reason=PRICE_REASONS[${i}];drawPriceEdit()">${esc(r)}</button>`).join('')}</div>${t.reason==='Other'?`<input id="pxOther" style="margin-top:8px" placeholder="Describe it (optional)" value="${esc(t.other||'')}" oninput="priceTmp.other=this.value">`:''}<div class="tip" style="margin-top:12px">Only changes this sale. ${esc(it.name)} stays ${cash(it.list)} in your products.</div><div class="actions">${it.price!==it.list?'<button class="alt" onclick="savePrice(true)">Back to regular price</button>':''}<button onclick="savePrice()">Save price</button></div>`)
}
function pxPreviewHtml(it){let v=priceTmp.price===''?NaN:Number(priceTmp.price);if(!(v>=0))return `Regular price ${cash(it.list)}`;let off=round2(it.list-v);return `Regular price ${cash(it.list)}${off>0?` · ${cash(off)} off (${Math.round(off/it.list*100)}%)`:off<0?` · ${cash(-off)} more`:''}`}
function pxPreview(){let items=priceItems(priceTmp.ctx),it=items.find(i=>i.key===priceTmp.key);let e=$('pxPreview');if(e&&it)e.textContent=pxPreviewHtml(it)}
function savePrice(reset){
  let t=priceTmp,items=priceItems(t.ctx),it=items.find(i=>i.key===t.key);if(!it)return closeModal();
  let v=reset?it.list:Number(t.price);if(!reset&&(t.price===''||!(v>=0)))return needField('pxVal','Enter the price for this sale.');v=round2(v);
  let reason=v===it.list?'':(t.reason==='Other'?(normName(t.other||'')||'Other'):(t.reason||'Price change'));
  if(t.ctx==='draft'){if(v===it.list)delete saleAdj.prices[it.key];else saleAdj.prices[it.key]={price:v,reason};closeModal();render();flash(v===it.list?'Back to the regular price.':`${it.name}: ${cash(v)} for this sale.`);return}
  let x=data.sales.find(s=>s.id===it.key);if(!x)return closeModal();if(x.listPrice==null)x.listPrice=num(x.price);x.price=v;if(reason)x.priceReason=reason;else delete x.priceReason;recomputeOrder(x.orderId);save();closeModal();render();flash('Price updated.')
}

// ---- Review & payment ----
function saleReview(){
  let quick=saleKind==='quick',m=quick?null:data.markets.find(x=>x.id===marketSelected);if(!quick&&!m)return '<p>Market not found.</p>';
  let o=computeOrder(marketSaleDraft,saleAdj);if(!marketSaleMode||!o.items)return `${backBtn()}<div class="panel" style="margin-top:12px"><p class="muted">There's no sale in progress.</p></div>`;
  let d=saleAdj.discount,meth=payTmp.method,cardSq=meth==='card'&&squareOn(),given=payTmp.given===''?NaN:Number(payTmp.given);
  let lines=o.lines.map(l=>`<div class="row rline"><span class="grow">${esc(l.name)} × ${l.qty}${l.price!==l.list?`<span class="hint block">${esc(l.reason||'Price change')} · ${cash(l.price)} each</span>`:''}</span><span>${l.price!==l.list?`<s class="hint">${cash(l.qty*l.list)}</s> `:''}${cash(l.qty*l.price)}</span></div>`).join('');
  return `${backBtn()}<h2 style="margin-top:12px">Review sale</h2><div class="muted" style="margin:-8px 0 12px;font-weight:700">${m?esc(m.name):'Quick sale'}</div><div class="panel">${lines}<div class="divider" style="height:1.5px;margin:10px 0"></div><div class="row"><span class="muted">Subtotal</span><span>${cash(o.sub)}</span></div>${o.disc?`<div class="row discline"><span>${esc(discLabel(d,o.sub))}</span><span>−${cash(o.disc)}</span></div><div class="linkrow"><button class="linkbtn" onclick="openDiscount()">Edit discount</button><button class="linkbtn" onclick="saleAdj.discount=null;render()">Remove</button></div>`:`<div class="linkrow"><button class="linkbtn" onclick="openDiscount()">+ Add a discount</button><button class="linkbtn" onclick="openPriceEdit()">Change a price</button></div>`}${o.tax?`<div class="row"><span class="muted">Tax (${num(taxRate())}%)</span><span>${cash(o.tax)}</span></div>`:''}<div class="divider" style="height:1.5px;margin:10px 0"></div><div class="row totalrow"><b>Total</b><span class="bigtotal">${cash(o.total)}</span></div></div><div class="panel"><div class="eyebrow">How are they paying?</div><div class="paygrid">${PAY_METHODS.map(([k,l])=>`<button class="paybtn ${meth===k?'on':''}" aria-pressed="${meth===k}" onclick="payTmp.method='${k}';payTmp.touched=true;render()">${k==='card'?ic('card',18):''}${l}${k==='card'&&squareOn()?'<span class="sqtag">Square</span>':''}</button>`).join('')}</div>${meth==='cash'?`<label for="cashGiven">Cash given (optional)</label><input id="cashGiven" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(payTmp.given)}" placeholder="${cash(o.total)}" oninput="payTmp.given=this.value;let c=$('changeDue');if(c)c.innerHTML=changeHtml(${o.total})"><div id="changeDue">${changeHtml(o.total)}</div>`:''}${cardSq?`<p class="hint">Square opens with ${cash(o.total)} ready. After the payment, Square brings you back here and the sale is saved.</p>`:meth==='card'?`<p class="hint">Records a card payment taken on your own reader. Turn on Square in Settings › Payments to open Square automatically.</p>`:''}</div><button class="btn-wide" onclick="completeSale()">${cardSq?`${ic('card',18)} Charge ${cash(o.total)} with Square`:`Complete sale · ${cash(o.total)}`}</button>`
}
function changeHtml(total){let g=payTmp.given===''?NaN:Number(payTmp.given);if(!(g>=0))return '';let c=round2(g-total);return c<0?`<div class="row" style="margin-top:8px;color:var(--bad);font-weight:800"><span>Still owing</span><span>${cash(-c)}</span></div>`:`<div class="row" style="margin-top:8px;color:var(--good);font-weight:800"><span>Change</span><span>${cash(c)}</span></div>`}
function stockProblem(mid,draft){let m=mid?data.markets.find(x=>x.id===mid):null;for(let [pid,q] of Object.entries(draft||{})){if(!q)continue;let p=product(pid);if(!p||q>num(p.stock)||(mid&&q>num(m?.items?.[pid])))return true}return false}
async function completeSale(){
  let mid=saleKind==='quick'?null:marketSelected,m=mid?data.markets.find(x=>x.id===mid):null,o=computeOrder(marketSaleDraft,saleAdj);if((mid&&!m)||!o.items)return;
  if(stockProblem(mid,marketSaleDraft))return appAlert('Stock has changed since this sale started. Please check the items and try again.');
  if(payTmp.method==='cash'&&payTmp.given!==''&&Number(payTmp.given)<o.total&&!await appConfirm(`Cash given is less than the ${cash(o.total)} total. Complete the sale anyway?`,{ok:'Complete sale'}))return;
  if(payTmp.method==='card'&&squareOn())return startSquare(o);
  let pay={method:payTmp.method};if(payTmp.method==='cash'&&payTmp.given!=='')pay.cashGiven=num(payTmp.given);
  finalizeOrder(mid,marketSaleDraft,saleAdj,pay);afterSale(o.total)
}
function backWithNotice(msg){notice=msg;goBack();setTimeout(()=>{if(notice===msg){notice='';$('notice')?.remove()}},4000)}
function afterSale(total){let msg=`Sale completed · ${cash(total)}. Inventory updated.`;if(screen==='saleReview')backWithNotice(msg);else toast(msg)}
function finalizeOrder(mid,draft,adj,payment,force){
  let m=mid?data.markets.find(x=>x.id===mid):null;if(mid&&!m)return null;if(!force&&stockProblem(mid,draft))return null;
  let o=computeOrder(draft,adj),oid=id(),date=new Date().toISOString();if(m)m.items||={};
  for(let l of o.lines){if(!l.p)continue;l.p.stock=Math.max(0,num(l.p.stock)-l.qty);if(m){m.items[l.pid]=num(m.items[l.pid])-l.qty;if(m.items[l.pid]<=0)delete m.items[l.pid]}else trimAllocations(l.pid);let rec={id:id(),orderId:oid,marketId:mid||null,productId:l.pid,qty:l.qty,listPrice:l.list,price:l.price,disc:l.disc,tax:l.tax,taxed:l.taxed,taxRate:taxRate(),date,estimatedMaterialCost:recipeCost(l.p)};if(l.price!==l.list)rec.priceReason=l.reason||'Price change';data.sales.push(rec)}
  data.orders.push({id:oid,marketId:mid||null,date,full:o.full,subtotal:o.sub,discount:adj.discount?{...adj.discount,amount:o.disc}:null,tax:o.tax,total:o.total,payment:payment||{method:''}});
  marketSaleMode=false;resetSale();save();return oid
}
function orderLines(oid){return data.sales.filter(s=>s.orderId===oid)}
function recomputeOrder(oid){
  let o=data.orders.find(x=>x.id===oid),ls=orderLines(oid);if(!o||!ls.length)return;
  let lines=ls.map(x=>({x,qty:num(x.qty),price:num(x.price)})),sub=round2(lines.reduce((a,l)=>a+l.qty*l.price,0)),disc=discountAmount(sub,o.discount);allocate(lines,disc);
  let tax=0;for(let l of lines){l.x.disc=l.disc;let taxed=l.x.taxed??num(l.x.tax)>0;l.x.taxed=taxed;l.x.tax=taxed?round2((l.qty*l.price-l.disc)*num(l.x.taxRate??taxRate())/100):0;tax+=l.x.tax}
  Object.assign(o,{full:round2(ls.reduce((a,x)=>a+lineFull(x),0)),subtotal:sub,tax:round2(tax),total:round2(sub-disc+tax)});if(o.discount)o.discount.amount=disc
}

// ---- Square Point of Sale ----
const SQ_CALLBACK=()=>location.origin+'/';
function squareNote(o,adj){let items=o.lines.map(l=>l.name+(l.qty>1?' x'+l.qty:'')).join(', ');return ('Crochet Studio: '+items+(o.disc?` (${adj.discount?.reason||'Discount'} -${cash(o.disc)})`:'')).slice(0,480)}
function isAndroid(){return /android/i.test(navigator.userAgent)}
function launchSquare(cents,note,ref){
  let cb=SQ_CALLBACK();
  if(isAndroid()){let p=['action=com.squareup.pos.action.CHARGE','package=com.squareup','S.browser_fallback_url='+encodeURIComponent(cb+'?square=noapp'),'S.com.squareup.pos.WEB_CALLBACK_URI='+encodeURIComponent(cb),'S.com.squareup.pos.CLIENT_ID='+SQ_APP_ID,'S.com.squareup.pos.API_VERSION=v2.0','i.com.squareup.pos.TOTAL_AMOUNT='+cents,'S.com.squareup.pos.CURRENCY_CODE='+sqCurrency(),...(lsGet('csSquareBasic',false)?['S.com.squareup.pos.TENDER_TYPES=com.squareup.pos.TENDER_CARD']:['S.com.squareup.pos.TENDER_TYPES=com.squareup.pos.TENDER_CARD,com.squareup.pos.TENDER_CARD_ON_FILE','S.com.squareup.pos.NOTE='+encodeURIComponent(note)]),'S.com.squareup.pos.REQUEST_METADATA='+ref];window.__sqUrl='intent:#Intent;'+p.join(';')+';end';location.href=window.__sqUrl;watchSquareOpen();return true}
  if(isIOS()){let d={amount_money:{amount:cents,currency_code:sqCurrency()},callback_url:cb,client_id:SQ_APP_ID,version:'1.3',notes:lsGet('csSquareBasic',false)?'':note,state:ref,options:{supported_tender_types:lsGet('csSquareBasic',false)?['CREDIT_CARD']:['CREDIT_CARD','CARD_ON_FILE'],auto_return:true,clear_default_fees:true}};window.__sqUrl='square-commerce-v1://payment/create?data='+encodeURIComponent(JSON.stringify(d));location.href=window.__sqUrl;watchSquareOpen();return true}
  appAlert('Square card payments work on a phone or tablet with the Square Point of Sale app installed.');return false
}
function startSquare(o){
  let cents=Math.round(o.total*100);if(cents<100)return appAlert('Square needs a total of at least $1.00.');
  let ref=id(),pend={ref,kind:saleKind,marketId:saleKind==='quick'?null:marketSelected,draft:{...marketSaleDraft},adj:JSON.parse(JSON.stringify(saleAdj)),total:o.total,cents,at:Date.now()};
  lsSet('csSquarePending',pend);lastSquareRef=ref;flushSave();
  if(!launchSquare(cents,squareNote(o,saleAdj),ref))lsSet('csSquarePending',null)
}
function squareTest(){let ref=id();lsSet('csSquarePending',{ref,test:true,total:1,cents:100,at:Date.now()});if(!launchSquare(100,'Crochet Studio test payment',ref))lsSet('csSquarePending',null)}
function friendlySquareErr(code,desc){let c=String(code||'').toUpperCase();if(/CANCEL/.test(c))return 'The Square payment was cancelled. The sale is still open, so you can try again or choose another way to pay.';if(/NOT_LOGGED_IN|NO_EMPLOYEE|USER_NOT_ACTIVE/.test(c))return 'Sign in to the Square Point of Sale app (and choose your location) first, then try again.';if(/UNAUTHORIZED_CLIENT|CLIENT_NOT_AUTHORIZED/.test(c))return "Square didn't recognise Crochet Studio. Check the Point of Sale API settings in the Square Developer account.";if(/NO_NETWORK|NO_NETWORK_CONNECTION/.test(c))return "Square couldn't connect to the internet. The sale is still open.";if(/UNSUPPORTED_(WEB_)?API_VERSION/.test(c))return 'Please update the Square Point of Sale app, then try again.';if(/ALREADY_IN_PROGRESS/.test(c))return 'Square already has a payment in progress. Finish or cancel it in Square, then try again.';if(/CURRENCY/.test(c))return `Your Square account uses a different currency. Crochet Studio sent ${sqCurrency()}. Change it in Settings › Country & currency.`;if(/INVALID_REQUEST/.test(c))return `Square turned down the request. Please check:\n\n1. Settings › Country & currency matches your Square account's country (now ${sqCurrency()==='USD'?'United States · USD':'Canada · CAD'}).\n2. The Square Point of Sale app is up to date (check the Play Store or App Store).\n3. You're signed in to Square with your location chosen.\n\nThen tap Card again. The next try sends a simpler request. The sale is still open.`;return `Square couldn't take the payment${c?` (${esc(code)})`:''}. The sale is still open.`}
function restoreDraft(p){if(!p||p.test)return;saleKind=p.kind==='quick'?'quick':'market';if(p.marketId)marketSelected=p.marketId;marketSaleMode=true;marketSaleDraft=p.draft||{};saleAdj=p.adj||{prices:{},discount:null};payTmp={method:'card',given:'',touched:true};navStack=[];screen=saleKind==='quick'?'quickSale':'marketDetail';setTimeout(()=>{go('saleReview')},0)}
async function finishSquare(p,res){
  lsSet('csSquarePending',null);lsSet('csLastSquareErr',null);
  if(p.test){await appAlert(`Square test worked! ${res.txn?'':'(No receipt number came back, which happens with offline payments.) '}Remember to refund the $1.00 in the Square app.`,'Square is connected');return}
  let oid=finalizeOrder(p.marketId,p.draft,p.adj,{method:'card',via:'square',ref:p.ref||'',squareTxn:res.txn||'',squareClientTxn:res.client||'',offline:!res.txn&&!res.manual,confirmedManually:!!res.manual},true);
  navStack=[];if(p.kind==='quick'){saleKind='quick';screen='quickSale'}else{marketSelected=p.marketId;screen='marketDetail'}render();scrollTo(0,0);
  toast(oid?`Card payment approved · ${cash(p.total)}. Sale saved.`:'Payment approved, but the sale could not be saved. Please add it by hand.');if(oid&&!isStandalone())setTimeout(()=>appAlert(`The ${cash(p.total)} sale is saved.\n\nSquare opened this in your web browser. If you use the installed Crochet Studio app, close this browser tab and go back to the app. The sale will be there.`,'Payment approved'),400)
}
async function handleSquareReturn(){
  let q=new URLSearchParams(location.search);
  if(q.get('square')==='noapp'){history.replaceState(null,'',location.pathname);let p=lsGet('csSquarePending',null);lsSet('csSquarePending',null);restoreDraft(p);setTimeout(()=>appAlert("Square Point of Sale isn't installed on this phone. Install it from the Play Store, sign in, and try again."),300);return true}
  let android=['SERVER_TRANSACTION_ID','CLIENT_TRANSACTION_ID','ERROR_CODE'].some(k=>q.has('com.squareup.pos.'+k)),ios=q.get('data');
  if(!android&&!ios)return false;
  let res;
  if(android)res={ok:!q.get('com.squareup.pos.ERROR_CODE'),txn:q.get('com.squareup.pos.SERVER_TRANSACTION_ID')||'',client:q.get('com.squareup.pos.CLIENT_TRANSACTION_ID')||'',err:q.get('com.squareup.pos.ERROR_CODE')||'',desc:q.get('com.squareup.pos.ERROR_DESCRIPTION')||''};
  else{let j={};try{j=JSON.parse(ios)}catch{}res={ok:j.status==='ok',txn:j.transaction_id||'',client:j.client_transaction_id||'',err:j.error_code||''}}
  try{history.replaceState(null,'',location.pathname)}catch{}
  let p=lsGet('csSquarePending',null);
  if(!p){if(res.ok)setTimeout(()=>appAlert('The Square payment was approved. Go back to the Crochet Studio app on your home screen to finish the sale.','Payment approved'),300);return true}
  if(res.ok)await finishSquare(p,res);
  else{lsSet('csSquarePending',null);lsSet('csLastSquareErr',{code:res.err||'',desc:res.desc||'',at:Date.now()});if(/INVALID_REQUEST/i.test(res.err||''))lsSet('csSquareBasic',true);restoreDraft(p);let msg=friendlySquareErr(res.err,res.desc)+(isStandalone()?'':'\n\nIf you use the installed Crochet Studio app, close this browser tab and go back to it.');setTimeout(()=>appAlert(msg,p.test?'Square test':''),300)}
  return true
}
let sqAsking=false;
function watchSquareOpen(){
  let away=false,h=()=>{if(document.visibilityState==='hidden')away=true};
  document.addEventListener('visibilitychange',h);addEventListener('pagehide',h);
  setTimeout(()=>{document.removeEventListener('visibilitychange',h);removeEventListener('pagehide',h);
    let p=lsGet('csSquarePending',null);if(away||!p||document.visibilityState!=='visible')return;
    lsSet('csSquarePending',null);lsSet('csLastSquareErr',{code:'SQUARE_DID_NOT_OPEN',desc:'',at:Date.now()});
    let dev=isIOS()?(/ipad/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?'iPad':'iPhone'):'phone';
    appDialog({title:"Square didn't open",message:`Nothing was charged${p.test?'':', and the sale is still open'}.\n\nMake sure the Square Point of Sale app is installed on this ${dev} and signed in, then try again${p.test?'':', or choose another way to pay'}.\n\nYou can get it from the ${isIOS()?'App Store':'Play Store'}.`,ok:'OK'});
  },4000);
}
async function checkSquarePending(){
  let p=lsGet('csSquarePending',null);if(!p||sqAsking||Date.now()-p.at<2500)return;
  sqAsking=true;
  try{
    let paid=await appDialog({title:'Did the Square payment go through?',message:`Crochet Studio didn't hear back from Square for the ${cash(p.total)} ${p.test?'test ':''}payment.\n\nCheck the Square app. Was the payment approved?`,ok:'Yes, it was paid',cancel:'No, not paid'});
    if(lsGet('csSquarePending',null)?.ref!==p.ref)return;
    if(paid)await finishSquare(p,{ok:true,manual:true});
    else{lsSet('csSquarePending',null);restoreDraft(p);flash('The sale is still open.')}
  }finally{sqAsking=false}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(checkSquarePending,1500)});

// ---- Settings › Payments ----
function settingsPayments(){let on=squareOn();return `${backBtn()}<h2 style="margin-top:12px">Payments</h2><div class="panel"><label class="check" style="margin-top:0"><input type="checkbox" id="sqOn" ${on?'checked':''} onchange="data.settings.squareEnabled=this.checked;save();render()"> Use Square for card payments</label><p class="hint">When a customer pays by card, Crochet Studio opens the <b>Square Point of Sale</b> app with the total ready. After the payment, Square brings you back and the sale is saved.</p></div>${on?`<div class="panel"><h3>Before your first sale</h3><ol class="steps"><li>Install <b>Square Point of Sale</b>, sign in to your Square account and choose your location.</li><li>Connect your card reader in the Square app, if you use one.</li><li>If Crochet Studio adds tax to your sales, turn off Square's own sales tax so it isn't charged twice.</li><li>Run a $1.00 test below, then refund it in Square.</li></ol><p class="hint">Payments go to your own Square account and Square's normal card fees apply. Square charges in ${sqCurrency()==='USD'?'US dollars (USD)':'Canadian dollars (CAD)'}, your app's currency. Change it in Settings › Country &amp; currency; it must match your Square account's country. You need the Square Point of Sale app on this device; being signed in to Square in a web browser won't work.</p><button class="alt" onclick="squareTest()">${ic('card',18)} Test Square with $1.00</button></div>`:''}<div class="panel muted">Cash, card on your own reader and e-transfer can always be recorded at checkout.</div>`}

// ---- Sales list & editing ----
function orderGroups(mid){
  let groups={};for(let s of data.sales.filter(s=>mid?s.marketId===mid:!s.marketId)){let k=s.orderId||('legacy:'+s.id);(groups[k]=groups[k]||[]).push(s)}
  return Object.entries(groups).map(([k,ls])=>{let o=k.startsWith('legacy:')?null:data.orders.find(x=>x.id===k),rev=round2(ls.reduce((a,x)=>a+lineRev(x),0)),full=round2(ls.reduce((a,x)=>a+lineFull(x),0)),tax=round2(ls.reduce((a,x)=>a+num(x.tax),0));return {key:k,order:o,lines:ls,date:ls[0].date,rev,full,disc:round2(full-rev),tax,total:round2(rev+tax),method:o?.payment?.method||''}}).sort((a,b)=>String(b.date).localeCompare(String(a.date)))
}
function discountPills(g){let r=[];if(g.order?.discount&&num(g.order.discount.amount))r.push(`${g.order.discount.reason||'Discount'} −${cash(g.order.discount.amount)}`);for(let x of g.lines){let pd=round2(num(x.qty)*(num(x.listPrice??x.price)-num(x.price)));if(pd>0)r.push(`${x.priceReason||'Price change'} −${cash(pd)}`)}return r.map(t=>`<span class="pill">${esc(t)}</span>`).join(' ')}
function salesLinkPanel(m){let gs=orderGroups(m.id);if(!gs.length)return '';let rev=gs.reduce((a,g)=>a+g.rev,0);return `<button class="rowbtn saleslink" onclick="go('marketSales')"><div class="row"><span>${ic('receipt',18)} <b>Sales</b> · ${gs.length} sale${gs.length>1?'s':''}</span><span><b>${cash(rev)}</b> <span class="chev" aria-hidden="true">›</span></span></div></button>`}
function marketSales(){
  let m=marketSelected?data.markets.find(x=>x.id===marketSelected):null;if(marketSelected&&!m)return '<p>Market not found.</p>';let gs=orderGroups(m?m.id:null),full=gs.reduce((a,g)=>a+g.full,0),disc=gs.reduce((a,g)=>a+g.disc,0),rev=gs.reduce((a,g)=>a+g.rev,0),tax=gs.reduce((a,g)=>a+g.tax,0);
  return `${backBtn()}<h2 style="margin-top:12px">Sales</h2><div class="muted" style="margin:-8px 0 12px;font-weight:700">${m?esc(m.name):'Quick sales'} · ${gs.length} sale${gs.length===1?'':'s'} · tap one to fix a mistake</div><div class="grid tiles3"><div class="panel"><div class="muted">Full price</div><div class="stat">${cash(full)}</div></div><div class="panel"><div class="muted">Discounts</div><div class="stat neg">−${cash(disc)}</div></div><div class="panel"><div class="muted">Sales</div><div class="stat pos">${cash(rev)}</div></div></div>${tax?`<p class="hint" style="margin:0 6px 10px">Plus ${cash(tax)} tax collected.</p>`:''}<div class="panel" style="padding:4px 14px">${gs.map(g=>`<button class="salerow" onclick="go('saleEdit',()=>{selected='${g.key}'})"><span class="grow"><b>${new Date(g.date).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}${new Date(g.date).toDateString()!==new Date().toDateString()?' · '+new Date(g.date).toLocaleDateString(undefined,{month:'short',day:'numeric'}):''} · ${g.lines.reduce((a,x)=>a+num(x.qty),0)} item${g.lines.reduce((a,x)=>a+num(x.qty),0)===1?'':'s'}${g.method?' · '+payLabel(g.method):''}</b><span class="muted block">${esc(g.lines.map(x=>(product(x.productId)?.name||'Deleted product')+(num(x.qty)>1?' ×'+x.qty:'')).join(', '))}</span>${g.disc?`<span class="pills">${discountPills(g)}</span>`:''}</span><b>${cash(g.total)}</b><span class="chev" aria-hidden="true">›</span></button>`).join('')||'<p class="muted">No sales yet.</p>'}</div>`
}
function ensureOrder(key){if(!String(key).startsWith('legacy:'))return key;let s=data.sales.find(x=>x.id===key.slice(7));if(!s)return null;let oid=id();s.orderId=oid;if(s.listPrice==null)s.listPrice=num(s.price);data.orders.push({id:oid,marketId:s.marketId,date:s.date,discount:null,payment:{method:''}});recomputeOrder(oid);save();selected=oid;return oid}
function saleEdit(){
  let key=selected,m=marketSelected?data.markets.find(x=>x.id===marketSelected):null,g=orderGroups(m?m.id:null).find(x=>x.key===key);if(!g)return `${backBtn()}<div class="panel" style="margin-top:12px"><p class="muted">This sale no longer exists.</p></div>`;
  let o=g.order,d=o?.discount,sq=o?.payment?.via==='square',meth=g.method;
  let lines=g.lines.map(x=>{let p=product(x.productId),list=num(x.listPrice??x.price),pr=num(x.price);return `<div class="row rline"><span class="grow">${esc(p?.name||'Deleted product')} × ${x.qty}${pr!==list?`<span class="hint block">${esc(x.priceReason||'Price change')} · ${cash(pr)} each</span>`:''}</span><span>${pr!==list?`<s class="hint">${cash(num(x.qty)*list)}</s> `:''}${cash(num(x.qty)*pr)}</span><button class="iconbtn sm" aria-label="Change price of ${esc(p?.name||'item')}" onclick="openPriceEdit(ensureOrder('${g.key}'),'${x.id}')">${ic('pencil',16)}</button></div>`}).join('');
  return `${backBtn()}<h2 style="margin-top:12px">Sale</h2><div class="muted" style="margin:-8px 0 12px;font-weight:700">${new Date(g.date).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}${m?' · '+esc(m.name):''}</div><div class="panel">${lines}<div class="divider" style="height:1.5px;margin:10px 0"></div><div class="row"><span class="muted">Subtotal</span><span>${cash(round2(g.lines.reduce((a,x)=>a+num(x.qty)*num(x.price),0)))}</span></div>${d&&num(d.amount)?`<div class="row discline"><span>${esc(discLabel(d,o.subtotal))}</span><span>−${cash(d.amount)}</span></div><div class="linkrow"><button class="linkbtn" onclick="openDiscount(ensureOrder('${g.key}'))">Edit discount</button></div>`:`<div class="linkrow"><button class="linkbtn" onclick="openDiscount(ensureOrder('${g.key}'))">+ Add a discount</button></div>`}${g.tax?`<div class="row"><span class="muted">Tax</span><span>${cash(g.tax)}</span></div>`:''}<div class="divider" style="height:1.5px;margin:10px 0"></div><div class="row totalrow"><b>Total</b><span class="bigtotal">${cash(g.total)}</span></div></div><div class="panel"><div class="eyebrow">Paid by</div>${sq?`<p class="muted" style="margin:6px 0 0">Card through Square${o.payment.squareTxn?` · receipt ${esc(String(o.payment.squareTxn).slice(0,10))}…`:o.payment.confirmedManually?' · confirmed by you':' · offline payment'}</p><p class="hint">Changing the price or discount here doesn't change what Square charged. Refund any difference in the Square app.</p>`:`<div class="paygrid">${PAY_METHODS.map(([k,l])=>`<button class="paybtn ${meth===k?'on':''}" aria-pressed="${meth===k}" onclick="setPayMethod('${g.key}','${k}')">${l}</button>`).join('')}</div>`}</div><button class="danger btn-wide" onclick="deleteSale('${g.key}')">Delete this sale</button><p class="hint" style="text-align:center;margin:8px 6px 0">${m&&!m.completed?'Items go back into this market’s inventory.':'Items go back into your stock.'}</p>`
}
function setPayMethod(key,k){let oid=ensureOrder(key);let o=data.orders.find(x=>x.id===oid);if(!o)return;o.payment={...(o.payment||{}),method:k};save();render();flash(`Paid by ${payLabel(k)}.`)}
async function deleteSale(key){
  let m=marketSelected?data.markets.find(x=>x.id===marketSelected):null,g=orderGroups(m?m.id:null).find(x=>x.key===key);if(!g)return;
  let sq=g.order?.payment?.via==='square';
  if(!await appConfirm(`Delete this ${cash(g.total)} sale?\n\n${g.lines.reduce((a,x)=>a+num(x.qty),0)} item(s) go back into ${m&&!m.completed?'this market’s inventory':'your stock'}.${sq?'\n\nThis doesn’t refund the card payment. Refund it in the Square app.':''}`,{ok:'Delete sale',danger:true}))return;
  for(let x of g.lines){let p=product(x.productId);if(p)p.stock=num(p.stock)+num(x.qty);if(m&&!m.completed&&p){m.items||={};m.items[x.productId]=num(m.items[x.productId])+num(x.qty)}}
  let ids=new Set(g.lines.map(x=>x.id));data.sales=data.sales.filter(x=>!ids.has(x.id));if(g.order)data.orders=data.orders.filter(o=>o.id!==g.order.id);
  save();backWithNotice('Sale deleted. Items are back in stock.')
}

// ---- Reports ----
function discountReport(f){
  let byReason={},orders=new Map();
  for(let x of f.sales){let k=x.orderId||x.id;if(!orders.has(k))orders.set(k,{disc:0,method:'',total:0});let og=orders.get(k);og.total+=lineRev(x)+num(x.tax);let o=x.orderId?data.orders.find(z=>z.id===x.orderId):null;og.method=o?.payment?.method||'';
    if(num(x.disc)>0){let r=o?.discount?.reason||'Discount';(byReason[r]=byReason[r]||{amt:0,set:new Set()});byReason[r].amt+=num(x.disc);byReason[r].set.add(k);og.disc+=num(x.disc)}
    let pd=num(x.qty)*(num(x.listPrice??x.price)-num(x.price));if(pd>0.004){let r=x.priceReason||'Price change';(byReason[r]=byReason[r]||{amt:0,set:new Set()});byReason[r].amt+=pd;byReason[r].set.add(k);og.disc+=pd}}
  let rows=Object.entries(byReason).map(([r,v])=>[r,round2(v.amt),v.set.size]).sort((a,b)=>b[1]-a[1]),n=orders.size,dn=[...orders.values()].filter(o=>o.disc>0.004).length,max=rows[0]?.[1]||1;
  let pays={};for(let o of orders.values()){let k=o.method||'';pays[k]=(pays[k]||0)+o.total}
  let disc=f.discounts>0.004?`<div class="panel"><h3>Discounts</h3><div class="grid keep2"><div><div class="muted">At full price</div><div class="stat">${cash(f.full)}</div></div><div><div class="muted">Discounts given</div><div class="stat neg">−${cash(f.discounts)}</div><div class="hint">${f.full?Math.round(f.discounts/f.full*1000)/10:0}% · ${dn} of ${n} sale${n===1?'':'s'}</div></div></div>${rows.length?`<div class="section-label" style="margin:16px 0 8px">By reason</div>${rows.map(([r,a,c])=>`<div class="reasonrow"><div class="row"><span>${esc(r)}</span><b>${cash(a)} · ${c} sale${c===1?'':'s'}</b></div><div class="bar"><div style="width:${Math.max(3,Math.round(a/max*100))}%;background:var(--pink)"></div></div></div>`).join('')}`:'<p class="hint">No discounts in this time frame.</p>'}</div>`:'';
  let known=Object.keys(pays).filter(k=>k);let pay=known.length?`<div class="panel"><h3>How customers paid</h3><div class="grid paystats">${[...PAY_METHODS.map(x=>x[0]).filter(k=>pays[k]),...(pays['']?['']:[])].map(k=>`<div class="paystat"><div class="muted">${payLabel(k)}</div><b>${cash(pays[k])}</b></div>`).join('')}</div><p class="hint">Includes tax collected.</p></div>`:'';
  return disc+pay
}
