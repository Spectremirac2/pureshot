// DOG DOG DOG Üssü — paylaşılan veri API'si (Cloudflare Worker + D1).
//
// Site claude.ai Artifact dışında statik olarak yayınlandığında `src/core/store.js`
// `/api/health` → { ok: true } yanıtını görürse (ya da derlemede VITE_API_BASE verildiyse)
// REST moduna geçer ve yorumlar/espriler/sorular/fan profilleri burada saklanır.
//
// Uç noktalar (yanıt biçimleri store.js ApiBackend ile birebir):
//   GET    /api/health                              → { ok: true }
//   GET    /api/c/:col?where=f:v&orderBy=f&dir=asc|desc&limit=n → { docs: [{ id, ...alanlar }] }
//   GET    /api/c/:col/:id                          → { doc: { id, ...alanlar } } | 404
//   POST   /api/c/:col          (gövde: JSON nesne) → { id }
//   PUT    /api/c/:col/:id      (oluştur/değiştir)  → { ok: true, id }
//   PATCH  /api/c/:col/:id      (sığ birleştirme)   → { ok: true, id } | 404
//   DELETE /api/c/:col/:id                          → { ok: true, id } | 404
//
// Kimlik: istemci her istekte `x-fan-id` başlığı gönderir (tarayıcıda üretilen ziyaretçi kimliği).
// Bu hafif bir takma ad kimliğidir, gerçek oturum açma değildir. Kimliğin kolayca taklit
// edilememesi için başkalarına ait belgelerde `authorId` (ve fans belgelerinin kimliği)
// HMAC ile türetilmiş genel bir kimlikle (`p_...`) maskelenir; ham kimliği yalnızca sahibi görür.
//
// Ortam (wrangler.toml / gizli değişkenler):
//   DB                    D1 bağlaması (zorunlu)
//   ALLOWED_ORIGIN        CORS kökeni: "*" (varsayılan) ya da virgülle ayrılmış liste
//   ADMIN_TOKEN           (gizli) yönetici: `authorization: Bearer <token>` ile her belgeyi silebilir/düzenleyebilir
//   ID_SALT               (gizli, isteğe bağlı) genel kimlik HMAC anahtarı
//   WRITE_LIMIT_PER_MIN   IP başına dakikadaki PUT/PATCH/DELETE sınırı (varsayılan 60)
//   POST_LIMIT_PER_MIN    IP başına dakikadaki yeni içerik (POST) sınırı (varsayılan 10)
//   ASSETS                (isteğe bağlı) statik varlık bağlaması: /api dışı istekler siteye düşer

export const API_VERSION = 1;

const MAX_BODY_BYTES = 200 * 1024;
const MAX_LIMIT = 1000;
const MAX_KEYS = 100;
const DEFAULT_STRING_MAX = 1000;

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const FIELD_RE = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
const PUB_PREFIX = 'p_';
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Koleksiyon kuralları.
 *  limits:   metin alanı → en fazla karakter (Unicode kod noktası)
 *  required: oluştururken boş olmayan metin olması gereken alanlar
 *  objects:  varsa düz nesne olması gereken alanlar
 *  numbers:  varsa sonlu, negatif olmayan sayı olması gereken alanlar
 */
export const COLLECTIONS = {
  jokes: { limits: { text: 280, cat: 40, nick: 24 }, required: ['text'] },
  comments: { limits: { text: 400, thread: 120, nick: 24 }, required: ['text', 'thread'] },
  questions: { limits: { title: 120, body: 600, nick: 24, acceptedId: 64 }, required: ['title'] },
  answers: { limits: { text: 600, qid: 64, nick: 24 }, required: ['text', 'qid'] },
  fans: { limits: { nick: 24 }, required: [], objects: ['likes', 'scores', 'picks'], numbers: ['dog'] },
};

/** orderBy için izin verilen alanlar (gerekirse genişletin). */
export const ORDER_FIELDS = new Set([
  'createdAt', 'updatedAt', 'id', 'nick', 'dog', 'cat', 'thread', 'qid', 'title',
  'score', 'votes', 'likes', 'rank', 'order',
]);

// ------------------------------------------------------------------ yanıt yardımcıları
class HttpError extends Error {
  constructor(status, code, message, extra) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

function corsHeaders(request, env) {
  const allowed = String(env.ALLOWED_ORIGIN || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = request.headers.get('origin');
  let allow = null;
  if (allowed.includes('*')) allow = '*';
  else if (origin && allowed.includes(origin)) allow = origin;
  const h = { vary: 'Origin' };
  if (allow) {
    h['access-control-allow-origin'] = allow;
    h['access-control-allow-methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
    h['access-control-allow-headers'] = 'content-type, x-fan-id, authorization';
    h['access-control-max-age'] = '86400';
  }
  return h;
}

function json(status, body, cors, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...cors,
      ...extra,
    },
  });
}

// ------------------------------------------------------------------ kimlik
function fanIdOf(request) {
  const v = request.headers.get('x-fan-id');
  if (!v || !ID_RE.test(v) || v.startsWith(PUB_PREFIX)) return null;
  return v;
}

function safeEqual(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(String(a));
  const y = enc.encode(String(b));
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

function isAdmin(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  return !!m && safeEqual(m[1].trim(), env.ADMIN_TOKEN);
}

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const keyCache = new Map();
async function hmacKey(env) {
  const salt = env.ID_SALT || 'dogdogdog-public-id-v1';
  if (!keyCache.has(salt)) {
    keyCache.set(
      salt,
      crypto.subtle.importKey('raw', new TextEncoder().encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    );
  }
  return keyCache.get(salt);
}

/** Ham ziyaretçi kimliğinden herkese gösterilebilen, geri döndürülemez genel kimlik. */
export async function publicId(env, raw) {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), new TextEncoder().encode(String(raw)));
  return PUB_PREFIX + b64url(new Uint8Array(sig)).slice(0, 16);
}

function newDocId() {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let s = '';
  for (const b of bytes) s += alphabet[b % 62];
  return s;
}

// ------------------------------------------------------------------ doğrulama
function cpLen(s) {
  let n = 0;
  for (const _ of s) n++; // eslint-disable-line no-unused-vars
  return n;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

async function readBody(request) {
  const declared = Number(request.headers.get('content-length'));
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, 'too_large', 'Gövde 200 KB sınırını aşıyor.');
  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX_BODY_BYTES) throw new HttpError(413, 'too_large', 'Gövde 200 KB sınırını aşıyor.');
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(buf));
  } catch {
    throw new HttpError(400, 'bad_json', 'Gövde geçerli JSON değil.');
  }
  if (!isPlainObject(data)) throw new HttpError(400, 'bad_body', 'Gövde düz bir JSON nesnesi olmalı.');
  const keys = Object.keys(data);
  if (keys.length > MAX_KEYS) throw new HttpError(400, 'too_many_fields', 'Çok fazla alan.');
  for (const k of keys) {
    if (RESERVED_KEYS.has(k)) throw new HttpError(400, 'bad_field', `Geçersiz alan adı: ${k}`);
  }
  // Sunucunun yönettiği alanlar istemciden alınmaz
  const { id, authorId, createdAt, ...rest } = data; // eslint-disable-line no-unused-vars
  return rest;
}

/** Alan kurallarını uygular. mode: 'create' (tam belge) | 'patch' (yalnızca gelen alanlar). */
function validate(col, data, mode) {
  const rules = COLLECTIONS[col];
  for (const [k, v] of Object.entries(data)) {
    const max = rules.limits[k];
    if (max != null) {
      if (v == null && !rules.required.includes(k)) continue; // isteğe bağlı alan temizlenebilir
      if (typeof v !== 'string') throw new HttpError(400, 'bad_field', `"${k}" metin olmalı.`, { field: k });
      if (cpLen(v) > max) throw new HttpError(400, 'too_long', `"${k}" en fazla ${max} karakter olabilir.`, { field: k, max });
    } else if (typeof v === 'string' && cpLen(v) > DEFAULT_STRING_MAX) {
      throw new HttpError(400, 'too_long', `"${k}" en fazla ${DEFAULT_STRING_MAX} karakter olabilir.`, { field: k, max: DEFAULT_STRING_MAX });
    }
    if (rules.objects && rules.objects.includes(k) && !isPlainObject(v)) {
      throw new HttpError(400, 'bad_field', `"${k}" nesne olmalı.`, { field: k });
    }
    if (rules.numbers && rules.numbers.includes(k) && !(typeof v === 'number' && Number.isFinite(v) && v >= 0)) {
      throw new HttpError(400, 'bad_field', `"${k}" negatif olmayan sayı olmalı.`, { field: k });
    }
  }
  for (const k of rules.required) {
    const present = Object.prototype.hasOwnProperty.call(data, k);
    if (mode === 'patch' && !present) continue;
    if (typeof data[k] !== 'string' || !data[k].trim()) {
      throw new HttpError(400, 'required', `"${k}" alanı zorunlu.`, { field: k });
    }
  }
}

function checkSize(doc) {
  if (new TextEncoder().encode(JSON.stringify(doc)).byteLength > MAX_BODY_BYTES) {
    throw new HttpError(413, 'too_large', 'Belge 200 KB sınırını aşıyor.');
  }
}

// ------------------------------------------------------------------ hız sınırı
async function rateLimit(env, ctx, request, bucket) {
  const limit = Number(bucket === 'post' ? env.POST_LIMIT_PER_MIN ?? 10 : env.WRITE_LIMIT_PER_MIN ?? 60);
  if (!(limit > 0)) return;
  const ip = request.headers.get('cf-connecting-ip') || 'anon';
  const win = Math.floor(Date.now() / 60000);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, win, n) VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET
       n = CASE WHEN rate_limits.win = excluded.win THEN rate_limits.n + 1 ELSE 1 END,
       win = excluded.win
     RETURNING n`,
  )
    .bind(`${bucket}:${ip}`, win)
    .first();
  if (Math.random() < 0.02) {
    const cleanup = env.DB.prepare('DELETE FROM rate_limits WHERE win < ?').bind(win - 2).run().catch(() => {});
    if (ctx && ctx.waitUntil) ctx.waitUntil(cleanup);
  }
  if (row && row.n > limit) {
    const retry = 60 - Math.floor((Date.now() / 1000) % 60);
    throw new HttpError(429, 'rate_limited', 'Çok hızlısın: biraz bekle, sonra tekrar dene.', { retryAfter: retry });
  }
}

// ------------------------------------------------------------------ sorgu
function parseQuery(url) {
  const p = url.searchParams;
  const q = {};
  const where = p.get('where');
  if (where != null) {
    const i = where.indexOf(':');
    if (i <= 0) throw new HttpError(400, 'bad_where', 'where biçimi: alan:değer');
    const field = where.slice(0, i);
    if (!FIELD_RE.test(field)) throw new HttpError(400, 'bad_where', 'Geçersiz where alanı.');
    q.where = [field, where.slice(i + 1)];
  }
  const orderBy = p.get('orderBy');
  if (orderBy != null) {
    if (!ORDER_FIELDS.has(orderBy)) {
      throw new HttpError(400, 'bad_order_by', 'Bu alana göre sıralanamaz.', { allowed: [...ORDER_FIELDS] });
    }
    q.orderBy = orderBy;
  }
  const dir = p.get('dir');
  if (dir != null && dir !== 'asc' && dir !== 'desc') throw new HttpError(400, 'bad_dir', 'dir: asc | desc');
  q.dir = dir === 'desc' ? 'DESC' : 'ASC';
  const limit = p.get('limit');
  if (limit != null) {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'bad_limit', 'limit pozitif tam sayı olmalı.');
    q.limit = Math.min(n, MAX_LIMIT);
  } else q.limit = MAX_LIMIT;
  return q;
}

/** Eşitlik için aday değerler: URL'den gelen metin + (uygunsa) sayı/boolean karşılığı. */
function whereValues(v) {
  const out = [v];
  if (v !== '' && /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(v) && Number.isFinite(Number(v))) out.push(Number(v));
  else if (v === 'true') out.push(1);
  else if (v === 'false') out.push(0);
  return out;
}

const SELECT = 'SELECT col, id, data, author_id, author_pub FROM docs';

async function listDocs(env, col, q) {
  let sql = `${SELECT} WHERE col = ?`;
  const args = [col];
  if (q.where) {
    const [f, v] = q.where;
    if (f === 'id') {
      sql += ' AND id = ?';
      args.push(v);
    } else if (f === 'authorId') {
      sql += v.startsWith(PUB_PREFIX) ? ' AND author_pub = ?' : ' AND author_id = ?';
      args.push(v);
    } else {
      const expr = f === 'createdAt' ? 'created_at' : `json_extract(data, '$.${f}')`;
      const vals = whereValues(v);
      sql += vals.length > 1 ? ` AND ${expr} IN (${vals.map(() => '?').join(', ')})` : ` AND ${expr} = ?`;
      args.push(...vals);
    }
  }
  if (q.orderBy) {
    const f = q.orderBy;
    if (f === 'id') sql += ` ORDER BY id ${q.dir}`;
    else if (f === 'createdAt') sql += ` ORDER BY created_at ${q.dir}, id ASC`;
    else {
      const expr = `json_extract(data, '$.${f}')`;
      // store.js ile aynı: değeri olmayanlar her iki yönde de sona
      sql += ` ORDER BY (${expr} IS NULL), ${expr} ${q.dir}, id ASC`;
    }
  } else sql += ' ORDER BY id ASC';
  sql += ' LIMIT ?';
  args.push(q.limit);
  const res = await env.DB.prepare(sql).bind(...args).all();
  return res.results || [];
}

async function getRow(env, col, id) {
  if (col === 'fans' && id.startsWith(PUB_PREFIX)) {
    return env.DB.prepare(`${SELECT} WHERE col = ? AND author_pub = ? LIMIT 1`).bind(col, id).first();
  }
  return env.DB.prepare(`${SELECT} WHERE col = ? AND id = ?`).bind(col, id).first();
}

/** Satırı istemciye döner; başkalarının ham kimliklerini maskeler. */
function present(row, viewer, admin) {
  let data;
  try {
    data = JSON.parse(row.data);
  } catch {
    data = {};
  }
  const own = admin || (viewer && row.author_id === viewer);
  const out = { ...data, id: row.id };
  if (row.author_id) out.authorId = own ? row.author_id : row.author_pub;
  if (row.col === 'fans' && !own) out.id = row.author_pub;
  return out;
}

// ------------------------------------------------------------------ yazma
async function insertDoc(env, col, id, doc, now, author, pub) {
  await env.DB.prepare(
    'INSERT INTO docs (col, id, data, created_at, updated_at, author_id, author_pub) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(col, id, JSON.stringify(doc), now, now, author, pub)
    .run();
}

async function updateDoc(env, col, id, doc, now) {
  await env.DB.prepare('UPDATE docs SET data = ?, updated_at = ? WHERE col = ? AND id = ?')
    .bind(JSON.stringify(doc), now, col, id)
    .run();
}

function canModify(row, fan, admin) {
  return admin || (!!fan && row.author_id === fan);
}

// ------------------------------------------------------------------ yönlendirme
async function handleApi(request, env, ctx, url, cors) {
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method.toUpperCase();

  if (path === '/api/health') {
    if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'method_not_allowed');
    if (!env.DB) return json(503, { ok: false, error: 'no_db', message: 'D1 bağlaması (DB) yok.' }, cors);
    try {
      await env.DB.prepare('SELECT 1 FROM docs LIMIT 1').all();
    } catch {
      return json(503, { ok: false, error: 'schema', message: 'Şema uygulanmamış: schema.sql dosyasını çalıştırın.' }, cors);
    }
    return json(200, { ok: true, version: API_VERSION }, cors);
  }

  const m = /^\/api\/c\/([^/]+)(?:\/([^/]+))?$/.exec(path);
  if (!m) throw new HttpError(404, 'not_found', 'Böyle bir uç nokta yok.');
  let col, id;
  try {
    col = decodeURIComponent(m[1]);
    id = m[2] != null ? decodeURIComponent(m[2]) : null;
  } catch {
    throw new HttpError(400, 'bad_path');
  }
  if (!Object.prototype.hasOwnProperty.call(COLLECTIONS, col)) {
    throw new HttpError(404, 'unknown_collection', 'Bilinmeyen koleksiyon.');
  }
  if (id != null && !ID_RE.test(id)) throw new HttpError(400, 'bad_id', 'Geçersiz belge kimliği.');
  if (!env.DB) throw new HttpError(503, 'no_db', 'D1 bağlaması (DB) yok.');

  const fan = fanIdOf(request);
  const admin = isAdmin(request, env);
  const now = Date.now();

  // ---- okuma
  if (method === 'GET' || method === 'HEAD') {
    if (id == null) {
      const rows = await listDocs(env, col, parseQuery(url));
      return json(200, { docs: rows.map((r) => present(r, fan, admin)) }, cors);
    }
    const row = await getRow(env, col, id);
    if (!row) throw new HttpError(404, 'not_found', 'Belge bulunamadı.');
    return json(200, { doc: present(row, fan, admin) }, cors);
  }

  // ---- yazma
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) throw new HttpError(405, 'method_not_allowed');
  if (method === 'POST' && id != null) throw new HttpError(405, 'method_not_allowed', 'POST yalnızca /api/c/:col adresine.');
  if (method !== 'POST' && id == null) throw new HttpError(405, 'method_not_allowed', 'Belge kimliği gerekli.');
  if (!fan && !admin) throw new HttpError(401, 'fan_id_required', 'x-fan-id başlığı gerekli.');
  if (!admin) await rateLimit(env, ctx, request, method === 'POST' ? 'post' : 'write');

  if (method === 'DELETE') {
    const row = await getRow(env, col, id);
    if (!row) throw new HttpError(404, 'not_found', 'Belge bulunamadı.');
    if (!canModify(row, fan, admin)) throw new HttpError(403, 'forbidden', 'Yalnızca yazarı silebilir.');
    await env.DB.prepare('DELETE FROM docs WHERE col = ? AND id = ?').bind(col, row.id).run();
    return json(200, { ok: true, id: row.id }, cors);
  }

  const body = await readBody(request);

  if (method === 'POST') {
    if (col === 'fans') throw new HttpError(405, 'method_not_allowed', 'Fan belgeleri PUT /api/c/fans/:kimlik ile yazılır.');
    if (!fan) throw new HttpError(401, 'fan_id_required', 'x-fan-id başlığı gerekli.');
    validate(col, body, 'create');
    const doc = { ...body, authorId: fan, createdAt: now };
    checkSize(doc);
    const pub = await publicId(env, fan);
    let newId = newDocId();
    try {
      await insertDoc(env, col, newId, doc, now, fan, pub);
    } catch {
      newId = newDocId(); // olası çakışmada bir kez daha dene
      await insertDoc(env, col, newId, doc, now, fan, pub);
    }
    return json(201, { id: newId }, cors);
  }

  // PUT / PATCH
  if (col === 'fans' && !admin && id !== fan) {
    throw new HttpError(403, 'forbidden', 'Yalnızca kendi fan belgeni yazabilirsin.');
  }
  const row = await getRow(env, col, id);
  if (row && !canModify(row, fan, admin)) throw new HttpError(403, 'forbidden', 'Yalnızca yazarı değiştirebilir.');

  if (method === 'PATCH') {
    if (!row) throw new HttpError(404, 'not_found', 'Belge bulunamadı.');
    validate(col, body, 'patch');
    const old = JSON.parse(row.data || '{}');
    const doc = { ...old, ...body, authorId: old.authorId ?? row.author_id, createdAt: old.createdAt };
    if (col === 'fans') doc.updatedAt = now;
    checkSize(doc);
    await updateDoc(env, col, row.id, doc, now);
    return json(200, { ok: true, id: row.id }, cors);
  }

  // PUT: yoksa oluştur, varsa tamamen değiştir (yazar ve oluşturma zamanı korunur)
  validate(col, body, 'create');
  if (row) {
    const old = JSON.parse(row.data || '{}');
    const doc = { ...body, authorId: old.authorId ?? row.author_id, createdAt: old.createdAt ?? now };
    if (col === 'fans') doc.updatedAt = now;
    checkSize(doc);
    await updateDoc(env, col, row.id, doc, now);
    return json(200, { ok: true, id: row.id }, cors);
  }
  if (!fan) throw new HttpError(400, 'fan_id_required', 'Yeni belge için x-fan-id gerekli.');
  if (id.startsWith(PUB_PREFIX)) throw new HttpError(400, 'bad_id', 'Bu kimlik öneki ayrılmış.');
  const doc = { ...body, authorId: fan, createdAt: now };
  if (col === 'fans') doc.updatedAt = now;
  checkSize(doc);
  await insertDoc(env, col, id, doc, now, fan, await publicId(env, fan));
  return json(201, { ok: true, id }, cors);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const cors = corsHeaders(request, env);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      try {
        return await handleApi(request, env, ctx, url, cors);
      } catch (err) {
        if (err instanceof HttpError) {
          const extra = err.extra && err.extra.retryAfter ? { 'retry-after': String(err.extra.retryAfter) } : {};
          return json(err.status, { error: err.code, message: err.message, ...(err.extra || {}) }, cors, extra);
        }
        console.error('api error', err && err.stack ? err.stack : err);
        return json(500, { error: 'internal', message: 'Sunucu hatası.' }, cors);
      }
    }
    // /api dışı: aynı Worker siteyi de sunuyorsa (wrangler.toml [assets]) varlıklara düş
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') return env.ASSETS.fetch(request);
    return new Response('Bulunamadı', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};
