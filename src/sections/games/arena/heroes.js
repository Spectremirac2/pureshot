// 1vDOQUZ Arena 3.0 — kahraman tanımları (yalnızca veri; yetenek mantığı abilities.js içinde).
// Hepsi Dota arketiplerinden esinlenen özgün karakterlerdir; arayüzde Türkçe lakaplarıyla anılırlar.

/** Seçim sırası. Kilitli kahramanlar (locked: true) Aghanım Kütüphanesi'nden (progression.js) açılır. */
export const HERO_IDS = ['okcu', 'balta', 'buz', 'golge', 'simsek', 'agac'];

/**
 * Özellik katsayıları (Dota'ya yakın, arenaya ölçekli).
 * Güç: can + can yenilenmesi · Çeviklik: zırh + saldırı hızı · Zekâ: mana + mana yenilenmesi + büyü güçlendirme.
 * Ana özellik her puanda +1 saldırı hasarı verir.
 */
export const ATTR = {
  hpPerStr: 20,
  regenPerStr: 0.1,
  armorPerAgi: 1 / 10,
  asPerAgi: 0.75, // saldırı hızı puanı (100 = 2× saldırı)
  manaPerInt: 12,
  mregenPerInt: 0.05,
  ampPerInt: 0.002, // büyü güçlendirme (%0,2 / zekâ)
  dmgPerPrimary: 1,
};
export const ATTR_NAMES = { str: 'Güç', agi: 'Çeviklik', int: 'Zekâ' };
export const ATTR_SHORT = { str: 'GÜÇ', agi: 'ÇEV', int: 'ZEK' };
export const HERO_MR = 0.25; // kahramanların taban büyü direnci

/**
 * attr: ana özellik · attrs: { str|agi|int: [1. seviye, seviye başına artış] }
 * base: özelliksiz taban değerler (can/mana/yenilenme/zırh), hız, kaçınma
 * attack: temel saldırı ({ type, range, dmg (taban, ana özellik hariç), bat (taban saldırı süresi), proj })
 *         Okçu'da yok: Q onun saldırısıdır (atkDmg yine ana özellikten beslenir; baseDmg alanı).
 * abilities: tuş → yetenek kimliği (tanım ve etki: abilities.js)
 * build: otomatik yetenek dağıtımı sırası (Q 1. seviyede hazır gelir)
 * talents: 10/15/20/25. seviyede ikiden biri (Dota yetenek ağacı); stat: doğrudan stat katkısı,
 *          yoksa yetenek kodu p.tal.has(id) ile okur
 * locked: true → varsayılan kilitli (progression / geliştirici kancası açar)
 */
export const HEROES = {
  okcu: {
    id: 'okcu',
    attr: 'agi',
    attrs: { str: [18, 1.8], agi: [24, 2.8], int: [17, 1.3] },
    name: 'Okçu',
    title: 'CureShot’ın kapüşonlusu',
    role: 'Menzilli · Nişancı',
    diff: 2,
    color: '#43d6a0',
    model: 'model-archer',
    height: 1.6,
    blurb: 'Yayını gerer, bir okla üç DOG deler. Mesafeyi koru, şarjı doldur, sürüyü dizle.',
    base: { hp: 280, mana: 96, hpRegen: 0.1, manaRegen: 8.2, armor: -2, speed: 5.3, evasion: 0 },
    baseDmg: 10,
    attack: null,
    abilities: { q: 'okcu_shot', w: 'okcu_windrun', e: 'okcu_tango', r: 'okcu_dog' },
    build: ['q', 'w', 'q', 'e', 'q', 'r', 'q', 'w', 'w', 'w', 'r', 'e', 'e', 'e', 'r'],
    talents: {
      10: [{ id: 'okDmg', name: '+%15 ok hasarı' }, { id: 'okHp', name: '+220 can', stat: { hp: 220 } }],
      15: [{ id: 'okWind', name: 'Rüzgâr Koşusu −4 sn bekleme' }, { id: 'okCharge', name: 'CureShot %30 daha hızlı şarj' }],
      20: [{ id: 'okUlt', name: 'DOG DOG DOG +3 yarıçap' }, { id: 'okMulti', name: 'Tam şarj: üçlü ok yelpazesi' }],
      25: [{ id: 'okAgi', name: '+30 çeviklik', stat: { agi: 30 } }, { id: 'okUltCd', name: 'DOG DOG DOG −12 sn bekleme' }],
    },
    aghs: 'Aghanım: DOG DOG DOG bekleme süresi 18 sn’ye iner, korku +1 sn.',
  },
  balta: {
    id: 'balta',
    attr: 'str',
    attrs: { str: [25, 3.4], agi: [16, 1.6], int: [16, 1.2] },
    name: 'Balta',
    title: 'Kızıl deri, çift ağızlı öfke',
    role: 'Yakın dövüş · Tank',
    diff: 1,
    color: '#e0354b',
    model: 'model-hero-brute',
    height: 1.75,
    blurb: 'Sürüyü üstüne çağırır, döner, biçer. Canı düşeni tek hamlede bitirir; her infazda bekleme sıfırlanır.',
    base: { hp: 440, mana: 48, hpRegen: 1.5, manaRegen: 5.7, armor: 1.5, speed: 5.05, evasion: 0 },
    attack: { type: 'melee', range: 1.55, dmg: 21, bat: 1.1 },
    abilities: { q: 'balta_call', w: 'balta_helix', e: 'balta_hunger', r: 'balta_cull' },
    build: ['q', 'w', 'w', 'e', 'w', 'r', 'w', 'q', 'q', 'q', 'r', 'e', 'e', 'e', 'r'],
    talents: {
      10: [{ id: 'baDmg', name: '+20 saldırı hasarı', stat: { dmg: 20 } }, { id: 'baHp', name: '+250 can', stat: { hp: 250 } }],
      15: [{ id: 'baSpin', name: 'Helezon hasarı +60' }, { id: 'baCall', name: 'Savaş Çağrısı +1,2 yarıçap' }],
      20: [{ id: 'baCull', name: 'Kesin Hüküm eşiği +120' }, { id: 'baCleave', name: 'Savaş Hiddeti: saldırılar %45 yarar', stat: { cleave: 0.45 } }],
      25: [{ id: 'baArmor', name: '+10 zırh', stat: { armor: 10 } }, { id: 'baProc', name: 'Helezon dönme şansı +%12' }],
    },
    aghs: 'Aghanım: Kesin Hüküm menzili +1,5 ve her infazda otomatik Helezon.',
  },
  buz: {
    id: 'buz',
    attr: 'int',
    attrs: { str: [18, 2.0], agi: [16, 1.6], int: [25, 3.2] },
    name: 'Buz Cadısı',
    title: 'Kristal asalı kış',
    role: 'Menzilli · Büyücü',
    diff: 2,
    color: '#7fd4ff',
    model: 'model-hero-frost',
    height: 1.62,
    blurb: 'Dondurur, kökler, fırtınayı çağırır. Kırılgan ama sürüyü tek büyüyle yere çiviler.',
    base: { hp: 270, mana: 140, hpRegen: 0, manaRegen: 9.75, armor: -1.2, speed: 4.95, evasion: 0 },
    attack: { type: 'ranged', range: 6.2, dmg: 12, bat: 1.16, proj: 'ice' },
    abilities: { q: 'buz_nova', w: 'buz_chain', e: 'buz_aura', r: 'buz_field' },
    build: ['q', 'w', 'q', 'e', 'q', 'r', 'q', 'w', 'w', 'w', 'r', 'e', 'e', 'e', 'r'],
    talents: {
      10: [{ id: 'buMana', name: '+150 mana', stat: { mana: 150 } }, { id: 'buAmp', name: '+%12 büyü hasarı', stat: { spell: 0.12 } }],
      15: [{ id: 'buRoot', name: 'Buz Zinciri +1 sn' }, { id: 'buNova', name: 'Buz Novası −2 sn bekleme' }],
      20: [{ id: 'buWalk', name: 'Donduran Alan’da yürüyebilirsin' }, { id: 'buField', name: 'Donduran Alan hasarı +%40' }],
      25: [{ id: 'buNova2', name: 'Buz Novası ikinci kez patlar' }, { id: 'buChain2', name: 'Buz Zinciri ikinci hedefe sıçrar' }],
    },
    aghs: 'Aghanım: Donduran Alan içindekiler her 1,5 sn’de 0,6 sn donar.',
  },
  golge: {
    id: 'golge',
    attr: 'agi',
    attrs: { str: [20, 2.2], agi: [24, 3.1], int: [16, 1.2] },
    name: 'Gölge',
    title: 'Kapüşonlu ikiz hançer',
    role: 'Yakın dövüş · Suikastçı',
    diff: 3,
    color: '#b18cff',
    model: 'model-hero-shadow',
    height: 1.52,
    blurb: 'Gölgeden gölgeye sıçrar, kritik vurur, dumanda kaybolur. Hata affetmez ama en hızlı o biçer.',
    base: { hp: 300, mana: 78, hpRegen: 0.8, manaRegen: 6.7, armor: -2.5, speed: 5.65, evasion: 0.15 },
    attack: { type: 'melee', range: 1.45, dmg: 15, bat: 0.89 },
    abilities: { q: 'golge_step', w: 'golge_smoke', e: 'golge_crit', r: 'golge_dance' },
    build: ['q', 'e', 'q', 'e', 'q', 'r', 'q', 'e', 'e', 'w', 'r', 'w', 'w', 'w', 'r'],
    talents: {
      10: [{ id: 'goCrit', name: '+%8 kritik şansı', stat: { crit: 0.08 } }, { id: 'goSpeed', name: '+0,5 hareket hızı', stat: { speed: 0.5 } }],
      15: [{ id: 'goStep', name: 'Gölge Adımı −2 sn bekleme' }, { id: 'goEva', name: '+%15 kaçınma', stat: { evasion: 0.15 } }],
      20: [{ id: 'goDance', name: 'Ölüm Dansı +3 hedef' }, { id: 'goDeso', name: 'Yıkım: vuruşlar 4 sn %20 fazla hasar aldırır' }],
      25: [{ id: 'goLs', name: '+%18 can çalma', stat: { lifesteal: 0.18 } }, { id: 'goSmoke', name: 'Duman Perdesi −6 sn bekleme' }],
    },
    aghs: 'Aghanım: Ölüm Dansı +3 sıçrama ve sonunda 2 sn görünmezlik.',
  },
  simsek: {
    id: 'simsek',
    attr: 'int',
    attrs: { str: [18, 2.0], agi: [20, 1.8], int: [24, 3.0] },
    name: 'Şimşek Ruhu',
    title: 'Fırtınayı cebinde taşıyan',
    role: 'Menzilli · Hareketli büyücü',
    diff: 3,
    color: '#5fb8ff',
    model: 'model-hero-storm',
    height: 1.6,
    locked: true,
    blurb: 'Kalıntı bırakır, girdapla çeker, yıldırım topuna dönüşüp sürünün içinden geçer. Her büyü bir sonraki vuruşu şarj eder.',
    base: { hp: 240, mana: 112, hpRegen: 0, manaRegen: 8.8, armor: -1.5, speed: 5.2, evasion: 0 },
    attack: { type: 'ranged', range: 6.0, dmg: 16, bat: 1.26, proj: 'spark' },
    abilities: { q: 'simsek_remnant', w: 'simsek_vortex', e: 'simsek_overload', r: 'simsek_ball' },
    build: ['q', 'e', 'q', 'w', 'q', 'r', 'q', 'e', 'e', 'e', 'r', 'w', 'w', 'w', 'r'],
    talents: {
      10: [{ id: 'siAmp', name: '+%10 büyü hasarı', stat: { spell: 0.1 } }, { id: 'siHp', name: '+200 can', stat: { hp: 200 } }],
      15: [{ id: 'siRem', name: 'Durgun Kalıntı hasarı +50' }, { id: 'siVortex', name: 'Elektrik Girdabı kökü +0,6 sn' }],
      20: [{ id: 'siOver', name: 'Aşırı Yük alanı +1 ve %50 fazla yavaşlatma' }, { id: 'siBall', name: 'Yıldırım Topu mana maliyeti −%40' }],
      25: [{ id: 'siVortexR', name: 'Elektrik Girdabı yarıçapı +1,5' }, { id: 'siRemCd', name: 'Durgun Kalıntı bekleme −1,5 sn' }],
    },
    aghs: 'Aghanım: Yıldırım Topu geçtiği yola her 3 birimde bir Durgun Kalıntı bırakır.',
  },
  agac: {
    id: 'agac',
    attr: 'str',
    attrs: { str: [26, 3.6], agi: [14, 1.4], int: [17, 1.6] },
    name: 'Ağaç Bekçisi',
    title: 'Ormanın yaşlı nöbetçisi',
    role: 'Yakın dövüş · Dayanıklı destek',
    diff: 2,
    color: '#8fd16a',
    model: 'model-hero-treant',
    height: 1.8,
    locked: true,
    blurb: 'Yavaş ama sökülmez. Kökleriyle bağlar ve sömürür, kabuğunu zırha çevirir, ormanı sürünün üstüne yıkar.',
    base: { hp: 480, mana: 56, hpRegen: 1.9, manaRegen: 5.15, armor: 2.5, speed: 4.75, evasion: 0 },
    attack: { type: 'melee', range: 1.7, dmg: 29, bat: 1.37 },
    abilities: { q: 'agac_guise', w: 'agac_leech', e: 'agac_armor', r: 'agac_growth' },
    build: ['q', 'w', 'e', 'w', 'w', 'r', 'w', 'e', 'e', 'e', 'r', 'q', 'q', 'q', 'r'],
    talents: {
      10: [{ id: 'agHp', name: '+300 can', stat: { hp: 300 } }, { id: 'agRes', name: '+%15 statü direnci', stat: { statusRes: 0.15 } }],
      15: [{ id: 'agLeech', name: 'Sömürücü Kökler +1 sn' }, { id: 'agGuise', name: 'Doğanın Örtüsü hızı +%20' }],
      20: [{ id: 'agArmor', name: 'Canlı Zırh +6 zırh' }, { id: 'agGrowthR', name: 'Aşırı Büyüme +2 yarıçap' }],
      25: [{ id: 'agGrowthDmg', name: 'Aşırı Büyüme hasarı ×2' }, { id: 'agStr', name: '+30 güç', stat: { str: 30 } }],
    },
    aghs: 'Aghanım: Doğanın Örtüsü’ndeyken her 2,5 sn’de yakındaki bir düşmanı Sömürücü Köklerle bağlar.',
  },
};

export const heroOf = (id) => HEROES[id] || HEROES.okcu;

// ------------------------------------------------------------------ kilitler
const devUnlocked = new Set();
let unlockCheck = null;
/**
 * Kilit kontrolü kaydı (progression.js ya da hikâye): fn(heroId) → true ise açık.
 * Kaydedilmezse kilitli kahramanlar kapalı kalır (geliştirici kancası hariç).
 */
export function registerUnlockCheck(fn) { unlockCheck = typeof fn === 'function' ? fn : null; }
/** Geliştirme/test: kahramanı bu oturum için aç (root.__arenaDebug.unlock). */
export function devUnlock(id) {
  if (id === 'all') for (const k of HERO_IDS) devUnlocked.add(k);
  else if (HEROES[id]) devUnlocked.add(id);
}
export function isHeroUnlocked(id) {
  const H = HEROES[id];
  if (!H) return false;
  if (!H.locked || devUnlocked.has(id)) return true;
  try { return !!(unlockCheck && unlockCheck(id)); } catch { return false; }
}

// ------------------------------------------------------------------ seviye
/**
 * Seviye için gereken XP (L → L+1). Arena 3.0: orman kampları ve daha uzun koşular için hafif dik eğri;
 * iyi bir koşu (≈12. dalga) 20+ seviyeye ulaşır.
 */
export const xpFor = (level) => 110 + 60 * (level - 1);
export const MAX_LEVEL = 25;
export const TALENT_LEVELS = [10, 15, 20, 25];
/** Yetenek seviye sınırları: Q W E 4, R 3; özellik bonusu (+2 tümü) 7 kez. */
export const ABILITY_MAX = { q: 4, w: 4, e: 4, r: 3 };
export const STATS_MAX = 7;
/** Bu kahraman seviyesinde yeteneğin öğrenilebileceği en yüksek seviye. */
export function abilityCap(key, heroLevel) {
  if (key === 'r') return Math.min(3, Math.floor(heroLevel / 6));
  return Math.min(4, Math.floor((heroLevel + 1) / 2));
}

/** Seviye L'deki özellik değeri (talent/eşya hariç). */
export const attrAt = (H, k, L) => H.attrs[k][0] + H.attrs[k][1] * (L - 1);

/** Seçim ekranındaki çubuklar için 0–1 değerler (1. seviye). */
export function heroBars(H) {
  const b = H.base;
  const atk = H.attack;
  const hp = b.hp + ATTR.hpPerStr * H.attrs.str[0];
  const mana = b.mana + ATTR.manaPerInt * H.attrs.int[0];
  return [
    ['Can', Math.min(1, hp / 1000)],
    ['Mana', Math.min(1, mana / 450)],
    ['Hız', Math.min(1, (b.speed - 4.4) / 1.4)],
    ['Menzil', H.id === 'okcu' ? 1 : atk ? Math.min(1, atk.range / 6.5) : 0.5],
  ];
}
