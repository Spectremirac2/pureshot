// 1vDOQUZ Arena — Aghanim Kütüphanesi: kalıcı ilerleme ağacı (Parıltı Taşı harcanır). Belge: docs/ARENA-ILERLEME.md
// progression.js'in tembel arayüz parçası (progression.mountLibrary bunu yükler; doğrudan da içe aktarılabilir).
//
//   mountLibrary(el, ctx) → temizlik   ctx: { branch?, onClose?(), onHero?(heroId), onChange?(profil), title? }
//   mountCursePicker(el, ctx) → temizlik   sonraki koşunun Lanet seviyesi (başlangıç ekranı için küçük seçici)
//   gem(cls) · heroEmblem(id) · rankMedal(tier) · shardText(n)   mastery.js / codex.js ile ortak parçalar
//
// Erişilebilirlik: dallar role=tablist (ok tuşları), ağaç tek sekme durağı (roving tabindex; oklar düğümler
// arasında gezer, Enter/Boşluk seçer), ayrıntı paneli aria-live. Satın alma iki adımlıdır (yanlış dokunuşa karşı).

import './library.css';
import { h, clear, fmtNum, prefersReducedMotion } from '../../../core/dom.js';
import { icon } from '../../../core/icons.js';
import { store } from '../../../core/store.js';
import { sound } from '../../../core/sound.js';
import { fx } from '../../../core/fx.js';
import * as Glyphs from './glyphs.js';
import * as PR from './progression.js';

PR.connectStore(store);

// ------------------------------------------------------------------ ortak parçalar
/** Parıltı Taşı: düşük poligon kristal (gradyan kimliği yok: sayfada çok kopya güvenle durur). */
const GEM_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">'
  + '<path d="M16 2 26 11 16 30 6 11Z" fill="#5b4cc9"/>'
  + '<path d="M16 2 26 11 16 13Z" fill="#b8adff"/><path d="M16 2 6 11 16 13Z" fill="#8b7cff"/>'
  + '<path d="M6 11 16 13 16 30Z" fill="#6d5ee0"/><path d="M26 11 16 13 16 30Z" fill="#43379e"/>'
  + '<path d="M16 2 19 7 16 13 13 7Z" fill="#e6e1ff" opacity=".85"/>'
  + '<path d="M16 13 19 18 16 30 13 18Z" fill="#8b7cff" opacity=".55"/>'
  + '<path d="M22.5 4.5l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z" fill="#f6d98a"/>'
  + '</svg>';
export function gem(cls = '') {
  return h('span', { class: `arl-gem ${cls}`.trim(), 'aria-hidden': 'true', html: GEM_SVG });
}
export const shardText = (n) => `${fmtNum(n)} Parıltı`;

/** Kahraman amblemi: glyphs.js'te varsa özgün glif, yoksa ikon. */
export function heroEmblem(heroId, cls = '') {
  const info = PR.heroInfo(heroId);
  const G = Glyphs.GLYPH || {};
  const inner = G[info.id] ? h('span', { class: 'arl-emb-g', html: G[info.id] }) : icon(info.icon, { size: 22, stroke: 1.9 });
  return h('span', { class: `arl-emb ${cls}`.trim(), style: { '--hc': info.color }, 'aria-hidden': 'true' }, inner);
}

const RANK_PIPS = [0, 1, 2, 3, 4, 5, 5, 5];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
/** Dota madalyası esintili rütbe rozeti (SVG). tier: 0–7 */
export function rankMedal(tier, { size = 44, label = true } = {}) {
  const T = PR.MASTERY_TIERS[Math.max(0, Math.min(7, tier | 0))];
  const pips = RANK_PIPS[tier] || 0;
  let stars = '';
  for (let i = 0; i < pips; i++) {
    const x = 16 + (i - (pips - 1) / 2) * 5.2;
    stars += `<circle cx="${x.toFixed(1)}" cy="34.6" r="1.5" fill="#f6d98a"/>`;
  }
  const crown = tier >= 7 ? '<path d="M10 7.5l3.5 3 2.5-4.5 2.5 4.5 3.5-3-1.2 6H11.2z" fill="#f6d98a" stroke="#1c1405" stroke-width=".6"/>' : '';
  const wing = tier >= 5 ? '<path d="M5.5 16c-2.6 1.8-3.3 5.2-2 8.4 1.3-2.2 2.9-3.3 4.7-3.6M26.5 16c2.6 1.8 3.3 5.2 2 8.4-1.3-2.2-2.9-3.3-4.7-3.6" fill="none" stroke="' + T.color + '" stroke-width="1.6" stroke-linecap="round"/>' : '';
  const svg = `<svg viewBox="0 0 32 40" width="${size * 0.8}" height="${size}" aria-hidden="true" focusable="false">`
    + wing
    + `<path d="M16 4 27 10v12c0 6.5-4.6 11.4-11 13.5C9.6 33.4 5 28.5 5 22V10Z" fill="#15121f" stroke="${T.color}" stroke-width="2"/>`
    + `<path d="M16 8.5 23.5 12.6v8.9c0 4.6-3.1 8.2-7.5 9.8-4.4-1.6-7.5-5.2-7.5-9.8v-8.9Z" fill="${T.color}" opacity=".28"/>`
    + `<text x="16" y="24.2" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="700" font-size="${[10.5, 10, 9, 9, 10.5, 9, 7.6, 6.4][tier] || 9}" fill="${T.color}">${ROMAN[tier] || ''}</text>`
    + stars + crown + '</svg>';
  return h('span', { class: 'arl-medal', style: { '--rc': T.color }, title: label ? T.name : null, 'aria-hidden': 'true', html: svg });
}

const STATE_TEXT = {
  owned: 'Açık', ready: 'Açılabilir', poor: 'Parıltı yetmiyor', locked: 'Kilitli', claimable: 'Ödül hazır', claimed: 'Toplandı',
};

function costBit(n) {
  const st = n.status;
  if (st.state === 'owned') return h('span', { class: 'arl-cost is-owned' }, icon('check', { size: 12, stroke: 2.6 }), 'Açık');
  if (st.state === 'claimed') return h('span', { class: 'arl-cost is-owned' }, icon('check', { size: 12, stroke: 2.6 }), 'Toplandı');
  if (n.type === 'claim') return h('span', { class: `arl-cost is-reward${st.state === 'claimable' ? ' is-hot' : ''}` }, '+', fmtNum(st.reward), gem('sm'));
  if (st.state === 'locked') return h('span', { class: 'arl-cost is-locked' }, icon('lock', { size: 12, stroke: 2.2 }), fmtNum(st.cost));
  return h('span', { class: `arl-cost${st.state === 'ready' ? ' is-hot' : ''}` }, gem('sm'), fmtNum(st.cost));
}

function nodeAria(n, B) {
  const st = n.status;
  const bits = [n.name + (n.sub ? ` · ${n.sub}` : ''), STATE_TEXT[st.state] || ''];
  if (n.type === 'claim' && st.state !== 'claimed') bits.push(`Ödül ${st.reward} Parıltı`);
  else if (st.state !== 'owned' && st.state !== 'claimed') bits.push(`Bedel ${st.cost} Parıltı`);
  if (st.reqText) bits.push(st.reqText);
  return `${B.name}: ${bits.filter(Boolean).join('. ')}`;
}

// ------------------------------------------------------------------ Kütüphane
export function mountLibrary(el, ctx = {}) {
  const reduce = prefersReducedMotion();
  let branchId = PR.BRANCHES.some((b) => b.id === ctx.branch) ? ctx.branch : 'heroes';
  let selected = null; // düğüm kimliği
  let confirming = null;
  let confirmTimer = 0;
  let flashId = null;
  let message = null; // { text, tone }
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

  const root = h('section', { class: 'arl', 'aria-label': 'Aghanim Kütüphanesi' });
  const purseNum = h('b', { class: 'arl-purse-n num' });
  const purseSub = h('span', { class: 'arl-purse-sub' });
  const purse = h('div', { class: 'arl-purse', role: 'status', 'aria-live': 'polite' }, gem('lg'), h('span', { class: 'arl-purse-txt' }, purseNum, h('span', { class: 'arl-purse-lbl' }, 'Parıltı Taşı'), purseSub));
  const closeBtn = ctx.onClose
    ? h('button', { class: 'btn ghost sm arl-close', type: 'button', onclick: () => ctx.onClose() }, icon('arrowLeft', { size: 16 }), 'Geri')
    : null;
  const head = h('header', { class: 'arl-head' },
    h('div', { class: 'arl-title' },
      h('span', { class: 'eyebrow' }, 'Aghanim Kütüphanesi'),
      h('h2', { class: 'arl-h' }, ctx.title || 'Bilginin bedeli: Parıltı'),
      h('p', { class: 'arl-lead' }, 'Burada güç satılmaz, seçenek satılır: yeni kahramanlar, başlangıç çantaları, isteğe bağlı Lanetler ve bolca stil. Parıltı Taşı dalgalardan, bosslardan, hikâye yıldızlarından ve günlük meydan okumadan gelir.'),
    ),
    h('div', { class: 'arl-head-side' }, purse, closeBtn),
  );
  const tabs = h('div', { class: 'arl-tabs', role: 'tablist', 'aria-label': 'Kütüphane dalları' });
  const tabEls = {};
  for (const B of PR.BRANCHES) {
    const prog = h('span', { class: 'arl-tab-prog num' });
    const bar = h('span', { class: 'arl-tab-bar' }, h('i'));
    const t = h('button', { class: 'arl-tab', type: 'button', role: 'tab', id: `arl-tab-${B.id}`, 'aria-controls': 'arl-panel', dataset: { b: B.id }, style: { '--bc': B.color } },
      h('span', { class: 'arl-tab-ico' }, icon(B.icon, { size: 18 })),
      h('span', { class: 'arl-tab-txt' }, h('span', { class: 'arl-tab-name' }, B.name), prog),
      bar,
    );
    t.addEventListener('click', () => setBranch(B.id, false));
    t.addEventListener('keydown', onTabKey);
    tabEls[B.id] = { t, prog, bar };
    tabs.appendChild(t);
  }
  const panelHead = h('div', { class: 'arl-panel-head' });
  const extra = h('div', { class: 'arl-extra' });
  const links = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  links.setAttribute('class', 'arl-links');
  links.setAttribute('aria-hidden', 'true');
  const grid = h('div', { class: 'arl-grid', role: 'group' }, links);
  const tree = h('div', { class: 'arl-tree', role: 'tabpanel', id: 'arl-panel' }, panelHead, grid, extra);
  const detail = h('aside', { class: 'arl-detail', 'aria-live': 'polite', 'aria-label': 'Seçili düğüm' });
  const body = h('div', { class: 'arl-body' }, tabs, tree, detail);
  root.append(head, body);
  clear(el);
  el.appendChild(root);

  let nodeEls = new Map();
  let state = null;

  /** Yeniden çizimde odağı eşdeğer öğeye geri ver (klavye kullanıcısı yerini kaybetmesin). */
  function focusKey() {
    const a = document.activeElement;
    if (!a || !root.contains(a)) return null;
    if (a.dataset.id) return `[data-id="${a.dataset.id}"]`;
    if (a.dataset.b) return `.arl-tab[data-b="${a.dataset.b}"]`;
    if (a.dataset.level) return `.arl-cp-b[data-level="${a.dataset.level}"]`;
    if (a.classList.contains('arl-buy')) return '.arl-buy';
    return null;
  }

  function refresh() {
    const fk = focusKey();
    state = PR.libraryState();
    purseNum.textContent = fmtNum(state.shards);
    purseSub.textContent = `Toplam kazanılan: ${fmtNum(state.earned)}`;
    for (const B of state.branches) {
      const T = tabEls[B.id];
      T.prog.textContent = `${B.done}/${B.total}`;
      T.bar.firstChild.style.width = `${Math.round((B.done / B.total) * 100)}%`;
      T.t.setAttribute('aria-selected', String(B.id === branchId));
      T.t.tabIndex = B.id === branchId ? 0 : -1;
      T.t.classList.toggle('has-ready', B.nodes.some((n) => n.status.state === 'ready' || n.status.state === 'claimable'));
    }
    renderBranch();
    renderDetail();
    if (fk) { const f = root.querySelector(fk); if (f && !f.disabled) f.focus({ preventScroll: true }); }
    if (ctx.onChange) { try { ctx.onChange(PR.getProfile()); } catch { /* yok say */ } }
  }

  function branchOf(id) { return state.branches.find((b) => b.id === id); }
  function nodeIn(id) {
    for (const B of state.branches) { const n = B.nodes.find((x) => x.id === id); if (n) return { n, B }; }
    return null;
  }

  function setBranch(id, focusTab) {
    if (id === branchId && state) return;
    branchId = id;
    selected = null;
    confirming = null;
    message = null;
    refresh();
    if (focusTab) tabEls[id].t.focus();
  }

  function onTabKey(e) {
    const ids = PR.BRANCHES.map((b) => b.id);
    const i = ids.indexOf(branchId);
    let j = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % ids.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i + ids.length - 1) % ids.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = ids.length - 1;
    if (j < 0) return;
    e.preventDefault();
    setBranch(ids[j], true);
  }

  function renderBranch() {
    const B = branchOf(branchId);
    tree.setAttribute('aria-labelledby', `arl-tab-${B.id}`);
    root.style.setProperty('--bc', B.color);
    clear(panelHead);
    panelHead.append(
      h('div', { class: 'arl-ph-title' }, h('span', { class: 'arl-ph-ico' }, icon(B.icon, { size: 20 })), h('h3', null, B.name), h('span', { class: 'arl-ph-prog num' }, `${B.done}/${B.total}`)),
      h('p', { class: 'arl-ph-desc' }, B.desc),
    );
    grid.setAttribute('aria-label', `${B.name} ağacı`);
    for (const e of nodeEls.values()) e.remove();
    nodeEls = new Map();
    if (!selected || !B.nodes.some((n) => n.id === selected)) {
      // ilk açılışta en ilginç düğüm: toplanacak ödül > alınabilir > ilk kilitli olmayan
      const pickN = B.nodes.find((n) => n.status.state === 'claimable') || B.nodes.find((n) => n.status.state === 'ready')
        || B.nodes.find((n) => n.status.state === 'poor') || B.nodes[0];
      selected = pickN ? pickN.id : null;
    }
    const rows = Math.max(...B.nodes.map((n) => n.row)) + 1;
    grid.style.setProperty('--rows', rows);
    for (const n of B.nodes) {
      const st = n.status;
      const hex = h('span', { class: 'arl-hex' }, h('span', { class: 'arl-hex-in' }, icon(n.icon || 'star', { size: 26, stroke: 1.8 })));
      const badge = st.state === 'owned' || st.state === 'claimed'
        ? h('span', { class: 'arl-badge is-ok' }, icon('check', { size: 11, stroke: 3 }))
        : st.state === 'locked' ? h('span', { class: 'arl-badge is-lock' }, icon('lock', { size: 11, stroke: 2.4 })) : null;
      const b = h('button', {
        class: `arl-node is-${st.state}${n.id === flashId ? ' is-new' : ''}${n.type === 'curse' ? ' is-curse' : ''}`,
        type: 'button', dataset: { id: n.id }, 'aria-label': nodeAria(n, B), 'aria-current': n.id === selected ? 'true' : null,
        tabindex: n.id === selected ? '0' : '-1',
        style: { gridRow: String(n.row + 1), gridColumn: String(n.col + 1) },
      },
        h('span', { class: 'arl-hex-wrap' }, hex, badge),
        h('span', { class: 'arl-node-name' }, n.type === 'curse' ? h('span', { class: 'arl-node-lvl num' }, String(n.curse)) : null, n.type === 'curse' ? n.sub : n.name),
        costBit(n),
      );
      b.addEventListener('click', () => select(n.id, true));
      b.addEventListener('keydown', onNodeKey);
      nodeEls.set(n.id, b);
      grid.appendChild(b);
    }
    flashId = null;
    renderExtra(B);
    requestAnimationFrame(drawLinks);
  }

  function renderExtra(B) {
    clear(extra);
    if (B.id === 'curses') {
      extra.append(h('div', { class: 'arl-extra-box' }, h('h4', { class: 'arl-extra-h' }, icon('skull', { size: 16 }), 'Sonraki koşunun laneti'), cursePickerEl(() => refresh())));
    } else if (B.id === 'heroes') {
      const list = h('div', { class: 'arl-heroes', role: 'list' });
      for (const id of PR.heroIds()) {
        const s = PR.heroSummary(id);
        const chip = h('button', { class: `arl-hero${s.unlocked ? '' : ' is-locked'}`, type: 'button', role: 'listitem', style: { '--hc': s.color },
          'aria-label': `${s.name}: ${s.unlocked ? `${s.rank}, ${fmtNum(s.xp)} ustalık XP’si` : 'kilitli'}. Ustalık panelini aç.` },
          heroEmblem(id, 'sm'),
          h('span', { class: 'arl-hero-txt' }, h('strong', null, s.name), h('span', { class: 'arl-hero-rank' }, s.unlocked ? s.rank : 'Kilitli')),
          s.unlocked ? rankMedal(s.tier, { size: 30, label: false }) : h('span', { class: 'arl-hero-lock' }, icon('lock', { size: 16 })),
        );
        chip.addEventListener('click', () => openHero(id));
        list.appendChild(chip);
      }
      extra.append(h('div', { class: 'arl-extra-box' }, h('h4', { class: 'arl-extra-h' }, icon('medal', { size: 16 }), 'Kahraman ustalıkları'),
        h('p', { class: 'arl-extra-p' }, 'Ustalık, o kahramanla oynadıkça gelir: varyantlar, kahramana özel çanta, aura ve iz. Ham güç toplamda en çok %5.'), list));
    } else if (B.id === 'codex') {
      const P = PR.getProfile();
      const rows = PR.CODEX_KINDS.map((K) => {
        const c = P.codex.counts[K.id];
        return h('div', { class: 'arl-cx-row' }, icon(K.icon, { size: 16 }), h('span', null, K.name), h('span', { class: 'arl-cx-bar' }, h('i', { style: { width: `${c.total ? Math.round((c.have / c.total) * 100) : 0}%` } })), h('span', { class: 'num' }, `${c.have}/${c.total}`));
      });
      const open = ctx.onCodex ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => ctx.onCodex() }, icon('book', { size: 16 }), 'Kodeks’i aç') : null;
      extra.append(h('div', { class: 'arl-extra-box' }, h('h4', { class: 'arl-extra-h' }, icon('book', { size: 16 }), 'Kodeks durumu'), h('div', { class: 'arl-cx' }, rows), open));
    }
  }

  function openHero(heroId) {
    if (ctx.onHero) { ctx.onHero(heroId); return; }
    const host = h('div', { class: 'arl-modal-host' });
    let inner = null;
    const close = fx.modal(host, { label: `${PR.heroInfo(heroId).name} ustalığı`, cls: 'arl-modal', onClose: () => { if (inner) inner(); refresh(); } });
    import('./mastery.js').then((m) => { inner = m.mountHeroMastery(host, heroId, { onClose: close }); });
  }

  function drawLinks() {
    if (!grid.isConnected) return;
    const B = branchOf(branchId);
    const gr = grid.getBoundingClientRect();
    const W = Math.max(1, gr.width);
    const H = Math.max(1, gr.height);
    links.setAttribute('viewBox', `0 0 ${W.toFixed(1)} ${H.toFixed(1)}`);
    links.setAttribute('width', W.toFixed(1));
    links.setAttribute('height', H.toFixed(1));
    while (links.firstChild) links.removeChild(links.firstChild);
    const geo = (id) => {
      const e = nodeEls.get(id);
      if (!e) return null;
      const hx = e.querySelector('.arl-hex').getBoundingClientRect();
      const br = e.getBoundingClientRect();
      return { cx: hx.left + hx.width / 2 - gr.left, cy: hx.top + hx.height / 2 - gr.top, r: hx.width / 2, top: hx.top - gr.top, bottom: br.bottom - gr.top };
    };
    const done = (n) => n && (n.status.state === 'owned' || n.status.state === 'claimed');
    for (const n of B.nodes) {
      const parents = [...(n.req || []), ...(n.reqAny || [])].filter((r) => B.nodes.some((x) => x.id === r));
      for (const pid of parents) {
        const p = B.nodes.find((x) => x.id === pid);
        const a = geo(pid);
        const b = geo(n.id);
        if (!a || !b) continue;
        let d;
        if (Math.abs(a.cy - b.cy) < 4) {
          const dir = b.cx > a.cx ? 1 : -1;
          d = `M${(a.cx + dir * a.r).toFixed(1)} ${a.cy.toFixed(1)}H${(b.cx - dir * b.r).toFixed(1)}`;
        } else {
          const y0 = a.bottom + 2;
          const y1 = b.top - 4;
          const mid = (y0 + y1) / 2;
          d = Math.abs(a.cx - b.cx) < 4 ? `M${a.cx.toFixed(1)} ${y0.toFixed(1)}V${y1.toFixed(1)}`
            : `M${a.cx.toFixed(1)} ${y0.toFixed(1)}V${mid.toFixed(1)}H${b.cx.toFixed(1)}V${y1.toFixed(1)}`;
        }
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', done(p) && done(n) ? 'is-done' : done(p) ? 'is-open' : 'is-shut');
        links.appendChild(path);
      }
    }
  }

  function onNodeKey(e) {
    const B = branchOf(branchId);
    const cur = B.nodes.find((n) => n.id === e.currentTarget.dataset.id);
    if (!cur) return;
    let next = null;
    const dist = (a, b) => Math.abs(a.row - b.row) * 3 + Math.abs(a.col - b.col);
    const pickDir = (f) => B.nodes.filter((n) => n !== cur && f(n)).sort((a, b) => dist(cur, a) - dist(cur, b))[0] || null;
    if (e.key === 'ArrowRight') next = pickDir((n) => n.row === cur.row && n.col > cur.col) || pickDir((n) => n.col > cur.col);
    else if (e.key === 'ArrowLeft') next = pickDir((n) => n.row === cur.row && n.col < cur.col) || pickDir((n) => n.col < cur.col);
    else if (e.key === 'ArrowDown') next = pickDir((n) => n.row > cur.row);
    else if (e.key === 'ArrowUp') next = pickDir((n) => n.row < cur.row);
    else if (e.key === 'Home') next = B.nodes[0];
    else if (e.key === 'End') next = B.nodes[B.nodes.length - 1];
    else return;
    e.preventDefault();
    if (next) select(next.id, false, true);
  }

  function select(id, fromPointer, focus = false) {
    if (selected !== id) { confirming = null; message = null; }
    selected = id;
    for (const [nid, e] of nodeEls) {
      const on = nid === id;
      e.tabIndex = on ? 0 : -1;
      if (on) e.setAttribute('aria-current', 'true'); else e.removeAttribute('aria-current');
    }
    if (focus) nodeEls.get(id)?.focus();
    renderDetail();
    try { sound.click(); } catch { /* ses kapalı */ }
    // dar ekranda ayrıntı ağacın altında: görünmüyorsa göster
    if (fromPointer && root.classList.contains('is-narrow')) {
      const r = detail.getBoundingClientRect();
      if (r.top > window.innerHeight - 120 || r.bottom < 0) detail.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }
  }

  function kitLine(kitId) {
    const K = PR.KITS[kitId];
    const R = PR.resolveKit(kitId);
    const parts = R.items.map((id) => (PR.codexCatalog().items.find((x) => x.id === id) || { name: id }).name);
    if (R.gold) parts.push(`${fmtNum(R.gold)} altın`);
    return h('li', null, h('strong', null, K.name), ': ', parts.join(' + '));
  }

  function renderDetail() {
    clear(detail);
    const found = selected && nodeIn(selected);
    if (!found) { detail.append(h('p', { class: 'arl-d-empty' }, 'Bir düğüm seç.')); return; }
    const { n, B } = found;
    const st = n.status;
    const P = PR.getProfile();
    const head = h('div', { class: 'arl-d-head' },
      h('span', { class: `arl-d-hex is-${st.state}`, style: { '--bc': B.color } }, h('span', { class: 'arl-hex' }, h('span', { class: 'arl-hex-in' }, icon(n.icon || 'star', { size: 30, stroke: 1.8 })))),
      h('div', { class: 'arl-d-titles' },
        h('span', { class: 'arl-d-branch' }, B.name),
        h('h3', { class: 'arl-d-name' }, n.name),
        n.sub ? h('span', { class: 'arl-d-sub' }, n.sub) : null,
      ),
      h('span', { class: `badge ${st.state === 'owned' || st.state === 'claimed' ? 'gold' : st.state === 'ready' ? 'ember' : st.state === 'claimable' ? 'jade' : ''}` }, STATE_TEXT[st.state]),
    );
    const parts = [head, h('p', { class: 'arl-d-desc' }, n.desc)];

    if (n.type === 'hero') {
      const info = PR.heroInfo(n.hero);
      const vars = PR.heroVariants(n.hero);
      parts.push(h('div', { class: 'arl-d-hero', style: { '--hc': info.color } }, heroEmblem(n.hero), h('div', null, h('strong', null, info.name), h('span', null, [info.role, info.title].filter(Boolean).join(' · ')))));
      if (vars.length) parts.push(h('p', { class: 'arl-d-note' }, 'Ustalıkla açılan varyantlar: ', vars.map((v) => v.name).join(', '), '.'));
    }
    if (n.kits) parts.push(h('ul', { class: 'arl-d-list' }, n.kits.map(kitLine)));
    if (n.type === 'curse') {
      const C = PR.CURSES[n.curse - 1];
      parts.push(h('div', { class: 'arl-d-mults' },
        h('span', { class: 'arl-mult' }, icon('trophy', { size: 14 }), `Skor ×${String(C.scoreMult).replace('.', ',')}`),
        h('span', { class: 'arl-mult is-gem' }, gem('sm'), `Parıltı ×${String(C.shardMult).replace('.', ',')}`),
      ));
      if (n.curse > 1) parts.push(h('p', { class: 'arl-d-note' }, `Birikimli: Lanet ${n.curse}, önceki ${n.curse - 1} lanetin hepsini de içerir.`));
    }
    if (n.cosmetic) {
      const [kind, cid] = n.cosmetic;
      const C = kind === 'stamp' ? null : (PR.COSMETICS[kind] || {})[cid];
      if (C) parts.push(h('div', { class: `arl-d-swatch is-${kind}`, style: { '--sc': C.color } }, h('span', { class: 'arl-sw' }), h('span', null, kind === 'aura' ? 'Aura rengi' : kind === 'trail' ? 'İz rengi' : 'Kurye rengi')));
      if (kind === 'stamp') parts.push(h('p', { class: 'arl-d-stamp' }, h('span', { class: 'stamp' }, 'DOG DOG DOG')));
    }
    if (st.progress && st.state !== 'owned' && st.state !== 'claimed') {
      const pct = st.progress.total ? Math.min(1, st.progress.have / st.progress.total) : 0;
      const ok = st.progress.have >= st.progress.total;
      const lbl = n.type === 'curse' ? (n.curse > 1 ? `Kanıt: Lanet ${n.curse - 1} ile ${PR.CURSE_PROOF_WAVE}. dalga` : `Kanıt: lanetsiz ${PR.CURSE_PROOF_WAVE}. dalga`) : 'Kodeks ilerlemesi';
      parts.push(h('div', { class: 'arl-d-prog' }, h('span', { class: `arl-d-prog-l${ok ? ' is-ok' : ''}` }, ok ? icon('check', { size: 12, stroke: 2.6 }) : null, lbl), h('span', { class: 'arl-d-prog-bar' }, h('i', { style: { width: `${Math.round(pct * 100)}%` } })), h('span', { class: 'num' }, `${st.progress.have}/${st.progress.total}`)));
    }
    if (st.reqText && (st.state === 'locked')) parts.push(h('p', { class: 'arl-d-req' }, icon('lock', { size: 14 }), st.reqText));

    // eylem
    const act = h('div', { class: 'arl-d-act' });
    if (st.state === 'ready') {
      const sure = confirming === n.id;
      const btn = h('button', { class: `btn ${sure ? 'primary' : 'gold'} arl-buy`, type: 'button' },
        icon(sure ? 'check' : n.type === 'hero' ? 'unlock' : 'sparkle', { size: 18 }),
        sure ? `Onayla · ${fmtNum(st.cost)}` : `${n.type === 'hero' ? 'Kahramanı aç' : 'Aç'} · ${fmtNum(st.cost)}`, gem('sm'));
      btn.addEventListener('click', () => buy(n));
      act.append(btn, h('span', { class: 'arl-d-after' }, sure ? 'Emin misin? Parıltı geri alınmaz.' : `Sonra: ${shardText(P.shards - st.cost)}`));
    } else if (st.state === 'poor') {
      act.append(h('button', { class: 'btn arl-buy', type: 'button', disabled: true }, gem('sm'), `${fmtNum(st.cost)} gerekli`),
        h('span', { class: 'arl-d-after' }, `${fmtNum(st.cost - P.shards)} Parıltı eksik. Birkaç dalga daha!`));
    } else if (st.state === 'claimable') {
      const btn = h('button', { class: 'btn jade arl-buy', type: 'button' }, icon('sparkle', { size: 18 }), `Ödülü topla · +${fmtNum(st.reward)}`, gem('sm'));
      btn.addEventListener('click', () => buy(n));
      act.append(btn);
    } else if (st.state === 'owned') {
      if (n.type === 'curse') {
        const on = P.curse === n.curse;
        const btn = h('button', { class: `btn ${on ? 'danger' : 'ghost'} arl-buy`, type: 'button', 'aria-pressed': String(on) }, icon('skull', { size: 18 }), on ? `Sonraki koşu: Lanet ${n.curse}` : `Sonraki koşuda kullan`);
        btn.addEventListener('click', () => { PR.setCurse(on ? 0 : n.curse); message = { text: on ? 'Lanet kaldırıldı: sonraki koşu lanetsiz.' : `Sonraki koşu Lanet ${n.curse} ile başlar.`, tone: on ? '' : 'blood' }; refresh(); });
        act.append(btn);
      } else if (n.cosmetic && (n.cosmetic[0] === 'courier' || n.cosmetic[0] === 'stamp')) {
        const isCourier = n.cosmetic[0] === 'courier';
        const on = isCourier ? P.global.courier === n.cosmetic[1] : !!P.global.stamp;
        const btn = h('button', { class: `btn ${on ? 'gold' : 'ghost'} arl-buy`, type: 'button', 'aria-pressed': String(on) }, icon(on ? 'check' : 'sparkle', { size: 18 }), on ? 'Kullanılıyor' : 'Kullan');
        btn.addEventListener('click', () => {
          PR.setGlobalCosmetics(isCourier ? { courier: on ? null : n.cosmetic[1] } : { stamp: !on });
          message = { text: on ? 'Kapatıldı.' : `${n.name} takıldı.`, tone: on ? '' : 'gold' };
          refresh();
        });
        act.append(btn);
      } else if (n.cosmetic) {
        act.append(h('span', { class: 'arl-d-after' }, icon('info', { size: 14 }), 'Aura ve izler her kahramanın ustalık panelinden takılır.'));
      } else if (n.type === 'hero') {
        const btn = h('button', { class: 'btn ghost arl-buy', type: 'button' }, icon('medal', { size: 18 }), 'Ustalık paneli');
        btn.addEventListener('click', () => openHero(n.hero));
        act.append(btn);
      } else {
        act.append(h('span', { class: 'badge gold' }, icon('check', { size: 12 }), 'Açık'));
      }
    } else if (st.state === 'claimed') {
      act.append(h('span', { class: 'badge jade' }, icon('check', { size: 12 }), `+${fmtNum(st.reward)} toplandı`));
    } else {
      act.append(h('button', { class: 'btn arl-buy', type: 'button', disabled: true }, icon('lock', { size: 16 }), 'Kilitli'));
    }
    parts.push(act);
    if (message) parts.push(h('p', { class: `arl-d-msg ${message.tone || ''}` }, message.text));
    detail.append(...parts);
  }

  function buy(n) {
    const st = n.status;
    if (n.type !== 'claim' && confirming !== n.id) {
      confirming = n.id;
      clearTimeout(confirmTimer);
      confirmTimer = later(() => { if (confirming === n.id) { confirming = null; renderDetail(); } }, 4500);
      renderDetail();
      detail.querySelector('.arl-buy')?.focus();
      return;
    }
    confirming = null;
    const r = PR.buyNode(n.id);
    if (!r.ok) {
      message = { text: r.reason === 'poor' ? `${fmtNum(r.need)} Parıltı eksik.` : r.text || 'Şimdilik açılamıyor.', tone: 'blood' };
      try { sound.bad(); } catch { /* ses kapalı */ }
      refresh();
      return;
    }
    flashId = n.id;
    try { sound.coin(); } catch { /* ses kapalı */ }
    let text;
    if (n.type === 'hero') text = `${n.name} açıldı! Seçim ekranında seni bekliyor.`;
    else if (n.type === 'curse') text = `Lanet ${n.curse} açıldı. Hazır hissettiğinde seç: skor ×${String(PR.curseInfo(n.curse).scoreMult).replace('.', ',')}.`;
    else if (n.type === 'claim') text = `+${fmtNum(r.reward)} Parıltı toplandı. Kurye ayrıca teşekkür ediyor.`;
    else if (n.kits) text = 'Yeni başlangıç çantaları ustalık panelinde seçilebilir.';
    else if (n.cosmetic) text = `${n.name} artık senin.`;
    else text = `${n.name} açıldı.`;
    message = { text, tone: 'gold' };
    if (n.type === 'hero' && !reduce) {
      const e = nodeEls.get(n.id);
      if (e) { const r2 = e.getBoundingClientRect(); fx.confetti(r2.left + r2.width / 2, r2.top + r2.height / 3, 70); }
    }
    refresh();
    detail.querySelector('.arl-buy')?.focus();
  }

  // yeniden boyutlanınca çizgiler
  let ro = null;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => {
      root.classList.toggle('is-narrow', root.clientWidth < 760);
      drawLinks();
    });
    ro.observe(root);
  }
  const unsub = PR.subscribeMeta(() => { if (root.isConnected) refresh(); });
  root.classList.toggle('is-narrow', el.clientWidth < 760);
  refresh();

  return () => {
    unsub();
    if (ro) ro.disconnect();
    for (const t of timers) clearTimeout(t);
    timers.clear();
    root.remove();
  };
}

// ------------------------------------------------------------------ Lanet seçici
function cursePickerEl(onPick) {
  const P = PR.getProfile();
  const max = P.curseMax;
  let cur = P.curse;
  const wrap = h('div', { class: 'arl-cp' });
  const group = h('div', { class: 'arl-cp-row', role: 'radiogroup', 'aria-label': 'Sonraki koşunun Lanet seviyesi' });
  const info = h('div', { class: 'arl-cp-info', 'aria-live': 'polite' });
  const btns = [];
  const shown = Math.min(PR.MAX_CURSE, max + 1);
  for (let L = 0; L <= shown; L++) {
    const locked = L > max;
    const b = h('button', { class: `arl-cp-b${L === 0 ? ' is-zero' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(L === cur), disabled: locked, dataset: { level: String(L) },
      'aria-label': L === 0 ? 'Lanetsiz' : `Lanet ${L}: ${PR.CURSES[L - 1].name}${locked ? ' (kilitli)' : ''}`, tabindex: L === cur ? '0' : '-1' },
    L === 0 ? icon('shield', { size: 15 }) : locked ? icon('lock', { size: 13 }) : String(L));
    b.addEventListener('click', () => pick(L));
    b.addEventListener('keydown', (e) => {
      let j = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') j = Math.min(max, cur + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') j = Math.max(0, cur - 1);
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = max;
      if (j < 0) return;
      e.preventDefault();
      pick(j);
      const again = (wrap.isConnected ? btns[j] : null) || document.querySelector(`.arl-cp-b[data-level="${j}"]`);
      if (again) again.focus();
    });
    btns.push(b);
    group.appendChild(b);
  }
  if (shown < PR.MAX_CURSE) {
    group.appendChild(h('span', { class: 'arl-cp-more', 'aria-hidden': 'true', title: `${PR.MAX_CURSE - shown} Lanet daha kilitli` }, icon('lock', { size: 12 }), `+${PR.MAX_CURSE - shown}`));
  }
  function renderInfo() {
    clear(info);
    const C = PR.curseInfo(cur);
    const names = PR.CURSES.slice(0, cur).map((c) => c.name);
    info.append(
      h('strong', { class: cur ? 'blood' : '' }, cur ? `Lanet ${cur} · ${C.name}` : 'Lanetsiz'),
      h('span', { class: 'arl-cp-desc' }, cur ? (cur > 1 ? `${names.join(' + ')}.` : C.description) : max ? 'Arena’nın bildiğin hâli. Hazırsan bir Lanet seç: skor ve Parıltı artar.' : 'Arena’nın bildiğin hâli. Lanetler Kütüphane’nin Lanetler dalından açılır.'),
      cur ? h('span', { class: 'arl-cp-mult' }, `Skor ×${String(C.scoreMult).replace('.', ',')} · Parıltı ×${String(C.shardMult).replace('.', ',')}`) : '',
    );
  }
  function pick(L) {
    if (L > max) return;
    cur = PR.setCurse(L);
    btns.forEach((b, i) => { b.setAttribute('aria-checked', String(i === cur)); b.tabIndex = i === cur ? 0 : -1; });
    renderInfo();
    try { sound.click(); } catch { /* ses kapalı */ }
    if (onPick) onPick(cur);
  }
  renderInfo();
  wrap.append(group, info);
  return wrap;
}

/** Sonraki koşunun Lanet seviyesi için küçük seçici (ör. arena başlangıç ekranı). ctx: { onChange?(seviye) } */
export function mountCursePicker(el, ctx = {}) {
  let node = null;
  const render = () => {
    const next = h('div', { class: 'arl arl-cp-host' }, cursePickerEl((L) => { if (ctx.onChange) ctx.onChange(L); }));
    if (node) node.replaceWith(next); else el.appendChild(next);
    node = next;
  };
  render();
  const unsub = PR.subscribeMeta(() => { if (node && node.isConnected && !node.contains(document.activeElement)) render(); });
  return () => { unsub(); if (node) node.remove(); };
}
