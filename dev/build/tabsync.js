// ===== Keep the installed app and browser tabs in step =====
let myStamp='',lastSquareRef=null,tabReloading=false;
(()=>{const _fs=flushSave;flushSave=function(){let q=_fs();q.then(()=>{myStamp=Date.now()+':'+Math.random().toString(36).slice(2);lsSet('csStamp',myStamp)});return q}})();
(()=>{const _pp=pdfPut,_pd=pdfDelete;pdfPut=async function(v){await _pp(v);myStamp=Date.now()+':p';lsSet('csStamp',myStamp)};pdfDelete=async function(pid){await _pd(pid);myStamp=Date.now()+':d';lsSet('csStamp',myStamp)}})();
async function reloadFromOtherTab(){
  if(tabReloading||!dataLoaded)return;tabReloading=true;
  try{
    clearTimeout(saveTimer);saveTimer=null;await saveQueue;
    await loadData();await refreshPdfs();myStamp=lsGet('csStamp','');
    if(lastSquareRef&&data.orders.some(o=>o.payment?.ref===lastSquareRef)){
      let quick=saleKind==='quick',o=data.orders.find(o=>o.payment.ref===lastSquareRef);lastSquareRef=null;marketSaleMode=false;resetSale();closeOverlays();navStack=[];
      if(quick)screen='quickSale';else{marketSelected=o.marketId||marketSelected;screen='marketDetail'}
      render();scrollTo(0,0);toast(`Card payment approved · ${cash(o.total)}. Sale saved.`);return
    }
    if(lastSquareRef&&!lsGet('csSquarePending',null)){lastSquareRef=null}
    softRender()
  }catch(e){console.warn('Reload from other tab',e)}finally{tabReloading=false}
}
addEventListener('storage',e=>{if(e.key==='csStamp'&&e.newValue&&e.newValue!==myStamp)reloadFromOtherTab()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){let st=lsGet('csStamp','');if(st&&myStamp&&st!==myStamp)reloadFromOtherTab()}});
