// 1) Hangi DOG'sun? — 10 soruluk kişilik testi, sonuç kartı, topluluk dağılımı ve yorumlar.

import { h, clear, fmtNum, copyText } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { store, agg } from '../../core/store.js';
import { sound } from '../../core/sound.js';
import { fx } from '../../core/fx.js';
import { ALL_TYPES, byId, STAT_LABELS } from '../../data/archetypes.js';
import { HANGIDOG_QUESTIONS as QS, HANGIDOG_LINES } from '../../data/quizzes.js';
import { portraitEl } from '../../components/portrait.js';
import { mountComments } from '../../components/comments.js';
import { attachTilt } from '../../components/tilt.js';
import {
  makeScope, keyOk, quizBar, xpBar, optionBtn, pawMeter,
  centerOf, scrollToTop, saveLast, getLast, withMe, readOnlyNote,
} from './ui.js';

const N = QS.length;
const GOOD_STATS = new Set(['harita', 'takim']);

/** Cevaplardan tür puanları + sıralama (eşitlikte en son puan alan önce). */
export function scoreAnswers(answers) {
  const totals = {};
  const recency = {};
  for (const t of ALL_TYPES) { totals[t.id] = 0; recency[t.id] = -1; }
  answers.forEach((oi, qi) => {
    if (oi == null) return;
    const s = QS[qi].options[oi].s;
    for (const [k, v] of Object.entries(s)) {
      if (k in totals) { totals[k] += v; recency[k] = qi; }
    }
  });
  const order = ALL_TYPES.map((t, i) => ({ id: t.id, v: totals[t.id], r: recency[t.id], i }))
    // Eşitlikte efsane kaybeder: 1vDOQUZ Efsanesi yalnızca açıkça en iyi oynayanlara çıkar.
    .sort((a, b) => b.v - a.v || (a.id === 'legend') - (b.id === 'legend') || b.r - a.r || a.i - b.i);
  const sum = order.reduce((s, x) => s + x.v, 0) || 1;
  return order.map((x) => ({ id: x.id, v: x.v, pct: Math.round((x.v / sum) * 100) }));
}

export function mountHangiDog(root, { ctx, quiz, back }) {
  const scope = makeScope();
  let viewScope = makeScope();
  const view = h('div', { class: 'qz-stage' });
  root.appendChild(view);

  let answers = new Array(N).fill(null);
  let idx = 0;
  let locked = false;
  let mode = 'quiz';
  let optBtns = [];

  // ---------------------------------------------------------------- soru ekranı
  const xp = xpBar(N);
  const prevBtn = h('button', { class: 'btn ghost sm', type: 'button' }, icon('arrowLeft', { size: 16 }), 'Önceki soru');
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const cardHost = h('div', { class: 'qz-card-host' });

  prevBtn.addEventListener('click', () => {
    if (idx === 0 || locked) return;
    sound.whoosh();
    idx -= 1;
    renderQuestion(-1);
  });

  function buildQuizShell() {
    clear(view);
    const last = getLast().hangidog;
    const prev = last && byId(last.id);
    view.append(
      quizBar(quiz, back, prev
        ? h('button', { class: 'btn ghost sm qz-prev-result', type: 'button', onclick: () => { sound.click(); showResult(last.ranking, false); } },
          h('span', { class: 'qz-dot', style: { '--c': prev.color } }), 'Son sonucum: ', prev.name)
        : null),
      xp.el,
      cardHost,
      h('div', { class: 'qz-nav' },
        prevBtn,
        h('span', { class: 'qz-hint xsmall dim' }, h('span', { class: 'kbd' }, '1'), '–', h('span', { class: 'kbd' }, '4'), ' ile seç · ', h('span', { class: 'kbd' }, '⌫'), ' geri'),
      ),
      live,
    );
  }

  function renderQuestion(dir = 1) {
    mode = 'quiz';
    locked = false;
    const q = QS[idx];
    xp.set(idx, idx + 1);
    prevBtn.disabled = idx === 0;
    optBtns = q.options.map((o, i) => optionBtn(i, o.t, pick));
    if (answers[idx] != null) {
      const b = optBtns[answers[idx]];
      b.classList.add('is-chosen');
      b.setAttribute('aria-pressed', 'true');
    }
    const title = h('h2', { class: 'qz-q', tabindex: '-1', id: 'qz-q-title' }, q.q);
    const card = h('section', { class: `qz-qcard panel raised frame ${dir < 0 ? 'enter-back' : 'enter'}`, 'aria-labelledby': 'qz-q-title' },
      h('div', { class: 'qz-qhead' },
        h('span', { class: 'eyebrow' }, `Soru ${idx + 1}`),
        h('span', { class: 'qz-qhead-note xsmall dim' }, 'Dürüst ol. Rapier’ini kimse görmüyor.'),
      ),
      title,
      h('div', { class: 'qz-opts', role: 'group', 'aria-label': 'Seçenekler' }, optBtns),
    );
    cardHost.replaceChildren(card);
    title.focus({ preventScroll: true });
    live.textContent = `Soru ${idx + 1} / ${N}: ${q.q}`;
  }

  function pick(i) {
    if (mode !== 'quiz' || locked) return;
    locked = true;
    answers[idx] = i;
    sound.click();
    optBtns.forEach((b, k) => {
      b.disabled = true;
      b.classList.toggle('is-picked', k === i);
      b.classList.toggle('is-dim', k !== i);
      b.classList.remove('is-chosen');
    });
    xp.set(idx + 1, idx + 1);
    scope.timeout(() => {
      if (idx < N - 1) {
        idx += 1;
        renderQuestion(1);
      } else {
        finish();
      }
    }, 420);
  }

  // ---------------------------------------------------------------- sonuç
  function finish() {
    const ranking = scoreAnswers(answers);
    const id = ranking[0].id;
    // Kullanıcı eylemi (son cevap tıklaması) üzerine yaz
    store.me.patch((d) => { d.picks.hangidog = id; });
    saveLast('hangidog', { id, ranking: ranking.slice(0, 3) });
    showResult(ranking, true);
  }

  function showResult(ranking, fresh) {
    mode = 'result';
    viewScope.dispose();
    viewScope = makeScope();
    const arch = byId(ranking[0].id);
    const second = ranking[1] && byId(ranking[1].id);
    const third = ranking[2] && byId(ranking[2].id);
    clear(view);

    const portrait = portraitEl(arch, { cls: 'qz-res-img', alt: `${arch.name} portresi` });
    const portraitBox = h('div', { class: 'qz-res-portrait frame', style: { '--c': arch.color } },
      portrait,
      h('span', { class: `qz-res-portrait-tag${arch.id === 'legend' ? ' jade' : ''}` }, arch.id === 'legend' ? 'DOG DEĞİL' : 'DOG'),
    );
    viewScope.add(attachTilt(portraitBox, { max: 8 }));

    const copyBtn = h('button', { class: 'btn primary', type: 'button' }, icon('copy', { size: 18 }), 'Sonucu kopyala');
    const shareText = arch.id === 'legend'
      ? `Ben ${arch.name} çıktım 🏹 “${arch.tagline}” Dokuz DOG’a karşı tek başıma. Sen hangi DOG’sun? #DOGDOGDOG #1vDOQUZ`
      : `Ben ${arch.name} çıktım 🐶 “${arch.tagline}” DOG seviyem ${arch.dogLevel}/5. Sen hangi DOG’sun? #DOGDOGDOG #1vDOQUZ`;
    const shareBox = h('p', { class: 'qz-share-text xsmall dim' }, shareText);
    copyBtn.addEventListener('click', async () => {
      const ok = await copyText(shareText, shareBox);
      if (ok) { sound.coin(); fx.toast('Kopyalandı. Chat’e yapıştır, DOG’lar görsün.', 'jade'); }
      else fx.toast('Pano izni yok; metni seçtik, elle kopyalayabilirsin.', 'ember');
    });
    const againBtn = h('button', { class: 'btn ghost qz-again', type: 'button' }, icon('refresh', { size: 18 }), 'Tekrar çöz');
    againBtn.addEventListener('click', () => {
      sound.whoosh();
      answers = new Array(N).fill(null);
      idx = 0;
      viewScope.dispose();
      viewScope = makeScope();
      buildQuizShell();
      renderQuestion(1);
      scrollToTop(view);
    });
    const archiveBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => ctx.go('karakterler') }, icon('mask', { size: 18 }), 'DOG Arşivi');

    // --- Kahraman bölümü
    const hero = h('section', { class: 'qz-res-hero' },
      portraitBox,
      h('div', { class: 'qz-res-info stack' },
        h('span', { class: 'eyebrow' }, fresh ? 'Test sonucun · DOG Arşivi kaydı' : 'Son sonucun · DOG Arşivi kaydı'),
        h('h2', { class: 'qz-res-name', style: { '--c': arch.color } }, arch.name),
        h('p', { class: 'qz-res-title lore' }, arch.title),
        h('p', { class: 'qz-res-tagline' }, `“${arch.tagline}”`),
        h('div', { class: 'qz-res-level' },
          h('span', { class: 'qz-res-level-lbl' }, 'DOG seviyesi'),
          pawMeter(arch.dogLevel),
          h('span', { class: 'num small muted' }, arch.dogLevel ? `${arch.dogLevel}/5` : '0/5 · saf efsane'),
        ),
        h('p', { class: 'muted' }, arch.description),
        h('p', { class: 'qz-res-line' }, icon('sparkle', { size: 18 }), HANGIDOG_LINES[arch.id] || ''),
        h('div', { class: 'row' }, copyBtn, againBtn, archiveBtn),
        shareBox,
        readOnlyNote(),
      ),
    );

    // --- İstatistikler
    const stats = h('section', { class: 'panel qz-res-panel' },
      h('h3', { class: 'qz-panel-title' }, icon('bolt', { size: 18 }), 'DOG-metre'),
      h('div', { class: 'stack qz-stats' },
        Object.entries(STAT_LABELS).map(([k, label]) => {
          const v = arch.stats[k] ?? 0;
          return h('div', { class: 'statbar' },
            h('span', null, label, GOOD_STATS.has(k) ? h('span', { class: 'xsmall dim' }, ' (iyi)') : null),
            h('span', { class: 'track' }, h('span', { class: `fill${GOOD_STATS.has(k) ? ' jade' : ''}`, style: { width: `${v}%` } })),
            h('span', { class: 'val' }, String(v)),
          );
        }),
      ),
    );

    // --- Saha rehberi
    const guide = h('section', { class: 'panel qz-res-panel' },
      h('h3', { class: 'qz-panel-title' }, icon('eye', { size: 18 }), 'Saha rehberi'),
      h('dl', { class: 'qz-guide' },
        h('dt', null, 'Habitat'), h('dd', null, arch.habitat),
        h('dt', null, 'İmza hareket'), h('dd', null, arch.signature),
        h('dt', null, 'Nasıl anlaşılır'),
        h('dd', null, h('ul', { class: 'qz-spot' }, arch.spotting.map((s) => h('li', null, s)))),
        h('dt', null, 'Karşı taktik'), h('dd', null, arch.counter),
      ),
      h('p', { class: 'qz-quote' }, arch.chatQuote),
    );

    // --- DOG DNA (ilk üç)
    const dna = h('section', { class: 'panel qz-res-panel' },
      h('h3', { class: 'qz-panel-title' }, icon('dice', { size: 18 }), 'DOG DNA’n'),
      h('p', { class: 'xsmall dim' }, 'Cevaplarının türlere dağılımı. Kimse tek bir DOG değildir.'),
      h('ol', { class: 'qz-dna' },
        [arch, second, third].filter(Boolean).map((a, i) => {
          const r = ranking[i];
          return h('li', { class: `qz-dna-row${i === 0 ? ' top' : ''}`, style: { '--c': a.color } },
            portraitEl(a, { cls: 'qz-dna-img', alt: '' }),
            h('span', { class: 'qz-dna-body' },
              h('span', { class: 'qz-dna-name' }, i === 0 ? 'Sonucun: ' : i === 1 ? 'Yakın akraba: ' : 'Uzak kuzen: ', h('b', null, a.name)),
              h('span', { class: 'qz-dna-bar' }, h('span', { style: { width: `${Math.max(4, r.pct)}%` } })),
            ),
            h('span', { class: 'qz-dna-pct num' }, `%${r.pct}`),
          );
        }),
      ),
    );

    // --- Topluluk dağılımı
    const distList = h('ol', { class: 'qz-dist', 'aria-label': 'Topluluk dağılımı' });
    const distMeta = h('p', { class: 'xsmall dim' }, 'Yükleniyor…');
    const community = h('section', { class: 'panel qz-res-panel' },
      h('h3', { class: 'qz-panel-title' }, icon('paw', { size: 18 }), 'Topluluk sürüsü'),
      distMeta,
      distList,
    );
    const paintDist = (fans) => {
      const dist = agg.distribution(withMe(fans), 'hangidog');
      const total = Object.values(dist).reduce((s, v) => s + v, 0) || 1;
      const mine = store.me.get().picks.hangidog || arch.id;
      const rows = ALL_TYPES.map((a, i) => ({ a, n: dist[a.id] || 0, i }))
        .sort((x, y) => y.n - x.n || x.i - y.i);
      const max = Math.max(1, ...rows.map((r) => r.n));
      distList.replaceChildren(...rows.map(({ a, n }) => {
        const pct = Math.round((n / total) * 100);
        const me = a.id === mine;
        return h('li', { class: `qz-dist-row${me ? ' is-me' : ''}${n ? '' : ' is-zero'}`, style: { '--c': a.color }, title: `${a.name}: ${fmtNum(n)} kişi (%${pct})` },
          h('span', { class: 'qz-dist-name' }, h('span', { class: 'qz-dot' }), a.name, me ? h('span', { class: 'badge ember' }, 'Sen') : null),
          h('span', { class: 'qz-dist-track' }, h('span', { class: 'qz-dist-fill', style: { width: `${(n / max) * 100}%` } })),
          h('span', { class: 'qz-dist-val num' }, `%${pct}`, h('span', { class: 'dim' }, ` · ${fmtNum(n)}`)),
        );
      }));
      const same = dist[mine] || 0;
      distMeta.textContent = total <= 1
        ? 'Şimdilik sürüde yalnızsın. Linki paylaş, sürü büyüsün.'
        : `${fmtNum(total)} kişi test çözdü. ${same > 1 ? `Senin gibi ${fmtNum(same - 1)} kişi daha ${byId(mine).name}.` : 'Türünde ilksin.'}`;
    };
    viewScope.add(store.fans(paintDist));

    const commentsHost = h('section', { class: 'panel qz-res-panel' });
    viewScope.add(mountComments(commentsHost, { threadId: 'quiz:hangidog', title: 'Sonuç yorumları', compact: true, placeholder: 'Hangi DOG çıktın? İtirazın var mı?' }));

    view.append(
      quizBar(quiz, back),
      hero,
      h('div', { class: 'qz-res-grid' }, stats, guide, dna),
      h('div', { class: 'qz-res-grid two' }, community, commentsHost),
    );

    scrollToTop(view);
    if (fresh) {
      sound.win();
      scope.timeout(() => {
        const c = centerOf(portraitBox);
        fx.confetti(c.x, c.y, arch.id === 'legend' ? 140 : 90);
      }, 180);
    }
    copyBtn.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------- klavye
  scope.on(window, 'keydown', (e) => {
    if (!keyOk(e) || mode !== 'quiz') return;
    if (/^[1-4]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      if (optBtns[i] && !locked) { e.preventDefault(); optBtns[i].click(); }
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      prevBtn.click();
    }
  });

  buildQuizShell();
  renderQuestion(1);

  return () => {
    viewScope.dispose();
    scope.dispose();
    view.remove();
  };
}
