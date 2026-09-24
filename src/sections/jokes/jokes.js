// Espri Duvarı (#espriler) — Efsaneler arşivi, Espri Makinesi, Topluluk Duvarı, Espri Ekle.
// Alt sayfalar: #espriler--efsaneler | --makine | --duvar | --ekle

import './jokes.css';
import { h, clear, ls, fmtNum, hashStr, copyText, cleanText, softFilter, prefersReducedMotion, pick } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { store, agg } from '../../core/store.js';
import { openNickEditor } from '../../core/shell.js';
import { artUrl } from '../../core/assets.js';
import { mountComments } from '../../components/comments.js';
import { JOKES, JOKE_CATEGORIES } from '../../data/jokes.js';
import { generate, countCombos, TEMPLATE_COUNT, POOL_SIZES } from '../../data/jokeEngine.js';
import { jokeCard, jokeBody, paintCounts, catLabel, validCat, CAT_META, fold } from './card.js';

const TABS = [
  { id: 'efsaneler', label: 'Efsaneler', icon: 'crown' },
  { id: 'makine', label: 'Espri Makinesi', icon: 'dice' },
  { id: 'duvar', label: 'Topluluk Duvarı', icon: 'chat' },
  { id: 'ekle', label: 'Espri Ekle', icon: 'plus' },
];
const TAB_IDS = TABS.map((t) => t.id);
const MAX = 280;
const COOLDOWN = 10000;
const TOTAL_COMBOS = countCombos();
const POOL_COUNT = Object.keys(POOL_SIZES).length;

const STARTERS = [
  { id: 'line', label: 'Tek satır', text: '' },
  { id: 'dialog', label: 'Diyalog', text: 'Takım arkadaşı: “…”\nReplay: …\nChat: DOG DOG DOG.' },
  { id: 'dict', label: 'Sözlük', text: 'DOG (isim): ' },
  { id: 'news', label: 'SON DAKİKA', text: 'SON DAKİKA: ' },
  { id: 'report', label: 'Maç raporu', text: 'Maç sonu raporu — Kahraman\nWard: 0\nÖlüm: \nEn büyük katkı: \nNot: DOG DOG DOG' },
];

function searchIcon() {
  return h('svg', { viewBox: '0 0 24 24', width: '18', height: '18', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'aria-hidden': 'true' },
    h('circle', { cx: '10.5', cy: '10.5', r: '6.5' }), h('path', { d: 'M15.5 15.5L21 21' }));
}

function arcPath(a0, a1, r0, r1) {
  const p = (a, r) => [(r * Math.sin((a * Math.PI) / 180)).toFixed(2), (-r * Math.cos((a * Math.PI) / 180)).toFixed(2)];
  const [x0, y0] = p(a0, r1);
  const [x1, y1] = p(a1, r1);
  const [x2, y2] = p(a1, r0);
  const [x3, y3] = p(a0, r0);
  return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
}

/** Çok satırlı metni satır satır temizler (satır sonlarını korur), filtreler. */
function normalizeText(s) {
  const lines = String(s || '').replace(/\r/g, '').split('\n').map((l) => cleanText(l, MAX)).filter(Boolean).slice(0, 10);
  return softFilter(lines.join('\n').slice(0, MAX));
}

let lastPostAt = Number(ls.get('jk:lastPost', 0)) || 0;
// Salt okunur paylaşımda beğeniler yalnızca bu cihazda kalır; bunu oturumda bir kez söyle
let roLikeNoted = false;
function noteReadOnlyLike(fx) {
  if (roLikeNoted || !(store.shared && !store.canWrite())) return;
  roLikeNoted = true;
  fx.toast('Salt okunur görüntüleme: DOG’ların yalnızca bu cihazda sayılır, topluluk sayısına eklenmez.', 'ember');
}

export default {
  mount(el, ctx) {
    const { fx, sound } = ctx;
    const reduced = prefersReducedMotion();
    const cleanups = [];
    const timers = new Set();
    const modals = new Set();
    const jokeOf = new WeakMap();
    let alive = true;
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

    const state = {
      tab: null,
      cat: ls.get('jk:cat', 'all'),
      q: '',
      sort: 'arsiv',
      wallSort: 'yeni',
      fans: [],
      community: [],
      communityLoaded: false,
      communityError: false,
      threadCounts: {},
      highlightId: null,
      glowIds: new Set(),
      machCat: 'all',
      lastGen: null,
      history: [],
      limit: 24,
    };
    if (state.cat !== 'all' && !CAT_META[state.cat]) state.cat = 'all';

    // ------------------------------------------------------------ sayaçlar
    function likeCounts() {
      const me = store.uid();
      const others = state.fans.filter((f) => f.id !== me && f.id !== 'me');
      const m = agg.likeCounts(others);
      const mine = store.me.get().likes || {};
      for (const k in mine) if (mine[k]) m[k] = (m[k] || 0) + 1;
      return m;
    }
    let paintRaf = 0;
    function refreshCounts() {
      if (paintRaf) return;
      paintRaf = requestAnimationFrame(() => {
        paintRaf = 0;
        const counts = likeCounts();
        const mine = store.me.get().likes || {};
        for (const card of document.querySelectorAll('.jk-card[data-like-key], .jk-card[data-thread]')) {
          const k = card.dataset.likeKey;
          const t = card.dataset.thread;
          paintCounts(card, { likes: k ? counts[k] || 0 : 0, liked: !!(k && mine[k]), comments: t ? state.threadCounts[t] || 0 : 0 });
        }
      });
    }

    // ------------------------------------------------------------ gönderme
    async function postJoke({ text, cat, src }) {
      await store.ready;
      if (!store.canWrite()) { fx.toast('Bu sayfayı yalnızca görüntüleyebiliyorsun; espri ekleme izni yok.', 'blood'); return null; }
      const wait = COOLDOWN - (Date.now() - lastPostAt);
      if (wait > 0) { fx.toast(`Biraz yavaş: ${Math.ceil(wait / 1000)} saniye sonra tekrar dene. (10 sn’de bir espri)`, 'blood'); return null; }
      const clean = normalizeText(text);
      if (clean.length < 8) { fx.toast('Biraz daha yaz; bu kadarı ward bile değil.', 'blood'); return null; }
      try {
        const body = { text: clean, cat: validCat(cat) };
        if (src) body.src = src;
        const id = await store.add('jokes', body);
        lastPostAt = Date.now();
        ls.set('jk:lastPost', lastPostAt);
        return id;
      } catch (err) {
        console.error(err);
        fx.toast(err && err.code === 'quota_exceeded' ? 'Veritabanı dolu; yeni espri şu an eklenemiyor.' : 'Espri gönderilemedi. Bağlantını kontrol edip tekrar dene.', 'blood');
        return null;
      }
    }

    function afterPost(id, { jump = true } = {}) {
      state.highlightId = id;
      state.glowIds.add(id);
      later(() => { state.glowIds.delete(id); }, 8000);
      if (jump) selectTab('duvar', true);
    }

    // ------------------------------------------------------------ kart eylemleri
    async function onAction(e) {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const card = btn.closest('.jk-card');
      const joke = card && jokeOf.get(card);
      if (!joke) return;
      const act = btn.dataset.act;
      if (act === 'like') {
        const key = card.dataset.likeKey;
        const on = store.me.toggleLike(key);
        if (on) noteReadOnlyLike(fx);
        if (on) {
          sound.bark(1.15);
          const r = btn.getBoundingClientRect();
          fx.floatText('DOG!', r.left + r.width / 2, r.top, { size: 18 });
          btn.classList.remove('bump');
          void btn.offsetWidth;
          btn.classList.add('bump');
        } else sound.click();
        refreshCounts();
      } else if (act === 'comments') {
        openComments(joke, card.dataset.thread);
      } else if (act === 'copy') {
        const ok = await copyText(joke.text, card.querySelector('.jk-body'));
        fx.toast(ok ? 'Kopyalandı. Chat’e yapıştır: DOG DOG DOG.' : 'Metni seçtim; Ctrl+C ile kopyalayabilirsin.', ok ? 'jade' : undefined);
        if (ok) sound.coin();
      } else if (act === 'post') {
        btn.disabled = true;
        const id = await postJoke({ text: joke.text, cat: joke.cat, src: 'makine' });
        btn.disabled = false;
        if (id) {
          sound.good();
          afterPost(id, { jump: false });
          toastWithLink('Duvara asıldı.', 'Duvarda gör', () => { closeAllModals(); state.highlightId = id; selectTab('duvar', true); });
        }
      } else if (act === 'delete') {
        const ok = await fx.confirm('Bu espri duvardan silinsin mi?', { ok: 'Sil', danger: true });
        if (!ok) return;
        try { await store.remove('jokes', joke.docId); fx.toast('Silindi.'); } catch { fx.toast('Silinemedi.', 'blood'); }
      }
    }

    function toastWithLink(msg, linkLabel, fn) {
      const link = h('button', { class: 'jk-toast-link', type: 'button' }, linkLabel);
      link.addEventListener('click', () => { if (alive) fn(); });
      fx.toast(h('span', null, msg, ' ', link), 'jade', 4200);
    }

    function trackModal(content, label, onClose) {
      let close = null;
      close = fx.modal(content, {
        label,
        onClose: () => { modals.delete(close); if (onClose) onClose(); },
      });
      modals.add(close);
      content.addEventListener('click', onAction);
      return close;
    }
    function closeAllModals() { for (const c of [...modals]) c(); }

    function openComments(joke, threadId) {
      const host = h('div');
      let destroy = null;
      let close = null;
      const box = h('div', { class: 'jk-cmodal' },
        h('div', { class: 'jk-cmodal-head' },
          h('span', { class: 'eyebrow' }, 'Espri yorumları'),
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn ghost sm icon', type: 'button', 'aria-label': 'Kapat', onclick: () => close && close() }, icon('close', { size: 16 })),
        ),
        h('blockquote', { class: 'jk-quote', dataset: { jkcat: validCat(joke.cat) } }, jokeBody(joke.text, { size: 'sm' })),
        host,
      );
      close = trackModal(box, 'Yorumlar', () => destroy && destroy());
      destroy = mountComments(host, { threadId, title: 'Yorumlar', compact: true, placeholder: 'Yorumun… (DOG DOG DOG serbest)' });
    }

    // ------------------------------------------------------------ rastgele DOG
    function genJoke(cat) {
      const g = generate(undefined, { cat: cat === 'all' ? undefined : cat, avoid: state.lastGen && state.lastGen.tpl });
      return { ...g, gen: true };
    }
    function legendCard(j, extra = {}) {
      const card = jokeCard(j, { kind: 'legend', likeKey: 'jk:' + j.id, threadId: 'joke:' + j.id, tagText: '#' + j.id, ...extra });
      jokeOf.set(card, j);
      return card;
    }
    function genCard(j, extra = {}) {
      const card = jokeCard(j, { kind: 'gen', tagText: 'Makine #' + j.seed.toString(36).toUpperCase(), ...extra });
      jokeOf.set(card, j);
      return card;
    }

    function rollRandom() {
      sound.dogdogdog();
      const stage = h('div', { class: 'jk-roll-stage' });
      let close = null;
      const again = h('button', { class: 'btn primary', type: 'button' }, icon('dice', { size: 18 }), 'Bir DOG daha');
      const box = h('div', { class: 'jk-roll' },
        h('div', { class: 'jk-cmodal-head' },
          h('span', { class: 'eyebrow' }, 'Rastgele DOG'),
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn ghost sm icon', type: 'button', 'aria-label': 'Kapat', onclick: () => close && close() }, icon('close', { size: 16 })),
        ),
        stage,
        h('div', { class: 'row jk-roll-foot' },
          h('span', { class: 'xsmall dim' }, 'Arşivden ya da makineden, kader seçer.'),
          h('span', { class: 'spacer' }),
          again,
        ),
      );
      const fill = () => {
        const fromEngine = Math.random() < 0.5;
        const j = fromEngine ? genJoke('all') : pick(JOKES);
        if (fromEngine) state.lastGen = j;
        clear(stage);
        const card = fromEngine ? genCard(j, { size: 'lg', extraClass: 'jk-card--roll' }) : legendCard(j, { size: 'lg', extraClass: 'jk-card--roll' });
        stage.append(
          h('div', { class: `jk-slam${reduced ? ' still' : ''}`, 'aria-hidden': 'true' }, h('span', { class: 'stamp' }, 'DOG DOG DOG')),
          card,
        );
        refreshCounts();
      };
      again.addEventListener('click', () => { sound.dogdogdog(); fill(); });
      fill();
      close = trackModal(box, 'Rastgele DOG');
      if (!reduced) later(() => { sound.stamp(); fx.shake(box); }, 260);
    }

    // ------------------------------------------------------------ başlık
    const communityStat = h('span', { class: 'jk-score-val num' }, '…');
    const comboStat = h('span', { class: 'jk-score-val num' }, fmtNum(TOTAL_COMBOS));

    function buildWheel() {
      const items = [
        ...JOKE_CATEGORIES.map((c) => ({ id: c.id, label: CAT_META[c.id].short, icon: CAT_META[c.id].icon, n: JOKES.filter((j) => j.cat === c.id).length, title: c.label })),
        { id: 'makine', label: 'Makine', icon: 'dice', n: null, title: 'Espri Makinesi' },
      ];
      const N = items.length;
      const svg = h('svg', { class: 'jk-wheel-svg', viewBox: '-100 -100 200 200', 'aria-hidden': 'true' });
      svg.appendChild(h('circle', { class: 'jk-wheel-ring', cx: '0', cy: '0', r: '98' }));
      const segs = items.map((it, i) => {
        const a0 = (i - 0.5) * (360 / N) + 1.2;
        const a1 = (i + 0.5) * (360 / N) - 1.2;
        const p = h('path', { class: 'jk-seg', d: arcPath(a0, a1, 41, 95), dataset: { jkcat: it.id } });
        svg.appendChild(p);
        return p;
      });
      svg.appendChild(h('circle', { class: 'jk-wheel-hub', cx: '0', cy: '0', r: '38' }));
      const btns = items.map((it, i) => {
        const ang = (i * (360 / N) * Math.PI) / 180;
        const R = 34;
        const b = h('button', {
          class: 'jk-wedge', type: 'button', dataset: { jkcat: it.id },
          style: { left: `${(50 + R * Math.sin(ang)).toFixed(2)}%`, top: `${(50 - R * Math.cos(ang)).toFixed(2)}%` },
          title: it.n ? `${it.title}: ${it.n} efsane espri` : `${it.title}: ${fmtNum(TOTAL_COMBOS)} olasılık`,
        },
        h('span', { class: 'jk-wedge-ic' }, icon(it.icon, { size: 18, stroke: 2 })),
        h('span', { class: 'jk-wedge-lbl' }, it.label),
        h('span', { class: 'jk-wedge-n num' }, it.n ? String(it.n) : '∞'),
        );
        const on = () => segs[i].classList.add('hot');
        const off = () => segs[i].classList.remove('hot');
        b.addEventListener('pointerenter', on);
        b.addEventListener('pointerleave', off);
        b.addEventListener('focus', on);
        b.addEventListener('blur', off);
        b.addEventListener('click', () => {
          sound.click();
          if (it.id === 'makine') selectTab('makine', true);
          else { setCat(it.id); selectTab('efsaneler', true); }
          scrollToTabs();
        });
        return b;
      });
      const core = h('button', { class: 'jk-wheel-core', type: 'button', title: 'Arşivden ya da makineden rastgele bir espri', onclick: rollRandom },
        icon('paw', { size: 26, stroke: 2 }),
        h('span', { class: 'jk-core-top' }, 'Rastgele'),
        h('span', { class: 'jk-core-dog' }, 'DOG'),
      );
      return h('div', { class: 'jk-wheel', role: 'group', 'aria-label': 'Espri çarkı: bir kategori seç ya da ortadan rastgele DOG çek' }, svg, btns, core);
    }

    const hero = h('header', { class: 'jk-hero' },
      h('div', { class: 'jk-hero-copy' },
        h('span', { class: 'eyebrow' }, 'Hayran yapımı mizah arşivi'),
        h('h1', { class: 'h1 jk-h1' }, 'Espri ', h('em', null, 'Duvarı')),
        h('div', { class: `jk-bigstamp${reduced ? '' : ' slam'}`, 'aria-hidden': 'true' },
          h('span', { class: 'stamp jk-bs-line' }, 'DOG'),
          h('span', { class: 'stamp jk-bs-line' }, 'DOG'),
          h('span', { class: 'stamp jk-bs-line' }, 'DOG'),
          h('span', { class: 'stamp gold jk-bs-tag' }, '1vDOQUZ'),
        ),
        h('p', { class: 'lead' },
          'Takım arkadaşı feed’ledi, rakip tek başına Roshan’a girdi, kurye yine kayıp. Hüküm hep aynı üç kelime. ',
          'Efsaneleri oku, makineye yeni DOG ürettir, kendi esprini duvara as.',
        ),
        h('div', { class: 'row jk-hero-actions' },
          h('button', { class: 'btn primary lg', type: 'button', onclick: rollRandom }, icon('paw', { size: 20, stroke: 2 }), 'Rastgele DOG'),
          h('button', { class: 'btn ghost lg', type: 'button', onclick: () => { selectTab('ekle', true); scrollToTabs(); } }, icon('plus', { size: 18 }), 'Espri ekle'),
        ),
      ),
      buildWheel(),
    );

    const score = h('div', { class: 'jk-score', role: 'group', 'aria-label': 'Espri istatistikleri' },
      h('div', { class: 'jk-score-cell left' },
        h('span', { class: 'jk-score-lbl' }, 'Efsane arşiv'),
        h('span', { class: 'jk-score-val num' }, fmtNum(JOKES.length)),
        h('span', { class: 'jk-score-sub' }, `${JOKE_CATEGORIES.length} kategori`),
      ),
      h('div', { class: 'jk-score-cell mid' },
        h('span', { class: 'jk-score-lbl' }, 'Makine kombinasyonu'),
        comboStat,
        h('span', { class: 'jk-score-sub' }, `${TEMPLATE_COUNT} şablon · ${POOL_COUNT} kelime havuzu`),
      ),
      h('div', { class: 'jk-score-cell right' },
        h('span', { class: 'jk-score-lbl' }, 'Topluluk duvarı'),
        communityStat,
        h('span', { class: 'jk-score-sub' }, 'hayran esprisi'),
      ),
    );

    // ------------------------------------------------------------ sekmeler
    const tabCount = {};
    const tabBtns = TABS.map((t) => {
      const cnt = t.id === 'efsaneler' ? fmtNum(JOKES.length) : t.id === 'duvar' ? '0' : null;
      const c = cnt != null ? h('span', { class: 'jk-tab-n num' }, cnt) : null;
      if (c) tabCount[t.id] = c;
      return h('button', {
        class: 'tab jk-tab', type: 'button', role: 'tab', id: 'jk-tab-' + t.id, 'aria-controls': 'jk-panel-' + t.id,
        'aria-selected': 'false', tabindex: '-1', dataset: { tab: t.id },
        onclick: () => { sound.click(); selectTab(t.id, true); },
      }, icon(t.icon, { size: 16 }), h('span', null, t.label), c);
    });
    const tablist = h('div', { class: 'tabs jk-tabs', role: 'tablist', 'aria-label': 'Espri Duvarı bölümleri' }, tabBtns);
    tablist.addEventListener('keydown', (e) => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
      const i = TAB_IDS.indexOf(state.tab);
      const n = e.key === 'Home' ? 0 : e.key === 'End' ? TAB_IDS.length - 1
        : (i + (e.key === 'ArrowRight' ? 1 : -1) + TAB_IDS.length) % TAB_IDS.length;
      selectTab(TAB_IDS[n], true);
      tabBtns[n].focus();
      e.preventDefault();
    });
    const panels = {};
    const built = {};
    for (const t of TABS) {
      panels[t.id] = h('section', { class: 'jk-panel', role: 'tabpanel', id: 'jk-panel-' + t.id, 'aria-labelledby': 'jk-tab-' + t.id, hidden: true });
    }

    /** Dar ekranda yatay kayan sekme şeridinde seçili sekmeyi görünür alana getirir. */
    function revealTab(btn, smooth) {
      if (!btn || tablist.scrollWidth <= tablist.clientWidth + 1) return;
      const left = btn.offsetLeft - (tablist.clientWidth - btn.offsetWidth) / 2;
      tablist.scrollTo({ left: Math.max(0, left), behavior: smooth && !reduced ? 'smooth' : 'auto' });
    }

    function scrollToTabs() {
      const top = tablist.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
    }

    function selectTab(id, fromUser) {
      if (!alive) return;
      if (!TAB_IDS.includes(id)) id = 'efsaneler';
      const changed = state.tab !== id;
      state.tab = id;
      tabBtns.forEach((b) => {
        const on = b.dataset.tab === id;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      revealTab(tabBtns[TAB_IDS.indexOf(id)], changed && state.tabShown);
      state.tabShown = true;
      for (const t of TAB_IDS) panels[t].hidden = t !== id;
      if (!built[id]) { built[id] = true; BUILDERS[id](panels[id]); }
      if (id === 'duvar') renderWall();
      if (id === 'makine') machineShown();
      if (fromUser && changed) ctx.setSub(id);
      refreshCounts();
    }

    // ------------------------------------------------------------ EFSANELER
    let legendGrid = null;
    let legendInfo = null;
    let legendChips = [];
    let resultCount = null;
    let moreBtn = null;
    let legendList = [];

    function setCat(cat) {
      state.cat = cat;
      state.limit = 24;
      ls.set('jk:cat', cat);
      if (built.efsaneler) renderLegends();
    }

    function buildFeature() {
      const d = new Date();
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const j = JOKES[hashStr('jk-gunun-' + key) % JOKES.length];
      const art = artUrl(j.cat === '1v9' ? 'poster-1vdoquz' : 'poster-dogdogdog');
      const media = art
        ? h('img', { class: 'jk-feature-img', src: art, alt: j.cat === '1v9' ? '1vDOQUZ posteri: dokuz köpeğe karşı tek okçu' : 'DOG DOG DOG posteri: altın harfler ve kalkanlı buldog', decoding: 'async' })
        : h('div', { class: 'jk-feature-fallback', 'aria-hidden': 'true' },
          h('span', { class: 'stamp' }, 'DOG'), h('span', { class: 'stamp' }, 'DOG'), h('span', { class: 'stamp' }, 'DOG'));
      return h('section', { class: 'jk-feature frame', 'aria-label': 'Günün damgası', dataset: { jkcat: j.cat } },
        h('div', { class: `jk-feature-media${art ? '' : ' no-art'}${j.cat === '1v9' ? ' is-1v9' : ''}` }, media,
          h('span', { class: 'jk-seal', 'aria-hidden': 'true' }, h('small', null, 'Günün'), 'Damgası'),
        ),
        h('div', { class: 'jk-feature-body' },
          h('div', { class: 'jk-feature-top' },
            h('span', { class: 'eyebrow' }, 'Günün damgası'),
            h('span', { class: 'jk-feature-cat', dataset: { jkcat: j.cat } }, catLabel(j.cat)),
            h('span', { class: 'jk-tag mono' }, '#' + j.id),
          ),
          legendCard(j, { size: 'xl', extraClass: 'jk-card--feature' }),
        ),
      );
    }

    function buildLegends(panel) {
      const chipAll = h('button', { class: 'chip jk-chip', type: 'button', 'aria-pressed': 'false', dataset: { cat: 'all' } }, icon('star', { size: 14 }), 'Hepsi', h('span', { class: 'jk-chip-n num' }, JOKES.length));
      legendChips = [chipAll, ...JOKE_CATEGORIES.map((c) => h('button', { class: 'chip jk-chip', type: 'button', 'aria-pressed': 'false', dataset: { cat: c.id, jkcat: c.id } },
        icon(CAT_META[c.id].icon, { size: 14 }), c.label, h('span', { class: 'jk-chip-n num' }, JOKES.filter((j) => j.cat === c.id).length)))];
      legendChips.forEach((b) => b.addEventListener('click', () => { sound.click(); setCat(b.dataset.cat); }));

      const input = h('input', { class: 'input jk-search-input', id: 'jk-search', type: 'search', placeholder: 'Espri ara: Roshan, kurye, Pudge, pause…', autocomplete: 'off', enterkeyhint: 'search' });
      const clearBtn = h('button', { class: 'jk-search-clear', type: 'button', 'aria-label': 'Aramayı temizle', hidden: true }, icon('close', { size: 16 }));
      let st = 0;
      input.addEventListener('input', () => {
        clearBtn.hidden = !input.value;
        clearTimeout(st);
        timers.delete(st);
        st = later(() => { state.q = fold(input.value.trim()); state.limit = 24; renderLegends(); }, 120);
      });
      clearBtn.addEventListener('click', () => { input.value = ''; clearBtn.hidden = true; state.q = ''; state.limit = 24; renderLegends(); input.focus(); });

      const sortSel = h('select', { class: 'select jk-sort', id: 'jk-sort' },
        h('option', { value: 'arsiv' }, 'Arşiv sırası'),
        h('option', { value: 'top' }, 'En çok DOG’lanan'),
        h('option', { value: 'karisik' }, 'Karışık'),
      );
      sortSel.value = state.sort;
      sortSel.addEventListener('change', () => { state.sort = sortSel.value; state.limit = 24; renderLegends(); });

      resultCount = h('span', { class: 'jk-result num', role: 'status', 'aria-live': 'polite' }, '');
      legendInfo = h('div', { class: 'jk-legend-info' });
      legendGrid = h('div', { class: 'jk-grid' });
      moreBtn = h('button', { class: 'btn ghost lg jk-more', type: 'button', hidden: true }, icon('paw', { size: 18 }), h('span', null, 'Daha fazla DOG'));
      moreBtn.addEventListener('click', () => {
        const from = state.limit;
        state.limit += 24;
        renderLegends({ append: from });
        sound.click();
      });

      panel.append(
        buildFeature(),
        h('div', { class: 'jk-filter panel tight' },
          h('div', { class: 'jk-chips', role: 'group', 'aria-label': 'Kategori filtresi' }, legendChips),
          h('div', { class: 'jk-filter-row' },
            h('div', { class: 'jk-search' },
              h('label', { class: 'sr-only', for: 'jk-search' }, 'Esprilerde ara'),
              h('span', { class: 'jk-search-ic' }, searchIcon()),
              input, clearBtn,
            ),
            h('div', { class: 'jk-sortwrap' }, h('label', { class: 'sr-only', for: 'jk-sort' }, 'Sıralama'), sortSel),
            resultCount,
          ),
          legendInfo,
        ),
        legendGrid,
        h('div', { class: 'jk-more-row' }, moreBtn),
      );
      renderLegends();
    }

    function renderLegends({ append } = {}) {
      if (!legendGrid) return;
      if (append != null) {
        const frag = document.createDocumentFragment();
        for (const j of legendList.slice(append, state.limit)) frag.appendChild(legendCard(j, { q: state.q }));
        legendGrid.appendChild(frag);
        paintMore();
        refreshCounts();
        return;
      }
      legendChips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === state.cat)));
      let list = JOKES.filter((j) => (state.cat === 'all' || j.cat === state.cat) && (!state.q || fold(j.text).includes(state.q)));
      if (state.sort === 'arsiv' && state.cat === 'all' && !state.q) {
        // Hepsi görünümünde kategorileri sırayla harmanla (dog-001, 1v9-001, maraton-001, …)
        const rank = (j) => Number(j.id.slice(-3)) * 10 + JOKE_CATEGORIES.findIndex((c) => c.id === j.cat);
        list = list.slice().sort((a, b) => rank(a) - rank(b));
      } else if (state.sort === 'top') {
        const c = likeCounts();
        list = list.slice().sort((a, b) => (c['jk:' + b.id] || 0) - (c['jk:' + a.id] || 0));
      } else if (state.sort === 'karisik') {
        const seed = hashStr(new Date().toDateString());
        list = list.slice().sort((a, b) => hashStr(a.id + seed) - hashStr(b.id + seed));
      }
      resultCount.textContent = `${fmtNum(list.length)} espri`;
      clear(legendInfo);
      const cat = JOKE_CATEGORIES.find((c) => c.id === state.cat);
      if (cat) {
        legendInfo.append(
          h('p', { class: 'jk-blurb', dataset: { jkcat: cat.id } }, h('strong', null, cat.label), ' — ', cat.blurb),
          cat.id === 'hero'
            ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => ctx.go('kahramanlar') }, icon('swords', { size: 16 }), 'Kahraman DOG Endeksi', icon('arrowRight', { size: 16 }))
            : null,
        );
      } else {
        legendInfo.append(h('p', { class: 'jk-blurb' }, 'Arşivdeki bütün espriler hayran yapımıdır. Beğendiğini DOG’la, yorumla, kopyalayıp chat’e at.'));
      }
      legendList = list;
      clear(legendGrid);
      paintMore();
      if (!list.length) {
        legendGrid.appendChild(h('div', { class: 'empty jk-empty' },
          h('span', { class: 'stamp jk-empty-stamp' }, 'DOG?'),
          h('p', null, 'Bu aramaya uyan efsane yok. Makine belki bir tane uydurur.'),
          h('button', { class: 'btn gold sm', type: 'button', onclick: () => selectTab('makine', true) }, icon('dice', { size: 16 }), 'Makineye sor'),
        ));
        return;
      }
      const frag = document.createDocumentFragment();
      for (const j of list.slice(0, state.limit)) frag.appendChild(legendCard(j, { q: state.q }));
      legendGrid.appendChild(frag);
      refreshCounts();
    }

    function paintMore() {
      if (!moreBtn) return;
      const left = legendList.length - state.limit;
      moreBtn.hidden = left <= 0;
      moreBtn.lastChild.textContent = `Daha fazla DOG (${fmtNum(Math.max(0, left))} kaldı)`;
    }

    // ------------------------------------------------------------ MAKİNE
    let screenEl = null;
    let serialEl = null;
    let machBadge = null;
    let historyEl = null;
    let machChips = [];
    let comboEl = null;
    let comboSub = null;
    let counted = false;
    let rolling = false;

    function buildMachine(panel) {
      screenEl = h('div', { class: 'jk-screen-body' });
      serialEl = h('span', { class: 'jk-serial mono' }, '#—');
      machBadge = h('span', { class: 'jk-mach-cat' }, '');
      comboEl = h('span', { class: 'jk-mach-num num' }, fmtNum(TOTAL_COMBOS));
      comboSub = h('span', { class: 'jk-mach-sub' }, '');
      historyEl = h('ol', { class: 'jk-history' });

      const genBtn = h('button', { class: 'btn primary lg block jk-gen', type: 'button' }, icon('dice', { size: 22, stroke: 2 }), 'Yeni DOG üret');
      genBtn.addEventListener('click', () => runGen());
      const postBtn = h('button', { class: 'btn gold', type: 'button' }, icon('send', { size: 18 }), 'Duvara as');
      postBtn.addEventListener('click', async () => {
        if (!state.lastGen) return;
        postBtn.disabled = true;
        const id = await postJoke({ text: state.lastGen.text, cat: state.lastGen.cat, src: 'makine' });
        postBtn.disabled = false;
        if (id) {
          sound.good();
          afterPost(id, { jump: false });
          toastWithLink('Duvara asıldı.', 'Duvarda gör', () => { state.highlightId = id; selectTab('duvar', true); });
        }
      });
      const copyBtn = h('button', { class: 'btn ghost', type: 'button' }, icon('copy', { size: 18 }), 'Kopyala');
      copyBtn.addEventListener('click', async () => {
        if (!state.lastGen) return;
        const ok = await copyText(state.lastGen.text, screenEl);
        fx.toast(ok ? 'Kopyalandı.' : 'Metni seçtim; Ctrl+C ile kopyalayabilirsin.', ok ? 'jade' : undefined);
        if (ok) sound.coin();
      });

      machChips = [{ id: 'all', label: 'Karışık', icon: 'sparkle' }, ...JOKE_CATEGORIES.map((c) => ({ id: c.id, label: CAT_META[c.id].short, icon: CAT_META[c.id].icon }))].map((c) => {
        const b = h('button', { class: 'chip jk-chip', type: 'button', 'aria-pressed': String(state.machCat === c.id), dataset: { cat: c.id, ...(c.id !== 'all' ? { jkcat: c.id } : {}) }, title: `${fmtNum(countCombos(c.id === 'all' ? undefined : c.id))} olasılık` }, icon(c.icon, { size: 14 }), c.label);
        b.addEventListener('click', () => {
          state.machCat = c.id;
          machChips.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.cat === c.id)));
          paintComboSub();
          sound.click();
          runGen();
        });
        return b;
      });

      const out = h('div', { class: 'jk-mach-out panel raised frame' },
        h('div', { class: 'jk-mach-head' },
          h('span', { class: 'jk-led', 'aria-hidden': 'true' }),
          h('span', { class: 'eyebrow' }, 'Espri Makinesi'),
          h('span', { class: 'spacer' }),
          machBadge,
          serialEl,
        ),
        h('div', { class: 'jk-screen', 'aria-live': 'polite', 'aria-atomic': 'true' }, screenEl),
        h('div', { class: 'row jk-mach-actions' }, postBtn, copyBtn, h('span', { class: 'spacer' }), h('span', { class: 'xsmall dim' }, 'Her espri kendi seri numarasıyla üretilir.')),
      );
      const side = h('div', { class: 'jk-mach-side' },
        h('div', { class: 'jk-mach-count panel' },
          h('span', { class: 'jk-score-lbl' }, 'Bu motor'),
          comboEl,
          h('span', { class: 'jk-mach-cap' }, 'farklı espri üretebilir'),
          comboSub,
        ),
        h('div', { class: 'jk-mach-ctrl panel' },
          h('span', { class: 'label' }, 'Kategori'),
          h('div', { class: 'jk-chips', role: 'group', 'aria-label': 'Makine kategorisi' }, machChips),
          genBtn,
        ),
        h('div', { class: 'jk-mach-hist panel tight' },
          h('span', { class: 'label' }, 'Son üretilenler'),
          historyEl,
        ),
      );
      panel.append(h('div', { class: 'jk-machine' }, out, side));
      paintComboSub();
      showGen(genJoke(state.machCat), true);
    }

    function paintComboSub() {
      if (!comboSub) return;
      comboSub.textContent = state.machCat === 'all'
        ? `${TEMPLATE_COUNT} şablon, ${POOL_COUNT} kelime havuzu, ${POOL_SIZES.hero} kahraman, ${POOL_SIZES.blunder} DOG hareketi`
        : `${catLabel(state.machCat)}: ${fmtNum(countCombos(state.machCat))} olasılık`;
    }

    function showGen(j, addHistory = true) {
      state.lastGen = j;
      clear(screenEl).appendChild(jokeBody(j.text, { size: 'lg' }));
      screenEl.dataset.jkcat = j.cat;
      serialEl.textContent = 'Seri #' + j.seed.toString(36).toUpperCase();
      machBadge.textContent = CAT_META[j.cat].short;
      machBadge.dataset.jkcat = j.cat;
      if (addHistory) {
        state.history = [j, ...state.history.filter((x) => x.seed !== j.seed)].slice(0, 6);
        renderHistory();
      }
    }

    function renderHistory() {
      clear(historyEl);
      if (!state.history.length) { historyEl.appendChild(h('li', { class: 'xsmall dim' }, 'Henüz üretim yok. Büyük düğmeye bas.')); return; }
      for (const j of state.history) {
        const b = h('button', { class: 'jk-hist-btn', type: 'button', dataset: { jkcat: j.cat }, title: j.text },
          h('span', { class: 'jk-hist-serial mono' }, '#' + j.seed.toString(36).toUpperCase()),
          h('span', { class: 'jk-hist-text' }, j.text.replace(/\n/g, ' · ')),
        );
        b.addEventListener('click', () => { showGen(j, false); sound.click(); });
        historyEl.appendChild(h('li', null, b));
      }
    }

    function runGen() {
      if (rolling) return;
      const j = genJoke(state.machCat);
      const box = screenEl.parentElement;
      if (reduced) { showGen(j); sound.bark(1.05); return; }
      rolling = true;
      box.setAttribute('aria-busy', 'true');
      box.classList.remove('landed');
      box.classList.add('rolling');
      let n = 0;
      const frame = () => {
        if (n++ < 6) {
          const tmp = genJoke(state.machCat);
          clear(screenEl).appendChild(jokeBody(tmp.text, { size: 'lg' }));
          sound.tick();
          later(frame, 60 + n * 8);
          return;
        }
        box.classList.remove('rolling');
        void box.offsetWidth;
        box.classList.add('landed');
        showGen(j);
        box.setAttribute('aria-busy', 'false');
        sound.bark(1.05);
        rolling = false;
      };
      frame();
    }

    function machineShown() {
      if (counted || reduced || !comboEl) return;
      counted = true;
      const t0 = performance.now();
      const dur = 1100;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        comboEl.textContent = fmtNum(TOTAL_COMBOS * e);
        if (k < 1) countRaf = requestAnimationFrame(step);
        else countRaf = 0;
      };
      countRaf = requestAnimationFrame(step);
    }
    let countRaf = 0;

    // ------------------------------------------------------------ DUVAR
    let wallGrid = null;
    let wallNote = null;
    let wallSortBtns = [];
    let wallCount = null;

    function buildWall(panel) {
      wallGrid = h('div', { class: 'jk-grid' });
      wallNote = h('p', { class: 'hint jk-wall-note', hidden: true });
      wallCount = h('span', { class: 'badge' }, '0');
      wallSortBtns = [['yeni', 'Yeni', 'clock'], ['top', 'En çok DOG’lanan', 'paw']].map(([id, label, ic]) => {
        const b = h('button', { class: 'chip jk-chip', type: 'button', 'aria-pressed': String(state.wallSort === id), dataset: { sort: id } }, icon(ic, { size: 14 }), label);
        b.addEventListener('click', () => {
          state.wallSort = id;
          wallSortBtns.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.sort === id)));
          sound.click();
          renderWall();
        });
        return b;
      });
      panel.append(
        h('div', { class: 'jk-wall-head' },
          h('div', { class: 'stack jk-wall-title' },
            h('h2', { class: 'h2' }, 'Topluluk Duvarı ', wallCount),
            h('p', { class: 'small muted' }, 'Hayranların astığı espriler. Kendininkini ya da (moderatörsen) herhangi birini silebilirsin.'),
          ),
          h('div', { class: 'row jk-wall-tools' },
            h('div', { class: 'jk-chips', role: 'group', 'aria-label': 'Sıralama' }, wallSortBtns),
            h('button', { class: 'btn primary sm', type: 'button', onclick: () => selectTab('ekle', true) }, icon('plus', { size: 16 }), 'Espri ekle'),
          ),
        ),
        wallNote,
        wallGrid,
      );
      paintWallNote();
    }

    function paintWallNote() {
      if (!wallNote) return;
      if (state.communityError) { wallNote.hidden = false; wallNote.textContent = 'Topluluk esprileri şu an yüklenemiyor. Birazdan tekrar dene.'; return; }
      if (store.mode && !store.shared) { wallNote.hidden = false; wallNote.textContent = 'Önizleme modu: espriler şimdilik yalnızca bu cihazda saklanıyor.'; return; }
      wallNote.hidden = true;
    }

    function communityDocs() {
      return state.community
        .filter((d) => d && typeof d.text === 'string' && d.text.trim())
        .map((d) => ({ ...d, text: String(d.text).slice(0, 400), cat: validCat(d.cat) }));
    }

    function renderWall() {
      if (!wallGrid || state.tab !== 'duvar') return;
      paintWallNote();
      let docs = communityDocs();
      wallCount.textContent = fmtNum(docs.length);
      if (state.wallSort === 'top') {
        const c = likeCounts();
        docs = docs.slice().sort((a, b) => (c['jc:' + b.id] || 0) - (c['jc:' + a.id] || 0) || (b.createdAt || 0) - (a.createdAt || 0));
      }
      clear(wallGrid);
      if (!state.communityLoaded) {
        for (let i = 0; i < 3; i++) wallGrid.appendChild(h('div', { class: 'jk-skel skeleton', 'aria-hidden': 'true' }));
        return;
      }
      if (!docs.length) {
        wallGrid.appendChild(h('div', { class: 'jk-wall-empty' },
          h('span', { class: 'stamp jk-empty-stamp' }, 'DOG DOG…?'),
          h('h3', { class: 'h3' }, 'Duvar bomboş. Kurye bile uğramamış.'),
          h('p', { class: 'muted small' }, 'İlk espriyi asan, duvarın ilk DOG’u olur. Ya da makineye ürettirip tek tıkla as.'),
          h('div', { class: 'row', style: 'justify-content:center' },
            h('button', { class: 'btn primary', type: 'button', onclick: () => selectTab('ekle', true) }, icon('plus', { size: 18 }), 'İlk esprini ekle'),
            h('button', { class: 'btn ghost', type: 'button', onclick: () => selectTab('makine', true) }, icon('dice', { size: 18 }), 'Makineden al'),
          ),
        ));
        return;
      }
      const me = store.uid();
      const mod = store.isModerator();
      let target = null;
      // Canlı güncellemede (başkası espri asınca) klavye odağı kaybolmasın
      const act = document.activeElement;
      const actCard = act && wallGrid.contains(act) ? act.closest('.jk-card') : null;
      const refocus = actCard && actCard.dataset.doc ? { doc: actCard.dataset.doc, act: act.dataset.act || null } : null;
      const frag = document.createDocumentFragment();
      for (const d of docs) {
        const card = jokeCard(d, {
          kind: 'community', likeKey: 'jc:' + d.id, threadId: 'joke:' + d.id, docId: d.id,
          nick: d.nick, createdAt: d.createdAt, src: d.src, canDelete: (me && d.authorId === me) || mod,
          extraClass: state.glowIds.has(d.id) ? 'jk-new' : '',
        });
        jokeOf.set(card, { ...d, docId: d.id });
        if (d.id === state.highlightId) target = card;
        frag.appendChild(card);
      }
      wallGrid.appendChild(frag);
      if (refocus) {
        const c = [...wallGrid.querySelectorAll('.jk-card[data-doc]')].find((x) => x.dataset.doc === refocus.doc);
        const t = c && (refocus.act ? c.querySelector(`[data-act="${refocus.act}"]`) : null);
        if (t) t.focus({ preventScroll: true });
      }
      refreshCounts();
      if (target) {
        state.highlightId = null;
        later(() => target.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }), 60);
      }
    }

    // ------------------------------------------------------------ EKLE
    let addNote = null;
    let addTa = null;
    let addSubmit = null;
    let nickChipText = null;
    let paintPreview = () => {};

    function buildAdd(panel) {
      const draft = ls.get('jk:draft', null) || {};
      const ta = h('textarea', { class: 'textarea jk-ta', id: 'jk-text', maxlength: String(MAX), rows: '6', placeholder: 'Örn: 1vDOQUZ’un 11. kişisi kim? Maç sonunda “ben olmasam kaybederdik” yazan kurye.' });
      ta.value = typeof draft.text === 'string' ? draft.text.slice(0, MAX) : '';
      addTa = ta;
      const counter = h('span', { class: 'counter' }, `0/${MAX}`);
      const sel = h('select', { class: 'select', id: 'jk-cat' }, JOKE_CATEGORIES.map((c) => h('option', { value: c.id }, c.label)));
      sel.value = CAT_META[draft.cat] ? draft.cat : state.cat !== 'all' ? state.cat : 'dog';
      nickChipText = h('span', null, store.me.get().nick || 'Anonim');
      const nickChip = h('button', { class: 'chip jk-nick-chip', type: 'button', title: 'Takma adını değiştir', onclick: openNickEditor }, icon('user', { size: 14 }), nickChipText, icon('refresh', { size: 12 }));
      addSubmit = h('button', { class: 'btn primary lg', type: 'submit' }, icon('send', { size: 20 }), 'Duvara as');
      addNote = h('p', { class: 'hint jk-add-note', hidden: true });
      const previewHost = h('div', { class: 'jk-preview' });

      const starters = STARTERS.map((s) => {
        const b = h('button', { class: 'chip jk-chip', type: 'button' }, s.label);
        b.addEventListener('click', async () => {
          if (ta.readOnly) return;
          if (ta.value.trim() && s.text && ta.value.trim() !== s.text) {
            const ok = await fx.confirm('Yazdığın metin şablonla değiştirilsin mi?', { ok: 'Değiştir', cancel: 'Vazgeç' });
            if (!ok) return;
          }
          if (s.text) ta.value = s.text;
          ta.focus();
          const pos = s.text.indexOf('…');
          if (pos >= 0) ta.setSelectionRange(pos, pos + 1);
          else ta.setSelectionRange(ta.value.length, ta.value.length);
          onInput();
        });
        return b;
      });

      let draftT = 0;
      function onInput() {
        const n = ta.value.length;
        counter.textContent = `${n}/${MAX}`;
        counter.classList.toggle('over', n > MAX);
        paintPreview();
        clearTimeout(draftT);
        timers.delete(draftT);
        draftT = later(() => {
          if (ta.value.trim()) ls.set('jk:draft', { text: ta.value, cat: sel.value });
          else ls.remove('jk:draft');
        }, 400);
      }
      paintPreview = () => {
        const text = normalizeText(ta.value) || 'Esprin burada, duvardaki hâliyle görünecek. DOG DOG DOG.';
        const card = jokeCard({ text, cat: sel.value }, { kind: 'community', nick: store.me.get().nick || 'Anonim', createdAt: Date.now(), likeKey: 'jc:onizleme', threadId: 'joke:onizleme', extraClass: 'jk-card--preview' });
        const foot = card.querySelector('.jk-actions');
        if (foot) foot.setAttribute('inert', '');
        clear(previewHost).appendChild(card);
      };
      ta.addEventListener('input', onInput);
      sel.addEventListener('change', onInput);
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); }
      });

      const form = h('form', { class: 'jk-form panel raised', autocomplete: 'off', novalidate: true },
        h('div', { class: 'field' },
          h('label', { for: 'jk-text' }, 'Esprin'),
          ta,
          h('div', { class: 'row jk-form-meta' }, h('span', { class: 'hint' }, 'Satır sonları korunur: diyalog ve rapor yazabilirsin. Ctrl+Enter gönderir.'), h('span', { class: 'spacer' }), counter),
        ),
        h('div', { class: 'stack jk-starters' },
          h('span', { class: 'label' }, 'Hızlı başlangıç'),
          h('div', { class: 'jk-chips' }, starters),
        ),
        h('div', { class: 'jk-form-grid' },
          h('div', { class: 'field' }, h('label', { for: 'jk-cat' }, 'Kategori'), sel),
          h('div', { class: 'field' }, h('span', { class: 'label' }, 'Yazan'), h('div', { class: 'row' }, nickChip)),
        ),
        h('p', { class: 'hint' }, 'Kural basit: küfür yok, hakaret yok, gerçek kişiler hakkında uydurma yok. DOG serbest. 10 saniyede bir espri gönderebilirsin.'),
        h('div', { class: 'row jk-form-foot' }, addSubmit),
        addNote,
      );
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (ta.readOnly) return;
        const text = normalizeText(ta.value);
        if (text.length < 8) { fx.toast('Biraz daha yaz; bu kadarı ward bile değil.', 'blood'); fx.shake(ta); return; }
        addSubmit.disabled = true;
        const id = await postJoke({ text, cat: sel.value });
        addSubmit.disabled = false;
        if (!id) return;
        ta.value = '';
        ls.remove('jk:draft');
        onInput();
        sound.good();
        const r = addSubmit.getBoundingClientRect();
        fx.confetti(r.left + r.width / 2, r.top, 60);
        fx.toast('Esprin duvara asıldı. DOG DOG DOG!', 'jade');
        afterPost(id, { jump: true });
      });

      panel.append(h('div', { class: 'jk-add' },
        h('div', { class: 'stack' },
          h('div', { class: 'section-head' },
            h('span', { class: 'eyebrow' }, 'Espri Ekle'),
            h('h2', { class: 'h2' }, 'Sen de bir DOG as'),
            h('p', { class: 'muted small' }, 'Tek satır, diyalog, sözlük tanımı ya da maç raporu: biçimi kart kendisi tanır.'),
          ),
          form,
        ),
        h('aside', { class: 'jk-preview-wrap' },
          h('span', { class: 'eyebrow' }, 'Canlı önizleme'),
          previewHost,
          h('p', { class: 'xsmall dim' }, 'İpucu: “SON DAKİKA:” ile başlarsan manşet, “DOG (isim):” ile başlarsan sözlük kartı olur.'),
        ),
      ));
      onInput();
      paintAddNote();
    }

    function paintAddNote() {
      if (!addNote) return;
      if (store.mode && !store.canWrite()) {
        addTa.readOnly = true;
        addSubmit.disabled = true;
        addNote.hidden = false;
        addNote.textContent = 'Bu sayfayı yalnızca görüntüleyebiliyorsun; espri ekleme izni yok. Efsaneleri okuyabilir ve makineyi kullanabilirsin.';
      } else if (store.mode && !store.shared) {
        addNote.hidden = false;
        addNote.textContent = 'Önizleme modu: esprin bu cihazda saklanır, diğer ziyaretçiler göremez.';
      } else {
        addNote.hidden = true;
      }
    }

    const BUILDERS = { efsaneler: buildLegends, makine: buildMachine, duvar: buildWall, ekle: buildAdd };

    // ------------------------------------------------------------ kurulum
    const root = h('div', { class: 'wrap jk' }, hero, score, tablist, TAB_IDS.map((t) => panels[t]));
    root.addEventListener('click', onAction);
    el.appendChild(root);
    selectTab(TAB_IDS.includes(ctx.sub) ? ctx.sub : 'efsaneler', false);
    // Derin bağlantı (#espriler--duvar vb.): kabuk sayfayı başa kaydırdıktan sonra sekmelere in
    if (TAB_IDS.includes(ctx.sub) && ctx.sub !== 'efsaneler') {
      later(() => window.scrollTo({ top: tablist.getBoundingClientRect().top + window.scrollY - 80, behavior: 'auto' }), 60);
    }
    const mySelect = (sub) => selectTab(TAB_IDS.includes(sub) ? sub : 'efsaneler', false);
    activeSelect = mySelect;

    cleanups.push(store.fans((fans) => { state.fans = fans; refreshCounts(); }));
    cleanups.push(store.me.subscribe((d) => {
      if (nickChipText) nickChipText.textContent = d.nick || 'Anonim';
      if (state.tab === 'ekle') paintPreview();
      refreshCounts();
    }));
    cleanups.push(store.subscribe('jokes', { orderBy: 'createdAt', dir: 'desc', limit: 200 }, (docs) => {
      state.community = docs || [];
      state.communityLoaded = true;
      state.communityError = false;
      const n = communityDocs().length;
      communityStat.textContent = fmtNum(n);
      if (tabCount.duvar) tabCount.duvar.textContent = fmtNum(n);
      renderWall();
    }, () => {
      state.communityError = true;
      state.communityLoaded = true;
      communityStat.textContent = '—';
      paintWallNote();
      renderWall();
    }));
    cleanups.push(store.subscribe('comments', { orderBy: 'createdAt', dir: 'desc', limit: 500 }, (docs) => {
      const m = {};
      for (const c of docs || []) if (c && typeof c.thread === 'string' && c.thread.startsWith('joke:')) m[c.thread] = (m[c.thread] || 0) + 1;
      state.threadCounts = m;
      refreshCounts();
    }));
    store.ready.then(() => { paintAddNote(); paintWallNote(); });

    return () => {
      alive = false;
      root.removeEventListener('click', onAction);
      for (const fn of cleanups) { try { fn(); } catch { /* yok say */ } }
      for (const t of timers) clearTimeout(t);
      timers.clear();
      if (paintRaf) cancelAnimationFrame(paintRaf);
      if (countRaf) cancelAnimationFrame(countRaf);
      closeAllModals();
      if (activeSelect === mySelect) activeSelect = null;
      root.remove();
    };
  },

  onSub(sub) {
    // mount içindeki selectTab'a erişmek için örnek üzerinden yönlendirilir
    if (activeSelect) activeSelect(sub);
  },
};

let activeSelect = null;
