// Rune Refleksi — nehirde rune belirir, hemen kap. 5 tur, ortalama tepki süresi.
// Tuzak: ikinci turdan itibaren bazen rune yerine bir DOG kafasını çıkarır; ona dokunan "erken" sayılır.
// Son maçların ortalamaları tarayıcıda (csk:rune:hist) tutulur ve sonuç kartında gösterilir.
// Belge: docs/oyunlar/rune.md

import { h, pick, rand, fmtNum, ls } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { ARCHETYPES } from '../../data/archetypes.js';
import { createRunner, gameLayout, hudStat, showOverlay, introCard, resultCard, submitResult, onOtherControl, tok, faceArt } from './kit.js';

const ROUNDS = 5;
// Bundan hızlı tepki insan refleksi değil tahmindir (atletizmdeki hatalı çıkış eşiği gibi): erken sayılır.
const MIN_MS = 100;
const DECOY_CHANCE = 0.35; // ikinci turdan itibaren, tur başına
const DECOY_TIME = 0.75; // sn
const HIST_KEY = 'rune:hist';
const HIST_MAX = 10;

// Kalıcı güç rune'ları ve oyundaki renk tonları (jetonlarla)
const RUNES = [
  { id: 'dd', name: 'Çift Hasar', ico: 'swords', color: 'var(--arcane)' },
  { id: 'haste', name: 'Hız', ico: 'bolt', color: 'var(--dire)' },
  { id: 'illusion', name: 'İllüzyon', ico: 'copy', color: 'var(--aegis)' },
  { id: 'invis', name: 'Görünmezlik', ico: 'eye', color: 'var(--text-2)' },
  { id: 'regen', name: 'Yenilenme', ico: 'heart', color: 'var(--radiant)' },
  { id: 'arcane', name: 'Arcane', ico: 'sparkle', color: 'color-mix(in srgb, var(--dire) 45%, var(--arcane))' },
];

export const meta = {
  id: 'rune',
  name: 'Rune Refleksi',
  short: 'Rune',
  icon: 'bolt',
  color: 'var(--radiant)',
  kind: 'Anlık · Refleks',
  blurb: 'Nehirde rune belirdiği an kap. Erken davranan DOG olur.',
  lore: 'Nehir sessizse rune yakındır. Parmağın hazır olsun.',
  time: '5 tur',
  diff: 2,
  unit: 'ms',
  higherIsBetter: false,
  format: (n) => `${fmtNum(n)} ms`,
  scoreText: (n) => fmtNum(n),
  rules: [
    'Nehre dokun ya da boşluğa bas, sonra izle: 1,5–5 saniye içinde bir rune belirir. Belirdiği an dokun.',
    `Rune’dan önce dokunursan (ya da ${MIN_MS} ms’den hızlıysan, o tahmindir): “Erken tıkladın, DOG!” ve tur yeniden başlar.`,
    'Tuzak: bazen rune yerine nehirde bir DOG kafası çıkar. Dokunma, bekle; ona dokunan da erken sayılır.',
    '5 geçerli turun ortalaması skorundur. Düşük olan kazanır.',
  ],
  keys: [['Boşluk veya Enter', 'Hazır / rune’u al'], ['Tık / dokun', 'Aynı işi yapar']],
};

function rate(ms) {
  if (ms < 200) return { text: 'Işık hızı. Rune’u rakip daha doğmadan aldın.', cls: 'gold' };
  if (ms < 260) return { text: 'Temiz! Mid senin.', cls: 'jade' };
  if (ms < 330) return { text: 'İyi refleks, bottle doldu.', cls: 'jade' };
  if (ms < 450) return { text: 'Ortalama pub hızı.', cls: '' };
  return { text: 'Rune’u Mid Köpeği kaptı.', cls: 'blood' };
}

export function mount(el, ctx, nav) {
  const L = gameLayout(el, meta, { nav });

  const sRound = hudStat('Tur', `0/${ROUNDS}`, { ico: 'target' });
  const sLast = hudStat('Son', '—', { ico: 'bolt' });
  const sAvg = hudStat('Ortalama', '—', { ico: 'trophy', cls: 'gm-stat-score' });
  const sEarly = hudStat('Erken', '0', { ico: 'skull' });
  L.hud.append(sRound.el, sLast.el, sAvg.el, sEarly.el);

  // Sahne: nehir, rune noktası, mesaj
  const runeEl = h('div', { class: 'gm-rn-rune', 'aria-hidden': 'true' },
    h('span', { class: 'gm-rn-rune-ring' }),
    h('span', { class: 'gm-rn-rune-gem' }, h('span', { class: 'gm-rn-rune-ico' })),
  );
  const decoyEl = h('div', { class: 'gm-rn-decoy', 'aria-hidden': 'true' });
  const msg = h('p', { class: 'gm-rn-msg' }, 'Hazır mısın?');
  const sub = h('p', { class: 'gm-rn-sub' }, 'Başlamak için dokun ya da boşluğa bas');
  const field = h('div', {
    class: 'gm-rn-field',
    tabindex: '0',
    role: 'button',
    'aria-label': 'Rune sahası. Hazır olunca dokun ya da boşluğa bas.',
  },
    h('span', { class: 'gm-rn-bank top', 'aria-hidden': 'true' }),
    h('span', { class: 'gm-rn-river', 'aria-hidden': 'true' }, h('span', { class: 'gm-rn-flow' })),
    h('span', { class: 'gm-rn-bank bottom', 'aria-hidden': 'true' }),
    h('span', { class: 'gm-rn-spot', 'aria-hidden': 'true' }),
    runeEl,
    decoyEl,
    h('div', { class: 'gm-rn-text' }, msg, sub),
  );
  const slots = h('ol', { class: 'gm-rn-slots', 'aria-label': 'Tur süreleri' },
    Array.from({ length: ROUNDS }, (_, i) => h('li', { class: 'gm-rn-slot' }, h('span', { class: 'gm-rn-slot-n' }, String(i + 1)), h('span', { class: 'gm-rn-slot-v num' }, '—'))),
  );
  L.stage.append(field, slots);

  let state = 'intro'; // intro | ready | wait | show | end
  let runner = null;
  let closeOverlay = null;
  let waitTask = 0;
  let decoyTask = 0;
  let decoyEnd = 0;
  let t0 = 0;
  let rafId = 0;
  let g = null;

  function setMsg(a, b, cls = '') {
    msg.textContent = a;
    sub.textContent = b;
    field.dataset.mood = cls;
  }
  function say(m) { L.live.textContent = m; }

  function toReady(first = false) {
    state = 'ready';
    field.dataset.state = 'ready';
    runeEl.classList.remove('on');
    if (!first) return;
    setMsg('Hazır mısın?', 'Nehre dokun ya da boşluğa bas', '');
  }

  function toWait() {
    state = 'wait';
    field.dataset.state = 'wait';
    runeEl.classList.remove('on');
    setMsg('Bekle…', 'Rune doğmak üzere. Sakın erken dokunma.', 'wait');
    say('Bekle.');
    const T = rand(1.5, 5);
    waitTask = runner.after(T, showRune);
    // Tuzak: ilk turdan sonra, yeterince uzun beklemelerde
    if (g.times.length >= 1 && T > 2.4 && Math.random() < DECOY_CHANCE) {
      decoyTask = runner.after(rand(0.8, T - DECOY_TIME - 0.6), showDecoy);
    }
  }

  function showDecoy() {
    if (state !== 'wait') return;
    const a = pick(ARCHETYPES);
    decoyEl.replaceChildren(
      h('span', { class: 'gm-rn-decoy-ring' }),
      faceArt(a, { zoom: 1.9, pzoom: 1.3, cls: 'gm-rn-decoy-face' }),
      h('span', { class: 'gm-rn-decoy-tag' }, 'DOG'),
    );
    decoyEl.style.setProperty('--dc', a.color);
    decoyEl.classList.add('on');
    field.dataset.decoy = 'on';
    g.decoys++;
    say('Nehirde bir DOG belirdi. Dokunma.');
    decoyEnd = runner.after(DECOY_TIME, hideDecoy);
  }
  function hideDecoy() {
    decoyEl.classList.remove('on');
    delete field.dataset.decoy;
  }
  function cancelDecoy() {
    if (runner) { runner.cancel(decoyTask); runner.cancel(decoyEnd); }
    hideDecoy();
  }

  function showRune() {
    if (state !== 'wait') return;
    const r = pick(RUNES);
    g.rune = r;
    runeEl.style.setProperty('--rc', r.color);
    runeEl.querySelector('.gm-rn-rune-ico').replaceChildren(icon(r.ico, { size: 40, stroke: 2.2 }));
    rafId = requestAnimationFrame((ts) => {
      rafId = 0;
      if (state !== 'wait') return;
      state = 'show';
      field.dataset.state = 'show';
      runeEl.classList.add('on');
      setMsg('ŞİMDİ!', `${r.name} rune’u`, 'go');
      t0 = ts;
      say(`${r.name} rune’u belirdi!`);
    });
  }

  function early(sub) {
    cancelDecoy();
    g.early++;
    sEarly.set(g.early);
    sEarly.bump();
    ctx.sound.bad();
    ctx.fx.shake(field);
    runeEl.classList.remove('on');
    toReady();
    setMsg('Erken tıkladın, DOG!', sub, 'early');
    say('Erken tıkladın. Tur yeniden.');
  }

  function press(ts) {
    if (state === 'ready') { toWait(); ctx.sound.click(); return; }
    if (state === 'wait') {
      runner.cancel(waitTask);
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      if (field.dataset.decoy === 'on') {
        g.fooled++;
        early('O rune değildi, DOG’du. Tur sayılmadı; hazır olunca tekrar dokun.');
        setMsg('DOG’a dokundun!', 'O rune değildi. Tur sayılmadı; hazır olunca tekrar dokun.', 'early');
        return;
      }
      early('Tur sayılmadı. Hazır olunca tekrar dokun.');
      return;
    }
    if (state === 'show') {
      const ms = Math.max(1, Math.round(ts - t0));
      if (ms < MIN_MS) {
        early(`${ms} ms insan refleksi değil, tahmin. Tur sayılmadı; hazır olunca tekrar dokun.`);
        return;
      }
      g.times.push(ms);
      const n = g.times.length;
      const avg = Math.round(g.times.reduce((a, b) => a + b, 0) / n);
      sRound.set(`${n}/${ROUNDS}`);
      sLast.set(`${ms} ms`);
      sLast.bump();
      sAvg.set(`${avg} ms`);
      const slot = slots.children[n - 1];
      slot.querySelector('.gm-rn-slot-v').textContent = `${ms}`;
      const rt = rate(ms);
      slot.className = `gm-rn-slot done ${rt.cls}`;
      ctx.sound.coin();
      const r = runeEl.getBoundingClientRect();
      ctx.fx.floatText(`${ms} ms`, r.left + r.width / 2, r.top, { color: tok('--aegis-2'), size: 22 });
      runeEl.classList.remove('on');
      runeEl.classList.add('taken');
      runner.after(0.35, () => runeEl.classList.remove('taken'));
      say(`${ms} milisaniye. ${rt.text}`);
      if (n >= ROUNDS) { finish(); return; }
      toReady();
      setMsg(`${ms} ms`, `${rt.text} Sonraki tur için dokun.`, rt.cls || 'done');
    }
  }

  function onPointer(e) {
    if (state === 'intro' || state === 'end') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    press(e.timeStamp || performance.now());
  }
  field.addEventListener('pointerdown', onPointer);

  function onKey(e) {
    if (state === 'intro' || state === 'end' || state === 'dead') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== ' ' && e.key !== 'Enter') return;
    // Odak başka bir düğme/bağlantıdaysa (geri, diğer oyunlar, kaplama düğmeleri) tuş ona aittir
    if (onOtherControl(e, field)) return;
    e.preventDefault();
    if (e.repeat) return;
    press(e.timeStamp || performance.now());
  }
  window.addEventListener('keydown', onKey);

  // Sekme gizlenirse bekleyen tur iptal
  function onVis() {
    if (document.hidden && (state === 'wait' || state === 'show')) {
      if (runner) runner.cancel(waitTask);
      cancelDecoy();
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      toReady();
      setMsg('Tur iptal', 'Sekme değişti. Hazır olunca tekrar dokun.', '');
    }
  }
  document.addEventListener('visibilitychange', onVis);

  function start() {
    if (closeOverlay) { closeOverlay(); closeOverlay = null; }
    if (runner) runner.destroy();
    runner = createRunner(null);
    g = { times: [], early: 0, rune: null, decoys: 0, fooled: 0 };
    cancelDecoy();
    sRound.set(`0/${ROUNDS}`); sLast.set('—'); sAvg.set('—'); sEarly.set('0');
    for (const li of slots.children) { li.className = 'gm-rn-slot'; li.querySelector('.gm-rn-slot-v').textContent = '—'; }
    L.stage.classList.add('playing');
    toReady(true);
    try { field.focus({ preventScroll: true }); } catch { /* yok say */ }
  }

  function finish() {
    state = 'end';
    field.dataset.state = 'end';
    L.stage.classList.remove('playing');
    const n = g.times.length;
    const avg = Math.round(g.times.reduce((a, b) => a + b, 0) / n);
    const best = Math.min(...g.times);
    const worst = Math.max(...g.times);
    setMsg(`${avg} ms`, 'Ortalama tepki süren', rate(avg).cls);
    const saved = submitResult(meta, avg);
    const hist = pushHistory(avg);
    const quip = avg < 220
      ? 'Bottle dolu, rune cepte. Rakip mid hâlâ nehre yürüyor.'
      : avg < 300
        ? 'Sağlam refleks. 2 dakikada bir rune kontrolü sende.'
        : avg < 400
          ? 'Ortalama pub refleksi. Rune’u bazen sen, bazen Mid Köpeği alır.'
          : 'DOG DOG DOG. Rune’u rakip mid çoktan bottle’a doldurdu.';
    runner.after(0.6, () => {
      const { node } = resultCard(meta, {
        score: avg,
        saved,
        stats: [
          ['En hızlı', `${best} ms`],
          ['En yavaş', `${worst} ms`],
          ['Erken / tuzak', g.decoys ? `${fmtNum(g.early)} · ${g.fooled}/${g.decoys} tuzak` : fmtNum(g.early)],
        ],
        quip,
        extra: historyNode(hist),
        onRetry: start,
        onBack: () => nav && nav.back(),
      });
      closeOverlay = showOverlay(L.stage, node, { reveal: true });
      runner.destroy();
      runner = null;
    });
  }

  // ---------------------------------------------------------------- kişisel geçmiş
  function pushHistory(avg) {
    let hist = ls.get(HIST_KEY, []);
    if (!Array.isArray(hist)) hist = [];
    hist = hist.filter((x) => Number.isFinite(x)).concat(avg).slice(-HIST_MAX);
    ls.set(HIST_KEY, hist);
    return hist;
  }
  function historyNode(hist) {
    if (!hist || hist.length < 2) return null;
    const max = Math.max(...hist, 500);
    const min = Math.min(...hist);
    const mean = Math.round(hist.reduce((a, b) => a + b, 0) / hist.length);
    return h('div', { class: 'gm-rn-hist' },
      h('div', { class: 'gm-rn-hist-head' },
        h('span', null, `Son ${hist.length} maçın`),
        h('span', { class: 'num' }, `ort. ${mean} ms · en iyi ${min} ms`),
      ),
      h('div', { class: 'gm-rn-hist-bars', role: 'img', 'aria-label': `Son ${hist.length} maç ortalaması: ${hist.join(', ')} milisaniye` },
        hist.map((v, i) => h('span', {
          class: `gm-rn-hist-bar ${rate(v).cls}${i === hist.length - 1 ? ' now' : ''}`,
          style: { '--h': `${Math.max(8, Math.round((v / max) * 100))}%` },
          title: `${v} ms`,
        })),
      ),
    );
  }

  setMsg('Rune Refleksi', 'Kuralları oku, sonra Başla', '');
  closeOverlay = showOverlay(L.stage, introCard(meta, { onStart: start, note: 'İpucu: dokunma anı ölçülür; parmağın ekranın üstünde beklesin.' }));

  return () => {
    state = 'dead';
    field.removeEventListener('pointerdown', onPointer);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVis);
    if (rafId) cancelAnimationFrame(rafId);
    if (runner) runner.destroy();
    runner = null;
    if (closeOverlay) closeOverlay();
    L.destroy();
  };
}
