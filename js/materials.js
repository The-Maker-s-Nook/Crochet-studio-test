// Materials: list, groups, categories, units, stores, add/edit form, quick add
// Part of the Crochet Studio app. Files load in the order listed in index.html.

function drawMaterialRows() {
    let e = $('materialRows');
    if (e)
        e.innerHTML = materialRows();
}
function stockHelp() {
    appAlert('When enabled, the app tracks how much of this material remains. You can add purchased packages to stock. If automatic deductions are also enabled in Settings, making finished products reduces the tracked stock. This is optional.');
}
function stockHelpButton() {
    return `<button type="button" class="alt small" style="border-radius:50%;padding:2px 8px;margin-left:5px" title="What does tracking remaining stock mean?" onclick="stockHelp()">?</button>`;
}
function materialLabel(m) {
    return m ? normName(m.name) + (m.colour ? ' — ' + normName(m.colour) : '') : '';
}
function loadMaterialPhoto(e, quick) {
    [...(e.target.files || [])].forEach(f => resizePhoto(f, src => {
        if (quick) {
            quickPhotos.push(src);
            refreshPhotos('quick');
        }
        else {
            materialPhotos.push(src);
            refreshPhotos('material');
        }
    }));
}
function closeQuickMaterial() {
    $('quickOverlay')?.remove();
}
// ===== Materials: categories, units, names =====
function mcat(cid) {
    return data.materialCategories.find(c => c.id === cid);
}
function unitObj(u) {
    return data.units.find(x => x.id === u);
}
function unitShort(u) {
    return unitObj(u)?.short || u || '';
}
function unitName(u) {
    return unitObj(u)?.name || u || '';
}
function savedValues(cid, field) {
    let map = new Map();
    for (let m of data.materials) {
        if (m.categoryId !== cid)
            continue;
        let v = normName(m[field]);
        if (!v)
            continue;
        let k = v.toLowerCase();
        if (!map.has(k))
            map.set(k, { label: v, count: 0 });
        map.get(k).count++;
    }
    return [...map.values()];
}
function canonical(cid, field, v) {
    v = normName(v);
    if (!v)
        return v;
    let hit = savedValues(cid, field).find(x => x.label.toLowerCase() === v.toLowerCase());
    return hit ? hit.label : v;
}
function findDuplicateMaterial(cid, name, colour, exceptId) {
    return data.materials.find(m => m.id !== exceptId && m.categoryId === cid && normName(m.name).toLowerCase() === name.toLowerCase() && normName(m.colour).toLowerCase() === String(colour || '').toLowerCase());
}
function unitSelect(sid, sel) {
    return `<select id="${sid}" data-prev="${esc(sel)}" onchange="unitChanged('${sid}')">${data.units.map(u => `<option value="${u.id}" ${u.id === sel ? 'selected' : ''}>${esc(u.name)} (${esc(u.short)})</option>`).join('')}<option value="__new">+ Add a new unit…</option></select>`;
}
function unitNewBox(sid) {
    return `<div id="${sid}New" class="newunit hidden"><div class="two"><div><label for="${sid}NewName">Unit name</label><input id="${sid}NewName" placeholder="e.g. yards"></div><div><label for="${sid}NewShort">Short form</label><input id="${sid}NewShort" placeholder="e.g. yd"></div></div><div class="actions"><button type="button" class="small" onclick="addUnitFrom('${sid}')">Add unit</button><button type="button" class="alt small" onclick="cancelNewUnit('${sid}')">Cancel</button></div></div>`;
}
function unitChanged(sid) {
    let el = $(sid);
    if (el.value === '__new') {
        $(sid + 'New')?.classList.remove('hidden');
        $(sid + 'NewName')?.focus();
    }
    else {
        el.dataset.prev = el.value;
        $(sid + 'New')?.classList.add('hidden');
        if (sid === 'munit') {
            let d = $('mstockDisplay');
            if (d)
                d.textContent = num(material(editing)?.stock) + ' ' + unitShort(el.value);
        }
    }
}
function cancelNewUnit(sid) {
    let el = $(sid);
    el.value = el.dataset.prev || data.units[0].id;
    $(sid + 'New')?.classList.add('hidden');
}
function createUnit(name, short) {
    name = normName(name);
    short = normName(short) || name;
    if (!name)
        return null;
    let ex = data.units.find(u => u.name.toLowerCase() === name.toLowerCase() || u.short.toLowerCase() === short.toLowerCase());
    if (ex)
        return ex;
    let u = { id: 'u_' + id(), name, short };
    data.units.push(u);
    save();
    return u;
}
function addUnitFrom(sid) {
    let u = createUnit($(sid + 'NewName').value, $(sid + 'NewShort').value);
    if (!u)
        return appAlert('Enter a unit name, e.g. yards.');
    $(sid).outerHTML = unitSelect(sid, u.id);
    $(sid + 'New').classList.add('hidden');
    $(sid + 'NewName').value = '';
    $(sid + 'NewShort').value = '';
    flash(`Unit “${u.name}” ready to use.`);
}
function unitInUse(u) {
    return data.materials.some(m => m.unit === u.id) || data.materialCategories.some(c => c.unit === u.id);
}
function openUnitsModal() {
    openModal(`<div class="row"><h2 style="margin:0">Units</h2>${closeX()}</div><p class="muted">Units are how materials are measured. Add your own for other crafts, like yards, metres or skeins.</p>${data.units.map(u => `<div class="row entry" style="margin:6px 0"><span><b>${esc(u.name)}</b> <span class="muted">(${esc(u.short)})</span></span>${u.builtin ? '<span class="chip">Built-in</span>' : unitInUse(u) ? '<span class="chip">In use</span>' : `<button class="danger small" onclick="deleteUnit('${u.id}')">Delete</button>`}</div>`).join('')}<h3 style="margin-top:18px">Add a unit</h3><div class="two"><div><label for="nuName">Unit name</label><input id="nuName" placeholder="e.g. yards"></div><div><label for="nuShort">Short form</label><input id="nuShort" placeholder="e.g. yd"></div></div><div class="actions"><button onclick="addUnitModal()">Add unit</button></div>`);
}
function addUnitModal() {
    let nm = $('nuName').value;
    if (!normName(nm))
        return appAlert('Enter a unit name, e.g. yards.');
    let before = data.units.length, u = createUnit(nm, $('nuShort').value);
    if (screen === 'materials')
        render();
    openUnitsModal();
    flash(data.units.length > before ? `Unit “${u.name}” added.` : `“${u.name}” already exists.`);
}
async function deleteUnit(uid) {
    let u = unitObj(uid);
    if (!u || u.builtin || unitInUse(u))
        return;
    if (!await appConfirm(`Delete the unit “${u.name}”?`))
        return;
    data.units = data.units.filter(x => x.id !== uid);
    save();
    if (screen === 'materials')
        render();
    openUnitsModal();
}
let matCatFromForm = false;
function openMatCategoryModal(cid, fromForm) {
    matCatFromForm = !!fromForm;
    let c = mcat(cid), count = c ? data.materials.filter(m => m.categoryId === c.id).length : 0;
    openModal(`<div class="row"><h2 style="margin:0">${c ? 'Edit' : 'New'} material category</h2>${closeX()}</div><label for="mcName">Category name</label><input id="mcName" value="${esc(c?.name || '')}" placeholder="e.g. Beads, Fabric, Buttons"><label for="mcUnit">Usually measured in</label>${unitSelect('mcUnit', c?.unit || 'g')}${unitNewBox('mcUnit')}<label class="check"><input type="checkbox" id="mcOn" ${!c || c.onProducts ? 'checked' : ''}> Show on every new product</label><p class="hint">Turn this off for things you only use sometimes. You can still add it to any product with the buttons under “Need something else?”.</p><div class="actions"><button onclick="saveMatCategory('${c?.id || ''}')">Save</button>${c ? `<button class="danger" onclick="deleteMatCategory('${c.id}')">Delete</button>` : ''}</div>${c && count ? `<p class="hint">${count} material${count > 1 ? 's' : ''} in this category. Renaming keeps them all.</p>` : ''}`);
    setTimeout(() => {
        if (!c)
            $('mcName')?.focus();
    }, 60);
}
function saveMatCategory(cid) {
    let name = normName($('mcName').value), unit = $('mcUnit').value;
    if (!name)
        return appAlert('Enter a category name.');
    if (unit === '__new')
        return appAlert('Finish adding the new unit first (tap Add unit).');
    let dup = data.materialCategories.find(c => c.id !== cid && c.name.toLowerCase() === name.toLowerCase());
    if (dup)
        return appAlert(`You already have a “${dup.name}” category.`);
    let c = mcat(cid);
    if (c)
        Object.assign(c, { name, unit, onProducts: $('mcOn').checked });
    else {
        c = { id: 'mc_' + id(), name, unit, onProducts: $('mcOn').checked };
        data.materialCategories.push(c);
    }
    save();
    closeModal();
    if (matCatFromForm && screen === 'productForm') {
        if (!productSecs.includes(c.id))
            productSecs.push(c.id);
        if (!productLines.some(l => l.catId === c.id))
            productLines.push({ key: id(), catId: c.id, materialId: '', amount: '' });
        redrawSupplies();
        flash(`“${name}” added to this product.`);
    }
    else {
        materialCatId = c.id;
        render();
        flash(`Category “${name}” saved.`);
    }
}
async function deleteMatCategory(cid) {
    let c = mcat(cid), n = data.materials.filter(m => m.categoryId === cid).length;
    if (n)
        return appAlert(`“${c.name}” still has ${n} material${n > 1 ? 's' : ''}. Move them to another category (open each one → Category) or delete them first.`);
    if (data.materialCategories.length < 2)
        return appAlert('You need at least one material category.');
    if (!await appConfirm(`Delete the “${c.name}” category?`))
        return;
    data.materialCategories = data.materialCategories.filter(x => x.id !== cid);
    save();
    closeModal();
    render();
    flash('Category deleted.');
}
function savedStores() {
    let map = new Map();
    for (let x of [...data.materials, ...data.purchases]) {
        let v = normName(x.store);
        if (v && !map.has(v.toLowerCase()))
            map.set(v.toLowerCase(), v);
    }
    return [...map.values()].sort((a, b) => a.localeCompare(b));
}
function canonStore(v) {
    v = normName(v);
    if (!v)
        return '';
    return savedStores().find(x => x.toLowerCase() === v.toLowerCase()) || v;
}
function storeField(fid, val) {
    return comboField({ id: fid, value: val, placeholder: 'e.g. Michaels, Walmart, Amazon', autocap: true, source: () => savedStores().map(x => ({ label: x, sub: `${data.materials.filter(m => normName(m.store).toLowerCase() === x.toLowerCase()).length} material(s)` })) });
}
let materialSort = 'type';
const MAT_SORTS = [['type', 'Sort: Type (A–Z)'], ['variation', 'Sort: Variation (A–Z)'], ['priceLow', 'Sort: Price, low to high'], ['priceHigh', 'Sort: Price, high to low'], ['store', 'Sort: Where purchased']];
function sortMaterials(list) {
    let L = list.slice(), lab = m => materialLabel(m).toLowerCase();
    if (materialSort === 'variation')
        L.sort((a, b) => String(a.colour || '~').localeCompare(String(b.colour || '~')) || lab(a).localeCompare(lab(b)));
    else if (materialSort === 'priceLow')
        L.sort((a, b) => num(a.price) - num(b.price) || lab(a).localeCompare(lab(b)));
    else if (materialSort === 'priceHigh')
        L.sort((a, b) => num(b.price) - num(a.price) || lab(a).localeCompare(lab(b)));
    else if (materialSort === 'store')
        L.sort((a, b) => (normName(a.store) || '~').localeCompare(normName(b.store) || '~') || lab(a).localeCompare(lab(b)));
    else
        L.sort((a, b) => lab(a).localeCompare(lab(b)));
    return L;
}
function flatMaterialList(list, showCat) {
    let L = sortMaterials(list);
    if (materialSort !== 'store')
        return L.map(m => materialCard(m, showCat ? 'full' : 'label')).join('');
    let out = '', last = null;
    for (let m of L) {
        let st = normName(m.store) || 'No store set';
        if (st !== last) {
            out += `<div class="section-label">${esc(st)}</div>`;
            last = st;
        }
        out += materialCard(m, showCat ? 'full' : 'label');
    }
    return out;
}
// ===== Materials page =====
let materialCatId = null, matGroupOpen = new Set(), matGroupInfo = [];
function gkey(cid, name) {
    return cid + '|' + normName(name).toLowerCase();
}
function materials() {
    let cats = data.materialCategories;
    if (!cats.some(c => c.id === materialCatId))
        materialCatId = cats[0]?.id;
    return `<div class="row"><h2>Materials</h2></div><div class="actions toprow" style="margin:-6px 0 12px"><button onclick="newMaterial('${materialCatId || ''}')">+ Material</button><button class="alt" onclick="openMatCategoryModal()">+ Category</button><button class="alt" onclick="openUnitsModal()">Units</button></div><input id="materialSearch" placeholder="Search materials (type, variation, store)" value="${esc(materialSearch)}" oninput="materialSearch=this.value;drawMaterialRows()"><label for="matSort" class="sr">Sort materials</label><select id="matSort" style="margin-top:10px" onchange="materialSort=this.value;drawMaterialRows()">${MAT_SORTS.map(([v, l]) => `<option value="${v}" ${materialSort === v ? 'selected' : ''}>${l}</option>`).join('')}</select><div class="tabs" style="margin-top:12px">${cats.map(x => `<button class="${x.id === materialCatId ? '' : 'alt'} small" onclick="materialCatId='${x.id}';render()">${esc(x.name)}</button>`).join('')}</div><div id="materialRows">${materialRows()}</div>`;
}
function materialCard(m, mode) {
    let c = mcat(m.categoryId), isDef = c?.defaultMaterialId === m.id, full = mode === true || mode === 'full';
    return `<div class="panel row matcard">${photoSlot(m.photo || m.photos?.[0] || '', "width:52px;height:52px", 'material', m.id, materialLabel(m), true)}<div class="grow"><b>${esc(mode && mode !== 'group' ? materialLabel(m) : (m.colour || 'No variation set'))}</b>${isDef ? ' <span class="chip">Default</span>' : ''}<div class="muted">${full ? esc(c?.name || '') + ' · ' : ''}${m.store && materialSort !== 'store' ? esc(m.store) + ' · ' : ''}${cash(m.price)} / ${num(m.weight)} ${esc(unitShort(m.unit))}${m.trackStock ? ` · ${num(m.stock)} ${esc(unitShort(m.unit))} left` : ''}</div></div><button class="alt small" onclick="editMaterial('${m.id}')">Edit</button></div>`;
}
function materialRows() {
    let q = materialSearch.toLowerCase().trim();
    if (q) {
        let hits = data.materials.filter(m => [m.name, m.colour, m.store, mcat(m.categoryId)?.name].some(x => String(x || '').toLowerCase().includes(q))).sort((a, b) => materialLabel(a).localeCompare(materialLabel(b)));
        return flatMaterialList(hits, true) || '<div class="panel muted">No materials match your search.</div>';
    }
    let c = mcat(materialCatId);
    if (!c)
        return '';
    let groups = new Map();
    for (let m of data.materials.filter(m => m.categoryId === c.id)) {
        let k = gkey(c.id, m.name);
        if (!groups.has(k))
            groups.set(k, { key: k, catId: c.id, name: normName(m.name), items: [] });
        groups.get(k).items.push(m);
    }
    matGroupInfo = [...groups.values()].sort(byName);
    let dm = material(c.defaultMaterialId), inCat = data.materials.filter(m => m.categoryId === c.id), head = `<div class="cat-head"><div class="muted">Measured in ${esc(unitName(c.unit))} · ${c.onProducts ? 'on every new product' : 'added to products when needed'}${dm ? `<br>Default: <b>${esc(materialLabel(dm))}</b>` : ''}</div><button class="alt small" onclick="openMatCategoryModal('${c.id}')">Edit category</button></div>`;
    if (materialSort !== 'type')
        return head + (flatMaterialList(inCat, false) || `<div class="panel muted">No ${esc(c.name.toLowerCase())} saved yet. Tap + Material to add one.</div>`);
    return head + (matGroupInfo.map((g, i) => {
        let open = matGroupOpen.has(g.key), n = g.items.length, photo = g.items.map(m => m.photo || m.photos?.[0]).find(Boolean) || '';
        g.items.sort((a, b) => String(a.colour || '').localeCompare(String(b.colour || ''), undefined, { numeric: true, sensitivity: 'base' }));
        return `<div class="folder ${open ? 'open' : ''}"><button class="folder-head" onclick="toggleMatGroup(${i})" aria-expanded="${open}">${photoSlot(photo, 'width:46px;height:46px', 'group', i, g.name, true)}<span class="grow"><b>${esc(g.name)}</b><span class="muted">${n} variation${n > 1 ? 's' : ''}${g.items.some(m => c.defaultMaterialId === m.id) ? ' · default inside' : ''}</span></span><span class="chev" aria-hidden="true">›</span></button>${open ? `<div class="folder-body">${g.items.map(m => materialCard(m, 'group')).join('')}<div class="actions" style="margin:6px 0 2px"><button class="alt small" onclick="addToMatGroup(${i})">+ Add variation</button><button class="alt small" onclick="renameMatGroup(${i})">Rename</button></div></div>` : ''}</div>`;
    }).join('') || `<div class="panel muted">No ${esc(c.name.toLowerCase())} saved yet. Tap + Material to add one.</div>`);
}
function toggleMatGroup(i) {
    let k = matGroupInfo[i]?.key;
    if (!k)
        return;
    matGroupOpen.has(k) ? matGroupOpen.delete(k) : matGroupOpen.add(k);
    drawMaterialRows();
}
function addToMatGroup(i) {
    let g = matGroupInfo[i];
    if (g)
        newMaterial(g.catId, g.name);
}
function renameMatGroup(i) {
    let g = matGroupInfo[i];
    if (!g)
        return;
    openModal(`<div class="row"><h2 style="margin:0">Rename type</h2>${closeX()}</div><p class="muted">This renames all ${g.items.length} variation${g.items.length > 1 ? 's' : ''} of ${esc(g.name)}.</p><label for="rgName">Type / brand name</label><input id="rgName" value="${esc(g.name)}"><div class="actions"><button onclick="saveMatGroupName(${i})">Save</button></div>`);
}
function saveMatGroupName(i) {
    let g = matGroupInfo[i], nm = normName($('rgName').value);
    if (!g || !nm)
        return appAlert('Enter a name.');
    let canon = data.materials.find(m => m.categoryId === g.catId && gkey(g.catId, m.name) !== g.key && normName(m.name).toLowerCase() === nm.toLowerCase());
    nm = canon ? normName(canon.name) : nm;
    for (let m of data.materials)
        if (m.categoryId === g.catId && gkey(g.catId, m.name) === g.key)
            m.name = nm;
    matGroupOpen.delete(g.key);
    matGroupOpen.add(gkey(g.catId, nm));
    save();
    closeModal();
    drawMaterialRows();
    flash(canon ? `Merged into ${nm}.` : `Renamed to ${nm}.`);
}
// ===== Material form + quick add =====
let materialPreset = null, quickTarget = null, quickCatId = null;
function suggestionInputs(prefix, name = '', colour = '') {
    const cid = () => prefix === 'm' ? $('mcat')?.value : quickCatId;
    const nameNow = () => normName($(prefix + 'name')?.value).toLowerCase();
    return `<label for="${prefix}name">Type / brand</label>${comboField({ id: prefix + 'name', value: name, placeholder: 'Start typing, e.g. Bernat Blanket', autocap: true, source: () => savedValues(cid(), 'name').map(x => ({ label: x.label, sub: `${x.count} variation${x.count > 1 ? 's' : ''} saved` })), onPick: () => fillFromSibling(prefix) })}<div class="hint" style="margin-top:5px">All variations of the same type are grouped together on the Materials page.</div><label for="${prefix}colour">Variation (optional)</label>${comboField({ id: prefix + 'colour', value: colour, placeholder: 'e.g. Lilac, 12 mm, Large', autocap: true, source: () => savedValues(cid(), 'colour').map(x => ({ label: x.label, sub: data.materials.some(m => m.categoryId === cid() && normName(m.name).toLowerCase() === nameNow() && normName(m.colour).toLowerCase() === x.label.toLowerCase()) ? 'Already saved with this type' : '' })) })}`;
}
function fillFromSibling(prefix) {
    if (prefix === 'm' && editing)
        return;
    let cid = prefix === 'm' ? $('mcat')?.value : quickCatId, nm = normName($(prefix + 'name')?.value).toLowerCase(), sib = data.materials.find(m => m.categoryId === cid && normName(m.name).toLowerCase() === nm);
    if (!sib)
        return;
    let pr = $(prefix + 'price');
    if (pr && pr.value === '') {
        pr.value = sib.price;
        let w = $(prefix + 'weight');
        if (w)
            w.value = sib.weight;
        let u = $(prefix + 'unit');
        if (u && unitObj(sib.unit)) {
            u.value = sib.unit;
            u.dataset.prev = sib.unit;
        }
        let st = $(prefix + 'store');
        if (st && !st.value && sib.store)
            st.value = sib.store;
    }
}
function refreshMaterialSuggestions() {
    comboClose('mname');
    comboClose('mcolour');
}
function setMaterialFormDefaults() {
}
function newMaterial(catId, name) {
    go('materialForm', () => {
        editing = null;
        materialPhotos = [];
        materialPreset = { catId: catId || materialCatId || data.materialCategories[0]?.id, name: name || '' };
    });
}
function editMaterial(mid) {
    go('materialForm', () => {
        editing = mid;
        let m = material(mid);
        materialPhotos = [...(m?.photos || (m?.photo ? [m.photo] : []))];
        materialPreset = null;
    });
}
function materialForm() {
    let m = material(editing) || {}, catId = m.categoryId || materialPreset?.catId || data.materialCategories[0]?.id, c = mcat(catId), presetName = m.name || materialPreset?.name || '', sib = !editing && presetName ? data.materials.find(x => x.categoryId === catId && normName(x.name).toLowerCase() === presetName.toLowerCase()) : null, unit = m.unit || sib?.unit || c?.unit || 'g';
    return `${backBtn()}<div class="panel" style="margin-top:12px"><h2>${editing ? 'Edit' : 'Add'} material</h2><form novalidate onsubmit="saveMaterial(event)"><label for="mcat">Category</label><select id="mcat" onchange="materialCatChanged()">${data.materialCategories.map(x => `<option value="${x.id}" ${x.id === catId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>${suggestionInputs('m', presetName, m.colour || '')}<div class="two"><div><label for="mweight">Package size</label><input id="mweight" type="number" min="0.001" step="any" required value="${m.weight ?? sib?.weight ?? (unit === 'g' ? 100 : 1)}"></div><div><label for="munit">Unit</label>${unitSelect('munit', unit)}</div></div>${unitNewBox('munit')}<label for="mprice">Price paid per package ($)</label><input id="mprice" type="number" min="0" step="0.01" inputmode="decimal" required value="${m.price ?? sib?.price ?? ''}">${taxOverrideField('m', { taxOverride: m.taxOverride ?? sib?.taxOverride }, 'material')}<label for="mstore">Where purchased (optional)</label>${storeField('mstore', m.store ?? sib?.store ?? '')}<label class="check"><input id="mtrack" type="checkbox" ${(m.trackStock ?? sib?.trackStock) ? 'checked' : ''}> Track remaining stock ${stockHelpButton()}</label><div class="hint">Optional: when on, the app tracks how much of this material is left. Making finished products only deducts it if automatic deductions are on in Settings.</div><div class="panel" style="background:var(--card2);margin-top:12px;box-shadow:none"><div class="muted">Current remaining stock</div><div class="big" id="mstockDisplay">${num(m.stock)} ${esc(unitShort(unit))}</div><div class="hint">Changes when you add packages below or when tracked materials are used.</div></div><label for="mpackages">Packages purchased / add to stock</label><div class="row" style="justify-content:flex-start"><button type="button" class="alt" onclick="stepNumber('mpackages',-1)" aria-label="One fewer">−</button><input id="mpackages" type="number" min="0" step="1" value="${editing ? 0 : 1}" style="width:90px;text-align:center"><button type="button" class="alt" onclick="stepNumber('mpackages',1)" aria-label="One more">+</button></div><div class="hint">One package holds the package size above. For an existing material, enter how many new packages to add.</div><label>Material photo (optional)</label><div class="actions"><button type="button" class="alt small" onclick="photoMenu(e=>loadMaterialPhoto(e,false),true)">📷 Add photo</button></div><div id="materialPhotoPreview">${photoGallery("material")}</div><label class="check"><input type="checkbox" id="mdefault" ${editing && c?.defaultMaterialId === m.id ? 'checked' : ''}> <span>Make this the default <span id="mdefaultCat">${esc((c?.name || 'material').toLowerCase())}</span></span></label><div class="hint">The default is filled in for you whenever you create a new product.</div><div class="actions"><button type="submit">Save material</button>${editing ? `<button type="button" class="danger" onclick="deleteMaterial('${editing}')">Delete</button>` : ''}</div></form></div>`;
}
function materialCatChanged() {
    comboClose('mname');
    comboClose('mcolour');
    let dc = $('mdefaultCat');
    if (dc)
        dc.textContent = (mcat($('mcat').value)?.name || 'material').toLowerCase();
    if (editing)
        return;
    let c = mcat($('mcat').value), u = $('munit');
    if (c && u && unitObj(c.unit)) {
        u.value = c.unit;
        u.dataset.prev = c.unit;
    }
}
async function saveMaterial(e) {
    e.preventDefault();
    let catId = $('mcat').value, c = mcat(catId), unit = $('munit').value, packs = Number($('mpackages').value), weight = num($('mweight').value), name = canonical(catId, 'name', $('mname').value), colour = canonical(catId, 'colour', $('mcolour').value);
    if (unit === '__new')
        return needField('munitNewName', 'Finish adding the new unit first (tap Add unit).');
    if (!name)
        return needField('mname', 'Enter a type or brand name, e.g. Polyfill.');
    if (!(weight > 0))
        return needField('mweight', 'Enter the package size (more than 0).');
    if ($('mprice').value.trim() === '' || !(Number($('mprice').value) >= 0))
        return needField('mprice', 'Enter the price you paid per package. Use 0 if it was free.');
    if (badTaxOverride('m'))
        return needField('mTaxRate', 'Enter a tax rate between 0 and 100 for this material, or untick Override tax settings.');
    if (!Number.isInteger(packs) || packs < 0)
        return needField('mpackages', 'Enter a whole number of packages (0 or more).');
    let dup = findDuplicateMaterial(catId, name, colour, editing), label = name + (colour ? ' — ' + colour : '');
    if (dup) {
        if (editing || packs < 1)
            return appAlert(`You already have ${label} saved. Change the type or variation, or edit the saved one instead.`);
        if (!await appConfirm(`You already have ${label} saved.\n\nAdd ${packs} package${packs > 1 ? 's' : ''} to its stock instead of saving it twice?`))
            return;
        dup.stock = num(dup.stock) + packs * num(dup.weight);
        logPurchase(dup, packs, num($('mprice').value));
        matGroupOpen.add(gkey(catId, name));
        save();
        goBack();
        return toast(`Added to ${label}.`);
    }
    let m = { id: editing || id(), categoryId: catId, name, colour, weight, unit, price: num($('mprice').value), store: canonStore($('mstore').value), taxOverride: readTaxOverride('m'), trackStock: $('mtrack').checked, photo: materialPhotos[0] || '', photos: [...materialPhotos], stock: (editing ? num(material(editing)?.stock) : 0) + packs * weight };
    if (editing)
        Object.assign(material(editing), m);
    else
        data.materials.push(m);
    logPurchase(material(m.id), packs);
    for (let x of data.materialCategories)
        if (x.defaultMaterialId === m.id && (x.id !== catId || !$('mdefault').checked))
            x.defaultMaterialId = '';
    if ($('mdefault').checked)
        c.defaultMaterialId = m.id;
    matGroupOpen.add(gkey(catId, name));
    materialCatId = catId;
    save();
    goBack();
    toast('Material saved.');
}
async function deleteMaterial(mid) {
    if (data.products.some(p => (p.materials || []).some(x => x.materialId === mid)))
        return appAlert('This material is used by a product. Remove it from that product first.');
    if (!await appConfirm('Delete this material?'))
        return;
    data.materials = data.materials.filter(m => m.id !== mid);
    for (let c of data.materialCategories)
        if (c.defaultMaterialId === mid)
            c.defaultMaterialId = '';
    save();
    goBack();
}
function openQuickMaterial(catId, prefill = '', target = null) {
    closeQuickMaterial();
    quickCatId = catId;
    quickTarget = target;
    quickPhotos = [];
    let c = mcat(catId), unit = c?.unit || 'g', o = document.createElement('div');
    o.id = 'quickOverlay';
    o.className = 'modal';
    o.innerHTML = `<div class="panel modal-card" role="dialog" aria-modal="true"><div class="row"><h2 style="margin:0">New ${esc((c?.name || 'material').toLowerCase())}</h2><button class="iconbtn" aria-label="Close" onclick="closeQuickMaterial()">${ic('x', 18)}</button></div>${suggestionInputs('q', prefill)}<div class="two"><div><label for="qweight">Package size</label><input id="qweight" type="number" min="0.001" step="any" value="${unit === 'g' ? 100 : 1}"></div><div><label for="qunit">Unit</label>${unitSelect('qunit', unit)}</div></div>${unitNewBox('qunit')}<label for="qprice">Package price ($)</label><input id="qprice" type="number" min="0" step="0.01" inputmode="decimal">${taxOverrideField('q', null, 'material')}<label for="qstore">Where purchased (optional)</label>${storeField('qstore', '')}<label for="qpackages">Packages purchased</label><div class="row" style="justify-content:flex-start"><button class="alt" onclick="stepNumber('qpackages',-1)" aria-label="One fewer">−</button><input id="qpackages" type="number" min="0" step="1" value="1" style="width:90px;text-align:center"><button class="alt" onclick="stepNumber('qpackages',1)" aria-label="One more">+</button></div><label class="check"><input id="qtrack" type="checkbox"> Track remaining stock ${stockHelpButton()}</label><label class="check"><input id="qdefault" type="checkbox" ${c && !material(c.defaultMaterialId) ? '' : ''}> Make this the default ${esc((c?.name || 'material').toLowerCase())}</label><label>Photo (optional)</label><div class="actions"><button class="alt small" onclick="photoMenu(e=>loadMaterialPhoto(e,true),true)">📷 Add photo</button></div><div id="quickPhotoPreview"></div><div class="actions"><button onclick="saveQuickMaterial()">Save and select</button><button class="alt" onclick="closeQuickMaterial()">Cancel</button></div></div>`;
    document.body.appendChild(o);
    if (prefill)
        setTimeout(() => fillFromSibling('q'), 0);
}
async function saveQuickMaterial() {
    let cid = quickCatId, name = canonical(cid, 'name', $('qname').value), colour = canonical(cid, 'colour', $('qcolour').value), unit = $('qunit').value, weight = Number($('qweight').value), price = Number($('qprice').value), packs = Number($('qpackages').value);
    if (unit === '__new')
        return needField('qunitNewName', 'Finish adding the new unit first (tap Add unit).');
    if (!name)
        return needField('qname', 'Enter a type or brand name, e.g. Polyfill.');
    if (!(weight > 0))
        return needField('qweight', 'Enter the package size (more than 0).');
    if ($('qprice').value.trim() === '' || !(price >= 0))
        return needField('qprice', 'Enter the price you paid per package. Use 0 if it was free.');
    if (badTaxOverride('q'))
        return needField('qTaxRate', 'Enter a tax rate between 0 and 100 for this material, or untick Override tax settings.');
    if (!Number.isInteger(packs) || packs < 0)
        return needField('qpackages', 'Enter a whole number of packages (0 or more).');
    let dup = findDuplicateMaterial(cid, name, colour, null), label = name + (colour ? ' — ' + colour : ''), m;
    if (dup) {
        if (!await appConfirm(`You already have ${label} saved.\n\nUse that one${packs ? ` and add ${packs} package${packs > 1 ? 's' : ''} to its stock` : ''}?`))
            return;
        dup.stock = num(dup.stock) + packs * num(dup.weight);
        logPurchase(dup, packs, price);
        m = dup;
    }
    else {
        m = { id: id(), categoryId: cid, name, colour, weight, unit, price, store: canonStore($('qstore').value), taxOverride: readTaxOverride('q'), trackStock: $('qtrack').checked, stock: packs * weight, photo: quickPhotos[0] || '', photos: [...quickPhotos] };
        data.materials.push(m);
        logPurchase(m, packs);
    }
    if ($('qdefault')?.checked) {
        let c = mcat(cid);
        if (c)
            c.defaultMaterialId = m.id;
    }
    save();
    closeQuickMaterial();
    placeMaterialInForm(m);
}
function placeMaterialInForm(m) {
    if (screen !== 'productForm' || !$('supplies'))
        return flash(`${materialLabel(m)} saved.`);
    let cid = m.categoryId, l = quickTarget ? lineByFid(quickTarget) : null;
    if (!l)
        l = productLines.find(x => x.catId === cid && !x.materialId);
    if (!l) {
        l = { key: id(), catId: cid, materialId: '', amount: '' };
        productLines.push(l);
    }
    if (!productSecs.includes(cid))
        productSecs.push(cid);
    l.materialId = m.id;
    redrawSupplies();
    updatePrice();
    setTimeout(() => $('amt_' + l.key)?.focus(), 60);
    flash(`${materialLabel(m)} added. Now enter the amount used.`);
}
