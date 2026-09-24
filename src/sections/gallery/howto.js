// "Nasıl yapıldı?": fal.ai üretim hattının kısa, görsel anlatımı + varlık envanteri.
// mountHowto(el, ctx, { onMuseum, onArt }) → temizlik fonksiyonu.

import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { ALL_TYPES } from '../../data/archetypes.js';
import { proceduralPortrait } from '../../components/portrait.js';
import { IMAGE_KEYS, MODEL_KEYS, metaFor, proceduralPoster } from './catalog.js';
import { EXHIBITS } from './exhibits.js';
import { art, modelAvailable } from './sources.js';

const EP_PRO = 'fal-ai/nano-banana-pro';
const EP_NB2 = 'fal-ai/nano-banana-2';
const EP_TRELLIS = 'fal-ai/trellis-2';

function endpointFor(key) {
  if (key === 'hero-keyart' || key.startsWith('poster-')) return EP_PRO;
  if (key.startsWith('model-')) return EP_TRELLIS;
  return EP_NB2;
}

function outputFor(key) {
  if (key === 'hero-keyart') return '21:9 · 2K';
  if (key.startsWith('poster-')) return '16:9 · 2K';
  if (key.startsWith('portrait-')) return '1:1 · 1K';
  if (key.startsWith('texture-')) return '1:1 · döşenebilir';
  return 'GLB · doku 1024';
}

function thumb(key, fallback, cls = '') {
  const url = art(key);
  return h('img', {
    class: `gl-thumb ${cls}`,
    src: url || fallback(),
    alt: `${metaFor(key).title} önizlemesi${url ? '' : ' (prosedürel yedek)'}`,
    loading: 'lazy',
    decoding: 'async',
  });
}

export function mountHowto(el, ctx, { onMuseum, onArt } = {}) {
  const posterFallback = (kind) => () => proceduralPoster(kind);
  const archFallback = (a) => () => proceduralPortrait(a, 256);

  const palette = [
    ['--bg', 'Obsidyen'], ['--ember', 'Kor'], ['--aegis', 'Aegis altını'], ['--radiant', 'Radiant yeşimi'], ['--dire', 'Dire kanı'], ['--arcane', 'Arcane'],
  ];

  const previews = {
    palette: h('div', { class: 'gl-pv gl-pv-palette' },
      h('div', { class: 'gl-swatches' }, palette.map(([v, n]) => h('span', { class: 'gl-sw', style: { '--sw': `var(${v})` } }, h('span', { class: 'gl-sw-chip', 'aria-hidden': 'true' }), h('span', { class: 'xsmall' }, n)))),
      h('div', { class: 'gl-prompt' },
        h('span', { class: 'gl-prompt-label xsmall' }, 'İstem iskeleti'),
        h('code', null, '[konu] + [DOG türü ve tavrı] + "Dire gecesi" paleti + kor kenar ışığı + [kompozisyon, en-boy]'),
      ),
    ),
    posters: h('div', { class: 'gl-pv gl-pv-posters' },
      thumb('hero-keyart', posterFallback('dog'), 'is-wide'),
      h('div', { class: 'gl-pv-pair' }, thumb('poster-dogdogdog', posterFallback('dog')), thumb('poster-1vdoquz', posterFallback('1v9'))),
    ),
    portraits: h('div', { class: 'gl-pv gl-pv-portraits' },
      h('div', { class: 'gl-pv-strip' }, ALL_TYPES.filter((a) => ['legend', 'feed', 'farm', 'pause', 'chat'].includes(a.id)).map((a) => thumb('portrait-' + a.id, archFallback(a)))),
      h('div', { class: 'gl-pv-tex', style: art('texture-arena') ? { backgroundImage: `url("${art('texture-arena')}")` } : null, role: 'img', 'aria-label': 'Arena zemini dokusu, 3×3 döşenmiş' }),
    ),
    models: h('div', { class: 'gl-pv gl-pv-models' },
      EXHIBITS.map((ex) => {
        const ok = modelAvailable(ex.key);
        return h('div', { class: 'gl-model-tile' },
          h('span', { class: 'gl-model-ico', 'aria-hidden': 'true' }, icon(ex.icon, { size: 22 })),
          h('span', { class: 'gl-model-name' }, ex.name),
          h('span', { class: 'mono xsmall dim' }, ex.key + '.glb'),
          h('span', { class: `badge ${ok ? 'jade' : ''}` }, ok ? 'GLB hazır' : 'bekleniyor'),
        );
      }),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => onMuseum && onMuseum() }, icon('cube', { size: 16 }), 'Müzede incele'),
    ),
    links: h('div', { class: 'gl-pv gl-pv-links' },
      h('div', { class: 'gl-pack' },
        h('div', null, h('span', { class: 'gl-pack-k xsmall' }, 'Görseller'), h('span', { class: 'gl-pack-v' }, 'sharp → WebP'), h('span', { class: 'xsmall dim' }, 'portre başına ~80 KB')),
        h('div', null, h('span', { class: 'gl-pack-k xsmall' }, '3D modeller'), h('span', { class: 'gl-pack-v' }, 'glTF-Transform → meshopt'), h('span', { class: 'xsmall dim' }, '1,4 MB → ~550 KB')),
      ),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary sm', type: 'button', onclick: () => onMuseum && onMuseum() }, icon('cube', { size: 16 }), '3D Müze'),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => ctx.go('oyunlar', 'arena') }, icon('bow', { size: 16 }), '1vDOQUZ Arena'),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => onArt && onArt() }, icon('gallery', { size: 16 }), 'Sanat galerisi'),
      ),
    ),
  };

  const STEPS = [
    {
      title: 'Konsept ve istemler',
      tool: 'Kalem, kâğıt, bol DOG',
      text: 'Önce dünya yazıldı: on DOG türü, bir 1vDOQUZ efsanesi ve tek bir renk paleti, “Dire gecesi”. Obsidyen mor zemin, kor turuncusu, Aegis altını ve Radiant yeşimi. Her istem bu palete ve sitenin mizahına göre kuruldu; böylece farklı modellerden çıkan görseller aynı salona yakışıyor.',
      chips: ['10 DOG türü + 1 efsane', 'Tek palet'],
      preview: 'palette',
    },
    {
      title: 'Afişler ve kahraman sanatı',
      tool: 'fal.ai · Nano Banana Pro',
      text: 'Ana sayfa afişi 21:9 ve 2K çözünürlükte, sol üçte biri başlık için boş bırakılmış karanlık bir gökyüzüyle üretildi. Üzerinde “DOG DOG DOG” ve “1vDOQUZ” yazan iki poster ise 16:9, 2K.',
      chips: [EP_PRO, '21:9 · 16:9 · 2K'],
      preview: 'posters',
    },
    {
      title: 'Portreler, doku ve 3D referansları',
      tool: 'fal.ai · Nano Banana 2',
      text: '11 DOG portresi (1:1, 1K), kenarları dikişsiz birleşen arena zemini ve 3D modellere kaynak olacak üç referans görsel: DOG maskotu, okçu kahraman, Aegis kupası. Referans görseller siteye konmadı; yalnızca bir sonraki adımın girdisiydi.',
      chips: [EP_NB2, '1:1 · 1K'],
      preview: 'portraits',
    },
    {
      title: 'Görselden 3D',
      tool: 'fal.ai · Trellis 2',
      text: 'Her referans görsel Trellis 2 ile dokulu bir GLB modele dönüştü: çözünürlük 1024, doku 1024, yaklaşık 30 bin köşeye indirgeme ve yeniden ağ örme (remesh). Web için hafif, müze kaidesi için yeterince detaylı.',
      chips: [EP_TRELLIS, 'GLB · ~30k köşe · 1024 doku'],
      preview: 'models',
    },
    {
      title: 'Sıkıştır ve siteye yerleştir',
      tool: 'sharp · glTF-Transform · three.js',
      text: 'Görseller sharp ile WebP’ye, modeller glTF-Transform ile meshopt sıkıştırmasına geçti. Sonra hepsi sitenin paketine girdi: three.js sahneleri, 1vDOQUZ Arena oyunu ve bu müze. Bir dosya eksik kalırsa bileşen prosedürel bir yedeğe geçiyor; duvarlar hiçbir zaman boş kalmıyor.',
      chips: ['WebP', 'meshopt', 'three.js'],
      preview: 'links',
    },
  ];

  const inventory = [...IMAGE_KEYS, ...MODEL_KEYS].map((key) => {
    const ready = key.startsWith('model-') ? modelAvailable(key) : !!art(key);
    const m = key.startsWith('model-') ? null : metaFor(key);
    const ex = EXHIBITS.find((e) => e.key === key);
    return h('tr', null,
      h('td', null, h('span', { class: 'mono xsmall' }, key), h('span', { class: 'gl-inv-title xsmall dim' }, m ? m.title : ex ? ex.name : '')),
      h('td', { class: 'mono xsmall' }, endpointFor(key)),
      h('td', { class: 'xsmall' }, outputFor(key)),
      h('td', null, h('span', { class: `badge ${ready ? 'jade' : ''}` }, ready ? 'hazır' : 'bekleniyor')),
    );
  });
  const readyCount = [...IMAGE_KEYS].filter((k) => art(k)).length + MODEL_KEYS.filter((k) => modelAvailable(k)).length;
  const total = IMAGE_KEYS.length + MODEL_KEYS.length;

  const root = h('div', { class: 'gl-how' },
    h('div', { class: 'gl-callout panel frame', role: 'note' },
      h('span', { class: 'gl-callout-icon', 'aria-hidden': 'true' }, icon('info', { size: 26 })),
      h('div', { class: 'stack' },
        h('span', { class: 'eyebrow' }, 'Önce en önemli not'),
        h('p', { class: 'h3' }, 'fal.ai bu sitenin çalışma zamanında kullanılmıyor.'),
        h('p', { class: 'muted' },
          'Sen sayfada gezinirken hiçbir görsel ya da model üretilmiyor ve fal.ai’ye tek bir istek bile gitmiyor. fal.ai yalnızca yapım aşamasında, varlıkları bir kez üretmek için kullanıldı; ortaya çıkan dosyalar sitenin kendi paketinde taşınıyor.'),
      ),
    ),
    h('ol', { class: 'gl-steps' },
      STEPS.map((s, i) => h('li', { class: 'gl-step' },
        h('span', { class: 'gl-step-no num', 'aria-hidden': 'true' }, String(i + 1)),
        h('div', { class: 'gl-step-body' },
          h('span', { class: 'eyebrow' }, s.tool),
          h('h3', { class: 'h2 gl-step-title' }, h('span', { class: 'sr-only' }, `Adım ${i + 1}: `), s.title),
          h('p', { class: 'muted' }, s.text),
          h('div', { class: 'row gl-step-chips' }, s.chips.map((c) => h('span', { class: 'badge' }, c))),
        ),
        h('div', { class: 'gl-step-pv' }, previews[s.preview]),
      )),
    ),
    h('section', { class: 'gl-inv panel', 'aria-labelledby': 'gl-inv-h' },
      h('div', { class: 'panel-head' },
        h('div', null, h('span', { class: 'eyebrow' }, 'Envanter'), h('h2', { class: 'h2', id: 'gl-inv-h' }, 'Varlık listesi')),
        h('span', { class: `badge ${readyCount === total ? 'jade' : 'gold'}` }, `${readyCount} / ${total} hazır`),
      ),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table gl-inv-table' },
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Anahtar'), h('th', { scope: 'col' }, 'fal.ai uç noktası'), h('th', { scope: 'col' }, 'Çıktı'), h('th', { scope: 'col' }, 'Durum'))),
          h('tbody', null, inventory),
        ),
      ),
    ),
  );
  el.appendChild(root);
  return () => root.remove();
}
