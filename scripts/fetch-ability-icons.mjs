// Yetenek ikonlarını (Valve'ın resmi Dota 2 CDN'i) indirip küçük WebP'ye çevirir.
//   src/assets/abilities/<kahraman>/<yetenek>.webp  (128×128, Invoker Kombo ve Pudge Hook oyunları)
// Çalışma anında dış istek yok: ikonlar derlemeye dosya olarak girer (bkz. abilityIconUrl, src/core/assets.js).
// Bir ikon inmezse oyun kendi çizdiği küre renkli yedeğe geçer.
//
// Kullanım: NODE_USE_ENV_PROXY=1 node scripts/fetch-ability-icons.mjs [--force]

import { mkdir, access } from 'node:fs/promises';
import sharp from 'sharp';

const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities';
const OUT = new URL('../src/assets/abilities/', import.meta.url);
const SIZE = 128;
const force = process.argv.includes('--force');

// [klasör, dosya adı (CDN adıyla aynı)]
const LIST = [
  ...['quas', 'wex', 'exort', 'invoke',
    'cold_snap', 'ghost_walk', 'ice_wall', 'emp', 'tornado',
    'alacrity', 'sun_strike', 'forge_spirit', 'chaos_meteor', 'deafening_blast'].map((n) => ['invoker', `invoker_${n}`]),
  ['pudge', 'pudge_meat_hook'],
];

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
  return null;
}

const missing = [];
let ok = 0;
for (const [dir, name] of LIST) {
  await mkdir(new URL(`${dir}/`, OUT), { recursive: true });
  const out = new URL(`${dir}/${name}.webp`, OUT);
  if (!force && await exists(out)) { ok++; continue; }
  const buf = await get(`${CDN}/${name}.png`);
  if (!buf) { missing.push(name); continue; }
  await sharp(buf).resize(SIZE, SIZE, { fit: 'cover' }).webp({ quality: 80, effort: 6 }).toFile(out.pathname);
  ok++;
}
console.log(`${ok}/${LIST.length} ikon hazır.` + (missing.length ? ' Eksik: ' + missing.join(', ') : ''));
