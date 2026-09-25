// Kahraman seçici: Türkçe duyarsız otomatik tamamlama (ad, iç ad, kısaltma, baş harfler, lakap).
// Öneride portre küçük resmi + ad; ↑/↓/Enter/Esc klavye, dokunmatik dostu (≥ 48 px satırlar).
// DOGdle kullanır; kahraman adı soran başka oyun ya da quiz de aynı bileşeni kullanabilir.
//
//   const picker = createHeroPicker({ onPick(hero) {…}, isExcluded: (hero) => bool });
//   host.appendChild(picker.el); … picker.destroy();

import './heropick.css';
import { h, clear } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { HEROES, ATTRS } from '../../data/heroes.js';
import { heroPortraitUrl } from '../../core/assets.js';
import { normTr } from '../heroes/crest.js';

// Toplulukta yaygın kısa adlar (kısaltma ve baş harfler zaten aranır)
const ALIASES = {
  life_stealer: ['naix'],
  abyssal_underlord: ['pitlord', 'pit lord'],
  skeleton_king: ['skeleton king', 'wk'],
  rattletrap: ['clock', 'rattletrap'],
  vengefulspirit: ['venge'],
  necrolyte: ['necro', 'necrolyte'],
  shredder: ['timber'],
  earthshaker: ['shaker'],
  spirit_breaker: ['bara', 'barathrum'],
  venomancer: ['veno'],
  windrunner: ['windrunner'],
  obsidian_destroyer: ['obsidian'],
  furion: ['np', 'prophet'],
  nevermore: ['sf', 'nevermore'],
  queenofpain: ['qop'],
  doom_bringer: ['doom'],
  magnataur: ['magnataur'],
  wisp: ['wisp'],
  zuus: ['zeus', 'zuus'],
  treant: ['treant'],
  centaur: ['cent'],
  troll_warlord: ['troll'],
  templar_assassin: ['lanaya'],
  phantom_assassin: ['mortred'],
};

const initials = (name) => name.split(/[\s-]+/).filter(Boolean).map((w) => w[0]).join('');

/** Aranabilir anahtarlar (önceden hesaplanır). */
function keysOf(hero) {
  return {
    name: normTr(hero.name),
    words: hero.name.split(/[\s-]+/).map(normTr).filter(Boolean),
    id: normTr(hero.id),
    abbr: normTr(hero.abbr),
    ini: normTr(initials(hero.name)),
    alias: (ALIASES[hero.id] || []).map(normTr),
  };
}

/** Sorguya göre sıralı eşleşmeler (düşük sıra = daha iyi). */
export function searchHeroes(query, list = HEROES, cache = null) {
  const q = normTr(query);
  if (!q) return [];
  const out = [];
  for (const hero of list) {
    const k = cache ? cache.get(hero.id) : keysOf(hero);
    let rank = -1;
    if (k.name === q || k.abbr === q || k.alias.includes(q)) rank = 0;
    else if (k.name.startsWith(q)) rank = 1;
    else if (k.words.some((w) => w.startsWith(q))) rank = 2;
    else if (k.abbr.startsWith(q) || k.ini === q || k.alias.some((a) => a.startsWith(q))) rank = 3;
    else if (k.id.startsWith(q)) rank = 4;
    else if (k.name.includes(q) || k.id.includes(q)) rank = 5;
    if (rank >= 0) out.push([rank, hero]);
  }
  out.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name, 'en'));
  return out.map((x) => x[1]);
}

let seq = 0;

/**
 * @param {object} o
 * @param {(hero) => void} o.onPick         seçim yapıldığında
 * @param {(hero) => boolean} [o.isExcluded] listede gösterilmeyecekler (ör. tahmin edilmişler)
 * @param {string} [o.placeholder]
 * @param {string} [o.label]                 görünmez etiket
 * @param {string} [o.buttonLabel]
 * @param {number} [o.max]                   en fazla öneri
 * @param {(text) => void} [o.onMiss]        eşleşme yokken Enter
 */
export function createHeroPicker({
  onPick,
  isExcluded = () => false,
  placeholder = 'Kahraman adı yaz…',
  label = 'Kahraman ara',
  buttonLabel = 'Tahmin et',
  max = 30,
  onMiss = null,
  heroes = HEROES,
} = {}) {
  const uid = `hp${++seq}`;
  const cache = new Map(heroes.map((x) => [x.id, keysOf(x)]));
  let items = [];
  let active = -1;
  let open = false;
  let disabled = false;

  const input = h('input', {
    class: 'input hp-input',
    id: `${uid}-in`,
    type: 'text',
    inputmode: 'search',
    enterkeyhint: 'go',
    autocomplete: 'off',
    autocapitalize: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    placeholder,
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': `${uid}-list`,
  });
  const list = h('ul', { class: 'hp-list', id: `${uid}-list`, role: 'listbox', 'aria-label': 'Öneriler', hidden: true });
  const go = h('button', { class: 'btn primary hp-go', type: 'button', 'aria-label': buttonLabel }, icon('target', { size: 18 }), h('span', { class: 'hp-go-text' }, buttonLabel));
  const el = h('div', { class: 'hp' },
    h('label', { class: 'sr-only', for: `${uid}-in` }, label),
    h('div', { class: 'hp-field' },
      h('span', { class: 'hp-ico', 'aria-hidden': 'true' }, icon('search', { size: 18 })),
      input,
      list,
    ),
    go,
  );

  function optionEl(hero, i) {
    const url = heroPortraitUrl(hero.id);
    const a = ATTRS[hero.attr] || ATTRS.uni;
    const li = h('li', {
      class: 'hp-opt',
      id: `${uid}-o${i}`,
      role: 'option',
      'aria-selected': 'false',
      dataset: { id: hero.id },
      style: { '--hp-c': a.color },
    },
      h('span', { class: 'hp-thumb', 'aria-hidden': 'true' },
        url ? h('img', { src: url, alt: '', width: '64', height: '36', loading: 'lazy', decoding: 'async' }) : h('span', { class: 'hp-abbr' }, hero.abbr),
      ),
      h('span', { class: 'hp-name' }, highlight(hero.name, input.value)),
      h('span', { class: 'hp-attr', title: a.label }, a.short),
    );
    // Odak girişte kalsın (mobil klavye kapanmasın)
    li.addEventListener('pointerdown', (e) => e.preventDefault());
    li.addEventListener('click', () => choose(hero));
    li.addEventListener('pointermove', () => { if (active !== i) setActive(i, false); });
    return li;
  }

  function render() {
    const q = input.value;
    items = q.trim() ? searchHeroes(q, heroes, cache).filter((x) => !isExcluded(x)).slice(0, max) : [];
    clear(list);
    if (!q.trim()) {
      setOpen(false);
      return;
    }
    if (!items.length) {
      list.appendChild(h('li', { class: 'hp-empty', role: 'presentation' }, 'Eşleşen kahraman yok. Belki de o kahraman henüz DOG’luk başvurusu yapmadı.'));
      active = -1;
      input.removeAttribute('aria-activedescendant');
      setOpen(true);
      return;
    }
    items.forEach((hero, i) => list.appendChild(optionEl(hero, i)));
    setActive(0, false);
    setOpen(true);
  }

  function setOpen(v) {
    open = v;
    list.hidden = !v;
    input.setAttribute('aria-expanded', String(v && items.length > 0));
    el.classList.toggle('open', v);
  }

  function setActive(i, scroll = true) {
    const prev = list.querySelector('.hp-opt.active');
    if (prev) { prev.classList.remove('active'); prev.setAttribute('aria-selected', 'false'); }
    active = i;
    const li = list.children[i];
    if (!li || !li.classList.contains('hp-opt')) { input.removeAttribute('aria-activedescendant'); return; }
    li.classList.add('active');
    li.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', li.id);
    if (scroll) li.scrollIntoView({ block: 'nearest' });
  }

  function choose(hero) {
    if (disabled || !hero || isExcluded(hero)) return;
    input.value = '';
    items = [];
    clear(list);
    setOpen(false);
    input.removeAttribute('aria-activedescendant');
    onPick && onPick(hero);
  }

  function submit() {
    if (disabled) return;
    if (!input.value.trim()) { input.focus(); return; }
    if (!items.length) render();
    if (items.length) choose(items[Math.max(0, active)]);
    else if (onMiss) onMiss(input.value);
  }

  function onKey(e) {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) render();
      if (items.length) setActive((active + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length) setActive((active - 1 + items.length) % items.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
      else if (input.value) { e.preventDefault(); input.value = ''; }
    } else if (e.key === 'Tab' && open && items.length && input.value.trim()) {
      // Tab öneriyi tamamlar (odak zinciri bozulmasın diye yalnızca bir kez)
      const hero = items[Math.max(0, active)];
      if (hero && normTr(input.value) !== normTr(hero.name)) {
        e.preventDefault();
        input.value = hero.name;
        render();
      }
    }
  }

  const onInput = () => render();
  const onFocus = () => { if (input.value.trim()) render(); };
  // Liste dışına tıklanınca kapat
  const onDocDown = (e) => { if (open && !el.contains(e.target)) setOpen(false); };
  input.addEventListener('keydown', onKey);
  input.addEventListener('input', onInput);
  input.addEventListener('focus', onFocus);
  go.addEventListener('click', submit);
  document.addEventListener('pointerdown', onDocDown);

  return {
    el,
    input,
    focus(opts = { preventScroll: true }) { try { input.focus(opts); } catch { input.focus(); } },
    clear() { input.value = ''; render(); },
    refresh() { if (open) render(); },
    close() { setOpen(false); },
    setDisabled(v) {
      disabled = !!v;
      input.disabled = disabled;
      go.disabled = disabled;
      if (disabled) setOpen(false);
    },
    destroy() {
      input.removeEventListener('keydown', onKey);
      input.removeEventListener('input', onInput);
      input.removeEventListener('focus', onFocus);
      go.removeEventListener('click', submit);
      document.removeEventListener('pointerdown', onDocDown);
      el.remove();
    },
  };
}

/** Adın sorguyla eşleşen kısmını vurgular (Türkçe duyarsız, en basit önek/içerir eşlemesi). */
function highlight(name, query) {
  const q = normTr(query);
  if (!q) return name;
  // Ad karakterlerini normalize edilmiş dizine eşle
  const map = [];
  let norm = '';
  for (let i = 0; i < name.length; i++) {
    const n = normTr(name[i]);
    for (let k = 0; k < n.length; k++) { norm += n[k]; map.push(i); }
  }
  const at = norm.indexOf(q);
  if (at < 0) return name;
  const s = map[at];
  const e = map[at + q.length - 1] + 1;
  return [name.slice(0, s), h('mark', null, name.slice(s, e)), name.slice(e)];
}
