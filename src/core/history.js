// Deneme geçmişi: her oyun ve quiz için son denemeler (yalnızca bu tarayıcıda, localStorage).
// store.me.submitScore her çağrıldığında buraya da yazılır; en iyi skor fan profilinde kalır,
// bu kayıt ise "son denemelerin", günlük görevler ve kişisel gelişim grafikleri içindir.
//
//   history.record(id, skor)   yeni deneme ekler (en fazla MAX kayıt/oyun)
//   history.get(id)            [{ s: skor, t: zaman damgası }] eskiden yeniye
//   history.all()              { id: [...] }
//   history.since(ms)          [{ id, s, t }] belirli bir andan sonraki tüm denemeler
//   history.subscribe(fn)      fn(id) — yeni denemede çağrılır; kapatma fonksiyonu döner
//   istanbulDayStart(now)      İstanbul (UTC+3) takviminde günün başlangıcı (ms)

import { ls } from './dom.js';

const KEY = 'hist';
const MAX = 20;
const listeners = new Set();

function read() {
  const v = ls.get(KEY, {});
  return v && typeof v === 'object' ? v : {};
}

export function istanbulDayStart(now = Date.now()) {
  const OFF = 3 * 3600e3;
  return Math.floor((now + OFF) / 86400e3) * 86400e3 - OFF;
}

export const history = {
  record(id, score) {
    if (!id || typeof score !== 'number' || !Number.isFinite(score)) return;
    const all = read();
    const list = Array.isArray(all[id]) ? all[id] : [];
    list.push({ s: score, t: Date.now() });
    all[id] = list.slice(-MAX);
    ls.set(KEY, all);
    for (const fn of listeners) {
      try { fn(id); } catch (e) { console.error(e); }
    }
  },
  get(id) {
    const list = read()[id];
    return Array.isArray(list) ? list.slice() : [];
  },
  all: read,
  since(ms) {
    const out = [];
    for (const [id, list] of Object.entries(read())) {
      if (!Array.isArray(list)) continue;
      for (const e of list) if (e.t >= ms) out.push({ id, s: e.s, t: e.t });
    }
    return out.sort((a, b) => a.t - b.t);
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
