// ===== v22: tap empty photo squares, product sort, help buttons, logo goes Home =====
let photoTarget=null;
function photoSlot(src,style,kind,id,label,small){
  if(src)return thumb(src,style);
  const act=`pickPhotoFor('${kind}','${id}')`;
  return `<span role="button" tabindex="0" class="thumb thumb-empty thumb-add${small?' tiny':''}" style="${style}" aria-label="Add a photo of ${esc(label)}" title="Add a photo" onclick="event.stopPropagation();${act}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();${act}}">${ic('camera',small?18:22)}${small?'':'<small>Add photo</small>'}</span>`;
}
function pickPhotoFor(kind,id){
  photoTarget={kind,id};let i=$('slotPhotoInput');
  if(!i){i=document.createElement('input');i.type='file';i.accept='image/*';i.id='slotPhotoInput';i.className='hidden';i.addEventListener('change',slotPhotoChosen);document.body.appendChild(i)}
  i.value='';i.click();
}
function slotPhotoChosen(e){
  let f=e.target.files?.[0],t=photoTarget;photoTarget=null;if(!f||!t)return;
  if(f.type&&!f.type.startsWith('image/'))return appAlert('Choose a photo (JPG or PNG).');
  resizePhoto(f,src=>{
    let list=t.kind==='product'?[product(t.id)]:t.kind==='group'?(matGroupInfo[Number(t.id)]?.items||[]).filter(m=>!(m.photo||m.photos?.length)):[material(t.id)];
    list=list.filter(Boolean);if(!list.length)return;
    for(let o of list){o.photos=[src,...(o.photos||[])];o.photo=src}
    save();softRender();toast('Photo added.');
  },t.kind==='product'?600:480);
}
let productSort=lsGet('csProductSort','name');
const PROD_SORTS=[['name','Name (A–Z)'],['new','Newest first'],['priceHigh','Price (high–low)'],['priceLow','Price (low–high)'],['stockLow','Stock (low–high)'],['stockHigh','Stock (high–low)']];
function sortProducts(list){
  const nm=p=>(p.name||'')+' '+(p.variation||'');
  const f={name:(a,b)=>nm(a).localeCompare(nm(b),undefined,{numeric:true,sensitivity:'base'}),priceHigh:(a,b)=>num(b.price)-num(a.price),priceLow:(a,b)=>num(a.price)-num(b.price),stockLow:(a,b)=>num(a.stock)-num(b.stock),stockHigh:(a,b)=>num(b.stock)-num(a.stock)}[productSort];
  if(productSort==='new')return list.slice().reverse();
  return f?list.slice().sort(f):list;
}
function setProductSort(v){productSort=v;lsSet('csProductSort',v);$('productList').innerHTML=productRows()}
const HELP={
  deduct:['Automatic material deduction','When this is on, adding finished stock to a product (+1, or + Add quantity) also takes the materials it uses out of your material stock.\n\nExample: a Small bee uses 40 g of yarn, 80 g of stuffing and 1 pair of eyes. Add 2 Small bees and 80 g of yarn, 160 g of stuffing and 2 pairs of eyes are taken out.\n\nOnly materials with “Track remaining stock” turned on are changed.'],
  mult:['Default material multiplier','Only used when the pricing method is Materials × multiplier.\n\nThe suggested price is your material cost times this number. Example: $5 of materials × 3 = $15. Labour isn’t added with this method.'],
  markup:['Default markup','Only used when the pricing method is Materials with markup + labour.\n\nThe suggested price is your material cost plus this percentage, plus your hourly labour. Example: $5 of materials with a 50% markup = $7.50, then labour is added.']
};
function showHelp(k){let h=HELP[k];if(h)appDialog({title:h[0],message:h[1],ok:'Got it'})}
function helpBtn(k){return `<button type="button" class="helpq" aria-label="What is this?" onclick="event.preventDefault();event.stopPropagation();showHelp('${k}')">?</button>`}
function brandHome(){if(String(screen).startsWith('auth')||!dataLoaded)return;view('home')}
