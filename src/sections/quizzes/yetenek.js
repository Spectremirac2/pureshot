// 5) Yetenek Avı — yetenek ikonu + adından kahramanı bul. 10 soru, soru başı 20 sn, hız bonusu.
// Şıklar aynı ana özellikteki kahramanlardan seçilir (Güç yeteneğine dört Güç kahramanı).
// Veri (src/data/abilities.js: yetenekler + ikon URL'leri) ve kahraman verisi quiz açılınca tembel
// yüklenir; quiz merkezine ek yük getirmez. Kaynak: Valve'ın dota2.com datafeed'i (bkz. docs/oyunlar/yetenek.md).

import './yetenek.css';
import { h, clear, shuffle, fmtNum, loop, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { store } from '../../core/store.js';
import { sound } from '../../core/sound.js';
import { fx } from '../../core/fx.js';
import { heroPortraitUrl } from '../../core/assets.js';
import { mountLeaderboard } from '../../components/leaderboard.js';
import {
  makeScope, keyOk, isActivator, quizBar, xpBar, markOption, centerOf, reveal, scrollToTop,
  saveLast, getLast, toneClass, memeText, readOnlyNote,
} from './ui.js';

const ID = 'yetenek';
const ROUND = 10;
const SECONDS = 20;
const BASE = 100;
const BONUS = 100;
const fmtPts = (n) => `${fmtNum(n)} puan`;

export const YETENEK_TITLES = [
  { min: 9, title: 'Yetenek Ansiklopedisi', note: 'Rubick bile Spell Steal’den önce sana danışıyor.', tone: 'gold' },
  { min: 7, title: 'Kombo Ustası', note: 'İkonu gördün, kahramanı bildin. Draft ekranında sana sorarlar.', tone: 'gold' },
  { min: 5, title: 'Pub Gazisi', note: 'Çoğunu tanıdın; kalanını maçta yiyerek öğrenirsin.', tone: 'jade' },
  { min: 3, title: 'Tooltip Okuyucu', note: 'Her yeteneğin üstünde fareyi bekletmek de bir yöntem.', tone: 'ember' },
  { min: 0, title: 'Ward’sız Gezen', note: 'Yeteneği görmeden yemek de Dota’nın parçası. DOG DOG DOG, ama sevgiyle.', tone: 'blood' },
];
const tierFor = (n) => YETENEK_TITLES.find((t) => n >= t.min) || YETENEK_TITLES[YETENEK_TITLES.length - 1];

// ------------------------------------------------------------------ veri (tembel)
let dataP = null;
function loadData() {
  if (!dataP) {
    dataP = Promise.all([
      import('../../data/abilities.js'),
      import('../../data/heroes.js'),
      import('../heroes/crest.js'),
    ]).then(([ab, he, cr]) => ({
      ABILITIES: ab.ABILITIES,
      abilityIcon: ab.abilityIcon,
      HEROES: he.HEROES,
      tierOf: he.tierOf,
      ATTRS: he.ATTRS,
      crestSvg: cr.crestSvg,
    }));
    dataP.catch(() => { dataP = null; });
  }
  return dataP;
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Yetenek adı kahramanın adını ele veriyor mu? (Doom → Doom, Luna → Lunar Orbit…) */
function giveaway(hero, ability) {
  const n = ability.name.toLowerCase();
  return hero.name.toLowerCase().split(/[\s\-']+/).filter((w) => w.length > 3).some((w) => n.includes(w));
}

/** 10 soru: her biri farklı bir kahramandan; şıklar aynı ana özellikten. */
export function buildRound(D, count = ROUND) {
  const owners = new Map(); // normalize ad → kahraman kimlikleri (Blink: Anti-Mage + Queen of Pain)
  for (const [hid, list] of Object.entries(D.ABILITIES)) {
    for (const a of list) {
      const k = norm(a.name);
      if (!owners.has(k)) owners.set(k, new Set());
      owners.get(k).add(hid);
    }
  }
  const usable = (hero) => (D.ABILITIES[hero.id] || []).filter((a) => D.abilityIcon(a.key));
  const heroes = shuffle(D.HEROES.filter((x) => usable(x).length)).slice(0, count);
  return heroes.map((hero) => {
    const list = usable(hero);
    const fair = list.filter((a) => !giveaway(hero, a));
    const base = fair.length ? fair : list;
    const regular = base.filter((a) => !a.innate);
    const innate = base.filter((a) => a.innate);
    const ability = innate.length && (!regular.length || Math.random() < 0.12) ? pickOne(innate) : pickOne(regular.length ? regular : base);
    const own = owners.get(norm(ability.name)) || new Set([hero.id]);
    const ok = (x) => x.id !== hero.id && !own.has(x.id);
    let others = shuffle(D.HEROES.filter((x) => ok(x) && x.attr === hero.attr)).slice(0, 3);
    if (others.length < 3) {
      others = others.concat(shuffle(D.HEROES.filter((x) => ok(x) && !others.includes(x))).slice(0, 3 - others.length));
    }
    const options = shuffle([hero, ...others]);
    return { hero, ability, icon: D.abilityIcon(ability.key), options, correct: options.indexOf(hero) };
  });
}

// ------------------------------------------------------------------ parçalar
function abilityArt(url, name, { cls = '', ult = false } = {}) {
  return h('span', { class: `yt-ab ${ult ? 'ult' : ''} ${cls}` },
    url
      ? h('img', { src: url, alt: '', width: '96', height: '96', decoding: 'async', draggable: 'false' })
      : h('span', { class: 'yt-ab-none', 'aria-hidden': 'true' }, icon('spell', { size: 34 })),
    h('span', { class: 'sr-only' }, name),
  );
}

function heroThumb(D, hero) {
  const url = heroPortraitUrl(hero.id);
  if (url) return h('img', { class: 'yt-opt-img', src: url, alt: '', width: '64', height: '36', decoding: 'async', draggable: 'false' });
  return h('span', { class: 'yt-opt-img yt-opt-crest' }, D.crestSvg(hero, { ring: false }));
}

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
      fg.style.strokeDashoffset = String(100 - (Math.max(0, remain) / total) * 100);
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

// ------------------------------------------------------------------ görünüm
export function mountYetenek(root, { ctx, quiz, back }) {
  const scope = makeScope();
  let sub = null;
  const view = h('div', { class: 'qz-stage yt' });
  root.appendChild(view);
  const setSub = (fn) => { if (sub) sub(); sub = fn; };
  const lb = (host) => mountLeaderboard(host, { gameId: ID, title: 'Yetenek Avcıları', format: fmtPts });

  // ---------------------------------------------------------------- brifing
  function intro() {
    const s = makeScope();
    setSub(() => s.dispose());
    clear(view);
    const me = store.me.get();
    const best = me.scores && me.scores[ID];
    const last = getLast()[ID];
    const startBtn = h('button', { class: 'btn primary lg qz-start', type: 'button', disabled: true }, icon('play', { size: 18 }), 'Başla');
    const status = h('span', { class: 'xsmall dim yt-status', 'aria-live': 'polite' }, 'Yetenek kitabı açılıyor…');
    const strip = h('div', { class: 'yt-strip', 'aria-hidden': 'true' },
      Array.from({ length: 7 }, (_, i) => h('span', { class: 'yt-ab yt-ab-ghost', style: { '--i': i } })));
    const lbHost = h('div', { class: 'qz-lb' });
    s.add(lb(lbHost));

    view.append(
      quizBar(quiz, back),
      h('div', { class: 'qz-brief' },
        h('section', { class: 'panel raised frame qz-brief-main stack yt-brief' },
          strip,
          h('span', { class: 'eyebrow' }, 'Brifing'),
          h('h2', { class: 'qz-brief-title' }, 'Bu yetenek ', h('em', null, 'kimin?')),
          h('p', { class: 'muted' }, 'İkonu ve adı gösteriyoruz, dört kahraman arasından sahibini sen buluyorsun. Şıkların hepsi aynı ana özellikten: Güç yeteneğine dört Güç kahramanı. Tahmin değil, bilgi.'),
          h('ul', { class: 'qz-rules' },
            h('li', null, icon('spell', { size: 18 }), h('span', null, h('b', null, `${ROUND} yetenek`), ', her biri farklı bir kahramandan')),
            h('li', null, icon('clock', { size: 18 }), h('span', null, h('b', null, `${SECONDS} saniye`), ' süre; biterse yetenek boşa gider')),
            h('li', null, icon('coin', { size: 18 }), h('span', null, h('b', null, `${BASE} puan`), ' her doğru + kalan süreye göre ', h('b', null, `${BONUS}’e kadar`), ' hız bonusu')),
            h('li', null, icon('trophy', { size: 18 }), h('span', null, 'En iyi skorun ', h('b', null, 'Yetenek Avcıları'), ' tablosuna yazılır')),
          ),
          h('div', { class: 'qz-brief-foot' },
            startBtn,
            h('span', { class: 'small muted' },
              best != null ? ['En iyi skorun: ', h('b', { class: 'num gold' }, fmtNum(best))] : 'Henüz skorun yok. İlk yeteneği sen yakala.',
              last ? [h('br'), h('span', { class: 'xsmall dim' }, `Son unvanın: ${last.title}`)] : null,
            ),
          ),
          status,
          h('p', { class: 'xsmall dim yt-credit' }, 'Yetenek adları ve ikonları: Valve · dota2.com. Adlar oyundaki gibi İngilizce.'),
        ),
        lbHost,
      ),
    );
    startBtn.addEventListener('click', start);

    loadData().then((D) => {
      if (!s.alive) return;
      const sample = shuffle(Object.values(D.ABILITIES).flat().filter((a) => D.abilityIcon(a.key))).slice(0, 7);
      strip.replaceChildren(...sample.map((a, i) => {
        const el = abilityArt(D.abilityIcon(a.key), a.name, { ult: a.ult });
        el.style.setProperty('--i', i);
        el.title = a.name;
        return el;
      }));
      startBtn.disabled = false;
      status.textContent = '';
      startBtn.focus({ preventScroll: true });
    }, (err) => {
      console.error(err);
      if (!s.alive) return;
      status.textContent = 'Yetenek verisi yüklenemedi. Bağlantını kontrol edip sayfayı yenile.';
      status.classList.add('yt-err');
    });
  }

  // ---------------------------------------------------------------- tur
  function start() {
    loadData().then((D) => {
      if (!scope.alive) return;
      sound.whoosh();
      setSub(runRound(D));
      scrollToTop(view);
    });
  }

  function runRound(D) {
    const s = makeScope();
    const questions = buildRound(D);
    const total = questions.length;
    const results = [];
    let idx = 0;
    let answered = false;
    let optBtns = [];
    let stopTimer = null;
    let card = null;
    let nextBtn = null;

    const chipVal = h('b', { class: 'num' }, '0');
    const chip = h('span', { class: 'qz-chip', 'aria-live': 'polite' }, h('span', { class: 'qz-chip-lbl' }, 'Puan'), chipVal);
    const xp = xpBar(total, 'Yetenek');
    const cardHost = h('div', { class: 'qz-card-host' });
    const live = h('p', { class: 'sr-only', 'aria-live': 'assertive' });
    clear(view);
    const stage = h('div', { class: 'qz-mc yt-round' },
      quizBar(quiz, back, chip),
      xp.el,
      cardHost,
      h('div', { class: 'qz-nav' },
        h('span', { class: 'qz-hint xsmall dim' },
          h('span', { class: 'kbd' }, '1'), '–', h('span', { class: 'kbd' }, '4'), ' ile seç · ',
          h('span', { class: 'kbd' }, 'Enter'), ' ile sonraki yetenek'),
      ),
      live,
    );
    view.appendChild(stage);

    // Sonraki sorunun ikon ve portrelerini önceden ısıt
    const warm = (q) => {
      if (!q) return;
      const urls = [q.icon, ...q.options.map((o) => heroPortraitUrl(o.id))].filter(Boolean);
      for (const u of urls) { const im = new Image(); im.decoding = 'async'; im.src = u; }
    };
    warm(questions[0]);

    function render() {
      answered = false;
      const q = questions[idx];
      warm(questions[idx + 1]);
      xp.set(idx, idx + 1);
      const ring = timerRing(SECONDS);
      optBtns = q.options.map((hero, i) => {
        const b = h('button', {
          class: 'qz-opt yt-opt',
          type: 'button',
          dataset: { i: String(i), hero: hero.id },
          style: { '--ac': D.ATTRS[hero.attr] ? D.ATTRS[hero.attr].color : 'var(--aegis)' },
        },
          h('span', { class: 'qz-opt-key', 'aria-hidden': 'true' }, String(i + 1)),
          heroThumb(D, hero),
          h('span', { class: 'qz-opt-text' }, hero.name),
          h('span', { class: 'qz-opt-mark', 'aria-hidden': 'true' }),
        );
        b.addEventListener('click', () => pick(i));
        return b;
      });
      const attr = D.ATTRS[q.hero.attr];
      const title = h('h2', { class: 'qz-q yt-name', tabindex: '-1', id: 'yt-title' }, q.ability.name);
      const revealBox = h('div', { class: 'qz-reveal', hidden: true });
      card = h('section', { class: 'qz-qcard panel raised frame enter yt-qcard', 'aria-labelledby': 'yt-title' },
        h('div', { class: 'qz-qhead' },
          h('span', { class: 'eyebrow' }, `Yetenek ${idx + 1}`),
          h('span', { class: 'qz-qhead-note xsmall dim' }, 'Şıklar: ', h('b', { class: 'yt-attr', style: { '--ac': attr ? attr.color : 'var(--aegis)' } }, attr ? attr.label : '—'), ' kahramanları'),
          ring.el,
        ),
        h('div', { class: 'yt-ability' },
          abilityArt(q.icon, q.ability.name, { cls: 'yt-ab-lg', ult: q.ability.ult }),
          h('div', { class: 'yt-ability-meta' },
            h('span', { class: 'row yt-tags' },
              q.ability.ult ? h('span', { class: 'badge gold' }, icon('bolt', { size: 12 }), 'Ultimate') : h('span', { class: 'badge' }, 'Yetenek'),
              q.ability.innate ? h('span', { class: 'badge jade' }, 'Doğuştan') : null,
            ),
            title,
            h('p', { class: 'muted yt-ask' }, 'Bu yetenek hangi kahramanın?'),
          ),
        ),
        h('div', { class: 'qz-opts yt-opts', role: 'group', 'aria-label': 'Kahraman seçenekleri' }, optBtns),
        revealBox,
      );
      card._reveal = revealBox;
      cardHost.replaceChildren(card);
      title.focus({ preventScroll: true });
      live.textContent = `Yetenek ${idx + 1} / ${total}: ${q.ability.name}${q.ability.ult ? ', ultimate' : ''}. Bu yetenek hangi kahramanın?`;

      let remain = SECONDS;
      let lastTick = Math.ceil(remain);
      ring.set(remain);
      card._remain = remain;
      const stop = loop((dt) => {
        if (document.hidden) return;
        remain -= dt;
        card._remain = remain;
        ring.set(remain);
        const sec = Math.ceil(remain);
        if (sec !== lastTick) {
          lastTick = sec;
          if (sec <= 5 && sec > 0) sound.tick();
        }
        if (remain <= 0) {
          card._remain = 0;
          pick(null);
        }
      });
      stopTimer = () => { stop(); ring.stop(); stopTimer = null; };
    }

    function pick(i) {
      if (answered) return;
      answered = true;
      const remain = Math.max(0, card._remain ?? 0);
      if (stopTimer) stopTimer();
      const q = questions[idx];
      const ok = i === q.correct;
      const points = ok ? BASE + Math.round((remain / SECONDS) * BONUS) : 0;
      results.push({ q, picked: i, ok, points, remain, timedOut: i == null });

      optBtns.forEach((b, k) => {
        b.disabled = true;
        if (k === q.correct) markOption(b, 'right');
        else if (k === i) markOption(b, 'wrong');
        else markOption(b, 'dim');
      });

      const last = idx === total - 1;
      nextBtn = h('button', { class: `btn ${last ? 'gold' : 'primary'} qz-next`, type: 'button' },
        last ? 'Sonuçları gör' : 'Sonraki yetenek', icon(last ? 'trophy' : 'arrowRight', { size: 18 }));
      nextBtn.addEventListener('click', next);

      const hero = q.hero;
      const tier = D.tierOf(hero.dogRate);
      const head = ok ? 'Doğru!' : i == null ? 'Süre doldu!' : 'Yanlış.';
      const box = card._reveal;
      box.className = `qz-reveal yt-reveal ${ok ? 'ok' : 'bad'}`;
      box.hidden = false;
      box.replaceChildren(
        h('div', { class: 'qz-reveal-head' },
          h('span', { class: 'qz-reveal-icon', 'aria-hidden': 'true' }, icon(ok ? 'check' : i == null ? 'hourglass' : 'cross', { size: 20, stroke: 2.4 })),
          h('strong', null, head),
          ok ? h('span', { class: 'badge gold num' }, `+${points}`) : null,
          !ok ? h('span', { class: 'qz-reveal-right small' }, 'Doğrusu: ', h('b', null, hero.name)) : null,
        ),
        h('div', { class: 'yt-hero' },
          h('span', { class: 'yt-crest' }, D.crestSvg(hero, { title: `${hero.name}: DOG %${hero.dogRate}` })),
          h('div', { class: 'yt-hero-body' },
            h('div', { class: 'yt-hero-top' },
              h('b', { class: 'yt-hero-name' }, hero.name),
              h('span', { class: 'badge yt-dog', style: { '--tc': tier.color } }, 'DOG ', h('span', { class: 'num' }, `%${hero.dogRate}`), ` · ${tier.label}`),
            ),
            h('p', { class: 'yt-quote' }, hero.prejudice),
          ),
        ),
        h('div', { class: 'qz-reveal-foot' }, nextBtn),
      );
      live.textContent = `${head} ${q.ability.name}: ${hero.name}. DOG yüzde ${hero.dogRate}.`;

      chipVal.textContent = fmtNum(results.reduce((a, r) => a + r.points, 0));
      xp.set(idx + 1, idx + 1);
      if (ok) {
        sound.good();
        const c = centerOf(optBtns[q.correct]);
        fx.confetti(c.x, c.y, 26);
        const cc = centerOf(chip);
        fx.floatText(`+${points}`, cc.x, cc.y + 10, { color: '#e9b949', size: 20 });
      } else {
        sound.bad();
        fx.shake(card);
      }
      nextBtn.focus({ preventScroll: true });
      s.timeout(() => reveal(box), 60);
    }

    function next() {
      if (!answered) return;
      sound.click();
      if (idx < total - 1) {
        idx += 1;
        render();
        scrollToTop(stage);
      } else {
        finish(D, results.slice());
      }
    }

    s.on(window, 'keydown', (e) => {
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
      s.dispose();
      stage.remove();
    };
  }

  // ---------------------------------------------------------------- sonuç
  function finish(D, results) {
    const s = makeScope();
    setSub(() => s.dispose());
    const score = results.reduce((a, r) => a + r.points, 0);
    const correct = results.filter((r) => r.ok).length;
    const bonus = score - correct * BASE;
    const okRs = results.filter((r) => r.ok);
    const avg = okRs.length ? okRs.reduce((a, r) => a + (SECONDS - r.remain), 0) / okRs.length : 0;
    const tier = tierFor(correct);

    // Kullanıcı eylemi ("Sonuçları gör") üzerine kaydet
    const prevBest = (store.me.get().scores || {})[ID];
    const record = store.me.submitScore(ID, score, true);
    saveLast(ID, { score, correct, title: tier.title });

    clear(view);
    const scoreEl = h('span', { class: 'qz-big num' }, '0');
    const again = h('button', { class: 'btn primary', type: 'button', onclick: () => start() }, icon('refresh', { size: 18 }), 'Tekrar oyna');
    const lbHost = h('div', { class: 'qz-lb' });
    s.add(lb(lbHost));

    const scoreCard = h('section', { class: `panel raised frame qz-scorecard tone-${tier.tone}` },
      h('span', { class: 'eyebrow' }, 'Yetenek Avı sonucu'),
      h('div', { class: 'qz-big-wrap' }, scoreEl, h('span', { class: 'qz-big-unit' }, 'puan')),
      h('h2', { class: `stamp ${tier.tone === 'gold' ? 'gold' : tier.tone === 'jade' ? 'jade' : ''} qz-tier` }, memeText(tier.title)),
      h('p', { class: 'muted' }, tier.note),
      readOnlyNote('Skorun'),
      h('div', { class: 'qz-kv' },
        h('span', null, h('small', null, 'Doğru'), h('b', { class: 'num' }, `${correct}/${results.length}`)),
        h('span', null, h('small', null, 'Hız bonusu'), h('b', { class: 'num' }, `+${fmtNum(bonus)}`)),
        h('span', null, h('small', null, 'Ort. cevap'), h('b', { class: 'num' }, correct ? `${avg.toFixed(1).replace('.', ',')} sn` : '—')),
      ),
      record && prevBest != null ? h('span', { class: `badge ${toneClass('gold')} qz-record` }, icon('crown', { size: 14 }), 'Yeni kişisel rekor') : null,
      h('div', { class: 'row' },
        again,
        h('button', { class: 'btn ghost', type: 'button', onclick: back }, icon('arrowLeft', { size: 18 }), 'Tüm quizler'),
      ),
      h('p', { class: 'xsmall dim qz-more' }, 'Kahramanların DOG ön yargılarını merak ettin mi? ',
        h('button', { class: 'qz-link', type: 'button', onclick: () => ctx.go('kahramanlar') }, 'Kahraman DOG Endeksi', icon('arrowRight', { size: 14 }))),
    );

    const key = h('ol', { class: 'qz-key yt-key' },
      results.map((r, i) => h('li', { class: `qz-key-row yt-key-row ${r.ok ? 'ok' : 'bad'}` },
        h('span', { class: 'qz-key-icon', 'aria-label': r.ok ? 'Doğru' : 'Yanlış' }, icon(r.ok ? 'check' : 'cross', { size: 16, stroke: 2.6 })),
        abilityArt(r.q.icon, r.q.ability.name, { cls: 'yt-ab-sm', ult: r.q.ability.ult }),
        h('span', { class: 'qz-key-body' },
          h('span', { class: 'qz-key-q' }, `${i + 1}. ${r.q.ability.name}`),
          h('span', { class: 'qz-key-a xsmall' },
            h('span', { class: 'jade' }, r.q.hero.name),
            r.ok ? null : h('span', { class: 'dim' }, r.timedOut ? ' · süre doldu' : ` · senin cevabın: ${r.q.options[r.picked].name}`),
          ),
        ),
        h('span', { class: 'qz-key-pts num' }, r.points ? `+${r.points}` : '0'),
      )),
    );

    view.append(
      quizBar(quiz, back),
      h('div', { class: 'qz-brief' }, scoreCard, lbHost),
      h('section', { class: 'panel qz-res-panel' },
        h('h3', { class: 'qz-panel-title' }, icon('spell', { size: 18 }), 'Yetenek defteri'),
        key,
      ),
    );

    if (prefersReducedMotion() || score === 0) {
      scoreEl.textContent = fmtNum(score);
    } else {
      let t = 0;
      const dur = 1.1;
      const stop = loop((dt) => {
        t += dt;
        const k = Math.min(1, t / dur);
        scoreEl.textContent = fmtNum(Math.round(score * (1 - Math.pow(1 - k, 3))));
        if (k >= 1) stop();
      });
      s.add(stop);
    }
    scrollToTop(view);
    if (correct >= 7) {
      sound.win();
      s.timeout(() => { const c = centerOf(scoreEl); fx.confetti(c.x, c.y, 110); }, 250);
      if (correct === ROUND) s.timeout(() => fx.stamp('1vDOQUZ', { variant: 'gold' }), 500);
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
