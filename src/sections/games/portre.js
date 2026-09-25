// Portre Avı — geçici iskelet; oyun modülü bu dosyanın yerini alır.

import { h, fmtNum } from '../../core/dom.js';

export const meta = {
  id: 'portre',
  name: 'Portre Avı',
  short: 'Portre',
  icon: 'target',
  color: 'var(--radiant)',
  kind: 'Refleks · Göz',
  blurb: 'Yakınlaştırılmış portreden kahramanı tanı. Görüntü açıldıkça puan eriyor.',
  time: '~2 dk',
  diff: 2,
  unit: 'puan',
  higherIsBetter: true,
  format: (n) => `${fmtNum(n)} puan`,
  rules: [],
  keys: [],
};

export function mount(el) {
  el.appendChild(h('div', { class: 'empty' }, 'Bu oyun hazırlanıyor.'));
  return () => {};
}
