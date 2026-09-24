// Çoktan seçmeli quiz motoru (Bilgi Yarışması ve Gerçek Hayran Testi ortak kullanır).
// runMC(host, opts) → dispose()

import { h, clear, shuffle, loop } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { sound } from '../../core/sound.js';
import { fx } from '../../core/fx.js';
import {
  makeScope, keyOk, isActivator, quizBar, xpBar, optionBtn, markOption,
  centerOf, reveal, scrollToTop,
} from './ui.js';

/** Banka öğesini seçenekleri karışık soruya çevirir: { ...item, options, correct } */
export function prepQuestion(item) {
  const options = shuffle([item.a, ...item.wrong]);
  return { ...item, options, correct: options.indexOf(item.a) };
}

/** Dairesel geri sayım göstergesi. */
function timerRing(total) {
  const fg = h('circle', { class: 'qz-timer-fg', cx: '24', cy: '24', r: '20', pathLength: '100' });
  const num = h('span', { class: 'qz-timer-num num' }, String(total));
  const el = h('div', { class: 'qz-timer', role: 'timer', 'aria-label': 'Kalan süre' },
    h('svg', { viewBox: '0 0 48 48', 'aria-hidden': 'true' },
      h('circle', { class: 'qz-timer-bg', cx: '24', cy: '24', r: '20' }),
      fg,
    ),
    num,
  );
  let lastShown = -1;
  return {
    el,
    set(remain) {
      const p = Math.max(0, remain) / total;
      fg.style.strokeDashoffset = String(100 - p * 100);
      const s = Math.max(0, Math.ceil(remain));
      if (s !== lastShown) {
        lastShown = s;
        num.textContent = String(s);
        el.setAttribute('aria-label', `Kalan süre ${s} saniye`);
      }
      el.classList.toggle('warn', remain <= 10 && remain > 5);
      el.classList.toggle('crit', remain <= 5);
    },
    stop() { el.classList.add('stopped'); },
  };
}

/**
 * opts:
 *  quiz, back, questions (prepQuestion çıktısı)
 *  timer: saniye (0 = süresiz)
 *  scoreFor(ok, remain) → puan
 *  chipLabel: skor çipi etiketi, chipValue(results, total) → metin
 *  onFinish(results)  — son sorudan sonra "Sonuçları gör" tıklanınca (kullanıcı eylemi)
 *  eyebrowNote: soru başlığı yanındaki küçük not
 */
export function runMC(host, opts) {
  const {
    quiz, back, questions, timer = 0,
    scoreFor = (ok) => (ok ? 1 : 0),
    chipLabel = 'Puan', chipValue = (rs) => String(rs.reduce((s, r) => s + r.points, 0)),
    onFinish, eyebrowNote = '',
  } = opts;
  const scope = makeScope();
  const total = questions.length;
  const results = [];
  let idx = 0;
  let answered = false;
  let optBtns = [];
  let stopTimer = null;
  let nextBtn = null;
  let card = null;

  const chipVal = h('b', { class: 'num' }, chipValue(results, total));
  const chip = h('span', { class: 'qz-chip', 'aria-live': 'polite' }, h('span', { class: 'qz-chip-lbl' }, chipLabel), chipVal);
  const xp = xpBar(total);
  const cardHost = h('div', { class: 'qz-card-host' });
  const live = h('p', { class: 'sr-only', 'aria-live': 'assertive' });

  clear(host);
  const stage = h('div', { class: 'qz-mc' },
    quizBar(quiz, back, chip),
    xp.el,
    cardHost,
    h('div', { class: 'qz-nav' },
      h('span', { class: 'qz-hint xsmall dim' },
        h('span', { class: 'kbd' }, '1'), '–', h('span', { class: 'kbd' }, '4'), ' ile seç · ',
        h('span', { class: 'kbd' }, 'Enter'), ' ile sonraki soru'),
    ),
    live,
  );
  host.appendChild(stage);

  function render() {
    answered = false;
    const q = questions[idx];
    xp.set(idx, idx + 1);
    optBtns = q.options.map((t, i) => optionBtn(i, t, pick));
    const ring = timer ? timerRing(timer) : null;
    const title = h('h2', { class: 'qz-q', tabindex: '-1', id: 'qz-mc-title' }, q.q);
    const revealBox = h('div', { class: 'qz-reveal', hidden: true });
    card = h('section', { class: 'qz-qcard panel raised frame enter', 'aria-labelledby': 'qz-mc-title' },
      h('div', { class: 'qz-qhead' },
        h('span', { class: 'eyebrow' }, `Soru ${idx + 1}`),
        eyebrowNote ? h('span', { class: 'qz-qhead-note xsmall dim' }, eyebrowNote) : null,
        ring ? ring.el : null,
      ),
      title,
      h('div', { class: 'qz-opts', role: 'group', 'aria-label': 'Seçenekler' }, optBtns),
      revealBox,
    );
    card._reveal = revealBox;
    cardHost.replaceChildren(card);
    title.focus({ preventScroll: true });
    live.textContent = `Soru ${idx + 1} / ${total}`;

    if (ring) {
      let remain = timer;
      let lastTick = Math.ceil(remain);
      ring.set(remain);
      const stop = loop((dt) => {
        if (document.hidden) return;
        remain -= dt;
        card._remain = remain;
        ring.set(remain);
        const s = Math.ceil(remain);
        if (s !== lastTick) {
          lastTick = s;
          if (s <= 5 && s > 0) sound.tick();
        }
        if (remain <= 0) {
          card._remain = 0;
          pick(null);
        }
      });
      card._remain = remain;
      stopTimer = () => { stop(); ring.stop(); stopTimer = null; };
    }
  }

  function pick(i) {
    if (answered) return;
    answered = true;
    const remain = card._remain ?? 0;
    if (stopTimer) stopTimer();
    const q = questions[idx];
    const ok = i === q.correct;
    const points = scoreFor(ok, Math.max(0, remain));
    results.push({ q, picked: i, ok, points, remain: Math.max(0, remain), timedOut: i == null });

    optBtns.forEach((b, k) => {
      b.disabled = true;
      if (k === q.correct) markOption(b, 'right');
      else if (k === i) markOption(b, 'wrong');
      else markOption(b, 'dim');
    });

    const last = idx === total - 1;
    nextBtn = h('button', { class: `btn ${last ? 'gold' : 'primary'} qz-next`, type: 'button' },
      last ? 'Sonuçları gör' : 'Sonraki soru', icon(last ? 'trophy' : 'arrowRight', { size: 18 }));
    nextBtn.addEventListener('click', next);

    const head = ok ? 'Doğru!' : i == null ? 'Süre doldu!' : 'Yanlış.';
    const box = card._reveal;
    box.className = `qz-reveal ${ok ? 'ok' : 'bad'}`;
    box.hidden = false;
    box.replaceChildren(
      h('div', { class: 'qz-reveal-head' },
        h('span', { class: 'qz-reveal-icon', 'aria-hidden': 'true' }, icon(ok ? 'check' : i == null ? 'hourglass' : 'cross', { size: 20, stroke: 2.4 })),
        h('strong', null, head),
        ok && points > 1 ? h('span', { class: 'badge gold num' }, `+${points}`) : null,
        !ok ? h('span', { class: 'qz-reveal-right small' }, 'Doğrusu: ', h('b', null, q.a)) : null,
      ),
      h('p', { class: 'qz-reveal-why' }, q.why),
      h('div', { class: 'qz-reveal-foot' }, nextBtn),
    );
    live.textContent = `${head} ${ok ? '' : 'Doğru cevap: ' + q.a + '. '}${q.why}`;

    chipVal.textContent = chipValue(results, total);
    xp.set(idx + 1, idx + 1);
    if (ok) {
      sound.good();
      const src = optBtns[q.correct];
      const c = centerOf(src);
      fx.confetti(c.x, c.y, 26);
      if (points > 1) {
        const cc = centerOf(chip);
        fx.floatText(`+${points}`, cc.x, cc.y + 10, { color: '#e9b949', size: 20 });
      }
    } else {
      sound.bad();
      fx.shake(card);
    }
    nextBtn.focus({ preventScroll: true });
    scope.timeout(() => reveal(box), 60);
  }

  function next() {
    if (!answered) return;
    sound.click();
    if (idx < total - 1) {
      idx += 1;
      render();
      scrollToTop(stage);
    } else if (onFinish) {
      onFinish(results.slice());
    }
  }

  scope.on(window, 'keydown', (e) => {
    if (!keyOk(e)) return;
    if (!answered && /^[1-4]$/.test(e.key)) {
      const b = optBtns[Number(e.key) - 1];
      if (b) { e.preventDefault(); b.click(); }
    } else if (answered && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight')) {
      if (isActivator(e.target) && e.key !== 'ArrowRight') return;
      e.preventDefault();
      next();
    }
  });

  render();

  return () => {
    if (stopTimer) stopTimer();
    scope.dispose();
    stage.remove();
  };
}

/** Sonuç ekranı için cevap anahtarı listesi. */
export function answerKey(results, { showPoints = false } = {}) {
  return h('ol', { class: 'qz-key' },
    results.map((r, i) => h('li', { class: `qz-key-row ${r.ok ? 'ok' : 'bad'}` },
      h('span', { class: 'qz-key-icon', 'aria-label': r.ok ? 'Doğru' : 'Yanlış' }, icon(r.ok ? 'check' : 'cross', { size: 16, stroke: 2.6 })),
      h('span', { class: 'qz-key-body' },
        h('span', { class: 'qz-key-q' }, `${i + 1}. ${r.q.q}`),
        h('span', { class: 'qz-key-a xsmall' },
          r.ok ? h('span', { class: 'jade' }, r.q.a)
            : [h('span', { class: 'jade' }, r.q.a), h('span', { class: 'dim' }, r.timedOut ? ' · süre doldu' : ` · senin cevabın: ${r.q.options[r.picked]}`)],
        ),
      ),
      showPoints ? h('span', { class: 'qz-key-pts num' }, r.points ? `+${r.points}` : '0') : null,
    )),
  );
}
