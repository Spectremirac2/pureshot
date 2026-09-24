// fal.ai ile üretilmiş görseller ve 3D modeller.
// Dosyalar src/assets/fal/ altına `npm run fetch:fal` ile indirilir (bkz. scripts/fetch-fal-assets.mjs).
// Bir dosya yoksa ilgili fonksiyon null döner ve bileşenler prosedürel yedeğe geçer;
// böylece site varlıklar olmadan da derlenir ve çalışır.
//
// Görsel anahtarları:
//   hero-keyart, poster-dogdogdog, poster-1vdoquz, texture-arena,
//   portrait-<arketipId> (farm, feed, pause, afk, kurye, rapier, mid, ward, smurf, chat, legend)
// Model anahtarları:
//   model-dog, model-archer, model-aegis

const images = import.meta.glob('../assets/fal/*.{webp,jpg,jpeg,png}', { eager: true, query: '?url', import: 'default' });
const models = import.meta.glob('../assets/fal/*.{glb,bin}', { eager: true, query: '?url', import: 'default' });

function findIn(map, key) {
  for (const [path, url] of Object.entries(map)) {
    const file = path.split('/').pop();
    const base = file.replace(/\.(webp|jpe?g|png|glb|bin)$/i, '');
    if (base === key) return url;
  }
  return null;
}

/** Görsel URL'si ya da null. */
export function artUrl(key) {
  return findIn(images, key);
}

/** Portre anahtarı: arketip kimliğinden. */
export function portraitUrl(archetypeId) {
  return artUrl('portrait-' + archetypeId);
}

/** 3D model (GLB) URL'si ya da null. */
export function modelUrl(key) {
  return findIn(models, key);
}

export function hasArt() {
  return Object.keys(images).length > 0;
}

/** Galeride listelenecek tüm görseller: [{ key, url }] */
export function allArt() {
  return Object.entries(images).map(([path, url]) => ({
    key: path.split('/').pop().replace(/\.(webp|jpe?g|png)$/i, ''),
    url,
  }));
}
