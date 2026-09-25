// Uygulama kabuğu: üst HUD (skor şeridi), alt yetenek çubuğu (gezinme), bölüm yükleyici ve alt bilgi.

import { h, clear, fmtNum, fmtClock, cleanText } from './dom.js';
import { icon } from './icons.js';
import { ROUTES, parseHash, hashFor } from './routes.js';
import { store, agg } from './store.js';
import { sound } from './sound.js';
import { fx } from './fx.js';

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

// ------------------------------------------------------------------ Kabuk
export function mountShell(root) {
  const start = Date.now();

  // Üst HUD
  dogCountEl = h('span', { class: 'num hud-dog-count' }, '0');
  const clockEl = h('span', { class: 'num' }, '00:00:00');
  const soundBtn = h('button', { class: 'btn ghost sm icon', type: 'button', 'aria-label': 'Sesi aç/kapat', title: 'Ses' });
  const renderSound = () => {
    clear(soundBtn).appendChild(icon(sound.enabled ? 'sound' : 'mute', { size: 18 }));
    soundBtn.setAttribute('aria-pressed', String(sound.enabled));
  };
  renderSound();
  soundBtn.addEventListener('click', () => { sound.setEnabled(!sound.enabled); renderSound(); if (sound.enabled) sound.click(); });

  const nickBtn = h('button', { class: 'chip hud-nick', type: 'button', title: 'Takma adını değiştir', 'aria-label': 'Takma adını değiştir' }, icon('user', { size: 14 }), h('span', null, store.me.get().nick));
  nickBtn.addEventListener('click', openNickEditor);
  store.me.subscribe((d) => { nickBtn.lastChild.textContent = d.nick || 'Anonim'; });

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
      nickBtn,
      soundBtn,
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
        h('p', { class: 'xsmall dim' }, 'Kısayollar: Q W E R D F T Z · Üs için H'),
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

  // Klavye kısayolları
  window.addEventListener('keydown', (e) => {
    if (!hotkeysOn || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (document.querySelector('.modal-backdrop')) return;
    const key = e.key.toUpperCase();
    const r = ROUTES.find((x) => x.key === key);
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

  window.addEventListener('hashchange', route);
  route();
}
