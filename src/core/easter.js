// Küçük sürprizler (kabuk klavye işleyicisinden beslenir; yalnızca kısayollar açıkken, yazı alanı ve modal dışında):
//   • Konami kodu (↑ ↑ ↓ ↓ ← → ← → B A) → "1vDOQUZ MODU" damgası + konfeti + 10 sn altın tema (<html class="csk-gold">)
//   • "dogdogdog" yazmak → DOG DOG DOG damgası + ses + bir DOG basışı
// Ayrıntılar: docs/REHBER.md

import { fx } from './fx.js';
import { sound } from './sound.js';
import { prefersReducedMotion } from './dom.js';

const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
const WORD = 'dogdogdog';
const IDLE_MS = 1500; // tuşlar arası bu kadar boşlukta dizi sıfırlanır
const GOLD_MS = 10000;

/**
 * onDog: DOG basışını sayan fonksiyon (kabuktaki pressDog).
 * Dönen feed(e) kabuğun keydown işleyicisinde çağrılır; true dönerse tuş kısayol olarak kullanılmaz
 * ("dogd…" yazarken ikinci ve üçüncü D, Karakter Analizleri'ne ışınlamasın).
 */
export function initEaster({ onDog } = {}) {
  let seq = [];
  let word = '';
  let last = 0;
  let goldTimer = 0;

  function konami() {
    const root = document.documentElement;
    fx.stamp('1vDOQUZ MODU', { variant: 'gold', ms: 1500 });
    sound.win();
    if (!prefersReducedMotion()) {
      fx.confetti(innerWidth / 2, innerHeight * 0.45, 120);
    }
    root.classList.add('csk-gold');
    clearTimeout(goldTimer);
    goldTimer = setTimeout(() => root.classList.remove('csk-gold'), GOLD_MS);
    fx.toast('1vDOQUZ modu açıldı: 10 saniye boyunca her şey Aegis altını. Dokuz kişiyi taşı!', undefined, 3600);
  }

  function dogdogdog() {
    fx.stamp('DOG DOG DOG');
    if (onDog) onDog();
    else sound.dogdogdog();
  }

  function feed(e) {
    if (!e || typeof e.key !== 'string' || e.repeat) return false;
    const now = performance.now();
    if (now - last > IDLE_MS) { seq = []; word = ''; }
    last = now;
    const k = e.key.toLowerCase();

    seq.push(k);
    if (seq.length > KONAMI.length) seq.shift();
    if (seq.length === KONAMI.length && seq.every((x, i) => x === KONAMI[i])) {
      seq = [];
      konami();
      return true;
    }

    if (k.length === 1) {
      word = (word + k).slice(-WORD.length);
      if (word === WORD) {
        word = '';
        dogdogdog();
        return true;
      }
      // "dog" yazıldıktan sonra gelen D bir kısayol değil, memenin devamı
      if (k === 'd' && word.endsWith('dogd')) return true;
    }
    return false;
  }

  return { feed };
}
