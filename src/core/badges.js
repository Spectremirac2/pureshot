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
// Oyun modüllerini içe aktarmadan (ana sayfa gibi hafif sayfalar için) salonun oyun listesi.
// Kimlikler games.js'teki meta.id değerleriyle aynıdır; ad/simge yalnızca metin ve vitrin içindir.
export const SALON_GAMES = [
  { id: 'arena', name: '1vDOQUZ Arena', short: 'Arena', icon: 'bow', color: 'var(--aegis)' },
  { id: 'dogavi', name: 'DOG Avı', short: 'DOG Avı', icon: 'paw', color: 'var(--ember)' },
  { id: 'lasthit', name: 'Last Hit Ustası', short: 'Last Hit', icon: 'coin', color: 'var(--aegis)' },
  { id: 'hafiza', name: 'DOG Hafıza', short: 'Hafıza', icon: 'brain', color: 'var(--arcane)' },
  { id: 'rune', name: 'Rune Refleksi', short: 'Rune', icon: 'bolt', color: 'var(--radiant)' },
  { id: 'dogdle', name: 'DOGdle', short: 'DOGdle', icon: 'eye', color: 'var(--aegis-2)', kind: 'Günlük tahmin', isNew: true },
  { id: 'portre', name: 'Portre Avı', short: 'Portre', icon: 'target', color: 'var(--radiant)', kind: 'Göz · Refleks', isNew: true },
  { id: 'invoker', name: 'Invoker Kombo', short: 'Invoker', icon: 'orbs', color: 'var(--arcane)', kind: 'Parmak · Refleks', isNew: true },
  { id: 'hook', name: 'Pudge Hook', short: 'Hook', icon: 'hook', color: 'var(--dire)', kind: 'Nişan · Beceri', isNew: true },
  { id: 'bingo', name: 'DOG Bingo', short: 'Bingo', icon: 'star', color: 'var(--ember)', kind: 'Yayın · Etkileşim', isNew: true },
];
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
  arenaEfsane: 6000, // ≈ 3–4 dalga
  dogdleSharp: 2, // tahmin — DÜŞÜK iyi
  portre: 3000, // puan (10 tur × 100–500, seri çarpanı ×2'ye kadar)
  invoker: 15, // büyü / 60 sn
  hook: 1500, // puan (düşman 100, uzun kanca +50, seri ×2/×3)
  bingo: 1, // tamamlanan çizgi
  hayran: 10, // 12 sorudan doğru
  bilgi: 1200, // puan (10 soru × 100 + hız bonusu)
  daha: 10, // "Daha DOG mu?" serisi
  dog: 3, // DOG düğmesi (üç kez söylenir)
  maraton: 24, // DOG düğmesi (en kısa yayın: 24 saat)
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
const dogCount = (me) => Math.max(0, Number(me && me.dog) || 0);
const jokeLikes = (me) => Object.keys((me && me.likes) || {}).filter((k) => k.startsWith('jk:')).length;
const T = THRESHOLDS;

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
