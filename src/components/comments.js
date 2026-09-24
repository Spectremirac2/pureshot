// Yeniden kullanılabilir yorum sistemi. Her konu (thread) için ayrı akış:
//   mountComments(el, { threadId: 'joke:abc', title: 'Yorumlar', placeholder: '...' }) → destroy()
// Yorumlar store 'comments' koleksiyonunda { thread, text, nick, authorId, createdAt } olarak tutulur.
// Beğeniler ziyaretçinin fan belgesinde likes['c:<yorumId>'] olarak saklanır.

import { h, clear, timeAgo, cleanText, softFilter, fmtNum } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { store, agg } from '../core/store.js';
import { fx } from '../core/fx.js';
import { sound } from '../core/sound.js';
import { openNickEditor } from '../core/shell.js';

const MAX = 400;
let lastPostAt = 0;

export function mountComments(el, { threadId, title = 'Yorumlar', placeholder = 'Bir şey yaz… (DOG serbest)', compact = false, limit = 100 } = {}) {
  const safeId = threadId.replace(/[^A-Za-z0-9_-]/g, '_');
  const inputId = `cmt-${safeId}`;
  let docs = [];
  let likes = {};

  const countEl = h('span', { class: 'badge' }, '0');
  const listEl = h('ol', { class: 'cmt-list', 'aria-live': 'polite' });
  const nickEl = h('button', { class: 'chip', type: 'button', title: 'Takma adını değiştir', onclick: openNickEditor }, icon('user', { size: 14 }), h('span', null, store.me.get().nick));
  const ta = h('textarea', { class: 'textarea', id: inputId, maxlength: String(MAX), rows: compact ? '2' : '3', placeholder });
  const counter = h('span', { class: 'counter' }, `0/${MAX}`);
  const sendBtn = h('button', { class: 'btn primary sm', type: 'submit' }, icon('send', { size: 16 }), 'Gönder');
  const note = h('p', { class: 'hint', hidden: true });

  const form = h('form', { class: 'cmt-form', autocomplete: 'off' },
    h('label', { class: 'sr-only', for: inputId }, 'Yorumun'),
    ta,
    h('div', { class: 'row cmt-form-foot' }, h('span', { class: 'xsmall dim' }, 'Yazan:'), nickEl, h('span', { class: 'spacer' }), counter, sendBtn),
    note,
  );

  ta.addEventListener('input', () => {
    const n = ta.value.length;
    counter.textContent = `${n}/${MAX}`;
    counter.classList.toggle('over', n > MAX);
  });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = softFilter(cleanText(ta.value, MAX));
    if (text.length < 2) { fx.toast('Biraz daha yaz, bu kadarı ward bile değil.', 'blood'); return; }
    if (Date.now() - lastPostAt < 5000) { fx.toast('Biraz yavaş: 5 saniyede bir yorum.', 'blood'); return; }
    sendBtn.disabled = true;
    try {
      await store.add('comments', { thread: threadId, text });
      lastPostAt = Date.now();
      ta.value = '';
      counter.textContent = `0/${MAX}`;
      sound.good();
      fx.toast('Yorumun eklendi.', 'jade');
    } catch (err) {
      console.error(err);
      fx.toast(err && err.code === 'quota_exceeded' ? 'Veritabanı dolu; eski yorumlar silinmeden yenisi eklenemiyor.' : 'Yorum gönderilemedi. Bağlantını kontrol edip tekrar dene.', 'blood');
    } finally {
      sendBtn.disabled = false;
    }
  });

  const unsubMe = store.me.subscribe((d) => { nickEl.lastChild.textContent = d.nick || 'Anonim'; });

  function render() {
    countEl.textContent = fmtNum(docs.length);
    clear(listEl);
    if (!docs.length) {
      listEl.appendChild(h('li', { class: 'empty small' }, 'Henüz yorum yok. İlk DOG’u sen at.'));
      return;
    }
    const me = store.uid();
    const mine = store.me.get().likes || {};
    for (const c of docs) {
      const likeKey = 'c:' + c.id;
      const liked = !!mine[likeKey];
      const n = likes[likeKey] || 0;
      const likeBtn = h('button', { class: `cmt-like${liked ? ' on' : ''}`, type: 'button', 'aria-pressed': String(liked), title: 'DOG’la (beğen)' },
        icon('paw', { size: 14 }), h('span', { class: 'num' }, n ? fmtNum(n) : ''),
      );
      likeBtn.addEventListener('click', () => {
        const on = store.me.toggleLike(likeKey);
        if (on) sound.bark(1.2);
        render();
      });
      const canDelete = (me && c.authorId === me) || store.isModerator();
      const delBtn = canDelete
        ? h('button', { class: 'cmt-del', type: 'button', title: 'Sil', 'aria-label': 'Yorumu sil' }, icon('trash', { size: 14 }))
        : null;
      if (delBtn) {
        delBtn.addEventListener('click', async () => {
          const ok = await fx.confirm('Bu yorum silinsin mi?', { ok: 'Sil', danger: true });
          if (!ok) return;
          try { await store.remove('comments', c.id); fx.toast('Silindi.'); } catch { fx.toast('Silinemedi.', 'blood'); }
        });
      }
      listEl.appendChild(
        h('li', { class: 'cmt' },
          h('div', { class: 'cmt-head' },
            h('span', { class: 'cmt-nick' }, c.nick || 'Anonim'),
            h('span', { class: 'xsmall dim' }, timeAgo(c.createdAt)),
            h('span', { class: 'spacer' }),
            likeBtn,
            delBtn,
          ),
          h('p', { class: 'cmt-text' }, c.text || ''),
        ),
      );
    }
  }

  const unsubList = store.subscribe(
    'comments',
    { where: ['thread', threadId], orderBy: 'createdAt', dir: 'desc', limit },
    (d) => { docs = d; render(); },
    () => { note.hidden = false; note.textContent = 'Yorumlar şu an yüklenemiyor.'; },
  );
  const unsubFans = store.fans((fans) => { likes = agg.likeCounts(fans); render(); });

  store.ready.then(() => {
    if (!store.canWrite()) {
      ta.disabled = true;
      sendBtn.disabled = true;
      note.hidden = false;
      note.textContent = 'Bu sayfayı yalnızca görüntüleyebiliyorsun; yorum yazma izni yok.';
    } else if (!store.shared) {
      note.hidden = false;
      note.textContent = 'Önizleme modu: yorumlar şimdilik yalnızca bu cihazda saklanıyor.';
    }
  });

  const root = h('section', { class: `cmt-box${compact ? ' compact' : ''}`, 'aria-label': title },
    h('div', { class: 'panel-head' }, h('h3', { class: 'h3' }, title, ' ', countEl)),
    form,
    listEl,
  );
  el.appendChild(root);
  render();

  return () => {
    unsubList();
    unsubFans();
    unsubMe();
    root.remove();
  };
}
