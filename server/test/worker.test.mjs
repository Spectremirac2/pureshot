// Worker uç nokta testleri (ağ ve wrangler gerektirmez).
// D1 yerine Node'un yerleşik SQLite'ı kullanılır ve gerçek schema.sql uygulanır.
//
//   node --disable-warning=ExperimentalWarning --test server/test/
//
// İstemci tarafı istekler, src/core/store.js içindeki ApiBackend'in ürettiği URL ve
// başlıklarla birebir aynı biçimde kurulur (bkz. apiUrl / headers).

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker, { publicId } from '../worker.js';
import { openD1 } from '../local/d1-sqlite.mjs';

const ORIGIN = 'https://site.example';
const ALICE = 'fmg1abc123xyz';
const BOB = 'fmg1def456uvw';
const ADMIN = 'yonetici-gizli-anahtar';

let env;
beforeEach(() => {
  env = { DB: openD1(':memory:'), ALLOWED_ORIGIN: '*', ADMIN_TOKEN: ADMIN, WRITE_LIMIT_PER_MIN: '1000', POST_LIMIT_PER_MIN: '1000' };
});

// store.js ApiBackend._url ile aynı
function apiUrl(col, q = {}, id) {
  const p = new URLSearchParams();
  if (q.where) p.set('where', `${q.where[0]}:${q.where[1]}`);
  if (q.orderBy) p.set('orderBy', q.orderBy);
  if (q.dir) p.set('dir', q.dir);
  if (q.limit) p.set('limit', String(q.limit));
  const qs = p.toString();
  const base = `${ORIGIN}/api/c/${encodeURIComponent(col)}`;
  return id != null ? `${base}/${encodeURIComponent(id)}` : `${base}${qs ? '?' + qs : ''}`;
}
const headers = (fan, extra = {}) => ({ 'content-type': 'application/json', ...(fan ? { 'x-fan-id': fan } : {}), ...extra });

const waits = [];
const ctx = { waitUntil: (p) => waits.push(p) };

async function call(method, url, { fan, body, headers: extra, raw } = {}) {
  const init = { method, headers: headers(fan, extra) };
  if (raw != null) init.body = raw;
  else if (body !== undefined) init.body = JSON.stringify(body);
  const res = await worker.fetch(new Request(url, init), env, ctx);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* metin yanıt */ }
  return { status: res.status, json, text, headers: res.headers };
}
const list = (col, q, fan) => call('GET', apiUrl(col, q), { fan });
const get = (col, id, fan) => call('GET', apiUrl(col, {}, id), { fan });
const add = (col, body, fan) => call('POST', apiUrl(col), { fan, body });
const put = (col, id, body, fan, h) => call('PUT', apiUrl(col, {}, id), { fan, body, headers: h });
const patch = (col, id, body, fan, h) => call('PATCH', apiUrl(col, {}, id), { fan, body, headers: h });
const del = (col, id, fan, h) => call('DELETE', apiUrl(col, {}, id), { fan, headers: h });

describe('health', () => {
  test('şema varken ok: true', async () => {
    const r = await call('GET', `${ORIGIN}/api/health`);
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
  });
  test('DB yoksa 503 ve ok: false (istemci localStorage moduna kalır)', async () => {
    env.DB = undefined;
    const r = await call('GET', `${ORIGIN}/api/health`);
    assert.equal(r.status, 503);
    assert.equal(r.json.ok, false);
  });
  test('şema uygulanmamışsa 503', async () => {
    env.DB = openD1(':memory:', { schema: false });
    const r = await call('GET', `${ORIGIN}/api/health`);
    assert.equal(r.status, 503);
    assert.equal(r.json.error, 'schema');
  });
});

describe('koleksiyon CRUD', () => {
  test('POST → { id }, GET liste → { docs }, GET tek → { doc }', async () => {
    const a = await add('jokes', { text: 'Mid or feed? İkisi birden.', cat: 'mid', nick: 'Farmcı Kurye 12', authorId: 'sahte', createdAt: 1, id: 'sahte' }, ALICE);
    assert.equal(a.status, 201);
    assert.match(a.json.id, /^[A-Za-z0-9]{20}$/);

    const l = await list('jokes', {}, ALICE);
    assert.equal(l.status, 200);
    assert.equal(l.json.docs.length, 1);
    const d = l.json.docs[0];
    assert.equal(d.id, a.json.id);
    assert.equal(d.text, 'Mid or feed? İkisi birden.');
    assert.equal(d.authorId, ALICE, 'yazar kendi ham kimliğini görür');
    assert.ok(d.createdAt > 1_600_000_000_000, 'createdAt sunucu tarafından konur');

    const g = await get('jokes', a.json.id, ALICE);
    assert.equal(g.status, 200);
    assert.deepEqual(g.json.doc, d);
  });

  test('başkaları authorId yerine genel kimlik (p_...) görür', async () => {
    const { json } = await add('comments', { thread: 'joke:1', text: 'DOG DOG DOG' }, ALICE);
    const asBob = (await get('comments', json.id, BOB)).json.doc;
    const anon = (await get('comments', json.id)).json.doc;
    const pub = await publicId(env, ALICE);
    assert.equal(asBob.authorId, pub);
    assert.equal(anon.authorId, pub);
    assert.match(pub, /^p_[A-Za-z0-9_-]{16}$/);
    // genel kimlikle filtreleme çalışır
    const byPub = await list('comments', { where: ['authorId', pub] }, BOB);
    assert.equal(byPub.json.docs.length, 1);
    // yönetici ham kimliği görür
    const adm = await call('GET', apiUrl('comments', {}, json.id), { headers: { authorization: `Bearer ${ADMIN}` } });
    assert.equal(adm.json.doc.authorId, ALICE);
  });

  test('GET olmayan belge → 404', async () => {
    const r = await get('jokes', 'yok123');
    assert.equal(r.status, 404);
  });

  test('bilinmeyen koleksiyon → 404, geçersiz kimlik → 400', async () => {
    assert.equal((await list('users')).status, 404);
    assert.equal((await add('users', { a: 1 }, ALICE)).status, 404);
    assert.equal((await call('GET', `${ORIGIN}/api/c/jokes/a%20b`)).status, 400);
    assert.equal((await call('GET', `${ORIGIN}/api/nope`)).status, 404);
  });

  test('PATCH sığ birleştirir; yazar ve createdAt değişmez', async () => {
    const { json } = await add('questions', { title: 'Aegis kaç kez düşer?', body: 'Merak ettim.', nick: 'Tilt Ward 44' }, ALICE);
    const before = (await get('questions', json.id, ALICE)).json.doc;
    const p = await patch('questions', json.id, { acceptedId: 'ans1', authorId: BOB, createdAt: 5 }, ALICE);
    assert.equal(p.status, 200);
    const after = (await get('questions', json.id, ALICE)).json.doc;
    assert.equal(after.acceptedId, 'ans1');
    assert.equal(after.title, before.title);
    assert.equal(after.body, before.body);
    assert.equal(after.authorId, ALICE);
    assert.equal(after.createdAt, before.createdAt);
  });

  test('PATCH/DELETE: yalnızca yazar ya da yönetici', async () => {
    const { json } = await add('answers', { qid: 'q1', text: 'Roshan her seferinde Aegis bırakır.' }, ALICE);
    assert.equal((await patch('answers', json.id, { text: 'hack' }, BOB)).status, 403);
    assert.equal((await del('answers', json.id, BOB)).status, 403);
    // genel kimliği x-fan-id olarak kullanmak işe yaramaz
    const pub = await publicId(env, ALICE);
    assert.equal((await del('answers', json.id, pub)).status, 401);
    // yanlış yönetici anahtarı
    assert.equal((await del('answers', json.id, BOB, { authorization: 'Bearer yanlis' })).status, 403);
    // yazar düzenler
    assert.equal((await patch('answers', json.id, { text: 'Düzenlendi.' }, ALICE)).status, 200);
    // yönetici siler
    const d = await del('answers', json.id, null, { authorization: `Bearer ${ADMIN}` });
    assert.equal(d.status, 200);
    assert.equal((await get('answers', json.id)).status, 404);
    assert.equal((await del('answers', json.id, ALICE)).status, 404);
    assert.equal((await patch('answers', json.id, { text: 'x' }, ALICE)).status, 404);
  });

  test('yazar kendi belgesini siler', async () => {
    const { json } = await add('comments', { thread: 't', text: 'gg wp' }, BOB);
    assert.equal((await del('comments', json.id, BOB)).status, 200);
    assert.equal((await list('comments')).json.docs.length, 0);
  });

  test('PUT: yoksa oluşturur, varsa yalnızca yazar değiştirir', async () => {
    const c = await put('jokes', 'ozel-id_1', { text: 'Kurye yine yolda.' }, ALICE);
    assert.equal(c.status, 201);
    assert.equal((await put('jokes', 'ozel-id_1', { text: 'ele geçir' }, BOB)).status, 403);
    const createdAt = (await get('jokes', 'ozel-id_1')).json.doc.createdAt;
    const r = await put('jokes', 'ozel-id_1', { text: 'Kurye geldi, bottle yok.' }, ALICE);
    assert.equal(r.status, 200);
    const doc = (await get('jokes', 'ozel-id_1', ALICE)).json.doc;
    assert.equal(doc.text, 'Kurye geldi, bottle yok.');
    assert.equal(doc.createdAt, createdAt, 'PUT oluşturma zamanını korur');
    assert.equal(doc.authorId, ALICE);
    assert.equal((await put('jokes', 'p_ayrilmis', { text: 'x' }, ALICE)).status, 400);
  });

  test('yazma için x-fan-id gerekli', async () => {
    assert.equal((await add('jokes', { text: 'anonim' })).status, 401);
    assert.equal((await add('jokes', { text: 'bozuk' }, 'geçersiz kimlik!')).status, 401);
  });
});

describe('fans', () => {
  const fanDoc = { nick: 'Uykusuz Roshan 77', dog: 42, likes: { 'c:1': 1 }, scores: { lasthit: 18 }, picks: { fav: 'mid' }, updatedAt: 1 };

  test('kendi belgeni PUT ile yazarsın, başkasınınkini yazamazsın', async () => {
    assert.equal((await put('fans', ALICE, fanDoc, ALICE)).status, 201);
    assert.equal((await put('fans', ALICE, { ...fanDoc, dog: 43 }, ALICE)).status, 200);
    assert.equal((await put('fans', ALICE, fanDoc, BOB)).status, 403);
    assert.equal((await patch('fans', ALICE, { dog: 0 }, BOB)).status, 403);
    assert.equal((await del('fans', ALICE, BOB)).status, 403);
    assert.equal((await add('fans', fanDoc, ALICE)).status, 405);
    const own = (await get('fans', ALICE, ALICE)).json.doc;
    assert.equal(own.id, ALICE);
    assert.equal(own.dog, 43);
    assert.ok(own.updatedAt > 1, 'updatedAt sunucu zamanı');
  });

  test('liste: başkalarının belge kimliği maskelenir, genel kimlikle okunabilir', async () => {
    await put('fans', ALICE, fanDoc, ALICE);
    await put('fans', BOB, { ...fanDoc, nick: 'Smoke Carry 11', dog: 3 }, BOB);
    const l = (await list('fans', { limit: 1000 }, BOB)).json.docs;
    assert.equal(l.length, 2);
    const mine = l.find((d) => d.id === BOB);
    const other = l.find((d) => d.id !== BOB);
    assert.ok(mine, 'kendi belgem ham kimlikle gelir (store.fans birleştirmesi için)');
    assert.equal(other.id, await publicId(env, ALICE));
    assert.equal(other.authorId, other.id);
    assert.equal(other.nick, 'Uykusuz Roshan 77');
    const g = await get('fans', other.id, BOB);
    assert.equal(g.status, 200);
    assert.equal(g.json.doc.dog, 42);
    // genel kimlikle yazılamaz
    assert.equal((await put('fans', other.id, fanDoc, BOB)).status, 403);
  });

  test('alan türleri doğrulanır', async () => {
    assert.equal((await put('fans', ALICE, { ...fanDoc, dog: -1 }, ALICE)).status, 400);
    assert.equal((await put('fans', ALICE, { ...fanDoc, dog: '5' }, ALICE)).status, 400);
    assert.equal((await put('fans', ALICE, { ...fanDoc, likes: [] }, ALICE)).status, 400);
    assert.equal((await put('fans', ALICE, { ...fanDoc, nick: 'x'.repeat(25) }, ALICE)).status, 400);
    assert.equal((await put('fans', ALICE, { ...fanDoc, nick: 'ş'.repeat(24) }, ALICE)).status, 201);
  });
});

describe('doğrulama', () => {
  test('uzunluk sınırları (Unicode karakter sayısı)', async () => {
    assert.equal((await add('jokes', { text: 'ğ'.repeat(280) }, ALICE)).status, 201);
    const r = await add('jokes', { text: 'ğ'.repeat(281) }, ALICE);
    assert.equal(r.status, 400);
    assert.equal(r.json.error, 'too_long');
    assert.equal(r.json.field, 'text');
    assert.equal((await add('comments', { thread: 't', text: 'a'.repeat(401) }, ALICE)).status, 400);
    assert.equal((await add('questions', { title: 'a'.repeat(121) }, ALICE)).status, 400);
    assert.equal((await add('questions', { title: 'ok', body: 'a'.repeat(601) }, ALICE)).status, 400);
    assert.equal((await add('answers', { qid: 'q', text: 'a'.repeat(601) }, ALICE)).status, 400);
    assert.equal((await add('jokes', { text: 'ok', nick: 'a'.repeat(25) }, ALICE)).status, 400);
    assert.equal((await add('jokes', { text: 'ok', extra: 'a'.repeat(1001) }, ALICE)).status, 400);
  });
  test('zorunlu alanlar', async () => {
    assert.equal((await add('jokes', { cat: 'mid' }, ALICE)).status, 400);
    assert.equal((await add('jokes', { text: '   ' }, ALICE)).status, 400);
    assert.equal((await add('comments', { text: 'thread yok' }, ALICE)).status, 400);
    assert.equal((await add('answers', { text: 'qid yok' }, ALICE)).status, 400);
    const { json } = await add('jokes', { text: 'var' }, ALICE);
    assert.equal((await patch('jokes', json.id, { text: '' }, ALICE)).status, 400);
    assert.equal((await patch('jokes', json.id, { cat: 'late' }, ALICE)).status, 200, 'PATCH yalnızca gelen alanları doğrular');
  });
  test('gövde düz JSON nesne olmalı ve ≤ 200 KB', async () => {
    assert.equal((await call('POST', apiUrl('jokes'), { fan: ALICE, raw: '[1,2]' })).status, 400);
    assert.equal((await call('POST', apiUrl('jokes'), { fan: ALICE, raw: 'null' })).status, 400);
    assert.equal((await call('POST', apiUrl('jokes'), { fan: ALICE, raw: '{bozuk' })).status, 400);
    assert.equal((await call('POST', apiUrl('jokes'), { fan: ALICE, raw: '{"__proto__":{"x":1},"text":"a"}' })).status, 400);
    const big = { ...{ nick: 'a' }, likes: {} };
    for (let i = 0; i < 16000; i++) big.likes['item-' + i] = 1; // ~230 KB
    const r = await put('fans', ALICE, big, ALICE);
    assert.equal(r.status, 413);
  });
});

describe('sorgular', () => {
  beforeEach(async () => {
    let t = 0;
    const realNow = Date.now;
    for (const [thread, text] of [['a', 'bir'], ['b', 'iki'], ['a', 'üç'], ['a', 'dört']]) {
      Date.now = () => 1_700_000_000_000 + ++t * 1000;
      await add('comments', { thread, text }, ALICE);
    }
    Date.now = realNow;
  });

  test('where eşitlik + orderBy createdAt desc + limit', async () => {
    const r = await list('comments', { where: ['thread', 'a'], orderBy: 'createdAt', dir: 'desc', limit: 2 });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.docs.map((d) => d.text), ['dört', 'üç']);
    const asc = await list('comments', { where: ['thread', 'a'], orderBy: 'createdAt', dir: 'asc' });
    assert.deepEqual(asc.json.docs.map((d) => d.text), ['bir', 'üç', 'dört']);
    const b = await list('comments', { where: ['thread', 'b'] });
    assert.deepEqual(b.json.docs.map((d) => d.text), ['iki']);
  });

  test('where değeri iki nokta içerebilir; sayısal alanlar eşleşir', async () => {
    await add('comments', { thread: 'joke:abc', text: 'x' }, BOB);
    assert.equal((await list('comments', { where: ['thread', 'joke:abc'] })).json.docs.length, 1);
    await put('fans', ALICE, { nick: 'A', dog: 7 }, ALICE);
    assert.equal((await list('fans', { where: ['dog', 7] })).json.docs.length, 1);
    assert.equal((await list('fans', { where: ['dog', 8] })).json.docs.length, 0);
  });

  test('orderBy alan değeri olmayanları sona koyar', async () => {
    await put('fans', ALICE, { nick: 'A', dog: 7 }, ALICE);
    await put('fans', BOB, { nick: 'B', dog: 70 }, BOB);
    await put('fans', 'fthird', { nick: 'C' }, 'fthird');
    const d = await list('fans', { orderBy: 'dog', dir: 'desc' });
    assert.deepEqual(d.json.docs.map((x) => x.nick), ['B', 'A', 'C']);
    const a = await list('fans', { orderBy: 'dog', dir: 'asc' });
    assert.deepEqual(a.json.docs.map((x) => x.nick), ['A', 'B', 'C']);
  });

  test('geçersiz sorgu parametreleri → 400; limit 1000 ile kırpılır', async () => {
    assert.equal((await call('GET', `${ORIGIN}/api/c/comments?orderBy=text`)).status, 400);
    assert.equal((await call('GET', `${ORIGIN}/api/c/comments?orderBy=createdAt;DROP`)).status, 400);
    assert.equal((await call('GET', `${ORIGIN}/api/c/comments?where=thread`)).status, 400);
    assert.equal((await call('GET', `${ORIGIN}/api/c/comments?where=a.b:1`)).status, 400);
    assert.equal((await call('GET', `${ORIGIN}/api/c/comments?where=x')--:1`)).status, 400);
    assert.equal((await call('GET', `${ORIGIN}/api/c/comments?dir=up`)).status, 400);
    assert.equal((await call('GET', `${ORIGIN}/api/c/comments?limit=0`)).status, 400);
    assert.equal((await call('GET', `${ORIGIN}/api/c/comments?limit=abc`)).status, 400);
    const r = await call('GET', `${ORIGIN}/api/c/comments?limit=5000`);
    assert.equal(r.status, 200);
    assert.equal(r.json.docs.length, 4);
  });
});

describe('hız sınırı', () => {
  test('IP başına dakikada POST sınırı → 429 + retry-after', async () => {
    env.POST_LIMIT_PER_MIN = '3';
    const ip = { 'cf-connecting-ip': '203.0.113.9' };
    for (let i = 0; i < 3; i++) {
      const r = await call('POST', apiUrl('jokes'), { fan: ALICE, body: { text: 'spam ' + i }, headers: ip });
      assert.equal(r.status, 201);
    }
    const r = await call('POST', apiUrl('jokes'), { fan: ALICE, body: { text: 'spam 4' }, headers: ip });
    assert.equal(r.status, 429);
    assert.ok(Number(r.headers.get('retry-after')) > 0);
    // farklı IP etkilenmez
    const other = await call('POST', apiUrl('jokes'), { fan: BOB, body: { text: 'temiz' }, headers: { 'cf-connecting-ip': '198.51.100.1' } });
    assert.equal(other.status, 201);
    // yönetici sınırdan muaf
    const adm = await call('DELETE', apiUrl('jokes', {}, other.json.id), { headers: { ...ip, authorization: `Bearer ${ADMIN}` } });
    assert.equal(adm.status, 200);
  });
  test('PUT/PATCH/DELETE ayrı kovada sayılır', async () => {
    env.WRITE_LIMIT_PER_MIN = '2';
    const ip = { 'cf-connecting-ip': '203.0.113.10' };
    assert.equal((await put('fans', ALICE, { nick: 'a' }, ALICE, ip)).status, 201);
    assert.equal((await put('fans', ALICE, { nick: 'b' }, ALICE, ip)).status, 200);
    assert.equal((await put('fans', ALICE, { nick: 'c' }, ALICE, ip)).status, 429);
    assert.equal((await call('POST', apiUrl('jokes'), { fan: ALICE, body: { text: 'ok' }, headers: ip })).status, 201);
  });
});

describe('CORS ve statik varlıklar', () => {
  test('OPTIONS ön uç yanıtı', async () => {
    const res = await worker.fetch(new Request(`${ORIGIN}/api/c/jokes`, { method: 'OPTIONS', headers: { origin: 'https://baska.example', 'access-control-request-method': 'POST' } }), env, ctx);
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    assert.match(res.headers.get('access-control-allow-headers'), /x-fan-id/);
    assert.match(res.headers.get('access-control-allow-methods'), /PATCH/);
  });
  test('ALLOWED_ORIGIN listesi', async () => {
    env.ALLOWED_ORIGIN = 'https://a.example, https://b.example';
    const ok = await worker.fetch(new Request(`${ORIGIN}/api/health`, { headers: { origin: 'https://b.example' } }), env, ctx);
    assert.equal(ok.headers.get('access-control-allow-origin'), 'https://b.example');
    const no = await worker.fetch(new Request(`${ORIGIN}/api/health`, { headers: { origin: 'https://kotu.example' } }), env, ctx);
    assert.equal(no.headers.get('access-control-allow-origin'), null);
  });
  test('/api dışı istekler ASSETS bağlamasına düşer', async () => {
    let seen = null;
    env.ASSETS = { fetch: async (req) => { seen = new URL(req.url).pathname; return new Response('<html>site</html>', { headers: { 'content-type': 'text/html' } }); } };
    const r = await call('GET', `${ORIGIN}/index.html`);
    assert.equal(r.status, 200);
    assert.equal(seen, '/index.html');
    delete env.ASSETS;
    assert.equal((await call('GET', `${ORIGIN}/`)).status, 404);
  });
  test('JSON yanıtları önbelleğe alınmaz', async () => {
    const r = await list('jokes');
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.match(r.headers.get('content-type'), /application\/json/);
  });
});
