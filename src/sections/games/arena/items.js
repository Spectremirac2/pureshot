// 1vDOQUZ Arena 2.0 — dükkân eşyaları (Türkçe, oyunbaz adlar). icon: src/assets/items/<icon>.webp (yoksa SVG yedeği).
//
// stat: pasif katkılar (recalc'ta toplanır) · active: { cd, mana?, use(g) → bool } · charges: şarjlı tüketilebilir
// Fiyatlar kısa bir koşuya (≈10 dalga) göre küçültüldü.

export const ITEMS = {
  boots: {
    id: 'boots', name: 'Koşu Botları', icon: 'boots', cost: 350, tier: 1,
    desc: '+0,7 hareket hızı. Kaçmak da bir stratejidir.',
    stat: { speed: 0.7 },
  },
  tango: {
    id: 'tango', name: 'Tango Paketi', icon: 'tango', cost: 90, tier: 1, charges: 3, stack: true,
    desc: '3 şarj. Aktif: 8 sn’de 130 can. Ağaç kemirmek serbest.',
    active: { cd: 0.5, use: (g) => g.itemHeal(130, 8) },
  },
  wand: {
    id: 'wand', name: 'Sihirli Değnek', icon: 'magic_wand', cost: 250, tier: 1, charges: 0, maxCharges: 15, keepEmpty: true,
    desc: 'Her öldürmede 1 şarj (en çok 15). Aktif: şarj başına 16 can ve 16 mana.',
    active: { cd: 8, use: (g, it) => g.useWand(it) },
  },
  blink: {
    id: 'blink', name: 'Göz Açıp Kapayana', icon: 'blink', cost: 950, tier: 2,
    desc: 'Aktif: nişan yönünde 7 birime kadar ışınlan. Hasar aldıktan sonra 2 sn kullanılamaz.',
    active: { cd: 11, use: (g) => g.blinkTo(7) },
  },
  bkb: {
    id: 'bkb', name: 'Kara Kral Asası', icon: 'black_king_bar', cost: 1500, tier: 2,
    desc: '+10 hasar. Aktif: 5 sn büyü bağışıklığı: yavaşlatma, sersemletme, REPORT ve kükreme işlemez; büyü hasarı %60 azalır.',
    stat: { dmg: 10 },
    active: { cd: 45, use: (g) => g.bkbOn(5) },
  },
  radiance: {
    id: 'radiance', name: 'Güneş Tacı', icon: 'radiance', cost: 2100, tier: 3,
    desc: '+14 hasar. Pasif: 3,2 birimdeki düşmanlara saniyede 38 yanma hasarı.',
    stat: { dmg: 14, burn: 38 },
  },
  butterfly: {
    id: 'butterfly', name: 'Kelebek', icon: 'butterfly', cost: 2300, tier: 3,
    desc: '+%30 kaçınma, +%25 saldırı hızı, +12 hasar. Okçu’da şarj %20 hızlanır.',
    stat: { evasion: 0.3, atkSpeed: 0.25, dmg: 12 },
  },
  aghs: {
    id: 'aghs', name: 'Aghanım Asası', icon: 'ultimate_scepter', cost: 2400, tier: 3,
    desc: '+180 can, +180 mana. Ultiyi yükseltir (kahramana göre değişir).',
    stat: { hp: 180, mana: 180, aghs: 1 },
  },
  refresher: {
    id: 'refresher', name: 'Tazeleme Küresi', icon: 'refresher', cost: 2000, tier: 3,
    desc: '+4 mana/sn. Aktif: tüm yetenek bekleme sürelerini sıfırlar.',
    stat: { manaRegen: 4 },
    active: { cd: 60, mana: 120, use: (g) => g.refreshAll() },
  },
  rapier: {
    id: 'rapier', name: 'İlahi Kılıç', icon: 'rapier', cost: 3600, tier: 4,
    desc: 'Tüm hasar +%80. Aegis ile dirilirsen düşer: Kurye Köpeği kapar, 8 sn içinde indirip geri al!',
    stat: { dmgMul: 0.8 },
  },
  cheese: {
    id: 'cheese', name: 'Peynir', icon: 'cheese', cost: 0, tier: 0, drop: true, charges: 1,
    desc: 'Roshan’dan düşer. Aktif: anında tam can ve mana.',
    active: { cd: 0, use: (g) => g.cheese() },
  },
};

/** Dükkânda satılanlar (sırasıyla). */
export const SHOP = ['boots', 'tango', 'wand', 'blink', 'bkb', 'radiance', 'butterfly', 'aghs', 'refresher', 'rapier'];
export const SLOTS = 6;
export const itemOf = (id) => ITEMS[id] || null;

// ------------------------------------------------------------------ rünler
export const RUNES = {
  haste: { id: 'haste', name: 'Hız', color: '#ff4d4d', dur: 8, desc: '8 sn en yüksek hız' },
  dd: { id: 'dd', name: 'Çift Hasar', color: '#4d8dff', dur: 12, desc: '12 sn çift hasar' },
  regen: { id: 'regen', name: 'Yenilenme', color: '#43d66a', dur: 8, desc: 'Can ve mana hızla dolar' },
  invis: { id: 'invis', name: 'Görünmezlik', color: '#b18cff', dur: 10, desc: '10 sn görünmezlik' },
  bounty: { id: 'bounty', name: 'Ödül', color: '#e9b949', dur: 0, desc: 'Altın ve XP' },
};
export const RUNE_IDS = Object.keys(RUNES);
