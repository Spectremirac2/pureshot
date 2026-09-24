// Küçük DOM yardımcıları. Framework yok; her bölüm kendi DOM'unu bu h() ile kurar.

/**
 * Eleman oluşturur.
 * h('button', { class: 'btn primary', onclick: fn, 'aria-label': 'x', dataset: { id: 1 }, style: { color: 'red' } }, 'Metin', childEl)
 * - `class` / `className` → className
 * - `on<event>` (fonksiyon) → addEventListener
 * - `style` nesne veya string
 * - `dataset` nesne
 * - `html` → innerHTML (YALNIZCA güvenilir, sabit içerik için; kullanıcı metni asla!)
 * - diğerleri → setAttribute (false/null/undefined atlanır, true → boş öznitelik)
 * Çocuklar: string/number → text node (güvenli), Node, dizi (iç içe), null/false atlanır.
 */
export function h(tag, props, ...children) {
  const el = tag === 'svg' || tag === 'path' || tag === 'circle' || tag === 'g' || tag === 'polygon' || tag === 'line' || tag === 'rect' || tag === 'text' || tag === 'polyline' || tag === 'defs' || tag === 'linearGradient' || tag === 'stop' || tag === 'radialGradient' || tag === 'ellipse'
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class' || k === 'className') {
        if (el instanceof SVGElement) el.setAttribute('class', v);
        else el.className = v;
      } else if (k === 'style') {
        if (typeof v === 'string') el.style.cssText = v;
        else for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else el.style[sk] = sv;
        }
      } else if (k === 'dataset') {
        for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
      } else if (k === 'html') {
        el.innerHTML = v;
      } else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === 'value' && 'value' in el) {
        el.value = v;
      } else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') {
        el[k] = !!v;
      } else if (v === true) {
        el.setAttribute(k, '');
      } else {
        el.setAttribute(k, String(v));
      }
    }
  }
  append(el, children);
  return el;
}

export function append(parent, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === true) continue;
    parent.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return parent;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Güvenli localStorage erişimi (gizli pencere / engelli depolama / önizleme). */
export const ls = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem('csk:' + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('csk:' + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try { localStorage.removeItem('csk:' + key); } catch { /* yok say */ }
  },
};

// --- Sayı / zaman / rastgelelik ---
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** Dizgiden deterministik 32 bit hash (FNV-1a). */
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** Tohumlu rastgele sayı üreticisi (mulberry32). */
export function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const nf = new Intl.NumberFormat('tr-TR');
export const fmtNum = (n) => nf.format(Math.round(n || 0));

export function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'az önce';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} dk önce`;
  const hh = Math.floor(m / 60);
  if (hh < 24) return `${hh} sa önce`;
  const d = Math.floor(hh / 24);
  if (d < 30) return `${d} gün önce`;
  return new Date(ts).toLocaleDateString('tr-TR');
}

export function fmtClock(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/** Kısa benzersiz kimlik. */
export function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** requestAnimationFrame döngüsü; durdurma fonksiyonu döndürür. dt saniye cinsinden. */
export function loop(fn) {
  let raf = 0;
  let last = performance.now();
  let alive = true;
  const tick = (now) => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fn(dt, now / 1000);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
  };
}

export const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** Panoya kopyalama: tıklama işleyicisi içinde çağırın. Başarısızsa metni seçili hale getirir. */
export async function copyText(text, fallbackEl) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (fallbackEl) {
      const range = document.createRange();
      range.selectNodeContents(fallbackEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    return false;
  }
}

/** Basit metin temizleme: boşlukları sadeleştir, uzunluğu sınırla. */
export function cleanText(s, max = 280) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Çok satırlı metin temizleme: satır sonlarını korur, satır içi boşlukları sadeleştirir, en fazla 2 boş satır. */
export function cleanMultiline(s, max = 600) {
  return String(s || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

/** Çok hafif küfür/nefret filtresi: yalnızca ağır hakaretleri yıldızlar. */
const BLOCK = ['orospu', 'piç', 'sikerim', 'siktir', 'amına', 'amk', 'yarrak', 'göt veren', 'ibne', 'pezevenk', 'kahpe', 'şerefsiz'];
export function softFilter(s) {
  let out = s;
  for (const w of BLOCK) {
    const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, (m) => m[0] + '*'.repeat(Math.max(1, m.length - 1)));
  }
  return out;
}
