// 2) Dota 2 Bilgi Yarışması — 39 soruluk bankadan 10 rastgele soru, 20 sn sayaç, hız bonusu, skor tablosu.

import { h, clear, shuffle, fmtNum, loop, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { store } from '../../core/store.js';
import { sound } from '../../core/sound.js';
import { fx } from '../../core/fx.js';
import { mountLeaderboard } from '../../components/leaderboard.js';
import { BILGI_BANK, BILGI_TITLES, tierFor } from '../../data/quizzes.js';
import { makeScope, quizBar, centerOf, scrollToTop, saveLast, getLast, toneClass } from './ui.js';
import { runMC, prepQuestion, answerKey } from './mc.js';

const ROUND = 10;
const SECONDS = 20;
const BASE = 100;
const BONUS = 100;

export function mountBilgi(root, { quiz, back }) {
  const scope = makeScope();
  let sub = null;
  const view = h('div', { class: 'qz-stage' });
  root.appendChild(view);

  const setSub = (fn) => { if (sub) sub(); sub = fn; };

  // ---------------------------------------------------------------- brifing
  function intro() {
    const s = makeScope();
    setSub(() => s.dispose());
    clear(view);
    const me = store.me.get();
    const best = me.scores && me.scores.bilgi;
    const last = getLast().bilgi;
    const startBtn = h('button', { class: 'btn primary lg qz-start', type: 'button', onclick: start },
      icon('play', { size: 18 }), 'Başla');
    const lbHost = h('div', { class: 'qz-lb' });
    s.add(mountLeaderboard(lbHost, { gameId: 'bilgi', title: 'Bilgi Şampiyonları', format: (n) => `${fmtNum(n)} puan` }));

    view.append(
      quizBar(quiz, back),
      h('div', { class: 'qz-brief' },
        h('section', { class: 'panel raised frame qz-brief-main stack' },
          h('span', { class: 'eyebrow' }, 'Brifing'),
          h('h2', { class: 'qz-brief-title' }, '20 saniye. 4 seçenek. ', h('em', null, 'Tango yok.')),
          h('p', { class: 'muted' }, `${BILGI_BANK.length} soruluk bankadan her turda rastgele ${ROUND} soru. Yalnızca yamayla değişmeyen, kalıcı Dota 2 bilgileri: fiyat ya da bekleme süresi ezberi yok.`),
          h('ul', { class: 'qz-rules' },
            h('li', null, icon('quiz', { size: 18 }), h('span', null, h('b', null, `${ROUND} soru`), ', her birinde 4 seçenek')),
            h('li', null, icon('clock', { size: 18 }), h('span', null, h('b', null, `${SECONDS} saniye`), ' süre; biterse soru yanık')),
            h('li', null, icon('coin', { size: 18 }), h('span', null, h('b', null, `${BASE} puan`), ' her doğru + kalan süreye göre ', h('b', null, `${BONUS}’e kadar`), ' hız bonusu')),
            h('li', null, icon('trophy', { size: 18 }), h('span', null, 'En iyi skorun ', h('b', null, 'Bilgi Şampiyonları'), ' tablosuna yazılır')),
          ),
          h('div', { class: 'qz-brief-foot' },
            startBtn,
            h('span', { class: 'small muted' },
              best != null ? ['En iyi skorun: ', h('b', { class: 'num gold' }, fmtNum(best))] : 'Henüz skorun yok. İlk kan senin olsun.',
              last ? [h('br'), h('span', { class: 'xsmall dim' }, `Son unvanın: ${last.title}`)] : null,
            ),
          ),
        ),
        lbHost,
      ),
    );
    startBtn.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------- tur
  function start() {
    sound.whoosh();
    const qs = shuffle(BILGI_BANK).slice(0, ROUND).map(prepQuestion);
    setSub(runMC(view, {
      quiz,
      back,
      questions: qs,
      timer: SECONDS,
      scoreFor: (ok, remain) => (ok ? BASE + Math.round((remain / SECONDS) * BONUS) : 0),
      chipLabel: 'Puan',
      chipValue: (rs) => fmtNum(rs.reduce((s, r) => s + r.points, 0)),
      onFinish: finish,
    }));
    scrollToTop(view);
  }

  // ---------------------------------------------------------------- sonuç
  function finish(results) {
    const s = makeScope();
    setSub(() => s.dispose());
    const score = results.reduce((a, r) => a + r.points, 0);
    const correct = results.filter((r) => r.ok).length;
    const bonus = score - correct * BASE;
    const answeredOk = results.filter((r) => r.ok);
    const avg = answeredOk.length ? answeredOk.reduce((a, r) => a + (SECONDS - r.remain), 0) / answeredOk.length : 0;
    const tier = tierFor(BILGI_TITLES, correct);

    // Kullanıcı eylemi ("Sonuçları gör" tıklaması) üzerine yaz
    const record = store.me.submitScore('bilgi', score);
    saveLast('bilgi', { score, correct, title: tier.title });

    clear(view);
    const scoreEl = h('span', { class: 'qz-big num' }, '0');
    const again = h('button', { class: 'btn primary', type: 'button', onclick: () => { start(); } }, icon('refresh', { size: 18 }), 'Tekrar oyna');
    const lbHost = h('div', { class: 'qz-lb' });
    s.add(mountLeaderboard(lbHost, { gameId: 'bilgi', title: 'Bilgi Şampiyonları', format: (n) => `${fmtNum(n)} puan` }));

    const scoreCard = h('section', { class: `panel raised frame qz-scorecard tone-${tier.tone}` },
      h('span', { class: 'eyebrow' }, 'Bilgi yarışması sonucu'),
      h('div', { class: 'qz-big-wrap' }, scoreEl, h('span', { class: 'qz-big-unit' }, 'puan')),
      h('h2', { class: `stamp ${tier.tone === 'gold' ? 'gold' : tier.tone === 'jade' ? 'jade' : ''} qz-tier` }, tier.title),
      h('p', { class: 'muted' }, tier.note),
      h('div', { class: 'qz-kv' },
        h('span', null, h('small', null, 'Doğru'), h('b', { class: 'num' }, `${correct}/${results.length}`)),
        h('span', null, h('small', null, 'Hız bonusu'), h('b', { class: 'num' }, `+${fmtNum(bonus)}`)),
        h('span', null, h('small', null, 'Ort. cevap'), h('b', { class: 'num' }, correct ? `${avg.toFixed(1).replace('.', ',')} sn` : '—')),
      ),
      record ? h('span', { class: `badge ${toneClass('gold')} qz-record` }, icon('crown', { size: 14 }), 'Yeni kişisel rekor') : null,
      h('div', { class: 'row' }, again, h('button', { class: 'btn ghost', type: 'button', onclick: back }, icon('arrowLeft', { size: 18 }), 'Tüm quizler')),
    );

    view.append(
      quizBar(quiz, back),
      h('div', { class: 'qz-brief' }, scoreCard, lbHost),
      h('section', { class: 'panel qz-res-panel' },
        h('h3', { class: 'qz-panel-title' }, icon('info', { size: 18 }), 'Cevap anahtarı'),
        answerKey(results, { showPoints: true }),
      ),
    );

    // Tek düzenlenmiş an: skor sayarak yükselir
    if (prefersReducedMotion() || score === 0) {
      scoreEl.textContent = fmtNum(score);
    } else {
      let t = 0;
      const dur = 1.1;
      const stop = loop((dt) => {
        t += dt;
        const k = Math.min(1, t / dur);
        const e = 1 - Math.pow(1 - k, 3);
        scoreEl.textContent = fmtNum(Math.round(score * e));
        if (k >= 1) stop();
      });
      s.add(stop);
    }
    scrollToTop(view);
    if (correct >= 7) {
      sound.win();
      s.timeout(() => { const c = centerOf(scoreEl); fx.confetti(c.x, c.y, 110); }, 250);
    } else if (correct >= 4) {
      sound.good();
    } else {
      sound.lose();
    }
    again.focus({ preventScroll: true });
  }

  intro();

  return () => {
    if (sub) sub();
    sub = null;
    scope.dispose();
    view.remove();
  };
}
