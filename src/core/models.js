// fal.ai (Trellis 2) ile üretilmiş GLB modellerini yükler; önbellekler ve kopyalar.
// Model yoksa veya yüklenemezse null döner: çağıran taraf prosedürel modele geçmelidir.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { modelUrl } from './assets.js';
import { platform } from './platform.js';

const cache = new Map();
let loader = null;

function getLoader() {
  if (!loader) {
    loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

/**
 * Modeli yükler ve normalize eder: tabanı y=0'da, yüksekliği `height` birim, merkezi x/z=0.
 * Her çağrıda bağımsız bir klon döner (malzemeler paylaşılır).
 * @returns {Promise<THREE.Object3D|null>}
 */
export async function loadModel(key, { height = 1 } = {}) {
  const url = modelUrl(key);
  if (!url) return null;
  if (!cache.has(key)) {
    cache.set(key, new Promise((resolve) => {
      const onLoad = (gltf) => {
          const root = gltf.scene;
          root.traverse((o) => {
            if (o.isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
              if (o.material && o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
            }
          });
          resolve(root);
      };
      const onError = (err) => {
        console.warn('Model yüklenemedi:', key, err);
        resolve(null);
      };
      if (platform.inArtifact) {
        // claude.ai Artifact .glb sunmaz; yayında her model yanında base64 içeren <ad>.glb.json olarak durur
        fetch(url + '.json')
          .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(({ b64 }) => {
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            getLoader().parse(bytes.buffer, '', onLoad, onError);
          })
          .catch(onError);
      } else {
        getLoader().load(url, onLoad, undefined, onError);
      }
    }));
  }
  const base = await cache.get(key);
  if (!base) return null;
  const clone = base.clone(true);
  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const s = size.y > 0 ? height / size.y : 1;
  const wrap = new THREE.Group();
  clone.position.set(-center.x, -box.min.y, -center.z);
  wrap.add(clone);
  wrap.scale.setScalar(s);
  const outer = new THREE.Group();
  outer.add(wrap);
  outer.userData.modelKey = key;
  return outer;
}

export function hasModel(key) {
  return !!modelUrl(key);
}
