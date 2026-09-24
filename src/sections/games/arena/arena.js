// 1vDOQUZ Arena — sitenin imza 3D oyunu.
// Tek okçu, dokuz DOG. mountArena(el, ctx) oyunu kurar ve tam temizlik fonksiyonu döndürür.

import './arena.css';
import { h, clear, ls, fmtNum, loop, prefersReducedMotion, pick } from '../../../core/dom.js';
import { icon } from '../../../core/icons.js';
import { store as coreStore } from '../../../core/store.js';
import { sound as coreSound } from '../../../core/sound.js';
import { fx as coreFx } from '../../../core/fx.js';
import { mountLeaderboard } from '../../../components/leaderboard.js';
import { portraitEl } from '../../../components/portrait.js';
import { createGame, STEP, ABIL } from './game.js';
import { DOG_TYPES, TYPE_IDS, archOf } from './dogs.js';

const GAME_ID = 'arena';

// Yetenek ikonları (sabit, güvenilir SVG)
const SVG = (d) => `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  q: SVG('<path d="M4 20L18.5 5.5"/><path d="M12.5 5h6.5v6.5"/><path d="M4 20v-4.2M4 20h4.2"/><path d="M7.5 5.5l1.2 2.4M5.2 8.6l2.5.9M15.2 18.8l-.9-2.5M18.4 16.6l-2.4-1.2" opacity=".7"/>'),
  w: SVG('<path d="M3 8.5h10.5a2.8 2.8 0 1 0-2.8-2.8"/><path d="M3 12.5h15a3 3 0 1 1-3 3"/><path d="M3 16.5h6.5"/><path d="M16 8.5h3" opacity=".7"/>'),
  e: SVG('<path d="M6 20.5C7.5 13 12 7.5 19.5 4"/><path d="M10.4 13.6c-3.2.3-5.4-1.4-5.8-4.6 3.2-.3 5.4 1.4 5.8 4.6z"/><path d="M14 9c-.4-3.2 1.2-5.5 4.4-6 .4 3.2-1.2 5.5-4.4 6z"/><path d="M12.3 16.8c.5-3.1 2.8-4.8 6-4.4-.5 3.1-2.8 4.8-6 4.4z"/>'),
  r: SVG('<circle cx="8" cy="9.5" r="1.6"/><circle cx="11" cy="7" r="1.6"/><circle cx="14.2" cy="7" r="1.6"/><circle cx="17" cy="9.5" r="1.6"/><path d="M8.8 15.6c0-2.4 1.6-4.3 3.7-4.3s3.7 1.9 3.7 4.3c0 1.3-1 2-2 2-.8 0-1.1-.5-1.7-.5s-.9.5-1.7.5c-1 0-2-.7-2-2z"/><path d="M3 5.5a11 11 0 0 0 0 13M21.9 5.5a11 11 0 0 1 0 13" opacity=".75"/>'),
  sword: SVG('<path d="M14.5 3H21v6.5L10 20.5 3.5 14z"/><path d="M5 16l3 3M3 21l3-3"/>'),
  aegis: SVG('<path d="M12 3l7 2.6v5.6c0 4.3-3 7.9-7 8.8-4-.9-7-4.5-7-8.8V5.6z"/><path d="M12 7v9M8.5 10.5h7"/>'),
  slow: SVG('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>'),
};

const ABILITY_INFO = {
  q: { name: 'CureShot', desc: 'Basılı tut: 1,2 sn’ye kadar şarj. Bırak: delip geçen ok. Şarj arttıkça hasar ve menzil büyür.' },
  w: { name: 'Rüzgâr Koşusu', desc: '3 sn %60 hız ve %80 kaçınma. Bekleme 12 sn.' },
  e: { name: 'Tango', desc: '3 şarj. 6 sn boyunca can yeniler. Şarjlar zamanla dolar.' },
  r: { name: 'DOG DOG DOG', desc: 'Çevredeki tüm DOG’lara hasar, kısa sersemletme ve korku. Bekleme 30 sn.' },
};

const SCHEMES = {
  wasd: {
    label: 'WASD + Boşluk',
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    q: ['KeyQ', 'Digit1'], w: ['Space', 'ShiftLeft', 'ShiftRight', 'Digit2'], e: ['KeyE', 'Digit3'], r: ['KeyR', 'Digit4'],
    caps: { q: 'Q', w: '␣', e: 'E', r: 'R' },
    move: ['W', 'A', 'S', 'D'],
    wKey: 'Boşluk',
  },
  dota: {
    label: 'Ok tuşları + QWER',
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    q: ['KeyQ', 'Digit1'], w: ['KeyW', 'Space', 'Digit2'], e: ['KeyE', 'Digit3'], r: ['KeyR', 'Digit4'],
    caps: { q: 'Q', w: 'W', e: 'E', r: 'R' },
    move: ['↑', '←', '↓', '→'],
    wKey: 'W',
  },
};

function isTyping(t) {
  return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable));
}

/** Arena oyununu el içine kurar; temizleme fonksiyonu döndürür. */
export function mountArena(el, ctx = {}) {
  const store = ctx.store || coreStore;
  const sound = ctx.sound || coreSound;
  const fx = ctx.fx || coreFx;
  const reduced = prefersReducedMotion();
  const coarse = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } })();
  const mobileGfx = coarse || window.innerWidth < 760;
  if (ctx.hotkeys) ctx.hotkeys(false);

  let alive = true;
  let mode = 'loading'; // loading | start | playing | paused | over
  let view = null;
  let scheme = SCHEMES[ls.get('arena:keys', 'wasd')] ? ls.get('arena:keys', 'wasd') : 'wasd';
  let autoAim = ls.get('arena:auto', coarse);
  let touchMode = coarse;
  const offs = []; // temizlenecek dinleyiciler
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    offs.push(() => target.removeEventListener(type, fn, opts));
  };
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms);
    timers.add(id);
    return id;
  };
  let overLb = null;
  let pageLb = null;

  // ------------------------------------------------------------------ DOM
  const bestNow = () => {
    const v = (store.me.get().scores || {})[GAME_ID];
    return typeof v === 'number' ? v : null;
  };

  const live = h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  const stage = h('div', {
    class: 'ar-stage',
    tabindex: '-1',
    role: 'region',
    'aria-label': '1vDOQUZ Arena oyun alanı',
  });
  const frame = h('div', { class: 'ar-frame frame' }, stage);

  // Üst başlık
  const headBest = h('strong', { class: 'num' }, '—');
  const head = h('div', { class: 'ar-head' },
    h('div', { class: 'ar-head-text' },
      h('span', { class: 'eyebrow' }, 'İmza oyun · 3D · hayran yapımı'),
      h('h1', { class: 'h1 ar-title' }, '1vDO', h('em', null, 'Q'), 'UZ Arena'),
      h('p', { class: 'ar-lead muted' }, 'Tek okçu, dokuz DOG. Dalga dalga gelen sürüyü CureShot ile del, dokuzunu da indir.'),
    ),
    h('div', { class: 'ar-head-best' }, icon('trophy', { size: 16 }), h('span', { class: 'small muted' }, 'En iyin'), headBest),
  );

  // --- HUD
  const hud = h('div', { class: 'ar-hud' });
  const nKills = h('b', { class: 'num' }, '0');
  const nWave = h('b', { class: 'num' }, '1');
  const nDogs = h('b', { class: 'num' }, '9/9');
  const top = h('div', { class: 'ar-top', 'aria-hidden': 'true' },
    h('div', { class: 'ar-top-cell' }, h('span', null, 'Öldürme'), nKills),
    h('div', { class: 'ar-top-cell ar-top-wave' }, h('span', null, 'Dalga'), nWave),
    h('div', { class: 'ar-top-cell ar-top-dogs' }, h('span', null, 'DOG'), nDogs),
  );
  const nScore = h('b', { class: 'num' }, '0');
  const nAcc = h('span', { class: 'num' }, '—');
  const scoreBox = h('div', { class: 'ar-scorebox', 'aria-hidden': 'true' },
    h('span', { class: 'ar-scorebox-l' }, 'Skor'), nScore,
    h('span', { class: 'ar-scorebox-s' }, 'İsabet ', nAcc),
  );
  const pauseBtn = h('button', { class: 'ar-tool', type: 'button', 'aria-label': 'Duraklat (Esc)', title: 'Duraklat (Esc / P)' }, icon('pause', { size: 18 }));
  const fsBtn = h('button', { class: 'ar-tool', type: 'button', 'aria-label': 'Tam ekran', title: 'Tam ekran' }, h('span', { html: SVG('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>') }));
  const fsSupported = !!(stage.requestFullscreen || stage.webkitRequestFullscreen);
  if (!fsSupported) fsBtn.hidden = true;
  const tools = h('div', { class: 'ar-tools' }, fsBtn, pauseBtn);
  const banner = h('div', { class: 'ar-banner', 'aria-hidden': 'true' });
  const floats = h('div', { class: 'ar-floats', 'aria-hidden': 'true' });
  const edges = h('div', { class: 'ar-edges', 'aria-hidden': 'true' });
  const vignette = h('div', { class: 'ar-vignette', 'aria-hidden': 'true' });
  const stampHost = h('div', { class: 'ar-stamphost', 'aria-hidden': 'true' });

  // yetenek slotları
  function makeSlot(key, cls, fixedCap = false) {
    const cd = h('span', { class: 'ar-slot-cd' });
    const cdText = h('span', { class: 'ar-slot-cdt num' });
    const cap = h('span', { class: 'ar-slot-key' }, fixedCap ? key.toUpperCase() : SCHEMES[scheme].caps[key]);
    const extra = h('span', { class: 'ar-slot-extra num' });
    const charge = h('span', { class: 'ar-slot-charge' });
    const btn = h('button', {
      class: `ar-slot ${cls} ar-slot-${key}`,
      type: 'button',
      'aria-label': `${ABILITY_INFO[key].name}: ${ABILITY_INFO[key].desc}`,
      title: `${ABILITY_INFO[key].name} — ${ABILITY_INFO[key].desc}`,
    },
      h('span', { class: 'ar-slot-icon', html: ICONS[key] }),
      charge, cd, cdText, cap, extra,
    );
    return { key, btn, cd, cdText, cap, extra, charge, last: {} };
  }
  const slots = { q: makeSlot('q', ''), w: makeSlot('w', ''), e: makeSlot('e', ''), r: makeSlot('r', 'ult') };
  const tslots = { q: makeSlot('q', 'ar-tbtn', true), w: makeSlot('w', 'ar-tbtn', true), e: makeSlot('e', 'ar-tbtn', true), r: makeSlot('r', 'ar-tbtn ult', true) };

  const hpFill = h('span', { class: 'ar-bar-fill' });
  const hpText = h('span', { class: 'ar-bar-text num' });
  const mpFill = h('span', { class: 'ar-bar-fill' });
  const mpText = h('span', { class: 'ar-bar-text num' });
  const hpBar = h('div', { class: 'ar-bar ar-hp', role: 'meter', 'aria-label': 'Can', 'aria-valuemin': '0' }, hpFill, hpText);
  const mpBar = h('div', { class: 'ar-bar ar-mp', role: 'meter', 'aria-label': 'Mana', 'aria-valuemin': '0' }, mpFill, mpText);
  const buffs = h('div', { class: 'ar-buffs', 'aria-hidden': 'true' });
  const buffEls = {};
  for (const [k, ic, cls, name] of [['w', ICONS.w, 'jade', 'Rüzgâr'], ['e', ICONS.e, 'jade', 'Tango'], ['rapier', ICONS.sword, 'gold', 'Rapier'], ['aegis', ICONS.aegis, 'gold', 'Aegis'], ['slow', ICONS.slow, 'blood', 'REPORT']]) {
    const t = h('span', { class: 'ar-buff-t num' });
    const b = h('span', { class: `ar-buff ${cls}`, title: name, hidden: true }, h('span', { class: 'ar-buff-i', html: ic }), t);
    buffEls[k] = { b, t };
    buffs.appendChild(b);
  }
  const panel = h('div', { class: 'ar-panel' },
    buffs,
    h('div', { class: 'ar-panel-box' },
      h('div', { class: 'ar-slots' }, slots.q.btn, slots.w.btn, slots.e.btn, slots.r.btn),
      h('div', { class: 'ar-bars' }, hpBar, mpBar),
    ),
  );
  hud.append(vignette, edges, floats, top, scoreBox, tools, banner, stampHost, panel);

  // dokunmatik kontroller
  const joyKnob = h('span', { class: 'ar-joy-knob' });
  const joyBase = h('span', { class: 'ar-joy-base' }, joyKnob);
  const joyZone = h('div', { class: 'ar-joyzone', 'aria-hidden': 'true' }, joyBase);
  const tbtns = h('div', { class: 'ar-tbtns' }, tslots.q.btn, tslots.w.btn, tslots.e.btn, tslots.r.btn);
  const touchLayer = h('div', { class: 'ar-touch' }, joyZone, tbtns);

  // --- ekranlar
  const screens = h('div', { class: 'ar-screens' });
  const startBtn = h('button', { class: 'btn primary lg ar-start-btn', type: 'button', disabled: true }, icon('play', { size: 18 }), h('span', null, 'Yükleniyor…'));
  const startBest = h('span', { class: 'ar-start-best small muted' });
  const schemeChips = [];
  const autoBoxes = [];
  function optionsBlock(idSuffix) {
    const chips = Object.entries(SCHEMES).map(([id, s]) => {
      const c = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(id === scheme), dataset: { scheme: id } }, s.label);
      c.addEventListener('click', () => setScheme(id));
      schemeChips.push(c);
      return c;
    });
    const box = h('input', { type: 'checkbox', id: `ar-auto-${idSuffix}`, class: 'ar-check', checked: autoAim });
    box.addEventListener('change', () => setAuto(box.checked));
    autoBoxes.push(box);
    return h('div', { class: 'ar-opts' },
      h('div', { class: 'ar-opt', role: 'group', 'aria-label': 'Tuş düzeni' }, h('span', { class: 'label' }, 'Tuş düzeni'), h('div', { class: 'row ar-chips' }, chips)),
      h('label', { class: 'ar-opt ar-opt-check', for: `ar-auto-${idSuffix}` }, box, h('span', null, 'Otomatik nişan (en yakın DOG)')),
    );
  }
  const keyTable = h('table', { class: 'ar-keys' });
  function renderKeyTable() {
    const S = SCHEMES[scheme];
    const k = (s) => h('span', { class: 'kbd' }, s);
    clear(keyTable);
    const rows = [
      [[...S.move.map(k), scheme === 'wasd' ? h('span', { class: 'dim xsmall' }, ' / oklar') : null], 'Hareket'],
      [[h('span', { class: 'kbd' }, 'Fare')], 'Nişan al'],
      [[k('Q'), h('span', { class: 'dim xsmall' }, ' veya '), h('span', { class: 'kbd' }, 'Sol tık')], 'CureShot: basılı tut, şarj et, bırak'],
      [[k(S.wKey)], 'Rüzgâr Koşusu: hız + kaçınma'],
      [[k('E')], 'Tango: can yenile (3 şarj)'],
      [[k('R')], 'DOG DOG DOG: korku + sersemletme'],
      [[k('Esc'), k('P')], 'Duraklat'],
    ];
    keyTable.appendChild(h('caption', { class: 'sr-only' }, 'Klavye ve fare kontrolleri'));
    for (const [keys, what] of rows) keyTable.appendChild(h('tr', null, h('td', { class: 'ar-keys-k' }, keys), h('td', null, what)));
  }
  renderKeyTable();
  const touchHelp = h('ul', { class: 'ar-touchhelp' },
    h('li', null, h('b', null, 'Sol başparmak:'), ' ekranın soluna dokunup sürükle, yürü.'),
    h('li', null, h('b', null, 'Q basılı tut:'), ' şarj et; sürüklersen nişan alırsın, sürüklemezsen en yakın DOG’a gider.'),
    h('li', null, h('b', null, 'Sağ tarafa dokun:'), ' o noktaya ok at (basılı tut = şarj).'),
    h('li', null, h('b', null, 'W E R:'), ' Rüzgâr Koşusu, Tango, DOG DOG DOG.'),
  );
  const startScreen = h('div', { class: 'ar-screen ar-start', role: 'dialog', 'aria-label': 'Arena başlangıç ekranı' },
    h('div', { class: 'ar-card ar-start-card' },
      h('div', { class: 'ar-start-main' },
        h('span', { class: 'eyebrow' }, 'Hikâye'),
        h('h2', { class: 'ar-start-title' }, '1vDO', h('em', null, 'Q'), 'UZ'),
        h('p', { class: 'ar-start-story' }, 'Dört takım arkadaşı, beş rakip: toplam dokuz DOG arenaya dalıyor. Sen tek başına bir okçusun. Dokuzunu da indir, damga vurulsun: ', h('b', null, '1vDOQUZ!'), ' Her dalga biraz daha hızlı, biraz daha DOG.'),
        h('ul', { class: 'ar-start-rules' },
          h('li', null, 'Her DOG türü farklı: Farm kaçar, AFK uyur, Kurye Tango çalar, Chat REPORT atar.'),
          h('li', null, 'Dalga bitince ortada Aegis belirir: üstüne yürü, bir kez ölümden dön.'),
          h('li', null, 'Rapier Köpeği düşerse Rapier’i kap: 8 sn çift hasar.'),
        ),
        h('div', { class: 'ar-start-cta' }, startBtn, startBest),
        optionsBlock('s'),
      ),
      h('div', { class: 'ar-start-side' },
        h('span', { class: 'eyebrow' }, 'Kontroller'),
        h('div', { class: 'ar-ctl-keys' }, keyTable),
        h('div', { class: 'ar-ctl-touch' }, touchHelp),
      ),
    ),
  );
  const resumeBtn = h('button', { class: 'btn primary lg', type: 'button' }, icon('play', { size: 18 }), 'Devam');
  const restartBtn = h('button', { class: 'btn ghost', type: 'button' }, icon('refresh', { size: 16 }), 'Baştan başla');
  const menuBtn = h('button', { class: 'btn ghost', type: 'button' }, icon('arrowLeft', { size: 16 }), 'Menüye dön');
  const pauseScreen = h('div', { class: 'ar-screen ar-pause', role: 'dialog', 'aria-label': 'Oyun duraklatıldı', hidden: true },
    h('div', { class: 'ar-card ar-pause-card' },
      h('span', { class: 'eyebrow' }, 'Pause'),
      h('h2', { class: 'h2' }, 'Duraklatıldı'),
      h('p', { class: 'muted small' }, 'DOG’lar da bekliyor. Pause Köpeği bu ana bayılıyor.'),
      h('div', { class: 'row ar-pause-btns' }, resumeBtn, restartBtn, menuBtn),
      optionsBlock('p'),
    ),
  );
  const overBody = h('div', { class: 'ar-over-body' });
  const overLbHost = h('div', { class: 'ar-over-lb' });
  const overScreen = h('div', { class: 'ar-screen ar-over', role: 'dialog', 'aria-label': 'Maç sonu raporu', hidden: true },
    h('div', { class: 'ar-over-grid' }, overBody, overLbHost),
  );
  screens.append(startScreen, pauseScreen, overScreen);
  stage.append(hud, touchLayer, screens, live);

  // --- sahanın altı: rehber + skor tablosu
  const guide = h('div', { class: 'ar-guide-grid' });
  for (const id of TYPE_IDS) {
    const a = archOf(id);
    const T = DOG_TYPES[id];
    guide.appendChild(h('article', { class: 'ar-guide-card', style: { '--tc': a.color } },
      portraitEl(a, { cls: 'ar-guide-img', alt: '' }),
      h('div', { class: 'ar-guide-txt' },
        h('h3', { class: 'ar-guide-name' }, a.name),
        h('p', { class: 'xsmall muted' }, T.hint),
        h('div', { class: 'ar-guide-stats xsmall' },
          h('span', null, 'Can ', h('b', { class: 'num' }, String(T.hp))),
          h('span', null, 'Hız ', h('b', { class: 'num' }, T.speed.toFixed(1))),
          h('span', null, 'Isırık ', h('b', { class: 'num' }, String(T.dmg))),
        ),
      ),
    ));
  }
  const lbHost = h('div', { class: 'ar-lb' });
  const below = h('div', { class: 'ar-below' },
    h('section', { class: 'ar-guide panel', 'aria-labelledby': 'ar-guide-h' },
      h('div', { class: 'panel-head' },
        h('div', null, h('span', { class: 'eyebrow' }, 'Saha rehberi'), h('h2', { class: 'h2', id: 'ar-guide-h' }, 'Arenadaki DOG’lar')),
        h('span', { class: 'badge ember' }, '10 tür · her dalga 9'),
      ),
      guide,
    ),
    lbHost,
  );

  const root = h('section', { class: 'ar', 'aria-label': '1vDOQUZ Arena' }, head, frame, below);
  el.appendChild(root);
  pageLb = mountLeaderboard(lbHost, { gameId: GAME_ID, title: 'Arena Efsaneleri', format: (n) => `${fmtNum(n)} puan` });

  function refreshBest() {
    const b = bestNow();
    headBest.textContent = b == null ? 'henüz yok' : fmtNum(b);
    startBest.textContent = b == null ? 'Henüz skorun yok. İlk dalga seni bekliyor.' : `En iyi skorun: ${fmtNum(b)}`;
  }
  refreshBest();
  const unMe = store.me.subscribe(refreshBest);

  function setTouchMode(v) {
    touchMode = v;
    stage.classList.toggle('is-touch', v);
  }
  setTouchMode(touchMode);

  function setScheme(id) {
    scheme = id;
    ls.set('arena:keys', id);
    for (const c of schemeChips) c.setAttribute('aria-pressed', String(c.dataset.scheme === id));
    for (const s of Object.values(slots)) s.cap.textContent = SCHEMES[id].caps[s.key];
    renderKeyTable();
    keys.clear();
    sound.click();
  }
  function setAuto(v) {
    autoAim = !!v;
    ls.set('arena:auto', autoAim);
    for (const b of autoBoxes) b.checked = autoAim;
  }

  // ------------------------------------------------------------------ oyun
  const game = createGame(onEvent);
  game.lastAuto = true;
  // Otomatik testler için DOM üzerinden erişim (kullanıcıya görünmez).
  root.__arena = game;

  // ------------------------------------------------------------------ duyuru ve yüzen yazılar
  let liveLast = 0;
  function say(msg, force = false) {
    const now = performance.now();
    if (!force && now - liveLast < 2500) return;
    liveLast = now;
    live.textContent = msg;
  }

  const floatPool = [];
  for (let i = 0; i < 28; i++) {
    const s = h('span', { class: 'ar-float' });
    floats.appendChild(s);
    floatPool.push(s);
  }
  let floatI = 0;
  function floatAt(text, x, y, z, cls = '') {
    if (!view) return;
    const p = view.project(x, y, z);
    if (p.behind || p.x < -40 || p.y < -40 || p.x > stageW + 40 || p.y > stageH + 40) return;
    const s = floatPool[floatI];
    floatI = (floatI + 1) % floatPool.length;
    s.className = 'ar-float';
    s.textContent = text;
    s.style.left = `${p.x}px`;
    s.style.top = `${p.y}px`;
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 30}px`);
    void s.offsetWidth;
    s.className = `ar-float on ${cls}`;
  }

  let bannerT = 0;
  function showBanner(title, sub = '', cls = '', ms = 1800) {
    clear(banner);
    banner.className = `ar-banner ${cls}`;
    banner.append(h('strong', null, title));
    if (sub) banner.append(h('span', null, sub));
    void banner.offsetWidth;
    banner.classList.add('on');
    bannerT = performance.now() + ms;
  }

  const isFs = () => (document.fullscreenElement || document.webkitFullscreenElement) === stage;
  function stamp(text, variant = '') {
    if (isFs() || !fx.stamp) {
      clear(stampHost);
      stampHost.appendChild(h('span', { class: `stamp ${variant}` }, text));
      stampHost.classList.remove('on');
      void stampHost.offsetWidth;
      stampHost.classList.add('on');
      sound.stamp();
    } else fx.stamp(text, { variant });
  }
  function flashVignette(cls) {
    vignette.classList.remove('hurt', 'ember', 'gold');
    void vignette.offsetWidth;
    vignette.classList.add(cls);
  }

  // ses kısıcı
  const lastSnd = {};
  function snd(name, gap, ...args) {
    const now = performance.now();
    if (lastSnd[name] && now - lastSnd[name] < gap) return;
    lastSnd[name] = now;
    try { sound[name](...args); } catch { /* ses kapalı */ }
  }

  const barkPitch = { feed: 1.25, farm: 1.0, pause: 0.95, afk: 0.8, kurye: 1.45, rapier: 0.75, mid: 0.85, ward: 1.1, smurf: 1.15, chat: 1.35 };

  // ------------------------------------------------------------------ olaylar
  function onEvent(type, d) {
    if (view) view.event(type, d, game);
    const p = game.player;
    switch (type) {
      case 'waveStart':
        showBanner(`Dalga ${d.wave}`, d.wave === 1 ? '9 DOG geliyor. İlk kan senin olsun.' : `9 DOG daha. Daha hızlı, daha DOG.`, 'wave', 2200);
        snd('bark', 0, 1.0);
        later(() => snd('bark', 0, 1.2), 180);
        say(`Dalga ${d.wave} başladı. 9 DOG geliyor.`, true);
        break;
      case 'spawn':
        if (!d.quiet) snd('bark', 140, barkPitch[d.dog.type] || 1);
        break;
      case 'shoot':
        snd('shoot', 40);
        break;
      case 'hit': {
        snd('hit', 55);
        const cls = d.big ? 'big' : d.src === 'ult' ? 'ember' : '';
        floatAt(String(d.dmg), d.dog.x, 1.1, d.dog.z, cls);
        break;
      }
      case 'kill':
        snd('coin', 70);
        floatAt('+100', d.dog.x, 1.5, d.dog.z, 'gold');
        say(`${archOf(d.dog.type).name} indi. Kalan DOG: ${game.dogsLeft}. Skor ${fmtNum(game.score)}.`);
        break;
      case 'multikill':
        showBanner(d.label, `+${d.bonus} bonus`, d.n >= 5 ? 'rampage' : 'multi', 1500);
        if (d.n >= 5) stamp('RAMPAGE!', 'gold');
        else snd('good', 0);
        say(`${d.label}! ${d.bonus} bonus puan.`, true);
        break;
      case 'hurt':
        flashVignette('hurt');
        snd('bad', 380);
        floatAt(`-${d.dmg}`, p.x, 1.8, p.z, 'hurt');
        break;
      case 'evade':
        floatAt('MISS', p.x, 1.9, p.z, 'jade');
        snd('whoosh', 250);
        break;
      case 'noMana':
        floatAt('Mana yok', p.x, 2.0, p.z, 'mana');
        snd('miss', 250);
        nudge(d.key);
        break;
      case 'notReady':
        snd('miss', 250);
        nudge(d.key);
        break;
      case 'windrun':
        snd('whoosh', 0);
        break;
      case 'tango':
        snd('good', 0);
        floatAt('+Tango', p.x, 1.9, p.z, 'jade');
        break;
      case 'tangoStolen':
        floatAt('Tango çalındı!', p.x, 2.0, p.z, 'ember');
        snd('bark', 0, 1.5);
        say('Kurye Köpeği bir Tango çaldı!');
        break;
      case 'ult':
        stamp('DOG DOG DOG', '');
        try { sound.dogdogdog(); } catch { /* yok say */ }
        flashVignette('ember');
        if (!reduced) fx.shake?.(frame);
        break;
      case 'ultHit':
        if (d.n === 0) floatAt('Boşa DOG DOG DOG', p.x, 2.2, p.z, 'ember');
        else say(`DOG DOG DOG! ${d.n} köpek korkuyla kaçıyor.`, true);
        break;
      case 'drop':
        floatAt('Rapier düştü!', d.pickup.x, 1.6, d.pickup.z, 'gold');
        snd('coin', 0);
        break;
      case 'pickup':
        if (d.pickup.kind === 'rapier') {
          showBanner('RAPIER', '8 sn çift hasar. Düşürme sakın.', 'gold', 1600);
          snd('good', 0);
          later(() => snd('coin', 0), 120);
        } else {
          showBanner('AEGIS', d.pickup.full ? 'Zaten vardı: tam can ve mana.' : 'Bir kez ölümden döneceksin.', 'gold', 2000);
          snd('win', 0);
          say('Aegis alındı.', true);
        }
        break;
      case 'aegisUsed':
        showBanner('Aegis kırıldı', 'Yeniden doğuyorsun…', 'gold', 1300);
        break;
      case 'revive':
        stamp('AEGIS!', 'gold');
        flashVignette('gold');
        say('Aegis ile geri döndün.', true);
        break;
      case 'waveClear': {
        stamp('1vDOQUZ!', 'gold');
        snd('win', 0);
        if (!isFs() && !reduced) {
          const r = stage.getBoundingClientRect();
          fx.confetti?.(r.left + r.width / 2, r.top + r.height * 0.45, 110);
        }
        const accTxt = `%${Math.round(d.acc * 100)}`;
        later(() => showBanner(`Dalga ${d.wave} temiz`, `+${fmtNum(d.bonus)} dalga · +${fmtNum(d.accBonus)} isabet (${accTxt})`, 'gold', 2600), 900);
        say(`1vDOQUZ! Dalga ${d.wave} temizlendi. Skor ${fmtNum(game.score)}. Ortada Aegis belirdi.`, true);
        break;
      }
      case 'countdown':
        snd('tick', 0);
        showBanner(String(d.n), `Dalga ${game.wave + 1} geliyor`, 'count', 900);
        break;
      case 'bubble':
        snd('bark', 300, 1.6);
        break;
      case 'bubbleHit':
        floatAt('REPORT! Yavaşladın', p.x, 2.1, p.z, 'hurt');
        break;
      case 'wake':
        floatAt('!', d.dog.x, 1.5, d.dog.z, 'ember big');
        snd('bark', 0, 0.8);
        break;
      case 'farmDone':
        floatAt('6 SLOT!', d.dog.x, 1.7, d.dog.z, 'gold');
        showBanner('Farm Köpeği 6 slot oldu', 'Kovalamadın, şimdi o seni kovalıyor.', 'ember', 1800);
        snd('bad', 0);
        break;
      case 'midAggro':
        floatAt('MID OR FEED!', d.dog.x, 1.7, d.dog.z, 'ember');
        snd('bark', 0, 0.7);
        break;
      case 'pauseDog':
        floatAt('p', d.dog.x, 1.6, d.dog.z, 'arcane');
        break;
      case 'dash':
        snd('whoosh', 120);
        break;
      case 'death':
        showBanner('Sürü seni yakaladı', 'DOG DOG DOG…', 'blood', 1600);
        break;
      case 'gameOver':
        gameOver(d.report);
        break;
      case 'reset':
        for (const s of floatPool) s.className = 'ar-float';
        break;
      default:
        break;
    }
  }

  function nudge(key) {
    for (const s of [slots[key], tslots[key]]) {
      if (!s) continue;
      s.btn.classList.remove('nudge');
      void s.btn.offsetWidth;
      s.btn.classList.add('nudge');
    }
  }

  // ------------------------------------------------------------------ akış
  function showScreen(which) {
    startScreen.hidden = which !== 'start';
    pauseScreen.hidden = which !== 'pause';
    overScreen.hidden = which !== 'over';
    stage.classList.toggle('has-screen', !!which);
  }

  function focusStage() {
    try { stage.focus({ preventScroll: true }); } catch { /* yok say */ }
  }

  function scrollStageIntoView() {
    const r = stage.getBoundingClientRect();
    const hudH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-h')) || 56;
    const barH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || 84;
    const visTop = hudH + 6;
    const visBottom = window.innerHeight - barH - 6;
    if (r.top < visTop || r.bottom > visBottom) {
      const target = window.scrollY + r.top - visTop - Math.max(0, (visBottom - visTop - r.height) / 2);
      window.scrollTo({ top: Math.max(0, target), behavior: reduced ? 'auto' : 'smooth' });
    }
  }

  function startGame() {
    if (!view) return;
    if (overLb) { overLb(); overLb = null; }
    keys.clear();
    game.start();
    mode = 'playing';
    stage.classList.add('is-playing');
    showScreen(null);
    focusStage();
    scrollStageIntoView();
    acc = 0;
    sound.click();
  }

  function pause() {
    if (mode !== 'playing') return;
    mode = 'paused';
    keys.clear();
    game.chargeCancel();
    resetTouch();
    showScreen('pause');
    stage.classList.remove('is-playing');
    say('Oyun duraklatıldı.', true);
    later(() => { try { resumeBtn.focus({ preventScroll: true }); } catch { /* yok say */ } }, 30);
  }

  function resume() {
    if (mode !== 'paused') return;
    mode = 'playing';
    showScreen(null);
    stage.classList.add('is-playing');
    focusStage();
    sound.click();
  }

  function toMenu() {
    if (overLb) { overLb(); overLb = null; }
    mode = 'start';
    stage.classList.remove('is-playing');
    game.attract();
    showScreen('start');
    refreshBest();
    later(() => { try { startBtn.focus({ preventScroll: true }); } catch { /* yok say */ } }, 30);
  }

  function quipFor(r) {
    const pct = Math.round(r.acc * 100);
    const lines = [];
    if (r.kills === 0) lines.push('0 öldürme. AFK Köpeği seni kendi sürüsüne davet etti; teklif hâlâ geçerli.');
    if (r.shots >= 6 && r.acc < 0.35) lines.push(`İsabet %${pct}. Okların yarısı Roshan çukurunda ward arıyor.`);
    if (r.shots >= 10 && r.acc >= 0.8) lines.push(`İsabet %${pct}. Oklar GPS’li; DOG’lar replay istiyor.`);
    if (r.wave >= 5) lines.push(`Dalga ${r.wave}! Takım chat’e “gg carry” yazdı, sen “DOG DOG DOG” dedin.`);
    if (r.bestChain >= 5) lines.push('RAMPAGE yaptın. Chat Köpeği hâlâ REPORT yazıyor.');
    if (r.tangosStolen >= 2) lines.push(`Kurye Köpeği ${r.tangosStolen} Tango’nu çaldı. Eşyalarını yürüyerek al.`);
    if (r.ultKills >= 4) lines.push(`DOG DOG DOG ile ${r.ultKills} köpek indirdin. Meme yerini buldu.`);
    if (r.topType === 'feed') lines.push('En çok Feed Köpeği indirdin. Onlar zaten gönüllüydü.');
    if (r.topType === 'afk') lines.push('En çok AFK Köpeği indirdin. Uyandırmasan belki hâlâ uyuyorlardı.');
    if (r.topType === 'farm') lines.push('Farm Köpeklerini kovaladın. Net worth grafikleri sana küs.');
    if (r.topType === 'chat') lines.push('En çok Chat Köpeği indirdin. All chat nihayet sessiz.');
    if (r.wave <= 1 && r.kills > 0) lines.push('Dalga 1’de düştün. Buyback yok ama “Tekrar oyna” var.');
    if (!lines.length) lines.push('1v9 kolay değil: dokuz DOG, bir okçu, sıfır ward.');
    return pick(lines);
  }

  function gameOver(r) {
    mode = 'over';
    stage.classList.remove('is-playing');
    keys.clear();
    resetTouch();
    const prev = bestNow();
    let better = false;
    try { better = store.me.submitScore(GAME_ID, r.score); } catch { /* yok say */ }
    snd('lose', 0);
    const pct = Math.round(r.acc * 100);
    const top = r.topType ? archOf(r.topType) : null;
    const stat = (label, value, cls = '') => h('div', { class: `ar-stat ${cls}` }, h('dt', null, label), h('dd', { class: 'num' }, value));
    clear(overBody);
    const again = h('button', { class: 'btn primary lg', type: 'button' }, icon('refresh', { size: 18 }), 'Tekrar oyna');
    const menu = h('button', { class: 'btn ghost', type: 'button' }, icon('arrowLeft', { size: 16 }), 'Menü');
    again.addEventListener('click', startGame);
    menu.addEventListener('click', toMenu);
    overBody.append(h('div', { class: 'ar-card ar-report' },
      h('div', { class: 'ar-report-head' },
        h('span', { class: 'eyebrow' }, 'Maç sonu raporu'),
        better ? h('span', { class: 'badge gold' }, icon('crown', { size: 12 }), prev == null ? 'İlk skor' : 'Yeni rekor') : null,
      ),
      h('h2', { class: 'ar-report-title' }, r.wave >= 3 ? 'GG, efsane okçu' : 'Sürü seni yakaladı'),
      h('dl', { class: 'ar-stats' },
        stat('Skor', fmtNum(r.score), 'gold big'),
        stat('Dalga', String(r.wave)),
        stat('Öldürme', String(r.kills)),
        stat('İsabet', r.shots ? `%${pct}` : '—'),
        stat('En iyi seri', r.bestChain >= 2 ? ['', '', 'Double', 'Triple', 'Ultra', 'Rampage'][Math.min(5, r.bestChain)] : '—'),
        stat('Rekorun', fmtNum(bestNow() ?? r.score)),
      ),
      top ? h('div', { class: 'ar-top-kill', style: { '--tc': top.color } },
        portraitEl(top, { cls: 'ar-top-kill-img', alt: '' }),
        h('div', null, h('span', { class: 'xsmall dim' }, 'En çok indirilen tür'), h('strong', null, `${top.name} × ${r.topN}`)),
      ) : null,
      h('p', { class: 'ar-quip' }, '“', quipFor(r), '”'),
      h('div', { class: 'row ar-report-btns' }, again, menu),
    ));
    if (overLb) overLb();
    clear(overLbHost);
    overLb = mountLeaderboard(overLbHost, { gameId: GAME_ID, title: 'Arena Efsaneleri', format: (n) => `${fmtNum(n)} puan` });
    showScreen('over');
    refreshBest();
    say(`Oyun bitti. Dalga ${r.wave}, skor ${fmtNum(r.score)}, ${r.kills} öldürme, isabet yüzde ${pct}.`, true);
    later(() => { try { again.focus({ preventScroll: true }); } catch { /* yok say */ } }, 60);
  }

  startBtn.addEventListener('click', startGame);
  resumeBtn.addEventListener('click', resume);
  restartBtn.addEventListener('click', startGame);
  menuBtn.addEventListener('click', toMenu);
  pauseBtn.addEventListener('click', () => { if (mode === 'playing') pause(); else if (mode === 'paused') resume(); });
  fsBtn.addEventListener('click', toggleFs);

  function toggleFs() {
    try {
      if (isFs()) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document)?.catch?.(() => {});
      } else {
        const req = stage.requestFullscreen || stage.webkitRequestFullscreen;
        const r = req && req.call(stage);
        if (r && r.catch) r.catch(() => fx.toast?.('Tam ekran bu önizlemede izinli değil.', 'ember'));
      }
    } catch {
      fx.toast?.('Tam ekran bu önizlemede izinli değil.', 'ember');
    }
  }
  function onFsChange() {
    stage.classList.toggle('is-fs', isFs());
    if (!isFs() && mode === 'playing') pause();
    measure();
  }
  on(document, 'fullscreenchange', onFsChange);
  on(document, 'webkitfullscreenchange', onFsChange);

  // ------------------------------------------------------------------ girdi
  const keys = new Set();
  const mouse = { x: 0, y: 0, has: false };
  const joy = { id: null, bx: 0, by: 0, x: 0, y: 0 };
  const qTouch = { id: null, sx: 0, sy: 0, dx: 0, dy: 0, drag: false };
  const tAim = { id: null, x: 0, y: 0 };
  let stageW = 16;
  let stageH = 9;
  let stageRect = { left: 0, top: 0 };

  const codeIn = (code, list) => list.includes(code);
  const allCodes = () => {
    const S = SCHEMES[scheme];
    return [...S.up, ...S.down, ...S.left, ...S.right, ...S.q, ...S.w, ...S.e, ...S.r];
  };

  function onKeyDown(e) {
    if (!alive || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTyping(e.target)) return;
    if (document.querySelector('.modal-backdrop')) return;
    const code = e.code;
    if (mode === 'playing') {
      if (code === 'Escape' || code === 'KeyP') {
        e.preventDefault();
        pause();
        return;
      }
      const S = SCHEMES[scheme];
      if (allCodes().includes(code)) e.preventDefault();
      else return;
      if (codeIn(code, S.up) || codeIn(code, S.down) || codeIn(code, S.left) || codeIn(code, S.right)) keys.add(code);
      if (e.repeat) return;
      if (codeIn(code, S.q)) { keys.add(code); game.chargeStart(); }
      else if (codeIn(code, S.w)) game.castW();
      else if (codeIn(code, S.e)) game.castE();
      else if (codeIn(code, S.r)) game.castR();
    } else if (mode === 'paused') {
      if (code === 'Escape' || code === 'KeyP') { e.preventDefault(); resume(); }
    } else if (mode === 'start' || mode === 'over') {
      const t = e.target;
      const onButton = t && (t.tagName === 'BUTTON' || t.tagName === 'A');
      if (code === 'Enter' && !onButton && stageVisible) { e.preventDefault(); startGame(); }
    }
  }
  function onKeyUp(e) {
    const code = e.code;
    const S = SCHEMES[scheme];
    keys.delete(code);
    if (mode === 'playing' && codeIn(code, S.q)) {
      // başka bir Q tuşu hâlâ basılıysa bırakma
      if (!S.q.some((c) => keys.has(c)) && !mouseDown) game.chargeRelease();
    }
  }
  on(window, 'keydown', onKeyDown);
  on(window, 'keyup', onKeyUp);
  on(window, 'blur', () => {
    keys.clear();
    if (mode === 'playing') { game.chargeCancel(); mouseDown = false; }
  });

  // fare ve dokunma (sahne)
  let mouseDown = false;
  const canvasHost = h('div', { class: 'ar-canvas' });
  stage.prepend(canvasHost);
  function localXY(e) {
    return { x: e.clientX - stageRect.left, y: e.clientY - stageRect.top };
  }
  on(canvasHost, 'pointermove', (e) => {
    const p = localXY(e);
    if (e.pointerType === 'mouse') {
      mouse.x = p.x;
      mouse.y = p.y;
      mouse.has = true;
      if (touchMode && (Math.abs(e.movementX) + Math.abs(e.movementY) > 2)) setTouchMode(false);
    } else if (e.pointerId === tAim.id) {
      tAim.x = p.x;
      tAim.y = p.y;
    }
  });
  on(canvasHost, 'pointerdown', (e) => {
    measure();
    const p = localXY(e);
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return;
      mouse.x = p.x;
      mouse.y = p.y;
      mouse.has = true;
      if (mode !== 'playing') return;
      e.preventDefault();
      mouseDown = true;
      focusStage();
      game.chargeStart();
    } else {
      if (!touchMode) setTouchMode(true);
      if (mode !== 'playing') return;
      e.preventDefault();
      tAim.id = e.pointerId;
      tAim.x = p.x;
      tAim.y = p.y;
      game.chargeStart();
    }
    try { canvasHost.setPointerCapture(e.pointerId); } catch { /* yok say */ }
  });
  const endCanvasPointer = (e) => {
    if (e.pointerType === 'mouse') {
      if (!mouseDown) return;
      mouseDown = false;
      const S = SCHEMES[scheme];
      if (mode === 'playing' && !S.q.some((c) => keys.has(c))) game.chargeRelease();
    } else if (e.pointerId === tAim.id) {
      tAim.id = null;
      if (mode === 'playing') {
        if (e.type === 'pointercancel') game.chargeCancel();
        else game.chargeRelease();
      }
    }
  };
  on(canvasHost, 'pointerup', endCanvasPointer);
  on(canvasHost, 'pointercancel', endCanvasPointer);
  on(canvasHost, 'contextmenu', (e) => e.preventDefault());

  // sanal joystick
  const JOY_R = 52;
  on(joyZone, 'pointerdown', (e) => {
    if (mode !== 'playing' || joy.id != null) return;
    e.preventDefault();
    measure();
    const p = localXY(e);
    joy.id = e.pointerId;
    joy.bx = Math.max(JOY_R + 8, Math.min(stageW / 2 - JOY_R, p.x));
    joy.by = Math.max(JOY_R + 70, Math.min(stageH - JOY_R - 8, p.y));
    joy.x = 0;
    joy.y = 0;
    joyBase.style.left = `${joy.bx}px`;
    joyBase.style.top = `${joy.by}px`;
    joyZone.classList.add('active');
    moveJoy(p);
    try { joyZone.setPointerCapture(e.pointerId); } catch { /* yok say */ }
  });
  function moveJoy(p) {
    let dx = p.x - joy.bx;
    let dy = p.y - joy.by;
    const L = Math.hypot(dx, dy);
    if (L > JOY_R) { dx *= JOY_R / L; dy *= JOY_R / L; }
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.hypot(dx, dy) / JOY_R;
    const dead = 0.14;
    const k = m < dead ? 0 : (m - dead) / (1 - dead) / Math.max(0.0001, m);
    joy.x = (dx / JOY_R) * k;
    joy.y = (dy / JOY_R) * k;
  }
  on(joyZone, 'pointermove', (e) => { if (e.pointerId === joy.id) moveJoy(localXY(e)); });
  const endJoy = (e) => {
    if (e.pointerId !== joy.id) return;
    joy.id = null;
    joy.x = 0;
    joy.y = 0;
    joyKnob.style.transform = '';
    joyBase.style.left = '';
    joyBase.style.top = '';
    joyZone.classList.remove('active');
  };
  on(joyZone, 'pointerup', endJoy);
  on(joyZone, 'pointercancel', endJoy);

  function resetTouch() {
    joy.id = null; joy.x = 0; joy.y = 0;
    joyKnob.style.transform = '';
    joyBase.style.left = '';
    joyBase.style.top = '';
    joyZone.classList.remove('active');
    qTouch.id = null; qTouch.drag = false;
    tAim.id = null;
    mouseDown = false;
  }

  // yetenek butonları (masaüstü slotları ve dokunmatik butonlar)
  function bindSlot(s, isTouch) {
    if (s.key === 'q') {
      on(s.btn, 'pointerdown', (e) => {
        if (mode !== 'playing') return;
        e.preventDefault();
        measure();
        if (isTouch || e.pointerType !== 'mouse') {
          if (!touchMode) setTouchMode(true);
          qTouch.id = e.pointerId;
          qTouch.sx = e.clientX;
          qTouch.sy = e.clientY;
          qTouch.dx = 0;
          qTouch.dy = 0;
          qTouch.drag = false;
        }
        game.chargeStart();
        try { s.btn.setPointerCapture(e.pointerId); } catch { /* yok say */ }
      });
      on(s.btn, 'pointermove', (e) => {
        if (e.pointerId !== qTouch.id) return;
        qTouch.dx = e.clientX - qTouch.sx;
        qTouch.dy = e.clientY - qTouch.sy;
        if (Math.hypot(qTouch.dx, qTouch.dy) > 16) qTouch.drag = true;
      });
      const end = (e) => {
        if (mode !== 'playing') return;
        if (e.type === 'pointercancel') game.chargeCancel();
        else game.chargeRelease();
        qTouch.id = null;
        qTouch.drag = false;
      };
      on(s.btn, 'pointerup', end);
      on(s.btn, 'pointercancel', end);
      // klavye ile odaklanıp Enter: hızlı atış
      on(s.btn, 'click', (e) => {
        if (e.detail === 0 && mode === 'playing') { game.chargeStart(); game.chargeRelease(); }
      });
    } else {
      on(s.btn, 'click', (e) => {
        if (mode !== 'playing') return;
        e.preventDefault();
        if (s.key === 'w') game.castW();
        if (s.key === 'e') game.castE();
        if (s.key === 'r') game.castR();
        if (e.detail !== 0) focusStage();
      });
    }
  }
  for (const s of Object.values(slots)) bindSlot(s, false);
  for (const s of Object.values(tslots)) bindSlot(s, true);

  function readInput() {
    const S = SCHEMES[scheme];
    let mx = 0;
    let mz = 0;
    if (S.up.some((c) => keys.has(c))) mz -= 1;
    if (S.down.some((c) => keys.has(c))) mz += 1;
    if (S.left.some((c) => keys.has(c))) mx -= 1;
    if (S.right.some((c) => keys.has(c))) mx += 1;
    const kl = Math.hypot(mx, mz);
    if (kl > 1) { mx /= kl; mz /= kl; }
    if (joy.id != null) { mx += joy.x; mz += joy.y; }
    const out = { mx, mz, aimX: null, aimZ: null, auto: true };
    const p = game.player;
    if (qTouch.id != null && qTouch.drag) {
      const L = Math.hypot(qTouch.dx, qTouch.dy) || 1;
      out.aimX = p.x + (qTouch.dx / L) * 8;
      out.aimZ = p.z + (qTouch.dy / L) * 8;
      out.auto = false;
    } else if (tAim.id != null && view) {
      const gp = view.groundAt(tAim.x, tAim.y);
      if (gp) { out.aimX = gp.x; out.aimZ = gp.z; out.auto = false; }
    } else if (!touchMode && !autoAim && mouse.has && view) {
      const gp = view.groundAt(mouse.x, mouse.y);
      if (gp) { out.aimX = gp.x; out.aimZ = gp.z; out.auto = false; }
    }
    return out;
  }

  // ------------------------------------------------------------------ HUD güncelleme
  const lastTxt = new Map();
  const setText = (node, v) => {
    if (lastTxt.get(node) !== v) { lastTxt.set(node, v); node.textContent = v; }
  };
  const lastStyle = new Map();
  const setVar = (node, name, v) => {
    const k = node;
    const m = lastStyle.get(k) || {};
    if (m[name] !== v) { m[name] = v; lastStyle.set(k, m); node.style.setProperty(name, v); }
  };
  const setCls = (node, cls, v) => {
    if (node.classList.contains(cls) !== !!v) node.classList.toggle(cls, !!v);
  };

  function updateSlot(s, st) {
    setVar(s.btn, '--cd', `${(st.cdFrac * 100).toFixed(1)}%`);
    setText(s.cdText, st.cdLeft > 0 ? (st.cdLeft >= 1 ? String(Math.ceil(st.cdLeft)) : st.cdLeft.toFixed(1)) : '');
    setCls(s.btn, 'cooling', st.cdLeft > 0);
    setCls(s.btn, 'nomana', !!st.noMana);
    setCls(s.btn, 'active', !!st.active);
    setCls(s.btn, 'charging', !!st.charging);
    setCls(s.btn, 'full', !!st.full);
    setText(s.extra, st.extra ?? '');
    setVar(s.btn, '--charge', `${Math.round((st.charge || 0) * 100)}%`);
    if (s.last.ready === false && st.cdLeft <= 0) {
      s.btn.classList.remove('ready-flash');
      void s.btn.offsetWidth;
      s.btn.classList.add('ready-flash');
    }
    s.last.ready = st.cdLeft <= 0;
  }

  function updateHud() {
    const g = game;
    const p = g.player;
    setText(nKills, String(g.kills));
    setText(nWave, String(Math.max(1, g.wave)));
    setText(nDogs, `${g.dogsLeft}/${g.dogsTotal}`);
    setText(nScore, fmtNum(g.score));
    setText(nAcc, g.shots ? `%${Math.round((g.hitShots / g.shots) * 100)}` : '—');
    const hpF = p.hp / p.maxHp;
    setVar(hpBar, '--f', hpF.toFixed(3));
    setText(hpText, `${Math.ceil(p.hp)} / ${p.maxHp}`);
    setVar(mpBar, '--f', (p.mana / p.maxMana).toFixed(3));
    setText(mpText, `${Math.floor(p.mana)} / ${p.maxMana}`);
    hpBar.setAttribute('aria-valuenow', String(Math.ceil(p.hp)));
    hpBar.setAttribute('aria-valuemax', String(p.maxHp));
    mpBar.setAttribute('aria-valuenow', String(Math.floor(p.mana)));
    mpBar.setAttribute('aria-valuemax', String(p.maxMana));
    setCls(vignette, 'low', mode === 'playing' && hpF < 0.28 && !p.dead);
    const cds = g.cds;
    const st = {
      q: { cdFrac: cds.q / ABIL.q.cd, cdLeft: 0, noMana: p.mana < ABIL.q.manaMin, charging: p.charging, charge: p.charge, full: p.charging && p.charge >= 0.97, extra: String(Math.round(ABIL.q.manaMin + (ABIL.q.manaMax - ABIL.q.manaMin) * (p.charging ? p.charge : 0))) },
      w: { cdFrac: cds.w / ABIL.w.cd, cdLeft: cds.w, noMana: p.mana < ABIL.w.mana, active: p.windrun > 0, extra: String(ABIL.w.mana) },
      e: { cdFrac: p.tangoCharges > 0 ? cds.e / ABIL.e.cd : p.tangoRegen / ABIL.e.regen, cdLeft: p.tangoCharges > 0 ? 0 : p.tangoRegen, active: p.tango > 0, extra: String(p.tangoCharges) },
      r: { cdFrac: cds.r / ABIL.r.cd, cdLeft: cds.r, noMana: p.mana < ABIL.r.mana, extra: String(ABIL.r.mana) },
    };
    for (const k of ['q', 'w', 'e', 'r']) {
      if (touchMode) updateSlot(tslots[k], st[k]);
      else updateSlot(slots[k], st[k]);
    }
    // buff'lar
    const buffState = {
      w: p.windrun > 0 ? p.windrun : 0,
      e: p.tango > 0 ? p.tango : 0,
      rapier: p.rapier > 0 ? p.rapier : 0,
      aegis: p.aegis ? -1 : 0,
      slow: p.slow > 0 ? p.slow : 0,
    };
    for (const [k, v] of Object.entries(buffState)) {
      const b = buffEls[k];
      const show = v !== 0;
      if (b.b.hidden === show) b.b.hidden = !show;
      if (show) setText(b.t, v < 0 ? '' : Math.ceil(v).toString());
    }
    // banner zamanı
    if (bannerT && performance.now() > bannerT) {
      bannerT = 0;
      banner.classList.remove('on');
    }
  }

  // ekran dışı DOG okları
  const edgePool = [];
  for (let i = 0; i < 12; i++) {
    const e = h('span', { class: 'ar-edge' });
    edges.appendChild(e);
    edgePool.push(e);
  }
  function updateEdges() {
    let n = 0;
    if (view && (game.state === 'playing' || game.state === 'break')) {
      const list = [];
      for (const d of game.dogs) if (!d.dead && !d.demo && !(d.type === 'ward' && d.vis < 0.5)) list.push([d, archOf(d.type).color]);
      for (const k of game.pickups) if (k.kind === 'aegis') list.push([k, 'var(--aegis)']);
      for (const [d, color] of list) {
        if (n >= edgePool.length) break;
        const pr = view.project(d.x, 0.5, d.z);
        const m = 22;
        const inside = !pr.behind && pr.x > 8 && pr.x < stageW - 8 && pr.y > 8 && pr.y < stageH - 8;
        if (inside) continue;
        const cx = stageW / 2;
        const cy = stageH / 2;
        let dx = pr.x - cx;
        let dy = pr.y - cy;
        if (pr.behind) { dx = -dx; dy = -dy; }
        const s = Math.min((stageW / 2 - m) / Math.abs(dx || 1e-3), (stageH / 2 - m) / Math.abs(dy || 1e-3));
        const x = cx + dx * s;
        const y = cy + dy * s;
        const e = edgePool[n++];
        e.style.transform = `translate(${x}px, ${y}px) rotate(${Math.atan2(dy, dx)}rad)`;
        e.style.setProperty('--tc', color);
        if (e.hidden !== false) e.hidden = false;
      }
    }
    for (let i = n; i < edgePool.length; i++) if (!edgePool[i].hidden) edgePool[i].hidden = true;
  }

  // ------------------------------------------------------------------ boyut ve görünürlük
  function measure() {
    const r = stage.getBoundingClientRect();
    stageRect = { left: r.left, top: r.top };
    const w = Math.round(r.width);
    const hh = Math.round(r.height);
    if (w !== stageW || hh !== stageH) {
      stageW = w;
      stageH = hh;
      if (view) view.resize(w, hh);
      stage.classList.toggle('is-narrow', w < 560);
    }
  }
  const ro = new ResizeObserver(() => measure());
  ro.observe(stage);
  on(window, 'scroll', () => { const r = stage.getBoundingClientRect(); stageRect = { left: r.left, top: r.top }; }, { passive: true });

  let stageVisible = true;
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      stageVisible = en.isIntersecting;
      if (!stageVisible && mode === 'playing') pause();
    }
  }, { threshold: 0.15 });
  io.observe(stage);

  on(document, 'visibilitychange', () => {
    if (document.hidden && mode === 'playing') pause();
  });

  // ------------------------------------------------------------------ döngü
  let acc = 0;
  let chargeSndT = 0;
  let chargeFullSnd = false;
  let lastRender = 0;
  let stopLoop = null;

  function frameTick(dt) {
    if (!alive || !view) return;
    if (!stageVisible || document.hidden) return;
    let simDt = 0;
    if (mode === 'playing' || mode === 'start' || mode === 'over') {
      const input = mode === 'playing' ? readInput() : { mx: 0, mz: 0, aimX: null, aimZ: null, auto: true };
      game.lastAuto = input.auto;
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 5) {
        game.step(STEP, input);
        acc -= STEP;
        n += 1;
        simDt += STEP;
      }
      if (n >= 5) acc = 0;
      // şarj sesi
      const p = game.player;
      if (mode === 'playing' && p.charging) {
        chargeSndT -= dt;
        if (chargeSndT <= 0) {
          chargeSndT = 0.11;
          if (p.charge < 0.97) snd('charge', 0, p.charge);
        }
        if (p.charge >= 0.97 && !chargeFullSnd) {
          chargeFullSnd = true;
          snd('tick', 0);
        }
      } else {
        chargeFullSnd = false;
        chargeSndT = 0;
      }
    } else {
      // duraklatılmış: düşük kare hızında çiz
      const now = performance.now();
      if (now - lastRender < 60) return;
    }
    lastRender = performance.now();
    view.render(game, dt, mode === 'paused' ? 0 : simDt);
    updateHud();
    updateEdges();
  }

  // ------------------------------------------------------------------ görüntü kurulumu
  function setStartReady() {
    mode = 'start';
    startBtn.disabled = false;
    clear(startBtn).append(icon('play', { size: 18 }), h('span', null, 'Başla'));
    showScreen('start');
  }

  (async () => {
    showScreen('start');
    let v = null;
    try {
      const { createView3D } = await import('./view3d.js');
      if (!alive) return;
      v = await createView3D({ mobile: mobileGfx, reduced });
    } catch (err) {
      console.warn('Arena: WebGL kullanılamadı, 2D yedeğe geçiliyor.', err);
      try {
        const { createView2D } = await import('./view2d.js');
        v = createView2D({ reduced });
        stage.classList.add('is-2d');
        say('3D desteklenmiyor; oyun basitleştirilmiş 2D görünümde.', true);
      } catch (e2) {
        console.error(e2);
      }
    }
    if (!alive) { if (v) v.dispose(); return; }
    if (!v) {
      clear(startScreen).appendChild(h('div', { class: 'ar-card' }, h('p', null, 'Bu tarayıcıda arena çizilemedi. Başka bir tarayıcı deneyin.')));
      return;
    }
    view = v;
    const cnv = view.canvas;
    cnv.setAttribute('role', 'img');
    cnv.setAttribute('aria-label', '1vDOQUZ Arena: dairesel taş arenada kapüşonlu okçu ve dalga dalga gelen DOG sürüsü. Oyun durumu sesli olarak duyurulur.');
    canvasHost.appendChild(cnv);
    stageW = 0;
    measure();
    game.attract();
    stopLoop = loop(frameTick);
    setStartReady();
  })();

  // ------------------------------------------------------------------ temizlik
  return () => {
    alive = false;
    if (stopLoop) stopLoop();
    for (const off of offs) off();
    offs.length = 0;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    ro.disconnect();
    io.disconnect();
    unMe();
    if (overLb) overLb();
    if (pageLb) pageLb();
    try { if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {}); } catch { /* yok say */ }
    if (view) { try { view.dispose(); } catch (e) { console.error(e); } view = null; }
    root.remove();
    if (ctx.hotkeys) ctx.hotkeys(true);
  };
}
