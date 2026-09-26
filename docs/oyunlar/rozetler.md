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

37 rozet (Salon 3 · Oyunlar 26 · Quizler 5 · Topluluk 3).

| # | Rozet | Grup | Koşul | Eşik (`THRESHOLDS`) |
|---|---|---|---|---|
| 1 | İlk Kan | Salon | Salondaki herhangi bir oyunda skor | 1 oyun |
| 2 | Salon Müdavimi | Salon | Farklı oyunlarda skor | `mudavim` = 5 |
| 3 | Aegis Sahibi | Salon | Salondaki 14 oyunun hepsinde skor | `SALON_IDS.length` (14) |
| 4 | 1vDOQUZ | Oyun | Arena ≥ 1.200 puan (≈ ilk dalga: 9 DOG × 100 + 300 dalga bonusu) | `arena` = 1200 |
| 5 | Arena Efsanesi | Oyun | Arena ≥ 10.000 puan (Arena 2.0/3.0 puanlamasıyla ≈ 5–6 dalga; Lanet skor çarpanı dahil) | `arenaEfsane` = 10000 |
| 6 | Roshan Avcısı | Oyun | Arena’da Roshan’ı kes (`picks['arena:roshan']` ≥ 1) | `arenaRoshan` = 1 |
| 7 | On Dalga | Oyun | Arena’da 10. dalgaya ulaş (`picks['arena:dalga']`) | `arenaDalga` = 10 |
| 8 | Dört Yüz | Oyun | Okçu, Balta, Buz Cadısı ve Gölge’nin her biriyle ≥ 1.200 (`picks['arena:h:<id>']`) | `arenaHero` = 1200 |
| 9 | Lanet Ustası | Oyun | Lanet 5 ya da üstüyle 5. dalga (`picks['arena:lanet']`, progression.js yazar) | `arenaLanet` = 5 |
| 10 | Kurye’nin Yoldaşı | Oyun | Arena hikâyesinde I. bölümü bitir (`picks['arena:story']` ≥ 1) | — |
| 11 | Lanet Kırıcı | Oyun | Arena hikâyesinin 5 bölümünü bitir (`picks['arena:story']` ≥ 5) | `arenaStory` = 5 |
| 12 | Report Makinesi | Oyun | DOG Avı ≥ 800 puan | `dogavi` = 800 |
| 13 | Last Hit Tanrısı | Oyun | Last Hit ≥ 550 altın (≈ 13 last hit) | `lasthit` = 550 |
| 14 | Hafıza Kralı | Oyun | DOG Hafıza ≥ 600 puan (4×4 masa; ≈ 14 hamle, 24 sn) | `hafiza` = 600 |
| 15 | Refleks Canavarı | Oyun | Rune ortalaması ≤ 300 ms (düşük iyi) | `rune` = 300 |
| 16 | Günlük Dedektif | Oyun | DOGdle'da herhangi bir skor | — |
| 17 | Tek Atış | Oyun | DOGdle ≤ 2 tahmin (düşük iyi) | `dogdleSharp` = 2 |
| 18 | Portre Uzmanı | Oyun | Portre Avı ≥ 3.000 puan (10 tur × 100–500, seri ×2'ye kadar) | `portre` = 3000 |
| 19 | Invoker Çırağı | Oyun | Invoker Kombo ≥ 15 büyü (60 sn) | `invoker` = 15 |
| 20 | Kanca Ustası | Oyun | Pudge Hook ≥ 1.500 puan | `hook` = 1500 |
| 21 | Bingo! | Oyun | DOG Bingo ≥ 1 çizgi | `bingo` = 1 |
| 22 | Bottle Teslimatı | Oyun | Uçan Kurye ≥ 300 metre (uçulan + şişe bonusu) | `kurye` = 300 |
| 23 | Efsane Kurye | Oyun | Uçan Kurye ≥ 1.000 metre | `kuryeEfsane` = 1000 |
| 24 | Mayın Temizleyici | Oyun | Techies Mayın Tarlası'nda skor (yalnızca kazanılan Orta tahtası, 16×16 · 40 mayın, skor yazar) | — |
| 25 | Sentry Ustası | Oyun | Mayın Tarlası Orta ≤ 90 sn (düşük iyi) | `mayinSentry` = 90 |
| 26 | BKB Bastın | Oyun | Eşya 2048 ≥ 2.500 puan (≈ BKB/Aghanim kademesi) | `esya` = 2500 |
| 27 | Divine Rapier | Oyun | Eşya 2048'de ulaşılan en yüksek kademe ≥ 11 (`picks['esya:tier']`, Rapier = 2048) | `esyaRapier` = 11 |
| 28 | Maraton Tamam | Oyun | 24 Saat Maraton'da en az bir kez 24:00'e varmak (`picks['maraton:tamam']`) | `maratonTamam` = 1 |
| 29 | Kick Fenomeni | Oyun | 24 Saat Maraton ≥ 7.000 izleyici zirvesi (en iyi ~%10) | `maratonFenomen` = 7000 |
| 30 | Teşhis Kondu | Quiz | "Hangi DOG’sun?" sonucu (`picks.hangidog`) | — |
| 31 | Gerçek Hayran | Quiz | Gerçek Hayran Testi ≥ 10/12 | `hayran` = 10 |
| 32 | Bilgi Küpü | Quiz | Bilgi Yarışması ≥ 1.200 puan (10 × 100 + hız bonusu) | `bilgi` = 1200 |
| 33 | Yetenek Avcısı | Quiz | Yetenek Avı quizinde herhangi bir skor (`scores.yetenek`) | — |
| 34 | Endeks Uzmanı | Quiz | Kahramanlar → "Daha DOG mu?" serisi ≥ 10 | `daha` = 10 |
| 35 | DOG DOG DOG | Topluluk | DOG düğmesine 3 kez bas (üç kez söylenir) | `dog` = 3 |
| 36 | 24 Saat Ruhu | Topluluk | DOG düğmesine 24 kez bas (en kısa yayın kadar) | `maraton` = 24 |
| 37 | Espri Eleştirmeni | Topluluk | 10 espriyi DOG'la (`likes['jk:*']`) | `critic` = 10 |

Oyun rozetleri tıklanınca ilgili oyunu açar; quiz/topluluk rozetleri kendi bölümüne gider (`badgeHref`).

**Anahtar ve kimlik notları**
- `THRESHOLDS.maraton` (24) ve rozet kimliği `maraton` 1. turdaki DOG düğmesi rozetine (24 Saat Ruhu) aittir; kazanılmış
  rozetler bozulmasın diye korunur. 24 Saat Maraton oyununun eşikleri `maratonTamam` / `maratonFenomen`, rozet kimlikleri
  `maraton-tamam` / `kick-fenomen`'dir.
- Yeni rozet kimlikleri: `bottle`, `efsane-kurye`, `mayin-temiz`, `sentry`, `bkb`, `rapier`, `maraton-tamam`, `kick-fenomen`.
- **Arena (3. tur, kalıcı ilerleme fazı):** `roshan-avcisi`, `on-dalga`, `dort-yuz`, `lanet-ustasi`, `kurye-yoldasi`,
  `lanet-kirici`. Hepsi `picks` okur: `arena:roshan` / `arena:dalga` / `arena:h:<kahraman>` arena.js’in oyun sonu
  kaydıdır; `arena:lanet` (5. dalgaya ulaşılan en yüksek Lanet) ve `arena:story` (en yüksek biten hikâye bölümü, 1–5)
  `progression.js` tarafından yazılır (bkz. [ARENA-ILERLEME.md](../ARENA-ILERLEME.md)). Dört Yüz yalnızca Arena 2.0’ın dört
  ana kahramanını sayar (Kütüphane’den açılan Şimşek Ruhu / Ağaç Bekçisi gerekmez).
- **`arenaEfsane` 6.000 → 10.000:** Arena 2.0/3.0 puanlaması (dalga bonusu, verim, Lanet skor çarpanı) 6.000’i ~3–4
  dalgaya indirdi. Rozetler kayıt tutmadığı için en iyi skoru 6.000–9.999 olan ziyaretçi Arena Efsanesi’ni yeniden kilitli
  görür (Aegis Sahibi ile aynı bilinçli tercih).
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
  Mobilde ilk 6 rozet + "Tümünü göster (37)".
- **Ana sayfa kartı:** `8/37`, ilerleme çubuğu, son kazanılan 7 rozetin simgesi (kalanlar kilit),
  "Sıradaki:" en yakın kilitli rozet (ilerleme oranı en yüksek olan) ve "Tüm rozetler" bağlantısı.
