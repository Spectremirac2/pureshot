// 3D sikke halkası için kahraman portresi atlası: 127 ayrı istek yerine tek WebP.
//   src/assets/heroes/portraits/<id>.webp (256×144)
//     → src/assets/heroes/atlas/portraits.webp   her portrenin ortadan kare kırpımı, CELL×CELL hücreler
//     → src/assets/heroes/atlas/portraits.json   { cell, cols, rows, ids } (sıra: src/data/heroes.js HEROES)
//
// Sikkede portre iç madalyona 16:9 görselin ortasından kırpılarak çizilir; atlas hücresi tam o kareyi taşır
// (bkz. src/sections/heroes/crest.js → loadPortraits / drawCrestCanvas). Portresi olmayan kahraman atlasta
// yer almaz; halka onu prosedürel armayla çizer.
//
// Kullanım: npm run build:atlas   (portreler değiştiğinde ya da kahraman eklendiğinde yeniden çalıştırın)

import { existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import sharp from 'sharp';
import { HEROES } from '../src/data/heroes.js';

const SRC = new URL('../src/assets/heroes/portraits/', import.meta.url);
const OUT = new URL('../src/assets/heroes/atlas/', import.meta.url);
const CELL = 80; // sikke dokusunda iç madalyon ~82 px (128 px hücrede); daha büyük hücre görünür fark yaratmaz
const COLS = 16;
const QUALITY = 72;
const BG = { r: 13, g: 11, b: 20 }; // #0d0b14 — madalyon zemini

const ids = [];
const tiles = [];
for (const hero of HEROES) {
  const file = new URL(`${hero.id}.webp`, SRC);
  if (!existsSync(file)) {
    console.warn(`portre yok, atlanıyor: ${hero.id}`);
    continue;
  }
  const img = sharp(file.pathname);
  const { width, height } = await img.metadata();
  const side = Math.min(width, height);
  const buf = await img
    .extract({ left: Math.round((width - side) / 2), top: Math.round((height - side) / 2), width: side, height: side })
    .resize(CELL, CELL, { kernel: 'lanczos3' })
    .flatten({ background: BG })
    .toBuffer();
  const i = ids.length;
  ids.push(hero.id);
  tiles.push({ input: buf, left: (i % COLS) * CELL, top: Math.floor(i / COLS) * CELL });
}

const rows = Math.ceil(ids.length / COLS);
mkdirSync(OUT, { recursive: true });
const webp = new URL('portraits.webp', OUT);
await sharp({ create: { width: COLS * CELL, height: rows * CELL, channels: 3, background: BG } })
  .composite(tiles)
  .webp({ quality: QUALITY, effort: 6, smartSubsample: true })
  .toFile(webp.pathname);
writeFileSync(new URL('portraits.json', OUT), JSON.stringify({ cell: CELL, cols: COLS, rows, ids }) + '\n');
console.log(`atlas: ${ids.length} portre, ${COLS * CELL}×${rows * CELL} px, ${(statSync(webp).size / 1024).toFixed(0)} KB → src/assets/heroes/atlas/`);
