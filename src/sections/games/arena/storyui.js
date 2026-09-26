// 1vDOQUZ Arena — hikâye arayüzü (tembel parça): bölüm haritası, görev brifingi, diyalog kartları, final jeneriği.
// arena.js yalnızca Hikâye açılınca import('./storyui.js') yapar. Veri: story.js. Stiller: story.css.
//
//   mountCampaign(el, ctx) → temizlik     ctx: { heroId, mission?, onPlay(missionId), onClose(), onCodex?(), heroInfo(id) }
//   createDialogue(host, opts) → { play(cards, { heroId }) → Promise<'done'|'skip'>, key(e) → bool, close(), open }
//   mountFinale(el, ctx) → temizlik       ctx: { stars, maxStars, onCodex?(), onMenu() }
//   speakerNode(sp, cls)                  konuşan portresi (görsel yoksa glif + renk; asla kırık görsel yok)
//
// Erişilebilirlik: bölümler role=tablist (oklar), görev kartları radyo grubu, diyalog metni aria-live (tam metin tek
// seferde okunur; ekrandaki daktilo efekti aria-hidden), Boşluk/Enter ilerletir, Esc ya da “Atla” geçer.

import './story.css';
import { h, clear, fmtNum, prefersReducedMotion } from '../../../core/dom.js';
import { icon } from '../../../core/icons.js';
import { artUrl } from '../../../core/assets.js';
import { glyph } from './glyphs.js';
import { HEROES } from './heroes.js';
import { UNITS } from './units.js';
import * as S from './story.js';

const heroInfoOf = (id) => {
  const H = HEROES[id];
  return H ? { name: H.name, color: H.color, role: H.role } : { name: id, color: '#43d6a0' };
};

// ------------------------------------------------------------------ portreler
/** Konuşan/boss portresi: fal görseli varsa img, yoksa renkli zeminde glif. Görsel yüklenemezse glife döner. */
export function speakerNode(sp, cls = '') {
  const wrap = h('span', { class: `ars-pt ${cls}${sp.hero ? ' is-hero' : ''}`, style: { '--sc': sp.color || '#e9b949' }, 'aria-hidden': 'true' });
  const fallback = () => { clear(wrap); wrap.classList.add('is-glyph'); wrap.appendChild(h('span', { class: 'ars-pt-glyph', html: glyph(sp.glyph || 'paw') })); };
  const url = sp.art ? artUrl(sp.art) : null;
  if (url) {
    const img = h('img', { src: url, alt: '', decoding: 'async', draggable: 'false' });
    img.addEventListener('error', fallback, { once: true });
    wrap.appendChild(img);
  } else fallback();
  return wrap;
}
/** Bölüm afişi (16:9) arka planı: görsel ya da bölüm rengiyle degrade. */
function bannerNode(C, cls = '') {
  const url = artUrl(C.art);
  const el = h('div', { class: `ars-banner ${cls}${url ? '' : ' is-fallback'}`, style: { '--cc': C.color } });
  if (url) {
    const img = h('img', { src: url, alt: '', decoding: 'async', draggable: 'false' });
    img.addEventListener('error', () => { img.remove(); el.classList.add('is-fallback'); }, { once: true });
    el.appendChild(img);
  }
  el.appendChild(h('span', { class: 'ars-banner-roman', 'aria-hidden': 'true' }, C.roman));
  return el;
}
function starRow(n, max = 3, cls = '') {
  return h('span', { class: `ars-stars ${cls}`, role: 'img', 'aria-label': `${n}/${max} yıldız` },
    Array.from({ length: max }, (_, i) => h('span', { class: i < n ? 'on' : '', html: glyph('star') })));
}
const fmtSec = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

// ------------------------------------------------------------------ bölüm haritası
export function mountCampaign(el, ctx = {}) {
  const P = S.storyProgress();
  const heroInfo = ctx.heroInfo || heroInfoOf;
  let chapterN = S.isMission(ctx.mission) ? S.MISSIONS[ctx.mission].chapter : P.chapter;
  let missionId = S.isMission(ctx.mission) ? ctx.mission : null;
  if (!P.chapters[chapterN - 1].unlocked) chapterN = P.chapter;
  const pickMission = (n) => {
    const C = S.CHAPTERS[n - 1];
    return C.missions.find((id) => P.missions[id].unlocked && !P.missions[id].won) || [...C.missions].reverse().find((id) => P.missions[id].unlocked) || C.missions[0];
  };
  if (!missionId || S.MISSIONS[missionId].chapter !== chapterN) missionId = pickMission(chapterN);

  const root = h('section', { class: 'ars-camp', 'aria-label': 'Hikâye: Dokuzun Laneti' });
  const back = h('button', { class: 'btn ghost sm ars-back', type: 'button', onclick: () => ctx.onClose && ctx.onClose() }, icon('arrowLeft', { size: 16 }), 'Modlar');
  const codexBtn = ctx.onCodex ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => ctx.onCodex() }, icon('book', { size: 16 }), 'Hikâye kartları') : null;
  root.appendChild(h('header', { class: 'ars-head' },
    back,
    h('div', { class: 'ars-head-t' },
      h('span', { class: 'eyebrow' }, 'Hikâye modu · 5 bölüm, 15 görev'),
      h('h2', { class: 'ars-title' }, 'Dokuzun Laneti'),
    ),
    h('div', { class: 'ars-head-side' },
      h('span', { class: 'ars-prog', title: 'Toplam yıldız' }, h('span', { class: 'ars-prog-star', html: glyph('star') }), h('b', { class: 'num' }, `${P.stars}`), h('span', null, `/${P.maxStars}`)),
      h('span', { class: 'ars-prog' }, h('b', { class: 'num' }, `${P.wins}`), h('span', null, `/${P.total} görev`)),
      codexBtn,
    ),
  ));

  // bölüm sekmeleri
  const tabs = h('div', { class: 'ars-tabs', role: 'tablist', 'aria-label': 'Bölümler' });
  const tabEls = [];
  for (const C of S.CHAPTERS) {
    const cp = P.chapters[C.n - 1];
    const url = artUrl(C.art);
    const t = h('button', {
      class: `ars-tab${cp.unlocked ? '' : ' locked'}${cp.done ? ' done' : ''}`, type: 'button', role: 'tab', id: `ars-tab-${C.n}`,
      'aria-controls': 'ars-panel', 'aria-selected': 'false', tabindex: '-1', style: { '--cc': C.color },
      'aria-label': `${C.roman}. bölüm: ${C.name}${cp.unlocked ? `, ${cp.stars}/9 yıldız${cp.done ? ', tamamlandı' : ''}` : ', kilitli'}`,
    },
      h('span', { class: 'ars-tab-bg', style: url ? { backgroundImage: `url("${url}")` } : null, 'aria-hidden': 'true' }),
      h('span', { class: 'ars-tab-n' }, C.roman),
      h('span', { class: 'ars-tab-name' }, C.name),
      cp.unlocked ? h('span', { class: 'ars-tab-stars num' }, h('span', { html: glyph('star') }), `${cp.stars}/9`) : h('span', { class: 'ars-tab-lock', html: glyph('lock') }),
    );
    t.addEventListener('click', () => { if (cp.unlocked) setChapter(C.n, false); else lockHint(C.n); });
    t.addEventListener('keydown', onTabKey);
    tabs.appendChild(t);
    tabEls.push(t);
  }
  const hint = h('p', { class: 'ars-hint', role: 'status', 'aria-live': 'polite' });
  const panel = h('div', { class: 'ars-panel', id: 'ars-panel', role: 'tabpanel' });
  root.append(tabs, hint, panel);
  el.appendChild(root);

  function onTabKey(e) {
    const i = chapterN - 1;
    let j = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = i + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = i - 1;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = S.CHAPTERS.length - 1;
    if (j == null) return;
    e.preventDefault();
    j = Math.max(0, Math.min(S.CHAPTERS.length - 1, j));
    // kilitli bölüme odak gitmez: son açık bölümde durur
    while (j > 0 && !P.chapters[j].unlocked) j -= 1;
    setChapter(j + 1, true);
  }
  function lockHint(n) {
    const prev = S.CHAPTERS[n - 2];
    hint.textContent = `${S.CHAPTERS[n - 1].roman}. bölüm kilitli: önce ${prev.roman}. bölümün boss görevini (${prev.bossName}) kazan.`;
  }

  function setChapter(n, focus) {
    chapterN = n;
    missionId = pickMission(n);
    hint.textContent = '';
    render();
    if (focus) tabEls[n - 1].focus();
  }

  function render() {
    tabEls.forEach((t, i) => {
      const on = i === chapterN - 1;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      t.classList.toggle('on', on);
    });
    panel.setAttribute('aria-labelledby', `ars-tab-${chapterN}`);
    const C = S.CHAPTERS[chapterN - 1];
    const cp = P.chapters[chapterN - 1];
    clear(panel);
    panel.style.setProperty('--cc', C.color);
    // sol: bölüm afişi + görev listesi
    const boss = UNITS[C.boss];
    const head = h('div', { class: 'ars-chap' },
      bannerNode(C, 'ars-chap-banner'),
      h('div', { class: 'ars-chap-over' },
        h('span', { class: 'eyebrow' }, `${C.roman}. bölüm${cp.done ? ' · tamamlandı' : ''}`),
        h('h3', { class: 'ars-chap-name' }, C.name),
        h('p', { class: 'ars-chap-blurb' }, C.blurb),
        h('div', { class: 'ars-chap-chips' },
          h('span', { class: 'ars-chip is-boss', style: { '--sc': (boss && boss.color) || C.color } }, speakerNode({ art: C.bossArt, glyph: (boss && boss.glyph) || 'skull', color: (boss && boss.color) || C.color }, 'xs'), h('span', null, 'Boss: ', h('b', null, C.bossName))),
          C.reward ? h('span', { class: `ars-chip is-reward${cp.done ? ' got' : ''}` }, h('span', { class: 'ars-chip-i', html: glyph(C.reward.hero) }), h('span', null, cp.done ? 'Katıldı: ' : 'Ödül: ', h('b', null, heroInfo(C.reward.hero).name))) : null,
        ),
      ),
    );
    const list = h('div', { class: 'ars-missions', role: 'radiogroup', 'aria-label': `${C.name} görevleri` });
    const cards = [];
    C.missions.forEach((id, i) => {
      const M = S.MISSIONS[id];
      const mp = P.missions[id];
      const on = id === missionId;
      const b = h('button', {
        class: `ars-mcard${mp.unlocked ? '' : ' locked'}${mp.won ? ' won' : ''}${M.bossMission ? ' boss' : ''}${on ? ' on' : ''}`,
        type: 'button', role: 'radio', 'aria-checked': String(on), tabindex: on ? '0' : '-1', dataset: { mission: id },
        'aria-label': `Görev ${i + 1}: ${M.name}. ${M.kicker}.${mp.unlocked ? ` ${mp.stars}/3 yıldız.` : ' Kilitli.'}`,
      },
        h('span', { class: 'ars-mcard-n num' }, M.bossMission ? h('span', { html: glyph('skull') }) : String(i + 1)),
        h('span', { class: 'ars-mcard-t' }, h('strong', null, M.name), h('span', { class: 'ars-mcard-k' }, M.kicker)),
        mp.unlocked ? starRow(mp.stars) : h('span', { class: 'ars-mcard-lock', html: glyph('lock') }),
      );
      b.addEventListener('click', () => {
        if (!mp.unlocked) { hint.textContent = `“${M.name}” kilitli: önce “${S.MISSIONS[C.missions[i - 1]].name}” görevini kazan.`; return; }
        missionId = id;
        render();
        panel.querySelector(`.ars-mcard[data-mission="${id}"]`)?.focus();
      });
      b.addEventListener('keydown', (e) => {
        let j = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = i + 1;
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = i - 1;
        if (j == null) return;
        e.preventDefault();
        j = Math.max(0, Math.min(2, j));
        if (!P.missions[C.missions[j]].unlocked) return;
        missionId = C.missions[j];
        render();
        panel.querySelector(`.ars-mcard[data-mission="${missionId}"]`)?.focus();
      });
      cards.push(b);
      list.appendChild(b);
    });
    const left = h('div', { class: 'ars-col ars-col-l' }, head, list);
    panel.append(left, briefEl(missionId));
  }

  function briefEl(id) {
    const M = S.MISSIONS[id];
    const mp = P.missions[id];
    const mc = S.missionConfig(id);
    const goals = S.requiredGoals(id);
    const rules = S.starRules(id);
    const boss = M.boss ? UNITS[M.boss] : null;
    const bossSpeaker = boss ? Object.values(S.SPEAKERS).find((sp) => sp.name === S.CHAPTER_OF[id].bossName) : null;
    const start = h('button', { class: 'btn primary lg ars-play', type: 'button', disabled: !mp.unlocked }, icon('play', { size: 18 }), h('span', null, mp.won ? 'Yeniden oyna' : 'Göreve başla'));
    start.addEventListener('click', () => { if (mp.unlocked && ctx.onPlay) ctx.onPlay(id); });
    const recs = (M.heroes && M.heroes.rec) || [];
    const guest = M.heroes && M.heroes.guest;
    const lvl = mc.modifiers.startLevel || 1;
    const gold = (mc.modifiers.startGold || 0) + 250;
    return h('article', { class: `ars-brief${M.bossMission ? ' is-boss' : ''}`, 'aria-label': `${M.name} görev brifingi` },
      h('div', { class: 'ars-brief-head' },
        h('div', null,
          h('span', { class: 'eyebrow' }, `${S.CHAPTER_OF[id].roman}.${M.index} · ${M.kicker}`),
          h('h3', { class: 'ars-brief-name' }, M.name),
        ),
        boss ? speakerNode({ art: (bossSpeaker && bossSpeaker.art) || S.CHAPTER_OF[id].bossArt, glyph: boss.glyph || 'skull', color: boss.color }, 'md ars-brief-boss') : null,
      ),
      h('p', { class: 'ars-brief-text' }, M.brief),
      h('div', { class: 'ars-brief-grid' },
        h('section', { class: 'ars-goals' },
          h('h4', { class: 'ars-h4' }, 'Hedef'),
          h('ul', null, goals.map((g) => h('li', null, h('span', { class: 'ars-dot', 'aria-hidden': 'true' }), g))),
        ),
        h('section', { class: 'ars-starrules' },
          h('h4', { class: 'ars-h4' }, 'Yıldızlar', h('span', { class: 'ars-h4-note' }, mp.stars ? ` · en iyin ${mp.stars}/3${mp.best ? ` · ${fmtSec(mp.best)}` : ''}` : ' · her bonus +1')),
          h('ol', null, rules.map((r, i) => h('li', { class: i < mp.stars ? 'got' : '' }, h('span', { class: 'ars-star-i', html: glyph('star'), 'aria-hidden': 'true' }), r))),
        ),
      ),
      h('div', { class: 'ars-brief-meta' },
        h('span', { class: 'ars-meta' }, icon('user', { size: 14 }), 'Başlangıç: ', h('b', null, `${lvl}. seviye`), ' · ', h('b', { class: 'num' }, fmtNum(gold)), ' altın', mc.prep ? ` · ${mc.prep} sn hazırlık` : ''),
        recs.length ? h('span', { class: 'ars-meta ars-recs' }, 'Önerilen: ', recs.map((r) => h('span', { class: 'ars-hero-chip', style: { '--hc': heroInfo(r).color }, title: heroInfo(r).name }, h('span', { class: 'ars-hero-chip-i', html: glyph(r) }), heroInfo(r).name))) : null,
        guest ? h('span', { class: 'ars-meta ars-guest' }, icon('unlock', { size: 14 }), h('b', null, heroInfo(guest).name), ' bu görevde misafir: kilitli olsa da oynanabilir.') : null,
      ),
      M.tips && M.tips.length ? h('ul', { class: 'ars-tips' }, M.tips.map((t) => h('li', null, icon('bulb', { size: 14 }), t))) : null,
      h('div', { class: 'ars-brief-cta' }, start, h('span', { class: 'ars-cta-note xsmall muted' }, 'Sonraki ekranda kahramanını seç.')),
    );
  }

  render();
  // ilk odak: seçili görev kartı (klavye kullanıcıları doğrudan listeye iner)
  const t0 = setTimeout(() => { try { (panel.querySelector('.ars-mcard.on') || tabEls[chapterN - 1]).focus({ preventScroll: true }); } catch { /* yok say */ } }, 40);
  return () => { clearTimeout(t0); root.remove(); };
}

// ------------------------------------------------------------------ diyalog
export function createDialogue(host, opts = {}) {
  const reduce = prefersReducedMotion();
  const heroInfo = opts.heroInfo || heroInfoOf;
  const onSeen = typeof opts.onSeen === 'function' ? opts.onSeen : null;
  const pt = h('div', { class: 'ars-talk-pt' });
  const name = h('strong', { class: 'ars-talk-name' });
  const role = h('span', { class: 'ars-talk-role' });
  const shown = h('p', { class: 'ars-talk-text', 'aria-hidden': 'true' });
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const count = h('span', { class: 'ars-talk-count num', 'aria-hidden': 'true' });
  const skip = h('button', { class: 'btn ghost sm ars-talk-skip', type: 'button' }, 'Atla', h('span', { class: 'kbd' }, 'Esc'));
  const next = h('button', { class: 'btn primary sm ars-talk-next', type: 'button' }, h('span', { class: 'ars-talk-next-l' }, 'Devam'), h('span', { class: 'kbd' }, 'Enter'));
  const card = h('div', { class: 'ars-talk-card' },
    pt,
    h('div', { class: 'ars-talk-body' },
      h('div', { class: 'ars-talk-who' }, name, role),
      shown, live,
      h('div', { class: 'ars-talk-foot' }, count, h('span', { class: 'ars-talk-sp' }), skip, next),
    ),
  );
  const root = h('div', { class: 'ars-talk', role: 'dialog', 'aria-modal': 'false', 'aria-label': 'Hikâye diyaloğu', hidden: true }, card);
  host.appendChild(root);

  let cards = [];
  let idx = 0;
  let heroId = 'okcu';
  let resolve = null;
  let typing = null;
  let full = '';

  function stopType() { if (typing) { clearInterval(typing); typing = null; } shown.textContent = full; card.classList.remove('typing'); }
  function show(i) {
    const c = cards[i];
    const sp = S.speakerOf(c.who, heroId, heroInfo);
    const text = (c.alt && c.alt[heroId]) || c.text;
    root.style.setProperty('--sc', sp.color || '#e9b949');
    root.classList.toggle('is-quote', !!c.quote);
    clear(pt).appendChild(speakerNode(sp, 'lg'));
    name.textContent = sp.name;
    role.textContent = sp.role ? ` · ${sp.role}` : '';
    full = text;
    live.textContent = `${sp.name}: ${text}`;
    count.textContent = `${i + 1}/${cards.length}`;
    next.querySelector('.ars-talk-next-l').textContent = i >= cards.length - 1 ? 'Kapat' : 'Devam';
    if (c.card && onSeen) { try { onSeen(c.card); } catch { /* yok say */ } }
    if (typing) clearInterval(typing);
    if (reduce) { shown.textContent = text; return; }
    let n = 0;
    shown.textContent = '';
    card.classList.add('typing');
    const step = Math.max(1, Math.round(text.length / 60));
    typing = setInterval(() => {
      n = Math.min(text.length, n + step);
      shown.textContent = text.slice(0, n);
      if (n >= text.length) stopType();
    }, 16);
  }
  function finish(how) {
    stopType();
    // atlanan kartların Kodeks kayıtları da düşer (hikâye kartları Kodeks’ten okunabilir)
    if (how === 'skip' && onSeen) for (let i = idx + 1; i < cards.length; i++) if (cards[i].card) { try { onSeen(cards[i].card); } catch { /* yok say */ } }
    root.hidden = true;
    root.classList.remove('on');
    const r = resolve;
    resolve = null;
    cards = [];
    if (r) r(how);
  }
  function advance() {
    if (!resolve) return;
    if (typing) { stopType(); return; }
    if (idx >= cards.length - 1) { finish('done'); return; }
    idx += 1;
    show(idx);
  }
  next.addEventListener('click', (e) => { e.stopPropagation(); advance(); });
  skip.addEventListener('click', (e) => { e.stopPropagation(); finish('skip'); });
  // kartın herhangi bir yerine dokunmak da ilerletir
  card.addEventListener('click', (e) => { if (!e.target.closest('button')) advance(); });

  return {
    get open() { return !!resolve; },
    /** Kartları oynat. cards: [{ who, text, alt?, card?, quote? }] */
    play(list, o = {}) {
      if (resolve) finish('skip');
      cards = (list || []).filter((c) => c && c.text);
      if (!cards.length) return Promise.resolve('done');
      heroId = o.heroId || heroId;
      idx = 0;
      root.hidden = false;
      void root.offsetWidth;
      root.classList.add('on');
      show(0);
      setTimeout(() => { try { next.focus({ preventScroll: true }); } catch { /* yok say */ } }, 30);
      return new Promise((res) => { resolve = res; });
    },
    /** arena.js klavye yönlendirmesi: işlendiyse true. */
    key(e) {
      if (!resolve) return false;
      if (e.code === 'Escape') { e.preventDefault(); finish('skip'); return true; }
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
        // odak düğmedeyse tarayıcının “tık”ı zaten ilerletir
        if (e.target && e.target.tagName === 'BUTTON' && card.contains(e.target)) return true;
        e.preventDefault();
        if (!e.repeat) advance();
        return true;
      }
      return true; // diyalog açıkken oyun tuşları işlenmez
    },
    close() { if (resolve) finish('skip'); },
    destroy() { if (resolve) finish('skip'); root.remove(); },
  };
}

// ------------------------------------------------------------------ final jeneriği
export function mountFinale(el, ctx = {}) {
  const F = S.FINALE;
  const C = S.CHAPTERS[S.CHAPTERS.length - 1];
  const menu = h('button', { class: 'btn primary lg', type: 'button', onclick: () => ctx.onMenu && ctx.onMenu() }, icon(ctx.menuLabel ? 'arrowRight' : 'flag', { size: 18 }), ctx.menuLabel || 'Haritaya dön');
  const codex = ctx.onCodex ? h('button', { class: 'btn ghost', type: 'button', onclick: () => ctx.onCodex() }, icon('book', { size: 16 }), 'Hikâye kartları') : null;
  const root = h('section', { class: 'ars-finale', 'aria-label': 'Final' },
    bannerNode(C, 'ars-finale-bg'),
    h('div', { class: 'ars-finale-card' },
      h('span', { class: 'eyebrow' }, 'Dokuzun Laneti · son'),
      h('h2', { class: 'ars-finale-title' }, F.title),
      h('p', { class: 'ars-finale-motto' }, '“', F.motto, '”'),
      h('dl', { class: 'ars-credits' }, F.lines.map(([k, v]) => h('div', { class: 'ars-credit' }, h('dt', null, k), h('dd', null, v)))),
      ctx.stars != null ? h('p', { class: 'ars-finale-stars' }, starRow(3, 3, 'lg'), h('span', null, h('b', { class: 'num' }, `${ctx.stars}/${ctx.maxStars || 45}`), ' yıldız · her görev yeniden oynanabilir')) : null,
      h('p', { class: 'ars-finale-last meme' }, 'Yirmi dört saat oldu. Isınma turu bitti.'),
      h('div', { class: 'row ars-finale-btns' }, menu, codex),
    ),
  );
  el.appendChild(root);
  const t = setTimeout(() => { try { menu.focus({ preventScroll: true }); } catch { /* yok say */ } }, 60);
  return () => { clearTimeout(t); root.remove(); };
}
