// Kahraman DOG Endeksi (#kahramanlar)
// Alt sayfalar: duvar (varsayılan) · tier · daha · cark · <kahraman id> (detay, ör. #kahramanlar--spectre)
// Topluluk ön yargılarına dayalı mizahi endeks — kahramanlar masumdur, DOG'luk oyuncudadır.

import './heroes.css';
import { h, clear, fmtNum } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { HEROES, heroById } from '../../data/heroes.js';
import { createCommunity } from './community.js';
import { mountRing } from './ring3d.js';
import { mountWall } from './wall.js';
import { mountDetail } from './detail.js';
import { mountTier } from './tier.js';
import { mountDaha } from './daha.js';
import { mountCark } from './cark.js';

export const TABS = [
  { id: 'duvar', label: 'Kahraman Duvarı', short: 'Duvar', icon: 'swords' },
  { id: 'tier', label: 'DOG Tier Listesi', short: 'Tier', icon: 'crown' },
  { id: 'daha', label: 'Daha DOG mu?', short: 'Daha DOG?', icon: 'dice' },
  { id: 'cark', label: 'DOG Çarkı', short: 'Çark', icon: 'target' },
];
const VIEWS = { tier: mountTier, daha: mountDaha, cark: mountCark };

let active = null;

function createApp(el, ctx) {
  const comm = createCommunity(ctx.store);
  const cleanups = [];

  // ---------------------------------------------------------------- başlık + 3D halka
  const statsEl = h('p', { class: 'hr-head-stats mono' });
  const ringHost = h('div', {
    class: 'hr-ring',
    role: 'img',
    'aria-label': '3D kahraman sikke halkası: en yüksek DOG’luklu kahramanlar en üst halkada. Sürükleyerek döndür, bir sikkeye tıklayarak kahramanın dosyasını aç.',
  });
  const ringHintText = h('span', null, 'Sürükle: döndür · Sikkeye dokun: dosyayı aç');
  const ringHint = h('p', { class: 'hr-ring-hint xsmall dim' }, icon('refresh', { size: 14 }), ringHintText);
  const head = h('header', { class: 'hr-head' },
    h('div', { class: 'hr-head-text section-head' },
      h('span', { class: 'eyebrow' }, 'Kahraman DOG Endeksi · ', String(HEROES.length), ' kahraman'),
      h('h1', { class: 'h1 hr-title' }, 'Seçtiği kahraman ', h('em', null, 'ele veriyor.')),
      h('p', { class: 'lead' },
        'Spectre’den Techies’e bütün Dota kahramanları, onları seçen pub oyuncusuna dair topluluk klişelerine göre puanlandı. ',
        'Sen de oy ver: “Bu kahramanı seçen DOG mu?”',
      ),
      h('p', { class: 'hr-disclaimer' },
        icon('info', { size: 16 }),
        h('span', null, 'Topluluk ön yargılarına dayalı mizahi endeks — kahramanlar masumdur, DOG’luk oyuncudadır.'),
      ),
      statsEl,
    ),
    h('div', { class: 'hr-ring-wrap' },
      ringHost,
      ringHint,
    ),
  );

  // ---------------------------------------------------------------- sekmeler
  const tabLinks = new Map();
  const tabs = h('nav', { class: 'tabs hr-tabs', 'aria-label': 'Kahraman DOG Endeksi bölümleri' },
    TABS.map((t) => {
      const a = h('a', {
        class: 'tab hr-tab',
        href: t.id === 'duvar' ? '#kahramanlar' : `#kahramanlar--${t.id}`,
      }, icon(t.icon, { size: 16 }), h('span', { class: 'hr-tab-long' }, t.label), h('span', { class: 'hr-tab-short' }, t.short));
      a.addEventListener('click', () => ctx.sound.click());
      tabLinks.set(t.id, a);
      return a;
    }),
  );

  const viewHost = h('div', { class: 'hr-view' });
  const wallHost = h('div', { class: 'hr-wall-host' });
  const otherHost = h('div', { class: 'hr-other-host' });
  viewHost.append(wallHost, otherHost);

  const root = h('div', { class: 'hr-root wrap' }, head, tabs, viewHost);
  el.appendChild(root);

  const env = {
    ctx,
    comm,
    /** Bölüm içinde gezin (geçmişe kayıt ekler → onSub). */
    go(sub) { ctx.go('kahramanlar', sub && sub !== 'duvar' ? sub : null); },
    openHero(id) { ctx.sound.click(); ctx.go('kahramanlar', id); },
  };

  // Halka: sikkeye tıklayınca detay
  const ring = mountRing(ringHost, {
    heroes: HEROES,
    getValue: (id) => comm.value(id, 'live'),
    onPick: (hero) => env.openHero(hero.id),
  });
  cleanups.push(() => ring.destroy());
  if (ring.fallback) ringHintText.textContent = 'Sikkeye dokun: kahramanın dosyasını aç';

  const renderStats = () => {
    const votes = comm.totalVotes();
    statsEl.textContent = `${HEROES.length} kahraman · ${fmtNum(votes)} topluluk oyu · ön yargı ortalaması %${Math.round(HEROES.reduce((s, x) => s + x.dogRate, 0) / HEROES.length)}`;
  };
  cleanups.push(comm.subscribe(renderStats));
  renderStats();

  // ---------------------------------------------------------------- görünümler
  let wall = null;
  let other = null; // { id, api }
  let current = null;
  let wallScroll = 0;

  function resolve(sub) {
    if (!sub || sub === 'duvar') return { kind: 'duvar' };
    if (VIEWS[sub]) return { kind: sub };
    const hero = heroById(sub);
    if (hero) return { kind: 'hero', hero };
    return { kind: 'unknown' };
  }

  function show(sub) {
    let r = resolve(sub);
    if (r.kind === 'unknown') {
      ctx.fx.toast('Bu adla bir kahraman bulunamadı; duvara döndük.', 'blood');
      ctx.setSub(null);
      r = { kind: 'duvar' };
    }
    const prevKind = current;
    if (prevKind === 'duvar') wallScroll = window.scrollY;
    current = r.kind === 'hero' ? 'hero:' + r.hero.id : r.kind;

    for (const [id, a] of tabLinks) {
      const on = id === r.kind;
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    root.classList.toggle('is-detail', r.kind === 'hero');

    // diğer görünümü kapat
    if (other) {
      try { other.api.destroy(); } catch (e) { console.error(e); }
      other = null;
      clear(otherHost);
    }

    if (r.kind === 'duvar') {
      if (!wall) wall = mountWall(wallHost, env);
      wallHost.hidden = false;
      otherHost.hidden = true;
      wall.onShow && wall.onShow();
      if (prevKind && prevKind !== 'duvar') {
        if (prevKind.startsWith('hero:')) requestAnimationFrame(() => window.scrollTo(0, wallScroll));
        else scrollToTabs();
      }
    } else {
      wallHost.hidden = true;
      otherHost.hidden = false;
      if (r.kind === 'hero') {
        other = { id: current, api: mountDetail(otherHost, env, r.hero) };
        if (prevKind) window.scrollTo(0, 0);
      } else {
        other = { id: r.kind, api: VIEWS[r.kind](otherHost, env) };
        if (prevKind) scrollToTabs();
      }
    }
    if (r.kind !== 'hero') ring.wake();
  }

  function scrollToTabs() {
    const y = tabs.getBoundingClientRect().top + window.scrollY - 70;
    if (window.scrollY > y) window.scrollTo(0, Math.max(0, y));
  }

  show(ctx.sub);

  return {
    show,
    destroy() {
      if (other) { try { other.api.destroy(); } catch (e) { console.error(e); } }
      if (wall) { try { wall.destroy(); } catch (e) { console.error(e); } }
      for (const c of cleanups) { try { c(); } catch (e) { console.error(e); } }
      comm.destroy();
      root.remove();
    },
  };
}

export default {
  mount(el, ctx) {
    active = createApp(el, ctx);
    return () => {
      if (active) active.destroy();
      active = null;
    };
  },
  onSub(sub) {
    if (active) active.show(sub);
  },
};
