// 1vDOQUZ Arena 3.0 — sitenin imza 3D oyunu: mini Dota savaş alanı.
// Altı kahraman, dokuz DOG, Dire creep'leri, kuleler, Roshan, dükkân, kurye, rünler, yetenek ağacı.
// Modlar (başlangıç merkezi): Hikâye (story.js + tembel storyui.js), Sonsuz (salon skoru), Günlük (daily.js),
// Kütüphane / Kodeks / ustalık (progression.js'in tembel ekranları).
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
import { createGame, STEP, BUYBACK_CD, CURSE_TEXT } from './game.js';
import { DOG_TYPES, TYPE_IDS, archOf } from './dogs.js';
import { HEROES, HERO_IDS, heroOf, xpFor, MAX_LEVEL, TALENT_LEVELS, ATTR_NAMES, ATTR_SHORT, isHeroUnlocked, devUnlock, registerUnlockCheck, abilityCap } from './heroes.js';
import { ABILITIES, abilityInfo, abilityDisplay, targetingOf, STATS_BONUS } from './abilities.js';
import { ITEMS, SLOTS, RUNES, NEUTRALS } from './items.js';
import { UNITS, BOSS_IDS, unitId } from './units.js';
import { armorReduction, STATUS_NAMES } from './combat.js';
import { glyph } from './glyphs.js';
import { buildSelect, abilityTip, abilityRows } from './select.js';
import { buildShop, itemImg } from './shop.js';
import { createMinimap } from './minimap.js';
import { artUrl } from '../../../core/assets.js';
import { dailyChallenge, dailyRunConfig, dailyBest, recordDaily, msToReset, fmtCountdown } from './daily.js';

// Kalıcı ilerleme (progression.js, İlerleme ajanı) varsa sözleşmeye göre bağlanır: applyMeta / grantRunRewards /
// kahraman kilitleri. Dosya yoksa glob boş döner ve arena olduğu gibi çalışır.
const PROG_MOD = import.meta.glob('./progression.js');
const HERO_ALIASES = { simsek: ['simsek', 'storm', 'simsek_ruhu', 'hero-storm'], agac: ['agac', 'treant', 'agac_bekcisi', 'hero-treant'] };

const GAME_ID = 'arena';
/** Oturumda son açılan menü (yenileyince aynı ekrana dönülür): sessionStorage 'csk:arena:ui' → { menu, missionId } */
const UI_KEY = 'csk:arena:ui';
const readUi = () => { try { const v = JSON.parse(sessionStorage.getItem(UI_KEY) || 'null'); return v && typeof v === 'object' ? v : null; } catch { return null; } };
const writeUi = (v) => { try { sessionStorage.setItem(UI_KEY, JSON.stringify(v)); } catch { /* depolama kapalı */ } };
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
const KEY_NAMES = { q: 'Q', w: 'W', e: 'E', r: 'R' };
const fmtT = (t) => { const s = Math.max(0, Math.ceil(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const f1 = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');

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
  let mode = 'loading'; // loading | start | playing | paused | picking | talk | over
  let menu = 'hub'; // mode === 'start' iken görünen menü: hub | select | campaign | daily
  /** Sıradaki/şimdiki koşunun türü: { kind: 'endless'|'story'|'daily', missionId?, daily? } */
  let run = { kind: 'endless' };
  let view = null;
  let game = null;
  const save = loadSave();
  let scheme = SCHEMES[ls.get('arena:keys', 'wasd')] ? ls.get('arena:keys', 'wasd') : 'wasd';
  let autoAim = ls.get('arena:auto', coarse);
  let autoShop = ls.get('arena:autoshop', true);
  let autoLearn = ls.get('arena:autolearn', false);
  let learnMode = false;
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
      h('p', { class: 'ar-lead muted' }, 'Altı kahraman, dokuz DOG, Dire kuleleri ve Roshan. Hikâyede Dokuzun Laneti’ni kır, Sonsuz’da salon tablosuna yazıl, Günlük’te herkesle aynı koşulda yarış.'),
    ),
    h('div', { class: 'ar-head-best' }, icon('trophy', { size: 16 }), h('span', { class: 'small muted' }, 'En iyin'), headBest),
  );

  // --- HUD
  const hud = h('div', { class: 'ar-hud' });
  const nKills = h('b', { class: 'num' }, '0');
  const nWave = h('b', { class: 'num' }, '1');
  const nDogs = h('b', { class: 'num' }, '9/9');
  const dogsLbl = h('span', null, 'DOG');
  const dayIco = h('span', { class: 'ar-day-i', html: glyph('sun') });
  const dayTime = h('b', { class: 'num' }, '2:00');
  const dayCell = h('div', { class: 'ar-top-cell ar-top-day', title: 'Gündüz / gece' }, h('span', null, dayIco, h('span', { class: 'ar-day-l' }, 'Gündüz')), dayTime);
  const top = h('div', { class: 'ar-top', 'aria-hidden': 'true' },
    h('div', { class: 'ar-top-cell ar-top-wave' }, h('span', null, 'Dalga'), nWave),
    h('div', { class: 'ar-top-cell ar-top-dogs' }, dogsLbl, nDogs),
    h('div', { class: 'ar-top-cell ar-top-kills' }, h('span', null, 'Öldürme'), nKills),
    dayCell,
  );
  // boss can çubuğu (üstte, adıyla)
  const bossName = h('strong', { class: 'ar-boss-name' });
  const bossPhase = h('span', { class: 'ar-boss-phase' });
  const bossFill = h('span', { class: 'ar-boss-fill' });
  const bossHp = h('span', { class: 'ar-boss-hp num' });
  const bossIco = h('span', { class: 'ar-boss-ico' });
  const bossBar = h('div', { class: 'ar-bossbar', hidden: true, role: 'meter', 'aria-label': 'Boss canı', 'aria-valuemin': '0' },
    h('div', { class: 'ar-boss-head' }, bossIco, bossName, bossPhase),
    h('div', { class: 'ar-boss-track' }, bossFill, bossHp),
  );
  // görev hedefleri (hikâye görevlerinde)
  const objList = h('ol', { class: 'ar-objs', hidden: true, 'aria-label': 'Görev hedefleri' });
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
  const breakLbl = h('span', null, 'Mola · sıradaki dalga ');
  const breakBar = h('div', { class: 'ar-break', hidden: true }, h('span', { class: 'ar-break-t' }, breakLbl, breakTime, ' sn'), breakShop, breakReady);

  // yetenek slotları
  function makeSlot(key, cls, touch = false) {
    const cd = h('span', { class: 'ar-slot-cd' });
    const cdText = h('span', { class: 'ar-slot-cdt num' });
    const cap = h('span', { class: 'ar-slot-key' }, touch ? key.toUpperCase() : SCHEMES[scheme].caps[key]);
    const extra = h('span', { class: 'ar-slot-extra num' });
    const charge = h('span', { class: 'ar-slot-charge' });
    const ico = h('span', { class: 'ar-slot-icon' });
    const pips = h('span', { class: 'ar-slot-lv', 'aria-hidden': 'true' });
    const plus = h('span', { class: 'ar-slot-plus', 'aria-hidden': 'true', html: glyph('plus') });
    const btn = h('button', { class: `ar-slot ${cls} ar-slot-${key}`, type: 'button' }, ico, charge, cd, cdText, cap, extra, pips, plus);
    // masaüstü: slotun üstünde küçük "+" (yetenek öğren)
    const learn = touch ? null : h('button', { class: 'ar-learn', type: 'button', hidden: true, 'aria-label': `${key.toUpperCase()} yeteneğini öğren (Ctrl+${key.toUpperCase()} ya da L)`, title: `Öğren (Ctrl+${key.toUpperCase()} · L)` }, h('span', { html: glyph('plus') }));
    const wrap = touch ? btn : h('div', { class: 'ar-slot-wrap' }, learn, btn);
    return { key, btn, wrap, cd, cdText, cap, extra, charge, ico, pips, plus, learn, last: {}, touch, lvKey: '' };
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
    ['bark', 'bark', 'jade', 'Canlı Zırh'], ['guise', 'guise', 'jade', 'Doğanın Örtüsü'], ['mshield', 'hood', 'arcane', 'Büyü kalkanı'],
    ['cyclone', 'cyclone', 'arcane', 'Kasırga'], ['blood', 'satanic', 'blood', 'Kan Çılgınlığı'], ['phase', 'phase', 'gold', 'Faz'],
    ['overload', 'overload', 'arcane', 'Aşırı Yük hazır'],
    ['root', 'root', 'blood', 'Kök'], ['silence', 'silence', 'blood', 'Susturma'], ['hex', 'hex', 'blood', 'Dönüşüm'], ['fear', 'fear', 'blood', 'Korku'],
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
  const spNum = h('b', { class: 'num' }, '0');
  const spBtn = h('button', { class: 'ar-sp-btn', type: 'button', hidden: true, 'aria-label': 'Yetenek puanı: öğrenme kipi (L)', title: 'Yetenek puanı — öğren (L / Ctrl+Q W E R)' }, h('span', { class: 'ar-sp-plus', html: glyph('plus') }), spNum);
  const portraitHit = h('button', { class: 'ar-portrait-hit', type: 'button', 'aria-label': 'Kahraman sayfası (C): özellikler, yetenekler, yetenek ağacı', title: 'Kahraman (C)' });
  const portraitBox = h('div', { class: 'ar-portrait' }, xpRing, portrait, portraitHit, h('span', { class: 'ar-portrait-lvl' }, lvlNum), talentBtn, spBtn);
  // özellikler (Güç / Çeviklik / Zekâ)
  const attrEls = {};
  const attrBox = h('button', { class: 'ar-attrs', type: 'button', 'aria-label': 'Özellikler ve istatistikler (C)', title: 'Özellikler (C)' });
  for (const k of ['str', 'agi', 'int']) {
    const v = h('b', { class: 'num' }, '0');
    const row = h('span', { class: `ar-attrs-r ar-attr-${k}` }, h('span', { class: 'ar-attrs-i', html: glyph(k) }), h('span', { class: 'ar-attrs-k' }, ATTR_SHORT[k]), v);
    attrEls[k] = { row, v };
    attrBox.appendChild(row);
  }
  const neutralSlot = h('button', { class: 'ar-islot ar-nslot empty', type: 'button', 'aria-label': 'Orman eşyası yuvası', title: 'Orman eşyası (kamplardan düşer)' }, h('span', { class: 'ar-islot-img' }));
  const goldNum = h('b', { class: 'num' }, '0');
  const goldBtn = h('button', { class: 'ar-gold', type: 'button', 'aria-label': 'Dükkân (B)', title: 'Dükkân (B)' }, h('span', { class: 'ar-coin', html: glyph('coin') }), goldNum, h('span', { class: 'ar-gold-shop', html: glyph('shop') }));
  const panel = h('div', { class: 'ar-panel' },
    buffs,
    h('div', { class: 'ar-panel-box' },
      portraitBox,
      attrBox,
      h('div', { class: 'ar-panel-mid' },
        h('div', { class: 'ar-slots' }, slots.q.wrap, slots.w.wrap, slots.e.wrap, slots.r.wrap),
        h('div', { class: 'ar-bars' }, hpBar, mpBar),
      ),
      h('div', { class: 'ar-panel-items' },
        h('div', { class: 'ar-items' }, islots.map((s) => s.btn), neutralSlot),
        goldBtn,
      ),
    ),
  );
  const nightVeil = h('div', { class: 'ar-nightveil', 'aria-hidden': 'true' });
  hud.append(nightVeil, vignette, edges, floats, top, bossBar, objList, scoreBox, tools, feed, minimapEl, banner, announce, breakBar, stampHost, panel);

  // dokunmatik kontroller
  const joyKnob = h('span', { class: 'ar-joy-knob' });
  const joyBase = h('span', { class: 'ar-joy-base' }, joyKnob);
  const joyZone = h('div', { class: 'ar-joyzone', 'aria-hidden': 'true' }, joyBase);
  const tbtns = h('div', { class: 'ar-tbtns' }, tslots.q.btn, tslots.w.btn, tslots.e.btn, tslots.r.btn);
  const titemsEl = h('div', { class: 'ar-titems' }, titems.map((s) => s.btn));
  // dokunmatikte yetenek puanı (+N) ve yetenek ağacı (T) düğmeleri yetenek kümesinin üstüne taşınır: portrede
  // durduklarında 44 px'lik portreyi örtüyor, portreye dokunmak kahraman sayfası yerine öğrenme kipini açıyordu
  const tlearn = h('div', { class: 'ar-tlearn' });
  const touchLayer = h('div', { class: 'ar-touch' }, joyZone, titemsEl, tbtns, tlearn);

  // --- dükkân ve yetenek ağacı
  const shop = buildShop({
    get game() { return game; },
    onBuy: (id) => { if (game) game.buy(id); },
    onSell: (i) => { if (game) game.sell(i); },
    onClose: () => closeShop(),
    onReady: () => readyUp(),
    onEquipNeutral: (id) => { if (game) game.equipNeutral(id); },
    onRerollNeutral: () => { if (game && !game.rerollNeutral()) floatAt('Takas yalnız molada', game.player.x, 2.2, game.player.z, 'dim'); },
    sound,
  });
  // kahraman sayfası: özellikler, yetenek seviyeleri, yetenek ağacı (T ve C açar; açıkken oyun durur)
  const talentHost = h('div', { class: 'ar-screen ar-talent ar-sheet', role: 'dialog', 'aria-label': 'Kahraman sayfası', hidden: true });
  // geri alma (buyback) kartı
  const bbCost = h('b', { class: 'num' }, '0');
  const bbTime = h('span', { class: 'ar-bb-t num' }, '6');
  const bbBtn = h('button', { class: 'btn primary lg ar-bb-btn', type: 'button' }, h('span', { class: 'ar-coin', html: glyph('coin') }), h('span', null, 'Geri al · '), bbCost, h('span', { class: 'kbd' }, 'Enter'));
  const bbGive = h('button', { class: 'btn ghost sm', type: 'button' }, 'Pes et');
  const bbLost = h('span', { class: 'xsmall muted' });
  const buybackEl = h('div', { class: 'ar-buyback', hidden: true, role: 'dialog', 'aria-label': 'Geri alma' },
    h('div', { class: 'ar-card ar-bb-card' },
      h('span', { class: 'eyebrow' }, 'Buyback'),
      h('strong', { class: 'ar-bb-title' }, 'Sürü seni yakaladı'),
      h('span', { class: 'ar-bb-ring' }, bbTime),
      bbBtn,
      bbLost,
      bbGive,
    ),
  );
  // orman eşyası seçimi (Kütüphane: meta.pools.neutralChoice) — oyun durmaz; 25 sn içinde seçilmezse ilki alınır
  const ncList = h('div', { class: 'ar-nc-list' });
  const ncTime = h('span', { class: 'ar-nc-t num' }, '25');
  const ncEl = h('div', { class: 'ar-nchoice', hidden: true, role: 'dialog', 'aria-label': 'Orman eşyası seç' },
    h('div', { class: 'ar-card ar-nc-card' },
      h('div', { class: 'ar-nc-head' }, h('span', { class: 'eyebrow' }, 'Orman sandığı'), h('strong', null, 'Birini seç'), ncTime),
      ncList,
    ),
  );

  // --- ekranlar
  const screens = h('div', { class: 'ar-screens' });
  const schemeChips = [];
  const autoBoxes = [];
  const shopBoxes = [];
  const learnBoxes = [];
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
    const lbox = h('input', { type: 'checkbox', id: `ar-learn-${idSuffix}`, class: 'ar-check', checked: autoLearn });
    lbox.addEventListener('change', () => { autoLearn = lbox.checked; ls.set('arena:autolearn', autoLearn); for (const b of learnBoxes) b.checked = autoLearn; if (game) { game.autoSkill = autoLearn; if (autoLearn && mode === 'playing') game.autoLearn(); } });
    learnBoxes.push(lbox);
    const sbox = h('input', { type: 'checkbox', id: `ar-shop-${idSuffix}`, class: 'ar-check', checked: autoShop });
    sbox.addEventListener('change', () => { autoShop = sbox.checked; ls.set('arena:autoshop', autoShop); for (const b of shopBoxes) b.checked = autoShop; });
    shopBoxes.push(sbox);
    return h('div', { class: 'ar-opts' },
      h('div', { class: 'ar-opt ar-opt-scheme', role: 'group', 'aria-label': 'Tuş düzeni' }, h('span', { class: 'label' }, 'Tuş düzeni'), h('div', { class: 'row ar-chips' }, chips)),
      h('label', { class: 'ar-opt ar-opt-check', for: `ar-auto-${idSuffix}` }, box, h('span', null, 'Otomatik nişan (en yakın düşman)')),
      h('label', { class: 'ar-opt ar-opt-check', for: `ar-shop-${idSuffix}` }, sbox, h('span', null, 'Molada dükkânı aç')),
      h('label', { class: 'ar-opt ar-opt-check', for: `ar-learn-${idSuffix}` }, lbox, h('span', null, 'Yetenek puanlarını otomatik dağıt')),
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
      [[k('L'), h('span', { class: 'dim xsmall' }, ' + '), k('Q'), k(S.wKey), k('E'), k('R')], 'Yetenek öğren (ya da ', h('span', { class: 'kbd' }, 'Ctrl'), '+Q/E/R, ', h('span', { class: 'kbd' }, 'Ctrl'), '+', S.wKey, ')'],
      [[k('C')], 'Kahraman sayfası: özellikler, yetenekler'],
      [[k('T')], 'Yetenek ağacı (10/15/20/25. seviye)'],
      [[k('Enter')], 'Ölünce: geri al (buyback)'],
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
    h('li', null, h('b', null, 'Yetenek puanı:'), ' yetenek düğmelerinin üstündeki yeşil “+” düğmesine dokun, sonra öğrenmek istediğin yeteneğe dokun. Ağaç simgesi yetenek ağacını açar.'),
    h('li', null, h('b', null, 'Portre:'), ' dokun, kahraman sayfası (özellikler, yetenek ağacı) açılır.'),
  );
  const select = buildSelect({
    heroId: save.hero,
    bestFor,
    onPick: (id) => pickHero(id),
    onStart: () => startGame(),
    devUnlock: import.meta.env.DEV ? (id) => { devUnlock(id); } : null,
    unlockCost: (id) => { try { return prog && prog.unlockCost ? prog.unlockCost(id) : 0; } catch { return 0; } },
    onUnlock: () => openPanel('library', 'heroes'),
    onMastery: (id) => openPanel('mastery', id),
    onBack: () => { if (run.kind === 'story') openCampaign(run.missionId); else openHub(); },
    onRandom: () => startGame({ random: true }),
    extras: [optionsBlock('s'), h('div', { class: 'ar-ctl-keys' }, keyTable), h('div', { class: 'ar-ctl-touch' }, touchHelp)],
  });
  const startScreen = select.el;
  // --- mod merkezi (Hikâye · Sonsuz · Günlük · Kütüphane · Kodeks)
  const hubGrid = h('div', { class: 'ar-hub-grid' });
  const hubPurse = h('span', { class: 'ar-hub-purse', title: 'Parıltı Taşı: Kütüphane’de harcanır' });
  const hubScreen = h('div', { class: 'ar-screen ar-hub', role: 'dialog', 'aria-label': 'Arena modları', hidden: true },
    h('div', { class: 'ar-card ar-hub-card' },
      h('div', { class: 'ar-hub-head' },
        h('div', null,
          h('span', { class: 'eyebrow' }, '1vDOQUZ Arena 3.0 · mini Dota'),
          h('h2', { class: 'ar-start-title' }, '1vDO', h('em', null, 'Q'), 'UZ'),
        ),
        hubPurse,
      ),
      h('p', { class: 'ar-hub-lead small' }, 'Dokuz DOG, bir kahraman. Hikâyede laneti kır, Sonsuz’da salon tablosuna yazıl, Günlük’te herkesle aynı koşulda yarış. ', h('b', null, 'DOG DOG DOG.')),
      hubGrid,
    ),
  );
  // --- günlük meydan okuma
  const dailyBody = h('div', { class: 'ar-card ar-daily-card' });
  const dailyScreen = h('div', { class: 'ar-screen ar-daily', role: 'dialog', 'aria-label': 'Günlük meydan okuma', hidden: true }, dailyBody);
  // --- hikâye: bölüm haritası (storyui.js tembel), final jeneriği
  const campHost = h('div', { class: 'ar-camp-host' });
  const campScreen = h('div', { class: 'ar-screen ar-camp-screen', role: 'dialog', 'aria-label': 'Hikâye: bölüm haritası', hidden: true }, campHost);
  const finaleScreen = h('div', { class: 'ar-screen ar-finale-screen', role: 'dialog', 'aria-label': 'Final', hidden: true });
  const resumeBtn = h('button', { class: 'btn primary lg', type: 'button' }, icon('play', { size: 18 }), 'Devam');
  const restartBtn = h('button', { class: 'btn ghost', type: 'button' }, icon('refresh', { size: 16 }), 'Baştan başla');
  const menuBtnLbl = h('span', null, 'Kahraman seç');
  const menuBtn = h('button', { class: 'btn ghost', type: 'button' }, icon('arrowLeft', { size: 16 }), menuBtnLbl);
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
  screens.append(hubScreen, startScreen, campScreen, dailyScreen, pauseScreen, overScreen, finaleScreen, talentHost);
  // hikâye diyalogları (storyui.createDialogue) bu katmana kurulur; sahne tam ekrandayken de görünür
  const talkHost = h('div', { class: 'ar-talkhost' });
  stage.append(hud, touchLayer, shop.el, buybackEl, ncEl, screens, talkHost, live);

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
    ['Dire Kulesi', 'tower', '#ff4a5a', 'Menzile girersen ateş eder (kırmızı halka). Yıkarsan +500 puan ve güvenilir altın. Kendi kulen %12 canın altındaysa vurup “deny” edebilirsin.', UNITS.tower_dire],
    ['Orman Kurdu', 'wolf', '#b9b2a4', 'Kurt İni ve Yaşlı Koru’da. Vurulana kadar kampında bekler; uzağa çekersen evine döner. Alfa kurt kritik vurur.', UNITS.neutral_wolf],
    ['Harpi', 'harpy', '#9fe8ff', 'Harpi Yuvası’nda. Menzilden vurur, ara ara şimşek fırtınası çağırır. Kamp temizlenince orman eşyası düşebilir.', UNITS.neutral_harpy],
  ];
  const bosses = BOSS_IDS.map((id) => [UNITS[id].name, UNITS[id].glyph || 'skull', UNITS[id].color, UNITS[id].hint, UNITS[id]]);
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
  const bossGrid = h('div', { class: 'ar-guide-grid' });
  for (const [name, ic, c, hint, U] of bosses) {
    bossGrid.appendChild(h('article', { class: 'ar-guide-card', style: { '--tc': c } },
      h('span', { class: 'ar-guide-img ar-guide-glyph', html: glyph(ic) }),
      h('div', { class: 'ar-guide-txt' },
        h('h3', { class: 'ar-guide-name' }, name),
        h('p', { class: 'xsmall muted' }, hint),
        h('div', { class: 'ar-guide-stats xsmall' },
          h('span', null, 'Can ', h('b', { class: 'num' }, fmtNum(U.hp))),
          h('span', null, 'Hasar ', h('b', { class: 'num' }, String(U.dmg))),
          h('span', null, 'Zırh ', h('b', { class: 'num' }, String(U.armor))),
        ),
      ),
    ));
  }
  const lbHost = h('div', { class: 'ar-lb' });
  const below = h('div', { class: 'ar-below' },
    h('section', { class: 'ar-guide panel', 'aria-labelledby': 'ar-guide-h' },
      h('div', { class: 'panel-head' },
        h('div', null, h('span', { class: 'eyebrow' }, 'Saha rehberi'), h('h2', { class: 'h2', id: 'ar-guide-h' }, 'Arenadaki DOG’lar')),
        h('span', { class: 'badge ember' }, '10 tür · 5 boss · 3 kamp'),
      ),
      guide,
      h('div', { class: 'panel-head ar-guide-sub' }, h('div', null, h('span', { class: 'eyebrow' }, 'Dire ordusu ve orman'), h('h3', { class: 'h3' }, 'Creep’ler, kuleler ve orman kampları'))),
      direGrid,
      h('div', { class: 'panel-head ar-guide-sub' }, h('div', null, h('span', { class: 'eyebrow' }, 'Bosslar'), h('h3', { class: 'h3' }, 'Roshan ve Dokuzun Laneti’nin lordları'))),
      h('p', { class: 'xsmall muted ar-guide-note' }, 'Sonsuz modda her 5. dalga boss dalgasıdır: tek katlar Roshan, çift katlar sırayla Feed Alfa, Gölge Ulusu, Dire Generali ve Sonsuz Pub’ın Kalbi. Boss’un adı ve canı ekranın üstünde görünür; halkalı, şeritli ve koni biçimli uyarılardan çekil.'),
      bossGrid,
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
    // tlearn sağdan sola dizer: +N hep aynı yerde (E'nin üstünde), T gerekince onun solunda
    if (v && spBtn.parentNode !== tlearn) tlearn.append(spBtn, talentBtn);
    else if (!v && spBtn.parentNode !== portraitBox) portraitBox.append(talentBtn, spBtn);
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
      boss: (id, o) => game.dev.boss(id, o),
      unit: (id, o) => game.dev.unit(id, o),
      camps: () => game.dev.camps(),
      neutral: (id) => game.dev.neutral(id),
      night: (v = true) => game.dev.night(v),
      learnAll: () => game.dev.learnAll(),
      talents: (i = 0) => { game.dev.talents(i); },
      kill: () => game.dev.kill(),
      unlock: (id = 'all') => { devUnlock(id); select.refresh(); return HERO_IDS.filter((x) => isHeroUnlocked(x)); },
      pickHero: (id) => { devUnlock(id); if (mode === 'start' && menu !== 'select') openSelect('endless'); select.setHero(id); pickHero(id); },
      start: (cfg = {}) => { if (!cfg.mode || cfg.mode === 'endless') run = { kind: 'endless' }; return startGame(cfg); },
      sheet: (tab) => openSheet(tab),
      learnMode: (v = true) => setLearnMode(v),
      // --- Faz D: modlar ve hikâye
      menu: () => menu,
      run: () => ({ ...run, daily: run.daily ? { ...run.daily } : null }),
      hub: () => (mode === 'start' || mode === 'loading' ? openHub() : toMenu('hub')),
      endless: () => openSelect('endless'),
      campaign: (id = null) => loadStory().then(() => { if (mode === 'start' || mode === 'loading') openCampaign(id); else toMenu('campaign'); return menu; }),
      daily: () => (mode === 'start' || mode === 'loading' ? openDaily() : toMenu('daily')),
      startDaily: () => { openDaily(); startGame(); return mode; },
      /** Görevi doğrudan başlat (isteğe bağlı kahramanla). */
      story: (id, heroId) => loadStory().then(() => loadStoryUi()).then(() => {
        if (heroId) { devUnlock(heroId); save.hero = heroId; select.setHero(heroId); game.attract(heroId); applyHeroUi(); }
        run = { kind: 'story', missionId: id, dev: true }; // test kancası: kilit denetimini atlar
        menu = 'select';
        refreshSelectContext();
        startGame();
        return mode;
      }),
      /** Hikâye görevini zaferle bitir. all: bonus hedefler de tamam (3 yıldız). */
      win: (all = true) => { for (const o of game.objectives) if (all || !o.optional) { if (!o.failed) { o.done = true; o.progress = o.n; } } game.finish(true); },
      lose: () => game.finish(false),
      talkOpen: () => !!(dlg && dlg.open),
      talkNext: () => { const b = talkHost.querySelector('.ars-talk-next'); if (b) b.click(); return !!(dlg && dlg.open); },
      talkSkip: () => { if (dlg) dlg.close(); },
      storyProgress: () => loadStory().then((S) => S.storyProgress()),
      storyUnlock: (n = 5, stars = 3) => loadStory().then((S) => S.devCompleteStory(n, stars)),
      storyReset: () => loadStory().then((S) => S.resetStory()),
      panel: (kind, arg) => openPanel(kind, arg),
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
        const tg = targetingOf(game, k);
        const D = abilityDisplay(game, k);
        s.ico.innerHTML = glyph(A.icon);
        s.btn.classList.toggle('passive', tg === 'passive');
        s.btn.classList.toggle('variant', !!(D && D.variant));
        s.btn.dataset.targeting = tg;
        s.lvKey = '';
      }
    }
    for (const k of ['str', 'agi', 'int']) attrEls[k].row.classList.toggle('primary', H.attr === k);
    const ttl = heroTitle();
    portraitHit.title = `${H.name}${ttl ? ` · ${ttl}` : ''} (C)`;
    portraitBox.classList.toggle('titled', !!ttl);
    accLbl.textContent = H.id === 'okcu' ? 'İsabet ' : 'Verim ';
  }
  /** Yetenek düğmesi ipucu: ad, seviye, değerler. */
  function slotLabel(key) {
    const info = abilityInfo(game, key);
    if (!info) return '';
    const { A, lv, max } = info;
    const D = abilityDisplay(game, key);
    const rows = D.variant ? '' : abilityRows(A).map(([l, v]) => `${l} ${v}`).join(' · ');
    return `${D.name}${D.variant ? ' (varyant)' : ''} — seviye ${lv}/${max}${lv ? '' : ' (öğrenilmedi)'}. ${abilityTip(A)}. ${D.desc}${rows ? ` (${rows})` : ''}`;
  }
  applyHeroUi();

  // ------------------------------------------------------------------ kalıcı ilerleme bağlantısı (varsa)
  let prog = null;
  let stopTrack = null;
  let lastRunEnd = null;
  function progUnlocked(id) {
    if (!prog) return false;
    const names = HERO_ALIASES[id] || [id];
    try {
      if (typeof prog.isHeroUnlocked === 'function') return names.some((n) => prog.isHeroUnlocked(n));
      const pr = typeof prog.getProfile === 'function' ? prog.getProfile() : null;
      const u = pr && (pr.unlocked || pr.unlocks || pr.heroes);
      if (Array.isArray(u)) return names.some((n) => u.includes(n) || u.includes(`hero:${n}`));
      if (u && typeof u === 'object') return names.some((n) => !!(u[n] || u[`hero:${n}`] || (Array.isArray(u.heroes) && u.heroes.includes(n)) || (u.heroes && u.heroes[n])));
    } catch (e) { console.warn('Arena: kilit kontrolü', e); }
    return false;
  }
  let stopCurse = null;
  /** Lanet seçicisini (progression.mountCursePicker → tembel library.js) bir kez kur. */
  function ensureCursePicker() {
    if (stopCurse || !prog || !alive) return;
    try { if (typeof prog.mountCursePicker === 'function') stopCurse = prog.mountCursePicker(select.curseHost, { onChange: () => { sound.click(); refreshSelectContext(); } }); } catch (e) { console.warn('Arena: mountCursePicker', e); }
  }
  const progLoader = PROG_MOD['./progression.js'];
  if (progLoader) {
    progLoader().then((m) => {
      if (!alive) return;
      prog = m;
      registerUnlockCheck(progUnlocked);
      // İlerleme sözleşmesi (docs/ARENA-ILERLEME.md, madde 1): salon mağazası + oyun içi sayaçlar (kodeks, ustalık)
      try { if (typeof m.connectStore === 'function') m.connectStore(coreStore); } catch (e) { console.warn('Arena: connectStore', e); }
      try { if (typeof m.trackGame === 'function' && game) stopTrack = m.trackGame(game); } catch (e) { console.warn('Arena: trackGame', e); }
      // madde 3: Sonsuz modun Lanet seçicisi seçim ekranı ilk açılınca kurulur (library.js parçasını çeker; merkezde gerekmez)
      if (menu === 'select') ensureCursePicker();
      ensureStoryCodex();
      refreshSelectContext();
      if (mode === 'start' && menu === 'hub') renderHub();
      if (mode === 'start' && menu === 'daily') renderDaily();
    }).catch((e) => console.warn('Arena: progression.js yüklenemedi', e));
  }

  // ------------------------------------------------------------------ hikâye (tembel)
  let storyMod = null;
  let storyUi = null;
  const loadStory = () => (storyMod ? Promise.resolve(storyMod) : import('./story.js').then((m) => { storyMod = m; ensureStoryCodex(); return m; }));
  const loadStoryUi = () => (storyUi ? Promise.resolve(storyUi) : Promise.all([loadStory(), import('./storyui.js')]).then(([, u]) => { storyUi = u; return u; }));
  let storyCodexDone = false;
  /** madde 5: hikâye kartlarını Kodeks'e kaydet (her iki modül de yüklenince bir kez). */
  function ensureStoryCodex() {
    if (storyCodexDone || !prog || !storyMod || typeof prog.registerCodex !== 'function') return;
    storyCodexDone = true;
    try { prog.registerCodex('story', storyMod.STORY_CODEX); } catch (e) { console.warn('Arena: registerCodex', e); }
    reconcileStory();
  }
  // merkezdeki Hikâye kartı ilerlemeyi gösterebilsin diye veri boşta yüklenir (küçük, ayrı parça)
  loadStory().then(() => { if (alive && mode === 'start' && menu === 'hub') renderHub(); }).catch((e) => console.warn('Arena: story.js yüklenemedi', e));

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
  const foeName = (e) => (e.kind === 'dog' ? DOG_TYPES[e.type].short : e.kind === 'boss' || e.kind === 'neutral' ? (e.def && e.def.short) || 'BOSS' : e.type === 'ranged' ? 'Büyücü' : 'Piyade');

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
  const STORY_EVENTS = new Set(['waveStart', 'bossSpawn', 'bossPhase', 'bossShieldBreak', 'objective', 'story']);
  function onEvent(type, d) {
    if (!game) return; // kurulum sırasında (createGame içindeki ilk olaylar)
    if (view) view.event(type, d, game);
    if (STORY_EVENTS.has(type)) storyEvent(type, d);
    const p = game.player;
    switch (type) {
      case 'waveStart':
        if (d.text) {
          showBanner(`Dalga ${d.wave}`, d.text, d.bossId ? 'rampage' : 'wave', 2800);
          say(`Dalga ${d.wave}. ${d.text}`, true);
        } else if (d.bossId && d.bossId !== 'boss_roshan') {
          const U = UNITS[d.bossId];
          showBanner(`Dalga ${d.wave}: ${U.name.toLocaleUpperCase('tr')}`, U.hint, 'rampage', 3000);
          snd('roar', 0, 0.8);
          say(`Dalga ${d.wave}. ${U.name} geldi!`, true);
        } else if (d.boss) {
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
      case 'hit':
        if (d.src === 'burn' || d.src === 'cleave') break;
        snd('hit', 55);
        break;
      case 'dmgNum': {
        // yüzen hasar sayıları: fiziksel kırmızı/turuncu, büyü mavi, saf beyaz; kritik büyük; kahramana gelen "-"
        if (d.miss) { floatAt(d.hero ? 'MISS' : 'ISKA', d.x, d.y, d.z, 'dn miss'); break; }
        if (d.immune) { floatAt('BAĞIŞIK', d.x, d.y, d.z, 'dn immune'); break; }
        if (d.block && !d.n) { floatAt('BLOK', d.x, d.y, d.z, 'dn block'); break; }
        if (d.absorb && !d.n) { floatAt('KALKAN', d.x, d.y, d.z, 'dn block'); break; }
        if (!(d.n > 0)) break;
        const t = d.type === 'magical' ? 'mag' : d.type === 'pure' ? 'pure' : 'phys';
        const cls = `dn ${t}${d.crit ? ' crit' : ''}${d.hero ? ' tohero' : ''}${d.n >= 250 ? ' huge' : ''}`;
        floatAt(d.hero ? `-${d.n}` : d.crit ? `${d.n}!` : String(d.n), d.x, d.y, d.z, cls);
        break;
      }
      case 'kill': {
        const e = d.foe;
        snd('coin', 70);
        if (d.gold > 0) floatAt(`+${d.gold}`, e.x, e.kind === 'boss' ? 3 : 1.5, e.z, d.lastHit ? 'gold' : 'gold dim');
        if (e.kind === 'dog') say(`${archOf(e.type).name} indi. Kalan DOG: ${game.dogsLeft}. Skor ${fmtNum(game.score)}.`);
        if ((e.kind !== 'creep' && e.kind !== 'neutral' && !e.summon) || (d.by === 'hero' && e.kind === 'creep')) {
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
        else if (d.n >= 3 && game.cosmetics && game.cosmetics.stamp) stamp('DOG DOG DOG', 'gold'); // Kütüphane kozmetiği
        else snd('good', 0);
        say(`${d.label}! ${d.bonus} bonus puan.`, true);
        break;
      case 'streak':
        announcer(d.label, `${d.n} DOG seri${d.gold ? ` · +${d.gold} altın` : ''}`, d.n >= 9 ? 'gold' : 'streak', 1500);
        snd('horn', 0, 0.9 + d.n * 0.02);
        break;
      case 'hurt':
        flashVignette('hurt');
        snd('bad', 380);
        if (d.dmg >= 60) haptic(18);
        break;
      case 'evade':
        if (d.hero !== false && (d.target === p || d.hero)) snd('whoosh', 250);
        break;
      case 'immune':
        floatAt('BAĞIŞIK', p.x, 2.2, p.z, 'gold');
        break;
      case 'status':
        if (d.hero) {
          const txt = { hex: 'DÖNÜŞTÜN!', silence: 'SUSTURULDUN', fear: 'KORKU!', root: 'KÖKLENDİN', stun: '' }[d.kind];
          if (txt) { floatAt(txt, p.x, 2.3, p.z, 'hurt'); say(`${STATUS_NAMES[d.kind]}: ${f1(d.dur)} saniye.`); }
        }
        break;
      case 'silenced':
        floatAt('Susturuldun', p.x, 2.0, p.z, 'hurt');
        snd('miss', 250);
        if (d.key) nudge(d.key);
        break;
      case 'unlearned':
        floatAt(game.player.skillPoints > 0 ? 'Önce öğren: L' : 'Henüz öğrenilmedi', p.x, 2.0, p.z, 'dim');
        snd('miss', 250);
        if (d.key) nudge(d.key);
        break;
      case 'learn': {
        snd('good', 0);
        const nm = d.key === 'stats' ? STATS_BONUS.name : abilityDisplay(game, d.key).name;
        floatAt(`${nm} ${d.level}`, p.x, 2.5, p.z, 'gold');
        say(`${nm} seviye ${d.level}. Kalan yetenek puanı ${d.points}.`);
        if (d.points <= 0) setLearnMode(false);
        if (!talentHost.hidden) renderSheet();
        break;
      }
      case 'learnFail':
        snd('miss', 150);
        if (d.key && d.key !== 'stats') nudge(d.key);
        break;
      case 'dayNight':
        if (mode === 'playing') {
          announcer(d.night ? 'GECE ÇÖKTÜ' : 'GÜN DOĞDU', d.night ? 'Görüş kısaldı · Wardsız DOG’lar güçlendi' : 'Görüş açıldı', d.night ? 'night' : 'gold', 1800);
          say(d.night ? 'Gece çöktü: görüş kısaldı, Wardsız DOG’lar güçlendi.' : 'Gün doğdu: görüş açıldı.', true);
          snd('horn', 0, d.night ? 0.55 : 1.2);
          if (sound.dusk) later(() => snd('dusk', 0, d.night), 400);
        }
        break;
      case 'bossSpawn':
        if (d.boss !== 'boss_roshan') {
          announcer(`${UNITS[d.boss].name.toLocaleUpperCase('tr')} GELDİ`, UNITS[d.boss].hint.split('.')[0], 'blood', 2400);
          haptic([20, 40, 20]);
        }
        break;
      case 'bossPhase':
        showBanner(d.foe.name, d.text, 'rampage', 2000);
        snd('roar', 0, 1.1);
        say(`${d.foe.name}: ${d.text}`, true);
        break;
      case 'bossTele':
        if (sound.warn) snd('warn', 500, d.kind === 'dash' ? 1.2 : 1);
        if (d.kind === 'warcry') floatAt('SAVAŞ NARASI!', d.foe.x, 3.2, d.foe.z, 'gold big');
        else if (d.kind === 'howl') floatAt('ULUMA!', d.foe.x, 2.6, d.foe.z, 'arcane big');
        else if (d.kind === 'dash') floatAt('DALIŞ!', d.foe.x, 2.6, d.foe.z, 'ember big');
        else if (d.kind === 'pulseIn' || d.kind === 'pulseOut') floatAt(d.kind === 'pulseIn' ? 'İÇ NABIZ: DIŞARI!' : 'DIŞ NABIZ: İÇERİ!', d.foe.x, 3.6, d.foe.z, 'blood big');
        break;
      case 'bossAct':
        if (d.kind === 'dash' || d.kind === 'stealth') snd('whoosh', 100);
        else if (d.kind === 'pounce' || d.kind === 'pulse') { snd('slam', 100, 0.9); haptic(20); }
        else if (d.kind === 'howl') snd('roar', 100, 1.3);
        else if (d.kind === 'warcry') snd('horn', 100, 0.7);
        else if (d.kind === 'cleave') snd('chop', 100, 0.8);
        break;
      case 'bossSummon':
        feedPush([h('span', { class: 'ar-feed-ico dire', html: glyph(d.foe.def.glyph || 'skull') }), h('b', null, d.foe.name), ' ', d.text || 'çağırdı'], 'dire');
        break;
      case 'bossShieldBreak':
        announcer('KALKAN KIRILDI', `${d.foe.name} savunmasız!`, 'gold', 1600);
        snd('good', 0);
        break;
      case 'bossDown':
        announcer(`${d.foe.name.toLocaleUpperCase('tr')} DÜŞTÜ`, 'Orman eşyası düştü · güvenilir altın', 'gold', 2600);
        stamp('LORD DÜŞTÜ', 'gold');
        snd('horn', 0, 0.6);
        break;
      case 'campSpawn':
        if (mode === 'playing' && game.state !== 'idle') campNote();
        break;
      case 'campCleared':
        feedPush([heroTag(), h('span', { class: 'ar-feed-ico', html: glyph('wolf') }), `${d.camp.name} temiz`], 'gold');
        break;
      case 'neutralDrop':
        floatAt(`Orman: ${d.item.name}`, d.pickup.x, 1.8, d.pickup.z, 'jade');
        snd('rune', 0, 1.1);
        break;
      case 'neutralEquip':
        floatAt(`+${d.item.name}`, p.x, 2.3, p.z, 'jade');
        hideNeutralChoice();
        break;
      case 'neutralChoice':
        showNeutralChoice(d.choices, d.tier);
        break;
      case 'neutralReroll':
        floatAt(`${d.from.name} → ${d.item.name}`, p.x, 2.3, p.z, 'jade');
        feedPush([h('span', { class: 'ar-feed-ico', html: glyph('tree') }), `Orman takası: ${d.item.name}`], 'gold');
        snd('rune', 0, 0.9);
        break;
      case 'lootBack':
        floatAt(`GERİ ALINDI${d.gold ? ` +${d.gold}` : ''}${d.tango ? ' +Tango' : ''}`, d.foe.x, 1.8, d.foe.z, 'gold');
        say('Kurye Köpeğinden ganimet geri alındı.');
        break;
      case 'deny':
        floatAt('DENY!', d.x, 3.2, d.z, 'ember big');
        feedPush([heroTag(), h('span', { class: 'ar-feed-ico', html: glyph('tower') }), 'kulesini deny etti'], '');
        break;
      case 'direMorale':
        feedPush([h('b', { class: 'ar-feed-dire' }, 'Dire creep’leri coştu'), ` +%${15 * d.n} hasar`], 'dire');
        break;
      case 'combine':
        floatAt(`+${d.item.name}`, p.x, 2.4, p.z, 'gold big');
        snd('buy', 0);
        feedPush([h('span', { class: 'ar-feed-ico', html: glyph('shop') }), `${d.item.name} birleşti`], 'gold');
        break;
      case 'heroFeared':
        haptic(20);
        break;
      case 'objective':
        renderObjectives();
        if (d.done && mode === 'playing') { announcer('HEDEF TAMAM', d.obj.text || objText(d.obj), 'gold', 1600); snd('good', 0); }
        if (d.failed && mode === 'playing') announcer('HEDEF KAÇTI', d.obj.text || objText(d.obj), 'blood', 1600);
        break;
      case 'runEnd':
        lastRunEnd = d;
        break;
      case 'ward':
        snd('rune', 0, 1.4);
        floatAt('Ward dikildi', d.ward.x, 1.4, d.ward.z, 'jade');
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
        if (d.kind === 'wand') floatAt(`+${d.amount || 16 * d.n}`, p.x, 2.0, p.z, 'jade');
        if (d.kind === 'dust') { snd('whoosh', 0); floatAt(d.n ? `Açığa çıktı: ${d.n}` : 'Toz: kimse yok', p.x, 2.2, p.z, 'arcane'); }
        if (d.kind === 'cyclone') { snd('whoosh', 0); floatAt('KASIRGA', p.x, 2.2, p.z, 'ice'); }
        if (d.kind === 'magShield') floatAt('Büyü kalkanı', p.x, 2.2, p.z, 'arcane');
        if (d.kind === 'satanic') { snd('bad', 0); floatAt('KAN ÇILGINLIĞI', p.x, 2.2, p.z, 'hurt'); }
        if (d.kind === 'mek') { snd('good', 0); floatAt('+260', p.x, 2.2, p.z, 'jade'); }
        if (d.kind === 'tome') { snd('levelUp', 0); floatAt('+XP', p.x, 2.2, p.z, 'gold'); }
        if (d.kind === 'phase') snd('whoosh', 0);
        if (d.kind === 'remnantBoom' || d.kind === 'overload' || d.kind === 'zap') { if (sound.zap) snd('zap', 90); else snd('freeze', 90, 1.4); }
        if (d.kind === 'vortex') snd('spin', 0);
        if (d.kind === 'ballStart') snd('blink', 0, 1.3);
        if (d.kind === 'growth') { snd('slam', 0, 0.8); haptic([15, 30, 15]); }
        if (d.kind === 'leech' || d.kind === 'thorns') { if (sound.vine) snd('vine', 80); else snd('rune', 60, 0.9); }
        if (d.kind === 'guise' || d.kind === 'bark') snd('rune', 60, 0.9);
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
        hideBuyback();
        if (d.buyback) {
          stamp('BUYBACK!', 'gold');
          feedPush([heroTag(), h('span', { class: 'ar-feed-ico', html: glyph('coin') }), `geri aldı (${d.cost})`], 'gold');
          say('Geri alındın: çeşmedesin.', true);
        } else {
          stamp('AEGIS!', 'gold');
          say('Aegis ile geri döndün.', true);
        }
        flashVignette('gold');
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
        if (d.buyback) {
          showBuyback(d.buyback, d.lost);
          say(`Öldün. ${d.buyback.cost} altına geri alabilirsin: Enter.`, true);
        } else showBanner('Sürü seni yakaladı', d.lost ? `DOG DOG DOG… −${d.lost} güvenilmez altın` : 'DOG DOG DOG…', 'blood', 1600);
        break;
      case 'levelUp':
        floatAt(`SEVİYE ${d.level}`, p.x, 2.4, p.z, 'gold big');
        snd('levelUp', 0);
        if (!autoLearn && game.player.skillPoints > 0) say(`Seviye ${d.level}. ${game.player.skillPoints} yetenek puanı: L ile öğren.`);
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
        hideBuyback();
        hideNeutralChoice();
        gameOver(d.report);
        break;
      case 'reset':
        for (const s of floatPool) { if (s._anim) s._anim.cancel(); s.style.opacity = '0'; }
        for (const x of feedItems.splice(0)) x.li.remove();
        talentBtn.hidden = true;
        hideBuyback();
        hideNeutralChoice();
        renderObjectives();
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

  // ------------------------------------------------------------------ kahraman sayfası (özellikler · yetenekler · yetenek ağacı)
  let sheetFocus = 'hero';
  function openTalents() { openSheet('talents'); }
  function openSheet(focusOn = 'hero') {
    if (!game || (mode !== 'playing' && mode !== 'picking')) return;
    if (game.state === 'dying' || game.state === 'over') return;
    sheetFocus = focusOn;
    mode = 'picking';
    keys.clear();
    game.chargeCancel();
    resetTouch();
    closeShop(true);
    renderSheet();
    talentHost.hidden = false;
    stage.classList.add('has-screen');
    later(() => {
      const t = talentHost.querySelector(focusOn === 'talents' ? '.ar-tal-opt.pending' : '.ar-sheet-close') || talentHost.querySelector('.ar-sheet-close');
      try { t && t.focus({ preventScroll: true }); } catch { /* yok say */ }
      if (focusOn === 'talents') talentHost.querySelector('.ar-tal-tree2')?.scrollIntoView?.({ block: 'nearest' });
    }, 30);
    const p = game.player;
    if (p.talentPending.length) {
      const L = p.talentPending[0];
      say(`Seviye ${L} yetenek ağacı: 1 ${game.H.talents[L][0].name}, 2 ${game.H.talents[L][1].name}.`, true);
    }
  }
  function closeSheet() {
    talentHost.hidden = true;
    stage.classList.remove('has-screen');
    mode = 'playing';
    focusStage();
    if (game.state === 'break' && autoShop && !shop.open) later(() => openShop(), 250);
  }
  function chooseTalent(level, i) {
    if (!game.chooseTalent(level, i)) return;
    sound.good?.();
    renderSheet();
    if (!game.player.talentPending.length && sheetFocus === 'talents') later(() => { if (mode === 'picking') closeSheet(); }, 350);
  }
  function statRow(label, value, hint = '') {
    return h('div', { class: 'ar-sst' }, h('dt', null, label), h('dd', { class: 'num', title: hint }, value));
  }
  /** Ustalık/Kütüphane unvanı (meta.mastery.title ya da meta.cosmetics.title), yoksa ''. */
  function heroTitle() {
    const m = game && game.meta;
    return (m && ((m.mastery && m.mastery.title) || (m.cosmetics && m.cosmetics.title))) || '';
  }
  function renderSheet() {
    const g = game;
    const p = g.player;
    const H = g.H;
    const st = g.stat;
    clear(talentHost);
    const closeB = h('button', { class: 'ar-tool ar-sheet-close', type: 'button', 'aria-label': 'Kapat (Esc)', title: 'Kapat (Esc / C)' }, icon('close', { size: 18 }));
    closeB.addEventListener('click', closeSheet);
    // özellikler
    const attrs = h('div', { class: 'ar-sheet-attrs' }, ['str', 'agi', 'int'].map((k) => h('div', { class: `ar-sattr ar-attr-${k}${H.attr === k ? ' primary' : ''}` },
      h('span', { class: 'ar-sattr-i', html: glyph(k) }),
      h('div', null, h('span', { class: 'ar-sattr-n' }, ATTR_NAMES[k], H.attr === k ? h('em', null, ' · ana') : null), h('b', { class: 'num' }, String(Math.round(st[k])))),
      h('span', { class: 'ar-sattr-h xsmall' }, k === 'str' ? `+${Math.round(st.str * 20)} can · +${f1(st.str * 0.1)} yenilenme` : k === 'agi' ? `+${f1(st.agi / 10)} zırh · +${Math.round(st.agi * 0.75)} saldırı hızı` : `+${Math.round(st.int * 12)} mana · +%${f1(st.int * 0.2)} büyü`),
    )));
    const armorPct = Math.round(armorReduction(st.armor) * 100);
    const stats = h('dl', { class: 'ar-sheet-stats' },
      statRow('Saldırı hasarı', String(Math.round(st.atkDmg * g.dmgMul(false))), 'Taban + ana özellik + eşyalar'),
      statRow(H.attack ? 'Saldırı süresi' : 'Ok gücü', H.attack ? `${f1(st.atkRate)} sn` : '%70 saldırı hasarı', H.attack ? `Saldırı hızı ${Math.round(st.atkSpeed)}` : 'Tam şarjlı CureShot saldırı hasarının %70’ini ekler'),
      statRow('Zırh', `${f1(st.armor)} (${armorPct >= 0 ? '−' : '+'}%${Math.abs(armorPct)})`, 'Fiziksel hasar çarpanı 1 − 0,06·zırh / (1 + 0,06·|zırh|)'),
      statRow('Büyü direnci', `%${Math.round(st.magicResist * 100)}`),
      statRow('Kaçınma', `%${Math.round(st.evasion * 100)}`),
      statRow('Statü direnci', `%${Math.round(st.statusRes * 100)}`),
      statRow('Büyü güçlendirme', `+%${Math.round((st.spellAmp - 1) * 100)}`),
      statRow('Kritik', st.crit > 0 ? `%${Math.round(st.crit * 100)} ×${f1(st.critMul)}` : '—'),
      statRow('Can çalma', st.lifesteal > 0 || st.spellLifesteal > 0 ? `%${Math.round(st.lifesteal * 100)}${st.spellLifesteal > 0 ? ` · büyü %${Math.round(st.spellLifesteal * 100)}` : ''}` : '—'),
      statRow('Hasar bloğu', st.block > 0 ? `${Math.round(st.block)} (%${Math.round(st.blockChance * 100)})` : '—'),
      statRow('Hız', f1(st.speed)),
      statRow('Yenilenme', `${f1(st.hpRegen)} can · ${f1(st.manaRegen)} mana`),
      statRow('Altın', `${fmtNum(p.goldR)} güvenilir · ${fmtNum(g.unreliable())} güvenilmez`, 'Ölünce güvenilmez altının %40’ı düşer'),
      statRow('Geri alma', g.mods.noBuyback ? 'kapalı' : p.buybackCd > 0 ? `${fmtT(p.buybackCd)} bekleme` : `${fmtNum(g.buybackCost())} altın`, `Bekleme ${BUYBACK_CD} sn`),
    );
    // yetenekler
    const abil = h('div', { class: 'ar-sheet-abil' });
    for (const k of KEYS4) {
      const info = abilityInfo(g, k);
      const A = info.A;
      const D = abilityDisplay(g, k);
      const can = g.canLearn(k);
      const cap = abilityCap(k, p.level);
      const need = info.lv >= info.max ? 'dolu' : cap <= info.lv ? `${k === 'r' ? (info.lv + 1) * 6 : info.lv * 2 + 1}. seviyede` : '';
      const lb = h('button', { class: 'ar-sab-learn', type: 'button', disabled: !can, 'aria-label': `${D.name} öğren`, title: can ? `Öğren (${KEY_NAMES[k]})` : need || 'Yetenek puanı yok' }, h('span', { html: glyph('plus') }));
      lb.addEventListener('click', () => { game.learn(k); renderSheet(); });
      const rows = abilityRows(A);
      abil.appendChild(h('div', { class: `ar-sab${info.lv ? '' : ' unlearned'}${A.ult ? ' ult' : ''}` },
        h('span', { class: 'ar-sab-i', html: glyph(A.icon) }),
        h('div', { class: 'ar-sab-t' },
          h('strong', null, `${KEY_NAMES[k]} · ${D.name}`, D.variant ? h('span', { class: 'ar-sab-var', title: `Kütüphane varyantı (temel: ${A.name})` }, 'VARYANT') : null),
          h('span', { class: 'ar-sab-pips' }, Array.from({ length: info.max }, (_, i) => h('i', { class: i < info.lv ? 'on' : '' }))),
          h('span', { class: 'xsmall muted ar-sab-d' }, D.desc),
          rows.length ? h('span', { class: 'xsmall ar-sab-rows' }, rows.map(([l, v]) => h('span', null, `${l} `, h('b', { class: 'num' }, v)))) : null,
        ),
        h('div', { class: 'ar-sab-side' }, lb, need ? h('span', { class: 'xsmall dim' }, need) : null),
      ));
    }
    {
      const can = g.canLearn('stats');
      const lb = h('button', { class: 'ar-sab-learn', type: 'button', disabled: !can, 'aria-label': 'Özellik bonusu öğren' }, h('span', { html: glyph('plus') }));
      lb.addEventListener('click', () => { game.learn('stats'); renderSheet(); });
      abil.appendChild(h('div', { class: 'ar-sab stats' },
        h('span', { class: 'ar-sab-i', html: glyph('star') }),
        h('div', { class: 'ar-sab-t' }, h('strong', null, STATS_BONUS.name), h('span', { class: 'ar-sab-pips' }, Array.from({ length: g.maxAbilityLevel('stats') }, (_, i) => h('i', { class: i < p.statsLv ? 'on' : '' }))), h('span', { class: 'xsmall muted ar-sab-d' }, STATS_BONUS.desc)),
        h('div', { class: 'ar-sab-side' }, lb),
      ));
    }
    // yetenek ağacı (25 üstte)
    const tree = h('div', { class: 'ar-tal-tree2', role: 'group', 'aria-label': 'Yetenek ağacı' });
    for (const L of [...TALENT_LEVELS].reverse()) {
      const chosen = p.talentChoice[L];
      const pending = p.talentPending.includes(L);
      const reached = p.level >= L;
      const opt = (i) => {
        const T = H.talents[L][i];
        const cls = `ar-tal-opt ${i ? 'right' : 'left'}${chosen === i ? ' chosen' : chosen != null ? ' other' : ''}${pending ? ' pending' : ''}${!reached ? ' future' : ''}`;
        const b = h('button', { class: cls, type: 'button', disabled: !pending, 'aria-pressed': String(chosen === i) }, pending ? h('span', { class: 'ar-tal-k kbd' }, String(i + 1)) : null, h('span', null, T.name));
        b.addEventListener('click', () => chooseTalent(L, i));
        return b;
      };
      tree.appendChild(h('div', { class: `ar-tal-tier${pending ? ' pending' : ''}${reached ? '' : ' future'}` }, opt(0), h('span', { class: 'ar-tal-lv num' }, String(L)), opt(1)));
    }
    const pend = p.talentPending.length;
    talentHost.appendChild(h('div', { class: 'ar-card ar-sheet-card', style: { '--hc': H.color } },
      h('div', { class: 'ar-sheet-head' },
        h('span', { class: 'ar-sheet-emb', html: glyph(H.id) }),
        h('div', null, h('span', { class: 'eyebrow' }, `Seviye ${p.level} · ${H.role}`), h('h2', { class: 'h2' }, H.name, heroTitle() ? h('span', { class: 'ar-sheet-title' }, ` · ${heroTitle()}`) : null)),
        p.skillPoints > 0 && g.learnable().length ? h('span', { class: 'badge jade ar-sheet-sp' }, `+${p.skillPoints} yetenek puanı`) : null,
        closeB,
      ),
      h('div', { class: 'ar-sheet-grid' },
        h('section', { class: 'ar-sheet-col' }, h('h3', { class: 'ar-sheet-h' }, 'Özellikler'), attrs, stats),
        h('section', { class: 'ar-sheet-col' },
          h('h3', { class: 'ar-sheet-h' }, 'Yetenekler', h('span', { class: 'xsmall dim' }, ' · Q W E 4 seviye, R 6/12/18')),
          abil,
          h('h3', { class: 'ar-sheet-h' }, 'Yetenek ağacı', pend ? h('span', { class: 'badge gold' }, `${pend} seçim bekliyor`) : h('span', { class: 'xsmall dim' }, ' · 10/15/20/25. seviye')),
          tree,
          h('p', { class: 'xsmall muted ar-sheet-aghs' }, H.aghs),
        ),
      ),
      h('p', { class: 'xsmall muted' }, 'Oyun bu sayfa açıkken durur. 1 / 2 ile yetenek ağacı, Q W E R ile yetenek öğren, Esc ile kapat.'),
    ));
  }

  // ------------------------------------------------------------------ öğrenme kipi
  function setLearnMode(v) {
    learnMode = !!v && !!game && game.player.skillPoints > 0 && game.learnable().length > 0;
    stage.classList.toggle('learning', learnMode);
    spBtn.setAttribute('aria-pressed', String(learnMode));
    if (learnMode) say(`Öğrenme kipi: yetenek seç (Q ${SCHEMES[scheme].wKey} E R ya da düğmelerin üstündeki artı). Çıkmak için L.`, true);
  }
  function learnKey(key) {
    if (!game || (mode !== 'playing' && mode !== 'picking')) return false;
    const ok = game.learn(key);
    if (!ok && game.player.skillPoints > 0) floatAt('Bu seviyede öğrenilemez', game.player.x, 2.2, game.player.z, 'dim');
    return ok;
  }
  spBtn.addEventListener('click', (e) => { e.stopPropagation(); setLearnMode(!learnMode); });
  portraitHit.addEventListener('click', () => openSheet('hero'));
  attrBox.addEventListener('click', () => openSheet('hero'));

  // ------------------------------------------------------------------ geri alma
  let bbOpen = false;
  function showBuyback(info, lost) {
    bbOpen = true;
    bbCost.textContent = fmtNum(info.cost);
    bbLost.textContent = lost ? `Ölüm bedeli: −${fmtNum(lost)} güvenilmez altın` : '';
    buybackEl.hidden = false;
    closeShop(true);
    later(() => { try { bbBtn.focus({ preventScroll: true }); } catch { /* yok say */ } }, 30);
  }
  function hideBuyback() {
    bbOpen = false;
    buybackEl.hidden = true;
  }
  bbBtn.addEventListener('click', () => { if (game.buyback()) { hideBuyback(); focusStage(); } });
  bbGive.addEventListener('click', () => { game.buybackOpen = false; game.dyingT = Math.min(game.dyingT, 0.05); hideBuyback(); });

  // ------------------------------------------------------------------ orman eşyası seçimi
  function showNeutralChoice(choices, tier) {
    clear(ncList);
    choices.forEach((N, i) => {
      const b = h('button', { class: 'ar-nc-item', type: 'button', style: { '--ic': N.color }, 'aria-label': `${N.name}. ${N.desc}` },
        itemImg(N),
        h('span', { class: 'ar-nc-txt' }, h('strong', null, N.name), h('span', { class: 'xsmall' }, N.desc)),
        h('span', { class: 'kbd' }, `F${i + 1}`),
      );
      b.addEventListener('click', (e) => { e.stopPropagation(); pickNeutralChoice(N.id); });
      ncList.appendChild(b);
    });
    ncEl.dataset.tier = String(tier || 1);
    ncEl.hidden = false;
    snd('rune', 0, 1.25);
    say(`Orman sandığı: ${choices.map((N) => N.name).join(', ')}. Birini seç; F1, F2${choices.length > 2 ? ', F3' : ''}.`, true);
  }
  function pickNeutralChoice(id) {
    if (!game || !game.chooseNeutral(id)) return;
    hideNeutralChoice();
    focusStage();
  }
  function hideNeutralChoice() {
    if (!ncEl.hidden) ncEl.hidden = true;
  }

  // ------------------------------------------------------------------ görev hedefleri
  function objText(o) {
    if (o.text) return o.text;
    switch (o.kind) {
      case 'boss': { const id = unitId(o.boss || ''); return id ? `${UNITS[id].name} yenilsin` : 'Boss’u yen'; }
      case 'kill': { const id = o.unit ? unitId(o.unit) : null; return `${o.n} ${id ? UNITS[id].name : o.unit === 'creep' ? 'creep' : 'DOG'} indir`; }
      case 'waves': return `${o.n} dalga temizle`;
      case 'survive': return `${o.t || o.n} sn hayatta kal`;
      case 'runes': return `${o.n} rün topla`;
      case 'camps': return `${o.n} orman kampı temizle`;
      case 'towers': return `${o.n} Dire kulesi yık`;
      case 'protect': return 'Radiant kulelerini koru';
      case 'noDeath': return 'Hiç ölme';
      case 'level': return `${o.n}. seviyeye ulaş`;
      case 'item': return `${ITEMS[o.item] ? ITEMS[o.item].name : o.item} edin`;
      case 'lastHits': return `${o.n} son vuruş`;
      case 'gold': return `${fmtNum(o.n)} altın kazan`;
      case 'time': return `${o.t} sn içinde bitir`;
      default: return o.kind;
    }
  }
  function renderObjectives() {
    const list = game ? game.objectives : [];
    objList.hidden = !list.length || mode === 'start';
    clear(objList);
    const story = run.kind === 'story' && storyMission;
    if (list.length && story) objList.appendChild(h('li', { class: 'ar-obj-head' }, storyMission.name));
    let oi = 0;
    for (const o of list) {
      const n = o.kind === 'survive' ? (o.t || o.n) : o.n;
      const starN = o.optional && story ? (oi += 1) : 0;
      objList.appendChild(h('li', { class: `ar-obj${o.done ? ' done' : ''}${o.failed ? ' failed' : ''}${o.optional ? ' optional' : ''}` },
        h('span', { class: 'ar-obj-box', 'aria-hidden': 'true' }),
        h('span', { class: 'ar-obj-t' }, objText(o), o.optional ? h('em', null, starN && starN <= 2 ? ' (+★)' : ' (bonus)') : null),
        n > 1 && !o.done && !o.failed && o.kind !== 'noDeath' && o.kind !== 'protect' ? h('b', { class: 'num' }, `${o.progress}/${n}`) : null,
      ));
    }
  }
  let campNoteT = 0;
  function campNote() {
    const now = performance.now();
    if (now - campNoteT < 30000) return;
    campNoteT = now;
    feedPush([h('span', { class: 'ar-feed-ico', html: glyph('wolf') }), 'Orman kampları doldu'], '');
  }

  // ------------------------------------------------------------------ akış
  /** which: 'hub' | 'start' (kahraman seçimi) | 'campaign' | 'daily' | 'pause' | 'over' | 'finale' | null */
  function showScreen(which) {
    const w = which === 'select' ? 'start' : which;
    hubScreen.hidden = w !== 'hub';
    startScreen.hidden = w !== 'start';
    campScreen.hidden = w !== 'campaign';
    dailyScreen.hidden = w !== 'daily';
    pauseScreen.hidden = w !== 'pause';
    overScreen.hidden = w !== 'over';
    finaleScreen.hidden = w !== 'finale';
    if (w) talentHost.hidden = true;
    const menuScreen = w === 'hub' || w === 'start' || w === 'campaign' || w === 'daily';
    stage.classList.toggle('has-screen', !!w);
    stage.classList.toggle('on-select', menuScreen);
    stage.classList.toggle('on-menu', menuScreen && w !== 'start');
    if (view && view.setFrame) view.setFrame({ mode: menuScreen ? 'select' : 'play', side: stageW < 760 || stageW / Math.max(1, stageH) < 1.05 ? 'top' : 'right' });
  }

  function focusStage() {
    try { stage.focus({ preventScroll: true }); } catch { /* yok say */ }
  }
  function focusIn(node, sel = 'button:not([disabled]), [href], [tabindex="0"]') {
    later(() => { try { const t = node.querySelector(sel); if (t) t.focus({ preventScroll: true }); } catch { /* yok say */ } }, 30);
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

  // ------------------------------------------------------------------ menüler (merkez · seçim · harita · günlük)
  const heroInfoOf = (id) => { const H = HEROES[id]; return H ? { name: H.name, color: H.color, role: H.role } : { name: id, color: '#43d6a0' }; };
  let userNavigated = false;

  function renderHub() {
    clear(hubGrid);
    let shards = null;
    let codexCounts = null;
    let curse = 0;
    if (prog) {
      try {
        const pr = prog.getProfile();
        shards = pr.shards;
        curse = pr.curse || 0;
        const c = pr.codex && pr.codex.counts;
        if (c) codexCounts = Object.values(c).reduce((a, x) => ({ have: a.have + x.have, total: a.total + x.total }), { have: 0, total: 0 });
      } catch (e) { console.warn('Arena: profil', e); }
    }
    clear(hubPurse).append(icon('shard', { size: 16 }), h('b', { class: 'num' }, shards == null ? '…' : fmtNum(shards)), h('span', null, ' Parıltı'));
    const tile = (cls, o) => {
      const b = h('button', { class: `ar-hub-tile ${cls}`, type: 'button', style: o.color ? { '--tc': o.color } : null, 'aria-label': o.label },
        o.art ? h('span', { class: 'ar-hub-art', style: { backgroundImage: `url("${o.art}")` }, 'aria-hidden': 'true' }) : null,
        h('span', { class: 'ar-hub-ico', 'aria-hidden': 'true', html: o.glyph ? glyph(o.glyph) : '' }, o.icon ? icon(o.icon, { size: 22 }) : null),
        h('span', { class: 'ar-hub-txt' },
          h('span', { class: 'ar-hub-eyebrow' }, o.eyebrow),
          h('strong', { class: 'ar-hub-title' }, o.title),
          o.meta ? h('span', { class: 'ar-hub-meta' }, o.meta) : null,
          o.sub ? h('span', { class: 'ar-hub-sub' }, o.sub) : null,
        ),
        h('span', { class: 'ar-hub-go', 'aria-hidden': 'true' }, icon('arrowRight', { size: 18 })),
      );
      b.addEventListener('click', () => { userNavigated = true; sound.click(); o.onClick(); });
      if (o.prefetch) {
        // tembel parça: fare üstüne gelince / dokununca önceden yükle, tıklayınca harita beklemesin
        const pre = () => { o.prefetch(); b.removeEventListener('pointerenter', pre); b.removeEventListener('touchstart', pre); };
        b.addEventListener('pointerenter', pre);
        b.addEventListener('touchstart', pre, { passive: true });
      }
      return b;
    };
    // Hikâye
    const SP = storyMod ? storyMod.storyProgress() : null;
    const C = storyMod ? storyMod.CHAPTERS[Math.max(0, (SP ? SP.chapter : 1) - 1)] : null;
    const storyArt = artUrl(C ? C.art : 'story-ch1');
    hubGrid.appendChild(tile('is-story', {
      art: storyArt, glyph: 'courier', color: C ? C.color : 'var(--radiant)',
      eyebrow: 'Hikâye · Dokuzun Laneti',
      title: SP && SP.finished ? 'Lanet kırıldı' : C ? `${C.roman}. bölüm · ${C.name}` : 'Beş bölüm, on beş görev',
      meta: SP ? `★ ${SP.stars}/${SP.maxStars} · ${SP.wins}/${SP.total} görev` : 'Kurye anlatıyor: dokuz DOG, bir kahraman.',
      sub: SP && SP.finished ? 'Tüm görevler yeniden oynanabilir: üç yıldızı topla.' : SP && SP.wins ? 'Kaldığın yerden devam et' : 'İlk görev: Kıyıdaki Kurye',
      label: `Hikâye modu: Dokuzun Laneti${SP ? `, ${SP.stars} yıldız, ${SP.wins}/${SP.total} görev` : ''}`,
      onClick: () => openCampaign(null),
      prefetch: () => { loadStoryUi().catch(() => { /* tıklamada yeniden denenir */ }); },
    }));
    // Sonsuz
    const best = bestNow();
    hubGrid.appendChild(tile('is-endless', {
      icon: 'flame', color: 'var(--ember)',
      eyebrow: 'Sonsuz', title: 'Dalga dalga',
      meta: best == null ? 'Henüz skorun yok' : `Rekorun: ${fmtNum(best)} puan`,
      sub: curse ? `Lanet ${curse} · skor ×${(1 + 0.12 * curse).toFixed(2).replace('.', ',')}` : 'Salon skoru · Lanet seçilebilir',
      label: `Sonsuz mod${best == null ? '' : `, rekorun ${fmtNum(best)} puan`}`,
      onClick: () => openSelect('endless'),
    }));
    // Günlük
    const ch = dailyChallenge();
    const DB = dailyBest();
    const DH = HEROES[ch.heroId];
    hubGrid.appendChild(tile('is-daily', {
      glyph: ch.heroId, color: DH ? DH.color : 'var(--aegis)',
      eyebrow: `Günlük · ${ch.dateText}`, title: DH ? DH.name : ch.heroId,
      meta: `Lanet ${ch.curse} · ${ch.mods.map((m) => m.name).join(' · ')}`,
      sub: h('span', null, DB.best ? `Bugün: ${fmtNum(DB.best)} · ` : 'Bugün denemedin · ', 'yenilenme ', h('span', { class: 'ar-cd num' }, fmtCountdown(msToReset()))),
      label: `Günlük meydan okuma: ${DH ? DH.name : ''}, Lanet ${ch.curse}`,
      onClick: () => openDaily(),
    }));
    // Kütüphane · Kodeks
    hubGrid.appendChild(tile('is-lib', {
      icon: 'book', color: 'var(--arcane)',
      eyebrow: 'Aghanim Kütüphanesi', title: 'Kütüphane',
      meta: shards == null ? 'Kahramanlar, çantalar, Lanetler' : `${fmtNum(shards)} Parıltı Taşı`,
      label: 'Aghanim Kütüphanesi', onClick: () => openPanel('library'),
      prefetch: () => { import('./library.js').catch(() => { /* tıklamada yeniden denenir */ }); },
    }));
    hubGrid.appendChild(tile('is-codex', {
      icon: 'compass', color: '#5ab4ff',
      eyebrow: 'Koleksiyon', title: 'Kodeks',
      meta: codexCounts ? `${codexCounts.have}/${codexCounts.total} kayıt` : 'Birimler, bosslar, eşyalar, hikâye',
      label: 'Kodeks', onClick: () => openPanel('codex'),
      prefetch: () => { import('./codex.js').catch(() => { /* tıklamada yeniden denenir */ }); },
    }));
  }

  /** Menü arkasındaki 3D tanıtım sahnesinin kahramanı (günlük ekranında günün kahramanı görünür). */
  function attractHero(id) {
    if (!game || game.state !== 'idle' || !HEROES[id] || game.heroId === id) return;
    game.attract(id);
    applyHeroUi();
    if (view && view.preload) view.preload([HEROES[id].model]);
  }

  function openHub({ persist = true } = {}) {
    menu = 'hub';
    attractHero(save.hero);
    run = { kind: 'endless' };
    renderHub();
    showScreen('hub');
    if (persist) writeUi({ menu: 'hub' });
    focusIn(hubGrid);
  }

  /** Seçim ekranının bağlamı: Sonsuz (Lanet seçici, Rastgele) ya da hikâye görevi (hedefler, önerilen/misafir kahraman). */
  function refreshSelectContext() {
    if (run.kind === 'story' && storyMod && storyMod.isMission(run.missionId)) {
      const id = run.missionId;
      const M = storyMod.MISSIONS[id];
      const C = storyMod.CHAPTER_OF[id];
      const mp = storyMod.storyProgress().missions[id];
      select.setContext({
        kind: 'story', eyebrow: `Hikâye · ${C.roman}. bölüm · ${M.index}. görev · ${M.kicker}`, title: M.name, lead: M.brief,
        goals: storyMod.requiredGoals(id), rec: (M.heroes && M.heroes.rec) || [], guest: (M.heroes && M.heroes.guest) || null,
        startLabel: 'Göreve başla', backLabel: 'Harita', bestText: mp && mp.stars ? `En iyin: ${mp.stars}/3 yıldız` : 'Bu görevde henüz yıldızın yok.',
      });
    } else {
      let random = false;
      try { random = !!(prog && prog.getProfile().unlocks.h_random); } catch { random = false; }
      select.setContext({ kind: 'endless', eyebrow: 'Sonsuz mod · salon skoru', random, startLabel: 'Arenaya gir', backLabel: 'Modlar' });
    }
  }

  function openSelect(kind = 'endless', missionId = null) {
    // kilitli görev (eski oturum kaydı, başka sekmede sıfırlanan ilerleme, elle değiştirilen kayıt) seçime açılmaz: harita
    if (kind === 'story' && storyMod && storyMod.isMission(missionId) && !storyMod.missionUnlocked(missionId)) { openCampaign(null); return; }
    menu = 'select';
    attractHero(save.hero);
    run = kind === 'story' && storyMod && storyMod.isMission(missionId) ? { kind: 'story', missionId } : { kind: 'endless' };
    refreshSelectContext();
    ensureCursePicker();
    select.setHero(save.hero);
    showScreen('start');
    writeUi({ menu: 'select', kind: run.kind, missionId: run.missionId || null });
    later(() => select.focusCurrent(), 30);
  }

  let stopCamp = null;
  function openCampaign(missionId = null) {
    menu = 'campaign';
    attractHero(save.hero);
    run = { kind: 'story', missionId: missionId || (run.kind === 'story' ? run.missionId : null) || null };
    showScreen('campaign');
    writeUi({ menu: 'campaign', missionId: run.missionId });
    if (stopCamp) { stopCamp(); stopCamp = null; }
    clear(campHost).appendChild(h('div', { class: 'view-loading' }, h('div', { class: 'spinner' })));
    loadStoryUi().then((u) => {
      if (!alive || menu !== 'campaign' || (mode !== 'start' && mode !== 'loading')) return;
      clear(campHost);
      stopCamp = u.mountCampaign(campHost, {
        mission: run.missionId, heroId: save.hero, heroInfo: heroInfoOf,
        onPlay: (id) => { sound.click(); openSelect('story', id); },
        onClose: () => { sound.click(); openHub(); },
        onCodex: () => openPanel('codex', 'story'),
      });
    }).catch((e) => {
      console.error(e);
      clear(campHost).appendChild(h('div', { class: 'ar-card' }, h('p', null, 'Hikâye yüklenemedi. Sayfayı yenileyip tekrar dene.')));
    });
  }

  function renderDaily() {
    const ch = run.kind === 'daily' && run.daily && run.daily.day === dailyChallenge().day ? run.daily : dailyChallenge();
    if (run.kind === 'daily') run.daily = ch;
    const H = HEROES[ch.heroId];
    const DB = dailyBest();
    let C = { name: CURSE_TEXT[ch.curse] || '', description: '', scoreMult: 1 + 0.12 * ch.curse };
    try { if (prog && prog.curseInfo) C = prog.curseInfo(ch.curse) || C; } catch { /* yok say */ }
    const guest = !isHeroUnlocked(ch.heroId);
    const back = h('button', { class: 'btn ghost sm', type: 'button' }, icon('arrowLeft', { size: 15 }), 'Modlar');
    back.addEventListener('click', () => { sound.click(); openHub(); });
    const go = h('button', { class: 'btn primary lg ar-daily-go', type: 'button', disabled: !view }, icon('play', { size: 18 }), h('span', null, view ? 'Meydan okumaya gir' : 'Yükleniyor…'));
    go.addEventListener('click', () => startGame());
    const stat = (label, value) => h('div', { class: 'ar-stat' }, h('dt', null, label), h('dd', { class: 'num' }, value));
    clear(dailyBody).append(
      h('div', { class: 'ar-daily-top' }, back, h('span', { class: 'eyebrow' }, `Günlük meydan okuma · ${ch.dateText}`)),
      h('h2', { class: 'ar-daily-title' }, 'Günün koşulları'),
      h('div', { class: 'ar-daily-hero', style: { '--hc': H ? H.color : 'var(--aegis)' } },
        h('span', { class: 'ar-daily-emb', html: glyph(ch.heroId) }),
        h('div', { class: 'ar-daily-htxt' }, h('span', { class: 'xsmall muted' }, 'Günün kahramanı'), h('strong', null, H ? H.name : ch.heroId), h('span', { class: 'xsmall' }, H ? H.role : '')),
        guest ? h('span', { class: 'badge jade' }, icon('unlock', { size: 12 }), 'Bugün misafir') : null,
      ),
      h('ul', { class: 'ar-daily-rules' },
        h('li', { class: 'is-curse' }, icon('skull', { size: 18 }), h('span', null, h('b', null, `Lanet ${ch.curse} · ${C.name}`), h('small', null, `${C.description ? `${C.description} ` : ''}Skor ×${String(Math.round((C.scoreMult || 1 + 0.12 * ch.curse) * 100) / 100).replace('.', ',')}`))),
        ch.mods.map((m) => h('li', null, icon('dice', { size: 18 }), h('span', null, h('b', null, m.name), h('small', null, m.desc)))),
        h('li', { class: 'is-fair' }, icon('shield', { size: 18 }), h('span', null, h('b', null, 'Herkes aynı koşulda'), h('small', null, 'Ustalık bonusu, yetenek varyantları ve özel çantalar kapalı; kozmetik açık. Salon tablosuna yazılmaz: günlük rekorun bu cihazda tutulur.'))),
      ),
      h('dl', { class: 'ar-stats ar-daily-stats' },
        stat('Bugünkü rekor', DB.best ? fmtNum(DB.best) : '—'),
        stat('Deneme', String(DB.runs)),
        stat('Yenilenme', h('span', { class: 'ar-cd' }, fmtCountdown(msToReset()))),
      ),
      h('p', { class: 'xsmall muted ar-daily-note' }, 'Günün ilk koşusu +40 Parıltı Taşı. Meydan okuma İstanbul saatiyle gece yarısı yenilenir.'),
      h('div', { class: 'ar-daily-cta' }, go),
    );
  }

  function openDaily() {
    menu = 'daily';
    run = { kind: 'daily', daily: dailyChallenge() };
    attractHero(run.daily.heroId);
    renderDaily();
    showScreen('daily');
    writeUi({ menu: 'daily' });
    focusIn(dailyBody, '.ar-daily-go:not([disabled]), button');
  }

  // geri sayımlar (merkez ve günlük ekranı): saniyede bir; gün dönünce ekran yenilenir
  let cdDay = dailyChallenge().day;
  const cdTimer = setInterval(() => {
    if (!alive || mode !== 'start' && mode !== 'loading') return;
    const d = dailyChallenge().day;
    if (d !== cdDay) { cdDay = d; if (menu === 'hub') renderHub(); if (menu === 'daily') { run.daily = null; renderDaily(); } return; }
    for (const n of root.querySelectorAll('.ar-cd')) n.textContent = fmtCountdown(msToReset());
  }, 1000);

  // ------------------------------------------------------------------ Kütüphane · Kodeks · ustalık (tembel ekranlar, pencerede)
  /** Açık Kütüphane/Kodeks/ustalık penceresini kapatan işlev (fx.modal body'ye eklenir: bölümden çıkınca da kapanmalı). */
  let closePanel = null;
  function openPanel(kind, arg) {
    if (!alive) return;
    if (!prog) { fx.toast?.('Kalıcı ilerleme yükleniyor, birazdan tekrar dene.', 'ember'); return; }
    if (closePanel) closePanel();
    if (isFs()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document)?.catch?.(() => {}); } catch { /* yok say */ } }
    if (mode === 'playing') pause({ focus: false });
    // Kütüphane/Kodeks/ustalık tembel parçalardır: parça inene kadar boş pencere yerine dönen gösterge
    const spin = h('div', { class: 'ar-panel-loading', role: 'status', 'aria-label': 'Yükleniyor' }, h('div', { class: 'spinner' }));
    const host = h('div', { class: 'ar-panelhost' }, spin);
    const mo = new MutationObserver(() => { if (host.childElementCount > 1 || !host.contains(spin)) { spin.remove(); mo.disconnect(); } });
    mo.observe(host, { childList: true });
    let inner = null;
    const label = kind === 'library' ? 'Aghanim Kütüphanesi' : kind === 'codex' ? 'Kodeks' : 'Kahraman ustalığı';
    const close = fx.modal(host, {
      label, cls: `arl-modal ar-modal-${kind}`,
      onClose: () => { mo.disconnect(); if (closePanel === close) closePanel = null; try { if (inner) inner(); } catch { /* yok say */ } inner = null; afterPanel(); },
    });
    closePanel = close;
    try {
      if (kind === 'library') inner = prog.mountLibrary(host, { branch: arg, onClose: close, onCodex: () => { close(); openPanel('codex'); } });
      else if (kind === 'codex') inner = prog.mountCodex(host, { kind: arg, onClose: close });
      else inner = prog.mountHeroMastery(host, arg || save.hero, { onClose: close, onLibrary: () => { close(); openPanel('library', 'heroes'); } });
    } catch (e) { console.error(e); close(); }
    sound.click();
  }
  function afterPanel() {
    if (!alive) return;
    // fx.modal odağı pencereyi açan düğmeye geri verir; merkez yeniden çizilince o düğme DOM'dan çıkıyordu (odak
    // body'ye düşüyordu): aynı kutucuğu yeniden odakla
    const a = document.activeElement;
    const tileKey = a && hubGrid.contains(a) ? [...a.classList].find((c) => c.startsWith('is-')) : null;
    select.refresh();
    refreshSelectContext();
    if (mode === 'start' && menu === 'hub') renderHub();
    if (mode === 'start' && menu === 'daily') renderDaily();
    if (tileKey && menu === 'hub') { try { hubGrid.querySelector(`.ar-hub-tile.${tileKey}`)?.focus({ preventScroll: true }); } catch { /* yok say */ } }
  }

  // ------------------------------------------------------------------ hikâye diyalogları
  let dlg = null;
  let storyMission = null;
  const firedTriggers = new Set();
  let pendingTalk = [];
  // her talk() çağrısı bir sıra numarası alır: yerine yenisi açılan (ya da koşu yeniden başlayınca kapanan) eski diyaloğun
  // sözü çözülünce leaveTalk() yeni diyaloğun üstünde oyunu sürdürmesin
  let talkSeq = 0;
  let runSeq = 0; // her startGame bir artırır (eski koşunun gecikmeli işleri kendini tanır)
  /** Görev içi diyalog açıkken duraklatıldı mı? (sürdürünce aynı karta dönülür) */
  let pausedTalk = false;
  const canPauseTalk = () => mode === 'talk' && !!(dlg && dlg.open) && !!game && (game.state === 'playing' || game.state === 'break');
  function setTalkPaused(v) {
    pausedTalk = !!v;
    talkHost.classList.toggle('is-paused', pausedTalk);
  }
  function ensureDlg(u) {
    if (dlg) return dlg;
    dlg = u.createDialogue(talkHost, {
      heroInfo: heroInfoOf,
      onSeen: (id) => { try { if (prog && prog.markSeen) prog.markSeen('story', id); } catch { /* yok say */ } },
    });
    return dlg;
  }
  function enterTalk() {
    mode = 'talk';
    keys.clear();
    game.chargeCancel();
    resetTouch();
    setLearnMode(false);
    closeShop(true);
    stage.classList.remove('is-playing');
    stage.classList.add('in-talk');
  }
  function leaveTalk() {
    stage.classList.remove('in-talk');
    if (!alive || mode !== 'talk' || game.state === 'over') return;
    mode = 'playing';
    stage.classList.add('is-playing');
    focusStage();
  }
  function talkCue(c) {
    if (!c) return;
    if (c.who === 'kurye') snd('courier', 0, 1.15);
    else if (c.who && c.who.startsWith('dog:')) snd('bark', 0, 1.2);
    else if (c.who && c.who !== 'hero' && !c.who.startsWith('hero:')) snd('roar', 0, 1.25);
  }
  /**
   * Diyalog kartlarını oynat; açıkken simülasyon durur (mode 'talk'). resume: oyun sürüyorsa bitince devam et.
   * → Promise<'done'|'skip'>
   */
  function talk(cards, resume) {
    if (!cards || !cards.length) return Promise.resolve('done');
    const seq = ++talkSeq;
    setTalkPaused(false);
    if (resume) enterTalk(); else { mode = 'talk'; stage.classList.remove('is-playing'); }
    return loadStoryUi().then((u) => {
      if (!alive || seq !== talkSeq) return 'skip';
      ensureDlg(u);
      talkCue(cards[0]);
      say(`Diyalog: ${cards.length} kart. Enter ya da Boşluk ile ilerle, Esc ile atla, P ile duraklat.`, true);
      return dlg.play(cards, { heroId: game.heroId });
    }).then((how) => { if (resume && seq === talkSeq) leaveTalk(); return how; });
  }
  /** Açık diyaloğu kapat ve bekleyen talk() zincirlerini geçersiz kıl (yeni koşu / menü). */
  function dropTalk() {
    talkSeq += 1;
    pendingTalk = [];
    setTalkPaused(false);
    if (dlg) dlg.close();
    stage.classList.remove('in-talk');
  }
  /** Oyun olayı görev içi bir diyaloğu tetikliyor mu? (story.js triggerMatches) */
  function storyEvent(type, d) {
    if (run.kind !== 'story' || !storyMission || !storyMod || !game || game.state === 'over') return;
    const T = (storyMission.dialogue && storyMission.dialogue.triggers) || [];
    for (let i = 0; i < T.length; i++) {
      if (firedTriggers.has(i) || !storyMod.triggerMatches(T[i], type, d)) continue;
      firedTriggers.add(i);
      pendingTalk.push(...T[i].cards);
    }
  }
  function flushTalk() {
    if (!pendingTalk.length || mode !== 'playing' || bbOpen || !(game.state === 'playing' || game.state === 'break')) return;
    const cards = pendingTalk;
    pendingTalk = [];
    talk(cards, true);
  }

  /**
   * Koşu başlat. Türü `run` belirler: Sonsuz (seçili kahraman), hikâye görevi (story.storyRunConfig) ya da günlük
   * (daily.dailyRunConfig). extra: ek runConfig alanları. progression.js varsa applyMeta uygulanır.
   */
  function startGame(extra = {}) {
    if (!view) return;
    const ex = extra && typeof extra === 'object' && !(extra instanceof Event) ? extra : {};
    const { devMeta, ...rest } = ex;
    let base;
    if (run.kind === 'story') {
      if (!storyMod || !storyMod.isMission(run.missionId)) { openCampaign(null); return; }
      if (!storyMod.missionUnlocked(run.missionId) && !(import.meta.env.DEV && run.dev)) {
        fx.toast?.('Bu görev henüz kilitli: haritadan sıradaki görevi seç.', 'ember');
        if (mode === 'start' || mode === 'loading') openCampaign(null); else toMenu('campaign');
        return;
      }
      if (!select.allowed(save.hero)) { fx.toast?.(`${heroOf(save.hero).name} kilitli. Aghanım Kütüphanesi’nden açılır.`, 'ember'); return; }
      base = storyMod.storyRunConfig(run.missionId, save.hero);
    } else if (run.kind === 'daily') {
      if (!run.daily || run.daily.day !== dailyChallenge().day) run.daily = dailyChallenge();
      base = dailyRunConfig(run.daily);
    } else {
      if (!isHeroUnlocked(save.hero)) { fx.toast?.(`${heroOf(save.hero).name} kilitli. Aghanım Kütüphanesi’nden açılır.`, 'ember'); return; }
      // allowLocked: kilit kapısı yukarıda geçildi (profil ya da geliştirici kilidi); applyMeta başka kahramana düşmesin
      base = { mode: 'endless', heroId: save.hero, allowLocked: true };
    }
    if (overLb) { overLb(); overLb = null; }
    clearOver();
    keys.clear();
    let cfg = { meta: null, mission: null, waves: null, objectives: [], modifiers: {}, ...base, ...rest };
    if (prog && typeof prog.applyMeta === 'function') {
      try { cfg = prog.applyMeta(cfg) || cfg; } catch (e) { console.warn('Arena: applyMeta', e); }
    }
    if (cfg.curse == null) cfg.curse = 0;
    // yalnızca geliştirme testleri: Kütüphane profili olmadan varyant/havuz/kozmetik denemek için
    if (import.meta.env.DEV && devMeta && typeof devMeta === 'object') cfg.meta = { ...(cfg.meta || {}), ...devMeta };
    game.autoSkill = autoLearn;
    lastRunEnd = null;
    runSeq += 1;
    dropTalk();
    firedTriggers.clear();
    storyMission = run.kind === 'story' ? storyMod.MISSIONS[run.missionId] : null;
    game.start(cfg);
    setLearnMode(false);
    applyHeroUi();
    mode = 'playing';
    stage.classList.add('is-playing');
    closeShop(true);
    showScreen(null);
    renderObjectives();
    focusStage();
    scrollStageIntoView();
    acc = 0;
    sound.click();
    if (storyMission) {
      const prep = cfg.mission && cfg.mission.prep > 0;
      const sm = storyMission;
      const mid = run.missionId;
      const myRun = runSeq;
      talk(sm.dialogue.intro, true).then(() => {
        // yeniden başlatılan / menüye dönülen koşunun eski giriş diyaloğu burada durur
        if (!alive || mode !== 'playing' || runSeq !== myRun) return;
        say(`${sm.name}. Hedef: ${storyMod.requiredGoals(mid).join(', ')}.`, true);
        // hazırlık molası: başlangıç seviyesi yetenek ağacı seçimi bekliyorsa önce o (kapanınca dükkân açılır)
        if (prep && game.state === 'break') later(() => {
          if (mode !== 'playing' || game.state !== 'break' || shop.open) return;
          if (game.player.talentPending.length) openTalents();
          else if (autoShop) openShop();
        }, 250);
      });
    }
  }

  function pause({ focus = true } = {}) {
    // görev içi diyalogda da duraklatılabilir (diyalog gizlenir, sürdürünce aynı karta dönülür); çıkış diyaloğunda değil
    const fromTalk = canPauseTalk();
    if (mode !== 'playing' && !fromTalk) return;
    if (fromTalk) setTalkPaused(true);
    mode = 'paused';
    keys.clear();
    game.chargeCancel();
    resetTouch();
    menuBtnLbl.textContent = run.kind === 'story' ? 'Haritaya dön' : run.kind === 'daily' ? 'Menü' : 'Kahraman seç';
    showScreen('pause');
    stage.classList.remove('is-playing');
    say('Oyun duraklatıldı.', true);
    if (focus) later(() => { try { resumeBtn.focus({ preventScroll: true }); } catch { /* yok say */ } }, 30);
  }

  function resume() {
    if (mode !== 'paused') return;
    if (pausedTalk && dlg && dlg.open) {
      setTalkPaused(false);
      mode = 'talk';
      showScreen(null);
      later(() => { try { talkHost.querySelector('.ars-talk-next')?.focus({ preventScroll: true }); } catch { /* yok say */ } }, 30);
      sound.click();
      return;
    }
    setTalkPaused(false);
    mode = 'playing';
    showScreen(null);
    stage.classList.add('is-playing');
    focusStage();
    sound.click();
  }

  /**
   * Menüye dön. target: 'hub' | 'select' (Sonsuz seçimi) | 'story' (görev seçimi) | 'campaign' | 'daily';
   * verilmezse koşunun türüne göre (hikâye → harita, günlük → merkez, Sonsuz → kahraman seçimi).
   */
  function toMenu(target) {
    if (overLb) { overLb(); overLb = null; }
    clearOver();
    runSeq += 1;
    dropTalk();
    setLearnMode(false);
    hideBuyback();
    hideNeutralChoice();
    mode = 'start';
    stage.classList.remove('is-playing', 'in-talk');
    closeShop(true);
    game.attract(save.hero);
    applyHeroUi();
    select.setHero(save.hero);
    refreshBest();
    const t = typeof target === 'string' ? target : run.kind === 'story' ? 'campaign' : run.kind === 'daily' ? 'hub' : 'select';
    if (t === 'campaign') openCampaign(run.missionId || null);
    else if (t === 'hub') openHub();
    else if (t === 'daily') openDaily();
    else if (t === 'story') openSelect('story', run.missionId);
    else openSelect('endless');
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

  // ------------------------------------------------------------------ koşu sonu (Sonsuz · hikâye · günlük)
  let stopRewards = null;
  let stopFinale = null;
  function clearOver() {
    if (stopRewards) { try { stopRewards(); } catch { /* yok say */ } stopRewards = null; }
    if (stopFinale) { try { stopFinale(); } catch { /* yok say */ } stopFinale = null; }
  }
  /** madde 4: grantRunRewards sonucunu ödül kartıyla göster (progression.mountRunRewards, tembel). */
  function mountRewards(host, rewards) {
    if (!rewards || !prog || typeof prog.mountRunRewards !== 'function') return;
    const wrap = h('div', { class: 'ar-card ar-rewards' });
    host.appendChild(wrap);
    try { stopRewards = prog.mountRunRewards(wrap, rewards, { onLibrary: () => openPanel('library'), onHero: (id) => openPanel('mastery', id) }); } catch (e) { console.warn('Arena: mountRunRewards', e); }
  }
  function grant(extra, r) {
    if (!prog || typeof prog.grantRunRewards !== 'function') return null;
    const base = lastRunEnd || { mode: r.mode, score: r.score, wave: r.wave, heroId: r.heroId, stats: r, victory: r.victory, objectives: r.objectives, curse: r.curse };
    try { return prog.grantRunRewards({ ...base, ...extra }); } catch (e) { console.warn('Arena: grantRunRewards', e); return null; }
  }
  /** Tüm modlar: durum, yerel sayaçlar, profil seçimleri (Roshan/boss rozetleri her modda sayılır). */
  function commonOver(r, endless) {
    mode = 'over';
    pendingTalk = [];
    stage.classList.remove('is-playing', 'in-talk');
    keys.clear();
    resetTouch();
    closeShop(true);
    clearOver();
    save.runs += 1;
    save.roshans += r.roshans || 0;
    persist();
    try {
      store.me.patch((dd) => {
        if (!dd.picks) dd.picks = {};
        const P = dd.picks;
        if (endless && !(Number(P[`arena:h:${r.heroId}`]) >= r.score)) P[`arena:h:${r.heroId}`] = r.score;
        if (r.roshans) P['arena:roshan'] = (Number(P['arena:roshan']) || 0) + r.roshans;
        if (r.bosses) P['arena:boss'] = (Number(P['arena:boss']) || 0) + r.bosses;
        if (endless && !(Number(P['arena:dalga']) >= r.wave)) P['arena:dalga'] = r.wave;
      });
    } catch { /* yok say */ }
  }
  const statEl = (label, value, cls = '') => h('div', { class: `ar-stat ${cls}` }, h('dt', null, label), h('dd', { class: 'num' }, value));
  const reportBtn = (label, ic, primary, fn) => {
    const b = h('button', { class: `btn ${primary ? 'primary lg' : 'ghost'}`, type: 'button' }, icon(ic, { size: primary ? 18 : 16 }), label);
    b.addEventListener('click', fn);
    return b;
  };
  function showOver(first) {
    showScreen('over');
    refreshBest();
    later(() => { try { first.focus({ preventScroll: true }); } catch { /* yok say */ } }, 60);
  }

  function gameOver(r) {
    if (run.kind === 'story' && storyMod && storyMod.isMission(run.missionId)) { storyOver(r); return; }
    if (run.kind === 'daily') { dailyOver(r); return; }
    endlessOver(r);
  }

  function endlessOver(r) {
    const prev = bestNow();
    const prevHero = bestFor(r.heroId);
    commonOver(r, true);
    let better = false;
    // Salon skor tablosu yalnızca Sonsuz modun puanıdır (scores.arena)
    try { better = store.me.submitScore(GAME_ID, r.score); } catch { /* yok say */ }
    const rewards = grant({ mode: 'endless' }, r);
    // kahraman başına en iyi skor (yerel, sürümlü)
    if (prevHero == null || r.score > prevHero) { save.bests[r.heroId] = r.score; persist(); }
    snd('lose', 0);
    const H = heroOf(r.heroId);
    const pct = Math.round(r.acc * 100);
    const topD = r.topType ? archOf(r.topType) : null;
    const stat = statEl;
    clear(overBody);
    const again = reportBtn('Tekrar oyna', 'refresh', true, () => startGame());
    const change = reportBtn('Kahraman değiştir', 'arrowLeft', false, () => toMenu('select'));
    const hubB = reportBtn('Menü', 'grid', false, () => toMenu('hub'));
    const heroBest = bestFor(r.heroId);
    overBody.append(h('div', { class: 'ar-card ar-report', style: { '--hc': H.color } },
      h('div', { class: 'ar-report-head' },
        h('span', { class: 'eyebrow' }, 'Maç sonu raporu · Sonsuz'),
        better ? h('span', { class: 'badge gold' }, icon('crown', { size: 12 }), prev == null ? 'İlk skor' : 'Yeni rekor') : (prevHero == null || r.score > prevHero) ? h('span', { class: 'badge jade' }, icon('star', { size: 12 }), `${H.name} rekoru`) : null,
      ),
      h('div', { class: 'ar-report-hero' },
        h('span', { class: 'ar-report-emb', html: glyph(H.id) }),
        h('div', null,
          h('h2', { class: 'ar-report-title' }, r.wave >= 5 ? `GG, efsane ${H.name}` : 'Sürü seni yakaladı'),
          h('span', { class: 'xsmall muted' }, `${H.name} · Seviye ${r.level} · ${fmtNum(r.gold)} altın kazanıldı${r.curse ? ` · Lanet ${r.curse}` : ''}`),
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
        stat('Kamp', String(r.camps || 0)),
        stat('Boss', String(r.bosses || 0)),
        stat('Deny', String(r.denies || 0)),
        stat('Geri alma', String(r.buybacks || 0)),
        stat(`${H.name} rekoru`, fmtNum(heroBest ?? r.score)),
        stat('Genel rekor', fmtNum(bestNow() ?? r.score)),
      ),
      r.items.length || r.neutral ? h('div', { class: 'ar-report-items' }, h('span', { class: 'xsmall dim' }, 'Envanter'), h('div', { class: 'ar-report-inv' }, r.items.map((id) => (ITEMS[id] ? h('span', { class: 'ar-report-item', title: ITEMS[id].name }, itemImg(ITEMS[id])) : null)), r.neutral && NEUTRALS[r.neutral] ? h('span', { class: 'ar-report-item neutral', title: `Orman: ${NEUTRALS[r.neutral].name}` }, itemImg(NEUTRALS[r.neutral])) : null)) : null,
      topD ? h('div', { class: 'ar-top-kill', style: { '--tc': topD.color } },
        portraitEl(topD, { cls: 'ar-top-kill-img', alt: '' }),
        h('div', null, h('span', { class: 'xsmall dim' }, 'En çok indirilen tür'), h('strong', null, `${topD.name} × ${r.topN}`)),
      ) : null,
      h('p', { class: 'ar-quip' }, '“', quipFor(r), '”'),
      h('div', { class: 'row ar-report-btns' }, again, change, hubB),
    ));
    if (overLb) overLb();
    clear(overLbHost);
    mountRewards(overLbHost, rewards);
    const lbWrap = h('div');
    overLbHost.appendChild(lbWrap);
    overLb = mountLeaderboard(lbWrap, { gameId: GAME_ID, title: 'Arena Efsaneleri', format: (n) => `${fmtNum(n)} puan` });
    say(`Oyun bitti. ${H.name}, dalga ${r.wave}, skor ${fmtNum(r.score)}, ${r.kills} öldürme.${rewards ? ` ${rewards.shards} Parıltı Taşı.` : ''}`, true);
    showOver(again);
  }

  // ------------------------------------------------------------------ hikâye görevi sonu
  /** Bölüm ödülleri kayıtla uyumlu mu? (bölüm bitti ama ödül/ilerleme kaydı eksikse tamamla — ör. içe aktarılan profil) */
  function reconcileStory() {
    if (!prog || !storyMod) return;
    try {
      const SP = storyMod.storyProgress();
      for (const cp of SP.chapters) {
        if (!cp.done) continue;
        prog.recordStoryChapter(cp.n);
        const R = storyMod.CHAPTERS[cp.n - 1].reward;
        if (R && R.hero && !SP.rewards[`hero_${R.hero}`] && storyMod.markReward(`hero_${R.hero}`)) prog.unlockHero(R.hero, { free: true, source: `bolum${cp.n}` });
      }
    } catch (e) { console.warn('Arena: hikâye kaydı', e); }
  }

  function storyOver(r) {
    commonOver(r, false);
    const S = storyMod;
    const id = run.missionId;
    const M = S.MISSIONS[id];
    const C = S.CHAPTER_OF[id];
    const end = lastRunEnd || { mode: 'story', victory: !!r.victory, objectives: r.objectives };
    const victory = !!end.victory;
    const stars = S.starsFor(id, end);
    const rec = S.recordMission(id, { victory, stars, time: r.time });
    const rewards = grant({ mode: 'story', missionId: id, stars }, r);
    // madde 5: bölüm ilk kez bitti → recordStoryChapter (+50 Parıltı, rozet seçimi) ve bölüm ödülü kahraman
    let chapter = null;
    let heroGift = null;
    if (rec && rec.chapterDone) {
      try { chapter = prog ? prog.recordStoryChapter(rec.chapterDone) : null; } catch (e) { console.warn('Arena: recordStoryChapter', e); }
      const R = C.reward;
      if (R && R.hero && prog && S.markReward(`hero_${R.hero}`)) {
        try { const u = prog.unlockHero(R.hero, { free: true, source: `bolum${rec.chapterDone}` }); heroGift = { id: R.hero, ok: !!u.ok, owned: u.reason === 'owned' }; } catch (e) { console.warn('Arena: unlockHero', e); }
        select.refresh();
      }
    }
    const info = { r, id, M, C, rec, stars, victory, end, rewards, chapter, heroGift };
    if (victory) {
      snd('win', 0);
      const myRun = runSeq;
      const still = () => alive && runSeq === myRun; // bu arada yeni koşu/menü açıldıysa rapor çizilmez
      talk(M.dialogue.win, false).then(() => {
        if (!still()) return;
        if (rec && rec.finale) {
          try { sound.record(); } catch { /* yok say */ }
          talk(S.FINALE.cards, false).then(() => { if (still()) showFinale(() => { if (still()) storyReport(info); }); });
        } else storyReport(info);
      });
    } else {
      snd('lose', 0);
      storyReport(info);
    }
  }

  function showFinale(next) {
    mode = 'over';
    clear(finaleScreen);
    showScreen('finale');
    loadStoryUi().then((u) => {
      if (!alive) return;
      const SP = storyMod.storyProgress();
      stopFinale = u.mountFinale(finaleScreen, {
        stars: SP.stars, maxStars: SP.maxStars, menuLabel: 'Devam',
        onMenu: () => { sound.click(); if (stopFinale) { stopFinale(); stopFinale = null; } next(); },
        onCodex: () => openPanel('codex', 'story'),
      });
    });
  }

  function storyReport(info) {
    const { r, id, M, C, rec, stars, victory, rewards, chapter, heroGift } = info;
    mode = 'over';
    const H = heroOf(r.heroId);
    clear(overBody);
    const next = victory && rec && rec.next ? reportBtn('Sonraki görev', 'arrowRight', true, () => { run = { kind: 'story', missionId: rec.next }; toMenu('story'); }) : null;
    const again = reportBtn(victory ? 'Tekrar oyna' : 'Tekrar dene', 'refresh', !next, () => startGame());
    const map = reportBtn('Harita', 'flag', false, () => toMenu('campaign'));
    const objs = (info.end.objectives || r.objectives || []);
    const objById = Object.fromEntries((storyMod.missionConfig(id).objectives || []).map((o) => [o.id, o]));
    const optIds = objs.filter((x) => x.optional).map((x) => x.id);
    const starEls = [1, 2, 3].map((i) => h('span', { class: `ar-sr-star${i <= stars ? ' on' : ''}${rec && i > rec.prevStars && i <= stars ? ' new' : ''}`, style: { '--i': String(i) }, html: glyph('star') }));
    const quote = victory ? (M.dialogue.win[M.dialogue.win.length - 1] || {}).text : M.dialogue.lose;
    overBody.append(h('div', { class: `ar-card ar-report ar-sreport${victory ? ' won' : ' lost'}`, style: { '--hc': C.color } },
      h('div', { class: 'ar-report-head' },
        h('span', { class: 'eyebrow' }, `Hikâye · ${C.roman}. bölüm · ${M.index}. görev`),
        rec && rec.firstWin ? h('span', { class: 'badge gold' }, icon('crown', { size: 12 }), 'İlk zafer') : rec && rec.newStars ? h('span', { class: 'badge jade' }, icon('star', { size: 12 }), 'Yeni yıldız') : null,
      ),
      h('div', { class: 'ar-report-hero' },
        h('span', { class: 'ar-report-emb', style: { '--hc': H.color }, html: glyph(H.id) }),
        h('div', null,
          h('h2', { class: 'ar-report-title' }, victory ? 'Görev tamam!' : 'Görev başarısız'),
          h('span', { class: 'ar-sr-name' }, M.name),
        ),
      ),
      h('div', { class: 'ar-sr-stars', role: 'img', 'aria-label': `${stars}/3 yıldız` }, starEls),
      h('ul', { class: 'ar-sr-objs', 'aria-label': 'Hedefler' }, objs.map((o) => {
        const def = objById[o.id] || {};
        const st = o.done && !o.failed ? 'done' : o.failed ? 'failed' : 'open';
        return h('li', { class: `ar-sr-obj ${st}${o.optional ? ' optional' : ''}` },
          h('span', { class: 'ar-sr-obj-i', 'aria-hidden': 'true' }, st === 'done' ? icon('check', { size: 14 }) : st === 'failed' ? icon('cross', { size: 14 }) : null),
          h('span', null, def.text || objText({ ...def, ...o }), o.optional ? h('em', null, optIds.indexOf(o.id) < 2 ? ' · +1 yıldız' : ' · bonus') : null),
          h('span', { class: 'sr-only' }, st === 'done' ? 'tamam' : st === 'failed' ? 'kaçtı' : 'yapılmadı'),
        );
      })),
      h('dl', { class: 'ar-stats ar-sr-stats' },
        statEl('Süre', fmtT(r.time)),
        statEl('Öldürme', String(r.kills)),
        statEl('Seviye', String(r.level)),
        statEl('Son vuruş', String(r.lastHits)),
      ),
      quote ? h('p', { class: 'ar-quip' }, h('b', null, 'Kurye: '), '“', quote, '”') : null,
      h('div', { class: 'row ar-report-btns' }, next, again, map),
    ));
    // sağ sütun: bölüm ödülü + Parıltı kartı
    if (overLb) { overLb(); overLb = null; }
    clear(overLbHost);
    if (rec && rec.chapterDone) {
      const gift = heroGift && heroGift.id ? HEROES[heroGift.id] : null;
      overLbHost.appendChild(h('div', { class: 'ar-card ar-chapdone', style: { '--hc': C.color } },
        h('span', { class: 'eyebrow' }, `${C.roman}. bölüm tamamlandı`),
        h('strong', { class: 'ar-chapdone-t' }, C.name),
        chapter && chapter.shards ? h('span', { class: 'ar-chapdone-s' }, icon('shard', { size: 14 }), `Bölüm ödülü +${chapter.shards} Parıltı`) : null,
        gift ? h('div', { class: 'ar-chapdone-hero', style: { '--hc': gift.color } }, h('span', { class: 'ar-report-emb', html: glyph(gift.id) }),
          h('span', null, heroGift.ok ? h('b', null, `${gift.name} artık seninle!`) : h('b', null, `${gift.name} zaten seninleydi.`), h('small', null, heroGift.ok ? ' Kahraman seçiminde kilidi açıldı.' : ' Bölüm ödülü kayda geçti.'))) : null,
      ));
      try { sound.record(); } catch { /* yok say */ }
    }
    mountRewards(overLbHost, rewards);
    say(`${victory ? 'Görev tamam' : 'Görev başarısız'}: ${M.name}. ${stars} yıldız.${rec && rec.chapterDone ? ` ${C.roman}. bölüm tamamlandı.` : ''}`, true);
    if (victory && !reduced) {
      starEls.forEach((el, i) => { if (i < stars) later(() => { el.classList.add('pop'); snd('good', 0); }, 350 + i * 260); });
    }
    showOver(next || again);
  }

  // ------------------------------------------------------------------ günlük meydan okuma sonu
  function dailyOver(r) {
    commonOver(r, false);
    const ch = run.daily || dailyChallenge();
    const res = recordDaily({ day: ch.day, score: r.score, wave: r.wave, heroId: r.heroId });
    const rewards = grant({ mode: 'daily', day: ch.day }, r);
    snd(res.isBest ? 'win' : 'lose', 0);
    const H = heroOf(r.heroId);
    clear(overBody);
    const again = reportBtn('Tekrar dene', 'refresh', true, () => startGame());
    const hubB = reportBtn('Menü', 'grid', false, () => toMenu('hub'));
    overBody.append(h('div', { class: 'ar-card ar-report', style: { '--hc': H.color } },
      h('div', { class: 'ar-report-head' },
        h('span', { class: 'eyebrow' }, `Günlük meydan okuma · ${ch.dateText}`),
        res.isBest ? h('span', { class: 'badge gold' }, icon('crown', { size: 12 }), res.prev ? 'Yeni günlük rekor' : 'Günün ilk skoru') : null,
      ),
      h('div', { class: 'ar-report-hero' },
        h('span', { class: 'ar-report-emb', html: glyph(H.id) }),
        h('div', null,
          h('h2', { class: 'ar-report-title' }, res.isBest ? 'Günün rekoru!' : r.wave >= 5 ? `GG, ${H.name}` : 'Sürü bugün kazandı'),
          h('span', { class: 'xsmall muted' }, `${H.name} · Lanet ${ch.curse}${ch.mods.length ? ` · ${ch.mods.map((m) => m.name).join(' · ')}` : ''}`),
        ),
      ),
      h('dl', { class: 'ar-stats' },
        statEl('Skor', fmtNum(r.score), 'gold big'),
        statEl('Dalga', String(r.wave)),
        statEl('Öldürme', String(r.kills)),
        statEl('Bugünkü rekor', fmtNum(res.best)),
        statEl('Deneme', String(res.runs)),
        statEl('Yenilenme', h('span', { class: 'ar-cd' }, fmtCountdown(msToReset()))),
      ),
      h('p', { class: 'ar-quip' }, '“', res.isBest ? 'Bugünün tahtası senin. Yarın aynı koşullar başka biriyle; sen yine gel.' : quipFor(r), '”'),
      h('div', { class: 'row ar-report-btns' }, again, hubB),
    ));
    if (overLb) { overLb(); overLb = null; }
    clear(overLbHost);
    mountRewards(overLbHost, rewards);
    say(`Günlük meydan okuma bitti. Skor ${fmtNum(r.score)}, bugünkü rekorun ${fmtNum(res.best)}.`, true);
    showOver(again);
  }

  resumeBtn.addEventListener('click', resume);
  restartBtn.addEventListener('click', startGame);
  menuBtn.addEventListener('click', toMenu);
  pauseBtn.addEventListener('click', () => { if (mode === 'playing' || canPauseTalk()) pause(); else if (mode === 'paused') resume(); });
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
  const heroCharges = () => targetingOf(game, 'q') === 'charge';

  function keyOf(code) {
    const S = SCHEMES[scheme];
    if (codeIn(code, S.q)) return 'q';
    if (codeIn(code, S.w) || code === 'KeyW') return 'w';
    if (codeIn(code, S.e)) return 'e';
    if (codeIn(code, S.r)) return 'r';
    return null;
  }
  function onKeyDown(e) {
    if (!alive) return;
    if (isTyping(e.target)) return;
    if (document.querySelector('.modal-backdrop')) return;
    const code = e.code;
    // hikâye diyaloğu açıkken: Boşluk/Enter ilerlet, Esc atla; oyun tuşları işlenmez
    if (mode === 'talk') {
      if (code === 'KeyP' && !e.ctrlKey && !e.metaKey && !e.altKey && canPauseTalk()) { e.preventDefault(); pause(); return; }
      if (dlg && dlg.key(e)) return;
      if (code === 'Escape' || code === 'Space' || code === 'Enter') e.preventDefault();
      return;
    }
    // Ctrl + Q/E/R (WASD düzeninde W = Ctrl+Boşluk): yetenek öğren (Dota'daki gibi). Ctrl+W tarayıcıya ayrılmıştır.
    if (e.ctrlKey && !e.metaKey && !e.altKey && (mode === 'playing' || mode === 'picking')) {
      const k = code === 'KeyW' ? null : keyOf(code);
      if (k) { e.preventDefault(); learnKey(k); if (mode === 'picking') renderSheet(); return; }
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tgt = e.target;
    if ((code === 'Space' || code === 'Enter') && tgt && tgt.tagName === 'BUTTON') return;
    if (mode === 'picking') {
      const pend = game.player.talentPending[0];
      if ((code === 'Digit1' || code === 'Numpad1') && pend) { e.preventDefault(); chooseTalent(pend, 0); }
      else if ((code === 'Digit2' || code === 'Numpad2') && pend) { e.preventDefault(); chooseTalent(pend, 1); }
      else if (code === 'Escape' || code === 'KeyT' || code === 'KeyC') { e.preventDefault(); closeSheet(); }
      else {
        const k = keyOf(code);
        if (k) { e.preventDefault(); if (!e.repeat) { learnKey(k); renderSheet(); } }
      }
      return;
    }
    if (mode === 'playing') {
      if (bbOpen && (code === 'Enter' || code === 'NumpadEnter')) { e.preventDefault(); bbBtn.click(); return; }
      if (game.neutralOffer && (code === 'F1' || code === 'F2' || code === 'F3')) {
        e.preventDefault();
        const id = game.neutralOffer.choices[Number(code[1]) - 1];
        if (id) pickNeutralChoice(id);
        return;
      }
      if (code === 'Escape' || code === 'KeyP') {
        e.preventDefault();
        if (code === 'Escape' && learnMode) { setLearnMode(false); return; }
        if (code === 'Escape' && shop.open) { closeShop(); return; }
        pause();
        return;
      }
      if (code === 'KeyB' || code === 'F4') { e.preventDefault(); toggleShop(); return; }
      if (code === 'KeyT') { e.preventDefault(); openSheet(game.player.talentPending.length ? 'talents' : 'hero'); return; }
      if (code === 'KeyC') { e.preventDefault(); openSheet('hero'); return; }
      if (code === 'KeyL') { e.preventDefault(); if (!e.repeat) setLearnMode(!learnMode); return; }
      if (code === 'Enter' && game.state === 'break') { e.preventDefault(); readyUp(); return; }
      const ii = ITEM_CODES.findIndex((c) => c.includes(code));
      if (ii >= 0) { e.preventDefault(); if (!e.repeat) game.useItem(ii); return; }
      const S = SCHEMES[scheme];
      if (learnMode) {
        const k = keyOf(code) && !(scheme === 'wasd' && code === 'KeyW') ? keyOf(code) : null;
        if (k) { e.preventDefault(); if (!e.repeat) learnKey(k); return; }
      }
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
      if (code === 'Enter' && !onButton && stageVisible && finaleScreen.hidden && (mode === 'over' || menu === 'select')) { e.preventDefault(); startGame(); }
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
    if (f) { game.focus = f; game.player.aimX = f.x; game.player.aimZ = f.z; return; }
    // kule: Dire kulesine saldır ya da canı düşük kendi kuleni deny et
    for (const t of game.towers) {
      if (t.dead || Math.hypot(t.x - gp.x, t.z - gp.z) > 1.5) continue;
      if (t.side === 'dire' || t.hp <= t.maxHp * 0.12) game.focus = t;
    }
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
    const targeting = () => targetingOf(game, key);
    if (s.learn) {
      on(s.learn, 'click', (e) => { e.preventDefault(); learnKey(key); focusStage(); });
      on(s.learn, 'pointerdown', (e) => e.stopPropagation());
    }
    on(s.btn, 'pointerdown', (e) => {
      if (mode !== 'playing') return;
      if (learnMode || (e.pointerType === 'mouse' && e.ctrlKey)) { e.preventDefault(); learnKey(key); if (e.pointerType === 'mouse') focusStage(); return; }
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
        if (learnMode) learnKey(key);
        else if (targeting() === 'charge') { game.chargeStart(); game.chargeRelease(); } else game.cast(key);
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
    if (game.focus && (game.focus.dead || game.focus.seen === false || Math.hypot(game.focus.x - p.x, game.focus.z - p.z) > 9)) game.focus = null;
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
    const lk = `${st.lv}/${st.max}`;
    if (s.lvKey !== lk) {
      s.lvKey = lk;
      clear(s.pips);
      for (let i = 0; i < (st.max || 4); i++) s.pips.appendChild(h('i', { class: i < st.lv ? 'on' : '' }));
      const label = slotLabel(s.key);
      s.btn.setAttribute('aria-label', label);
      s.btn.title = label;
    }
    setCls(s.btn, 'locked', !!st.locked);
    setCls(s.btn, 'can-learn', !!st.learn);
    setCls(s.btn, 'silenced', !!st.silenced);
    if (s.learn) setHidden(s.learn, !st.learn);
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
    setText(dogsLbl, g.bossWave ? (g.bossId === 'boss_roshan' ? 'ROSHAN+' : 'BOSS+') : 'DOG');
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
    setAttr(goldBtn, 'title', `Dükkân (B) · güvenilir ${fmtNum(p.goldR)}, güvenilmez ${fmtNum(g.unreliable())}`);
    setHidden(talentBtn, !p.talentPending.length);
    // 25. seviyede her şey dolduğunda artan puanlar harcanamaz: rozeti gizle
    const canSpend = p.skillPoints > 0 && g.learnable().length > 0;
    setHidden(spBtn, !canSpend);
    setText(spNum, String(p.skillPoints));
    if (learnMode && !canSpend) setLearnMode(false);
    const st = g.stat;
    for (const k of ['str', 'agi', 'int']) setText(attrEls[k].v, String(Math.round(st[k] || 0)));
    // orman yuvası
    const nid = p.neutral ? p.neutral.id : '';
    if (neutralSlot.dataset.k !== nid) {
      neutralSlot.dataset.k = nid;
      const im = neutralSlot.firstChild;
      clear(im);
      if (nid) { im.appendChild(itemImg(NEUTRALS[nid], 'ar-islot-pic')); neutralSlot.title = `${NEUTRALS[nid].name} — ${NEUTRALS[nid].desc}`; neutralSlot.setAttribute('aria-label', `Orman eşyası: ${NEUTRALS[nid].name}. ${NEUTRALS[nid].desc}`); }
      else { neutralSlot.title = 'Orman eşyası (kamplardan düşer)'; neutralSlot.setAttribute('aria-label', 'Boş orman eşyası yuvası'); }
      setCls(neutralSlot, 'empty', !nid);
    }
    setCls(neutralSlot, 'stash', g.neutralStash.length > 0);
    // gündüz / gece
    const night = g.isNight;
    const dl = g.dayLeft();
    setText(dayTime, Number.isFinite(dl) ? fmtT(dl) : '∞');
    if (dayCell.dataset.n !== String(night)) {
      dayCell.dataset.n = String(night);
      dayIco.innerHTML = glyph(night ? 'moon' : 'sun');
      dayCell.querySelector('.ar-day-l').textContent = night ? 'Gece' : 'Gündüz';
      dayCell.title = night ? 'Gece: görüş kısa, Wardsız DOG’lar güçlü' : 'Gündüz';
    }
    setCls(stage, 'is-night', night && (mode === 'playing' || mode === 'paused' || mode === 'picking' || mode === 'talk'));
    // boss çubuğu
    const boss = mode === 'playing' || mode === 'picking' || mode === 'paused' || mode === 'talk' ? g.activeBoss() : null;
    setHidden(bossBar, !boss || boss.spawnT > 0.8);
    if (boss) {
      if (bossBar.dataset.id !== String(boss.id)) {
        bossBar.dataset.id = String(boss.id);
        bossName.textContent = boss.name;
        bossIco.innerHTML = glyph(boss.def.glyph || 'skull');
        bossBar.style.setProperty('--bc', boss.def.color || 'var(--dire)');
      }
      const f = Math.max(0, boss.hp / boss.maxHp);
      setVar(bossBar, '--f', f.toFixed(4));
      setText(bossHp, `${fmtNum(Math.ceil(boss.hp))} / ${fmtNum(boss.maxHp)}`);
      setAttr(bossBar, 'aria-valuenow', String(Math.ceil(boss.hp)));
      setAttr(bossBar, 'aria-valuemax', String(boss.maxHp));
      const shielded = boss.invuln > 0;
      setCls(bossBar, 'shielded', shielded);
      setText(bossPhase, shielded ? 'KALKAN · muhafızları indir' : boss.stealth > 0 ? 'Karanlıkta…' : boss.status === 'sleep' ? 'uyuyor' : boss.phaseText || (boss.k > 1 ? `güç ${boss.k}` : ''));
    }
    // orman seçimi sayacı
    if (!ncEl.hidden) {
      if (!g.neutralOffer) hideNeutralChoice();
      else setText(ncTime, String(Math.max(0, Math.ceil(g.neutralOffer.t))));
    }
    // geri alma sayacı
    if (bbOpen) {
      setText(bbTime, String(Math.max(0, Math.ceil(g.dyingT))));
      bbBtn.disabled = !g.canBuyback();
    }
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
      bark: p.barkT, guise: p.guiseT > 0 && p.invis > 0 ? p.guiseT : 0, mshield: p.magShield > 0 ? p.magShieldT : 0, cyclone: p.cyclone, blood: p.lsBuff, phase: p.hasteBuff,
      overload: p.overload ? -1 : 0, root: p.st.root, silence: p.st.silence, hex: p.st.hex, fear: p.st.fear,
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
    if (brk) {
      setText(breakTime, String(Math.max(0, Math.ceil(g.breakT))));
      setText(breakLbl, g.wave === 0 ? 'Hazırlık · ilk dalga ' : 'Mola · sıradaki dalga ');
    }
    stage.classList.toggle('in-break', brk);
    // duyuru zamanları
    const now = performance.now();
    if (bannerT && now > bannerT) { bannerT = 0; banner.classList.remove('on'); }
    if (announceT && now > announceT) { announceT = 0; announce.classList.remove('on'); }
    for (let i = feedItems.length - 1; i >= 0; i--) {
      if (now > feedItems[i].t) { feedItems[i].li.remove(); feedItems.splice(i, 1); }
    }
    if (shop.open) shop.update();
    if (mode === 'playing' || mode === 'paused' || mode === 'picking' || mode === 'talk') minimap.draw(g, dt);
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
        if (d.dead || d.demo || d.seen === false || (d.type === 'ward' && d.vis < 0.5)) continue;
        if (d.kind === 'creep' || d.kind === 'neutral') continue;
        list.push([d, d.kind === 'boss' ? d.def.color || 'var(--aegis)' : d.thief ? 'var(--aegis-2)' : archOf(d.type).color]);
      }
      for (const k of game.pickups) if (k.kind === 'aegis' || k.kind === 'cheese' || k.kind === 'rapierItem' || k.kind === 'neutral') list.push([k, k.kind === 'neutral' ? 'var(--radiant)' : 'var(--aegis)']);
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
      // yatay telefon + site çubukları: sahne ~220 px (tam ekranda değil) → dokunmatik yerleşim sıkıştırılır
      stage.classList.toggle('is-tiny', hh < 300 && w >= 560);
      // …ve joystick ile +N/T yuvası yan yana sığmıyorsa (sahne < 764 px) yuva dikey dizilir
      stage.classList.toggle('is-tight', hh < 300 && w >= 560 && w < 764);
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
      const m0 = mode;
      // olay bir diyalog/ekran açtıysa (mode değiştiyse) aynı karede simülasyonu ilerletme
      while (acc >= STEP && n < maxN && mode === m0) {
        game.step(STEP, input);
        acc -= STEP;
        n += 1;
        simDt += STEP;
      }
      if (n >= maxN || mode !== m0) acc = 0;
      if (pendingTalk.length) flushTalk();
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
    view.render(game, dt, mode === 'paused' || mode === 'picking' || mode === 'talk' ? 0 : simDt);
    updateHud(dt);
    updateEdges();
  }

  // ------------------------------------------------------------------ görüntü kurulumu
  function setStartReady() {
    const wasMenu = menu;
    mode = 'start';
    select.ready();
    // yenilemede aynı menüye dön (oturum içi); kullanıcı yüklenirken gezindiyse onun seçimi kalır
    const ui = userNavigated ? null : readUi();
    if (ui && ui.menu === 'campaign') openCampaign(ui.missionId || null);
    else if (ui && ui.menu === 'daily') openDaily();
    else if (ui && ui.menu === 'select' && ui.kind === 'story' && ui.missionId) loadStory().then(() => { if (alive && mode === 'start' && !userNavigated) openSelect('story', ui.missionId); });
    else if (ui && ui.menu === 'select') openSelect('endless');
    else if (wasMenu === 'daily') openDaily(); // "Yükleniyor…" düğmesini etkinleştir
    else if (wasMenu === 'select') showScreen('start');
    else if (wasMenu === 'campaign') showScreen('campaign');
    else openHub();
  }

  (async () => {
    openHub({ persist: false });
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
    // açık pencere (Kütüphane/Kodeks/ustalık) bölümle birlikte kapanır: Geri tuşuyla çıkınca yeni sayfada kalıyordu
    if (closePanel) { try { closePanel(); } catch { /* yok say */ } closePanel = null; }
    clearInterval(cdTimer);
    clearOver();
    if (stopCamp) { try { stopCamp(); } catch { /* yok say */ } stopCamp = null; }
    if (stopCurse) { try { stopCurse(); } catch { /* yok say */ } stopCurse = null; }
    if (dlg) { try { dlg.destroy(); } catch { /* yok say */ } dlg = null; }
    if (stopTrack) { try { stopTrack(); } catch { /* yok say */ } stopTrack = null; }
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

