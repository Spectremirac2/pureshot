// Galeri için fal.ai varlık erişimi (core/assets üzerine ince katman).
// Test kancası: adres satırında ?gl-yedek varsa varlıklar yokmuş gibi davranılır; böylece
// prosedürel yedek görünümleri gerçek dosyalar dururken de doğrulanabilir.
// Modellerin kendisi müzenin sınırlı havuzundan yüklenir (modelpool.js; yalnızca modelAvailable true ise).

import { allArt, artUrl, modelUrl } from '../../core/assets.js';

export const FORCE_FALLBACK = (() => {
  try { return /[?&]gl-yedek(=|&|$)/.test(location.search); } catch { return false; }
})();

export const art = (key) => (FORCE_FALLBACK ? null : artUrl(key));
export const arts = () => (FORCE_FALLBACK ? [] : allArt());
export const modelAvailable = (key) => !FORCE_FALLBACK && !!modelUrl(key);
