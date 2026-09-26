// 1vDOQUZ Arena 3.0 — dükkân paneli (mola arasında kendiliğinden açılır; B tuşu / altın düğmesi ile her an).
// Sekmeler: Temel (bileşenler, tüketilebilirler) · Gelişmiş (tarifli eşyalar). Seçilen eşyanın ağacı: altta
// bileşenleri (sende olanlar işaretli) + tarif ücreti, üstte girdiği eşyalar. Sahip olduğun bileşenler fiyattan
// düşülür ve eşya kendiliğinden birleşir. Fareyle tıklama doğrudan satın alır; dokunmada önce seçilir, "Satın al"
// ile alınır (yanlışlıkla alım olmasın).

import { h, clear, fmtNum } from '../../../core/dom.js';
import { icon } from '../../../core/icons.js';
import { itemIconUrl } from '../../../core/assets.js';
import { ITEMS, SHOP_TABS, SLOTS, NEUTRALS, isRecipe, buildsInto } from './items.js';
import { glyph } from './glyphs.js';

/** Eşya görseli: src/assets/items ikonu, yoksa renkli SVG glifi. */
export function itemImg(I, cls = 'ar-item-img') {
  const url = I && I.icon ? itemIconUrl(I.icon) : null;
  if (url) return h('img', { class: cls, src: url, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' });
  return h('span', { class: `${cls} ar-item-fb`, style: { '--ic': (I && I.color) || 'var(--aegis)' }, html: glyph((I && I.glyph) || 'rune') });
}

/**
 * opts: { game, onBuy(id), onSell(slot), onClose(), onReady(), onEquipNeutral(id), sound }
 */
export function buildShop(opts) {
  const g = () => opts.game;
  let tab = SHOP_TABS[0].id;
  let selected = SHOP_TABS[0].items[0];
  let open = false;
  const gold = h('b', { class: 'num' }, '0');
  const courier = h('span', { class: 'ar-shop-courier xsmall' });
  const closeBtn = h('button', { class: 'ar-tool ar-shop-x', type: 'button', 'aria-label': 'Dükkânı kapat (B)', title: 'Kapat (B)' }, icon('close', { size: 18 }));
  const tabBtns = {};
  const tabsEl = h('div', { class: 'ar-shop-tabs', role: 'tablist', 'aria-label': 'Dükkân bölümleri' });
  for (const T of SHOP_TABS) {
    const b = h('button', { class: 'ar-shop-tab', type: 'button', role: 'tab', 'aria-selected': String(T.id === tab), dataset: { tab: T.id } }, T.name);
    b.addEventListener('click', () => setTab(T.id));
    tabBtns[T.id] = b;
    tabsEl.appendChild(b);
  }
  const grid = h('div', { class: 'ar-shop-grid', role: 'list' });
  const btns = {};
  function itemButton(id) {
    const I = ITEMS[id];
    const b = h('button', { class: `ar-shop-item tier-${I.tier}${isRecipe(id) ? ' recipe' : ''}`, type: 'button', role: 'listitem', dataset: { id }, 'aria-label': `${I.name}. ${I.desc}` },
      itemImg(I),
      h('span', { class: 'ar-shop-cost num' }, ''),
      h('span', { class: 'ar-shop-name' }, I.name),
    );
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') select(id); });
    b.addEventListener('focus', () => select(id));
    b.addEventListener('click', (e) => {
      // dokunmada yalnızca seç (alım "Satın al" düğmesiyle); farede ve klavyede (Enter) tıkla = al
      const touchy = e.pointerType === 'touch' || e.pointerType === 'pen' || (e.detail !== 0 && !e.pointerType && matchCoarse());
      select(id);
      if (touchy) { try { buyBtn.focus({ preventScroll: true }); } catch { /* yok say */ } return; }
      opts.onBuy(id);
      update(true);
    });
    return b;
  }
  for (const T of SHOP_TABS) for (const id of T.items) btns[id] = itemButton(id);

  // bilgi + ağaç
  const infoImg = h('span', { class: 'ar-shop-iimg' });
  const infoName = h('strong', { class: 'ar-shop-iname' });
  const infoCost = h('span', { class: 'ar-shop-icost num' });
  const infoDesc = h('p', { class: 'ar-shop-idesc' });
  const treeUp = h('div', { class: 'ar-tree-row ar-tree-up' });
  const treeDown = h('div', { class: 'ar-tree-row ar-tree-down' });
  const tree = h('div', { class: 'ar-shop-tree' },
    h('div', { class: 'ar-tree-block' }, h('span', { class: 'ar-tree-l xsmall' }, 'Şuna dönüşür'), treeUp),
    h('div', { class: 'ar-tree-block' }, h('span', { class: 'ar-tree-l xsmall' }, 'Bileşenler'), treeDown),
  );
  const buyBtn = h('button', { class: 'btn primary ar-shop-buy', type: 'button' }, icon('coin', { size: 16 }), h('span', null, 'Satın al'));
  buyBtn.addEventListener('click', () => { opts.onBuy(selected); update(true); });
  const info = h('div', { class: 'ar-shop-info' },
    h('div', { class: 'ar-shop-ihead' }, infoImg, h('div', { class: 'ar-shop-ititle' }, infoName, infoCost)),
    infoDesc, tree, buyBtn,
  );
  // çanta + orman yuvası
  const bag = h('div', { class: 'ar-shop-bag', role: 'list', 'aria-label': 'Çantan (tıkla: yarı fiyatına sat)' });
  const bagSlots = [];
  for (let i = 0; i < SLOTS; i++) {
    const s = h('button', { class: 'ar-shop-slot', type: 'button', role: 'listitem', dataset: { i: String(i) } });
    s.addEventListener('click', () => {
      const it = g().player.items[i];
      if (!it || it.reserved) return;
      if (s.classList.contains('confirm')) { opts.onSell(i); s.classList.remove('confirm'); update(true); return; }
      for (const x of bagSlots) x.classList.remove('confirm');
      s.classList.add('confirm');
      setTimeout(() => s.classList.remove('confirm'), 2200);
    });
    bagSlots.push(s);
    bag.appendChild(s);
  }
  const neutralSlot = h('span', { class: 'ar-shop-slot ar-shop-neutral', role: 'listitem', title: 'Orman eşyası yuvası' });
  bag.appendChild(neutralSlot);
  const stash = h('div', { class: 'ar-shop-stash', hidden: true });
  const breakTxt = h('span', { class: 'ar-shop-break small' });
  const readyBtn = h('button', { class: 'btn ghost sm ar-shop-ready', type: 'button' }, icon('play', { size: 14 }), 'Hazırım');
  readyBtn.addEventListener('click', () => opts.onReady());
  const foot = h('div', { class: 'ar-shop-foot' }, breakTxt, readyBtn);
  const el = h('aside', { class: 'ar-shop', role: 'dialog', 'aria-label': 'Dükkân', hidden: true },
    h('div', { class: 'ar-shop-head' },
      h('span', { class: 'ar-shop-ico', html: glyph('shop') }),
      h('div', { class: 'ar-shop-ttl' }, h('strong', null, 'Dükkân'), courier),
      h('span', { class: 'ar-shop-gold' }, h('span', { class: 'ar-coin', html: glyph('coin') }), gold),
      closeBtn,
    ),
    tabsEl,
    grid,
    info,
    h('div', { class: 'ar-shop-baghead xsmall' }, h('span', null, 'Çantan'), h('span', { class: 'dim' }, 'tıkla, onayla: yarı fiyatına sat')),
    bag,
    stash,
    foot,
  );
  closeBtn.addEventListener('click', () => opts.onClose());

  let coarse = null;
  function matchCoarse() {
    if (coarse == null) { try { coarse = matchMedia('(pointer: coarse)').matches; } catch { coarse = false; } }
    return coarse;
  }

  function setTab(id) {
    tab = id;
    for (const [k, b] of Object.entries(tabBtns)) b.setAttribute('aria-selected', String(k === id));
    clear(grid);
    const T = SHOP_TABS.find((x) => x.id === id);
    for (const iid of T.items) grid.appendChild(btns[iid]);
    if (!T.items.includes(selected)) select(T.items[0]);
    else update(true);
  }

  function treeChip(id, owned, onPick) {
    const I = ITEMS[id];
    const b = h('button', { class: `ar-tree-chip${owned ? ' owned' : ''}`, type: 'button', title: `${I.name} — ${fmtNum(g() ? g().totalCost(id) : 0)} altın${owned ? ' (sende)' : ''}` },
      itemImg(I, 'ar-tree-img'),
      owned ? h('span', { class: 'ar-tree-ok', html: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' }) : null,
    );
    b.addEventListener('click', () => onPick(id));
    return b;
  }

  function select(id) {
    if (!ITEMS[id]) return;
    selected = id;
    for (const [k, b] of Object.entries(btns)) b.classList.toggle('sel', k === id);
    const I = ITEMS[id];
    infoName.textContent = I.name;
    clear(infoImg).appendChild(itemImg(I));
    infoDesc.textContent = I.desc;
    const pick = (x) => {
      const T = SHOP_TABS.find((t) => t.items.includes(x));
      if (T && T.id !== tab) setTab(T.id);
      select(x);
    };
    // ağaç: üst (girdiği eşyalar)
    clear(treeUp);
    const ups = buildsInto(id);
    for (const u of ups) treeUp.appendChild(treeChip(u, false, pick));
    treeUp.parentElement.hidden = !ups.length;
    // alt (bileşenler + tarif)
    clear(treeDown);
    const comps = I.components || [];
    treeDown.parentElement.hidden = !comps.length;
    if (comps.length) {
      const game = g();
      const plan = game ? game.buyPlan(id) : null;
      const ownedList = plan ? [...plan.owned] : [];
      for (const c of comps) {
        const k = ownedList.indexOf(c);
        const owned = k >= 0;
        if (owned) ownedList.splice(k, 1);
        treeDown.appendChild(treeChip(c, owned, pick));
      }
      if ((I.cost || 0) > 0) treeDown.appendChild(h('span', { class: 'ar-tree-recipe num', title: 'Tarif parşömeni' }, glyph('plus') ? h('span', { class: 'ar-tree-plus', html: glyph('plus') }) : null, `Tarif ${fmtNum(game ? game.itemCost(id) : I.cost)}`));
      else treeDown.appendChild(h('span', { class: 'ar-tree-recipe free' }, 'Ücretsiz tarif: kendiliğinden birleşir'));
    }
    update(true);
  }

  let last = '';
  function update(force = false) {
    if (!open && !force) return;
    const game = g();
    if (!game) return;
    const p = game.player;
    const key = `${p.gold}|${p.items.map((it) => (it ? it.id + (it.charges ?? '') + (it.reserved ? 'r' : '') : '-')).join(',')}|${p.neutral ? p.neutral.id : ''}|${game.neutralStash.join(',')}|${game.courier.state}|${game.courier.items.length}|${game.state}|${Math.ceil(game.breakT)}|${selected}|${tab}`;
    if (!force && key === last) return;
    last = key;
    gold.textContent = fmtNum(p.gold);
    gold.parentElement.title = `Güvenilir ${fmtNum(p.goldR)} · güvenilmez ${fmtNum(game.unreliable())} (ölünce %40’ı düşer)`;
    const T = SHOP_TABS.find((x) => x.id === tab);
    for (const id of T.items) {
      const b = btns[id];
      const chk = game.canBuy(id);
      b.classList.toggle('can', chk.ok);
      b.classList.toggle('poor', !chk.ok && chk.why === 'altın');
      b.classList.toggle('full', !chk.ok && chk.why === 'çanta');
      b.classList.toggle('have', game.hasItem(id));
      const cost = chk.plan ? chk.plan.cost : game.totalCost(id);
      const full = game.totalCost(id);
      const cs = b.children[1];
      const txt = fmtNum(cost);
      if (cs.textContent !== txt) cs.textContent = txt;
      cs.classList.toggle('disc', cost < full);
      b.setAttribute('aria-label', `${ITEMS[id].name}, ${txt} altın${cost < full ? ` (bileşenlerin düşüldü, tam fiyat ${fmtNum(full)})` : ''}. ${ITEMS[id].desc}`);
    }
    const chk = game.canBuy(selected);
    const plan = chk.plan || game.buyPlan(selected);
    const full = game.totalCost(selected);
    infoCost.textContent = plan && plan.cost < full ? `${fmtNum(plan.cost)} altın · tam ${fmtNum(full)}` : `${fmtNum(full)} altın`;
    buyBtn.disabled = !chk.ok;
    buyBtn.lastChild.textContent = chk.ok ? (plan && plan.use.length ? 'Al ve birleştir' : 'Satın al') : chk.why === 'altın' ? `${fmtNum(plan.cost - p.gold)} altın eksik` : chk.why === 'çanta' ? 'Çanta dolu' : chk.why === 'kurye' ? 'Kurye yok: çeşmeye dön' : 'Şimdi olmaz';
    for (let i = 0; i < SLOTS; i++) {
      const it = p.items[i];
      const s = bagSlots[i];
      const want = it ? `${it.id}:${it.charges ?? ''}:${it.reserved ? 'r' : ''}` : '';
      if (s.dataset.k !== want) {
        s.dataset.k = want;
        clear(s);
        s.classList.toggle('reserved', !!(it && it.reserved));
        if (it) {
          const I = ITEMS[it.id];
          const refund = Math.floor(game.totalCost(it.id) / 2);
          s.append(itemImg(I), it.charges != null && (I.charges > 1 || I.maxCharges) ? h('span', { class: 'ar-slot-n num' }, String(it.charges)) : null);
          s.setAttribute('aria-label', it.reserved ? `${I.name}: birleşmek üzere kuryeyi bekliyor` : `${I.name}: sat (${fmtNum(refund)} altın)`);
          s.title = it.reserved ? `${I.name} — kuryeyle gelen tarifle birleşecek` : `${I.name} — sat: ${fmtNum(refund)} altın`;
        } else {
          s.setAttribute('aria-label', 'Boş yuva');
          s.title = 'Boş yuva';
        }
      }
    }
    // orman yuvası ve stash
    const nk = p.neutral ? p.neutral.id : '';
    if (neutralSlot.dataset.k !== nk) {
      neutralSlot.dataset.k = nk;
      clear(neutralSlot);
      if (p.neutral) {
        const N = NEUTRALS[p.neutral.id];
        neutralSlot.appendChild(itemImg(N));
        neutralSlot.title = `Orman eşyası: ${N.name} — ${N.desc}`;
      } else neutralSlot.title = 'Orman eşyası yuvası (kamplardan düşer)';
    }
    const sk = game.neutralStash.join(',');
    if (stash.dataset.k !== sk) {
      stash.dataset.k = sk;
      clear(stash);
      stash.hidden = !game.neutralStash.length;
      if (game.neutralStash.length) {
        stash.appendChild(h('span', { class: 'xsmall dim' }, 'Orman sandığı (dokun: tak)'));
        for (const id of game.neutralStash) {
          const N = NEUTRALS[id];
          const b = h('button', { class: 'ar-stash-item', type: 'button', title: `${N.name} — ${N.desc}`, 'aria-label': `${N.name} tak. ${N.desc}` }, itemImg(N), h('span', { class: 'xsmall' }, N.name));
          b.addEventListener('click', () => { if (opts.onEquipNeutral) opts.onEquipNeutral(id); update(true); });
          stash.appendChild(b);
        }
      }
    }
    const c = game.courier;
    courier.textContent = game.mods.noCourier ? 'Kurye yok (lanet): yalnız çeşmede alışveriş' : c.state === 'home' ? (game.atFountain() ? 'Çeşmedesin: eşya anında gelir' : 'Kurye çeşmede bekliyor') : c.state === 'fly' ? `Kurye yolda (${c.items.length} eşya)` : 'Kurye dönüyor';
    const brk = game.state === 'break';
    foot.hidden = !brk;
    if (brk) breakTxt.textContent = `Sıradaki dalga ${Math.max(0, Math.ceil(game.breakT))} sn`;
  }

  setTab(tab);

  return {
    el,
    get open() { return open; },
    show() {
      open = true;
      el.hidden = false;
      select(selected);
      update(true);
    },
    hide() {
      open = false;
      el.hidden = true;
      for (const x of bagSlots) x.classList.remove('confirm');
    },
    update,
    select,
    setTab,
    focus() { try { btns[selected].focus({ preventScroll: true }); } catch { /* yok say */ } },
  };
}
