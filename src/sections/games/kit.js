// Mini oyunlar için ortak iskelet: sayfa düzeni, görünürlüğe duyarlı oyun saati,
// başlangıç/sonuç kartları, HUD istatistikleri ve jeton renk yardımcıları.

import { h, clear, fmtNum, clamp, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { store } from '../../core/store.js';
import { sound } from '../../core/sound.js';
import { fx } from '../../core/fx.js';
import { portraitUrl } from '../../core/assets.js';
import { mountLeaderboard } from '../../components/leaderboard.js';
import { proceduralPortrait } from '../../components/portrait.js';

// ------------------------------------------------------------------ portre kırpma
// fal.ai portreleri tam sahneler; küçük kutularda yüzün okunması için odak noktaları (x, y oranı).
const FOCAL = {
  farm: [0.57, 0.25], feed: [0.66, 0.38], pause: [0.54, 0.44], afk: [0.38, 0.46],
  kurye: [0.54, 0.18], rapier: [0.53, 0.5], mid: [0.51, 0.23], ward: [0.61, 0.2],
  smurf: [0.52, 0.27], chat: [0.51, 0.45], legend: [0.5, 0.2],
};

export const hasRealPortrait = (arch) => !!portraitUrl(arch.id);

/**
 * Yüze odaklı portre kutusu (arka plan görseli). ratio = yükseklik / genişlik.
 * zoom: fal görseli için yakınlaştırma; pzoom: prosedürel arma için.
 */
export function faceArt(arch, { zoom = 2, pzoom = 1.2, ratio = 1, cls = '' } = {}) {
  const real = portraitUrl(arch.id);
  const url = real || proceduralPortrait(arch, 512);
  const [fx0, fy0] = real ? (FOCAL[arch.id] || [0.5, 0.4]) : [0.5, 0.47];
  const S = (real ? zoom : pzoom) * Math.max(1, ratio); // görsel genişliği / kutu genişliği
  const zx = S;
  const zy = S / ratio;
  const px = zx > 1.001 ? clamp((fx0 * zx - 0.5) / (zx - 1), 0, 1) : 0.5;
  const py = zy > 1.001 ? clamp((fy0 * zy - 0.5) / (zy - 1), 0, 1) : 0.5;
  return h('span', {
    class: `gm-face ${cls}`,
    'aria-hidden': 'true',
    dataset: { generated: real ? 'fal' : 'procedural' },
    style: {
      backgroundImage: `url("${url}")`,
      backgroundSize: `${(S * 100).toFixed(1)}% auto`,
      backgroundPosition: `${(px * 100).toFixed(1)}% ${(py * 100).toFixed(1)}%`,
    },
  });
}

// ------------------------------------------------------------------ renkler
/** Tasarım jetonunun değeri (canvas çizimleri için). */
export function tok(name, fallback = '#888888') {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

/** '#rrggbb' → rgba(...) */
export function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * "1vDOQUZ" yazımını büyük harf dönüşümünden korur: metni parçalara ayırıp memeyi
 * <span class="meme"> içine alır (eyebrow, kırıntı gibi uppercase bağlamlar için).
 */
export function memeText(s) {
  return String(s || '').split(/(1vDOQUZ)/).filter(Boolean).map((p) => (p === '1vDOQUZ' ? h('span', { class: 'meme' }, p) : p));
}

/** Kısa sayı: 1.2B gibi (envanter "şarj" yazısı için). */
export function compact(n) {
  const v = Math.round(Number(n) || 0);
  if (Math.abs(v) >= 10000) return (v / 1000).toFixed(0) + 'B';
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1).replace('.', ',') + 'B';
  return String(v);
}

// ------------------------------------------------------------------ oyun saati
/**
 * Görünürlüğe duyarlı oyun döngüsü. Oyun zamanı yalnızca sekme görünürken ilerler;
 * `after(sn, fn)` oyun zamanına göre çalışır, böylece sekme gizlenince tüm sayaçlar durur.
 * onFrame(dt, t) her karede çağrılır (gizliyken çağrılmaz).
 */
export function createRunner(onFrame) {
  let time = 0;
  let tasks = [];
  let seq = 0;
  let hidden = document.hidden;
  let alive = true;
  let last = performance.now();
  let raf = 0;
  const onVis = () => { hidden = document.hidden; last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  // Gerçek zamanı izler (yavaş cihazda sayaç yavaşlamaz), uzun kesintileri 0,5 sn ile sınırlar
  // ve simülasyonu en fazla 50 ms'lik alt adımlarla ilerletir.
  const tick = (now) => {
    if (!alive) return;
    let dt = Math.min(0.5, Math.max(0, (now - last) / 1000));
    last = now;
    if (!hidden) {
      while (dt > 0 && alive) {
        const step = Math.min(dt, 0.05);
        dt -= step;
        time += step;
        if (tasks.length) {
          const due = [];
          tasks = tasks.filter((t) => (t.at <= time ? (due.push(t), false) : true));
          for (const t of due) {
            try { t.fn(); } catch (e) { console.error(e); }
          }
        }
        if (alive && onFrame) onFrame(step, time, dt <= 0);
      }
    }
    if (alive) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const stop = () => cancelAnimationFrame(raf);
  return {
    get time() { return time; },
    get hidden() { return hidden; },
    after(sec, fn) {
      const id = ++seq;
      tasks.push({ id, at: time + sec, fn });
      return id;
    },
    cancel(id) { tasks = tasks.filter((t) => t.id !== id); },
    clearTasks() { tasks = []; },
    destroy() {
      alive = false;
      stop();
      tasks = [];
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}

// ------------------------------------------------------------------ düzen
/**
 * Oyun sayfası: başlık, HUD, sahne ve yan sütun (skor tablosu + nasıl oynanır + diğer oyunlar).
 * nav: { list: [meta], open(id) } — games.js tarafından verilir.
 */
export function gameLayout(el, meta, { nav } = {}) {
  const hud = h('div', { class: 'gm-hud', role: 'group', 'aria-label': 'Oyun durumu' });
  // Sahne: oyun içeriği (stage) ve kaplamalar aynı ızgara hücresinde üst üste durur;
  // böylece uzun başlangıç/sonuç kartı sahneyi büyütür, kesilmez.
  const stage = h('div', { class: `gm-stage-body gm-stage-${meta.id}` });
  const stageFrame = h('div', { class: 'gm-stage' }, stage);
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const lbHost = h('div', { class: 'gm-aside-lb' });
  const otherBest = [];

  const keys = (meta.keys || []).length
    ? h('dl', { class: 'gm-keys' },
      meta.keys.map(([k, v]) => [
        h('dt', null, k.split(' ').map((part) => (part === '/' || part === 'veya' || part === '…' ? ` ${part} ` : h('span', { class: 'kbd' }, part)))),
        h('dd', null, v),
      ]),
    )
    : null;

  const others = nav && nav.list
    ? h('nav', { class: 'panel tight gm-others', 'aria-label': 'Diğer oyunlar' },
      h('h3', { class: 'h3 row' }, icon('gamepad', { size: 18 }), 'Diğer oyunlar'),
      h('ul', { class: 'gm-others-list' },
        nav.list.filter((g) => g.id !== meta.id).map((g) => {
          const best = h('span', { class: 'gm-other-best num' }, bestText(g));
          otherBest.push([g, best]);
          const a = h('a', { class: 'gm-other', href: `#oyunlar--${g.id}`, style: { '--gc': g.color } },
            h('span', { class: 'gm-other-ico' }, icon(g.icon, { size: 18 })),
            h('span', { class: 'gm-other-name' }, g.name),
            best,
          );
          a.addEventListener('click', (e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
            e.preventDefault();
            sound.click();
            nav.open(g.id);
          });
          return h('li', null, a);
        }),
      ),
    )
    : null;

  const aside = h('aside', { class: 'gm-aside' },
    lbHost,
    h('section', { class: 'panel tight gm-howto' },
      h('h3', { class: 'h3 row' }, icon('info', { size: 18 }), 'Nasıl oynanır'),
      h('ul', { class: 'gm-rules' }, (meta.rules || []).map((r) => h('li', null, r))),
      keys,
    ),
    others,
  );

  const root = h('div', { class: `gm-play gm-play-${meta.id}`, style: { '--gc': meta.color } },
    h('div', { class: 'gm-play-main' },
      h('div', { class: 'gm-play-top' },
      h('header', { class: 'gm-play-head' },
        h('span', { class: 'gm-slot gm-slot-lg', 'aria-hidden': 'true' }, icon(meta.icon, { size: 30 })),
        h('div', { class: 'gm-play-titles' },
          h('span', { class: 'eyebrow' }, meta.kind),
          h('h1', { class: 'h2 gm-play-title' }, meta.name),
          h('p', { class: 'small muted gm-play-lead' }, meta.blurb),
        ),
      ),
      hud,
      ),
      stageFrame,
      live,
    ),
    aside,
  );
  el.appendChild(root);
  const unLb = mountLeaderboard(lbHost, {
    gameId: meta.id,
    title: `${meta.short || meta.name} tablosu`,
    higherIsBetter: meta.higherIsBetter !== false,
    format: meta.format,
  });
  const unMe = store.me.subscribe(() => {
    for (const [g, el] of otherBest) el.textContent = bestText(g);
  });
  return {
    root, hud, stage, live,
    destroy() { unLb(); unMe(); root.remove(); },
  };
}

export function bestText(meta) {
  const v = (store.me.get().scores || {})[meta.id];
  return typeof v === 'number' ? meta.format(v) : '—';
}

/**
 * HUD'da etiketli sayı kutusu. set(v) ile güncellenir.
 * compact: uzun değerler (ör. 18:32:55) için dar ekranda küçülen yazı.
 */
export function hudStat(label, value = '0', { cls = '', ico, compact = false } = {}) {
  const val = h('span', { class: 'gm-stat-val num' }, value);
  const el = h('div', { class: `gm-stat ${cls}${compact ? ' gm-stat-compact' : ''}` },
    h('span', { class: 'gm-stat-label' }, ico ? icon(ico, { size: 14 }) : null, label),
    val,
  );
  let last = value;
  return {
    el,
    set(v) {
      const s = String(v);
      if (s !== last) { last = s; val.textContent = s; }
    },
    bump() {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    },
  };
}

// ------------------------------------------------------------------ kaplamalar
function cssPx(name, fallback) {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Öğeyi sabit üst HUD ile alt yetenek çubuğunun arasındaki görünür alana kaydırır
 * (mobilde sonuç kartının düğmeleri çubuğun altında kalmasın). Üst kenar önceliklidir.
 */
export function revealInView(el) {
  if (!el || !el.isConnected) return;
  const r = el.getBoundingClientRect();
  if (!r.height) return;
  const top = cssPx('--hud-h', 56) + 8;
  const bottom = window.innerHeight - cssPx('--bar-h', 84) - 8;
  let dy = 0;
  if (r.bottom > bottom) dy = r.bottom - bottom;
  if (r.top - dy < top) dy = r.top - top;
  if (Math.abs(dy) < 2) return;
  const behavior = prefersReducedMotion() ? 'instant' : 'smooth';
  try { window.scrollBy({ top: dy, behavior }); } catch { window.scrollBy(0, dy); }
}

/** Sahnenin üstüne kart kaplaması; kaldırma fonksiyonu döndürür. reveal: kartı görünür alana kaydır. */
export function showOverlay(stage, node, { cls = '', reveal = false } = {}) {
  const card = h('div', { class: 'gm-overlay-card panel raised frame' }, node);
  const ov = h('div', { class: `gm-overlay ${cls}` }, card);
  (stage.closest('.gm-stage') || stage).appendChild(ov);
  const btn = ov.querySelector('[data-primary]') || ov.querySelector('button');
  if (btn) {
    try { btn.focus({ preventScroll: true }); } catch { btn.focus(); }
  }
  if (reveal) revealInView(card);
  return () => ov.remove();
}

/**
 * Başlangıç kartı: kurallar + Başla.
 * İsteğe bağlı: extra (Node — ör. mod seçici, kuralların altında), rules (meta.rules yerine gösterilecek liste).
 */
export function introCard(meta, { onStart, note, startLabel = 'Başla', extra = null, rules = null }) {
  const start = h('button', { class: 'btn primary lg', type: 'button', 'data-primary': '' }, icon('play', { size: 18 }), startLabel);
  start.addEventListener('click', () => { sound.click(); onStart(); });
  const best = (store.me.get().scores || {})[meta.id];
  const has = typeof best === 'number';
  return h('div', { class: 'gm-intro stack' },
    h('div', { class: 'row gm-intro-top' },
      h('span', { class: 'gm-slot', 'aria-hidden': 'true' }, icon(meta.icon, { size: 24 })),
      h('div', null,
        h('span', { class: 'eyebrow' }, meta.kind),
        h('h2', { class: 'h2' }, meta.name),
      ),
    ),
    h('ul', { class: 'gm-rules' }, (rules || meta.rules || []).slice(0, 4).map((r) => h('li', null, r))),
    extra,
    note ? h('p', { class: 'xsmall dim' }, note) : null,
    h('div', { class: 'row gm-intro-foot' },
      start,
      h('span', { class: 'small muted' }, 'En iyin: ', h('strong', { class: has ? 'gold num' : 'gold' }, has ? meta.format(best) : 'henüz yok')),
    ),
  );
}

/**
 * Skoru hemen kaydeder (oyun biter bitmez; sonuç kartı gecikmeli gösterilse de
 * oyuncu o arada sayfadan ayrılırsa skor kaybolmasın). { record, prev } döndürür.
 */
export function submitResult(meta, score) {
  const prev = (store.me.get().scores || {})[meta.id];
  const record = store.me.submitScore(meta.id, score, meta.higherIsBetter !== false);
  return { record, prev };
}

/**
 * Sonuç kartı. Skor submitResult ile önceden kaydedildiyse `saved` olarak ver;
 * verilmezse burada kaydeder. Rekor ise kutlar.
 * stats: [[etiket, değer]], quip: kısa espri.
 * İsteğe bağlı: practice (true → skor kaydedilmez, "Antrenman" etiketi), extra (Node, düğmelerin üstünde),
 * quiet (true → ses ve konfeti yok; ör. geri yüklenen sonuç), retryLabel / retryIcon (tekrar düğmesi).
 */
export function resultCard(meta, {
  score, saved, stats = [], quip = '', onRetry, onBack, title = 'Maç sonu',
  practice = false, extra = null, quiet = false, retryLabel = 'Tekrar oyna', retryIcon = 'refresh',
}) {
  const { record, prev } = practice
    ? { record: false, prev: (store.me.get().scores || {})[meta.id] }
    : saved || submitResult(meta, score);
  const readOnly = store.shared && !store.canWrite();
  const retry = h('button', { class: 'btn primary', type: 'button', 'data-primary': '' }, icon(retryIcon, { size: 18 }), retryLabel);
  retry.addEventListener('click', () => { sound.click(); onRetry(); });
  const back = h('button', { class: 'btn ghost', type: 'button' }, icon('arrowLeft', { size: 18 }), 'Oyunlar');
  back.addEventListener('click', () => { sound.click(); onBack(); });
  const node = h('div', { class: 'gm-result stack' },
    h('div', { class: 'row gm-result-top' },
      h('span', { class: 'eyebrow' }, title),
      practice
        ? h('span', { class: 'badge' }, 'Antrenman')
        : record
          ? h('span', { class: 'badge gold' }, icon('crown', { size: 12 }), prev == null ? 'İlk skorun' : 'Yeni rekor')
          : prev != null ? h('span', { class: 'badge' }, 'Rekorun: ', meta.format(prev)) : null,
    ),
    h('div', { class: 'gm-result-score' },
      h('span', { class: 'gm-result-num num' }, meta.scoreText ? meta.scoreText(score) : fmtNum(score)),
      h('span', { class: 'gm-result-unit' }, meta.unit),
    ),
    stats.length ? h('dl', { class: `gm-result-stats n-${stats.length}` }, stats.map(([k, v]) => h('div', null, h('dt', null, k), h('dd', { class: 'num' }, v)))) : null,
    quip ? h('p', { class: 'gm-result-quip' }, quip) : null,
    practice ? h('p', { class: 'xsmall dim gm-result-note' }, 'Antrenman modu: bu skor tabloya ve rekoruna yazılmaz.') : null,
    readOnly && !practice ? h('p', { class: 'xsmall dim gm-result-note' }, 'Salt okunur görüntülüyorsun: rekorun bu cihazda saklanır, salon tablosuna yazılmayabilir.') : null,
    extra,
    h('div', { class: 'row gm-result-actions' }, retry, back),
  );
  if (quiet) {
    // sessiz: geri yüklenen sonuçta kutlama yok
  } else if (record) {
    sound.win();
    requestAnimationFrame(() => {
      const r = node.getBoundingClientRect();
      if (r.width) fx.confetti(r.left + r.width / 2, r.top + 40, 70);
    });
  } else {
    sound.good();
  }
  return { node, record };
}

/** Klavye olayı bir yazı alanından mı geliyor? */
export function isTyping(e) {
  const t = e.target;
  return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable));
}

/**
 * Boşluk/Enter gibi etkinleştirme tuşları odaktaki başka bir denetime (düğme, bağlantı,
 * sekme…) mi gidiyor? Öyleyse oyun tuşu yutmamalı; `surface` oyunun kendi alanıdır.
 */
export function onOtherControl(e, surface) {
  const t = e.target;
  if (!t || !t.closest || t === document.body || t === document.documentElement) return false;
  if (surface && (t === surface || surface.contains(t))) return false;
  if (isTyping(e)) return true;
  return !!t.closest('a[href], button, summary, [role="button"], [role="tab"], [role="link"], [role="checkbox"], [role="menuitem"], .modal-backdrop');
}

export { clear };
