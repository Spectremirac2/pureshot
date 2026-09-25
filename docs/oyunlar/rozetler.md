# Rozetler (başarımlar)

**Dosya:** `src/core/badges.js` · **Arayüz:** Oyun Salonu → Rozetler paneli (`#oyunlar--rozetler`), ana sayfa
"Oyun Salonu’nda yeni" bölümündeki kompakt rozet kartı.

Rozetler ayrı bir kayıt tutmaz: hepsi ziyaretçinin profilinden (`store.me`: `scores`, `picks`, `likes`,
`dog`) anında türetilir. Böylece paylaşılan arka uçta başka cihazda kazanılan skorlar da rozeti açar.
Tüm eşikler `THRESHOLDS` tablosundadır; bir oyunun puanlaması değişirse yalnızca oradaki sayı değişir.

## API

```js
import { BADGES, earnedBadges, earnedSet, badgeProgress, badgeHref, watchBadges, ensureBadgeWatcher } from './core/badges.js';
earnedBadges(me)            // kazanılmış rozet nesneleri (tablo sırasıyla)
badgeProgress(badge, me)    // kilitli rozet: { pct: 0–1 | null, text: 'En iyin: 540 puan' } | null
watchBadges(store, onNew)   // sayfa açıldıktan SONRA kazanılanlar için onNew([rozet]); kapatma fn döner
ensureBadgeWatcher()        // küresel tekil izleyici: bildirim (fx.toast) + kısa ses (sound.coin)
```

- Taban çizgisi `store.ready` sonrası alınır: paylaşılan arka uçtan birleşen eski skorlar ya da sayfa
  açılışında zaten kazanılmış rozetler bildirim üretmez.
- Birden çok rozet aynı anda açılırsa ~0,9 sn arayla sırayla bildirilir; ilki sonuç kartı/konfetiyle
  çakışmasın diye ~1,1 sn gecikir. Bildirim tıklamaları geçirir (düğmelerin üstüne düşse de engellemez).
- **Bağlama:** `ensureBadgeWatcher()` şu an `games.js` ve `home.js` modül yüklenirken çağrılır (ikincisi
  etkisiz). Doğrudan `#quizler` ya da `#kahramanlar` ile açılan bir oturumda izleyici, ziyaretçi Üs'e ya da
  Salon'a gelene kadar başlamaz. Her sayfada bildirim için kabukta bir kez çağırmak yeter
  (`main.js` ya da `shell.js`: `import { ensureBadgeWatcher } from './core/badges.js'; ensureBadgeWatcher();`).

## Rozet tablosu

| # | Rozet | Grup | Koşul | Eşik (`THRESHOLDS`) |
|---|---|---|---|---|
| 1 | İlk Kan | Salon | Salondaki herhangi bir oyunda skor | 1 oyun |
| 2 | Salon Müdavimi | Salon | Farklı oyunlarda skor | `mudavim` = 5 |
| 3 | Aegis Sahibi | Salon | Salondaki 10 oyunun hepsinde skor | `SALON_IDS.length` |
| 4 | 1vDOQUZ | Oyun | Arena ≥ 1.200 puan (≈ ilk dalga: 9 DOG × 100 + 300 dalga bonusu) | `arena` = 1200 |
| 5 | Arena Efsanesi | Oyun | Arena ≥ 6.000 puan (≈ 3–4 dalga) | `arenaEfsane` = 6000 |
| 6 | Report Makinesi | Oyun | DOG Avı ≥ 800 puan | `dogavi` = 800 |
| 7 | Last Hit Tanrısı | Oyun | Last Hit ≥ 550 altın (≈ 13 last hit) | `lasthit` = 550 |
| 8 | Hafıza Kralı | Oyun | DOG Hafıza ≥ 600 puan (4×4 masa; ≈ 14 hamle, 24 sn) | `hafiza` = 600 |
| 9 | Refleks Canavarı | Oyun | Rune ortalaması ≤ 300 ms (düşük iyi) | `rune` = 300 |
| 10 | Günlük Dedektif | Oyun | DOGdle'da herhangi bir skor | — |
| 11 | Tek Atış | Oyun | DOGdle ≤ 2 tahmin (düşük iyi) | `dogdleSharp` = 2 |
| 12 | Portre Uzmanı | Oyun | Portre Avı ≥ 3.000 puan (10 tur × 100–500, seri ×2'ye kadar) | `portre` = 3000 |
| 13 | Invoker Çırağı | Oyun | Invoker Kombo ≥ 15 büyü (60 sn) | `invoker` = 15 |
| 14 | Kanca Ustası | Oyun | Pudge Hook ≥ 1.500 puan | `hook` = 1500 |
| 15 | Bingo! | Oyun | DOG Bingo ≥ 1 çizgi | `bingo` = 1 |
| 16 | Teşhis Kondu | Quiz | "Hangi DOG’sun?" sonucu (`picks.hangidog`) | — |
| 17 | Gerçek Hayran | Quiz | Gerçek Hayran Testi ≥ 10/12 | `hayran` = 10 |
| 18 | Bilgi Küpü | Quiz | Bilgi Yarışması ≥ 1.200 puan (10 × 100 + hız bonusu) | `bilgi` = 1200 |
| 19 | Yetenek Avcısı | Quiz | Yetenek Avı quizinde herhangi bir skor (`scores.yetenek`) | — |
| 20 | Endeks Uzmanı | Quiz | Kahramanlar → "Daha DOG mu?" serisi ≥ 10 | `daha` = 10 |
| 21 | DOG DOG DOG | Topluluk | DOG düğmesine 3 kez bas (üç kez söylenir) | `dog` = 3 |
| 22 | 24 Saat Ruhu | Topluluk | DOG düğmesine 24 kez bas (en kısa yayın kadar) | `maraton` = 24 |
| 23 | Espri Eleştirmeni | Topluluk | 10 espriyi DOG'la (`likes['jk:*']`) | `critic` = 10 |

Oyun rozetleri tıklanınca ilgili oyunu açar; quiz/topluluk rozetleri kendi bölümüne gider (`badgeHref`).
Salon kataloğu `SALON_GAMES` (id, ad, simge, renk, "yeni") da bu dosyadadır: ana sayfa oyun modüllerini
içe aktarmadan vitrin çizebilsin diye.

## Görünüm
- **Salon paneli:** ızgara (masaüstü 5 sütun, mobil 2), kazanılanlar önce. Kilitli rozet soluk, altıgen
  simgede kilit; açıklamada ne yapılacağı ve varsa ilerleme çubuğu/metni ("En iyin: 540 puan", "4/5 oyun").
  Mobilde ilk 6 rozet + "Tümünü göster (23)".
- **Ana sayfa kartı:** `8/23`, ilerleme çubuğu, son kazanılan 7 rozetin simgesi (kalanlar kilit),
  "Sıradaki:" en yakın kilitli rozet (ilerleme oranı en yüksek olan) ve "Tüm rozetler" bağlantısı.
