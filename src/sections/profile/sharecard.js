// Paylaşılabilir Fan Kartı görseli (1200×630, Open Graph oranı). Sitenin fontları ve renkleriyle canvas’a çizilir.
//   cardFontsReady()                 site fontlarının canvas için yüklenmesini bekler (en fazla ~1,5 sn)
//   loadImage(url)                   Promise<HTMLImageElement|null> (aynı köken; canvas kirlenmez)
//   drawFanCard(canvas, data)        kartı çizer
//   canvasBlob(canvas)               Promise<Blob> (image/png)

export const CARD_W = 1200;
export const CARD_H = 630;
export const SITE_URL = 'cureshot-dog.netlify.app';

const C = {
  bg: '#0d0b14', bg2: '#15121f', bg3: '#1e1a2b', bg4: '#282238', line: '#2f2842', line2: '#433a5c',
  text: '#f3eadb', text2: '#b9aec4', text3: '#7f7592',
  ember: '#ff6a2b', ember2: '#ff9a3d', aegis: '#e9b949', aegis2: '#f6d98a', radiant: '#43d6a0', dire: '#e0354b', arcane: '#8b7cff',
};
const F = {
  display: (w, s) => `${w} ${s}px Unbounded, "Arial Black", sans-serif`,
  lore: (s) => `700 ${s}px Cinzel, Georgia, serif`,
  body: (w, s) => `${w} ${s}px Barlow, "Segoe UI", sans-serif`,
  mono: (w, s) => `${w} ${s}px "JetBrains Mono", ui-monospace, monospace`,
};

let fontsPromise = null;
export function cardFontsReady() {
  if (fontsPromise) return fontsPromise;
  try {
    if (!document.fonts || !document.fonts.load) return (fontsPromise = Promise.resolve());
    const faces = [F.display(900, 60), F.display(800, 40), F.lore(20), F.body(400, 20), F.body(600, 22), F.body(700, 24), F.mono(700, 28), F.mono(500, 20)];
    fontsPromise = Promise.race([
      Promise.all(faces.map((f) => document.fonts.load(f, 'DOGİŞĞÜÇÖ1vQUZ'))).then(() => document.fonts.ready).catch(() => {}),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    fontsPromise = Promise.resolve();
  }
  return fontsPromise;
}

const imgCache = new Map();
export function loadImage(url) {
  if (!url) return Promise.resolve(null);
  if (imgCache.has(url)) return imgCache.get(url);
  const p = new Promise((resolve) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = url;
  });
  imgCache.set(url, p);
  return p;
}

export function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob boş'))), 'image/png');
    } catch (e) {
      reject(e);
    }
  });
}

// ------------------------------------------------------------------ çizim yardımcıları
const up = (s) => String(s).toLocaleUpperCase('tr-TR');

function spaced(g, px) {
  try { if ('letterSpacing' in g) g.letterSpacing = `${px}px`; } catch { /* eski tarayıcı */ }
}

function chamferPath(g, x, y, w, hgt, c) {
  g.beginPath();
  g.moveTo(x + c, y);
  g.lineTo(x + w, y);
  g.lineTo(x + w, y + hgt - c);
  g.lineTo(x + w - c, y + hgt);
  g.lineTo(x, y + hgt);
  g.lineTo(x, y + c);
  g.closePath();
}

/** Metni genişliğe sığdırır: önce yazı boyutu küçülür, sonra “…” ile kırpılır. */
function fitText(g, text, maxW, font, max, min) {
  let s = max;
  g.font = font(s);
  while (g.measureText(text).width > maxW && s > min) {
    s -= 2;
    g.font = font(s);
  }
  let t = text;
  if (g.measureText(t).width > maxW) {
    while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    t += '…';
  }
  return { text: t, size: s };
}

function ellipsize(g, text, maxW) {
  let t = String(text);
  if (g.measureText(t).width <= maxW) return t;
  while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function pawPath(g, cx, cy, s) {
  const toe = (x, y, r) => { g.moveTo(cx + (x + r) * s, cy + y * s); g.arc(cx + x * s, cy + y * s, r * s, 0, Math.PI * 2); };
  g.beginPath();
  toe(-5.5, -3, 2); toe(-2, -6.5, 2); toe(2, -6.5, 2); toe(5.5, -3, 2);
  g.moveTo(cx - 4.5 * s, cy + 5 * s);
  g.bezierCurveTo(cx - 4.5 * s, cy + 2 * s, cx - 2.5 * s, cy - 0.5 * s, cx, cy - 0.5 * s);
  g.bezierCurveTo(cx + 2.5 * s, cy - 0.5 * s, cx + 4.5 * s, cy + 2 * s, cx + 4.5 * s, cy + 5 * s);
  g.bezierCurveTo(cx + 4.5 * s, cy + 6.7 * s, cx + 3.2 * s, cy + 7.5 * s, cx + 1.9 * s, cy + 7.5 * s);
  g.bezierCurveTo(cx + 0.9 * s, cy + 7.5 * s, cx + 0.6 * s, cy + 6.9 * s, cx, cy + 6.9 * s);
  g.bezierCurveTo(cx - 0.6 * s, cy + 6.9 * s, cx - 0.9 * s, cy + 7.5 * s, cx - 1.9 * s, cy + 7.5 * s);
  g.bezierCurveTo(cx - 3.2 * s, cy + 7.5 * s, cx - 4.5 * s, cy + 6.7 * s, cx - 4.5 * s, cy + 5 * s);
  g.closePath();
}

function hexA(hex, a) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return `rgba(233,185,73,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ------------------------------------------------------------------ kart
/**
 * data: {
 *   nick, level, rank, rankColor, xp, pct (0–1), next (sonraki seviye XP),
 *   render (HTMLImageElement|null, şeffaf tam boy), portrait (HTMLImageElement|null, 16:9), heroName,
 *   archetype: { name, color } | null, records: [{ name, value }] (en fazla 3),
 *   badges, badgesTotal, dog, streak, since (metin)
 * }
 */
export function drawFanCard(canvas, d) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const g = canvas.getContext('2d');
  const W = CARD_W, H = CARD_H;
  const accent = d.rankColor || C.aegis;

  // --- zemin
  g.fillStyle = C.bg;
  g.fillRect(0, 0, W, H);
  let grd = g.createRadialGradient(W * 0.88, -40, 10, W * 0.88, -40, 720);
  grd.addColorStop(0, 'rgba(255,106,43,0.30)');
  grd.addColorStop(1, 'rgba(255,106,43,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  grd = g.createRadialGradient(-60, H + 60, 10, -60, H + 60, 620);
  grd.addColorStop(0, 'rgba(67,214,160,0.16)');
  grd.addColorStop(1, 'rgba(67,214,160,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  // harita ızgarası
  g.strokeStyle = 'rgba(255,255,255,0.03)';
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 0; x <= W; x += 48) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
  for (let y = 0; y <= H; y += 48) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
  g.stroke();

  // --- sol: avatar sahnesi
  const AX = 36, AY = 36, AW = 400, AH = H - 72;
  g.save();
  chamferPath(g, AX, AY, AW, AH, 18);
  g.clip();
  const sg = g.createLinearGradient(0, AY, 0, AY + AH);
  sg.addColorStop(0, C.bg3);
  sg.addColorStop(1, C.bg);
  g.fillStyle = sg;
  g.fillRect(AX, AY, AW, AH);
  grd = g.createRadialGradient(AX + AW / 2, AY + AH * 0.46, 10, AX + AW / 2, AY + AH * 0.46, AW * 0.72);
  grd.addColorStop(0, hexA(accent, 0.42));
  grd.addColorStop(0.55, hexA(accent, 0.1));
  grd.addColorStop(1, hexA(accent, 0));
  g.fillStyle = grd;
  g.fillRect(AX, AY, AW, AH);
  // zemin halkaları
  g.strokeStyle = hexA(accent, 0.22);
  g.lineWidth = 2;
  for (const r of [120, 170]) {
    g.beginPath();
    g.ellipse(AX + AW / 2, AY + AH - 58, r, r * 0.22, 0, 0, Math.PI * 2);
    g.stroke();
  }
  if (d.render) {
    const im = d.render;
    const s = Math.min((AW - 10) / im.width, (AH - 70) / im.height) * 1.02;
    const w = im.width * s, hh = im.height * s;
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 30;
    g.drawImage(im, AX + (AW - w) / 2, AY + AH - 40 - hh, w, hh);
    g.shadowBlur = 0;
  } else if (d.portrait) {
    const im = d.portrait;
    const w = AW - 60, hh = w * (im.height / im.width);
    const x = AX + 30, y = AY + (AH - hh) / 2 - 30;
    g.save();
    chamferPath(g, x, y, w, hh, 12);
    g.clip();
    g.drawImage(im, x, y, w, hh);
    g.restore();
    g.strokeStyle = hexA(accent, 0.8);
    g.lineWidth = 2;
    chamferPath(g, x, y, w, hh, 12);
    g.stroke();
  } else {
    // avatar yok: DOG pençesi amblemi
    g.fillStyle = hexA(C.ember, 0.9);
    pawPath(g, AX + AW / 2, AY + AH / 2 - 40, 13);
    g.fill();
    g.font = F.lore(18);
    g.textAlign = 'center';
    g.fillStyle = C.text3;
    spaced(g, 4);
    g.fillText('AVATAR SEÇİLMEDİ', AX + AW / 2, AY + AH / 2 + 110);
    spaced(g, 0);
  }
  // alt şerit: kahraman adı
  const bandY = AY + AH - 44;
  g.fillStyle = 'rgba(13,11,20,0.78)';
  g.fillRect(AX, bandY, AW, 44);
  g.fillStyle = accent;
  g.fillRect(AX, bandY, AW, 2);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = C.text2;
  g.font = F.lore(16);
  spaced(g, 3);
  g.fillText(ellipsize(g, up(d.heroName ? d.heroName : 'DOG DOG DOG'), AW - 30), AX + AW / 2, bandY + 23);
  spaced(g, 0);
  g.restore();
  // çerçeve
  g.strokeStyle = hexA(C.aegis, 0.75);
  g.lineWidth = 2;
  chamferPath(g, AX + 1, AY + 1, AW - 2, AH - 2, 18);
  g.stroke();

  // --- sağ: kimlik
  const RX = 480, RW = W - RX - 48;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = F.lore(17);
  g.fillStyle = C.aegis;
  spaced(g, 5);
  g.fillText('FAN KARTI · DOG DOG DOG ÜSSÜ', RX, 78);
  spaced(g, 0);

  const nick = fitText(g, d.nick || 'Anonim', RW, (s) => F.display(900, s), 64, 30);
  g.font = F.display(900, nick.size);
  g.fillStyle = C.text;
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowOffsetY = 4;
  g.fillText(nick.text, RX, 78 + 18 + nick.size * 0.92);
  g.shadowColor = 'transparent';
  g.shadowOffsetY = 0;
  let y = 78 + 18 + nick.size * 0.92 + 20;

  // seviye rozeti + XP çubuğu
  y += 8;
  const lvlText = `SEVİYE ${d.level}`;
  g.font = F.display(800, 22);
  const lw = g.measureText(lvlText).width;
  g.fillStyle = hexA(accent, 0.16);
  chamferPath(g, RX, y, lw + 28, 40, 8);
  g.fill();
  g.strokeStyle = hexA(accent, 0.9);
  g.lineWidth = 1.5;
  chamferPath(g, RX, y, lw + 28, 40, 8);
  g.stroke();
  g.fillStyle = accent;
  g.fillText(lvlText, RX + 14, y + 29);
  g.font = F.lore(22);
  g.fillStyle = C.text;
  spaced(g, 3);
  g.fillText(up(d.rank || ''), RX + lw + 44, y + 28);
  spaced(g, 0);
  y += 56;
  const BW = RW;
  g.fillStyle = C.bg;
  g.fillRect(RX, y, BW, 12);
  g.strokeStyle = C.line;
  g.lineWidth = 1;
  g.strokeRect(RX + 0.5, y + 0.5, BW - 1, 11);
  const xg = g.createLinearGradient(RX, 0, RX + BW, 0);
  xg.addColorStop(0, C.ember2);
  xg.addColorStop(0.5, C.ember);
  xg.addColorStop(1, C.dire);
  g.fillStyle = xg;
  g.fillRect(RX + 1, y + 1, Math.max(0, Math.min(1, d.pct || 0)) * (BW - 2), 10);
  g.font = F.mono(500, 17);
  g.fillStyle = C.text2;
  g.fillText(`${fmt(d.xp)} XP`, RX, y + 38);
  g.textAlign = 'right';
  g.fillStyle = C.text3;
  g.fillText(`sonraki seviye ${fmt(d.next)} XP`, RX + BW, y + 38);
  g.textAlign = 'left';
  y += 62;

  // istatistik kutuları
  const stats = [
    { label: 'DOG', value: fmt(d.dog), color: C.ember },
    { label: 'ROZET', value: `${d.badges}/${d.badgesTotal}`, color: C.aegis },
    { label: 'GÖREV SERİSİ', value: `${d.streak || 0} gün`, color: C.radiant },
  ];
  const gap = 12, sw = (RW - gap * 2) / 3, sh = 78;
  stats.forEach((s, i) => {
    const x = RX + i * (sw + gap);
    g.fillStyle = 'rgba(30,26,43,0.9)';
    chamferPath(g, x, y, sw, sh, 8);
    g.fill();
    g.fillStyle = s.color;
    g.fillRect(x, y + sh - 3, sw, 3);
    g.font = F.lore(13);
    g.fillStyle = C.text3;
    spaced(g, 3);
    g.fillText(s.label, x + 16, y + 26);
    spaced(g, 0);
    const v = fitText(g, s.value, sw - 32, (z) => F.mono(700, z), 30, 16);
    g.font = F.mono(700, v.size);
    g.fillStyle = C.text;
    g.fillText(v.text, x + 16, y + 62);
  });
  y += sh + 22;

  // rekorlar
  g.font = F.lore(14);
  g.fillStyle = C.aegis;
  spaced(g, 4);
  g.fillText('EN İYİ REKORLAR', RX, y + 4);
  spaced(g, 0);
  if (d.archetype) {
    g.textAlign = 'right';
    g.font = F.body(600, 17);
    const t = ellipsize(g, `DOG türü: ${d.archetype.name}`, 300);
    const tw = g.measureText(t).width;
    g.fillStyle = C.text2;
    g.fillText(t, RX + RW, y + 5);
    g.fillStyle = d.archetype.color || C.ember;
    g.beginPath();
    g.arc(RX + RW - tw - 12, y - 1, 6, 0, Math.PI * 2);
    g.fill();
    g.textAlign = 'left';
  }
  y += 16;
  const recs = (d.records || []).slice(0, 3);
  if (!recs.length) {
    g.font = F.body(400, 19);
    g.fillStyle = C.text3;
    g.fillText('Henüz rekor yok. Salon seni bekliyor.', RX, y + 32);
  }
  recs.forEach((r, i) => {
    const ry = y + i * 38;
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.045)';
    g.fillRect(RX, ry, RW, 34);
    g.fillStyle = [C.aegis, C.text2, C.ember2][i];
    g.font = F.mono(700, 16);
    g.fillText(String(i + 1), RX + 12, ry + 23);
    g.font = F.body(600, 19);
    g.fillStyle = C.text;
    g.fillText(ellipsize(g, r.name, RW - 250), RX + 40, ry + 24);
    g.textAlign = 'right';
    g.font = F.mono(700, 18);
    g.fillStyle = C.aegis2;
    g.fillText(ellipsize(g, r.value, 200), RX + RW - 12, ry + 24);
    g.textAlign = 'left';
  });

  // alt bilgi
  const fy = H - 44;
  g.font = F.mono(500, 16);
  g.fillStyle = C.text3;
  g.fillText(SITE_URL, RX, fy);
  if (d.since) {
    const sw2 = g.measureText(SITE_URL).width;
    g.font = F.body(400, 16);
    g.fillText(`  ·  Üye: ${d.since}`, RX + sw2, fy);
  }
  // DOG DOG DOG damgası
  g.save();
  g.translate(W - 48, fy + 6);
  g.rotate(-0.06);
  g.textAlign = 'right';
  g.font = F.display(900, 26);
  const sgd = g.createLinearGradient(-260, 0, 0, 0);
  sgd.addColorStop(0, C.ember2);
  sgd.addColorStop(0.5, C.ember);
  sgd.addColorStop(1, C.dire);
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillText('DOG DOG DOG', 0, 3);
  g.fillStyle = sgd;
  g.fillText('DOG DOG DOG', 0, 0);
  g.restore();

  // köşe süsleri
  g.strokeStyle = C.aegis;
  g.lineWidth = 3;
  const k = 26;
  const corner = (x, y2, dx, dy) => { g.beginPath(); g.moveTo(x, y2 + dy * k); g.lineTo(x, y2); g.lineTo(x + dx * k, y2); g.stroke(); };
  corner(14, 14, 1, 1);
  corner(W - 14, 14, -1, 1);
  corner(14, H - 14, 1, -1);
  corner(W - 14, H - 14, -1, -1);
  return canvas;
}

const nf = new Intl.NumberFormat('tr-TR');
function fmt(n) { return nf.format(Math.round(Number(n) || 0)); }
