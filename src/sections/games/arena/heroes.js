// 1vDOQUZ Arena 2.0 — kahraman tanımları (yalnızca veri; yetenek mantığı kits.js içinde).
// Hepsi Dota arketiplerinden esinlenen özgün karakterlerdir; arayüzde Türkçe lakaplarıyla anılırlar.

export const HERO_IDS = ['okcu', 'balta', 'buz', 'golge'];

/**
 * base: 1. seviye değerleri · grow: seviye başına artış (dmg: tüm hasar çarpanı artışı)
 * attack: temel saldırı (Okçu'da yok: Q onun saldırısıdır)
 * attr: ana özellik ('str' güç | 'agi' çeviklik | 'int' zekâ) — ileride özellik sistemi için ayrıldı
 * abilities: tuş → yetenek kimliği (tanım ve etki: abilities.js)
 * talents: 5/10/15. seviyede ikiden biri (Dota yetenek ağacı); stat: doğrudan stat katkısı,
 *          yoksa yetenek kodu p.tal.has(id) ile okur
 */
export const HEROES = {
  okcu: {
    id: 'okcu',
    attr: 'agi',
    name: 'Okçu',
    title: 'CureShot’ın kapüşonlusu',
    role: 'Menzilli · Nişancı',
    diff: 2,
    color: '#43d6a0',
    model: 'model-archer',
    height: 1.6,
    blurb: 'Yayını gerer, bir okla üç DOG deler. Mesafeyi koru, şarjı doldur, sürüyü dizle.',
    base: { hp: 640, mana: 300, hpRegen: 1.6, manaRegen: 9, speed: 5.3, armor: 0, evasion: 0 },
    grow: { hp: 38, mana: 16, dmg: 0.055 },
    attack: null,
    abilities: { q: 'okcu_shot', w: 'okcu_windrun', e: 'okcu_tango', r: 'okcu_dog' },
    talents: {
      5: [{ id: 'okDmg', name: '+%15 ok hasarı' }, { id: 'okHp', name: '+180 can', stat: { hp: 180 } }],
      10: [{ id: 'okWind', name: 'Rüzgâr Koşusu −4 sn bekleme' }, { id: 'okCharge', name: 'CureShot %30 daha hızlı şarj' }],
      15: [{ id: 'okUlt', name: 'DOG DOG DOG +3 yarıçap' }, { id: 'okMulti', name: 'Tam şarj: üçlü ok yelpazesi' }],
    },
    aghs: 'Aghanım: DOG DOG DOG bekleme süresi 30 → 18 sn, korku +1 sn.',
  },
  balta: {
    id: 'balta',
    attr: 'str',
    name: 'Balta',
    title: 'Kızıl deri, çift ağızlı öfke',
    role: 'Yakın dövüş · Tank',
    diff: 1,
    color: '#e0354b',
    model: 'model-hero-brute',
    height: 1.75,
    blurb: 'Sürüyü üstüne çağırır, döner, biçer. Canı düşeni tek hamlede bitirir; her infazda bekleme sıfırlanır.',
    base: { hp: 900, mana: 230, hpRegen: 3.2, manaRegen: 6.5, speed: 5.0, armor: 0.15, evasion: 0 },
    grow: { hp: 62, mana: 12, dmg: 0.05 },
    attack: { type: 'melee', range: 1.55, dmg: 46, rate: 0.95 },
    abilities: { q: 'balta_call', w: 'balta_helix', e: 'balta_hunger', r: 'balta_cull' },
    talents: {
      5: [{ id: 'baDmg', name: '+14 saldırı hasarı', stat: { dmg: 14 } }, { id: 'baHp', name: '+220 can', stat: { hp: 220 } }],
      10: [{ id: 'baSpin', name: 'Helezon hasarı +60' }, { id: 'baCall', name: 'Savaş Çağrısı +1,2 yarıçap' }],
      15: [{ id: 'baCull', name: 'Kesin Hüküm eşiği +120' }, { id: 'baCleave', name: 'Savaş Hiddeti: saldırılar %45 yarar', stat: { cleave: 0.45 } }],
    },
    aghs: 'Aghanım: Kesin Hüküm menzili +1,5 ve her infazda otomatik Helezon.',
  },
  buz: {
    id: 'buz',
    attr: 'int',
    name: 'Buz Cadısı',
    title: 'Kristal asalı kış',
    role: 'Menzilli · Büyücü',
    diff: 2,
    color: '#7fd4ff',
    model: 'model-hero-frost',
    height: 1.62,
    blurb: 'Dondurur, kökler, fırtınayı çağırır. Kırılgan ama sürüyü tek büyüyle yere çiviler.',
    base: { hp: 540, mana: 440, hpRegen: 1.3, manaRegen: 11, speed: 4.9, armor: 0, evasion: 0 },
    grow: { hp: 36, mana: 26, dmg: 0.055 },
    attack: { type: 'ranged', range: 6.2, dmg: 34, rate: 1.05, proj: 'ice' },
    abilities: { q: 'buz_nova', w: 'buz_chain', e: 'buz_aura', r: 'buz_field' },
    talents: {
      5: [{ id: 'buMana', name: '+120 mana', stat: { mana: 120 } }, { id: 'buAmp', name: '+%15 büyü hasarı', stat: { spell: 0.15 } }],
      10: [{ id: 'buRoot', name: 'Buz Zinciri +1 sn' }, { id: 'buNova', name: 'Buz Novası −2 sn bekleme' }],
      15: [{ id: 'buWalk', name: 'Donduran Alan’da yürüyebilirsin' }, { id: 'buField', name: 'Donduran Alan hasarı +%40' }],
    },
    aghs: 'Aghanım: Donduran Alan içindekiler her 1,5 sn’de 0,6 sn donar.',
  },
  golge: {
    id: 'golge',
    attr: 'agi',
    name: 'Gölge',
    title: 'Kapüşonlu ikiz hançer',
    role: 'Yakın dövüş · Suikastçı',
    diff: 3,
    color: '#b18cff',
    model: 'model-hero-shadow',
    height: 1.52,
    blurb: 'Gölgeden gölgeye sıçrar, kritik vurur, dumanda kaybolur. Hata affetmez ama en hızlı o biçer.',
    base: { hp: 590, mana: 270, hpRegen: 2.2, manaRegen: 7.5, speed: 5.65, armor: 0.05, evasion: 0.15 },
    grow: { hp: 44, mana: 14, dmg: 0.055 },
    attack: { type: 'melee', range: 1.45, dmg: 39, rate: 0.72 },
    abilities: { q: 'golge_step', w: 'golge_smoke', e: 'golge_crit', r: 'golge_dance' },
    talents: {
      5: [{ id: 'goCrit', name: '+%8 kritik şansı', stat: { crit: 0.08 } }, { id: 'goSpeed', name: '+0,5 hareket hızı', stat: { speed: 0.5 } }],
      10: [{ id: 'goStep', name: 'Gölge Adımı −2 sn bekleme' }, { id: 'goEva', name: '+%15 kaçınma', stat: { evasion: 0.15 } }],
      15: [{ id: 'goDance', name: 'Ölüm Dansı +3 hedef' }, { id: 'goDeso', name: 'Yıkım: vuruşlar 4 sn %20 fazla hasar aldırır' }],
    },
    aghs: 'Aghanım: Ölüm Dansı +3 sıçrama ve sonunda 2 sn görünmezlik.',
  },
};

export const heroOf = (id) => HEROES[id] || HEROES.okcu;

/** Seviye için gereken XP (L → L+1). */
export const xpFor = (level) => 100 + 55 * (level - 1);
export const MAX_LEVEL = 25;
export const TALENT_LEVELS = [5, 10, 15];

/** Seçim ekranındaki çubuklar için 0–1 değerler. */
export function heroBars(H) {
  const b = H.base;
  const atk = H.attack;
  return [
    ['Can', Math.min(1, b.hp / 950)],
    ['Mana', Math.min(1, b.mana / 450)],
    ['Hız', Math.min(1, (b.speed - 4.4) / 1.4)],
    ['Menzil', H.id === 'okcu' ? 1 : atk ? Math.min(1, atk.range / 6.5) : 0.5],
  ];
}
