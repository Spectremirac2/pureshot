// Test yardımcısı: claude.ai Artifact çalışma zamanını taklit eder (bellek içi `db` + `user`).
// Playwright: await page.addInitScript({ path: 'scripts/fake-claude.js' })
// Seçenekler (addInitScript'ten ÖNCE ayrı bir init betiğiyle):
//   window.__FAKE_CLAUDE_OPTS__ = { uid: 'u_test', canWrite: true, owner: true, seed: { comments: { id1: {...} } } }
(() => {
  const opts = window.__FAKE_CLAUDE_OPTS__ || {};
  const uid = opts.uid || 'u_fake_viewer_000000001';
  const store = new Map(); // "col" -> Map(id -> data)
  const listeners = new Set();
  const colMap = (col) => { if (!store.has(col)) store.set(col, new Map()); return store.get(col); };
  if (opts.seed) for (const [col, docs] of Object.entries(opts.seed)) for (const [id, d] of Object.entries(docs)) colMap(col).set(id, d);
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const notify = () => { for (const l of listeners) queueMicrotask(l); };
  const err = (code, message) => Object.assign(new Error(message), { code });
  const snapDoc = (id, data) => ({ id, exists: data != null, data: () => (data == null ? undefined : clone(data)), metadata: { fromCache: false, hasPendingWrites: false } });
  const canWrite = opts.canWrite !== false;

  function makeQuery(col, filters = [], order = null, lim = null) {
    const run = () => {
      let docs = [...colMap(col).entries()].map(([id, d]) => ({ id, d }));
      for (const [f, op, v] of filters) {
        docs = docs.filter(({ d }) => {
          const x = d[f];
          switch (op) {
            case '==': return x === v;
            case '!=': return x !== v;
            case '<': return x < v;
            case '<=': return x <= v;
            case '>': return x > v;
            case '>=': return x >= v;
            case 'in': return v.includes(x);
            case 'not-in': return !v.includes(x);
            case 'array-contains': return Array.isArray(x) && x.includes(v);
            default: throw err('invalid_argument', 'bad op ' + op);
          }
        });
      }
      if (order) {
        const [f, dir] = order;
        docs.sort((a, b) => {
          const av = a.d[f], bv = b.d[f];
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return (av < bv ? -1 : av > bv ? 1 : 0) * (dir === 'desc' ? -1 : 1);
        });
      } else docs.sort((a, b) => (a.id < b.id ? -1 : 1));
      if (lim) docs = docs.slice(0, lim);
      const out = docs.map(({ id, d }) => snapDoc(id, d));
      return { docs: out, size: out.length, empty: !out.length, docChanges: () => out.map((doc, i) => ({ type: 'added', doc, oldIndex: -1, newIndex: i })), metadata: { fromCache: false, hasPendingWrites: false } };
    };
    return {
      where: (f, op, v) => makeQuery(col, [...filters, [f, op, v]], order, lim),
      orderBy: (f, dir = 'asc') => makeQuery(col, filters, [f, dir], lim),
      limit: (n) => makeQuery(col, filters, order, n),
      get: async () => run(),
      onSnapshot(next) {
        const fire = () => { try { next(run()); } catch (e) { console.error(e); } };
        listeners.add(fire);
        queueMicrotask(fire);
        return () => listeners.delete(fire);
      },
    };
  }

  function docRef(col, id) {
    return {
      id,
      path: col + '/' + id,
      async get() { return snapDoc(id, colMap(col).get(id)); },
      async set(data) {
        if (!canWrite && !(col === 'fans' && id === uid)) throw err('invalid_argument', 'write refused');
        if (col === 'fans' && id !== uid && !opts.owner) throw err('invalid_argument', 'not your subtree');
        if (JSON.stringify(data).length > 256 * 1024) throw err('invalid_argument', 'too large');
        colMap(col).set(id, clone(data)); notify();
      },
      async update(patch) {
        if (!colMap(col).has(id)) throw err('invalid_argument', 'missing doc');
        if (!canWrite) throw err('invalid_argument', 'write refused');
        colMap(col).set(id, { ...colMap(col).get(id), ...clone(patch) }); notify();
      },
      async delete() { if (!canWrite) throw err('invalid_argument', 'write refused'); colMap(col).delete(id); notify(); },
      onSnapshot(next) {
        const fire = () => next(snapDoc(id, colMap(col).get(id)));
        listeners.add(fire); queueMicrotask(fire);
        return () => listeners.delete(fire);
      },
      collection: (sub) => collection(col + '/' + id + '/' + sub),
    };
  }

  function collection(col) {
    const q = makeQuery(col);
    return Object.assign(q, {
      path: col,
      doc: (id) => docRef(col, id || ('d' + Math.random().toString(36).slice(2, 12))),
      async add(data) { const ref = docRef(col, 'd' + Math.random().toString(36).slice(2, 12)); await ref.set(data); return ref; },
    });
  }

  const db = Object.freeze({
    collection,
    doc(path) { const parts = path.split('/'); const id = parts.pop(); return docRef(parts.join('/'), id); },
  });
  const user = Object.freeze({
    isOwner: async () => !!opts.owner,
    canEdit: async () => !!opts.owner,
    can: async (name) => (name === 'data.write' ? canWrite : false),
    id: async () => uid,
    me: async () => ({ id: uid, name: '', avatarUrl: '', color: '#888', email: null, isOwner: !!opts.owner, canEdit: !!opts.owner }),
    profiles: async (ids) => Object.fromEntries([].concat(ids).map((i) => [i, { id: i, name: '', avatarUrl: '', color: '#888', email: null, isMe: i === uid, guest: false }])),
  });
  window.__fakeDb = { store, dump: () => Object.fromEntries([...store].map(([c, m]) => [c, Object.fromEntries(m)])) };
  window.claude = { use: async (name) => (name === 'db' ? db : name === 'user' ? user : null) };
})();
