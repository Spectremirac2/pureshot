// 3D Müze eserleri: meta veriler + fal modeli yoksa kullanılan prosedürel three.js versiyonları.
// Her prosedürel model: tabanı y=0, ön yüzü +z yönünde, yüksekliği ~1.3–1.55 birim.
// root.userData.tick(t) boşta animasyonu, root.userData.themed tema rengine göre parlayan malzemeler.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const EXHIBITS = [
  {
    key: 'model-dog',
    id: 'dog',
    no: 'I',
    name: 'DOG Maskotu',
    icon: 'paw',
    height: 1.5,
    pitch: 1.0,
    desc:
      'Boynuzlu bronz miğferi, kırmızı fuları ve içi Tango dolu heybesiyle sitenin maskotu. Dört ayak üstünde durmasının sebebi basit: TP’si hiç yok, haritanın her yerine yürüyerek gidiyor.',
    fallbackArt: 'poster-dogdogdog',
    fallbackArch: 'farm',
  },
  {
    key: 'model-archer',
    id: 'archer',
    no: 'II',
    name: 'Okçu Kahraman',
    icon: 'bow',
    height: 1.55,
    pitch: 1.3,
    desc:
      'Kapüşonunu 1vDOQUZ gecelerinde hiç indirmeyen chibi okçu. Dokuz DOG’a karşı tek başına; sadağında tam dokuz ok var, tesadüf değil.',
    fallbackArt: 'portrait-legend',
    fallbackArch: 'legend',
  },
  {
    key: 'model-aegis',
    id: 'aegis',
    no: 'III',
    name: 'Aegis Kupası',
    icon: 'trophy',
    height: 1.5,
    pitch: 0.78,
    desc:
      'Tek kullanımlık ölümsüzlük, sınırsız karizma. Kanatlı altın kalkan Roshan çukurundan “ödünç” alındı; iade tarihi belli değil, gecikme cezası DOG olarak ödeniyor.',
    fallbackArt: 'poster-1vdoquz',
    fallbackArch: 'rapier',
  },
];

// ------------------------------------------------------------------ yardımcılar
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;

function std(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o });
}

function add(parent, geo, mat, pos, rot, scale) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (scale != null) {
    if (typeof scale === 'number') m.scale.setScalar(scale);
    else m.scale.set(scale[0], scale[1], scale[2]);
  }
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Kıvrık boynuz: taban y=0'da, ucu +y, x yönünde parabolik bükülme. */
function hornGeo(r, len, bend, sign) {
  const g = new THREE.ConeGeometry(r, len, 16, 12);
  g.translate(0, len / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / len;
    p.setX(i, p.getX(i) + sign * bend * t * t * len);
  }
  g.computeVertexNormals();
  return g;
}

/** Canvas tabanlı taş dokusu (kaide, kupa tabanı). */
export function stoneTexture(base = '#3a3347', seed = 7) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) {
    const v = rnd();
    g.fillStyle = v > 0.5 ? `rgba(255,240,255,${0.03 + rnd() * 0.07})` : `rgba(0,0,0,${0.08 + rnd() * 0.16})`;
    const sz = 1 + rnd() * 2.5;
    g.fillRect(rnd() * 256, rnd() * 256, sz, sz);
  }
  g.lineWidth = 1;
  for (let v = 0; v < 7; v++) {
    g.strokeStyle = `rgba(255,255,255,${0.035 + rnd() * 0.04})`;
    g.beginPath();
    let x = rnd() * 256, y = rnd() * 256;
    g.moveTo(x, y);
    for (let k = 0; k < 24; k++) {
      x += (rnd() - 0.5) * 22;
      y += (rnd() - 0.2) * 14;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// ------------------------------------------------------------------ DOG maskotu
function buildDog(pal) {
  const root = new THREE.Group();
  const sphere = new THREE.SphereGeometry(1, 32, 24);

  const fur = std('#c98b4e', { roughness: 0.85 });
  const furLight = std('#f2d6ae', { roughness: 0.9 });
  const furDark = std('#8e5530', { roughness: 0.85 });
  const dark = std('#1d1210', { roughness: 0.22 });
  const white = std('#fff8ec', { roughness: 0.18 });
  const glint = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const bronze = std('#b8763a', { metalness: 0.9, roughness: 0.3 });
  const ivory = std('#eadcbc', { roughness: 0.45 });
  const scarf = std(pal.dire, { roughness: 0.75 });
  const leather = std('#6e4126', { roughness: 0.7 });
  const leatherDark = std('#4a2a18', { roughness: 0.75 });
  const gold = std(pal.aegis, { metalness: 1, roughness: 0.28 });
  const leaf = std(pal.radiant, { roughness: 0.6 });
  const pink = std('#e98a8a', { roughness: 0.5 });

  // gövde
  add(root, sphere, fur, [0, 0.6, 0], null, [0.4, 0.36, 0.56]);
  add(root, sphere, furLight, [0, 0.5, 0.04], null, [0.3, 0.25, 0.46]);
  add(root, sphere, furLight, [0, 0.68, 0.38], null, [0.25, 0.27, 0.2]);

  // bacaklar + patiler
  const legGeo = new THREE.CapsuleGeometry(0.095, 0.26, 6, 14);
  for (const [x, z] of [[-0.2, 0.3], [0.2, 0.3], [-0.21, -0.32], [0.21, -0.32]]) {
    add(root, legGeo, fur, [x, 0.26, z]);
    add(root, sphere, furLight, [x, 0.07, z + 0.04], null, [0.115, 0.075, 0.14]);
  }

  // kuyruk
  const tail = new THREE.Group();
  tail.position.set(0, 0.74, -0.48);
  root.add(tail);
  const tailCurve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, 0.12, -0.12), V(0, 0.28, -0.14), V(0, 0.4, -0.05)]);
  add(tail, new THREE.TubeGeometry(tailCurve, 24, 0.055, 10), fur);
  add(tail, sphere, furLight, [0, 0.4, -0.05], null, 0.075);

  // fular (boyun halkası + düğüm + sarkan uç)
  add(root, new THREE.TorusGeometry(0.25, 0.075, 14, 40), scarf, [0, 0.83, 0.36], [-1.0, 0, 0]);
  add(root, sphere, scarf, [0.1, 0.7, 0.55], null, 0.075);
  add(root, sphere, scarf, [0.15, 0.55, 0.58], [0, 0, 0.35], [0.09, 0.17, 0.035]);

  // heybe + kayış + Tango yaprakları
  add(root, new THREE.TorusGeometry(0.405, 0.022, 8, 64), leatherDark, [0, 0.6, -0.08], null, [1, 0.9, 1]);
  const bagGeo = new RoundedBoxGeometry(0.16, 0.22, 0.3, 3, 0.045);
  const flapGeo = new RoundedBoxGeometry(0.17, 0.08, 0.31, 2, 0.03);
  for (const s of [-1, 1]) {
    add(root, bagGeo, leather, [s * 0.44, 0.55, -0.08], [0, 0, s * 0.12]);
    add(root, flapGeo, leatherDark, [s * 0.45, 0.65, -0.08], [0, 0, s * 0.12]);
    add(root, new THREE.BoxGeometry(0.02, 0.05, 0.05), gold, [s * 0.535, 0.6, -0.08], [0, 0, s * 0.12]);
  }
  add(root, sphere, leaf, [0.45, 0.76, -0.02], [0.2, 0, -0.35], [0.03, 0.1, 0.055]);
  add(root, sphere, leaf, [0.47, 0.74, -0.15], [-0.2, 0, 0.25], [0.03, 0.09, 0.05]);

  // kafa
  const head = new THREE.Group();
  head.position.set(0, 1.0, 0.46);
  root.add(head);
  add(head, sphere, fur, [0, 0, 0], null, [0.36, 0.33, 0.34]);
  add(head, sphere, furLight, [0, -0.1, 0.24], null, [0.2, 0.14, 0.16]);
  add(head, sphere, dark, [0, -0.04, 0.39], null, [0.07, 0.055, 0.05]);
  add(head, sphere, pink, [0.035, -0.2, 0.31], [0.35, 0, 0], [0.05, 0.02, 0.06]);
  const ears = [];
  for (const s of [-1, 1]) {
    add(head, sphere, white, [s * 0.13, 0.05, 0.28], null, [0.075, 0.08, 0.05]);
    add(head, sphere, dark, [s * 0.135, 0.045, 0.315], null, [0.048, 0.055, 0.03]);
    add(head, sphere, glint, [s * 0.12, 0.07, 0.338], null, 0.014);
    const ear = new THREE.Group();
    ear.position.set(s * 0.31, 0.12, -0.02);
    head.add(ear);
    add(ear, sphere, furDark, [s * 0.04, -0.14, 0], [0, 0, s * 0.35], [0.08, 0.2, 0.14]);
    ears.push([ear, s]);
  }

  // bronz miğfer
  const helm = new THREE.Group();
  helm.position.set(0, 0.04, -0.02);
  helm.rotation.x = -0.15;
  head.add(helm);
  const capTheta = Math.PI * 0.42;
  add(helm, new THREE.SphereGeometry(0.375, 40, 20, 0, Math.PI * 2, 0, capTheta), bronze);
  const rimY = 0.375 * Math.cos(capTheta);
  const rimR = 0.375 * Math.sin(capTheta);
  add(helm, new THREE.TorusGeometry(rimR, 0.03, 10, 48), bronze, [0, rimY, 0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    add(helm, sphere, gold, [Math.sin(a) * (rimR + 0.025), rimY, Math.cos(a) * (rimR + 0.025)], null, 0.018);
  }
  add(helm, new THREE.TorusGeometry(0.38, 0.024, 8, 40, Math.PI * 0.84), gold, [0, 0, 0], [0, Math.PI / 2, 0.25]);
  for (const s of [-1, 1]) {
    add(helm, hornGeo(0.075, 0.36, 0.55, -s), ivory, [s * 0.3, 0.17, 0.02], [0, 0, -s * 1.05]);
    add(helm, new THREE.TorusGeometry(0.075, 0.018, 8, 20), gold, [s * 0.305, 0.175, 0.02], [Math.PI / 2, 0, -s * 1.05]);
  }

  root.userData.tick = (t) => {
    tail.rotation.z = Math.sin(t * 9) * 0.35;
    tail.rotation.x = Math.sin(t * 4.5) * 0.08;
    head.rotation.z = Math.sin(t * 1.3) * 0.07;
    head.rotation.x = Math.sin(t * 0.9) * 0.04;
    for (const [ear, s] of ears) ear.rotation.z = s * (0.06 + Math.sin(t * 2.6 + s) * 0.06);
  };
  root.userData.themed = [];
  return root;
}

// ------------------------------------------------------------------ Okçu kahraman
function buildArcher(pal) {
  const root = new THREE.Group();
  const sphere = new THREE.SphereGeometry(1, 32, 24);
  const DS = THREE.DoubleSide;

  const cloak = std('#1e7a58', { roughness: 0.78, side: DS });
  const tunic = std('#3a2c55', { roughness: 0.8 });
  const pants = std('#2a2235', { roughness: 0.85 });
  const skin = std('#f0c39c', { roughness: 0.6 });
  const hair = std('#4a2a1a', { roughness: 0.7 });
  const dark = std('#1a1020', { roughness: 0.25 });
  const glint = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const blush = std('#ff8f86', { roughness: 0.6, transparent: true, opacity: 0.5 });
  const leather = std('#6b4228', { roughness: 0.7 });
  const leatherDark = std('#3b2418', { roughness: 0.8 });
  const gold = std(pal.aegis, { metalness: 1, roughness: 0.28 });
  const wood = std('#8a5a2e', { roughness: 0.55 });
  const fletch = std(pal.ember, { roughness: 0.6 });
  const string = std('#f3eadb', { roughness: 0.5 });
  const gem = std(pal.theme, { emissive: pal.theme, emissiveIntensity: 1.3, roughness: 0.2 });

  const body = new THREE.Group();
  root.add(body);

  // botlar, bacaklar
  for (const s of [-1, 1]) {
    add(root, sphere, leatherDark, [s * 0.09, 0.06, 0.03], null, [0.085, 0.07, 0.12]);
    add(root, new THREE.CapsuleGeometry(0.055, 0.14, 4, 10), pants, [s * 0.08, 0.19, 0]);
  }
  // tunik + kemer
  add(body, new THREE.CylinderGeometry(0.17, 0.2, 0.36, 24), tunic, [0, 0.47, 0]);
  add(body, new THREE.TorusGeometry(0.19, 0.03, 8, 32), leather, [0, 0.34, 0], [Math.PI / 2, 0, 0]);
  add(body, new THREE.BoxGeometry(0.07, 0.06, 0.03), gold, [0, 0.34, 0.205]);
  add(body, new THREE.BoxGeometry(0.035, 0.52, 0.02), leather, [0, 0.5, 0.19], [0, 0, 0.8]);

  // pelerin (lathe; önü açık)
  const prof = [[0.36, 0.1], [0.32, 0.26], [0.26, 0.46], [0.21, 0.6], [0.17, 0.72]].map(([r, y]) => new THREE.Vector2(r, y));
  add(body, new THREE.LatheGeometry(prof, 40, 0.55, Math.PI * 2 - 1.1), cloak);
  // omuz pelerini + altın şerit
  const mantleTheta = Math.PI * 0.55;
  add(body, new THREE.SphereGeometry(0.26, 32, 16, 0, Math.PI * 2, 0, mantleTheta), cloak, [0, 0.64, 0], null, [1.15, 0.9, 1.05]);
  const mR = 0.26 * Math.sin(mantleTheta), mY = 0.64 + 0.26 * Math.cos(mantleTheta) * 0.9;
  add(body, new THREE.TorusGeometry(mR, 0.016, 8, 48), gold, [0, mY, 0], [Math.PI / 2, 0, 0], [1.15, 1.05, 1]);
  // broş
  add(body, new THREE.TorusGeometry(0.035, 0.012, 8, 20), gold, [0, 0.7, 0.265]);
  add(body, sphere, gem, [0, 0.7, 0.27], null, 0.024);

  // kollar
  add(body, new THREE.CapsuleGeometry(0.06, 0.16, 4, 10), cloak, [0.26, 0.55, 0.1], [0.9, 0, 0.45]);
  add(body, sphere, skin, [0.35, 0.52, 0.2], null, 0.05);
  add(body, new THREE.CapsuleGeometry(0.06, 0.18, 4, 10), cloak, [-0.25, 0.49, 0.03], [0.15, 0, -0.25]);
  add(body, sphere, skin, [-0.29, 0.37, 0.06], null, 0.05);

  // yay
  const bow = new THREE.Group();
  bow.position.set(0.36, 0.53, 0.22);
  bow.rotation.y = -Math.PI / 2;
  root.add(bow);
  const R = 0.46, arc = Math.PI * 0.74;
  add(bow, new THREE.TorusGeometry(R, 0.02, 8, 48, arc), wood, [-R, 0, 0], [0, 0, -arc / 2]);
  const sx = R * Math.cos(arc / 2) - R, sy = R * Math.sin(arc / 2);
  add(bow, new THREE.CylinderGeometry(0.004, 0.004, sy * 2, 6), string, [sx, 0, 0]);
  add(bow, sphere, gold, [sx, sy, 0], null, 0.026);
  add(bow, sphere, gold, [sx, -sy, 0], null, 0.026);
  add(bow, new THREE.CylinderGeometry(0.028, 0.028, 0.12, 12), leather, [0, 0, 0]);

  // sadak: tam dokuz ok
  const quiver = new THREE.Group();
  quiver.position.set(-0.13, 0.68, -0.25);
  quiver.rotation.set(-0.3, 0, 0.45);
  body.add(quiver);
  add(quiver, new THREE.CylinderGeometry(0.085, 0.07, 0.44, 18), leather);
  add(quiver, new THREE.TorusGeometry(0.085, 0.014, 8, 24), gold, [0, 0.22, 0], [Math.PI / 2, 0, 0]);
  const shaftGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.22, 6);
  const featherGeo = new THREE.BoxGeometry(0.004, 0.06, 0.032);
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i === 8 ? 0 : 0.045;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const yTop = 0.3 + (i % 3) * 0.02;
    add(quiver, shaftGeo, wood, [x, yTop - 0.05, z]);
    add(quiver, featherGeo, fletch, [x, yTop + 0.03, z], [0, a, 0]);
    add(quiver, featherGeo, fletch, [x, yTop + 0.03, z], [0, a + Math.PI / 2, 0]);
  }

  // kafa
  const head = new THREE.Group();
  head.position.set(0, 1.0, 0.02);
  root.add(head);
  add(head, sphere, skin, [0, 0, 0], null, [0.3, 0.285, 0.285]);
  for (const [x, y, z] of [[-0.13, 0.15, 0.2], [0, 0.19, 0.22], [0.13, 0.15, 0.2], [-0.2, 0.06, 0.17], [0.2, 0.06, 0.17]]) {
    add(head, sphere, hair, [x, y, z], null, [0.1, 0.08, 0.08]);
  }
  for (const s of [-1, 1]) {
    add(head, sphere, dark, [s * 0.1, -0.01, 0.262], null, [0.046, 0.062, 0.03]);
    add(head, sphere, glint, [s * 0.088, 0.012, 0.29], null, 0.014);
    add(head, sphere, blush, [s * 0.17, -0.07, 0.222], null, [0.042, 0.024, 0.012]);
  }
  add(head, new THREE.TorusGeometry(0.026, 0.006, 6, 12, Math.PI), dark, [0, -0.1, 0.268], [0, 0, Math.PI]);

  // kapüşon: önü açık küre kabuğu + kenar şeridi + sarkık uç
  const hood = new THREE.Group();
  hood.position.set(0, 0.04, -0.03);
  hood.scale.set(1.02, 1, 1.05);
  head.add(hood);
  const hr = 0.35, open = 0.85, hTheta = Math.PI * 0.66;
  const phiStart = Math.PI / 2 + open, phiLen = Math.PI * 2 - open * 2;
  add(hood, new THREE.SphereGeometry(hr, 40, 24, phiStart, phiLen, 0, hTheta), cloak);
  const edge = [];
  const sph = (phi, th) => V(-hr * Math.cos(phi) * Math.sin(th), hr * Math.cos(th), hr * Math.sin(phi) * Math.sin(th));
  for (let i = 12; i >= 1; i--) edge.push(sph(phiStart, (i / 12) * hTheta));
  edge.push(V(0, hr, 0));
  for (let i = 1; i <= 12; i++) edge.push(sph(phiStart + phiLen, (i / 12) * hTheta));
  add(hood, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge), 64, 0.016, 8), gold);
  const tip = new THREE.Group();
  tip.position.set(0, 0.2, -0.27);
  hood.add(tip);
  add(tip, new THREE.ConeGeometry(0.11, 0.3, 18), cloak, [0, -0.1, -0.08], [-2.1, 0, 0]);

  root.userData.tick = (t) => {
    body.position.y = Math.sin(t * 2) * 0.008;
    head.position.y = 1.0 + Math.sin(t * 2 - 0.4) * 0.012;
    head.rotation.z = Math.sin(t * 0.8) * 0.05;
    tip.rotation.x = Math.sin(t * 1.7) * 0.12;
    bow.rotation.z = Math.sin(t * 1.1) * 0.04;
  };
  root.userData.themed = [gem];
  return root;
}

// ------------------------------------------------------------------ Aegis kupası
function shieldShape(k) {
  const W = 0.3 * k, T = 0.34 * k, B = -0.44 * k;
  const s = new THREE.Shape();
  s.moveTo(-W, T);
  s.quadraticCurveTo(0, T + 0.1 * k, W, T);
  s.lineTo(W, 0.02 * k);
  s.bezierCurveTo(W, -0.2 * k, 0.14 * k, -0.34 * k, 0, B);
  s.bezierCurveTo(-0.14 * k, -0.34 * k, -W, -0.2 * k, -W, 0.02 * k);
  s.lineTo(-W, T);
  return s;
}

function featherGeo(L, w) {
  const s = new THREE.Shape();
  s.moveTo(0, -w * 0.3);
  s.quadraticCurveTo(L * 0.45, -w, L, 0);
  s.quadraticCurveTo(L * 0.55, w * 0.85, 0, w * 0.3);
  s.lineTo(0, -w * 0.3);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 12 });
  g.translate(0, 0, -0.006);
  return g;
}

function buildAegis(pal, stoneMap) {
  const root = new THREE.Group();
  const sphere = new THREE.SphereGeometry(1, 28, 20);
  const stone = std('#8a8098', { roughness: 0.92, map: stoneMap || null });
  const gold = std(pal.aegis, { metalness: 1, roughness: 0.24 });
  const goldDark = std('#b0802c', { metalness: 1, roughness: 0.38 });
  const enamel = std(pal.direDeep, { roughness: 0.3, metalness: 0.25 });
  const gem = std(pal.theme, { emissive: pal.theme, emissiveIntensity: 1.5, roughness: 0.15 });

  // taş kaide (kupanın kendi tabanı)
  add(root, new THREE.CylinderGeometry(0.36, 0.42, 0.16, 8), stone, [0, 0.08, 0]);
  add(root, new THREE.CylinderGeometry(0.345, 0.345, 0.025, 8), gold, [0, 0.172, 0]);
  add(root, new THREE.CylinderGeometry(0.27, 0.32, 0.12, 8), stone, [0, 0.245, 0]);
  add(root, new THREE.CylinderGeometry(0.06, 0.1, 0.16, 16), gold, [0, 0.38, 0]);
  add(root, sphere, gold, [0, 0.47, 0], null, [0.07, 0.04, 0.07]);

  const float = new THREE.Group();
  float.position.y = 0.9;
  root.add(float);

  // kalkan + mine iç yüzey + pati arması
  const shieldGeo = new THREE.ExtrudeGeometry(shieldShape(1), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.028, bevelSegments: 4, curveSegments: 24 });
  shieldGeo.translate(0, 0, -0.025);
  add(float, shieldGeo, gold);
  const insetGeo = new THREE.ExtrudeGeometry(shieldShape(0.78), { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 24 });
  add(float, insetGeo, enamel, [0, 0.012, 0.05]);
  add(float, sphere, gold, [0, -0.07, 0.085], null, [0.085, 0.07, 0.03]);
  for (const [x, y] of [[-0.1, 0.05], [-0.037, 0.105], [0.037, 0.105], [0.1, 0.05]]) {
    add(float, sphere, gold, [x, y, 0.082], null, [0.036, 0.043, 0.024]);
  }
  add(float, new THREE.OctahedronGeometry(0.05), gem, [0, 0.39, 0.03], null, [1, 1.35, 0.7]);

  // kanatlar
  const wings = [];
  const N = 7;
  for (const s of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(s * 0.24, 0.14, -0.06);
    float.add(wing);
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const ang = lerp(1.25, -0.3, t);
      const L = lerp(0.72, 0.32, t);
      const f = add(wing, featherGeo(L, 0.13), i % 2 ? goldDark : gold, [0, -t * 0.05, -0.014 * i], [0, 0, s > 0 ? ang : Math.PI - ang]);
      f.castShadow = true;
      if (i < N - 1) {
        const a2 = lerp(1.25, -0.3, (i + 0.5) / (N - 1));
        add(wing, featherGeo(L * 0.5, 0.11), gold, [0, -t * 0.05, 0.012], [0, 0, s > 0 ? a2 : Math.PI - a2]);
      }
    }
    wings.push([wing, s]);
  }

  root.userData.tick = (t) => {
    float.position.y = 0.9 + Math.sin(t * 1.6) * 0.025;
    float.rotation.y = Math.sin(t * 0.7) * 0.06;
    for (const [w, s] of wings) w.rotation.y = -s * (0.35 + Math.sin(t * 2.2) * 0.08);
    gem.emissiveIntensity = 1.3 + Math.sin(t * 3) * 0.35;
  };
  root.userData.themed = [gem];
  return root;
}

/**
 * Prosedürel eser oluştur. pal: { ember, aegis, radiant, dire, direDeep, theme } (css renk dizgileri)
 */
export function buildExhibit(id, pal, stoneMap) {
  if (id === 'dog') return buildDog(pal);
  if (id === 'archer') return buildArcher(pal);
  return buildAegis(pal, stoneMap);
}
