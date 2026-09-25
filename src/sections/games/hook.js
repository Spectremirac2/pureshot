// Pudge Hook — kuşbakışı nehir ve koridor sahnesi (canvas 2D). Nişan al, kancayı fırlat:
// kırmızı halkalı düşman kahramanı çek, creep teselli ikramiyesi, yeşil halkalı dosta çarparsan
// DOG DOG DOG. Kanca yoldaki ilk birime takılır; creep dalgası ve dostlar kalkan olur.

import './hook.css';
import { h, pick, rand, clamp, lerp, fmtNum, shuffle, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { HEROES } from '../../data/heroes.js';
import { heroPortraitUrl, abilityIconUrl } from '../../core/assets.js';
import { createRunner, gameLayout, hudStat, showOverlay, introCard, resultCard, submitResult, revealInView, isTyping, onOtherControl, tok, hexA } from './kit.js';

const ROUND = 60;
const COOLDOWN = 1.2;
const ENEMY_PTS = 100;
const LONG_BONUS = 50;
const LONG_K = 0.75; // menzilin bu oranı ve ötesi: uzun kanca
const CREEP_PTS = 10;
const ALLY_PEN = 50;
const DOTA_RANGE = 1300; // Meat Hook menzili (Dota birimi) — en uzun kanca istatistiği bu ölçekte
const N_ENEMY = 8;
const N_ALLY = 4;
const HOOK_R = 7;
const TAU = Math.PI * 2;
const GRACE_MS = 900;

export const meta = {
  id: 'hook',
  name: 'Pudge Hook',
  short: 'Hook',
  icon: 'hook',
  color: 'var(--dire)',
  kind: 'Beceri · Nişan',
  blurb: 'Kancayı fırlat, düşmanı çek. Dosta çarparsan klip değil DOG olur.',
  lore: 'Fresh meat! Ama önce creep dalgasının arkasına bak.',
  time: '60 sn',
  diff: 2,
  unit: 'puan',
  higherIsBetter: true,
  format: (n) => `${fmtNum(n)} puan`,
  rules: [
    'Nişan al, tıkla ya da boşluğa bas: kanca düz gider, menzilin ucundan geri döner. Dokunmatikte dokunduğun yere atar.',
    `Kırmızı halkalı düşman kahraman +${ENEMY_PTS}; menzilin ucundan çekersen +${LONG_BONUS} uzun kanca. Creep +${CREEP_PTS}.`,
    `Yeşil halkalı DOST kahramana çarparsan −${ALLY_PEN} ve DOG DOG DOG. Kanca yoldaki ilk birime takılır: creep ve dost kalkan olur.`,
    'Art arda düşman kahraman: 3’te ×2, 6’da ×3. Iska ya da dost seriyi bozar. Kanca 1,2 sn’de dolar; 60 saniye.',
  ],
  keys: [['Fare', 'Nişan al'], ['Tık veya Boşluk', 'Kancayı fırlat'], ['← →', 'Nişanı çevir'], ['Dokun', 'Oraya nişan al ve at']],
};

function cssPx(name, fallback) {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}

/** P noktasının A→B doğru parçasına uzaklığı ve parça üzerindeki oranı. */
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const len2 = vx * vx + vy * vy || 1;
  const u = clamp(((px - ax) * vx + (py - ay) * vy) / len2, 0, 1);
  return [Math.hypot(px - (ax + vx * u), py - (ay + vy * u)), u];
}

export function mount(el, ctx, nav) {
  const L = gameLayout(el, meta, { nav });
  const reduced = prefersReducedMotion();

  // ---------------------------------------------------------------- HUD
  const sTime = hudStat('Süre', String(ROUND), { ico: 'hourglass', cls: 'gm-stat-time' });
  const sScore = hudStat('Skor', '0', { ico: 'trophy', cls: 'gm-stat-score' });
  const streakPips = h('span', { class: 'gm-hk-pips', 'aria-hidden': 'true' }, Array.from({ length: 6 }, (_, i) => h('i', { class: i === 2 || i === 5 ? 'step' : '' })));
  const sStreak = hudStat('Seri', '×1', { ico: 'flame', cls: 'gm-stat-combo' });
  sStreak.el.appendChild(streakPips);
  const timeBar = h('span', { class: 'gm-timebar', 'aria-hidden': 'true' }, h('span'));
  sTime.el.appendChild(timeBar);
  const hookIco = abilityIconUrl('pudge_meat_hook');
  const cdEl = h('span', { class: 'gm-hk-cd ready', title: 'Meat Hook hazır mı?', 'aria-hidden': 'true' },
    hookIco ? h('img', { src: hookIco, alt: '', draggable: 'false' }) : icon('hook', { size: 24 }),
    h('span', { class: 'gm-hk-cd-sweep' }),
  );
  L.hud.append(sTime.el, sScore.el, sStreak.el, cdEl);

  // ---------------------------------------------------------------- sahne
  const canvas = h('canvas', {
    class: 'gm-hk-canvas',
    tabindex: '0',
    role: 'application',
    'aria-label': 'Pudge Hook sahası. Fareyle nişan alıp tıkla ya da boşluğa bas; dokunmatikte hedefe dokun.',
  });
  const wrap = h('div', { class: 'gm-hk-wrap' }, canvas);
  L.stage.appendChild(wrap);
  const g2 = canvas.getContext('2d');

  const C = {};
  for (const k of ['bg', 'bg-2', 'bg-3', 'bg-4', 'line', 'line-2', 'text', 'text-2', 'text-3', 'ember', 'ember-2', 'ember-deep', 'aegis', 'aegis-2', 'radiant', 'radiant-deep', 'dire', 'dire-deep', 'arcane']) {
    C[k] = tok('--' + k);
  }

  // Kahraman portreleri: turda kullanılacak 12 rastgele kahraman + Pudge (önceden yüklenir)
  const imgCache = new Map();
  function loadImg(id) {
    if (imgCache.has(id)) return imgCache.get(id);
    const url = heroPortraitUrl(id);
    let im = null;
    if (url) {
      im = new Image();
      im.decoding = 'async';
      im.src = url;
    }
    imgCache.set(id, im);
    return im;
  }
  const pool = HEROES.filter((x) => x.id !== 'pudge');
  function pickHeroes() {
    const withArt = pool.filter((x) => heroPortraitUrl(x.id));
    const list = shuffle(withArt.length >= N_ENEMY + N_ALLY ? withArt : pool).slice(0, N_ENEMY + N_ALLY);
    for (const x of list) loadImg(x.id);
    return { enemies: list.slice(0, N_ENEMY), allies: list.slice(N_ENEMY) };
  }
  const pudgeImg = loadImg('pudge');

  let Lw = 800;
  let H = 480;
  let scale = 1;
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  let bgCache = null;
  let narrow = false;

  function resize(force = false) {
    const w = Math.round(wrap.clientWidth);
    if (!w || (w === cssW && !force)) return;
    cssW = w;
    narrow = w < 600;
    // Oyun sürerken mantıksal genişlik sabit kalır (hedefler yerinden oynamasın)
    if (!st || st.mode !== 'play') Lw = narrow ? 400 : 800;
    scale = cssW / Lw;
    const avail = window.innerHeight - cssPx('--hud-h', 56) - cssPx('--bar-h', 84) - 20;
    const ideal = cssW * (narrow ? 1.2 : 0.6);
    cssH = Math.round(clamp(ideal, 300, Math.max(300, avail)));
    H = cssH / scale;
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

  // ---------------------------------------------------------------- yerleşim
  function lay() {
    const small = Lw < 600;
    const pr = small ? 27 : 32;
    const pudge = { x: Lw / 2, y: H - Math.max(pr + 16, H * 0.1), r: pr };
    const lanes = [0.13, 0.31, 0.49, 0.66].map((f) => H * f);
    const R = (pudge.y - lanes[0]) * 1.13;
    return {
      small, pudge, lanes, R,
      river: [H * 0.405, H * 0.575],
      heroR: small ? 21 : 25,
      creepR: small ? 10 : 12,
    };
  }

  // ---------------------------------------------------------------- durum
  let st = null;
  let runner = null;
  let closeOverlay = null;
  let hotkeysOff = false;
  let graceTimer = 0;
  let seq = 0;

  function newState(mode) {
    const heroes = pickHeroes();
    const lo = lay();
    return {
      mode, // 'demo' | 'play' | 'end' | 'dead'
      t: 0,
      heroes,
      targets: [],
      hook: null,
      cd: 0,
      aim: { ang: -Math.PI / 2, x: lo.pudge.x, y: lo.pudge.y - lo.R * 0.7, src: 'none', flash: 0 },
      spawnIn: 0.2,
      sparks: [],
      floats: [],
      flow: 0,
      shake: 0,
      pudgeAnim: 0,
      // istatistik
      score: 0, throws: 0, enemy: 0, ally: 0, creep: 0, misses: 0,
      streak: 0, maxStreak: 0, longest: 0, longHooks: 0, prey: new Map(), lastTick: 99,
    };
  }

  const mult = (s) => (s >= 6 ? 3 : s >= 3 ? 2 : 1);

  function spawnOne() {
    const lo = lay();
    const k = st.mode === 'play' ? clamp(st.t / ROUND, 0, 1) : 0.2;
    const r = Math.random();
    const allyP = lerp(0.17, 0.26, k);
    const kind = r < allyP ? 'ally' : r < allyP + 0.3 ? 'creep' : 'enemy';
    const dir = Math.random() < 0.5 ? 1 : -1;
    const lanesFor = kind === 'creep' ? [1, 2, 3] : [0, 1, 2, 3];
    // Giriş kenarı dolu olmayan bir koridor seç
    const free = shuffle(lanesFor).find((li) => !st.targets.some((t) => t.lane === li && !t.hooked && (dir > 0 ? t.x < lo.heroR * 5 : t.x > Lw - lo.heroR * 5)));
    if (free == null) return;
    const speedK = 1 + 0.65 * k;
    if (kind === 'creep') {
      const n = Math.random() < 0.5 ? 3 : 2;
      const sp = Lw * rand(0.07, 0.09) * speedK;
      for (let i = 0; i < n; i++) {
        const x = dir > 0 ? -lo.creepR - 8 - i * lo.creepR * 2.7 : Lw + lo.creepR + 8 + i * lo.creepR * 2.7;
        st.targets.push({ id: ++seq, kind, lane: free, x, y: 0, dir, speed: sp, r: lo.creepR, pause: 0, jukeIn: 99, jukes: 0, hooked: false, bob: rand(0, TAU), yOff: rand(-4, 4) });
      }
      return;
    }
    const hero = pick(kind === 'enemy' ? st.heroes.enemies : st.heroes.allies);
    const x = dir > 0 ? -lo.heroR - 10 : Lw + lo.heroR + 10;
    st.targets.push({
      id: ++seq, kind, hero, lane: free, x, y: 0, dir,
      speed: Lw * rand(0.1, 0.17) * speedK,
      r: lo.heroR, pause: 0, jukeIn: rand(0.9, 2.2), jukes: 0, hooked: false, bob: rand(0, TAU), yOff: 0,
    });
  }

  function stepTargets(dt) {
    const lo = lay();
    const k = st.mode === 'play' ? clamp(st.t / ROUND, 0, 1) : 0.15;
    const jukeP = lerp(0.3, 0.75, k);
    for (const t of st.targets) {
      t.bob += dt * 5;
      if (t.hooked) continue;
      t.y = lo.lanes[t.lane] + t.yOff;
      if (t.pause > 0) { t.pause -= dt; continue; }
      t.x += t.dir * t.speed * dt;
      if (t.kind !== 'creep') {
        t.jukeIn -= dt;
        if (t.jukeIn <= 0) {
          t.jukeIn = rand(1.0, 2.6);
          if (Math.random() < jukeP && t.jukes < 3 && t.x > t.r && t.x < Lw - t.r) {
            t.jukes++;
            if (Math.random() < 0.55) { t.dir *= -1; t.pause = rand(0.08, 0.2); } else t.pause = rand(0.3, 0.6);
          }
        }
      }
    }
    // Yürüdüğü yönde kenardan çıkanları sil (girişte kenarın dışında doğanlar içeri yürür)
    st.targets = st.targets.filter((t) => t.hooked || !((t.dir > 0 && t.x > Lw + t.r + 12) || (t.dir < 0 && t.x < -t.r - 12)));
  }

  // ---------------------------------------------------------------- kanca
  function mouth(lo, ang) {
    return [lo.pudge.x + Math.cos(ang) * (lo.pudge.r + 2), lo.pudge.y + Math.sin(ang) * (lo.pudge.r + 2)];
  }

  function setAimPoint(x, y, src) {
    const lo = lay();
    let ang = Math.atan2(y - lo.pudge.y, x - lo.pudge.x);
    if (ang > -0.1 && ang <= Math.PI / 2) ang = -0.1;
    else if (ang > Math.PI / 2 || ang < -Math.PI + 0.1) ang = -Math.PI + 0.1;
    st.aim.ang = ang;
    st.aim.x = x;
    st.aim.y = y;
    st.aim.src = src;
  }

  function throwHook() {
    if (!st || st.mode !== 'play') return;
    if (st.hook || st.cd > 0) {
      st.aim.flash = 0.25; // halka "hazır değil" diye kısa parlar
      return;
    }
    const ang = st.aim.ang;
    st.hook = { ang, dx: Math.cos(ang), dy: Math.sin(ang), dist: 0, phase: 'out', target: null };
    st.cd = COOLDOWN;
    st.throws++;
    st.pudgeAnim = 0.25;
    ctx.sound.whoosh();
  }

  function stepHook(dt) {
    const hk = st.hook;
    if (!hk) return;
    const lo = lay();
    const [mx, my] = mouth(lo, hk.ang);
    if (hk.phase === 'out') {
      const prev = hk.dist;
      hk.dist = Math.min(lo.R, hk.dist + lo.R * 2.1 * dt);
      if (st.mode === 'play') {
        // Parça üzerindeki ilk temas: en küçük oranlı çarpışma
        const ax = mx + hk.dx * prev, ay = my + hk.dy * prev;
        const bx = mx + hk.dx * hk.dist, by = my + hk.dy * hk.dist;
        let best = null;
        let bu = 2;
        for (const t of st.targets) {
          if (t.hooked) continue;
          const [d, u] = segDist(t.x, t.y, ax, ay, bx, by);
          if (d <= t.r + HOOK_R && u < bu) { bu = u; best = t; }
        }
        if (best) {
          hk.dist = prev + (hk.dist - prev) * bu;
          hk.target = best;
          hk.phase = 'back';
          best.hooked = true;
          onHit(best, Math.hypot(best.x - lo.pudge.x, best.y - lo.pudge.y), lo);
          return;
        }
      }
      if (hk.dist >= lo.R) hk.phase = 'back';
    } else {
      hk.dist -= lo.R * (hk.target ? 1.55 : 2.6) * dt;
      if (hk.target) {
        hk.target.x = mx + hk.dx * Math.max(0, hk.dist);
        hk.target.y = my + hk.dy * Math.max(0, hk.dist);
      }
      if (hk.dist <= 0) {
        if (hk.target) onArrive(hk.target, lo);
        else onMiss();
        st.hook = null;
      }
    }
  }

  function onHit(t, dist, lo) {
    const units = Math.min(DOTA_RANGE, Math.round((dist / lo.R) * DOTA_RANGE / 10) * 10);
    if (t.kind === 'enemy') {
      st.enemy++;
      st.streak++;
      st.maxStreak = Math.max(st.maxStreak, st.streak);
      const long = dist >= lo.R * LONG_K;
      if (long) st.longHooks++;
      const m = mult(st.streak);
      const pts = (ENEMY_PTS + (long ? LONG_BONUS : 0)) * m;
      addScore(pts);
      st.longest = Math.max(st.longest, units);
      st.prey.set(t.hero.name, (st.prey.get(t.hero.name) || 0) + 1);
      floatAt(t.x, t.y - t.r - 8, `+${pts}`, C.aegis, 22);
      floatAt(t.x, t.y - t.r - 30, long ? `UZUN KANCA · ${units}` : t.hero.name, long ? C['ember-2'] : C.text, long ? 13 : 12);
      if (m > 1 && (st.streak === 3 || st.streak === 6)) floatAt(t.x, t.y + t.r + 22, `SERİ ×${m}`, C.ember, 16);
      burst(t.x, t.y, C.dire, 18);
      ctx.sound.hit();
      if (long) ctx.sound.good();
      say(`${t.hero.name} çekildi. Artı ${pts} puan.`);
    } else if (t.kind === 'creep') {
      st.creep++;
      const pts = CREEP_PTS * mult(st.streak);
      addScore(pts);
      floatAt(t.x, t.y - t.r - 8, `+${pts}`, C['text-2'], 15);
      burst(t.x, t.y, C['dire-deep'], 8);
      ctx.sound.hit();
      say(`Creep çekildi. Artı ${pts}.`);
    } else {
      st.ally++;
      st.streak = 0;
      addScore(-ALLY_PEN);
      st.prey.set('__ally', (st.prey.get('__ally') || 0) + 1);
      floatAt(t.x, t.y - t.r - 8, `−${ALLY_PEN}`, C.dire, 22);
      floatAt(t.x, t.y - t.r - 30, `${t.hero.name}: “neden?!”`, C.radiant, 12);
      burst(t.x, t.y, C.radiant, 12);
      ctx.fx.stamp('DOG DOG DOG');
      ctx.sound.bad();
      if (!reduced) st.shake = 0.35;
      say(`Dost ${t.hero.name} çekildi. Eksi ${ALLY_PEN}. DOG DOG DOG.`);
    }
    renderStreak();
  }

  function onArrive(t, lo) {
    st.targets = st.targets.filter((x) => x !== t);
    const { x, y } = lo.pudge;
    if (t.kind === 'ally') {
      floatAt(x, y - lo.pudge.r - 14, 'Yanlış çanta!', C.radiant, 13);
    } else {
      burst(x, y - lo.pudge.r * 0.4, t.kind === 'enemy' ? C.dire : C['dire-deep'], t.kind === 'enemy' ? 22 : 8, true);
      if (t.kind === 'enemy') ctx.sound.coin();
    }
    st.pudgeAnim = 0.35;
  }

  function onMiss() {
    st.misses++;
    const lo = lay();
    if (st.mode === 'play') {
      const had = st.streak;
      st.streak = 0;
      renderStreak();
      floatAt(lo.pudge.x, lo.pudge.y - lo.pudge.r - 14, had >= 2 ? 'Iska · seri bitti' : 'Iska', C['text-2'], 13);
      ctx.sound.miss();
    }
  }

  function addScore(d) {
    st.score = Math.max(0, st.score + d);
    sScore.set(fmtNum(st.score));
    sScore.bump();
  }

  function renderStreak() {
    const m = mult(st.streak);
    sStreak.set(`×${m}`);
    Array.from(streakPips.children).forEach((p, i) => p.classList.toggle('on', i < Math.min(6, st.streak)));
    sStreak.el.classList.toggle('hot', m > 1);
  }

  // ---------------------------------------------------------------- efektler
  function floatAt(x, y, text, color, size = 16) {
    st.floats.push({ x, y, text, color, size, t: 0, dur: 1.15 });
  }
  function burst(x, y, color, n, meat = false) {
    const cnt = reduced ? Math.ceil(n / 3) : n;
    for (let i = 0; i < cnt; i++) {
      const a = rand(0, TAU);
      const sp = rand(60, meat ? 240 : 190);
      st.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (meat ? 80 : 0), t: 0, dur: rand(0.35, 0.75), color, size: meat ? rand(3, 6) : rand(2, 4), g: meat ? 380 : 0 });
    }
  }
  function say(m) { L.live.textContent = m; }

  // ---------------------------------------------------------------- çizim
  function buildBg() {
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    const g = c.getContext('2d');
    g.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    const lo = lay();
    // Zemin: üstte Dire, altta Radiant tonu
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, hexA(C['dire-deep'], 0.35));
    gr.addColorStop(0.36, C['bg-2']);
    gr.addColorStop(0.64, C['bg-2']);
    gr.addColorStop(1, hexA(C['radiant-deep'], 0.32));
    g.fillStyle = C.bg;
    g.fillRect(0, 0, Lw, H);
    g.fillStyle = gr;
    g.fillRect(0, 0, Lw, H);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // Zemin dokusu
    for (let i = 0; i < Lw * H / 900; i++) {
      g.fillStyle = hexA(rnd() < 0.5 ? C['line-2'] : C.bg, 0.25 + rnd() * 0.3);
      g.fillRect(rnd() * Lw, rnd() * H, 1.4, 1.4);
    }
    // Nehir
    const [r0, r1] = lo.river;
    const wave = (y, amp, ph) => { g.moveTo(0, y); for (let x = 0; x <= Lw; x += 16) g.lineTo(x, y + Math.sin(x * 0.018 + ph) * amp); };
    g.beginPath();
    wave(r0, 5, 0);
    for (let x = Lw; x >= 0; x -= 16) g.lineTo(x, r1 + Math.sin(x * 0.02 + 2) * 5);
    g.closePath();
    const rv = g.createLinearGradient(0, r0, 0, r1);
    rv.addColorStop(0, hexA(C.arcane, 0.16));
    rv.addColorStop(0.5, hexA(C.arcane, 0.3));
    rv.addColorStop(1, hexA(C.arcane, 0.16));
    g.fillStyle = rv;
    g.fill();
    g.strokeStyle = hexA(C.arcane, 0.4);
    g.lineWidth = 1.5;
    g.beginPath(); wave(r0, 5, 0); g.stroke();
    g.beginPath(); wave(r1, 5, 2); g.stroke();
    // Koridor patikaları (nehir dışındaki koridorlar)
    lo.lanes.forEach((y, i) => {
      if (y > r0 && y < r1) return;
      const band = lo.heroR * 1.35;
      const pg = g.createLinearGradient(0, y - band, 0, y + band);
      pg.addColorStop(0, hexA(C['ember-deep'], 0));
      pg.addColorStop(0.5, hexA(C['ember-deep'], i === 0 ? 0.16 : 0.12));
      pg.addColorStop(1, hexA(C['ember-deep'], 0));
      g.fillStyle = pg;
      g.fillRect(0, y - band, Lw, band * 2);
      g.fillStyle = hexA(C['line-2'], 0.55);
      for (let x = rnd() * 30; x < Lw; x += 26 + rnd() * 30) {
        g.beginPath(); g.ellipse(x, y + (rnd() < 0.5 ? -band * 0.8 : band * 0.8), 2 + rnd() * 3, 1 + rnd() * 1.5, 0, 0, TAU); g.fill();
      }
    });
    // Kenar ağaçları: üstte kuru Dire, altta Radiant çamları
    const tree = (x, y, s, col, dire) => {
      g.fillStyle = hexA(col, 0.85);
      g.beginPath();
      if (dire) { for (let a = 0; a < TAU; a += TAU / 7) g.lineTo(x + Math.cos(a) * s * (0.7 + (Math.round(a * 3) % 2) * 0.35), y + Math.sin(a) * s * 0.8); }
      else { g.arc(x, y, s, 0, TAU); }
      g.fill();
      g.fillStyle = hexA(C.bg, 0.35);
      g.beginPath(); g.arc(x + s * 0.2, y + s * 0.25, s * 0.55, 0, TAU); g.fill();
    };
    for (let i = 0; i < 9; i++) {
      tree(rnd() * Lw * 0.22, rnd() * H * 0.08, 10 + rnd() * 10, C['dire-deep'], true);
      tree(Lw - rnd() * Lw * 0.22, rnd() * H * 0.08, 10 + rnd() * 10, C['dire-deep'], true);
    }
    for (let i = 0; i < 7; i++) {
      tree(rnd() * Lw * 0.26, H - rnd() * H * 0.1, 11 + rnd() * 10, C['radiant-deep'], false);
      tree(Lw - rnd() * Lw * 0.26, H - rnd() * H * 0.1, 11 + rnd() * 10, C['radiant-deep'], false);
    }
    // Menzil yayı
    const { x: px, y: py, r: pr } = lo.pudge;
    g.save();
    g.setLineDash([4, 7]);
    g.strokeStyle = hexA(C.ember, 0.28);
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(px, py, lo.R + pr, Math.PI, TAU); g.stroke();
    g.setLineDash([]);
    g.strokeStyle = hexA(C.ember, 0.1);
    g.beginPath(); g.arc(px, py, (lo.R + pr) * LONG_K, Math.PI, TAU); g.stroke();
    g.restore();
    // Pudge'un taş platformu
    const pad = g.createRadialGradient(px, py, pr * 0.6, px, py, pr * 2);
    pad.addColorStop(0, hexA(C['bg-4'], 0.95));
    pad.addColorStop(0.7, hexA(C['bg-3'], 0.7));
    pad.addColorStop(1, hexA(C['bg-3'], 0));
    g.fillStyle = pad;
    g.beginPath(); g.arc(px, py, pr * 2, 0, TAU); g.fill();
    return c;
  }

  function drawPortrait(g, img, x, y, r, fallback, fbColor) {
    g.save();
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.closePath();
    g.clip();
    if (img && img.complete && img.naturalWidth) {
      // 256×144 yatay portreden ortadaki kare (yüz genelde ortada)
      const sw = img.naturalHeight * 0.9;
      const sx = (img.naturalWidth - sw) / 2;
      g.drawImage(img, sx, 0, sw, sw, x - r, y - r, r * 2, r * 2);
    } else {
      g.fillStyle = fbColor;
      g.fillRect(x - r, y - r, r * 2, r * 2);
      g.fillStyle = C.text;
      g.font = `800 ${Math.round(r * 0.62)}px Barlow, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(fallback, x, y + 1);
    }
    g.restore();
  }

  function drawHero(g, t) {
    const enemy = t.kind === 'enemy';
    const ring = enemy ? C.dire : C.radiant;
    const bob = t.hooked ? 0 : Math.sin(t.bob) * 1.2;
    const x = t.x, y = t.y + bob, r = t.r;
    // gölge
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath(); g.ellipse(x, t.y + r * 0.92, r * 0.95, r * 0.32, 0, 0, TAU); g.fill();
    // düşman: kırmızı parıltı
    if (enemy) {
      const gl = g.createRadialGradient(x, y, r * 0.8, x, y, r * 1.7);
      gl.addColorStop(0, hexA(C.dire, 0.35 + Math.sin(t.bob * 0.8) * 0.08));
      gl.addColorStop(1, hexA(C.dire, 0));
      g.fillStyle = gl;
      g.beginPath(); g.arc(x, y, r * 1.7, 0, TAU); g.fill();
    }
    drawPortrait(g, loadImg(t.hero.id), x, y, r, t.hero.abbr || '?', enemy ? C['dire-deep'] : C['radiant-deep']);
    g.lineWidth = 3;
    g.strokeStyle = ring;
    g.beginPath(); g.arc(x, y, r + 1.5, 0, TAU); g.stroke();
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(0,0,0,0.8)';
    g.beginPath(); g.arc(x, y, r + 3.5, 0, TAU); g.stroke();
    if (!enemy) {
      // dost: çift halka + DOST etiketi
      g.lineWidth = 1.5;
      g.strokeStyle = hexA(C.radiant, 0.7);
      g.beginPath(); g.arc(x, y, r + 5.5, 0, TAU); g.stroke();
      const tw = 30, th = 12;
      g.fillStyle = C.radiant;
      roundRect(g, x - tw / 2, y + r - 2, tw, th, 3);
      g.fill();
      g.fillStyle = '#04140d';
      g.font = '800 9px Barlow, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('DOST', x, y + r - 2 + th / 2 + 0.5);
    } else {
      // düşman: yön oku (yürüdüğü taraf)
      if (!t.hooked) {
        g.fillStyle = hexA(C.dire, 0.9);
        const ax = x + t.dir * (r + 8);
        g.beginPath(); g.moveTo(ax + t.dir * 5, y); g.lineTo(ax, y - 4); g.lineTo(ax, y + 4); g.fill();
      }
    }
  }

  function drawCreep(g, t) {
    const x = t.x, y = t.y + (t.hooked ? 0 : Math.sin(t.bob) * 0.8), r = t.r;
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.beginPath(); g.ellipse(x, t.y + r * 0.85, r, r * 0.34, 0, 0, TAU); g.fill();
    g.fillStyle = C['dire-deep'];
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = hexA(C.dire, 0.9);
    g.stroke();
    // miğfer boynuzları (yürüme yönünde)
    g.fillStyle = C.dire;
    const d = t.dir;
    g.beginPath(); g.moveTo(x + d * r * 0.2, y - r * 0.7); g.lineTo(x + d * r * 1.05, y - r * 1.15); g.lineTo(x + d * r * 0.65, y - r * 0.25); g.fill();
    g.beginPath(); g.moveTo(x + d * r * 0.2, y + r * 0.7); g.lineTo(x + d * r * 1.05, y + r * 1.15); g.lineTo(x + d * r * 0.65, y + r * 0.25); g.fill();
    g.fillStyle = C['aegis-2'];
    g.fillRect(x + d * r * 0.35 - 1.5, y - 1.5, 3, 3);
  }

  function drawPudge(g, lo) {
    const { x, y, r } = lo.pudge;
    const bump = st.pudgeAnim > 0 ? Math.sin((st.pudgeAnim / 0.35) * Math.PI) * 2.5 : 0;
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.beginPath(); g.ellipse(x, y + r * 0.92, r * 1.05, r * 0.34, 0, 0, TAU); g.fill();
    drawPortrait(g, pudgeImg, x, y, r + bump, 'PUD', C['ember-deep']);
    // bekleme halkası: dolan ember yayı; hazırken altın
    const ready = st.cd <= 0 && !st.hook;
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(0,0,0,0.75)';
    g.beginPath(); g.arc(x, y, r + 4, 0, TAU); g.stroke();
    if (ready) {
      g.strokeStyle = C.aegis;
      g.beginPath(); g.arc(x, y, r + 4, 0, TAU); g.stroke();
      if (!reduced) {
        const p = (st.t * 1.4) % 1;
        g.lineWidth = 2;
        g.strokeStyle = hexA(C.aegis, 0.5 * (1 - p));
        g.beginPath(); g.arc(x, y, r + 5 + p * 10, 0, TAU); g.stroke();
      }
    } else {
      const k = 1 - clamp(st.cd / COOLDOWN, 0, 1);
      g.strokeStyle = st.aim.flash > 0 ? C.dire : C.ember;
      g.beginPath(); g.arc(x, y, r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * k); g.stroke();
    }
    // kanca evdeyken nişan yönünde duran kanca ucu
    if (!st.hook) drawHookHead(g, ...mouth(lo, st.aim.ang), st.aim.ang, 0.85);
  }

  function drawHookHead(g, x, y, ang, s = 1) {
    g.save();
    g.translate(x, y);
    g.rotate(ang + Math.PI / 2);
    g.scale(s, s);
    g.lineCap = 'round';
    g.strokeStyle = '#2a2233';
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(0, 6); g.lineTo(0, -6); g.arc(-5, -6, 5, 0, Math.PI, true); g.lineTo(-10, -2); g.stroke();
    g.strokeStyle = '#cfc6d8';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 6); g.lineTo(0, -6); g.arc(-5, -6, 5, 0, Math.PI, true); g.lineTo(-10, -2); g.stroke();
    g.fillStyle = C.dire;
    g.beginPath(); g.arc(-10, -2, 1.8, 0, TAU); g.fill();
    g.restore();
  }

  function drawHook(g, lo) {
    const hk = st.hook;
    if (!hk) return;
    const [mx, my] = mouth(lo, hk.ang);
    const hx = mx + hk.dx * Math.max(0, hk.dist);
    const hy = my + hk.dy * Math.max(0, hk.dist);
    // zincir
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(mx, my); g.lineTo(hx, hy); g.stroke();
    g.strokeStyle = hexA(C['text-2'], 0.9);
    g.lineWidth = 2;
    g.setLineDash([5, 3]);
    g.lineDashOffset = hk.phase === 'out' ? -hk.dist : hk.dist;
    g.beginPath(); g.moveTo(mx, my); g.lineTo(hx, hy); g.stroke();
    g.restore();
    if (!hk.target) drawHookHead(g, hx, hy, hk.ang, 1.1);
  }

  function drawAim(g, lo) {
    if (st.mode !== 'play' || st.hook) return;
    if (st.aim.src === 'none') return;
    const [mx, my] = mouth(lo, st.aim.ang);
    const dx = Math.cos(st.aim.ang), dy = Math.sin(st.aim.ang);
    const ready = st.cd <= 0;
    const len = lo.R;
    g.save();
    g.setLineDash([6, 6]);
    g.lineDashOffset = -st.t * 30;
    g.strokeStyle = hexA(ready ? C.aegis : C['text-3'], ready ? 0.55 : 0.3);
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + dx * len, my + dy * len); g.stroke();
    g.setLineDash([]);
    // imleç artısı (menzil içindeyse nişan noktası, değilse menzil sonu)
    const dAim = Math.hypot(st.aim.x - mx, st.aim.y - my);
    const d = Math.min(dAim, len);
    const cx = mx + dx * d, cy = my + dy * d;
    g.strokeStyle = hexA(ready ? C.aegis : C['text-3'], 0.85);
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(cx, cy, 9, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(cx - 14, cy); g.lineTo(cx - 5, cy); g.moveTo(cx + 5, cy); g.lineTo(cx + 14, cy); g.moveTo(cx, cy - 14); g.lineTo(cx, cy - 5); g.moveTo(cx, cy + 5); g.lineTo(cx, cy + 14); g.stroke();
    g.restore();
  }

  function draw() {
    if (!cssW || !st) return;
    const g = g2;
    if (!bgCache) bgCache = buildBg();
    g.setTransform(1, 0, 0, 1, 0, 0);
    let ox = 0, oy = 0;
    if (st.shake > 0) { ox = rand(-4, 4) * st.shake * dpr; oy = rand(-3, 3) * st.shake * dpr; }
    g.drawImage(bgCache, ox, oy);
    g.setTransform(dpr * scale, 0, 0, dpr * scale, ox, oy);
    const lo = lay();
    // nehir akıntısı
    g.strokeStyle = hexA(C.text, 0.1);
    g.lineWidth = 1.5;
    const [r0, r1] = lo.river;
    for (let i = 0; i < 7; i++) {
      const y = lerp(r0 + 8, r1 - 8, (i + 0.5) / 7);
      const off = ((st.flow * (i % 2 ? 26 : 38)) + i * 97) % (Lw + 120) - 60;
      g.beginPath(); g.moveTo(off, y); g.lineTo(off + 40, y); g.stroke();
    }
    drawAim(g, lo);
    const items = st.targets.slice().sort((a, b) => a.y - b.y);
    for (const t of items) {
      if (t.kind === 'creep') drawCreep(g, t);
      else drawHero(g, t);
    }
    drawHook(g, lo);
    drawPudge(g, lo);
    for (const p of st.sparks) {
      g.globalAlpha = Math.max(0, 1 - p.t / p.dur);
      g.fillStyle = p.color;
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    g.globalAlpha = 1;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    for (const f of st.floats) {
      const k = f.t / f.dur;
      g.globalAlpha = Math.max(0, 1 - k * k);
      g.font = `900 ${f.size}px Unbounded, 'Arial Black', sans-serif`;
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(0,0,0,0.75)';
      const y = f.y - (reduced ? 0 : k * 24);
      // Sahne kenarında kesilmesin
      const half = g.measureText(f.text).width / 2 + 4;
      const x = clamp(f.x, half, Math.max(half, Lw - half));
      g.strokeText(f.text, x, Math.max(f.size + 2, y));
      g.fillStyle = f.color;
      g.fillText(f.text, x, Math.max(f.size + 2, y));
    }
    g.globalAlpha = 1;
    if (st.mode === 'demo') {
      g.fillStyle = hexA(C.bg, 0.2);
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
  function frame(dt, _t, lastStep = true) {
    if (!st) return;
    st.t += dt;
    st.flow += dt;
    if (st.mode === 'play') {
      const left = Math.max(0, ROUND - st.t);
      sTime.set(String(Math.ceil(left)));
      timeBar.firstChild.style.transform = `scaleX(${left / ROUND})`;
      sTime.el.classList.toggle('low', left <= 10);
      if (left <= 5 && Math.ceil(left) !== st.lastTick) { st.lastTick = Math.ceil(left); ctx.sound.tick(); }
      if (left <= 0) { end(); }
    }
    // Doğum
    if (st.mode !== 'dead') {
      st.spawnIn -= dt;
      if (st.spawnIn <= 0) {
        const k = st.mode === 'play' ? clamp(st.t / ROUND, 0, 1) : 0.1;
        const lo = lay();
        const groups = st.targets.filter((t) => !t.hooked && (t.kind !== 'creep')).length + Math.ceil(st.targets.filter((t) => t.kind === 'creep').length / 3);
        const maxN = Math.round(lerp(lo.small ? 4 : 5, lo.small ? 6 : 8, k));
        if (groups < maxN) spawnOne();
        st.spawnIn = lerp(1.0, 0.5, k) * rand(0.75, 1.25);
      }
    }
    st.cd = Math.max(0, st.cd - dt);
    st.aim.flash = Math.max(0, st.aim.flash - dt);
    st.pudgeAnim = Math.max(0, st.pudgeAnim - dt);
    st.shake = Math.max(0, st.shake - dt);
    stepTargets(dt);
    stepHook(dt);
    for (const p of st.sparks) { p.t += dt; p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= p.g ? 1 : 0.96; }
    st.sparks = st.sparks.filter((p) => p.t < p.dur);
    for (const f of st.floats) f.t += dt;
    st.floats = st.floats.filter((f) => f.t < f.dur);
    const cdK = st.hook ? 1 : st.cd / COOLDOWN;
    cdEl.style.setProperty('--cd', `${Math.round(clamp(cdK, 0, 1) * 100)}%`);
    cdEl.classList.toggle('ready', !st.hook && st.cd <= 0);
    if (visible && lastStep) draw();
  }

  // ---------------------------------------------------------------- giriş
  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * Lw, y: ((e.clientY - r.top) / r.height) * H };
  }
  function onPointerDown(e) {
    if (!st || st.mode !== 'play') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const p = toLogical(e);
    setAimPoint(p.x, p.y, e.pointerType === 'mouse' ? 'mouse' : 'touch');
    throwHook();
  }
  function onPointerMove(e) {
    if (!st || st.mode !== 'play') return;
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    const p = toLogical(e);
    setAimPoint(p.x, p.y, 'mouse');
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);

  function onKey(e) {
    if (!st || st.mode !== 'play' || e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const lo = lay();
      const ang = clamp(st.aim.ang + (e.key === 'ArrowLeft' ? -1 : 1) * 0.07, -Math.PI + 0.1, -0.1);
      setAimPoint(lo.pudge.x + Math.cos(ang) * lo.R * 0.8, lo.pudge.y + Math.sin(ang) * lo.R * 0.8, 'key');
    } else if (e.key === ' ' || e.code === 'Space') {
      // Odak başka bir düğmedeyse (geri, diğer oyunlar…) boşluk ona aittir
      if (onOtherControl(e, canvas)) return;
      e.preventDefault();
      if (e.repeat) return;
      if (st.aim.src === 'none') st.aim.src = 'key';
      throwHook();
    }
  }
  window.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- akış
  function startDemo() {
    st = newState('demo');
    if (!runner) runner = createRunner(frame);
    // sahne boş başlamasın
    for (let i = 0; i < 5; i++) spawnOne();
    const lo = lay();
    for (const t of st.targets) t.x = t.dir > 0 ? rand(lo.heroR, Lw * 0.8) : rand(Lw * 0.2, Lw - lo.heroR);
  }

  function start() {
    if (closeOverlay) { closeOverlay(); closeOverlay = null; }
    if (graceTimer) { clearTimeout(graceTimer); graceTimer = 0; }
    Lw = cssW < 600 ? 400 : 800;
    resize(true);
    st = newState('play');
    sScore.set('0');
    sTime.set(String(ROUND));
    sTime.el.classList.remove('low');
    renderStreak();
    if (runner) runner.destroy();
    runner = createRunner(frame);
    L.stage.classList.add('playing');
    wrap.classList.add('playing');
    ctx.hotkeys(false);
    hotkeysOff = true;
    // Odak gövdede kalır: boşluk yine kancayı atar, sahnenin çevresinde odak çerçevesi yanmaz
    try { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); } catch { /* yok say */ }
    ctx.sound.whoosh();
    say('Pudge Hook başladı. 60 saniye.');
    requestAnimationFrame(() => revealInView(wrap));
  }

  function restoreHotkeys() {
    graceTimer = 0;
    if (hotkeysOff) { ctx.hotkeys(true); hotkeysOff = false; }
  }

  function end() {
    if (!st || st.mode !== 'play') return;
    st.mode = 'end';
    L.stage.classList.remove('playing');
    wrap.classList.remove('playing');
    graceTimer = setTimeout(restoreHotkeys, GRACE_MS);
    const s = st.score;
    const saved = submitResult(meta, s);
    const acc = st.throws ? Math.round((st.enemy / st.throws) * 100) : 0;
    let fav = null;
    for (const [name, n] of st.prey) if (name !== '__ally' && (!fav || n > fav[1])) fav = [name, n];
    let quip = s >= 2500
      ? 'Fresh meat! Rakip takım fountain’dan çıkmaya korkuyor. Bu kanca 1vDOQUZ onaylı.'
      : s >= 1500
        ? 'Temiz kancalar. Klip kanalına gidecek en az üç an var.'
        : s >= 700
          ? 'Fena değil; creep dalgası biraz kalkan oldu ama av avdır.'
          : s >= 200
            ? 'Kanca bazen tuttu, bazen nehre gitti. Hedefin peşine değil, önüne at.'
            : 'DOG DOG DOG. Kanca döndü, çanta boş. Hedefin önüne atmayı dene.';
    if (st.ally >= 3) quip = `Dostlarını çok özlemişsin: ${st.ally} kez kendi takımını çektin. DOG DOG DOG.`;
    else if (fav && fav[1] >= 2) quip += ` En sevdiğin av: ${fav[0]} (${fav[1]} kez).`;
    const stats = [
      ['İsabet oranı', `%${acc}`],
      ['Düşman', fmtNum(st.enemy)],
      ['Dost (DOG)', fmtNum(st.ally)],
      ['En uzun kanca', st.longest ? `${fmtNum(st.longest)} birim` : '—'],
      ['Creep', fmtNum(st.creep)],
      ['En uzun seri', `×${st.maxStreak}`],
    ];
    say(`Süre bitti. ${s} puan, ${st.enemy} düşman.`);
    const r = runner;
    r.after(0.8, () => {
      if (!st || st.mode !== 'end') return;
      const { node } = resultCard(meta, {
        score: s,
        saved,
        stats,
        quip,
        onRetry: start,
        onBack: () => nav && nav.back(),
      });
      closeOverlay = showOverlay(L.stage, node, { reveal: true });
    });
  }

  // Yalnızca geliştirme sunucusunda: uçtan uca testlerin hedef konumlarını okuyabilmesi için
  if (import.meta.env && import.meta.env.DEV) {
    window.__hookDebug = () => {
      if (!st) return null;
      const lo = lay();
      return {
        mode: st.mode, t: st.t, cd: st.cd, hook: !!st.hook, score: st.score, Lw, H,
        pudge: lo.pudge, R: lo.R, hookSpeed: lo.R * 2.1,
        targets: st.targets.filter((t) => !t.hooked).map((t) => ({ kind: t.kind, x: t.x, y: t.y, r: t.r, vx: t.pause > 0 ? 0 : t.dir * t.speed })),
      };
    };
  }

  startDemo();
  resize(true);
  closeOverlay = showOverlay(L.stage, introCard(meta, {
    onStart: start,
    note: 'Kanca düz gider ve yoldaki ilk birime takılır. Hareket eden hedefin önüne at; kırmızıyı çek, yeşile dokunma.',
  }));

  return () => {
    if (st) st.mode = 'dead';
    window.removeEventListener('keydown', onKey);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    if (graceTimer) clearTimeout(graceTimer);
    ro.disconnect();
    io.disconnect();
    if (runner) runner.destroy();
    runner = null;
    if (hotkeysOff) { ctx.hotkeys(true); hotkeysOff = false; }
    if (import.meta.env && import.meta.env.DEV) delete window.__hookDebug;
    st = null;
    bgCache = null;
    if (closeOverlay) closeOverlay();
    L.destroy();
  };
}
