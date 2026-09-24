// Karakter Analizleri (#karakterler)
// Alt sayfalar: arsiv (varsayılan) · profil · analiz
// Ayrıca: #karakterler--<arketipId> (tür detayı), #karakterler--vs-<a>-<b> (karşılaştırma).
// Kahraman listesi ayrı bölümde: #kahramanlar (eski #karakterler--kahramanlar bağlantısı oraya yönlendiren bir kart gösterir).

import './characters.css';
import { h, clear, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { ALL_TYPES, byId } from '../../data/archetypes.js';
import { renderArchive, renderDetail, renderCompare, heroIndexCard } from './archive.js';
import { renderProfile } from './profile.js';
import { renderAnalysis } from './analysis.js';
import { dogIndex } from './util.js';

const TABS = [
  { id: 'arsiv', label: 'DOG Arşivi', short: 'Arşiv', icon: 'paw' },
  { id: 'profil', label: 'Yayıncı Kartı', short: 'Yayıncı', icon: 'crown' },
  { id: 'analiz', label: 'Kendi Analizin', short: 'Analiz', icon: 'brain' },
];

let active = null;

function resolve(sub) {
  if (!sub || sub === 'arsiv') return { tab: 'arsiv', view: 'grid' };
  if (sub === 'profil' || sub === 'analiz') return { tab: sub, view: sub };
  // Eski bağlantılar: kahraman listesi artık kendi bölümünde (#kahramanlar)
  if (sub === 'kahramanlar') return { tab: 'arsiv', view: 'heroes-moved' };
  if (sub === 'vs' || sub.startsWith('vs-')) {
    const [, a, b] = sub.split('-');
    return { tab: 'arsiv', view: 'vs', a: a || null, b: b || null };
  }
  const arch = byId(sub);
  if (arch) return { tab: 'arsiv', view: 'detail', arch };
  return { tab: 'arsiv', view: 'grid' };
}

/** Başlıktaki dekoratif "DOG Radarı": dönen tarama ve 11 türün işaretleri. */
function scopeEl() {
  const blips = ALL_TYPES.map((a, i) => {
    const ang = (i / ALL_TYPES.length) * 360 + 12;
    const rad = 10 + (100 - dogIndex(a.stats)) * 0.42; // DOG'lar merkeze yakın
    const x = 50 + Math.cos(((ang - 90) * Math.PI) / 180) * rad;
    const y = 50 + Math.sin(((ang - 90) * Math.PI) / 180) * rad;
    return h('span', {
      class: `ch-blip${a.id === 'legend' ? ' is-legend' : ''}`,
      style: { left: `${x}%`, top: `${y}%`, '--ch-c': a.color, '--d': `${((ang / 360) * 4 - 4).toFixed(2)}s` },
      title: a.name,
    });
  });
  return h('div', { class: 'ch-scope', 'aria-hidden': 'true' },
    h('div', { class: 'ch-scope-disc' },
      h('span', { class: 'ch-scope-sweep' }),
      h('span', { class: 'ch-scope-cross' }),
      blips,
      h('span', { class: 'ch-scope-core' }),
    ),
    h('span', { class: 'ch-scope-cap' }, `DOG Radarı · ${ALL_TYPES.length} tür`),
  );
}

function createInstance(el, ctx) {
  const { store } = ctx;
  const state = { archiveSort: 'arsiv', heroQuery: '', heroAttr: 'all', heroSort: 'dog-desc', analysis: null };

  // ---- Topluluk verisi: beğeni sayıları ve analiz dağılımı
  let fans = [];
  let othersLikes = {};
  const likeWatchers = new Set();
  const fanWatchers = new Set();
  const myId = () => store.uid() || 'me';
  const recompute = () => {
    othersLikes = {};
    const me = myId();
    for (const f of fans) {
      if (f.id === me) continue;
      for (const k in f.likes || {}) othersLikes[k] = (othersLikes[k] || 0) + 1;
    }
  };
  const notifyLikes = () => { for (const fn of likeWatchers) { try { fn(); } catch (e) { console.error(e); } } };
  const unsubFans = store.fans((list) => {
    fans = list;
    recompute();
    notifyLikes();
    for (const fn of fanWatchers) { try { fn(fans); } catch (e) { console.error(e); } }
  });
  const unsubMe = store.me.subscribe(() => notifyLikes());

  // ---- İskelet
  const tabBtns = new Map();
  const tabs = h('div', { class: 'tabs ch-tabs', role: 'tablist', 'aria-label': 'Karakter Analizleri sekmeleri' });
  for (const t of TABS) {
    const b = h('button', {
      class: 'tab ch-tab',
      type: 'button',
      role: 'tab',
      id: `ch-tab-${t.id}`,
      'aria-controls': 'ch-panel',
      'aria-selected': 'false',
    },
      icon(t.icon, { size: 16 }),
      h('span', { class: 'ch-tab-long' }, t.label),
      h('span', { class: 'ch-tab-short' }, t.short),
    );
    b.addEventListener('click', () => {
      ctx.sound.click();
      const sub = t.id === 'arsiv' ? null : t.id;
      ctx.setSub(sub);
      show(sub);
    });
    tabBtns.set(t.id, b);
    tabs.appendChild(b);
  }
  tabs.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const ids = TABS.map((t) => t.id);
    const cur = ids.indexOf(currentTab);
    const next = ids[(cur + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
    e.preventDefault();
    tabBtns.get(next).focus();
    tabBtns.get(next).click();
  });

  const view = h('div', { class: 'ch-view', id: 'ch-panel', role: 'tabpanel', tabindex: '-1' });

  const head = h('header', { class: 'ch-head' },
    h('div', { class: 'section-head ch-head-text' },
      h('span', { class: 'eyebrow' }, 'Karakter Analizleri'),
      h('h1', { class: 'h1 ch-h1' }, 'Her pub’da dokuz ', h('em', null, 'DOG'), ', bir efsane.'),
      h('p', { class: 'lead' },
        'Pub maçlarının köpek türleri için saha rehberi, yayıncıya hayran oyuncu kartı ve kendi DOG analizin. Bilimsel değil; ama tutarlı.',
      ),
    ),
    scopeEl(),
  );

  // Kahraman listesi ayrı bölümde: sekme değil, yan bağlantı
  const heroLink = h('button', { class: 'ch-tabbar-link', type: 'button', title: 'Tüm Dota kahramanlarının DOG’luk endeksi' },
    icon('swords', { size: 16 }), h('span', { class: 'ch-tab-long' }, 'Kahraman DOG Endeksi'), h('span', { class: 'ch-tab-short' }, 'Kahramanlar'), icon('arrowRight', { size: 14 }),
  );
  heroLink.addEventListener('click', () => { ctx.sound.click(); ctx.go('kahramanlar'); });
  const tabbar = h('div', { class: 'ch-tabbar' }, tabs, heroLink);

  const root = h('div', { class: 'wrap ch' }, head, tabbar, view);
  el.appendChild(root);

  // ---- Alt görünüm yönetimi
  let currentTab = null;
  let viewCleanup = null;
  let lastKey = null;

  const env = {
    ctx,
    store,
    state,
    get fans() { return fans; },
    /** Geçmişe kayıt ekleyerek bölüm içinde gezin (hashchange → onSub). */
    navigate(sub) {
      const target = '#karakterler' + (sub ? '--' + sub : '');
      if (location.hash === target) show(sub);
      else location.hash = target;
    },
    /** Hash'i geçmiş eklemeden güncelle (karşılaştırma seçimi gibi). */
    replace(sub) { ctx.setSub(sub); },
    likes: {
      count(key) { return (othersLikes[key] || 0) + (store.me.get().likes[key] ? 1 : 0); },
      mine(key) { return !!store.me.get().likes[key]; },
      toggle(key) { return store.me.toggleLike(key); },
      watch(fn) { likeWatchers.add(fn); return () => likeWatchers.delete(fn); },
    },
    onFans(fn) { fanWatchers.add(fn); if (fans.length) queueMicrotask(() => fanWatchers.has(fn) && fn(fans)); return () => fanWatchers.delete(fn); },
  };

  function scrollToTabs() {
    const hud = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-h')) || 56;
    const y = tabs.getBoundingClientRect().top + window.scrollY - hud - 12;
    if (window.scrollY > y + 4) window.scrollTo({ top: Math.max(0, y), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  function show(sub, { initial = false } = {}) {
    const r = resolve(sub);
    const key = r.view + ':' + (r.arch ? r.arch.id : '') + (r.view === 'vs' ? `${r.a}-${r.b}` : '');
    if (key === lastKey) return;
    lastKey = key;
    if (viewCleanup) {
      try { viewCleanup(); } catch (e) { console.error(e); }
      viewCleanup = null;
    }
    currentTab = r.tab;
    for (const [id, b] of tabBtns) {
      const on = id === r.tab;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    view.setAttribute('aria-labelledby', `ch-tab-${r.tab}`);
    clear(view);
    const page = h('div', { class: 'ch-page' });
    view.appendChild(page);
    let c = null;
    if (r.view === 'grid') c = renderArchive(page, env);
    else if (r.view === 'detail') c = renderDetail(page, env, r.arch);
    else if (r.view === 'vs') c = renderCompare(page, env, r.a, r.b);
    else if (r.view === 'heroes-moved') page.appendChild(heroIndexCard(env, { big: true }));
    else if (r.view === 'profil') c = renderProfile(page, env);
    else if (r.view === 'analiz') c = renderAnalysis(page, env);
    viewCleanup = typeof c === 'function' ? c : null;
    if (!initial) scrollToTabs();
  }

  return {
    show,
    destroy() {
      if (viewCleanup) { try { viewCleanup(); } catch (e) { console.error(e); } }
      viewCleanup = null;
      unsubFans();
      unsubMe();
      likeWatchers.clear();
      fanWatchers.clear();
      root.remove();
    },
  };
}

export default {
  mount(el, ctx) {
    const inst = createInstance(el, ctx);
    active = inst;
    inst.show(ctx.sub, { initial: true });
    return () => {
      inst.destroy();
      if (active === inst) active = null;
    };
  },
  onSub(sub) {
    if (active) active.show(sub);
  },
};
