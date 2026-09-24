// Arketip portresi: fal.ai görseli varsa <img>, yoksa arketip renginde prosedürel bir DOG arması (canvas).

import { h, hashStr, seeded } from '../core/dom.js';
import { portraitUrl } from '../core/assets.js';

const cache = new Map();

/** Prosedürel arma: altıgen kalkan, köpek kafası silueti, parıltılar. Data URL döndürür. */
export function proceduralPortrait(arch, size = 512, { label = true } = {}) {
  const key = arch.id + ':' + size + (label ? '' : ':nolabel');
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const rnd = seeded(hashStr(arch.id));
  const col = arch.color || '#ff6a2b';
  const s = size;

  // Zemin: gece gradyanı
  const bg = g.createRadialGradient(s * 0.5, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.75);
  bg.addColorStop(0, '#2a2140');
  bg.addColorStop(1, '#0b0912');
  g.fillStyle = bg;
  g.fillRect(0, 0, s, s);

  // Işın demetleri
  g.save();
  g.translate(s / 2, s * 0.46);
  for (let i = 0; i < 14; i++) {
    g.rotate((Math.PI * 2) / 14);
    g.fillStyle = hexA(col, 0.05 + rnd() * 0.05);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-s * 0.05, -s * 0.8);
    g.lineTo(s * 0.05, -s * 0.8);
    g.fill();
  }
  g.restore();

  // Kalkan
  const cx = s / 2, cy = s * 0.48, r = s * 0.34;
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
  const sh = g.createLinearGradient(0, cy - r, 0, cy + r);
  sh.addColorStop(0, hexA(col, 0.95));
  sh.addColorStop(1, shade(col, -0.55));
  g.fillStyle = sh;
  g.fill();
  g.lineWidth = s * 0.018;
  g.strokeStyle = '#e9b949';
  g.stroke();

  // Köpek kafası silueti
  g.fillStyle = '#120e1a';
  g.beginPath();
  g.ellipse(cx, cy + s * 0.03, s * 0.16, s * 0.14, 0, 0, Math.PI * 2);
  g.fill();
  // kulaklar
  const ear = (dir) => {
    g.beginPath();
    g.moveTo(cx + dir * s * 0.08, cy - s * 0.08);
    g.quadraticCurveTo(cx + dir * s * 0.2, cy - s * 0.24, cx + dir * s * 0.18, cy - s * 0.02);
    g.closePath();
    g.fill();
  };
  ear(-1); ear(1);
  // burun/ağız
  g.beginPath();
  g.ellipse(cx, cy + s * 0.12, s * 0.09, s * 0.065, 0, 0, Math.PI * 2);
  g.fill();
  // gözler (arketip rengi parıltı)
  g.shadowColor = col;
  g.shadowBlur = s * 0.04;
  g.fillStyle = '#fff5e0';
  g.beginPath(); g.arc(cx - s * 0.06, cy - s * 0.005, s * 0.022, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + s * 0.06, cy - s * 0.005, s * 0.022, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;
  g.fillStyle = col;
  g.beginPath(); g.arc(cx, cy + s * 0.095, s * 0.022, 0, Math.PI * 2); g.fill();

  // Kıvılcımlar
  for (let i = 0; i < 40; i++) {
    g.fillStyle = hexA(i % 3 ? '#ff9a3d' : '#e9b949', 0.3 + rnd() * 0.6);
    const x = rnd() * s, y = s * 0.55 + rnd() * s * 0.45;
    g.fillRect(x, y, 1 + rnd() * 2.5, 1 + rnd() * 2.5);
  }

  // Alt yazı şeridi (label: false ise çizilmez; üstüne başlık bindiren bileşenler için)
  if (label) {
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(0, s * 0.86, s, s * 0.14);
  g.fillStyle = '#f3eadb';
  g.font = `900 ${Math.round(s * 0.055)}px Unbounded, Arial Black, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(arch.name.toLocaleUpperCase('tr-TR'), s / 2, s * 0.93, s * 0.9);
  }

  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

/**
 * Portre elemanı. opts: { size (px, css genişliği için sadece ipucu), cls, alt }
 * fal görseli varsa onu, yoksa prosedürel armayı kullanır.
 */
export function portraitEl(arch, { cls = '', alt } = {}) {
  const real = portraitUrl(arch.id);
  return h('img', {
    class: `portrait ${cls}`,
    src: real || proceduralPortrait(arch, 512),
    alt: alt || `${arch.name} portresi`,
    loading: 'lazy',
    decoding: 'async',
    width: '512',
    height: '512',
    dataset: { generated: real ? 'fal' : 'procedural' },
  });
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + v * amt)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
