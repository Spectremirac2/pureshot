// 1vDOQUZ Arena 3.0 — mini harita (canvas). Statik zemin bir kez çizilir; birimler ~8 fps güncellenir.
// Orman kampları (yeşil halka: dolu, sönük: boş), orman eşyaları, ward'lar, gece karartması; gece görüş dışındaki düşmanlar gizli.

import { ARENA_R, RIVER_HALF, ISLAND_R, riverPoint, FOUNTAIN, ROSHAN_PIT, TREES, GATE_ANGLES, CAMPS } from './map.js';
import { RUNES, NEUTRALS } from './items.js';

export function createMinimap(canvas) {
  const g = canvas.getContext('2d');
  let size = 0;
  let dpr = 1;
  let bg = null;
  let acc = 1;
  const R = ARENA_R + 0.4;

  function build(px) {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    size = px;
    canvas.width = Math.round(px * dpr);
    canvas.height = Math.round(px * dpr);
    bg = document.createElement('canvas');
    bg.width = canvas.width;
    bg.height = canvas.height;
    const b = bg.getContext('2d');
    const S = canvas.width;
    const X = (x) => (x / R * 0.5 + 0.5) * S;
    const Z = (z) => (z / R * 0.5 + 0.5) * S;
    const U = (d) => (d / R) * 0.5 * S;
    b.save();
    b.beginPath();
    b.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
    b.clip();
    b.fillStyle = '#1d3a26';
    b.fillRect(0, 0, S, S);
    b.fillStyle = '#3a1820';
    b.beginPath();
    b.moveTo(0, 0);
    b.lineTo(S, 0);
    b.lineTo(S, S);
    b.closePath();
    b.fill();
    b.lineCap = 'round';
    b.strokeStyle = '#2a7fa6';
    b.lineWidth = U(RIVER_HALF * 2);
    b.beginPath();
    for (let s = -16; s <= 16; s += 0.5) {
      const p = riverPoint(s);
      if (s === -16) b.moveTo(X(p.x), Z(p.z));
      else b.lineTo(X(p.x), Z(p.z));
    }
    b.stroke();
    b.fillStyle = '#2a2236';
    b.beginPath();
    b.arc(X(0), Z(0), U(ISLAND_R), 0, Math.PI * 2);
    b.fill();
    for (const t of TREES) {
      b.fillStyle = t.dire ? 'rgba(20,6,10,0.75)' : 'rgba(10,40,20,0.8)';
      b.beginPath();
      b.arc(X(t.x), Z(t.z), Math.max(1.5, U(0.5)), 0, Math.PI * 2);
      b.fill();
    }
    b.fillStyle = 'rgba(67,214,160,0.7)';
    b.beginPath();
    b.arc(X(FOUNTAIN.x), Z(FOUNTAIN.z), U(1.4), 0, Math.PI * 2);
    b.fill();
    b.fillStyle = 'rgba(0,0,0,0.75)';
    b.beginPath();
    b.arc(X(ROSHAN_PIT.x), Z(ROSHAN_PIT.z), U(ROSHAN_PIT.r), 0, Math.PI * 2);
    b.fill();
    b.restore();
    b.strokeStyle = 'rgba(233,185,73,0.55)';
    b.lineWidth = 2 * dpr;
    b.beginPath();
    b.arc(S / 2, S / 2, S / 2 - dpr, 0, Math.PI * 2);
    b.stroke();
    b.fillStyle = 'rgba(233,185,73,0.9)';
    for (const a of GATE_ANGLES) {
      b.beginPath();
      b.arc(X(Math.sin(a) * ARENA_R), Z(Math.cos(a) * ARENA_R), 2 * dpr, 0, Math.PI * 2);
      b.fill();
    }
  }

  function draw(game, dt, force = false) {
    const px = Math.round(canvas.clientWidth || 0);
    if (!px) return;
    if (px !== size || !bg) build(px);
    acc += dt;
    if (!force && acc < 0.12) return;
    acc = 0;
    const S = canvas.width;
    const X = (x) => (x / R * 0.5 + 0.5) * S;
    const Z = (z) => (z / R * 0.5 + 0.5) * S;
    const k = dpr;
    g.clearRect(0, 0, S, S);
    g.drawImage(bg, 0, 0);
    const night = !!game.isNight && game.state !== 'idle';
    if (night) {
      g.fillStyle = 'rgba(8,10,34,0.42)';
      g.beginPath();
      g.arc(S / 2, S / 2, S / 2 - dpr, 0, Math.PI * 2);
      g.fill();
    }
    // orman kampları
    for (const cp of CAMPS) {
      const st = game.camps && game.camps.find ? game.camps.find((c) => c.id === cp.id) : null;
      const alive = !!(st && st.alive > 0);
      g.strokeStyle = alive ? 'rgba(143,209,106,0.95)' : 'rgba(143,209,106,0.3)';
      g.lineWidth = 1.5 * k;
      g.beginPath();
      g.arc(X(cp.x), Z(cp.z), 4 * k, 0, Math.PI * 2);
      g.stroke();
    }
    // ward'lar
    for (const w of game.wards || []) {
      g.fillStyle = '#f6d98a';
      g.fillRect(X(w.x) - 1.5 * k, Z(w.z) - 3 * k, 3 * k, 6 * k);
      if (night) {
        g.fillStyle = 'rgba(246,217,138,0.12)';
        g.beginPath();
        g.arc(X(w.x), Z(w.z), (8 / R) * 0.5 * S, 0, Math.PI * 2);
        g.fill();
      }
    }
    // kuleler
    for (const t of game.towers) {
      g.fillStyle = t.dead ? 'rgba(120,110,120,0.5)' : t.side === 'radiant' ? '#43d6a0' : '#ff4a5a';
      const s = 5 * k;
      g.fillRect(X(t.x) - s / 2, Z(t.z) - s / 2, s, s);
      g.strokeStyle = 'rgba(0,0,0,0.8)';
      g.lineWidth = k;
      g.strokeRect(X(t.x) - s / 2, Z(t.z) - s / 2, s, s);
    }
    // rünler
    for (const r of game.runes) {
      g.fillStyle = RUNES[r.kind].color;
      g.beginPath();
      const x = X(r.x);
      const z = Z(r.z);
      g.moveTo(x, z - 4 * k);
      g.lineTo(x + 3.2 * k, z);
      g.lineTo(x, z + 4 * k);
      g.lineTo(x - 3.2 * k, z);
      g.closePath();
      g.fill();
    }
    for (const p of game.pickups) {
      if (p.kind !== 'aegis' && p.kind !== 'cheese' && p.kind !== 'rapierItem' && p.kind !== 'neutral') continue;
      g.fillStyle = p.kind === 'rapierItem' ? '#ff4a5a' : p.kind === 'neutral' ? (NEUTRALS[p.item] && NEUTRALS[p.item].color) || '#43d6a0' : '#f6d98a';
      g.beginPath();
      g.arc(X(p.x), Z(p.z), 3 * k, 0, Math.PI * 2);
      g.fill();
    }
    // düşmanlar
    for (const e of game.foes) {
      if (e.dead || e.demo) continue;
      if (e.seen === false) continue; // gece: görüş dışında
      if (e.type === 'ward' && e.vis < 0.35) continue;
      if (e.kind === 'boss') {
        g.fillStyle = (e.def && e.def.color) || '#e9b949';
        g.beginPath();
        g.arc(X(e.x), Z(e.z), 5 * k, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#1a0d05';
        g.lineWidth = 1.5 * k;
        g.stroke();
        continue;
      }
      g.fillStyle = e.kind === 'creep' ? '#c24a3a' : e.kind === 'neutral' ? '#d9b25a' : e.thief ? '#ffd84a' : '#ff3b4b';
      const s = (e.kind === 'creep' || e.kind === 'neutral' ? 2.2 : 3) * k;
      g.beginPath();
      g.arc(X(e.x), Z(e.z), s, 0, Math.PI * 2);
      g.fill();
    }
    // kurye
    const c = game.courier;
    if (c.state !== 'home') {
      g.fillStyle = '#f6d98a';
      g.beginPath();
      g.arc(X(c.x), Z(c.z), 2.6 * k, 0, Math.PI * 2);
      g.fill();
    }
    // kahraman
    const p = game.player;
    if (!p.dead) {
      g.save();
      g.translate(X(p.x), Z(p.z));
      g.rotate(-p.face + Math.PI);
      g.fillStyle = game.H ? game.H.color : '#43d6a0';
      g.strokeStyle = '#0b0912';
      g.lineWidth = 1.2 * k;
      g.beginPath();
      g.moveTo(0, -5.5 * k);
      g.lineTo(4 * k, 4 * k);
      g.lineTo(-4 * k, 4 * k);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    }
  }

  return { draw };
}
