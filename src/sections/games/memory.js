// DOG Hafıza — çevrilen kartlarla eşleştirme. Desteler: DOG Arşivi portreleri ya da resmi kahraman
// portreleri. Boyut: 4×4 (8 çift, sıralamaya girer) ya da 5×4 "Zor" (10 çift, antrenman).
// Belge: docs/oyunlar/hafiza.md

import { h, clear, shuffle, fmtNum, ls, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { sound } from '../../core/sound.js';
import { ARCHETYPES } from '../../data/archetypes.js';
import { HEROES, ATTRS } from '../../data/heroes.js';
import { heroPortraitUrl } from '../../core/assets.js';
import { createRunner, gameLayout, hudStat, showOverlay, introCard, resultCard, submitResult, faceArt } from './kit.js';

const RANKED_PAIRS = 8;
const SIZES = {
  normal: { id: 'normal', label: '4×4', sub: '8 çift · sıralı', pairs: 8, cols: 4, ranked: true },
  // DOG Arşivi'nde 10 tür var: Zor masa iki deste için de 10 çift
  zor: { id: 'zor', label: '5×4 Zor', sub: '10 çift · antrenman', pairs: 10, cols: 5, ranked: false },
};
const DECKS = {
  dog: { id: 'dog', label: 'DOG’lar', sub: 'DOG Arşivi', icon: 'paw' },
  hero: { id: 'hero', label: 'Kahramanlar', sub: 'Resmi portreler', icon: 'swords' },
};

export const meta = {
  id: 'hafiza',
  name: 'DOG Hafıza',
  short: 'Hafıza',
  icon: 'brain',
  color: 'var(--arcane)',
  kind: 'Pasif · Zihin',
  blurb: 'On altı kart, sekiz DOG çifti. Hangi köpek nerede saklanıyor, aklında tut.',
  lore: 'Kim ward almadı, kim Rapier düşürdü… iyi bir kaptan hepsini hatırlar.',
  time: '~1 dk',
  diff: 1,
  unit: 'puan',
  higherIsBetter: true,
  format: (n) => `${fmtNum(n)} puan`,
  rules: [
    'İki kart çevir; aynı DOG’sa açık kalır, değilse geri kapanır.',
    'Her iki kart açma bir hamle. Süre ilk kartla başlar.',
    'Skor = 1000 − hamle×20 − saniye×5 (en az 0). 4×4 masalar (DOG ya da kahraman destesi) sıralamaya girer.',
    'Üst üste üç eşleşme DOG DOG DOG damgası getirir. 5×4 Zor masa antrenmandır: skor tabloya yazılmaz.',
  ],
  keys: [['Tab / ← ↑ → ↓', 'Kartlar arasında gez'], ['Enter veya Boşluk', 'Kartı çevir']],
};

export const scoreOf = (moves, secs) => Math.max(0, 1000 - moves * 20 - Math.floor(secs) * 5);
/** Zor masa (10 çift) için aynı ölçeğe çekilmiş antrenman puanı. */
const scoreFor = (size, moves, secs) => (size.pairs === RANKED_PAIRS ? scoreOf(moves, secs) : scoreOf((moves * RANKED_PAIRS) / size.pairs, (secs * RANKED_PAIRS) / size.pairs));

// Kart verisi: { key, name, color, caption, art(), preload? }
function dogCards(n) {
  return shuffle(ARCHETYPES).slice(0, n).map((a) => ({
    key: a.id,
    name: a.name.replace(' Köpeği', ''),
    full: a.name,
    color: a.color,
    caption: a.tagline,
    art: () => faceArt(a, { zoom: 1.6, pzoom: 1.1, cls: 'gm-mm-img' }),
  }));
}
const HERO_POOL = HEROES.filter((x) => heroPortraitUrl(x.id));
function heroCards(n) {
  return shuffle(HERO_POOL).slice(0, n).map((x) => {
    const url = heroPortraitUrl(x.id);
    return {
      key: x.id,
      name: x.name,
      full: x.name,
      color: (ATTRS[x.attr] && ATTRS[x.attr].color) || 'var(--arcane)',
      caption: x.famousMove ? `İmza hareketi: ${x.famousMove}` : (ATTRS[x.attr] ? ATTRS[x.attr].label : ''),
      url,
      art: () => h('span', { class: 'gm-mm-img gm-mm-hero', 'aria-hidden': 'true', style: { backgroundImage: `url("${url}")` } }),
    };
  });
}

export function mount(el, ctx, nav) {
  const L = gameLayout(el, meta, { nav });
  const reduced = prefersReducedMotion();

  const saved = ls.get('hafiza:mode', null) || {};
  let deckId = DECKS[saved.deck] && (saved.deck !== 'hero' || HERO_POOL.length >= 10) ? saved.deck : 'dog';
  let sizeId = SIZES[saved.size] ? saved.size : 'normal';
  const size = () => SIZES[sizeId];

  const sMoves = hudStat('Hamle', '0', { ico: 'refresh' });
  const sTime = hudStat('Süre', '0 sn', { ico: 'hourglass' });
  const sPairs = hudStat('Eşleşen', `0/${size().pairs}`, { ico: 'check' });
  const sScore = hudStat('Skor', '1.000', { ico: 'trophy', cls: 'gm-stat-score' });
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
  const preloaded = new Set();

  // ---------------------------------------------------------------- mod seçici (giriş ve sonuç kartında)
  function modePicker(onChange) {
    const group = (label, items, cur, pick) => h('div', { class: 'gm-mm-mode', role: 'radiogroup', 'aria-label': label },
      h('span', { class: 'gm-mm-mode-lbl' }, label),
      h('div', { class: 'gm-mm-mode-opts' },
        items.map((it) => {
          const b = h('button', {
            class: 'gm-mm-opt', type: 'button', role: 'radio', 'aria-checked': String(it.id === cur()), dataset: { mode: it.id },
          }, it.icon ? icon(it.icon, { size: 16 }) : null, h('span', { class: 'gm-mm-opt-t' }, h('b', null, it.label), h('small', null, it.sub)));
          b.addEventListener('click', () => {
            if (it.id === cur()) return;
            sound.click();
            pick(it.id);
            for (const x of b.parentElement.children) x.setAttribute('aria-checked', String(x === b));
            onChange();
          });
          return b;
        }),
      ),
    );
    const decks = Object.values(DECKS).filter((d) => d.id !== 'hero' || HERO_POOL.length >= 10);
    return h('div', { class: 'gm-mm-modes' },
      group('Deste', decks, () => deckId, (v) => { deckId = v; }),
      group('Masa', Object.values(SIZES), () => sizeId, (v) => { sizeId = v; }),
    );
  }

  function saveMode() {
    ls.set('hafiza:mode', { deck: deckId, size: sizeId });
  }

  function layoutGrid() {
    const sz = size();
    grid.classList.toggle('wide', sz.cols > 4);
    grid.style.setProperty('--cols', sz.cols);
  }

  function deal(preview = false) {
    clear(grid);
    layoutGrid();
    const sz = size();
    const picks = deckId === 'hero' ? heroCards(sz.pairs) : dogCards(sz.pairs);
    // Kahraman portrelerini önceden indir: ilk çevirişte boş kart görünmesin
    for (const p of picks) {
      if (p.url && !preloaded.has(p.url)) { preloaded.add(p.url); const im = new Image(); im.decoding = 'async'; im.src = p.url; }
    }
    const deck = shuffle([...picks, ...picks]);
    cards = deck.map((item, i) => {
      const inner = h('span', { class: 'gm-mm-inner' },
        h('span', { class: 'gm-mm-face gm-mm-back', 'aria-hidden': 'true' },
          h('span', { class: 'gm-mm-crest' }, icon('paw', { size: 26, stroke: 2.2 })),
        ),
        h('span', { class: 'gm-mm-face gm-mm-front', 'aria-hidden': 'true', style: { '--mc': item.color } },
          item.art(),
          h('span', { class: 'gm-mm-name' }, item.name),
        ),
      );
      const btn = h('button', {
        class: 'gm-mm-card',
        type: 'button',
        tabindex: i === 0 ? '0' : '-1',
        'aria-label': `Kart ${i + 1}: kapalı`,
        style: { '--d': `${i * (sz.pairs > 8 ? 18 : 28)}ms` },
        disabled: preview,
      }, inner);
      const card = { i, item, btn, flipped: false, matched: false };
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

  // Ok tuşlarıyla kartlar arası gezinme (tek sekme durağı); sütun sayısı ekrandaki ızgaradan okunur
  function colsNow() {
    const n = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
    return n || size().cols;
  }
  function nav2(e, i) {
    const cols = colsNow();
    const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
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
    if (card.matched) b.setAttribute('aria-label', `Kart ${card.i + 1}: ${card.item.full}, eşleşti`);
    else if (card.flipped) b.setAttribute('aria-label', `Kart ${card.i + 1}: ${card.item.full}`);
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
    if (a.item.key === b.item.key) {
      a.matched = b.matched = true;
      a.btn.classList.add('matched');
      b.btn.classList.add('matched');
      label(a); label(b);
      open = [];
      g.pairs++;
      g.streak++;
      g.bestStreak = Math.max(g.bestStreak, g.streak);
      sPairs.set(`${g.pairs}/${g.total}`);
      sPairs.bump();
      ctx.sound.good();
      caption.replaceChildren(h('strong', null, a.item.full), ' · ', a.item.caption);
      caption.style.setProperty('--mc', a.item.color);
      const r = b.btn.getBoundingClientRect();
      ctx.fx.floatText(g.deck === 'hero' ? 'EŞ!' : 'DOG!', r.left + r.width / 2, r.top + r.height / 3, { color: a.item.color, size: 20 });
      if (g.streak === 3) ctx.fx.stamp('DOG DOG DOG', { variant: 'gold' });
      if (g.pairs === g.total) finish();
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
    sScore.set(fmtNum(scoreFor(size(), g.moves, secs)));
  }

  function resetHud() {
    sMoves.set('0'); sTime.set('0 sn'); sPairs.set(`0/${size().pairs}`); sScore.set('1.000');
  }

  function start() {
    if (closeOverlay) { closeOverlay(); closeOverlay = null; }
    if (runner) runner.destroy();
    saveMode();
    runner = createRunner(frame);
    const sz = size();
    g = { moves: 0, pairs: 0, total: sz.pairs, streak: 0, bestStreak: 0, started: false, t0: 0, deck: deckId, size: sz };
    open = [];
    resetHud();
    caption.textContent = sz.ranked ? 'İlk kartı çevir; saat o an başlar.' : 'Zor masa: on çift. Antrenman; skor tabloya yazılmaz.';
    caption.style.removeProperty('--mc');
    deal(false);
    state = 'play';
    L.stage.classList.add('playing');
    try { cards[0].btn.focus({ preventScroll: true }); } catch { /* yok say */ }
    ctx.sound.whoosh();
  }

  function finish() {
    state = 'end';
    L.stage.classList.remove('playing');
    const sz = g.size;
    const secs = runner.time - g.t0;
    const score = scoreFor(sz, g.moves, secs);
    // HUD son hamleyle güncellensin (kare döngüsü artık 'play' değil) ve skor hemen kaydedilsin
    sTime.set(`${Math.floor(secs)} sn`);
    sScore.set(fmtNum(score));
    const practice = !sz.ranked;
    const saved = practice ? null : submitResult(meta, score);
    const par = Math.round(sz.pairs * 1.4); // "iyi" hamle sayısı ölçeği
    const quip = g.moves <= sz.pairs + 3
      ? (g.deck === 'hero' ? 'Kahraman havuzunu ezbere biliyorsun. Pick ekranında seni kimse şaşırtamaz.' : 'Fil hafızası. Hangi DOG’un nerede farm yaptığını bile biliyorsun.')
      : g.moves <= par + 2
        ? 'Sağlam. Minimap’e bakmayı bilen nadir oyunculardansın.'
        : g.moves <= par * 1.5
          ? 'Fena değil; biraz AFK Köpeği gibi daldın ama döndün.'
          : 'DOG DOG DOG. Kartlar bile seni pingledi.';
    runner.after(0.7, () => {
      const { node } = resultCard(meta, {
        score,
        saved,
        practice,
        title: practice ? 'Zor masa bitti' : g.deck === 'hero' ? 'Tüm kahramanlar bulundu' : 'Tüm DOG’lar bulundu',
        stats: [
          ['Hamle', fmtNum(g.moves)],
          ['Süre', `${Math.floor(secs)} sn`],
          ['En iyi seri', `×${g.bestStreak}`],
        ],
        quip,
        extra: modePicker(() => { saveMode(); }),
        onRetry: start,
        onBack: () => nav && nav.back(),
      });
      closeOverlay = showOverlay(L.stage, node, { reveal: true });
      L.live.textContent = `Bitti. ${g.moves} hamle, ${Math.floor(secs)} saniye, ${score} puan.`;
      runner.destroy();
      runner = null;
    });
  }

  // Önizleme: kapalı kartlar arkada, başlangıç kartı üstte (mod değişince masa yeniden dizilir)
  function showIntro() {
    deal(true);
    resetHud();
    closeOverlay = showOverlay(L.stage, introCard(meta, {
      onStart: start,
      extra: modePicker(() => { saveMode(); deal(true); resetHud(); }),
    }));
  }
  showIntro();

  return () => {
    state = 'dead';
    if (runner) runner.destroy();
    runner = null;
    if (closeOverlay) closeOverlay();
    L.destroy();
  };
}
