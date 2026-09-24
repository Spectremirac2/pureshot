// Node'un yerleşik SQLite'ı (node:sqlite, Node ≥ 22.13) üzerinde Cloudflare D1 arayüzünün
// küçük bir taklidi. Yalnızca yerel geliştirme (local/dev.mjs) ve testler (test/) içindir;
// Worker'a paketlenmez.
//
//   const db = openD1(':memory:');            // ya da dosya yolu
//   await db.prepare('SELECT ?').bind(1).first();
//   await db.prepare(sql).bind(...).all()   → { results, success, meta }
//   await db.prepare(sql).bind(...).run()   → { success, meta: { changes, last_row_id } }

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { DatabaseSync } = await import('node:sqlite').catch(() => {
  throw new Error('node:sqlite bulunamadı: Node 22.13 veya üstü gerekli.');
});

const plain = (row) => (row ? { ...row } : null);

class Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...values) {
    for (const v of values) {
      if (v === undefined) throw new TypeError('D1_TYPE_ERROR: undefined bağlanamaz');
    }
    return new Statement(this.db, this.sql, values.map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v)));
  }
  _stmt() {
    return this.db.prepare(this.sql);
  }
  async first(column) {
    const row = plain(this._stmt().get(...this.params));
    if (column != null) return row ? row[column] ?? null : null;
    return row;
  }
  async all() {
    const t = performance.now();
    const results = this._stmt().all(...this.params).map(plain);
    return { results, success: true, meta: { duration: performance.now() - t, rows_read: results.length } };
  }
  async raw() {
    const s = this._stmt();
    s.setReturnArrays?.(true);
    return s.all(...this.params);
  }
  async run() {
    const t = performance.now();
    const s = this._stmt();
    // RETURNING içeren ifadelerde satırları da topla (D1 davranışı)
    if (/\breturning\b/i.test(this.sql)) {
      const results = s.all(...this.params).map(plain);
      return { results, success: true, meta: { duration: performance.now() - t, changes: results.length } };
    }
    const r = s.run(...this.params);
    return {
      results: [],
      success: true,
      meta: { duration: performance.now() - t, changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) },
    };
  }
}

export function openD1(path = ':memory:', { schema = true } = {}) {
  const db = new DatabaseSync(path);
  if (schema) {
    const sql = readFileSync(fileURLToPath(new URL('../schema.sql', import.meta.url)), 'utf8');
    db.exec(sql);
  }
  return {
    _db: db,
    prepare(sql) {
      return new Statement(db, sql);
    },
    async batch(stmts) {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    async exec(sql) {
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
    close() {
      db.close();
    },
  };
}
