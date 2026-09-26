// fal.ai görsel kataloğu: anahtar → başlık, grup, açıklama, üretim modeli.
// Görseller yoksa prosedürel yedekler (armalar + afiş yer tutucuları) üretir.

import { ALL_TYPES, byId } from '../../data/archetypes.js';
import { proceduralPortrait } from '../../components/portrait.js';
import { arts } from './sources.js';
import { EXHIBITS } from './exhibit-data.js';

export const GROUPS = [
  { id: 'afis', label: 'Afişler', lore: 'Salon duvarı' },
  { id: 'portre', label: 'DOG Portreleri', lore: 'Arşiv koridoru' },
  { id: 'hikaye', label: 'Arena Hikâyesi', lore: 'Dokuzun Laneti' },
  { id: 'doku', label: 'Dokular', lore: 'Zemin ustası' },
  { id: 'ref', label: '3D Referans Görselleri', lore: 'Atölye masası' },
  { id: 'diger', label: 'Diğer', lore: 'Depo' },
];

export const PRO = 'Nano Banana Pro';
export const NB2 = 'Nano Banana 2';

const STORY_KEYS = ['story-ch1', 'story-ch2', 'story-ch3', 'story-ch4', 'story-ch5', 'story-boss-feedalfa', 'story-boss-shadow', 'story-boss-general', 'story-boss-roshan', 'story-boss-ancient'];
/** Beklenen görsel anahtarları (sıra = galeri sırası). */
export const IMAGE_KEYS = ['hero-keyart', 'poster-dogdogdog', 'poster-1vdoquz', ...ALL_TYPES.map((a) => 'portrait-' + a.id), ...STORY_KEYS, 'texture-arena'];
/** 3D model anahtarları: müzedeki eser sırasıyla (exhibit-data.js tek kaynak). */
export const MODEL_KEYS = EXHIBITS.map((e) => e.key);

const FIXED = {
  'hero-keyart': {
    group: 'afis', title: 'Dire Gecesi', kicker: 'Ana afiş · 21:9', model: PRO, ratio: '21 / 9', spec: '21:9 · 2K',
    desc: 'Sitenin kapak sanatı. Sol üçte bir bilerek karanlık gökyüzü bırakıldı: başlık oraya otursun, sanat sağda nefes alsın.',
  },
  'poster-dogdogdog': {
    group: 'afis', title: 'DOG DOG DOG', kicker: 'Yazılı afiş · 16:9', model: PRO, ratio: '16 / 9', spec: '16:9 · 2K',
    desc: 'Biri kötü oynadığında ya da oyunu trollediğinde söylenen üç kelimelik özet; bu kez duvar boyu.',
  },
  'poster-1vdoquz': {
    group: 'afis', title: '1vDOQUZ', kicker: 'Yazılı afiş · 16:9', model: PRO, ratio: '16 / 9', spec: '16:9 · 2K',
    desc: 'Dört takım arkadaşı ve beş rakip: toplam dokuz. Q harfi süs değil, karakter meselesi.',
  },
  'texture-arena': {
    group: 'doku', title: 'Arena Zemini', kicker: 'Döşenebilir doku · 1:1', model: NB2, ratio: '1 / 1', spec: '1:1 · döşenebilir',
    desc: 'Kenarları birbirine dikişsiz bağlanan taş zemin. 1vDOQUZ Arena için üretildi; müzede kaidenin altındaki zemin de bu.',
  },
};

const chapter = (n, title, desc) => ({
  group: 'hikaye', title, kicker: `Bölüm ${n} afişi · 16:9`, model: NB2, ratio: '16 / 9', spec: '16:9 · 1K',
  desc: desc + ' Kurye portresi stil referansı olarak verildi; hepsi aynı fırçadan çıksın diye.',
});
const boss = (title, desc) => ({ group: 'hikaye', title, kicker: 'Boss portresi · 1:1', model: NB2, ratio: '1 / 1', spec: '1:1 · 1K', desc });
const STORY = {
  'story-ch1': chapter('I', 'Nehir Kıyısı', 'İlk DOG’lar nehirden çıkıyor, Kurye tepeden iksir taşıyor.'),
  'story-ch2': chapter('II', 'Wardsız Orman', 'Tek fener, yüzlerce mor göz. Ward alınmadıysa orman böyle görünür.'),
  'story-ch3': chapter('III', 'Kule Kuşatması', 'Radiant kulesi tepede, Dire ordusu yamaçta.'),
  'story-ch4': chapter('IV', 'Roshan’ın İni', 'Kaya Canavarı altın kalkanın üstünde uyuyor; köpekler kapıdan bakıyor.'),
  'story-ch5': chapter('V', '1vDOQUZ', 'Bir kahraman, dokuz DOG lordu ve Sonsuz Pub’ın kalbi.'),
  'story-boss-feedalfa': boss('Feed Alfa', 'I. bölümün bossu: sürünün en iri, en çok ölen ve bununla en çok övünen köpeği.'),
  'story-boss-shadow': boss('Gölge Ulusu', 'II. bölümün bossu: ward alınmayan her gece biraz daha büyüyen duman köpek.'),
  'story-boss-general': boss('Dire Generali', 'III. bölümün bossu: kuleye yürüyen ordunun zırhlı komutanı.'),
  'story-boss-roshan': boss('Kaya Canavarı', 'IV. bölümün bossu: çukurun sahibi, Aegis’in bekçisi.'),
  'story-boss-ancient': boss('Sonsuz Pub’ın Kalbi', 'Son boss: 24 saatlik yayınları da kısa bulan lanetin çekirdeği.'),
};

/** Anahtardan katalog bilgisi. */
export function metaFor(key) {
  if (FIXED[key]) return { key, ...FIXED[key] };
  if (STORY[key]) return { key, ...STORY[key] };
  if (key.startsWith('portrait-')) {
    const a = byId(key.slice(9));
    return {
      key,
      group: 'portre',
      title: a ? a.name : key,
      kicker: a ? a.title : 'Portre',
      desc: a ? a.tagline : 'DOG arşivinden bir portre.',
      model: NB2,
      ratio: '1 / 1',
      spec: '1:1 · 1K',
      arch: a,
      feature: a && a.id === 'legend',
    };
  }
  if (key.startsWith('poster-')) return { key, group: 'afis', title: key.slice(7).toUpperCase(), kicker: 'Afiş', desc: 'Salon duvarına asılan bir afiş.', model: PRO, ratio: '16 / 9', spec: '16:9' };
  if (key.startsWith('texture-')) return { key, group: 'doku', title: key.slice(8), kicker: 'Doku', desc: 'Döşenebilir bir doku.', model: NB2, ratio: '1 / 1', spec: '1:1' };
  if (key.startsWith('src3d-')) {
    const ex = EXHIBITS.find((e) => e.key === 'model-' + key.slice(6));
    const n = ex ? ex.name : key.slice(6);
    return { key, group: 'ref', title: n, kicker: 'Trellis 2 kaynağı', desc: `${n} için Trellis 2’ye verilen referans görsel. 3D model bu tek kareden çıktı.`, model: NB2, ratio: '1 / 1', spec: '1:1' };
  }
  return { key, group: 'diger', title: key, kicker: 'Görsel', desc: 'fal.ai ile üretilmiş bir görsel.', model: 'fal.ai', ratio: '1 / 1', spec: '' };
}

function orderIndex(key) {
  const i = IMAGE_KEYS.indexOf(key);
  return i === -1 ? 1000 : i;
}

/**
 * Galeri öğeleri: { procedural, items:[{ key, url, title, kicker, desc, model, group, ... }] }
 * Görsel yoksa prosedürel yedekler döner (procedural: true).
 */
export function galleryItems() {
  const list = arts();
  if (list.length) {
    const items = list
      .map(({ key, url }) => ({ ...metaFor(key), url, procedural: false }))
      .sort((a, b) => {
        const ga = GROUPS.findIndex((g) => g.id === a.group), gb = GROUPS.findIndex((g) => g.id === b.group);
        return ga - gb || orderIndex(a.key) - orderIndex(b.key) || (a.key < b.key ? -1 : 1);
      });
    return { procedural: false, items };
  }
  const items = [
    { ...metaFor('poster-dogdogdog'), url: proceduralPoster('dog'), procedural: true },
    { ...metaFor('poster-1vdoquz'), url: proceduralPoster('1v9'), procedural: true },
    ...ALL_TYPES.map((a) => ({ ...metaFor('portrait-' + a.id), url: proceduralPortrait(a, 512), procedural: true })),
  ];
  return { procedural: true, items };
}

// ------------------------------------------------------------------ prosedürel afişler
function tok(name, fb) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; } catch { return fb; }
}

const posterCache = new Map();

/** 16:9 yer tutucu afiş (canvas → data URL). kind: 'dog' | '1v9' */
export function proceduralPoster(kind) {
  if (posterCache.has(kind)) return posterCache.get(kind);
  const W = 1280, H = 720;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const ember = tok('--ember', '#ff6a2b'), ember2 = tok('--ember-2', '#ff9a3d'), aegis = tok('--aegis', '#e9b949'), aegis2 = tok('--aegis-2', '#f6d98a');
  const dire = tok('--dire', '#e0354b'), bg = tok('--bg', '#0d0b14'), text = tok('--text', '#f3eadb'), radiant = tok('--radiant', '#43d6a0');

  const bgGrad = g.createRadialGradient(W * 0.72, H * 0.4, 20, W * 0.6, H * 0.5, W * 0.8);
  bgGrad.addColorStop(0, '#3a1d2a');
  bgGrad.addColorStop(0.45, '#1a1224');
  bgGrad.addColorStop(1, bg);
  g.fillStyle = bgGrad;
  g.fillRect(0, 0, W, H);
  // ışık huzmeleri
  g.save();
  g.translate(W * 0.74, -40);
  for (let i = 0; i < 9; i++) {
    g.rotate(0.09);
    g.fillStyle = `rgba(255,154,61,${0.035 + (i % 3) * 0.015})`;
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(-40, H * 1.4); g.lineTo(40, H * 1.4); g.fill();
  }
  g.restore();
  // kor kıvılcımları
  for (let i = 0; i < 160; i++) {
    const x = (i * 197) % W, y = H * 0.35 + ((i * 131) % (H * 0.65));
    g.fillStyle = i % 3 ? `rgba(255,154,61,${0.2 + (i % 5) * 0.12})` : `rgba(233,185,73,${0.3 + (i % 4) * 0.1})`;
    g.fillRect(x, y, 2 + (i % 3), 2 + (i % 3));
  }
  // çerçeve
  g.strokeStyle = aegis;
  g.globalAlpha = 0.7;
  g.lineWidth = 3;
  g.strokeRect(26, 26, W - 52, H - 52);
  g.globalAlpha = 1;

  const stamp = (txt, x, y, size, fill, rot = -0.07) => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.font = `900 ${size}px Unbounded, "Arial Black", sans-serif`;
    g.textBaseline = 'alphabetic';
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillText(txt, 6, 8);
    g.fillStyle = fill;
    g.fillText(txt, 0, 0);
    g.restore();
  };
  const grad = (a, b) => { const gr = g.createLinearGradient(0, 0, W * 0.6, H * 0.4); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };

  g.font = '700 22px Cinzel, Georgia, serif';
  g.fillStyle = aegis;
  g.fillText('DIRE GECESİ · HAYRAN AFİŞİ', 70, 92);

  if (kind === 'dog') {
    stamp('DOG', 70, 290, 190, grad(ember2, ember));
    stamp('DOG', 110, 470, 190, grad(ember, dire));
    stamp('DOG', 150, 650, 190, grad(aegis2, ember));
    // pati arması
    g.fillStyle = aegis;
    g.beginPath(); g.ellipse(1010, 420, 120, 100, 0, 0, Math.PI * 2); g.fill();
    for (const [x, y] of [[880, 290], [960, 225], [1060, 225], [1140, 290]]) { g.beginPath(); g.ellipse(x, y, 42, 54, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = bg;
    g.font = '900 64px Unbounded, "Arial Black", sans-serif';
    g.textAlign = 'center';
    g.fillText('!', 1010, 448);
  } else {
    stamp('1v', 70, 400, 250, grad(aegis2, aegis));
    stamp('DOQUZ', 70, 610, 180, grad(ember2, dire));
    // dokuz rakip nokta + bir kahraman yıldızı
    for (let i = 0; i < 9; i++) {
      const x = 800 + (i % 3) * 120, y = 200 + Math.floor(i / 3) * 120;
      g.fillStyle = i < 4 ? radiant : dire;
      g.globalAlpha = 0.9;
      g.beginPath(); g.arc(x, y, 34, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      g.fillStyle = bg;
      g.font = '900 28px Unbounded, "Arial Black", sans-serif';
      g.textAlign = 'center';
      g.fillText('D', x, y + 10);
    }
    g.textAlign = 'left';
  }
  g.textAlign = 'right';
  g.font = '700 18px Cinzel, Georgia, serif';
  g.fillStyle = text;
  g.globalAlpha = 0.7;
  g.fillText('PROSEDÜREL YER TUTUCU', W - 70, H - 60);
  g.globalAlpha = 1;
  const url = c.toDataURL('image/png');
  posterCache.set(kind, url);
  return url;
}

/** Tüm yazı tiplerinin yüklenmesini kısa bir süre bekler (canvas metni için). */
export function fontsReady(ms = 900) {
  try {
    return Promise.race([
      Promise.all([
        document.fonts.load('900 60px Unbounded'),
        document.fonts.load('700 22px Cinzel'),
      ]),
      new Promise((r) => setTimeout(r, ms)),
    ]).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}
