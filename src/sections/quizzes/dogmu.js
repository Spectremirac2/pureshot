// 3) DOG mu Değil mi? — senaryo kartları; buton, ← → tuşları ya da kaydırma ile karar.
// Oylar fan belgesinde picks['dm:<id>'] = 'dog' | 'not'; topluluk yüzdesi agg.distribution ile.

import { h, clear, shuffle, clamp, fmtNum, hashStr, seeded, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { store, agg } from '../../core/store.js';
import { sound } from '../../core/sound.js';
import { fx } from '../../core/fx.js';
import { DOGMU_CARDS, DOGMU_TITLES, tierFor } from '../../data/quizzes.js';
import {
  makeScope, keyOk, isActivator, quizBar, xpBar, centerOf, reveal, scrollToTop, saveLast, withMe, memeText, readOnlyNote,
} from './ui.js';

const ROUND = 10;

/** Türkçe iyelik eki: %60’ı, %45’i, %33’ü, %100’ü, %20’si */
export function pctSuffix(n) {
  const ones = { 1: 'i', 2: 'si', 3: 'ü', 4: 'ü', 5: 'i', 6: 'sı', 7: 'si', 8: 'i', 9: 'u' };
  const tens = { 10: 'u', 20: 'si', 30: 'u', 40: 'ı', 50: 'si', 60: 'ı', 70: 'i', 80: 'i', 90: 'ı' };
  if (n === 0) return 'ı';
  if (n === 100) return 'ü';
  if (n % 10) return ones[n % 10];
  return tens[n] || 'i';
}
const pctText = (n) => `%${n}’${pctSuffix(n)}`;

function community(fans, id) {
  const d = agg.distribution(withMe(fans), 'dm:' + id);
  const dog = d.dog || 0;
  const not = d.not || 0;
  const total = dog + not;
  return { dog, not, total, pct: total ? Math.round((dog / total) * 100) : 0 };
}

export function mountDogMu(root, { quiz, back }) {
  const scope = makeScope();
  let sub = null;
  let lastFans = [];
  const view = h('div', { class: 'qz-stage' });
  root.appendChild(view);
  const setSub = (fn) => { if (sub) sub(); sub = fn; };
  scope.add(store.fans((f) => { lastFans = f; }));

  // ---------------------------------------------------------------- tur
  function start() {
    const s = makeScope();
    setSub(() => s.dispose());
    clear(view);
    const deck = shuffle(DOGMU_CARDS).slice(0, ROUND);
    const results = [];
    let idx = 0;
    let state = 'wait'; // wait | anim | reveal
    let card = null;
    let stamps = null;

    const chipVal = h('b', { class: 'num' }, '0/0');
    const chip = h('span', { class: 'qz-chip', 'aria-live': 'polite' }, h('span', { class: 'qz-chip-lbl' }, 'Uyum'), chipVal);
    const xp = xpBar(ROUND, 'Kart');
    const deckEl = h('div', { class: 'qz-dm-deck' });
    const live = h('p', { class: 'sr-only', 'aria-live': 'assertive' });

    const dogBtn = h('button', { class: 'qz-dm-btn dog', type: 'button', onclick: () => decide('dog') },
      h('span', { class: 'kbd', 'aria-hidden': 'true' }, '←'), h('span', { class: 'qz-dm-btn-t' }, 'DOG'));
    const notBtn = h('button', { class: 'qz-dm-btn not', type: 'button', onclick: () => decide('not') },
      h('span', { class: 'qz-dm-btn-t' }, 'DOG DEĞİL'), h('span', { class: 'kbd', 'aria-hidden': 'true' }, '→'));
    const actions = h('div', { class: 'qz-dm-actions' }, dogBtn, notBtn);

    view.append(
      quizBar(quiz, back, chip),
      xp.el,
      h('div', { class: 'qz-dm' }, deckEl, actions),
      h('p', { class: 'qz-hint xsmall dim qz-dm-hint' },
        h('span', { class: 'qz-hint-keys' },
          h('span', { class: 'kbd' }, '←'), ' DOG · DOG DEĞİL ', h('span', { class: 'kbd' }, '→'),
          ' · kartı fareyle sürükleyebilirsin · ', h('span', { class: 'kbd' }, 'Enter'), ' sonraki kart'),
        h('span', { class: 'qz-hint-touch' }, 'Kartı sola kaydır: DOG · sağa kaydır: DOG DEĞİL'),
      ),
      live,
    );

    const paintChip = () => {
      const a = results.filter((r) => r.agree).length;
      chipVal.textContent = `${a}/${results.length}`;
    };

    function renderCard() {
      state = 'wait';
      const c = deck[idx];
      xp.set(idx, idx + 1);
      const stDog = h('span', { class: 'qz-dm-stamp dog', 'aria-hidden': 'true' }, 'DOG');
      const stNot = h('span', { class: 'qz-dm-stamp not', 'aria-hidden': 'true' }, 'DOG DEĞİL');
      stamps = { dog: stDog, not: stNot };
      card = h('article', { class: 'qz-dm-card enter', tabindex: '-1', 'aria-labelledby': 'qz-dm-text', 'aria-describedby': 'qz-dm-ask' },
        h('div', { class: 'qz-dm-meta' },
          h('span', { class: 'qz-dm-time num' }, icon('clock', { size: 14 }), c.t),
          h('span', { class: 'badge' }, c.who),
          h('span', { class: 'qz-dm-no num xsmall dim' }, `#${String(idx + 1).padStart(2, '0')}`),
        ),
        h('p', { class: 'qz-dm-text', id: 'qz-dm-text' }, c.text),
        h('p', { class: 'qz-dm-ask', id: 'qz-dm-ask' }, icon('question', { size: 16 }), 'Bu DOG mu?'),
        stDog, stNot,
      );
      attachDrag(card);
      deckEl.replaceChildren(card);
      actions.replaceChildren(dogBtn, notBtn);
      dogBtn.disabled = false;
      notBtn.disabled = false;
      live.textContent = `Kart ${idx + 1}: ${c.text} Bu DOG mu?`;
    }

    // ---- kaydırma
    function attachDrag(el) {
      let drag = null;
      const apply = (dx) => {
        el.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
        stamps.dog.style.opacity = String(clamp(-dx / 110, 0, 1));
        stamps.not.style.opacity = String(clamp(dx / 110, 0, 1));
      };
      const reset = () => {
        el.classList.remove('dragging');
        el.style.transform = '';
        stamps.dog.style.opacity = '';
        stamps.not.style.opacity = '';
      };
      el.addEventListener('pointerdown', (e) => {
        if (state !== 'wait' || (e.pointerType === 'mouse' && e.button !== 0)) return;
        drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, active: false };
      });
      el.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id || state !== 'wait') return;
        const dx = e.clientX - drag.x0;
        const dy = e.clientY - drag.y0;
        if (!drag.active) {
          if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
            drag.active = true;
            el.classList.add('dragging');
            try { el.setPointerCapture(e.pointerId); } catch { /* yok say */ }
          } else if (Math.abs(dy) > 12) {
            drag = null;
            return;
          } else return;
        }
        drag.dx = dx;
        apply(dx);
      });
      const end = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const { dx, active } = drag;
        drag = null;
        if (!active) return;
        const threshold = Math.min(110, el.offsetWidth * 0.26);
        if (Math.abs(dx) >= threshold && state === 'wait') decide(dx < 0 ? 'dog' : 'not', dx);
        else reset();
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) { drag = null; reset(); } });
    }

    // ---- karar
    function decide(choice, dragDx = 0) {
      if (state !== 'wait') return;
      state = 'anim';
      const c = deck[idx];
      const agree = choice === c.verdict;
      results.push({ c, choice, agree });
      // Kullanıcı eylemi: oy fan belgesine
      store.me.patch((d) => { d.picks['dm:' + c.id] = choice; });
      dogBtn.disabled = true;
      notBtn.disabled = true;
      if (choice === 'dog') sound.bark(1.05); else sound.whoosh();

      const dir = choice === 'dog' ? -1 : 1;
      stamps[choice].style.opacity = '1';
      if (prefersReducedMotion()) {
        showVerdict(c, choice, agree);
        return;
      }
      card.classList.remove('dragging', 'enter');
      card.classList.add('fly');
      const startX = dragDx || 0;
      card.style.transform = `translateX(${startX}px) rotate(${startX / 18}deg)`;
      void card.offsetWidth;
      card.style.transform = `translateX(${dir * 130}%) rotate(${dir * 16}deg)`;
      card.style.opacity = '0';
      s.timeout(() => showVerdict(c, choice, agree), 300);
    }

    function showVerdict(c, choice, agree) {
      state = 'reveal';
      const k = community(lastFans, c.id);
      const isDog = c.verdict === 'dog';
      const last = idx === ROUND - 1;
      const nextBtn = h('button', { class: `btn ${last ? 'gold' : 'primary'} lg qz-dm-next`, type: 'button', onclick: next },
        last ? 'Sonucu gör' : 'Sonraki kart', icon(last ? 'trophy' : 'arrowRight', { size: 18 }));

      const panel = h('section', { class: `qz-dm-verdict panel raised frame ${agree ? 'agree' : 'disagree'}`, 'aria-live': 'polite' },
        h('div', { class: 'qz-dm-vhead' },
          h('span', { class: 'eyebrow' }, 'Sitenin kararı'),
          h('span', { class: `badge ${agree ? 'jade' : 'blood'}` }, icon(agree ? 'check' : 'cross', { size: 14, stroke: 2.6 }), agree ? 'Aynı fikirdeyiz' : 'Ters köşe'),
        ),
        h('p', { class: `stamp ${isDog ? '' : 'jade'} qz-dm-vstamp` }, isDog ? 'DOG' : 'DOG DEĞİL'),
        h('p', { class: 'qz-dm-why' }, c.why),
        h('p', { class: 'qz-dm-recap xsmall dim' }, `${c.t} · ${c.who}: ${c.text}`),
        h('div', { class: 'qz-dm-comm' },
          h('div', { class: 'qz-dm-comm-head' },
            h('span', null, 'Topluluğun ', h('b', null, pctText(k.pct)), ' DOG dedi'),
            h('span', { class: 'xsmall dim num' }, `${fmtNum(k.total)} oy`),
          ),
          h('div', { class: 'qz-dm-split', role: 'img', 'aria-label': `${k.dog} DOG, ${k.not} DOG değil oyu` },
            h('span', { class: 'dog', style: { width: `${k.pct}%` } }),
            h('span', { class: 'not', style: { width: `${100 - k.pct}%` } }),
          ),
          h('div', { class: 'qz-dm-split-legend xsmall' },
            h('span', null, h('i', { class: 'sw dog' }), `DOG ${fmtNum(k.dog)}`),
            h('span', null, `DOG DEĞİL ${fmtNum(k.not)}`, h('i', { class: 'sw not' })),
          ),
          k.total <= 1 ? h('p', { class: 'xsmall dim' }, 'Bu karta ilk oyu sen verdin. Topluluk henüz yolda.') : null,
        ),
      );
      deckEl.replaceChildren(panel);
      actions.replaceChildren(nextBtn);
      paintChip();
      xp.set(idx + 1, idx + 1);
      live.textContent = `Sitenin kararı: ${isDog ? 'DOG' : 'DOG değil'}. ${agree ? 'Aynı fikirdesiniz.' : 'Ters köşe.'} ${c.why} Topluluğun yüzde ${k.pct} kadarı DOG dedi.`;
      if (agree) {
        sound.good();
        const cc = centerOf(panel);
        fx.confetti(cc.x, cc.y - 40, 24);
      } else {
        sound.bad();
        fx.shake(panel);
      }
      nextBtn.focus({ preventScroll: true });
      s.timeout(() => reveal(nextBtn), 60);
    }

    function next() {
      if (state !== 'reveal') return;
      sound.click();
      if (idx < ROUND - 1) {
        idx += 1;
        renderCard();
        scrollToTop(view);
      } else {
        finish(results.slice());
      }
    }

    s.on(window, 'keydown', (e) => {
      if (!keyOk(e)) return;
      if (state === 'wait' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        decide(e.key === 'ArrowLeft' ? 'dog' : 'not');
      } else if (state === 'reveal' && (e.key === 'Enter' || e.key === ' ')) {
        if (isActivator(e.target)) return;
        e.preventDefault();
        next();
      }
    });

    renderCard();
  }

  // ---------------------------------------------------------------- sonuç
  function finish(results) {
    const s = makeScope();
    setSub(() => s.dispose());
    const agreeN = results.filter((r) => r.agree).length;
    const pct = Math.round((agreeN / results.length) * 100);
    const tier = tierFor(DOGMU_TITLES, pct);
    // Kullanıcı eylemi ("Sonucu gör") üzerine yaz
    store.me.submitScore('dogmu', pct);
    saveLast('dogmu', { pct, title: tier.title });

    const dogN = results.filter((r) => r.choice === 'dog').length;
    // Topluluğa en ters düştüğün kart
    let odd = null;
    for (const r of results) {
      const k = community(lastFans, r.c.id);
      if (k.total < 2) continue;
      const share = r.choice === 'dog' ? k.pct : 100 - k.pct;
      if (!odd || share < odd.share) odd = { r, share };
    }

    clear(view);
    const blips = results.map((r, i) => {
      const rnd = seeded(hashStr(r.c.id));
      const ang = (i / results.length) * Math.PI * 2 - Math.PI / 2 + (rnd() - 0.5) * 0.3;
      const rad = 22 + rnd() * 20;
      return h('span', {
        class: `qz-blip ${r.agree ? 'ok' : 'bad'}`,
        style: { left: `${50 + Math.cos(ang) * rad}%`, top: `${50 + Math.sin(ang) * rad}%`, '--d': `${(i / results.length) * 3.2}s` },
        title: `${r.c.text} — ${r.agree ? 'uyumlu' : 'ters'}`,
      });
    });
    const radar = h('div', { class: 'qz-radar', role: 'img', 'aria-label': `DOG radarı yüzde ${pct}: ${results.length} karttan ${agreeN} tanesinde siteyle aynı fikirdesin.` },
      h('span', { class: 'qz-radar-sweep', 'aria-hidden': 'true' }),
      blips,
      h('span', { class: 'qz-radar-core' }, h('b', { class: 'num' }, `%${pct}`), h('small', null, 'radar')),
    );

    const again = h('button', { class: 'btn primary', type: 'button', onclick: () => { sound.whoosh(); start(); scrollToTop(view); } }, icon('refresh', { size: 18 }), 'Yeni tur');

    view.append(
      quizBar(quiz, back),
      h('section', { class: `panel raised frame qz-dm-result tone-${tier.tone}` },
        radar,
        h('div', { class: 'stack' },
          h('span', { class: 'eyebrow' }, 'DOG radarın'),
          h('div', { class: 'qz-big-wrap' }, h('span', { class: 'qz-big num' }, `%${pct}`), h('span', { class: 'qz-big-unit' }, 'siteyle uyum')),
          h('h2', { class: `stamp ${tier.tone === 'gold' ? 'gold' : tier.tone === 'jade' ? 'jade' : ''} qz-tier` }, memeText(tier.title)),
          h('p', { class: 'muted' }, tier.note),
          readOnlyNote('Oyların ve sonucun'),
          h('div', { class: 'qz-kv' },
            h('span', null, h('small', null, 'Uyum'), h('b', { class: 'num' }, `${agreeN}/${results.length}`)),
            h('span', null, h('small', null, 'DOG dediğin'), h('b', { class: 'num' }, String(dogN))),
            h('span', null, h('small', null, 'Affettiğin'), h('b', { class: 'num' }, String(results.length - dogN))),
          ),
          odd ? h('p', { class: 'qz-odd small' }, icon('eye', { size: 16 }),
            h('span', null, 'Topluluğa en ters düştüğün kart: “', odd.r.c.text, '” Seninle aynı düşünen: ', h('b', { class: 'num' }, `%${odd.share}`), '.')) : null,
          h('div', { class: 'row' }, again, h('button', { class: 'btn ghost', type: 'button', onclick: back }, icon('arrowLeft', { size: 18 }), 'Tüm quizler')),
        ),
      ),
      h('section', { class: 'panel qz-res-panel' },
        h('h3', { class: 'qz-panel-title' }, icon('target', { size: 18 }), 'Tur özeti'),
        h('ol', { class: 'qz-key' },
          results.map((r) => {
            const k = community(lastFans, r.c.id);
            return h('li', { class: `qz-key-row ${r.agree ? 'ok' : 'bad'}` },
              h('span', { class: 'qz-key-icon', 'aria-label': r.agree ? 'Uyumlu' : 'Ters' }, icon(r.agree ? 'check' : 'cross', { size: 16, stroke: 2.6 })),
              h('span', { class: 'qz-key-body' },
                h('span', { class: 'qz-key-q' }, r.c.text),
                h('span', { class: 'qz-key-a xsmall' },
                  h('span', { class: r.choice === 'dog' ? 'ember' : 'jade' }, `Sen: ${r.choice === 'dog' ? 'DOG' : 'DOG değil'}`),
                  h('span', { class: 'dim' }, ` · Site: ${r.c.verdict === 'dog' ? 'DOG' : 'DOG değil'} · Topluluk: %${k.pct} DOG`),
                ),
              ),
            );
          }),
        ),
      ),
    );
    scrollToTop(view);
    if (pct >= 70) {
      sound.win();
      s.timeout(() => { const c = centerOf(radar); fx.confetti(c.x, c.y, 100); }, 250);
    } else if (pct >= 50) sound.good();
    else sound.lose();
    again.focus({ preventScroll: true });
  }

  start();

  return () => {
    if (sub) sub();
    sub = null;
    scope.dispose();
    view.remove();
  };
}
