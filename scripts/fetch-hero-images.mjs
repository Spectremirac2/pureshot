// Kahraman görsellerini (Valve'ın resmi Dota 2 CDN'i) indirip WebP'ye çevirir.
//   portre (256x144, yatay)       → src/assets/heroes/portraits/<id>.webp  (kartlar, madalyonlar, 3D sikkeler)
//   tam boy render (şeffaf zemin) → src/assets/heroes/renders/<id>.webp    (kahraman dosyası)
// CDN yalnızca dota2.com'a CORS izni verdiği için görseller siteye gömülür (WebGL dokuları da çalışsın).
//
// Kullanım: NODE_USE_ENV_PROXY=1 node scripts/fetch-hero-images.mjs [--force] [id ...]

import { mkdir, access } from 'node:fs/promises';
import sharp from 'sharp';
import { HEROES } from '../src/data/heroes.js';

const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2';
const OUT = new URL('../src/assets/heroes/', import.meta.url);
const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));
const list = only.length ? HEROES.filter((x) => only.includes(x.id)) : HEROES;

const exists = (u) => access(u).then(() => true, () => false);

async function get(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (i === 3) throw e;
      await new Promise((res) => setTimeout(res, 1000 * 2 ** i));
    }
  }
}

async function portrait(id) {
  const out = new URL(`portraits/${id}.webp`, OUT);
  if (!force && await exists(out)) return 'var';
  const buf = await get(`${CDN}/images/dota_react/heroes/${id}.png`);
  if (!buf) return 'yok';
  await sharp(buf).resize(256, 144, { fit: 'cover' }).webp({ quality: 82 }).toFile(out.pathname);
  return 'ok';
}

async function render(id) {
  const out = new URL(`renders/${id}.webp`, OUT);
  if (!force && await exists(out)) return 'var';
  const buf = await get(`${CDN}/videos/dota_react/heroes/renders/${id}.png`);
  if (!buf) return 'yok';
  // Şeffaf kenarları kırp, 600 px yüksekliğe (en çok 560 px genişliğe) indir
  const trimmed = await sharp(buf).trim({ threshold: 4 }).toBuffer();
  await sharp(trimmed)
    .resize({ width: 560, height: 600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 76, alphaQuality: 80, effort: 6 })
    .toFile(out.pathname);
  return 'ok';
}

await mkdir(new URL('portraits/', OUT), { recursive: true });
await mkdir(new URL('renders/', OUT), { recursive: true });

const missing = [];
let done = 0;
const queue = list.slice();
async function worker() {
  while (queue.length) {
    const hero = queue.shift();
    const [p, r] = await Promise.all([portrait(hero.id), render(hero.id)]);
    if (p === 'yok') missing.push(`${hero.id} (portre)`);
    if (r === 'yok') missing.push(`${hero.id} (render)`);
    done++;
    if (done % 20 === 0 || done === list.length) console.log(`${done}/${list.length}`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log(missing.length ? 'Eksik: ' + missing.join(', ') : 'Tüm görseller hazır.');
