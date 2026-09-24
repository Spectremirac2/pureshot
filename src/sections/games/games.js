// GEÇİCİ TASLAK — bu bölüm paralel yapım aşamasında doldurulacak.
import { h } from '../../core/dom.js';

export default {
  mount(el) {
    el.appendChild(h('div', { class: 'wrap view-inner' }, h('p', { class: 'muted' }, 'Yapım aşamasında.')));
  },
};
