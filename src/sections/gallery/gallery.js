// Galeri & 3D Müze (#galeri): sitenin fal.ai ile üretilmiş görsel ve 3D varlıklarının vitrini.
// Alt sayfalar: #galeri--muze (varsayılan), #galeri--sanat, #galeri--nasil

import './gallery.css';
import { h, clear } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { IMAGE_KEYS, MODEL_KEYS } from './catalog.js';
import { art, arts, modelAvailable } from './sources.js';

const SUBS = [
  { id: 'muze', label: '3D Müze', icon: 'cube' },
  { id: 'sanat', label: 'Sanat Galerisi', icon: 'gallery' },
  { id: 'nasil', label: 'Nasıl yapıldı?', icon: 'sparkle' },
];
const DEFAULT_SUB = 'muze';
const valid = (s) => (SUBS.some((x) => x.id === s) ? s : DEFAULT_SUB);

let active = null;

export default {
  mount(el, ctx) {
    let current = null;
    let cleanup = null;
    let token = 0;
    let dead = false;

    const imgCount = arts().length;
    const modelCount = MODEL_KEYS.filter((k) => modelAvailable(k)).length;
    const imgReady = IMAGE_KEYS.filter((k) => art(k)).length;

    const tabs = SUBS.map((s) => {
      const b = h('button', {
        class: 'tab gl-tab',
        type: 'button',
        role: 'tab',
        id: `gl-tab-${s.id}`,
        'aria-controls': 'gl-panel',
        'aria-selected': 'false',
        tabindex: '-1',
        dataset: { sub: s.id },
      }, icon(s.icon, { size: 18 }), h('span', null, s.label));
      b.addEventListener('click', () => {
        if (current === s.id) return;
        ctx.sound.click();
        ctx.setSub(s.id);
        show(s.id);
      });
      return b;
    });
    const tablist = h('div', { class: 'tabs gl-tabs', role: 'tablist', 'aria-label': 'Galeri bölümleri' }, tabs);
    tablist.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(document.activeElement);
      if (i === -1) return;
      let n = null;
      if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = tabs.length - 1;
      if (n == null) return;
      e.preventDefault();
      tabs[n].focus();
      tabs[n].click();
    });

    const panel = h('div', { class: 'gl-panel', id: 'gl-panel', role: 'tabpanel', tabindex: '-1' });

    const ledger = h('dl', { class: 'gl-ledger', 'aria-label': 'Koleksiyon özeti' },
      h('div', null, h('dt', null, 'Görsel'), h('dd', { class: 'num' }, imgCount ? String(imgCount) : `0/${IMAGE_KEYS.length}`)),
      h('div', null, h('dt', null, '3D model'), h('dd', { class: 'num' }, `${modelCount}/${MODEL_KEYS.length}`)),
      h('div', { class: 'is-zero' }, h('dt', null, 'Canlı ', h('span', { lang: 'en' }, 'fal.ai'), ' çağrısı'), h('dd', { class: 'num' }, '0')),
    );

    const root = h('div', { class: 'wrap gl' },
      h('header', { class: 'gl-head' },
        h('div', { class: 'section-head' },
          // "fal.ai" marka adı: Türkçe büyük harf kuralı "FAL.Aİ" yapmasın
          h('span', { class: 'eyebrow' }, 'Salon T · ', h('span', { lang: 'en' }, 'fal.ai'), ' koleksiyonu'),
          h('h1', { class: 'h1' }, 'Galeri & ', h('em', null, '3D Müze')),
          h('p', { class: 'lead' },
            imgReady || modelCount
              ? 'Sitenin afişleri, DOG portreleri ve 3D eserleri yapım aşamasında fal.ai ile üretildi. Hepsi bu salonda: döndür, yakınlaştır, beğen, DOG’la.'
              : 'Sitenin afişleri, DOG portreleri ve 3D eserleri yapım aşamasında fal.ai ile üretildi. Dosyalar yerine oturana kadar salonu prosedürel kopyalar bekliyor.'),
        ),
        ledger,
      ),
      tablist,
      panel,
    );
    el.appendChild(root);

    async function show(sub) {
      sub = valid(sub);
      if (sub === current) return;
      current = sub;
      const my = ++token;
      tabs.forEach((t) => {
        const on = t.dataset.sub === sub;
        t.setAttribute('aria-selected', String(on));
        t.setAttribute('tabindex', on ? '0' : '-1');
      });
      panel.setAttribute('aria-labelledby', `gl-tab-${sub}`);
      if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
      clear(panel);
      panel.dataset.sub = sub;
      const host = h('div', { class: `gl-sub gl-sub-${sub}` });
      panel.appendChild(host);
      const goSub = (s) => { ctx.setSub(s); show(s); };
      try {
        if (sub === 'muze') {
          host.appendChild(h('div', { class: 'gl-sub-loading' }, h('span', { class: 'spinner' }), h('span', { class: 'small dim' }, 'Salon ışıkları açılıyor…')));
          const { mountMuseum } = await import('./museum3d.js');
          if (dead || my !== token) return;
          clear(host);
          cleanup = mountMuseum(host, ctx);
        } else if (sub === 'sanat') {
          const { mountArt } = await import('./art.js');
          if (dead || my !== token) return;
          cleanup = mountArt(host, ctx, { onHow: () => goSub('nasil') });
        } else {
          const { mountHowto } = await import('./howto.js');
          if (dead || my !== token) return;
          cleanup = mountHowto(host, ctx, { onMuseum: () => goSub('muze'), onArt: () => goSub('sanat') });
        }
      } catch (e) {
        console.error(e);
        if (dead || my !== token) return;
        clear(host);
        host.appendChild(h('div', { class: 'empty' }, 'Bu salon açılamadı. Başka bir sekmeye geçip geri dönmeyi dene.'));
      }
    }

    active = { show };
    show(ctx.sub);

    return () => {
      dead = true;
      token++;
      if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } }
      cleanup = null;
      if (active && active.show === show) active = null;
      root.remove();
    };
  },

  onSub(sub) {
    if (active) active.show(sub);
  },
};
