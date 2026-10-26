// Products: list, folders/tags, sort, detail, add/edit form, supplies used
// Part of the Crochet Studio app. Files load in the order listed in index.html.

function productDetail() {
    let p = product(selected);
    if (!p)
        return '<p>Product not found.</p>';
    return `${backBtn()}<div class="panel" style="margin-top:12px"><div class="item">${photoSlot(p.photo || '', "", 'product', p.id, p.name)}<div class="grow"><h2 style="margin:0">${esc(p.name)}</h2><div class="muted">${esc(p.variation || 'Standard')} · ${cash(p.price)} each</div>${ptags(p).map(c => `<span class="chip" style="display:inline-block;margin:6px 4px 0 0">${ic('tag', 13)} ${esc(c.name)}</span>`).join('')}<div style="margin-top:8px">${reminderToggleBtn('product', p.id, p.name)}</div></div></div><div class="divider"></div><div class="eyebrow">Finished inventory</div><div class="big">${num(p.stock)}</div><label>Quantity to add or remove</label><div class="row" style="justify-content:flex-start"><button class="alt" onclick="changeQty(-1)">−</button><input id="adjustQty" type="number" min="1" step="1" value="1" style="width:100px;text-align:center"><button class="alt" onclick="changeQty(1)">+</button></div><div class="actions"><button onclick="adjustFromField(1)">+ Add quantity</button><button class="alt" onclick="adjustFromField(-1)">− Remove quantity</button></div>${skipMaterialsBox(p)}<div class="hint">${productStockHint(p)}</div></div><div class="panel"><h3>Saved formula</h3>${(p.materials || []).map(x => {
        let m = material(x.materialId);
        return `<div class="muted">${m ? `<b>${esc(mcat(m.categoryId)?.name || '')}:</b> ${esc(materialLabel(m))}` : 'Deleted material'} — ${x.amount} ${esc(num(x.amount) === 1 && m?.unit === 'pair' ? 'pair' : unitShort(m?.unit))}</div>`;
    }).join('') || '<div class="muted">No materials saved.</div>'}<p class="muted">Hook: ${esc(p.hook || '—')}${p.hook && /^[\d.]+$/.test(p.hook) ? ' mm' : ''} · Time: ${num(p.hours)} hours</p><div>Materials: <b>${cash(recipeCost(p))}</b> · ${labourInfo(p).label}: <b>${labourInfo(p).text}</b> · Suggested: <b>${cash(suggest(p))}</b> · Selling: <b>${cash(p.price)}</b></div><div class="actions"><button class="alt" onclick="editProduct('${p.id}')">Edit product</button>${productPatternBtn(p)}<button class="danger" onclick="deleteProduct('${p.id}')">Delete</button></div></div><div class="panel"><h3>Production history</h3>${(p.batches || []).slice().reverse().map(b => `<div class="entry"><b>+${b.qty} made</b> · ${new Date(b.date).toLocaleDateString()}<div class="muted">Material cost each: ${cash(b.unitCost)} · ${b.deducted ? 'Materials deducted' : 'No material deduction'}</div></div>`).join('') || '<div class="muted">No production entries yet.</div>'}</div>`;
}
function changeQty(d) {
    let e = $('adjustQty');
    e.value = Math.max(1, Math.floor(num(e.value) + d));
}
function adjustFromField(d) {
    let q = Number($('adjustQty').value);
    if (!Number.isInteger(q) || q < 1)
        return appAlert('Enter a whole number greater than zero.');
    adjust(selected, q * d, d > 0 ? 'production' : 'correction', { skipMaterials: d > 0 && !!$('skipMats')?.checked });
}
async function adjust(pid, delta, reason, opts = {}) {
    let p = product(pid);
    if (!p)
        return;
    if (p.stock + delta < 0)
        return appAlert('You can’t remove more than you have in stock.');
    let packed = packedFor(pid), after = num(p.stock) + delta;
    if (delta < 0 && after < packed && !await appConfirm(`${packed} ${p.name} ${packed > 1 ? 'are' : 'is'} packed for a market.\n\nRemoving stock will also take ${packed - after} off the market packing list. Continue?`))
        return;
    let took = { ok: true, deducted: false };
    if (delta > 0 && !p.noStockUse && !opts.skipMaterials)
        took = await takeMaterials(p, delta);
    if (!took.ok)
        return;
    p.stock += delta;
    if (delta < 0)
        trimAllocations(pid);
    p.batches ||= [];
    if (delta > 0)
        p.batches.push({ id: id(), qty: delta, unitCost: recipeCost(p), date: new Date().toISOString(), deducted: took.deducted });
    save();
    toast(`${Math.abs(delta)} ${delta > 0 ? 'added to' : 'removed from'} ${p.name} inventory.`);
}
async function deleteProduct(pid) {
    if (!await appConfirm('Delete this product?'))
        return;
    removeProducts([pid]);
    view('products');
}
// Remove products and anything that only made sense with them. Past sales stay in Reports.
function removeProducts(ids) {
    ids = new Set(ids);
    data.products = data.products.filter(p => !ids.has(p.id));
    for (let m of data.markets)
        if (!m.completed && m.items)
            for (let pid of ids)
                delete m.items[pid];
    data.reminders = (data.reminders || []).filter(r => !(r.kind === 'product' && ids.has(r.refId)));
    save();
}
// Swipe left on a product card, then tap Delete
function swipeDeleteProduct(pid) {
    let p = product(pid);
    if (!p)
        return;
    removeProducts([pid]);
    render();
    toast(`${p.name} deleted.`);
}
// ---- Delete several products at once (trash button beside + Tag) ----
let productSelectMode = false, productPicked = new Set();
function startProductSelect() {
    productSelectMode = true;
    productPicked = new Set();
    render();
}
function endProductSelect() {
    productSelectMode = false;
    productPicked = new Set();
    render();
}
function togglePickProduct(pid) {
    productPicked.has(pid) ? productPicked.delete(pid) : productPicked.add(pid);
    $('productList').innerHTML = productRows();
    $('pickBar').outerHTML = productPickBar();
}
function pickAllProducts() {
    let shown = data.products.filter(p => productMatches(p, productFilter));
    productPicked = shown.every(p => productPicked.has(p.id)) ? new Set() : new Set(shown.map(p => p.id));
    $('productList').innerHTML = productRows();
    $('pickBar').outerHTML = productPickBar();
}
function productPickBar() {
    let n = productPicked.size;
    return `<div class="pickbar" id="pickBar"><span class="grow"><b>${n}</b> selected</span><button class="alt small" onclick="pickAllProducts()">Select all</button><button class="danger small" ${n ? '' : 'disabled'} onclick="deletePickedProducts()">${ic('trash', 16)} Delete</button><button class="alt small" onclick="endProductSelect()">Cancel</button></div>`;
}
async function deletePickedProducts() {
    let n = productPicked.size;
    if (!n)
        return;
    if (!await appConfirm(`Delete ${n} product${n > 1 ? 's' : ''}?\n\nThis can't be undone. Past sales of ${n > 1 ? 'them' : 'it'} stay in Reports.`, { ok: `Delete ${n}`, danger: true }))
        return;
    removeProducts([...productPicked]);
    productSelectMode = false;
    productPicked = new Set();
    render();
    toast(`${n} product${n > 1 ? 's' : ''} deleted.`);
}
function productForm() {
    let p = product(editing) || {};
    return `${backBtn()}<div class="panel" style="margin-top:12px"><h2>${editing ? 'Edit' : 'Create'} product</h2><label>Product name</label><input id="pname" value="${esc(p.name || '')}" placeholder="e.g. Crochet Chicken"><label>Variation / colour (optional)</label><input id="pvariation" value="${esc(p.variation || '')}" placeholder="e.g. Yellow"><label>Product photo (optional)</label><button class="alt" onclick="photoMenu(loadPhoto,true)">📷 Add photo</button><div id="photoPreview">${photoGallery("product")}</div><div class="divider"></div><h3 style="font-size:22px">Materials used</h3><div id="supplies">${suppliesHtml()}</div><div class="divider"></div><div class="two"><div><label>Hook size (mm)</label><input id="phook" value="${esc(p.hook || '')}" placeholder="6"></div><div><label>Time to make (hours)</label><input id="phours" type="number" step="any" min="0" inputmode="decimal" placeholder="Required, e.g. 1.5" value="${p.hours ?? ''}" oninput="updatePrice()"></div></div><label>Tags (optional, pick any)</label>${tagPicker()}<label for="ppattern">Linked pattern (optional)</label><select id="ppattern" class="fancy"><option value="">No pattern</option></select><div class="divider"></div><h3>Pricing</h3><label>Pricing method</label><select id="pmethod" onchange="updatePrice()"><option value="labour">Materials + hourly labour</option><option value="multiply">Materials × multiplier</option><option value="markup">Materials with markup + labour</option></select><div id="multiplierControls"><label>Material cost multiplier</label><input id="pmultiplier" type="number" min="0" step="any" value="${p.multiplier ?? data.settings.multiplier}" oninput="updatePrice()"></div><div id="markupControls"><label>Markup: <b id="markupLabel">${p.markup ?? data.settings.markup}%</b></label><input id="pmarkup" type="range" min="0" max="300" step="5" value="${p.markup ?? data.settings.markup}" oninput="updatePrice()"><div class="muted">Slide to change the suggested price live (0–300%).</div></div><div class="panel" style="background:var(--card2);margin-top:15px"><div>Material cost: <b id="materialTotal">—</b></div><div><span id="labourLabel">Labour</span>: <b id="labourTotal">—</b></div><div>Suggested selling price: <b id="suggestTotal">—</b></div></div><label>Actual selling price ($) — editable</label><div class="row"><input id="pprice" type="number" min="0" step="0.01" value="${p.price ?? ''}"><button class="alt small" onclick="useSuggested()">Use suggested</button></div><div class="hint">Suggestions update as you change materials. Your selling price stays editable.</div>${taxOverrideField('p', p, 'product', 'updatePrice()')}${noStockUseField(p)}<label>Finished inventory to add now</label><div class="row" style="justify-content:flex-start"><button class="alt" onclick="stepNumber('pinitialStock',-1)">−</button><input id="pinitialStock" type="number" min="0" step="1" value="0" style="width:95px;text-align:center"><button class="alt" onclick="stepNumber('pinitialStock',1)">+</button></div><div class="hint">Leave at 0 if you have not made this product yet. On existing products, this adds to current stock.</div><div class="actions"><button onclick="saveProduct()">Save product</button></div></div>`;
}
function updatePrice() {
    let method = $('pmethod').value;
    $('multiplierControls').style.display = method === 'multiply' ? 'block' : 'none';
    $('markupControls').style.display = method === 'markup' ? 'block' : 'none';
    $('markupLabel').textContent = $('pmarkup').value + '%';
    let p = getDraft();
    $('materialTotal').textContent = cash(recipeCost(p));
    let lb = labourInfo(p);
    $('labourLabel').textContent = lb.label;
    $('labourTotal').textContent = lb.text;
    $('suggestTotal').textContent = cash(suggest(p));
}
function useSuggested() {
    $('pprice').value = suggest(getDraft());
}
async function saveProduct() {
    let p = getDraft();
    if (!p.name)
        return needField('pname', 'Enter a product name.');
    if (badTaxOverride('p'))
        return needField('pTaxRate', 'Enter a tax rate between 0 and 100 for this product, or untick Override tax settings.');
    if ($('phours').value.trim() === '' || !(Number($('phours').value) >= 0))
        return needField('phours', 'Enter how long this takes to make, in hours. Use 0 if you don’t want to track time.');
    let missing = productLines.find(l => l.materialId && !(num(l.amount) > 0));
    if (missing) {
        $('amt_' + missing.key)?.focus();
        return appAlert(`Enter how much ${materialLabel(material(missing.materialId))} this product uses.`);
    }
    if (!p.materials.length && !await appConfirm('No materials added yet, so the material cost will be $0. Save anyway?'))
        return;
    let price = $('pprice').value === '' ? suggest(p) : num($('pprice').value);
    let initial = Number($('pinitialStock').value);
    if (!Number.isInteger(initial) || initial < 0)
        return appAlert('Enter a valid finished inventory quantity.');
    let pid;
    if (editing) {
        Object.assign(product(editing), p, { price });
        delete product(editing).yarns;
        delete product(editing).extras;
        pid = editing;
    }
    else {
        pid = id();
        data.products.push({ ...p, id: pid, price, stock: 0, batches: [] });
    }
    save();
    for (let t of p.tagIds || [])
        productFolderOpen.add(t);
    if (initial > 0)
        await adjust(pid, initial, 'production');
    goBack();
    toast('Product saved.');
}
function loadPhoto(e) {
    [...(e.target.files || [])].forEach(f => resizePhoto(f, src => {
        productPhotos.push(src);
        refreshPhotos('product');
    }, 600));
}
function pcat(cid) {
    return cid ? data.productCategories.find(c => c.id === cid) : null;
}
// ===== Product form: material sections =====
let productLines = [], productSecs = [], productCatPreset = '';
function lineByFid(fid) {
    return productLines.find(l => 'ln_' + l.key === fid);
}
function initLines(p) {
    productLines = (p?.materials || []).filter(x => material(x.materialId)).map(x => ({ key: id(), catId: material(x.materialId).categoryId, materialId: x.materialId, amount: x.amount }));
    let used = new Set(productLines.map(l => l.catId));
    productSecs = data.materialCategories.filter(c => c.onProducts || used.has(c.id)).map(c => c.id);
    for (let cid of productSecs)
        if (!productLines.some(l => l.catId === cid)) {
            let def = !p && material(mcat(cid)?.defaultMaterialId) ? mcat(cid).defaultMaterialId : '';
            productLines.push({ key: id(), catId: cid, materialId: def, amount: '' });
        }
}
function newProduct(catId) {
    go('productForm', () => {
        editing = null;
        photo = '';
        productPhotos = [];
        productCatPreset = catId || '';
        productTagDraft = catId ? [catId] : [];
        initLines(null);
    });
}
function editProduct(pid) {
    go('productForm', () => {
        editing = pid;
        let p = product(pid);
        photo = p.photo || '';
        productPhotos = [...(p.photos || (photo ? [photo] : []))];
        productCatPreset = '';
        productTagDraft = ptagIds(p);
        initLines(p);
    });
}
function supplyPicker(fid, cid, selectedId) {
    let c = mcat(cid), m = material(selectedId), noun = (c?.name || 'material').toLowerCase();
    return `<input type="hidden" id="${fid}" value="${m ? m.id : ''}">${comboField({ id: fid + 'Q', value: materialLabel(m), placeholder: `Start typing to find ${noun}`, currentLabel: () => materialLabel(material($(fid)?.value)), source: () => data.materials.filter(x => x.categoryId === cid).map(x => ({ label: materialLabel(x), id: x.id, photo: x.photo || x.photos?.[0] || '', sub: `${cash(x.price)} / ${num(x.weight)} ${unitShort(x.unit)}${stockCounts(x) && stockKnown(x) ? ' · ' + stockLine(x) : ''}` })), emptyText: `No ${noun} saved yet. Type a name to add one.`, onPick: it => setPicker(fid, it.id), onCommit: txt => {
            let cur = material($(fid)?.value);
            if (!txt) {
                if (cur)
                    setPicker(fid, '');
                return;
            }
            if (cur && txt === materialLabel(cur))
                return;
            let hit = data.materials.find(x => x.categoryId === cid && materialLabel(x).toLowerCase() === txt.toLowerCase());
            if (hit)
                setPicker(fid, hit.id);
            else {
                let q = $(fid + 'Q');
                if (q)
                    q.value = materialLabel(cur);
            }
        }, onNew: q => openQuickMaterial(cid, q, fid) })}`;
}
function setPicker(fid, mid) {
    let h = $(fid);
    if (h)
        h.value = mid || '';
    let q = $(fid + 'Q');
    if (q)
        q.value = materialLabel(material(mid));
    let l = lineByFid(fid);
    if (l) {
        l.materialId = mid || '';
        let u = $('unit_' + l.key);
        if (u)
            u.textContent = unitShort(material(mid)?.unit || mcat(l.catId)?.unit);
    }
    updatePrice();
}
function lineHtml(l, c) {
    return `<div class="entry line">${supplyPicker('ln_' + l.key, c.id, l.materialId)}<div class="row" style="margin-top:8px;gap:8px;justify-content:flex-start"><label for="amt_${l.key}" style="margin:0;white-space:nowrap">Amount used</label><input id="amt_${l.key}" type="number" min="0" step="any" inputmode="decimal" value="${esc(l.amount ?? '')}" oninput="setLineAmount('${l.key}',this.value)" style="flex:1;min-width:0"><span class="unit" id="unit_${l.key}">${esc(unitShort(material(l.materialId)?.unit || c.unit))}</span><button class="iconbtn sm" aria-label="Remove this ${esc(c.name.toLowerCase())}" onclick="removeLine('${l.key}')">${ic('x', 16)}</button></div></div>`;
}
function suppliesHtml() {
    let secs = data.materialCategories.filter(c => productSecs.includes(c.id)), others = data.materialCategories.filter(c => !productSecs.includes(c.id));
    return secs.map(c => {
        let lines = productLines.filter(l => l.catId === c.id), noun = esc(c.name.toLowerCase());
        return `<div class="supsec"><div class="sechead"><h3>${esc(c.name)}</h3><button class="alt small" onclick="openQuickMaterial('${c.id}')">+ New ${noun}</button></div>${lines.map(l => lineHtml(l, c)).join('')}<div class="actions" style="margin-top:8px"><button class="alt small" onclick="addLine('${c.id}')">+ Add ${lines.length ? 'another ' : ''}${noun}</button><button class="alt small" onclick="removeSec('${c.id}')">Not needed</button></div></div>`;
    }).join('<div class="divider"></div>') + `<div class="divider"></div><div class="hint" style="font-weight:800">Need something else?</div><div class="actions" style="margin-top:6px">${others.map(c => `<button class="alt small" onclick="addSec('${c.id}')">+ ${esc(c.name)}</button>`).join('')}<button class="alt small" onclick="openMatCategoryModal(null,true)">+ New material category</button></div>`;
}
function redrawSupplies() {
    let e = $('supplies');
    if (e)
        e.innerHTML = suppliesHtml();
}
function setLineAmount(key, v) {
    let l = productLines.find(x => x.key === key);
    if (l)
        l.amount = v;
    updatePrice();
}
function addLine(cid) {
    productLines.push({ key: id(), catId: cid, materialId: '', amount: '' });
    redrawSupplies();
}
function removeLine(key) {
    productLines = productLines.filter(l => l.key !== key);
    redrawSupplies();
    updatePrice();
}
function addSec(cid) {
    if (!productSecs.includes(cid))
        productSecs.push(cid);
    if (!productLines.some(l => l.catId === cid))
        productLines.push({ key: id(), catId: cid, materialId: '', amount: '' });
    redrawSupplies();
}
async function removeSec(cid) {
    let n = productLines.filter(l => l.catId === cid && l.materialId).length;
    if (n && !await appConfirm(`Remove ${mcat(cid)?.name} from this product?`))
        return;
    productSecs = productSecs.filter(x => x !== cid);
    productLines = productLines.filter(l => l.catId !== cid);
    redrawSupplies();
    updatePrice();
}
function getDraft() {
    return { name: $('pname').value.trim(), variation: $('pvariation').value.trim(), photo: productPhotos[0] || "", photos: [...productPhotos], hook: $('phook').value, hours: num($('phours').value), materials: productLines.filter(l => l.materialId && num(l.amount) > 0).map(l => ({ materialId: l.materialId, amount: num(l.amount) })), tagIds: [...productTagDraft], categoryId: productTagDraft[0] || '', taxOverride: readTaxOverride('p'), method: $('pmethod').value, multiplier: num($('pmultiplier').value), markup: num($('pmarkup').value), patternId: $('ppattern').value, noStockUse: !!$('pnostock')?.checked };
}
function categoryPicker(selId) {
    let c = pcat(selId);
    return `<input type="hidden" id="pcat" value="${c ? c.id : ''}">${comboField({ id: 'pcatQ', value: c?.name || '', placeholder: 'None — type to pick or create one', currentLabel: () => pcat($('pcat')?.value)?.name || '', source: () => data.productCategories.slice().sort(byName).map(x => ({ label: x.name, id: x.id, sub: `${data.products.filter(p => p.categoryId === x.id).length} product(s)` })), emptyText: 'No categories yet. Type a name to create one.', onPick: it => {
            $('pcat').value = it.id;
        }, onCommit: txt => {
            let cur = pcat($('pcat').value);
            if (!txt) {
                $('pcat').value = '';
                return;
            }
            if (cur && txt === cur.name)
                return;
            let hit = data.productCategories.find(x => x.name.toLowerCase() === txt.toLowerCase());
            if (hit) {
                $('pcat').value = hit.id;
                $('pcatQ').value = hit.name;
            }
            else
                $('pcatQ').value = cur?.name || '';
        }, onNew: q => {
            let nm = normName(q), c2 = data.productCategories.find(x => x.name.toLowerCase() === nm.toLowerCase()) || (() => {
                let n = { id: id(), name: nm };
                data.productCategories.push(n);
                save();
                return n;
            })();
            $('pcat').value = c2.id;
            $('pcatQ').value = c2.name;
            flash(`Category “${c2.name}” ready.`);
        } })}`;
}
// ===== Products page with folders =====
let productFolderOpen = new Set();
function products() {
    return `<div class="row"><h2>Products</h2></div><div class="actions toprow" style="margin:-6px 0 12px"><button onclick="newProduct()">+ Product</button><button class="aqua" onclick="startQuickSale()">Sell</button><button class="alt" onclick="openCategoryModal()">+ Tag</button><button class="alt iconsq" aria-label="Delete products" title="Delete products" onclick="${productSelectMode ? 'endProductSelect()' : 'startProductSelect()'}">${ic('trash', 18)}</button></div>${productSelectMode ? productPickBar() + '<p class="hint" style="margin:-4px 0 8px">Tap the products to delete, then tap Delete. Open a tag to pick products inside it.</p>' : ''}<input placeholder="Search products (name, variation, tag)" aria-label="Search products" value="${esc(productFilter)}" oninput="productFilter=this.value;document.getElementById('productList').innerHTML=productRows()"><select class="fancy" aria-label="Sort products" style="margin-top:10px" onchange="setProductSort(this.value)">${PROD_SORTS.map(([v, l]) => `<option value="${v}" ${productSort === v ? 'selected' : ''}>Sort: ${l}</option>`).join('')}</select><div id="productList" style="margin-top:12px">${productRows()}</div>`;
}
function toggleFolder(cid) {
    productFolderOpen.has(cid) ? productFolderOpen.delete(cid) : productFolderOpen.add(cid);
    let e = $('productList');
    if (e)
        e.innerHTML = productRows();
}
let productSort = lsGet('csProductSort', 'name');
const PROD_SORTS = [['name', 'Name (A–Z)'], ['new', 'Newest first'], ['priceHigh', 'Price (high–low)'], ['priceLow', 'Price (low–high)'], ['stockLow', 'Stock (low–high)'], ['stockHigh', 'Stock (high–low)']];
function sortProducts(list) {
    const nm = p => (p.name || '') + ' ' + (p.variation || '');
    const f = { name: (a, b) => nm(a).localeCompare(nm(b), undefined, { numeric: true, sensitivity: 'base' }), priceHigh: (a, b) => num(b.price) - num(a.price), priceLow: (a, b) => num(a.price) - num(b.price), stockLow: (a, b) => num(a.stock) - num(b.stock), stockHigh: (a, b) => num(b.stock) - num(a.stock) }[productSort];
    if (productSort === 'new')
        return list.slice().reverse();
    return f ? list.slice().sort(f) : list;
}
function setProductSort(v) {
    productSort = v;
    lsSet('csProductSort', v);
    $('productList').innerHTML = productRows();
}
// ---- Tags (product categories can now be several per product) ----
let productTagDraft = [];
function ptagIds(p) {
    let t = Array.isArray(p?.tagIds) ? p.tagIds : (p?.categoryId ? [p.categoryId] : []);
    return t.filter(x => pcat(x));
}
function ptags(p) {
    return ptagIds(p).map(pcat).sort(byName);
}
function hasTag(p, cid) {
    return ptagIds(p).includes(cid);
}
function setTags(p, ids) {
    p.tagIds = [...new Set(ids)].filter(x => pcat(x));
    p.categoryId = p.tagIds[0] || '';
}
function productMatches(p, q) {
    q = String(q || '').toLowerCase().trim();
    if (!q)
        return true;
    return [p.name, p.variation, ...ptags(p).map(c => c.name)].some(x => String(x || '').toLowerCase().includes(q));
}
function productCard(p, inTag) {
    if (productSelectMode) {
        let on = productPicked.has(p.id);
        return `<button type="button" class="panel item pickcard ${on ? 'on' : ''}" aria-pressed="${on}" onclick="togglePickProduct('${p.id}')"><span class="pickbox" aria-hidden="true">${on ? ic('check', 16) : ''}</span>${p.photo ? thumb(p.photo, '') : '<div class="thumb thumb-empty"></div>'}<span class="grow"><span class="item-title">${esc(p.name)}</span><span class="muted block">${cash(p.price)} · ${num(p.stock)} in stock</span></span></button>`;
    }
    let others = inTag ? ptags(p).filter(c => c.id !== inTag) : [];
    return swipeWrap(`<div class="panel item hasbell">${reminderToggleBtn('product', p.id, p.name, true)}${photoSlot(p.photo || '', "", 'product', p.id, p.name)}<div class="grow"><div class="row titlerow"><div class="item-title">${esc(p.name)}</div>${ptagIds(p).length ? '' : `<button class="alt small addcat" onclick="openAddToCategory('${p.id}')">${ic('tag', 14)} Add tag</button>`}</div><div class="muted">${cash(p.price)} · ${num(p.stock)} in stock</div>${others.length ? `<span class="chip tagchip">Also tagged ${others.map(c => esc(c.name)).join(', ')}</span>` : ''}<div class="actions"><button class="alt small" onclick="quickRemove('${p.id}')" aria-label="Remove one ${esc(p.name)} from stock">−1</button><button class="small" onclick="quickAdd('${p.id}')" aria-label="Add one ${esc(p.name)} to stock">+1</button><button class="alt small" onclick="detail('${p.id}')">Open / adjust</button></div></div></div>`, `swipeDeleteProduct('${p.id}')`, p.name);
}
function productRows() {
    let q = productFilter, match = p => productMatches(p, q), loose = sortProducts(data.products.filter(p => !ptagIds(p).length && match(p))), cats = data.productCategories.slice().sort(byName), folders = '';
    for (let c of cats) {
        let items = sortProducts(data.products.filter(p => hasTag(p, c.id) && match(p)));
        if (q.trim() && !items.length && !c.name.toLowerCase().includes(q.toLowerCase().trim()))
            continue;
        let open = (q.trim() && items.length) || productFolderOpen.has(c.id);
        folders += `<div class="folder ${open ? 'open' : ''}"><button class="folder-head" onclick="toggleFolder('${c.id}')" aria-expanded="${!!open}">${ic('tag', 22)}<span class="grow"><b>${esc(c.name)}</b><span class="muted">${items.length} product${items.length === 1 ? '' : 's'}</span></span><span class="chev" aria-hidden="true">›</span></button>${open ? `<div class="folder-body">${items.length ? `<div class="cardgrid">${items.map(p => productCard(p, c.id)).join('')}</div>` : '<p class="muted" style="margin:4px 4px 10px">No products with this tag yet.</p>'}<div class="actions" style="margin:4px 0 2px"><button class="small" onclick="openTagAdd('${c.id}')">+ Add products</button><button class="alt small" onclick="newProduct('${c.id}')">+ New product here</button><button class="alt small" onclick="openCategoryModal('${c.id}')">Rename / delete</button></div></div>` : ''}</div>`;
    }
    if (!loose.length && !folders)
        return '<div class="panel muted">' + (q.trim() ? 'No products match your search.' : 'No products yet. Tap + Product to add your first one.') + '</div>';
    return (loose.length ? `<div class="cardgrid">${loose.map(p => productCard(p)).join('')}</div>` : '') + (folders ? (loose.length ? '<div class="section-label">Tags</div>' : '') + folders : '');
}
function tagModalHtml(pid) {
    let pr = product(pid), cats = data.productCategories.slice().sort(byName), on = new Set(ptagIds(pr));
    return `<div class="row"><h2 style="margin:0">Tags</h2>${closeX()}</div><p class="muted">${esc(pr.name)} · pick any</p>${cats.map(c => `<button class="rowbtn" aria-pressed="${on.has(c.id)}" onclick="toggleProductTag('${pid}','${c.id}')"><div class="row"><b>${on.has(c.id) ? '✓ ' : ''}${esc(c.name)}</b><span class="muted">${data.products.filter(x => hasTag(x, c.id)).length}</span></div></button>`).join('') || '<p class="muted">No tags yet.</p>'}<label for="ncName">${cats.length ? 'Or create a new tag' : 'Create a tag'}</label><div class="row"><input id="ncName" placeholder="e.g. Plushies, Easter" autocapitalize="words" onkeydown="if(event.key==='Enter')createAndAssign('${pid}')"><button onclick="createAndAssign('${pid}')">Add</button></div><div class="actions"><button onclick="closeModal();render()">Done</button></div>`;
}
function openAddToCategory(pid) {
    if (!product(pid))
        return;
    openModal(tagModalHtml(pid));
}
function toggleProductTag(pid, cid) {
    let pr = product(pid);
    if (!pr)
        return;
    let ids = ptagIds(pr);
    setTags(pr, ids.includes(cid) ? ids.filter(x => x !== cid) : [...ids, cid]);
    save();
    openModal(tagModalHtml(pid));
}
function setProductCategory(pid, cid) {
    let pr = product(pid);
    if (!pr || !pcat(cid))
        return;
    setTags(pr, [...ptagIds(pr), cid]);
    save();
    closeModal();
    render();
    flash(`${pr.name} tagged ${pcat(cid).name}.`);
}
function createAndAssign(pid) {
    let nm = normName($('ncName').value);
    if (!nm)
        return needField('ncName', 'Enter a name for the new tag.');
    let c = data.productCategories.find(x => x.name.toLowerCase() === nm.toLowerCase());
    if (!c) {
        c = { id: id(), name: nm };
        data.productCategories.push(c);
    }
    let pr = product(pid);
    if (pr)
        setTags(pr, [...ptagIds(pr), c.id]);
    save();
    openModal(tagModalHtml(pid));
}
function openCategoryModal(cid) {
    let c = pcat(cid);
    openModal(`<div class="row"><h2 style="margin:0">${c ? 'Edit' : 'New'} tag</h2>${closeX()}</div><label for="pcName">Tag name</label><input id="pcName" value="${esc(c?.name || '')}" placeholder="e.g. Plushies, Easter, Keychains" onkeydown="if(event.key==='Enter')savePCategory('${c?.id || ''}')"><div class="actions"><button onclick="savePCategory('${c?.id || ''}')">Save</button>${c ? `<button class="danger" onclick="deletePCategory('${c.id}')">Delete tag</button>` : ''}</div>${c ? '<p class="hint">Deleting a tag keeps its products. It’s just removed from them.</p>' : '<p class="hint">A product can have more than one tag. It shows under each one, but it’s still one product with one stock count.</p>'}`);
    setTimeout(() => {
        if (!c)
            $('pcName')?.focus();
    }, 60);
}
function savePCategory(cid) {
    let nm = normName($('pcName').value);
    if (!nm)
        return appAlert('Enter a tag name.');
    let dup = data.productCategories.find(c => c.id !== cid && c.name.toLowerCase() === nm.toLowerCase());
    if (dup)
        return appAlert(`You already have a “${dup.name}” tag.`);
    let c = pcat(cid);
    if (c)
        c.name = nm;
    else {
        c = { id: id(), name: nm };
        data.productCategories.push(c);
        productFolderOpen.add(c.id);
    }
    save();
    closeModal();
    render();
    flash(`Tag “${nm}” saved.`);
}
async function deletePCategory(cid) {
    let c = pcat(cid);
    if (!c)
        return;
    let n = data.products.filter(p => hasTag(p, cid)).length;
    if (!await appConfirm(`Delete the “${c.name}” tag?${n ? `\n\nIts ${n} product${n > 1 ? 's' : ''} will stay, just without this tag.` : ''}`))
        return;
    for (let p of data.products)
        if (hasTag(p, cid))
            setTags(p, ptagIds(p).filter(x => x !== cid));
    data.productCategories = data.productCategories.filter(x => x.id !== cid);
    save();
    closeModal();
    render();
    flash('Tag deleted.');
}
function tagPicker() {
    return `<div id="ptags" class="chips">${tagChips()}</div><div id="ptagNewRow" class="row hidden" style="margin-top:8px"><input id="ptagNew" placeholder="New tag name" aria-label="New tag name" autocapitalize="words" onkeydown="if(event.key==='Enter'){event.preventDefault();addDraftTag()}"><button type="button" onclick="addDraftTag()">Add</button></div>`;
}
function tagChips() {
    let cats = data.productCategories.slice().sort(byName);
    return cats.map(c => {
        let on = productTagDraft.includes(c.id);
        return `<button type="button" class="chipbtn ${on ? 'on' : ''}" aria-pressed="${on}" onclick="toggleDraftTag('${c.id}')">${on ? '✓ ' : ''}${esc(c.name)}</button>`;
    }).join('') + `<button type="button" class="chipbtn newtag" onclick="$('ptagNewRow').classList.remove('hidden');$('ptagNew').focus()">+ New tag</button>`;
}
function toggleDraftTag(cid) {
    productTagDraft = productTagDraft.includes(cid) ? productTagDraft.filter(x => x !== cid) : [...productTagDraft, cid];
    $('ptags').innerHTML = tagChips();
}
function addDraftTag() {
    let nm = normName($('ptagNew').value);
    if (!nm)
        return needField('ptagNew', 'Enter a name for the new tag.');
    let c = data.productCategories.find(x => x.name.toLowerCase() === nm.toLowerCase());
    if (!c) {
        c = { id: id(), name: nm };
        data.productCategories.push(c);
        save();
    }
    if (!productTagDraft.includes(c.id))
        productTagDraft.push(c.id);
    $('ptagNew').value = '';
    $('ptagNewRow').classList.add('hidden');
    $('ptags').innerHTML = tagChips();
}
// Add existing products to a tag
let tagAddId = null, tagAddPicked = new Set(), tagAddSearch = '';
function openTagAdd(cid) {
    go('tagAdd', () => {
        tagAddId = cid;
        tagAddPicked = new Set();
        tagAddSearch = '';
    });
}
function tagAdd() {
    let c = pcat(tagAddId);
    if (!c)
        return `${backBtn()}<p class="muted">Tag not found.</p>`;
    return `${backBtn()}<h2 style="margin-top:12px">Add products to ${esc(c.name)}</h2><p class="muted" style="margin-top:-6px;font-weight:600">Tick the products to tag ${esc(c.name)}. They keep any other tags they have.</p><input id="tagAddQ" placeholder="Search your products" aria-label="Search your products" value="${esc(tagAddSearch)}" oninput="tagAddSearch=this.value;$('tagAddList').innerHTML=tagAddRows()"><div id="tagAddList" class="panel" style="margin-top:12px;padding:6px 10px">${tagAddRows()}</div><div class="actions"><button id="tagAddBtn" onclick="applyTagAdd()">${tagAddLabel()}</button></div>`;
}
function tagAddRows() {
    let list = data.products.filter(p => productMatches(p, tagAddSearch)).sort((a, b) => (a.name + ' ' + (a.variation || '')).localeCompare(b.name + ' ' + (b.variation || ''), undefined, { numeric: true, sensitivity: 'base' }));
    if (!list.length)
        return '<p class="muted">No products match.</p>';
    return list.map(p => {
        let here = hasTag(p, tagAddId), on = here || tagAddPicked.has(p.id), others = ptags(p).filter(c => c.id !== tagAddId).map(c => c.name);
        return `<label class="tagrow ${here ? 'here' : ''}"><input type="checkbox" ${on ? 'checked' : ''} ${here ? 'disabled' : ''} onchange="tagAddToggle('${p.id}',this.checked)">${thumb(p.photo || '', 'width:44px;height:44px')}<span class="grow"><b>${esc(p.name)}${p.variation ? ' · ' + esc(p.variation) : ''}</b><span class="muted">${here ? 'Already tagged ' + esc(pcat(tagAddId).name) : (others.length ? 'Tagged ' + esc(others.join(', ')) : 'No tags')} · ${num(p.stock)} in stock</span></span></label>`;
    }).join('');
}
function tagAddToggle(pid, on) {
    on ? tagAddPicked.add(pid) : tagAddPicked.delete(pid);
    $('tagAddBtn').textContent = tagAddLabel();
}
function tagAddLabel() {
    let n = tagAddPicked.size;
    return n ? `Add ${n} product${n === 1 ? '' : 's'}` : 'Tick products to add';
}
function applyTagAdd() {
    let c = pcat(tagAddId);
    if (!c)
        return;
    if (!tagAddPicked.size)
        return appAlert('Tick at least one product first.');
    let n = 0;
    for (let pid of tagAddPicked) {
        let p = product(pid);
        if (p && !hasTag(p, c.id)) {
            setTags(p, [...ptagIds(p), c.id]);
            n++;
        }
    }
    productFolderOpen.add(c.id);
    save();
    goBack();
    toast(`${n} product${n === 1 ? '' : 's'} tagged ${c.name}.`);
}
