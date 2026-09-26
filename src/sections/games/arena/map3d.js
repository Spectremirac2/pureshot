// 1vDOQUZ Arena 2.0 — mini Dota savaş alanı (3D): zemin boyası (Radiant yeşil / Dire kül), akan nehir (shader),
// ağaçlar (instanced), çeşme, Roshan çukuru, rün kaideleri. Tüm geometri/malzeme bin'e eklenir (toptan dispose).

import * as THREE from 'three';
import { makeCanvas, toTexture } from './textures.js';
import {
  ARENA_R, RIVER_HALF, ISLAND_R, riverPoint, FOUNTAIN, ROSHAN_PIT, RUNE_SPOTS, TOWER_SPOTS, TREES, OUTER_TREES, DIRE_GATE,
} from './map.js';
import { seeded } from '../../../core/dom.js';

const RR = ARENA_R + 0.6;

/** Zemin boyası: saydam canvas (x sağ, z aşağı). */
function overlayCanvas(S) {
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const rnd = seeded(909);
  const X = (x) => (x / RR * 0.5 + 0.5) * S;
  const Z = (z) => (z / RR * 0.5 + 0.5) * S;
  const U = (d) => (d / RR) * 0.5 * S;
  g.save();
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
  g.clip();
  // yarılar: x - z < 0 Radiant (sol alt), > 0 Dire (sağ üst)
  const half = (dire) => {
    g.beginPath();
    if (dire) { g.moveTo(0, 0); g.lineTo(S, 0); g.lineTo(S, S); }
    else { g.moveTo(0, 0); g.lineTo(0, S); g.lineTo(S, S); }
    g.closePath();
  };
  half(false);
  g.fillStyle = 'rgba(46,112,58,0.46)';
  g.fill();
  half(true);
  g.fillStyle = 'rgba(78,26,38,0.44)';
  g.fill();
  // lekeler
  for (let i = 0; i < 260; i++) {
    const x = (rnd() - 0.5) * 2 * RR;
    const z = (rnd() - 0.5) * 2 * RR;
    const dire = x - z > 0;
    const r = U(0.4 + rnd() * 1.6);
    g.fillStyle = dire
      ? `rgba(${20 + rnd() * 40},${10 + rnd() * 10},${18 + rnd() * 16},${0.12 + rnd() * 0.2})`
      : `rgba(${40 + rnd() * 50},${110 + rnd() * 70},${40 + rnd() * 30},${0.1 + rnd() * 0.18})`;
    g.beginPath();
    g.ellipse(X(x), Z(z), r, r * (0.6 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2);
    g.fill();
  }
  // çimen tutamları / kül kıvılcımları
  for (let i = 0; i < 900; i++) {
    const x = (rnd() - 0.5) * 2 * RR;
    const z = (rnd() - 0.5) * 2 * RR;
    const dire = x - z > 0;
    if (dire) {
      g.fillStyle = rnd() < 0.2 ? `rgba(255,${80 + rnd() * 60},40,${0.25 + rnd() * 0.3})` : `rgba(10,6,10,${0.2 + rnd() * 0.25})`;
      g.fillRect(X(x), Z(z), 1 + rnd() * 2.5, 1 + rnd() * 2.5);
    } else {
      g.strokeStyle = `rgba(${90 + rnd() * 60},${170 + rnd() * 60},${80 + rnd() * 40},${0.3 + rnd() * 0.3})`;
      g.lineWidth = 1 + rnd();
      const px = X(x);
      const pz = Z(z);
      g.beginPath();
      for (let k = 0; k < 3; k++) {
        g.moveTo(px + k * 2, pz);
        g.lineTo(px + k * 2 + (rnd() - 0.5) * 4, pz - 4 - rnd() * 5);
      }
      g.stroke();
    }
  }
  // orta koridor (Dire kapısı → merkez → çeşme)
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(120,98,70,0.38)';
  g.lineWidth = U(1.6);
  g.beginPath();
  g.moveTo(X(DIRE_GATE.x), Z(DIRE_GATE.z));
  g.lineTo(X(FOUNTAIN.x), Z(FOUNTAIN.z));
  g.stroke();
  // nehir yatağı
  const riverPath = (w, style) => {
    g.strokeStyle = style;
    g.lineWidth = U(w);
    g.beginPath();
    for (let s = -20; s <= 20; s += 0.4) {
      const p = riverPoint(s);
      if (s === -20) g.moveTo(X(p.x), Z(p.z));
      else g.lineTo(X(p.x), Z(p.z));
    }
    g.stroke();
  };
  riverPath((RIVER_HALF + 0.7) * 2, 'rgba(118,98,68,0.55)');
  riverPath((RIVER_HALF + 0.25) * 2, 'rgba(24,40,52,0.85)');
  // ada: mühür çevresi taş halka
  g.fillStyle = 'rgba(40,34,52,0.0)';
  g.strokeStyle = 'rgba(160,150,130,0.35)';
  g.lineWidth = U(0.25);
  g.beginPath();
  g.arc(X(0), Z(0), U(ISLAND_R + 0.05), 0, Math.PI * 2);
  g.stroke();
  // çeşme meydanı
  const plaza = g.createRadialGradient(X(FOUNTAIN.x), Z(FOUNTAIN.z), 0, X(FOUNTAIN.x), Z(FOUNTAIN.z), U(FOUNTAIN.r + 0.8));
  plaza.addColorStop(0, 'rgba(190,200,180,0.5)');
  plaza.addColorStop(0.75, 'rgba(150,170,140,0.4)');
  plaza.addColorStop(1, 'rgba(150,170,140,0)');
  g.fillStyle = plaza;
  g.beginPath();
  g.arc(X(FOUNTAIN.x), Z(FOUNTAIN.z), U(FOUNTAIN.r + 0.8), 0, Math.PI * 2);
  g.fill();
  // kule tabanları
  for (const t of TOWER_SPOTS) {
    const grd = g.createRadialGradient(X(t.x), Z(t.z), 0, X(t.x), Z(t.z), U(1.6));
    grd.addColorStop(0, t.side === 'radiant' ? 'rgba(200,210,190,0.55)' : 'rgba(30,20,26,0.65)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(X(t.x), Z(t.z), U(1.6), 0, Math.PI * 2);
    g.fill();
  }
  // Roshan çukuru
  const px = X(ROSHAN_PIT.x);
  const pz = Z(ROSHAN_PIT.z);
  const pit = g.createRadialGradient(px, pz, 0, px, pz, U(ROSHAN_PIT.r + 0.7));
  pit.addColorStop(0, 'rgba(6,4,8,0.95)');
  pit.addColorStop(0.6, 'rgba(22,16,20,0.9)');
  pit.addColorStop(0.85, 'rgba(70,60,56,0.6)');
  pit.addColorStop(1, 'rgba(70,60,56,0)');
  g.fillStyle = pit;
  g.beginPath();
  g.arc(px, pz, U(ROSHAN_PIT.r + 0.7), 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,120,40,0.35)';
  g.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    g.beginPath();
    g.moveTo(px + Math.cos(a) * U(0.3), pz + Math.sin(a) * U(0.3));
    g.lineTo(px + Math.cos(a + 0.3) * U(ROSHAN_PIT.r * 0.9), pz + Math.sin(a + 0.3) * U(ROSHAN_PIT.r * 0.9));
    g.stroke();
  }
  g.restore();
  return c;
}

const WATER_VERT = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPos = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const WATER_FRAG = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  uniform vec3 uPit;
  uniform float uIsland;
  varying vec2 vUv;
  varying vec3 vPos;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    float di = length(vPos.xz);
    if (di < uIsland) discard;
    float dp = length(vPos.xz - uPit.xy);
    if (dp < uPit.z) discard;
    float across = abs(vUv.x - 0.5) * 2.0;
    float flow = vUv.y;
    float n1 = noise(vec2(vUv.x * 3.0, flow * 0.9 - uTime * 0.55));
    float n2 = noise(vec2(vUv.x * 7.0 + 5.0, flow * 2.2 - uTime * 1.1));
    float n = n1 * 0.6 + n2 * 0.4;
    vec3 col = mix(uDeep, uShallow, clamp(across * 0.75 + n * 0.35, 0.0, 1.0));
    float rip = smoothstep(0.6, 0.8, noise(vec2(vUv.x * 5.0 + n1 * 2.0, flow * 3.2 - uTime * 1.3)));
    col += vec3(0.5, 0.75, 0.9) * rip * 0.25;
    float edge = smoothstep(0.68, 0.97, across + (n - 0.5) * 0.2);
    float isl = 1.0 - smoothstep(uIsland, uIsland + 0.55, di);
    float pit = 1.0 - smoothstep(uPit.z, uPit.z + 0.5, dp);
    float foam = max(edge, max(isl, pit)) * (0.5 + 0.5 * n2);
    col = mix(col, uFoam, clamp(foam, 0.0, 1.0) * 0.8);
    float alpha = (1.0 - smoothstep(0.92, 1.0, across)) * 0.9;
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function riverGeometry(len = 22, step = 0.35) {
  const pos = [];
  const uv = [];
  const idx = [];
  const n = { x: Math.SQRT1_2, z: -Math.SQRT1_2 };
  const w = RIVER_HALF + 0.12;
  let row = 0;
  for (let s = -len; s <= len + 1e-6; s += step) {
    const p = riverPoint(s);
    pos.push(p.x - n.x * w, 0, p.z - n.z * w, p.x + n.x * w, 0, p.z + n.z * w);
    uv.push(0, s * 0.35, 1, s * 0.35);
    if (row > 0) {
      const a = (row - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    row += 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function buildMap(scene, { bin, mobile, shadows, glowTex, ringTex }) {
  const out = { updaters: [] };
  const flatShade = true;

  // ---------------------------------------------------------------- zemin boyası
  const ov = bin.add(toTexture(overlayCanvas(mobile ? 1024 : 2048)));
  const ovMat = bin.add(new THREE.MeshStandardMaterial({ map: ov, transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  const ovMesh = new THREE.Mesh(bin.add(new THREE.CircleGeometry(RR, 96)), ovMat);
  ovMesh.rotation.x = -Math.PI / 2;
  ovMesh.position.y = 0.01;
  ovMesh.receiveShadow = shadows;
  ovMesh.renderOrder = 1;
  scene.add(ovMesh);

  // ---------------------------------------------------------------- nehir
  const waterMat = bin.add(new THREE.ShaderMaterial({
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#0f3a55') },
      uShallow: { value: new THREE.Color('#2a8fb0') },
      uFoam: { value: new THREE.Color('#d8f4ff') },
      uPit: { value: new THREE.Vector3(ROSHAN_PIT.x, ROSHAN_PIT.z, ROSHAN_PIT.r + 0.05) },
      uIsland: { value: ISLAND_R },
    }]),
    transparent: true,
    depthWrite: false,
    fog: true,
  }));
  const water = new THREE.Mesh(bin.add(riverGeometry()), waterMat);
  water.position.y = 0.025;
  water.renderOrder = 2;
  scene.add(water);
  out.updaters.push((t) => { waterMat.uniforms.uTime.value = t; });

  // ---------------------------------------------------------------- ağaçlar (instanced)
  const trunkGeo = bin.add(new THREE.CylinderGeometry(0.11, 0.17, 0.8, 6));
  trunkGeo.translate(0, 0.4, 0);
  const coneA = bin.add(new THREE.ConeGeometry(0.78, 1.45, 7));
  coneA.translate(0, 1.35, 0);
  const coneB = bin.add(new THREE.ConeGeometry(0.52, 1.1, 7));
  coneB.translate(0, 2.05, 0);
  const deadTrunk = bin.add(new THREE.CylinderGeometry(0.08, 0.18, 1.5, 5));
  deadTrunk.translate(0, 0.75, 0);
  const deadCrown = bin.add(new THREE.IcosahedronGeometry(0.72, 0));
  deadCrown.scale(1, 1.15, 1);
  deadCrown.translate(0, 1.75, 0);
  const trunkMat = bin.add(new THREE.MeshStandardMaterial({ color: '#5a3b24', roughness: 0.95, flatShading: flatShade }));
  const leafMat = bin.add(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: flatShade }));
  const deadTrunkMat = bin.add(new THREE.MeshStandardMaterial({ color: '#2a1c1c', roughness: 1, flatShading: flatShade }));
  const deadMat = bin.add(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: flatShade, emissive: '#2a0508', emissiveIntensity: 0.6 }));
  const all = [...TREES.map((t) => ({ ...t, inner: true })), ...OUTER_TREES.filter((_, i) => !mobile || i % 2 === 0)];
  const rad = all.filter((t) => !t.dire);
  const dir = all.filter((t) => t.dire);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const c = new THREE.Color();
  const rnd = seeded(31);
  const inst = (geo, mat, list, colorFn) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((t, i) => {
      e.set(0, t.rot, 0);
      q.setFromEuler(e);
      sc.setScalar(t.s);
      v.set(t.x, 0, t.z);
      m4.compose(v, q, sc);
      im.setMatrixAt(i, m4);
      if (colorFn) im.setColorAt(i, colorFn(c, t));
    });
    im.castShadow = shadows;
    im.receiveShadow = false;
    scene.add(im);
    return im;
  };
  if (rad.length) {
    inst(trunkGeo, trunkMat, rad);
    inst(coneA, leafMat, rad, (col) => col.setHSL(0.36 + rnd() * 0.05, 0.45 + rnd() * 0.15, 0.24 + rnd() * 0.08));
    inst(coneB, leafMat, rad, (col) => col.setHSL(0.35 + rnd() * 0.05, 0.5, 0.3 + rnd() * 0.08));
  }
  if (dir.length) {
    inst(deadTrunk, deadTrunkMat, dir);
    inst(deadCrown, deadMat, dir, (col) => col.setHSL(0.97 + rnd() * 0.03, 0.35 + rnd() * 0.2, 0.14 + rnd() * 0.07));
  }

  // ---------------------------------------------------------------- çeşme
  {
    const stone = bin.add(new THREE.MeshStandardMaterial({ color: '#c9c3b2', roughness: 0.85 }));
    const gold = bin.add(new THREE.MeshStandardMaterial({ color: '#e9b949', roughness: 0.3, metalness: 0.8 }));
    const waterF = bin.add(new THREE.MeshStandardMaterial({ color: '#2fd9a0', emissive: '#1fbf8a', emissiveIntensity: 0.9, roughness: 0.2, transparent: true, opacity: 0.85 }));
    const crystal = bin.add(new THREE.MeshStandardMaterial({ color: '#b9ffe4', emissive: '#43d6a0', emissiveIntensity: 2.2, roughness: 0.2 }));
    const f = new THREE.Group();
    f.position.set(FOUNTAIN.x, 0, FOUNTAIN.z);
    const wall = new THREE.Mesh(bin.add(new THREE.CylinderGeometry(1.35, 1.5, 0.38, 20, 1, true)), stone);
    wall.position.y = 0.19;
    const rim = new THREE.Mesh(bin.add(new THREE.TorusGeometry(1.38, 0.09, 6, 28)), gold);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.38;
    const pool = new THREE.Mesh(bin.add(new THREE.CircleGeometry(1.33, 28)), waterF);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.3;
    const pillar = new THREE.Mesh(bin.add(new THREE.CylinderGeometry(0.22, 0.34, 1.5, 8)), stone);
    pillar.position.y = 0.95;
    const bowl = new THREE.Mesh(bin.add(new THREE.CylinderGeometry(0.55, 0.25, 0.25, 12)), gold);
    bowl.position.y = 1.72;
    const cr = new THREE.Mesh(bin.add(new THREE.OctahedronGeometry(0.34, 0)), crystal);
    cr.position.y = 2.25;
    wall.castShadow = shadows;
    pillar.castShadow = shadows;
    f.add(wall, rim, pool, pillar, bowl, cr);
    const glowMat = bin.add(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color('#43d6a0'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
    const glow = new THREE.Sprite(glowMat);
    glow.position.y = 2.25;
    glow.scale.set(3, 3, 1);
    f.add(glow);
    const ringMat = bin.add(new THREE.MeshBasicMaterial({ map: ringTex, color: new THREE.Color('#43d6a0'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.4 }));
    const ring = new THREE.Mesh(bin.add(new THREE.PlaneGeometry(1, 1)), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    ring.scale.setScalar(FOUNTAIN.r * 2);
    ring.renderOrder = 3;
    f.add(ring);
    scene.add(f);
    out.fountain = { group: f, ring, ringMat, glowMat, crystal: cr, pos: FOUNTAIN };
    out.updaters.push((t, dt, g) => {
      cr.rotation.y = t * 1.2;
      cr.position.y = 2.25 + Math.sin(t * 2) * 0.08;
      const on = g && g.player && g.player.inFountain;
      ringMat.opacity = (on ? 0.75 : 0.35) + 0.12 * Math.sin(t * 3);
      waterF.emissiveIntensity = 0.8 + 0.25 * Math.sin(t * 2.4);
    });
  }

  // ---------------------------------------------------------------- Roshan çukuru
  {
    const rock = bin.add(new THREE.MeshStandardMaterial({ color: '#3d3540', roughness: 1, flatShading: true }));
    const rockGeo = bin.add(new THREE.DodecahedronGeometry(0.42, 0));
    const n = 16;
    const im = new THREE.InstancedMesh(rockGeo, rock, n);
    const r2 = seeded(12);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r2() * 0.2;
      const rr = ROSHAN_PIT.r + 0.15 + r2() * 0.35;
      e.set(r2() * 3, r2() * 3, r2() * 3);
      q.setFromEuler(e);
      const s = 0.6 + r2() * 0.9;
      sc.set(s, s * (0.6 + r2() * 0.5), s);
      v.set(ROSHAN_PIT.x + Math.sin(a) * rr, 0.08, ROSHAN_PIT.z + Math.cos(a) * rr);
      m4.compose(v, q, sc);
      im.setMatrixAt(i, m4);
    }
    im.castShadow = shadows;
    scene.add(im);
    const bone = bin.add(new THREE.MeshStandardMaterial({ color: '#e6dcc2', roughness: 0.7 }));
    const boneGeo = bin.add(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 5));
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(boneGeo, bone);
      b.position.set(ROSHAN_PIT.x + (r2() - 0.5) * 2.4, 0.06, ROSHAN_PIT.z + (r2() - 0.5) * 2.4);
      b.rotation.set(Math.PI / 2, 0, r2() * 3);
      scene.add(b);
    }
    const glowMat = bin.add(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color('#ff7a2b'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 }));
    const glow = new THREE.Sprite(glowMat);
    glow.position.set(ROSHAN_PIT.x, 0.4, ROSHAN_PIT.z);
    glow.scale.set(4, 2, 1);
    scene.add(glow);
    out.pitGlow = glowMat;
  }

  // ---------------------------------------------------------------- rün kaideleri
  {
    const padMat = bin.add(new THREE.MeshStandardMaterial({ color: '#8f8a80', roughness: 0.9 }));
    const padGeo = bin.add(new THREE.CylinderGeometry(0.72, 0.84, 0.12, 14));
    for (const r of RUNE_SPOTS) {
      const m = new THREE.Mesh(padGeo, padMat);
      m.position.set(r.x, 0.03, r.z);
      m.receiveShadow = shadows;
      scene.add(m);
    }
  }

  out.update = (t, dt, g) => { for (const fn of out.updaters) fn(t, dt, g); };
  return out;
}
