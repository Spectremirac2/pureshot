// Oyunlar arası küçük "oyun hissi" yardımcıları (2. tur oyun cilası):
// sonuç kartına rekor notu, oyun içinde rekor geçme takibi ve dokunsal (titreşim) geri bildirim.
// Skorlara dokunmaz; yalnızca gösterim yapar.

import './juice.css';
import { h, fmtNum } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { sound } from '../../core/sound.js';

let coarse = null;
const isCoarse = () => {
  if (coarse == null) {
    try { coarse = window.matchMedia('(pointer: coarse)').matches; } catch { coarse = false; }
  }
  return coarse;
};

/**
 * Kısa titreşim (yalnızca dokunmatik ve destekleyen tarayıcılarda). Ses kapalıysa "sessiz mod"
 * sayılır, titreşim de olmaz. pattern: ms ya da [ms, ara, ms…].
 */
export function haptic(pattern = 12) {
  try {
    if (!sound.enabled || !isCoarse() || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(pattern);
  } catch { /* yok say */ }
}

/**
 * Sonuç kartı için rekor notu. Yeni rekorda farkı, kıl payı kaçırmada kalan farkı söyler.
 * prev: önceki en iyi (yoksa not yok) · higher: yüksek skor iyi mi · fmt: fark biçimi ·
 * near: "kıl payı" eşiği (önceki rekora oranla).
 */
export function pbNote({ score, prev, higher = true, fmt = fmtNum, near = 0.15 }) {
  if (typeof prev !== 'number' || !Number.isFinite(prev) || !Number.isFinite(score)) return null;
  const diff = higher ? score - prev : prev - score;
  if (diff > 0) {
    return h('p', { class: 'gm-pb-note up' }, icon('crown', { size: 14 }), h('span', null, `Eski rekorunu ${fmt(diff)} farkla geçtin.`));
  }
  if (diff === 0) {
    return h('p', { class: 'gm-pb-note tie' }, icon('target', { size: 14 }), h('span', null, 'Rekoruna tam eşitledin. Bir tık daha!'));
  }
  if (-diff <= Math.abs(prev) * near) {
    return h('p', { class: 'gm-pb-note near' }, icon('flame', { size: 14 }), h('span', null, `Kıl payı! Rekoruna ${fmt(-diff)} kaldı.`));
  }
  return null;
}

/** Notu kit sonuç kartına (istatistiklerin altına, espriden önce) yerleştirir. */
export function addPbNote(node, note) {
  if (!node || !note) return;
  const at = node.querySelector('.gm-result-quip') || node.querySelector('.gm-result-actions');
  if (at) at.before(note); else node.appendChild(note);
}

/**
 * Oyun içinde rekoru geçme anını bir kez yakalar. prev yoksa (ilk oyun) hiç tetiklenmez.
 * check(score) → true yalnızca rekorun geçildiği ilk çağrıda.
 */
export function recordWatch(prev, higher = true) {
  let fired = typeof prev !== 'number' || !Number.isFinite(prev) || (higher && prev <= 0);
  return (score) => {
    if (fired) return false;
    if (higher ? score > prev : score < prev) { fired = true; return true; }
    return false;
  };
}
