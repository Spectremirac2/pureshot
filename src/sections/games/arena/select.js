// 1vDOQUZ Arena 3.0 — kahraman seçim ekranı. 3D önizleme: arena sahnesinin kendisi (kamera seçili kahramana
// yaklaşır ve döner tabla gibi döndürür); WebGL yoksa amblem kartı görünür. Kilitli kahramanlar (Şimşek Ruhu,
// Ağaç Bekçisi) Aghanım Kütüphanesi'nden açılır; kilitliyken incelenebilir ama arenaya girilemez.

import { h, clear, fmtNum } from '../../../core/dom.js';
import { icon } from '../../../core/icons.js';
import { HEROES, HERO_IDS, heroBars, isHeroUnlocked, ATTR_NAMES, ATTR, TALENT_LEVELS } from './heroes.js';
import { ABILITIES, levelValues } from './abilities.js';
import { glyph } from './glyphs.js';

const KEYS = ['q', 'w', 'e', 'r'];

function stars(n) {
  return h('span', { class: 'ar-stars', 'aria-label': `Zorluk ${n}/3` }, [1, 2, 3].map((i) => h('span', { class: i <= n ? 'on' : '', html: glyph('star') })));
}

/** Kısa ipucu: mana · bekleme (seviye dizileriyle). */
export function abilityTip(A) {
  const bits = [];
  if (A.targeting === 'passive') bits.push('Pasif');
  else {
    const mana = A.costText || levelValues(A, 'mana');
    bits.push(`Mana ${mana || '0'}`);
    bits.push(`Bekleme ${A.cdText || `${levelValues(A, 'cd')} sn`}`);
  }
  bits.push(A.ult ? 'Seviye 6/12/18' : '4 seviye');
  return bits.join(' · ');
}

/** Ayrıntılı seviye tablosu satırları: [['Hasar', '90/140/190/240'], …] */
export function abilityRows(A) {
  return (A.show || []).map(([label, field, unit]) => [label, levelValues(A, field, unit)]);
}

/**
 * opts: { heroId, bestFor(id) → number|null, onPick(id), onStart(), extras: [düğüm…] (ayarlar/kontroller), devUnlock?,
 *         unlockCost?(id) → Parıltı, onUnlock?(id) (Kütüphane'yi açar), onMastery?(id), onBack?(), onRandom?() }
 * setContext({ kind: 'endless'|'story', eyebrow, title, lead, goals: [metin], rec: [id], guest: id, startLabel, backLabel, random })
 *   Hikâye görevinde başlık görev adı olur, önerilen kahramanlar rozetlenir, misafir kahraman kilitliyken de seçilebilir.
 */
export function buildSelect(opts) {
  let current = HEROES[opts.heroId] ? opts.heroId : 'okcu';
  let ctx = { kind: 'endless' };
  const allowed = (id) => isHeroUnlocked(id) || (!!ctx.guest && ctx.guest === id);
  const tabs = {};
  const tabBest = {};
  const heroList = h('div', { class: 'ar-sel-heroes', role: 'radiogroup', 'aria-label': 'Kahraman seç' });
  for (const id of HERO_IDS) {
    const H = HEROES[id];
    const best = h('span', { class: 'ar-hero-best num' });
    tabBest[id] = best;
    const lock = h('span', { class: 'ar-hero-lock', html: glyph('lock'), hidden: true });
    const tag = h('span', { class: 'ar-hero-tag', hidden: true });
    const b = h('button', {
      class: 'ar-hero-tab', type: 'button', role: 'radio', 'aria-checked': 'false', dataset: { hero: id },
      style: { '--hc': H.color },
    },
      h('span', { class: 'ar-hero-emb', html: glyph(id) }),
      h('span', { class: 'ar-hero-txt' },
        h('strong', null, H.name),
        h('span', { class: 'ar-hero-role' }, H.role),
        h('span', { class: 'ar-hero-meta' }, stars(H.diff), best),
      ),
      lock,
      tag,
    );
    b._lock = lock;
    b._tag = tag;
    b.addEventListener('click', () => pick(id, true));
    b.addEventListener('keydown', (e) => {
      const i = HERO_IDS.indexOf(current);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); pick(HERO_IDS[(i + 1) % HERO_IDS.length], true, true); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); pick(HERO_IDS[(i + HERO_IDS.length - 1) % HERO_IDS.length], true, true); }
    });
    tabs[id] = b;
    heroList.appendChild(b);
  }

  const name = h('h3', { class: 'ar-sel-name' });
  const title = h('span', { class: 'ar-sel-title' });
  const blurb = h('p', { class: 'ar-sel-blurb' });
  const attrs = h('div', { class: 'ar-sel-attrs', 'aria-label': 'Özellikler (1. seviye + seviye başına artış)' });
  const bars = h('div', { class: 'ar-sel-bars' });
  const kit = h('div', { class: 'ar-sel-kit', role: 'list', 'aria-label': 'Yetenekler' });
  const tip = h('div', { class: 'ar-sel-tip', 'aria-live': 'polite' });
  const aghs = h('p', { class: 'ar-sel-aghs xsmall' });
  const talents = h('details', { class: 'ar-sel-tal xsmall' });
  const emblem = h('div', { class: 'ar-sel-emblem', 'aria-hidden': 'true' });
  const lockNote = h('div', { class: 'ar-sel-locknote', hidden: true });
  const startBtn = h('button', { class: 'btn primary lg ar-start-btn', type: 'button', disabled: true }, icon('play', { size: 18 }), h('span', null, 'Yükleniyor…'));
  const masteryBtn = opts.onMastery ? h('button', { class: 'btn ghost sm ar-sel-mastery', type: 'button', title: 'Kahraman ustalığı: rütbe, varyantlar, çanta, kozmetik' }, icon('medal', { size: 15 }), 'Ustalık') : null;
  if (masteryBtn) masteryBtn.addEventListener('click', () => opts.onMastery(current));
  const randomBtn = opts.onRandom ? h('button', { class: 'btn ghost sm ar-sel-random', type: 'button', hidden: true, title: 'Rastgele Seçim: açık kahramanlardan biri, +%15 Parıltı' }, icon('dice', { size: 15 }), 'Rastgele') : null;
  if (randomBtn) randomBtn.addEventListener('click', () => opts.onRandom());
  const backBtn = h('button', { class: 'btn ghost sm ar-sel-back', type: 'button', hidden: !opts.onBack }, icon('arrowLeft', { size: 15 }), h('span', null, 'Modlar'));
  if (opts.onBack) backBtn.addEventListener('click', () => opts.onBack());
  const ctxEyebrow = h('span', { class: 'eyebrow' }, '1vDOQUZ Arena 3.0 · mini Dota');
  const ctxTitle = h('h2', { class: 'ar-start-title' }, '1vDO', h('em', null, 'Q'), 'UZ');
  const ctxLead = h('p', { class: 'ar-sel-story small' });
  const ctxGoals = h('ul', { class: 'ar-sel-goals', hidden: true, 'aria-label': 'Görev hedefleri' });
  /** Sonsuz modda sonraki koşunun Lanet seçicisi buraya yerleşir (arena.js mountCursePicker). */
  const curseHost = h('div', { class: 'ar-sel-curse', hidden: true }, h('span', { class: 'ar-sel-curse-l' }, 'Lanet · isteğe bağlı zorluk, skor çarpanı'));
  const DEFAULT_LEAD = [h('span', null, 'Radiant tarafında tek başınasın: dokuz DOG, Dire creep’leri, orman kampları, gece ve bosslar. Yetenek öğren, eşya birleştir, geceyi ward’la. '), h('b', null, 'DOG DOG DOG.')];
  const bestTxt = h('span', { class: 'ar-start-best small muted' });
  let ready = false;

  function showTip(A, key) {
    clear(tip);
    const rows = abilityRows(A);
    tip.append(
      h('strong', null, `${key.toUpperCase()} · ${A.name}`, A.ult ? h('span', { class: 'ar-tip-ult' }, 'ULTİ') : null),
      h('span', { class: 'ar-tip-meta' }, abilityTip(A)),
      h('span', { class: 'ar-tip-desc' }, A.desc),
      rows.length ? h('span', { class: 'ar-tip-rows' }, rows.map(([l, v]) => h('span', null, `${l} `, h('b', { class: 'num' }, v)))) : null,
    );
  }

  function render() {
    const H = HEROES[current];
    const unlocked = allowed(current);
    for (const id of HERO_IDS) {
      tabs[id].setAttribute('aria-checked', String(id === current));
      tabs[id].tabIndex = id === current ? 0 : -1;
      const lk = !allowed(id);
      const guest = !!ctx.guest && ctx.guest === id && !isHeroUnlocked(id);
      const rec = Array.isArray(ctx.rec) && ctx.rec.includes(id);
      tabs[id].classList.toggle('locked', lk);
      tabs[id].classList.toggle('guest', guest);
      tabs[id].classList.toggle('rec', rec);
      tabs[id]._lock.hidden = !lk;
      tabs[id]._tag.hidden = !(guest || rec);
      tabs[id]._tag.textContent = guest ? 'Misafir' : rec ? 'Önerilen' : '';
      tabs[id].setAttribute('aria-label', `${HEROES[id].name}, ${HEROES[id].role}${lk ? ', kilitli' : ''}${guest ? ', misafir kahraman' : ''}${rec ? ', önerilen' : ''}`);
    }
    root.style.setProperty('--hc', H.color);
    name.textContent = H.name;
    title.textContent = H.title;
    blurb.textContent = H.blurb;
    emblem.innerHTML = glyph(H.id);
    clear(attrs);
    for (const k of ['str', 'agi', 'int']) {
      const [b0, gain] = H.attrs[k];
      attrs.appendChild(h('span', { class: `ar-attr ar-attr-${k}${H.attr === k ? ' primary' : ''}`, title: `${ATTR_NAMES[k]}${H.attr === k ? ' (ana özellik: her puan +1 saldırı hasarı)' : ''}` },
        h('span', { class: 'ar-attr-i', html: glyph(k) }),
        h('b', { class: 'num' }, String(b0)),
        h('span', { class: 'ar-attr-g num' }, `+${String(gain).replace('.', ',')}`),
      ));
    }
    clear(bars);
    for (const [label, v] of heroBars(H)) {
      bars.appendChild(h('div', { class: 'ar-sel-bar' }, h('span', null, label), h('i', { style: { '--v': v.toFixed(2) } })));
    }
    clear(kit);
    KEYS.forEach((k) => {
      const A = ABILITIES[H.abilities[k]];
      const b = h('button', { class: `ar-sel-ab${A.ult ? ' ult' : ''}`, type: 'button', role: 'listitem', 'aria-label': `${k.toUpperCase()}: ${A.name}. ${A.desc}` },
        h('span', { class: 'ar-sel-ab-i', html: glyph(A.icon) }),
        h('span', { class: 'ar-sel-ab-k' }, k.toUpperCase()),
        h('span', { class: 'ar-sel-ab-n' }, A.name),
      );
      const show = () => { for (const x of kit.children) x.classList.remove('on'); b.classList.add('on'); showTip(A, k); };
      b.addEventListener('mouseenter', show);
      b.addEventListener('focus', show);
      b.addEventListener('click', show);
      kit.appendChild(b);
      if (k === 'q') { b.classList.add('on'); showTip(A, k); }
    });
    aghs.textContent = H.aghs;
    clear(talents);
    talents.append(h('summary', null, 'Yetenek ağacı (10 / 15 / 20 / 25)'),
      h('ul', { class: 'ar-sel-tal-list' }, TALENT_LEVELS.map((L) => h('li', null, h('b', { class: 'num' }, String(L)), ` ${H.talents[L][0].name}`, h('span', { class: 'dim' }, ' ya da '), H.talents[L][1].name))));
    lockNote.hidden = unlocked;
    clear(lockNote);
    if (!unlocked) {
      const cost = opts.unlockCost ? opts.unlockCost(current) : 0;
      lockNote.append(h('span', { class: 'ar-sel-lockic', html: glyph('lock') }), h('span', null, h('b', null, 'Kilitli kahraman. '), `Aghanım Kütüphanesi’nden ${cost ? `${fmtNum(cost)} ` : ''}Parıltı Taşı ile açılır. Şimdilik inceleyebilirsin.`));
      if (opts.onUnlock) {
        const ub = h('button', { class: 'btn gold sm ar-sel-unlock', type: 'button' }, icon('unlock', { size: 15 }), 'Kütüphane’de aç');
        ub.addEventListener('click', () => opts.onUnlock(current));
        lockNote.appendChild(ub);
      }
      if (opts.devUnlock) {
        const dev = h('button', { class: 'btn ghost sm', type: 'button' }, 'Geliştirici: kilidi aç');
        dev.addEventListener('click', () => { opts.devUnlock(current); render(); });
        lockNote.appendChild(dev);
      }
    }
    updateStart();
    refreshBest();
  }

  function updateStart() {
    const unlocked = allowed(current);
    startBtn.disabled = !ready || !unlocked;
    const label = !ready ? 'Yükleniyor…' : unlocked ? (ctx.startLabel || 'Arenaya gir') : 'Kilitli';
    clear(startBtn).append(icon(unlocked ? 'play' : 'lock', { size: 18 }), h('span', null, label));
    if (randomBtn) randomBtn.hidden = !(ctx.random && ready);
  }

  function renderContext() {
    const story = ctx.kind === 'story';
    root.classList.toggle('is-story', story);
    root.dataset.kind = ctx.kind || 'endless';
    ctxEyebrow.textContent = ctx.eyebrow || '1vDOQUZ Arena 3.0 · mini Dota';
    clear(ctxTitle);
    if (ctx.title) ctxTitle.textContent = ctx.title;
    else ctxTitle.append('1vDO', h('em', null, 'Q'), 'UZ');
    ctxTitle.classList.toggle('is-mission', !!ctx.title);
    clear(ctxLead).append(...(ctx.lead ? [ctx.lead] : DEFAULT_LEAD));
    clear(ctxGoals);
    const goals = Array.isArray(ctx.goals) ? ctx.goals : [];
    ctxGoals.hidden = !goals.length;
    for (const g of goals) ctxGoals.appendChild(h('li', null, g));
    curseHost.hidden = ctx.kind !== 'endless';
    backBtn.querySelector('span').textContent = ctx.backLabel || 'Modlar';
    root.setAttribute('aria-label', story ? `Kahraman seçimi: ${ctx.title || 'görev'}` : 'Kahraman seçimi');
  }

  function refreshBest() {
    for (const id of HERO_IDS) {
      const v = opts.bestFor(id);
      tabBest[id].textContent = v == null ? '' : fmtNum(v);
      tabBest[id].title = v == null ? '' : `${HEROES[id].name} ile en iyin: ${fmtNum(v)} puan`;
    }
    const v = opts.bestFor(current);
    if (ctx.bestText != null) bestTxt.textContent = ctx.bestText;
    else bestTxt.textContent = v == null ? `${HEROES[current].name} ile henüz skorun yok.` : `${HEROES[current].name} ile en iyin: ${fmtNum(v)}`;
  }

  function pick(id, user = false, focus = false) {
    if (!HEROES[id]) return;
    const changed = id !== current;
    current = id;
    render();
    if (focus) tabs[id].focus();
    if (user && changed && opts.onPick) opts.onPick(id);
  }

  const root = h('div', { class: 'ar-screen ar-select', role: 'dialog', 'aria-label': 'Kahraman seçimi' },
    h('div', { class: 'ar-sel-card ar-card' },
      h('div', { class: 'ar-sel-top' }, backBtn, ctxEyebrow),
      h('div', { class: 'ar-sel-head' }, ctxTitle),
      ctxLead,
      ctxGoals,
      heroList,
      h('div', { class: 'ar-start-cta' }, startBtn, randomBtn, bestTxt),
      lockNote,
      curseHost,
      h('div', { class: 'ar-sel-detail' },
        h('div', { class: 'ar-sel-namebox' }, emblem, h('div', { class: 'ar-sel-nametxt' }, name, title), masteryBtn),
        blurb,
        attrs,
        bars,
        kit,
        tip,
        aghs,
        talents,
      ),
      opts.extras ? h('details', { class: 'ar-sel-more' }, h('summary', null, icon('keyboard', { size: 16 }), 'Kontroller ve ayarlar'), ...opts.extras) : null,
    ),
  );
  startBtn.addEventListener('click', () => { if (allowed(current) && opts.onStart) opts.onStart(); });
  renderContext();
  render();

  return {
    el: root,
    startBtn,
    curseHost,
    get hero() { return current; },
    get context() { return ctx; },
    /** Seçili kahraman bu bağlamda oynanabilir mi (açık ya da misafir)? */
    allowed,
    setContext(next = {}) { ctx = { kind: 'endless', ...next }; renderContext(); render(); },
    setHero: (id) => pick(id, false),
    refreshBest,
    refresh: () => { renderContext(); render(); },
    ready() {
      ready = true;
      updateStart();
    },
    focusCurrent() { try { tabs[current].focus({ preventScroll: true }); } catch { /* yok say */ } },
  };
}

void ATTR;
