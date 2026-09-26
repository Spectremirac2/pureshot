// 1vDOQUZ Arena 2.0 — sitenin imza 3D oyunu: mini Dota savaş alanı.
// Dört kahraman, dokuz DOG, Dire creep'leri, kuleler, Roshan, dükkân, kurye, rünler, yetenek ağacı.
// mountArena(el, ctx) oyunu kurar ve tam temizlik fonksiyonu döndürür.

import './arena.css';
import { h, clear, ls, fmtNum, loop, prefersReducedMotion, pick } from '../../../core/dom.js';
import { icon } from '../../../core/icons.js';
import { store as coreStore } from '../../../core/store.js';
import { sound as coreSound } from '../../../core/sound.js';
import { fx as coreFx } from '../../../core/fx.js';
import { mountLeaderboard } from '../../../components/leaderboard.js';
import { portraitEl } from '../../../components/portrait.js';
import { haptic } from '../juice.js';
import { createGame, STEP } from './game.js';
import { DOG_TYPES, TYPE_IDS, archOf } from './dogs.js';
import { HEROES, HERO_IDS, heroOf, xpFor, MAX_LEVEL } from './heroes.js';
import { ABILITIES } from './abilities.js';
import { ITEMS, SLOTS, RUNES } from './items.js';
import { UNITS } from './units.js';
import { glyph } from './glyphs.js';
import { buildSelect, abilityTip } from './select.js';
import { buildShop, itemImg } from './shop.js';
import { createMinimap } from './minimap.js';

const GAME_ID = 'arena';
/** Kayıt sürümü (localStorage 'csk:arena:v2'). Alanlar: { v, hero, bests: {kahraman: puan}, runs, roshans } */
const SAVE_KEY = 'arena:v2';
const SAVE_V = 2;
const KEYS4 = ['q', 'w', 'e', 'r'];

const SCHEMES = {
  wasd: {
    label: 'WASD + Boşluk',
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    q: ['KeyQ'], w: ['Space', 'ShiftLeft', 'ShiftRight'], e: ['KeyE'], r: ['KeyR'],
    caps: { q: 'Q', w: '␣', e: 'E', r: 'R' },
    move: ['W', 'A', 'S', 'D'],
    wKey: 'Boşluk',
  },
  dota: {
    label: 'Ok tuşları + QWER',
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    q: ['KeyQ'], w: ['KeyW', 'Space'], e: ['KeyE'], r: ['KeyR'],
    caps: { q: 'Q', w: 'W', e: 'E', r: 'R' },
    move: ['↑', '←', '↓', '→'],
    wKey: 'W',
  },
};
const ITEM_CODES = [['Digit1', 'Numpad1'], ['Digit2', 'Numpad2'], ['Digit3', 'Numpad3'], ['Digit4', 'Numpad4'], ['Digit5', 'Numpad5'], ['Digit6', 'Numpad6']];

function webglOk() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function isTyping(t) {
  return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable));
}

function loadSave() {
  const s = ls.get(SAVE_KEY, null);
  if (!s || typeof s !== 'object' || s.v !== SAVE_V) return { v: SAVE_V, hero: 'okcu', bests: {}, runs: 0, roshans: 0 };
  return { v: SAVE_V, hero: HEROES[s.hero] ? s.hero : 'okcu', bests: s.bests && typeof s.bests === 'object' ? s.bests : {}, runs: Number(s.runs) || 0, roshans: Number(s.roshans) || 0 };
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
  let mode = 'loading'; // loading | start | playing | paused | picking | over
  let view = null;
  let game = null;
  const save = loadSave();
  let scheme = SCHEMES[ls.get('arena:keys', 'wasd')] ? ls.get('arena:keys', 'wasd') : 'wasd';
  let autoAim = ls.get('arena:auto', coarse);
  let autoShop = ls.get('arena:autoshop', true);
  let touchMode = coarse;
  const offs = [];
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
  const persist = () => ls.set(SAVE_KEY, save);

  // ------------------------------------------------------------------ DOM
  const bestNow = () => {
    const v = (store.me.get().scores || {})[GAME_ID];
    return typeof v === 'number' ? v : null;
  };
  const bestFor = (id) => (typeof save.bests[id] === 'number' ? save.bests[id] : null);

  const live = h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  const stage = h('div', { class: 'ar-stage', tabindex: '-1', role: 'region', 'aria-label': '1vDOQUZ Arena oyun alanı' });
  const frame = h('div', { class: 'ar-frame frame' }, stage);

  const headBest = h('strong', { class: 'num' }, '—');
  const head = h('div', { class: 'ar-head' },
    h('div', { class: 'ar-head-text' },
      h('span', { class: 'eyebrow' }, 'İmza oyun · 3D · mini Dota · hayran yapımı'),
      h('h1', { class: 'h1 ar-title' }, '1vDO', h('em', null, 'Q'), 'UZ Arena'),
      h('p', { class: 'ar-lead muted' }, 'Dört kahraman, dokuz DOG, Dire kuleleri ve Roshan. Altın topla, eşya al, seviye atla; sürüyü tek başına dizle.'),
    ),
    h('div', { class: 'ar-head-best' }, icon('trophy', { size: 16 }), h('span', { class: 'small muted' }, 'En iyin'), headBest),
  );

  // --- HUD
  const hud = h('div', { class: 'ar-hud' });
  const nKills = h('b', { class: 'num' }, '0');
  const nWave = h('b', { class: 'num' }, '1');
  const nDogs = h('b', { class: 'num' }, '9/9');
  const dogsLbl = h('span', null, 'DOG');
  const top = h('div', { class: 'ar-top', 'aria-hidden': 'true' },
    h('div', { class: 'ar-top-cell ar-top-wave' }, h('span', null, 'Dalga'), nWave),
    h('div', { class: 'ar-top-cell ar-top-dogs' }, dogsLbl, nDogs),
    h('div', { class: 'ar-top-cell' }, h('span', null, 'Öldürme'), nKills),
  );
  const nScore = h('b', { class: 'num' }, '0');
  const nAcc = h('span', { class: 'num' }, '—');
  const accLbl = h('span', null, 'İsabet ');
  const scoreBox = h('div', { class: 'ar-scorebox', 'aria-hidden': 'true' },
    h('span', { class: 'ar-scorebox-l' }, 'Skor'), nScore,
    h('span', { class: 'ar-scorebox-s' }, accLbl, nAcc),
  );
  const pauseBtn = h('button', { class: 'ar-tool', type: 'button', 'aria-label': 'Duraklat (Esc)', title: 'Duraklat (Esc / P)' }, icon('pause', { size: 18 }));
  const fsBtn = h('button', { class: 'ar-tool', type: 'button', 'aria-label': 'Tam ekran', title: 'Tam ekran' }, h('span', { html: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>' }));
  const fsSupported = !!(stage.requestFullscreen || stage.webkitRequestFullscreen);
  if (!fsSupported) fsBtn.hidden = true;
  const tools = h('div', { class: 'ar-tools' }, fsBtn, pauseBtn);
  const banner = h('div', { class: 'ar-banner', 'aria-hidden': 'true' });
  const announce = h('div', { class: 'ar-announce', 'aria-hidden': 'true' });
  const floats = h('div', { class: 'ar-floats', 'aria-hidden': 'true' });
  const edges = h('div', { class: 'ar-edges', 'aria-hidden': 'true' });
  const vignette = h('div', { class: 'ar-vignette', 'aria-hidden': 'true' });
  const stampHost = h('div', { class: 'ar-stamphost', 'aria-hidden': 'true' });
  const feed = h('ol', { class: 'ar-feed', 'aria-hidden': 'true' });
  const mmCanvas = h('canvas', { class: 'ar-mm-canvas', 'aria-hidden': 'true' });
  const minimapEl = h('div', { class: 'ar-minimap', 'aria-hidden': 'true' }, mmCanvas);
  const minimap = createMinimap(mmCanvas);

  // mola şeridi
  const breakTime = h('b', { class: 'num' }, '');
  const breakShop = h('button', { class: 'btn sm ar-break-shop', type: 'button' }, h('span', { class: 'ar-coin', html: glyph('shop') }), 'Dükkân', h('span', { class: 'kbd' }, 'B'));
  const breakReady = h('button', { class: 'btn primary sm ar-break-ready', type: 'button' }, icon('play', { size: 14 }), 'Hazırım', h('span', { class: 'kbd' }, 'Enter'));
  const breakBar = h('div', { class: 'ar-break', hidden: true }, h('span', { class: 'ar-break-t' }, 'Mola · sıradaki dalga ', breakTime, ' sn'), breakShop, breakReady);

  // yetenek slotları
  function makeSlot(key, cls, touch = false) {
    const cd = h('span', { class: 'ar-slot-cd' });
    const cdText = h('span', { class: 'ar-slot-cdt num' });
    const cap = h('span', { class: 'ar-slot-key' }, touch ? key.toUpperCase() : SCHEMES[scheme].caps[key]);
    const extra = h('span', { class: 'ar-slot-extra num' });
    const charge = h('span', { class: 'ar-slot-charge' });
    const ico = h('span', { class: 'ar-slot-icon' });
    const btn = h('button', { class: `ar-slot ${cls} ar-slot-${key}`, type: 'button' }, ico, charge, cd, cdText, cap, extra);
    return { key, btn, cd, cdText, cap, extra, charge, ico, last: {}, touch };
  }
  const slots = { q: makeSlot('q', ''), w: makeSlot('w', ''), e: makeSlot('e', ''), r: makeSlot('r', 'ult') };
  const tslots = { q: makeSlot('q', 'ar-tbtn', true), w: makeSlot('w', 'ar-tbtn', true), e: makeSlot('e', 'ar-tbtn', true), r: makeSlot('r', 'ar-tbtn ult', true) };

  // eşya yuvaları (masaüstü panel + dokunmatik etkin eşyalar)
  function makeItemSlot(i, touch) {
    const img = h('span', { class: 'ar-islot-img' });
    const cd = h('span', { class: 'ar-slot-cd' });
    const cdText = h('span', { class: 'ar-slot-cdt num' });
    const n = h('span', { class: 'ar-islot-n num' });
    const k = h('span', { class: 'ar-islot-k' }, String(i + 1));
    const btn = h('button', { class: `ar-islot${touch ? ' ar-titem' : ''}`, type: 'button', dataset: { i: String(i) }, 'aria-label': `Eşya yuvası ${i + 1}` }, img, cd, cdText, n, k);
    return { i, btn, img, cd, cdText, n, k, id: null, last: {} };
  }
  const islots = Array.from({ length: SLOTS }, (_, i) => makeItemSlot(i, false));
  const titems = Array.from({ length: SLOTS }, (_, i) => makeItemSlot(i, true));

  const hpFill = h('span', { class: 'ar-bar-fill' });
  const hpText = h('span', { class: 'ar-bar-text num' });
  const mpFill = h('span', { class: 'ar-bar-fill' });
  const mpText = h('span', { class: 'ar-bar-text num' });
  const hpBar = h('div', { class: 'ar-bar ar-hp', role: 'meter', 'aria-label': 'Can', 'aria-valuemin': '0' }, hpFill, hpText);
  const mpBar = h('div', { class: 'ar-bar ar-mp', role: 'meter', 'aria-label': 'Mana', 'aria-valuemin': '0' }, mpFill, mpText);
  const buffs = h('div', { class: 'ar-buffs', 'aria-hidden': 'true' });
  const buffEls = {};
  const BUFFS = [
    ['wind', 'w', 'jade', 'Rüzgâr'], ['heal', 'heart', 'jade', 'İyileşme'], ['rapier', 'sword', 'gold', 'Rapier'], ['aegis', 'aegis', 'gold', 'Aegis'],
    ['slow', 'slow', 'blood', 'Yavaş'], ['stun', 'bolt', 'blood', 'Sersem'], ['bkb', 'shield', 'gold', 'Büyü bağışıklığı'], ['haste', 'bolt', 'rune-haste', 'Hız rünü'],
    ['dd', 'sword', 'rune-dd', 'Çift hasar'], ['regen', 'heart', 'rune-regen', 'Yenilenme'], ['invis', 'eye', 'rune-invis', 'Görünmez'],
    ['armor', 'shield', 'jade', 'Savaş Çağrısı zırhı'], ['aura', 'aura', 'arcane', 'Mana akışı'],
  ];
  for (const [k, ic, cls, name] of BUFFS) {
    const t = h('span', { class: 'ar-buff-t num' });
    const b = h('span', { class: `ar-buff ${cls}`, title: name, hidden: true }, h('span', { class: 'ar-buff-i', html: glyph(ic) }), t);
    buffEls[k] = { b, t };
    buffs.appendChild(b);
  }
  // portre + seviye
  const portrait = h('span', { class: 'ar-portrait-i' });
  const lvlNum = h('b', { class: 'num' }, '1');
  const xpRing = h('span', { class: 'ar-portrait-xp' });
  const talentBtn = h('button', { class: 'ar-talent-btn', type: 'button', 'aria-label': 'Yetenek ağacı (T)', title: 'Yetenek ağacı (T)', hidden: true }, h('span', { html: glyph('tree') }));
  const portraitBox = h('div', { class: 'ar-portrait' }, xpRing, portrait, h('span', { class: 'ar-portrait-lvl' }, lvlNum), talentBtn);
  const goldNum = h('b', { class: 'num' }, '0');
  const goldBtn = h('button', { class: 'ar-gold', type: 'button', 'aria-label': 'Dükkân (B)', title: 'Dükkân (B)' }, h('span', { class: 'ar-coin', html: glyph('coin') }), goldNum, h('span', { class: 'ar-gold-shop', html: glyph('shop') }));
  const panel = h('div', { class: 'ar-panel' },
    buffs,
    h('div', { class: 'ar-panel-box' },
      portraitBox,
      h('div', { class: 'ar-panel-mid' },
        h('div', { class: 'ar-slots' }, slots.q.btn, slots.w.btn, slots.e.btn, slots.r.btn),
        h('div', { class: 'ar-bars' }, hpBar, mpBar),
      ),
      h('div', { class: 'ar-panel-items' },
        h('div', { class: 'ar-items' }, islots.map((s) => s.btn)),
        goldBtn,
      ),
    ),
  );
  hud.append(vignette, edges, floats, top, scoreBox, tools, feed, minimapEl, banner, announce, breakBar, stampHost, panel);

  // dokunmatik kontroller
  const joyKnob = h('span', { class: 'ar-joy-knob' });
  const joyBase = h('span', { class: 'ar-joy-base' }, joyKnob);
  const joyZone = h('div', { class: 'ar-joyzone', 'aria-hidden': 'true' }, joyBase);
  const tbtns = h('div', { class: 'ar-tbtns' }, tslots.q.btn, tslots.w.btn, tslots.e.btn, tslots.r.btn);
  const titemsEl = h('div', { class: 'ar-titems' }, titems.map((s) => s.btn));
  const touchLayer = h('div', { class: 'ar-touch' }, joyZone, titemsEl, tbtns);

  // --- dükkân ve yetenek ağacı
  const shop = buildShop({
    get game() { return game; },
    onBuy: (id) => { if (game) game.buy(id); },
    onSell: (i) => { if (game) game.sell(i); },
    onClose: () => closeShop(),
    onReady: () => readyUp(),
    sound,
  });
  const talentHost = h('div', { class: 'ar-screen ar-talent', role: 'dialog', 'aria-label': 'Yetenek ağacı', hidden: true });

  // --- ekranlar
  const screens = h('div', { class: 'ar-screens' });
  const schemeChips = [];
  const autoBoxes = [];
  const shopBoxes = [];
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
    const sbox = h('input', { type: 'checkbox', id: `ar-shop-${idSuffix}`, class: 'ar-check', checked: autoShop });
    sbox.addEventListener('change', () => { autoShop = sbox.checked; ls.set('arena:autoshop', autoShop); for (const b of shopBoxes) b.checked = autoShop; });
    shopBoxes.push(sbox);
    return h('div', { class: 'ar-opts' },
      h('div', { class: 'ar-opt ar-opt-scheme', role: 'group', 'aria-label': 'Tuş düzeni' }, h('span', { class: 'label' }, 'Tuş düzeni'), h('div', { class: 'row ar-chips' }, chips)),
      h('label', { class: 'ar-opt ar-opt-check', for: `ar-auto-${idSuffix}` }, box, h('span', null, 'Otomatik nişan (en yakın düşman)')),
      h('label', { class: 'ar-opt ar-opt-check', for: `ar-shop-${idSuffix}` }, sbox, h('span', null, 'Molada dükkânı aç')),
    );
  }
  const keyTable = h('table', { class: 'ar-keys' });
  function renderKeyTable() {
    const S = SCHEMES[scheme];
    const k = (s) => h('span', { class: 'kbd' }, s);
    clear(keyTable);
    const rows = [
      [[...S.move.map(k), scheme === 'wasd' ? h('span', { class: 'dim xsmall' }, ' / oklar') : null], 'Hareket'],
      [[h('span', { class: 'kbd' }, 'Fare')], 'Nişan / hedef (otomatik nişan kapalıyken)'],
      [[k('Q'), h('span', { class: 'dim xsmall' }, ' veya '), h('span', { class: 'kbd' }, 'Sol tık')], 'Q yeteneği (Okçu: basılı tut, şarj et, bırak)'],
      [[k(S.wKey), k('E'), k('R')], 'W, E ve R yetenekleri'],
      [[k('1'), h('span', { class: 'dim xsmall' }, '–'), k('6')], 'Eşya kullan'],
      [[k('B')], 'Dükkân · ', h('span', { class: 'dim' }, 'molada Enter: dalgayı başlat')],
      [[k('T')], 'Yetenek ağacı (5/10/15. seviye)'],
      [[k('Esc'), k('P')], 'Duraklat'],
    ];
    keyTable.appendChild(h('caption', { class: 'sr-only' }, 'Klavye ve fare kontrolleri'));
    for (const [keys, ...what] of rows) keyTable.appendChild(h('tr', null, h('td', { class: 'ar-keys-k' }, keys), h('td', null, what)));
  }
  renderKeyTable();
  const touchHelp = h('ul', { class: 'ar-touchhelp' },
    h('li', null, h('b', null, 'Sol başparmak:'), ' ekranın soluna dokunup sürükle, yürü. Temel saldırı kendiliğinden.'),
    h('li', null, h('b', null, 'Yetenek düğmeleri:'), ' dokun = en yakın hedefe; basılı tutup sürükle = yön ver, bırak = kullan.'),
    h('li', null, h('b', null, 'Okçu Q:'), ' basılı tut, şarj et; sağ tarafa dokunmak da ok atar.'),
    h('li', null, h('b', null, 'Altın düğmesi:'), ' dükkân. Etkin eşyalar yeteneklerin üstünde.'),
  );
  const select = buildSelect({
    heroId: save.hero,
    bestFor,
    onPick: (id) => pickHero(id),
    onStart: () => startGame(),
    extras: [optionsBlock('s'), h('div', { class: 'ar-ctl-keys' }, keyTable), h('div', { class: 'ar-ctl-touch' }, touchHelp)],
  });
  const startScreen = select.el;
  const resumeBtn = h('button', { class: 'btn primary lg', type: 'button' }, icon('play', { size: 18 }), 'Devam');
  const restartBtn = h('button', { class: 'btn ghost', type: 'button' }, icon('refresh', { size: 16 }), 'Baştan başla');
  const menuBtn = h('button', { class: 'btn ghost', type: 'button' }, icon('arrowLeft', { size: 16 }), 'Kahraman seç');
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
  screens.append(startScreen, pauseScreen, overScreen, talentHost);
  stage.append(hud, touchLayer, shop.el, screens, live);

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
  const dire = [
    ['Dire Piyadesi', 'tower', '#c24a3a', `Sopa ve kalkanlı creep. Radiant kulelerine yürür; yanına gelirsen sana döner. Son vuruş: +altın.`, UNITS.creep_melee],
    ['Dire Büyücüsü', 'rune', '#ff6a3d', 'Kızıl küreli menzilli creep. Arkadan küre atar; önce onu indir.', UNITS.creep_ranged],
    ['Kaya Canavarı (Roshan)', 'skull', '#e9b949', 'Her 5. dalgada çukurundan çıkar. Yere vurur (kırmızı halka), kükrer (sarı halka: sersemletir). Düşerse Aegis ve Peynir bırakır.', UNITS.boss_roshan],
    ['Dire Kulesi', 'tower', '#ff4a5a', 'Menzile girersen ateş eder (kırmızı halka). Yıkarsan +500 puan ve altın.', UNITS.tower_dire],
  ];
  const direGrid = h('div', { class: 'ar-guide-grid' });
  for (const [name, ic, c, hint, U] of dire) {
    direGrid.appendChild(h('article', { class: 'ar-guide-card', style: { '--tc': c } },
      h('span', { class: 'ar-guide-img ar-guide-glyph', html: glyph(ic) }),
      h('div', { class: 'ar-guide-txt' },
        h('h3', { class: 'ar-guide-name' }, name),
        h('p', { class: 'xsmall muted' }, hint),
        h('div', { class: 'ar-guide-stats xsmall' },
          h('span', null, 'Can ', h('b', { class: 'num' }, String(U.hp))),
          U.dmg ? h('span', null, 'Hasar ', h('b', { class: 'num' }, String(U.dmg))) : null,
          h('span', null, 'Zırh ', h('b', { class: 'num' }, `%${Math.round((U.armor || 0) * 100)}`)),
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
      h('div', { class: 'panel-head ar-guide-sub' }, h('div', null, h('span', { class: 'eyebrow' }, 'Dire ordusu'), h('h3', { class: 'h3' }, 'Creep’ler, kuleler ve Roshan'))),
      direGrid,
    ),
    lbHost,
  );

  const root = h('section', { class: 'ar', 'aria-label': '1vDOQUZ Arena' }, head, frame, below);
  el.appendChild(root);
  pageLb = mountLeaderboard(lbHost, { gameId: GAME_ID, title: 'Arena Efsaneleri', format: (n) => `${fmtNum(n)} puan` });

  function refreshBest() {
    const b = bestNow();
    headBest.textContent = b == null ? 'henüz yok' : fmtNum(b);
    select.refreshBest();
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
  game = createGame(onEvent, { heroId: save.hero });
  game.lastAuto = true;
  // Otomatik testler için DOM üzerinden erişim (kullanıcıya görünmez).
  root.__arena = game;
  if (import.meta.env.DEV) {
    // Yalnızca geliştirme: dalga atla, altın ver, Roshan çağır… (üretim derlemesinde yok)
    root.__arenaDebug = {
      game: () => game,
      view: () => view,
      wave: (n) => game.dev.wave(n),
      clear: () => game.dev.clear(),
      gold: (n) => game.dev.gold(n),
      level: (n) => game.dev.level(n),
      roshan: () => game.dev.roshan(),
      rune: (k) => game.dev.rune(k),
      creeps: () => game.dev.creeps(),
      heal: () => game.dev.heal(),
      god: (v) => game.dev.god(v),
      models: () => view && view.modelInfo(),
      lineup: (...a) => view && view.devLineup && view.devLineup(...a),
      mode: () => mode,
      speed: (k = 1) => { devSpeed = Math.max(1, Math.min(40, k)); return devSpeed; },
    };
  }

  function applyHeroUi() {
    const H = game.H;
    stage.style.setProperty('--hc', H.color);
    portrait.innerHTML = glyph(H.id);
    for (const set of [slots, tslots]) {
      for (const k of KEYS4) {
        const A = ABILITIES[H.abilities[k]];
        const s = set[k];
        s.ico.innerHTML = glyph(A.icon);
        s.btn.setAttribute('aria-label', `${A.name}: ${A.desc}`);
        s.btn.title = `${A.name} (${abilityTip(A)}) — ${A.desc}`;
        s.btn.classList.toggle('passive', A.targeting === 'passive');
        s.btn.dataset.targeting = A.targeting;
      }
    }
    accLbl.textContent = H.id === 'okcu' ? 'İsabet ' : 'Verim ';
  }
  applyHeroUi();

  function pickHero(id) {
    if (!HEROES[id]) return;
    save.hero = id;
    persist();
    game.attract(id);
    applyHeroUi();
    if (view && view.preload) view.preload([HEROES[id].model]);
    sound.click();
    say(`${HEROES[id].name} seçildi. ${HEROES[id].role}.`, true);
  }

  // ------------------------------------------------------------------ duyuru ve yüzen yazılar
  let liveLast = 0;
  function say(msg, force = false) {
    const now = performance.now();
    if (!force && now - liveLast < 2500) return;
    liveLast = now;
    live.textContent = msg;
  }

  const floatPool = [];
  for (let i = 0; i < 32; i++) {
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
    s.className = `ar-float ${cls}`;
    s.textContent = text;
    s.style.left = `${p.x}px`;
    s.style.top = `${p.y}px`;
    const dx = (Math.random() - 0.5) * 30;
    if (s._anim) s._anim.cancel();
    if (reduced || !s.animate) {
      s.style.opacity = '1';
      s._t = later(() => { s.style.opacity = '0'; }, 700);
      return;
    }
    s._anim = s.animate([
      { opacity: 0, transform: 'translate(-50%, -30%) scale(0.6)' },
      { opacity: 1, transform: 'translate(-50%, -90%) scale(1.12)', offset: 0.15 },
      { opacity: 0, transform: `translate(calc(-50% + ${dx}px), -280%) scale(1)` },
    ], { duration: 950, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' });
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
  let announceT = 0;
  function announcer(title, sub = '', cls = '', ms = 1600) {
    clear(announce);
    announce.className = `ar-announce ${cls}`;
    announce.append(h('strong', null, title));
    if (sub) announce.append(h('span', null, sub));
    void announce.offsetWidth;
    announce.classList.add('on');
    announceT = performance.now() + ms;
  }

  // Dota tarzı öldürme akışı
  const feedItems = [];
  function feedPush(parts, cls = '') {
    const li = h('li', { class: `ar-feed-i ${cls}` }, parts);
    feed.prepend(li);
    feedItems.unshift({ li, t: performance.now() + 5200 });
    while (feedItems.length > (stageW < 560 ? 3 : 5)) { const x = feedItems.pop(); x.li.remove(); }
  }
  const heroTag = () => h('b', { class: 'ar-feed-hero' }, game.H.name);
  const foeName = (e) => (e.kind === 'dog' ? DOG_TYPES[e.type].short : e.kind === 'boss' ? 'ROSHAN' : e.type === 'ranged' ? 'Büyücü' : 'Piyade');

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
    vignette.classList.remove('hurt', 'ember', 'gold', 'ice');
    void vignette.offsetWidth;
    vignette.classList.add(cls);
  }

  const lastSnd = {};
  function snd(name, gap, ...args) {
    const now = performance.now();
    if (lastSnd[name] && now - lastSnd[name] < gap) return;
    lastSnd[name] = now;
    try { if (sound[name]) sound[name](...args); } catch { /* ses kapalı */ }
  }

  const barkPitch = { feed: 1.25, farm: 1.0, pause: 0.95, afk: 0.8, kurye: 1.45, rapier: 0.75, mid: 0.85, ward: 1.1, smurf: 1.15, chat: 1.35 };

  // ------------------------------------------------------------------ olaylar
  function onEvent(type, d) {
    if (!game) return; // kurulum sırasında (createGame içindeki ilk olaylar)
    if (view) view.event(type, d, game);
    const p = game.player;
    switch (type) {
      case 'waveStart':
        if (d.boss) {
          showBanner(`Dalga ${d.wave}: ROSHAN`, 'Kaya Canavarı uyandı. Yanına beş DOG da geldi.', 'rampage', 2600);
          snd('roar', 0);
          say(`Dalga ${d.wave}. Roshan uyandı!`, true);
        } else {
          showBanner(`Dalga ${d.wave}`, d.wave === 1 ? '9 DOG geliyor. İlk kan senin olsun.' : '9 DOG daha. Dire creep’leri de yolda.', 'wave', 2200);
          snd('bark', 0, 1.0);
          later(() => snd('bark', 0, 1.2), 180);
          say(`Dalga ${d.wave} başladı. 9 DOG geliyor.`, true);
        }
        closeShop(true);
        break;
      case 'towersRebuilt':
        feedPush([h('span', { class: 'ar-feed-ico', html: glyph('tower') }), 'Kuleler yeniden dikildi'], 'gold');
        break;
      case 'spawn':
        if (!d.quiet && d.foe && d.foe.kind === 'dog') snd('bark', 140, barkPitch[d.foe.type] || 1);
        break;
      case 'creepWave':
        feedPush([h('span', { class: 'ar-feed-ico dire', html: glyph('tower') }), 'Dire creep’leri geliyor'], 'dire');
        snd('horn', 400, 0.8);
        break;
      case 'shoot':
        snd('shoot', 40);
        break;
      case 'hit': {
        if (d.src === 'burn' || d.src === 'cleave') break;
        snd('hit', 55);
        const cls = d.crit ? 'crit' : d.big ? 'big' : d.src === 'ult' ? 'ember' : d.src === 'nova' || d.src === 'field' || d.src === 'frost' ? 'ice' : '';
        const e = d.foe;
        floatAt(d.crit ? `${d.dmg}!` : String(d.dmg), e.x, e.kind === 'boss' ? 2.8 : 1.1, e.z, cls);
        break;
      }
      case 'kill': {
        const e = d.foe;
        snd('coin', 70);
        if (d.gold > 0) floatAt(`+${d.gold}`, e.x, e.kind === 'boss' ? 3 : 1.5, e.z, d.lastHit ? 'gold' : 'gold dim');
        if (e.kind === 'dog') say(`${archOf(e.type).name} indi. Kalan DOG: ${game.dogsLeft}. Skor ${fmtNum(game.score)}.`);
        if (e.kind !== 'creep' || d.by === 'hero') {
          const who = d.by === 'hero' ? heroTag() : d.by === 'tower' ? h('b', { class: 'ar-feed-rad' }, 'Radiant Kulesi') : h('b', null, '—');
          feedPush([who, h('span', { class: 'ar-feed-ico', html: glyph(d.by === 'hero' ? game.H.id : 'tower') }), h('span', { class: 'ar-feed-foe' }, foeName(e))], e.kind === 'boss' ? 'gold' : '');
        }
        if (e.kind === 'dog') haptic(10);
        break;
      }
      case 'firstBlood':
        announcer('FIRST BLOOD', 'İlk kan senin', 'blood', 1700);
        snd('horn', 0, 1.1);
        break;
      case 'multikill':
        showBanner(d.label, `+${d.bonus} bonus`, d.n >= 5 ? 'rampage' : 'multi', 1500);
        if (d.n >= 5) { stamp('RAMPAGE!', 'gold'); snd('horn', 0, 0.7); }
        else snd('good', 0);
        say(`${d.label}! ${d.bonus} bonus puan.`, true);
        break;
      case 'streak':
        announcer(d.label, `${d.n} DOG seri`, d.n >= 9 ? 'gold' : 'streak', 1500);
        snd('horn', 0, 0.9 + d.n * 0.02);
        break;
      case 'hurt':
        flashVignette('hurt');
        snd('bad', 380);
        floatAt(`-${d.dmg}`, p.x, 1.8, p.z, 'hurt');
        if (d.dmg >= 60) haptic(18);
        break;
      case 'evade':
        floatAt('MISS', p.x, 1.9, p.z, 'jade');
        snd('whoosh', 250);
        break;
      case 'immune':
        floatAt('BAĞIŞIK', p.x, 2.0, p.z, 'gold');
        break;
      case 'noMana':
        floatAt('Mana yok', p.x, 2.0, p.z, 'mana');
        snd('miss', 250);
        if (d.key) nudge(d.key);
        break;
      case 'notReady':
        snd('miss', 250);
        if (d.key) nudge(d.key);
        break;
      case 'noTarget':
        floatAt('Hedef yok', p.x, 2.0, p.z, 'dim');
        snd('miss', 250);
        if (d.key) nudge(d.key);
        break;
      case 'passive':
        floatAt('Pasif yetenek', p.x, 2.0, p.z, 'dim');
        if (d.key) nudge(d.key);
        break;
      case 'cast':
        if (d.id === 'balta_call') snd('roar', 0, 1.35);
        if (d.id === 'buz_nova' || d.id === 'buz_chain') snd('freeze', 60);
        if (d.id === 'golge_step') snd('blink', 60);
        if (d.id === 'golge_smoke') snd('whoosh', 0);
        if (d.id === 'buz_aura') snd('rune', 0, 0.8);
        if (d.ult && d.id !== 'okcu_dog') { flashVignette(d.id === 'buz_field' ? 'ice' : 'ember'); haptic([15, 30, 15]); }
        break;
      case 'fx':
        if (d.kind === 'spin') snd('spin', 90);
        if (d.kind === 'execute') { announcer('KESİN HÜKÜM', '', 'blood', 1000); snd('chop', 0); haptic([20, 20, 40]); }
        if (d.kind === 'chop') snd('chop', 60, 0.7);
        if (d.kind === 'iceBlast') snd('freeze', 110, 0.6);
        if (d.kind === 'blink') snd('blink', 60);
        if (d.kind === 'crit') snd('slash', 60);
        if (d.kind === 'ambush') floatAt('PUSU!', d.foe.x, 1.8, d.foe.z, 'crit');
        if (d.kind === 'bkb') { snd('good', 0); floatAt('Kara Kral Asası', p.x, 2.2, p.z, 'gold'); }
        if (d.kind === 'refresh') { snd('rune', 0, 1.3); floatAt('TAZELENDİ', p.x, 2.2, p.z, 'ice'); }
        if (d.kind === 'cheese') { snd('win', 0); floatAt('PEYNİR!', p.x, 2.2, p.z, 'gold'); }
        if (d.kind === 'wand') floatAt(`+${16 * d.n}`, p.x, 2.0, p.z, 'jade');
        break;
      case 'channelEnd':
        if (d.interrupted) floatAt('Kanal kesildi', p.x, 2.2, p.z, 'dim');
        break;
      case 'windrun':
        snd('whoosh', 0);
        break;
      case 'tango':
        snd('good', 0);
        floatAt('+Tango', p.x, 1.9, p.z, 'jade');
        break;
      case 'itemHeal':
        snd('good', 0);
        break;
      case 'tangoStolen':
        floatAt('Tango çalındı!', p.x, 2.0, p.z, 'ember');
        snd('bark', 0, 1.5);
        say('Kurye Köpeği bir Tango çaldı!');
        break;
      case 'goldStolen':
        floatAt(`-${d.gold} altın`, p.x, 2.0, p.z, 'ember');
        snd('bark', 0, 1.5);
        say(`Kurye Köpeği ${d.gold} altın çaldı!`);
        break;
      case 'ult':
        stamp('DOG DOG DOG', '');
        try { sound.dogdogdog(); } catch { /* yok say */ }
        flashVignette('ember');
        if (!reduced) fx.shake?.(frame);
        haptic([20, 40, 20]);
        break;
      case 'ultHit':
        if (d.n === 0) floatAt('Boşa DOG DOG DOG', p.x, 2.2, p.z, 'ember');
        else say(`DOG DOG DOG! ${d.n} düşman korkuyla kaçıyor.`, true);
        break;
      case 'drop':
        floatAt(d.rapierItem ? 'İlahi Kılıç yerde!' : 'Rapier düştü!', d.pickup.x, 1.6, d.pickup.z, 'gold');
        snd('coin', 0);
        break;
      case 'pickup': {
        const k = d.pickup;
        if (k.kind === 'rapier') {
          showBanner('RAPIER', '8 sn çift hasar. Düşürme sakın.', 'gold', 1600);
          snd('good', 0);
          later(() => snd('coin', 0), 120);
        } else if (k.kind === 'aegis') {
          announcer('AEGIS ALINDI', k.full ? 'Zaten vardı: tam can ve mana.' : 'Bir kez ölümden döneceksin.', 'gold', 2200);
          snd('win', 0);
          say('Aegis alındı.', true);
          feedPush([heroTag(), h('span', { class: 'ar-feed-ico', html: glyph('aegis') }), 'Aegis’i aldı'], 'gold');
        } else if (k.kind === 'cheese') {
          floatAt(k.eaten ? 'Peynir yendi: tam can!' : 'Peynir çantada', p.x, 2.2, p.z, 'gold');
          snd('coin', 0);
        } else if (k.kind === 'rapierItem') {
          announcer('İLAHİ KILIÇ GERİ ALINDI', '', 'gold', 1600);
          snd('win', 0);
        }
        break;
      }
      case 'aegisUsed':
        showBanner('AEGIS kırıldı', 'Yeniden doğuyorsun…', 'gold', 1300);
        break;
      case 'revive':
        stamp('AEGIS!', 'gold');
        flashVignette('gold');
        say('Aegis ile geri döndün.', true);
        break;
      case 'rapierStolen':
        announcer('RAPIER ÇALINDI!', 'Kurye Köpeği kaçıyor: 8 sn içinde indir!', 'blood', 2200);
        snd('bark', 0, 1.5);
        break;
      case 'thiefEscaped':
        feedPush([h('b', null, 'Kurye Köpeği'), 'İlahi Kılıç ile kaçtı'], 'dire');
        floatAt('Rapier gitti…', p.x, 2.2, p.z, 'ember');
        break;
      case 'waveClear': {
        stamp(h('span', { class: 'meme' }, '1vDOQUZ!'), 'gold');
        snd('win', 0);
        if (!isFs() && !reduced) {
          const r = stage.getBoundingClientRect();
          fx.confetti?.(r.left + r.width / 2, r.top + r.height * 0.45, 90);
        }
        const effTxt = `%${Math.round(d.eff * 100)}`;
        later(() => showBanner(`Dalga ${d.wave} temiz`, `+${fmtNum(d.bonus)} dalga · +${fmtNum(d.effBonus)} ${game.heroId === 'okcu' ? 'isabet' : 'verim'} (${effTxt}) · +${d.gold} altın`, 'gold', 2600), 900);
        say(`1vDOQUZ! Dalga ${d.wave} temizlendi. Skor ${fmtNum(game.score)}. Mola: dükkân açık, çeşmede can dolar.`, true);
        later(() => {
          if (mode !== 'playing' || game.state !== 'break') return;
          if (game.player.talentPending.length) openTalents();
          else if (autoShop && !shop.open) openShop();
        }, 1500);
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
        floatAt('!', d.foe.x, 1.5, d.foe.z, 'ember big');
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
      case 'levelUp':
        floatAt(`SEVİYE ${d.level}`, p.x, 2.4, p.z, 'gold big');
        snd('levelUp', 0);
        break;
      case 'talentReady':
        announcer(`SEVİYE ${d.level}`, 'Yetenek ağacı açıldı · T', 'gold', 1600);
        talentBtn.hidden = false;
        break;
      case 'talent':
        feedPush([heroTag(), h('span', { class: 'ar-feed-ico', html: glyph('tree') }), d.talent.name], 'gold');
        break;
      case 'buy':
        snd('buy', 0);
        floatAt(d.instant ? `+${d.item.name}` : `${d.item.name}: kurye yolda`, p.x, 2.3, p.z, 'gold');
        break;
      case 'buyFail':
        snd('miss', 150);
        break;
      case 'sell':
        snd('coin', 0);
        break;
      case 'courierDepart':
        snd('courier', 0);
        break;
      case 'courierDeliver':
        if (d.items.length) {
          floatAt('Kurye geldi!', p.x, 2.4, p.z, 'gold');
          snd('courier', 0, 1.3);
          feedPush([h('span', { class: 'ar-feed-ico', html: glyph('courier') }), `Kurye: ${d.items.map((I) => I.name).join(', ')}`], 'gold');
        }
        break;
      case 'itemUse':
        if (d.item.id === 'blink') snd('blink', 0);
        haptic(8);
        break;
      case 'itemNotReady':
      case 'itemPassive':
        snd('miss', 200);
        break;
      case 'blinkBlocked':
        floatAt('Hasar aldın: 2 sn bekle', p.x, 2.2, p.z, 'dim');
        snd('miss', 200);
        break;
      case 'itemEmpty':
        floatAt('Değnek boş', p.x, 2.2, p.z, 'dim');
        break;
      case 'rune':
        feedPush([h('span', { class: 'ar-feed-ico', style: { color: d.R.color }, html: glyph('rune') }), `Nehirde rün: ${d.R.name}`], '');
        snd('rune', 500, 0.7);
        break;
      case 'runeTaken':
        announcer(`Rün: ${d.R.name}`, d.rune.gold ? `+${d.rune.gold} altın` : d.R.desc, 'rune', 1500);
        announce.style.setProperty('--rc', d.R.color);
        snd('rune', 0);
        break;
      case 'invisEnd':
        break;
      case 'roshanSpawn':
        announcer('ROSHAN UYANDI', 'Çukurunun yanında sersemletir, yere vurur', 'blood', 2000);
        break;
      case 'roshanTele':
        if (d.kind === 'roar') floatAt('KÜKREME!', d.foe.x, 3.4, d.foe.z, 'gold big');
        break;
      case 'roshanSlam':
        snd('slam', 0);
        haptic(30);
        break;
      case 'roshanRoar':
        snd('roar', 0);
        break;
      case 'heroStunned':
        floatAt('SERSEMLEDİN', p.x, 2.2, p.z, 'hurt');
        break;
      case 'roshanDown':
        announcer('ROSHAN KATLEDİLDİ', 'Aegis ve Peynir çukurun başında', 'gold', 2600);
        stamp('ROSHAN!', 'gold');
        snd('horn', 0, 0.6);
        break;
      case 'towerShot':
        if (d.tower.side === 'dire' && d.target === p) snd('towerShot', 300);
        break;
      case 'towerDown':
        if (d.tower.side === 'dire') {
          announcer('KULE YIKILDI', d.byHero ? '+500 puan · altın' : 'Dire kulesi düştü', 'gold', 2000);
          feedPush([d.byHero ? heroTag() : h('b', null, '—'), h('span', { class: 'ar-feed-ico', html: glyph('tower') }), h('span', { class: 'ar-feed-foe' }, 'Dire Kulesi')], 'gold');
        } else {
          announcer('KULEN DÜŞTÜ', 'Radiant kulesi yıkıldı', 'blood', 2000);
          feedPush([h('b', { class: 'ar-feed-dire' }, 'Dire creep’leri'), h('span', { class: 'ar-feed-ico', html: glyph('tower') }), 'Radiant Kulesi'], 'dire');
        }
        snd('slam', 0, 0.7);
        break;
      case 'gameOver':
        gameOver(d.report);
        break;
      case 'reset':
        for (const s of floatPool) { if (s._anim) s._anim.cancel(); s.style.opacity = '0'; }
        for (const x of feedItems.splice(0)) x.li.remove();
        talentBtn.hidden = true;
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

  // ------------------------------------------------------------------ dükkân / yetenek ağacı / mola
  function openShop() {
    if (!game || (mode !== 'playing')) return;
    shop.show();
    stage.classList.add('shop-open');
    if (!touchMode) later(() => shop.focus(), 20);
  }
  function closeShop(silent = false) {
    if (!shop.open) return;
    shop.hide();
    stage.classList.remove('shop-open');
    if (!silent && mode === 'playing') focusStage();
  }
  function toggleShop() { if (shop.open) closeShop(); else openShop(); }
  function readyUp() {
    if (game.skipBreak()) { closeShop(true); focusStage(); sound.click(); }
  }

  function openTalents() {
    const p = game.player;
    if (!p.talentPending.length || (mode !== 'playing' && mode !== 'picking')) return;
    const level = p.talentPending[0];
    const opts = game.H.talents[level];
    mode = 'picking';
    keys.clear();
    game.chargeCancel();
    resetTouch();
    closeShop(true);
    clear(talentHost);
    const choose = (i) => {
      if (!game.chooseTalent(level, i)) return;
      sound.good?.();
      talentHost.hidden = true;
      stage.classList.remove('has-screen');
      mode = 'playing';
      if (!p.talentPending.length) talentBtn.hidden = true;
      if (p.talentPending.length) openTalents();
      else {
        focusStage();
        if (game.state === 'break' && autoShop) later(() => openShop(), 250);
      }
    };
    const btnsT = opts.map((t, i) => {
      const b = h('button', { class: 'ar-tal-opt', type: 'button' },
        h('span', { class: 'ar-tal-k kbd' }, String(i + 1)),
        h('strong', null, t.name),
      );
      b.addEventListener('click', () => choose(i));
      return b;
    });
    const laterBtn = h('button', { class: 'btn ghost sm', type: 'button' }, 'Sonra seç');
    laterBtn.addEventListener('click', () => {
      talentHost.hidden = true;
      stage.classList.remove('has-screen');
      mode = 'playing';
      focusStage();
    });
    talentHost.append(h('div', { class: 'ar-card ar-tal-card' },
      h('span', { class: 'eyebrow' }, `Seviye ${level} · Yetenek ağacı`),
      h('h2', { class: 'h2' }, 'Birini seç'),
      h('div', { class: 'ar-tal-tree', html: glyph('tree') }),
      h('div', { class: 'ar-tal-opts' }, btnsT[0], h('span', { class: 'ar-tal-or' }, 'ya da'), btnsT[1]),
      h('p', { class: 'xsmall muted' }, 'Oyun seçerken durur. 1 / 2 tuşlarıyla da seçebilirsin.'),
      laterBtn,
    ));
    talentHost._choose = choose;
    talentHost.hidden = false;
    stage.classList.add('has-screen');
    later(() => { try { btnsT[0].focus({ preventScroll: true }); } catch { /* yok say */ } }, 30);
    say(`Seviye ${level}. Yetenek ağacı: ${opts[0].name} ya da ${opts[1].name}.`, true);
  }

  // ------------------------------------------------------------------ akış
  function showScreen(which) {
    startScreen.hidden = which !== 'start';
    pauseScreen.hidden = which !== 'pause';
    overScreen.hidden = which !== 'over';
    if (which) talentHost.hidden = true;
    stage.classList.toggle('has-screen', !!which);
    stage.classList.toggle('on-select', which === 'start');
    if (view && view.setFrame) view.setFrame({ mode: which === 'start' ? 'select' : 'play', side: stageW < 760 || stageW / Math.max(1, stageH) < 1.05 ? 'top' : 'right' });
  }

  function focusStage() {
    try { stage.focus({ preventScroll: true }); } catch { /* yok say */ }
  }

  function scrollStageIntoView() {
    if (isFs()) return;
    measureAvail();
    const r = stage.getBoundingClientRect();
    const e = chromeEdges();
    const visTop = e.top + 6;
    const visBottom = e.bottom - 6;
    if (r.top < visTop || r.bottom > visBottom) {
      const target = window.scrollY + r.top - visTop - Math.max(0, (visBottom - visTop - r.height) / 2);
      window.scrollTo({ top: Math.max(0, target), behavior: reduced ? 'auto' : 'smooth' });
    }
  }

  function startGame() {
    if (!view) return;
    if (overLb) { overLb(); overLb = null; }
    keys.clear();
    game.start({ heroId: save.hero });
    applyHeroUi();
    mode = 'playing';
    stage.classList.add('is-playing');
    closeShop(true);
    showScreen(null);
    focusStage();
    scrollStageIntoView();
    acc = 0;
    sound.click();
  }

  function pause({ focus = true } = {}) {
    if (mode !== 'playing') return;
    mode = 'paused';
    keys.clear();
    game.chargeCancel();
    resetTouch();
    showScreen('pause');
    stage.classList.remove('is-playing');
    say('Oyun duraklatıldı.', true);
    if (focus) later(() => { try { resumeBtn.focus({ preventScroll: true }); } catch { /* yok say */ } }, 30);
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
    closeShop(true);
    game.attract(save.hero);
    applyHeroUi();
    select.setHero(save.hero);
    showScreen('start');
    refreshBest();
    later(() => select.focusCurrent(), 30);
  }

  function quipFor(r) {
    const pct = Math.round(r.acc * 100);
    const lines = [];
    const H = heroOf(r.heroId);
    if (r.kills === 0) lines.push('0 öldürme. AFK Köpeği seni kendi sürüsüne davet etti; teklif hâlâ geçerli.');
    if (r.heroId === 'okcu' && r.shots >= 6 && r.acc < 0.35) lines.push(`İsabet %${pct}. Okların yarısı Roshan çukurunda ward arıyor.`);
    if (r.heroId === 'okcu' && r.shots >= 10 && r.acc >= 0.8) lines.push(`İsabet %${pct}. Oklar GPS’li; DOG’lar replay istiyor.`);
    if (r.wave >= 5) lines.push(`Dalga ${r.wave}! Takım chat’e “gg carry” yazdı, sen “DOG DOG DOG” dedin.`);
    if (r.roshans >= 1) lines.push(`${r.roshans} kez Roshan’ı kestin. Kaya Canavarı artık seni rüyasında görüyor.`);
    if (r.towers >= 2) lines.push('İki Dire kulesini yıktın. Backdoor koruması seni tanımıyor.');
    if (r.bestChain >= 5) lines.push('RAMPAGE yaptın. Chat Köpeği hâlâ REPORT yazıyor.');
    if (r.lastHits >= 40) lines.push(`${r.lastHits} son vuruş. Last Hit Ustası’nda da bir bakalım mı?`);
    if (r.tangosStolen >= 2) lines.push(`Kurye Köpeği ${r.tangosStolen} Tango’nu çaldı. Eşyalarını yürüyerek al.`);
    if (r.ultKills >= 4) lines.push(`DOG DOG DOG ile ${r.ultKills} düşman indirdin. Meme yerini buldu.`);
    if (r.items.includes('rapier')) lines.push('İlahi Kılıç’la oyun bitti. Kılıç yerde, DOG’lar sırada.');
    if (r.heroId === 'balta') lines.push('Balta dönmeyi bırakınca sürü rahat bir nefes aldı.');
    if (r.heroId === 'buz') lines.push('Buz Cadısı gitti, arena hâlâ buz tutuyor.');
    if (r.heroId === 'golge' && r.kills >= 30) lines.push('Gölge görünmeden geldi, görünmeden gitti. Skor tablosu gördü ama.');
    if (r.topType === 'feed') lines.push('En çok Feed Köpeği indirdin. Onlar zaten gönüllüydü.');
    if (r.topType === 'farm') lines.push('Farm Köpeklerini kovaladın. Net worth grafikleri sana küs.');
    if (r.wave <= 1 && r.kills > 0) lines.push(`Dalga 1’de düştün. ${H.name} ile buyback yok ama “Tekrar oyna” var.`);
    if (!lines.length) lines.push('1v9 kolay değil: dokuz DOG, bir kahraman, sıfır ward.');
    return pick(lines);
  }

  function gameOver(r) {
    mode = 'over';
    stage.classList.remove('is-playing');
    keys.clear();
    resetTouch();
    closeShop(true);
    const prev = bestNow();
    const prevHero = bestFor(r.heroId);
    let better = false;
    try { better = store.me.submitScore(GAME_ID, r.score); } catch { /* yok say */ }
    // kahraman başına en iyi skor (yerel, sürümlü) + rozetler için profil seçimleri
    if (prevHero == null || r.score > prevHero) save.bests[r.heroId] = r.score;
    save.runs += 1;
    save.roshans += r.roshans || 0;
    persist();
    try {
      store.me.patch((dd) => {
        if (!dd.picks) dd.picks = {};
        const P = dd.picks;
        if (!(Number(P[`arena:h:${r.heroId}`]) >= r.score)) P[`arena:h:${r.heroId}`] = r.score;
        if (r.roshans) P['arena:roshan'] = (Number(P['arena:roshan']) || 0) + r.roshans;
        if (!(Number(P['arena:dalga']) >= r.wave)) P['arena:dalga'] = r.wave;
      });
    } catch { /* yok say */ }
    snd('lose', 0);
    const H = heroOf(r.heroId);
    const pct = Math.round(r.acc * 100);
    const topD = r.topType ? archOf(r.topType) : null;
    const stat = (label, value, cls = '') => h('div', { class: `ar-stat ${cls}` }, h('dt', null, label), h('dd', { class: 'num' }, value));
    clear(overBody);
    const again = h('button', { class: 'btn primary lg', type: 'button' }, icon('refresh', { size: 18 }), 'Tekrar oyna');
    const menu = h('button', { class: 'btn ghost', type: 'button' }, icon('arrowLeft', { size: 16 }), 'Kahraman değiştir');
    again.addEventListener('click', startGame);
    menu.addEventListener('click', toMenu);
    const heroBest = bestFor(r.heroId);
    overBody.append(h('div', { class: 'ar-card ar-report', style: { '--hc': H.color } },
      h('div', { class: 'ar-report-head' },
        h('span', { class: 'eyebrow' }, 'Maç sonu raporu'),
        better ? h('span', { class: 'badge gold' }, icon('crown', { size: 12 }), prev == null ? 'İlk skor' : 'Yeni rekor') : (prevHero == null || r.score > prevHero) ? h('span', { class: 'badge jade' }, icon('star', { size: 12 }), `${H.name} rekoru`) : null,
      ),
      h('div', { class: 'ar-report-hero' },
        h('span', { class: 'ar-report-emb', html: glyph(H.id) }),
        h('div', null,
          h('h2', { class: 'ar-report-title' }, r.victory ? 'Zafer!' : r.wave >= 5 ? `GG, efsane ${H.name}` : 'Sürü seni yakaladı'),
          h('span', { class: 'xsmall muted' }, `${H.name} · Seviye ${r.level} · ${fmtNum(r.gold)} altın kazanıldı`),
        ),
      ),
      h('dl', { class: 'ar-stats' },
        stat('Skor', fmtNum(r.score), 'gold big'),
        stat('Dalga', String(r.wave)),
        stat('Öldürme', String(r.kills)),
        stat('Son vuruş', String(r.lastHits)),
        stat(r.heroId === 'okcu' ? 'İsabet' : 'Roshan', r.heroId === 'okcu' ? (r.shots ? `%${pct}` : '—') : String(r.roshans)),
        stat('En iyi seri', r.bestChain >= 2 ? ['', '', 'Double', 'Triple', 'Ultra', 'Rampage'][Math.min(5, r.bestChain)] : '—'),
        stat('Kule', String(r.towers)),
        stat(`${H.name} rekoru`, fmtNum(heroBest ?? r.score)),
        stat('Genel rekor', fmtNum(bestNow() ?? r.score)),
      ),
      r.items.length ? h('div', { class: 'ar-report-items' }, h('span', { class: 'xsmall dim' }, 'Envanter'), h('div', { class: 'ar-report-inv' }, r.items.map((id) => (ITEMS[id] ? h('span', { class: 'ar-report-item', title: ITEMS[id].name }, itemImg(ITEMS[id])) : null)))) : null,
      topD ? h('div', { class: 'ar-top-kill', style: { '--tc': topD.color } },
        portraitEl(topD, { cls: 'ar-top-kill-img', alt: '' }),
        h('div', null, h('span', { class: 'xsmall dim' }, 'En çok indirilen tür'), h('strong', null, `${topD.name} × ${r.topN}`)),
      ) : null,
      h('p', { class: 'ar-quip' }, '“', quipFor(r), '”'),
      h('div', { class: 'row ar-report-btns' }, again, menu),
    ));
    if (overLb) overLb();
    clear(overLbHost);
    overLb = mountLeaderboard(overLbHost, { gameId: GAME_ID, title: 'Arena Efsaneleri', format: (n) => `${fmtNum(n)} puan` });
    showScreen('over');
    refreshBest();
    say(`Oyun bitti. ${H.name}, dalga ${r.wave}, skor ${fmtNum(r.score)}, ${r.kills} öldürme.`, true);
    later(() => { try { again.focus({ preventScroll: true }); } catch { /* yok say */ } }, 60);
  }

  resumeBtn.addEventListener('click', resume);
  restartBtn.addEventListener('click', startGame);
  menuBtn.addEventListener('click', toMenu);
  pauseBtn.addEventListener('click', () => { if (mode === 'playing') pause(); else if (mode === 'paused') resume(); });
  fsBtn.addEventListener('click', () => {
    toggleFs();
    if (mode === 'playing') focusStage();
  });
  goldBtn.addEventListener('click', () => { toggleShop(); });
  breakShop.addEventListener('click', () => toggleShop());
  breakReady.addEventListener('click', () => readyUp());
  talentBtn.addEventListener('click', () => openTalents());

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
  const aimTouch = { id: null, key: null, sx: 0, sy: 0, dx: 0, dy: 0, drag: false };
  const tAim = { id: null, x: 0, y: 0 };
  let stageW = 16;
  let stageH = 9;
  let stageRect = { left: 0, top: 0 };

  const codeIn = (code, list) => list.includes(code);
  const allCodes = () => {
    const S = SCHEMES[scheme];
    return [...S.up, ...S.down, ...S.left, ...S.right, ...S.q, ...S.w, ...S.e, ...S.r];
  };
  const heroCharges = () => ABILITIES[game.H.abilities.q].targeting === 'charge';

  function onKeyDown(e) {
    if (!alive || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTyping(e.target)) return;
    if (document.querySelector('.modal-backdrop')) return;
    const code = e.code;
    const tgt = e.target;
    if ((code === 'Space' || code === 'Enter') && tgt && tgt.tagName === 'BUTTON') return;
    if (mode === 'picking') {
      if (code === 'Digit1' || code === 'Numpad1' || code === 'ArrowLeft') { e.preventDefault(); talentHost._choose?.(0); }
      else if (code === 'Digit2' || code === 'Numpad2' || code === 'ArrowRight') { e.preventDefault(); talentHost._choose?.(1); }
      else if (code === 'Escape' || code === 'KeyT') {
        e.preventDefault();
        talentHost.hidden = true;
        stage.classList.remove('has-screen');
        mode = 'playing';
        focusStage();
      }
      return;
    }
    if (mode === 'playing') {
      if (code === 'Escape' || code === 'KeyP') {
        e.preventDefault();
        if (code === 'Escape' && shop.open) { closeShop(); return; }
        pause();
        return;
      }
      if (code === 'KeyB' || code === 'F4') { e.preventDefault(); toggleShop(); return; }
      if (code === 'KeyT') { e.preventDefault(); openTalents(); return; }
      if (code === 'Enter' && game.state === 'break') { e.preventDefault(); readyUp(); return; }
      const ii = ITEM_CODES.findIndex((c) => c.includes(code));
      if (ii >= 0) { e.preventDefault(); if (!e.repeat) game.useItem(ii); return; }
      const S = SCHEMES[scheme];
      if (allCodes().includes(code)) e.preventDefault();
      else return;
      if (codeIn(code, S.up) || codeIn(code, S.down) || codeIn(code, S.left) || codeIn(code, S.right)) keys.add(code);
      if (e.repeat) return;
      if (codeIn(code, S.q)) { keys.add(code); if (heroCharges()) game.chargeStart(); else game.cast('q'); }
      else if (codeIn(code, S.w)) game.cast('w');
      else if (codeIn(code, S.e)) game.cast('e');
      else if (codeIn(code, S.r)) game.cast('r');
    } else if (mode === 'paused') {
      if (code === 'Escape' || code === 'KeyP') { e.preventDefault(); resume(); }
    } else if (mode === 'start' || mode === 'over') {
      const t = e.target;
      const onButton = t && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'SUMMARY');
      if (code === 'Enter' && !onButton && stageVisible) { e.preventDefault(); startGame(); }
    }
  }
  function onKeyUp(e) {
    const code = e.code;
    const S = SCHEMES[scheme];
    keys.delete(code);
    if (mode === 'playing' && codeIn(code, S.q)) {
      if (!S.q.some((c) => keys.has(c)) && !mouseDown) game.chargeRelease();
    }
  }
  on(window, 'keydown', onKeyDown);
  on(window, 'keyup', onKeyUp);
  on(window, 'blur', () => {
    keys.clear();
    if (mode === 'playing') { game.chargeCancel(); mouseDown = false; pause({ focus: false }); }
  });
  on(document, 'pointerdown', (e) => {
    if (mode === 'playing' && e.target instanceof Node && !stage.contains(e.target)) pause({ focus: false });
  }, true);

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
      focusStage();
      if (shop.open && !touchMode) closeShop(true);
      if (heroCharges()) { mouseDown = true; game.chargeStart(); }
      else focusTarget(p.x, p.y);
    } else {
      if (!touchMode) setTouchMode(true);
      if (mode !== 'playing') return;
      e.preventDefault();
      tAim.id = e.pointerId;
      tAim.x = p.x;
      tAim.y = p.y;
      aimAtScreen(p.x, p.y);
      if (heroCharges()) game.chargeStart();
      else focusTarget(p.x, p.y);
    }
    try { canvasHost.setPointerCapture(e.pointerId); } catch { /* yok say */ }
  });
  // Saldıran kahramanlarda dokunulan/tıklanan düşman odak hedefi olur (Dota'daki sağ tık saldırısı gibi)
  function focusTarget(x, y) {
    const gp = view && view.groundAt(x, y);
    if (!gp) return;
    const f = game.foeNear(gp.x, gp.z, 1.6);
    if (f) { game.focus = f; game.player.aimX = f.x; game.player.aimZ = f.z; }
  }
  const endCanvasPointer = (e) => {
    if (e.pointerType === 'mouse') {
      if (!mouseDown) return;
      mouseDown = false;
      const S = SCHEMES[scheme];
      if (mode === 'playing' && !S.q.some((c) => keys.has(c))) game.chargeRelease();
    } else if (e.pointerId === tAim.id) {
      tAim.id = null;
      if (mode === 'playing' && heroCharges()) {
        if (e.type === 'pointercancel') game.chargeCancel();
        else {
          const p = localXY(e);
          aimAtScreen(p.x, p.y);
          game.chargeRelease();
        }
      }
    }
  };
  function aimAtScreen(x, y) {
    const gp = view && view.groundAt(x, y);
    if (gp) { game.player.aimX = gp.x; game.player.aimZ = gp.z; }
  }
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
    const zx = joyZone.offsetLeft;
    const zy = joyZone.offsetTop;
    joy.bx = Math.max(zx + JOY_R + 8, Math.min(stageW / 2 - JOY_R, p.x));
    joy.by = Math.max(zy + JOY_R - 12, Math.min(stageH - JOY_R - 8, p.y));
    joy.x = 0;
    joy.y = 0;
    joyBase.style.left = `${joy.bx - zx}px`;
    joyBase.style.top = `${joy.by - zy}px`;
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
    aimTouch.id = null; aimTouch.drag = false; aimTouch.key = null;
    tAim.id = null;
    mouseDown = false;
    for (const s of Object.values(tslots)) s.btn.classList.remove('aiming');
  }

  // yetenek düğmeleri (masaüstü slotları ve dokunmatik düğmeler)
  function bindSlot(s, isTouch) {
    const key = s.key;
    const targeting = () => ABILITIES[game.H.abilities[key]].targeting;
    on(s.btn, 'pointerdown', (e) => {
      if (mode !== 'playing') return;
      const tg = targeting();
      const touchy = isTouch || e.pointerType !== 'mouse';
      if (touchy && !touchMode) setTouchMode(true);
      e.preventDefault();
      measure();
      if (tg === 'charge') {
        if (touchy) Object.assign(aimTouch, { id: e.pointerId, key, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, drag: false });
        game.chargeStart();
        try { s.btn.setPointerCapture(e.pointerId); } catch { /* yok say */ }
        return;
      }
      if (touchy && (tg === 'point' || tg === 'unit')) {
        Object.assign(aimTouch, { id: e.pointerId, key, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, drag: false });
        s.btn.classList.add('aiming');
        try { s.btn.setPointerCapture(e.pointerId); } catch { /* yok say */ }
        return;
      }
      game.cast(key);
      if (!touchy) focusStage();
    });
    on(s.btn, 'pointermove', (e) => {
      if (e.pointerId !== aimTouch.id || aimTouch.key !== key) return;
      aimTouch.dx = e.clientX - aimTouch.sx;
      aimTouch.dy = e.clientY - aimTouch.sy;
      if (Math.hypot(aimTouch.dx, aimTouch.dy) > 16) aimTouch.drag = true;
    });
    const end = (e) => {
      if (e.pointerId !== aimTouch.id || aimTouch.key !== key) {
        if (targeting() === 'charge' && e.pointerType === 'mouse' && mode === 'playing') { game.chargeRelease(); focusStage(); }
        return;
      }
      const tg = targeting();
      s.btn.classList.remove('aiming');
      if (mode === 'playing') {
        if (tg === 'charge') {
          if (e.type === 'pointercancel') game.chargeCancel();
          else game.chargeRelease();
        } else if (e.type !== 'pointercancel') {
          if (aimTouch.drag) {
            const p = game.player;
            const L = Math.hypot(aimTouch.dx, aimTouch.dy) || 1;
            const range = Math.min(7, 1.5 + L / 16);
            game.player.aimX = p.x + (aimTouch.dx / L) * range;
            game.player.aimZ = p.z + (aimTouch.dy / L) * range;
            game.lastAuto = false;
            game.target = game.foeNear(game.player.aimX, game.player.aimZ, 2.2);
          }
          game.cast(key);
        }
      }
      aimTouch.id = null;
      aimTouch.drag = false;
      aimTouch.key = null;
    };
    on(s.btn, 'pointerup', end);
    on(s.btn, 'pointercancel', end);
    on(s.btn, 'click', (e) => {
      if (e.detail === 0 && mode === 'playing') {
        if (targeting() === 'charge') { game.chargeStart(); game.chargeRelease(); } else game.cast(key);
      }
    });
  }
  for (const s of Object.values(slots)) bindSlot(s, false);
  for (const s of Object.values(tslots)) bindSlot(s, true);
  function bindItem(s) {
    on(s.btn, 'pointerdown', (e) => {
      if (mode !== 'playing') return;
      e.preventDefault();
      if (e.pointerType !== 'mouse' && !touchMode) setTouchMode(true);
      game.useItem(s.i);
      if (e.pointerType === 'mouse') focusStage();
    });
    on(s.btn, 'click', (e) => { if (e.detail === 0 && mode === 'playing') game.useItem(s.i); });
  }
  for (const s of islots) bindItem(s);
  for (const s of titems) bindItem(s);

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
    if (aimTouch.id != null && aimTouch.drag) {
      const L = Math.hypot(aimTouch.dx, aimTouch.dy) || 1;
      const range = aimTouch.key === 'q' && heroCharges() ? 8 : Math.min(7, 1.5 + L / 16);
      out.aimX = p.x + (aimTouch.dx / L) * range;
      out.aimZ = p.z + (aimTouch.dy / L) * range;
      out.auto = false;
    } else if (tAim.id != null && view && heroCharges()) {
      const gp = view.groundAt(tAim.x, tAim.y);
      if (gp) { out.aimX = gp.x; out.aimZ = gp.z; out.auto = false; }
    } else if (!touchMode && !autoAim && mouse.has && view) {
      const gp = view.groundAt(mouse.x, mouse.y);
      if (gp) { out.aimX = gp.x; out.aimZ = gp.z; out.auto = false; }
    } else if (game.focus && !game.focus.dead) {
      out.aimX = game.focus.x;
      out.aimZ = game.focus.z;
      out.auto = false;
    }
    if (game.focus && (game.focus.dead || Math.hypot(game.focus.x - p.x, game.focus.z - p.z) > 9)) game.focus = null;
    return out;
  }

  // ------------------------------------------------------------------ HUD güncelleme
  const lastTxt = new Map();
  const setText = (node, v) => {
    if (lastTxt.get(node) !== v) { lastTxt.set(node, v); node.textContent = v; }
  };
  const lastStyle = new Map();
  const setVar = (node, name, v) => {
    const m = lastStyle.get(node) || {};
    if (m[name] !== v) { m[name] = v; lastStyle.set(node, m); node.style.setProperty(name, v); }
  };
  const setAttr = (node, name, v) => {
    if (node.getAttribute(name) !== v) node.setAttribute(name, v);
  };
  const setCls = (node, cls, v) => {
    if (node.classList.contains(cls) !== !!v) node.classList.toggle(cls, !!v);
  };
  const setHidden = (node, v) => { if (node.hidden !== !!v) node.hidden = !!v; };

  function updateSlot(s, st) {
    setVar(s.btn, '--arcd', `${(Math.max(0, Math.min(1, st.cdFrac || 0)) * 100).toFixed(1)}%`);
    const left = st.cdLeft || 0;
    setText(s.cdText, left > 0 ? (left >= 1 ? String(Math.ceil(left)) : left.toFixed(1)) : '');
    setCls(s.btn, 'cooling', left > 0);
    setCls(s.btn, 'nomana', !!st.noMana);
    setCls(s.btn, 'active', !!st.active);
    setCls(s.btn, 'charging', !!st.charging);
    setCls(s.btn, 'full', !!st.full);
    setText(s.extra, st.passive ? 'P' : st.extra ?? '');
    setVar(s.btn, '--charge', `${Math.round((st.charge || 0) * 100)}%`);
    if (s.last.ready === false && left <= 0) {
      s.btn.classList.remove('ready-flash');
      void s.btn.offsetWidth;
      s.btn.classList.add('ready-flash');
    }
    s.last.ready = left <= 0;
  }

  function updateItemSlot(s, it) {
    const id = it ? it.id : null;
    if (s.id !== id) {
      s.id = id;
      clear(s.img);
      if (id) {
        const I = ITEMS[id];
        s.img.appendChild(itemImg(I, 'ar-islot-pic'));
        s.btn.setAttribute('aria-label', `${I.name}${I.active ? ' (kullan)' : ' (pasif)'}: ${I.desc}`);
        s.btn.title = `${I.name}${I.active ? '' : ' · pasif'} — ${I.desc}`;
      } else {
        s.btn.setAttribute('aria-label', `Boş eşya yuvası ${s.i + 1}`);
        s.btn.title = 'Boş yuva';
      }
      setCls(s.btn, 'empty', !id);
      setCls(s.btn, 'passive', !!id && !ITEMS[id].active);
    }
    if (!it) { setText(s.cdText, ''); setVar(s.btn, '--arcd', '0%'); setText(s.n, ''); return; }
    const I = ITEMS[it.id];
    const cd = it.cd || 0;
    setVar(s.btn, '--arcd', `${cd > 0 ? ((cd / (it.cdMax || I.active?.cd || 1)) * 100).toFixed(1) : 0}%`);
    setText(s.cdText, cd > 0 ? (cd >= 1 ? String(Math.ceil(cd)) : cd.toFixed(1)) : '');
    setCls(s.btn, 'cooling', cd > 0);
    setText(s.n, it.charges != null && (I.charges > 1 || I.maxCharges || it.charges > 1) ? String(it.charges) : '');
  }

  function updateHud(dt) {
    const g = game;
    const p = g.player;
    setText(nKills, String(g.kills));
    setText(nWave, String(Math.max(1, g.wave)));
    setText(nDogs, `${g.dogsLeft}/${g.dogsTotal}`);
    setText(dogsLbl, g.bossWave ? 'ROSHAN+' : 'DOG');
    setText(nScore, fmtNum(g.score));
    if (g.heroId === 'okcu') setText(nAcc, g.shots ? `%${Math.round((g.hitShots / g.shots) * 100)}` : '—');
    else setText(nAcc, `%${Math.round(Math.max(0, 1 - g.waveDamage / Math.max(1, p.maxHp * 1.5)) * 100)}`);
    const hpF = p.hp / p.maxHp;
    setVar(hpBar, '--f', hpF.toFixed(3));
    setText(hpText, `${Math.ceil(p.hp)} / ${p.maxHp}`);
    setVar(mpBar, '--f', (p.mana / p.maxMana).toFixed(3));
    setText(mpText, `${Math.floor(p.mana)} / ${p.maxMana}`);
    setAttr(hpBar, 'aria-valuenow', String(Math.ceil(p.hp)));
    setAttr(hpBar, 'aria-valuemax', String(p.maxHp));
    setAttr(mpBar, 'aria-valuenow', String(Math.floor(p.mana)));
    setAttr(mpBar, 'aria-valuemax', String(p.maxMana));
    setCls(vignette, 'low', mode === 'playing' && hpF < 0.28 && !p.dead);
    setText(lvlNum, String(p.level));
    setVar(xpRing, '--xp', `${p.level >= MAX_LEVEL ? 100 : Math.round((p.xp / xpFor(p.level)) * 100)}%`);
    setText(goldNum, fmtNum(p.gold));
    setHidden(talentBtn, !p.talentPending.length);
    for (const k of KEYS4) {
      const st = g.slotState(k);
      if (touchMode) updateSlot(tslots[k], st);
      else updateSlot(slots[k], st);
    }
    for (let i = 0; i < SLOTS; i++) {
      const it = p.items[i];
      if (touchMode) {
        const act = it && ITEMS[it.id].active ? it : null;
        updateItemSlot(titems[i], act);
        setHidden(titems[i].btn, !act);
      } else updateItemSlot(islots[i], it);
    }
    // buff'lar
    const bs = {
      wind: p.windrun, heal: p.heals.length ? Math.max(...p.heals.map((x) => x.t)) : 0, rapier: p.rapier, aegis: p.aegis ? -1 : 0,
      slow: p.st.slow, stun: p.st.stun, bkb: p.bkb, haste: p.haste, dd: p.dd, regen: p.regenRune, invis: p.invis, armor: p.callArmor, aura: p.auraT,
    };
    for (const [k, v] of Object.entries(bs)) {
      const b = buffEls[k];
      const show = v !== 0 && v != null && (v < 0 || v > 0.02);
      if (b.b.hidden === show) b.b.hidden = !show;
      if (show) setText(b.t, v < 0 ? '' : Math.ceil(v).toString());
    }
    // mola şeridi
    const brk = mode === 'playing' && g.state === 'break';
    setHidden(breakBar, !brk || shop.open);
    if (brk) setText(breakTime, String(Math.max(0, Math.ceil(g.breakT))));
    stage.classList.toggle('in-break', brk);
    // duyuru zamanları
    const now = performance.now();
    if (bannerT && now > bannerT) { bannerT = 0; banner.classList.remove('on'); }
    if (announceT && now > announceT) { announceT = 0; announce.classList.remove('on'); }
    for (let i = feedItems.length - 1; i >= 0; i--) {
      if (now > feedItems[i].t) { feedItems[i].li.remove(); feedItems.splice(i, 1); }
    }
    if (shop.open) shop.update();
    if (mode === 'playing' || mode === 'paused' || mode === 'picking') minimap.draw(g, dt);
  }

  // ekran dışı düşman okları
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
      for (const d of game.foes) {
        if (d.dead || d.demo || (d.type === 'ward' && d.vis < 0.5)) continue;
        if (d.kind === 'creep') continue;
        list.push([d, d.kind === 'boss' ? 'var(--aegis)' : d.thief ? 'var(--aegis-2)' : archOf(d.type).color]);
      }
      for (const k of game.pickups) if (k.kind === 'aegis' || k.kind === 'cheese' || k.kind === 'rapierItem') list.push([k, 'var(--aegis)']);
      for (const r of game.runes) list.push([r, RUNES[r.kind].color]);
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
      stage.classList.toggle('is-mid', w >= 560 && w < 980);
      stage.classList.toggle('is-short', hh < 440 && w >= 560);
      if (view && view.setFrame) view.setFrame({ side: w < 760 || w / Math.max(1, hh) < 1.05 ? 'top' : 'right' });
    }
  }
  const ro = new ResizeObserver(() => measure());
  ro.observe(stage);

  function chromeEdges() {
    const cs = getComputedStyle(document.documentElement);
    const hudH = parseFloat(cs.getPropertyValue('--hud-h')) || 56;
    const barH = parseFloat(cs.getPropertyValue('--bar-h')) || 84;
    const hudEl = document.querySelector('.hud-top');
    const barEl = document.querySelector('.ability-slots');
    const topE = hudEl ? hudEl.getBoundingClientRect().bottom : hudH;
    const bottom = barEl && barEl.offsetParent !== null ? barEl.getBoundingClientRect().top : window.innerHeight - barH;
    return { top: topE, bottom };
  }
  function measureAvail() {
    const { top: t, bottom } = chromeEdges();
    const avail = Math.max(200, Math.round(bottom - t - 12));
    root.style.setProperty('--ar-avail', `${avail}px`);
  }
  measureAvail();
  on(window, 'resize', measureAvail);
  on(window, 'orientationchange', measureAvail);
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

  let devSpeed = 1; // yalnızca geliştirme hook'u değiştirir (yazılımsal WebGL testlerinde simülasyonu hızlandırır)
  let perfAcc = 0;
  let perfN = 0;
  function watchPerf(dt) {
    if (!view.lowerQuality || mode !== 'playing') return;
    perfAcc += dt;
    perfN += 1;
    if (perfN >= 120) {
      const fps = perfN / perfAcc;
      perfAcc = 0;
      perfN = 0;
      if (fps < 42) view.lowerQuality();
    }
  }

  function frameTick(dt) {
    if (!alive || !view) return;
    if (!stageVisible || document.hidden) return;
    watchPerf(dt);
    let simDt = 0;
    if (mode === 'playing' || mode === 'start' || mode === 'over') {
      const input = mode === 'playing' ? readInput() : { mx: 0, mz: 0, aimX: null, aimZ: null, auto: true };
      acc += dt * devSpeed;
      let n = 0;
      const maxN = 5 * devSpeed;
      while (acc >= STEP && n < maxN) {
        game.step(STEP, input);
        acc -= STEP;
        n += 1;
        simDt += STEP;
      }
      if (n >= maxN) acc = 0;
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
      const now = performance.now();
      if (now - lastRender < 60) return;
    }
    lastRender = performance.now();
    view.render(game, dt, mode === 'paused' || mode === 'picking' ? 0 : simDt);
    updateHud(dt);
    updateEdges();
  }

  // ------------------------------------------------------------------ görüntü kurulumu
  function setStartReady() {
    mode = 'start';
    select.ready();
    showScreen('start');
  }

  (async () => {
    showScreen('start');
    let v = null;
    try {
      if (!webglOk()) throw new Error('WebGL desteklenmiyor');
      const { createView3D } = await import('./view3d.js');
      if (!alive) return;
      v = await createView3D({ mobile: mobileGfx, reduced, heroId: save.hero });
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
    cnv.setAttribute('aria-label', '1vDOQUZ Arena: nehrin ikiye böldüğü mini Dota savaş alanı; Radiant ve Dire kuleleri, Roshan çukuru, kahramanın ve DOG sürüsü. Oyun durumu sesli olarak duyurulur.');
    canvasHost.appendChild(cnv);
    stageW = 0;
    measure();
    game.attract(save.hero);
    stopLoop = loop(frameTick);
    setStartReady();
    // diğer kahramanların modellerini boşta önceden yükle (seçim ekranında gezinirken bekleme olmasın)
    later(() => view && view.preload && view.preload(HERO_IDS.map((id) => HEROES[id].model)), 2500);
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

