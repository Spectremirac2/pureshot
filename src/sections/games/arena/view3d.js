// 1vDOQUZ Arena 2.0 — three.js görüntüsü.
// Oyun durumunu (game.js) her karede okur; olaylardan parçacık/halka/sarsıntı üretir.
// Modeller tembel yüklenir: köpek, kuleler, seçili kahraman ve Aegis açılışta; creep/Roshan/kurye arka planda.

import * as THREE from 'three';
import { loadModel } from '../../../core/models.js';
import { artUrl } from '../../../core/assets.js';
import { ARENA_R, PLAY_R, GATE_ANGLES, GATES, FOUNTAIN, inRiver } from './map.js';
import { TYPE_IDS, archOf } from './dogs.js';
import { HEROES, HERO_IDS } from './heroes.js';
import { RUNES } from './items.js';
import * as TX from './textures.js';
import { Particles, Rings, ambientEmbers } from './fx3d.js';
import {
  Bin, makeGeoms, DogRig, Label, HeroRig, UnitRig, TowerRig, CourierRig, MODEL_YAW, cloneModel,
  buildAegis, buildRapier, buildArrow, buildRune, buildCheese, buildProj,
} from './actors.js';
import { buildMap } from './map3d.js';

const PITCH = (57 * Math.PI) / 180;
const FOV = 40;

/** Model yükseklikleri (dünya birimi). Kahramanlarınki heroes.js'ten gelir. */
export const MODEL_H = {
  'model-dog': 0.9,
  'model-aegis': 2.3,
  'model-creep-melee': 0.95,
  'model-creep-ranged': 0.95,
  'model-roshan': 3.0,
  'model-tower-radiant': 3.6,
  'model-tower-dire': 3.6,
  'model-courier': 1.0,
  ...Object.fromEntries(HERO_IDS.map((id) => [HEROES[id].model, HEROES[id].height])),
};

export async function createView3D(opts = {}) {
  // WebGL oluşturma başarısızsa hata fırlatır; çağıran 2D yedeğe geçer.
  const renderer = new THREE.WebGLRenderer({ antialias: !opts.mobile, powerPreference: 'high-performance', alpha: false });
  try {
    if (!renderer.getContext()) throw new Error('WebGL yok');
    return await buildView(renderer, opts);
  } catch (err) {
    try { renderer.dispose(); renderer.forceContextLoss(); } catch { /* yok say */ }
    throw err;
  }
}

async function buildView(renderer, { mobile = false, reduced = false, heroId = 'okcu' } = {}) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  const shadows = !mobile;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;

  const bin = new Bin();
  const C = (name, fb) => new THREE.Color(TX.tok(name, fb));
  const col = {
    bg: C('--bg', '#0d0b14'),
    ember: C('--ember', '#ff6a2b'),
    ember2: C('--ember-2', '#ff9a3d'),
    gold: C('--aegis', '#e9b949'),
    gold2: C('--aegis-2', '#f6d98a'),
    jade: C('--radiant', '#43d6a0'),
    dire: C('--dire', '#e0354b'),
    arcane: C('--arcane', '#8b7cff'),
    text: C('--text', '#f3eadb'),
    white: new THREE.Color('#ffffff'),
    ice: new THREE.Color('#9fe8ff'),
    ice2: new THREE.Color('#e8fbff'),
    shadow: new THREE.Color('#b18cff'),
    smoke: new THREE.Color('#6d6480'),
    blood: new THREE.Color('#ff3040'),
    water: new THREE.Color('#bfeaff'),
  };
  const typeColors = Object.fromEntries(TYPE_IDS.map((id) => [id, new THREE.Color(archOf(id).color)]));

  const scene = new THREE.Scene();
  scene.background = col.bg.clone();
  scene.fog = new THREE.FogExp2(new THREE.Color('#130f1d'), 0.015);
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.3, 140);

  // ---------------------------------------------------------------- dokular
  const tex = {
    glow: bin.add(TX.toTexture(TX.glowCanvas(128))),
    flame: bin.add(TX.toTexture(TX.flameCanvas())),
    ring: bin.add(TX.toTexture(TX.ringCanvas(256))),
    dashRing: bin.add(TX.toTexture(TX.ringCanvas(256, { dashed: true, width: 0.09 }))),
    thinRing: bin.add(TX.toTexture(TX.ringCanvas(256, { width: 0.04 }))),
    line: bin.add(TX.toTexture(TX.chargeLineCanvas())),
    beam: bin.add(TX.toTexture(TX.beamCanvas())),
    report: bin.add(TX.toTexture(TX.reportCanvas())),
    bannerR: bin.add(TX.toTexture(TX.bannerCanvas(128, 256, 'radiant'))),
    bannerD: bin.add(TX.toTexture(TX.bannerCanvas(128, 256, 'dire'))),
    wall: bin.add(TX.toTexture(TX.wallCanvas(), { repeat: [7, 1] })),
    rock: bin.add(TX.toTexture(TX.rockCanvas(), { repeat: [18, 18] })),
  };

  // ---------------------------------------------------------------- modeller (tembel)
  // Model önbelleğine (core/models.js) ait kaynaklar başka bölümlerce de kullanılır: dispose etme, değiştirme.
  const MAP_KEYS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap'];
  const shared = new Set();
  const models = {};
  const loading = new Map();
  let disposed = false;
  const onModel = [];
  const safe = (p) => Promise.race([
    Promise.resolve(p).catch(() => null),
    new Promise((res) => setTimeout(() => res(null), 12000)),
  ]);
  function markShared(m) {
    m.traverse((o) => {
      if (o.geometry) shared.add(o.geometry);
      if (o.material) {
        for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
          shared.add(mat);
          for (const k of MAP_KEYS) if (mat[k]) shared.add(mat[k]);
        }
      }
    });
  }
  function want(key) {
    if (!loading.has(key)) {
      loading.set(key, safe(loadModel(key, { height: MODEL_H[key] || 1 })).then((m) => {
        if (disposed) return null;
        if (m) { markShared(m); models[key] = m; for (const fn of onModel) fn(key, m); }
        else models[key] = null;
        return m;
      }));
    }
    return loading.get(key);
  }
  const heroModelKey = (id) => (HEROES[id] || HEROES.okcu).model;
  await Promise.all([want('model-dog'), want('model-tower-radiant'), want('model-tower-dire'), want('model-aegis'), want(heroModelKey(heroId))]);
  const aegisModel = models['model-aegis'] || null;

  const G = makeGeoms(bin);
  const kit = {
    G, bin, shadows, models,
    get dogModel() { return models['model-dog'] || null; },
    archerModel: null,
    glowTex: tex.glow, ringTex: tex.ring, dashRingTex: tex.dashRing, beamTex: tex.beam, trailTex: tex.beam,
    typeColor: (id) => typeColors[id] || col.ember,
    execColor: new THREE.Color('#ffb020'),
    iceMat: bin.add(new THREE.MeshStandardMaterial({ color: '#bfefff', emissive: '#3aa8e0', emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.55, flatShading: true, depthWrite: false })),
    arrowMats: {
      wood: bin.add(new THREE.MeshStandardMaterial({ color: '#8a5a2b', roughness: 0.6 })),
      head: bin.add(new THREE.MeshStandardMaterial({ color: '#e7e1d6', roughness: 0.2, metalness: 0.9, emissive: col.ember, emissiveIntensity: 0.4 })),
      fletch: bin.add(new THREE.MeshBasicMaterial({ color: col.ember, side: THREE.DoubleSide })),
    },
  };

  // ---------------------------------------------------------------- ışıklar
  scene.add(new THREE.HemisphereLight(new THREE.Color('#8f86c8'), new THREE.Color('#2a1a12'), 1.25));
  const moon = new THREE.DirectionalLight(new THREE.Color('#d6ccff'), 1.7);
  moon.position.set(-9, 20, 7);
  moon.target.position.set(0, 0, 0);
  if (shadows) {
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const sc = moon.shadow.camera;
    sc.left = -17; sc.right = 17; sc.top = 17; sc.bottom = -17; sc.near = 2; sc.far = 55;
    moon.shadow.bias = -0.0006;
    moon.shadow.normalBias = 0.03;
  }
  scene.add(moon, moon.target);

  const gateLight = { [GATES.br]: '#ffb070', [GATES.tr]: '#ff7a55', [GATES.tl]: '#c0a0ff', [GATES.bl]: '#b8ffd6' };
  const torchLights = [];
  for (const a of GATE_ANGLES) {
    const base = a === GATES.tr ? 22 : 30;
    const L = new THREE.PointLight(new THREE.Color(gateLight[a] || '#ff9a3d'), base, 15, 1.7);
    L.position.set(Math.sin(a) * (ARENA_R - 0.6), 2.9, Math.cos(a) * (ARENA_R - 0.6));
    scene.add(L);
    torchLights.push({ L, base, seed: Math.random() * 10 });
  }
  const heroLight = new THREE.PointLight(new THREE.Color('#ffe2bf'), mobile ? 0 : 7, 7, 2);
  if (!mobile) scene.add(heroLight);
  const fxLight = new THREE.PointLight(col.ember, 0, 18, 1.6);
  scene.add(fxLight);
  let flash = 0;
  const flashPos = new THREE.Vector3();
  const flashCol = new THREE.Color();

  // ---------------------------------------------------------------- arena
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.race([
        Promise.all([document.fonts.load('800 24px Unbounded'), document.fonts.load('900 24px Unbounded')]),
        new Promise((res) => setTimeout(res, 1500)),
      ]);
    }
  } catch { /* yok say */ }
  const floorTexKey = artUrl('texture-arena');
  const fc = TX.floorCanvases(mobile ? 1024 : 2048, { withStones: !floorTexKey });
  const floorMap = bin.add(TX.toTexture(fc.map));
  const floorGlow = bin.add(TX.toTexture(fc.glow));
  const floorMat = bin.add(new THREE.MeshStandardMaterial({
    map: floorMap, emissiveMap: floorGlow, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.9, roughness: 0.92, metalness: 0.02,
  }));
  if (floorTexKey) {
    new THREE.TextureLoader().load(floorTexKey, (t) => {
      if (disposed) { t.dispose(); return; }
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(4, 4);
      t.anisotropy = 8;
      bin.add(t);
      floorMat.map = t;
      floorMat.color.set('#b7aec4');
      floorMat.needsUpdate = true;
    });
  }
  const floor = new THREE.Mesh(bin.add(new THREE.CircleGeometry(ARENA_R + 0.6, 96)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = shadows;
  scene.add(floor);

  const outside = new THREE.Mesh(bin.add(new THREE.CircleGeometry(70, 48)), bin.add(new THREE.MeshStandardMaterial({ map: tex.rock, roughness: 1, color: '#5f6a58' })));
  outside.rotation.x = -Math.PI / 2;
  outside.position.y = -0.03;
  outside.receiveShadow = shadows;
  scene.add(outside);

  const wallMat = bin.add(new THREE.MeshStandardMaterial({ map: tex.wall, roughness: 0.95, side: THREE.DoubleSide }));
  const capMat = bin.add(new THREE.MeshStandardMaterial({ color: '#2a2336', roughness: 0.9 }));
  const bannerMats = {
    radiant: bin.add(new THREE.MeshStandardMaterial({ map: tex.bannerR, transparent: true, side: THREE.DoubleSide, roughness: 0.9, emissive: col.jade, emissiveIntensity: 0.08 })),
    dire: bin.add(new THREE.MeshStandardMaterial({ map: tex.bannerD, transparent: true, side: THREE.DoubleSide, roughness: 0.9, emissive: col.dire, emissiveIntensity: 0.08 })),
  };
  const gap = 0.17;
  const WR = ARENA_R + 0.35;
  for (let i = 0; i < GATE_ANGLES.length; i++) {
    const a0 = GATE_ANGLES[i] + gap;
    const a1 = GATE_ANGLES[(i + 1) % GATE_ANGLES.length] + (i === GATE_ANGLES.length - 1 ? Math.PI * 2 : 0) - gap;
    const wall = new THREE.Mesh(bin.add(new THREE.CylinderGeometry(WR, WR, 1.3, 40, 1, true, a0, a1 - a0)), wallMat);
    wall.position.y = 0.65;
    wall.receiveShadow = shadows;
    scene.add(wall);
    const capGeo = bin.add(new THREE.RingGeometry(WR - 0.02, WR + 0.8, 40, 1, a0 - Math.PI / 2, a1 - a0));
    capGeo.rotateX(-Math.PI / 2);
    capGeo.scale(1, 1, -1);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 1.3;
    scene.add(cap);
    const am = (a0 + a1) / 2;
    const bx = Math.sin(am) * (WR - 0.08);
    const bz = Math.cos(am) * (WR - 0.08);
    const banner = new THREE.Mesh(G.plane, bx - bz > 0 ? bannerMats.dire : bannerMats.radiant);
    banner.scale.set(1.0, 2.0, 1);
    banner.position.set(bx, 1.25, bz);
    banner.rotation.y = am + Math.PI;
    scene.add(banner);
  }
  const pillarGeo = bin.add(new THREE.CylinderGeometry(0.34, 0.44, 2.9, 8));
  const bowlGeo = bin.add(new THREE.CylinderGeometry(0.42, 0.22, 0.32, 10));
  const lintelGeo = bin.add(new THREE.BoxGeometry(3.4, 0.38, 0.6));
  const pillarMat = bin.add(new THREE.MeshStandardMaterial({ color: '#332b40', roughness: 0.9 }));
  const bowlMat = bin.add(new THREE.MeshStandardMaterial({ color: '#1b1520', roughness: 0.4, metalness: 0.7 }));
  const flameMat = bin.add(new THREE.SpriteMaterial({ map: tex.flame, color: col.ember2, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const flameGlowMat = bin.add(new THREE.SpriteMaterial({ map: tex.glow, color: col.ember, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
  const flames = [];
  for (const a of GATE_ANGLES) {
    for (const s of [-1, 1]) {
      const pa = a + s * 0.2;
      const x = Math.sin(pa) * (WR + 0.1);
      const z = Math.cos(pa) * (WR + 0.1);
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(x, 1.45, z);
      pillar.castShadow = shadows;
      scene.add(pillar);
      const bowl = new THREE.Mesh(bowlGeo, bowlMat);
      bowl.position.set(x, 3.05, z);
      scene.add(bowl);
      const f = new THREE.Sprite(flameMat);
      f.position.set(x, 3.55, z);
      f.scale.set(0.8, 1.3, 1);
      scene.add(f);
      const fg = new THREE.Sprite(flameGlowMat);
      fg.position.set(x, 3.4, z);
      fg.scale.set(2.6, 2.6, 1);
      scene.add(fg);
      flames.push({ f, fg, seed: Math.random() * 20 });
    }
    const lintel = new THREE.Mesh(lintelGeo, pillarMat);
    lintel.position.set(Math.sin(a) * (WR + 0.1), 2.75, Math.cos(a) * (WR + 0.1));
    lintel.rotation.y = a + Math.PI / 2;
    lintel.castShadow = shadows;
    scene.add(lintel);
  }
  // uzak kaya sivrileri
  {
    const spireGeo = bin.add(new THREE.ConeGeometry(1, 1, 5));
    const spireMat = bin.add(new THREE.MeshStandardMaterial({ color: '#1d1726', roughness: 1, flatShading: true }));
    const n = mobile ? 18 : 30;
    const inst = new THREE.InstancedMesh(spireGeo, spireMat, n);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const rnd = (() => { let s = 99; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 26 + rnd() * 20;
      const hgt = 4 + rnd() * 12;
      const rad = 1 + rnd() * 2.6;
      q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.2, rnd() * 3, (rnd() - 0.5) * 0.2));
      m4.compose(new THREE.Vector3(Math.sin(a) * r, hgt / 2 - 0.2, Math.cos(a) * r), q, new THREE.Vector3(rad, hgt, rad));
      inst.setMatrixAt(i, m4);
    }
    scene.add(inst);
  }
  const map = buildMap(scene, { bin, mobile, shadows, glowTex: tex.glow, ringTex: tex.ring });

  // ---------------------------------------------------------------- göstergeler
  const flatMat = (texture, color, opacity = 1, additive = true) => bin.add(new THREE.MeshBasicMaterial({
    map: texture, color, transparent: true, opacity, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
  const flat = (mat, size, y = 0.05) => {
    const m = new THREE.Mesh(G.plane, mat);
    m.rotation.x = -Math.PI / 2;
    m.scale.setScalar(size);
    m.position.y = y;
    m.renderOrder = 3;
    scene.add(m);
    return m;
  };
  const playerRing = flat(flatMat(tex.ring, col.jade, 0.75), 1.3, 0.05);
  const windRing = flat(flatMat(tex.dashRing, col.jade, 0.9), 1.9, 0.06);
  const aegisRing = flat(flatMat(tex.thinRing, col.gold, 0.8), 1.6, 0.055);
  const targetRing = flat(flatMat(tex.dashRing, col.dire, 0.95), 1.4, 0.065);
  const reticle = flat(flatMat(tex.dashRing, col.ember2, 0.9), 0.8, 0.07);
  const reticleDot = flat(flatMat(tex.glow, col.ember2, 0.9), 0.35, 0.07);
  const fieldRing = flat(flatMat(tex.dashRing, col.ice, 0.6), 9.6, 0.08);
  const burnRing = flat(flatMat(tex.thinRing, col.ember, 0.35), 6.4, 0.06);
  const teleRing = flat(flatMat(tex.ring, col.blood, 0.8), 1, 0.09);
  const teleFill = flat(flatMat(tex.glow, col.blood, 0.4), 1, 0.085);
  const lineGeo = bin.add(new THREE.PlaneGeometry(1, 1));
  lineGeo.rotateX(-Math.PI / 2);
  lineGeo.rotateY(-Math.PI / 2);
  lineGeo.translate(0, 0, 0.5);
  const lineMat = flatMat(tex.line, col.ember, 0.7);
  const chargeLine = new THREE.Mesh(lineGeo, lineMat);
  chargeLine.position.y = 0.08;
  chargeLine.renderOrder = 4;
  scene.add(chargeLine);

  // ---------------------------------------------------------------- kahraman
  // Kahraman rig'leri kahraman başına bir kez kurulur (seçim ekranında gezinmek yeni malzeme üretmesin)
  const heroRigs = {};
  let hero = heroRigs[heroId] = new HeroRig(kit, heroId);
  scene.add(hero.root);
  function setHero(id) {
    if (hero && hero.heroId === id) return;
    if (hero) scene.remove(hero.root);
    hero = heroRigs[id] || (heroRigs[id] = new HeroRig(kit, id));
    scene.add(hero.root);
    const key = heroModelKey(id);
    if (!(key in models)) want(key);
  }
  const buffGlowMat = bin.add(new THREE.SpriteMaterial({ map: tex.glow, color: col.gold, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  const buffGlow = new THREE.Sprite(buffGlowMat);
  buffGlow.scale.set(1.6, 1.6, 1);
  scene.add(buffGlow);

  // ---------------------------------------------------------------- efekt havuzları
  const parts = new Particles(mobile ? 700 : 1200);
  scene.add(parts.points);
  const rings = new Rings(scene, tex.ring, 14);
  const ambient = { rate: mobile ? 8 : 18, c1: col.ember2, c2: col.gold };

  // köpek teçhizatı havuzu
  const rigFree = [];
  const rigById = new Map();
  function acquireRig(d) {
    const rig = rigFree.pop() || new DogRig(kit);
    rig.setType(d.type, d.elite);
    scene.add(rig.root);
    scene.add(rig.labelGroup);
    rigById.set(d.id, rig);
    return rig;
  }
  function releaseRig(id) {
    const rig = rigById.get(id);
    if (!rig) return;
    scene.remove(rig.root);
    scene.remove(rig.labelGroup);
    rigById.delete(id);
    rigFree.push(rig);
  }
  // creep / Roshan
  const unitFree = { 'model-creep-melee': [], 'model-creep-ranged': [], 'model-roshan': [] };
  const unitById = new Map();
  const unitKey = (e) => (e.kind === 'boss' ? 'model-roshan' : e.type === 'ranged' ? 'model-creep-ranged' : 'model-creep-melee');
  function acquireUnit(e) {
    const key = unitKey(e);
    if (!(key in models)) want(key);
    const rig = unitFree[key].pop() || new UnitRig(kit, key, key === 'model-creep-ranged' ? 'creep-ranged' : 'creep-melee');
    if (!rig.procedural && !models[key]) rig.setModel(null);
    if (rig.procedural && models[key]) rig.setModel(models[key]);
    scene.add(rig.root);
    scene.add(rig.barGroup);
    unitById.set(e.id, rig);
    if (key === 'model-roshan') {
      if (!rig.label) { rig.label = new Label(bin); rig.labelGroup = new THREE.Group(); rig.labelGroup.add(rig.label.sprite); }
      scene.add(rig.labelGroup);
    }
    return rig;
  }
  function releaseUnit(id) {
    const rig = unitById.get(id);
    if (!rig) return;
    scene.remove(rig.root);
    scene.remove(rig.barGroup);
    if (rig.labelGroup) scene.remove(rig.labelGroup);
    unitById.delete(id);
    unitFree[rig.key].push(rig);
  }
  // kuleler
  const towerById = new Map();
  function syncTowers(g) {
    const ids = new Set();
    for (const t of g.towers) {
      ids.add(t.id);
      if (!towerById.has(t.id)) {
        const rig = new TowerRig(kit, t);
        scene.add(rig.root, rig.barGroup);
        if (rig.range) scene.add(rig.range);
        towerById.set(t.id, rig);
      }
    }
    for (const [id, rig] of towerById) {
      if (!ids.has(id)) {
        scene.remove(rig.root, rig.barGroup);
        if (rig.range) scene.remove(rig.range);
        towerById.delete(id);
        retired.push(rig);
      }
    }
  }
  const retired = [];
  // kurye
  let courier = null;
  onModel.push((key, m) => {
    for (const r of Object.values(heroRigs)) if (key === heroModelKey(r.heroId) && r.procedural) r.setModel(m);
    if (key === 'model-courier' && courier) courier.setModel(m);
    if (key.startsWith('model-tower')) for (const r of towerById.values()) if (r.key === key && r.procedural) r.setModel(m);
    if (unitFree[key]) {
      for (const r of unitById.values()) if (r.key === key && r.procedural) r.setModel(m);
      for (const r of unitFree[key]) if (r.procedural) r.setModel(m);
    }
  });

  const arrowFree = [];
  const arrowById = new Map();
  function arrowMesh(a) {
    let m = arrowById.get(a.id);
    if (m) return m;
    m = arrowFree.pop() || buildArrow(kit);
    if (!m.root.parent) scene.add(m.root);
    m.root.visible = true;
    const c = a.rapier ? col.gold : a.full ? col.gold2 : col.ember2;
    m.glowMat.color.copy(c);
    m.trailMat.color.copy(a.rapier ? col.gold : col.ember);
    const k = 0.25 + a.charge * 0.9;
    m.glow.scale.set(k * 1.2, k * 1.2, 1);
    m.glowMat.opacity = 0.35 + a.charge * 0.6;
    m.trail.scale.set(0.12 + a.charge * 0.4, 0.6 + a.charge * 3.2, 1);
    m.trail.position.z = -(0.6 + a.charge * 3.2) / 2;
    m.trailMat.opacity = 0.25 + a.charge * 0.7;
    m.root.scale.setScalar(1 + a.charge * 0.6);
    arrowById.set(a.id, m);
    return m;
  }
  const projFree = {};
  const projById = new Map();

  const bubbleMat = bin.add(new THREE.SpriteMaterial({ map: tex.report, transparent: true, depthWrite: false }));
  const bubbleFree = [];
  const bubbleById = new Map();

  const rapierById = new Map();
  const rapierFree = [];
  const cheeseById = new Map();
  const cheeseFree = [];
  const runeById = new Map();
  const runeFree = [];
  let aegisObj = null;
  let aegisT = 0;
  let aegisOnField = false;

  // ---------------------------------------------------------------- kamera
  const cam = { x: 0, z: 0, yaw: 0.5, dist: 22, zoom: 1, shake: 0, lookX: 0, lookZ: 0, pitch: PITCH, ty: 0.4 };
  let frame = { mode: 'play', side: 'right' };
  let W = 16;
  let H = 9;
  let time = 0;

  function resize(w, h) {
    W = Math.max(1, w);
    H = Math.max(1, h);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    const t = Math.tan((FOV * Math.PI) / 360);
    const portrait = W / H < 0.9;
    const halfW = portrait ? 6.4 : 9.4;
    const halfH = portrait ? 11 : 6.4;
    cam.dist = Math.max(halfH / t, halfW / (t * camera.aspect));
    camera.far = cam.dist + 90;
    camera.updateProjectionMatrix();
    parts.setScale((renderer.getDrawingBufferSize(new THREE.Vector2()).y) / (2 * t));
  }

  const v3 = new THREE.Vector3();
  function project(x, y, z) {
    v3.set(x, y, z).project(camera);
    return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H, ndcX: v3.x, ndcY: v3.y, behind: v3.z > 1 };
  }
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  function groundAt(px, py) {
    ndc.set((px / W) * 2 - 1, -(py / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const r = ray.ray.intersectPlane(ground, hit);
    return r ? { x: hit.x, z: hit.z } : null;
  }

  function shake(a) {
    if (reduced) return;
    cam.shake = Math.min(1.2, cam.shake + a);
  }
  function setFlash(x, y, z, c, v) {
    flashPos.set(x, y, z);
    flashCol.copy(c);
    flash = Math.max(flash, v);
  }

  // ---------------------------------------------------------------- olaylar
  function event(type, d, g) {
    const p = g.player;
    switch (type) {
      case 'reset':
        parts.clear();
        rings.clear();
        for (const id of [...rigById.keys()]) releaseRig(id);
        for (const id of [...unitById.keys()]) releaseUnit(id);
        for (const [id, m] of arrowById) { m.root.visible = false; arrowFree.push(m); arrowById.delete(id); }
        for (const [id, s] of bubbleById) { scene.remove(s); bubbleFree.push(s); bubbleById.delete(id); }
        for (const [id, r] of rapierById) { scene.remove(r.root); rapierFree.push(r); rapierById.delete(id); }
        for (const [id, r] of cheeseById) { scene.remove(r.root); cheeseFree.push(r); cheeseById.delete(id); }
        for (const [id, r] of runeById) { scene.remove(r.root); runeFree.push(r); runeById.delete(id); }
        for (const [id, pr] of projById) { pr.root.visible = false; (projFree[pr.kind] ||= []).push(pr); projById.delete(id); }
        if (aegisObj) aegisObj.root.visible = false;
        aegisOnField = false;
        syncTowers(g);
        break;
      case 'heroChange':
        setHero(d.heroId);
        break;
      case 'runStart':
        // arka planda: creep'ler, kurye; Roshan dalga 3'ten önce
        want('model-creep-melee');
        want('model-creep-ranged');
        want('model-courier');
        setTimeout(() => { if (!disposed) want('model-roshan'); }, 4000);
        break;
      case 'waveStart':
        if (d.wave >= 3) want('model-roshan');
        break;
      case 'spawn': {
        const e = d.foe || d.dog;
        if (d.quiet) break;
        if (e.kind === 'boss') {
          rings.fire(e.x, e.z, { color: col.ember, r0: 0.5, r1: 4.5, dur: 1.2 });
          parts.burst(reduced ? 10 : 40, { x: e.x, z: e.z, y: 0.3, color: [col.ember, col.gold, col.white], speed: 5, up: 6, g: 9, life: 1.2, size: 0.35 });
          shake(0.5);
          break;
        }
        const c = e.kind === 'creep' ? col.dire : typeColors[e.type];
        rings.fire(e.x, e.z, { color: c, r0: 0.3, r1: 1.8, dur: 0.6 });
        parts.burst(reduced ? 6 : 14, { x: e.x, z: e.z, y: 0.3, color: [c, col.arcane], speed: 2.2, up: 3, life: 0.8, size: 0.22 });
        break;
      }
      case 'shoot': {
        const a = d.arrow;
        parts.burst(a.full ? 18 : 5, { x: a.x, z: a.z, y: 1.0, color: [col.ember2, col.gold2], speed: a.full ? 4 : 1.5, up: 1, life: 0.35, size: 0.16, dirX: a.dx * 3, dirZ: a.dz * 3, floor: false });
        if (a.full) {
          rings.fire(p.x, p.z, { color: col.gold, r0: 0.4, r1: 2.2, dur: 0.4 });
          shake(0.12);
        }
        break;
      }
      case 'hit': {
        const e = d.foe;
        const c = e.kind === 'dog' ? typeColors[e.type] : e.kind === 'boss' ? col.gold : col.dire;
        const n = reduced ? 4 : d.big ? 20 : 8;
        parts.burst(n, { x: e.x, z: e.z, y: e.kind === 'boss' ? 1.5 : 0.55, color: [c, col.white, col.ember2], speed: d.big ? 5 : 3, up: 2.5, g: 9, life: 0.5, size: 0.18 });
        if (d.src === 'ult') parts.burst(6, { x: e.x, z: e.z, y: 0.2, color: col.ember, speed: 1.5, up: 0.6, life: 0.7, size: 0.35 });
        break;
      }
      case 'kill': {
        const e = d.foe;
        const c = e.kind === 'dog' ? typeColors[e.type] : e.kind === 'boss' ? col.gold : col.dire;
        rings.fire(e.x, e.z, { color: c, r0: 0.3, r1: e.kind === 'boss' ? 5 : 1.6, dur: e.kind === 'boss' ? 1.2 : 0.5 });
        parts.burst(reduced ? 8 : e.kind === 'boss' ? 70 : 24, { x: e.x, z: e.z, y: 0.5, color: [c, col.gold, col.gold2], speed: e.kind === 'boss' ? 7 : 4, up: e.kind === 'boss' ? 8 : 5, g: 10, life: 0.9, size: 0.22 });
        if (d.lastHit && e.kind === 'creep') parts.burst(6, { x: e.x, z: e.z, y: 1.1, color: col.gold, speed: 1.5, up: 3, life: 0.7, size: 0.2 });
        if (e.kind === 'boss') { shake(0.8); setFlash(e.x, 3, e.z, col.gold, 90); }
        break;
      }
      case 'multikill':
        rings.fire(p.x, p.z, { color: col.gold, r0: 0.5, r1: 4, dur: 0.7 });
        shake(0.15);
        break;
      case 'hurt':
        parts.burst(reduced ? 4 : 9, { x: p.x, z: p.z, y: 0.9, color: [col.dire, col.white], speed: 3, up: 2, g: 8, life: 0.45, size: 0.16 });
        shake(Math.min(0.4, d.dmg / 150));
        break;
      case 'evade':
        parts.burst(6, { x: p.x, z: p.z, y: 0.8, color: col.jade, speed: 2, up: 1, life: 0.4, size: 0.2 });
        break;
      case 'windrun':
        rings.fire(p.x, p.z, { color: col.jade, r0: 0.4, r1: 2.6, dur: 0.5 });
        parts.burst(reduced ? 6 : 20, { x: p.x, z: p.z, y: 0.3, color: [col.jade, col.white], speed: 3.5, up: 1.5, life: 0.6, size: 0.2 });
        break;
      case 'tango':
      case 'itemHeal':
        rings.fire(p.x, p.z, { color: col.jade, r0: 0.3, r1: 1.6, dur: 0.6 });
        break;
      case 'tangoStolen':
      case 'goldStolen':
        parts.burst(10, { x: p.x, z: p.z, y: 0.8, color: [col.jade, col.gold], speed: 2.5, up: 3, life: 0.6, size: 0.2 });
        break;
      case 'ult': {
        rings.fire(d.x, d.z, { color: col.ember, r0: 0.5, r1: d.radius, dur: 0.7, alpha: 1 });
        rings.fire(d.x, d.z, { color: col.gold, r0: 0.3, r1: d.radius * 0.75, dur: 0.9, alpha: 0.8 });
        rings.fire(d.x, d.z, { color: col.dire, r0: 0.2, r1: d.radius * 1.1, dur: 1.1, alpha: 0.5 });
        if (!reduced) {
          for (let i = 0; i < 48; i++) {
            const a = (i / 48) * Math.PI * 2;
            parts.spawn({ x: d.x + Math.sin(a) * 0.6, z: d.z + Math.cos(a) * 0.6, y: 0.2, vx: Math.sin(a) * 11, vz: Math.cos(a) * 11, vy: 1.5, drag: 2.5, life: 0.7, size: 0.45, size1: 0.1, color: i % 2 ? col.ember : col.gold });
          }
        }
        setFlash(d.x, 2.5, d.z, col.ember, 90);
        shake(0.75);
        break;
      }
      case 'fx':
        fxEvent(d, g);
        break;
      case 'waveClear':
        rings.fire(p.x, p.z, { color: col.gold, r0: 0.5, r1: 7, dur: 1.2 });
        if (!reduced) {
          const cols = [col.ember, col.gold, col.gold2, col.jade, col.dire, col.text];
          for (let i = 0; i < 80; i++) {
            parts.spawn({ x: p.x + (Math.random() - 0.5) * 1.5, z: p.z + (Math.random() - 0.5) * 1.5, y: 1.5, vx: (Math.random() - 0.5) * 9, vz: (Math.random() - 0.5) * 9, vy: 6 + Math.random() * 6, g: 9, drag: 0.6, life: 2 + Math.random(), size: 0.22, size1: 0.14, color: cols[i % cols.length] });
          }
        }
        break;
      case 'pickup': {
        const k = d.pickup;
        const c = k.kind === 'cheese' ? col.gold2 : col.gold;
        rings.fire(k.x, k.z, { color: c, r0: 0.4, r1: 3, dur: 0.7 });
        parts.burst(reduced ? 8 : 30, { x: k.x, z: k.z, y: 1, color: [col.gold, col.gold2, col.white], speed: 4, up: 4, life: 0.9, size: 0.2 });
        break;
      }
      case 'drop':
        rings.fire(d.pickup.x, d.pickup.z, { color: col.gold, r0: 0.3, r1: 1.8, dur: 0.6 });
        break;
      case 'aegisUsed':
        rings.fire(p.x, p.z, { color: col.gold, r0: 0.3, r1: 5, dur: 1.2 });
        shake(0.4);
        break;
      case 'revive':
        rings.fire(p.x, p.z, { color: col.gold, r0: 0.5, r1: 6, dur: 0.8 });
        parts.burst(reduced ? 10 : 40, { x: p.x, z: p.z, y: 0.5, color: [col.gold, col.gold2, col.white], speed: 5, up: 6, life: 1, size: 0.24 });
        break;
      case 'death':
        parts.burst(reduced ? 8 : 30, { x: p.x, z: p.z, y: 0.8, color: [col.dire, col.ember], speed: 3, up: 3, life: 1, size: 0.25 });
        shake(0.5);
        break;
      case 'bubbleHit':
        parts.burst(10, { x: p.x, z: p.z, y: 1.1, color: [col.dire, col.white], speed: 2.5, up: 2, life: 0.5, size: 0.2 });
        break;
      case 'dash':
        rings.fire(d.dog.x, d.dog.z, { color: col.dire, r0: 0.3, r1: 1.4, dur: 0.35 });
        break;
      case 'farmTick':
        parts.spawn({ x: d.dog.x, z: d.dog.z, y: 1.2, vx: 0, vz: 0, vy: 1.4, life: 0.8, size: 0.28, size1: 0.12, color: col.gold, floor: false });
        break;
      case 'farmDone':
        rings.fire(d.dog.x, d.dog.z, { color: col.gold, r0: 0.3, r1: 2.5, dur: 0.6 });
        break;
      case 'wake':
        parts.burst(8, { x: d.foe.x, z: d.foe.z, y: 1, color: col.white, speed: 1.5, up: 2, life: 0.4, size: 0.14 });
        break;
      case 'roshanSlam':
        rings.fire(d.x, d.z, { color: col.ember, r0: 0.5, r1: d.r + 0.5, dur: 0.5, alpha: 1 });
        rings.fire(d.x, d.z, { color: col.white, r0: 0.3, r1: d.r, dur: 0.35, alpha: 0.6 });
        parts.burst(reduced ? 10 : 50, { x: d.x, z: d.z, y: 0.2, color: [col.text, col.ember2, new THREE.Color('#8a7a6a')], speed: 7, up: 3, g: 10, life: 0.9, size: 0.35, spread: 1.5 });
        shake(0.7);
        setFlash(d.x, 2, d.z, col.ember, 60);
        break;
      case 'roshanRoar':
        rings.fire(d.x, d.z, { color: col.gold, r0: 0.5, r1: d.r, dur: 0.6, alpha: 0.9 });
        rings.fire(d.x, d.z, { color: col.dire, r0: 0.5, r1: d.r * 1.1, dur: 0.9, alpha: 0.5 });
        shake(0.5);
        break;
      case 'towerShot': {
        const t = d.tower;
        parts.burst(4, { x: t.x, z: t.z, y: 3.2, color: t.side === 'radiant' ? col.jade : col.dire, speed: 1.5, up: 1, life: 0.3, size: 0.25, floor: false });
        break;
      }
      case 'towerDown': {
        const t = d.tower;
        rings.fire(t.x, t.z, { color: t.side === 'radiant' ? col.jade : col.dire, r0: 0.5, r1: 4, dur: 1 });
        parts.burst(reduced ? 12 : 60, { x: t.x, z: t.z, y: 1.5, color: [new THREE.Color('#8a7a6a'), col.text, t.side === 'radiant' ? col.jade : col.dire], speed: 5, up: 6, g: 9, life: 1.4, size: 0.35, spread: 1 });
        shake(0.6);
        break;
      }
      case 'rune':
        rings.fire(d.rune.x, d.rune.z, { color: new THREE.Color(d.R.color), r0: 0.3, r1: 2, dur: 0.8 });
        break;
      case 'runeTaken': {
        const c = new THREE.Color(d.R.color);
        rings.fire(d.rune.x, d.rune.z, { color: c, r0: 0.3, r1: 2.8, dur: 0.6 });
        parts.burst(reduced ? 10 : 36, { x: d.rune.x, z: d.rune.z, y: 1, color: [c, col.white], speed: 4, up: 4, life: 0.9, size: 0.24 });
        break;
      }
      case 'courierDeliver': {
        const c = g.courier;
        parts.burst(reduced ? 8 : 26, { x: c.x, z: c.z, y: 1.2, color: [col.gold, col.gold2, col.white], speed: 3, up: 2, life: 0.8, size: 0.2 });
        rings.fire(p.x, p.z, { color: col.gold, r0: 0.3, r1: 1.8, dur: 0.5 });
        break;
      }
      case 'buy':
        if (d.instant) rings.fire(p.x, p.z, { color: col.gold, r0: 0.3, r1: 1.6, dur: 0.5 });
        break;
      case 'levelUp':
        rings.fire(p.x, p.z, { color: col.gold2, r0: 0.3, r1: 2.4, dur: 0.8 });
        parts.burst(reduced ? 8 : 26, { x: p.x, z: p.z, y: 0.2, color: [col.gold, col.gold2], speed: 1.2, up: 6, g: 2, life: 1.1, size: 0.2 });
        break;
      case 'channelStart':
        rings.fire(p.x, p.z, { color: col.ice, r0: 0.5, r1: 4.8, dur: 0.6 });
        break;
      default:
        break;
    }
  }

  function fxEvent(d, g) {
    const p = g.player;
    switch (d.kind) {
      case 'taunt':
        rings.fire(d.x, d.z, { color: col.dire, r0: 0.4, r1: d.r, dur: 0.45, alpha: 1 });
        rings.fire(d.x, d.z, { color: col.ember, r0: d.r, r1: 0.5, dur: 0.5, alpha: 0.6 });
        parts.burst(reduced ? 8 : 26, { x: d.x, z: d.z, y: 1.2, color: [col.dire, col.ember2], speed: 3, up: 3, life: 0.6, size: 0.26 });
        shake(0.25);
        break;
      case 'spin':
        rings.fire(d.x, d.z, { color: col.ember2, r0: 0.6, r1: d.r, dur: 0.35, alpha: 0.9 });
        if (!reduced) {
          for (let i = 0; i < 20; i++) {
            const a = (i / 20) * Math.PI * 2;
            parts.spawn({ x: d.x + Math.sin(a) * d.r * 0.7, z: d.z + Math.cos(a) * d.r * 0.7, y: 0.9, vx: Math.cos(a) * 5, vz: -Math.sin(a) * 5, vy: 0.5, drag: 3, life: 0.35, size: 0.28, size1: 0.05, color: i % 2 ? col.ember2 : col.white, floor: false });
          }
        }
        shake(d.free ? 0.08 : 0.15);
        break;
      case 'hunger':
        parts.burst(10, { x: d.foe.x, z: d.foe.z, y: 1, color: [col.blood, col.dire], speed: 2, up: 2, life: 0.6, size: 0.22 });
        break;
      case 'execute':
        rings.fire(d.x, d.z, { color: col.blood, r0: 0.3, r1: 3.5, dur: 0.6, alpha: 1 });
        parts.burst(reduced ? 12 : 44, { x: d.x, z: d.z, y: 1, color: [col.blood, col.dire, col.white], speed: 6, up: 5, g: 12, life: 0.9, size: 0.3 });
        setFlash(d.x, 2, d.z, col.blood, 70);
        shake(0.45);
        break;
      case 'chop':
        rings.fire(d.x, d.z, { color: col.dire, r0: 0.3, r1: 1.4, dur: 0.35 });
        break;
      case 'nova':
        rings.fire(d.x, d.z, { color: col.ice, r0: 0.3, r1: d.r, dur: 0.45, alpha: 1 });
        rings.fire(d.x, d.z, { color: col.white, r0: 0.2, r1: d.r * 0.7, dur: 0.6, alpha: 0.6 });
        parts.burst(reduced ? 12 : 46, { x: d.x, z: d.z, y: 0.3, color: [col.ice, col.ice2, col.white], speed: 5, up: 4, g: 6, life: 0.9, size: 0.26, spread: d.r });
        setFlash(d.x, 1.5, d.z, col.ice, 40);
        shake(0.15);
        break;
      case 'frost':
        parts.burst(reduced ? 6 : 20, { x: d.foe.x, z: d.foe.z, y: 0.8, color: [col.ice, col.ice2], speed: 2.5, up: 2, life: 0.7, size: 0.22 });
        rings.fire(d.foe.x, d.foe.z, { color: col.ice, r0: 0.3, r1: 1.4, dur: 0.4 });
        break;
      case 'aura':
        rings.fire(d.x, d.z, { color: col.arcane, r0: 0.3, r1: 2.8, dur: 0.7 });
        parts.burst(reduced ? 6 : 24, { x: d.x, z: d.z, y: 0.2, color: [col.arcane, col.ice], speed: 1.5, up: 4, g: 1, life: 1.2, size: 0.2 });
        break;
      case 'iceBlast':
        parts.burst(reduced ? 3 : 9, { x: d.x, z: d.z, y: 0.2, color: [col.ice, col.ice2, col.white], speed: 3.5, up: 3.5, g: 8, life: 0.55, size: 0.24, spread: 0.6 });
        if (Math.random() < 0.25) rings.fire(d.x, d.z, { color: col.ice, r0: 0.2, r1: d.r, dur: 0.3, alpha: 0.7 });
        break;
      case 'blink': {
        const c = d.shadow ? col.shadow : col.ice;
        parts.burst(reduced ? 5 : 14, { x: d.x0, z: d.z0, y: 0.8, color: [c, col.white], speed: 2.5, up: 2, life: 0.5, size: 0.24 });
        parts.burst(reduced ? 5 : 14, { x: d.x1, z: d.z1, y: 0.8, color: [c, col.white], speed: 2.5, up: 2, life: 0.5, size: 0.24 });
        if (!reduced) {
          const n = 10;
          for (let i = 0; i <= n; i++) {
            const k = i / n;
            parts.spawn({ x: d.x0 + (d.x1 - d.x0) * k, z: d.z0 + (d.z1 - d.z0) * k, y: 0.8, vx: 0, vz: 0, vy: 0.3, life: 0.35, size: 0.3, size1: 0.05, color: c, floor: false });
          }
        }
        break;
      }
      case 'smoke':
        if (!reduced) {
          for (let i = 0; i < 40; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * 2.2;
            parts.spawn({ x: d.x + Math.sin(a) * r, z: d.z + Math.cos(a) * r, y: 0.3 + Math.random() * 1.2, vx: Math.sin(a) * 0.6, vz: Math.cos(a) * 0.6, vy: 0.3, drag: 0.5, life: 1.8, size: 0.8, size1: 1.2, color: i % 3 ? col.smoke : col.shadow, alpha: 0.5, floor: false });
          }
        }
        rings.fire(d.x, d.z, { color: col.shadow, r0: 0.4, r1: 2.6, dur: 0.6 });
        break;
      case 'ambush':
      case 'crit':
        if (d.foe) parts.burst(reduced ? 5 : 14, { x: d.foe.x, z: d.foe.z, y: 0.9, color: [col.blood, col.white, col.shadow], speed: 4, up: 3, life: 0.45, size: 0.22 });
        break;
      case 'cleave':
        parts.burst(reduced ? 3 : 10, { x: d.x, z: d.z, y: 0.7, color: [col.ember2, col.white], speed: 3, up: 1, life: 0.3, size: 0.2, spread: 1.2 });
        break;
      case 'wand':
      case 'cheese':
      case 'refresh':
        rings.fire(d.x, d.z, { color: d.kind === 'refresh' ? col.ice : col.jade, r0: 0.3, r1: 2.4, dur: 0.6 });
        parts.burst(reduced ? 8 : 26, { x: d.x, z: d.z, y: 0.5, color: [d.kind === 'refresh' ? col.ice : col.jade, col.white, col.gold2], speed: 2, up: 4, life: 0.9, size: 0.22 });
        break;
      case 'bkb':
        rings.fire(d.x, d.z, { color: col.gold, r0: 0.3, r1: 2.2, dur: 0.5 });
        parts.burst(reduced ? 8 : 24, { x: d.x, z: d.z, y: 0.3, color: [col.gold, col.gold2], speed: 2, up: 5, life: 0.9, size: 0.24 });
        break;
      default:
        break;
    }
    void p;
  }

  // ---------------------------------------------------------------- kare
  const seen = new Set();
  let splashT = 0;
  function render(g, dt, simDt) {
    if (disposed) return;
    time += dt;
    const p = g.player;
    const playing = g.state === 'playing' || g.state === 'break' || g.state === 'dying';
    if (hero.heroId !== g.heroId) setHero(g.heroId);
    syncTowers(g);

    // kamera
    let tx = 0;
    let tz = 0;
    let wantZoom = 1;
    let wantPitch = PITCH;
    let wantTy = 0.4;
    let wantYaw = 0;
    if (playing) {
      const ax = p.aimX - p.x;
      const az = p.aimZ - p.z;
      const al = Math.hypot(ax, az) || 1;
      const look = Math.min(1.4, al * 0.15);
      cam.lookX += ((ax / al) * look - cam.lookX) * Math.min(1, dt * 3);
      cam.lookZ += ((az / al) * look - cam.lookZ) * Math.min(1, dt * 3);
      tx = p.x * 0.8 + cam.lookX;
      tz = p.z * 0.8 + cam.lookZ;
      if (g.state === 'dying') { wantZoom = 0.72; tx = p.x; tz = p.z; }
      if (g.slowmo > 0) wantZoom = 0.88;
    } else if (frame.mode === 'select') {
      // kahraman seçimi: yakın plan döner tabla
      const portrait = W / H < 0.9;
      wantPitch = (22 * Math.PI) / 180;
      wantZoom = (portrait ? 7.2 : 5.6) / cam.dist;
      wantYaw = 0;
      const side = frame.side === 'right' ? -1.55 : 0;
      tx = p.x + side;
      // 'top': kahraman sahnenin üst kısmında görünsün (kart altta)
      tz = p.z + (frame.side === 'top' ? 2.6 : 0);
      wantTy = frame.side === 'top' ? -0.6 : 0.95;
    } else {
      wantYaw = cam.yaw + dt * (reduced ? 0.02 : 0.06);
      wantZoom = 1.06;
    }
    let dy = wantYaw - cam.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    cam.yaw += dy * Math.min(1, dt * 2.5);
    const kf = Math.min(1, dt * 4);
    cam.x += (tx - cam.x) * kf;
    cam.z += (tz - cam.z) * kf;
    cam.zoom += (wantZoom - cam.zoom) * Math.min(1, dt * 2.5);
    cam.pitch += (wantPitch - cam.pitch) * Math.min(1, dt * 2.5);
    cam.ty += (wantTy - cam.ty) * Math.min(1, dt * 2.5);
    const D = cam.dist * cam.zoom;
    const hz = Math.cos(cam.pitch) * D;
    let sx = 0;
    let sy = 0;
    if (cam.shake > 0) {
      const s = cam.shake * 0.5;
      sx = (Math.random() - 0.5) * s;
      sy = (Math.random() - 0.5) * s;
      cam.shake = Math.max(0, cam.shake - dt * 2.2);
    }
    camera.position.set(cam.x + Math.sin(cam.yaw) * hz + sx, Math.sin(cam.pitch) * D + cam.ty + sy, cam.z + Math.cos(cam.yaw) * hz);
    camera.lookAt(cam.x + sx * 0.5, cam.ty, cam.z);

    // ortam
    for (const t of torchLights) t.L.intensity = t.base * (0.82 + 0.18 * Math.sin(time * 9 + t.seed) * Math.sin(time * 5.3 + t.seed * 2));
    for (const f of flames) {
      const k = 1 + 0.12 * Math.sin(time * 14 + f.seed) + 0.08 * Math.sin(time * 23 + f.seed);
      f.f.scale.set(0.8 * (2 - k) * 0.9, 1.3 * k, 1);
    }
    floorMat.emissiveIntensity = 0.85 + 0.2 * Math.sin(time * 1.3);
    map.update(time, dt, g);
    if (flash > 0) flash = Math.max(0, flash - dt * 160);

    // kahraman
    hero.update(p, time, dt, g, !lineup);
    heroLight.position.set(p.x, 2.6, p.z + 0.8);
    const showHero = playing;
    playerRing.visible = (showHero || g.state === 'idle') && !p.dead;
    playerRing.position.set(p.x, 0.05, p.z);
    playerRing.material.color.set(g.H.color);
    playerRing.material.opacity = 0.55 + 0.2 * Math.sin(time * 4);
    windRing.visible = showHero && p.windrun > 0;
    windRing.position.set(p.x, 0.06, p.z);
    windRing.rotation.z = time * 5;
    aegisRing.visible = showHero && p.aegis;
    aegisRing.position.set(p.x, 0.055, p.z);
    aegisRing.scale.setScalar(1.6 + Math.sin(time * 3) * 0.08);
    buffGlow.position.set(p.x + Math.sin(p.face) * 0.3, 1.0, p.z + Math.cos(p.face) * 0.3);
    buffGlowMat.opacity = showHero && p.rapier > 0 ? 0.55 + 0.25 * Math.sin(time * 10) : 0;
    const channeling = !!(p.channel && p.channel.id === 'buz_field');
    fieldRing.visible = showHero && channeling;
    if (channeling) {
      fieldRing.position.set(p.x, 0.08, p.z);
      fieldRing.rotation.z = time * 0.8;
      fieldRing.material.opacity = 0.45 + 0.15 * Math.sin(time * 6);
      if (simDt > 0 && !reduced) {
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * 4.8;
          parts.spawn({ x: p.x + Math.sin(a) * r, z: p.z + Math.cos(a) * r, y: 3 + Math.random(), vx: Math.cos(a) * 1.5, vz: -Math.sin(a) * 1.5, vy: -3.5, life: 0.9, size: 0.14, size1: 0.1, color: i % 2 ? col.ice2 : col.white, floor: false });
        }
      }
    }
    burnRing.visible = showHero && g.stat.burn > 0 && !p.dead;
    if (burnRing.visible) {
      burnRing.position.set(p.x, 0.06, p.z);
      burnRing.rotation.z = -time * 0.6;
      burnRing.material.opacity = 0.22 + 0.08 * Math.sin(time * 5);
    }

    // nişan
    const manual = !g.lastAuto;
    reticle.visible = showHero && manual && !p.dead && g.state !== 'dying';
    reticleDot.visible = reticle.visible;
    reticle.position.set(p.aimX, 0.07, p.aimZ);
    reticleDot.position.set(p.aimX, 0.07, p.aimZ);
    reticle.rotation.z = -time * 1.5;
    const tg = g.target;
    targetRing.visible = showHero && !!tg && !tg.dead;
    if (tg) {
      targetRing.position.set(tg.x, 0.065, tg.z);
      targetRing.scale.setScalar(2.8 * tg.r * (tg.scale || 1) + 0.2 + Math.sin(time * 8) * 0.05);
      targetRing.rotation.z = time * 2;
    }
    chargeLine.visible = showHero && p.charging;
    if (p.charging) {
      const c = p.charge;
      const L = 11 + 13 * c;
      chargeLine.position.set(p.x, 0.08, p.z);
      chargeLine.rotation.y = p.face;
      chargeLine.scale.set(0.3 + c * 0.55, 1, L * (0.25 + 0.75 * Math.min(1, c * 1.4 + 0.1)));
      lineMat.color.copy(col.ember).lerp(col.gold2, c);
      lineMat.opacity = c >= 0.97 ? 0.75 + 0.25 * Math.sin(time * 24) : 0.35 + c * 0.45;
    }

    // sürekli parçacıklar
    if (simDt > 0 && showHero && !reduced) {
      if (p.windrun > 0 && p.moving > 0.2) parts.spawn({ x: p.x + (Math.random() - 0.5) * 0.5, z: p.z + (Math.random() - 0.5) * 0.5, y: 0.2 + Math.random() * 0.9, vx: -p.vx * 0.3, vz: -p.vz * 0.3, vy: 0.3, life: 0.45, size: 0.2, size1: 0.02, color: col.jade, floor: false });
      if (p.heals.length && Math.random() < 0.35) parts.spawn({ x: p.x + (Math.random() - 0.5) * 0.8, z: p.z + (Math.random() - 0.5) * 0.8, y: 0.2, vx: 0, vz: 0, vy: 1.2, life: 0.9, size: 0.2, size1: 0.05, color: col.jade, floor: false });
      if ((p.rapier > 0 || p.dd > 0) && Math.random() < 0.3) parts.spawn({ x: p.x + (Math.random() - 0.5) * 0.6, z: p.z + (Math.random() - 0.5) * 0.6, y: 0.5 + Math.random(), vx: 0, vz: 0, vy: 0.8, life: 0.6, size: 0.14, size1: 0.02, color: p.dd > 0 ? new THREE.Color('#4d8dff') : col.gold, floor: false });
      if (p.haste > 0 && p.moving > 0.2) parts.spawn({ x: p.x, z: p.z, y: 0.3 + Math.random() * 0.6, vx: -p.vx * 0.2, vz: -p.vz * 0.2, vy: 0.2, life: 0.4, size: 0.22, size1: 0.02, color: new THREE.Color('#ff4d4d'), floor: false });
      if (p.inFountain && Math.random() < 0.5) parts.spawn({ x: p.x + (Math.random() - 0.5) * 0.9, z: p.z + (Math.random() - 0.5) * 0.9, y: 0.1, vx: 0, vz: 0, vy: 1.6, life: 0.9, size: 0.18, size1: 0.04, color: col.jade, floor: false });
      if (g.stat.burn > 0 && Math.random() < 0.4) {
        const a = Math.random() * Math.PI * 2;
        parts.spawn({ x: p.x + Math.sin(a) * 3.1, z: p.z + Math.cos(a) * 3.1, y: 0.1, vx: 0, vz: 0, vy: 1.4, life: 0.6, size: 0.2, size1: 0.02, color: col.ember2, floor: false });
      }
      splashT -= simDt;
      if (p.moving > 0.3 && inRiver(p.x, p.z) && splashT <= 0) {
        splashT = 0.08;
        parts.burst(3, { x: p.x, z: p.z, y: 0.05, color: [col.water, col.white], speed: 1.8, up: 2.2, g: 9, life: 0.45, size: 0.16 });
      }
    }
    // çeşme fıskiyesi
    if (simDt > 0 && !reduced && Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2;
      parts.spawn({ x: FOUNTAIN.x + Math.sin(a) * 0.2, z: FOUNTAIN.z + Math.cos(a) * 0.2, y: 2.1, vx: Math.sin(a) * 1.4, vz: Math.cos(a) * 1.4, vy: 2.4, g: 6, life: 0.8, size: 0.16, size1: 0.06, color: col.jade, floor: false });
    }

    // köpekler (etiketler ekranda sabit piksel boyutunda kalsın)
    const pxPerUnit = H / (2 * Math.tan((FOV * Math.PI) / 360) * D);
    const labelScale = Math.max(0.9, Math.min(5, (W < 560 ? 104 : 124) / pxPerUnit));
    const barK = labelScale * 0.3;
    const execThr = g.execThreshold ? g.execThreshold() : 0;
    seen.clear();
    for (const e of g.foes) {
      seen.add(e.id);
      if (e.kind === 'dog') {
        const rig = rigById.get(e.id) || acquireRig(e);
        rig.update(e, time, dt, reduced, labelScale, execThr);
      } else {
        const rig = unitById.get(e.id) || acquireUnit(e);
        rig.update(e, time, dt, barK, execThr);
        if (rig.label) {
          rig.labelGroup.position.set(e.x, 3.55, e.z);
          rig.label.sprite.scale.set(labelScale * 1.2, labelScale * 0.6, 1);
          rig.label.mat.opacity = e.dead ? Math.max(0, 1 - e.deathT) : e.spawnT > 0 ? 0 : 1;
          rig.labelGroup.visible = rig.label.mat.opacity > 0.02;
          rig.label.draw({ name: 'ROSHAN', color: '#e9b949', hp: e.hp, maxHp: e.maxHp, status: e.dead ? null : e.status === 'sleep' ? 'afk' : e.st.stun > 0 ? 'stun' : null, elite: true, tag: execThr && e.hp <= execThr ? 'İNFAZ' : '' });
          rig.barGroup.visible = false;
        }
        if (e.kind === 'boss' && e.cast && !e.dead) {
          const k = 1 - e.cast.t / e.cast.dur;
          teleRing.visible = true;
          teleFill.visible = true;
          teleRing.position.set(e.x, 0.09, e.z);
          teleFill.position.set(e.x, 0.085, e.z);
          const c = e.cast.kind === 'slam' ? col.blood : col.gold;
          teleRing.material.color.copy(c);
          teleFill.material.color.copy(c);
          teleRing.scale.setScalar(e.cast.r * 2);
          teleFill.scale.setScalar(e.cast.r * 2 * k);
          teleFill.material.opacity = 0.25 + 0.3 * k;
          teleRing.material.opacity = 0.6 + 0.4 * Math.sin(time * 20);
        }
      }
      // durum parçacıkları
      if (simDt > 0 && !reduced && !e.dead) {
        if (e.st.dot > 0 && Math.random() < 0.18) parts.spawn({ x: e.x + (Math.random() - 0.5) * 0.4, z: e.z + (Math.random() - 0.5) * 0.4, y: 0.6 + Math.random() * 0.5, vx: 0, vz: 0, vy: 1, life: 0.5, size: 0.16, size1: 0.03, color: e.st.dotKey === 'frost' ? col.ice : col.blood, floor: false });
        if (e.st.slow > 0 && e.st.slowK >= 0.3 && Math.random() < 0.08) parts.spawn({ x: e.x, z: e.z, y: 0.2, vx: 0, vz: 0, vy: 0.6, life: 0.6, size: 0.18, size1: 0.05, color: col.ice, floor: false });
      }
    }
    if (!g.foes.some((e) => e.kind === 'boss' && e.cast && !e.dead)) { teleRing.visible = false; teleFill.visible = false; }
    for (const id of [...rigById.keys()]) if (!seen.has(id)) releaseRig(id);
    for (const id of [...unitById.keys()]) if (!seen.has(id)) releaseUnit(id);

    // kuleler
    for (const t of g.towers) {
      const rig = towerById.get(t.id);
      if (rig) rig.update(t, time, dt, g, barK * 1.1);
    }
    // kurye
    if (g.courier.state !== 'home' && !courier) {
      courier = new CourierRig(kit);
      scene.add(courier.root);
      if (!('model-courier' in models)) want('model-courier');
    }
    if (courier) {
      courier.update(g.courier, time);
      if (simDt > 0 && g.courier.state !== 'home' && !reduced && Math.random() < 0.5) parts.spawn({ x: g.courier.x, z: g.courier.z, y: g.courier.y + 0.2, vx: 0, vz: 0, vy: -0.3, life: 0.6, size: 0.14, size1: 0.02, color: col.gold2, floor: false });
    }

    // oklar
    seen.clear();
    for (const a of g.arrows) {
      if (!a.alive) continue;
      seen.add(a.id);
      const m = arrowMesh(a);
      m.root.position.set(a.x, 0.95, a.z);
      m.root.rotation.y = Math.atan2(a.dx, a.dz);
      if (a.full && simDt > 0 && !reduced) parts.spawn({ x: a.x, z: a.z, y: 0.95, vx: (Math.random() - 0.5) * 0.6, vz: (Math.random() - 0.5) * 0.6, vy: 0.2, life: 0.35, size: 0.3, size1: 0.02, color: a.rapier ? col.gold : col.ember2, floor: false });
    }
    for (const [id, m] of arrowById) {
      if (!seen.has(id)) {
        m.root.visible = false;
        arrowFree.push(m);
        arrowById.delete(id);
      }
    }
    // mermiler
    seen.clear();
    for (const pr of g.projs) {
      seen.add(pr.id);
      let o = projById.get(pr.id);
      if (!o) {
        o = (projFree[pr.kind] && projFree[pr.kind].pop()) || buildProj(kit, pr.kind);
        if (!o.root.parent) scene.add(o.root);
        o.root.visible = true;
        projById.set(pr.id, o);
      }
      o.root.position.set(pr.x, pr.y, pr.z);
      o.root.rotation.y = Math.atan2(pr.tx - pr.x, pr.tz - pr.z);
      o.core.rotation.z = time * 8;
      if (simDt > 0 && !reduced && Math.random() < 0.6) {
        const c = pr.kind === 'tower-r' ? col.jade : pr.kind === 'ice' ? col.ice : col.dire;
        parts.spawn({ x: pr.x, z: pr.z, y: pr.y, vx: 0, vz: 0, vy: 0, life: 0.25, size: pr.kind.startsWith('tower') ? 0.35 : 0.2, size1: 0.02, color: c, floor: false });
      }
    }
    for (const [id, o] of projById) {
      if (!seen.has(id)) {
        o.root.visible = false;
        (projFree[o.kind] ||= []).push(o);
        projById.delete(id);
      }
    }

    // REPORT! balonları
    seen.clear();
    for (const b of g.bubbles) {
      seen.add(b.id);
      let s = bubbleById.get(b.id);
      if (!s) {
        s = bubbleFree.pop() || new THREE.Sprite(bubbleMat);
        s.center.set(0.5, 0.2);
        s.renderOrder = 15;
        scene.add(s);
        bubbleById.set(b.id, s);
      }
      const k = 1 + Math.sin(time * 12 + b.id) * 0.06;
      s.scale.set(1.3 * k, 0.65 * k, 1);
      s.position.set(b.x, 0.9 + Math.sin(time * 6 + b.id) * 0.08, b.z);
    }
    for (const [id, s] of bubbleById) {
      if (!seen.has(id)) {
        scene.remove(s);
        bubbleFree.push(s);
        bubbleById.delete(id);
      }
    }

    // rünler
    seen.clear();
    for (const r of g.runes) {
      seen.add(r.id);
      let o = runeById.get(r.id);
      if (!o) {
        o = runeFree.pop() || buildRune(kit, RUNES[r.kind].color);
        o.set(RUNES[r.kind].color);
        scene.add(o.root);
        runeById.set(r.id, o);
      }
      o.root.position.set(r.x, Math.sin(time * 2.2) * 0.1, r.z);
      o.core.rotation.y = time * 1.8;
      o.core.rotation.x = Math.sin(time) * 0.3;
      o.ring.rotation.x = Math.PI / 2 + Math.sin(time * 1.3) * 0.4;
      o.ring.rotation.y = time;
      const s = Math.min(1, r.t * 3);
      o.root.scale.setScalar(s);
      o.glow.material.opacity = 0.55 + 0.25 * Math.sin(time * 4);
    }
    for (const [id, o] of runeById) {
      if (!seen.has(id)) { scene.remove(o.root); runeFree.push(o); runeById.delete(id); }
    }

    // eşyalar
    seen.clear();
    let aegisNow = null;
    for (const k of g.pickups) {
      if (k.kind === 'aegis') {
        aegisNow = k;
        if (!aegisObj) {
          aegisObj = buildAegis(kit, aegisModel ? aegisModel.clone(true) : null);
          scene.add(aegisObj.root);
        }
        if (!aegisOnField) { aegisOnField = true; aegisT = 0; aegisObj.root.visible = true; }
        continue;
      }
      seen.add(k.id);
      if (k.kind === 'cheese') {
        let r = cheeseById.get(k.id);
        if (!r) { r = cheeseFree.pop() || buildCheese(kit); scene.add(r.root); cheeseById.set(k.id, r); }
        r.root.position.set(k.x, Math.sin(time * 2.5) * 0.1, k.z);
        r.wedge.rotation.z = time * 1.5;
        continue;
      }
      let r = rapierById.get(k.id);
      if (!r) {
        r = rapierFree.pop() || buildRapier(kit);
        scene.add(r.root);
        rapierById.set(k.id, r);
      }
      r.root.position.set(k.x, 0, k.z);
      r.sword.rotation.y = time * 2.2;
      r.sword.position.y = 1.05 + Math.sin(time * 3) * 0.1;
      r.ring.material.color.copy(k.kind === 'rapierItem' ? col.dire : col.gold);
      const blink = k.life - k.t < 3 ? (Math.sin(time * 20) > 0 ? 1 : 0.3) : 1;
      r.root.visible = blink > 0.5 || k.life - k.t > 3;
      r.ring.rotation.z = time;
    }
    for (const [id, r] of rapierById) if (!seen.has(id)) { scene.remove(r.root); rapierFree.push(r); rapierById.delete(id); }
    for (const [id, r] of cheeseById) if (!seen.has(id)) { scene.remove(r.root); cheeseFree.push(r); cheeseById.delete(id); }
    if (aegisObj) {
      if (!aegisNow && aegisOnField) {
        aegisOnField = false;
        aegisObj.root.visible = false;
      }
      if (aegisOnField) {
        aegisT += dt;
        const rise = Math.min(1, aegisT / 1.2);
        const e = 1 - Math.pow(1 - rise, 3);
        aegisObj.root.position.set(aegisNow.x, -2 + 2 * e, aegisNow.z);
        aegisObj.root.rotation.y = time * 0.9;
        aegisObj.float.position.y = (aegisModel ? 0 : 1.35) + Math.sin(time * 2) * 0.08;
        aegisObj.glowMat.opacity = 0.45 + 0.2 * Math.sin(time * 3);
        aegisObj.beamMat.opacity = 0.3 * e;
      }
    }
    if (flash > 12) {
      fxLight.position.copy(flashPos);
      fxLight.color.copy(flashCol);
      fxLight.intensity = flash;
      fxLight.distance = 18;
    } else if (aegisOnField) {
      fxLight.position.set(aegisNow.x, 2.2, aegisNow.z);
      fxLight.color.copy(col.gold);
      fxLight.intensity = 14;
      fxLight.distance = 9;
    } else fxLight.intensity = 0;
    if (map.pitGlow) map.pitGlow.opacity = g.foes.some((e) => e.kind === 'boss' && !e.dead) ? 0.55 + 0.15 * Math.sin(time * 4) : 0.25;

    // efektler
    rings.update(simDt);
    ambientEmbers(parts, PLAY_R, dt, ambient);
    parts.update(simDt > 0 ? simDt : dt * 0.15);

    renderer.render(scene, camera);
  }

  function dispose() {
    disposed = true;
    parts.dispose();
    rings.dispose();
    const disposeTree = (root) => root.traverse((o) => {
      if (o.geometry && !shared.has(o.geometry)) o.geometry.dispose();
      if (o.material) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (shared.has(m)) continue;
          for (const k of MAP_KEYS) if (m[k] && !shared.has(m[k])) m[k].dispose();
          m.dispose();
        }
      }
    });
    disposeTree(scene);
    for (const rig of rigFree) { disposeTree(rig.root); disposeTree(rig.labelGroup); }
    for (const list of Object.values(unitFree)) for (const rig of list) { disposeTree(rig.root); disposeTree(rig.barGroup); if (rig.labelGroup) disposeTree(rig.labelGroup); }
    for (const m of arrowFree) disposeTree(m.root);
    for (const r of rapierFree) disposeTree(r.root);
    for (const r of cheeseFree) disposeTree(r.root);
    for (const r of runeFree) disposeTree(r.root);
    for (const list of Object.values(projFree)) for (const o of list) disposeTree(o.root);
    for (const b of bubbleFree) disposeTree(b);
    for (const r of retired) { disposeTree(r.root); disposeTree(r.barGroup); if (r.range) disposeTree(r.range); }
    for (const r of Object.values(heroRigs)) if (!r.root.parent) disposeTree(r.root);
    for (const t of [...shared]) bin.items.delete(t);
    bin.dispose();
    try { renderer.renderLists.dispose(); } catch { /* yok say */ }
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch { /* yok say */ }
    canvas.remove();
  }

  // Uyarlanabilir kalite: kare hızı düşükse piksel oranını kademeli azalt.
  const baseDpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
  let dprLevel = 0;
  function lowerQuality() {
    const steps = [baseDpr, Math.min(baseDpr, 1.25), 1];
    if (dprLevel < steps.length - 1) {
      dprLevel += 1;
      if (steps[dprLevel] >= renderer.getPixelRatio()) return lowerQuality();
      renderer.setPixelRatio(steps[dprLevel]);
      resize(W, H);
      return true;
    }
    if (moon.castShadow) {
      moon.castShadow = false;
      return true;
    }
    return false;
  }

  /** Test/doğrulama: hangi modeller gerçekten yüklendi (prosedürel yedek değil). */
  function modelInfo() {
    const out = {};
    for (const key of Object.keys(MODEL_H)) out[key] = key in models ? !!models[key] : 'bekliyor';
    return out;
  }
  /** Kahraman seçim ekranı / oyun kamerası çerçevesi. */
  function setFrame(f) { frame = { ...frame, ...f }; }
  /** Seçim ekranında önizleme: kahraman modelini önceden yükle. */
  function preload(keys) { for (const k of keys) want(k); }

  // Geliştirme: model yönü sırası (her model +z'ye, yani kameraya bakmalı)
  let lineup = null;
  function devLineup(on = true, from = 0, count = 5) {
    if (lineup) { scene.remove(lineup); lineup = null; }
    if (!on) return [];
    lineup = new THREE.Group();
    const keys = Object.keys(MODEL_H).filter((k) => models[k] && k !== 'model-aegis').slice(from, from + count);
    keys.forEach((k, i) => {
      const c = cloneModel(models[k], kit, { transparent: false });
      c.obj.rotation.y = MODEL_YAW[k] || 0;
      const s = k.startsWith('model-tower') ? 0.45 : k === 'model-roshan' ? 0.5 : 1;
      c.obj.scale.multiplyScalar(s);
      c.obj.position.set((i - (keys.length - 1) / 2) * 1.5, 0, 0.3);
      lineup.add(c.obj);
    });
    scene.add(lineup);
    return keys;
  }

  return {
    kind: '3d', canvas, resize, render, project, groundAt, event, shake, dispose, lowerQuality, modelInfo, setFrame, preload,
    devLineup: import.meta.env && import.meta.env.DEV ? devLineup : undefined,
  };
}
