// Skor tablosu: fan belgelerindeki scores[gameId] değerlerinden canlı sıralama.
//   mountLeaderboard(el, { gameId: 'arena', title: 'Arena Efsaneleri', higherIsBetter: true, format: (n) => n + ' puan' })
//
// Paylaşılan arka uçta (Artifact db / API: store.shared) herkesin skorlarından "ilk 10" tablosu çizilir.
// Statik yayında (veriler yalnızca ziyaretçinin tarayıcısında) o tablo tek satır olurdu; bunun yerine kişisel
// "Rekor defterin" görünümü çizilir: en iyi skor, son denemeler (core/history.js, yeniden eskiye, göreli zaman),
// yöne duyarlı gelişim çizgisi (yukarı = daha iyi) ve deneme sayısı. Yeni deneme ve profil değişikliğinde canlı
// güncellenir. İsteğe bağlı: personalTitle (kişisel görünüm başlığı; varsayılan "Rekor defterin").

import { h, clear, fmtNum, timeAgo, prefersReducedMotion } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { store, agg } from '../core/store.js';
import { history } from '../core/history.js';

export function mountLeaderboard(el, opts = {}) {
  let stop = null;
  let alive = true;
  const start = () => {
    if (!alive) return;
    stop = store.shared ? mountShared(el, opts) : mountPersonal(el, opts);
  };
  // Arka uç hazır olunca kip bellidir (statik yayında hemen)
  if (store.mode) start();
  else store.ready.then(start, start);
  return () => {
    alive = false;
    if (stop) stop();
    stop = null;
  };
}

// ------------------------------------------------------------------ paylaşılan: canlı ilk 10
function mountShared(el, { gameId, title = 'Skor Tablosu', higherIsBetter = true, format = (n) => fmtNum(n), limit = 10 } = {}) {
  const body = h('ol', { class: 'lb-list' });
  const note = h('p', { class: 'xsmall dim' });
  const root = h('section', { class: 'panel tight lb', 'aria-label': title },
    h('div', { class: 'panel-head' }, h('h3', { class: 'h3 row' }, icon('trophy', { size: 18 }), title)),
    body,
    note,
  );
  el.appendChild(root);

  const unsub = store.fans((fans) => {
    const rows = agg.leaderboard(fans, gameId, limit, higherIsBetter);
    const me = store.uid() || 'me';
    clear(body);
    if (!rows.length) {
      body.appendChild(h('li', { class: 'empty small' }, 'Henüz skor yok. İlk sen yaz.'));
    }
    rows.forEach((r, i) => {
      body.appendChild(
        h('li', { class: `lb-row${r.id === me ? ' me' : ''}` },
          h('span', { class: `lb-rank num${i < 3 ? ' top' : ''}` }, String(i + 1)),
          h('span', { class: 'lb-nick' }, r.nick),
          h('span', { class: 'lb-score num' }, format(r.score)),
        ),
      );
    });
    note.textContent = store.shared ? '' : 'Önizleme modu: skorlar bu cihazda tutuluyor.';
  });

  return () => { unsub(); root.remove(); };
}

// ------------------------------------------------------------------ kişisel: rekor defteri
const SHOW = 5; // katlanmış görünümde en yeni deneme sayısı
let uidSeq = 0;

const fullDate = (t) => {
  try {
    return new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

/** Son denemeler çizgisi (SVG). Düşük-iyi oyunlarda eksen ters: yukarı her zaman daha iyi. */
function sparkline(list, up, bestIdx, fmt) {
  const W = 260, H = 64, PX = 7, PY = 8;
  const vals = list.map((e) => e.s);
  const n = vals.length;
  const min = Math.min(...vals), max = Math.max(...vals);
  const x = (i) => (n === 1 ? W / 2 : PX + (i / (n - 1)) * (W - 2 * PX));
  const y = (v) => {
    if (max === min) return H / 2;
    const t = (v - min) / (max - min);
    return up ? H - PY - t * (H - 2 * PY) : PY + t * (H - 2 * PY);
  };
  const last = vals[n - 1];
  const svg = h('svg', {
    class: 'lbp-spark', viewBox: `0 0 ${W} ${H}`, role: 'img',
    'aria-label': `Son ${n} deneme. En iyi: ${fmt(up ? max : min)}, son: ${fmt(last)}. Yukarı daha iyi.`,
  });
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  // Zemin çizgileri (en iyi seviyesi kesikli)
  const by = y(up ? max : min);
  svg.append(h('line', { class: 'lbp-spark-best-line', x1: '0', x2: String(W), y1: by.toFixed(1), y2: by.toFixed(1) }));
  if (n > 1) {
    svg.append(
      h('polygon', { class: 'lbp-spark-area', points: `${x(0).toFixed(1)},${H} ${pts.join(' ')} ${x(n - 1).toFixed(1)},${H}` }),
      h('polyline', { class: 'lbp-spark-line', points: pts.join(' ') }),
    );
  }
  vals.forEach((v, i) => {
    if (i === bestIdx || i === n - 1) return;
    svg.append(h('circle', { class: 'lbp-spark-dot', cx: x(i).toFixed(1), cy: y(v).toFixed(1), r: '2' }));
  });
  if (bestIdx !== n - 1) svg.append(h('circle', { class: 'lbp-spark-last', cx: x(n - 1).toFixed(1), cy: y(last).toFixed(1), r: '3.4' }));
  if (bestIdx >= 0) svg.append(h('circle', { class: 'lbp-spark-best', cx: x(bestIdx).toFixed(1), cy: y(vals[bestIdx]).toFixed(1), r: '4.6' }));
  return svg;
}

function mountPersonal(el, { gameId, higherIsBetter = true, format = (n) => fmtNum(n), personalTitle = null } = {}) {
  injectStyle();
  const up = higherIsBetter !== false;
  const fmt = (n) => { try { return format(n); } catch { return fmtNum(n); } };
  const heading = personalTitle || 'Rekor defterin';
  const hid = `lbp-h-${++uidSeq}`;

  const bestV = h('strong', { class: 'lbp-best-v num' });
  const meta = h('span', { class: 'lbp-meta' });
  const sparkBox = h('div', { class: 'lbp-spark-box' });
  const hero = h('div', { class: 'lbp-hero' },
    h('div', { class: 'lbp-best' },
      h('span', { class: 'lbp-k' }, icon('crown', { size: 13, stroke: 2 }), up ? 'En iyin' : 'En iyin · düşük iyi'),
      bestV,
      meta,
    ),
    sparkBox,
  );
  const list = h('ol', { class: 'lbp-list', 'aria-label': 'Son denemeler, yeniden eskiye' });
  const listHead = h('div', { class: 'lbp-sub' }, h('span', null, 'Son denemeler'), h('span', { class: 'lbp-sub-r' }, 'yeniden eskiye'));
  const more = h('button', { class: 'btn ghost sm lbp-more', type: 'button', 'aria-expanded': 'false' });
  const empty = h('div', { class: 'lbp-empty' },
    h('span', { class: 'lbp-empty-ico', 'aria-hidden': 'true' }, icon('trophy', { size: 22 })),
    h('span', null, h('strong', null, 'Henüz denemen yok.'), ' İlk skorunu yaz; son denemelerin ve gelişim çizgin burada birikir.'),
  );
  const profileLink = h('a', { href: '#profil--rekorlar' }, 'Tüm rekorların', icon('arrowRight', { size: 12 }));
  const note = h('p', { class: 'lbp-note' }, icon('user', { size: 12 }), h('span', null, 'Skorlar bu cihazda tutuluyor. '), profileLink);

  const root = h('section', { class: 'panel tight lb lbp', 'aria-labelledby': hid, 'data-game': gameId || '' },
    h('div', { class: 'panel-head lbp-head' },
      h('h3', { class: 'h3 row', id: hid }, icon('trophy', { size: 18 }), heading),
      h('span', { class: 'lbp-chip' }, 'Bu cihaz'),
    ),
    hero,
    empty,
    listHead,
    list,
    more,
    note,
  );
  el.appendChild(root);

  let open = false;
  let lastNewest = null;
  more.addEventListener('click', () => {
    open = !open;
    more.setAttribute('aria-expanded', String(open));
    paint();
  });

  function row(e, attemptNo, isBest, fresh) {
    return h('li', { class: `lbp-row${isBest ? ' is-best' : ''}${fresh ? ' is-fresh' : ''}` },
      h('span', { class: 'lbp-n num' }, `#${fmtNum(attemptNo)}`),
      h('span', { class: 'lbp-when', title: fullDate(e.t) }, timeAgo(e.t)),
      isBest ? h('span', { class: 'lbp-tag', title: 'Rekor' }, icon('crown', { size: 11, stroke: 2.2 }), h('span', { class: 'lbp-tag-t' }, 'Rekor')) : h('span'),
      h('span', { class: 'lbp-s num' }, fmt(e.s)),
    );
  }

  function paint() {
    const hist = history.get(gameId).filter((e) => e && typeof e.s === 'number' && Number.isFinite(e.s));
    const mine = (store.me.get().scores || {})[gameId];
    const n = hist.length;
    const best = typeof mine === 'number' && Number.isFinite(mine)
      ? mine
      : n ? (up ? Math.max(...hist.map((e) => e.s)) : Math.min(...hist.map((e) => e.s))) : null;
    const total = history.count(gameId);
    const has = best != null;

    hero.hidden = !has;
    empty.hidden = has;
    listHead.hidden = !n;
    list.hidden = !n;

    if (has) {
      bestV.textContent = fmt(best);
      const last = n ? hist[n - 1] : null;
      meta.textContent = n
        ? `${fmtNum(total)} deneme · son: ${timeAgo(last.t)}`
        : 'Son denemelerin bir sonraki turdan itibaren burada birikir.';
    }
    // Rekoru ilk kez yazan deneme (liste içinde yoksa vurgu yok)
    const bestIdx = has ? hist.findIndex((e) => e.s === best) : -1;
    clear(sparkBox);
    if (n >= 2) {
      sparkBox.append(sparkline(hist, up, bestIdx, fmt), h('span', { class: 'lbp-spark-cap' }, `Son ${n} deneme · yukarı = daha iyi`));
    } else if (n === 1) {
      sparkBox.append(h('span', { class: 'lbp-spark-cap lbp-spark-solo' }, 'Bir deneme daha, gelişim çizgin başlasın.'));
    }
    sparkBox.hidden = !n;

    // Liste: yeniden eskiye; katlanmışken en yeni SHOW deneme + (dışarıda kaldıysa) rekor satırı
    const newest = n ? hist[n - 1].t : null;
    const fresh = lastNewest != null && newest != null && newest > lastNewest;
    lastNewest = newest;
    const order = hist.map((e, i) => ({ e, i })).reverse();
    const shown = open ? order : order.slice(0, SHOW);
    const nodes = shown.map(({ e, i }, k) => row(e, total - (n - 1 - i), i === bestIdx, fresh && k === 0));
    if (!open && bestIdx >= 0 && !shown.some((o) => o.i === bestIdx)) {
      nodes.push(h('li', { class: 'lbp-gap', 'aria-hidden': 'true' }, '···'));
      nodes.push(row(hist[bestIdx], total - (n - 1 - bestIdx), true, false));
    }
    list.replaceChildren(...nodes);
    more.hidden = n <= SHOW;
    more.replaceChildren(open ? 'Daha az göster' : `Tüm denemeler (${n})`);
    if (fresh && !prefersReducedMotion()) {
      root.classList.remove('is-bump');
      void root.offsetWidth;
      root.classList.add('is-bump');
    }
  }

  paint();
  const unHist = history.subscribe((id) => { if (id === gameId) paint(); });
  const unMe = store.me.subscribe(paint);
  // Başka sekmede oynanan denemeler
  const onStorage = (e) => { if (e.key === 'csk:hist' || e.key === 'csk:me') paint(); };
  window.addEventListener('storage', onStorage);
  // Göreli zamanlar ("3 dk önce") tazelensin
  const iv = setInterval(() => { if (!document.hidden) paint(); }, 30000);

  return () => {
    unHist();
    unMe();
    window.removeEventListener('storage', onStorage);
    clearInterval(iv);
    root.remove();
  };
}

// Stiller bu bileşenle birlikte (ortak CSS'e dokunmadan her bölümde çalışsın; bkz. badges.js deseni)
let styled = false;
function injectStyle() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const css = `.lbp{--lbc:var(--gc,var(--ember));gap:10px}
.lbp[hidden],.lbp [hidden]{display:none!important}
.lbp-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
.lbp-head .h3{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lbp-head .h3 svg{flex:none;color:var(--aegis)}
.lbp-chip{flex:none;padding:2px 8px;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--text-3);border:1px solid var(--line-2);border-radius:999px;white-space:nowrap}
.lbp-hero{display:flex;flex-wrap:wrap;align-items:stretch;gap:10px 16px;padding:12px 14px;background:radial-gradient(120% 120% at 0% 0%,color-mix(in srgb,var(--lbc) 14%,transparent),transparent 60%),color-mix(in srgb,var(--bg) 55%,transparent);border:1px solid color-mix(in srgb,var(--lbc) 30%,var(--line));border-left:2px solid var(--lbc)}
.lbp-best{flex:1 0 auto;display:flex;flex-direction:column;gap:2px;min-width:0;max-width:100%}
.lbp-k{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-lore);font-weight:700;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--aegis)}
.lbp-best-v{font-size:clamp(1.45rem,1.2rem + .8vw,1.8rem);line-height:1.1;font-weight:700;color:var(--aegis-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lbp-meta{font-size:var(--fs-xs);color:var(--text-3)}
.lbp-spark-box{flex:1 1 180px;display:flex;flex-direction:column;justify-content:center;gap:2px;min-width:0}
.lbp-spark{display:block;width:100%;height:auto;max-height:84px;overflow:visible}
.lbp-spark-line{fill:none;stroke:var(--lbc);stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}
.lbp-spark-area{fill:color-mix(in srgb,var(--lbc) 15%,transparent);stroke:none}
.lbp-spark-best-line{stroke:color-mix(in srgb,var(--aegis) 55%,transparent);stroke-width:1;stroke-dasharray:3 4;vector-effect:non-scaling-stroke}
.lbp-spark-dot{fill:var(--bg-2);stroke:var(--lbc);stroke-width:1.5}
.lbp-spark-last{fill:var(--text);stroke:var(--bg-2);stroke-width:1.5}
.lbp-spark-best{fill:var(--aegis);stroke:var(--bg-2);stroke-width:2}
.lbp-spark-cap{font-size:10px;letter-spacing:.06em;color:var(--text-3);text-align:right}
.lbp-spark-solo{text-align:left;font-size:var(--fs-xs);letter-spacing:0;line-height:1.4}
.lbp-empty{display:flex;align-items:center;gap:12px;padding:12px 14px;font-size:var(--fs-sm);color:var(--text-2);background:color-mix(in srgb,var(--bg) 55%,transparent);border:1px dashed var(--line-2)}
.lbp-empty strong{color:var(--text)}
.lbp-empty-ico{flex:none;display:grid;place-items:center;width:40px;height:40px;color:var(--text-3);border:1px solid var(--line-2);background:var(--bg-3)}
.lbp-sub{display:flex;justify-content:space-between;gap:8px;margin-top:2px;font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--text-3)}
.lbp-sub-r{font-weight:600;letter-spacing:.08em}
.lbp-list{container:lbpl/inline-size;list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
@container lbpl (max-width:380px){.lbp-tag{padding:2px 5px}.lbp-tag-t{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}}
.lbp-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:10px;min-height:36px;padding:6px 10px;font-size:var(--fs-sm);background:rgba(255,255,255,.02);border-left:2px solid transparent}
.lbp-n{min-width:3ch;font-size:var(--fs-xs);color:var(--text-3)}
.lbp-when{color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lbp-s{font-weight:700;color:var(--text);white-space:nowrap;text-align:right}
.lbp-tag{position:relative;display:inline-flex;align-items:center;gap:4px;padding:1px 7px;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--on-aegis);background:var(--grad-aegis);clip-path:var(--clip-sm);white-space:nowrap}
.lbp-row.is-best{background:linear-gradient(90deg,color-mix(in srgb,var(--aegis) 16%,transparent),rgba(255,255,255,.02) 70%);border-left-color:var(--aegis)}
.lbp-row.is-best .lbp-s{color:var(--aegis-2)}
.lbp-row.is-fresh{animation:lbp-fresh 1.6s var(--ease-out)}
.lbp-gap{padding:0 10px;font-size:var(--fs-xs);line-height:1;color:var(--text-3);letter-spacing:.3em}
.lbp-more{align-self:flex-start}
.lbp-note{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;margin:0;font-size:var(--fs-xs);color:var(--text-3)}
.lbp-note>svg{flex:none}
.lbp-note a{display:inline-flex;align-items:center;gap:3px;font-weight:700;color:var(--aegis)}
.lbp.is-bump .lbp-best-v{animation:lbp-bump .6s var(--ease-out)}
@keyframes lbp-fresh{0%{background:color-mix(in srgb,var(--lbc) 30%,transparent)}100%{background:rgba(255,255,255,.02)}}
@keyframes lbp-bump{0%{transform:scale(1)}35%{transform:scale(1.06)}100%{transform:scale(1)}}
@media (pointer:coarse){.lbp-more{min-height:44px}.lbp-note a{min-height:32px}}
@media (prefers-reduced-motion:reduce){.lbp-row.is-fresh,.lbp.is-bump .lbp-best-v{animation:none}}`;
  const tag = document.createElement('style');
  tag.dataset.leaderboard = '';
  tag.textContent = css;
  (document.head || document.documentElement).appendChild(tag);
}
