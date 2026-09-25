// DOG Bingo — 24 saatlik yayınlar için 5×5 izleyici bingosu.
// Kart, 6 karakterlik bir koddan tohumlu rastgelelikle üretilir (aynı kod = aynı kart; arkadaşınla
// paylaşabilirsin). İşaretler ve saatleri tarayıcıda saklanır. Skor = karttaki tamamlanmış çizgi
// sayısı (0–12); arttıkça rekora gönderilir. Oyun "bitmez": kart yayın boyunca açık kalır.

import './bingo.css';
import { h, clear, fmtNum, ls, hashStr, seeded, copyText, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { store } from '../../core/store.js';
import { BINGO_CATS, BINGO_EVENTS, BINGO_FREE, BINGO_DECK, BINGO_QUIPS } from '../../data/bingo.js';
import { gameLayout, hudStat, showOverlay, introCard, submitResult, bestText, isTyping, revealInView } from './kit.js';

const N = 5;
const CELLS = N * N;
const FREE = 12;
const CODE_LEN = 6;
// Karıştırılabilecek karakterler yok: O/0, I/1/L
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LS_KEY = 'bingo:v1';
const LS_STREAM = 'bingo:stream';
const HEAD = ['B', 'I', 'N', 'G', 'O'];

export const meta = {
  id: 'bingo',
  name: 'DOG Bingo',
  short: 'Bingo',
  icon: 'star',
  color: 'var(--ember)',
  kind: 'Yayın · Etkileşim',
  blurb: 'Yayını izlerken DOG anlarını işaretle. Satırı tamamlayan bağırır: BINGO!',
  lore: 'En kısa yayın 24 saat. Kartın dolmazsa ayıp olur.',
  time: 'Yayın boyu',
  diff: 1,
  unit: 'çizgi',
  higherIsBetter: true,
  format: (n) => `${fmtNum(n)} çizgi`,
  rules: [
    'Yayında olan anı kartta bul, hücresine dokun; işaret saatiyle günlüğe düşer.',
    'Ortadaki DOG DOG DOG bedava. Satır, sütun ya da çapraz tamamlanınca BINGO!',
    'Skor = karttaki tamamlanmış çizgi (en çok 12). Arttıkça rekorun güncellenir.',
    'Kart kodunu arkadaşına gönder; aynı kodu yükleyen aynı kartla oynar.',
    'Yayın modu kartı büyütür, gerisini gizler: ekran paylaşımına hazır.',
  ],
  keys: [['← ↑ → ↓', 'Hücreler arasında gez'], ['Enter veya Boşluk', 'İşaretle / kaldır']],
};

// ------------------------------------------------------------------ çizgiler
const range = (n) => Array.from({ length: n }, (_, i) => i);
export const LINES = [
  ...range(N).map((r) => ({ id: `r${r}`, name: `${r + 1}. satır`, cells: range(N).map((c) => r * N + c) })),
  ...range(N).map((c) => ({ id: `c${c}`, name: `${HEAD[c]} sütunu`, cells: range(N).map((r) => r * N + c) })),
  { id: 'd0', name: 'Çapraz ↘', cells: range(N).map((i) => i * N + i) },
  { id: 'd1', name: 'Çapraz ↙', cells: range(N).map((i) => i * N + (N - 1 - i)) },
];

// ------------------------------------------------------------------ kart kodu
export function normCode(s) {
  return String(s || '').toUpperCase().replace(/[\s\-_.]/g, '');
}
export function validCode(s) {
  return s.length === CODE_LEN && [...s].every((ch) => ALPHA.includes(ch));
}
function randomCode(avoid = '') {
  for (let tries = 0; tries < 5; tries++) {
    let buf;
    try {
      buf = crypto.getRandomValues(new Uint32Array(CODE_LEN));
    } catch {
      buf = Array.from({ length: CODE_LEN }, () => Math.floor(Math.random() * 2 ** 32));
    }
    const s = Array.from(buf, (v) => ALPHA[v % ALPHA.length]).join('');
    if (s !== avoid) return s;
  }
  return 'DQG24S';
}

/**
 * Koddan kart: 25 olay (ortada bedava hücre). Deterministiktir.
 * Kategoriler dengelidir (5-5-5-5-4) ve aynı kategori bir çizgide olabildiğince tekrar etmez.
 */
export function cardFromCode(code) {
  const rnd = seeded(hashStr(`dog-bingo:${BINGO_DECK}:${code}`));
  const shuf = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const cats = shuf(BINGO_CATS.map((c) => c.id));
  const picked = [];
  cats.forEach((cat, i) => {
    picked.push(...shuf(BINGO_EVENTS.filter((e) => e.cat === cat)).slice(0, i < 4 ? 5 : 4));
  });
  // Yerleşim: birkaç tohumlu permütasyondan kategori kümelenmesi en az olanı
  let best = null;
  let bestPen = Infinity;
  for (let k = 0; k < 40 && bestPen > 0; k++) {
    const perm = shuf(picked);
    const cells = [...perm.slice(0, FREE), BINGO_FREE, ...perm.slice(FREE)];
    let pen = 0;
    for (const line of LINES) {
      const seen = {};
      for (const i of line.cells) {
        if (i === FREE) continue;
        const c = cells[i].cat;
        pen += seen[c] || 0;
        seen[c] = (seen[c] || 0) + 1;
      }
    }
    if (pen < bestPen) { bestPen = pen; best = cells; }
  }
  return best;
}

// ------------------------------------------------------------------ saklama
function loadState() {
  const s = ls.get(LS_KEY, null);
  if (!s || typeof s !== 'object' || !validCode(normCode(s.code))) return null;
  const marks = {};
  if (s.marks && typeof s.marks === 'object') {
    for (const [k, v] of Object.entries(s.marks)) {
      const i = Number(k);
      if (Number.isInteger(i) && i >= 0 && i < CELLS && i !== FREE && Number.isFinite(v)) marks[i] = v;
    }
  }
  const order = Array.isArray(s.order) ? s.order.filter((i) => marks[i] != null) : [];
  for (const k of Object.keys(marks)) if (!order.includes(Number(k))) order.push(Number(k));
  return {
    code: normCode(s.code),
    created: Number.isFinite(s.created) ? s.created : Date.now(),
    marks,
    order,
    peak: Number.isFinite(s.peak) ? s.peak : 0,
  };
}

const catOf = (id) => BINGO_CATS.find((c) => c.id === id) || BINGO_CATS[0];
const clock = (ts) => {
  try {
    return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
};
function ageText(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  if (m < 1) return 'az önce';
  if (m < 60) return `${m} dk`;
  const hh = Math.floor(m / 60);
  return `${hh} sa ${m % 60} dk`;
}

// ------------------------------------------------------------------ oyun
export function mount(el, ctx, nav) {
  const L = gameLayout(el, meta, { nav });
  const reduced = prefersReducedMotion();
  const fx = ctx.fx;
  const sound = ctx.sound;

  const sLines = hudStat('Çizgi', '0/12', { ico: 'star', cls: 'gm-stat-score' });
  const sMarks = hudStat('İşaret', '1/25', { ico: 'check' });
  const sNear = hudStat('BINGO’ya', '—', { ico: 'target' });
  const sBest = hudStat('Rekor', bestText(meta), { ico: 'trophy' });
  L.hud.append(sLines.el, sMarks.el, sNear.el, sBest.el);

  let state = loadState();
  let card = null; // [{ id, cat, text }]
  let cells = []; // button
  let focusIdx = 0;
  let closeOverlay = null;
  let stream = !!ls.get(LS_STREAM, false);
  let ageTimer = 0;
  const cleanups = [];
  const freshLines = new Set(); // bu çizimde "çizilerek" gelecek çizgiler

  // ---------------------------------------------------------------- iskelet
  const codeText = h('span', { class: 'bg-code-val num' }, '------');
  const copyBtn = h('button', { class: 'btn ghost sm bg-code', type: 'button', title: 'Kart kodunu kopyala' },
    icon('copy', { size: 16 }), h('span', { class: 'bg-code-lbl' }, 'Kod'), codeText);
  const newBtn = h('button', { class: 'btn primary sm', type: 'button' }, icon('refresh', { size: 16 }), 'Yeni kart');
  const loadBtn = h('button', { class: 'btn ghost sm', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'bg-load-form' },
    icon('arrowRight', { size: 16 }), 'Kod ile yükle');
  const streamBtn = h('button', { class: 'btn ghost sm bg-stream-btn', type: 'button', 'aria-pressed': String(stream) },
    icon('eye', { size: 16 }), 'Yayın modu');
  const fsBtn = h('button', { class: 'btn ghost sm bg-fs-btn', type: 'button', hidden: true }, icon('cube', { size: 16 }), 'Tam ekran');

  const codeInput = h('input', {
    class: 'input bg-load-input num',
    id: 'bg-load-input',
    type: 'text',
    inputmode: 'text',
    autocomplete: 'off',
    autocapitalize: 'characters',
    spellcheck: 'false',
    maxlength: '9',
    placeholder: 'K7M2QX',
    'aria-describedby': 'bg-load-hint',
  });
  const loadHint = h('p', { class: 'xsmall dim bg-load-hint', id: 'bg-load-hint' }, '6 karakter: harf ve rakam (O, I, L, 0 ve 1 kullanılmaz).');
  const loadForm = h('form', { class: 'bg-load', id: 'bg-load-form', hidden: true, novalidate: true },
    h('label', { class: 'label', for: 'bg-load-input' }, 'Kart kodu'),
    h('div', { class: 'bg-load-row' },
      codeInput,
      h('button', { class: 'btn gold sm', type: 'submit' }, 'Yükle'),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => toggleLoad(false) }, 'Vazgeç'),
    ),
    loadHint,
  );

  const toolbar = h('div', { class: 'bg-toolbar', role: 'toolbar', 'aria-label': 'Kart işlemleri' },
    newBtn, copyBtn, loadBtn, streamBtn, fsBtn);

  const grid = h('div', { class: 'bg-grid', role: 'group', 'aria-label': 'Bingo kartı, 5’e 5' });
  const linesSvg = h('svg', { class: 'bg-lines', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  const letters = h('div', { class: 'bg-letters', 'aria-hidden': 'true' }, HEAD.map((l) => h('span', null, l)));
  const ticketCode = h('span', { class: 'bg-ticket-code num' });
  const ticketLines = h('span', { class: 'bg-ticket-lines badge gold num' });
  const ticket = h('section', { class: 'bg-ticket panel raised frame', 'aria-label': 'DOG Bingo kartı' },
    h('div', { class: 'bg-ticket-head' },
      h('span', { class: 'bg-ticket-brand' },
        h('span', { class: 'bg-ticket-dog' }, 'DOG'), h('span', { class: 'bg-ticket-bingo' }, 'BINGO')),
      h('span', { class: 'bg-ticket-meta' },
        h('span', { class: 'eyebrow bg-ticket-eyebrow' }, '24 saatlik yayın kartı'),
        ticketCode),
      ticketLines,
    ),
    letters,
    h('div', { class: 'bg-board' }, grid, linesSvg),
    h('ul', { class: 'bg-legend', 'aria-label': 'Kategoriler' },
      BINGO_CATS.map((c) => h('li', { style: { '--cc': c.color } }, icon(c.icon, { size: 14 }), c.label))),
  );

  // Karne
  const repNum = h('span', { class: 'gm-result-num num' }, '0');
  const repBadge = h('span', { class: 'badge' });
  const repQuip = h('p', { class: 'gm-result-quip bg-rep-quip' });
  const repMarked = h('dd', { class: 'num' }, '0/24');
  const repLeft = h('dd', { class: 'num' }, '24');
  const repAge = h('dd', { class: 'num' }, '—');
  const repMeter = h('span', { class: 'bg-meter-fill' });
  const report = h('section', { class: 'panel tight bg-report', 'aria-label': 'Kart karnesi' },
    h('div', { class: 'row bg-rep-top' }, h('span', { class: 'eyebrow' }, 'Kart karnesi'), repBadge),
    h('div', { class: 'gm-result-score' }, repNum, h('span', { class: 'gm-result-unit' }, 'çizgi')),
    h('div', { class: 'bg-meter', role: 'presentation' }, repMeter),
    h('dl', { class: 'gm-result-stats bg-rep-stats' },
      h('div', null, h('dt', null, 'İşaretli'), repMarked),
      h('div', null, h('dt', null, 'Kalan'), repLeft),
      h('div', null, h('dt', null, 'Kart yaşı'), repAge),
    ),
    repQuip,
  );

  // Maç günlüğü
  const logList = h('ol', { class: 'bg-log-list', 'aria-live': 'off' });
  const undoBtn = h('button', { class: 'btn ghost sm', type: 'button' }, icon('arrowLeft', { size: 16 }), 'Geri al');
  const wipeBtn = h('button', { class: 'btn ghost sm', type: 'button' }, icon('trash', { size: 16 }), 'Temizle');
  const log = h('section', { class: 'panel tight bg-log', 'aria-labelledby': 'bg-log-title' },
    h('div', { class: 'bg-log-head' },
      h('h3', { class: 'h3 row', id: 'bg-log-title' }, icon('clock', { size: 18 }), 'Maç günlüğü'),
      h('div', { class: 'row bg-log-actions' }, undoBtn, wipeBtn),
    ),
    logList,
  );

  const wrap = h('div', { class: 'bg-wrap' },
    h('div', { class: 'bg-top' }, toolbar, loadForm),
    h('div', { class: 'bg-main' }, ticket),
    h('div', { class: 'bg-side' }, report, log),
  );
  L.stage.append(wrap);

  // ---------------------------------------------------------------- çizim
  function lineState() {
    const marked = (i) => i === FREE || (state && state.marks[i] != null);
    return LINES.filter((l) => l.cells.every(marked));
  }

  function build(animate) {
    clear(grid);
    card = cardFromCode(state.code);
    cells = card.map((ev, i) => {
      const cat = catOf(ev.cat);
      const free = i === FREE;
      const btn = h('button', {
        class: `bg-cell${free ? ' free' : ''}`,
        type: 'button',
        tabindex: i === focusIdx ? '0' : '-1',
        dataset: { i: String(i), cat: ev.cat },
        style: { '--cc': cat.color, '--d': `${(Math.floor(i / N) + (i % N)) * 35}ms`, '--rot': `${((hashStr(state.code + i) % 25) - 12)}deg` },
        'aria-pressed': free ? 'true' : 'false',
        'aria-disabled': free ? 'true' : null,
      },
        free
          ? [
            h('span', { class: 'bg-free-star', 'aria-hidden': 'true' }, icon('paw', { size: 18, stroke: 2.2 })),
            h('span', { class: 'bg-free-text' }, h('span', null, 'DOG'), h('span', null, 'DOG'), h('span', null, 'DOG')),
          ]
          : [
            h('span', { class: 'bg-cell-cat', 'aria-hidden': 'true' }, icon(cat.icon, { size: 12, stroke: 2 })),
            h('span', { class: 'bg-cell-text' }, ev.text),
            h('span', { class: 'bg-cell-stamp', 'aria-hidden': 'true' }, icon('paw', { size: 22, stroke: 2.2 })),
            h('span', { class: 'bg-cell-time num', 'aria-hidden': 'true' }),
          ],
      );
      btn.addEventListener('click', () => toggle(i));
      btn.addEventListener('keydown', (e) => onCellKey(e, i));
      btn.addEventListener('focus', () => {
        // Tek sekme durağı: odak nerede ise Tab oraya döner
        if (cells[focusIdx] && focusIdx !== i) cells[focusIdx].tabIndex = -1;
        btn.tabIndex = 0;
        focusIdx = i;
      });
      grid.appendChild(btn);
      return btn;
    });
    if (animate && !reduced) {
      grid.classList.remove('dealt');
      void grid.offsetWidth;
      grid.classList.add('dealt');
    }
    paint();
  }

  function paint() {
    const done = lineState();
    const doneIds = new Set(done.map((l) => l.id));
    const inLine = new Set(done.flatMap((l) => l.cells));
    const markedN = Object.keys(state.marks).length;
    cells.forEach((btn, i) => {
      const free = i === FREE;
      const ts = state.marks[i];
      const on = free || ts != null;
      btn.classList.toggle('on', on);
      btn.classList.toggle('in-line', inLine.has(i));
      if (!free) {
        btn.setAttribute('aria-pressed', String(on));
        const t = btn.querySelector('.bg-cell-time');
        if (t) t.textContent = ts != null ? clock(ts) : '';
      }
      const r = Math.floor(i / N) + 1;
      const c = HEAD[i % N];
      const ev = card[i];
      btn.setAttribute('aria-label', free
        ? `${c} sütunu, ${r}. satır: DOG DOG DOG, bedava hücre, işaretli`
        : `${c} sütunu, ${r}. satır: ${ev.text} (${catOf(ev.cat).label})${on ? `, işaretli ${clock(ts)}` : ''}${inLine.has(i) ? ', tamamlanmış çizgide' : ''}`);
    });

    // Çizgi kaplaması
    clear(linesSvg);
    for (const l of LINES) {
      if (!doneIds.has(l.id)) continue;
      const a = l.cells[0];
      const b = l.cells[N - 1];
      const pos = (i) => [((i % N) + 0.5) * 20, (Math.floor(i / N) + 0.5) * 20];
      let [x1, y1] = pos(a);
      let [x2, y2] = pos(b);
      // Uçları biraz uzat
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      x1 -= (dx / len) * 6; y1 -= (dy / len) * 6;
      x2 += (dx / len) * 6; y2 += (dy / len) * 6;
      linesSvg.appendChild(h('line', {
        x1: x1.toFixed(2), y1: y1.toFixed(2), x2: x2.toFixed(2), y2: y2.toFixed(2),
        class: `bg-line${freshLines.has(l.id) ? ' fresh' : ''}`,
        'vector-effect': 'non-scaling-stroke',
        pathLength: '100',
      }));
    }
    freshLines.clear();

    // HUD
    const n = done.length;
    sLines.set(`${n}/12`);
    sMarks.set(`${markedN + 1}/25`);
    // Sıradaki (henüz tamamlanmamış) çizgiye kalan en az hücre
    const open = LINES.filter((l) => !doneIds.has(l.id));
    const need = open.length ? Math.min(...open.map((l) => l.cells.filter((i) => i !== FREE && state.marks[i] == null).length)) : 0;
    sNear.set(n === 12 ? 'Tam kart' : `${need} hücre`);
    sBest.set(bestText(meta));
    codeText.textContent = state.code;
    ticketCode.textContent = `Kart ${state.code}`;
    ticketLines.textContent = `${n} çizgi`;
    ticketLines.classList.toggle('zero', n === 0);

    // Karne
    repNum.textContent = String(n);
    repMarked.textContent = `${markedN}/24`;
    repLeft.textContent = markedN >= 24 ? 'Doldu' : String(24 - markedN);
    repMeter.style.width = `${(markedN / 24) * 100}%`;
    const best = (store.me.get().scores || {})[meta.id];
    if (n > 0 && typeof best === 'number' && n >= best) {
      repBadge.className = 'badge gold';
      repBadge.replaceChildren(icon('crown', { size: 12 }), 'Rekorun');
    } else {
      repBadge.className = 'badge';
      repBadge.replaceChildren('Rekor: ', typeof best === 'number' ? meta.format(best) : 'henüz yok');
    }
    const q = BINGO_QUIPS.find((x) => n >= x.min) || BINGO_QUIPS[BINGO_QUIPS.length - 1];
    repQuip.textContent = q.text;
    paintAge();

    // Günlük
    paintLog(done);
    undoBtn.disabled = state.order.length === 0;
    wipeBtn.disabled = markedN === 0;
  }
  function paintAge() {
    repAge.textContent = state ? ageText(Date.now() - state.created) : '—';
  }

  function paintLog(done) {
    const items = [];
    for (const i of state.order) {
      const ts = state.marks[i];
      if (ts == null) continue;
      items.push({ kind: 'mark', ts, i });
    }
    for (const l of done) {
      const ts = Math.max(...l.cells.map((i) => (i === FREE ? state.created : state.marks[i] || 0)));
      items.push({ kind: 'line', ts, l });
    }
    // En yeni üstte; aynı anda tamamlanan çizgi, onu tamamlayan işaretin üstünde
    items.sort((a, b) => (b.ts - a.ts) || (a.kind === 'line' ? -1 : 1) - (b.kind === 'line' ? -1 : 1));
    const rows = items.map((it) => {
      if (it.kind === 'line') {
        return h('li', { class: 'bg-log-item line' },
          h('span', { class: 'bg-log-time num' }, clock(it.ts)),
          h('span', { class: 'bg-log-ico', 'aria-hidden': 'true' }, icon('star', { size: 14, stroke: 2.2 })),
          h('span', { class: 'bg-log-text' }, h('b', null, 'BINGO! '), it.l.name));
      }
      const ev = card[it.i];
      const cat = catOf(ev.cat);
      return h('li', { class: 'bg-log-item', style: { '--cc': cat.color } },
        h('span', { class: 'bg-log-time num' }, clock(it.ts)),
        h('span', { class: 'bg-log-ico', 'aria-hidden': 'true', title: cat.label }, icon(cat.icon, { size: 14 })),
        h('span', { class: 'bg-log-text' }, ev.text));
    });
    rows.push(h('li', { class: 'bg-log-item start' },
      h('span', { class: 'bg-log-time num' }, clock(state.created)),
      h('span', { class: 'bg-log-ico', 'aria-hidden': 'true' }, icon('paw', { size: 14 })),
      h('span', { class: 'bg-log-text' }, `Kart ${state.code} açıldı · DOG DOG DOG bedava`)));
    logList.replaceChildren(...rows);
  }

  function save() {
    ls.set(LS_KEY, { v: 1, code: state.code, created: state.created, marks: state.marks, order: state.order, peak: state.peak });
  }

  // ---------------------------------------------------------------- işaretleme
  function toggle(i) {
    if (!state || i === FREE) {
      if (i === FREE) {
        const r = cells[i].getBoundingClientRect();
        fx.floatText('DOG!', r.left + r.width / 2, r.top + r.height / 3, { color: '#e9b949', size: 20 });
        sound.bark(1, 0);
      }
      return;
    }
    const before = new Set(lineState().map((l) => l.id));
    if (state.marks[i] != null) {
      delete state.marks[i];
      state.order = state.order.filter((x) => x !== i);
      sound.click();
      L.live.textContent = `İşaret kaldırıldı: ${card[i].text}.`;
    } else {
      state.marks[i] = Date.now();
      state.order.push(i);
      sound.stamp();
      const btn = cells[i];
      btn.classList.remove('pop');
      void btn.offsetWidth;
      btn.classList.add('pop');
      L.live.textContent = `İşaretlendi ${clock(state.marks[i])}: ${card[i].text}.`;
    }
    const after = lineState();
    const fresh = after.filter((l) => !before.has(l.id));
    fresh.forEach((l) => freshLines.add(l.id));
    if (after.length > state.peak) state.peak = after.length;
    save();
    paint();
    if (fresh.length) celebrate(i, fresh, after.length);
  }

  function celebrate(i, fresh, total) {
    const r = cells[i].getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const saved = submitResult(meta, total);
    if (total >= 12) {
      fx.stamp('TAM KART!', { variant: 'gold', ms: 1600 });
      fx.confetti(x, y, 140);
      setTimeout(() => fx.confetti(innerWidth / 2, innerHeight / 3, 120), 350);
    } else {
      fx.stamp(fresh.length >= 2 ? 'ÇİFTE BINGO!' : 'BINGO!', { variant: 'gold' });
      fx.confetti(x, y, 80);
    }
    sound.win();
    sLines.bump();
    const names = fresh.map((l) => l.name).join(', ');
    L.live.textContent = `BINGO! ${names} tamamlandı. Kartta ${total} çizgi.${saved.record ? ' Yeni rekor.' : ''}`;
    if (saved.record && saved.prev != null) fx.toast(`Yeni rekor: ${meta.format(total)}`, 'jade');
  }

  function onCellKey(e, i) {
    const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -N, ArrowDown: N };
    let j = null;
    if (e.key in map) {
      const r = Math.floor(i / N);
      const c = i % N;
      if (e.key === 'ArrowLeft') j = r * N + ((c + N - 1) % N);
      else if (e.key === 'ArrowRight') j = r * N + ((c + 1) % N);
      else if (e.key === 'ArrowUp') j = ((r + N - 1) % N) * N + c;
      else j = ((r + 1) % N) * N + c;
    } else if (e.key === 'Home') j = Math.floor(i / N) * N;
    else if (e.key === 'End') j = Math.floor(i / N) * N + N - 1;
    if (j == null) return;
    e.preventDefault();
    cells[i].tabIndex = -1;
    cells[j].tabIndex = 0;
    focusIdx = j;
    cells[j].focus();
  }

  // ---------------------------------------------------------------- kart işlemleri
  async function askReset(message, ok) {
    if (!state || Object.keys(state.marks).length === 0) return true;
    return fx.confirm(message, { ok, cancel: 'Vazgeç', danger: true });
  }

  function useCode(code, { fresh = true } = {}) {
    state = { code, created: Date.now(), marks: {}, order: [], peak: 0 };
    focusIdx = 0;
    save();
    build(fresh);
  }

  async function newCard() {
    sound.click();
    if (!await askReset('Yeni kart açılsın mı? Bu karttaki işaretler silinir.', 'Yeni kart')) return;
    useCode(randomCode(state && state.code));
    sound.whoosh();
    L.live.textContent = `Yeni kart: ${state.code}.`;
  }

  async function copyCode() {
    sound.click();
    const ok = await copyText(state.code, codeText);
    fx.toast(ok ? `Kart kodu kopyalandı: ${state.code}` : 'Kopyalanamadı; kod seçildi, elle kopyalayabilirsin.', ok ? 'jade' : undefined);
  }

  function toggleLoad(open) {
    loadForm.hidden = !open;
    loadBtn.setAttribute('aria-expanded', String(open));
    loadHint.classList.remove('err');
    loadHint.textContent = '6 karakter: harf ve rakam (O, I, L, 0 ve 1 kullanılmaz).';
    if (open) {
      codeInput.value = '';
      try { codeInput.focus({ preventScroll: true }); } catch { codeInput.focus(); }
    } else {
      loadBtn.focus();
    }
  }

  async function submitLoad(e) {
    e.preventDefault();
    const code = normCode(codeInput.value);
    if (!validCode(code)) {
      loadHint.classList.add('err');
      loadHint.textContent = code.length !== CODE_LEN
        ? `Kod ${CODE_LEN} karakter olmalı (şu an ${code.length}).`
        : 'Kodda geçersiz karakter var (O, I, L, 0 ve 1 kullanılmaz).';
      sound.bad();
      fx.shake(codeInput);
      return;
    }
    if (state && code === state.code) {
      fx.toast('Zaten bu karttasın.');
      toggleLoad(false);
      return;
    }
    if (!await askReset(`${code} kartı yüklensin mi? Bu karttaki işaretler silinir.`, 'Yükle')) return;
    toggleLoad(false);
    useCode(code);
    sound.whoosh();
    fx.toast(`Kart yüklendi: ${code}`, 'jade');
    L.live.textContent = `Kart yüklendi: ${code}.`;
  }

  function undo() {
    const i = state.order[state.order.length - 1];
    if (i == null) return;
    toggle(i);
    try { cells[i].focus({ preventScroll: true }); } catch { /* yok say */ }
  }

  async function wipe() {
    sound.click();
    if (!await askReset('Bu karttaki tüm işaretler silinsin mi? Kart aynı kalır.', 'Temizle')) return;
    state.marks = {};
    state.order = [];
    state.created = Date.now();
    save();
    paint();
    L.live.textContent = 'İşaretler silindi.';
  }

  // ---------------------------------------------------------------- yayın modu
  const fsSupported = (() => { try { return !!document.fullscreenEnabled; } catch { return false; } })();
  function setStream(on, user) {
    stream = on;
    L.root.classList.toggle('bg-stream', on);
    streamBtn.setAttribute('aria-pressed', String(on));
    fsBtn.hidden = !(on && fsSupported);
    if (user) {
      ls.set(LS_STREAM, on);
      sound.click();
      L.live.textContent = on ? 'Yayın modu açık: kart büyütüldü.' : 'Yayın modu kapalı.';
      if (!on && document.fullscreenElement) {
        try { document.exitFullscreen(); } catch { /* yok say */ }
      }
      requestAnimationFrame(() => {
        const r = ticket.getBoundingClientRect();
        if (r.top < 60 || r.top > innerHeight * 0.6) {
          try { ticket.scrollIntoView({ block: 'start', behavior: reduced ? 'instant' : 'smooth' }); } catch { /* yok say */ }
        }
      });
    }
  }
  async function fullscreen() {
    sound.click();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await ticket.requestFullscreen();
    } catch {
      fx.toast('Tarayıcı tam ekrana izin vermedi.');
    }
  }
  const onFs = () => { ticket.classList.toggle('is-fs', document.fullscreenElement === ticket); };
  document.addEventListener('fullscreenchange', onFs);
  cleanups.push(() => document.removeEventListener('fullscreenchange', onFs));

  // ---------------------------------------------------------------- bağlantılar
  newBtn.addEventListener('click', newCard);
  copyBtn.addEventListener('click', copyCode);
  loadBtn.addEventListener('click', () => { sound.click(); toggleLoad(loadForm.hidden); });
  loadForm.addEventListener('submit', submitLoad);
  codeInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); toggleLoad(false); } });
  codeInput.addEventListener('input', () => {
    const v = codeInput.value;
    const up = v.toUpperCase();
    if (v !== up) {
      const p = codeInput.selectionStart;
      codeInput.value = up;
      try { codeInput.setSelectionRange(p, p); } catch { /* yok say */ }
    }
  });
  streamBtn.addEventListener('click', () => setStream(!stream, true));
  fsBtn.addEventListener('click', fullscreen);
  undoBtn.addEventListener('click', () => { sound.click(); undo(); });
  wipeBtn.addEventListener('click', wipe);
  cleanups.push(store.me.subscribe(() => { if (state) paint(); }));

  // Yayın modunda Esc kapatır (bir yazı alanında ya da modal açıkken değil)
  const onKey = (e) => {
    if (e.key !== 'Escape' || !stream || isTyping(e) || document.querySelector('.modal-backdrop') || document.fullscreenElement) return;
    setStream(false, true);
  };
  window.addEventListener('keydown', onKey);
  cleanups.push(() => window.removeEventListener('keydown', onKey));

  // Başka sekmede işaretlenirse (aynı kart iki sekmede) buraya da yansısın
  const onStorage = (e) => {
    if (e.key !== 'csk:' + LS_KEY) return;
    const s = loadState();
    if (!s) return;
    const changedCard = !state || s.code !== state.code;
    state = s;
    if (changedCard) build(false);
    else paint();
  };
  window.addEventListener('storage', onStorage);
  cleanups.push(() => window.removeEventListener('storage', onStorage));

  ageTimer = setInterval(() => { if (state && !document.hidden) paintAge(); }, 30000);

  // ---------------------------------------------------------------- başlangıç
  setStream(stream, false);
  if (state) {
    build(false);
  } else {
    // İlk ziyaret: önizleme kartı + başlangıç kartı
    const code = randomCode();
    state = { code, created: Date.now(), marks: {}, order: [], peak: 0 };
    build(false);
    wrap.classList.add('preview');
    wrap.inert = true;
    closeOverlay = showOverlay(L.stage, introCard(meta, {
      startLabel: 'Kartımı ver',
      note: 'Kartın ve işaretlerin bu tarayıcıda saklanır. Yayın uzun; acele yok.',
      onStart: () => {
        if (closeOverlay) { closeOverlay(); closeOverlay = null; }
        wrap.classList.remove('preview');
        wrap.inert = false;
        useCode(code);
        sound.whoosh();
        try { cells[0].focus({ preventScroll: true }); } catch { /* yok say */ }
      },
    }), { cls: 'bg-intro-ov' });
    // Uzun sahnede (kart + karne + günlük) başlangıç kartı üstte durur; salonun başa kaydırmasından
    // sonra "Kartımı ver" düğmesi alt çubuğun arkasında kalmasın
    const t = setTimeout(() => {
      const c = L.root.querySelector('.bg-intro-ov .gm-overlay-card');
      if (c) revealInView(c);
    }, 160);
    cleanups.push(() => clearTimeout(t));
  }

  return () => {
    clearInterval(ageTimer);
    for (const fn of cleanups.splice(0)) { try { fn(); } catch (e) { console.error(e); } }
    if (document.fullscreenElement === ticket) { try { document.exitFullscreen(); } catch { /* yok say */ } }
    if (closeOverlay) closeOverlay();
    L.destroy();
  };
}
