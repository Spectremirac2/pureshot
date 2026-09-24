// 1vDOQUZ Arena — sahnedeki karakterler ve nesneler.
// fal.ai modelleri (model-dog / model-archer / model-aegis) varsa onları kullanır,
// yoksa primitiflerden prosedürel, sevimli yedekler kurar.

import * as THREE from 'three';
import { DOG_TYPES } from './dogs.js';
import { makeCanvas, toTexture, hexA, tok } from './textures.js';

// GLB modellerinin "ileri" yönü bilinmiyor; gerekirse buradan düzeltilir.
export const DOG_MODEL_YAW = 0;
export const ARCHER_MODEL_YAW = 0;

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
    g.font = '800 22px Unbounded, "Arial Black", sans-serif';
    const tw = Math.min(236, g.measureText(label).width + 30);
    const x0 = 128 - tw / 2;
    g.fillStyle = 'rgba(10,8,16,0.78)';
    roundRect(g, x0, 50, tw, 32, 6);
    g.fill();
    if (elite) {
      g.strokeStyle = '#e9b949';
      g.lineWidth = 3;
      g.stroke();
    }
    g.fillStyle = color;
    g.fillRect(x0 + 5, 56, 5, 20);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff4e6';
    g.fillText(label, 128 + 4, 67, 222);
    // can çubuğu
    const bx = 28;
    const bw = 200;
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
      eye: own(new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ff6a2b', emissiveIntensity: 2.2, roughness: 0.3 })),
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

  update(d, t, dt, reduced) {
    const r = this.root;
    r.position.set(d.x, 0, d.z);
    r.rotation.y = d.face;
    let s = d.scale;
    if (d.spawnT > 0) {
      const k = 1 - d.spawnT / 0.55;
      s *= Math.max(0.01, 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2));
    }
    this.body.scale.setScalar(s);
    const moving = Math.min(1.4, (d.speedNow || 0) / 3);
    const frozen = d.status === 'pause' || d.status === 'stun';
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
    let lop = 1;
    if (d.dead) lop = Math.max(0, 1 - d.deathT * 3);
    else if (d.type === 'ward') lop = d.vis < 0.45 ? 0.15 : d.vis;
    if (d.spawnT > 0) lop = 1 - d.spawnT / 0.55;
    this.label.mat.opacity = lop;
    lg.visible = lop > 0.02;
    if (!d.demo || true) {
      const T = DOG_TYPES[d.type];
      this.label.draw({
        name: T.short,
        color: this.color,
        hp: d.hp,
        maxHp: d.maxHp,
        status: d.dead ? null : d.status,
        elite: d.elite,
        tag: d.type === 'farm' && d.state === 'carry' ? '6 SLOT' : d.elite ? 'ELİT' : '',
      });
    }
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
      this.nock.visible = p.charging || p.recoil > 0.6;
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

export function labelColor(hex) { return hexA(hex, 1); }
