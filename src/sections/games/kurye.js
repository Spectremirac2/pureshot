// Uçan Kurye — Flappy türü sonsuz yan kaydırmalı oyun (canvas 2D). Kanatlı kurye eşeği her dokunuşta
// kanat çırpar, yerçekimi aşağı çeker; Radiant ve Dire kulelerinin arasındaki boşluklardan geç, nehre düşme.
// Şişe +25 m, Tango bir çarpmayı affeder, Hız rünü kısa bir turbo (dokunulmazlık) verir.
// Hız, boşluk ve kule aralığı mesafeyle zorlaşır; 650 m'den sonra bazı kuleler oynar.
// Belge: docs/oyunlar/kurye.md

import './kurye.css';
import { h, clamp, lerp, rand, randInt, fmtNum, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { createRunner, gameLayout, hudStat, showOverlay, introCard, resultCard, submitResult, revealInView, onOtherControl, isTyping, tok, hexA } from './kit.js';

// ------------------------------------------------------------------ sabitler (mantıksal birim; 10 birim = 1 metre)
const H = 600; // mantıksal yükseklik; genişlik kabın en-boy oranına göre değişir
const RIVER_H = 62;
const RIVER_Y = H - RIVER_H;
const U_PER_M = 10;
const GRAV = 1550;
const FLAP_V = -485;
const MAX_FALL = 760;
const HIT_R = 12.5; // isabet yarıçapı (çizimden biraz küçük: bağışlayıcı)
const PW = 78; // kule genişliği
const BOTTLE_PTS = 25;
const TURBO_T = 2.4;
const TURBO_K = 1.75;
const GRACE_T = 1.2;
const FIRST_U = 440; // ilk kulenin kuryeye uzaklığı (44 m)
const ITEM_S = 1.3; // eşya çizim ölçeği
const NEAR_U = 6; // bu kadar birimden (60 cm) yakın geçiş: kıl payı
const GRACE_MS = 900;
const TAU = Math.PI * 2;

const fmtM = (n) => `${fmtNum(n)} m`;

export const meta = {
  id: 'kurye',
  name: 'Uçan Kurye',
  short: 'Kurye',
  icon: 'courier',
  color: 'var(--radiant)',
  kind: 'Refleks · Ritim',
  cat: 'refleks',
  blurb: 'Kuryeyi kuleler arasından geçir. Bir dokunuş kanat, bir hata bottle’sız mid.',
  lore: 'Mid’ci bottle bekliyor. Kurye yine kuleye mi çarptı? DOG DOG DOG.',
  time: 'Sonsuz',
  diff: 2,
  unit: 'metre',
  higherIsBetter: true,
  format: (n) => `${fmtNum(n)} metre`,
  charge: (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}km` : `${Math.round(n)}m`),
  rules: [
    'Dokun, tıkla ya da Boşluk / ↑: kurye kanat çırpar. Bırakınca yerçekimi aşağı çeker.',
    'Kulelerin arasındaki boşluktan geç. Kuleye çarpmak ya da nehre düşmek kuryeyi öldürür.',
    `Şişe (Bottle) +${BOTTLE_PTS} m. Tango bir çarpmayı affeder. Hız rünü ${TURBO_T.toLocaleString('tr-TR')} sn turbo: kulelerin içinden geçersin.`,
    'Skor = uçulan metre + şişe bonusu. Hız artar, boşluk daralır; 650 m’den sonra bazı kuleler oynar.',
  ],
  keys: [['Boşluk / ↑', 'Kanat çırp'], ['Tık / Dokun', 'Kanat çırp (sahnenin her yeri)']],
};

function cssPx(name, fallback) {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}

/** Mesafeye göre zorluk. */
function diffAt(m) {
  const a = clamp(m / 1800, 0, 1);
  const ease = 1 - (1 - a) * (1 - a);
  const b = clamp(m / 1400, 0, 1);
  const c = clamp((m - 650) / 1200, 0, 1);
  return {
    speed: lerp(205, 300, ease),
    gap: lerp(212, 148, b),
    spacing: lerp(350, 305, ease),
    up: lerp(115, 160, ease),
    down: lerp(150, 225, ease),
    moveP: m < 650 ? 0 : lerp(0.18, 0.42, c),
    amp: lerp(24, 48, c),
  };
}

/** Çember ile dikdörtgen arasındaki boşluk (negatif: çarpışma). */
function clearance(cx, cy, r, x, y0, w, y1) {
  const dx = Math.max(x - cx, 0, cx - (x + w));
  const dy = Math.max(y0 - cy, 0, cy - y1);
  return Math.hypot(dx, dy) - r;
}

// Kule renkleri (Radiant yeşim taşı, Dire kızıl taş)
const PAL = {
  radiant: { b0: '#22302e', b1: '#3d5a51', b2: '#1c2725', cap: '#4f7266', capHi: '#8fd3b6', line: 'rgba(8,20,16,0.45)', gem: '#43d6a0', gemHi: '#c9ffe9', glow: 'jade' },
  dire: { b0: '#2e1822', b1: '#5a2c3c', b2: '#23121a', cap: '#6e3346', capHi: '#ff8f7a', line: 'rgba(20,6,10,0.5)', gem: '#ff4d5e', gemHi: '#ffd2c2', glow: 'blood' },
};

export function mount(el, ctx, nav) {
  const L = gameLayout(el, meta, { nav });
  const reduced = prefersReducedMotion();
  const coarse = (() => { try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; } })();

  // ---------------------------------------------------------------- HUD
  const sDist = hudStat('Mesafe', '0', { ico: 'courier', cls: 'gm-stat-score' });
  const sBottle = hudStat('Şişe', '0', { ico: 'bottle' });
  const sTango = hudStat('Tango', '—', { ico: 'tango', cls: 'gm-ky-tango' });
  const sBest = hudStat('Rekor', '—', { ico: 'crown' });
  L.hud.append(sDist.el, sBottle.el, sTango.el, sBest.el);
  function renderBest() {
    const b = (ctx.store.me.get().scores || {})[meta.id];
    sBest.set(typeof b === 'number' ? fmtNum(b) : '—');
  }
  renderBest();

  // ---------------------------------------------------------------- sahne
  const canvas = h('canvas', {
    class: 'gm-ky-canvas',
    'aria-label': 'Uçan Kurye sahnesi. Kanat çırpmak için dokun, tıkla ya da Boşluk tuşuna bas.',
    role: 'img',
  });
  const wrap = h('div', { class: 'gm-ky-wrap' }, canvas);
  L.stage.appendChild(wrap);
  const g2 = canvas.getContext('2d');

  const C = {};
  for (const k of ['bg', 'bg-2', 'bg-3', 'bg-4', 'line', 'line-2', 'text', 'text-2', 'text-3', 'ember', 'ember-2', 'ember-deep', 'aegis', 'aegis-2', 'radiant', 'radiant-deep', 'dire', 'dire-deep', 'arcane']) {
    C[k] = tok('--' + k);
  }

  let W = 900; // mantıksal genişlik
  let scale = 1;
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  let sky = null;
  let tiles = null;
  let glows = null;
  const cxOf = () => clamp(W * 0.27, 96, 230);

  function resize(force = false) {
    const w = Math.round(wrap.clientWidth);
    if (!w) return;
    const avail = window.innerHeight - cssPx('--hud-h', 56) - cssPx('--bar-h', 84) - 16;
    const narrow = w < 600;
    const ideal = narrow ? w * 1.45 : w * 0.6;
    const hh = Math.round(clamp(Math.min(ideal, avail), 300, Math.max(300, avail)));
    const nd = Math.min(window.devicePixelRatio || 1, 2);
    if (!force && w === cssW && hh === cssH && nd === dpr) return;
    cssW = w;
    cssH = hh;
    dpr = nd;
    scale = cssH / H;
    W = cssW / scale;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = cssH + 'px';
    sky = null;
    tiles = null;
    draw();
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(wrap);
  const onWinResize = () => resize();
  window.addEventListener('resize', onWinResize);

  let visible = true;
  const io = new IntersectionObserver((ents) => {
    for (const e of ents) visible = e.isIntersecting && e.intersectionRatio > 0.02;
    // Sahne ekrandan büyük ölçüde çıktıysa uçuşu dondur
    const ratio = ents.length ? ents[ents.length - 1].intersectionRatio : 1;
    if (st && st.mode === 'play' && ratio < 0.5) pause();
  }, { threshold: [0, 0.02, 0.5, 1] });
  io.observe(wrap);

  // ---------------------------------------------------------------- durum
  let st = null;
  let runner = null;
  let closeOverlay = null;
  let hotkeysOff = false;
  let graceTimer = 0;

  function newState(mode) {
    return {
      mode, // 'demo' | 'ready' | 'play' | 'dead'
      clock: 0, t: 0,
      y: H * 0.44, vy: 0, wing: 0, flapT: 0, tilt: 0, spin: 0,
      scroll: 0, dist: 0, m: 0,
      pillars: [], items: [], idx: 0, lastGc: H * 0.44, nextRune: randInt(13, 17), lastTango: -99,
      bottles: 0, tango: false, tangoUsed: 0, runes: 0, turbo: 0, grace: 0,
      passed: 0, closest: Infinity, near: 0, flaps: 0,
      parts: [], floats: [], shake: 0, flash: 0, paused: false, deadT: 0, cause: '', splashed: false,
    };
  }

  const scoreOf = () => (st ? Math.floor(st.m) + st.bottles * BOTTLE_PTS : 0);
  const gapC = (p) => (p.amp ? p.gc + Math.sin(p.ph) * p.amp : p.gc);

  // ---------------------------------------------------------------- dünya
  function spawnPillar(x) {
    const cx = cxOf();
    const mAt = st.mode === 'demo' ? 0 : st.m + Math.max(0, x - cx) / U_PER_M;
    const d = diffAt(mAt);
    const gap = d.gap;
    const lo = 46 + gap / 2;
    const hi = RIVER_Y - 40 - gap / 2;
    const amp = Math.random() < d.moveP ? d.amp : 0;
    const up = d.up - amp * 0.5;
    const gc = clamp(st.lastGc + rand(-up, d.down), lo + amp, hi - amp);
    const prev = st.pillars[st.pillars.length - 1] || null;
    const p = {
      x, gc, gap, amp, ph: rand(0, TAU), w: PW,
      side: Math.floor(st.idx / 8) % 2 ? 'dire' : 'radiant',
      passed: false, minClear: Infinity, idx: st.idx++,
    };
    st.pillars.push(p);
    st.lastGc = gc;
    // Eşyalar: rün > tango > şişe (aynı boşluğa bir tane)
    let inGap = false;
    if (st.mode !== 'demo' && p.idx >= st.nextRune) {
      st.items.push({ kind: 'rune', x: x + PW / 2, anchor: p, dy: 0, ph: rand(0, TAU) });
      st.nextRune = p.idx + randInt(15, 22);
      inGap = true;
    } else if (st.mode !== 'demo' && !st.tango && p.idx >= 4 && p.idx - st.lastTango >= 9 && !st.items.some((i) => i.kind === 'tango') && Math.random() < 0.22) {
      st.items.push({ kind: 'tango', x: x + PW / 2, anchor: p, dy: 0, ph: rand(0, TAU) });
      st.lastTango = p.idx;
      inGap = true;
    }
    if (Math.random() < 0.5) {
      if (prev && (inGap || Math.random() < 0.6)) {
        // İki kulenin arasında, iki boşluğun ortalamasında
        const y = clamp((gapC(prev) + gc) / 2 + rand(-18, 18), 60, RIVER_Y - 50);
        st.items.push({ kind: 'bottle', x: (prev.x + PW + x) / 2, y, ph: rand(0, TAU) });
      } else if (!inGap) {
        // Boşluğun içinde, kenara yakın: küçük bir risk
        st.items.push({ kind: 'bottle', x: x + PW / 2, anchor: p, dy: (Math.random() < 0.5 ? -1 : 1) * gap * rand(0.16, 0.27), ph: rand(0, TAU) });
      }
    }
  }

  function ensurePillars() {
    const cx = cxOf();
    // İlk kule her ekran genişliğinde aynı uzaklıkta (masaüstünde hazır ekranında görünür)
    if (!st.pillars.length) spawnPillar(cx + FIRST_U);
    let last = st.pillars[st.pillars.length - 1];
    let guard = 0;
    while (last.x < W + 80 && guard++ < 20) {
      const mAt = st.mode === 'demo' ? 0 : st.m + Math.max(0, last.x - cx) / U_PER_M;
      spawnPillar(last.x + diffAt(mAt).spacing);
      last = st.pillars[st.pillars.length - 1];
    }
  }

  const itemY = (it) => (it.anchor ? gapC(it.anchor) + it.dy : it.y);

  // ---------------------------------------------------------------- olaylar
  function flap() {
    if (!st) return;
    if (st.mode === 'ready') {
      st.mode = 'play';
      L.stage.classList.add('playing');
      say('Uçuş başladı.');
    }
    if (st.mode !== 'play' && st.mode !== 'demo') return;
    if (st.paused) { st.paused = false; say('Devam.'); }
    st.vy = FLAP_V;
    st.flapT = 0.22;
    st.flaps++;
    if (st.mode === 'play') {
      if (!reduced && Math.random() < 0.5) feather(cxOf() - 10, st.y + 4, 1);
      ctx.sound.hover();
    }
  }

  function onPass(p) {
    st.passed++;
    if (st.mode !== 'play') return;
    if (Number.isFinite(p.minClear)) {
      st.closest = Math.min(st.closest, Math.max(0, p.minClear));
      if (p.minClear < NEAR_U) {
        st.near++;
        floatAt(cxOf(), st.y - 34, 'Kıl payı!', C['aegis-2'], 15);
        ctx.sound.good();
        return;
      }
    }
    ctx.sound.tick();
  }

  function collect(it) {
    it.taken = true;
    const x = it.x, y = itemY(it);
    if (it.kind === 'bottle') {
      st.bottles++;
      sBottle.set(fmtNum(st.bottles));
      sBottle.bump();
      floatAt(x, y - 18, `+${BOTTLE_PTS} m`, '#8fe3ff', 17);
      burst(x, y, '#62c8ff', 10);
      ctx.sound.coin();
      say(`Şişe alındı, artı ${BOTTLE_PTS} metre.`);
    } else if (it.kind === 'tango') {
      st.tango = true;
      renderTango();
      floatAt(x, y - 18, 'Tango: +1 can', C.radiant, 15);
      burst(x, y, C.radiant, 10);
      ctx.sound.good();
      say('Tango alındı: bir çarpma affedilir.');
    } else {
      st.runes++;
      st.turbo = TURBO_T;
      floatAt(x, y - 18, 'HIZ RÜNÜ!', '#ff8f7a', 18);
      burst(x, y, '#ff4d5e', 16);
      ctx.sound.whoosh();
      say('Hız rünü: turbo.');
    }
  }

  function useTango(cause) {
    st.tango = false;
    st.tangoUsed++;
    st.grace = GRACE_T;
    renderTango();
    floatAt(cxOf(), st.y - 30, 'Tango yandı!', C.radiant, 16);
    burst(cxOf(), st.y, C.radiant, 14);
    if (cause === 'river') { st.y = RIVER_Y - HIT_R - 4; st.vy = FLAP_V; }
    ctx.sound.bad();
    say('Tango bir çarpmayı affetti.');
  }

  function die(cause) {
    st.mode = 'dead';
    st.cause = cause;
    st.deadT = 0;
    st.vy = cause === 'pillar' ? -320 : -140;
    st.spin = (Math.random() < 0.5 ? -1 : 1) * rand(5, 8);
    st.splashed = cause === 'river';
    st.shake = reduced ? 0 : 0.45;
    st.flash = 0.35;
    feather(cxOf(), st.y, reduced ? 6 : 16);
    if (cause === 'river') splash(cxOf());
    ctx.sound.hit();
    ctx.sound.bad();
    end();
  }

  function pause() {
    if (!st || st.mode !== 'play' || st.paused) return;
    st.paused = true;
    say('Duraklatıldı. Devam etmek için dokun ya da Boşluk.');
    draw();
  }
  const onVis = () => { if (document.hidden) pause(); };
  document.addEventListener('visibilitychange', onVis);
  const onBlur = () => pause();
  window.addEventListener('blur', onBlur);

  // ---------------------------------------------------------------- efektler
  function floatAt(x, y, text, color, size = 16) {
    st.floats.push({ x, y, text, color, size, t: 0, dur: 1.1 });
  }
  function burst(x, y, color, n) {
    const cnt = reduced ? Math.ceil(n / 3) : n;
    for (let i = 0; i < cnt; i++) {
      const a = rand(0, TAU);
      const sp = rand(50, 180);
      st.parts.push({ kind: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, dur: rand(0.3, 0.7), color, size: rand(2, 4), g: 0, rot: 0, vr: 0 });
    }
  }
  function feather(x, y, n) {
    for (let i = 0; i < n; i++) {
      st.parts.push({ kind: 'feather', x: x + rand(-8, 8), y: y + rand(-6, 6), vx: rand(-140, 60), vy: rand(-160, 40), t: 0, dur: rand(0.8, 1.5), color: i % 3 ? '#efe6d2' : '#bcb2c6', size: rand(4, 7), g: 260, rot: rand(0, TAU), vr: rand(-6, 6) });
    }
  }
  function splash(x) {
    const n = reduced ? 5 : 16;
    for (let i = 0; i < n; i++) {
      st.parts.push({ kind: 'dot', x: x + rand(-10, 10), y: RIVER_Y, vx: rand(-120, 120), vy: rand(-320, -120), t: 0, dur: rand(0.5, 0.9), color: i % 2 ? '#9fb0ff' : '#dfe6ff', size: rand(2, 4), g: 900, rot: 0, vr: 0 });
    }
  }
  function say(m) { L.live.textContent = m; }

  function renderTango() {
    sTango.set(st && st.tango ? 'Var' : '—');
    sTango.el.classList.toggle('on', !!(st && st.tango));
  }

  // ---------------------------------------------------------------- döngü
  function autopilot() {
    // Demo: bir sonraki boşluğun biraz altını hedefle, düşerken kanat çırp
    const cx = cxOf();
    const p = st.pillars.find((q) => q.x + q.w > cx - HIT_R - 6);
    const target = p && p.x - cx < 260 ? gapC(p) + p.gap * 0.1 : H * 0.46;
    if (st.y + st.vy * 0.06 > target && st.vy > -80) flap();
  }

  function step(dt) {
    const d = diffAt(st.mode === 'demo' ? 0 : st.m);
    const spd = d.speed * (st.turbo > 0 ? TURBO_K : 1);
    const dx = spd * dt;
    st.scroll += dx;
    if (st.mode === 'play') {
      st.dist += dx;
      st.m = st.dist / U_PER_M;
      st.t += dt;
    }
    st.vy = Math.min(MAX_FALL, st.vy + GRAV * dt);
    st.y += st.vy * dt;
    if (st.y < HIT_R + 4) { st.y = HIT_R + 4; if (st.vy < 0) st.vy = 0; }
    for (const p of st.pillars) { p.x -= dx; if (p.amp) p.ph += dt * 2.2; }
    for (const it of st.items) it.x -= dx;
    st.pillars = st.pillars.filter((p) => p.x + p.w > -60);
    st.items = st.items.filter((it) => !it.taken && it.x > -40);
    ensurePillars();

    if (st.turbo > 0) {
      st.turbo -= dt;
      if (st.turbo <= 0) { st.turbo = 0; st.grace = GRACE_T; }
      if (!reduced && Math.random() < dt * 30) {
        st.parts.push({ kind: 'line', x: cxOf() - 20, y: st.y + rand(-14, 14), vx: -spd * 1.2, vy: 0, t: 0, dur: 0.25, color: '#ff8f7a', size: rand(14, 30), g: 0, rot: 0, vr: 0 });
      }
    }
    const cx = cxOf();
    const invul = st.turbo > 0 || st.grace > 0;

    // Eşyalar
    for (const it of st.items) {
      if (it.taken) continue;
      const dy = itemY(it) - st.y;
      const ddx = it.x - cx;
      if (ddx * ddx + dy * dy < (HIT_R + 16) ** 2) {
        if (st.mode === 'play') collect(it);
        else it.taken = true;
      }
    }

    // Nehir
    if (st.y + HIT_R >= RIVER_Y) {
      if (st.mode === 'demo' || invul) {
        st.y = RIVER_Y - HIT_R - 1;
        st.vy = FLAP_V * 0.85;
      } else if (st.tango) {
        useTango('river');
      } else {
        die('river');
        return;
      }
    }

    // Kuleler
    let overlap = false;
    for (const p of st.pillars) {
      if (cx + HIT_R < p.x || cx - HIT_R > p.x + p.w) {
        if (!p.passed && cx - HIT_R > p.x + p.w) { p.passed = true; onPass(p); }
        continue;
      }
      const c = gapC(p);
      const top = c - p.gap / 2;
      const bot = c + p.gap / 2;
      const cl = Math.min(
        clearance(cx, st.y, HIT_R, p.x, -1e4, p.w, top),
        clearance(cx, st.y, HIT_R, p.x, bot, p.w, 1e4),
      );
      if (cl < 0) {
        overlap = true;
        if (invul || st.mode === 'demo') continue;
        if (st.tango) { useTango('pillar'); continue; }
        die('pillar');
        return;
      }
      if (!invul) p.minClear = Math.min(p.minClear, cl);
    }
    if (st.grace > 0) {
      st.grace -= dt;
      // Kulenin içindeyken koruma bitmesin
      if (st.grace <= 0) st.grace = overlap ? 0.05 : 0;
    }
  }

  function frame(dt, _t, lastStep = true) {
    if (!st) return;
    st.clock += dt;
    const m = st.mode;
    if (m === 'demo') {
      autopilot();
      step(dt);
      if (st.mode === 'demo' && st.pillars.length > 60) st.pillars.splice(0, 30);
    } else if (m === 'play' && !st.paused) {
      step(dt);
    } else if (m === 'ready') {
      st.scroll += 60 * dt;
      st.y = H * 0.44 + Math.sin(st.clock * 3) * 7;
      st.vy = Math.cos(st.clock * 3) * 21;
    } else if (m === 'dead') {
      st.deadT += dt;
      st.vy = Math.min(MAX_FALL, st.vy + GRAV * dt);
      st.y += st.vy * dt;
      st.tilt += st.spin * dt;
      if (!st.splashed && st.y > RIVER_Y) { st.splashed = true; splash(cxOf()); ctx.sound.miss(); }
    }
    if (m !== 'dead') {
      // Eğim: yukarı çıkarken burun yukarı, düşerken aşağı
      const target = clamp(st.vy / 950, -0.42, 0.85);
      st.tilt += (target - st.tilt) * Math.min(1, dt * 12);
    }
    const flapping = st.flapT > 0 || st.vy < -120;
    st.wing += dt * (flapping ? 26 : st.mode === 'ready' ? 9 : 6);
    st.flapT = Math.max(0, st.flapT - dt);
    st.shake = Math.max(0, st.shake - dt);
    st.flash = Math.max(0, st.flash - dt);
    for (const p of st.parts) {
      p.t += dt;
      p.vy += p.g * dt;
      if (p.kind === 'feather') { p.vx *= 0.97; p.vy = Math.min(p.vy, 90); }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    st.parts = st.parts.filter((p) => p.t < p.dur);
    for (const f of st.floats) f.t += dt;
    st.floats = st.floats.filter((f) => f.t < f.dur);
    if (st.mode === 'play' || st.mode === 'dead') sDist.set(fmtNum(scoreOf()));
    if (visible && lastStep) draw();
  }

  // ---------------------------------------------------------------- çizim: önbellekler
  function makeCanvas(wu, hu, k) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(wu * scale * k));
    c.height = Math.max(1, Math.round(hu * scale * k));
    const g = c.getContext('2d');
    g.setTransform(scale * k, 0, 0, scale * k, 0, 0);
    return [c, g];
  }

  function seededRnd(seed) {
    let s = seed;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  }

  function buildSky() {
    const [c, g] = makeCanvas(W, H, dpr);
    const gr = g.createLinearGradient(0, 0, 0, RIVER_Y);
    gr.addColorStop(0, '#0b0913');
    gr.addColorStop(0.45, '#171127');
    gr.addColorStop(0.8, '#2a1830');
    gr.addColorStop(1, '#3b1d2a');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    // Ufuk parıltısı (kor)
    const hz = g.createRadialGradient(W * 0.3, RIVER_Y, 10, W * 0.3, RIVER_Y, W * 0.7);
    hz.addColorStop(0, hexA(C.ember, 0.22));
    hz.addColorStop(1, hexA(C.ember, 0));
    g.fillStyle = hz;
    g.fillRect(0, 0, W, RIVER_Y);
    // Yıldızlar
    const rnd = seededRnd(7);
    for (let i = 0; i < W * 0.12; i++) {
      const y = rnd() * RIVER_Y * 0.62;
      g.globalAlpha = 0.25 + rnd() * 0.6;
      g.fillStyle = rnd() < 0.15 ? C['aegis-2'] : C.text;
      const s = rnd() < 0.1 ? 1.8 : 1.1;
      g.fillRect(rnd() * W, y, s, s);
    }
    g.globalAlpha = 1;
    // Ay
    const mx = W * 0.8, my = H * 0.16, mr = 30;
    const mg = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 3.2);
    mg.addColorStop(0, hexA(C['aegis-2'], 0.25));
    mg.addColorStop(1, hexA(C['aegis-2'], 0));
    g.fillStyle = mg;
    g.beginPath(); g.arc(mx, my, mr * 3.2, 0, TAU); g.fill();
    g.fillStyle = '#f1e6cf';
    g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
    g.fillStyle = 'rgba(160,140,120,0.28)';
    for (const [ox, oy, rr] of [[-9, -6, 6], [8, 7, 8], [10, -12, 4], [-12, 11, 4]]) { g.beginPath(); g.arc(mx + ox, my + oy, rr, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(11,9,19,0.18)';
    g.beginPath(); g.arc(mx + 10, my - 4, mr, 0, TAU); g.fill();
    return c;
  }

  function buildTiles() {
    const k = Math.min(dpr, 1.5);
    // Uzak dağlar
    const FW = 960, fy0 = 250;
    const [far, gf] = makeCanvas(FW, RIVER_Y + 4 - fy0, k);
    gf.translate(0, -fy0);
    const r1 = seededRnd(21);
    const ridge = (col, base, amp, step, seedOff) => {
      gf.fillStyle = col;
      gf.beginPath();
      gf.moveTo(0, RIVER_Y + 4);
      const pts = [];
      for (let x = 0; x <= FW; x += step) pts.push([x, base - amp * (0.35 + 0.65 * Math.abs(Math.sin(x * 0.011 + seedOff))) - r1() * amp * 0.3]);
      pts[pts.length - 1][1] = pts[0][1]; // dikişsiz
      for (const [x, y] of pts) gf.lineTo(x, y);
      gf.lineTo(FW, RIVER_Y + 4);
      gf.closePath();
      gf.fill();
    };
    ridge('#1a1330', RIVER_Y - 70, 150, 48, 0.4);
    ridge('#150f26', RIVER_Y - 30, 95, 36, 2.1);
    // Orta katman: tepeler ve ağaç siluetleri
    const MW = 720, my0 = 360;
    const [mid, gm] = makeCanvas(MW, RIVER_Y + 6 - my0, k);
    gm.translate(0, -my0);
    const r2 = seededRnd(5);
    gm.fillStyle = '#120d1f';
    gm.beginPath();
    gm.moveTo(0, RIVER_Y + 6);
    for (let x = 0; x <= MW; x += 12) gm.lineTo(x, RIVER_Y - 26 - Math.sin((x / MW) * TAU * 2) * 10);
    gm.lineTo(MW, RIVER_Y + 6);
    gm.closePath();
    gm.fill();
    const tree = (x, y, s, col, pine) => {
      for (const ox of [x - MW, x, x + MW]) {
        gm.fillStyle = col;
        if (pine) {
          gm.fillRect(ox - s * 0.08, y - s * 0.4, s * 0.16, s * 0.4);
          for (let i = 0; i < 3; i++) {
            const yy = y - s * 0.3 - i * s * 0.32;
            const ww = s * (0.55 - i * 0.13);
            gm.beginPath(); gm.moveTo(ox - ww, yy); gm.lineTo(ox, yy - s * 0.5); gm.lineTo(ox + ww, yy); gm.closePath(); gm.fill();
          }
        } else {
          gm.fillRect(ox - s * 0.07, y - s * 0.5, s * 0.14, s * 0.5);
          gm.beginPath(); gm.arc(ox, y - s * 0.72, s * 0.42, 0, TAU); gm.fill();
          gm.beginPath(); gm.arc(ox - s * 0.28, y - s * 0.55, s * 0.3, 0, TAU); gm.fill();
          gm.beginPath(); gm.arc(ox + s * 0.3, y - s * 0.58, s * 0.3, 0, TAU); gm.fill();
        }
      }
    };
    for (let i = 0; i < 26; i++) {
      const x = r2() * MW;
      const base = RIVER_Y - 22 - Math.sin((x / MW) * TAU * 2) * 10;
      const s = 34 + r2() * 38;
      const dire = Math.floor(x / (MW / 2)) % 2 === 1;
      tree(x, base + 6, s, dire ? '#211220' : '#0f1d1b', r2() < 0.55);
    }
    // Parıltı sprite'ları (kristaller ve eşyalar için)
    return { far, FW, fy0, fh: RIVER_Y + 4 - fy0, mid, MW, my0, mh: RIVER_Y + 6 - my0 };
  }

  function glowSprite(color) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, hexA(color, 0.75));
    gr.addColorStop(0.35, hexA(color, 0.28));
    gr.addColorStop(1, hexA(color, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return c;
  }
  function ensureGlows() {
    if (glows) return;
    glows = { jade: glowSprite('#43d6a0'), blood: glowSprite('#ff4d5e'), blue: glowSprite('#62c8ff'), gold: glowSprite('#e9b949'), haste: glowSprite('#ff3b3b') };
  }
  function glow(g, name, x, y, r) {
    g.drawImage(glows[name], x - r, y - r, r * 2, r * 2);
  }

  // ---------------------------------------------------------------- çizim: nesneler
  function drawTiled(g, img, tw, y0, th, speed) {
    const off = -((st.scroll * speed) % tw);
    for (let x = off; x < W; x += tw) g.drawImage(img, x, y0, tw, th);
  }

  function drawRiver(g) {
    const gr = g.createLinearGradient(0, RIVER_Y, 0, H);
    gr.addColorStop(0, '#2a2b5c');
    gr.addColorStop(0.35, '#1b1b3e');
    gr.addColorStop(1, '#0d0c1e');
    g.fillStyle = gr;
    g.fillRect(0, RIVER_Y, W, RIVER_H);
    // Yüzey çizgisi
    const ph = st.scroll * 0.03;
    g.strokeStyle = hexA(C.arcane, 0.75);
    g.lineWidth = 2;
    g.beginPath();
    for (let x = 0; x <= W + 10; x += 10) {
      const y = RIVER_Y + Math.sin(x * 0.035 + ph) * 1.6;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    // Akıntı parıltıları
    g.strokeStyle = 'rgba(200,210,255,0.16)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) {
      const y = RIVER_Y + 10 + (i % 4) * 12;
      const span = W + 160;
      const x = ((i * 173 - st.scroll * (0.8 + (i % 3) * 0.12)) % span + span) % span - 80;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 26 + (i % 3) * 12, y); g.stroke();
    }
    // Kıyı sazlıkları
    g.fillStyle = '#0b0714';
    const sp = 34;
    const off = -(st.scroll % sp);
    for (let x = off - sp; x < W + sp; x += sp) {
      const k = Math.floor((x + st.scroll) / sp);
      const hh = 7 + ((k * 7919) % 9);
      g.beginPath();
      g.moveTo(x, RIVER_Y + 2);
      g.lineTo(x + 3, RIVER_Y - hh);
      g.lineTo(x + 6, RIVER_Y + 2);
      g.moveTo(x + 8, RIVER_Y + 2);
      g.lineTo(x + 12, RIVER_Y - hh * 0.6);
      g.lineTo(x + 14, RIVER_Y + 2);
      g.fill();
    }
  }

  function drawColumn(g, x, y0, y1, pal, capDown) {
    if (y1 - y0 < 2) return;
    const w = PW;
    const inset = 7;
    const gr = g.createLinearGradient(x + inset, 0, x + w - inset, 0);
    gr.addColorStop(0, pal.b2);
    gr.addColorStop(0.35, pal.b1);
    gr.addColorStop(0.7, pal.b0);
    gr.addColorStop(1, pal.b2);
    g.fillStyle = gr;
    g.fillRect(x + inset, y0, w - inset * 2, y1 - y0);
    // Taş sıraları
    g.strokeStyle = pal.line;
    g.lineWidth = 1.2;
    const rowH = 24;
    const capH = 24;
    const from = capDown ? y0 : y0 + capH;
    const to = capDown ? y1 - capH : y1;
    g.beginPath();
    let r = 0;
    for (let y = capDown ? to - rowH : from + rowH; capDown ? y > from : y < to; y += capDown ? -rowH : rowH, r++) {
      g.moveTo(x + inset, y); g.lineTo(x + w - inset, y);
      const jx = x + (r % 2 ? w * 0.38 : w * 0.62);
      const ny = capDown ? y - rowH : y + rowH;
      g.moveTo(jx, y); g.lineTo(jx, clamp(ny, Math.min(from, to), Math.max(from, to)));
    }
    g.stroke();
    // Kenar ışığı
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(x + inset, y0, 3, y1 - y0);
    // Başlık (boşluğa bakan uç)
    const cy = capDown ? y1 - capH : y0;
    g.fillStyle = pal.cap;
    g.beginPath();
    g.moveTo(x + 4, cy); g.lineTo(x + w - 4, cy);
    g.lineTo(x + w, cy + 5); g.lineTo(x + w, cy + capH - 5);
    g.lineTo(x + w - 4, cy + capH); g.lineTo(x + 4, cy + capH);
    g.lineTo(x, cy + capH - 5); g.lineTo(x, cy + 5);
    g.closePath();
    g.fill();
    g.fillStyle = hexA(pal.capHi, 0.35);
    g.fillRect(x + 5, capDown ? cy + capH - 4 : cy + 1, w - 10, 3);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x + 5, capDown ? cy + 1 : cy + capH - 4, w - 10, 3);
    // Kristal / diken
    const ey = capDown ? cy + capH : cy;
    const dir = capDown ? 1 : -1;
    const midX = x + w / 2;
    glow(g, pal.glow, midX, ey + dir * 6, 34);
    if (pal === PAL.dire) {
      g.fillStyle = pal.cap;
      for (const ox of [-22, 22]) {
        g.beginPath(); g.moveTo(midX + ox - 6, ey); g.lineTo(midX + ox, ey + dir * 11); g.lineTo(midX + ox + 6, ey); g.closePath(); g.fill();
      }
    } else {
      g.fillStyle = pal.cap;
      for (const ox of [-24, 24]) {
        g.beginPath(); g.arc(midX + ox, ey, 5, capDown ? 0 : Math.PI, capDown ? Math.PI : TAU); g.fill();
      }
    }
    g.fillStyle = pal.gem;
    g.beginPath();
    g.moveTo(midX - 8, ey); g.lineTo(midX, ey + dir * 13); g.lineTo(midX + 8, ey); g.lineTo(midX, ey - dir * 4);
    g.closePath();
    g.fill();
    g.fillStyle = hexA(pal.gemHi, 0.85);
    g.beginPath(); g.moveTo(midX - 3, ey + dir * 1); g.lineTo(midX, ey + dir * 7); g.lineTo(midX + 1, ey + dir * 1); g.closePath(); g.fill();
  }

  function drawPillar(g, p) {
    if (p.x > W + 10 || p.x + p.w < -10) return;
    const c = gapC(p);
    const pal = PAL[p.side];
    drawColumn(g, p.x, -20, c - p.gap / 2, pal, true);
    drawColumn(g, p.x, c + p.gap / 2, RIVER_Y + 20, pal, false);
    if (p.amp) {
      // Oynayan kule: küçük ok işaretleri
      g.fillStyle = hexA(pal.gem, 0.55);
      for (const [yy, d] of [[c - p.gap / 2 - 34, -1], [c + p.gap / 2 + 34, 1]]) {
        g.beginPath(); g.moveTo(p.x + p.w / 2 - 6, yy); g.lineTo(p.x + p.w / 2, yy + d * 7); g.lineTo(p.x + p.w / 2 + 6, yy); g.closePath(); g.fill();
      }
    }
  }

  function drawBottle(g, x, y, ph) {
    g.save();
    g.translate(x, y + Math.sin(ph) * 3);
    g.scale(ITEM_S, ITEM_S);
    g.rotate(Math.sin(ph * 0.7) * 0.18);
    glow(g, 'blue', 0, 2, 24);
    // şişe gövdesi
    g.fillStyle = 'rgba(210,235,255,0.22)';
    g.strokeStyle = '#0d1a2a';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(-3.5, -11); g.lineTo(-3.5, -3.5);
    g.arc(0, 4, 8.5, -Math.PI / 2 - 0.42, -Math.PI / 2 + 0.42 + TAU, false);
    g.lineTo(3.5, -11);
    g.closePath();
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = '#62c8ff';
    g.fillRect(-10, 1 + Math.sin(ph * 2) * 1, 20, 14);
    g.fillStyle = '#b7ecff';
    g.fillRect(-10, 1 + Math.sin(ph * 2) * 1, 20, 1.6);
    g.restore();
    g.stroke();
    // mantar tıpa
    g.fillStyle = '#9a6a3c';
    g.fillRect(-4.2, -14.5, 8.4, 4.4);
    // parıltı
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 1.4;
    g.beginPath(); g.arc(0, 4, 5.5, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
    g.restore();
  }

  function drawTango(g, x, y, ph) {
    g.save();
    g.translate(x, y + Math.sin(ph) * 3);
    g.scale(ITEM_S, ITEM_S);
    glow(g, 'jade', 0, 0, 24);
    g.strokeStyle = '#0b2a1f';
    g.lineWidth = 1.4;
    const leaf = (ang, len, col) => {
      g.save();
      g.rotate(ang);
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(len * 0.45, -len * 0.42, 0, -len);
      g.quadraticCurveTo(-len * 0.45, -len * 0.42, 0, 0);
      g.fill();
      g.stroke();
      g.strokeStyle = 'rgba(11,42,31,0.6)';
      g.beginPath(); g.moveTo(0, -1); g.lineTo(0, -len * 0.8); g.stroke();
      g.restore();
    };
    g.translate(0, 7);
    g.strokeStyle = '#1f8a63';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 5); g.lineTo(0, -1); g.stroke();
    g.strokeStyle = '#0b2a1f';
    g.lineWidth = 1.2;
    leaf(-0.85, 14, '#2fae7f');
    leaf(0.85, 14, '#2fae7f');
    leaf(0, 17, '#43d6a0');
    g.restore();
  }

  function drawRune(g, x, y, ph) {
    g.save();
    g.translate(x, y + Math.sin(ph) * 2.5);
    g.scale(ITEM_S, ITEM_S);
    glow(g, 'haste', 0, 0, 30);
    g.rotate(reduced ? 0 : ph * 0.6);
    // altıgen taş
    g.fillStyle = '#5a1420';
    g.strokeStyle = '#ffb3a0';
    g.lineWidth = 1.8;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const px = Math.cos(a) * 13, py = Math.sin(a) * 13;
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath();
    g.fill();
    g.stroke();
    g.rotate(reduced ? 0 : -ph * 0.6);
    // çift ok (hız)
    g.strokeStyle = '#ffd2c2';
    g.lineWidth = 2.6;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(-6, -5.5); g.lineTo(-1, 0); g.lineTo(-6, 5.5);
    g.moveTo(1, -5.5); g.lineTo(6, 0); g.lineTo(1, 5.5);
    g.stroke();
    g.restore();
  }

  /** Kanatlı kurye eşeği (özgün çizim), sağa bakar; merkez = gövde. */
  function drawCourier(g, x, y, ang, wingPh, alpha) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.scale(1.18, 1.18);
    g.globalAlpha = alpha;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    const OUT = '#1c1628';
    const wingAng = -0.35 + Math.sin(wingPh) * 0.62;
    const wing = (ox, oy, a, col, sc) => {
      g.save();
      g.translate(ox, oy);
      g.rotate(a);
      g.scale(sc, sc);
      g.fillStyle = col;
      g.strokeStyle = OUT;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(2, 2);
      g.quadraticCurveTo(-2, -16, -16, -26);
      g.quadraticCurveTo(-20, -27, -22, -24);
      g.quadraticCurveTo(-24, -19, -22, -15);
      g.quadraticCurveTo(-27, -12, -25, -7);
      g.quadraticCurveTo(-28, -3, -24, 1);
      g.quadraticCurveTo(-18, 6, -8, 5);
      g.closePath();
      g.fill();
      g.stroke();
      g.strokeStyle = 'rgba(28,22,40,0.35)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-3, -1); g.lineTo(-19, -18);
      g.moveTo(-4, 1); g.lineTo(-21, -9);
      g.stroke();
      g.restore();
    };
    // uzak kanat
    wing(-1, -8, wingAng - 0.25, '#b6abc6', 0.92);
    // kuyruk
    g.strokeStyle = '#6e6484';
    g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(-15, -2); g.quadraticCurveTo(-22, -1, -24, 4); g.stroke();
    g.fillStyle = '#3b3350';
    g.beginPath(); g.ellipse(-24.5, 5.5, 2.6, 3.6, 0.3, 0, TAU); g.fill();
    // bacaklar (kıvrık)
    g.strokeStyle = '#7e7494';
    g.lineWidth = 3.4;
    g.beginPath();
    g.moveTo(-8, 7); g.lineTo(-11, 13);
    g.moveTo(-2, 8); g.lineTo(-4, 14);
    g.moveTo(8, 7); g.lineTo(11, 12.5);
    g.stroke();
    g.fillStyle = '#2a2436';
    for (const [hx, hy] of [[-11, 13.5], [-4, 14.5], [11.3, 13]]) { g.beginPath(); g.arc(hx, hy, 1.9, 0, TAU); g.fill(); }
    // gövde
    g.fillStyle = '#8e84a3';
    g.strokeStyle = OUT;
    g.lineWidth = 1.6;
    g.beginPath(); g.ellipse(-1, 1, 17, 10.5, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#c3b9d3';
    g.beginPath(); g.ellipse(0, 5.2, 12, 4.6, 0, 0, TAU); g.fill();
    // heybe (sırtta kutu + bottle)
    g.fillStyle = '#62c8ff';
    g.strokeStyle = OUT;
    g.lineWidth = 1.2;
    g.beginPath(); g.rect(-9.5, -17, 3.6, 6); g.fill(); g.stroke();
    g.fillStyle = '#7a4f2e';
    g.lineWidth = 1.5;
    g.beginPath(); g.rect(-13, -13, 13, 9); g.fill(); g.stroke();
    g.fillStyle = C.aegis;
    g.fillRect(-7.5, -13, 2.4, 9);
    // boyun ve baş
    g.fillStyle = '#8e84a3';
    g.strokeStyle = OUT;
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(9, -5); g.quadraticCurveTo(12, -12, 15, -13); g.lineTo(18, -6); g.quadraticCurveTo(15, -1, 12, 2);
    g.closePath(); g.fill();
    // kulaklar
    const ear = (ex, ey, a, len) => {
      g.save(); g.translate(ex, ey); g.rotate(a);
      g.fillStyle = '#8e84a3'; g.strokeStyle = OUT; g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(0, -len / 2, 2.9, len / 2, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#d99aae';
      g.beginPath(); g.ellipse(0.3, -len / 2, 1.3, len / 2 - 2.2, 0, 0, TAU); g.fill();
      g.restore();
    };
    ear(13.5, -16, -0.75 - Math.sin(wingPh) * 0.08, 12);
    // kafa
    g.fillStyle = '#968cab';
    g.beginPath(); g.ellipse(19, -12, 7.8, 6.4, 0.35, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#cfc5de';
    g.beginPath(); g.ellipse(24.6, -8.6, 4.8, 4, 0.35, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = OUT;
    g.beginPath(); g.arc(26.2, -9.4, 0.9, 0, TAU); g.fill();
    ear(16.5, -16.5, -0.35 - Math.sin(wingPh) * 0.1, 13);
    // yele
    g.fillStyle = '#3b3350';
    g.beginPath();
    g.moveTo(10, -8); g.quadraticCurveTo(11, -15, 15, -17.5); g.quadraticCurveTo(13, -12, 12.5, -6); g.closePath(); g.fill();
    // göz
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(19.8, -13.6, 2.4, 0, TAU); g.fill();
    g.fillStyle = OUT;
    g.beginPath(); g.arc(20.5, -13.5, 1.25, 0, TAU); g.fill();
    // yakın kanat
    wing(-2, -9, wingAng, '#efe6d2', 1);
    g.restore();
  }

  function drawText(g, text, x, y, size, color, { font = 'Unbounded', weight = 900, stroke = 4, align = 'center', alpha = 1 } = {}) {
    g.globalAlpha = alpha;
    g.font = `${weight} ${size}px ${font}, 'Arial Black', sans-serif`;
    g.textAlign = align;
    g.textBaseline = 'middle';
    if (stroke) {
      g.lineJoin = 'round';
      g.lineWidth = stroke;
      g.strokeStyle = 'rgba(8,6,14,0.85)';
      g.strokeText(text, x, y);
    }
    g.fillStyle = color;
    g.fillText(text, x, y);
    g.globalAlpha = 1;
  }

  function draw() {
    if (!cssW || !st) return;
    const g = g2;
    if (!sky) sky = buildSky();
    if (!tiles) tiles = buildTiles();
    ensureGlows();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(sky, 0, 0);
    let ox = 0, oy = 0;
    if (st.shake > 0) { ox = rand(-5, 5) * st.shake; oy = rand(-4, 4) * st.shake; }
    g.setTransform(dpr * scale, 0, 0, dpr * scale, ox * dpr * scale, oy * dpr * scale);
    drawTiled(g, tiles.far, tiles.FW, tiles.fy0, tiles.fh, 0.1);
    drawTiled(g, tiles.mid, tiles.MW, tiles.my0, tiles.mh, 0.35);
    for (const p of st.pillars) drawPillar(g, p);
    drawRiver(g);
    // eşyalar
    for (const it of st.items) {
      if (it.taken || it.x < -30 || it.x > W + 30) continue;
      const ph = it.ph + st.clock * 3;
      const y = itemY(it);
      if (it.kind === 'bottle') drawBottle(g, it.x, y, ph);
      else if (it.kind === 'tango') drawTango(g, it.x, y, ph);
      else drawRune(g, it.x, y, ph);
    }
    // parçacıklar (arka: hız çizgileri)
    for (const p of st.parts) {
      if (p.kind !== 'line') continue;
      g.globalAlpha = Math.max(0, 1 - p.t / p.dur) * 0.7;
      g.strokeStyle = p.color;
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.size, p.y); g.stroke();
    }
    g.globalAlpha = 1;
    // kurye
    const cx = cxOf();
    let alpha = 1;
    if (st.grace > 0 && st.mode === 'play') alpha = reduced ? 0.55 : (Math.sin(st.clock * 32) > 0 ? 1 : 0.3);
    if (st.turbo > 0) {
      glow(g, 'haste', cx, st.y, 46 + Math.sin(st.clock * 20) * 4);
      if (!reduced) {
        // hayalet iz: turbo sırasında arkada soluk kopyalar
        for (let i = 3; i >= 1; i--) drawCourier(g, cx - i * 16, st.y + st.vy * 0.012 * i, st.tilt, st.wing - i * 0.6, 0.16 / i + 0.06);
      }
    }
    if (st.tango && st.mode === 'play') {
      g.strokeStyle = hexA(C.radiant, 0.45 + Math.sin(st.clock * 4) * 0.15);
      g.lineWidth = 2;
      g.beginPath(); g.arc(cx, st.y, 31, 0, TAU); g.stroke();
    }
    if (st.mode !== 'dead' || st.y < H + 40) drawCourier(g, cx, st.y, st.tilt, st.wing, alpha);
    // parçacıklar (ön)
    for (const p of st.parts) {
      if (p.kind === 'line') continue;
      g.globalAlpha = Math.max(0, 1 - p.t / p.dur);
      g.fillStyle = p.color;
      if (p.kind === 'feather') {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.beginPath(); g.ellipse(0, 0, p.size, p.size * 0.38, 0, 0, TAU); g.fill();
        g.restore();
      } else {
        g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    g.globalAlpha = 1;
    // uçan yazılar
    for (const f of st.floats) {
      const k = f.t / f.dur;
      const y = f.y - (reduced ? 0 : k * 26);
      g.font = `900 ${f.size}px Unbounded, 'Arial Black', sans-serif`;
      const half = g.measureText(f.text).width / 2 + 4;
      drawText(g, f.text, clamp(f.x, half, Math.max(half, W - half)), Math.max(f.size, y), f.size, f.color, { stroke: 3, alpha: Math.max(0, 1 - k * k) });
    }
    // Arayüz: skor, turbo çubuğu, durum yazıları
    g.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    if (st.mode === 'play' || st.mode === 'dead') {
      drawText(g, fmtNum(scoreOf()), W / 2, 50, 40, C.text, { stroke: 6 });
      drawText(g, 'METRE', W / 2, 80, 11, C['text-2'], { font: 'Barlow', weight: 700, stroke: 3 });
      if (st.turbo > 0) {
        const bw = 120;
        g.fillStyle = 'rgba(8,6,14,0.7)';
        g.fillRect(W / 2 - bw / 2 - 2, 94, bw + 4, 8);
        g.fillStyle = '#ff6a5a';
        g.fillRect(W / 2 - bw / 2, 96, bw * clamp(st.turbo / TURBO_T, 0, 1), 4);
      }
    }
    if (st.flash > 0) {
      g.fillStyle = `rgba(224,53,75,${(st.flash / 0.35) * 0.35})`;
      g.fillRect(0, 0, W, H);
    }
    if (st.mode === 'ready') {
      const pulse = reduced ? 1 : 1 + Math.sin(st.clock * 5) * 0.04;
      drawText(g, 'DOKUN VE UÇ', W / 2, H * 0.24, Math.round(Math.min(34, W / 11) * pulse), C.text, { stroke: 6 });
      drawText(g, coarse ? 'Ekrana dokun: kanat çırp' : 'Boşluk · ↑ · tık: kanat çırp', W / 2, H * 0.24 + 36, 15, C['aegis-2'], { font: 'Barlow', weight: 700, stroke: 4 });
      // dokunma halkası
      const k = reduced ? 0.5 : (st.clock * 1.2) % 1;
      g.strokeStyle = hexA(C['aegis-2'], 0.7 * (1 - k));
      g.lineWidth = 2;
      g.beginPath(); g.arc(cx, st.y, 24 + k * 22, 0, TAU); g.stroke();
    } else if (st.mode === 'play' && st.paused) {
      g.fillStyle = 'rgba(8,6,14,0.55)';
      g.fillRect(0, 0, W, H);
      drawText(g, 'DURAKLATILDI', W / 2, H * 0.4, Math.min(32, W / 12), C.text, { stroke: 6 });
      drawText(g, coarse ? 'Devam etmek için dokun' : 'Devam: Boşluk, ↑ ya da tık', W / 2, H * 0.4 + 36, 15, C['aegis-2'], { font: 'Barlow', weight: 700, stroke: 4 });
    } else if (st.mode === 'dead' && !st.early) {
      // (erken ölümde ekrandaki DOG DOG DOG damgası bu yazının yerini alır)
      const k = clamp(st.deadT / 0.25, 0, 1);
      const s = reduced ? 1 : lerp(1.5, 1, k);
      drawText(g, 'KURYE ÖLDÜ!', W / 2, H * 0.36, Math.round(Math.min(40, W / 9.5) * s), C.dire, { stroke: 7, alpha: k });
      drawText(g, st.cause === 'river' ? 'Nehre düştü' : 'Kuleye çarptı', W / 2, H * 0.36 + 38, 15, C['text-2'], { font: 'Barlow', weight: 700, stroke: 4, alpha: k });
    } else if (st.mode === 'demo') {
      g.fillStyle = hexA(C.bg, 0.25);
      g.fillRect(0, 0, W, H);
    }
  }

  // ---------------------------------------------------------------- giriş
  function onPointerDown(e) {
    if (!st || (st.mode !== 'ready' && st.mode !== 'play')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    flap();
  }
  wrap.addEventListener('pointerdown', onPointerDown);

  function onKey(e) {
    if (!st || e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
    const isFlap = e.key === ' ' || e.code === 'Space' || e.key === 'ArrowUp';
    if (!isFlap) return;
    if (st.mode !== 'ready' && st.mode !== 'play' && st.mode !== 'dead') return;
    // Odak bir düğmedeyse (sonuç kartı, geri…) Boşluk ona aittir
    if (onOtherControl(e, wrap)) return;
    e.preventDefault(); // sayfa kaymasın
    if (e.repeat || st.mode === 'dead') return; // basılı tutmak uçurmaz
    flap();
  }
  window.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- akış
  function startDemo() {
    st = newState('demo');
    if (!runner) runner = createRunner(frame);
    // demo boş başlamasın: ilk kuleler görünür yerde
    const cx = cxOf();
    st.pillars = [];
    let x = cx + 180;
    while (x < W + 80) { spawnPillar(x); x += diffAt(0).spacing; }
  }

  function start() {
    if (closeOverlay) { closeOverlay(); closeOverlay = null; }
    if (graceTimer) { clearTimeout(graceTimer); graceTimer = 0; }
    resize(true);
    st = newState('ready');
    ensurePillars();
    sDist.set('0');
    sBottle.set('0');
    renderTango();
    renderBest();
    if (runner) runner.destroy();
    runner = createRunner(frame);
    wrap.classList.add('playing');
    ctx.hotkeys(false);
    hotkeysOff = true;
    // Odak gövdede kalsın: Boşluk kanat çırpsın, sahnede odak çerçevesi yanmasın
    try { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); } catch { /* yok say */ }
    say('Hazır. Kanat çırpmak için dokun ya da Boşluk.');
    requestAnimationFrame(() => revealInView(wrap));
  }

  function restoreHotkeys() {
    graceTimer = 0;
    if (hotkeysOff) { ctx.hotkeys(true); hotkeysOff = false; }
  }

  function end() {
    const score = scoreOf();
    const m = Math.floor(st.m);
    L.stage.classList.remove('playing');
    wrap.classList.remove('playing');
    graceTimer = setTimeout(restoreHotkeys, GRACE_MS);
    const saved = submitResult(meta, score);
    renderBest();
    // Çok erken: tek bir kule bile geçilmedi
    const early = st.passed === 0;
    st.early = early;
    if (early) {
      ctx.fx.stamp('DOG DOG DOG');
      ctx.sound.bark(1, 0.15);
    }
    const causeTxt = st.cause === 'river' ? 'Nehre daldın.' : 'Kuleye selam verdin.';
    let quip;
    if (score >= 1500) quip = 'Kurye bu hızla Roshan çukuruna bile bottle yetiştirir. 1vDOQUZ onaylı teslimat.';
    else if (score >= 800) quip = 'Rünler dolu, bottle’lar taze. Mid’ci sana bir teşekkür borçlu.';
    else if (score >= 400) quip = `Sağlam teslimat. ${causeTxt} Birkaç kule daha ve efsane kurye sensin.`;
    else if (score >= 150) quip = `Kurye yolda… ${causeTxt} Ritmi tut: boşluğun biraz altında kal.`;
    else if (!early) quip = `${causeTxt} Kısa kısa dokun, kuryeyi boşluğun ortasında tut.`;
    else quip = 'DOG DOG DOG. Kurye fountain’dan çıkamadı; mid’ci hâlâ bottle bekliyor.';
    if (st.near >= 3 && score >= 150) quip += ` ${st.near} kez kıl payı geçtin!`;
    const stats = [
      ['Mesafe', fmtM(m)],
      ['Şişe', st.bottles ? `${st.bottles} · +${st.bottles * BOTTLE_PTS} m` : '0'],
      ['Kule', fmtNum(st.passed)],
      ['En yakın sıyrık', Number.isFinite(st.closest) ? `${fmtNum(Math.max(1, Math.round(st.closest * 10)))} cm` : '—'],
      ['Tango', st.tangoUsed ? `${st.tangoUsed} can` : '—'],
      ['Uçuş', `${st.t.toFixed(1).replace('.', ',')} sn`],
    ];
    say(`Kurye öldü. ${score} metre.`);
    const my = st;
    runner.after(1.0, () => {
      if (st !== my || st.mode !== 'dead') return;
      const { node } = resultCard(meta, {
        score,
        saved,
        stats,
        quip,
        title: 'Kurye öldü!',
        onRetry: start,
        onBack: () => nav && nav.back(),
      });
      closeOverlay = showOverlay(L.stage, node, { reveal: true });
    });
  }

  // Yalnızca geliştirme sunucusunda: uçtan uca test botunun kule boşluklarını okuyabilmesi için
  if (import.meta.env && import.meta.env.DEV) {
    window.__kuryeDebug = () => {
      if (!st) return null;
      const d = diffAt(st.m);
      return {
        mode: st.mode, paused: st.paused, y: st.y, vy: st.vy, x: cxOf(), r: HIT_R, H, W, riverY: RIVER_Y,
        g: GRAV, flapV: FLAP_V, speed: d.speed * (st.turbo > 0 ? TURBO_K : 1), m: st.m, score: scoreOf(),
        turbo: st.turbo, grace: st.grace, tango: st.tango, bottles: st.bottles, passed: st.passed,
        pillars: st.pillars.map((p) => ({ side: p.side, x: p.x, w: p.w, top: gapC(p) - p.gap / 2, bot: gapC(p) + p.gap / 2, amp: p.amp, vy: p.amp ? Math.cos(p.ph) * p.amp * 2.2 : 0 })),
      };
    };
  }

  startDemo();
  resize(true);
  closeOverlay = showOverlay(L.stage, introCard(meta, {
    onStart: start,
    note: 'Başla’ya bastıktan sonra kurye havada bekler; ilk dokunuşla uçuş başlar. Sekme değişirse oyun durur.',
  }));

  return () => {
    if (st) st.mode = 'gone';
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onWinResize);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVis);
    wrap.removeEventListener('pointerdown', onPointerDown);
    if (graceTimer) clearTimeout(graceTimer);
    ro.disconnect();
    io.disconnect();
    if (runner) runner.destroy();
    runner = null;
    if (hotkeysOff) { ctx.hotkeys(true); hotkeysOff = false; }
    if (import.meta.env && import.meta.env.DEV) delete window.__kuryeDebug;
    st = null;
    sky = null;
    tiles = null;
    glows = null;
    if (closeOverlay) closeOverlay();
    L.destroy();
  };
}
