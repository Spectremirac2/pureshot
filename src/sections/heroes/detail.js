// Kahraman detayı (#kahramanlar--<id>): büyük arma, yarım daire DOG'luk göstergesi, oylama,
// "Topluluk der ki / Neden? / İmza hareketi / Savunma avukatı", bağlı DOG türü, benzerler, yorumlar.

import { h, clear, prefersReducedMotion, fmtNum } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { HEROES, ATTRS, ROLES, ATTACKS, DOG_TIERS, tierOf } from '../../data/heroes.js';
import { byId } from '../../data/archetypes.js';
import { portraitEl } from '../../components/portrait.js';
import { mountComments } from '../../components/comments.js';
import { attachTilt } from '../../components/tilt.js';
import { crestSvg } from './crest.js';
import { K } from './community.js';

const ORDER = HEROES.slice().sort((a, b) => a.name.localeCompare(b.name, 'en'));
const RANK = new Map(HEROES.slice().sort((a, b) => b.dogRate - a.dogRate || a.name.localeCompare(b.name)).map((x, i) => [x.id, i + 1]));

/** Yarım daire gösterge: ana değer (topluluk) + ön yargı işareti. */
function gaugeEl() {
  const reduced = prefersReducedMotion();
  const ARC = 'M 20 100 A 80 80 0 0 1 180 100';
  const val = h('path', { d: ARC, class: 'hr-gauge-val', pathLength: '100', 'stroke-dasharray': '0 100' });
  const needle = h('g', { class: 'hr-gauge-needle', transform: 'rotate(-90 100 100)' },
    h('line', { x1: '100', y1: '100', x2: '100', y2: '34' }),
    h('circle', { cx: '100', cy: '100', r: '7' }),
  );
  const biasMark = h('circle', { class: 'hr-gauge-bias', r: '5', cx: '20', cy: '100' });
  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI - (i / 10) * Math.PI;
    const r1 = 92, r2 = i % 5 === 0 ? 84 : 88;
    ticks.push(h('line', {
      class: 'hr-gauge-tick',
      x1: (100 + Math.cos(a) * r1).toFixed(1), y1: (100 - Math.sin(a) * r1).toFixed(1),
      x2: (100 + Math.cos(a) * r2).toFixed(1), y2: (100 - Math.sin(a) * r2).toFixed(1),
    }));
  }
  // Kademe bantları (dış halka)
  const bands = DOG_TIERS.slice().reverse().map((t, i, arr) => {
    const from = t.min;
    const to = i < arr.length - 1 ? arr[i + 1].min : 100;
    return h('path', {
      d: ARC, class: `hr-gauge-band hr-t-${t.id}`, pathLength: '100',
      'stroke-dasharray': `0 ${from} ${to - from} 100`,
    });
  });
  const svg = h('svg', { viewBox: '0 0 200 116', class: 'hr-gauge', 'aria-hidden': 'true' },
    h('path', { d: ARC, class: 'hr-gauge-track' }),
    bands,
    val,
    ticks,
    biasMark,
    needle,
  );
  const num = h('span', { class: 'hr-gauge-num mono' }, '%0');
  let shown = 0;
  let raf = 0;
  function set(live, bias) {
    const v = Math.max(0, Math.min(100, live));
    val.setAttribute('stroke-dasharray', `${v.toFixed(1)} 100`);
    needle.setAttribute('transform', `rotate(${(-90 + v * 1.8).toFixed(1)} 100 100)`);
    const ba = Math.PI - (bias / 100) * Math.PI;
    biasMark.setAttribute('cx', (100 + Math.cos(ba) * 80).toFixed(1));
    biasMark.setAttribute('cy', (100 - Math.sin(ba) * 80).toFixed(1));
    const target = Math.round(v);
    cancelAnimationFrame(raf);
    if (reduced) { shown = target; num.textContent = `%${target}`; return; }
    const from = shown;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 900);
      const e = 1 - Math.pow(1 - k, 3);
      shown = Math.round(from + (target - from) * e);
      num.textContent = `%${shown}`;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  return { svg, num, set, destroy: () => cancelAnimationFrame(raf) };
}

export function mountDetail(host, env, hero) {
  const { ctx, comm } = env;
  const cleanups = [];
  const attr = ATTRS[hero.attr];
  const idx = ORDER.findIndex((x) => x.id === hero.id);
  const prev = ORDER[(idx - 1 + ORDER.length) % ORDER.length];
  const next = ORDER[(idx + 1) % ORDER.length];

  // ---------------------------------------------------------------- üst gezinme
  const nav = h('nav', { class: 'hr-dnav', 'aria-label': 'Kahraman gezinmesi' },
    h('a', { class: 'btn ghost sm', href: '#kahramanlar' }, icon('arrowLeft', { size: 16 }), 'Duvar'),
    h('span', { class: 'spacer' }),
    h('a', { class: 'btn ghost sm hr-dnav-pn', href: `#kahramanlar--${prev.id}`, title: 'Önceki kahraman (←)' }, icon('arrowLeft', { size: 16 }), h('span', null, prev.name)),
    h('a', { class: 'btn ghost sm hr-dnav-pn', href: `#kahramanlar--${next.id}`, title: 'Sonraki kahraman (→)' }, h('span', null, next.name), icon('arrowRight', { size: 16 })),
  );

  // ---------------------------------------------------------------- kahraman bandı
  const crestWrap = h('div', { class: `hr-d-crest hr-a-${hero.attr}` }, crestSvg(hero, { title: `${hero.name} arması` }));
  const pips = h('span', { class: 'hr-pips', title: `Karmaşıklık ${hero.complexity}/3`, 'aria-label': `Karmaşıklık ${hero.complexity}/3` },
    [1, 2, 3].map((i) => h('span', { class: i <= hero.complexity ? 'on' : '' })));
  const band = h('section', { class: 'hr-d-band panel raised frame' },
    crestWrap,
    h('div', { class: 'hr-d-id' },
      h('span', { class: 'eyebrow' }, `DOG dosyası · ön yargı sırası ${RANK.get(hero.id)}/${HEROES.length}`),
      h('h1', { class: 'display hr-d-name' }, hero.name),
      h('div', { class: 'row hr-d-meta' },
        h('span', { class: `hr-attr-badge hr-a-${hero.attr}` }, h('span', { class: 'hr-dot' }), attr.label),
        h('span', { class: 'badge' }, ATTACKS[hero.attack]),
        h('span', { class: 'badge hr-cx' }, 'Karmaşıklık ', pips),
      ),
      h('ul', { class: 'hr-roles', 'aria-label': 'Roller' }, hero.roles.map((r) => h('li', { class: 'hr-role' }, ROLES[r] || r))),
      h('div', { class: 'hr-tags', 'aria-label': 'Etiketler' }, hero.tags.map((t) => h('span', { class: 'hr-tag' }, '#', t))),
    ),
  );
  cleanups.push(attachTilt(crestWrap, { max: 14 }));

  // ---------------------------------------------------------------- gösterge + oylama
  const gauge = gaugeEl();
  cleanups.push(gauge.destroy);
  const tierStamp = h('span', { class: 'hr-d-stamp' });
  const biasLine = h('p', { class: 'small muted hr-d-biasline' });
  const voteLine = h('p', { class: 'small hr-d-voteline' });
  const split = h('div', { class: 'hr-split', 'aria-hidden': 'true' }, h('span', { class: 'is-dog' }), h('span', { class: 'is-not' }));
  const dogBtn = h('button', { class: 'btn primary lg hr-vote is-dog', type: 'button', 'aria-pressed': 'false' }, icon('paw', { size: 20 }), 'DOG');
  const notBtn = h('button', { class: 'btn jade lg hr-vote is-not', type: 'button', 'aria-pressed': 'false' }, icon('shield', { size: 20 }), 'DOG değil');
  const voteNote = h('p', { class: 'hint hr-d-note' });

  const castVote = (value, btn) => {
    const now = comm.vote(hero.id, value);
    const r = btn.getBoundingClientRect();
    if (now === 'dog') {
      ctx.sound.bark(1.05);
      ctx.fx.floatText('DOG!', r.left + r.width / 2, r.top, { count: 2 });
    } else if (now === 'not') {
      ctx.sound.good();
      ctx.fx.floatText('masum', r.left + r.width / 2, r.top, { color: '#43d6a0' });
    } else {
      ctx.sound.click();
      ctx.fx.toast('Oyun geri alındı.');
    }
  };
  dogBtn.addEventListener('click', () => castVote('dog', dogBtn));
  notBtn.addEventListener('click', () => castVote('not', notBtn));

  const live = h('section', { class: 'hr-d-live panel', 'aria-label': 'Canlı DOG endeksi' },
    h('div', { class: 'hr-d-gauge' },
      gauge.svg,
      h('div', { class: 'hr-d-gauge-read' },
        gauge.num,
        h('span', { class: 'hr-gauge-cap' }, 'Topluluk DOG Endeksi'),
      ),
      tierStamp,
    ),
    h('div', { class: 'hr-d-vote' },
      h('h2', { class: 'h3' }, 'Bu kahramanı seçen DOG mu?'),
      h('div', { class: 'row hr-vote-row' }, dogBtn, notBtn),
      split,
      voteLine,
      biasLine,
      voteNote,
    ),
  );

  function renderLive() {
    const s = comm.get(hero.id);
    if (!s) return;
    gauge.set(s.live, s.bias);
    const t = s.tier;
    tierStamp.className = `hr-d-stamp hr-t-${t.id}`;
    tierStamp.textContent = `${t.id} · ${t.label}`;
    dogBtn.setAttribute('aria-pressed', String(s.myVote === 'dog'));
    notBtn.setAttribute('aria-pressed', String(s.myVote === 'not'));
    dogBtn.title = s.myVote === 'dog' ? 'Oyunu geri almak için tekrar bas' : 'Bu kahramanı seçen DOG';
    notBtn.title = s.myVote === 'not' ? 'Oyunu geri almak için tekrar bas' : 'Bu kahramanı seçen masum';
    const dogPct = s.total ? (s.dog / s.total) * 100 : 50;
    split.firstChild.style.width = `${dogPct}%`;
    split.lastChild.style.width = `${100 - dogPct}%`;
    split.classList.toggle('is-empty', !s.total);
    voteLine.textContent = s.total
      ? `${fmtNum(s.dog)} DOG · ${fmtNum(s.not)} DOG değil · toplam ${fmtNum(s.total)} oy`
      : 'Henüz oy yok. İlk hükmü sen ver.';
    biasLine.textContent = `Ön yargı tabanı %${s.bias} (${s.biasTier.label}) · endeks = (taban×${K} + DOG oyu×100) ÷ (${K} + toplam oy)`;
    voteNote.textContent = s.myVote ? 'Oyun kaydedildi. Değiştirmek için diğerine, geri almak için aynısına bas.' : '';
  }
  cleanups.push(comm.subscribe(renderLive));
  renderLive();

  // ---------------------------------------------------------------- metin kartları
  const cardsGrid = h('div', { class: 'hr-d-cards' },
    h('article', { class: 'hr-d-card is-prejudice panel' },
      h('h2', { class: 'hr-d-h' }, icon('chat', { size: 18 }), 'Topluluk der ki'),
      h('p', { class: 'hr-quote hr-quote-lg' }, hero.prejudice.replace(/^Topluluk der ki:\s*/, '')),
    ),
    h('article', { class: 'hr-d-card is-why panel' },
      h('h2', { class: 'hr-d-h' }, icon('question', { size: 18 }), 'Neden?'),
      h('p', null, hero.why),
    ),
    h('article', { class: 'hr-d-card is-move panel' },
      h('h2', { class: 'hr-d-h' }, icon('bolt', { size: 18 }), 'İmza hareketi'),
      h('div', { class: 'hr-move' },
        h('span', { class: 'hr-move-slot', 'aria-hidden': 'true' }, h('span', { class: 'kbd' }, 'R'), icon('sparkle', { size: 26 })),
        h('p', { class: 'hr-move-text' }, hero.famousMove),
      ),
    ),
    h('article', { class: 'hr-d-card is-defense panel' },
      h('h2', { class: 'hr-d-h' }, icon('shield', { size: 18 }), 'Savunma avukatı'),
      h('p', null, hero.defense),
    ),
  );

  // ---------------------------------------------------------------- bağlı DOG türü
  const arch = byId(hero.archetype);
  const archBox = arch ? h('section', { class: 'hr-d-arch panel raised' },
    h('div', { class: 'hr-d-arch-img' }, portraitEl(arch, { alt: `${arch.name} portresi` })),
    h('div', { class: 'stack hr-d-arch-body' },
      h('span', { class: 'eyebrow' }, arch.id === 'legend' ? 'Bu kahramanın efsane tarafı' : 'Bu kahramanın beslediği DOG türü'),
      h('h2', { class: 'h2' }, arch.name),
      h('p', { class: 'muted' }, arch.tagline),
      h('div', null,
        h('button', { class: 'btn gold', type: 'button', onclick: () => { ctx.sound.click(); ctx.go('karakterler', arch.id); } },
          icon('mask', { size: 18 }), 'Tür analizine git'),
      ),
    ),
  ) : null;

  // ---------------------------------------------------------------- benzer DOG'luk
  const similar = HEROES.filter((x) => x.id !== hero.id)
    .map((x) => ({ x, d: Math.abs(x.dogRate - hero.dogRate) + (x.archetype === hero.archetype ? -2 : 0) }))
    .sort((a, b) => a.d - b.d || a.x.name.localeCompare(b.x.name))
    .slice(0, 3)
    .map((o) => o.x);
  const simBox = h('section', { class: 'hr-d-sim', 'aria-label': 'Benzer DOG’luk' },
    h('h2', { class: 'h3' }, 'Benzer DOG’luk'),
    h('div', { class: 'hr-sim-list' }, similar.map((x) => {
      const t = tierOf(x.dogRate);
      return h('a', { class: `hr-sim hr-a-${x.attr}`, href: `#kahramanlar--${x.id}` },
        crestSvg(x, { cls: 'hr-crest-md' }),
        h('span', { class: 'hr-sim-text' },
          h('strong', null, x.name),
          h('span', { class: 'xsmall muted' }, `%${x.dogRate} · ${t.label}`),
        ),
        icon('arrowRight', { size: 16 }),
      );
    })),
  );

  // ---------------------------------------------------------------- yorumlar
  const cmtHost = h('section', { class: 'hr-d-comments panel' });

  host.append(
    h('div', { class: 'hr-detail' },
      nav,
      h('div', { class: 'hr-d-top' }, band, live),
      cardsGrid,
      h('div', { class: 'hr-d-bottom' }, archBox, simBox),
      cmtHost,
    ),
  );
  cleanups.push(mountComments(cmtHost, { threadId: 'hero:' + hero.id, title: 'Bu kahraman hakkında topluluk yorumları', placeholder: `${hero.name} oyuncuları hakkında ne düşünüyorsun? (Kahramanlar masumdur.)` }));

  // Klavye: ← → önceki/sonraki
  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (document.querySelector('.modal-backdrop')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); env.openHero(prev.id); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); env.openHero(next.id); }
  };
  window.addEventListener('keydown', onKey);
  cleanups.push(() => window.removeEventListener('keydown', onKey));

  document.title = `${hero.name} · Kahraman DOG Endeksi · DOG DOG DOG Üssü`;

  return {
    destroy() {
      for (const c of cleanups) { try { c(); } catch (e) { console.error(e); } }
      document.title = 'Kahraman DOG Endeksi · DOG DOG DOG Üssü';
      clear(host);
    },
  };
}
