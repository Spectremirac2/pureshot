// 1vDOQUZ Arena — Kodeks: görülen birimler, bosslar, eşyalar ve hikâye kartları (koleksiyon). Belge: docs/ARENA-ILERLEME.md
// progression.js'in tembel arayüz parçası.
//
//   mountCodex(el, ctx) → temizlik   ctx: { kind?: 'units'|'bosses'|'items'|'story', onClose?() }
//   markSeen(kind, id)               progression.markSeen (kolaylık için yeniden dışa aktarılır)
//
// Görülmeyen girdiler siluet olarak durur; Kütüphane’deki “Kâşif Dürbünü” ipucunu, “Kurye’nin Notları” Kurye’nin
// yorumunu açar. Kartlar tek sekme durağıdır (roving tabindex; oklar ızgarada gezer).

import './codex.css';
import { h, clear, append, fmtNum, prefersReducedMotion } from '../../../core/dom.js';
import { icon } from '../../../core/icons.js';
import { store } from '../../../core/store.js';
import { sound } from '../../../core/sound.js';
import { itemIconUrl, portraitUrl } from '../../../core/assets.js';
import { ARCHETYPES } from '../../../data/archetypes.js';
import * as Dogs from './dogs.js';
import * as Glyphs from './glyphs.js';
import * as PR from './progression.js';

PR.connectStore(store);
export const markSeen = PR.markSeen;

const ARCH = Object.fromEntries(ARCHETYPES.map((a) => [a.id, a]));
const dateFmt = (() => { try { return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return null; } })();
const fmtDate = (t) => (dateFmt ? dateFmt.format(new Date(t)) : new Date(t).toISOString().slice(0, 10));
const pretty = (id) => String(id).replace(/^(dog|creep|neutral|boss|tower)_/, '').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toLocaleUpperCase('tr-TR'));

/** Katalog + DOG arşivi zenginleştirmesi + görülen ama katalogda olmayanlar. */
function entries(kind, seenMap) {
  const cat = PR.codexCatalog()[kind] || [];
  const list = cat.map((e) => {
    const x = { ...e };
    if (e.dog) {
      const A = ARCH[e.dog];
      const T = (Dogs.DOG_TYPES || {})[e.dog];
      if (A) { x.name = A.name; x.color = A.color; x.sub = A.title; x.lore = x.lore || `Kurye diyor ki: “${A.tagline}”`; }
      if (T && T.hint) x.desc = T.hint;
      x.img = portraitUrl(e.dog);
    }
    if (kind === 'items' && e.icon) x.img = itemIconUrl(e.icon);
    if (kind === 'items' && e.cost) x.sub = `${fmtNum(e.cost)} altın`;
    return x;
  });
  for (const id of Object.keys(seenMap || {})) {
    if (!list.some((e) => e.id === id)) list.push({ id, name: pretty(id), group: 'Diğer', desc: 'Kodeks bu girdiyi tanıyor ama Kurye henüz not düşmedi.', icon: 'question' });
  }
  return list;
}

function art(e, seen, big = false) {
  const col = e.color || 'var(--aegis)';
  if (seen && e.img) return h('span', { class: `arc-art is-img${big ? ' is-big' : ''}`, style: { '--ec': col } }, h('img', { src: e.img, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' }));
  const G = Glyphs.GLYPH || {};
  const inner = e.glyph && G[e.glyph] ? h('span', { class: 'arc-glyph', html: G[e.glyph] }) : icon(e.icon || 'question', { size: big ? 40 : 26, stroke: 1.7 });
  return h('span', { class: `arc-art${big ? ' is-big' : ''}${seen ? '' : ' is-hidden'}`, style: { '--ec': col } }, seen ? inner : icon('question', { size: big ? 38 : 24, stroke: 1.8 }));
}

export function mountCodex(el, ctx = {}) {
  const reduce = prefersReducedMotion();
  let kind = PR.CODEX_KINDS.some((k) => k.id === ctx.kind) ? ctx.kind : 'units';
  let selected = null;
  const root = h('section', { class: 'arc', 'aria-label': 'Kodeks' });
  const totalN = h('span', { class: 'arc-total-n num' });
  const totalBar = h('span', { class: 'arc-total-bar' }, h('i'));
  const head = h('header', { class: 'arc-head' },
    h('div', { class: 'arc-titles' },
      h('span', { class: 'eyebrow' }, 'Kodeks'),
      h('h2', { class: 'arc-h' }, 'Dokuzun Laneti ansiklopedisi'),
      h('p', { class: 'arc-lead' }, 'Arena’da gördüğün her DOG, creep, orman canavarı, boss ve eşya buraya işlenir. Hikâye kartlarını Kurye anlatır; biraz abartır.'),
    ),
    h('div', { class: 'arc-side' },
      h('div', { class: 'arc-total' }, h('span', { class: 'arc-total-l' }, 'Koleksiyon'), totalN, totalBar),
      ctx.onClose ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => ctx.onClose() }, icon('arrowLeft', { size: 16 }), 'Geri') : null,
    ),
  );
  const tabs = h('div', { class: 'arc-tabs', role: 'tablist', 'aria-label': 'Kodeks bölümleri' });
  const tabEls = {};
  for (const K of PR.CODEX_KINDS) {
    const cnt = h('span', { class: 'arc-tab-n num' });
    const t = h('button', { class: 'arc-tab', type: 'button', role: 'tab', id: `arc-tab-${K.id}`, 'aria-controls': 'arc-panel', dataset: { k: K.id } }, icon(K.icon, { size: 16 }), h('span', null, K.name), cnt);
    t.addEventListener('click', () => setKind(K.id));
    t.addEventListener('keydown', (e) => {
      const ids = PR.CODEX_KINDS.map((x) => x.id);
      const i = ids.indexOf(kind);
      let j = -1;
      if (e.key === 'ArrowRight') j = (i + 1) % ids.length;
      else if (e.key === 'ArrowLeft') j = (i + ids.length - 1) % ids.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = ids.length - 1;
      if (j < 0) return;
      e.preventDefault();
      setKind(ids[j]);
      tabEls[ids[j]].t.focus();
    });
    tabEls[K.id] = { t, cnt };
    tabs.appendChild(t);
  }
  const grid = h('div', { class: 'arc-grid', role: 'tabpanel', id: 'arc-panel' });
  const detail = h('aside', { class: 'arc-detail', 'aria-live': 'polite', 'aria-label': 'Seçili girdi' });
  const body = h('div', { class: 'arc-body' }, grid, detail);
  root.append(head, tabs, body);
  clear(el);
  el.appendChild(root);

  let cards = [];
  let lens = false;
  let lore = false;
  let seenAll = {};

  function load() {
    const P = PR.getProfile();
    lens = !!P.unlocks.x_lens;
    lore = !!P.unlocks.x_lore;
    seenAll = PR.exportMeta().codex || {};
    let have = 0;
    let total = 0;
    for (const K of PR.CODEX_KINDS) {
      const list = entries(K.id, seenAll[K.id]);
      const got = list.filter((e) => seenAll[K.id] && seenAll[K.id][e.id]).length;
      have += got;
      total += list.length;
      tabEls[K.id].cnt.textContent = `${got}/${list.length}`;
      tabEls[K.id].t.setAttribute('aria-selected', String(K.id === kind));
      tabEls[K.id].t.tabIndex = K.id === kind ? 0 : -1;
    }
    totalN.textContent = `${have}/${total}`;
    totalBar.firstChild.style.width = `${total ? Math.round((have / total) * 100) : 0}%`;
  }

  function setKind(k) {
    if (k === kind) return;
    kind = k;
    selected = null;
    render();
  }

  function render() {
    load();
    grid.setAttribute('aria-labelledby', `arc-tab-${kind}`);
    clear(grid);
    cards = [];
    const seen = seenAll[kind] || {};
    const list = entries(kind, seen);
    if (!selected) selected = (list.find((e) => seen[e.id]) || list[0] || {}).id || null;
    const groups = [];
    for (const e of list) {
      let g = groups.find((x) => x.name === (e.group || 'Genel'));
      if (!g) { g = { name: e.group || 'Genel', items: [] }; groups.push(g); }
      g.items.push(e);
    }
    for (const g of groups) {
      const got = g.items.filter((e) => seen[e.id]).length;
      const wrap = h('div', { class: 'arc-group', role: 'list', 'aria-label': `${g.name}: ${got}/${g.items.length}` });
      for (const e of g.items) {
        const isSeen = !!seen[e.id];
        const c = h('button', {
          class: `arc-card${isSeen ? ' is-seen' : ''}`, type: 'button', role: 'listitem', dataset: { id: e.id },
          style: { '--ec': e.color || 'var(--aegis)' }, tabindex: e.id === selected ? '0' : '-1', 'aria-current': e.id === selected ? 'true' : null,
          'aria-label': isSeen ? `${e.name}. ${g.name}.` : `Görülmedi. ${g.name}.${lens ? ` İpucu: ${hint(e)}` : ''}`,
        },
          art(e, isSeen),
          h('span', { class: 'arc-card-name' }, isSeen ? e.name : '???'),
          h('span', { class: 'arc-card-sub' }, isSeen ? (e.sub || g.name) : lens ? hint(e) : 'Henüz görülmedi'),
        );
        c.addEventListener('click', () => select(e.id, true));
        c.addEventListener('keydown', onCardKey);
        cards.push(c);
        wrap.appendChild(c);
      }
      grid.append(h('h3', { class: 'arc-group-h' }, g.name, h('span', { class: 'num' }, `${got}/${g.items.length}`)), wrap);
    }
    renderDetail();
  }

  function hint(e) {
    const d = String(e.desc || '').split(/[.:]/)[0].trim();
    return d ? `${d.slice(0, 46)}${d.length > 46 ? '…' : ''}` : e.group || '';
  }

  function renderDetail() {
    clear(detail);
    const seen = seenAll[kind] || {};
    const e = entries(kind, seen).find((x) => x.id === selected);
    if (!e) { detail.append(h('p', { class: 'arc-empty' }, 'Bir girdi seç.')); return; }
    const isSeen = !!seen[e.id];
    detail.style.setProperty('--ec', e.color || 'var(--aegis)');
    append(detail, [
      h('div', { class: 'arc-d-art' }, art(e, isSeen, true)),
      h('span', { class: 'arc-d-group' }, e.group || ''),
      h('h3', { class: 'arc-d-name' }, isSeen ? e.name : '???'),
      isSeen && e.sub && !e.item ? h('span', { class: 'arc-d-sub' }, e.sub) : null,
      h('p', { class: 'arc-d-desc' }, isSeen ? e.desc || '' : lens ? `İpucu: ${hint(e)}` : 'Henüz görülmedi. Arena’da karşılaşınca buraya işlenir. (Kütüphane’deki Kâşif Dürbünü ipucu gösterir.)'),
      isSeen && e.cost ? h('p', { class: 'arc-d-meta' }, icon('coin', { size: 14 }), `${fmtNum(e.cost)} altın`) : null,
      isSeen && lore && e.lore ? h('p', { class: 'arc-d-lore' }, icon('courier', { size: 16 }), e.lore) : null,
      isSeen && !lore && e.lore ? h('p', { class: 'arc-d-lock' }, icon('lock', { size: 13 }), 'Kurye’nin notu Kütüphane’de: Kurye’nin Notları') : null,
      isSeen ? h('p', { class: 'arc-d-date' }, `İlk görülme: ${fmtDate(seen[e.id])}`) : null,
    ]);
  }

  function select(id, fromPointer, focus = false) {
    selected = id;
    for (const c of cards) {
      const on = c.dataset.id === id;
      c.tabIndex = on ? 0 : -1;
      if (on) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
      if (on && focus) c.focus();
    }
    renderDetail();
    try { sound.click(); } catch { /* ses kapalı */ }
    if (fromPointer && root.clientWidth < 760) {
      const r = detail.getBoundingClientRect();
      if (r.top > window.innerHeight - 100 || r.bottom < 0) detail.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }
  }

  function onCardKey(e) {
    const i = cards.indexOf(e.currentTarget);
    if (i < 0) return;
    // görünür sütun sayısı: aynı satırdaki kartlar
    const top = cards[i].offsetTop;
    const rowStart = cards.findIndex((c) => c.offsetTop === top && c.parentNode === cards[i].parentNode);
    let cols = 0;
    for (let k = rowStart; k < cards.length && cards[k].offsetTop === top && cards[k].parentNode === cards[i].parentNode; k++) cols++;
    cols = Math.max(1, cols);
    let j = -1;
    if (e.key === 'ArrowRight') j = Math.min(cards.length - 1, i + 1);
    else if (e.key === 'ArrowLeft') j = Math.max(0, i - 1);
    else if (e.key === 'ArrowDown') j = Math.min(cards.length - 1, i + cols);
    else if (e.key === 'ArrowUp') j = Math.max(0, i - cols);
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = cards.length - 1;
    if (j < 0) return;
    e.preventDefault();
    select(cards[j].dataset.id, false, true);
  }

  render();
  const unsub = PR.subscribeMeta(() => { if (root.isConnected && !root.contains(document.activeElement)) render(); });
  return () => { unsub(); root.remove(); };
}
