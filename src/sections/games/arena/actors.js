// 1vDOQUZ Arena — sahnedeki karakterler ve nesneler.
// fal.ai modelleri (model-dog, model-archer, model-hero-*, model-creep-*, model-roshan, model-tower-*, model-courier,
// model-aegis) varsa onları kullanır, yoksa primitiflerden prosedürel yedekler kurar.

import * as THREE from 'three';
import { DOG_TYPES } from './dogs.js';
import { HEROES } from './heroes.js';
import { makeCanvas, toTexture, tok } from './textures.js';

/**
 * GLB modellerinin "ileri" yönü düzeltmesi (radyan, y ekseni). Oyun ileri = +z.
 * Trellis modelleri 3/4 önden üretildi; sahnede tek tek doğrulandı.
 */
export const MODEL_YAW = {
  'model-dog': 0,
  'model-archer': 0,
  'model-hero-brute': 0,
  'model-hero-frost': 0,
  'model-hero-shadow': 0,
  'model-creep-melee': 0,
  'model-creep-ranged': 0,
  'model-roshan': 0,
  'model-tower-radiant': 0,
  'model-tower-dire': 0,
  'model-courier': 0,
};
export const DOG_MODEL_YAW = MODEL_YAW['model-dog'];
export const ARCHER_MODEL_YAW = MODEL_YAW['model-archer'];

const TAU = Math.PI * 2;

/** Paylaşılan geometri/malzeme kutusu; view kapatılırken toptan dispose edilir. */
export class Bin {
  constructor() { this.items = new Set(); }
  add(x) { if (x) this.items.add(x); return x; }
  dispose() {
    for (const x of this.items) {
      try { x.dispose(); } catch { /* yok say */ }
    }
    this.items.clear();
  }
}

function std(bin, color, o = {}) {
  return bin.add(new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.05, ...o }));
}

function mesh(geo, mat, shadows) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = !!shadows;
  m.receiveShadow = false;
  return m;
}

// ------------------------------------------------------------------ paylaşılan geometriler
export function makeGeoms(bin) {
  const G = {};
  const a = (k, g) => { G[k] = bin.add(g); };
  // köpek
  a('dTorso', new THREE.CapsuleGeometry(0.2, 0.34, 6, 12));
  a('dChest', new THREE.SphereGeometry(0.17, 14, 10));
  a('dLeg', new THREE.CylinderGeometry(0.056, 0.048, 0.28, 8));
  a('dPaw', new THREE.SphereGeometry(0.062, 8, 6));
  a('dHead', new THREE.SphereGeometry(0.2, 18, 14));
  a('dMuzzle', new THREE.SphereGeometry(0.115, 12, 10));
  a('dNose', new THREE.SphereGeometry(0.042, 8, 6));
  a('dEye', new THREE.SphereGeometry(0.036, 8, 6));
  a('dEar', new THREE.SphereGeometry(0.1, 10, 8));
  a('dHelm', new THREE.SphereGeometry(0.215, 16, 8, 0, TAU, 0, Math.PI * 0.5));
  a('dRim', new THREE.TorusGeometry(0.212, 0.022, 6, 24));
  a('dHorn', new THREE.ConeGeometry(0.048, 0.2, 8));
  a('dScarf', new THREE.TorusGeometry(0.165, 0.052, 8, 18));
  a('dScarfTail', new THREE.BoxGeometry(0.09, 0.02, 0.2));
  a('dBag', new THREE.BoxGeometry(0.12, 0.14, 0.18));
  a('dTail', new THREE.CylinderGeometry(0.035, 0.02, 0.26, 6));
  a('gem', new THREE.OctahedronGeometry(0.09, 0));
  a('plane', new THREE.PlaneGeometry(1, 1));
  // okçu
  a('aLeg', new THREE.CapsuleGeometry(0.075, 0.26, 4, 8));
  a('aBoot', new THREE.SphereGeometry(0.09, 10, 8));
  a('aTorso', new THREE.CylinderGeometry(0.18, 0.24, 0.52, 14));
  a('aBelt', new THREE.TorusGeometry(0.225, 0.028, 6, 20));
  a('aCloak', new THREE.ConeGeometry(0.42, 1.0, 20, 1, true, 0.55, TAU - 1.1));
  a('aCollar', new THREE.TorusGeometry(0.2, 0.075, 8, 20));
  a('aHead', new THREE.SphereGeometry(0.19, 18, 14));
  a('aHood', new THREE.SphereGeometry(0.24, 18, 14, Math.PI / 2 + 0.75, TAU - 1.5, 0, Math.PI * 0.64));
  a('aHoodTip', new THREE.ConeGeometry(0.09, 0.28, 10));
  a('aEye', new THREE.SphereGeometry(0.026, 8, 6));
  a('aArm', new THREE.CapsuleGeometry(0.058, 0.3, 4, 8));
  a('aBow', new THREE.TorusGeometry(0.5, 0.03, 6, 26, Math.PI * 0.8));
  a('aQuiver', new THREE.CylinderGeometry(0.085, 0.07, 0.46, 10));
  a('aFletch', new THREE.BoxGeometry(0.05, 0.1, 0.012));
  // ok
  a('arShaft', new THREE.CylinderGeometry(0.02, 0.02, 0.78, 5));
  a('arHead', new THREE.ConeGeometry(0.05, 0.16, 6));
  a('arFletch', new THREE.PlaneGeometry(0.08, 0.16));
  // eşyalar
  a('rBlade', new THREE.CylinderGeometry(0.0, 0.05, 0.95, 4));
  a('rGuard', new THREE.BoxGeometry(0.36, 0.05, 0.07));
  a('rGrip', new THREE.CylinderGeometry(0.026, 0.026, 0.2, 6));
  a('rPommel', new THREE.SphereGeometry(0.048, 8, 6));
  a('pedA', new THREE.CylinderGeometry(0.6, 0.72, 0.3, 8));
  a('pedB', new THREE.CylinderGeometry(0.44, 0.52, 0.28, 8));
  a('shield', new THREE.CylinderGeometry(0.44, 0.44, 0.08, 6));
  a('shieldRim', new THREE.TorusGeometry(0.44, 0.04, 6, 6));
  a('boss', new THREE.SphereGeometry(0.13, 14, 10));
  const wing = new THREE.Shape();
  wing.moveTo(0, 0);
  wing.bezierCurveTo(0.3, 0.35, 0.75, 0.55, 1.05, 0.62);
  wing.bezierCurveTo(0.9, 0.45, 0.95, 0.35, 0.82, 0.3);
  wing.bezierCurveTo(0.9, 0.2, 0.85, 0.12, 0.72, 0.1);
  wing.bezierCurveTo(0.75, 0.0, 0.6, -0.05, 0.5, -0.02);
  wing.bezierCurveTo(0.35, -0.12, 0.15, -0.1, 0, 0);
  a('wing', new THREE.ExtrudeGeometry(wing, { depth: 0.04, bevelEnabled: false }));
  a('beam', new THREE.CylinderGeometry(0.55, 0.85, 5, 16, 1, true));
  // Arena 2.0
  a('iceBlock', new THREE.IcosahedronGeometry(0.62, 0));
  a('rosBody', new THREE.DodecahedronGeometry(0.9, 0));
  a('towerShaft', new THREE.CylinderGeometry(0.42, 0.62, 2.6, 8));
  a('towerRoof', new THREE.ConeGeometry(0.8, 0.9, 8));
  a('runeCore', new THREE.OctahedronGeometry(0.3, 0));
  a('runeRing', new THREE.TorusGeometry(0.46, 0.035, 6, 28));
  a('cheese', new THREE.CylinderGeometry(0.34, 0.34, 0.26, 3));
  return G;
}

// ------------------------------------------------------------------ etiket (isim + can + durum)
const GLYPH_H = 44;

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

function drawGlyph(g, status, color, cx, cy) {
  g.save();
  g.lineJoin = 'round';
  g.shadowColor = 'rgba(0,0,0,0.8)';
  g.shadowBlur = 6;
  const text = (s, col, size = 34) => {
    g.font = `900 ${size}px Unbounded, "Arial Black", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(8,6,12,0.9)';
    g.strokeText(s, cx, cy);
    g.fillStyle = col;
    g.fillText(s, cx, cy);
  };
  switch (status) {
    case 'pause': {
      g.fillStyle = 'rgba(8,6,12,0.85)';
      roundRect(g, cx - 26, cy - 20, 52, 40, 8);
      g.fill();
      g.fillStyle = color;
      roundRect(g, cx - 15, cy - 14, 10, 28, 3);
      g.fill();
      roundRect(g, cx + 5, cy - 14, 10, 28, 3);
      g.fill();
      break;
    }
    case 'afk': text('zZ', '#cfe6ff', 30); break;
    case 'fear': text('!!', '#ff9a3d', 36); break;
    case 'gg': text('GG', '#e9b949', 30); break;
    case 'loot': text('+TANGO', '#43d6a0', 24); break;
    case 'chat': {
      g.fillStyle = '#fff6ea';
      roundRect(g, cx - 30, cy - 16, 60, 30, 12);
      g.fill();
      g.fillStyle = '#e0354b';
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(cx + i * 14, cy - 1, 4.5, 0, TAU); g.fill(); }
      break;
    }
    case 'stun': {
      g.fillStyle = '#f6d98a';
      for (const dx of [-16, 16]) {
        g.beginPath();
        g.moveTo(cx + dx, cy - 13);
        g.lineTo(cx + dx + 7, cy);
        g.lineTo(cx + dx, cy + 13);
        g.lineTo(cx + dx - 7, cy);
        g.closePath();
        g.fill();
      }
      break;
    }
    case 'dash': {
      g.strokeStyle = '#ff4d63';
      g.lineWidth = 7;
      g.lineCap = 'round';
      for (const dx of [-12, 6]) {
        g.beginPath();
        g.moveTo(cx + dx, cy - 13);
        g.lineTo(cx + dx + 12, cy);
        g.lineTo(cx + dx, cy + 13);
        g.stroke();
      }
      break;
    }
    case 'farm': {
      g.fillStyle = '#e9b949';
      g.beginPath(); g.arc(cx, cy, 15, 0, TAU); g.fill();
      g.fillStyle = '#8a5a12';
      g.beginPath(); g.arc(cx, cy, 9, 0, TAU); g.fill();
      g.fillStyle = '#f6d98a';
      g.fillRect(cx - 2, cy - 7, 4, 14);
      break;
    }
    case 'mid': text('MID', '#ff9a3d', 22); break;
    case 'taunt': text('!', '#ff4d5e', 40); break;
    case 'lost': text('?', '#cfc6ff', 38); break;
    case 'frozen': {
      g.strokeStyle = '#bff0ff';
      g.lineWidth = 5;
      g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        g.beginPath();
        g.moveTo(cx - Math.cos(a) * 15, cy - Math.sin(a) * 15);
        g.lineTo(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15);
        g.stroke();
      }
      break;
    }
    default: break;
  }
  g.restore();
}

export class Label {
  constructor(bin) {
    this.c = makeCanvas(256, 128);
    this.g = this.c.getContext('2d');
    this.tex = bin.add(toTexture(this.c, { mips: false }));
    this.mat = bin.add(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false }));
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.center.set(0.5, 0);
    this.sprite.scale.set(1.5, 0.75, 1);
    this.sprite.renderOrder = 20;
    this.key = '';
  }

  draw({ name, color, hp, maxHp, status, elite, tag }) {
    const frac = Math.max(0, Math.min(1, hp / maxHp));
    const key = `${name}|${status}|${Math.round(frac * 60)}|${elite}|${tag || ''}`;
    if (key === this.key) return;
    this.key = key;
    const g = this.g;
    g.clearRect(0, 0, 256, 128);
    if (status) drawGlyph(g, status, color, 128, GLYPH_H / 2 + 2);
    // isim plakası
    const label = tag ? `${name} · ${tag}` : name;
    g.font = '800 25px Unbounded, "Arial Black", sans-serif';
    const tw = Math.min(250, g.measureText(label).width + 30);
    const x0 = 128 - tw / 2;
    g.fillStyle = 'rgba(10,8,16,0.8)';
    roundRect(g, x0, 48, tw, 36, 6);
    g.fill();
    if (elite) {
      g.strokeStyle = '#e9b949';
      g.lineWidth = 3;
      g.stroke();
    }
    g.fillStyle = color;
    g.fillRect(x0 + 5, 55, 5, 22);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff4e6';
    g.fillText(label, 128 + 4, 67, 236);
    // can çubuğu
    const bx = 38;
    const bw = 180;
    g.fillStyle = 'rgba(8,6,12,0.9)';
    g.fillRect(bx - 3, 90, bw + 6, 18);
    const fill = g.createLinearGradient(0, 92, 0, 106);
    fill.addColorStop(0, '#ff5a6e');
    fill.addColorStop(1, '#a51c30');
    g.fillStyle = fill;
    g.fillRect(bx, 93, bw * frac, 12);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(bx, 93, bw * frac, 3);
    // her 50 can için çentik
    g.fillStyle = 'rgba(0,0,0,0.55)';
    const ticks = Math.floor(maxHp / 50);
    for (let i = 1; i < ticks; i++) {
      const tx = bx + (bw * (i * 50)) / maxHp;
      if (tx < bx + bw * frac) g.fillRect(tx, 93, 1.5, 12);
    }
    this.tex.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ köpek
function lighten(hex, k) {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color('#ffffff'), k);
  return c;
}

export class DogRig {
  constructor(kit) {
    const { G, bin, shadows, dogModel, ringTex, glowTex } = kit;
    this.kit = kit;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.mats = [];
    const own = (m) => { this.mats.push(m); m.transparent = true; return bin.add(m); };
    this.m = {
      fur: own(new THREE.MeshStandardMaterial({ color: '#c98f5a', roughness: 0.85 })),
      fur2: own(new THREE.MeshStandardMaterial({ color: '#f0dcc0', roughness: 0.85 })),
      dark: own(new THREE.MeshStandardMaterial({ color: '#241a1a', roughness: 0.6 })),
      bronze: own(new THREE.MeshStandardMaterial({ color: '#b07a3a', roughness: 0.35, metalness: 0.7 })),
      bone: own(new THREE.MeshStandardMaterial({ color: '#efe3c8', roughness: 0.6 })),
      accent: own(new THREE.MeshStandardMaterial({ color: '#e0354b', roughness: 0.7 })),
      bag: own(new THREE.MeshStandardMaterial({ color: '#6b4426', roughness: 0.9 })),
      eye: own(new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ff6a2b', emissiveIntensity: 1.4, roughness: 0.3 })),
    };
    this.legs = [];
    this.flashables = [this.m.fur, this.m.fur2];
    if (dogModel) {
      const clone = dogModel.clone(true);
      clone.rotation.y = DOG_MODEL_YAW;
      this.modelMats = [];
      clone.traverse((o) => {
        if (o.isMesh) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          const cloned = mats.map((mm) => {
            const c = mm.clone();
            c.transparent = true;
            this.mats.push(bin.add(c));
            if ('emissive' in c) this.flashables.push(c);
            return c;
          });
          o.material = Array.isArray(o.material) ? cloned : cloned[0];
          o.castShadow = !!shadows;
        }
      });
      this.body.add(clone);
      // tür rengi taşı (GLB'de göz konumu bilinmediğinden baş üstünde parlar)
      this.gem = mesh(G.gem, this.m.eye, false);
      this.gem.position.set(0, 1.02, 0);
      this.body.add(this.gem);
      this.procedural = false;
    } else {
      this.buildProcedural(G, shadows);
      this.procedural = true;
    }
    // zemin halkası (tür rengi)
    this.haloMat = bin.add(new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
    this.halo = new THREE.Mesh(G.plane, this.haloMat);
    this.halo.rotation.x = -Math.PI / 2;
    this.halo.position.y = 0.04;
    this.halo.scale.setScalar(1.25);
    this.halo.renderOrder = 2;
    this.root.add(this.halo);
    this.eliteMat = bin.add(new THREE.MeshBasicMaterial({ map: kit.dashRingTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8, color: new THREE.Color(tok('--aegis', '#e9b949')) }));
    this.eliteRing = new THREE.Mesh(G.plane, this.eliteMat);
    this.eliteRing.rotation.x = -Math.PI / 2;
    this.eliteRing.position.y = 0.05;
    this.eliteRing.scale.setScalar(1.6);
    this.eliteRing.renderOrder = 2;
    this.root.add(this.eliteRing);
    // sahte gölge (gölgeler kapalıyken)
    if (!shadows) {
      this.blobMat = bin.add(new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
      this.blob = new THREE.Mesh(G.plane, this.blobMat);
      this.blob.rotation.x = -Math.PI / 2;
      this.blob.position.y = 0.03;
      this.blob.scale.set(1.1, 1.3, 1);
      this.root.add(this.blob);
    }
    this.label = new Label(bin);
    this.labelGroup = new THREE.Group();
    this.labelGroup.add(this.label.sprite);
    this.ice = new THREE.Mesh(G.iceBlock, kit.iceMat);
    this.ice.position.y = 0.48;
    this.ice.visible = false;
    this.root.add(this.ice);
    this.phase = Math.random() * 10;
    this.type = null;
  }

  buildProcedural(G, sh) {
    const m = this.m;
    const b = this.body;
    const torso = mesh(G.dTorso, m.fur, sh);
    torso.rotation.x = Math.PI / 2;
    torso.position.set(0, 0.4, -0.03);
    b.add(torso);
    const chest = mesh(G.dChest, m.fur2, sh);
    chest.position.set(0, 0.38, 0.17);
    chest.scale.set(1, 1, 0.8);
    b.add(chest);
    for (const [x, z] of [[-0.12, 0.17], [0.12, 0.17], [-0.12, -0.2], [0.12, -0.2]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.3, z);
      const leg = mesh(G.dLeg, m.fur, sh);
      leg.position.y = -0.14;
      const paw = mesh(G.dPaw, m.fur2, false);
      paw.position.set(0, -0.27, 0.02);
      paw.scale.set(1, 0.7, 1.2);
      pivot.add(leg, paw);
      b.add(pivot);
      this.legs.push(pivot);
    }
    const head = new THREE.Group();
    head.position.set(0, 0.64, 0.28);
    b.add(head);
    this.head = head;
    head.add(mesh(G.dHead, m.fur, sh));
    const muzzle = mesh(G.dMuzzle, m.fur2, false);
    muzzle.position.set(0, -0.06, 0.16);
    muzzle.scale.set(1, 0.78, 1.15);
    head.add(muzzle);
    const nose = mesh(G.dNose, m.dark, false);
    nose.position.set(0, -0.03, 0.29);
    head.add(nose);
    for (const s of [-1, 1]) {
      const eye = mesh(G.dEye, m.eye, false);
      eye.position.set(s * 0.085, 0.035, 0.165);
      head.add(eye);
      const ear = mesh(G.dEar, m.dark, false);
      ear.position.set(s * 0.17, -0.02, -0.01);
      ear.scale.set(0.45, 1.2, 0.3);
      ear.rotation.z = s * 0.45;
      head.add(ear);
      const horn = mesh(G.dHorn, m.bone, false);
      horn.position.set(s * 0.19, 0.15, -0.02);
      horn.rotation.z = -s * 0.95;
      head.add(horn);
    }
    const helm = mesh(G.dHelm, m.bronze, sh);
    helm.position.y = 0.02;
    helm.rotation.x = -0.12;
    head.add(helm);
    const rim = mesh(G.dRim, m.bronze, false);
    rim.position.set(0, 0.02, 0);
    rim.rotation.x = Math.PI / 2 - 0.12;
    head.add(rim);
    const scarf = mesh(G.dScarf, m.accent, false);
    scarf.position.set(0, 0.5, 0.2);
    scarf.rotation.x = Math.PI / 2 - 0.5;
    b.add(scarf);
    const tailS = mesh(G.dScarfTail, m.accent, false);
    tailS.position.set(0.08, 0.46, 0.05);
    tailS.rotation.set(0.5, 0.3, 0.2);
    b.add(tailS);
    const bag = mesh(G.dBag, m.bag, sh);
    bag.position.set(0.2, 0.4, -0.06);
    b.add(bag);
    const tail = new THREE.Group();
    tail.position.set(0, 0.5, -0.33);
    const tm = mesh(G.dTail, m.fur, false);
    tm.position.y = 0.12;
    tail.add(tm);
    tail.rotation.x = -0.7;
    b.add(tail);
    this.tail = tail;
  }

  setType(type, elite) {
    const T = DOG_TYPES[type];
    const col = this.kit.typeColor(type);
    this.type = type;
    this.color = '#' + col.getHexString();
    this.m.fur.color.set(T.fur);
    this.m.fur2.color.copy(lighten(T.fur, 0.55));
    this.m.accent.color.copy(col);
    this.m.eye.emissive.copy(col);
    this.m.eye.color.copy(col);
    this.haloMat.color.copy(col);
    this.eliteRing.visible = !!elite;
    this.label.key = '';
    this.setOpacity(1);
    this.root.rotation.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
  }

  setOpacity(a) {
    if (this._op === a) return;
    this._op = a;
    for (const m of this.mats) m.opacity = a;
  }

  update(d, t, dt, reduced, labelScale = 1.5, execThr = 0) {
    const r = this.root;
    this.ice.visible = !d.dead && d.st && d.st.root > 0;
    if (this.ice.visible) this.ice.rotation.y = d.id;
    r.position.set(d.x, 0, d.z);
    r.rotation.y = d.face;
    let s = d.scale;
    if (d.spawnT > 0) {
      const k = 1 - d.spawnT / 0.55;
      s *= Math.max(0.01, 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2));
    }
    this.body.scale.setScalar(s);
    const moving = Math.min(1.4, (d.speedNow || 0) / 3);
    const frozen = d.status === 'pause' || d.status === 'stun' || d.status === 'frozen';
    if (!frozen) this.phase += dt * (4 + moving * 9);
    const ph = this.phase;
    let by = 0;
    let rx = 0;
    let rz = 0;
    let bz = 0;
    if (d.dead) {
      const k = Math.min(1, d.deathT * 3.2);
      rz = k * 1.45 * (d.id % 2 ? 1 : -1);
      by = -Math.max(0, d.deathT - 0.55) * 0.9;
      this.setOpacity(Math.max(0, 1 - Math.max(0, d.deathT - 0.5) * 2));
    } else {
      if (d.status === 'afk') {
        by = -0.12;
        rx = 0.1;
        rz = 0.08 * Math.sin(t * 1.3 + d.seed);
      } else if (d.status === 'gg') {
        by = Math.abs(Math.sin(t * 7 + d.seed)) * 0.35;
      } else if (d.status === 'farm' && (d.speedNow || 0) < 0.3) {
        rx = 0.35 + Math.sin(t * 9 + d.seed) * 0.15; // yere eğilip farm
      } else {
        by = Math.abs(Math.sin(ph)) * 0.05 * moving;
      }
      if (d.windup > 0) rx = -0.3;
      if (d.lunge > 0) { rx = 0.25; bz = 0.22; }
      if (d.status === 'stun') rz = Math.sin(t * 18) * 0.08;
      if (d.status === 'fear') rz = Math.sin(t * 30) * 0.06;
      let op = 1;
      if (d.type === 'ward') op = d.vis;
      this.setOpacity(op);
    }
    this.body.position.set(0, by, bz);
    this.body.rotation.set(rx, 0, rz);
    for (let i = 0; i < this.legs.length; i++) {
      const sgn = i === 0 || i === 3 ? 1 : -1;
      this.legs[i].rotation.x = frozen || d.dead ? 0 : Math.sin(ph) * 0.7 * moving * sgn;
    }
    if (this.tail) this.tail.rotation.z = Math.sin(t * (d.status === 'gg' ? 22 : 10) + d.seed) * 0.5;
    if (this.head) this.head.rotation.x = d.status === 'afk' ? 0.35 : 0;
    if (this.gem) {
      this.gem.rotation.y = t * 2;
      this.gem.position.y = 1.02 + Math.sin(t * 3 + d.seed) * 0.04;
    }
    // vuruş parlaması
    const fl = d.hitFlash > 0 ? d.hitFlash / 0.16 : 0;
    const tele = d.status === 'dash' ? 0.5 + 0.5 * Math.sin(t * 30) : d.windup > 0 ? 0.35 : 0;
    for (const m of this.flashables) {
      if (fl > 0) m.emissive.setRGB(fl, fl, fl);
      else if (tele > 0) m.emissive.setRGB(tele, tele * 0.1, tele * 0.15);
      else m.emissive.setRGB(0, 0, 0);
    }
    // halo
    const pulse = d.status === 'dash' ? 1.6 + Math.sin(t * 30) * 0.2 : 1.25 + Math.sin(t * 3 + d.seed) * 0.05;
    this.halo.scale.setScalar(pulse * d.scale);
    this.haloMat.opacity = d.dead ? 0 : (d.type === 'ward' ? 0.15 + d.vis * 0.55 : 0.7);
    if (d.status === 'dash') this.haloMat.color.setRGB(1, 0.2, 0.3);
    else this.haloMat.color.copy(this.kit.typeColor(d.type));
    this.eliteRing.rotation.z = t * 1.5;
    // etiket
    const lg = this.labelGroup;
    lg.position.set(d.x, 1.02 * s + by, d.z);
    this.label.sprite.scale.set(labelScale, labelScale * 0.5, 1);
    let lop = 1;
    if (d.dead) lop = Math.max(0, 1 - d.deathT * 3);
    else if (d.type === 'ward') lop = d.vis < 0.45 ? 0.15 : d.vis;
    if (d.spawnT > 0) lop = 1 - d.spawnT / 0.55;
    this.label.mat.opacity = lop;
    lg.visible = lop > 0.02;
    this.label.draw({
      name: DOG_TYPES[d.type].short,
      color: this.color,
      hp: d.hp,
      maxHp: d.maxHp,
      status: d.dead ? null : d.status,
      elite: d.elite,
      tag: execThr > 0 && !d.dead && d.hp <= execThr ? 'İNFAZ' : d.thief ? 'RAPIER!' : d.type === 'farm' && d.state === 'carry' ? '6 SLOT' : d.elite ? 'ELİT' : '',
    });
  }
}

// ------------------------------------------------------------------ okçu
export class ArcherRig {
  constructor(kit) {
    const { G, bin, shadows, archerModel } = kit;
    this.kit = kit;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.flashables = [];
    const jade = tok('--radiant-deep', '#1f8a63');
    this.m = {
      cloak: bin.add(new THREE.MeshStandardMaterial({ color: jade, roughness: 0.8, side: THREE.DoubleSide })),
      hood: bin.add(new THREE.MeshStandardMaterial({ color: jade, roughness: 0.8, side: THREE.DoubleSide })),
      leather: bin.add(new THREE.MeshStandardMaterial({ color: '#5a3a24', roughness: 0.8 })),
      darkLeather: bin.add(new THREE.MeshStandardMaterial({ color: '#2d1d16', roughness: 0.85 })),
      skin: bin.add(new THREE.MeshStandardMaterial({ color: '#e0b48e', roughness: 0.7 })),
      scarf: bin.add(new THREE.MeshStandardMaterial({ color: tok('--ember', '#ff6a2b'), roughness: 0.7 })),
      gold: bin.add(new THREE.MeshStandardMaterial({ color: tok('--aegis', '#e9b949'), roughness: 0.3, metalness: 0.8 })),
      wood: bin.add(new THREE.MeshStandardMaterial({ color: '#7a4a22', roughness: 0.55, metalness: 0.1 })),
      eye: bin.add(new THREE.MeshStandardMaterial({ color: '#fff', emissive: tok('--aegis-2', '#f6d98a'), emissiveIntensity: 2.5 })),
    };
    this.flashables = [this.m.cloak, this.m.hood, this.m.leather, this.m.skin];
    this.legs = [];
    if (archerModel) {
      const clone = archerModel.clone(true);
      clone.rotation.y = ARCHER_MODEL_YAW;
      clone.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = !!shadows;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          const cloned = mats.map((mm) => {
            const c = bin.add(mm.clone());
            if ('emissive' in c) this.flashables.push(c);
            return c;
          });
          o.material = Array.isArray(o.material) ? cloned : cloned[0];
        }
      });
      this.body.add(clone);
      this.procedural = false;
    } else {
      this.build(G, shadows);
      this.procedural = true;
    }
    this.phase = 0;
    this.deadK = 0;
  }

  build(G, sh) {
    const m = this.m;
    const b = this.body;
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.1, 0.44, 0);
      const leg = mesh(G.aLeg, m.darkLeather, sh);
      leg.position.y = -0.2;
      const boot = mesh(G.aBoot, m.leather, false);
      boot.position.set(0, -0.4, 0.04);
      boot.scale.set(1, 0.7, 1.4);
      pivot.add(leg, boot);
      b.add(pivot);
      this.legs.push(pivot);
    }
    const torso = mesh(G.aTorso, m.leather, sh);
    torso.position.y = 0.74;
    b.add(torso);
    const belt = mesh(G.aBelt, m.gold, false);
    belt.position.y = 0.54;
    belt.rotation.x = Math.PI / 2;
    b.add(belt);
    const cloak = mesh(G.aCloak, m.cloak, sh);
    cloak.position.set(0, 0.62, -0.03);
    b.add(cloak);
    const collar = mesh(G.aCollar, m.scarf, false);
    collar.position.y = 1.08;
    collar.rotation.x = Math.PI / 2;
    b.add(collar);
    const head = new THREE.Group();
    head.position.y = 1.28;
    b.add(head);
    head.add(mesh(G.aHead, m.skin, sh));
    const hood = mesh(G.aHood, m.hood, sh);
    hood.position.set(0, 0.02, -0.01);
    head.add(hood);
    const tip = mesh(G.aHoodTip, m.hood, false);
    tip.position.set(0, 0.16, -0.2);
    tip.rotation.x = -1.1;
    head.add(tip);
    for (const s of [-1, 1]) {
      const eye = mesh(G.aEye, m.eye, false);
      eye.position.set(s * 0.068, 0.02, 0.165);
      head.add(eye);
    }
    // kollar
    const armL = mesh(G.aArm, m.leather, false);
    armL.position.set(0.24, 0.98, 0.18);
    armL.rotation.set(1.25, 0, -0.25);
    b.add(armL);
    const armR = mesh(G.aArm, m.leather, false);
    armR.position.set(-0.2, 0.98, 0.08);
    armR.rotation.set(1.0, 0, 0.35);
    b.add(armR);
    this.armR = armR;
    // yay: kavis ileriye bakar, dikey düzlemde
    const bow = new THREE.Group();
    bow.position.set(0.22, 0.98, 0.05);
    bow.rotation.y = -Math.PI / 2;
    const arc = mesh(G.aBow, m.wood, sh);
    arc.rotation.z = -Math.PI * 0.4;
    bow.add(arc);
    const grip = mesh(G.rGrip, m.gold, false);
    grip.position.set(0.5, 0, 0);
    bow.add(grip);
    b.add(bow);
    this.bow = bow;
    // kiriş (çizgi)
    const tipX = Math.cos(Math.PI * 0.4) * 0.5;
    const tipY = Math.sin(Math.PI * 0.4) * 0.5;
    this.tip = { x: tipX, y: tipY };
    const sg = new THREE.BufferGeometry();
    this.stringPos = new Float32Array([tipX, tipY, 0, tipX, 0, 0, tipX, -tipY, 0]);
    sg.setAttribute('position', new THREE.BufferAttribute(this.stringPos, 3));
    this.kit.bin.add(sg);
    this.stringMat = this.kit.bin.add(new THREE.LineBasicMaterial({ color: '#f3eadb' }));
    this.string = new THREE.Line(sg, this.stringMat);
    bow.add(this.string);
    // takılı ok (şarj ederken)
    const nock = new THREE.Group();
    const shaft = mesh(G.arShaft, m.wood, false);
    shaft.rotation.z = Math.PI / 2;
    shaft.position.x = 0.39;
    const headM = mesh(G.arHead, m.gold, false);
    headM.rotation.z = -Math.PI / 2;
    headM.position.x = 0.84;
    nock.add(shaft, headM);
    bow.add(nock);
    this.nock = nock;
    // sadak
    const quiver = mesh(G.aQuiver, m.darkLeather, sh);
    quiver.position.set(-0.12, 0.95, -0.24);
    quiver.rotation.set(-0.25, 0, 0.35);
    b.add(quiver);
    for (let i = 0; i < 3; i++) {
      const f = mesh(G.aFletch, m.scarf, false);
      f.position.set(-0.2 + i * 0.04, 1.22, -0.3 + i * 0.02);
      f.rotation.set(-0.25, i, 0.35);
      b.add(f);
    }
  }

  update(p, t, dt, state) {
    const r = this.root;
    r.position.set(p.x, 0, p.z);
    r.rotation.y = p.face;
    const moving = Math.min(1.6, p.moving || 0);
    this.phase += dt * (3 + moving * 10);
    const ph = this.phase;
    const dead = p.dead;
    this.deadK += ((dead ? 1 : 0) - this.deadK) * Math.min(1, dt * 5);
    this.body.position.set(0, Math.abs(Math.sin(ph)) * 0.07 * moving - this.deadK * 0.2, -p.recoil * 0.1);
    this.body.rotation.set(moving * 0.12 + (p.charging ? -0.06 : 0), 0, this.deadK * 1.45);
    for (let i = 0; i < this.legs.length; i++) {
      this.legs[i].rotation.x = Math.sin(ph + i * Math.PI) * 0.75 * moving;
    }
    if (this.procedural) {
      const pull = p.charging ? 0.08 + p.charge * 0.3 : 0;
      this.stringPos[3] = this.tip.x - pull;
      this.string.geometry.attributes.position.needsUpdate = true;
      this.nock.position.x = this.tip.x - pull - 0.02;
      this.nock.visible = p.charging;
      this.armR.position.z = 0.08 - pull * 0.6;
    }
    // hasar / dokunulmazlık parlaması
    let er = 0;
    let eg = 0;
    let eb = 0;
    if (p.hurtT > 0) { er = p.hurtT * 2.2; eg = 0; eb = p.hurtT * 0.3; }
    else if (p.invuln > 0 && Math.sin(t * 20) > 0) { er = 0.6; eg = 0.45; eb = 0.1; }
    else if (p.rapier > 0) { er = 0.18; eg = 0.13; eb = 0.02; }
    for (const m of this.flashables) m.emissive.setRGB(er, eg, eb);
    this.root.visible = state !== 'hidden';
  }
}

// ------------------------------------------------------------------ Aegis
export function buildAegis(kit, model) {
  const { G, bin, shadows, glowTex, beamTex } = kit;
  const gold = new THREE.Color(tok('--aegis', '#e9b949'));
  const root = new THREE.Group();
  const stone = bin.add(new THREE.MeshStandardMaterial({ color: '#3a3346', roughness: 0.9 }));
  const goldM = bin.add(new THREE.MeshStandardMaterial({ color: gold, roughness: 0.25, metalness: 0.9, emissive: gold, emissiveIntensity: 0.25 }));
  const float = new THREE.Group();
  if (model) {
    root.add(model);
    float.position.y = 0;
  } else {
    const a = mesh(G.pedA, stone, shadows);
    a.position.y = 0.15;
    const b = mesh(G.pedB, stone, shadows);
    b.position.y = 0.44;
    root.add(a, b);
    float.position.y = 1.35;
    const shield = mesh(G.shield, goldM, shadows);
    shield.rotation.x = Math.PI / 2;
    const rim = mesh(G.shieldRim, goldM, false);
    rim.rotation.z = Math.PI / 6;
    const boss = mesh(G.boss, goldM, false);
    boss.position.z = 0.06;
    boss.scale.set(1, 1, 0.6);
    float.add(shield, rim, boss);
    for (const s of [-1, 1]) {
      const w = mesh(G.wing, goldM, false);
      w.position.set(s * 0.32, 0.05, -0.02);
      w.scale.set(s * 0.85, 0.85, 1);
      w.rotation.z = s * 0.15;
      float.add(w);
    }
    root.add(float);
  }
  const glowMat = bin.add(new THREE.SpriteMaterial({ map: glowTex, color: gold, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(3.2, 3.2, 1);
  glow.position.y = 1.35;
  root.add(glow);
  const beamMat = bin.add(new THREE.MeshBasicMaterial({ map: beamTex, color: gold, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.35 }));
  const beam = new THREE.Mesh(G.beam, beamMat);
  beam.position.y = 2.5;
  root.add(beam);
  return { root, float, glow, beam, glowMat, beamMat };
}

// ------------------------------------------------------------------ Rapier
export function buildRapier(kit) {
  const { G, bin, glowTex, ringTex } = kit;
  const gold = new THREE.Color(tok('--aegis', '#e9b949'));
  const root = new THREE.Group();
  const blade = bin.add(new THREE.MeshStandardMaterial({ color: '#dfe6f0', roughness: 0.15, metalness: 1, emissive: '#6a5a30', emissiveIntensity: 0.4 }));
  const goldM = bin.add(new THREE.MeshStandardMaterial({ color: gold, roughness: 0.25, metalness: 0.9 }));
  const grip = bin.add(new THREE.MeshStandardMaterial({ color: '#6b1020', roughness: 0.6 }));
  const sword = new THREE.Group();
  const b = new THREE.Mesh(G.rBlade, blade);
  b.rotation.x = Math.PI;
  b.position.y = -0.47;
  b.rotation.y = Math.PI / 4;
  b.scale.set(1, 1, 0.35);
  const guard = new THREE.Mesh(G.rGuard, goldM);
  const gr = new THREE.Mesh(G.rGrip, grip);
  gr.position.y = 0.12;
  const pm = new THREE.Mesh(G.rPommel, goldM);
  pm.position.y = 0.24;
  sword.add(b, guard, gr, pm);
  sword.position.y = 1.05;
  root.add(sword);
  const glowMat = bin.add(new THREE.SpriteMaterial({ map: glowTex, color: gold, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(1.8, 1.8, 1);
  glow.position.y = 0.9;
  root.add(glow);
  const ringMat = bin.add(new THREE.MeshBasicMaterial({ map: ringTex, color: gold, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
  const ring = new THREE.Mesh(G.plane, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  ring.scale.setScalar(1.3);
  root.add(ring);
  return { root, sword, glow, ring, mats: [blade, goldM, grip, glowMat, ringMat] };
}

// ------------------------------------------------------------------ ok
export function buildArrow(kit) {
  const { G, bin, glowTex, trailTex } = kit;
  const root = new THREE.Group();
  const shaft = new THREE.Mesh(G.arShaft, kit.arrowMats.wood);
  shaft.rotation.x = Math.PI / 2;
  const head = new THREE.Mesh(G.arHead, kit.arrowMats.head);
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.46;
  const f1 = new THREE.Mesh(G.arFletch, kit.arrowMats.fletch);
  f1.rotation.x = Math.PI / 2;
  f1.position.z = -0.32;
  const f2 = f1.clone();
  f2.rotation.y = Math.PI / 2;
  root.add(shaft, head, f1, f2);
  const glowMat = bin.add(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const glow = new THREE.Sprite(glowMat);
  glow.position.z = 0.4;
  root.add(glow);
  const trailMat = bin.add(new THREE.MeshBasicMaterial({ map: trailTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const trail = new THREE.Mesh(G.plane, trailMat);
  trail.rotation.x = -Math.PI / 2;
  root.add(trail);
  root.visible = false;
  return { root, glow, glowMat, trail, trailMat };
}


// ================================================================== Arena 2.0 — yeni aktörler

/** GLB şablonunu klonlar; malzemeler bu kopyaya özel (yanıp sönme / saydamlık için). */
export function cloneModel(template, kit, { transparent = true, shadows = kit.shadows } = {}) {
  const obj = template.clone(true);
  const mats = [];
  const flash = [];
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const cl = list.map((mm) => {
      const c = kit.bin.add(mm.clone());
      c.transparent = transparent;
      mats.push(c);
      if ('emissive' in c) flash.push(c);
      return c;
    });
    o.material = Array.isArray(o.material) ? cl : cl[0];
    o.castShadow = !!shadows;
    o.receiveShadow = false;
  });
  return { obj, mats, flash };
}

/** Sabit piksel boyutlu can çubuğu (iki sprite; canvas yok, ucuz). */
export class HpBar {
  constructor(kit, { w = 1, h = 0.12, color = '#e0354b' } = {}) {
    this.w = w;
    this.h = h;
    this.group = new THREE.Group();
    this.bgMat = kit.bin.add(new THREE.SpriteMaterial({ color: '#07060b', transparent: true, opacity: 0.82, depthTest: false, depthWrite: false }));
    this.fillMat = kit.bin.add(new THREE.SpriteMaterial({ color, transparent: true, depthTest: false, depthWrite: false }));
    this.bg = new THREE.Sprite(this.bgMat);
    this.fill = new THREE.Sprite(this.fillMat);
    this.bg.center.set(0, 0.5);
    this.fill.center.set(0, 0.5);
    this.bg.renderOrder = 19;
    this.fill.renderOrder = 20;
    this.group.add(this.bg, this.fill);
    this.color = new THREE.Color(color);
    this.k = 1;
  }

  set(frac, k = 1, color = null) {
    const w = this.w * k;
    const h = this.h * k;
    const pad = 0.03 * k;
    this.bg.position.set(-w / 2 - pad, 0, 0);
    this.bg.scale.set(w + pad * 2, h + pad * 2, 1);
    this.fill.position.set(-w / 2, 0, 0);
    this.fill.scale.set(Math.max(0.0001, w * Math.max(0, Math.min(1, frac))), h, 1);
    this.fillMat.color.copy(color || this.color);
  }
}

// ------------------------------------------------------------------ prosedürel yedek insansılar
function humanoid(kit, { skin, cloth, accent, weapon = 'none', scale = 1, horns = false, hood = false }) {
  const { G, bin, shadows } = kit;
  const g = new THREE.Group();
  const M = (c, o = {}) => bin.add(new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o }));
  const mSkin = M(skin);
  const mCloth = M(cloth);
  const mAcc = M(accent, { metalness: 0.4, roughness: 0.4 });
  const mats = [mSkin, mCloth, mAcc];
  for (const s of [-1, 1]) {
    const leg = mesh(G.aLeg, mCloth, shadows);
    leg.position.set(s * 0.1, 0.24, 0);
    g.add(leg);
  }
  const torso = mesh(G.aTorso, mCloth, shadows);
  torso.position.y = 0.74;
  g.add(torso);
  const head = mesh(G.aHead, mSkin, shadows);
  head.position.y = 1.2;
  g.add(head);
  if (hood) {
    const hd = mesh(G.aHood, mCloth, false);
    hd.position.set(0, 1.22, -0.01);
    g.add(hd);
  }
  if (horns) {
    for (const s of [-1, 1]) {
      const h = mesh(G.dHorn, mAcc, false);
      h.position.set(s * 0.16, 1.36, 0);
      h.rotation.z = -s * 0.6;
      h.scale.setScalar(1.6);
      g.add(h);
    }
  }
  for (const s of [-1, 1]) {
    const arm = mesh(G.aArm, mSkin, false);
    arm.position.set(s * 0.28, 0.86, 0.06);
    arm.rotation.set(0.5, 0, s * 0.3);
    g.add(arm);
  }
  if (weapon === 'axe') {
    const shaft = mesh(G.rGrip, mAcc, false);
    shaft.scale.set(1.2, 5.5, 1.2);
    shaft.position.set(0.36, 0.95, 0.2);
    shaft.rotation.z = -0.5;
    g.add(shaft);
    for (const s of [-1, 1]) {
      const blade = mesh(G.shield, mAcc, false);
      blade.scale.set(0.45, 0.6, 0.25);
      blade.rotation.set(Math.PI / 2, 0, -0.5);
      blade.position.set(0.62 + s * 0.08, 1.45, 0.2);
      g.add(blade);
    }
  } else if (weapon === 'staff' || weapon === 'orb') {
    const shaft = mesh(G.rGrip, M('#6b4a2a'), false);
    shaft.scale.set(1, 6.5, 1);
    shaft.position.set(0.34, 0.85, 0.12);
    g.add(shaft);
    const gem = mesh(G.gem, M(weapon === 'orb' ? '#ff3b3b' : '#9fe8ff', { emissive: weapon === 'orb' ? '#ff2020' : '#6fd0ff', emissiveIntensity: 1.6 }), false);
    gem.scale.setScalar(2.2);
    gem.position.set(0.34, 1.55, 0.12);
    g.add(gem);
  } else if (weapon === 'daggers') {
    for (const s of [-1, 1]) {
      const d = mesh(G.rBlade, M('#cfc6ff', { emissive: '#8b6cff', emissiveIntensity: 0.9, metalness: 0.8 }), false);
      d.scale.set(1, 0.45, 1);
      d.rotation.x = Math.PI / 2;
      d.position.set(s * 0.32, 0.8, 0.35);
      g.add(d);
    }
  } else if (weapon === 'club') {
    const c = mesh(G.pedB, M('#5a4230'), false);
    c.scale.set(0.25, 1.5, 0.25);
    c.position.set(0.32, 0.9, 0.2);
    g.add(c);
    const sh = mesh(G.shield, mAcc, false);
    sh.scale.setScalar(0.7);
    sh.rotation.x = Math.PI / 2;
    sh.position.set(-0.3, 0.8, 0.22);
    g.add(sh);
  }
  g.scale.setScalar(scale);
  return { group: g, mats };
}

const PROC = {
  balta: (kit) => humanoid(kit, { skin: '#b8412f', cloth: '#4a2c1c', accent: '#b9b2a4', weapon: 'axe', scale: 1.15, horns: true }),
  buz: (kit) => humanoid(kit, { skin: '#f1dccb', cloth: '#3a78b8', accent: '#dff6ff', weapon: 'staff', scale: 1.05, hood: true }),
  golge: (kit) => humanoid(kit, { skin: '#c9b3a2', cloth: '#3a2a55', accent: '#b18cff', weapon: 'daggers', scale: 1.0, hood: true }),
  'creep-melee': (kit) => humanoid(kit, { skin: '#6f7f5a', cloth: '#4a3a3a', accent: '#8a7f70', weapon: 'club', scale: 0.72 }),
  'creep-ranged': (kit) => humanoid(kit, { skin: '#6f7f5a', cloth: '#8a1f2a', accent: '#402020', weapon: 'orb', scale: 0.72, hood: true }),
};

/** Kahraman: GLB (yoksa prosedürel). Model sonradan gelirse setModel ile değiştirilir. */
export class HeroRig {
  constructor(kit, heroId) {
    this.kit = kit;
    this.heroId = heroId;
    this.H = HEROES[heroId] || HEROES.okcu;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.spin = new THREE.Group();
    this.root.add(this.body);
    this.body.add(this.spin);
    this.mats = [];
    this.flash = [];
    this.phase = 0;
    this.deadK = 0;
    this._op = -1;
    this._lp = {};
    const glowMat = kit.bin.add(new THREE.SpriteMaterial({ map: kit.glowTex, color: new THREE.Color(this.H.color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    this.glow = new THREE.Sprite(glowMat);
    this.glow.scale.set(2.4, 2.4, 1);
    this.glow.position.y = 1.0;
    this.root.add(this.glow);
    this.setModel(kit.models[this.H.model] || null);
  }

  setModel(template) {
    for (const c of [...this.spin.children]) this.spin.remove(c);
    this.mats = [];
    this.flash = [];
    this.archer = null;
    this._op = -1;
    if (template) {
      const c = cloneModel(template, this.kit);
      c.obj.rotation.y = MODEL_YAW[this.H.model] || 0;
      this.spin.add(c.obj);
      this.mats = c.mats;
      this.flash = c.flash;
      this.procedural = false;
    } else if (this.heroId === 'okcu') {
      const kitNo = { ...this.kit, archerModel: null };
      this.archer = new ArcherRig(kitNo);
      this.spin.add(this.archer.root);
      this.flash = this.archer.flashables;
      this.archer.root.traverse((o) => { if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) { if (!this.mats.includes(m)) { m.transparent = true; this.mats.push(m); } } });
      this.procedural = true;
    } else {
      const b = (PROC[this.heroId] || PROC.golge)(this.kit);
      this.spin.add(b.group);
      this.mats = b.mats;
      for (const m of b.mats) m.transparent = true;
      this.flash = b.mats;
      this.procedural = true;
    }
  }

  setOpacity(a) {
    if (Math.abs(this._op - a) < 0.01) return;
    this._op = a;
    for (const m of this.mats) m.opacity = a;
  }

  update(p, t, dt, g, shown = true) {
    const r = this.root;
    r.visible = shown;
    if (!shown) return;
    r.position.set(p.x, 0, p.z);
    r.rotation.y = p.face;
    const moving = Math.min(1.6, p.moving || 0);
    this.phase += dt * (3 + moving * 10);
    const ph = this.phase;
    this.deadK += ((p.dead ? 1 : 0) - this.deadK) * Math.min(1, dt * 5);
    const swing = p.swing || 0;
    const melee = this.H.attack && this.H.attack.type === 'melee';
    let by = Math.abs(Math.sin(ph)) * 0.07 * moving - this.deadK * 0.25;
    let bz = -p.recoil * 0.1 + (melee ? swing * swing * 0.28 : swing * 0.06);
    let rx = moving * 0.1 + (p.charging ? -0.08 : 0) + (melee ? swing * 0.32 : swing * 0.12);
    let rz = this.deadK * 1.45;
    if (p.channel) { by += 0.22 + Math.sin(t * 3) * 0.05; rx = -0.1; }
    if (p.st && p.st.stun > 0) rz += Math.sin(t * 18) * 0.08;
    this.body.position.set(0, by, bz);
    this.body.rotation.set(rx, 0, rz);
    // Helezon: iki tam tur
    this.spin.rotation.y = p.spinT > 0 ? (1 - p.spinT / 0.42) * Math.PI * 4 : 0;
    if (this.archer) {
      const lp = this._lp;
      lp.x = 0; lp.z = 0; lp.face = 0; lp.moving = 0; lp.dead = false; lp.recoil = p.recoil; lp.charging = p.charging; lp.charge = p.charge;
      lp.hurtT = 0; lp.invuln = 0; lp.rapier = 0;
      this.archer.update(lp, t, dt, 'shown');
    }
    // görünmezlik
    this.setOpacity(p.invis > 0 ? 0.28 + 0.08 * Math.sin(t * 6) : 1);
    // parlama: hasar / dokunulmazlık / çift hasar / BKB
    let er = 0;
    let eg = 0;
    let eb = 0;
    if (p.hurtT > 0) { er = p.hurtT * 2.2; eb = p.hurtT * 0.3; }
    else if (p.invuln > 0 && Math.sin(t * 20) > 0) { er = 0.6; eg = 0.45; eb = 0.1; }
    else if (p.bkb > 0) { er = 0.35; eg = 0.28; eb = 0.05; }
    else if (p.dd > 0) { er = 0.05; eg = 0.12; eb = 0.35; }
    else if (p.rapier > 0) { er = 0.18; eg = 0.13; eb = 0.02; }
    for (const m of this.flash) if (m.emissive) m.emissive.setRGB(er, eg, eb);
    // aura parıltısı (kanal, BKB, çift hasar)
    let ga = 0;
    if (p.channel) ga = 0.55 + 0.2 * Math.sin(t * 8);
    else if (p.bkb > 0) ga = 0.45;
    else if (p.dd > 0 || p.haste > 0) ga = 0.3;
    this.glow.material.opacity = ga;
    if (p.bkb > 0) this.glow.material.color.set('#e9b949');
    else if (p.dd > 0) this.glow.material.color.set('#4d8dff');
    else if (p.haste > 0) this.glow.material.color.set('#ff4d4d');
    else this.glow.material.color.set(this.H.color);
  }
}

/** Creep ve Roshan: GLB (yoksa prosedürel). */
export class UnitRig {
  constructor(kit, key, procKey) {
    this.kit = kit;
    this.key = key;
    this.procKey = procKey;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.mats = [];
    this.flash = [];
    this.phase = Math.random() * 10;
    this._op = -1;
    this.setModel(kit.models[key] || null);
    this.bar = new HpBar(kit, { w: key === 'model-roshan' ? 2.2 : 0.95, h: key === 'model-roshan' ? 0.16 : 0.1, color: '#e0354b' });
    this.barGroup = this.bar.group;
    // buz kütlesi (Buz Zinciri)
    this.ice = new THREE.Mesh(kit.G.iceBlock, kit.iceMat);
    this.ice.visible = false;
    this.root.add(this.ice);
  }

  setModel(template) {
    for (const c of [...this.body.children]) this.body.remove(c);
    this._op = -1;
    if (template) {
      const c = cloneModel(template, this.kit);
      c.obj.rotation.y = MODEL_YAW[this.key] || 0;
      this.body.add(c.obj);
      this.mats = c.mats;
      this.flash = c.flash;
      this.procedural = false;
    } else if (this.key === 'model-roshan') {
      const { G, bin } = this.kit;
      const stone = bin.add(new THREE.MeshStandardMaterial({ color: '#6c6377', roughness: 0.9, flatShading: true, transparent: true }));
      const horn = bin.add(new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.5, transparent: true }));
      const eye = bin.add(new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff7a1a', emissiveIntensity: 2, transparent: true }));
      const b = new THREE.Mesh(G.rosBody, stone);
      b.position.y = 1.3;
      b.scale.set(1.2, 1, 1.4);
      const hd = new THREE.Mesh(G.rosBody, stone);
      hd.scale.setScalar(0.55);
      hd.position.set(0, 1.9, 1.05);
      this.body.add(b, hd);
      for (const s of [-1, 1]) {
        const h = new THREE.Mesh(G.dHorn, horn);
        h.scale.set(3.2, 4.5, 3.2);
        h.position.set(s * 0.45, 2.45, 1.05);
        h.rotation.z = -s * 0.5;
        const e = new THREE.Mesh(G.dEye, eye);
        e.scale.setScalar(2.4);
        e.position.set(s * 0.22, 1.98, 1.55);
        const leg = new THREE.Mesh(G.dLeg, stone);
        leg.scale.set(4, 3.2, 4);
        leg.position.set(s * 0.7, 0.45, 0.5);
        const leg2 = leg.clone();
        leg2.position.z = -0.6;
        this.body.add(h, e, leg, leg2);
      }
      this.mats = [stone, horn, eye];
      this.flash = [stone];
      this.procedural = true;
    } else {
      const b = (PROC[this.procKey] || PROC['creep-melee'])(this.kit);
      this.body.add(b.group);
      this.mats = b.mats;
      for (const m of b.mats) m.transparent = true;
      this.flash = b.mats;
      this.procedural = true;
    }
  }

  setOpacity(a) {
    if (Math.abs(this._op - a) < 0.01) return;
    this._op = a;
    for (const m of this.mats) m.opacity = a;
  }

  update(e, t, dt, labelK, execThr = 0) {
    const boss = e.kind === 'boss';
    this.root.position.set(e.x, 0, e.z);
    this.root.rotation.y = e.face;
    const moving = Math.min(1.4, (e.speedNow || 0) / 3);
    const frozen = e.st.root > 0 || e.st.stun > 0;
    if (!frozen) this.phase += dt * (4 + moving * 8);
    let s = 1;
    let by = 0;
    let rx = 0;
    let rz = 0;
    let bz = 0;
    if (e.spawnT > 0) {
      const k = 1 - e.spawnT / (boss ? 1.6 : 0.7);
      if (boss) by = -3 + 3 * (1 - Math.pow(1 - Math.max(0, k), 3));
      else s = Math.max(0.01, k);
    }
    if (e.dead) {
      const k = Math.min(1, e.deathT * 2.5);
      rz = k * 1.4 * (e.id % 2 ? 1 : -1);
      by = -Math.max(0, e.deathT - (boss ? 1.2 : 0.5)) * 1.2;
      this.setOpacity(Math.max(0, 1 - Math.max(0, e.deathT - (boss ? 1.6 : 0.5)) * 2));
    } else {
      this.setOpacity(1);
      by += Math.abs(Math.sin(this.phase)) * (boss ? 0.08 : 0.05) * moving;
      rz = Math.sin(this.phase) * 0.06 * moving;
      if (e.windup > 0) rx = -0.25;
      if (e.lunge > 0) { rx = 0.28; bz = boss ? 0.5 : 0.2; }
      if (e.cast) {
        const k = 1 - e.cast.t / e.cast.dur;
        if (e.cast.kind === 'slam') { by += Math.sin(k * Math.PI * 0.9) * 0.8; rx = -0.35 * k; }
        else { rx = -0.3; s = 1 + 0.08 * Math.sin(t * 30) * k; }
      }
      if (e.st.stun > 0) rz = Math.sin(t * 18) * 0.08;
      if (e.status === 'sleep') { by -= 0.08; rx = 0.12; }
    }
    this.body.position.set(0, by, bz);
    this.body.rotation.set(rx, 0, rz);
    this.body.scale.setScalar(s);
    const fl = e.hitFlash > 0 ? e.hitFlash / 0.16 : 0;
    const tele = e.windup > 0 ? 0.3 : 0;
    for (const m of this.flash) {
      if (!m.emissive) continue;
      if (fl > 0) m.emissive.setRGB(fl, fl, fl);
      else if (tele > 0) m.emissive.setRGB(tele, 0.03, 0.05);
      else if (e.st.slow > 0 && e.st.slowK >= 0.3) m.emissive.setRGB(0.05, 0.12, 0.25);
      else m.emissive.setRGB(0, 0, 0);
    }
    this.ice.visible = e.st.root > 0 && !e.dead;
    if (this.ice.visible) {
      this.ice.position.y = boss ? 1.4 : 0.55;
      this.ice.scale.setScalar(boss ? 2.4 : 1);
      this.ice.rotation.y = e.id;
    }
    // can çubuğu
    const bg = this.barGroup;
    const h = boss ? 3.3 : 1.25;
    bg.position.set(e.x, h + by, e.z);
    bg.visible = !e.dead && (boss || e.hp < e.maxHp || e.st.root > 0) && e.spawnT <= 0;
    const exec = execThr > 0 && e.hp <= execThr;
    this.bar.set(e.hp / e.maxHp, labelK, exec ? this.kit.execColor : null);
  }
}

/** Kule: GLB (yoksa prosedürel), kristal parıltısı, can çubuğu, menzil halkası (Dire). */
export class TowerRig {
  constructor(kit, tower) {
    this.kit = kit;
    this.side = tower.side;
    this.key = tower.side === 'radiant' ? 'model-tower-radiant' : 'model-tower-dire';
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.root.position.set(tower.x, 0, tower.z);
    this.col = new THREE.Color(tower.side === 'radiant' ? '#43d6a0' : '#ff3b4b');
    this.mats = [];
    this.flash = [];
    this.setModel(kit.models[this.key] || null);
    const glowMat = kit.bin.add(new THREE.SpriteMaterial({ map: kit.glowTex, color: this.col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
    this.glow = new THREE.Sprite(glowMat);
    this.glow.position.y = 3.25;
    this.glow.scale.set(1.8, 1.8, 1);
    this.root.add(this.glow);
    const baseMat = kit.bin.add(new THREE.MeshBasicMaterial({ map: kit.ringTex, color: this.col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 }));
    this.base = new THREE.Mesh(kit.G.plane, baseMat);
    this.base.rotation.x = -Math.PI / 2;
    this.base.position.y = 0.04;
    this.base.scale.setScalar(2.2);
    this.root.add(this.base);
    this.bar = new HpBar(kit, { w: 1.5, h: 0.16, color: tower.side === 'radiant' ? '#43d6a0' : '#e0354b' });
    this.barGroup = this.bar.group;
    this.barGroup.position.set(tower.x, 4.1, tower.z);
    if (tower.side === 'dire') {
      const rm = kit.bin.add(new THREE.MeshBasicMaterial({ map: kit.dashRingTex, color: this.col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
      this.range = new THREE.Mesh(kit.G.plane, rm);
      this.range.rotation.x = -Math.PI / 2;
      this.range.position.set(tower.x, 0.07, tower.z);
      this.range.scale.setScalar(tower.def.range * 2);
      this.range.renderOrder = 3;
    }
  }

  setModel(template) {
    for (const c of [...this.body.children]) this.body.remove(c);
    if (template) {
      const c = cloneModel(template, this.kit, { transparent: false });
      c.obj.rotation.y = (MODEL_YAW[this.key] || 0) + (this.side === 'radiant' ? Math.PI * 0.75 : -Math.PI * 0.25);
      this.body.add(c.obj);
      this.mats = c.mats;
      this.flash = c.flash;
      this.procedural = false;
      return;
    }
    const { G, bin, shadows } = this.kit;
    const radiant = this.side === 'radiant';
    const stone = bin.add(new THREE.MeshStandardMaterial({ color: radiant ? '#d8d2c2' : '#2c2430', roughness: 0.8, flatShading: !radiant }));
    const roof = bin.add(new THREE.MeshStandardMaterial({ color: radiant ? '#2f8a5a' : '#5a1a24', roughness: 0.6 }));
    const crystal = bin.add(new THREE.MeshStandardMaterial({ color: radiant ? '#8ff0c9' : '#ff5a5a', emissive: radiant ? '#43d6a0' : '#e0354b', emissiveIntensity: 1.6 }));
    const base = mesh(G.pedA, stone, shadows);
    base.scale.set(1.1, 1.2, 1.1);
    base.position.y = 0.18;
    const col = mesh(G.towerShaft, stone, shadows);
    col.position.y = 1.5;
    const cap = mesh(G.towerRoof, roof, shadows);
    cap.position.y = 2.75;
    const cr = mesh(G.gem, crystal, false);
    cr.scale.setScalar(3.2);
    cr.position.y = 3.3;
    this.body.add(base, col, cap, cr);
    this.crystal = cr;
    if (!radiant) {
      for (let i = 0; i < 4; i++) {
        const sp = mesh(G.dHorn, stone, false);
        const a = (i / 4) * Math.PI * 2;
        sp.scale.set(3, 6, 3);
        sp.position.set(Math.sin(a) * 0.55, 2.3, Math.cos(a) * 0.55);
        sp.rotation.set(Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6);
        this.body.add(sp);
      }
    }
    this.mats = [stone, roof, crystal];
    this.flash = [stone];
    this.procedural = true;
  }

  update(tw, t, dt, g, labelK) {
    if (tw.dead) {
      const k = Math.min(1, tw.deadT / 1.4);
      this.body.position.y = -k * 2.2;
      this.body.rotation.set(k * 0.3, 0, k * 0.4);
      this.glow.visible = false;
      this.base.material.opacity = 0.12;
      this.barGroup.visible = false;
      if (this.range) this.range.visible = false;
      return;
    }
    this.body.position.y = 0;
    this.body.rotation.set(0, 0, 0);
    this.glow.visible = true;
    this.glow.material.opacity = 0.45 + 0.15 * Math.sin(t * 2.5 + tw.x) + (tw.shotT > 0 ? tw.shotT * 2.4 : 0);
    const gs = 1.8 + (tw.shotT > 0 ? tw.shotT * 3 : 0);
    this.glow.scale.set(gs, gs, 1);
    this.glow.position.y = 3.25 + Math.sin(t * 1.7 + tw.z) * 0.08;
    if (this.crystal) { this.crystal.rotation.y = t; this.crystal.position.y = 3.3 + Math.sin(t * 1.7) * 0.08; }
    this.base.material.opacity = 0.3;
    const fl = tw.hitFlash > 0 ? tw.hitFlash / 0.14 : 0;
    for (const m of this.flash) if (m.emissive) m.emissive.setRGB(fl * 0.6, fl * 0.5, fl * 0.5);
    this.barGroup.visible = g.state !== 'idle';
    this.bar.set(tw.hp / tw.maxHp, labelK);
    if (this.range) {
      const p = g.player;
      const d = Math.hypot(p.x - tw.x, p.z - tw.z);
      const want = g.state !== 'idle' && !p.dead && d < tw.def.range + 2.5 ? (d < tw.def.range + 0.3 ? 0.7 : 0.35) : 0;
      this.range.material.opacity += (want - this.range.material.opacity) * Math.min(1, dt * 6);
      this.range.visible = this.range.material.opacity > 0.02;
      this.range.rotation.z = t * 0.3;
    }
  }
}

/** Uçan kurye. */
export class CourierRig {
  constructor(kit) {
    this.kit = kit;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.root.visible = false;
    this.setModel(kit.models['model-courier'] || null);
    const glowMat = kit.bin.add(new THREE.SpriteMaterial({ map: kit.glowTex, color: new THREE.Color('#f6d98a'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 }));
    this.glow = new THREE.Sprite(glowMat);
    this.glow.scale.set(1.6, 1.6, 1);
    this.glow.position.y = 0.4;
    this.root.add(this.glow);
  }

  setModel(template) {
    for (const c of [...this.body.children]) this.body.remove(c);
    this.wings = [];
    if (template) {
      const c = cloneModel(template, this.kit, { transparent: false });
      c.obj.rotation.y = MODEL_YAW['model-courier'] || 0;
      this.body.add(c.obj);
      this.procedural = false;
      return;
    }
    const { G, bin } = this.kit;
    const fur = bin.add(new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.85 }));
    const bag = bin.add(new THREE.MeshStandardMaterial({ color: '#b5462f', roughness: 0.9 }));
    const wingM = bin.add(new THREE.MeshStandardMaterial({ color: '#f3eadb', roughness: 0.6, side: THREE.DoubleSide }));
    const torso = mesh(G.dTorso, fur, false);
    torso.rotation.x = Math.PI / 2;
    torso.scale.setScalar(1.3);
    torso.position.y = 0.45;
    const head = mesh(G.dHead, fur, false);
    head.position.set(0, 0.7, 0.42);
    head.scale.set(0.9, 1, 1.3);
    this.body.add(torso, head);
    for (const s of [-1, 1]) {
      const b = mesh(G.dBag, bag, false);
      b.position.set(s * 0.26, 0.4, -0.05);
      b.scale.setScalar(1.3);
      const w = new THREE.Group();
      const wm = mesh(G.wing, wingM, false);
      wm.scale.set(s * 0.7, 0.7, 1);
      wm.rotation.x = -Math.PI / 2;
      w.add(wm);
      w.position.set(s * 0.12, 0.62, 0);
      this.body.add(b, w);
      this.wings.push({ w, s });
    }
    this.procedural = true;
  }

  update(c, t) {
    this.root.visible = c.state !== 'home';
    if (!this.root.visible) return;
    this.root.position.set(c.x, c.y + Math.sin(t * 5) * 0.12, c.z);
    this.root.rotation.y = c.face;
    this.body.rotation.x = 0.12;
    for (const { w, s } of this.wings) w.rotation.z = s * Math.sin(t * 16) * 0.6;
  }
}

/** Rün: dönen kristal + halka + parıltı. */
export function buildRune(kit, color) {
  const { G, bin } = kit;
  const col = new THREE.Color(color);
  const root = new THREE.Group();
  const core = new THREE.Mesh(G.runeCore, bin.add(new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.3, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.95 })));
  core.position.y = 0.95;
  const ring = new THREE.Mesh(G.runeRing, bin.add(new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8 })));
  ring.position.y = 0.95;
  const glowMat = bin.add(new THREE.SpriteMaterial({ map: kit.glowTex, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
  const glow = new THREE.Sprite(glowMat);
  glow.position.y = 0.95;
  glow.scale.set(2.2, 2.2, 1);
  const padMat = bin.add(new THREE.MeshBasicMaterial({ map: kit.ringTex, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
  const pad = new THREE.Mesh(G.plane, padMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.06;
  pad.scale.setScalar(1.6);
  root.add(core, ring, glow, pad);
  return { root, core, ring, glow, set(c) { core.material.color.set(c); core.material.emissive.set(c); ring.material.color.set(c); glowMat.color.set(c); padMat.color.set(c); } };
}

/** Peynir dilimi (Roshan'dan düşer). */
export function buildCheese(kit) {
  const { G, bin, glowTex } = kit;
  const root = new THREE.Group();
  const m = bin.add(new THREE.MeshStandardMaterial({ color: '#ffd84a', roughness: 0.55, emissive: '#6a5000', emissiveIntensity: 0.4 }));
  const w = new THREE.Mesh(G.cheese, m);
  w.position.y = 0.75;
  w.rotation.x = Math.PI / 2;
  const glowMat = bin.add(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color('#ffe27a'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
  const glow = new THREE.Sprite(glowMat);
  glow.position.y = 0.75;
  glow.scale.set(1.6, 1.6, 1);
  root.add(w, glow);
  return { root, wedge: w, glow };
}

/** Mermi (kule küresi, creep küresi, buz saldırısı). */
export function buildProj(kit, kind) {
  const { G, bin, glowTex } = kit;
  const colors = { 'tower-r': '#8ff0c9', 'tower-d': '#ff5a5a', orb: '#ff6a3d', ice: '#bff0ff' };
  const col = new THREE.Color(colors[kind] || '#ffffff');
  const root = new THREE.Group();
  const core = new THREE.Mesh(G.gem, bin.add(new THREE.MeshBasicMaterial({ color: col })));
  const big = kind === 'tower-r' || kind === 'tower-d';
  core.scale.setScalar(big ? 2.2 : kind === 'ice' ? 1.4 : 1.3);
  if (kind === 'ice') core.scale.set(1, 1, 3);
  const glowMat = bin.add(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(big ? 1.5 : 0.9);
  root.add(core, glow);
  return { root, core, kind };
}
