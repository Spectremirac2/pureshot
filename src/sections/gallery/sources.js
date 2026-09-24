// Galeri için fal.ai varlık erişimi (core/assets + core/models üzerine ince katman).
// Test kancası: adres satırında ?gl-yedek varsa varlıklar yokmuş gibi davranılır; böylece
// prosedürel yedek görünümleri gerçek dosyalar dururken de doğrulanabilir.

import { allArt, artUrl } from '../../core/assets.js';
import { loadModel, hasModel } from '../../core/models.js';

export const FORCE_FALLBACK = (() => {
  try { return /[?&]gl-yedek(=|&|$)/.test(location.search); } catch { return false; }
})();

export const art = (key) => (FORCE_FALLBACK ? null : artUrl(key));
export const arts = () => (FORCE_FALLBACK ? [] : allArt());
export const modelAvailable = (key) => !FORCE_FALLBACK && hasModel(key);
export const fetchModel = (key, opts) => (FORCE_FALLBACK ? Promise.resolve(null) : loadModel(key, opts));
