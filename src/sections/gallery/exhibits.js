// 3D Müze eserleri: meta veriler + fal modeli yoksa kullanılan prosedürel three.js versiyonları.
// Her prosedürel model: tabanı y=0, ön yüzü +z yönünde, yüksekliği ~1.3–1.55 birim.
// root.userData.tick(t) boşta animasyonu, root.userData.themed tema rengine göre parlayan malzemeler.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EXHIBITS } from './exhibit-data.js';

export { EXHIBITS };

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
  // alın perçemi: kapüşonun altından taşan üç yassı tutam
  for (const [x, y, z, r] of [[-0.11, 0.17, 0.2, 0.35], [0.02, 0.2, 0.21, -0.1], [0.13, 0.16, 0.19, -0.4]]) {
    add(head, sphere, hair, [x, y, z], [0.5, 0, r], [0.11, 0.05, 0.06]);
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

// ====================================================================================
// Salon II · Arena — fal modeli yoksa kullanılan sade chibi yedekler
// ====================================================================================

/** a → b noktaları arasında kapsül uzuv. */
function limb(parent, r, mat, a, b) {
  const A = V(a[0], a[1], a[2]), B = V(b[0], b[1], b[2]);
  const d = B.clone().sub(A);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, d.length() - r), 4, 10), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

const glow = (c, k = 1.6) => std(c, { emissive: c, emissiveIntensity: k, roughness: 0.2 });

/**
 * Ortak chibi gövde: botlar, gövde (ya da yere değen cübbe), kollar, iri kafa, gözler;
 * isteğe bağlı kapüşon, boynuzlu miğfer, sivri kulak, dişler.
 * @returns {{ root, body, head, handR, handL, sphere, skin, cloth }}
 */
function chibi(o) {
  const root = new THREE.Group();
  const sphere = new THREE.SphereGeometry(1, 32, 24);
  const w = o.wide || 1;
  const skin = std(o.skin, { roughness: 0.6 });
  const cloth = std(o.cloth, { roughness: 0.8, side: THREE.DoubleSide });
  const trim = std(o.trim || '#e9b949', { metalness: o.trimMetal === false ? 0 : 0.9, roughness: 0.32 });
  const boots = std(o.boots || '#3b2418', { roughness: 0.8 });
  const eye = o.eyeGlow ? glow(o.eyeGlow, 1.8) : std('#1a1020', { roughness: 0.25 });
  const glint = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const body = new THREE.Group();
  root.add(body);
  for (const s of [-1, 1]) {
    add(root, sphere, boots, [s * 0.1 * w, 0.06, 0.03], null, [0.09 * w, 0.07, 0.12]);
    if (!o.robe) add(root, new THREE.CapsuleGeometry(0.06 * w, 0.14, 4, 10), std(o.pants || '#2a2235', { roughness: 0.85 }), [s * 0.09 * w, 0.19, 0]);
  }
  if (o.robe) {
    const prof = [[0.31, 0.03], [0.28, 0.18], [0.23, 0.4], [0.19, 0.6], [0.16, 0.72]].map(([r, y]) => new THREE.Vector2(r * w, y));
    add(body, new THREE.LatheGeometry(prof, 40), cloth);
    add(body, new THREE.TorusGeometry(0.305 * w, 0.02, 8, 48), trim, [0, 0.04, 0], [Math.PI / 2, 0, 0]);
  } else {
    add(body, new THREE.CylinderGeometry(0.17 * w, 0.2 * w, 0.36, 24), cloth, [0, 0.47, 0]);
  }
  add(body, new THREE.TorusGeometry((o.robe ? 0.215 : 0.19) * w, 0.03, 8, 32), trim, [0, o.robe ? 0.42 : 0.34, 0], [Math.PI / 2, 0, 0]);
  add(body, sphere, cloth, [0, 0.64, 0], null, [0.24 * w, 0.13, 0.19 * w]);
  if (o.pads) for (const s of [-1, 1]) add(body, sphere, trim, [s * 0.24 * w, 0.68, 0], null, [0.11 * w, 0.07, 0.11 * w]);

  // kollar + eller (silah bağlama noktaları)
  const armMat = o.bareArms ? skin : cloth;
  const handR = new THREE.Group();
  const handL = new THREE.Group();
  handR.position.set(0.31 * w, 0.46, 0.16);
  handL.position.set(-0.31 * w, 0.46, 0.16);
  body.add(handR, handL);
  limb(body, 0.058 * w, armMat, [0.21 * w, 0.66, 0], [0.31 * w, 0.46, 0.16]);
  limb(body, 0.058 * w, armMat, [-0.21 * w, 0.66, 0], [-0.31 * w, 0.46, 0.16]);
  add(handR, sphere, skin, [0, 0, 0], null, 0.058 * w);
  add(handL, sphere, skin, [0, 0, 0], null, 0.058 * w);

  // kafa
  const head = new THREE.Group();
  head.position.set(0, 1.0, 0.02);
  root.add(head);
  add(head, sphere, skin, [0, 0, 0], null, [0.3, 0.285, 0.285]);
  for (const s of [-1, 1]) {
    add(head, sphere, eye, [s * 0.1, -0.01, 0.262], null, [0.046, 0.062, 0.03]);
    if (!o.eyeGlow) add(head, sphere, glint, [s * 0.088, 0.012, 0.29], null, 0.014);
    if (o.ears) add(head, new THREE.ConeGeometry(0.07, 0.3, 12), skin, [s * 0.34, 0.04, -0.02], [0, 0, -s * 1.25]);
  }
  if (o.tusks) for (const s of [-1, 1]) add(head, new THREE.ConeGeometry(0.025, 0.09, 8), std('#f3eadb', { roughness: 0.4 }), [s * 0.08, -0.12, 0.25], [0.3, 0, 0]);
  if (o.mask) add(head, new THREE.SphereGeometry(0.29, 32, 16, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.3), std(o.mask, { roughness: 0.5 }), [0, 0.005, 0.012], null, [1.04, 1, 1.04]);

  if (o.hood) {
    const hoodMat = std(o.hood, { roughness: 0.8, side: THREE.DoubleSide });
    const hood = new THREE.Group();
    hood.position.set(0, 0.04, -0.03);
    hood.scale.set(1.02, 1, 1.05);
    head.add(hood);
    const hr = 0.35, open = 0.85, hTheta = Math.PI * 0.66;
    const phiStart = Math.PI / 2 + open, phiLen = Math.PI * 2 - open * 2;
    add(hood, new THREE.SphereGeometry(hr, 40, 24, phiStart, phiLen, 0, hTheta), hoodMat);
    add(hood, new THREE.ConeGeometry(0.11, 0.32, 18), hoodMat, [0, 0.14, -0.33], [-2.0, 0, 0]);
    if (o.hoodTrim) {
      // kapüşon ağzı boyunca şerit (okçudaki gibi)
      const sph = (phi, th) => V(-hr * Math.cos(phi) * Math.sin(th), hr * Math.cos(th), hr * Math.sin(phi) * Math.sin(th));
      const edge = [];
      for (let i = 12; i >= 1; i--) edge.push(sph(phiStart, (i / 12) * hTheta));
      edge.push(V(0, hr, 0));
      for (let i = 1; i <= 12; i++) edge.push(sph(phiStart + phiLen, (i / 12) * hTheta));
      add(hood, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge), 64, 0.016, 8), std(o.hoodTrim, { metalness: 0.6, roughness: 0.35 }));
    }
  }
  if (o.helmet) {
    const bronze = std(o.helmet, { metalness: 0.9, roughness: 0.32 });
    const helm = new THREE.Group();
    helm.position.set(0, 0.05, -0.02);
    helm.rotation.x = -0.12;
    head.add(helm);
    const th = Math.PI * 0.4;
    add(helm, new THREE.SphereGeometry(0.315, 36, 18, 0, Math.PI * 2, 0, th), bronze);
    add(helm, new THREE.TorusGeometry(0.315 * Math.sin(th), 0.028, 10, 48), trim, [0, 0.315 * Math.cos(th), 0], [Math.PI / 2, 0, 0]);
    const ivory = std('#eadcbc', { roughness: 0.45 });
    for (const s of [-1, 1]) add(helm, hornGeo(0.07, 0.34, 0.5, -s), ivory, [s * 0.26, 0.16, 0.02], [0, 0, -s * 1.1]);
  }
  return { root, body, head, handR, handL, sphere, skin, cloth, trim };
}

function bladeShape(len, wid) {
  const s = new THREE.Shape();
  s.moveTo(0.02, wid * 0.45);
  s.quadraticCurveTo(len * 0.6, wid * 0.7, len, wid);
  s.quadraticCurveTo(len * 0.78, 0, len, -wid);
  s.quadraticCurveTo(len * 0.6, -wid * 0.7, 0.02, -wid * 0.45);
  s.lineTo(0.02, wid * 0.45);
  return s;
}

function buildBrute(pal) {
  const c = chibi({ skin: '#c64a3b', cloth: '#4a3426', pants: '#3a2a20', trim: '#b8763a', helmet: '#8e5a2c', tusks: true, pads: true, bareArms: true, wide: 1.2 });
  const steel = std('#c3c8d2', { metalness: 0.95, roughness: 0.28 });
  const wood = std('#6b4228', { roughness: 0.6 });
  // dev çift ağızlı balta: sap sağ elde, ağızlar kafanın yanında
  const axe = new THREE.Group();
  axe.position.set(0.04, 0, 0);
  axe.rotation.z = -0.12;
  c.handR.add(axe);
  add(axe, new THREE.CylinderGeometry(0.022, 0.026, 1.12, 10), wood, [0, 0.3, 0]);
  add(axe, c.sphere, pal.aegis ? std(pal.aegis, { metalness: 1, roughness: 0.3 }) : wood, [0, -0.26, 0], null, 0.035);
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape(0.3, 0.22), { depth: 0.025, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 16 });
  bladeGeo.translate(0, 0, -0.0125);
  add(axe, bladeGeo, steel, [0, 0.74, 0]);
  add(axe, bladeGeo, steel, [0, 0.74, 0], [0, Math.PI, 0]);
  add(axe, new THREE.CylinderGeometry(0.045, 0.045, 0.16, 12), std('#8e5a2c', { metalness: 0.8, roughness: 0.35 }), [0, 0.74, 0]);
  c.root.userData.tick = (t) => {
    c.body.position.y = Math.sin(t * 2) * 0.01;
    c.head.rotation.z = Math.sin(t * 0.9) * 0.05;
    axe.rotation.z = -0.12 + Math.sin(t * 1.4) * 0.04;
  };
  c.root.userData.themed = [];
  return c.root;
}

function buildFrost() {
  const c = chibi({ skin: '#f4d6c4', cloth: '#dbe9f7', trim: '#8fd3ff', hood: '#3d6fa8', hoodTrim: '#cfeeff', robe: true, boots: '#2c3f60' });
  const wood = std('#e8f4ff', { metalness: 0.4, roughness: 0.3 });
  const ice = std('#a8e6ff', { emissive: '#5fc8ff', emissiveIntensity: 1.1, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.92 });
  const staff = new THREE.Group();
  c.handL.add(staff);
  add(staff, new THREE.CylinderGeometry(0.018, 0.022, 1.2, 10), wood, [0, 0.2, 0]);
  const crystal = new THREE.Group();
  crystal.position.set(0, 0.9, 0);
  staff.add(crystal);
  add(crystal, new THREE.OctahedronGeometry(0.1), ice, [0, 0, 0], null, [0.8, 1.6, 0.8]);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    add(crystal, new THREE.OctahedronGeometry(0.045), ice, [Math.cos(a) * 0.09, -0.05, Math.sin(a) * 0.09], [0, a, 0.5], [0.7, 1.5, 0.7]);
  }
  // kar taneleri
  const flakes = [];
  for (let i = 0; i < 6; i++) flakes.push(add(c.root, new THREE.OctahedronGeometry(0.02), ice, [0, 0, 0]));
  c.root.userData.tick = (t) => {
    c.body.position.y = Math.sin(t * 1.8) * 0.008;
    c.head.rotation.z = Math.sin(t * 0.8) * 0.04;
    crystal.rotation.y = t * 0.9;
    ice.emissiveIntensity = 1 + Math.sin(t * 2.4) * 0.3;
    flakes.forEach((f, i) => {
      const a = t * 0.6 + (i / flakes.length) * Math.PI * 2;
      f.position.set(-0.31 + Math.cos(a) * 0.22, 1.1 + ((t * 0.25 + i / 6) % 1) * 0.5, 0.16 + Math.sin(a) * 0.22);
    });
  };
  c.root.userData.themed = [];
  return c.root;
}

function buildShadow(pal) {
  const c = chibi({ skin: '#d9b8c8', cloth: '#2a1d3d', pants: '#1c1428', trim: '#6c4a9a', trimMetal: false, hood: '#4b2a6e', mask: '#1d1428', eyeGlow: pal.arcane || '#8b7cff', boots: '#1c1428' });
  const blade = glow(pal.arcane || '#8b7cff', 1.4);
  const grip = std('#1c1428', { roughness: 0.7 });
  const daggers = [];
  for (const [hand, s] of [[c.handR, 1], [c.handL, -1]]) {
    const d = new THREE.Group();
    d.rotation.set(1.1, 0, -s * 0.25);
    hand.add(d);
    add(d, new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), grip, [0, -0.02, 0]);
    add(d, new THREE.BoxGeometry(0.12, 0.018, 0.03), std('#6c4a9a', { metalness: 0.8, roughness: 0.3 }), [0, 0.04, 0]);
    add(d, new THREE.ConeGeometry(0.035, 0.3, 4), blade, [0, 0.2, 0], [0, Math.PI / 4, 0], [1, 1, 0.35]);
    daggers.push([d, s]);
  }
  c.root.userData.tick = (t) => {
    c.body.position.y = Math.sin(t * 2.2) * 0.01;
    c.head.rotation.y = Math.sin(t * 0.7) * 0.12;
    blade.emissiveIntensity = 1.2 + Math.sin(t * 3.2) * 0.4;
    for (const [d, s] of daggers) d.rotation.z = -s * (0.25 + Math.sin(t * 1.6 + s) * 0.06);
  };
  c.root.userData.themed = [];
  return c.root;
}

function buildCreepMelee(pal) {
  const c = chibi({ skin: '#8a9a5c', cloth: '#5a3a2a', pants: '#3a2a20', trim: '#7a5a3a', trimMetal: false, ears: true, tusks: true, eyeGlow: pal.dire || '#e0354b', wide: 1.05 });
  const wood = std('#5a3a22', { roughness: 0.7 });
  const iron = std('#8a8a96', { metalness: 0.9, roughness: 0.35 });
  const bone = std('#eadcbc', { roughness: 0.5 });
  const club = new THREE.Group();
  club.rotation.set(0.35, 0, -0.35);
  c.handR.add(club);
  add(club, new THREE.CylinderGeometry(0.025, 0.03, 0.34, 10), wood, [0, 0.1, 0]);
  add(club, new THREE.CylinderGeometry(0.09, 0.05, 0.28, 14), wood, [0, 0.38, 0]);
  for (let i = 0; i < 10; i++) {
    const a = (i / 5) * Math.PI * 2, y = 0.32 + (i % 2) * 0.1;
    add(club, new THREE.ConeGeometry(0.018, 0.07, 6), iron, [Math.cos(a) * 0.085, y, Math.sin(a) * 0.085], [Math.sin(a) * Math.PI / 2, 0, -Math.cos(a) * Math.PI / 2]);
  }
  const shield = new THREE.Group();
  shield.position.set(-0.04, 0.02, 0.06);
  c.handL.add(shield);
  add(shield, new THREE.CylinderGeometry(0.2, 0.2, 0.04, 28), wood, [0, 0, 0], [Math.PI / 2, 0, 0]);
  add(shield, new THREE.TorusGeometry(0.2, 0.018, 8, 32), iron);
  add(shield, c.sphere, bone, [0, 0.02, 0.04], null, [0.09, 0.085, 0.05]);
  for (const s of [-1, 1]) add(shield, c.sphere, std('#1a1020'), [s * 0.035, 0.03, 0.08], null, 0.022);
  add(shield, new THREE.BoxGeometry(0.06, 0.035, 0.03), bone, [0, -0.055, 0.05]);
  c.root.userData.tick = (t) => {
    c.body.position.y = Math.abs(Math.sin(t * 2.4)) * 0.015;
    club.rotation.x = 0.35 + Math.sin(t * 2.4) * 0.08;
  };
  c.root.userData.themed = [];
  c.root.scale.setScalar(0.92);
  return c.root;
}

function buildCreepRanged(pal) {
  const c = chibi({ skin: '#8a9a5c', cloth: '#8f1d2c', trim: '#e9b949', hood: '#6a1420', hoodTrim: '#e9b949', robe: true, ears: false, eyeGlow: '#ffb14a', boots: '#3a1a1a' });
  const wood = std('#4a2a18', { roughness: 0.7 });
  const orb = glow(pal.dire || '#e0354b', 1.8);
  const staff = new THREE.Group();
  staff.rotation.z = 0.08;
  c.handR.add(staff);
  add(staff, new THREE.CylinderGeometry(0.018, 0.022, 1.1, 10), wood, [0, 0.16, 0]);
  const top = new THREE.Group();
  top.position.set(0, 0.8, 0);
  staff.add(top);
  const ball = add(top, c.sphere, orb, [0, 0, 0], null, 0.075);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    add(top, new THREE.TorusGeometry(0.09, 0.01, 6, 16, Math.PI * 0.6), wood, [0, -0.02, 0], [0, a, Math.PI / 2]);
  }
  c.root.userData.tick = (t) => {
    c.body.position.y = Math.sin(t * 1.9) * 0.008;
    ball.scale.setScalar(0.075 * (1 + Math.sin(t * 3) * 0.1));
    orb.emissiveIntensity = 1.6 + Math.sin(t * 3) * 0.5;
  };
  c.root.userData.themed = [];
  c.root.scale.setScalar(0.92);
  return c.root;
}

function buildRoshan(pal, stoneMap) {
  const root = new THREE.Group();
  const sphere = new THREE.SphereGeometry(1, 32, 24);
  const rock = std('#8a8098', { roughness: 0.92, map: stoneMap || null });
  const rockDark = std('#5a526a', { roughness: 0.95, map: stoneMap || null });
  const ivory = std('#eadcbc', { roughness: 0.45 });
  const eye = glow(pal.ember || '#ff6a2b', 2);
  const body = new THREE.Group();
  root.add(body);
  add(body, sphere, rock, [0, 0.62, -0.04], null, [0.56, 0.5, 0.46]);
  add(body, sphere, rockDark, [0, 0.5, 0.2], null, [0.36, 0.32, 0.28]);
  for (const s of [-1, 1]) {
    limb(root, 0.12, rockDark, [s * 0.26, 0.3, 0], [s * 0.28, 0.08, 0.06]);
    add(root, sphere, rock, [s * 0.28, 0.07, 0.1], null, [0.16, 0.08, 0.2]);
    limb(body, 0.12, rock, [s * 0.5, 0.86, 0], [s * 0.64, 0.36, 0.22]);
    add(body, sphere, rockDark, [s * 0.65, 0.3, 0.24], null, 0.15);
    add(body, sphere, rock, [s * 0.46, 0.96, -0.02], null, [0.2, 0.15, 0.2]);
  }
  for (let i = 0; i < 5; i++) add(body, new THREE.ConeGeometry(0.07, 0.22, 8), rockDark, [(i - 2) * 0.14, 1.02 - Math.abs(i - 2) * 0.06, -0.3], [-0.5, 0, (i - 2) * -0.2]);
  const head = new THREE.Group();
  head.position.set(0, 1.0, 0.24);
  root.add(head);
  add(head, sphere, rock, [0, 0, 0], null, [0.28, 0.24, 0.26]);
  add(head, sphere, rockDark, [0, -0.1, 0.12], null, [0.2, 0.12, 0.16]);
  for (const s of [-1, 1]) {
    add(head, sphere, eye, [s * 0.1, 0.03, 0.22], null, [0.045, 0.03, 0.02]);
    add(head, hornGeo(0.07, 0.42, 0.7, -s), ivory, [s * 0.2, 0.12, -0.02], [0, 0, -s * 1.2]);
    add(head, new THREE.ConeGeometry(0.022, 0.08, 8), ivory, [s * 0.08, -0.15, 0.24], [0.2, 0, 0]);
  }
  root.userData.tick = (t) => {
    body.scale.set(1, 1 + Math.sin(t * 1.1) * 0.015, 1);
    head.rotation.y = Math.sin(t * 0.5) * 0.12;
    eye.emissiveIntensity = 1.8 + Math.sin(t * 2) * 0.5;
  };
  root.userData.themed = [];
  return root;
}

function buildTower(pal, stoneMap, dire) {
  const root = new THREE.Group();
  const stone = std(dire ? '#3a3040' : '#e9e2d0', { roughness: 0.85, map: stoneMap || null });
  const trim = dire ? std('#6a2030', { metalness: 0.6, roughness: 0.4 }) : std(pal.aegis || '#e9b949', { metalness: 1, roughness: 0.28 });
  const col = dire ? pal.dire || '#e0354b' : pal.radiant || '#43d6a0';
  const gem = glow(col, 1.6);
  const spike = std(dire ? '#1e1824' : '#f6efe0', { roughness: 0.5, metalness: dire ? 0.3 : 0 });
  add(root, new THREE.CylinderGeometry(0.42, 0.48, 0.16, 10), stone, [0, 0.08, 0]);
  add(root, new THREE.CylinderGeometry(0.3, 0.37, 0.78, 10), stone, [0, 0.55, 0]);
  add(root, new THREE.TorusGeometry(0.37, 0.022, 8, 40), trim, [0, 0.18, 0], [Math.PI / 2, 0, 0]);
  add(root, new THREE.TorusGeometry(0.31, 0.02, 8, 40), trim, [0, 0.9, 0], [Math.PI / 2, 0, 0]);
  add(root, new THREE.CylinderGeometry(0.4, 0.33, 0.12, 10), stone, [0, 1.0, 0]);
  add(root, new THREE.BoxGeometry(0.14, 0.24, 0.05), std('#1a1020', { roughness: 0.6 }), [0, 0.3, 0.34]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    if (dire) add(root, new THREE.ConeGeometry(0.045, 0.3, 6), spike, [Math.cos(a) * 0.36, 1.14, Math.sin(a) * 0.36], [Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55]);
    else add(root, new THREE.BoxGeometry(0.1, 0.12, 0.1), stone, [Math.cos(a) * 0.34, 1.11, Math.sin(a) * 0.34], [0, -a, 0]);
  }
  if (dire) for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    add(root, new THREE.ConeGeometry(0.035, 0.22, 6), spike, [Math.cos(a) * 0.33, 0.6, Math.sin(a) * 0.33], [Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3]);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    add(root, new THREE.CylinderGeometry(0.018, 0.026, 0.3, 6), trim, [Math.cos(a) * 0.14, 1.2, Math.sin(a) * 0.14], [Math.sin(a) * -0.35, 0, Math.cos(a) * 0.35]);
  }
  const crystal = add(root, new THREE.OctahedronGeometry(0.13), gem, [0, 1.46, 0], null, [0.8, 1.5, 0.8]);
  root.userData.tick = (t) => {
    crystal.rotation.y = t * 0.8;
    crystal.position.y = 1.46 + Math.sin(t * 1.6) * 0.03;
    gem.emissiveIntensity = 1.5 + Math.sin(t * 2.2) * 0.4;
  };
  root.userData.themed = [];
  return root;
}

function buildCourier(pal) {
  const root = new THREE.Group();
  const sphere = new THREE.SphereGeometry(1, 32, 24);
  const fur = std('#9a8c80', { roughness: 0.85 });
  const furLight = std('#d9cfc4', { roughness: 0.9 });
  const dark = std('#1d1210', { roughness: 0.22 });
  const glint = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const leather = std('#8a5a2e', { roughness: 0.7 });
  const leatherDark = std('#5a3620', { roughness: 0.75 });
  const feather = std('#f6efe0', { roughness: 0.6, side: THREE.DoubleSide });
  const gold = std(pal.aegis || '#e9b949', { metalness: 1, roughness: 0.28 });
  add(root, sphere, fur, [0, 0.55, 0], null, [0.3, 0.28, 0.46]);
  add(root, sphere, furLight, [0, 0.47, 0.04], null, [0.24, 0.19, 0.38]);
  for (const [x, z] of [[-0.16, 0.26], [0.16, 0.26], [-0.16, -0.26], [0.16, -0.26]]) {
    add(root, new THREE.CapsuleGeometry(0.07, 0.24, 4, 10), fur, [x, 0.22, z]);
    add(root, sphere, dark, [x, 0.06, z], null, [0.075, 0.05, 0.085]);
  }
  for (const s of [-1, 1]) {
    add(root, new RoundedBoxGeometry(0.12, 0.2, 0.26, 3, 0.04), leather, [s * 0.33, 0.52, -0.04], [0, 0, s * 0.1]);
    add(root, new RoundedBoxGeometry(0.13, 0.07, 0.27, 2, 0.025), leatherDark, [s * 0.34, 0.62, -0.04], [0, 0, s * 0.1]);
  }
  add(root, new THREE.TorusGeometry(0.3, 0.02, 8, 48), leatherDark, [0, 0.55, -0.04], null, [1, 0.95, 1]);
  const tail = new THREE.Group();
  tail.position.set(0, 0.62, -0.44);
  root.add(tail);
  add(tail, new THREE.CylinderGeometry(0.02, 0.02, 0.24, 8), fur, [0, -0.1, -0.04], [0.4, 0, 0]);
  add(tail, sphere, dark, [0, -0.22, -0.08], null, [0.04, 0.07, 0.04]);
  const head = new THREE.Group();
  head.position.set(0, 0.86, 0.4);
  root.add(head);
  add(head, sphere, fur, [0, 0, 0], null, [0.2, 0.2, 0.2]);
  add(head, sphere, furLight, [0, -0.08, 0.16], null, [0.14, 0.11, 0.15]);
  add(head, sphere, dark, [0, -0.06, 0.3], null, [0.05, 0.03, 0.02]);
  const ears = [];
  for (const s of [-1, 1]) {
    add(head, sphere, dark, [s * 0.09, 0.04, 0.16], null, [0.04, 0.05, 0.03]);
    add(head, sphere, glint, [s * 0.082, 0.06, 0.188], null, 0.011);
    const ear = new THREE.Group();
    ear.position.set(s * 0.1, 0.14, -0.02);
    head.add(ear);
    add(ear, sphere, fur, [s * 0.04, 0.14, 0], [0, 0, -s * 0.3], [0.05, 0.17, 0.035]);
    ears.push([ear, s]);
  }
  add(head, new THREE.TorusGeometry(0.2, 0.018, 8, 32), gold, [0, -0.08, -0.02], [1.3, 0, 0]);
  const wings = [];
  for (const s of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(s * 0.18, 0.78, 0.06);
    root.add(wing);
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const ang = lerp(1.0, -0.2, t);
      add(wing, featherGeo(lerp(0.52, 0.26, t), 0.1), feather, [0, -t * 0.04, -0.06 * i], [0, 0, s > 0 ? ang : Math.PI - ang]);
    }
    wings.push([wing, s]);
  }
  root.userData.tick = (t) => {
    root.position.y = 0;
    for (const [w, s] of wings) w.rotation.y = -s * (0.2 + Math.sin(t * 5) * 0.25);
    for (const [e, s] of ears) e.rotation.z = s * Math.sin(t * 2.2 + s) * 0.15;
    tail.rotation.z = Math.sin(t * 6) * 0.3;
    head.rotation.x = Math.sin(t * 1.2) * 0.05;
  };
  root.userData.themed = [];
  return root;
}

const BUILDERS = {
  dog: (pal) => buildDog(pal),
  archer: (pal) => buildArcher(pal),
  aegis: (pal, stone) => buildAegis(pal, stone),
  brute: (pal) => buildBrute(pal),
  frost: () => buildFrost(),
  shadow: (pal) => buildShadow(pal),
  'creep-melee': (pal) => buildCreepMelee(pal),
  'creep-ranged': (pal) => buildCreepRanged(pal),
  roshan: (pal, stone) => buildRoshan(pal, stone),
  'tower-radiant': (pal, stone) => buildTower(pal, stone, false),
  'tower-dire': (pal, stone) => buildTower(pal, stone, true),
  courier: (pal) => buildCourier(pal),
};

/**
 * Prosedürel eser oluştur. pal: { ember, aegis, radiant, dire, direDeep, arcane, theme } (css renk dizgileri)
 */
export function buildExhibit(id, pal, stoneMap) {
  return (BUILDERS[id] || BUILDERS.aegis)(pal, stoneMap);
}
