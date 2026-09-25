// Techies Mayın Tarlası — geçici iskelet; oyun modülü bu dosyanın yerini alır.

import { h, fmtNum } from '../../core/dom.js';

export const meta = {
  id: 'mayin',
  name: 'Techies Mayın Tarlası',
  short: 'Mayın',
  icon: 'flame',
  color: 'var(--dire)',
  kind: 'Zihin · Mantık',
  blurb: 'Ormanı mayınlardan temizle. Techies gülüyorsa bir yerde hata yaptın.',
  time: '~3 dk',
  diff: 2,
  unit: 'sn',
  higherIsBetter: false,
  format: (n) => `${fmtNum(n)} sn`,
  rules: [],
  keys: [],
};

export function mount(el) {
  el.appendChild(h('div', { class: 'empty' }, 'Bu oyun hazırlanıyor.'));
  return () => {};
}
