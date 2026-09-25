// Eşya ikonlarını (Valve'ın resmi Dota 2 CDN'i) indirip küçük WebP'ye çevirir.
//   src/assets/items/<eşya>.webp  (128×93, kaynak 88×64 PNG, oran korunur)
// Kullananlar: Eşya 2048 (birleştirme zinciri) ve 24 Saat Maraton (olay kartları).
// Çalışma anında dış istek yok: ikonlar derlemeye dosya olarak girer (bkz. itemIconUrl, src/core/assets.js)
// ve `?url&no-inline` ile JS'e hiç gömülmez; yalnızca görüntülendiklerinde iner.
// Bir ikon inmezse oyunlar kendi çizdiği yedeğe (baş harf + kademe rengi) geçer.
// Görseller Valve Corporation'a aittir; site resmi olmayan, ticari olmayan bir hayran projesidir.
//
// Kullanım: NODE_USE_ENV_PROXY=1 node scripts/fetch-item-icons.mjs [--force]

import { mkdir, access } from 'node:fs/promises';
import sharp from 'sharp';

const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items';
const OUT = new URL('../src/assets/items/', import.meta.url);
const WIDTH = 128;
const force = process.argv.includes('--force');

// CDN dosya adları (dota_react/items/<ad>.png)
const LIST = [
  // Eşya 2048 zinciri (kabaca altın değerine göre; tarifler gerçek değil)
  'branches', 'tango', 'magic_stick', 'magic_wand', 'boots', 'blink',
  'black_king_bar', 'ultimate_scepter', 'radiance', 'butterfly', 'rapier', 'aegis', 'cheese',
  // 24 Saat Maraton olay kartları
  'courier', 'ward_observer', 'smoke_of_deceit', 'tpscroll', 'gem', 'dust', 'bottle',
  'enchanted_mango', 'clarity', 'faerie_fire', 'refresher', 'tome_of_knowledge',
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

await mkdir(OUT, { recursive: true });
const missing = [];
let ok = 0;
for (const name of LIST) {
  const out = new URL(`${name}.webp`, OUT);
  if (!force && await exists(out)) { ok++; continue; }
  const buf = await get(`${CDN}/${name}.png`);
  if (!buf) { missing.push(name); continue; }
  await sharp(buf)
    .resize({ width: WIDTH, kernel: 'lanczos3' })
    .sharpen({ sigma: 0.6 })
    .webp({ quality: 86, alphaQuality: 90, effort: 6 })
    .toFile(out.pathname);
  ok++;
}
console.log(`${ok}/${LIST.length} eşya ikonu hazır.` + (missing.length ? ' Eksik: ' + missing.join(', ') : ''));
