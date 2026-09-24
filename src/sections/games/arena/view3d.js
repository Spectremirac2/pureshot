// 1vDOQUZ Arena — three.js görüntüsü.
// Oyun durumunu (game.js) her karede okur; olaylardan parçacık/halka/sarsıntı üretir.

import * as THREE from 'three';
import { loadModel } from '../../../core/models.js';
import { artUrl } from '../../../core/assets.js';
import { ARENA_R, PLAY_R, GATE_ANGLES } from './game.js';
import { TYPE_IDS, archOf } from './dogs.js';
import * as TX from './textures.js';
import { Particles, Rings, ambientEmbers } from './fx3d.js';
import { Bin, makeGeoms, DogRig, ArcherRig, buildAegis, buildRapier, buildArrow } from './actors.js';

const PITCH = (57 * Math.PI) / 180;
const FOV = 40;

export async function createView3D({ mobile = false, reduced = false } = {}) {
  // WebGL oluşturma başarısızsa hata fırlatır; çağıran 2D yedeğe geçer.
  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: 'high-performance', alpha: false });
  if (!renderer.getContext()) throw new Error('WebGL yok');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
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
  };
  const typeColors = Object.fromEntries(TYPE_IDS.map((id) => [id, new THREE.Color(archOf(id).color)]));

  const scene = new THREE.Scene();
  scene.background = col.bg.clone();
  scene.fog = new THREE.FogExp2(new THREE.Color('#120d1b'), 0.017);

  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 140);

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
    banner: bin.add(TX.toTexture(TX.bannerCanvas())),
    wall: bin.add(TX.toTexture(TX.wallCanvas(), { repeat: [7, 1] })),
    rock: bin.add(TX.toTexture(TX.rockCanvas(), { repeat: [18, 18] })),
  };

  // ---------------------------------------------------------------- modeller (varsa)
  const safe = (p) => Promise.resolve(p).catch(() => null);
  const [dogModel, archerModel, aegisModel] = await Promise.all([
    safe(loadModel('model-dog', { height: 0.9 })),
    safe(loadModel('model-archer', { height: 1.6 })),
    safe(loadModel('model-aegis', { height: 2.3 })),
  ]);

  // Model önbelleğine (core/models.js) ait kaynaklar başka bölümlerce de kullanılır: dispose etme, değiştirme.
  const MAP_KEYS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap'];
  const shared = new Set();
  for (const m of [dogModel, archerModel, aegisModel]) {
    if (!m) continue;
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

  const G = makeGeoms(bin);
  const kit = {
    G, bin, shadows, dogModel, archerModel,
    glowTex: tex.glow, ringTex: tex.ring, dashRingTex: tex.dashRing, beamTex: tex.beam, trailTex: tex.beam,
    typeColor: (id) => typeColors[id] || col.ember,
    arrowMats: {
      wood: bin.add(new THREE.MeshStandardMaterial({ color: '#8a5a2b', roughness: 0.6 })),
      head: bin.add(new THREE.MeshStandardMaterial({ color: '#e7e1d6', roughness: 0.2, metalness: 0.9, emissive: col.ember, emissiveIntensity: 0.4 })),
      fletch: bin.add(new THREE.MeshBasicMaterial({ color: col.ember, side: THREE.DoubleSide })),
    },
  };

  // ---------------------------------------------------------------- ışıklar
  scene.add(new THREE.HemisphereLight(new THREE.Color('#7a68b0'), new THREE.Color('#2a1410'), 1.1));
  const moon = new THREE.DirectionalLight(new THREE.Color('#c4b8ff'), 1.5);
  moon.position.set(-9, 20, 7);
  moon.target.position.set(0, 0, 0);
  if (shadows) {
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const sc = moon.shadow.camera;
    sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 2; sc.far = 50;
    moon.shadow.bias = -0.0006;
    moon.shadow.normalBias = 0.03;
  }
  scene.add(moon, moon.target);

  const torchLights = [];
  for (const a of GATE_ANGLES) {
    const L = new THREE.PointLight(col.ember2, 38, 15, 1.7);
    L.position.set(Math.sin(a) * (ARENA_R - 0.6), 2.9, Math.cos(a) * (ARENA_R - 0.6));
    scene.add(L);
    torchLights.push({ L, base: 38, seed: Math.random() * 10 });
  }
  const heroLight = new THREE.PointLight(new THREE.Color('#ffe2bf'), mobile ? 0 : 7, 7, 2);
  if (!mobile) scene.add(heroLight);
  // Tek efekt ışığı: ult parlaması öncelikli, yoksa sahadaki Aegis'i aydınlatır (ışık sayısı sabit kalsın).
  const fxLight = new THREE.PointLight(col.ember, 0, 18, 1.6);
  scene.add(fxLight);
  let flash = 0;
  const flashPos = new THREE.Vector3();

  // ---------------------------------------------------------------- arena
  const floorTexKey = artUrl('texture-arena');
  const fc = TX.floorCanvases(mobile ? 1024 : 2048, { withStones: !floorTexKey });
  const floorMap = bin.add(TX.toTexture(fc.map));
  const floorGlow = bin.add(TX.toTexture(fc.glow));
  const floorMat = bin.add(new THREE.MeshStandardMaterial({
    map: floorMap,
    emissiveMap: floorGlow,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.9,
    roughness: 0.92,
    metalness: 0.02,
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

  const outside = new THREE.Mesh(bin.add(new THREE.CircleGeometry(70, 48)), bin.add(new THREE.MeshStandardMaterial({ map: tex.rock, roughness: 1, color: '#6b5f80' })));
  outside.rotation.x = -Math.PI / 2;
  outside.position.y = -0.03;
  outside.receiveShadow = shadows;
  scene.add(outside);

  const wallMat = bin.add(new THREE.MeshStandardMaterial({ map: tex.wall, roughness: 0.95, side: THREE.DoubleSide }));
  const capMat = bin.add(new THREE.MeshStandardMaterial({ color: '#2a2336', roughness: 0.9 }));
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
    // RingGeometry açısı ile oyun açısı arasında ayna farkı: z eksenini çevir
    capGeo.scale(1, 1, -1);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 1.3;
    scene.add(cap);
    // duvar ortasında sancak
    const am = (a0 + a1) / 2;
    const banner = new THREE.Mesh(G.plane, bin.add(new THREE.MeshStandardMaterial({ map: tex.banner, transparent: true, side: THREE.DoubleSide, roughness: 0.9, emissive: col.ember, emissiveIntensity: 0.08 })));
    banner.scale.set(1.0, 2.0, 1);
    banner.position.set(Math.sin(am) * (WR - 0.08), 1.25, Math.cos(am) * (WR - 0.08));
    banner.rotation.y = am + Math.PI;
    scene.add(banner);
  }
  // kapı sütunları, lentolar ve meşaleler
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
    const n = mobile ? 26 : 44;
    const inst = new THREE.InstancedMesh(spireGeo, spireMat, n);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const rnd = (() => { let s = 99; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 18 + rnd() * 26;
      const hgt = 3 + rnd() * 11;
      const rad = 0.8 + rnd() * 2.4;
      q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.2, rnd() * 3, (rnd() - 0.5) * 0.2));
      m4.compose(new THREE.Vector3(Math.sin(a) * r, hgt / 2 - 0.2, Math.cos(a) * r), q, new THREE.Vector3(rad, hgt, rad));
      inst.setMatrixAt(i, m4);
    }
    scene.add(inst);
  }

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
  const lineGeo = bin.add(new THREE.PlaneGeometry(1, 1));
  lineGeo.rotateX(-Math.PI / 2);
  lineGeo.rotateY(-Math.PI / 2);
  lineGeo.translate(0, 0, 0.5);
  const lineMat = flatMat(tex.line, col.ember, 0.7);
  const chargeLine = new THREE.Mesh(lineGeo, lineMat);
  chargeLine.position.y = 0.08;
  chargeLine.renderOrder = 4;
  scene.add(chargeLine);

  // ---------------------------------------------------------------- oyuncu
  const archer = new ArcherRig(kit);
  scene.add(archer.root);
  const buffGlowMat = bin.add(new THREE.SpriteMaterial({ map: tex.glow, color: col.gold, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  const buffGlow = new THREE.Sprite(buffGlowMat);
  buffGlow.scale.set(1.6, 1.6, 1);
  scene.add(buffGlow);

  // ---------------------------------------------------------------- efekt havuzları
  const parts = new Particles(mobile ? 520 : 900);
  scene.add(parts.points);
  const rings = new Rings(scene, tex.ring, 10);
  const ambient = { rate: mobile ? 10 : 22, c1: col.ember2, c2: col.gold };

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

  const bubbleMat = bin.add(new THREE.SpriteMaterial({ map: tex.report, transparent: true, depthWrite: false }));
  const bubbleFree = [];
  const bubbleById = new Map();

  const rapierById = new Map();
  const rapierFree = [];
  let aegisObj = null;
  let aegisT = 0;
  let aegisOnField = false;

  // ---------------------------------------------------------------- kamera
  const cam = { x: 0, z: 0, yaw: 0.5, dist: 22, zoom: 1, shake: 0, lookX: 0, lookZ: 0 };
  let W = 16;
  let H = 9;
  let time = 0;
  let disposed = false;

  function resize(w, h) {
    W = Math.max(1, w);
    H = Math.max(1, h);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    const t = Math.tan((FOV * Math.PI) / 360);
    const portrait = W / H < 0.9;
    const halfW = portrait ? 6.2 : 9;
    const halfH = portrait ? 11 : 6.2;
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

  // ---------------------------------------------------------------- olaylar
  function event(type, d, g) {
    const p = g.player;
    switch (type) {
      case 'reset':
        parts.clear();
        rings.clear();
        for (const id of [...rigById.keys()]) releaseRig(id);
        for (const [id, m] of arrowById) { m.root.visible = false; arrowFree.push(m); arrowById.delete(id); }
        for (const [id, s] of bubbleById) { scene.remove(s); bubbleFree.push(s); bubbleById.delete(id); }
        for (const [id, r] of rapierById) { scene.remove(r.root); rapierFree.push(r); rapierById.delete(id); }
        if (aegisObj) aegisObj.root.visible = false;
        aegisOnField = false;
        break;
      case 'spawn': {
        const c = typeColors[d.dog.type];
        if (!d.quiet) {
          rings.fire(d.dog.x, d.dog.z, { color: c, r0: 0.3, r1: 1.8, dur: 0.6 });
          parts.burst(reduced ? 6 : 16, { x: d.dog.x, z: d.dog.z, y: 0.3, color: [c, col.arcane], speed: 2.2, up: 3, life: 0.8, size: 0.22 });
        }
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
        const dg = d.dog;
        const c = typeColors[dg.type];
        const n = reduced ? 5 : d.big ? 22 : 10;
        parts.burst(n, { x: dg.x, z: dg.z, y: 0.55, color: [c, col.white, col.ember2], speed: d.big ? 5 : 3, up: 2.5, g: 9, life: 0.5, size: 0.18 });
        if (d.src === 'ult') parts.burst(6, { x: dg.x, z: dg.z, y: 0.2, color: col.ember, speed: 1.5, up: 0.6, life: 0.7, size: 0.35 });
        break;
      }
      case 'kill': {
        const dg = d.dog;
        const c = typeColors[dg.type];
        rings.fire(dg.x, dg.z, { color: c, r0: 0.3, r1: 1.6, dur: 0.5 });
        parts.burst(reduced ? 8 : 26, { x: dg.x, z: dg.z, y: 0.5, color: [c, col.gold, col.gold2], speed: 4, up: 5, g: 10, life: 0.9, size: 0.22 });
        break;
      }
      case 'multikill':
        rings.fire(p.x, p.z, { color: col.gold, r0: 0.5, r1: 4, dur: 0.7 });
        shake(0.15);
        break;
      case 'hurt':
        parts.burst(reduced ? 4 : 10, { x: p.x, z: p.z, y: 0.9, color: [col.dire, col.white], speed: 3, up: 2, g: 8, life: 0.45, size: 0.16 });
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
        rings.fire(p.x, p.z, { color: col.jade, r0: 0.3, r1: 1.6, dur: 0.6 });
        break;
      case 'tangoStolen':
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
        flashPos.set(d.x, 2.5, d.z);
        flash = 90;
        shake(0.75);
        break;
      }
      case 'waveClear':
        rings.fire(0, 0, { color: col.gold, r0: 0.5, r1: 7, dur: 1.2 });
        if (!reduced) {
          const cols = [col.ember, col.gold, col.gold2, col.jade, col.dire, col.text];
          for (let i = 0; i < 90; i++) {
            parts.spawn({ x: (Math.random() - 0.5) * 1.5, z: (Math.random() - 0.5) * 1.5, y: 1.5, vx: (Math.random() - 0.5) * 9, vz: (Math.random() - 0.5) * 9, vy: 6 + Math.random() * 6, g: 9, drag: 0.6, life: 2 + Math.random(), size: 0.22, size1: 0.14, color: cols[i % cols.length] });
          }
        }
        break;
      case 'pickup': {
        const k = d.pickup;
        rings.fire(k.x, k.z, { color: col.gold, r0: 0.4, r1: 3, dur: 0.7 });
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
        parts.burst(8, { x: d.dog.x, z: d.dog.z, y: 1, color: col.white, speed: 1.5, up: 2, life: 0.4, size: 0.14 });
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- kare
  const seen = new Set();
  function render(g, dt, simDt) {
    if (disposed) return;
    time += dt;
    const p = g.player;
    const playing = g.state === 'playing' || g.state === 'break' || g.state === 'dying';

    // kamera
    let tx = 0;
    let tz = 0;
    let wantZoom = 1;
    if (playing) {
      const ax = p.aimX - p.x;
      const az = p.aimZ - p.z;
      const al = Math.hypot(ax, az) || 1;
      const look = Math.min(1.4, al * 0.15);
      cam.lookX += ((ax / al) * look - cam.lookX) * Math.min(1, dt * 3);
      cam.lookZ += ((az / al) * look - cam.lookZ) * Math.min(1, dt * 3);
      tx = p.x * 0.78 + cam.lookX;
      tz = p.z * 0.78 + cam.lookZ;
      if (g.state === 'dying') { wantZoom = 0.72; tx = p.x; tz = p.z; }
      if (g.slowmo > 0) wantZoom = 0.88;
      let dy = -cam.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      cam.yaw += dy * Math.min(1, dt * 2.5);
    } else {
      cam.yaw += dt * (reduced ? 0.02 : 0.06);
      wantZoom = 1.06;
    }
    const kf = Math.min(1, dt * 4);
    cam.x += (tx - cam.x) * kf;
    cam.z += (tz - cam.z) * kf;
    cam.zoom += (wantZoom - cam.zoom) * Math.min(1, dt * 2.5);
    const D = cam.dist * cam.zoom;
    const hz = Math.cos(PITCH) * D;
    let sx = 0;
    let sy = 0;
    if (cam.shake > 0) {
      const s = cam.shake * 0.5;
      sx = (Math.random() - 0.5) * s;
      sy = (Math.random() - 0.5) * s;
      cam.shake = Math.max(0, cam.shake - dt * 2.2);
    }
    camera.position.set(cam.x + Math.sin(cam.yaw) * hz + sx, Math.sin(PITCH) * D + sy, cam.z + Math.cos(cam.yaw) * hz);
    camera.lookAt(cam.x + sx * 0.5, 0.4, cam.z);

    // meşaleler
    for (const t of torchLights) t.L.intensity = t.base * (0.82 + 0.18 * Math.sin(time * 9 + t.seed) * Math.sin(time * 5.3 + t.seed * 2));
    for (const f of flames) {
      const k = 1 + 0.12 * Math.sin(time * 14 + f.seed) + 0.08 * Math.sin(time * 23 + f.seed);
      f.f.scale.set(0.8 * (2 - k) * 0.9, 1.3 * k, 1);
      f.fg.material.opacity = 0.5;
    }
    floorMat.emissiveIntensity = 0.85 + 0.2 * Math.sin(time * 1.3);
    if (flash > 0) flash = Math.max(0, flash - dt * 160);

    // oyuncu
    archer.update(p, time, dt, g.state === 'over' ? 'hidden' : 'shown');
    heroLight.position.set(p.x, 2.6, p.z + 0.8);
    const showHero = playing;
    playerRing.visible = showHero && !p.dead;
    playerRing.position.set(p.x, 0.05, p.z);
    playerRing.material.opacity = 0.55 + 0.2 * Math.sin(time * 4);
    windRing.visible = showHero && p.windrun > 0;
    windRing.position.set(p.x, 0.06, p.z);
    windRing.rotation.z = time * 5;
    aegisRing.visible = showHero && p.aegis;
    aegisRing.position.set(p.x, 0.055, p.z);
    aegisRing.scale.setScalar(1.6 + Math.sin(time * 3) * 0.08);
    buffGlow.position.set(p.x + Math.sin(p.face) * 0.3, 1.0, p.z + Math.cos(p.face) * 0.3);
    buffGlowMat.opacity = showHero && p.rapier > 0 ? 0.55 + 0.25 * Math.sin(time * 10) : 0;

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
      targetRing.scale.setScalar(1.35 * tg.scale + Math.sin(time * 8) * 0.05);
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

    // sürekli buff parçacıkları
    if (simDt > 0 && showHero && !reduced) {
      if (p.windrun > 0 && p.moving > 0.2) parts.spawn({ x: p.x + (Math.random() - 0.5) * 0.5, z: p.z + (Math.random() - 0.5) * 0.5, y: 0.2 + Math.random() * 0.9, vx: -p.vx * 0.3, vz: -p.vz * 0.3, vy: 0.3, life: 0.45, size: 0.2, size1: 0.02, color: col.jade, floor: false });
      if (p.tango > 0 && Math.random() < 0.35) parts.spawn({ x: p.x + (Math.random() - 0.5) * 0.8, z: p.z + (Math.random() - 0.5) * 0.8, y: 0.2, vx: 0, vz: 0, vy: 1.2, life: 0.9, size: 0.2, size1: 0.05, color: col.jade, floor: false });
      if (p.rapier > 0 && Math.random() < 0.3) parts.spawn({ x: p.x + (Math.random() - 0.5) * 0.6, z: p.z + (Math.random() - 0.5) * 0.6, y: 0.5 + Math.random(), vx: 0, vz: 0, vy: 0.8, life: 0.6, size: 0.14, size1: 0.02, color: col.gold, floor: false });
    }

    // köpekler (etiketler ekranda sabit piksel boyutunda kalsın)
    const pxPerUnit = H / (2 * Math.tan((FOV * Math.PI) / 360) * D);
    const labelScale = Math.max(0.9, Math.min(5, (W < 560 ? 104 : 124) / pxPerUnit));
    seen.clear();
    for (const d of g.dogs) {
      seen.add(d.id);
      const rig = rigById.get(d.id) || acquireRig(d);
      rig.update(d, time, dt, reduced, labelScale);
    }
    for (const id of [...rigById.keys()]) if (!seen.has(id)) releaseRig(id);

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

    // eşyalar
    seen.clear();
    let aegisNow = false;
    for (const k of g.pickups) {
      if (k.kind === 'aegis') {
        aegisNow = true;
        if (!aegisObj) {
          aegisObj = buildAegis(kit, aegisModel ? aegisModel.clone(true) : null);
          scene.add(aegisObj.root);
        }
        if (!aegisOnField) { aegisOnField = true; aegisT = 0; aegisObj.root.visible = true; }
        continue;
      }
      seen.add(k.id);
      let r = rapierById.get(k.id);
      if (!r) {
        r = rapierFree.pop() || buildRapier(kit);
        scene.add(r.root);
        rapierById.set(k.id, r);
      }
      r.root.position.set(k.x, 0, k.z);
      r.sword.rotation.y = time * 2.2;
      r.sword.position.y = 1.05 + Math.sin(time * 3) * 0.1;
      const blink = k.life - k.t < 3 ? (Math.sin(time * 20) > 0 ? 1 : 0.3) : 1;
      r.root.visible = blink > 0.5 || k.life - k.t > 3;
      r.ring.rotation.z = time;
    }
    for (const [id, r] of rapierById) {
      if (!seen.has(id)) {
        scene.remove(r.root);
        rapierFree.push(r);
        rapierById.delete(id);
      }
    }
    if (aegisObj) {
      if (!aegisNow && aegisOnField) {
        aegisOnField = false;
        aegisObj.root.visible = false;
      }
      if (aegisOnField) {
        aegisT += dt;
        const rise = Math.min(1, aegisT / 1.2);
        const e = 1 - Math.pow(1 - rise, 3);
        aegisObj.root.position.y = -2 + 2 * e;
        aegisObj.root.rotation.y = time * 0.9;
        aegisObj.float.position.y = (aegisModel ? 0 : 1.35) + Math.sin(time * 2) * 0.08;
        aegisObj.glowMat.opacity = 0.45 + 0.2 * Math.sin(time * 3);
        aegisObj.beamMat.opacity = 0.3 * e;
      }
    }
    if (flash > 12) {
      fxLight.position.copy(flashPos);
      fxLight.color.copy(col.ember);
      fxLight.intensity = flash;
      fxLight.distance = 18;
    } else if (aegisOnField) {
      fxLight.position.set(0, 2.2, 0);
      fxLight.color.copy(col.gold);
      fxLight.intensity = 14;
      fxLight.distance = 9;
    } else fxLight.intensity = 0;

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
    // havuzdaki (sahnede olmayan) nesneler
    for (const rig of rigFree) { disposeTree(rig.root); disposeTree(rig.labelGroup); }
    for (const m of arrowFree) disposeTree(m.root);
    for (const r of rapierFree) disposeTree(r.root);
    for (const b of bubbleFree) disposeTree(b);
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
    if (dprLevel >= steps.length - 1) return false;
    dprLevel += 1;
    if (steps[dprLevel] >= renderer.getPixelRatio()) return lowerQuality();
    renderer.setPixelRatio(steps[dprLevel]);
    resize(W, H);
    return true;
  }

  return { kind: '3d', canvas, resize, render, project, groundAt, event, shake, dispose, lowerQuality, modelInfo: { dog: !!dogModel, archer: !!archerModel, aegis: !!aegisModel } };
}

