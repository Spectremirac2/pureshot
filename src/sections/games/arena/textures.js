// 1vDOQUZ Arena — prosedürel canvas dokuları.
// fal.ai varlıkları yokken arena zemini, duvar, parıltı, halka ve etiketler burada çizilir.

import * as THREE from 'three';
import { seeded } from '../../../core/dom.js';

/** Tasarım jetonunu (CSS değişkeni) okur; canvas/three renkleri jetonlardan beslensin. */
export function tok(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

export function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function toTexture(c, { srgb = true, repeat = null, mips = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (!mips) {
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
  }
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

// ------------------------------------------------------------------ zemin
function crack(g, e, rnd, x, y, len, ember) {
  const pts = [[x, y]];
  let a = rnd() * Math.PI * 2;
  for (let i = 0; i < len; i++) {
    a += (rnd() - 0.5) * 0.9;
    x += Math.cos(a) * (5 + rnd() * 6);
    y += Math.sin(a) * (5 + rnd() * 6);
    pts.push([x, y]);
    if (rnd() < 0.06) crack(g, e, rnd, x, y, Math.floor(len * 0.4), ember);
  }
  const path = (ctx) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  };
  g.strokeStyle = 'rgba(6,4,10,0.85)';
  g.lineWidth = 3.2;
  path(g);
  g.stroke();
  g.strokeStyle = hexA(ember, 0.55);
  g.lineWidth = 1.2;
  path(g);
  g.stroke();
  // kor parıltısı (emissive)
  e.save();
  e.shadowColor = ember;
  e.shadowBlur = 10;
  e.strokeStyle = ember;
  e.lineWidth = 2.2;
  path(e);
  e.stroke();
  e.shadowBlur = 0;
  e.strokeStyle = '#ffd9a0';
  e.lineWidth = 0.9;
  path(e);
  e.stroke();
  e.restore();
}

function paw(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.18, s * 0.34, s * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  const toes = [[-0.36, -0.2], [-0.13, -0.42], [0.13, -0.42], [0.36, -0.2]];
  for (const [tx, ty] of toes) {
    ctx.beginPath();
    ctx.ellipse(cx + tx * s, cy + ty * s, s * 0.12, s * 0.15, tx * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Dairesel taş arena zemini: halka halka döşenmiş taşlar, kor çatlakları,
 * ortada kazınmış "1vDOQUZ · DOG DOG DOG" yazılı pati mührü.
 * { map, glow } canvas döndürür (glow = emissive haritası).
 */
export function floorCanvases(S = 1024, { withStones = true } = {}) {
  const ember = tok('--ember', '#ff6a2b');
  const gold = tok('--aegis', '#e9b949');
  const rnd = seeded(1337);
  const base = makeCanvas(S, S);
  const glow = makeCanvas(S, S);
  const g = base.getContext('2d');
  const e = glow.getContext('2d');
  const C = S / 2;
  e.fillStyle = '#000';
  e.fillRect(0, 0, S, S);

  if (withStones) {
    g.fillStyle = '#120f19';
    g.fillRect(0, 0, S, S);
    const rMax = C * 0.998;
    let r = C * 0.215;
    const ringW = C * 0.082;
    while (r < rMax) {
      const r2 = Math.min(rMax, r + ringW * (0.8 + rnd() * 0.4));
      const circ = Math.PI * (r + r2);
      const n = Math.max(7, Math.round(circ / (ringW * (1.4 + rnd() * 0.5))));
      const off = rnd() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a0 = off + (i / n) * Math.PI * 2;
        const a1 = off + ((i + 1) / n) * Math.PI * 2;
        const gap = 3 / ((r + r2) / 2);
        const l = 17 + rnd() * 11;
        const hue = 250 + rnd() * 30;
        const grad = g.createRadialGradient(C, C, r, C, C, r2);
        grad.addColorStop(0, `hsl(${hue}, ${7 + rnd() * 7}%, ${l + 4}%)`);
        grad.addColorStop(1, `hsl(${hue}, ${6 + rnd() * 6}%, ${l - 3}%)`);
        g.fillStyle = grad;
        g.beginPath();
        g.arc(C, C, r2 - 2, a0 + gap, a1 - gap);
        g.arc(C, C, r + 2, a1 - gap, a0 + gap, true);
        g.closePath();
        g.fill();
        // yıpranma lekeleri
        if (rnd() < 0.35) {
          const am = (a0 + a1) / 2;
          const rm = (r + r2) / 2;
          g.fillStyle = `rgba(0,0,0,${0.12 + rnd() * 0.15})`;
          g.beginPath();
          g.ellipse(C + Math.cos(am) * rm, C + Math.sin(am) * rm, ringW * (0.2 + rnd() * 0.3), ringW * (0.15 + rnd() * 0.2), am, 0, Math.PI * 2);
          g.fill();
        }
      }
      r = r2;
    }
    // gren
    for (let i = 0; i < (S * S) / 70; i++) {
      const v = rnd() < 0.5 ? 0 : 255;
      g.fillStyle = `rgba(${v},${v},${v},${0.035 + rnd() * 0.05})`;
      g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    // merkez mühür diski
    const disc = g.createRadialGradient(C, C, 0, C, C, C * 0.215);
    disc.addColorStop(0, '#2a2236');
    disc.addColorStop(1, '#1a1523');
    g.fillStyle = disc;
    g.beginPath();
    g.arc(C, C, C * 0.21, 0, Math.PI * 2);
    g.fill();
  } else {
    g.clearRect(0, 0, S, S);
  }

  // Çatlaklar (hem harita hem parıltı). fal dokusu kendi çatlaklarını getirir; o zaman çizme.
  for (let i = 0; i < (withStones ? 30 : 0); i++) {
    const a = rnd() * Math.PI * 2;
    const rr = C * (0.3 + rnd() * 0.62);
    crack(g, e, rnd, C + Math.cos(a) * rr, C + Math.sin(a) * rr, 18 + Math.floor(rnd() * 34), ember);
  }

  // Kazınmış halka yazısı
  const ringText = '1vDOQUZ ✦ DOG DOG DOG ✦ 1vDOQUZ ✦ DOG DOG DOG ✦ ';
  const tr = C * 0.165;
  const fs = Math.round(S * 0.026);
  const drawRingText = (ctx, color, blur) => {
    ctx.save();
    ctx.translate(C, C);
    // Cinzel küçük harfleri büyük harf gibi çizer ("1vDOQUZ" → "IVDOQUZ"); özel yazım için Unbounded
    ctx.font = `800 ${fs}px Unbounded, "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    if (blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
    // Harfleri gerçek genişliklerine göre yay boyunca diz (eşit açı geniş harfleri üst üste bindiriyordu)
    const chars = [...ringText];
    const circ = Math.PI * 2 * tr;
    let widths = chars.map((ch) => ctx.measureText(ch).width);
    let total = widths.reduce((a, b) => a + b, 0);
    if (total > circ * 0.9) {
      const k = (circ * 0.9) / total;
      ctx.font = ctx.font.replace(/(\d+(?:\.\d+)?)px/, (m, n) => `${Math.floor(Number(n) * k)}px`);
      widths = chars.map((ch) => ctx.measureText(ch).width);
      total = widths.reduce((a, b) => a + b, 0);
    }
    const gap = (circ - total) / chars.length;
    let acc = 0;
    chars.forEach((ch, i) => {
      const center = acc + widths[i] / 2;
      acc += widths[i] + gap;
      ctx.save();
      ctx.rotate(center / tr - Math.PI / 2);
      ctx.translate(0, -tr);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  };
  const ringLines = (ctx, color, w) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    for (const rr of [C * 0.2, C * 0.13]) {
      ctx.beginPath();
      ctx.arc(C, C, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
  };
  if (withStones) {
    drawRingText(g, 'rgba(6,4,10,0.9)', 0);
    ringLines(g, 'rgba(6,4,10,0.9)', 4);
    g.fillStyle = 'rgba(6,4,10,0.9)';
    paw(g, C, C, C * 0.16);
  }
  drawRingText(e, hexA(gold, 0.6), 5);
  ringLines(e, hexA(gold, 0.45), 2);
  e.save();
  e.shadowColor = ember;
  e.shadowBlur = 14;
  e.strokeStyle = hexA(ember, 0.7);
  e.lineWidth = S * 0.004;
  e.fillStyle = hexA(ember, 0.22);
  paw(e, C, C, C * 0.12);
  e.restore();
  // dış altın kakma halkası
  e.strokeStyle = hexA(gold, 0.28);
  e.lineWidth = 3;
  e.beginPath();
  e.arc(C, C, C * 0.955, 0, Math.PI * 2);
  e.stroke();
  // 1v9 ok izleri: merkezden dokuz ince ışın
  e.strokeStyle = hexA(ember, 0.12);
  e.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 - Math.PI / 2;
    e.beginPath();
    e.moveTo(C + Math.cos(a) * C * 0.22, C + Math.sin(a) * C * 0.22);
    e.lineTo(C + Math.cos(a) * C * 0.9, C + Math.sin(a) * C * 0.9);
    e.stroke();
  }
  return { map: base, glow };
}

/** Arena dışı kayalık zemin (koyu, tekrarlı). */
export function rockCanvas(S = 256) {
  const rnd = seeded(77);
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  g.fillStyle = '#0e0b14';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 140; i++) {
    g.fillStyle = `rgba(${40 + rnd() * 30},${30 + rnd() * 20},${50 + rnd() * 30},${0.2 + rnd() * 0.3})`;
    g.beginPath();
    g.ellipse(rnd() * S, rnd() * S, 4 + rnd() * 18, 3 + rnd() * 12, rnd() * 3, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 2000; i++) {
    g.fillStyle = `rgba(255,255,255,${rnd() * 0.04})`;
    g.fillRect(rnd() * S, rnd() * S, 1, 1);
  }
  return c;
}

/** Duvar tuğlaları (yatay tekrarlı). */
export function wallCanvas(W = 512, H = 256) {
  const rnd = seeded(4242);
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#0c0a12';
  g.fillRect(0, 0, W, H);
  const rows = 5;
  const bh = H / rows;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? 0 : 40;
    let x = -off;
    while (x < W) {
      const bw = 70 + rnd() * 50;
      const l = 14 + rnd() * 10;
      g.fillStyle = `hsl(${255 + rnd() * 20}, ${8 + rnd() * 6}%, ${l}%)`;
      g.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect(x + 3, r * bh + 3, bw - 6, 3);
      x += bw;
    }
  }
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = `rgba(0,0,0,${rnd() * 0.25})`;
    g.fillRect(rnd() * W, rnd() * H, 2, 2);
  }
  // alt kısımda kor yansıması
  const grd = g.createLinearGradient(0, H * 0.55, 0, H);
  grd.addColorStop(0, 'rgba(255,106,43,0)');
  grd.addColorStop(1, 'rgba(255,106,43,0.10)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  return c;
}

/** Yumuşak radyal parıltı (sprite'lar için). */
export function glowCanvas(S = 128) {
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  return c;
}

/** Alev dili (dikey, sprite). */
export function flameCanvas(W = 64, H = 128) {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(W / 2, H * 0.72, 2, W / 2, H * 0.62, H * 0.55);
  grd.addColorStop(0, 'rgba(255,245,220,1)');
  grd.addColorStop(0.25, 'rgba(255,190,90,0.95)');
  grd.addColorStop(0.55, 'rgba(255,106,43,0.55)');
  grd.addColorStop(1, 'rgba(224,53,75,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(W / 2, 0);
  g.bezierCurveTo(W * 0.95, H * 0.45, W * 0.98, H * 0.8, W / 2, H);
  g.bezierCurveTo(W * 0.02, H * 0.8, W * 0.05, H * 0.45, W / 2, 0);
  g.fill();
  return c;
}

/** Zemin halkası. dashed: dönen seçim halkası görünümü. */
export function ringCanvas(S = 256, { dashed = false, width = 0.07, soft = true } = {}) {
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const C = S / 2;
  const r = C * (1 - width) - 2;
  g.strokeStyle = '#fff';
  g.lineWidth = C * width;
  if (soft) { g.shadowColor = '#fff'; g.shadowBlur = C * 0.08; }
  if (dashed) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      g.beginPath();
      g.arc(C, C, r, (i / n) * Math.PI * 2, ((i + 0.62) / n) * Math.PI * 2);
      g.stroke();
    }
  } else {
    g.beginPath();
    g.arc(C, C, r, 0, Math.PI * 2);
    g.stroke();
  }
  if (soft) {
    const grd = g.createRadialGradient(C, C, r * 0.5, C, C, r);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(1, 'rgba(255,255,255,0.22)');
    g.shadowBlur = 0;
    g.fillStyle = grd;
    g.beginPath();
    g.arc(C, C, r, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/** Nişan çizgisi: yatay degrade + köşeli oklar (şarj göstergesi). */
export function chargeLineCanvas(W = 512, H = 64) {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0, 'rgba(255,255,255,0.0)');
  grd.addColorStop(0.08, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0.95)');
  g.fillStyle = grd;
  g.fillRect(0, H * 0.4, W, H * 0.2);
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 5;
  for (let x = 40; x < W - 20; x += 46) {
    g.globalAlpha = 0.25 + (x / W) * 0.75;
    g.beginPath();
    g.moveTo(x, H * 0.18);
    g.lineTo(x + 16, H * 0.5);
    g.lineTo(x, H * 0.82);
    g.stroke();
  }
  g.globalAlpha = 1;
  return c;
}

/** Dikey ışık sütunu (Aegis). */
export function beamCanvas(W = 64, H = 256) {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const gx = g.createLinearGradient(0, 0, W, 0);
  gx.addColorStop(0, 'rgba(255,255,255,0)');
  gx.addColorStop(0.5, 'rgba(255,255,255,1)');
  gx.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gx;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-in';
  const gy = g.createLinearGradient(0, 0, 0, H);
  gy.addColorStop(0, 'rgba(0,0,0,0)');
  gy.addColorStop(0.7, 'rgba(0,0,0,0.8)');
  gy.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = gy;
  g.fillRect(0, 0, W, H);
  return c;
}

/** Kapı sancağı: koyu kumaş üzerinde kor pati mührü. team: 'radiant' | 'dire' | undefined (eski görünüm). */
export function bannerCanvas(W = 128, H = 256, team = null) {
  const ember = team === 'radiant' ? '#8ff0c9' : team === 'dire' ? '#ff4d5e' : tok('--ember', '#ff6a2b');
  const gold = tok('--aegis', '#e9b949');
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, team === 'radiant' ? '#14402c' : '#3a1420');
  grd.addColorStop(1, team === 'radiant' ? '#0a1f16' : '#1c0a12');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(W, 0);
  g.lineTo(W, H);
  g.lineTo(W / 2, H * 0.84);
  g.lineTo(0, H);
  g.closePath();
  g.fill();
  g.strokeStyle = gold;
  g.lineWidth = 4;
  g.stroke();
  g.fillStyle = ember;
  paw(g, W / 2, H * 0.42, W * 0.36);
  return c;
}

/** "REPORT!" konuşma balonu (Chat Köpeği mermisi). */
export function reportCanvas(W = 256, H = 128) {
  const dire = tok('--dire', '#e0354b');
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#fff6ea';
  g.strokeStyle = dire;
  g.lineWidth = 8;
  const r = 26;
  g.beginPath();
  g.moveTo(12 + r, 12);
  g.lineTo(W - 12 - r, 12);
  g.quadraticCurveTo(W - 12, 12, W - 12, 12 + r);
  g.lineTo(W - 12, H - 38 - r);
  g.quadraticCurveTo(W - 12, H - 38, W - 12 - r, H - 38);
  g.lineTo(W * 0.42, H - 38);
  g.lineTo(W * 0.3, H - 6);
  g.lineTo(W * 0.3, H - 38);
  g.lineTo(12 + r, H - 38);
  g.quadraticCurveTo(12, H - 38, 12, H - 38 - r);
  g.lineTo(12, 12 + r);
  g.quadraticCurveTo(12, 12, 12 + r, 12);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = dire;
  g.font = '900 44px Unbounded, "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('REPORT!', W / 2, (H - 38) / 2 + 8, W - 40);
  return c;
}
