// Karakter Analizleri — ortak küçük yardımcılar (SVG kurucu, pati göstergesi, renk ve DOG indeksi).
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { STAT_LABELS } from '../../data/archetypes.js';

const NS = 'http://www.w3.org/2000/svg';

/** Her SVG etiketini (tspan, title, clipPath dahil) destekleyen küçük kurucu. */
export function s(tag, attrs, ...children) {
  const el = document.createElementNS(NS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) el.style.setProperty(sk, sv);
      } else {
        el.setAttribute(k, String(v));
      }
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === true) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const STAT_KEYS = Object.keys(STAT_LABELS);
/** Yüksek değeri iyi olan statlar. */
export const GOOD_STATS = new Set(['harita', 'takim']);

/** 0–100 DOG indeksi: kötü statlar + (100 - iyi statlar) ortalaması. */
export function dogIndex(stats) {
  let sum = 0;
  for (const k of STAT_KEYS) {
    const v = Number(stats[k]) || 0;
    sum += GOOD_STATS.has(k) ? 100 - v : v;
  }
  return Math.round(sum / STAT_KEYS.length);
}

/** DOG seviyesi göstergesi: 5 pati (efsane için taç). */
export function pawsEl(arch, { size = 14, label = false } = {}) {
  if (arch.id === 'legend') {
    return h('span', { class: 'ch-paws is-legend', role: 'img', 'aria-label': 'DOG değil: efsane' },
      icon('crown', { size: size + 2, stroke: 2 }),
      label ? h('span', { class: 'ch-paws-label' }, 'Efsane') : null,
    );
  }
  const lvl = Math.max(0, Math.min(5, arch.dogLevel || 0));
  const wrap = h('span', { class: 'ch-paws', role: 'img', 'aria-label': `DOG seviyesi ${lvl}/5` });
  for (let i = 0; i < 5; i++) {
    const p = icon('paw', { size, stroke: 2 });
    p.classList.add(i < lvl ? 'on' : 'off');
    wrap.appendChild(p);
  }
  if (label) wrap.appendChild(h('span', { class: 'ch-paws-label' }, `${lvl}/5`));
  return wrap;
}

/** Düz sayı ile pati göstergesi (analiz sonucu için). */
export function pawsLevelEl(level, { size = 18 } = {}) {
  if (level <= 0) {
    return h('span', { class: 'ch-paws is-legend', role: 'img', 'aria-label': 'DOG değil' }, icon('crown', { size: size + 2, stroke: 2 }));
  }
  const wrap = h('span', { class: 'ch-paws', role: 'img', 'aria-label': `DOG seviyesi ${level}/5` });
  for (let i = 0; i < 5; i++) {
    const p = icon('paw', { size, stroke: 2 });
    p.classList.add(i < level ? 'on' : 'off');
    wrap.appendChild(p);
  }
  return wrap;
}

export function hexToRgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function colorDist(a, b) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

/** Karşılaştırmada ikinci seri için A'dan ayırt edilebilir bir renk seçer. */
const CONTRAST = ['#43d6a0', '#8b7cff', '#53d8fb', '#e0354b', '#ff6a2b', '#f6d98a'];
export function contrastColor(a, b) {
  if (colorDist(a, b) >= 110) return b;
  return CONTRAST.find((c) => colorDist(a, c) >= 150) || '#43d6a0';
}

/** Türün sıra numarası "01".."11". */
export const idx2 = (i) => String(i + 1).padStart(2, '0');

/**
 * "1vDOQUZ" özel yazımını büyük harf dönüşümünden korur (.stamp, .btn gibi uppercase bağlamlar):
 * meme kelimesini <span class="meme"> ile sarar.
 */
export function memeText(str) {
  const parts = String(str).split(/(1vDOQUZ)/);
  if (parts.length === 1) return str;
  // Tek sarmalayıcı: flex kapsayıcılarda (.btn) parçalar arasına boşluk (gap) girmesin
  return h('span', null, parts.filter(Boolean).map((p) => (p === '1vDOQUZ' ? h('span', { class: 'meme' }, p) : p)));
}

/** Salt okunur paylaşımlı görünümde seçimin yalnızca bu cihazda kaldığını açıklar (yoksa null). */
export function readOnlyNote(store, what) {
  const el = h('p', { class: 'xsmall dim ch-ro-note', hidden: true }, icon('info', { size: 14 }),
    h('span', null, `Salt okunur görüntülüyorsun: ${what} bu cihazda saklanır, topluluk sayılarına yazılmayabilir.`));
  const check = () => { el.hidden = !(store.shared && !store.canWrite()); };
  check();
  Promise.resolve(store.ready).then(check, () => {});
  return el;
}
