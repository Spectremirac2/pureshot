// 1vDOQUZ Arena 2.0 — dükkân paneli (mola arasında kendiliğinden açılır; B tuşu / altın düğmesi ile her an).
// Fareyle tıklama doğrudan satın alır; dokunmada önce seçilir, "Satın al" ile alınır (yanlışlıkla alım olmasın).

import { h, clear, fmtNum } from '../../../core/dom.js';
import { icon } from '../../../core/icons.js';
import { itemIconUrl } from '../../../core/assets.js';
import { ITEMS, SHOP, SLOTS } from './items.js';
import { glyph } from './glyphs.js';

export function itemImg(I, cls = 'ar-item-img') {
  const url = itemIconUrl(I.icon);
  if (url) return h('img', { class: cls, src: url, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' });
  return h('span', { class: `${cls} ar-item-fb`, html: glyph('rune') });
}

/**
 * opts: { game, onBuy(id), onSell(slot), onClose(), onReady(), sound }
 */
export function buildShop(opts) {
  const g = () => opts.game;
  let selected = SHOP[0];
  let open = false;
  const gold = h('b', { class: 'num' }, '0');
  const courier = h('span', { class: 'ar-shop-courier xsmall' });
  const closeBtn = h('button', { class: 'ar-tool ar-shop-x', type: 'button', 'aria-label': 'Dükkânı kapat (B)', title: 'Kapat (B)' }, icon('close', { size: 18 }));
  const grid = h('div', { class: 'ar-shop-grid', role: 'list' });
  const btns = {};
  for (const id of SHOP) {
    const I = ITEMS[id];
    const b = h('button', { class: `ar-shop-item tier-${I.tier}`, type: 'button', role: 'listitem', dataset: { id }, 'aria-label': `${I.name}, ${I.cost} altın. ${I.desc}` },
      itemImg(I),
      h('span', { class: 'ar-shop-cost num' }, fmtNum(I.cost)),
      h('span', { class: 'ar-shop-name' }, I.name),
    );
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') select(id); });
    b.addEventListener('focus', () => select(id));
    b.addEventListener('click', (e) => {
      const touchy = e.pointerType === 'touch' || e.pointerType === 'pen' || (e.detail === 0 ? false : matchCoarse());
      if (touchy && selected !== id) { select(id); return; }
      select(id);
      opts.onBuy(id);
      update(true);
    });
    btns[id] = b;
    grid.appendChild(b);
  }
  const infoName = h('strong', { class: 'ar-shop-iname' });
  const infoCost = h('span', { class: 'ar-shop-icost num' });
  const infoDesc = h('p', { class: 'ar-shop-idesc' });
  const buyBtn = h('button', { class: 'btn primary ar-shop-buy', type: 'button' }, icon('coin', { size: 16 }), h('span', null, 'Satın al'));
  buyBtn.addEventListener('click', () => { opts.onBuy(selected); update(true); });
  const info = h('div', { class: 'ar-shop-info' }, h('div', { class: 'ar-shop-ihead' }, infoName, infoCost), infoDesc, buyBtn);
  const bag = h('div', { class: 'ar-shop-bag', role: 'list', 'aria-label': 'Çantan (tıkla: yarı fiyatına sat)' });
  const bagSlots = [];
  for (let i = 0; i < SLOTS; i++) {
    const s = h('button', { class: 'ar-shop-slot', type: 'button', role: 'listitem', dataset: { i: String(i) } });
    s.addEventListener('click', () => {
      const it = g().player.items[i];
      if (!it) return;
      if (s.classList.contains('confirm')) { opts.onSell(i); s.classList.remove('confirm'); update(true); return; }
      for (const x of bagSlots) x.classList.remove('confirm');
      s.classList.add('confirm');
      setTimeout(() => s.classList.remove('confirm'), 2200);
    });
    bagSlots.push(s);
    bag.appendChild(s);
  }
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
    grid,
    info,
    h('div', { class: 'ar-shop-baghead xsmall' }, h('span', null, 'Çantan'), h('span', { class: 'dim' }, 'tıkla, onayla: yarı fiyatına sat')),
    bag,
    foot,
  );
  closeBtn.addEventListener('click', () => opts.onClose());

  let coarse = null;
  function matchCoarse() {
    if (coarse == null) { try { coarse = matchMedia('(pointer: coarse)').matches; } catch { coarse = false; } }
    return coarse;
  }

  function select(id) {
    selected = id;
    for (const [k, b] of Object.entries(btns)) b.classList.toggle('sel', k === id);
    const I = ITEMS[id];
    infoName.textContent = I.name;
    infoCost.textContent = `${fmtNum(I.cost)} altın`;
    infoDesc.textContent = I.desc;
    update(true);
  }

  let last = '';
  function update(force = false) {
    if (!open && !force) return;
    const game = g();
    const p = game.player;
    const key = `${p.gold}|${p.items.map((it) => (it ? it.id + (it.charges ?? '') : '-')).join(',')}|${game.courier.state}|${game.courier.items.length}|${game.state}|${Math.ceil(game.breakT)}|${selected}`;
    if (!force && key === last) return;
    last = key;
    gold.textContent = fmtNum(p.gold);
    for (const [id, b] of Object.entries(btns)) {
      const chk = game.canBuy(id);
      b.classList.toggle('can', chk.ok);
      b.classList.toggle('poor', !chk.ok && chk.why === 'altın');
      b.classList.toggle('full', !chk.ok && chk.why === 'çanta');
    }
    const chk = game.canBuy(selected);
    buyBtn.disabled = !chk.ok;
    buyBtn.lastChild.textContent = chk.ok ? 'Satın al' : chk.why === 'altın' ? `${fmtNum(ITEMS[selected].cost - p.gold)} altın eksik` : chk.why === 'çanta' ? 'Çanta dolu' : 'Şimdi olmaz';
    for (let i = 0; i < SLOTS; i++) {
      const it = p.items[i];
      const s = bagSlots[i];
      const want = it ? it.id + ':' + (it.charges ?? '') : '';
      if (s.dataset.k !== want) {
        s.dataset.k = want;
        clear(s);
        if (it) {
          const I = ITEMS[it.id];
          s.append(itemImg(I), it.charges != null && (I.charges > 1 || I.maxCharges) ? h('span', { class: 'ar-slot-n num' }, String(it.charges)) : null);
          s.setAttribute('aria-label', `${I.name}: sat (${fmtNum(Math.floor(I.cost / 2))} altın)`);
          s.title = `${I.name} — sat: ${fmtNum(Math.floor(I.cost / 2))} altın`;
        } else {
          s.setAttribute('aria-label', 'Boş yuva');
          s.title = 'Boş yuva';
        }
      }
    }
    const c = game.courier;
    courier.textContent = c.state === 'home' ? (game.atFountain() ? 'Çeşmedesin: eşya anında gelir' : 'Kurye çeşmede bekliyor') : c.state === 'fly' ? `Kurye yolda (${c.items.length} eşya)` : 'Kurye dönüyor';
    const brk = game.state === 'break';
    foot.hidden = !brk;
    if (brk) breakTxt.textContent = `Sıradaki dalga ${Math.max(0, Math.ceil(game.breakT))} sn`;
  }

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
    focus() { try { btns[selected].focus({ preventScroll: true }); } catch { /* yok say */ } },
  };
}
