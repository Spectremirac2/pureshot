// Uçan Kurye — geçici iskelet; oyun modülü bu dosyanın yerini alır.

import { h, fmtNum } from '../../core/dom.js';

export const meta = {
  id: 'kurye',
  name: 'Uçan Kurye',
  short: 'Kurye',
  icon: 'paw',
  color: 'var(--radiant)',
  kind: 'Refleks · Ritim',
  blurb: 'Kuryeyi kuleler arasından geçir. Bir dokunuş kanat, bir hata bottle.',
  time: 'Sonsuz',
  diff: 2,
  unit: 'metre',
  higherIsBetter: true,
  format: (n) => `${fmtNum(n)} metre`,
  rules: [],
  keys: [],
};

export function mount(el) {
  el.appendChild(h('div', { class: 'empty' }, 'Bu oyun hazırlanıyor.'));
  return () => {};
}
