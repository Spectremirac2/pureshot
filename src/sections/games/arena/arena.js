// GEÇİCİ TASLAK — 1vDOQUZ Arena (3D) paralel yapımda doldurulacak.
import { h } from '../../../core/dom.js';

/** Arena oyununu el içine kurar; temizleme fonksiyonu döndürür. */
export function mountArena(el, ctx) {
  el.appendChild(h('div', { class: 'empty' }, 'Arena yapım aşamasında.'));
  return () => {};
}
