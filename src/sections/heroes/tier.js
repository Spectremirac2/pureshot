// DOG Tier Listesi: topluluk endeksine göre S/A/B/C/D sütunları + "Kendi listeni yap" modu.
// Masaüstü: sürükle-bırak (pointer events). Dokunmatik: kahramana dokun → tier'e dokun.
// Kişisel yerleşimler picks['tl:<id>'] = 'S'|'A'|'B'|'C'|'D'.

import { h, clear, ls, copyText } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { HEROES, DOG_TIERS } from '../../data/heroes.js';
import { crestSvg } from './crest.js';

export function mountTier(host, env) {
  const { ctx, comm } = env;
  const cleanups = [];
  let mode = ls.get('hr:tiermode') === 'kendi' ? 'kendi' : 'topluluk';
  let selected = null;
  let dragging = null;
  let dirtyWhileDrag = false;

  // ---------------------------------------------------------------- araç çubuğu
  const modeBtns = [
    { id: 'topluluk', label: 'Topluluk listesi', ic: 'user' },
    { id: 'kendi', label: 'Kendi listeni yap', ic: 'crown' },
  ].map((m) => {
    const b = h('button', { class: 'hr-seg-btn', type: 'button', 'aria-pressed': String(mode === m.id), dataset: { v: m.id } }, icon(m.ic, { size: 16 }), m.label);
    b.addEventListener('click', () => {
      if (mode === m.id) return;
      mode = m.id;
      ls.set('hr:tiermode', mode);
      selected = null;
      ctx.sound.click();
      render();
    });
    return b;
  });
  const fillBtn = h('button', { class: 'btn ghost sm', type: 'button' }, icon('sparkle', { size: 16 }), 'Toplulukla doldur');
  const resetBtn = h('button', { class: 'btn ghost sm', type: 'button' }, icon('trash', { size: 16 }), 'Sıfırla');
  const copyBtn = h('button', { class: 'btn gold sm', type: 'button' }, icon('copy', { size: 16 }), 'Metin olarak kopyala');
  const intro = h('p', { class: 'small muted hr-tier-intro' });
  const view = h('section', { class: 'hr-tierview', 'aria-label': 'DOG Tier Listesi' });
  const info = h('div', { class: 'hr-tier-info', 'aria-live': 'polite' });

  fillBtn.addEventListener('click', async () => {
    const mine = Object.values(myPlacements()).filter(Boolean).length;
    if (mine) {
      const ok = await ctx.fx.confirm('Yerleşmemiş kahramanlar topluluğun tier’ine göre doldurulsun mu? Kendi yerleşimlerin korunur.', { ok: 'Doldur' });
      if (!ok) return;
    }
    const map = {};
    for (const hero of HEROES) {
      const s = comm.get(hero.id);
      if (!s.myTier) map[hero.id] = s.tier.id;
    }
    comm.placeMany(map);
    ctx.sound.good();
    ctx.fx.toast('Boşlar topluluk listesiyle dolduruldu; şimdi istediğini taşı.', 'jade');
  });
  resetBtn.addEventListener('click', async () => {
    const ok = await ctx.fx.confirm('Kendi tier listen tamamen silinsin mi?', { ok: 'Sıfırla', danger: true });
    if (!ok) return;
    const map = {};
    for (const hero of HEROES) map[hero.id] = null;
    comm.placeMany(map);
    selected = null;
    ctx.fx.toast('Liste sıfırlandı.');
  });
  copyBtn.addEventListener('click', async () => {
    const text = asText();
    const ok = await copyText(text);
    if (ok) { ctx.sound.coin(); ctx.fx.toast('Tier listesi panoya kopyalandı.', 'jade'); return; }
    const ta = h('textarea', { class: 'textarea', id: 'hr-tier-copy', rows: '10', readonly: true }, text);
    const close = ctx.fx.modal(h('div', { class: 'stack' },
      h('h2', { class: 'h3' }, 'Listeyi kopyala'),
      h('label', { class: 'small muted', for: 'hr-tier-copy' }, 'Pano erişimi yok; metni seçip kendin kopyalayabilirsin.'),
      ta,
      h('div', { class: 'row', style: 'justify-content:flex-end' }, h('button', { class: 'btn primary', type: 'button', onclick: () => close() }, 'Tamam')),
    ), { label: 'Tier listesini kopyala' });
    ta.focus();
    ta.select();
  });

  const toolbar = h('div', { class: 'hr-tier-bar' },
    h('div', { class: 'hr-seg', role: 'group', 'aria-label': 'Liste türü' }, modeBtns),
    h('div', { class: 'row hr-tier-actions' }, fillBtn, resetBtn, copyBtn),
  );

  // ---------------------------------------------------------------- pano
  const zones = new Map(); // tier id | 'pool' → { el, list, count }
  const board = h('div', { class: 'hr-tiers' });
  for (const t of DOG_TIERS) {
    const list = h('div', { class: 'hr-tier-list', dataset: { tier: t.id } });
    const count = h('span', { class: 'hr-tier-count mono' });
    const headBtn = h('button', { class: `hr-tier-head hr-t-${t.id}`, type: 'button', dataset: { tier: t.id }, 'aria-label': `${t.id} · ${t.label}` },
      h('span', { class: 'hr-tier-letter' }, t.id),
      h('span', { class: 'hr-tier-name' }, t.label, count),
    );
    headBtn.addEventListener('click', () => onZoneTap(t.id));
    list.addEventListener('click', (e) => { if (e.target === list) onZoneTap(t.id); });
    const col = h('section', { class: `hr-tier hr-t-${t.id}`, dataset: { tier: t.id }, 'aria-label': `${t.id} · ${t.label}` }, headBtn, list);
    zones.set(t.id, { el: col, list, count });
    board.appendChild(col);
  }
  const poolList = h('div', { class: 'hr-tier-list hr-pool-list', dataset: { tier: 'pool' } });
  const poolCount = h('span', { class: 'hr-tier-count mono' });
  const poolHead = h('button', { class: 'hr-pool-head', type: 'button', dataset: { tier: 'pool' } }, icon('dice', { size: 16 }), 'Yerleşmemiş kahramanlar', poolCount);
  poolHead.addEventListener('click', () => onZoneTap('pool'));
  poolList.addEventListener('click', (e) => { if (e.target === poolList) onZoneTap('pool'); });
  const pool = h('section', { class: 'hr-pool', dataset: { tier: 'pool' }, 'aria-label': 'Yerleşmemiş kahramanlar' }, poolHead, poolList);
  zones.set('pool', { el: pool, list: poolList, count: poolCount });

  // ---------------------------------------------------------------- jetonlar
  const tokens = new Map();
  for (const hero of HEROES) {
    const corner = h('span', { class: 'hr-tok-corner mono' });
    const tok = h('button', { class: `hr-tok hr-a-${hero.attr}`, type: 'button', title: hero.name, dataset: { id: hero.id } },
      crestSvg(hero, { ring: false }),
      h('span', { class: 'hr-tok-name' }, hero.name),
      corner,
    );
    tokens.set(hero.id, { tok, corner });
    tok.addEventListener('click', (e) => {
      if (tok.dataset.dragged) { delete tok.dataset.dragged; e.preventDefault(); return; }
      if (mode === 'topluluk') { env.openHero(hero.id); return; }
      selected = selected === hero.id ? null : hero.id;
      ctx.sound.click();
      renderSelection();
    });
    tok.addEventListener('pointerdown', (e) => onPointerDown(e, hero, tok));
  }

  function myPlacements() {
    const out = {};
    for (const hero of HEROES) out[hero.id] = comm.get(hero.id)?.myTier || null;
    return out;
  }

  // ---------------------------------------------------------------- sürükle-bırak
  function onPointerDown(e, hero, tok) {
    if (mode !== 'kendi') return;
    if (e.pointerType === 'touch' || e.button !== 0) return; // dokunmatik: seç → dokun
    const start = { x: e.clientX, y: e.clientY };
    let ghost = null;
    let over = null;
    const move = (ev) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!ghost) {
        if (Math.hypot(dx, dy) < 6) return;
        ghost = h('div', { class: `hr-ghost hr-a-${hero.attr}`, 'aria-hidden': 'true' }, crestSvg(hero, { ring: false }), h('span', null, hero.name));
        document.body.appendChild(ghost);
        dragging = hero.id;
        tok.classList.add('is-dragging');
        board.classList.add('is-dragging');
        try { tok.setPointerCapture(ev.pointerId); } catch { /* yok say */ }
      }
      ghost.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px) translate(-50%, -60%)`;
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const zoneEl = target && target.closest('[data-tier]');
      const z = zoneEl ? zoneEl.dataset.tier : null;
      if (z !== over) {
        if (over && zones.get(over)) zones.get(over).el.classList.remove('is-over');
        over = z;
        if (over && zones.get(over)) zones.get(over).el.classList.add('is-over');
      }
      // kenara yaklaşınca sayfayı kaydır
      const edge = 70;
      if (ev.clientY < edge + 60) window.scrollBy(0, -12);
      else if (ev.clientY > innerHeight - edge - 80) window.scrollBy(0, 12);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!ghost) return;
      ghost.remove();
      tok.classList.remove('is-dragging');
      board.classList.remove('is-dragging');
      tok.dataset.dragged = '1';
      setTimeout(() => { delete tok.dataset.dragged; }, 0);
      if (over && zones.get(over)) zones.get(over).el.classList.remove('is-over');
      dragging = null;
      if (over) place(hero.id, over === 'pool' ? null : over);
      if (dirtyWhileDrag) { dirtyWhileDrag = false; render(); }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    activeDrag = () => { up(); };
  }
  let activeDrag = null;
  cleanups.push(() => { if (activeDrag) activeDrag(); });

  function onZoneTap(tier) {
    if (mode !== 'kendi' || !selected) return;
    place(selected, tier === 'pool' ? null : tier);
  }

  function place(id, tier) {
    const s = comm.get(id);
    if ((s.myTier || null) === tier) return;
    comm.place(id, tier);
    ctx.sound.coin();
    selected = id;
  }

  // Klavye: seçili kahraman için 1–5 → S..D, 0 → havuz (D tuşu kabuk kısayolu olduğu için rakamlar)
  const onKey = (e) => {
    if (mode !== 'kendi' || !selected || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (document.querySelector('.modal-backdrop')) return;
    const map = { 1: 'S', 2: 'A', 3: 'B', 4: 'C', 5: 'D', 0: 'pool' };
    if (e.key in map) {
      e.preventDefault();
      const z = map[e.key];
      place(selected, z === 'pool' ? null : z);
    } else if (e.key === 'Escape') {
      selected = null;
      renderSelection();
    }
  };
  window.addEventListener('keydown', onKey);
  cleanups.push(() => window.removeEventListener('keydown', onKey));

  // ---------------------------------------------------------------- çizim
  function placementOf(hero) {
    const s = comm.get(hero.id);
    if (mode === 'topluluk') return s.tier.id;
    return s.myTier || 'pool';
  }

  function render() {
    if (dragging) { dirtyWhileDrag = true; return; }
    modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === mode)));
    view.classList.toggle('is-own', mode === 'kendi');
    fillBtn.hidden = mode !== 'kendi';
    resetBtn.hidden = mode !== 'kendi';
    intro.textContent = mode === 'topluluk'
      ? 'Sütunlar Topluluk DOG Endeksi’ne göre dizildi: ön yargı tabanı + canlı oylar. Bir kahramana dokun, dosyası açılsın.'
      : 'Kahramanı sürükleyip bir sütuna bırak. Dokunmatikte: önce kahramana, sonra sütun başlığına dokun. Klavye: seçip 1–5 (S–D), 0 (havuz). Köşedeki harf topluluğun ortalama tier’i.'
        + (env.readOnly() ? ' Salt okunur görüntüleme: listen yalnızca bu cihazda saklanır, topluluk ortalamasına eklenmez.' : '');

    const buckets = new Map([...zones.keys()].map((k) => [k, []]));
    for (const hero of HEROES) buckets.get(placementOf(hero)).push(hero);
    for (const [z, list] of buckets) {
      list.sort((a, b) => comm.value(b.id, 'live') - comm.value(a.id, 'live') || a.name.localeCompare(b.name));
      const zone = zones.get(z);
      const frag = document.createDocumentFragment();
      for (const hero of list) {
        const { tok, corner } = tokens.get(hero.id);
        const s = comm.get(hero.id);
        if (mode === 'topluluk') {
          corner.textContent = String(s.liveRound);
          corner.title = `Topluluk endeksi %${s.liveRound}`;
          tok.setAttribute('aria-label', `${hero.name}: topluluk endeksi %${s.liveRound}. Dosyayı aç.`);
        } else {
          const avg = s.tlAvgTier || s.tier.id;
          corner.textContent = avg;
          corner.title = s.tlN ? `Topluluğun ortalama tier’i: ${avg} (${s.tlN} yerleşim)` : `Henüz yerleşim yok; endekse göre ${avg}`;
          tok.setAttribute('aria-label', `${hero.name}: ${s.myTier ? 'senin tier’in ' + s.myTier : 'yerleşmemiş'}, topluluk ortalaması ${avg}. Seçmek için bas.`);
        }
        corner.className = `hr-tok-corner mono hr-t-${mode === 'topluluk' ? s.tier.id : (s.tlAvgTier || s.tier.id)}`;
        frag.appendChild(tok);
      }
      clear(zone.list).appendChild(frag);
      zone.count.textContent = String(list.length);
      if (!list.length && z !== 'pool') zone.list.appendChild(h('span', { class: 'hr-tier-empty xsmall dim' }, mode === 'kendi' ? 'Buraya bırak' : 'Boş'));
    }
    pool.hidden = mode !== 'kendi';
    if (mode === 'kendi' && !buckets.get('pool').length) poolList.appendChild(h('span', { class: 'hr-tier-empty xsmall dim' }, 'Herkes yerleşti. Tebrikler, artık resmî DOG hakemisin.'));
    renderSelection();
  }

  function renderSelection() {
    for (const [id, { tok }] of tokens) {
      const on = id === selected && mode === 'kendi';
      tok.classList.toggle('is-selected', on);
      tok.setAttribute('aria-pressed', mode === 'kendi' ? String(on) : 'false');
      if (mode !== 'kendi') tok.removeAttribute('aria-pressed');
    }
    board.classList.toggle('is-picking', !!selected && mode === 'kendi');
    pool.classList.toggle('is-picking', !!selected && mode === 'kendi');
    clear(info);
    if (mode !== 'kendi') return;
    if (!selected) {
      info.appendChild(h('span', { class: 'small dim' }, 'Bir kahraman seç (ya da masaüstünde sürükle); sonra sütuna ya da buradaki S–D düğmelerine dokun.'));
      return;
    }
    const s = comm.get(selected);
    const hero = HEROES.find((x) => x.id === selected);
    const quick = h('div', { class: 'hr-quick', role: 'group', 'aria-label': `${hero.name} için tier seç` },
      [...DOG_TIERS.map((t) => t.id), 'pool'].map((z) => h('button', {
        class: `hr-quick-btn${z !== 'pool' ? ' hr-t-' + z : ''}`,
        type: 'button',
        'aria-pressed': String((s.myTier || 'pool') === z),
        title: z === 'pool' ? 'Havuza geri koy' : `${z} kademesine koy`,
        onclick: () => place(hero.id, z === 'pool' ? null : z),
      }, z === 'pool' ? icon('refresh', { size: 16 }) : z)),
    );
    info.append(
      h('span', { class: 'hr-tier-info-who' },
        crestSvg(hero, { value: s.live, cls: 'hr-crest-sm' }),
        h('span', { class: 'small' }, h('strong', null, hero.name), h('span', { class: 'hr-tier-info-meta' }, ` · senin: ${s.myTier || '—'} · topluluk ort.: ${s.tlAvgTier || '—'}${s.tlN ? ` (${s.tlN})` : ''} · endeks: ${s.tier.id} (%${s.liveRound})`)),
      ),
      h('span', { class: 'spacer' }),
      quick,
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => env.openHero(hero.id) }, 'Dosya'),
    );
  }

  function asText() {
    const lines = [`Kahraman DOG Tier Listesi (${mode === 'topluluk' ? 'topluluk endeksi' : 'benim listem'}) · DOG DOG DOG Üssü`];
    for (const t of DOG_TIERS) {
      const list = HEROES.filter((x) => placementOf(x) === t.id)
        .sort((a, b) => comm.value(b.id, 'live') - comm.value(a.id, 'live') || a.name.localeCompare(b.name));
      lines.push(`${t.id} (${t.label}): ${list.length ? list.map((x) => x.name).join(', ') : '—'}`);
    }
    if (mode === 'kendi') {
      const rest = HEROES.filter((x) => placementOf(x) === 'pool');
      if (rest.length) lines.push(`Yerleşmemiş: ${rest.length} kahraman`);
    }
    lines.push('Topluluk ön yargılarına dayalı mizahi endeks — kahramanlar masumdur, DOG’luk oyuncudadır.');
    return lines.join('\n');
  }

  view.append(
    h('div', { class: 'section-head hr-sub-head' },
      h('span', { class: 'eyebrow' }, 'S’ten D’ye'),
      h('h2', { class: 'h2' }, 'DOG Tier Listesi'),
      intro,
    ),
    toolbar,
    info,
    board,
    pool,
  );
  host.append(view);

  let raf = 0;
  cleanups.push(comm.subscribe(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(render);
  }));
  cleanups.push(() => cancelAnimationFrame(raf));
  render();

  return {
    destroy() {
      for (const c of cleanups) { try { c(); } catch (e) { console.error(e); } }
      clear(host);
    },
  };
}
