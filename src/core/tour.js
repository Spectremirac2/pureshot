// İlk giriş rehberi: karşılama kartı → spot ışıklı tur (yetenek çubuğu + HUD) → "Hazırsın" kartı.
// Ayrıca: "?" yardım paneli (openHelp) ve derin bağlantıyla gelenler için küçük "Siteyi tanıyalım mı?" dürtmesi.
//
// Durum: ls('tour:v1') = 'done' | 'skipped' (localStorage anahtarı 'csk:tour:v1'). Bir kez bitirilen ya da geçilen
// tur bir daha kendiliğinden açılmaz; yardım panelinden, ad menüsünden, alt bilgiden ya da #tur bağlantısından
// yeniden başlatılır. Kabuk: startTour() / openHelp() ya da document üzerinde 'csk:tour' / 'csk:help' olayları.
// Tasarım kararları ve metinler: docs/REHBER.md

import '../styles/tour.css';
import { h, append, clear, ls, clamp, prefersReducedMotion } from './dom.js';
import { icon } from './icons.js';
import { ROUTES, parseHash } from './routes.js';
import { sound } from './sound.js';
import { fx } from './fx.js';

export const TOUR_KEY = 'tour:v1';
export const TOUR_EVENT = 'csk:tour';
export const HELP_EVENT = 'csk:help';

const M = 16; // ekran kenarı payı (kart en fazla calc(100vw - 32px))
const GAP = 14; // hedef ile kart arası (ok dahil)

const isTouch = () => {
  try { return matchMedia('(hover: none), (pointer: coarse)').matches; } catch { return false; }
};
const vpW = () => document.documentElement.clientWidth || innerWidth;
const vpH = () => document.documentElement.clientHeight || innerHeight;
const slotSel = (id) => `.ability-slots .ability[data-route="${id}"]`;

// ------------------------------------------------------------------ Metinler
// Gövde metinleri ≤ ~140 karakter; değer odaklı, kısa, oyunbaz. (Appcues / Formbricks önerileri, bkz. REHBER.md)
const SLOT_COPY = {
  espriler: 'Efsane espriler, espri makinesi ve topluluk duvarı. Beğendiğini DOG’la, kendi esprini ekle.',
  oyunlar: '14 oyunluk salon: DOGdle, Invoker Kombo, Pudge Hook ve dahası. Rekor kır, rozet topla.',
  quizler: 'Hangi DOG’sun? Bilgi yarışması, Yetenek Avı… Sonucunu paylaş, arkadaşını DOG ilan et.',
  arena: 'Ultin hazır. 3D arenada dokuz kişiye karşı tek başına: gerçek 1vDOQUZ. Bahane yok, bekleme süresi yok.',
  karakterler: '10 DOG türü, radar grafikleri ve saha notları. Takımdaki DOG’un türü burada teşhis edilir.',
  'soru-cevap': 'Topluluğa sor, DOG Kâhini’ne danış, SSS’e göz at. Kâhin “ward al” diyorsa, al.',
  galeri: 'fal.ai afişleri ve döndürüp inceleyebileceğin 3D modeller: DOG maskotu, okçu ve Aegis.',
  kahramanlar: 'Eşya slotun: 127 kahramanın DOG endeksi, tier listesi ve “Daha DOG mu?”. Pick’ten önce bir bak.',
};

function buildSteps() {
  const steps = [{
    id: 'bar',
    sel: ['.ability-slots'],
    eyebrow: 'Yetenek çubuğu',
    title: 'Burası senin yetenek çubuğun',
    body: (t) => (t
      ? 'Dota’daki gibi: her slot bir bölüm, dokun ve gir. Ev simgeli H slotu seni her an Üs’e döndürür.'
      : 'Dota’daki gibi: her slot bir bölüm, her tuş bir kısayol. Tıkla ya da tuşa bas; H seni her an Üs’e döndürür.'),
    place: 'top',
  }];
  for (const r of ROUTES) {
    if (r.hidden || !r.key || r.id === 'ana') continue;
    steps.push({
      id: 'slot-' + r.id,
      sel: [slotSel(r.id)],
      key: r.key,
      eyebrow: r.ultimate ? 'Ulti · hazır' : r.item ? 'Eşya slotu' : 'Yetenek',
      title: r.label,
      body: SLOT_COPY[r.id] || `${r.label} bölümüne ışınlanır.`,
      place: 'top',
      ult: !!r.ultimate,
      item: !!r.item,
      tryKey: r.id === 'oyunlar' ? r.key : null,
    });
  }
  steps.push(
    {
      id: 'dog',
      sel: ['.hud-dog'],
      eyebrow: 'Üst çubuk',
      title: 'DOG sayacı',
      body: 'Biri feed’lediğinde bas: DOG DOG DOG! Her basış topluluk sayacına eklenir. Utanma, herkes basıyor.',
      place: 'bottom',
    },
    {
      id: 'clock',
      sel: ['.hud-clock'],
      eyebrow: 'Üst çubuk',
      title: 'Maraton saati',
      body: 'Bu sekmede geçirdiğin süre. En kısa yayın 24 saat sürüyor; sen daha ısınma turundasın.',
      place: 'bottom',
    },
    {
      id: 'corner',
      sel: ['.hud-nick', '.hud-sound', '.hud-help'],
      eyebrow: 'Üst çubuk',
      title: 'Profil, ses ve yardım',
      body: (t) => (t
        ? 'Kişi simgesine dokun: profilin, ad değiştirme, yardım ve bu tur orada. Yanındaki düğme sesi açıp kapatır.'
        : 'Ad çipinden profilini aç ya da adını değiştir. Hoparlör sesi kısar; ? yardımı her an açar.'),
      place: 'bottom',
    },
  );
  return steps;
}

// ------------------------------------------------------------------ Yardımcılar
function visible(el) {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  if (r.right < 0 || r.bottom < 0 || r.left > vpW() || r.top > vpH()) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
}
function targetsOf(step) {
  return step.sel.map((s) => document.querySelector(s)).filter(visible);
}
function unionRect(els) {
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const el of els) {
    const x = el.getBoundingClientRect();
    l = Math.min(l, x.left); t = Math.min(t, x.top); r = Math.max(r, x.right); b = Math.max(b, x.bottom);
  }
  return { left: l, top: t, right: r, bottom: b };
}
/** Yatay kayan yetenek çubuğunda (dar tablet genişlikleri) hedef slotu görünür alana getirir. */
function revealInScroller(el) {
  const sc = el.closest && el.closest('.ability-slots');
  if (!sc || el === sc || sc.scrollWidth <= sc.clientWidth + 1) return;
  const er = el.getBoundingClientRect();
  const sr = sc.getBoundingClientRect();
  if (er.left < sr.left + 6) sc.scrollLeft -= sr.left + 6 - er.left;
  else if (er.right > sr.right - 6) sc.scrollLeft += er.right - (sr.right - 6);
}
const kbd = (k) => h('span', { class: 'kbd' }, k);
/** "1vDOQUZ" büyük harf dönüşümünden korunur. */
const memeText = (s) => String(s).split(/(1vDOQUZ)/).map((p) => (p === '1vDOQUZ' ? h('span', { class: 'meme' }, p) : p));

// ------------------------------------------------------------------ Durum
let active = null; // açık turun denetleyicisi
let nudge = null; // derin bağlantı dürtmesi
let autoWatch = null; // hub'a dönünce ertelenmiş otomatik başlatma
let nudgeDismissed = false; // bu oturumda "şimdi değil" dendi

export function isTourOpen() { return !!active; }
export function tourState() { return ls.get(TOUR_KEY, null); }
export function tourSeen() {
  const v = tourState();
  return v === 'done' || v === 'skipped';
}
function saveResult(result) {
  if (result === 'skipped' && tourState() === 'done') return; // tekrar izleyip geçmek "bitirdi" bilgisini silmesin
  ls.set(TOUR_KEY, result);
}

// ------------------------------------------------------------------ Tur
/**
 * Turu açar. welcome: karşılama kartıyla başla (ilk ziyaret); aksi hâlde doğrudan çubuğa geçer.
 * auto: kendiliğinden açıldı (geçince kısa bir "yeniden açabilirsin" bildirimi gösterir).
 */
export function startTour({ welcome = false, auto = false } = {}) {
  if (active) return;
  removeNudge();
  stopAutoWatch();
  const app = document.getElementById('app');
  if (!document.querySelector('.ability-slots')) return;

  const touch = isTouch();
  const reduced = prefersReducedMotion();
  const steps = buildSteps().filter((s) => targetsOf(s).length > 0);
  const pages = [
    ...(welcome ? [{ kind: 'welcome' }] : []),
    ...steps.map((s) => ({ kind: 'spot', ...s })),
    { kind: 'final' },
  ];
  const spotTotal = steps.length;
  const firstSpot = welcome ? 1 : 0;

  let i = 0;
  let result = null;
  let raf = 0;
  let busy = false;
  let ro = null;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

  const prevFocus = document.activeElement;
  const prevInert = app ? app.inert : false;

  // ---- DOM
  const spot = h('div', { class: 'tour-spot is-off', 'aria-hidden': 'true' });
  const arrow = h('div', { class: 'tour-arrow', 'aria-hidden': 'true' });
  const card = h('div', { class: 'tour-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tour-title', 'aria-describedby': 'tour-body', tabindex: '-1' });
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite' });
  const root = h('div', { class: `tour-root${reduced ? ' no-motion' : ''}${touch ? ' is-touch' : ''}` }, spot, arrow, card, live);

  // Arka plana tıklama turu kapatmaz (yanlışlıkla kaybolmasın); kartı hafifçe dürter.
  root.addEventListener('pointerdown', (e) => {
    if (card.contains(e.target)) return;
    const pg = pages[i];
    if (pg.kind === 'spot' && pg.tryKey && e.target === spot) return;
    e.preventDefault();
    if (reduced) return;
    card.classList.remove('is-nudge');
    void card.offsetWidth;
    card.classList.add('is-nudge');
  });
  spot.addEventListener('click', () => {
    const pg = pages[i];
    if (pg.kind === 'spot' && pg.tryKey) tryCast();
  });

  // ---- Sayfa içerikleri
  let primary = null;
  const btn = (cls, label, onclick, extra = {}) => h('button', { class: `btn ${cls}`, type: 'button', onclick, ...extra }, label);

  function dots() {
    return h('div', { class: 'tour-dots', 'aria-hidden': 'true' },
      steps.map((_, k) => {
        const n = i - firstSpot;
        return h('span', { class: `tour-dot${k === n ? ' is-on' : k < n ? ' is-done' : ''}` });
      }));
  }

  function renderWelcome() {
    primary = btn('primary', ['Turu başlat', icon('arrowRight', { size: 16 })], () => go(1));
    const mini = h('div', { class: 'tour-minibar', 'aria-hidden': 'true' },
      ROUTES.filter((r) => !r.hidden && r.key).map((r) => [
        r.item ? h('span', { class: 'tour-mini-sep' }) : null,
        h('span', { class: `tour-mini${r.ultimate ? ' is-ult' : ''}${r.item ? ' is-item' : ''}` }, r.key),
      ]));
    append(card, [
      h('div', { class: 'tour-welcome-head' },
        h('span', { class: 'tour-crest', 'aria-hidden': 'true' }, icon('paw', { size: 22, stroke: 2.2 })),
        h('span', { class: 'eyebrow' }, 'İlk giriş · 30 saniye'),
      ),
      h('h2', { class: 'tour-title tour-title-lg', id: 'tour-title' }, 'DOG DOG DOG Üssü’ne hoş geldin'),
      h('p', { class: 'tour-body', id: 'tour-body' },
        ...memeText('CureShotKick hayranlarının üssü: espriler, 14 mini oyun, quizler ve 1vDOQUZ Arena. Gezinmenin sırrı alttaki yetenek çubuğunda; kısa bir turla göstereyim.')),
      mini,
      h('div', { class: 'tour-foot' },
        btn('ghost sm tour-skip', 'Geç', () => close('skipped')),
        primary,
      ),
      touch ? null : h('p', { class: 'tour-hint' }, 'İstediğin an ', kbd('Esc'), ' ile çıkabilirsin; ', kbd('←'), ' ', kbd('→'), ' adımlar arasında gezer.'),
    ]);
    live.textContent = 'Site turu. DOG DOG DOG Üssü’ne hoş geldin.';
  }

  function renderSpot(pg) {
    const n = i - firstSpot + 1;
    const last = n === spotTotal;
    const bodyText = typeof pg.body === 'function' ? pg.body(touch) : pg.body;
    primary = btn('primary sm', last ? 'Bitir' : ['İleri', icon('arrowRight', { size: 16 })], () => go(i + 1));
    const backBtn = btn('ghost sm', [icon('arrowLeft', { size: 16 }), 'Geri'], () => go(i - 1), { disabled: i <= firstSpot });
    let tryEl = null;
    if (pg.tryKey) {
      tryEl = h('p', { class: 'tour-try' },
        icon('bolt', { size: 14 }),
        touch ? ['Dene: parlayan ', kbd(pg.tryKey), ' slotuna dokun'] : ['Dene: klavyede ', kbd(pg.tryKey), '’ye bas'],
      );
    }
    append(card, [
      h('div', { class: 'tour-head' },
        pg.key ? h('span', { class: 'tour-key', 'aria-hidden': 'true' }, pg.key) : h('span', { class: 'tour-key is-icon', 'aria-hidden': 'true' }, icon(pg.id === 'bar' ? 'grid' : pg.id === 'dog' ? 'paw' : pg.id === 'clock' ? 'hourglass' : 'user', { size: 16 })),
        h('span', { class: 'eyebrow tour-eyebrow' }, pg.eyebrow),
        pg.ult ? h('span', { class: 'badge gold' }, 'ulti') : pg.item ? h('span', { class: 'badge jade' }, 'eşya') : null,
        h('span', { class: 'tour-count num', 'aria-label': `Adım ${n} / ${spotTotal}` }, `${n}/${spotTotal}`),
      ),
      h('h2', { class: 'tour-title', id: 'tour-title' }, ...memeText(pg.title)),
      h('p', { class: 'tour-body', id: 'tour-body' }, ...memeText(bodyText)),
      tryEl,
      dots(),
      h('div', { class: 'tour-foot' },
        btn('ghost sm tour-skip', 'Geç', () => close('skipped')),
        backBtn,
        primary,
      ),
    ]);
    live.textContent = `Adım ${n} / ${spotTotal}. ${pg.title}. ${bodyText}`;
  }

  function renderFinal() {
    saveResult('done');
    const cta = (href, ic, label, sub) => h('a', {
      class: 'tour-cta', href,
      onclick: (e) => { e.preventDefault(); close('done'); sound.click(); location.hash = href; },
    },
    h('span', { class: 'tour-cta-icon', 'aria-hidden': 'true' }, icon(ic, { size: 20 })),
    h('span', { class: 'tour-cta-text' }, h('strong', null, label), h('span', null, sub)),
    icon('arrowRight', { size: 16, cls: 'tour-cta-go' }),
    );
    primary = btn('primary', 'Keşfe çık', () => close('done'));
    append(card, [
      h('div', { class: 'tour-welcome-head' },
        h('span', { class: 'tour-crest is-gold', 'aria-hidden': 'true' }, icon('check', { size: 22, stroke: 2.4 })),
        h('span', { class: 'eyebrow' }, 'Tur tamam'),
      ),
      h('h2', { class: 'tour-title tour-title-lg', id: 'tour-title' }, 'Hazırsın!'),
      h('p', { class: 'tour-body', id: 'tour-body' }, 'Çubuk senin, klavye senin. İlk hamle için üç öneri:'),
      h('div', { class: 'tour-ctas' },
        cta('#oyunlar--dogdle', 'calendar', 'Günün DOGdle’ı', 'Gizli kahramanı bul, serini koru'),
        cta('#oyunlar', 'gamepad', 'Oyun Salonu', '14 oyun, rekorlar ve rozetler'),
        cta('#profil', 'user', 'Profilin', 'Fan kartın ve istatistiklerin'),
      ),
      h('p', { class: 'tour-hint' },
        ...(touch
          ? ['Yardım ve bu tur her zaman sağ üstteki kişi simgesinin menüsünde.']
          : ['Yardım her an bir tuş uzağında: ', kbd('?'), ' — turu oradan yeniden başlatabilirsin.'])),
      h('div', { class: 'tour-foot' }, h('span', { class: 'spacer' }), primary),
    ]);
    live.textContent = 'Tur tamamlandı. Hazırsın!';
    if (!reduced) {
      later(() => {
        const r = card.getBoundingClientRect();
        fx.confetti(r.left + r.width / 2, r.top + 30, 70);
      }, 120);
    }
    sound.good();
  }

  function render() {
    const pg = pages[i];
    clear(card);
    busy = false;
    card.className = `tour-card${pg.kind !== 'spot' ? ' is-center' : ''}${pg.ult ? ' is-ult' : ''}${pg.item ? ' is-item' : ''}${pg.kind === 'final' ? ' is-final' : ''}`;
    for (const el of [spot, arrow]) {
      el.classList.toggle('is-ult', !!pg.ult);
      el.classList.toggle('is-item', !!pg.item);
    }
    spot.classList.toggle('is-try', !!pg.tryKey);
    if (pg.kind === 'welcome') renderWelcome();
    else if (pg.kind === 'final') renderFinal();
    else renderSpot(pg);
    watchTargets(pg);
    layout();
    if (!reduced) {
      card.classList.remove('is-enter');
      void card.offsetWidth;
      card.classList.add('is-enter');
    }
    if (primary) primary.focus({ preventScroll: true });
  }

  function go(n) {
    if (n < firstSpot && pages[firstSpot - 1]?.kind === 'welcome' && i >= firstSpot) n = firstSpot; // spot adımlarından karşılamaya dönülmez
    n = clamp(n, 0, pages.length - 1);
    if (n === i) return;
    i = n;
    const pg = pages[i];
    if (pg.ult) sound.whoosh();
    else if (pg.kind === 'spot') sound.tick();
    render();
  }

  /** W adımı: tuşa basınca ya da slota dokununca "büyü" çalışır, gezinmeden sonraki adıma geçilir. */
  function tryCast() {
    if (busy) return;
    const pg = pages[i];
    const el = targetsOf(pg)[0];
    busy = true;
    if (el) {
      el.classList.remove('casting');
      void el.offsetWidth;
      el.classList.add('casting');
    }
    sound.click();
    const t = card.querySelector('.tour-try');
    if (t) { clear(t).append(icon('check', { size: 14 }), 'Aynen böyle! Çubuk seni dinliyor.'); t.classList.add('is-ok'); }
    later(() => { if (active && pages[i] === pg) go(i + 1); }, reduced ? 250 : 650);
  }

  // ---- Yerleşim
  function layout() {
    raf = 0;
    if (!active) return;
    const pg = pages[i];
    const vw = vpW();
    const vh = vpH();
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const els = pg.kind === 'spot' ? targetsOf(pg) : [];
    if (!els.length) {
      root.classList.add('is-center');
      spot.classList.add('is-off');
      arrow.hidden = true;
      card.style.left = Math.max(M, (vw - cw) / 2) + 'px';
      card.style.top = Math.max(M, (vh - ch) / 2) + 'px';
      return;
    }
    root.classList.remove('is-center');
    arrow.hidden = false;
    if (els.length === 1) revealInScroller(els[0]);
    const r = unionRect(els);
    const pad = vw < 480 ? 4 : 6;
    const s = {
      left: Math.max(2, r.left - pad),
      top: Math.max(2, r.top - pad),
      right: Math.min(vw - 2, r.right + pad),
      bottom: Math.min(vh - 2, r.bottom + pad),
    };
    // Gizliyken (karşılama kartından gelirken) köşeden uçmasın: yerine anında otur, sonra yalnızca belirsin
    const wasOff = spot.classList.contains('is-off');
    if (wasOff) spot.style.transition = 'none';
    spot.style.transform = `translate(${Math.round(s.left)}px, ${Math.round(s.top)}px)`;
    spot.style.width = Math.round(s.right - s.left) + 'px';
    spot.style.height = Math.round(s.bottom - s.top) + 'px';
    if (wasOff) {
      void spot.offsetWidth;
      spot.style.transition = '';
      spot.classList.remove('is-off');
    }

    const cx = (s.left + s.right) / 2;
    const cy = (s.top + s.bottom) / 2;
    const order = pg.place === 'bottom' ? ['bottom', 'top', 'right', 'left'] : ['top', 'bottom', 'right', 'left'];
    let pos = null;
    for (const side of order) {
      if (side === 'top' && s.top - GAP - ch >= M) pos = { side, x: clamp(cx - cw / 2, M, vw - M - cw), y: s.top - GAP - ch };
      else if (side === 'bottom' && s.bottom + GAP + ch <= vh - M) pos = { side, x: clamp(cx - cw / 2, M, vw - M - cw), y: s.bottom + GAP };
      else if (side === 'left' && s.left - GAP - cw >= M) pos = { side, x: s.left - GAP - cw, y: clamp(cy - ch / 2, M, vh - M - ch) };
      else if (side === 'right' && s.right + GAP + cw <= vw - M) pos = { side, x: s.right + GAP, y: clamp(cy - ch / 2, M, vh - M - ch) };
      if (pos) break;
    }
    if (!pos) {
      // Hiçbir yana sığmıyor (çok alçak ekran): daha geniş tarafa yasla, ekranda kal
      const up = s.top > vh - s.bottom;
      pos = { side: up ? 'top' : 'bottom', x: clamp(cx - cw / 2, M, vw - M - cw), y: up ? Math.max(M, s.top - GAP - ch) : Math.min(vh - M - ch, s.bottom + GAP) };
      pos.y = Math.max(M, pos.y);
    }
    card.style.left = Math.round(pos.x) + 'px';
    card.style.top = Math.round(pos.y) + 'px';

    // Ok: kartın hedefe bakan kenarında, hedefin ortasına hizalı (kart köşelerinden uzak)
    const A = 7;
    let ax, ay;
    if (pos.side === 'top' || pos.side === 'bottom') {
      ax = clamp(cx, pos.x + 20, pos.x + cw - 20) - A;
      ay = pos.side === 'top' ? pos.y + ch - A : pos.y - A;
    } else {
      ay = clamp(cy, pos.y + 20, pos.y + ch - 20) - A;
      ax = pos.side === 'left' ? pos.x + cw - A : pos.x - A;
    }
    arrow.dataset.side = pos.side;
    arrow.style.left = Math.round(ax) + 'px';
    arrow.style.top = Math.round(ay) + 'px';
    card.dataset.side = pos.side;
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(layout); };

  function watchTargets(pg) {
    if (ro) ro.disconnect();
    ro = null;
    if (typeof ResizeObserver === 'undefined') return;
    ro = new ResizeObserver(schedule);
    ro.observe(card);
    if (pg.kind === 'spot') for (const el of targetsOf(pg)) ro.observe(el);
  }

  // ---- Klavye ve odak
  function focusables() {
    return Array.from(card.querySelectorAll('button:not([disabled]), a[href]'));
  }
  const onKey = (e) => {
    if (!active) return;
    // Tur açıkken sitenin hiçbir kısayolu (kabuk, bölümler, oyunlar) tuş almaz
    e.stopImmediatePropagation();
    sound.unlock();
    if (e.key === 'Tab') {
      const f = focusables();
      e.preventDefault();
      if (!f.length) { card.focus({ preventScroll: true }); return; }
      const at = f.indexOf(document.activeElement);
      const n = e.shiftKey ? (at <= 0 ? f.length - 1 : at - 1) : (at === -1 || at === f.length - 1 ? 0 : at + 1);
      f[n].focus({ preventScroll: true });
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const pg = pages[i];
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        close(pg.kind === 'final' ? 'done' : 'skipped');
        return;
      case 'ArrowRight':
        e.preventDefault();
        if (pg.kind === 'final') close('done'); else go(i + 1);
        return;
      case 'ArrowLeft':
        e.preventDefault();
        go(i - 1);
        return;
      case 'Enter': {
        const a = document.activeElement;
        if (a && card.contains(a) && a !== card) return; // odaktaki düğme kendi işini yapar
        e.preventDefault();
        if (primary) primary.click();
        return;
      }
      default:
        if (pg.kind === 'spot' && pg.tryKey && e.key.length === 1 && e.key.toUpperCase() === pg.tryKey) {
          e.preventDefault();
          if (!e.repeat) tryCast();
        }
    }
  };
  const onFocusIn = (e) => {
    if (active && !root.contains(e.target) && primary) primary.focus({ preventScroll: true });
  };
  const onPageHide = () => { if (active && !result) saveResult('skipped'); };

  // ---- Kapatma ve temizlik
  function close(res) {
    if (!active || active.close !== close) return;
    result = res;
    saveResult(res);
    window.removeEventListener('keydown', onKey, true);
    document.removeEventListener('focusin', onFocusIn, true);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('scroll', schedule, true);
    window.removeEventListener('pagehide', onPageHide);
    if (window.visualViewport) {
      visualViewport.removeEventListener('resize', schedule);
      visualViewport.removeEventListener('scroll', schedule);
    }
    if (ro) ro.disconnect();
    if (raf) cancelAnimationFrame(raf);
    for (const t of timers) clearTimeout(t);
    timers.clear();
    root.remove();
    if (app) app.inert = prevInert;
    active = null;
    if (prevFocus && prevFocus.isConnected && prevFocus !== document.body && typeof prevFocus.focus === 'function') {
      try { prevFocus.focus({ preventScroll: true }); } catch { /* yok say */ }
    }
    if (res === 'skipped' && auto) {
      fx.toast(touch
        ? 'Tamam, geçtik. Turu istediğin an kişi simgesindeki menüden yeniden açabilirsin.'
        : 'Tamam, geçtik. Turu istediğin an ? tuşuyla yardım panelinden yeniden açabilirsin.', undefined, 4200);
    }
  }

  active = { close };
  document.body.appendChild(root);
  if (app) app.inert = true; // sayfa arkada odak/tıklama almaz; tur kartı #app dışında
  window.addEventListener('keydown', onKey, true);
  document.addEventListener('focusin', onFocusIn, true);
  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.addEventListener('pagehide', onPageHide);
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', schedule);
    visualViewport.addEventListener('scroll', schedule);
  }
  render();
}

/** Açık turu kapatır (ör. testler ya da başka bir bileşen için). */
export function closeTour() {
  if (active) active.close('skipped');
}

// ------------------------------------------------------------------ Yardım paneli
let helpClose = null;

export function openHelp() {
  if (active || helpClose) return;
  const touch = isTouch();
  const keys = ROUTES.filter((r) => !r.hidden && r.key).map((r) => h('li', { class: `help-key${r.ultimate ? ' is-ult' : ''}${r.item ? ' is-item' : ''}` },
    kbd(r.key),
    h('span', { class: 'help-key-label' }, ...memeText(r.label)),
    r.ultimate ? h('span', { class: 'badge gold' }, 'ulti') : r.item ? h('span', { class: 'badge jade' }, 'eşya') : null,
  ));
  const extra = [['?', 'Bu yardım paneli'], ['Esc', 'Pencereyi ya da turu kapat']].map(([k, t]) => h('li', { class: 'help-key is-meta' }, kbd(k), h('span', { class: 'help-key-label' }, t)));
  const hudItem = (ic, title, text) => h('li', { class: 'help-hud-item' },
    h('span', { class: 'help-hud-icon', 'aria-hidden': 'true' }, icon(ic, { size: 18 })),
    h('span', null, h('strong', null, title), h('span', { class: 'small muted' }, text)),
  );
  let close;
  const tourBtn = h('button', {
    class: 'btn primary', type: 'button',
    onclick: () => { close(); startTour(); },
  }, icon('compass', { size: 18 }), 'Turu başlat');
  const content = h('div', { class: 'help-panel stack' },
    h('div', { class: 'help-head' },
      // İlk odaklanılabilir öğe: fx.modal buna odaklanır, uzun panel mobilde en üstten açılır
      h('button', { class: 'btn ghost sm icon help-x', type: 'button', 'aria-label': 'Kapat', onclick: () => close() }, icon('close', { size: 18 })),
      h('span', { class: 'eyebrow' }, 'Yardım'),
      h('h2', { class: 'h2' }, 'Kısayollar ve ipuçları'),
      h('p', { class: 'small muted' }, touch
        ? 'Alttaki yetenek çubuğu sitenin haritası: slota dokun, bölüme ışınlan. Klavye bağlıysa tuşlar da çalışır.'
        : 'Alttaki yetenek çubuğu bir Dota çubuğu gibi: tuşa bas, bölüme ışınlan. Yazı yazarken ve oyun oynarken kısayollar kapanır.'),
    ),
    h('ul', { class: 'help-keys', 'aria-label': 'Kısayol tuşları' }, keys, extra),
    h('span', { class: 'eyebrow' }, 'Üst çubuk'),
    h('ul', { class: 'help-hud' },
      hudItem('paw', 'DOG sayacı', 'Biri feed’lediğinde bas: DOG DOG DOG! Her basış topluluk sayacına eklenir.'),
      hudItem('hourglass', 'Maraton saati', 'Bu sekmede geçen süre. En kısa yayın 24 saat; sen daha ısınıyorsun.'),
      hudItem('user', 'Profil menüsü', touch
        ? 'Kişi simgesine dokun: profilin, adını değiştir, yardım ve tur.'
        : 'Ad çipine tıkla: profilin, adını değiştir, yardım ve tur.'),
    ),
    h('div', { class: 'row help-foot' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => close() }, 'Kapat'),
      tourBtn,
    ),
  );
  close = fx.modal(content, { label: 'Yardım ve kısayollar', cls: 'help-modal', onClose: () => { helpClose = null; } });
  helpClose = close;
}

// ------------------------------------------------------------------ Otomatik başlatma
/** Oyun/quiz alt sayfasına doğrudan gelindi mi (#oyunlar--x, #quizler--x, #arena)? */
export function isDeepLink(hash = location.hash) {
  const { section, sub } = parseHash(hash);
  if (!sub) return false;
  if (section === 'oyunlar') return sub !== 'rozetler';
  return section === 'quizler';
}

/** Otomasyon (Playwright/WebDriver) altında otomatik açılmaz; test için ls('tour:auto') = true. */
function automationBlocked() {
  try { return !!navigator.webdriver && !ls.get('tour:auto', false); } catch { return false; }
}

/** Kabuk ve ilk bölüm çizildikten sonra, modal açık değilken ve sekme görünürken fn'i çalıştırır. */
function whenReady(fn, delay = 800) {
  let tries = 0;
  const ready = () => {
    const view = document.getElementById('view');
    return !!(view && view.querySelector('.section-root') && document.querySelector('.ability-slots'));
  };
  const blocked = () => !!document.querySelector('.modal-backdrop') || document.hidden;
  const tick = () => {
    if (active) return;
    if (document.hidden) {
      document.addEventListener('visibilitychange', tick, { once: true });
      return;
    }
    if (ready() && !blocked()) {
      setTimeout(() => {
        if (active) return;
        if (ready() && !blocked()) fn();
        else if (++tries < 240) setTimeout(tick, 250);
      }, delay);
      return;
    }
    if (++tries < 240) setTimeout(tick, 250); // en fazla ~1 dk dene
  };
  tick();
}

function autoStart() {
  if (active || tourSeen()) return;
  if (isDeepLink()) { showNudge(); startAutoWatch(); return; }
  startTour({ welcome: true, auto: true });
}

function startAutoWatch() {
  if (autoWatch) return;
  autoWatch = () => {
    if (nudgeDismissed || tourSeen() || active) { stopAutoWatch(); return; }
    if (!isDeepLink()) { stopAutoWatch(); removeNudge(); whenReady(autoStart); }
  };
  window.addEventListener('hashchange', autoWatch);
}
function stopAutoWatch() {
  if (!autoWatch) return;
  window.removeEventListener('hashchange', autoWatch);
  autoWatch = null;
}

// ------------------------------------------------------------------ Derin bağlantı dürtmesi
function showNudge() {
  if (nudge || active || nudgeDismissed) return;
  let timer = 0;
  const onOutside = (e) => { if (el && !el.contains(e.target)) removeNudge(); };
  const el = h('div', { class: 'tour-nudge', role: 'region', 'aria-label': 'Site turu önerisi' },
    h('span', { class: 'tour-nudge-icon', 'aria-hidden': 'true' }, icon('compass', { size: 16 })),
    h('span', { class: 'tour-nudge-text' }, 'Siteyi tanıyalım mı?'),
    h('button', {
      class: 'btn primary sm', type: 'button',
      onclick: () => { removeNudge(); startTour({ welcome: false }); },
    }, 'Turu başlat'),
    h('button', {
      class: 'btn ghost sm icon', type: 'button', 'aria-label': 'Şimdi değil', title: 'Şimdi değil',
      onclick: () => { nudgeDismissed = true; stopAutoWatch(); removeNudge(); },
    }, icon('close', { size: 16 })),
  );
  document.body.appendChild(el);
  timer = setTimeout(removeNudge, 12000);
  // Oyuna dokunan/tıklayan kullanıcıyı meşgul etme: ilk dış etkileşimde kaybolur
  setTimeout(() => { if (nudge && nudge.el === el) document.addEventListener('pointerdown', onOutside, true); }, 0);
  nudge = { el, cleanup: () => { clearTimeout(timer); document.removeEventListener('pointerdown', onOutside, true); } };
}
function removeNudge() {
  if (!nudge) return;
  nudge.cleanup();
  nudge.el.remove();
  nudge = null;
}

/**
 * Kabuk açılışında bir kez çağrılır. bootAction: adres #tur / #yardim ise 'tour' / 'help'.
 * İlk ziyarette turu (karşılama kartıyla) ~800 ms sonra açar; derin bağlantıda yalnızca küçük bir dürtme gösterir.
 */
export function initOnboarding({ bootAction = null } = {}) {
  if (bootAction === 'tour') { whenReady(() => startTour({ welcome: !tourSeen() }), 300); return; }
  if (bootAction === 'help') { whenReady(openHelp, 300); return; }
  if (tourSeen() || automationBlocked()) return;
  whenReady(autoStart, 800);
}
