-- DOG DOG DOG Üssü — D1 şeması.
-- Uygulama:
--   npx wrangler d1 execute dogdogdog --remote --file schema.sql   (canlı veritabanı)
--   npx wrangler d1 execute dogdogdog --local  --file schema.sql   (wrangler dev için yerel kopya)
-- Tekrar çalıştırmak güvenlidir (IF NOT EXISTS).

-- Tüm koleksiyonlar tek tabloda: (koleksiyon, kimlik) → JSON belge.
--   data        belge alanları (JSON metni; id hariç, authorId ve createdAt dahil)
--   created_at  sunucunun koyduğu oluşturma zamanı (ms)
--   updated_at  son yazma zamanı (ms)
--   author_id   yazarın ham ziyaretçi kimliği (x-fan-id); yalnızca sahibine gösterilir
--   author_pub  yazarın HMAC ile türetilmiş genel kimliği (p_...); başkalarına bu gösterilir
CREATE TABLE IF NOT EXISTS docs (
  col        TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  data       TEXT    NOT NULL CHECK (json_valid(data)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  author_id  TEXT,
  author_pub TEXT,
  PRIMARY KEY (col, id)
);

-- Sık kullanılan sorgular için indeksler.
-- (İfade indekslerinin kullanılabilmesi için worker.js aynı json_extract ifadesini üretir.)
CREATE INDEX IF NOT EXISTS docs_col_created ON docs (col, created_at);
CREATE INDEX IF NOT EXISTS docs_col_author  ON docs (col, author_id);
CREATE INDEX IF NOT EXISTS docs_col_pub     ON docs (col, author_pub);
CREATE INDEX IF NOT EXISTS docs_thread      ON docs (col, json_extract(data, '$.thread'), created_at);
CREATE INDEX IF NOT EXISTS docs_qid         ON docs (col, json_extract(data, '$.qid'), created_at);
CREATE INDEX IF NOT EXISTS docs_cat         ON docs (col, json_extract(data, '$.cat'), created_at);

-- Yazma hız sınırı sayaçları: anahtar = "<kova>:<ip>", win = dakika numarası.
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT    PRIMARY KEY,
  win INTEGER NOT NULL,
  n   INTEGER NOT NULL
);
