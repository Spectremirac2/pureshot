// Başlıktaki 3D "sikke halkası": 127 kahraman sikkesi, kat kat dönen halkalar.
// En yüksek DOG'luklular en üst halkada ve daha büyük. Tek doku atlası + 2 InstancedMesh (gövde + yüz).
// Sürükle: döndür/eğ · Sikkeye tıkla: kahraman dosyası (raycaster). Görünmezken durur;
// prefersReducedMotion'da kendiliğinden dönmez. WebGL yoksa 2D yedek armalar.

import * as THREE from 'three';
import { h, clamp, prefersReducedMotion } from '../../core/dom.js';
import { ATTRS, tierOf } from '../../data/heroes.js';
import { drawCrestCanvas, fontsReady, crestSvg, mixHex } from './crest.js';

const COLS = 16;
const CELL = 128;
const TILT = 0.2; // sikke yüzleri hafif yukarı bakar

// Halka düzeni (üstten alta): yarıçap, yükseklik, sikke ölçeği
const RINGS = [
  { r: 3.0, y: 2.55, s: 0.62, speed: 0.16 },
  { r: 4.6, y: 1.05, s: 0.5, speed: -0.11 },
  { r: 6.05, y: -0.4, s: 0.5, speed: 0.085 },
  { r: 7.5, y: -1.85, s: 0.5, speed: -0.065 },
];
const GAP = 1.1; // sikke çapına göre aralık çarpanı

function layout(n) {
  // Sırayla doldur; son halka kalanı alır.
  const slots = [];
  let left = n;
  RINGS.forEach((ring, k) => {
    const cap = Math.floor((Math.PI * 2 * ring.r) / (ring.s * 2 * GAP));
    const count = k === RINGS.length - 1 ? left : Math.min(cap, left);
    for (let i = 0; i < count; i++) slots.push({ ring: k, i, count });
    left -= count;
  });
  return slots;
}

export function mountRing(host, { heroes, getValue, onPick }) {
  const reduced = prefersReducedMotion();
  const sorted = heroes.slice().sort((a, b) => b.dogRate - a.dogRate || a.name.localeCompare(b.name));
  let alive = true;
  const cleanups = [];

  const tip = h('div', { class: 'hr-ring-tip', hidden: true, 'aria-hidden': 'true' });
  host.appendChild(tip);

  // ---------------------------------------------------------------- WebGL
  let renderer;
  try {
    const test = document.createElement('canvas');
    const ok = !!(test.getContext('webgl2') || test.getContext('webgl'));
    if (!ok) throw new Error('webgl yok');
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return fallback();
  }

  const isMobile = matchMedia('(max-width: 720px)').matches || matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = 'hr-ring-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const fogColor = new THREE.Color('#0d0b14');
  scene.fog = new THREE.Fog(fogColor, 10, 30);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  const LOOK = new THREE.Vector3(0, -0.15, 0);

  scene.add(new THREE.HemisphereLight(0xffe7c0, 0x1a1026, 1.4));
  const key = new THREE.DirectionalLight(0xffd9a0, 2.4);
  key.position.set(5, 9, 10);
  scene.add(key);
  const ember = new THREE.PointLight(0xff6a2b, 30, 22, 2);
  ember.position.set(0, -3.2, 5);
  scene.add(ember);
  const crown = new THREE.PointLight(0xe9b949, 18, 12, 2);
  crown.position.set(0, 5.4, 2.5);
  scene.add(crown);

  const tower = new THREE.Group();
  scene.add(tower);

  // Doku atlası
  const rows = Math.ceil(sorted.length / COLS);
  const atlas = document.createElement('canvas');
  atlas.width = COLS * CELL;
  atlas.height = rows * CELL;
  const texture = new THREE.CanvasTexture(atlas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const paintAtlas = () => {
    const g = atlas.getContext('2d');
    g.clearRect(0, 0, atlas.width, atlas.height);
    g.fillStyle = '#0d0b14';
    g.fillRect(0, 0, atlas.width, atlas.height);
    sorted.forEach((hero, i) => {
      drawCrestCanvas(g, (i % COLS) * CELL, Math.floor(i / COLS) * CELL, CELL, hero, hero.dogRate);
    });
    texture.needsUpdate = true;
  };
  paintAtlas();
  fontsReady().then(() => { if (alive) { paintAtlas(); dirty = true; } });

  // Geometri + malzemeler
  const bodyGeo = new THREE.CylinderGeometry(1, 1, 0.16, 44, 1);
  bodyGeo.rotateX(Math.PI / 2);
  const faceGeo = new THREE.CircleGeometry(0.93, 44);
  faceGeo.translate(0, 0, 0.082);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.55, roughness: 0.32, emissive: 0x160c04 });
  const faceMat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uCell: { value: new THREE.Vector2(1 / COLS, 1 / rows) },
      uHover: { value: -1 },
      uFog: { value: fogColor },
      uNear: { value: 10 },
      uFar: { value: 30 },
    },
    vertexShader: /* glsl */ `
      attribute vec2 aCell;
      attribute float aIdx;
      uniform vec2 uCell;
      uniform float uHover;
      varying vec2 vUv;
      varying float vHover;
      varying float vDepth;
      void main() {
        vUv = aCell + (uv * 0.96 + 0.02) * uCell;
        vHover = abs(aIdx - uHover) < 0.5 ? 1.0 : 0.0;
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uFog;
      uniform float uNear;
      uniform float uFar;
      varying vec2 vUv;
      varying float vHover;
      varying float vDepth;
      void main() {
        vec4 c = texture2D(uMap, vUv);
        c.rgb *= 1.0 + vHover * 0.35;
        float f = smoothstep(uNear, uFar, vDepth);
        c.rgb = mix(c.rgb, uFog, f * 0.88);
        gl_FragColor = vec4(c.rgb, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

  const N = sorted.length;
  const body = new THREE.InstancedMesh(bodyGeo, bodyMat, N);
  const face = new THREE.InstancedMesh(faceGeo, faceMat, N);
  body.frustumCulled = false;
  face.frustumCulled = false;
  const aCell = new Float32Array(N * 2);
  const aIdx = new Float32Array(N);
  const gold = '#e9b949';
  const col = new THREE.Color();
  sorted.forEach((hero, i) => {
    aCell[i * 2] = (i % COLS) / COLS;
    aCell[i * 2 + 1] = 1 - (Math.floor(i / COLS) + 1) / rows;
    aIdx[i] = i;
    col.set(mixHex(gold, ATTRS[hero.attr].color, 0.3));
    body.setColorAt(i, col);
  });
  faceGeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 2));
  faceGeo.setAttribute('aIdx', new THREE.InstancedBufferAttribute(aIdx, 1));
  tower.add(body, face);

  const slots = layout(N);
  const phase = RINGS.map((_, k) => k * 0.37);
  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YXZ';
  let hover = -1;
  let hoverScale = 0;

  function placeCoins() {
    for (let i = 0; i < N; i++) {
      const sl = slots[i];
      const ring = RINGS[sl.ring];
      const th = phase[sl.ring] + (sl.i / sl.count) * Math.PI * 2;
      const s = ring.s * (i === hover ? 1 + hoverScale * 0.16 : 1);
      dummy.position.set(Math.sin(th) * ring.r, ring.y, Math.cos(th) * ring.r);
      dummy.rotation.set(-TILT, th, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
      face.setMatrixAt(i, dummy.matrix);
    }
    body.instanceMatrix.needsUpdate = true;
    face.instanceMatrix.needsUpdate = true;
  }
  placeCoins();
  body.computeBoundingSphere();

  // ---------------------------------------------------------------- boyut
  let W = 1, H = 1;
  function fit() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const dW = 7.2 / (t * camera.aspect);
    const dH = 6.1 / t;
    const d = Math.max(dW, dH, 13);
    const elev = 0.26;
    camera.position.set(0, LOOK.y + d * Math.sin(elev), d * Math.cos(elev));
    camera.lookAt(LOOK);
    camera.updateProjectionMatrix();
    scene.fog.near = d - 2;
    scene.fog.far = d + 11;
    faceMat.uniforms.uNear.value = d - 2;
    faceMat.uniforms.uFar.value = d + 11;
    dirty = true;
  }

  // ---------------------------------------------------------------- etkileşim
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let yaw = 0, pitch = 0, yawVel = 0;
  let drag = null;
  let dirty = true;

  function pickAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObject(body, false);
    return hits.length ? hits[0].instanceId : -1;
  }

  function showTip(i, clientX, clientY) {
    if (i < 0) { tip.hidden = true; return; }
    const hero = sorted[i];
    const v = Math.round(getValue ? getValue(hero.id) : hero.dogRate);
    tip.textContent = `${hero.name} · %${v} · ${tierOf(v).label}`;
    const r = host.getBoundingClientRect();
    tip.hidden = false;
    const x = clamp(clientX - r.left, 70, r.width - 70);
    tip.style.transform = `translate(${x}px, ${Math.max(8, clientY - r.top - 44)}px) translateX(-50%)`;
  }

  const onDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0, type: e.pointerType };
    yawVel = 0;
  };
  const onMove = (e) => {
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 6 && !drag.captured) {
        drag.captured = true;
        try { canvas.setPointerCapture(e.pointerId); } catch { /* yok say */ }
        tip.hidden = true;
      }
      if (drag.captured) {
        yaw += dx * 0.0075;
        yawVel = dx * 0.0075 * 60;
        pitch = clamp(pitch + dy * 0.003, -0.14, 0.22);
        dirty = true;
        wake();
      }
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const i = pickAt(e.clientX, e.clientY);
    if (i !== hover) {
      hover = i;
      hoverScale = reduced ? 1 : 0;
      faceMat.uniforms.uHover.value = i;
      canvas.style.cursor = i >= 0 ? 'pointer' : 'grab';
      dirty = true;
      wake();
    }
    showTip(i, e.clientX, e.clientY);
  };
  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.captured) {
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* yok say */ }
      if (reduced) yawVel = 0;
      wake();
      return;
    }
    if (performance.now() - d.t < 600) {
      const i = pickAt(e.clientX, e.clientY);
      if (i >= 0 && onPick) onPick(sorted[i]);
    }
  };
  const onCancel = () => { drag = null; };
  const onLeave = () => {
    if (hover !== -1) { hover = -1; faceMat.uniforms.uHover.value = -1; dirty = true; wake(); }
    tip.hidden = true;
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointerleave', onLeave);
  cleanups.push(() => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onCancel);
    canvas.removeEventListener('pointerleave', onLeave);
  });

  // ---------------------------------------------------------------- döngü
  let raf = 0;
  let last = performance.now();
  let visible = true;
  const running = () => alive && visible && !document.hidden;

  function frame(now) {
    raf = 0;
    if (!running()) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let animating = false;
    if (!reduced) {
      for (let k = 0; k < RINGS.length; k++) phase[k] += RINGS[k].speed * dt;
      animating = true;
    }
    if (!drag && Math.abs(yawVel) > 0.002) {
      yaw += yawVel * dt;
      yawVel *= Math.pow(0.05, dt);
      animating = true;
    }
    if (hover >= 0 && hoverScale < 1) {
      hoverScale = Math.min(1, hoverScale + dt * 6);
      animating = true;
    }
    if (animating || dirty) {
      tower.rotation.set(pitch, yaw, 0);
      placeCoins();
      renderer.render(scene, camera);
      dirty = false;
    }
    if (animating || drag) raf = requestAnimationFrame(frame);
  }
  function wake() {
    if (!raf && running()) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  const ro = new ResizeObserver(() => { fit(); wake(); });
  ro.observe(host);
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((en) => en.isIntersecting);
    if (visible) wake();
  }, { threshold: 0.01 });
  io.observe(host);
  const onVis = () => { if (!document.hidden) wake(); };
  document.addEventListener('visibilitychange', onVis);
  cleanups.push(() => { ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); });

  fit();
  wake();

  return {
    destroy() {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      for (const c of cleanups) c();
      bodyGeo.dispose();
      faceGeo.dispose();
      bodyMat.dispose();
      faceMat.dispose();
      texture.dispose();
      body.dispose();
      face.dispose();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* yok say */ }
      canvas.remove();
      tip.remove();
    },
    /** Görünürlük dışarıdan değiştiğinde (ör. detay sayfasında gizlendi) yeniden başlat. */
    wake() { dirty = true; wake(); },
  };

  // ---------------------------------------------------------------- 2D yedek
  function fallback() {
    const top = sorted.slice(0, 9);
    const fan = h('div', { class: 'hr-ring-fallback' },
      top.map((hero, i) => h('button', {
        type: 'button',
        class: 'hr-ring-fb-coin',
        style: { '--i': String(i - 4) },
        title: `${hero.name} · %${hero.dogRate}`,
        'aria-label': `${hero.name} dosyasını aç`,
        onclick: () => onPick && onPick(hero),
      }, crestSvg(hero))),
    );
    host.classList.add('is-fallback');
    host.appendChild(fan);
    return {
      destroy() { fan.remove(); tip.remove(); host.classList.remove('is-fallback'); },
      wake() {},
    };
  }
}
