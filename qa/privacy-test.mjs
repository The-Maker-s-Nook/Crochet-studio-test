// One-off privacy check on the real Supabase project: two throwaway accounts try to read and change
// each other's data and files. Prints PASS/FAIL only, then deletes both accounts and anything they made.
const URL0 = 'https://jrxapujzegvsjgljzxrp.supabase.co', PUB = 'sb_publishable_AV-UcJTr3h_YDD-lzLlJ7A_7MSUOq9a', SVC = process.env.SVC, BUCKET = 'user-files';
const rnd = Math.random().toString(36).slice(2, 10), out = []; let fails = 0;
const ok = (n, pass, info = '') => { out.push(`${pass ? 'PASS' : 'FAIL'} | ${n}${info ? ' | ' + info : ''}`); if (!pass) fails++; };
async function call(path, { method = 'GET', token, key = PUB, body, headers = {}, raw } = {}) {
  const h = { apikey: key, ...headers }; if (token) h.Authorization = 'Bearer ' + token;
  if (body !== undefined && !(body instanceof Blob) && !(body instanceof Uint8Array)) { h['Content-Type'] ||= 'application/json'; body = JSON.stringify(body); }
  const r = await fetch(URL0 + path, { method, headers: h, body }); const t = raw ? null : await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  return { status: r.status, j, r };
}
const admin = (path, o = {}) => call(path, { ...o, key: SVC, token: SVC });
const users = [];
try {
  // two throwaway accounts, confirmed, no emails sent
  for (const n of ['a', 'b']) {
    const email = `qa-privacy-${rnd}-${n}@example.com`, password = 'Qa!' + Math.random().toString(36).slice(2) + 'X9';
    const c = await admin('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } });
    if (c.status >= 300) throw new Error('create user failed ' + c.status + ' ' + JSON.stringify(c.j).slice(0, 120));
    const s = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    if (!s.j?.access_token) throw new Error('sign in failed ' + s.status);
    users.push({ id: c.j.id, token: s.j.access_token });
  }
  const [A, B] = users;
  // A saves data and a photo
  let w = await call('/rest/v1/app_data?on_conflict=user_id', { method: 'POST', token: A.token, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { user_id: A.id, data: { secret: 'A-only' }, updated_at: new Date().toISOString() } });
  ok('Account A can save its own data', w.status < 300, String(w.status));
  let up = await call(`/storage/v1/object/${BUCKET}/${A.id}/photos/p1`, { method: 'POST', token: A.token, headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: new Uint8Array([255, 216, 255, 217]) });
  ok('Account A can upload its own photo', up.status < 300, String(up.status));
  let ownRead = await call(`/rest/v1/app_data?select=data&user_id=eq.${A.id}`, { token: A.token });
  ok('Account A can read its own data back', ownRead.j?.[0]?.data?.secret === 'A-only');
  // B tries everything against A
  let r1 = await call(`/rest/v1/app_data?select=data&user_id=eq.${A.id}`, { token: B.token });
  ok('B cannot read A\'s data', Array.isArray(r1.j) && r1.j.length === 0, `${r1.status}, ${Array.isArray(r1.j) ? r1.j.length : '?'} rows`);
  let r2 = await call('/rest/v1/app_data?select=user_id', { token: B.token });
  ok('B listing all data sees none of A\'s', Array.isArray(r2.j) && !r2.j.some(x => x.user_id === A.id), `${r2.status}, ${Array.isArray(r2.j) ? r2.j.length : '?'} rows`);
  let r3 = await call('/rest/v1/app_data?on_conflict=user_id', { method: 'POST', token: B.token, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { user_id: A.id, data: { secret: 'overwritten by B' }, updated_at: new Date().toISOString() } });
  let r4 = await call(`/rest/v1/app_data?user_id=eq.${A.id}`, { method: 'PATCH', token: B.token, headers: { Prefer: 'return=representation' }, body: { data: { secret: 'patched by B' } } });
  let r5 = await call(`/rest/v1/app_data?user_id=eq.${A.id}`, { method: 'DELETE', token: B.token, headers: { Prefer: 'return=representation' } });
  let still = await call(`/rest/v1/app_data?select=data&user_id=eq.${A.id}`, { token: A.token });
  ok('B cannot overwrite, change or delete A\'s data', still.j?.[0]?.data?.secret === 'A-only', `upsert ${r3.status}, patch ${r4.status} (${Array.isArray(r4.j) ? r4.j.length : '?'} rows), delete ${r5.status} (${Array.isArray(r5.j) ? r5.j.length : '?'} rows)`);
  let s1 = await call(`/storage/v1/object/authenticated/${BUCKET}/${A.id}/photos/p1`, { token: B.token });
  ok('B cannot download A\'s photo', s1.status >= 400, String(s1.status));
  let s2 = await call(`/storage/v1/object/list/${BUCKET}`, { method: 'POST', token: B.token, body: { prefix: A.id + '/photos/', limit: 100, offset: 0 } });
  ok('B cannot list A\'s files', !Array.isArray(s2.j) || s2.j.length === 0, `${s2.status}, ${Array.isArray(s2.j) ? s2.j.length : '?'} files`);
  let s3 = await call(`/storage/v1/object/${BUCKET}/${A.id}/photos/evil`, { method: 'POST', token: B.token, headers: { 'Content-Type': 'image/jpeg' }, body: new Uint8Array([1, 2, 3]) });
  ok('B cannot put a file in A\'s folder', s3.status >= 400, String(s3.status));
  let s4 = await call(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', token: B.token, body: { prefixes: [`${A.id}/photos/p1`] } });
  let s5 = await call(`/storage/v1/object/authenticated/${BUCKET}/${A.id}/photos/p1`, { token: A.token });
  ok('B cannot delete A\'s photo', s5.status === 200, `delete ${s4.status}, A still reads it: ${s5.status}`);
  // No account at all
  let n1 = await call('/rest/v1/app_data?select=user_id,data');
  ok('Without signing in, no data can be read', Array.isArray(n1.j) ? n1.j.length === 0 : n1.status >= 400, `${n1.status}, ${Array.isArray(n1.j) ? n1.j.length + ' rows' : ''}`);
  let n2 = await call(`/storage/v1/object/authenticated/${BUCKET}/${A.id}/photos/p1`);
  ok('Without signing in, no photo can be downloaded', n2.status >= 400, String(n2.status));
  let n2b = await call(`/storage/v1/object/public/${BUCKET}/${A.id}/photos/p1`);
  ok('The file bucket is not public', n2b.status >= 400, String(n2b.status));
  let n3 = await call('/rest/v1/rpc/delete_user', { method: 'POST', body: {} });
  ok('Without signing in, "delete account" does nothing', n3.status >= 400, String(n3.status));
  // B deletes its own account: only B goes
  let d1 = await call('/rest/v1/rpc/delete_user', { method: 'POST', token: B.token, body: {} });
  let ua = await admin(`/auth/v1/admin/users/${A.id}`), ub = await admin(`/auth/v1/admin/users/${B.id}`);
  ok('Delete account removes only that account', d1.status < 300 && ua.status === 200 && ub.status === 404, `rpc ${d1.status}, A ${ua.status}, B ${ub.status}`);
  if (ub.status === 404) B.gone = true;
  // A's token can't touch other projects' style admin endpoints
  let a1 = await call('/auth/v1/admin/users', { token: A.token });
  ok('A normal account cannot use admin functions', a1.status >= 400, String(a1.status));
} catch (e) { ok('Test ran to the end', false, e.message); }
finally {
  for (const u of users) {
    await admin(`/rest/v1/app_data?user_id=eq.${u.id}`, { method: 'DELETE' }).catch(() => {});
    await admin(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', body: { prefixes: [`${u.id}/photos/p1`, `${u.id}/photos/evil`] } }).catch(() => {});
    if (!u.gone) await admin(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' }).catch(() => {});
    const chk = await admin(`/auth/v1/admin/users/${u.id}`);
    out.push(`CLEANUP | test account removed: ${chk.status === 404 ? 'yes' : 'NO (' + chk.status + ')'}`);
  }
  console.log(out.join('\n'));
  process.exit(fails ? 1 : 0);
}
