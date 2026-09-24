// Mini Oyunlar merkezi (#oyunlar). Oyun kartları, rekor envanteri, canlı skor tabloları, sohbet;
// alt sayfalar (#oyunlar--<id>) aynı bölüm içinde oyunu açar: arena, dogavi, lasthit, hafiza, rune.

import './games.css';
import { h, clear, fmtNum, ls } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { store } from '../../core/store.js';
import { sound } from '../../core/sound.js';
import { artUrl } from '../../core/assets.js';
import { mountLeaderboard } from '../../components/leaderboard.js';
import { mountComments } from '../../components/comments.js';
import { attachTilt } from '../../components/tilt.js';
import { bestText, compact, isTyping } from './kit.js';
import * as whack from './whack.js';
import * as lasthit from './lasthit.js';
import * as memory from './memory.js';
import * as rune from './rune.js';

const ARENA = {
  id: 'arena',
  name: '1vDOQUZ Arena',
  short: 'Arena',
  icon: 'bow',
  color: 'var(--aegis)',
  kind: 'Ultimate · R',
  blurb: 'Okçu kahramanınla dalga dalga gelen DOG sürülerine karşı tek başına. Q W E R senin, dokuz DOG karşında.',
  time: 'Dalga dalga',
  diff: 3,
  unit: 'puan',
  higherIsBetter: true,
  format: (n) => `${fmtNum(n)} puan`,
};

const GAMES = [ARENA, whack.meta, lasthit.meta, memory.meta, rune.meta];
const MODS = { dogavi: whack, lasthit, hafiza: memory, rune };
const byId = (id) => GAMES.find((g) => g.id === id) || null;

let active = null;

export default {
  mount(el, ctx) {
    const inst = createSalon(el, ctx);
    active = inst;
    return () => {
      inst.destroy();
      if (active === inst) active = null;
    };
  },
  onSub(sub) {
    if (active) active.show(sub);
  },
};

function hudOffset() {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-h'));
  return (Number.isFinite(v) ? v : 56) + 12;
}

function createSalon(el, ctx) {
  const root = h('div', { class: 'wrap gm' });
  const hub = h('div', { class: 'gm-hub' });
  const page = h('div', { class: 'gm-page', hidden: true });
  root.append(hub, page);
  el.appendChild(root);

  const cleanups = [];
  const bestEls = []; // [{ meta, el }]
  let current = null; // { id, cleanup }
  let token = 0;
  let hubScroll = 0;

  const nav = {
    list: GAMES,
    open: (id) => open(id),
    back: () => open(null),
  };

  // ------------------------------------------------------------ merkez
  buildHub();
  const unMe = store.me.subscribe(refreshBest);
  cleanups.push(unMe);

  function bestNode(meta, cls = '') {
    const s = h('strong', { class: `num ${cls}` }, bestText(meta));
    bestEls.push({ meta, el: s, kind: 'text' });
    return s;
  }

  function refreshBest() {
    const scores = store.me.get().scores || {};
    for (const b of bestEls) {
      const v = scores[b.meta.id];
      if (b.kind === 'text') {
        b.el.textContent = typeof v === 'number' ? b.meta.format(v) : 'henüz yok';
        b.el.classList.toggle('dim', typeof v !== 'number');
      } else if (b.kind === 'slot') {
        const has = typeof v === 'number';
        b.el.classList.toggle('empty', !has);
        b.charge.textContent = has ? (b.meta.id === 'rune' ? `${v}ms` : compact(v)) : '';
        b.el.title = `${b.meta.name}: ${has ? b.meta.format(v) : 'henüz oynamadın'}`;
      } else if (b.kind === 'aegis') {
        const n = GAMES.filter((g) => typeof scores[g.id] === 'number').length;
        b.el.classList.toggle('empty', n < GAMES.length);
        b.charge.textContent = `${n}/${GAMES.length}`;
        b.foot.textContent = n === GAMES.length
          ? 'Beş oyunda da rekorun var. Aegis senin.'
          : n === 0
            ? 'Henüz rekor yok. Bir oyun seç, envanteri doldur.'
            : `${n}/${GAMES.length} oyunda rekorun var. Aegis için hepsini dene.`;
      }
    }
  }

  function linkTo(meta, node) {
    node.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
      e.preventDefault();
      sound.click();
      open(meta.id);
    });
    return node;
  }

  function diffPips(n) {
    return h('span', { class: 'gm-diff', title: `Zorluk ${n}/3`, 'aria-label': `Zorluk ${n}/3` },
      [1, 2, 3].map((i) => h('i', { class: i <= n ? 'on' : '' })),
    );
  }

  function featureCard() {
    const art = artUrl('poster-1vdoquz');
    const scene = art
      ? h('div', { class: 'gm-feature-poster', style: { backgroundImage: `url("${art}")` }, role: 'img', 'aria-label': '1vDOQUZ posteri: okçu kahraman, etrafında dokuz DOG' })
      : h('div', { class: 'gm-feature-art gm-arena-scene', 'aria-hidden': 'true' },
        h('span', { class: 'gm-arena-floor' }),
        h('span', { class: 'gm-arena-ring r1' }),
        h('span', { class: 'gm-arena-ring r2' }),
        h('span', { class: 'gm-arena-orbit' },
          Array.from({ length: 9 }, (_, i) => h('span', { class: 'gm-arena-dog', style: { '--a': `${i * 40}deg` } }, icon('paw', { size: 18, stroke: 2 }))),
        ),
        h('span', { class: 'gm-arena-hero' }, icon('bow', { size: 44, stroke: 2 })),
        h('span', { class: 'gm-arena-vs' }, '1 vs 9'),
      );
    const a = h('a', { class: `gm-card gm-feature${art ? ' has-poster' : ''}`, href: '#oyunlar--arena', style: { '--gc': ARENA.color } },
      scene,
      h('div', { class: 'gm-feature-body' },
        h('div', { class: 'row gm-feature-tags' },
          h('span', { class: 'gm-ult' }, icon('bolt', { size: 14 }), 'Ultimate'),
          h('span', { class: 'kbd' }, 'R'),
          h('span', { class: 'badge gold' }, '3D'),
        ),
        h('h2', { class: 'gm-feature-name' }, '1vDO', h('em', null, 'Q'), 'UZ', h('br'), 'Arena'),
        h('p', { class: 'gm-card-desc' }, ARENA.blurb),
        h('div', { class: 'gm-card-meta' },
          h('span', { class: 'badge' }, icon('hourglass', { size: 12 }), ARENA.time),
          diffPips(ARENA.diff),
        ),
        h('div', { class: 'gm-card-foot' },
          h('span', { class: 'gm-card-best' }, 'En iyin: ', bestNode(ARENA)),
          h('span', { class: 'btn gold gm-feature-cta', 'aria-hidden': 'true' }, 'Arenaya gir', icon('arrowRight', { size: 16 })),
        ),
      ),
    );
    linkTo(ARENA, a);
    cleanups.push(attachTilt(a, { max: 4, scale: 1.01 }));
    return a;
  }

  function gameCard(meta, key) {
    const a = h('a', { class: 'gm-card', href: `#oyunlar--${meta.id}`, style: { '--gc': meta.color } },
      h('div', { class: 'gm-card-top' },
        h('span', { class: 'gm-slot', 'aria-hidden': 'true' }, icon(meta.icon, { size: 28 })),
        h('div', { class: 'gm-card-titles' },
          h('span', { class: 'gm-card-kind' }, meta.kind),
          h('h2', { class: 'gm-card-name' }, meta.name),
        ),
        h('span', { class: 'kbd gm-card-key', title: `Kısayol: ${key}` }, key),
      ),
      h('p', { class: 'gm-card-desc' }, meta.blurb),
      h('div', { class: 'gm-card-meta' },
        h('span', { class: 'badge' }, icon('hourglass', { size: 12 }), meta.time),
        diffPips(meta.diff),
      ),
      h('div', { class: 'gm-card-foot' },
        h('span', { class: 'gm-card-best' }, 'En iyin: ', bestNode(meta)),
        h('span', { class: 'gm-card-go' }, 'Oyna', icon('arrowRight', { size: 16 })),
      ),
    );
    linkTo(meta, a);
    cleanups.push(attachTilt(a, { max: 6 }));
    return a;
  }

  function inventory() {
    const slots = GAMES.map((meta) => {
      const charge = h('span', { class: 'gm-inv-charge num' });
      const b = h('a', { class: 'gm-inv-slot empty', href: `#oyunlar--${meta.id}`, style: { '--gc': meta.color }, 'aria-label': `${meta.name} rekorun` },
        icon(meta.icon, { size: 24 }),
        charge,
      );
      bestEls.push({ meta, el: b, charge, kind: 'slot' });
      return linkTo(meta, b);
    });
    const aegisCharge = h('span', { class: 'gm-inv-charge num' });
    const aegis = h('span', { class: 'gm-inv-slot gm-inv-aegis empty', title: 'Salon Aegis’i: beş oyunda da rekor', style: { '--gc': 'var(--aegis)' } }, icon('shield', { size: 24 }), aegisCharge);
    const foot = h('p', { class: 'xsmall dim gm-inv-foot' });
    bestEls.push({ meta: null, el: aegis, charge: aegisCharge, foot, kind: 'aegis' });
    const nick = h('span', { class: 'gm-inv-nick' }, store.me.get().nick || 'Anonim');
    cleanups.push(store.me.subscribe((d) => { nick.textContent = d.nick || 'Anonim'; }));
    return h('section', { class: 'gm-inv panel raised frame', 'aria-label': 'Rekor envanterin' },
      h('div', { class: 'gm-inv-head' }, h('span', { class: 'eyebrow' }, 'Rekor envanteri'), nick),
      h('div', { class: 'gm-inv-grid' }, slots, aegis),
      foot,
    );
  }

  function boards() {
    const saved = ls.get('gm-lb-tab', 'dogavi');
    let sel = byId(saved) ? saved : 'dogavi';
    let unLb = null;
    const host = h('div', { class: 'gm-boards-host', role: 'tabpanel', id: 'gm-lb-panel' });
    const tabs = h('div', { class: 'tabs gm-boards-tabs', role: 'tablist', 'aria-label': 'Skor tabloları' });
    const btns = GAMES.map((m) => {
      const b = h('button', {
        class: 'tab', type: 'button', role: 'tab', id: `gm-lb-tab-${m.id}`,
        'aria-controls': 'gm-lb-panel', 'aria-selected': String(m.id === sel), tabindex: m.id === sel ? '0' : '-1',
      }, m.short || m.name);
      b.addEventListener('click', () => select(m.id, true));
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const i = GAMES.findIndex((g) => g.id === sel);
        const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + GAMES.length) % GAMES.length;
        select(GAMES[j].id, true);
        btns[j].focus();
      });
      tabs.appendChild(b);
      return b;
    });
    function select(id, user) {
      sel = id;
      if (user) { ls.set('gm-lb-tab', id); sound.click(); }
      btns.forEach((b, i) => {
        const on = GAMES[i].id === id;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      host.setAttribute('aria-labelledby', `gm-lb-tab-${id}`);
      if (unLb) unLb();
      clear(host);
      const m = byId(id);
      unLb = mountLeaderboard(host, {
        gameId: m.id,
        title: `${m.name} · ilk 10`,
        higherIsBetter: m.higherIsBetter !== false,
        format: m.format,
      });
    }
    select(sel, false);
    cleanups.push(() => unLb && unLb());
    return h('section', { class: 'panel gm-boards', 'aria-labelledby': 'gm-boards-title' },
      h('div', { class: 'gm-block-head' },
        h('span', { class: 'eyebrow' }, 'Canlı'),
        h('h2', { class: 'h2', id: 'gm-boards-title' }, 'Salon tablosu'),
      ),
      tabs,
      host,
    );
  }

  function buildHub() {
    const head = h('header', { class: 'gm-head' },
      h('div', { class: 'section-head gm-head-text' },
        h('span', { class: 'eyebrow' }, 'W · Mini Oyunlar'),
        h('h1', { class: 'h1' }, 'Oyun ', h('em', null, 'Salonu')),
        h('p', { class: 'lead' }, 'Beş mini oyun, tek görev: DOG’ları ayıkla, carry’ni koru, 1vDOQUZ ol. En iyi skorların profiline yazılır, salonun tablosunda parlar.'),
      ),
      inventory(),
    );

    const grid = h('div', { class: 'gm-grid' },
      featureCard(),
      GAMES.slice(1).map((m, i) => gameCard(m, String(i + 1))),
    );

    const chatHost = h('div');
    const lower = h('div', { class: 'gm-lower' },
      boards(),
      h('section', { class: 'panel gm-chat' }, chatHost),
    );
    hub.append(head, grid, lower);
    cleanups.push(mountComments(chatHost, { threadId: 'games', title: 'Oyun Salonu Sohbeti', placeholder: 'Skorunla övün ya da DOG’ları ifşa et…' }));
    refreshBest();
  }

  // Merkezde 1–4 tuşları oyunları açar (R zaten kabukta Arena'ya gider)
  function onHubKey(e) {
    if (hub.hidden || e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
    if (document.querySelector('.modal-backdrop')) return;
    const n = Number(e.key);
    if (!Number.isInteger(n) || n < 1 || n > 4) return;
    e.preventDefault();
    sound.click();
    open(GAMES[n].id);
  }
  window.addEventListener('keydown', onHubKey);
  cleanups.push(() => window.removeEventListener('keydown', onHubKey));

  // ------------------------------------------------------------ oyun sayfası
  function closeGame() {
    token++;
    if (current && current.cleanup) {
      try { current.cleanup(); } catch (e) { console.error(e); }
    }
    current = null;
    ctx.hotkeys(true);
    clear(page);
  }

  function buildPage(meta) {
    const back = h('button', { class: 'btn ghost sm gm-back', type: 'button' }, icon('arrowLeft', { size: 16 }), 'Oyunlar');
    back.addEventListener('click', () => { sound.click(); open(null); });
    const crumbHub = h('a', { href: '#oyunlar' }, 'Oyun Salonu');
    crumbHub.addEventListener('click', (e) => { e.preventDefault(); open(null); });
    const top = h('div', { class: 'gm-topbar' },
      back,
      h('nav', { class: 'gm-crumbs', 'aria-label': 'Konum' },
        crumbHub,
        h('span', { 'aria-hidden': 'true' }, '/'),
        h('span', { 'aria-current': 'page' }, meta.name),
      ),
    );
    const body = h('div', { class: `gm-page-body gm-page-${meta.id}` });
    page.append(top, body);
    const my = ++token;
    current = { id: meta.id, cleanup: null };
    if (meta.id === 'arena') {
      body.appendChild(h('div', { class: 'view-loading' }, h('div', { class: 'spinner' })));
      import('./arena/arena.js')
        .then((m) => {
          if (my !== token) return;
          clear(body);
          const c = m.mountArena(body, ctx);
          if (current && current.id === 'arena') current.cleanup = typeof c === 'function' ? c : null;
        })
        .catch((err) => {
          console.error(err);
          if (my !== token) return;
          clear(body).appendChild(h('div', { class: 'empty' }, 'Arena yüklenemedi. Sayfayı yenileyip tekrar dene.'));
        });
    } else {
      try {
        const c = MODS[meta.id].mount(body, ctx, nav);
        current.cleanup = typeof c === 'function' ? c : null;
      } catch (e) {
        console.error(e);
        body.appendChild(h('div', { class: 'empty' }, 'Bu oyun açılamadı. Oyunlar sayfasına dönüp tekrar dene.'));
      }
    }
  }

  function scrollToY(y) {
    window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
  }

  function show(sub) {
    const meta = sub ? byId(sub) : null;
    if (sub && !meta) ctx.setSub(null);
    const id = meta ? meta.id : null;
    if ((current ? current.id : null) === id && (id ? !page.hidden : !hub.hidden)) return;
    const fromHub = !hub.hidden;
    if (fromHub) hubScroll = window.scrollY;
    closeGame();
    if (!meta) {
      page.hidden = true;
      hub.hidden = false;
      refreshBest();
      document.title = 'Mini Oyunlar · DOG DOG DOG Üssü';
      requestAnimationFrame(() => scrollToY(hubScroll));
      return;
    }
    hub.hidden = true;
    page.hidden = false;
    buildPage(meta);
    document.title = `${meta.name} · Mini Oyunlar · DOG DOG DOG Üssü`;
    // Oyunun başına kaydır
    requestAnimationFrame(() => {
      if (page.hidden) return;
      const y = page.getBoundingClientRect().top + window.scrollY - hudOffset();
      scrollToY(y);
    });
  }

  function open(id) {
    ctx.setSub(id || null);
    show(id || null);
  }

  // İlk açılış: #oyunlar--<id> doğrudan oyuna
  if (ctx.sub) show(ctx.sub);

  return {
    show,
    destroy() {
      closeGame();
      for (const fn of cleanups.splice(0)) {
        try { fn(); } catch (e) { console.error(e); }
      }
      root.remove();
    },
  };
}

