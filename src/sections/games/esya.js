// Eşya 2048 — 4×4 birleştirme bulmacası; sayılar yerine Dota eşyaları.
// Aynı iki eşya çarpışınca zincirde bir üst eşyaya dönüşür: Iron Branch → Tango → … → Divine Rapier (2048)
// → Aegis. Zincir oyun içi bir fantezidir (kabaca altın değerine göre sıralı), gerçek tarifler değildir.
// Puan = birleşen eşyaların değeri (klasik 2048 gibi). Tahta her hamlede tarayıcıya kaydedilir
// (csk:esya:game); sayfa yenilenince kaldığın yerden sürer. Oyun başına 1 “Geri al”.
// Belge: docs/oyunlar/esya.md

import './esya.css';
import { h, fmtNum, ls, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { store } from '../../core/store.js';
import { itemIconUrl } from '../../core/assets.js';
import { createRunner, gameLayout, hudStat, showOverlay, introCard, resultCard, submitResult, revealInView, isTyping, tok } from './kit.js';

// ------------------------------------------------------------------ sabitler
const N = 4;
const WIN_TIER = 11; // Divine Rapier = 2048
const AEGIS_TIER = 12;
const SAVE_KEY = 'esya:game';
const SAVE_V = 1;
const SLIDE_MS = 120; // CSS ile aynı (--es-slide)
const SWIPE_MIN = 26; // px
const IDLE_CAP = 30; // sn: bu kadar hamlesiz geçen süre oyun süresine sayılmaz
const TANGO_P = 0.1; // yeni eşyanın Tango (2. kademe) olma olasılığı
const GRACE_MS = 1000;

/** Eşya zinciri. t: kademe (değer 2^t), key: ikon dosyası (src/assets/items/<key>.webp). */
export const ITEMS = [
  null,
  { key: 'branches', name: 'Iron Branch', short: 'Branch', color: '#a67c52', line: 'Her şey bir dalla başlar.' },
  { key: 'tango', name: 'Tango', short: 'Tango', color: '#4fb85a', line: 'Koridorda ağaç kalmadı.' },
  { key: 'magic_stick', name: 'Magic Stick', short: 'Stick', color: '#37c3b2', line: 'Şarjlar birikiyor.' },
  { key: 'magic_wand', name: 'Magic Wand', short: 'Wand', color: '#a07cff', line: 'Can da mana da cepte.' },
  { key: 'boots', name: 'Boots of Speed', short: 'Boots', color: '#d98b4a', line: 'Artık yürümüyorsun, koşuyorsun.' },
  { key: 'blink', name: 'Blink Dagger', short: 'Blink', color: '#7fe3ff', line: 'Işınlan, dal, çık.' },
  { key: 'black_king_bar', name: 'Black King Bar', short: 'BKB', color: '#e9b949', line: 'Büyü işlemez. DOG işler mi, bilinmez.' },
  { key: 'ultimate_scepter', name: 'Aghanim’s Scepter', short: 'Aghanim', color: '#4f6bff', line: 'Ultimate’ın yükseldi.' },
  { key: 'radiance', name: 'Radiance', short: 'Radiance', color: '#ff7a2b', line: 'Orman yanıyor, farm akıyor.' },
  { key: 'butterfly', name: 'Butterfly', short: 'Butterfly', color: '#b7f25a', line: 'Kaçınma yüksek, özgüven daha yüksek.' },
  { key: 'rapier', name: 'Divine Rapier', short: 'Rapier', color: '#ff3b5c', line: 'Sakın ölme: düşerse DOG DOG DOG.' },
  { key: 'aegis', name: 'Aegis of the Immortal', short: 'Aegis', color: '#f6d98a', line: 'Ölümsüzlük tek seferlik, puan kalıcı.' },
  { key: 'cheese', name: 'Cheese', short: 'Cheese', color: '#ffe27a', line: 'Roshan ikinci kez düştü. Efsane.' },
];
const MAX_TIER = ITEMS.length - 1;
const CHAIN_TIERS = AEGIS_TIER; // zincir şeridinde gösterilen kademe sayısı (Cheese gizli sürpriz)
const itemOf = (t) => ITEMS[Math.max(1, Math.min(t, MAX_TIER))];
const valueOf = (t) => 2 ** t;
const shortVal = (v) => (v >= 10000 ? `${Math.round(v / 1000)}B` : String(v));

export const meta = {
  id: 'esya',
  name: 'Eşya 2048',
  short: '2048',
  icon: 'rapier',
  color: 'var(--aegis)',
  kind: 'Zihin · Birleştir',
  cat: 'zihin',
  blurb: 'Dalları birleştir, Rapier’e ulaş. Kaydır, birleştir, sakın envanteri doldurma.',
  lore: 'İki Branch bir Stick eder mi? Burada eder. Dota’da denersen DOG DOG DOG.',
  time: '~5 dk',
  diff: 2,
  unit: 'puan',
  higherIsBetter: true,
  format: (n) => `${fmtNum(n)} puan`,
  rules: [
    'Kaydır: tüm eşyalar o yöne kayar. Aynı iki eşya çarpışınca zincirde bir üst eşyaya dönüşür.',
    'Zincir: Branch → Tango → Stick → Wand → Boots → Blink → BKB → Aghanim → Radiance → Butterfly → Divine Rapier → Aegis.',
    'Bu zincir tamamen oyunluk bir fantezi, gerçek tarifler değil: Dota’da iki Branch’ten Magic Stick çıkmaz (keşke çıksa).',
    'Puan = birleşen eşyanın değeri (Branch 2, Tango 4 … Rapier 2048). Her hamlede yeni bir Branch (bazen Tango) düşer.',
    'Divine Rapier’e ulaşınca kazanırsın; istersen Aegis için devam et. Hamle kalmayınca oyun biter. Oyun başına 1 “Geri al”.',
  ],
  keys: [['← ↑ → ↓', 'Kaydır'], ['W A S D', 'Kaydır'], ['U', 'Geri al (oyun başına 1)'], ['Kaydır / sürükle', 'Dokunmatik ve fare: tahtada parmağını kaydır']],
};

// Başlangıç kartı için kısa kurallar (390 px ekranda Başla düğmesi alt çubuğun üstünde kalsın)
const INTRO_RULES = [
  'Kaydır: bütün eşyalar o yöne kayar. Aynı iki eşya çarpışınca zincirde bir üst eşyaya dönüşür.',
  'Zincir oyunluk bir fantezi, gerçek tarif değil: Dota’da iki Branch’ten Magic Stick çıkmaz (keşke çıksa).',
  'Puan = birleşen eşyanın değeri (Branch 2 … Rapier 2048). Rapier’e ulaş, istersen Aegis için devam et. Oyun başına 1 “Geri al”.',
];

// ------------------------------------------------------------------ saf oyun mantığı
let seq = 0;
const newTile = (t, extra) => ({ id: ++seq, t, ...extra });

/** 4 yön için satır/sütun gezinme sırası: her çizgi öndeki kenardan geriye doğru hücre indeksleri. */
function lines(dir) {
  const out = [];
  for (let a = 0; a < N; a++) {
    const idx = [];
    for (let k = 0; k < N; k++) {
      let x, y;
      if (dir === 'left') { x = k; y = a; } else if (dir === 'right') { x = N - 1 - k; y = a; } else if (dir === 'up') { x = a; y = k; } else { x = a; y = N - 1 - k; }
      idx.push(y * N + x);
    }
    out.push(idx);
  }
  return out;
}
const LINES = { left: lines('left'), right: lines('right'), up: lines('up'), down: lines('down') };

/** Hamle: { cells, moved, gained, merged: [tile] } — cells yeni dizi, eski nesneler korunur. */
export function slide(cells, dir) {
  const next = new Array(N * N).fill(null);
  let gained = 0;
  const merged = [];
  for (const idx of LINES[dir]) {
    const row = idx.map((i) => cells[i]).filter(Boolean);
    const out = [];
    for (let i = 0; i < row.length; i++) {
      const a = row[i];
      const b = row[i + 1];
      if (b && a.t === b.t) {
        const m = newTile(a.t + 1, { from: [a.id, b.id] });
        out.push(m);
        merged.push(m);
        gained += valueOf(m.t);
        i++;
      } else {
        out.push(a);
      }
    }
    out.forEach((tile, k) => { next[idx[k]] = tile; });
  }
  const moved = next.some((tile, i) => tile !== cells[i]);
  return { cells: next, moved, gained, merged };
}

export function canMove(cells) {
  for (let i = 0; i < N * N; i++) {
    const c = cells[i];
    if (!c) return true;
    const x = i % N;
    if (x < N - 1 && cells[i + 1] && cells[i + 1].t === c.t) return true;
    if (i + N < N * N && cells[i + N] && cells[i + N].t === c.t) return true;
  }
  return false;
}

function spawn(cells, rnd = Math.random) {
  const empty = [];
  cells.forEach((c, i) => { if (!c) empty.push(i); });
  if (!empty.length) return null;
  const i = empty[Math.floor(rnd() * empty.length)];
  const tile = newTile(rnd() < TANGO_P ? 2 : 1, { spawn: true });
  cells[i] = tile;
  return tile;
}

const tiersOf = (cells) => cells.map((c) => (c ? c.t : 0));
const cellsOf = (tiers) => tiers.map((t) => (t > 0 ? newTile(t) : null));
const maxTier = (cells) => cells.reduce((m, c) => (c && c.t > m ? c.t : m), 0);

function validTiers(a) {
  return Array.isArray(a) && a.length === N * N && a.every((t) => Number.isInteger(t) && t >= 0 && t <= 20);
}

// ------------------------------------------------------------------ görünüm yardımcıları
function itemImg(t, cls = '') {
  const it = itemOf(t);
  const url = itemIconUrl(it.key);
  return url
    ? h('img', { class: `gm-es-img ${cls}`, src: url, alt: '', draggable: 'false', decoding: 'async' })
    : h('span', { class: `gm-es-img gm-es-fb ${cls}`, 'aria-hidden': 'true' }, it.short.slice(0, 2));
}

function quipFor(best, score) {
  if (best >= 13) return 'Cheese! Roshan’ı iki kez kestin. Bu envanter 1vDOQUZ’a hazır.';
  if (best >= AEGIS_TIER) return 'Aegis cebinde. Ölümsüzsün… en azından bir kez.';
  if (best >= WIN_TIER) return 'Divine Rapier! Şimdi tek kural var: ölme. Düşürürsen DOG DOG DOG.';
  if (best >= 10) return 'Butterfly’a kadar geldin. Rapier bir birleştirme uzağında gibi… ama değil.';
  if (best >= 8) return 'Aghanim ve Radiance: geç oyun eşyaları. Envanter yönetimi sağlam.';
  if (best >= 7) return 'BKB bastın. Şimdi büyüler işlemez, ama köşe stratejisi işler.';
  if (best >= 5) return 'Boots ve Blink’le koşuyorsun. Büyük eşyayı köşede tut, gerisi akar.';
  if (score > 0) return 'DOG DOG DOG… Envanter Branch’le doldu. Bir köşe seç ve orayı bırakma.';
  return 'Kaydırmaya başla: iki aynı eşya birleşir.';
}

// ------------------------------------------------------------------ oyun
export function mount(el, ctx, nav) {
  const L = gameLayout(el, meta, { nav });
  const reduced = prefersReducedMotion();
  const slideMs = reduced ? 0 : SLIDE_MS;

  // ---------------------------------------------------------------- HUD
  const sScore = hudStat('Puan', '0', { ico: 'coin', cls: 'gm-stat-score' });
  const sBest = hudStat('Rekor', '—', { ico: 'crown' });
  const sItem = hudStat('En iyi eşya', 'Branch', { ico: 'rapier', cls: 'gm-es-hud-item' });
  const hudIco = h('span', { class: 'gm-es-hud-ico', 'aria-hidden': 'true' });
  sItem.el.querySelector('.gm-stat-val').before(hudIco);
  const sMoves = hudStat('Hamle', '0', { ico: 'refresh' });
  L.hud.append(sScore.el, sBest.el, sItem.el, sMoves.el);

  // ---------------------------------------------------------------- sahne
  const bg = h('div', { class: 'gm-es-grid', 'aria-hidden': 'true' }, Array.from({ length: N * N }, () => h('span', { class: 'gm-es-cell' })));
  const layer = h('div', { class: 'gm-es-layer', 'aria-hidden': 'true' });
  const board = h('div', {
    class: 'gm-es-board',
    role: 'application',
    'aria-label': 'Eşya 2048 tahtası: ok tuşları ya da WASD ile kaydır',
    tabindex: '0',
    style: { '--es-slide': `${slideMs}ms` },
  }, bg, layer);

  const msg = h('p', { class: 'gm-es-msg', 'aria-hidden': 'true' }, 'Kaydır: aynı iki eşya birleşir.');
  const undoCount = h('span', { class: 'gm-es-undo-n num' }, '1');
  const undoBtn = h('button', { class: 'btn ghost sm gm-es-undo', type: 'button', title: 'Son hamleyi geri al (U). Oyun başına 1 kez.' },
    icon('undo', { size: 16 }), 'Geri al', undoCount);
  const endBtn = h('button', { class: 'btn ghost sm gm-es-end', type: 'button', title: 'Oyunu şimdi bitir ve puanını kaydet' },
    icon('flag', { size: 16 }), 'Bitir');
  const tools = h('div', { class: 'gm-es-tools' }, undoBtn, endBtn);

  const chainEls = [];
  const chain = h('ol', { class: 'gm-es-chain', 'aria-label': 'Eşya zinciri' },
    ITEMS.slice(1, CHAIN_TIERS + 1).map((it, i) => {
      const t = i + 1;
      const li = h('li', { class: 'gm-es-link', style: { '--tc': it.color }, title: `${it.name} · ${valueOf(t)}` },
        h('span', { class: 'gm-es-link-ico' }, itemImg(t)),
        h('span', { class: 'gm-es-link-name' }, it.short),
        h('span', { class: 'gm-es-link-val num' }, shortVal(valueOf(t))),
      );
      chainEls.push(li);
      return li;
    }),
  );
  const side = h('div', { class: 'gm-es-side' },
    h('div', { class: 'gm-es-side-head' },
      h('span', { class: 'eyebrow' }, 'Zincir'),
      h('span', { class: 'xsmall dim' }, 'Gerçek tarif değil'),
    ),
    chain,
  );
  const field = h('div', { class: 'gm-es-field', dataset: { state: 'intro' } },
    h('div', { class: 'gm-es-main' }, board, h('div', { class: 'gm-es-bar' }, tools, msg)),
    side,
  );
  L.stage.appendChild(field);

  // ---------------------------------------------------------------- durum
  let state = 'intro'; // intro | play | won | over | dead
  let g = null;
  let closeOverlay = null;
  let runner = null;
  let hotkeysOff = false;
  let graceTimer = 0;
  let lastInput = 0;
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const tileEls = new Map();
  let gone = [];
  let goneTimer = 0;

  function say(m) { L.live.textContent = m; }
  function setMsg(text, tone = '') { msg.textContent = text; msg.dataset.tone = tone; }
  function restart(elm, cls) { elm.classList.remove(cls); void elm.offsetWidth; elm.classList.add(cls); }
  function bestScore() { const v = (store.me.get().scores || {}).esya; return typeof v === 'number' ? v : null; }

  function fresh() {
    const cells = new Array(N * N).fill(null);
    spawn(cells);
    spawn(cells);
    return { cells, score: 0, moves: 0, merges: 0, best: maxTier(cells), undo: 1, prev: null, won: false, cont: false, time: 0, big: 0, done: false };
  }

  function load() {
    const d = ls.get(SAVE_KEY, null);
    if (!d || d.v !== SAVE_V || !validTiers(d.cells) || d.done) return null;
    const cells = cellsOf(d.cells);
    if (!cells.some(Boolean)) return null;
    const prev = d.prev && validTiers(d.prev.cells) ? { ...d.prev } : null;
    return {
      cells,
      score: Math.max(0, Number(d.score) || 0),
      moves: Math.max(0, Number(d.moves) || 0),
      merges: Math.max(0, Number(d.merges) || 0),
      best: Math.max(maxTier(cells), Number(d.best) || 0),
      undo: d.undo ? 1 : 0,
      prev,
      won: !!d.won,
      cont: !!d.cont,
      time: Math.max(0, Number(d.time) || 0),
      big: Math.max(0, Number(d.big) || 0),
      done: false,
    };
  }

  function save() {
    if (!g) return;
    if (g.done) { ls.remove(SAVE_KEY); return; }
    ls.set(SAVE_KEY, {
      v: SAVE_V,
      cells: tiersOf(g.cells),
      score: g.score,
      moves: g.moves,
      merges: g.merges,
      best: g.best,
      undo: g.undo,
      prev: g.prev,
      won: g.won,
      cont: g.cont,
      time: Math.round(g.time),
      big: g.big,
      at: Date.now(),
    });
  }

  function snapshot() {
    return { cells: tiersOf(g.cells), score: g.score, moves: g.moves, merges: g.merges, best: g.best, big: g.big, won: g.won, cont: g.cont };
  }

  // ---------------------------------------------------------------- çizim
  function makeTile(tile) {
    const it = itemOf(tile.t);
    const el = h('div', { class: 'gm-es-tile', dataset: { t: String(Math.min(tile.t, MAX_TIER)) }, style: { '--tc': it.color } },
      h('span', { class: 'gm-es-tile-in' },
        itemImg(tile.t),
        h('span', { class: 'gm-es-name' }, it.short),
        h('span', { class: 'gm-es-val num' }, shortVal(valueOf(tile.t))),
      ),
    );
    return el;
  }

  function flushGone() {
    if (goneTimer) { clearTimeout(goneTimer); goneTimer = 0; }
    for (const e of gone) e.remove();
    gone = [];
  }

  /** anim: kayma/birleşme/düşme animasyonu (hamleden sonra). false: tahtayı baştan kur (yükleme, geri al). */
  function render(anim) {
    flushGone();
    if (!anim) {
      for (const e of tileEls.values()) e.remove();
      tileEls.clear();
    }
    const live = new Set();
    g.cells.forEach((tile, i) => {
      if (!tile) return;
      live.add(tile.id);
      const x = i % N;
      const y = (i / N) | 0;
      let e = tileEls.get(tile.id);
      if (!e) {
        e = makeTile(tile);
        tileEls.set(tile.id, e);
        if (anim && tile.from) {
          e.classList.add('is-merged');
          if (tile.t >= 7) e.classList.add('is-big');
          for (const sid of tile.from) {
            const s = tileEls.get(sid);
            if (!s) continue;
            tileEls.delete(sid);
            s.classList.add('is-gone');
            s.style.setProperty('--x', x);
            s.style.setProperty('--y', y);
            gone.push(s);
          }
        } else if (anim && tile.spawn) {
          e.classList.add('is-new');
        }
        e.style.setProperty('--x', x);
        e.style.setProperty('--y', y);
        layer.appendChild(e);
      } else {
        e.style.setProperty('--x', x);
        e.style.setProperty('--y', y);
      }
      delete tile.from;
      delete tile.spawn;
    });
    for (const [id, e] of tileEls) {
      if (!live.has(id)) { e.remove(); tileEls.delete(id); }
    }
    if (gone.length) goneTimer = setTimeout(flushGone, slideMs + 30);
    board.setAttribute('aria-label', `Eşya 2048 tahtası. En iyi eşya: ${itemOf(g.best).name}. Puan ${g.score}.`);
  }

  function renderHud() {
    sScore.set(fmtNum(g.score));
    const b = bestScore();
    sBest.set(b == null ? '—' : fmtNum(Math.max(b, g.score)));
    const it = itemOf(g.best);
    sItem.set(it.short);
    hudIco.replaceChildren(itemImg(g.best));
    sItem.el.style.setProperty('--tc', it.color);
    sMoves.set(fmtNum(g.moves));
    undoCount.textContent = String(g.undo);
    undoBtn.disabled = !(g.undo > 0 && g.prev) || state !== 'play';
    endBtn.disabled = state !== 'play' || g.moves === 0;
    chainEls.forEach((li, i) => {
      const t = i + 1;
      li.classList.toggle('is-got', t <= g.best);
      li.classList.toggle('is-best', t === Math.min(g.best, CHAIN_TIERS));
      li.classList.toggle('is-next', t === g.best + 1);
    });
  }

  // ---------------------------------------------------------------- hamle
  function move(dir) {
    if (state !== 'play') return;
    lastInput = performance.now();
    const before = snapshot();
    const res = slide(g.cells, dir);
    if (!res.moved) {
      if (!reduced) restart(board, `nudge-${dir}`);
      return;
    }
    g.prev = before;
    g.cells = res.cells;
    g.moves++;
    g.score += res.gained;
    g.merges += res.merged.length;
    let top = 0;
    for (const m of res.merged) { top = Math.max(top, m.t); g.big = Math.max(g.big, valueOf(m.t)); }
    spawn(g.cells);
    const prevBest = g.best;
    g.best = Math.max(g.best, maxTier(g.cells));
    render(true);
    renderHud();

    if (res.gained) {
      sScore.bump();
      if (res.gained >= 16) {
        const r = sScore.el.getBoundingClientRect();
        ctx.fx.floatText(`+${fmtNum(res.gained)}`, r.left + r.width / 2, r.bottom, { color: tok('--aegis'), size: res.gained >= 512 ? 22 : 16 });
      }
    }
    if (g.best > prevBest && g.best >= 3) {
      newBest(g.best, res.merged.find((m) => m.t === g.best));
    } else if (top) {
      ctx.sound.charge(Math.min(1, top / 11));
      setMsg(`${itemOf(top).name} birleşti: +${fmtNum(res.gained)}`, '');
    } else {
      setMsg('Kaydır: aynı iki eşya birleşir.', 'dim');
    }
    save();

    if (g.best >= WIN_TIER && !g.won) {
      g.won = true;
      save();
      state = 'won';
      later(() => { if (state === 'won') showWin(); }, slideMs + 380);
      return;
    }
    if (!canMove(g.cells) && g.undo > 0 && g.prev) {
      // Son şans: geri al hakkı varken oyun hemen bitmez
      setMsg('Hamle kalmadı! Son hamleyi geri al (U) ya da Bitir’e bas.', 'bad');
      say('Hamle kalmadı. Geri al ya da bitir.');
      if (!reduced) restart(undoBtn, 'gm-es-pulse');
      return;
    }
    if (!canMove(g.cells)) {
      state = 'over';
      field.dataset.state = 'over';
      setMsg('Hamle kalmadı: envanter doldu.', 'bad');
      say('Hamle kalmadı. Oyun bitti.');
      later(() => { if (state === 'over') finish('full'); }, slideMs + 520);
    }
  }

  function tilePoint(t) {
    const i = g.cells.findIndex((c) => c && c.t === t);
    const e = i >= 0 ? tileEls.get(g.cells[i].id) : null;
    const r = (e || board).getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height * 0.2];
  }

  function newBest(t, m) {
    const it = itemOf(t);
    setMsg(`Yeni eşya: ${it.name}! ${it.line}`, 'good');
    say(`Yeni eşya: ${it.name}.`);
    if (t === AEGIS_TIER) {
      ctx.fx.stamp('AEGIS!', { variant: 'gold' });
      const [x, y] = tilePoint(t);
      ctx.fx.confetti(x, y, 60);
      ctx.sound.win();
    } else if (t >= 7) {
      ctx.sound.good();
      const [x, y] = tilePoint(t);
      ctx.fx.floatText(it.short.toLocaleUpperCase('tr-TR'), x, y, { color: it.color, size: 24 });
    } else {
      ctx.sound.coin();
    }
    const li = chainEls[Math.min(t, CHAIN_TIERS) - 1];
    if (li && !reduced) restart(li, 'flash');
    if (m) recordTier(t);
  }

  function recordTier(t) {
    // Rozetler için: ulaşılan en yüksek kademe profilde (picks['esya:tier'])
    const me = store.me.get();
    const prev = Number((me.picks || {})['esya:tier']) || 0;
    if (t > prev && t >= 7) store.me.patch((d) => { if (!d.picks) d.picks = {}; d.picks['esya:tier'] = t; });
  }

  function undo() {
    if (state !== 'play' || !g.prev || g.undo <= 0) return;
    const p = g.prev;
    g.cells = cellsOf(p.cells);
    g.score = p.score;
    g.moves = p.moves;
    g.merges = p.merges;
    g.best = p.best;
    g.big = p.big;
    g.won = p.won;
    g.cont = p.cont;
    g.prev = null;
    g.undo--;
    render(false);
    renderHud();
    save();
    ctx.sound.whoosh();
    setMsg('Son hamle geri alındı. Bu oyunda geri al hakkın bitti.', 'dim');
    say('Son hamle geri alındı.');
  }

  // ---------------------------------------------------------------- giriş: klavye
  const KEYS = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
  };
  const LETTERS = { a: 'left', d: 'right', w: 'up', s: 'down' };
  function onKey(e) {
    if (state !== 'play') return;
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
    if (document.querySelector('.modal-backdrop')) return;
    const dir = KEYS[e.code] || LETTERS[(e.key || '').toLowerCase()];
    if (dir) {
      e.preventDefault();
      if (e.repeat) return;
      move(dir);
      return;
    }
    if (e.code === 'KeyU' || (e.key || '').toLowerCase() === 'u') {
      e.preventDefault();
      if (!e.repeat) undo();
    }
  }
  window.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- giriş: kaydırma (dokunmatik + fare)
  let pid = null;
  let sx = 0;
  let sy = 0;
  let fired = false;
  function onDown(e) {
    if (state !== 'play') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pid = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
    fired = false;
    try { board.setPointerCapture(pid); } catch { /* yok say */ }
  }
  function onMove(e) {
    if (e.pointerId !== pid || fired || state !== 'play') return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.max(ax, ay) < SWIPE_MIN) return;
    if (ax > ay * 1.2) { fired = true; move(dx > 0 ? 'right' : 'left'); } else if (ay > ax * 1.2) { fired = true; move(dy > 0 ? 'down' : 'up'); }
  }
  function onUp(e) {
    if (e.pointerId !== pid) return;
    pid = null;
  }
  // Dokunmatikte sayfa yalnızca tahtanın içinde kaydırılmaz (CSS touch-action: none + eski Safari için)
  function onTouchMove(e) { if (state === 'play') e.preventDefault(); }
  board.addEventListener('pointerdown', onDown);
  board.addEventListener('pointermove', onMove);
  board.addEventListener('pointerup', onUp);
  board.addEventListener('pointercancel', onUp);
  board.addEventListener('touchmove', onTouchMove, { passive: false });

  undoBtn.addEventListener('click', () => { ctx.sound.click(); undo(); });
  endBtn.addEventListener('click', async () => {
    if (state !== 'play') return;
    ctx.sound.click();
    if (!canMove(g.cells)) { finish('full'); return; }
    const ok = await ctx.fx.confirm(`Oyun bitsin mi? ${fmtNum(g.score)} puanın kaydedilir.`, { ok: 'Bitir', cancel: 'Devam' });
    if (ok && state === 'play') finish('quit');
  });

  // ---------------------------------------------------------------- akış
  function startRunner() {
    if (runner) runner.destroy();
    let acc = 0;
    // Oyun süresi: sekme görünürken (kit createRunner) ve son hamleden bu yana IDLE_CAP geçmediyse ilerler
    runner = createRunner((dt) => {
      acc += dt;
      if (state !== 'play' || !g) return;
      if (performance.now() - lastInput < IDLE_CAP * 1000) g.time += dt;
      if (acc > 5) { acc = 0; save(); }
    });
  }

  function play() {
    if (closeOverlay) { closeOverlay(); closeOverlay = null; }
    if (graceTimer) { clearTimeout(graceTimer); graceTimer = 0; }
    state = 'play';
    field.dataset.state = 'play';
    L.stage.classList.add('playing');
    lastInput = performance.now();
    startRunner();
    // Oklar ve WASD oyunun: sitenin gezinme kısayolları (W, D…) oyun boyunca kapalı
    if (!hotkeysOff) { ctx.hotkeys(false); hotkeysOff = true; }
    renderHud();
    try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch { /* yok say */ }
    try { board.focus({ preventScroll: true }); } catch { /* yok say */ }
    requestAnimationFrame(() => revealInView(field));
  }

  function newGame() {
    g = fresh();
    save();
    render(false);
    setMsg('Kaydır: aynı iki eşya birleşir.', 'dim');
    play();
    ctx.sound.whoosh();
    say('Yeni oyun başladı.');
  }

  function continueGame() {
    render(false);
    setMsg(g.moves ? 'Kaldığın yerden devam. Büyük eşyayı köşede tut.' : 'Kaydır: aynı iki eşya birleşir.', 'dim');
    play();
    ctx.sound.whoosh();
    // Kayıtlı tahtada hamle kalmadıysa (ör. bitişten hemen önce sayfa yenilendi) sonucu göster
    if (!canMove(g.cells)) {
      state = 'over';
      later(() => { if (state === 'over') finish('full'); }, 300);
    }
  }

  function restoreHotkeys() {
    graceTimer = 0;
    if (hotkeysOff) { ctx.hotkeys(true); hotkeysOff = false; }
  }

  function stopPlay() {
    L.stage.classList.remove('playing');
    if (runner) { runner.destroy(); runner = null; }
    if (graceTimer) clearTimeout(graceTimer);
    graceTimer = setTimeout(restoreHotkeys, GRACE_MS);
  }

  function showWin() {
    stopPlay();
    field.dataset.state = 'won';
    const it = ITEMS[WIN_TIER];
    const [x, y] = tilePoint(WIN_TIER);
    ctx.fx.confetti(x, y, 90);
    ctx.fx.stamp('DIVINE RAPIER', { variant: 'gold' });
    ctx.sound.win();
    recordTier(WIN_TIER);
    say('Divine Rapier! Kazandın. Aegis için devam edebilir ya da bitirebilirsin.');
    const goOn = h('button', { class: 'btn primary', type: 'button', 'data-primary': '' }, icon('play', { size: 18 }), 'Aegis’e devam');
    const stop = h('button', { class: 'btn ghost', type: 'button' }, icon('flag', { size: 18 }), 'Burada bitir');
    goOn.addEventListener('click', () => {
      ctx.sound.click();
      g.cont = true;
      save();
      if (!canMove(g.cells)) { finish('win'); return; }
      play();
      setMsg('Rapier elinde, hedef Aegis (4096). Sakın ölme!', 'good');
    });
    stop.addEventListener('click', () => { ctx.sound.click(); finish('win'); });
    const node = h('div', { class: 'gm-es-win stack' },
      h('div', { class: 'gm-es-win-art', style: { '--tc': it.color } }, itemImg(WIN_TIER, 'gm-es-win-img')),
      h('span', { class: 'eyebrow' }, '2048 · kazandın'),
      h('h2', { class: 'h2 gm-es-win-title' }, 'Divine Rapier!'),
      h('p', { class: 'muted' }, 'Rapier’i taşımak cesaret ister. Aegis (4096) için devam et ya da puanını şimdi kaydet.'),
      h('p', { class: 'small' }, 'Puan: ', h('strong', { class: 'gold num' }, fmtNum(g.score))),
      h('div', { class: 'row gm-result-actions' }, goOn, stop),
    );
    closeOverlay = showOverlay(L.stage, node, { reveal: true, cls: 'gm-es-ov' });
  }

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  function finish(why) {
    if (!g || g.done) return;
    if (state === 'play' || state === 'won' || state === 'over') stopPlay();
    state = 'end';
    field.dataset.state = 'end';
    g.done = true;
    ls.remove(SAVE_KEY);
    const score = g.score;
    const saved = submitResult(meta, score);
    const it = itemOf(g.best);
    const title = why === 'win' ? 'Rapier’le bitirdin' : why === 'quit' ? 'Oyun bitti' : 'Envanter doldu';
    const bestNode = h('div', { class: 'gm-es-res-best', style: { '--tc': it.color } },
      h('span', { class: 'gm-es-res-ico' }, itemImg(g.best)),
      h('span', { class: 'gm-es-res-text' },
        h('span', { class: 'eyebrow' }, 'En iyi eşya'),
        h('strong', null, it.name),
        h('span', { class: 'xsmall dim' }, it.line),
      ),
    );
    const { node } = resultCard(meta, {
      score,
      saved,
      title,
      stats: [
        ['Hamle', fmtNum(g.moves)],
        ['Birleştirme', fmtNum(g.merges)],
        ['En büyük', g.big ? `+${fmtNum(g.big)}` : '—'],
        ['Süre', fmtTime(g.time)],
        ['Geri al', g.undo > 0 ? 'kullanılmadı' : 'kullanıldı'],
        ['Kademe', g.best > CHAIN_TIERS ? 'Cheese!' : `${g.best}/${CHAIN_TIERS}`],
      ],
      quip: quipFor(g.best, score),
      extra: bestNode,
      retryLabel: 'Yeni oyun',
      onRetry: newGame,
      onBack: () => nav && nav.back(),
    });
    renderHud();
    closeOverlay = showOverlay(L.stage, node, { reveal: true });
    say(`Oyun bitti. ${fmtNum(score)} puan. En iyi eşya: ${it.name}.`);
  }

  // ---------------------------------------------------------------- başlangıç
  function chainPreview() {
    return h('div', { class: 'gm-es-intro-chain', 'aria-hidden': 'true' },
      ITEMS.slice(1, CHAIN_TIERS + 1).map((it, i) => h('span', { class: 'gm-es-intro-link', style: { '--tc': it.color }, title: it.name }, itemImg(i + 1))));
  }

  function showIntro() {
    const saved = load();
    const resume = !!(saved && saved.moves > 0);
    g = saved || fresh();
    render(false);
    renderHud();
    let extra = chainPreview();
    let note = 'Oyun başlayınca oklar ve W A S D tahtayı kaydırır; sitenin kısayolları oyun boyunca kapalıdır. Tahtan her hamlede bu tarayıcıya kaydedilir.';
    if (resume) {
      const fresher = h('button', { class: 'btn ghost', type: 'button' }, icon('refresh', { size: 18 }), 'Yeni oyun');
      fresher.addEventListener('click', () => {
        ctx.sound.click();
        // Yarım kalan oyunun puanı boşa gitmesin: rekor tablosuna yazılır (rekorsa)
        if (g && g.score > 0) submitResult(meta, g.score);
        newGame();
      });
      extra = h('div', { class: 'stack gm-es-resume' },
        h('div', { class: 'gm-es-resume-card', style: { '--tc': itemOf(g.best).color } },
          h('span', { class: 'gm-es-res-ico' }, itemImg(g.best)),
          h('span', { class: 'gm-es-res-text' },
            h('span', { class: 'eyebrow' }, 'Kayıtlı oyun'),
            h('strong', null, `${fmtNum(g.score)} puan · ${fmtNum(g.moves)} hamle`),
            h('span', { class: 'xsmall dim' }, `En iyi eşya: ${itemOf(g.best).name}`),
          ),
          fresher,
        ),
      );
      note = 'Kaldığın yerden devam edebilir ya da yeni oyuna başlayabilirsin (yarım oyunun puanı kaydedilir).';
    }
    const node = introCard(meta, {
      onStart: resume ? continueGame : newGame,
      startLabel: resume ? 'Devam et' : 'Başla',
      extra,
      note,
      rules: resume ? INTRO_RULES.slice(0, 1) : INTRO_RULES,
    });
    const noteEl = node.querySelector(':scope > p.xsmall');
    if (noteEl && !resume) noteEl.classList.add('gm-es-keynote');
    closeOverlay = showOverlay(L.stage, node, { cls: 'gm-es-ov' });
  }

  showIntro();

  // Geliştirme kancası (yalnızca dev sunucusunda; üretim derlemesinde kod tamamen çıkarılır)
  if (import.meta.env.DEV) {
    window.__esya = {
      get state() { return state; },
      get game() { return g && { ...g, cells: tiersOf(g.cells) }; },
      /** Tahtayı kademelerle kur (16 sayı, 0 = boş) ve oynamaya geç. */
      setBoard(tiers, patch = {}) {
        if (!validTiers(tiers)) throw new Error('16 kademe gerekli');
        if (closeOverlay) { closeOverlay(); closeOverlay = null; }
        g = { ...fresh(), ...patch, cells: cellsOf(tiers) };
        g.best = Math.max(g.best || 0, maxTier(g.cells));
        render(false);
        save();
        play();
      },
      move,
      canMove: () => canMove(g.cells),
    };
  }

  return () => {
    state = 'dead';
    window.removeEventListener('keydown', onKey);
    board.removeEventListener('touchmove', onTouchMove);
    if (graceTimer) clearTimeout(graceTimer);
    for (const id of timers) clearTimeout(id);
    timers.clear();
    flushGone();
    if (runner) runner.destroy();
    runner = null;
    if (g && !g.done) save();
    if (hotkeysOff) { ctx.hotkeys(true); hotkeysOff = false; }
    if (closeOverlay) closeOverlay();
    if (import.meta.env.DEV) delete window.__esya;
    L.destroy();
  };
}
