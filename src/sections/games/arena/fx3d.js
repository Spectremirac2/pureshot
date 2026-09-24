// 1vDOQUZ Arena — 3D efektler: havuzlu parçacık sistemi, şok dalgaları, ortam korları.

import * as THREE from 'three';

const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec4 aColor;
  uniform float uScale;
  varying vec4 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  varying vec4 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor.rgb * (0.6 + a * 0.8), vColor.a * a);
  }
`;

/** Sabit boyutlu parçacık havuzu; tek draw call. */
export class Particles {
  constructor(max = 700, { additive = true } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.p = [];
    for (let i = 0; i < max; i++) this.p.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, s0: 0, s1: 0, r: 1, gg: 1, b: 1, a: 1 });
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aColor', this.colAttr);
    geo.setAttribute('aSize', this.sizeAttr);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uScale: { value: 400 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.geo = geo;
    this.alive = 0;
  }

  setScale(px) { this.mat.uniforms.uScale.value = px; }

  spawn(o) {
    const q = this.p[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    q.life = q.max = o.life ?? 0.8;
    q.x = o.x; q.y = o.y ?? 0.3; q.z = o.z;
    q.vx = o.vx ?? 0; q.vy = o.vy ?? 0; q.vz = o.vz ?? 0;
    q.g = o.g ?? 0;
    q.drag = o.drag ?? 0;
    q.s0 = o.size ?? 0.3;
    q.s1 = o.size1 ?? q.s0 * 0.2;
    const c = o.color;
    q.r = c.r; q.gg = c.g; q.b = c.b;
    q.a = o.alpha ?? 1;
    q.floor = o.floor ?? true;
  }

  burst(n, o) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 3) * (0.35 + Math.random() * 0.65);
      const up = o.up ?? 2;
      this.spawn({
        ...o,
        x: o.x + (Math.random() - 0.5) * (o.spread ?? 0.2),
        z: o.z + (Math.random() - 0.5) * (o.spread ?? 0.2),
        y: (o.y ?? 0.4) + Math.random() * (o.ySpread ?? 0.2),
        vx: Math.cos(a) * sp + (o.dirX ?? 0),
        vz: Math.sin(a) * sp + (o.dirZ ?? 0),
        vy: up * (0.4 + Math.random() * 0.8),
        life: (o.life ?? 0.7) * (0.6 + Math.random() * 0.6),
        color: Array.isArray(o.color) ? o.color[i % o.color.length] : o.color,
      });
    }
  }

  update(dt) {
    let alive = 0;
    const P = this.p;
    for (let i = 0; i < this.max; i++) {
      const q = P[i];
      const i3 = i * 3;
      const i4 = i * 4;
      if (q.life <= 0) {
        this.size[i] = 0;
        this.col[i4 + 3] = 0;
        continue;
      }
      alive++;
      q.life -= dt;
      const t = Math.max(0, q.life / q.max);
      q.vy -= q.g * dt;
      if (q.drag) {
        const k = Math.max(0, 1 - q.drag * dt);
        q.vx *= k; q.vy *= k; q.vz *= k;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      if (q.floor && q.y < 0.03) { q.y = 0.03; q.vy *= -0.3; q.vx *= 0.7; q.vz *= 0.7; }
      this.pos[i3] = q.x;
      this.pos[i3 + 1] = q.y;
      this.pos[i3 + 2] = q.z;
      this.size[i] = q.s1 + (q.s0 - q.s1) * t;
      this.col[i4] = q.r;
      this.col[i4 + 1] = q.gg;
      this.col[i4 + 2] = q.b;
      this.col[i4 + 3] = q.a * Math.min(1, t * 2.2);
    }
    this.alive = alive;
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }

  clear() {
    for (const q of this.p) q.life = 0;
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/** Yerde genişleyen halka (şok dalgası, doğma kapısı, Tango nabzı). */
export class Rings {
  constructor(scene, tex, n = 8) {
    this.geo = new THREE.PlaneGeometry(1, 1);
    this.items = [];
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
      const m = new THREE.Mesh(this.geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.renderOrder = 3;
      scene.add(m);
      this.items.push({ m, t: 0, dur: 1, r0: 0.5, r1: 4, a: 1 });
    }
    this.i = 0;
  }

  fire(x, z, { color, r0 = 0.4, r1 = 6, dur = 0.6, alpha = 1, y = 0.06 }) {
    const it = this.items[this.i];
    this.i = (this.i + 1) % this.items.length;
    it.t = 0;
    it.dur = dur;
    it.r0 = r0;
    it.r1 = r1;
    it.a = alpha;
    it.m.material.color.copy(color);
    it.m.position.set(x, y, z);
    it.m.visible = true;
  }

  update(dt) {
    for (const it of this.items) {
      if (!it.m.visible) continue;
      it.t += dt;
      const k = Math.min(1, it.t / it.dur);
      const e = 1 - Math.pow(1 - k, 3);
      const s = (it.r0 + (it.r1 - it.r0) * e) * 2;
      it.m.scale.set(s, s, s);
      it.m.material.opacity = it.a * (1 - k);
      if (k >= 1) it.m.visible = false;
    }
  }

  clear() { for (const it of this.items) it.m.visible = false; }

  dispose() {
    this.geo.dispose();
    for (const it of this.items) it.m.material.dispose();
  }
}

/** Arena üzerinde süzülen ortam korları (sürekli, yeniden kullanılan). */
export function ambientEmbers(parts, radius, dt, state) {
  state.acc = (state.acc || 0) + dt * state.rate;
  while (state.acc > 1) {
    state.acc -= 1;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    parts.spawn({
      x: Math.sin(a) * r,
      z: Math.cos(a) * r,
      y: 0.05 + Math.random() * 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vz: (Math.random() - 0.5) * 0.3 - 0.1,
      vy: 0.4 + Math.random() * 0.7,
      g: -0.05,
      life: 3 + Math.random() * 3,
      size: 0.09 + Math.random() * 0.08,
      size1: 0.02,
      color: Math.random() < 0.7 ? state.c1 : state.c2,
      alpha: 0.9,
      floor: false,
    });
  }
}
