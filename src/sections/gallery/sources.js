// Galeri için fal.ai varlık erişimi (core/assets + core/models üzerine ince katman).
// Test kancası: adres satırında ?gl-yedek varsa varlıklar yokmuş gibi davranılır; böylece
// prosedürel yedek görünümleri gerçek dosyalar dururken de doğrulanabilir.
// core/models.js (three.js + GLTFLoader) yalnızca model gerçekten istendiğinde yüklenir.

import { allArt, artUrl, modelUrl } from '../../core/assets.js';

export const FORCE_FALLBACK = (() => {
  try { return /[?&]gl-yedek(=|&|$)/.test(location.search); } catch { return false; }
})();

export const art = (key) => (FORCE_FALLBACK ? null : artUrl(key));
export const arts = () => (FORCE_FALLBACK ? [] : allArt());
export const modelAvailable = (key) => !FORCE_FALLBACK && !!modelUrl(key);
export async function fetchModel(key, opts) {
  if (FORCE_FALLBACK) return null;
  const { loadModel } = await import('../../core/models.js');
  return loadModel(key, opts);
}
