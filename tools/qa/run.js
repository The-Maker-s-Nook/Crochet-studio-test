// Compact QA pass for update 23. Usage: node run.js <port>
const { chromium } = require('playwright');
const fs = require('fs');
const PORT = process.argv[2] || 8765, URL = `http://localhost:${PORT}/index.html`;
const results = [];
const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAAEklEQVR4nGP4z8CAB+GTG8HSALfKY52fctzXAAAAAElFTkSuQmCC';
fs.writeFileSync('/tmp/qa-photo.png', Buffer.from(PNG, 'base64'));

process.on('unhandledRejection', e => { console.log('CRASH ' + String(e.message).split('\n')[0]); });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, serviceWorkers: 'allow' });
  const p = await ctx.newPage(); p.setDefaultTimeout(8000);
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::ERR|Failed to load resource|supabase/i.test(m.text())) errs.push('console: ' + m.text()); });
  p.on('dialog', d => { errs.push('native dialog: ' + d.message()); d.dismiss(); });
  await p.addLocatorHandler(p.locator('#tutWelcome'), async () => { const n = p.locator('#tutWelcome button').filter({ hasText: 'Not now' }); if (await n.count()) await n.first().click(); else await p.evaluate(() => document.getElementById('tutWelcome')?.remove()); });
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const screen = () => ev(() => document.body.dataset.screen);
  const wait = (ms = 300) => p.waitForTimeout(ms);
  const clickText = async (sel, t) => { await p.locator(sel).filter({ hasText: t }).first().click(); await wait(); };
  const dialogBtn = async t => { await p.locator('.modal button, .overlay button, [role=dialog] button').filter({ hasText: t }).first().click(); await wait(); };

  // 1. Fresh start
  await p.goto(URL); await wait(2000);
  const first = await screen();
  ok('Fresh start opens a first screen', !!first, first);
  // skip account + setup the way a tester would
  for (const t of ['Continue without an account', 'Skip', 'Skip setup', 'Not now', 'Close']) {
    const l = p.locator('button').filter({ hasText: t }).first();
    if (await l.count() && await l.isVisible()) { await l.click(); await wait(400); }
  }
  await ev(() => { document.querySelectorAll('.modal,.overlay').forEach(e => e.remove()); window.setupNeeded = () => false; view('home'); });
  await wait(400);
  ok('Home loads with new brand', (await ev(() => document.querySelector('header .brand').innerText)).includes('Makers Nook'));
  ok('Tapping the logo goes Home', await (async () => { await ev(() => view('products')); await wait(); await p.click('header .brand'); await wait(); return (await screen()) === 'home'; })());

  // 2. Material via the real form
  await ev(() => view('materials')); await wait();
  await ev(() => newMaterial()); await wait(400);
  await p.fill('#mname', 'Cotton yarn'); await p.fill('#mprice', '6').catch(() => {});
  await p.fill('#mweight', '100').catch(() => {});
  await p.locator('#app button[type=submit]').filter({ hasText: 'Save material' }).click(); await wait(500);
  const mats = await ev(() => data.materials.map(m => m.name));
  ok('Create material from the form', mats.includes('Cotton yarn'), JSON.stringify(mats));

  // 3. Product via the real form, with a photo
  await ev(() => view('products')); await wait();
  await clickText('#app button', '+ Product');
  ok('+ Product opens the form', (await screen()) === 'productForm');
  await p.fill('#pname', 'Bunny plush'); await p.fill('#pvariation', 'Lilac');
  await p.fill('#pprice', '35').catch(() => {});
  await p.fill('#pinitialStock', '5').catch(() => {});
  try {
    await p.locator('#app button').filter({ hasText: 'Add photo' }).first().click(); await wait();
    const fc = p.waitForEvent('filechooser', { timeout: 5000 });
    await p.locator('.modal button').filter({ hasText: 'Choose from gallery' }).first().click();
    await (await fc).setFiles('/tmp/qa-photo.png'); await wait(1200);
  } catch (e) { console.log('photo step: ' + e.message.split('\n')[0]); }
  await p.locator('#app button').filter({ hasText: /^Save product$/ }).click(); await wait(500);
  const yes = p.locator('.modal button').filter({ hasText: /^Yes$/ }).first();
  if (await yes.count()) { await yes.click(); await wait(800); }
  const prod = await ev(() => data.products.find(x => x.name === 'Bunny plush'));
  ok('Create product from the form', !!prod, prod ? `stock ${prod.stock}, price ${prod.price}` : 'missing');
  ok('Product kept its photo', !!(prod && (prod.photo || (prod.photos || []).length)));
  ok('Starting stock saved', prod && Number(prod.stock) === 5, prod && String(prod.stock));
  await ev(() => { data.products.push({ id: 'p2', name: 'Bucket hat', variation: 'Sage', price: 28, stock: 4, materials: [] }); save(); });

  // 4. Cancel + discard on the product form
  await ev(() => view('products')); await wait();
  await clickText('#app button', '+ Product');
  await p.fill('#pname', 'Throwaway');
  await p.locator('#app button[onclick="goBack()"]').filter({ hasText: 'Cancel' }).click(); await wait();
  const askd = await p.locator('text=Discard your changes?').count();
  ok('Cancel with typing asks to discard', askd > 0);
  if (askd) await dialogBtn('Discard');
  ok('Discard returns to Products, nothing saved', (await screen()) === 'products' && !(await ev(() => data.products.some(x => x.name === 'Throwaway'))));

  // 5. Market: create, pack, sell
  await ev(() => view('markets')); await wait();
  await ev(() => go('marketForm')); await wait();
  await p.fill('#marketName', 'Holiday Fair'); await p.fill('#marketCost', '40').catch(() => {});
  await p.locator('#app button').filter({ hasText: 'Save market' }).click(); await wait(600);
  const mk = await ev(() => data.markets.find(m => m.name === 'Holiday Fair'));
  ok('Create market', !!mk);
  if (mk) {
    await ev(id => { marketSelected = id; view('marketDetail'); }, mk.id); await wait();
    await clickText('#app button', '+ Add inventory');
    const addRows = await p.locator('#pickList .addrow').count();
    const addThumbs = await p.locator('#pickList .addrow .thumb').count();
    ok('Add inventory list shows product photos', addRows > 0 && addThumbs === addRows, `${addThumbs}/${addRows}`);
    await p.locator('#pickList .addrow').first().locator('button').filter({ hasText: 'All' }).click(); await wait();
    await clickText('#app button', 'Add all selected');
    const items = await ev(id => data.markets.find(m => m.id === id).items, mk.id);
    ok('Packing adds items to the market', Object.keys(items || {}).length > 0, JSON.stringify(items));
    ok('Market inventory rows show photos', (await p.locator('#mktItems .entry .thumb').count()) === Object.keys(items || {}).length);
    // sale
    await clickText('#app button', 'Start a sale');
    await p.locator('#mktItems .entry').first().locator('button').filter({ hasText: '+' }).click(); await wait();
    const stockBefore = await ev(() => data.products.map(x => [x.id, num(x.stock)]));
    await clickText('#app button', 'Review sale');
    const cashBtn = p.locator('button').filter({ hasText: /^Cash/ }).first();
    if (await cashBtn.count()) { await cashBtn.click(); await wait(); }
    await p.locator('button[onclick="completeSale()"]').first().click(); await wait(700);
    const sales = await ev(() => data.sales.length);
    const stockAfter = await ev(() => data.products.map(x => [x.id, num(x.stock)]));
    ok('Market sale completes', sales > 0, `${sales} sale lines`);
    ok('Stock goes down after the sale', JSON.stringify(stockBefore) !== JSON.stringify(stockAfter), `${JSON.stringify(stockBefore)} -> ${JSON.stringify(stockAfter)}`);
  }

  // 6. Quick sale
  await ev(() => { view('home'); }); await wait();
  await ev(() => startQuickSale()); await wait();
  const qrows = await p.locator('.qrow').count();
  ok('Quick sale lists products with photos', qrows > 0 && (await p.locator('.qrow .thumb').count()) === qrows);
  await p.locator('.qrow').filter({ hasText: 'Bucket hat' }).locator('button').filter({ hasText: '+' }).first().click(); await wait();
  const before = await ev(() => data.sales.length);
  await clickText('button', 'Review sale');
  const cash2 = p.locator('button').filter({ hasText: /^Cash/ }).first();
  if (await cash2.count()) { await cash2.click(); await wait(); }
  await p.locator('button[onclick="completeSale()"]').first().click(); await wait(700);
  ok('Quick sale completes', (await ev(() => data.sales.length)) > before);

  // 7. Back button closes a pop-up first
  await ev(() => view('products')); await wait();
  await ev(() => go('settings')); await wait();
  await ev(() => { appAlert('QA pop-up', 'QA'); }); await wait();
  await p.goBack(); await wait(500);
  const popGone = !(await p.locator('text=QA pop-up').count());
  ok('Phone back closes a pop-up and stays on the screen', popGone && (await screen()) === 'settings', await screen());

  // 8. Settings + guides
  const st = await ev(() => document.getElementById('app').innerText);
  ok('Settings shows update 23', /update 23/.test(st));
  for (const f of ['guides/tester-guide.pdf', 'guides/whats-new-24.pdf']) {
    const r = await p.request.get(`http://localhost:${PORT}/${f}`);
    ok(`Guide served: ${f}`, r.status() === 200 && (await r.body()).length > 50000);
  }

  // 9. Reports + downloads
  await ev(() => view('reports')); await wait(600);
  const tabs = ['Overview', 'Markets', 'Stock', 'Expenses'];
  let tabOk = true;
  for (const t of tabs) { const l = p.locator('#app button, #app [role=tab]').filter({ hasText: t }).first(); if (await l.count()) { await l.click(); await wait(300); } else tabOk = false; }
  ok('Reports tabs open', tabOk && !errs.length);
  for (const kind of ['PDF', 'Excel']) {
    try {
      const dl = p.waitForEvent('download', { timeout: 6000 });
      await ev(k => { dlFmt = k === 'Excel' ? 'xlsx' : 'pdf'; downloadReport(); }, kind); await wait(400);
      const d = await dl; const path = await d.path();
      ok(`Report download: ${kind}`, fs.statSync(path).size > 1000 && d.suggestedFilename().endsWith(kind === 'Excel' ? '.xlsx' : '.pdf'), d.suggestedFilename());
    } catch (e) { ok(`Report download: ${kind}`, false, e.message.split('\n')[0]); }
    await ev(() => document.querySelectorAll('.modal,.overlay').forEach(e => e.remove()));
  }

  // 10. Backup and restore round trip
  let backupPath = '';
  try {
    await ev(() => go('settingsBackup')); await wait();
    const dl = p.waitForEvent('download', { timeout: 6000 });
    await clickText('#app button', 'Download backup');
    const d = await dl; backupPath = await d.path();
    const j = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    ok('Backup downloads with the new name', j.app === 'The Makers Nook' && /^makers-nook-backup-/.test(d.suggestedFilename()), d.suggestedFilename());
    ok('Backup holds products, markets and sales', j.data.products.length >= 2 && j.data.markets.length >= 1 && j.data.sales.length >= 2);
  } catch (e) { ok('Backup download', false, e.message.split('\n')[0]); }
  if (backupPath) {
    const counts = await ev(() => [data.products.length, data.markets.length, data.sales.length]);
    await ev(() => { data.products = []; data.markets = []; data.sales = []; save(); go('settingsBackup'); }); await wait();
    const inp = p.locator('#app input[type=file]').first();
    await inp.setInputFiles(backupPath); await wait(800);
    for (const t of ['Restore', 'Replace', 'Yes', 'Continue']) { const l = p.locator('.modal button, .overlay button').filter({ hasText: t }).first(); if (await l.count()) { await l.click(); await wait(800); break; } }
    await wait(800);
    const after = await ev(() => [data.products.length, data.markets.length, data.sales.length]);
    ok('Restore brings everything back', JSON.stringify(after) === JSON.stringify(counts), `${counts} -> ${after}`);
  }

  // 11. Undo delete
  await ev(() => view('products')); await wait();
  const n0 = await ev(() => data.products.length);
  await ev(() => { deleteProduct('p2'); }); await wait(400);
  const conf = p.locator('.modal button, .overlay button').filter({ hasText: 'Delete' }).first();
  if (await conf.count()) { await conf.click(); await wait(400); }
  const n1 = await ev(() => data.products.length);
  const undo = p.locator('#undoBar button').filter({ hasText: 'Undo' }).first();
  if (await undo.count()) { await undo.click(); await wait(400); }
  ok('Delete then Undo restores the product', n1 === n0 - 1 && (await ev(() => data.products.length)) === n0, `${n0} -> ${n1} -> ${await ev(() => data.products.length)}`);

  // 12. Move notices
  await ev(() => { window.TEST_HOST = 'crochetstudiotest.netlify.app'; view('home'); }); await wait();
  ok('Old address shows "We’ve moved"', (await p.locator('.movenote').innerText()).includes('moved to app.themakersnook.ca'));
  ok('Old address links to the new one', (await ev(() => document.querySelector('.movenote a')?.href)) === 'https://app.themakersnook.ca/');
  await ev(() => { window.TEST_HOST = location.hostname; view('home'); }); await wait();

  // 13. Narrow screens: nothing wider than the phone
  const wide = [];
  for (const w of [360, 320]) {
    await p.setViewportSize({ width: w, height: 740 });
    for (const s of ['home', 'products', 'materials', 'markets', 'reports', 'settings']) {
      await ev(s => view(s), s); await wait(250);
      if (await ev(() => document.documentElement.scrollWidth > innerWidth + 1)) wide.push(`${s}@${w}`);
    }
    if (mk) { await ev(id => { marketSelected = id; view('marketDetail'); }, mk.id); await wait(250); if (await ev(() => document.documentElement.scrollWidth > innerWidth + 1)) wide.push(`market@${w}`); }
  }
  ok('No sideways scrolling at 360px and 320px', !wide.length, wide.join(', '));
  await p.setViewportSize({ width: 390, height: 844 });

  // 14. Works offline after first load
  try {
    await p.reload(); await wait(2500);
    const sw = await ev(() => navigator.serviceWorker && navigator.serviceWorker.controller ? 'controlled' : 'none');
    await ctx.setOffline(true);
    await p.reload(); await wait(2000);
    const offOk = await ev(() => !!document.querySelector('header .brand') && document.getElementById('app').innerText.length > 50);
    ok('Opens with no internet', offOk, sw);
    await ctx.setOffline(false);
  } catch (e) { ok('Opens with no internet', false, e.message.split('\n')[0]); await ctx.setOffline(false); }

  ok('No script errors during the run', !errs.length, errs.slice(0, 5).join(' | '));
  fs.writeFileSync('/home/claude/mock/qa/results.json', JSON.stringify({ results, errs }, null, 1));
  console.log(`\n${results.filter(r => r.pass).length}/${results.length} passed`);
  await b.close();
})();
