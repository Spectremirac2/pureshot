// 1vDOQUZ Arena — WebGL yoksa zarif 2D yedek görüntü (üstten canvas).
// Aynı simülasyonu (game.js) çizer; 3D görüntüyle aynı arayüzü sunar.

import { ARENA_R, GATE_ANGLES } from './game.js';
import { DOG_TYPES, archOf } from './dogs.js';
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
  };
  let W = 16;
  let H = 9;
  let dpr = 1;
  let scale = 20;
  let cx = 0;
  let cz = 0;
  let time = 0;
  let shakeA = 0;
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
    if (type === 'hit') burst(d.dog.x, d.dog.z, archOf(d.dog.type).color, 6);
    if (type === 'kill') burst(d.dog.x, d.dog.z, col.gold, 14);
    if (type === 'hurt') { burst(p.x, p.z, col.dire, 6); shake(0.2); }
    if (type === 'ult') { burst(p.x, p.z, col.ember, 30); shake(0.6); }
    if (type === 'waveClear') burst(0, 0, col.gold, 40);
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

  function render(game, dt, simDt) {
    time += dt;
    const p = game.player;
    const playing = game.state !== 'idle' && game.state !== 'over';
    const tx = playing ? p.x * 0.7 : 0;
    const tz = playing ? p.z * 0.7 : 0;
    cx += (tx - cx) * Math.min(1, dt * 4);
    cz += (tz - cz) * Math.min(1, dt * 4);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (shakeA > 0) {
      g.translate((Math.random() - 0.5) * shakeA * 10, (Math.random() - 0.5) * shakeA * 10);
      shakeA = Math.max(0, shakeA - dt * 2);
    }
    g.fillStyle = col.bg;
    g.fillRect(-20, -20, W + 40, H + 40);
    // arena
    const grd = g.createRadialGradient(sx(0), sy(0), 0, sx(0), sy(0), ARENA_R * scale);
    grd.addColorStop(0, '#2a2236');
    grd.addColorStop(1, '#16121f');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(sx(0), sy(0), ARENA_R * scale, 0, Math.PI * 2);
    g.fill();
    for (let r = 2.5; r < ARENA_R; r += 2.2) ring(0, 0, r, 'rgba(255,255,255,0.05)', 1);
    ring(0, 0, ARENA_R, col.line, 4);
    for (const a of GATE_ANGLES) {
      const x = Math.sin(a) * ARENA_R;
      const z = Math.cos(a) * ARENA_R;
      g.fillStyle = hexA(col.ember, 0.35 + 0.15 * Math.sin(time * 8 + a));
      g.beginPath();
      g.arc(sx(x), sy(z), 0.8 * scale, 0, Math.PI * 2);
      g.fill();
    }
    // eşyalar
    for (const k of game.pickups) {
      g.fillStyle = col.gold;
      g.font = `900 ${Math.round(scale * 0.8)}px Unbounded, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      ring(k.x, k.z, 0.7 + Math.sin(time * 4) * 0.05, col.gold, 3);
      g.fillText(k.kind === 'aegis' ? 'A' : 'R', sx(k.x), sy(k.z));
    }
    // köpekler
    for (const d of game.dogs) {
      const c = archOf(d.type).color;
      let a = d.type === 'ward' ? d.vis : 1;
      if (d.dead) a = Math.max(0, 1 - d.deathT);
      g.globalAlpha = a;
      g.fillStyle = d.hitFlash > 0 ? '#fff' : DOG_TYPES[d.type].fur;
      g.beginPath();
      g.arc(sx(d.x), sy(d.z), d.r * scale * d.scale, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = c;
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = c;
      g.beginPath();
      g.arc(sx(d.x + Math.sin(d.face) * d.r * 0.7), sy(d.z + Math.cos(d.face) * d.r * 0.7), scale * 0.12, 0, Math.PI * 2);
      g.fill();
      if (!d.dead) {
        const bw = scale * 1.2;
        g.fillStyle = 'rgba(0,0,0,0.7)';
        g.fillRect(sx(d.x) - bw / 2, sy(d.z) - scale * 0.95, bw, 5);
        g.fillStyle = col.dire;
        g.fillRect(sx(d.x) - bw / 2, sy(d.z) - scale * 0.95, bw * Math.max(0, d.hp / d.maxHp), 5);
        g.fillStyle = col.text;
        g.font = `800 ${Math.max(9, Math.round(scale * 0.42))}px Unbounded, sans-serif`;
        g.textAlign = 'center';
        g.fillText(DOG_TYPES[d.type].short + (d.status === 'pause' ? ' ‖' : d.status === 'afk' ? ' zZ' : ''), sx(d.x), sy(d.z) - scale * 1.15);
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
    // oyuncu
    if (playing) {
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
      ring(p.x, p.z, 0.6, p.windrun > 0 ? col.jade : hexA(col.jade, 0.6), p.aegis ? 4 : 2);
      g.save();
      g.translate(sx(p.x), sy(p.z));
      g.rotate(-p.face + Math.PI);
      g.fillStyle = p.hurtT > 0 ? col.dire : col.jade;
      g.beginPath();
      g.moveTo(0, -scale * 0.6);
      g.lineTo(scale * 0.4, scale * 0.4);
      g.lineTo(-scale * 0.4, scale * 0.4);
      g.closePath();
      g.fill();
      g.restore();
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

  return { kind: '2d', canvas, resize, render, project, groundAt, event, shake, dispose, modelInfo: {} };
}
