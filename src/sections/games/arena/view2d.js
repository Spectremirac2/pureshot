// 1vDOQUZ Arena — WebGL yoksa zarif 2D yedek görüntü (üstten canvas).
// Aynı simülasyonu (game.js) çizer; 3D görüntüyle aynı arayüzü sunar.

import { ARENA_R, GATE_ANGLES, RIVER_HALF, ISLAND_R, riverPoint, FOUNTAIN, ROSHAN_PIT, TREES, TOWER_R } from './map.js';
import { DOG_TYPES, archOf } from './dogs.js';
import { RUNES, NEUTRALS } from './items.js';
import { tok, hexA } from './textures.js';

export function createView2D({ reduced = false } = {}) {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  if (!g) throw new Error('2D canvas yok');
  const col = {
    bg: tok('--bg', '#0d0b14'),
    bg3: tok('--bg-3', '#1e1a2b'),
    line: tok('--line-2', '#433a5c'),
    ember: tok('--ember', '#ff6a2b'),
    gold: tok('--aegis', '#e9b949'),
    jade: tok('--radiant', '#43d6a0'),
    dire: tok('--dire', '#e0354b'),
    text: tok('--text', '#f3eadb'),
    ice: '#9fe8ff',
  };
  let W = 16;
  let H = 9;
  let dpr = 1;
  let scale = 20;
  let cx = 0;
  let cz = 0;
  let time = 0;
  let shakeA = 0;
  let frame = { mode: 'play' };
  const sparks = [];

  function resize(w, h) {
    W = Math.max(1, w);
    H = Math.max(1, h);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const portrait = W / H < 0.9;
    scale = portrait ? W / 14 : Math.min(W / 26, H / 17);
  }

  const sx = (x) => W / 2 + (x - cx) * scale;
  const sy = (z) => H / 2 + (z - cz) * scale;

  function project(x, y, z) {
    const px = sx(x);
    const py = sy(z) - y * scale * 0.6;
    return { x: px, y: py, ndcX: (px / W) * 2 - 1, ndcY: -((py / H) * 2 - 1), behind: false };
  }
  function groundAt(px, py) {
    return { x: (px - W / 2) / scale + cx, z: (py - H / 2) / scale + cz };
  }
  function shake(a) { if (!reduced) shakeA = Math.min(1, shakeA + a); }

  function burst(x, z, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 3;
      sparks.push({ x, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, life: 0.5, color });
    }
  }

  function event(type, d, game) {
    const p = game.player;
    if (type === 'reset') sparks.length = 0;
    if (type === 'hit') burst(d.foe.x, d.foe.z, d.foe.kind === 'dog' ? archOf(d.foe.type).color : col.dire, 6);
    if (type === 'kill') burst(d.foe.x, d.foe.z, col.gold, d.foe.kind === 'boss' ? 40 : 14);
    if (type === 'hurt') { burst(p.x, p.z, col.dire, 6); shake(0.2); }
    if (type === 'ult') { burst(p.x, p.z, col.ember, 30); shake(0.6); }
    if (type === 'waveClear') burst(p.x, p.z, col.gold, 40);
    if (type === 'roshanSlam') { burst(d.x, d.z, col.ember, 30); shake(0.6); }
    if (type === 'fx' && d.kind === 'nova') burst(d.x, d.z, col.ice, 24);
    if (type === 'fx' && (d.kind === 'spin' || d.kind === 'taunt')) burst(d.x, d.z, col.dire, 18);
    if (type === 'fx' && d.kind === 'iceBlast') burst(d.x, d.z, col.ice, 4);
    if (type === 'towerDown') { burst(d.tower.x, d.tower.z, col.gold, 30); shake(0.5); }
    if (type === 'bossAct' && d.foe) { burst(d.x ?? d.foe.x, d.z ?? d.foe.z, (d.foe.def && d.foe.def.color) || col.dire, 24); shake(0.35); }
    if (type === 'bossPhase' && d.foe) { burst(d.foe.x, d.foe.z, col.gold, 30); shake(0.4); }
    if (type === 'fx' && (d.kind === 'remnantBoom' || d.kind === 'overload' || d.kind === 'vortex' || d.kind === 'pulse')) burst(d.x ?? p.x, d.z ?? p.z, '#5fb8ff', 18);
    if (type === 'fx' && (d.kind === 'growth' || d.kind === 'leech' || d.kind === 'bloom' || d.kind === 'grove')) burst(d.x ?? p.x, d.z ?? p.z, '#8fd16a', 16);
    if (type === 'neutralDrop' && d.pickup) burst(d.pickup.x, d.pickup.z, col.jade, 16);
  }

  function ring(x, z, r, color, w = 2, dash = null) {
    g.save();
    g.strokeStyle = color;
    g.lineWidth = w;
    if (dash) g.setLineDash(dash);
    g.beginPath();
    g.ellipse(sx(x), sy(z), r * scale, r * scale, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }
  function disc(x, z, r, color) {
    g.fillStyle = color;
    g.beginPath();
    g.arc(sx(x), sy(z), Math.max(1, r * scale), 0, Math.PI * 2);
    g.fill();
  }
  function hpBar(x, z, frac, color, w = 1.2, dy = 0.95) {
    const bw = scale * w;
    g.fillStyle = 'rgba(0,0,0,0.7)';
    g.fillRect(sx(x) - bw / 2, sy(z) - scale * dy, bw, 5);
    g.fillStyle = color;
    g.fillRect(sx(x) - bw / 2, sy(z) - scale * dy, bw * Math.max(0, frac), 5);
  }

  function drawMap() {
    // arena ve yarılar
    g.save();
    g.beginPath();
    g.arc(sx(0), sy(0), ARENA_R * scale, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#1b2a1f';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#2a1519';
    g.beginPath();
    g.moveTo(sx(-40), sy(-40));
    g.lineTo(sx(40), sy(-40));
    g.lineTo(sx(40), sy(40));
    g.closePath();
    g.fill();
    // nehir
    g.lineCap = 'round';
    g.strokeStyle = '#1d5a78';
    g.lineWidth = RIVER_HALF * 2 * scale;
    g.beginPath();
    for (let s = -20; s <= 20; s += 0.5) {
      const p = riverPoint(s);
      if (s === -20) g.moveTo(sx(p.x), sy(p.z));
      else g.lineTo(sx(p.x), sy(p.z));
    }
    g.stroke();
    g.restore();
    disc(0, 0, ISLAND_R, '#2a2236');
    ring(0, 0, ISLAND_R, 'rgba(233,185,73,0.35)', 2);
    ring(0, 0, ARENA_R, col.line, 4);
    for (const a of GATE_ANGLES) {
      g.fillStyle = hexA(col.ember, 0.35 + 0.15 * Math.sin(time * 8 + a));
      g.beginPath();
      g.arc(sx(Math.sin(a) * ARENA_R), sy(Math.cos(a) * ARENA_R), 0.8 * scale, 0, Math.PI * 2);
      g.fill();
    }
    // çeşme, çukur, ağaçlar
    disc(FOUNTAIN.x, FOUNTAIN.z, 1.35, 'rgba(67,214,160,0.55)');
    ring(FOUNTAIN.x, FOUNTAIN.z, FOUNTAIN.r, hexA(col.jade, 0.6), 2, [5, 4]);
    disc(ROSHAN_PIT.x, ROSHAN_PIT.z, ROSHAN_PIT.r, 'rgba(8,6,10,0.85)');
    ring(ROSHAN_PIT.x, ROSHAN_PIT.z, ROSHAN_PIT.r, 'rgba(255,122,43,0.45)', 2);
    for (const t of TREES) disc(t.x, t.z, 0.55 * t.s, t.dire ? '#4a1f2a' : '#2f7d4a');
  }

  const ZONE_COL = { rain: col.gold, blizzard: col.ice, bloom: '#8fd16a', grove: '#43d66a', decoy: '#b18cff' };
  const TELE_COL = { blood: col.dire, gold: col.gold, arcane: '#8b7cff' };
  /** Boss telgrafları: circle / ring / line / cone / mark. */
  function tele(e, c, p) {
    const k = Math.max(0, Math.min(1, 1 - c.t / (c.dur || 1)));
    const colr = TELE_COL[c.color] || col.dire;
    const x = c.shape === 'mark' ? p.x : c.fixed || c.shape === 'line' ? c.x ?? e.x : e.x;
    const z = c.shape === 'mark' ? p.z : c.fixed || c.shape === 'line' ? c.z ?? e.z : e.z;
    g.save();
    g.globalAlpha = 0.2 + 0.45 * k;
    g.fillStyle = colr;
    g.strokeStyle = colr;
    g.lineWidth = 2;
    if (c.shape === 'line') {
      const len = c.len || 6;
      const w = (c.w || 1) * scale;
      g.translate(sx(x), sy(z));
      g.rotate(Math.atan2(Math.cos(c.ang), Math.sin(c.ang)));
      g.fillRect(0, -w, len * scale, w * 2);
    } else if (c.shape === 'cone') {
      const mid = Math.atan2(Math.cos(c.ang), Math.sin(c.ang));
      const half = (c.arc || 1.9) / 2;
      g.beginPath();
      g.moveTo(sx(x), sy(z));
      g.arc(sx(x), sy(z), c.r * scale, mid - half, mid + half);
      g.closePath();
      g.fill();
    } else if (c.shape === 'ring') {
      g.beginPath();
      g.arc(sx(x), sy(z), c.r * scale, 0, Math.PI * 2);
      g.arc(sx(x), sy(z), Math.max(0, (c.inner || 0) * scale), 0, Math.PI * 2, true);
      g.fill('evenodd');
    } else if (c.r > 0) {
      g.beginPath();
      g.arc(sx(x), sy(z), c.r * scale, 0, Math.PI * 2);
      g.globalAlpha = 0.12 + 0.2 * k;
      g.fill();
      g.globalAlpha = 0.7;
      g.beginPath();
      g.arc(sx(x), sy(z), Math.max(0.5, c.r * scale * k), 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }

  function render(game, dt, simDt) {
    time += dt;
    const p = game.player;
    const playing = game.state !== 'idle' && game.state !== 'over';
    const tx = playing || frame.mode === 'select' ? p.x * 0.7 : 0;
    const tz = playing || frame.mode === 'select' ? p.z * 0.7 : 0;
    cx += (tx - cx) * Math.min(1, dt * 4);
    cz += (tz - cz) * Math.min(1, dt * 4);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (shakeA > 0) {
      g.translate((Math.random() - 0.5) * shakeA * 10, (Math.random() - 0.5) * shakeA * 10);
      shakeA = Math.max(0, shakeA - dt * 2);
    }
    g.fillStyle = col.bg;
    g.fillRect(-20, -20, W + 40, H + 40);
    drawMap();
    // kuleler
    for (const t of game.towers) {
      const c = t.side === 'radiant' ? col.jade : col.dire;
      g.fillStyle = t.dead ? 'rgba(80,70,80,0.6)' : c;
      const s = TOWER_R * scale * 1.4;
      g.fillRect(sx(t.x) - s / 2, sy(t.z) - s / 2, s, s);
      if (!t.dead) {
        hpBar(t.x, t.z, t.hp / t.maxHp, c, 1.6, 1.3);
        if (t.side === 'dire' && Math.hypot(p.x - t.x, p.z - t.z) < t.def.range + 2) ring(t.x, t.z, t.def.range, hexA(col.dire, 0.5), 1.5, [6, 5]);
      }
    }
    // rünler
    for (const r of game.runes) {
      const c = RUNES[r.kind].color;
      disc(r.x, r.z, 0.45 + Math.sin(time * 4) * 0.05, c);
      ring(r.x, r.z, 0.7, c, 2);
    }
    // eşyalar
    for (const k of game.pickups) {
      const N = k.kind === 'neutral' ? NEUTRALS[k.item] : null;
      const c = N ? N.color || col.jade : k.kind === 'cheese' ? '#ffd84a' : col.gold;
      g.fillStyle = c;
      g.font = `900 ${Math.round(scale * 0.8)}px Unbounded, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      ring(k.x, k.z, 0.7 + Math.sin(time * 4) * 0.05, k.kind === 'rapierItem' ? col.dire : N ? col.jade : col.gold, 3);
      g.fillText(k.kind === 'aegis' ? 'A' : k.kind === 'cheese' ? 'P' : N ? String(k.tier || 1) : 'R', sx(k.x), sy(k.z));
    }
    // alan etkileri (varyantlar), ward'lar, kalıntılar
    for (const z of game.zones || []) {
      const zc = ZONE_COL[z.kind] || col.gold;
      const fade = Math.max(0, Math.min(1, ((z.dur || 1) - z.t) * 2));
      g.globalAlpha = 0.18 * fade;
      disc(z.x, z.z, z.kind === 'decoy' ? 0.8 : z.r, zc);
      g.globalAlpha = 0.7 * fade;
      ring(z.x, z.z, z.kind === 'decoy' ? 0.8 : z.r, zc, 2, [6, 5]);
      g.globalAlpha = 1;
    }
    for (const w of game.wards || []) {
      disc(w.x, w.z, 0.28, '#f6d98a');
      ring(w.x, w.z, 8, 'rgba(246,217,138,0.18)', 1, [4, 6]);
    }
    for (const r of game.remnants || []) {
      disc(r.x, r.z, 0.38 + Math.sin(time * 9) * 0.04, '#5fb8ff');
      ring(r.x, r.z, r.radius || 1.2, 'rgba(95,184,255,0.35)', 1.5, [3, 4]);
    }
    // düşmanlar
    for (const d of game.foes) {
      if (d.seen === false && !d.dead && playing) continue; // gece: görüş dışında
      if (d.cast && !d.dead) tele(d, d.cast, p);
      let a = d.type === 'ward' || d.kind === 'boss' ? Math.max(0.25, d.vis ?? 1) : 1;
      if (d.dead) a = Math.max(0, 1 - d.deathT);
      g.globalAlpha = a;
      if (d.kind === 'dog') {
        const c = archOf(d.type).color;
        g.fillStyle = d.hitFlash > 0 ? '#fff' : DOG_TYPES[d.type].fur;
        g.beginPath();
        g.arc(sx(d.x), sy(d.z), d.r * scale * d.scale, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = d.st.root > 0 ? col.ice : c;
        g.lineWidth = 3;
        g.stroke();
        g.fillStyle = c;
        g.beginPath();
        g.arc(sx(d.x + Math.sin(d.face) * d.r * 0.7), sy(d.z + Math.cos(d.face) * d.r * 0.7), scale * 0.12, 0, Math.PI * 2);
        g.fill();
        if (!d.dead) {
          hpBar(d.x, d.z, d.hp / d.maxHp, col.dire);
          g.fillStyle = col.text;
          g.font = `800 ${Math.max(9, Math.round(scale * 0.42))}px Unbounded, sans-serif`;
          g.textAlign = 'center';
          g.fillText(DOG_TYPES[d.type].short + (d.status === 'pause' ? ' ‖' : d.status === 'afk' ? ' zZ' : ''), sx(d.x), sy(d.z) - scale * 1.15);
        }
      } else if (d.kind === 'creep') {
        g.fillStyle = d.hitFlash > 0 ? '#fff' : d.type === 'ranged' ? '#a0302a' : '#6f7f5a';
        const s = d.r * scale * 1.6;
        g.fillRect(sx(d.x) - s / 2, sy(d.z) - s / 2, s, s);
        if (!d.dead && d.hp < d.maxHp) hpBar(d.x, d.z, d.hp / d.maxHp, col.dire, 0.9, 0.75);
      } else if (d.kind === 'neutral') {
        const nc = (d.def && d.def.color) || '#b9a27a';
        disc(d.x, d.z, d.r * (d.scale || 1), d.hitFlash > 0 ? '#fff' : nc);
        ring(d.x, d.z, d.r * (d.scale || 1), d.st && d.st.root > 0 ? col.ice : '#6b5b3e', 2);
        if (!d.dead && d.hp < d.maxHp) hpBar(d.x, d.z, d.hp / d.maxHp, '#d9b25a', 1, 0.85);
      } else {
        const bc = (d.def && d.def.color) || col.gold;
        disc(d.x, d.z, d.r, d.hitFlash > 0 ? '#fff' : '#6c6377');
        ring(d.x, d.z, d.r, bc, d.invuln > 0 ? 5 : 3);
        if (!d.dead) {
          hpBar(d.x, d.z, d.hp / d.maxHp, bc, 2.4, 1.6);
          g.fillStyle = bc;
          g.font = `800 ${Math.max(9, Math.round(scale * 0.4))}px Unbounded, sans-serif`;
          g.textAlign = 'center';
          g.fillText((d.def && d.def.short) || 'BOSS', sx(d.x), sy(d.z) - scale * 1.85);
        }
      }
      g.globalAlpha = 1;
    }
    // balonlar
    for (const b of game.bubbles) {
      g.fillStyle = '#fff6ea';
      g.strokeStyle = col.dire;
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(sx(b.x), sy(b.z), scale * 0.8, scale * 0.4, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = col.dire;
      g.font = `900 ${Math.round(scale * 0.3)}px Unbounded, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('REPORT!', sx(b.x), sy(b.z));
    }
    // mermiler
    for (const pr of game.projs) disc(pr.x, pr.z, pr.kind.startsWith('tower') ? 0.25 : 0.15, pr.kind === 'tower-r' ? col.jade : pr.kind === 'ice' ? col.ice : pr.kind === 'spark' ? '#5fb8ff' : col.dire);
    // oyuncu
    const heroCol = game.H ? game.H.color : col.jade;
    if (playing || game.state === 'idle') {
      if (game.target) ring(game.target.x, game.target.z, 0.75, col.dire, 2, [6, 4]);
      if (p.charging) {
        const L = 11 + 13 * p.charge;
        g.strokeStyle = hexA(p.charge > 0.97 ? col.gold : col.ember, 0.6);
        g.lineWidth = 3 + p.charge * 6;
        g.beginPath();
        g.moveTo(sx(p.x), sy(p.z));
        g.lineTo(sx(p.x + Math.sin(p.face) * L), sy(p.z + Math.cos(p.face) * L));
        g.stroke();
      }
      if (p.channel) ring(p.x, p.z, 4.8, hexA(col.ice, 0.7), 2, [8, 6]);
      ring(p.x, p.z, 0.6, p.windrun > 0 ? col.jade : hexA(heroCol, 0.7), p.aegis ? 4 : 2);
      g.save();
      g.globalAlpha = p.invis > 0 ? 0.35 : 1;
      g.translate(sx(p.x), sy(p.z));
      g.rotate(-p.face + Math.PI);
      g.fillStyle = p.hurtT > 0 ? col.dire : heroCol;
      g.beginPath();
      g.moveTo(0, -scale * 0.6);
      g.lineTo(scale * 0.4, scale * 0.4);
      g.lineTo(-scale * 0.4, scale * 0.4);
      g.closePath();
      g.fill();
      g.restore();
    }
    // kurye
    const c = game.courier;
    if (c.state !== 'home') {
      disc(c.x, c.z, 0.35, '#8a6a4a');
      ring(c.x, c.z, 0.45, col.gold, 2);
    }
    // oklar
    g.strokeStyle = col.gold;
    for (const a of game.arrows) {
      g.lineWidth = 2 + a.charge * 4;
      g.beginPath();
      g.moveTo(sx(a.x), sy(a.z));
      g.lineTo(sx(a.x - a.dx * 0.8), sy(a.z - a.dz * 0.8));
      g.stroke();
    }
    // gece: görüş dairesi dışını karart
    if (game.isNight && playing) {
      const vr = (game.visionR ? game.visionR() : 8.5) * scale;
      const gr = g.createRadialGradient(sx(p.x), sy(p.z), vr * 0.6, sx(p.x), sy(p.z), vr * 1.15);
      gr.addColorStop(0, 'rgba(6,8,22,0)');
      gr.addColorStop(1, 'rgba(6,8,22,0.62)');
      g.fillStyle = gr;
      g.fillRect(-20, -20, W + 40, H + 40);
    }
    // kıvılcımlar
    const sd = simDt || 0;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= sd || dt * 0.2;
      s.x += s.vx * sd;
      s.z += s.vz * sd;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      g.fillStyle = hexA(s.color, s.life * 2);
      g.fillRect(sx(s.x) - 2, sy(s.z) - 2, 4, 4);
    }
  }

  function dispose() {
    canvas.remove();
  }

  return {
    kind: '2d', canvas, resize, render, project, groundAt, event, shake, dispose,
    modelInfo: () => ({}), setFrame: (f) => { frame = { ...frame, ...f }; }, preload: () => {},
  };
}
