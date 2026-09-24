// Ana sayfa kahraman sahnesi: "1 vs 9" dioraması (three.js).
// Gece gökyüzünde süzülen altıgen taş ada, çapraz parlayan nehir, Radiant (yeşim) ve Dire (kor) kristalleri,
// merkezde tek kahraman ve etrafında zıplayarak dönen 9 DOG. Yükselen korlar, sis, sıcak/soğuk ışık ayrımı.
//
// createHero3D(host, { getFocus, reduced, pointerEl, onPoke, onLost }) → { react(), destroy() } | null
//   getFocus(w, h) → { x, y, w, h }  dioramanın sığacağı dikdörtgen (tuval pikselleri; x/y merkez)
//   reduced        → hareket azaltılmışsa tek kare çizilir, döngü yok
//   onPoke(arch, clientX, clientY) → bir DOG'a tıklanınca
//   onLost()       → WebGL bağlamı beklenmedik biçimde kaybolursa
// WebGL oluşturulamazsa null döner (çağıran taraf 2D yedeğe geçer).

import * as THREE from 'three';
import { ARCHETYPES } from '../../data/archetypes.js';
import { loadModel, hasModel } from '../../core/models.js';
import { artUrl } from '../../core/assets.js';
import { seeded } from '../../core/dom.js';

const TAU = Math.PI * 2;
const R = 4; // ada yarıçapı (köşe)
const SLAB_H = 0.36;
const ORBIT = 2.3;
const FOV = 30;
const BASE_THETA = 0.2;
const BASE_ELEV = 0.43;
const TARGET_Y = -0.55;

function token(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

export function webglSupported() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

export function createHero3D(host, { getFocus, reduced = false, pointerEl = host, onPoke, onLost } = {}) {
  if (!webglSupported()) return null;
  const isMobile = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || innerWidth < 720;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    console.warn('WebGL başlatılamadı', e);
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const canvas = renderer.domElement;
  canvas.className = 'hm-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  // ------------------------------------------------------------ renkler (tasarım jetonlarından)
  const hex = {
    bg: token('--bg', '#0d0b14'),
    bg3: token('--bg-3', '#1e1a2b'),
    bg4: token('--bg-4', '#282238'),
    line2: token('--line-2', '#433a5c'),
    ember: token('--ember', '#ff6a2b'),
    ember2: token('--ember-2', '#ff9a3d'),
    emberDeep: token('--ember-deep', '#c2410c'),
    aegis: token('--aegis', '#e9b949'),
    aegis2: token('--aegis-2', '#f6d98a'),
    radiant: token('--radiant', '#43d6a0'),
    radiantDeep: token('--radiant-deep', '#1f8a63'),
    dire: token('--dire', '#e0354b'),
    direDeep: token('--dire-deep', '#8f1d2c'),
    arcane: token('--arcane', '#8b7cff'),
    text: token('--text', '#f3eadb'),
  };
  const col = (k) => new THREE.Color(hex[k]);

  let disposed = false;
  let running = false;
  const disposables = new Set();
  const keep = (x) => { disposables.add(x); return x; };
  const rnd = seeded(1109);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(col('bg'), 14, 40);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 260);
  const world = new THREE.Group();
  scene.add(world);

  // ------------------------------------------------------------ dokular
  const glowTex = keep(radialTexture([[0, 1], [0.22, 0.55], [0.55, 0.12], [1, 0]]));
  const shadowTex = keep(radialTexture([[0, 0.55], [0.5, 0.25], [1, 0]], '0,0,0'));
  const mistTex = keep(cloudTexture());

  // ------------------------------------------------------------ ışıklar
  scene.add(new THREE.HemisphereLight(new THREE.Color(hex.arcane).multiplyScalar(0.75), col('bg'), 1.05));
  const warm = new THREE.DirectionalLight(col('ember2'), 2.6);
  warm.position.set(7, 9, 4);
  scene.add(warm);
  const cool = new THREE.DirectionalLight(col('arcane'), 1.6);
  cool.position.set(-8, 4, -5);
  scene.add(cool);
  const fill = new THREE.DirectionalLight(col('text'), 0.35);
  fill.position.set(0, 3, 10);
  scene.add(fill);

  // ------------------------------------------------------------ ada
  const axis = new THREE.Vector2(0.866, -0.5); // Radiant → Dire (xz)
  const radPos = new THREE.Vector3(-axis.x, 0, -axis.y).multiplyScalar(R * 0.7);
  const direPos = new THREE.Vector3(axis.x, 0, axis.y).multiplyScalar(R * 0.7);

  const arenaTexUrl = artUrl('texture-arena');
  const topUniforms = {
    uTime: { value: 0 },
    uShock: { value: -1 },
    uR: { value: R },
    uAxis: { value: axis },
    uStone: { value: col('line2') },
    uStoneDark: { value: col('bg3') },
    uRad: { value: col('radiant') },
    uDire: { value: col('dire') },
    uEmber: { value: col('ember') },
    uGold: { value: col('aegis') },
    uRiver: { value: new THREE.Color('#3fb7e0') },
    uTex: { value: null },
    uHasTex: { value: 0 },
  };
  if (arenaTexUrl) {
    new THREE.TextureLoader().load(arenaTexUrl, (t) => {
      if (disposed) { t.dispose(); return; }
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      keep(t);
      topUniforms.uTex.value = t;
      topUniforms.uHasTex.value = 1;
      if (!running) renderOnce();
    }, undefined, () => {});
  }
  const topMat = keep(new THREE.ShaderMaterial({ uniforms: topUniforms, vertexShader: TOP_VERT, fragmentShader: TOP_FRAG }));
  const sideMat = keep(new THREE.MeshStandardMaterial({ color: col('bg4'), roughness: 0.92, metalness: 0.05, flatShading: true }));
  const slab = new THREE.Mesh(keep(new THREE.CylinderGeometry(R, R * 0.97, SLAB_H, 6, 1)), [sideMat, topMat, sideMat]);
  slab.position.y = -SLAB_H / 2;
  world.add(slab);

  // altın kenar (altıgen halka)
  const rimGeo = keep(new THREE.TorusGeometry(R + 0.015, 0.055, 4, 6));
  rimGeo.rotateX(Math.PI / 2);
  rimGeo.rotateY(Math.PI / 6);
  const goldMat = keep(new THREE.MeshStandardMaterial({ color: col('aegis'), metalness: 0.85, roughness: 0.3, emissive: col('aegis'), emissiveIntensity: 0.28 }));
  const rim = new THREE.Mesh(rimGeo, goldMat);
  rim.position.y = 0.01;
  world.add(rim);

  // toprak katmanı + sarkık kaya
  const strata = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(R * 0.97, R * 0.86, 0.55, 6, 1)),
    keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(hex.emberDeep).lerp(col('bg3'), 0.72), roughness: 1, flatShading: true })),
  );
  strata.position.y = -SLAB_H - 0.275;
  world.add(strata);

  const rock = new THREE.Mesh(rockGeometry(R * 0.86, 0.2, 3.3, rnd, keep), keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true })));
  rock.position.y = -SLAB_H - 0.55 - 1.65;
  world.add(rock);
  paintRock(rock.geometry, new THREE.Color(hex.bg4).lerp(col('emberDeep'), 0.18), new THREE.Color(hex.bg).lerp(col('arcane'), 0.12));

  // sarkıtlar
  const stalGeo = keep(new THREE.ConeGeometry(0.35, 1.4, 5));
  stalGeo.rotateX(Math.PI);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.4;
    const s = new THREE.Mesh(stalGeo, rock.material);
    const rr = 1.6 + rnd() * 0.9;
    s.position.set(Math.sin(a) * rr, -2.2 - rnd() * 0.8, Math.cos(a) * rr);
    s.scale.setScalar(0.6 + rnd() * 0.6);
    world.add(s);
  }

  // kayaya gömülü küçük kristaller
  const shardGeo = keep(new THREE.OctahedronGeometry(0.22, 0));
  const jadeMat = keep(new THREE.MeshStandardMaterial({ color: col('radiant'), emissive: col('radiantDeep'), emissiveIntensity: 1.4, roughness: 0.2, metalness: 0.1, flatShading: true }));
  const direMat = keep(new THREE.MeshStandardMaterial({ color: col('dire'), emissive: col('emberDeep'), emissiveIntensity: 1.6, roughness: 0.25, metalness: 0.1, flatShading: true }));
  [[-2.6, -1.0, 1.3, jadeMat], [-2.2, -1.6, 0.4, jadeMat], [2.5, -1.1, -1.2, direMat], [1.9, -1.8, -1.9, direMat], [0.6, -1.3, 2.6, jadeMat], [0.5, -1.2, -2.8, direMat]].forEach(([x, y, z, m]) => {
    const s = new THREE.Mesh(shardGeo, m);
    s.position.set(x, y, z);
    s.scale.set(1, 2.2, 1);
    s.lookAt(x * 3, y - 2, z * 3);
    s.rotateX(Math.PI / 2);
    world.add(s);
  });

  // ------------------------------------------------------------ Radiant ağaçları / Dire dikenleri
  const pineGeo = keep(new THREE.ConeGeometry(0.28, 0.7, 6));
  const trunkGeo = keep(new THREE.CylinderGeometry(0.04, 0.05, 0.25, 5));
  const pineMat = keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(hex.radiantDeep).lerp(col('bg'), 0.35), roughness: 0.8, flatShading: true }));
  const trunkMat = keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(hex.emberDeep).lerp(col('bg'), 0.6), roughness: 1 }));
  const spikeGeo = keep(new THREE.ConeGeometry(0.1, 0.9, 4));
  const spikeMat = keep(new THREE.MeshStandardMaterial({ color: col('bg3'), emissive: col('direDeep'), emissiveIntensity: 0.5, roughness: 0.6, flatShading: true }));
  const placeOnHex = (angleDeg, rr) => {
    const a = (angleDeg * Math.PI) / 180;
    return new THREE.Vector3(Math.sin(a) * rr, 0, Math.cos(a) * rr);
  };
  [[262, 3.05], [280, 3.25], [338, 3.1], [322, 2.95], [245, 3.2], [355, 3.25]].forEach(([deg, rr], i) => {
    const p = placeOnHex(deg, rr);
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.12;
    const c1 = new THREE.Mesh(pineGeo, pineMat);
    c1.position.y = 0.55;
    const c2 = new THREE.Mesh(pineGeo, pineMat);
    c2.position.y = 0.85;
    c2.scale.setScalar(0.72);
    tree.add(trunk, c1, c2);
    tree.position.copy(p);
    tree.scale.setScalar(0.75 + ((i * 37) % 10) / 25);
    tree.rotation.y = i;
    world.add(tree);
  });
  [[82, 3.05], [100, 3.25], [158, 3.1], [142, 2.95], [65, 3.2], [175, 3.2]].forEach(([deg, rr], i) => {
    const p = placeOnHex(deg, rr);
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const s = new THREE.Mesh(spikeGeo, spikeMat);
      s.position.set((k - 1) * 0.12, 0.35, ((k * 7) % 3 - 1) * 0.08);
      s.rotation.z = (k - 1) * 0.35;
      s.scale.y = 0.7 + k * 0.25;
      g.add(s);
    }
    g.position.copy(p);
    g.rotation.y = i * 1.3;
    world.add(g);
  });

  // ------------------------------------------------------------ Ancient'lar
  const sprites = [];
  const glowSprite = (color, scale, opacity = 0.6) => {
    const m = keep(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity, fog: false }));
    const s = new THREE.Sprite(m);
    s.scale.setScalar(scale);
    s.userData.baseOpacity = opacity;
    sprites.push(s);
    return s;
  };
  const pedestalGeo = keep(new THREE.CylinderGeometry(0.55, 0.72, 0.28, 6));
  const pedestalMat = keep(new THREE.MeshStandardMaterial({ color: col('bg4'), roughness: 0.7, metalness: 0.2, flatShading: true }));

  const radiant = new THREE.Group();
  radiant.position.copy(radPos);
  {
    const ped = new THREE.Mesh(pedestalGeo, pedestalMat);
    ped.position.y = 0.14;
    const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(0.64, 0.035, 4, 6)), goldMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.29;
    const crystalGeo = keep(new THREE.OctahedronGeometry(0.45, 0));
    const main = new THREE.Mesh(crystalGeo, jadeMat);
    main.scale.set(0.75, 2.1, 0.75);
    main.position.y = 1.35;
    const sats = new THREE.Group();
    sats.position.y = 1.2;
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(crystalGeo, jadeMat);
      const a = (i / 4) * TAU;
      s.position.set(Math.cos(a) * 0.7, Math.sin(i * 1.7) * 0.25, Math.sin(a) * 0.7);
      s.scale.set(0.25, 0.55, 0.25);
      sats.add(s);
    }
    const light = new THREE.PointLight(col('radiant'), 9, 8, 1.6);
    light.position.y = 1.4;
    const glow = glowSprite(col('radiant'), 3.4, 0.5);
    glow.position.y = 1.35;
    radiant.add(ped, ring, main, sats, light, glow);
    radiant.userData = { main, sats, light };
  }
  world.add(radiant);

  const dire = new THREE.Group();
  dire.position.copy(direPos);
  {
    const ped = new THREE.Mesh(pedestalGeo, pedestalMat);
    ped.position.y = 0.14;
    const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(0.64, 0.035, 4, 6)), goldMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.29;
    const spikeG = keep(new THREE.ConeGeometry(0.26, 1.9, 4));
    const cluster = new THREE.Group();
    cluster.position.y = 0.28;
    const defs = [[0, 0, 0, 1.15], [0.28, 0.1, -0.5, 0.75], [-0.3, -0.1, 0.45, 0.7], [0.1, 0.3, 0.6, 0.55], [-0.2, -0.3, -0.55, 0.6]];
    defs.forEach(([ox, oz, tilt, s], i) => {
      const m = new THREE.Mesh(spikeG, direMat);
      m.scale.set(s, s, s);
      m.position.set(ox, (1.9 * s) / 2 - 0.05, oz);
      m.rotation.set(tilt * 0.6, i * 0.9, tilt);
      cluster.add(m);
    });
    const light = new THREE.PointLight(col('ember'), 11, 8, 1.6);
    light.position.y = 1.4;
    const glow = glowSprite(col('ember'), 3.6, 0.55);
    glow.position.y = 1.2;
    dire.add(ped, ring, cluster, light, glow);
    dire.userData = { cluster, light, glow };
  }
  world.add(dire);

  // ------------------------------------------------------------ Kahraman (merkez)
  const heroRoot = new THREE.Group();
  world.add(heroRoot);
  const heroSpin = new THREE.Group();
  heroRoot.add(heroSpin);
  const heroLight = new THREE.PointLight(col('aegis'), 7, 6, 1.5);
  heroLight.position.y = 2.1;
  heroRoot.add(heroLight);
  const auraMat = keep(new THREE.MeshBasicMaterial({ color: col('aegis'), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const aura = new THREE.Mesh(keep(new THREE.RingGeometry(0.62, 0.7, 6)), auraMat);
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.012;
  heroRoot.add(aura);
  const beamMat = keep(new THREE.ShaderMaterial({
    uniforms: { uColor: { value: col('aegis') }, uIntensity: { value: 0.55 } },
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  }));
  const beam = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.42, 0.62, 4.2, 24, 1, true)), beamMat);
  beam.position.y = 2.1;
  heroRoot.add(beam);
  const heroShadow = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.3, 1.3)), keep(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })));
  heroShadow.rotation.x = -Math.PI / 2;
  heroShadow.position.y = 0.006;
  heroRoot.add(heroShadow);

  let heroModel = null;
  if (hasModel('model-archer')) {
    loadModel('model-archer', { height: 1.8 }).then((m) => {
      if (disposed) return;
      heroModel = m || buildArcher(keep, hex);
      heroSpin.add(heroModel);
      if (!running) renderOnce();
    });
  } else {
    heroModel = buildArcher(keep, hex);
    heroSpin.add(heroModel);
  }

  // ------------------------------------------------------------ 9 DOG
  const dogTypes = ARCHETYPES.slice(0, 9);
  const dogs = [];
  const haloGeo = keep(new THREE.RingGeometry(0.4, 0.47, 32));
  const dogShadowGeo = keep(new THREE.PlaneGeometry(0.85, 0.85));
  const dogShadowMat = keep(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  const RAGE = col('dire');
  const kit = buildDogKit(keep, hex);
  const useDogModel = hasModel('model-dog');

  dogTypes.forEach((arch, i) => {
    const base = new THREE.Color(arch.color);
    const holder = new THREE.Group();
    const rig = new THREE.Group();
    holder.add(rig);
    const haloMat = keep(new THREE.MeshBasicMaterial({ color: base.clone(), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.014;
    const shadow = new THREE.Mesh(dogShadowGeo, dogShadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.008;
    holder.add(halo, shadow);
    const eyeMat = keep(new THREE.MeshBasicMaterial({ color: base.clone() }));
    const eyeGlows = [];
    const d = {
      arch, i, holder, rig, halo, haloMat, shadow, eyeMat, eyeGlows, base, tail: null,
      phase: rnd() * TAU, speed: 3 + rnd() * 1.2, scale: 0.9 + rnd() * 0.2,
      jumpY: 0, vy: 0, spin: 0, spinning: false, delay: -1, wobble: rnd() * TAU,
    };
    if (!useDogModel) {
      const body = buildProceduralDog(kit, i, eyeMat);
      rig.add(body.group);
      d.tail = body.tail;
      body.eyes.forEach((p) => {
        const g = glowSprite(base.clone(), 0.2, 0.9);
        g.position.copy(p);
        rig.add(g);
        eyeGlows.push(g);
      });
    } else {
      const g = glowSprite(base.clone(), 0.5, 0.85);
      g.position.set(0, 0.95, 0);
      rig.add(g);
      eyeGlows.push(g);
      loadModel('model-dog', { height: 0.8 }).then((m) => {
        if (disposed) return;
        if (m) rig.add(m);
        else {
          const body = buildProceduralDog(kit, i, eyeMat);
          rig.add(body.group);
          d.tail = body.tail;
        }
        if (!running) renderOnce();
      });
    }
    rig.scale.setScalar(d.scale);
    world.add(holder);
    dogs.push(d);
  });

  // ------------------------------------------------------------ şok dalgası
  const shockMat = keep(new THREE.MeshBasicMaterial({ color: col('ember'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const shockMat2 = keep(new THREE.MeshBasicMaterial({ color: col('aegis'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const shockGeo = keep(new THREE.RingGeometry(0.92, 1, 72));
  const shock1 = new THREE.Mesh(shockGeo, shockMat);
  const shock2 = new THREE.Mesh(shockGeo, shockMat2);
  [shock1, shock2].forEach((m) => { m.rotation.x = -Math.PI / 2; m.position.y = 0.05; m.visible = false; world.add(m); });

  // ------------------------------------------------------------ uzak adacıklar (sağda ve arkada; metnin arkasına düşmez)
  const islets = [];
  const isletMat = keep(new THREE.MeshStandardMaterial({ color: col('line2'), roughness: 0.9, flatShading: true }));
  const isletGeo = keep(new THREE.DodecahedronGeometry(1, 0));
  [[10, 2.4, -19, 1.0, 'jade'], [13.5, -2.6, -5, 0.8, 'dire'], [3.5, 4.2, -26, 0.9, 'dire']].forEach(([x, y, z, s, kind], i) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(isletGeo, isletMat);
    m.scale.set(s * 1.5, s * 0.8, s * 1.3);
    m.position.y = -s * 0.45;
    const c = new THREE.Mesh(shardGeo, kind === 'jade' ? jadeMat : direMat);
    c.scale.set(1.1 * s, 2.4 * s, 1.1 * s);
    c.position.y = s * 0.5;
    const glow = glowSprite(col(kind === 'jade' ? 'radiant' : 'ember'), 2.4 * s, 0.35);
    glow.position.y = s * 0.55;
    g.add(m, c, glow);
    g.position.set(x, y, z);
    g.rotation.y = i * 1.1;
    g.userData = { y, phase: i * 1.7 };
    scene.add(g);
    islets.push(g);
  });

  // ------------------------------------------------------------ sis
  const mists = [];
  [[-3, -3.6, 2, 9, 0.22], [4, -4.2, -1, 11, 0.2], [0, -5.4, -4, 14, 0.16], [-7, -1.4, -8, 10, 0.1]].forEach(([x, y, z, s, o], i) => {
    const m = keep(new THREE.SpriteMaterial({ map: mistTex, color: new THREE.Color(hex.arcane).lerp(col('bg3'), 0.35), transparent: true, opacity: o, depthWrite: false, fog: false }));
    const sp = new THREE.Sprite(m);
    sp.scale.set(s, s * 0.45, 1);
    sp.position.set(x, y, z);
    sp.userData = { x, phase: i * 2.1 };
    scene.add(sp);
    mists.push(sp);
  });

  // ------------------------------------------------------------ yıldızlar + korlar
  const pr = renderer.getPixelRatio();
  const stars = makeStars(isMobile ? 420 : 900, rnd, keep, hex, pr);
  scene.add(stars);
  const embers = makeEmbers(isMobile ? 90 : 170, rnd, keep, hex, pr);
  world.add(embers);

  // ------------------------------------------------------------ durum
  let raf = 0;
  let last = 0;
  let t = 3.2;
  let visible = true;
  let dist = 18;
  let shockT = -1;
  let shake = 0;
  let rage = 0;
  let rageHold = 0;
  let emberProg = 0;
  let boost = 0;
  let aimIdx = 0;
  let aimTimer = 0;
  let heroYaw = 0;
  let reduceTimer = 0;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const target = new THREE.Vector3(0, TARGET_Y, 0);
  const tmpV = new THREE.Vector3();
  const tmpC = new THREE.Color();

  function placeCamera() {
    const th = BASE_THETA + (reduced ? 0 : Math.sin(t * 0.11) * 0.3) + mouse.x * 0.2;
    const el = BASE_ELEV + (reduced ? 0 : Math.sin(t * 0.07) * 0.035) + mouse.y * 0.06;
    camera.position.set(
      target.x + dist * Math.cos(el) * Math.sin(th),
      target.y + dist * Math.sin(el),
      target.z + dist * Math.cos(el) * Math.cos(th),
    );
    if (shake > 0.002) {
      camera.position.x += (Math.sin(t * 91) + Math.sin(t * 57)) * 0.09 * shake;
      camera.position.y += Math.sin(t * 73) * 0.12 * shake;
    }
    camera.lookAt(target);
  }

  function dogAngle(d) {
    return (d.i / dogs.length) * TAU + t * 0.16;
  }

  function update(dt) {
    t += dt;
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 3);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 3);
    world.position.y = Math.sin(t * 0.6) * 0.08;
    topUniforms.uTime.value = t;

    // tepki zamanlayıcıları
    if (shockT >= 0) {
      shockT += dt;
      topUniforms.uShock.value = shockT;
      const a = Math.min(1, shockT / 0.9);
      shock1.visible = a < 1;
      shock1.scale.setScalar(0.4 + a * 6.2);
      shockMat.opacity = Math.pow(1 - a, 1.4) * 0.95;
      const b = Math.max(0, Math.min(1, (shockT - 0.12) / 0.9));
      shock2.visible = shockT > 0.12 && b < 1;
      shock2.scale.setScalar(0.3 + b * 5.2);
      shockMat2.opacity = Math.pow(1 - b, 1.6) * 0.8;
      if (shockT > 1.4) { shockT = -1; topUniforms.uShock.value = -1; shock1.visible = shock2.visible = false; }
    }
    shake = Math.max(0, shake - dt * 2.2);
    if (rageHold > 0) rageHold -= dt;
    else rage = Math.max(0, rage - dt * 0.7);
    boost = Math.max(0, boost - dt * 0.8);
    emberProg += dt * (1 + boost * 4);
    embers.material.uniforms.uProg.value = emberProg;
    embers.material.uniforms.uBoost.value = boost;
    stars.material.uniforms.uTime.value = t;

    // Ancient'lar
    radiant.userData.main.rotation.y += dt * 0.5;
    radiant.userData.main.position.y = 1.35 + Math.sin(t * 1.3) * 0.08;
    radiant.userData.sats.rotation.y -= dt * 0.7;
    radiant.userData.light.intensity = 9 + Math.sin(t * 2) * 1.5;
    dire.userData.cluster.rotation.y -= dt * 0.18;
    dire.userData.light.intensity = 11 + Math.sin(t * 2.6) * 2 + rage * 18;
    dire.userData.glow.material.opacity = 0.55 + rage * 0.4;

    // Kahraman: sırayla DOG'lara nişan alır
    aimTimer -= dt;
    if (aimTimer <= 0) {
      // yalnızca kameraya dönük yarıdaki DOG'lara nişan al (kahramanın yüzü görünsün)
      const camA = Math.atan2(camera.position.x - target.x, camera.position.z - target.z);
      for (let k = 1; k <= dogs.length; k++) {
        const cand = (aimIdx + k * 4) % dogs.length;
        if (Math.cos(dogAngle(dogs[cand]) - camA) > 0.25) { aimIdx = cand; break; }
      }
      aimTimer = 1.9;
    }
    const aimA = dogAngle(dogs[aimIdx]) + 0.25;
    let diff = aimA - heroYaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    heroYaw += diff * Math.min(1, dt * 3.5);
    heroSpin.rotation.y = heroYaw;
    heroSpin.position.y = Math.sin(t * 1.6) * 0.03;
    aura.rotation.z += dt * 0.35;
    auraMat.opacity = 0.45 + Math.sin(t * 2.2) * 0.12 + boost * 0.4;
    beamMat.uniforms.uIntensity.value = 0.5 + Math.sin(t * 1.7) * 0.08 + boost * 0.7;
    heroLight.intensity = 7 + boost * 16;

    // DOG'lar
    const alert = Math.min(1, rage * 1.4);
    for (const d of dogs) {
      const a = dogAngle(d);
      const r = ORBIT + Math.sin(t * 0.7 + d.wobble) * 0.12;
      d.holder.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      const face = a + Math.PI / 2 + 0.35 + alert * (Math.PI / 2 - 0.35);
      d.holder.rotation.y = face;
      if (d.delay >= 0) {
        d.delay -= dt;
        if (d.delay < 0) { d.vy = 3.6 + (d.i % 3) * 0.35; d.spinning = true; d.spin = 0; }
      }
      if (d.vy !== 0 || d.jumpY > 0) {
        d.vy -= 11 * dt;
        d.jumpY += d.vy * dt;
        if (d.jumpY <= 0) { d.jumpY = 0; d.vy = 0; }
      }
      if (d.spinning) {
        d.spin = Math.min(1, d.spin + dt * 1.6);
        if (d.spin >= 1) { d.spinning = false; d.spin = 0; }
      }
      const hop = Math.abs(Math.sin(t * d.speed + d.phase)) * 0.16;
      d.rig.position.y = hop + d.jumpY;
      d.rig.rotation.y = d.spinning ? easeInOut(d.spin) * TAU : 0;
      d.rig.rotation.x = -Math.cos(t * d.speed + d.phase) * 0.08;
      if (d.tail) d.tail.rotation.z = Math.sin(t * 14 + d.phase) * 0.6;
      const lift = d.rig.position.y;
      d.shadow.scale.setScalar(Math.max(0.45, 1 - lift * 0.5));
      tmpC.copy(d.base).lerp(RAGE, Math.min(1, rage * 1.2));
      d.eyeMat.color.copy(tmpC);
      d.haloMat.color.copy(tmpC);
      d.haloMat.opacity = 0.6 + rage * 0.35;
      for (const g of d.eyeGlows) {
        g.material.color.copy(tmpC);
        const s = (g.userData.base || (g.userData.base = g.scale.x)) * (1 + rage * 1.6);
        g.scale.setScalar(s);
      }
    }

    for (const g of islets) g.position.y = g.userData.y + Math.sin(t * 0.4 + g.userData.phase) * 0.35;
    for (const m of mists) m.position.x = m.userData.x + Math.sin(t * 0.05 + m.userData.phase) * 1.5;

    placeCamera();
  }

  function renderOnce() {
    if (disposed) return;
    update(0);
    renderer.render(scene, camera);
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    renderer.render(scene, camera);
  }

  function start() {
    if (running || disposed || reduced) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
  }
  function sync() {
    if (visible && !document.hidden && !reduced) start();
    else stop();
  }

  function resize() {
    if (disposed) return;
    const w = Math.max(1, host.clientWidth);
    const hgt = Math.max(1, host.clientHeight);
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    const f = (getFocus && getFocus(w, hgt)) || { x: w / 2, y: hgt / 2, w, h: hgt };
    const ppu = Math.max(8, Math.min(f.w / 9.2, f.h / 7.6));
    dist = Math.min(80, Math.max(9, hgt / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * ppu)));
    scene.fog.near = dist - 3;
    scene.fog.far = dist + 26;
    camera.setViewOffset(w, hgt, w / 2 - f.x, hgt / 2 - f.y, w, hgt);
    camera.updateProjectionMatrix();
    embers.material.uniforms.uScale.value = hgt / 2;
    stars.material.uniforms.uScale.value = 1;
    if (!running) renderOnce();
  }

  // ------------------------------------------------------------ olaylar
  const ro = new ResizeObserver(() => resize());
  ro.observe(host);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) visible = e.isIntersecting;
    sync();
  }, { threshold: 0 });
  io.observe(host);
  const onVis = () => sync();
  document.addEventListener('visibilitychange', onVis);

  const onMove = (e) => {
    const r = pointerEl.getBoundingClientRect();
    mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    const hit = pickDog(e.clientX, e.clientY);
    canvas.style.cursor = hit ? 'pointer' : '';
  };
  const onLeave = () => { mouse.tx = 0; mouse.ty = 0; };
  const onClick = (e) => {
    const d = pickDog(e.clientX, e.clientY);
    if (!d) return;
    if (d.jumpY <= 0.01) { d.vy = 3.2; d.spinning = true; d.spin = 0; }
    if (onPoke) onPoke(d.arch, e.clientX, e.clientY);
    if (!running) renderOnce();
  };
  pointerEl.addEventListener('pointermove', onMove);
  pointerEl.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('click', onClick);

  const onContextLost = (e) => {
    e.preventDefault();
    if (disposed) return;
    stop();
    if (onLost) onLost();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  function pickDog(cx, cy) {
    const r = canvas.getBoundingClientRect();
    if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
    let best = null;
    let bestD = Infinity;
    const radius = Math.max(22, r.height * 0.045);
    for (const d of dogs) {
      d.rig.getWorldPosition(tmpV);
      tmpV.y += 0.35;
      tmpV.project(camera);
      const sx = r.left + ((tmpV.x + 1) / 2) * r.width;
      const sy = r.top + ((1 - tmpV.y) / 2) * r.height;
      const dd = Math.hypot(sx - cx, sy - cy);
      if (dd < radius && dd < bestD) { best = d; bestD = dd; }
    }
    return best;
  }

  resize();
  renderOnce();
  sync();

  return {
    /** "DOG'la!" tepkisi: zıplama, kırmızı gözler, şok dalgası, kamera sarsıntısı. */
    react() {
      if (disposed) return;
      rage = 1;
      rageHold = 1.3;
      if (reduced) {
        renderOnce();
        clearTimeout(reduceTimer);
        reduceTimer = setTimeout(() => { rage = 0; renderOnce(); }, 1600);
        return;
      }
      shockT = 0;
      shake = 1;
      boost = 1;
      dogs.forEach((d, i) => { if (d.jumpY <= 0.01) d.delay = i * 0.045; });
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      stop();
      clearTimeout(reduceTimer);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      pointerEl.removeEventListener('pointermove', onMove);
      pointerEl.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('click', onClick);
      scene.traverse((o) => {
        if (o.geometry) disposables.add(o.geometry);
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          disposables.add(m);
          for (const v of Object.values(m)) if (v && v.isTexture) disposables.add(v);
          if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u && u.value && u.value.isTexture) disposables.add(u.value);
        }
      });
      for (const x of disposables) { try { x.dispose(); } catch { /* yok say */ } }
      disposables.clear();
      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.remove();
    },
  };
}

// ====================================================================== yardımcılar

function easeInOut(x) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function radialTexture(stops, rgb = '255,255,255') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [o, a] of stops) grd.addColorStop(o, `rgba(${rgb},${a})`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  const r = seeded(77);
  for (let i = 0; i < 26; i++) {
    const x = 40 + r() * 176;
    const y = 40 + r() * 48;
    const rad = 18 + r() * 34;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function rockGeometry(top, bottom, height, rnd, keep) {
  const geo = keep(new THREE.CylinderGeometry(top, bottom, height, 6, 6));
  const pos = geo.attributes.position;
  const offs = new Map();
  const topY = height / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = `${x.toFixed(3)}|${y.toFixed(3)}|${z.toFixed(3)}`;
    if (!offs.has(key)) offs.set(key, [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
    const [a, b, c] = offs.get(key);
    const k = y < topY - 0.01 ? 1 : 0;
    const depth = (topY - y) / height;
    pos.setXYZ(i, x + a * 0.7 * k * (0.4 + depth), y + b * 0.35 * k, z + c * 0.7 * k * (0.4 + depth));
  }
  geo.computeVertexNormals();
  return geo;
}

function paintRock(geo, topCol, bottomCol) {
  const pos = geo.attributes.position;
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const k = (pos.getY(i) - min.y) / (max.y - min.y || 1);
    c.copy(bottomCol).lerp(topCol, Math.pow(k, 0.8));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function makeStars(n, rnd, keep, hex, pr) {
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  const tint = new Float32Array(n * 3);
  const palette = [new THREE.Color(hex.text), new THREE.Color(hex.aegis2), new THREE.Color(hex.arcane), new THREE.Color(hex.text)];
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1;
    const th = rnd() * TAU;
    const rr = 70 + rnd() * 50;
    const s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(th) * s * rr, u * rr * 0.8 + 10, Math.sin(th) * s * rr], i * 3);
    seed[i] = rnd();
    const c = palette[i % palette.length];
    tint.set([c.r, c.g, c.b], i * 3);
  }
  const geo = keep(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
  const mat = keep(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPR: { value: pr }, uScale: { value: 1 } },
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

function makeEmbers(n, rnd, keep, hex, pr) {
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  const speed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU;
    const rr = Math.sqrt(rnd()) * 6;
    pos.set([Math.cos(a) * rr, rnd() * 10, Math.sin(a) * rr], i * 3);
    seed[i] = rnd();
    speed[i] = 0.25 + rnd() * 0.6;
  }
  const geo = keep(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  const mat = keep(new THREE.ShaderMaterial({
    uniforms: {
      uProg: { value: 0 },
      uBoost: { value: 0 },
      uPR: { value: pr },
      uScale: { value: 400 },
      uA: { value: new THREE.Color(hex.ember) },
      uB: { value: new THREE.Color(hex.aegis2) },
    },
    vertexShader: EMBER_VERT,
    fragmentShader: EMBER_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// ---------------------------------------------------------------------- prosedürel DOG
function buildDogKit(keep, hex) {
  const g = {
    body: keep(new THREE.CapsuleGeometry(0.16, 0.3, 4, 10)),
    leg: keep(new THREE.CylinderGeometry(0.045, 0.04, 0.22, 6)),
    head: keep(new THREE.SphereGeometry(0.16, 16, 12)),
    snout: keep(new THREE.SphereGeometry(0.08, 12, 8)),
    nose: keep(new THREE.SphereGeometry(0.032, 8, 6)),
    eye: keep(new THREE.SphereGeometry(0.03, 8, 6)),
    ear: keep(new THREE.BoxGeometry(0.05, 0.17, 0.11)),
    helmet: keep(new THREE.SphereGeometry(0.178, 16, 8, 0, TAU, 0, Math.PI / 2)),
    helmetRim: keep(new THREE.TorusGeometry(0.175, 0.018, 4, 20)),
    horn: keep(new THREE.ConeGeometry(0.035, 0.17, 6)),
    scarf: keep(new THREE.TorusGeometry(0.115, 0.038, 6, 14)),
    knot: keep(new THREE.ConeGeometry(0.05, 0.13, 4)),
    pack: keep(new THREE.BoxGeometry(0.2, 0.12, 0.16)),
    tail: keep(new THREE.CylinderGeometry(0.022, 0.036, 0.2, 5)),
  };
  const furs = ['#c98b4f', '#8a5a3b', '#e3c79a', '#8d8a99', '#d9772f', '#5b4a44'].map((c) => keep(new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })));
  const m = {
    furs,
    light: keep(new THREE.MeshStandardMaterial({ color: '#f1dfbf', roughness: 0.85 })),
    dark: keep(new THREE.MeshStandardMaterial({ color: '#17121d', roughness: 0.4 })),
    bronze: keep(new THREE.MeshStandardMaterial({ color: '#b27a3c', metalness: 0.75, roughness: 0.32, emissive: '#3a1e08', emissiveIntensity: 0.4 })),
    bone: keep(new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.6 })),
    scarf: keep(new THREE.MeshStandardMaterial({ color: hex.dire, roughness: 0.7 })),
    leather: keep(new THREE.MeshStandardMaterial({ color: '#6b4428', roughness: 0.9 })),
  };
  return { g, m };
}

function buildProceduralDog(kit, idx, eyeMat) {
  const { g, m } = kit;
  const fur = m.furs[idx % m.furs.length];
  const group = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.scale.set(sx, sy, sz);
    group.add(mesh);
    return mesh;
  };
  add(g.body, fur, 0, 0.3, -0.02, Math.PI / 2);
  for (const [x, z] of [[-0.09, 0.13], [0.09, 0.13], [-0.09, -0.16], [0.09, -0.16]]) add(g.leg, fur, x, 0.11, z);
  add(g.head, fur, 0, 0.52, 0.24, 0, 0, 0, 1, 0.94, 1);
  add(g.snout, m.light, 0, 0.465, 0.37, 0, 0, 0, 1, 0.82, 1.15);
  add(g.nose, m.dark, 0, 0.49, 0.455);
  const eyes = [new THREE.Vector3(-0.066, 0.535, 0.378), new THREE.Vector3(0.066, 0.535, 0.378)];
  for (const p of eyes) add(g.eye, eyeMat, p.x, p.y, p.z);
  add(g.ear, fur, -0.158, 0.48, 0.23, 0.1, 0, 0.28);
  add(g.ear, fur, 0.158, 0.48, 0.23, 0.1, 0, -0.28);
  add(g.helmet, m.bronze, 0, 0.565, 0.235);
  add(g.helmetRim, m.bronze, 0, 0.568, 0.235, Math.PI / 2);
  add(g.horn, m.bone, -0.17, 0.66, 0.235, 0, 0, 0.95);
  add(g.horn, m.bone, 0.17, 0.66, 0.235, 0, 0, -0.95);
  add(g.scarf, m.scarf, 0, 0.4, 0.17, Math.PI / 2 - 0.35);
  add(g.knot, m.scarf, 0.05, 0.33, 0.27, 0.5, 0, 0.3);
  add(g.pack, m.leather, 0, 0.48, -0.06);
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.36, -0.3);
  const tail = new THREE.Mesh(g.tail, fur);
  tail.position.set(0, 0.09, -0.03);
  tail.rotation.x = -0.6;
  tailPivot.add(tail);
  group.add(tailPivot);
  return { group, tail: tailPivot, eyes };
}

// ---------------------------------------------------------------------- prosedürel okçu
function buildArcher(keep, hex) {
  const group = new THREE.Group();
  const cloak = keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(hex.radiantDeep).lerp(new THREE.Color(hex.bg), 0.45), roughness: 0.75, flatShading: true, side: THREE.DoubleSide }));
  const gold = keep(new THREE.MeshStandardMaterial({ color: hex.aegis, metalness: 0.9, roughness: 0.25, emissive: hex.aegis, emissiveIntensity: 0.55 }));
  const glow = keep(new THREE.MeshBasicMaterial({ color: hex.aegis2 }));
  const skin = keep(new THREE.MeshStandardMaterial({ color: '#e8c29a', roughness: 0.7 }));
  const leather = keep(new THREE.MeshStandardMaterial({ color: '#5a3a24', roughness: 0.9 }));

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, s = [1, 1, 1], parent = group) => {
    const mesh = new THREE.Mesh(keep(geo), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.scale.set(...s);
    parent.add(mesh);
    return mesh;
  };
  // pelerin + gövde
  add(new THREE.ConeGeometry(0.36, 0.86, 8), cloak, 0, 0.43, 0);
  add(new THREE.CylinderGeometry(0.15, 0.2, 0.42, 8), gold, 0, 0.58, 0.02);
  add(new THREE.OctahedronGeometry(0.06, 0), glow, 0, 0.66, 0.2, 0, 0, 0, [1, 1.4, 0.6]);
  add(new THREE.TorusGeometry(0.19, 0.03, 5, 16), gold, 0, 0.8, 0.0, Math.PI / 2);
  // kafa + kapüşon
  add(new THREE.SphereGeometry(0.19, 16, 12), skin, 0, 1.0, 0.02);
  const hood = new THREE.SphereGeometry(0.23, 16, 12, Math.PI / 2 + 0.75, TAU - 1.5, 0, Math.PI * 0.72);
  add(hood, cloak, 0, 1.01, 0.0);
  add(new THREE.ConeGeometry(0.13, 0.3, 8), cloak, 0, 1.22, -0.12, -0.9);
  add(new THREE.SphereGeometry(0.028, 8, 6), glow, -0.068, 1.02, 0.18);
  add(new THREE.SphereGeometry(0.028, 8, 6), glow, 0.068, 1.02, 0.18);
  // sadak
  add(new THREE.CylinderGeometry(0.07, 0.06, 0.42, 8), leather, 0.1, 0.72, -0.2, 0.4, 0, -0.3);
  for (let i = 0; i < 3; i++) add(new THREE.ConeGeometry(0.025, 0.08, 4), gold, 0.16 + i * 0.03 - 0.03, 0.97 + i * 0.01, -0.3 + i * 0.02, 0.4, 0, -0.3);
  // yay (sol elde, önde)
  const bowGroup = new THREE.Group();
  bowGroup.position.set(-0.3, 0.7, 0.22);
  bowGroup.rotation.y = 0.2;
  group.add(bowGroup);
  add(new THREE.TorusGeometry(0.46, 0.028, 6, 24, Math.PI * 0.95), gold, 0, 0, 0, 0, Math.PI / 2, Math.PI / 2 + Math.PI * 0.025, [1, 1, 1], bowGroup);
  add(new THREE.CylinderGeometry(0.006, 0.006, 0.917, 4), glow, 0, 0, 0.036, 0, 0, 0, [1, 1, 1], bowGroup);
  // ok
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 5), glow, 0, 0, 0.33, Math.PI / 2, 0, 0, [1, 1, 1], bowGroup);
  add(new THREE.ConeGeometry(0.04, 0.12, 5), glow, 0, 0, 0.72, Math.PI / 2, 0, 0, [1, 1, 1], bowGroup);
  // el
  add(new THREE.SphereGeometry(0.055, 8, 6), skin, -0.3, 0.7, 0.2);
  return group;
}

// ---------------------------------------------------------------------- shader'lar
const TOP_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const TOP_FRAG = /* glsl */ `
uniform float uTime;
uniform float uShock;
uniform float uR;
uniform vec2 uAxis;
uniform vec3 uStone;
uniform vec3 uStoneDark;
uniform vec3 uRad;
uniform vec3 uDire;
uniform vec3 uEmber;
uniform vec3 uGold;
uniform vec3 uRiver;
uniform sampler2D uTex;
uniform float uHasTex;
varying vec2 vP;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec2 p = vP;
  float len = length(p);
  vec2 ap = abs(p);
  float hd = max(ap.x, dot(ap, vec2(0.5, 0.8660254)));
  float apo = 0.8660254 * uR;
  float hn = hd / apo;

  // Taş döşeme: altıgen halkalar + ışınsal derzler
  float rings = 4.0;
  float ringIdx = floor(hn * rings);
  float dRing = abs(fract(hn * rings + 0.5) - 0.5) / rings * apo;
  float ang = atan(p.x, p.y);
  float seg = 6.0 * (ringIdx + 1.0);
  float angN = ang / 6.2831853 * seg;
  float dRad = abs(fract(angN + 0.5) - 0.5) * 6.2831853 / seg * len;
  float groove = 1.0 - smoothstep(0.0, 0.035, min(dRing, dRad));
  float tile = hash(vec2(ringIdx, floor(angN)));
  float grain = fbm(p * 2.2);
  vec3 stone = mix(uStoneDark, uStone, 0.35 + tile * 0.35 + grain * 0.35);
  if (uHasTex > 0.5) {
    vec3 tx = texture2D(uTex, p * 0.2 + 0.5).rgb;
    float lum = dot(tx, vec3(0.299, 0.587, 0.114));
    tx = mix(vec3(lum), tx, 0.45) * vec3(0.95, 0.9, 1.05);
    stone = mix(stone, tx * 0.95, 0.5);
  }
  stone *= 1.0 - groove * 0.55;

  // Takım tarafları: Radiant yosunlu, Dire kavrulmuş
  float side = dot(p, uAxis) / uR;
  float radSide = smoothstep(0.05, 0.9, -side);
  float direSide = smoothstep(0.05, 0.9, side);
  stone = mix(stone, stone * 0.7 + uRad * 0.18, radSide * (0.5 + 0.5 * fbm(p * 1.3 + 4.0)));
  stone = mix(stone, stone * 0.62 + uDire * 0.12, direSide);
  vec3 col = stone;
  float pulse = 0.6 + 0.4 * sin(uTime * 1.8 + len * 1.5);
  col += uEmber * groove * direSide * pulse * 0.55;
  col += uRad * groove * radSide * 0.18;

  // Kristal ışık havuzları
  vec2 radP = -uAxis * uR * 0.7;
  vec2 direP = uAxis * uR * 0.7;
  col += uRad * exp(-distance(p, radP) * 1.3) * 0.32;
  col += uEmber * exp(-distance(p, direP) * 1.3) * 0.36;

  // Nehir (Radiant–Dire eksenine dik, hafif kıvrımlı)
  vec2 rdir = vec2(-uAxis.y, uAxis.x);
  float u = dot(p, rdir);
  float w = dot(p, uAxis) + 0.26 * sin(u * 0.95 + 0.6);
  float rw = 0.42;
  float river = 1.0 - smoothstep(rw - 0.06, rw, abs(w));
  float flow = fbm(vec2(u * 1.5 - uTime * 0.7, w * 4.0 + uTime * 0.15));
  vec3 water = mix(uRiver * 0.22, uRiver * 0.9, flow);
  water += vec3(0.75, 0.95, 1.0) * smoothstep(0.62, 0.82, flow) * 0.55;
  float bank = exp(-pow((abs(w) - rw) * 14.0, 2.0));
  col = mix(col, water, river);
  col += uRiver * bank * 0.55;

  // Merkez kürsü (kahramanın durduğu yer)
  float dais = 1.0 - smoothstep(0.9, 0.94, len);
  vec3 daisCol = uStoneDark * 1.25 + uGold * 0.04;
  float inlay = exp(-pow((len - 0.86) * 45.0, 2.0)) + exp(-pow((len - 0.55) * 60.0, 2.0)) * 0.7;
  float star = 0.0;
  float sa = abs(fract(ang / 6.2831853 * 6.0 + 0.5) - 0.5) * 6.2831853 / 6.0 * len;
  star = (1.0 - smoothstep(0.0, 0.025, sa)) * step(0.55, len) * step(len, 0.86);
  daisCol += uGold * (inlay + star * 0.6) * (0.8 + 0.2 * sin(uTime * 2.0));
  col = mix(col, daisCol, dais);
  col += uGold * exp(-len * 2.0) * 0.18;

  // Kenar kararması
  col *= mix(1.0, 0.55, smoothstep(0.8, 1.0, hn));

  // Şok dalgası
  if (uShock >= 0.0) {
    float rr = uShock * 6.5;
    float ring = exp(-pow((len - rr) * 3.2, 2.0)) * (1.0 - clamp(uShock / 1.2, 0.0, 1.0));
    col += uEmber * ring * 1.8;
    col += uGold * exp(-len * 1.5) * max(0.0, 1.0 - uShock * 2.5) * 0.8;
  }

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const BEAM_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying float vY;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vY = uv.y;
  gl_Position = projectionMatrix * mv;
}`;

const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying vec3 vN;
varying vec3 vV;
varying float vY;
void main() {
  float f = abs(dot(normalize(vN), normalize(vV)));
  float a = pow(f, 2.5) * pow(1.0 - vY, 1.6) * uIntensity;
  gl_FragColor = vec4(uColor * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const STAR_VERT = /* glsl */ `
attribute float aSeed;
attribute vec3 aTint;
uniform float uTime;
uniform float uPR;
varying float vA;
varying vec3 vC;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed * 2.2) + aSeed * 40.0);
  vA = tw * (0.35 + aSeed * 0.65);
  vC = aTint;
  gl_PointSize = (0.8 + aSeed * aSeed * 2.4) * uPR;
}`;

const STAR_FRAG = /* glsl */ `
varying float vA;
varying vec3 vC;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vA;
  gl_FragColor = vec4(vC * a, a);
}`;

const EMBER_VERT = /* glsl */ `
attribute float aSeed;
attribute float aSpeed;
uniform float uProg;
uniform float uBoost;
uniform float uPR;
uniform float uScale;
varying float vA;
varying float vMix;
void main() {
  vec3 p = position;
  float H = 10.0;
  float y = mod(p.y + uProg * aSpeed, H);
  float yn = y / H;
  p.y = y - 3.5;
  p.x += sin(uProg * 0.7 + aSeed * 31.0) * 0.4;
  p.z += cos(uProg * 0.6 + aSeed * 17.0) * 0.4;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vA = smoothstep(0.0, 0.12, yn) * (1.0 - smoothstep(0.55, 1.0, yn)) * (0.55 + 0.45 * sin(uProg * 3.0 + aSeed * 50.0));
  vA *= 1.0 + uBoost * 0.8;
  vMix = aSeed;
  gl_PointSize = (1.2 + aSeed * 2.6) * uPR * (uScale / 90.0) * (6.0 / -mv.z) * (1.0 + uBoost * 0.5);
}`;

const EMBER_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
varying float vA;
varying float vMix;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float core = smoothstep(0.5, 0.0, d);
  float a = core * core * vA;
  vec3 c = mix(uA, uB, vMix * vMix);
  gl_FragColor = vec4(c * a * 1.6, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
