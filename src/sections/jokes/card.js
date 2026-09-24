// Espri kartı: metnin biçimine göre (düz, SON DAKİKA manşeti, sözlük tanımı, chat kaydı, rapor)
// farklı tipografiyle çizer. Kullanıcı metni her zaman textNode olarak basılır (h() çocukları).

import { h, timeAgo, fmtNum } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { JOKE_CATEGORIES } from '../../data/jokes.js';

export const CAT_META = {
  dog: { icon: 'paw', short: 'DOG DOG DOG' },
  '1v9': { icon: 'bow', short: '1vDOQUZ' },
  maraton: { icon: 'hourglass', short: 'Maraton' },
  pub: { icon: 'swords', short: 'Pub' },
  hero: { icon: 'mask', short: 'Kahraman' },
  chat: { icon: 'chat', short: 'Chat' },
  mmr: { icon: 'crown', short: 'MMR' },
};
export const catLabel = (id) => (JOKE_CATEGORIES.find((c) => c.id === id) || JOKE_CATEGORIES[0]).label;
export const validCat = (id) => (CAT_META[id] ? id : 'dog');

// ---------------------------------------------------------------- arama normalizasyonu
const FOLD = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u', '’': "'", '‘': "'", '“': '"', '”': '"' };
/** Türkçe duyarlı, uzunluğu koruyan sadeleştirme (arama ve vurgulama için). */
export function fold(s) {
  const low = String(s || '').toLocaleLowerCase('tr-TR');
  let out = '';
  for (const ch of low) out += FOLD[ch] || ch;
  return out;
}

/** Metni arama vurgusuyla (mark) parçalara böler. */
function marked(text, q) {
  if (!q) return [text];
  const f = fold(text);
  if (f.length !== text.length) return [text];
  const out = [];
  let i = 0;
  for (;;) {
    const j = f.indexOf(q, i);
    if (j < 0) break;
    if (j > i) out.push(text.slice(i, j));
    out.push(h('mark', { class: 'jk-mark' }, text.slice(j, j + q.length)));
    i = j + q.length;
  }
  if (i < text.length) out.push(text.slice(i));
  return out;
}

const MEME_RE = /(DOG DOG DOG(?: DOG)?|1vDOQUZ|1vON)/g;
/** Meme kalıplarını (DOG DOG DOG, 1vDOQUZ) renkli vurgular; aramayı işaretler. */
export function rich(text, q) {
  const parts = String(text).split(MEME_RE);
  return parts.map((p, i) => {
    if (!p) return null;
    if (i % 2 === 1) return h('span', { class: p.startsWith('DOG') ? 'jk-meme' : 'jk-meme gold' }, marked(p, q));
    return marked(p, q);
  });
}

// ---------------------------------------------------------------- biçim ayrıştırma
export function parseJoke(text) {
  const t = String(text || '').trim();
  const lines = t.split('\n').map((s) => s.trim()).filter(Boolean);
  const head = t.match(/^SON DAKİKA[:!]\s*([\s\S]*)$/);
  if (head) return { kind: 'headline', body: head[1] };
  if (lines.length <= 1) {
    let m = t.match(/^(?:(.{2,40}?) — )?([^:\n()]{1,40}?)\s*\(([^)]{2,20})\):\s*(.+)$/);
    if (m) return { kind: 'dict', label: m[1] || null, head: m[2], pos: m[3], def: m[4] };
    m = t.match(/^(.{2,40}?) — (.{1,40}?):\s*(.+)$/);
    if (m) return { kind: 'dict', label: m[1], head: m[2], pos: null, def: m[3] };
    return { kind: 'plain', body: t };
  }
  const rows = lines.map((line) => {
    if (/^—\s?/.test(line)) return { type: 'voice', text: line.replace(/^—\s?/, '') };
    const n = line.match(/^(\d{1,2})[.)]\s+(.*)$/);
    if (n) return { type: 'step', n: n[1], text: n[2] };
    const m = line.match(/^([^:“”"]{1,44}):\s+(.*)$/);
    if (m) return { type: 'line', who: m[1], text: m[2] };
    return { type: 'note', text: line };
  });
  let title = null;
  if (rows[0].type === 'note' && rows.length > 1) title = rows.shift().text;
  const lineRows = rows.filter((r) => r.type === 'line');
  const quoted = lineRows.filter((r) => /^[“"]/.test(r.text)).length;
  const report = rows.length >= 3 && lineRows.length === rows.length && quoted <= 1 && rows.every((r) => r.text.length <= 60);
  return { kind: 'log', title, rows, report };
}

const TONES = { chat: 'ember', rakip: 'dire', takım: 'jade', replay: 'gold', jüri: 'gold', sonuç: 'gold', not: 'gold' };
function toneOf(who) {
  const key = who.toLocaleLowerCase('tr-TR').split(/[ ,(]/)[0];
  if (TONES[key]) return TONES[key];
  const list = ['arcane', 'jade', 'gold', 'ember', 'sky'];
  let s = 0;
  for (const ch of who) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return list[s % list.length];
}

/** Espri gövdesi (biçime göre). size: 'sm' | 'md' | 'lg' */
export function jokeBody(text, { q = '', size = 'md' } = {}) {
  const p = parseJoke(text);
  const len = String(text).length;
  if (p.kind === 'headline') {
    return h('div', { class: `jk-body jk-headline size-${size}` },
      h('span', { class: 'jk-headline-tag' }, h('span', { class: 'jk-headline-dot', 'aria-hidden': 'true' }), 'SON DAKİKA'),
      h('p', { class: 'jk-headline-text' }, rich(p.body, q)),
    );
  }
  if (p.kind === 'dict') {
    return h('div', { class: `jk-body jk-dict size-${size}` },
      p.label ? h('span', { class: 'jk-dict-label' }, rich(p.label, q)) : null,
      h('p', { class: 'jk-dict-head' }, rich(p.head, q), p.pos ? h('span', { class: 'jk-dict-pos' }, ` (${p.pos})`) : null),
      h('p', { class: 'jk-dict-def' }, rich(p.def, q)),
    );
  }
  if (p.kind === 'log') {
    return h('div', { class: `jk-body jk-log size-${size}${p.report ? ' is-report' : ''}` },
      p.title ? h('p', { class: 'jk-log-title' }, rich(p.title, q)) : null,
      p.rows.map((r) => {
        if (r.type === 'voice') return h('p', { class: 'jk-voice' }, rich(r.text, q));
        if (r.type === 'step') return h('p', { class: 'jk-step' }, h('span', { class: 'jk-step-n num' }, r.n), h('span', null, rich(r.text, q)));
        if (r.type === 'note') return h('p', { class: 'jk-note' }, rich(r.text, q));
        return h('p', { class: 'jk-line' },
          h('span', { class: 'jk-who', dataset: { tone: toneOf(r.who) } }, rich(r.who, q), p.report ? null : ':'),
          ' ',
          h('span', { class: 'jk-said' }, rich(r.text, q)),
        );
      }),
    );
  }
  const band = len <= 90 ? 'is-short' : len <= 180 ? 'is-mid' : 'is-long';
  return h('div', { class: `jk-body jk-plain ${band} size-${size}` }, h('p', null, rich(p.body, q)));
}

/** Kategori yuvası: küçük bir chat wheel dilimi + ikon. */
export function catSlot(cat, size = 16) {
  const meta = CAT_META[validCat(cat)];
  return h('span', { class: 'jk-slot', 'aria-hidden': 'true' }, icon(meta.icon, { size, stroke: 2 }));
}

/**
 * Kart. opts:
 *  kind: 'legend' | 'community' | 'gen'
 *  likeKey, threadId  (legend/community için)
 *  q: arama sorgusu (fold edilmiş)
 *  nick, createdAt, src (community)
 *  canDelete (community), size
 *  tagText: sağ üstte gösterilecek kısa etiket (#dog-001)
 */
export function jokeCard(joke, opts = {}) {
  const cat = validCat(joke.cat);
  const kind = opts.kind || 'legend';
  const meta = CAT_META[cat];
  const headRight = kind === 'community'
    ? h('span', { class: 'jk-byline' },
      h('span', { class: 'jk-nick' }, opts.nick || 'Anonim'),
      opts.createdAt ? h('span', { class: 'jk-when' }, timeAgo(opts.createdAt)) : null,
      opts.src === 'makine' ? h('span', { class: 'badge gold jk-src' }, 'Makine') : null)
    : h('span', { class: 'jk-tag mono' }, opts.tagText || '');

  const actions = [];
  if (opts.likeKey) {
    actions.push(
      h('button', { class: 'jk-act jk-like', type: 'button', dataset: { act: 'like' }, 'aria-pressed': 'false', title: 'DOG’la (beğen)' },
        icon('paw', { size: 18, stroke: 2 }),
        h('span', { class: 'jk-act-label' }, 'DOG’la'),
        h('span', { class: 'num jk-like-n' }, ''),
      ),
    );
  }
  if (opts.threadId) {
    actions.push(
      h('button', { class: 'jk-act jk-cmt', type: 'button', dataset: { act: 'comments' }, title: 'Yorumlar' },
        icon('chat', { size: 18 }),
        h('span', { class: 'jk-act-label' }, 'Yorumlar'),
        h('span', { class: 'num jk-cmt-n' }, ''),
      ),
    );
  }
  if (kind === 'gen') {
    actions.push(
      h('button', { class: 'jk-act jk-post', type: 'button', dataset: { act: 'post' }, title: 'Topluluk Duvarı’na gönder' },
        icon('send', { size: 17 }), h('span', { class: 'jk-act-label' }, 'Duvara as'),
      ),
    );
  }
  actions.push(h('span', { class: 'spacer' }));
  actions.push(
    h('button', { class: 'jk-act jk-icon', type: 'button', dataset: { act: 'copy' }, 'aria-label': 'Espriyi kopyala', title: 'Kopyala' }, icon('copy', { size: 17 })),
  );
  if (opts.canDelete) {
    actions.push(
      h('button', { class: 'jk-act jk-icon jk-del', type: 'button', dataset: { act: 'delete' }, 'aria-label': 'Espriyi sil', title: 'Sil' }, icon('trash', { size: 17 })),
    );
  }

  const el = h('article', {
    class: `jk-card jk-card--${kind}${opts.extraClass ? ' ' + opts.extraClass : ''}`,
    dataset: { jkcat: cat, ...(opts.likeKey ? { likeKey: opts.likeKey } : {}), ...(opts.threadId ? { thread: opts.threadId } : {}), ...(opts.docId ? { doc: opts.docId } : {}) },
  },
  h('header', { class: 'jk-card-head' },
    catSlot(cat),
    h('span', { class: 'jk-cat' }, meta.short),
    h('span', { class: 'spacer' }),
    headRight,
  ),
  jokeBody(joke.text, { q: opts.q, size: opts.size || 'md' }),
  h('footer', { class: 'jk-actions' }, actions),
  );
  return el;
}

/** Kart üzerindeki sayaçları günceller. */
export function paintCounts(card, { likes = 0, liked = false, comments = 0 } = {}) {
  const lb = card.querySelector('.jk-like');
  if (lb) {
    lb.setAttribute('aria-pressed', String(liked));
    lb.classList.toggle('on', liked);
    const n = lb.querySelector('.jk-like-n');
    if (n) n.textContent = likes ? fmtNum(likes) : '';
  }
  const cn = card.querySelector('.jk-cmt-n');
  if (cn) cn.textContent = comments ? fmtNum(comments) : '';
}
