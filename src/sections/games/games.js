// Mini Oyunlar merkezi (#oyunlar) — Oyun Salonu. Günün meydan okuması (DOGdle), kategori süzgeci,
// oyun kartları (1–9 kısayolları), rekor envanteri + Aegis, rozetler, canlı skor tabloları ve sohbet.
// Alt sayfalar (#oyunlar--<id>) aynı bölüm içinde oyunu açar; #oyunlar--rozetler salonu açıp rozetlere kaydırır.
// Belge: docs/oyunlar/salon.md

import './games.css';
import { h, clear, fmtNum, ls, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { store } from '../../core/store.js';
import { sound } from '../../core/sound.js';
import { artUrl } from '../../core/assets.js';
import { NEW_GAME_IDS, BADGES, earnedSet, badgeProgress, badgeHref, ensureBadgeWatcher } from '../../core/badges.js';
import { mountLeaderboard } from '../../components/leaderboard.js';
import { mountComments } from '../../components/comments.js';
import { attachTilt } from '../../components/tilt.js';
import { bestText, compact, isTyping, memeText } from './kit.js';
import * as whack from './whack.js';
import * as lasthit from './lasthit.js';
import * as memory from './memory.js';
import * as rune from './rune.js';
import * as dogdle from './dogdle.js';
import * as portre from './portre.js';
import * as invoker from './invoker.js';
import * as hook from './hook.js';
import * as bingo from './bingo.js';

// Rozet bildirimleri: tekil küresel izleyici (ana sayfa da aynı çağrıyı yapar; ikincisi etkisiz)
ensureBadgeWatcher();

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

const GAMES = [ARENA, whack.meta, lasthit.meta, memory.meta, rune.meta, dogdle.meta, portre.meta, invoker.meta, hook.meta, bingo.meta].filter(Boolean);
const MODS = { dogavi: whack, lasthit, hafiza: memory, rune, dogdle, portre, invoker, hook, bingo };
const byId = (id) => GAMES.find((g) => g.id === id) || null;
const DAILY_ID = 'dogdle';

// ------------------------------------------------------------------ kategoriler
// Oyun modüllerinin meta alanlarına bağımlı kalmamak için kategori tablosu burada; bilinmeyen bir oyun
// gelirse meta.cat (varsa) ya da meta.kind metninden tahmin edilir.
const CATS = [
  { id: 'hepsi', label: 'Tümü', icon: 'grid' },
  { id: 'refleks', label: 'Refleks', icon: 'bolt' },
  { id: 'zihin', label: 'Zihin', icon: 'brain' },
  { id: 'gunluk', label: 'Günlük', icon: 'calendar' },
  { id: 'yayin', label: 'Yayın', icon: 'play' },
];
const CAT_OF = {
  arena: ['refleks'],
  dogavi: ['refleks'],
  lasthit: ['refleks'],
  rune: ['refleks'],
  invoker: ['refleks'],
  hook: ['refleks'],
  hafiza: ['zihin'],
  portre: ['zihin'],
  dogdle: ['gunluk', 'zihin'],
  bingo: ['yayin'],
};
function catsOf(meta) {
  if (CAT_OF[meta.id]) return CAT_OF[meta.id];
  const own = meta.cat || meta.cats;
  if (own) return (Array.isArray(own) ? own : [own]).filter((c) => CATS.some((x) => x.id === c));
  const k = String(meta.kind || '').toLocaleLowerCase('tr-TR');
  if (/günlük/.test(k)) return ['gunluk'];
  if (/yayın/.test(k)) return ['yayin'];
  if (/zihin|hafıza|tahmin|bilgi/.test(k)) return ['zihin'];
  return ['refleks'];
}
const inCat = (meta, cat) => cat === 'hepsi' || catsOf(meta).includes(cat);

// Türkçe sayı adı (1–20): "On mini oyun"
const SAYI = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz', 'on', 'on bir', 'on iki', 'on üç', 'on dört', 'on beş', 'on altı', 'on yedi', 'on sekiz', 'on dokuz', 'yirmi'];
const sayi = (n) => SAYI[n] || String(n);
const cap = (s) => s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1);

/** Envanter yuvasındaki kısa "şarj" yazısı: kısa birimler (ms) sayıya eklenir. */
function chargeText(meta, v) {
  if (typeof meta.charge === 'function') {
    try { return String(meta.charge(v)); } catch { /* varsayılana düş */ }
  }
  const u = String(meta.unit || '');
  return u && u.length <= 2 ? `${compact(v)}${u}` : compact(v);
}

// ------------------------------------------------------------------ günlük sayaç (İstanbul, UTC+3)
const DAY = 86400000;
export function msToIstanbulMidnight(now = Date.now()) {
  const t = now + 3 * 3600000;
  return DAY - (((t % DAY) + DAY) % DAY);
}
export function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
/**
 * Bugünkü DOGdle durumu: { done, won, guesses }. dogdle.js `todayStatus()` dışa aktarır (tercih edilen yol).
 * Yedek: DOGdle'ın yerel kaydı (csk:dogdle:day = { n, guesses, solved }, n = bulmaca numarası) ancak
 * modül `puzzleNumber()` verirse karşılaştırılabilir; ikisi de yoksa durum gösterilmez.
 */
function dailyStatus() {
  const m = MODS[DAILY_ID];
  if (!m) return null;
  if (typeof m.todayStatus === 'function') {
    try { return m.todayStatus() || null; } catch { return null; }
  }
  if (typeof m.puzzleNumber !== 'function') return null;
  let n = null;
  try { n = m.puzzleNumber(); } catch { return null; }
  const d = ls.get('dogdle:day', null);
  if (!d || typeof d !== 'object' || d.n !== n) return { done: false, guesses: 0 };
  const guesses = Array.isArray(d.guesses) ? d.guesses.length : 0;
  return d.solved ? { done: true, won: true, guesses } : { done: false, guesses };
}
function puzzleLabel() {
  const m = MODS[DAILY_ID];
  if (!m || typeof m.puzzleNumber !== 'function') return '';
  try { const n = m.puzzleNumber(); return Number.isFinite(n) ? `#${n}` : ''; } catch { return ''; }
}

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
  const bestEls = []; // [{ meta, el, kind }]
  const cardEls = []; // [{ meta, el, key }]  (Arena hariç, görünür sıraya göre 1–9)
  let featureEl = null;
  let badgesEl = null;
  let current = null; // { id, cleanup }
  let token = 0;
  let hubScroll = 0;
  let cat = CATS.some((c) => c.id === ls.get('gm-cat', 'hepsi')) ? ls.get('gm-cat', 'hepsi') : 'hepsi';

  const nav = {
    list: GAMES,
    open: (id) => open(id),
    back: () => open(null),
  };

  // ------------------------------------------------------------ merkez
  buildHub();
  cleanups.push(store.me.subscribe(refreshBest));

  function bestNode(meta, cls = '') {
    const s = h('strong', { class: `num ${cls}` }, bestText(meta));
    bestEls.push({ meta, el: s, kind: 'text' });
    return s;
  }

  function refreshBest() {
    const scores = store.me.get().scores || {};
    const N = GAMES.length;
    for (const b of bestEls) {
      const v = b.meta ? scores[b.meta.id] : null;
      const has = typeof v === 'number';
      if (b.kind === 'text') {
        b.el.textContent = has ? b.meta.format(v) : 'henüz yok';
        b.el.classList.toggle('dim', !has);
      } else if (b.kind === 'slot') {
        b.el.classList.toggle('is-empty', !has);
        b.charge.textContent = has ? chargeText(b.meta, v) : '';
        b.el.title = `${b.meta.name}: ${has ? b.meta.format(v) : 'henüz oynamadın'}`;
      } else if (b.kind === 'aegis') {
        const n = GAMES.filter((g) => typeof scores[g.id] === 'number').length;
        b.el.classList.toggle('is-empty', n < N);
        b.charge.textContent = `${n}/${N}`;
        b.foot.textContent = n === N
          ? `${cap(sayi(N))} oyunda da rekorun var. Aegis senin.`
          : n === 0
            ? 'Henüz rekor yok. Bir oyun seç, envanteri doldur.'
            : `${n}/${N} oyunda rekorun var. Aegis için ${N - n === 1 ? 'son oyunu' : `kalan ${sayi(N - n)} oyunu`} da dene.`;
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
    const d = Math.max(1, Math.min(3, Number(n) || 1));
    return h('span', { class: 'gm-diff', title: `Zorluk ${d}/3`, 'aria-label': `Zorluk ${d}/3` },
      [1, 2, 3].map((i) => h('i', { class: i <= d ? 'on' : '' })),
    );
  }

  function newBadge() {
    return h('span', { class: 'gm-new', title: 'Salona yeni geldi' }, 'Yeni');
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
          h('span', { class: 'kbd', title: 'Kısayol: R' }, 'R'),
          h('span', { class: 'badge gold' }, '3D'),
        ),
        h('h2', { class: 'gm-feature-name' }, '1vDO', h('em', null, 'Q'), 'UZ', h('br'), 'ARENA'),
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
    cleanups.push(attachTilt(a, { max: 3, scale: 1.005 }));
    return a;
  }

  function gameCard(meta) {
    const key = h('span', { class: 'kbd gm-card-key' });
    const isNew = NEW_GAME_IDS.includes(meta.id);
    const a = h('a', { class: `gm-card${isNew ? ' is-new' : ''}`, href: `#oyunlar--${meta.id}`, style: { '--gc': meta.color || 'var(--ember)' } },
      h('div', { class: 'gm-card-top' },
        h('span', { class: 'gm-slot', 'aria-hidden': 'true' }, icon(meta.icon, { size: 28 })),
        h('div', { class: 'gm-card-titles' },
          h('span', { class: 'gm-card-kind' }, meta.kind || ''),
          h('h2', { class: 'gm-card-name' }, memeText(meta.name)),
        ),
        h('span', { class: 'gm-card-flags' }, isNew ? newBadge() : null, key),
      ),
      h('p', { class: 'gm-card-desc' }, meta.blurb || ''),
      meta.lore ? h('p', { class: 'gm-card-lore' }, meta.lore) : null,
      h('div', { class: 'gm-card-meta' },
        meta.time ? h('span', { class: 'badge' }, icon('hourglass', { size: 12 }), meta.time) : null,
        diffPips(meta.diff),
      ),
      h('div', { class: 'gm-card-foot' },
        h('span', { class: 'gm-card-best' }, 'En iyin: ', bestNode(meta)),
        h('span', { class: 'gm-card-go' }, 'Oyna', icon('arrowRight', { size: 16 })),
      ),
    );
    linkTo(meta, a);
    cleanups.push(attachTilt(a, { max: 5 }));
    cardEls.push({ meta, el: a, key });
    return a;
  }

  // ---------- rekor envanteri
  function inventory() {
    const N = GAMES.length;
    const cols = 4;
    const rest = N % cols;
    const slots = GAMES.map((meta) => {
      const charge = h('span', { class: 'gm-inv-charge num' });
      const b = h('a', { class: 'gm-inv-slot is-empty', href: `#oyunlar--${meta.id}`, style: { '--gc': meta.color || 'var(--ember)' }, 'aria-label': `${meta.name} rekorun` },
        icon(meta.icon, { size: 22 }),
        charge,
      );
      bestEls.push({ meta, el: b, charge, kind: 'slot' });
      return linkTo(meta, b);
    });
    const aegisCharge = h('span', { class: 'gm-inv-charge num' });
    const aegis = h('span', {
      class: 'gm-inv-slot gm-inv-aegis is-empty',
      title: `Salon Aegis’i: ${sayi(N)} oyunun hepsinde rekor`,
      style: { '--gc': 'var(--aegis)', '--span': String(rest ? cols - rest : cols), '--span-m': String(((6 - (N % 6)) % 6) || 6) },
    }, icon('shield', { size: 22 }), h('span', { class: 'gm-inv-aegis-label' }, 'Aegis'), aegisCharge);
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

  // ---------- günün meydan okuması (DOGdle)
  function dailyCard() {
    const meta = byId(DAILY_ID);
    if (!meta) return null;
    const clock = h('span', { class: 'gm-daily-clock num', 'aria-hidden': 'true' }, fmtCountdown(msToIstanbulMidnight()));
    const clockSr = h('span', { class: 'sr-only' });
    const status = h('span', { class: 'gm-daily-status' });
    const best = bestNode(meta);
    const ctaText = h('span', null, 'Bugünün kahramanı');
    const cta = h('span', { class: 'btn gold gm-daily-cta', 'aria-hidden': 'true' }, icon('search', { size: 16 }), ctaText);
    const num = puzzleLabel();
    const a = h('a', { class: 'gm-daily', href: `#oyunlar--${meta.id}`, style: { '--gc': meta.color || 'var(--aegis-2)' }, 'aria-label': `Günün meydan okuması: ${meta.name}` },
      h('span', { class: 'gm-daily-slot', 'aria-hidden': 'true' }, icon(meta.icon, { size: 30, stroke: 1.9 })),
      h('span', { class: 'gm-daily-body' },
        h('span', { class: 'gm-daily-eyebrow' }, icon('calendar', { size: 13 }), 'Günün meydan okuması', NEW_GAME_IDS.includes(meta.id) ? newBadge() : null),
        h('span', { class: 'gm-daily-title' }, memeText(meta.name), num ? h('span', { class: 'gm-daily-num num' }, num) : null),
        h('span', { class: 'gm-daily-desc' }, meta.blurb || 'Her gün yeni bir gizli kahraman.'),
        h('span', { class: 'gm-daily-row' },
          h('span', { class: 'gm-daily-timer', title: 'İstanbul saatiyle gece yarısı yeni kahraman' }, icon('hourglass', { size: 14 }), 'Yeni kahraman ', clock, clockSr),
          status,
          h('span', { class: 'gm-daily-best' }, 'En iyin: ', best),
        ),
      ),
      cta,
    );
    linkTo(meta, a);
    let lastMin = -1;
    const tick = () => {
      if (hub.hidden) return;
      const ms = msToIstanbulMidnight();
      clock.textContent = fmtCountdown(ms);
      const min = Math.floor(ms / 60000);
      if (min !== lastMin) {
        lastMin = min;
        const hh = Math.floor(min / 60);
        clockSr.textContent = `${hh} saat ${min % 60} dakika sonra`;
        const st = dailyStatus();
        status.hidden = !st;
        if (st) {
          status.className = `gm-daily-status ${st.done ? (st.won === false ? 'lost' : 'done') : 'todo'}`;
          status.textContent = st.done
            ? (st.won === false ? 'Bugünkü tur bitti' : `Bugün çözüldü${st.guesses ? ` · ${st.guesses} tahmin` : ''}`)
            : st.guesses ? `${st.guesses} tahmin yaptın, devam et` : 'Bugün çözülmedi';
          if (st.streak > 1) status.textContent += ` · ${st.streak} gün seri`;
          a.classList.toggle('is-done', !!st.done);
          ctaText.textContent = st.done ? 'Sonucuna bak' : st.guesses ? 'Devam et' : 'Bugünün kahramanı';
        }
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    cleanups.push(() => clearInterval(iv));
    return a;
  }

  // ---------- kategori süzgeci + kısayol ipucu
  function toolbar() {
    const chips = CATS.map((c) => {
      const n = GAMES.filter((g) => inCat(g, c.id)).length;
      if (c.id !== 'hepsi' && n === 0) return null;
      const b = h('button', { class: 'chip gm-cat', type: 'button', 'aria-pressed': String(c.id === cat), dataset: { cat: c.id } },
        icon(c.icon, { size: 14 }), c.label, h('span', { class: 'gm-cat-n num' }, String(n)));
      b.addEventListener('click', () => { sound.click(); setCat(c.id); });
      return b;
    }).filter(Boolean);
    const group = h('div', { class: 'gm-cats', role: 'group', 'aria-label': 'Oyun kategorisi' }, chips);
    const hint = h('p', { class: 'gm-keyhint xsmall dim' },
      h('span', { class: 'kbd' }, '1'), '–', h('span', { class: 'kbd' }, '9'), ' kartları sırayla açar · ',
      h('span', { class: 'kbd' }, 'R'), ' Arena · ', h('span', { class: 'kbd' }, 'W'), ' salon');
    return h('div', { class: 'gm-toolbar' }, group, hint);
  }

  function setCat(id) {
    cat = id;
    ls.set('gm-cat', id);
    for (const b of hub.querySelectorAll('.gm-cat')) b.setAttribute('aria-pressed', String(b.dataset.cat === id));
    applyFilter();
  }

  function applyFilter() {
    if (featureEl) featureEl.hidden = !inCat(ARENA, cat);
    let n = 0;
    for (const c of cardEls) {
      const show = inCat(c.meta, cat);
      c.el.hidden = !show;
      if (show) n++;
      const k = show && n <= 9 ? String(n) : '';
      c.key.textContent = k;
      c.key.hidden = !k;
      c.key.title = k ? `Kısayol: ${k}` : '';
      c.el.setAttribute('aria-keyshortcuts', k || '');
      if (!k) c.el.removeAttribute('aria-keyshortcuts');
    }
    const empty = hub.querySelector('.gm-grid-empty');
    if (empty) empty.hidden = n > 0 || (featureEl && !featureEl.hidden);
  }

  function visibleCards() {
    return cardEls.filter((c) => !c.el.hidden);
  }

  // ---------- rozetler
  function badgesPanel() {
    const grid = h('div', { class: 'gm-bdg-grid collapsed' });
    const count = h('span', { class: 'gm-bdg-count num' });
    const meter = h('span', { class: 'gm-bdg-meter', 'aria-hidden': 'true' }, h('span'));
    const more = h('button', { class: 'btn ghost sm gm-bdg-more', type: 'button', 'aria-expanded': 'false' });
    more.addEventListener('click', () => {
      sound.click();
      const open = grid.classList.toggle('collapsed') === false;
      more.setAttribute('aria-expanded', String(open));
      paint();
    });
    const LIMIT = 6; // dar ekranda katlanmış görünümde gösterilen

    function tile(b, on, me) {
      const prog = on ? null : badgeProgress(b, me);
      const href = badgeHref(b);
      const gameId = b.game && byId(b.game) ? b.game : null;
      const node = h('a', {
        class: `gm-bdg${on ? ' on' : ''}`,
        href,
        style: { '--bc': b.color },
        'aria-label': `${b.name}: ${on ? 'kazanıldı' : 'kilitli'}. ${b.how}`,
      },
        h('span', { class: 'gm-bdg-ico', 'aria-hidden': 'true' },
          icon(b.icon, { size: 22, stroke: 1.9 }),
          on ? null : h('span', { class: 'gm-bdg-lock' }, icon('lock', { size: 11, stroke: 2.2 })),
        ),
        h('span', { class: 'gm-bdg-text' },
          h('span', { class: 'gm-bdg-name' }, memeText(b.name)),
          h('span', { class: 'gm-bdg-how' }, b.how),
          on
            ? h('span', { class: 'gm-bdg-state' }, icon('check', { size: 12, stroke: 2.4 }), 'Kazanıldı')
            : prog
              ? h('span', { class: 'gm-bdg-prog' },
                prog.pct != null ? h('span', { class: 'gm-bdg-bar', 'aria-hidden': 'true' }, h('span', { style: { transform: `scaleX(${prog.pct})` } })) : null,
                h('span', { class: 'gm-bdg-prog-t' }, prog.text))
              : null,
        ),
      );
      if (gameId) {
        node.addEventListener('click', (e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
          e.preventDefault();
          sound.click();
          open(gameId);
        });
      }
      return node;
    }

    let lastKey = '';
    function paint() {
      const me = store.me.get();
      const got = earnedSet(me);
      const key = [...got].join(',') + '|' + JSON.stringify(me.scores || {}) + '|' + (me.dog || 0) + '|' + grid.classList.contains('collapsed');
      if (key === lastKey) return;
      lastKey = key;
      // Kazanılanlar önce (katlanmış görünümde en anlamlı altı), sonra tablo sırası
      const list = [...BADGES.filter((b) => got.has(b.id)), ...BADGES.filter((b) => !got.has(b.id))];
      grid.replaceChildren(...list.map((b, i) => {
        const t = tile(b, got.has(b.id), me);
        if (i >= LIMIT) t.classList.add('gm-bdg-extra');
        return t;
      }));
      count.textContent = `${got.size}/${BADGES.length}`;
      meter.firstChild.style.transform = `scaleX(${got.size / BADGES.length})`;
      const collapsed = grid.classList.contains('collapsed');
      more.replaceChildren(collapsed ? `Tümünü göster (${BADGES.length})` : 'Daha az göster');
    }
    paint();
    cleanups.push(store.me.subscribe(paint));

    badgesEl = h('section', { class: 'panel gm-badges', id: 'gm-rozetler', 'aria-labelledby': 'gm-bdg-title', tabindex: '-1' },
      h('div', { class: 'gm-bdg-head' },
        h('div', { class: 'gm-block-head' },
          h('span', { class: 'eyebrow' }, 'Başarımlar'),
          h('h2', { class: 'h2', id: 'gm-bdg-title' }, 'Rozetler'),
        ),
        h('div', { class: 'gm-bdg-sum' },
          h('span', { class: 'gm-bdg-sum-top' }, icon('medal', { size: 18 }), count, h('span', { class: 'dim' }, 'rozet')),
          meter,
        ),
      ),
      h('p', { class: 'small muted gm-bdg-lead' }, 'Oyunlar, quizler ve DOG düğmesi rozet kazandırır. Kilitli rozetin üstünde ne yapman gerektiği yazar; yeni bir rozet açılınca haber veririz.'),
      grid,
      more,
    );
    return badgesEl;
  }

  // ---------- skor tabloları
  function boards() {
    const saved = ls.get('gm-lb-tab', 'dogavi');
    let sel = byId(saved) ? saved : 'dogavi';
    let unLb = null;
    const host = h('div', { class: 'gm-boards-host', role: 'tabpanel', id: 'gm-lb-panel' });
    const tabs = h('div', { class: 'tabs gm-boards-tabs', role: 'tablist', 'aria-label': 'Skor tabloları' });
    const arrow = (dir) => {
      const b = h('button', { class: `gm-boards-arrow ${dir < 0 ? 'prev' : 'next'}`, type: 'button', tabindex: '-1', 'aria-hidden': 'true', title: dir < 0 ? 'Önceki sekmeler' : 'Sonraki sekmeler' },
        icon(dir < 0 ? 'arrowLeft' : 'arrowRight', { size: 16 }));
      b.addEventListener('click', () => {
        const by = Math.max(120, tabs.clientWidth * 0.7) * dir;
        try { tabs.scrollBy({ left: by, behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); } catch { tabs.scrollLeft += by; }
      });
      return b;
    };
    const strip = h('div', { class: 'gm-boards-strip' }, arrow(-1), tabs, arrow(1));
    const btns = GAMES.map((m) => {
      const b = h('button', {
        class: 'tab', type: 'button', role: 'tab', id: `gm-lb-tab-${m.id}`,
        'aria-controls': 'gm-lb-panel', 'aria-selected': String(m.id === sel), tabindex: m.id === sel ? '0' : '-1',
        style: { '--gc': m.color || 'var(--ember)' },
      }, icon(m.icon, { size: 14 }), h('span', null, m.short || m.name));
      b.addEventListener('click', () => select(m.id, true));
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
        e.preventDefault();
        const i = GAMES.findIndex((g) => g.id === sel);
        const j = e.key === 'Home' ? 0 : e.key === 'End' ? GAMES.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + GAMES.length) % GAMES.length;
        select(GAMES[j].id, true);
        btns[j].focus({ preventScroll: true });
      });
      tabs.appendChild(b);
      return b;
    });
    // Sekme şeridi sayfayı değil kendini kaydırır; kenarlarda kaydırılabilirlik gölgesi
    const edges = () => {
      const max = tabs.scrollWidth - tabs.clientWidth;
      strip.classList.toggle('can-left', tabs.scrollLeft > 2);
      strip.classList.toggle('can-right', tabs.scrollLeft < max - 2);
    };
    tabs.addEventListener('scroll', edges, { passive: true });
    let ro = null;
    try { ro = new ResizeObserver(edges); ro.observe(tabs); } catch { /* yok say */ }
    cleanups.push(() => ro && ro.disconnect());
    function reveal(b, smooth) {
      const left = b.offsetLeft - (tabs.clientWidth - b.offsetWidth) / 2;
      try { tabs.scrollTo({ left: Math.max(0, left), behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' }); } catch { tabs.scrollLeft = Math.max(0, left); }
    }
    function select(id, user) {
      sel = id;
      if (user) { ls.set('gm-lb-tab', id); sound.click(); }
      btns.forEach((b, i) => {
        const on = GAMES[i].id === id;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        if (on) reveal(b, user);
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
      edges();
    }
    select(sel, false);
    requestAnimationFrame(() => { const b = btns.find((x) => x.getAttribute('aria-selected') === 'true'); if (b) reveal(b, false); edges(); });
    cleanups.push(() => unLb && unLb());
    return h('section', { class: 'panel gm-boards', 'aria-labelledby': 'gm-boards-title' },
      h('div', { class: 'gm-block-head' },
        h('span', { class: 'eyebrow' }, 'Canlı'),
        h('h2', { class: 'h2', id: 'gm-boards-title' }, 'Salon tablosu'),
      ),
      strip,
      host,
    );
  }

  function buildHub() {
    const N = GAMES.length;
    const head = h('header', { class: 'gm-head' },
      h('div', { class: 'section-head gm-head-text' },
        h('span', { class: 'eyebrow' }, 'W · Mini Oyunlar'),
        h('h1', { class: 'h1' }, 'Oyun ', h('em', null, 'Salonu')),
        h('p', { class: 'lead' }, `${cap(sayi(N))} mini oyun, tek görev: DOG’ları ayıkla, carry’ni koru, `, h('span', { class: 'meme' }, '1vDOQUZ'), ' ol. En iyi skorların profiline yazılır, salonun tablosunda parlar.'),
        dailyCard(),
      ),
      inventory(),
    );

    featureEl = featureCard();
    const grid = h('div', { class: 'gm-grid' },
      featureEl,
      GAMES.slice(1).map((m) => gameCard(m)),
      h('p', { class: 'empty gm-grid-empty', hidden: true }, 'Bu kategoride oyun yok. Başka bir kategori seç.'),
    );

    const chatHost = h('div');
    const lower = h('div', { class: 'gm-lower' },
      boards(),
      h('section', { class: 'panel gm-chat' }, chatHost),
    );
    hub.append(head, h('div', { class: 'gm-games' }, toolbar(), grid), badgesPanel(), lower);
    cleanups.push(mountComments(chatHost, { threadId: 'games', title: 'Oyun Salonu Sohbeti', placeholder: 'Skorunla övün ya da DOG’ları ifşa et…' }));
    applyFilter();
    refreshBest();
  }

  // Merkezde 1–9 tuşları görünür sıradaki oyunları açar (R zaten kabukta Arena'ya gider)
  function onHubKey(e) {
    if (hub.hidden || e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
    if (document.querySelector('.modal-backdrop')) return;
    if (!/^[1-9]$/.test(e.key)) return;
    const c = visibleCards()[Number(e.key) - 1];
    if (!c) return;
    e.preventDefault();
    sound.click();
    open(c.meta.id);
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
        h('span', { 'aria-current': 'page' }, memeText(meta.name)),
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
    // İçerik değişirken yumuşak kaydırma (html{scroll-behavior:smooth}) yerine anında atla
    try { window.scrollTo({ top: Math.max(0, y), behavior: 'instant' }); } catch { window.scrollTo(0, Math.max(0, y)); }
  }

  function scrollToBadges() {
    requestAnimationFrame(() => {
      if (hub.hidden || !badgesEl) return;
      scrollToY(badgesEl.getBoundingClientRect().top + window.scrollY - hudOffset());
      try { badgesEl.focus({ preventScroll: true }); } catch { /* yok say */ }
    });
  }

  function show(sub) {
    const anchor = sub === 'rozetler';
    const meta = sub && !anchor ? byId(sub) : null;
    if (sub && !meta && !anchor) ctx.setSub(null);
    const id = meta ? meta.id : null;
    if ((current ? current.id : null) === id && (id ? !page.hidden : !hub.hidden)) {
      if (anchor) scrollToBadges();
      return;
    }
    const fromHub = !hub.hidden;
    if (fromHub) hubScroll = window.scrollY;
    closeGame();
    if (!meta) {
      page.hidden = true;
      hub.hidden = false;
      refreshBest();
      document.title = 'Mini Oyunlar · DOG DOG DOG Üssü';
      if (anchor) scrollToBadges();
      else requestAnimationFrame(() => scrollToY(hubScroll));
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

  // İlk açılış: #oyunlar--<id> doğrudan oyuna (ya da #oyunlar--rozetler)
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
