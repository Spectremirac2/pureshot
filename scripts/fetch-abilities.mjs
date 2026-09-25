// Kahraman yeteneklerini (Valve'ın resmi dota2.com datafeed'i) çekip iki çıktı üretir:
//   src/data/abilities.js                    → ABILITIES = { <kahramanId>: [{ key, name, ult }] }
//   src/assets/abilities/heroes/<key>.webp   → 96×96 WebP yetenek ikonları (Yetenek Avı quizi)
// Çalışma anında dış istek yok: veri ve ikonlar derlemeye dosya olarak girer.
//
// Kullanım:
//   NODE_USE_ENV_PROXY=1 node scripts/fetch-abilities.mjs [--force] [--no-icons] [--cache <klasör>] [kahramanId ...]
//     --force      var olan ikonları yeniden indir
//     --no-icons   yalnızca src/data/abilities.js'i yeniden yaz
//     --cache dir  ham datafeed yanıtlarını bu klasörde sakla/oradan oku (geliştirme kolaylığı)
//     kahramanId   yalnızca bu kahramanların ikonlarını indir (veri dosyası yine tüm kahramanlarla yazılır)
//
// Hangi yetenekler alınır (quizde "bu yetenek kimin?" sorusu adil olsun diye):
//   - Kahramanın normal yetenekleri; ultimate'lar `ult: true` ile işaretlenir.
//   - Yetenek ağacı (talent), special_bonus_*, generic_hidden ve boş kayıtlar alınmaz.
//   - Aghanim's Shard / Scepter ile gelen yetenekler alınmaz (çekirdek set değil).
//   - Doğuştan (innate) yeteneklerden yalnızca etkin olanlar (pasif değil, gizli değil) alınır:
//     Invoke, Stone Remnant, Summon Spirit Bear, Mischief, Blur, Battle Stance… (`innate: true`).
//   - Gizli (hidden) yetenekler yalnızca gerçekten kullanılan takas setleri için alınır:
//     Invoker'ın çağırdığı büyüler, Kez'in ikinci duruşu, Largo'nun şarkıları.
//   - Aynı yeteneğin ikinci kopyası (Activate Fire Remnant, Attribute Shift (Strength Gain)) alınmaz.

import { mkdir, readFile, writeFile, access, stat, readdir } from 'node:fs/promises';
import sharp from 'sharp';
import { HEROES } from '../src/data/heroes.js';

const FEED = 'https://www.dota2.com/datafeed/herodata?language=english&hero_id=';
const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities';
const ROOT = new URL('../', import.meta.url);
const OUT_DATA = new URL('src/data/abilities.js', ROOT);
const OUT_ICONS = new URL('src/assets/abilities/heroes/', ROOT);
const SIZE = 96;

const args = process.argv.slice(2);
const force = args.includes('--force');
const noIcons = args.includes('--no-icons');
const ci = args.indexOf('--cache');
const cacheDir = ci >= 0 ? args[ci + 1] : null;
const only = args.filter((a, i) => !a.startsWith('--') && !(ci >= 0 && i === ci + 1));

const HIDDEN_KEEP = [/^invoker_/, /^kez_/, /^largo_song_/];
const SKIP = new Set(['ember_spirit_activate_fire_remnant', 'morphling_morph_str']);

const exists = (u) => access(u).then(() => true, () => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, as = 'buffer') {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return as === 'json' ? await r.json() : Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (i === 3) throw e;
      await sleep(1000 * 2 ** i);
    }
  }
  return null;
}

/** Sınırlı eşzamanlılıkla eşleme. */
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

// ---------------------------------------------------------------- kahraman sayısal kimlikleri
async function heroNumbers() {
  const map = new Map();
  try {
    const roster = JSON.parse(await readFile(new URL('assets-src/heroes-roster.json', ROOT), 'utf8'));
    for (const r of roster) map.set(r.key, r.id);
  } catch { /* yedeğe geç */ }
  try {
    const list = JSON.parse(await readFile(new URL('assets-src/dota2-herolist.json', ROOT), 'utf8'));
    for (const x of list.result.data.heroes) {
      const key = x.name.replace(/^npc_dota_hero_/, '');
      if (!map.has(key)) map.set(key, x.id);
    }
  } catch { /* yok say */ }
  return map;
}

async function heroData(num) {
  const file = cacheDir ? `${cacheDir.replace(/\/$/, '')}/hero-${num}.json` : null;
  if (file) {
    try { return JSON.parse(await readFile(file, 'utf8')); } catch { /* indir */ }
  }
  const json = await get(FEED + num, 'json');
  if (file && json) {
    await mkdir(cacheDir, { recursive: true });
    await writeFile(file, JSON.stringify(json));
  }
  return json;
}

function pickAbilities(hero) {
  const out = [];
  for (const a of hero.abilities || []) {
    const key = String(a.name || '');
    const name = String(a.name_loc || '').trim();
    if (!key || !name || key === 'generic_hidden' || key.startsWith('special_bonus_') || SKIP.has(key)) continue;
    if (a.is_item) continue;
    if (a.ability_is_granted_by_shard || a.ability_is_granted_by_scepter) continue;
    let beh = 0n;
    try { beh = BigInt(a.behavior || '0'); } catch { /* 0 */ }
    const hidden = (beh & 1n) === 1n;
    const passive = (beh & 2n) === 2n;
    if (a.ability_is_innate && (hidden || passive)) continue;
    if (hidden && !HIDDEN_KEEP.some((re) => re.test(key))) continue;
    const rec = { key, name, ult: a.type === 1 };
    if (a.ability_is_innate) rec.innate = true;
    out.push(rec);
  }
  return out;
}

// ---------------------------------------------------------------- veri
const nums = await heroNumbers();
const missingHero = [];
const results = await pool(HEROES, 6, async (h) => {
  const num = nums.get(h.id);
  if (!num) { missingHero.push(h.id); return [h.id, []]; }
  const json = await heroData(num);
  const hero = json && json.result && json.result.data && json.result.data.heroes && json.result.data.heroes[0];
  if (!hero) { missingHero.push(h.id); return [h.id, []]; }
  return [h.id, pickAbilities(hero)];
});

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const lines = results.map(([id, list]) => {
  const rows = list.map((a) => `    { key: ${q(a.key)}, name: ${q(a.name)}, ult: ${a.ult}${a.innate ? ', innate: true' : ''} },`);
  return `  ${/^[a-z_$][a-z0-9_$]*$/i.test(id) ? id : q(id)}: [\n${rows.join('\n')}\n  ],`;
});
const total = results.reduce((s, [, l]) => s + l.length, 0);
const src = `// Kahraman yetenekleri — ÜRETİLMİŞ DOSYA, elle düzenlemeyin.
// Kaynak: Valve'ın resmi dota2.com datafeed'i (yetenek adları oyundaki İngilizce adlardır; datafeed
// Türkçe dilde de adları çevirmiyor). Yeniden üretmek için:
//   NODE_USE_ENV_PROXY=1 node scripts/fetch-abilities.mjs
// Seçim kuralları için bkz. scripts/fetch-abilities.mjs ve docs/oyunlar/yetenek.md.
// ${results.length} kahraman, ${total} yetenek.
//
// Bu modül Yetenek Avı quizi açılınca tembel yüklenir (import()), böylece veri ve ikon listesi
// quiz merkezinin ya da çekirdek paketin yükünü artırmaz. İkonlar asla JS'e gömülmez (?no-inline).

export const ABILITIES = {
${lines.join('\n')}
};

const ICONS = import.meta.glob('../assets/abilities/heroes/*.webp', { eager: true, query: '?url&no-inline', import: 'default' });

/** Yetenek ikonunun URL'si (src/assets/abilities/heroes/<key>.webp) ya da null. */
export function abilityIcon(key) {
  return ICONS[\`../assets/abilities/heroes/\${key}.webp\`] || null;
}
`;
await writeFile(OUT_DATA, src);
console.log(`src/data/abilities.js: ${results.length} kahraman, ${total} yetenek, ${(Buffer.byteLength(src) / 1024).toFixed(1)} KB` +
  (missingHero.length ? ` · verisi gelmeyen: ${missingHero.join(', ')}` : ''));

// ---------------------------------------------------------------- ikonlar
if (!noIcons) {
  await mkdir(OUT_ICONS, { recursive: true });
  const all = results
    .filter(([id]) => !only.length || only.includes(id))
    .flatMap(([, list]) => list.map((a) => a.key));
  const missing = [];
  let fresh = 0;
  await pool(all, 8, async (key) => {
    const out = new URL(`${key}.webp`, OUT_ICONS);
    if (!force && await exists(out)) return;
    const buf = await get(`${CDN}/${key}.png`);
    if (!buf) { missing.push(key); return; }
    try {
      await sharp(buf)
        .resize(SIZE, SIZE, { fit: 'cover' })
        .webp({ quality: 74, effort: 6 })
        .toFile(out.pathname);
      fresh++;
    } catch (e) {
      missing.push(`${key} (${e.message})`);
    }
  });
  let bytes = 0;
  let count = 0;
  for (const f of await readdir(OUT_ICONS)) {
    if (!f.endsWith('.webp')) continue;
    bytes += (await stat(new URL(f, OUT_ICONS))).size;
    count++;
  }
  console.log(`İkonlar: ${fresh} yeni, klasörde ${count} dosya, toplam ${(bytes / 1024 / 1024).toFixed(2)} MB.` +
    (missing.length ? `\nİkonu bulunamayan (${missing.length}): ${missing.join(', ')}` : ''));
}
