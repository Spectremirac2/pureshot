// Techies Mayın Tarlası — klasik mayın tarlası, Techies tadında. Sayılar komşu sekiz hücredeki mayın
// sayısıdır; mayınları Sentry ward ile işaretle, tüm güvenli hücreleri aç. İlk tıklama her zaman güvenli
// ve bir alan açar. Üç zorluk: Çaylak (9×9, 10), Orta (16×16, 40 — skor tablosuna yazılan tek zorluk),
// Immortal (16×30, 99; dar ekranda 30×16 dikey tahta). Belge: docs/oyunlar/mayin.md

import './mayin.css';
import { h, clamp, fmtNum, ls, shuffle, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { createRunner, gameLayout, hudStat, showOverlay, introCard, resultCard, submitResult, isTyping } from './kit.js';

const DIFFS = [
  { id: 'caylak', name: 'Çaylak', rows: 9, cols: 9, mines: 10, ico: 'paw', sub: '9×9 · 10 mayın' },
  { id: 'orta', name: 'Orta', rows: 16, cols: 16, mines: 40, ico: 'trophy', sub: '16×16 · 40 mayın · sıralı', ranked: true },
  { id: 'immortal', name: 'Immortal', rows: 16, cols: 30, mines: 99, ico: 'crown', sub: '16×30 · 99 mayın' },
];
const byId = (id) => DIFFS.find((d) => d.id === id) || DIFFS[1];
const LP_MS = 350; // uzun basma: Sentry
const MOVE_TOL = 10; // px; parmak bu kadar kayarsa uzun basma iptal (kaydırma)
const MIN_CELL = 22;
const GRACE_MS = 900;
const BEST_KEY = 'mayin-best';
const DIFF_KEY = 'mayin-diff';
const STATS_KEY = 'mayin-stats';
const MODE_KEY = 'mayin-mode';

const fmtSec = (s) => (Math.max(0, s)).toFixed(1).replace('.', ',');
const NBSP = ' ';

export const meta = {
  id: 'mayin',
  name: 'Techies Mayın Tarlası',
  short: 'Mayın',
  icon: 'mine',
  color: 'var(--dire)',
  kind: 'Zihin · Mantık',
  cat: 'zihin',
  blurb: 'Ormanı Techies’in mayınlarından temizle. Sayılar komşu mayınları söyler; Sentry ile işaretle.',
  lore: 'Techies güldüyse bir yerde hata yaptın. DOG DOG DOG.',
  time: '~3 dk',
  diff: 2,
  unit: 'sn',
  higherIsBetter: false,
  format: (n) => `${fmtSec(n)} sn`,
  scoreText: (n) => fmtSec(n),
  charge: (n) => `${Math.round(n)}sn`,
  rules: [
    'Hücreyi aç: sayı, çevresindeki sekiz hücrede kaç mayın olduğunu söyler. İlk tıklama her zaman güvenli ve bir alan açar.',
    'Mayın sandığın yere Sentry ward (bayrak) koy: sağ tık, uzun bas (~0,35 sn) ya da Bayrak modu.',
    'Akor: açık bir sayıya tıkla; çevresindeki Sentry sayısı tutuyorsa kalan komşular birden açılır.',
    'Mayına basarsan orman zincirleme patlar: DOG DOG DOG. Tüm güvenli hücreleri açan kazanır; süre ilk açılışta başlar.',
    'Skor tablosuna yalnızca Orta (16×16, 40 mayın) süresi yazılır. Çaylak ve Immortal rekorları bu cihazda saklanır.',
  ],
  keys: [
    ['Tık', 'Aç · sayıda akor'],
    [`Sağ${NBSP}tık`, 'Sentry koy / kaldır'],
    [`Uzun${NBSP}bas`, 'Dokunmatikte Sentry'],
    ['← ↑ → ↓', 'İmleç'],
    ['Boşluk / Enter', 'Aç · akor'],
    ['F', 'Sentry'],
  ],
};

const INTRO_RULES = [
  'Sayı = komşu sekiz hücredeki mayın sayısı. İlk tıklama her zaman güvenli.',
  'Sentry ward (bayrak): sağ tık, uzun bas ya da Bayrak modu. Açık sayıya tıklamak akor yapar.',
  'Mayına basarsan zincirleme patlama ve DOG DOG DOG. Tüm güvenli hücreleri aç.',
  'Skor tablosuna yalnızca Orta (16×16, 40 mayın) süresi yazılır; diğerleri yerel rekor.',
];

// ------------------------------------------------------------------ özgün çizimler (SVG)
// Techies'in yakınlık mayını (üstten görünüm), Sentry ward ve Techies'vari cin yüzü.
const SVG_MINE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><radialGradient id='b' cx='.38' cy='.34' r='.75'><stop offset='0' stop-color='#6f6488'/><stop offset='1' stop-color='#241f30'/></radialGradient><radialGradient id='l' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#fff2f3'/><stop offset='.32' stop-color='#ff3b4f'/><stop offset='1' stop-color='#ff3b4f' stop-opacity='0'/></radialGradient></defs><g fill='#17131f' stroke='#0a0810' stroke-width='.6'><circle cx='28.2' cy='16' r='2.3'/><circle cx='24.6' cy='24.6' r='2.3'/><circle cx='16' cy='28.2' r='2.3'/><circle cx='7.4' cy='24.6' r='2.3'/><circle cx='3.8' cy='16' r='2.3'/><circle cx='7.4' cy='7.4' r='2.3'/><circle cx='16' cy='3.8' r='2.3'/><circle cx='24.6' cy='7.4' r='2.3'/></g><circle cx='16' cy='16' r='11' fill='url(#b)' stroke='#0a0810' stroke-width='1.4'/><circle cx='16' cy='16' r='7.2' fill='#352e44' stroke='#0a0810' stroke-width='1'/><path d='M9.2 12.4a7.6 7.6 0 0 1 4.9-4.5' stroke='#b9aed0' stroke-width='1.3' fill='none' stroke-linecap='round' opacity='.75'/><circle cx='16' cy='16' r='6.4' fill='url(#l)'/><circle cx='16' cy='16' r='2.1' fill='#ffe0e3'/></svg>`;
const SVG_SENTRY = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><radialGradient id='g' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='#62c8ff' stop-opacity='.6'/><stop offset='1' stop-color='#62c8ff' stop-opacity='0'/></radialGradient><radialGradient id='o' cx='.4' cy='.34' r='.72'><stop offset='0' stop-color='#e6f9ff'/><stop offset='.5' stop-color='#62c8ff'/><stop offset='1' stop-color='#1d5f93'/></radialGradient></defs><circle cx='16' cy='10' r='10' fill='url(#g)'/><path d='M16 14.5v12.5' stroke='#6b4a2a' stroke-width='2.6' stroke-linecap='round'/><path d='M10.6 29.6l5.4-3.6 5.4 3.6' stroke='#6b4a2a' stroke-width='2.1' fill='none' stroke-linecap='round' stroke-linejoin='round'/><path d='M9.4 6.8c0 5 3 8.2 6.6 8.2s6.6-3.2 6.6-8.2' stroke='#a9824f' stroke-width='2' fill='none' stroke-linecap='round'/><circle cx='16' cy='9' r='5.4' fill='url(#o)' stroke='#0d2a3a' stroke-width='1'/><path d='M12.3 9q3.7-3.4 7.4 0q-3.7 3.4-7.4 0z' fill='#0b2536'/><circle cx='16' cy='9' r='1.5' fill='#c9f3ff'/></svg>`;
const svgUrl = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

const FACE_SVG = `<svg viewBox="0 0 48 48" aria-hidden="true" class="gm-mn-facesvg">
<g class="smoke"><circle cx="17" cy="8" r="4"/><circle cx="23" cy="5" r="4.6"/><circle cx="30" cy="8" r="3.6"/></g>
<path class="ear" d="M10.5 25L1.5 14.5l13 4.3z"/><path class="ear" d="M37.5 25l9-10.5-13 4.3z"/>
<ellipse class="head" cx="24" cy="27.5" rx="15" ry="14"/>
<path class="soot" d="M13 31c2-1 4 0 5 2-2 1-4 1-5-2zM31 33c1-2 3-3 5-2-1 2-3 3-5 2z"/>
<path class="strap" d="M9.3 19.5h29.4"/>
<g class="goggles"><circle cx="17.5" cy="20.5" r="6"/><circle cx="30.5" cy="20.5" r="6"/></g>
<g class="lens"><circle cx="17.5" cy="20.5" r="4.1"/><circle cx="30.5" cy="20.5" r="4.1"/></g>
<g class="glint"><path d="M15 18.6a3 3 0 012.4-1.4M28 18.6a3 3 0 012.4-1.4"/></g>
<g class="xeyes"><path d="M15 18l5 5M20 18l-5 5M28 18l5 5M33 18l-5 5"/></g>
<g class="stars"><path d="M17.5 17.6l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3zM30.5 17.6l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/></g>
<path class="m-idle" d="M16.5 31.5q7.5 6.5 15 0z"/><path class="teeth m-idle" d="M19.5 32.6h9"/>
<ellipse class="m-o" cx="24" cy="34" rx="3" ry="3.6"/>
<path class="m-win" d="M14.5 30.5q9.5 10.5 19 0z"/><path class="teeth m-win" d="M17.5 31.8h13"/>
<path class="m-lose" d="M17 35.5q2.3-2.4 4.7 0t4.6 0t4.7 0"/>
</svg>`;

// ------------------------------------------------------------------ yardımcılar
function cssPx(name, fallback) {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}

/** Minimum tıklama sayısı (3BV): her açıklık 1 + açıklığa komşu olmayan her sayı 1. */
function calc3bv(G) {
  const { rows, cols, mine, num } = G;
  const n = rows * cols;
  const seen = new Uint8Array(n);
  let v = 0;
  for (let i = 0; i < n; i++) {
    if (mine[i] || num[i] || seen[i]) continue;
    v++;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop();
      for (const k of neighbors(G, j)) {
        if (seen[k] || mine[k]) continue;
        seen[k] = 1;
        if (!num[k]) stack.push(k);
      }
    }
  }
  for (let i = 0; i < n; i++) if (!mine[i] && !seen[i]) v++;
  return v;
}

function neighbors(G, i) {
  const { rows, cols } = G;
  const r = Math.floor(i / cols), c = i % cols;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push(rr * cols + cc);
    }
  }
  return out;
}

export function mount(el, ctx, nav) {
  const L = gameLayout(el, meta, { nav });
  const reduced = prefersReducedMotion();
  const coarse = (() => { try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; } })();

  let D = byId(ls.get(DIFF_KEY, 'orta'));
  let flagMode = ls.get(MODE_KEY, 'dig') === 'flag';
  let zoom = false;

  // ---------------------------------------------------------------- HUD
  const sMines = hudStat('Mayın', String(D.mines), { ico: 'mine', cls: 'gm-mn-count' });
  const sTime = hudStat('Süre', '0,0', { ico: 'clock', cls: 'gm-stat-time' });
  const sBest = hudStat('Rekor', '—', { ico: 'crown', cls: 'gm-stat-score' });
  const face = h('button', {
    class: 'gm-mn-face', type: 'button', title: 'Yeni tahta', 'aria-label': 'Yeni tahta (Techies)',
    dataset: { face: 'idle' }, html: FACE_SVG,
  });
  L.hud.append(sMines.el, sTime.el, sBest.el, face);

  // ---------------------------------------------------------------- araç çubuğu + tahta
  let pickers = [];
  function diffPicker(compact) {
    const btns = DIFFS.map((d) => {
      const b = h('button', {
        class: `gm-mn-diff${compact ? ' sm' : ''}`, type: 'button', role: 'radio',
        'aria-checked': String(d.id === D.id), dataset: { diff: d.id },
      },
        compact ? null : h('span', { class: 'gm-mn-diff-ico', 'aria-hidden': 'true' }, icon(d.ico, { size: 18 })),
        h('span', { class: 'gm-mn-diff-txt' },
          h('strong', null, d.name, d.ranked ? h('em', { class: 'gm-mn-rank' }, compact ? '★' : 'sıralı') : null),
          compact ? null : h('span', null, d.sub.replace(' · sıralı', '')),
          compact ? null : h('span', { class: 'gm-mn-diff-best num' }),
        ),
      );
      b.addEventListener('click', () => pickDiff(d.id, compact));
      return b;
    });
    const el2 = h('div', { class: `gm-mn-diffs${compact ? ' sm' : ''}`, role: 'radiogroup', 'aria-label': 'Zorluk' }, btns);
    pickers.push(el2);
    renderPickers();
    return el2;
  }
  function renderPickers() {
    const bests = ls.get(BEST_KEY, {}) || {};
    for (const p of pickers) {
      for (const b of p.children) {
        b.setAttribute('aria-checked', String(b.dataset.diff === D.id));
        const be = b.querySelector('.gm-mn-diff-best');
        if (be) {
          const v = bestOf(b.dataset.diff, bests);
          be.textContent = v != null ? `Rekorun ${fmtSec(v)} sn` : 'Rekor yok';
        }
      }
    }
  }
  function bestOf(id, bests = ls.get(BEST_KEY, {}) || {}) {
    if (id === 'orta') {
      const s = (ctx.store.me.get().scores || {})[meta.id];
      if (typeof s === 'number') return s;
    }
    const v = bests[id];
    return typeof v === 'number' ? v : null;
  }

  const modeBtns = [
    { id: 'dig', name: 'Kaz', ico: 'pick' },
    { id: 'flag', name: 'Bayrak', ico: 'ward' },
  ].map((m) => {
    const b = h('button', { class: 'gm-mn-mode', type: 'button', role: 'radio', dataset: { mode: m.id }, 'aria-checked': String((m.id === 'flag') === flagMode) },
      icon(m.ico, { size: 16 }), m.name);
    b.addEventListener('click', () => setFlagMode(m.id === 'flag', true));
    return b;
  });
  const modes = h('div', { class: 'gm-mn-modes', role: 'radiogroup', 'aria-label': 'Dokunma modu: kaz ya da bayrak (Sentry)' }, modeBtns);
  const zoomBtn = h('button', { class: 'chip gm-mn-zoom', type: 'button', 'aria-pressed': 'false', hidden: true }, icon('search', { size: 14 }), 'Yakınlaştır');
  zoomBtn.addEventListener('click', () => {
    zoom = !zoom;
    zoomBtn.setAttribute('aria-pressed', String(zoom));
    ctx.sound.click();
    layoutBoard();
  });
  const hint = h('p', { class: 'gm-mn-hint xsmall dim' },
    coarse ? 'Dokun: aç · Uzun bas: Sentry · Sayıya dokun: akor' : 'Sol tık: aç · Sağ tık: Sentry · Sayıya tık: akor · Oklar + Boşluk + F');
  const toolbar = h('div', { class: 'gm-mn-bar' },
    diffPicker(true),
    h('div', { class: 'gm-mn-tools' }, modes, zoomBtn),
  );
  const board = h('div', {
    class: 'gm-mn-board',
    role: 'grid',
    tabindex: '0',
    'aria-label': 'Mayın tarlası. Ok tuşlarıyla gez, Boşluk ya da Enter ile aç, F ile Sentry koy.',
  });
  board.style.setProperty('--mn-mine', svgUrl(SVG_MINE));
  board.style.setProperty('--mn-sentry', svgUrl(SVG_SENTRY));
  const view = h('div', { class: 'gm-mn-view' }, board);
  const field = h('div', { class: 'gm-mn-field' }, toolbar, view, hint);
  L.stage.appendChild(field);

  // ---------------------------------------------------------------- durum
  let G = null;
  let cells = [];
  let runner = createRunner(frame);
  let closeOverlay = null;
  let hotOff = false;
  let graceUntil = 0;
  let graceTimer = 0;
  let boardFocused = false;
  let kb = false;
  let press = null;

  function say(m) { L.live.textContent = m; }

  function newGame() {
    const d = D;
    let rows = d.rows, cols = d.cols;
    // Dar ekranda yatay tahtayı dikey çevir (Immortal 16×30 → 30×16): hücreler dokunulabilir kalsın
    const vw = view.clientWidth || field.clientWidth || window.innerWidth;
    if (cols > rows && (vw - 8) / cols < MIN_CELL + 4) [rows, cols] = [cols, rows];
    const n = rows * cols;
    G = {
      d, rows, cols, n,
      mine: new Uint8Array(n), num: new Uint8Array(n), open: new Uint8Array(n), flag: new Uint8Array(n),
      state: 'ready', placed: false, opened: 0, flags: 0, userFlags: 0, t0: 0, time: 0, clicks: 0,
      cur: Math.floor(rows / 2) * cols + Math.floor(cols / 2), bbbv: 0, boomAt: -1,
    };
    buildBoard();
    layoutBoard();
    sMines.set(String(d.mines));
    sMines.el.classList.remove('neg');
    sTime.set('0,0');
    renderBest();
    setFace('idle');
    field.dataset.state = 'ready';
    say(`${d.name}: ${rows} satır, ${cols} sütun, ${d.mines} mayın. İlk tıklama güvenli.`);
  }

  function buildBoard() {
    const { rows, cols, n } = G;
    board.replaceChildren();
    board.style.setProperty('--cols', cols);
    board.style.setProperty('--rows', rows);
    board.setAttribute('aria-rowcount', rows);
    board.setAttribute('aria-colcount', cols);
    cells = new Array(n);
    for (let r = 0; r < rows; r++) {
      const row = h('div', { class: 'gm-mn-row', role: 'row' });
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const cell = h('div', { class: `gm-mn-c${(r + c) % 2 ? ' alt' : ''}`, role: 'gridcell', id: `gm-mn-c-${i}`, dataset: { i } });
        cells[i] = cell;
        row.appendChild(cell);
      }
      board.appendChild(row);
    }
    board.classList.toggle('kb', kb);
    setCursor(G.cur);
  }

  function layoutBoard() {
    if (!G) return;
    const { rows, cols } = G;
    const vw = Math.max(120, view.clientWidth - 10);
    const narrow = window.innerWidth < 720;
    const top = cssPx('--hud-h', 56);
    const bar = cssPx('--bar-h', 84);
    // Masaüstünde tahta, üst başlık + HUD + araç çubuğu ile birlikte ekrana sığsın
    const hBudget = window.innerHeight - top - bar - 16 - 96 - toolbar.offsetHeight - 24;
    let cs = Math.floor(Math.min(vw / cols, narrow ? 46 : 48));
    if (!narrow) cs = Math.min(cs, Math.floor(hBudget / rows));
    cs = Math.max(MIN_CELL, cs);
    const canZoom = cs < 32 && (coarse || narrow);
    zoomBtn.hidden = !canZoom;
    if (!canZoom && zoom) { zoom = false; zoomBtn.setAttribute('aria-pressed', 'false'); }
    if (zoom) cs = Math.max(cs, Math.min(40, Math.round(cs * 1.6)));
    board.style.setProperty('--cs', `${cs}px`);
    view.classList.toggle('scroll', cs * cols > vw + 1);
  }
  const ro = new ResizeObserver(() => layoutBoard());
  ro.observe(view);

  function setFace(f) { face.dataset.face = f; }

  function renderBest() {
    const v = bestOf(D.id);
    sBest.set(v != null ? fmtSec(v) : '—');
    sBest.el.title = D.ranked ? 'Orta: skor tablosundaki süren' : `${D.name}: bu cihazdaki rekorun`;
  }

  function setFlagMode(on, user) {
    flagMode = !!on;
    for (const b of modeBtns) b.setAttribute('aria-checked', String((b.dataset.mode === 'flag') === flagMode));
    field.classList.toggle('flagmode', flagMode);
    if (user) { ls.set(MODE_KEY, flagMode ? 'flag' : 'dig'); ctx.sound.click(); say(flagMode ? 'Bayrak modu: dokunuş Sentry koyar.' : 'Kazma modu: dokunuş hücreyi açar.'); }
  }
  setFlagMode(flagMode, false);

  async function pickDiff(id, fromToolbar) {
    if (id === D.id && (!fromToolbar || (G && G.state === 'ready'))) { renderPickers(); return; }
    if (fromToolbar && G && G.state === 'play' && G.opened > 0) {
      const ok = await ctx.fx.confirm('Bu tahtayı bırakıp zorluğu değiştirelim mi?', { ok: 'Değiştir', cancel: 'Devam et' });
      if (!ok) { renderPickers(); return; }
    }
    D = byId(id);
    ls.set(DIFF_KEY, D.id);
    ctx.sound.click();
    renderPickers();
    // Araç çubuğundan ya da başlangıç kartından: tahta hemen yeni zorlukla kurulur.
    // Sonuç kartından: biten tahta arkada kalır, "Tekrar" yeni zorlukla başlatır.
    if (fromToolbar || (G && G.state === 'ready')) newGame();
    else renderBest();
  }

  // ---------------------------------------------------------------- tahta mantığı
  function placeMines(safe) {
    const excl = new Set([safe, ...neighbors(G, safe)]);
    let pool = [];
    for (let i = 0; i < G.n; i++) if (!excl.has(i)) pool.push(i);
    if (pool.length < G.d.mines) { pool = []; for (let i = 0; i < G.n; i++) if (i !== safe) pool.push(i); }
    for (const i of shuffle(pool).slice(0, G.d.mines)) G.mine[i] = 1;
    for (let i = 0; i < G.n; i++) {
      let k = 0;
      for (const j of neighbors(G, i)) k += G.mine[j];
      G.num[i] = k;
    }
    G.placed = true;
    G.bbbv = calc3bv(G);
    G.state = 'play';
    G.t0 = runner.time;
    field.dataset.state = 'play';
    const st = ls.get(STATS_KEY, {}) || {};
    const s = st[G.d.id] || { p: 0, w: 0 };
    s.p++;
    st[G.d.id] = s;
    ls.set(STATS_KEY, st);
    syncHotkeys();
  }

  const playable = () => G && (G.state === 'ready' || G.state === 'play');

  function paint(i, delay = 0) {
    const c = cells[i];
    const n = G.num[i];
    let cls = `gm-mn-c${(Math.floor(i / G.cols) + (i % G.cols)) % 2 ? ' alt' : ''}`;
    if (G.open[i]) {
      cls += ' o';
      if (n) cls += ` n${n}`;
      c.textContent = n ? String(n) : '';
      if (delay && !reduced) { cls += ' anim'; c.style.setProperty('--d', `${delay}ms`); }
    } else if (G.flag[i]) {
      cls += ' f';
      c.textContent = '';
    } else {
      c.textContent = '';
    }
    if (i === G.cur) cls += ' cur';
    c.className = cls;
    if (i === G.cur) labelCursor();
  }

  function reveal(i, origin = i) {
    if (!playable() || G.open[i] || G.flag[i]) return 0;
    if (!G.placed) placeMines(i);
    if (G.mine[i]) { lose(i); return -1; }
    const stack = [i];
    let count = 0;
    const or = Math.floor(origin / G.cols), oc = origin % G.cols;
    while (stack.length) {
      const j = stack.pop();
      if (G.open[j] || G.flag[j]) continue;
      G.open[j] = 1;
      G.opened++;
      count++;
      const dist = Math.max(Math.abs(Math.floor(j / G.cols) - or), Math.abs((j % G.cols) - oc));
      paint(j, count > 1 ? Math.min(360, dist * 28) : 0);
      if (!G.num[j]) for (const k of neighbors(G, j)) if (!G.open[k] && !G.flag[k] && !G.mine[k]) stack.push(k);
    }
    if (G.opened >= G.n - G.d.mines) win();
    return count;
  }

  function chord(i) {
    if (!playable() || !G.open[i] || !G.num[i]) return;
    const nb = neighbors(G, i);
    const flags = nb.reduce((a, k) => a + G.flag[k], 0);
    const closed = nb.filter((k) => !G.open[k] && !G.flag[k]);
    if (!closed.length) return;
    if (flags !== G.num[i]) {
      // Sentry sayısı tutmuyor: komşuları kısa süre vurgula
      for (const k of closed) cells[k].classList.add('hint');
      setTimeout(() => { for (const k of closed) if (cells[k]) cells[k].classList.remove('hint'); }, 260);
      ctx.sound.miss();
      return;
    }
    G.clicks++;
    let opened = 0;
    for (const k of closed) {
      if (!playable()) break;
      const r = reveal(k, i);
      if (r < 0) return;
      opened += r;
    }
    if (opened) ctx.sound.click();
  }

  function act(i) {
    if (!playable()) return;
    if (G.open[i]) { chord(i); return; }
    if (G.flag[i]) { ctx.sound.miss(); return; }
    G.clicks++;
    const r = reveal(i);
    if (r > 0) {
      if (r > 8) ctx.sound.whoosh(); else ctx.sound.click();
      if (G.state === 'play') say(r > 1 ? `${r} hücre açıldı.` : (G.num[i] ? `${G.num[i]}.` : 'Boş.'));
    }
  }

  function toggleFlag(i) {
    if (!playable() || G.open[i]) return;
    G.flag[i] = G.flag[i] ? 0 : 1;
    G.flags += G.flag[i] ? 1 : -1;
    if (G.flag[i]) G.userFlags++;
    paint(i);
    if (G.flag[i] && !reduced) {
      cells[i].classList.add('plant');
    }
    const left = G.d.mines - G.flags;
    sMines.set(String(left));
    sMines.el.classList.toggle('neg', left < 0);
    ctx.sound.charge(G.flag[i] ? 0.8 : 0.3);
    say(G.flag[i] ? `Sentry kondu. ${left} mayın kaldı.` : `Sentry kaldırıldı. ${left} mayın kaldı.`);
  }

  // ---------------------------------------------------------------- bitiş
  function stopClock() {
    G.time = Math.max(0.1, Math.round((runner.time - G.t0) * 10) / 10);
    sTime.set(fmtSec(G.time));
  }

  function endCommon() {
    field.dataset.state = G.state;
    board.classList.remove('kb');
    graceUntil = performance.now() + GRACE_MS;
    if (graceTimer) clearTimeout(graceTimer);
    graceTimer = setTimeout(() => { graceTimer = 0; syncHotkeys(); }, GRACE_MS + 30);
    syncHotkeys();
  }

  function win() {
    G.state = 'won';
    stopClock();
    for (let i = 0; i < G.n; i++) {
      if (G.mine[i] && !G.flag[i]) { G.flag[i] = 1; G.flags++; paint(i); cells[i].classList.add('auto'); }
    }
    sMines.set('0');
    sMines.el.classList.remove('neg');
    setFace('win');
    endCommon();
    const d = G.d;
    const t = G.time;
    // Rekorlar: her zorluk için yerel en iyi; yalnızca Orta skor tablosuna gider
    const bests = ls.get(BEST_KEY, {}) || {};
    const prevLocal = typeof bests[d.id] === 'number' ? bests[d.id] : null;
    let saved;
    if (d.ranked) {
      saved = submitResult(meta, t);
    } else {
      saved = { record: prevLocal == null || t < prevLocal, prev: prevLocal };
    }
    if (prevLocal == null || t < prevLocal) { bests[d.id] = t; ls.set(BEST_KEY, bests); }
    const st = ls.get(STATS_KEY, {}) || {};
    const s = st[d.id] || { p: 1, w: 0 };
    s.w++;
    st[d.id] = s;
    ls.set(STATS_KEY, st);
    renderBest();
    renderPickers();
    ctx.sound.win();
    if (!reduced) {
      const r = view.getBoundingClientRect();
      ctx.fx.confetti(r.left + r.width / 2, Math.max(80, r.top + Math.min(r.height, window.innerHeight) * 0.35), 110);
    }
    say(`Temizlendi! ${fmtSec(t)} saniye.`);
    const eff = G.clicks ? Math.min(100, Math.round((G.bbbv / G.clicks) * 100)) : 0;
    let quip;
    if (d.id === 'orta') {
      quip = t < 45 ? 'Techies bile şaşırdı: kırk mayın, tek patlama yok. 1vDOQUZ temizlik.'
        : t < 90 ? 'Temiz iş. Sentry’ler yerinde, mayınlar etkisiz. Techies başka koridora taşınıyor.'
          : t < 180 ? 'Sağlam ve sabırlı. Sıradaki hedef: 90 saniyenin altı.'
            : 'Yavaş ama güvenli. Techies’in planı suya düştü.';
    } else if (d.id === 'caylak') {
      quip = t < 15 ? 'Isınma turu uçtu gitti. Sırada Orta (sıralı) var.' : 'Çaylak tahta temiz. Hazırsan Orta seni bekliyor; skor tablosu orada.';
    } else {
      quip = t < 200 ? 'Immortal tahta, Immortal eller. Techies erken emekliliği düşünüyor.' : 'Doksan dokuz mayın, sıfır DOG. Immortal tahtayı bitirmek başlı başına efsane.';
    }
    const dispMeta = d.ranked ? meta : { ...meta, name: `${meta.name} · ${d.name}` };
    const stats = [
      ['Zorluk', d.name],
      ['Tıklama', fmtNum(G.clicks)],
      ['3BV', fmtNum(G.bbbv)],
      ['Verim', `%${eff}`],
      ['Sentry', fmtNum(G.userFlags)],
      ['Kazanma', `${s.w}/${s.p}`],
    ];
    const my = G;
    runner.after(0.9, () => {
      if (G !== my) return;
      const { node } = resultCard(dispMeta, {
        score: t,
        saved,
        stats,
        quip,
        quiet: true,
        title: d.ranked ? 'Temizlendi · Orta (sıralı)' : `Temizlendi · ${d.name} · yerel rekor`,
        extra: h('div', { class: 'gm-mn-cardpick' }, h('span', { class: 'label' }, 'Sıradaki tahta'), diffPicker(false)),
        onRetry: start,
        onBack: () => nav && nav.back(),
      });
      closeOverlay = showOverlay(L.stage, node, { reveal: true });
    });
  }

  function lose(i) {
    G.state = 'lost';
    G.boomAt = i;
    stopClock();
    setFace('lose');
    endCommon();
    cells[i].classList.add('m', 'boom');
    ctx.sound.hit();
    ctx.fx.shake(view);
    say('Mayına bastın! Zincirleme patlama.');
    // Yanlış Sentry'ler çarpı, doğru Sentry'ler yerinde; diğer mayınlar uzaklığa göre sırayla patlar
    for (let j = 0; j < G.n; j++) if (G.flag[j] && !G.mine[j]) cells[j].classList.add('x');
    const r0 = Math.floor(i / G.cols), c0 = i % G.cols;
    const others = [];
    for (let j = 0; j < G.n; j++) if (G.mine[j] && j !== i) others.push(j);
    others.sort((a, b) => Math.hypot(Math.floor(a / G.cols) - r0, (a % G.cols) - c0) - Math.hypot(Math.floor(b / G.cols) - r0, (b % G.cols) - c0));
    const my = G;
    let chainEnd = 0.35;
    if (reduced) {
      for (const j of others) cells[j].classList.add('m', G.flag[j] ? 'ok' : 'still');
    } else {
      const total = Math.min(1.6, 0.07 * others.length);
      const step = others.length ? total / others.length : 0;
      others.forEach((j, k) => {
        runner.after(0.18 + k * step, () => {
          if (G !== my) return;
          cells[j].classList.add('m', G.flag[j] ? 'ok' : 'pop');
          if (!G.flag[j] && k % 5 === 0) ctx.sound.hit();
        });
      });
      chainEnd = 0.18 + total + 0.35;
    }
    runner.after(chainEnd, () => {
      if (G !== my) return;
      ctx.fx.stamp('DOG DOG DOG');
      ctx.sound.lose();
      runner.after(1.0, () => { if (G === my) showLoss(); });
    });
  }

  function showLoss() {
    const d = G.d;
    const safe = G.n - d.mines;
    const pct = Math.floor((G.opened / safe) * 100);
    const correct = Array.from(G.flag).reduce((a, f, j) => a + (f && G.mine[j] ? 1 : 0), 0);
    const wrong = G.flags - correct;
    const st = ls.get(STATS_KEY, {}) || {};
    const s = st[d.id] || { p: 1, w: 0 };
    const quip = pct >= 85 ? 'Bitiş çizgisinde mayın… Techies kahkahayı bastı. DOG DOG DOG.'
      : pct >= 40 ? 'Ormanın yarısı temiz, sonra orman cevap verdi. DOG DOG DOG.'
        : 'BOOM! Techies’in mayını seni erkenden buldu. Sayıları say, sonra aç. DOG DOG DOG.';
    const retry = h('button', { class: 'btn primary', type: 'button', 'data-primary': '' }, icon('refresh', { size: 18 }), 'Tekrar dene');
    retry.addEventListener('click', () => { ctx.sound.click(); start(); });
    const back = h('button', { class: 'btn ghost', type: 'button' }, icon('arrowLeft', { size: 18 }), 'Oyunlar');
    back.addEventListener('click', () => { ctx.sound.click(); if (nav) nav.back(); });
    const stats = [
      ['Süre', `${fmtSec(G.time)} sn`],
      ['Açılan', `${fmtNum(G.opened)}/${fmtNum(safe)}`],
      ['Doğru Sentry', wrong > 0 ? `${correct} · ${wrong} yanlış` : fmtNum(correct)],
    ];
    const node = h('div', { class: 'gm-result stack gm-mn-loss' },
      h('div', { class: 'row gm-result-top' },
        h('span', { class: 'eyebrow' }, 'Mayına bastın'),
        h('span', { class: 'badge blood' }, icon('mine', { size: 12 }), d.name),
      ),
      h('div', { class: 'gm-result-score' },
        h('span', { class: 'gm-result-num num gm-mn-lossnum' }, `%${pct}`),
        h('span', { class: 'gm-result-unit' }, 'temizlendi'),
      ),
      h('dl', { class: 'gm-result-stats n-3' }, stats.map(([k, v]) => h('div', null, h('dt', null, k), h('dd', { class: 'num' }, v)))),
      h('p', { class: 'gm-result-quip' }, quip),
      h('p', { class: 'xsmall dim gm-result-note' }, `${d.name}: ${s.w} galibiyet / ${s.p} tahta. Kaybedilen tahtalar skor tablosuna yazılmaz.`),
      h('div', { class: 'gm-mn-cardpick' }, h('span', { class: 'label' }, 'Sıradaki tahta'), diffPicker(false)),
      h('div', { class: 'row gm-result-actions' }, retry, back),
    );
    closeOverlay = showOverlay(L.stage, node, { reveal: true });
  }

  // ---------------------------------------------------------------- imleç ve klavye
  function labelCursor() {
    if (!G) return;
    const i = G.cur;
    const r = Math.floor(i / G.cols) + 1, c = (i % G.cols) + 1;
    let s;
    if (G.open[i]) s = G.num[i] ? `${G.num[i]} mayın komşu` : 'boş';
    else if (G.flag[i]) s = 'Sentry';
    else s = 'kapalı';
    if (G.state === 'lost' && G.mine[i]) s = 'mayın';
    cells[i].setAttribute('aria-label', `${r}. satır, ${c}. sütun: ${s}`);
  }

  function setCursor(i) {
    if (!G) return;
    if (cells[G.cur]) cells[G.cur].classList.remove('cur');
    G.cur = clamp(i, 0, G.n - 1);
    cells[G.cur].classList.add('cur');
    board.setAttribute('aria-activedescendant', cells[G.cur].id);
    labelCursor();
  }

  function scrollCellIntoView(i) {
    const c = cells[i];
    if (!c) return;
    const r = c.getBoundingClientRect();
    const vr = view.getBoundingClientRect();
    if (view.classList.contains('scroll')) {
      if (r.left < vr.left + 4) view.scrollLeft -= vr.left + 4 - r.left;
      else if (r.right > vr.right - 4) view.scrollLeft += r.right - (vr.right - 4);
    }
    const topB = cssPx('--hud-h', 56) + 8;
    const botB = window.innerHeight - cssPx('--bar-h', 84) - 8;
    if (r.top < topB) window.scrollBy(0, r.top - topB);
    else if (r.bottom > botB) window.scrollBy(0, r.bottom - botB);
  }

  function onKey(e) {
    if (!G || e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
    if (closeOverlay || document.querySelector('.modal-backdrop')) return;
    const ae = document.activeElement;
    const onBoard = ae === board;
    const bodyFocus = !ae || ae === document.body;
    if (!onBoard && !(G.state === 'play' && bodyFocus)) return;
    const k = e.key;
    const dirs = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (dirs[k]) {
      e.preventDefault();
      if (!kb) { kb = true; board.classList.add('kb'); }
      const [dr, dc] = dirs[k];
      const r = clamp(Math.floor(G.cur / G.cols) + dr, 0, G.rows - 1);
      const c = clamp((G.cur % G.cols) + dc, 0, G.cols - 1);
      setCursor(r * G.cols + c);
      scrollCellIntoView(G.cur);
      return;
    }
    if (k === ' ' || k === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      if (e.repeat) return;
      if (!kb) { kb = true; board.classList.add('kb'); }
      act(G.cur);
      return;
    }
    if (e.code === 'KeyF' || k === 'f' || k === 'F') {
      e.preventDefault();
      if (e.repeat) return;
      if (!kb) { kb = true; board.classList.add('kb'); }
      toggleFlag(G.cur);
    }
  }
  window.addEventListener('keydown', onKey);

  function syncHotkeys() {
    const want = boardFocused || (G && G.state === 'play') || performance.now() < graceUntil;
    if (want && !hotOff) { ctx.hotkeys(false); hotOff = true; }
    else if (!want && hotOff) { ctx.hotkeys(true); hotOff = false; }
  }
  board.addEventListener('focus', () => { boardFocused = true; syncHotkeys(); });
  board.addEventListener('blur', () => { boardFocused = false; syncHotkeys(); });

  // ---------------------------------------------------------------- işaretçi (fare + dokunmatik)
  const cellAt = (e) => {
    const t = e.target && e.target.closest ? e.target.closest('.gm-mn-c') : null;
    return t && board.contains(t) ? Number(t.dataset.i) : -1;
  };
  function setPressed(list, on) {
    for (const i of list) if (cells[i] && !G.open[i] && !G.flag[i]) cells[i].classList.toggle('pr', on);
  }
  function pressTargets(i) {
    if (G.open[i]) return G.num[i] ? neighbors(G, i) : [];
    return [i];
  }
  function clearPress() {
    if (!press) return;
    if (press.timer) clearTimeout(press.timer);
    if (G && cells[press.i]) {
      cells[press.i].classList.remove('lp');
      setPressed(press.targets || [], false);
    }
    press = null;
    if (G && playable()) setFace('idle');
  }

  function onDown(e) {
    if (!G || !playable()) return;
    const i = cellAt(e);
    if (i < 0) return;
    if (kb) { kb = false; board.classList.remove('kb'); }
    try { board.focus({ preventScroll: true }); } catch { /* yok say */ }
    clearPress();
    if (e.pointerType === 'mouse') {
      if (e.button === 2) { e.preventDefault(); toggleFlag(i); return; }
      if (e.button !== 0 && e.button !== 1) return;
      e.preventDefault();
      const targets = e.button === 1 ? (G.open[i] ? neighbors(G, i) : []) : pressTargets(i);
      press = { i, pid: e.pointerId, mouse: true, chord: e.button === 1, targets };
      setPressed(targets, true);
      setFace('press');
      return;
    }
    // Dokunmatik / kalem: kısa dokunuş = mod eylemi, uzun basış = karşıt eylem
    press = { i, pid: e.pointerId, mouse: false, x: e.clientX, y: e.clientY, handled: false, targets: [] };
    if (!G.open[i] || G.num[i]) {
      cells[i].classList.add('lp');
      cells[i].style.setProperty('--lp', `${LP_MS}ms`);
    }
    setFace('press');
    press.timer = setTimeout(() => {
      if (!press || press.i !== i) return;
      press.handled = true;
      cells[i].classList.remove('lp');
      if (G.open[i]) chord(i);
      else if (flagMode) act(i);
      else toggleFlag(i);
      if (G && playable()) setFace('idle');
    }, LP_MS);
  }
  function onMove(e) {
    if (!press || e.pointerId !== press.pid) return;
    if (press.mouse) {
      const i = cellAt(e);
      if (i !== press.i) {
        setPressed(press.targets, false);
        press.i = i;
        press.targets = i < 0 ? [] : press.chord ? (G.open[i] ? neighbors(G, i) : []) : pressTargets(i);
        setPressed(press.targets, true);
      }
      return;
    }
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_TOL) clearPress();
  }
  function onUp(e) {
    if (!press || e.pointerId !== press.pid) return;
    const p = press;
    if (p.mouse) {
      const i = cellAt(e);
      clearPress();
      if (i < 0 || i !== p.i || !G) return;
      if (p.chord) chord(i);
      else act(i);
      return;
    }
    clearPress();
    if (p.handled || !G) return;
    const i = p.i;
    if (G.open[i]) chord(i);
    else if (flagMode) toggleFlag(i);
    else act(i);
  }
  board.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', clearPress);
  const onCtx = (e) => e.preventDefault();
  board.addEventListener('contextmenu', onCtx);
  const onAnimEnd = (e) => {
    const c = e.target;
    if (c && c.classList) { c.classList.remove('plant', 'anim'); }
  };
  board.addEventListener('animationend', onAnimEnd);

  face.addEventListener('click', () => {
    ctx.sound.click();
    start();
  });

  // ---------------------------------------------------------------- döngü
  function frame() {
    if (G && G.state === 'play') sTime.set(fmtSec(Math.min(3599.9, runner.time - G.t0)));
  }

  function showBoard() {
    // Başlık HUD'u + tahtanın üstü, sabit üst çubukla alt yetenek çubuğunun arasına gelsin
    const topB = cssPx('--hud-h', 56) + 8;
    const botB = window.innerHeight - cssPx('--bar-h', 84) - 8;
    const a = L.hud.getBoundingClientRect();
    const b = view.getBoundingClientRect();
    let dy = 0;
    if (b.bottom > botB) dy = b.bottom - botB;
    if (a.top - dy < topB) dy = a.top - topB;
    if (Math.abs(dy) < 2) return;
    try { window.scrollBy({ top: dy, behavior: reduced ? 'instant' : 'smooth' }); } catch { window.scrollBy(0, dy); }
  }

  function start() {
    if (closeOverlay) { closeOverlay(); closeOverlay = null; }
    pickers = pickers.filter((p) => p.isConnected); // kapanan kartların seçicileri
    if (graceTimer) { clearTimeout(graceTimer); graceTimer = 0; }
    graceUntil = 0;
    runner.destroy();
    runner = createRunner(frame);
    clearPress();
    newGame();
    syncHotkeys();
    if (!coarse) { try { board.focus({ preventScroll: true }); } catch { /* yok say */ } }
    requestAnimationFrame(showBoard);
  }

  // Yalnızca geliştirme sunucusunda: uçtan uca test botunun mayın konumlarını okuyabilmesi için
  if (import.meta.env && import.meta.env.DEV) {
    window.__mayinDebug = () => {
      if (!G) return null;
      const list = (arr) => { const o = []; for (let i = 0; i < G.n; i++) if (arr[i]) o.push(i); return o; };
      return {
        state: G.state, diff: G.d.id, rows: G.rows, cols: G.cols, placed: G.placed,
        mines: list(G.mine), open: list(G.open), flags: list(G.flag), num: Array.from(G.num),
        opened: G.opened, time: G.time, clicks: G.clicks, bbbv: G.bbbv, flagMode, cs: parseFloat(board.style.getPropertyValue('--cs')),
      };
    };
  }

  // ---------------------------------------------------------------- başlangıç
  newGame();
  const introNode = introCard(meta, {
    onStart: start,
    rules: INTRO_RULES,
    extra: h('div', { class: 'gm-mn-cardpick' }, h('span', { class: 'label' }, 'Zorluk'), diffPicker(false)),
    note: '“En iyin” Orta (sıralı) süreni gösterir. Kısayollar tahta odaktayken ve oyun sürerken kapalı.',
  });
  closeOverlay = showOverlay(L.stage, introNode);

  return () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', clearPress);
    board.removeEventListener('pointerdown', onDown);
    board.removeEventListener('contextmenu', onCtx);
    board.removeEventListener('animationend', onAnimEnd);
    if (press && press.timer) clearTimeout(press.timer);
    press = null;
    if (graceTimer) clearTimeout(graceTimer);
    ro.disconnect();
    runner.destroy();
    if (hotOff) { ctx.hotkeys(true); hotOff = false; }
    if (import.meta.env && import.meta.env.DEV) delete window.__mayinDebug;
    G = null;
    cells = [];
    if (closeOverlay) closeOverlay();
    L.destroy();
  };
}
