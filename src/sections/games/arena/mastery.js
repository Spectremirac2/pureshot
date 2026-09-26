// 1vDOQUZ Arena — kahraman ustalık paneli ve koşu sonu ödül kartı. Belge: docs/ARENA-ILERLEME.md
// progression.js'in tembel arayüz parçası.
//
//   mountHeroMastery(el, heroId, ctx?) → temizlik   ctx: { onClose?(), onLibrary?() }
//     rütbe rozeti, XP çubuğu, 8 kademe (Herald → Immortal) ve açtıkları; sonraki koşu için varyant / çanta / aura / iz
//   mountRunRewards(el, rewards, ctx?) → temizlik   rewards: grantRunRewards() dönüşü · ctx: { onLibrary?(), onHero?(heroId) }

import './library.css';
import { h, clear, fmtNum, prefersReducedMotion } from '../../../core/dom.js';
import { icon } from '../../../core/icons.js';
import { store } from '../../../core/store.js';
import { sound } from '../../../core/sound.js';
import { itemIconUrl } from '../../../core/assets.js';
import * as Glyphs from './glyphs.js';
import * as PR from './progression.js';
import { gem, heroEmblem, rankMedal, shardText } from './library.js';

PR.connectStore(store);

const KEY_CAP = { q: 'Q', w: 'W', e: 'E', r: 'R' };
const pct = (v) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;

function itemChip(id) {
  const I = PR.codexCatalog().items.find((x) => x.id === id) || { id, name: id };
  const url = I.icon ? itemIconUrl(I.icon) : null;
  const G = Glyphs.GLYPH || {};
  const art = url ? h('img', { src: url, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' })
    : I.glyph && G[I.glyph] ? h('span', { class: 'arm-item-g', style: { color: I.color || 'var(--aegis)' }, html: G[I.glyph] })
      : h('span', { class: 'arm-item-g', style: { color: I.color || 'var(--aegis)' } }, icon('coin', { size: 16 }));
  return h('span', { class: 'arm-item', title: I.name }, art, h('span', null, I.name));
}

/**
 * Erişilebilir radyo grubu: oklarla gezinir, seçer. options: [{ id, disabled?, el: Node, label }]
 */
function radioGroup(label, options, current, onPick, cls = '') {
  const g = h('div', { class: `arm-radios ${cls}`.trim(), role: 'radiogroup', 'aria-label': label });
  const enabled = () => options.filter((o) => !o.disabled);
  const btns = new Map();
  for (const o of options) {
    const on = o.id === current;
    const b = h('button', { class: `arm-radio${o.disabled ? ' is-locked' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(on), disabled: !!o.disabled,
      'aria-label': o.label, tabindex: on ? '0' : '-1' }, o.el);
    b.addEventListener('click', () => { if (!o.disabled) onPick(o.id); });
    b.addEventListener('keydown', (e) => {
      const list = enabled();
      const i = list.findIndex((x) => x.id === o.id);
      let j = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % list.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i + list.length - 1) % list.length;
      if (j < 0) return;
      e.preventDefault();
      onPick(list[j].id, true);
    });
    btns.set(o.id, b);
    g.appendChild(b);
  }
  if (!options.some((o) => o.id === current)) {
    const first = options.find((o) => !o.disabled);
    if (first) btns.get(first.id).tabIndex = 0;
  }
  g.focusOption = (id) => btns.get(id)?.focus();
  return g;
}

// ------------------------------------------------------------------ ustalık paneli
export function mountHeroMastery(el, heroId, ctx = {}) {
  const id = PR.heroKey(heroId);
  const root = h('section', { class: 'arm', 'aria-label': `${PR.heroInfo(id).name} ustalığı` });
  clear(el);
  el.appendChild(root);
  let confirmBuy = false;
  let confirmT = 0;
  let focusKey = null; // yeniden çizimden sonra odak

  function render() {
    const s = PR.heroSummary(id);
    const P = PR.getProfile();
    root.style.setProperty('--hc', s.color);
    root.style.setProperty('--rc', s.rankInfo.color);
    clear(root);
    const r = s.rankInfo;
    // başlık
    root.append(h('header', { class: 'arm-head' },
      heroEmblem(id, 'lg'),
      h('div', { class: 'arm-titles' },
        h('span', { class: 'eyebrow' }, 'Kahraman ustalığı'),
        h('h2', { class: 'arm-name' }, s.name),
        h('span', { class: 'arm-role' }, s.role, s.runs ? ` · ${fmtNum(s.runs)} koşu` : '', s.bestWave ? ` · en iyi dalga ${s.bestWave}` : ''),
      ),
      h('div', { class: 'arm-rank' },
        rankMedal(s.tier, { size: 58 }),
        h('div', { class: 'arm-rank-txt' },
          h('strong', { class: 'arm-rank-name' }, s.rank),
          h('span', { class: 'arm-rank-xp num' }, `${fmtNum(s.xp)} XP`),
        ),
      ),
      ctx.onClose ? h('button', { class: 'btn ghost sm icon arm-x', type: 'button', 'aria-label': 'Kapat', onclick: () => ctx.onClose() }, icon('close', { size: 16 })) : null,
    ));
    root.append(h('div', { class: 'arm-xp' },
      h('div', { class: 'arm-xp-bar', role: 'progressbar', 'aria-label': 'Ustalık ilerlemesi', 'aria-valuemin': '0', 'aria-valuemax': String(r.need || 1), 'aria-valuenow': String(r.max ? r.need || 1 : r.into) },
        h('i', { style: { width: pct(r.pct) } })),
      h('span', { class: 'arm-xp-txt' }, r.max ? 'En yüksek rütbe: Immortal. Arena seni tanıyor.' : `${r.nextName}’a ${fmtNum(r.next - r.xp)} XP · ${fmtNum(r.into)}/${fmtNum(r.need)}`),
    ));

    // kilitli kahraman
    if (!s.unlocked) {
      const cost = s.cost;
      const can = P.shards >= cost;
      const btn = h('button', { class: `btn ${confirmBuy ? 'primary' : 'gold'}`, type: 'button', disabled: !can },
        icon(confirmBuy ? 'check' : 'unlock', { size: 18 }), confirmBuy ? `Onayla · ${fmtNum(cost)}` : `Aç · ${fmtNum(cost)}`, gem('sm'));
      btn.addEventListener('click', () => {
        if (!confirmBuy) { confirmBuy = true; clearTimeout(confirmT); confirmT = setTimeout(() => { confirmBuy = false; render(); }, 4500); focusKey = 'unlock'; render(); return; }
        confirmBuy = false;
        const res = PR.unlockHero(id);
        if (res.ok) { try { sound.coin(); } catch { /* ses kapalı */ } }
        focusKey = null;
        render();
      });
      btn.dataset.focus = 'unlock';
      root.append(h('div', { class: 'arm-lock' },
        icon('lock', { size: 20 }),
        h('div', null,
          h('strong', null, 'Kilitli kahraman'),
          h('span', null, can ? `Aghanim Kütüphanesi’nde ${shardText(cost)} ile açılır.` : `${shardText(cost)} gerekli: ${fmtNum(cost - P.shards)} eksik.`),
        ),
        btn,
      ));
    }

    // kademeler
    const tiers = h('ol', { class: 'arm-tiers', 'aria-label': 'Ustalık kademeleri' });
    s.tiers.forEach((T, i) => {
      const cur = i === s.tier;
      const grants = T.grantsList.filter((g) => g.kind !== 'title');
      tiers.append(h('li', { class: `arm-tier${T.reached ? ' is-reached' : ''}${cur ? ' is-current' : ''}`, style: { '--tc': T.color }, 'aria-current': cur ? 'step' : null },
        h('span', { class: 'arm-tier-med' }, rankMedal(i, { size: 34, label: false })),
        h('span', { class: 'arm-tier-name' }, T.name),
        h('span', { class: 'arm-tier-xp num' }, `${fmtNum(T.xp)} XP`),
        h('span', { class: 'arm-tier-g' }, grants.length ? grants.map((g) => g.name).join(' · ') : 'Başlangıç'),
      ));
    });
    root.append(tiers);

    // sonraki koşu seçimleri
    const locked = !s.unlocked;
    const L = s.loadout;
    const sec = (title, ico, note, ...kids) => h('section', { class: 'arm-sec' },
      h('h3', { class: 'arm-sec-h' }, icon(ico, { size: 16 }), title, note ? h('span', { class: 'arm-sec-note' }, note) : null), ...kids);

    // varyantlar
    const vlist = h('div', { class: 'arm-vars' });
    for (const V of s.variantList) {
      const on = L.variants[V.key] === V.id;
      const avail = V.unlocked && !locked;
      const sw = h('button', { class: `arm-switch${on ? ' is-on' : ''}`, type: 'button', role: 'switch', 'aria-checked': String(on), disabled: !avail,
        'aria-label': `${V.name} varyantı (${KEY_CAP[V.key]} yerine)`, dataset: { focus: `v-${V.id}` } }, h('span', { class: 'arm-switch-k' }));
      sw.addEventListener('click', () => { PR.setLoadout(id, { variants: { [V.key]: on ? null : V.id } }); focusKey = `v-${V.id}`; try { sound.click(); } catch { /* ses kapalı */ } render(); });
      vlist.append(h('div', { class: `arm-var${on ? ' is-on' : ''}${avail ? '' : ' is-locked'}` },
        h('span', { class: 'arm-key' }, KEY_CAP[V.key]),
        h('div', { class: 'arm-var-txt' },
          h('strong', null, V.name, V.aghs ? h('span', { class: 'arm-aghs' }, 'Aghanım tarzı') : null),
          h('span', { class: 'arm-var-rep' }, `${V.replaces} yerine`),
          h('p', null, V.desc),
          !V.unlocked ? h('span', { class: 'arm-var-lock' }, icon('lock', { size: 12 }), `${V.tierName} rütbesinde açılır`) : null,
        ),
        sw,
      ));
    }
    root.append(sec('Yetenek varyantları', 'spell', 'Her biri bir artı, bir eksi. Açık/kapalı sonraki koşuda geçerli.', vlist));

    // başlangıç çantası
    const kitOpts = s.kits.map((K) => {
      const R = K.resolved;
      const value = R.items.reduce((a, it) => a + PR.itemValue(it), 0) + R.gold;
      const src = K.source === 'base' ? 'Herkese açık' : K.source.startsWith('lib:') ? `Kütüphane: ${(PR.nodeOf(K.source.slice(4)) || {}).name || ''}` : 'Archon rütbesi';
      return {
        id: K.id,
        disabled: !K.unlocked || locked,
        label: `${K.name}: ${K.desc}${K.unlocked ? '' : ` (kilitli: ${src})`}`,
        el: h('span', { class: 'arm-kit' },
          h('span', { class: 'arm-kit-head' }, h('strong', null, K.name), h('span', { class: 'arm-kit-v num' }, `≈${fmtNum(value)} altın`)),
          h('span', { class: 'arm-kit-items' }, R.items.map(itemChip), R.gold ? h('span', { class: 'arm-item is-gold' }, icon('coin', { size: 14 }), h('span', null, `${fmtNum(R.gold)} altın`)) : null),
          h('span', { class: 'arm-kit-src' }, K.unlocked ? K.desc : [icon('lock', { size: 12 }), ` ${src}`]),
        ),
      };
    });
    const kits = radioGroup('Başlangıç çantası', kitOpts, L.kit, (kid, kb) => { PR.setLoadout(id, { kit: kid }); focusKey = kb ? `kit-${kid}` : focusKey; try { sound.click(); } catch { /* ses kapalı */ } render(); }, 'arm-kits');
    kits.querySelectorAll('[role="radio"]').forEach((b, i) => { b.dataset.focus = `kit-${kitOpts[i].id}`; });
    root.append(sec('Başlangıç çantası', 'coin', 'Hepsi aşağı yukarı aynı değerde: güç değil, tarz.', kits));

    // kozmetik
    const swatch = (C) => h('span', { class: `arm-sw${C && C.style ? ` is-${C.style}` : ''}`, style: C ? { '--sc': C.color, '--sc2': C.color2 || C.color } : null });
    const auraOpts = [{ id: '', label: 'Aura yok', el: h('span', { class: 'arm-cos' }, swatch(null), 'Yok') }]
      .concat(s.auras.map((A) => ({ id: A.id, label: A.name, disabled: locked, el: h('span', { class: 'arm-cos' }, swatch(A), A.name) })));
    const trailOpts = [{ id: '', label: 'İz yok', el: h('span', { class: 'arm-cos' }, swatch(null), 'Yok') }]
      .concat(s.trails.map((T) => ({ id: T.id, label: T.name, disabled: locked, el: h('span', { class: 'arm-cos' }, swatch(T), T.name) })));
    const auras = radioGroup('Aura', auraOpts, L.aura ? L.aura.id : '', (aid, kb) => { PR.setLoadout(id, { aura: aid || null }); focusKey = kb ? `aura-${aid}` : focusKey; render(); }, 'arm-cosg');
    auras.querySelectorAll('[role="radio"]').forEach((b, i) => { b.dataset.focus = `aura-${auraOpts[i].id}`; });
    const trails = radioGroup('İz', trailOpts, L.trail ? L.trail.id : '', (tid, kb) => { PR.setLoadout(id, { trail: tid || null }); focusKey = kb ? `trail-${tid}` : focusKey; render(); }, 'arm-cosg');
    trails.querySelectorAll('[role="radio"]').forEach((b, i) => { b.dataset.focus = `trail-${trailOpts[i].id}`; });
    const cosNote = s.auras.length + s.trails.length ? null
      : h('p', { class: 'arm-hint' }, 'Guardian’da kahraman aurası, Ancient’ta kahraman izi açılır; Kütüphane’nin Kozmetik dalında daha fazlası var.');
    const libBtn = ctx.onLibrary ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => ctx.onLibrary() }, icon('book', { size: 16 }), 'Kütüphane') : null;
    root.append(sec('Kozmetik', 'sparkle', 'Yalnızca görünüş.',
      h('div', { class: 'arm-cos-row' }, h('span', { class: 'arm-cos-l' }, 'Aura'), auras),
      h('div', { class: 'arm-cos-row' }, h('span', { class: 'arm-cos-l' }, 'İz'), trails),
      cosNote, libBtn));

    const st = s.stats;
    root.append(h('footer', { class: 'arm-foot' },
      icon('shield', { size: 16 }),
      h('span', null, 'Ustalık bonusu: ', h('b', null, `+%${st.hpPct} can · +%${st.dmgPct} hasar · +%${st.goldPct} altın`), ' (en çok %5; günlük meydan okumada kapalı)'),
    ));

    if (focusKey) {
      const f = root.querySelector(`[data-focus="${CSS.escape(focusKey)}"]`);
      if (f && !f.disabled) f.focus();
      focusKey = null;
    }
  }

  render();
  const unsub = PR.subscribeMeta(() => { if (root.isConnected && !root.contains(document.activeElement)) render(); });
  return () => { unsub(); clearTimeout(confirmT); root.remove(); };
}

// ------------------------------------------------------------------ koşu sonu ödül kartı
const UNLOCK_ICON = { variant: 'spell', kit: 'coin', aura: 'sparkle', trail: 'sparkle', curse: 'skull', stat: 'plus', title: 'crown' };

export function mountRunRewards(el, rewards, ctx = {}) {
  const R = rewards || {};
  const reduce = prefersReducedMotion();
  const timers = [];
  const root = h('section', { class: 'arr', 'aria-label': 'Koşu ödülleri' });
  const num = h('b', { class: 'arr-n num' }, `+${fmtNum(reduce ? R.shards || 0 : 0)}`);
  root.append(h('div', { class: 'arr-head' },
    gem('lg'),
    h('div', { class: 'arr-head-txt' },
      h('span', { class: 'eyebrow' }, 'Parıltı Taşı'),
      h('span', { class: 'arr-total' }, num, h('span', { class: 'arr-sr' }, ` Parıltı kazandın. Bakiye ${fmtNum(R.balance || 0)}.`)),
      h('span', { class: 'arr-bal' }, 'Bakiye: ', h('b', { class: 'num' }, fmtNum(R.balance || 0))),
    ),
    R.curse ? h('span', { class: 'badge blood arr-curse' }, icon('skull', { size: 12 }), `Lanet ${R.curse}`) : null,
  ));
  if (R.duplicate) root.append(h('p', { class: 'arm-hint' }, 'Bu koşunun ödülü zaten verildi.'));
  const lines = Array.isArray(R.breakdown) ? R.breakdown : [];
  if (lines.length) {
    root.append(h('ul', { class: 'arr-lines' }, lines.map((l) => h('li', { class: `${l.mult ? 'is-mult' : ''}${l.first ? ' is-first' : ''}` },
      h('span', null, l.first ? icon('star', { size: 12 }) : null, l.label),
      h('b', { class: 'num' }, l.mult ? l.value : `+${fmtNum(l.value)}`)))));
  }
  // kahraman XP'si
  if (R.hero) {
    const H = R.hero;
    const bar = h('i', { style: { width: pct(reduce || !R.heroBefore ? H.pct : R.heroBefore.tier < H.tier ? 0 : R.heroBefore.pct) } });
    const heroBox = h('div', { class: `arr-hero${R.rankUp ? ' is-up' : ''}`, style: { '--hc': H.color, '--rc': H.rankColor } },
      heroEmblem(H.id, 'sm'),
      h('div', { class: 'arr-hero-mid' },
        h('span', { class: 'arr-hero-top' }, h('strong', null, H.name), h('span', { class: 'arr-hero-xp num' }, `+${fmtNum(R.heroXp || 0)} ustalık XP’si`)),
        h('span', { class: 'arm-xp-bar arr-bar', role: 'progressbar', 'aria-label': `${H.name} ustalığı`, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(H.pct * 100)) }, bar),
        h('span', { class: 'arr-hero-rank' }, H.nextName ? `${H.rank} · ${H.nextName}’a ${fmtNum(H.need - H.into)} XP` : `${H.rank} · en yüksek rütbe`),
      ),
      rankMedal(H.tier, { size: 40 }),
    );
    root.append(heroBox);
    if (!reduce) timers.push(setTimeout(() => { bar.style.width = pct(H.pct); }, 350));
    if (R.rankUp) {
      root.append(h('div', { class: 'arr-up', role: 'status' }, icon('crown', { size: 18 }), h('span', null, 'Rütbe atladın: ', h('b', null, R.rankUp.to), '!')));
    }
  }
  const chips = (title, list, cls) => (list.length ? h('div', { class: `arr-chips ${cls}` }, h('span', { class: 'arr-chips-h' }, title), h('div', { class: 'arr-chips-l' }, list)) : null);
  const unlocked = (R.unlocked || []).map((u) => h('span', { class: `arr-chip is-${u.kind}`, style: u.color ? { '--sc': u.color } : null }, icon(UNLOCK_ICON[u.kind] || 'star', { size: 13 }), u.name, u.text ? h('small', null, ` · ${u.text}`) : null));
  const cat = PR.codexCatalog();
  const codex = (R.newCodex || []).slice(0, 8).map((c) => h('span', { class: 'arr-chip is-codex' }, icon((PR.CODEX_KINDS.find((k) => k.id === c.kind) || {}).icon || 'book', { size: 13 }), c.name || ((cat[c.kind] || []).find((x) => x.id === c.id) || {}).name || c.id));
  if ((R.newCodex || []).length > 8) codex.push(h('span', { class: 'arr-chip is-more' }, `+${R.newCodex.length - 8}`));
  const afford = (R.affordable || []).slice(0, 4).map((a) => h('span', { class: 'arr-chip is-afford' }, gem('sm'), `${a.name} · ${fmtNum(a.cost)}`));
  root.append(...[chips('Açılanlar', unlocked, 'is-unl'), chips('Kodeks’e eklendi', codex, 'is-cx'), chips('Artık açabilirsin', afford, 'is-aff')].filter(Boolean));
  if (ctx.onLibrary || ctx.onHero) {
    root.append(h('div', { class: 'row arr-btns' },
      ctx.onLibrary ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => ctx.onLibrary() }, icon('book', { size: 16 }), 'Kütüphane') : null,
      ctx.onHero && R.hero ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => ctx.onHero(R.hero.id) }, icon('medal', { size: 16 }), 'Ustalık') : null,
    ));
  }
  el.appendChild(root);
  // sayaç
  if (!reduce && R.shards) {
    const t0 = performance.now();
    const dur = Math.min(1400, 500 + R.shards * 6);
    let raf = 0;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      num.textContent = `+${fmtNum(Math.round((R.shards || 0) * (1 - (1 - k) ** 3)))}`;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    timers.push(() => cancelAnimationFrame(raf));
  }
  return () => { for (const t of timers) { if (typeof t === 'function') t(); else clearTimeout(t); } root.remove(); };
}
