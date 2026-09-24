// Sanat Galerisi: fal.ai görselleri gruplu, asimetrik ızgarada; lightbox (← →), beğeni, yorumlar.
// mountArt(el, ctx) → temizlik fonksiyonu.

import { h, clear, fmtNum } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { mountComments } from '../../components/comments.js';
import { GROUPS, IMAGE_KEYS, MODEL_KEYS, galleryItems, fontsReady, metaFor } from './catalog.js';
import { EXHIBITS } from './exhibits.js';
import { likeTracker } from './likes.js';

export function mountArt(el, ctx, { onHow } = {}) {
  const { sound, fx } = ctx;
  let destroyed = false;
  let items = [];
  let procedural = false;
  const cards = new Map(); // key → { count, btn }
  let lb = null; // açık lightbox durumu
  let destroyComments = null;

  const likes = likeTracker(() => refreshLikes());

  const body = h('div', { class: 'gl-art-body' }, h('div', { class: 'gl-art-loading' }, h('span', { class: 'spinner' })));
  const topList = h('ol', { class: 'gl-top-list' });
  const commentsHost = h('div', { class: 'panel gl-comments' });
  const root = h('div', { class: 'gl-art' },
    body,
    h('div', { class: 'gl-art-foot' },
      commentsHost,
      h('aside', { class: 'panel raised gl-top' },
        h('div', { class: 'gl-top-head' }, h('span', { class: 'eyebrow' }, 'Skor tablosu'), h('h3', { class: 'h3' }, 'En çok beğenilen eserler')),
        topList,
        h('p', { class: 'xsmall dim' }, 'Görsellerde ve müze eserlerinde verilen beğeniler toplanır.'),
      ),
    ),
  );
  el.appendChild(root);
  destroyComments = mountComments(commentsHost, { threadId: 'gallery', title: 'Galeri yorumları', compact: true, placeholder: 'Hangi eser DOG’u hak ediyor? Yaz…' });

  // Prosedürel yedekler canvas'a yazı yazdığı için yazı tiplerini kısa bir süre bekle
  const first = galleryItems();
  if (first.procedural) fontsReady().then(() => { if (!destroyed) render(galleryItems()); });
  else render(first);

  // ---------------------------------------------------------------- çizim
  function render(data) {
    procedural = data.procedural;
    // portrelerde efsaneyi başa al (büyük kart)
    const byGroup = new Map(GROUPS.map((g) => [g.id, []]));
    for (const it of data.items) (byGroup.get(it.group) || byGroup.get('diger')).push(it);
    const portraits = byGroup.get('portre');
    portraits.sort((a, b) => (b.feature ? 1 : 0) - (a.feature ? 1 : 0));
    items = GROUPS.flatMap((g) => byGroup.get(g.id));
    cards.clear();
    clear(body);

    if (procedural) body.appendChild(infoCard());

    let idx = 0;
    for (const g of GROUPS) {
      const list = byGroup.get(g.id);
      if (!list.length) continue;
      const grid = h('div', { class: `gl-grid gl-grid-${g.id}` });
      if (g.id === 'afis') {
        let p = 0;
        for (const it of list) {
          const cls = it.key === 'hero-keyart' ? 'is-keyart' : list.filter((x) => x.key !== 'hero-keyart').length === 1 ? 'is-poster span-12' : p++ === 0 ? 'is-poster span-7' : p === 2 ? 'is-poster span-5 is-offset' : 'is-poster span-6';
          grid.appendChild(card(it, idx++, cls));
        }
      } else if (g.id === 'portre') {
        list.forEach((it, i) => {
          grid.appendChild(card(it, idx++, it.feature ? 'is-feature' : ''));
          if (i === 0) grid.appendChild(noteCard(1, list.length));
        });
        grid.appendChild(noteCard(2, list.length));
      } else if (g.id === 'doku') {
        for (const it of list) {
          grid.appendChild(card(it, idx++, 'is-texture'));
          grid.appendChild(h('div', { class: 'gl-texnote panel' },
            h('span', { class: 'eyebrow' }, 'Neden döşenebilir?'),
            h('p', { class: 'h3' }, 'Kenarlar dikişsiz birleşiyor.'),
            h('p', { class: 'muted small' }, 'Soldaki kart aynı görseli 3×3 yan yana diziyor; ek yeri aramaya çalış. Arena zemini ve müze salonunun döşemesi bu tek kareyi tekrar ederek kaplanıyor.'),
            h('div', { class: 'row' }, h('span', { class: 'badge gold' }, it.model), h('span', { class: 'badge' }, it.spec)),
          ));
        }
      } else {
        for (const it of list) grid.appendChild(card(it, idx++, ''));
      }
      body.appendChild(
        h('section', { class: 'gl-group', 'aria-labelledby': `gl-g-${g.id}` },
          h('header', { class: 'gl-group-head' },
            h('span', { class: 'gl-group-no num', 'aria-hidden': 'true' }, String(list.length).padStart(2, '0')),
            h('div', null, h('span', { class: 'eyebrow' }, g.lore), h('h2', { class: 'h2', id: `gl-g-${g.id}` }, g.label)),
            h('span', { class: 'gl-group-rule', 'aria-hidden': 'true' }),
          ),
          grid,
        ),
      );
    }
    refreshLikes();
  }

  function infoCard() {
    return h('div', { class: 'gl-info panel frame' },
      h('span', { class: 'gl-info-icon', 'aria-hidden': 'true' }, icon('sparkle', { size: 28 })),
      h('div', { class: 'stack' },
        h('span', { class: 'eyebrow' }, 'Duvarlar hazırlanıyor'),
        h('h2', { class: 'h2' }, 'fal.ai görselleri yakında yüklenecek'),
        h('p', { class: 'muted' },
          'Bu salon, yapım aşamasında fal.ai ile üretilen afişleri, 11 DOG portresini ve arena dokusunu bekliyor. Dosyalar siteye eklendiğinde burada kendiliğinden belirecekler; o zamana kadar nöbeti prosedürel armalar ve yer tutucu afişler tutuyor.'),
        h('div', { class: 'row' },
          h('span', { class: 'chip', role: 'note' }, icon('gallery', { size: 14 }), `${IMAGE_KEYS.length} görsel sırada`),
          h('span', { class: 'chip', role: 'note' }, icon('cube', { size: 14 }), `${MODEL_KEYS.length} 3D model sırada`),
          onHow ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => onHow() }, 'Nasıl yapıldı?', icon('arrowRight', { size: 16 })) : null,
        ),
      ),
    );
  }

  function noteCard(n, count) {
    if (n === 1) {
      return h('div', { class: 'gl-note panel raised' },
        h('span', { class: 'eyebrow' }, 'Arşiv notu'),
        h('span', { class: 'gl-note-big num' }, String(count)),
        h('p', { class: 'small muted' },
          procedural
            ? 'On DOG türü ve bir 1vDOQUZ efsanesi. fal.ai portreleri gelene kadar her türü kendi renginde bir arma temsil ediyor.'
            : 'On DOG türü ve bir 1vDOQUZ efsanesi. Hepsi fal.ai Nano Banana 2 ile aynı Dire gecesi paletinde çizildi.'),
      );
    }
    return h('div', { class: 'gl-note gl-note-2 panel' },
      h('span', { class: 'eyebrow' }, 'Tanıdık geldi mi?'),
      h('p', { class: 'small muted' }, 'Her türün DOG-metresi, doğal yaşam alanı ve karşı taktiği analiz bölümünde.'),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => ctx.go('karakterler') }, 'Analizlere git', icon('arrowRight', { size: 16 })),
    );
  }

  function card(it, idx, cls) {
    const count = h('span', { class: 'num' }, '');
    const likeBadge = h('span', { class: 'gl-card-likes', 'aria-hidden': 'true' }, icon('heart', { size: 13 }), count);
    const media = it.group === 'doku'
      ? h('span', { class: 'gl-card-media gl-tiled', style: { backgroundImage: `url("${it.url}")` } })
      : h('span', { class: 'gl-card-media' }, h('img', { src: it.url, alt: '', loading: 'lazy', decoding: 'async' }));
    const btn = h('button', {
      class: `gl-card ${cls}`,
      type: 'button',
      style: { '--ratio': it.ratio, ...(it.arch ? { '--arch': it.arch.color } : {}) },
      'aria-label': `${it.title}, ${it.kicker}. Büyüt`,
      dataset: { key: it.key, procedural: it.procedural ? '1' : '0' },
    },
      media,
      h('span', { class: 'gl-card-cap' },
        h('span', { class: 'gl-card-kicker' }, it.kicker),
        h('span', { class: 'gl-card-title' }, it.title),
        it.key === 'hero-keyart' ? h('span', { class: 'gl-card-desc' }, it.desc) : null,
      ),
      likeBadge,
      it.procedural ? h('span', { class: 'gl-card-flag' }, 'yer tutucu') : null,
    );
    btn.addEventListener('click', () => { sound.click(); openLightbox(idx); });
    cards.set(it.key, { count, badge: likeBadge });
    return btn;
  }

  // ---------------------------------------------------------------- beğeniler
  function refreshLikes() {
    for (const [key, c] of cards) {
      const n = likes.count(key);
      c.count.textContent = n ? fmtNum(n) : '';
      c.badge.classList.toggle('on', likes.liked(key));
      c.badge.classList.toggle('has', n > 0);
    }
    if (lb) lb.paintLike();
    renderTop();
  }

  function renderTop() {
    const pool = [
      ...items.map((it) => ({ key: it.key, title: it.title, kind: it.kicker })),
      ...EXHIBITS.map((ex) => ({ key: ex.key, title: ex.name, kind: '3D eser' })),
    ];
    const seen = new Set();
    const ranked = pool
      .filter((p) => (seen.has(p.key) ? false : seen.add(p.key)))
      .map((p) => ({ ...p, n: likes.count(p.key) }))
      .filter((p) => p.n > 0)
      .sort((a, b) => b.n - a.n || (a.title < b.title ? -1 : 1))
      .slice(0, 5);
    clear(topList);
    if (!ranked.length) {
      topList.appendChild(h('li', { class: 'gl-top-empty small dim' }, 'Henüz beğeni yok. Bir esere tıkla ve ilk kalbi sen bırak.'));
      return;
    }
    ranked.forEach((p, i) => {
      topList.appendChild(h('li', { class: 'gl-top-row' },
        h('span', { class: `gl-top-rank num${i === 0 ? ' top' : ''}` }, String(i + 1)),
        h('span', { class: 'gl-top-name' }, h('strong', null, p.title), h('span', { class: 'xsmall dim' }, p.kind)),
        h('span', { class: 'gl-top-n num' }, icon('heart', { size: 13 }), fmtNum(p.n)),
      ));
    });
  }

  // ---------------------------------------------------------------- lightbox
  function openLightbox(start) {
    if (!items.length) return;
    let idx = start;
    const img = h('img', { class: 'gl-lb-img', alt: '', decoding: 'async' });
    const kicker = h('span', { class: 'eyebrow' });
    const counter = h('span', { class: 'num small dim gl-lb-counter', 'aria-live': 'polite' });
    const title = h('h2', { class: 'h2 gl-lb-title', id: 'gl-lb-title' });
    const desc = h('p', { class: 'muted gl-lb-desc' });
    const meta = h('div', { class: 'row gl-lb-meta' });
    const likeN = h('span', { class: 'num' }, '0');
    const likeBtn = h('button', { class: 'btn ghost sm gl-like', type: 'button', 'aria-pressed': 'false' }, icon('heart', { size: 16 }), h('span', null, 'Beğen'), likeN);
    const closeBtn = h('button', { class: 'btn ghost sm icon', type: 'button', 'aria-label': 'Kapat' }, icon('close', { size: 18 }));
    const prev = h('button', { class: 'gl-lb-nav prev', type: 'button', 'aria-label': 'Önceki görsel (sol ok)' }, icon('arrowLeft', { size: 22 }));
    const next = h('button', { class: 'gl-lb-nav next', type: 'button', 'aria-label': 'Sonraki görsel (sağ ok)' }, icon('arrowRight', { size: 22 }));
    const figure = h('figure', { class: 'gl-lb-figure' }, img, prev, next);
    const node = h('div', { class: 'gl-lb', 'aria-labelledby': 'gl-lb-title' },
      h('div', { class: 'gl-lb-top' }, kicker, h('span', { class: 'spacer' }), counter, closeBtn),
      figure,
      h('div', { class: 'gl-lb-info' },
        h('div', { class: 'stack gl-lb-text' }, title, desc, meta),
        h('div', { class: 'gl-lb-actions' }, likeBtn, h('span', { class: 'xsmall dim' }, h('span', { class: 'kbd' }, '←'), ' ', h('span', { class: 'kbd' }, '→'), ' gez · ', h('span', { class: 'kbd' }, 'Esc'), ' kapat')),
      ),
    );

    const show = (n) => {
      idx = (n + items.length) % items.length;
      const it = items[idx];
      node.classList.remove('is-in');
      void node.offsetWidth;
      node.classList.add('is-in');
      img.src = it.url;
      img.alt = `${it.title} — ${it.kicker}`;
      img.style.aspectRatio = it.ratio;
      kicker.textContent = (GROUPS.find((g) => g.id === it.group) || GROUPS[4]).label;
      counter.textContent = `${idx + 1} / ${items.length}`;
      title.textContent = it.title;
      desc.textContent = it.desc;
      clear(meta);
      meta.append(
        it.procedural ? h('span', { class: 'badge ember' }, 'prosedürel yer tutucu') : h('span', { class: 'badge gold' }, 'fal.ai · ' + it.model),
        it.spec ? h('span', { class: 'badge' }, it.spec) : null,
        it.arch ? h('span', { class: 'badge', style: { color: 'var(--arch)', '--arch': it.arch.color } }, `DOG seviyesi ${it.arch.dogLevel}/5`) : null,
        h('span', { class: 'mono xsmall dim' }, it.key),
      );
      paintLike();
      // komşuları önceden yükle
      for (const d of [-1, 1]) { const nb = items[(idx + d + items.length) % items.length]; if (nb) { const pre = new Image(); pre.src = nb.url; } }
    };
    const paintLike = () => {
      const key = items[idx].key;
      const on = likes.liked(key);
      likeBtn.setAttribute('aria-pressed', String(on));
      likeBtn.classList.toggle('on', on);
      likeN.textContent = fmtNum(likes.count(key));
    };

    const onKey = (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); sound.tick(); show(idx - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); sound.tick(); show(idx + 1); }
    };
    let downX = null;
    figure.addEventListener('pointerdown', (e) => { if (e.target === figure || e.target === img) downX = e.clientX; });
    figure.addEventListener('pointerup', (e) => {
      if (downX == null) return;
      const dx = e.clientX - downX;
      downX = null;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
    });
    prev.addEventListener('click', () => { sound.tick(); show(idx - 1); });
    next.addEventListener('click', () => { sound.tick(); show(idx + 1); });
    likeBtn.addEventListener('click', () => {
      const it = items[idx];
      const on = likes.toggle(it.key);
      if (on) {
        sound.bark(1.25);
        const r = likeBtn.getBoundingClientRect();
        fx.floatText('DOG!', r.left + r.width / 2, r.top, { color: '#e9b949', size: 18 });
      } else sound.click();
      refreshLikes();
    });

    document.addEventListener('keydown', onKey);
    const close = fx.modal(node, {
      label: 'Görsel görüntüleyici',
      onClose: () => { document.removeEventListener('keydown', onKey); lb = null; },
    });
    if (node.parentElement) node.parentElement.classList.add('gl-lb-modal');
    closeBtn.addEventListener('click', () => close());
    lb = { close, paintLike };
    show(idx);
  }

  return () => {
    destroyed = true;
    if (lb) lb.close();
    likes.destroy();
    if (destroyComments) destroyComments();
    root.remove();
  };
}

export { metaFor };
