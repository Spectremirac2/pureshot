// Invoker Kombo — Quas / Wex / Exort kürelerini dizip Invoke (R) ile büyü çağırma refleksi.
// Son basılan üç küre slotlarda durur (yenisi en eskiyi iter); R, üç kürenin karışımına denk gelen
// büyüyü çağırır, sıra önemsizdir. İki mod:
//   Zaman Saldırısı — 60 sn’de en çok hedef büyü (skor tablosuna yazılan tek ölçü)
//   10 Büyü Yarışı  — on büyünün hepsini birer kez, kronometreyle (yalnızca yerel rekor)

import './invoker.css';
import { h, clear, fmtNum, ls, shuffle, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { abilityIconUrl } from '../../core/assets.js';
import { createRunner, gameLayout, hudStat, showOverlay, introCard, resultCard, submitResult, revealInView, isTyping, tok } from './kit.js';

const DURATION = 60;
const PENALTY = 2;
const RACE_N = 10;
const PIPS = 5;
const GRACE_MS = 1200; // bitişten sonra site kısayolları bu kadar kapalı kalır (tuşa basmaya devam edenler sayfadan çıkmasın)
const RACE_KEY = 'invoker-race-best';
const MODE_KEY = 'invoker-mode';
const BOOK_KEY = 'invoker-book';

const ORBS = {
  Q: { key: 'Q', id: 'quas', name: 'Quas', tr: 'buz', color: '#62c8ff' },
  W: { key: 'W', id: 'wex', name: 'Wex', tr: 'fırtına', color: '#c77dff' },
  E: { key: 'E', id: 'exort', name: 'Exort', tr: 'ateş', color: '#ff8a3d' },
};
const MIXED = '#f6d98a';

const SPELLS = [
  { id: 'cold_snap', combo: 'QQQ', name: 'Cold Snap', tr: 'Ayaz Çıtırtısı', line: 'Her darbede yeniden donar.' },
  { id: 'ghost_walk', combo: 'QQW', name: 'Ghost Walk', tr: 'Hayalet Yürüyüşü', line: 'Görünmez ol, sessizce sıvış.' },
  { id: 'ice_wall', combo: 'QQE', name: 'Ice Wall', tr: 'Buz Duvarı', line: 'Koridoru dondurur, kaçışı keser.' },
  { id: 'emp', combo: 'WWW', name: 'EMP', tr: 'Mana Fırtınası', line: 'Üç saniye sonra mana buharlaşır.' },
  { id: 'tornado', combo: 'WWQ', name: 'Tornado', tr: 'Kasırga', line: 'Havaya kaldırır, komboya sahne kurar.' },
  { id: 'alacrity', combo: 'WWE', name: 'Alacrity', tr: 'Şevk', line: 'Carry’ne saldırı hızı, sana teşekkür.' },
  { id: 'sun_strike', combo: 'EEE', name: 'Sun Strike', tr: 'Güneş Darbesi', line: 'Haritanın öbür ucuna, tahminle.' },
  { id: 'forge_spirit', combo: 'EEQ', name: 'Forge Spirit', tr: 'Ocak Ruhu', line: 'İki ateş ruhu, bedava kule baskısı.' },
  { id: 'chaos_meteor', combo: 'EEW', name: 'Chaos Meteor', tr: 'Kaos Meteoru', line: 'Yuvarlanan kaya, yanan koridor.' },
  { id: 'deafening_blast', combo: 'QWE', name: 'Deafening Blast', tr: 'Sağır Eden Patlama', line: 'Herkesi iter, silahsız bırakır.' },
];

/** Kürelerin çoklu küme imzası (sıra önemsiz): Q, W, E sayıları. */
const sig = (orbs) => {
  let q = 0, w = 0, e = 0;
  for (const o of orbs) { if (o === 'Q') q++; else if (o === 'W') w++; else e++; }
  return `${q}${w}${e}`;
};
const BY_SIG = new Map(SPELLS.map((s) => [sig(s.combo), s]));

/** Büyünün baskın küre rengi (QWE karışık: altın). */
function spellColor(s) {
  const n = sig(s.combo);
  if (n === '111') return MIXED;
  const i = [...n].findIndex((c) => Number(c) >= 2);
  return ORBS['QWE'[i]].color;
}

/**
 * Mevcut kürelerden hedefe en az kaç küre basışıyla varılır? (k yeni küre, son 3−k küre
 * korunur; korunanlar hedefin alt kümesiyse yeter.) Küre verimi istatistiği için.
 */
function minPresses(orbs, spell) {
  for (let k = 0; k <= 3; k++) {
    const keepN = 3 - k;
    if (orbs.length < keepN) continue;
    const keep = orbs.slice(orbs.length - keepN);
    const need = spell.combo.split('');
    let ok = true;
    for (const o of keep) {
      const i = need.indexOf(o);
      if (i < 0) { ok = false; break; }
      need.splice(i, 1);
    }
    if (ok) return k;
  }
  return 3;
}

const fmtSec = (s) => (Math.max(0, s)).toFixed(2).replace('.', ',');
const fmtTenth = (s) => (Math.max(0, s)).toFixed(1).replace('.', ',');

export const meta = {
  id: 'invoker',
  name: 'Invoker Kombo',
  short: 'Invoker',
  icon: 'orbs',
  color: 'var(--arcane)',
  kind: 'Refleks · Parmak',
  blurb: 'Q W E kürelerini diz, R ile çağır. Altmış saniyede kaç büyü?',
  lore: 'On büyü, üç küre, tek beyin. Sun Strike’ı yanlış yere atan DOG sayılır.',
  time: '60 sn',
  diff: 3,
  unit: 'büyü',
  higherIsBetter: true,
  format: (n) => `${fmtNum(n)} büyü`,
  rules: [
    'Q (Quas), W (Wex), E (Exort) küre çağırır. Son basılan üç küre slotlarda durur, yenisi en eskiyi iter.',
    'R (Invoke) üç kürenin karışımına denk gelen büyüyü çağırır. Sıra önemsiz: QQW = QWQ = WQQ.',
    `Ekrandaki hedef büyüyü çağır: +1 büyü. Yanlış büyü: −${PENALTY} sn ve “DOG!”.`,
    'Hata yapmadan zincirle, seri ısınsın. Tarifler’i açık tutmak serbest, zaman yine de akar.',
    `10 Büyü Yarışı: on büyünün hepsi birer kez, kronometreyle. Yanlış büyü +${PENALTY} sn; rekoru bu cihazda saklanır.`,
  ],
  keys: [['Q W E', 'Quas · Wex · Exort küresi'], ['R', 'Invoke: büyüyü çağır'], ['Tık / dokun', 'Ekrandaki Q W E R düğmeleri']],
};

// Yarış sonucu için aynı sonuç kartı, farklı birim (skor tablosuna yazılmaz)
const raceMeta = {
  ...meta,
  unit: 'saniye',
  format: (n) => `${fmtSec(n)} sn`,
  scoreText: (n) => fmtSec(n),
};

const CODES = { KeyQ: 'Q', KeyW: 'W', KeyE: 'E', KeyR: 'R' };
const LETTERS = { q: 'Q', w: 'W', e: 'E', r: 'R' };
/** Fiziksel tuş önce (Türkçe F, AZERTY… düzenlerde de aynı yer), sonra basılan harf. */
function keyOf(e) {
  return CODES[e.code] || LETTERS[(e.key || '').toLowerCase()] || null;
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Resmi ikon ya da küre renkli çizim yedeği. */
function spellIcon(spell, cls = '') {
  const url = abilityIconUrl('invoker_' + spell.id);
  if (url) return h('img', { class: `gm-iv-ico ${cls}`, src: url, alt: '', draggable: 'false' });
  const [a, b, c] = spell.combo.split('').map((k) => ORBS[k].color);
  return h('span', { class: `gm-iv-ico gm-iv-ico-fb ${cls}`, style: { '--c1': a, '--c2': b, '--c3': c } },
    spell.name.split(' ').map((w) => w[0]).join('').slice(0, 2));
}

function pips(combo, cls = '') {
  return h('span', { class: `gm-iv-pips ${cls}`, 'aria-hidden': 'true' },
    combo.split('').map((k) => h('span', { class: 'gm-iv-pip', dataset: { orb: k } }, k)));
}

export function mount(el, ctx, nav) {
  const L = gameLayout(el, meta, { nav });
  const reduced = prefersReducedMotion();
  for (const k of 'QWE') L.root.style.setProperty(`--iv-${k.toLowerCase()}`, ORBS[k].color);
  L.root.style.setProperty('--iv-mix', MIXED);

  // ---------------------------------------------------------------- HUD
  const sTime = hudStat('Süre', String(DURATION), { ico: 'hourglass', cls: 'gm-stat-time' });
  const sScore = hudStat('Büyü', '0', { ico: 'orbs', cls: 'gm-stat-score' });
  const comboPips = h('span', { class: 'gm-iv-hudpips', 'aria-hidden': 'true' }, Array.from({ length: PIPS }, () => h('i')));
  const sStreak = hudStat('Seri', '×0', { ico: 'flame', cls: 'gm-stat-combo' });
  sStreak.el.appendChild(comboPips);
  const sWrong = hudStat('DOG', '0', { ico: 'paw' });
  const timeBar = h('span', { class: 'gm-timebar', 'aria-hidden': 'true' }, h('span'));
  sTime.el.appendChild(timeBar);
  L.hud.append(sTime.el, sScore.el, sStreak.el, sWrong.el);

  // ---------------------------------------------------------------- sahne
  let mode = ls.get(MODE_KEY, 'time') === 'race' ? 'race' : 'time';
  let bookOn = ls.get(BOOK_KEY, null);
  if (bookOn == null) bookOn = typeof (ctx.store.me.get().scores || {}).invoker !== 'number';

  const modeBadge = h('span', { class: 'badge gm-iv-mode' });
  const bookBtn = h('button', { class: 'chip gm-iv-book-btn', type: 'button', 'aria-pressed': String(!!bookOn), 'aria-controls': 'gm-iv-book' },
    icon('info', { size: 14 }), 'Tarifler');

  // İkonlar önceden çözülür ve düğümler yeniden kullanılır: hedef değişirken ikon bir kare bile boş kalmasın
  const preload = [];
  for (const key of ['invoke', 'quas', 'wex', 'exort', ...SPELLS.map((s) => s.id)]) {
    const url = abilityIconUrl('invoker_' + key);
    if (!url) continue;
    const im = new Image();
    im.src = url;
    if (im.decode) im.decode().catch(() => {});
    preload.push(im);
  }
  const iconCache = (cls) => {
    const m = new Map();
    return (sp) => { if (!m.has(sp.id)) m.set(sp.id, spellIcon(sp, cls)); return m.get(sp.id); };
  };
  const targetIcon = iconCache('');
  const slotIcon = iconCache('');
  const tIco = h('span', { class: 'gm-iv-target-ico' });
  const tName = h('h3', { class: 'gm-iv-target-name' }, '—');
  const tTr = h('p', { class: 'gm-iv-target-tr' }, 'Başla’ya bas, hedef burada belirir.');
  const tRecipe = h('span', { class: 'gm-iv-target-recipe' });
  const target = h('div', { class: 'gm-iv-target' },
    tIco,
    h('div', { class: 'gm-iv-target-text' },
      h('span', { class: 'gm-iv-target-eyebrow' }, 'Hedef büyü'),
      tName,
      tTr,
    ),
    tRecipe,
  );
  const msg = h('p', { class: 'gm-iv-msg', 'aria-hidden': 'true' }, 'Q W E ile küre diz, R ile çağır.');

  const orbSlots = [0, 1, 2].map(() => h('span', { class: 'gm-iv-orb is-empty' }));
  const orbsEl = h('div', { class: 'gm-iv-orbs', role: 'img', 'aria-label': 'Küreler: boş' }, orbSlots);
  const slotEls = ['D', 'F'].map((k) => h('span', { class: 'gm-iv-slot', dataset: { k } }, h('span', { class: 'gm-iv-slot-ico' }), h('span', { class: 'kbd gm-iv-slot-kbd' }, k)));
  const row = h('div', { class: 'gm-iv-row' },
    orbsEl,
    h('div', { class: 'gm-iv-slots', title: 'Son çağrılan iki büyü (D ve F)' }, slotEls),
  );

  const keyBtns = {};
  const pad = h('div', { class: 'gm-iv-pad', role: 'group', 'aria-label': 'Küre ve Invoke düğmeleri' },
    ['Q', 'W', 'E', 'R'].map((k) => {
      const isR = k === 'R';
      const url = abilityIconUrl(isR ? 'invoker_invoke' : 'invoker_' + ORBS[k].id);
      const b = h('button', {
        class: `gm-iv-key${isR ? ' is-invoke' : ''}`,
        type: 'button',
        dataset: { k },
        'aria-label': isR ? 'R: Invoke, büyüyü çağır' : `${k}: ${ORBS[k].name} küresi`,
      },
        url ? h('img', { class: 'gm-iv-key-img', src: url, alt: '', draggable: 'false', decoding: 'async' }) : h('span', { class: 'gm-iv-key-img fb' }),
        h('span', { class: 'kbd gm-iv-key-kbd' }, k),
        h('span', { class: 'gm-iv-key-name' }, isR ? 'Invoke' : ORBS[k].name),
      );
      let downAt = -1e9;
      b.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        downAt = performance.now();
        press(k);
      });
      // Klavyeyle odaklanıp Enter/Boşluk. Bazı tarayıcılar dokunmayı da detail 0'lı click olarak
      // yolluyor: işaretçiden gelen ya da az önce pointerdown almış tıklamayı ikinci kez sayma.
      b.addEventListener('click', (e) => {
        if (e.detail !== 0 || e.pointerType || performance.now() - downAt < 600) return;
        press(k);
      });
      keyBtns[k] = b;
      return b;
    }),
  );

  const field = h('div', { class: 'gm-iv-field', dataset: { state: 'intro' } },
    h('div', { class: 'gm-iv-top' }, modeBadge, bookBtn),
    target,
    msg,
    row,
    pad,
  );
  L.stage.appendChild(field);

  // Tarif defteri: sahnenin altında (başlangıç kartı açıkken de okunabilsin)
  const bookItems = new Map();
  const book = h('section', { class: 'panel tight gm-iv-book', id: 'gm-iv-book', 'aria-label': 'Büyü tarifleri' },
    h('div', { class: 'gm-iv-book-head' },
      h('h3', { class: 'h3 row' }, icon('orbs', { size: 18 }), 'Tarifler'),
      h('p', { class: 'xsmall dim' }, 'Sıra önemsiz; sadece hangi küreden kaç tane olduğu sayılır.'),
    ),
    h('ul', { class: 'gm-iv-book-list' }, SPELLS.map((s) => {
      const li = h('li', { class: 'gm-iv-book-item', style: { '--sc': spellColor(s) }, title: `${s.name} (${s.tr}): ${s.combo}` },
        spellIcon(s, 'gm-iv-book-ico'),
        h('span', { class: 'gm-iv-book-name' }, s.name),
        pips(s.combo),
        h('span', { class: 'sr-only' }, `: ${s.combo.split('').join(' ')}`),
      );
      bookItems.set(s.id, li);
      return li;
    })),
  );
  L.stage.closest('.gm-play-main').insertBefore(book, L.live);

  function setBook(on, user) {
    bookOn = !!on;
    bookBtn.setAttribute('aria-pressed', String(bookOn));
    book.hidden = !bookOn;
    field.classList.toggle('show-recipe', bookOn);
    if (user) { ls.set(BOOK_KEY, bookOn); ctx.sound.click(); }
  }
  bookBtn.addEventListener('click', () => setBook(!bookOn, true));
  setBook(bookOn, false);

  // ---------------------------------------------------------------- durum
  let state = 'intro'; // intro | play | end | dead
  let runner = null;
  let closeOverlay = null;
  let hotkeysOff = false;
  let graceTimer = 0;
  let g = null;

  function say(m) { L.live.textContent = m; }
  function setMsg(text, tone = '') {
    msg.textContent = text;
    msg.dataset.tone = tone;
  }
  function restart(elm, cls) {
    elm.classList.remove(cls);
    void elm.offsetWidth;
    elm.classList.add(cls);
  }

  function renderMode() {
    modeBadge.replaceChildren(icon(mode === 'race' ? 'clock' : 'hourglass', { size: 12 }), mode === 'race' ? `${RACE_N} Büyü Yarışı` : `Zaman Saldırısı · ${DURATION} sn`);
    sScore.set(mode === 'race' ? `0/${RACE_N}` : '0');
    sTime.set(mode === 'race' ? '0,0' : String(DURATION));
    timeBar.firstChild.style.transform = mode === 'race' ? 'scaleX(0)' : 'scaleX(1)';
  }

  function renderOrbs(fresh) {
    const orbs = g ? g.orbs : [];
    orbSlots.forEach((s, i) => {
      const o = orbs[i];
      s.className = 'gm-iv-orb' + (o ? '' : ' is-empty');
      s.dataset.orb = o || '';
      const url = o ? abilityIconUrl('invoker_' + ORBS[o].id) : null;
      s.style.setProperty('--img', url ? `url("${url}")` : 'none');
    });
    if (fresh && orbs.length) restart(orbSlots[orbs.length - 1], 'enter');
    orbsEl.setAttribute('aria-label', orbs.length ? `Küreler: ${orbs.map((o) => ORBS[o].name).join(', ')}` : 'Küreler: boş');
    // Sahne ışığı: kürelerin karışım rengi
    if (orbs.length) {
      const sum = [0, 0, 0];
      for (const o of orbs) hexRgb(ORBS[o].color).forEach((v, j) => { sum[j] += v; });
      field.style.setProperty('--glow', `rgb(${sum.map((v) => Math.round(v / orbs.length)).join(',')})`);
    } else {
      field.style.removeProperty('--glow');
    }
  }

  function renderSlots(pop) {
    slotEls.forEach((s, i) => {
      const sp = g ? g.slots[i] : null;
      const box = s.firstChild;
      clear(box);
      if (sp) box.appendChild(slotIcon(sp));
      s.classList.toggle('filled', !!sp);
      s.title = sp ? `${i ? 'F' : 'D'}: ${sp.name}` : '';
    });
    if (pop) restart(slotEls[0], 'pop');
  }

  function renderTarget(spell) {
    target.style.setProperty('--sc', spellColor(spell));
    target.dataset.spell = spell.id;
    tIco.replaceChildren(targetIcon(spell));
    tName.textContent = spell.name;
    tTr.replaceChildren(h('strong', null, spell.tr), ` · ${spell.line}`);
    tRecipe.replaceChildren(pips(spell.combo));
    for (const [id, li] of bookItems) li.classList.toggle('is-target', id === spell.id);
    if (!reduced) restart(target, 'swap');
  }

  function setStreak(n) {
    g.streak = n;
    g.maxStreak = Math.max(g.maxStreak, n);
    sStreak.set('×' + n);
    const lit = n === 0 ? 0 : ((n - 1) % PIPS) + 1;
    Array.from(comboPips.children).forEach((p, i) => p.classList.toggle('on', i < lit));
    sStreak.el.classList.toggle('hot', n >= PIPS);
    field.classList.toggle('hot', n >= PIPS);
  }

  function nextTarget() {
    if (!g.bag.length) {
      g.bag = shuffle(SPELLS);
      if (g.bag[0] === g.target) g.bag.push(g.bag.shift()); // art arda aynı hedef yok
    }
    g.target = g.bag.shift();
    g.targetAt = runner.time;
    g.pressesThis = 0;
    g.minNeed = minPresses(g.orbs, g.target);
    renderTarget(g.target);
    say(`Hedef: ${g.target.name}.`);
  }

  // ---------------------------------------------------------------- giriş
  function press(k) {
    if (state !== 'play') return;
    restart(keyBtns[k], 'hit');
    if (k === 'R') { invoke(); return; }
    g.orbs.push(k);
    if (g.orbs.length > 3) g.orbs.shift();
    g.presses++;
    g.pressesThis++;
    renderOrbs(true);
    ctx.sound.charge(k === 'Q' ? 0.9 : k === 'W' ? 0.55 : 0.2);
  }

  function invoke() {
    if (g.orbs.length < 3) {
      setMsg('Önce üç küre diz: Q, W, E.', 'warn');
      ctx.sound.miss();
      return;
    }
    const spell = BY_SIG.get(sig(g.orbs));
    if (g.slots[0] === spell) {
      // Dota’daki gibi: D slotundaki büyü yeniden çağrılmaz, ceza da yok
      setMsg(`${spell.name} zaten hazır. Küreleri değiştir.`, 'dim');
      ctx.sound.click();
      return;
    }
    g.slots = [spell, g.slots[0]];
    renderSlots(true);
    if (spell === g.target) success(spell);
    else fail(spell);
  }

  function cardPoint() {
    const r = target.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height * 0.3];
  }

  function success(spell) {
    const dt = runner.time - g.targetAt;
    g.times.push(dt);
    g.sumMin += g.minNeed;
    g.sumAct += g.pressesThis;
    g.score++;
    g.wrongRun = 0;
    setStreak(g.streak + 1);
    sScore.set(mode === 'race' ? `${g.score}/${RACE_N}` : fmtNum(g.score));
    sScore.bump();
    target.style.setProperty('--flash', spellColor(spell));
    restart(field, 'cast');
    setMsg(`${spell.name}! ${fmtSec(dt)} sn`, 'good');
    if (g.streak > 0 && g.streak % 10 === 0) {
      ctx.fx.stamp('1vDOQUZ', { variant: 'gold' });
      ctx.sound.good();
    } else if (g.streak > 0 && g.streak % PIPS === 0) {
      // Oyun alanının dışında, seri göstergesinden yükselsin (hedef kartını örtmesin)
      const sr = sStreak.el.getBoundingClientRect();
      ctx.fx.floatText(`SERİ ×${g.streak}`, sr.left + sr.width / 2, sr.top, { color: tok('--aegis'), size: 20 });
      ctx.sound.good();
    } else {
      ctx.sound.coin();
    }
    say(`${spell.name} çağrıldı. ${g.score} büyü.`);
    if (mode === 'race' && g.score >= RACE_N) { end(); return; }
    nextTarget();
  }

  function fail(spell) {
    g.wrong++;
    g.wrongRun++;
    setStreak(0);
    if (mode === 'time') g.left = Math.max(0, g.left - PENALTY);
    else g.penalty += PENALTY;
    sWrong.set(fmtNum(g.wrong));
    sWrong.bump();
    ctx.sound.miss();
    ctx.fx.shake(target);
    const [x, y] = cardPoint();
    ctx.fx.floatText('DOG!', x, y, { color: tok('--dire'), size: 30 });
    const tr = sTime.el.getBoundingClientRect();
    ctx.fx.floatText(mode === 'time' ? `−${PENALTY} sn` : `+${PENALTY} sn`, tr.left + tr.width / 2, tr.bottom, { color: tok('--dire'), size: 16 });
    restart(field, 'miss');
    setMsg(`Yanlış: ${spell.name} (${spell.combo}). ${mode === 'time' ? '−' : '+'}${PENALTY} sn`, 'bad');
    say(`Yanlış büyü: ${spell.name}. Ceza ${PENALTY} saniye.`);
    if (g.wrongRun === 3) ctx.fx.stamp('DOG DOG DOG');
  }

  function onKey(e) {
    if (state !== 'play') return;
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
    const k = keyOf(e);
    if (!k) return;
    e.preventDefault();
    if (e.repeat) return;
    press(k);
  }
  window.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- döngü
  function frame(dt) {
    if (state !== 'play') return;
    if (mode === 'time') {
      g.left -= dt;
      const left = Math.max(0, g.left);
      sTime.set(fmtTenth(left));
      timeBar.firstChild.style.transform = `scaleX(${left / DURATION})`;
      sTime.el.classList.toggle('low', left <= 10);
      if (left <= 5 && Math.ceil(left) !== g.lastTick) {
        g.lastTick = Math.ceil(left);
        ctx.sound.tick();
      }
      if (g.left <= 0) end();
    } else {
      g.elapsed += dt;
      sTime.set(fmtTenth(g.elapsed + g.penalty));
      timeBar.firstChild.style.transform = `scaleX(${g.score / RACE_N})`;
    }
  }

  function start() {
    if (closeOverlay) { closeOverlay(); closeOverlay = null; }
    if (graceTimer) { clearTimeout(graceTimer); graceTimer = 0; }
    if (runner) runner.destroy();
    runner = createRunner(frame);
    g = {
      orbs: [], slots: [null, null], bag: [], target: null, targetAt: 0,
      score: 0, wrong: 0, wrongRun: 0, streak: 0, maxStreak: 0,
      presses: 0, pressesThis: 0, minNeed: 0, sumMin: 0, sumAct: 0, times: [],
      left: DURATION, elapsed: 0, penalty: 0, lastTick: 99,
    };
    renderMode();
    renderOrbs(false);
    renderSlots(false);
    setStreak(0);
    sWrong.set('0');
    sTime.el.classList.remove('low');
    state = 'play';
    field.dataset.state = 'play';
    L.stage.classList.add('playing');
    // Q W E R oyunun tuşları: kabuğun gezinme kısayolları oyun boyunca kapalı
    ctx.hotkeys(false);
    hotkeysOff = true;
    nextTarget();
    setMsg(mode === 'race' ? `${RACE_N} büyünün hepsi birer kez. Kronometre çalışıyor!` : 'Q W E ile küre diz, R ile çağır.', '');
    ctx.sound.whoosh();
    try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch { /* yok say */ }
    requestAnimationFrame(() => revealInView(field));
  }

  function restoreHotkeys() {
    graceTimer = 0;
    if (hotkeysOff) { ctx.hotkeys(true); hotkeysOff = false; }
  }

  function end() {
    if (state !== 'play') return;
    state = 'end';
    field.dataset.state = 'end';
    L.stage.classList.remove('playing');
    graceTimer = setTimeout(restoreHotkeys, GRACE_MS);
    const times = g.times;
    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const best = times.length ? Math.min(...times) : 0;
    const eff = g.sumAct ? Math.round((g.sumMin / g.sumAct) * 100) : 0;
    const common = [
      ['Yanlış (DOG)', fmtNum(g.wrong)],
      ['En uzun seri', `×${g.maxStreak}`],
      ['En hızlı büyü', times.length ? `${fmtSec(best)} sn` : '—'],
      ['Ortalama', times.length ? `${fmtSec(avg)} sn` : '—'],
      ['Küre verimi', g.sumAct ? `%${eff}` : '—'],
    ];
    let card;
    if (mode === 'time') {
      const s = g.score;
      // Skoru hemen kaydet: kart gecikmeli açılır, oyuncu o arada ayrılsa da skor kaybolmaz.
      const saved = submitResult(meta, s);
      const quip = s >= 45
        ? 'Arsenal Magus bile not aldı. Parmakların 1vDOQUZ modunda.'
        : s >= 32
          ? 'Tornado, EMP, Meteor, Blast… Kombo akıyor, rakip koridor hâlâ havada.'
          : s >= 20
            ? 'Sağlam Invoker. Sun Strike’ların artık gerçekten birine çarpıyor.'
            : s >= 10
              ? 'Küreler dönüyor, büyüler geliyor. Tarifleri kapatıp bir tur daha?'
              : 'DOG DOG DOG. Quas, Wex, Exort birbirine girdi; her Invoker böyle başlar.';
      card = () => resultCard(meta, {
        score: s,
        saved,
        stats: [...common, ['Küre basışı', fmtNum(g.presses)]],
        quip,
        onRetry: start,
        onBack: () => nav && nav.back(),
      });
      say(`Süre bitti. ${s} büyü çağırdın.`);
    } else {
      const total = Math.round((g.elapsed + g.penalty) * 100) / 100;
      const prev = ls.get(RACE_KEY, null);
      const record = typeof prev !== 'number' || total < prev;
      if (record) ls.set(RACE_KEY, total);
      const quip = total < 12
        ? 'On büyü, göz açıp kapayıncaya kadar. Arsenal Magus onaylı.'
        : total < 18
          ? 'Hızlı eller! Rakip daha Ghost Walk’u fark etmeden bitti.'
          : total < 28
            ? 'Temiz yarış. Biraz daha pratikle 15 saniyenin altı seni bekliyor.'
            : 'DOG DOG DOG ama bitirdin. Tarifler açık, bir tur daha!';
      card = () => resultCard(raceMeta, {
        score: total,
        saved: { record, prev: typeof prev === 'number' ? prev : null },
        stats: [...common, ['Ceza', `+${fmtNum(g.penalty)} sn`]],
        quip,
        title: 'Yarış sonu · yerel rekor',
        onRetry: start,
        onBack: () => nav && nav.back(),
      });
      say(`Yarış bitti. ${fmtSec(total)} saniye.`);
    }
    const r = runner;
    r.after(0.7, () => {
      if (state !== 'end') return;
      const { node } = card();
      closeOverlay = showOverlay(L.stage, node, { reveal: true });
      r.destroy();
      if (runner === r) runner = null;
    });
  }

  // ---------------------------------------------------------------- başlangıç kartı
  function modePicker() {
    const raceBest = ls.get(RACE_KEY, null);
    const opts = [
      { id: 'time', name: 'Zaman Saldırısı', sub: `${DURATION} sn · skor tablosu`, ico: 'hourglass' },
      { id: 'race', name: `${RACE_N} Büyü Yarışı`, sub: typeof raceBest === 'number' ? `Kronometre · rekorun ${fmtSec(raceBest)} sn` : 'Kronometre · yerel rekor', ico: 'clock' },
    ];
    const btns = opts.map((o) => {
      const b = h('button', { class: 'gm-iv-modebtn', type: 'button', role: 'radio', 'aria-checked': String(mode === o.id), dataset: { mode: o.id } },
        icon(o.ico, { size: 18 }),
        h('span', { class: 'gm-iv-modebtn-text' }, h('strong', null, o.name), h('span', null, o.sub)),
      );
      b.addEventListener('click', () => {
        mode = o.id;
        ls.set(MODE_KEY, mode);
        ctx.sound.click();
        btns.forEach((x) => x.setAttribute('aria-checked', String(x.dataset.mode === mode)));
        renderMode();
      });
      return b;
    });
    return h('div', { class: 'gm-iv-modes', role: 'radiogroup', 'aria-label': 'Mod' }, btns);
  }

  function showIntro() {
    const node = introCard(meta, {
      onStart: start,
      note: 'Oyun başlayınca Q W E R sitede gezinmez, kürelere gider. Küreler Q W E’nin klavyedeki yerine bağlı; Türkçe F klavyede de aynı parmaklar.',
    });
    const noteEl = node.querySelector(':scope > p.xsmall');
    if (noteEl) noteEl.classList.add('gm-iv-intro-note');
    node.insertBefore(modePicker(), node.querySelector('.gm-intro-foot'));
    closeOverlay = showOverlay(L.stage, node);
  }

  renderMode();
  showIntro();

  return () => {
    state = 'dead';
    window.removeEventListener('keydown', onKey);
    if (graceTimer) clearTimeout(graceTimer);
    if (runner) runner.destroy();
    runner = null;
    if (hotkeysOff) { ctx.hotkeys(true); hotkeysOff = false; }
    if (closeOverlay) closeOverlay();
    book.remove();
    L.destroy();
  };
}
