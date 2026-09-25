// Portre Avı — 10 tur. Kahraman portresi (256×144) canvas'ta çok yakından ve pikselli başlar,
// birkaç saniyede uzaklaşıp netleşir. Dört şıktan doğru kahramanı ne kadar erken seçersen o kadar puan.

import './portre.css';
import { h, clear, fmtNum, clamp, lerp, ls, shuffle, pick, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { HEROES, ATTRS } from '../../data/heroes.js';
import { heroPortraitUrl } from '../../core/assets.js';
import { createRunner, gameLayout, hudStat, showOverlay, introCard, resultCard, submitResult, revealInView, onOtherControl, tok } from './kit.js';

const ROUNDS = 10;
const IW = 256;
const IH = 144;
const BASE_PTS = 100;
const SPEED_PTS = 400;

const DIFFS = {
  caylak: {
    id: 'caylak', name: 'Çaylak', ico: 'paw',
    desc: 'Yavaş açılır (10 sn), şıklar karışık.',
    reveal: 10, hold: 2.5, zoom: [4.2, 1], px: [26, 1], bonus: 1, distract: 'random',
  },
  immortal: {
    id: 'immortal', name: 'Immortal', ico: 'crown',
    desc: 'Hızlı açılır (6,5 sn), şıklar aynı özellikten, portre tam açılmaz. Puan ×1,25.',
    reveal: 6.5, hold: 1.8, zoom: [6.2, 1.5], px: [34, 2], bonus: 1.25, distract: 'attr',
  },
};

/** Seri çarpanı: 1., 2., 3.… ardışık doğru → ×1, ×1,25 … en fazla ×2. */
export const multFor = (streak) => 1 + 0.25 * clamp(streak - 1, 0, 4);
/** Tur puanı: erken cevap 100 + 400'e kadar; p = açılma oranı (0–1). */
export const roundPoints = (p, streak, bonus = 1) => Math.round((BASE_PTS + SPEED_PTS * (1 - clamp(p, 0, 1))) * multFor(streak) * bonus);

export const meta = {
  id: 'portre',
  name: 'Portre Avı',
  short: 'Portre',
  icon: 'target',
  color: 'var(--radiant)',
  kind: 'Refleks · Göz',
  blurb: 'Yakınlaştırılmış portreden kahramanı tanı. Görüntü açıldıkça puan eriyor.',
  lore: 'Sisin içinde bir piksel kıpırdadı. Pudge mu, yoksa sadece bir ağaç mı?',
  time: '~2 dk',
  diff: 2,
  unit: 'puan',
  higherIsBetter: true,
  format: (n) => `${fmtNum(n)} puan`,
  rules: [
    `${ROUNDS} tur. Her turda bir kahraman portresi çok yakından ve pikselli başlar, saniyeler içinde açılır.`,
    'Dört şıktan doğru kahramanı seç: 1–4 tuşları ya da dokun. Ne kadar erken, o kadar puan: 100 + 400’e kadar.',
    'Yanlış cevap ya da süre dolarsa 0 puan; portre, DOG% ve topluluğun o kahramana dair sözü kısa süre görünür.',
    'Üst üste doğrular çarpanı büyütür (×1,25 → ×2). Immortal zorlukta her tur ×1,25.',
  ],
  keys: [['1 2 3 4', 'Şıkkı seç'], ['Enter veya Boşluk', 'Sonraki tur']],
};

const smooth = (t) => t * t * (3 - 2 * t);
const fmtSec = (s) => `${s.toFixed(1).replace('.', ',')} sn`;
const stripQuote = (s) => String(s || '').replace(/^Topluluk der ki:\s*/, '');

// Portre yükleme (önbellekli; sonraki turun görseli önceden iner)
const imgCache = new Map();
function loadImg(id) {
  if (imgCache.has(id)) return imgCache.get(id);
  const url = heroPortraitUrl(id);
  const p = new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = url;
  });
  imgCache.set(id, p);
  return p;
}

export function mount(el, ctx, nav) {
  const L = gameLayout(el, meta, { nav });
  const reduced = prefersReducedMotion();

  const sRound = hudStat('Tur', `0/${ROUNDS}`, { ico: 'target' });
  const sScore = hudStat('Skor', '0', { ico: 'trophy', cls: 'gm-stat-score' });
  const sStreak = hudStat('Seri', '×1', { ico: 'flame' });
  const sValue = hudStat('Değer', '—', { ico: 'coin', cls: 'gm-pt-value' });
  L.hud.append(sRound.el, sScore.el, sStreak.el, sValue.el);

  // ---------------------------------------------------------------- sahne
  const cv = h('canvas', { class: 'gm-pt-canvas', role: 'img', 'aria-label': 'Yakınlaştırılmış kahraman portresi' });
  const g = cv.getContext('2d');
  const small = document.createElement('canvas');
  const sg = small.getContext('2d');
  const tag = h('span', { class: 'gm-pt-tag' }, 'Tur 1');
  const vis = h('span', { class: 'gm-pt-vis num' }, 'Görüş %0');
  const fill = h('span', { class: 'gm-pt-bar-fill' });
  const bar = h('div', { class: 'gm-pt-bar', 'aria-hidden': 'true' }, fill);
  const info = h('div', { class: 'gm-pt-info' });
  const frameEl = h('div', { class: 'gm-pt-frame frame' }, cv, h('span', { class: 'gm-pt-scan', 'aria-hidden': 'true' }), tag, vis, info);
  const choicesEl = h('div', { class: 'gm-pt-choices', role: 'group', 'aria-label': 'Şıklar' });
  const btns = [0, 1, 2, 3].map((i) => {
    const name = h('span', { class: 'gm-pt-name' }, '…');
    const mark = h('span', { class: 'gm-pt-mark', 'aria-hidden': 'true' });
    const b = h('button', { class: 'gm-pt-choice', type: 'button', disabled: true, dataset: { i: String(i) } },
      h('span', { class: 'gm-pt-key kbd' }, String(i + 1)),
      name,
      mark,
    );
    b.addEventListener('click', () => answer(i));
    choicesEl.appendChild(b);
    return { b, name, mark };
  });
  const recap = h('ol', { class: 'gm-pt-recap', 'aria-label': 'Tur özeti' },
    Array.from({ length: ROUNDS }, (_, i) => h('li', { class: 'gm-pt-slot' }, h('span', { class: 'num' }, String(i + 1)))),
  );
  const wrap = h('div', { class: 'gm-pt' }, frameEl, bar, choicesEl, recap);
  L.stage.appendChild(wrap);

  let diff = DIFFS[ls.get('portre:diff', 'caylak')] || DIFFS.caylak;
  let state = 'intro'; // intro | load | play | reveal | end | dead
  let runner = null;
  let closeOverlay = null;
  let hotOff = false;
  let G = null; // oyun durumu
  let R = null; // tur durumu
  let token = 0;
  let W = 0;
  let H = 0;

  // ---------------------------------------------------------------- canvas
  function resize() {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(160, Math.round(r.width * dpr));
    const hh = Math.round(w * (IH / IW));
    if (w !== W || hh !== H) {
      W = cv.width = w;
      H = cv.height = hh;
      redraw();
    }
  }
  let ro = null;
  try { ro = new ResizeObserver(resize); ro.observe(cv); } catch { window.addEventListener('resize', resize); }

  function blank() {
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, tok('--bg-3', '#1e1a2b'));
    gr.addColorStop(1, tok('--bg', '#0d0b14'));
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }

  /** z: yakınlaştırma (1 = tüm portre), (cx, cy): kaynakta odak, px: piksel bloğu (CSS px). */
  function paint(img, hero, z, cx, cy, px) {
    if (!W || !H) return;
    const sw = IW / z;
    const sh = IH / z;
    const sx = clamp(cx - sw / 2, 0, IW - sw);
    const sy = clamp(cy - sh / 2, 0, IH - sh);
    const dpr = W / Math.max(1, cv.clientWidth || W);
    const blk = Math.max(1, px * dpr);
    if (!img) {
      // Portre yoksa (beklenmez): özellik renginde zemin + kısaltma
      const col = (ATTRS[hero.attr] || ATTRS.uni).color;
      g.fillStyle = col;
      g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.font = `900 ${Math.round(H * 0.4 * z)}px Unbounded, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(hero.abbr, W / 2, H / 2);
      return;
    }
    if (blk <= 1.2) {
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
      return;
    }
    const w = Math.max(2, Math.round(W / blk));
    const hh = Math.max(2, Math.round(H / blk));
    if (small.width !== w || small.height !== hh) { small.width = w; small.height = hh; }
    sg.imageSmoothingEnabled = true;
    sg.imageSmoothingQuality = 'high';
    sg.drawImage(img, sx, sy, sw, sh, 0, 0, w, hh);
    g.imageSmoothingEnabled = false;
    g.drawImage(small, 0, 0, w, hh, 0, 0, W, H);
  }

  /** Açılma oranına (0–1) göre çizim parametreleri. */
  function paramsAt(p) {
    const e = smooth(clamp(p, 0, 1));
    const z = lerp(diff.zoom[0], diff.zoom[1], e);
    // Odak, uzaklaştıkça portrenin ortasına kayar
    const k = clamp((diff.zoom[0] - z) / Math.max(0.001, diff.zoom[0] - 1), 0, 1);
    const cx = lerp(R.fx, IW / 2, k);
    const cy = lerp(R.fy, IH / 2, k);
    const px = lerp(diff.px[0], diff.px[1], Math.pow(e, 0.85));
    return { z, cx, cy, px };
  }

  function redraw() {
    if (!R) { blank(); return; }
    if (state === 'reveal' || state === 'end') {
      const a = R.at;
      const t = R.rp;
      paint(R.img, R.hero, lerp(a.z, 1, t), lerp(a.cx, IW / 2, t), lerp(a.cy, IH / 2, t), lerp(a.px, 1, t));
    } else {
      const q = paramsAt(R.p);
      paint(R.img, R.hero, q.z, q.cx, q.cy, q.px);
    }
  }

  // ---------------------------------------------------------------- oyun döngüsü
  function frame(dt) {
    if (!R) return;
    if (state === 'play') {
      const t = runner.time - R.t0;
      R.p = clamp(t / diff.reveal, 0, 1);
      redraw();
      const total = diff.reveal + diff.hold;
      const left = clamp(1 - t / total, 0, 1);
      fill.style.transform = `scaleX(${left.toFixed(4)})`;
      bar.classList.toggle('hold', t > diff.reveal);
      vis.textContent = `Görüş %${Math.round(R.p * 100)}`;
      sValue.set(`+${fmtNum(roundPoints(R.p, G.streak + 1, diff.bonus))}`);
      if (t >= total) timeout();
    } else if (state === 'reveal' && R.rp < 1) {
      R.rp = reduced ? 1 : Math.min(1, R.rp + dt / 0.45);
      redraw();
    }
  }

  function buildChoices(hero) {
    const pool = HEROES.filter((x) => x.id !== hero.id);
    let picks;
    if (diff.distract === 'attr') {
      const same = shuffle(pool.filter((x) => x.attr === hero.attr));
      picks = same.slice(0, 3);
      if (picks.length < 3) picks.push(...shuffle(pool.filter((x) => !picks.includes(x))).slice(0, 3 - picks.length));
    } else {
      picks = shuffle(pool).slice(0, 3);
    }
    return shuffle([hero, ...picks]);
  }

  function setHotkeys(off) {
    if (off && !hotOff) { ctx.hotkeys(false); hotOff = true; }
    if (!off && hotOff) { ctx.hotkeys(true); hotOff = false; }
  }

  function start() {
    if (closeOverlay) { closeOverlay(); closeOverlay = null; }
    if (runner) runner.destroy();
    runner = createRunner(frame);
    const heroes = shuffle(HEROES).slice(0, ROUNDS);
    G = { heroes, i: -1, score: 0, streak: 0, best: 0, correct: 0, fastest: null, log: [] };
    sRound.set(`0/${ROUNDS}`);
    sScore.set('0');
    sStreak.set('×1');
    sValue.set('—');
    [...recap.children].forEach((li, i) => {
      li.className = 'gm-pt-slot';
      li.removeAttribute('title');
      li.replaceChildren(h('span', { class: 'num' }, String(i + 1)));
    });
    wrap.dataset.diff = diff.id;
    L.stage.classList.add('playing');
    setHotkeys(true);
    ctx.sound.whoosh();
    nextRound();
    revealInView(wrap);
  }

  async function nextRound() {
    G.i++;
    if (G.i >= ROUNDS) { finish(); return; }
    const hero = G.heroes[G.i];
    const my = ++token;
    state = 'load';
    clear(info);
    info.className = 'gm-pt-info';
    const choices = buildChoices(hero);
    btns.forEach(({ b, name, mark }, i) => {
      b.disabled = true;
      b.className = 'gm-pt-choice';
      clear(mark);
      b.dataset.id = choices[i].id;
      name.textContent = choices[i].name;
      b.setAttribute('aria-label', `${i + 1}: ${choices[i].name}`);
    });
    sRound.set(`${G.i + 1}/${ROUNDS}`);
    tag.textContent = `Tur ${G.i + 1}/${ROUNDS}`;
    // Odak noktası: yüzler genelde üst-orta bölgede; biraz rastgele
    R = {
      hero, choices, img: null, p: 0, rp: 0, t0: 0, at: null,
      fx: IW * (0.3 + Math.random() * 0.4),
      fy: IH * (0.22 + Math.random() * 0.46),
    };
    if (window.__portreTest) window.__portreTest.answer = hero.id;
    const slow = runner.after(0.15, () => { if (token === my && state === 'load') info.replaceChildren(h('span', { class: 'gm-pt-loading' }, 'Portre yükleniyor…')); });
    const img = await loadImg(hero.id);
    if (state === 'dead' || token !== my) return;
    runner.cancel(slow);
    clear(info);
    R.img = img;
    // Sonraki turun portresi şimdiden insin
    if (G.i + 1 < ROUNDS) loadImg(G.heroes[G.i + 1].id);
    state = 'play';
    R.t0 = runner.time;
    frame(0);
    btns.forEach(({ b }) => { b.disabled = false; });
    bar.classList.remove('hold');
    L.live.textContent = `Tur ${G.i + 1}. Şıklar: ${choices.map((c, i) => `${i + 1} ${c.name}`).join(', ')}.`;
  }

  function answer(i) {
    if (state !== 'play' || !R) return;
    const pickHero = R.choices[i];
    const t = runner.time - R.t0;
    settle(pickHero, i, t);
  }

  function timeout() {
    if (state !== 'play') return;
    settle(null, -1, diff.reveal + diff.hold);
  }

  function settle(pickHero, idx, t) {
    state = 'reveal';
    R.at = paramsAt(R.p);
    R.rp = 0;
    const ok = !!pickHero && pickHero.id === R.hero.id;
    const correctIdx = R.choices.findIndex((c) => c.id === R.hero.id);
    btns.forEach(({ b, mark }, j) => {
      b.disabled = true;
      b.classList.toggle('ok', j === correctIdx);
      b.classList.toggle('bad', j === idx && !ok);
      b.classList.toggle('dim', j !== correctIdx && j !== idx);
      if (j === correctIdx) mark.replaceChildren(icon('check', { size: 18, stroke: 2.6 }));
      else if (j === idx) mark.replaceChildren(icon('cross', { size: 18, stroke: 2.6 }));
    });
    let pts = 0;
    if (ok) {
      G.streak++;
      G.best = Math.max(G.best, G.streak);
      G.correct++;
      pts = roundPoints(R.p, G.streak, diff.bonus);
      G.score += pts;
      G.fastest = G.fastest == null ? t : Math.min(G.fastest, t);
      ctx.sound.coin();
      const r = btns[idx].b.getBoundingClientRect();
      ctx.fx.floatText(`+${pts}`, r.left + r.width / 2, r.top, { color: tok('--aegis-2', '#f6d98a'), size: 22 });
      if (G.streak === 3) ctx.fx.stamp('DOG DOG DOG', { variant: 'gold' });
      if (G.streak === 5) ctx.fx.stamp('1vDOQUZ', { variant: 'gold' });
      sScore.bump();
    } else {
      G.streak = 0;
      if (pickHero) { ctx.sound.bad(); ctx.fx.shake(btns[idx].b); } else ctx.sound.miss();
    }
    const mult = multFor(G.streak);
    sScore.set(fmtNum(G.score));
    sStreak.set(`×${String(mult).replace('.', ',')}`);
    if (ok) sStreak.bump();
    sValue.set(ok ? `+${fmtNum(pts)}` : '0');
    G.log.push({ hero: R.hero, ok, pts, t });
    fill.style.transform = 'scaleX(0)';
    vis.textContent = 'Görüş %100';

    const slot = recap.children[G.i];
    slot.className = `gm-pt-slot ${ok ? 'ok' : 'bad'}`;
    const url = heroPortraitUrl(R.hero.id);
    slot.replaceChildren(
      url ? h('img', { src: url, alt: '', width: '256', height: '144', decoding: 'async' }) : h('span', { class: 'num' }, R.hero.abbr),
      h('span', { class: 'gm-pt-slot-mark', 'aria-hidden': 'true' }, icon(ok ? 'check' : 'cross', { size: 12, stroke: 3 })),
    );
    slot.title = `${G.i + 1}. ${R.hero.name}: ${ok ? `+${pts}` : '0'}`;

    // Bilgi şeridi: doğruysa ad + puan; yanlışsa DOG dosyası
    const hero = R.hero;
    const last = G.i + 1 >= ROUNDS;
    const go = h('button', { class: 'btn sm gm-pt-next', type: 'button' }, last ? 'Sonuç' : 'Devam', icon('arrowRight', { size: 16 }));
    go.addEventListener('click', () => advance());
    info.className = `gm-pt-info show ${ok ? 'ok' : 'bad'}`;
    info.replaceChildren(
      h('div', { class: 'gm-pt-info-top' },
        h('span', { class: 'gm-pt-verdict' }, icon(ok ? 'check' : 'cross', { size: 16, stroke: 2.6 }),
          ok ? `Doğru! +${fmtNum(pts)}` : pickHero ? 'Yanlış' : 'Süre doldu'),
        h('strong', { class: 'gm-pt-hero' }, hero.name),
        h('span', { class: 'badge ember num gm-pt-dog' }, `DOG %${hero.dogRate}`),
        go,
      ),
      ok ? null : h('p', { class: 'gm-pt-quote' }, '“', stripQuote(hero.prejudice), '”'),
    );
    L.live.textContent = ok
      ? `Doğru, ${hero.name}. ${pts} puan. Seri ${G.streak}.`
      : `${pickHero ? 'Yanlış' : 'Süre doldu'}. Doğru cevap: ${hero.name}. DOG yüzde ${hero.dogRate}.`;
    R.next = runner.after(ok ? 1.5 : 3.6, advance);
  }

  function advance() {
    if (state !== 'reveal') return;
    runner.cancel(R.next);
    state = 'load';
    nextRound();
  }

  function finish() {
    state = 'end';
    L.stage.classList.remove('playing');
    setHotkeys(false);
    btns.forEach(({ b }) => { b.disabled = true; });
    const score = G.score;
    const saved = submitResult(meta, score);
    const best = (ls.get('portre:best', {}) || {});
    if (!(best[diff.id] >= score)) { best[diff.id] = score; ls.set('portre:best', best); }
    const quip = score >= 6000
      ? 'Aegis senin. Portrenin ilk pikselinden kahramanı tanıdın; draft’ta ban’lanacak göz bu.'
      : score >= 3500
        ? 'Keskin göz. Sisin içinden bile Pudge’un kancasını seçiyorsun.'
        : score >= 1800
          ? 'Fena değil: bazen piksel okudun, bazen yazı tura attın. Ward var ama biraz geç dikiliyor.'
          : score >= 600
            ? 'Portreler biraz bulanık kaldı. Minimap’e daha sık bak, kaptan.'
            : 'DOG DOG DOG. Bu turda ağaçlar bile kahramana benziyordu.';
    runner.after(0.5, () => {
      if (state !== 'end') return;
      const { node } = resultCard(meta, {
        score,
        saved,
        title: `Maç sonu · ${diff.name}`,
        stats: [
          ['Doğru', `${G.correct}/${ROUNDS}`],
          ['En hızlı', G.fastest == null ? '—' : fmtSec(G.fastest)],
          ['En iyi seri', `×${G.best}`],
        ],
        quip,
        onRetry: () => showIntro(true),
        onBack: () => nav && nav.back(),
      });
      node.insertBefore(recapCard(), node.querySelector('.gm-result-actions'));
      closeOverlay = showOverlay(L.stage, node, { reveal: true });
      L.live.textContent = `Bitti. ${G.correct} doğru, ${score} puan.`;
      runner.destroy();
      runner = null;
    });
  }

  function recapCard() {
    return h('ol', { class: 'gm-pt-sum', 'aria-label': 'Turlar' },
      G.log.map((r, i) => h('li', { class: r.ok ? 'ok' : 'bad', title: `${i + 1}. ${r.hero.name}` },
        h('span', { class: 'gm-pt-sum-name' }, r.hero.name),
        h('span', { class: 'gm-pt-sum-pts num' }, r.ok ? `+${fmtNum(r.pts)}` : '0'),
      )),
    );
  }

  // ---------------------------------------------------------------- tuşlar
  function onKey(e) {
    if (state === 'intro' || state === 'end' || state === 'dead') return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const n = Number(e.key);
    if (state === 'play' && Number.isInteger(n) && n >= 1 && n <= 4) {
      e.preventDefault();
      answer(n - 1);
      return;
    }
    if (state === 'reveal' && (e.key === 'Enter' || e.key === ' ')) {
      if (onOtherControl(e, wrap)) return;
      e.preventDefault();
      advance();
    }
  }
  window.addEventListener('keydown', onKey);

  // Kaplamaya dokunmak da sonraki tura geçer
  frameEl.addEventListener('click', (e) => {
    if (state === 'reveal' && !e.target.closest('button')) advance();
  });

  // ---------------------------------------------------------------- giriş
  function showIntro(reveal = false) {
    if (closeOverlay) { closeOverlay(); closeOverlay = null; }
    if (runner) { runner.destroy(); runner = null; }
    state = 'intro';
    setHotkeys(false);
    L.stage.classList.remove('playing');
    const node = introCard(meta, {
      onStart: start,
      startLabel: 'Ava başla',
      note: reduced ? 'Hareket azaltma açık: portre yine açılır, geçişler sade.' : null,
    });
    const best = ls.get('portre:best', {}) || {};
    const picker = h('div', { class: 'gm-pt-diffs', role: 'radiogroup', 'aria-label': 'Zorluk' },
      Object.values(DIFFS).map((d) => {
        const b = h('button', {
          class: 'gm-pt-diff', type: 'button', role: 'radio',
          'aria-checked': String(d.id === diff.id), dataset: { diff: d.id },
        },
          h('span', { class: 'gm-pt-diff-ico', 'aria-hidden': 'true' }, icon(d.ico, { size: 20 })),
          h('span', { class: 'gm-pt-diff-txt' },
            h('strong', null, d.name),
            h('span', null, d.desc),
            typeof best[d.id] === 'number' ? h('em', { class: 'num' }, `En iyin: ${fmtNum(best[d.id])}`) : null,
          ),
        );
        b.addEventListener('click', () => {
          diff = d;
          ls.set('portre:diff', d.id);
          ctx.sound.click();
          picker.querySelectorAll('.gm-pt-diff').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.diff === d.id)));
          wrap.dataset.diff = d.id;
        });
        return b;
      }),
    );
    const foot = node.querySelector('.gm-intro-foot');
    node.insertBefore(h('div', { class: 'gm-pt-diffwrap' }, h('span', { class: 'label' }, 'Zorluk'), picker), foot);
    closeOverlay = showOverlay(L.stage, node, { reveal });
    teaser();
  }

  // Başlangıç kartının arkasında pikselli bir teaser portre
  function teaser() {
    const hero = pick(HEROES);
    const my = ++token;
    R = { hero, choices: [], img: null, p: 0, rp: 0, fx: IW * 0.5, fy: IH * 0.4 };
    btns.forEach(({ b, name, mark }) => { b.disabled = true; b.className = 'gm-pt-choice'; name.textContent = '???'; clear(mark); });
    tag.textContent = `${ROUNDS} tur`;
    vis.textContent = 'Görüş %0';
    fill.style.transform = 'scaleX(1)';
    clear(info);
    info.className = 'gm-pt-info';
    blank();
    loadImg(hero.id).then((img) => {
      if (token !== my || state !== 'intro') return;
      R.img = img;
      redraw();
    });
  }

  resize();
  showIntro();

  return () => {
    state = 'dead';
    token++;
    window.removeEventListener('keydown', onKey);
    if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
    if (runner) runner.destroy();
    runner = null;
    setHotkeys(false);
    if (closeOverlay) closeOverlay();
    L.destroy();
  };
}
