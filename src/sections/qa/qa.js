// Soru-Cevap bölümü (#soru-cevap)
//   #soru-cevap--sorular   Topluluk soruları (varsayılan): liste, arama, sıralama, "Soru sor" formu
//   #soru-cevap--q<docId>  Tekil soru: oy, cevaplar, kabul edilen cevap, cevap formu
//   #soru-cevap--kahin     DOG Kâhini: yerel "sihirli küre" (yapay zekâ YOK, bkz. data/oracle.js)
//   #soru-cevap--sss       SSS: Dota eşya açıklaması havasında akordeon (bkz. data/faq.js)
//
// Veri: store 'questions' { title, body, acceptedId? } ve 'answers' { qid, text }.
// Oylar ziyaretçinin fan belgesinde likes['q:<id>'] / likes['a:<id>'] olarak tutulur.

import './qa.css';
import { h, clear, ls, timeAgo, cleanText, softFilter, fmtNum, prefersReducedMotion, shuffle } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { store, agg } from '../../core/store.js';
import { sound } from '../../core/sound.js';
import { fx } from '../../core/fx.js';
import { openNickEditor } from '../../core/shell.js';
import { ROUTES } from '../../core/routes.js';
import { FAQ } from '../../data/faq.js';
import { createOracle, ORACLE_EXAMPLES, normalizeTr } from '../../data/oracle.js';
import * as heroData from '../../data/heroes.js';
import { artUrl } from '../../core/assets.js';

const TITLE_MAX = 120;
const BODY_MAX = 600;
const ANSWER_MAX = 600;
const ORACLE_MAX = 140;
const POST_GAP_MS = 15000;
const PAGE = 20;
const Q_LIMIT = 200;
const A_LIMIT = 1000;

const TABS = [
  { id: 'sorular', label: 'Topluluk Soruları', short: 'Sorular', icon: 'chat', hint: 'Sor · cevapla · oyla' },
  { id: 'kahin', label: 'DOG Kâhini', short: 'Kâhin', icon: 'eye', hint: 'Kadim küreye danış' },
  { id: 'sss', label: 'SSS', short: 'SSS', icon: 'question', hint: 'Sık sorulanlar' },
];

const SORTS = [
  { id: 'new', label: 'Yeni', icon: 'clock' },
  { id: 'top', label: 'En çok oy', icon: 'paw' },
  { id: 'open', label: 'Cevapsız', icon: 'question' },
];

// Boş meclis için ilham verici örnek başlıklar (veritabanına YAZILMAZ; tıklanınca forma dolar)
const IDEAS = [
  'Ward almayan support’a kibarca nasıl “DOG DOG DOG” denir?',
  '1vDOQUZ yapmak için en uygun kahraman hangisi?',
  'Takım arkadaşım 40. dakikada hâlâ farm yapıyorsa ne yapmalıyım?',
  'Rapier aldım, öldüm, düşürdüm. Şimdi ne olacak?',
  '24 saatlik maratonu uyumadan izlemenin sırrı ne?',
  '“Mid or feed” diyen birine en şık cevap ne olur?',
];

const TONES = ['ember', 'jade', 'gold', 'blood', 'arcane'];

// Oturum boyunca bellekte kalan durum (bölümden çıkıp dönünce korunur)
let lastAskAt = 0;
let lastAnswerAt = 0;
const oracleSession = { oracle: null, history: [], fixed: false };

// ------------------------------------------------------------------ hash kodlama
// Hash yalnızca [A-Za-z0-9_-] taşır ve '--' alt sayfa ayırıcısıdır. Güvenli kimlikler olduğu gibi
// ('q' + id), diğerleri UTF-8 onaltılık olarak ('q-' + hex) kodlanır.
export function encodeQid(id) {
  const s = String(id);
  if (/^[A-Za-z0-9_]+$/.test(s)) return 'q' + s;
  const bytes = new TextEncoder().encode(s);
  return 'q-' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function decodeQid(sub) {
  if (!sub || sub[0] !== 'q') return null;
  if (sub.startsWith('q-')) {
    const hex = sub.slice(2);
    if (!/^(?:[0-9a-f]{2})+$/.test(hex)) return null;
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(hex.match(/../g).map((x) => parseInt(x, 16))));
    } catch {
      return null;
    }
  }
  const id = sub.slice(1);
  return /^[A-Za-z0-9_]+$/.test(id) ? id : null;
}

/** Çok satırlı metin temizleme: satır sonlarını korur, boşlukları sadeleştirir. */
function cleanMulti(s, max) {
  return String(s || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function bindCounter(input, counter, max) {
  const upd = () => {
    const n = input.value.length;
    counter.textContent = `${n}/${max}`;
    counter.classList.toggle('over', n >= max);
  };
  input.addEventListener('input', upd);
  upd();
  return upd;
}

function scrollToEl(node, offset = 16) {
  if (!node) return;
  const hud = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-h')) || 56;
  const top = node.getBoundingClientRect().top + window.scrollY - hud - offset;
  window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
}

// ------------------------------------------------------------------ bölüm
function createQA(el, ctx) {
  let alive = true;
  const offs = [];
  const timers = new Set();
  const later = (fn, ms) => {
    const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms);
    timers.add(t);
    return t;
  };
  const reduced = prefersReducedMotion();

  const savedSort = ls.get('qa-sort', 'new');
  const state = {
    tab: null,
    detailId: null,
    questions: null, // null = yükleniyor
    answersAll: null,
    ansCount: new Map(),
    ansIds: new Set(),
    others: {}, // diğer ziyaretçilerin oy sayıları (kendi oyumuz store.me'den eklenir)
    sort: SORTS.some((s) => s.id === savedSort) ? savedSort : 'new',
    query: '',
    shown: PAGE,
    listScroll: 0,
    ready: false,
    listError: false,
  };
  const pendingAccept = new Map();
  const nickLabels = new Set();
  // Giriş animasyonu yalnızca ilk kez görünen öğelere (yeniden çizimde titreme olmasın)
  const seen = new Set();
  const fresh = (key) => { if (reduced || seen.has(key)) return false; seen.add(key); return true; };
  const built = {};

  // -------------------------------------------------------------- yardımcılar
  const myId = () => store.uid();
  const isMine = (doc) => { const u = myId(); return !!u && !!doc && doc.authorId === u; };
  const myLikes = () => store.me.get().likes || {};
  const voteCount = (key) => (state.others[key] || 0) + (myLikes()[key] ? 1 : 0);
  const answerCount = (q) => state.ansCount.get(q.id) || 0;
  const isSolved = (q) => !!q.acceptedId && (!state.answersAll || state.answersAll.length >= A_LIMIT || state.ansIds.has(q.acceptedId));
  const findQ = (id) => (state.questions ? state.questions.find((q) => q.id === id) : null) || null;
  const canWrite = () => store.canWrite();

  function nickChip() {
    const label = h('span', null, store.me.get().nick || 'Anonim');
    nickLabels.add(label);
    return h('button', { class: 'chip qa-nick-chip', type: 'button', title: 'Takma adını değiştir', onclick: () => openNickEditor() },
      icon('user', { size: 14 }), label);
  }

  function voteBtn(key, { label, lg = false } = {}) {
    const on = !!myLikes()[key];
    const n = voteCount(key);
    const btn = h('button', {
      class: `qa-vote${on ? ' on' : ''}${lg ? ' lg' : ''}`,
      type: 'button',
      'aria-pressed': String(on),
      'aria-label': `${label}: ${n} oy`,
      title: on ? 'Oyunu geri al' : 'DOG’la (oy ver)',
      dataset: { focusKey: 'v:' + key },
    }, icon('paw', { size: lg ? 22 : 18 }), h('span', { class: 'num' }, fmtNum(n)));
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const now = store.me.toggleLike(key);
      if (now) {
        sound.bark(1.25);
        const r = btn.getBoundingClientRect();
        fx.floatText('+1', r.left + r.width / 2, r.top, { size: 18 });
      } else {
        sound.click();
      }
    });
    return btn;
  }

  /** Yeniden çizimde klavye odağını korur (data-focus-key ile). */
  function keepFocus(scope, fn) {
    const a = document.activeElement;
    const key = a && a.dataset ? a.dataset.focusKey : null;
    const inScope = key && scope.contains(a);
    fn();
    if (inScope) {
      const n = Array.from(scope.querySelectorAll('[data-focus-key]')).find((x) => x.dataset.focusKey === key);
      if (n && n !== document.activeElement) n.focus({ preventScroll: true });
    }
  }

  // -------------------------------------------------------------- iskelet
  const root = h('div', { class: 'wrap qa-root' });
  el.appendChild(root);

  const tallyQ = h('dd', { class: 'num' }, '–');
  const tallyA = h('dd', { class: 'num' }, '–');
  const tallyS = h('dd', { class: 'num' }, '–');
  const head = h('header', { class: 'qa-head' },
    h('div', { class: 'section-head qa-head-text' },
      h('span', { class: 'eyebrow' }, 'Meclis · Soru-Cevap'),
      h('h1', { class: 'h1' }, 'Soru-', h('em', null, 'Cevap')),
      h('p', { class: 'lead' },
        'Topluluğa sor, en iyi cevabı altınla mühürle. Sabrın yoksa kadim DOG Kâhini anında hüküm verir; temel meseleler SSS’de.'),
    ),
    h('dl', { class: 'qa-tally panel tight', 'aria-label': 'Meclis sayacı' },
      h('div', null, h('dt', null, 'Soru'), tallyQ),
      h('div', null, h('dt', null, 'Cevap'), tallyA),
      h('div', { class: 'is-gold' }, h('dt', null, 'Çözüldü'), tallyS),
    ),
  );

  const tabBtns = new Map();
  const panels = new Map();
  const tabCount = h('span', { class: 'qa-tab-count num', hidden: true });
  const tablist = h('div', { class: 'qa-tabs', role: 'tablist', 'aria-label': 'Soru-Cevap bölümleri' });
  for (const t of TABS) {
    const btn = h('button', {
      class: 'qa-tab', type: 'button', role: 'tab', id: `qa-tab-${t.id}`,
      'aria-controls': `qa-panel-${t.id}`, 'aria-selected': 'false', tabindex: '-1',
    },
      h('span', { class: 'qa-tab-slot', 'aria-hidden': 'true' }, icon(t.icon, { size: 20 })),
      h('span', { class: 'qa-tab-text' },
        h('span', { class: 'qa-tab-label' },
          h('span', { class: 'qa-tab-long' }, t.label),
          h('span', { class: 'qa-tab-short', 'aria-hidden': 'true' }, t.short),
          t.id === 'sorular' ? tabCount : null,
        ),
        h('span', { class: 'qa-tab-hint' }, t.hint),
      ),
    );
    btn.addEventListener('click', () => {
      sound.click();
      ctx.setSub(t.id);
      show(t.id);
    });
    tabBtns.set(t.id, btn);
    tablist.appendChild(btn);
    const panel = h('section', { class: 'qa-panel', id: `qa-panel-${t.id}`, role: 'tabpanel', 'aria-labelledby': `qa-tab-${t.id}`, hidden: true });
    panels.set(t.id, panel);
  }
  tablist.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const ids = TABS.map((t) => t.id);
    let i = ids.indexOf(state.tab);
    if (e.key === 'ArrowLeft') i = (i - 1 + ids.length) % ids.length;
    else if (e.key === 'ArrowRight') i = (i + 1) % ids.length;
    else if (e.key === 'Home') i = 0;
    else i = ids.length - 1;
    ctx.setSub(ids[i]);
    show(ids[i]);
    tabBtns.get(ids[i]).focus();
  });

  root.append(head, tablist, ...panels.values());

  // -------------------------------------------------------------- SORULAR: liste + form
  function buildSorular() {
    const panel = panels.get('sorular');

    // Araç çubuğu
    const search = h('input', { class: 'input', id: 'qa-search', type: 'search', placeholder: 'Sorularda ara: pudge, ward, maraton…', autocomplete: 'off', maxlength: '60' });
    search.addEventListener('input', () => { state.query = search.value; state.shown = PAGE; renderList(); });
    const sortBtns = SORTS.map((s) => {
      const b = h('button', { class: 'qa-seg', type: 'button', 'aria-pressed': String(state.sort === s.id), dataset: { sort: s.id } }, icon(s.icon, { size: 15 }), s.label);
      b.addEventListener('click', () => {
        if (state.sort === s.id) return;
        sound.click();
        state.sort = s.id;
        state.shown = PAGE;
        ls.set('qa-sort', s.id);
        for (const x of sortBtns) x.setAttribute('aria-pressed', String(x.dataset.sort === s.id));
        renderList();
      });
      return b;
    });
    const askJump = h('button', { class: 'btn primary sm qa-ask-jump', type: 'button' }, icon('plus', { size: 16 }), 'Soru sor');
    askJump.addEventListener('click', () => { scrollToEl(built.askPanel); built.askTitle.focus({ preventScroll: true }); });

    const status = h('p', { class: 'qa-status xsmall dim', 'aria-live': 'polite' });
    const list = h('ol', { class: 'qa-list' });
    const more = h('button', { class: 'btn ghost block qa-more', type: 'button', hidden: true }, 'Daha fazla soru göster');
    more.addEventListener('click', () => { state.shown += PAGE; renderList(); });
    list.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a.qa-row-title');
      if (a) { state.listScroll = window.scrollY; sound.click(); }
    });

    const main = h('div', { class: 'qa-main' },
      h('div', { class: 'qa-toolbar' },
        h('div', { class: 'qa-search' },
          h('label', { class: 'sr-only', for: 'qa-search' }, 'Sorularda ara'),
          icon('target', { size: 18 }),
          search,
        ),
        h('div', { class: 'qa-segs', role: 'group', 'aria-label': 'Sıralama' }, sortBtns),
        askJump,
      ),
      status,
      list,
      more,
    );

    // Soru sor formu
    const titleIn = h('input', { class: 'input', id: 'qa-ask-title', maxlength: String(TITLE_MAX), placeholder: 'Örn: Ward almayan support’a ne denir?', autocomplete: 'off' });
    const bodyIn = h('textarea', { class: 'textarea', id: 'qa-ask-body', maxlength: String(BODY_MAX), rows: '4', placeholder: 'Durumu anlat: hangi maç, hangi kahraman, hangi DOG anı…' });
    const titleCount = h('span', { class: 'counter', id: 'qa-ask-title-count' });
    const bodyCount = h('span', { class: 'counter', id: 'qa-ask-body-count' });
    const updTitle = bindCounter(titleIn, titleCount, TITLE_MAX);
    const updBody = bindCounter(bodyIn, bodyCount, BODY_MAX);
    const submit = h('button', { class: 'btn primary block', type: 'submit', id: 'qa-ask-submit' }, icon('send', { size: 18 }), 'Meclise sor');
    const note = h('p', { class: 'hint qa-note', hidden: true });

    const form = h('form', { class: 'qa-ask-form stack', autocomplete: 'off', 'aria-label': 'Soru sor' },
      h('div', { class: 'field' },
        h('label', { for: 'qa-ask-title' }, 'Başlık'),
        titleIn,
        h('div', { class: 'qa-field-foot' }, h('span', { class: 'hint' }, 'Net ve kısa: tek cümlelik soru.'), titleCount),
      ),
      h('div', { class: 'field' },
        h('label', { for: 'qa-ask-body' }, 'Ayrıntı (isteğe bağlı)'),
        bodyIn,
        h('div', { class: 'qa-field-foot' }, h('span', { class: 'hint' }, 'Ctrl + Enter ile gönder'), bodyCount),
      ),
      h('div', { class: 'qa-by' }, h('span', { class: 'xsmall dim' }, 'Yazan:'), nickChip()),
      submit,
      note,
    );
    bodyIn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!canWrite()) { fx.toast('Bu sayfada yazma iznin yok; yalnızca okuyabilirsin.', 'blood'); return; }
      const title = softFilter(cleanText(titleIn.value, TITLE_MAX));
      const body = softFilter(cleanMulti(bodyIn.value, BODY_MAX));
      if (title.length < 8) {
        fx.toast('Başlık en az 8 karakter olsun. “DOG?” bir soru sayılmaz.', 'blood');
        fx.shake(titleIn);
        titleIn.focus();
        return;
      }
      const wait = POST_GAP_MS - (Date.now() - lastAskAt);
      if (wait > 0) { fx.toast(`Biraz yavaş: ${Math.ceil(wait / 1000)} sn sonra tekrar sor.`, 'blood'); return; }
      submit.disabled = true;
      try {
        const id = await store.add('questions', { title, body });
        lastAskAt = Date.now();
        titleIn.value = '';
        bodyIn.value = '';
        updTitle();
        updBody();
        sound.good();
        fx.toast('Sorun meclise düştü. Cevaplar yolda.', 'jade');
        if (alive && id) {
          state.listScroll = 0;
          ctx.go('soru-cevap', encodeQid(id));
        }
      } catch (err) {
        console.error(err);
        fx.toast(err && err.code === 'too_large' ? 'Soru çok uzun.' : 'Soru gönderilemedi. Bağlantını kontrol edip tekrar dene.', 'blood');
      } finally {
        submit.disabled = !canWrite();
      }
    });

    const askPanel = h('section', { class: 'panel raised qa-ask', id: 'qa-ask', 'aria-labelledby': 'qa-ask-h' },
      h('span', { class: 'eyebrow' }, 'Meclise sor'),
      h('h2', { class: 'h2', id: 'qa-ask-h' }, 'Soru sor'),
      h('p', { class: 'small muted' }, 'Dota, maraton, meme ya da site hakkında… Topluluk cevaplar, sen en iyisini seçersin.'),
      form,
    );
    const oracleCta = h('section', { class: 'qa-cta' },
      h('span', { class: 'qa-cta-orb', 'aria-hidden': 'true' }),
      h('div', { class: 'stack qa-cta-text' },
        h('span', { class: 'eyebrow' }, 'Beklemeye sabrın yok mu?'),
        h('p', { class: 'small muted' }, 'DOG Kâhini her soruyu anında tartar: DOG mu, değil mi?'),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { sound.click(); ctx.setSub('kahin'); show('kahin'); } }, icon('eye', { size: 16 }), 'Kâhin’e danış'),
      ),
    );
    const side = h('aside', { class: 'qa-side stack' }, askPanel, oracleCta);

    const listView = h('div', { class: 'qa-board' }, main, side);
    const detailView = h('div', { class: 'qa-detail-host', hidden: true });
    panel.append(listView, detailView);

    Object.assign(built, { sorular: true, list, status, more, listView, detailView, search, askPanel, askTitle: titleIn, askBody: bodyIn, askSubmit: submit, askNote: note });
    applyWriteState();
    renderList();
  }

  function fillAsk(text) {
    if (!built.askTitle) return;
    built.askTitle.value = text;
    built.askTitle.dispatchEvent(new Event('input'));
    sound.click();
    scrollToEl(built.askPanel);
    built.askBody.focus({ preventScroll: true });
  }

  function sortedFiltered() {
    let qs = (state.questions || []).slice();
    const tokens = normalizeTr(state.query).split(' ').filter(Boolean);
    if (tokens.length) {
      qs = qs.filter((q) => {
        const hay = normalizeTr(`${q.title || ''} ${q.body || ''} ${q.nick || ''}`);
        return tokens.every((t) => hay.includes(t));
      });
    }
    if (state.sort === 'open') qs = qs.filter((q) => answerCount(q) === 0);
    if (state.sort === 'top') {
      qs.sort((a, b) => voteCount('q:' + b.id) - voteCount('q:' + a.id) || answerCount(b) - answerCount(a) || (b.createdAt || 0) - (a.createdAt || 0));
    }
    return qs;
  }

  function questionRow(q) {
    const n = answerCount(q);
    const solved = isSolved(q);
    const href = '#soru-cevap--' + encodeQid(q.id);
    return h('li', { class: `qa-row${solved ? ' is-solved' : ''}${n ? '' : ' is-open'}${fresh('q:' + q.id) ? ' is-new' : ''}` },
      voteBtn('q:' + q.id, { label: 'Soruya oy ver' }),
      h('div', { class: 'qa-row-main' },
        h('a', { class: 'qa-row-title', href, dataset: { focusKey: 'qt:' + q.id } },
          q.title || 'Başlıksız soru',
          h('span', { class: 'sr-only' }, `, ${n} cevap${solved ? ', çözüldü' : ''}`),
        ),
        q.body ? h('p', { class: 'qa-row-excerpt' }, q.body) : null,
        h('div', { class: 'qa-row-meta' },
          h('span', { class: 'qa-nick' }, q.nick || 'Anonim'),
          isMine(q) ? h('span', { class: 'badge ember' }, 'Sen') : null,
          h('span', null, timeAgo(q.createdAt)),
          solved ? h('span', { class: 'badge gold' }, icon('check', { size: 12, stroke: 2.4 }), 'Çözüldü') : null,
        ),
      ),
      h('div', { class: 'qa-row-ans', 'aria-hidden': 'true' },
        h('strong', { class: 'num' }, fmtNum(n)),
        h('span', null, n ? 'cevap' : 'cevapsız'),
      ),
    );
  }

  const ideas = shuffle(IDEAS).slice(0, 4); // bağlama başına bir kez (yeniden çizimde karışmasın)
  function firstCard() {
    return h('li', { class: 'qa-first' },
      h('span', { class: 'qa-first-glyph', 'aria-hidden': 'true' }, '?'),
      h('span', { class: 'eyebrow' }, 'Meclis henüz sessiz'),
      h('h3', { class: 'h2' }, 'İlk soruyu ', h('em', null, 'sen'), ' sor'),
      h('p', { class: 'muted' }, 'Bir fikre dokun, form senin için dolsun ya da kendi sorunu yaz. İlk soru, meclisin ilk ward’ıdır.'),
      h('div', { class: 'qa-ideas' },
        ideas.map((t, i) => h('button', { class: 'qa-idea', type: 'button', dataset: { focusKey: 'idea:' + i }, onclick: () => fillAsk(t) }, icon('arrowRight', { size: 16 }), h('span', null, t))),
      ),
      h('p', { class: 'xsmall dim' }, 'Bu örnekler kaydedilmez; yalnızca formu doldurur.'),
    );
  }

  function renderList() {
    if (!built.sorular) return;
    const { list, status, more } = built;
    keepFocus(list, () => {
      clear(list);
      more.hidden = true;
      if (state.questions == null) {
        status.textContent = state.listError ? '' : 'Meclis toplanıyor…';
        if (state.listError) {
          list.appendChild(h('li', { class: 'empty small' }, 'Sorular şu an yüklenemiyor. Biraz sonra tekrar dene.'));
          return;
        }
        for (let i = 0; i < 3; i++) list.appendChild(h('li', { class: 'qa-row qa-skel', 'aria-hidden': 'true' }, h('span', { class: 'skeleton' }), h('span', { class: 'skeleton' }), h('span', { class: 'skeleton' })));
        return;
      }
      if (!state.questions.length) {
        status.textContent = '';
        list.appendChild(firstCard());
        return;
      }
      const qs = sortedFiltered();
      const q = cleanText(state.query, 40);
      if (!qs.length) {
        status.textContent = '';
        list.appendChild(h('li', { class: 'empty' },
          icon(q ? 'target' : 'check', { size: 28 }),
          h('p', null, q ? `“${q}” için bir şey bulunamadı.` : 'Cevapsız soru kalmadı. Meclis işini yapmış!'),
          h('p', { class: 'xsmall' }, q ? 'Başka bir kelime dene ya da bu soruyu sen sor.' : 'Yeni bir soru sorarak meclisi yeniden uyandırabilirsin.'),
        ));
        return;
      }
      const label = state.sort === 'open' ? 'cevapsız soru' : 'soru';
      status.textContent = q ? `“${q}” için ${fmtNum(qs.length)} ${label}` : `${fmtNum(qs.length)}${state.questions.length >= Q_LIMIT && state.sort !== 'open' ? '+' : ''} ${label}`;
      for (const item of qs.slice(0, state.shown)) list.appendChild(questionRow(item));
      if (qs.length > state.shown) {
        more.hidden = false;
        more.textContent = `Daha fazla göster (${fmtNum(qs.length - state.shown)} soru daha)`;
      }
    });
  }

  // -------------------------------------------------------------- SORULAR: detay
  let detail = null; // { id, unsub, nodes..., answers, doc, seen, fetched }

  function openDetail(id) {
    if (!built.sorular) buildSorular();
    if (detail && detail.id === id) return;
    closeDetail({ restore: false });
    const d = { id, answers: null, doc: findQ(id), seen: !!findQ(id), fetched: false, error: false };
    detail = d;
    state.detailId = id;

    const back = h('button', { class: 'btn ghost sm qa-back', type: 'button' }, icon('arrowLeft', { size: 16 }), 'Tüm sorular');
    back.addEventListener('click', () => { sound.click(); ctx.setSub('sorular'); show('sorular'); });
    const qBox = h('div', { class: 'qa-qbox' });
    const ansHead = h('h3', { class: 'h3 qa-ans-head', id: 'qa-ans-h' }, 'Cevaplar');
    const ansList = h('ol', { class: 'qa-ans-list', 'aria-labelledby': 'qa-ans-h' });
    const sideBox = h('div', { class: 'qa-detail-side stack' });

    // Cevap formu (bir kez kurulur; yeniden çizimde yazılan metin kaybolmaz)
    const ta = h('textarea', { class: 'textarea', id: 'qa-answer-text', maxlength: String(ANSWER_MAX), rows: '4', placeholder: 'Cevabını yaz… Bilgi ver, DOG verme.' });
    const count = h('span', { class: 'counter', id: 'qa-answer-count' });
    const updCount = bindCounter(ta, count, ANSWER_MAX);
    const send = h('button', { class: 'btn primary', type: 'submit', id: 'qa-answer-submit' }, icon('send', { size: 18 }), 'Cevabı gönder');
    const note = h('p', { class: 'hint qa-note', hidden: true });
    const form = h('form', { class: 'panel qa-answer-form stack', autocomplete: 'off', 'aria-labelledby': 'qa-answer-h' },
      h('h3', { class: 'h3', id: 'qa-answer-h' }, 'Cevabın'),
      h('div', { class: 'field' },
        h('label', { for: 'qa-answer-text' }, 'Cevap metni'),
        ta,
        h('div', { class: 'qa-field-foot' }, h('span', { class: 'hint' }, 'Ctrl + Enter ile gönder'), count),
      ),
      h('div', { class: 'qa-form-foot' }, h('div', { class: 'qa-by' }, h('span', { class: 'xsmall dim' }, 'Yazan:'), nickChip()), send),
      note,
    );
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!canWrite()) { fx.toast('Bu sayfada yazma iznin yok; yalnızca okuyabilirsin.', 'blood'); return; }
      const text = softFilter(cleanMulti(ta.value, ANSWER_MAX));
      if (text.length < 3) { fx.toast('Biraz daha yaz; bu kadarı ward bile değil.', 'blood'); fx.shake(ta); ta.focus(); return; }
      const wait = POST_GAP_MS - (Date.now() - lastAnswerAt);
      if (wait > 0) { fx.toast(`Biraz yavaş: ${Math.ceil(wait / 1000)} sn sonra tekrar cevapla.`, 'blood'); return; }
      send.disabled = true;
      try {
        await store.add('answers', { qid: id, text });
        lastAnswerAt = Date.now();
        ta.value = '';
        updCount();
        sound.good();
        fx.toast('Cevabın meclise eklendi.', 'jade');
      } catch (err) {
        console.error(err);
        fx.toast('Cevap gönderilemedi. Bağlantını kontrol edip tekrar dene.', 'blood');
      } finally {
        send.disabled = !canWrite();
      }
    });

    const view = h('div', { class: 'qa-detail' },
      h('div', { class: 'qa-detail-main stack' }, back, qBox, ansHead, ansList, form),
      sideBox,
    );
    clear(built.detailView).appendChild(view);
    Object.assign(d, { qBox, ansHead, ansList, sideBox, form, ta, send, note });

    d.unsub = store.subscribe('answers', { where: ['qid', id], orderBy: 'createdAt', dir: 'asc', limit: 200 },
      (docs) => { if (detail !== d) return; d.answers = docs; renderDetail(); },
      () => { if (detail !== d) return; d.error = true; renderDetail(); });
    if (!d.doc) {
      store.get('questions', id)
        .then((doc) => { if (detail !== d) return; d.fetched = true; if (doc && !d.doc) d.doc = doc; renderDetail(); })
        .catch(() => { if (detail !== d) return; d.fetched = true; renderDetail(); });
    }

    built.listView.hidden = true;
    built.detailView.hidden = false;
    applyWriteState();
    renderDetail();
  }

  function closeDetail({ restore = true } = {}) {
    if (!detail) {
      if (built.sorular) { built.listView.hidden = false; built.detailView.hidden = true; }
      return;
    }
    if (detail.unsub) detail.unsub();
    detail = null;
    state.detailId = null;
    if (built.sorular) {
      clear(built.detailView);
      built.detailView.hidden = true;
      built.listView.hidden = false;
      renderList();
      if (restore) window.scrollTo({ top: state.listScroll || 0, behavior: 'instant' });
    }
  }

  function currentQ() {
    if (!detail) return null;
    const fromList = findQ(detail.id);
    if (fromList) { detail.doc = fromList; detail.seen = true; }
    else if (detail.seen && state.questions) { detail.doc = null; detail.fetched = true; } // listeden düştü → silindi
    let q = detail.doc;
    if (!q) return null;
    if (pendingAccept.has(q.id)) {
      const v = pendingAccept.get(q.id);
      if ((q.acceptedId || null) === v) pendingAccept.delete(q.id);
      else q = { ...q, acceptedId: v };
    }
    return q;
  }

  async function setAccepted(q, aid, originEl) {
    pendingAccept.set(q.id, aid);
    renderDetail();
    try {
      await store.update('questions', q.id, { acceptedId: aid });
      if (aid) {
        sound.coin();
        const r = originEl && originEl.isConnected ? originEl.getBoundingClientRect() : null;
        if (r) fx.confetti(r.left + r.width / 2, r.top + r.height / 2, 70);
        fx.toast('Cevap kabul edildi: altın çerçeve takıldı.', 'jade');
      } else {
        fx.toast('Kabul geri alındı.');
      }
    } catch (err) {
      console.error(err);
      pendingAccept.delete(q.id);
      renderDetail();
      fx.toast('Kabul işaretlenemedi. Tekrar dene.', 'blood');
    }
  }

  async function deleteQuestion(q) {
    const ok = await fx.confirm('Bu soru ve cevapları silinsin mi?', { ok: 'Sil', danger: true });
    if (!ok) return;
    const answers = (detail && detail.id === q.id && detail.answers) || [];
    try {
      await store.remove('questions', q.id);
    } catch (err) {
      console.error(err);
      fx.toast('Soru silinemedi.', 'blood');
      return;
    }
    for (const a of answers) {
      try { await store.remove('answers', a.id); } catch { /* başkasının cevabı silinemeyebilir */ }
    }
    fx.toast('Soru silindi.');
    if (alive && detail && detail.id === q.id) { ctx.setSub('sorular'); show('sorular'); }
  }

  async function deleteAnswer(q, a) {
    const ok = await fx.confirm('Bu cevap silinsin mi?', { ok: 'Sil', danger: true });
    if (!ok) return;
    try {
      await store.remove('answers', a.id);
      fx.toast('Cevap silindi.');
    } catch (err) {
      console.error(err);
      fx.toast('Cevap silinemedi.', 'blood');
      return;
    }
    if (q.acceptedId === a.id && (isMine(q) || store.isModerator())) {
      try { await store.update('questions', q.id, { acceptedId: null }); } catch { /* yok say */ }
    }
  }

  function answerItem(q, a, idx) {
    const accepted = q.acceptedId === a.id;
    const owner = isMine(q);
    const canDel = isMine(a) || store.isModerator();
    let acceptBtn = null;
    if (owner) {
      acceptBtn = accepted
        ? h('button', { class: 'btn ghost sm', type: 'button', dataset: { focusKey: 'acc:' + a.id } }, icon('cross', { size: 14 }), 'Kabulü geri al')
        : h('button', { class: 'btn gold sm', type: 'button', dataset: { focusKey: 'acc:' + a.id } }, icon('check', { size: 14, stroke: 2.4 }), 'Kabul et');
      acceptBtn.addEventListener('click', () => setAccepted(q, accepted ? null : a.id, acceptBtn));
    }
    const delBtn = canDel
      ? h('button', { class: 'qa-del', type: 'button', 'aria-label': 'Cevabı sil', title: 'Sil', dataset: { focusKey: 'del:' + a.id } }, icon('trash', { size: 15 }))
      : null;
    if (delBtn) delBtn.addEventListener('click', () => deleteAnswer(q, a));
    const isNew = fresh('a:' + a.id);
    return h('li', { class: `qa-ans${accepted ? ' is-accepted frame' : ''}${isNew ? ' is-new' : ''}`, style: isNew ? { animationDelay: `${Math.min(idx, 8) * 40}ms` } : null },
      voteBtn('a:' + a.id, { label: 'Cevaba oy ver' }),
      h('div', { class: 'qa-ans-main' },
        accepted ? h('div', { class: 'qa-ans-crown' }, icon('crown', { size: 15 }), 'Meclisin seçimi · Kabul edildi') : null,
        h('p', { class: 'qa-ans-text' }, a.text || ''),
        h('div', { class: 'qa-ans-meta' },
          h('span', { class: 'qa-nick' }, a.nick || 'Anonim'),
          a.authorId && a.authorId === q.authorId && a.authorId !== 'anon' ? h('span', { class: 'badge' }, 'Soran') : null,
          isMine(a) ? h('span', { class: 'badge ember' }, 'Sen') : null,
          h('span', null, timeAgo(a.createdAt)),
          h('span', { class: 'spacer' }),
          acceptBtn,
          delBtn,
        ),
      ),
    );
  }

  function renderDetail() {
    if (!detail) return;
    const d = detail;
    const q = currentQ();
    const { qBox, ansHead, ansList, sideBox, form } = d;

    if (!q) {
      form.hidden = true;
      ansHead.hidden = true;
      clear(ansList);
      clear(sideBox);
      clear(qBox).appendChild(
        d.fetched || d.error
          ? h('div', { class: 'empty qa-missing' },
            icon('skull', { size: 30 }),
            h('p', { class: 'h3' }, 'Bu soru bulunamadı.'),
            h('p', { class: 'small' }, 'Silinmiş ya da hiç sorulmamış olabilir. Belki de bir Techies mayınına bastı.'),
          )
          : h('div', { class: 'panel qa-q-skel', 'aria-busy': 'true' }, h('span', { class: 'skeleton' }), h('span', { class: 'skeleton' }), h('span', { class: 'skeleton' })),
      );
      return;
    }
    form.hidden = false;
    ansHead.hidden = false;

    const answers = (d.answers || []).slice();
    const acceptedAns = q.acceptedId ? answers.find((a) => a.id === q.acceptedId) : null;
    const solved = !!acceptedAns;
    const ordered = acceptedAns ? [acceptedAns, ...answers.filter((a) => a !== acceptedAns)] : answers;
    const canDelQ = isMine(q) || store.isModerator();
    const votes = voteCount('q:' + q.id);

    // Soru kartı
    keepFocus(qBox, () => {
      const delBtn = canDelQ
        ? h('button', { class: 'btn ghost sm qa-danger', type: 'button', dataset: { focusKey: 'delq' } }, icon('trash', { size: 15 }), 'Soruyu sil')
        : null;
      if (delBtn) delBtn.addEventListener('click', () => deleteQuestion(q));
      const writeBtn = h('button', { class: 'btn ghost sm', type: 'button', dataset: { focusKey: 'write' } }, icon('chat', { size: 15 }), 'Cevap yaz');
      writeBtn.addEventListener('click', () => { scrollToEl(form); d.ta.focus({ preventScroll: true }); });
      const title = h('h2', { class: 'qa-q-title', tabindex: '-1', id: 'qa-q-title', dataset: { focusKey: 'qtitle' } }, q.title || 'Başlıksız soru');
      clear(qBox).appendChild(
        h('article', { class: `panel raised qa-q${solved ? ' is-solved' : ''}${fresh('card:' + q.id) ? ' is-new' : ''}`, 'aria-labelledby': 'qa-q-title' },
          voteBtn('q:' + q.id, { label: 'Soruya oy ver', lg: true }),
          h('div', { class: 'qa-q-main' },
            h('div', { class: 'qa-q-tags' },
              solved ? h('span', { class: 'badge gold' }, icon('check', { size: 12, stroke: 2.4 }), 'Çözüldü') : h('span', { class: 'badge ember' }, 'Açık soru'),
              isMine(q) ? h('span', { class: 'badge' }, 'Senin sorun') : null,
            ),
            title,
            q.body ? h('p', { class: 'qa-q-body' }, q.body) : null,
            h('div', { class: 'qa-q-meta' },
              h('span', null, 'Soran: ', h('span', { class: 'qa-nick' }, q.nick || 'Anonim')),
              h('span', null, timeAgo(q.createdAt)),
            ),
            h('div', { class: 'qa-q-actions' }, writeBtn, delBtn),
          ),
        ),
      );
    });

    // Cevaplar
    ansHead.textContent = d.answers == null ? 'Cevaplar yükleniyor…' : answers.length ? `${fmtNum(answers.length)} cevap` : 'Henüz cevap yok';
    keepFocus(ansList, () => {
      clear(ansList);
      if (d.answers == null) {
        if (d.error) ansList.appendChild(h('li', { class: 'empty small' }, 'Cevaplar şu an yüklenemiyor.'));
        return;
      }
      if (!answers.length) {
        ansList.appendChild(h('li', { class: 'empty qa-noans' },
          icon('ward', { size: 28 }),
          h('p', null, 'Bu soruya henüz kimse ward koymadı.'),
          h('p', { class: 'xsmall' }, 'İlk cevabı sen yaz; soru sahibi beğenirse altın çerçeveyi kaparsın.'),
        ));
        return;
      }
      ordered.forEach((a, i) => ansList.appendChild(answerItem(q, a, i)));
    });

    // Yan panel
    keepFocus(sideBox, () => clear(sideBox).append(
      h('section', { class: 'panel qa-card', 'aria-label': 'Soru kartı' },
        h('span', { class: 'eyebrow' }, 'Soru kartı'),
        h('div', { class: 'qa-card-stats' },
          h('div', null, h('span', { class: 'num' }, fmtNum(votes)), h('span', null, 'oy')),
          h('div', null, h('span', { class: 'num' }, fmtNum(answers.length)), h('span', null, 'cevap')),
          h('div', { class: solved ? 'is-gold' : 'is-ember' }, icon(solved ? 'crown' : 'hourglass', { size: 20 }), h('span', null, solved ? 'çözüldü' : 'açık')),
        ),
        h('div', { class: 'statbar' },
          h('span', { class: 'xsmall dim' }, 'Meclis ilgisi'),
          h('span', { class: 'track' }, h('span', { class: `fill${solved ? ' gold' : ''}`, style: { width: `${Math.min(100, 12 + answers.length * 18 + votes * 8)}%` } })),
          h('span', { class: 'val' }, solved ? '★' : ''),
        ),
        h('p', { class: 'xsmall dim' }, isMine(q)
          ? 'Bu senin sorun: en iyi cevabı “Kabul et” ile işaretle.'
          : 'Yalnızca soruyu soran kişi bir cevabı kabul edebilir.'),
      ),
      h('section', { class: 'qa-cta' },
        h('span', { class: 'qa-cta-orb', 'aria-hidden': 'true' }),
        h('div', { class: 'stack qa-cta-text' },
          h('span', { class: 'eyebrow' }, 'İkinci görüş'),
          h('p', { class: 'small muted' }, 'Bu soruyu kadim DOG Kâhini’ne de sor; hükmü anında gelsin.'),
          h('button', { class: 'btn ghost sm', type: 'button', dataset: { focusKey: 'ask-oracle' }, onclick: () => { sound.click(); ctx.setSub('kahin'); show('kahin'); oracleAsk(q.title || ''); } }, icon('eye', { size: 16 }), 'Kâhin’e sor'),
        ),
      ),
    ));
  }

  // -------------------------------------------------------------- KÂHİN
  function buildKahin() {
    const panel = panels.get('kahin');
    if (!oracleSession.oracle) {
      // Kahraman DOG Endeksi verisi varsa kâhin kahraman adlarını da tanır
      const heroes = Array.isArray(heroData.HEROES) ? heroData.HEROES : null;
      oracleSession.oracle = createOracle({ heroes });
    }

    const face = h('span', { class: 'qa-orb-face', 'aria-hidden': 'true' }, '?');
    const stoneUrl = artUrl('texture-arena'); // fal.ai taş dokusu (yoksa CSS degradesi)
    const motes = Array.from({ length: 7 }, (_, i) => h('span', { class: 'qa-mote', style: { '--i': String(i) } }));
    const rig = h('div', { class: 'qa-orb-rig' },
      h('div', {
        class: 'qa-ring',
        'aria-hidden': 'true',
        html: '<svg viewBox="0 0 200 200" focusable="false"><defs><path id="qa-ring-path" d="M100,100 m-86,0 a86,86 0 1,1 172,0 a86,86 0 1,1 -172,0"/></defs>'
          + '<circle cx="100" cy="100" r="97" class="qa-ring-line"/><circle cx="100" cy="100" r="76" class="qa-ring-line thin"/>'
          + '<text class="qa-ring-text"><textPath href="#qa-ring-path" textLength="536" lengthAdjust="spacing">DOG ✦ DOG DEĞİL ✦ YARI DOG ✦ SİS ✦ DOG DOG DOG ✦ KADİM ORMAN ✦</textPath></text></svg>',
      }),
      h('div', { class: 'qa-ring-ticks', 'aria-hidden': 'true' }),
      h('div', { class: 'qa-orb' },
        h('span', { class: 'qa-orb-swirl' }),
        h('span', { class: 'qa-orb-swirl b' }),
        face,
        h('span', { class: 'qa-orb-glint' }),
      ),
      motes,
    );
    const stage = h('div', { class: `qa-orb-stage${reduced ? ' is-still' : ''}`, dataset: { state: 'idle' } },
      rig,
      h('div', { class: 'qa-orb-base', 'aria-hidden': 'true', style: stoneUrl ? { '--qa-stone': `url("${stoneUrl}")` } : null }),
    );
    const scene = h('section', { class: 'panel qa-scene', 'aria-label': 'Kâhin küresi' },
      stage,
      h('div', { class: 'stack qa-scene-text' },
        h('span', { class: 'eyebrow' }, 'Radiant ormanının kadim ruhu'),
        h('h2', { class: 'h2' }, 'DOG ', h('em', null, 'Kâhini')),
        h('p', { class: 'small muted' }, 'Binlerce maç gördü, tek bir teraziyle tartar: DOG mu, değil mi? Kahraman, eşya, maraton… ne sorarsan.'),
        h('p', { class: 'xsmall dim' }, 'Yerel bir sihirli küredir; yapay zekâ değildir. Kehanetler hazır bir havuzdan gelir, ciddiye alma.'),
      ),
    );

    const log = h('ol', { class: 'qa-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Kehanet defteri', tabindex: '0' });
    const input = h('input', { class: 'input', id: 'qa-oracle-input', maxlength: String(ORACLE_MAX), placeholder: 'Örn: Pudge hook tutar mı?', autocomplete: 'off', enterkeyhint: 'send' });
    const sendBtn = h('button', { class: 'btn primary', type: 'submit', id: 'qa-oracle-send' }, icon('sparkle', { size: 18 }), h('span', { class: 'qa-send-label' }, 'Kâhin’e sor'));
    const form = h('form', { class: 'qa-oracle-form', autocomplete: 'off' },
      h('label', { class: 'sr-only', for: 'qa-oracle-input' }, 'Kâhin’e sorun'),
      input,
      sendBtn,
    );
    const fixed = h('input', { type: 'checkbox', id: 'qa-oracle-fixed', class: 'qa-switch-input', checked: oracleSession.fixed });
    fixed.addEventListener('change', () => { oracleSession.fixed = fixed.checked; sound.tick(); });
    const count = h('span', { class: 'badge num' }, '0');
    const clearBtn = h('button', { class: 'btn ghost sm', type: 'button' }, icon('refresh', { size: 15 }), 'Temizle');
    const chips = h('div', { class: 'qa-oracle-chips', role: 'group', 'aria-label': 'Örnek sorular' },
      shuffle(ORACLE_EXAMPLES).slice(0, 6).map((t) => h('button', { class: 'chip', type: 'button', onclick: () => ask(t, false) }, t)),
    );
    const chat = h('section', { class: 'panel raised qa-chat', 'aria-labelledby': 'qa-chat-h' },
      h('div', { class: 'panel-head' },
        h('h3', { class: 'h3 row qa-chat-title', id: 'qa-chat-h' }, icon('eye', { size: 18 }), 'Kehanet defteri ', count),
        clearBtn,
      ),
      log,
      form,
      chips,
      h('div', { class: 'qa-switch' },
        fixed,
        h('label', { for: 'qa-oracle-fixed' },
          h('span', { class: 'qa-switch-track', 'aria-hidden': 'true' }),
          h('span', null, h('strong', null, 'Sabit kader'), h('span', { class: 'xsmall dim' }, ' · aynı soru hep aynı kehaneti alır')),
        ),
      ),
    );

    panel.appendChild(h('div', { class: 'qa-oracle' }, scene, chat));

    let busy = false;
    let pending = null;

    const intro = () => h('li', { class: 'qa-msg oracle qa-tone-arcane' },
      h('span', { class: 'qa-avatar', 'aria-hidden': 'true' }, icon('eye', { size: 16 })),
      h('div', { class: 'qa-bubble' },
        h('p', null, 'Ben Radiant ormanının kadim ruhuyum. Bir soru sor, gezgin; her şeyi tek bir teraziyle tartarım: DOG mu, değil mi?'),
      ),
    );

    function bubble(m) {
      if (m.who === 'me') {
        return h('li', { class: 'qa-msg me' },
          h('div', { class: 'qa-bubble' }, h('span', { class: 'sr-only' }, 'Sen: '), m.text),
        );
      }
      const tone = TONES.includes(m.tone) ? m.tone : 'arcane';
      return h('li', { class: `qa-msg oracle qa-tone-${tone}` },
        h('span', { class: 'qa-avatar', 'aria-hidden': 'true' }, icon('eye', { size: 16 })),
        h('div', { class: 'qa-bubble' },
          m.verdictLabel ? h('span', { class: 'qa-verdict' }, 'Hüküm: ', h('strong', null, m.verdictLabel)) : h('span', { class: 'sr-only' }, 'Kâhin: '),
          h('p', null, m.text),
          m.topicLabel || m.hero
            ? h('div', { class: 'qa-msg-foot' },
              // Kahraman bağlantısı kahramanın adını zaten taşıyorsa konu etiketini tekrar yazma
              m.topicLabel && !(m.hero && heroOf(m) && heroOf(m).name === m.topicLabel)
                ? h('span', { class: 'qa-topic' }, icon('target', { size: 12 }), m.topicLabel) : null,
              m.hero ? heroLink(m) : null,
            )
            : null,
        ),
      );
    }

    /** Tanınan kahramanın endeks sayfasına (#kahramanlar--<Dota iç adı>) ya da genel endekse bağlantı. */
    function heroOf(m) {
      return m.heroId && typeof heroData.heroById === 'function' ? heroData.heroById(m.heroId) : null;
    }
    function heroLink(m) {
      const hero = heroOf(m);
      return h('a', { class: 'qa-hero-link', href: hero ? `#kahramanlar--${hero.id}` : '#kahramanlar' },
        icon('swords', { size: 13 }),
        hero ? `${hero.name} · Kahraman DOG Endeksi` : 'Kahraman DOG Endeksi’ne bak');
    }

    function scrollLog() { log.scrollTop = log.scrollHeight; }

    function setOrb(st, tone, label, reveal) {
      stage.dataset.state = st;
      for (const t of TONES) stage.classList.remove('qa-tone-' + t);
      stage.classList.add('qa-tone-' + (tone || 'arcane'));
      face.textContent = label;
      face.classList.toggle('is-long', label.length > 6);
      if (reveal && !reduced) {
        face.classList.remove('is-reveal');
        stage.classList.remove('is-flare');
        void face.offsetWidth;
        face.classList.add('is-reveal');
        stage.classList.add('is-flare');
      }
    }

    function renderLog() {
      clear(log);
      if (!oracleSession.history.length) log.appendChild(intro());
      for (const m of oracleSession.history) log.appendChild(bubble(m));
      count.textContent = fmtNum(oracleSession.history.filter((m) => m.who === 'oracle').length);
      scrollLog();
    }

    function finish(r) {
      oracleSession.history.push({ who: 'oracle', text: r.text, verdictLabel: r.verdictLabel, tone: r.tone, topicLabel: r.topicLabel, hero: !!r.hero, heroId: r.heroId || null });
      if (oracleSession.history.length > 80) oracleSession.history.splice(0, oracleSession.history.length - 80);
    }

    function ask(raw, fromInput) {
      if (busy) return;
      const text = cleanText(raw, ORACLE_MAX);
      if (text.replace(/\s/g, '').length < 2) {
        fx.toast('Kâhin sessizliği tartamaz. Bir soru yaz.', 'blood');
        fx.shake(input);
        input.focus();
        return;
      }
      busy = true;
      sendBtn.disabled = true;
      input.value = '';
      if (!oracleSession.history.length) clear(log);
      oracleSession.history.push({ who: 'me', text });
      log.appendChild(bubble({ who: 'me', text }));
      const typing = h('li', { class: 'qa-msg oracle is-typing qa-tone-arcane' },
        h('span', { class: 'qa-avatar', 'aria-hidden': 'true' }, icon('eye', { size: 16 })),
        h('div', { class: 'qa-bubble' }, h('span', { class: 'qa-dots', 'aria-hidden': 'true' }, h('span'), h('span'), h('span')), h('span', { class: 'sr-only' }, 'Kâhin küreye bakıyor…')),
      );
      log.appendChild(typing);
      scrollLog();
      sound.tick();
      setOrb('thinking', 'arcane', '…', false);

      const r = oracleSession.oracle.ask(text, { fixed: oracleSession.fixed });
      pending = r;
      const delay = reduced ? 260 : 700 + Math.min(500, r.text.length * 3);
      if (!reduced) {
        later(() => sound.tick(), 260);
        later(() => sound.tick(), 520);
      }
      later(() => {
        pending = null;
        typing.remove();
        finish(r);
        const m = oracleSession.history[oracleSession.history.length - 1];
        log.appendChild(bubble(m));
        count.textContent = fmtNum(oracleSession.history.filter((x) => x.who === 'oracle').length);
        scrollLog();
        setOrb('answer', r.tone, r.verdictLabel || '?', true);
        switch (r.verdict) {
          case 'U': sound.dogdogdog(); fx.stamp('DOG DOG DOG'); break;
          case 'D': sound.bark(0.8); break;
          case 'Y': sound.bark(1.3); break;
          case 'N': sound.good(); break;
          case 'S': sound.whoosh(); break;
          default: sound.tick();
        }
        busy = false;
        sendBtn.disabled = false;
        if (fromInput) input.focus({ preventScroll: true });
      }, delay);
    }

    form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value, true); });
    clearBtn.addEventListener('click', () => {
      if (busy) return;
      sound.click();
      oracleSession.history = [];
      oracleSession.oracle.reset();
      setOrb('idle', 'arcane', '?', false);
      renderLog();
    });

    const last = [...oracleSession.history].reverse().find((m) => m.who === 'oracle');
    setOrb(last ? 'answer' : 'idle', last ? last.tone : 'arcane', last ? last.verdictLabel || '?' : '?', false);
    renderLog();

    built.kahin = { ask, input, flush: () => { if (pending) { finish(pending); pending = null; } } };
  }

  function oracleAsk(text) {
    if (!built.kahin) buildKahin();
    later(() => built.kahin && built.kahin.ask(text, false), 120);
  }

  // -------------------------------------------------------------- SSS
  function para(p) {
    if (p && p.shortcuts) {
      return h('ul', { class: 'qa-keys' },
        ROUTES.filter((r) => !r.hidden).map((r) => h('li', { class: `qa-key${r.ultimate ? ' is-ult' : ''}` },
          h('span', { class: 'kbd' }, r.key),
          h('span', null, r.label),
          r.ultimate ? h('span', { class: 'badge gold' }, 'ulti') : r.item ? h('span', { class: 'badge jade' }, 'eşya') : null,
        )),
      );
    }
    const parts = Array.isArray(p) ? p : [p];
    return h('p', null, parts.map((x) => {
      if (typeof x === 'string') return x;
      if (x.a) {
        const ext = x.ext || /^https?:/i.test(x.a);
        return h('a', ext ? { href: x.a, target: '_blank', rel: 'noopener noreferrer' } : { href: x.a }, x.t || x.a);
      }
      if (x.k) return h('span', { class: 'kbd' }, x.k);
      if (x.b) return h('strong', null, x.b);
      return null;
    }));
  }

  function buildSss() {
    const panel = panels.get('sss');
    let bulk = false;
    const items = FAQ.map((f, i) => {
      const tone = TONES.includes(f.tone) ? f.tone : 'arcane';
      const d = h('details', { class: `qa-item qa-tone-${tone}`, id: `qa-faq-${f.id}` },
        h('summary', { class: 'qa-item-sum' },
          h('span', { class: 'qa-item-slot', 'aria-hidden': 'true' }, icon(f.icon, { size: 22 })),
          h('span', { class: 'qa-item-title' },
            h('span', { class: 'qa-item-tag' }, h('span', { class: 'num' }, String(i + 1).padStart(2, '0')), ' · ', f.tag),
            h('span', { class: 'qa-item-q' }, f.q),
          ),
          h('span', { class: 'qa-item-chev', 'aria-hidden': 'true' }, icon('plus', { size: 18 })),
        ),
        h('div', { class: 'qa-item-body' },
          f.a.map(para),
          f.lore ? h('p', { class: 'qa-item-lore' }, f.lore) : null,
        ),
      );
      d.addEventListener('toggle', () => {
        if (!bulk) sound.click();
        syncToggle();
      });
      return d;
    });
    const toggleAll = h('button', { class: 'btn ghost sm', type: 'button', id: 'qa-faq-toggle' });
    function syncToggle() {
      const allOpen = items.every((d) => d.open);
      clear(toggleAll).append(icon(allOpen ? 'close' : 'plus', { size: 15 }), allOpen ? 'Tümünü kapat' : 'Tümünü aç');
      toggleAll.setAttribute('aria-pressed', String(allOpen));
    }
    toggleAll.addEventListener('click', () => {
      const open = !items.every((d) => d.open);
      bulk = true;
      for (const d of items) d.open = open;
      sound.click();
      syncToggle();
      later(() => { bulk = false; }, 50);
    });
    syncToggle();

    const helpCard = (mod) => h('section', { class: `panel tight qa-faq-help ${mod} stack` },
      h('span', { class: 'eyebrow' }, 'Cevabı bulamadın mı?'),
      h('p', { class: 'small muted' }, 'Meclise sor; topluluk cevaplasın.'),
      h('button', {
        class: 'btn primary sm', type: 'button',
        onclick: () => {
          sound.click();
          ctx.setSub('sorular');
          show('sorular');
          later(() => { if (built.askPanel) { scrollToEl(built.askPanel); built.askTitle.focus({ preventScroll: true }); } }, 30);
        },
      }, icon('chat', { size: 16 }), 'Soru sor'),
    );

    const aside = h('aside', { class: 'qa-faq-aside stack' },
      h('span', { class: 'eyebrow' }, 'Eşya açıklamaları'),
      h('h2', { class: 'h2' }, 'Sık sorulan ', h('em', null, 'sorular')),
      h('p', { class: 'muted small' }, 'Sitenin, memelerin ve maratonun kısa kılavuzu. Her madde bir eşya açıklaması gibi: aç, oku, ward’ını al.'),
      h('div', { class: 'row' }, toggleAll),
      helpCard('qa-faq-help--side'),
    );
    panel.appendChild(h('div', { class: 'qa-faq' }, aside, h('div', { class: 'qa-faq-list' }, items, helpCard('qa-faq-help--end'))));
    built.sss = true;
  }

  // -------------------------------------------------------------- gezinme
  function selectTab(id) {
    const changed = state.tab !== id;
    state.tab = id;
    for (const [tid, btn] of tabBtns) {
      const on = tid === id;
      btn.setAttribute('aria-selected', String(on));
      btn.tabIndex = on ? 0 : -1;
      panels.get(tid).hidden = !on;
    }
    if (id === 'sorular' && !built.sorular) buildSorular();
    if (id === 'kahin' && !built.kahin) buildKahin();
    if (id === 'sss' && !built.sss) buildSss();
    return changed;
  }

  function show(sub) {
    let tab = 'sorular';
    let qid = null;
    if (sub === 'kahin' || sub === 'sss' || sub === 'sorular') tab = sub;
    else if (sub && sub[0] === 'q') qid = decodeQid(sub);
    const wasDetail = !!detail;
    selectTab(tab);
    if (tab !== 'sorular') return;
    if (qid) {
      const opening = !detail || detail.id !== qid;
      openDetail(qid);
      if (opening && mounted) {
        scrollToEl(tablist, 8);
        const t = built.detailView.querySelector('.qa-q-title');
        if (t) t.focus({ preventScroll: true });
      }
    } else if (wasDetail) {
      closeDetail({ restore: true });
    }
  }

  // -------------------------------------------------------------- yazma izni / önizleme notları
  function applyWriteState() {
    if (!state.ready) return;
    const writable = canWrite();
    const msg = !writable
      ? 'Bu sayfayı yalnızca görüntüleyebiliyorsun; soru ve cevap yazma izni yok.'
      : !store.shared
        ? 'Önizleme modu: sorular ve cevaplar şimdilik yalnızca bu cihazda saklanıyor.'
        : '';
    if (built.sorular) {
      built.askTitle.disabled = !writable;
      built.askBody.disabled = !writable;
      built.askSubmit.disabled = !writable;
      built.askNote.hidden = !msg;
      built.askNote.textContent = msg;
    }
    if (detail && detail.ta) {
      detail.ta.disabled = !writable;
      detail.send.disabled = !writable;
      detail.note.hidden = !msg;
      detail.note.textContent = msg;
    }
  }

  // -------------------------------------------------------------- veri
  function renderTally() {
    const qs = state.questions;
    tallyQ.textContent = qs ? fmtNum(qs.length) + (qs.length >= Q_LIMIT ? '+' : '') : '–';
    tallyA.textContent = state.answersAll ? fmtNum(state.answersAll.length) + (state.answersAll.length >= A_LIMIT ? '+' : '') : '–';
    tallyS.textContent = qs ? fmtNum(qs.filter(isSolved).length) : '–';
    tabCount.hidden = !qs || !qs.length;
    tabCount.textContent = qs ? fmtNum(qs.length) : '';
  }

  let queued = false;
  function scheduleRender() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!alive) return;
      renderTally();
      if (detail) renderDetail();
      else renderList();
    });
  }

  offs.push(store.subscribe('questions', { orderBy: 'createdAt', dir: 'desc', limit: Q_LIMIT },
    (docs) => { state.questions = docs; state.listError = false; scheduleRender(); },
    () => { state.listError = true; scheduleRender(); }));
  offs.push(store.subscribe('answers', { orderBy: 'createdAt', dir: 'desc', limit: A_LIMIT },
    (docs) => {
      state.answersAll = docs;
      state.ansCount = new Map();
      state.ansIds = new Set();
      for (const a of docs) {
        state.ansCount.set(a.qid, (state.ansCount.get(a.qid) || 0) + 1);
        state.ansIds.add(a.id);
      }
      scheduleRender();
    }));
  offs.push(store.fans((fans) => {
    const me = store.uid() || 'me';
    state.others = agg.likeCounts(fans.filter((f) => f.id !== me && f.id !== 'me'));
    scheduleRender();
  }));
  offs.push(store.me.subscribe((d) => {
    for (const l of nickLabels) {
      if (!l.isConnected) nickLabels.delete(l);
      else l.textContent = d.nick || 'Anonim';
    }
    scheduleRender();
  }));
  store.ready.then(() => {
    if (!alive) return;
    state.ready = true;
    applyWriteState();
    scheduleRender();
  });
  // Göreli zamanları ("3 dk önce") tazele
  const tick = setInterval(() => { if (alive && !document.hidden) scheduleRender(); }, 60000);

  let mounted = false;
  show(ctx.sub);
  mounted = true;

  return {
    show,
    destroy() {
      alive = false;
      clearInterval(tick);
      for (const t of timers) clearTimeout(t);
      timers.clear();
      if (built.kahin) built.kahin.flush();
      if (detail && detail.unsub) detail.unsub();
      detail = null;
      for (const off of offs) { try { off(); } catch { /* yok say */ } }
      root.remove();
    },
  };
}

let inst = null;

export default {
  mount(el, ctx) {
    inst = createQA(el, ctx);
    const mine = inst;
    return () => {
      mine.destroy();
      if (inst === mine) inst = null;
    };
  },
  onSub(sub) {
    if (inst) inst.show(sub);
  },
};
