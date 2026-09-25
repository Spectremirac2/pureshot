// DOGdle — geçici iskelet; oyun modülü bu dosyanın yerini alır.

import { h, fmtNum } from '../../core/dom.js';

export const meta = {
  id: 'dogdle',
  name: 'DOGdle',
  short: 'DOGdle',
  icon: 'eye',
  color: 'var(--aegis-2)',
  kind: 'Günlük · Tahmin',
  blurb: 'Her gün bir gizli kahraman. Özellikleri karşılaştır, en az tahminle bul.',
  time: 'Günlük',
  diff: 2,
  unit: 'tahmin',
  higherIsBetter: false,
  format: (n) => `${fmtNum(n)} tahmin`,
  rules: [],
  keys: [],
};

export function mount(el) {
  el.appendChild(h('div', { class: 'empty' }, 'Bu oyun hazırlanıyor.'));
  return () => {};
}
