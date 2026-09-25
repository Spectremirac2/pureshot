// Uygulama kabuğu: üst HUD (skor şeridi), alt yetenek çubuğu (gezinme), bölüm yükleyici ve alt bilgi.
// İlk giriş turu, "?" yardım paneli ve ad menüsü: core/tour.js (bkz. docs/REHBER.md). Sürprizler: core/easter.js.

import { h, clear, fmtNum, fmtClock, cleanText } from './dom.js';
import { icon } from './icons.js';
import { ROUTES, parseHash, hashFor } from './routes.js';
import { store, agg } from './store.js';
import { sound } from './sound.js';
import { fx } from './fx.js';
import { startTour, openHelp, isTourOpen, initOnboarding, TOUR_EVENT, HELP_EVENT } from './tour.js';
import { initEaster } from './easter.js';

// Başka modüller turu/yardımı içe aktarmadan da açabilsin: document.dispatchEvent(new CustomEvent('csk:tour'))
export { startTour, openHelp, isTourOpen };

/** #tur / #yardim adresleri bölüm değil, eylemdir (SSS ve paylaşılan bağlantılar için). */
const ACTION_HASHES = { '#tur': 'tour', '#yardim': 'help' };

let hotkeysOn = true;
let current = { section: null, sub: null, mod: null, cleanup: null };
let viewEl = null;
let barButtons = new Map();
let mountToken = 0;

/** Bölümlere verilen bağlam nesnesi. */
function makeCtx(section, sub) {
  return {
    section,
    sub,
    store,
    sound,
    fx,
    /** Başka bölüme / alt sayfaya git. */
    go(sec, s) { location.hash = hashFor(sec, s); },
    /** Aynı bölümde alt sayfayı değiştir (yeniden bağlamadan hash'i günceller). */
    setSub(s, { push = false } = {}) {
      current.sub = s || null;
      const target = hashFor(section, s);
      if (location.hash !== target) {
        if (push) history.pushState(null, '', target);
        else history.replaceState(null, '', target);
      }
      highlight();
    },
    /** Oyunlar Q/W/E/R tuşlarını kullanırken gezinme kısayollarını kapatır. */
    hotkeys(on) { hotkeysOn = !!on; },
  };
}

function highlight() {
  for (const [id, btn] of barButtons) {
    const active = id === current.section || (id === 'arena' && current.section === 'oyunlar' && current.sub === 'arena');
    const onArena = current.section === 'oyunlar' && current.sub === 'arena';
    const isActive = id === 'oyunlar' ? active && !onArena : active;
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  }
}

async function route() {
  const { section, sub } = parseHash();
  if (current.section === section && current.mod) {
    if (current.sub !== sub) {
      current.sub = sub;
      if (typeof current.mod.onSub === 'function') {
        current.mod.onSub(sub);
        highlight();
        return;
      }
    } else {
      return;
    }
  }
  const token = ++mountToken;
  if (current.cleanup) {
    try { current.cleanup(); } catch (e) { console.error(e); }
  }
  current = { section, sub, mod: null, cleanup: null };
  hotkeysOn = true;
  highlight();
  clear(viewEl);
  viewEl.appendChild(h('div', { class: 'wrap view-loading' }, h('div', { class: 'spinner' })));
  const r = ROUTES.find((x) => x.id === section);
  let mod;
  try {
    mod = (await r.load()).default;
  } catch (e) {
    console.error(e);
    if (token !== mountToken) return;
    clear(viewEl);
    viewEl.appendChild(h('div', { class: 'wrap empty' }, 'Bu bölüm yüklenemedi. Sayfayı yenileyip tekrar deneyin.'));
    return;
  }
  if (token !== mountToken) return;
  clear(viewEl);
  const host = h('div', { class: `section-root sec-${section}` });
  viewEl.appendChild(host);
  current.mod = mod;
  document.title = section === 'ana' ? 'DOG DOG DOG Üssü' : `${r.label} · DOG DOG DOG Üssü`;
  try {
    const cleanup = mod.mount(host, makeCtx(section, sub));
    current.cleanup = typeof cleanup === 'function' ? cleanup : null;
  } catch (e) {
    console.error(e);
    host.appendChild(h('div', { class: 'wrap empty' }, 'Bu bölümde bir hata oldu. Başka bir bölüme geçip geri dönün.'));
  }
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

// ------------------------------------------------------------------ Nick düzenleme
export function openNickEditor() {
  const me = store.me.get();
  const input = h('input', { class: 'input', id: 'nick-input', maxlength: '24', value: me.nick || '', autocomplete: 'off' });
  let close;
  const save = () => {
    const v = cleanText(input.value, 24);
    if (v.length < 2) { fx.toast('Takma ad en az 2 karakter olmalı.', 'blood'); return; }
    store.me.patch({ nick: v }, { delay: 200 });
    fx.toast(`Artık sen "${v}" oldun.`, 'jade');
    close();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } });
  close = fx.modal(
    h('div', { class: 'stack' },
      h('span', { class: 'eyebrow' }, 'Oyuncu kartı'),
      h('h2', { class: 'h2' }, 'Takma adın'),
      h('p', { class: 'muted small' }, 'Espri, yorum ve skor tablolarında bu ad görünür. Kick adını yazabilirsin.'),
      h('div', { class: 'field' }, h('label', { for: 'nick-input' }, 'Takma ad'), input),
      h('div', { class: 'row', style: 'justify-content:flex-end' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => close() }, 'Vazgeç'),
        h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Kaydet'),
      ),
    ),
    { label: 'Takma ad' },
  );
}

// ------------------------------------------------------------------ DOG basma (global)
let dogCountEl = null;
let totalDog = 0;
export function pressDog(originEl) {
  store.me.patch((d) => { d.dog = (Number(d.dog) || 0) + 1; }, { delay: 1500 });
  totalDog += 1;
  if (dogCountEl) dogCountEl.textContent = fmtNum(totalDog);
  sound.dogdogdog();
  if (originEl) {
    const r = originEl.getBoundingClientRect();
    fx.floatText('DOG!', r.left + r.width / 2, r.top + r.height / 2, { count: 3 });
  }
}

// ------------------------------------------------------------------ Ad çipi menüsü
/**
 * HUD'daki ad çipi bir menü düğmesidir: Profilim (#profil), Adını değiştir, Yardım, Turu başlat.
 * WAI-ARIA menü düğmesi kalıbı: Enter/Boşluk/↓ açar ve ilk öğeye odaklanır, ↑ son öğeye; menüde ↑ ↓ Home End,
 * Esc kapatıp çipe döner, Tab kapatır. Dışarı tıklama ve sayfa değişimi menüyü kapatır.
 */
function buildNickMenu() {
  const nickOf = () => store.me.get().nick || 'Anonim';
  const nickText = h('span', null, nickOf());
  const nickBtn = h('button', {
    class: 'chip hud-nick', type: 'button', title: 'Profil menüsü',
    'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': 'hud-menu', 'aria-label': `Profil menüsü: ${nickOf()}`,
  }, icon('user', { size: 14 }), nickText);
  const headNick = h('strong', { class: 'hud-menu-nick' }, nickOf());
  const menu = h('div', { class: 'hud-menu', id: 'hud-menu', role: 'menu', 'aria-label': 'Profil menüsü', hidden: true });
  const wrap = h('div', { class: 'hud-nick-wrap' }, nickBtn, menu);
  let open = false;

  const item = (tag, props, ic, label, sub, action) => {
    const el = h(tag, { class: 'hud-menu-item', role: 'menuitem', tabindex: '-1', ...props },
      h('span', { class: 'hud-menu-icon', 'aria-hidden': 'true' }, icon(ic, { size: 18 })),
      h('span', { class: 'hud-menu-text' }, h('span', null, label), sub ? h('span', { class: 'hud-menu-sub' }, sub) : null),
    );
    el.addEventListener('click', (e) => {
      if (tag !== 'a') e.preventDefault();
      closeMenu(true);
      action();
    });
    return el;
  };
  const items = [
    item('a', { href: '#profil' }, 'user', 'Profilim', 'Fan kartı, rekorlar, rozetler', () => sound.click()),
    item('button', { type: 'button' }, 'pen', 'Adını değiştir', null, () => openNickEditor()),
    item('button', { type: 'button' }, 'keyboard', 'Yardım ve kısayollar', null, () => openHelp()),
    item('button', { type: 'button' }, 'compass', 'Turu başlat', null, () => startTour()),
  ];
  menu.append(
    h('div', { class: 'hud-menu-head', role: 'presentation' }, h('span', { class: 'hud-menu-label' }, 'Oyuncu kartı'), headNick),
    items[0], items[1],
    h('div', { class: 'hud-menu-sep', role: 'separator' }),
    items[2], items[3],
  );

  const focusItem = (n) => items[(n + items.length) % items.length].focus({ preventScroll: true });
  const onDocDown = (e) => { if (!wrap.contains(e.target)) closeMenu(false); };
  function openMenu(n = 0) {
    if (open) { focusItem(n); return; }
    open = true;
    headNick.textContent = nickOf();
    menu.hidden = false;
    nickBtn.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', onDocDown, true);
    sound.click();
    focusItem(n);
  }
  function closeMenu(focusBtn) {
    if (!open) return;
    open = false;
    menu.hidden = true;
    nickBtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onDocDown, true);
    if (focusBtn) nickBtn.focus({ preventScroll: true });
  }

  nickBtn.addEventListener('click', () => (open ? closeMenu(true) : openMenu(0)));
  nickBtn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu(e.key === 'ArrowUp' ? items.length - 1 : 0);
    }
  });
  menu.addEventListener('keydown', (e) => {
    const at = items.indexOf(document.activeElement);
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); focusItem(at + 1); break;
      case 'ArrowUp': e.preventDefault(); focusItem(at < 0 ? items.length - 1 : at - 1); break;
      case 'Home': e.preventDefault(); focusItem(0); break;
      case 'End': e.preventDefault(); focusItem(items.length - 1); break;
      case 'Escape': e.preventDefault(); e.stopPropagation(); closeMenu(true); break;
      case 'Tab': closeMenu(true); break;
      default:
    }
  });
  window.addEventListener('hashchange', () => closeMenu(false));
  store.me.subscribe((d) => {
    const n = d.nick || 'Anonim';
    nickText.textContent = n;
    headNick.textContent = n;
    nickBtn.setAttribute('aria-label', `Profil menüsü: ${n}`);
  });
  return { wrap, closeMenu };
}

// ------------------------------------------------------------------ Kabuk
export function mountShell(root) {
  const start = Date.now();

  // #tur / #yardim ile açıldıysa bölümü Üs'e çevir, eylemi tur modülüne bırak
  const bootAction = ACTION_HASHES[location.hash] || null;
  if (bootAction) history.replaceState(null, '', '#ana');

  // Üst HUD
  dogCountEl = h('span', { class: 'num hud-dog-count' }, '0');
  const clockEl = h('span', { class: 'num' }, '00:00:00');
  const soundBtn = h('button', { class: 'btn ghost sm icon hud-sound', type: 'button', 'aria-label': 'Sesi aç/kapat', title: 'Ses' });
  const renderSound = () => {
    clear(soundBtn).appendChild(icon(sound.enabled ? 'sound' : 'mute', { size: 18 }));
    soundBtn.setAttribute('aria-pressed', String(sound.enabled));
  };
  renderSound();
  soundBtn.addEventListener('click', () => { sound.setEnabled(!sound.enabled); renderSound(); if (sound.enabled) sound.click(); });
  sound.onChange(renderSound);

  const helpBtn = h('button', {
    class: 'btn ghost sm icon hud-help', type: 'button',
    'aria-label': 'Yardım ve kısayollar', 'aria-keyshortcuts': '?', title: 'Yardım ve kısayollar (?)',
  }, icon('question', { size: 18 }));
  helpBtn.addEventListener('click', () => { sound.click(); openHelp(); });

  const nickMenu = buildNickMenu();

  const dogBtn = h('button', { class: 'hud-dog', type: 'button', title: 'DOG! (her tık topluluk sayacına eklenir)' },
    icon('paw', { size: 18 }),
    h('span', { class: 'hud-dog-label' }, 'DOG'),
    dogCountEl,
  );
  dogBtn.addEventListener('click', () => pressDog(dogBtn));

  const hud = h('header', { class: 'hud-top' },
    h('a', { class: 'hud-brand', href: '#ana', 'aria-label': 'Ana sayfa' },
      h('span', { class: 'hud-crest', 'aria-hidden': 'true' }, icon('paw', { size: 18, stroke: 2.2 })),
      h('span', { class: 'hud-brand-text' },
        h('strong', null, 'CURESHOT'),
        h('span', null, 'hayran üssü'),
      ),
    ),
    h('div', { class: 'hud-center' },
      dogBtn,
      h('div', { class: 'hud-clock', title: 'Bu sekmede geçen süre. Yayın hâlâ ısınma turunda.' },
        icon('hourglass', { size: 16 }),
        h('span', { class: 'hud-clock-label' }, 'Maraton'),
        clockEl,
      ),
    ),
    h('div', { class: 'hud-right' },
      h('a', { class: 'badge live hud-kick', lang: 'en', href: 'https://kick.com/cureshotkick', target: '_blank', rel: 'noopener noreferrer' }, 'Kick'),
      nickMenu.wrap,
      soundBtn,
      helpBtn,
    ),
  );

  store.fans((fans) => {
    totalDog = agg.totalDog(fans);
    dogCountEl.textContent = fmtNum(totalDog);
  });
  setInterval(() => { clockEl.textContent = fmtClock((Date.now() - start) / 1000); }, 1000);

  // Alt yetenek çubuğu
  const bar = h('nav', { class: 'ability-bar', 'aria-label': 'Bölümler' });
  const slots = h('div', { class: 'ability-slots' });
  for (const r of ROUTES) {
    if (r.hidden) continue;
    const btn = h('a', {
      class: `ability${r.ultimate ? ' ult' : ''}`,
      href: '#' + r.id,
      title: `${r.label} (${r.key})`,
      'aria-keyshortcuts': r.key,
      dataset: { route: r.id },
    },
      h('span', { class: 'ability-key', 'aria-hidden': 'true' }, r.key),
      h('span', { class: 'ability-icon' }, icon(r.icon, { size: r.ultimate ? 26 : 22 })),
      h('span', { class: 'ability-label' }, r.short),
      h('span', { class: 'ability-cd', 'aria-hidden': 'true' }),
    );
    btn.addEventListener('click', () => {
      sound.click();
      btn.classList.remove('casting');
      void btn.offsetWidth;
      btn.classList.add('casting');
    });
    barButtons.set(r.id, btn);
    if (r.item) {
      btn.classList.add('item');
      slots.appendChild(h('span', { class: 'ability-sep', 'aria-hidden': 'true' }));
    }
    slots.appendChild(btn);
  }
  bar.appendChild(slots);

  viewEl = h('main', { class: 'view', id: 'view', tabindex: '-1' });

  const footer = h('footer', { class: 'site-footer wrap' },
    h('div', { class: 'footer-grid' },
      h('div', { class: 'stack' },
        h('span', { class: 'eyebrow' }, 'Resmi olmayan hayran sitesi'),
        h('p', { class: 'small muted' },
          'Bu site hayranlar tarafından eğlence amaçlı yapıldı; CureShotKick ile resmi bir bağlantısı yoktur. ',
          'Dota 2, Valve Corporation\'ın ticari markasıdır; kahraman görselleri Valve\'a aittir. Afişler, DOG portreleri ve 3D modeller fal.ai ile üretildi; espriler ve analizler mizah amaçlıdır.',
        ),
      ),
      h('div', { class: 'stack' },
        h('span', { class: 'eyebrow' }, 'Yayın'),
        h('a', { href: 'https://kick.com/cureshotkick', target: '_blank', rel: 'noopener noreferrer', class: 'small' }, 'kick.com/cureshotkick'),
        h('p', { class: 'xsmall dim' }, 'En kısa yayın 24 saat. Suyunu al, ward’ını koy.'),
      ),
      h('div', { class: 'stack' },
        h('span', { class: 'eyebrow' }, 'Rehber'),
        h('div', { class: 'row footer-guide' },
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { sound.click(); startTour(); } }, icon('compass', { size: 16 }), 'Turu yeniden başlat'),
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { sound.click(); openHelp(); } }, icon('keyboard', { size: 16 }), 'Kısayollar'),
        ),
        h('p', { class: 'xsmall dim' }, 'Kısayollar: Q W E R D F T Z · Üs için H · Yardım için ?'),
      ),
    ),
  );

  root.append(hud, viewEl, footer, bar);

  // Alt çubuğun gerçek yüksekliğini --bar-h olarak yayınla (güvenli alan payı hariç; tüketiciler onu ayrıca ekler)
  const syncBarH = () => {
    const hgt = slots.offsetHeight + 16;
    if (hgt > 16) document.documentElement.style.setProperty('--bar-h', hgt + 'px');
  };
  syncBarH();
  try { new ResizeObserver(syncBarH).observe(slots); } catch { window.addEventListener('resize', syncBarH); }

  // Sürprizler (Konami, "dogdogdog"): kısayol işleyicisinden beslenir
  const easter = initEaster({ onDog: () => pressDog(dogBtn) });

  // Klavye kısayolları (tur açıkken tur kendi tuşlarını yakalar; burada da ayrıca kapalı)
  window.addEventListener('keydown', (e) => {
    if (!hotkeysOn || isTourOpen() || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (document.querySelector('.modal-backdrop')) return;
    if (e.key === '?') {
      e.preventDefault();
      nickMenu.closeMenu(false);
      openHelp();
      return;
    }
    if (easter.feed(e)) { e.preventDefault(); return; }
    const key = e.key.toUpperCase();
    const r = ROUTES.find((x) => x.key && x.key === key);
    if (!r) return;
    e.preventDefault();
    const btn = barButtons.get(r.id);
    if (btn) {
      btn.classList.remove('casting');
      void btn.offsetWidth;
      btn.classList.add('casting');
    }
    sound.click();
    location.hash = '#' + r.id;
  });

  // #tur / #yardim bağlantıları (SSS, alt bilgi, paylaşılan adres): gezinmeden eylemi çalıştır
  document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[href="#tur"], a[href="#yardim"]') : null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    sound.click();
    if (ACTION_HASHES[a.getAttribute('href')] === 'tour') startTour(); else openHelp();
  });
  document.addEventListener(TOUR_EVENT, () => startTour());
  document.addEventListener(HELP_EVENT, () => openHelp());

  window.addEventListener('hashchange', () => {
    const act = ACTION_HASHES[location.hash];
    if (act) {
      // Adres çubuğuna elle yazıldı: bulunduğun sayfada kal, eylemi çalıştır
      history.replaceState(null, '', current.section ? hashFor(current.section, current.sub) : '#ana');
      if (act === 'tour') startTour(); else openHelp();
      return;
    }
    route();
  });
  route();
  // İlk ziyaret turu: kabuk ve ilk bölüm çizildikten ~800 ms sonra (derin bağlantıda yalnızca küçük bir öneri)
  initOnboarding({ bootAction });
}
