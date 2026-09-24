// Skor tablosu: fan belgelerindeki scores[gameId] değerlerinden canlı sıralama.
//   mountLeaderboard(el, { gameId: 'arena', title: 'Arena Efsaneleri', higherIsBetter: true, format: (n) => n + ' puan' })

import { h, clear, fmtNum } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { store, agg } from '../core/store.js';

export function mountLeaderboard(el, { gameId, title = 'Skor Tablosu', higherIsBetter = true, format = (n) => fmtNum(n), limit = 10 } = {}) {
  const body = h('ol', { class: 'lb-list' });
  const note = h('p', { class: 'xsmall dim' });
  const root = h('section', { class: 'panel tight lb', 'aria-label': title },
    h('div', { class: 'panel-head' }, h('h3', { class: 'h3 row' }, icon('trophy', { size: 18 }), title)),
    body,
    note,
  );
  el.appendChild(root);

  const unsub = store.fans((fans) => {
    const rows = agg.leaderboard(fans, gameId, limit, higherIsBetter);
    const me = store.uid() || 'me';
    clear(body);
    if (!rows.length) {
      body.appendChild(h('li', { class: 'empty small' }, 'Henüz skor yok. İlk sen yaz.'));
    }
    rows.forEach((r, i) => {
      body.appendChild(
        h('li', { class: `lb-row${r.id === me ? ' me' : ''}` },
          h('span', { class: `lb-rank num${i < 3 ? ' top' : ''}` }, String(i + 1)),
          h('span', { class: 'lb-nick' }, r.nick),
          h('span', { class: 'lb-score num' }, format(r.score)),
        ),
      );
    });
    note.textContent = store.shared ? '' : 'Önizleme modu: skorlar bu cihazda tutuluyor.';
  });

  return () => { unsub(); root.remove(); };
}
