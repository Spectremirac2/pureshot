// Quizler bölümü (#quizler). Merkez: 4 quiz kartı. Alt sayfalar: hangidog, bilgi, dogmu, hayran.
// Kart → ctx.setSub(id) + yerinde çizim; hash ile gelen değişiklikler onSub(sub) ile.

import './quizzes.css';
import { h, clear, fmtNum } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { store, agg } from '../../core/store.js';
import { sound } from '../../core/sound.js';
import { byId, LEGEND } from '../../data/archetypes.js';
import { QUIZZES } from '../../data/quizzes.js';
import { proceduralPortrait } from '../../components/portrait.js';
import { portraitUrl } from '../../core/assets.js';
import { attachTilt } from '../../components/tilt.js';
import { makeScope, getLast, keyOk } from './ui.js';
import { mountHangiDog } from './hangidog.js';
import { mountBilgi } from './bilgi.js';
import { mountDogMu } from './dogmu.js';
import { mountHayran } from './hayran.js';

const VIEWS = {
  hangidog: mountHangiDog,
  bilgi: mountBilgi,
  dogmu: mountDogMu,
  hayran: mountHayran,
};

let api = null;

const portraitSrc = (a) => portraitUrl(a.id) || proceduralPortrait(a, 384);

/** Kartın alt satırı: bu ziyaretçinin son sonucu. */
function lastResult(id, me, last) {
  if (id === 'hangidog') {
    const a = me.picks && me.picks.hangidog ? byId(me.picks.hangidog) : null;
    if (!a) return null;
    return h('span', { class: 'qz-last-val' },
      h('span', { class: 'qz-dot', style: { '--c': a.color } }), a.name);
  }
  const l = last[id];
  if (id === 'bilgi') {
    if (l) return h('span', { class: 'qz-last-val' }, h('b', { class: 'num' }, fmtNum(l.score)), ' puan · ', l.title);
    if (me.scores && me.scores.bilgi != null) return h('span', { class: 'qz-last-val' }, 'En iyi: ', h('b', { class: 'num' }, fmtNum(me.scores.bilgi)), ' puan');
    return null;
  }
  if (id === 'dogmu') {
    if (l) return h('span', { class: 'qz-last-val' }, 'DOG radarı ', h('b', { class: 'num' }, `%${l.pct}`), ' · ', l.title);
    if (me.scores && me.scores.dogmu != null) return h('span', { class: 'qz-last-val' }, 'DOG radarı ', h('b', { class: 'num' }, `%${me.scores.dogmu}`));
    return null;
  }
  if (id === 'hayran') {
    if (l) return h('span', { class: 'qz-last-val' }, h('b', { class: 'num' }, `${l.correct}/${l.total}`), ' · ', l.title);
    if (me.scores && me.scores.hayran != null) return h('span', { class: 'qz-last-val' }, 'En iyi: ', h('b', { class: 'num' }, `${me.scores.hayran}/12`));
    return null;
  }
  return null;
}

function solved(id, me, last) {
  if (id === 'hangidog') return !!(me.picks && me.picks.hangidog);
  return !!(last[id] || (me.scores && me.scores[id] != null));
}

function renderHub(root, open) {
  const scope = makeScope();
  const me0 = store.me.get();

  // ---- Kartlar
  const lastSlots = new Map();
  const cards = QUIZZES.map((q, i) => {
    const lastEl = h('span', { class: 'qz-card-last' });
    lastSlots.set(q.id, lastEl);
    const feature = i === 0;
    const art = feature
      ? h('div', { class: 'qz-fan', 'aria-hidden': 'true' },
        [byId('farm'), byId('feed'), LEGEND, byId('pause'), byId('chat')].map((a, k) =>
          h('img', { class: `qz-fan-img f${k}`, src: portraitSrc(a), alt: '', width: '384', height: '384', decoding: 'async' })),
      )
      : null;
    const card = h('a', {
      class: `qz-card${feature ? ' feature' : ''}`,
      href: `#quizler--${q.id}`,
      style: { '--i': i },
      'aria-label': `${q.name}: ${q.count} ${q.unit}, yaklaşık ${q.minutes} dakika`,
    },
      art,
      h('span', { class: 'qz-card-top' },
        h('span', { class: 'qz-slot', 'aria-hidden': 'true' }, icon(q.icon, { size: feature ? 34 : 28, stroke: 1.9 }), h('span', { class: 'qz-slot-key' }, String(i + 1))),
        h('span', { class: 'qz-card-titles' },
          h('span', { class: 'qz-card-kind' }, q.kind),
          h('span', { class: 'qz-card-name' }, q.name),
        ),
      ),
      h('span', { class: 'qz-card-blurb' }, q.blurb),
      h('span', { class: 'qz-costs' },
        h('span', { class: 'qz-cost mana', title: 'Soru sayısı' }, h('i', { 'aria-hidden': 'true' }), `${q.count} ${q.unit}`),
        h('span', { class: 'qz-cost cd', title: 'Tahmini süre' }, icon('clock', { size: 14 }), `~${q.minutes} dk`),
      ),
      h('span', { class: 'qz-card-foot' },
        lastEl,
        h('span', { class: 'qz-card-go' }, 'Başla', icon('arrowRight', { size: 16 })),
      ),
    );
    card.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      sound.click();
      open(q.id);
    });
    scope.add(attachTilt(card, { max: feature ? 4 : 6, scale: 1.01 }));
    return card;
  });

  // ---- Karne (envanter yuvaları) + topluluk nabzı
  const invSlots = QUIZZES.map((q) => h('span', { class: 'qz-inv-slot', title: q.name }, icon(q.icon, { size: 22 })));
  const invCount = h('b', { class: 'num' }, '0');
  const pulse = h('p', { class: 'qz-pulse xsmall' }, 'Topluluk verisi yükleniyor…');

  const paintMe = (me) => {
    const last = getLast();
    let n = 0;
    QUIZZES.forEach((q, i) => {
      const done = solved(q.id, me, last);
      if (done) n++;
      invSlots[i].classList.toggle('on', done);
      const slot = lastSlots.get(q.id);
      const val = lastResult(q.id, me, last);
      slot.replaceChildren(
        h('span', { class: 'qz-last-lbl' }, 'Son sonucun'),
        val || h('span', { class: 'qz-last-val dim' }, 'Henüz çözmedin'),
      );
    });
    invCount.textContent = String(n);
  };
  paintMe(me0);
  scope.add(store.me.subscribe(paintMe));

  scope.add(store.fans((fans) => {
    const dist = agg.distribution(fans, 'hangidog');
    const total = Object.values(dist).reduce((s, v) => s + v, 0);
    const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
    const topA = top ? byId(top[0]) : null;
    const votes = fans.reduce((s, f) => s + Object.keys(f.picks || {}).filter((k) => k.startsWith('dm:')).length, 0);
    pulse.replaceChildren(
      icon('eye', { size: 14 }),
      h('span', null,
        total ? [h('b', { class: 'num' }, fmtNum(total)), ' kişi DOG’unu buldu'] : 'Henüz kimse DOG’unu bulmadı',
        topA ? [' · en kalabalık sürü: ', h('b', null, topA.name)] : null,
        votes ? [' · ', h('b', { class: 'num' }, fmtNum(votes)), ' DOG kararı'] : null,
      ),
    );
  }));

  const head = h('header', { class: 'qz-hub-head' },
    h('div', { class: 'section-head' },
      h('span', { class: 'eyebrow' }, 'E · Quizler'),
      h('h1', { class: 'h1 qz-hub-title' }, 'Kaç ', h('em', null, 'DOG'), ' ettiğini', h('br'), 'kanıtla.'),
      h('p', { class: 'lead' }, 'Dört quiz, sıfır ward. Kişilik testi, süreli Dota bilgisi, DOG radarı ve gerçek hayran sınavı. Sonuçların profilinde kalır; topluluğa karşı kıyaslanır.'),
    ),
    h('aside', { class: 'qz-inv panel tight', 'aria-label': 'Quiz karnen' },
      h('span', { class: 'qz-inv-head' }, h('span', { class: 'eyebrow' }, 'Envanter'), h('span', { class: 'small muted' }, invCount, '/4 quiz çözüldü')),
      h('span', { class: 'qz-inv-slots' }, invSlots),
      pulse,
    ),
  );

  const grid = h('div', { class: 'qz-grid' }, cards);
  const tip = h('p', { class: 'qz-hub-tip xsmall dim' },
    'İpucu: ', h('span', { class: 'kbd' }, '1'), '–', h('span', { class: 'kbd' }, '4'),
    ' ile quizi aç, sorularda aynı tuşlarla cevapla, ', h('span', { class: 'kbd' }, 'Enter'), ' ile ilerle. DOG kartlarında ',
    h('span', { class: 'kbd' }, '←'), ' ', h('span', { class: 'kbd' }, '→'), ' ya da kaydır.');

  const view = h('div', { class: 'qz-hub' }, head, grid, tip);
  root.appendChild(view);

  // 1–4: kartlardaki yuva numarasıyla quizi aç
  scope.on(window, 'keydown', (e) => {
    if (!keyOk(e) || !/^[1-4]$/.test(e.key)) return;
    const q = QUIZZES[Number(e.key) - 1];
    if (!q) return;
    e.preventDefault();
    sound.click();
    open(q.id);
  });

  return () => { scope.dispose(); view.remove(); };
}

export default {
  mount(el, ctx) {
    const root = h('div', { class: 'wrap qz' });
    el.appendChild(root);
    let cleanupView = null;
    let currentSub = undefined;

    function show(sub) {
      const target = VIEWS[sub] ? sub : null;
      if (target === currentSub && cleanupView) return;
      if (cleanupView) { try { cleanupView(); } catch (e) { console.error(e); } cleanupView = null; }
      clear(root);
      currentSub = target;
      const quiz = QUIZZES.find((q) => q.id === target);
      if (!target) {
        if (sub) ctx.setSub(null);
        cleanupView = renderHub(root, open);
      } else {
        cleanupView = VIEWS[target](root, { ctx, quiz, back: () => { sound.click(); open(null); } });
      }
      root.dataset.view = target || 'hub';
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    function open(sub) {
      ctx.setSub(sub || null);
      show(sub || null);
    }

    api = { show };
    show(ctx.sub);

    return () => {
      if (cleanupView) { try { cleanupView(); } catch (e) { console.error(e); } }
      cleanupView = null;
      api = null;
      root.remove();
    };
  },
  onSub(sub) {
    if (api) api.show(sub);
  },
};
