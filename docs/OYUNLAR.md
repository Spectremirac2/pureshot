# Oyunlar ve Quizler

Oyun Salonu (`#oyunlar`, kısayol **W**) 10 oyun, Quizler (`#quizler`, kısayol **E**) 5 quiz içerir. Her oyunun
ayrıntılı tasarım belgesi `docs/oyunlar/` altındadır. Salon düzeni: [oyunlar/salon.md](oyunlar/salon.md),
rozetler: [oyunlar/rozetler.md](oyunlar/rozetler.md), mimari: [MIMARI.md](MIMARI.md).

## Oyun Salonu

| Oyun | Adres | Kategori | Skor | Özet | Belge |
|---|---|---|---|---|---|
| 1vDOQUZ Arena | `#oyunlar--arena` (R) | Refleks | puan ↑ | three.js arenası: okçu kahramanla dalga dalga gelen dokuz DOG’a karşı | [arena](oyunlar/arena.md) |
| DOG Avı | `#oyunlar--dogavi` | Refleks | puan ↑ | Çukurdan çıkan DOG’ları report et; Çift Hasar ve Aegis rünleri | [dogavi](oyunlar/dogavi.md) |
| Last Hit Ustası | `#oyunlar--lasthit` | Refleks | altın ↑ | Creep’in son vuruşunu zamanla, deny et; LH verimi | [lasthit](oyunlar/lasthit.md) |
| Rune Refleksi | `#oyunlar--rune` | Refleks | ms ↓ | Rune belirdiği an kap; DOG yemi erken tıklatır; son 10 ortalama grafiği | [rune](oyunlar/rune.md) |
| DOG Hafıza | `#oyunlar--hafiza` | Zihin | puan ↑ | Kart eşleştirme; DOG destesi veya kahraman portre destesi, 5×4 “Zor” pratik | [hafiza](oyunlar/hafiza.md) |
| **DOGdle** · yeni | `#oyunlar--dogdle` | Günlük · Zihin | tahmin ↓ | Her gün bir gizli kahraman; özellik karşılaştırması, ipuçları, seri, paylaşım | [dogdle](oyunlar/dogdle.md) |
| **Portre Avı** · yeni | `#oyunlar--portre` | Zihin | puan ↑ | Yakınlaştırılmış, pikselli portreden kahramanı tanı; Çaylak / Immortal | [portre](oyunlar/portre.md) |
| **Invoker Kombo** · yeni | `#oyunlar--invoker` | Refleks | büyü ↑ | Q/W/E küreleri + R; 60 sn zaman saldırısı ve 10 büyü yarışı | [invoker](oyunlar/invoker.md) |
| **Pudge Hook** · yeni | `#oyunlar--hook` | Refleks | puan ↑ | Nişan al, kancayı fırlat; düşman +100, dost −50 (DOG DOG DOG) | [hook](oyunlar/hook.md) |
| **DOG Bingo** · yeni | `#oyunlar--bingo` | Yayın | çizgi ↑ | Yayın izlerken 5×5 kartta DOG anlarını işaretle; kart kodu, yayın modu | [bingo](oyunlar/bingo.md) |

↑ yüksek skor iyi, ↓ düşük skor iyi. Salonda **1–9** tuşları görünen kartları sırayla açar; **R** her yerden
Arena’ya gider. En iyi skorlar ziyaretçinin profiline yazılır; her oyunun kendi skor tablosu vardır.

## Quizler

| Quiz | Adres | Özet |
|---|---|---|
| Hangi DOG’sun? | `#quizler--hangidog` | 10 pub durumu → DOG Arşivi’ndeki türün |
| Dota 2 Bilgi Yarışması | `#quizler--bilgi` | 10 soru, soru başına 20 sn, hız bonusu |
| DOG mu Değil mi? | `#quizler--dogmu` | Karar kartları: bu hamle DOG mu? |
| Gerçek Hayran Testi | `#quizler--hayran` | Yayın ve meme bilgisi |
| **Yetenek Avı** · yeni | `#quizler--yetenek` | Yetenek ikonu ve adından kahramanı bul (539 yetenek, 127 kahraman) — [belge](oyunlar/yetenek.md) |

## Rozetler

23 rozet, profildeki skorlardan ve seçimlerden türetilir (ayrı kayıt yok); yeni kazanılan rozet sitenin
her yerinde bildirim olarak görünür. Salonda `#oyunlar--rozetler`, ana sayfada küçük bir kart olarak listelenir.
Eşikler ve liste: [oyunlar/rozetler.md](oyunlar/rozetler.md).

## Ortak kurallar

- Oyun oynarken sitenin kısayolları kapanır, oyundan çıkınca açılır.
- Sekme gizlenince oyun saati durur (kit `createRunner`).
- 390 px mobil: dokunmatik kontroller, ≥ 44 px hedefler, sayfada yatay taşma yok.
- Resmi kahraman portreleri, renderları ve yetenek ikonları Valve’a aittir; ticari olmayan hayran kullanımıyla yer alır.
