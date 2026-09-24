// DOG Arşivi: kahraman seçim ekranı ızgarası, tür detay sayfası ve karşılaştırma modu.
import { h, clear, fmtNum } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { ALL_TYPES, ARCHETYPES, LEGEND, STAT_LABELS, byId } from '../../data/archetypes.js';
import { portraitEl } from '../../components/portrait.js';
import { attachTilt } from '../../components/tilt.js';
import { mountComments } from '../../components/comments.js';
import { radarSvg } from './radar.js';
import { pawsEl, dogIndex, STAT_KEYS, GOOD_STATS, contrastColor, idx2 } from './util.js';

const TOTAL = ALL_TYPES.length;

// Arketiplerdeki "tipik kahramanlar" → Dota iç adları (npc_dota_hero_<ad>); #kahramanlar--<ad> bağlantısı için.
const HERO_KEYS = {
  'Anti-Mage': 'antimage',
  Alchemist: 'alchemist',
  'Naga Siren': 'naga_siren',
  Medusa: 'medusa',
  Pudge: 'pudge',
  Bloodseeker: 'bloodseeker',
  Huskar: 'huskar',
  Riki: 'riki',
  Invoker: 'invoker',
  Meepo: 'meepo',
  'Arc Warden': 'arc_warden',
  Zeus: 'zuus',
  Silencer: 'silencer',
  "Nature's Prophet": 'furion',
  'Nature’s Prophet': 'furion',
  Bristleback: 'bristleback',
  'Troll Warlord': 'troll_warlord',
  Kunkka: 'kunkka',
  Gyrocopter: 'gyrocopter',
  Sniper: 'sniper',
  'Storm Spirit': 'storm_spirit',
  'Crystal Maiden': 'crystal_maiden',
  Lion: 'lion',
  'Witch Doctor': 'witch_doctor',
  Slark: 'slark',
  'Phantom Assassin': 'phantom_assassin',
  Windranger: 'windrunner',
  'Drow Ranger': 'drow_ranger',
  Mirana: 'mirana',
};
/** Ada göre anahtar; tabloda yoksa küçük harf + alt çizgi yedeği. */
export const heroKey = (name) => HERO_KEYS[name] || String(name).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** "Kahraman DOG Endeksi" bölümüne çağrı kartı. */
export function heroIndexCard(env, { big = false } = {}) {
  const { ctx } = env;
  return h('section', { class: `ch-hx panel raised frame${big ? ' is-big' : ''}`, 'aria-label': 'Kahraman DOG Endeksi' },
    h('span', { class: 'ch-hx-icon', 'aria-hidden': 'true' }, icon('swords', { size: big ? 34 : 28 })),
    h('div', { class: 'stack ch-hx-text' },
      h('span', { class: 'eyebrow' }, big ? 'Kahramanlar taşındı' : 'Ayrı bölüm'),
      h('p', { class: 'h3' }, 'Tüm 127 Dota kahramanının DOG’luk endeksi'),
      h('p', { class: 'small muted' }, big
        ? 'Kahraman listesi büyüdü ve kendi bölümüne taşındı: filtrele, ara, hangi kahramanın hangi DOG türünü beslediğine bak.'
        : 'Hangi kahraman hangi DOG türünü besliyor? Pudge’dan Io’ya hepsi tek listede.'),
    ),
    h('button', { class: 'btn gold', type: 'button', onclick: () => { ctx.sound.click(); ctx.go('kahramanlar'); } },
      'Kahraman DOG Endeksi', icon('arrowRight', { size: 18 })),
  );
}
const orderOf = (arch) => ALL_TYPES.indexOf(arch);

const SORTS = [
  { id: 'arsiv', label: 'Arşiv sırası' },
  { id: 'dog', label: 'DOG seviyesi' },
  { id: 'likes', label: 'En çok DOG’lanan' },
];

function likeCounter(env, key, cls = 'num') {
  const el = h('span', { class: cls }, fmtNum(env.likes.count(key)));
  const unwatch = env.likes.watch(() => { el.textContent = fmtNum(env.likes.count(key)); });
  return { el, unwatch };
}

// ================================================================ Izgara
export function renderArchive(el, env) {
  const { ctx } = env;
  const cleanups = [];

  const sortChips = SORTS.map((so) => {
    const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(env.state.archiveSort === so.id) }, so.label);
    b.addEventListener('click', () => {
      env.state.archiveSort = so.id;
      for (const c of sortChips) c.setAttribute('aria-pressed', String(c === b));
      ctx.sound.click();
      fillGrid();
    });
    return b;
  });

  const head = h('div', { class: 'ch-arc-head' },
    h('div', { class: 'stack ch-arc-intro' },
      h('span', { class: 'eyebrow' }, 'Kahraman seçim ekranı'),
      h('h2', { class: 'h2' }, 'On köpek, bir efsane. Seçimini yap.'),
      h('p', { class: 'muted' }, 'Bir türe dokun: radarı, saha notları, karşı hamlesi ve yorumları açılır. Tanıdık gelen varsa, bu tesadüf değil.'),
    ),
    h('div', { class: 'ch-arc-actions' },
      h('a', { class: 'btn ghost', href: '#karakterler--vs' }, icon('swords', { size: 18 }), 'Karşılaştır'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => ctx.go('quizler', 'hangidog') }, icon('quiz', { size: 18 }), 'Hangi DOG’sun?'),
    ),
  );

  const toolbar = h('div', { class: 'row ch-arc-sort', role: 'group', 'aria-label': 'Sıralama' },
    h('span', { class: 'xsmall dim ch-lore-label' }, 'Sırala'),
    sortChips,
  );

  const grid = h('div', { class: 'ch-grid' });
  const tiltOff = [];

  function card(arch) {
    const i = orderOf(arch);
    const likes = likeCounter(env, 'ar:' + arch.id);
    cleanups.push(likes.unwatch);
    const inner = h('div', { class: 'ch-card-in' },
      h('div', { class: 'ch-card-art' },
        portraitEl(arch, { alt: '' }),
        h('span', { class: 'ch-card-idx num' }, idx2(i)),
        pawsEl(arch, { size: 13 }),
      ),
      h('div', { class: 'ch-card-body' },
        h('h3', { class: 'ch-card-name' }, arch.name),
        h('p', { class: 'ch-card-title' }, arch.title),
        h('p', { class: 'ch-card-tag' }, arch.tagline),
      ),
      h('div', { class: 'ch-card-foot' },
        h('span', { class: 'ch-card-likes', title: 'Bu türe verilen DOG’lar' }, icon('paw', { size: 14 }), likes.el),
        h('span', { class: 'ch-card-go' }, 'İncele', icon('arrowRight', { size: 14 })),
      ),
    );
    const a = h('a', {
      class: 'ch-card',
      href: '#karakterler--' + arch.id,
      style: { '--ch-c': arch.color },
      'aria-label': `${arch.name} — ${arch.title}. DOG seviyesi ${arch.dogLevel}/5`,
    }, inner);
    a.addEventListener('pointerenter', () => ctx.sound.hover());
    tiltOff.push(attachTilt(inner, { max: 9, scale: 1.015 }));
    return a;
  }

  function fillGrid() {
    while (tiltOff.length) tiltOff.pop()();
    clear(grid);
    let list = ARCHETYPES.slice();
    if (env.state.archiveSort === 'dog') list.sort((a, b) => b.dogLevel - a.dogLevel || dogIndex(b.stats) - dogIndex(a.stats));
    if (env.state.archiveSort === 'likes') list.sort((a, b) => env.likes.count('ar:' + b.id) - env.likes.count('ar:' + a.id) || orderOf(a) - orderOf(b));
    for (const arch of list) grid.appendChild(card(arch));
  }
  fillGrid();

  // Efsane: gizli karakter bandı
  const lgLikes = likeCounter(env, 'ar:legend');
  cleanups.push(lgLikes.unwatch);
  const legendIn = h('div', { class: 'ch-legend-in' },
    h('div', { class: 'ch-legend-art' }, portraitEl(LEGEND, { alt: '' })),
    h('div', { class: 'ch-legend-body' },
      h('div', { class: 'row ch-legend-tags' },
        h('span', { class: 'eyebrow' }, `Gizli karakter · ${idx2(orderOf(LEGEND))}`),
        h('span', { class: 'badge gold ch-notdog' }, icon('crown', { size: 12 }), 'DOG DEĞİL'),
      ),
      h('h3', { class: 'ch-legend-name' }, LEGEND.name),
      h('p', { class: 'ch-card-title' }, LEGEND.title),
      h('p', { class: 'ch-legend-tag' }, LEGEND.tagline),
      h('div', { class: 'ch-card-foot' },
        pawsEl(LEGEND, { label: true, size: 14 }),
        h('span', { class: 'ch-card-likes' }, icon('paw', { size: 14 }), lgLikes.el),
        h('span', { class: 'ch-card-go' }, 'İncele', icon('arrowRight', { size: 14 })),
      ),
    ),
    h('span', { class: 'stamp gold ch-legend-stamp', 'aria-hidden': 'true' }, '1vDOQUZ'),
  );
  const legend = h('a', {
    class: 'ch-legend',
    href: '#karakterler--legend',
    style: { '--ch-c': LEGEND.color },
    'aria-label': `${LEGEND.name} — ${LEGEND.title}. DOG değil.`,
  }, legendIn);
  const legendTilt = attachTilt(legendIn, { max: 4, scale: 1.005 });

  el.append(head, toolbar, grid, legend, heroIndexCard(env));

  return () => {
    while (tiltOff.length) tiltOff.pop()();
    legendTilt();
    cleanups.forEach((fn) => fn());
  };
}

// ================================================================ Detay
function statBars(arch) {
  return h('div', { class: 'ch-bars' },
    STAT_KEYS.map((k) => {
      const v = Math.round(arch.stats[k] || 0);
      return h('div', { class: 'statbar ch-statbar' },
        h('span', { class: 'ch-statbar-name' }, STAT_LABELS[k], GOOD_STATS.has(k) ? h('span', { class: 'ch-good', title: 'Yüksek değer iyidir' }, ' ↑iyi') : null),
        h('span', { class: 'track', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(v), 'aria-label': STAT_LABELS[k] },
          h('span', { class: 'fill ch-fill', style: { width: v + '%' } }),
        ),
        h('span', { class: 'val' }, String(v)),
      );
    }),
  );
}

/** DOG indeksi + en DOG yanı / tek kurtarıcı yanı. */
function dogSummary(arch) {
  const bad = (k) => (GOOD_STATS.has(k) ? 100 - arch.stats[k] : arch.stats[k]);
  const sorted = STAT_KEYS.slice().sort((a, b) => bad(b) - bad(a));
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];
  const di = dogIndex(arch.stats);
  const isLegend = arch.id === 'legend';
  return h('div', { class: 'ch-dogidx' },
    h('div', { class: 'ch-dogidx-num' },
      h('span', { class: 'num' }, String(di)),
      h('span', { class: 'ch-lore-label' }, 'DOG indeksi'),
    ),
    h('div', { class: 'ch-dogidx-meter' },
      h('span', { class: 'meter' }, h('span', { style: { width: di + '%' } })),
      h('dl', { class: 'ch-dogidx-dl' },
        h('div', null, h('dt', null, isLegend ? 'Zayıf noktası' : 'En DOG yanı'), h('dd', null, `${STAT_LABELS[worst]} · ${arch.stats[worst]}`)),
        h('div', null, h('dt', null, isLegend ? 'Süper gücü' : 'Tek kurtarıcı yanı'), h('dd', null, `${STAT_LABELS[best]} · ${arch.stats[best]}`)),
      ),
    ),
  );
}

function loreSlot(iconName, label, text) {
  return h('div', { class: 'ch-slot' },
    h('span', { class: 'ch-slot-icon', 'aria-hidden': 'true' }, icon(iconName, { size: 24 })),
    h('div', { class: 'ch-slot-body' },
      h('span', { class: 'ch-lore-label' }, label),
      h('p', null, text),
    ),
  );
}

export function renderDetail(el, env, arch) {
  const { ctx } = env;
  const cleanups = [];
  const i = orderOf(arch);
  const prev = ALL_TYPES[(i - 1 + TOTAL) % TOTAL];
  const next = ALL_TYPES[(i + 1) % TOTAL];
  const isLegend = arch.id === 'legend';
  const key = 'ar:' + arch.id;

  const pn = (a, dir) => h('a', { class: `ch-pn is-${dir}`, href: '#karakterler--' + a.id, 'aria-label': `${dir === 'prev' ? 'Önceki' : 'Sonraki'} tür: ${a.name}`, style: { '--ch-c': a.color } },
    dir === 'prev' ? icon('arrowLeft', { size: 16 }) : null,
    h('img', { class: 'ch-pn-img', src: portraitEl(a).src, alt: '', width: '32', height: '32' }),
    h('span', { class: 'ch-pn-text' }, h('span', { class: 'ch-pn-dir' }, dir === 'prev' ? 'Önceki tür' : 'Sonraki tür'), h('span', { class: 'ch-pn-name' }, a.name)),
    dir === 'next' ? icon('arrowRight', { size: 16 }) : null,
  );

  const nav = h('nav', { class: 'ch-det-nav', 'aria-label': 'Tür gezinmesi' },
    h('a', { class: 'btn ghost sm', href: '#karakterler' }, icon('arrowLeft', { size: 16 }), 'Arşiv'),
    h('span', { class: 'spacer' }),
    pn(prev, 'prev'),
    h('span', { class: 'num ch-det-count', 'aria-label': `${i + 1}. tür, toplam ${TOTAL}` }, `${idx2(i)} / ${TOTAL}`),
    pn(next, 'next'),
  );

  // Beğeni
  const likes = likeCounter(env, key, 'num ch-like-n');
  cleanups.push(likes.unwatch);
  const likeBtn = h('button', { class: 'btn ch-like', type: 'button', 'aria-pressed': String(env.likes.mine(key)) },
    icon('paw', { size: 18 }), h('span', null, isLegend ? 'Efsaneye pati bırak' : 'Bu türe DOG’la'), likes.el);
  likeBtn.addEventListener('click', () => {
    const on = env.likes.toggle(key);
    likeBtn.setAttribute('aria-pressed', String(on));
    if (on) {
      ctx.sound.bark(isLegend ? 1.3 : 1);
      const r = likeBtn.getBoundingClientRect();
      ctx.fx.floatText(isLegend ? 'SAYGI!' : 'DOG!', r.left + r.width / 2, r.top, { count: 2 });
    } else {
      ctx.sound.click();
    }
  });
  cleanups.push(env.likes.watch(() => likeBtn.setAttribute('aria-pressed', String(env.likes.mine(key)))));

  const hero = h('section', { class: `ch-det-hero${isLegend ? ' is-legend' : ''}`, style: { '--ch-c': arch.color } },
    h('div', { class: 'ch-det-art frame' },
      portraitEl(arch, { cls: 'ch-det-img' }),
      h('span', { class: 'ch-det-idx num', 'aria-hidden': 'true' }, idx2(i)),
      isLegend ? h('span', { class: 'stamp gold ch-det-stamp', 'aria-hidden': 'true' }, 'DOG DEĞİL') : null,
    ),
    h('div', { class: 'ch-det-intro' },
      h('div', { class: 'row ch-det-tags' },
        h('span', { class: 'eyebrow' }, isLegend ? 'Gizli karakter' : `DOG türü · ${idx2(i)}`),
        isLegend ? h('span', { class: 'badge gold' }, icon('crown', { size: 12 }), 'DOG DEĞİL') : h('span', { class: 'badge ember' }, `DOG indeksi ${dogIndex(arch.stats)}`),
      ),
      h('h2', { class: 'h1 ch-det-name' }, arch.name),
      h('p', { class: 'ch-det-title' }, arch.title),
      pawsEl(arch, { label: true, size: 18 }),
      h('p', { class: 'lead ch-det-desc' }, arch.description),
      h('figure', { class: 'ch-quote' },
        h('span', { class: 'ch-quote-mark', 'aria-hidden': 'true' }, '“'),
        h('blockquote', null, arch.chatQuote),
        h('figcaption', null, isLegend ? '— maç sonu skor tablosundan' : '— all chat, sıradan bir pub maçı'),
      ),
      h('div', { class: 'row ch-det-actions' },
        likeBtn,
        h('a', { class: 'btn ghost', href: `#karakterler--vs-${arch.id}-${(isLegend ? ARCHETYPES[0] : LEGEND).id}` }, icon('swords', { size: 18 }), 'Karşılaştır'),
      ),
    ),
  );

  const stats = h('section', { class: 'ch-det-stats', style: { '--ch-c': arch.color } },
    h('div', { class: 'panel ch-radar-panel' },
      h('div', { class: 'panel-head' }, h('h3', { class: 'h3' }, 'DOG Radarı'), h('span', { class: 'xsmall dim' }, '0 · 50 · 100 ölçeği')),
      radarSvg([{ stats: arch.stats, color: arch.color, label: arch.name }], { title: `${arch.name} radar grafiği` }),
    ),
    h('div', { class: 'panel ch-bars-panel' },
      h('div', { class: 'panel-head' }, h('h3', { class: 'h3' }, 'DOG-metre'), pawsEl(arch, { size: 14 })),
      statBars(arch),
      h('p', { class: 'xsmall dim' }, 'Feed, farm hırsı, tilt ve chat: yüksek = daha DOG. Harita ve takım oyunu: yüksek = iyi.'),
      dogSummary(arch),
    ),
  );

  const lore = h('section', { class: 'ch-det-lore', style: { '--ch-c': arch.color }, 'aria-label': 'Saha notları' },
    loreSlot('eye', 'Habitat', arch.habitat),
    loreSlot('bolt', 'İmza hareket', arch.signature),
    loreSlot('shield', 'Karşı hamle', arch.counter),
  );

  // Tipik kahramanlar: Kahraman DOG Endeksi bölümündeki sayfasına gider (#kahramanlar--<iç ad>)
  const heroChips = arch.heroes.map((name) => {
    const b = h('button', { class: 'chip ch-hero-chip', type: 'button', title: `${name}: DOG’luk endeksini gör` }, name, icon('arrowRight', { size: 12 }));
    b.addEventListener('click', () => {
      ctx.sound.click();
      ctx.go('kahramanlar', heroKey(name));
    });
    return b;
  });

  const lists = h('section', { class: 'ch-det-lists', style: { '--ch-c': arch.color } },
    h('div', { class: 'panel' },
      h('h3', { class: 'h3' }, 'Nasıl anlaşılır'),
      h('ul', { class: 'ch-spot' }, arch.spotting.map((t) => h('li', null, icon('check', { size: 16 }), h('span', null, t)))),
    ),
    h('div', { class: 'panel stack' },
      h('h3', { class: 'h3' }, 'Tipik kahramanlar'),
      h('div', { class: 'row ch-hero-chips' }, heroChips),
      h('p', { class: 'xsmall dim' }, 'Kahramanlar masum; asıl suçlu klavyenin başındaki. Çipe dokun, kahramanın DOG’luk endeksine bak.'),
    ),
  );

  const cta = h('section', { class: 'ch-det-cta panel raised frame' },
    h('div', { class: 'stack' },
      h('span', { class: 'eyebrow' }, 'Aynaya bakma zamanı'),
      h('p', { class: 'h3' }, isLegend ? 'Efsane olduğundan emin misin? Test etmenin tek yolu var.' : `Kendinde biraz ${arch.name} mı hissettin?`),
    ),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', type: 'button', onclick: () => ctx.go('quizler', 'hangidog') }, icon('quiz', { size: 18 }), 'Hangi DOG’sun? testine git'),
      h('a', { class: 'btn ghost', href: '#karakterler--analiz' }, icon('brain', { size: 18 }), 'Kendi analizini çıkar'),
    ),
  );

  const cmtHost = h('section', { class: 'panel ch-det-cmt' });

  el.append(nav, hero, stats, lore, lists, cta, cmtHost);
  cleanups.push(mountComments(cmtHost, { threadId: 'arch:' + arch.id, title: 'Bu DOG hakkında', placeholder: `${arch.name} ile yaşadığın en DOG anı yaz…` }));

  // ← → ile türler arasında gezinme
  const onKey = (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (t && t.getAttribute && t.getAttribute('role') === 'tab') return;
    if (document.querySelector('.modal-backdrop')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); env.navigate(prev.id); }
    if (e.key === 'ArrowRight') { e.preventDefault(); env.navigate(next.id); }
  };
  window.addEventListener('keydown', onKey);
  cleanups.push(() => window.removeEventListener('keydown', onKey));

  return () => cleanups.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
}

// ================================================================ Karşılaştırma
function verdict(a, b) {
  if (a.id === 'legend' || b.id === 'legend') {
    const dog = a.id === 'legend' ? b : a;
    return { text: `Karşılaştırma biraz haksız: efsane DOG değil. ${dog.name} bu eşleşmede ancak taşınan tarafta olabilir.`, winner: null };
  }
  const ia = dogIndex(a.stats);
  const ib = dogIndex(b.stats);
  if (ia === ib) return { text: `Berabere: ikisi de DOG indeksinde ${ia}. Aynı takımda denk gelirlerse Allah yardımcın olsun.`, winner: null };
  const w = ia > ib ? a : b;
  const l = ia > ib ? b : a;
  const gap = Math.abs(ia - ib);
  const tone = gap >= 20 ? 'farkı açık ara' : gap >= 8 ? 'fark belirgin' : 'kıl payı';
  return { text: `Daha DOG olan: ${w.name} (${Math.max(ia, ib)} – ${Math.min(ia, ib)}, ${tone}). ${l.name} en azından bir şeyleri doğru yapıyor.`, winner: w.id };
}

export function renderCompare(el, env, aId, bId) {
  const { ctx } = env;
  let a = byId(aId) || ARCHETYPES[0];
  let b = byId(bId) || ARCHETYPES[1];
  if (a.id === b.id) b = ALL_TYPES[(orderOf(a) + 1) % TOTAL];

  const mkSelect = (id, val) => h('select', { class: 'select', id },
    ALL_TYPES.map((t) => h('option', { value: t.id, selected: t.id === val }, t.name)),
  );
  const selA = mkSelect('ch-vs-a', a.id);
  const selB = mkSelect('ch-vs-b', b.id);
  const pickA = h('div', { class: 'ch-vs-pick is-a' });
  const pickB = h('div', { class: 'ch-vs-pick is-b' });
  const swap = h('button', { class: 'btn ghost icon ch-vs-swap', type: 'button', 'aria-label': 'Türlerin yerini değiştir', title: 'Yer değiştir' }, icon('refresh', { size: 18 }));
  const result = h('div', { class: 'ch-vs-result' });

  function pickCard(host, t, sel, side, color) {
    clear(host);
    host.style.setProperty('--ch-c', color);
    host.append(
      h('div', { class: 'ch-vs-pick-art' }, portraitEl(t, { alt: '' }), h('span', { class: 'ch-vs-side num' }, side)),
      h('div', { class: 'field' }, h('label', { for: sel.id }, side === 'A' ? '1. tür' : '2. tür'), sel),
      h('p', { class: 'ch-card-title' }, t.title),
      pawsEl(t, { label: true }),
    );
  }

  function render() {
    const colA = a.color;
    const colB = contrastColor(a.color, b.color);
    pickCard(pickA, a, selA, 'A', colA);
    pickCard(pickB, b, selB, 'B', colB);
    clear(result);

    const legend = h('div', { class: 'row ch-vs-legend' },
      h('span', { class: 'ch-swatch', style: { '--ch-c': colA } }, a.name),
      h('span', { class: 'ch-swatch is-dashed', style: { '--ch-c': colB } }, b.name),
    );

    const rows = STAT_KEYS.map((k) => {
      const va = Math.round(a.stats[k] || 0);
      const vb = Math.round(b.stats[k] || 0);
      const d = va - vb;
      const good = GOOD_STATS.has(k);
      let note = 'eşit';
      let who = '';
      if (d !== 0) {
        const higher = d > 0 ? 'A' : 'B';
        who = higher;
        note = `${higher} +${Math.abs(d)}`;
      }
      return h('div', { class: 'ch-diff-row' },
        h('div', { class: 'ch-diff-side is-a', style: { '--ch-c': colA } },
          h('span', { class: 'num ch-diff-v' }, String(va)),
          h('span', { class: 'ch-diff-track' }, h('span', { class: 'ch-diff-fill', style: { width: va + '%' } })),
        ),
        h('div', { class: 'ch-diff-mid' },
          h('span', { class: 'ch-diff-name' }, STAT_LABELS[k]),
          h('span', { class: `ch-diff-d num${who ? ' is-' + who.toLowerCase() : ''}`, style: who ? { '--ch-c': who === 'A' ? colA : colB } : null, title: good ? 'Yüksek değer iyidir' : 'Yüksek değer daha DOG' }, note, good ? ' ↑iyi' : ''),
        ),
        h('div', { class: 'ch-diff-side is-b', style: { '--ch-c': colB } },
          h('span', { class: 'ch-diff-track' }, h('span', { class: 'ch-diff-fill', style: { width: vb + '%' } })),
          h('span', { class: 'num ch-diff-v' }, String(vb)),
        ),
      );
    });

    const v = verdict(a, b);
    result.append(
      h('div', { class: 'ch-vs-grid' },
        h('div', { class: 'panel ch-radar-panel' },
          h('div', { class: 'panel-head' }, h('h3', { class: 'h3' }, 'Üst üste radar'), legend),
          radarSvg(
            [{ stats: a.stats, color: colA, label: a.name }, { stats: b.stats, color: colB, label: b.name }],
            { title: `${a.name} ve ${b.name} karşılaştırma radarı` },
          ),
        ),
        h('div', { class: 'panel stack ch-diff' },
          h('div', { class: 'panel-head' }, h('h3', { class: 'h3' }, 'Stat farkları'), h('span', { class: 'xsmall dim' }, 'A ← → B')),
          rows,
          h('div', { class: 'ch-verdict', style: { '--ch-c': v.winner === a.id ? colA : v.winner === b.id ? colB : 'var(--aegis)' } },
            icon(v.winner ? 'trophy' : 'crown', { size: 20 }),
            h('p', null, v.text),
          ),
          h('div', { class: 'row' },
            h('a', { class: 'btn ghost sm', href: '#karakterler--' + a.id }, `${a.name} sayfası`),
            h('a', { class: 'btn ghost sm', href: '#karakterler--' + b.id }, `${b.name} sayfası`),
          ),
        ),
      ),
    );
  }

  const change = () => {
    a = byId(selA.value) || a;
    b = byId(selB.value) || b;
    if (a.id === b.id) {
      b = ALL_TYPES[(orderOf(a) + 1) % TOTAL];
      selB.value = b.id;
      ctx.fx.toast('Bir türü kendisiyle kıyaslamak ayna karşısında DOG demek olur. Diğerini seçtik.', 'ember');
    }
    env.replace(`vs-${a.id}-${b.id}`);
    ctx.sound.whoosh();
    render();
  };
  selA.addEventListener('change', change);
  selB.addEventListener('change', change);
  swap.addEventListener('click', () => {
    [a, b] = [b, a];
    selA.value = a.id;
    selB.value = b.id;
    env.replace(`vs-${a.id}-${b.id}`);
    ctx.sound.whoosh();
    render();
  });

  el.append(
    h('nav', { class: 'ch-det-nav', 'aria-label': 'Karşılaştırma gezinmesi' },
      h('a', { class: 'btn ghost sm', href: '#karakterler' }, icon('arrowLeft', { size: 16 }), 'Arşiv'),
    ),
    h('div', { class: 'section-head ch-vs-head' },
      h('span', { class: 'eyebrow' }, 'Karşılaştırma modu'),
      h('h2', { class: 'h2' }, 'Hangisi daha ', h('em', null, 'DOG'), '?'),
      h('p', { class: 'muted' }, 'İki tür seç; radarlar üst üste biner, farklar tek tek sayılır. Kazanan kaybeder.'),
    ),
    h('div', { class: 'ch-vs-picks' }, pickA, h('div', { class: 'ch-vs-mid' }, h('span', { class: 'ch-vs-badge', 'aria-hidden': 'true' }, 'VS'), swap), pickB),
    result,
  );
  if (!aId || !bId) env.replace(`vs-${a.id}-${b.id}`);
  render();

  return () => {};
}
