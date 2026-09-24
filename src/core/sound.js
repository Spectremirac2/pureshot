// WebAudio ile üretilen ses efektleri (dış dosya yok).
// Tarayıcılar sesi ancak kullanıcı etkileşiminden sonra başlatır; unlock() ilk tıklamada çağrılır.

import { ls } from './dom.js';

let ctx = null;
let master = null;
let enabled = ls.get('sound', true);
const listeners = new Set();

function ensure() {
  if (!enabled) return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function noiseBuffer(dur = 0.3) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function tone({ type = 'sine', from = 440, to = from, dur = 0.15, vol = 0.3, delay = 0, attack = 0.005, curve = 'exp' }) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t0);
  if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  else o.frequency.linearRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.2, vol = 0.3, delay = 0, freq = 1200, q = 1, type = 'bandpass', sweepTo = null }) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(dur + 0.05);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t0);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

/** Havlama: formant süpürmesi + gürültü patlaması. pitch 0.6–1.6 */
function bark(pitch = 1, delay = 0) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(260 * pitch, t0);
  o.frequency.exponentialRampToValueAtTime(520 * pitch, t0 + 0.04);
  o.frequency.exponentialRampToValueAtTime(180 * pitch, t0 + 0.16);
  const f1 = c.createBiquadFilter();
  f1.type = 'bandpass';
  f1.frequency.setValueAtTime(700 * pitch, t0);
  f1.frequency.exponentialRampToValueAtTime(1400 * pitch, t0 + 0.05);
  f1.frequency.exponentialRampToValueAtTime(500 * pitch, t0 + 0.16);
  f1.Q.value = 4;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.7, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
  o.connect(f1).connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + 0.22);
  noise({ dur: 0.08, vol: 0.25, delay, freq: 2200 * pitch, q: 1.5 });
}

let voice = null;
function pickVoice() {
  try {
    const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    voice = vs.find((v) => /en[-_]US/i.test(v.lang) && /male|david|alex|daniel|fred/i.test(v.name)) || vs.find((v) => /^en/i.test(v.lang)) || vs[0] || null;
  } catch { voice = null; }
}
try {
  if (window.speechSynthesis) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
} catch { /* yok say */ }

export const sound = {
  get enabled() { return enabled; },
  setEnabled(v) {
    enabled = !!v;
    ls.set('sound', enabled);
    if (!enabled && ctx) ctx.suspend().catch(() => {});
    for (const cb of listeners) cb(enabled);
  },
  onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
  unlock() { ensure(); },

  click() { tone({ type: 'square', from: 900, to: 600, dur: 0.05, vol: 0.08 }); },
  hover() { tone({ type: 'sine', from: 1200, to: 1400, dur: 0.03, vol: 0.03 }); },
  bark,
  /** Üç havlama + büyük vuruş: DOG DOG DOG */
  dogdogdog() {
    bark(1.0, 0);
    bark(1.12, 0.22);
    bark(0.9, 0.44);
    tone({ type: 'sine', from: 120, to: 40, dur: 0.5, vol: 0.5, delay: 0.44 });
  },
  /** İsteğe bağlı sentezlenmiş ses: "DOG DOG DOG" (tarayıcı destekliyorsa). */
  say(text = 'DOG! DOG! DOG!') {
    if (!enabled) return;
    try {
      if (!window.speechSynthesis) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.lang = voice ? voice.lang : 'en-US';
      u.rate = 1.15;
      u.pitch = 0.7;
      u.volume = 0.9;
      speechSynthesis.speak(u);
    } catch { /* yok say */ }
  },
  stamp() {
    tone({ type: 'sine', from: 160, to: 45, dur: 0.35, vol: 0.6 });
    noise({ dur: 0.12, vol: 0.35, freq: 300, type: 'lowpass' });
  },
  coin() {
    tone({ type: 'square', from: 988, to: 988, dur: 0.07, vol: 0.12 });
    tone({ type: 'square', from: 1319, to: 1319, dur: 0.18, vol: 0.12, delay: 0.07 });
  },
  hit() { noise({ dur: 0.09, vol: 0.4, freq: 900, q: 0.8 }); tone({ type: 'triangle', from: 300, to: 90, dur: 0.1, vol: 0.3 }); },
  miss() { tone({ type: 'sawtooth', from: 220, to: 110, dur: 0.18, vol: 0.12 }); },
  good() {
    tone({ type: 'triangle', from: 523, dur: 0.1, vol: 0.2 });
    tone({ type: 'triangle', from: 784, dur: 0.16, vol: 0.2, delay: 0.08 });
  },
  bad() {
    tone({ type: 'square', from: 196, to: 180, dur: 0.14, vol: 0.14 });
    tone({ type: 'square', from: 147, to: 130, dur: 0.24, vol: 0.14, delay: 0.12 });
  },
  whoosh() { noise({ dur: 0.35, vol: 0.25, freq: 400, sweepTo: 3200, q: 0.7 }); },
  /** 0..1 şarj seviyesi için yükselen ton */
  charge(level = 0.5) { tone({ type: 'sawtooth', from: 200 + level * 600, to: 220 + level * 660, dur: 0.06, vol: 0.05 }); },
  shoot() { noise({ dur: 0.25, vol: 0.35, freq: 2500, sweepTo: 600, q: 2 }); tone({ type: 'sawtooth', from: 880, to: 220, dur: 0.2, vol: 0.12 }); },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.22, vol: 0.2, delay: i * 0.11 }));
    tone({ type: 'sine', from: 1047, to: 1568, dur: 0.6, vol: 0.12, delay: 0.44 });
  },
  lose() {
    [392, 330, 262, 196].forEach((f, i) => tone({ type: 'square', from: f, dur: 0.22, vol: 0.1, delay: i * 0.14 }));
  },
  tick() { tone({ type: 'square', from: 1800, dur: 0.02, vol: 0.05 }); },
};

// İlk etkileşimde ses bağlamını aç
const unlockOnce = () => {
  sound.unlock();
  window.removeEventListener('pointerdown', unlockOnce);
  window.removeEventListener('keydown', unlockOnce);
};
window.addEventListener('pointerdown', unlockOnce);
window.addEventListener('keydown', unlockOnce);
