// 1vDOQUZ Arena 2.0 — kahraman seçim ekranı. 3D önizleme: arena sahnesinin kendisi (kamera seçili kahramana
// yaklaşır ve döner tabla gibi döndürür); WebGL yoksa amblem kartı görünür.

import { h, clear, fmtNum } from '../../../core/dom.js';
import { icon } from '../../../core/icons.js';
import { HEROES, HERO_IDS, heroBars } from './heroes.js';
import { ABILITIES } from './abilities.js';
import { glyph } from './glyphs.js';

const KEYS = ['q', 'w', 'e', 'r'];

function stars(n) {
  return h('span', { class: 'ar-stars', 'aria-label': `Zorluk ${n}/3` }, [1, 2, 3].map((i) => h('span', { class: i <= n ? 'on' : '', html: glyph('star') })));
}

export function abilityTip(A) {
  const L = A.levels[0];
  const bits = [];
  if (A.targeting === 'passive') bits.push('Pasif');
  else {
    const mana = A.costText || (L.mana ? String(L.mana) : '0');
    bits.push(`Mana ${mana}`);
    bits.push(`Bekleme ${A.cdText || (String(L.cd).replace('.', ',') + ' sn')}`);
  }
  return bits.join(' · ');
}

/**
 * opts: { heroId, bestFor(id) → number|null, onPick(id), onStart(), extras: [düğüm…] (ayarlar/kontroller) }
 */
export function buildSelect(opts) {
  let current = HEROES[opts.heroId] ? opts.heroId : 'okcu';
  const tabs = {};
  const tabBest = {};
  const heroList = h('div', { class: 'ar-sel-heroes', role: 'radiogroup', 'aria-label': 'Kahraman seç' });
  for (const id of HERO_IDS) {
    const H = HEROES[id];
    const best = h('span', { class: 'ar-hero-best num' });
    tabBest[id] = best;
    const b = h('button', {
      class: 'ar-hero-tab', type: 'button', role: 'radio', 'aria-checked': 'false', dataset: { hero: id },
      style: { '--hc': H.color },
    },
      h('span', { class: 'ar-hero-emb', html: glyph(id) }),
      h('span', { class: 'ar-hero-txt' },
        h('strong', null, H.name),
        h('span', { class: 'ar-hero-role' }, H.role),
        h('span', { class: 'ar-hero-meta' }, stars(H.diff), best),
      ),
    );
    b.addEventListener('click', () => pick(id, true));
    b.addEventListener('keydown', (e) => {
      const i = HERO_IDS.indexOf(current);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); pick(HERO_IDS[(i + 1) % HERO_IDS.length], true, true); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); pick(HERO_IDS[(i + HERO_IDS.length - 1) % HERO_IDS.length], true, true); }
    });
    tabs[id] = b;
    heroList.appendChild(b);
  }

  const name = h('h3', { class: 'ar-sel-name' });
  const title = h('span', { class: 'ar-sel-title' });
  const blurb = h('p', { class: 'ar-sel-blurb' });
  const bars = h('div', { class: 'ar-sel-bars' });
  const kit = h('div', { class: 'ar-sel-kit', role: 'list', 'aria-label': 'Yetenekler' });
  const tip = h('div', { class: 'ar-sel-tip', 'aria-live': 'polite' });
  const aghs = h('p', { class: 'ar-sel-aghs xsmall' });
  const emblem = h('div', { class: 'ar-sel-emblem', 'aria-hidden': 'true' });
  const startBtn = h('button', { class: 'btn primary lg ar-start-btn', type: 'button', disabled: true }, icon('play', { size: 18 }), h('span', null, 'Yükleniyor…'));
  const bestTxt = h('span', { class: 'ar-start-best small muted' });

  function showTip(A, key) {
    clear(tip);
    tip.append(
      h('strong', null, `${key.toUpperCase()} · ${A.name}`, A.ult ? h('span', { class: 'ar-tip-ult' }, 'ULTİ') : null),
      h('span', { class: 'ar-tip-meta' }, abilityTip(A)),
      h('span', { class: 'ar-tip-desc' }, A.desc),
    );
  }

  function render() {
    const H = HEROES[current];
    for (const id of HERO_IDS) tabs[id].setAttribute('aria-checked', String(id === current));
    for (const id of HERO_IDS) tabs[id].tabIndex = id === current ? 0 : -1;
    root.style.setProperty('--hc', H.color);
    name.textContent = H.name;
    title.textContent = H.title;
    blurb.textContent = H.blurb;
    emblem.innerHTML = glyph(H.id);
    clear(bars);
    for (const [label, v] of heroBars(H)) {
      bars.appendChild(h('div', { class: 'ar-sel-bar' }, h('span', null, label), h('i', { style: { '--v': v.toFixed(2) } })));
    }
    clear(kit);
    KEYS.forEach((k) => {
      const A = ABILITIES[H.abilities[k]];
      const b = h('button', { class: `ar-sel-ab${A.ult ? ' ult' : ''}`, type: 'button', role: 'listitem', 'aria-label': `${k.toUpperCase()}: ${A.name}. ${A.desc}` },
        h('span', { class: 'ar-sel-ab-i', html: glyph(A.icon) }),
        h('span', { class: 'ar-sel-ab-k' }, k.toUpperCase()),
        h('span', { class: 'ar-sel-ab-n' }, A.name),
      );
      const show = () => { for (const x of kit.children) x.classList.remove('on'); b.classList.add('on'); showTip(A, k); };
      b.addEventListener('mouseenter', show);
      b.addEventListener('focus', show);
      b.addEventListener('click', show);
      kit.appendChild(b);
      if (k === 'q') { b.classList.add('on'); showTip(A, k); }
    });
    aghs.textContent = H.aghs;
    refreshBest();
  }

  function refreshBest() {
    for (const id of HERO_IDS) {
      const v = opts.bestFor(id);
      tabBest[id].textContent = v == null ? '' : fmtNum(v);
      tabBest[id].title = v == null ? '' : `${HEROES[id].name} ile en iyin: ${fmtNum(v)} puan`;
    }
    const v = opts.bestFor(current);
    bestTxt.textContent = v == null ? `${HEROES[current].name} ile henüz skorun yok.` : `${HEROES[current].name} ile en iyin: ${fmtNum(v)}`;
  }

  function pick(id, user = false, focus = false) {
    if (!HEROES[id]) return;
    const changed = id !== current;
    current = id;
    render();
    if (focus) tabs[id].focus();
    if (user && changed && opts.onPick) opts.onPick(id);
  }

  const root = h('div', { class: 'ar-screen ar-select', role: 'dialog', 'aria-label': 'Kahraman seçimi' },
    h('div', { class: 'ar-sel-card ar-card' },
      h('div', { class: 'ar-sel-head' },
        h('span', { class: 'eyebrow' }, '1vDOQUZ Arena 2.0 · mini Dota'),
        h('h2', { class: 'ar-start-title' }, '1vDO', h('em', null, 'Q'), 'UZ'),
      ),
      h('p', { class: 'ar-sel-story small' }, 'Radiant tarafında tek başınasın: dokuz DOG, Dire creep’leri, kuleler ve her 5. dalgada Roshan. Altın topla, eşya al, seviye atla. ', h('b', null, 'DOG DOG DOG.')),
      heroList,
      h('div', { class: 'ar-start-cta' }, startBtn, bestTxt),
      h('div', { class: 'ar-sel-detail' },
        h('div', { class: 'ar-sel-namebox' }, emblem, h('div', null, name, title)),
        blurb,
        bars,
        kit,
        tip,
        aghs,
      ),
      opts.extras ? h('details', { class: 'ar-sel-more' }, h('summary', null, icon('keyboard', { size: 16 }), 'Kontroller ve ayarlar'), ...opts.extras) : null,
    ),
  );
  startBtn.addEventListener('click', () => opts.onStart && opts.onStart());
  render();

  return {
    el: root,
    startBtn,
    get hero() { return current; },
    setHero: (id) => pick(id, false),
    refreshBest,
    ready() {
      startBtn.disabled = false;
      clear(startBtn).append(icon('play', { size: 18 }), h('span', null, 'Arenaya gir'));
    },
    focusCurrent() { try { tabs[current].focus({ preventScroll: true }); } catch { /* yok say */ } },
  };
}
