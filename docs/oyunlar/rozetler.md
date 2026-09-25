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
- **Bağlama:** `ensureBadgeWatcher()` `main.js`'te uygulama açılışında çağrılır (her bölümde bildirim);
  `games.js` ve `home.js`'teki çağrılar etkisizdir.

## Rozet tablosu

31 rozet (Salon 3 · Oyunlar 20 · Quizler 5 · Topluluk 3).

| # | Rozet | Grup | Koşul | Eşik (`THRESHOLDS`) |
|---|---|---|---|---|
| 1 | İlk Kan | Salon | Salondaki herhangi bir oyunda skor | 1 oyun |
| 2 | Salon Müdavimi | Salon | Farklı oyunlarda skor | `mudavim` = 5 |
| 3 | Aegis Sahibi | Salon | Salondaki 14 oyunun hepsinde skor | `SALON_IDS.length` (14) |
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
| 16 | Bottle Teslimatı | Oyun | Uçan Kurye ≥ 300 metre (uçulan + şişe bonusu) | `kurye` = 300 |
| 17 | Efsane Kurye | Oyun | Uçan Kurye ≥ 1.000 metre | `kuryeEfsane` = 1000 |
| 18 | Mayın Temizleyici | Oyun | Techies Mayın Tarlası'nda skor (yalnızca kazanılan Orta tahtası, 16×16 · 40 mayın, skor yazar) | — |
| 19 | Sentry Ustası | Oyun | Mayın Tarlası Orta ≤ 90 sn (düşük iyi) | `mayinSentry` = 90 |
| 20 | BKB Bastın | Oyun | Eşya 2048 ≥ 2.500 puan (≈ BKB/Aghanim kademesi) | `esya` = 2500 |
| 21 | Divine Rapier | Oyun | Eşya 2048'de ulaşılan en yüksek kademe ≥ 11 (`picks['esya:tier']`, Rapier = 2048) | `esyaRapier` = 11 |
| 22 | Maraton Tamam | Oyun | 24 Saat Maraton'da en az bir kez 24:00'e varmak (`picks['maraton:tamam']`) | `maratonTamam` = 1 |
| 23 | Kick Fenomeni | Oyun | 24 Saat Maraton ≥ 7.000 izleyici zirvesi (en iyi ~%10) | `maratonFenomen` = 7000 |
| 24 | Teşhis Kondu | Quiz | "Hangi DOG’sun?" sonucu (`picks.hangidog`) | — |
| 25 | Gerçek Hayran | Quiz | Gerçek Hayran Testi ≥ 10/12 | `hayran` = 10 |
| 26 | Bilgi Küpü | Quiz | Bilgi Yarışması ≥ 1.200 puan (10 × 100 + hız bonusu) | `bilgi` = 1200 |
| 27 | Yetenek Avcısı | Quiz | Yetenek Avı quizinde herhangi bir skor (`scores.yetenek`) | — |
| 28 | Endeks Uzmanı | Quiz | Kahramanlar → "Daha DOG mu?" serisi ≥ 10 | `daha` = 10 |
| 29 | DOG DOG DOG | Topluluk | DOG düğmesine 3 kez bas (üç kez söylenir) | `dog` = 3 |
| 30 | 24 Saat Ruhu | Topluluk | DOG düğmesine 24 kez bas (en kısa yayın kadar) | `maraton` = 24 |
| 31 | Espri Eleştirmeni | Topluluk | 10 espriyi DOG'la (`likes['jk:*']`) | `critic` = 10 |

Oyun rozetleri tıklanınca ilgili oyunu açar; quiz/topluluk rozetleri kendi bölümüne gider (`badgeHref`).

**Anahtar ve kimlik notları**
- `THRESHOLDS.maraton` (24) ve rozet kimliği `maraton` 1. turdaki DOG düğmesi rozetine (24 Saat Ruhu) aittir; kazanılmış
  rozetler bozulmasın diye korunur. 24 Saat Maraton oyununun eşikleri `maratonTamam` / `maratonFenomen`, rozet kimlikleri
  `maraton-tamam` / `kick-fenomen`'dir.
- Yeni rozet kimlikleri: `bottle`, `efsane-kurye`, `mayin-temiz`, `sentry`, `bkb`, `rapier`, `maraton-tamam`, `kick-fenomen`.
- Divine Rapier ve Maraton Tamam skor değil profil seçimi (`picks`) okur: `esya.js` ulaşılan en yüksek kademeyi (≥ 7)
  `picks['esya:tier']`'e, `maraton.js` 24:00'e varan her yayında `picks['maraton:tamam']`'ı bir artırır. Kilitli Divine Rapier
  rozetinde ilerleme "En iyi eşyan: Black King Bar" gibi yazılır.
- **Aegis Sahibi** salondaki oyun sayısıyla büyür (`SALON_IDS.length`): 10 oyunla kazanan ziyaretçi, dört yeni oyunu da
  oynayana kadar rozeti kilitli görür (salon envanterindeki Aegis ile aynı kural). Rozetler kayıt tutmadığı için bu bilinçli bir tercih.

## Salon kataloğu (`SALON_GAMES`)

Oyun modüllerini içe aktarmadan (ana sayfa, profil, skor tablosu) salonun oyun listesi. Her kayıt:
`{ id, name, short, icon, color, kind, unit, higherIsBetter, format(n), charge?(n), isNew? }` — `unit` /
`higherIsBetter` / `format` / `charge` oyunların `meta` değerlerinin kopyasıdır (profil rekorları bunları kullanır;
bir oyunun puanlaması değişirse burası da güncellenmeli). `isNew` salonda ve ana sayfada "Yeni" etiketini açar:
şu an yalnızca 2. tur oyunları (kurye, mayin, esya, maraton). `salonGame(id)` kaydı döndürür.

## Görünüm
- **Salon paneli:** ızgara (masaüstü 5 sütun, mobil 2), kazanılanlar önce. Kilitli rozet soluk, altıgen
  simgede kilit; açıklamada ne yapılacağı ve varsa ilerleme çubuğu/metni ("En iyin: 540 puan", "4/5 oyun").
  Mobilde ilk 6 rozet + "Tümünü göster (31)".
- **Ana sayfa kartı:** `8/31`, ilerleme çubuğu, son kazanılan 7 rozetin simgesi (kalanlar kilit),
  "Sıradaki:" en yakın kilitli rozet (ilerleme oranı en yüksek olan) ve "Tüm rozetler" bağlantısı.
