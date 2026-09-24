// Last Hit Ustası — yan görünüm koridor, creep dövüşü ve son vuruş zamanlaması (canvas).

import { h, pick, rand, randInt, clamp, lerp, fmtNum, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { ARCHETYPES } from '../../data/archetypes.js';
import { createRunner, gameLayout, hudStat, showOverlay, introCard, resultCard, isTyping, tok, hexA } from './kit.js';

const ROUND = 60;
const WAVE_EVERY = 15;
const HERO_DMG = [50, 56];
const WINDUP = 0.12;
const ARROW_TIME = 0.23; // toplam ≈ 0.35 sn
const HERO_CD = 0.8;
const DENY_BONUS = 12;
const H = 380;

const TYPES = {
  melee: { hp: 300, dmg: [18, 23], range: 38, interval: 1.0, speed: 60, w: 34, h: 46, bounty: [36, 42] },
  ranged: { hp: 220, dmg: [20, 26], range: 128, interval: 1.05, speed: 60, w: 30, h: 46, bounty: [44, 50], proj: 360 },
};

const STEALERS = ['farm', 'ward'];

export const meta = {
  id: 'lasthit',
  name: 'Last Hit Ustası',
  short: 'Last Hit',
  icon: 'coin',
  color: 'var(--aegis)',
  kind: 'Hedefli · Tek hedef',
  blurb: 'Creep’in son vuruşunu zamanla, altını topla, müttefik creep’i deny et.',
  time: '60 sn',
  diff: 3,
  unit: 'altın',
  higherIsBetter: true,
  format: (n) => `${fmtNum(n)} altın`,
  rules: [
    'Creep’e dokun: okun ~0,35 sn sonra 50–56 hasar vurur. Öldürürsen last hit ve altın.',
    'Canı %50’nin altındaki müttefik creep’i öldür: deny (+12 bonus).',
    'Erken vurursan creep ölmez, geç kalırsan başkası öldürür: ikisi de ıska.',
    'DOG takım arkadaşın da boş durmuyor: last hit’ini çalabilir. 60 saniye.',
  ],
  keys: [['Tık / dokun', 'Creep’e vur'], ['← →', 'Hedef seç'], ['Boşluk veya Enter', 'Seçili hedefe vur']],
};

export function mount(el, ctx, nav) {
  const L = gameLayout(el, meta, { nav });
  const reduced = prefersReducedMotion();

  // ---------------------------------------------------------------- HUD
  const sTime = hudStat('Süre', '60', { ico: 'hourglass', cls: 'gm-stat-time' });
  const sLH = hudStat('LH', '0', { ico: 'coin' });
  const sDN = hudStat('DN', '0', { ico: 'shield' });
  const sGold = hudStat('Altın', '0', { ico: 'coin', cls: 'gm-stat-score' });
  const cdEl = h('span', { class: 'gm-lh-cd', title: 'Saldırı hazır mı?', 'aria-hidden': 'true' }, icon('bow', { size: 22 }), h('span', { class: 'gm-lh-cd-sweep' }));
  const timeBar = h('span', { class: 'gm-timebar', 'aria-hidden': 'true' }, h('span'));
  sTime.el.appendChild(timeBar);
  L.hud.append(sTime.el, sLH.el, sDN.el, sGold.el, cdEl);

  // ---------------------------------------------------------------- sahne
  const canvas = h('canvas', {
    class: 'gm-lh-canvas',
    tabindex: '0',
    role: 'application',
    'aria-label': 'Last Hit koridoru. Creep’e tıkla ya da ok tuşlarıyla hedef seçip boşlukla vur.',
  });
  const feed = h('ol', { class: 'gm-lh-feed', 'aria-hidden': 'true' });
  const wrap = h('div', { class: 'gm-lh-wrap' }, canvas, feed);
  L.stage.appendChild(wrap);
  const g2 = canvas.getContext('2d');

  // Renkler jetonlardan
  const C = {};
  function readColors() {
    for (const k of ['bg', 'bg-2', 'bg-3', 'bg-4', 'line', 'line-2', 'text', 'text-2', 'text-3', 'ember', 'ember-2', 'ember-deep', 'aegis', 'aegis-2', 'radiant', 'radiant-deep', 'dire', 'dire-deep', 'arcane']) {
      C[k] = tok('--' + k);
    }
  }
  readColors();

  let Lw = 760;
  let scale = 1;
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  let bgCache = null;

  function resize(force = false) {
    const w = Math.round(wrap.clientWidth);
    if (!w || (w === cssW && !force)) return;
    cssW = w;
    if (!st || st.mode !== 'play') Lw = w < 600 ? 480 : 760;
    scale = cssW / Lw;
    cssH = Math.round(H * scale);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = cssH + 'px';
    bgCache = null;
    draw();
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(wrap);

  let visible = true;
  const io = new IntersectionObserver((ents) => { visible = ents.some((e) => e.isIntersecting); });
  io.observe(wrap);

  // ---------------------------------------------------------------- simülasyon durumu
  let st = null;
  let runner = null;
  let closeOverlay = null;
  let hover = null;
  let selected = null;
  let seq = 0;

  const layout = () => ({
    rows: [H * 0.585, H * 0.665, H * 0.745],
    center: Lw * (Lw < 600 ? 0.56 : 0.54),
    hero: { x: Lw < 600 ? 34 : 64, y: H * 0.9 },
    mate: { x: Lw < 600 ? 92 : 140, y: H * 0.93 },
  });

  function newState(mode) {
    return {
      mode, // 'demo' | 'play' | 'end'
      t: 0,
      creeps: [],
      shots: [],
      floats: [],
      sparks: [],
      nextWave: 0,
      waves: 0,
      lh: 0, dn: 0, gold: 0, attacks: 0, misses: 0, stolen: 0, early: 0, late: 0,
      heroCd: 0,
      heroAnim: 0,
      nextSteal: rand(9, 13),
      mate: pick(ARCHETYPES.filter((a) => STEALERS.includes(a.id))),
      mateAnim: 0,
      bubble: null,
    };
  }

  function spawnWave() {
    const lay = layout();
    for (const side of ['ally', 'enemy']) {
      const dir = side === 'ally' ? 1 : -1;
      const x0 = side === 'ally' ? -30 : Lw + 30;
      [0, 1, 2].forEach((row, i) => addCreep(side, 'melee', x0 - dir * i * 16, lay.rows[row]));
      addCreep(side, 'ranged', x0 - dir * 70, (lay.rows[0] + lay.rows[1]) / 2);
    }
    st.waves++;
  }

  function addCreep(side, type, x, y) {
    const T = TYPES[type];
    st.creeps.push({
      id: ++seq, side, type, T, x, y, baseY: y,
      hp: T.hp, maxHp: T.hp, ghost: T.hp,
      atkCd: rand(0.1, 0.5), windup: 0, target: null,
      dead: false, deathT: 0, flash: 0, bob: rand(0, 6.28),
      killer: null,
    });
  }

  const alive = (c) => c && !c.dead;
  const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) * 0.35;

  function damage(c, amt, by) {
    if (!alive(c)) return false;
    c.hp -= amt;
    c.flash = 0.1;
    if (c.hp <= 0) {
      c.hp = 0;
      c.dead = true;
      c.killer = by;
      if (selected === c) selected = null;
      return true;
    }
    return false;
  }

  function stepCreeps(dt) {
    const lay = layout();
    for (const c of st.creeps) {
      if (c.dead) { c.deathT += dt; continue; }
      c.flash = Math.max(0, c.flash - dt);
      c.ghost = Math.max(c.hp, c.ghost - dt * 90);
      c.atkCd -= dt;
      c.bob += dt * 6;
      if (c.windup > 0) {
        c.windup -= dt;
        if (c.windup <= 0) {
          const tg = c.target;
          if (alive(tg)) {
            if (c.type === 'melee') damage(tg, randInt(c.T.dmg[0], c.T.dmg[1]), 'creep');
            else st.shots.push({ kind: 'creep', side: c.side, x: c.x + (c.side === 'ally' ? 12 : -12), y: c.y - 34, target: tg, dmg: randInt(c.T.dmg[0], c.T.dmg[1]), speed: c.T.proj });
          }
        }
        continue;
      }
      if (!alive(c.target) || Math.random() < dt * 0.5) {
        let best = null;
        let bd = 320;
        for (const o of st.creeps) {
          if (o.side === c.side || o.dead) continue;
          const d = dist(c, o);
          if (d < bd) { bd = d; best = o; }
        }
        c.target = best;
      }
      const dir = c.side === 'ally' ? 1 : -1;
      const tg = c.target;
      if (tg && dist(c, tg) <= c.T.range) {
        if (c.atkCd <= 0) {
          c.windup = 0.22;
          c.atkCd = c.T.interval * rand(0.92, 1.08);
        }
      } else {
        // Sırada bekleme: aynı sıradaki müttefik önünde çok yakınsa dur
        let blocked = false;
        for (const o of st.creeps) {
          if (o === c || o.dead || o.side !== c.side) continue;
          const ahead = (o.x - c.x) * dir;
          if (ahead > 0 && ahead < 26 && Math.abs(o.y - c.y) < 14) { blocked = true; break; }
        }
        if (!blocked) c.x += dir * c.T.speed * dt;
        const ty = tg ? lerp(c.baseY, tg.y, 0.25) : c.baseY;
        c.y += (ty - c.y) * Math.min(1, dt * 2);
      }
      if (c.x > Lw + 60 || c.x < -60) { c.dead = true; c.deathT = 9; }
    }
    st.creeps = st.creeps.filter((c) => !c.dead || c.deathT < 0.8);
    void lay;
  }

  function stepShots(dt) {
    const lay = layout();
    for (const s of st.shots) {
      if (s.kind === 'creep') {
        const tg = s.target;
        if (!alive(tg)) { s.done = true; continue; }
        const tx = tg.x, ty = tg.y - 26;
        const dx = tx - s.x, dy = ty - s.y;
        const d = Math.hypot(dx, dy);
        const step = s.speed * dt;
        if (d <= step) { s.done = true; damage(tg, s.dmg, 'creep'); }
        else { s.x += (dx / d) * step; s.y += (dy / d) * step; }
      } else {
        // Oyuncunun oku ya da DOG takım arkadaşının "pati mermisi": sabit süreli, hedefe güdümlü
        s.t += dt;
        const tg = s.target;
        if (tg) { s.tx = tg.x; s.ty = tg.y - 26; }
        const k = clamp(s.t / s.dur, 0, 1);
        s.x = lerp(s.x0, s.tx, k);
        s.y = lerp(s.y0, s.ty, k) - Math.sin(k * Math.PI) * (s.kind === 'hero' ? 40 : 26);
        s.ang = Math.atan2(s.ty - s.y0 - Math.cos(k * Math.PI) * 40, s.tx - s.x0);
        if (k >= 1) { s.done = true; impact(s); }
      }
    }
    st.shots = st.shots.filter((s) => !s.done);
    void lay;
  }

  function impact(s) {
    const tg = s.target;
    if (s.kind === 'dog') {
      if (alive(tg)) {
        damage(tg, tg.hp, 'dog');
        st.stolen++;
        floatAt(tg.x, tg.y - 60, 'ÇALINDI', C.ember, 15);
        pushFeed(`${st.mate.name} senin last hit’ini yedi`, 'ember');
        st.bubble = { text: 'benim o!', t: 1.6 };
        ctx.sound.bark(0.85);
        say(`${st.mate.name} senin last hit’ini yedi.`);
      }
      return;
    }
    // Oyuncu oku
    if (!alive(tg)) {
      st.misses++;
      st.late++;
      floatAt(s.tx, s.ty - 30, 'Iska · geç', C['text-2'], 14);
      pushFeed('Iska: creep çoktan ölmüştü', 'dim');
      ctx.sound.miss();
      return;
    }
    const dmg = randInt(HERO_DMG[0], HERO_DMG[1]);
    const killed = damage(tg, dmg, 'hero');
    if (!killed) {
      st.misses++;
      st.early++;
      floatAt(tg.x, tg.y - 64, 'Iska · erken', C['text-2'], 14);
      pushFeed(`Erken vurdun (−${dmg} can)`, 'dim');
      ctx.sound.hit();
      return;
    }
    if (tg.side === 'enemy') {
      const b = randInt(tg.T.bounty[0], tg.T.bounty[1]);
      st.lh++;
      st.gold += b;
      floatAt(tg.x, tg.y - 64, `+${b}`, C.aegis, 20);
      burst(tg.x, tg.y - 30, C.aegis, 14);
      pushFeed(`Last hit! +${b} altın`, 'gold');
      ctx.sound.coin();
      sLH.set(st.lh); sLH.bump();
      sGold.set(fmtNum(st.gold)); sGold.bump();
      say(`Last hit. ${st.lh} last hit, ${st.gold} altın.`);
    } else {
      st.dn++;
      st.gold += DENY_BONUS;
      floatAt(tg.x, tg.y - 64, '!', C.text, 34);
      floatAt(tg.x, tg.y - 92, 'DENY', C.radiant, 14);
      burst(tg.x, tg.y - 30, C.radiant, 10);
      pushFeed(`Deny! +${DENY_BONUS} bonus`, 'jade');
      ctx.sound.good();
      sDN.set(st.dn); sDN.bump();
      sGold.set(fmtNum(st.gold));
      say(`Deny. ${st.dn} deny.`);
    }
  }

  function stepSteal() {
    if (st.mode !== 'play' || st.t < st.nextSteal) return;
    const lay = layout();
    const prey = st.creeps.filter((c) => alive(c) && c.side === 'enemy' && c.hp <= 64 && !st.shots.some((s) => s.kind === 'dog' && s.target === c));
    if (!prey.length) return;
    const tg = pick(prey);
    st.shots.push({ kind: 'dog', target: tg, t: 0, dur: 0.26, x0: lay.mate.x + 8, y0: lay.mate.y - 36, x: lay.mate.x, y: lay.mate.y, tx: tg.x, ty: tg.y - 26 });
    st.mateAnim = 0.3;
    st.nextSteal = st.t + rand(9, 14);
  }

  function heroAttack(c) {
    if (!st || st.mode !== 'play' || !alive(c)) return;
    const lay = layout();
    if (st.heroCd > 0) {
      floatAt(lay.hero.x + 10, lay.hero.y - 70, 'Bekle', C['text-3'], 12);
      return;
    }
    if (c.side === 'ally' && c.hp / c.maxHp >= 0.5) {
      floatAt(c.x, c.y - 64, 'Deny için can %50 altı olmalı', C['text-2'], 12);
      ctx.sound.miss();
      return;
    }
    st.heroCd = HERO_CD;
    st.heroAnim = WINDUP + 0.1;
    st.attacks++;
    ctx.sound.whoosh();
    runner.after(WINDUP, () => {
      if (!st || st.mode === 'dead') return;
      st.shots.push({ kind: 'hero', target: c, t: 0, dur: ARROW_TIME, x0: lay.hero.x + 18, y0: lay.hero.y - 44, x: lay.hero.x, y: lay.hero.y, tx: c.x, ty: c.y - 26, ang: 0 });
    });
  }

  // ---------------------------------------------------------------- efekt yardımcıları
  function floatAt(x, y, text, color, size = 16) {
    st.floats.push({ x, y, text, color, size, t: 0, dur: 1.1 });
  }
  function burst(x, y, color, n) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI, 0);
      const sp = rand(60, 180);
      st.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, dur: rand(0.4, 0.8), color });
    }
  }
  function pushFeed(text, kind) {
    const li = h('li', { class: `gm-lh-feed-item ${kind || ''}` }, text);
    feed.prepend(li);
    while (feed.children.length > 3) feed.lastChild.remove();
    const id = setTimeout(() => li.classList.add('gone'), 2600);
    feedTimers.add(id);
  }
  const feedTimers = new Set();
  function say(msg) { L.live.textContent = msg; }

  // ---------------------------------------------------------------- çizim
  function buildBg() {
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    const g = c.getContext('2d');
    g.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    // Gökyüzü
    const sky = g.createLinearGradient(0, 0, 0, H * 0.6);
    sky.addColorStop(0, C.bg);
    sky.addColorStop(1, C['bg-3']);
    g.fillStyle = sky;
    g.fillRect(0, 0, Lw, H);
    // Ay
    const mx = Lw * 0.8, my = H * 0.16;
    const moon = g.createRadialGradient(mx, my, 2, mx, my, 70);
    moon.addColorStop(0, hexA(C['aegis-2'], 0.9));
    moon.addColorStop(0.18, hexA(C['aegis-2'], 0.55));
    moon.addColorStop(0.2, hexA(C.aegis, 0.12));
    moon.addColorStop(1, hexA(C.aegis, 0));
    g.fillStyle = moon;
    g.fillRect(mx - 80, my - 80, 160, 160);
    // Yıldızlar
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    g.fillStyle = hexA(C.text, 0.5);
    for (let i = 0; i < 40; i++) g.fillRect(rnd() * Lw, rnd() * H * 0.4, 1.2, 1.2);
    // Uzak tepeler: sol Radiant, sağ Dire tonu
    const hill = (yb, amp, colL, colR, a) => {
      const gr = g.createLinearGradient(0, 0, Lw, 0);
      gr.addColorStop(0, hexA(colL, a));
      gr.addColorStop(0.5, hexA(C['bg-4'], a));
      gr.addColorStop(1, hexA(colR, a));
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= Lw; x += 20) g.lineTo(x, yb - Math.sin(x * 0.013 + amp) * 16 - Math.sin(x * 0.041) * 7);
      g.lineTo(Lw, H);
      g.fill();
    };
    hill(H * 0.44, 1, C['radiant-deep'], C['dire-deep'], 0.55);
    hill(H * 0.5, 3, C['radiant-deep'], C['dire-deep'], 0.8);
    // Ağaçlar: Radiant çamları, Dire kuru ağaçları
    for (let i = 0; i < 16; i++) {
      const x = rnd() * Lw;
      const y = H * 0.5 + rnd() * 10;
      const s = 16 + rnd() * 16;
      if (x < Lw * 0.5) {
        g.fillStyle = hexA(C['radiant-deep'], 0.9);
        g.beginPath(); g.moveTo(x, y - s * 2); g.lineTo(x - s * 0.6, y); g.lineTo(x + s * 0.6, y); g.fill();
      } else {
        g.strokeStyle = hexA(C['dire-deep'], 0.95);
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - s * 1.6); g.moveTo(x, y - s); g.lineTo(x - s * 0.5, y - s * 1.5); g.moveTo(x, y - s * 1.2); g.lineTo(x + s * 0.4, y - s * 1.8); g.stroke();
      }
    }
    // Koridor zemini
    const gy = H * 0.53;
    const ground = g.createLinearGradient(0, gy, 0, H);
    ground.addColorStop(0, C['bg-3']);
    ground.addColorStop(1, C['bg-2']);
    g.fillStyle = ground;
    g.fillRect(0, gy, Lw, H - gy);
    // Toz yol bandı
    const path = g.createLinearGradient(0, H * 0.56, 0, H * 0.8);
    path.addColorStop(0, hexA(C['ember-deep'], 0.0));
    path.addColorStop(0.3, hexA(C['ember-deep'], 0.14));
    path.addColorStop(0.7, hexA(C['ember-deep'], 0.14));
    path.addColorStop(1, hexA(C['ember-deep'], 0));
    g.fillStyle = path;
    g.fillRect(0, H * 0.56, Lw, H * 0.24);
    // Taşlar
    for (let i = 0; i < 28; i++) {
      g.fillStyle = hexA(C['line-2'], 0.35 + rnd() * 0.3);
      g.beginPath();
      g.ellipse(rnd() * Lw, H * 0.56 + rnd() * H * 0.4, 2 + rnd() * 5, 1 + rnd() * 2, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Kule siluetleri (kenarlarda)
    const tower = (x, col) => {
      g.fillStyle = hexA(C.bg, 0.85);
      g.fillRect(x - 12, H * 0.28, 24, H * 0.3);
      g.beginPath(); g.moveTo(x - 20, H * 0.3); g.lineTo(x, H * 0.18); g.lineTo(x + 20, H * 0.3); g.fill();
      const glow = g.createRadialGradient(x, H * 0.24, 1, x, H * 0.24, 22);
      glow.addColorStop(0, hexA(col, 0.9));
      glow.addColorStop(1, hexA(col, 0));
      g.fillStyle = glow;
      g.fillRect(x - 24, H * 0.24 - 24, 48, 48);
    };
    tower(-4, C.radiant);
    tower(Lw + 4, C.dire);
    return c;
  }

  function drawCreep(g, c) {
    const dir = c.side === 'ally' ? 1 : -1;
    const base = c.side === 'ally' ? C['radiant-deep'] : C['dire-deep'];
    const acc = c.side === 'ally' ? C.radiant : C.dire;
    const fade = c.dead ? Math.max(0, 1 - c.deathT / 0.8) : 1;
    const sink = c.dead ? c.deathT * 16 : 0;
    const lunge = c.windup > 0 ? Math.sin((1 - c.windup / 0.22) * Math.PI) * 6 : 0;
    const bob = c.dead ? 0 : Math.sin(c.bob) * 1.2;
    const { w, h: ht } = c.T;
    g.save();
    g.globalAlpha = fade;
    // Gölge
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.beginPath(); g.ellipse(c.x, c.y + 2, w * 0.55, 5, 0, 0, Math.PI * 2); g.fill();
    // Seçim / üzerine gelme halkası
    if (!c.dead && (c === hover || c === selected)) {
      g.strokeStyle = c === selected ? C.aegis : hexA(C.aegis, 0.7);
      g.lineWidth = 2;
      g.beginPath(); g.ellipse(c.x, c.y + 2, w * 0.75, 8, 0, 0, Math.PI * 2); g.stroke();
    }
    g.translate(c.x + dir * lunge, c.y + sink + bob);
    g.scale(dir, 1);
    if (c.type === 'melee') {
      // bacaklar
      g.fillStyle = C.bg;
      g.fillRect(-9, -10, 6, 10);
      g.fillRect(3, -10, 6, 10);
      // gövde
      g.fillStyle = base;
      roundRect(g, -w / 2, -ht + 12, w, ht - 20, 7);
      g.fill();
      g.strokeStyle = hexA(C.bg, 0.8);
      g.lineWidth = 1.5;
      g.stroke();
      // kemer
      g.fillStyle = hexA(acc, 0.8);
      g.fillRect(-w / 2, -16, w, 3);
      // kafa + miğfer
      g.fillStyle = base;
      g.beginPath(); g.arc(2, -ht + 6, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = acc;
      if (c.side === 'ally') {
        g.beginPath(); g.arc(2, -ht + 4, 9, Math.PI, 0); g.fill();
      } else {
        g.beginPath(); g.moveTo(-5, -ht + 1); g.lineTo(-9, -ht - 9); g.lineTo(-1, -ht - 1); g.fill();
        g.beginPath(); g.moveTo(7, -ht + 1); g.lineTo(11, -ht - 9); g.lineTo(3, -ht - 1); g.fill();
      }
      g.fillStyle = C['aegis-2'];
      g.fillRect(5, -ht + 5, 3, 2);
      // kalkan
      g.fillStyle = hexA(acc, 0.9);
      g.beginPath(); g.ellipse(w / 2 - 2, -ht / 2 + 2, 6, 11, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = hexA(C.bg, 0.8);
      g.stroke();
      // silah
      g.strokeStyle = C['text-2'];
      g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(-w / 2 + 2, -ht / 2); g.lineTo(-w / 2 - 6 + lunge, -ht + 2); g.stroke();
    } else {
      // cüppe
      g.fillStyle = base;
      g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(0, -ht + 10); g.lineTo(w / 2, 0); g.closePath(); g.fill();
      g.strokeStyle = hexA(C.bg, 0.8);
      g.lineWidth = 1.5;
      g.stroke();
      // kapüşon
      g.fillStyle = base;
      g.beginPath(); g.arc(0, -ht + 10, 8, 0, Math.PI * 2); g.fill();
      g.fillStyle = C['aegis-2'];
      g.fillRect(2, -ht + 9, 3, 2);
      // asa + küre
      g.strokeStyle = C['text-3'];
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(10, -2); g.lineTo(12, -ht + 2); g.stroke();
      const orb = g.createRadialGradient(12, -ht, 0, 12, -ht, 9);
      orb.addColorStop(0, C.text);
      orb.addColorStop(0.35, acc);
      orb.addColorStop(1, hexA(acc, 0));
      g.fillStyle = orb;
      g.beginPath(); g.arc(12, -ht, 9, 0, Math.PI * 2); g.fill();
    }
    // Hasar parlaması
    if (c.flash > 0) {
      g.globalAlpha = fade * (c.flash / 0.1) * 0.6;
      g.fillStyle = C.text;
      roundRect(g, -w / 2, -ht + 2, w, ht - 4, 7);
      g.fill();
    }
    g.restore();
    // Can çubuğu (düz, çevrilmeden)
    if (!c.dead) {
      const bw = 42, bh = 6;
      const bx = c.x - bw / 2, by = c.y - ht - 16 + bob;
      g.fillStyle = 'rgba(0,0,0,0.75)';
      g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      g.fillStyle = hexA(C.text, 0.55);
      g.fillRect(bx, by, bw * (c.ghost / c.maxHp), bh);
      g.fillStyle = c.side === 'ally' ? C.radiant : C.dire;
      g.fillRect(bx, by, bw * (c.hp / c.maxHp), bh);
      g.fillStyle = 'rgba(0,0,0,0.55)';
      for (let v = 100; v < c.maxHp; v += 100) g.fillRect(bx + bw * (v / c.maxHp), by, 1, bh);
      if (c.side === 'ally' && c.hp / c.maxHp < 0.5) {
        // Deny edilebilir işareti
        g.fillStyle = hexA(C.radiant, 0.9);
        g.fillRect(bx + bw + 3, by, 2, bh);
      }
    }
  }

  function drawHero(g, lay) {
    const { x, y } = lay.hero;
    const pull = st && st.heroAnim > 0 ? Math.sin(clamp(st.heroAnim / (WINDUP + 0.1), 0, 1) * Math.PI) : 0;
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath(); g.ellipse(x, y + 2, 20, 6, 0, 0, Math.PI * 2); g.fill();
    // pelerin
    g.fillStyle = C['bg-4'];
    g.beginPath(); g.moveTo(x - 16, y); g.lineTo(x - 4, y - 50); g.lineTo(x + 12, y); g.closePath(); g.fill();
    g.fillStyle = hexA(C.arcane, 0.85);
    g.beginPath(); g.moveTo(x - 12, y - 2); g.lineTo(x - 2, y - 46); g.lineTo(x + 8, y - 2); g.closePath(); g.fill();
    // kapüşon
    g.fillStyle = C['bg-4'];
    g.beginPath(); g.arc(x - 1, y - 52, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.aegis;
    g.fillRect(x + 3, y - 53, 4, 2);
    // yay
    const bx = x + 16;
    g.strokeStyle = C.aegis;
    g.lineWidth = 3;
    g.beginPath(); g.arc(bx - 8, y - 42, 20, -1.1, 1.1); g.stroke();
    g.strokeStyle = hexA(C.text, 0.8);
    g.lineWidth = 1;
    const sx = bx - 8 + Math.cos(1.1) * 20;
    g.beginPath(); g.moveTo(sx, y - 42 - Math.sin(1.1) * 20); g.lineTo(bx - 14 - pull * 8, y - 42); g.lineTo(sx, y - 42 + Math.sin(1.1) * 20); g.stroke();
    // etiket
    g.fillStyle = C.aegis;
    g.font = `700 11px ${'JetBrains Mono'}, monospace`;
    g.textAlign = 'center';
    g.fillText('SEN', x, y - 70);
    g.restore();
  }

  function drawMate(g, lay) {
    const { x, y } = lay.mate;
    const col = (st && st.mate && st.mate.color) || C.ember;
    const hop = st && st.mateAnim > 0 ? Math.sin((st.mateAnim / 0.3) * Math.PI) * 6 : 0;
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath(); g.ellipse(x, y + 2, 16, 5, 0, 0, Math.PI * 2); g.fill();
    g.translate(x, y - hop);
    // gövde
    g.fillStyle = C['bg-4'];
    roundRect(g, -14, -26, 28, 22, 9);
    g.fill();
    g.fillStyle = col;
    g.fillRect(-14, -12, 28, 3); // fular
    // kafa
    g.fillStyle = C['bg-4'];
    g.beginPath(); g.arc(4, -36, 12, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-4, -44); g.lineTo(-10, -56); g.lineTo(1, -47); g.fill();
    g.beginPath(); g.moveTo(10, -45); g.lineTo(15, -57); g.lineTo(14, -43); g.fill();
    g.fillStyle = col;
    g.beginPath(); g.arc(9, -37, 2.2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(1, -37, 2.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.bg;
    g.beginPath(); g.ellipse(12, -31, 4, 3, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    // isim
    g.save();
    g.font = `700 10px ${'JetBrains Mono'}, monospace`;
    g.textAlign = 'center';
    g.fillStyle = hexA(C.ember, 0.95);
    g.fillText(st && st.mate ? st.mate.name.replace(' Köpeği', ' DOG').toUpperCase() : 'DOG', x + 4, y + 14 > H - 4 ? y - 66 : y + 14);
    if (st && st.bubble && st.bubble.t > 0) {
      const bx = x + 30, by = y - 70;
      g.font = '700 12px Barlow, sans-serif';
      const tw = g.measureText(st.bubble.text).width + 14;
      g.fillStyle = hexA(C.text, 0.95);
      roundRect(g, bx - 4, by - 14, tw, 20, 6);
      g.fill();
      g.beginPath(); g.moveTo(bx + 2, by + 6); g.lineTo(bx - 6, by + 14); g.lineTo(bx + 10, by + 6); g.fill();
      g.fillStyle = C.bg;
      g.textAlign = 'left';
      g.fillText(st.bubble.text, bx + 3, by);
    }
    g.restore();
  }

  function drawShot(g, s) {
    g.save();
    if (s.kind === 'hero') {
      g.translate(s.x, s.y);
      const k = clamp(s.t / s.dur, 0, 1);
      const vy = (s.ty - s.y0) / s.dur - Math.cos(k * Math.PI) * Math.PI * 40 / s.dur;
      const vx = (s.tx - s.x0) / s.dur;
      g.rotate(Math.atan2(vy, vx));
      g.strokeStyle = C['aegis-2'];
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(-16, 0); g.lineTo(6, 0); g.stroke();
      g.fillStyle = C.aegis;
      g.beginPath(); g.moveTo(10, 0); g.lineTo(3, -4); g.lineTo(3, 4); g.fill();
      g.fillStyle = hexA(C.aegis, 0.35);
      g.fillRect(-26, -1, 10, 2);
    } else if (s.kind === 'dog') {
      const col = (st.mate && st.mate.color) || C.ember;
      const gr = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, 10);
      gr.addColorStop(0, C.text);
      gr.addColorStop(0.4, col);
      gr.addColorStop(1, hexA(C.ember, 0));
      g.fillStyle = gr;
      g.beginPath(); g.arc(s.x, s.y, 10, 0, Math.PI * 2); g.fill();
    } else {
      const col = s.side === 'ally' ? C.radiant : C.dire;
      g.fillStyle = col;
      g.beginPath(); g.arc(s.x, s.y, 3.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = hexA(col, 0.3);
      g.beginPath(); g.arc(s.x, s.y, 7, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function draw() {
    if (!cssW || !st) return;
    const g = g2;
    if (!bgCache) bgCache = buildBg();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bgCache, 0, 0);
    g.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    const lay = layout();
    // Derinlik sırası
    const items = st.creeps.slice().sort((a, b) => a.y - b.y);
    for (const c of items) drawCreep(g, c);
    drawMate(g, lay);
    drawHero(g, lay);
    for (const s of st.shots) drawShot(g, s);
    for (const p of st.sparks) {
      g.globalAlpha = Math.max(0, 1 - p.t / p.dur);
      g.fillStyle = p.color;
      g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    g.globalAlpha = 1;
    g.textAlign = 'center';
    for (const f of st.floats) {
      const k = f.t / f.dur;
      g.globalAlpha = Math.max(0, 1 - k * k);
      g.font = `900 ${f.size}px Unbounded, 'Arial Black', sans-serif`;
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(0,0,0,0.7)';
      g.strokeText(f.text, f.x, f.y - k * 26);
      g.fillStyle = f.color;
      g.fillText(f.text, f.x, f.y - k * 26);
    }
    g.globalAlpha = 1;
    if (st.mode === 'demo') {
      g.fillStyle = hexA(C.bg, 0.25);
      g.fillRect(0, 0, Lw, H);
    }
  }

  function roundRect(g, x, y, w, hh, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + hh, r);
    g.arcTo(x + w, y + hh, x, y + hh, r);
    g.arcTo(x, y + hh, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // ---------------------------------------------------------------- döngü
  function frame(dt) {
    if (!st) return;
    st.t += dt;
    if (st.mode === 'demo' || st.mode === 'end') {
      if (st.t >= st.nextWave) { spawnWave(); st.nextWave = st.t + WAVE_EVERY; }
    } else if (st.mode === 'play') {
      const left = Math.max(0, ROUND - st.t);
      sTime.set(String(Math.ceil(left)));
      timeBar.firstChild.style.transform = `scaleX(${left / ROUND})`;
      sTime.el.classList.toggle('low', left <= 10);
      if (left <= 5 && Math.ceil(left) !== st.lastTick) { st.lastTick = Math.ceil(left); ctx.sound.tick(); }
      if (st.t >= st.nextWave && st.t < ROUND - 3) { spawnWave(); st.nextWave = st.t + WAVE_EVERY; }
      stepSteal();
      if (left <= 0) end();
    }
    st.heroCd = Math.max(0, st.heroCd - dt);
    st.heroAnim = Math.max(0, st.heroAnim - dt);
    st.mateAnim = Math.max(0, st.mateAnim - dt);
    if (st.bubble) st.bubble.t -= dt;
    cdEl.style.setProperty('--cd', `${(st.heroCd / HERO_CD) * 100}%`);
    cdEl.classList.toggle('ready', st.heroCd <= 0);
    stepCreeps(dt);
    stepShots(dt);
    for (const p of st.sparks) { p.t += dt; p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    st.sparks = st.sparks.filter((p) => p.t < p.dur);
    for (const f of st.floats) f.t += dt;
    st.floats = st.floats.filter((f) => f.t < f.dur);
    if (visible) draw();
  }

  // ---------------------------------------------------------------- giriş
  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * Lw, y: ((e.clientY - r.top) / r.height) * H };
  }
  function pickCreep(p) {
    if (!st) return null;
    const minHalf = 26 / scale; // en az ~52 px dokunma alanı
    let best = null;
    let bd = Infinity;
    for (const c of st.creeps) {
      if (c.dead) continue;
      const hw = Math.max(c.T.w * 0.7, minHalf);
      const top = c.y - c.T.h - 20;
      const bottom = c.y + 8;
      const cy = (top + bottom) / 2;
      const hh = Math.max((bottom - top) / 2, minHalf);
      if (Math.abs(p.x - c.x) <= hw && Math.abs(p.y - cy) <= hh) {
        const d = Math.hypot(p.x - c.x, (p.y - cy) * 0.6);
        if (d < bd) { bd = d; best = c; }
      }
    }
    return best;
  }
  function onPointerDown(e) {
    if (!st || st.mode !== 'play') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const c = pickCreep(toLogical(e));
    if (c) { selected = c; heroAttack(c); }
  }
  function onPointerMove(e) {
    if (!st || e.pointerType !== 'mouse') return;
    hover = st.mode === 'play' ? pickCreep(toLogical(e)) : null;
    canvas.style.cursor = hover ? 'crosshair' : '';
  }
  function onPointerLeave() { hover = null; }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);

  function onKey(e) {
    if (!st || st.mode !== 'play' || e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      const list = st.creeps.filter((c) => !c.dead).sort((a, b) => a.x - b.x);
      if (!list.length) return;
      let idx = selected ? list.indexOf(selected) : -1;
      if (idx < 0) idx = k === 'ArrowRight' ? -1 : list.length;
      idx = (idx + (k === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
      selected = list[idx];
      const c = selected;
      say(`${c.side === 'enemy' ? 'Düşman' : 'Müttefik'} ${c.type === 'melee' ? 'yakın dövüş' : 'menzilli'} creep, can yüzde ${Math.round((c.hp / c.maxHp) * 100)}.`);
    } else if (k === ' ' || k === 'Enter') {
      if (e.repeat) return;
      e.preventDefault();
      if (!alive(selected)) {
        // En düşük canlı düşmanı otomatik seç
        const list = st.creeps.filter((c) => !c.dead && c.side === 'enemy').sort((a, b) => a.hp - b.hp);
        selected = list[0] || null;
      }
      if (selected) heroAttack(selected);
    }
  }
  window.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- akış
  function startDemo() {
    st = newState('demo');
    st.nextWave = 0;
    if (!runner) runner = createRunner(frame);
  }

  function start() {
    if (closeOverlay) { closeOverlay(); closeOverlay = null; }
    Lw = cssW < 600 ? 480 : 760;
    resize(true);
    st = newState('play');
    st.lastTick = 99;
    selected = null;
    hover = null;
    feed.replaceChildren();
    sLH.set('0'); sDN.set('0'); sGold.set('0'); sTime.set(String(ROUND));
    if (runner) runner.destroy();
    runner = createRunner(frame);
    L.stage.classList.add('playing');
    try { canvas.focus({ preventScroll: true }); } catch { /* yok say */ }
    ctx.sound.whoosh();
    pushFeed(`Takım arkadaşın: ${st.mate.name}. Gözün üstünde olsun.`, 'ember');
    say('Last Hit başladı. 60 saniye.');
  }

  function end() {
    st.mode = 'end';
    L.stage.classList.remove('playing');
    selected = null;
    hover = null;
    const acc = st.attacks ? Math.round(((st.lh + st.dn) / st.attacks) * 100) : 0;
    const quip = st.lh >= 14
      ? 'Mid or feed? Mid. Tartışmasız mid.'
      : st.lh >= 9
        ? 'Farm grafiği yukarı bakıyor. Carry’nin gözleri doldu.'
        : st.lh >= 4
          ? `Fena değil, ama ${st.mate.name} senden daha mutlu ayrıldı.`
          : 'DOG DOG DOG. Creep’ler bile sana acıdı.';
    runner.after(0.8, () => {
      const { node } = resultCard(meta, {
        score: st.gold,
        stats: [
          ['Last hit', fmtNum(st.lh)],
          ['Deny', fmtNum(st.dn)],
          ['İsabet', `%${acc}`],
          ['Iska (erken/geç)', `${st.early}/${st.late}`],
          ['Çalınan LH', fmtNum(st.stolen)],
          ['Toplam saldırı', fmtNum(st.attacks)],
        ],
        quip,
        onRetry: start,
        onBack: () => nav && nav.back(),
      });
      closeOverlay = showOverlay(L.stage, node);
      say(`Süre bitti. ${st.lh} last hit, ${st.dn} deny, ${st.gold} altın.`);
    });
  }

  startDemo();
  resize(true);
  closeOverlay = showOverlay(L.stage, introCard(meta, { onStart: start, note: 'Arkada creep’ler çoktan dövüşüyor. Isın.' }));

  return () => {
    if (st) st.mode = 'dead';
    window.removeEventListener('keydown', onKey);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    for (const id of feedTimers) clearTimeout(id);
    feedTimers.clear();
    ro.disconnect();
    io.disconnect();
    if (runner) runner.destroy();
    runner = null;
    st = null;
    bgCache = null;
    if (closeOverlay) closeOverlay();
    L.destroy();
  };
}
