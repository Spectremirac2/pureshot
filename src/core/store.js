// Birleşik veri katmanı.
//
// Koleksiyonlar (belge kimliği → düz JSON):
//   jokes      topluluk esprileri      { text, cat, nick, authorId, createdAt }
//   comments   yorumlar (her konu)     { thread, text, nick, authorId, createdAt }
//   questions  soru-cevap soruları     { title, body, nick, authorId, createdAt, acceptedId? }
//   answers    cevaplar                { qid, text, nick, authorId, createdAt }
//   fans       her ziyaretçinin kendi genel profili, belge kimliği = ziyaretçi kimliği
//              { nick, dog, likes:{[itemId]:1}, scores:{[gameId]:n}, picks:{[key]:value}, updatedAt }
//
// Arka uçlar (otomatik seçilir):
//   'db'    claude.ai Artifact paylaşılan veritabanı (herkes aynı veriyi görür)
//   'api'   server/ altındaki Cloudflare Worker (bağımsız yayında paylaşılan veri)
//   'local' tarayıcı localStorage (yalnızca bu cihaz)
//
// Sorgu biçimi (tüm arka uçlarda aynı): { where?: [alan, değer] (yalnızca eşitlik), orderBy?: alan, dir?: 'asc'|'desc', limit?: n }

import { platform } from './platform.js';
import { ls, uid as makeId, pick, randInt } from './dom.js';
import { history } from './history.js';

const MAX_DOC_BYTES = 200 * 1024;
const LOCAL_ID_KEY = 'local-fan-id';

// ---------------------------------------------------------------- yardımcılar
function sortAndLimit(docs, q = {}) {
  let out = docs;
  if (q.where) {
    const [f, v] = q.where;
    out = out.filter((d) => d[f] === v);
  }
  if (q.orderBy) {
    const f = q.orderBy;
    const dir = q.dir === 'desc' ? -1 : 1;
    out = out.slice().sort((a, b) => {
      const av = a[f], bv = b[f];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  } else {
    out = out.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  }
  if (q.limit) out = out.slice(0, q.limit);
  return out;
}

function sizeOk(data) {
  try {
    return new Blob([JSON.stringify(data)]).size <= MAX_DOC_BYTES;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- local
class LocalBackend {
  constructor() {
    this.mode = 'local';
    this.shared = false;
    this.bus = new EventTarget();
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('csk:db:')) this.bus.dispatchEvent(new CustomEvent(e.key.slice(7)));
    });
  }
  _read(col) { return ls.get('db:' + col, {}) || {}; }
  _write(col, map) {
    ls.set('db:' + col, map);
    this.bus.dispatchEvent(new CustomEvent(col));
  }
  subscribe(col, q, cb) {
    const emit = () => {
      const map = this._read(col);
      cb(sortAndLimit(Object.entries(map).map(([id, d]) => ({ ...d, id })), q));
    };
    this.bus.addEventListener(col, emit);
    queueMicrotask(emit);
    return () => this.bus.removeEventListener(col, emit);
  }
  async get(col, id) {
    const d = this._read(col)[id];
    return d ? { ...d, id } : null;
  }
  async add(col, data) {
    const id = makeId();
    await this.set(col, id, data);
    return id;
  }
  async set(col, id, data) {
    const map = this._read(col);
    map[id] = data;
    this._write(col, map);
  }
  async update(col, id, patch) {
    const map = this._read(col);
    map[id] = { ...(map[id] || {}), ...patch };
    this._write(col, map);
  }
  async remove(col, id) {
    const map = this._read(col);
    delete map[id];
    this._write(col, map);
  }
}

// ---------------------------------------------------------------- claude.ai db
class DbBackend {
  constructor(db) {
    this.mode = 'db';
    this.shared = true;
    this.db = db;
  }
  _query(col, q = {}) {
    let ref = this.db.collection(col);
    if (q.where) ref = ref.where(q.where[0], '==', q.where[1]);
    if (q.orderBy) ref = ref.orderBy(q.orderBy, q.dir || 'asc');
    if (q.limit) ref = ref.limit(q.limit);
    return ref;
  }
  subscribe(col, q, cb, onError) {
    return this._query(col, q).onSnapshot(
      (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      (err) => onError && onError(err),
    );
  }
  async get(col, id) {
    const s = await this.db.collection(col).doc(id).get();
    return s.exists ? { ...s.data(), id: s.id } : null;
  }
  async add(col, data) {
    const ref = this.db.collection(col).doc();
    await ref.set(data);
    return ref.id;
  }
  set(col, id, data) { return this.db.collection(col).doc(id).set(data); }
  update(col, id, patch) { return this.db.collection(col).doc(id).update(patch); }
  remove(col, id) { return this.db.collection(col).doc(id).delete(); }
}

// ---------------------------------------------------------------- REST API (server/worker.js)
class ApiBackend {
  constructor(base, fanId) {
    this.mode = 'api';
    this.shared = true;
    this.base = base.replace(/\/$/, '');
    this.fanId = fanId;
    this.subs = new Set();
    this.timer = setInterval(() => this._pollAll(), 10000);
  }
  _headers() { return { 'content-type': 'application/json', 'x-fan-id': this.fanId }; }
  _url(col, q = {}) {
    const p = new URLSearchParams();
    if (q.where) p.set('where', `${q.where[0]}:${q.where[1]}`);
    if (q.orderBy) p.set('orderBy', q.orderBy);
    if (q.dir) p.set('dir', q.dir);
    if (q.limit) p.set('limit', String(q.limit));
    const qs = p.toString();
    return `${this.base}/c/${encodeURIComponent(col)}${qs ? '?' + qs : ''}`;
  }
  async _fetchList(col, q) {
    const r = await fetch(this._url(col, q), { headers: this._headers() });
    if (!r.ok) throw new Error('api ' + r.status);
    const j = await r.json();
    return j.docs || [];
  }
  _pollAll() {
    for (const s of this.subs) this._pollOne(s);
  }
  async _pollOne(s) {
    try {
      const docs = await this._fetchList(s.col, s.q);
      if (s.alive) s.cb(docs);
    } catch (e) {
      if (s.alive && s.onError) s.onError(e);
    }
  }
  _refresh(col) {
    for (const s of this.subs) if (s.col === col) this._pollOne(s);
  }
  subscribe(col, q, cb, onError) {
    const s = { col, q, cb, onError, alive: true };
    this.subs.add(s);
    this._pollOne(s);
    return () => { s.alive = false; this.subs.delete(s); };
  }
  async get(col, id) {
    const r = await fetch(`${this.base}/c/${encodeURIComponent(col)}/${encodeURIComponent(id)}`, { headers: this._headers() });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('api ' + r.status);
    return (await r.json()).doc || null;
  }
  async add(col, data) {
    const r = await fetch(`${this.base}/c/${encodeURIComponent(col)}`, { method: 'POST', headers: this._headers(), body: JSON.stringify(data) });
    if (!r.ok) throw new Error('api ' + r.status);
    const { id } = await r.json();
    this._refresh(col);
    return id;
  }
  async _send(method, col, id, data) {
    const r = await fetch(`${this.base}/c/${encodeURIComponent(col)}/${encodeURIComponent(id)}`, {
      method, headers: this._headers(), body: data ? JSON.stringify(data) : undefined,
    });
    if (!r.ok) throw new Error('api ' + r.status);
    this._refresh(col);
  }
  set(col, id, data) { return this._send('PUT', col, id, data); }
  update(col, id, patch) { return this._send('PATCH', col, id, patch); }
  remove(col, id) { return this._send('DELETE', col, id); }
}

async function detectApi() {
  if (platform.inArtifact) return null;
  if (!/^https?:$/.test(location.protocol)) return null;
  const base = (import.meta.env && import.meta.env.VITE_API_BASE) || window.__CSK_API__ || '/api';
  if (base === 'none') return null; // statik yayın (ör. GitHub Pages): sunucu yok, veriler tarayıcıda
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch(base.replace(/\/$/, '') + '/health', { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return j && j.ok ? base : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- takma adlar
const NICK_A = ['Kayıp', 'Uykusuz', 'Wardsız', 'Farmcı', 'Pauselı', 'Tilt', 'Efsane', 'Gizli', 'Buybacksiz', 'Rapierli', 'Tangocu', 'Smoke', 'Rampage', 'Dayı', 'Sabahçı'];
const NICK_B = ['Kurye', 'Destek', 'Carry', 'Offlaner', 'Jungler', 'Midci', 'Roamer', 'Ward', 'Creep', 'Roshan', 'Tango', 'Bottle', 'Aegis', 'Köpek', 'İzleyici'];
export function randomNick() {
  return `${pick(NICK_A)} ${pick(NICK_B)} ${randInt(10, 99)}`;
}

// ---------------------------------------------------------------- store
let backend = null;
let readyResolve;
const readyPromise = new Promise((r) => (readyResolve = r));

const subs = new Map(); // anahtar → { col, q, cbs:Set, errs:Set, docs, unsub }

function attach(entry) {
  entry.unsub = backend.subscribe(
    entry.col,
    entry.q,
    (docs) => {
      entry.docs = docs;
      for (const cb of entry.cbs) {
        try { cb(docs); } catch (e) { console.error(e); }
      }
    },
    (err) => {
      for (const eh of entry.errs) {
        try { eh(err); } catch { /* yok say */ }
      }
    },
  );
}

// Ziyaretçinin kendi fan belgesi
const meState = {
  id: null,
  data: ls.get('me', null) || { nick: randomNick(), dog: 0, likes: {}, scores: {}, picks: {} },
  cbs: new Set(),
  dirty: false,
  writing: false,
  timer: 0,
};
if (!meState.data.likes) meState.data.likes = {};
if (!meState.data.scores) meState.data.scores = {};
if (!meState.data.picks) meState.data.picks = {};

function emitMe() {
  ls.set('me', meState.data);
  for (const cb of meState.cbs) {
    try { cb(meState.data); } catch (e) { console.error(e); }
  }
}

async function flushMe() {
  meState.timer = 0;
  if (!meState.dirty || !backend || !meState.id) return;
  // Salt okunur ziyaretçi: profil yalnızca bu cihazda (localStorage) kalır, sunucuya yazma denenmez
  if (backend.shared && platform.canWrite === false) { meState.dirty = false; return; }
  if (meState.writing) {
    meState.timer = setTimeout(flushMe, 600);
    return;
  }
  meState.dirty = false;
  meState.writing = true;
  const body = { ...meState.data, updatedAt: Date.now() };
  try {
    if (sizeOk(body)) await backend.set('fans', meState.id, body);
  } catch (e) {
    console.warn('fan belgesi yazılamadı', e);
  } finally {
    meState.writing = false;
  }
}

function scheduleMeWrite(delay = 1200) {
  meState.dirty = true;
  if (!meState.timer) meState.timer = setTimeout(flushMe, delay);
}

export const store = {
  /** 'db' | 'api' | 'local' (hazır olana kadar null) */
  get mode() { return backend ? backend.mode : null; },
  /** Veriler diğer ziyaretçilerle paylaşılıyor mu? */
  get shared() { return backend ? backend.shared : false; },
  ready: readyPromise,
  /** Ziyaretçinin kimliği (fans/<id>). */
  uid() { return meState.id; },
  /** Bu ziyaretçi paylaşılan veriye yazabilir mi? (false ise giriş alanlarını salt okunur yapın) */
  canWrite() { return platform.canWrite !== false; },
  /** Başkalarının içeriğini silebilir mi (sahip/editör)? */
  isModerator() { return platform.isOwner || platform.canEdit || (backend && backend.mode === 'local'); },

  /**
   * Koleksiyona abone ol. Aynı (koleksiyon, sorgu) için tek alt abonelik paylaşılır.
   * cb(docs) — docs: [{ id, ...alanlar }]. Döndürülen fonksiyon aboneliği bırakır.
   */
  subscribe(col, q, cb, onError) {
    const key = JSON.stringify([col, q || {}]);
    let entry = subs.get(key);
    if (!entry) {
      entry = { col, q: q || {}, cbs: new Set(), errs: new Set(), docs: null, unsub: null };
      subs.set(key, entry);
      if (backend) attach(entry);
    } else if (entry.docs) {
      queueMicrotask(() => entry.cbs.has(cb) && cb(entry.docs));
    }
    entry.cbs.add(cb);
    if (onError) entry.errs.add(onError);
    return () => {
      entry.cbs.delete(cb);
      if (onError) entry.errs.delete(onError);
      if (entry.cbs.size === 0) {
        if (entry.unsub) entry.unsub();
        subs.delete(key);
      }
    };
  },

  async get(col, id) {
    await readyPromise;
    return backend.get(col, id);
  },

  /** Yeni belge ekler; createdAt, authorId ve nick (yoksa) otomatik eklenir. Kimlik döndürür. */
  async add(col, data) {
    await readyPromise;
    const body = { nick: meState.data.nick, ...data, authorId: meState.id || 'anon', createdAt: Date.now() };
    if (!sizeOk(body)) throw Object.assign(new Error('Belge çok büyük'), { code: 'too_large' });
    return backend.add(col, body);
  },
  async set(col, id, data) {
    await readyPromise;
    if (!sizeOk(data)) throw Object.assign(new Error('Belge çok büyük'), { code: 'too_large' });
    return backend.set(col, id, data);
  },
  async update(col, id, patch) {
    await readyPromise;
    return backend.update(col, id, patch);
  },
  async remove(col, id) {
    await readyPromise;
    return backend.remove(col, id);
  },

  /** Ziyaretçinin kendi profili. */
  me: {
    get() { return meState.data; },
    /**
     * Profili güncelle. Nesne (sığ birleştirme) ya da taslağı değiştiren fonksiyon alır:
     *   store.me.patch({ nick: 'x' })
     *   store.me.patch((d) => { d.likes[id] = 1; })
     * Yazma işlemleri toplanıp geciktirilerek tek seferde gönderilir.
     */
    patch(fnOrObj, { delay } = {}) {
      if (typeof fnOrObj === 'function') fnOrObj(meState.data);
      else Object.assign(meState.data, fnOrObj);
      emitMe();
      scheduleMeWrite(delay);
    },
    subscribe(cb) {
      meState.cbs.add(cb);
      queueMicrotask(() => meState.cbs.has(cb) && cb(meState.data));
      return () => meState.cbs.delete(cb);
    },
    /** Beğeni aç/kapa; yeni durumu döndürür. */
    toggleLike(itemId) {
      let on = false;
      this.patch((d) => {
        if (d.likes[itemId]) delete d.likes[itemId];
        else { d.likes[itemId] = 1; on = true; }
      });
      return on;
    },
    /** En iyi skoru kaydet (higherIsBetter=false ise düşük skor daha iyi, ör. reaksiyon süresi). */
    submitScore(gameId, score, higherIsBetter = true) {
      history.record(gameId, score);
      const prev = meState.data.scores[gameId];
      const better = prev == null || (higherIsBetter ? score > prev : score < prev);
      if (better) this.patch((d) => { d.scores[gameId] = score; }, { delay: 300 });
      return better;
    },
  },

  /** Tüm fan belgelerine abone ol (toplam DOG sayısı, beğeni sayıları, liderlik tabloları için). */
  fans(cb) {
    // Kendi belgemizin en güncel yerel halini kullan (yazma gecikmesini gizler) ve
    // kendi profilimiz değişince (beğeni, oy, skor) sunucu yanıtını beklemeden yeniden yayınla.
    let last = null;
    let raf = 0;
    const emit = () => {
      raf = 0;
      if (!last) return;
      const id = meState.id;
      const merged = last.filter((d) => d.id !== id);
      merged.push({ ...meState.data, id: id || 'me' });
      cb(merged);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(emit); };
    const unsub = store.subscribe('fans', { limit: 1000 }, (docs) => { last = docs; if (raf) { cancelAnimationFrame(raf); raf = 0; } emit(); });
    meState.cbs.add(schedule);
    return () => {
      unsub();
      meState.cbs.delete(schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  },
};

// ---------------------------------------------------------------- toplulaştırma yardımcıları
export const agg = {
  totalDog(fans) { return fans.reduce((s, f) => s + (Number(f.dog) || 0), 0); },
  likeCount(fans, itemId) { return fans.reduce((s, f) => s + (f.likes && f.likes[itemId] ? 1 : 0), 0); },
  likeCounts(fans) {
    const m = {};
    for (const f of fans) for (const k in f.likes || {}) m[k] = (m[k] || 0) + 1;
    return m;
  },
  /** [{ id, nick, score }] en iyiden kötüye */
  leaderboard(fans, gameId, n = 10, higherIsBetter = true) {
    return fans
      .filter((f) => f.scores && typeof f.scores[gameId] === 'number')
      .map((f) => ({ id: f.id, nick: f.nick || 'Anonim', score: f.scores[gameId] }))
      .sort((a, b) => (higherIsBetter ? b.score - a.score : a.score - b.score))
      .slice(0, n);
  },
  /** picks[key] değerlerinin dağılımı: { değer: adet } */
  distribution(fans, key) {
    const m = {};
    for (const f of fans) {
      const v = f.picks && f.picks[key];
      if (v != null) m[v] = (m[v] || 0) + 1;
    }
    return m;
  },
};

// ---------------------------------------------------------------- başlatma
(async () => {
  await platform.ready;
  if (platform.db) {
    backend = new DbBackend(platform.db);
    meState.id = platform.uid; // null ise profil yalnızca yerelde kalır
  } else {
    let localId = ls.get(LOCAL_ID_KEY, null);
    if (!localId) {
      localId = 'f' + makeId();
      ls.set(LOCAL_ID_KEY, localId);
    }
    const base = await detectApi();
    backend = base ? new ApiBackend(base, localId) : new LocalBackend();
    meState.id = localId;
  }
  // Paylaşılan arka uçta kendi belgemizi getirip yerel önbellekle birleştir
  if (meState.id && backend.shared) {
    try {
      const remote = await backend.get('fans', meState.id);
      if (remote) {
        const local = meState.data;
        const merged = {
          ...remote,
          nick: remote.nick || local.nick,
          dog: Math.max(Number(remote.dog) || 0, Number(local.dog) || 0),
          likes: { ...(remote.likes || {}), ...(local.likes || {}) },
          scores: { ...(remote.scores || {}) },
          picks: { ...(remote.picks || {}), ...(local.picks || {}) },
        };
        for (const [k, v] of Object.entries(local.scores || {})) {
          if (merged.scores[k] == null) merged.scores[k] = v;
        }
        delete merged.id;
        meState.data = merged;
        emitMe();
      } else {
        scheduleMeWrite(200);
      }
    } catch { /* ağ hatası: yerel veriyle devam */ }
  }
  // Arka uç atandıktan sonra açılan abonelikler zaten bağlandı; yalnızca bekleyenleri bağla
  for (const entry of subs.values()) if (!entry.unsub) attach(entry);
  readyResolve(store);
})();

window.addEventListener('pagehide', () => { if (meState.dirty) flushMe(); });
