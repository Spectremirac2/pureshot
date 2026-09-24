// Galeri beğenileri: anahtar 'gl:<varlık>' olarak ziyaretçinin fan belgesinde tutulur.
// Sayılar = diğer fanların beğenileri + (benim anlık beğenim), böylece yazma gecikmesi görünmez.

import { store, agg } from '../../core/store.js';

export function likeTracker(onChange) {
  let others = {};
  const unsubFans = store.fans((fans) => {
    const myId = store.uid() || 'me';
    others = agg.likeCounts(fans.filter((f) => f.id !== myId));
    onChange();
  });
  const unsubMe = store.me.subscribe(() => onChange());
  const k = (key) => 'gl:' + key;
  return {
    count(key) {
      const mine = (store.me.get().likes || {})[k(key)] ? 1 : 0;
      return (others[k(key)] || 0) + mine;
    },
    liked(key) {
      return !!(store.me.get().likes || {})[k(key)];
    },
    toggle(key) {
      return store.me.toggleLike(k(key));
    },
    destroy() {
      unsubFans();
      unsubMe();
    },
  };
}
