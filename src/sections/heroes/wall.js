// Kahraman Duvarı: öne çıkan dava, En DOG 5 / En masum 5 şeritleri, filtreler ve 127 kart.

import { h, clear, ls } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { HEROES, ATTRS, ROLES, heroById } from '../../data/heroes.js';
import { crestSvg, setCrestValue, normTr } from './crest.js';
import { attachTilt } from '../../components/tilt.js';

const FEATURED = ['spectre', 'techies', 'pudge', 'meepo', 'invoker', 'antimage', 'huskar', 'furion', 'riki', 'wisp', 'sniper', 'tinker', 'faceless_void', 'arc_warden'];
const SORTS = [
  { id: 'bias', label: 'DOG% · ön yargı' },
  { id: 'live', label: 'DOG% · topluluk' },
  { id: 'name', label: 'Ada göre (A–Z)' },
  { id: 'complexity', label: 'Karmaşıklık' },
];

export function mountWall(host, env) {
  const { comm, ctx } = env;
  const cleanups = [];
  const state = {
    q: '',
    attr: 'all',
    roles: new Set(),
    attack: 'all',
    sort: SORTS.some((s) => s.id === ls.get('hr:sort')) ? ls.get('hr:sort') : 'bias',
  };
  const metric = () => (state.sort === 'live' ? 'live' : 'bias');
  const val = (id) => comm.value(id, metric());

  // ---------------------------------------------------------------- öne çıkan dava
  let featIdx = 0;
  const feat = h('section', { class: 'hr-feat panel raised frame', 'aria-label': 'Öne çıkan dava' });
  let detachTilt = () => {};
  function renderFeat() {
    const hero = heroById(FEATURED[featIdx % FEATURED.length]);
    const s = comm.get(hero.id);
    detachTilt();
    clear(feat);
    const art = h('a', { class: 'hr-feat-art', href: `#kahramanlar--${hero.id}`, 'aria-label': `${hero.name} dosyasını aç` },
      crestSvg(hero, { value: s ? s.live : hero.dogRate }),
      s ? h('span', { class: `hr-feat-tier hr-t-${s.tier.id}`, title: s.tier.label }, s.tier.id) : null,
    );
    feat.append(
      art,
      h('div', { class: 'hr-feat-body' },
        h('span', { class: 'eyebrow' }, `Öne çıkan dava · ${featIdx % FEATURED.length + 1}/${FEATURED.length}`),
        h('h2', { class: 'h2 hr-feat-name' }, hero.name),
        h('p', { class: 'hr-quote' }, hero.prejudice.replace(/^Topluluk der ki:\s*/, '')),
        h('p', { class: 'small muted hr-feat-why' }, hero.why),
        h('div', { class: 'hr-feat-meters' },
          meterRow('Ön yargı', hero.dogRate, 'bias'),
          meterRow('Topluluk', s ? s.live : hero.dogRate, 'live', s ? `${s.total} oy` : '0 oy'),
        ),
        h('div', { class: 'hr-tags' }, hero.tags.map((t) => h('span', { class: 'hr-tag' }, '#', t))),
        h('div', { class: 'row hr-feat-actions' },
          h('a', { class: 'btn primary', href: `#kahramanlar--${hero.id}`, onclick: () => ctx.sound.click() }, icon('eye', { size: 18 }), 'Dosyayı aç'),
          h('button', {
            class: 'btn ghost', type: 'button',
            onclick: () => { ctx.sound.whoosh(); featIdx++; renderFeat(); },
          }, 'Sonraki dava', icon('arrowRight', { size: 18 })),
        ),
      ),
    );
    detachTilt = attachTilt(art, { max: 12 });
  }

  function meterRow(label, v, kind, extra) {
    return h('div', { class: `hr-meter-row is-${kind}` },
      h('span', { class: 'hr-meter-label' }, label),
      h('span', { class: 'hr-meter' }, h('span', { style: { width: `${Math.round(v)}%` } })),
      h('span', { class: 'mono hr-meter-val' }, `%${Math.round(v)}`, extra ? h('small', null, ' · ', extra) : null),
    );
  }

  // ---------------------------------------------------------------- şeritler
  const topList = h('ol', { class: 'hr-strip-list' });
  const lowList = h('ol', { class: 'hr-strip-list' });
  const topTitle = h('h3', { class: 'h3' });
  const lowTitle = h('h3', { class: 'h3' });
  const strips = h('div', { class: 'hr-strips' },
    h('section', { class: 'panel tight hr-strip is-top' }, h('div', { class: 'panel-head' }, h('span', { class: 'hr-strip-ic' }, icon('flame', { size: 18 })), topTitle), topList),
    h('section', { class: 'panel tight hr-strip is-low' }, h('div', { class: 'panel-head' }, h('span', { class: 'hr-strip-ic' }, icon('shield', { size: 18 })), lowTitle), lowList),
  );
  function renderStrips() {
    const m = metric();
    const byVal = HEROES.slice().sort((a, b) => val(b.id) - val(a.id) || a.name.localeCompare(b.name));
    const suffix = m === 'live' ? ' · topluluk' : ' · ön yargı';
    topTitle.textContent = 'En DOG 5' + suffix;
    lowTitle.textContent = 'En masum 5' + suffix;
    const row = (hero, i) => h('li', null,
      h('a', { class: 'hr-strip-row', href: `#kahramanlar--${hero.id}` },
        h('span', { class: 'hr-strip-rank mono' }, String(i + 1)),
        crestSvg(hero, { value: val(hero.id), cls: 'hr-crest-sm' }),
        h('span', { class: 'hr-strip-name' }, hero.name),
        h('span', { class: 'hr-strip-val mono' }, `%${Math.round(val(hero.id))}`),
      ),
    );
    clear(topList).append(...byVal.slice(0, 5).map(row));
    clear(lowList).append(...byVal.slice(-5).reverse().map(row));
  }

  // ---------------------------------------------------------------- filtreler
  const search = h('input', { class: 'input', id: 'hr-search', type: 'search', placeholder: 'Kahraman, rol ya da etiket ara… (ör. farm, hook, np)', autocomplete: 'off', spellcheck: 'false' });
  const sortSel = h('select', { class: 'select', id: 'hr-sort' }, SORTS.map((s) => h('option', { value: s.id, selected: s.id === state.sort }, s.label)));
  const countEl = h('p', { class: 'hr-count small muted', 'aria-live': 'polite' });
  const resetBtn = h('button', { class: 'btn ghost sm', type: 'button', onclick: resetFilters }, icon('refresh', { size: 16 }), 'Filtreleri temizle');

  const attrChips = [{ id: 'all', label: 'Tümü' }, ...Object.values(ATTRS)].map((a) => {
    const b = h('button', { class: `chip hr-chip${a.id !== 'all' ? ' hr-a-' + a.id : ''}`, type: 'button', 'aria-pressed': String(state.attr === a.id), dataset: { v: a.id } },
      a.id !== 'all' ? h('span', { class: 'hr-dot', 'aria-hidden': 'true' }) : null, a.label);
    b.addEventListener('click', () => { state.attr = a.id; ctx.sound.click(); syncChips(); apply(); });
    return b;
  });
  const roleChips = Object.entries(ROLES).map(([id, label]) => {
    const b = h('button', { class: 'chip hr-chip', type: 'button', 'aria-pressed': 'false', title: id, dataset: { v: id } }, label);
    b.addEventListener('click', () => {
      if (state.roles.has(id)) state.roles.delete(id);
      else state.roles.add(id);
      ctx.sound.click();
      syncChips();
      apply();
    });
    return b;
  });
  const attackChips = [{ id: 'all', label: 'Hepsi' }, { id: 'Melee', label: 'Yakın' }, { id: 'Ranged', label: 'Menzilli' }].map((a) => {
    const b = h('button', { class: 'chip hr-chip', type: 'button', 'aria-pressed': String(state.attack === a.id) }, a.label);
    b.addEventListener('click', () => { state.attack = a.id; ctx.sound.click(); syncChips(); apply(); });
    b.dataset.v = a.id;
    return b;
  });
  function syncChips() {
    const n = (state.attr !== 'all' ? 1 : 0) + state.roles.size + (state.attack !== 'all' ? 1 : 0);
    activeCount.hidden = !n;
    activeCount.textContent = `${n} seçili`;
    attrChips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state.attr)));
    roleChips.forEach((b) => b.setAttribute('aria-pressed', String(state.roles.has(b.dataset.v))));
    attackChips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state.attack)));
  }

  const activeCount = h('span', { class: 'badge ember hr-more-count', hidden: true });
  const moreBox = h('details', { class: 'hr-more', open: !matchMedia('(max-width: 720px)').matches },
    h('summary', { class: 'hr-more-sum' }, icon('target', { size: 16 }), 'Özellik, rol ve saldırı', activeCount, h('span', { class: 'hr-more-chev', 'aria-hidden': 'true' }, icon('arrowRight', { size: 16 }))),
    h('div', { class: 'hr-more-body' },
      h('div', { class: 'hr-chip-row', role: 'group', 'aria-label': 'Özellik' }, h('span', { class: 'hr-chip-label' }, 'Özellik'), attrChips),
      h('div', { class: 'hr-chip-row', role: 'group', 'aria-label': 'Rol' }, h('span', { class: 'hr-chip-label' }, 'Rol'), roleChips),
      h('div', { class: 'hr-chip-row', role: 'group', 'aria-label': 'Saldırı' }, h('span', { class: 'hr-chip-label' }, 'Saldırı'), attackChips),
    ),
  );
  const filters = h('section', { class: 'hr-filters panel tight', 'aria-label': 'Filtreler' },
    h('div', { class: 'hr-filter-top' },
      h('div', { class: 'field hr-search' }, h('label', { for: 'hr-search' }, 'Ara'), search),
      h('div', { class: 'field hr-sort' }, h('label', { for: 'hr-sort' }, 'Sırala'), sortSel),
    ),
    moreBox,
    h('div', { class: 'row hr-filter-foot' }, countEl, h('span', { class: 'spacer' }), resetBtn),
  );

  let qTimer = 0;
  search.addEventListener('input', () => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { state.q = search.value; apply(); }, 90);
  });
  sortSel.addEventListener('change', () => {
    state.sort = sortSel.value;
    ls.set('hr:sort', state.sort);
    ctx.sound.click();
    apply(true);
    renderStrips();
  });
  cleanups.push(() => clearTimeout(qTimer));

  function resetFilters() {
    state.q = '';
    search.value = '';
    state.attr = 'all';
    state.roles.clear();
    state.attack = 'all';
    syncChips();
    apply();
  }

  // ---------------------------------------------------------------- kartlar
  const grid = h('div', { class: 'hr-grid' });
  const emptyEl = h('div', { class: 'empty hr-empty', hidden: true },
    icon('eye', { size: 28 }),
    h('p', null, 'Bu filtrelere uyan kahraman yok. Belki de o kahraman henüz DOG’luk başvurusu yapmadı.'),
    h('button', { class: 'btn ghost sm', type: 'button', onclick: resetFilters }, 'Filtreleri temizle'),
  );
  const cards = new Map();
  const haystack = new Map();
  for (const hero of HEROES) {
    haystack.set(hero.id, [hero.name, hero.id, hero.abbr, ATTRS[hero.attr].label, hero.attack === 'Melee' ? 'yakın' : 'menzilli', ...hero.roles, ...hero.roles.map((r) => ROLES[r]), ...hero.tags, hero.archetype].map(normTr).join('|'));
    const crest = crestSvg(hero);
    const pct = h('span', { class: 'hr-card-pct mono' });
    const pctLabel = h('span', { class: 'hr-card-pct-label' });
    const tierB = h('span', { class: 'hr-tier-badge' });
    const bar = h('span', { class: 'hr-card-bar-fill' });
    const short = hero.prejudice.replace(/^Topluluk der ki:\s*/, '');
    const card = h('a', { class: `hr-card hr-a-${hero.attr}`, href: `#kahramanlar--${hero.id}` },
      h('span', { class: 'hr-card-top' },
        crest,
        h('span', { class: 'hr-card-score' }, pct, pctLabel),
      ),
      h('span', { class: 'hr-card-name' }, hero.name),
      h('span', { class: 'hr-card-badges' },
        h('span', { class: `hr-attr-badge hr-a-${hero.attr}` }, ATTRS[hero.attr].short),
        tierB,
      ),
      h('span', { class: 'hr-card-bar', 'aria-hidden': 'true' }, bar),
      h('span', { class: 'hr-card-quote' }, short),
    );
    card.addEventListener('click', () => ctx.sound.click());
    cards.set(hero.id, { card, crest, pct, pctLabel, tierB, bar });
    grid.appendChild(card);
  }

  function updateCardValues() {
    const m = metric();
    for (const hero of HEROES) {
      const c = cards.get(hero.id);
      const s = comm.get(hero.id);
      const v = s ? (m === 'live' ? s.live : s.bias) : hero.dogRate;
      const t = s ? (m === 'live' ? s.tier : s.biasTier) : null;
      c.pct.textContent = `%${Math.round(v)}`;
      c.pctLabel.textContent = m === 'live' ? (s && s.total ? `${s.total} oy` : 'topluluk') : 'ön yargı';
      setCrestValue(c.crest, v);
      c.bar.style.width = `${Math.round(v)}%`;
      if (t) {
        c.tierB.className = `hr-tier-badge hr-t-${t.id}`;
        c.tierB.textContent = `${t.id} · ${t.label}`;
      }
    }
  }

  function apply(resort = false) {
    const toks = state.q.split(/\s+/).map(normTr).filter(Boolean);
    let shown = 0;
    const list = sortedHeroes();
    for (const hero of list) {
      const hay = haystack.get(hero.id);
      const ok = (state.attr === 'all' || hero.attr === state.attr)
        && (state.attack === 'all' || hero.attack === state.attack)
        && [...state.roles].every((r) => hero.roles.includes(r))
        && toks.every((t) => hay.includes(t));
      const c = cards.get(hero.id).card;
      c.hidden = !ok;
      if (ok) shown++;
    }
    if (resort) {
      for (const hero of list) grid.appendChild(cards.get(hero.id).card);
    }
    const filtered = shown !== HEROES.length;
    countEl.textContent = filtered ? `${HEROES.length} kahramandan ${shown} tanesi gösteriliyor` : `${HEROES.length} kahramanın hepsi gösteriliyor`;
    resetBtn.hidden = !filtered;
    emptyEl.hidden = shown > 0;
    updateCardValues();
  }

  function sortedHeroes() {
    const arr = HEROES.slice();
    if (state.sort === 'name') arr.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    else if (state.sort === 'complexity') arr.sort((a, b) => b.complexity - a.complexity || comm.value(b.id, 'bias') - comm.value(a.id, 'bias') || a.name.localeCompare(b.name));
    else arr.sort((a, b) => val(b.id) - val(a.id) || a.name.localeCompare(b.name));
    return arr;
  }

  // ---------------------------------------------------------------- yerleşim
  host.append(
    h('div', { class: 'hr-wall-top' }, feat, strips),
    filters,
    grid,
    emptyEl,
  );
  renderFeat();
  renderStrips();
  apply(true);

  // Topluluk verisi değişince: değerler güncellenir; topluluk sıralamasında yeniden sıralanır.
  let pending = 0;
  cleanups.push(comm.subscribe(() => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      apply(state.sort === 'live');
      renderStrips();
      renderFeat();
    });
  }));
  cleanups.push(() => cancelAnimationFrame(pending));

  return {
    onShow() {},
    destroy() {
      detachTilt();
      for (const c of cleanups) c();
      clear(host);
    },
  };
}
