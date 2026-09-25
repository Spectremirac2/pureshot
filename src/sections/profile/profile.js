// Profil (#profil) — Fan Kartı. Belge: docs/PROFIL.md
//
// Bölümler (alt sayfalar #profil--<id> ilgili bölüme kaydırır):
//   başlık     takma ad, avatar kahraman, seviye + XP, Hangi DOG sonucu, üyelik tarihi, DOG / rozet / rekor / seri
//   gorevler   Günlük Görevler (core/quests.js): 3 görev, ilerleme, sıfırlanmaya kalan süre, seri
//   kart       paylaşılabilir Fan Kartı görseli (1200×630 canvas): indir / panoya kopyala
//   rekorlar   tüm oyun ve quizlerde en iyi skor + son denemeler çizgisi (core/history.js)
//   rozetler   tüm rozetler (core/badges.js), gruplu
//   veri       JSON yedek, içe aktar, sıfırla (yalnızca csk: anahtarları)

import './profile.css';
import { h, clear, fmtNum, ls, timeAgo, prefersReducedMotion, cleanText } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { store } from '../../core/store.js';
import { history } from '../../core/history.js';
import { fx } from '../../core/fx.js';
import { sound } from '../../core/sound.js';
import { BADGES, BADGE_GROUPS, earnedSet, badgeProgress, badgeHref } from '../../core/badges.js';
import {
  subscribeQuests, questStreak, completedQuestCount, msToReset, fanXp, fanLevel, ensureQuestWatcher, XP_RULES, QUEST_XP,
} from '../../core/quests.js';
import * as shell from '../../core/shell.js';
import { heroById } from '../../data/heroes.js';
import { byId as archetypeById } from '../../data/archetypes.js';
import { gameCatalog, quizCatalog, otherCatalog, strength } from './catalog.js';
import { avatarId, avatarArt, openAvatarPicker } from './avatar.js';
import { drawFanCard, cardFontsReady, loadImage, canvasBlob, CARD_W, CARD_H } from './sharecard.js';
import { exportData, readBackup, applyBackup, resetData, storageUsage, downloadBlob, isFramed, dateStamp } from './data.js';

ensureQuestWatcher();

const NAV = [
  { id: 'gorevler', label: 'Görevler', icon: 'calendar' },
  { id: 'kart', label: 'Kart', icon: 'image' },
  { id: 'rekorlar', label: 'Rekorlar', icon: 'trophy' },
  { id: 'rozetler', label: 'Rozetler', icon: 'medal' },
  { id: 'veri', label: 'Veri', icon: 'download' },
];

const SINCE_KEY = 'profile:since';
const MIN_TS = Date.UTC(2024, 0, 1);

// ------------------------------------------------------------------ yardımcılar
const memeText = (s) => String(s).split(/(1vDOQUZ)/).map((p) => (p === '1vDOQUZ' ? h('span', { class: 'meme' }, p) : p));

/** Fan kimliği (yerel kipte `f` + zaman damgası + rastgele) ilk ziyaret anını taşır. */
function idTime() {
  const id = ls.get('local-fan-id', null);
  if (typeof id !== 'string' || !/^f[0-9a-z]{9,}$/.test(id)) return null;
  const t = parseInt(id.slice(1, 9), 36);
  return t >= MIN_TS && t <= Date.now() + 86400e3 ? t : null;
}

/** Üyelik tarihi: kayıtlı değer, fan kimliği ve en eski deneme arasından en erkeni (bir kez kaydedilir). */
function memberSince() {
  const cands = [Date.now()];
  const saved = Number(ls.get(SINCE_KEY, 0));
  if (saved >= MIN_TS) cands.push(saved);
  const fromId = idTime();
  if (fromId) cands.push(fromId);
  for (const list of Object.values(history.all() || {})) {
    if (Array.isArray(list)) for (const e of list) if (e && e.t >= MIN_TS) cands.push(e.t);
  }
  const t = Math.min(...cands);
  if (t !== saved) ls.set(SINCE_KEY, t);
  return t;
}

const fmtDate = (t) => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
function daysSince(t) {
  const d = Math.floor((Date.now() - t) / 86400e3);
  return d <= 0 ? 'bugün katıldın' : `${fmtNum(d)} gündür burada`;
}
function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
const scoreOf = (me, id) => {
  const v = me && me.scores ? me.scores[id] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

/** Son denemeler çizgisi (SVG). Düşük-iyi oyunlarda eksen ters: yukarı = daha iyi. */
function sparkline(list, up) {
  const W = 200, H = 44, P = 4;
  const vals = list.map((e) => e.s);
  const svg = h('svg', { class: 'pf-spark', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Son ${vals.length} deneme` });
  if (!vals.length) return svg;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i) => (vals.length === 1 ? W / 2 : P + (i / (vals.length - 1)) * (W - 2 * P));
  const y = (v) => {
    if (max === min) return H / 2;
    const t = (v - min) / span;
    return up ? H - P - t * (H - 2 * P) : P + t * (H - 2 * P);
  };
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  if (vals.length > 1) {
    svg.append(
      h('polygon', { class: 'pf-spark-area', points: `${x(0).toFixed(1)},${H} ${pts.join(' ')} ${x(vals.length - 1).toFixed(1)},${H}` }),
      h('polyline', { class: 'pf-spark-line', points: pts.join(' ') }),
    );
  }
  const bestV = up ? max : min;
  const bi = vals.lastIndexOf(bestV);
  svg.append(h('circle', { class: 'pf-spark-best', cx: x(bi).toFixed(1), cy: y(bestV).toFixed(1), r: '4' }));
  if (bi !== vals.length - 1) svg.append(h('circle', { class: 'pf-spark-last', cx: x(vals.length - 1).toFixed(1), cy: y(vals[vals.length - 1]).toFixed(1), r: '3' }));
  return svg;
}

function scrollToEl(el) {
  if (!el) return;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  try { el.focus({ preventScroll: true }); } catch { /* yok say */ }
}

/** Takma ad düzenleyici: kabuğunki varsa o, yoksa aynı davranışlı yedek. */
function editNick() {
  if (typeof shell.openNickEditor === 'function') { shell.openNickEditor(); return; }
  const me = store.me.get();
  const input = h('input', { class: 'input', id: 'pf-nick-input', maxlength: '24', value: me.nick || '', autocomplete: 'off' });
  let close;
  const save = () => {
    const v = cleanText(input.value, 24);
    if (v.length < 2) { fx.toast('Takma ad en az 2 karakter olmalı.', 'blood'); return; }
    store.me.patch({ nick: v }, { delay: 200 });
    fx.toast(`Artık sen "${v}" oldun.`, 'jade');
    close();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } });
  close = fx.modal(h('div', { class: 'stack' },
    h('span', { class: 'eyebrow' }, 'Fan Kartı'),
    h('h2', { class: 'h2' }, 'Takma adın'),
    h('div', { class: 'field' }, h('label', { for: 'pf-nick-input' }, 'Takma ad'), input),
    h('div', { class: 'row', style: 'justify-content:flex-end' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => close() }, 'Vazgeç'),
      h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Kaydet'),
    ),
  ), { label: 'Takma ad' });
}

function pressDog(btn) {
  if (typeof shell.pressDog === 'function') shell.pressDog(btn);
  else {
    store.me.patch((d) => { d.dog = (Number(d.dog) || 0) + 1; }, { delay: 1500 });
    sound.dogdogdog();
  }
}

// ------------------------------------------------------------------ bölüm
let api = null;

export default {
  mount(el, ctx) {
    const disposers = [];
    const on = (fn) => disposers.push(fn);
    const sections = {};
    let alive = true;

    const root = h('div', { class: 'wrap pf' });
    el.appendChild(root);

    // ================================================================ BAŞLIK
    const avatarBtn = h('button', { class: 'pf-avatar', type: 'button', 'aria-label': 'Avatar kahramanını seç' });
    const heroCap = h('span', { class: 'pf-avatar-cap' });
    const nickEl = h('h1', { class: 'pf-nick' });
    const editBtn = h('button', { class: 'btn ghost sm icon pf-edit', type: 'button', 'aria-label': 'Takma adını değiştir', title: 'Takma adını değiştir', onclick: editNick }, icon('pen', { size: 18 }));
    const lvlBadge = h('span', { class: 'pf-lvl' });
    const rankEl = h('span', { class: 'pf-rank' });
    const xpFill = h('span');
    const xpText = h('span', { class: 'pf-xp-val num' });
    const xpNext = h('span', { class: 'pf-xp-next' });
    const xpWhy = h('p', { class: 'pf-xp-why' });
    const chipsEl = h('div', { class: 'pf-chips' });
    const tile = (id, ico, label, onclick) => {
      const v = h('strong', { class: 'pf-tile-v num' }, '0');
      const s = h('span', { class: 'pf-tile-s' });
      const b = h('button', { class: `pf-tile pf-tile-${id}`, type: 'button', onclick },
        h('span', { class: 'pf-tile-ico', 'aria-hidden': 'true' }, icon(ico, { size: 20 })),
        h('span', { class: 'pf-tile-t' }, h('span', { class: 'pf-tile-l' }, label), v, s),
      );
      return { b, v, s };
    };
    const tDog = tile('dog', 'paw', 'DOG', (e) => { pressDog(e.currentTarget); });
    tDog.b.setAttribute('aria-label', 'DOG! Düğmeye bas, DOG sayın artsın');
    const tBdg = tile('bdg', 'medal', 'Rozet', () => go('rozetler'));
    const tRec = tile('rec', 'trophy', 'Rekor', () => go('rekorlar'));
    const tStr = tile('str', 'flame', 'Seri', () => go('gorevler'));

    avatarBtn.addEventListener('click', () => openAvatarPicker());

    const localBadge = h('span', { class: 'badge', title: 'Statik yayın: veriler yalnızca bu tarayıcıda', hidden: store.shared }, 'Bu cihazda');
    const hero = h('section', { class: 'pf-hero panel frame', 'aria-labelledby': 'pf-nick' },
      h('div', { class: 'pf-hero-art' }, avatarBtn, heroCap),
      h('div', { class: 'pf-hero-id' },
        h('div', { class: 'pf-eyebrow-row' },
          h('span', { class: 'eyebrow' }, 'Fan Kartı'),
          localBadge,
        ),
        h('div', { class: 'pf-nick-row' }, nickEl, editBtn),
        h('div', { class: 'pf-level' },
          h('div', { class: 'pf-level-top' }, lvlBadge, rankEl),
          h('div', { class: 'pf-xp' },
            h('span', { class: 'pf-xp-bar', 'aria-hidden': 'true' }, xpFill),
            h('div', { class: 'pf-xp-row' }, xpText, xpNext),
          ),
          xpWhy,
        ),
        chipsEl,
      ),
      h('div', { class: 'pf-tiles' }, tDog.b, tBdg.b, tRec.b, tStr.b),
    );
    nickEl.id = 'pf-nick';

    let paintedAvatar;
    function paintAvatar(id) {
      if (id === paintedAvatar) return;
      paintedAvatar = id;
      clear(avatarBtn);
      const art = avatarArt(id);
      const heroObj = id ? heroById(id) : null;
      avatarBtn.classList.toggle('empty', !id);
      avatarBtn.classList.toggle('flat', !!id && !art.render);
      if (art.render) avatarBtn.append(h('img', { class: 'pf-avatar-render', src: art.render, alt: '', decoding: 'async' }));
      else if (art.portrait) avatarBtn.append(h('img', { class: 'pf-avatar-portrait', src: art.portrait, alt: '', width: '256', height: '144', decoding: 'async' }));
      else avatarBtn.append(h('span', { class: 'pf-avatar-ph', 'aria-hidden': 'true' }, icon('paw', { size: 64, stroke: 1.4 })));
      avatarBtn.append(h('span', { class: 'pf-avatar-edit' }, icon(id ? 'pen' : 'plus', { size: 14, stroke: 2.2 }), id ? 'Değiştir' : 'Avatar seç'));
      avatarBtn.setAttribute('aria-label', heroObj ? `Avatar: ${heroObj.name}. Değiştirmek için seç` : 'Avatar kahramanını seç');
      heroCap.textContent = heroObj ? heroObj.name : 'Kahramanını seç';
    }

    let lastLevel = null;
    function paintHero() {
      const me = store.me.get();
      paintAvatar(avatarId(me));
      nickEl.textContent = me.nick || 'Anonim';
      nickEl.classList.toggle('long', (me.nick || '').length > 13);
      const x = fanXp(me);
      const L = fanLevel(x.xp);
      hero.style.setProperty('--rank', L.color);
      clear(lvlBadge).append(h('span', { class: 'pf-lvl-k' }, 'Seviye'), h('span', { class: 'pf-lvl-n num' }, String(L.level)));
      rankEl.textContent = L.rank;
      xpFill.style.transform = `scaleX(${Math.max(0, Math.min(1, L.pct)).toFixed(3)})`;
      xpText.textContent = `${fmtNum(L.xp)} XP`;
      xpNext.textContent = `Seviye ${L.level + 1} için ${fmtNum(L.next - L.xp)} XP`;
      clear(xpWhy).append(
        h('span', null, `Rozet ${x.badges}×${XP_RULES.badge}`), ' · ',
        h('span', null, `Görev ${x.quests}×${XP_RULES.quest}`), ' · ',
        h('span', null, `Oyun ${x.games}×${XP_RULES.game}`),
      );
      if (lastLevel != null && L.level > lastLevel) {
        fx.toast(h('span', null, 'Seviye atladın: ', h('strong', null, `${L.level} · ${L.rank}`)), 'jade', 3200);
        sound.win();
      }
      lastLevel = L.level;

      // çipler
      const arch = me.picks && me.picks.hangidog ? archetypeById(me.picks.hangidog) : null;
      const since = memberSince();
      clear(chipsEl).append(
        arch
          ? h('a', { class: 'pf-chip', href: `#karakterler--${arch.id}`, style: { '--cc': arch.color }, title: 'Hangi DOG’sun? sonucun' },
            h('span', { class: 'pf-dot', style: { background: arch.color } }), h('span', { class: 'pf-chip-k' }, 'Türün'), memeText(arch.name))
          : h('a', { class: 'pf-chip ghost', href: '#quizler--hangidog' }, icon('question', { size: 14 }), 'Hangi DOG’sun? Testi çöz'),
        h('span', { class: 'pf-chip', title: daysSince(since) }, icon('calendar', { size: 14 }), h('span', { class: 'pf-chip-k' }, 'Üye'), fmtDate(since)),
      );

      // kutular
      const earned = earnedSet(me);
      tDog.v.textContent = fmtNum(me.dog || 0);
      tDog.s.textContent = 'bas: DOG!';
      tBdg.v.textContent = `${earned.size}/${BADGES.length}`;
      tBdg.s.textContent = earned.size ? 'kazanıldı' : 'ilkini kap';
      const games = gameCatalog();
      const withScore = games.filter((g) => scoreOf(me, g.id) != null).length;
      tRec.v.textContent = `${withScore}/${games.length}`;
      tRec.s.textContent = 'oyunda rekor';
      const st = questStreak();
      tStr.v.textContent = `${st.current} gün`;
      tStr.s.textContent = st.best ? `en iyi: ${st.best} gün` : '3 görevi bitir';
    }

    // ================================================================ GEZİNME
    const nav = h('nav', { class: 'pf-nav', 'aria-label': 'Profil bölümleri' },
      NAV.map((n) => h('button', { class: 'chip pf-nav-chip', type: 'button', onclick: () => go(n.id) }, icon(n.icon, { size: 14 }), n.label)),
    );

    function go(id) {
      ctx.setSub(id);
      scrollToEl(sections[id]);
    }

    // ================================================================ GÖREVLER
    const qList = h('ol', { class: 'pf-q-list' });
    const qCount = h('span', { class: 'num' }, '00:00:00');
    const qStreak = h('span', { class: 'pf-q-streak' });
    const qFoot = h('p', { class: 'pf-q-foot' });
    sections.gorevler = h('section', { class: 'panel pf-quests', id: 'pf-gorevler', tabindex: '-1', 'aria-labelledby': 'pf-q-title' },
      h('div', { class: 'pf-head' },
        h('div', { class: 'pf-head-t' },
          h('span', { class: 'eyebrow' }, 'Her gün 3 görev'),
          h('h2', { class: 'h2', id: 'pf-q-title' }, 'Günlük Görevler'),
        ),
        h('div', { class: 'pf-q-meta' },
          h('span', { class: 'pf-q-reset', title: 'Görevler İstanbul saatiyle gece yarısı yenilenir' }, icon('hourglass', { size: 14 }), 'Yenilenmeye ', qCount),
          qStreak,
        ),
      ),
      qList,
      qFoot,
    );

    function questRow(q) {
      const pct = q.target ? q.progress / q.target : 0;
      const countText = `${fmtNum(q.progress)}/${fmtNum(q.target)}`;
      let act;
      if (q.done) {
        act = h('span', { class: 'pf-q-ok' }, icon('check', { size: 16, stroke: 2.6 }), `+${QUEST_XP} XP`);
      } else if (q.action === 'dog') {
        act = h('button', { class: 'btn primary sm pf-q-btn', type: 'button', onclick: (e) => pressDog(e.currentTarget) }, icon('paw', { size: 16 }), 'DOG!');
      } else {
        act = h('a', { class: 'btn ghost sm pf-q-btn', href: q.href || '#oyunlar' }, 'Git', icon('arrowRight', { size: 16 }));
      }
      return h('li', { class: `pf-q${q.done ? ' done' : ''}`, style: { '--qc': q.color || 'var(--ember)' } },
        h('span', { class: 'pf-q-ico', 'aria-hidden': 'true' }, icon(q.done ? 'check' : q.icon || 'star', { size: 20, stroke: q.done ? 2.4 : 1.8 })),
        h('div', { class: 'pf-q-body' },
          h('strong', { class: 'pf-q-text' }, memeText(q.text)),
          h('span', { class: 'pf-q-hint' }, q.detail || q.hint || ''),
        ),
        h('div', { class: 'pf-q-prog' },
          h('span', { class: 'pf-q-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(q.target), 'aria-valuenow': String(q.progress), 'aria-label': q.text },
            h('span', { style: { transform: `scaleX(${Math.max(0, Math.min(1, pct)).toFixed(3)})` } })),
          h('span', { class: 'pf-q-count num' }, countText),
        ),
        h('div', { class: 'pf-q-act' }, act),
      );
    }

    function paintQuests(status) {
      if (!status) return;
      clear(qList).append(...status.map(questRow));
      const st = questStreak();
      const doneN = status.filter((q) => q.done).length;
      clear(qStreak).append(icon('flame', { size: 14 }), st.current ? `Seri: ${st.current} gün` : 'Seri: henüz yok');
      if (st.best > st.current) qStreak.append(h('span', { class: 'dim' }, ` · en iyi ${st.best}`));
      qStreak.classList.toggle('hot', st.current > 0);
      clear(qFoot).append(
        doneN === status.length
          ? h('span', { class: 'jade' }, 'Bugünkü üç görev tamam. Yarın yenileri gelir; seriyi bozma.')
          : h('span', null, `Bugün ${doneN}/${status.length} tamam · her görev +${QUEST_XP} XP · üçü birden seriyi uzatır.`),
        h('span', { class: 'dim' }, ` Ömür boyu: ${fmtNum(completedQuestCount())} görev.`),
      );
    }
    const tickCountdown = () => { qCount.textContent = fmtCountdown(msToReset()); };
    tickCountdown();
    const tickTimer = setInterval(tickCountdown, 1000);
    on(() => clearInterval(tickTimer));

    // ================================================================ PAYLAŞIM KARTI
    const canvas = h('canvas', { class: 'pf-canvas', width: String(CARD_W), height: String(CARD_H), role: 'img', 'aria-label': 'Fan Kartı görseli' });
    const dlBtn = h('button', { class: 'btn primary', type: 'button' }, icon('download', { size: 18 }), 'Görseli indir');
    const cpBtn = h('button', { class: 'btn ghost', type: 'button' }, icon('copy', { size: 18 }), 'Panoya kopyala');
    sections.kart = h('section', { class: 'panel pf-share', id: 'pf-kart', tabindex: '-1', 'aria-labelledby': 'pf-share-title' },
      h('div', { class: 'pf-head' },
        h('div', { class: 'pf-head-t' },
          h('span', { class: 'eyebrow' }, 'Paylaş'),
          h('h2', { class: 'h2', id: 'pf-share-title' }, 'Fan Kartın'),
        ),
      ),
      h('p', { class: 'small muted' }, 'Kick sohbetine, Discord’a at: seviyen, en iyi üç rekorun, rozetlerin ve DOG sayın tek görselde.'),
      h('div', { class: 'pf-canvas-wrap' }, canvas),
      h('div', { class: 'pf-share-actions' }, dlBtn, cpBtn),
    );

    let cardSeq = 0;
    async function renderCard() {
      const seq = ++cardSeq;
      const me = store.me.get();
      const x = fanXp(me);
      const L = fanLevel(x.xp);
      const id = avatarId(me);
      const art = avatarArt(id);
      const [, render, portrait] = await Promise.all([cardFontsReady(), loadImage(art.render), art.render ? null : loadImage(art.portrait)]);
      if (!alive || seq !== cardSeq) return;
      const arch = me.picks && me.picks.hangidog ? archetypeById(me.picks.hangidog) : null;
      const recs = [...gameCatalog(), ...quizCatalog(), ...otherCatalog()]
        .map((e) => ({ e, v: scoreOf(me, e.id) }))
        .filter((r) => r.v != null)
        .sort((a, b) => strength(b.e, b.v) - strength(a.e, a.v))
        .slice(0, 3)
        .map((r) => ({ name: r.e.name, value: r.e.format(r.v) }));
      try {
        drawFanCard(canvas, {
          nick: me.nick || 'Anonim', level: L.level, rank: L.rank, rankColor: L.color, xp: L.xp, pct: L.pct, next: L.next,
          render, portrait, heroName: id ? (heroById(id) || {}).name : null,
          archetype: arch ? { name: arch.name, color: arch.color } : null,
          records: recs, badges: x.badges, badgesTotal: BADGES.length, dog: me.dog || 0,
          streak: questStreak().current, since: fmtDate(memberSince()),
        });
        canvas.setAttribute('aria-label', `Fan Kartı görseli: ${me.nick}, seviye ${L.level} ${L.rank}, ${x.badges} rozet, ${fmtNum(me.dog || 0)} DOG`);
      } catch (e) {
        console.error(e);
      }
    }

    function cardFileName() {
      const slug = (store.me.get().nick || 'fan').toLocaleLowerCase('tr-TR')
        .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'fan';
      return `fan-karti-${slug}-${dateStamp()}.png`;
    }

    function imageFallback(msg) {
      let url = '';
      try { url = canvas.toDataURL('image/png'); } catch { /* yok say */ }
      if (!url) { fx.toast('Görsel hazırlanamadı. Sayfayı yenileyip tekrar dene.', 'blood'); return; }
      let close;
      close = fx.modal(h('div', { class: 'stack' },
        h('span', { class: 'eyebrow' }, 'Fan Kartı'),
        h('h2', { class: 'h2' }, 'Görseli kaydet'),
        h('p', { class: 'small muted' }, msg),
        h('img', { class: 'pf-fallback-img', src: url, alt: 'Fan Kartı görseli', width: String(CARD_W), height: String(CARD_H) }),
        h('div', { class: 'row', style: 'justify-content:flex-end' },
          h('a', { class: 'btn ghost', href: url, download: cardFileName() }, icon('download', { size: 18 }), 'İndir'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => close() }, 'Tamam'),
        ),
      ), { label: 'Fan Kartı görseli', cls: 'pf-fallback-modal' });
    }

    dlBtn.addEventListener('click', async () => {
      await renderCard();
      if (isFramed()) {
        imageFallback('Bu pencere indirmeyi engelleyebilir. Görsele uzun basıp ya da sağ tıklayıp “Resmi kaydet” diyebilirsin.');
        return;
      }
      try {
        const blob = await canvasBlob(canvas);
        if (!downloadBlob(blob, cardFileName())) throw new Error('indirme');
        fx.toast('Fan Kartı indirildi. DOG DOG DOG!', 'jade');
        sound.coin();
      } catch {
        imageFallback('İndirme engellendi. Görsele uzun basıp ya da sağ tıklayıp “Resmi kaydet” diyebilirsin.');
      }
    });

    cpBtn.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function' || typeof window.ClipboardItem !== 'function') throw new Error('desteklenmiyor');
        // Safari: ClipboardItem tıklama anında, içerik söz (Promise) olarak verilmeli
        const blobP = renderCard().then(() => canvasBlob(canvas));
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blobP })]);
        fx.toast('Kart panoya kopyalandı: sohbete yapıştır.', 'jade');
        sound.coin();
      } catch {
        fx.toast('Tarayıcın görseli panoya kopyalamaya izin vermedi. “Görseli indir” ile kaydet.', 'blood', 3600);
      }
    });

    // ================================================================ REKORLAR
    const recGames = h('div', { class: 'pf-rec-grid' });
    const recQuiz = h('div', { class: 'pf-rec-grid' });
    const recOther = h('div', { class: 'pf-rec-grid' });
    const recOtherWrap = h('div', { class: 'pf-rec-group' }, h('h3', { class: 'pf-sub' }, 'Diğer'), recOther);
    const recSum = h('span', { class: 'pf-sum' });
    sections.rekorlar = h('section', { class: 'panel pf-records', id: 'pf-rekorlar', tabindex: '-1', 'aria-labelledby': 'pf-rec-title' },
      h('div', { class: 'pf-head' },
        h('div', { class: 'pf-head-t' },
          h('span', { class: 'eyebrow' }, 'En iyi skorlar'),
          h('h2', { class: 'h2', id: 'pf-rec-title' }, 'Rekorlar'),
        ),
        recSum,
      ),
      h('p', { class: 'small muted pf-lead' }, 'Her oyunda en iyi skorun ve son denemelerin. Çizgide yukarı her zaman daha iyi demek; altın nokta rekorun.'),
      h('div', { class: 'pf-rec-group' }, h('h3', { class: 'pf-sub' }, 'Oyun Salonu'), recGames),
      h('div', { class: 'pf-rec-group' }, h('h3', { class: 'pf-sub' }, 'Quizler'), recQuiz),
      recOtherWrap,
    );

    function recCard(entry, me) {
      const list = history.get(entry.id);
      if (entry.special === 'hangidog') {
        const arch = me.picks && me.picks.hangidog ? archetypeById(me.picks.hangidog) : null;
        return h('a', { class: `pf-rec${arch ? ' has' : ' none'}`, href: arch ? `#karakterler--${arch.id}` : entry.href, style: { '--gc': arch ? arch.color : entry.color } },
          h('span', { class: 'pf-rec-head' },
            h('span', { class: 'pf-rec-ico', 'aria-hidden': 'true' }, icon(entry.icon, { size: 18 })),
            h('span', { class: 'pf-rec-name' }, entry.name),
          ),
          arch
            ? [h('span', { class: 'pf-rec-k' }, 'Türün'), h('strong', { class: 'pf-rec-arch' }, memeText(arch.name)), h('span', { class: 'pf-rec-meta' }, arch.title), h('span', { class: 'pf-rec-cta' }, 'Arşivde gör', icon('arrowRight', { size: 14 }))]
            : [h('span', { class: 'pf-rec-empty' }, 'Henüz teşhis yok'), h('span', { class: 'pf-rec-cta' }, 'Testi çöz', icon('arrowRight', { size: 14 }))],
        );
      }
      const best = scoreOf(me, entry.id);
      const has = best != null;
      const last = list.length ? list[list.length - 1] : null;
      const verb = entry.kind === 'quiz' ? 'Çöz' : 'Oyna';
      return h('a', { class: `pf-rec${has ? ' has' : ' none'}`, href: entry.href, style: { '--gc': entry.color } },
        h('span', { class: 'pf-rec-head' },
          h('span', { class: 'pf-rec-ico', 'aria-hidden': 'true' }, icon(entry.icon, { size: 18 })),
          h('span', { class: 'pf-rec-name' }, memeText(entry.name)),
        ),
        has
          ? [
            h('span', { class: 'pf-rec-k' }, entry.up ? 'Rekor' : 'Rekor · düşük iyi'),
            h('strong', { class: 'pf-rec-best num' }, entry.format(best)),
            list.length ? sparkline(list, entry.up) : null,
            h('span', { class: 'pf-rec-meta' }, list.length ? `${list.length >= 20 ? 'Son 20' : list.length} deneme · son: ${timeAgo(last.t)}` : 'Deneme geçmişi yok'),
            h('span', { class: 'pf-rec-cta' }, 'Tekrar', icon('arrowRight', { size: 14 })),
          ]
          : [
            h('span', { class: 'pf-rec-empty' }, entry.where ? `${entry.where} bölümünde` : 'Henüz skor yok'),
            h('span', { class: 'pf-rec-cta' }, verb, icon('arrowRight', { size: 14 })),
          ],
      );
    }

    function paintRecords() {
      const me = store.me.get();
      const games = gameCatalog();
      const quizzes = quizCatalog();
      const extraIds = [...Object.keys(me.scores || {})];
      const others = otherCatalog(extraIds);
      clear(recGames).append(...games.map((g) => recCard(g, me)));
      clear(recQuiz).append(...quizzes.map((q) => recCard(q, me)));
      clear(recOther).append(...others.map((o) => recCard(o, me)));
      const n = games.filter((g) => scoreOf(me, g.id) != null).length;
      clear(recSum).append(icon('trophy', { size: 16 }), h('strong', { class: 'num' }, `${n}/${games.length}`), h('span', { class: 'dim' }, ' oyunda rekor'));
    }

    // ================================================================ ROZETLER
    const bdgBody = h('div', { class: 'pf-bdg-groups' });
    const bdgSum = h('span', { class: 'pf-sum' });
    const bdgMeter = h('span', { class: 'pf-meter', 'aria-hidden': 'true' }, h('span'));
    sections.rozetler = h('section', { class: 'panel pf-badges', id: 'pf-rozetler', tabindex: '-1', 'aria-labelledby': 'pf-bdg-title' },
      h('div', { class: 'pf-head' },
        h('div', { class: 'pf-head-t' },
          h('span', { class: 'eyebrow' }, 'Başarımlar'),
          h('h2', { class: 'h2', id: 'pf-bdg-title' }, 'Rozetler'),
        ),
        h('div', { class: 'pf-bdg-sumwrap' }, bdgSum, bdgMeter),
      ),
      h('p', { class: 'small muted pf-lead' }, `Her rozet +${XP_RULES.badge} XP. Kilitli rozetin üstünde ne yapman gerektiği yazar.`),
      bdgBody,
    );

    function paintBadges() {
      const me = store.me.get();
      const earned = earnedSet(me);
      clear(bdgBody);
      for (const [gid, label] of Object.entries(BADGE_GROUPS)) {
        const list = BADGES.filter((b) => b.group === gid);
        if (!list.length) continue;
        const got = list.filter((b) => earned.has(b.id)).length;
        bdgBody.append(h('div', { class: 'pf-bdg-group' },
          h('h3', { class: 'pf-sub' }, label, h('span', { class: 'pf-sub-n num' }, `${got}/${list.length}`)),
          h('div', { class: 'pf-bdg-grid' }, list.map((b) => {
            const won = earned.has(b.id);
            const prog = won ? null : badgeProgress(b, me);
            return h('a', { class: `pf-bdg${won ? ' on' : ''}`, href: badgeHref(b), style: { '--bc': b.color }, 'aria-label': `${b.name}: ${won ? 'kazanıldı' : 'kilitli'}. ${b.how}` },
              h('span', { class: 'pf-bdg-ico', 'aria-hidden': 'true' },
                icon(b.icon, { size: 22, stroke: 1.9 }),
                won ? null : h('span', { class: 'pf-bdg-lock' }, icon('lock', { size: 11, stroke: 2.2 })),
              ),
              h('span', { class: 'pf-bdg-t' },
                h('span', { class: 'pf-bdg-name' }, memeText(b.name)),
                h('span', { class: 'pf-bdg-how' }, b.how),
                won
                  ? h('span', { class: 'pf-bdg-state' }, icon('check', { size: 12, stroke: 2.4 }), 'Kazanıldı')
                  : prog
                    ? h('span', { class: 'pf-bdg-prog' },
                      prog.pct != null ? h('span', { class: 'pf-bdg-bar' }, h('span', { style: { transform: `scaleX(${prog.pct})` } })) : null,
                      h('span', { class: 'pf-bdg-prog-t' }, prog.text))
                    : null,
              ),
            );
          })),
        ));
      }
      clear(bdgSum).append(icon('medal', { size: 16 }), h('strong', { class: 'num' }, `${earned.size}/${BADGES.length}`), h('span', { class: 'dim' }, ' rozet'));
      bdgMeter.firstChild.style.transform = `scaleX(${(earned.size / BADGES.length).toFixed(3)})`;
    }

    // ================================================================ VERİ
    const fileIn = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
    const usageEl = h('span', { class: 'pf-usage num' });
    const dataLead = h('p', { class: 'small muted pf-lead' });
    const paintMode = () => {
      localBadge.hidden = store.shared;
      dataLead.textContent = store.shared
        ? 'Profilin bu sitenin sunucusunda ve bu tarayıcıda saklanır. Sıfırlama yalnızca bu tarayıcıdaki kopyayı siler.'
        : 'Burada hesap yok: skorların, rozetlerin, görevlerin ve DOG sayın yalnızca bu tarayıcıda saklanır. Tarayıcı verisini silersen ya da cihaz değiştirirsen kaybolur; ara sıra yedek al.';
    };
    paintMode();
    store.ready.then(() => { if (alive) paintMode(); });
    const paintUsage = () => {
      const u = storageUsage();
      usageEl.textContent = `${fmtNum(u.keys)} kayıt · ~${fmtNum(Math.max(1, Math.round(u.bytes / 1024)))} KB`;
    };
    sections.veri = h('section', { class: 'panel pf-data', id: 'pf-veri', tabindex: '-1', 'aria-labelledby': 'pf-data-title' },
      h('div', { class: 'pf-head' },
        h('div', { class: 'pf-head-t' },
          h('span', { class: 'eyebrow' }, 'Veri'),
          h('h2', { class: 'h2', id: 'pf-data-title' }, 'Verilerin'),
        ),
        usageEl,
      ),
      dataLead,
      h('div', { class: 'pf-data-actions' },
        h('button', { class: 'btn gold', type: 'button', onclick: () => { exportData(); } }, icon('download', { size: 18 }), 'Verilerimi dışa aktar'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => fileIn.click() }, icon('upload', { size: 18 }), 'İçe aktar'),
        h('button', { class: 'btn danger', type: 'button', onclick: askReset }, icon('trash', { size: 18 }), 'Sıfırla'),
        fileIn,
      ),
      h('p', { class: 'xsmall dim' }, 'Yedek bir JSON dosyasıdır: takma ad, skorlar, deneme geçmişi, rozetlere giden her şey, görev serisi ve site ayarları.'),
    );

    fileIn.addEventListener('change', async () => {
      const file = fileIn.files && fileIn.files[0];
      fileIn.value = '';
      if (!file) return;
      let b;
      try { b = await readBackup(file); } catch (e) { fx.toast(e.message || 'Yedek okunamadı.', 'blood', 3600); return; }
      const when = b.exportedAt ? new Date(b.exportedAt) : null;
      const ok = await fx.confirm(
        `“${b.me.nick}” yedeği yüklensin mi? Bu cihazdaki profil (skorlar, geçmiş, görevler) yedektekiyle değiştirilecek${when && !Number.isNaN(when.getTime()) ? ` (${fmtDate(when.getTime())} tarihli)` : ''}.`,
        { ok: 'Yükle', cancel: 'Vazgeç' },
      );
      if (ok) applyBackup(b);
    });

    async function askReset() {
      const ok = await fx.confirm(
        'Her şey silinsin mi? Bu cihazdaki takma adın, DOG sayın, bütün skorların, rozetlerin, görev serin, eklediğin espriler ve site ayarları silinir. Geri alınamaz; önce “Verilerimi dışa aktar” ile yedek alabilirsin.',
        { ok: 'Evet, sıfırla', cancel: 'Vazgeç', danger: true },
      );
      if (ok) resetData();
    }

    // ================================================================ yerleşim
    root.append(
      hero,
      nav,
      h('div', { class: 'pf-duo' }, sections.gorevler, sections.kart),
      sections.rekorlar,
      sections.rozetler,
      sections.veri,
      h('p', { class: 'pf-sign' }, h('span', { class: 'stamp' }, 'DOG DOG DOG')),
    );

    // ================================================================ güncelleme
    let raf = 0;
    let cardTimer = 0;
    const paintAll = () => {
      raf = 0;
      if (!alive) return;
      paintHero();
      paintRecords();
      paintBadges();
      paintUsage();
      clearTimeout(cardTimer);
      cardTimer = setTimeout(renderCard, 250);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(paintAll); };
    paintHero();
    paintRecords();
    paintBadges();
    paintUsage();
    renderCard();
    on(store.me.subscribe(schedule));
    on(history.subscribe(schedule));
    on(subscribeQuests((status) => { if (!alive) return; paintQuests(status); schedule(); }));
    on(() => { if (raf) cancelAnimationFrame(raf); clearTimeout(cardTimer); });

    // Sıfırlama / içe aktarma sonrası bilgi
    let flash = null;
    try { flash = sessionStorage.getItem('csk-flash'); sessionStorage.removeItem('csk-flash'); } catch { /* yok say */ }
    if (flash === 'reset') setTimeout(() => fx.toast(`Temiz sayfa. Yeni bir fan doğdu: ${store.me.get().nick}`, 'jade', 3600), 400);
    if (flash === 'import') setTimeout(() => fx.toast('Yedek yüklendi. Tekrar hoş geldin!', 'jade', 3200), 400);

    api = {
      scrollTo(sub) {
        if (sub && sections[sub]) scrollToEl(sections[sub]);
        else window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      },
    };
    // Kabuk bağladıktan sonra en üste kaydırır; alt sayfaya ondan sonra git
    if (ctx.sub && sections[ctx.sub]) {
      const t = setTimeout(() => api && api.scrollTo(ctx.sub), 80);
      on(() => clearTimeout(t));
    }

    return () => {
      alive = false;
      api = null;
      for (const d of disposers) { try { d(); } catch { /* yok say */ } }
      root.remove();
    };
  },
  onSub(sub) {
    if (api) api.scrollTo(sub);
  },
};
