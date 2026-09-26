// Müze için sınırlı GLB havuzu: yalnızca sergilenen eser ve komşuları bellekte tutulur.
// core/models.js'teki önbellek hiç boşalmaz (Arena gibi sabit bir kadro yükleyen sahneler için ideal);
// müze ise 18 eser arasında gezdiği için kendi havuzunu tutar ve uzaklaşan modelleri tamamen serbest bırakır
// (geometri, malzeme, doku ve ImageBitmap). Normalizasyon core/models.js ile aynıdır:
// taban y=0, merkez x/z=0, yükseklik `height`.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { modelUrl } from '../../core/assets.js';
import { platform } from '../../core/platform.js';

let loader = null;
function getLoader() {
  if (!loader) {
    loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

const TEX_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap'];

/** Bir kök nesnenin tüm GPU/CPU kaynaklarını serbest bırakır. */
export function freeRoot(root) {
  if (!root) return;
  const geos = new Set(), mats = new Set(), texs = new Set();
  root.traverse((o) => {
    if (o.geometry) geos.add(o.geometry);
    if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      mats.add(m);
      for (const k of TEX_SLOTS) if (m[k]) texs.add(m[k]);
    }
  });
  geos.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
  texs.forEach((t) => {
    t.dispose();
    const img = t.image;
    if (img && typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) {
      try { img.close(); } catch { /* yok say */ }
    }
  });
}

async function fetchBytes(url) {
  if (platform.inArtifact) {
    // claude.ai Artifact .glb sunmaz; yayında her model yanında base64 içeren <ad>.glb.json olarak durur
    try {
      const r = await fetch(url + '.json');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const { b64 } = await r.json();
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes.buffer;
    } catch { /* JSON kopyası yoksa (ör. yerel geliştirme) doğrudan .glb dene */ }
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.arrayBuffer();
}

function parse(buf) {
  return new Promise((resolve, reject) => getLoader().parse(buf, '', resolve, reject));
}

/**
 * Havuz: acquire(key) → Promise<{ root, bytes } | null>, clone(entry, height) → normalize edilmiş kopya,
 * trim(keepKeys) → listede olmayanları serbest bırakır, destroy() → hepsini bırakır.
 */
export function createModelPool() {
  const pool = new Map(); // key → { p, root, bytes, dead }

  function acquire(key) {
    let e = pool.get(key);
    if (e) return e.p;
    const url = modelUrl(key);
    if (!url) return Promise.resolve(null);
    e = { root: null, bytes: 0, dead: false, p: null };
    e.p = (async () => {
      try {
        const buf = await fetchBytes(url);
        const gltf = await parse(buf);
        const root = gltf.scene;
        root.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            if (o.material && o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
          }
        });
        if (e.dead) { freeRoot(root); return null; }
        e.root = root;
        e.bytes = buf.byteLength;
        return e;
      } catch (err) {
        console.warn('Model yüklenemedi:', key, err);
        pool.delete(key);
        return null;
      }
    })();
    pool.set(key, e);
    return e.p;
  }

  /** Paylaşımlı kaynaklı, normalize edilmiş bağımsız kopya. */
  function clone(entry, height = 1) {
    const c = entry.root.clone(true);
    const box = new THREE.Box3().setFromObject(c);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const s = size.y > 0 ? height / size.y : 1;
    const wrap = new THREE.Group();
    c.position.set(-center.x, -box.min.y, -center.z);
    wrap.add(c);
    wrap.scale.setScalar(s);
    const outer = new THREE.Group();
    outer.add(wrap);
    outer.userData.pooled = true; // kaynaklar havuza ait: sahneden çıkarken tek başına dispose edilmez
    return outer;
  }

  function trim(keep) {
    for (const [k, e] of pool) {
      if (keep.has(k)) continue;
      e.dead = true;
      if (e.root) freeRoot(e.root);
      e.root = null;
      pool.delete(k);
    }
  }

  function destroy() {
    trim(new Set());
  }

  const loadedKeys = () => [...pool.entries()].filter(([, e]) => e.root).map(([k]) => k);

  return { acquire, clone, trim, destroy, loadedKeys };
}
