// Kahraman armaları: DOG% halkalı madalyon. Madalyonda kahramanın resmi portresi (Valve) durur;
// portre yoksa prosedürel yedek çizilir (özellik şekli + rengi ve kısaltma).
//   crestSvg(hero, { value, size, cls })  → <svg> (kartlar, detay, tier listesi)
//   drawCrestCanvas(g, x, y, size, hero, value, { img }) → doku atlası hücresi (3D sikkeler)
//   loadPortraits(heroes) → Map<id, portre> (canvas'a çizmek için; önce tek istekli portre atlası)

import { h } from '../../core/dom.js';
import { ATTRS } from '../../data/heroes.js';
import { heroPortraitUrl } from '../../core/assets.js';

// Portre atlası (scripts/build-hero-atlas.mjs): her portrenin orta karesi tek WebP'de; 127 istek yerine 1.
// Dosya yoksa (atlas üretilmemişse) boş kalır ve portreler tek tek yüklenir.
const ATLAS_URL = Object.values(import.meta.glob('../../assets/heroes/atlas/portraits.webp', { eager: true, query: '?url', import: 'default' }))[0] || null;
const ATLAS_INDEX = Object.values(import.meta.glob('../../assets/heroes/atlas/portraits.json', { eager: true, import: 'default' }))[0] || null;

// Özellik şekilleri (viewBox 0 0 100 100, merkez 50,50)
const hexPts = (r, rot = -90) => Array.from({ length: 6 }, (_, i) => {
  const a = ((rot + i * 60) * Math.PI) / 180;
  return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r];
});
const octPts = (r) => Array.from({ length: 8 }, (_, i) => {
  const a = ((-90 + 22.5 + i * 45) * Math.PI) / 180;
  return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r];
});
const toPts = (arr) => arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

const SHAPES = {
  // Güç: kalkan
  str: (s) => ({ tag: 'path', d: shieldPath(s) }),
  // Çeviklik: elmas
  agi: (s) => ({ tag: 'polygon', points: toPts([[50, 50 - 40 * s], [50 + 36 * s, 50], [50, 50 + 40 * s], [50 - 36 * s, 50]]) }),
  // Zekâ: altıgen
  int: (s) => ({ tag: 'polygon', points: toPts(hexPts(38 * s)) }),
  // Evrensel: sekizgen
  uni: (s) => ({ tag: 'polygon', points: toPts(octPts(38 * s)) }),
};

function shieldPath(s) {
  const p = (x, y) => `${(50 + (x - 50) * s).toFixed(1)} ${(50 + (y - 50) * s).toFixed(1)}`;
  return `M${p(50, 12)} L${p(82, 22)} L${p(81, 50)} C${p(79, 70)} ${p(66, 82)} ${p(50, 89)} C${p(34, 82)} ${p(21, 70)} ${p(19, 50)} L${p(18, 22)} Z`;
}

function shapeEl(attr, scale, cls) {
  const def = (SHAPES[attr] || SHAPES.uni)(scale);
  return def.tag === 'path' ? h('path', { d: def.d, class: cls }) : h('polygon', { points: def.points, class: cls });
}

const abbrSize = (abbr, attr) => (abbr.length <= 2 ? 23 : abbr.length === 3 ? 18 : 13) * (attr === 'agi' ? 0.88 : 1);

let clipSeq = 0;

/**
 * SVG arma. value: 0–100 DOG% (halka). ring=false ise halka çizilmez.
 * Kahramanın portresi varsa madalyonda portre, yoksa özellik şekli + kısaltma çizilir.
 */
export function crestSvg(hero, { value = hero.dogRate, ring = true, cls = '', title = null } = {}) {
  const v = Math.max(0, Math.min(100, value));
  const img = heroPortraitUrl(hero.id);
  const svg = h('svg', {
    viewBox: '0 0 100 100',
    class: `hr-crest hr-a-${hero.attr} ${img ? 'has-img' : ''} ${cls}`,
    role: title ? 'img' : null,
    'aria-hidden': title ? null : 'true',
    'aria-label': title,
  },
    ring ? h('circle', { cx: '50', cy: '50', r: '46', class: 'hr-crest-track' }) : null,
    ring ? h('circle', {
      cx: '50', cy: '50', r: '46',
      class: 'hr-crest-ring',
      pathLength: '100',
      'stroke-dasharray': `${v.toFixed(1)} 100`,
      transform: 'rotate(-90 50 50)',
    }) : null,
  );
  if (img) {
    const r = ring ? 38 : 46;
    const id = `hr-clip-${++clipSeq}`;
    svg.append(
      h('defs', null, h('clipPath', { id }, h('circle', { cx: '50', cy: '50', r: String(r) }))),
      h('circle', { cx: '50', cy: '50', r: String(r + 2.5), class: 'hr-crest-rim' }),
      // 16:9 portre dairenin ortasından kırpılır; yüz genelde merkezde
      h('image', { href: img, x: String(50 - r * 16 / 9), y: String(50 - r), width: String(r * 32 / 9), height: String(r * 2), preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${id})`, class: 'hr-crest-img' }),
    );
    return svg;
  }
  svg.append(
    shapeEl(hero.attr, ring ? 0.86 : 1, 'hr-crest-outer'),
    shapeEl(hero.attr, ring ? 0.72 : 0.84, 'hr-crest-inner'),
    shapeEl(hero.attr, ring ? 0.72 : 0.84, 'hr-crest-tint'),
    h('text', {
      x: '50', y: '50',
      class: 'hr-crest-text',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-size': (abbrSize(hero.abbr, hero.attr) * (ring ? 1 : 1.12)).toFixed(1),
    }, hero.abbr),
  );
  return svg;
}

/** Halka değerini güncelle (yeniden çizmeden). */
export function setCrestValue(svg, value) {
  const ring = svg && svg.querySelector('.hr-crest-ring');
  if (ring) ring.setAttribute('stroke-dasharray', `${Math.max(0, Math.min(100, value)).toFixed(1)} 100`);
}

// ------------------------------------------------------------------ canvas
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function traceShape(g, attr, cx, cy, r) {
  g.beginPath();
  if (attr === 'str') {
    const P = (x, y) => [cx + ((x - 50) / 40) * r, cy + ((y - 50) / 40) * r];
    g.moveTo(...P(50, 12));
    g.lineTo(...P(82, 22));
    g.lineTo(...P(81, 50));
    g.bezierCurveTo(...P(79, 70), ...P(66, 82), ...P(50, 89));
    g.bezierCurveTo(...P(34, 82), ...P(21, 70), ...P(19, 50));
    g.lineTo(...P(18, 22));
  } else if (attr === 'agi') {
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r * 0.9, cy);
    g.lineTo(cx, cy + r);
    g.lineTo(cx - r * 0.9, cy);
  } else {
    const n = attr === 'int' ? 6 : 8;
    const off = attr === 'int' ? -90 : -90 + 22.5;
    for (let i = 0; i < n; i++) {
      const a = ((off + (i * 360) / n) * Math.PI) / 180;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
  }
  g.closePath();
}

/**
 * Sikke yüzü: dairesel madalyon, altın kenar, DOG% yayı; portre (varsa) ya da özellik şekli + kısaltma; yüzde.
 * img: HTMLImageElement (16:9 portre) ya da atlas hücresi { sheet, sx, sy, size } (portrenin orta karesi).
 */
export function drawCrestCanvas(g, x, y, size, hero, value = hero.dogRate, { percent = true, img = null } = {}) {
  const col = (ATTRS[hero.attr] || ATTRS.uni).color;
  const cx = x + size / 2, cy = y + size / 2;
  const R = size * 0.485;
  g.save();
  // zemin
  const bg = g.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.08, cx, cy, R);
  bg.addColorStop(0, mixHex(col, '#ffffff', 0.35));
  bg.addColorStop(0.5, col);
  bg.addColorStop(1, mixHex(col, '#0d0b14', 0.7));
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fillStyle = bg;
  g.fill();
  // altın kenar
  g.lineWidth = size * 0.04;
  g.strokeStyle = '#e9b949';
  g.beginPath();
  g.arc(cx, cy, R - g.lineWidth / 2, 0, Math.PI * 2);
  g.stroke();
  // DOG% yayı
  const rr = R * 0.8;
  g.lineWidth = size * 0.075;
  g.strokeStyle = 'rgba(13,11,20,0.62)';
  g.beginPath();
  g.arc(cx, cy, rr, 0, Math.PI * 2);
  g.stroke();
  const v = Math.max(0, Math.min(100, value)) / 100;
  const arc = g.createLinearGradient(cx - rr, cy - rr, cx + rr, cy + rr);
  arc.addColorStop(0, '#ffd08a');
  arc.addColorStop(1, '#ff6a2b');
  g.strokeStyle = arc;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, v));
  g.stroke();
  // iç madalyon
  g.beginPath();
  g.arc(cx, cy, R * 0.66, 0, Math.PI * 2);
  g.fillStyle = 'rgba(13,11,20,0.82)';
  g.fill();
  if (img) {
    // portre: iç madalyona kırpılmış, 16:9 görselin ortası
    const ir = R * 0.66;
    g.save();
    g.beginPath();
    g.arc(cx, cy, ir, 0, Math.PI * 2);
    g.clip();
    if (img.sheet) {
      // atlas hücresi zaten orta kare: madalyonu tam kaplar
      g.drawImage(img.sheet, img.sx, img.sy, img.size, img.size, cx - ir, cy - ir, ir * 2, ir * 2);
    } else {
      const ih = ir * 2, iw = ih * (img.naturalWidth / img.naturalHeight || 16 / 9);
      g.drawImage(img, cx - iw / 2, cy - ir, iw, ih);
    }
    if (percent) {
      const shade = g.createLinearGradient(0, cy, 0, cy + ir);
      shade.addColorStop(0, 'rgba(13,11,20,0)');
      shade.addColorStop(1, 'rgba(13,11,20,0.92)');
      g.fillStyle = shade;
      g.fillRect(cx - ir, cy, ir * 2, ir);
    }
    g.restore();
    g.lineWidth = size * 0.022;
    g.strokeStyle = col;
    g.beginPath();
    g.arc(cx, cy, ir, 0, Math.PI * 2);
    g.stroke();
    if (percent) {
      g.font = `700 ${Math.round(size * 0.11)}px "JetBrains Mono", ui-monospace, monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0,0,0,0.9)';
      g.shadowBlur = size * 0.03;
      g.fillStyle = '#ffd08a';
      g.fillText(`%${Math.round(value)}`, cx, cy + R * 0.45);
    }
    g.restore();
    return;
  }
  // özellik şekli
  traceShape(g, hero.attr, cx, cy - R * 0.02, R * 0.56);
  g.fillStyle = mixHex(col, '#0d0b14', 0.62);
  g.fill();
  g.lineWidth = size * 0.018;
  g.strokeStyle = col;
  g.stroke();
  // kısaltma
  const len = hero.abbr.length;
  const fs = size * (len <= 2 ? 0.25 : len === 3 ? 0.2 : 0.165);
  g.font = `900 ${Math.round(fs)}px Unbounded, "Arial Black", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.8)';
  g.shadowBlur = size * 0.03;
  g.fillStyle = '#fff3dc';
  g.fillText(hero.abbr, cx, cy - (percent ? size * 0.04 : 0), R * 1.1);
  if (percent) {
    g.shadowBlur = 0;
    g.font = `700 ${Math.round(size * 0.11)}px "JetBrains Mono", ui-monospace, monospace`;
    g.fillStyle = '#ffb27a';
    g.fillText(`%${Math.round(value)}`, cx, cy + R * 0.38);
  }
  g.restore();
}

function loadImage(url) {
  return new Promise((resolve) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = url;
  });
}

/**
 * Kahraman portrelerini canvas'a çizilecek şekilde yükler. Önce tek istekli atlas denenir; atlasta olmayan
 * kahramanlar (ya da atlas yüklenemezse hepsi) tek tek portre dosyalarından gelir. Yüklenemeyenler atlanır
 * (o sikke prosedürel armayla kalır). Promise<Map<id, HTMLImageElement | { sheet, sx, sy, size }>>
 */
export async function loadPortraits(heroes) {
  const out = new Map();
  let rest = heroes;
  const sheet = ATLAS_URL && ATLAS_INDEX ? await loadImage(ATLAS_URL) : null;
  if (sheet) {
    const { cell, cols, ids } = ATLAS_INDEX;
    const at = new Map(ids.map((id, i) => [id, i]));
    rest = heroes.filter((hero) => {
      const i = at.get(hero.id);
      if (i === undefined) return true;
      out.set(hero.id, { sheet, sx: (i % cols) * cell, sy: Math.floor(i / cols) * cell, size: cell });
      return false;
    });
  }
  const singles = await Promise.all(rest.map(async (hero) => {
    const url = heroPortraitUrl(hero.id);
    const im = url ? await loadImage(url) : null;
    return im ? [hero.id, im] : null;
  }));
  for (const pair of singles) if (pair) out.set(pair[0], pair[1]);
  return out;
}

/** Canvas yazı tiplerinin yüklenmesini (en fazla ~1.2 sn) bekler. */
export function fontsReady() {
  try {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.race([
      Promise.all([
        document.fonts.load('900 40px Unbounded'),
        document.fonts.load('700 20px "JetBrains Mono"'),
      ]).catch(() => {}),
      new Promise((r) => setTimeout(r, 1200)),
    ]);
  } catch {
    return Promise.resolve();
  }
}

/** Türkçe duyarlı arama normalizasyonu. */
export function normTr(s) {
  return String(s || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/̇/g, '').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[âà]/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u')
    .replace(/[’'`´.\-_\s]+/g, '');
}
