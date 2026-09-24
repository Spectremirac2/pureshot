// DOG Hafıza — 4×4 kart, 8 DOG çifti. 3D çevrilen kartlar, hamle ve süre sayacı.

import { h, clear, shuffle, fmtNum, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { ARCHETYPES } from '../../data/archetypes.js';
import { portraitEl } from '../../components/portrait.js';
import { createRunner, gameLayout, hudStat, showOverlay, introCard, resultCard } from './kit.js';

const PAIRS = 8;
const COLS = 4;

export const meta = {
  id: 'hafiza',
  name: 'DOG Hafıza',
  short: 'Hafıza',
  icon: 'brain',
  color: 'var(--arcane)',
  kind: 'Pasif · Zihin',
  blurb: 'On altı kart, sekiz DOG çifti. Hangi köpek nerede saklanıyor, aklında tut.',
  time: '~1 dk',
  diff: 1,
  unit: 'puan',
  higherIsBetter: true,
  format: (n) => `${fmtNum(n)} puan`,
  rules: [
    'İki kart çevir; aynı DOG’sa açık kalır, değilse geri kapanır.',
    'Her iki kart açma bir hamle. Süre ilk kartla başlar.',
    'Skor = 1000 − hamle×20 − saniye×5 (en az 0).',
    'Üst üste eşleşme serisi DOG DOG DOG damgası getirir.',
  ],
  keys: [['Tab / ← ↑ → ↓', 'Kartlar arasında gez'], ['Enter veya Boşluk', 'Kartı çevir']],
};

export const scoreOf = (moves, secs) => Math.max(0, 1000 - moves * 20 - Math.floor(secs) * 5);

export function mount(el, ctx, nav) {
  const L = gameLayout(el, meta, { nav });
  const reduced = prefersReducedMotion();

  const sMoves = hudStat('Hamle', '0', { ico: 'refresh' });
  const sTime = hudStat('Süre', '0 sn', { ico: 'hourglass' });
  const sPairs = hudStat('Eşleşen', `0/${PAIRS}`, { ico: 'check' });
  const sScore = hudStat('Olası skor', '1.000', { ico: 'trophy', cls: 'gm-stat-score' });
  L.hud.append(sMoves.el, sTime.el, sPairs.el, sScore.el);

  const grid = h('div', { class: 'gm-mm-grid', role: 'group', 'aria-label': 'DOG Hafıza kartları' });
  const caption = h('p', { class: 'gm-mm-caption', 'aria-live': 'polite' }, 'Kartlar kapalı. Bir DOG’u hatırlamak, onu unutmaktan zordur.');
  L.stage.append(grid, caption);

  let cards = [];
  let open = [];
  let state = 'intro';
  let runner = null;
  let closeOverlay = null;
  let flipBackTask = 0;
  let g = null;

  function deal(preview = false) {
    clear(grid);
    const picks = shuffle(ARCHETYPES).slice(0, PAIRS);
    const deck = shuffle([...picks, ...picks]);
    cards = deck.map((arch, i) => {
      const img = portraitEl(arch, { cls: 'gm-mm-img', alt: '' });
      img.loading = 'eager';
      const inner = h('span', { class: 'gm-mm-inner' },
        h('span', { class: 'gm-mm-face gm-mm-back', 'aria-hidden': 'true' },
          h('span', { class: 'gm-mm-crest' }, icon('paw', { size: 26, stroke: 2.2 })),
        ),
        h('span', { class: 'gm-mm-face gm-mm-front', 'aria-hidden': 'true', style: { '--mc': arch.color } },
          img,
          h('span', { class: 'gm-mm-name' }, arch.name.replace(' Köpeği', '')),
        ),
      );
      const btn = h('button', {
        class: 'gm-mm-card',
        type: 'button',
        tabindex: i === 0 ? '0' : '-1',
        'aria-label': `Kart ${i + 1}: kapalı`,
        style: { '--d': `${i * 28}ms` },
        disabled: preview,
      }, inner);
      const card = { i, arch, btn, flipped: false, matched: false };
      btn.addEventListener('click', () => flip(card));
      btn.addEventListener('keydown', (e) => nav2(e, i));
      grid.appendChild(btn);
      return card;
    });
    if (!reduced) {
      grid.classList.remove('dealt');
      void grid.offsetWidth;
      grid.classList.add('dealt');
    }
  }

  // Ok tuşlarıyla kartlar arası gezinme (tek sekme durağı)
  function nav2(e, i) {
    const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS };
    if (!(e.key in map)) return;
    e.preventDefault();
    const n = cards.length;
    const j = (i + map[e.key] + n) % n;
    cards[i].btn.tabIndex = -1;
    cards[j].btn.tabIndex = 0;
    cards[j].btn.focus();
  }

  function label(card) {
    const b = card.btn;
    if (card.matched) b.setAttribute('aria-label', `Kart ${card.i + 1}: ${card.arch.name}, eşleşti`);
    else if (card.flipped) b.setAttribute('aria-label', `Kart ${card.i + 1}: ${card.arch.name}`);
    else b.setAttribute('aria-label', `Kart ${card.i + 1}: kapalı`);
  }

  function setFlipped(card, v) {
    card.flipped = v;
    card.btn.classList.toggle('flipped', v);
    label(card);
  }

  function flip(card) {
    if (state !== 'play' || card.matched || card.flipped) return;
    if (open.length === 2) {
      // Yanlış çift hâlâ açıksa hemen kapat, yeni kartı aç
      runner.cancel(flipBackTask);
      open.forEach((c) => setFlipped(c, false));
      open = [];
    }
    if (!g.started) { g.started = true; g.t0 = runner.time; }
    setFlipped(card, true);
    ctx.sound.click();
    open.push(card);
    if (open.length < 2) return;
    g.moves++;
    sMoves.set(fmtNum(g.moves));
    const [a, b] = open;
    if (a.arch.id === b.arch.id) {
      a.matched = b.matched = true;
      a.btn.classList.add('matched');
      b.btn.classList.add('matched');
      label(a); label(b);
      open = [];
      g.pairs++;
      g.streak++;
      g.bestStreak = Math.max(g.bestStreak, g.streak);
      sPairs.set(`${g.pairs}/${PAIRS}`);
      sPairs.bump();
      ctx.sound.good();
      caption.replaceChildren(h('strong', null, a.arch.name), ' · ', a.arch.tagline);
      caption.style.setProperty('--mc', a.arch.color);
      const r = b.btn.getBoundingClientRect();
      ctx.fx.floatText('DOG!', r.left + r.width / 2, r.top + r.height / 3, { color: a.arch.color, size: 20 });
      if (g.streak === 3) ctx.fx.stamp('DOG DOG DOG', { variant: 'gold' });
      if (g.pairs === PAIRS) finish();
    } else {
      g.streak = 0;
      ctx.sound.miss();
      flipBackTask = runner.after(0.85, () => {
        open.forEach((c) => setFlipped(c, false));
        open = [];
      });
    }
  }

  function frame() {
    if (state !== 'play' || !g.started) return;
    const secs = runner.time - g.t0;
    sTime.set(`${Math.floor(secs)} sn`);
    sScore.set(fmtNum(scoreOf(g.moves, secs)));
  }

  function start() {
    if (closeOverlay) { closeOverlay(); closeOverlay = null; }
    if (runner) runner.destroy();
    runner = createRunner(frame);
    g = { moves: 0, pairs: 0, streak: 0, bestStreak: 0, started: false, t0: 0 };
    open = [];
    sMoves.set('0'); sTime.set('0 sn'); sPairs.set(`0/${PAIRS}`); sScore.set('1.000');
    caption.textContent = 'İlk kartı çevir; saat o an başlar.';
    deal(false);
    state = 'play';
    L.stage.classList.add('playing');
    try { cards[0].btn.focus({ preventScroll: true }); } catch { /* yok say */ }
    ctx.sound.whoosh();
  }

  function finish() {
    state = 'end';
    L.stage.classList.remove('playing');
    const secs = runner.time - g.t0;
    const score = scoreOf(g.moves, secs);
    const quip = g.moves <= 11
      ? 'Fil hafızası. Hangi DOG’un nerede farm yaptığını bile biliyorsun.'
      : g.moves <= 16
        ? 'Sağlam. Minimap’e bakmayı bilen nadir oyunculardansın.'
        : g.moves <= 24
          ? 'Fena değil; biraz AFK Köpeği gibi daldın ama döndün.'
          : 'DOG DOG DOG. Kartlar bile seni pingledi.';
    runner.after(0.7, () => {
      const { node } = resultCard(meta, {
        score,
        title: 'Tüm DOG’lar bulundu',
        stats: [
          ['Hamle', fmtNum(g.moves)],
          ['Süre', `${Math.floor(secs)} sn`],
          ['En iyi seri', `×${g.bestStreak}`],
        ],
        quip,
        onRetry: start,
        onBack: () => nav && nav.back(),
      });
      closeOverlay = showOverlay(L.stage, node);
      L.live.textContent = `Bitti. ${g.moves} hamle, ${Math.floor(secs)} saniye, ${score} puan.`;
      runner.destroy();
      runner = null;
    });
  }

  // Önizleme: kapalı kartlar arkada, başlangıç kartı üstte
  deal(true);
  closeOverlay = showOverlay(L.stage, introCard(meta, { onStart: start }));

  return () => {
    state = 'dead';
    if (runner) runner.destroy();
    runner = null;
    if (closeOverlay) closeOverlay();
    L.destroy();
  };
}
