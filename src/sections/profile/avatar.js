// Avatar: fan kartındaki kahraman (store.me.picks.avatar = kahraman id’si).
//   avatarId(me)              seçili kahraman id’si ya da null
//   avatarArt(id)             { render, portrait } URL’leri (aynı köken: canvas kirlenmez)
//   openAvatarPicker(opts)    arama + özellik süzgeçli seçim penceresi; seçince store.me.patch
//
// Seçim ızgarası tek istekli portre atlasını (scripts/build-hero-atlas.mjs) CSS arka planı olarak kullanır;
// atlas yoksa her kahramanın portresi tek tek (lazy) yüklenir.

import { h, clear, pick } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { store } from '../../core/store.js';
import { fx } from '../../core/fx.js';
import { sound } from '../../core/sound.js';
import { heroPortraitUrl, heroRenderUrl } from '../../core/assets.js';
import { HEROES, ATTRS, heroById } from '../../data/heroes.js';
import { normTr } from '../heroes/crest.js';

const ATLAS_URL = Object.values(import.meta.glob('../../assets/heroes/atlas/portraits.webp', { eager: true, query: '?url', import: 'default' }))[0] || null;
const ATLAS_INDEX = Object.values(import.meta.glob('../../assets/heroes/atlas/portraits.json', { eager: true, import: 'default' }))[0] || null;
const ATLAS_AT = ATLAS_INDEX ? new Map(ATLAS_INDEX.ids.map((id, i) => [id, i])) : new Map();

export function avatarId(me = store.me.get()) {
  const id = me && me.picks ? me.picks.avatar : null;
  return id && heroById(id) ? id : null;
}

export function avatarArt(id) {
  if (!id) return { render: null, portrait: null };
  return { render: heroRenderUrl(id), portrait: heroPortraitUrl(id) };
}

/** Küçük kare portre (atlas hücresi ya da portre dosyası). */
export function heroThumb(id, cls = '') {
  const i = ATLAS_AT.get(id);
  if (ATLAS_URL && i !== undefined) {
    const { cols, rows } = ATLAS_INDEX;
    const x = cols > 1 ? ((i % cols) / (cols - 1)) * 100 : 0;
    const y = rows > 1 ? (Math.floor(i / cols) / (rows - 1)) * 100 : 0;
    return h('span', {
      class: `pf-thumb ${cls}`.trim(),
      'aria-hidden': 'true',
      style: { backgroundImage: `url("${ATLAS_URL}")`, backgroundSize: `${cols * 100}% ${rows * 100}%`, backgroundPosition: `${x}% ${y}%` },
    });
  }
  const url = heroPortraitUrl(id);
  return h('span', { class: `pf-thumb ${cls}`.trim(), 'aria-hidden': 'true' },
    url ? h('img', { src: url, alt: '', loading: 'lazy', decoding: 'async', width: '256', height: '144' }) : null);
}

const initials = (name) => name.split(/[\s-]+/).filter(Boolean).map((w) => w[0]).join('');
const KEYS = new Map(HEROES.map((x) => [x.id, [normTr(x.name), normTr(x.id), normTr(x.abbr || ''), normTr(initials(x.name))]]));

function matches(hero, q) {
  if (!q) return true;
  const [name, id, abbr, ini] = KEYS.get(hero.id);
  return name.includes(q) || id.includes(q) || abbr.startsWith(q) || ini === q;
}

/**
 * Avatar seçim penceresi. onPick(id|null) seçimden sonra çağrılır.
 */
export function openAvatarPicker({ onPick } = {}) {
  const current = avatarId();
  let attr = 'all';
  let query = '';
  const sorted = HEROES.slice().sort((a, b) => a.name.localeCompare(b.name, 'en'));

  const input = h('input', {
    class: 'input pf-pick-search', type: 'search', id: 'pf-pick-q', inputmode: 'search', enterkeyhint: 'search',
    autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    placeholder: 'Kahraman ara: Pudge, CM, Invoker…', 'aria-controls': 'pf-pick-grid',
  });
  const count = h('span', { class: 'pf-pick-count xsmall dim', 'aria-live': 'polite' });
  const grid = h('div', { class: 'pf-pick-grid', id: 'pf-pick-grid', role: 'list' });
  const chips = h('div', { class: 'pf-pick-attrs', role: 'group', 'aria-label': 'Özelliğe göre süz' });
  const attrs = [{ id: 'all', label: 'Tümü' }, ...Object.values(ATTRS).map((a) => ({ id: a.id, label: a.label, color: a.color }))];
  const chipEls = attrs.map((a) => {
    const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(a.id === attr), style: a.color ? { '--ac': a.color } : null },
      a.color ? h('span', { class: 'pf-dot', style: { background: a.color } }) : null, a.label);
    b.addEventListener('click', () => { attr = a.id; chipEls.forEach((c, i) => c.setAttribute('aria-pressed', String(attrs[i].id === attr))); paint(); });
    return b;
  });
  chips.append(...chipEls);

  let close = () => {};
  const choose = (id) => {
    store.me.patch((d) => {
      if (!d.picks) d.picks = {};
      if (id) d.picks.avatar = id;
      else delete d.picks.avatar;
    }, { delay: 400 });
    sound.click();
    const hero = id ? heroById(id) : null;
    fx.toast(hero ? `Yeni avatarın: ${hero.name}` : 'Avatar kaldırıldı.', 'jade');
    close();
    if (onPick) onPick(id);
  };

  function paint() {
    const q = normTr(query);
    const list = sorted.filter((x) => (attr === 'all' || x.attr === attr) && matches(x, q));
    clear(grid);
    if (!list.length) {
      grid.appendChild(h('p', { class: 'pf-pick-empty' }, 'Bu adla bir kahraman yok. Yazımı kontrol et ya da süzgeci kaldır.'));
    }
    for (const hero of list) {
      const on = hero.id === current;
      grid.appendChild(h('button', {
        class: `pf-pick-item${on ? ' on' : ''}`, type: 'button', role: 'listitem',
        'aria-label': `${hero.name}${on ? ' (seçili)' : ''}`, 'aria-pressed': String(on),
        style: { '--ac': (ATTRS[hero.attr] || ATTRS.uni).color },
        onclick: () => choose(hero.id),
      },
        heroThumb(hero.id),
        h('span', { class: 'pf-pick-name' }, hero.name),
        on ? h('span', { class: 'pf-pick-on', 'aria-hidden': 'true' }, icon('check', { size: 12, stroke: 2.6 })) : null,
      ));
    }
    count.textContent = `${list.length} kahraman`;
  }

  input.addEventListener('input', () => { query = input.value; paint(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      const first = grid.querySelector('.pf-pick-item');
      if (first) { e.preventDefault(); first.click(); }
    }
  });

  const randomBtn = h('button', { class: 'btn ghost sm', type: 'button', onclick: () => choose(pick(HEROES.filter((x) => x.id !== current)).id) },
    icon('dice', { size: 16 }), 'Rastgele');
  const removeBtn = current
    ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => choose(null) }, icon('close', { size: 16 }), 'Kaldır')
    : null;

  const body = h('div', { class: 'pf-pick' },
    h('div', { class: 'pf-pick-head' },
      h('div', { class: 'pf-pick-title' },
        h('span', { class: 'eyebrow' }, 'Fan Kartı'),
        h('h2', { class: 'h2' }, 'Avatar kahramanın'),
      ),
      h('button', { class: 'btn ghost sm icon pf-pick-x', type: 'button', 'aria-label': 'Kapat', onclick: () => close() }, icon('close', { size: 18 })),
    ),
    h('p', { class: 'small muted' }, 'Kartında hangi kahraman dursun? DOG’luk oyuncudadır, kahramanlar masumdur.'),
    h('div', { class: 'field' }, h('label', { for: 'pf-pick-q', class: 'sr-only' }, 'Kahraman ara'), input),
    h('div', { class: 'pf-pick-tools' }, chips, h('div', { class: 'row pf-pick-actions' }, count, randomBtn, removeBtn)),
    grid,
  );
  paint();
  close = fx.modal(body, { label: 'Avatar seç', cls: 'pf-pick-modal' });
  // Dokunmatikte klavye açılıp ızgarayı kapatmasın: yalnızca ince işaretçide aramaya odaklan
  try {
    if (window.matchMedia('(pointer: fine)').matches) input.focus();
    else document.activeElement && document.activeElement.blur && document.activeElement.blur();
  } catch { /* yok say */ }
  return close;
}
