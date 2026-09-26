// 3D Müze: karanlık salon, taş kaide, spot ışık, yansıyan zemin, kor tozları.
// Üç salon, 18 eser: Salon I · Efsaneler (3), Salon II · Arena (9), Salon III · Dokuzun Laneti (6). Salon sekmeleri, eser slotları,
// sahnedeki önceki/sonraki okları, klavye (← →) ve tam ekran ile gezilir.
// fal.ai (Trellis 2) GLB modeli varsa onu, yoksa exhibits.js'teki prosedürel versiyonu sergiler.
// Bellek: yalnızca sergilenen eser ve iki komşusu yüklü tutulur (modelpool.js); uzaklaşanlar serbest bırakılır.
// WebGL yoksa 2D yedek (portre/afiş ya da ikonlu kart) gösterir. mountMuseum(el, ctx) → temizlik fonksiyonu.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { h, clear, append, fmtNum, ls, clamp, prefersReducedMotion } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { art, modelAvailable } from './sources.js';
import { proceduralPortrait } from '../../components/portrait.js';
import { byId } from '../../data/archetypes.js';
import { EXHIBITS, buildExhibit, stoneTexture } from './exhibits.js';
import { WINGS, wingOf, TOTAL_NO, EN_WORD, upperName } from './exhibit-data.js';
import { createModelPool } from './modelpool.js';
import { likeTracker, likesLocalOnly } from './likes.js';

const THEMES = [
  { id: 'kor', label: 'Kor', token: '--ember', alt: '--aegis-2' },
  { id: 'yesim', label: 'Yeşim', token: '--radiant', alt: '--text' },
  { id: 'altin', label: 'Altın', token: '--aegis', alt: '--ember-2' },
];

const PED_TOP = 1.04;

// Kalite kademeleri: yavaş cihazlarda (ve yazılım WebGL'de) adım adım düşürülür.
const TIERS = [
  { pr: 2, reflect: true, shadow: 1024 },
  { pr: 1.25, reflect: false, shadow: 1024 },
  { pr: 1, reflect: false, shadow: 512 },
  { pr: 0.75, reflect: false, shadow: 512 },
  { pr: 0.5, reflect: false, shadow: 256 },
];

/** Yazılım tabanlı WebGL (SwiftShader/llvmpipe) mi? Geçici bir bağlamla yoklar. */
function isSoftwareGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return /swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function tok(name, fb = '#ffffff') {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fb;
  } catch {
    return fb;
  }
}

const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

function canvasTex(w, hh, draw, { srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = hh;
  draw(c.getContext('2d'), w, hh);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function radialTex(size = 64, stops = [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]) {
  return canvasTex(size, size, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    for (const [o, c] of stops) grd.addColorStop(o, c);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  }, { srgb: false });
}

function tileTexture() {
  let s = 12345;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const t = canvasTex(512, 512, (g) => {
    const n = 4, size = 128;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const b = 34 + Math.floor(rnd() * 12);
        g.fillStyle = `rgb(${b + 6},${b},${b + 14})`;
        g.fillRect(i * size, j * size, size, size);
        for (let k = 0; k < 260; k++) {
          g.fillStyle = rnd() > 0.5 ? `rgba(255,240,255,${0.02 + rnd() * 0.05})` : `rgba(0,0,0,${0.06 + rnd() * 0.12})`;
          const z = 1 + rnd() * 2.5;
          g.fillRect(i * size + rnd() * size, j * size + rnd() * size, z, z);
        }
        g.fillStyle = 'rgba(255,255,255,0.04)';
        g.fillRect(i * size, j * size, size, 3);
        g.fillRect(i * size, j * size, 3, size);
      }
    }
    g.fillStyle = '#09070d';
    for (let k = 0; k <= n; k++) {
      g.fillRect(k * size - 2, 0, 4, 512);
      g.fillRect(0, k * size - 2, 512, 4);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  t.anisotropy = 8;
  return t;
}

/** Salon sancağı. kind: 'dog' (Salon I, pati arması) | 'radiant' (yeşim, kule) | 'dire' (kızıl, boynuzlar) | 'lanet' (mor, IX mührü) */
function bannerTexture(pal, kind = 'dog') {
  const top = kind === 'radiant' ? '#1c6b50' : kind === 'lanet' ? '#3a1d5c' : pal.direDeep;
  const bottom = kind === 'radiant' ? '#0b2a22' : kind === 'lanet' ? '#0e0816' : '#2a0a12';
  return canvasTex(128, 384, (g) => {
    g.beginPath();
    g.moveTo(10, 0); g.lineTo(118, 0); g.lineTo(118, 384); g.lineTo(64, 326); g.lineTo(10, 384); g.closePath();
    const grd = g.createLinearGradient(0, 0, 0, 384);
    grd.addColorStop(0, top);
    grd.addColorStop(1, bottom);
    g.fillStyle = grd;
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = pal.aegis;
    g.lineWidth = 8;
    g.stroke();
    g.restore();
    g.fillStyle = pal.aegis;
    g.fillRect(10, 26, 108, 6);
    if (kind === 'radiant') {
      // kule + kristal
      g.fillRect(48, 150, 32, 58);
      g.fillRect(40, 140, 48, 12);
      g.fillRect(34, 206, 60, 8);
      g.beginPath(); g.moveTo(64, 96); g.lineTo(76, 116); g.lineTo(64, 136); g.lineTo(52, 116); g.closePath();
      g.fillStyle = pal.radiant;
      g.fill();
    } else if (kind === 'lanet') {
      // dokuzun mührü: halka + IX + çatlak
      g.strokeStyle = pal.aegis;
      g.lineWidth = 5;
      g.beginPath(); g.arc(64, 170, 36, 0, Math.PI * 2); g.stroke();
      g.font = '700 38px Cinzel, Georgia, serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('IX', 64, 172);
      g.strokeStyle = pal.dire;
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(64, 214); g.lineTo(56, 236); g.lineTo(70, 252); g.lineTo(60, 280); g.stroke();
    } else if (kind === 'dire') {
      // boynuzlu kafatası
      g.beginPath(); g.ellipse(64, 172, 26, 24, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(50, 186, 28, 22);
      g.beginPath(); g.moveTo(42, 160); g.quadraticCurveTo(22, 140, 26, 110); g.quadraticCurveTo(36, 138, 52, 150); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(86, 160); g.quadraticCurveTo(106, 140, 102, 110); g.quadraticCurveTo(92, 138, 76, 150); g.closePath(); g.fill();
      g.fillStyle = bottom;
      g.beginPath(); g.ellipse(54, 172, 7, 8, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(74, 172, 7, 8, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(58, 192, 4, 14); g.fillRect(66, 192, 4, 14);
    } else {
      // pati arması
      g.beginPath(); g.ellipse(64, 176, 24, 20, 0, 0, Math.PI * 2); g.fill();
      for (const [x, y] of [[36, 146], [53, 130], [75, 130], [92, 146]]) { g.beginPath(); g.ellipse(x, y, 9, 11, 0, 0, Math.PI * 2); g.fill(); }
    }
  });
}

/** 2D yedek için ikonlu kart (WebGL yok ve eserin portresi/afişi de yoksa). */
function iconCard(ex, pal) {
  const svg = icon(ex.icon, { size: 220, stroke: 1.4 });
  svg.setAttribute('x', '146');
  svg.setAttribute('y', '120');
  svg.setAttribute('stroke', pal.aegis2);
  const inner = new XMLSerializer().serializeToString(svg);
  const name = upperName(ex.name).replace(/[<&>]/g, '');
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="g" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="${pal.bg4}"/><stop offset="1" stop-color="${pal.bg}"/></radialGradient></defs><rect width="512" height="512" fill="url(#g)"/><rect x="18" y="18" width="476" height="476" fill="none" stroke="${pal.aegis}" stroke-opacity=".6" stroke-width="3"/>${inner}<text x="256" y="420" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="700" font-size="34" fill="${pal.aegis}">${name}</text><text x="256" y="456" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="18" fill="${pal.text}" fill-opacity=".7">ESER NO. ${ex.no}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(doc);
}

const fmtKB = (bytes) => `${fmtNum(Math.round(bytes / 1024))} KB`;

/** Eser adı düğümü: İngilizce özel adlar lang="en" (CSS büyük harfinde "DİRE" olmasın). */
const nameNode = (name) => name.split(/(\s+)/).map((w) => {
  const m = w.match(EN_WORD);
  return m ? [h('span', { lang: 'en' }, m[1]), m[2]] : w;
});

function meshStats(obj) {
  let tris = 0, verts = 0, meshes = 0;
  const texs = new Set();
  obj.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    meshes += 1;
    const g = o.geometry;
    const pos = g.attributes.position;
    const vc = pos ? pos.count : 0;
    verts += vc;
    tris += g.index ? g.index.count / 3 : vc / 3;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) if (m[k]) texs.add(m[k]);
    }
  });
  let texW = 0, texH = 0;
  for (const t of texs) {
    const img = t.image;
    if (img && img.width && img.width * img.height > texW * texH) { texW = img.width; texH = img.height; }
  }
  return { tris: Math.round(tris), verts, meshes, textures: texs.size, texW, texH };
}

function disposeTree(root) {
  const geos = new Set(), mats = new Set();
  const walk = (o) => {
    if (o.userData && o.userData.pooled) return; // fal modeli: kaynaklar model havuzuna ait (modelpool.trim bırakır)
    if (o.geometry) geos.add(o.geometry);
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
    for (const c of o.children) walk(c);
  };
  walk(root);
  geos.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
}

// ====================================================================================
export function mountMuseum(el, ctx) {
  const { sound, fx } = ctx;
  const reduced = prefersReducedMotion();
  const isMobile = window.matchMedia('(max-width: 720px), (pointer: coarse)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  let themeIdx = Math.max(0, THEMES.findIndex((t) => t.id === ls.get('gl:light', 'kor')));
  // Son bakılan eser hatırlanır; her salon kendi son eserini ayrıca hatırlar (salon sekmesine dönünce oradan devam)
  let current = Math.max(0, EXHIBITS.findIndex((e) => e.key === ls.get('gl:eser', EXHIBITS[0].key)));
  const lastInWing = Object.fromEntries(WINGS.map((w) => [w.id, EXHIBITS.findIndex((e) => e.wing === w.id)]));
  lastInWing[EXHIBITS[current].wing] = current;
  let shownWing = null;
  let destroyed = false;
  let mode = 'init'; // '3d' | '2d'
  const wrapIdx = (i) => (i + EXHIBITS.length) % EXHIBITS.length;

  // ---------------------------------------------------------------- DOM
  const canvas = h('canvas', { class: 'gl-canvas', tabindex: '0', role: 'img', 'aria-label': '3D müze sahnesi' });
  const loadingEl = h('div', { class: 'gl-stage-loading', hidden: true, role: 'status' }, h('span', { class: 'spinner' }), h('span', null, 'fal modeli yükleniyor…'));
  const stageRoom = h('span', { class: 'gl-stage-room' }, 'Salon I');
  const stageNo = h('span', { class: 'gl-stage-no' }, `Eser I / ${TOTAL_NO}`);
  const hint = h('p', { class: 'gl-stage-hint' }, icon('refresh', { size: 14 }), h('span', null, coarse ? 'Yana sürükle: döndür · İki parmak: yakınlaştır' : 'Sürükle: döndür · Tekerlek: yakınlaştır'));
  const prevBtn = h('button', { class: 'gl-nav prev', type: 'button' }, icon('arrowLeft', { size: 22 }));
  const nextBtn = h('button', { class: 'gl-nav next', type: 'button' }, icon('arrowRight', { size: 22 }));
  const fsBtn = h('button', { class: 'gl-fs', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Tam ekran', title: 'Tam ekran (F)' }, icon('expand', { size: 18 }));
  // Salon geçişi perdesi: "Salon II · Arena" yazısı kısa bir kararma ile görünür
  const veilTitle = h('span', { class: 'gl-veil-title' });
  const veilSub = h('span', { class: 'gl-veil-sub' });
  const veil = h('div', { class: 'gl-veil', 'aria-hidden': 'true' }, veilTitle, veilSub);
  // Tam ekranda plaket görünmediği için sahnenin altında ad + beğen + DOG! şeridi
  const fsName = h('span', { class: 'gl-fsbar-name' });
  const fsKicker = h('span', { class: 'gl-fsbar-kicker' });
  const fsLikeN = h('span', { class: 'num' }, '0');
  const fsLike = h('button', { class: 'btn ghost sm gl-like', type: 'button', 'aria-pressed': 'false', title: 'Bu eseri beğen' }, icon('heart', { size: 16 }), h('span', { class: 'sr-only' }, 'Beğen'), fsLikeN);
  const fsDog = h('button', { class: 'btn primary sm gl-dog-sm', type: 'button', title: 'Eser zıplasın, havlasın' }, icon('paw', { size: 16 }), 'DOG!');
  const fsBar = h('div', { class: 'gl-fsbar' }, h('span', { class: 'gl-fsbar-text' }, fsName, fsKicker), fsLike, fsDog);
  const stage = h('div', { class: 'gl-stage frame', 'data-light': THEMES[themeIdx].id },
    canvas,
    h('div', { class: 'gl-stage-hud', 'aria-hidden': 'true' }, stageRoom, stageNo),
    loadingEl,
    hint,
    prevBtn,
    nextBtn,
    fsBtn,
    fsBar,
    veil,
  );

  const dogBtn = h('button', { class: 'btn primary gl-dog', type: 'button', title: 'Eser zıplasın, havlasın' }, icon('paw'), 'DOG!');
  const lightLabel = h('span', null, 'Işık: ' + THEMES[themeIdx].label);
  const lightBtn = h('button', { class: 'btn ghost gl-lightbtn', type: 'button', 'aria-label': 'Işıkları değiştir' }, h('span', { class: 'gl-swatch', 'aria-hidden': 'true' }), lightLabel);
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });

  const slotBtns = EXHIBITS.map((ex, i) => {
    const b = h('button', { class: 'gl-slot', type: 'button', 'aria-pressed': String(i === current), dataset: { ex: ex.id, wing: ex.wing } },
      h('span', { class: 'gl-slot-icon', 'aria-hidden': 'true' }, icon(ex.icon, { size: 26 }), h('span', { class: 'gl-slot-no' }, ex.no)),
      h('span', { class: 'gl-slot-name' }, nameNode(ex.name)),
      h('span', { class: 'gl-slot-src', dataset: { src: '' } }, modelAvailable(ex.key) ? 'fal GLB' : 'prosedürel'),
    );
    b.addEventListener('click', () => { if (i !== current || mode === 'init') { sound.click(); select(i); } });
    return b;
  });
  const slotsEl = h('div', { class: 'gl-slots', id: 'gl-slots', role: 'tabpanel', 'aria-label': 'Eser seç' }, slotBtns);

  const wingTabs = WINGS.map((w) => {
    const n = EXHIBITS.filter((e) => e.wing === w.id).length;
    const b = h('button', {
      class: 'gl-wing', type: 'button', role: 'tab', id: `gl-wing-${w.id}`, 'aria-controls': 'gl-slots', 'aria-selected': 'false', tabindex: '-1', dataset: { wing: w.id },
    },
      h('span', { class: 'gl-wing-no' }, `Salon ${w.no}`),
      h('span', { class: 'gl-wing-name' }, w.name),
      h('span', { class: 'gl-wing-n num' }, String(n), h('span', { class: 'sr-only' }, ' eser')),
    );
    b.addEventListener('click', () => {
      if (shownWing === w.id) return;
      sound.click();
      select(lastInWing[w.id]);
    });
    return b;
  });
  const wingsEl = h('div', { class: 'gl-wings', role: 'tablist', 'aria-label': 'Müze salonları' }, wingTabs);
  wingsEl.addEventListener('keydown', (e) => {
    const i = wingTabs.indexOf(document.activeElement);
    if (i === -1) return;
    let n = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % wingTabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + wingTabs.length) % wingTabs.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = wingTabs.length - 1;
    if (n == null) return;
    e.preventDefault();
    e.stopPropagation();
    wingTabs[n].focus();
    wingTabs[n].click();
  });
  const wingLore = h('p', { class: 'gl-wing-lore xsmall dim' });

  const plaque = h('article', { class: 'gl-plaque panel raised frame', 'aria-label': 'Müze plaketi' });

  const root = h('div', { class: 'gl-museum' },
    h('div', { class: 'gl-museum-main' },
      stage,
      h('div', { class: 'gl-stage-bar' },
        dogBtn,
        lightBtn,
        h('p', { class: 'gl-stage-keys xsmall dim' },
          h('span', { class: 'kbd' }, '←'), ' ', h('span', { class: 'kbd' }, '→'), ' eser · ',
          h('span', { class: 'kbd' }, 'Shift'), '+', h('span', { class: 'kbd' }, '←'), h('span', { class: 'kbd' }, '→'), ' döndür · ',
          h('span', { class: 'kbd' }, '+'), ' ', h('span', { class: 'kbd' }, '−'), ' yakınlaştır · ',
          h('span', { class: 'kbd' }, 'F'), ' tam ekran'),
      ),
    ),
    h('aside', { class: 'gl-museum-side' },
      h('div', { class: 'gl-hall' }, wingsEl, wingLore, slotsEl),
      plaque,
      live,
    ),
  );
  el.appendChild(root);

  const likes = likeTracker(() => updateLike());
  let likeBtn = null;
  let likeNote = null;
  function updateLike() {
    if (likeNote) likeNote.textContent = likesLocalOnly() ? 'Salt okunur görüntüleme: beğenin yalnızca bu cihazda sayılır.' : 'Beğeniler galeriyle ortak sayılır.';
    const key = EXHIBITS[current].key;
    const on = likes.liked(key);
    const n = fmtNum(likes.count(key));
    for (const b of [likeBtn, fsLike]) {
      if (!b) continue;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('on', on);
    }
    if (likeBtn) likeBtn.lastChild.textContent = n;
    fsLikeN.textContent = n;
  }
  function toggleLike() {
    const on = likes.toggle(EXHIBITS[current].key);
    if (on) sound.bark(1.25);
    else sound.click();
    updateLike();
  }
  fsLike.addEventListener('click', toggleLike);

  // ---------------------------------------------------------------- plaket
  function renderPlaque(ex, state, stats) {
    clear(plaque);
    const wing = wingOf(ex);
    const badge = state === 'fal'
      ? h('span', { class: 'badge jade' }, 'fal modeli')
      : state === 'loading'
        ? h('span', { class: 'badge gold' }, 'yükleniyor')
        : state === '2d'
          ? h('span', { class: 'badge' }, '2D önizleme')
          : h('span', { class: 'badge ember' }, 'prosedürel önizleme');
    let rows;
    if (state === 'fal' && stats) {
      rows = [
        ['Üçgen', fmtNum(stats.tris)],
        ['Köşe', fmtNum(stats.verts)],
        ['Doku', stats.texW ? `${stats.texW}×${stats.texH} · ${stats.textures} harita` : 'gömülü doku yok'],
        ['Dosya', stats.bytes ? `${fmtKB(stats.bytes)} · GLB` : 'GLB · Trellis 2'],
      ];
    } else if (state === 'procedural' && stats) {
      rows = [
        ['Üçgen', fmtNum(stats.tris)],
        ['Parça', fmtNum(stats.meshes) + ' primitif'],
        ['Doku', 'yok · düz malzeme'],
        ['Biçim', 'three.js, kodla'],
      ];
    } else if (state === '2d') {
      rows = [['Üçgen', '—'], ['Doku', '—'], ['Biçim', '2D yedek görsel'], ['Sebep', 'WebGL yok']];
    } else {
      rows = [['Üçgen', '…'], ['Köşe', '…'], ['Doku', '…'], ['Dosya', '…']];
    }
    likeBtn = h('button', { class: 'btn ghost sm gl-like', type: 'button', 'aria-pressed': 'false', title: 'Bu eseri beğen' },
      icon('heart', { size: 16 }), h('span', null, 'Beğen'), h('span', { class: 'num gl-like-n' }, '0'));
    likeBtn.addEventListener('click', toggleLike);
    likeNote = h('span', { class: 'xsmall dim gl-like-note' });
    // arena: true → "Arena’da gör"; 'soon' → hikâye modu henüz yolda: rozet + Arena'ya kısa yol
    const arenaBtn = ex.arena
      ? h('button', { class: 'btn ghost sm gl-arena-link', type: 'button', title: ex.arena === true ? 'Bu eseri 1vDOQUZ Arena’da gör' : '1vDOQUZ Arena’ya git' },
        icon('swords', { size: 16 }), ex.arena === true ? 'Arena’da gör' : 'Arena’ya git', icon('arrowRight', { size: 14 }))
      : null;
    const soon = ex.arena === 'soon' ? h('span', { class: 'badge gl-soon' }, icon('hourglass', { size: 13 }), 'Yakında hikâye modunda') : null;
    if (arenaBtn) arenaBtn.addEventListener('click', () => { sound.click(); exitFs(); ctx.go('oyunlar', 'arena'); });
    append(plaque, [
      h('div', { class: 'gl-plaque-top' }, h('span', { class: 'eyebrow' }, `Eser No. ${ex.no} · Salon ${wing.no}`), h('span', { class: 'gl-plaque-badges' }, soon, badge)),
      h('div', { class: 'gl-plaque-head' },
        h('h2', { class: 'gl-plaque-title' }, nameNode(ex.name)),
        ex.kicker ? h('p', { class: 'gl-plaque-kicker' }, ex.kicker) : null),
      // Malzeme satırı sergilenen şeyi anlatsın: yedekte fal modeli yok
      h('p', { class: 'gl-plaque-mat' }, h('span', { class: 'gl-plaque-k' }, 'Malzeme: '),
        state === 'procedural'
          ? ['kodla çizilmiş ', h('span', { lang: 'en' }, 'three.js'), ' önizlemesi']
          : state === '2d'
            ? '2D yedek görsel'
            : [h('span', { lang: 'en' }, 'fal.ai Trellis 2'), ' · kaynak görsel ', h('span', { lang: 'en' }, 'Nano Banana 2')]),
      h('hr', { class: 'divider' }),
      h('p', { class: 'gl-plaque-desc' }, ex.desc),
      h('dl', { class: 'gl-plaque-stats' }, rows.map(([k, v]) => h('div', null, h('dt', null, k), h('dd', { class: 'num' }, v)))),
      state === 'procedural'
        ? h('p', { class: 'gl-plaque-note' }, icon('info', { size: 16 }),
          h('span', null, 'fal modeli yüklenmediği için prosedürel önizleme. ', h('code', null, ex.key + '.glb'), ' eklendiğinde bu kaide onu kendiliğinden sergiler.'))
        : state === '2d'
          ? h('p', { class: 'gl-plaque-note' }, icon('info', { size: 16 }), h('span', null, 'Tarayıcın WebGL desteklemediği için 3D sahne yerine 2D önizleme gösteriliyor.'))
          : null,
      h('div', { class: 'gl-plaque-foot' }, likeBtn, arenaBtn, likeNote),
    ]);
    updateLike();
  }

  function markSlots() {
    const ex = EXHIBITS[current];
    const wing = wingOf(ex);
    slotBtns.forEach((b, i) => {
      b.setAttribute('aria-pressed', String(i === current));
      b.hidden = EXHIBITS[i].wing !== wing.id;
    });
    wingTabs.forEach((t) => {
      const on = t.dataset.wing === wing.id;
      t.setAttribute('aria-selected', String(on));
      t.setAttribute('tabindex', on ? '0' : '-1');
    });
    slotsEl.dataset.wing = wing.id;
    slotsEl.setAttribute('aria-labelledby', `gl-wing-${wing.id}`);
    wingLore.textContent = wing.lore;
    stageRoom.textContent = wing.label;
    stageNo.textContent = `Eser ${ex.no} / ${TOTAL_NO}`;
    clear(fsName);
    append(fsName, nameNode(ex.name));
    fsKicker.textContent = `Eser ${ex.no} · ${ex.kicker || wing.label}`;
    const p = EXHIBITS[wrapIdx(current - 1)], n = EXHIBITS[wrapIdx(current + 1)];
    prevBtn.setAttribute('aria-label', `Önceki eser: ${p.name}`);
    prevBtn.title = `Önceki: ${p.name} (←)`;
    nextBtn.setAttribute('aria-label', `Sonraki eser: ${n.name}`);
    nextBtn.title = `Sonraki: ${n.name} (→)`;
  }

  function setLightUI() {
    const th = THEMES[themeIdx];
    lightLabel.textContent = 'Işık: ' + th.label;
    lightBtn.setAttribute('aria-label', `Işıkları değiştir (şu an: ${th.label})`);
    lightBtn.style.setProperty('--sw', `var(${th.token})`);
    stage.dataset.light = th.id;
  }

  // ---------------------------------------------------------------- 3D kurulum
  let renderer = null, scene, camera, controls, reflector = null, envRT = null;
  let spot, rim, rim2, cone, glow, dust, dustMat, floorMat, plateTex, plateCanvas;
  const ownTextures = [];
  const banners = [];
  const bannerMats = {};
  let holder, jumper, presenter = null;
  let outgoing = [];
  let appear = null, jumpAnim = null;
  let boost = 0, spotKick = 0;
  let themeT = 1;
  let focusY = 1.55;
  let swing = null; // eser değişince kamerayı yumuşakça esere (önden) döndürür
  const themeTargets = { spot: new THREE.Color(), rim: new THREE.Color(), cone: new THREE.Color(), glow: new THREE.Color() };
  let dustData = null;
  let running = false, visible = true, lost = false, raf = 0, lastT = 0, clock = 0;
  let resumeT = 0, preloadT = 0, veilT = 0;
  let stoneTex = null;
  let io = null, ro = null;
  const software = isSoftwareGL();
  let tier = software ? 3 : 0;
  const perf = { acc: 0, n: 0 };
  const pool = createModelPool();

  const pal = {
    ember: tok('--ember', '#ff6a2b'), ember2: tok('--ember-2', '#ff9a3d'), aegis: tok('--aegis', '#e9b949'), aegis2: tok('--aegis-2', '#f6d98a'),
    radiant: tok('--radiant', '#43d6a0'), dire: tok('--dire', '#e0354b'), direDeep: tok('--dire-deep', '#8f1d2c'),
    bg: tok('--bg', '#0d0b14'), bg3: tok('--bg-3', '#1e1a2b'), bg4: tok('--bg-4', '#282238'), arcane: tok('--arcane', '#8b7cff'), text: tok('--text', '#f3eadb'),
  };
  const themeColor = () => new THREE.Color(tok(THEMES[themeIdx].token, pal.ember));
  const palFor = () => ({ ...pal, theme: tok(THEMES[themeIdx].token, pal.ember) });

  function initGL() {
    let gl = null;
    try {
      gl = canvas.getContext('webgl2', { antialias: !software && (window.devicePixelRatio || 1) < 2, alpha: false, powerPreference: 'high-performance' });
    } catch { gl = null; }
    if (!gl) return false;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, context: gl });
    } catch (e) {
      console.warn('WebGL başlatılamadı', e);
      renderer = null;
      return false;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2, TIERS[tier].pr));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    const bgCol = new THREE.Color(pal.bg);
    scene.background = bgCol;
    scene.fog = new THREE.FogExp2(bgCol.clone(), 0.058);

    camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
    camera.position.set(0, 2.4, 5.15);
    scene.add(camera);

    // Ortam yansıması: karanlık oda + üstte softbox + yanlarda renkli şeritler
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x07060b);
    const envGeo = new THREE.PlaneGeometry(1, 1);
    const envMats = [];
    const panel = (color, mult, w, hh, pos) => {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(mult), side: THREE.DoubleSide });
      envMats.push(m);
      const p = new THREE.Mesh(envGeo, m);
      p.scale.set(w, hh, 1);
      p.position.set(pos[0], pos[1], pos[2]);
      p.lookAt(0, 0, 0);
      envScene.add(p);
    };
    panel('#fff1dc', 6, 5, 5, [0, 6, 0]);
    panel(pal.ember, 2.4, 1.2, 7, [-6, 1, 1.5]);
    panel(pal.aegis, 2.0, 1.2, 7, [6, 1, -1.5]);
    panel(pal.arcane, 0.7, 7, 2, [0, 1.2, -6]);
    panel('#ffffff', 0.8, 7, 1.4, [0, 0.4, 6]);
    envRT = pmrem.fromScene(envScene, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.75;
    pmrem.dispose();
    envGeo.dispose();
    envMats.forEach((m) => m.dispose());

    // Işıklar
    scene.add(new THREE.HemisphereLight(new THREE.Color(pal.bg4), new THREE.Color(pal.bg), 1.2));
    spot = new THREE.SpotLight(0xffffff, 170, 0, 0.36, 0.6, 2);
    spot.position.set(0.2, 7.4, 1.3);
    spot.target.position.set(0, 1.1, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(TIERS[tier].shadow, TIERS[tier].shadow);
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.02;
    spot.shadow.camera.near = 2;
    spot.shadow.camera.far = 12;
    scene.add(spot, spot.target);
    rim = new THREE.PointLight(0xffffff, 18, 12, 2);
    rim.position.set(-2.6, 2.7, -2.4);
    rim2 = new THREE.PointLight(new THREE.Color(pal.aegis), 7, 10, 2);
    rim2.position.set(2.8, 1.5, -1.9);
    const fill = new THREE.DirectionalLight(new THREE.Color('#c9c0ff'), 0.35);
    fill.position.set(2, 3, 6);
    scene.add(rim, rim2, fill);

    // Görünür ışık konisi (hacimsel görüntü)
    const spotPos = spot.position.clone();
    const tgt = new THREE.Vector3(0, 0, 0.2);
    const dir = tgt.clone().sub(spotPos);
    const H = dir.length();
    dir.normalize();
    const coneMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 0.2 } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ float rimF = pow(abs(dot(normalize(vN), normalize(vV))), 1.8); float a = rimF * (0.2 + 0.8*vUv.y) * smoothstep(0.0, 0.22, vUv.y) * uOpacity; gl_FragColor = vec4(uColor, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    cone = new THREE.Mesh(new THREE.ConeGeometry(Math.tan(0.3) * H, H, 48, 1, true), coneMat);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    cone.position.copy(spotPos).addScaledVector(dir, H / 2);
    cone.renderOrder = 5;
    scene.add(cone);

    // Arka plan parıltısı (kameraya bağlı)
    const glowTex = radialTex(128, [[0, 'rgba(255,255,255,0.9)'], [0.4, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']]);
    ownTextures.push(glowTex);
    glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.28, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    glow.position.set(0, 1.2, -22);
    glow.scale.set(30, 18, 1);
    camera.add(glow);

    // Zemin: yansıma + döşeme
    const floorGeo = new THREE.CircleGeometry(16, 72);
    if (TIERS[tier].reflect && !isMobile) {
      reflector = new Reflector(floorGeo, { textureWidth: 512, textureHeight: 512, clipBias: 0.003, color: 0x8c8c8c, multisample: 0 });
      reflector.rotation.x = -Math.PI / 2;
      scene.add(reflector);
    }
    const tiles = tileTexture();
    ownTextures.push(tiles);
    floorMat = new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.55, metalness: 0.08, transparent: !!reflector, opacity: reflector ? 0.8 : 1 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.002;
    floor.receiveShadow = true;
    scene.add(floor);
    const arena = art('texture-arena');
    if (arena) {
      new THREE.TextureLoader().load(arena, (tex) => {
        if (destroyed || !renderer) { tex.dispose(); return; }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(9, 9);
        tex.anisotropy = 8;
        ownTextures.push(tex);
        floorMat.map = tex;
        floorMat.color.set('#7d7690');
        floorMat.needsUpdate = true;
      }, undefined, () => { /* dokusuz devam */ });
    }
    const goldMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(pal.aegis), metalness: 1, roughness: 0.3, emissive: new THREE.Color(pal.aegis), emissiveIntensity: 0.12 });
    const inlay = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.6, 128), goldMat);
    inlay.rotation.x = -Math.PI / 2;
    inlay.position.y = 0.004;
    scene.add(inlay);

    // Kaide
    stoneTex = stoneTexture('#443c58', 11);
    ownTextures.push(stoneTex);
    const shaftTex = stoneTex.clone();
    shaftTex.repeat.set(3, 1);
    shaftTex.needsUpdate = true;
    ownTextures.push(shaftTex);
    const pedMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#a49bb6'), map: stoneTex, roughness: 0.82, metalness: 0.02 });
    const shaftMat = new THREE.MeshStandardMaterial({ map: shaftTex, roughness: 0.8, metalness: 0.02 });
    const ped = new THREE.Group();
    scene.add(ped);
    const pm = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; ped.add(m); return m; };
    pm(new THREE.CylinderGeometry(1.18, 1.24, 0.16, 64), pedMat, 0.08);
    pm(new THREE.CylinderGeometry(1.04, 1.1, 0.1, 64), pedMat, 0.21);
    const shaftGeo = new THREE.CylinderGeometry(0.86, 0.86, 0.62, 192, 1, true);
    {
      const p = shaftGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const a = Math.atan2(z, x);
        const k = 1 - 0.03 * Math.pow(0.5 + 0.5 * Math.cos(a * 24), 2);
        p.setX(i, x * k);
        p.setZ(i, z * k);
      }
      shaftGeo.computeVertexNormals();
    }
    pm(shaftGeo, shaftMat, 0.57);
    pm(new THREE.CylinderGeometry(0.98, 0.9, 0.06, 64), pedMat, 0.91);
    pm(new THREE.CylinderGeometry(1.02, 1.02, 0.1, 64), pedMat, 0.99);
    const ring = pm(new THREE.TorusGeometry(1.028, 0.024, 12, 128), goldMat, 0.99);
    ring.rotation.x = Math.PI / 2;
    const ring2 = pm(new THREE.TorusGeometry(1.1, 0.016, 10, 128), goldMat, 0.262);
    ring2.rotation.x = Math.PI / 2;
    // Pirinç isim plakası (kavisli)
    plateCanvas = document.createElement('canvas');
    plateCanvas.width = 512;
    plateCanvas.height = 128;
    plateTex = new THREE.CanvasTexture(plateCanvas);
    plateTex.colorSpace = THREE.SRGBColorSpace;
    plateTex.anisotropy = 4;
    ownTextures.push(plateTex);
    const plateMat = new THREE.MeshStandardMaterial({ map: plateTex, metalness: 0.5, roughness: 0.4, emissive: 0xffffff, emissiveMap: plateTex, emissiveIntensity: 0.16 });
    pm(new THREE.CylinderGeometry(0.874, 0.874, 0.2, 24, 1, true, -0.42, 0.84), plateMat, 0.6);

    // Kordon direkleri
    const postMat = goldMat;
    const ropeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(pal.direDeep), roughness: 0.9 });
    const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.82, 12);
    const postBase = new THREE.CylinderGeometry(0.11, 0.13, 0.04, 20);
    const knob = new THREE.SphereGeometry(0.055, 16, 12);
    const RR = 2.15;
    const posts = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      const x = Math.sin(a) * RR, z = Math.cos(a) * RR;
      posts.push(new THREE.Vector3(x, 0.82, z));
      for (const [geo, y] of [[postGeo, 0.41], [postBase, 0.02], [knob, 0.86]]) {
        const m = new THREE.Mesh(geo, postMat);
        m.position.set(x, y, z);
        m.castShadow = true;
        scene.add(m);
      }
    }
    for (let i = 0; i < posts.length; i++) {
      const a = posts[i], b = posts[(i + 1) % posts.length];
      const mid = a.clone().lerp(b, 0.5);
      mid.y -= 0.22;
      const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 24, 0.02, 8), ropeMat);
      rope.castShadow = true;
      scene.add(rope);
    }

    // Arka plan: sütunlar ve sancaklar (sisin içinde). Sancaklar salona göre değişir.
    const colMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#4a4260'), map: stoneTex, roughness: 0.95 });
    const shaftG = new THREE.CylinderGeometry(0.32, 0.36, 7.2, 14);
    const baseG = new THREE.BoxGeometry(0.95, 0.35, 0.95);
    const capG = new THREE.BoxGeometry(0.9, 0.3, 0.9);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.26;
      const x = Math.cos(a) * 8.6, z = Math.sin(a) * 8.6;
      for (const [geo, y] of [[shaftG, 3.95], [baseG, 0.175], [capG, 7.6]]) {
        const m = new THREE.Mesh(geo, colMat);
        m.position.set(x, y, z);
        scene.add(m);
      }
    }
    for (const kind of ['dog', 'radiant', 'dire', 'lanet']) {
      const tex = bannerTexture(pal, kind);
      ownTextures.push(tex);
      bannerMats[kind] = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3 });
    }
    const banGeo = new THREE.PlaneGeometry(1.1, 3.3);
    for (let i = 0; i < 6; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.26 + Math.PI / 12 + Math.PI; // arka yarım, sütun araları
      const m = new THREE.Mesh(banGeo, bannerMats.dog);
      m.position.set(Math.cos(a) * 8.3, 4.6, Math.sin(a) * 8.3);
      m.lookAt(0, 4.6, 0);
      scene.add(m);
      banners.push(m);
    }
    // Paylaşımlı malzemeler sahnede kullanılmayabilir; teardown'da elle bırakılsın
    scene.userData.extraMats = Object.values(bannerMats);

    // Kor tozları
    const N = isMobile || software ? 130 : 240;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const spd = new Float32Array(N), ph = new Float32Array(N), mix = new Float32Array(N);
    const respawn = (i, anyY) => {
      const r = 0.7 + Math.random() * 3.6, a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = anyY ? Math.random() * 4.8 : 0.05;
      pos[i * 3 + 2] = Math.sin(a) * r - 0.4;
      spd[i] = 0.08 + Math.random() * 0.22;
      ph[i] = Math.random() * Math.PI * 2;
    };
    for (let i = 0; i < N; i++) { respawn(i, true); mix[i] = Math.random(); }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dustGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const dotTex = radialTex(32);
    ownTextures.push(dotTex);
    dustMat = new THREE.PointsMaterial({ size: 0.06, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    scene.add(dust);
    dustData = { N, pos, col, spd, ph, mix, respawn, geo: dustGeo };

    // Eser tutucu
    holder = new THREE.Group();
    holder.position.y = PED_TOP;
    scene.add(holder);
    jumper = new THREE.Group();
    holder.add(jumper);

    // Kontroller
    controls = new OrbitControls(camera, canvas);
    controls.target.set(0, focusY, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 3.2;
    controls.maxDistance = 8.5;
    controls.minPolarAngle = 0.45;
    controls.maxPolarAngle = 1.46;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.7;
    controls.autoRotate = !reduced;
    controls.autoRotateSpeed = 1.5;
    // Dokunmatikte dikey kaydırma sayfaya kalsın: sahne ekranın çoğunu kapladığında sayfa sahnede "takılmasın".
    // Yatay sürükleme döndürür, iki parmak yakınlaştırır; dikey kaydırmada tarayıcı pointercancel gönderir.
    if (coarse) canvas.style.touchAction = 'pan-y';
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('end', onControlEnd);
    controls.update();

    applyTheme(true);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('keydown', onCanvasKey);
    return true;
  }

  function onControlStart() {
    controls.autoRotate = false;
    swing = null;
    clearTimeout(resumeT);
    hint.classList.add('is-hidden');
  }

  /** Yeni eser önden görünsün: kamera en kısa yoldan ön cepheye döner, sonra otomatik dönüş sürer. */
  function swingToFront() {
    if (!controls || reduced) return;
    const off = camera.position.clone().sub(controls.target);
    const from = Math.atan2(off.x, off.z);
    const delta = -Math.atan2(Math.sin(from), Math.cos(from)); // [-π, π] aralığında 0'a
    if (Math.abs(delta) < 0.35) return;
    controls.autoRotate = false;
    clearTimeout(resumeT);
    swing = { from, delta, t: 0, d: 0.5 + Math.abs(delta) * 0.22 };
  }
  function onControlEnd() {
    clearTimeout(resumeT);
    resumeT = setTimeout(() => { if (controls && !reduced) controls.autoRotate = true; }, 4000);
  }

  // Sahneye odaklıyken: Shift + ← → döndür, + − yakınlaştır (düz ← → eser değiştirir; bkz. onDocKey)
  function onCanvasKey(e) {
    if (!controls || e.ctrlKey || e.metaKey || e.altKey) return;
    let used = true;
    const off = camera.position.clone().sub(controls.target);
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.shiftKey) {
      off.applyAxisAngle(Y_AXIS, e.key === 'ArrowLeft' ? -0.26 : 0.26);
    } else if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
      const f = e.key === '-' || e.key === '_' ? 1.12 : 0.89;
      off.setLength(clamp(off.length() * f, controls.minDistance, controls.maxDistance));
    } else used = false;
    if (!used) return;
    e.preventDefault();
    e.stopPropagation();
    camera.position.copy(controls.target).add(off);
    onControlStart();
    onControlEnd();
    controls.update();
    if (!running) renderOnce();
  }

  function onLost(e) {
    e.preventDefault();
    if (destroyed) return;
    lost = true;
    setRunning();
    teardownGL(false);
    pool.destroy();
    mount2D();
  }

  // ---------------------------------------------------------------- tema
  function applyTheme(instant) {
    const th = themeColor();
    const white = new THREE.Color(0xffffff);
    themeTargets.spot.copy(white).lerp(th, 0.3);
    themeTargets.rim.copy(th);
    themeTargets.cone.copy(white).lerp(th, 0.55);
    themeTargets.glow.copy(th);
    if (instant) {
      spot.color.copy(themeTargets.spot);
      rim.color.copy(themeTargets.rim);
      cone.material.uniforms.uColor.value.copy(themeTargets.cone);
      glow.material.color.copy(themeTargets.glow);
      themeT = 1;
      paintDust(1);
    } else {
      themeT = 0;
    }
    if (presenter) tintThemed(presenter, th);
  }

  function tintThemed(obj, th) {
    obj.traverse((o) => {
      const list = o.userData && o.userData.themed;
      if (list) for (const m of list) { m.color.copy(th); m.emissive.copy(th); }
    });
  }

  const _a = new THREE.Color(), _b = new THREE.Color(), _c = new THREE.Color();
  function paintDust() {
    if (!dustData) return;
    _a.copy(rim.color);
    _b.set(tok(THEMES[themeIdx].alt, pal.aegis2));
    const { N, col, mix } = dustData;
    for (let i = 0; i < N; i++) {
      _c.copy(_a).lerp(_b, mix[i] * 0.7);
      col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    }
    dustData.geo.attributes.color.needsUpdate = true;
  }

  // ---------------------------------------------------------------- plaka + salon
  function drawPlate(ex) {
    if (!plateCanvas) return;
    const g = plateCanvas.getContext('2d');
    const W = 512, H = 128;
    const grd = g.createLinearGradient(0, 0, W, 0);
    grd.addColorStop(0, '#6b4812');
    grd.addColorStop(0.3, '#d8a948');
    grd.addColorStop(0.5, pal.aegis2);
    grd.addColorStop(0.72, '#c99a3a');
    grd.addColorStop(1, '#6b4812');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 2) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
      g.fillRect(0, y, W, 1);
    }
    g.strokeStyle = 'rgba(40,24,6,0.85)';
    g.lineWidth = 4;
    g.strokeRect(8, 8, W - 16, H - 16);
    g.lineWidth = 1;
    g.strokeRect(15, 15, W - 30, H - 30);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const name = upperName(ex.name);
    g.font = '700 44px Cinzel, Georgia, serif';
    g.fillStyle = 'rgba(255,240,200,0.55)';
    g.fillText(name, W / 2 + 1, 56 + 1, W - 70);
    g.fillStyle = '#2a1805';
    g.fillText(name, W / 2, 56, W - 70);
    g.font = '700 17px Cinzel, Georgia, serif';
    g.fillText(`ESER NO. ${ex.no} · SALON ${wingOf(ex).no}`, W / 2, 96, W - 70);
    plateTex.needsUpdate = true;
  }

  function dressHall(wingId) {
    banners.forEach((m, i) => {
      m.material = wingId === 'arena' ? (i % 2 ? bannerMats.dire : bannerMats.radiant) : wingId === 'lanet' ? bannerMats.lanet : bannerMats.dog;
    });
  }

  function playVeil(wing) {
    veilTitle.textContent = `Salon ${wing.no}`;
    veilSub.textContent = wing.name;
    clearTimeout(veilT);
    stage.classList.remove('is-veiled');
    void stage.offsetWidth;
    stage.classList.add('is-veiled');
    veilT = setTimeout(() => stage.classList.remove('is-veiled'), reduced ? 900 : 1300);
  }

  // ---------------------------------------------------------------- eser değiştirme
  let selToken = 0;
  const keyOf = (i) => EXHIBITS[wrapIdx(i)].key;

  /** Havuzda kalacaklar: sergilenen, iki komşusu, sahnede hâlâ görünen (çıkış animasyonundaki) eserler. */
  function trimPool() {
    const keep = new Set([keyOf(current), keyOf(current - 1), keyOf(current + 1)]);
    if (presenter && presenter.userData.key) keep.add(presenter.userData.key);
    for (const o of outgoing) if (o.g.userData.key) keep.add(o.g.userData.key);
    pool.trim(keep);
    markPool();
  }
  // Geliştirmede test kancası: bellekteki modeller <div class="gl-museum" data-pool="…">
  const markPool = () => { if (import.meta.env.DEV) root.dataset.pool = pool.loadedKeys().join(' '); };

  function preloadNeighbours() {
    clearTimeout(preloadT);
    preloadT = setTimeout(() => {
      if (destroyed || mode !== '3d') return;
      for (const d of [1, -1]) {
        const k = keyOf(current + d);
        if (modelAvailable(k)) pool.acquire(k).then(markPool);
      }
    }, 350);
  }

  function step(d, { focusSlot = false } = {}) {
    sound.tick();
    select(wrapIdx(current + d));
    if (focusSlot) slotBtns[current].focus();
  }

  async function select(i) {
    const prevWing = shownWing;
    current = i;
    const ex = EXHIBITS[i];
    const wing = wingOf(ex);
    lastInWing[wing.id] = i;
    shownWing = wing.id;
    ls.set('gl:eser', ex.key);
    markSlots();
    canvas.setAttribute('aria-label', `3D müze sahnesi, ${wing.label}: ${ex.name}, taş kaide üzerinde. Sürükleyerek döndür, tekerlek ya da iki parmakla yakınlaştır; odaklanınca ok tuşlarıyla eser değiştir, Shift ile döndür, artı/eksi ile yakınlaştır.`);
    if (mode === '2d') { select2D(i); return; }
    if (mode !== '3d') return;
    if (prevWing !== wing.id) {
      dressHall(wing.id);
      if (prevWing) playVeil(wing);
    }
    drawPlate(ex);
    const token = ++selToken;
    let obj = null;
    let bytes = 0;
    if (modelAvailable(ex.key)) {
      loadingEl.hidden = false;
      renderPlaque(ex, 'loading');
      const entry = await pool.acquire(ex.key);
      if (destroyed || token !== selToken || mode !== '3d') return;
      if (entry && entry.root) {
        obj = pool.clone(entry, ex.height);
        bytes = entry.bytes;
      }
    }
    loadingEl.hidden = true;
    const state = obj ? 'fal' : 'procedural';
    if (!obj) obj = buildExhibit(ex.id, palFor(), stoneTex);
    if (ex.yaw) obj.rotation.y = ex.yaw;
    tintThemed(obj, themeColor());
    const stats = { ...meshStats(obj), bytes };
    swapTo(obj, obj.userData.pooled ? ex.key : null);
    if (running) swingToFront();
    focusY = PED_TOP + Math.min(ex.height || 1.5, 1.6) * 0.34;
    renderPlaque(ex, state, stats);
    live.textContent = `Seçilen eser: ${ex.name}, ${wing.label}${state === 'fal' ? ' (fal modeli)' : ' (prosedürel önizleme)'}`;
    slotBtns[i].querySelector('.gl-slot-src').textContent = state === 'fal' ? 'fal GLB' : 'prosedürel';
    trimPool();
    preloadNeighbours();
    if (!running) renderOnce();
  }

  function swapTo(obj, key) {
    const pres = new THREE.Group();
    pres.add(obj);
    pres.userData.key = key;
    if (presenter) outgoing.push({ g: presenter, t: 0 });
    presenter = pres;
    jumper.add(pres);
    if (reduced || !running) {
      pres.scale.setScalar(1);
      for (const o of outgoing) { jumper.remove(o.g); disposeTree(o.g); }
      outgoing = [];
      appear = null;
    } else {
      pres.scale.setScalar(0.001);
      appear = { t: 0 };
      boost = 1;
      spotKick = 0.6;
    }
  }

  function jump() {
    const ex = EXHIBITS[current];
    sound.bark(ex.pitch);
    sound.bark(ex.pitch * 1.18, 0.5);
    const src = isFs() ? fsDog : dogBtn;
    const r = src.getBoundingClientRect();
    fx.floatText('DOG!', r.left + r.width / 2, r.top, { count: 2 });
    if (mode === '2d') {
      const fig = stage.querySelector('.gl-fallback');
      if (fig && !reduced) { fig.classList.remove('is-jumping'); void fig.offsetWidth; fig.classList.add('is-jumping'); }
      return;
    }
    jumpAnim = { t: 0 };
    boost = 1;
    spotKick = 1;
    if (!running) renderOnce();
  }

  // ---------------------------------------------------------------- döngü
  function update(dt, dtA = dt) {
    // dt: sıkıştırılmış (toz, boşta animasyon), dtA: geçişler için gerçek zamana yakın adım
    clock += dt;
    const t = clock;
    // eser boşta animasyonu
    if (presenter && !reduced) {
      presenter.traverse((o) => { if (o.userData && typeof o.userData.tick === 'function') o.userData.tick(t); });
    }
    // eser değişiminde kamerayı öne döndür
    if (swing && controls) {
      swing.t += dtA;
      const p = Math.min(1, swing.t / swing.d);
      const a = swing.from + swing.delta * easeInOutCubic(p);
      const ox = camera.position.x - controls.target.x, oz = camera.position.z - controls.target.z;
      const r = Math.hypot(ox, oz);
      camera.position.x = controls.target.x + Math.sin(a) * r;
      camera.position.z = controls.target.z + Math.cos(a) * r;
      if (p >= 1) {
        swing = null;
        clearTimeout(resumeT);
        resumeT = setTimeout(() => { if (controls && !reduced) controls.autoRotate = true; }, 2500);
      }
    }
    // bakış noktası esere göre yumuşakça ayarlanır (uzun kuleler, alçak creep'ler)
    if (controls && Math.abs(controls.target.y - focusY) > 0.001) {
      const k = 1 - Math.exp(-dtA * 4);
      const dy = (focusY - controls.target.y) * k;
      controls.target.y += dy;
      camera.position.y += dy;
    }
    // çıkan eserler
    if (outgoing.length) {
      let freed = false;
      for (const o of outgoing) {
        o.t += dtA;
        const p = Math.min(1, o.t / 0.22);
        o.g.scale.setScalar(Math.max(0.001, 1 - p * p));
        o.g.rotation.y += dt * 9;
        if (p >= 1) { jumper.remove(o.g); disposeTree(o.g); o.dead = true; freed = true; }
      }
      outgoing = outgoing.filter((o) => !o.dead);
      if (freed) trimPool();
    }
    // giren eser
    if (appear && presenter) {
      appear.t += dtA;
      const p = clamp((appear.t - 0.14) / 0.7, 0, 1);
      presenter.scale.setScalar(Math.max(0.001, easeOutBack(p)));
      presenter.rotation.y = (1 - easeOutCubic(p)) * -1.8;
      if (p >= 1) appear = null;
    }
    // DOG! zıplaması
    if (jumpAnim) {
      jumpAnim.t += dtA;
      const D = reduced ? 0.5 : 1.0;
      const p = Math.min(1, jumpAnim.t / D);
      const H = reduced ? 0.1 : 0.65;
      let y = 0, sy = 1, rot = 0;
      if (p < 0.14) { sy = 1 - 0.16 * Math.sin((p / 0.14) * Math.PI / 2); }
      else if (p < 0.86) { const q = (p - 0.14) / 0.72; y = H * 4 * q * (1 - q); sy = 1 + 0.08 * Math.sin(q * Math.PI); rot = reduced ? 0 : easeInOutCubic(q) * Math.PI * 2; }
      else { const q = (p - 0.86) / 0.14; sy = 1 - 0.12 * Math.sin(q * Math.PI); rot = reduced ? 0 : Math.PI * 2; }
      const sx = 1 / Math.sqrt(sy);
      jumper.position.y = y;
      jumper.scale.set(sx, sy, sx);
      jumper.rotation.y = rot;
      if (p >= 1) { jumpAnim = null; jumper.position.y = 0; jumper.scale.set(1, 1, 1); jumper.rotation.y = 0; }
    }
    // ışık teması geçişi
    if (themeT < 1) {
      themeT = Math.min(1, themeT + dtA * 1.6);
      const k = 1 - Math.exp(-dtA * 7);
      spot.color.lerp(themeTargets.spot, k);
      rim.color.lerp(themeTargets.rim, k);
      cone.material.uniforms.uColor.value.lerp(themeTargets.cone, k);
      glow.material.color.lerp(themeTargets.glow, k);
      paintDust();
      if (themeT >= 1) {
        spot.color.copy(themeTargets.spot);
        rim.color.copy(themeTargets.rim);
        cone.material.uniforms.uColor.value.copy(themeTargets.cone);
        glow.material.color.copy(themeTargets.glow);
        paintDust();
      }
    }
    // spot titreşimi / vurgusu
    spotKick = Math.max(0, spotKick - dt * 1.8);
    const flicker = reduced ? 0 : Math.sin(t * 7.1) * 0.012 + Math.sin(t * 13.3) * 0.008;
    spot.intensity = 170 * (1 + flicker + spotKick * 0.45);
    cone.material.uniforms.uOpacity.value = 0.2 * (1 + flicker * 2 + spotKick * 0.8);
    // kor tozları
    boost = Math.max(0, boost - dt * 1.2);
    if (!reduced && dustData) {
      const { N, pos, spd, ph, respawn } = dustData;
      const mul = 1 + boost * 6;
      for (let i = 0; i < N; i++) {
        pos[i * 3 + 1] += spd[i] * dt * mul;
        pos[i * 3] += Math.sin(t * 0.6 + ph[i]) * 0.07 * dt;
        pos[i * 3 + 2] += Math.cos(t * 0.5 + ph[i]) * 0.05 * dt;
        if (pos[i * 3 + 1] > 4.9) respawn(i, false);
      }
      dustData.geo.attributes.position.needsUpdate = true;
    }
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const raw = Math.max(0.001, (now - lastT) / 1000);
    const dt = Math.min(0.05, raw);
    lastT = now;
    update(dt, Math.min(0.25, raw));
    controls.update(dt);
    renderer.render(scene, camera);
    // Uyarlanır kalite: 2 sn ortalaması ~28 fps altındaysa bir kademe düşür
    if (raw < 0.5) { perf.acc += raw; perf.n += 1; }
    if (perf.acc > 2) {
      if (clock > 1.5 && perf.acc / perf.n > 1 / 28 && tier < TIERS.length - 1) { tier += 1; applyTier(); }
      perf.acc = 0;
      perf.n = 0;
    }
  }

  function applyTier() {
    const T = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2, T.pr));
    if (!T.reflect && reflector) {
      scene.remove(reflector);
      reflector.dispose();
      reflector = null;
      floorMat.transparent = false;
      floorMat.opacity = 1;
      floorMat.needsUpdate = true;
    }
    if (spot.shadow.mapSize.x !== T.shadow) {
      spot.shadow.mapSize.set(T.shadow, T.shadow);
      if (spot.shadow.map) { spot.shadow.map.dispose(); spot.shadow.map = null; }
    }
    resize();
  }

  function renderOnce() {
    if (!renderer || lost || destroyed) return;
    controls.target.y = focusY;
    controls.update();
    renderer.render(scene, camera);
  }

  function setRunning() {
    const should = mode === '3d' && visible && !document.hidden && !destroyed && !lost && !!renderer;
    if (should && !running) {
      running = true;
      lastT = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!should && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  }

  function resize() {
    if (!renderer || mode !== '3d') return;
    const r = stage.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), hh = Math.max(1, Math.round(r.height));
    renderer.setSize(w, hh, false);
    const aspect = w / hh;
    camera.aspect = aspect;
    camera.fov = aspect < 1.15 ? Math.min(50, 36 * (1.15 / aspect)) : 36;
    camera.updateProjectionMatrix();
    if (reflector) {
      const pr = renderer.getPixelRatio();
      reflector.getRenderTarget().setSize(Math.max(256, Math.round(w * pr * 0.6)), Math.max(256, Math.round(hh * pr * 0.6)));
    }
    if (!running) renderOnce();
  }

  function teardownGL(forceLoss) {
    running = false;
    cancelAnimationFrame(raf);
    if (!renderer) return;
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('keydown', onCanvasKey);
    if (controls) {
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('end', onControlEnd);
      controls.dispose();
    }
    if (scene) {
      disposeTree(scene);
      for (const m of scene.userData.extraMats || []) m.dispose();
    }
    for (const o of outgoing) disposeTree(o.g);
    outgoing = [];
    banners.length = 0;
    ownTextures.forEach((t) => t.dispose());
    ownTextures.length = 0;
    if (reflector) reflector.dispose();
    if (envRT) envRT.dispose();
    renderer.dispose();
    if (forceLoss) {
      try { renderer.forceContextLoss(); } catch { /* yok say */ }
    }
    renderer = null;
    controls = null;
    presenter = null;
  }

  // ---------------------------------------------------------------- 2D yedek
  let fallbackImg = null;
  function mount2D() {
    mode = '2d';
    stage.classList.add('is-2d');
    canvas.remove();
    loadingEl.hidden = true;
    hint.remove();
    fallbackImg = h('img', { class: 'gl-fallback-img', alt: '', width: '512', height: '512' });
    stage.insertBefore(
      h('figure', { class: 'gl-fallback' },
        h('div', { class: 'gl-fallback-pedestal', 'aria-hidden': 'true' }),
        fallbackImg,
        h('figcaption', { class: 'xsmall' }, icon('info', { size: 14 }), 'WebGL kullanılamıyor: 3D yerine 2D önizleme'),
      ),
      stage.firstChild,
    );
    slotBtns.forEach((b) => { b.querySelector('.gl-slot-src').textContent = '2D önizleme'; });
    select2D(current);
  }

  function select2D(i) {
    const ex = EXHIBITS[i];
    markSlots();
    const arch = ex.fallbackArch ? byId(ex.fallbackArch) : null;
    fallbackImg.src = (ex.fallbackArt && art(ex.fallbackArt)) || (arch ? proceduralPortrait(arch, 512) : iconCard(ex, pal));
    fallbackImg.alt = `${ex.name} için 2D önizleme görseli`;
    renderPlaque(ex, '2d');
    live.textContent = `Seçilen eser: ${ex.name} (2D önizleme)`;
  }

  // ---------------------------------------------------------------- tam ekran
  // Fullscreen API varsa sahne gerçek tam ekrana geçer; yoksa (ör. iPhone Safari) sabit konumlu "sözde" tam ekran.
  let hotkeysOff = false;
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const isFs = () => fsElement() === stage || stage.classList.contains('is-pseudo-fs');
  async function enterFs() {
    const req = stage.requestFullscreen || stage.webkitRequestFullscreen;
    const enabled = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    if (req && enabled) {
      try {
        await req.call(stage);
        return;
      } catch { /* sözde tam ekrana düş */ }
    }
    stage.classList.add('is-pseudo-fs');
    document.documentElement.classList.add('gl-noscroll');
    onFsChange();
  }
  function exitFs() {
    if (stage.classList.contains('is-pseudo-fs')) {
      stage.classList.remove('is-pseudo-fs');
      document.documentElement.classList.remove('gl-noscroll');
      onFsChange();
      return;
    }
    if (fsElement() === stage) {
      const ex = document.exitFullscreen || document.webkitExitFullscreen;
      try { const p = ex && ex.call(document); if (p && p.catch) p.catch(() => {}); } catch { /* yok say */ }
    }
  }
  function toggleFs() {
    sound.whoosh();
    if (isFs()) exitFs();
    else enterFs();
  }
  function onFsChange() {
    if (destroyed) return;
    const on = isFs();
    stage.classList.toggle('is-fs', on);
    fsBtn.setAttribute('aria-pressed', String(on));
    fsBtn.setAttribute('aria-label', on ? 'Tam ekrandan çık' : 'Tam ekran');
    fsBtn.title = on ? 'Tam ekrandan çık (F / Esc)' : 'Tam ekran (F)';
    clear(fsBtn);
    fsBtn.appendChild(icon(on ? 'shrink' : 'expand', { size: 18 }));
    // Tam ekranda sitenin tek harfli kısayolları kapalı: T/F/… sahneden çıkarmasın
    if (on && !hotkeysOff) { ctx.hotkeys(false); hotkeysOff = true; }
    else if (!on && hotkeysOff) { ctx.hotkeys(true); hotkeysOff = false; }
    if (on) canvas.focus({ preventScroll: true });
    resize();
  }

  // ---------------------------------------------------------------- olaylar
  // Sayfa genelinde ← →: odak müzedeyken (ya da hiçbir yerde değilken) eser değiştirir.
  function onDocKey(e) {
    if (destroyed || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (document.querySelector('.modal-backdrop')) return;
    const inMuseum = t === document.body || t === document.documentElement || root.contains(t);
    if (!inMuseum || wingsEl.contains(t)) return;
    if ((e.key === 'f' || e.key === 'F') && (stage.contains(t) || isFs())) {
      e.preventDefault();
      e.stopPropagation(); // sitenin F kısayolu çalışmasın
      toggleFs();
      return;
    }
    if (e.key === 'Escape' && stage.classList.contains('is-pseudo-fs')) {
      e.preventDefault();
      exitFs();
      return;
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.shiftKey) {
      e.preventDefault();
      step(e.key === 'ArrowLeft' ? -1 : 1, { focusSlot: slotsEl.contains(t) });
    }
  }

  dogBtn.addEventListener('click', jump);
  fsDog.addEventListener('click', jump);
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  fsBtn.addEventListener('click', toggleFs);
  lightBtn.addEventListener('click', () => {
    themeIdx = (themeIdx + 1) % THEMES.length;
    ls.set('gl:light', THEMES[themeIdx].id);
    setLightUI();
    sound.whoosh();
    live.textContent = `Işık teması: ${THEMES[themeIdx].label}`;
    if (mode === '3d' && renderer) { applyTheme(false); if (!running) renderOnce(); }
  });
  document.addEventListener('visibilitychange', setRunning);
  document.addEventListener('keydown', onDocKey);
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  // ---------------------------------------------------------------- başlat
  setLightUI();
  markSlots();
  renderPlaque(EXHIBITS[current], modelAvailable(EXHIBITS[current].key) ? 'loading' : 'procedural');
  if (initGL()) {
    mode = '3d';
    io = new IntersectionObserver((ents) => { visible = ents.some((e) => e.isIntersecting); setRunning(); }, { threshold: 0.01 });
    io.observe(stage);
    ro = new ResizeObserver(() => resize());
    ro.observe(stage);
    resize();
    select(current);
    setRunning();
    // Cinzel yüklenince plakayı yeniden çiz
    try {
      document.fonts.load('700 44px Cinzel').then(() => { if (!destroyed && mode === '3d') { drawPlate(EXHIBITS[current]); if (!running) renderOnce(); } }).catch(() => {});
    } catch { /* yok say */ }
  } else {
    mount2D();
  }

  return () => {
    destroyed = true;
    selToken++;
    clearTimeout(resumeT);
    clearTimeout(preloadT);
    clearTimeout(veilT);
    document.removeEventListener('visibilitychange', setRunning);
    document.removeEventListener('keydown', onDocKey);
    document.removeEventListener('fullscreenchange', onFsChange);
    document.removeEventListener('webkitfullscreenchange', onFsChange);
    if (fsElement() === stage) exitFs();
    stage.classList.remove('is-pseudo-fs');
    document.documentElement.classList.remove('gl-noscroll');
    if (hotkeysOff) { ctx.hotkeys(true); hotkeysOff = false; }
    if (io) io.disconnect();
    if (ro) ro.disconnect();
    likes.destroy();
    teardownGL(true);
    pool.destroy();
    root.remove();
  };
}
