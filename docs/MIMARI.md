# Mimari

Sitenin nasıl kurulduğunu ve yeni bir bölüm, oyun ya da varlık eklerken nelere dikkat edileceğini anlatır.
Kurulum ve yayınlama adımları için bkz. [README](../README.md).

## Genel bakış

```
index.html ─► src/main.js ─► core/shell.js (HUD, yetenek çubuğu, hash yönlendirici)
                                   │
                                   ├─ core/routes.js      bölüm tablosu (H Q W E R D F T Z)
                                   ├─ core/store.js       veri katmanı (Artifact db · REST API · localStorage)
                                   ├─ core/fx.js          toast, modal, damga, konfeti
                                   ├─ core/sound.js       WebAudio efektleri (dosya yok)
                                   ├─ core/tour.js        ilk giriş turu, yardım paneli (?)
                                   ├─ core/history.js     deneme geçmişi (her submitScore)
                                   ├─ core/badges.js      rozetler (skorlardan türetilir)
                                   ├─ core/quests.js      günlük görevler, XP ve seviye
                                   ├─ core/assets.js      fal.ai görselleri/modeller, kahraman portreleri, yetenek ikonları
                                   └─ sections/<bölüm>/   her bölüm kendi JS + CSS'i (dinamik import)
```

Framework yok: DOM, `core/dom.js` içindeki `h()` yardımcısıyla kurulur (SVG etiketleri de desteklenir).
Tasarım sistemi `src/styles/` altındadır (`tokens.css` renk/tipografi belirteçleri, `components.css` düğme,
panel, çip, rozet vb.).

## Yönlendirme ve bölüm sözleşmesi

Adresler `#bolum` ya da `#bolum--alt` biçimindedir (claude.ai Artifact yalnızca `[A-Za-z0-9._~-]` iletir).
Her bölüm şu arayüzü dışa aktarır:

```js
export default {
  mount(el, ctx) { /* … */ return () => { /* temizlik */ }; },
  onSub(sub) { /* aynı bölümde alt sayfa değişti */ },
};
```

`ctx = { section, sub, store, sound, fx, go(section, sub), setSub(sub, { push }), hotkeys(bool) }`.
Kısayol tuşları yazı alanlarında, açık modalda ve `ctx.hotkeys(false)` çağrıldığında devre dışıdır — klavye
kullanan oyunlar oynarken kısayolları kapatır, çıkışta açar.

## Rehber, profil, görevler

- **İlk giriş turu** (`core/tour.js`): ilk ziyarette HUD ve yetenek çubuğunu adım adım tanıtır; `?` yardım
  paneli, ad çipi menüsü ve `#tur` / `#yardim` bağlantılarıyla tekrar açılır. Ayrıntı: [REHBER.md](REHBER.md).
- **Profil** (`#profil`, çubukta slotu olmayan gizli rota): Fan Kartı, rekorlar, rozetler, görevler.
  Ayrıntı: [PROFIL.md](PROFIL.md).
- **Deneme geçmişi** (`core/history.js`): `store.me.submitScore` her çağrıldığında deneme tarihiyle kaydedilir;
  günlük görevler, profil grafikleri ve statik moddaki kişisel skor tabloları bunu okur.
- `main.js` açılışta rozet ve görev izleyicilerini kurar; bildirimler hangi bölümde olunursa olunsun çıkar.

## Veri katmanı (`core/store.js`)

Üç arka uç, aynı API:

| Arka uç | Ne zaman | Paylaşım |
|---|---|---|
| claude.ai Artifact `db` | Artifact içinde çalışırken | Artifact'i açan herkes |
| REST API (`server/worker.js`, Cloudflare Worker + D1) | `/api` yanıt verirse | Siteyi açan herkes |
| localStorage | Statik yayın (`VITE_API_BASE=none`) | Yalnızca o tarayıcı |

Koleksiyonlar (espriler, yorumlar, sorular…) `store.subscribe/add/set/update/remove` ile; ziyaretçinin
kendi profili (`fans/<uid>`: takma ad, DOG sayısı, beğeniler, skorlar, quiz seçimleri) `store.me` ile yönetilir.
Skor tabloları ve toplam DOG sayacı profillerden `agg` yardımcılarıyla hesaplanır. Netlify'daki yayın
statik moddadır: yayında trol riski yoktur, her ziyaretçinin verisi kendi tarayıcısındadır.

## Oyun kiti (`sections/games/kit.js`)

Her oyun `export const meta` + `export function mount(el, ctx, nav)` sunar ve `games.js` içindeki `GAMES`
listesine kaydedilir. Kit şunları sağlar:

- `gameLayout` — başlık, HUD, sahne, yan sütun (skor tablosu, nasıl oynanır, diğer oyunlar)
- `createRunner` — görünürlüğe duyarlı oyun saati (sekme gizlenince oyun zamanı durur)
- `introCard`, `resultCard`, `submitResult`, `showOverlay`, `revealInView`, `hudStat`
- `isTyping`, `onOtherControl` — klavye olaylarının doğru yere gitmesi

Skorlar `store.me.submitScore(id, skor, yüksekİyi)` ile profile yazılır; rozetler (`core/badges.js`)
bu skorlardan türetilir. Oyun tasarımları: [OYUNLAR.md](OYUNLAR.md).

## Varlık hatları

| Varlık | Kaynak | Betik | Çıktı |
|---|---|---|---|
| Afişler, DOG portreleri, 3D modeller | fal.ai (derleme anında üretildi) | `npm run fetch:fal`, `npm run optimize:assets` | `src/assets/fal/` |
| Kahraman portreleri ve renderları | Dota 2 CDN (Valve) | `npm run fetch:heroes` | `src/assets/heroes/{portraits,renders}/` |
| 3D halka portre atlası | kahraman portreleri | `npm run build:atlas` | `src/assets/heroes/atlas/` |
| Yetenek adları ve ikonları | dota2.com datafeed + CDN | `npm run fetch:abilities` | `src/data/abilities.js`, `src/assets/abilities/heroes/` |
| Invoker/Pudge oyun ikonları | Dota 2 CDN | `npm run fetch:game-icons` | `src/assets/abilities/{invoker,pudge}/` |
| Eşya ikonları (Eşya 2048) | Dota 2 CDN | `npm run fetch:items` | `src/assets/items/` |
| Alt küme fontlar | `@fontsource` woff2 | `npm run build:fonts` (fonttools gerekir) | `src/assets/fonts/`, `src/styles/fonts.css` |
| Paylaşım görseli, ikonlar | keyart + site fontları | `npm run build:share` | `public/` |

Ağ isteği gerektiren betikler bu ortamda `NODE_USE_ENV_PROXY=1` ile çalıştırılır. Çalışma anında hiçbir dış
kaynağa istek atılmaz; tüm varlıklar siteyle birlikte sunulur. Kahraman ve yetenek görselleri JS'e hiçbir
zaman gömülmez (yalnızca görüntülendiklerinde iner).

## Derleme kipleri

| Kip | Komut | Kullanım | Çıktı |
|---|---|---|---|
| Statik (varsayılan) | `npm run build:static` | Netlify, GitHub Pages | Bölüm parçaları, ayrı `three` parçası, hash'li adlar, ayrı fontlar |
| Artifact | `npm run build` | claude.ai Artifact | Tek `assets/app.js` + `assets/app.css`, fontlar gömülü, `dist/artifact.html` |

Netlify `/assets/*` dosyalarını bir yıl `immutable` önbellekte tutar (adlar içerik hash'i taşır).
Ayrıntılı ölçümler: [OPTIMIZASYON.md](OPTIMIZASYON.md).

## Yeni oyun eklemek

1. `src/sections/games/<id>.js` (+ `<id>.css`): `meta` ve `mount` dışa aktar; kiti kullan.
2. `games.js` içinde içe aktar, `GAMES` ve `MODS` listelerine ekle, kategorisini belirle.
3. Klavye kullanıyorsa oynarken `ctx.hotkeys(false)`; temizlikte tüm dinleyici ve zamanlayıcıları kaldır.
4. Rozet eşiği gerekiyorsa `core/badges.js` tablosuna ekle.
5. `docs/oyunlar/<id>.md` yaz; masaüstü (1440) ve mobil (390) test et.
