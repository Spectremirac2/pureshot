// Profil verisi: dışa aktar (JSON yedek), içe aktar, sıfırla ve dosya indirme yardımcıları.
// Statik yayında (Netlify) bütün veriler bu tarayıcının localStorage’ındadır; anahtarlar `csk:` önekli.

import { h, ls, cleanText, copyText } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { store } from '../../core/store.js';
import { history } from '../../core/history.js';
import { fx } from '../../core/fx.js';

const PREFIX = 'csk:';
const BACKUP_KIND = 'cureshot-fan-karti';
// Yedeğe/geri yüklemeye girmeyenler: bu cihazın kimliği ve paylaşılan koleksiyon önbellekleri
const SKIP = (k) => k === 'local-fan-id' || k.startsWith('db:') || k === 'quests:snap';
const SAFE_KEY = /^[A-Za-z0-9:._-]{1,64}$/;

/** Sayfa bir çerçevede (iframe / Artifact) mı? İndirmeler orada engellenebilir. */
export function isFramed() {
  try { return window.self !== window.top; } catch { return true; }
}

/** Blob’u dosya olarak indirir. Başarısızsa false. */
export function downloadBlob(blob, filename) {
  try {
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename, style: 'display:none' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    return true;
  } catch {
    return false;
  }
}

export const dateStamp = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function siteKeys() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) out.push(k);
    }
  } catch { /* depolama kapalı */ }
  return out;
}

/** Yedek nesnesi: fan profili + deneme geçmişi + görev kaydı + diğer site ayarları. */
export function buildBackup() {
  const extra = {};
  for (const full of siteKeys()) {
    const k = full.slice(PREFIX.length);
    if (SKIP(k) || k === 'me' || k === 'hist') continue;
    const v = ls.get(k, undefined);
    if (v !== undefined) extra[k] = v;
  }
  return {
    kind: BACKUP_KIND,
    version: 1,
    exportedAt: new Date().toISOString(),
    site: 'https://cureshot-dog.netlify.app',
    me: store.me.get(),
    history: history.all(),
    extra,
  };
}

/** JSON yedeğini indirir; indirme engellenirse metni kopyalanabilir bir pencerede gösterir. */
export function exportData() {
  const text = JSON.stringify(buildBackup(), null, 2);
  const name = `dog-fan-karti-${dateStamp()}.json`;
  const ok = !isFramed() && downloadBlob(new Blob([text], { type: 'application/json' }), name);
  if (ok) {
    fx.toast(`Yedek indirildi: ${name}`, 'jade');
    return;
  }
  const area = h('textarea', { class: 'textarea pf-json', readonly: true, rows: '10', 'aria-label': 'Yedek (JSON)' });
  area.value = text;
  let close;
  close = fx.modal(h('div', { class: 'stack' },
    h('span', { class: 'eyebrow' }, 'Yedek'),
    h('h2', { class: 'h2' }, 'İndirme engellendi'),
    h('p', { class: 'small muted' }, 'Bu pencere dosya indirmeye izin vermiyor. Metni kopyalayıp bir .json dosyasına yapıştırabilirsin.'),
    area,
    h('div', { class: 'row', style: 'justify-content:flex-end' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => close() }, 'Kapat'),
      h('button', { class: 'btn primary', type: 'button', onclick: async () => {
        const done = await copyText(text, area);
        fx.toast(done ? 'Yedek panoya kopyalandı.' : 'Kopyalanamadı: metni seçip elle kopyala.', done ? 'jade' : 'blood');
      } }, icon('copy', { size: 18 }), 'Kopyala'),
    ),
  ), { label: 'Yedek' });
}

// ------------------------------------------------------------------ içe aktar
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

function cleanMe(me) {
  if (!me || typeof me !== 'object') return null;
  const out = { nick: cleanText(me.nick, 24) || 'Anonim', dog: finite(me.dog) ? Math.max(0, Math.floor(me.dog)) : 0, likes: {}, scores: {}, picks: {} };
  for (const k of Object.keys(me.likes || {}).slice(0, 5000)) if (SAFE_KEY.test(k)) out.likes[k] = 1;
  for (const [k, v] of Object.entries(me.scores || {})) if (SAFE_KEY.test(k) && finite(v)) out.scores[k] = v;
  for (const [k, v] of Object.entries(me.picks || {})) {
    if (!SAFE_KEY.test(k)) continue;
    if (typeof v === 'string') out.picks[k] = v.slice(0, 80);
    else if (finite(v) || typeof v === 'boolean') out.picks[k] = v;
  }
  return out;
}

function cleanHistory(hist) {
  const out = {};
  if (!hist || typeof hist !== 'object') return out;
  for (const [id, list] of Object.entries(hist)) {
    if (!SAFE_KEY.test(id) || !Array.isArray(list)) continue;
    const l = list.filter((e) => e && finite(e.s) && finite(e.t)).map((e) => ({ s: e.s, t: e.t })).slice(-20);
    if (l.length) out[id] = l;
  }
  return out;
}

/** Dosyayı okuyup doğrular: { me, history, extra } | hata fırlatır. */
export async function readBackup(file) {
  if (!file) throw new Error('Dosya seçilmedi.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Dosya çok büyük (en fazla 2 MB).');
  let data;
  try { data = JSON.parse(await file.text()); } catch { throw new Error('Bu dosya geçerli bir JSON değil.'); }
  if (!data || typeof data !== 'object' || data.kind !== BACKUP_KIND) throw new Error('Bu dosya bir Fan Kartı yedeği değil.');
  const me = cleanMe(data.me);
  if (!me) throw new Error('Yedekte profil bulunamadı.');
  const extra = {};
  for (const [k, v] of Object.entries(data.extra || {})) if (SAFE_KEY.test(k) && !SKIP(k) && k !== 'me' && k !== 'hist') extra[k] = v;
  return { me, history: cleanHistory(data.history), extra, exportedAt: data.exportedAt || null };
}

/** Yedeği bu cihaza yazar ve sayfayı yeniler (yazılanlar sayfa kapanırken yeniden uygulanır). */
export function applyBackup(b) {
  const write = () => {
    for (const [k, v] of Object.entries(b.extra)) ls.set(k, v);
    ls.set('me', b.me);
    ls.set('hist', b.history);
    ls.remove('quests:snap');
  };
  write();
  // store, kapanırken bekleyen profil yazımını yapabilir: bizimkiler en son yazılsın
  window.addEventListener('pagehide', write);
  try { sessionStorage.setItem('csk-flash', 'import'); } catch { /* yok say */ }
  location.reload();
}

// ------------------------------------------------------------------ sıfırla
/** Yalnızca bu sitenin (csk:) anahtarlarını siler ve sayfayı yeniler. */
export function resetData() {
  const wipe = () => { for (const k of siteKeys()) { try { localStorage.removeItem(k); } catch { /* yok say */ } } };
  wipe();
  // store kapanırken bekleyen yazımı yapar (csk:db:fans): ondan sonra bir kez daha temizle
  window.addEventListener('pagehide', wipe);
  try { sessionStorage.setItem('csk-flash', 'reset'); } catch { /* yok say */ }
  location.reload();
}

/** Bu sitenin localStorage’da kapladığı yaklaşık alan (bayt) ve anahtar sayısı. */
export function storageUsage() {
  let bytes = 0;
  const keys = siteKeys();
  for (const k of keys) {
    try { bytes += (k.length + (localStorage.getItem(k) || '').length) * 2; } catch { /* yok say */ }
  }
  return { keys: keys.length, bytes };
}
