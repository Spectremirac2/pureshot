// Rozetler (başarımlar). Tamamı ziyaretçinin kendi profilinden (store.me: scores, picks, likes, dog)
// türetilir; ayrı bir kayıt tutulmaz. Eşikler tek tabloda (THRESHOLDS): bir oyunun puanlaması
// değişirse yalnızca oradaki sayıyı ayarlamak yeter. Belge: docs/oyunlar/rozetler.md
//
//   BADGES                 rozet listesi (sıra = ekrandaki sıra)
//   earnedBadges(me)       kazanılmış rozet nesneleri
//   badgeProgress(b, me)   { pct, text } | null — kilitli rozette ilerleme
//   watchBadges(store, cb) sayfa açıldıktan SONRA kazanılan rozetler için cb([rozet]) — kapatma fn döner
//   ensureBadgeWatcher()   küresel tekil izleyici (bildirim + kısa ses); kaç kez çağrılırsa çağrılsın bir kez kurulur

import { h, fmtNum } from './dom.js';
import { icon } from './icons.js';
import { store } from './store.js';
import { fx } from './fx.js';
import { sound } from './sound.js';

// ------------------------------------------------------------------ salon kataloğu
// Oyun modüllerini içe aktarmadan (ana sayfa, profil gibi hafif sayfalar için) salonun oyun listesi.
// Kimlikler games.js'teki meta.id değerleriyle aynıdır. unit / higherIsBetter / format / charge oyunların
// meta değerlerinin kopyasıdır (profil rekorları, skor biçimi); bir oyunun puanlaması değişirse burası da
// güncellenmeli. isNew: salonda ve ana sayfada "Yeni" etiketi (yalnızca en son eklenen oyunlar).
const pts = (n) => `${fmtNum(n)} puan`;
const fmtSec = (s) => Math.max(0, Number(s) || 0).toFixed(1).replace('.', ',');
export const SALON_GAMES = [
  { id: 'arena', name: '1vDOQUZ Arena', short: 'Arena', icon: 'bow', color: 'var(--aegis)', kind: 'Ultimate · R',
    unit: 'puan', higherIsBetter: true, format: pts },
  { id: 'dogavi', name: 'DOG Avı', short: 'DOG Avı', icon: 'paw', color: 'var(--ember)', kind: 'Aktif · Alan etkili',
    unit: 'puan', higherIsBetter: true, format: pts },
  { id: 'lasthit', name: 'Last Hit Ustası', short: 'Last Hit', icon: 'coin', color: 'var(--aegis)', kind: 'Hedefli · Tek hedef',
    unit: 'altın', higherIsBetter: true, format: (n) => `${fmtNum(n)} altın` },
  { id: 'hafiza', name: 'DOG Hafıza', short: 'Hafıza', icon: 'brain', color: 'var(--arcane)', kind: 'Pasif · Zihin',
    unit: 'puan', higherIsBetter: true, format: pts },
  { id: 'rune', name: 'Rune Refleksi', short: 'Rune', icon: 'bolt', color: 'var(--radiant)', kind: 'Anlık · Refleks',
    unit: 'ms', higherIsBetter: false, format: (n) => `${fmtNum(n)} ms` },
  { id: 'dogdle', name: 'DOGdle', short: 'DOGdle', icon: 'eye', color: 'var(--aegis-2)', kind: 'Günlük · Tahmin',
    unit: 'tahmin', higherIsBetter: false, format: (n) => `${fmtNum(n)} tahmin` },
  { id: 'portre', name: 'Portre Avı', short: 'Portre', icon: 'target', color: 'var(--radiant)', kind: 'Refleks · Göz',
    unit: 'puan', higherIsBetter: true, format: pts },
  { id: 'invoker', name: 'Invoker Kombo', short: 'Invoker', icon: 'orbs', color: 'var(--arcane)', kind: 'Refleks · Parmak',
    unit: 'büyü', higherIsBetter: true, format: (n) => `${fmtNum(n)} büyü` },
  { id: 'hook', name: 'Pudge Hook', short: 'Hook', icon: 'hook', color: 'var(--dire)', kind: 'Beceri · Nişan',
    unit: 'puan', higherIsBetter: true, format: pts },
  { id: 'bingo', name: 'DOG Bingo', short: 'Bingo', icon: 'star', color: 'var(--ember)', kind: 'Yayın · Etkileşim',
    unit: 'çizgi', higherIsBetter: true, format: (n) => `${fmtNum(n)} çizgi` },
  // 2. tur oyunları
  { id: 'kurye', name: 'Uçan Kurye', short: 'Kurye', icon: 'courier', color: 'var(--radiant)', kind: 'Refleks · Ritim', isNew: true,
    unit: 'metre', higherIsBetter: true, format: (n) => `${fmtNum(n)} metre`,
    charge: (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}km` : `${Math.round(n)}m`) },
  { id: 'mayin', name: 'Techies Mayın Tarlası', short: 'Mayın', icon: 'mine', color: 'var(--dire)', kind: 'Zihin · Mantık', isNew: true,
    unit: 'sn', higherIsBetter: false, format: (n) => `${fmtSec(n)} sn`, charge: (n) => `${Math.round(n)}sn` },
  { id: 'esya', name: 'Eşya 2048', short: '2048', icon: 'rapier', color: 'var(--aegis)', kind: 'Zihin · Birleştir', isNew: true,
    unit: 'puan', higherIsBetter: true, format: pts },
  { id: 'maraton', name: '24 Saat Maraton', short: 'Maraton', icon: 'hourglass', color: 'var(--ember)', kind: 'Yayın · Strateji', isNew: true,
    unit: 'izleyici', higherIsBetter: true, format: (n) => `${fmtNum(n)} izleyici` },
];
/** Kimliğe göre salon oyunu (yoksa null). */
export const salonGame = (id) => SALON_GAMES.find((g) => g.id === id) || null;
export const SALON_IDS = SALON_GAMES.map((g) => g.id);
export const NEW_GAME_IDS = SALON_GAMES.filter((g) => g.isNew).map((g) => g.id);

// ------------------------------------------------------------------ eşikler (tek tablo)
export const THRESHOLDS = {
  mudavim: 5, // farklı oyun sayısı
  dogavi: 800, // puan
  lasthit: 550, // altın
  hafiza: 600, // puan (1000 − hamle×20 − sn×5)
  rune: 300, // ms ortalama — DÜŞÜK iyi
  arena: 1200, // ≈ ilk dalga: 9 DOG × 100 + 300 dalga bonusu
  arenaEfsane: 10000, // Arena 2.0/3.0 puanlaması: ≈ 5–6 dalga
  arenaRoshan: 1, // kesilen Roshan (picks['arena:roshan'])
  arenaDalga: 10, // ulaşılan en yüksek dalga (picks['arena:dalga'])
  arenaHero: 1200, // Dört Yüz: dört ana kahramanın her biriyle en az bu kadar puan (picks['arena:h:<id>'])
  arenaStory: 5, // Lanet Kırıcı: biten hikâye bölümü (picks['arena:story'], 1–5)
  arenaLanet: 5, // Lanet Ustası: 5. dalgaya ulaşılan en yüksek Lanet seviyesi (picks['arena:lanet'])
  dogdleSharp: 2, // tahmin — DÜŞÜK iyi
  portre: 3000, // puan (10 tur × 100–500, seri çarpanı ×2'ye kadar)
  invoker: 15, // büyü / 60 sn
  hook: 1500, // puan (düşman 100, uzun kanca +50, seri ×2/×3)
  bingo: 1, // tamamlanan çizgi
  kurye: 300, // metre (uçulan + şişe bonusu)
  kuryeEfsane: 1000, // metre
  mayinSentry: 90, // sn, Orta tahta (16×16, 40 mayın) — DÜŞÜK iyi
  esya: 2500, // puan (≈ BKB/Aghanim kademesi)
  esyaRapier: 11, // ulaşılan en yüksek eşya kademesi (picks['esya:tier']; 11 = Divine Rapier)
  maratonTamam: 1, // 24:00'e varan yayın sayısı (picks['maraton:tamam'])
  maratonFenomen: 7000, // zirve izleyici
  hayran: 10, // 12 sorudan doğru
  bilgi: 1200, // puan (10 soru × 100 + hız bonusu)
  daha: 10, // "Daha DOG mu?" serisi
  dog: 3, // DOG düğmesi (üç kez söylenir)
  maraton: 24, // DOG düğmesi (en kısa yayın: 24 saat) — 24 Saat Maraton oyunuyla ilgisi yok (anahtar korunur)
  critic: 10, // DOG'lanan espri
};

// ------------------------------------------------------------------ yardımcılar
const scoreOf = (me, id) => {
  const v = me && me.scores ? me.scores[id] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
const has = (me, id) => scoreOf(me, id) != null;
const atLeast = (id, n) => (me) => { const v = scoreOf(me, id); return v != null && v >= n; };
const atMost = (id, n) => (me) => { const v = scoreOf(me, id); return v != null && v <= n; };
const playedCount = (me) => SALON_IDS.filter((id) => has(me, id)).length;
const pickNum = (me, key) => Math.max(0, Number(me && me.picks ? me.picks[key] : 0) || 0);
const dogCount = (me) => Math.max(0, Number(me && me.dog) || 0);
const jokeLikes = (me) => Object.keys((me && me.likes) || {}).filter((k) => k.startsWith('jk:')).length;
const T = THRESHOLDS;
/** Dört Yüz rozetinin kahramanları (Arena 2.0'ın dört ana kahramanı; heroes.js kimlikleri). */
const ARENA_HEROES = ['okcu', 'balta', 'buz', 'golge'];
const arenaHeroCount = (me) => ARENA_HEROES.filter((id) => pickNum(me, `arena:h:${id}`) >= T.arenaHero).length;

/** "En iyin: …" ilerleme metni için birim biçimleyici. */
const unit = (u) => (n) => `${fmtNum(n)} ${u}`;
/** Yüksek-iyi puan rozetleri için ilerleme. */
const upTo = (id, goal, fmt) => (me) => {
  const v = scoreOf(me, id);
  if (v == null) return null;
  return { pct: Math.min(1, v / goal), text: `En iyin: ${fmt(v)}` };
};
/** Düşük-iyi rozetler: yalnızca metin (yüzde anlamsız). */
const downTo = (id, fmt) => (me) => {
  const v = scoreOf(me, id);
  return v == null ? null : { pct: null, text: `En iyin: ${fmt(v)}` };
};
/** Eşya 2048 kademe adları (esya.js zinciriyle aynı; rozet ilerleme metni için). */
const ESYA_TIERS = ['', 'Iron Branch', 'Tango', 'Magic Stick', 'Magic Wand', 'Boots of Speed', 'Blink Dagger', 'Black King Bar',
  'Aghanim’s Scepter', 'Radiance', 'Butterfly', 'Divine Rapier', 'Aegis', 'Cheese'];
const fmtGame = (id) => (n) => { const g = salonGame(id); return g && g.format ? g.format(n) : fmtNum(n); };
const count = (fn, goal, label) => (me) => {
  const v = fn(me);
  return v > 0 ? { pct: Math.min(1, v / goal), text: `${Math.min(v, goal)}/${goal} ${label}` } : null;
};

// ------------------------------------------------------------------ rozet tablosu
// group: salon | oyun | quiz | topluluk
export const BADGES = [
  // --- Salon
  { id: 'ilk-kan', group: 'salon', name: 'İlk Kan', icon: 'sword', color: 'var(--dire)',
    how: 'Salondaki herhangi bir oyunda ilk skorunu yaz.',
    test: (me) => playedCount(me) >= 1 },
  { id: 'mudavim', group: 'salon', name: 'Salon Müdavimi', icon: 'gamepad', color: 'var(--ember)',
    how: `${T.mudavim} farklı oyunda skor yap.`,
    test: (me) => playedCount(me) >= T.mudavim,
    progress: count(playedCount, T.mudavim, 'oyun') },
  { id: 'aegis', group: 'salon', name: 'Aegis Sahibi', icon: 'shield', color: 'var(--aegis)',
    how: `Salondaki ${SALON_IDS.length} oyunun hepsinde rekorun olsun.`,
    test: (me) => playedCount(me) >= SALON_IDS.length,
    progress: count(playedCount, SALON_IDS.length, 'oyun') },

  // --- Oyunlar
  { id: 'doquz', group: 'oyun', game: 'arena', name: '1vDOQUZ', icon: 'bow', color: 'var(--aegis)',
    how: `Arena’da ilk dalgayı, dokuz DOG’u temizle (${fmtNum(T.arena)} puan).`,
    test: atLeast('arena', T.arena), progress: upTo('arena', T.arena, unit('puan')) },
  { id: 'arena-efsane', group: 'oyun', game: 'arena', name: 'Arena Efsanesi', icon: 'crown', color: 'var(--aegis-2)',
    how: `Arena’da ${fmtNum(T.arenaEfsane)} puan topla.`,
    test: atLeast('arena', T.arenaEfsane), progress: upTo('arena', T.arenaEfsane, unit('puan')) },
  { id: 'roshan-avcisi', group: 'oyun', game: 'arena', name: 'Roshan Avcısı', icon: 'skull', color: 'var(--aegis)',
    how: 'Arena’da Kaya Canavarı’nı (Roshan) kes. Aegis senin, peynir de.',
    test: (me) => pickNum(me, 'arena:roshan') >= T.arenaRoshan },
  { id: 'on-dalga', group: 'oyun', game: 'arena', name: 'On Dalga', icon: 'flag', color: 'var(--radiant)',
    how: `Arena’da ${T.arenaDalga}. dalgaya ulaş. Dokuz DOG’u on kez dizmek gibi.`,
    test: (me) => pickNum(me, 'arena:dalga') >= T.arenaDalga,
    progress: (me) => { const v = pickNum(me, 'arena:dalga'); return v > 0 ? { pct: Math.min(1, v / T.arenaDalga), text: `En iyi dalgan: ${v}` } : null; } },
  { id: 'dort-yuz', group: 'oyun', game: 'arena', name: 'Dört Yüz', icon: 'mask', color: 'var(--arcane)',
    how: `Okçu, Balta, Buz Cadısı ve Gölge’nin her biriyle ilk dalgayı temizle (${fmtNum(T.arenaHero)} puan).`,
    test: (me) => arenaHeroCount(me) >= ARENA_HEROES.length, progress: count(arenaHeroCount, ARENA_HEROES.length, 'kahraman') },
  { id: 'lanet-ustasi', group: 'oyun', game: 'arena', name: 'Lanet Ustası', icon: 'flame', color: 'var(--dire)',
    how: `Arena’da Lanet ${T.arenaLanet} ya da üstüyle 5. dalgaya ulaş. İsteğe bağlı acı.`,
    test: (me) => pickNum(me, 'arena:lanet') >= T.arenaLanet,
    progress: (me) => { const v = pickNum(me, 'arena:lanet'); return v > 0 ? { pct: Math.min(1, v / T.arenaLanet), text: `En yüksek Lanet: ${v}` } : null; } },
  { id: 'kurye-yoldasi', group: 'oyun', game: 'arena', name: 'Kurye’nin Yoldaşı', icon: 'courier', color: 'var(--radiant)',
    how: 'Arena hikâyesi Dokuzun Laneti’nde I. bölümü (Nehir Kıyısı) bitir.',
    test: (me) => pickNum(me, 'arena:story') >= 1 },
  { id: 'lanet-kirici', group: 'oyun', game: 'arena', name: 'Lanet Kırıcı', icon: 'ancient', color: 'var(--ember)',
    how: `Dokuzun Laneti’nin ${T.arenaStory} bölümünü de bitir: DOG’lar yeniden takım arkadaşı olsun.`,
    test: (me) => pickNum(me, 'arena:story') >= T.arenaStory, progress: count((me) => pickNum(me, 'arena:story'), T.arenaStory, 'bölüm') },
  { id: 'report', group: 'oyun', game: 'dogavi', name: 'Report Makinesi', icon: 'paw', color: 'var(--ember)',
    how: `DOG Avı’nda ${fmtNum(T.dogavi)} puan.`,
    test: atLeast('dogavi', T.dogavi), progress: upTo('dogavi', T.dogavi, unit('puan')) },
  { id: 'lasthit', group: 'oyun', game: 'lasthit', name: 'Last Hit Tanrısı', icon: 'coin', color: 'var(--aegis)',
    how: `Last Hit Ustası’nda ${fmtNum(T.lasthit)} altın.`,
    test: atLeast('lasthit', T.lasthit), progress: upTo('lasthit', T.lasthit, unit('altın')) },
  { id: 'hafiza', group: 'oyun', game: 'hafiza', name: 'Hafıza Kralı', icon: 'brain', color: 'var(--arcane)',
    how: `DOG Hafıza’da ${fmtNum(T.hafiza)} puan (4×4 masa).`,
    test: atLeast('hafiza', T.hafiza), progress: upTo('hafiza', T.hafiza, unit('puan')) },
  { id: 'refleks', group: 'oyun', game: 'rune', name: 'Refleks Canavarı', icon: 'bolt', color: 'var(--radiant)',
    how: `Rune Refleksi ortalaman ${T.rune} ms ya da altı.`,
    test: atMost('rune', T.rune), progress: downTo('rune', unit('ms')) },
  { id: 'dedektif', group: 'oyun', game: 'dogdle', name: 'Günlük Dedektif', icon: 'eye', color: 'var(--aegis-2)',
    how: 'DOGdle’da günün kahramanını bir kez bul.',
    test: (me) => has(me, 'dogdle') },
  { id: 'tek-atis', group: 'oyun', game: 'dogdle', name: 'Tek Atış', icon: 'target', color: 'var(--aegis)',
    how: `DOGdle’ı en fazla ${T.dogdleSharp} tahminde çöz.`,
    test: atMost('dogdle', T.dogdleSharp), progress: downTo('dogdle', unit('tahmin')) },
  { id: 'portre', group: 'oyun', game: 'portre', name: 'Portre Uzmanı', icon: 'target', color: 'var(--radiant)',
    how: `Portre Avı’nda ${fmtNum(T.portre)} puan.`,
    test: atLeast('portre', T.portre), progress: upTo('portre', T.portre, unit('puan')) },
  { id: 'invoker', group: 'oyun', game: 'invoker', name: 'Invoker Çırağı', icon: 'orbs', color: 'var(--arcane)',
    how: `Invoker Kombo’da 60 saniyede ${T.invoker} büyü.`,
    test: atLeast('invoker', T.invoker), progress: upTo('invoker', T.invoker, unit('büyü')) },
  { id: 'kanca', group: 'oyun', game: 'hook', name: 'Kanca Ustası', icon: 'hook', color: 'var(--dire)',
    how: `Pudge Hook’ta ${fmtNum(T.hook)} puan.`,
    test: atLeast('hook', T.hook), progress: upTo('hook', T.hook, unit('puan')) },
  { id: 'bingo', group: 'oyun', game: 'bingo', name: 'Bingo!', icon: 'star', color: 'var(--ember-2)',
    how: 'DOG Bingo’da bir çizgi tamamla: satır, sütun ya da çapraz.',
    test: atLeast('bingo', T.bingo) },
  { id: 'bottle', group: 'oyun', game: 'kurye', name: 'Bottle Teslimatı', icon: 'bottle', color: 'var(--radiant)',
    how: `Uçan Kurye’de ${fmtNum(T.kurye)} metre uç: bottle mid’e ulaşsın.`,
    test: atLeast('kurye', T.kurye), progress: upTo('kurye', T.kurye, unit('metre')) },
  { id: 'efsane-kurye', group: 'oyun', game: 'kurye', name: 'Efsane Kurye', icon: 'courier', color: 'var(--aegis-2)',
    how: `Uçan Kurye’de ${fmtNum(T.kuryeEfsane)} metre uç. Mid’ci sana bir bottle borçlu.`,
    test: atLeast('kurye', T.kuryeEfsane), progress: upTo('kurye', T.kuryeEfsane, unit('metre')) },
  { id: 'mayin-temiz', group: 'oyun', game: 'mayin', name: 'Mayın Temizleyici', icon: 'mine', color: 'var(--dire)',
    how: 'Techies Mayın Tarlası’nda bir Orta tahtayı (16×16, 40 mayın) temizle.',
    test: (me) => has(me, 'mayin') },
  { id: 'sentry', group: 'oyun', game: 'mayin', name: 'Sentry Ustası', icon: 'ward', color: 'var(--arcane)',
    how: `Orta tahtayı ${T.mayinSentry} saniye ya da daha kısa sürede temizle.`,
    test: atMost('mayin', T.mayinSentry), progress: downTo('mayin', fmtGame('mayin')) },
  { id: 'bkb', group: 'oyun', game: 'esya', name: 'BKB Bastın', icon: 'bkb', color: 'var(--aegis)',
    how: `Eşya 2048’de ${fmtNum(T.esya)} puan topla.`,
    test: atLeast('esya', T.esya), progress: upTo('esya', T.esya, unit('puan')) },
  { id: 'rapier', group: 'oyun', game: 'esya', name: 'Divine Rapier', icon: 'rapier', color: 'var(--dire)',
    how: 'Eşya 2048’de iki Butterfly’ı birleştir, Divine Rapier’e ulaş.',
    test: (me) => pickNum(me, 'esya:tier') >= T.esyaRapier,
    progress: (me) => {
      const t = Math.min(ESYA_TIERS.length - 1, Math.floor(pickNum(me, 'esya:tier')));
      if (t > 0) return { pct: Math.min(1, t / T.esyaRapier), text: `En iyi eşyan: ${ESYA_TIERS[t]}` };
      const v = scoreOf(me, 'esya');
      return v == null ? null : { pct: null, text: `En iyin: ${fmtNum(v)} puan` };
    } },
  { id: 'maraton-tamam', group: 'oyun', game: 'maraton', name: 'Maraton Tamam', icon: 'sun', color: 'var(--aegis)',
    how: '24 Saat Maraton’da yayını 24:00’e taşı. (Asgari süre, biliyoruz.)',
    test: (me) => pickNum(me, 'maraton:tamam') >= T.maratonTamam,
    progress: (me) => { const v = scoreOf(me, 'maraton'); return v == null ? null : { pct: null, text: `En iyin: ${fmtNum(v)} izleyici` }; } },
  { id: 'kick-fenomen', group: 'oyun', game: 'maraton', name: 'Kick Fenomeni', icon: 'kick', color: 'var(--radiant)',
    how: `24 Saat Maraton’da ${fmtNum(T.maratonFenomen)} izleyici zirvesi yap.`,
    test: atLeast('maraton', T.maratonFenomen), progress: upTo('maraton', T.maratonFenomen, unit('izleyici')) },

  // --- Quizler
  { id: 'teshis', group: 'quiz', name: 'Teşhis Kondu', icon: 'mask', color: 'var(--ember)',
    how: '“Hangi DOG’sun?” testini çöz, türünü öğren.',
    test: (me) => !!(me && me.picks && me.picks.hangidog), href: '#quizler--hangidog' },
  { id: 'hayran', group: 'quiz', name: 'Gerçek Hayran', icon: 'crown', color: 'var(--aegis)',
    how: `Gerçek Hayran Testi’nde 12 sorudan en az ${T.hayran} doğru.`,
    test: atLeast('hayran', T.hayran), progress: upTo('hayran', T.hayran, (n) => `${n}/12`), href: '#quizler--hayran' },
  { id: 'bilgi', group: 'quiz', name: 'Bilgi Küpü', icon: 'quiz', color: 'var(--arcane)',
    how: `Dota 2 Bilgi Yarışması’nda ${fmtNum(T.bilgi)} puan.`,
    test: atLeast('bilgi', T.bilgi), progress: upTo('bilgi', T.bilgi, unit('puan')), href: '#quizler--bilgi' },
  { id: 'yetenek', group: 'quiz', name: 'Yetenek Avcısı', icon: 'swords', color: 'var(--radiant)',
    how: 'Yetenek Avı quizini bitir.',
    test: (me) => has(me, 'yetenek'), href: '#quizler--yetenek' },
  { id: 'endeks', group: 'quiz', name: 'Endeks Uzmanı', icon: 'dice', color: 'var(--dire)',
    how: `Kahramanlar’daki “Daha DOG mu?” serisinde ${T.daha} doğru.`,
    test: atLeast('daha', T.daha), progress: upTo('daha', T.daha, unit('doğru')), href: '#kahramanlar' },

  // --- Topluluk
  { id: 'dogdogdog', group: 'topluluk', name: 'DOG DOG DOG', icon: 'paw', color: 'var(--ember)',
    how: `DOG düğmesine ${T.dog} kez bas. Üç kez söylenir.`,
    test: (me) => dogCount(me) >= T.dog, progress: count(dogCount, T.dog, 'DOG') },
  { id: 'maraton', group: 'topluluk', name: '24 Saat Ruhu', icon: 'hourglass', color: 'var(--aegis-2)',
    how: `DOG düğmesine ${T.maraton} kez bas: en kısa yayın kadar.`,
    test: (me) => dogCount(me) >= T.maraton, progress: count(dogCount, T.maraton, 'DOG') },
  { id: 'elestirmen', group: 'topluluk', name: 'Espri Eleştirmeni', icon: 'laugh', color: 'var(--radiant)',
    how: `Espri Duvarı’nda ${T.critic} espriyi DOG’la.`,
    test: (me) => jokeLikes(me) >= T.critic, progress: count(jokeLikes, T.critic, 'espri'), href: '#espriler' },
];

export const BADGE_GROUPS = { salon: 'Salon', oyun: 'Oyunlar', quiz: 'Quizler', topluluk: 'Topluluk' };

// ------------------------------------------------------------------ API
function safeTest(b, me) {
  try { return !!b.test(me || {}); } catch { return false; }
}

/** Kazanılmış rozet nesneleri (tablo sırasıyla). */
export function earnedBadges(me = store.me.get()) {
  return BADGES.filter((b) => safeTest(b, me));
}

/** Kazanılmış rozet kimlikleri kümesi. */
export function earnedSet(me = store.me.get()) {
  return new Set(earnedBadges(me).map((b) => b.id));
}

/** Kilitli rozet için ilerleme: { pct (0–1 ya da null), text } | null */
export function badgeProgress(b, me = store.me.get()) {
  if (!b.progress) return null;
  try { return b.progress(me || {}) || null; } catch { return null; }
}

/** Rozete bağlantı: oyun rozetleri oyuna, diğerleri kendi bölümüne. */
export function badgeHref(b) {
  if (b.href) return b.href;
  if (b.game) return `#oyunlar--${b.game}`;
  return '#oyunlar';
}

/**
 * Sayfa açıldıktan sonra yeni kazanılan rozetleri bildirir. Taban çizgisi veri katmanı hazır
 * olduktan sonra alınır (paylaşılan arka uçtan gelen eski skorlar "yeni" sayılmaz).
 * onNew([rozet, …]) — kapatma fonksiyonu döndürür.
 */
export function watchBadges(st = store, onNew = () => {}) {
  let alive = true;
  let unsub = null;
  const ready = st.ready && typeof st.ready.then === 'function' ? st.ready : Promise.resolve();
  ready.then(() => {
    if (!alive) return;
    const known = new Set(earnedBadges(st.me.get()).map((b) => b.id));
    unsub = st.me.subscribe((me) => {
      const now = earnedBadges(me);
      const fresh = now.filter((b) => !known.has(b.id));
      if (!fresh.length) return;
      fresh.forEach((b) => known.add(b.id));
      try { onNew(fresh); } catch (e) { console.error(e); }
    });
  });
  return () => {
    alive = false;
    if (unsub) unsub();
  };
}

/** Rozet bildirimi (toast + kısa ses). */
export function toastBadge(b) {
  const node = h('span', { class: 'bdg-toast', style: { '--bc': b.color } },
    h('span', { class: 'bdg-toast-ico', 'aria-hidden': 'true' }, icon(b.icon, { size: 20, stroke: 2 })),
    h('span', { class: 'bdg-toast-text' },
      h('span', { class: 'bdg-toast-eyebrow' }, 'Yeni rozet'),
      h('strong', null, b.name),
    ),
  );
  fx.toast(node, 'jade', 3600);
  sound.coin();
}

let watcherStop = null;
/**
 * Küresel rozet izleyicisi (tekil). games.js ve home.js modül yüklenirken çağırır; kabuk da
 * (main.js / shell.js) çağırabilir — ikinci ve sonraki çağrılar etkisizdir.
 */
export function ensureBadgeWatcher() {
  if (watcherStop) return watcherStop;
  let queue = Promise.resolve();
  watcherStop = watchBadges(store, (list) => {
    // Sonuç kartı / konfeti ile çakışmasın: kısa bir gecikme ve rozetler arasında aralık
    list.forEach((b, i) => {
      queue = queue.then(() => new Promise((res) => setTimeout(() => { toastBadge(b); res(); }, i === 0 ? 1100 : 900)));
    });
  });
  return watcherStop;
}

// Rozet bildirimi stilleri küçük olduğu için burada: kabuk CSS'ine dokunmadan her sayfada çalışır.
// Bildirim tıklamaları geçirir (sonuç kartının düğmelerinin üstüne düşebilir).
let styled = false;
(function injectStyle() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const css = `.toast:has(.bdg-toast){pointer-events:none}
.bdg-toast{display:flex;align-items:center;gap:10px;min-width:0}
.bdg-toast-ico{flex:none;display:grid;place-items:center;width:36px;height:36px;color:var(--bc,var(--aegis));background:radial-gradient(circle at 50% 35%,color-mix(in srgb,var(--bc,var(--aegis)) 30%,transparent),transparent 70%),linear-gradient(160deg,var(--bg-4),var(--bg));border:1px solid color-mix(in srgb,var(--bc,var(--aegis)) 60%,var(--line-2));clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
.bdg-toast-text{display:flex;flex-direction:column;gap:1px;min-width:0}
.bdg-toast-eyebrow{font-family:var(--font-lore);font-weight:700;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--aegis)}
.bdg-toast-text strong{font-weight:700;color:var(--text)}`;
  const el = document.createElement('style');
  el.dataset.badges = '';
  el.textContent = css;
  (document.head || document.documentElement).appendChild(el);
})();
