// GEÇİCİ TASLAK — Kahraman DOG Endeksi paralel yapımda doldurulacak.
import { h } from '../../core/dom.js';

export default {
  mount(el) {
    el.appendChild(h('div', { class: 'wrap' }, h('p', { class: 'muted' }, 'Yapım aşamasında.')));
  },
};
