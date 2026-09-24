// "Daha DOG mu?": iki kahramandan hangisinin ön yargı DOG%'si daha yüksek? Seri sayacı; yanlışta oyun biter.
// Klavye: ← sol, → sağ, Enter yeniden. Skor: store.me.submitScore('daha', seri) + skor tablosu.

import { h, clear, pick, fmtNum } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { HEROES, ATTRS } from '../../data/heroes.js';
import { mountLeaderboard } from '../../components/leaderboard.js';
import { crestSvg } from './crest.js';

export function mountDaha(host, env) {
  const { ctx } = env;
  const store = ctx.store;
  const cleanups = [];
  let streak = 0;
  let pair = null;
  let locked = false;
  let over = false;
  let recent = [];
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
  cleanups.push(() => { for (const t of timers) clearTimeout(t); timers.clear(); });

  const streakEl = h('span', { class: 'hr-daha-streak mono' }, '0');
  const bestEl = h('span', { class: 'mono' }, '0');
  const status = h('p', { class: 'hr-daha-status', 'aria-live': 'polite' });
  const arena = h('div', { class: 'hr-daha-arena' });
  const overBox = h('div', { class: 'hr-daha-over panel raised frame', hidden: true });
  const roNote = h('p', { class: 'hint', hidden: true }, 'Salt okunur görüntüleme: rekorun yalnızca bu cihazda saklanır, skor tablosuna gönderilmez.');
  const syncRo = () => { roNote.hidden = !env.readOnly(); };
  store.ready.then(() => { if (host.isConnected) syncRo(); });

  function best() { return Number((store.me.get().scores || {}).daha) || 0; }
  function renderScore() {
    streakEl.textContent = String(streak);
    bestEl.textContent = String(Math.max(best(), streak));
  }

  function newPair() {
    // Seri uzadıkça fark azalır: kolaydan zora
    const minDiff = Math.max(3, 26 - streak * 2);
    const maxDiff = Math.max(minDiff + 10, 60 - streak * 3);
    for (let tries = 0; tries < 400; tries++) {
      const a = pick(HEROES);
      const b = pick(HEROES);
      if (a.id === b.id || recent.includes(a.id) || recent.includes(b.id)) continue;
      const d = Math.abs(a.dogRate - b.dogRate);
      if (d >= minDiff && d <= maxDiff) return [a, b];
    }
    let a = pick(HEROES), b = pick(HEROES);
    while (b.id === a.id || b.dogRate === a.dogRate) b = pick(HEROES);
    return [a, b];
  }

  function cardFor(hero, side) {
    const val = h('span', { class: 'hr-daha-val mono' }, '?');
    const btn = h('button', {
      class: `hr-daha-card hr-a-${hero.attr}`,
      type: 'button',
      'aria-label': `${side === 0 ? 'Sol' : 'Sağ'}: ${hero.name} daha DOG`,
    },
      h('span', { class: 'hr-daha-key kbd', 'aria-hidden': 'true' }, side === 0 ? '←' : '→'),
      crestSvg(hero, { ring: false }),
      h('span', { class: 'hr-daha-name' }, hero.name),
      h('span', { class: `hr-attr-badge hr-a-${hero.attr}` }, ATTRS[hero.attr].label),
      h('span', { class: 'hr-daha-quote' }, hero.tags.slice(0, 2).map((t) => '#' + t).join('  ')),
      val,
    );
    btn.addEventListener('click', () => choose(side));
    return { btn, val };
  }

  let cards = [];
  function renderRound() {
    over = false;
    locked = false;
    overBox.hidden = true;
    pair = newPair();
    recent = [...pair.map((x) => x.id), ...recent].slice(0, 12);
    cards = pair.map((hero, i) => cardFor(hero, i));
    clear(arena).append(
      cards[0].btn,
      h('span', { class: 'hr-daha-vs', 'aria-hidden': 'true' }, 'VS'),
      cards[1].btn,
    );
    status.textContent = streak ? `Seri: ${streak}. Hangisi daha DOG?` : 'Hangisini seçen daha DOG? Ön yargı endeksine göre tahmin et.';
    renderScore();
  }

  function choose(side) {
    if (locked || over || !pair) return;
    locked = true;
    const chosen = pair[side];
    const other = pair[1 - side];
    const right = chosen.dogRate >= other.dogRate;
    pair.forEach((hero, i) => {
      const c = cards[i];
      c.val.textContent = `%${hero.dogRate}`;
      c.btn.classList.add('is-revealed');
      c.btn.classList.toggle('is-higher', hero.dogRate >= pair[1 - i].dogRate);
      c.btn.disabled = true;
    });
    cards[side].btn.classList.add(right ? 'is-right' : 'is-wrong');
    const r = cards[side].btn.getBoundingClientRect();
    if (right) {
      streak++;
      ctx.sound.good();
      ctx.fx.floatText(`+1`, r.left + r.width / 2, r.top + 20, { color: '#e9b949' });
      status.textContent = `Doğru! ${chosen.name} (%${chosen.dogRate}) > ${other.name} (%${other.dogRate}).`;
      renderScore();
      later(renderRound, 1150);
    } else {
      ctx.sound.bad();
      ctx.fx.shake(cards[side].btn);
      status.textContent = `Yanlış: ${other.name} (%${other.dogRate}) daha DOG.`;
      later(() => gameOver(chosen, other), 700);
    }
  }

  function gameOver(chosen, other) {
    over = true;
    const final = streak;
    const isBest = final > 0 && store.me.submitScore('daha', final);
    clear(overBox).append(
      h('span', { class: 'eyebrow' }, 'Seri bitti'),
      h('p', { class: 'hr-daha-final' }, h('span', { class: 'mono' }, String(final)), h('small', null, ' doğru tahmin')),
      h('p', { class: 'small muted' }, `Topluluk gözünde ${other.name} oyuncusu (%${other.dogRate}), ${chosen.name} oyuncusundan (%${chosen.dogRate}) daha çok DOG damgası yiyor.`),
      isBest ? h('p', { class: 'badge gold' }, icon('trophy', { size: 14 }), 'Yeni kişisel rekor') : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'button', onclick: restart }, icon('refresh', { size: 18 }), 'Tekrar oyna'),
        h('span', { class: 'xsmall dim' }, h('span', { class: 'kbd' }, 'Enter'), ' ile de olur'),
      ),
    );
    overBox.hidden = false;
    if (final >= 10) {
      // .stamp büyük harfe çevirir; özel yazım (1vDOQUZ) .meme ile korunur
      ctx.fx.stamp(h('span', { class: 'meme' }, '1vDOQUZ'), { variant: 'gold' });
      ctx.sound.win();
    } else {
      ctx.fx.stamp('DOG DOG DOG');
      ctx.sound.dogdogdog();
    }
    status.textContent = `Seri ${final} ile bitti.${isBest ? ' Yeni rekor!' : ''}`;
    renderScore();
    const btn = overBox.querySelector('button');
    if (btn) btn.focus({ preventScroll: true });
  }

  function restart() {
    streak = 0;
    recent = [];
    ctx.sound.click();
    renderRound();
  }

  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (document.querySelector('.modal-backdrop')) return;
    if (!host.isConnected || host.hidden) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); choose(0); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); choose(1); }
    else if (e.key === 'Enter' && over) { e.preventDefault(); restart(); }
  };
  window.addEventListener('keydown', onKey);
  cleanups.push(() => window.removeEventListener('keydown', onKey));
  cleanups.push(store.me.subscribe(renderScore));

  const lbHost = h('div', { class: 'hr-daha-lb' });
  host.append(
    h('section', { class: 'hr-daha', 'aria-label': 'Daha DOG mu? oyunu' },
      h('div', { class: 'hr-daha-main' },
        h('div', { class: 'section-head hr-sub-head' },
          h('span', { class: 'eyebrow' }, 'DOG sezgisi testi'),
          h('h2', { class: 'h2' }, 'Daha DOG mu?'),
          h('p', { class: 'small muted' }, 'İki kahraman, tek soru: hangisini seçen pub oyuncusu topluluk gözünde daha DOG? Doğru bildikçe seri uzar, farklar küçülür. Tek yanlış, oyun biter.'),
        ),
        h('div', { class: 'hr-daha-score' },
          h('span', null, icon('flame', { size: 16 }), 'Seri ', streakEl),
          h('span', null, icon('trophy', { size: 16 }), 'En iyi ', bestEl),
        ),
        arena,
        overBox,
        status,
        roNote,
      ),
      lbHost,
    ),
  );
  cleanups.push(mountLeaderboard(lbHost, { gameId: 'daha', title: 'DOG Sezgisi', format: (n) => `${fmtNum(n)} seri` }));
  renderRound();

  return {
    destroy() {
      for (const c of cleanups) { try { c(); } catch (e) { console.error(e); } }
      clear(host);
    },
  };
}
