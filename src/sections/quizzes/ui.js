// Quizler bölümünün ortak parçaları: temizlik kapsamı, klavye koruması, üst çubuk,
// XP ilerleme çubuğu, seçenek butonları, pati göstergesi, son sonuç kaydı.

import { h, ls, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { store } from '../../core/store.js';

/** Zamanlayıcı / dinleyici / abonelik kapsamı: dispose() hepsini kapatır. */
export function makeScope() {
  let fns = [];
  let alive = true;
  const scope = {
    get alive() { return alive; },
    add(fn) { if (typeof fn === 'function') fns.push(fn); return fn; },
    timeout(fn, ms) {
      const id = setTimeout(() => { if (alive) fn(); }, ms);
      fns.push(() => clearTimeout(id));
      return id;
    },
    on(target, ev, fn, opts) {
      target.addEventListener(ev, fn, opts);
      fns.push(() => target.removeEventListener(ev, fn, opts));
    },
    dispose() {
      alive = false;
      const list = fns;
      fns = [];
      for (let i = list.length - 1; i >= 0; i--) {
        try { list[i](); } catch (e) { console.error(e); }
      }
    },
  };
  return scope;
}

/** Klavye kısayolu bu olayda çalışabilir mi? (yazı alanı, modal, kombinasyon tuşu yoksa) */
export function keyOk(e) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return false;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return false;
  if (document.querySelector('.modal-backdrop')) return false;
  return true;
}

/** Odak bir buton/bağlantıdaysa Enter/Boşluk doğal tıklamayı tetikler; ikinci kez işleme. */
export function isActivator(t) {
  return !!(t && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.getAttribute?.('role') === 'button'));
}

/** Quiz üst çubuğu: "← Quizler" + ad + sağ taraf yuvası. */
export function quizBar(quiz, onBack, right = null) {
  return h('div', { class: 'qz-bar' },
    h('button', { class: 'btn ghost sm qz-back', type: 'button', onclick: onBack },
      icon('arrowLeft', { size: 16 }), 'Quizler'),
    h('div', { class: 'qz-bar-title' },
      h('span', { class: 'eyebrow' }, quiz.kind),
      h('h1', { class: 'qz-bar-name' }, quiz.name),
    ),
    right,
  );
}

/** Dota XP çubuğu gibi ilerleme göstergesi. set(tamamlanan, şimdiki) */
export function xpBar(total, label = 'Soru') {
  const lvl = h('span', { class: 'num' }, '1');
  const fill = h('span', { class: 'qz-xp-fill' });
  const text = h('span', { class: 'qz-xp-label num' }, `1/${total}`);
  const ticks = h('span', { class: 'qz-xp-ticks', style: { '--n': total } },
    Array.from({ length: total }, () => h('span')));
  const el = h('div', {
    class: 'qz-xp',
    role: 'progressbar',
    'aria-label': `${label} ilerlemesi`,
    'aria-valuemin': '0',
    'aria-valuemax': String(total),
    'aria-valuenow': '0',
  },
    h('span', { class: 'qz-xp-badge', title: `${label} numarası` }, h('span', { class: 'qz-xp-lv' }, 'SV'), lvl),
    h('span', { class: 'qz-xp-track' }, fill, ticks),
    text,
  );
  return {
    el,
    set(done, current = done + 1) {
      const c = Math.min(total, Math.max(1, current));
      lvl.textContent = String(c);
      text.textContent = `${c}/${total}`;
      fill.style.width = `${(Math.min(total, done) / total) * 100}%`;
      el.setAttribute('aria-valuenow', String(done));
      el.setAttribute('aria-valuetext', `${label} ${c} / ${total}`);
    },
  };
}

/** Büyük seçenek butonu (1–4 tuşu rozeti ile). */
export function optionBtn(i, text, onPick) {
  return h('button', {
    class: 'qz-opt',
    type: 'button',
    dataset: { i: String(i) },
    onclick: (e) => onPick(i, e.currentTarget),
  },
    h('span', { class: 'qz-opt-key', 'aria-hidden': 'true' }, String(i + 1)),
    h('span', { class: 'qz-opt-text' }, text),
    h('span', { class: 'qz-opt-mark', 'aria-hidden': 'true' }),
  );
}

/** Doğru/yanlış işaretini seçenek butonuna ekle. */
export function markOption(btn, kind) {
  btn.classList.add(kind === 'right' ? 'is-right' : kind === 'wrong' ? 'is-wrong' : 'is-dim');
  const mark = btn.querySelector('.qz-opt-mark');
  if (mark && (kind === 'right' || kind === 'wrong')) {
    mark.replaceChildren(icon(kind === 'right' ? 'check' : 'cross', { size: 18, stroke: 2.6 }));
  }
}

/** DOG seviyesi: 5 pati. */
export function pawMeter(level, { size = 22 } = {}) {
  const wrap = h('span', { class: 'qz-paws', role: 'img', 'aria-label': `DOG seviyesi ${level}/5` });
  for (let i = 0; i < 5; i++) {
    wrap.appendChild(h('span', { class: `qz-paw${i < level ? ' on' : ''}`, style: { '--d': `${i * 80}ms` } }, icon('paw', { size, stroke: 2 })));
  }
  return wrap;
}

/**
 * "1vDOQUZ" özel yazımını büyük harf dönüşümünden korur (.stamp, .btn gibi uppercase bağlamlar):
 * metni parçalara ayırıp meme kelimesini <span class="meme"> ile sarar.
 */
export function memeText(str) {
  const parts = String(str).split(/(1vDOQUZ)/);
  if (parts.length === 1) return str;
  // Tek sarmalayıcı: flex kapsayıcılarda (.btn) parçalar arasına boşluk (gap) girmesin
  return h('span', null, parts.filter(Boolean).map((p) => (p === '1vDOQUZ' ? h('span', { class: 'meme' }, p) : p)));
}

/** Salt okunur paylaşımlı görünümde sonucun yalnızca bu cihazda kaldığını açıklar (yoksa null). */
export function readOnlyNote(what = 'Sonucun') {
  const el = h('p', { class: 'xsmall dim qz-ro-note', hidden: true }, icon('info', { size: 14 }),
    h('span', null, `Salt okunur görüntülüyorsun: ${what} bu cihazda saklanır, topluluk verisine yazılmayabilir.`));
  const check = () => { el.hidden = !(store.shared && !store.canWrite()); };
  check();
  Promise.resolve(store.ready).then(check, () => {});
  return el;
}

/** Ton adından rozet sınıfı */
export const toneClass = (tone) => ({ gold: 'gold', jade: 'jade', ember: 'ember', blood: 'blood' }[tone] || 'ember');

/** Elemanın ekran merkezinde konfeti / yazı efekti için koordinat. */
export function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Görünüm değişince başa kaydır (HUD'u hesaba katarak). */
export function scrollToTop(el) {
  const top = el ? el.getBoundingClientRect().top + window.scrollY - 80 : 0;
  if (window.scrollY > Math.max(0, top)) {
    window.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
  }
}

/** Elemanı görünür alana getir (alt çubuğun arkasında kalmasın). */
export function reveal(el) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const barH = 96;
  if (r.bottom > window.innerHeight - barH || r.top < 60) {
    el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
  }
}

// ------------------------------------------------------------------ son sonuçlar (bu cihaz)
const LAST_KEY = 'qz:last';
export function getLast() {
  const v = ls.get(LAST_KEY, {});
  return v && typeof v === 'object' ? v : {};
}
export function saveLast(id, data) {
  const all = getLast();
  all[id] = { ...data, at: Date.now() };
  ls.set(LAST_KEY, all);
}

/** Kendi fan belgesinin en güncel yerel halini listeye kat (yazma gecikmesini gizler). */
export function withMe(fans) {
  const myId = store.uid() || 'me';
  const out = (fans || []).filter((f) => f.id !== myId && f.id !== 'me');
  out.push({ ...store.me.get(), id: myId });
  return out;
}
