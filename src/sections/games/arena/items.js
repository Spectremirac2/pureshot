// 1vDOQUZ Arena 3.0 — dükkân eşyaları (Türkçe, oyunbaz, özgün adlar).
// icon: src/assets/items/<icon>.webp (itemIconUrl; yoksa glyph + renk ile SVG yedeği).
//
// Şema: id, name, icon?, glyph?, color?, cost (temel eşyada fiyat; tarifli eşyada TARİF parşömeni fiyatı),
//   components: [bileşen kimlikleri] (boşsa temel eşya), tier (1 temel · 2 tarif · 3 geç · 4 efsane · 0 düşen),
//   kind: 'basic' | 'consumable' | 'recipe' | 'neutral' | 'drop', desc,
//   stat (pasif katkılar; recalc'ta toplanır: hp, mana, dmg, dmgMul, speed, evasion, atkSpeed (puan), manaRegen,
//         hpRegen, armor, magicResist, statusRes, str, agi, int, all, primary, crit, critMul, lifesteal, spellLifesteal,
//         spell (büyü güçlendirme), block, blockChance, cleave, burn, aghs, vision, bossDmg),
//   active: { cd, mana?, use(g, slot) → bool }, charges (tüketilebilir), stack, proc (saldırı etkisi: game.js).
// Tarif: toplam fiyat = cost + bileşenlerin toplam fiyatı. Sahip olunan bileşenler düşülür; bileşenler tamamlanınca
// (tarif ücreti ödenmişse) kendiliğinden birleşir. Satış: toplam fiyatın yarısı.

export const ITEMS = {
  // ------------------------------------------------------------ tüketilebilir / temel
  tango: {
    id: 'tango', name: 'Tango Paketi', icon: 'tango', cost: 90, tier: 1, kind: 'consumable', charges: 3, stack: true,
    components: [],
    desc: '3 şarj. Aktif: 8 sn’de 130 can. Ağaç kemirmek serbest.',
    active: { cd: 0.5, use: (g) => g.itemHeal(130, 8) },
  },
  fire: {
    id: 'fire', name: 'Peri Ateşi', icon: 'faerie_fire', cost: 70, tier: 1, kind: 'consumable', charges: 1,
    components: [],
    desc: '+2 hasar. Aktif: anında 90 can. Son saniye kurtarıcısı.',
    stat: { dmg: 2 },
    active: { cd: 3, use: (g) => { g.heal(90); return true; } },
  },
  tome: {
    id: 'tome', name: 'Bilgi Kitabı', icon: 'tome_of_knowledge', cost: 300, tier: 1, kind: 'consumable', charges: 1,
    components: [],
    desc: 'Aktif: okuyunca anında 260 XP (dalgayla artar). Farm yapamayanın dostu.',
    active: { cd: 0, use: (g) => { g.addXp(260 + 20 * Math.max(0, g.wave - 1)); g.emit('fx', { kind: 'tome', x: g.player.x, z: g.player.z }); return true; } },
  },
  dust: {
    id: 'dust', name: 'Görüş Tozu', icon: 'dust', cost: 90, tier: 1, kind: 'consumable', charges: 2, stack: true,
    components: [],
    desc: '2 şarj. Aktif: 10 birimdeki görünmezleri 8 sn açığa çıkarır ve %20 yavaşlatır (Wardsız DOG, Gölge Ulusu).',
    active: { cd: 4, use: (g) => g.useDust(10, 8) },
  },
  ward: {
    id: 'ward', name: 'Gözcü Ward’ı', icon: 'ward_observer', cost: 80, tier: 1, kind: 'consumable', charges: 2, stack: true,
    components: [],
    desc: '2 şarj. Aktif: nişan noktasına ward dik; 90 sn boyunca geceleri 8 birim görüş. “Ward alın” diyen haklıydı.',
    active: { cd: 1, use: (g) => g.placeWard(90) },
  },
  branch: {
    id: 'branch', name: 'Demir Dal', icon: 'branches', cost: 60, tier: 1, kind: 'basic',
    components: [],
    desc: '+2 güç, +2 çeviklik, +2 zekâ. Ormandan kırılmış, pek bir şeye benzemez ama her şeye girer.',
    stat: { all: 2 },
  },
  stick: {
    id: 'stick', name: 'Sihirli Sopa', icon: 'magic_stick', cost: 200, tier: 1, kind: 'basic', charges: 0, maxCharges: 10, keepEmpty: true,
    components: [],
    desc: 'Her öldürmede 1 şarj (en çok 10). Aktif: şarj başına 12 can ve 12 mana.',
    active: { cd: 10, use: (g, it) => g.useWand(it, 12) },
  },
  boots: {
    id: 'boots', name: 'Koşu Botları', icon: 'boots', cost: 350, tier: 1, kind: 'basic',
    components: [],
    desc: '+0,7 hareket hızı. Kaçmak da bir stratejidir.',
    stat: { speed: 0.7 },
  },
  belt: {
    id: 'belt', name: 'Kuvvet Kemeri', glyph: 'belt', color: '#e0354b', cost: 400, tier: 1, kind: 'basic',
    components: [],
    desc: '+7 güç. Pub’da kol güreşi şampiyonluğundan kalma.',
    stat: { str: 7 },
  },
  band: {
    id: 'band', name: 'Çevik Eşarp', glyph: 'band', color: '#43d6a0', cost: 400, tier: 1, kind: 'basic',
    components: [],
    desc: '+7 çeviklik. Rüzgârda dalgalanınca hız kesmez.',
    stat: { agi: 7 },
  },
  robe: {
    id: 'robe', name: 'Bilge Cübbesi', glyph: 'robe', color: '#5fb8ff', cost: 400, tier: 1, kind: 'basic',
    components: [],
    desc: '+7 zekâ. Cepleri not dolu: “ward al, ward al”.',
    stat: { int: 7 },
  },
  blade: {
    id: 'blade', name: 'Pala', glyph: 'blade', color: '#f3eadb', cost: 900, tier: 1, kind: 'basic',
    components: [],
    desc: '+18 hasar. Keskin, ağır, dürüst.',
    stat: { dmg: 18 },
  },
  mail: {
    id: 'mail', name: 'Zincir Yelek', glyph: 'mail', color: '#b9b2a4', cost: 500, tier: 1, kind: 'basic',
    components: [],
    desc: '+4 zırh. Isırıkları biraz daha sıkıcı yapar.',
    stat: { armor: 4 },
  },
  gloves: {
    id: 'gloves', name: 'Hız Eldiveni', glyph: 'gloves', color: '#ff9a3d', cost: 450, tier: 1, kind: 'basic',
    components: [],
    desc: '+20 saldırı hızı. Last hit için ideal.',
    stat: { atkSpeed: 20 },
  },
  vital: {
    id: 'vital', name: 'Can Taşı', glyph: 'vital', color: '#ff5a6e', cost: 900, tier: 1, kind: 'basic',
    components: [],
    desc: '+250 can. Kalbi olan bir taş.',
    stat: { hp: 250 },
  },
  energy: {
    id: 'energy', name: 'Mana Küresi', glyph: 'energy', color: '#8b7cff', cost: 800, tier: 1, kind: 'basic',
    components: [],
    desc: '+250 mana. İçinde küçük bir fırtına dönüyor.',
    stat: { mana: 250 },
  },
  ring: {
    id: 'ring', name: 'Yenilenme Yüzüğü', glyph: 'ring', color: '#43d66a', cost: 250, tier: 1, kind: 'basic',
    components: [],
    desc: '+3 can yenilenmesi.',
    stat: { hpRegen: 3 },
  },
  cloak: {
    id: 'cloak', name: 'Büyü Pelerini', glyph: 'cloak', color: '#b18cff', cost: 500, tier: 1, kind: 'basic',
    components: [],
    desc: '+%15 büyü direnci. REPORT! balonları buna çarpıp söner.',
    stat: { magicResist: 0.15 },
  },
  mask: {
    id: 'mask', name: 'Vampir Maskesi', glyph: 'mask', color: '#c0304a', cost: 700, tier: 1, kind: 'basic',
    components: [],
    desc: '+%12 can çalma (saldırılar).',
    stat: { lifesteal: 0.12 },
  },
  blink: {
    id: 'blink', name: 'Göz Açıp Kapayana', icon: 'blink', cost: 950, tier: 2, kind: 'basic',
    components: [],
    desc: 'Aktif: nişan yönünde 7 birime kadar ışınlan. Hasar aldıktan sonra 2 sn kullanılamaz.',
    active: { cd: 11, use: (g) => g.blinkTo(7) },
  },

  // ------------------------------------------------------------ tarifli eşyalar
  wand: {
    id: 'wand', name: 'Sihirli Değnek', icon: 'magic_wand', cost: 150, tier: 2, kind: 'recipe', charges: 0, maxCharges: 18, keepEmpty: true,
    components: ['stick', 'branch', 'branch'],
    desc: '+3 tüm özellikler. Her öldürmede 1 şarj (en çok 18). Aktif: şarj başına 16 can ve 16 mana.',
    stat: { all: 3 },
    active: { cd: 8, use: (g, it) => g.useWand(it, 16) },
  },
  phase: {
    id: 'phase', name: 'Faz Botları', glyph: 'phase', color: '#ff9a3d', cost: 0, tier: 2, kind: 'recipe',
    components: ['boots', 'mail'],
    desc: '+0,85 hız, +5 zırh. Aktif: 3 sn %25 hız, birimlerin içinden geçersin.',
    stat: { speed: 0.85, armor: 5 },
    active: { cd: 8, use: (g) => g.buffHaste(3, 1.25, 'phase') },
  },
  treads: {
    id: 'treads', name: 'Güç Nalları', glyph: 'treads', color: '#e9b949', cost: 0, tier: 2, kind: 'recipe',
    components: ['boots', 'gloves'],
    desc: '+0,8 hız, +25 saldırı hızı, +8 ana özellik.',
    stat: { speed: 0.8, atkSpeed: 25, primary: 8 },
  },
  bkb: {
    id: 'bkb', name: 'Kara Kral Asası', icon: 'black_king_bar', cost: 450, tier: 3, kind: 'recipe',
    components: ['belt', 'blade'],
    desc: '+10 güç, +22 hasar. Aktif: 5 sn büyü bağışıklığı: büyü hasarı ve kontrol etkileri (sersemletme, kök, korku, dönüşüm, REPORT) işlemez. Olumsuzları temizler.',
    stat: { str: 10, dmg: 22 },
    active: { cd: 45, use: (g) => g.bkbOn(5) },
  },
  radiance: {
    id: 'radiance', name: 'Güneş Tacı', icon: 'radiance', cost: 500, tier: 3, kind: 'recipe',
    components: ['blade', 'vital'],
    desc: '+22 hasar, +250 can. Pasif: 3,2 birimdeki düşmanlara saniyede 42 yanma (büyü).',
    stat: { dmg: 22, hp: 250, burn: 42 },
  },
  butterfly: {
    id: 'butterfly', name: 'Kelebek', icon: 'butterfly', cost: 300, tier: 3, kind: 'recipe',
    components: ['band', 'band', 'blade'],
    desc: '+20 çeviklik, +25 hasar, +%30 kaçınma, +25 saldırı hızı. Okçu’da şarj %20 hızlanır.',
    stat: { agi: 20, dmg: 25, evasion: 0.3, atkSpeed: 25 },
  },
  aghs: {
    id: 'aghs', name: 'Aghanım Asası', icon: 'ultimate_scepter', cost: 300, tier: 3, kind: 'recipe',
    components: ['belt', 'band', 'robe', 'energy'],
    desc: '+10 tüm özellikler, +200 can, +250 mana. Ultiyi yükseltir (kahramana göre değişir).',
    stat: { all: 10, hp: 200, aghs: 1 },
  },
  refresher: {
    id: 'refresher', name: 'Tazeleme Küresi', icon: 'refresher', cost: 550, tier: 3, kind: 'recipe',
    components: ['ring', 'energy', 'robe'],
    desc: '+8 zekâ, +5 can yenilenmesi, +4 mana/sn. Aktif: tüm yetenek ve eşya bekleme sürelerini sıfırlar.',
    stat: { int: 8, hpRegen: 5, manaRegen: 4 },
    active: { cd: 60, mana: 150, use: (g) => g.refreshAll() },
  },
  rapier: {
    id: 'rapier', name: 'İlahi Kılıç', icon: 'rapier', cost: 1800, tier: 4, kind: 'recipe',
    components: ['blade', 'blade'],
    desc: 'Tüm hasar +%80. Aegis ile dirilirsen düşer: Kurye Köpeği kapar, 8 sn içinde indirip geri al!',
    stat: { dmgMul: 0.8 },
  },
  vanguard: {
    id: 'vanguard', name: 'Kaya Kalkanı', glyph: 'vanguard', color: '#b9b2a4', cost: 250, tier: 2, kind: 'recipe',
    components: ['vital', 'ring'],
    desc: '+250 can, +5 can yenilenmesi. %60 şansla saldırı hasarından 34 blok (menzillide 17).',
    stat: { hp: 250, hpRegen: 5, block: 34, blockChance: 0.6 },
  },
  maelstrom: {
    id: 'maelstrom', name: 'Şimşek Tırpanı', glyph: 'maelstrom', color: '#5fb8ff', cost: 350, tier: 3, kind: 'recipe',
    components: ['gloves', 'blade'],
    desc: '+24 hasar, +25 saldırı hızı. Saldırıların %25 şansla 4 düşmana sıçrayan 110 büyü hasarlı şimşek çaktırır.',
    stat: { dmg: 24, atkSpeed: 25 },
    proc: { kind: 'chain', chance: 0.25, dmg: 110, jumps: 4, range: 4 },
  },
  deso: {
    id: 'deso', name: 'Zırh Kıran', glyph: 'deso', color: '#e0354b', cost: 500, tier: 3, kind: 'recipe',
    components: ['blade', 'mail'],
    desc: '+32 hasar, +2 zırh. Saldırıların hedefin zırhını 6 sn boyunca 6 azaltır (negatif zırh hasarı artırır).',
    stat: { dmg: 32, armor: 2 },
    proc: { kind: 'shred', k: 6, dur: 6 },
  },
  hood: {
    id: 'hood', name: 'Ruh Başlığı', glyph: 'hood', color: '#b18cff', cost: 300, tier: 2, kind: 'recipe',
    components: ['cloak', 'ring', 'belt'],
    desc: '+%25 büyü direnci, +6 can yenilenmesi, +8 güç. Aktif: 8 sn boyunca 400 büyü hasarını emen kalkan.',
    stat: { magicResist: 0.25, hpRegen: 6, str: 8 },
    active: { cd: 50, mana: 50, use: (g) => g.magShieldOn(400, 8) },
  },
  cyclone: {
    id: 'cyclone', name: 'Kasırga Asası', glyph: 'cyclone', color: '#9fe8ff', cost: 400, tier: 3, kind: 'recipe',
    components: ['robe', 'energy'],
    desc: '+12 zekâ, +3 mana/sn, +%12 büyü güçlendirme. Aktif: kendini 2,2 sn havaya kaldır: dokunulmazsın ve olumsuz etkiler temizlenir.',
    stat: { int: 12, manaRegen: 3, spell: 0.12 },
    active: { cd: 22, mana: 75, use: (g) => g.cycloneSelf(2.2) },
  },
  satanic: {
    id: 'satanic', name: 'Kan Emici', glyph: 'satanic', color: '#c0304a', cost: 400, tier: 4, kind: 'recipe',
    components: ['mask', 'belt', 'blade'],
    desc: '+%20 can çalma, +12 güç, +28 hasar. Aktif: 5 sn boyunca can çalma ×3 (“Kan Çılgınlığı”).',
    stat: { lifesteal: 0.2, str: 12, dmg: 28 },
    active: { cd: 35, use: (g) => g.buffLifesteal(5, 3) },
  },
  mek: {
    id: 'mek', name: 'Kutsal Tılsım', glyph: 'mek', color: '#43d6a0', cost: 450, tier: 2, kind: 'recipe',
    components: ['ring', 'mail', 'robe'],
    desc: '+6 zırh, +4 can yenilenmesi, +8 zekâ. Aktif: anında 260 can ve 6 sn +4 zırh; yakındaki Radiant kulelerini de onarır.',
    stat: { armor: 6, hpRegen: 4, int: 8 },
    active: { cd: 40, mana: 100, use: (g) => g.mekHeal(260, 6, 4) },
  },

  // ------------------------------------------------------------ düşen eşyalar
  cheese: {
    id: 'cheese', name: 'Peynir', icon: 'cheese', cost: 0, tier: 0, kind: 'drop', drop: true, charges: 1,
    components: [],
    desc: 'Roshan’dan düşer. Aktif: anında tam can ve mana.',
    active: { cd: 0, use: (g) => g.cheese() },
  },
};

/** Dükkân sekmeleri (sırasıyla). */
export const SHOP_TABS = [
  { id: 'temel', name: 'Temel', items: ['tango', 'fire', 'dust', 'ward', 'tome', 'branch', 'stick', 'boots', 'ring', 'belt', 'band', 'robe', 'gloves', 'mail', 'cloak', 'mask', 'vital', 'energy', 'blade', 'blink'] },
  { id: 'gelismis', name: 'Gelişmiş', items: ['wand', 'phase', 'treads', 'vanguard', 'hood', 'mek', 'bkb', 'maelstrom', 'deso', 'cyclone', 'radiance', 'butterfly', 'aghs', 'refresher', 'satanic', 'rapier'] },
];
/** Dükkânda satılanlar (tümü). */
export const SHOP = SHOP_TABS.flatMap((t) => t.items);
export const SLOTS = 6;
export const itemOf = (id) => ITEMS[id] || null;

/** Tarifli mi? */
export const isRecipe = (id) => !!(ITEMS[id] && ITEMS[id].components && ITEMS[id].components.length);
/** Toplam fiyat (tarif + bileşenler, özyinelemeli). */
export function totalCost(id) {
  const I = ITEMS[id];
  if (!I) return 0;
  let c = I.cost || 0;
  for (const k of I.components || []) c += totalCost(k);
  return c;
}
/** Bu eşyanın girdiği tarifler (dükkân ağacının "üstü"). */
export function buildsInto(id) {
  const out = [];
  for (const I of Object.values(ITEMS)) if ((I.components || []).includes(id) && !out.includes(I.id)) out.push(I.id);
  return out;
}

// ------------------------------------------------------------------ orman (neutral) eşyaları
/**
 * Orman kamplarından düşer (tek orman yuvası). tier: 1 (dalga 1–5), 2 (6–10), 3 (11+). Hepsi pasif.
 */
export const NEUTRALS = {
  fang: { id: 'fang', name: 'Kurt Dişi Kolye', tier: 1, glyph: 'fang', color: '#c9b8a0', desc: '+8 hasar, +%5 can çalma.', stat: { dmg: 8, lifesteal: 0.05 } },
  feather: { id: 'feather', name: 'Harpi Tüyü', tier: 1, glyph: 'feather', color: '#9fe8ff', desc: '+0,35 hareket hızı, +10 saldırı hızı.', stat: { speed: 0.35, atkSpeed: 10 } },
  charm: { id: 'charm', name: 'Ormancı Tılsımı', tier: 1, glyph: 'charm', color: '#43d66a', desc: '+2,5 can ve +1,5 mana yenilenmesi.', stat: { hpRegen: 2.5, manaRegen: 1.5 } },
  lantern: { id: 'lantern', name: 'Gece Feneri', tier: 2, glyph: 'lantern', color: '#f6d98a', desc: 'Gece görüşü +3,5 birim, +3 zırh. Wardsız karanlıkta ışık.', stat: { vision: 3.5, armor: 3 } },
  chain: { id: 'chain', name: 'Kopuk Zincir', tier: 2, glyph: 'chainlink', color: '#b9b2a4', desc: '+%15 statü direnci, +200 can.', stat: { statusRes: 0.15, hp: 200 } },
  fury: { id: 'fury', name: 'Öfke Kolyesi', tier: 2, glyph: 'fury', color: '#ff6a2b', desc: '+%15 şansla ×1,7 kritik vuruş.', stat: { crit: 0.15, critMul: 1.7 } },
  scale: { id: 'scale', name: 'Titan Pulu', tier: 3, glyph: 'scale', color: '#7fd4ff', desc: '+6 zırh, +%15 büyü direnci, +300 can.', stat: { armor: 6, magicResist: 0.15, hp: 300 } },
  shard: { id: 'shard', name: 'Yıldız Kırığı', tier: 3, glyph: 'shard', color: '#8b7cff', desc: '+%15 büyü güçlendirme, +5 mana/sn, +%10 büyü can çalma.', stat: { spell: 0.15, manaRegen: 5, spellLifesteal: 0.1 } },
  seal: { id: 'seal', name: 'Dokuzun Mührü', tier: 3, glyph: 'seal', color: '#e9b949', desc: '+10 tüm özellikler, bosslara %15 fazla hasar.', stat: { all: 10, bossDmg: 0.15 } },
};
export const NEUTRAL_IDS = Object.keys(NEUTRALS);
/** Dalgaya göre orman eşyası kademesi. */
export const neutralTier = (wave) => (wave >= 11 ? 3 : wave >= 6 ? 2 : 1);
/** Kademe başına en çok düşecek eşya sayısı. */
export const NEUTRAL_PER_TIER = 3;

// ------------------------------------------------------------------ rünler
export const RUNES = {
  haste: { id: 'haste', name: 'Hız', color: '#ff4d4d', dur: 8, desc: '8 sn en yüksek hız' },
  dd: { id: 'dd', name: 'Çift Hasar', color: '#4d8dff', dur: 12, desc: '12 sn çift hasar' },
  regen: { id: 'regen', name: 'Yenilenme', color: '#43d66a', dur: 8, desc: 'Can ve mana hızla dolar' },
  invis: { id: 'invis', name: 'Görünmezlik', color: '#b18cff', dur: 10, desc: '10 sn görünmezlik' },
  bounty: { id: 'bounty', name: 'Ödül', color: '#e9b949', dur: 0, desc: 'Güvenilir altın ve XP' },
};
export const RUNE_IDS = Object.keys(RUNES);
