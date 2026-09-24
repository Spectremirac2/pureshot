// Canlı topluluk ayarı: fan belgelerindeki picks['hv:<id>'] (DOG mu? oyu) ve picks['tl:<id>'] (kişisel tier)
// değerlerini tek geçişte toplar. Kendi oylarımız her zaman store.me'nin en güncel hâlinden eklenir,
// böylece yazma gecikmesi beklenmeden sayılar anında güncellenir.
//
// Topluluk DOG Endeksi = Bayes ortalaması: (dogRate*K + dogOy*100) / (K + toplamOy), K = 8

import { HEROES, tierOf, DOG_TIERS } from '../../data/heroes.js';

export const K = 8;
export const TIER_IDS = DOG_TIERS.map((t) => t.id); // ['S','A','B','C','D']
const TIER_SCORE = { S: 5, A: 4, B: 3, C: 2, D: 1 };
const SCORE_TIER = ['D', 'D', 'C', 'B', 'A', 'S'];

export const voteKey = (id) => 'hv:' + id;
export const tierKey = (id) => 'tl:' + id;

/** Bayes ortalaması. */
export function bayes(bias, dog, total) {
  return (bias * K + dog * 100) / (K + total);
}

export function createCommunity(store) {
  // Diğer ziyaretçilerin toplamları (kendi belgemiz hariç)
  let others = new Map(); // id → { dog, not, tl: {S..D: n} }
  let fansCount = 0;
  let ready = false;
  const listeners = new Set();
  let stats = new Map();

  const emptyRow = () => ({ dog: 0, not: 0, tl: { S: 0, A: 0, B: 0, C: 0, D: 0 } });

  function tallyOthers(fans) {
    const meId = store.uid() || 'me';
    const m = new Map();
    let n = 0;
    for (const f of fans) {
      if (!f || f.id === meId || f.id === 'me') continue;
      n++;
      const p = f.picks;
      if (!p) continue;
      for (const k in p) {
        const c = k.charCodeAt(0);
        if (c !== 104 && c !== 116) continue; // 'h' | 't'
        const v = p[k];
        if (k.startsWith('hv:')) {
          const id = k.slice(3);
          let row = m.get(id);
          if (!row) m.set(id, (row = emptyRow()));
          if (v === 'dog') row.dog++;
          else if (v === 'not') row.not++;
        } else if (k.startsWith('tl:') && TIER_SCORE[v]) {
          const id = k.slice(3);
          let row = m.get(id);
          if (!row) m.set(id, (row = emptyRow()));
          row.tl[v]++;
        }
      }
    }
    others = m;
    fansCount = n;
  }

  let lastSig = null;
  function recompute() {
    const picks = (store.me.get() && store.me.get().picks) || {};
    const next = new Map();
    const sig = [];
    for (const hero of HEROES) {
      const o = others.get(hero.id);
      const myVote = picks[voteKey(hero.id)] || null;
      const myTier = TIER_SCORE[picks[tierKey(hero.id)]] ? picks[tierKey(hero.id)] : null;
      const dog = (o ? o.dog : 0) + (myVote === 'dog' ? 1 : 0);
      const not = (o ? o.not : 0) + (myVote === 'not' ? 1 : 0);
      const total = dog + not;
      const live = bayes(hero.dogRate, dog, total);
      const tlCounts = { ...(o ? o.tl : emptyRow().tl) };
      if (myTier) tlCounts[myTier]++;
      let tlN = 0;
      let tlSum = 0;
      for (const t of TIER_IDS) {
        tlN += tlCounts[t];
        tlSum += tlCounts[t] * TIER_SCORE[t];
      }
      const tlAvg = tlN ? tlSum / tlN : 0;
      if (total || tlN) sig.push(`${hero.id}:${dog},${not},${myVote || ''},${myTier || ''},${TIER_IDS.map((t) => tlCounts[t]).join('.')}`);
      next.set(hero.id, {
        id: hero.id,
        bias: hero.dogRate,
        live,
        liveRound: Math.round(live),
        dog,
        not,
        total,
        myVote,
        myTier,
        tier: tierOf(Math.round(live)),
        biasTier: tierOf(hero.dogRate),
        tlCounts,
        tlN,
        tlAvg,
        tlAvgTier: tlN ? SCORE_TIER[Math.round(tlAvg)] : null,
      });
    }
    stats = next;
    const sigStr = sig.join('|');
    if (sigStr === lastSig) return; // oy/tier değişmedi: dinleyicileri boşuna uyandırma
    lastSig = sigStr;
    for (const cb of listeners) {
      try { cb(api); } catch (e) { console.error(e); }
    }
  }

  const unsubFans = store.fans((fans) => {
    tallyOthers(fans);
    ready = true;
    recompute();
  });
  const unsubMe = store.me.subscribe(() => recompute());

  const api = {
    get ready() { return ready; },
    /** Topluluktaki (bizim dışımızdaki) fan belgesi sayısı. */
    get fans() { return fansCount; },
    get(id) { return stats.get(id) || null; },
    /** metric: 'bias' | 'live' */
    value(id, metric = 'live') {
      const s = stats.get(id);
      if (!s) return 0;
      return metric === 'bias' ? s.bias : s.live;
    },
    totalVotes() {
      let n = 0;
      for (const s of stats.values()) n += s.total;
      return n;
    },
    subscribe(cb) {
      listeners.add(cb);
      if (stats.size) queueMicrotask(() => listeners.has(cb) && cb(api));
      return () => listeners.delete(cb);
    },
    /** Oy ver / geri al (aynı değer tekrar verilirse kaldırılır). Yeni değeri döndürür. */
    vote(id, value) {
      let now = null;
      store.me.patch((d) => {
        if (!d.picks) d.picks = {};
        const k = voteKey(id);
        if (d.picks[k] === value) delete d.picks[k];
        else { d.picks[k] = value; now = value; }
      });
      return now;
    },
    /** Kişisel tier yerleşimi: tier null ise havuza geri döner. */
    place(id, tier) {
      store.me.patch((d) => {
        if (!d.picks) d.picks = {};
        const k = tierKey(id);
        if (!tier) delete d.picks[k];
        else d.picks[k] = tier;
      });
    },
    /** Birden çok yerleşimi tek yazmada uygular: { id: tier|null } */
    placeMany(map) {
      store.me.patch((d) => {
        if (!d.picks) d.picks = {};
        for (const [id, tier] of Object.entries(map)) {
          const k = tierKey(id);
          if (!tier) delete d.picks[k];
          else d.picks[k] = tier;
        }
      });
    },
    destroy() {
      unsubFans();
      unsubMe();
      listeners.clear();
    },
  };
  recompute();
  return api;
}
