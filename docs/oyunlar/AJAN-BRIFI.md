# Ortak ajan brifi (geliştirme sırasında kullanıldı)

Bu dosya, paralel çalışan geliştirme ajanlarına verilen ortak kuralları kayıt altına alır.

- Proje: `/home/user/pureshot` — Vite 6 + vanilla JS (ES modülleri), three.js; arayüz dili Türkçe.
- Konu: Dota 2 yayıncısı CureShotKick için resmi olmayan hayran sitesi. Memler: “DOG DOG DOG” (biri kötü
  oynayınca/trollediğinde söylenir) ve “1vDOQUZ” (1v9 esprisi; her zaman tam olarak `1vDOQUZ` yazılır).
  Yayıncının en kısa yayını 24 saat. Ton: oyunbaz ve saygılı; kişileri değil hamleleri hedef al, küfür yok.
- Oyun modülü sözleşmesi: `export const meta = {…}` + `export function mount(el, ctx, nav)` → temizleme
  fonksiyonu. Ortak araçlar `src/sections/games/kit.js` (createRunner, gameLayout, hudStat, showOverlay,
  introCard, resultCard, submitResult, revealInView, isTyping, onOtherControl, memeText).
- Sitenin kısayolları (H Q W E R D F T Z) oyun oynarken `ctx.hotkeys(false)` ile kapatılır, çıkışta açılır.
- Yardımcılar: `h()` (src/core/dom.js), `icon()` (src/core/icons.js), `sound` (src/core/sound.js),
  `fx` (src/core/fx.js — alert/confirm/prompt yok), `store.me` (src/core/store.js).
- Veri: `src/data/heroes.js` (127 kahraman), portre/render: `heroPortraitUrl(id)`, `heroRenderUrl(id)`.
- Kısıtlar: 390 px mobil (dokunmatik, ≥44 px hedef, yatay taşma yok, alttaki sabit yetenek çubuğu),
  1440 px masaüstü, `prefers-reduced-motion`, çalışma anında dış ağ isteği yok, pano (clipboard) try/catch.
- Test: her ajan kendi portunda dev sunucusu + Playwright (HMR websocket engellenir), masaüstü ve mobil
  ekran görüntüsü, konsol hatası 0, yatay taşma yok. Git durumunu yalnızca entegrasyon değiştirir.
