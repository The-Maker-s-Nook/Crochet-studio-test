// Material stock: the three stock settings, per-material overrides, the −1/+1 package buttons,
// "what do you buy it in" words, and taking materials out when finished products are made.
// Part of the Crochet Studio app. Files load in the order listed in index.html.
//
// Settings › Pricing defaults › Material stock picks one of STOCK_MODES for every material.
// A material can override it (m.stockOverride = { on: true, mode }), like the tax override.
// m.stock is the amount left in the material's unit. Blank (null) means "not counted yet":
// nothing is taken out and no warnings are shown until the person adds how much they have.

const STOCK_MODES = [
    ['pricing', 'Pricing only', 'No stock counting, just used for price suggestions'],
    ['manual', 'Pricing and manual stock', 'Manually update stock, plus pricing suggestions'],
    ['auto', 'Pricing and automatic stock', 'Automatically update stock as items are made, plus pricing suggestions']
];
const PACK_WORDS = ['skein', 'ball', 'bag', 'pack', 'bottle', 'sheet', 'spool'];

function stockMode(m) {
    return m?.stockOverride?.on ? m.stockOverride.mode : (data.settings.materialStock || 'auto');
}
function stockCounts(m) {
    return stockMode(m) !== 'pricing';
}
function stockKnown(m) {
    return m?.stock !== null && m?.stock !== undefined && m?.stock !== '' && !Number.isNaN(Number(m.stock));
}
// Is any material (or the main setting) using this mode? Used to show or hide options.
function stockModeInUse(mode) {
    return (data.settings.materialStock || 'auto') === mode || data.materials.some(m => stockMode(m) === mode);
}
function stockModeLabel(mode) {
    return (STOCK_MODES.find(x => x[0] === mode) || STOCK_MODES[2])[1];
}

// ---- "What do you buy it in?" (skein, bag, pack...) ----
function packWord(m) {
    let c = mcat(m?.categoryId);
    return normName(c?.packWord) || 'package';
}
function plural(word, n) {
    if (n === 1)
        return word;
    return /(s|x|z|ch|sh)$/i.test(word) ? word + 'es' : word + 's';
}
function packCount(n) {
    let r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
// "2 skeins left · 600 g"
function stockLine(m) {
    if (!stockKnown(m))
        return 'Not counted yet';
    let left = num(m.stock), size = num(m.weight), w = packWord(m), packs = size > 0 ? left / size : 0, shown = packCount(packs);
    return `${shown} ${plural(w, Number(shown))} left · ${+left.toFixed(2)} ${unitShort(m.unit)}`;
}
function unitPerWord(unit, word) {
    let n = unitName(unit) || 'Amount';
    return n.charAt(0).toUpperCase() + n.slice(1) + ' per ' + (normName(word) || 'package');
}

// ---- On the material cards ----
function materialStockRow(m) {
    if (!stockCounts(m))
        return '';
    if (!stockKnown(m))
        return `<div class="stockrow"><button type="button" class="alt small" onclick="openStockCount('${m.id}')">Add how much you have</button></div>`;
    let empty = num(m.stock) <= 0, w = packWord(m);
    return `<div class="stockrow"><button type="button" class="alt small stepbtn" ${empty ? 'disabled' : ''} aria-label="One ${esc(w)} fewer" onclick="stepMaterialStock('${m.id}',-1)">−1</button><span class="stockline ${empty ? 'out' : ''}" onclick="openStockCount('${m.id}')">${esc(stockLine(m))}</span><button type="button" class="alt small stepbtn" aria-label="One ${esc(w)} more" onclick="stepMaterialStock('${m.id}',1)">+1</button></div>`;
}
// One tap = one full package (skein, bag...).
function stepMaterialStock(mid, d) {
    let m = material(mid);
    if (!m)
        return;
    m.stock = Math.max(0, num(m.stock) + d * num(m.weight));
    save();
    drawMaterialRows();
}
// "Add how much you have" / tap the line to fix the amount.
function openStockCount(mid) {
    let m = material(mid);
    if (!m)
        return;
    let w = packWord(m), u = unitShort(m.unit), have = stockKnown(m) ? +num(m.stock).toFixed(2) : '';
    openModal(`<div class="row"><h2 style="margin:0">How much do you have?</h2>${closeX()}</div><p class="muted" style="margin-top:6px">${esc(materialLabel(m))}</p><label for="scPacks">Full ${esc(plural(w, 2))}</label><input id="scPacks" type="number" min="0" step="any" inputmode="decimal" value="${have === '' || !(num(m.weight) > 0) ? '' : packCount(have / num(m.weight))}" oninput="$('scAmt').value=this.value===''?'':+(Number(this.value)*${num(m.weight)}).toFixed(2)"><label for="scAmt">Or the amount (${esc(u)})</label><input id="scAmt" type="number" min="0" step="any" inputmode="decimal" value="${have}" oninput="$('scPacks').value=this.value===''?'':${num(m.weight) > 0 ? `+(Number(this.value)/${num(m.weight)}).toFixed(1)` : "''"}"><p class="hint">One ${esc(w)} is ${num(m.weight)} ${esc(u)}. Leave both blank if you don't want to count this one yet.</p><div class="actions"><button onclick="saveStockCount('${m.id}')">Save</button></div>`);
    setTimeout(() => $('scPacks')?.focus(), 60);
}
function saveStockCount(mid) {
    let m = material(mid), v = $('scAmt').value.trim();
    if (!m)
        return closeModal();
    if (v !== '' && !(Number(v) >= 0))
        return needField('scAmt', 'Enter 0 or more.');
    m.stock = v === '' ? null : num(v);
    save();
    closeModal();
    if (screen === 'materials')
        drawMaterialRows();
    else
        render();
}

// ---- The stock override on a material's form (works like the tax override) ----
function stockOverrideField(prefix, m) {
    let o = m?.stockOverride, on = !!o?.on, main = data.settings.materialStock || 'auto';
    return `<div class="taxov"><div class="labelrow" style="margin:0"><label class="check" style="margin:0"><input type="checkbox" id="${prefix}StockOn" ${on ? 'checked' : ''} onchange="$('${prefix}StockBox').classList.toggle('hidden',!this.checked);$('${prefix}StockHint').classList.toggle('hidden',this.checked);stockFormChanged('${prefix}')"> Override stock setting</label>${helpBtn('stockOverride')}</div><div id="${prefix}StockHint" class="hint ${on ? 'hidden' : ''}" style="margin-top:4px">Following your stock setting: ${esc(stockModeLabel(main))}</div><div id="${prefix}StockBox" class="${on ? '' : 'hidden'}"><label for="${prefix}StockMode">Stock for this material</label><select id="${prefix}StockMode" onchange="stockFormChanged('${prefix}')">${STOCK_MODES.map(([v, l]) => `<option value="${v}" ${(on ? o.mode : main) === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div></div>`;
}
function readStockOverride(prefix) {
    if (!$(prefix + 'StockOn')?.checked)
        return null;
    let mode = $(prefix + 'StockMode').value;
    return mode === (data.settings.materialStock || 'auto') ? null : { on: true, mode };
}
// Show the "how much you have" box only when this material counts stock.
function stockFormChanged(prefix) {
    let ov = readStockOverride(prefix), counts = (ov ? ov.mode : data.settings.materialStock || 'auto') !== 'pricing';
    $(prefix + 'StockPanel')?.classList.toggle('hidden', !counts);
}
function formStockCounts(m) {
    return stockMode(m) !== 'pricing';
}

// ---- Settings › Pricing defaults ----
function stockSettingField() {
    let cur = data.settings.materialStock || 'auto';
    return `<div class="labelrow"><label for="sstock">Material stock</label>${helpBtn('stockModes')}</div><select id="sstock" class="fancy">${STOCK_MODES.map(([v, l, d]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${esc(l)}. ${esc(d)}</option>`).join('')}</select><div class="hint">Materials can override this on their own Edit screen.</div>`;
}

// ---- Category form: "What do you buy it in?" ----
function packWordField(c) {
    let w = c ? (c.packWord ?? '') : 'pack';
    return `<label for="mcWord">What do you buy it in? (optional)</label><input id="mcWord" value="${esc(w)}" placeholder="e.g. skein" oninput="packWordPreview()"><div class="chips" style="margin-top:8px">${PACK_WORDS.map(x => `<button type="button" class="chip" onclick="$('mcWord').value='${x}';packWordPreview()">${x}</button>`).join('')}</div><div class="hint" id="mcWordHint">${packWordHint(w, c?.unit || 'g')}</div>`;
}
function packWordHint(w, unit) {
    w = normName(w) || 'package';
    let size = unit === 'g' ? 300 : 1, u = unitShort(unit);
    return `Stock shows as: <b>2 ${esc(plural(w, 2))} left · ${size * 2} ${esc(u)}</b>. The + and − buttons add or remove one ${esc(w)}.`;
}
function packWordPreview() {
    let h = $('mcWordHint');
    if (h)
        h.innerHTML = packWordHint($('mcWord').value, $('mcUnit')?.value || 'g');
}

// ---- Making finished products: take the materials out (automatic stock only) ----
// Returns false if the person cancelled.
async function takeMaterials(p, qty) {
    let need = {};
    for (let x of p.materials || [])
        need[x.materialId] = (need[x.materialId] || 0) + num(x.amount) * qty;
    let use = Object.entries(need).map(([mid, q]) => [material(mid), q]).filter(([m, q]) => m && q > 0 && stockMode(m) === 'auto' && stockKnown(m));
    if (!use.length)
        return { ok: true, deducted: false };
    let short = use.filter(([m, q]) => num(m.stock) < q);
    if (short.length) {
        let msg = short.map(([m, q]) => `This uses ${+q.toFixed(2)} ${unitShort(m.unit)} of ${materialLabel(m)} but you have ${+num(m.stock).toFixed(2)} ${unitShort(m.unit)} left.`).join('\n\n') + '\n\nUpdate the amount?';
        let v = await appChoice(msg, [['cancel', 'Cancel', 'alt'], ['go', 'Continue anyway', 'alt'], ['update', 'Update', '']]);
        if (v === 'cancel' || !v)
            return { ok: false };
        if (v === 'update' && !await updateShortStock(short))
            return { ok: false };
    }
    for (let [m, q] of use)
        m.stock = Math.max(0, +(num(m.stock) - q).toFixed(3));
    return { ok: true, deducted: true };
}
// Ask for the real amount of each material that's running short.
function updateShortStock(short) {
    return new Promise(res => {
        openModal(`<div class="row"><h2 style="margin:0">Update the amount</h2>${closeX()}</div><p class="muted">How much do you have now?</p>${short.map(([m], i) => `<label for="ssAmt${i}">${esc(materialLabel(m))} (${esc(unitShort(m.unit))})</label><input id="ssAmt${i}" type="number" min="0" step="any" inputmode="decimal" value="${+num(m.stock).toFixed(2)}">`).join('')}<div class="actions"><button id="ssSave">Save and continue</button></div>`);
        let done = false, o = $('modal');
        $('ssSave').onclick = () => {
            short.forEach(([m], i) => m.stock = num($('ssAmt' + i).value));
            done = true;
            closeModal();
            res(true);
        };
        new MutationObserver((_, ob) => {
            if (!document.body.contains(o)) {
                ob.disconnect();
                if (!done)
                    res(false);
            }
        }).observe(document.body, { childList: true });
    });
}
// The "Don't take materials this time" box on a product's screen (automatic stock only).
function skipMaterialsBox(p) {
    if (p.noStockUse || !(p.materials || []).some(x => stockMode(material(x.materialId)) === 'auto'))
        return '';
    return `<label class="check"><input type="checkbox" id="skipMats"> Don't take materials this time</label>`;
}
function productStockHint(p) {
    if (p.noStockUse)
        return 'This product doesn’t use your material stock.';
    if ((p.materials || []).some(x => stockMode(material(x.materialId)) === 'auto'))
        return 'Adding stock records a production entry and takes the materials it uses out of your material stock.';
    return 'Adding stock records a production entry.';
}
function noStockUseField(p) {
    if (!stockModeInUse('auto'))
        return '';
    return `<label class="check"><input type="checkbox" id="pnostock" ${p.noStockUse ? 'checked' : ''}> Don't use my material stock for this product</label><div class="hint">Making this product won't take anything out of your material stock.</div>`;
}
// Stock after buying more: blank stays blank unless something was bought.
function addPacks(stock, packs, weight) {
    let known = stock !== null && stock !== undefined && stock !== '';
    return packs > 0 ? (known ? num(stock) : 0) + packs * num(weight) : (known ? num(stock) : null);
}
