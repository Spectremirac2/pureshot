// DOG Bingo — geçici iskelet; oyun modülü bu dosyanın yerini alır.

import { h, fmtNum } from '../../core/dom.js';

export const meta = {
  id: 'bingo',
  name: 'DOG Bingo',
  short: 'Bingo',
  icon: 'star',
  color: 'var(--ember)',
  kind: 'Yayın · Etkileşim',
  blurb: 'Yayını izlerken DOG anlarını işaretle. Satırı tamamlayan bağırır: BINGO!',
  time: 'Yayın boyu',
  diff: 1,
  unit: 'bingo',
  higherIsBetter: true,
  format: (n) => `${fmtNum(n)} bingo`,
  rules: [],
  keys: [],
};

export function mount(el) {
  el.appendChild(h('div', { class: 'empty' }, 'Bu oyun hazırlanıyor.'));
  return () => {};
}
