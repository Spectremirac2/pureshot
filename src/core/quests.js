// Günlük Görevler + Fan seviyesi (XP). Belge: docs/PROFIL.md
//
// Her İstanbul günü (UTC+3, gece yarısı sıfırlanır) havuzdaki ~20 şablondan 3 görev seçilir; seçim gün
// numarasından tohumlanır, herkes aynı gün aynı görevleri görür. İlerleme hiçbir oyuna dokunmadan türetilir:
//   • history.since(istanbulDayStart())  — bugünkü oyun/quiz denemeleri (store.me.submitScore yazar)
//   • günlük anlık görüntü (csk:quests:snap) — gün başındaki DOG sayısı, DOG’lanan espriler, rekorlar
//   • quiz son sonuçları (csk:qz:last, “Hangi DOG’sun?” skoru olmadığı için)
//
// API
//   todayQuests(now)        [{ id, text, hint, icon, color, href, target, group }] bugünün 3 görevi
//   questStatus(now)        [{ …görev, done, progress, target, detail }] (salt okunur; tamamlananı kaydetmez)
//   syncQuests(now)         durumu hesaplar, yeni tamamlananları kaydeder (+ bildirim, günde bir kez); durum döndürür
//   completedQuestCount()   ömür boyu tamamlanan görev sayısı
//   questStreak(now)        { current, best, todayAll } — üç görevin de bittiği art arda günler
//   subscribeQuests(fn)     fn(durum) — geçmiş / profil / gün değişince; kapatma fonksiyonu döner
//   ensureQuestWatcher()    küresel tekil izleyici (tamamlanınca bildirim); kaç kez çağrılırsa çağrılsın bir kez kurulur
//   msToReset(now)          İstanbul gece yarısına kalan ms · questDay(now) İstanbul gün numarası
//   fanXp(me) / fanLevel(xp) / playedIds(me)  seviye sistemi (XP formülü aşağıda)

import { h, ls, seeded, hashStr, fmtNum } from './dom.js';
import { icon } from './icons.js';
import { store } from './store.js';
import { history, istanbulDayStart } from './history.js';
import { earnedBadges } from './badges.js';
import { fx } from './fx.js';
import { sound } from './sound.js';

const DAY = 86400e3;
const TZ = 3 * 3600e3;
const SNAP_KEY = 'quests:snap';
const LOG_KEY = 'quests:log';
const KEEP_DAYS = 60;
export const QUESTS_PER_DAY = 3;
export const QUEST_XP = 50;

/** İstanbul takvim günü (epoch’tan gün sayısı). DOGdle’ın istanbulDay() değeriyle aynıdır. */
export const questDay = (now = Date.now()) => Math.floor((now + TZ) / DAY);
/** Sonraki sıfırlamaya (İstanbul gece yarısı) kalan ms. */
export const msToReset = (now = Date.now()) => istanbulDayStart(now) + DAY - now;

// ------------------------------------------------------------------ kimlik kümeleri
/** Salon oyunları (günlük görevlerde “oyun” sayılanlar). */
export const QUEST_GAME_IDS = ['arena', 'dogavi', 'lasthit', 'hafiza', 'rune', 'dogdle', 'portre', 'invoker', 'hook', 'bingo', 'kurye', 'mayin', 'esya', 'maraton'];
/** Skor yazan quizler (+ “Hangi DOG’sun?” csk:qz:last üzerinden). */
const QUIZ_IDS = ['bilgi', 'dogmu', 'hayran', 'yetenek'];

// ------------------------------------------------------------------ günlük bağlam
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const tamamOf = (me) => Math.max(0, Number(me && me.picks ? me.picks['maraton:tamam'] : 0) || 0);

function readSnap() {
  const s = ls.get(SNAP_KEY, null);
  return s && typeof s === 'object' ? s : null;
}

/** Günün anlık görüntüsü: ilk değerlendirmede (ya da gün değişince) alınır. */
function ensureSnap(now, me) {
  const day = questDay(now);
  const s = readSnap();
  if (s && s.day === day) {
    // Eski sürümün bugünkü görüntüsünde Maraton sayacı yoksa şimdiki değerle tamamla (bir kez)
    if (typeof s.mt !== 'number') { s.mt = tamamOf(me); ls.set(SNAP_KEY, s); }
    return s;
  }
  const fresh = {
    day,
    at: now,
    dog: Math.max(0, Number(me.dog) || 0),
    likes: Object.keys(me.likes || {}).filter((k) => k.startsWith('jk:')),
    scores: { ...(me.scores || {}) },
    mt: tamamOf(me), // 24 Saat Maraton: 24:00'e varan yayın sayacı (picks['maraton:tamam'])
  };
  ls.set(SNAP_KEY, fresh);
  return fresh;
}

function makeCtx(now) {
  const start = istanbulDayStart(now);
  const me = store.me.get() || {};
  const today = history.since(start).filter((e) => e.t < start + DAY);
  const by = {};
  for (const e of today) (by[e.id] || (by[e.id] = [])).push(e);
  const snap = ensureSnap(now, me);
  const qz = ls.get('qz:last', {}) || {};
  return { now, start, me, today, by, snap, qz };
}

const bestUp = (c, id) => {
  const l = c.by[id];
  return l && l.length ? Math.max(...l.map((e) => e.s)) : null;
};
const bestDown = (c, id) => {
  const l = c.by[id];
  return l && l.length ? Math.min(...l.map((e) => e.s)) : null;
};
const played = (c, id) => (c.by[id] ? c.by[id].length : 0);
const gamesToday = (c) => QUEST_GAME_IDS.filter((id) => played(c, id) > 0);
const quizDoneToday = (c) =>
  QUIZ_IDS.some((id) => played(c, id) > 0) ||
  Object.values(c.qz).some((v) => v && typeof v === 'object' && Number(v.at) >= c.start);

/** Bugün kırılan rekor var mı? Anlık görüntüden sonra değişen en iyi skor ya da (görüntüden önceki
 *  denemeler için) bugünkü denemesi en iyi skora eşit olup daha önceki denemelerini geçen oyun. */
function recordIdsToday(c) {
  const out = new Set();
  const scores = c.me.scores || {};
  for (const [id, v] of Object.entries(scores)) {
    if (num(v) != null && c.snap.scores && c.snap.scores[id] !== v && played(c, id) > 0) out.add(id);
  }
  for (const id of Object.keys(c.by)) {
    if (out.has(id)) continue;
    const best = num(scores[id]);
    if (best == null) continue;
    const early = c.by[id].filter((e) => e.t < (c.snap.at || 0));
    if (!early.some((e) => e.s === best)) continue;
    const before = history.get(id).filter((e) => e.t < c.start);
    if (!before.some((e) => e.s === best)) out.add(id);
  }
  return [...out];
}

// ------------------------------------------------------------------ görev havuzu
// group: game (belirli oyun) · quiz · social (DOG düğmesi / espri) · general (salon geneli)
// value(c) → sayı (hedefe karşı ilerleme) ya da { value, done?, detail? }
const G = (id, game, text, extra) => ({ id, group: 'game', game, href: `#oyunlar--${game}`, ...extra, text });
const upQuest = (id, game, goal, text, unit, extra = {}) => G(id, game, text, {
  target: goal,
  ...extra,
  value: (c) => {
    const b = bestUp(c, game);
    return { value: b ?? 0, detail: b != null ? `Bugünkü en iyin: ${fmtNum(b)} ${unit}` : null };
  },
});
const playQuest = (id, game, text, extra = {}) => G(id, game, text, {
  target: 1,
  ...extra,
  value: (c) => played(c, game),
});

export const QUEST_POOL = [
  // --- Oyunlar
  G('dogdle', 'dogdle', 'Günün DOGdle’ını çöz', {
    icon: 'eye', color: 'var(--aegis-2)', target: 1,
    hint: 'Gizli kahramanı bul; tahmin sayısı fark etmez.',
    value: (c) => {
      const b = bestDown(c, 'dogdle');
      return { value: b != null ? 1 : 0, detail: b != null ? `${fmtNum(b)} tahminde buldun` : null };
    },
  }),
  upQuest('invoker10', 'invoker', 10, 'Invoker Kombo’da 10+ büyü çağır', 'büyü', { icon: 'orbs', color: 'var(--arcane)', hint: '60 saniyelik zaman saldırısında.' }),
  upQuest('hook800', 'hook', 800, 'Pudge Hook’ta 800+ puan topla', 'puan', { icon: 'hook', color: 'var(--dire)', hint: 'Dosta kanca atan DOG olur.' }),
  G('rune350', 'rune', 'Rune Refleksi’nde 350 ms altına in', {
    icon: 'bolt', color: 'var(--radiant)', target: 1,
    hint: 'Beş turun ortalaması sayılır.',
    value: (c) => {
      const b = bestDown(c, 'rune');
      return { value: b != null && b < 350 ? 1 : 0, detail: b != null ? `Bugünkü en iyin: ${fmtNum(b)} ms` : null };
    },
  }),
  upQuest('dogavi500', 'dogavi', 500, 'DOG Avı’nda 500+ puan yap', 'puan', { icon: 'paw', color: 'var(--ember)', hint: 'Report tuşunun bekleme süresi yok.' }),
  upQuest('lasthit350', 'lasthit', 350, 'Last Hit Ustası’nda 350+ altın kas', 'altın', { icon: 'coin', color: 'var(--aegis)', hint: 'Deny de altındır.' }),
  upQuest('hafiza500', 'hafiza', 500, 'DOG Hafıza’da 500+ puan', 'puan', { icon: 'brain', color: 'var(--arcane)', hint: '4×4 masada; az hamle, çok puan.' }),
  upQuest('portre1500', 'portre', 1500, 'Portre Avı’nda 1.500+ puan', 'puan', { icon: 'target', color: 'var(--radiant)', hint: 'Erken tanıyan çok kazanır.' }),
  upQuest('arena1200', 'arena', 1200, '1vDOQUZ Arena’da ilk dalgayı temizle', 'puan', { icon: 'bow', color: 'var(--aegis)', hint: '1.200 puan: dokuz DOG ve dalga bonusu.' }),
  upQuest('bingo1', 'bingo', 1, 'DOG Bingo’da bir çizgi tamamla', 'çizgi', { icon: 'star', color: 'var(--ember-2)', hint: 'Satır, sütun ya da çapraz.' }),
  // 2. tur oyunları (eşikler rozetlerin altında: kurye 300, esya 2500)
  upQuest('kurye200', 'kurye', 200, 'Uçan Kurye’de 200+ metre uç', 'metre', { icon: 'courier', color: 'var(--radiant)', hint: 'Her şişe +25 metre sayılır.' }),
  G('mayinOrta', 'mayin', 'Mayın Tarlası’nda Orta tahtayı temizle', {
    icon: 'mine', color: 'var(--dire)', target: 1,
    hint: '16×16, 40 mayın; süre fark etmez.',
    value: (c) => {
      // Yalnızca kazanılan Orta tahtası skor yazar
      const b = bestDown(c, 'mayin');
      return { value: b != null ? 1 : 0, detail: b != null ? `Bugünkü en iyin: ${b.toFixed(1).replace('.', ',')} sn` : null };
    },
  }),
  upQuest('esya1000', 'esya', 1000, 'Eşya 2048’de 1.000+ puan topla', 'puan', { icon: 'rapier', color: 'var(--aegis)', hint: 'Büyük eşyaları bir köşede biriktir.' }),
  G('maraton24', 'maraton', '24 Saat Maraton’u 24:00’e taşı', {
    icon: 'sun', color: 'var(--ember)', target: 1,
    hint: 'Enerjiyi izle; 24 saat asgari süre.',
    value: (c) => {
      // picks['maraton:tamam'] ömür boyu sayaçtır; bugünkü artış günün anlık görüntüsüne göre
      const done = Math.max(0, tamamOf(c.me) - (Number(c.snap.mt) || 0));
      const b = bestUp(c, 'maraton');
      return { value: done > 0 ? 1 : 0, detail: done ? null : b != null ? `Bugünkü zirve: ${fmtNum(b)} izleyici` : null };
    },
  }),

  // --- Quizler
  { id: 'quiz', group: 'quiz', icon: 'quiz', color: 'var(--arcane)', href: '#quizler', target: 1,
    text: 'Bir quiz bitir', hint: 'Beş quizden herhangi biri.',
    value: (c) => (quizDoneToday(c) ? 1 : 0) },
  { id: 'hayran8', group: 'quiz', icon: 'crown', color: 'var(--aegis)', href: '#quizler--hayran', target: 8,
    text: 'Gerçek Hayran Testi’nde 8+ doğru', hint: '12 sorudan en az 8’i.',
    value: (c) => { const b = bestUp(c, 'hayran'); return { value: b ?? 0, detail: b != null ? `Bugünkü en iyin: ${b}/12` : null }; } },
  { id: 'yetenek', group: 'quiz', icon: 'spell', color: 'var(--radiant)', href: '#quizler--yetenek', target: 1,
    text: 'Yetenek Avı quizini bitir', hint: 'Yetenekten kahramanı bul.',
    value: (c) => played(c, 'yetenek') },
  { id: 'daha5', group: 'quiz', icon: 'dice', color: 'var(--dire)', href: '#kahramanlar--daha', target: 5,
    text: '“Daha DOG mu?” serisinde 5 doğru', hint: 'Kahramanlar bölümünde.',
    value: (c) => { const b = bestUp(c, 'daha'); return { value: b ?? 0, detail: b != null ? `Bugünkü en iyi serin: ${b}` : null }; } },

  // --- Topluluk
  { id: 'dog10', group: 'social', icon: 'paw', color: 'var(--ember)', action: 'dog', target: 10,
    text: 'DOG düğmesine 10 kez bas', hint: 'Üç kez söylenir, on kez basılır.',
    value: (c) => Math.max(0, (Number(c.me.dog) || 0) - (Number(c.snap.dog) || 0)) },
  { id: 'like1', group: 'social', icon: 'laugh', color: 'var(--radiant)', href: '#espriler', target: 1,
    text: 'Bir espriyi DOG’la', hint: 'Espri Duvarı’nda beğendiğin espri.',
    value: (c) => {
      const before = new Set(c.snap.likes || []);
      return Object.keys(c.me.likes || {}).filter((k) => k.startsWith('jk:') && !before.has(k)).length;
    } },

  // --- Salon geneli
  { id: 'cesit3', group: 'general', icon: 'gamepad', color: 'var(--ember)', href: '#oyunlar', target: 3,
    text: '3 farklı oyun oyna', hint: 'Salondaki herhangi üç oyun.',
    value: (c) => gamesToday(c).length },
  { id: 'tur5', group: 'general', icon: 'refresh', color: 'var(--aegis)', href: '#oyunlar', target: 5,
    text: 'Salonda 5 tur at', hint: 'Herhangi oyunlar, herhangi skor.',
    value: (c) => c.today.filter((e) => QUEST_GAME_IDS.includes(e.id)).length },
  { id: 'rekor', group: 'general', icon: 'trophy', color: 'var(--aegis-2)', href: '#oyunlar', target: 1,
    text: 'Bir oyunda rekorunu kır', hint: 'İlk skorun da rekordur.',
    value: (c) => (recordIdsToday(c).length ? 1 : 0) },
];

const CAPS = { game: 2, quiz: 1, social: 1, general: 1 };

/** Bugünün görevleri (deterministik: gün numarasından tohumlanır). En az bir oyun görevi. */
export function todayQuests(now = Date.now()) {
  const day = questDay(now);
  const rnd = seeded(hashStr('csk-gorev-' + day));
  const pool = QUEST_POOL.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const first = pool.find((q) => q.group === 'game');
  const picked = [first];
  const used = { game: 1 };
  for (const q of pool) {
    if (picked.length >= QUESTS_PER_DAY) break;
    if (picked.includes(q)) continue;
    if ((used[q.group] || 0) >= (CAPS[q.group] || 1)) continue;
    if (q.game && picked.some((p) => p.game === q.game)) continue;
    picked.push(q);
    used[q.group] = (used[q.group] || 0) + 1;
  }
  return picked.map(publicOf);
}

function publicOf(q) {
  const { value, ...rest } = q;
  return { ...rest };
}

/** Bugünün görevleri + ilerleme. */
export function questStatus(now = Date.now()) {
  const c = makeCtx(now);
  const byId = new Map(QUEST_POOL.map((q) => [q.id, q]));
  return todayQuests(now).map((q) => {
    let raw;
    try { raw = byId.get(q.id).value(c); } catch { raw = 0; }
    const r = typeof raw === 'object' && raw ? raw : { value: raw };
    const v = Number(r.value) || 0;
    const done = r.done != null ? !!r.done : v >= q.target;
    return { ...q, done, progress: Math.min(q.target, Math.max(0, v)), target: q.target, detail: r.detail || null };
  });
}

// ------------------------------------------------------------------ kayıt (ömür boyu sayaç + seri)
function readLog() {
  const l = ls.get(LOG_KEY, null);
  const base = { total: 0, days: {}, streak: { last: 0, count: 0, best: 0 } };
  if (!l || typeof l !== 'object') return base;
  return {
    total: Math.max(0, Number(l.total) || 0),
    days: l.days && typeof l.days === 'object' ? l.days : {},
    streak: { ...base.streak, ...(l.streak || {}) },
  };
}

/** Ömür boyu tamamlanan görev sayısı. */
export function completedQuestCount() {
  return readLog().total;
}

/** Üç görevin de bittiği art arda günler. current: bugün ya da dün tamamlandıysa sürer. */
export function questStreak(now = Date.now()) {
  const { streak, days } = readLog();
  const day = questDay(now);
  const alive = streak.last === day || streak.last === day - 1;
  const todayDone = Array.isArray(days[day]) ? days[day].length : 0;
  return { current: alive ? streak.count : 0, best: streak.best || 0, todayAll: streak.last === day, todayDone };
}

/** Görevleri değerlendirir, yeni tamamlananları kaydeder ve (günde bir kez) bildirir. Durumu döndürür. */
export function syncQuests(now = Date.now()) {
  const status = questStatus(now);
  const day = questDay(now);
  const log = readLog();
  const doneToday = new Set(Array.isArray(log.days[day]) ? log.days[day] : []);
  const fresh = status.filter((q) => q.done && !doneToday.has(q.id));
  if (!fresh.length) return status;
  fresh.forEach((q) => doneToday.add(q.id));
  log.days[day] = [...doneToday];
  log.total += fresh.length;
  const allDone = status.every((q) => doneToday.has(q.id));
  let allNow = false;
  if (allDone && log.streak.last !== day) {
    log.streak.count = log.streak.last === day - 1 ? log.streak.count + 1 : 1;
    log.streak.last = day;
    log.streak.best = Math.max(log.streak.best || 0, log.streak.count);
    allNow = true;
  }
  // Eski günleri buda (seri ayrı tutulur)
  const keys = Object.keys(log.days).map(Number).sort((a, b) => a - b);
  while (keys.length > KEEP_DAYS) delete log.days[keys.shift()];
  ls.set(LOG_KEY, log);
  announce(fresh, allNow ? log.streak.count : 0);
  return status;
}

// ------------------------------------------------------------------ bildirim
let toastQueue = Promise.resolve();
function announce(list, streakNow) {
  const items = list.map((q) => ({ q }));
  if (streakNow) items.push({ all: streakNow });
  items.forEach((it, i) => {
    toastQueue = toastQueue.then(() => new Promise((res) => setTimeout(() => { toastQuest(it); res(); }, i === 0 ? 1400 : 900)));
  });
}

function toastQuest({ q, all }) {
  const title = all ? 'Günün üç görevi tamam!' : q.text;
  const eyebrow = all ? `Seri: ${all} gün` : `Görev tamam · +${QUEST_XP} XP`;
  const node = h('span', { class: 'qst-toast', style: { '--qc': all ? 'var(--aegis)' : q.color || 'var(--ember)' } },
    h('span', { class: 'qst-toast-ico', 'aria-hidden': 'true' }, icon(all ? 'flame' : 'check', { size: 18, stroke: 2.2 })),
    h('span', { class: 'qst-toast-text' },
      h('span', { class: 'qst-toast-eyebrow' }, eyebrow),
      h('strong', null, title),
    ),
  );
  fx.toast(node, all ? 'jade' : 'ember', 3600);
  try { all ? sound.win() : sound.good(); } catch { /* ses kapalı */ }
}

// ------------------------------------------------------------------ abonelik
const subs = new Set();
let wired = false;
let timer = 0;
let dayTimer = 0;

function schedule() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = 0;
    let status;
    try { status = syncQuests(); } catch (e) { console.error(e); return; }
    for (const fn of subs) {
      try { fn(status); } catch (e) { console.error(e); }
    }
  }, 60);
}

function armDayTimer() {
  clearTimeout(dayTimer);
  dayTimer = setTimeout(() => { schedule(); armDayTimer(); }, Math.min(msToReset() + 500, 6 * 3600e3));
}

function wire() {
  if (wired) return;
  wired = true;
  history.subscribe(schedule);
  store.me.subscribe(schedule);
  // Başka sekmede oynanan oyunlar / basılan DOG’lar
  window.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith('csk:')) return;
    if (e.key === 'csk:' + LOG_KEY || e.key === 'csk:' + SNAP_KEY) return;
    schedule();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
  armDayTimer();
}

/** fn(durum) — ilk çağrı hemen (kısa gecikmeyle), sonra her değişiklikte. Kapatma fonksiyonu döndürür. */
export function subscribeQuests(fn) {
  wire();
  subs.add(fn);
  schedule();
  return () => subs.delete(fn);
}

let watching = false;
/** Küresel görev izleyicisi (tekil): tamamlanan görev sitenin her yerinde bildirilir. */
export function ensureQuestWatcher() {
  if (watching) return;
  watching = true;
  const start = () => { wire(); schedule(); };
  const ready = store.ready && typeof store.ready.then === 'function' ? store.ready : Promise.resolve();
  ready.then(start, start);
}

// ------------------------------------------------------------------ XP ve seviye
// XP = kazanılan rozet × 100 + ömür boyu tamamlanan görev × 50 + oynanan farklı oyun/quiz × 30
export const XP_RULES = { badge: 100, quest: QUEST_XP, game: 30 };

/** Oynanmış farklı oyun/quiz kimlikleri: skor tablosu ∪ deneme geçmişi ∪ “Hangi DOG’sun?” sonucu. */
export function playedIds(me = store.me.get()) {
  const ids = new Set();
  for (const [id, v] of Object.entries((me && me.scores) || {})) if (num(v) != null) ids.add(id);
  for (const [id, list] of Object.entries(history.all() || {})) if (Array.isArray(list) && list.length) ids.add(id);
  if (me && me.picks && me.picks.hangidog) ids.add('hangidog');
  return [...ids];
}

/** { xp, badges, quests, games } — XP ve kaynakları. */
export function fanXp(me = store.me.get()) {
  const badges = earnedBadges(me).length;
  const quests = completedQuestCount();
  const games = playedIds(me).length;
  return { xp: badges * XP_RULES.badge + quests * XP_RULES.quest + games * XP_RULES.game, badges, quests, games };
}

// Seviye L’ye gereken toplam XP: 100·(L−1) + 25·(L−1)·(L−2)  → 0, 100, 250, 450, 700, 1000, 1350…
// (her seviye bir öncekinden 50 XP daha fazla ister)
export const xpForLevel = (L) => 100 * (L - 1) + 25 * (L - 1) * (L - 2);

// Dota madalyaları: seviye aralığı → rütbe
export const RANKS = [
  { from: 1, name: 'Herald', color: '#9c8e6f' },
  { from: 3, name: 'Guardian', color: '#8fb3a8' },
  { from: 5, name: 'Crusader', color: '#43d6a0' },
  { from: 7, name: 'Archon', color: '#4ea8ff' },
  { from: 9, name: 'Legend', color: '#8b7cff' },
  { from: 11, name: 'Ancient', color: '#ff9a3d' },
  { from: 13, name: 'Divine', color: '#e9b949' },
  { from: 16, name: 'Immortal', color: '#e0354b' },
];

/** { level, rank, color, xp, floor, next, into, need, pct } */
export function fanLevel(xp) {
  const v = Math.max(0, Math.floor(Number(xp) || 0));
  let L = 1;
  while (xpForLevel(L + 1) <= v && L < 99) L++;
  const floor = xpForLevel(L);
  const next = xpForLevel(L + 1);
  const rank = RANKS.filter((r) => L >= r.from).pop();
  return { level: L, rank: rank.name, color: rank.color, xp: v, floor, next, into: v - floor, need: next - floor, pct: (v - floor) / (next - floor) };
}

// Görev bildirimi stilleri (kabuk CSS’ine dokunmadan her sayfada çalışsın diye burada)
(function injectStyle() {
  if (typeof document === 'undefined') return;
  const css = `.toast:has(.qst-toast){pointer-events:none}
.qst-toast{display:flex;align-items:center;gap:10px;min-width:0}
.qst-toast-ico{flex:none;display:grid;place-items:center;width:34px;height:34px;color:var(--qc,var(--ember));background:radial-gradient(circle at 50% 35%,color-mix(in srgb,var(--qc,var(--ember)) 30%,transparent),transparent 70%),linear-gradient(160deg,var(--bg-4),var(--bg));border:1px solid color-mix(in srgb,var(--qc,var(--ember)) 60%,var(--line-2));border-radius:50%}
.qst-toast-text{display:flex;flex-direction:column;gap:1px;min-width:0}
.qst-toast-eyebrow{font-family:var(--font-lore);font-weight:700;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--ember-2)}
.qst-toast-text strong{font-weight:700;color:var(--text)}`;
  const el = document.createElement('style');
  el.dataset.quests = '';
  el.textContent = css;
  (document.head || document.documentElement).appendChild(el);
})();
