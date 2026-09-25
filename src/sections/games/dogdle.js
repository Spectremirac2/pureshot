// DOGdle — günlük kahraman tahmini (Dotadle / Wordle tarzı).
// Her İstanbul takvim gününde (UTC+3, yaz saati yok) herkes aynı gizli kahramanı arar.
// Tahmin edilen kahraman; özellik, saldırı, karmaşıklık, roller, DOG% ve DOG türüyle karşılaştırılır.
// Günlük durum, seri ve tahmin dağılımı tarayıcıda (ls) saklanır; Serbest mod skora/seriye dokunmaz.

import './dogdle.css';
import { h, clear, fmtNum, fmtClock, ls, hashStr, seeded, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { sound } from '../../core/sound.js';
import { fx } from '../../core/fx.js';
import { store } from '../../core/store.js';
import { HEROES, ATTRS, ROLES, heroById } from '../../data/heroes.js';
import { ALL_TYPES } from '../../data/archetypes.js';
import { heroPortraitUrl } from '../../core/assets.js';
import { createRunner, gameLayout, hudStat, showOverlay, introCard, resultCard, submitResult, revealInView, isTyping, memeText } from './kit.js';
import { createHeroPicker } from './heropick.js';

// ------------------------------------------------------------------ sabitler
const DAY_MS = 86400000;
const TZ_MS = 3 * 3600000; // Europe/Istanbul: 2016'dan beri sabit UTC+3
const EPOCH_DAY = Math.floor(Date.UTC(2026, 8, 25) / DAY_MS); // 25 Eylül 2026 → DOGdle #1
const SITE_URL = 'https://cureshot-dog.netlify.app/#oyunlar--dogdle';
const QUOTE_AT = 4;
const PORTRAIT_AT = 7;
const SHARE_ROWS = 12;
const K = { day: 'dogdle:day', stats: 'dogdle:stats', prac: 'dogdle:practice', tab: 'dogdle:tab', seen: 'dogdle:seen' };

export const meta = {
  id: 'dogdle',
  name: 'DOGdle',
  short: 'DOGdle',
  icon: 'eye',
  color: 'var(--aegis-2)',
  kind: 'Günlük · Tahmin',
  blurb: 'Her gün bir gizli kahraman. Özellikleri karşılaştır, en az tahminle bul.',
  lore: 'Renkler yalan söylemez: yeşil yaklaştın, kırmızı DOG DOG DOG.',
  time: 'Günlük',
  diff: 2,
  unit: 'tahmin',
  higherIsBetter: false,
  format: (n) => `${fmtNum(n)} tahmin`,
  rules: [
    'Her gün İstanbul saatiyle gece yarısı yeni bir gizli kahraman gelir; herkes aynı kahramanı arar.',
    'Bir kahraman yaz ve seç: özellik, saldırı, karmaşıklık, roller, DOG% ve DOG türü karşılaştırılır.',
    'Yeşil aynı, sarı yakın (roller kısmen ortak ya da DOG% ±10 içinde), kırmızı farklı. Oklar gizli kahramanın değerini gösterir.',
    `${QUOTE_AT} tahminden sonra “Topluluk der ki”, ${PORTRAIT_AT} tahminden sonra bulanık portre ipucu açılır; açıp açmamak senin elinde.`,
    'Skor = tahmin sayısı, az olan kazanır. Seri için her gün bul. Serbest modda sınırsız oyna; skor ve seri etkilenmez.',
  ],
  keys: [['↑ ↓', 'Önerilerde gez'], ['Enter', 'Tahmini gönder'], ['Tab', 'Öneriyi tamamla'], ['Esc', 'Öneriyi kapat']],
};

// ------------------------------------------------------------------ gün ve gizli kahraman
/** İstanbul takvim günü (epoch'tan gün sayısı). */
export const istanbulDay = (now = Date.now()) => Math.floor((now + TZ_MS) / DAY_MS);
/** Bulmaca numarası: 25 Eylül 2026 = #1. */
export const puzzleNumber = (now = Date.now()) => Math.max(1, istanbulDay(now) - EPOCH_DAY + 1);
/** Sonraki bulmacaya (İstanbul gece yarısı) kalan ms. */
export const msToNext = (now = Date.now()) => (istanbulDay(now) + 1) * DAY_MS - TZ_MS - now;

// Kahraman listesinin dosya sırasından bağımsız, kimliğe göre sabit sırası
const BASE = HEROES.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const cycles = new Map();
/** c. döngünün karıştırılmış sırası: 127 gün boyunca hiçbir kahraman tekrar etmez. */
function cycleOrder(c) {
  if (cycles.has(c)) return cycles.get(c);
  const rnd = seeded(hashStr(`dogdle:cycle:${c}`));
  const a = BASE.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // Döngü sınırında aynı kahraman art arda iki gün gelmesin
  if (c > 0) {
    const prev = cycleOrder(c - 1);
    if (a[0].id === prev[prev.length - 1].id) [a[0], a[1]] = [a[1], a[0]];
  }
  cycles.set(c, a);
  return a;
}
/** n. günün gizli kahramanı. */
export function dailyHero(n) {
  const i = Math.max(0, n - 1);
  return cycleOrder(Math.floor(i / BASE.length))[i % BASE.length];
}

// ------------------------------------------------------------------ karşılaştırma
/** Tahmin (g) ile gizli kahraman (t) karşılaştırması. c: g yeşil | y sarı | r kırmızı | n nötr; dir: gizli değer yukarı (1) / aşağı (-1). */
export function compare(g, t) {
  const gr = new Set(g.roles);
  const common = t.roles.filter((r) => gr.has(r)).length;
  const dd = t.dogRate - g.dogRate;
  return {
    hero: { c: g.id === t.id ? 'g' : 'n' },
    attr: { c: g.attr === t.attr ? 'g' : 'r' },
    attack: { c: g.attack === t.attack ? 'g' : 'r' },
    cx: { c: g.complexity === t.complexity ? 'g' : 'r', dir: Math.sign(t.complexity - g.complexity) },
    roles: { c: common === gr.size && common === t.roles.length ? 'g' : common ? 'y' : 'r' },
    dog: { c: dd === 0 ? 'g' : Math.abs(dd) <= 10 ? 'y' : 'r', dir: Math.sign(dd) },
    arch: { c: g.archetype === t.archetype ? 'g' : 'r' },
  };
}

const SQ = { g: '🟩', y: '🟨', r: '🟥', n: '🟥' };
/** Paylaşım satırı: özellik, saldırı, karmaşıklık, roller, DOG%, tür. Kırmızı sayılar ok olur. */
export function emojiRow(cmp) {
  const num = (x) => (x.c === 'r' && x.dir ? (x.dir > 0 ? '⬆️' : '⬇️') : SQ[x.c]);
  return [SQ[cmp.attr.c], SQ[cmp.attack.c], num(cmp.cx), SQ[cmp.roles.c], num(cmp.dog), SQ[cmp.arch.c]].join('');
}

export function shareText(n, guesses, answer, hintsUsed = 0) {
  const rows = guesses.map((id) => emojiRow(compare(heroById(id), answer)));
  const lines = [`DOGdle #${n} — ${guesses.length} tahmin`];
  if (rows.length > SHARE_ROWS) lines.push(`⋯ +${rows.length - SHARE_ROWS} tahmin`);
  lines.push(...rows.slice(-SHARE_ROWS));
  if (hintsUsed) lines.push(`💡 ${hintsUsed} ipucu`);
  lines.push('DOG DOG DOG', SITE_URL);
  return lines.join('\n');
}

// ------------------------------------------------------------------ görünüm yardımcıları
const ARCH = new Map(ALL_TYPES.map((a) => [a.id, a]));
const ARCH_SHORT = {
  farm: 'Farm', feed: 'Feed', pause: 'Pause', afk: 'AFK', kurye: 'Kurye', rapier: 'Rapier',
  mid: 'Mid/Feed', ward: 'Ward’sız', smurf: 'Smurf', chat: 'Chat', legend: '1vDOQUZ',
};
const ROLE_AB = { Carry: 'TAŞ', Support: 'DES', Nuker: 'HAS', Disabler: 'KON', Initiator: 'BAŞ', Durable: 'DAY', Escape: 'KAÇ', Pusher: 'KUL' };
const ATTACK_TR = { Melee: 'Yakın', Ranged: 'Menzilli' };
const WORD = { g: 'aynı', y: 'yakın', r: 'farklı', n: '' };

const archOf = (hero) => ARCH.get(hero.archetype) || ARCH.get('legend');
/** Dar tahtada kahraman adı: tek kelimelik adlar olduğu gibi (≤ 10 harf), çok kelimeliler topluluk kısaltmasıyla (CM, QOP…). */
const boardName = (hero) => (!/\s/.test(hero.name) && hero.name.length <= 10 ? hero.name : hero.abbr);
const stripQuote = (s) => String(s || '').replace(/^Topluluk der ki:\s*/, '');

// Özellik şekilleri (kahraman armalarıyla aynı dil): Güç kalkan, Çeviklik elmas, Zekâ altıgen, Evrensel sekizgen
function attrGlyph(attr) {
  const col = (ATTRS[attr] || ATTRS.uni).color;
  const poly = (n, r, off) => Array.from({ length: n }, (_, i) => {
    const a = ((off + (i * 360) / n) * Math.PI) / 180;
    return `${(12 + Math.cos(a) * r).toFixed(1)},${(12 + Math.sin(a) * r).toFixed(1)}`;
  }).join(' ');
  const shape = attr === 'str'
    ? h('path', { d: 'M12 2.5l8 2.6-.2 7c-.4 4.2-3.6 6.8-7.8 8.4-4.2-1.6-7.4-4.2-7.8-8.4L4 5.1z' })
    : attr === 'agi'
      ? h('polygon', { points: '12,2.5 20.5,12 12,21.5 3.5,12' })
      : attr === 'int'
        ? h('polygon', { points: poly(6, 9.6, -90) })
        : h('polygon', { points: poly(8, 9.6, -67.5) });
  return h('svg', { viewBox: '0 0 24 24', class: 'gm-dg-glyph', 'aria-hidden': 'true', style: { '--ac': col } }, shape);
}

function dualLabel(full, short, cls = '') {
  return h('span', { class: `gm-dg-lbl ${cls}` }, h('span', { class: 'gm-dg-full' }, memeText(full)), h('span', { class: 'gm-dg-short' }, memeText(short)));
}

function arrowEl(x) {
  if (!x.dir || x.c === 'g') return null;
  return h('span', { class: `gm-dg-arrow ${x.dir > 0 ? 'up' : 'down'}`, 'aria-hidden': 'true' }, icon('arrowRight', { size: 14, stroke: 2.6 }));
}

function pips(n) {
  return h('span', { class: 'gm-dg-pips', 'aria-hidden': 'true' }, [1, 2, 3].map((i) => h('i', { class: i <= n ? 'on' : '' })));
}

/** Topluluk sözünde kahramanın adını karartır (ipucu cevabı ele vermesin). */
function redacted(hero, text) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]");
  const words = hero.name.split(/[\s-]+/).filter((w) => w.length >= 4);
  const parts = [...new Set([hero.name, ...words])].sort((a, b) => b.length - a.length).map(esc);
  const re = new RegExp(`(?<!\\p{L})(${parts.join('|')})(?!\\p{L})`, 'iu');
  return text.split(re).map((p, i) => (i % 2 ? h('span', { class: 'gm-dg-redact' }, 'gizli kahraman') : p));
}

function rowSummary(hero, cmp) {
  const dir = (x) => (x.c === 'g' || !x.dir ? '' : x.dir > 0 ? ', gizli kahramanınki daha yüksek' : ', gizli kahramanınki daha düşük');
  if (cmp.hero.c === 'g') return `${hero.name}: doğru kahraman!`;
  return `${hero.name}: özellik ${ATTRS[hero.attr].label} ${WORD[cmp.attr.c]}; saldırı ${ATTACK_TR[hero.attack]} ${WORD[cmp.attack.c]}; `
    + `karmaşıklık ${hero.complexity} ${WORD[cmp.cx.c]}${dir(cmp.cx)}; roller ${WORD[cmp.roles.c]}; `
    + `DOG yüzde ${hero.dogRate} ${WORD[cmp.dog.c]}${dir(cmp.dog)}; DOG türü ${archOf(hero).name} ${WORD[cmp.arch.c]}.`;
}

function quipFor(k) {
  if (k <= 1) return '1vDOQUZ. Tek tahmin, sıfır ipucu… Kâhin misin, yoksa draft’ı önceden mi gördün?';
  if (k <= 3) return 'Rakibin pick’ini draft bitmeden okuyan kaptan sensin.';
  if (k <= 6) return 'Sağlam okuma. Minimap’e bakıp kimin nerede olduğunu bilen nadir oyunculardansın.';
  if (k <= 10) return 'Biraz ormanda dolaştın ama sonunda buldun. Farm Köpeği bile gurur duydu.';
  return 'DOG DOG DOG. Havuzun yarısını denedin ama pes etmedin; gg, yarın daha az tahminle.';
}

// ------------------------------------------------------------------ kalıcı durum
function freshDay(n) {
  return { n, guesses: [], solved: false, hints: { quote: false, portrait: false }, submitted: false, counted: false };
}
function loadDay(n) {
  const d = ls.get(K.day, null);
  if (!d || d.n !== n || !Array.isArray(d.guesses)) return freshDay(n);
  const guesses = d.guesses.filter((id, i, a) => heroById(id) && a.indexOf(id) === i);
  const ans = dailyHero(n);
  return {
    ...freshDay(n),
    ...d,
    guesses,
    solved: guesses.includes(ans.id),
    hints: { quote: !!(d.hints && d.hints.quote), portrait: !!(d.hints && d.hints.portrait) },
  };
}
function loadStats() {
  const s = ls.get(K.stats, null);
  const base = { played: 0, solved: 0, streak: 0, best: 0, lastSolved: 0, dist: {} };
  if (!s || typeof s !== 'object') return base;
  return { ...base, ...s, dist: s.dist && typeof s.dist === 'object' ? { ...s.dist } : {} };
}
/** Bugün (n) için geçerli seri: dün ya da bugün çözüldüyse sürer. */
export const currentStreak = (s, n) => (s.lastSolved >= n - 1 ? s.streak : 0);

/** Salon için bugünkü durum: { n, done, won, guesses, streak }. */
export function todayStatus() {
  const n = puzzleNumber();
  const d = loadDay(n);
  return { n, done: d.solved, won: d.solved, guesses: d.guesses.length, streak: currentStreak(loadStats(), n) };
}

function randomPracticeHero(excludeId) {
  const pool = HEROES.filter((x) => x.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}
function freshPractice(n) {
  return { answer: randomPracticeHero(dailyHero(n).id).id, guesses: [], gaveUp: false, hints: { quote: false, portrait: false } };
}
function loadPractice(dailyId) {
  const p = ls.get(K.prac, null);
  // Serbest mod bugünün gizli kahramanını asla sormaz (günlük bulmacayı ele vermesin)
  if (p && heroById(p.answer) && p.answer !== dailyId && Array.isArray(p.guesses)) {
    return {
      answer: p.answer,
      guesses: p.guesses.filter((id, i, a) => heroById(id) && a.indexOf(id) === i),
      gaveUp: !!p.gaveUp,
      hints: { quote: !!(p.hints && p.hints.quote), portrait: !!(p.hints && p.hints.portrait) },
    };
  }
  return { answer: randomPracticeHero(dailyId).id, guesses: [], gaveUp: false, hints: { quote: false, portrait: false } };
}

// ------------------------------------------------------------------ oyun
export function mount(el, ctx, nav) {
  const L = gameLayout(el, meta, { nav });
  const reduced = prefersReducedMotion();

  const sPuzzle = hudStat('Bulmaca', '#1', { ico: 'calendar' });
  const sGuess = hudStat('Tahmin', '0', { ico: 'target', cls: 'gm-stat-score' });
  const sStreak = hudStat('Seri', '0', { ico: 'flame' });
  const sNext = hudStat('Sonraki', '--:--:--', { ico: 'hourglass', cls: 'gm-dg-cdstat' });
  L.hud.append(sPuzzle.el, sGuess.el, sStreak.el, sNext.el);

  let daily = loadDay(puzzleNumber());
  let stats = loadStats();
  let prac = loadPractice(dailyHero(daily.n).id);
  let tab = ['daily', 'practice', 'stats'].includes(ls.get(K.tab)) ? ls.get(K.tab) : 'daily';
  let dead = false;
  let closeOverlay = null;
  let hotOff = false;
  let picker = null;
  let rowsEl = null;
  let emptyEl = null;
  let hintHost = null;
  let hintBox = null;
  let pending = 0; // açılmakta olan satır sayısı (kazanma animasyonu bekler)
  let tickAcc = 1;

  const runner = createRunner((dt) => {
    tickAcc += dt;
    if (tickAcc >= 0.25) { tickAcc = 0; tick(); }
  });

  // Mevcut modun görünümü: günlük ya da serbest
  function mode() {
    if (tab === 'practice') {
      const answer = heroById(prac.answer);
      return {
        kind: 'practice', answer, guesses: prac.guesses, hints: prac.hints,
        solved: prac.guesses.includes(answer.id), gaveUp: prac.gaveUp,
      };
    }
    return { kind: 'daily', n: daily.n, answer: dailyHero(daily.n), guesses: daily.guesses, hints: daily.hints, solved: daily.solved, gaveUp: false };
  }
  const isDone = (M) => M.solved || M.gaveUp;
  const hintsUsed = (M) => (M.hints.quote ? 1 : 0) + (M.hints.portrait ? 1 : 0);

  function save() {
    ls.set(K.day, daily);
    ls.set(K.prac, prac);
    ls.set(K.stats, stats);
  }

  // ---------------------------------------------------------------- iskelet
  const tabsEl = h('div', { class: 'tabs gm-dg-tabs', role: 'tablist', 'aria-label': 'DOGdle modları' });
  const TABS = [
    { id: 'daily', ico: 'calendar', label: () => `Günlük #${daily.n}` },
    { id: 'practice', ico: 'dice', label: () => 'Serbest mod' },
    { id: 'stats', ico: 'trophy', label: () => 'İstatistik' },
  ];
  const tabBtns = TABS.map((t, i) => {
    const b = h('button', {
      class: 'tab gm-dg-tab', type: 'button', role: 'tab', id: `gm-dg-tab-${t.id}`,
      'aria-controls': 'gm-dg-panel',
    }, icon(t.ico, { size: 16 }), h('span', null, t.label()));
    b.addEventListener('click', () => { if (tab !== t.id) { sound.click(); setTab(t.id); } });
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
      setTab(TABS[j].id);
      tabBtns[j].focus();
    });
    tabsEl.appendChild(b);
    return b;
  });
  const panel = h('div', { class: 'gm-dg-body', role: 'tabpanel', id: 'gm-dg-panel' });
  const root = h('div', { class: 'gm-dg' }, tabsEl, panel);
  L.stage.appendChild(root);

  function syncTabs() {
    TABS.forEach((t, i) => {
      const on = t.id === tab;
      tabBtns[i].setAttribute('aria-selected', String(on));
      tabBtns[i].tabIndex = on ? 0 : -1;
      tabBtns[i].querySelector('span').textContent = t.label();
    });
    panel.setAttribute('aria-labelledby', `gm-dg-tab-${tab}`);
  }

  function setTab(id) {
    tab = id;
    ls.set(K.tab, id);
    render();
  }

  // ---------------------------------------------------------------- çizim
  function render() {
    if (picker) { picker.destroy(); picker = null; }
    clear(panel);
    rowsEl = emptyEl = hintHost = hintBox = null;
    pending = 0;
    syncTabs();
    if (tab === 'stats') {
      panel.appendChild(statsPanel(true));
    } else {
      const M = mode();
      const top = h('div', { class: 'gm-dg-top' });
      panel.append(top, legendEl(), boardEl(M));
      renderTop(top, M, false);
    }
    syncHud();
    syncHotkeys();
  }

  function syncHud() {
    const M = tab === 'practice' ? mode() : null;
    sPuzzle.set(M ? 'Serbest' : `#${daily.n}`);
    sGuess.set(String((M || { guesses: daily.guesses }).guesses.length));
    sStreak.set(`${currentStreak(stats, daily.n)}`);
  }

  // Oyun devam ederken site kısayolları kapalı: harf yazmak aramaya gider, bölüm değiştirmez
  function syncHotkeys() {
    const live = !!picker && !dead;
    if (live && !hotOff) { ctx.hotkeys(false); hotOff = true; }
    if (!live && hotOff) { ctx.hotkeys(true); hotOff = false; }
  }

  function renderTop(top, M, live, saved) {
    clear(top);
    if (picker) { picker.destroy(); picker = null; }
    hintHost = hintBox = null;
    if (isDone(M)) {
      top.appendChild(donePanel(M, live, saved));
      syncHotkeys();
      return;
    }
    picker = createHeroPicker({
      onPick: (hero) => guess(hero),
      isExcluded: (hero) => mode().guesses.includes(hero.id),
      placeholder: 'Kahraman yaz: Pudge, AM…',
      label: 'Kahraman tahmini',
      onMiss: () => { fx.shake(picker && picker.el); sound.miss(); },
    });
    const status = M.kind === 'daily'
      ? h('p', { class: 'gm-dg-status' },
        h('strong', null, `DOGdle #${M.n}`), ' · Gizli kahraman seni bekliyor. ',
        h('span', { class: 'dim' }, 'Sonraki: '), h('span', { class: 'num gm-dg-cd', dataset: { dgCd: '' } }, fmtClock(msToNext() / 1000)))
      : h('p', { class: 'gm-dg-status' },
        h('strong', null, 'Serbest mod'), ' · Rastgele kahraman, sınırsız deneme. Skor ve seri etkilenmez.');
    hintHost = h('div', { class: 'gm-dg-hints', role: 'group', 'aria-label': 'İpuçları' });
    hintBox = h('div', { class: 'gm-dg-hintbox' });
    const box = h('section', { class: 'panel raised gm-dg-ask', 'aria-label': 'Tahmin et' }, status, picker.el, hintHost, hintBox);
    if (M.kind === 'practice') {
      const giveUp = h('button', { class: 'btn ghost sm gm-dg-giveup', type: 'button' }, icon('flag', { size: 16 }), 'Pes et');
      giveUp.addEventListener('click', () => {
        sound.bad();
        prac.gaveUp = true;
        save();
        renderTop(top, mode(), true);
      });
      box.appendChild(h('div', { class: 'gm-dg-ask-foot' }, h('span', { class: 'xsmall dim' }, 'Takıldın mı? Serbest modda pes etmek serbest.'), giveUp));
    }
    top.appendChild(box);
    renderHints(M);
    syncHotkeys();
  }

  // ---------------------------------------------------------------- ipuçları
  function renderHints(M) {
    if (!hintHost) return;
    clear(hintHost);
    clear(hintBox);
    const k = M.guesses.length;
    const mk = (id, at, ico, title) => {
      const ready = k >= at;
      const open = !!M.hints[id];
      const b = h('button', {
        class: `gm-dg-hint${ready ? ' ready' : ''}${open ? ' open' : ''}`,
        type: 'button',
        disabled: !ready,
        'aria-expanded': String(open),
        'aria-controls': `gm-dg-hint-${id}`,
      },
        h('span', { class: 'gm-dg-hint-ico', 'aria-hidden': 'true' }, icon(ready ? ico : 'lock', { size: 18 })),
        h('span', { class: 'gm-dg-hint-txt' },
          h('span', { class: 'gm-dg-hint-t' }, title),
          h('span', { class: 'gm-dg-hint-s' }, ready ? (open ? 'Açık' : 'Açmak için dokun') : `${at - k} tahmin sonra açılır`),
        ),
      );
      b.addEventListener('click', () => {
        if (!ready || open) return;
        sound.whoosh();
        M.hints[id] = true;
        save();
        renderHints(mode());
        const n = hintBox.querySelector(`#gm-dg-hint-${id}`);
        if (n) revealInView(n);
      });
      return b;
    };
    hintHost.append(
      mk('quote', QUOTE_AT, 'chat', 'Topluluk der ki'),
      mk('portrait', PORTRAIT_AT, 'eye', 'Bulanık portre'),
    );
    if (M.hints.quote) hintBox.appendChild(quoteHint(M.answer));
    if (M.hints.portrait) hintBox.appendChild(portraitHint(M.answer));
  }

  function quoteHint(hero) {
    return h('figure', { class: 'gm-dg-quote', id: 'gm-dg-hint-quote' },
      h('figcaption', { class: 'eyebrow' }, icon('chat', { size: 14 }), 'Topluluk der ki'),
      h('blockquote', null, redacted(hero, stripQuote(hero.prejudice))),
    );
  }

  function portraitHint(hero) {
    const url = heroPortraitUrl(hero.id);
    const hs = hashStr(hero.id);
    const ox = 30 + (hs % 41);
    const oy = 25 + ((hs >>> 8) % 41);
    return h('figure', { class: 'gm-dg-blur', id: 'gm-dg-hint-portrait' },
      h('div', { class: 'gm-dg-blur-frame' },
        url
          ? h('img', { src: url, alt: '', width: '256', height: '144', decoding: 'async', style: { transformOrigin: `${ox}% ${oy}%` } })
          : h('span', { class: 'gm-dg-blur-abbr' }, (ATTRS[hero.attr] || ATTRS.uni).short),
      ),
      h('figcaption', { class: 'xsmall dim' }, 'Bulanık ve yakın çekim: yüzü tanıyabilecek misin?'),
    );
  }

  // ---------------------------------------------------------------- lejant + tahta
  function legendEl() {
    const sq = (c) => h('i', { class: `gm-dg-sq c-${c}`, 'aria-hidden': 'true' });
    return h('details', { class: 'gm-dg-legend' },
      h('summary', null, icon('info', { size: 16 }), 'Renkler ne demek?',
        h('span', { class: 'gm-dg-legend-mini', 'aria-hidden': 'true' }, sq('g'), sq('y'), sq('r'))),
      h('ul', null,
        h('li', null, sq('g'), h('span', null, h('strong', null, 'Yeşil: '), 'gizli kahramanla aynı.')),
        h('li', null, sq('y'), h('span', null, h('strong', null, 'Sarı: '), 'roller kısmen ortak ya da DOG% en fazla 10 puan uzakta.')),
        h('li', null, sq('r'), h('span', null, h('strong', null, 'Kırmızı: '), 'farklı; rollerde hiç ortak rol yok.')),
        h('li', null, h('span', { class: 'gm-dg-arrow up', 'aria-hidden': 'true' }, icon('arrowRight', { size: 14, stroke: 2.6 })),
          h('span', null, h('strong', null, 'Oklar: '), 'gizli kahramanın karmaşıklığı ya da DOG%’si daha yüksek (↑) veya düşük (↓).')),
        h('li', null, h('span', { class: 'gm-dg-lg-roles', 'aria-hidden': 'true' }, 'TAŞ'),
          h('span', null, h('strong', null, 'Roller: '), Object.entries(ROLE_AB).map(([k, v]) => `${v} ${ROLES[k]}`).join(' · '))),
      ),
    );
  }

  const HEADS = [
    ['Kahraman', 'Kahr.'], ['Özellik', 'Özel.'], ['Saldırı', 'Sald.'], ['Karmaşıklık', 'Karm.'],
    ['Roller', 'Rol'], ['DOG%', 'DOG%'], ['DOG türü', 'Tür'],
  ];

  function boardEl(M) {
    rowsEl = h('ol', { class: 'gm-dg-rows', 'aria-label': 'Tahminlerin (en yenisi üstte)' });
    emptyEl = h('li', { class: 'gm-dg-emptyrow', 'aria-hidden': 'true' },
      HEADS.map(() => h('span', { class: 'gm-dg-ghost' }, '?')),
    );
    const emptyNote = h('p', { class: 'gm-dg-emptynote xsmall dim' }, 'İlk tahminin burada açılacak. Herhangi bir kahramanla başla; renkler seni yönlendirir.');
    for (const id of M.guesses) rowsEl.prepend(rowEl(heroById(id), compare(heroById(id), M.answer), false));
    if (!M.guesses.length) rowsEl.append(emptyEl);
    const grid = h('div', { class: 'gm-dg-grid' },
      h('div', { class: 'gm-dg-head', 'aria-hidden': 'true' }, HEADS.map(([f, s]) => h('span', null, dualLabel(f, s)))),
      rowsEl,
    );
    return h('section', { class: 'gm-dg-board', 'aria-label': 'Tahmin tahtası' },
      h('div', { class: 'gm-dg-scroll' }, grid),
      M.guesses.length ? null : emptyNote,
    );
  }

  function tile(key, x, content, i, animate) {
    return h('span', {
      class: `gm-dg-tile t-${key} c-${x.c}${animate ? ' flip' : ''}`,
      style: { '--i': String(i) },
    }, content);
  }

  function rowEl(hero, cmp, animate) {
    const url = heroPortraitUrl(hero.id);
    const a = ATTRS[hero.attr] || ATTRS.uni;
    const arch = archOf(hero);
    const cells = [
      tile('hero', cmp.hero, [
        url ? h('img', { src: url, alt: '', width: '256', height: '144', decoding: 'async' }) : h('span', { class: 'gm-dg-abbr' }, hero.abbr),
        h('span', { class: `gm-dg-hname${boardName(hero).length >= 9 ? ' long' : ''}` }, dualLabel(hero.name, boardName(hero))),
      ], 0, animate),
      tile('attr', cmp.attr, [attrGlyph(hero.attr), dualLabel(a.label, a.short)], 1, animate),
      tile('attack', cmp.attack, [icon(hero.attack === 'Melee' ? 'sword' : 'bow', { size: 18 }), dualLabel(ATTACK_TR[hero.attack], hero.attack === 'Melee' ? 'Yakın' : 'Menzil')], 2, animate),
      tile('cx', cmp.cx, [h('span', { class: 'gm-dg-val' }, pips(hero.complexity), arrowEl(cmp.cx)), dualLabel(`${hero.complexity}/3`, `${hero.complexity}/3`, 'gm-dg-sub')], 3, animate),
      tile('roles', cmp.roles, h('span', { class: 'gm-dg-roles' },
        hero.roles.map((r) => h('span', { class: 'gm-dg-role' }, dualLabel(ROLES[r] || r, ROLE_AB[r] || r))),
      ), 4, animate),
      tile('dog', cmp.dog, [h('span', { class: 'gm-dg-val' }, h('span', { class: 'gm-dg-big num' }, `%${hero.dogRate}`), arrowEl(cmp.dog))], 5, animate),
      tile('arch', cmp.arch, [icon(arch.icon, { size: 18 }), dualLabel(arch.name.replace(' Köpeği', ''), ARCH_SHORT[arch.id] || arch.name)], 6, animate),
    ];
    return h('li', {
      class: `gm-dg-row${cmp.hero.c === 'g' ? ' win' : ''}`,
      title: hero.name,
      dataset: { hero: hero.id },
    },
      h('span', { class: 'sr-only' }, rowSummary(hero, cmp)),
      h('span', { class: 'gm-dg-cells', 'aria-hidden': 'true' }, cells),
    );
  }

  // ---------------------------------------------------------------- tahmin
  function guess(hero) {
    if (dead || tab === 'stats') return;
    const M = mode();
    if (isDone(M) || M.guesses.includes(hero.id)) return;
    M.guesses.push(hero.id); // günlük/serbest durum nesnesinin dizisi (aynı referans)
    const correct = hero.id === M.answer.id;
    const k = M.guesses.length;
    let saved = null;
    if (M.kind === 'daily') {
      if (!daily.counted) { daily.counted = true; stats.played++; }
      if (correct) {
        daily.solved = true;
        stats.solved++;
        stats.streak = stats.lastSolved === daily.n - 1 ? stats.streak + 1 : 1;
        stats.best = Math.max(stats.best, stats.streak);
        stats.lastSolved = daily.n;
        const bucket = k >= 10 ? '10' : String(k);
        stats.dist[bucket] = (stats.dist[bucket] || 0) + 1;
        // Skoru hemen kaydet (günde bir kez): oyuncu açılış animasyonunda ayrılsa da kaybolmasın
        if (!daily.submitted) {
          saved = submitResult(meta, k);
          daily.submitted = true;
        }
      }
    }
    save();

    const cmp = compare(hero, M.answer);
    if (emptyEl && emptyEl.isConnected) {
      emptyEl.remove();
      const note = panel.querySelector('.gm-dg-emptynote');
      if (note) note.remove();
    }
    const row = rowEl(hero, cmp, !reduced);
    rowsEl.prepend(row);
    L.live.textContent = rowSummary(hero, cmp);
    syncHud();
    sGuess.bump();
    const revealSec = reduced ? 0.05 : 0.17 * 6 + 0.56;
    pending++;
    if (correct) {
      if (picker) picker.setDisabled(true);
      sound.click();
      runner.after(revealSec, () => {
        pending--;
        win(saved);
      });
    } else {
      const greens = ['attr', 'attack', 'cx', 'roles', 'dog', 'arch'].filter((key) => cmp[key].c === 'g').length;
      if (greens >= 4) sound.good(); else sound.click();
      runner.after(revealSec, () => {
        pending--;
        if (greens === 0 && !reduced) sound.miss();
        renderHints(mode());
      });
      if (picker) picker.focus();
    }
  }

  function win(saved) {
    if (dead) return;
    const M = mode();
    const k = M.guesses.length;
    const top = panel.querySelector('.gm-dg-top');
    ctx.fx.stamp(k === 1 ? '1vDOQUZ' : 'DOG DOG DOG', { variant: 'gold' });
    if (M.kind === 'daily' && !saved) saved = { record: false, prev: (store.me.get().scores || {})[meta.id] };
    if (top) renderTop(top, M, true, saved);
    const r = top ? top.getBoundingClientRect() : null;
    if (r && r.width && !(saved && saved.record)) fx.confetti(r.left + r.width / 2, r.top + 60, 60);
    syncHud();
    L.live.textContent = `Buldun! ${M.answer.name}, ${k} tahminde.`;
    runner.after(0.05, () => { const c = panel.querySelector('.gm-dg-done'); if (c) revealInView(c); });
  }

  // ---------------------------------------------------------------- bitiş paneli
  function answerCard(hero, label) {
    const url = heroPortraitUrl(hero.id);
    const arch = archOf(hero);
    return h('div', { class: 'gm-dg-answer', style: { '--ac': (ATTRS[hero.attr] || ATTRS.uni).color } },
      h('span', { class: 'gm-dg-answer-art' }, url ? h('img', { src: url, alt: '', width: '256', height: '144', decoding: 'async' }) : h('span', { class: 'gm-dg-abbr' }, hero.abbr)),
      h('span', { class: 'gm-dg-answer-body' },
        h('span', { class: 'eyebrow' }, label),
        h('strong', { class: 'gm-dg-answer-name' }, hero.name),
        h('span', { class: 'gm-dg-answer-meta' },
          h('span', { class: 'badge' }, ATTRS[hero.attr].label), ' ',
          h('span', { class: 'badge ember num' }, `DOG %${hero.dogRate}`), ' ',
          h('span', { class: 'badge gold' }, memeText(arch.name)),
        ),
        h('span', { class: 'gm-dg-answer-quote' }, stripQuote(hero.prejudice)),
      ),
    );
  }

  // resultCard ile aynı yapı; geri yüklenen (zaten çözülmüş) bulmaca için sessiz sürüm
  function quietResult({ score, title, badge, stats: rows, quip, retryLabel, retryIcon, onRetry }) {
    const retry = h('button', { class: 'btn primary', type: 'button', 'data-primary': '' }, icon(retryIcon, { size: 18 }), retryLabel);
    retry.addEventListener('click', () => { sound.click(); onRetry(); });
    const back = h('button', { class: 'btn ghost', type: 'button' }, icon('arrowLeft', { size: 18 }), 'Oyunlar');
    back.addEventListener('click', () => { sound.click(); if (nav) nav.back(); });
    return h('div', { class: 'gm-result stack' },
      h('div', { class: 'row gm-result-top' }, h('span', { class: 'eyebrow' }, title), badge),
      score != null ? h('div', { class: 'gm-result-score' },
        h('span', { class: 'gm-result-num num' }, fmtNum(score)),
        h('span', { class: 'gm-result-unit' }, meta.unit)) : null,
      rows && rows.length ? h('dl', { class: 'gm-result-stats' }, rows.map(([a, b]) => h('div', null, h('dt', null, a), h('dd', { class: 'num' }, b)))) : null,
      quip ? h('p', { class: 'gm-result-quip' }, quip) : null,
      h('div', { class: 'row gm-result-actions' }, retry, back),
    );
  }

  const practiceBadge = () => h('span', { class: 'badge', title: 'Serbest mod skoru tabloya ve seriye yazılmaz' }, 'Antrenman · skor tutulmaz');

  function relabel(node, ico, label) {
    const b = node.querySelector('[data-primary]');
    if (b) b.replaceChildren(icon(ico, { size: 18 }), label);
  }

  function donePanel(M, live, saved) {
    const k = M.guesses.length;
    const wrap = h('section', { class: 'panel raised frame gm-dg-done', 'aria-label': 'Sonuç' });
    let node;
    if (M.kind === 'daily') {
      const rows = [
        ['Seri', `${currentStreak(stats, M.n)} gün`],
        ['En iyi seri', `${stats.best} gün`],
        ['İpucu', fmtNum(hintsUsed(M))],
      ];
      const opts = {
        score: k,
        title: `DOGdle #${M.n} çözüldü`,
        stats: rows,
        quip: quipFor(k),
        onRetry: () => setTab('practice'),
        onBack: () => nav && nav.back(),
      };
      if (live) {
        node = resultCard(meta, { ...opts, saved }).node;
        relabel(node, 'dice', 'Serbest mod');
      } else {
        const best = (store.me.get().scores || {})[meta.id];
        node = quietResult({
          ...opts,
          badge: h('span', { class: 'badge' }, 'Rekorun: ', typeof best === 'number' ? meta.format(best) : '—'),
          retryLabel: 'Serbest mod',
          retryIcon: 'dice',
        });
      }
      node.insertBefore(answerCard(M.answer, 'Bugünün gizli kahramanı'), node.children[1]);
      node.insertBefore(shareBlock(M), node.querySelector('.gm-result-actions'));
    } else if (M.solved) {
      const opts = {
        score: k,
        title: 'Serbest mod · buldun',
        stats: [['Tahmin', fmtNum(k)], ['İpucu', fmtNum(hintsUsed(M))], ['Günlük seri', `${currentStreak(stats, daily.n)} gün`]],
        quip: quipFor(k),
        onRetry: newPractice,
        onBack: () => nav && nav.back(),
      };
      if (live) {
        // Serbest mod skoru kaydetmez: kit'in antrenman kipi (eski kit sürümünde de kaydedilmemiş sonuç verilir)
        node = resultCard(meta, { ...opts, practice: true, saved: { record: false, prev: null } }).node;
        const top = node.querySelector('.gm-result-top');
        if (top) {
          top.querySelectorAll('.badge').forEach((b) => b.remove());
          top.appendChild(practiceBadge());
        }
        relabel(node, 'dice', 'Yeni kahraman');
      } else {
        node = quietResult({ ...opts, badge: practiceBadge(), retryLabel: 'Yeni kahraman', retryIcon: 'dice' });
      }
      node.insertBefore(answerCard(M.answer, 'Gizli kahraman'), node.children[1]);
    } else {
      // Serbest modda pes edildi
      node = quietResult({
        score: null,
        title: 'Serbest mod · pes ettin',
        badge: h('span', { class: 'badge blood' }, `${fmtNum(k)} tahmin`),
        quip: k ? 'Bu seferlik DOG DOG DOG. Yeni kahramanda rövanş var.' : 'Hiç denemeden pes etmek de bir strateji… AFK Köpeği onayladı.',
        retryLabel: 'Yeni kahraman',
        retryIcon: 'dice',
        onRetry: newPractice,
      });
      node.insertBefore(answerCard(M.answer, 'Gizli kahraman buydu'), node.children[1]);
    }
    wrap.appendChild(node);
    return wrap;
  }

  function shareBlock(M) {
    const text = shareText(M.n, M.guesses, M.answer, hintsUsed(M));
    const ta = h('textarea', {
      class: 'gm-dg-share-text num',
      readonly: true,
      rows: String(Math.min(16, text.split('\n').length)),
      'aria-label': 'Paylaşım metni',
      spellcheck: 'false',
    });
    ta.value = text;
    const btn = h('button', { class: 'btn gold gm-dg-copy', type: 'button' }, icon('copy', { size: 18 }), 'Kopyala');
    let revert = 0;
    btn.addEventListener('click', async () => {
      sound.click();
      let ok = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          ok = true;
        }
      } catch { ok = false; }
      if (!ok) {
        // Yedek: salt okunur metni seç, eski kopyalama komutunu dene
        try {
          ta.focus();
          ta.select();
          ta.setSelectionRange(0, text.length);
          ok = !!(document.execCommand && document.execCommand('copy'));
        } catch { ok = false; }
      }
      if (dead) return;
      if (ok) {
        fx.toast('Sonuç panoya kopyalandı. DOG DOG DOG!', 'jade');
        btn.replaceChildren(icon('check', { size: 18 }), 'Kopyalandı');
        runner.cancel(revert);
        revert = runner.after(2.2, () => btn.replaceChildren(icon('copy', { size: 18 }), 'Kopyala'));
      } else {
        try { ta.focus(); ta.select(); } catch { /* yok say */ }
        fx.toast('Metin seçildi: Ctrl+C ile ya da basılı tutup “Kopyala” diyerek al.', 'ember', 4200);
      }
    });
    return h('div', { class: 'gm-dg-share' },
      h('div', { class: 'gm-dg-share-head' },
        h('span', { class: 'eyebrow' }, icon('share', { size: 14 }), 'Sonucu paylaş'),
        h('span', { class: 'xsmall dim' }, 'Sonraki DOGdle: ', h('span', { class: 'num gm-dg-cd', dataset: { dgCd: '' } }, fmtClock(msToNext() / 1000))),
      ),
      ta,
      h('div', { class: 'gm-dg-share-foot' }, btn, h('span', { class: 'xsmall dim' }, 'Sohbete yapıştır; cevap görünmez, sadece renkler.')),
    );
  }

  function newPractice() {
    prac = freshPractice(daily.n);
    save();
    sound.whoosh();
    if (tab !== 'practice') setTab('practice');
    else render();
    if (picker) picker.focus();
  }

  // ---------------------------------------------------------------- istatistik
  function statsPanel(full) {
    const s = stats;
    const winPct = s.played ? Math.round((s.solved / s.played) * 100) : 0;
    const buckets = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    const maxV = Math.max(1, ...buckets.map((b) => s.dist[b] || 0));
    const todayK = daily.solved ? (daily.guesses.length >= 10 ? '10' : String(daily.guesses.length)) : null;
    const nums = [
      ['Oynanan', fmtNum(s.played)],
      ['Kazanma', `%${winPct}`],
      ['Seri', fmtNum(currentStreak(s, daily.n))],
      ['En iyi seri', fmtNum(s.best)],
    ];
    const best = (store.me.get().scores || {})[meta.id];
    return h('section', { class: 'panel raised frame gm-dg-stats', 'aria-label': 'DOGdle istatistiklerin' },
      h('div', { class: 'gm-dg-stats-head' },
        h('span', { class: 'eyebrow' }, 'Günlük DOGdle'),
        h('h2', { class: 'h3' }, 'İstatistiklerin'),
      ),
      h('dl', { class: 'gm-dg-nums' }, nums.map(([a, b]) => h('div', null, h('dd', { class: 'num' }, b), h('dt', null, a)))),
      h('h3', { class: 'gm-dg-dist-title' }, 'Tahmin dağılımı'),
      h('ol', { class: 'gm-dg-dist' }, buckets.map((b) => {
        const v = s.dist[b] || 0;
        return h('li', { class: b === todayK ? 'today' : '' },
          h('span', { class: 'gm-dg-dist-k num' }, b === '10' ? '10+' : b),
          h('span', { class: 'gm-dg-dist-bar' }, h('span', { style: { width: `${Math.max(v ? 8 : 0, (v / maxV) * 100)}%` } })),
          h('span', { class: 'gm-dg-dist-v num' }, fmtNum(v)),
        );
      })),
      h('p', { class: 'xsmall dim' },
        typeof best === 'number' ? ['En iyi skorun: ', h('strong', { class: 'gold' }, meta.format(best)), '. '] : null,
        'Serbest mod bu istatistiklere yazılmaz. Seri, gün atlamadan çözdüğün günlük bulmacaları sayar.'),
      full ? h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => { sound.click(); setTab('daily'); } }, icon('calendar', { size: 18 }), daily.solved ? `DOGdle #${daily.n} sonucun` : `DOGdle #${daily.n} oyna`),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { sound.click(); setTab('practice'); } }, icon('dice', { size: 18 }), 'Serbest mod'),
      ) : null,
    );
  }

  // ---------------------------------------------------------------- saat
  function tick() {
    const txt = fmtClock(msToNext() / 1000);
    sNext.set(txt);
    for (const n of panel.querySelectorAll('[data-dg-cd]')) if (n.textContent !== txt) n.textContent = txt;
    const n = puzzleNumber();
    if (n !== daily.n) {
      // Gece yarısı geçti: yeni bulmaca
      daily = loadDay(n);
      save();
      fx.toast(`Yeni bulmaca hazır: DOGdle #${n}`, 'ember');
      const clash = prac.answer === dailyHero(n).id;
      if (clash) prac = freshPractice(n);
      save();
      if (tab !== 'practice' || clash) {
        render();
      } else {
        syncTabs();
        syncHud();
      }
    }
  }

  // Oyun alanı dışında harfe basınca aramaya odaklan (karakter girişe düşer)
  function onKey(e) {
    if (dead || !picker || e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
    if (closeOverlay || document.querySelector('.modal-backdrop')) return;
    if (e.key && e.key.length === 1 && /[\p{L}\p{N}]/u.test(e.key)) picker.focus();
  }
  window.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- başlangıç
  render();
  tick();
  const firstTime = tab === 'daily' && !daily.guesses.length && !stats.played && !ls.get(K.seen, false);
  if (firstTime) {
    closeOverlay = showOverlay(L.stage, introCard(meta, {
      startLabel: 'Tahmine başla',
      note: `Bugünkü bulmaca: DOGdle #${daily.n}. Sonraki bulmaca İstanbul saatiyle gece yarısı gelir.`,
      onStart: () => {
        ls.set(K.seen, true);
        if (closeOverlay) { closeOverlay(); closeOverlay = null; }
        if (picker) picker.focus();
      },
    }));
  }

  return () => {
    dead = true;
    window.removeEventListener('keydown', onKey);
    runner.destroy();
    if (picker) { picker.destroy(); picker = null; }
    if (hotOff) { ctx.hotkeys(true); hotOff = false; }
    if (closeOverlay) closeOverlay();
    L.destroy();
  };
}
