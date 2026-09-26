// 1vDOQUZ Arena — kalıcı ilerleme (meta): Parıltı Taşı, Aghanim Kütüphanesi, kahraman ustalığı,
// Lanet seviyeleri ve Kodeks. Belge: docs/ARENA-ILERLEME.md
//
// İlke (roguelite araştırması, ARENA-TASARIM §1): kalıcı ilerleme ham güç değil SEÇENEK açar. Ustalığın ham
// istatistiği toplamda %5 ile sınırlıdır (+%2 can, +%2 hasar, +%1 altın); geri kalan her şey alternatif
// yetenek varyantı, eşdeğer değerde başlangıç çantası, kozmetik ya da isteğe bağlı zorluktur (Lanet).
//
// Saf modül: DOM yok, yalnızca `ls` (localStorage, core/dom.js) — Node testlerinde de çalışır. Arayüzler
// tembel yüklenir (ayrı parça): mountLibrary → library.js, mountHeroMastery → mastery.js, mountCodex → codex.js.
//
// Oyun akışı (entegrasyon):
//   const cfg = applyMeta({ mode: 'endless', heroId, seed, curse })   → createGame / g.start(cfg)
//   const stopTrack = trackGame(g)                                     → Kodeks (görülen birim/boss/eşya)
//   g.on('runEnd', (r) => { const rw = grantRunRewards({ ...r, mode, curse }) … mountRunRewards(el, rw) })

import { ls, seeded, hashStr } from '../../../core/dom.js';
import * as HeroData from './heroes.js';
import * as ItemData from './items.js';

// ------------------------------------------------------------------ sabitler
export const META_VERSION = 1;
/** ls anahtarı (localStorage'da `csk:` önekiyle: csk:arena:meta:v1). */
export const META_KEY = 'arena:meta:v1';
export const META_STORAGE_KEY = 'csk:' + META_KEY;
export const SHARD_NAME = 'Parıltı Taşı';

const DAY = 86400e3;
const istanbulDay = (now = Date.now()) => Math.floor((now + 3 * 3600e3) / DAY);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const int = (v, a, b, d = 0) => clamp(Math.floor(num(v, d)), a, b);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const HEROES = () => (isObj(HeroData.HEROES) ? HeroData.HEROES : {});
const ITEMS = () => (isObj(ItemData.ITEMS) ? ItemData.ITEMS : {});

// ------------------------------------------------------------------ kahramanlar
/** Arena 2.0'ın dört kahramanı: her zaman açık. */
export const BASE_HEROES = ['okcu', 'balta', 'buz', 'golge'];
/** Kütüphane'den açılan kahramanlar (heroes.js'te `locked: true` olan her kahraman da buraya katılır). */
export const LOCKED_HEROES = ['simsek', 'agac'];
/** Tasarım belgesindeki eski/İngilizce kimlikler → heroes.js kimlikleri. */
export const HERO_ALIASES = { storm: 'simsek', treant: 'agac', archer: 'okcu', brute: 'balta', frost: 'buz', shadow: 'golge' };
/** Kahraman kimliğini heroes.js kimliğine çevirir ('storm' → 'simsek'). */
export const heroKey = (id) => (typeof id === 'string' && own(HERO_ALIASES, id) && !isObj(HEROES()[id]) ? HERO_ALIASES[id] : id);

// heroes.js bir kahramanı henüz tanımlamıyorsa (ör. faz B bitmeden) arayüzün kullandığı yedek bilgiler
const HERO_FALLBACK = {
  okcu: { name: 'Okçu', color: '#43d6a0', role: 'Menzilli · Nişancı', icon: 'bow' },
  balta: { name: 'Balta', color: '#e0354b', role: 'Yakın dövüş · Tank', icon: 'axe' },
  buz: { name: 'Buz Cadısı', color: '#7fd4ff', role: 'Menzilli · Büyücü', icon: 'frost' },
  golge: { name: 'Gölge', color: '#b18cff', role: 'Yakın dövüş · Suikastçı', icon: 'daggers' },
  simsek: { name: 'Şimşek Ruhu', color: '#5fb8ff', role: 'Menzilli · Hareketli büyücü', icon: 'bolt',
    blurb: 'Haritanın bir ucundan öbürüne göz açıp kapayana kadar varır, sonra “Ben mi yaptım?” diye sorar.' },
  agac: { name: 'Ağaç Bekçisi', color: '#8fd16a', role: 'Yakın dövüş · Dayanıklı destek', icon: 'treant',
    blurb: 'Yüz yıldır aynı koridoru bekleyen fıçı gövdeli yaşlı ağaç. Acelesi yok; köklerinden kaçan da yok.' },
};

/** Oyunun tanıdığı ya da ilerlemenin bildiği tüm kahraman kimlikleri (açıklar önce). */
export function heroIds() {
  const known = Array.isArray(HeroData.HERO_IDS) ? HeroData.HERO_IDS : [];
  const all = [...BASE_HEROES, ...known, ...Object.keys(HEROES()), ...LOCKED_HEROES];
  const seen = new Set();
  const out = [];
  for (const id of all) if (typeof id === 'string' && !seen.has(id)) { seen.add(id); out.push(id); }
  return out.sort((a, b) => Number(isLockable(a)) - Number(isLockable(b)));
}

/** Kilitlenebilir (Kütüphane'den açılan) kahraman mı? */
export function isLockable(id) {
  const heroId = heroKey(id);
  const H = HEROES()[heroId];
  if (BASE_HEROES.includes(heroId)) return false;
  return LOCKED_HEROES.includes(heroId) || !!(H && H.locked);
}

/** Arayüz için kahraman bilgisi (heroes.js varsa oradan, yoksa yedekten). */
export function heroInfo(id) {
  const heroId = heroKey(id);
  const H = HEROES()[heroId];
  const F = HERO_FALLBACK[heroId] || {};
  return {
    id: heroId,
    name: (H && H.name) || F.name || heroId,
    color: (H && H.color) || F.color || '#e9b949',
    role: (H && H.role) || F.role || '',
    title: (H && H.title) || '',
    blurb: (H && H.blurb) || F.blurb || '',
    icon: F.icon || 'user',
    known: !!H,
    lockable: isLockable(heroId),
  };
}

// ------------------------------------------------------------------ ustalık kademeleri
/**
 * Kahraman ustalığı: kahramana özel kalıcı XP ve rütbe (sitenin Dota madalya dili, core/quests.js RANKS renkleri).
 * grants: bu kademede açılanlar. stat yüzdeleri toplamda +%5'i geçmez (can 2 + hasar 2 + altın 1).
 */
export const MASTERY_TIERS = [
  { id: 'herald', name: 'Herald', xp: 0, color: '#9c8e6f', grants: [],
    text: 'Başlangıç. Temel kit ve herkese açık Tango Paketi.' },
  { id: 'guardian', name: 'Guardian', xp: 70, color: '#8fb3a8', grants: [{ type: 'aura' }, { type: 'stat', stat: 'hp', pct: 1 }],
    text: 'Kahraman aurası (kendi rengi) · +%1 can' },
  { id: 'crusader', name: 'Crusader', xp: 220, color: '#43d6a0', grants: [{ type: 'variant', n: 0 }],
    text: '1. yetenek varyantı' },
  { id: 'archon', name: 'Archon', xp: 450, color: '#4ea8ff', grants: [{ type: 'kit' }, { type: 'stat', stat: 'dmg', pct: 1 }],
    text: 'Kahramana özel başlangıç çantası · +%1 hasar' },
  { id: 'legend', name: 'Legend', xp: 800, color: '#8b7cff', grants: [{ type: 'variant', n: 1 }],
    text: '2. yetenek varyantı' },
  { id: 'ancient', name: 'Ancient', xp: 1250, color: '#ff9a3d', grants: [{ type: 'trail' }, { type: 'stat', stat: 'gold', pct: 1 }],
    text: 'Kahraman izi · +%1 altın' },
  { id: 'divine', name: 'Divine', xp: 1800, color: '#e9b949', grants: [{ type: 'variant', n: 2 }, { type: 'stat', stat: 'hp', pct: 1 }],
    text: 'Ulti varyantı (Aghanım tarzı) · +%1 can' },
  { id: 'immortal', name: 'Immortal', xp: 2500, color: '#e0354b', grants: [{ type: 'immortal' }, { type: 'stat', stat: 'dmg', pct: 1 }],
    text: 'Ölümsüz aurası ve unvanı · +%1 hasar' },
];
const LEGEND_TIER = MASTERY_TIERS.findIndex((t) => t.id === 'legend');

/** XP'den kademe bilgisi: { tier, id, name, color, xp, floor, next, into, need, pct, max } */
export function rankOf(xp) {
  const v = Math.max(0, Math.floor(num(xp)));
  let tier = 0;
  for (let i = 0; i < MASTERY_TIERS.length; i++) if (v >= MASTERY_TIERS[i].xp) tier = i;
  const T = MASTERY_TIERS[tier];
  const N = MASTERY_TIERS[tier + 1] || null;
  const need = N ? N.xp - T.xp : 0;
  const into = v - T.xp;
  return { tier, id: T.id, name: T.name, color: T.color, xp: v, floor: T.xp, next: N ? N.xp : null, nextName: N ? N.name : null,
    into, need, pct: N ? clamp(into / need, 0, 1) : 1, max: !N };
}

/** Kademeye kadar birikmiş küçük stat bonusları (yüzde). */
export function masteryStats(tier) {
  const out = { hpPct: 0, dmgPct: 0, goldPct: 0 };
  for (let i = 0; i <= tier && i < MASTERY_TIERS.length; i++) {
    for (const g of MASTERY_TIERS[i].grants) if (g.type === 'stat') out[g.stat + 'Pct'] += g.pct;
  }
  return out;
}

// ------------------------------------------------------------------ yetenek varyantları
/**
 * Ustalıkla açılan alternatif yetenekler (Crusader / Legend / Divine). Hiçbiri saf güç değildir: her biri
 * varsayılan yeteneğin yerine geçen, artısı ve eksisi olan bir oyun tarzıdır. Oyun seçimi
 * runConfig.meta.variants[<tuş>] = <varyant kimliği> olarak okur (bkz. docs/ARENA-ILERLEME.md).
 */
export const VARIANTS = {
  okcu: [
    { id: 'okcu_volley', key: 'q', name: 'Yaylım Ateşi', replaces: 'CureShot',
      desc: 'Şarj yok: dokununca üç okluk yelpaze atar. Ok başına %45 hasar, delip geçmez. Yakın sürüde hızlı, uzak nişanda zayıf.' },
    { id: 'okcu_gale', key: 'w', name: 'Kasırga Adımı', replaces: 'Rüzgâr Koşusu',
      desc: 'Kaçınma vermez; başlarken 3 birimdeki düşmanları geri iter ve 1 sn yavaşlatır. Süre 3 → 2,5 sn.' },
    { id: 'okcu_rain', key: 'r', name: 'Ok Yağmuru', replaces: 'DOG DOG DOG', aghs: true,
      desc: 'Korkutmaz, sersemletmez: seçtiğin alana 3 sn ok yağdırır (toplam %140 hasar). Aghanım Asası yağmuru 1 sn uzatır.' },
  ],
  balta: [
    { id: 'balta_roar', key: 'q', name: 'Meydan Okuma', replaces: 'Savaş Çağrısı',
      desc: 'Yarıçap %30 küçülür; karşılığında hasar azaltma %40 → %60 ve süre +1 sn. Az ama sağlam çek.' },
    { id: 'balta_blood', key: 'w', name: 'Kanlı Helezon', replaces: 'Helezon',
      desc: 'Vurulunca dönme şansı kalkar; aktif Helezon iki tur döner ve isabet başına can yeniler.' },
    { id: 'balta_mass', key: 'r', name: 'Toplu Hüküm', replaces: 'Kesin Hüküm', aghs: true,
      desc: '2,5 yarıçapta eşiğin altındaki herkesi infaz eder; eşik %25 düşer ve bekleme artık sıfırlanmaz.' },
  ],
  buz: [
    { id: 'buz_shards', key: 'q', name: 'Buz Kıymıkları', replaces: 'Buz Novası',
      desc: 'Yavaşlatmaz; noktadan beş kıymık saçılır. Tek hedefe %60 fazla hasar, sürüye daha az.' },
    { id: 'buz_ward', key: 'e', name: 'Kış Kalkanı', replaces: 'Mana Aurası',
      desc: 'Pasif mana yenilenmesi kapanır; aktif: 4 sn boyunca manan kadar hasar emen buz kalkanı.' },
    { id: 'buz_blizzard', key: 'r', name: 'Gezgin Tipi', replaces: 'Donduran Alan', aghs: true,
      desc: 'Kanal yok: seni izleyen daha küçük (−%35 yarıçap) bir fırtına, 6 sn. Koşarken dondur.' },
  ],
  golge: [
    { id: 'golge_mark', key: 'q', name: 'Av İşareti', replaces: 'Gölge Adımı',
      desc: 'Işınlanmaz; hedefi 4 sn işaretler (+%25 alınan hasar). Menzil yarıya iner, bekleme −2 sn.' },
    { id: 'golge_decoy', key: 'w', name: 'Gölge İkizi', replaces: 'Duman Perdesi',
      desc: 'Görünmezlik yerine 4 sn yem ikiz bırakır; DOG’lar ona saldırır. İlk vuruş bonusu yok.' },
    { id: 'golge_eclipse', key: 'r', name: 'Tutulma', replaces: 'Ölüm Dansı', aghs: true,
      desc: 'Sıçramaz: 3 sn yerinde döner, menzildeki herkese saniyede üç kritik. Dans boyunca dokunulmaz değilsin.' },
  ],
  simsek: [
    { id: 'simsek_drift', key: 'q', name: 'Gezgin Kalıntı', replaces: 'Durgun Kalıntı',
      desc: 'Kalıntı yerinde durmaz: en yakın düşmana süzülüp çarpar. Aynı anda yalnızca bir kalıntı ama hasar +%40.' },
    { id: 'simsek_pulse', key: 'w', name: 'Girdap Darbesi', replaces: 'Elektrik Girdabı',
      desc: 'Merkeze çekmez, köklemez: düşmanları dışarı iter ve 1,5 sn yavaşlatır. Kaçış ve alan kontrolü.' },
    { id: 'simsek_short', key: 'r', name: 'Kısa Devre', replaces: 'Yıldırım Topu', aghs: true,
      desc: 'En çok 5 birim uçarsın ama mana maliyeti sabittir ve varınca Aşırı Yük hazır olur. Kısa, sık, patlamalı.' },
  ],
  agac: [
    { id: 'agac_bloom', key: 'q', name: 'Çiçek Açan Örtü', replaces: 'Doğanın Örtüsü',
      desc: 'Görünmezlik yok: 5 sn çevrendeki düşmanları %30 yavaşlatan çiçek alanı açar, iyileşmen iki katına çıkar.' },
    { id: 'agac_thorns', key: 'w', name: 'Dikenli Kökler', replaces: 'Sömürücü Kökler',
      desc: 'Can emmez; hedefin 2 birim çevresindekiler de köklenir. Hasar −%30.' },
    { id: 'agac_grove', key: 'r', name: 'Kutsal Koru', replaces: 'Aşırı Büyüme', aghs: true,
      desc: 'Köklemez: 6 sn boyunca içinde durana saniyede %3 can yenileyen, düşmanları %40 yavaşlatan bir koru büyütür.' },
  ],
};
const VARIANT_TIERS = MASTERY_TIERS.map((t, i) => (t.grants.find((g) => g.type === 'variant') ? i : -1)).filter((i) => i >= 0);

/** Tuşun yetenek kimliği (heroes.js abilities: { q: 'okcu_shot', … }). */
export function abilityIdOf(heroId, key) {
  const H = HEROES()[heroKey(heroId)];
  return (H && H.abilities && H.abilities[key]) || `${heroKey(heroId)}_${key}`;
}

/** Kahramanın varyantları + hangi kademede açıldıkları + yerine geçtikleri yetenek kimliği. */
export function heroVariants(id) {
  const heroId = heroKey(id);
  return (VARIANTS[heroId] || []).map((v, n) => ({ ...v, ability: abilityIdOf(heroId, v.key), tier: VARIANT_TIERS[n] ?? MASTERY_TIERS.length - 1, tierName: (MASTERY_TIERS[VARIANT_TIERS[n]] || {}).name }));
}

/** { q: varyant } → { yetenekKimliği: varyant } (game.js g.variant(abilityId) böyle okur). */
function variantsByAbility(heroId, slots) {
  const out = {};
  for (const [k, v] of Object.entries(slots || {})) out[abilityIdOf(heroId, k)] = v;
  return out;
}

// ------------------------------------------------------------------ başlangıç çantaları
/**
 * Hepsi yaklaşık 300 altın değerinde: çanta bir güç değil bir tarz seçimidir. slots: her yuva bir aday listesi
 * (items.js'te ilk bulunan kimlik verilir); hiçbiri yoksa yuva `value` kadar altına dönüşür. gold: ek altın.
 * source: 'base' herkese açık · 'lib:<düğüm>' Kütüphane · 'mastery:<kahraman>' Archon kademesi.
 */
export const KITS = {
  k_basic: { id: 'k_basic', name: 'Tango Paketi', source: 'base', icon: 'tango',
    desc: 'Herkese açık klasik: bir Tango Paketi ve 250 altın.', slots: [{ items: ['tango'], value: 90 }], gold: 250 },
  k_purse: { id: 'k_purse', name: 'Altın Kese', source: 'lib:i_merchant', icon: 'coin',
    desc: '350 altın, eşya yok. Ne alacağına sahada karar ver.', slots: [], gold: 350 },
  k_wand: { id: 'k_wand', name: 'Değnekçi', source: 'lib:i_merchant', icon: 'spell',
    desc: 'Sihirli Sopa, Demir Dal ve 90 altın: Sihirli Değnek’e yarı yoldasın.', slots: [{ items: ['stick', 'magic_stick'], value: 200 }, { items: ['branch', 'branches', 'iron_branch'], value: 60 }], gold: 90 },
  k_boots: { id: 'k_boots', name: 'Aceleci', source: 'lib:i_courier', icon: 'courier',
    desc: 'Koşu Botları, başka bir şey yok. Kaçmak da bir stratejidir.', slots: [{ items: ['boots'], value: 350 }], gold: 0 },
  k_twin: { id: 'k_twin', name: 'Çifte Tango', source: 'lib:i_courier', icon: 'tango',
    desc: 'İki Tango Paketi, bir Demir Dal ve 110 altın: ağaç kemirerek dalga dalga.', slots: [{ items: ['tango'], value: 90 }, { items: ['tango'], value: 90 }, { items: ['branch', 'branches', 'iron_branch'], value: 60 }], gold: 110 },
  // Kahramana özel (Archon): ana özellik bileşeni — biraz daha değerli ama geç açılır
  k_okcu: { id: 'k_okcu', name: 'Avcı Sadağı', source: 'mastery:okcu', icon: 'bow',
    desc: 'Çevik Eşarp: çeviklik, zırh ve saldırı hızı. Mesafeyi koru, sürüyü dizle.', slots: [{ items: ['band', 'slippers'], value: 400 }], gold: 0 },
  k_balta: { id: 'k_balta', name: 'Kavga Heybesi', source: 'mastery:balta', icon: 'axe',
    desc: 'Kuvvet Kemeri: güç ve can. İlk DOG’u çağır, gerisi gelir.', slots: [{ items: ['belt', 'gauntlets'], value: 400 }], gold: 0 },
  k_buz: { id: 'k_buz', name: 'Kış Heybesi', source: 'mastery:buz', icon: 'frost',
    desc: 'Bilge Cübbesi: zekâ, mana ve büyü gücü.', slots: [{ items: ['robe', 'mantle'], value: 400 }], gold: 0 },
  k_golge: { id: 'k_golge', name: 'Pusu Heybesi', source: 'mastery:golge', icon: 'daggers',
    desc: 'Hız Eldiveni: saldırı hızı. Gölgeden çık, ilk vuruş senden.', slots: [{ items: ['gloves', 'band'], value: 450 }], gold: 0 },
  k_simsek: { id: 'k_simsek', name: 'Fırtına Heybesi', source: 'mastery:simsek', icon: 'bolt',
    desc: 'Bilge Cübbesi: her büyü bir sonraki şimşeği şarj eder.', slots: [{ items: ['robe', 'mantle'], value: 400 }], gold: 0 },
  k_agac: { id: 'k_agac', name: 'Kök Heybesi', source: 'mastery:agac', icon: 'treant',
    desc: 'Yenilenme Yüzüğü, Demir Dal ve Tango: yavaş ama sökülmez.', slots: [{ items: ['ring', 'ring_of_protection'], value: 250 }, { items: ['branch', 'branches'], value: 60 }, { items: ['tango'], value: 90 }], gold: 0 },
};
export const DEFAULT_KIT = 'k_basic';

/** items.js'te başlangıçta verilebilir bir eşya mı? (tarifli, düşen ve orman eşyaları verilmez) */
function itemExists(id) {
  const I = ITEMS()[id];
  return !!(I && !I.drop && I.kind !== 'recipe' && I.kind !== 'neutral' && I.kind !== 'drop' && !(Array.isArray(I.components) && I.components.length));
}
/** Eşyanın toplam değeri (items.js totalCost varsa tarif dahil). */
export function itemValue(id) {
  try { if (typeof ItemData.totalCost === 'function') return num(ItemData.totalCost(id)); } catch { /* yok say */ }
  return num((ITEMS()[id] || {}).cost);
}

/** Çantayı mevcut eşyalara çöz: { id, name, items: [kimlik], gold } — bilinmeyen kimlikler altına dönüşür. */
export function resolveKit(kitId) {
  const K = KITS[kitId] || KITS[DEFAULT_KIT];
  const items = [];
  let gold = Math.max(0, num(K.gold));
  for (const s of K.slots) {
    const hit = (s.items || []).find(itemExists);
    if (hit) items.push(hit);
    else gold += Math.max(0, num(s.value));
  }
  return { id: K.id, name: K.name, items, gold };
}

// ------------------------------------------------------------------ kozmetik
/** Hesap geneli kozmetikler (Kütüphane) + kahramana özel olanlar (ustalık). Oyun meta.cosmetics'ten okur. */
export const COSMETICS = {
  aura: {
    a_ember: { id: 'a_ember', name: 'Kor Aurası', color: '#ff6a2b', source: 'lib:c_ember' },
    a_arcane: { id: 'a_arcane', name: 'Arkana Aurası', color: '#8b7cff', source: 'lib:c_arcane' },
    a_dire: { id: 'a_dire', name: 'Dire Aurası', color: '#e0354b', source: 'lib:c_dire' },
    a_aegis: { id: 'a_aegis', name: 'Aegis Işıltısı', color: '#e9b949', source: 'lib:c_aegis', style: 'shine' },
  },
  trail: {
    t_sparks: { id: 't_sparks', name: 'Kıvılcım İzi', color: '#ff9a3d', kind: 'sparks', source: 'lib:c_sparks' },
    t_paws: { id: 't_paws', name: 'Pati İzi', color: '#e9b949', kind: 'paws', source: 'lib:c_paws' },
    t_river: { id: 't_river', name: 'Nehir İzi', color: '#5ab4ff', kind: 'water', source: 'lib:c_river' },
    t_ether: { id: 't_ether', name: 'Eterik İz', color: '#b18cff', kind: 'ether', source: 'lib:c_ether' },
  },
  courier: {
    cr_ghost: { id: 'cr_ghost', name: 'Hayalet Kurye', color: '#8fd8ff', source: 'lib:c_ghost' },
    cr_gold: { id: 'cr_gold', name: 'Altın Kurye', color: '#e9b949', source: 'lib:c_gold' },
  },
};
const HERO_TRAILS = {
  okcu: { name: 'Rüzgâr İzi', kind: 'leaves' },
  balta: { name: 'Kızıl Toz İzi', kind: 'dust' },
  buz: { name: 'Kırağı İzi', kind: 'frost' },
  golge: { name: 'Gölge İzi', kind: 'shadow' },
  simsek: { name: 'Şimşek İzi', kind: 'sparks' },
  agac: { name: 'Yaprak İzi', kind: 'leaves' },
};
const heroAura = (heroId) => ({ id: `aura_${heroId}`, name: `${heroInfo(heroId).name} Aurası`, color: heroInfo(heroId).color, hero: heroId });
const heroTrail = (heroId) => ({ id: `trail_${heroId}`, name: (HERO_TRAILS[heroId] || {}).name || `${heroInfo(heroId).name} İzi`,
  color: heroInfo(heroId).color, kind: (HERO_TRAILS[heroId] || {}).kind || 'sparks', hero: heroId });
const immortalAura = (heroId) => ({ id: `aura_immortal_${heroId}`, name: 'Ölümsüz Aurası', color: '#e0354b', color2: '#e9b949', style: 'immortal', hero: heroId });

// ------------------------------------------------------------------ Lanetler
/**
 * Lanet seviyeleri (Ascension/Heat tarzı, BİRİKİMLİ): N. seviye 1..N'nin tüm değiştiricilerini içerir.
 * modifiers: yalnızca o seviyenin eklediği · scoreMult / shardMult: o seviyedeki TOPLAM çarpan
 * (skor 1 + 0,12 × seviye → modifiers.scoreMul · Parıltı 1 + 0,1 × seviye).
 * Anahtarlar ve değerler Arena 3.0 game.js curseMods(seviye) ile birebir aynıdır (Node testi karşılaştırır).
 */
export const CURSES = [
  { id: 'c1', level: 1, name: 'Hızlı Sürü', icon: 'paw', modifiers: { enemySpeed: 1.1 }, scoreMult: 1.12, shardMult: 1.1,
    description: 'DOG’lar ve creep’ler %10 daha hızlı koşar. Kaçış planın varsa gözden geçir.' },
  { id: 'c2', level: 2, name: 'Kalın Post', icon: 'shield', modifiers: { enemyHp: 1.15 }, scoreMult: 1.24, shardMult: 1.2,
    description: 'Düşmanların canı %15 fazla. Kış gelmiş, postlar kalınlaşmış.' },
  { id: 'c3', level: 3, name: 'Pahalı Dükkân', icon: 'coin', modifiers: { shopCost: 1.2 }, scoreMult: 1.36, shardMult: 1.3,
    description: 'Dükkân fiyatları %20 artar. Enflasyon Dire’a da uğramış.' },
  { id: 'c4', level: 4, name: 'Uzun Geceler', icon: 'hourglass', modifiers: { dayLen: 60, nightLen: 180 }, scoreMult: 1.48, shardMult: 1.4,
    description: 'Gündüz 60, gece 180 saniye. Ward alan yok, Wardsız DOG’lar bayramda.' },
  { id: 'c5', level: 5, name: 'Kurye Grevde', icon: 'courier', modifiers: { noCourier: true }, scoreMult: 1.6, shardMult: 1.5,
    description: 'Kurye yok: eşyalar yalnızca çeşmede ya da molada gelir. Eşek sendika toplantısında.' },
  { id: 'c6', level: 6, name: 'Sert Isırık', icon: 'bone', modifiers: { enemyDmg: 1.2 }, scoreMult: 1.72, shardMult: 1.6,
    description: 'Düşman hasarı %20 artar. Isırıklar artık şaka değil.' },
  { id: 'c7', level: 7, name: 'Aç Roshan', icon: 'skull', modifiers: { roshanEvery: 4 }, scoreMult: 1.84, shardMult: 1.7,
    description: 'Boss dalgası her 5 yerine her 4 dalgada bir gelir. Kaya Canavarı erken acıkmış.' },
  { id: 'c8', level: 8, name: 'Elit Sürü', icon: 'crown', modifiers: { extraElites: 2 }, scoreMult: 1.96, shardMult: 1.8,
    description: 'Her dalgada iki elit DOG fazla. Smurf hesaplar çoğalıyor.' },
  { id: 'c9', level: 9, name: 'Ay Tutulması', icon: 'moon', modifiers: { alwaysNight: true }, scoreMult: 2.08, shardMult: 1.9,
    description: 'Hep gece: görüş kısa, karanlık uzun. Güneş bu maçı izlemiyor.' },
  { id: 'c10', level: 10, name: 'Dokuzun Laneti', icon: 'flame', modifiers: { gold: 0.75 }, scoreMult: 2.2, shardMult: 2.0,
    description: 'Altın %25 az: dokuz DOG, boş kese. Gerçek 1vDOQUZ sınavı.' },
];
export const MAX_CURSE = CURSES.length;
/** Lanet N açmak için N−1. seviyede ulaşılması gereken dalga (ya da hikâye görevinde zafer). */
export const CURSE_PROOF_WAVE = 5;

/**
 * Değiştirici anahtarları ve birleştirme kuralı (applyMeta runConfig.modifiers ile birleştirir). Hepsini Arena 3.0
 * game.js okur (g.mods); game.js ayrıca config.curse'ten curseMods üretir, açık modifiers onların üstüne yazar.
 */
export const MODIFIER_KEYS = {
  enemyHp: { rule: 'mul', text: 'Düşman canı çarpanı' },
  enemyDmg: { rule: 'mul', text: 'Düşman hasarı çarpanı' },
  enemySpeed: { rule: 'mul', text: 'Düşman hareket hızı çarpanı' },
  bossHp: { rule: 'mul', text: 'Boss canı çarpanı' },
  heroHp: { rule: 'mul', text: 'Kahraman canı çarpanı (ustalık)' },
  heroDmg: { rule: 'mul', text: 'Kahraman hasarı çarpanı (ustalık)' },
  gold: { rule: 'mul', text: 'Altın kazancı çarpanı' },
  xp: { rule: 'mul', text: 'XP çarpanı' },
  shopCost: { rule: 'mul', text: 'Dükkân fiyat çarpanı' },
  scoreMul: { rule: 'mul', text: 'Skor çarpanı (Lanet)' },
  startGold: { rule: 'add', text: 'Başlangıç altını (çanta)' },
  startLevel: { rule: 'max', text: 'Başlangıç seviyesi' },
  extraElites: { rule: 'add', text: 'Dalga başına ek elit DOG' },
  roshanEvery: { rule: 'min', text: 'Boss dalgası aralığı (varsayılan 5)' },
  dayLen: { rule: 'min', text: 'Gündüz süresi (sn)' },
  nightLen: { rule: 'max', text: 'Gece süresi (sn)' },
  noCourier: { rule: 'or', text: 'Kurye yok: eşyalar yalnızca çeşmede / molada' },
  alwaysNight: { rule: 'or', text: 'Hep gece' },
  noCamps: { rule: 'or', text: 'Orman kampları kapalı' },
  noBuyback: { rule: 'or', text: 'Geri alma (buyback) yok' },
  autoLearn: { rule: 'or', text: 'Yetenek puanları kendiliğinden dağıtılır' },
};

/** Seviye bilgisi (0 = lanetsiz). */
export function curseInfo(level) {
  const L = int(level, 0, MAX_CURSE);
  if (!L) return { id: 'c0', level: 0, name: 'Lanetsiz', icon: 'shield', modifiers: {}, scoreMult: 1, shardMult: 1, description: 'Arena’nın bildiğin hâli.' };
  return CURSES[L - 1];
}

/** N. seviyenin birikimli değiştiricileri (1..N). */
export function curseModifiers(level) {
  const L = int(level, 0, MAX_CURSE);
  let out = {};
  for (let i = 0; i < L; i++) out = mergeModifiers(out, CURSES[i].modifiers);
  return out;
}

/** Değiştirici nesnelerini MODIFIER_KEYS kurallarına göre birleştirir (bilinmeyen anahtar: sonraki kazanır). */
export function mergeModifiers(...list) {
  const out = {};
  for (const m of list) {
    if (!isObj(m)) continue;
    for (const [k, v] of Object.entries(m)) {
      if (v == null) continue;
      const rule = MODIFIER_KEYS[k] ? MODIFIER_KEYS[k].rule : 'set';
      if (!own(out, k)) { out[k] = v; continue; }
      const a = out[k];
      if (rule === 'mul') out[k] = +(num(a, 1) * num(v, 1)).toFixed(6);
      else if (rule === 'add') out[k] = num(a) + num(v);
      else if (rule === 'max') out[k] = Math.max(num(a), num(v));
      else if (rule === 'min') out[k] = Math.min(num(a, Infinity), num(v, Infinity));
      else if (rule === 'or') out[k] = !!a || !!v;
      else out[k] = v;
    }
  }
  return out;
}

// ------------------------------------------------------------------ Kodeks kataloğu (veri)
export const CODEX_KINDS = [
  { id: 'units', name: 'Birimler', icon: 'paw' },
  { id: 'bosses', name: 'Bosslar', icon: 'skull' },
  { id: 'items', name: 'Eşyalar', icon: 'coin' },
  { id: 'story', name: 'Hikâye', icon: 'book' },
];
export const DOG_IDS = ['feed', 'farm', 'pause', 'afk', 'kurye', 'rapier', 'mid', 'ward', 'smurf', 'chat'];
const DOG_NAMES = { feed: 'Feed Köpeği', farm: 'Farm Köpeği', pause: 'Pause Köpeği', afk: 'AFK Köpeği', kurye: 'Kurye Köpeği',
  rapier: 'Rapier Köpeği', mid: 'Mid ya da Feed Köpeği', ward: 'Ward’sız Destek Köpeği', smurf: 'Smurf Köpeği', chat: 'Chat Köpeği' };
const DOG_COLORS = { feed: '#e0354b', farm: '#43d6a0', pause: '#8b7cff', afk: '#5fb9c9', kurye: '#e9b949', rapier: '#f6d98a',
  mid: '#ff9a3d', ward: '#c46bff', smurf: '#53d8fb', chat: '#ff6a2b' };

const STATIC_CODEX = {
  units: [
    ...DOG_IDS.map((t) => ({ id: `dog_${t}`, name: DOG_NAMES[t], group: 'DOG', dog: t, color: DOG_COLORS[t], icon: 'paw' })),
    { id: 'creep_melee', name: 'Dire Piyadesi', group: 'Creep', color: '#e0354b', icon: 'shield',
      desc: 'Kalkanlı, inatçı, en yakın Radiant kulesine yürür. Yanına girersen işi bırakıp sana döner.',
      lore: 'Kurye diyor ki: “Bunlar DOG değil, sadece kötü günlerinde.”' },
    { id: 'creep_ranged', name: 'Dire Büyücüsü', group: 'Creep', color: '#8b7cff', icon: 'orbs',
      desc: 'Arkadan küre fırlatır; piyadeler önde, o hep bir adım geride.',
      lore: 'Kurye diyor ki: “Kürenin rengi mor ama niyeti kara.”' },
    { id: 'neutral_wolf', name: 'Orman Kurdu', group: 'Orman', color: '#8fb3a8', icon: 'wolf',
      desc: 'Kemik kolyeli, sarı gözlü kamp kurdu. Kampını farm’layana “Yine mi sen?” bakışı atar.',
      lore: 'Kurye diyor ki: “DOG olmasına bir adım kala ormana kaçmış. Akıllı çocuk.”' },
    { id: 'neutral_alpha', name: 'Alfa Kurt', group: 'Orman', color: '#c9b8a0', icon: 'wolf',
      desc: 'Kurt İni’nin reisi: daha iri, daha sabırsız. Önce o saldırır, sürü arkasından gelir.',
      lore: 'Kurye diyor ki: “Alfa demek, ilk ölen demek değil. Feed Alfa’yla karıştırma.”' },
    { id: 'neutral_harpy', name: 'Harpi', group: 'Orman', color: '#5fb9c9', icon: 'harpy',
      desc: 'Turkuaz tüylü kuş-kadın. Kampına yaklaşanı tepeden süzer, sonra bütün sürüyle dalar.',
      lore: 'Kurye diyor ki: “Farm bedava değildir. Bunu ilk o öğretir.”' },
    { id: 'tower_dire', name: 'Dire Kulesi', group: 'Yapı', color: '#e0354b', icon: 'towerDire',
      desc: 'Kilitlenir, 0,8 sn düşünür, sonra acıtır. Menzil halkası kırmızıysa uzak dur.',
      lore: 'Kurye diyor ki: “Tower dive yapan kahramanlar anısına.”' },
  ],
  bosses: [
    { id: 'boss_roshan', name: 'Kaya Canavarı', group: 'Roshan', color: '#e9b949', icon: 'skull',
      desc: 'Her 5. dalgada çukurundan çıkar. Yere vuruş ve kükreme; düşünce Aegis ve Peynir bırakır.',
      lore: 'Kurye diyor ki: “Peyniri paylaşmayı bilmeyen bir takım asla lanet kıramaz.”' },
    { id: 'boss_feedalfa', name: 'Feed Alfa', group: 'I. bölüm', color: '#e0354b', icon: 'paw',
      desc: 'Dev bir Feed Köpeği. Kendini düşünmeden üstüne atar; sürü onun izinden gider.',
      lore: 'Kurye diyor ki: “İlk kanı hep o verir. Kendi kanını.”' },
    { id: 'boss_shadow', name: 'Gölge Ulusu', group: 'II. bölüm', color: '#c46bff', icon: 'eye',
      desc: 'Wardsız DOG’ların lideri. Karanlıkta görünmez; ışığa çıkarsan küçülür.',
      lore: 'Kurye diyor ki: “Bir ward, bin kelimeye bedel.”' },
    { id: 'boss_general', name: 'Dire Generali', group: 'III. bölüm', color: '#e0354b', icon: 'greatsword',
      desc: 'Kara-kızıl zırhlı komutan, boyundan büyük tırtıklı kılıç. Emirleri kısa: “Dalın.”',
      lore: 'Kurye diyor ki: “Salon II’deki Balta’ya çok benziyor. Aile meselesi, karışmayalım.”' },
    { id: 'boss_ancient', name: 'Sonsuz Pub’ın Kalbi', group: 'V. bölüm', color: '#ff6a2b', icon: 'ancient',
      desc: 'Boynuzlu obsidyen anıtın ortasında atan kızıl kristal. Lanetin kaynağı.',
      lore: 'Kurye diyor ki: “Yirmi dört saat oldu. Isınma turu bitti.”' },
  ],
  story: [
    { id: 'ch1', name: 'I · Nehir Kıyısı', group: 'Bölüm', color: '#43d6a0', icon: 'book',
      desc: 'Nehrin iki yakasında bitmeyen bir maç. İlk DOG’lar kıyıya vurur; Kurye sana eşlik eder.' },
    { id: 'ch2', name: 'II · Wardsız Orman', group: 'Bölüm', color: '#8b7cff', icon: 'book',
      desc: 'Gece çöker, orman kampları uyanır. Ward alınmayan her gece bir ruh daha kaybolur.' },
    { id: 'ch3', name: 'III · Kule Kuşatması', group: 'Bölüm', color: '#e0354b', icon: 'book',
      desc: 'Radiant kuleleri kuşatma altında. Dire Generali dokuz DOG’un başında.' },
    { id: 'ch4', name: 'IV · Roshan’ın İni', group: 'Bölüm', color: '#e9b949', icon: 'book',
      desc: 'Aegis’i kazanmadan kalbe ulaşamazsın. Kaya Canavarı ininde bekliyor.' },
    { id: 'ch5', name: 'V · 1vDOQUZ', group: 'Bölüm', color: '#ff6a2b', icon: 'book',
      desc: 'Sonsuz Pub’ın kalbi. Dokuz DOG lordu, son kule, tek kahraman.' },
  ],
};
const registered = { units: [], bosses: [], items: [], story: [] };

/** Hikâye ajanı / oyun yeni Kodeks girdileri ekleyebilir: [{ id, name, desc?, lore?, group?, color?, icon? }] */
export function registerCodex(kind, entries) {
  const k = normKind(kind);
  if (!k || !Array.isArray(entries)) return 0;
  let n = 0;
  for (const e of entries) {
    if (!e || typeof e.id !== 'string') continue;
    const list = registered[k];
    const i = list.findIndex((x) => x.id === e.id);
    if (i >= 0) list[i] = { ...list[i], ...e };
    else { list.push({ ...e }); n++; }
  }
  notify();
  return n;
}

function normKind(kind) {
  const k = String(kind || '').toLowerCase();
  if (k === 'unit' || k === 'units' || k === 'dog' || k === 'creep' || k === 'neutral') return 'units';
  if (k === 'boss' || k === 'bosses') return 'bosses';
  if (k === 'item' || k === 'items') return 'items';
  if (k === 'story' || k === 'card' || k === 'cards' || k === 'chapter') return 'story';
  return null;
}

const BOSS_ALIASES = { roshan: 'boss_roshan', rosh: 'boss_roshan', alfa: 'boss_feedalfa', feedalfa: 'boss_feedalfa',
  feed_alfa: 'boss_feedalfa', ulus: 'boss_shadow', golgeulusu: 'boss_shadow', shadow: 'boss_shadow', shadowlord: 'boss_shadow',
  general: 'boss_general', diregeneral: 'boss_general', dire_general: 'boss_general', ancient: 'boss_ancient',
  heart: 'boss_ancient', kalp: 'boss_ancient', core: 'boss_ancient' };

/** Kodeks kimliği: 'feed' → 'dog_feed', 'roshan' → 'boss_roshan', 'melee' → 'creep_melee' … */
export function codexId(kind, rawId) {
  const k = normKind(kind);
  let id = String(rawId == null ? '' : rawId).trim().slice(0, 64);
  if (!k || !id) return null;
  if (k === 'units') {
    if (DOG_IDS.includes(id)) return `dog_${id}`;
    if (id === 'melee' || id === 'ranged') return `creep_${id}`;
    if (id === 'wolf' || id === 'harpy' || id === 'alpha') return `neutral_${id}`;
  }
  if (k === 'bosses') {
    const key = id.replace(/^boss_/, '').toLowerCase();
    if (BOSS_ALIASES[key]) return BOSS_ALIASES[key];
    if (!id.startsWith('boss_')) id = `boss_${id}`;
  }
  return id;
}

/** Kodeks kataloğu: { units: [...], bosses, items, story } — eşyalar çalışma anında items.js'ten okunur. */
export function codexCatalog() {
  const kindName = { consumable: 'Tüketilebilir', basic: 'Temel', recipe: 'Tarifli', drop: 'Düşen' };
  const items = Object.values(ITEMS())
    .filter((I) => I && typeof I.id === 'string')
    .map((I) => ({ id: I.id, name: I.name || I.id, desc: I.desc || '', group: I.drop ? 'Düşen' : kindName[I.kind] || (I.tier ? `Kademe ${I.tier}` : 'Eşya'),
      icon: I.icon, glyph: I.glyph, color: I.color, item: true, cost: itemValue(I.id) }));
  const neutrals = isObj(ItemData.NEUTRALS) ? Object.values(ItemData.NEUTRALS) : [];
  for (const N of neutrals) {
    if (!N || typeof N.id !== 'string' || items.some((x) => x.id === N.id)) continue;
    items.push({ id: N.id, name: N.name || N.id, desc: N.desc || '', group: `Orman eşyası · ${N.tier || 1}. kademe`, icon: N.icon, glyph: N.glyph, color: N.color, item: true, neutral: true });
  }
  const merge = (base, extra) => {
    const out = base.map((e) => ({ ...e }));
    for (const e of extra) {
      const i = out.findIndex((x) => x.id === e.id);
      if (i >= 0) out[i] = { ...out[i], ...e };
      else out.push({ ...e });
    }
    return out;
  };
  return {
    units: merge(STATIC_CODEX.units, registered.units),
    bosses: merge(STATIC_CODEX.bosses, registered.bosses),
    items: merge(items, registered.items),
    story: merge(STATIC_CODEX.story, registered.story),
  };
}

// ------------------------------------------------------------------ Aghanim Kütüphanesi (düğüm ağacı)
export const BRANCHES = [
  { id: 'heroes', name: 'Kahramanlar', icon: 'user', color: '#43d6a0', desc: 'Yeni kahramanlar ve kahraman seçimi seçenekleri.' },
  { id: 'items', name: 'Eşya havuzları', icon: 'coin', color: '#e9b949', desc: 'Başlangıç çantaları ve orman eşyası seçenekleri.' },
  { id: 'curses', name: 'Lanetler', icon: 'skull', color: '#e0354b', desc: 'İsteğe bağlı zorluk: daha çok skor, daha çok Parıltı.' },
  { id: 'cosmetics', name: 'Kozmetik', icon: 'sparkle', color: '#8b7cff', desc: 'Aura, iz, kurye ve damga. Güç yok, stil çok.' },
  { id: 'codex', name: 'Kodeks', icon: 'book', color: '#5ab4ff', desc: 'Koleksiyon ödülleri ve bilgi araçları.' },
];

/** Kahraman açma bedeli: ilk açılan 300, ikincisi 450 (sonrakiler 450). */
export const HERO_UNLOCK_COSTS = [300, 450];

/**
 * Düğümler. row/col: ağaçtaki yer (col 0–2). type: hero | buy | curse | claim.
 * req: hepsi gerekli · reqAny: biri yeterli. cost: Parıltı bedeli · reward: claim ödülü.
 */
export const NODES = [
  // Kahramanlar
  { id: 'h_simsek', branch: 'heroes', type: 'hero', hero: 'simsek', name: 'Şimşek Ruhu', icon: 'bolt', row: 0, col: 0,
    desc: 'Hareketli büyücü: kalıntı bırakır, girdapla çeker, yıldırım topuna dönüşüp sürünün içinden geçer.' },
  { id: 'h_agac', branch: 'heroes', type: 'hero', hero: 'agac', name: 'Ağaç Bekçisi', icon: 'treant', row: 0, col: 2,
    desc: 'Dayanıklı destek: kökleriyle bağlar ve sömürür, kabuğunu zırha çevirir, ormanı sürünün üstüne yıkar.' },
  { id: 'h_random', branch: 'heroes', type: 'buy', name: 'Rastgele Seçim', icon: 'dice', row: 1, col: 1, cost: 200, reqAny: ['h_simsek', 'h_agac'],
    desc: 'Seçim ekranında “Rastgele”: açık kahramanlardan biri gelir, koşu +%15 Parıltı ve +%10 ustalık XP’si verir.' },
  { id: 'h_legacy', branch: 'heroes', type: 'buy', name: 'Ustalık Mirası', icon: 'medal', row: 2, col: 1, cost: 350, req: ['h_random'],
    desc: 'Legend altındaki kahramanlar +%25 ustalık XP’si kazanır. Yeni açtığın kahraman çabuk yetişir.' },
  // Eşya havuzları
  { id: 'i_merchant', branch: 'items', type: 'buy', name: 'Tüccar Heybesi', icon: 'coin', row: 0, col: 0, cost: 120, kits: ['k_purse', 'k_wand'],
    desc: 'İki yeni başlangıç çantası: Altın Kese (300 altın) ve Değnekçi (Sihirli Değnek + 50 altın).' },
  { id: 'i_courier', branch: 'items', type: 'buy', name: 'Kurye Heybesi', icon: 'courier', row: 1, col: 0, cost: 250, req: ['i_merchant'], kits: ['k_boots', 'k_twin'],
    desc: 'İki yeni başlangıç çantası: Aceleci (Koşu Botları) ve Çifte Tango (iki Tango, dal, 70 altın).' },
  { id: 'i_neutral1', branch: 'items', type: 'buy', name: 'Orman Sandığı', icon: 'wolf', row: 0, col: 2, cost: 200, pools: { neutralChoice: 2 },
    desc: 'Orman kampı eşya düşürünce iki seçenek arasından birini seçersin.' },
  { id: 'i_neutral2', branch: 'items', type: 'buy', name: 'Harpi Hazinesi', icon: 'harpy', row: 1, col: 2, cost: 400, req: ['i_neutral1'], pools: { neutralChoice: 3 },
    desc: 'Orman eşyası düşünce üç seçenek.' },
  { id: 'i_neutral3', branch: 'items', type: 'buy', name: 'Yaşlı Koru Takası', icon: 'treant', row: 2, col: 1, cost: 600, req: ['i_neutral2'], pools: { neutralReroll: 1 },
    desc: 'Her molada orman eşyanı aynı kademeden başka biriyle bir kez takas edebilirsin.' },
  // Lanetler (yılan yol: 1→2→3 / 6←5←4 / 7→8→9 / 10)
  ...CURSES.map((C, i) => {
    const pos = [[0, 0], [0, 1], [0, 2], [1, 2], [1, 1], [1, 0], [2, 0], [2, 1], [2, 2], [3, 1]][i];
    return { id: `curse_${C.level}`, branch: 'curses', type: 'curse', curse: C.level, name: `Lanet ${C.level}`, sub: C.name, icon: C.icon,
      row: pos[0], col: pos[1], cost: [70, 115, 170, 240, 320, 410, 520, 640, 780, 980][i], req: i ? [`curse_${C.level - 1}`] : [], desc: C.description };
  }),
  // Kozmetik (sütunlar: aura · iz · kurye/damga)
  { id: 'c_ember', branch: 'cosmetics', type: 'buy', name: 'Kor Aurası', icon: 'flame', row: 0, col: 0, cost: 120, cosmetic: ['aura', 'a_ember'],
    desc: 'Ayaklarının altında kor turuncusu bir halka. Her kahramana takılabilir.' },
  { id: 'c_arcane', branch: 'cosmetics', type: 'buy', name: 'Arkana Aurası', icon: 'orbs', row: 1, col: 0, cost: 180, req: ['c_ember'], cosmetic: ['aura', 'a_arcane'],
    desc: 'Mor arkana halkası. Buz Cadısı’nda ayrı güzel durur.' },
  { id: 'c_dire', branch: 'cosmetics', type: 'buy', name: 'Dire Aurası', icon: 'towerDire', row: 2, col: 0, cost: 250, req: ['c_arcane'], cosmetic: ['aura', 'a_dire'],
    desc: 'Düşmanın rengini giy. Kızıl, dikenli, havalı.' },
  { id: 'c_aegis', branch: 'cosmetics', type: 'buy', name: 'Aegis Işıltısı', icon: 'shield', row: 3, col: 0, cost: 420, req: ['c_dire'], cosmetic: ['aura', 'a_aegis'],
    desc: 'Altın, parıldayan halka. Aegis’in yoksa bile varmış gibi yürü.' },
  { id: 'c_sparks', branch: 'cosmetics', type: 'buy', name: 'Kıvılcım İzi', icon: 'sparkle', row: 0, col: 1, cost: 200, cosmetic: ['trail', 't_sparks'],
    desc: 'Koşarken ardında kıvılcımlar bırakırsın.' },
  { id: 'c_paws', branch: 'cosmetics', type: 'buy', name: 'Pati İzi', icon: 'paw', row: 1, col: 1, cost: 280, req: ['c_sparks'], cosmetic: ['trail', 't_paws'],
    desc: 'Arkanda altın pati izleri. DOG’lar kimin peşinde olduğunu bilsin.' },
  { id: 'c_river', branch: 'cosmetics', type: 'buy', name: 'Nehir İzi', icon: 'compass', row: 2, col: 1, cost: 360, req: ['c_paws'], cosmetic: ['trail', 't_river'],
    desc: 'Nehir suyu gibi akan mavi bir iz.' },
  { id: 'c_ether', branch: 'cosmetics', type: 'buy', name: 'Eterik İz', icon: 'eye', row: 3, col: 1, cost: 480, req: ['c_river'], cosmetic: ['trail', 't_ether'],
    desc: 'Yarı saydam, mor, biraz ürkütücü. Gölge’ye çok yakışır.' },
  { id: 'c_ghost', branch: 'cosmetics', type: 'buy', name: 'Hayalet Kurye', icon: 'courier', row: 0, col: 2, cost: 340, cosmetic: ['courier', 'cr_ghost'],
    desc: 'Kurye yarı saydam, soluk mavi. Ölen kurye memesinin kendisi.' },
  { id: 'c_gold', branch: 'cosmetics', type: 'buy', name: 'Altın Kurye', icon: 'crown', row: 1, col: 2, cost: 500, req: ['c_ghost'], cosmetic: ['courier', 'cr_gold'],
    desc: 'Altın kanatlı eşek. Eşyaları aynı hızda getirir ama daha havalı.' },
  { id: 'c_stamp', branch: 'cosmetics', type: 'buy', name: 'DOG DOG DOG Damgası', icon: 'paw', row: 2, col: 2, cost: 300, cosmetic: ['stamp', true],
    desc: 'Üçlü ve üstü öldürmelerde ekrana “DOG DOG DOG” damgası basılır.' },
  // Kodeks
  { id: 'x_dogs', branch: 'codex', type: 'claim', name: 'Dokuz Artı Bir', icon: 'paw', row: 0, col: 0, reward: 30, claim: { kind: 'units', ids: DOG_IDS.map((t) => `dog_${t}`) },
    desc: 'On DOG türünün hepsini Kodeks’e kaydet.' },
  { id: 'x_lens', branch: 'codex', type: 'buy', name: 'Kâşif Dürbünü', icon: 'search', row: 0, col: 1, cost: 150,
    desc: 'Kodeks’te henüz görmediğin girdilerin silueti ve ipucu görünür.' },
  { id: 'x_items', branch: 'codex', type: 'claim', name: 'Dükkân Kataloğu', icon: 'coin', row: 0, col: 2, reward: 40, claim: { kind: 'items', shop: true, count: 20 },
    desc: 'Dükkândan 20 farklı eşyayı en az bir kez edin.' },
  { id: 'x_units', branch: 'codex', type: 'claim', name: 'Bestiyer', icon: 'wolf', row: 1, col: 0, reward: 40, req: ['x_dogs'], claim: { kind: 'units', all: true },
    desc: 'Tüm birimleri (DOG’lar, creep’ler, orman canavarları, kuleler) kaydet.' },
  { id: 'x_lore', branch: 'codex', type: 'buy', name: 'Kurye’nin Notları', icon: 'pen', row: 1, col: 1, cost: 250, req: ['x_lens'],
    desc: 'Gördüğün her girdiye Kurye’nin kısa notu eklenir. Bilgi, dedikodu, biraz da serzeniş.' },
  { id: 'x_bosses', branch: 'codex', type: 'claim', name: 'Boss Avcısı', icon: 'skull', row: 1, col: 2, reward: 80, claim: { kind: 'bosses', all: true },
    desc: 'Bütün bossları Kodeks’e kaydet: Roshan’dan Sonsuz Pub’ın Kalbi’ne.' },
  { id: 'x_story', branch: 'codex', type: 'claim', name: 'Lanetin Hikâyesi', icon: 'book', row: 2, col: 1, reward: 100, claim: { kind: 'story', all: true },
    desc: 'Bütün hikâye kartlarını topla. Kurye anlatmayı sever.' },
];
const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n]));
export const nodeOf = (id) => NODE_BY_ID.get(id) || null;

// ------------------------------------------------------------------ kayıt (localStorage)
function freshProfile(now = Date.now()) {
  return {
    v: META_VERSION,
    created: now,
    updated: now,
    shards: 0,
    earned: 0,
    spent: 0,
    heroes: {},
    unlocks: {},
    curse: 0,
    proof: {},
    codex: { units: {}, bosses: {}, items: {}, story: {} },
    firsts: {},
    story: {},
    daily: {},
    stats: { runs: 0, bestWave: 0, bosses: 0, shardsFromRuns: 0 },
    global: { courier: null, stamp: false },
    last: null,
    lastGrant: null,
    pendingPicks: {},
  };
}

const safeKey = (k) => typeof k === 'string' && k.length <= 64 && !/^(__proto__|constructor|prototype)$/.test(k);
function tsMap(src, max = 500) {
  const out = {};
  if (!isObj(src)) return out;
  let n = 0;
  for (const [k, v] of Object.entries(src)) {
    if (!safeKey(k) || n >= max) continue;
    out[k] = Math.max(1, Math.floor(num(v, 1)));
    n++;
  }
  return out;
}

function sanitizeLoadout(src) {
  const L = isObj(src) ? src : {};
  const variants = {};
  if (isObj(L.variants)) for (const [k, v] of Object.entries(L.variants)) if (/^[qwer]$/.test(k) && typeof v === 'string' && v.length <= 48) variants[k] = v;
  const str = (v) => (typeof v === 'string' && v.length <= 48 ? v : null);
  return { variants, kit: str(L.kit), aura: str(L.aura), trail: str(L.trail) };
}

/** Kaydı doğrular/temizler (içe aktarma ve bozuk veriye karşı). */
export function sanitizeProfile(src, now = Date.now()) {
  const P = freshProfile(now);
  if (!isObj(src)) return P;
  P.created = Math.floor(num(src.created, now)) || now;
  P.updated = Math.floor(num(src.updated, now)) || now;
  P.shards = int(src.shards, 0, 1e7);
  P.earned = Math.max(P.shards, int(src.earned, 0, 1e8));
  P.spent = int(src.spent, 0, 1e8);
  if (isObj(src.heroes)) {
    for (const [id, h] of Object.entries(src.heroes)) {
      if (!safeKey(id) || !isObj(h)) continue;
      P.heroes[id] = { xp: int(h.xp, 0, 1e7), runs: int(h.runs, 0, 1e7), best: int(h.best, 0, 1e9), bestWave: int(h.bestWave, 0, 9999),
        loadout: sanitizeLoadout(h.loadout) };
    }
  }
  P.unlocks = tsMap(src.unlocks, 200);
  P.curse = int(src.curse, 0, MAX_CURSE);
  if (isObj(src.proof)) for (const [k, v] of Object.entries(src.proof)) { const L = int(k, -1, MAX_CURSE, -1); if (L >= 0) P.proof[L] = int(v, 0, 9999); }
  if (isObj(src.codex)) for (const k of ['units', 'bosses', 'items', 'story']) P.codex[k] = tsMap(src.codex[k], 400);
  P.firsts = tsMap(src.firsts, 300);
  if (isObj(src.story)) for (const [k, v] of Object.entries(src.story)) if (safeKey(k)) P.story[k] = int(v, 0, 3);
  if (isObj(src.daily)) {
    const days = Object.keys(src.daily).map(Number).filter(Number.isFinite).sort((a, b) => b - a).slice(0, 40);
    for (const d of days) P.daily[d] = 1;
  }
  if (isObj(src.stats)) {
    P.stats.runs = int(src.stats.runs, 0, 1e7);
    P.stats.bestWave = int(src.stats.bestWave, 0, 9999);
    P.stats.bosses = int(src.stats.bosses, 0, 1e7);
    P.stats.shardsFromRuns = int(src.stats.shardsFromRuns, 0, 1e9);
  }
  if (isObj(src.global)) {
    P.global.courier = typeof src.global.courier === 'string' && src.global.courier.length <= 48 ? src.global.courier : null;
    P.global.stamp = !!src.global.stamp;
  }
  if (isObj(src.last)) {
    P.last = { heroId: typeof src.last.heroId === 'string' ? src.last.heroId.slice(0, 32) : null, curse: int(src.last.curse, 0, MAX_CURSE),
      mode: ['endless', 'story', 'daily'].includes(src.last.mode) ? src.last.mode : 'endless', random: !!src.last.random,
      missionId: typeof src.last.missionId === 'string' ? src.last.missionId.slice(0, 48) : null, at: Math.floor(num(src.last.at, 0)) };
  }
  if (isObj(src.lastGrant) && typeof src.lastGrant.sig === 'string') {
    P.lastGrant = { sig: src.lastGrant.sig.slice(0, 200), at: Math.floor(num(src.lastGrant.at, 0)), rewards: isObj(src.lastGrant.rewards) ? src.lastGrant.rewards : null };
  }
  if (isObj(src.pendingPicks)) for (const [k, v] of Object.entries(src.pendingPicks)) if (safeKey(k) && k.startsWith('arena:')) P.pendingPicks[k] = int(v, 0, 1e6);
  return P;
}

/**
 * Sürüm göçü. v1 bugünkü biçim. v0 (geliştirme taslağı, sürüm alanı yok): { shards, xp: { kahraman: sayı } } →
 * v1'e taşınır. Gelecek bir sürüm (v > 1) okunabilen alanlarıyla kullanılır ama üzerine yazılmaz (bkz. load).
 */
export function migrate(raw, now = Date.now()) {
  if (!isObj(raw)) return null;
  const v = Math.floor(num(raw.v, 0));
  if (v === 0) {
    const heroes = {};
    const xp = isObj(raw.xp) ? raw.xp : isObj(raw.heroes) ? raw.heroes : {};
    for (const [id, x] of Object.entries(xp)) if (safeKey(id)) heroes[id] = { xp: isObj(x) ? x.xp : x };
    return sanitizeProfile({ ...raw, v: 1, heroes }, now);
  }
  return sanitizeProfile(raw, now);
}

let cache = null;
let readOnlyFuture = false;
const subs = new Set();

/**
 * Arena 2.0 mirası: meta kaydı ilk kez oluşturulurken eski koşular küçük bir hoş geldin hediyesine dönüşür
 * (koşu başına 6 Parıltı, en çok 150) ve kahraman rekorları ustalık XP’sine (rekor / 40, en çok 450).
 */
function legacyGift(P, now) {
  const s = ls.get('arena:v2', null);
  if (!isObj(s) || s.v !== 2) return;
  const runs = int(s.runs, 0, 1e6);
  const gift = Math.min(150, runs * 6);
  if (gift > 0) { P.shards += gift; P.earned += gift; }
  if (isObj(s.bests)) {
    for (const [id, best] of Object.entries(s.bests)) {
      if (!safeKey(id)) continue;
      const h = heroRec(P, id);
      h.xp = Math.max(h.xp, Math.min(450, Math.floor(num(best) / 40)));
      h.best = Math.max(h.best, int(best, 0, 1e9));
    }
  }
  if (runs > 0) P.firsts.legacy = now;
}

function load() {
  if (cache) return cache;
  const now = Date.now();
  const raw = ls.get(META_KEY, null);
  if (raw == null) {
    const P = freshProfile(now);
    legacyGift(P, now);
    cache = P;
    ls.set(META_KEY, P);
    return P;
  }
  readOnlyFuture = isObj(raw) && num(raw.v, 0) > META_VERSION;
  cache = migrate(raw, now) || freshProfile(now);
  return cache;
}

function save(P) {
  P.updated = Date.now();
  cache = P;
  if (!readOnlyFuture) ls.set(META_KEY, P);
  notify();
}

let notifyTimer = 0;
function notify() {
  if (!subs.size) return;
  if (typeof setTimeout !== 'function') return;
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    const view = getProfile();
    for (const fn of subs) { try { fn(view); } catch (e) { console.error(e); } }
  }, 0);
}

/** İlerleme değişince fn(profil) — kapatma fonksiyonu döner. */
export function subscribeMeta(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

// Başka sekmede değişen kayıt: önbelleği bırak ve bildir
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', (e) => {
    if (e.key === META_STORAGE_KEY || e.key === null) { cache = null; notify(); }
  });
}

/** Önbelleği bırakıp kaydı yeniden okur (testler / içe aktarma sonrası). */
export function reloadMeta() { cache = null; return getProfile(); }
/** Ham kaydın kopyası (dışa aktarma). Profil sayfası zaten tüm csk: anahtarlarını dışa aktarır. */
export function exportMeta() { return JSON.parse(JSON.stringify(load())); }
/** Dışarıdan gelen kaydı doğrulayıp yazar. */
export function importMeta(obj) {
  const P = migrate(obj);
  if (!P) return false;
  readOnlyFuture = false;
  save(P);
  return true;
}
/** Kaydı siler (geliştirme / “Sıfırla”). */
export function resetMeta() {
  ls.remove(META_KEY);
  cache = null;
  readOnlyFuture = false;
  notify();
}

// ------------------------------------------------------------------ profil yardımcıları
function heroRec(P, heroId) {
  if (!P.heroes[heroId]) P.heroes[heroId] = { xp: 0, runs: 0, best: 0, bestWave: 0, loadout: sanitizeLoadout(null) };
  return P.heroes[heroId];
}
const owns = (P, nodeId) => own(P.unlocks, nodeId);

function heroUnlockedIn(P, heroId) {
  if (!heroIds().includes(heroId)) return false;
  if (!isLockable(heroId)) return true;
  return owns(P, `h_${heroId}`);
}

function curseMaxOf(P) {
  let m = 0;
  for (let L = 1; L <= MAX_CURSE; L++) { if (owns(P, `curse_${L}`)) m = L; else break; }
  return m;
}

/** Kütüphane'den gelen havuz seçenekleri: { neutralChoice: 1–3, neutralReroll: 0–1 } */
function poolsOf(P) {
  const out = { neutralChoice: 1, neutralReroll: 0 };
  for (const n of NODES) {
    if (!n.pools || !owns(P, n.id)) continue;
    for (const [k, v] of Object.entries(n.pools)) out[k] = Math.max(out[k] || 0, v);
  }
  return out;
}

/** Kahraman için açık çantalar (kimlik listesi). */
function kitsFor(P, heroId) {
  const tier = rankOf(heroRec(P, heroId).xp).tier;
  const kitTier = MASTERY_TIERS.findIndex((t) => t.grants.some((g) => g.type === 'kit'));
  return Object.values(KITS).filter((K) => {
    if (K.source === 'base') return true;
    if (K.source.startsWith('lib:')) return owns(P, K.source.slice(4));
    if (K.source.startsWith('mastery:')) return K.source.slice(8) === heroId && tier >= kitTier;
    return false;
  }).map((K) => K.id);
}

function aurasFor(P, heroId) {
  const tier = rankOf(heroRec(P, heroId).xp).tier;
  const out = [];
  const auraTier = MASTERY_TIERS.findIndex((t) => t.grants.some((g) => g.type === 'aura'));
  const immTier = MASTERY_TIERS.findIndex((t) => t.grants.some((g) => g.type === 'immortal'));
  if (tier >= auraTier) out.push(heroAura(heroId));
  for (const A of Object.values(COSMETICS.aura)) if (owns(P, A.source.slice(4))) out.push(A);
  if (tier >= immTier) out.push(immortalAura(heroId));
  return out;
}

function trailsFor(P, heroId) {
  const tier = rankOf(heroRec(P, heroId).xp).tier;
  const out = [];
  const trailTier = MASTERY_TIERS.findIndex((t) => t.grants.some((g) => g.type === 'trail'));
  if (tier >= trailTier) out.push(heroTrail(heroId));
  for (const T of Object.values(COSMETICS.trail)) if (owns(P, T.source.slice(4))) out.push(T);
  return out;
}

function couriersOf(P) {
  return Object.values(COSMETICS.courier).filter((C) => owns(P, C.source.slice(4)));
}

/** Kademe geçişinde açılanlar: [{ kind, id, name, heroId, tier }] */
function grantsOf(heroId, tierIdx) {
  const T = MASTERY_TIERS[tierIdx];
  if (!T) return [];
  const out = [];
  for (const g of T.grants) {
    if (g.type === 'variant') {
      const V = (VARIANTS[heroId] || [])[g.n];
      if (V) out.push({ kind: 'variant', id: V.id, name: V.name, key: V.key, heroId, tier: T.name });
    } else if (g.type === 'kit') {
      const K = KITS[`k_${heroId}`];
      if (K) out.push({ kind: 'kit', id: K.id, name: K.name, heroId, tier: T.name });
    } else if (g.type === 'aura') {
      const A = heroAura(heroId); out.push({ kind: 'aura', id: A.id, name: A.name, color: A.color, heroId, tier: T.name });
    } else if (g.type === 'trail') {
      const R = heroTrail(heroId); out.push({ kind: 'trail', id: R.id, name: R.name, color: R.color, heroId, tier: T.name });
    } else if (g.type === 'immortal') {
      const A = immortalAura(heroId); out.push({ kind: 'aura', id: A.id, name: A.name, color: A.color, heroId, tier: T.name });
      out.push({ kind: 'title', id: `title_${heroId}`, name: 'Ölümsüz unvanı', heroId, tier: T.name });
    } else if (g.type === 'stat') {
      const label = { hp: 'can', dmg: 'hasar', gold: 'altın' }[g.stat] || g.stat;
      out.push({ kind: 'stat', id: `${g.stat}+${g.pct}`, name: `+%${g.pct} ${label}`, heroId, tier: T.name });
    }
  }
  return out;
}

/** Kaydedilmiş seçimi (loadout) mevcut açıklara göre düzeltir. */
function effectiveLoadout(P, heroId) {
  const h = heroRec(P, heroId);
  const L = h.loadout || sanitizeLoadout(null);
  const tier = rankOf(h.xp).tier;
  const variants = {};
  for (const V of heroVariants(heroId)) if (tier >= V.tier && L.variants && L.variants[V.key] === V.id) variants[V.key] = V.id;
  const kits = kitsFor(P, heroId);
  const kit = L.kit && kits.includes(L.kit) ? L.kit : DEFAULT_KIT;
  const auras = aurasFor(P, heroId);
  const aura = L.aura ? auras.find((a) => a.id === L.aura) || null : null;
  const trails = trailsFor(P, heroId);
  const trail = L.trail ? trails.find((t) => t.id === L.trail) || null : null;
  return { variants, kit, aura, trail };
}

// ------------------------------------------------------------------ düğüm durumu
function codexComplete(P, claim) {
  const cat = codexCatalog()[claim.kind] || [];
  let ids;
  if (claim.ids) ids = claim.ids;
  else if (claim.shop) {
    const shop = Array.isArray(ItemData.SHOP) ? ItemData.SHOP : cat.map((e) => e.id);
    ids = shop.filter((id) => ITEMS()[id]);
  } else ids = cat.map((e) => e.id);
  const seen = P.codex[claim.kind] || {};
  const have = ids.filter((id) => own(seen, id)).length;
  const total = claim.count ? Math.min(claim.count, ids.length) : ids.length;
  return { have: Math.min(have, total), total, done: total > 0 && have >= total };
}

function heroCost(P, heroId) {
  if (heroUnlockedIn(P, heroId) || !isLockable(heroId)) return 0;
  const bought = heroIds().filter((id) => isLockable(id) && owns(P, `h_${id}`) && !(P.firsts[`free_${id}`])).length;
  return HERO_UNLOCK_COSTS[Math.min(bought, HERO_UNLOCK_COSTS.length - 1)];
}

/**
 * Düğüm durumu: { state, cost, reward, reqText, progress }
 * state: owned (alındı) · ready (alınabilir) · poor (Parıltı yetmiyor) · locked (koşul eksik) ·
 *        claimable (ödül hazır) · claimed (ödül alındı)
 */
function statusIn(P, id) {
  const n = nodeOf(id);
  if (!n) return { state: 'locked', cost: 0, reward: 0, reqText: 'Bilinmeyen düğüm' };
  const cost = n.type === 'hero' ? heroCost(P, n.hero) : num(n.cost);
  const base = { id, cost, reward: num(n.reward), reqText: '', progress: null };
  if (n.type === 'claim') {
    if (owns(P, id)) return { ...base, state: 'claimed' };
    const c = codexComplete(P, n.claim);
    base.progress = { have: c.have, total: c.total };
    const reqOk = !(n.req || []).some((r) => !owns(P, r));
    if (!reqOk) return { ...base, state: 'locked', reqText: `Önce: ${(n.req || []).map((r) => (nodeOf(r) || {}).name).join(', ')}` };
    return { ...base, state: c.done ? 'claimable' : 'locked', reqText: c.done ? '' : `Kodeks: ${c.have}/${c.total}` };
  }
  if (n.type === 'hero' ? heroUnlockedIn(P, n.hero) : owns(P, id)) return { ...base, state: 'owned', cost: n.type === 'hero' ? 0 : cost };
  const missing = (n.req || []).filter((r) => !owns(P, r));
  if (missing.length) return { ...base, state: 'locked', reqText: `Önce: ${missing.map((r) => { const x = nodeOf(r); return x ? (x.type === 'curse' ? x.name : x.name) : r; }).join(', ')}` };
  if (n.reqAny && !n.reqAny.some((r) => (nodeOf(r) && nodeOf(r).type === 'hero' ? heroUnlockedIn(P, nodeOf(r).hero) : owns(P, r)))) {
    return { ...base, state: 'locked', reqText: `Önce biri: ${n.reqAny.map((r) => (nodeOf(r) || {}).name).join(' ya da ')}` };
  }
  if (n.type === 'curse') {
    const prev = n.curse - 1;
    const best = num(P.proof[prev], 0);
    base.progress = { have: Math.min(best, CURSE_PROOF_WAVE), total: CURSE_PROOF_WAVE };
    if (best < CURSE_PROOF_WAVE) {
      return { ...base, state: 'locked', reqText: prev ? `Lanet ${prev} ile ${CURSE_PROOF_WAVE}. dalgaya ulaş (en iyi: ${best})` : `Lanetsiz bir koşuda ${CURSE_PROOF_WAVE}. dalgaya ulaş (en iyi: ${best})` };
    }
  }
  return { ...base, state: P.shards >= cost ? 'ready' : 'poor' };
}

/** Tek düğümün durumu (arayüz). */
export function nodeStatus(id) { return statusIn(load(), id); }

/** Tüm düğümler + durumları (arayüz için). */
export function libraryState() {
  const P = load();
  return {
    shards: P.shards,
    earned: P.earned,
    branches: BRANCHES.map((B) => {
      const nodes = NODES.filter((n) => n.branch === B.id).map((n) => ({ ...n, status: statusIn(P, n.id) }));
      const done = nodes.filter((n) => n.status.state === 'owned' || n.status.state === 'claimed').length;
      return { ...B, nodes, done, total: nodes.length };
    }),
  };
}

// ------------------------------------------------------------------ satın alma
/**
 * Kütüphane düğümünü al (ya da Kodeks ödülünü topla).
 * → { ok, reason?: 'owned'|'locked'|'poor'|'unknown', cost?, reward?, need?, node }
 */
export function buyNode(id) {
  const P = load();
  const n = nodeOf(id);
  if (!n) return { ok: false, reason: 'unknown' };
  const st = statusIn(P, id);
  if (st.state === 'owned' || st.state === 'claimed') return { ok: false, reason: 'owned', node: n };
  if (n.type === 'claim') {
    if (st.state !== 'claimable') return { ok: false, reason: 'locked', text: st.reqText, node: n };
    const reward = num(n.reward);
    P.shards += reward;
    P.earned += reward;
    P.unlocks[id] = Date.now();
    save(P);
    return { ok: true, reward, node: n, balance: P.shards };
  }
  if (st.state === 'locked') return { ok: false, reason: 'locked', text: st.reqText, node: n };
  if (P.shards < st.cost) return { ok: false, reason: 'poor', need: st.cost - P.shards, cost: st.cost, node: n };
  P.shards -= st.cost;
  P.spent += st.cost;
  P.unlocks[id] = Date.now();
  // Yeni açılan Lanet bir sonraki koşu için seçili gelmez: oyuncu kendisi seçer (isteğe bağlı zorluk)
  save(P);
  return { ok: true, cost: st.cost, node: n, balance: P.shards };
}

/** Kahramanın kilidi açık mı? (Arena 2.0'ın dört kahramanı her zaman açık; bilinmeyen kimlik: false) */
export function isHeroUnlocked(heroId) { return heroUnlockedIn(load(), heroKey(heroId)); }

/** Kilitli kahramanın şu anki açma bedeli (açıksa ya da kilitlenebilir değilse 0). */
export function unlockCost(heroId) { return heroCost(load(), heroKey(heroId)); }

/**
 * Kahramanı aç. free: true → bedelsiz (ör. hikâye bölümü ödülü; bedelli sıralamayı etkilemez).
 * → { ok, reason?, cost }
 */
export function unlockHero(id, { free = false, source = '' } = {}) {
  const heroId = heroKey(id);
  const P = load();
  if (!heroIds().includes(heroId)) return { ok: false, reason: 'unknown', cost: 0 };
  if (heroUnlockedIn(P, heroId)) return { ok: false, reason: 'owned', cost: 0 };
  if (free) {
    P.unlocks[`h_${heroId}`] = Date.now();
    P.firsts[`free_${heroId}`] = Date.now();
    if (source) P.firsts[`src_${heroId}_${String(source).slice(0, 20)}`] = Date.now();
    save(P);
    return { ok: true, cost: 0 };
  }
  if (!nodeOf(`h_${heroId}`)) {
    // heroes.js'e sonradan eklenen (ağaçta düğümü olmayan) kilitli kahraman
    const cost = heroCost(P, heroId);
    if (P.shards < cost) return { ok: false, reason: 'poor', cost, need: cost - P.shards };
    P.shards -= cost; P.spent += cost; P.unlocks[`h_${heroId}`] = Date.now();
    save(P);
    return { ok: true, cost };
  }
  const r = buyNode(`h_${heroId}`);
  return { ok: r.ok, reason: r.reason, cost: r.cost ?? 0, need: r.need };
}

// ------------------------------------------------------------------ seçimler (sonraki koşu)
/** Kahramanın sonraki koşu seçimleri. patch: { variants: { q: id|null }, kit, aura, trail } */
export function setLoadout(id, patch = {}) {
  const heroId = heroKey(id);
  const P = load();
  if (!heroIds().includes(heroId)) return null;
  const h = heroRec(P, heroId);
  const L = { ...sanitizeLoadout(h.loadout), variants: { ...(h.loadout && h.loadout.variants) } };
  if (isObj(patch.variants)) {
    for (const [k, v] of Object.entries(patch.variants)) {
      if (!/^[qwer]$/.test(k)) continue;
      if (v == null || v === false) delete L.variants[k];
      else if ((VARIANTS[heroId] || []).some((V) => V.id === v && V.key === k)) L.variants[k] = v;
    }
  }
  if ('kit' in patch) L.kit = typeof patch.kit === 'string' && KITS[patch.kit] ? patch.kit : null;
  if ('aura' in patch) L.aura = typeof patch.aura === 'string' ? patch.aura.slice(0, 48) : null;
  if ('trail' in patch) L.trail = typeof patch.trail === 'string' ? patch.trail.slice(0, 48) : null;
  h.loadout = L;
  save(P);
  return effectiveLoadout(P, heroId);
}

/** Hesap geneli kozmetik seçimleri: { courier: id|null, stamp: bool } */
export function setGlobalCosmetics(patch = {}) {
  const P = load();
  if ('courier' in patch) P.global.courier = typeof patch.courier === 'string' && couriersOf(P).some((c) => c.id === patch.courier) ? patch.courier : null;
  if ('stamp' in patch) P.global.stamp = !!patch.stamp && owns(P, 'c_stamp');
  save(P);
  return { ...P.global };
}

/** Sonraki koşunun Lanet seviyesi (açılan en yüksek seviyeye kırpılır). */
export function setCurse(level) {
  const P = load();
  P.curse = int(level, 0, curseMaxOf(P));
  save(P);
  return P.curse;
}
export function getCurse() { const P = load(); return Math.min(P.curse, curseMaxOf(P)); }
export function curseMax() { return curseMaxOf(load()); }

// ------------------------------------------------------------------ profil görünümü
/** Tek kahramanın özeti (ustalık paneli). */
export function heroSummary(heroId) {
  const P = load();
  return summaryIn(P, heroKey(heroId));
}

function summaryIn(P, heroId) {
  const info = heroInfo(heroId);
  const h = P.heroes[heroId] || { xp: 0, runs: 0, best: 0, bestWave: 0, loadout: sanitizeLoadout(null) };
  const r = rankOf(h.xp);
  const variants = heroVariants(heroId).map((V) => ({ ...V, unlocked: r.tier >= V.tier }));
  const kits = kitsFor(P, heroId);
  return {
    ...info,
    xp: r.xp,
    rank: r.name,
    tier: r.tier,
    rankInfo: r,
    unlocked: heroUnlockedIn(P, heroId),
    cost: heroCost(P, heroId),
    runs: h.runs,
    best: h.best,
    bestWave: h.bestWave,
    variants: variants.filter((v) => v.unlocked).map((v) => v.id),
    variantList: variants,
    kits: Object.values(KITS).filter((K) => K.source === 'base' || K.source.startsWith('lib:') || K.source === `mastery:${heroId}`)
      .map((K) => ({ ...K, unlocked: kits.includes(K.id), resolved: resolveKit(K.id) })),
    auras: aurasFor(P, heroId),
    trails: trailsFor(P, heroId),
    stats: masteryStats(r.tier),
    loadout: effectiveLoadout(P, heroId),
    tiers: MASTERY_TIERS.map((T, i) => ({ ...T, index: i, reached: r.tier >= i, grantsList: grantsOf(heroId, i) })),
  };
}

/**
 * Oyuncunun meta profili:
 * { shards, earned, spent, heroes: { [id]: { xp, rank, tier, variants, unlocked, … } }, unlocks, curseMax, curse,
 *   codex: { units: [id], bosses, items, story, counts: { units: {have,total}, … } }, stats, global, neutralTier }
 */
export function getProfile() {
  const P = load();
  const heroes = {};
  for (const id of heroIds()) {
    const s = summaryIn(P, id);
    heroes[id] = { id, name: s.name, color: s.color, xp: s.xp, rank: s.rank, tier: s.tier, next: s.rankInfo.next, pct: s.rankInfo.pct,
      variants: s.variants, unlocked: s.unlocked, lockable: s.lockable, cost: s.cost, runs: s.runs, best: s.best, bestWave: s.bestWave,
      loadout: s.loadout };
  }
  const cat = codexCatalog();
  const codex = { counts: {} };
  for (const k of ['units', 'bosses', 'items', 'story']) {
    codex[k] = Object.keys(P.codex[k] || {});
    codex.counts[k] = { have: cat[k].filter((e) => own(P.codex[k] || {}, e.id)).length, total: cat[k].length };
  }
  return {
    version: META_VERSION,
    shards: P.shards,
    earned: P.earned,
    spent: P.spent,
    heroes,
    unlocks: { ...P.unlocks },
    curseMax: curseMaxOf(P),
    curse: Math.min(P.curse, curseMaxOf(P)),
    proof: { ...P.proof },
    pools: poolsOf(P),
    codex,
    stats: { ...P.stats },
    global: { ...P.global },
    story: { ...P.story },
  };
}

// ------------------------------------------------------------------ koşu yapılandırması
let session = { at: 0, codex: [] };

/**
 * Koşu yapılandırmasına kalıcı ilerlemeyi uygular; YENİ bir runConfig döndürür (girdi değişmez).
 * Girdi: { mode, heroId, seed, curse?, random?, allowLocked?, modifiers?, meta?, missionId?, … }
 * Çıktı ek alanları:
 *   heroId  kilitliyse ilk açık kahramana düşer (allowLocked: hikâye misafir kahramanı) · random: Rastgele Seçim
 *   curse   verilmezse Sonsuz modda oyuncunun seçtiği Lanet (setCurse), diğer modlarda 0; açılan en yüksek
 *           seviyeye kırpılır (günlük modda gelen değer kırpılmadan kullanılır, 0–10)
 *   modifiers  runConfig.modifiers × Lanet değiştiricileri × ustalık (heroHp/heroDmg/gold) + çanta altını (startGold)
 *   meta    { version, heroId, mode, fair, curse: {level,name,scoreMult,shardMult}, startItems, startGold, kit,
 *             mastery: { tier, rank, color, xp, hpPct, dmgPct, goldPct }, variants: { q|w|e|r: varyantId },
 *             cosmetics: { aura, trail, courier, stamp, title }, pools: { neutralTier }, random }
 * Günlük modda (herkes aynı koşulda) ustalık bonusu, varyant ve özel çanta uygulanmaz; kozmetik uygulanır.
 */
export function applyMeta(runConfig = {}) {
  const P = load();
  const input = isObj(runConfig) ? runConfig : {};
  const cfg = { ...input };
  const mode = ['endless', 'story', 'daily'].includes(input.mode) ? input.mode : 'endless';
  const fair = mode === 'daily';
  cfg.mode = mode;

  // kahraman: açık VE oyunun tanıdığı (heroes.js) kahramanlar oynanabilir
  const playable = (id) => !!HEROES()[id] && (heroUnlockedIn(P, id) || (!!input.allowLocked && id === heroKey(input.heroId)));
  const unlocked = heroIds().filter((id) => !!HEROES()[id] && heroUnlockedIn(P, id));
  let heroId = heroKey(typeof input.heroId === 'string' ? input.heroId : (P.last && P.last.heroId) || BASE_HEROES[0]);
  let random = false;
  let fallbackFrom = null;
  if (input.random && owns(P, 'h_random') && !fair && unlocked.length) {
    const rnd = seeded(hashStr(`rastgele:${input.seed ?? Date.now()}:${P.stats.runs}`));
    heroId = unlocked[Math.floor(rnd() * unlocked.length)];
    random = true;
  }
  if (!playable(heroId)) {
    fallbackFrom = heroId;
    heroId = unlocked[0] || BASE_HEROES[0];
  }
  cfg.heroId = heroId;
  cfg.random = random;

  // lanet
  // Seçili Lanet yalnızca Sonsuz modun varsayılanıdır; hikâye/günlük kendi değerini açıkça vermeli
  const want = input.curse != null ? input.curse : mode === 'endless' ? P.curse : 0;
  const curse = fair ? int(want, 0, MAX_CURSE) : int(want, 0, curseMaxOf(P));
  const C = curseInfo(curse);
  cfg.curse = curse;

  // ustalık, varyant, çanta, kozmetik
  const h = heroRec(P, heroId);
  const r = rankOf(h.xp);
  const stats = fair ? { hpPct: 0, dmgPct: 0, goldPct: 0 } : masteryStats(r.tier);
  const L = effectiveLoadout(P, heroId);
  const kit = resolveKit(fair ? DEFAULT_KIT : L.kit);
  const courierId = P.global.courier;
  const courier = courierId ? couriersOf(P).find((c) => c.id === courierId) || null : null;
  const cosmetics = {
    aura: L.aura ? { ...L.aura } : null,
    trail: L.trail ? { ...L.trail } : null,
    courier: courier ? { ...courier } : null,
    stamp: !!(P.global.stamp && owns(P, 'c_stamp')),
    title: r.id === 'immortal' ? 'Ölümsüz' : null,
  };
  const masteryMods = {};
  if (stats.hpPct) masteryMods.heroHp = 1 + stats.hpPct / 100;
  if (stats.dmgPct) masteryMods.heroDmg = 1 + stats.dmgPct / 100;
  if (stats.goldPct) masteryMods.gold = 1 + stats.goldPct / 100;
  if (kit.gold) masteryMods.startGold = kit.gold;
  const curseMods = { ...curseModifiers(curse) };
  if (curse) curseMods.scoreMul = C.scoreMult;
  cfg.modifiers = mergeModifiers(isObj(input.modifiers) ? input.modifiers : {}, curseMods, masteryMods);

  cfg.meta = {
    ...(isObj(input.meta) ? input.meta : {}),
    version: META_VERSION,
    heroId,
    mode,
    fair,
    curse: { level: curse, name: C.name, scoreMult: C.scoreMult, shardMult: C.shardMult },
    startItems: kit.items.slice(),
    startGold: kit.gold,
    kit: { id: kit.id, name: kit.name },
    mastery: { tier: r.tier, rank: r.name, color: r.color, xp: r.xp, ...stats },
    variants: fair ? {} : variantsByAbility(heroId, L.variants),
    variantSlots: fair ? {} : { ...L.variants },
    cosmetics,
    pools: poolsOf(P),
    random,
  };
  if (fallbackFrom) cfg.meta.heroFallback = fallbackFrom;

  P.last = { heroId, curse, mode, random, missionId: typeof input.missionId === 'string' ? input.missionId.slice(0, 48) : null, at: Date.now() };
  session = { at: Date.now(), codex: [] };
  save(P);
  return cfg;
}

// ------------------------------------------------------------------ ödüller
/** Ekonomi sabitleri (docs/ARENA-ILERLEME.md → Ekonomi; scratch simülasyonuyla ayarlandı). */
export const ECONOMY = {
  participation: 2, // her koşu
  perWave: 3.5, // temizlenen dalga başına
  waveSq: 0.15, // + temizlenen² × 0.15 (derin koşu ödülü)
  perBoss: 10, // Roshan / boss
  storyBase: 10, // hikâye görevi
  perStar: 10, // yıldız başına (her oynayışta)
  firstStar: 25, // ilk kez kazanılan yıldız başına
  daily: 40, // günlük meydan okuma (günde bir kez, sabit)
  randomMult: 1.15, // Rastgele Seçim
  chapter: 50, // hikâye bölümü ilk bitiş (recordStoryChapter)
  firsts: { run: 10, wave5: 15, wave10: 30, wave15: 50, wave20: 80, boss: 20, heroWave5: 10, cursePerLevel: 10 },
  xp: { base: 10, perWave: 8, perBoss: 10, storyBase: 20, perStar: 15, cursePct: 5, randomMult: 1.1, legacyMult: 1.25, cap: 600 },
};

/** runEnd yükünü (ve eksik alanları son applyMeta'dan) normalleştirir. */
function normalizeResult(res, last) {
  const R = isObj(res) ? res : {};
  const S = isObj(R.stats) ? R.stats : {};
  const L = last || {};
  const mode = ['endless', 'story', 'daily'].includes(R.mode) ? R.mode : L.mode || 'endless';
  const heroId = heroKey(typeof R.heroId === 'string' ? R.heroId : typeof S.heroId === 'string' ? S.heroId : L.heroId || BASE_HEROES[0]);
  const wave = int(R.wave != null ? R.wave : S.wave, 0, 999);
  const victory = !!(R.victory || S.victory);
  const stars = int(R.stars != null ? R.stars : S.stars, 0, 3, victory ? 1 : 0);
  const roshans = int(S.roshanKills != null ? S.roshanKills : S.roshans, 0, 100);
  const bosses = S.bossKills != null ? int(S.bossKills, 0, 100) : S.bosses != null ? int(S.bosses, 0, 100) : roshans;
  const curse = R.curse != null ? int(R.curse, 0, MAX_CURSE) : int(L.curse, 0, MAX_CURSE);
  const random = R.random != null ? !!R.random : !!L.random;
  const missionId = typeof R.missionId === 'string' ? R.missionId.slice(0, 48) : L.missionId || null;
  const items = Array.isArray(S.items) ? S.items.filter((x) => typeof x === 'string').slice(0, 12) : [];
  return { mode, heroId, wave, victory, stars: mode === 'story' ? stars : 0, bosses, roshans, curse, random, missionId, items,
    score: Math.max(0, Math.floor(num(R.score != null ? R.score : S.score))), kills: int(S.kills, 0, 1e6), time: num(S.time, 0), day: R.day };
}

/** Ödül hesabı (saf; simülasyon ve testler de kullanır). P değişmez. */
export function computeRewards(result, profile) {
  const P = profile || freshProfile();
  const r = normalizeResult(result, P.last);
  const E = ECONOMY;
  const lines = [];
  const C = curseInfo(r.curse);
  const cleared = r.victory ? r.wave : Math.max(0, r.wave - 1);
  let base = 0;
  if (r.mode === 'story') {
    base += E.storyBase; lines.push({ label: 'Görev', value: E.storyBase });
    if (r.stars) { base += E.perStar * r.stars; lines.push({ label: `Yıldız × ${r.stars}`, value: E.perStar * r.stars }); }
  } else {
    base += E.participation; lines.push({ label: 'Katılım', value: E.participation });
    const w = Math.round(E.perWave * cleared + Math.floor(E.waveSq * cleared * cleared));
    if (w) { base += w; lines.push({ label: `Temizlenen dalga × ${cleared}`, value: w }); }
  }
  if (r.bosses) { base += E.perBoss * r.bosses; lines.push({ label: `Roshan / boss × ${r.bosses}`, value: E.perBoss * r.bosses }); }
  let mult = C.shardMult;
  if (r.random) mult *= E.randomMult;
  const runShards = Math.round(base * mult);
  if (C.level) lines.push({ label: `Lanet ${C.level} · ${C.name}`, value: `×${String(C.shardMult).replace('.', ',')}`, mult: true });
  if (r.random) lines.push({ label: 'Rastgele Seçim', value: `×${String(E.randomMult).replace('.', ',')}`, mult: true });

  let bonus = 0;
  const firsts = [];
  const first = (key, value, label) => {
    if (own(P.firsts, key) || !value) return;
    firsts.push({ key, value, label });
    bonus += value;
  };
  const F = E.firsts;
  first('run', F.run, 'İlk koşun');
  if (r.mode !== 'story') {
    if (r.wave >= 5) first('wave5', F.wave5, 'İlk kez 5. dalga');
    if (r.wave >= 10) first('wave10', F.wave10, 'İlk kez 10. dalga');
    if (r.wave >= 15) first('wave15', F.wave15, 'İlk kez 15. dalga');
    if (r.wave >= 20) first('wave20', F.wave20, 'İlk kez 20. dalga');
    if (r.wave >= 5) first(`hero5_${r.heroId}`, F.heroWave5, `${heroInfo(r.heroId).name} ile ilk 5. dalga`);
  }
  if (r.bosses) first('boss', F.boss, 'İlk boss avın');
  const proven = r.mode === 'story' ? r.victory : r.wave >= CURSE_PROOF_WAVE;
  if (r.curse && proven && r.mode !== 'daily') first(`curse${r.curse}`, F.cursePerLevel * r.curse, `Lanet ${r.curse} ile ilk ${r.mode === 'story' ? 'zafer' : '5. dalga'}`);

  let starBonus = 0;
  let newStars = 0;
  if (r.mode === 'story' && r.missionId) {
    const prev = num(P.story[r.missionId], 0);
    newStars = Math.max(0, r.stars - prev);
    starBonus = newStars * E.firstStar;
    if (starBonus) lines.push({ label: `İlk kez kazanılan yıldız × ${newStars}`, value: starBonus });
  }
  let daily = 0;
  const day = r.day != null ? Math.floor(num(r.day)) : istanbulDay();
  if (r.mode === 'daily' && !own(P.daily, day)) { daily = E.daily; lines.push({ label: 'Günlük meydan okuma', value: daily }); }
  for (const f of firsts) lines.push({ label: f.label, value: f.value, first: true });

  const shards = runShards + bonus + starBonus + daily;

  // ustalık XP'si
  const X = E.xp;
  let heroXp = 0;
  const known = heroIds().includes(r.heroId);
  if (known) {
    const xpBase = r.mode === 'story'
      ? X.storyBase + X.perStar * r.stars + X.perBoss * r.bosses
      : X.base + X.perWave * Math.min(cleared, 40) + X.perBoss * r.bosses;
    const tier = rankOf((P.heroes[r.heroId] || { xp: 0 }).xp).tier;
    let m = 1 + (X.cursePct / 100) * r.curse;
    if (r.random) m *= X.randomMult;
    if (own(P.unlocks, 'h_legacy') && tier < LEGEND_TIER) m *= X.legacyMult;
    heroXp = Math.min(X.cap, Math.round(xpBase * m));
  }
  return { r, shards, runShards, bonus, starBonus, newStars, daily, day, heroXp, lines, firsts, cleared, proven };
}

/**
 * Koşu sonu ödüllerini hesaplar, KAYDEDER ve döndürür.
 * result = runEnd yükü: { mode, score, wave, heroId, stats: { kills, bossKills?, roshans|roshanKills, gold, level, items, … },
 *          victory?, stars?, missionId?, curse?, random? } — mode/curse/random yoksa son applyMeta'dan alınır.
 * → { shards, heroXp, rankUp?, unlocked: [...], newCodex: [...], affordable: [...], breakdown, firsts, balance,
 *     hero: { id, xp, tier, rank, pct, next }, heroBefore, curse, mode, duplicate }
 */
export function grantRunRewards(result) {
  const P = load();
  const now = Date.now();
  const pre = normalizeResult(result, P.last);
  const sig = [pre.mode, pre.heroId, pre.score, pre.wave, pre.kills, Math.round(pre.time * 10), pre.missionId || '', pre.stars].join('|');
  if (P.lastGrant && P.lastGrant.sig === sig && now - P.lastGrant.at < 30 * 60e3 && P.lastGrant.rewards) {
    return { ...P.lastGrant.rewards, duplicate: true };
  }
  const beforeAfford = new Set(NODES.filter((n) => statusIn(P, n.id).state === 'ready').map((n) => n.id));
  const c = computeRewards(result, P);
  const r = c.r;

  // bakiye + ilkler
  P.shards += c.shards;
  P.earned += c.shards;
  P.stats.shardsFromRuns += c.shards;
  for (const f of c.firsts) P.firsts[f.key] = now;
  if (r.mode === 'story' && r.missionId) P.story[r.missionId] = Math.max(num(P.story[r.missionId], 0), r.stars);
  if (c.daily) {
    P.daily[c.day] = 1;
    const days = Object.keys(P.daily).map(Number).sort((a, b) => b - a);
    for (const d of days.slice(40)) delete P.daily[d];
  }
  P.stats.runs += 1;
  P.stats.bosses += r.bosses;
  if (r.mode === 'endless') P.stats.bestWave = Math.max(P.stats.bestWave, r.wave);

  // Lanet kanıtı (bir sonraki seviyenin kilidi)
  const unlocked = [];
  // Günlük meydan okumanın laneti oyuncunun seçimi değildir: Lanet kanıtı sayılmaz
  const proofWave = r.mode === 'daily' ? 0 : r.mode === 'story' ? (r.victory ? CURSE_PROOF_WAVE : 0) : r.wave;
  const prevProof = num(P.proof[r.curse], 0);
  if (proofWave > prevProof) P.proof[r.curse] = proofWave;
  if (prevProof < CURSE_PROOF_WAVE && proofWave >= CURSE_PROOF_WAVE && r.curse < MAX_CURSE && !owns(P, `curse_${r.curse + 1}`)) {
    unlocked.push({ kind: 'curse', id: `curse_${r.curse + 1}`, name: `Lanet ${r.curse + 1} · ${CURSES[r.curse].name}`, text: 'Kütüphane’de açılabilir' });
  }

  // ustalık
  let rankUp = null;
  let heroBefore = null;
  let hero = null;
  if (heroIds().includes(r.heroId)) {
    const h = heroRec(P, r.heroId);
    const before = rankOf(h.xp);
    heroBefore = { id: r.heroId, xp: before.xp, tier: before.tier, rank: before.name, pct: before.pct };
    h.xp += c.heroXp;
    h.runs += 1;
    if (r.mode === 'endless') { h.best = Math.max(h.best, r.score); h.bestWave = Math.max(h.bestWave, r.wave); }
    const after = rankOf(h.xp);
    hero = { id: r.heroId, name: heroInfo(r.heroId).name, color: heroInfo(r.heroId).color, xp: after.xp, tier: after.tier, rank: after.name,
      rankColor: after.color, pct: after.pct, next: after.next, nextName: after.nextName, into: after.into, need: after.need };
    if (after.tier > before.tier) {
      rankUp = { heroId: r.heroId, from: before.name, to: after.name, tier: after.tier, color: after.color };
      for (let t = before.tier + 1; t <= after.tier; t++) unlocked.push(...grantsOf(r.heroId, t));
    }
  }

  // Kodeks: bu koşuda ilk kez görülenler (+ envanter + boss)
  for (const id of r.items) markIn(P, 'items', id, now);
  if (r.roshans) markIn(P, 'bosses', 'boss_roshan', now);
  const cat = codexCatalog();
  const newCodex = session.codex.filter((e, i, a) => a.findIndex((x) => x.kind === e.kind && x.id === e.id) === i)
    .map((e) => ({ ...e, name: ((cat[e.kind] || []).find((x) => x.id === e.id) || {}).name || e.id }));
  session.codex = [];

  // Rozet/görev seçimleri (store.me.picks): en yüksek kanıtlanmış Lanet
  if (r.curse && c.proven && r.mode !== 'daily') pickMax(P, 'arena:lanet', r.curse);

  const affordable = NODES.filter((n) => !beforeAfford.has(n.id) && statusIn(P, n.id).state === 'ready')
    .map((n) => ({ id: n.id, name: n.name, cost: statusIn(P, n.id).cost, branch: n.branch }));

  const rewards = {
    shards: c.shards,
    heroXp: c.heroXp,
    rankUp,
    unlocked,
    newCodex,
    affordable,
    breakdown: c.lines,
    firsts: c.firsts.map((f) => ({ key: f.key, label: f.label, value: f.value })),
    balance: P.shards,
    hero,
    heroBefore,
    curse: r.curse,
    mode: r.mode,
    stars: r.stars,
    newStars: c.newStars,
    duplicate: false,
  };
  P.lastGrant = { sig, at: now, rewards };
  save(P);
  return rewards;
}

/**
 * Hikâye bölümü ilk kez bitti (hikâye ajanı çağırır): +50 Parıltı (bir kez), Kodeks kartı ve
 * rozetler için store.me.picks['arena:story'] = en yüksek biten bölüm (1–5). → { shards, first }
 */
export function recordStoryChapter(chapter) {
  const n = int(chapter, 0, 99);
  if (!n) return { shards: 0, first: false };
  const P = load();
  const key = `chapter${n}`;
  let shards = 0;
  const first = !own(P.firsts, key);
  if (first) { shards = ECONOMY.chapter; P.shards += shards; P.earned += shards; P.firsts[key] = Date.now(); }
  markIn(P, 'story', `ch${n}`, Date.now());
  pickMax(P, 'arena:story', n);
  save(P);
  return { shards, first };
}

// ------------------------------------------------------------------ Kodeks işaretleme
let flushTimer = 0;
function markIn(P, kind, id, now) {
  const k = normKind(kind);
  const cid = codexId(k, id);
  if (!k || !cid || !safeKey(cid)) return false;
  if (!P.codex[k]) P.codex[k] = {};
  if (own(P.codex[k], cid)) return false;
  P.codex[k][cid] = now;
  session.codex.push({ kind: k, id: cid });
  return true;
}

/** Kodeks: görüldü olarak işaretle. kind: units|bosses|items|story (tekil de olur). Yeni ise true. */
export function markSeen(kind, id) {
  const P = load();
  const fresh = markIn(P, kind, id, Date.now());
  if (!fresh) return false;
  // Sık çağrılır (her doğuşta): yazmayı toparla
  if (typeof window === 'undefined' || typeof setTimeout !== 'function') save(P);
  else { clearTimeout(flushTimer); flushTimer = setTimeout(() => save(load()), 400); }
  return true;
}

/** Bekleyen Kodeks yazımını hemen kaydeder. */
export function flushMeta() { clearTimeout(flushTimer); if (cache) save(cache); }

export function isSeen(kind, id) {
  const k = normKind(kind);
  const cid = codexId(k, id);
  return !!(k && cid && own(load().codex[k] || {}, cid));
}

/**
 * Oyunun olay veri yoluna bağlanır ve görülen birim/boss/eşyaları Kodeks'e yazar (g.on: Arena 2.0 game.js).
 * Tanıtım (menü arkası) DOG'ları sayılmaz. Kapatma fonksiyonu döndürür.
 */
export function trackGame(g) {
  if (!g || typeof g.on !== 'function') return () => {};
  const offs = [];
  const on = (type, fn) => { try { const off = g.on(type, (d) => { try { fn(d || {}); } catch { /* yok say */ } }); if (typeof off === 'function') offs.push(off); } catch { /* yok say */ } };
  // Arena 3.0: birimlerin tanım kimliği u.def.id / olay d.id ('dog_feed', 'neutral_wolf', 'boss_general' …)
  const byId = (id) => (typeof id === 'string' && id ? (id.startsWith('boss_') ? ['bosses', id] : ['units', id]) : null);
  const unitKey = (u) => {
    if (!u || u.demo) return null;
    const k = byId(u.def && u.def.id);
    if (k) return k;
    const kind = u.kind;
    const type = u.type;
    if (!type) return null;
    if (kind === 'dog') return ['units', `dog_${type}`];
    if (kind === 'creep') return ['units', `creep_${type}`];
    if (kind === 'neutral') return ['units', `neutral_${type}`];
    if (kind === 'boss') return ['bosses', type];
    if (kind === 'tower') return ['units', u.side ? `tower_${u.side}` : `tower_${type}`];
    return ['units', `${kind || 'unit'}_${type}`];
  };
  const see = (k) => { if (!k || g.state === 'idle') return; markSeen(k[0], k[1]); };
  const itemId = (it) => (typeof it === 'string' ? it : it && typeof it.id === 'string' ? it.id : null);
  on('spawn', (d) => see(unitKey(d.foe || d.dog || d.unit)));
  on('unitKilled', (d) => see(byId(d.id) || unitKey(d.unit || { kind: d.kind, type: d.type })));
  on('bossKilled', (d) => { const id = d.id || (typeof d.boss === 'string' ? d.boss : d.boss && (d.boss.type || d.boss.id)); if (id) markSeen('bosses', id); });
  on('itemBought', (d) => { const id = itemId(d.item); if (id) markSeen('items', id); });
  on('neutralDrop', (d) => { const id = itemId(d.item); if (id) markSeen('items', id); });
  on('neutralEquip', (d) => { const id = itemId(d.item); if (id) markSeen('items', id); });
  on('runStart', () => { session = { at: Date.now(), codex: [] }; markSeen('units', 'tower_dire'); });
  on('towerDown', () => markSeen('units', 'tower_dire'));
  return () => { for (const off of offs.splice(0)) { try { off(); } catch { /* yok say */ } } };
}

// ------------------------------------------------------------------ profil seçimleri (rozetler)
let storeSink = null;
function pickMax(P, key, value) {
  if (storeSink) writePick(key, value);
  else P.pendingPicks[key] = Math.max(num(P.pendingPicks[key], 0), value);
}
function writePick(key, value) {
  try {
    storeSink.me.patch((d) => {
      if (!d.picks) d.picks = {};
      if (!(Number(d.picks[key]) >= value)) d.picks[key] = value;
    });
  } catch { /* yok say */ }
}

/**
 * Site veri katmanını bağla (core/store.js `store`): rozet/görev seçimleri store.me.picks'e yazılır.
 * library.js / mastery.js / codex.js bağlanır; arena entegrasyonu da mountArena'da çağırmalı. Bekleyenler boşaltılır.
 */
export function connectStore(store) {
  if (!store || !store.me || typeof store.me.patch !== 'function') return;
  storeSink = store;
  const P = load();
  const pend = Object.entries(P.pendingPicks || {});
  if (!pend.length) return;
  for (const [k, v] of pend) writePick(k, v);
  P.pendingPicks = {};
  save(P);
}

// ------------------------------------------------------------------ arayüzler (tembel)
function lazyMount(loader, name, el, ...args) {
  let dead = false;
  let inner = null;
  loader().then((m) => { if (!dead && m && typeof m[name] === 'function') inner = m[name](el, ...args); })
    .catch((e) => console.error('Arena ilerleme arayüzü yüklenemedi', e));
  return () => { dead = true; if (typeof inner === 'function') inner(); inner = null; };
}

/** Aghanim Kütüphanesi ekranı (tembel parça). ctx: { branch?, onClose?, onHero?(id), onCodex?, onChange?, title? } → temizlik */
export function mountLibrary(el, ctx = {}) { return lazyMount(() => import('./library.js'), 'mountLibrary', el, ctx); }
/** Kahraman ustalık paneli (tembel parça). ctx: { onClose?, onLibrary? } → temizlik */
export function mountHeroMastery(el, heroId, ctx = {}) { return lazyMount(() => import('./mastery.js'), 'mountHeroMastery', el, heroId, ctx); }
/** Kodeks ekranı (tembel parça). ctx: { kind?, onClose? } → temizlik */
export function mountCodex(el, ctx = {}) { return lazyMount(() => import('./codex.js'), 'mountCodex', el, ctx); }
/** Koşu sonu ödül kartı (tembel parça). rewards: grantRunRewards dönüşü · ctx: { onLibrary?, onHero?(id) } → temizlik */
export function mountRunRewards(el, rewards, ctx = {}) { return lazyMount(() => import('./mastery.js'), 'mountRunRewards', el, rewards, ctx); }
/** Sonraki koşunun Lanet seçicisi (tembel parça). ctx: { onChange?(seviye) } → temizlik */
export function mountCursePicker(el, ctx = {}) { return lazyMount(() => import('./library.js'), 'mountCursePicker', el, ctx); }
