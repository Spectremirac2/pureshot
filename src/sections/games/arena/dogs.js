// 1vDOQUZ Arena — DOG türleri ve davranışları (ARCHETYPES kimlikleriyle).
// Her tür DOG Arşivi'ndeki bir pub alışkanlığını oynanışa çevirir.

import { ARCHETYPES } from '../../../data/archetypes.js';
import { shuffle, pick } from '../../../core/dom.js';

/**
 * hp/speed/dmg dalga 1 değerleridir; dalga ile ölçeklenir.
 * r: çarpışma yarıçapı. fur: prosedürel köpeğin post rengi.
 * short: etiket adı, hint: sahada ne yaptığı (rehber ve başlangıç ekranı için).
 */
export const DOG_TYPES = {
  feed: { hp: 70, speed: 4.1, dmg: 38, r: 0.46, fur: '#c98f5a', short: 'FEED', hint: 'Hızlı ve kırılgan. Düşünmeden sana dalar.' },
  farm: { hp: 120, speed: 3.7, dmg: 34, r: 0.48, fur: '#e3c28f', short: 'FARM', hint: 'Kenara kaçıp farm yapar. Kovalamazsan 6 slot döner.' },
  pause: { hp: 110, speed: 3.5, dmg: 34, r: 0.48, fur: '#9d8c7c', short: 'PAUSE', hint: 'Ara ara donar; tepesinde ‖ yanınca serbest atış.' },
  afk: { hp: 140, speed: 4.0, dmg: 40, r: 0.5, fur: '#77707f', short: 'AFK', hint: 'Vurulana kadar kıpırdamaz. Uyandırırsan koşar.' },
  kurye: { hp: 65, speed: 5.0, dmg: 16, r: 0.44, fur: '#d9a441', short: 'KURYE', hint: 'Zikzak koşar. Sana değerse bir Tango çalar.' },
  rapier: { hp: 165, speed: 2.9, dmg: 72, r: 0.52, fur: '#b9b1a2', short: 'RAPIER', hint: 'Çok acıtır. Düşürdüğü Rapier 8 sn çift hasar verir.' },
  mid: { hp: 175, speed: 3.6, dmg: 50, r: 0.52, fur: '#a0522d', short: 'MID', hint: 'Merkezi korur. Ortaya girersen “mid or feed”.' },
  ward: { hp: 90, speed: 3.3, dmg: 36, r: 0.47, fur: '#4a4160', short: 'WARDSIZ', hint: 'Yarı görünmez; ancak yaklaşınca belirir.' },
  smurf: { hp: 120, speed: 3.1, dmg: 46, r: 0.48, fur: '#efe6d8', short: 'SMURF', hint: 'Nişan alıp atılır (dash). Yana adım at.' },
  chat: { hp: 100, speed: 3.3, dmg: 30, r: 0.47, fur: '#b56b45', short: 'CHAT', hint: 'Uzaktan “REPORT!” atar; değerse yavaşlarsın.' },
};

export const TYPE_IDS = Object.keys(DOG_TYPES);
const ARCH = Object.fromEntries(ARCHETYPES.map((a) => [a.id, a]));
export const archOf = (id) => ARCH[id] || { id, name: id, color: '#ff6a2b' };

/** Dalga ölçekleri. */
export function waveScale(n) {
  const k = n - 1;
  return {
    // Arena 2.0: kahraman artık seviye atlayıp eşya aldığı için geç dalgalar daha sert ölçeklenir
    hp: 1 + 0.26 * k + 0.035 * k * k,
    speed: Math.min(1.42, 1 + 0.045 * k),
    dmg: 1 + 0.12 * k + 0.006 * k * k,
    interval: Math.max(0.6, 1.45 - 0.09 * k),
    elites: n >= 4 ? Math.min(6, 1 + Math.floor((n - 4) / 2)) : 0,
  };
}

/** Dalga N için 9 türlük dizilim. İlk dalga yumuşak başlar. */
export function buildWave(n) {
  if (n === 1) return shuffle(['afk', 'feed', 'pause', 'farm', 'kurye', 'chat', 'ward', 'feed', 'afk']);
  if (n === 2) return shuffle(['feed', 'farm', 'pause', 'kurye', 'mid', 'ward', 'smurf', 'chat', 'rapier']);
  const all = shuffle(TYPE_IDS);
  const out = all.slice(0, 9);
  // ileri dalgalarda sert türler iki kez gelebilir
  if (n >= 5) out[8] = pick(['smurf', 'rapier', 'mid', 'feed']);
  return shuffle(out);
}

// ------------------------------------------------------------------ yapay zekâ
function toward(d, tx, tz) {
  const dx = tx - d.x;
  const dz = tz - d.z;
  const L = Math.hypot(dx, dz) || 1;
  return [dx / L, dz / L, L];
}

/**
 * Bir köpeğin bu adımdaki niyetini hesaplar.
 * Dönen { mx, mz, spd } istenen hareket yönü ve hızıdır; saldırı ayrı ele alınır.
 * g: oyun (player, R, time, emit, spawnBubble, hurtPlayer...)
 */
export function thinkDog(d, g, dt) {
  const p = g.player;
  let [ux, uz, dist] = toward(d, p.x, p.z);
  d.dist = dist;
  d.status = null;
  const R = g.PLAY_R;

  // tanıtım modu: rastgele dolaş
  if (g.state === 'idle' || g.state === 'over') {
    d.t -= dt;
    if (d.t <= 0 || d.tx == null) {
      const a = Math.random() * Math.PI * 2;
      const rr = 3 + Math.random() * (R - 5);
      d.tx = Math.sin(a) * rr;
      d.tz = Math.cos(a) * rr;
      d.t = 2 + Math.random() * 3;
    }
    const [wx, wz, wd] = toward(d, d.tx, d.tz);
    return wd < 0.4 ? { mx: 0, mz: 0, spd: 0 } : { mx: wx, mz: wz, spd: d.speed * 0.45 };
  }

  const st = d.st;
  if (st.stun > 0) {
    d.status = 'stun';
    d.canBite = false;
    return { mx: 0, mz: 0, spd: 0 };
  }
  if (st.root > 0) {
    // Buz Zinciri: yürüyemez, ısıramaz
    d.status = 'frozen';
    d.canBite = false;
    d.windup = 0;
    return { mx: 0, mz: 0, spd: 0 };
  }
  if (st.fear > 0) {
    d.status = 'fear';
    d.canBite = false;
    return { mx: -ux, mz: -uz, spd: d.speed * 1.05 };
  }
  // oyuncu düştüyse sürü kutlar
  if (p.dead || g.state === 'dying') {
    d.status = 'gg';
    return { mx: 0, mz: 0, spd: 0 };
  }
  // Rapier hırsızı Kurye: en yakın kapıya kaçar
  if (d.thief) {
    d.canBite = false;
    d.status = 'loot';
    let best = null;
    let bd = Infinity;
    for (const a of g.dogGates) {
      const gx = Math.sin(a) * R;
      const gz = Math.cos(a) * R;
      const q = (gx - d.x) ** 2 + (gz - d.z) ** 2 - ((gx - p.x) ** 2 + (gz - p.z) ** 2) * 0.35;
      if (q < bd) { bd = q; best = [gx, gz]; }
    }
    const [tx, tz] = toward(d, best[0], best[1]);
    const zz = Math.sin(g.time * 6 + d.seed) * 0.5;
    return { mx: tx - tz * zz, mz: tz + tx * zz, spd: d.speed * 1.05 };
  }
  // Savaş Çağrısı: özel durumları unut, doğrudan Balta'ya
  if (st.taunt > 0) {
    d.status = 'taunt';
    if (d.state === 'afk' || d.state === 'farm' || d.state === 'flee' || d.state === 'guard' || d.state === 'paused' || d.state === 'tele') d.state = d.type === 'mid' ? 'chase' : 'go';
    d.canBite = true;
    return { mx: ux, mz: uz, spd: d.speed * 1.1 };
  }
  // görünmez kahraman: son görülen yere git, etrafı kokla
  if (!g.heroVisible) {
    d.canBite = false;
    d.status = 'lost';
    d.windup = 0;
    if (d.lostT == null || d.lostT <= 0) {
      d.lostT = 1.2 + Math.random();
      const a = Math.random() * Math.PI * 2;
      d.tx = g.lastSeenX + Math.sin(a) * 2.5;
      d.tz = g.lastSeenZ + Math.cos(a) * 2.5;
    }
    d.lostT -= dt;
    const [wx, wz, wd] = toward(d, d.tx, d.tz);
    return wd < 0.4 ? { mx: 0, mz: 0, spd: 0 } : { mx: wx, mz: wz, spd: d.speed * 0.5 };
  }
  d.lostT = 0;

  const canBite = { value: true };
  let mx = ux;
  let mz = uz;
  let spd = d.speed;

  switch (d.type) {
    case 'feed': {
      // hafif bir dalış salınımı; doğrudan gelir
      const s = Math.sin(g.time * 4 + d.seed) * 0.15;
      mx = ux - uz * s;
      mz = uz + ux * s;
      break;
    }
    case 'farm': {
      if (d.state === 'farm' || d.state === 'flee') {
        canBite.value = false;
        d.farmT += dt;
        if (d.farmT >= 14) {
          d.state = 'carry';
          d.maxHp = Math.round(d.maxHp * 1.5);
          d.hp = Math.min(d.maxHp, d.hp + d.maxHp * 0.5);
          d.dmg *= 1.5;
          d.speed *= 1.1;
          d.scale = 1.25;
          g.emit('farmDone', { dog: d });
          break;
        }
        // kaçış noktası: oyuncuya göre arenanın karşı kenarı
        const pa = Math.atan2(p.x, p.z);
        const fa = pa + Math.PI + Math.sin(g.time * 0.35 + d.seed) * 0.6;
        const tx = Math.sin(fa) * (R - 1.2);
        const tz = Math.cos(fa) * (R - 1.2);
        const [fx, fz, fd] = toward(d, tx, tz);
        if (dist < 6.5 || fd > 2.5) {
          d.state = 'flee';
          mx = fx;
          mz = fz;
          spd = d.speed * (dist < 6.5 ? 1.05 : 0.9);
          d.status = 'farm';
        } else {
          d.state = 'farm';
          mx = 0;
          mz = 0;
          spd = 0;
          d.status = 'farm';
          d.coinT -= dt;
          if (d.coinT <= 0) {
            d.coinT = 1.1;
            d.hp = Math.min(d.maxHp, d.hp + d.maxHp * 0.04);
            g.emit('farmTick', { dog: d });
          }
        }
      }
      break;
    }
    case 'pause': {
      d.t -= dt;
      if (d.state === 'paused') {
        d.status = 'pause';
        canBite.value = false;
        spd = 0;
        if (d.t <= 0) {
          d.state = 'go';
          d.t = 2.2 + Math.random() * 2;
        }
      } else if (d.t <= 0) {
        d.state = 'paused';
        d.t = 1.4;
        d.windup = 0;
        g.emit('pauseDog', { dog: d });
      }
      break;
    }
    case 'afk': {
      if (d.state === 'afk') {
        d.status = 'afk';
        canBite.value = false;
        spd = 0;
      }
      break;
    }
    case 'kurye': {
      if (d.state === 'flee') {
        d.t -= dt;
        mx = -ux;
        mz = -uz;
        spd = d.speed * 1.15;
        canBite.value = false;
        d.status = 'loot';
        if (d.t <= 0) d.state = 'go';
      } else {
        const z = Math.sin(g.time * 5.5 + d.seed) * 1.1;
        mx = ux - uz * z;
        mz = uz + ux * z;
        canBite.value = false;
        d.stealCd -= dt;
        if (dist < d.r + 0.55 && d.stealCd <= 0) {
          d.stealCd = 2.5;
          g.kuryeTouch(d);
          d.state = 'flee';
          d.t = 2.4;
        }
      }
      break;
    }
    case 'rapier': {
      spd = d.speed * (dist < 3 ? 1.25 : 1);
      break;
    }
    case 'mid': {
      const pc = Math.hypot(p.x, p.z);
      if (d.state === 'guard') {
        if (pc < 6.2 || d.hp < d.maxHp) {
          d.state = 'chase';
          g.emit('midAggro', { dog: d });
        } else {
          const a = g.time * 0.7 + d.seed;
          const [gx, gz, gd] = toward(d, Math.sin(a) * 2.4, Math.cos(a) * 2.4);
          mx = gx;
          mz = gz;
          spd = gd > 0.3 ? d.speed * 0.6 : 0;
          canBite.value = dist < 2;
          d.status = 'mid';
        }
      } else if (pc > 9.5 && d.hp >= d.maxHp * 0.999) {
        d.state = 'guard';
      }
      break;
    }
    case 'ward': {
      d.vis = Math.max(0.12, Math.min(1, (6.5 - dist) / 2.8));
      if (d.hitFlash > 0) d.vis = 1;
      break;
    }
    case 'smurf': {
      d.t -= dt;
      if (d.state === 'tele') {
        d.status = 'dash';
        spd = 0;
        canBite.value = false;
        if (d.t <= 0) {
          d.state = 'dash';
          d.t = 0.36;
          g.emit('dash', { dog: d });
        }
      } else if (d.state === 'dash') {
        mx = d.dx;
        mz = d.dz;
        spd = 15;
        canBite.value = false;
        if (dist < d.r + 0.5 && !d.dashHit) {
          d.dashHit = true;
          g.hurtPlayer(d.dmg, d, { attack: true });
        }
        if (d.t <= 0) {
          d.state = 'go';
          d.t = 2.2 + Math.random() * 1.6;
        }
      } else if (d.t <= 0 && dist < 9 && dist > 2.2) {
        d.state = 'tele';
        d.t = 0.5;
        d.dx = ux;
        d.dz = uz;
        d.dashHit = false;
        g.emit('dashTele', { dog: d });
      }
      break;
    }
    case 'chat': {
      // menzilde kalıp laf atar
      if (dist > 6.5) { spd = d.speed; }
      else if (dist < 3.8) { mx = -ux; mz = -uz; spd = d.speed * 0.8; }
      else {
        const s = Math.sin(d.seed) > 0 ? 1 : -1;
        mx = -uz * s;
        mz = ux * s;
        spd = d.speed * 0.7;
      }
      d.t -= dt;
      if (d.t <= 0 && dist < 11) {
        d.t = 3.2 + Math.random() * 1.2;
        g.spawnBubble(d, ux, uz);
      }
      if (d.t < 0.6) d.status = 'chat';
      break;
    }
    default:
      break;
  }

  d.canBite = canBite.value;
  return { mx, mz, spd };
}

/** Isırma: kısa bir hazırlık (telgraf), sonra menzildeyse hasar. */
export function tryBite(d, g, dt) {
  if (d.attackCd > 0) d.attackCd -= dt;
  if (d.st.root > 0 || d.st.stun > 0 || d.st.fear > 0) { d.windup = 0; return false; }
  if (d.windup > 0) {
    d.windup -= dt;
    if (d.windup <= 0) {
      d.attackCd = 1.05;
      d.lunge = 0.25;
      if (d.dist < d.r + 0.95 && !g.player.dead && g.heroVisible) {
        g.hurtPlayer(d.dmg, d, { attack: true });
        if (d.type === 'chat') g.slowPlayer(1.6);
      }
    }
    return true;
  }
  if (d.canBite && d.attackCd <= 0 && d.dist < d.r + 0.6 && (d.status == null || d.status === 'taunt')) {
    d.windup = 0.3;
    g.emit('windup', { dog: d });
    return true;
  }
  return false;
}
