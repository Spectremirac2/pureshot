// DOG Avı — köstebek vurmaca. Koridor çukurlarından çıkan DOG'ları report et,
// altın parlayan 1vDOQUZ müttefikine dokunma.

import { h, clear, pick, rand, clamp, lerp, fmtNum, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { ARCHETYPES, LEGEND } from '../../data/archetypes.js';
import { createRunner, gameLayout, hudStat, showOverlay, introCard, resultCard, isTyping, tok, faceArt, hasRealPortrait } from './kit.js';

const DURATION = 45;
const STREAK = 5;
const ALLY_PENALTY = 30;

export const meta = {
  id: 'dogavi',
  name: 'DOG Avı',
  short: 'DOG Avı',
  icon: 'paw',
  color: 'var(--ember)',
  kind: 'Aktif · Alan etkili',
  blurb: 'Çukurdan kafasını çıkaran her DOG’u report et. Altın parlayan 1vDOQUZ’a dokunma.',
  time: '45 sn',
  diff: 2,
  unit: 'puan',
  higherIsBetter: true,
  format: (n) => `${fmtNum(n)} puan`,
  rules: [
    'Çukurdan çıkan DOG’a dokun: REPORT! Seri büyüdükçe puan artar.',
    `${STREAK}’li seride DOG DOG DOG bonusu. Kaçan DOG ya da boş çukur seriyi bozar.`,
    `Altın parlayan 1vDOQUZ senin carry’n: ona vurursan −${ALLY_PENALTY} puan.`,
    'Smurf Köpeği hızlı kaçar ama 2 kat puan verir. 45 saniye, hız giderek artar.',
  ],
  keys: [['1 … 9', 'Dar ekranda 3×3 çukurlar'], ['1–4 / Q–R / A–F', 'Geniş ekranda 4×3 çukurlar']],
};

const KEYS_9 = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const KEYS_12 = ['1', '2', '3', '4', 'Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F'];

function keyFromEvent(e) {
  const c = e.code || '';
  if (/^Digit[0-9]$/.test(c)) return c.slice(5);
  if (/^Numpad[0-9]$/.test(c)) return c.slice(6);
  if (/^Key[A-Z]$/.test(c)) return c.slice(3);
  return (e.key || '').toUpperCase();
}

export function mount(el, ctx, nav) {
  const L = gameLayout(el, meta, { nav });
  const reduced = prefersReducedMotion();

  // HUD
  const sTime = hudStat('Süre', '45,0', { ico: 'hourglass', cls: 'gm-stat-time' });
  const sScore = hudStat('Skor', '0', { ico: 'trophy', cls: 'gm-stat-score' });
  const comboPips = h('span', { class: 'gm-wh-pips', 'aria-hidden': 'true' }, Array.from({ length: STREAK }, () => h('i')));
  const sCombo = hudStat('Seri', '×0', { ico: 'flame', cls: 'gm-stat-combo' });
  sCombo.el.appendChild(comboPips);
  const timeBar = h('span', { class: 'gm-timebar', 'aria-hidden': 'true' }, h('span'));
  sTime.el.appendChild(timeBar);
  L.hud.append(sTime.el, sScore.el, sCombo.el);

  const board = h('div', { class: 'gm-wh-board', role: 'group', 'aria-label': 'DOG Avı çukurları' });
  L.stage.appendChild(board);

  let holes = [];
  let cols = 3;
  let keys = KEYS_9;
  let state = 'intro';
  let runner = null;
  let closeOverlay = null;
  let hotkeysOff = false;
  let g = null; // tur durumu

  function wide() {
    return (L.stage.clientWidth || window.innerWidth) >= 640;
  }

  function buildBoard() {
    const isWide = wide();
    cols = isWide ? 4 : 3;
    const rows = 3;
    keys = isWide ? KEYS_12 : KEYS_9;
    board.style.setProperty('--cols', cols);
    clear(board);
    holes = [];
    for (let i = 0; i < cols * rows; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      // Harita bölgesi: sol alt Radiant, sağ üst Dire, çapraz nehir.
      const nx = cols === 1 ? 0.5 : c / (cols - 1);
      const ny = r / (rows - 1);
      const d = nx - ny;
      const region = d < -0.2 ? 'radiant' : d > 0.2 ? 'dire' : 'river';
      const mole = h('div', { class: 'gm-wh-mole' });
      const btn = h('button', {
        class: `gm-wh-hole r-${region}`,
        type: 'button',
        'aria-label': `Çukur ${keys[i]}: boş`,
        dataset: { i: String(i) },
      },
        h('span', { class: 'gm-wh-tile', 'aria-hidden': 'true' }),
        h('span', { class: 'gm-wh-pit', 'aria-hidden': 'true' }),
        h('span', { class: 'gm-wh-well', 'aria-hidden': 'true' }, mole),
        h('span', { class: 'kbd gm-wh-key', 'aria-hidden': 'true' }, keys[i]),
      );
      btn.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        whack(i, e.clientX, e.clientY);
      });
      // Klavye ile (Enter/Boşluk) etkinleştirme: detail === 0
      btn.addEventListener('click', (e) => {
        if (e.detail !== 0) return;
        const rc = btn.getBoundingClientRect();
        whack(i, rc.left + rc.width / 2, rc.top + rc.height / 3);
      });
      board.appendChild(btn);
      holes.push({ i, btn, mole, kind: null, arch: null, until: 0, hit: false, downTimer: 0 });
    }
  }

  function setHole(hole, kind, arch, upTime) {
    hole.kind = kind;
    hole.arch = arch;
    hole.hit = false;
    hole.until = runner.time + upTime;
    clear(hole.mole);
    hole.mole.className = 'gm-wh-mole';
    if (kind === 'dog') {
      hole.mole.style.setProperty('--mc', arch.color);
      hole.mole.append(
        faceArt(arch, { zoom: 1.9, pzoom: 1.3, cls: 'gm-wh-face' }),
        h('span', { class: 'gm-wh-tag' }, arch.name.replace(' Köpeği', '')),
        h('span', { class: 'gm-wh-report' }, 'REPORT!'),
      );
      if (arch.id === 'smurf') hole.mole.classList.add('fast');
      hole.btn.setAttribute('aria-label', `Çukur ${keys[hole.i]}: ${arch.name}`);
    } else {
      hole.mole.classList.add('ally');
      hole.mole.append(
        h('span', { class: 'gm-wh-ally' },
          hasRealPortrait(LEGEND)
            ? faceArt(LEGEND, { zoom: 2.1, cls: 'gm-wh-ally-face' })
            : h('span', { class: 'gm-wh-ally-crest' }, icon('bow', { size: 34, stroke: 2 })),
          h('span', { class: 'gm-wh-ally-badge' }, icon('crown', { size: 14, stroke: 2.2 })),
        ),
        h('span', { class: 'gm-wh-tag gold' }, '1vDOQUZ'),
        h('span', { class: 'gm-wh-report' }, 'CARRY!'),
      );
      hole.btn.setAttribute('aria-label', `Çukur ${keys[hole.i]}: 1vDOQUZ, müttefik, vurma`);
    }
    // Bir sonraki karede yükselsin (geçiş için)
    requestAnimationFrame(() => hole.kind && hole.mole.classList.add('up'));
  }

  function lower(hole, delay = 0) {
    const doIt = () => {
      hole.mole.classList.remove('up');
      hole.kind = null;
      hole.arch = null;
      hole.btn.setAttribute('aria-label', `Çukur ${keys[hole.i]}: boş`);
    };
    if (delay) {
      hole.kind = hole.kind ? 'down' : null;
      hole.downTimer = runner.after(delay, doIt);
    } else doIt();
  }

  function setCombo(n) {
    g.combo = n;
    g.maxCombo = Math.max(g.maxCombo, n);
    sCombo.set('×' + n);
    const lit = n === 0 ? 0 : ((n - 1) % STREAK) + 1;
    Array.from(comboPips.children).forEach((p, idx) => p.classList.toggle('on', idx < lit));
    sCombo.el.classList.toggle('hot', n >= STREAK);
  }

  function addScore(delta) {
    g.score = Math.max(0, g.score + delta);
    sScore.set(fmtNum(g.score));
    sScore.bump();
  }

  function whack(i, x, y) {
    if (state !== 'play') return;
    const hole = holes[i];
    if (!hole || hole.kind === 'down') return;
    g.clicks++;
    if (hole.kind === 'dog' && !hole.hit) {
      hole.hit = true;
      g.hits++;
      const mult = hole.arch.id === 'smurf' ? 2 : 1;
      const pts = (10 + 2 * Math.min(g.combo, 10)) * mult;
      setCombo(g.combo + 1);
      addScore(pts);
      hole.mole.classList.add('hit');
      ctx.sound.bark(rand(0.8, 1.45));
      ctx.fx.floatText(`+${pts}`, x, y - 10, { color: tok('--ember-2'), size: 24 });
      if (g.combo % STREAK === 0) {
        const bonus = 25 * (g.combo / STREAK);
        addScore(bonus);
        g.bonus += bonus;
        ctx.fx.stamp('DOG DOG DOG', { variant: g.combo >= STREAK * 2 ? 'gold' : '' });
        ctx.fx.floatText(`SERİ +${bonus}`, x, y - 40, { color: tok('--aegis'), size: 20 });
      }
      lower(hole, 0.22);
    } else if (hole.kind === 'ally') {
      g.allyHits++;
      setCombo(0);
      addScore(-ALLY_PENALTY);
      hole.mole.classList.add('hit');
      ctx.sound.bad();
      ctx.fx.floatText('O senin carry’n!', x, y - 10, { color: tok('--aegis-2'), size: 18 });
      ctx.fx.shake(board);
      say('1vDOQUZ’a vurdun: eksi otuz puan.');
      lower(hole, 0.3);
    } else {
      g.empty++;
      if (g.combo) setCombo(0);
      ctx.sound.miss();
      hole.btn.classList.remove('whiff');
      void hole.btn.offsetWidth;
      hole.btn.classList.add('whiff');
    }
  }

  function say(msg) { L.live.textContent = msg; }

  function frame(dt, t) {
    if (state !== 'play') return;
    const left = Math.max(0, DURATION - (t - g.start));
    const k = clamp((t - g.start) / DURATION, 0, 1);
    sTime.set(left.toFixed(1).replace('.', ','));
    timeBar.firstChild.style.transform = `scaleX(${left / DURATION})`;
    sTime.el.classList.toggle('low', left <= 10);
    if (left <= 5 && Math.ceil(left) !== g.lastTick) {
      g.lastTick = Math.ceil(left);
      ctx.sound.tick();
    }

    // Kaçan DOG'lar
    for (const hole of holes) {
      if ((hole.kind === 'dog' || hole.kind === 'ally') && !hole.hit && t >= hole.until) {
        if (hole.kind === 'dog') {
          g.escaped++;
          if (g.combo) setCombo(0);
          hole.mole.classList.add('escape');
        }
        lower(hole);
      }
    }

    if (left <= 0) { end(); return; }

    // Doğum
    g.spawnIn -= dt;
    if (g.spawnIn <= 0) {
      const active = holes.filter((x) => x.kind).length;
      const maxActive = (k < 0.3 ? 2 : k < 0.65 ? 3 : 4) + (cols === 4 ? 1 : 0);
      if (active < maxActive) {
        const free = holes.filter((x) => !x.kind && x.i !== g.lastHole);
        if (free.length) {
          const hole = pick(free);
          g.lastHole = hole.i;
          const allyChance = lerp(0.1, 0.2, k);
          const up = lerp(1.25, 0.66, k) * rand(0.82, 1.18);
          if (Math.random() < allyChance && g.spawns > 2) {
            setHole(hole, 'ally', null, up * 1.25);
          } else {
            const arch = pick(ARCHETYPES);
            const f = arch.id === 'smurf' ? 0.68 : arch.id === 'afk' ? 1.35 : 1;
            setHole(hole, 'dog', arch, up * f);
          }
          g.spawns++;
        }
      }
      g.spawnIn = lerp(0.72, 0.36, k) * rand(0.7, 1.3);
    }
  }

  function onKey(e) {
    if (state !== 'play' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
    const key = keyFromEvent(e);
    const idx = keys.indexOf(key);
    if (idx < 0) return;
    e.preventDefault();
    const rc = holes[idx].btn.getBoundingClientRect();
    whack(idx, rc.left + rc.width / 2, rc.top + rc.height / 3);
  }
  window.addEventListener('keydown', onKey);

  function start() {
    if (closeOverlay) { closeOverlay(); closeOverlay = null; }
    buildBoard();
    if (runner) runner.destroy();
    runner = createRunner(frame);
    g = {
      start: 0, score: 0, combo: 0, maxCombo: 0, hits: 0, clicks: 0, empty: 0,
      allyHits: 0, escaped: 0, bonus: 0, spawnIn: 0.6, spawns: 0, lastHole: -1, lastTick: 99,
    };
    setCombo(0);
    sScore.set('0');
    state = 'play';
    L.stage.classList.add('playing');
    if (cols === 4) { ctx.hotkeys(false); hotkeysOff = true; }
    ctx.sound.whoosh();
    say('DOG Avı başladı. 45 saniye.');
  }

  function end() {
    state = 'end';
    L.stage.classList.remove('playing');
    for (const hole of holes) if (hole.kind) lower(hole);
    if (hotkeysOff) { ctx.hotkeys(true); hotkeysOff = false; }
    const acc = g.clicks ? Math.round((g.hits / g.clicks) * 100) : 0;
    const s = g.score;
    const quip = s >= 1200
      ? '1vDOQUZ onaylı. Koridorda report edilmemiş tek DOG kalmadı.'
      : s >= 700
        ? 'Report butonu hâlâ sıcak. İyi iş, kaptan.'
        : s >= 300
          ? 'Fena değil ama bazı DOG’lar hâlâ ormanda farm yapıyor.'
          : 'DOG DOG DOG. Bu tur köpekler kazandı.';
    runner.after(0.5, () => {
      const { node } = resultCard(meta, {
        score: s,
        stats: [
          ['Report edilen', fmtNum(g.hits)],
          ['İsabet', `%${acc}`],
          ['En uzun seri', `×${g.maxCombo}`],
          ['Carry’ne vurdun', fmtNum(g.allyHits)],
          ['Kaçan DOG', fmtNum(g.escaped)],
          ['Seri bonusu', `+${fmtNum(g.bonus)}`],
        ],
        quip,
        onRetry: start,
        onBack: () => nav && nav.back(),
      });
      closeOverlay = showOverlay(L.stage, node);
      say(`Süre bitti. Skorun ${s} puan.`);
      runner.destroy();
      runner = null;
    });
  }

  // Başlangıç
  buildBoard();
  closeOverlay = showOverlay(L.stage, introCard(meta, {
    onStart: start,
    note: reduced ? 'Hareket azaltma açık: animasyonlar sade.' : null,
  }));

  return () => {
    state = 'dead';
    window.removeEventListener('keydown', onKey);
    if (runner) runner.destroy();
    if (hotkeysOff) ctx.hotkeys(true);
    if (closeOverlay) closeOverlay();
    L.destroy();
  };
}
