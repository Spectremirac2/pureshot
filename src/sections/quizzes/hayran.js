// 4) Gerçek Hayran Testi — yalnızca kullanıcının verdiği bilgiler + sitenin kendi içeriği. 12 soru, kademeli unvan.

import { h, clear, shuffle } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { store } from '../../core/store.js';
import { sound } from '../../core/sound.js';
import { fx } from '../../core/fx.js';
import { HAYRAN_QUESTIONS, HAYRAN_TIERS, tierFor } from '../../data/quizzes.js';
import { makeScope, quizBar, centerOf, scrollToTop, saveLast } from './ui.js';
import { runMC, prepQuestion, answerKey } from './mc.js';

const TIER_ICONS = ['chat', 'laugh', 'hourglass', 'bow'];

export function mountHayran(root, { quiz, back }) {
  let sub = null;
  const view = h('div', { class: 'qz-stage' });
  root.appendChild(view);
  const setSub = (fn) => { if (sub) sub(); sub = fn; };

  function start() {
    const qs = shuffle(HAYRAN_QUESTIONS).map(prepQuestion);
    setSub(runMC(view, {
      quiz,
      back,
      questions: qs,
      timer: 0,
      scoreFor: (ok) => (ok ? 1 : 0),
      chipLabel: 'Doğru',
      chipValue: (rs, total) => `${rs.filter((r) => r.ok).length}/${total}`,
      eyebrowNote: 'Chat seni izliyor.',
      onFinish: finish,
    }));
  }

  function finish(results) {
    const s = makeScope();
    setSub(() => s.dispose());
    const total = results.length;
    const correct = results.filter((r) => r.ok).length;
    const tier = tierFor(HAYRAN_TIERS, correct);
    // Kullanıcı eylemi ("Sonuçları gör") üzerine yaz
    const record = store.me.submitScore('hayran', correct);
    saveLast('hayran', { correct, total, title: tier.title });

    clear(view);
    const ladderTiers = HAYRAN_TIERS.slice().reverse(); // artan sıra
    const myRank = ladderTiers.indexOf(tier);
    const ladder = h('ol', { class: 'qz-ladder', 'aria-label': 'Hayran kademeleri' },
      ladderTiers.map((t, i) => h('li', { class: `qz-rung${i === myRank ? ' is-me' : ''}${i < myRank ? ' is-past' : ''} tone-${t.tone}` },
        h('span', { class: 'qz-rung-medal', 'aria-hidden': 'true' }, icon(TIER_ICONS[i] || 'star', { size: 22 })),
        h('span', { class: 'qz-rung-name' }, t.title),
        h('span', { class: 'qz-rung-min num xsmall' }, i === ladderTiers.length - 1 ? `${t.min}/${total}` : `${t.min}+`),
      )),
    );

    const bigEl = h('span', { class: 'qz-big num' }, `${correct}`);
    const again = h('button', { class: 'btn primary', type: 'button', onclick: () => { sound.whoosh(); start(); scrollToTop(view); } }, icon('refresh', { size: 18 }), 'Tekrar çöz');

    view.append(
      quizBar(quiz, back),
      h('section', { class: `panel raised frame qz-scorecard qz-hayran-card tone-${tier.tone}` },
        h('div', { class: 'qz-hayran-top' },
          h('div', { class: 'stack' },
            h('span', { class: 'eyebrow' }, 'Gerçek hayran testi sonucu'),
            h('div', { class: 'qz-big-wrap' }, bigEl, h('span', { class: 'qz-big-unit' }, `/ ${total} doğru`)),
            h('h2', { class: `stamp ${tier.tone === 'gold' ? 'gold' : tier.tone === 'jade' ? 'jade' : ''} qz-tier` }, tier.title),
            h('p', { class: 'muted' }, tier.note),
            record && correct > 0 ? h('span', { class: 'badge gold qz-record' }, icon('crown', { size: 14 }), 'Yeni kişisel rekor') : null,
          ),
          ladder,
        ),
        h('div', { class: 'row' },
          again,
          h('a', { class: 'btn ghost', href: 'https://kick.com/cureshotkick', target: '_blank', rel: 'noopener noreferrer' }, icon('kick', { size: 18 }), 'Kick’te izle'),
          h('button', { class: 'btn ghost', type: 'button', onclick: back }, icon('arrowLeft', { size: 18 }), 'Tüm quizler'),
        ),
      ),
      h('section', { class: 'panel qz-res-panel' },
        h('h3', { class: 'qz-panel-title' }, icon('info', { size: 18 }), 'Cevap anahtarı'),
        answerKey(results),
      ),
    );
    scrollToTop(view);
    if (correct >= 9) {
      sound.win();
      s.timeout(() => { const c = centerOf(bigEl); fx.confetti(c.x, c.y, correct === total ? 150 : 100); }, 200);
      if (correct === total) s.timeout(() => fx.stamp('1vDOQUZ', { variant: 'gold' }), 500);
    } else if (correct >= 5) {
      sound.good();
    } else {
      sound.lose();
    }
    again.focus({ preventScroll: true });
  }

  start();

  return () => {
    if (sub) sub();
    sub = null;
    view.remove();
  };
}
